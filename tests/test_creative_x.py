"""Browser checks for the Creative X section (Issue #65). Run against a loopback preview.

python3 tests/test_creative_x.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-creative-qa
WordPress responses are replaced with the fixtures below, so the test needs no network access.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--artifacts', required=True)
args = parser.parse_args()
out = Path(args.artifacts)
out.mkdir(parents=True, exist_ok=True)
widths = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 1024, 1100, 1101, 1280, 1440, 1920]

PLAYLISTS = [
    {'title': 'IPキャラクター・オリジナル開発', 'type': 'bizanime', 'playlist_id': 'PLbAH9KNME5V0'},
    {'title': 'VLOG・旅行・ライフスタイルCM', 'type': 'bizvideo', 'playlist_id': 'PLD2nZrEveSfI'},
    {'title': 'アニメMV・音楽コンテンツ', 'type': 'bizanime', 'playlist_id': 'PLM0Jhr7FzeLc'},
    {'title': '<img src=x onerror="window.__xss=1">広告・VTuber', 'type': 'bizanime', 'playlist_id': 'PLF-HKAyPsMYE',
     'poster': 'javascript:alert(1)'},
    {'title': 'シネマティック・ストーリーMV', 'type': 'bizvideo', 'playlist_id': 'PLTGR0hc6ZaWs',
     'poster': 'https://evil.example.com/x.jpg'},
    {'title': 'broken id', 'type': 'bizvideo', 'playlist_id': 'bad"id'},
]
for p in PLAYLISTS:
    p.setdefault('poster', f"https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")
    p['url'] = 'https://www.youtube.com/playlist?list=' + p['playlist_id']
    p['embed'] = 'https://attacker.example.com/embed'  # must be ignored: the client rebuilds embeds
VIDEOS = {'main': [], 'cases': [{'title': 'I eye', 'provider': 'youtube', 'video_id': 'CduBxsawUkQ',
                                 'poster': 'https://i.ytimg.com/vi/CduBxsawUkQ/maxresdefault.jpg'}],
          'playlists': PLAYLISTS}
WORKS = [{'id': 'gaudia', 'title_ja': 'ガウディア１話', 'subtitle_ja': 'サービス紹介マンガ',
          'thumbnail': 'https://cms.contentsx.jp/wp-content/uploads/2026/08/gaudia-01-240x300.webp'},
         {'id': 'hana', 'title_ja': 'HANA intelligence', 'subtitle_ja': '会社紹介',
          'thumbnail': 'https://cms.contentsx.jp/wp-content/uploads/2026/05/01.webp'},
         {'id': '../evil', 'title_ja': 'bad id', 'thumbnail': ''}]


def load(page, videos=VIDEOS, works=WORKS, fail=False):
    def route(r):
        u = r.request.url
        if '/wp-json/contentsx/v1/' in u:
            if fail:
                return r.abort()
            body = videos if '/bizanime-videos' in u else works if '/works' in u else []
            return r.fulfill(status=200, content_type='application/json', body=json.dumps(body))
        if u.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')):
            return r.continue_()
        return r.abort()
    page.route('**/*', route)
    page.goto(args.url, wait_until='networkidle')
    page.wait_for_timeout(800)


def to_section(page, wait=1500):
    y = page.evaluate("document.querySelector('#creative-x').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(wait)


def card_rects(page):
    return page.locator('.cxcx-card').evaluate_all('(n)=>n.map(e=>e.getBoundingClientRect().toJSON())')


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        assert page.locator('#creative-x').evaluate("e=>e.classList.contains('cxcx-ready')")
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
        # Shared backdrop continues from ABOUT without a white seam.
        assert page.locator('#creative-x > .cxsb-backdrop').evaluate('e=>getComputedStyle(e).position') == 'fixed'
        assert page.locator('#creative-x').evaluate("e=>getComputedStyle(e,'::before').display") == 'none'
        assert page.locator('#home-about').evaluate("e=>getComputedStyle(e,'::after').display") == 'none'
        to_section(page)
        assert page.locator('#creative-x > .cxsb-label').inner_text().strip() == 'CREATIVE X'
        # PICK UP = first three valid playlists in WordPress order.
        slides = page.locator('.cxcx-slide')
        assert slides.count() == 3
        assert slides.nth(0).get_attribute('href') == 'https://www.youtube.com/playlist?list=PLbAH9KNME5V0'
        # 2026-10-04 design: no works column; three service cards under PICK UP.
        assert page.locator('[data-cxcx-works]').count() == 0
        cards = page.locator('.cxcx-card-name').all_inner_texts()
        assert cards == ['ビズマンガ', 'ビズアニメ', 'ビズビデオ'], cards
        r = card_rects(page)
        if width > 768:
            assert abs(r[0]['top'] - r[2]['top']) < 1 and r[1]['left'] > r[0]['right'], 'PC/tablet: cards in one row'
        else:
            assert r[1]['top'] >= r[0]['bottom'] and r[2]['top'] >= r[1]['bottom'], 'SP: cards stacked'
            order = ['.cxcx-copy', '.cxcx-pickup', '.cxcx-works-intro', '[data-cxcx-service="manga"]',
                     '[data-cxcx-service="bizanime"]', '[data-cxcx-service="bizvideo"]']
            tops = [page.locator(s).evaluate('e=>e.getBoundingClientRect().top') for s in order]
            assert tops == sorted(tops), f'SP order at {width}px: {tops}'
        if width > 1100:
            # Copy on the left of PICK UP; OUR WORKS on the left of the cards.
            assert page.locator('.cxcx-copy').evaluate('e=>e.getBoundingClientRect().right') <= page.locator('.cxcx-pickup').evaluate('e=>e.getBoundingClientRect().left')
            assert page.locator('.cxcx-works-intro').evaluate('e=>e.getBoundingClientRect().right') <= r[0]['left']
        # Body/UI text expansion (Android scaling); the CREATIVE X label is ornamental and fixed.
        page.locator('#creative-x h2,#creative-x h3,#creative-x p:not(.cxcx-tagline),#creative-x strong,#creative-x .cxcx-card-desc,#creative-x .cxcx-button').evaluate_all(
            '(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Overflow with 1.4x text at {width}px'
        if width in [390, 1440]:
            page.screenshot(path=str(out / f'{width}-creative-x.png'))
        assert not errors, errors
        report.append({'width': width, 'cards': cards, 'text_1_4x': 'pass'})
        page.close()

    # Data safety: WordPress strings stay text, foreign hosts and bad IDs are dropped.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    to_section(page)
    assert page.evaluate('window.__xss') is None
    assert page.locator('#creative-x img[src*="evil"], #creative-x img[src^="javascript"]').count() == 0
    hrefs = page.locator('#creative-x a').evaluate_all('(n)=>n.map(a=>a.getAttribute("href"))')
    assert not any('bad"id' in h or 'evil' in h for h in hrefs), hrefs
    assert page.locator('[data-cxcx-service="manga"]').get_attribute('href') == 'https://bizmanga.contentsx.jp/biz-library?manga=gaudia'
    assert page.locator('[data-cxcx-service="bizanime"]').get_attribute('href') == 'https://www.youtube.com/playlist?list=PLbAH9KNME5V0'
    assert page.locator('.cxcx-button').get_attribute('href') == '/services/creative-x/'

    # PICK UP is switched by the OUR WORKS arrows and dots.
    dots = page.locator('.cxcx-dot')
    assert dots.count() == 3 and dots.nth(0).get_attribute('aria-current') == 'true'
    page.locator('[data-cxcx-next]').click()
    assert page.locator('.cxcx-slide.is-active').get_attribute('href').endswith('PLD2nZrEveSfI')
    assert dots.nth(1).get_attribute('aria-current') == 'true'
    page.locator('[data-cxcx-prev]').click()
    page.locator('[data-cxcx-prev]').click()
    assert dots.nth(2).get_attribute('aria-current') == 'true'
    dots.nth(2).click()

    # Modal: playlist embed is rebuilt client-side on youtube-nocookie and removed on close.
    page.locator('.cxcx-slide.is-active').click()
    frame = page.locator('dialog[open] iframe')
    assert frame.get_attribute('src') == 'https://www.youtube-nocookie.com/embed/videoseries?list=PLM0Jhr7FzeLc&autoplay=1&rel=0'
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    assert page.locator('dialog[open]').count() == 0 and page.locator('[data-cxcx-frame] iframe').count() == 0
    page.locator('[data-cxcx-service="bizvideo"]').click()
    assert 'videoseries?list=PLD2nZrEveSfI' in page.locator('dialog[open] iframe').get_attribute('src')
    page.locator('[data-cxcx-close]').click()
    page.wait_for_timeout(200)

    # PC hover: image 1.03x, arrow button 4px.
    card = page.locator('.cxcx-card').first
    card.hover()
    page.wait_for_timeout(450)
    assert card.locator('img').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.03, 0, 0, 1.03, 0, 0)'
    assert card.locator('.cxcx-card-go').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 4, 0)'
    page.close()

    # Laptops: the cards stay inside one screen below the fixed header.
    for w, h in [(1470, 800), (1448, 1086), (1280, 720), (1536, 730), (1366, 650), (1920, 1080)]:
        page = browser.new_page(viewport={'width': w, 'height': h})
        load(page)
        to_section(page)  # measure after the entrance animation (cards start 30px lower)
        bottom = page.evaluate("(()=>{const s=document.querySelector('#creative-x');return Math.max(...[...s.querySelectorAll('.cxcx-card')].map(e=>e.getBoundingClientRect().bottom))-s.getBoundingClientRect().top})()")
        assert bottom <= h - 64, (w, h, bottom)
        page.close()

    # PC snap includes Creative X.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    target = page.evaluate("document.querySelector('#creative-x').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', target - 120)
    page.wait_for_timeout(1500)
    assert abs(page.evaluate('scrollY') - target) <= 2, (page.evaluate('scrollY'), target)
    page.close()

    # Before playlists are registered: BizAnime falls back to existing single videos.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, videos={'main': [], 'cases': VIDEOS['cases']})
    to_section(page)
    assert page.locator('.cxcx-slide').first.get_attribute('href') == 'https://www.youtube.com/watch?v=CduBxsawUkQ'
    assert page.locator('[data-cxcx-service="bizvideo"]').get_attribute('href') == '/services/#bizvideo'
    page.close()

    # API failure: the static fallback stays usable.
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    load(page, fail=True)
    to_section(page)
    assert not page.locator('#creative-x').evaluate("e=>e.classList.contains('cxcx-ready')")
    assert page.locator('.cxcx-slide').get_attribute('href') == '/services/creative-x/'
    assert page.locator('.cxcx-card').count() == 3 and page.locator('[data-cxcx-pickup-nav]').is_hidden()
    page.close()

    # Reduced motion and JS off: content visible.
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    load(page)
    to_section(page, 300)
    for selector in ['.cxcx-copy', '.cxcx-pickup', '.cxcx-works-intro', '.cxcx-card']:
        assert set(page.locator(f'#creative-x {selector}').evaluate_all('(n)=>n.map(e=>getComputedStyle(e).opacity)')) == {'1'}
    page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    load(page)
    assert page.locator('.cxcx-slide').is_visible()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'PASS: {len(widths)} widths, WP data order, safety, carousel, modal, hover, snap, fallbacks, reduced-motion and JS-off.')
