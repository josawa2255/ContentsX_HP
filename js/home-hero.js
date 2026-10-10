/* HERO Creative card (Issue #108; picture-only card since Issue #114).
   - The card shows only the videos' pictures (YouTube thumbnails): no text, icons or YouTube UI.
     The three pictures sit in one row that scrolls sideways (swipe / trackpad); on PC the next one
     comes in every ADVANCE_MS while the card is in view (paused on hover, while open, with reduced
     motion). The picture in view slowly zooms in (CSS).
   - Pressing a picture opens the video: PC moves the card to the centre of the Hero's right half at
     about 1.5× (smaller if it would not fit) with ‹ › and × outside the picture; tablet/SP open it in
     place across the card area with ‹ › × below. Only then is the YouTube player loaded, with sound
     (falls back to muted when the browser blocks it) and YouTube's own controls. Scrolling sideways,
     ‹ › or ← → move to the other videos; Esc / × closes.
   - Leaving the Hero (scrolling on, js/hero-about.js), hiding the tab or closing stops the player.
     Only one player exists at a time.
   Videos are the [data-cxhv-slide] elements in index.html (YouTube ID + title), in that order.
   YouTube is embedded with the official IFrame Player API on youtube-nocookie.com; its own logo and
   links are visible while a video is open (YouTube terms): nothing is laid over the player. */
(function () {
  'use strict';
  var ADVANCE_MS = 7000;
  var API_TIMEOUT = 10000;
  var SCALE = 1.5;

  var hero = document.getElementById('hero');
  var card = document.querySelector('[data-cxhv-creative]');
  var stage = document.querySelector('[data-cxhv-stage]');
  if (!hero || !card || !stage) return;
  var track = card.querySelector('[data-cxhv-track]');
  var slides = Array.prototype.slice.call(card.querySelectorAll('[data-cxhv-slide]'));
  var prevBtn = card.querySelector('[data-cxhv-prev]');
  var nextBtn = card.querySelector('[data-cxhv-next]');
  var closeBtn = card.querySelector('[data-cxhv-close]');
  var status = card.querySelector('[data-cxhv-status]');
  if (!track || !slides.length) return;

  var pc = window.matchMedia('(min-width: 1101px) and (hover: hover)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var state = { index: 0, open: false, player: null, playerIndex: -1, timer: 0, visible: false, heroActive: true, hover: false, token: null };
  var TEXT = {
    ja: { fail: '動画を読み込めませんでした。時間をおいて、もう一度お試しください。' },
    en: { fail: 'The video could not be loaded. Please try again later.' }
  };
  function t(key) {
    var lang = window.i18n && window.i18n.getLang ? window.i18n.getLang() : 'ja';
    return (TEXT[lang] || TEXT.ja)[key];
  }

  /* ---------- YouTube IFrame API (loaded only when a video is opened) ---------- */
  var apiPromise = null;
  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      if (window.YT && window.YT.Player) { resolve(window.YT); return; }
      var timer = setTimeout(function () { reject(new Error('timeout')); }, API_TIMEOUT);
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        clearTimeout(timer);
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { clearTimeout(timer); reject(new Error('load')); };
      document.head.appendChild(s);
    });
    apiPromise.catch(function () { apiPromise = null; });
    return apiPromise;
  }
  function destroyPlayer() {
    state.token = null;
    if (state.player && state.player.destroy) { try { state.player.destroy(); } catch (e) { /* already gone */ } }
    state.player = null;
    state.playerIndex = -1;
    slides.forEach(function (s) {
      var holder = s.querySelector('.cxhv-player');
      if (holder) holder.remove();
      s.classList.remove('has-player');
    });
    status.textContent = '';
  }
  function mountPlayer(i) {
    if (state.playerIndex === i && state.player) return;
    destroyPlayer();
    var slide = slides[i];
    var holder = document.createElement('div');
    holder.className = 'cxhv-player';
    var target = document.createElement('div');
    holder.appendChild(target);
    slide.appendChild(holder);
    slide.classList.add('has-player');
    state.playerIndex = i;
    var token = {};
    state.token = token;
    loadApi().then(function (YT) {
      if (state.token !== token) return;
      state.player = new YT.Player(target, {
        host: 'https://www.youtube-nocookie.com',
        videoId: slide.getAttribute('data-video'),
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, mute: 0, controls: 1, playsinline: 1, rel: 0, enablejsapi: 1, origin: location.origin, iv_load_policy: 3 },
        events: {
          onReady: function (e) {
            if (state.token !== token) return;
            var frame = e.target.getIframe && e.target.getIframe();
            if (frame) frame.title = 'Creative 動画: ' + slide.getAttribute('data-title');
            e.target.playVideo();
          },
          // Sound needs the browser's permission; without it the video still starts, muted.
          onAutoplayBlocked: function (e) { if (state.token === token) { e.target.mute(); e.target.playVideo(); } },
          onError: function () { if (state.token === token) failed(); }
        }
      });
    }).catch(function () { if (state.token === token) failed(); });
  }
  function failed() {
    destroyPlayer();
    status.textContent = t('fail');
  }

  /* ---------- the row of pictures ---------- */
  function width() { return track.clientWidth || 1; }
  function mark(i) {
    state.index = i;
    slides.forEach(function (s, k) {
      var on = k === i;
      // Re-adding the class restarts the slow zoom on the picture that came into view.
      if (on && !s.classList.contains('is-current')) { void s.offsetWidth; }
      s.classList.toggle('is-current', on);
      s.setAttribute('aria-hidden', String(!on));
      s.querySelector('.cxhv-slide-btn').tabIndex = on ? 0 : -1;
    });
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;
  }
  function go(i, instant) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: i * width(), behavior: instant || reduced.matches ? 'auto' : 'smooth' });
    mark(i);
    if (state.open) settleSoon();
  }
  // While open, the player follows the picture in view once the row stops moving.
  var settleTimer = 0;
  function settleSoon() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () { if (state.open) mountPlayer(state.index); }, 220);
  }
  var frame = 0;
  track.addEventListener('scroll', function () {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      var i = Math.round(track.scrollLeft / width());
      if (i !== state.index) mark(i);
      if (state.open) settleSoon();
    });
  }, { passive: true });

  /* ---------- automatic advance (PC, card at rest) ---------- */
  function advanceAllowed() {
    return pc.matches && !reduced.matches && !document.hidden && state.visible && state.heroActive && !state.open && !state.hover;
  }
  function update() {
    clearInterval(state.timer);
    state.timer = 0;
    if (advanceAllowed()) {
      state.timer = setInterval(function () {
        if (!advanceAllowed()) return;
        go(state.index + 1 < slides.length ? state.index + 1 : 0);
      }, ADVANCE_MS);
    }
  }

  /* ---------- open / close ---------- */
  function placeExpanded() {
    // Centre of the Hero's right half, about 1.5× wider, leaving room for ‹ › and × outside.
    var heroBox = hero.getBoundingClientRect();
    var stageBox = stage.getBoundingClientRect();
    var k = stageBox.width / stage.offsetWidth || 1;
    var half = heroBox.width / 2;
    var w = Math.min(parseFloat(card.dataset.baseWidth) * SCALE, half - 2 * 64, (heroBox.height - 2 * 72) * 16 / 9);
    var h = w * 9 / 16;
    card.style.left = ((heroBox.left + half + (half - w) / 2 - stageBox.left) / k) + 'px';
    card.style.top = ((heroBox.top + (heroBox.height - h) / 2 - stageBox.top) / k) + 'px';
    card.style.width = (w / k) + 'px';
  }
  function open(i) {
    if (state.open) { go(i); return; }
    state.open = true;
    update();
    card.dataset.baseWidth = String(card.offsetWidth);
    // Tablet/SP open in place: keep the card area's height so the page below does not jump
    // (a shorter Hero would also look like the visitor had scrolled on).
    if (!pc.matches) stage.style.minHeight = stage.offsetHeight + 'px';
    card.classList.add('is-expanded');
    stage.classList.add('is-expanded', 'is-open');
    prevBtn.hidden = nextBtn.hidden = closeBtn.hidden = false;
    Array.prototype.forEach.call(stage.querySelectorAll('a.cxhv-card'), function (a) { a.inert = true; });
    if (pc.matches) placeExpanded();
    mark(i);
    track.scrollLeft = i * width();
    mountPlayer(i);
    closeBtn.focus({ preventScroll: true });
  }
  function close(restoreFocus) {
    if (!state.open) return;
    state.open = false;
    clearTimeout(settleTimer);
    destroyPlayer();
    prevBtn.hidden = nextBtn.hidden = closeBtn.hidden = true;
    card.style.left = card.style.top = card.style.width = '';
    stage.style.minHeight = '';
    card.classList.remove('is-expanded');
    stage.classList.remove('is-expanded', 'is-open');
    Array.prototype.forEach.call(stage.querySelectorAll('a.cxhv-card'), function (a) { a.inert = false; });
    if (restoreFocus) slides[state.index].querySelector('.cxhv-slide-btn').focus({ preventScroll: true });
    update();
  }

  /* ---------- events ---------- */
  slides.forEach(function (s, i) {
    s.querySelector('.cxhv-slide-btn').addEventListener('click', function () { open(i); });
  });
  prevBtn.addEventListener('click', function () { go(state.index - 1); });
  nextBtn.addEventListener('click', function () { go(state.index + 1); });
  closeBtn.addEventListener('click', function () { close(true); });
  // ← → move between videos: on the card at rest, and anywhere while a video is open
  // (a ‹ › button that becomes disabled at the end drops the focus out of the card).
  function arrows(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    go(state.index + (e.key === 'ArrowRight' ? 1 : -1));
  }
  card.addEventListener('keydown', function (e) { if (!state.open) arrows(e); });
  document.addEventListener('keydown', function (e) {
    if (!state.open) return;
    if (e.key === 'Escape') close(true);
    else arrows(e);
  });
  card.addEventListener('pointerenter', function () { state.hover = true; update(); });
  card.addEventListener('pointerleave', function () { state.hover = false; update(); });
  // The row keeps the picture in view aligned when its width changes (opening, closing, resizing).
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { track.scrollLeft = state.index * width(); }).observe(track);
  }
  // Card 3 scrolls to Sales X on this page.
  Array.prototype.forEach.call(stage.querySelectorAll('[data-cxhv-scroll]'), function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      history.pushState(null, '', a.getAttribute('href'));
      target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      state.visible = entries[0].intersectionRatio >= 0.5;
      update();
    }, { threshold: [0, 0.5, 1] }).observe(card);
  } else {
    state.visible = true;
  }
  // js/hero-about.js reports whether the Hero is still the scene (scrolling on hides it).
  document.addEventListener('cxha:hero', function (e) {
    state.heroActive = !!e.detail.active;
    if (!state.heroActive) close(false);
    update();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.player && state.player.pauseVideo) state.player.pauseVideo();
    update();
  });
  window.addEventListener('resize', function () {
    if (state.open && pc.matches) placeExpanded();
    else if (state.open) card.style.left = card.style.top = card.style.width = '';
  }, { passive: true });
  pc.addEventListener('change', function () { close(false); update(); });
  reduced.addEventListener('change', update);
  mark(0);
  update();
})();
