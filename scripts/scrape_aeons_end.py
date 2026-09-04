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
from typing import Dict, List, Any, Optional, Set, Tuple

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


ALLOWED_HTML_TAGS = {"b", "i", "em", "strong", "br", "span", "hr", "small", "img"}


def sanitize_html_markup(html: str) -> str:
    """
    Sanitizes HTML markup from wiki content:
    - Strips executable/active tags and their contents (script, style, iframe, object, embed, etc.)
    - Removes MediaWiki <nowiki> tags
    - Enforces strict whitelist of formatting tags (b, i, em, strong, br, span, hr, small, img)
    - Strips all JavaScript event handlers (on*) and unsafe URI schemes (javascript:, data:)
    - Preserves only safe attributes (class="aether", trusted wiki images)
    """
    if not html:
        return ""

    # Strip dangerous container elements and their contents
    html = re.sub(
        r"<(script|style|iframe|object|embed|applet|form)[^>]*>.*?</\1>",
        "",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    # Strip dangerous self-closing/void tags (note: img is safely parsed in clean_tag)
    html = re.sub(
        r"<(script|style|iframe|object|embed|applet|form|input|button|svg|link|meta|base)[^>]*>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    # Strip <nowiki> tags
    html = re.sub(r"</?nowiki\s*>", "", html, flags=re.IGNORECASE)

    # Filter remaining HTML tags against allowed whitelist
    def clean_tag(match: re.Match) -> str:
        is_closing = bool(match.group(1))
        tag_name = match.group(2).lower()
        raw_attrs = match.group(3) or ""
        is_self_closing = bool(match.group(4))

        if tag_name not in ALLOWED_HTML_TAGS:
            return ""

        if is_closing:
            return f"</{tag_name}>"

        if tag_name in ("br", "hr") or (is_self_closing and tag_name != "img"):
            return f"<{tag_name}/>"

        if tag_name == "img":
            src_match = re.search(r'\bsrc=[\'"]([^\'"]+)[\'"]', raw_attrs, re.IGNORECASE)
            if not src_match:
                return ""
            src = src_match.group(1)
            # Strictly validate src points to trusted HTTPS wiki images
            if not src.startswith("https://aeonsend.wiki.gg/images/"):
                return ""
            img_attrs = [f'src="{src}"']
            alt_match = re.search(r'\balt=[\'"]([^\'"]*)[\'"]', raw_attrs, re.IGNORECASE)
            if alt_match:
                img_attrs.append(f'alt="{alt_match.group(1)}"')
            width_match = re.search(r'\bwidth=[\'"](\d+)[\'"]', raw_attrs, re.IGNORECASE)
            if width_match:
                img_attrs.append(f'width="{width_match.group(1)}"')
            img_attrs.append('style="display: block; margin: 0.5rem auto; max-width: 100%; height: auto;"')
            img_attrs.append('loading="lazy"')
            return f'<img {" ".join(img_attrs)}/>'

        # Block any inline event handlers (on*) or javascript: URIs
        if re.search(r"\bon\w+\s*=", raw_attrs, re.IGNORECASE) or "javascript:" in raw_attrs.lower():
            return f"<{tag_name}>"

        safe_attrs = []
        if re.search(r'\bclass=[\'"]aether[\'"]', raw_attrs, re.IGNORECASE):
            safe_attrs.append('class="aether"')
        if re.search(r'\bstyle=[\'"][^"\']*text-align:\s*(center|left|right)[^"\']*[\'"]', raw_attrs, re.IGNORECASE):
            safe_attrs.append('style="text-align: center;"')

        attr_str = (" " + " ".join(safe_attrs)) if safe_attrs else ""
        return f"<{tag_name}{attr_str}>"

    return re.sub(r"<(/)?([a-zA-Z0-9]+)(?:\s+([^>]*?))?\s*(/)?>", clean_tag, html)


def clean_wikitext(text: Optional[str]) -> str:
    """Cleans MediaWiki markup into safe readable text/HTML."""
    if not text:
        return ""
    # Normalize any existing <br> or <br/> tags to newlines for consistent splitting
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # Remove comments (including trailing unclosed comments)
    text = re.sub(r"<!--.*?(?:-->|$)", "", text, flags=re.DOTALL)
    # Replace game mechanic templates
    text = re.sub(r"\{\{Cost\}\}", '<span class="aether">&AElig;</span>', text, flags=re.IGNORECASE)
    text = re.sub(r"\{\{AetherToken\}\}", '<span class="aether">&AElig;</span> token', text, flags=re.IGNORECASE)
    text = re.sub(r"\{\{Knowledge\}\}", "Knowledge", text, flags=re.IGNORECASE)
    text = re.sub(r"\{\{Recall\}\}", "<b>Recall:</b>", text, flags=re.IGNORECASE)
    # Replace Card reference templates {{Card|Target|Label}} -> Label, {{Card|Target}} -> Target
    text = re.sub(r"\{\{Card\|(?:[^|}]*\|)?([^}]+)\}\}", r"\1", text, flags=re.IGNORECASE)

    # Process files / images markup e.g. [[File:Fury_token.png|50px|center]] BEFORE general wiki link replacement
    def replace_file_markup(match: re.Match) -> str:
        body = match.group(1)
        parts = [p.strip() for p in body.split("|")]
        filename = parts[0]
        if not re.search(r"\.(png|jpg|jpeg|webp|svg)$", filename, re.IGNORECASE):
            return ""

        width = "50"
        for p in parts[1:]:
            w_match = re.match(r"^(\d+)px$", p, re.IGNORECASE)
            if w_match:
                width = w_match.group(1)
                break

        alt = re.sub(r"\.[^.]+$", "", filename).replace("_", " ")
        encoded_file = urllib.parse.quote(filename.replace(" ", "_"))
        return f'<img src="https://aeonsend.wiki.gg/images/{encoded_file}" alt="{alt}" width="{width}"/>'

    text = re.sub(r"\[\[(?:File|Image):([^\]]+)\]\]", replace_file_markup, text, flags=re.IGNORECASE)
    # Strip any orphaned layout artifacts (e.g. 50px|center)
    text = re.sub(r"\b\d+px\|(?:center|left|right)\b", "", text, flags=re.IGNORECASE)

    # Replace wiki links [[Target|Label]] -> Label, [[Target]] -> Target
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    # Replace quotes and bold/italic markup
    text = re.sub(r"'''''(.*?)'''''", r"<b><i>\1</i></b>", text)
    text = re.sub(r"'''(.*?)'''", r"<b>\1</b>", text)
    text = re.sub(r"''(.*?)''", r"<i>\1</i>", text)
    # Strip remaining parameterized metadata templates (unparameterized templates are preserved as-is)
    text = re.sub(r"\{\{[^}|]+\|[^}]*\}\}", "", text, flags=re.DOTALL)
    # Sanitize any raw HTML and strip disallowed tags/handlers
    text = sanitize_html_markup(text)
    # Normalize lines and join with <br/>
    lines = [l.strip() for l in text.splitlines()]
    return "<br/>".join(l for l in lines if l).strip()


def make_page_url(title: str) -> str:
    """Returns the canonical, validated HTTPS wiki URL for a given page title."""
    encoded_title = urllib.parse.quote(title.replace(" ", "_"))
    url = f"{BASE_PAGE_URL}{encoded_title}"
    if not url.startswith("https://"):
        raise ValueError(f"Insecure URL scheme: {url}")
    return url


def get_clean(params: Dict[str, str], key: str, default: str = "") -> str:
    """Retrieves and cleans wikitext for a given parameter key."""
    val = params.get(key)
    return clean_wikitext(val) if val is not None else default


def extract_card_id(params: Dict[str, str]) -> str:
    """Extracts and normalizes card identifier from template parameters."""
    raw_id = params.get("id 1") or params.get("id") or ""
    return clean_wikitext(raw_id).split("\n")[0].strip()


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
    # Strip HTML comments from template_body before parameter splitting so commented pipes don't leak into parameters
    template_body = re.sub(r"<!--.*?-->", "", template_body, flags=re.DOTALL)
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
    """Atomically and safely saves an individual page into a dedicated JSON file in the cache directory."""
    os.makedirs(cache_dir, exist_ok=True)
    raw_page_id = str(page_data.get("pageid", ""))
    if not raw_page_id.isdigit():
        raw_page_id = re.sub(r"[^\w\-]+", "_", str(page_data.get("title", "unknown"))).lower()

    safe_filename = f"page_{os.path.basename(raw_page_id)}.json"
    cache_root = os.path.realpath(cache_dir)
    target_path = os.path.realpath(os.path.join(cache_root, safe_filename))

    if not target_path.startswith(cache_root):
        raise ValueError(f"Path traversal detected in cache filename: {safe_filename}")

    tmp_path = f"{target_path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(page_data, f, ensure_ascii=False)
    os.replace(tmp_path, target_path)
    return target_path


def api_get(params: Dict[str, Any], user_agent: str) -> Dict[str, Any]:
    """Performs an HTTP GET request to the MediaWiki API with timeout and HTTPS enforcement."""
    params["format"] = "json"
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    if not url.startswith("https://"):
        raise ValueError(f"Insecure API endpoint: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req, timeout=30) as resp:
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


def process_player_card(title: str, page_data: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Parses PlayerCard templates (Gems, Relics, Spells, and Unique Starters)."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "PlayerCard")
    if not params:
        return None

    card_type = get_clean(params, "type").capitalize()
    cost = get_clean(params, "cost").strip() or "0"
    unique_to = get_clean(params, "unique to")
    is_unique = bool(unique_to) or cost == "0"
    rules = get_clean(params, "rules") or get_clean(params, "effect")
    card_id = extract_card_id(params)
    expansions = extract_expansions(params, page_data["categories"])

    item: Dict[str, Any] = {
        "name": title,
        "type": card_type,
        "cost": cost,
        "effect": rules,
        "expansions": expansions,
        "id": card_id,
        "page_url": make_page_url(title),
    }

    if is_unique:
        item["mage"] = unique_to
        return "unique_starters", item

    if card_type.lower() in ("gem", "relic", "spell"):
        return "supply", item

    return "other_player_cards", item


def parse_mage_breaches(params: Dict[str, str], wikitext: str) -> List[List[str]]:
    """
    Parses mage breach information into an ordered list of pairs [breach_type, starting_position]:
      example: [["I", "down"], ["II", "left"], ["Refined Breach", "right"], ["IV", "down"]]
    """
    slot_romans = {1: "I", 2: "II", 3: "III", 4: "IV"}
    default_closed = {1: "down", 2: "left", 3: "right", 4: "down"}

    bt_match = re.search(r"\{\{BreachTable\|([^}]+)\}\}", wikitext, re.IGNORECASE)
    slots = [p.strip() for p in bt_match.group(1).split("|")] if bt_match else []
    if len(slots) < 4:
        slots = [params.get(f"breach{i}", "") for i in range(1, 5)]

    breaches: List[List[str]] = []
    for i in range(1, 5):
        raw = (slots[i - 1] if i <= len(slots) else "").replace("_", " ").strip()
        raw_lower = raw.lower()

        # Orientation
        if any(w in raw_lower for w in ("open", "opened")) or (i == 1 and "archive breach i" in raw_lower):
            pos = "open"
        elif any(w in raw_lower for w in ("none", "no breach")):
            pos = "none"
        elif "right" in raw_lower:
            pos = "right"
        elif "left" in raw_lower:
            pos = "left"
        elif "up" in raw_lower:
            pos = "up"
        elif "down" in raw_lower:
            pos = "down"
        else:
            pos = default_closed[i]

        # Name
        if raw_lower in ("open", "none", "no breach", "up", "down", "left", "right"):
            name = slot_romans[i]
        else:
            clean_name = re.sub(r"\b(open|opened|closed|back|icon|right|left|down|up)\b", "", raw, flags=re.IGNORECASE)
            clean_name = " ".join(clean_name.split()).strip()
            if not clean_name.lower().endswith("breach") and not any(clean_name.lower().endswith(f"breach {r}") for r in ("i", "ii", "iii", "iv")):
                if "breach" not in clean_name.lower():
                    clean_name += " Breach"
            name = clean_name or slot_romans[i]

        breaches.append([name, pos])

    return breaches


def process_mage(title: str, page_data: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Parses Mage templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "Mage")
    if not params:
        return None

    charges_raw = get_clean(params, "charge spaces").strip()
    charges = re.sub(r"[^\d]", "", charges_raw) or charges_raw or "0"
    expansions = extract_expansions(params, page_data["categories"])

    unique_cards_raw = params.get("unique cards", "")
    unique_cards = [c.split("|")[-1].strip() for c in re.findall(r"\{\{Card\|([^}]+)\}\}", unique_cards_raw, re.IGNORECASE)]
    if not unique_cards:
        unique_cards = [c.strip() for c in unique_cards_raw.split(",") if c.strip()]

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

    item: Dict[str, Any] = {
        "name": title,
        "type": "Mage",
        "title": get_clean(params, "title"),
        "expansions": expansions,
        "charges": charges,
        "ability_name": get_clean(params, "name"),
        "ability_activation": clean_wikitext(activation),
        "ability_effect": clean_wikitext(effect_body),
        "unique_cards": unique_cards,
        "starting_hand": get_clean(params, "starting hand"),
        "starting_deck": get_clean(params, "starting deck"),
        "breaches": parse_mage_breaches(params, wikitext),
        "page_url": make_page_url(title),
    }
    return "mages", item


def process_nemesis(title: str, page_data: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Parses Nemesis templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "Nemesis")
    if not params:
        return None

    item: Dict[str, Any] = {
        "name": title,
        "type": "Nemesis",
        "health": get_clean(params, "life").strip() or "0",
        "difficulty": get_clean(params, "difficulty level").strip() or "0",
        "expedition_battle": get_clean(params, "expedition battle"),
        "unleash": get_clean(params, "unleash"),
        "increased_difficulty": get_clean(params, "increased difficulty"),
        "rules": get_clean(params, "rules"),
        "setup": get_clean(params, "setup"),
        "expansions": extract_expansions(params, page_data["categories"]),
        "page_url": make_page_url(title),
    }
    return "nemeses", item


def process_nemesis_card(title: str, page_data: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Parses NemesisCard templates."""
    wikitext = page_data["wikitext"]
    params = parse_template(wikitext, "NemesisCard")
    if not params:
        return None

    tier_raw = get_clean(params, "tier").strip()
    clean_tier = re.sub(r"[^\d]", "", tier_raw)
    tier = clean_tier if clean_tier else tier_raw

    card_type = get_clean(params, "type").capitalize()

    card: Dict[str, Any] = {
        "name": title,
        "type": card_type,
        "tier": tier,
        "effect": get_clean(params, "effect"),
        "nemesis": get_clean(params, "nemesis", default="Basic"),
        "id": extract_card_id(params),
        "expansions": extract_expansions(params, page_data["categories"]),
        "page_url": make_page_url(title),
    }

    if card_type == "Minion":
        life_str = get_clean(params, "life")
        if not life_str:
            resolve_minion = parse_template(wikitext, "ResolveNemesisMinion")
            if resolve_minion and resolve_minion.get("count"):
                life_str = clean_wikitext(resolve_minion.get("count"))
        if life_str:
            clean_digits = re.sub(r"[^\d]", "", life_str)
            card["life"] = int(clean_digits) if clean_digits else life_str
    elif card_type == "Power":
        power_val: Optional[str] = None
        if params.get("power"):
            p_num = re.sub(r"[^\d]", "", get_clean(params, "power"))
            if p_num:
                power_val = p_num

        if power_val is None:
            resolve_power = parse_template(wikitext, "ResolveNemesisPower")
            if resolve_power and resolve_power.get("count"):
                c_num = re.sub(r"[^\d]", "", clean_wikitext(resolve_power.get("count")))
                if c_num:
                    power_val = c_num

        if power_val is None:
            m = re.search(r"\bPOWER\s+(\d+)\s*:", params.get("effect", "") or wikitext, re.IGNORECASE)
            if m:
                power_val = str(m.group(1))

        if power_val is not None:
            card["power"] = power_val

    return "nemesis_cards", card


def collect_or_load_pages(args: argparse.Namespace, cache_dir: str) -> Optional[Dict[str, Dict[str, Any]]]:
    """Loads cached page files or fetches needed pages from the MediaWiki API."""
    if args.cache_only:
        print("=== Running in Cache-Only Mode (No Network Downloads) ===")
        print(f"Reading cached pages from: {cache_dir}/\n")
        all_pages_data = load_page_cache(cache_dir)
        if not all_pages_data:
            print(f"Error: No cached pages found in {cache_dir}/.")
            print("Run the scraper without --cache-only first to download the wiki data.")
            sys.exit(1)
        print(f"Loaded {len(all_pages_data)} cached pages.")
        return all_pages_data

    categories = ["Gem", "Relic", "Spell", "Mage", "Nemesis", "Nemesis Card"]
    all_titles: Set[str] = set()

    for cat_name in categories:
        print(f"Fetching titles from Category:{cat_name}...")
        titles = get_category_members(cat_name, args.user_agent, delay=args.delay)
        print(f"  -> Found {len(titles)} pages in Category:{cat_name}")
        all_titles.update(titles)

    print(f"\nTotal unique pages to process: {len(all_titles)}\n")

    if args.dry_run:
        print("Dry run requested. Exiting without fetching page content.")
        return None

    all_pages_data: Dict[str, Dict[str, Any]] = {}
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

    return all_pages_data


def parse_and_group(
    all_pages_data: Dict[str, Dict[str, Any]],
    expansion_filter: Optional[str] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """Parses raw wiki page data into categorized game records, optionally filtering by expansion."""
    print("\nParsing item templates and classifying content...")
    by_category: Dict[str, List[Dict[str, Any]]] = {
        "supply": [],
        "unique_starters": [],
        "mages": [],
        "nemeses": [],
        "nemesis_cards": [],
    }
    total_parsed = 0

    for title, page_data in all_pages_data.items():
        wikitext = page_data["wikitext"]
        res: Optional[Tuple[str, Dict[str, Any]]] = None

        if "{{PlayerCard" in wikitext or "{{playercard" in wikitext:
            res = process_player_card(title, page_data)
        elif "{{Mage" in wikitext or "{{mage" in wikitext:
            res = process_mage(title, page_data)
        elif "{{NemesisCard" in wikitext or "{{nemesiscard" in wikitext:
            res = process_nemesis_card(title, page_data)
        elif "{{Nemesis" in wikitext or "{{nemesis" in wikitext:
            res = process_nemesis(title, page_data)

        if not res:
            continue

        cat, item = res
        total_parsed += 1

        if expansion_filter:
            target = expansion_filter.lower()
            item_exps = [e.lower() for e in item.get("expansions", [])]
            if not any(target in e for e in item_exps):
                continue

        if cat in by_category:
            by_category[cat].append(item)

    print(f"Successfully parsed {total_parsed} items.")
    if expansion_filter:
        print(f"Filtered records to expansion matching '{expansion_filter}'")

    return by_category


def save_dataset(by_category: Dict[str, List[Dict[str, Any]]], output_dir: str) -> None:
    """Saves the categorized records into master JSON and prints a summary."""
    os.makedirs(output_dir, exist_ok=True)
    all_path = os.path.join(output_dir, "aeons_end_all.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(by_category, f, indent=2, ensure_ascii=False)
    print(f"\nSaved master JSON: {all_path}\n")

    print("=== Scraping Summary ===")
    total_saved = 0
    for cat, items in by_category.items():
        print(f"  {cat:18}: {len(items)} items")
        total_saved += len(items)
    print(f"\nTotal Items Saved: {total_saved}")
    print("Scraping complete!")


def scrape(args: argparse.Namespace) -> None:
    """Main scraping orchestrator."""
    print("=== Starting Aeon's End Wiki Scrape ===")
    print(f"Target: {API_URL}")
    print(f"Output Directory: {args.output_dir}\n")

    cache_dir = os.path.join(args.output_dir, ".cache")
    all_pages_data = collect_or_load_pages(args, cache_dir)
    if not all_pages_data:
        return

    by_category = parse_and_group(all_pages_data, expansion_filter=args.expansion)
    save_dataset(by_category, args.output_dir)


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
