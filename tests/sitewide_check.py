"""Site-wide regression check for shared CSS / component changes (Issue #107).

Compares a HEAD preview against a BASE preview (normally main) on every public page and width:
  1. full-page screenshots and their pixel difference (with a diff image when something changed)
  2. a layout health check on HEAD and BASE: horizontal scroll, elements sticking out, text under
     12px, distorted images / wrong width-height attributes, small tap targets on SP, clipped text
     and a first heading hidden under a fixed header. New problems (HEAD only) are reported.

Run two loopback previews that serve extensionless URLs, e.g.
  (cd <main checkout> && python3 tools/preview-extensions.py --port 8791) &
  (cd <branch worktree> && python3 tools/preview-extensions.py --port 8792) &
  python3 tests/sitewide_check.py --base http://127.0.0.1:8791 --head http://127.0.0.1:8792 --out /tmp/cx-sitewide

Options: --pages /,/company  --widths 390,1440  --skip-hero (mask the top-page HERO, which is owned by
another task). Motion is reduced and the page is scrolled through once so lazy images and reveal
animations settle before capturing. Live WordPress content is fetched by both sides alike.
Requires Playwright (Chromium) and Pillow. Exit code 1 when new layout problems appear.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter
from playwright.sync_api import sync_playwright

PAGES = ['/', '/about', '/company', '/message', '/recruit', '/contact', '/news', '/news-detail?id=1439',
         '/faq', '/privacy', '/terms', '/column.html', '/column/manga-plot-guide', '/services/',
         '/services/sales-x/', '/services/creative-x/', '/extensions/', '/extensions/tablabo/', '/404.html']
WIDTHS = [320, 375, 390, 412, 768, 1024, 1280, 1440]
HERO = '.cxh-hero,.cxha-transition'

HEALTH = r'''(skipHero) => {
  const vw = innerWidth;
  const hidden = e => e.closest('[aria-hidden=true]') || (skipHero && e.closest('%HERO%'));
  const vis = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0 && !hidden(e); };
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const out = { overflow: document.documentElement.scrollWidth > vw, wide: [], small: [], img: [], tap: [], clip: [], header: [] };
  const clippedByAncestor = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true; } return false; };
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !clippedByAncestor(e)) out.wide.push(name(e));
  }
  const seen = new Set(), walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) { const t = walk.currentNode, e = t.parentElement;
    if (!t.textContent.trim() || !e || seen.has(e) || !vis(e) || e.closest('.cxsb-label')) continue; seen.add(e);
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 12 && !/^[\s▾▸›→←↗×・|/-]*$/.test(t.textContent)) out.small.push(name(e) + ' ' + fs + 'px「' + t.textContent.trim().slice(0, 12) + '」'); }
  for (const i of document.querySelectorAll('img')) { if (!vis(i) || !i.naturalWidth) continue;
    const r = i.getBoundingClientRect(), fit = getComputedStyle(i).objectFit, nat = i.naturalWidth / i.naturalHeight;
    if (!['cover', 'contain', 'scale-down'].includes(fit) && Math.abs((r.width / r.height) / nat - 1) > .03) out.img.push('distorted ' + name(i));
    const aw = +i.getAttribute('width'), ah = +i.getAttribute('height');
    if (aw && ah && Math.abs((aw / ah) / nat - 1) > .05) out.img.push('attr-ratio ' + name(i) + ' ' + (i.currentSrc || i.src).split('/').pop()); }
  if (vw <= 768) for (const a of document.querySelectorAll('a[href],button,[role=button],input,select,textarea,summary')) {
    if (!vis(a)) continue; const r = a.getBoundingClientRect(), box = a.closest('p,li,dd,td');
    const inText = getComputedStyle(a).display === 'inline' && box && box.textContent.trim().length > a.textContent.trim().length + 10;
    if (!inText && (r.height < 44 && r.width < 44 || r.height < 32)) out.tap.push(name(a) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  for (const e of document.querySelectorAll('h1,h2,h3,h4,p,a,button,span,li,dt,dd')) { if (!vis(e)) continue;
    const s = getComputedStyle(e);
    if (['hidden', 'clip'].includes(s.overflowX) && e.scrollWidth > e.clientWidth + 2 && s.textOverflow !== 'ellipsis'
        && !/visually-hidden|sr-only/.test(e.className) && e.textContent.trim()) out.clip.push(name(e)); }
  const hd = document.querySelector('header'), h1 = document.querySelector('main h1') || document.querySelector('h1');
  if (hd && h1 && vis(h1) && ['fixed', 'sticky'].includes(getComputedStyle(hd).position)
      && h1.getBoundingClientRect().top + scrollY < hd.getBoundingClientRect().bottom) out.header.push('h1 under fixed header');
  for (const k of ['wide', 'small', 'img', 'tap', 'clip', 'header']) out[k] = [...new Set(out[k])];
  return out;
}'''.replace('%HERO%', HERO)


def capture(page, url, shot, skip_hero):
    # Video streams keep the network busy forever and are not needed for a still capture.
    page.route('**/*', lambda r: r.abort() if r.request.resource_type == 'media' else r.continue_() if r.request.url.startswith((
        'http://127.0.0.1:', 'http://localhost:', 'https://fonts.', 'https://cms.contentsx.jp/', 'https://i.ytimg.com/', 'https://contentsx.jp/material/'))
        else r.abort())
    page.goto(url, wait_until='load', timeout=45000)
    page.wait_for_timeout(1200)
    page.add_style_tag(content='html{scroll-snap-type:none!important} *{caret-color:transparent!important}')
    # Lazy images load by scroll timing; make them eager so both sides capture the same pixels.
    page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; })")
    height = page.evaluate('document.documentElement.scrollHeight')
    for y in range(0, height, 600):
        page.evaluate('(y)=>scrollTo(0,y)', y)
        page.wait_for_timeout(35)
    page.evaluate('scrollTo(0,0)')
    # WordPress images (e.g. Creative X tabs) arrive late; capture only after every image has settled.
    for settle in (lambda: page.wait_for_load_state('networkidle', timeout=15000),
                   lambda: page.wait_for_function('[...document.images].every(i => i.complete)', timeout=10000),
                   lambda: page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')):
        try:
            settle()
        except Exception:
            pass
    page.wait_for_timeout(700)
    health = page.evaluate(HEALTH, skip_hero)
    mask = [page.locator(HERO)] if skip_hero else []
    page.screenshot(path=str(shot), full_page=True, animations='disabled', mask=mask)
    page.unroute('**/*')
    return health


def diff(a_path, b_path, out_path):
    """same: identical pixels / noise: only text anti-aliasing jitter / changed: a visible difference."""
    a, b = Image.open(a_path).convert('RGB'), Image.open(b_path).convert('RGB')
    if a.size != b.size:
        return {'changed': True, 'level': 'changed', 'size': [list(a.size), list(b.size)], 'ratio': 1.0}
    def strongest_channel(img_a, img_b):
        r, g, bl = ImageChops.difference(img_a, img_b).split()
        return ImageChops.lighter(ImageChops.lighter(r, g), bl)
    raw = strongest_channel(a, b).point(lambda v: 255 if v > 2 else 0)
    box = raw.getbbox()
    if not box:
        return {'changed': False, 'level': 'same', 'ratio': 0.0}
    # Glyph edges can render a pixel differently between two identical loads (sharp jitter that sits on
    # outlines). Real changes are either sharp and survive a 1px blur, or a colour change on a flat fill
    # (background, band, button) away from any outline, e.g. #06143D -> #07143b. Jitter fails both.
    sharp = ImageChops.difference(a.filter(ImageFilter.BoxBlur(1)), b.filter(ImageFilter.BoxBlur(1))).convert('L')
    sharp_px = sharp.point(lambda v: 255 if v > 40 else 0).histogram()[255]
    outlines = ImageChops.lighter(a.convert('L').filter(ImageFilter.FIND_EDGES), b.convert('L').filter(ImageFilter.FIND_EDGES))
    outlines = outlines.point(lambda v: 255 if v > 6 else 0).filter(ImageFilter.MaxFilter(5))
    flat_px = ImageChops.subtract(strongest_channel(a, b).point(lambda v: 255 if v > 1 else 0), outlines).histogram()[255]
    ratio = raw.histogram()[255] / (a.size[0] * a.size[1])
    level = 'changed' if sharp_px >= 20 or flat_px >= 50 else 'noise'
    overlay = b.copy()
    overlay.paste(Image.new('RGB', b.size, (255, 0, 64)), mask=raw)
    overlay.save(out_path)
    return {'changed': level == 'changed', 'level': level, 'ratio': round(ratio, 5), 'bbox': list(box)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True)
    ap.add_argument('--head', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--pages', default=','.join(PAGES))
    ap.add_argument('--widths', default=','.join(map(str, WIDTHS)))
    ap.add_argument('--skip-hero', action='store_true')
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pages = [p for p in args.pages.split(',') if p]
    widths = [int(w) for w in args.widths.split(',')]
    results, new_problems = [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in widths:
            ctx = browser.new_context(viewport={'width': width, 'height': 900 if width > 768 else 844},
                                      device_scale_factor=1, reduced_motion='reduce')
            page = ctx.new_page()
            for path in pages:
                slug = (path.strip('/').replace('/', '_').replace('?', '_').replace('=', '-').replace('.html', '') or 'index')
                row = {'page': path, 'width': width}
                try:
                    hb = capture(page, args.base + path, out / f'{slug}-{width}-base.png', args.skip_hero)
                    hh = capture(page, args.head + path, out / f'{slug}-{width}-head.png', args.skip_hero)
                except Exception as e:  # keep going; report the page as unchecked
                    row['error'] = str(e).splitlines()[0][:160]
                    results.append(row)
                    continue
                row['pixels'] = diff(out / f'{slug}-{width}-base.png', out / f'{slug}-{width}-head.png', out / f'{slug}-{width}-diff.png')
                added = {}
                for k in hh:
                    if k == 'overflow':
                        if hh[k] and not hb[k]:
                            added[k] = True
                        continue
                    extra = sorted(set(hh[k]) - set(hb[k]))
                    if extra:
                        added[k] = extra
                fixed = {k: sorted(set(hb[k]) - set(hh[k])) for k in hb if k != 'overflow' and set(hb[k]) - set(hh[k])}
                row['new_problems'], row['fixed'] = added, fixed
                new_problems += len(added)
                results.append(row)
                mark = 'NEW ' + ','.join(added) if added else 'ok'
                px = row['pixels']
                print(f"{width:>5} {path:<28} pixels {px['level'] + (' ' + str(px['ratio']) if px['level'] != 'same' else ''):<18} {mark}"
                      + (f"  fixed:{','.join(fixed)}" if fixed else ''))
            ctx.close()
        browser.close()
    (out / 'report.json').write_text(json.dumps(results, ensure_ascii=False, indent=1))
    changed = sum(1 for r in results if r.get('pixels', {}).get('level') == 'changed')
    noise = sum(1 for r in results if r.get('pixels', {}).get('level') == 'noise')
    errors = sum(1 for r in results if 'error' in r)
    print(f'\n{len(results)} checks: {changed} changed, {noise} anti-aliasing noise only, {new_problems} new layout problems, {errors} errors. Report: {out / "report.json"}')
    raise SystemExit(1 if new_problems or errors else 0)


if __name__ == '__main__':
    main()
