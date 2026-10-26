"""コラム生成（tools/build-c-columns.py）の入力検査。WordPress の値は乗っ取りで書き換えられうる前提。
python3 -m unittest discover -s tests -p test_build_c_columns.py"""
import importlib.util
import json
import re
import unittest
from pathlib import Path
from unittest.mock import patch

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


class SeoFields(unittest.TestCase):
    """WP の「SEOタイトル」「SEO説明文」は検索・SNS 向けの欄にだけ使い、見出しは記事タイトルのまま"""

    def build(self, **fields):
        full = dict({"id": 7, "slug": "seo-fields", "title_ja": "記事タイトル", "excerpt_ja": "一覧カードの抜粋",
                     "content": "<p>Body</p>"}, **fields)
        with patch.object(bc, "fetch_column_full", lambda col_id: full):
            return bc.build_one({"id": 7}, [], bc.TEMPLATE_PATH.read_text(encoding="utf-8"))[1]

    def test_prefers_seo_fields(self):
        page = self.build(seo_title="検索用タイトル", seo_description="検索用の<b>説明</b>\r\n文")
        for tag in ("<title>検索用タイトル｜ContentsX</title>",
                    '<meta property="og:title" content="検索用タイトル｜ContentsX">',
                    '<meta name="twitter:title" content="検索用タイトル｜ContentsX">',
                    '<meta name="description" content="検索用の説明 文">',
                    '<meta property="og:description" content="検索用の説明 文">',
                    "<h1>記事タイトル</h1>"):
            self.assertIn(tag, page)
        self.assertIn('"headline": "記事タイトル"', page)
        self.assertNotIn("一覧カードの抜粋", page)

    def test_falls_back_to_title_and_excerpt(self):
        for fields in ({"seo_title": " ", "seo_description": ""}, {}):  # 空欄・API に欄が無いとき
            page = self.build(**fields)
            self.assertIn("<title>記事タイトル｜ContentsX</title>", page)
            self.assertIn('<meta name="description" content="一覧カードの抜粋">', page)

    def test_long_values_are_shortened(self):
        page = self.build(seo_title="あ" * 70, seo_description="い" * 200)
        self.assertIn("<title>" + "あ" * 58 + "…｜ContentsX</title>", page)
        self.assertIn('<meta name="description" content="' + "い" * 128 + '…">', page)

    def test_site_name_written_by_editor_is_not_doubled(self):
        # サイト名はビルドが付ける。B と共有する記事に「｜ビズマンガ」と書かれても C で並べない
        for written in ("検索用｜ContentsX", "検索用 | Contents X", "検索用｜ビズマンガ", "検索用｜コラム｜ビズマンガ"):
            self.assertIn("<title>検索用｜ContentsX</title>", self.build(seo_title=written), written)
        self.assertIn("<title>記事タイトル｜ContentsX</title>", self.build(seo_title="｜ContentsX"))

    def test_saved_entities_are_shown_as_text(self):
        # WP は保存時に単独の「<」を &lt; に変える。検索結果に「&lt;」と出さない
        page = self.build(seo_title="費用&lt;相場", seo_description="A&amp;B &lt; C")
        self.assertIn("<title>費用&lt;相場｜ContentsX</title>", page)
        self.assertIn('<meta name="description" content="A&amp;B &lt; C">', page)

    def test_json_ld_stays_valid(self):
        page = self.build(title_ja='引用"と\\と</script>&', seo_description='説明"と\\と<b>&</b>')
        docs = [json.loads(m) for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)]
        article = next(d for d in docs if d.get("@type") in ("Article", "BlogPosting"))
        self.assertEqual(article["headline"], '引用"と\\と</script>&')
        self.assertEqual(article["description"], '説明"と\\と&')
        self.assertEqual(page.count("</script>"), page.count("<script"))

    def test_huge_values_do_not_stall_the_build(self):
        # 末尾のサイト名を外す正規表現は長い値で遅くなる。先に1000字で切るので一瞬で終わる（切らないと20万字で約20秒）
        page = self.build(seo_title=" | Contents X" * 20000 + "x", seo_description="<" * 200000)
        self.assertIn("<title>| Contents X | Contents X", page)
        self.assertIn('<meta name="description" content="' + "&lt;" * 128 + '…">', page)

    def test_wp_values_are_not_expanded_as_placeholders(self):
        page = self.build(seo_title="{{CONTENT}}", seo_description="{{SLUG}}", content="<p>本文</p>")
        self.assertIn("<title>{{CONTENT}}｜ContentsX</title>", page)
        self.assertIn('<meta name="description" content="{{SLUG}}">', page)


if __name__ == "__main__":
    unittest.main()
