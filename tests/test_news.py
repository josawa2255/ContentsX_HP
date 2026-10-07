"""Browser checks for the top-page NEWS section (Issue #85 redesign). Run against a loopback preview
that serves extensionless URLs (python3 tools/preview-extensions.py --port 8769).

python3 tests/test_news.py --url http://127.0.0.1:8769 --artifacts /tmp/cx-news-qa
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
widths = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 1024, 1025, 1280, 1440, 1920]


def news(i, **kw):
    item = {'id': 100 + i, 'date': f'2026.09.{30 - i:02d}', 'tag_ja': 'お知らせ', 'tag_en': 'News',
            'title_ja': f'ニュース{i}のタイトル', 'title_en': f'News {i}', 'thumbnail': '', 'url': '',
            'has_detail': True, 'image_mode_top': 'contain'}
    item.update(kw)
    return item


NEWS = [news(1, title_ja='とても長いタイトルが入った場合でも、行の高さがそろい、タイトルが主役として読みやすく表示されることを確認するためのニュース'),
        news(2), news(3, url='https://example.com/press'), news(4), news(5), news(6)]
UNSAFE = [news(1, url='javascript:alert(1)', title_ja='<img src=x onerror="window.__xss=1">危険'), news(2, url='//evil.example.com')]


def load(page, items=NEWS, fail=False, path='/'):
    def route(r):
        u = r.request.url
        if '/contentsx/v1/news' in u:
            return r.abort() if fail else r.fulfill(status=200, content_type='application/json', body=json.dumps(items))
        if '/wp-json/' in u:
            return r.fulfill(status=200, content_type='application/json', body='{}')
        if u.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')):
            return r.continue_()
        return r.abort()
    page.route('**/*', route)
    page.goto(args.url.rstrip('/') + path, wait_until='load')
    page.wait_for_timeout(1500)


def to_news(page, wait=1500):
    y = page.evaluate("document.querySelector('#news').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(wait)


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        to_news(page)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
        # Big faint NEWS stays; the visible "News" heading is gone (kept only for screen readers).
        assert page.locator('#news > .cxsb-label').inner_text().strip() == 'NEWS'
        assert page.locator('#news .news-heading').count() == 0
        assert page.locator('#cxnw-title').evaluate('e=>e.getBoundingClientRect().width') <= 1
        # Four rows, every row one link, same height, same thumbnail size.
        rows = page.locator('#news .cxnw-row')
        assert rows.count() == 4
        boxes = rows.evaluate_all('(n)=>n.map(e=>e.getBoundingClientRect().toJSON())')
        assert len({round(b['height']) for b in boxes}) == 1, [b['height'] for b in boxes]
        thumbs = page.locator('#news .cxnw-thumb').evaluate_all('(n)=>n.map(e=>[Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)])')
        assert len({tuple(t) for t in thumbs}) == 1, thumbs
        assert rows.first.evaluate('e=>e.tagName') == 'A' and rows.first.get_attribute('href') == '/news-detail?id=101'
        assert rows.nth(2).get_attribute('href') == 'https://example.com/press'
        # Reading order: thumbnail / category / date / title / arrow.
        order = rows.first.evaluate('e=>[...e.children].map(c=>c.className)')
        assert order == ['cxnw-thumb', 'cxnw-tag', 'cxnw-date', 'cxnw-title', 'cxnw-arrow'], order
        # Title strongest, date lighter, category small.
        st = rows.first.evaluate('''e=>{const g=s=>getComputedStyle(e.querySelector(s));
          return {tw:+g('.cxnw-title').fontWeight, ts:parseFloat(g('.cxnw-title').fontSize), tc:g('.cxnw-title').color,
                  ds:parseFloat(g('.cxnw-date').fontSize), dc:g('.cxnw-date').color, cs:parseFloat(g('.cxnw-tag').fontSize)}}''')
        assert st['tw'] >= 700 and st['ts'] > st['ds'] > st['cs'] and st['tc'] == 'rgb(7, 20, 59)' and st['dc'] != st['tc'], st
        # "View all" at the top right, above the list.
        more = page.locator('#newsMore').bounding_box()
        lst = page.locator('#news .cxnw-list').bounding_box()
        assert page.locator('#newsMore').is_visible() and page.locator('#newsMore').get_attribute('href') == '/news'
        assert more['y'] + more['height'] <= lst['y'] + 1 and abs((more['x'] + more['width']) - (lst['x'] + lst['width'])) < 12
        assert more['height'] >= 44
        if width <= 768:
            # SP: small thumbnail on the left, meta above the title; generous tap height.
            r = boxes[0]
            t = page.locator('#news .cxnw-thumb').first.bounding_box()
            title = page.locator('#news .cxnw-title').first.bounding_box()
            date = page.locator('#news .cxnw-date').first.bounding_box()
            assert t['x'] < title['x'] and t['width'] <= 100 and date['y'] < title['y'] and r['height'] >= 88
        page.locator('#news .cxnw-title,#news .cxnw-date,#news .cxnw-tag').evaluate_all(
            '(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Overflow with 1.4x text at {width}px'
        if width in [390, 1440]:
            page.reload(wait_until='load')
            page.wait_for_timeout(1500)
            to_news(page)
            page.screenshot(path=str(out / f'{width}-news.png'))
        assert not errors, errors
        report.append({'width': width, 'row_height': round(boxes[0]['height'])})
        page.close()

    # PC hover: faint background, arrow 4px, thumbnail 1.02x, row itself does not move.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    to_news(page)
    row = page.locator('#news .cxnw-row').first
    before = row.evaluate('e=>getComputedStyle(e).backgroundColor')
    row.hover()
    page.wait_for_timeout(400)
    assert row.evaluate('e=>getComputedStyle(e).backgroundColor') != before
    assert row.locator('.cxnw-arrow').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 4, 0)'
    assert row.locator('img').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.02, 0, 0, 1.02, 0, 0)'
    assert row.evaluate('e=>getComputedStyle(e).transform') == 'none'
    page.close()

    # Unsafe WordPress values: text stays text; javascript: and protocol-relative URLs never become links.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, items=UNSAFE)
    to_news(page)
    assert page.evaluate('window.__xss') is None
    hrefs = page.locator('#news .cxnw-row').evaluate_all('(n)=>n.map(a=>a.getAttribute("href"))')
    assert hrefs == ['/news-detail?id=101', '/news-detail?id=102'], hrefs
    page.close()

    # API failure and JS off: the four fallback rows stay.
    for kw in [{'fail': True}, {}]:
        ctx = {} if kw else {'java_script_enabled': False}
        page = browser.new_page(viewport={'width': 390, 'height': 844}, **ctx)
        load(page, **kw)
        assert page.locator('#news .cxnw-row').count() == 4
        assert page.locator('#news .cxnw-row').first.get_attribute('href').startswith('/news-detail?id=')
        page.close()

    # The /news page keeps its own (old) list rendering.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, path='/news')
    assert page.locator('.news-list .news-item').count() == 6
    assert page.locator('.news-list .cxnw-row').count() == 0
    assert page.locator('.news-list .news-link').count() >= 1
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'PASS: {len(widths)} widths, 4 equal rows, order, typography, top-right link, SP layout, hover, unsafe data, fallback/JS-off, /news unchanged.')
