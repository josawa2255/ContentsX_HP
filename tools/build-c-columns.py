#!/usr/bin/env python3
"""ContentsX 静的コラム生成ツール
WP API から全コラムを取得し、SEO最適化された静的HTMLを ContentX/column/{slug}.html に生成。

Usage:
  python3 tools/build-c-columns.py
  python3 tools/build-c-columns.py --slug manga-marketing-btob-guide  # 単一slug
"""
import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://cms.contentsx.jp/wp-json/contentsx/v1"
SITE = "https://contentsx.jp"
ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "tools" / "templates" / "c-column.html.tpl"
OUT_DIR = ROOT / "column"
LISTING_PATH = ROOT / "column.html"


def fetch_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "ContentsX-BuildBot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_columns_list():
    """ContentsX 表示対象のコラム一覧を取得 (show_site=contentx または both)"""
    return fetch_json(f"{API_BASE}/columns?site=contentx&per_page=100")


def fetch_column_full(col_id):
    """単一コラムの本文付きデータを取得"""
    return fetch_json(f"{API_BASE}/columns/{col_id}")


def truncate_desc(text, length=120):
    """meta description用に本文から装飾を除去して切り詰め"""
    clean = re.sub(r"<[^>]+>", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    if len(clean) > length:
        clean = clean[: length - 1] + "…"
    return clean


def escape_meta(s):
    """meta属性値のエスケープ"""
    return html.escape(s, quote=True)


def build_related_cards(current_id, all_cols, category):
    """同一カテゴリから最大3本の関連記事カードHTMLを生成"""
    related = [c for c in all_cols if c["id"] != current_id and c.get("category") == category]
    # 足りなければ他カテゴリから補充
    if len(related) < 3:
        others = [c for c in all_cols if c["id"] != current_id and c.get("category") != category]
        related.extend(others[: 3 - len(related)])
    related = related[:3]

    cards = []
    for c in related:
        slug = c.get("slug", "")
        title = escape_meta(c.get("title_ja", "").strip())
        cat = escape_meta(c.get("category", ""))
        thumb = c.get("thumbnail", "")
        cards.append(f"""      <a href="/column/{slug}" class="cx-col-related-card">
        <div class="cx-col-related-card-img"><img src="{thumb}" alt="{title}" loading="lazy" width="400" height="225"></div>
        <div class="cx-col-related-card-body">
          <div class="cx-col-related-card-cat">{cat}</div>
          <div class="cx-col-related-card-title">{title}</div>
        </div>
      </a>""")
    return "\n".join(cards)


def build_one(col, all_cols, template):
    """1コラムの静的HTMLを生成"""
    col_id = col["id"]
    full = fetch_column_full(col_id)
    slug = full.get("slug", "")
    title = full.get("title_ja", "").strip()
    title_en = full.get("title_en", "").strip()
    excerpt = full.get("excerpt_ja", "").strip()
    content_html = full.get("content", "") or ""
    category = full.get("category", "コラム")
    thumbnail = full.get("thumbnail", "https://contentsx.jp/material/images/og/og-index.webp")
    date_ymd = full.get("date_ymd", "2026-01-01")
    modified_ymd = full.get("modified_ymd", date_ymd)
    date_display = full.get("date", date_ymd).replace("-", ".")

    # タイトルを短縮（SEO用）
    title_short = title if len(title) <= 60 else title[:58] + "…"
    # SEO タイトル（末尾にブランド）
    seo_title = f"{title_short}｜ContentsX"
    if len(seo_title) > 72:
        seo_title = f"{title[:50]}…｜ContentsX"

    # description: excerpt優先、なければ本文先頭から
    desc = excerpt or truncate_desc(content_html, 110)
    if len(desc) > 130:
        desc = desc[:128] + "…"

    # ISO 日付
    date_iso = f"{date_ymd}T09:00:00+09:00"
    modified_iso = f"{modified_ymd}T09:00:00+09:00"

    # Content: WP側のHTMLをそのまま注入（既にsanitize済み前提）
    content = content_html

    # 関連記事カード
    related_cards = build_related_cards(col_id, all_cols, category)

    # プレースホルダ置換
    replacements = {
        "{{TITLE}}": escape_meta(seo_title),
        "{{TITLE_SHORT}}": escape_meta(title_short),
        "{{DESCRIPTION}}": escape_meta(desc),
        "{{SLUG}}": slug,
        "{{CATEGORY}}": escape_meta(category),
        "{{THUMBNAIL}}": thumbnail,
        "{{DATE_PUBLISHED}}": date_iso,
        "{{DATE_MODIFIED}}": modified_iso,
        "{{DATE_DISPLAY}}": date_display,
        "{{CONTENT}}": content,
        "{{RELATED_CARDS}}": related_cards,
    }

    output = template
    for key, value in replacements.items():
        output = output.replace(key, str(value))

    return slug, output


def build_card(col):
    """1枚分のカードHTMLを生成 (column.html のグリッド用)"""
    slug = col.get("slug", "")
    title = escape_meta(col.get("title_ja", "").strip())
    excerpt = escape_meta(col.get("excerpt_ja", "").strip())
    cat = escape_meta(col.get("category", "コラム"))
    thumb = col.get("thumbnail", "https://contentsx.jp/material/images/og/og-index.webp")
    date_display = col.get("date", col.get("date_ymd", "")).replace("-", ".")
    return f"""          <a class="cx-col-card" href="/column/{slug}" data-category="{cat}">
            <div class="cx-col-card-img"><img src="{thumb}" alt="{title}" loading="lazy" width="400" height="225"></div>
            <div class="cx-col-card-body">
              <span class="cx-col-card-cat">{cat}</span>
              <h3 class="cx-col-card-title">{title}</h3>
              <p class="cx-col-card-meta">{date_display}</p>
            </div>
          </a>
"""


def update_column_listing(columns):
    """column.html のグリッド・カテゴリ・Featured・JSON-LD を再生成"""
    if not LISTING_PATH.exists():
        print(f"SKIP: {LISTING_PATH} not found")
        return
    s = LISTING_PATH.read_text(encoding="utf-8")

    # 日付降順 (date_ymd)
    sorted_cols = sorted(columns, key=lambda c: c.get("date_ymd", ""), reverse=True)
    featured = sorted_cols[0] if sorted_cols else None
    rest = sorted_cols[1:] if featured else sorted_cols

    # カードHTML
    cards = "".join(build_card(c) for c in rest)
    start = "<!-- BUILD:COLUMN_GRID -->"
    end = "<!-- /BUILD:COLUMN_GRID -->"
    block = f"{start}\n{cards}          {end}"
    pattern = re.compile(re.escape(start) + r"[\s\S]*?" + re.escape(end))
    if pattern.search(s):
        s = pattern.sub(block, s)

    # カテゴリ集計
    cat_counts = {}
    for c in sorted_cols:
        k = c.get("category") or "その他"
        cat_counts[k] = cat_counts.get(k, 0) + 1
    sorted_cats = sorted(
        [{"name": k, "count": v} for k, v in cat_counts.items()],
        key=lambda x: (x["name"] == "その他", -x["count"]),
    )

    # cx-column-data JSON
    data_payload = {
        "total": len(sorted_cols),
        "categories": sorted_cats,
        "featured": {
            "slug": featured.get("slug", ""),
            "title": featured.get("title_ja", ""),
            "excerpt": featured.get("excerpt_ja", ""),
            "thumbnail": featured.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp",
            "category": featured.get("category") or "",
            "date": featured.get("date", ""),
        } if featured else None,
    }
    data_tag = (
        '<script type="application/json" id="cx-column-data">\n'
        + json.dumps(data_payload, ensure_ascii=False, indent=2)
        + "\n</script>"
    )
    data_pattern = re.compile(
        r'<script type="application/json" id="cx-column-data">[\s\S]*?</script>'
    )
    if data_pattern.search(s):
        s = data_pattern.sub(data_tag, s)

    # ItemList JSON-LD
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "ContentsX コラム一覧",
        "numberOfItems": len(sorted_cols),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i,
                "url": f"{SITE}/column/{c.get('slug', '')}",
                "name": c.get("title_ja") or str(c.get("id")),
            }
            for i, c in enumerate(sorted_cols, start=1)
        ],
    }
    ld_tag = (
        '<script type="application/ld+json" id="column-itemlist-ld">\n'
        + json.dumps(ld, ensure_ascii=False, indent=2)
        + "\n</script>"
    )
    ld_pattern = re.compile(
        r'<script type="application/ld\+json" id="column-itemlist-ld">[\s\S]*?</script>'
    )
    if ld_pattern.search(s):
        s = ld_pattern.sub(ld_tag, s)

    LISTING_PATH.write_text(s, encoding="utf-8")
    print(f"  ✓ {LISTING_PATH.relative_to(ROOT)} 更新（{len(sorted_cols)}本・{len(sorted_cats)}カテゴリ）")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help="特定 slug のみ再生成", default=None)
    parser.add_argument("--dry-run", action="store_true", help="ファイル書き込みせず出力のみ")
    parser.add_argument("--skip-listing", action="store_true", help="column.html 一覧の更新をスキップ")
    args = parser.parse_args()

    if not TEMPLATE_PATH.exists():
        print(f"ERROR: テンプレート未設置 {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("→ WP API からコラム一覧を取得中...")
    all_cols = fetch_columns_list()
    print(f"  {len(all_cols)}件のコラムを発見")

    if args.slug:
        all_cols_filtered = [c for c in all_cols if c.get("slug") == args.slug]
        if not all_cols_filtered:
            print(f"ERROR: slug '{args.slug}' が見つかりません", file=sys.stderr)
            sys.exit(1)
        targets = all_cols_filtered
    else:
        targets = all_cols

    generated = []
    for col in targets:
        try:
            slug, html_out = build_one(col, all_cols, template)
            out_path = OUT_DIR / f"{slug}.html"
            if args.dry_run:
                print(f"  [dry-run] {out_path.relative_to(ROOT)}  ({len(html_out)} chars)")
            else:
                out_path.write_text(html_out, encoding="utf-8")
                print(f"  ✓ {out_path.relative_to(ROOT)}  ({len(html_out)} chars)")
            generated.append(slug)
        except Exception as e:
            print(f"  × {col.get('slug', col.get('id'))}: {e}", file=sys.stderr)

    print(f"\n{len(generated)}本生成完了")

    # 一覧ページ更新（slug指定なし、dry-runでなく、skipされていない場合）
    if not args.slug and not args.dry_run and not args.skip_listing:
        print("\n→ column.html (一覧) を更新中...")
        update_column_listing(all_cols)

    return 0


if __name__ == "__main__":
    sys.exit(main())
