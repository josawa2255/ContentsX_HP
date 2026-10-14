"""公開ファイルの絞り込み（tools/build-site-artifact.py）の検査。デプロイ前に実行する。
- 内部資料（md・skill・docx・スクリプト・テスト・試作）が公開対象に入っていない
- 公開する HTML / CSS が参照するサイト内ファイルが、公開対象から漏れていない
python3 -m unittest discover -s tests -p test_site_artifact.py"""
import importlib.util
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_site_artifact", ROOT / "tools" / "build-site-artifact.py")
bsa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsa)

TRACKED = bsa.tracked_files()
PUBLIC = {f for f in TRACKED if bsa.is_public(f)}
REF = re.compile(r'''(?:src|href|poster|content)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)''', re.I)


TRACKED_SET = set(TRACKED)


def resolves(path, files=None):
    """GitHub Pages と同じ解決: /a → a.html / a/index.html、/a/ → a/index.html"""
    files = PUBLIC if files is None else files
    p = path.lstrip("/")
    if p == "" or p.endswith("/"):
        return (p + "index.html") in files
    return p in files or (p + ".html") in files or (p + "/index.html") in files


class SiteArtifact(unittest.TestCase):
    def test_internal_files_are_not_public(self):
        leaked = sorted(f for f in PUBLIC if re.search(
            r"\.(md|skill|docx|py|pyc|tpl|sh|ya?ml|ai|json)$", f) and f not in bsa.ALLOWED_FILES)
        self.assertEqual(leaked, [])
        for must_hide in ("CLAUDE.md", "SPEC.md", "github.md", "hirasawa_HP_infrastructure.skill",
                          "contentsx-complete-kb.skill", "tools/build-c-columns.py", "data/services.json",
                          "wordpress/SETUP.md", "tests/sitewide_check.py"):
            self.assertNotIn(must_hide, PUBLIC)

    def test_pages_and_assets_are_public(self):
        for must_show in ("index.html", "404.html", "robots.txt", "sitemap.xml", "feed.xml", "llms.txt",
                          "manifest.json", "i18n/en.json", "favicon.ico", "js/i18n.js", "css/style.css",
                          "services/index.html", "bizmanga/robots.txt"):
            self.assertIn(must_show, PUBLIC)

    def test_external_script_hosts_are_allowed(self):
        """本番の監視（tools/security/monitor.py）と同じ許可リスト。足すときは expected.json も直す"""
        import json
        allowed = set(json.loads((ROOT / "tools" / "security" / "expected.json").read_text(encoding="utf-8"))["script_hosts"])
        tag = re.compile(r'<(?:script|iframe)\b[^>]*\bsrc\s*=\s*["\']((?:https?:)?//[^/"\']+)', re.I)
        unknown = set()
        for rel in sorted(PUBLIC):
            if rel.endswith(".html"):
                for m in tag.finditer((ROOT / rel).read_text(encoding="utf-8", errors="ignore")):
                    host = urlsplit(m.group(1) if not m.group(1).startswith("//") else "https:" + m.group(1)).netloc.lower()
                    if host not in allowed and host not in ("contentsx.jp", "www.contentsx.jp"):
                        unknown.add(f"{rel}: {host}")
        self.assertEqual(sorted(unknown), [], "tools/security/expected.json の script_hosts に追加してください")

    def test_local_references_resolve(self):
        missing = set()
        for rel in sorted(PUBLIC):
            if not rel.endswith((".html", ".css")):
                continue
            text = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
            base = "/" + rel.rsplit("/", 1)[0] + "/" if "/" in rel else "/"
            for m in REF.finditer(text):
                ref = (m.group(1) or m.group(2) or "").strip()
                if not ref or ref.startswith(("data:", "mailto:", "tel:", "javascript:", "{{", "$", "+")):
                    continue
                u = urlsplit(ref)
                if u.scheme or u.netloc:
                    if u.netloc not in ("contentsx.jp", "www.contentsx.jp"):
                        continue
                    path = u.path
                elif ref.startswith("/"):
                    path = u.path
                else:
                    if rel.endswith(".css"):
                        path = base + u.path
                    else:
                        path = "/" + u.path       # HTML は相対パスでも全ページ直下想定（既存の書き方）
                path = unquote(re.sub(r"/\./", "/", path))
                while "/../" in path:
                    path = re.sub(r"/[^/]+/\.\./", "/", path, count=1)
                # 公開の絞り込みで欠けたものだけを問題にする（リポジトリにも無い参照は対象外）
                if not resolves(path) and resolves(path, TRACKED_SET):
                    missing.add(f"{rel} -> {ref}")
        self.assertEqual(sorted(missing), [])


if __name__ == "__main__":
    unittest.main()
