"""公開ファイルの絞り込み（tools/build-site-artifact.py）の検査。デプロイ前に実行する。
- 内部資料（md・skill・docx・スクリプト・テスト・試作）が公開対象に入っていない
- 公開する HTML / CSS が参照するサイト内ファイルが、公開対象から漏れていない
- 外部スクリプト・iframe のホストが、本番の監視（tools/security/monitor.py）と同じ許可リストの中
python3 -m unittest discover -s tests -p test_site_artifact.py"""
import importlib.util
import posixpath
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bsa = load("build_site_artifact", "tools/build-site-artifact.py")
monitor = load("security_monitor", "tools/security/monitor.py")   # 監視と同じ許可リスト・同じ判定を使う

CANDIDATES = bsa.tracked_files()
CANDIDATE_SET = set(CANDIDATES)
PUBLIC = {f for f in CANDIDATES if bsa.is_public(f)}
REF = re.compile(r'''(?:src|href|poster|content)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)''', re.I)


def resolves(path, files=None):
    """GitHub Pages と同じ解決: /a → a / a.html / a/index.html、/a/ → a/index.html"""
    files = PUBLIC if files is None else files
    p = path.lstrip("/")
    if p == "" or p.endswith("/"):
        return (p + "index.html") in files
    return p in files or (p + ".html") in files or (p + "/index.html") in files


def site_path(page, ref):
    """ページ内の参照をサイトのパスにする。相対参照はそのページの場所から解決する（ブラウザと同じ）"""
    u = urlsplit(ref)
    if u.scheme or u.netloc:
        return u.path if u.netloc in ("contentsx.jp", "www.contentsx.jp") else None
    if u.path.startswith("/"):
        path = u.path
    else:
        path = posixpath.join("/" + posixpath.dirname(page), u.path)
    norm = posixpath.normpath(unquote(path))
    return norm + "/" if path.endswith("/") and norm != "/" else norm


class SiteArtifact(unittest.TestCase):
    def test_internal_files_are_not_public(self):
        leaked = sorted(f for f in PUBLIC if re.search(
            r"\.(md|skill|docx|py|pyc|tpl|sh|ya?ml|ai|json|jsonl)$", f) and f not in bsa.ALLOWED_FILES)
        self.assertEqual(leaked, [])
        for must_hide in monitor.EXPECTED["must_be_hidden"]:
            self.assertNotIn(must_hide, PUBLIC)

    def test_pages_and_assets_are_public(self):
        for must_show in ("index.html", "404.html", "robots.txt", "sitemap.xml", "feed.xml", "llms.txt",
                          "manifest.json", "i18n/en.json", "favicon.ico", "js/i18n.js", "css/style.css",
                          "services/index.html", "bizmanga/robots.txt"):
            self.assertIn(must_show, PUBLIC)

    def test_external_script_hosts_are_allowed(self):
        """足すときは tools/security/expected.json の script_hosts も直す（直さないと毎時の監視が失敗する）"""
        allowed = set(monitor.EXPECTED["script_hosts"]) | {"contentsx.jp", "www.contentsx.jp"}
        unknown = set()
        for rel in sorted(PUBLIC):
            if rel.endswith(".html"):
                parser = monitor.TagHosts()
                parser.feed((ROOT / rel).read_text(encoding="utf-8", errors="ignore"))
                unknown |= {f"{rel}: {h}" for h in parser.hosts - allowed}
        self.assertEqual(sorted(unknown), [])

    def test_site_path_resolution(self):
        self.assertEqual(site_path("index.html", "../css/x.css"), "/css/x.css")       # ルートより上には出ない
        self.assertEqual(site_path("services/a/index.html", "img/h.webp"), "/services/a/img/h.webp")
        self.assertEqual(site_path("css/style.css", "../material/a.webp"), "/material/a.webp")
        self.assertEqual(site_path("column/x.html", "/js/a.js"), "/js/a.js")
        self.assertIsNone(site_path("index.html", "https://example.com/a.js"))

    def test_local_references_resolve(self):
        missing = set()
        for rel in sorted(PUBLIC):
            if not rel.endswith((".html", ".css")):
                continue
            text = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
            for m in REF.finditer(text):
                ref = (m.group(1) or m.group(2) or "").strip()
                if not ref or ref.startswith(("data:", "mailto:", "tel:", "javascript:", "{{", "$", "+")):
                    continue
                path = site_path(rel, ref)
                # 公開の絞り込みで欠けたものだけを問題にする（リポジトリにも無い参照は対象外）
                if path and not resolves(path) and resolves(path, CANDIDATE_SET):
                    missing.add(f"{rel} -> {ref}")
        self.assertEqual(sorted(missing), [])


if __name__ == "__main__":
    unittest.main()
