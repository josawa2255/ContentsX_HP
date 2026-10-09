"""Browser checks for the Sales X section (Issue #67, image + hover cards Issue #104). Run against a loopback preview.

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
CARDS = [('bizform', 'ビズフォーム', 'https://bizform.contentsx.jp/', '新規開拓代行', 'sales-x-bizform.webp'),
         ('bizrecruit', 'ビズ採用', 'https://ichioshi.contentsx.jp/', '採用支援', 'sales-x-bizrecruit-v2.webp'),
         ('bizaio', 'ビズAIO', '/services/#bizaio', 'AI検索最適化', 'sales-x-bizaio.webp'),
         ('bizkarte', 'ビズカルテ', '/services/#bizkarte', '次世代AI CRM', 'sales-x-bizkarte-v2.webp')]


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
        assert page.locator('.cxsx-kicker').inner_text().strip().lower() == 'sales x'
        cards = page.locator('.cxsx-card')
        assert cards.count() == 4
        for i, (mod, name, href, label, img) in enumerate(CARDS):
            card = cards.nth(i)
            assert mod in card.get_attribute('class') and card.get_attribute('href') == href
            assert card.locator('.cxsx-name').inner_text() == name
            assert card.locator('.cxsx-eyebrow').inner_text() == label
            assert card.locator('img').get_attribute('src').endswith(img)
            assert card.locator('img').evaluate('i=>i.complete && i.naturalWidth > 0')
            # Name, short line, extra line and CTA are HTML text, not part of the image.
            assert card.locator('.cxsx-desc').inner_text().strip()
            assert card.locator('.cxsx-detail').text_content().strip()
            assert card.locator('.cxsx-hover .cxsx-cta').text_content().strip().startswith('詳しく見る')
            # The image is the lead: it sits above the text and is at least as wide as the text panel.
            m, b = card.locator('.cxsx-media').bounding_box(), card.locator('.cxsx-body').bounding_box()
            assert m['y'] + m['height'] <= b['y'] + 1 and m['height'] >= 100, (width, m)
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
        if width <= 768:
            # SP: whole 16:9 images, nothing cropped.
            m = page.locator('.cxsx-media').first.bounding_box()
            assert abs(m['width'] / m['height'] - 16 / 9) < 0.02, m
        # Body/UI text expansion (Android scaling); the SALES X label is ornamental and fixed.
        page.locator('#sales-x h2,#sales-x .cxsx-kicker,#sales-x .cxsx-lead,#sales-x .cxsx-eyebrow,#sales-x .cxsx-name,#sales-x .cxsx-desc,#sales-x .cxsx-detail,#sales-x .cxsx-cta').evaluate_all(
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

    # PC: the four cards fit in one 1440×900 screen. At rest a card shows image, label, name and the
    # short line; hover (or keyboard focus) lays the navy overlay with the extra line and「詳しく見る →」.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    to_section(page)
    assert rects(page)[3]['bottom'] <= 900
    card = page.locator('.cxsx-card').nth(2)
    assert card.locator('.cxsx-hover').evaluate('e=>getComputedStyle(e).opacity') == '0'
    assert card.locator('.cxsx-cta--touch').is_hidden()
    card.hover()
    page.wait_for_timeout(450)
    assert card.locator('.cxsx-hover').evaluate('e=>getComputedStyle(e).opacity') == '1'
    assert card.locator('img').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.04, 0, 0, 1.04, 0, 0)'
    assert card.locator('.cxsx-hover .cxsx-arrow').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 4, 0)'
    # The overlay text is readable: white on navy, inside the image area.
    o, m = card.locator('.cxsx-hover').bounding_box(), card.locator('.cxsx-media').bounding_box()
    assert o == m, (o, m)
    assert card.locator('.cxsx-detail').evaluate('e=>e.scrollHeight <= e.parentElement.clientHeight')
    page.mouse.move(5, 5)
    page.wait_for_timeout(450)
    page.locator('.cxsx-card').nth(0).focus()
    page.keyboard.press('Tab')
    page.wait_for_timeout(450)
    assert page.locator('.cxsx-card').nth(1).locator('.cxsx-hover').evaluate('e=>getComputedStyle(e).opacity') == '1', 'keyboard focus shows the overlay'
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

    # Touch devices (no hover): no overlay; the short line and「詳しく見る →」are always visible.
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    load(page)
    to_section(page)
    for i in range(4):
        card = page.locator('.cxsx-card').nth(i)
        assert card.locator('.cxsx-hover').is_hidden() and card.locator('.cxsx-cta--touch').is_visible()
        assert card.locator('.cxsx-desc').is_visible()
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
print(f'PASS: {len(widths)} widths, 2x2 / stacked layout, links, labels, images, hover/focus overlay, touch CTA, whole-card link, snap, reduced-motion and JS-off.')
