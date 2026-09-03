#!/usr/bin/env python3
"""
Aeon's End Wiki Scraper
Scrapes gems, relics, spells, mages, unique starters, nemeses, and nemesis cards
for each game and expansion from https://aeonsend.wiki.gg using the MediaWiki API.

Usage:
  python scrape_aeons_end.py
  python scrape_aeons_end.py --output-dir ./data/scraped
  python scrape_aeons_end.py --expansion "The Depths"
  docker run --rm -v ${PWD}:/app -w /app python:3 python scripts/scrape_aeons_end.py
"""

import os
import sys
import json
import time
import re
import argparse
import urllib.request
import urllib.parse
from typing import Dict, List, Any, Optional, Set

API_URL = "https://aeonsend.wiki.gg/api.php"
BASE_PAGE_URL = "https://aeonsend.wiki.gg/wiki/"
DEFAULT_USER_AGENT = "AeonsEndWikiScraper/1.0 (+https://github.com/bigwheels16/aeons-end-game-helper)"

KNOWN_EXPANSIONS = [
    "Aeon's End (Core Box)",
    "The Depths",
    "The Nameless",
    "War Eternal",
    "The Void",
    "The Outer Dark",
    "Legacy",
    "Buried Secrets",
    "The New Age",
    "Into The Wild",
    "The Ancients",
    "Shattered Dreams",
    "Outcasts",
    "Return To Gravehold",
    "Southern Village",
    "Legacy of Gravehold",
    "The Ruins",
    "Past and Future",
    "The Descent",
    "The Caverns",
    "The Surface",
    "The Returned",
    "The Abyss",
    "Evolution",
    "Origins",
    "Tales of Old Gravehold",
    "Beyond the Breach",
    "Promo",
    "Promo Pack 1 (Digital)",
    "The Cinderkeep",
    "The Wastes",
    "System Overload",
]


def clean_wikitext(text: Optional[str]) -> str:
    """Cleans MediaWiki markup into readable text/HTML."""
    if not text:
        return ""
    # Normalize any existing <br> or <br/> tags to newlines for consistent splitting
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # Remove comments
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # Replace Aether symbol template
    text = re.sub(r"\{\{Cost\}\}", '<span class="aether">&AElig;</span>', text, flags=re.IGNORECASE)
    # Replace Card reference templates {{Card|Card Name}} -> Card Name
    text = re.sub(r"\{\{Card\|([^}]+)\}\}", r"\1", text, flags=re.IGNORECASE)
    # Replace wiki links [[Target|Label]] -> Label, [[Target]] -> Target
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    # Remove files / images markup e.g. [[File:...]]
    text = re.sub(r"\[\[File:[^\]]+\]\]", "", text, flags=re.IGNORECASE)
    # Replace quotes and bold/italic markup
    text = re.sub(r"'''''(.*?)'''''", r"<b><i>\1</i></b>", text)
    text = re.sub(r"'''(.*?)'''", r"<b>\1</b>", text)
    text = re.sub(r"''(.*?)''", r"<i>\1</i>", text)
    # Clean generic remaining templates that aren't needed
    text = re.sub(r"\{\{[^}]+\}\}", "", text)
    # Normalize lines and join with <br/>
    lines = [l.strip() for l in text.splitlines()]
    return "<br/>".join(l for l in lines if l).strip()


def parse_template(wikitext: str, template_name: str) -> Optional[Dict[str, str]]:
    """Robustly extracts and parses parameters from a named top-level template."""
    pattern = re.compile(rf"\{{\{{\s*{re.escape(template_name)}\b", re.IGNORECASE)
    match = pattern.search(wikitext)
    if not match:
        return None

    start = match.start()
    depth = 0
    end = -1
    i = start
    while i < len(wikitext):
        if wikitext[i:i+2] == "{{":
            depth += 1
            i += 2
        elif wikitext[i:i+2] == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                end = i
                break
        else:
            i += 1

    if end == -1:
        return None

    template_body = wikitext[match.end():end - 2]
    params: Dict[str, str] = {}
    current_param: List[str] = []
    d_curly = 0
    d_square = 0

    for ch in template_body:
        if ch == "{":
            d_curly += 1
        elif ch == "}":
            d_curly -= 1
        elif ch == "[":
            d_square += 1
        elif ch == "]":
            d_square -= 1

        if ch == "|" and d_curly == 0 and d_square == 0:
            part = "".join(current_param).strip()
            if "=" in part:
                k, v = part.split("=", 1)
                params[k.strip().lower()] = v.strip()
            current_param = []
        else:
            current_param.append(ch)

    if current_param:
        part = "".join(current_param).strip()
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip().lower()] = v.strip()

    return params


def load_page_cache(cache_dir: str) -> Dict[str, Dict[str, Any]]:
    """Loads all individually cached page files from the cache directory."""
    all_data: Dict[str, Dict[str, Any]] = {}
    if not os.path.exists(cache_dir):
        return all_data

    page_files = [
        f for f in os.listdir(cache_dir)
        if f.startswith("page_") and f.endswith(".json")
    ]
    for fname in page_files:
        fpath = os.path.join(cache_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                page_data = json.load(f)
                title = page_data.get("title")
                if title:
                    all_data[title] = page_data
        except Exception as e:
            print(f"Warning: Failed reading cache file {fname} ({e}). Skipping.")
    return all_data


def save_page_file(cache_dir: str, page_data: Dict[str, Any]) -> str:
    """Atomically saves an individual page into a dedicated JSON file named after its page ID."""
    os.makedirs(cache_dir, exist_ok=True)
    page_id = page_data.get("pageid")
    if page_id is None:
        page_id = re.sub(r"[^\w\-]+", "_", page_data.get("title", "unknown")).lower()
    page_path = os.path.join(cache_dir, f"page_{page_id}.json")
    tmp_path = f"{page_path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(page_data, f, ensure_ascii=False)
    os.replace(tmp_path, page_path)
    return page_path


def api_get(params: Dict[str, Any], user_agent: str) -> Dict[str, Any]:
    """Performs an HTTP GET request to the MediaWiki API."""
    params["format"] = "json"
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_category_members(category_title: str, user_agent: str, delay: float = 0.1) -> List[str]:
    """Retrieves all page titles within a specified category."""
    titles: List[str] = []
    cmcontinue = None
    while True:
        params: Dict[str, Any] = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category_title}",
            "cmlimit": 500,
            "cmnamespace": 0,
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        data = api_get(params, user_agent)
        for page in data.get("query", {}).get("categorymembers", []):
            titles.append(page["title"])
        if "continue" in data and "cmcontinue" in data["continue"]:
            cmcontinue = data["continue"]["cmcontinue"]
            time.sleep(delay)
        else:
            break
    return sorted(list(set(titles)))


def fetch_pages_batch(titles: List[str], user_agent: str) -> Dict[str, Dict[str, Any]]:
    """Fetches revisions and categories for a list of page titles (up to 50)."""
    params = {
        "action": "query",
        "prop": "revisions|categories",
        "rvslots": "*",
        "rvprop": "content",
        "cllimit": 500,
        "titles": "|".join(titles),
    }
    data = api_get(params, user_agent)
    pages = data.get("query", {}).get("pages", {})
    results: Dict[str, Dict[str, Any]] = {}
    for pid, page in pages.items():
        if "missing" in page:
            continue
        title = page["title"]
        revs = page.get("revisions", [])
        wikitext = revs[0].get("slots", {}).get("main", {}).get("*", "") if revs else ""
        categories = [c["title"].replace("Category:", "") for c in page.get("categories", [])]
        pageid = page.get("pageid", pid)
        results[title] = {
            "pageid": int(pageid) if str(pageid).isdigit() else pageid,
            "title": title,
            "wikitext": wikitext,
            "categories": categories,
        }
    return results


def extract_expansions(params: Dict[str, str], categories: List[str]) -> List[str]:
    """Determines game/expansion name(s) from template parameters or category tags."""
    expansions: List[str] = []
    # Check box parameters (e.g. box, box 1, box 2, ...)
    for k, v in params.items():
        if (k == "box" or k.startswith("box ")) and v:
            clean_box = clean_wikitext(v).strip()
            if clean_box and clean_box not in expansions:
                expansions.append(clean_box)

    # Fallback to category check
    if not expansions:
        for cat in categories:
            for exp in KNOWN_EXPANSIONS:
                if cat.lower() == exp.lower() and exp not in expansions:
                    expansions.append(exp)

    return expansions if expansions else ["Unknown"]


def process_player_card(title: str, page_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parses PlayerCard templates (Gems, Relics, Spells, and Unique Starters)."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "PlayerCard")
    if not params:
        return None

    card_type = params.get("type", "").capitalize()
    cost = clean_wikitext(params.get("cost", "")).strip() or "0"

    unique_to = params.get("unique to") or ""
    unique_to = clean_wikitext(unique_to)
    is_unique = bool(unique_to) or cost == "0"

    rules = clean_wikitext(params.get("rules") or params.get("effect") or "")
    card_id = params.get("id 1") or params.get("id") or ""
    card_id = clean_wikitext(card_id).split("\n")[0].strip()

    expansions = extract_expansions(params, page_data["categories"])

    item: Dict[str, Any] = {
        "name": title,
        "type": card_type,
        "cost": cost,
        "effect": rules,
        "expansions": expansions,
        "id": card_id,
        "page_url": f"{BASE_PAGE_URL}{urllib.parse.quote(title.replace(' ', '_'))}",
    }

    if is_unique:
        item["category"] = "unique_starters"
        item["mage"] = unique_to
    else:
        type_lower = card_type.lower()
        if type_lower in ("gem", "relic", "spell"):
            item["category"] = "supply"
        else:
            item["category"] = "other_player_cards"

    return item


def parse_mage_breaches(params: Dict[str, str], wikitext: str) -> List[List[str]]:
    """
    Parses mage breach information into an ordered list of pairs [breach_type, starting_position]:
      example: [["I", "down"], ["II", "left"], ["Refined Breach", "right"], ["IV", "down"]]
    """
    slot_romans = {1: "I", 2: "II", 3: "III", 4: "IV"}
    default_closed_positions = {1: "down", 2: "left", 3: "right", 4: "down"}

    # Extract slots from {{BreachTable|slot1|slot2|slot3|slot4}} if available
    slots = []
    bt_match = re.search(r"\{\{BreachTable\|([^}]+)\}\}", wikitext, re.IGNORECASE)
    if bt_match:
        slots = [p.strip() for p in bt_match.group(1).split("|")]

    # Fallback to Breach1..4 in template params if BreachTable missing or incomplete
    if len(slots) < 4:
        slots = [
            params.get("breach1", ""),
            params.get("breach2", ""),
            params.get("breach3", ""),
            params.get("breach4", ""),
        ]

    breaches: List[List[str]] = []

    for i in range(1, 5):
        raw_val = slots[i - 1] if i <= len(slots) else ""
        s = raw_val.replace("_", " ").strip()
        s_lower = s.lower()

        # Check standard breach orientations
        if s_lower in ("open", "none", "no breach", "up", "down", "left", "right"):
            pos = "none" if s_lower in ("none", "no breach") else s_lower
            breaches.append([slot_romans[i], pos])
            continue

        # Custom breach
        if re.search(r"\bopen\b|\bopened\b", s_lower):
            pos = "open"
        elif re.search(r"\bright\b", s_lower):
            pos = "right"
        elif re.search(r"\bleft\b", s_lower):
            pos = "left"
        elif re.search(r"\bdown\b", s_lower):
            pos = "down"
        elif re.search(r"\bup\b", s_lower):
            pos = "up"
        elif re.search(r"\bnone\b|\bno breach\b", s_lower):
            pos = "none"
        elif i == 1 and "archive breach i" in s_lower:
            pos = "open"
        else:
            pos = default_closed_positions[i]

        clean_name = re.sub(r"\b(open|opened|closed|back|icon|right|left|down|up)\b", "", s, flags=re.IGNORECASE)
        clean_name = " ".join(clean_name.split()).strip()
        if not clean_name.lower().endswith("breach") and not any(clean_name.lower().endswith(f"breach {r}".lower()) for r in ("i", "ii", "iii", "iv")):
            if "breach" not in clean_name.lower():
                clean_name += " Breach"

        breaches.append([clean_name, pos])

    return breaches


def process_mage(title: str, page_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parses Mage templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "Mage")
    if not params:
        return None

    charges = clean_wikitext(params.get("charge spaces", "")).strip() or "0"

    expansions = extract_expansions(params, page_data["categories"])

    # Extract unique cards list
    unique_cards_raw = params.get("unique cards", "")
    unique_cards = re.findall(r"\{\{Card\|([^}]+)\}\}", unique_cards_raw, re.IGNORECASE)
    if not unique_cards:
        unique_cards = [c.strip() for c in unique_cards_raw.split(",") if c.strip()]

    # Parse ability activation timing and effect body
    raw_effect = params.get("effect", "")
    act_match = re.match(r"^(Activate\s+[^:]+:?)\s*(.*)", raw_effect, re.IGNORECASE | re.DOTALL)
    if act_match:
        activation = act_match.group(1).strip()
        if not activation.endswith(":"):
            activation += ":"
        effect_body = act_match.group(2).strip()
    else:
        timing_match = re.search(r"\|\s*timing\s*=\s*([^\|\n\}]+)", wikitext, re.IGNORECASE)
        if timing_match:
            t = timing_match.group(1).strip()
            if not t.lower().startswith("activate"):
                t = f"Activate {t}"
            if not t.endswith(":"):
                t += ":"
            activation = t
            effect_body = raw_effect
        else:
            activation = ""
            effect_body = raw_effect

    return {
        "name": title,
        "type": "Mage",
        "title": clean_wikitext(params.get("title", "")),
        "expansions": expansions,
        "charges": charges,
        "ability_name": clean_wikitext(params.get("name", "")),
        "ability_activation": clean_wikitext(activation),
        "ability_effect": clean_wikitext(effect_body),
        "unique_cards": unique_cards,
        "starting_hand": clean_wikitext(params.get("starting hand", "")),
        "starting_deck": clean_wikitext(params.get("starting deck", "")),
        "breaches": parse_mage_breaches(params, wikitext),
        "category": "mages",
        "page_url": f"{BASE_PAGE_URL}{urllib.parse.quote(title.replace(' ', '_'))}",
    }


def process_nemesis(title: str, page_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parses Nemesis templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "Nemesis")
    if not params:
        return None

    health = clean_wikitext(params.get("life", "")).strip() or "0"
    difficulty = clean_wikitext(params.get("difficulty level", "")).strip() or "0"

    expansions = extract_expansions(params, page_data["categories"])

    return {
        "name": title,
        "type": "Nemesis",
        "health": health,
        "difficulty": difficulty,
        "expedition_battle": clean_wikitext(params.get("expedition battle", "")),
        "unleash": clean_wikitext(params.get("unleash", "")),
        "increased_difficulty": clean_wikitext(params.get("increased difficulty", "")),
        "rules": clean_wikitext(params.get("rules", "")),
        "setup": clean_wikitext(params.get("setup", "")),
        "expansions": expansions,
        "category": "nemeses",
        "page_url": f"{BASE_PAGE_URL}{urllib.parse.quote(title.replace(' ', '_'))}",
    }


def process_nemesis_card(title: str, page_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parses NemesisCard templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "NemesisCard")
    if not params:
        return None

    tier_raw = clean_wikitext(params.get("tier", "")).strip()
    clean_tier = re.sub(r"[^\d]", "", tier_raw)
    tier = clean_tier if clean_tier else tier_raw

    expansions = extract_expansions(params, page_data["categories"])
    card_id = params.get("id 1") or params.get("id") or ""
    card_id = clean_wikitext(card_id).split("\n")[0].strip()

    card_type = clean_wikitext(params.get("type", "")).capitalize()

    card: Dict[str, Any] = {
        "name": title,
        "type": card_type,
        "tier": tier,
        "effect": clean_wikitext(params.get("effect", "")),
        "nemesis": clean_wikitext(params.get("nemesis", "Basic")),
        "id": card_id,
        "expansions": expansions,
        "category": "nemesis_cards",
        "page_url": f"{BASE_PAGE_URL}{urllib.parse.quote(title.replace(' ', '_'))}",
    }

    if card_type == "Minion":
        life_str = clean_wikitext(params.get("life", ""))
        if not life_str:
            resolve_minion = parse_template(wikitext, "ResolveNemesisMinion")
            if resolve_minion and resolve_minion.get("count"):
                life_str = clean_wikitext(resolve_minion.get("count"))
        if life_str:
            clean_digits = re.sub(r"[^\d]", "", life_str)
            if clean_digits:
                card["life"] = int(clean_digits)
            else:
                card["life"] = life_str
    elif card_type == "Power":
        power_val: Optional[str] = None

        # Strategy 1: Check |power parameter in NemesisCard
        if params.get("power"):
            p_num = re.sub(r"[^\d]", "", clean_wikitext(params.get("power")))
            if p_num:
                power_val = p_num

        # Strategy 2: Check {{ResolveNemesisPower | count = X}}
        if power_val is None:
            resolve_power = parse_template(wikitext, "ResolveNemesisPower")
            if resolve_power and resolve_power.get("count"):
                c_num = re.sub(r"[^\d]", "", clean_wikitext(resolve_power.get("count")))
                if c_num:
                    power_val = c_num

        # Strategy 3: Regex match "POWER X:" in effect or full wikitext
        if power_val is None:
            effect_text = params.get("effect", "")
            m = re.search(r"\bPOWER\s+(\d+)\s*:", effect_text, re.IGNORECASE)
            if not m:
                m = re.search(r"\bPOWER\s+(\d+)\s*:", wikitext, re.IGNORECASE)
            if m:
                power_val = str(m.group(1))

        if power_val is not None:
            card["power"] = power_val

    return card


def scrape(args: argparse.Namespace) -> None:
    print(f"=== Starting Aeon's End Wiki Scrape ===")
    print(f"Target: {API_URL}")
    print(f"Output Directory: {args.output_dir}\n")

    os.makedirs(args.output_dir, exist_ok=True)
    cache_dir = os.path.join(args.output_dir, ".cache")
    all_pages_data: Dict[str, Dict[str, Any]] = {}

    if args.cache_only:
        print("=== Running in Cache-Only Mode (No Network Downloads) ===")
        print(f"Reading cached pages from: {cache_dir}/\n")
        all_pages_data = load_page_cache(cache_dir)
        if not all_pages_data:
            print(f"Error: No cached pages found in {cache_dir}/.")
            print("Run the scraper without --cache-only first to download the wiki data.")
            sys.exit(1)
        print(f"Loaded {len(all_pages_data)} cached pages.")
    else:
        # Step 1: Collect unique titles across categories
        categories_to_fetch = [
            ("Gem", "gems"),
            ("Relic", "relics"),
            ("Spell", "spells"),
            ("Mage", "mages"),
            ("Nemesis", "nemeses"),
            ("Nemesis Card", "nemesis_cards"),
        ]

        all_titles: Set[str] = set()
        category_map: Dict[str, str] = {}

        for cat_name, cat_key in categories_to_fetch:
            print(f"Fetching titles from Category:{cat_name}...")
            titles = get_category_members(cat_name, args.user_agent, delay=args.delay)
            print(f"  -> Found {len(titles)} pages in Category:{cat_name}")
            for t in titles:
                all_titles.add(t)
                if t not in category_map:
                    category_map[t] = cat_key

        total_titles = len(all_titles)
        print(f"\nTotal unique pages to process: {total_titles}\n")

        if args.dry_run:
            print("Dry run requested. Exiting without fetching page content.")
            return

        # Step 2: Batch fetch pages with per-page file caching
        if not args.no_cache:
            all_pages_data = load_page_cache(cache_dir)
            if all_pages_data:
                print(f"Loaded {len(all_pages_data)} pages from cache directory ({cache_dir}/).")

        title_list = sorted(list(all_titles))
        titles_to_fetch = [t for t in title_list if t not in all_pages_data]
        print(f"Total pages: {len(title_list)} | Cached: {len(all_pages_data)} | Remaining to fetch: {len(titles_to_fetch)}")

        if titles_to_fetch:
            batch_size = args.batch_size
            total_batches = (len(titles_to_fetch) + batch_size - 1) // batch_size

            print(f"Fetching {len(titles_to_fetch)} page contents in batches of {batch_size}...")
            try:
                for i in range(0, len(titles_to_fetch), batch_size):
                    batch = titles_to_fetch[i : i + batch_size]
                    current_batch = i // batch_size + 1
                    print(f"  Fetching batch {current_batch}/{total_batches} ({len(batch)} pages)...")
                    batch_results = fetch_pages_batch(batch, args.user_agent)
                    for title, page_data in batch_results.items():
                        all_pages_data[title] = page_data
                        if not args.no_cache:
                            save_page_file(cache_dir, page_data)
                    time.sleep(args.delay)
            except KeyboardInterrupt:
                print("\n\nScraping interrupted by user (Ctrl+C).")
                print(f"All saved page files are preserved in {cache_dir}/ ({len(all_pages_data)} pages cached).")
                print("Re-run the command to pick up right where you left off.")
                sys.exit(130)

    # Step 3: Parse items into structured records
    print("\nParsing item templates and classifying content...")
    scraped_items: List[Dict[str, Any]] = []

    for title, page_data in all_pages_data.items():
        parsed_item: Optional[Dict[str, Any]] = None
        wikitext = page_data["wikitext"]

        if "{{PlayerCard" in wikitext or "{{playercard" in wikitext:
            parsed_item = process_player_card(title, page_data)
        elif "{{Mage" in wikitext or "{{mage" in wikitext:
            parsed_item = process_mage(title, page_data)
        elif "{{NemesisCard" in wikitext or "{{nemesiscard" in wikitext:
            parsed_item = process_nemesis_card(title, page_data)
        elif "{{Nemesis" in wikitext or "{{nemesis" in wikitext:
            parsed_item = process_nemesis(title, page_data)

        if parsed_item:
            scraped_items.append(parsed_item)

    print(f"Successfully parsed {len(scraped_items)} items.")

    # Step 4: Group data
    # Categories: supply, unique_starters, mages, nemeses, nemesis_cards
    by_category: Dict[str, List[Dict[str, Any]]] = {
        "supply": [],
        "unique_starters": [],
        "mages": [],
        "nemeses": [],
        "nemesis_cards": [],
    }

    for item in scraped_items:
        cat = item.pop("category", "")
        if args.expansion:
            target = args.expansion.lower()
            item_exps = [e.lower() for e in item.get("expansions", [])]
            if not any(target in e for e in item_exps):
                continue
        if cat in by_category:
            by_category[cat].append(item)

    if args.expansion:
        print(f"Filtered records to expansion matching '{args.expansion}'")

    # Step 5: Save output files
    os.makedirs(args.output_dir, exist_ok=True)

    # Flat category JSON (aeons_end_all.json)
    all_path = os.path.join(args.output_dir, "aeons_end_all.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(by_category, f, indent=2, ensure_ascii=False)
    print(f"\nSaved master JSON: {all_path}\n")

    # Step 6: Summary Printout
    print("=== Scraping Summary ===")
    total_saved = 0
    for cat, items in by_category.items():
        print(f"  {cat:18}: {len(items)} items")
        total_saved += len(items)
    print(f"\nTotal Items Saved: {total_saved}")
    print("Scraping complete!")


def main():
    parser = argparse.ArgumentParser(description="Scrape Aeon's End game data from aeonsend.wiki.gg")
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "..", "data", "scraped"),
        help="Directory where scraped JSON data will be written",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of pages to fetch per API query (max 50)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.15,
        help="Delay in seconds between batch API calls to prevent rate limiting",
    )
    parser.add_argument(
        "--expansion",
        type=str,
        default=None,
        help="Filter and save only a specific expansion (e.g. 'The Depths')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect categories without fetching full page contents",
    )
    parser.add_argument(
        "--cache-only",
        "--skip-download",
        action="store_true",
        dest="cache_only",
        help="Skip all network downloads and parse directly from existing cached files in .cache/",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Ignore existing cache file and re-fetch all pages from scratch",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_USER_AGENT,
        help="Custom User-Agent header for API requests",
    )

    args = parser.parse_args()
    scrape(args)


if __name__ == "__main__":
    main()
