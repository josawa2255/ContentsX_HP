from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json, hashlib
import argparse
parser = argparse.ArgumentParser(description="TabLabo local preview checks (requires Python Playwright and Chrome)")
parser.add_argument('--url', default='http://127.0.0.1:8769')
parser.add_argument('--output', default='/private/tmp/tablabo-preview')
args = parser.parse_args()
BASE = args.url.rstrip('/')
assert urlsplit(BASE).hostname in ('localhost', '127.0.0.1', '::1'), 'Use a local preview only'
URL=BASE+'/extensions/tablabo/oauth/consent/'
OUT=Path(args.output); OUT.mkdir(parents=True, exist_ok=True)
SDK='''window.supabase={createClient:(url,key,options)=>{window.sdkOptions=options;return {auth:{getSession:async()=>({data:{session:SESSION}}),signInWithOAuth:async(args)=>{window.loginArgs=args;return {data:{},error:null}},oauth:{getAuthorizationDetails:async(id)=>({data:DETAILS,error:DETAIL_ERROR}),approveAuthorization:async(id)=>{window.approvedId=id;return DECISION},denyAuthorization:async(id)=>{window.deniedId=id;return DECISION}}}}}};'''
# Upstream consent.html supplied on 2026-10-07, copied without modifications.
consent = Path(__file__).resolve().parents[1] / 'extensions/tablabo/oauth/consent/index.html'
assert hashlib.sha256(consent.read_bytes()).hexdigest() == '6e703d71c90c6d5a9f9aa55b1dc2a4d069258f42efe3144279f4443b7b02163e'
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 probe=browser.new_page()
 probe.route('**/supabase.js',lambda r:r.fulfill(content_type='application/javascript',body=''))
 probe.goto(URL.rstrip('/')+'?authorization_id=test',wait_until='networkidle')
 assert probe.url==URL+'?authorization_id=test', probe.url
 probe.close()
 for scenario in ['missing','login','invalid','approve','deny','error']:
  for width in ([320,390,768,1440] if scenario=='login' else [390]):
   session=None if scenario in ['missing','login'] else {'user':{'email':'test@example.com'}}
   details={'client':{'name':'Demo AI <img src=x onerror=alert(1)>'},'redirect_uri':'https://example.com/callback'}
   error={'message':'invalid'} if scenario=='invalid' else None
   decision={'error':{'message':'failed'}} if scenario=='error' else {'data':{'redirect_url':BASE+'/extensions/?decision='+scenario},'error':None}
   mock=SDK.replace('SESSION',json.dumps(session)).replace('DETAILS',json.dumps(details)).replace('DETAIL_ERROR',json.dumps(error)).replace('DECISION',json.dumps(decision))
   context=browser.new_context(viewport={'width':width,'height':844}); errors=[]; auth_requests=[]
   context.route('**/supabase.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=mock))
   context.route('**/*.supabase.co/**',lambda r:(auth_requests.append(r.request.url),r.abort()))
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   query='' if scenario=='missing' else '?authorization_id=test%2Fid%2Bvalue'
   r=page.goto(URL+query,wait_until='networkidle'); assert r.status==200
   assert page.url==URL+query, page.url
   assert page.locator('meta[name=robots]').get_attribute('content')=='noindex'
   assert page.locator('header,footer,base').count()==0
   if scenario=='missing': assert 'AI アプリからの接続のときだけ' in page.locator('#app').inner_text()
   elif scenario=='login':
    assert page.get_by_role('heading',name='TabLabo にログイン').is_visible()
    page.screenshot(path=str(OUT/f'oauth-login-{width}.png'),full_page=True)
    page.get_by_role('button',name='Google でログイン').click()
    args=page.evaluate('window.loginArgs'); assert args['provider']=='google'
    u=urlsplit(args['options']['redirectTo']); assert u.path==urlsplit(URL).path
    assert parse_qs(u.query)=={'authorization_id':['test/id+value']}
   elif scenario=='invalid': assert 'この接続の情報を確認できませんでした' in page.locator('#app').inner_text()
   else:
    assert '<img src=x onerror=alert(1)>' in page.locator('h1').inner_text(); assert page.locator('#app img').count()==0
    page.screenshot(path=str(OUT/f'oauth-{scenario}.png'),full_page=True)
    if scenario=='error':
     page.get_by_role('button',name='許可する',exact=True).click()
     assert '処理できませんでした' in page.locator('#err').inner_text()
     assert page.get_by_role('button',name='許可する',exact=True).is_enabled()
     assert page.url==URL+query
    else:
     page.get_by_role('button',name='許可する' if scenario=='approve' else '許可しない',exact=True).click()
     page.wait_for_url(BASE+'/extensions/?decision='+scenario)
   assert not auth_requests,auth_requests; assert not errors,errors
   assert page.evaluate('document.body.scrollWidth<=innerWidth'),(scenario,width)
   report.append({'scenario':scenario,'width':width,'query':'pass','production_auth_requests':0})
   context.close()
 browser.close()
(OUT/'oauth-report.json').write_text(json.dumps(report,indent=2))
print('OAuth PASS: missing ID, login, invalid ID, approve, deny, recoverable error; no production auth requests.')
