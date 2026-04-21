/**
 * クライアント企業ロゴ無限カルーセル
 * データ: js/data/client-logos.js (CLIENT_LOGOS)
 * レンダリング: 2セット並べて translateX(-50%) アニメでループ
 */
(function () {
  'use strict';

  function renderItem(c) {
    const tag = c.url ? 'a' : 'span';
    const href = c.url ? ` href="${c.url}" target="_blank" rel="noopener noreferrer"` : '';
    const inner = c.logo
      ? `<img src="${c.logo}" alt="${c.name}" loading="lazy" width="140" height="48">`
      : `<span class="client-logo-text">${c.name}</span>`;
    return `<${tag} class="client-logo-item" aria-label="${c.name}"${href}>${inner}</${tag}>`;
  }

  function init() {
    const track = document.getElementById('clientLogosTrack');
    if (!track || typeof CLIENT_LOGOS === 'undefined' || !CLIENT_LOGOS.length) return;
    const items = CLIENT_LOGOS.map(renderItem).join('');
    // 社数が少なくても幅を確保するため6セット複製し、translateX(-16.6667%) でループ
    track.innerHTML = items.repeat(6);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
