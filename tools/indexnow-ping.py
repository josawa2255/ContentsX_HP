#!/usr/bin/env python3
"""IndexNow ping for ContentsX. 変更URLをBing/Yandexへ通知。

既定は HEAD~1..HEAD の差分。static.yml は公開の成功後に「前回デプロイしたコミット..今回」の範囲を渡す
（--base / --head）。自動ビルドの変更も、待機中のデプロイが置き換えられた場合も取りこぼさない。
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.request

HOST = "contentsx.jp"
KEY = "d3aa5088bd3c49f988a9c1ead3f8206a"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"

def get_changed_urls(base="HEAD~1", head="HEAD"):
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", base, head],
            text=True
        )
    except subprocess.CalledProcessError:
        return []
    urls = []
    for f in out.splitlines():
        f = f.strip()
        if not re.search(r"\.(html|xml|txt)$", f):
            continue
        if f == "index.html":
            urls.append(f"https://{HOST}/")
        elif f.endswith(".html"):
            slug = f[:-5]
            urls.append(f"https://{HOST}/{slug}")
        elif f in ("sitemap.xml", "llms.txt", "robots.txt"):
            urls.append(f"https://{HOST}/{f}")
    return list(dict.fromkeys(urls))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="HEAD~1")
    ap.add_argument("--head", default="HEAD")
    args = ap.parse_args()
    urls = get_changed_urls(args.base, args.head)
    if not urls:
        print("No relevant URL changes.")
        return 0
    if len(urls) > 10000:
        urls = urls[:10000]

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/IndexNow",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"IndexNow status={resp.status} urls={len(urls)}")
    except Exception as e:
        print(f"IndexNow error: {e}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
