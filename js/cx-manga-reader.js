/* CxMangaReader — inline manga reader for contentsx.jp (Issue #97).
   Reuses BizManga's data (WordPress `gallery` / `view_type`) and reading rules without loading
   BizManga's own scripts (BizManga/js/works.js, bm-view-type.js are not changed):
   - Right-bound (Japanese): spreads are [1,2],[3,4]… with the lower page on the RIGHT; an odd last
     page is paired with /material/manga/thanks_v02.webp (works.js buildSpreads / showSpread).
   - Vertical reading when view_type is vertical_only/vertical or the first page is taller than
     1.8× its width (bm-view-type.js isForcedVertical / isVerticalByRatio).
   - Spread on wide frames, one page at a time on narrow ones; swipe left = next, right = previous;
     ← = next, → = previous. Pages are never cropped (object-fit: contain).
   Usage: var r = CxMangaReader(container, work, { wide: function () { return true; } });
          r.reset(); r.destroy(); */
(function () {
  'use strict';
  var THANKS = '/material/manga/thanks_v02.webp';
  var VERTICAL_RATIO = 1.8;
  var SAFE_IMG = /^https:\/\/(cms\.contentsx\.jp|contentsx\.jp)\/[^\s"'<>]+$/;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function iconButton(cls, label, glyph) {
    var b = el('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    var g = el('span', '', glyph);
    g.setAttribute('aria-hidden', 'true');
    b.appendChild(g);
    return b;
  }
  function forcedVertical(work) {
    var vt = work && (work.view_type || work.viewType || work.mode);
    return vt === 'vertical_only' || vt === 'vertical';
  }
  function probeRatio(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img.naturalHeight / Math.max(1, img.naturalWidth)); };
      img.onerror = reject;
      img.src = src;
    });
  }

  window.CxMangaReader = function (root, work, opts) {
    opts = opts || {};
    var pages = (Array.isArray(work && work.gallery) ? work.gallery : []).filter(function (u) { return SAFE_IMG.test(u); });
    var wide = opts.wide || function () { return window.innerWidth >= 769; };
    var title = (work && work.title_ja) || 'マンガ';
    var state = { mode: 'single', index: 0, zoom: false, vertical: false, destroyed: false };
    root.textContent = '';
    root.classList.add('cxmr');
    var stage = el('div', 'cxmr-stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-label', title + '（←で次のページ、→で前のページ）');
    var status = el('div', 'cxmr-status', '読み込み中…');
    status.setAttribute('role', 'status');
    var bar = el('div', 'cxmr-bar');
    // Right-bound book: "next" sits on the left, "previous" on the right.
    var next = iconButton('cxmr-btn cxmr-next', '次のページ', '‹');
    var count = el('span', 'cxmr-count');
    count.setAttribute('aria-live', 'polite');
    var prev = iconButton('cxmr-btn cxmr-prev', '前のページ', '›');
    var zoom = el('button', 'cxmr-zoom', '拡大');
    zoom.type = 'button';
    zoom.setAttribute('aria-pressed', 'false');
    bar.appendChild(next); bar.appendChild(count); bar.appendChild(prev); bar.appendChild(zoom);
    root.appendChild(stage); root.appendChild(bar); root.appendChild(status);

    function fail() {
      status.textContent = '漫画を表示できませんでした。時間をおいて、もう一度お試しください。';
      root.classList.add('is-error');
    }
    if (!pages.length) { fail(); return { reset: function () {}, destroy: function () {} }; }

    function units() {
      if (state.mode !== 'spread') return pages.map(function (_, i) { return [i]; });
      var arr = [];
      for (var i = 0; i < pages.length; i += 2) arr.push(i + 1 < pages.length ? [i, i + 1] : [i, 'thanks']);
      return arr;
    }
    function pageImg(i) {
      var img = el('img', 'cxmr-page');
      img.alt = i === 'thanks' ? '' : title + ' ' + (i + 1) + 'ページ';
      img.decoding = 'async';
      img.src = i === 'thanks' ? THANKS : pages[i];
      img.addEventListener('error', function () { img.classList.add('is-broken'); });
      return img;
    }
    function preload(list) {
      list.forEach(function (i) { if (typeof i === 'number' && pages[i]) { var im = new Image(); im.src = pages[i]; } });
    }
    function render() {
      if (state.destroyed) return;
      var u = units();
      state.index = Math.max(0, Math.min(state.index, u.length - 1));
      stage.textContent = '';
      stage.className = 'cxmr-stage is-' + state.mode + (state.zoom ? ' is-zoomed' : '');
      if (state.mode === 'vertical') {
        pages.forEach(function (_, i) { var img = pageImg(i); if (i > 2) img.loading = 'lazy'; stage.appendChild(img); });
        count.textContent = '1 / ' + pages.length;
        next.hidden = true; prev.hidden = true;
        return;
      }
      next.hidden = false; prev.hidden = false;
      var cur = u[state.index];
      var spread = el('div', 'cxmr-spread');
      // Lower page number on the RIGHT: left image is cur[1] (or thanks), right image cur[0].
      cur.slice().reverse().forEach(function (i) { spread.appendChild(pageImg(i)); });
      stage.appendChild(spread);
      var nums = cur.filter(function (i) { return typeof i === 'number'; }).map(function (i) { return i + 1; });
      count.textContent = nums.join('-') + ' / ' + pages.length;
      next.disabled = state.index >= u.length - 1;
      prev.disabled = state.index <= 0;
      preload((u[state.index + 1] || []).concat(u[state.index + 2] || []));
    }
    function go(step) {
      if (state.mode === 'vertical') return;
      var to = state.index + step;
      if (to < 0 || to >= units().length) return;
      state.index = to;
      render();
    }
    function layoutMode() {
      if (state.vertical) return 'vertical';
      return wide() ? 'spread' : 'single';
    }
    function relayout() {
      var mode = layoutMode();
      if (mode === state.mode) return;
      // Keep the same first page when switching between spread and single page.
      var cur = units()[state.index];
      var firstPage = cur && typeof cur[0] === 'number' ? cur[0] : 0;
      state.mode = mode;
      state.index = mode === 'spread' ? Math.floor(firstPage / 2) : firstPage;
      render();
    }

    next.addEventListener('click', function () { go(1); });
    prev.addEventListener('click', function () { go(-1); });
    zoom.addEventListener('click', function () {
      state.zoom = !state.zoom;
      zoom.setAttribute('aria-pressed', String(state.zoom));
      zoom.textContent = state.zoom ? '縮小' : '拡大';
      stage.classList.toggle('is-zoomed', state.zoom);
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(-1); e.preventDefault(); }
    });
    // Touch: swipe left = next, right = previous (BizManga mobileFlipTo); vertical scrolling stays native.
    var sx = null, sy = 0;
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' && !state.zoom) { sx = e.clientX; sy = e.clientY; } });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', function () { sx = null; });
    stage.addEventListener('scroll', function () {
      if (state.mode !== 'vertical') return;
      var imgs = stage.querySelectorAll('.cxmr-page');
      var line = stage.getBoundingClientRect().top + stage.clientHeight * 0.4;
      var n = 1;
      for (var i = 0; i < imgs.length; i++) { if (imgs[i].getBoundingClientRect().top <= line) n = i + 1; }
      count.textContent = n + ' / ' + pages.length;
    }, { passive: true });
    var onResize = function () { relayout(); };
    window.addEventListener('resize', onResize, { passive: true });

    probeRatio(pages[0]).then(function (ratio) {
      if (state.destroyed) return;
      state.vertical = forcedVertical(work) || ratio > VERTICAL_RATIO;
      state.mode = layoutMode();
      render();
      status.textContent = '';
      root.classList.add('is-ready');
    }).catch(fail);

    return {
      reset: function () {
        state.index = 0;
        if (state.zoom) zoom.click();
        stage.scrollTop = 0;
        render();
      },
      destroy: function () { state.destroyed = true; window.removeEventListener('resize', onResize); root.textContent = ''; }
    };
  };
})();
