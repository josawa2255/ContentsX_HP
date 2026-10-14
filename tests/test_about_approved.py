"""Approved About composition: responsive text, picture cards, CTA routes, stable header/footer."""
import argparse,json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--url',default='http://127.0.0.1:8870');ap.add_argument('--base',default='http://127.0.0.1:8871');ap.add_argument('--artifacts',default='/tmp/cx-about-exact/verified');ap.add_argument('--widths',default='320,360,390,412,448,481,640,768,898,899,900,1023,1024,1025,1100,1101,1280,1440,1920');a=ap.parse_args()
for u in (a.url,a.base):assert urlsplit(u).hostname in ('127.0.0.1','localhost')
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
widths=[int(x) for x in a.widths.split(',')]
sections=['.ax-hero','#business','#our-role','#mission','#values','#message','#future','#next-action']
def load(page,url):
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','https://fonts.')) else r.abort())
 page.set_default_navigation_timeout(90000);page.goto(url+'/about',wait_until='networkidle');page.evaluate('document.fonts.ready')
def check(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Horizontal overflow'
 if page.viewport_size['width']==1440:assert page.locator('.cx-about-next__cards').evaluate('e=>getComputedStyle(e).marginRight')=='125px', 'CTA right margin missing'
 bad=page.locator('main').evaluate('''e=>{const bad=[];const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(w.nextNode()){
 const t=w.currentNode,p=t.parentElement;if(!t.textContent.trim()||!p.getClientRects().length||p.closest('[aria-hidden=true],.sr-only,.axl-sr,.axl-motto,.cxour__motto,.cx-about-next__category,.cx-feature-card__no,.ax-hero-story,.ax-hero-caption,.ax-hero-cross-copy,.ax-hero-creative-copy,.ax-why__photo-label'))continue;
 const r=document.createRange();r.selectNodeContents(t);for(const b of r.getClientRects())if(b.left<-2||b.right>innerWidth+2)bad.push(t.textContent);
 }return bad;}''');assert not bad,bad
 assert page.locator('#business .ax-why__card').evaluate_all('es=>es.every(e=>{const t=e.querySelector(".ax-why__photo-copy").getBoundingClientRect(),l=e.querySelector(".ax-why__photo-label").getBoundingClientRect(),b=e.getBoundingClientRect();return e.querySelector(".ax-why__photo-overline").getBoundingClientRect().top>=l.bottom+8&&t.bottom<=b.bottom+1})'), page.locator('#business .ax-why__card').evaluate_all('es=>es.map(e=>[e.getBoundingClientRect().height,e.querySelector(".ax-why__photo-copy").getBoundingClientRect().toJSON(),e.querySelector(".ax-why__photo-label").getBoundingClientRect().toJSON()])')
 assert page.locator('.ax-hero-caption--meeting').evaluate('e=>e.getBoundingClientRect().height<160'), 'Meeting caption stretched over the photo'
 assert page.locator('#mission .axl-link-circle').count()==2, 'Mission/Vision arrow lost after language switch'
 assert page.locator('#values article').count()==3
 assert page.locator('#business article').count()==2
 assert page.locator('.cx-about-next__card').count()==2
 assert not page.locator('section#philosophy').count()
 assert page.locator('[data-cx-page-cta]').count()==1
 assert not page.locator('.cx-footer__contact').is_visible()
 assert page.locator('.cx-footer__nav').is_visible()
with sync_playwright() as p:
 b=p.chromium.launch();ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for w in widths:
  print('width',w,flush=True)
  page.set_viewport_size({'width':w,'height':900});load(page,a.url);check(page)
  for lang in ['en','ja']:
   page.evaluate('(l)=>i18n.switchLang(l)',lang);check(page)
   if w in (320,390,768,1024,1440):
    sizes=page.locator('main h1,main h2:not(.sr-only),main h3,main p:not([aria-hidden]):not(.ax-hero-art p),main .cx-feature-card__desc').evaluate_all('es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize))')
    page.locator('main h1,main h2:not(.sr-only),main h3,main p:not([aria-hidden]):not(.ax-hero-art p),main .cx-feature-card__desc').evaluate_all('(es,sizes)=>es.forEach((e,i)=>e.style.fontSize=sizes[i]*1.4+"px")',sizes);check(page)
    page.locator('main [style]').evaluate_all('es=>es.forEach(e=>e.style.removeProperty("font-size"))')
  if w in (320,390,768,1024,1440,1920):
   page.locator('img').evaluate_all('es=>es.forEach(e=>e.loading="eager")');page.wait_for_function('[...document.images].every(e=>e.complete)');page.evaluate('Promise.all([...document.images].filter(e=>e.naturalWidth).map(e=>e.decode()))')
   assert page.locator('main img[src$="webp"]').evaluate_all('es=>es.every(e=>{const source=e.closest("picture")?.querySelector("source");const node=source&&matchMedia(source.media).matches?source:e;return e.naturalWidth===+node.getAttribute("width")&&e.naturalHeight===+node.getAttribute("height")})')
   st=page.add_style_tag(content='header{visibility:hidden!important}')
   for sec in sections:
    for im in page.locator(sec+' img').all():im.scroll_into_view_if_needed();page.wait_for_timeout(80)
    page.locator(sec).screenshot(path=str(out/(sec.replace('.','').replace('#','')+f'-{w}.png')))
   st.evaluate('e=>e.remove()')
 for w in (390,1440):
  page.set_viewport_size({'width':w,'height':900});ss=[]
  for u in (a.base,a.url):
   load(page,u);ss.append(page.locator('header,footer').evaluate_all('es=>es.map(e=>e.outerHTML)'))
  assert ss[0]==ss[1], 'Header/footer markup changed'
 for lang in ['ja','en']:
  for sel,i,path in [('.cxour-card',0,'/services/creative-x/'),('.cxour-card',1,'/services/sales-x/'),('.axl-future a.axl-card',0,'/services/sales-x/'),('.axl-future a.axl-card',1,'/services/creative-x/'),('.axl-future a.axl-card',2,'/contact'),('.cx-about-next__card',0,'/contact'),('.cx-about-next__card',1,'/recruit'),('.axl-message .axl-text-link',0,'/message'),('.axl-mv .axl-text-link',0,'/services/')]:
   load(page,a.url);page.evaluate('(l)=>i18n.switchLang(l)',lang);page.locator(sel).nth(i).click();page.wait_for_url('**'+path+'**');assert urlsplit(page.url).path==path
 load(page,a.url)
 for sel in ['.cx-about-next__card','.cxour-card','.ax-why__next']:
  page.locator(sel).first.focus();assert page.locator(sel).first.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
 page.set_viewport_size({'width':390,'height':844});page.locator('#hamburger').click();assert page.locator('#nav').is_visible();page.locator('#hamburger').click()
 page.evaluate('i18n.switchLang("ja")');assert '黒宮' in page.locator('#message').inner_text() and '田中' not in page.locator('#message').inner_text()
 ctx.close()
 for js in [False,True]:
  ctx=b.new_context(java_script_enabled=js,reduced_motion='no-preference',viewport={'width':390,'height':844});page=ctx.new_page();load(page,a.url);check(page);ctx.close()
 ctx=b.new_context(viewport={'width':390,'height':844});page=ctx.new_page();page.route('**/*',lambda r:r.abort() if r.request.resource_type=='image' else r.continue_());load(page,a.url);check(page);assert page.locator('#next-action a').count()==2;ctx.close()
 assert not errors,errors;b.close()
print(f'PASS: {len(widths)} widths; JA/EN/1.4x text; complete approved sequence; photos; CTA routes; focus; JS/reduced motion; preserved header/footer')
