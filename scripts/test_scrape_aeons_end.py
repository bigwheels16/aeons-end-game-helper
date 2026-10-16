"""
Unit tests for the HTML sanitizer, id generation, id validation, atomic save, image names, HTTP
retries, image download and the committed dataset in scrape_aeons_end.py. Standard library plus
nh3; no network access.

Run from the repo root:
  pip install --only-binary :all: -r scripts/requirements.txt
  python3 -m unittest discover -s scripts -p "test_*.py"
"""

import argparse
import email.message
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import unicodedata
import unittest
import urllib.error
import urllib.parse
from contextlib import redirect_stderr, redirect_stdout
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


DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "aeons_end_all.json")
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

    def test_records_list_their_image_file_names_last(self):
        by_category = _parse(SYNTHETIC_PAGES)
        mage = by_category["mages"][0]
        self.assertEqual(list(mage)[-1], "images")
        self.assertEqual(mage["images"], ["X_(Mage)_Front.jpg", "X_(Mage)_Back.jpg"])
        self.assertEqual(by_category["supply"][0]["images"], ["Foo_Gem.jpg"])
        self.assertNotIn("page_url", mage)

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
        cache_dir = os.path.join(output_dir, scraper.SCRAPED_DIRNAME, ".cache")
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

    def test_download_images_cannot_combine_with_cache_only(self):
        argv = ["scrape_aeons_end.py", "--cache-only", "--download-images"]
        with mock.patch.object(sys, "argv", argv), mock.patch.object(scraper, "scrape") as scrape, \
                redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                scraper.main()
        self.assertEqual(ctx.exception.code, 2)
        scrape.assert_not_called()


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


class RecordImageNamesTests(unittest.TestCase):
    def test_default_names_follow_the_templates(self):
        cases = [
            ("supply", _page(1, "Invention: Quantoid", "{{PlayerCard|type=Gem}}"), ["Invention_Quantoid.jpg"]),
            ("mages", _page(2, "Xaxos: Ascended", "{{Mage|title=X}}"), ["Xaxos:_Ascended_Front.jpg", "Xaxos:_Ascended_Back.jpg"]),
            ("nemeses", _page(3, "Bishop: Returned", "{{Nemesis|life=70}}"), ["Bishop_Returned_Front.jpg", "Bishop_Returned_Back.jpg"]),
            ("nemesis_cards", _page(4, "Bad Minion", "{{NemesisCard|type=Minion}}"), ["Bad_Minion.jpg"]),
        ]
        for category, page, expected in cases:
            with self.subTest(title=page["title"]):
                self.assertEqual(scraper.record_image_names(category, page), expected)

    def test_image_parameters_override_and_are_percent_decoded(self):
        nemesis = _page(1, "Z'hana", "{{Nemesis|Image_Front = Z%27hana_Front |life=70}}")
        self.assertEqual(scraper.record_image_names("nemeses", nemesis), ["Z'hana_Front.jpg", "Z'hana_Back.jpg"])
        card = _page(2, "Banesire", "{{NemesisCard|Image=Banesire (The Descent)|type=Minion}}")
        self.assertEqual(scraper.record_image_names("nemesis_cards", card), ["Banesire_(The_Descent).jpg"])

    def test_wiki_file_name(self):
        for name, expected in [("jade.jpg", "Jade.jpg"), (" A  _b .jpg", "A_b_.jpg"), ("Z'hana_Front.jpg", "Z'hana_Front.jpg")]:
            with self.subTest(name=name):
                self.assertEqual(scraper.wiki_file_name(name), expected)

    def test_collect_includes_images_in_html_fields(self):
        pages = {
            "Foo Gem": _page(1, "Foo Gem", "{{PlayerCard|type=Gem|cost=3|rules=Gain [[File:Fury token.png|50px]] and [[File:Ab'c.png]]}}"),
            "Bar Gem": _page(2, "Bar Gem", "{{PlayerCard|type=Gem|cost=3|rules=Gain [[File:Fury token.png|50px]]}}"),
        }
        self.assertEqual(scraper.collect_image_names(_parse(pages)), {
            "Ab'c.png": ["supply:foo-gem"],
            "Bar_Gem.jpg": ["supply:bar-gem"],
            "Foo_Gem.jpg": ["supply:foo-gem"],
            "Fury_token.png": ["supply:foo-gem", "supply:bar-gem"],
        })


class FetchImageInfoTests(unittest.TestCase):
    INFO = {"url": WIKI_IMG + "Baz.jpg?1", "size": 3, "sha1": "a" * 40}

    def test_follows_normalization_and_redirects(self):
        response = {
            "query": {
                "normalized": [{"from": "File:Foo_bar.jpg", "to": "File:Foo bar.jpg"}],
                "redirects": [{"from": "File:Foo bar.jpg", "to": "File:Baz.jpg"}],
                "pages": {
                    "7": {"title": "File:Baz.jpg", "imageinfo": [self.INFO]},
                    "-1": {"title": "File:Nope.jpg", "missing": ""},
                },
            }
        }
        with mock.patch.object(scraper, "api_get", return_value=response):
            info = scraper.fetch_image_info(["Foo_bar.jpg", "Nope.jpg"], "ua", 0)
        self.assertEqual(info, {"Foo_bar.jpg": {"title": "File:Baz.jpg", **self.INFO}, "Nope.jpg": None})

    def test_requests_at_most_50_titles_and_waits_between_requests(self):
        names = [f"F{i}.jpg" for i in range(51)]
        with mock.patch.object(scraper, "api_get", return_value={"query": {}}) as api_get, \
                mock.patch.object(scraper.time, "sleep") as sleep:
            info = scraper.fetch_image_info(names, "ua", 2.5)
        self.assertEqual([len(c.args[0]["titles"].split("|")) for c in api_get.call_args_list], [50, 1])
        sleep.assert_called_once_with(2.5)
        self.assertEqual(set(info.values()), {None})

    def test_error_or_continuation_raises(self):
        for response in ({"error": {"code": "x"}}, {"continue": {"iicontinue": "x"}, "query": {}}):
            with self.subTest(response=response):
                with mock.patch.object(scraper, "api_get", return_value=response):
                    with self.assertRaises(ValueError):
                        scraper.fetch_image_info(["A.jpg"], "ua", 0)


class ImageUrlRejectionTests(unittest.TestCase):
    def test_accepts_the_file_on_the_wiki(self):
        for url, file_name in [
            (WIKI_IMG + "Z%27hana_Front.jpg?10430c", "Z'hana_Front.jpg"),
            (WIKI_IMG + "Banesire_(The_Descent).jpg", "Banesire_(The_Descent).jpg"),
        ]:
            with self.subTest(url=url):
                self.assertIsNone(scraper.image_url_rejection_reason(url, file_name))

    def test_rejects_other_hosts_schemes_and_paths(self):
        for url in [
            "http://aeonsend.wiki.gg/images/A.jpg",
            "https://evil.example/images/A.jpg",
            "https://aeonsend.wiki.gg.evil.example/images/A.jpg",
            "https://user@aeonsend.wiki.gg/images/A.jpg",
            "https://aeonsend.wiki.gg:8443/images/A.jpg",
            "https://aeonsend.wiki.gg/images/a/A.jpg",
            "https://aeonsend.wiki.gg/images/B.jpg",
        ]:
            with self.subTest(url=url):
                self.assertIsNotNone(scraper.image_url_rejection_reason(url, "A.jpg"))


class _FakeResponse:
    def __init__(self, body, content_type="image/jpeg"):
        self.body = body
        self.headers = email.message.Message()
        self.headers["Content-Type"] = content_type

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _http_error(code, retry_after=None):
    headers = email.message.Message()
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return urllib.error.HTTPError("https://aeonsend.wiki.gg/x", code, "error", headers, None)


class HttpGetTests(unittest.TestCase):
    def _get(self, *outcomes):
        with mock.patch.object(scraper.urllib.request, "urlopen", side_effect=list(outcomes)) as urlopen, \
                mock.patch.object(scraper.time, "sleep") as sleep, redirect_stdout(io.StringIO()):
            try:
                return scraper.http_get("https://aeonsend.wiki.gg/x", "ua"), urlopen.call_count, sleep.call_args_list
            except scraper.HttpError as e:
                return e, urlopen.call_count, sleep.call_args_list

    def test_success_returns_body_and_content_type(self):
        result, calls, sleeps = self._get(_FakeResponse(b"img", "image/png"))
        self.assertEqual(result, (b"img", "image/png"))
        self.assertEqual((calls, sleeps), (1, []))

    def test_throttling_waits_retry_after_then_retries(self):
        result, calls, sleeps = self._get(_http_error(429, "7"), _FakeResponse(b"img"))
        self.assertEqual(result, (b"img", "image/jpeg"))
        self.assertEqual((calls, sleeps), (2, [mock.call(7.0)]))

    def test_network_error_is_retried(self):
        result, calls, _ = self._get(urllib.error.URLError("reset"), _FakeResponse(b"img"))
        self.assertEqual((result, calls), ((b"img", "image/jpeg"), 2))

    def test_gives_up_after_max_retries_with_doubling_backoff(self):
        result, calls, sleeps = self._get(*[_http_error(503)] * (scraper.MAX_RETRIES + 1))
        self.assertIsInstance(result, scraper.HttpError)
        self.assertEqual(calls, scraper.MAX_RETRIES + 1)
        self.assertEqual(sleeps, [mock.call(scraper.RETRY_BASE_DELAY * 2 ** i) for i in range(scraper.MAX_RETRIES)])

    def test_other_errors_and_long_retry_after_fail_at_once(self):
        for error in (_http_error(403), _http_error(404), _http_error(429, "3600")):
            with self.subTest(code=error.code):
                result, calls, sleeps = self._get(error, _FakeResponse(b"img"))
                self.assertIsInstance(result, scraper.HttpError)
                self.assertEqual((calls, sleeps), (1, []))


class _FakeWiki:
    """
    Answers imageinfo queries (normalizing underscores to spaces and following redirects, as the
    wiki does) and image downloads, for files given as name (with spaces) -> bytes.
    """

    def __init__(self, files):
        self.files = dict(files)
        self.redirects = {}
        self.served = {}
        self.downloads = []

    def api_get(self, params, user_agent):
        normalized, redirects, pages = [], [], {}
        for i, title in enumerate(params["titles"].split("|"), 1):
            name = title.split(":", 1)[1].replace("_", " ")
            if f"File:{name}" != title:
                normalized.append({"from": title, "to": f"File:{name}"})
            if name in self.redirects:
                redirects.append({"from": f"File:{name}", "to": f"File:{self.redirects[name]}"})
                name = self.redirects[name]
            if name not in self.files:
                pages[str(-i)] = {"title": f"File:{name}", "missing": ""}
                continue
            body = self.files[name]
            url = WIKI_IMG + urllib.parse.quote(name.replace(" ", "_")) + "?1"
            info = {"url": url, "size": len(body), "sha1": hashlib.sha1(body).hexdigest()}
            pages[str(i)] = {"title": f"File:{name}", "imageinfo": [info]}
        return {"query": {"normalized": normalized, "redirects": redirects, "pages": pages}}

    def http_get(self, url, user_agent):
        file_name = urllib.parse.unquote(url[len(WIKI_IMG):].split("?")[0])
        self.downloads.append(file_name)
        served = self.served.get(file_name)
        if isinstance(served, BaseException):
            raise served
        return served or (self.files[file_name.replace("_", " ")], "image/jpeg")


class DownloadImagesTests(unittest.TestCase):
    FILES = {
        "Foo Gem.jpg": b"foo",
        "X.jpg": b"x",
        "X (Mage) Front.jpg": b"mage front",
        "X (Mage) Back.jpg": b"mage back",
        "Big Bad Front.jpg": b"bad front",
        "Big Bad Back.jpg": b"bad back",
    }

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.output_dir = tmp.name
        self.images_dir = os.path.join(self.output_dir, scraper.SCRAPED_DIRNAME, "images")
        self.wiki = _FakeWiki(self.FILES)

    def _download(self):
        args = argparse.Namespace(output_dir=self.output_dir, user_agent="ua", delay=0, image_delay=0)
        self.wiki.downloads = []
        with mock.patch.object(scraper, "api_get", self.wiki.api_get), \
                mock.patch.object(scraper, "http_get", self.wiki.http_get), \
                mock.patch.object(scraper.time, "sleep"), redirect_stdout(io.StringIO()) as out:
            try:
                scraper.download_images(_parse(SYNTHETIC_PAGES), args)
            finally:
                self.output = out.getvalue()

    def _manifest(self):
        with open(os.path.join(self.images_dir, "images.json"), encoding="utf-8") as f:
            return json.load(f)

    def _read(self, file_name):
        with open(os.path.join(self.images_dir, file_name), "rb") as f:
            return f.read()

    def test_downloads_images_and_writes_manifest(self):
        self._download()
        self.assertEqual(len(self.wiki.downloads), 6)
        self.assertEqual(self._read("X_(Mage)_Front.jpg"), b"mage front")
        manifest = self._manifest()
        self.assertEqual(len(manifest), 6)
        self.assertEqual(manifest["Foo_Gem.jpg"], hashlib.sha1(b"foo").hexdigest())
        self.assertIn("Missing image: file='Bad_Minion.jpg' used_by='nemesis-card:bad-minion'", self.output)
        self.assertNotIn("Renamed image", self.output)

    def test_file_saved_under_the_record_name_when_the_wiki_renamed_it(self):
        self.wiki.files["Old Front.jpg"] = self.wiki.files.pop("X (Mage) Front.jpg")
        self.wiki.redirects["X (Mage) Front.jpg"] = "Old Front.jpg"
        self._download()
        self.assertIn("Old_Front.jpg", self.wiki.downloads)
        self.assertEqual(self._read("X_(Mage)_Front.jpg"), b"mage front")
        self.assertIn("Renamed image: file='X_(Mage)_Front.jpg' used_by='mage:x-mage' wiki_file='Old_Front.jpg'", self.output)

    def test_unchanged_images_are_not_requested_again_even_if_re_encoded(self):
        self.wiki.served["Foo_Gem.jpg"] = (b"re-encoded foo", "image/jpeg")
        self._download()
        self.assertEqual(self._read("Foo_Gem.jpg"), b"re-encoded foo")
        self._download()
        self.assertEqual(self.wiki.downloads, [])

    def test_changed_image_is_downloaded_again(self):
        self._download()
        self.wiki.files["Foo Gem.jpg"] = b"new foo"
        self._download()
        self.assertEqual(self.wiki.downloads, ["Foo_Gem.jpg"])
        self.assertEqual(self._read("Foo_Gem.jpg"), b"new foo")

    def test_byte_identical_file_without_manifest_counts_as_current(self):
        os.makedirs(self.images_dir)
        with open(os.path.join(self.images_dir, "X.jpg"), "wb") as f:
            f.write(b"x")
        self._download()
        self.assertNotIn("X.jpg", self.wiki.downloads)
        self.assertEqual(self._manifest()["X.jpg"], hashlib.sha1(b"x").hexdigest())

    def test_non_image_response_aborts_and_keeps_earlier_downloads_in_manifest(self):
        self.wiki.served["Foo_Gem.jpg"] = (b"<html>blocked</html>", "text/html")
        with self.assertRaises(ValueError):
            self._download()
        self.assertFalse(os.path.exists(os.path.join(self.images_dir, "Foo_Gem.jpg")))
        self.assertEqual(sorted(self._manifest()), ["Big_Bad_Back.jpg", "Big_Bad_Front.jpg"])

    def test_interrupt_keeps_manifest_and_exits_130(self):
        self.wiki.served["Big_Bad_Front.jpg"] = KeyboardInterrupt()
        with self.assertRaises(SystemExit) as ctx:
            self._download()
        self.assertEqual(ctx.exception.code, 130)
        self.assertEqual(list(self._manifest()), ["Big_Bad_Back.jpg"])

    def test_off_wiki_url_aborts_before_downloading(self):
        api_get = self.wiki.api_get

        def off_wiki(params, user_agent):
            response = api_get(params, user_agent)
            for page in response["query"]["pages"].values():
                for info in page.get("imageinfo", []):
                    info["url"] = info["url"].replace("aeonsend.wiki.gg", "cdn.example")
            return response

        self.wiki.api_get = off_wiki
        with self.assertRaises(ValueError):
            self._download()
        self.assertEqual(self.wiki.downloads, [])


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

    def test_every_record_lists_its_image_file_names(self):
        bad = []
        for category, record in self._records():
            images = record.get("images")
            expected_count = 2 if category in ("mages", "nemeses") else 1
            if (
                not isinstance(images, list)
                or len(images) != expected_count
                or any(not isinstance(name, str) or scraper.wiki_file_name(name) != name for name in images)
                or "page_url" in record
            ):
                bad.append(record["id"])
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main()
