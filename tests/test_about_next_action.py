"""About NEXT ACTION integration and regression; loopback only."""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url',default='http://127.0.0.1:8860');ap.add_argument('--base',default='http://127.0.0.1:8861');ap.add_argument('--artifacts',default='/tmp/cx-next-161')
a=ap.parse_args()
for u in (a.url,a.base):assert urlsplit(u).hostname in ('127.0.0.1','localhost')
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
widths=[320,359,360,375,390,412,448,481,640,768,898,899,900,1024,1100,1101,1280,1440,1920]
def load(page,url,path='/about'):
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','https://fonts.')) else r.abort())
 page.goto(url+path,wait_until='networkidle');page.evaluate('document.fonts.ready')
def check(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.locator('#next-action').evaluate('''e=>{
 const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
 while(walk.nextNode()){
 const t=walk.currentNode,p=t.parentElement;
 if(!t.textContent.trim()||!p.getClientRects().length||p.closest('[aria-hidden=true]'))continue;
 const r=document.createRange();r.selectNodeContents(t);
 for(const b of r.getClientRects())if(b.left<-1||b.right>innerWidth+1)return false;
 }return true;}''')
 assert page.locator('.cx-about-next__card').evaluate_all('es=>es.every(e=>{const b=e.getBoundingClientRect();return b.width>=44&&b.height>=44&&[...e.querySelectorAll(".cx-feature-card__title,.cx-feature-card__desc,.cx-about-next__link")].every(n=>{const r=n.getBoundingClientRect();return r.right<=b.right+1&&r.bottom<=b.bottom+1})})')
with sync_playwright() as p:
 b=p.chromium.launch();ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for w in widths:
  page.set_viewport_size({'width':w,'height':900});load(page,a.url)
  assert page.locator('[data-cx-page-cta]').count()==1
  assert page.locator('#next-action').count()==1
  assert page.locator('#next-action a').count()==2
  assert page.locator('#next-action a a,#next-action button').count()==0
  assert not page.locator('.cx-footer__contact').is_visible()
  assert page.locator('.cx-footer__nav').is_visible()
  assert page.locator('.cx-about-next__cards').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')==(1 if w<=899 else 2)
  for lang in ('en','ja'):
   page.evaluate('(l)=>i18n.switchLang(l)',lang);check(page)
  assert page.locator('#cx-about-next-heading span').inner_text()=='ここから一緒に。'
  page.locator('#next-action img').evaluate_all('es=>es.forEach(e=>e.loading="eager")');page.wait_for_function('[...document.querySelectorAll("#next-action img")].every(e=>e.complete&&e.naturalWidth)');page.evaluate('Promise.all([...document.querySelectorAll("#next-action img")].map(e=>e.decode()))')
  assert page.locator('#next-action img').evaluate_all('es=>es.every(e=>e.naturalWidth===+e.getAttribute("width")&&e.naturalHeight===+e.getAttribute("height"))')
  if w in (320,390,768,1024,1440):
   st=page.add_style_tag(content='header{visibility:hidden!important}')
   for im in page.locator('#next-action img').all():im.scroll_into_view_if_needed();page.wait_for_timeout(100)
   page.locator('#next-action').screenshot(path=str(out/f'next-{w}.png'));st.evaluate('e=>e.remove()')
   if w in (390,1440):page.screenshot(path=str(out/f'footer-{w}.png'))
  page.locator('#next-action').evaluate('e=>e.querySelectorAll("h2,p,.cx-feature-card__title,.cx-feature-card__desc,.cx-about-next__link").forEach(n=>n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.4+"px")');check(page)
 for w in (390,1440):
  page.set_viewport_size({'width':w,'height':900});states=[]
  for url in (a.base,a.url):
   load(page,url);states.append(page.locator('main > section:not([data-cx-page-cta]),header,footer').evaluate_all('es=>es.map(e=>({html:e.outerHTML,w:e.tagName==="FOOTER"?0:e.getBoundingClientRect().width,h:e.tagName==="FOOTER"?0:e.getBoundingClientRect().height}))'))
  assert states[0]==states[1],('Other sections/header/footer HTML changed',w)
 for lang in ('ja','en'):
  for i,path in enumerate(('/contact','/recruit')):
   load(page,a.url);page.evaluate('(l)=>i18n.switchLang(l)',lang);page.locator('#next-action a').nth(i).click();page.wait_for_url('**'+path+'**');assert urlsplit(page.url).path==path
 load(page,a.url);page.locator('#next-action a').first.focus();assert page.locator('#next-action a').first.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
 page.locator('#next-action a').first.hover();assert page.locator('#next-action a').first.evaluate('e=>getComputedStyle(e).transform')=='none'
 ctx.close()
 for js in (False,True):
  ctx=b.new_context(java_script_enabled=js,reduced_motion='no-preference',viewport={'width':390,'height':844});page=ctx.new_page();load(page,a.url);check(page);assert page.locator('#next-action a').count()==2;ctx.close()
 assert not errors,errors;b.close()
print(f'PASS: {len(widths)} widths, JA/EN, 1.4x text, CTA routes, focus, JS/reduced motion, preserved front/header/footer HTML')
