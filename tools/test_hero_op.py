"""
ContentsX トップページ OP（イントロオーバーレイ）回帰テスト

目的: hero中央ロゴやタグライン等の周辺変更で OP 演出が壊れないことを保証。
    2026-04-19 hero画像ロゴ化でOP体感が変わる事案があり、再発防止として追加。

参照: ~/.claude/skills/webapp-testing/SKILL.md

実行（cwd は ContentX/ 直下）:
    PYTHONUNBUFFERED=1 python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \\
        --server "python3 -m http.server 8765" --port 8765 \\
        -- python3 tools/test_hero_op.py

固定タイムライン（変更禁止）:
    0.0s  heroIntroOverlay 表示、opacity:1
    0.3s  heroIntroLine1 に .visible 付与 → 1文字ずつ波打ち
    0.9s  heroIntroLine2 に .visible 付与
    2.8s  heroIntroOverlay に .fade-out 付与（transition 0.8s）
    3.6s  finishIntro() 呼出し → startHeroAnimation()
          → hero-logo-text に --play → pop-up アニメ開始
    9.1s  hero に .hero--phase2 付与 → カルーセル開始
    mobile(≤768px): intro をスキップ、即 Phase2
"""
from __future__ import annotations

import functools
import sys
from dataclasses import dataclass
from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

print = functools.partial(print, flush=True)  # type: ignore[assignment]

BASE = "http://localhost:8765"
DESKTOP_VIEWPORT = {"width": 1280, "height": 800}
MOBILE_VIEWPORT = {"width": 375, "height": 667}


@dataclass
class Result:
    scope: str
    name: str
    ok: bool
    detail: str = ""


results: list[Result] = []


def record(scope: str, name: str, ok: bool, detail: str = "") -> None:
    results.append(Result(scope, name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}{' — ' + detail if detail else ''}")


def check_desktop_op(page: Page) -> None:
    print("\n[DESKTOP] OP timeline")
    page.set_viewport_size(DESKTOP_VIEWPORT)
    page.goto(BASE + "/", wait_until="domcontentloaded", timeout=10000)

    # 即時: OP要素が存在
    overlay_exists = page.locator("#heroIntroOverlay").count() > 0
    record("desktop", "heroIntroOverlay exists", overlay_exists)
    line1_exists = page.locator("#heroIntroLine1").count() > 0
    line2_exists = page.locator("#heroIntroLine2").count() > 0
    record("desktop", "heroIntroLine1/2 exist", line1_exists and line2_exists)
    logo_exists = page.locator(".hero-logo-text, .hero-logo-wrap").count() > 0
    record("desktop", "hero center logo element exists", logo_exists)

    # 0.3〜1.0s で introLine1 が .visible
    try:
        page.wait_for_function(
            "() => document.getElementById('heroIntroLine1')?.classList.contains('visible')",
            timeout=1500,
        )
        record("desktop", "introLine1 gets .visible by ~0.3-1.0s", True)
    except PWTimeout:
        record("desktop", "introLine1 gets .visible by ~0.3-1.0s", False)

    # 0.9〜1.5s で introLine2 が .visible
    try:
        page.wait_for_function(
            "() => document.getElementById('heroIntroLine2')?.classList.contains('visible')",
            timeout=2000,
        )
        record("desktop", "introLine2 gets .visible by ~1.5s", True)
    except PWTimeout:
        record("desktop", "introLine2 gets .visible by ~1.5s", False)

    # 3.6s 前後で .fade-out
    try:
        page.wait_for_function(
            "() => document.getElementById('heroIntroOverlay')?.classList.contains('fade-out')",
            timeout=4000,
        )
        record("desktop", "overlay gets .fade-out by ~3.6s", True)
    except PWTimeout:
        record("desktop", "overlay gets .fade-out by ~3.6s", False)

    # 4.5s 以内に display:none
    try:
        page.wait_for_function(
            "() => { const el = document.getElementById('heroIntroOverlay');"
            " return el && (el.style.display === 'none' || getComputedStyle(el).display === 'none'); }",
            timeout=2000,
        )
        record("desktop", "overlay becomes display:none by ~4.5s", True)
    except PWTimeout:
        record("desktop", "overlay becomes display:none by ~4.5s", False)

    # hero-intro-done event 発火
    fired = page.evaluate(
        """
        () => new Promise(resolve => {
            if (window.__heroIntroDone) return resolve(true);
            const t = setTimeout(() => resolve(false), 3000);
            window.addEventListener('hero-intro-done', () => { clearTimeout(t); resolve(true); }, { once: true });
        })
        """
    )
    record("desktop", "hero-intro-done event fires", bool(fired))

    # 9秒後くらいに hero--phase2
    try:
        page.wait_for_function(
            "() => document.getElementById('hero')?.classList.contains('hero--phase2')",
            timeout=8000,
        )
        record("desktop", "hero gets .hero--phase2 by ~9s", True)
    except PWTimeout:
        record("desktop", "hero gets .hero--phase2 by ~9s", False)


def check_mobile_op(page: Page) -> None:
    print("\n[MOBILE] OP skip behavior")
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.goto(BASE + "/", wait_until="domcontentloaded", timeout=10000)
    # モバイルは即 phase2 へ
    try:
        page.wait_for_function(
            "() => document.getElementById('hero')?.classList.contains('hero--phase2')",
            timeout=3000,
        )
        record("mobile", "hero--phase2 immediately on mobile", True)
    except PWTimeout:
        record("mobile", "hero--phase2 immediately on mobile", False)
    # overlay is hidden
    hidden = page.evaluate(
        "() => { const el = document.getElementById('heroIntroOverlay'); return el && el.style.display === 'none'; }"
    )
    record("mobile", "heroIntroOverlay display:none on mobile", bool(hidden))


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # hero-intro-done イベントを捕捉するために事前にウィンドウ監視
        ctx = browser.new_context(viewport=DESKTOP_VIEWPORT)
        ctx.add_init_script(
            "window.addEventListener('hero-intro-done', () => { window.__heroIntroDone = true; });"
        )
        page = ctx.new_page()
        try:
            check_desktop_op(page)
        except Exception as e:
            record("desktop", "run crashed", False, str(e)[:160])

        try:
            check_mobile_op(page)
        except Exception as e:
            record("mobile", "run crashed", False, str(e)[:160])

        browser.close()

    passed = sum(1 for r in results if r.ok)
    failed = [r for r in results if not r.ok]
    print("\n" + "=" * 60)
    print(f"Summary: {passed}/{len(results)} passed")
    if failed:
        print("\nFailures:")
        for r in failed:
            print(f"  - [{r.scope}] {r.name}: {r.detail}")
        return 1
    print("OP は規定通り動作しています。hero周辺を変更してもOPに副作用なし。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
