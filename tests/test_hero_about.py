"""Hero → ABOUT hand-off checks (Issue #59; fade hand-off since Issue #108). Run against a loopback preview;
external traffic is blocked except font resources.

python3 tests/test_hero_about.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-about-qa
The Hero itself is checked by tests/test_hero.py. `--baseline` is accepted for old commands and ignored
(the Hero was redesigned in Issue #108, so a pixel comparison with main no longer applies).
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--baseline')
parser.add_argument('--artifacts', required=True)
args = parser.parse_args()
out = Path(args.artifacts)
out.mkdir(parents=True, exist_ok=True)
widths = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 1024, 1280, 1440, 1920]


def load(page, url):
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')) else r.abort())
    page.goto(url, wait_until='networkidle')
    page.wait_for_timeout(3000)  # Existing Hero introduction must finish before comparison.


def scroll(page, y):
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(100)


def assert_layout(page):
    assert page.evaluate('document.body.scrollWidth <= innerWidth'), 'Horizontal overflow'
    assert page.locator('.cxha-office img').evaluate('(img)=>img.complete && img.naturalWidth > 0')
    rects = page.locator('.cxha-value').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().toJSON())')
    if page.viewport_size['width'] <= 768:
        assert rects[1]['top'] >= rects[0]['bottom'] - 1
    else:
        assert rects[1]['left'] >= rects[0]['right'] - 1
    assert page.locator('.cxha-copy').evaluate('(e)=>e.scrollWidth <= e.clientWidth')


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width':width, 'height':900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page, args.url)
        assert_layout(page)
        frame = page.locator('.cxha-hero-frame')
        assert frame.evaluate('(e)=>getComputedStyle(e).opacity') == '1'
        distance = page.locator('.cxha-transition').evaluate("e=>parseFloat(e.style.getPropertyValue('--cxha-distance'))")
        # A Hero taller than the screen scrolls first (--cxha-overflow), then the hand-off runs.
        overflow = page.locator('.cxha-transition').evaluate("e=>parseFloat(e.style.getPropertyValue('--cxha-overflow'))")
        scroll(page, overflow)
        assert frame.evaluate('(e)=>getComputedStyle(e).opacity') == '1' and page.locator('.cxhv-copy').evaluate('(e)=>getComputedStyle(e).opacity') == '1'
        scale_seen = []
        for progress in [0.3, 0.55, 0.8, 1]:
            scroll(page, overflow + distance * progress)
            assert_layout(page)
            # The cards shrink a little and recede upwards while the Hero fades.
            scale_seen.append(float(page.locator('.cxhv-stage').evaluate('(e)=>getComputedStyle(e).scale')))
            if width in [320, 390, 768, 1024, 1440, 1920]:
                page.screenshot(path=str(out / f'{width}-progress-{progress}.png'))
        assert float(frame.evaluate('(e)=>getComputedStyle(e).opacity')) == 0
        assert scale_seen == sorted(scale_seen, reverse=True) and scale_seen[-1] < .9, scale_seen
        # No empty band: ABOUT fills the screen below the header when the hand-off ends.
        assert page.locator('.cxha-about').evaluate('(e)=>e.getBoundingClientRect().top') <= 64 + 1
        assert frame.evaluate('(e)=>e.inert && e.getAttribute("aria-hidden") === "true"')
        assert page.locator('.cxha-office').evaluate('(e)=>getComputedStyle(e).opacity') == '1'
        # Native input remains available beyond the pinned stage.
        scroll(page, overflow + distance + 600)
        assert page.evaluate('scrollY') > overflow + distance
        scroll(page, 0)
        assert frame.evaluate('(e)=>!e.inert && getComputedStyle(e).opacity === "1"')
        # Body/UI text expansion; ornamental wordmark intentionally stays fixed.
        page.locator('.cxha-copy h2,.cxha-description,.cxha-value h3,.cxha-value p').evaluate_all('(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(100)
        scroll(page, overflow + distance)
        assert_layout(page)
        if width <= 768:
            assert page.locator('.cxha-office').evaluate('(e)=>e.getBoundingClientRect().top') >= page.locator('.cxha-copy').evaluate('(e)=>e.getBoundingClientRect().bottom') - 1
        assert not errors, errors
        report.append({'width':width,'layout':'pass','scroll':'pass','text_1_4x':'pass'})
        page.close()
    # Motion preferences can change while the page is open.
    page = browser.new_page(viewport={'width':390,'height':844})
    load(page, args.url + '/#home-about')
    assert page.locator('.cxha-office').evaluate('(e)=>getComputedStyle(e).opacity') == '1'
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(100)
    assert page.locator('.cxha-stage').evaluate('(e)=>getComputedStyle(e).position') == 'relative'
    assert page.locator('.cxha-hero-frame').evaluate('(e)=>!e.inert && !e.hasAttribute("aria-hidden")')
    assert page.locator('.cxha-about').evaluate('(e)=>e.getBoundingClientRect().top') >= page.locator('#hero').evaluate('(e)=>e.getBoundingClientRect().bottom') - 1
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_timeout(100)
    page.evaluate('location.hash="#hero"')
    page.wait_for_timeout(200)
    assert page.evaluate('scrollY') == 0
    # Translation must preserve an intelligible headline and adapt its dimensions.
    page.evaluate('window.i18n.switchLang("en")')
    page.wait_for_timeout(100)
    assert 'business potential' in page.locator('#cxha-title').inner_text()
    assert_layout(page)
    page.close()
    # Links in the original Hero still navigate; Home returns to the full Hero.
    page = browser.new_page(viewport={'width':1440,'height':900})
    load(page, args.url)
    page.locator('.cxhv-actions a[href="/contact"]').click()
    page.wait_for_url('**/contact')
    page.go_back(wait_until='networkidle')
    page.wait_for_timeout(100)
    distance = page.locator('.cxha-transition').evaluate("e=>parseFloat(e.style.getPropertyValue('--cxha-distance'))")
    scroll(page, distance + 300)
    page.locator('#nav a[href="#hero"]').first.click()
    page.wait_for_timeout(1600)
    assert page.evaluate('scrollY') == 0
    assert page.locator('.cxha-hero-frame').evaluate('(e)=>!e.inert && getComputedStyle(e).opacity === "1"')
    page.close()
    # JS off: both sections and all content are visible in normal reading order.
    page = browser.new_page(viewport={'width':390,'height':844}, java_script_enabled=False)
    load(page, args.url)
    assert page.locator('.cxha-about').evaluate('(e)=>e.getBoundingClientRect().top') >= page.locator('#hero').evaluate('(e)=>e.getBoundingClientRect().bottom') - 1
    assert_layout(page)
    page.screenshot(path=str(out/'no-js.png'), full_page=True)
    page.close()
    browser.close()
(out/'results.json').write_text(json.dumps(report,indent=2))
print(f'PASS: {len(widths)} widths, scroll-before-hand-off, fade hand-off (cards shrink/recede), 1.4x text, anchors, links, translation, reduced-motion toggle and JS-off.')
