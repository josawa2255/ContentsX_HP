"""Representative message: original manuscript, responsive layout and actual links.
Run against a loopback preview only: python3 tests/test_message.py --url http://127.0.0.1:8777
"""
import argparse, json, re, subprocess
from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8777')
parser.add_argument('--artifacts', default='/private/tmp/contentsx-message-preview')
args = parser.parse_args()
BASE = args.url.rstrip('/')
assert urlsplit(BASE).hostname in ('127.0.0.1', 'localhost', '::1'), 'Local preview only'
OUT = Path(args.artifacts); OUT.mkdir(parents=True, exist_ok=True)
PATH = '/message'
WIDTHS = [320,375,390,412,448,640,767,768,769,1023,1024,1025,1280,1440,1920]
normalize = lambda s: re.sub(r'\s+', '', s)
old = BeautifulSoup(subprocess.check_output(['git','show','07a92552329b2892871cc984cf46fc3127555387:message.html'],cwd=ROOT,text=True), 'html.parser')
expected = [normalize(n.get_text()) for s in old.select('.ot-section,.ot-section-alt') for n in s.select('h2,p,.ot-path-label,.ot-path-title')]

def content(page):
    return [normalize(x) for x in page.locator('.cm-chapter h2,.cm-chapter p,.cm-path-label,.cm-path-title').all_text_contents()]

def overflow(page):
    return page.evaluate('Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth')

def load(page,path=PATH):
    response=page.goto(BASE+path, wait_until='networkidle')
    assert response.status == 200, (path,response.status)
    page.evaluate('document.fonts.ready')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chrome')
    context=browser.new_context(viewport={'width':1440,'height':1000})
    # Avoid analytics and live third-party calls during preview.
    context.route(re.compile(r'https?://(?!127\.0\.0\.1|localhost)'), lambda r:r.abort())
    page=context.new_page(); errors=[]; missing=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('response', lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
    load(page)
    assert page.locator('h1').count()==1
    assert content(page)==expected, 'Original manuscript changed or truncated'
    assert page.locator('.cm-chapter').count()==6
    assert page.locator('link[rel=canonical]').get_attribute('href')=='https://contentsx.jp'+PATH
    assert page.locator('script[src$="i18n.js"]').evaluate('(e)=>e.compareDocumentPosition(document.querySelector("script[src$=\\\"nav.js\\\"]")) & Node.DOCUMENT_POSITION_FOLLOWING')
    page.locator('img[loading="lazy"]').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
    page.wait_for_function('Array.from(document.images).every(e=>e.complete && e.naturalWidth>0)')
    # Use intrinsic HTML dimensions, because the intentional hero crop has a different CSS ratio.
    assert page.locator('img').evaluate_all('(es)=>es.every(e=>Math.abs(e.naturalWidth/e.naturalHeight-Number(e.getAttribute("width"))/Number(e.getAttribute("height")))<.001)')
    assert page.locator('#nav a',has_text='お問い合わせ').evaluate('(e)=>new URL(e.href).pathname')=='/contact'
    for width in WIDTHS:
        page.set_viewport_size({'width':width,'height':1000})
        assert overflow(page)<=1, ('overflow',width,overflow(page))
        assert page.locator('.cm-chapter').first.evaluate('(e)=>getComputedStyle(e).paddingTop')=='0px'
        if width<=1024:
            rects=page.locator('.cm-hero-image,.cm-hero-copy,.cm-message').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().toJSON())')
            assert rects[0]['bottom']<=rects[1]['top'] and rects[1]['bottom']<=rects[2]['top']
        else:
            rects=page.locator('.cm-hero-image,.cm-hero-copy').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().toJSON())')
            assert rects[1]['bottom']<=rects[0]['bottom']+1, ('hero copy overflows',width,rects)
        if width in (320,390,768,1024,1440,1920):
            page.screenshot(path=str(OUT/f'message-{width}.png'), full_page=True,animations='disabled')
            page.screenshot(path=str(OUT/f'message-fold-{width}.png'),animations='disabled')
    # Text enlargement on representative phone and desktop breakpoints.
    for width in (412,640,1025,1440):
        page.set_viewport_size({'width':width,'height':1000}); load(page)
        page.locator('main :is(h1,h2,p,a,li)').evaluate_all('(es)=>{const s=es.map(e=>parseFloat(getComputedStyle(e).fontSize)*1.4);es.forEach((e,i)=>e.style.fontSize=s[i]+"px")}')
        assert overflow(page)<=1, ('enlarged text',width)
        if width>=1025:
            assert page.locator('.cm-hero-copy').evaluate('(e)=>e.getBoundingClientRect().bottom<=document.querySelector(".cm-hero-image").getBoundingClientRect().bottom+1'), ('enlarged hero',width)
    load(page)
    page.evaluate("window.i18n.switchLang('en')")
    page.wait_for_function('document.documentElement.lang==="en"')
    assert page.locator('h1').inner_text()=='Message from the CEO'
    for width in (320,390,640,768,1025,1440):
        page.set_viewport_size({'width':width,'height':1000}); assert overflow(page)<=1, ('English',width)
    page.evaluate("window.i18n.switchLang('ja')")
    assert content(page)==expected, 'JP/EN round trip changed original copy'
    # Related links lead to real pages and the existing officers information.
    for href in ('/about','/company','/company#officers'):
        load(page); page.locator(f'.cm-related a[href="{href}"]').click()
        page.wait_for_url(BASE+href)
        if '#officers' in href: assert page.locator('#officers').inner_text()=='役員'
    # Established message URL preserves language query and serves the full page.
    page.goto(BASE+'/message?lang=en',wait_until='networkidle')
    assert page.url==BASE+PATH+'?lang=en'
    page.evaluate("window.i18n.switchLang('ja')")
    # Test the common nav on the message page, including touch operation.
    touch=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    touch.route(re.compile(r'https?://(?!127\.0\.0\.1|localhost)'),lambda r:r.abort())
    phone=touch.new_page(); load(phone)
    phone.locator('#hamburger').tap(); assert phone.locator('#nav').evaluate('(e)=>e.classList.contains("open")')
    phone.locator('.nav-dropdown-toggle',has_text='企業案内').tap()
    phone.locator('#nav a[href="/message"]').tap(); phone.wait_for_url(BASE+PATH)
    phone.locator('#hamburger').tap(); phone.locator('#nav a[href="contact"]').tap(); phone.wait_for_url(BASE+'/contact')
    touch.close()
    # Every paragraph remains readable with reduced motion and with JavaScript disabled.
    for mode in ('reduce','no-js'):
        c=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js',reduced_motion='reduce')
        c.route(re.compile(r'https?://(?!127\.0\.0\.1|localhost)'),lambda r:r.abort())
        q=c.new_page(); load(q)
        assert content(q)==expected
        assert q.locator('.cm-chapter').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1")')
        c.close()
    assert not errors, errors
    assert not missing, missing
    report={'widths':WIDTHS,'original_nodes':len(expected),'manuscript':'unchanged','enlargement':'1.4x pass','language_roundtrip':'pass','touch_navigation':'pass','assets':'pass','console':'pass','no_js_reduced_motion':'pass'}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
    context.close(); browser.close()
