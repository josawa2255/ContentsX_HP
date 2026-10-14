"""About 03–06: responsive sequence, real CEO, shared cards, links and preserved front half.
Loopback only: python3 tests/test_about_late.py --url http://127.0.0.1:8835 --base http://127.0.0.1:8836
"""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url',default='http://127.0.0.1:8835');ap.add_argument('--base',default='http://127.0.0.1:8836');ap.add_argument('--artifacts',default='/tmp/cx-late-151/verified')
a=ap.parse_args()
for url in (a.url,a.base):assert urlsplit(url).hostname in ('127.0.0.1','localhost'), 'Loopback only'
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
widths=[320,375,390,412,448,481,640,768,898,899,900,1023,1024,1025,1280,1440,1920]
sections=['mission','values','message','future']
def load(page,url):
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','https://fonts.')) else r.abort())
 page.goto(url+'/about',wait_until='networkidle');page.evaluate('document.fonts.ready')
def check(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.locator('.axl').evaluate_all('''es=>es.every(e=>{
 const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
 while(walk.nextNode()) {
  const t=walk.currentNode,p=t.parentElement;
  if(!t.textContent.trim()||p.closest('[aria-hidden=true],.sr-only')||!p.getClientRects().length)continue;
  const range=document.createRange();range.selectNodeContents(t);
  for(const b of range.getClientRects())if(b.left<-1||b.right>innerWidth+1)return false;
 }
 return true;
 })'''), 'Text outside viewport'
 assert page.locator('.axl a').evaluate_all('es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44})')
 assert page.locator('.axl-card .cx-feature-card__desc').evaluate_all('es=>es.every(e=>{const b=e.closest(".cx-feature-card").getBoundingClientRect(),r=e.getBoundingClientRect();return r.right<=b.right+1&&r.bottom<=b.bottom+1})')
with sync_playwright() as p:
 b=p.chromium.launch();ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for w in widths:
  page.set_viewport_size({'width':w,'height':900});load(page,a.url)
  assert page.locator('.axl-values article.cx-feature-card').count()==3
  assert page.locator('.axl-future a.cx-feature-card').count()==3
  assert page.locator('.axl-values a,.axl-values button').count()==0
  assert page.locator('.axl-portrait img').get_attribute('src')=='/material/images/about-2026/ceo-kuromiya.webp'
  assert '黒宮 大貴' in page.locator('.axl-signature').inner_text()
  assert '田中' not in page.locator('#message').inner_text()
  assert page.locator('#message .axl-body').count()==2
  check(page)
  if w<=1024:
   assert page.locator('.axl-portrait').evaluate('e=>e.getBoundingClientRect().top<document.querySelector(".axl-message-copy").getBoundingClientRect().top')
   for row in page.locator('.axl-mv-row').all():assert row.locator('.axl-mv-copy').evaluate('e=>e.getBoundingClientRect().top<e.parentElement.querySelector("figure").getBoundingClientRect().top')
  assert page.locator('.axl-cards').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')==(1 if w<=899 else 3)
  for lang in ('en','ja'):
   page.evaluate('(l)=>i18n.switchLang(l)',lang);page.wait_for_function('(l)=>document.documentElement.lang===l',arg=lang);check(page)
  assert page.locator('#mission em').first.inner_text()=='アップデートし続ける。'
  page.locator('.axl img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")');page.wait_for_function('[...document.querySelectorAll(".axl img")].every(e=>e.complete&&e.naturalWidth)');page.evaluate('Promise.all([...document.querySelectorAll(".axl img")].map(e=>e.decode()))')
  assert page.locator('.axl img[src$="webp"]').evaluate_all('es=>es.every(e=>e.naturalWidth===+e.getAttribute("width")&&e.naturalHeight===+e.getAttribute("height"))')
  if w in (320,390,768,1024,1440):
   style=page.add_style_tag(content='header{visibility:hidden!important}')
   for sec in sections:
    for im in page.locator('#'+sec+' img').all():im.scroll_into_view_if_needed();page.wait_for_timeout(100)
    page.locator('#'+sec).screenshot(path=str(out/f'{sec}-{w}.png'))
   style.evaluate('e=>e.remove()')
  page.locator('.axl').evaluate_all('es=>es.forEach(e=>e.querySelectorAll("h2,h3,p,.cx-feature-card__desc").forEach(n=>n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.4+"px"))');check(page)
 for w in (390,1440):
  page.set_viewport_size({'width':w,'height':900});states=[]
  for url in (a.base,a.url):
   load(page,url);states.append(page.locator('main > section:not(#mission):not(#values):not(#message):not(#future)').evaluate_all('es=>es.map(e=>({html:e.outerHTML,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))'))
  assert states[0]==states[1],('Existing front/contact changed',w)
 # Verify actual routes without submitting any form.
 for lang in ('ja','en'):
  for i,path in enumerate(('/services/sales-x/','/services/creative-x/','/contact')):
   load(page,a.url);page.evaluate('(l)=>i18n.switchLang(l)',lang);page.wait_for_function('(l)=>document.documentElement.lang===l',arg=lang);page.locator('.axl-future .axl-card').nth(i).click();page.wait_for_url('**'+path+'**');assert urlsplit(page.url).path==path
 load(page,a.url);page.locator('.axl-message .axl-text-link').click();page.wait_for_url('**/message**');assert urlsplit(page.url).path=='/message'
 for sel,target in [('.axl-mv .axl-text-link','values'),('.axl-message .axl-next','future')]:
  load(page,a.url);page.locator(sel).click();page.wait_for_function('(v)=>location.hash==="#"+v',arg=target);assert page.locator('#'+target).evaluate('e=>Math.abs(e.getBoundingClientRect().top-80)<2')
 load(page,a.url);page.locator('.axl-future .axl-card').first.focus();assert page.locator('.axl-future .axl-card').first.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
 ctx.close()
 for js in (False,True):
  ctx=b.new_context(java_script_enabled=js,reduced_motion='no-preference',viewport={'width':390,'height':844});page=ctx.new_page();load(page,a.url);check(page)
  for sec in sections:assert page.locator('#'+sec).is_visible()
  ctx.close()
 assert not errors,errors;b.close()
print(f'PASS: {len(widths)} widths, JA/EN, text 1.4x, mobile sequence, real CEO/copy, links, keyboard focus, front half/contact preserved, JS/reduced motion')
