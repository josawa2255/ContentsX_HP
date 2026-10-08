/* Creative X: the three cards below switch the main viewer above (Issue #97).
   - BizManga: an inline manga reader (js/cx-manga-reader.js) for the first ContentsX manga in
     WordPress order (GET /works?site=contentsx — `gallery` / `view_type`).
   - BizAnime / BizVideo: the shared inline player (js/cx-video-player.js) with three videos each.
     Source: GET /bizanime-videos → `viewer` (WP「CREATIVE X ビューワー動画」, enabled + admin order;
     the player shows the first three playable per type). Until a type has viewer videos: BizAnime
     uses the existing `cases`, BizVideo the BizVideo `playlists`.
   Initial service: BizAnime. Switching fades the panel (200ms), stops any playing video and resets
   the reader. Nothing autoplays. Without JS the panel keeps its link to the BizAnime page. */
(function () {
  'use strict';
  var root = document.querySelector('[data-cxcx]');
  if (!root || typeof WP_CONFIG === 'undefined' || WP_CONFIG.enabled === false || !WP_CONFIG.apiBase) return;
  var panel = root.querySelector('[data-cxcx-panel]');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"][data-cxcx-service]'));
  if (!panel || !tabs.length || !window.CxVideoPlayer || !window.CxMangaReader) return;

  var API = WP_CONFIG.apiBase;
  var TIMEOUT = 8000;
  var FADE = 200;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var data = null;
  var active = null;
  var instance = null;
  var token = 0;

  function getJSON(path) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, TIMEOUT);
    return fetch(API + path, controller ? { signal: controller.signal } : {})
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .catch(function (e) { console.warn('[Creative X] ' + path + ' failed:', e.message); return null; })
      .then(function (d) { clearTimeout(timer); return d; });
  }
  function text(v) { return typeof v === 'string' ? v.trim() : ''; }
  function el(tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content) n.textContent = content;
    return n;
  }

  /* ---------- data ---------- */
  function viewerItems(videos, type) {
    var list = (videos && Array.isArray(videos.viewer) ? videos.viewer : []).filter(function (v) { return v && v.type === type; });
    return list.map(function (v) {
      return { title: text(v.title), description: text(v.description), provider: v.provider, video_id: text(v.video_id), src: text(v.src), poster: text(v.poster) };
    });
  }
  function fallbackAnime(videos) {
    return (videos && Array.isArray(videos.cases) ? videos.cases : []).filter(function (v) { return v && v.provider === 'youtube'; })
      .map(function (v) { return { title: text(v.title), description: '', provider: 'youtube', video_id: text(v.video_id), poster: text(v.poster) }; });
  }
  function fallbackVideo(videos) {
    return (videos && Array.isArray(videos.playlists) ? videos.playlists : []).filter(function (p) { return p && p.type === 'bizvideo'; })
      .map(function (p) { return { title: text(p.title), description: '', provider: 'youtube_playlist', video_id: text(p.playlist_id), poster: text(p.poster) }; });
  }
  function prepare(videos, works) {
    var anime = viewerItems(videos, 'bizanime');
    var film = viewerItems(videos, 'bizvideo');
    var manga = (Array.isArray(works) ? works : []).filter(function (w) { return w && Array.isArray(w.gallery) && w.gallery.length; })[0] || null;
    return {
      bizanime: anime.length ? anime : fallbackAnime(videos),
      bizvideo: film.length ? film : fallbackVideo(videos),
      manga: manga,
      failed: !videos && !works
    };
  }

  /* ---------- panel ---------- */
  function message(textContent, link) {
    var box = el('div', 'cxcx-message');
    box.setAttribute('role', 'status');
    box.appendChild(el('p', '', textContent));
    if (link) {
      var a = el('a', '', link.label);
      a.href = link.href;
      box.appendChild(a);
    }
    return box;
  }
  function build(service) {
    if (instance && instance.destroy) instance.destroy();
    instance = null;
    panel.textContent = '';
    panel.setAttribute('data-service', service);
    if (!data) { panel.appendChild(message('読み込み中…')); return; }
    if (service === 'manga') {
      if (!data.manga) {
        panel.appendChild(message('漫画を表示できませんでした。', { label: 'ビズマンガで作品を見る', href: 'https://bizmanga.contentsx.jp/biz-library' }));
        return;
      }
      var box = el('div', 'cxcx-reader');
      panel.appendChild(box);
      instance = window.CxMangaReader(box, data.manga, { wide: function () { return window.innerWidth >= 769; } });
      return;
    }
    var items = data[service] || [];
    var player = el('div', 'cxcx-player');
    panel.appendChild(player);
    instance = window.CxVideoPlayer(player, items, {
      emptyText: data.failed ? '動画を読み込めませんでした。時間をおいて、もう一度お試しください。' : '動画は準備中です。'
    });
  }
  function select(service, focus) {
    if (service === active) return;
    active = service;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-cxcx-service') === service;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) { panel.setAttribute('aria-labelledby', t.id); if (focus) t.focus(); }
    });
    if (instance && instance.stop) instance.stop();
    var my = ++token;
    if (reduced.matches || !panel.firstChild) { build(service); return; }
    panel.classList.add('is-fading');
    setTimeout(function () {
      if (my !== token) return;
      build(service);
      // Next frame so the new content fades in from transparent.
      requestAnimationFrame(function () { if (my === token) panel.classList.remove('is-fading'); });
    }, FADE);
  }

  /* ---------- tabs: click, arrows, Home/End ---------- */
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t.getAttribute('data-cxcx-service'), false); });
    t.addEventListener('keydown', function (e) {
      var to = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') to = 0;
      if (e.key === 'End') to = tabs.length - 1;
      if (to === null) return;
      e.preventDefault();
      select(tabs[to].getAttribute('data-cxcx-service'), true);
    });
  });

  root.classList.add('cxcx-enhanced');
  panel.textContent = '';
  panel.appendChild(message('読み込み中…'));
  active = 'bizanime';
  Promise.all([getJSON('/bizanime-videos'), getJSON('/works?site=contentsx')]).then(function (res) {
    data = prepare(res[0], res[1]);
    build(active);
    root.classList.add('cxcx-ready');
  });
})();
