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
        '<a href="contact" class="cb-submit cta-cb" aria-label="お問い合わせ">' +
          '<span class="cb-label" data-ja="お問い合わせ" data-en="Contact Us">お問い合わせ</span>' +
          '<span class="cb-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M22 2L11 13"/>' +
              '<path d="M22 2l-7 20-4-9-9-4 20-7z"/>' +
            '</svg>' +
          '</span>' +
        '</a>' +
        '<button type="button" class="btn btn-outline btn-lg" id="dlBtn" data-ja="資料ダウンロード" data-en="Download Materials">資料ダウンロード</button>' +
      '</div>' +
    '</div>';

  // i18n対応: 英語モードなら即翻訳
  if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
    window.i18n.translateAll();
  }
})();
