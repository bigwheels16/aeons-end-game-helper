#!/usr/bin/env python3
"""
Aeon's End Wiki Scraper
Scrapes gems, relics, spells, mages, unique starters, nemeses, and nemesis cards
for each game and expansion from https://aeonsend.wiki.gg using the MediaWiki API.
HTML fields are sanitized with nh3 (allowlisted tags/attributes, wiki-hosted images only).
Each record lists the wiki file names of its card or mat images in "images".
With --download-images, those images and the images inside the records' HTML fields are
downloaded one at a time into <output-dir>/images/, skipping unchanged files.

Requires: pip install --only-binary :all: -r scripts/requirements.txt

Usage:
  python scrape_aeons_end.py
  python scrape_aeons_end.py --output-dir ./data/scraped
  python scrape_aeons_end.py --expansion "The Depths"
  python scrape_aeons_end.py --download-images
  docker run --rm -v ${PWD}:/app -w /app python:3 sh -c "pip install --only-binary :all: -r scripts/requirements.txt && python scripts/scrape_aeons_end.py"
"""

import os
import sys
import json
import time
import re
import argparse
import hashlib
import http.client
import unicodedata
import urllib.error
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from typing import Dict, List, Any, Optional, Set, Tuple

import nh3

API_URL = "https://aeonsend.wiki.gg/api.php"
DEFAULT_USER_AGENT = "AeonsEndWikiScraper/1.0"
OUTPUT_FILENAME = "aeons_end_all.json"
IMAGES_DIRNAME = "images"
IMAGE_MANIFEST_FILENAME = "images.json"

HTTP_TIMEOUT = 30
# Throttling and server errors are retried with a doubling backoff; any other HTTP error aborts at once.
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_RETRIES = 4
RETRY_BASE_DELAY = 15.0
# A longer Retry-After aborts the run instead of waiting.
MAX_RETRY_AFTER = 600.0
API_TITLES_PER_QUERY = 50

# Output collection -> id kind prefix. Every record in these collections gets id "<kind>:<slug>".
ID_KIND_BY_CATEGORY: Dict[str, str] = {
    "supply": "supply",
    "unique_starters": "starter",
    "mages": "mage",
    "nemeses": "nemesis",
    "nemesis_cards": "nemesis-card",
}
# Apostrophe variants removed (not hyphenated) so "Transmuter's Lens" -> "transmuters-lens".
APOSTROPHES = frozenset("'\u2019\u2018\u02bc`")

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


ALLOWED_HTML_TAGS = frozenset({"b", "i", "small", "span", "br", "hr", "img"})
ALLOWED_HTML_ATTRIBUTES = {"span": {"class"}, "img": {"src", "alt", "width", "loading"}}
WIKI_IMAGE_PREFIX = "https://aeonsend.wiki.gg/images/"
WIKI_IMAGE_SRC = re.compile(re.escape(WIKI_IMAGE_PREFIX) + r"[A-Za-z0-9._~%-]*[A-Za-z0-9][A-Za-z0-9._~%-]*")
IMG_WIDTH = re.compile(r"[0-9]{1,4}")

# Output collection -> fields that hold HTML. Every other string field is plain text.
HTML_FIELDS: Dict[str, Tuple[str, ...]] = {
    "supply": ("effect",),
    "unique_starters": ("effect",),
    "mages": ("ability_effect", "additional_rules", "starting_hand", "starting_deck"),
    "nemeses": ("unleash", "increased_difficulty", "rules", "setup"),
    "nemesis_cards": ("effect",),
}

# Output collection -> wiki template and its (image parameter, default file name suffix) pairs.
RECORD_IMAGES: Dict[str, Tuple[str, Tuple[Tuple[str, str], ...]]] = {
    "supply": ("PlayerCard", (("image", ""),)),
    "unique_starters": ("PlayerCard", (("image", ""),)),
    "mages": ("Mage", (("image_front", " Front"), ("image_back", " Back"))),
    "nemeses": ("Nemesis", (("image_front", " Front"), ("image_back", " Back"))),
    "nemesis_cards": ("NemesisCard", (("image", ""),)),
}
# Characters a MediaWiki title can't hold; such image names are reported missing without a lookup.
INVALID_TITLE_CHARS = re.compile(r"[#<>\[\]|{}\x00-\x1f\x7f]")
# Characters that can't appear in a local file name on Linux or Windows.
UNSAFE_FILE_NAME_CHARS = re.compile(r'[\x00-\x1f\x7f/\\:*?"<>|]')


class HttpError(Exception):
    """An HTTP request failed, after retries where the failure allows them."""


def img_src_rejection_reason(src: str) -> Optional[str]:
    """Returns why an <img> src is not allowed, or None for a single file under WIKI_IMAGE_PREFIX."""
    if not WIKI_IMAGE_SRC.fullmatch(src):
        return f"not a single path segment under {WIKI_IMAGE_PREFIX}"
    segment = urllib.parse.unquote(src[len(WIKI_IMAGE_PREFIX):])
    if segment in (".", "..") or "/" in segment or "\\" in segment:
        return "file name decodes to a dot segment or contains a path separator"
    return None


def _html_attribute_filter(tag: str, attr: str, value: str) -> Optional[str]:
    """Per-value allowlist. nh3 calls it for every allowed attribute; None removes the attribute."""
    if tag == "span" and attr == "class":
        return value if value == "aether" else None
    if tag == "img":
        if attr == "src":
            return value if img_src_rejection_reason(value) is None else None
        if attr == "width":
            return value if IMG_WIDTH.fullmatch(value) else None
        if attr == "loading":
            return value if value == "lazy" else None
        if attr == "alt":
            return value
    return None


def sanitize_html(html: str) -> str:
    """Reduces HTML to the allowed tags and attributes (nh3). Script/style elements lose their content."""
    return nh3.clean(
        html,
        tags=set(ALLOWED_HTML_TAGS),
        attributes=ALLOWED_HTML_ATTRIBUTES,
        attribute_filter=_html_attribute_filter,
        url_schemes={"https"},
        link_rel=None,
        strip_comments=True,
    )


class _ImgSrcCollector(HTMLParser):
    """Collects the (entity-decoded) src of every <img> start tag and counts <img> tags without a src."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.srcs: List[str] = []
        self.imgs_without_src = 0

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if tag == "img":
            srcs = [value for name, value in attrs if name == "src" and value is not None]
            self.srcs.extend(srcs)
            if not srcs:
                self.imgs_without_src += 1


def scan_imgs(html: str) -> _ImgSrcCollector:
    collector = _ImgSrcCollector()
    collector.feed(html)
    collector.close()
    return collector


def sanitize_record(category: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitizes the record's HTML fields (HTML_FIELDS) and prints one line per rejected <img> src.
    nh3 leaves an <img> whose src is rejected with no src. The pre-scan (html.parser) can parse
    differently from nh3, so any <img> left without a src beyond those logged gets a fallback line.
    """
    html_fields = HTML_FIELDS.get(category, ())
    sanitized = dict(record)
    for field in html_fields:
        value = record.get(field)
        if not isinstance(value, str):
            continue
        context = (
            f"collection={ascii(category)} id={ascii(record.get('id'))} "
            f"name={ascii(record.get('name'))} field={ascii(field)}"
        )
        logged = 0
        for src in scan_imgs(value).srcs:
            reason = img_src_rejection_reason(src)
            if reason is not None:
                logged += 1
                print(f"Rejected img src: {context} src={ascii(src)} reason={ascii(reason)}")
        sanitized[field] = sanitize_html(value)
        unlogged = scan_imgs(sanitized[field]).imgs_without_src - logged
        if unlogged > 0:
            print(
                f"Rejected img src: {context} unlogged_count={unlogged} value={ascii(value)} "
                f"reason={ascii('img src removed by sanitizer, not found by pre-scan')}"
            )
    return sanitized


def clean_wikitext(text: Optional[str]) -> str:
    """
    Converts MediaWiki markup into readable text with simple HTML. The output is not sanitized;
    HTML fields go through sanitize_html afterwards.
    """
    if not text:
        return ""
    text = re.sub(r"</?nowiki\s*>", "", text, flags=re.IGNORECASE)
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
        return f'<img src="https://aeonsend.wiki.gg/images/{encoded_file}" alt="{alt}" width="{width}" loading="lazy"/>'

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
    # Normalize lines and join with <br/>
    lines = [l.strip() for l in text.splitlines()]
    return "<br/>".join(l for l in lines if l).strip()


def _is_word_char(ch: str) -> bool:
    """Word characters for slugs: letters (L*), numbers (N*) and combining marks (M*) of any script."""
    return unicodedata.category(ch)[0] in ("L", "N", "M")


def slugify(name: str) -> str:
    """
    Builds the Unicode slug part of a record id from its display name:
      1. NFC; 2. lower() then NFC again; 3. remove apostrophes;
      4./5. every run of non-word characters (anything not L*/M*/N*) becomes one '-';
      final NFC; strip leading/trailing '-'.
    Raises ValueError if the slug is empty or has no letter/number. Messages use ascii().
    """
    text = unicodedata.normalize("NFC", name)
    text = unicodedata.normalize("NFC", text.lower())
    text = "".join(ch for ch in text if ch not in APOSTROPHES)

    out: List[str] = []
    in_separator = False
    for ch in text:
        if _is_word_char(ch):
            out.append(ch)
            in_separator = False
        elif not in_separator:
            out.append("-")
            in_separator = True
    slug = unicodedata.normalize("NFC", "".join(out)).strip("-")

    if not slug:
        raise ValueError(f"Empty id slug for name {ascii(name)}")
    if not any(unicodedata.category(ch)[0] in ("L", "N") for ch in slug):
        raise ValueError(f"Id slug has no letter or number for name {ascii(name)}")
    return slug


def make_item_id(category: str, name: str) -> str:
    """Returns the record id "<kind>:<slug>" for an output collection. Raises ValueError."""
    return f"{ID_KIND_BY_CATEGORY[category]}:{slugify(name)}"


def validate_ids(by_category: Dict[str, List[Dict[str, Any]]]) -> None:
    """
    Checks that ids are globally unique across all collections.
    Raises ValueError listing ALL duplicates (with the names that produced them).
    """
    names_by_id: Dict[str, List[str]] = {}
    for category, items in by_category.items():
        for item in items:
            names_by_id.setdefault(item["id"], []).append(f"{category}/{item.get('name')}")

    duplicates = {i: names for i, names in names_by_id.items() if len(names) > 1}
    if duplicates:
        details = "; ".join(
            f"{ascii(i)} <- {', '.join(ascii(n) for n in names)}" for i, names in sorted(duplicates.items())
        )
        raise ValueError(f"Duplicate ids ({len(duplicates)}): {details}")


def get_clean(params: Dict[str, str], key: str, default: str = "") -> str:
    """Retrieves and cleans wikitext for a given parameter key."""
    val = params.get(key)
    return clean_wikitext(val) if val is not None else default


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
        f for f in sorted(os.listdir(cache_dir))
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
    """Atomically saves an individual page into a dedicated JSON file in the cache directory."""
    os.makedirs(cache_dir, exist_ok=True)
    raw_page_id = str(page_data.get("pageid", ""))
    if not raw_page_id.isdigit():
        raw_page_id = re.sub(r"[^\w\-]+", "_", str(page_data.get("title", "unknown"))).lower()

    target_path = os.path.join(cache_dir, f"page_{raw_page_id}.json")
    tmp_path = f"{target_path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(page_data, f, ensure_ascii=False)
    os.replace(tmp_path, target_path)
    return target_path


def http_get(url: str, user_agent: str) -> Tuple[bytes, str]:
    """
    GETs a URL and returns the body and content type. RETRY_STATUSES and network errors are retried
    up to MAX_RETRIES times, waiting the server's Retry-After seconds or a doubling backoff; other
    HTTP errors raise HttpError at once.
    """
    attempt = 0
    while True:
        retry_after = ""
        try:
            req = urllib.request.Request(url, headers={"User-Agent": user_agent})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                return resp.read(), resp.headers.get_content_type()
        except urllib.error.HTTPError as e:
            failure = f"HTTP {e.code} from {url}"
            if e.code == 403:
                raise HttpError(f"{failure}; the wiki may be blocking this client, wait before running again") from e
            if e.code not in RETRY_STATUSES:
                raise HttpError(failure) from e
            retry_after = (e.headers.get("Retry-After") or "").strip()
        except (OSError, http.client.HTTPException) as e:
            failure = f"{type(e).__name__} ({e}) from {url}"

        if attempt == MAX_RETRIES:
            raise HttpError(f"{failure}, after {MAX_RETRIES} retries; wait before running again")
        wait = float(retry_after) if retry_after.isdigit() else RETRY_BASE_DELAY * 2 ** attempt
        if wait > MAX_RETRY_AFTER:
            raise HttpError(f"{failure}; the server asked to wait {wait:.0f}s, wait before running again")
        attempt += 1
        print(f"  {failure}; retry {attempt}/{MAX_RETRIES} in {wait:.0f}s")
        time.sleep(wait)


def api_get(params: Dict[str, Any], user_agent: str) -> Dict[str, Any]:
    """Performs an HTTP GET request to the MediaWiki API (retried as in http_get)."""
    params["format"] = "json"
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    body, _ = http_get(url, user_agent)
    return json.loads(body.decode("utf-8"))


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
    expansions = extract_expansions(params, page_data["categories"])

    item: Dict[str, Any] = {
        "name": title,
        "type": card_type,
        "cost": cost,
        "effect": rules,
        "expansions": expansions,
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


def parse_mage_additional_rules(params: Dict[str, str], wikitext: str) -> str:
    """
    Extracts a mage's additional rules, or "" if the mage has none.
    Prefers the Mage template's Rules parameter (the mat's Additional Rules), and falls back to
    the page's ==Rules== (or ==Setup Rules==) section when the template has none.
    """
    template_rules = params.get("rules", "").strip()
    if template_rules:
        return clean_wikitext(template_rules)

    section_match = re.search(
        r"^==\s*(?:Setup\s+)?Rules\s*==\s*$(.*?)(?=^==[^=]|\Z)",
        wikitext,
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    if section_match:
        return clean_wikitext(section_match.group(1))
    return ""


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
        "complexity": get_clean(params, "complexity"),
        "ability_name": get_clean(params, "name"),
        "ability_activation": clean_wikitext(activation),
        "ability_effect": clean_wikitext(effect_body),
        "unique_cards": unique_cards,
        "starting_hand": get_clean(params, "starting hand"),
        "starting_deck": get_clean(params, "starting deck"),
        "breaches": parse_mage_breaches(params, wikitext),
        "additional_rules": parse_mage_additional_rules(params, wikitext),
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
        "expansions": extract_expansions(params, page_data["categories"]),
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


def wiki_file_name(name: str) -> str:
    """
    Returns a wiki file name in its URL form: runs of spaces and underscores become one underscore,
    the ends are trimmed and the first letter is upper case.
    """
    name = re.sub(r"[ _]+", "_", name).strip("_")
    return name[:1].upper() + name[1:]


def record_image_names(category: str, page_data: Dict[str, Any]) -> List[str]:
    """
    Wiki file names of a record's card or mat images, built the way the wiki templates build them:
    the template's image parameter (percent-decoded), or else the page name plus the suffix, then
    ".jpg". The page name loses its colons, except in the Mage template.
    """
    template, images = RECORD_IMAGES[category]
    params = parse_template(page_data["wikitext"], template) or {}
    page_name = page_data["title"] if template == "Mage" else page_data["title"].replace(":", "")
    names: List[str] = []
    for param, suffix in images:
        override = urllib.parse.unquote(params.get(param, "").strip())
        names.append(wiki_file_name(f"{override or page_name + suffix}.jpg"))
    return names


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
            # Generated id is the first key; it replaces the wiki's printed card number.
            record = {"id": make_item_id(cat, item["name"]), **item, "images": record_image_names(cat, page_data)}
            by_category[cat].append(sanitize_record(cat, record))

    print(f"Successfully parsed {total_parsed} items.")
    if expansion_filter:
        print(f"Filtered records to expansion matching '{expansion_filter}'")

    return by_category


def save_dataset(by_category: Dict[str, List[Dict[str, Any]]], output_dir: str) -> None:
    """Saves the categorized records into master JSON and prints a summary."""
    os.makedirs(output_dir, exist_ok=True)
    all_path = os.path.join(output_dir, OUTPUT_FILENAME)
    tmp_path = f"{all_path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(by_category, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, all_path)
    print(f"\nSaved master JSON: {all_path}\n")

    print("=== Scraping Summary ===")
    total_saved = 0
    for cat, items in by_category.items():
        print(f"  {cat:18}: {len(items)} items")
        total_saved += len(items)
    print(f"\nTotal Items Saved: {total_saved}")
    print("Scraping complete!")


def write_file_atomically(path: str, data: bytes) -> None:
    """Writes data through a temporary file, so an existing file is only ever replaced whole."""
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "wb") as f:
        f.write(data)
    os.replace(tmp_path, path)


def file_sha1(path: str) -> Optional[str]:
    """Returns the hex sha1 of a file, or None if it doesn't exist."""
    try:
        with open(path, "rb") as f:
            return hashlib.sha1(f.read()).hexdigest()
    except FileNotFoundError:
        return None


def collect_image_names(by_category: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[str]]:
    """Returns image file name -> ids of the records that show it, as a card/mat image or in an HTML field."""
    used_by: Dict[str, List[str]] = {}
    for category, records in by_category.items():
        for record in records:
            srcs = [
                src
                for field in HTML_FIELDS[category]
                if isinstance(record.get(field), str)
                for src in scan_imgs(record[field]).srcs
            ]
            inline = {urllib.parse.unquote(src[len(WIKI_IMAGE_PREFIX):]) for src in srcs if src.startswith(WIKI_IMAGE_PREFIX)}
            for name in sorted(inline.union(record["images"])):
                used_by.setdefault(name, []).append(record["id"])
    return used_by


def fetch_image_info(names: List[str], user_agent: str, delay: float) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Looks up wiki files by name, API_TITLES_PER_QUERY per request and following redirects. Maps each
    name to the file's title, url, size and sha1, or to None when the wiki has no such file.
    """
    info_by_name: Dict[str, Optional[Dict[str, Any]]] = {}
    for i in range(0, len(names), API_TITLES_PER_QUERY):
        if i:
            time.sleep(delay)
        batch = names[i : i + API_TITLES_PER_QUERY]
        data = api_get(
            {
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "url|size|sha1",
                "redirects": 1,
                "titles": "|".join(f"File:{name}" for name in batch),
            },
            user_agent,
        )
        if "error" in data or "continue" in data:
            raise ValueError(f"Unexpected imageinfo response: {ascii(data.get('error') or data.get('continue'))}")
        query = data.get("query", {})
        renames = {entry["from"]: entry["to"] for entry in query.get("normalized", []) + query.get("redirects", [])}
        pages = {page["title"]: page for page in query.get("pages", {}).values()}
        for name in batch:
            title = f"File:{name}"
            seen: Set[str] = set()
            while title in renames and title not in seen:
                seen.add(title)
                title = renames[title]
            page = pages.get(title, {})
            info = page.get("imageinfo")
            info_by_name[name] = {"title": page["title"], **info[0]} if info else None
    return info_by_name


def image_url_rejection_reason(url: str, file_name: str) -> Optional[str]:
    """Returns why an image URL is not allowed, or None for WIKI_IMAGE_PREFIX + file_name (any query)."""
    parts = urllib.parse.urlsplit(url)
    allowed = urllib.parse.urlsplit(WIKI_IMAGE_PREFIX)
    if (parts.scheme, parts.netloc) != (allowed.scheme, allowed.netloc):
        return f"not on {allowed.scheme}://{allowed.netloc}"
    if urllib.parse.unquote(parts.path) != allowed.path + file_name:
        return f"not the path {allowed.path}{file_name}"
    return None


def load_image_manifest(path: str) -> Dict[str, str]:
    """Returns images.json (file name -> wiki sha1 of the version on disk), or {} if there is none."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            files = json.load(f)
        return {str(file_name): str(sha1) for file_name, sha1 in files.items()}
    except FileNotFoundError:
        return {}
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Can't read {path} ({e!r}); delete it to download every image again") from e


def download_images(by_category: Dict[str, List[Dict[str, Any]]], args: argparse.Namespace) -> None:
    """
    Downloads the records' card and mat images, and the images in their HTML fields, into
    <output-dir>/images/ under the names the records use, one request at a time, waiting
    args.image_delay seconds after each download. images.json maps each file name to the wiki sha1 of
    the version on disk and is saved even when the downloads stop early; a file is only requested
    again when the wiki's sha1 changes. The wiki's CDN may re-encode images, so a download only has
    to be a non-empty image. Images the wiki doesn't have, or whose name is unsafe as a local file
    name, are listed and skipped.
    """
    images_dir = os.path.join(args.output_dir, IMAGES_DIRNAME)
    manifest_path = os.path.join(images_dir, IMAGE_MANIFEST_FILENAME)
    used_by = collect_image_names(by_category)
    names = sorted(used_by)

    print(f"\nLooking up {len(names)} images on the wiki...")
    info_by_name = fetch_image_info(
        [name for name in names if not INVALID_TITLE_CHARS.search(name)], args.user_agent, args.delay
    )

    info_by_file: Dict[str, Dict[str, Any]] = {}
    skipped = 0
    for name in names:
        context = f"file={ascii(name)} used_by={ascii(', '.join(used_by[name]))}"
        info = info_by_name.get(name)
        if info is None:
            skipped += 1
            print(f"Missing image: {context}")
            continue
        if UNSAFE_FILE_NAME_CHARS.search(name) or name.endswith("."):
            skipped += 1
            print(f"Skipped image: {context} reason='unsafe local file name'")
            continue
        wiki_name = info["title"].split(":", 1)[1].replace(" ", "_")
        reason = image_url_rejection_reason(info["url"], wiki_name)
        if reason is not None:
            raise ValueError(f"Image URL {ascii(info['url'])} for {context} is {reason}")
        if wiki_name != name:
            # The wiki serves the file only under its own name, so a link to this name doesn't load.
            print(f"Renamed image: {context} wiki_file={ascii(wiki_name)}")
        info_by_file[name] = info

    os.makedirs(images_dir, exist_ok=True)
    known_sha1 = {
        file_name: sha1
        for file_name, sha1 in load_image_manifest(manifest_path).items()
        if os.path.isfile(os.path.join(images_dir, file_name))
    }
    # Files missing from images.json still count as current when they are byte-identical to the wiki's.
    for file_name, info in info_by_file.items():
        if known_sha1.get(file_name) != info["sha1"] and file_sha1(os.path.join(images_dir, file_name)) == info["sha1"]:
            known_sha1[file_name] = info["sha1"]
    to_download = sorted(f for f, info in info_by_file.items() if known_sha1.get(f) != info["sha1"])
    print(
        f"Images found: {len(info_by_file)} | Up to date: {len(info_by_file) - len(to_download)} | "
        f"To download: {len(to_download)} (about {sum(info_by_file[f]['size'] for f in to_download) / 1e6:.1f} MB) | "
        f"Missing or skipped: {skipped}"
    )

    downloaded_bytes = 0
    reencoded = 0
    try:
        for n, file_name in enumerate(to_download, 1):
            info = info_by_file[file_name]
            body, content_type = http_get(info["url"], args.user_agent)
            if not body or not content_type.startswith("image/"):
                raise ValueError(
                    f"Download of {ascii(info['url'])} is not an image ({ascii(content_type)}, {len(body)} bytes)"
                )
            write_file_atomically(os.path.join(images_dir, file_name), body)
            known_sha1[file_name] = info["sha1"]
            downloaded_bytes += len(body)
            if hashlib.sha1(body).hexdigest() != info["sha1"]:
                reencoded += 1
            print(f"  [{n}/{len(to_download)}] {ascii(file_name)} ({len(body) // 1024} KB)")
            time.sleep(args.image_delay)
    except KeyboardInterrupt:
        print("\n\nImage download interrupted by user (Ctrl+C).")
        print(f"Downloaded images are kept in {images_dir}/; re-run with --download-images to fetch the rest.")
        sys.exit(130)
    finally:
        manifest = json.dumps(dict(sorted(known_sha1.items())), indent=2, ensure_ascii=False)
        write_file_atomically(manifest_path, manifest.encode("utf-8"))

    print("\n=== Image Summary ===")
    print(f"  Downloaded        : {len(to_download)} ({downloaded_bytes / 1e6:.1f} MB, {reencoded} re-encoded by the wiki's CDN)")
    print(f"  Already up to date: {len(info_by_file) - len(to_download)}")
    print(f"  Missing or skipped: {skipped}{' (listed above)' if skipped else ''}")
    print(f"Images saved in {images_dir}/")


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
    validate_ids(by_category)
    save_dataset(by_category, args.output_dir)
    if args.download_images:
        download_images(by_category, args)


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
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="Also download card, mat and rules-text images into <output-dir>/images/; unchanged images are skipped",
    )
    parser.add_argument(
        "--image-delay",
        type=float,
        default=1.0,
        help="Delay in seconds after each image download, to stay under the wiki's rate limits",
    )

    args = parser.parse_args()
    if args.download_images and args.cache_only:
        parser.error("--download-images needs network access and can't be combined with --cache-only")
    try:
        scrape(args)
    except (ValueError, HttpError) as e:
        # Validation, URL allowlist or HTTP failure: exit 1 with the message.
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()
