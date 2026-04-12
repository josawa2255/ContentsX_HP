/**
 * ContentsX 共通CTAセクション生成
 * <section id="cxCtaMount"></section> を置くだけで統一CTAを挿入
 * 各ページで重複していたCTAマークアップを一元化
 */
(function () {
  var mount = document.getElementById('cxCtaMount');
  if (!mount) return;

  mount.className = 'cta';
  mount.id = 'contact';
  mount.innerHTML =
    '<div class="container">' +
      '<h2 class="cta-title" data-ja="物語で、世界の理解を拡張する。" data-en="Expand global understanding through stories.">物語で、世界の理解を拡張する。</h2>' +
      '<p class="cta-desc" data-ja="まずは無料でご相談ください。" data-en="Start with a free consultation.">まずは無料でご相談ください。</p>' +
      '<div class="cta-actions">' +
        '<a href="contact" class="nav-cta nav-cta--lg" data-ja="お問い合わせ" data-en="Contact Us">お問い合わせ</a>' +
        '<button type="button" class="nav-cta nav-cta--lg nav-cta--ghost" id="dlBtn" data-ja="資料ダウンロード" data-en="Download Materials">資料ダウンロード</button>' +
      '</div>' +
    '</div>';

  // i18n対応: 英語モードなら即翻訳
  if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
    window.i18n.translateAll();
  }
})();
