#!/usr/bin/env python3
"""
sitemap.xml 自動生成スクリプト（ContentsX）

WP API から news 一覧を取得し、静的ページ + 個別ニュース記事URLを含む
sitemap.xml を出力する。

使い方:
    cd ContentX
    python3 tools/generate-sitemap.py

実行タイミング:
    - WordPress でニュース記事を公開/更新した後
    - 月1回の定期実行（GitHub Actions 等）も可

Why:
    news-detail.html は 1つのHTMLで `?id=N` により記事を切替える構成のため、
    sitemap.xml に個別URLを列挙しないと Google が個別記事を認識しない。
    本スクリプトは WP API から最新のID一覧を取得して sitemap を再生成する。
"""

import datetime
import json
import pathlib
import sys
import urllib.request

API_BASE = "https://cms.contentsx.jp/wp-json/contentsx/v1"
SITE = "https://contentsx.jp"
OUT = pathlib.Path(__file__).resolve().parent.parent / "sitemap.xml"

STATIC_PAGES = [
    ("/",              "weekly",  "1.0"),
    ("/company",       "monthly", "0.8"),
    ("/contact",       "monthly", "0.9"),
    ("/leadership",    "monthly", "0.6"),
    ("/our-thoughts",  "monthly", "0.7"),
    ("/partners",      "monthly", "0.6"),
    ("/recruit",       "monthly", "0.7"),
    ("/news",          "weekly",  "0.6"),
]


def fetch_news():
    req = urllib.request.Request(f"{API_BASE}/news", headers={"User-Agent": "ContentsX-Sitemap/1.0"})
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read().decode("utf-8"))
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected API response: {type(data)}")
    items = []
    for item in data:
        if item.get("show_site") not in (None, "", "contentsx", "both"):
            continue
        if not item.get("has_detail"):
            continue
        items.append({
            "id": item["id"],
            "date": item.get("date", "").replace(".", "-"),
        })
    return items


def build_sitemap(news_items):
    today = datetime.date.today().isoformat()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "",
        "  <!-- 静的ページ -->",
    ]
    for path, changefreq, priority in STATIC_PAGES:
        lines += [
            "  <url>",
            f"    <loc>{SITE}{path}</loc>",
            f"    <changefreq>{changefreq}</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]
    lines += ["", "  <!-- ニュース個別記事（WP API から自動生成） -->"]
    for n in news_items:
        lines += [
            "  <url>",
            f"    <loc>{SITE}/news-detail?id={n['id']}</loc>",
            f"    <lastmod>{n['date'] or today}</lastmod>",
            "    <changefreq>monthly</changefreq>",
            "    <priority>0.5</priority>",
            "  </url>",
        ]
    lines.append("")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main():
    try:
        news = fetch_news()
    except Exception as e:
        print(f"ERROR fetching news: {e}", file=sys.stderr)
        sys.exit(1)
    xml = build_sitemap(news)
    OUT.write_text(xml, encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  static pages: {len(STATIC_PAGES)}")
    print(f"  news entries: {len(news)}")


if __name__ == "__main__":
    main()
