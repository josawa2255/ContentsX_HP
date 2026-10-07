/* TOPICS: cards from WordPress (GET /topics — "Contents X ＞ TOPICS", visible items only,
   PICK UP first, then the admin order). WordPress values are written with textContent;
   links must be a site path or http(s); thumbnails come from known hosts only.
   The three cards in index.html stay when JS is off or the API fails. */
(function () {
  'use strict';
  var root = document.querySelector('[data-cxtp]');
  if (!root) return;
  var list = root.querySelector('[data-cxtp-list]');
  var nav = root.querySelector('[data-cxtp-nav]');
  var IMAGE_HOSTS = ['cms.contentsx.jp', 'contentsx.jp', 'i.ytimg.com'];

  function text(v) { return typeof v === 'string' ? v.trim() : ''; }
  function safeLink(url) {
    url = text(url);
    if (/^\/(?!\/)[^\s<>"'\\]*$/.test(url)) return { href: url, external: false };
    try {
      var u = new URL(url);
      if (u.protocol === 'https:' || u.protocol === 'http:') return { href: u.href, external: true };
    } catch (e) { /* invalid */ }
    return null;
  }
  function safeImage(url) {
    url = text(url);
    if (/^\/(?!\/)[\w\-./]+$/.test(url)) return url;
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && IMAGE_HOSTS.indexOf(u.hostname) !== -1 ? u.href : '';
    } catch (e) { return ''; }
  }
  /* YYYY-MM-DD that is a real calendar date */
  function validDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function el(tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content) n.textContent = content;
    return n;
  }

  function card(t) {
    var link = safeLink(t.url);
    var title = text(t.title);
    if (!link || !title) return null;
    var li = document.createElement('li');
    var a = el('a', 'cxtp-card');
    a.href = link.href;
    if (link.external) { a.target = '_blank'; a.rel = 'noopener'; }
    var thumb = el('span', 'cxtp-thumb');
    var src = safeImage(t.thumbnail);
    if (src) {
      var img = document.createElement('img');
      img.src = src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.width = 960; img.height = 540;
      thumb.appendChild(img);
    }
    a.appendChild(thumb);
    var body = el('span', 'cxtp-body');
    var meta = el('span', 'cxtp-meta');
    var type = text(t.type).toUpperCase().replace(/[^A-Z0-9 \-]/g, '').slice(0, 20);
    if (type) { var ty = el('span', 'cxtp-type', type); ty.setAttribute('data-i18n-skip', ''); meta.appendChild(ty); }
    var date = text(t.date);
    if (validDate(date)) {
      var time = el('time', '', date.replace(/-/g, '.'));
      time.setAttribute('datetime', date);
      meta.appendChild(time);
    }
    meta.appendChild(el('span', 'cxtp-arrow', link.external ? '↗' : '→')).setAttribute('aria-hidden', 'true');
    body.appendChild(meta);
    var ti = el('span', 'cxtp-title', title);
    ti.setAttribute('data-i18n-skip', '');
    body.appendChild(ti);
    var tags = Array.isArray(t.tags) ? t.tags.map(text).filter(Boolean).slice(0, 6) : [];
    if (tags.length) {
      var tg = el('span', 'cxtp-tags');
      tg.setAttribute('data-i18n-skip', '');
      tags.forEach(function (x) { tg.appendChild(el('span', '', '#' + x)); });
      body.appendChild(tg);
    }
    if (link.external) body.appendChild(el('span', 'cxtp-visually-hidden', '（外部サイトが開きます）'));
    a.appendChild(body);
    li.appendChild(a);
    return li;
  }

  /* Arrows (PC, top right) scroll by one card and are disabled at the ends — both are
     disabled when every card already fits. CSS hides them on SP, where cards are swiped. */
  function updateNav() {
    if (!nav) return;
    nav.hidden = false;
    var max = list.scrollWidth - list.clientWidth;
    nav.querySelector('[data-cxtp-prev]').disabled = list.scrollLeft <= 4;
    nav.querySelector('[data-cxtp-next]').disabled = max <= 4 || list.scrollLeft >= max - 4;
  }
  function step(dir) {
    var first = list.querySelector('li');
    if (!first) return;
    var gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    list.scrollBy({ left: dir * (first.getBoundingClientRect().width + gap), behavior: 'smooth' });
  }
  if (nav) {
    nav.querySelector('[data-cxtp-prev]').addEventListener('click', function () { step(-1); });
    nav.querySelector('[data-cxtp-next]').addEventListener('click', function () { step(1); });
  }
  list.addEventListener('scroll', function () { window.requestAnimationFrame(updateNav); }, { passive: true });
  window.addEventListener('resize', updateNav, { passive: true });
  updateNav();

  if (typeof WP_CONFIG === 'undefined' || WP_CONFIG.enabled === false || !WP_CONFIG.apiBase) return;
  var controller = 'AbortController' in window ? new AbortController() : null;
  var timer = controller && setTimeout(function () { controller.abort(); }, 6000);
  fetch(WP_CONFIG.apiBase + '/topics', controller ? { signal: controller.signal } : {})
    .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(function (data) {
      clearTimeout(timer);
      var items = (data && Array.isArray(data.topics) ? data.topics : []).map(card).filter(Boolean);
      if (!items.length) return; // keep the fallback cards
      list.textContent = '';
      items.forEach(function (li) { list.appendChild(li); });
      list.scrollLeft = 0;
      root.classList.add('cxtp-ready');
      updateNav();
    })
    .catch(function (e) { clearTimeout(timer); console.warn('[TOPICS] /topics failed:', e.message); });
})();
