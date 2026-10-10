"""Check /about and /message readability with Chromium and WebKit.
Loopback only. Fonts are loaded; analytics and live CMS calls are blocked.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8782')
parser.add_argument('--artifacts', default='/private/tmp/contentsx-company-mobile')
parser.add_argument('--engines', nargs='+', choices=['chromium', 'webkit'], default=['chromium', 'webkit'])
parser.add_argument('--pages', nargs='+', choices=['/about', '/message'], default=['/about', '/message'])
args = parser.parse_args()
BASE = args.url.rstrip('/')
assert urlsplit(BASE).hostname in ('127.0.0.1', 'localhost', '::1'), 'Loopback preview only'
OUT = Path(args.artifacts)
OUT.mkdir(parents=True, exist_ok=True)
WIDTHS = [320, 375, 390, 412, 448, 480, 481, 640, 767, 768, 769, 799, 800, 801,
          900, 1023, 1024, 1025, 1200, 1280, 1440, 1920]
PROSE = '.ax-hero-lead,.ax-panel-copy>p,.ax-purpose-card>p:last-child,.ax-value-card>p,.ax-message-copy>p,.ax-contact p'
HEALTH = r'''()=>{
  const out={overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,text:[],images:[],taps:[]};
  const walk=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);
  while(walk.nextNode()){
    const node=walk.currentNode,e=node.parentElement;
    if(!node.textContent.trim()||e.closest('[aria-hidden=true],script,style'))continue;
    const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||!e.getClientRects().length)continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const r of range.getClientRects()){
      if(r.left< -1||r.right>innerWidth+1)out.text.push(node.textContent.trim().slice(0,35));
      for(let p=e;p&&p.tagName!=='BODY';p=p.parentElement){
        const ps=getComputedStyle(p),b=p.getBoundingClientRect();
        if(['hidden','clip','auto','scroll'].includes(ps.overflowX)&&(r.left<b.left-2||r.right>b.right+2))out.text.push('clipped: '+node.textContent.trim().slice(0,35));
        if(['hidden','clip'].includes(ps.overflowY)&&(r.top<b.top-2||r.bottom>b.bottom+2))out.text.push('vertical: '+node.textContent.trim().slice(0,35));
      }
    }
    if(innerWidth<=1024&&e.tagName==='P')for(let i=0;i<node.textContent.length;i++){
      if(!'、。'.includes(node.textContent[i]))continue;
      const char=document.createRange();char.setStart(node,i);char.setEnd(node,i+1);
      const r=char.getBoundingClientRect();
      if(r.left<=e.getBoundingClientRect().left+.5)out.text.push('punctuation at line start: '+node.textContent.trim().slice(0,35));
    }
  }
  for(const i of document.querySelectorAll('main img')){
    const r=i.getBoundingClientRect(),s=getComputedStyle(i),aw=+i.getAttribute('width'),ah=+i.getAttribute('height');
    if(!i.complete||!i.naturalWidth)out.images.push('missing '+i.getAttribute('src'));
    else if(Math.abs(aw/ah-i.naturalWidth/i.naturalHeight)>.02)out.images.push('attributes '+i.getAttribute('src'));
    else if(!['cover','contain'].includes(s.objectFit)&&Math.abs(r.width/r.height-i.naturalWidth/i.naturalHeight)>.03)out.images.push('distorted '+i.getAttribute('src'));
  }
  for(const a of document.querySelectorAll('main a')){
    const r=a.getBoundingClientRect();if(r.width&&r.height&&(r.width<43.5||r.height<43.5))out.taps.push(a.textContent.trim());
  }
  return out;
}'''
ENLARGE = '''()=>{
  const sizes=[...document.querySelectorAll('main h1,main h2,main h3,main p,main a,main span,main .ax-signature')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
  sizes.forEach(([e,size])=>e.style.fontSize=size*1.4+'px');
}'''


def load(page, path):
    r = page.goto(BASE + path, wait_until='networkidle')
    assert r.status == 200, (path, r.status)
    page.evaluate('document.fonts.ready')
    page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
    page.wait_for_function('[...document.images].every(i=>i.complete)')
    page.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')


def check(page, engine, path, width, enlarged=False):
    result = page.evaluate(HEALTH)
    assert result['overflow'] <= 1 and not result['text'] and not result['images'] and not result['taps'], (engine, path, width, enlarged, result)
    if path == '/about' and width <= 1024 and not enlarged:
        sizes = page.locator(PROSE).evaluate_all('(es)=>es.map(e=>({size:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)}))')
        assert all(16 <= x['size'] <= 17.01 and x['line'] / x['size'] >= 1.8 for x in sizes), (width, sizes)
        assert page.locator('.ax-panel').evaluate_all('(es)=>es.every(e=>parseFloat(getComputedStyle(e).paddingTop)<=40&&parseFloat(getComputedStyle(e).paddingBottom)<=40)')
        assert page.locator('.ax-hero-grid,.ax-panel-grid,.ax-purpose-cards,.ax-message-grid').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).gridTemplateColumns.split(" ").length===1)')
    if path == '/message':
        assert page.locator('.cm-chapter').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).transform==="none"&&getComputedStyle(e).opacity==="1")')
    return {'engine': engine, 'page': path, 'width': width, 'text_scale': 1.4 if enlarged else 1, 'pass': True}


report = []
with sync_playwright() as p:
    for engine in args.engines:
        browser = getattr(p, engine).launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith((BASE, 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')) else r.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        for path in args.pages:
            print(f'{engine}: {path} widths and text enlargement', flush=True)
            load(page, path)
            original = page.locator('main').inner_text()
            assert page.evaluate('[...document.fonts].some(f=>f.family.includes("Noto Sans JP")&&f.status==="loaded")'), 'Japanese font did not load'
            for width in WIDTHS:
                page.set_viewport_size({'width': width, 'height': 844})
                page.wait_for_timeout(30)
                report.append(check(page, engine, path, width))
                if width in (320, 390, 768, 801, 1024, 1440, 1920):
                    page.screenshot(path=str(OUT / f'{engine}-{path[1:]}-{width}.png'), full_page=True, animations='disabled')
            for width in (320, 390, 640, 801, 1024, 1440):
                page.set_viewport_size({'width': width, 'height': 844})
                load(page, path)
                page.evaluate(ENLARGE)
                report.append(check(page, engine, path, width, True))
            page.set_viewport_size({'width': 390, 'height': 844})
            load(page, path)
            page.evaluate("window.i18n.switchLang('en')")
            report.append(check(page, engine, path, 390))
            page.evaluate("window.i18n.switchLang('ja')")
            # About uses visual <br> breaks before translation, which become whitespace on return.
            assert ''.join(page.locator('main').inner_text().split()) == ''.join(original.split()), (engine, path, 'language changed copy')
            page.locator('#hamburger').tap()
            assert page.locator('#nav').evaluate('(e)=>e.classList.contains("open")')
            page.locator('.nav-dropdown-toggle', has_text='企業案内').tap()
            dest = '/message' if path == '/about' else '/about'
            nav_href = '/message' if path == '/about' else 'about'
            page.locator(f'#nav .nav-dropdown-item[href="{nav_href}"]').tap()
            page.wait_for_url(BASE + dest)
            load(page, path)
            if path == '/about':
                page.locator('.cm-message-link').tap()
                page.wait_for_url(BASE + '/message')
            else:
                for href in ('/about', '/company', '/company#officers'):
                    load(page, path)
                    page.locator(f'.cm-related a[href="{href}"]').tap()
                    page.wait_for_url(BASE + href)
        # Small phones have little vertical space for an expanded corporate menu.
        page.set_viewport_size({'width': 320, 'height': 568})
        for path in args.pages:
            load(page, path)
            check(page, engine, path, 320)
            page.locator('#hamburger').tap()
            page.locator('.nav-dropdown-toggle', has_text='企業案内').tap()
            nav_href = '/message' if path == '/about' else 'about'
            link = page.locator(f'#nav .nav-dropdown-item[href="{nav_href}"]')
            bounds = link.bounding_box()
            assert bounds and bounds['y'] >= 0 and bounds['y'] + bounds['height'] <= 568, (engine, path, bounds)
            link.tap()
            page.wait_for_url(BASE + ('/message' if path == '/about' else '/about'))
        assert not errors, (engine, errors)
        context.close()
        # Confirm regular scroll reveals and text remain usable with/without JavaScript.
        for js in (True, False):
            c = browser.new_context(viewport={'width': 390, 'height': 844}, java_script_enabled=js)
            c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            q = c.new_page()
            for path in args.pages:
                load(q, path)
                for y in range(0, q.evaluate('document.documentElement.scrollHeight'), 500):
                    q.evaluate('(y)=>scrollTo(0,y)', y)
                    q.wait_for_timeout(35)
                q.wait_for_timeout(900)
                assert q.evaluate('scrollY') > 0
                prose = PROSE if path == '/about' else '.cm-chapter>p'
                assert q.locator(prose).evaluate_all('(es)=>es.every(e=>+getComputedStyle(e).opacity===1&&!e.closest(".cx-motion-pending:not(.cx-motion-visible)"))')
                check(q, engine, path, 390)
            c.close()
        browser.close()
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'engines': args.engines, 'pages': args.pages, 'widths': WIDTHS,
                  'text_enlargement': '1.4x', 'checks': len(report), 'fonts': 'Noto Sans JP loaded',
                  'touch_nav_links': 'pass', 'language': 'pass', 'motion_and_no_js': 'pass'}, ensure_ascii=False))
