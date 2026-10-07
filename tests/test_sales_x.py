"""Browser checks for the Sales X section (Issue #67). Run against a loopback preview.

python3 tests/test_sales_x.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-sales-qa
External traffic except fonts is blocked.
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
CARDS = [('bizform', 'ビズフォーム', 'https://bizform.contentsx.jp/'),
         ('bizrecruit', 'ビズ採用', 'https://ichioshi.contentsx.jp/'),
         ('bizaio', 'ビズAIO', '/services/#bizaio'),
         ('bizkarte', 'ビズカルテ', '/services/#bizkarte')]


def load(page):
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(
        ('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')) else r.abort())
    page.goto(args.url, wait_until='networkidle')
    page.wait_for_timeout(800)


def to_section(page, wait=1600):
    y = page.evaluate("document.querySelector('#sales-x').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(wait)


def rects(page):
    return page.locator('.cxsx-card').evaluate_all('(n)=>n.map(e=>e.getBoundingClientRect().toJSON())')


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
        # Shared backdrop continues from Creative X without a seam.
        assert page.locator('#sales-x > .cxsb-backdrop').evaluate('e=>getComputedStyle(e).position') == 'fixed'
        assert page.locator('#sales-x').evaluate("e=>getComputedStyle(e,'::before').display") == 'none'
        assert page.locator('#creative-x').evaluate("e=>getComputedStyle(e,'::after').display") == 'none'
        # Issue #83/#85: duplicate blocks are gone and SERVICE is hidden; Sales X runs straight into TOPICS.
        assert page.locator('.cxh-concept, .cxh-pillars, #flow').count() == 0
        assert page.locator('#sales-x').evaluate("e=>getComputedStyle(e,'::after').display") == 'none'
        assert page.locator('#about').evaluate('e=>e.hidden && getComputedStyle(e).display === "none"')
        assert page.locator('#topics').evaluate("e=>getComputedStyle(e,'::before').display") == 'none'
        for href in ['/services/sales-x/', '/services/creative-x/']:
            assert page.locator(f'main a[href="{href}"]').count() >= 1, href
        to_section(page)
        assert page.locator('#sales-x > .cxsb-label').inner_text().strip() == 'SALES X'
        cards = page.locator('.cxsx-card')
        assert cards.count() == 4
        for i, (mod, name, href) in enumerate(CARDS):
            card = cards.nth(i)
            assert mod in card.get_attribute('class') and card.get_attribute('href') == href
            assert card.locator('.cxsx-name').inner_text() == name
            assert card.locator('img').evaluate('i=>i.complete && i.naturalWidth > 0')
            # Name, description and CTA are HTML text, not part of the image.
            assert card.locator('.cxsx-desc').inner_text().strip() and card.locator('.cxsx-cta').inner_text().strip()
        r = rects(page)
        sizes = {(round(x['width']), round(x['height'])) for x in r}
        if width > 768:
            # 2 × 2, one shared size.
            assert len(sizes) == 1, sizes
            assert abs(r[0]['top'] - r[1]['top']) < 1 and r[1]['left'] > r[0]['right']
            assert r[2]['top'] >= r[0]['bottom'] and abs(r[2]['left'] - r[0]['left']) < 1
            if width > 1100:
                # Copy on the left of the grid.
                assert page.locator('.cxsx-copy').evaluate('e=>e.getBoundingClientRect().right') <= r[0]['left']
        else:
            assert len({round(x['width']) for x in r}) == 1
            assert all(r[i + 1]['top'] >= r[i]['bottom'] for i in range(3)), 'SP cards must stack'
        radii = set(page.locator('.cxsx-card').evaluate_all('(n)=>n.map(e=>getComputedStyle(e).borderRadius)'))
        assert radii == {'16px'}, radii
        # Body/UI text expansion (Android scaling); the SALES X label is ornamental and fixed.
        page.locator('#sales-x h2,#sales-x .cxsx-lead,#sales-x .cxsx-eyebrow,#sales-x .cxsx-name,#sales-x .cxsx-desc,#sales-x .cxsx-cta').evaluate_all(
            '(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Overflow with 1.4x text at {width}px'
        if width in [390, 1024, 1440]:
            page.reload(wait_until='networkidle')
            to_section(page)
            page.screenshot(path=str(out / f'{width}-sales-x.png'))
        assert not errors, errors
        report.append({'width': width, 'sizes': sorted(sizes), 'text_1_4x': 'pass'})
        page.close()

    # PC: the four cards fit in one 1440×900 screen; hover zooms the image and moves the arrow.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    to_section(page)
    assert rects(page)[3]['bottom'] <= 900
    card = page.locator('.cxsx-card').nth(2)
    card.hover()
    page.wait_for_timeout(450)
    assert card.locator('img').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.03, 0, 0, 1.03, 0, 0)'
    assert card.locator('.cxsx-arrow').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 4, 0)'
    # The whole card is the link.
    box = card.bounding_box()
    hit = page.evaluate('([x,y])=>document.elementFromPoint(x,y).closest("a")?.getAttribute("href")', [box['x'] + 12, box['y'] + 12])
    assert hit == '/services/#bizaio', hit
    # PC snap includes Sales X.
    target = page.evaluate("document.querySelector('#sales-x').getBoundingClientRect().top + scrollY - 64")
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', target - 120)
    page.wait_for_timeout(1500)
    assert abs(page.evaluate('scrollY') - target) <= 2, (page.evaluate('scrollY'), target)
    page.close()

    # Reduced motion and JS off: everything visible.
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    load(page)
    to_section(page, 300)
    assert set(page.locator('#sales-x [data-cxh-reveal]').evaluate_all('(n)=>n.map(e=>getComputedStyle(e).opacity)')) == {'1'}
    page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    load(page)
    assert page.locator('.cxsx-card').nth(3).is_visible()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'PASS: {len(widths)} widths, 2x2 / stacked layout, links, HTML text over images, hover, whole-card link, snap, reduced-motion and JS-off.')
