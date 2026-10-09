#!/usr/bin/env python3
"""Check canonical shared UI markup and responsive CSS wiring.

Pure stdlib. Run locally or in CI:
    python3 tools/check-shared-ui.py

This cannot replace real-device visual testing.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_FOOTER = "services/index.html"
CORE_PAGES = (
    "index.html",
    "about.html",
    "company.html",
    "message.html",
    "recruit.html",
    "contact.html",
    "news.html",
    "news-detail.html",
    "column.html",
    "faq.html",
    "services/index.html",
    "services/sales-x/index.html",
    "services/creative-x/index.html",
    "tools/templates/c-column.html.tpl",
)
FOOTER_RE = re.compile(r'<footer class="cx-footer">[\s\S]*?</footer>')
HEADER_RE = re.compile(r'<header\b[^>]*class=["\'][^"\']*\bheader\b', re.IGNORECASE)
VIEWPORT_RE = re.compile(r'name=["\']viewport["\']', re.IGNORECASE)
BASE_CSS_RE = re.compile(r'href=["\']/?css/style\.css["\']', re.IGNORECASE)


def canonicalize(markup: str) -> str:
    """Ignore indentation/line wrapping while retaining attributes and text."""
    return re.sub(r"\s+", " ", markup).strip()


def check() -> list[str]:
    errors: list[str] = []

    for css_path in ("css/style.css", "css/brand-system-2026.css", "css/site-footer.css"):
        if not (ROOT / css_path).is_file():
            errors.append(f"Missing shared style: {css_path}")

    root_style = ROOT / "css/style.css"
    if root_style.is_file():
        contents = root_style.read_text(encoding="utf-8")
        if "@import url('/css/brand-system-2026.css');" not in contents:
            errors.append("css/style.css must import canonical brand-system-2026.css")

    brand = ROOT / "css/brand-system-2026.css"
    if brand.is_file():
        css = brand.read_text(encoding="utf-8")
        for token in (
            "--cx-rsp-gutter",
            "--cx-rsp-section-space",
            "--cx-rsp-section-title",
            "--cx-rsp-card-title",
            "--cx-rsp-body",
            "--cx-rsp-meta",
            "--cx-rsp-touch-target",
        ):
            if token not in css:
                errors.append(f"Missing responsive token {token} in brand CSS")

    canonical_file = ROOT / CANONICAL_FOOTER
    if not canonical_file.is_file():
        errors.append(f"Missing footer source {CANONICAL_FOOTER}")
        canonical_footer = None
    else:
        match = FOOTER_RE.search(canonical_file.read_text(encoding="utf-8"))
        canonical_footer = canonicalize(match.group()) if match else None
        if canonical_footer is None:
            errors.append(f"Canonical footer not found in {CANONICAL_FOOTER}")

    for relative in CORE_PAGES:
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"Missing required page/template: {relative}")
            continue
        source = path.read_text(encoding="utf-8")
        if not VIEWPORT_RE.search(source):
            errors.append(f"{relative}: missing viewport meta")
        if not BASE_CSS_RE.search(source):
            errors.append(f"{relative}: missing shared css/style.css")
        if not HEADER_RE.search(source):
            errors.append(f"{relative}: missing common header")
        if "site-footer.css" not in source:
            errors.append(f"{relative}: missing shared site-footer.css")
        match = FOOTER_RE.search(source)
        if not match:
            errors.append(f"{relative}: missing .cx-footer")
        elif canonical_footer and canonicalize(match.group()) != canonical_footer:
            errors.append(f"{relative}: footer differs from {CANONICAL_FOOTER}")

    # All generated service detail pages should use the same footer template.
    for path in sorted((ROOT / "services").glob("*/index.html")):
        relative = path.relative_to(ROOT).as_posix()
        if relative in CORE_PAGES:
            continue
        source = path.read_text(encoding="utf-8")
        if "site-footer.css" not in source:
            errors.append(f"{relative}: missing site-footer.css")
        match = FOOTER_RE.search(source)
        if not match:
            errors.append(f"{relative}: missing .cx-footer")
        elif canonical_footer and canonicalize(match.group()) != canonical_footer:
            errors.append(f"{relative}: footer differs from {CANONICAL_FOOTER}")

    return errors


def main() -> int:
    problems = check()
    if problems:
        print("FAIL shared UI consistency:")
        for problem in problems:
            print(" - " + problem)
        return 1
    print("PASS shared UI consistency: common header/footer, viewport, and design tokens")
    return 0


if __name__ == "__main__":
    sys.exit(main())
