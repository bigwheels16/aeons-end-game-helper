"""
Unit tests for the HTML sanitizer, id generation, id validation, page-URL allowlist, atomic save
and the committed dataset in scrape_aeons_end.py. Standard library plus nh3; no network access.

Run from the repo root:
  pip install --only-binary :all: -r scripts/requirements.txt
  python3 -m unittest discover -s scripts -p "test_*.py"
"""

import io
import json
import os
import re
import sys
import tempfile
import unicodedata
import unittest
from contextlib import redirect_stdout
from html.parser import HTMLParser
from unittest import mock

import scrape_aeons_end as scraper


def _page(pageid, title, wikitext, categories=None):
    return {"pageid": pageid, "title": title, "wikitext": wikitext, "categories": categories or []}


SYNTHETIC_PAGES = {
    "Foo Gem": _page(1, "Foo Gem", "{{PlayerCard|type=Gem|cost=3|id=AB33|rules=Gain 1 {{Cost}}.|box=The Depths}}"),
    "X": _page(2, "X", "{{PlayerCard|type=Spell|cost=0|unique to=X|id 1=AB34|rules=Deal 1 damage.}}"),
    "X (Mage)": _page(3, "X (Mage)", "{{Mage|title=Breach Mage|unique cards={{Card|X}}|box=The Depths}}"),
    "Big Bad": _page(4, "Big Bad", "{{Nemesis|life=70|difficulty level=5|box=The Depths}}"),
    "Bad Minion": _page(5, "Bad Minion", "{{NemesisCard|type=Minion|tier=1|life=5|id=ND12|nemesis=Big Bad|effect=Hit.}}"),
}


DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "scraped", "aeons_end_all.json")
EXPECTED_COUNTS = {"supply": 427, "unique_starters": 239, "mages": 104, "nemeses": 73, "nemesis_cards": 1276}
WIKI_IMG = "https://aeonsend.wiki.gg/images/"
UNSAFE_MARKUP = re.compile(r"on\w+=|javascript:|style=|<a\b|<script|<svg|<math", re.IGNORECASE)


def _parse(pages):
    with redirect_stdout(io.StringIO()):
        return scraper.parse_and_group(pages)


class _TagCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, attrs))

    def handle_startendtag(self, tag, attrs):
        self.tags.append((tag, attrs))


def _tags(html):
    collector = _TagCollector()
    collector.feed(html)
    collector.close()
    return collector.tags


def _string_values(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for entry in value:
            yield from _string_values(entry)
    elif isinstance(value, dict):
        for entry in value.values():
            yield from _string_values(entry)


class SlugifyTests(unittest.TestCase):
    CASES = [
        ("supply", "All-out Barrage", "supply:all-out-barrage"),
        ("supply", "Transmuter's Lens", "supply:transmuters-lens"),
        ("supply", "Transmuter’s Lens", "supply:transmuters-lens"),
        ("supply", "Smite (Spell)", "supply:smite-spell"),
        ("unique_starters", "Zanite, Perfected", "starter:zanite-perfected"),
        ("mages", "Taqren (Outcasts)", "mage:taqren-outcasts"),
        ("unique_starters", "Rip, Eat!", "starter:rip-eat"),
        ("unique_starters", "Invention: Meteor Strike", "starter:invention-meteor-strike"),
        ("nemeses", "Prince of Gluttons", "nemesis:prince-of-gluttons"),
        ("nemesis_cards", "Bladius (Maelstrom: Risen Minion)", "nemesis-card:bladius-maelstrom-risen-minion"),
        ("nemesis_cards", "World Devourer (Tier 9+)", "nemesis-card:world-devourer-tier-9"),
        ("supply", "  A -- (B)  ", "supply:a-b"),
        ("supply", "Æther", "supply:æther"),
        ("supply", "Café", "supply:café"),
        ("supply", "Café", "supply:café"),
        ("supply", "Straße", "supply:straße"),
        ("supply", "火 Bolt", "supply:火-bolt"),
        ("supply", "İron", "supply:i̇ron"),
        ("supply", "A‮B", "supply:a-b"),
        ("supply", "A‍B", "supply:a-b"),
        ("supply", "A\u0000B\u001bC", "supply:a-b-c"),
        ("supply", "e'́x", "supply:éx"),
    ]

    def test_examples(self):
        for category, name, expected in self.CASES:
            with self.subTest(name=ascii(name)):
                self.assertEqual(scraper.make_item_id(category, name), expected)

    def test_ids_are_nfc(self):
        for category, name, _ in self.CASES:
            item_id = scraper.make_item_id(category, name)
            self.assertTrue(unicodedata.is_normalized("NFC", item_id), ascii(item_id))

    def test_empty_slug_raises_and_names_input(self):
        for name in ["!!!", "", "''", " - "]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError) as ctx:
                    scraper.slugify(name)
                self.assertIn(ascii(name), str(ctx.exception))

    def test_mark_only_slug_raises(self):
        with self.assertRaises(ValueError):
            scraper.slugify("́̂")

    def test_error_messages_escape_control_characters(self):
        name = "‮​!!"
        with self.assertRaises(ValueError) as ctx:
            scraper.slugify(name)
        message = str(ctx.exception)
        self.assertTrue(message.isascii())
        self.assertNotIn("‮", message)

    def test_too_long_id_raises(self):
        with self.assertRaises(ValueError) as ctx:
            scraper.make_item_id("supply", "a" * 200)
        self.assertIn("UTF-16", str(ctx.exception))
        # 193 + len("supply:") == 200 is the maximum allowed.
        self.assertEqual(len(scraper.make_item_id("supply", "a" * 193)), 200)

    def test_length_counts_utf16_units(self):
        # U+1F600 is one code point but two UTF-16 units; letters around it keep the slug valid.
        self.assertEqual(scraper.utf16_length("a\U0001F600"), 3)
        with self.assertRaises(ValueError):
            scraper.make_item_id("supply", "\U00010400" * 97)  # 7 + 2*97 = 201 units (Deseret letters)


class MakeItemIdTests(unittest.TestCase):
    def test_prefix_per_category(self):
        expected = {
            "supply": "supply:jade",
            "unique_starters": "starter:jade",
            "mages": "mage:jade",
            "nemeses": "nemesis:jade",
            "nemesis_cards": "nemesis-card:jade",
        }
        for category, item_id in expected.items():
            with self.subTest(category=category):
                self.assertEqual(scraper.make_item_id(category, "Jade"), item_id)

    def test_unknown_category_raises(self):
        for category in ["other_player_cards", "", "Supply"]:
            with self.subTest(category=category):
                with self.assertRaises(ValueError):
                    scraper.make_item_id(category, "Jade")

    def test_shape_check_uses_full_match(self):
        for bad in ["supply:x\n", "supply:x-", "supply:-x", "supply:a--b", "card:x", "supply:", "supply", "supply:a b"]:
            with self.subTest(bad=ascii(bad)):
                with self.assertRaises(ValueError):
                    scraper.check_id_shape(bad)


class ParseAndGroupTests(unittest.TestCase):
    def test_records_get_new_id_first_and_no_card_number(self):
        by_category = _parse(SYNTHETIC_PAGES)
        self.assertEqual(by_category["supply"][0]["id"], "supply:foo-gem")
        self.assertEqual(by_category["unique_starters"][0]["id"], "starter:x")
        self.assertEqual(by_category["mages"][0]["id"], "mage:x-mage")
        self.assertEqual(by_category["nemeses"][0]["id"], "nemesis:big-bad")
        self.assertEqual(by_category["nemesis_cards"][0]["id"], "nemesis-card:bad-minion")
        for items in by_category.values():
            for item in items:
                self.assertEqual(next(iter(item)), "id")
                self.assertNotIn("card_number", item)
                self.assertNotIn("page_id", item)
        dumped = json.dumps(by_category)
        for number in ["AB33", "AB34", "ND12"]:
            self.assertNotIn(number, dumped)

    def test_same_name_in_different_collections_is_not_a_duplicate(self):
        pages = {
            "X": SYNTHETIC_PAGES["X"],
            # Dict key = parsed title; trailing space is stripped by slugify, so both slugs are "x".
            "X ": _page(6, "X ", "{{Mage|title=Mage X}}"),
        }
        by_category = _parse(pages)
        self.assertEqual(by_category["unique_starters"][0]["id"], "starter:x")
        self.assertEqual(by_category["mages"][0]["id"], "mage:x")
        scraper.validate_ids(by_category)  # must not raise


class SanitizeHtmlTests(unittest.TestCase):
    ALLOWED = '<b>a</b><br><i>b</i><hr><b><small>OR</small></b><span class="aether">Æ</span>'
    RAGEBORNE = (
        '<img src="https://aeonsend.wiki.gg/images/Fury_token.png" alt="Fury token" width="50" '
        'style="display: block; margin: 0.5rem auto; max-width: 100%; height: auto;" loading="lazy"/>'
    )

    def test_allowed_markup_round_trips(self):
        self.assertEqual(scraper.sanitize_html(self.ALLOWED), self.ALLOWED)

    def test_spellings_are_canonicalized(self):
        self.assertEqual(
            scraper.sanitize_html('<br/><hr/><span class="aether">&AElig;</span>'),
            '<br><hr><span class="aether">Æ</span>',
        )

    def test_token_image_loses_style_and_keeps_the_rest(self):
        self.assertEqual(
            scraper.sanitize_html(self.RAGEBORNE),
            '<img src="https://aeonsend.wiki.gg/images/Fury_token.png" alt="Fury token" width="50" loading="lazy">',
        )

    def test_idempotent(self):
        for html in [self.ALLOWED, self.RAGEBORNE] + [sample for sample, _ in MaliciousHtmlTests.CASES]:
            with self.subTest(html=html):
                once = scraper.sanitize_html(html)
                self.assertEqual(scraper.sanitize_html(once), once)


class MaliciousHtmlTests(unittest.TestCase):
    CASES = [
        ('<a href="https://evil.com">x</a>', 'x'),
        ('<a href="javascript:alert(1)">x</a>', 'x'),
        ('<script>alert(1)</script>t', 't'),
        ('<style>b{color:red}</style>t', 't'),
        ('<svg onload="alert(1)"><circle/></svg>t', 't'),
        ('<math><mi>x</mi></math>t', 't'),
        ('<template><b>x</b></template>t', 't'),
        ('<!-- c -->t', 't'),
        ('<iframe src="https://evil.com">x</iframe>', 'x'),
        ('<form action="https://evil.com">x</form>', 'x'),
        ('<object data="x">x</object>', 'x'),
        ('<p>x</p>', 'x'),
        ('<div>x</div>', 'x'),
        ('<em>x</em>', 'x'),
        ('<strong>x</strong>', 'x'),
        ('<u>x</u>', 'x'),
        ('<textarea><b>x</b></textarea>', '&lt;b&gt;x&lt;/b&gt;'),
        ('<xmp><b>x</b></xmp>', '&lt;b&gt;x&lt;/b&gt;'),
        ('<plaintext><b>x</b>', '&lt;b&gt;x&lt;/b&gt;'),
        ('<noscript><img src=x onerror=alert(1)></noscript>t', '&lt;img src=x onerror=alert(1)&gt;t'),
        ('<svg><style><img src=x onerror=alert(1)></style></svg>t', '<img>t'),
        ('<b onclick="alert(1)">x</b>', '<b>x</b>'),
        ('<b style="color:red">x</b>', '<b>x</b>'),
        ('<b id="a" name="b">x</b>', '<b>x</b>'),
        ('<b data-x="1" aria-label="y">x</b>', '<b>x</b>'),
        ('<span class="aether modal">x</span>', '<span>x</span>'),
        ('<span class="AETHER">x</span>', '<span>x</span>'),
        ('<span constructor="x" __proto__="y">x</span>', '<span>x</span>'),
        (f'<img src="{WIKI_IMG}A.png" srcset="{WIKI_IMG}B.png 2x">', f'<img src="{WIKI_IMG}A.png">'),
        (f'<img src="{WIKI_IMG}A.png" width="100%">', f'<img src="{WIKI_IMG}A.png">'),
        (f'<img src="{WIKI_IMG}A.png" loading="eager">', f'<img src="{WIKI_IMG}A.png">'),
        ('<img src="x">', '<img>'),
        ('<img src="http://aeonsend.wiki.gg/images/A.png">', '<img>'),
        ('<img src="//aeonsend.wiki.gg/images/A.png">', '<img>'),
        ('<img src="data:image/png;base64,AAAA">', '<img>'),
        ('<img src="javascript:alert(1)">', '<img>'),
        ('<img src="https://aeonsend.wiki.gg.evil.com/images/A.png">', '<img>'),
        ('<img src="https://evil.com@aeonsend.wiki.gg/images/A.png">', '<img>'),
        ('<img src="https://aeonsend.wiki.gg:443/images/A.png">', '<img>'),
        (f'<img src="{WIKI_IMG}../A.png">', '<img>'),
        (f'<img src="{WIKI_IMG}..">', '<img>'),
        (f'<img src="{WIKI_IMG}a\\b.png">', '<img>'),
        ('<img src="https:\\\\aeonsend.wiki.gg\\images\\A.png">', '<img>'),
        (f'<img src=" {WIKI_IMG}A.png ">', '<img>'),
        (f'<img src="{WIKI_IMG}A.png?x=1">', '<img>'),
        (f'<img src="{WIKI_IMG}%2e%2e">', '<img>'),
        (f'<img src="{WIKI_IMG}.%2E">', '<img>'),
        (f'<img src="{WIKI_IMG}%2fx">', '<img>'),
        (f'<img src="{WIKI_IMG}%5Cx">', '<img>'),
        ('<img src="&#104;ttps://evil.com/A.png">', '<img>'),
        (
            f'<img src="{WIKI_IMG}A.png" alt="&quot;><script>alert(1)</script>">',
            f'<img src="{WIKI_IMG}A.png" alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
        ),
    ]

    def test_samples(self):
        for sample, expected in self.CASES:
            with self.subTest(sample=sample):
                out = scraper.sanitize_html(sample)
                self.assertEqual(out, expected)
                markup = "".join(re.findall(r"<[^>]*>", out))
                self.assertIsNone(UNSAFE_MARKUP.search(markup), out)
                for tag, attrs in _tags(out):
                    self.assertIn(tag, scraper.ALLOWED_HTML_TAGS)
                    for name, value in attrs:
                        self.assertIn(name, scraper.ALLOWED_HTML_ATTRIBUTES[tag])
                        if name == "src":
                            self.assertIsNone(scraper.img_src_rejection_reason(value), value)


class AttributeFilterTests(unittest.TestCase):
    def _filter(self, tag, attr, value):
        return scraper._html_attribute_filter(tag, attr, value)

    def test_span_class_is_exact(self):
        self.assertEqual(self._filter("span", "class", "aether"), "aether")
        for bad in ["AETHER", "aether ", "aether modal", ""]:
            with self.subTest(bad=bad):
                self.assertIsNone(self._filter("span", "class", bad))

    def test_img_width_digits_up_to_four(self):
        for ok in ["0", "50", "9999"]:
            with self.subTest(ok=ok):
                self.assertEqual(self._filter("img", "width", ok), ok)
        for bad in ["10000", "100%", "50px", "", " 50", "-1"]:
            with self.subTest(bad=bad):
                self.assertIsNone(self._filter("img", "width", bad))

    def test_img_loading_is_exact(self):
        self.assertEqual(self._filter("img", "loading", "lazy"), "lazy")
        for bad in ["eager", "LAZY", "lazy "]:
            with self.subTest(bad=bad):
                self.assertIsNone(self._filter("img", "loading", bad))

    def test_img_alt_is_kept(self):
        self.assertEqual(self._filter("img", "alt", 'a "b" <c>'), 'a "b" <c>')

    def test_img_src(self):
        for ok in [f"{WIKI_IMG}Fury_token.png", f"{WIKI_IMG}A%27s_%28x%29.png", f"{WIKI_IMG}.a", f"{WIKI_IMG}a~b-c"]:
            with self.subTest(ok=ok):
                self.assertEqual(self._filter("img", "src", ok), ok)
        for bad in [WIKI_IMG, f"{WIKI_IMG}.", f"{WIKI_IMG}..", f"{WIKI_IMG}%2e", f"{WIKI_IMG}%2E%2e",
                    f"{WIKI_IMG}a/b.png", f"{WIKI_IMG}a%2Fb.png", f"{WIKI_IMG}a%5cb.png", f"{WIKI_IMG}a#b",
                    f"{WIKI_IMG}a@b", f"{WIKI_IMG}a:b", "https://aeonsend.wiki.gg/wiki/A.png"]:
            with self.subTest(bad=bad):
                self.assertIsNone(self._filter("img", "src", bad))
                self.assertIsNotNone(scraper.img_src_rejection_reason(bad))

    def test_other_attributes_are_removed(self):
        for tag, attr in [("b", "class"), ("span", "style"), ("img", "style"), ("img", "onerror"), ("i", "title")]:
            with self.subTest(tag=tag, attr=attr):
                self.assertIsNone(self._filter(tag, attr, "x"))


class HtmlFieldsTests(unittest.TestCase):
    PAGES = {
        "Big Bad": _page(
            4, "Big Bad",
            "{{Nemesis|life=<nowiki>*</nowiki>|difficulty level=5|expedition battle=A & B"
            "|rules=<script>alert(1)</script>Keep <img src=https://evil.com/x> this"
            "|unleash=Gain [[File:Fury token.png|50px]]|box=The Depths}}",
        ),
        "X (Mage)": _page(3, "X (Mage)", "{{Mage|title=Fire & Ice|effect=Deal 1 <b onclick=x>damage</b>}}"),
    }

    def _parse_with_log(self, pages):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            by_category = scraper.parse_and_group(pages)
        return by_category, buffer.getvalue()

    def test_html_fields_are_sanitized(self):
        by_category, _ = self._parse_with_log(self.PAGES)
        nemesis = by_category["nemeses"][0]
        self.assertEqual(nemesis["rules"], "Keep <img> this")
        self.assertEqual(
            nemesis["unleash"],
            f'Gain <img src="{WIKI_IMG}Fury_token.png" alt="Fury token" width="50" loading="lazy">',
        )
        self.assertEqual(by_category["mages"][0]["ability_effect"], "Deal 1 <b>damage</b>")

    def test_plain_text_fields_are_not_escaped(self):
        by_category, _ = self._parse_with_log(self.PAGES)
        self.assertEqual(by_category["nemeses"][0]["expedition_battle"], "A & B")
        self.assertEqual(by_category["mages"][0]["title"], "Fire & Ice")

    def test_nowiki_is_stripped_from_plain_text(self):
        by_category, _ = self._parse_with_log(self.PAGES)
        self.assertEqual(by_category["nemeses"][0]["health"], "*")

    def test_rejected_img_src_is_logged_with_context(self):
        _, log = self._parse_with_log(self.PAGES)
        lines = [line for line in log.splitlines() if line.startswith("Rejected img src:")]
        self.assertEqual(len(lines), 1)
        for fragment in ["collection='nemeses'", "id='nemesis:big-bad'", "name='Big Bad'", "field='rules'",
                         "src='https://evil.com/x'", "reason="]:
            self.assertIn(fragment, lines[0])

    def test_scheme_rejected_by_nh3_is_logged_too(self):
        pages = {"Big Bad": _page(4, "Big Bad", '{{Nemesis|setup=<img src="javascript:alert(1)">}}')}
        by_category, log = self._parse_with_log(pages)
        self.assertEqual(by_category["nemeses"][0]["setup"], "<img>")
        self.assertIn("src='javascript:alert(1)'", log)

    def test_log_escapes_scraped_text(self):
        pages = {"A‮B\x1b[2J": _page(4, "A‮B\x1b[2J", '{{Nemesis|setup=<img src="x‮\x1b[31m">}}')}
        _, log = self._parse_with_log(pages)
        line = next(line for line in log.splitlines() if line.startswith("Rejected img src:"))
        self.assertTrue(line.isascii(), line)
        self.assertNotIn("\x1b", line)
        self.assertIn("\\u202e", line)
        self.assertIn("\\x1b", line)

    def test_img_src_parsed_differently_by_pre_scan_is_still_logged(self):
        cases = [
            ("<image src=x>", "<img>", "unlogged_count=1 value='<image src=x>'"),
            ("<img src=\x00x>", "<img>", "src='\\x00x'"),
        ]
        for setup, expected_html, expected_log in cases:
            with self.subTest(setup=setup):
                record = {"id": "nemesis:big-bad", "name": "Big Bad", "setup": setup}
                buffer = io.StringIO()
                with redirect_stdout(buffer):
                    sanitized = scraper.sanitize_record("nemeses", record)
                log = buffer.getvalue()
                self.assertEqual(sanitized["setup"], expected_html)
                lines = [line for line in log.splitlines() if line.startswith("Rejected img src:")]
                self.assertEqual(len(lines), 1, log)
                for fragment in ["collection='nemeses'", "id='nemesis:big-bad'", "name='Big Bad'",
                                 "field='setup'", expected_log, "reason="]:
                    self.assertIn(fragment, lines[0])

    def test_logged_rejection_gets_no_fallback_line(self):
        pages = {"Big Bad": _page(4, "Big Bad", '{{Nemesis|setup=<img src="javascript:alert(1)">}}')}
        _, log = self._parse_with_log(pages)
        self.assertNotIn("unlogged_count=", log)

    def test_valid_wiki_images_are_not_logged(self):
        _, log = self._parse_with_log({"Big Bad": self.PAGES["Big Bad"]})
        self.assertNotIn("Fury_token", log)


class ValidateIdsTests(unittest.TestCase):
    def _supply(self, *names):
        return {"supply": [{"id": scraper.make_item_id("supply", n), "name": n} for n in names]}

    def test_duplicates_raise_and_name_all(self):
        with self.assertRaises(ValueError) as ctx:
            scraper.validate_ids(self._supply("Foo Bar", "Foo-Bar", "Baz", "baz"))
        message = str(ctx.exception)
        for fragment in ["Foo Bar", "Foo-Bar", "supply:foo-bar", "Baz", "baz", "supply:baz"]:
            self.assertIn(fragment, message)
        self.assertIn("(2)", message)

    def test_nfc_variants_collide(self):
        with self.assertRaises(ValueError) as ctx:
            scraper.validate_ids(self._supply("Café", "Café"))
        self.assertIn(ascii("supply/Café"), str(ctx.exception))

    def test_aether_variants_do_not_collide(self):
        scraper.validate_ids(self._supply("Aether", "Æther"))

    def test_missing_or_malformed_id_raises(self):
        with self.assertRaises(ValueError):
            scraper.validate_ids({"supply": [{"name": "Jade"}]})
        with self.assertRaises(ValueError):
            scraper.validate_ids({"supply": [{"id": "supply:x\n", "name": "x"}]})


class MainExitTests(unittest.TestCase):
    def _write_cache(self, output_dir, pages):
        cache_dir = os.path.join(output_dir, ".cache")
        os.makedirs(cache_dir)
        for page in pages:
            with open(os.path.join(cache_dir, f"page_{page['pageid']}.json"), "w", encoding="utf-8") as f:
                json.dump(page, f)

    def _run_main(self, output_dir):
        argv = ["scrape_aeons_end.py", "--cache-only", "--output-dir", output_dir]
        with mock.patch.object(sys, "argv", argv), redirect_stdout(io.StringIO()):
            scraper.main()

    def test_duplicate_ids_exit_nonzero_and_leave_output_untouched(self):
        with tempfile.TemporaryDirectory() as output_dir:
            self._write_cache(output_dir, [
                _page(1, "Foo Bar", "{{PlayerCard|type=Gem|cost=3}}"),
                _page(2, "Foo-Bar", "{{PlayerCard|type=Gem|cost=4}}"),
            ])
            out_path = os.path.join(output_dir, "aeons_end_all.json")
            sentinel = b'{"sentinel": true}\n'
            with open(out_path, "wb") as f:
                f.write(sentinel)

            with self.assertRaises(SystemExit) as ctx:
                self._run_main(output_dir)
            self.assertNotEqual(ctx.exception.code, 0)
            self.assertNotEqual(ctx.exception.code, None)
            self.assertIn("Duplicate ids", str(ctx.exception.code))

            with open(out_path, "rb") as f:
                self.assertEqual(f.read(), sentinel)
            self.assertFalse(os.path.exists(out_path + ".tmp"))

    def test_valid_cache_writes_dataset_atomically(self):
        with tempfile.TemporaryDirectory() as output_dir:
            self._write_cache(output_dir, list(SYNTHETIC_PAGES.values()))
            out_path = os.path.join(output_dir, "aeons_end_all.json")
            # A stale temp file from an earlier crash is replaced, not reused.
            with open(out_path + ".tmp", "w", encoding="utf-8") as f:
                f.write("stale")
            self._run_main(output_dir)
            with open(out_path, encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data["supply"][0]["id"], "supply:foo-gem")
            self.assertFalse(os.path.exists(out_path + ".tmp"))


class LoadPageCacheTests(unittest.TestCase):
    def test_pages_load_in_sorted_file_name_order(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            names = ["page_3.json", "page_1.json", "page_2.json"]
            for name in names:
                with open(os.path.join(cache_dir, name), "w", encoding="utf-8") as f:
                    json.dump({"title": name}, f)
            with mock.patch.object(scraper.os, "listdir", return_value=names):
                pages = scraper.load_page_cache(cache_dir)
        self.assertEqual(list(pages), sorted(names))


class SaveDatasetTests(unittest.TestCase):
    def test_failure_during_write_removes_temp_and_keeps_original(self):
        with tempfile.TemporaryDirectory() as output_dir:
            out_path = os.path.join(output_dir, "aeons_end_all.json")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("original")
            with mock.patch.object(scraper.json, "dump", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    with redirect_stdout(io.StringIO()):
                        scraper.save_dataset({"supply": []}, output_dir)
            with open(out_path, encoding="utf-8") as f:
                self.assertEqual(f.read(), "original")
            self.assertFalse(os.path.exists(out_path + ".tmp"))


class MakePageUrlTests(unittest.TestCase):
    def test_accepts_wiki_url_and_encodes_title(self):
        self.assertEqual(
            scraper.make_page_url("Smite (Spell)?#"),
            "https://aeonsend.wiki.gg/wiki/Smite_%28Spell%29%3F%23",
        )

    def test_rejects_other_hosts_ports_credentials_and_paths(self):
        bad_bases = [
            "https://evil.com/wiki/",
            "https://aeonsend.wiki.gg.evil.com/wiki/",
            "https://sub.aeonsend.wiki.gg/wiki/",
            "https://aeonsend.wiki.gg:8443/wiki/",
            "https://user:pw@aeonsend.wiki.gg/wiki/",
            "http://aeonsend.wiki.gg/wiki/",
            "https://aeonsend.wiki.gg/index.php?title=",
            "https://aeonsend.wiki.gg/wiki/?q=",
            "https://aeonsend.wiki.gg/wiki/#",
            "https://aeonsend.wiki.gg/wiki/../",
            "https://aeonsend.wiki.gg/wiki/./",
        ]
        for base in bad_bases:
            with self.subTest(base=base):
                with mock.patch.object(scraper, "BASE_PAGE_URL", base):
                    with self.assertRaises(ValueError) as ctx:
                        scraper.make_page_url("Jade")
                    self.assertTrue(str(ctx.exception).isascii())

    def test_rejects_dot_segment_titles(self):
        for title in [".", ".."]:
            with self.subTest(title=title):
                with self.assertRaises(ValueError):
                    scraper.make_page_url(title)


class UnicodeSlugEdgeCaseTests(unittest.TestCase):
    """Revision 4 / R4S edge cases. Written with \\u escapes so the exact code points are explicit."""

    def test_composed_and_decomposed_give_identical_nfc_id(self):
        composed = scraper.make_item_id("supply", "Caf\u00e9")
        decomposed = scraper.make_item_id("supply", "Cafe\u0301")
        self.assertEqual(composed, decomposed)
        self.assertEqual(composed, "supply:caf\u00e9")
        self.assertNotIn("\u0301", decomposed)

    def test_uppercase_decomposed_lowercases_to_nfc(self):
        self.assertEqual(scraper.make_item_id("supply", "E\u0301CLAIR"), "supply:\u00e9clair")

    def test_every_apostrophe_followed_by_combining_mark_renormalizes(self):
        for apostrophe in ["'", "\u2019", "\u2018", "\u02bc", "`"]:
            with self.subTest(apostrophe=ascii(apostrophe)):
                item_id = scraper.make_item_id("supply", f"e{apostrophe}\u0301x")
                self.assertEqual(item_id, "supply:\u00e9x")
                self.assertTrue(unicodedata.is_normalized("NFC", item_id))

    def test_apostrophe_variants_collide_as_duplicates(self):
        with self.assertRaises(ValueError) as ctx:
            scraper.validate_ids({"supply": [
                {"id": scraper.make_item_id("supply", n), "name": n}
                for n in ["Transmuter's Lens", "Transmuter\u2019s Lens"]
            ]})
        self.assertIn("supply:transmuters-lens", str(ctx.exception))

    def test_ae_ligature_is_kept_and_lowercased(self):
        for name in ["\u00c6ther", "\u00c6THER", "\u00e6ther"]:
            with self.subTest(name=ascii(name)):
                self.assertEqual(scraper.make_item_id("supply", name), "supply:\u00e6ther")

    def test_sharp_s_is_kept_not_casefolded(self):
        self.assertEqual(scraper.make_item_id("supply", "Stra\u00dfe"), "supply:stra\u00dfe")
        self.assertEqual(scraper.make_item_id("supply", "STRASSE"), "supply:strasse")
        # Capital sharp s lowercases to the same small sharp s.
        self.assertEqual(scraper.make_item_id("supply", "STRA\u1e9eE"), "supply:stra\u00dfe")
        # "Stra\u00dfe" and "Strasse" are different ids, so both can coexist.
        scraper.validate_ids({"supply": [
            {"id": scraper.make_item_id("supply", n), "name": n} for n in ["Stra\u00dfe", "Strasse"]
        ]})

    def test_invisible_and_control_characters_become_separators(self):
        invisible = [
            "\u200b", "\u200c", "\u200d", "\ufeff", "\u00ad", "\u180e", "\U000e0041",
            "\u202a", "\u202b", "\u202c", "\u202d", "\u202e",
            "\u2066", "\u2067", "\u2068", "\u2069",
            "\u2028", "\u2029", "\x00", "\x1b", "\x7f", "\t", "\n", "\ud800",
        ]
        for ch in invisible:
            with self.subTest(ch=ascii(ch)):
                self.assertEqual(scraper.make_item_id("supply", f"A{ch}B"), "supply:a-b")
                # Leading/trailing invisible characters are stripped with the hyphens.
                self.assertEqual(scraper.make_item_id("supply", f"{ch}Jade{ch}"), "supply:jade")

    def test_only_invisible_characters_raise(self):
        for name in ["\u200b", "\u202e\u200d\ufeff", "\x00"]:
            with self.subTest(name=ascii(name)):
                with self.assertRaises(ValueError) as ctx:
                    scraper.slugify(name)
                self.assertTrue(str(ctx.exception).isascii())

    def test_mark_only_slugs_raise(self):
        for name in ["\u0301", "\u0301\u0302\u0303", " \u0301 - \u0308 ", "\ufe0f"]:
            with self.subTest(name=ascii(name)):
                with self.assertRaises(ValueError) as ctx:
                    scraper.slugify(name)
                self.assertIn(ascii(name), str(ctx.exception))

    def test_leading_mark_with_letter_is_kept(self):
        self.assertEqual(scraper.slugify("\u0301a"), "\u0301a")

    def test_non_latin_scripts_and_numbers_are_kept(self):
        self.assertEqual(scraper.make_item_id("supply", "\u706b Bolt"), "supply:\u706b-bolt")
        self.assertEqual(scraper.make_item_id("supply", "\u0928\u092e\u0938\u094d\u0924\u0947"),
                         "supply:\u0928\u092e\u0938\u094d\u0924\u0947")
        self.assertEqual(scraper.make_item_id("supply", "Tier \u2167"), "supply:tier-\u2177")

    def test_symbols_and_emoji_are_separators(self):
        self.assertEqual(scraper.make_item_id("supply", "Fire \U0001F525 Ice"), "supply:fire-ice")
        self.assertEqual(scraper.make_item_id("supply", "A&B/C+D"), "supply:a-b-c-d")

    def test_slugify_is_idempotent_on_its_output(self):
        for name in ["Caf\u00e9", "Stra\u00dfe", "\u00c6ther", "e'\u0301x", "\u0130ron", "\u706b Bolt"]:
            with self.subTest(name=ascii(name)):
                slug = scraper.slugify(name)
                self.assertEqual(scraper.slugify(slug), slug)

    def test_length_cap_is_inclusive_in_utf16_units(self):
        # "supply:" (7) + 96 astral letters (192 units) + "a" = 200 units: allowed.
        ok = scraper.make_item_id("supply", "\U00010400" * 96 + "a")
        self.assertEqual(scraper.utf16_length(ok), 200)
        with self.assertRaises(ValueError):
            scraper.make_item_id("supply", "\U00010400" * 96 + "ab")

    def test_non_nfc_or_unknown_kind_ids_fail_validation(self):
        for bad in ["supply:cafe\u0301", "mage :x", "SUPPLY:x", "supply:a\u200bb", "supply:x:y"]:
            with self.subTest(bad=ascii(bad)):
                with self.assertRaises(ValueError) as ctx:
                    scraper.validate_ids({"supply": [{"id": bad, "name": "x"}]})
                self.assertTrue(str(ctx.exception).isascii())

    def test_constructor_and_proto_names_get_ordinary_ids(self):
        self.assertEqual(scraper.make_item_id("supply", "constructor"), "supply:constructor")
        self.assertEqual(scraper.make_item_id("supply", "__proto__"), "supply:proto")


class BundledDatasetTests(unittest.TestCase):
    """
    Gate for the committed JSON: it must be exactly what the current scraper produces for its HTML,
    ids and page URLs. A missing file or an empty collection fails; nothing here is skipped.
    """

    @classmethod
    def setUpClass(cls):
        with open(DATASET_PATH, encoding="utf-8") as f:
            cls.data = json.load(f)

    def _records(self):
        for category in scraper.ID_KIND_BY_CATEGORY:
            for record in self.data[category]:
                yield category, record

    def test_counts(self):
        self.assertEqual({c: len(self.data[c]) for c in EXPECTED_COUNTS}, EXPECTED_COUNTS)
        self.assertEqual(sum(1 for _ in self._records()), 2119)

    def test_committed_ids_match_make_item_id(self):
        mismatches = [r["id"] for c, r in self._records() if scraper.make_item_id(c, r["name"]) != r["id"]]
        self.assertEqual(mismatches, [])
        scraper.validate_ids({c: self.data[c] for c in scraper.ID_KIND_BY_CATEGORY})

    def test_id_is_first_key_and_no_legacy_keys(self):
        for category, record in self._records():
            with self.subTest(id=record.get("id")):
                self.assertEqual(next(iter(record)), "id")
                self.assertNotIn("card_number", record)
                self.assertNotIn("page_id", record)

    def test_html_fields_are_already_sanitized(self):
        checked = 0
        dirty = []
        for category, record in self._records():
            for field in scraper.HTML_FIELDS[category]:
                value = record.get(field)
                if isinstance(value, str):
                    checked += 1
                    if scraper.sanitize_html(value) != value:
                        dirty.append(f"{record['id']}.{field}")
        self.assertEqual(dirty, [])
        self.assertGreater(checked, 2000)

    def test_no_style_attribute_anywhere(self):
        with open(DATASET_PATH, encoding="utf-8") as f:
            self.assertEqual(f.read().count("style="), 0)

    def test_plain_text_fields_have_no_markup(self):
        offenders = []
        for category, record in self._records():
            for key, value in record.items():
                if key in scraper.HTML_FIELDS[category]:
                    continue
                if any("<" in text for text in _string_values(value)):
                    offenders.append(f"{record['id']}.{key}")
        self.assertEqual(offenders, [])

    def test_every_page_url_round_trips(self):
        mismatches = [r["id"] for _, r in self._records() if scraper.make_page_url(r["name"]) != r["page_url"]]
        self.assertEqual(mismatches, [])


class MainFailureLeavesOutputTests(unittest.TestCase):
    """Every fail-closed scrape error exits non-zero and leaves an existing output file byte-identical."""

    SENTINEL = b'{"sentinel": true}\n'

    def _run(self, pages, patches=()):
        with tempfile.TemporaryDirectory() as output_dir:
            cache_dir = os.path.join(output_dir, ".cache")
            os.makedirs(cache_dir)
            for page in pages:
                with open(os.path.join(cache_dir, f"page_{page['pageid']}.json"), "w", encoding="utf-8") as f:
                    json.dump(page, f)
            out_path = os.path.join(output_dir, "aeons_end_all.json")
            with open(out_path, "wb") as f:
                f.write(self.SENTINEL)
            argv = ["scrape_aeons_end.py", "--cache-only", "--output-dir", output_dir]
            with mock.patch.object(sys, "argv", argv), redirect_stdout(io.StringIO()):
                for target, name, value in patches:
                    mock.patch.object(target, name, value).start()
                try:
                    with self.assertRaises(SystemExit) as ctx:
                        scraper.main()
                finally:
                    mock.patch.stopall()
            with open(out_path, "rb") as f:
                self.assertEqual(f.read(), self.SENTINEL)
            self.assertFalse(os.path.exists(out_path + ".tmp"))
            self.assertEqual(sorted(os.listdir(output_dir)), [".cache", "aeons_end_all.json"])
            code = ctx.exception.code
            self.assertIsInstance(code, str)  # sys.exit(str) -> exit status 1
            self.assertTrue(code.startswith("Error: "))
            self.assertTrue(code.isascii(), code)
            return code

    def test_empty_slug(self):
        code = self._run([_page(1, "!!!", "{{PlayerCard|type=Gem|cost=3}}")])
        self.assertIn("Empty id slug", code)

    def test_mark_only_slug(self):
        code = self._run([_page(1, "\u0301", "{{PlayerCard|type=Gem|cost=3}}")])
        self.assertIn("no letter or number", code)

    def test_too_long_id(self):
        code = self._run([_page(1, "a" * 200, "{{PlayerCard|type=Gem|cost=3}}")])
        self.assertIn("UTF-16", code)

    def test_duplicate_from_nfc_variants_reports_both_escaped(self):
        code = self._run([
            _page(1, "Caf\u00e9", "{{PlayerCard|type=Gem|cost=3}}"),
            _page(2, "Cafe\u0301", "{{PlayerCard|type=Gem|cost=4}}"),
        ])
        self.assertIn("Duplicate ids (1)", code)
        self.assertIn(ascii("supply/Caf\u00e9"), code)
        self.assertIn(ascii("supply/Cafe\u0301"), code)

    def test_duplicate_with_bidi_name_is_escaped(self):
        code = self._run([
            _page(1, "A\u202eB", "{{PlayerCard|type=Gem|cost=3}}"),
            _page(2, "A B", "{{PlayerCard|type=Gem|cost=4}}"),
        ])
        self.assertNotIn("\u202e", code)
        self.assertIn("\\u202e", code)

    def test_page_url_off_allowlist(self):
        code = self._run(
            [_page(1, "Jade", "{{PlayerCard|type=Gem|cost=2}}")],
            patches=[(scraper, "BASE_PAGE_URL", "https://evil.com/wiki/")],
        )
        self.assertIn("Page URL not on the allowed wiki", code)


class PrivacyTests(unittest.TestCase):
    def test_default_user_agent_is_generic(self):
        self.assertEqual(scraper.DEFAULT_USER_AGENT, "AeonsEndWikiScraper/1.0")


if __name__ == "__main__":
    unittest.main()
