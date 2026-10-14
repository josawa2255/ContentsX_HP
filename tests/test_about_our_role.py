"""OUR ROLE integration: shared explanatory cards, language, resizing and unchanged surrounding sections.
Run on loopback: python3 tests/test_about_why.py --url http://127.0.0.1:8834 --base http://127.0.0.1:8833
"""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url',default='http://127.0.0.1:8834')
ap.add_argument('--base',default='http://127.0.0.1:8833')
ap.add_argument('--artifacts',default='/tmp/cx-about-our-role')
a=ap.parse_args()
for url in (a.url,a.base): assert urlsplit(url).hostname in ('127.0.0.1','localhost'), 'Loopback only'
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
widths=[320,375,390,412,448,481,640,768,898,899,900,1024,1190,1191,1280,1440,1920]

def load(page,url):
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','https://fonts.')) else r.abort())
 page.goto(url+'/about',wait_until='networkidle');page.evaluate('document.fonts.ready')

def check(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.locator('#our-role').evaluate('''e=>{
  const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()) {
   const t=walk.currentNode,p=t.parentElement;
   if(!t.textContent.trim()||p.closest('[aria-hidden=true]')||!p.getClientRects().length)continue;
   const r=document.createRange();r.selectNodeContents(t);
   for(const box of r.getClientRects()) if(box.left<0||box.right>innerWidth+1)return false;
  }return true;
 }'''), 'Text outside viewport'
 assert page.locator('.cxour .cx-feature-card').evaluate_all('''es=>es.every(e=>{
  const r=e.getBoundingClientRect();
  const body=e.querySelector('.cx-feature-card__body').getBoundingClientRect();
  return body.right<=r.right+1&&body.bottom<=r.bottom+1;
 })''')

with sync_playwright() as p:
 b=p.chromium.launch();ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width in widths:
  page.set_viewport_size({'width':width,'height':900});load(page,a.url)
  assert page.locator('.cxour a.cx-feature-card').count()==3
  assert page.locator('#our-role button,#our-role [aria-expanded],#our-role .is-selected').count()==0
  assert page.locator('.cxour .cx-feature-card').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().height>=44)')
  assert page.locator('.cxour-card--impact .cx-feature-card__num').count()==0
  if width==1440: assert page.locator('#cxour-title').evaluate('e=>e.getBoundingClientRect().height<parseFloat(getComputedStyle(e).lineHeight)*1.1'), '1440px headline must be one line'
  assert page.locator('#our-role').evaluate("e=>getComputedStyle(e.querySelector('.cx-feature-card')).flexDirection") == ('row' if width<=899 else 'column')
  check(page)
  for lang in ('en','ja'):
   page.evaluate('(l)=>i18n.switchLang(l)',lang);page.wait_for_function('(l)=>document.documentElement.lang===l',arg=lang)
   check(page)
  assert page.locator('.cxour__title em').inner_text()=='広げる。'
  page.locator('#our-role img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
  page.wait_for_function('[...document.querySelectorAll("#our-role img")].every(e=>e.complete&&e.naturalWidth)')
  assert page.locator('#our-role picture img').evaluate_all('''es=>es.every(e=>{
    const s=e.parentElement.querySelector('source');const src=innerWidth<=899?s:e;
    return e.naturalWidth===+src.getAttribute('width')&&e.naturalHeight===+src.getAttribute('height');
  })''')
  if width in (320,390,768,1024,1440):
   style=page.add_style_tag(content='header{visibility:hidden!important}')
   page.locator('#our-role').screenshot(path=str(out/f'role-{width}.png'));style.evaluate('e=>e.remove()')
  page.locator('#our-role').evaluate('''e=>e.querySelectorAll('h2,h3,p,.cx-feature-card__desc').forEach(n=>{
   n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.4+'px';
  })''');check(page)
 # Compare the HERO and every unchanged section by dimensions and HTML.
 for width in (390,1440):
  page.set_viewport_size({'width':width,'height':900});layouts=[]
  for url in (a.base,a.url):
   load(page,url)
   layouts.append(page.locator('main > section:not(#our-role)').evaluate_all('''es=>es.map(e=>({html:e.outerHTML,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))'''))
  assert layouts[0]==layouts[1],('Surrounding sections changed',width)
 # Check actual destinations in both languages; the third card is a mission link.
 for lang in ('ja','en'):
  for index,path in enumerate(('/services/creative-x/','/services/sales-x/','/about')):
   load(page,a.url);page.evaluate('(l)=>i18n.switchLang(l)',lang)
   page.wait_for_function('(l)=>document.documentElement.lang===l',arg=lang)
   page.locator('.cxour a.cx-feature-card').nth(index).click()
   page.wait_for_url('**'+path+('**' if index<2 else '**#mission'))
   assert urlsplit(page.url).path==path
   if index==2: assert urlsplit(page.url).fragment=='mission'
 load(page,a.url);page.locator('.cxour__next').click();page.wait_for_function("location.hash==='#mission'")
 assert page.locator('#mission').evaluate('e=>Math.abs(e.getBoundingClientRect().top-80)<2')
 load(page,a.url);page.locator('.cxour a.cx-feature-card').first.focus()
 assert page.locator('.cxour a.cx-feature-card').first.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
 ctx.close()
 for js in (False,True):
  ctx=b.new_context(java_script_enabled=js,reduced_motion='no-preference',viewport={'width':390,'height':844});page=ctx.new_page();load(page,a.url)
  page.locator('#our-role').scroll_into_view_if_needed();assert page.locator('#cxour-title').is_visible();check(page);ctx.close()
 assert not errors,errors
 b.close()
print(f'PASS: {len(widths)} widths, JA/EN, 1.4x text, shared cards, real links, keyboard focus, unchanged existing sections, JS/reduced motion')
