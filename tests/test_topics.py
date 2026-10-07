"""Browser checks for the TOPICS section (Issue #76). Run against a loopback preview.

python3 tests/test_topics.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-topics-qa
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
widths = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 1024, 1280, 1440, 1920]

BASE = [
    {'type': 'MESSAGE', 'title': '代表メッセージ', 'date': '2026-09-29', 'thumbnail': '/material/home-2026/topics/topics-message-kuromiya.webp', 'tags': ['代表メッセージ'], 'url': '/about#message'},
    {'type': 'VIDEO', 'title': '動画', 'date': '2026-08-11', 'thumbnail': 'https://i.ytimg.com/vi/w_O3iaQKduQ/hqdefault.jpg', 'tags': ['ビズマンガ'], 'url': 'https://www.youtube.com/watch?v=w_O3iaQKduQ'},
    {'type': 'PRESS', 'title': 'プレス', 'date': '2026-08-31', 'thumbnail': '/material/home-2026/topics/topics-press-kirinz.webp', 'tags': ['プレスリリース'], 'url': 'https://prtimes.jp/main/html/rd/p/000000003.000182345.html'},
]
UNSAFE = [
    {'type': 'COLUMN<b>', 'title': '<img src=x onerror="window.__xss=1">コラム', 'date': '2026-13-40', 'thumbnail': 'https://evil.example.com/x.jpg', 'tags': ['<b>x</b>'], 'url': '/column'},
    {'type': 'CASE', 'title': '不正リンク', 'url': 'javascript:alert(1)'},
    {'type': 'CASE', 'title': '外部ホストの相対', 'url': '//evil.example.com'},
    {'type': 'CASE', 'title': '事例', 'date': '2026-07-01', 'thumbnail': '', 'tags': [], 'url': '/services/'},
]


def load(page, topics=None, fail=False):
    def route(r):
        u = r.request.url
        if u.endswith('/contentsx/v1/topics'):
            if fail:
                return r.abort()
            return r.fulfill(status=200, content_type='application/json', body=json.dumps({'topics': topics if topics is not None else BASE}))
        if '/wp-json/' in u:
            return r.fulfill(status=200, content_type='application/json', body='{}')
        if u.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')):
            return r.continue_()
        return r.abort()
    page.route('**/*', route)
    page.goto(args.url, wait_until='networkidle')
    page.wait_for_timeout(800)


def to_section(page, wait=1500):
    y = page.evaluate("document.querySelector('#topics').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(wait)


def rects(page):
    return page.locator('.cxtp-list > li').evaluate_all('(n)=>n.map(e=>e.getBoundingClientRect().toJSON())')


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
        # Between SERVICE and NEWS, continuing SERVICE's backdrop without a seam.
        order = page.evaluate("['#about','#topics','#news'].map(s=>document.querySelector(s).getBoundingClientRect().top+scrollY)")
        assert order == sorted(order), order
        assert page.locator('#topics > .cxsb-backdrop').evaluate('e=>getComputedStyle(e).position') == 'fixed'
        assert page.locator('#topics').evaluate("e=>getComputedStyle(e,'::before').display") == 'none'
        assert page.locator('#about').evaluate("e=>getComputedStyle(e,'::after').display") == 'none'
        to_section(page)
        assert page.locator('#topics').evaluate("e=>e.classList.contains('cxtp-ready')")
        assert page.locator('#topics > .cxsb-label').inner_text().strip() == 'TOPICS'
        r = rects(page)
        assert len(r) == 3
        # Every card: thumbnail / type / date / title / tags.
        for i in range(3):
            card = page.locator('.cxtp-card').nth(i)
            assert card.locator('.cxtp-thumb img').count() == 1
            assert card.locator('.cxtp-type').inner_text() == BASE[i]['type']
            assert card.locator('time').get_attribute('datetime') == BASE[i]['date']
            assert card.locator('.cxtp-title').inner_text() == BASE[i]['title']
            assert card.locator('.cxtp-tags').inner_text() == '#' + BASE[i]['tags'][0]
        list_box = page.locator('.cxtp-list').bounding_box()
        if width > 768:
            # PC/tablet: three cards side by side, same width, all inside the list; arrows at the top right.
            assert abs(r[0]['top'] - r[2]['top']) < 1 and len({round(x['width']) for x in r}) == 1
            assert r[2]['right'] <= list_box['x'] + list_box['width'] + 1
            nav = page.locator('[data-cxtp-nav]')
            assert nav.is_visible()
            assert page.locator('[data-cxtp-prev]').is_disabled() and page.locator('[data-cxtp-next]').is_disabled()
            assert nav.bounding_box()['x'] > page.locator('#cxtp-title').bounding_box()['x']
        else:
            # SP: swipe; the second card peeks in from the right edge; no arrows.
            assert page.locator('[data-cxtp-nav]').is_hidden()
            assert r[1]['left'] < width and r[1]['right'] > width, (width, r[1])
            assert page.locator('.cxtp-list').evaluate('e=>getComputedStyle(e).overflowX') == 'auto'
        page.locator('#topics h2,#topics .cxtp-title,#topics .cxtp-tags,#topics .cxtp-meta').evaluate_all(
            '(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Overflow with 1.4x text at {width}px'
        if width in [390, 1440]:
            page.reload(wait_until='networkidle')
            to_section(page)
            page.screenshot(path=str(out / f'{width}-topics.png'))
        assert not errors, errors
        report.append({'width': width, 'text_1_4x': 'pass'})
        page.close()

    # Links: internal page in the same tab; YouTube / PR TIMES in a new tab.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    to_section(page)
    cards = page.locator('.cxtp-card')
    assert cards.nth(0).get_attribute('href') == '/message' and cards.nth(0).get_attribute('target') is None
    for i in [1, 2]:
        assert cards.nth(i).get_attribute('target') == '_blank' and cards.nth(i).get_attribute('rel') == 'noopener'
    # Hover: image 1.02x, arrow 3px, title accent.
    cards.nth(0).hover()
    page.wait_for_timeout(450)
    assert cards.nth(0).locator('img').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.02, 0, 0, 1.02, 0, 0)'
    assert cards.nth(0).locator('.cxtp-arrow').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 3, 0)'
    cards.nth(0).click()
    page.wait_for_url(args.url.rstrip('/') + '/message')
    assert page.locator('h1').inner_text() == '代表メッセージ'
    assert page.locator('.cm-chapter').count() == 6
    page.close()

    # Only known same-site CEO message targets migrate; queries and other links survive.
    page = browser.new_page(viewport={'width':1440, 'height':900})
    cases = [
        ('MESSAGE', '/about?lang=en#message', '/message?lang=en'),
        ('MESSAGE', 'https://contentsx.jp/about#message', '/message'),
        ('MESSAGE', '/message.html?lang=en', '/message?lang=en'),
        ('MESSAGE', 'https://example.com/about#message', 'https://example.com/about#message'),
        ('MESSAGE', '/about#values', '/about#values'),
        ('PRESS', '/about#message', '/about#message'),
    ]
    load(page, topics=[dict(BASE[0], type=kind, title='target'+str(i), url=url) for i,(kind,url,_) in enumerate(cases)])
    assert page.locator('.cxtp-card').evaluate_all('(es)=>es.map(e=>e.getAttribute("href"))') == [c[2] for c in cases]
    page.close()

    # More than three topics: arrows scroll one card at a time.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, topics=BASE + [dict(t, title=t['title'] + '2') for t in BASE])
    to_section(page)
    assert page.locator('.cxtp-card').count() == 6
    assert page.locator('[data-cxtp-prev]').is_disabled() and not page.locator('[data-cxtp-next]').is_disabled()
    page.locator('[data-cxtp-next]').click()
    page.wait_for_timeout(900)
    first = page.locator('.cxtp-list > li').nth(1).evaluate('e=>Math.round(e.getBoundingClientRect().left)')
    left = page.locator('.cxtp-list').evaluate('e=>Math.round(e.getBoundingClientRect().left)')
    assert abs(first - left) <= 3, (first, left)
    assert not page.locator('[data-cxtp-prev]').is_disabled()
    page.close()

    # Unsafe WordPress values: text stays text, bad links / hosts / dates are dropped.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, topics=UNSAFE)
    to_section(page)
    assert page.evaluate('window.__xss') is None
    hrefs = page.locator('.cxtp-card').evaluate_all('(n)=>n.map(a=>a.getAttribute("href"))')
    assert hrefs == ['/column', '/services/'], hrefs
    assert page.locator('#topics img[src*="evil"]').count() == 0
    assert page.locator('.cxtp-card').nth(0).locator('time').count() == 0
    assert page.locator('.cxtp-card').nth(0).locator('.cxtp-type').inner_text() == 'COLUMNB'
    page.close()

    # API failure: the three fallback cards stay.
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    load(page, fail=True)
    to_section(page)
    assert not page.locator('#topics').evaluate("e=>e.classList.contains('cxtp-ready')")
    assert page.locator('.cxtp-card').count() == 3
    assert page.locator('.cxtp-card').nth(0).get_attribute('href') == '/message'
    page.locator('.cxtp-card').nth(0).click()
    page.wait_for_url(args.url.rstrip('/') + '/message')
    assert page.locator('.cm-chapter').count() == 6
    page.close()

    # Laptops: the cards stay inside one screen; PC snap includes TOPICS.
    for w, h in [(1470, 800), (1366, 650), (1280, 720), (1920, 1080)]:
        page = browser.new_page(viewport={'width': w, 'height': h})
        load(page)
        to_section(page)
        bottom = page.evaluate("(()=>{const s=document.querySelector('#topics');return Math.max(...[...s.querySelectorAll('.cxtp-card')].map(e=>e.getBoundingClientRect().bottom))-s.getBoundingClientRect().top})()")
        assert bottom <= h - 64, (w, h, bottom)
        target = page.evaluate("document.querySelector('#topics').getBoundingClientRect().top + scrollY - 64")
        page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', target - 120)
        page.wait_for_timeout(1400)
        assert abs(page.evaluate('scrollY') - target) <= 2, (w, h, page.evaluate('scrollY'), target)
        page.close()

    # Reduced motion and JS off: content visible.
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    load(page)
    to_section(page, 300)
    assert set(page.locator('#topics [data-cxh-reveal]').evaluate_all('(n)=>n.map(e=>getComputedStyle(e).opacity)')) == {'1'}
    page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    load(page)
    assert page.locator('.cxtp-card').count() == 3 and page.locator('.cxtp-card').first.is_visible()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'PASS: {len(widths)} widths, position/backdrop, card fields, links, hover, arrows, unsafe data, fallback, one screen, snap, reduced-motion and JS-off.')
