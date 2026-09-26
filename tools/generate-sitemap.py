#!/usr/bin/env python3
"""
sitemap.xml 自動生成スクリプト（ContentsX）

WP API から news 一覧を取得し、sitemap.xml の BUILD:NEWS 領域だけを更新する。
静的ページ・サービス・コラムのURLは各々の管理元が保持する。

使い方:
    cd ContentX
    python3 tools/generate-sitemap.py

実行タイミング:
    - WordPress でニュース記事を公開/更新した後
    - 月1回の定期実行（GitHub Actions 等）も可

Why:
    news-detail.html は 1つのHTMLで `?id=N` により記事を切替える構成のため、
    sitemap.xml に個別URLを列挙しないと Google が個別記事を認識しない。
    本スクリプトは WP API から最新のID一覧を取得してニュース領域を更新する。
"""

import json
import pathlib
import sys
import urllib.request

API_BASE = "https://cms.contentsx.jp/wp-json/contentsx/v1"
SITE = "https://contentsx.jp"
OUT = pathlib.Path(__file__).resolve().parent.parent / "sitemap.xml"
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
    """Only replace news URLs; service/column/static entries have other owners."""
    source = OUT.read_text(encoding="utf-8")
    start, end = "<!-- BUILD:NEWS -->", "<!-- /BUILD:NEWS -->"
    if source.count(start) != 1 or source.count(end) != 1:
        raise RuntimeError("Missing BUILD:NEWS marker pair in sitemap.xml")
    lines = []
    for item in news_items:
        lines.extend([
            "  <url>",
            f"    <loc>{SITE}/news-detail?id={item['id']}</loc>",
            f"    <lastmod>{item['date']}</lastmod>" if item["date"] else None,
            "    <changefreq>monthly</changefreq>",
            "    <priority>0.5</priority>",
            "  </url>",
        ])
    before, tail = source.split(start, 1)
    _, after = tail.split(end, 1)
    return before + start + "\n" + "\n".join(line for line in lines if line is not None) + ("\n" if lines else "") + "  " + end + after


def main():
    try:
        news = fetch_news()
    except Exception as e:
        print(f"ERROR fetching news: {e}", file=sys.stderr)
        sys.exit(1)
    xml = build_sitemap(news)
    OUT.write_text(xml, encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  news entries: {len(news)}")


if __name__ == "__main__":
    main()
