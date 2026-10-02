"""
Unit tests for the id generation, id validation, page-URL allowlist and atomic save in
scrape_aeons_end.py. Standard library only; no network access.

Run from the repo root:
  python3 -m unittest discover -s scripts -p "test_*.py"
"""

import io
import json
import os
import sys
import tempfile
import unicodedata
import unittest
from contextlib import redirect_stdout
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


def _parse(pages):
    with redirect_stdout(io.StringIO()):
        return scraper.parse_and_group(pages)


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
        ]
        for base in bad_bases:
            with self.subTest(base=base):
                with mock.patch.object(scraper, "BASE_PAGE_URL", base):
                    with self.assertRaises(ValueError) as ctx:
                        scraper.make_page_url("Jade")
                    self.assertTrue(str(ctx.exception).isascii())


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
    """The committed JSON is reproducible from its own names by the current slug rules."""

    def test_committed_ids_match_make_item_id(self):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "scraped", "aeons_end_all.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        mismatches = []
        count = 0
        for category in scraper.ID_KIND_BY_CATEGORY:
            for record in data[category]:
                count += 1
                if scraper.make_item_id(category, record["name"]) != record["id"]:
                    mismatches.append(record["id"])
        self.assertEqual(mismatches, [])
        self.assertEqual(count, 2119)
        scraper.validate_ids({c: data[c] for c in scraper.ID_KIND_BY_CATEGORY})


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
