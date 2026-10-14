"""コラム生成（tools/build-c-columns.py）の入力検査。WordPress の値は乗っ取りで書き換えられうる前提。
python3 -m unittest discover -s tests -p test_build_c_columns.py"""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_c_columns", ROOT / "tools" / "build-c-columns.py")
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)


class SafeImageUrl(unittest.TestCase):
    def test_allows_known_hosts(self):
        for u in ("https://cms.contentsx.jp/wp-content/uploads/2026/04/a.webp",
                  "https://contentsx.jp/material/images/og/og-index.webp"):
            self.assertEqual(bc.safe_image_url(u, "FB"), u)

    def test_keeps_empty(self):
        self.assertEqual(bc.safe_image_url("", "FB"), "")

    def test_rejects_breakouts_and_other_hosts(self):
        for u in ('https://cms.contentsx.jp/a.webp" onerror="alert(1)',
                  "https://cms.contentsx.jp/a.webp') ; background:url('x",
                  "https://cms.contentsx.jp/a.webp</style><script>alert(1)</script>",
                  "javascript:alert(1)", "http://cms.contentsx.jp/a.webp",
                  "https://evil.example/a.webp", "https://contentsx.jp.evil.example/a.webp",
                  "//cms.contentsx.jp/a.webp", None, 123):
            self.assertEqual(bc.safe_image_url(u, "FB"), "FB", u)


class SafeSlug(unittest.TestCase):
    def test_allows_ascii_and_japanese(self):
        for s in ("manga-plot-guide", "採用マンガとは？4タイプ"):
            self.assertEqual(bc.safe_slug(s), s)

    def test_rejects_path_and_markup(self):
        for s in ("../index", "a/b", 'x"><script>', "a b", "", None, "..", "a%2Fb", "a#b"):
            self.assertEqual(bc.safe_slug(s), "", s)


class JsonForScript(unittest.TestCase):
    def test_cannot_close_script(self):
        out = bc.json_for_script({"title": "</script><script>alert(1)</script> & co"})
        self.assertNotIn("</", out)
        self.assertNotIn("<script", out)
        self.assertEqual(json.loads(out)["title"], "</script><script>alert(1)</script> & co")


if __name__ == "__main__":
    unittest.main()
