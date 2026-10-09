/* CxVideoPlayer — inline 16:9 player with a row of thumbnails (Issue #97). Shared by BizAnime and
   BizVideo; only the data differs. Nothing plays until the visitor presses play (no autoplay on
   load); the embed is then created in place (no popup). Choosing another video, switching service
   or calling stop() removes the embed, so the previous video stops.
   items: [{ title, description, provider: youtube|youtube_playlist|drive|mp4, video_id, src, poster }]
   Embed URLs are rebuilt from validated IDs; nothing from the data is written as HTML.
   CxVideoPlayer.playable(items) returns the items that can be played (the caller decides what to
   show when there are none). */
(function () {
  'use strict';
  var YT_ID = /^[A-Za-z0-9_-]{6,20}$/;
  var LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
  var DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
  var IMAGE_HOSTS = ['i.ytimg.com', 'cms.contentsx.jp', 'contentsx.jp'];

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
  function safeImage(url) {
    if (typeof url !== 'string' || !url) return '';
    if (/^\/(?!\/)[\w\-./]+$/.test(url)) return url;
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && IMAGE_HOSTS.indexOf(u.hostname) !== -1 ? u.href : '';
    } catch (e) { return ''; }
  }
  /** Build the embed for a user-initiated play. Returns null when the item is not playable. */
  function embedFor(item) {
    var id = String(item.video_id || '');
    if (item.provider === 'youtube' && YT_ID.test(id)) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1' };
    if (item.provider === 'youtube_playlist' && LIST_ID.test(id)) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + id + '&autoplay=1&rel=0&playsinline=1' };
    if (item.provider === 'drive' && DRIVE_ID.test(id)) return { kind: 'iframe', src: 'https://drive.google.com/file/d/' + id + '/preview' };
    if (item.provider === 'mp4' && /^https:\/\/[^\s"'<>]+\.mp4(\?[^\s"'<>]*)?$/i.test(item.src || '')) return { kind: 'video', src: item.src };
    return null;
  }
  function posterFor(item) {
    var p = safeImage(item.poster);
    if (p) return p;
    if ((item.provider === 'youtube') && YT_ID.test(String(item.video_id || ''))) return 'https://i.ytimg.com/vi/' + item.video_id + '/hqdefault.jpg';
    return '';
  }
  /** YouTube answers a missing maxresdefault with a 120×90 grey placeholder: fall back to hqdefault. */
  function poster(img, src) {
    img.src = src;
    img.addEventListener('load', function () {
      if (img.naturalWidth <= 120 && /\/maxresdefault\.jpg$/.test(img.src)) img.src = img.src.replace(/maxresdefault\.jpg$/, 'hqdefault.jpg');
    });
  }
  function playable(items) {
    return (Array.isArray(items) ? items : []).filter(function (it) { return it && embedFor(it); });
  }

  window.CxVideoPlayer = function (root, items, opts) {
    opts = opts || {};
    items = playable(items).slice(0, opts.max || 3);
    var current = 0;
    root.textContent = '';
    root.classList.add('cxvp');
    if (!items.length) return { stop: function () {}, destroy: function () { root.textContent = ''; } };

    var stage = el('div', 'cxvp-stage');
    var strip = el('div', 'cxvp-strip');
    var prevBtn = iconButton('cxvp-arrow cxvp-arrow-prev', '前の動画', '‹');
    var thumbs = el('div', 'cxvp-thumbs');
    thumbs.setAttribute('role', 'group');
    thumbs.setAttribute('aria-label', '動画を選ぶ');
    var nextBtn = iconButton('cxvp-arrow cxvp-arrow-next', '次の動画', '›');
    strip.appendChild(prevBtn); strip.appendChild(thumbs); strip.appendChild(nextBtn);
    root.appendChild(stage); root.appendChild(strip);

    var thumbButtons = items.map(function (item, i) {
      var b = el('button', 'cxvp-thumb');
      b.type = 'button';
      b.setAttribute('aria-label', (i + 1) + '本目: ' + (item.title || '動画'));
      var media = el('span', 'cxvp-thumb-media');
      var src = posterFor(item);
      if (src) { var img = el('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; poster(img, src); media.appendChild(img); }
      b.appendChild(media);
      var t = el('span', 'cxvp-thumb-title', item.title || '動画');
      t.setAttribute('data-i18n-skip', '');
      b.appendChild(t);
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var to = Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
          thumbButtons[to].focus();
          e.preventDefault();
        }
      });
      thumbs.appendChild(b);
      return b;
    });

    function showPoster(item) {
      stage.textContent = '';
      stage.classList.remove('is-playing', 'is-loading', 'is-error');
      var src = posterFor(item);
      if (src) {
        var img = el('img', 'cxvp-poster');
        img.alt = ''; img.decoding = 'async';
        poster(img, src);
        img.addEventListener('error', function () { img.remove(); });
        stage.appendChild(img);
      }
      var cap = el('div', 'cxvp-caption');
      var t = el('p', 'cxvp-title', item.title || '');
      t.setAttribute('data-i18n-skip', '');
      cap.appendChild(t);
      if (item.description) {
        var d = el('p', 'cxvp-desc', item.description);
        d.setAttribute('data-i18n-skip', '');
        cap.appendChild(d);
      }
      stage.appendChild(cap);
      var play = el('button', 'cxvp-play');
      play.type = 'button';
      play.setAttribute('aria-label', (item.title || '動画') + 'を再生');
      var ring = el('span', 'cxvp-play-ring');
      ring.setAttribute('aria-hidden', 'true');
      play.appendChild(ring);
      play.addEventListener('click', function () { start(item); });
      stage.appendChild(play);
    }
    function start(item) {
      var e = embedFor(item);
      if (!e) return;
      stage.textContent = '';
      stage.classList.add('is-playing', 'is-loading');
      var spinner = el('div', 'cxvp-loading', '読み込み中…');
      spinner.setAttribute('role', 'status');
      stage.appendChild(spinner);
      var node;
      if (e.kind === 'video') {
        node = el('video', 'cxvp-media');
        node.src = e.src; node.controls = true; node.playsInline = true; node.preload = 'metadata';
        var p = posterFor(item); if (p) node.poster = p;
        node.addEventListener('loadeddata', function () { stage.classList.remove('is-loading'); spinner.remove(); });
        node.addEventListener('error', showError);
        stage.appendChild(node);
        var pr = node.play(); if (pr && pr.catch) pr.catch(function () {});
      } else {
        node = el('iframe', 'cxvp-media');
        node.src = e.src;
        node.title = item.title || '動画';
        node.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        node.allowFullscreen = true;
        node.referrerPolicy = 'strict-origin-when-cross-origin';
        node.addEventListener('load', function () { stage.classList.remove('is-loading'); spinner.remove(); });
        stage.appendChild(node);
      }
      function showError() {
        stage.classList.remove('is-loading');
        stage.classList.add('is-error');
        spinner.textContent = '動画を再生できませんでした。時間をおいて、もう一度お試しください。';
      }
    }
    function select(i) {
      current = (i + items.length) % items.length;
      thumbButtons.forEach(function (b, k) {
        b.classList.toggle('is-active', k === current);
        if (k === current) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      showPoster(items[current]);
      var tb = thumbButtons[current];
      // Centre the chosen thumbnail inside the strip (measured against the strip, not its offset parent).
      var shift = tb.getBoundingClientRect().left - thumbs.getBoundingClientRect().left;
      thumbs.scrollTo({ left: thumbs.scrollLeft + shift - (thumbs.clientWidth - tb.offsetWidth) / 2, behavior: 'smooth' });
      prevBtn.disabled = items.length < 2;
      nextBtn.disabled = items.length < 2;
    }
    prevBtn.addEventListener('click', function () { select(current - 1); });
    nextBtn.addEventListener('click', function () { select(current + 1); });
    select(0);

    return {
      stop: function () { if (stage.classList.contains('is-playing')) showPoster(items[current]); },
      destroy: function () { root.textContent = ''; }
    };
  };
  window.CxVideoPlayer.playable = playable;
})();
