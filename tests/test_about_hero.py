"""About HERO: responsive copy, photo sources, navigation and language round trip.
Run only against loopback: python3 tests/test_about_hero.py --url http://127.0.0.1:8829
Use --base to compare the existing sections below the HERO with a baseline preview.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', default='http://127.0.0.1:8829')
ap.add_argument('--base')
ap.add_argument('--artifacts', default='/tmp/contentsx-about-hero')
args = ap.parse_args()
for url in (args.url, args.base):
    if url:
        assert urlsplit(url).hostname in ('127.0.0.1', 'localhost', '::1'), 'Loopback only'
out = Path(args.artifacts)
out.mkdir(parents=True, exist_ok=True)
widths = [320, 375, 390, 412, 430, 448, 480, 481, 640, 767, 768, 769,
          1023, 1024, 1025, 1280, 1440, 1920]
shots = {320:700, 375:812, 390:844, 768:1024, 1280:800, 1440:900}
report = []


def load(page, url, images=True):
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(
        ('http://127.0.0.1:', 'http://localhost:', 'https://fonts.')) and
        (images or r.request.resource_type != 'image') else r.abort())
    page.goto(url.rstrip('/') + '/about', wait_until='networkidle')
    page.evaluate('document.fonts.ready')


def check_copy(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'
    assert page.locator('.ax-hero-copy').evaluate('''e => {
        const box=e.getBoundingClientRect();
        const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
            if(!walker.currentNode.textContent.trim()) continue;
            const range=document.createRange(); range.selectNodeContents(walker.currentNode);
            for(const r of range.getClientRects())
                if(r.right>innerWidth+1 || r.left<0 || r.bottom>box.bottom+1) return false;
        } return true;
    }'''), 'text outside copy area'
    assert page.locator('.ax-hero-scroll').evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44}')


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for width in widths:
        page.set_viewport_size({'width':width, 'height':shots.get(width,900)})
        load(page, args.url)
        check_copy(page)
        assert page.locator('h1').count() == 1
        assert page.locator('h1').inner_text() == 'きっかけがあれば、\n人も企業も、輝く。'
        assert page.locator('h1').evaluate('''e=>[...e.children].every(s=> {
            const r=document.createRange();r.selectNodeContents(s);
            return new Set([...r.getClientRects()].filter(b=>b.height>0).map(b=>Math.round(b.top))).size===1;
        })'''), ('Japanese headline must have two lines', width)
        assert page.locator('.ax-hero-photo img').evaluate_all('''es=>es.every(e=> {
            const source=e.parentElement.querySelector('source');
            const expected=innerWidth<=1024 ? source.getAttribute('srcset') : e.getAttribute('src');
            const w=innerWidth<=1024 ? +source.getAttribute('width') : +e.getAttribute('width');
            return e.currentSrc.endsWith(expected) && e.naturalWidth===w && e.naturalHeight===941;
        })'''), ('photo source/dimensions', width)
        if width in shots:
            page.screenshot(path=str(out/f'about-{width}.png'))
            page.locator('.ax-hero').screenshot(path=str(out/f'hero-{width}.png'))
            page.evaluate('scrollTo(0,0)')
        if width<=1280:
            page.locator('#hamburger').click()
            assert page.locator('#hamburger').get_attribute('aria-expanded')=='true'
            assert page.locator('#nav').is_visible()
            page.locator('#hamburger').click()
            assert page.locator('#hamburger').get_attribute('aria-expanded')=='false'
        page.evaluate("window.i18n.switchLang('en')")
        page.wait_for_function("document.documentElement.lang==='en'")
        assert 'shine.' in page.locator('h1').inner_text()
        assert page.locator('h1 em').inner_text()=='shine.'
        check_copy(page)
        page.evaluate("window.i18n.switchLang('ja')")
        page.wait_for_function("document.documentElement.lang==='ja'")
        assert page.locator('h1 em').inner_text()=='輝く。'
        page.locator('.ax-hero-copy').evaluate('''e=>[...e.querySelectorAll('h1,p')].forEach(n=>{
            n.style.fontSize=(parseFloat(getComputedStyle(n).fontSize)*1.4)+'px';
        })''')
        check_copy(page)
        if width in (390,1440):
            page.locator('.ax-hero').screenshot(path=str(out/f'hero-enlarged-{width}.png'))
        report.append({'width':width, 'ja_en_roundtrip':True, 'text_scale_1_4':True})
    load(page,args.url)
    page.locator('.ax-hero-scroll').click()
    page.wait_for_function("location.hash==='#business'")
    assert page.locator('#business').evaluate('e=>Math.abs(e.getBoundingClientRect().top-80)<2')
    if args.base:
        for width in (390,1440):
            page.set_viewport_size({'width':width,'height':900})
            layouts=[]
            for url in (args.base,args.url):
                load(page,url)
                layouts.append(page.locator('main > section:not(.ax-hero)').evaluate_all('''es=>es.map(e=>({
                    id:e.id,html:e.outerHTML,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height
                }))'''))
            assert layouts[0]==layouts[1], ('sections below HERO changed',width)
    ctx.close()
    for js,images in ((False,True),(True,False)):
        ctx=browser.new_context(java_script_enabled=js,reduced_motion='reduce',viewport={'width':390,'height':844})
        page=ctx.new_page();load(page,args.url,images)
        check_copy(page)
        assert page.locator('h1').is_visible()
        ctx.close()
    assert not errors, errors
    browser.close()
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(f'PASS: {len(widths)} widths; JA/EN; 1.4x text; menu; scroll; JS/images disabled; lower sections preserved')
