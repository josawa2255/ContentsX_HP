"""Browser checks for the top HERO (Issue #108). Run against a loopback preview.

python3 tests/test_hero.py --url http://127.0.0.1:8765 --artifacts /tmp/cx-hero-qa
External traffic is blocked; the YouTube IFrame API is replaced by a small stand-in that records the
players and calls (the real embed is checked by hand, see SPEC.md).
"""
import argparse
import json
import struct
import zlib
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--artifacts', required=True)
args = parser.parse_args()
out = Path(args.artifacts)
out.mkdir(parents=True, exist_ok=True)
widths = [320, 375, 390, 412, 430, 448, 480, 481, 640, 767, 768, 769, 1024, 1100, 1101, 1280, 1366, 1440, 1920]
IDS = ['zKvRR8xT_zY', 'IAgFqlvSUfE', 'OYgeXiPByBg']


def png(w, h):
    raw = b''.join(b'\x00' + bytes((90, 110, 160)) * w for _ in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


THUMB = png(480, 360)
YT_STUB = """
window.__yt = { created: [], calls: [] };
window.YT = { Player: function (el, opts) {
  var f = document.createElement('iframe');
  f.src = (opts.host || 'https://www.youtube.com') + '/embed/' + opts.videoId + '?controls=' + opts.playerVars.controls;
  el.replaceWith(f);
  var self = this;
  __yt.created.push({ videoId: opts.videoId, vars: opts.playerVars, host: opts.host });
  ['mute', 'unMute', 'playVideo', 'pauseVideo'].forEach(function (m) { self[m] = function () { __yt.calls.push(m); }; });
  this.loadVideoById = function (id) { __yt.calls.push('load:' + id); };
  this.getCurrentTime = function () { return 3; };
  this.getIframe = function () { return f; };
  this.destroy = function () { __yt.calls.push('destroy'); f.remove(); };
  setTimeout(function () { opts.events.onReady({ target: self }); }, 30);
} };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
"""


def load(page, api=True, wait=1500):
    def route(r):
        u = r.request.url
        if u.startswith('https://www.youtube.com/iframe_api'):
            return r.fulfill(status=200, content_type='text/javascript', body=YT_STUB) if api else r.abort()
        if u.startswith('https://i.ytimg.com/'):
            return r.fulfill(status=200, content_type='image/png', body=THUMB)
        if u.startswith(('http://127.0.0.1:', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')):
            return r.continue_()
        return r.abort()
    page.route('**/*', route)
    page.goto(args.url, wait_until='load')
    page.wait_for_timeout(wait)


def rect(page, selector):
    return page.locator(selector).first.evaluate('e=>e.getBoundingClientRect().toJSON()')


def overlap(a, b):
    return not (a['right'] <= b['left'] or b['right'] <= a['left'] or a['bottom'] <= b['top'] or b['bottom'] <= a['top'])


def created(page):
    return page.evaluate('window.__yt ? __yt.created : []')


def calls(page):
    return page.evaluate('window.__yt ? __yt.calls : []')


CARDS = ['.cxhv-card--creative', '.cxhv-card--business', '.cxhv-card--system']
report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in widths:
        height = 900 if width > 768 else 844
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}px'
        # Copy and links from the design; the old Hero pieces are gone.
        assert page.locator('.cxhv-kicker').inner_text() == 'BUSINESS × CREATIVE'
        assert page.locator('#cxh-hero-title').inner_text().replace('\n', '') == '企業の価値を、売上に変える。'
        assert page.locator('.cxhv-lead').inner_text().replace('\n', '') == '法人の営業と売上づくりを、仕組みとクリエイティブで支援します。'
        actions = page.locator('.cxhv-actions a').evaluate_all('(n)=>n.map(a=>[a.getAttribute("href"),a.textContent.replace(/→/,"").trim()])')
        assert actions == [['/contact', 'お問い合わせ'], ['/services/', 'サービスを見る']], actions
        assert page.locator('.cxh-hero-formula, .cxh-hero-date, .cxh-hero-note, .cxh-hero-visual').count() == 0
        assert 'Noto Serif JP' in page.locator('#cxh-hero-title').evaluate('e=>getComputedStyle(e).fontFamily')
        assert 'Serif' not in page.locator('.cxhv-lead').evaluate('e=>getComputedStyle(e).fontFamily')
        # Cards: Creative (video), business → /about, system → #sales-x; baked-in copy is readable text too.
        assert page.locator('.cxhv-card--business').get_attribute('href') == '/about'
        assert page.locator('.cxhv-card--system').get_attribute('href') == '#sales-x'
        assert '事業を、次のステージへ。' in page.locator('.cxhv-card--business').inner_text()
        assert '仕組みで、成果をつくる。' in page.locator('.cxhv-card--system').inner_text()
        assert page.locator('.cxhv-card--business img').get_attribute('alt') == ''
        # Creative card at rest: only the three pictures; no text, no YouTube player or script.
        assert page.locator('.cxhv-card--creative [data-cxhv-slide] img').count() == 3
        assert page.locator('.cxhv-card--creative').evaluate('e=>e.innerText.trim()') == ''
        assert page.locator('#hero iframe').count() == 0 and created(page) == []
        assert page.evaluate("!document.querySelector('script[src*=\"iframe_api\"]')")
        hero = rect(page, '#hero')
        boxes = [rect(page, s) for s in CARDS]
        for s, b in zip(CARDS, boxes):
            assert b['left'] >= -1 and b['right'] <= width + 1, (width, s, b)
            assert b['top'] >= hero['top'] - 1 and b['bottom'] <= hero['bottom'] + 1, (width, s, b, hero)
        copy_boxes = [rect(page, s) for s in ['#cxh-hero-title', '.cxhv-lead', '.cxhv-actions']]
        if width >= 1101:
            # PC: the first screen holds copy, CTAs and all three cards; cards never cover the copy.
            for b in copy_boxes + boxes:
                assert b['top'] >= 64 - 1 and b['bottom'] <= height + 1, (width, b)
            # The visible text and buttons (not their full-width boxes) stay clear of every card.
            texts = [page.locator(s).evaluate('e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().toJSON()}') for s in ['#cxh-hero-title', '.cxhv-lead', '.cxhv-kicker']]
            texts += page.locator('.cxhv-actions a').evaluate_all('(n)=>n.map(a=>a.getBoundingClientRect().toJSON())')
            for b in boxes:
                for t in texts:
                    assert not overlap(t, b), (width, t, b)
        else:
            # Tablet/SP: copy and CTAs first, then the cards below.
            assert min(b['top'] for b in boxes) >= copy_boxes[2]['bottom'] - 20, (width, boxes, copy_boxes[2])
            assert copy_boxes[2]['bottom'] <= height, f'CTAs below the first screen at {width}px'
        # Body/UI text expansion (Android scaling).
        page.locator('#cxh-hero-title,.cxhv-lead,.cxhv-actions a').evaluate_all(
            '(nodes)=>nodes.forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*1.4)+"px")')
        page.wait_for_timeout(150)
        assert page.evaluate('document.body.scrollWidth <= innerWidth'), f'Overflow with 1.4x text at {width}px'
        if width in [390, 1280, 1440]:
            page.reload(wait_until='load')
            page.wait_for_timeout(1500)
            page.screenshot(path=str(out / f'{width}-hero.png'))
        assert not errors, errors
        report.append({'width': width, 'layout': 'pass'})
        page.close()

    # PC: the pictures move on every 7s while the card is in view; YouTube is not loaded at rest.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    cur = "[...document.querySelectorAll('[data-cxhv-slide]')].findIndex(s=>s.classList.contains('is-current'))"
    assert page.evaluate(cur) == 0
    page.wait_for_timeout(7400)
    assert page.evaluate(cur) == 1 and created(page) == []
    # Sideways scrolling also changes the picture.
    page.locator('[data-cxhv-track]').evaluate('t=>t.scrollTo({left:2*t.clientWidth,behavior:"instant"})')
    page.wait_for_timeout(300)
    assert page.evaluate(cur) == 2
    page.locator('[data-cxhv-track]').evaluate('t=>t.scrollTo({left:t.clientWidth,behavior:"instant"})')
    page.wait_for_timeout(300)
    # Pressing the picture opens it: centre of the Hero's right half, about 1.5× wider, with sound.
    card = page.locator('.cxhv-card--creative')
    base = card.evaluate('e=>e.offsetWidth')
    page.locator('.cxhv-slide.is-current .cxhv-slide-btn').click(force=True)
    page.wait_for_timeout(900)
    box, hero = rect(page, '[data-cxhv-track]'), rect(page, '#hero')
    assert abs((box['left'] + box['right']) / 2 - (hero['left'] + hero['width'] * .75)) < 4, (box, hero)
    assert abs((box['top'] + box['bottom']) / 2 - (hero['top'] + hero['height'] / 2)) < 4, (box, hero)
    assert abs(card.evaluate('e=>e.offsetWidth') / base - 1.5) < .03 or box['right'] <= hero['right'] - 60
    assert box['left'] >= hero['left'] + hero['width'] / 2 - 1, 'stays in the right half'
    made = created(page)
    assert len(made) == 1 and made[0]['videoId'] == IDS[1], made
    assert made[0]['vars']['mute'] == 0 and made[0]['vars']['controls'] == 1 and made[0]['host'] == 'https://www.youtube-nocookie.com'
    assert page.locator('#hero iframe').count() == 1, 'one player at a time'
    assert page.evaluate("document.activeElement.classList.contains('cxhv-close')")
    assert page.locator('.cxhv-card--business').evaluate('e=>e.inert && getComputedStyle(e).opacity < .5')
    assert rect(page, '.cxhv-copy')['right'] <= box['left'], 'copy stays visible'
    # ‹ › and × sit outside the picture; nothing is laid over the player.
    for s in ['.cxhv-nav--prev', '.cxhv-nav--next', '.cxhv-close']:
        assert not overlap(rect(page, s), box), s
    mid = page.evaluate('([x,y])=>document.elementFromPoint(x,y).tagName', [(box['left'] + box['right']) / 2, (box['top'] + box['bottom']) / 2])
    assert mid == 'IFRAME', mid
    # Moving to another video plays that one (the row settles, then the player follows).
    page.locator('.cxhv-nav--next').click()
    page.wait_for_timeout(1200)
    assert page.evaluate(cur) == 2 and created(page)[-1]['videoId'] == IDS[2] and page.locator('#hero iframe').count() == 1
    assert page.locator('.cxhv-nav--next').is_disabled()
    page.locator('[data-cxhv-track]').evaluate('t=>t.scrollTo({left:0,behavior:"instant"})')
    page.wait_for_timeout(800)
    assert page.evaluate(cur) == 0 and created(page)[-1]['videoId'] == IDS[0]
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(1200)
    assert page.evaluate(cur) == 1 and created(page)[-1]['videoId'] == IDS[1]
    n_before = page.evaluate(cur)
    page.wait_for_timeout(7400)
    assert page.evaluate(cur) == n_before, 'no automatic advance while open'
    page.screenshot(path=str(out / '1440-expanded.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(900)
    assert page.locator('#hero iframe').count() == 0 and page.locator('.cxhv-close').is_hidden()
    assert page.evaluate("document.activeElement.classList.contains('cxhv-slide-btn')")
    assert not page.locator('.cxhv-card--business').evaluate('e=>e.inert')
    back = rect(page, '[data-cxhv-track]')
    assert back['width'] < box['width'] - 50, 'card went back'
    # Opening, then scrolling on through the hand-off closes it.
    distance = page.locator('.cxha-transition').evaluate("e=>parseFloat(e.style.getPropertyValue('--cxha-distance'))")
    page.locator('.cxhv-slide.is-current .cxhv-slide-btn').click(force=True)
    page.wait_for_timeout(600)
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', distance * .5)
    page.wait_for_timeout(700)
    assert page.locator('#hero iframe').count() == 0 and page.locator('.cxhv-close').is_hidden()
    page.close()

    # Card 3 scrolls to Sales X on the page; card 2 opens /about.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page)
    page.locator('.cxhv-card--system').click(force=True)
    page.wait_for_timeout(2200)
    assert page.evaluate('location.hash') == '#sales-x'
    assert abs(rect(page, '#sales-x')['top'] - 64) < 4, rect(page, '#sales-x')
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    page.wait_for_timeout(500)
    page.locator('.cxhv-card--business').click(force=True)
    page.wait_for_url('**/about')
    page.close()

    # Reduced motion: no automatic advance, no float, no zoom; the video still opens on request.
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    load(page, wait=3000)
    page.wait_for_timeout(7400)
    assert page.evaluate("[...document.querySelectorAll('[data-cxhv-slide]')].findIndex(s=>s.classList.contains('is-current'))") == 0
    assert page.locator('.cxhv-card--business').evaluate('e=>getComputedStyle(e).animationName') == 'none'
    assert page.locator('.cxhv-slide.is-current img').evaluate('e=>getComputedStyle(e).animationName') == 'none'
    page.locator('.cxhv-slide.is-current .cxhv-slide-btn').click()
    page.wait_for_timeout(400)
    assert len(created(page)) == 1 and created(page)[0]['vars']['controls'] == 1
    page.close()

    # YouTube unavailable: opening says so, the page is intact.
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    load(page, api=False, wait=3000)
    assert page.locator('#hero iframe').count() == 0 and page.locator('.cxhv-slide.is-current img').is_visible()
    page.locator('.cxhv-slide.is-current .cxhv-slide-btn').click(force=True)
    page.wait_for_timeout(800)
    assert '読み込めませんでした' in page.locator('[data-cxhv-status]').inner_text()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.close()

    # SP: pictures only; a tap opens the video across the card area (the page does not jump);
    # the Hero scrolls before the hand-off.
    for w, h in [(375, 812), (390, 844), (430, 932)]:
        page = browser.new_page(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True)
        load(page, wait=3000)
        assert created(page) == [] and page.locator('#hero iframe').count() == 0
        assert rect(page, '.cxhv-actions')['bottom'] <= h, 'CTAs in the first screen'
        overflow = page.locator('.cxha-transition').evaluate("e=>parseFloat(e.style.getPropertyValue('--cxha-overflow'))")
        hero_bottom = rect(page, '#hero')['bottom'] + page.evaluate('scrollY')
        # Scroll until the bottom of the Hero is in view: nothing has faded yet.
        page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', max(0, hero_bottom - h))
        page.wait_for_timeout(400)
        assert page.locator('.cxha-hero-frame').evaluate('e=>getComputedStyle(e).opacity') == '1', (w, overflow)
        assert page.locator('.cxhv-stage').evaluate('e=>getComputedStyle(e).opacity') == '1'
        for s in CARDS:
            b = rect(page, s)
            assert b['bottom'] <= h + 1 and b['top'] >= 0, (w, s, b)
        stage_h = rect(page, '.cxhv-stage')['height']
        y0 = page.evaluate('scrollY')
        page.locator('.cxhv-slide.is-current .cxhv-slide-btn').tap(force=True)
        page.wait_for_timeout(600)
        made = created(page)
        assert len(made) == 1 and made[0]['vars']['controls'] == 1 and made[0]['vars']['mute'] == 0
        box, stage = rect(page, '[data-cxhv-track]'), rect(page, '.cxhv-stage')
        assert abs(box['width'] - stage['width']) < 1 and page.locator('.cxhv-card--business').is_hidden()
        assert abs(stage['height'] - stage_h) < 1 and page.evaluate('scrollY') == y0, 'page does not jump'
        assert page.evaluate('document.body.scrollWidth <= innerWidth')
        for s in ['.cxhv-nav--prev', '.cxhv-nav--next', '.cxhv-close']:
            b = rect(page, s)
            assert b['height'] >= 44 and b['top'] >= box['bottom'] - 1, (s, b, box)
        page.locator('.cxhv-nav--next').tap()
        page.wait_for_timeout(1200)
        assert created(page)[-1]['videoId'] == IDS[1]
        page.locator('.cxhv-card--creative').scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        assert page.locator('#hero iframe').count() == 1, 'scrolling to the player keeps it open'
        if w == 390:
            page.screenshot(path=str(out / '390-open.png'))
        page.locator('[data-cxhv-close]').tap()
        page.wait_for_timeout(300)
        assert page.locator('.cxhv-card--business').is_visible() and page.locator('.cxhv-player iframe').count() == 0
        page.close()

    # JS off: copy, links and the three cards are all there.
    page = browser.new_page(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    load(page, wait=300)
    for s in CARDS + ['.cxhv-actions']:
        assert page.locator(s).is_visible(), s
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'PASS: {len(widths)} widths (copy, links, cards in the Hero, picture-only Creative card, 1.4x text), PC 7s advance/sideways scroll/open with sound/‹ › ← → /Esc/leave, card links, reduced motion, YouTube unavailable, SP tap/scroll-before-hand-off, JS-off.')
