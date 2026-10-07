"""Representative message: supplied manuscript, readable layout and restrained motion.
Run against a loopback preview only: python3 tests/test_message.py --url http://127.0.0.1:8777
"""
import argparse, json, re
from pathlib import Path
from urllib.parse import urlsplit
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
WIDTHS = [320,375,390,412,448,480,481,640,767,768,769,1023,1024,1025,1199,1200,1201,1280,1440,1920]
# Exact user-supplied copy, including punctuation and spaces.
HEADLINE = '全国で見てきたあの光景を、一社ずつ変えていきたい。'
EXPECTED = [
    "Contents X株式会社 代表取締役の黒宮大貴です。",
    "私は平成2年、三重県四日市市で生まれました。町工場や商店街がまだにぎやかで、昭和の空気が残る街です。社会に出てからは、スマートフォンやSNS、そしてAIが当たり前になっていく変化を、仕事の現場で経験してきました。昔のやり方も今の感覚も、どちらも肌で知っている「狭間の世代」だと思っています。",
    "大学進学を機に上京し、株式会社キーエンスで約8年間、法人営業を担当しました。東北、北陸、関西と全国の会社を訪ねました。その後の4年間は、中小製造業の事業承継やM&Aに携わり、経営者の方々と会社の将来について向き合ってきました。自身でも製造業の会社を創業し、ものをつくる側の立場も経験しています。こうした仕事を通じて、素晴らしい技術や商品をつくる会社に、数えきれないほど出会いました。",
    "同じくらい多く出会ったのが、その良さが世の中に伝わっていない会社です。商品やサービスは良く、働く人も真剣です。ただ、営業や採用のやり方が昔のままで、伝え方が時代に追いついていませんでした。全国どこへ行っても、同じ光景がありました。",
    "伝え方や売り方、採用のやり方は、今の時代に合わせて変えることができます。必要なのは、新しいやり方を知る機会と、最初の一歩を一緒に踏み出す相手です。",
    "Contents Xは、その最初の一歩を引き受けるためにつくった会社です。見込み客に見つけてもらうところから、商品の良さを伝えて契約につなげるところまで、営業の仕組みとマンガや映像を使ってお手伝いします。",
    "昭和と令和、地方と東京。その両方を知っているからこそ、お役に立てることがあると考えています。全国で見てきたあの光景を、一社ずつ変えていきたいと思っています。御社とご一緒できる日を楽しみにしています。"
]

def content(page):
    return [x.strip() for x in page.locator('.cm-chapter > p').all_text_contents()]

def overflow(page):
    return page.evaluate('Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth')

def load(page,path=PATH):
    response=page.goto(BASE+path, wait_until='networkidle')
    assert response.status == 200, (path,response.status)
    page.evaluate('document.fonts.ready')
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    if page.locator('.cm-hero-copy').count():
        page.wait_for_function('getComputedStyle(document.querySelector(".cm-hero-copy")).opacity==="1"')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chrome')
    context=browser.new_context(viewport={'width':1440,'height':1000})
    # Avoid analytics and live third-party calls during preview.
    context.route(re.compile(r'https?://(?!127\.0\.0\.1|localhost)'), lambda r:r.abort())
    page=context.new_page(); errors=[]; missing=[]; cms_requests=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('request', lambda r:cms_requests.append(r.url) if urlsplit(r.url).hostname=='cms.contentsx.jp' or '/wp-json/' in r.url else None)
    page.on('response', lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
    load(page)
    assert page.locator('h1').count()==1
    assert content(page)==EXPECTED, 'Original manuscript changed or truncated'
    assert page.locator('.cm-chapter').count()==4
    assert page.locator('.cm-chapter h2').all_text_contents()==['01 原点とこれまで','02 全国で見てきた光景','03 Contents Xをつくった理由','04 これから']
    assert page.locator('.cm-chapter [data-cm-reveal]').count()==0
    assert page.locator('[data-cm-reveal]').count()==3
    assert page.locator('.cm-team img').get_attribute('src')=='/material/images/message-2026/team-original.webp'
    assert page.locator('script[src*=wp]').count()==0
    assert page.locator('h1').text_content()==HEADLINE
    assert page.locator('.cm-hero img').get_attribute('src')=='/material/images/message-2026/portrait-original.webp'
    assert page.locator('.cm-related img').count()==3
    assert page.locator('.cm-signature p').all_text_contents()==['Contents X株式会社','代表取締役　黒宮 大貴']
    assert page.locator('.cm-chapter >p').first.evaluate('(e)=>e.getBoundingClientRect().width')==720
    assert page.locator('.cm-scene-row').evaluate('(e)=>e.querySelector(".cm-scene p").textContent.trim().endsWith("全国どこへ行っても、同じ光景がありました。") && e.nextElementSibling.querySelector("p").textContent.trim().startsWith("伝え方や売り方")')
    assert page.locator('link[rel=canonical]').get_attribute('href')=='https://contentsx.jp'+PATH
    assert page.locator('script[src$="i18n.js"]').evaluate('(e)=>e.compareDocumentPosition(document.querySelector("script[src$=\\\"nav.js\\\"]")) & Node.DOCUMENT_POSITION_FOLLOWING')
    page.locator('img[loading="lazy"]').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
    page.wait_for_function('Array.from(document.images).every(e=>e.complete && e.naturalWidth>0)')
    # Use intrinsic HTML dimensions, because the intentional hero crop has a different CSS ratio.
    assert page.locator('img').evaluate_all('(es)=>es.every(e=>Math.abs(e.naturalWidth/e.naturalHeight-Number(e.getAttribute("width"))/Number(e.getAttribute("height")))<.001)')
    assert page.locator('#nav a',has_text='お問い合わせ').evaluate('(e)=>new URL(e.href).pathname')=='/contact'
    for width in WIDTHS:
        page.set_viewport_size({'width':width,'height':1000}); load(page)
        assert overflow(page)<=1, ('overflow',width,overflow(page))
        assert page.locator('.cm-chapter').first.evaluate('(e)=>getComputedStyle(e).paddingTop')=='0px'
        if width<=1024:
            rects=page.locator('.cm-hero-image,.cm-hero-copy,.cm-message').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().toJSON())')
            assert rects[0]['bottom']<=rects[1]['top']+1 and rects[1]['bottom']<=rects[2]['top']+1, (width,rects)
            if width<=768:
                size=page.locator('.cm-chapter > p').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
                assert 16<=size<=17, (width,size)
        else:
            rects=page.locator('.cm-hero-image,.cm-hero-copy').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().toJSON())')
            assert rects[0]['right']<=rects[1]['left']+1, ('hero overlaps',width,rects)
        labels=page.locator('.cm-chapter-num').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().toJSON())')
        assert all(r['left']>=0 and r['right']<=width for r in labels), ('chapter labels',width,labels)
        scene=page.locator('.cm-scene').bounding_box(); photo=page.locator('.cm-team').bounding_box()
        if width>1024:
            assert photo['x']+photo['width']<=scene['x'], ('scene split',width)
        else:
            assert scene['y']+scene['height']<=photo['y']+1, ('scene order',width)
        if width in (320,390,768,1024,1440,1920):
            page.locator('.cm-team img').evaluate('(e)=>e.loading="eager"')
            page.wait_for_function('document.querySelector(".cm-team img").complete && document.querySelector(".cm-team img").naturalWidth>0')
            # Scroll every block into view so a full-page capture contains the entire message.
            for item in page.locator('[data-cm-reveal]').all():
                item.scroll_into_view_if_needed(); page.wait_for_timeout(80)
            page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
            page.wait_for_timeout(1100)
            page.screenshot(path=str(OUT/f'message-{width}.png'), full_page=True,animations='disabled')
            page.screenshot(path=str(OUT/f'message-fold-{width}.png'),animations='disabled')
    # Text enlargement on representative phone and desktop breakpoints.
    for width in (320,412,640,768,1024,1025,1440):
        page.set_viewport_size({'width':width,'height':1000}); load(page)
        page.locator('main :is(h1,h2,p,a,li)').evaluate_all('(es)=>{const s=es.map(e=>parseFloat(getComputedStyle(e).fontSize)*1.4);es.forEach((e,i)=>e.style.fontSize=s[i]+"px")}')
        assert overflow(page)<=1, ('enlarged text',width)
        if width>=1025:
            assert page.locator('.cm-hero-copy').evaluate('(e)=>e.getBoundingClientRect().right<=document.querySelector(".cm-hero-image").getBoundingClientRect().left+1'), ('enlarged hero',width)
    load(page)
    page.evaluate("window.i18n.switchLang('en')")
    page.wait_for_function('document.documentElement.lang==="en"')
    assert page.locator('h1').inner_text()=='Changing the scene I’ve seen across Japan, one company at a time.'
    for width in (320,390,640,768,1025,1440):
        page.set_viewport_size({'width':width,'height':1000}); assert overflow(page)<=1, ('English',width)
    page.evaluate("window.i18n.switchLang('ja')")
    assert content(page)==EXPECTED, 'JP/EN round trip changed original copy'
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
    # Prose stays stationary; only the Hero and meeting photograph reveal.
    load(page); page.set_viewport_size({'width':390,'height':844}); load(page)
    static_content='.cm-chapter'
    assert page.locator(static_content).evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1" && getComputedStyle(e).transform==="none" && getComputedStyle(e).transitionDuration==="0s")')
    for item in page.locator('[data-cm-reveal]').all():
        item.scroll_into_view_if_needed()
        page.wait_for_function('(e)=>e.classList.contains("cm-visible")',arg=item.element_handle())
    page.wait_for_timeout(1100)
    assert page.locator('[data-cm-reveal]').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1")')
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})'); page.wait_for_timeout(100)
    page.mouse.wheel(0,300); page.wait_for_timeout(200)
    assert page.evaluate('scrollY')>0
    assert page.locator(static_content).evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1" && getComputedStyle(e).transform==="none")')
    load(page); page.emulate_media(reduced_motion='reduce')
    assert page.locator('[data-cm-reveal]').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1" && getComputedStyle(e).transitionDuration==="0s")')
    page.emulate_media(reduced_motion='no-preference')
    # Every paragraph remains readable with reduced motion and with JavaScript disabled.
    for mode in ('reduce','no-js','no-observer','observer-error'):
        c=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js',reduced_motion='reduce' if mode in ('reduce','no-js') else 'no-preference')
        c.route(re.compile(r'https?://(?!127\.0\.0\.1|localhost)'),lambda r:r.abort())
        if mode=='no-observer': c.add_init_script('delete window.IntersectionObserver')
        if mode=='observer-error': c.add_init_script('window.IntersectionObserver=function(){throw new Error("simulated failure")}')
        q=c.new_page(); load(q)
        assert content(q)==EXPECTED
        assert q.locator('[data-cm-reveal]').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).opacity==="1")')
        c.close()
    assert not errors, errors
    assert not missing, missing
    assert not cms_requests, cms_requests
    report={'widths':WIDTHS,'paragraphs':len(EXPECTED),'manuscript':'unchanged','enlargement':'1.4x pass','motion':'Hero and photo only; prose always visible; live reduced-motion pass','static_page':'no WordPress requests','language_roundtrip':'pass','touch_navigation':'pass','assets':'pass','console':'pass','no_js_reduced_motion':'pass'}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
    context.close(); browser.close()
