"""Browser checks for the shared ABOUT / SERVICE / NEWS backdrop. Run against a loopback preview.

python3 tests/test_section_backdrop.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-backdrop-qa
Requires Playwright (Chromium). External traffic except fonts is blocked, so NEWS shows the static fallback rows.
"""
import argparse
import json
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--artifacts', required=True)
args = parser.parse_args()
out = Path(args.artifacts)
out.mkdir(parents=True, exist_ok=True)
widths = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 1024, 1025, 1280, 1440, 1920]
SECTIONS = ['#home-about', '#about', '#news']
LABELS = {'#home-about': 'ABOUT', '#about': 'SERVICE', '#news': 'NEWS'}


def load(page, url):
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')) else r.abort())
    page.goto(url, wait_until='networkidle')
    page.wait_for_timeout(1500)


def top_of(page, selector):
    return page.evaluate('(s)=>document.querySelector(s).getBoundingClientRect().top + scrollY', selector)


def about_complete(page):
    # Scroll position where the Hero → ABOUT scene has finished (p = 1 in hero-about.js).
    return page.evaluate('''()=>{const t=document.querySelector('.cxha-transition');
      const d=parseFloat(t.style.getPropertyValue('--cxha-distance'))||0;
      return t.getBoundingClientRect().top+scrollY-64+d}''')


def scroll(page, y, wait=900):
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', y)
    page.wait_for_timeout(wait)


def assert_sections(page, width):
    assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
    for selector in SECTIONS:
        section = page.locator(selector)
        assert section.evaluate("e=>e.classList.contains('cxsb-section')")
        backdrop = section.locator(':scope > .cxsb-backdrop')
        style = backdrop.evaluate('e=>{const s=getComputedStyle(e);return {position:s.position,image:s.backgroundImage}}')
        assert style['position'] == 'fixed', (selector, style)
        tall = page.evaluate('innerWidth <= 768 || innerWidth / innerHeight <= .75')
        expected = 'section-bg-mobile.webp' if tall else 'section-bg-pc.webp'
        assert expected in style['image'], (width, selector, style['image'])
        label = section.locator(':scope > .cxsb-label')
        assert label.inner_text().strip() == LABELS[selector]
        assert label.evaluate('e=>e.scrollWidth <= e.parentElement.clientWidth')


report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        page = browser.new_page(viewport={'width': width, 'height': 900 if width > 768 else 844}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page, args.url)
        assert_sections(page, width)
        snap = page.evaluate('getComputedStyle(document.documentElement).scrollSnapType')
        if width >= 1025:
            assert snap in ('y', 'y proximity'), snap  # proximity is the default and may be omitted
        else:
            assert snap in ('none', ''), f'Snap must be off at {width}px: {snap}'
        # Each backdrop stays pinned to the viewport while its section scrolls.
        for selector in ['#about', '#news']:
            scroll(page, top_of(page, selector) - 64, 1600)
            assert page.locator(f'{selector} > .cxsb-label').evaluate('e=>getComputedStyle(e).opacity') == '1'
            scroll(page, top_of(page, selector) - 64 + 200, 300)
            assert page.locator(f'{selector} > .cxsb-backdrop').evaluate('e=>Math.abs(e.getBoundingClientRect().top)') < 1
        # The clip keeps the fixed layer out of neighbouring white sections.
        # Make the neighbouring section transparent: if the fixed layer leaked, the sky would show.
        page.add_style_tag(content='#flow{background:none!important}')
        scroll(page, top_of(page, '#flow') - 64 + 40)
        shot = out / f'{width}-flow-clip.png'
        page.screenshot(path=str(shot))
        y = int(page.evaluate("Math.min(innerHeight - 2, document.querySelector('#flow').getBoundingClientRect().top + 120)"))
        pixel = Image.open(shot).convert('RGB').getpixel((2, y))
        assert min(pixel) >= 248, f'Backdrop leaked into #flow at {width}px: {pixel}'
        if width in [390, 1440]:
            for selector in SECTIONS:
                scroll(page, about_complete(page) if selector == '#home-about' else top_of(page, selector) - 64, 1500)
                page.screenshot(path=str(out / f'{width}-{selector[1:]}.png'))
        # Body/UI text expansion (Android scaling); the ornamental labels stay fixed.
        page.locator('.cxsb-section h2,.cxsb-section p:not(.cxsb-label),.cxsb-section .news-link,.cxsb-section small,.cxsb-section strong').evaluate_all('(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert_sections(page, width)
        if width <= 768:
            order = ['.cxha-copy', '.cxha-office', '.cxha-link-purpose', '.cxha-link-company', '.cxha-value-sales', '.cxha-value-creative']
            tops = [page.locator(f'#home-about {sel}').evaluate('e=>e.getBoundingClientRect().top') for sel in order]
            assert tops == sorted(tops), f'SP order broken at {width}px: {tops}'
        assert not errors, errors
        report.append({'width': width, 'layout': 'pass', 'snap': snap or 'none', 'text_1_4x': 'pass'})
        page.close()

    # PC snap: stopping just above a section edge settles on the section top (or ABOUT completion).
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, args.url)
    for name, target in [('ABOUT', about_complete(page)), ('#about', top_of(page, '#about') - 64), ('#news', top_of(page, '#news') - 64)]:
        scroll(page, target - 120, 1500)
        assert abs(page.evaluate('scrollY') - target) <= 2, (name, page.evaluate('scrollY'), target)
    scroll(page, about_complete(page), 1500)
    assert page.locator('.cxha-office').evaluate('(e)=>getComputedStyle(e).opacity') == '1'
    # Free scrolling in the middle of a tall section is not pulled back.
    middle = top_of(page, '#about') - 64 + 700
    scroll(page, middle, 1500)
    assert abs(page.evaluate('scrollY') - middle) <= 2
    page.close()

    # ABOUT (Issue #63): Purpose / Company links and the two business cards use existing URLs.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, args.url)
    hrefs = page.locator('#home-about a').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("href"))')
    assert hrefs == ['/about', '/company', '/services/sales-x/', '/services/creative-x/'], hrefs
    assert page.locator('#home-about .cxha-value').count() == 2
    assert page.locator('#home-about .cxha-value h3').all_inner_texts() == ['Sales X', 'Creative X']
    scroll(page, about_complete(page), 1500)
    for selector in ['.cxha-links', '.cxha-values']:
        assert page.locator(f'#home-about {selector}').evaluate('e=>getComputedStyle(e).opacity') == '1'
    link = page.locator('.cxha-link-purpose')
    link.hover()
    page.wait_for_timeout(400)
    assert link.locator('.cxha-link-media').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1.02, 0, 0, 1.02, 0, 0)'
    assert link.locator('.cxha-link-arrow').evaluate('e=>getComputedStyle(e).transform') == 'matrix(1, 0, 0, 1, 3, 0)'
    page.close()

    # PC laptops (Issue #67 feedback): no white band below ABOUT, and ABOUT / Creative X / Sales X
    # each fit in one screen below the fixed header.
    for w, h in [(1470, 800), (1440, 900), (1366, 650), (1280, 720), (1536, 730), (1920, 1080)]:
        page = browser.new_page(viewport={'width': w, 'height': h})
        load(page, args.url)
        fit = page.evaluate('''()=>{const q=s=>document.querySelector(s), R=e=>e.getBoundingClientRect();
          const content=(sec,sel)=>Math.max(...[...q(sec).querySelectorAll(sel)].map(e=>R(e).bottom))-R(q(sec)).top;
          return {gap:q('.cxha-stage').offsetHeight-q('#home-about').offsetHeight,
            about:content('#home-about','.cxha-values'), cx:content('#creative-x','.cxcx-services'),
            sx:content('#sales-x','.cxsx-card')}}''')
        assert fit['gap'] <= 1, (w, h, fit)
        for key in ['about', 'cx', 'sx']:
            assert fit[key] <= h - 64, (w, h, key, fit)
        page.close()

    # Hover feedback on news rows survives the entrance animation.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, args.url)
    scroll(page, top_of(page, '#news') - 64, 1600)
    row = page.locator('#news .news-item').first
    row.hover()
    page.wait_for_timeout(500)
    assert 'matrix(1, 0, 0, 1, 4, 0)' == row.evaluate('e=>getComputedStyle(e).transform')
    page.close()

    # Reduced motion: everything visible without entrance motion.
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    load(page, args.url)
    for selector in ['#about', '#news']:
        assert page.locator(f'{selector} > .cxsb-label').evaluate('e=>getComputedStyle(e).opacity') == '1'
    assert page.locator('#news .news-list').evaluate('e=>getComputedStyle(e).opacity') == '1'
    page.close()

    # JS off: backdrop, labels and content render in normal order.
    page = browser.new_page(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    load(page, args.url)
    assert_sections(page, 390)
    for selector in SECTIONS:
        assert page.locator(f'{selector} > .cxsb-label').evaluate('e=>getComputedStyle(e).opacity') != '0'
    page.screenshot(path=str(out / 'no-js.png'), full_page=True)
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, indent=2))
print(f'PASS: {len(widths)} widths, fixed backdrop, PC/SP image switch, clip, 1.4x text, PC-only snap, hover, reduced-motion and JS-off.')
