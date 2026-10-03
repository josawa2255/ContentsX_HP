/* Creative X: PICK UP, works cards and service samples from WordPress.
   - Videos: GET /bizanime-videos → playlists (type bizanime / bizvideo, enabled + admin order).
     Before playlists exist, BizAnime falls back to the existing single-video "cases".
   - Manga: GET /works?site=contentsx (ContentsX display flag + cx_sort_order).
   WordPress values are never written as HTML: nodes are built with textContent, and image /
   embed URLs are rebuilt from validated IDs or restricted to known hosts.
   The markup in index.html stays as-is when JS is off or the API fails. */
(function () {
  'use strict';
  var root = document.querySelector('[data-cxcx]');
  if (!root || typeof WP_CONFIG === 'undefined' || WP_CONFIG.enabled === false || !WP_CONFIG.apiBase) return;

  var API = WP_CONFIG.apiBase;
  var TIMEOUT = 6000;
  var PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
  var VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
  var WORK_ID = /^[A-Za-z0-9_-]{1,80}$/;
  var IMAGE_HOSTS = ['cms.contentsx.jp', 'i.ytimg.com'];
  var KIND = {
    manga: { label: 'MANGA', name: 'ビズマンガ' },
    bizanime: { label: 'ANIME', name: 'ビズアニメ', sub: 'オリジナルアニメで、ブランドの世界観やメッセージを鮮やかに。' },
    bizvideo: { label: 'VIDEO', name: 'ビズビデオ', sub: '企業の想いや取り組みを、高品質な映像で印象的に届けます。' }
  };

  function getJSON(path) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, TIMEOUT);
    return fetch(API + path, controller ? { signal: controller.signal } : {})
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .catch(function (e) { console.warn('[Creative X] ' + path + ' failed:', e.message); return null; })
      .then(function (data) { clearTimeout(timer); return data; });
  }

  function safeImage(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && IMAGE_HOSTS.indexOf(u.hostname) !== -1 ? u.href : '';
    } catch (e) { return ''; }
  }

  function text(value) { return typeof value === 'string' ? value.trim() : ''; }

  /* ---------- normalise WordPress data ---------- */
  function fromPlaylist(p) {
    var id = text(p && p.playlist_id);
    var kind = p && (p.type === 'bizvideo' ? 'bizvideo' : 'bizanime');
    if (!PLAYLIST_ID.test(id)) return null;
    return {
      kind: kind, video: true, title: text(p.title) || KIND[kind].name,
      poster: safeImage(p.poster),
      embed: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + id,
      href: 'https://www.youtube.com/playlist?list=' + id
    };
  }
  function fromVideo(v) {
    var id = text(v && v.video_id);
    if (!v || v.provider !== 'youtube' || !VIDEO_ID.test(id)) return null;
    return {
      kind: 'bizanime', video: true, title: text(v.title) || KIND.bizanime.name,
      poster: safeImage(v.poster) || 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
      embed: 'https://www.youtube-nocookie.com/embed/' + id,
      href: 'https://www.youtube.com/watch?v=' + id
    };
  }
  function fromWork(w) {
    var id = text(w && w.id);
    if (!WORK_ID.test(id)) return null;
    var thumb = safeImage(w.thumbnail);
    return {
      kind: 'manga', video: false, title: text(w.title_ja) || KIND.manga.name, sub: text(w.subtitle_ja),
      poster: thumb,
      // WordPress serves a 240px crop; the original (same path without -WxH) is used on larger cards.
      posterFull: thumb.replace(/-\d+x\d+(\.\w+)$/, '$1'),
      href: 'https://bizmanga.contentsx.jp/biz-library?manga=' + encodeURIComponent(id)
    };
  }
  function compact(list, fn) { return (Array.isArray(list) ? list : []).map(fn).filter(Boolean); }

  /* ---------- DOM helpers ---------- */
  function el(tag, cls, content) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content) node.textContent = content;
    return node;
  }
  function media(item, sizes) {
    var wrap = el('span', 'cxcx-media');
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    // Intrinsic ratio hints: manga covers are portrait, YouTube frames 16:9.
    img.width = item.kind === 'manga' ? 240 : 1280;
    img.height = item.kind === 'manga' ? 300 : 720;
    if (item.posterFull && item.posterFull !== item.poster) {
      img.srcset = item.poster + ' 240w, ' + item.posterFull + ' 1200w';
      img.sizes = sizes;
    }
    var youtube = /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]+\/hqdefault\.jpg$/.test(item.poster);
    if (youtube) {
      // Prefer the 16:9 maxres frame; YouTube returns a 120px placeholder when it does not exist.
      img.src = item.poster.replace('hqdefault', 'maxresdefault');
      img.addEventListener('load', function onLoad() {
        if (img.naturalWidth > 120) return;
        img.removeEventListener('load', onLoad);
        img.classList.add('is-letterboxed');
        img.src = item.poster;
      });
    } else if (item.poster) {
      img.src = item.poster;
    }
    if (item.poster) wrap.appendChild(img);
    return wrap;
  }
  function link(item, cls) {
    var a = el('a', cls);
    a.href = item.href;
    if (item.video) {
      a.classList.add('is-video');
      a.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (openModal(item, a)) event.preventDefault();
      });
    }
    return a;
  }

  /* ---------- PICK UP carousel ---------- */
  var pickupIndex = 0;
  function buildPickup(items) {
    var track = root.querySelector('[data-cxcx-pickup]');
    var nav = root.querySelector('[data-cxcx-pickup-nav]');
    if (!track || !items.length) return;
    track.textContent = '';
    items.forEach(function (item, i) {
      var slide = link(item, 'cxcx-slide' + (i === 0 ? ' is-active' : ''));
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' / ' + items.length + '：' + item.title);
      slide.appendChild(media(item, '(max-width: 768px) 100vw, 52vw'));
      if (item.video) slide.appendChild(el('span', 'cxcx-play-big'));
      var body = el('span', 'cxcx-slide-text');
      body.appendChild(el('span', 'cxcx-slide-label', 'Creative X PICK UP ・ ' + KIND[item.kind].name));
      var title = el('strong', '', item.title);
      title.setAttribute('data-i18n-skip', '');
      body.appendChild(title);
      body.appendChild(el('span', 'cxcx-slide-sub', item.sub || KIND[item.kind].sub || ''));
      slide.appendChild(body);
      track.appendChild(slide);
    });
    if (items.length < 2 || !nav) return;
    nav.hidden = false;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    nav.querySelector('[data-cxcx-total]').textContent = pad(items.length);
    function show(index) {
      var slides = track.children;
      pickupIndex = (index + slides.length) % slides.length;
      Array.prototype.forEach.call(slides, function (s, i) { s.classList.toggle('is-active', i === pickupIndex); });
      nav.querySelector('[data-cxcx-current]').textContent = pad(pickupIndex + 1);
    }
    nav.querySelector('[data-cxcx-prev]').addEventListener('click', function () { show(pickupIndex - 1); });
    nav.querySelector('[data-cxcx-next]').addEventListener('click', function () { show(pickupIndex + 1); });
    // Touch swipe: horizontal drags change slides; vertical scrolling stays native.
    var startX = null, startY = 0, swiped = false;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { startX = e.clientX; startY = e.clientY; swiped = false; } });
    track.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) { swiped = true; show(pickupIndex + (dx < 0 ? 1 : -1)); }
    });
    track.addEventListener('pointercancel', function () { startX = null; });
    // A swipe must not also open the slide.
    track.addEventListener('click', function (e) { if (swiped) { e.preventDefault(); e.stopImmediatePropagation(); swiped = false; } }, true);
    root.querySelector('.cxcx-pickup').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(pickupIndex - 1);
      if (e.key === 'ArrowRight') show(pickupIndex + 1);
    });
  }

  /* ---------- works cards ---------- */
  function buildWorks(items) {
    var list = root.querySelector('[data-cxcx-works]');
    if (!list || !items.length) return;
    list.textContent = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      var a = link(item, 'cxcx-work');
      a.appendChild(media(item, '(max-width: 768px) 72vw, 18vw'));
      var label = el('span', 'cxcx-work-text');
      label.appendChild(el('span', 'cxcx-work-kind', KIND[item.kind].label));
      var title = el('span', '', item.title);
      title.setAttribute('data-i18n-skip', '');
      label.appendChild(title);
      a.appendChild(label);
      a.appendChild(el('span', 'cxcx-work-arrow', '→')).setAttribute('aria-hidden', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ---------- three services: sample = first item of each kind ---------- */
  function buildService(kind, item) {
    var card = root.querySelector('[data-cxcx-service="' + (kind === 'manga' ? 'manga' : kind) + '"]');
    if (!card || !item) return;
    card.href = item.href;
    var thumb = card.querySelector('.cxcx-service-thumb');
    if (thumb && item.poster) {
      var fresh = media(item, '(max-width: 768px) 40vw, 12vw');
      fresh.className = thumb.className;
      thumb.replaceWith(fresh);
    }
    if (item.video) {
      card.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (openModal(item, card)) event.preventDefault();
      });
    }
  }

  /* ---------- video modal (one iframe at a time; removed on close to stop playback) ---------- */
  var modal = root.querySelector('[data-cxcx-modal]');
  var opener = null;
  if (modal) document.body.appendChild(modal); // outside the clipped section
  function openModal(item, from) {
    if (!modal || typeof modal.showModal !== 'function') return false;
    var frame = modal.querySelector('[data-cxcx-frame]');
    var iframe = document.createElement('iframe');
    iframe.src = item.embed + (item.embed.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&rel=0';
    iframe.title = item.title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.textContent = '';
    frame.appendChild(iframe);
    modal.querySelector('[data-cxcx-modal-title]').textContent = KIND[item.kind].name + '｜' + item.title;
    modal.querySelector('[data-cxcx-youtube]').href = item.href;
    opener = from;
    modal.showModal();
    document.documentElement.classList.add('cxcx-modal-open');
    return true;
  }
  if (modal) {
    modal.querySelector('[data-cxcx-close]').addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
    modal.addEventListener('close', function () {
      modal.querySelector('[data-cxcx-frame]').textContent = '';
      document.documentElement.classList.remove('cxcx-modal-open');
      if (opener) opener.focus();
    });
  }

  /* ---------- assemble ---------- */
  Promise.all([getJSON('/bizanime-videos'), getJSON('/works?site=contentsx')]).then(function (res) {
    var videos = res[0] || {};
    var playlists = compact(videos.playlists, fromPlaylist);
    var manga = compact(res[1], fromWork);
    var anime = playlists.filter(function (p) { return p.kind === 'bizanime'; });
    var film = playlists.filter(function (p) { return p.kind === 'bizvideo'; });
    if (!anime.length) anime = compact(videos.cases, fromVideo);

    // PICK UP: the first three playlists in WordPress order (or BizAnime videos before playlists exist).
    var pickup = (playlists.length ? playlists : anime).slice(0, 3);
    var rest = { manga: manga.slice(), bizanime: anime.filter(function (x) { return pickup.indexOf(x) === -1; }),
      bizvideo: film.filter(function (x) { return pickup.indexOf(x) === -1; }) };
    // Cards alternate manga / anime / video so each medium appears in the first three.
    var cards = [];
    while (cards.length < 9 && (rest.manga.length || rest.bizanime.length || rest.bizvideo.length)) {
      ['manga', 'bizanime', 'bizvideo'].forEach(function (k) { if (rest[k].length && cards.length < 9) cards.push(rest[k].shift()); });
    }

    buildPickup(pickup);
    buildWorks(cards);
    buildService('manga', manga[0]);
    buildService('bizanime', anime[0]);
    buildService('bizvideo', film[0]);
    // Marks that WordPress content replaced the fallback (nothing to mark when both requests failed).
    if (pickup.length || cards.length) root.classList.add('cxcx-ready');
  });
})();
