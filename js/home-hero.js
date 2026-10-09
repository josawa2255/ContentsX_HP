/* HERO Creative card (Issue #108): previews the three Creative videos and opens a larger player.
   - Videos: VIDEOS below, in this order, by YouTube ID only (playlist parameters are ignored).
   - PC (≥1101px, hover-capable, no reduced motion): after the page has loaded and while the card is
     at least half visible in the Hero, a muted preview starts and moves to the next video every
     PREVIEW_MS. The preview only runs when the player box is at least 200×200px (YouTube minimum).
   - 「拡大して見る」: PC moves the card to the centre of the Hero's right half at about 1.5× (smaller
     if it would not fit), with player controls, 1/2/3 buttons and a sound button; the other cards
     step back. Tablet/SP open the player in place across the card area. Esc / × closes it.
   - Leaving the Hero (scrolling on, js/hero-about.js), hiding the tab or opening another video stops
     the player. Only one player exists at a time.
   YouTube is embedded with the official IFrame Player API on youtube-nocookie.com. Its own logo and
   links stay visible (YouTube terms): nothing is laid over or blocks the player. */
(function () {
  'use strict';
  var VIDEOS = [
    { id: 'zKvRR8xT_zY', title: 'どれが原宿？' },
    { id: 'IAgFqlvSUfE', title: 'High Speed Battle' },
    { id: 'OYgeXiPByBg', title: 'ニャンポッシブル' }
  ];
  var PREVIEW_MS = 8000;
  var API_TIMEOUT = 10000;
  var SCALE = 1.5;

  var hero = document.getElementById('hero');
  var card = document.querySelector('[data-cxhv-creative]');
  var stage = document.querySelector('[data-cxhv-stage]');
  if (!hero || !card || !stage) return;
  var mount = card.querySelector('[data-cxhv-player]');
  var thumb = card.querySelector('[data-cxhv-thumb]');
  var openers = Array.prototype.slice.call(card.querySelectorAll('[data-cxhv-open]'));
  var expandBtn = card.querySelector('.cxhv-expand');
  var closeBtn = card.querySelector('[data-cxhv-close]');
  var controls = card.querySelector('[data-cxhv-controls]');
  var picker = card.querySelector('[data-cxhv-picker]');
  var soundBtn = card.querySelector('[data-cxhv-sound]');
  var status = card.querySelector('[data-cxhv-status]');
  var transition = document.querySelector('.cxha-transition');

  var pc = window.matchMedia('(min-width: 1101px) and (hover: hover)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var state = { index: 0, mode: 'idle', player: null, timer: 0, visible: false, heroActive: true, loaded: document.readyState === 'complete', muted: true, opener: null };

  var TEXT = {
    ja: { play: '動画を再生する', fail: '動画を読み込めませんでした。時間をおいて、もう一度お試しください。', soundOn: '音を出す', soundOff: '音を消す' },
    en: { play: 'Play the videos', fail: 'The video could not be loaded. Please try again later.', soundOn: 'Sound on', soundOff: 'Mute' }
  };
  function t(key) {
    var lang = window.i18n && window.i18n.getLang ? window.i18n.getLang() : 'ja';
    return (TEXT[lang] || TEXT.ja)[key];
  }
  function thumbFor(i) { return 'https://i.ytimg.com/vi/' + VIDEOS[i].id + '/hqdefault.jpg'; }

  /* ---------- YouTube IFrame API (loaded only when a player is needed) ---------- */
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
    clearInterval(state.timer);
    state.timer = 0;
    if (state.player && state.player.destroy) { try { state.player.destroy(); } catch (e) { /* already gone */ } }
    state.player = null;
    mount.textContent = '';
    card.classList.remove('has-player');
  }
  function createPlayer(withControls, startSeconds) {
    destroyPlayer();
    var holder = document.createElement('div');
    mount.appendChild(holder);
    var token = {};
    state.token = token;
    return loadApi().then(function (YT) {
      if (state.token !== token) return null;
      return new Promise(function (resolve) {
        var player = new YT.Player(holder, {
          host: 'https://www.youtube-nocookie.com',
          videoId: VIDEOS[state.index].id,
          width: '100%', height: '100%',
          playerVars: {
            autoplay: 1, mute: 1, playsinline: 1, rel: 0, enablejsapi: 1, origin: location.origin,
            controls: withControls ? 1 : 0, disablekb: withControls ? 0 : 1, iv_load_policy: 3,
            start: Math.max(0, Math.floor(startSeconds || 0))
          },
          events: {
            onReady: function (e) {
              e.target.mute();
              e.target.playVideo();
              card.classList.add('has-player');
              var frame = e.target.getIframe && e.target.getIframe();
              if (frame) frame.title = 'Creative 動画: ' + VIDEOS[state.index].title;
              resolve(player);
            },
            onStateChange: function (e) {
              // A finished preview moves on; the larger player stays on the chosen video.
              if (e.data === 0 && state.mode === 'preview') next();
            },
            onAutoplayBlocked: function () { if (state.mode === 'preview') stopPreview(); },
            onError: function () {
              if (state.mode === 'preview') { next(); return; }
              status.textContent = t('fail');
            }
          }
        });
        state.player = player;
      });
    }).catch(function () {
      if (state.token !== token) return null;
      destroyPlayer();
      if (state.mode !== 'preview' && state.mode !== 'idle') status.textContent = t('fail');
      return null;
    });
  }
  function setVideo(i) {
    state.index = (i + VIDEOS.length) % VIDEOS.length;
    thumb.src = thumbFor(state.index);
    if (state.player && state.player.loadVideoById) {
      state.player.loadVideoById(VIDEOS[state.index].id);
      var frame = state.player.getIframe && state.player.getIframe();
      if (frame) frame.title = 'Creative 動画: ' + VIDEOS[state.index].title;
    }
    Array.prototype.forEach.call(picker.children, function (b, k) { b.setAttribute('aria-pressed', String(k === state.index)); });
  }
  function next() { setVideo(state.index + 1); }

  /* ---------- preview (PC) ---------- */
  function previewAllowed() {
    if (!pc.matches || reduced.matches || !state.loaded || document.hidden) return false;
    if (!state.visible || !state.heroActive || state.mode !== 'idle') return false;
    var screen = card.querySelector('.cxhv-screen');
    return screen.offsetWidth >= 200 && screen.offsetHeight >= 200;
  }
  function startPreview() {
    if (!previewAllowed()) return;
    state.mode = 'preview';
    createPlayer(false, 0).then(function (player) {
      if (!player || state.mode !== 'preview') return;
      clearInterval(state.timer);
      state.timer = setInterval(next, PREVIEW_MS);
    });
  }
  function stopPreview() {
    if (state.mode !== 'preview') return;
    destroyPlayer();
    state.mode = 'idle';
  }
  function update() {
    if (state.mode === 'preview' && !(state.visible && state.heroActive && !document.hidden && pc.matches && !reduced.matches)) stopPreview();
    else if (state.mode === 'idle') startPreview();
  }

  /* ---------- expanded player ---------- */
  function buildPicker() {
    picker.textContent = '';
    VIDEOS.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cxhv-pick';
      b.setAttribute('aria-pressed', String(i === state.index));
      var n = document.createElement('b'); n.textContent = String(i + 1);
      var s = document.createElement('span'); s.textContent = v.title; s.setAttribute('data-i18n-skip', '');
      b.appendChild(n); b.appendChild(s);
      b.addEventListener('click', function () { status.textContent = ''; setVideo(i); });
      picker.appendChild(b);
    });
  }
  function placeExpanded() {
    // Centre of the Hero's right half, about 1.5× wider, shrunk if it would not fit there.
    var heroBox = hero.getBoundingClientRect();
    var stageBox = stage.getBoundingClientRect();
    var base = parseFloat(card.dataset.baseWidth);
    var half = heroBox.width / 2;
    // The stage may be scaled by the scroll hand-off; positions are in its unscaled space.
    var k = stageBox.width / stage.offsetWidth || 1;
    var width = Math.min(base * SCALE, half - 48);
    // Caption and 1/2/3 buttons wrap differently at the new width: measure them there, without animating.
    var screen = card.querySelector('.cxhv-screen');
    var keep = { transition: card.style.transition, width: card.style.width };
    card.style.transition = 'none';
    card.style.width = (width / k) + 'px';
    var chrome = (card.offsetHeight - screen.offsetHeight) * k;
    card.style.width = keep.width;
    void card.offsetWidth;
    card.style.transition = keep.transition;
    width = Math.min(width, (heroBox.height - 48 - chrome) * 16 / 9);
    var height = width * 9 / 16 + chrome;
    var left = heroBox.left + half + (half - width) / 2 - stageBox.left;
    var top = heroBox.top + (heroBox.height - height) / 2 - stageBox.top;
    card.style.left = (left / k) + 'px';
    card.style.top = (top / k) + 'px';
    card.style.width = (width / k) + 'px';
  }
  function open(event) {
    if (state.mode === 'open') return;
    state.opener = event && event.currentTarget;
    var time = state.mode === 'preview' && state.player && state.player.getCurrentTime ? state.player.getCurrentTime() : 0;
    clearInterval(state.timer);
    state.mode = 'open';
    status.textContent = '';
    buildPicker();
    controls.hidden = false;
    closeBtn.hidden = false;
    expandBtn.hidden = true;
    expandBtn.setAttribute('aria-expanded', 'true');
    card.dataset.baseWidth = String(card.offsetWidth);
    card.classList.add('is-expanded');
    stage.classList.add('is-expanded', 'is-open');
    Array.prototype.forEach.call(stage.querySelectorAll('a.cxhv-card'), function (a) { a.inert = true; });
    if (pc.matches) placeExpanded();
    setSound(true);
    createPlayer(true, time);
    closeBtn.focus({ preventScroll: true });
  }
  function close(restoreFocus) {
    if (state.mode !== 'open') return;
    destroyPlayer();
    state.mode = 'idle';
    controls.hidden = true;
    closeBtn.hidden = true;
    expandBtn.hidden = false;
    expandBtn.setAttribute('aria-expanded', 'false');
    status.textContent = '';
    card.style.left = card.style.top = card.style.width = '';
    card.classList.remove('is-expanded');
    stage.classList.remove('is-expanded', 'is-open');
    Array.prototype.forEach.call(stage.querySelectorAll('a.cxhv-card'), function (a) { a.inert = false; });
    if (restoreFocus) (state.opener && state.opener.offsetParent ? state.opener : expandBtn).focus({ preventScroll: true });
    // Let the card travel back before a new preview starts.
    setTimeout(update, reduced.matches ? 0 : 600);
  }
  function setSound(muted) {
    state.muted = muted;
    soundBtn.setAttribute('aria-pressed', String(!muted));
    soundBtn.firstElementChild.textContent = muted ? t('soundOn') : t('soundOff');
    if (state.player && state.player.mute) { if (muted) state.player.mute(); else state.player.unMute(); }
  }

  /* ---------- events ---------- */
  openers.forEach(function (b) { b.addEventListener('click', open); });
  closeBtn.addEventListener('click', function () { close(true); });
  soundBtn.addEventListener('click', function () { setSound(!state.muted); });
  card.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.mode === 'open') { e.stopPropagation(); close(true); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.mode === 'open') close(true); });
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
    if (document.hidden && state.mode === 'open' && state.player && state.player.pauseVideo) state.player.pauseVideo();
    update();
  });
  window.addEventListener('pageshow', update);
  window.addEventListener('resize', function () {
    if (state.mode === 'open' && pc.matches) placeExpanded();
    else if (state.mode === 'open') card.style.left = card.style.top = card.style.width = '';
    update();
  }, { passive: true });
  document.addEventListener('i18n-lang-changed', function () {
    card.querySelector('.cxhv-tap').setAttribute('aria-label', t('play'));
    setSound(state.muted);
  });
  pc.addEventListener('change', function () { close(false); update(); });
  reduced.addEventListener('change', update);
  if (!state.loaded) {
    window.addEventListener('load', function () {
      state.loaded = true;
      // Give the first paint and the rest of the page room before YouTube loads.
      (window.requestIdleCallback || function (fn) { return setTimeout(fn, 600); })(update, { timeout: 2500 });
    }, { once: true });
  } else {
    update();
  }
})();
