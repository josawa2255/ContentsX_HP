#!/usr/bin/env python3
"""ContentsX RSS 2.0 フィード生成ツール
WP API から最新コラム + ニュースを取得し、/feed.xml を生成。

Usage:
  python3 tools/build-c-feed.py
"""
import datetime
import json
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

API_BASE = "https://cms.contentsx.jp/wp-json/contentsx/v1"
SITE_URL = "https://contentsx.jp"
SITE_NAME = "ContentsX"
ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "feed.xml"


def fetch_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "ContentsX-FeedBot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def rfc822(ymd: str) -> str:
    try:
        dt = datetime.datetime.strptime(ymd, "%Y-%m-%d")
    except ValueError:
        dt = datetime.datetime.now()
    return dt.strftime("%a, %d %b %Y 09:00:00 +0900")


def build_item(post, kind):
    slug = post.get("slug", "")
    title = post.get("title_ja", "").strip()
    excerpt = post.get("excerpt_ja", "").strip()
    if not excerpt:
        excerpt = "コンテンツ制作のContentsXが発信する記事はサイトでご覧ください。"
    date_ymd = post.get("date_ymd") or post.get("modified_ymd", "2026-01-01")
    thumbnail = post.get("thumbnail", "")
    category = post.get("category", "コラム")

    if kind == "column":
        url = f"{SITE_URL}/column/{slug}"
    elif kind == "news":
        url = f"{SITE_URL}/news-detail?id={post.get('id')}"
    else:
        url = SITE_URL

    return f"""    <item>
      <title>{xml_escape(title)}</title>
      <link>{url}</link>
      <guid isPermaLink="true">{url}</guid>
      <pubDate>{rfc822(date_ymd)}</pubDate>
      <category>{xml_escape(category)}</category>
      <description>{xml_escape(excerpt)}</description>
      {'<enclosure url="' + thumbnail + '" type="image/webp" />' if thumbnail else ''}
    </item>"""


def main():
    # コラム取得（show_site=both or contentsx 両方）
    columns = fetch_json(f"{API_BASE}/columns?per_page=50")
    print(f"コラム: {len(columns)}件取得")

    # ニュース取得
    try:
        news_items = fetch_json(f"{API_BASE}/news?per_page=20")
        print(f"ニュース: {len(news_items)}件取得")
    except Exception as e:
        print(f"ニュース取得失敗（スキップ）: {e}")
        news_items = []

    all_items = []
    for c in columns:
        all_items.append(("column", c, c.get("modified_ymd") or c.get("date_ymd", "")))
    for n in news_items:
        all_items.append(("news", n, n.get("date_ymd", "")))
    all_items.sort(key=lambda x: x[2], reverse=True)
    all_items = all_items[:30]

    build_time = datetime.datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0900")
    items_xml = "\n".join(build_item(post, kind) for kind, post, _ in all_items)

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>{SITE_NAME} コラム・ニュース</title>
    <link>{SITE_URL}/</link>
    <description>「伝える」を再発明するコンテンツ制作会社 {SITE_NAME} が発信する、マンガ・Webtoon・動画・IP開発に関するノウハウ・事例・最新情報。</description>
    <language>ja</language>
    <copyright>© Contents X 株式会社</copyright>
    <lastBuildDate>{build_time}</lastBuildDate>
    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>{SITE_URL}/material/images/logo/ContentsX.webp</url>
      <title>{SITE_NAME}</title>
      <link>{SITE_URL}/</link>
    </image>
{items_xml}
  </channel>
</rss>
"""

    OUT_PATH.write_text(rss_xml, encoding="utf-8")
    print(f"✓ {OUT_PATH.relative_to(ROOT)} 生成完了（{len(all_items)}件）")


if __name__ == "__main__":
    sys.exit(main() or 0)
