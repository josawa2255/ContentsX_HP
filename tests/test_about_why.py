"""WHY integration: shared explanatory cards, language, resizing and unchanged surrounding sections.
Run on loopback: python3 tests/test_about_why.py --url http://127.0.0.1:8831 --base http://127.0.0.1:8829
"""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url',default='http://127.0.0.1:8831')
ap.add_argument('--base',default='http://127.0.0.1:8829')
ap.add_argument('--artifacts',default='/tmp/cx-about-why')
a=ap.parse_args()
for url in (a.url,a.base): assert urlsplit(url).hostname in ('127.0.0.1','localhost'), 'Loopback only'
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
widths=[320,375,390,412,448,481,640,768,898,899,900,1024,1190,1191,1280,1440,1920]

def load(page,url):
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','https://fonts.')) else r.abort())
 page.goto(url+'/about',wait_until='networkidle');page.evaluate('document.fonts.ready')

def check(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.locator('#business').evaluate('''e=>{
  const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()) {
   const t=walk.currentNode,p=t.parentElement;
   if(!t.textContent.trim()||p.closest('[aria-hidden=true]')||!p.getClientRects().length)continue;
   const r=document.createRange();r.selectNodeContents(t);
   for(const box of r.getClientRects()) if(box.left<0||box.right>innerWidth+1)return false;
  }return true;
 }'''), 'Text outside viewport'
 assert page.locator('.ax-why .cx-feature-card').evaluate_all('''es=>es.every(e=>{
  const r=e.getBoundingClientRect();
  const body=e.querySelector('.cx-feature-card__body').getBoundingClientRect();
  return body.right<=r.right+1&&body.bottom<=r.bottom+1;
 })''')

with sync_playwright() as p:
 b=p.chromium.launch();ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width in widths:
  page.set_viewport_size({'width':width,'height':900});load(page,a.url)
  assert page.locator('article.cx-feature-card').count()==3
  assert page.locator('#business a,#business button,#business [tabindex],#business [aria-expanded],#business .cx-feature-card__circle,#business .cx-feature-card__more').count()==0
  assert page.locator('#business').evaluate("e=>getComputedStyle(e.querySelector('.cx-feature-card')).flexDirection") == ('row' if width<=899 else 'column')
  check(page)
  for lang in ('en','ja'):
   page.evaluate('(l)=>i18n.switchLang(l)',lang);page.wait_for_function('(l)=>document.documentElement.lang===l',arg=lang)
   check(page)
  assert page.locator('.ax-why__title-accent').inner_text()=='届ける'
  page.locator('#business img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
  page.wait_for_function('[...document.querySelectorAll("#business img")].every(e=>e.complete&&e.naturalWidth)')
  assert page.locator('#business picture img').evaluate_all('''es=>es.every(e=>{
    const s=e.parentElement.querySelector('source');const src=innerWidth<=899?s:e;
    return e.naturalWidth===+src.getAttribute('width')&&e.naturalHeight===+src.getAttribute('height');
  })''')
  if width in (320,390,768,1024,1440):
   style=page.add_style_tag(content='header{visibility:hidden!important}')
   page.locator('#business').screenshot(path=str(out/f'why-{width}.png'));style.evaluate('e=>e.remove()')
  page.locator('#business').evaluate('''e=>e.querySelectorAll('h2,h3,p,.cx-feature-card__desc').forEach(n=>{
   n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.4+'px';
  })''');check(page)
 # Compare the HERO and every unchanged section by dimensions and HTML.
 for width in (390,1440):
  page.set_viewport_size({'width':width,'height':900});layouts=[]
  for url in (a.base,a.url):
   load(page,url)
   layouts.append(page.locator('main > section:not(#business)').evaluate_all('''es=>es.map(e=>({html:e.outerHTML,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))'''))
  assert layouts[0]==layouts[1],('Surrounding sections changed',width)
 # The explanation has no interactive hover cue.
 load(page,a.url);page.locator('.ax-why .cx-feature-card').first.hover();page.wait_for_timeout(1100)
 assert page.locator('.ax-why .cx-feature-card__media img').first.evaluate('e=>getComputedStyle(e).transform')=='none'
 page.locator('.ax-hero-scroll').click();page.wait_for_function("location.hash==='#business'")
 assert page.locator('#business').evaluate('e=>Math.abs(e.getBoundingClientRect().top-80)<2')
 ctx.close()
 for js in (False,True):
  ctx=b.new_context(java_script_enabled=js,reduced_motion='no-preference',viewport={'width':390,'height':844});page=ctx.new_page();load(page,a.url)
  page.locator('#business').scroll_into_view_if_needed();assert page.locator('#ax-why-title').is_visible();check(page);ctx.close()
 assert not errors,errors
 b.close()
print(f'PASS: {len(widths)} widths, JA/EN, 1.4x text, shared cards, non-interactive hover, #business, unchanged HERO/lower sections, JS/reduced motion')
