/**
 * 行動トラッキング（BizManga から移植。保存キー bm_tracking は互換のため据え置き）
 * sessionStorageに閲覧行動を蓄積し、問い合わせフォーム送信時にメッセージに付加
 * （js/form-common.js が window.bmGetTrackingNote() を呼ぶ）
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'bm_tracking';

  function getTracking() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function saveTracking(data) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  // ===== ページ訪問記録 =====
  var t = getTracking();
  if (!t.startTime) t.startTime = Date.now();
  if (!t.pages) t.pages = [];
  var currentPage = location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 'home';
  if (t.pages.indexOf(currentPage) === -1) t.pages.push(currentPage);
  saveTracking(t);

  // ===== スクロール深度トラッキング =====
  var maxScroll = 0;
  var scrollKey = 'scroll_' + currentPage;
  var scrollTicking = false;
  function recordScroll() {
    scrollTicking = false;
    var scrollPct = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    if (scrollPct > maxScroll) {
      maxScroll = scrollPct;
      var t = getTracking();
      t[scrollKey] = maxScroll;
      saveTracking(t);
    }
  }
  window.addEventListener('scroll', function() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(recordScroll);
  }, { passive: true });

  // ===== セクション可視化トラッキング =====
  var sections = document.querySelectorAll('section[id]');
  if (sections.length > 0 && 'IntersectionObserver' in window) {
    var viewedKey = 'viewed_' + currentPage;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var t = getTracking();
          if (!t[viewedKey]) t[viewedKey] = [];
          var name = entry.target.id;
          if (t[viewedKey].indexOf(name) === -1) {
            t[viewedKey].push(name);
            saveTracking(t);
          }
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(function(s) { observer.observe(s); });
  }

  // ===== トラッキングデータをテキスト化（フォーム送信時に使用） =====
  window.bmGetTrackingNote = function() {
    var t = getTracking();
    var lines = [];

    // 滞在時間
    if (t.startTime) {
      var mins = Math.round((Date.now() - t.startTime) / 60000);
      if (mins > 0) lines.push('滞在時間: ' + mins + '分');
    }

    // 訪問ページ
    if (t.pages && t.pages.length > 0) {
      lines.push('訪問ページ: ' + t.pages.join(' → '));
    }

    // スクロール深度
    var scrollLines = [];
    Object.keys(t).forEach(function(k) {
      if (k.startsWith('scroll_')) {
        var page = k.replace('scroll_', '');
        scrollLines.push(page + ': ' + t[k] + '%');
      }
    });
    if (scrollLines.length > 0) {
      lines.push('スクロール深度: ' + scrollLines.join(', '));
    }

    return lines.length > 0 ? '\n[行動ログ]\n' + lines.join('\n') : '';
  };
})();
