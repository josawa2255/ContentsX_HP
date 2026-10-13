/* cxDom — トップ・採用の WordPress 連携部品が共有する小さな道具（2026-10-13 切り出し）。
   使う側: js/cx-manga-reader.js / js/cx-video-player.js / js/home-creative-x.js / js/home-topics.js
   読み込み: これらより前に <script src="/js/cx-dom.js" defer></script>（defer は書いた順に実行される）。
   WordPress の値は textContent でしか書かない（innerHTML を使わない）前提の道具だけを置く。 */
(function () {
  'use strict';
  var IMAGE_HOSTS = ['cms.contentsx.jp', 'contentsx.jp', 'i.ytimg.com'];

  /** 文字列なら前後の空白を除いて返す。それ以外は '' */
  function text(v) { return typeof v === 'string' ? v.trim() : ''; }

  /** 要素を作る。content は textContent として入れる */
  function el(tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content) n.textContent = content;
    return n;
  }

  /** 記号1文字のアイコンボタン（記号は読み上げない） */
  function iconButton(cls, label, glyph) {
    var b = el('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    var g = el('span', '', glyph);
    g.setAttribute('aria-hidden', 'true');
    b.appendChild(g);
    return b;
  }

  /** サイト内パスか、許可したホストの https 画像だけ通す。それ以外は '' */
  function safeImage(url) {
    url = text(url);
    if (/^\/(?!\/)[\w\-./]+$/.test(url)) return url;
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && IMAGE_HOSTS.indexOf(u.hostname) !== -1 ? u.href : '';
    } catch (e) { return ''; }
  }

  /** WP_CONFIG.apiBase + path を JSON で取得。失敗・タイムアウトは警告を出して null */
  function getJSON(path, timeout, label) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, timeout || 8000);
    return fetch(WP_CONFIG.apiBase + path, controller ? { signal: controller.signal } : {})
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .catch(function (e) { console.warn('[' + (label || 'WP') + '] ' + path + ' failed:', e.message); return null; })
      .then(function (d) { clearTimeout(timer); return d; });
  }

  window.cxDom = { text: text, el: el, iconButton: iconButton, safeImage: safeImage, getJSON: getJSON };
})();
