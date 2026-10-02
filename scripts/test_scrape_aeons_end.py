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
import urllib.parse
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


class ParseAndGroupTests(unittest.TestCase):
    def test_records_get_new_ids(self):
        by_category = _parse(SYNTHETIC_PAGES)
        self.assertEqual(by_category["supply"][0]["id"], "supply:foo-gem")
        self.assertEqual(by_category["unique_starters"][0]["id"], "starter:x")
        self.assertEqual(by_category["mages"][0]["id"], "mage:x-mage")
        self.assertEqual(by_category["nemeses"][0]["id"], "nemesis:big-bad")
        self.assertEqual(by_category["nemesis_cards"][0]["id"], "nemesis-card:bad-minion")

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
    def test_failed_write_raises_and_keeps_existing_output(self):
        def partial_dump(obj, fp, **kwargs):
            fp.write('{"partial": ')
            raise OSError("disk full")

        with tempfile.TemporaryDirectory() as output_dir:
            out_path = os.path.join(output_dir, "aeons_end_all.json")
            with open(out_path, "wb") as f:
                f.write(b"original")
            with mock.patch.object(scraper.json, "dump", side_effect=partial_dump):
                with self.assertRaises(OSError), redirect_stdout(io.StringIO()):
                    scraper.save_dataset({"supply": []}, output_dir)
            with open(out_path, "rb") as f:
                self.assertEqual(f.read(), b"original")


class MakePageUrlTests(unittest.TestCase):
    def test_accepts_wiki_url_and_encodes_title(self):
        self.assertEqual(
            scraper.make_page_url("Smite (Spell)?#"),
            "https://aeonsend.wiki.gg/wiki/Smite_%28Spell%29%3F%23",
        )

    def test_hostile_titles_stay_on_the_wiki(self):
        for title in ["//evil.com/x", "http://evil.com", "user:pw@evil.com:8080", "a\\b"]:
            with self.subTest(title=title):
                parts = urllib.parse.urlsplit(scraper.make_page_url(title))
                self.assertEqual((parts.scheme, parts.netloc, parts.query, parts.fragment),
                                 ("https", "aeonsend.wiki.gg", "", ""))
                self.assertTrue(parts.path.startswith("/wiki/"), parts.path)

    def test_rejects_dot_segment_titles(self):
        for title in [".", "..", "a/../b", "./a", "a/.."]:
            with self.subTest(title=title):
                with self.assertRaises(ValueError):
                    scraper.make_page_url(title)


class BundledDatasetTests(unittest.TestCase):
    """
    Gate for the committed JSON: it must be exactly what the current scraper produces for its HTML,
    ids and page URLs. A missing file or collection fails; nothing here is skipped.
    """

    @classmethod
    def setUpClass(cls):
        with open(DATASET_PATH, encoding="utf-8") as f:
            cls.data = json.load(f)

    def _records(self):
        for category in scraper.ID_KIND_BY_CATEGORY:
            for record in self.data[category]:
                yield category, record

    def test_committed_ids_match_make_item_id(self):
        mismatches = [r["id"] for c, r in self._records() if scraper.make_item_id(c, r["name"]) != r["id"]]
        self.assertEqual(mismatches, [])
        scraper.validate_ids({c: self.data[c] for c in scraper.ID_KIND_BY_CATEGORY})

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


if __name__ == "__main__":
    unittest.main()
