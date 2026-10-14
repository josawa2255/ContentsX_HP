#!/usr/bin/env python3
"""contentsx.jp の改ざん・乗っ取りの兆候を点検する（2026-10-14、.github/workflows/security-monitor.yml から1時間ごと）。

異常があれば終了コード1 → GitHub がワークフローの失敗をメールで知らせる。
標準ライブラリだけで動く。基準値は tools/security/expected.json。

点検すること:
  1. 本番の HTML / CSS / JS / XML / TXT が、最後に成功したデプロイのコミットと1バイト違わず同じか（改ざん）
  2. 本番の HTML が読み込む外部スクリプト・iframe のホストが許可リストの中か（不正なスクリプトの差し込み）
  3. 内部資料が本番から取得できないか（公開範囲の後退）
  4. DNS（NS / A / CNAME / MX / CAA）が基準値と同じか（ドメイン・DNSの乗っ取り）
  5. TLS 証明書の残り日数
  6. GitHub Pages の独自ドメイン・HTTPS 強制、main への PR を通らない push（リポジトリの乗っ取り）
  7. WordPress で閉じた入口が開いていないか（expected.json で true にした項目だけ。WP 側の後退）

Usage:
  python3 tools/security/monitor.py --site-dir _site            # 点検（異常で exit 1）
  python3 tools/security/monitor.py --site-dir _site --report   # 記録だけ（常に exit 0。基準値づくり用）
"""
import argparse
import hashlib
import json
import os
import re
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / "tools" / "security" / "expected.json").read_text(encoding="utf-8"))
UA = "ContentsX-SecurityMonitor/1.0 (+https://github.com/josawa2255/ContentsX_HP)"
TEXT_EXT = {".html", ".css", ".js", ".xml", ".txt", ".json"}
DNS_QUERIES = [
    ("contentsx.jp", "NS"), ("contentsx.jp", "A"), ("contentsx.jp", "AAAA"), ("contentsx.jp", "MX"),
    ("contentsx.jp", "CAA"), ("www.contentsx.jp", "CNAME"), ("bizmanga.contentsx.jp", "CNAME"),
    ("cms.contentsx.jp", "A"), ("cms.contentsx.jp", "CNAME"),
]

problems, warnings, notes = [], [], []


def http(url, method="GET", data=None, headers=None, timeout=20):
    h = {"User-Agent": UA, "Cache-Control": "no-cache"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", dict(e.headers or {})
    except Exception as e:  # noqa: BLE001 — 通信の失敗も記録して続ける
        return 0, str(e).encode(), {}


def github(path):
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        return None, None
    status, body, _ = http(f"https://api.github.com/repos/{repo}{path}",
                           headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    try:
        return status, json.loads(body or b"null")
    except ValueError:
        return status, None


# ---------- 1〜3. 本番の内容 ----------
class TagHosts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hosts = set()

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "iframe"):
            src = dict(attrs).get("src") or ""
            u = urlsplit(src if not src.startswith("//") else "https:" + src)
            if u.netloc:
                self.hosts.add(u.netloc.lower())


def check_content(site_dir):
    site = EXPECTED["site"]
    def served(p):
        parts = p.relative_to(site_dir).parts
        return not any(x.startswith(".") for x in parts) and parts[0] != "tools"
    files = sorted(p for p in Path(site_dir).rglob("*") if p.is_file() and p.suffix.lower() in TEXT_EXT and served(p))
    if not files:
        problems.append(f"点検対象のファイルが見つからない: {site_dir}")
        return
    mismatched = []
    for p in files:
        rel = p.relative_to(site_dir).as_posix()
        status, body, _ = http(f"{site}/{quote(rel)}")
        if status != 200 or hashlib.sha256(body).digest() != hashlib.sha256(p.read_bytes()).digest():
            mismatched.append((rel, status))
        if rel.endswith(".html") and status == 200:
            parser = TagHosts()
            parser.feed(body.decode("utf-8", "replace"))
            unknown = sorted(parser.hosts - set(EXPECTED["script_hosts"]) - {"contentsx.jp", "www.contentsx.jp"})
            if unknown:
                problems.append(f"許可していない外部スクリプト/iframe: {rel} → {', '.join(unknown)}")
    if mismatched:
        # デプロイの切り替わり中かもしれないので、少し待って違ったものだけ取り直す
        time.sleep(90)
        still = []
        for rel, _ in mismatched:
            status, body, _ = http(f"{site}/{quote(rel)}")
            local = (Path(site_dir) / rel).read_bytes()
            if status != 200 or hashlib.sha256(body).digest() != hashlib.sha256(local).digest():
                still.append(f"{rel} (HTTP {status})")
        if still:
            problems.append(f"本番の内容がデプロイしたコミットと違う（改ざんの可能性）: {len(still)}件 — " + ", ".join(still[:15]))
    notes.append(f"本番の内容: {len(files)}ファイルを照合")


def check_hidden():
    site = EXPECTED["site"]
    leaked = []
    for rel in EXPECTED["must_be_hidden"]:
        status, _, _ = http(f"{site}/{quote(rel)}")
        if status == 200:
            leaked.append(rel)
    if leaked:
        problems.append("内部資料が本番から取得できる: " + ", ".join(leaked))


# ---------- 4. DNS ----------
def dig(name, rtype):
    try:
        out = subprocess.run(["dig", "+short", "+time=5", "+tries=2", name, rtype, "@1.1.1.1"],
                             capture_output=True, text=True, timeout=30).stdout
    except Exception as e:  # noqa: BLE001
        return None, str(e)
    vals = sorted({line.strip().rstrip(".").lower() for line in out.splitlines() if line.strip() and not line.startswith(";")})
    # A / AAAA の問い合わせでは途中の CNAME も返るので、アドレスだけ残す
    if rtype == "A":
        vals = [v for v in vals if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", v)]
    elif rtype == "AAAA":
        vals = [v for v in vals if ":" in v]
    return vals, None


def check_dns(report):
    expected = EXPECTED.get("dns", {})
    current = {}
    for name, rtype in DNS_QUERIES:
        vals, err = dig(name, rtype)
        key = f"{name} {rtype}"
        if vals is None:
            warnings.append(f"DNS を引けない: {key} ({err})")
            continue
        current[key] = vals
        if key not in expected:
            warnings.append(f"DNS の基準値が未登録: {key} = {vals}")
        elif sorted(expected[key]) != vals:
            problems.append(f"DNS が基準値と違う（乗っ取り・誤設定の可能性）: {key} 基準={expected[key]} 現在={vals}")
    if report or any("基準値が未登録" in w for w in warnings):
        notes.append("現在の DNS（expected.json の dns に貼る値）:\n```json\n" + json.dumps(current, ensure_ascii=False, indent=2) + "\n```")


# ---------- 5. TLS ----------
def check_tls():
    ctx = ssl.create_default_context()
    for host in EXPECTED["tls_hosts"]:
        try:
            with socket.create_connection((host, 443), timeout=15) as sock, ctx.wrap_socket(sock, server_hostname=host) as s:
                not_after = s.getpeercert()["notAfter"]
            days = (datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                    - datetime.now(timezone.utc)).days
            if days < 14:
                problems.append(f"TLS 証明書の残りが {days} 日: {host}")
            elif days < 30:
                warnings.append(f"TLS 証明書の残りが {days} 日: {host}")
        except Exception as e:  # noqa: BLE001
            problems.append(f"HTTPS で接続できない・証明書が不正: {host} ({e})")


# ---------- 6. GitHub ----------
def check_github():
    exp = EXPECTED["github"]
    status, pages = github("/pages")
    if status is None:
        warnings.append("GITHUB_TOKEN が無いので GitHub の点検を省略")
        return
    if status == 200 and isinstance(pages, dict):
        if (pages.get("cname") or "") != exp["pages_cname"]:
            problems.append(f"GitHub Pages の独自ドメインが変わった: {pages.get('cname')}")
        if exp["pages_https_enforced"] and not pages.get("https_enforced"):
            problems.append("GitHub Pages の HTTPS 強制が外れている")
    else:
        warnings.append(f"GitHub Pages の設定を読めない (HTTP {status})")
    since = datetime.fromtimestamp(time.time() - 26 * 3600, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status, commits = github(f"/commits?sha=main&since={since}&per_page=100")
    if status != 200 or not isinstance(commits, list):
        warnings.append(f"main のコミットを読めない (HTTP {status})")
        return
    for c in commits:
        login = ((c.get("author") or {}).get("login") or (c.get("commit", {}).get("author") or {}).get("name") or "?")
        if login in exp["direct_push_allowed"]:
            continue
        s2, pulls = github(f"/commits/{c['sha']}/pulls")
        if s2 == 200 and isinstance(pulls, list) and not pulls:
            problems.append(f"PR を通らずに main へ入ったコミット: {c['sha'][:7]} by {login} — {c['commit']['message'].splitlines()[0][:80]}")


# ---------- 7. WordPress ----------
def check_wordpress():
    wp = EXPECTED["wordpress"]
    api = wp["api"]
    status, body, _ = http(f"{api}/wp-json/wp/v2/users")
    if wp.get("users_endpoint_closed") and status == 200 and body.strip().startswith(b"["):
        problems.append("WordPress のユーザー一覧APIが開いている（管理者名が取得できる）")
    if wp.get("xmlrpc_closed"):
        status, _, _ = http(f"{api}/xmlrpc.php", method="POST",
                            data=b"<?xml version='1.0'?><methodCall><methodName>system.listMethods</methodName></methodCall>",
                            headers={"Content-Type": "text/xml"})
        if status == 200:
            problems.append("WordPress の xmlrpc.php が開いている")
    if wp.get("cors_localhost_removed"):
        _, _, headers = http(f"{api}/wp-json/contentsx/v1/topics", headers={"Origin": "http://localhost:3000"})
        if any(k.lower() == "access-control-allow-origin" and "localhost" in v for k, v in headers.items()):
            problems.append("WordPress の CORS が localhost を許可している")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-dir", default=str(ROOT / "_site"))
    ap.add_argument("--report", action="store_true", help="記録だけ。異常があっても exit 0")
    args = ap.parse_args()
    for fn in (lambda: check_content(args.site_dir), check_hidden, lambda: check_dns(args.report),
               check_tls, check_github, check_wordpress):
        try:
            fn()
        except Exception as e:  # noqa: BLE001 — 1つの点検の失敗で他を止めない。失敗自体は異常扱い
            problems.append(f"点検そのものが失敗: {getattr(fn, '__name__', fn)}: {e}")
    lines = ["## セキュリティ点検 " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")]
    lines += ["### ❌ 異常"] + [f"- {p}" for p in problems] if problems else ["### ✅ 異常なし"]
    if warnings:
        lines += ["### ⚠️ 注意（未対応の既知事項・基準値の未登録など）"] + [f"- {w}" for w in warnings]
    lines += ["### 記録"] + [f"- {n}" for n in notes]
    out = "\n".join(lines)
    print(out)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(out + "\n")
    return 1 if problems and not args.report else 0


if __name__ == "__main__":
    sys.exit(main())
