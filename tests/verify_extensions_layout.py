from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit, parse_qs
import json
import argparse
parser = argparse.ArgumentParser(description="TabLabo local preview checks (requires Python Playwright and Chrome)")
parser.add_argument('--url', default='http://127.0.0.1:8769')
parser.add_argument('--output', default='/private/tmp/tablabo-preview')
args = parser.parse_args()
BASE = args.url.rstrip('/')
assert urlsplit(BASE).hostname in ('localhost', '127.0.0.1', '::1'), 'Use a local preview only' 
OUT=Path(args.output); OUT.mkdir(parents=True, exist_ok=True)
WIDTHS=[320,375,390,412,448,640,768,899,900,901,1024,1200,1280,1281,1440,1920]
PATHS=['/extensions/','/extensions/tablabo/','/extensions/tablabo/privacy','/extensions/tablabo/terms']
report=[]
def overflow(page):
 return page.evaluate('({body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth})')
def load(page,path):
 r=page.goto(BASE+path,wait_until='networkidle'); assert r.status==200,(path,r.status)
 page.evaluate('document.fonts.ready'); return r
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 for path in PATHS:
  page=browser.new_page(viewport={'width':1440,'height':1000}); errors=[]; missing=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
  load(page,path)
  assert page.locator('h1').count()==1
  page.locator('img[loading=lazy]').evaluate_all('(ns)=>ns.forEach(e=>e.loading="eager")')
  page.wait_for_function('(Array.from(document.images).every(e=>e.complete))')
  assert page.locator('img').evaluate_all('(ns)=>ns.every(e=>e.complete && e.naturalWidth>0 && Math.abs(e.naturalWidth/e.naturalHeight-Number(e.getAttribute("width"))/Number(e.getAttribute("height")))<0.001)')
  # Deep routes must resolve the shared nav to the corporate root.
  assert page.locator('#nav a',has_text='お問い合わせ').get_attribute('href')=='contact'
  assert page.locator('#nav a',has_text='お問い合わせ').evaluate('(e)=>new URL(e.href).pathname')=='/contact'
  for width in WIDTHS:
   page.set_viewport_size({'width':width,'height':1000}); page.wait_for_timeout(60)
   m=overflow(page); assert max(m['html'],m['body'])<=width+1,(path,width,m)
   if width in [320,390,768,1024,1440,1920]:
    page.screenshot(path=str(OUT/(path.strip('/').replace('/','-')+f'-{width}.png')),full_page=True,animations='disabled')
   if width<=1280:
    page.locator('#hamburger').click(); assert page.locator('#nav').evaluate('(e)=>getComputedStyle(e).visibility')!='hidden'
    page.locator('#hamburger').click()
  page.set_viewport_size({'width':412,'height':900})
  page.locator('main :is(h1,h2,h3,p,li,a,th,td)').evaluate_all('(ns)=>{const sizes=ns.map(e=>parseFloat(getComputedStyle(e).fontSize)*1.4);ns.forEach((e,i)=>e.style.fontSize=sizes[i]+"px")}')
  m=overflow(page); assert max(m['html'],m['body'])<=413,('text enlargement',path,m)
  assert not errors,errors; assert not missing,missing
  report.append({'path':path,'widths':WIDTHS,'text1.4x':'pass','console':'pass','assets':'pass'})
  page.close()
 # English layouts use longer copy. Legal body remains in Japanese.
 for path in PATHS:
  page=browser.new_page(viewport={'width':390,'height':900})
  page.add_init_script('localStorage.setItem("cx-lang","en")')
  load(page,path)
  assert max(overflow(page)['html'],overflow(page)['body'])<=391
  if path in PATHS[:2]: assert not page.locator('h1').inner_text().startswith(('Chrome 拡張','いつもの'))
  else: assert 'TabLabo' in page.locator('h1').inner_text() and '草案' not in page.locator('main').inner_text()
  page.close()
 # Actual directory -> detail -> terms navigation, then contact CTA.
 page=browser.new_page(viewport={'width':390,'height':900}); load(page,PATHS[0])
 page.get_by_role('link',name='詳しく見る →',exact=True).click(); page.wait_for_url(BASE+PATHS[1])
 page.get_by_role('link',name='TabLabo 利用規約',exact=True).click(); page.wait_for_url(BASE+PATHS[3]); assert page.locator('article h2').count()==10
 page.close()
 page=browser.new_page(viewport={'width':390,'height':900})
 load(page,PATHS[1])
 page.route(BASE+'/contact',lambda r:r.fulfill(content_type='text/html; charset=utf-8',body='<h1>お問い合わせ先の遷移確認</h1>'))
 page.get_by_role('link',name='限定公開中・お問い合わせ',exact=True).first.click()
 page.wait_for_url(BASE+'/contact')
 page.get_by_role('heading',name='お問い合わせ先の遷移確認').wait_for(state='visible')
 page.close()
 # JavaScript disabled and reduced motion must keep all product content visible.
 page=browser.new_page(java_script_enabled=False,viewport={'width':390,'height':900},reduced_motion='reduce'); load(page,PATHS[1]); assert page.locator('h1').is_visible(); assert page.locator('.ext-feature').count()==4; page.close()
 browser.close()
(OUT/'layout-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Layout PASS: 4 pages × 16 widths; text enlargement, EN, navigation, images, JS disabled.')
