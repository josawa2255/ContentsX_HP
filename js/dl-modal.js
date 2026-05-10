// ===== 資料DLモーダル 共通スクリプト =====
// 対象ボタン : id="dlBtn" または class="js-dl-trigger"
//              (ヒーローと CTA セクションで複数置けるよう class で統一)
// dlModal    : モーダルオーバーレイ（id="dlModal"）
// dlModalClose : 閉じるボタン（id="dlModalClose"）
// cx_form_submitted : localStorage フラグ（contact.js で設定）

document.addEventListener('DOMContentLoaded', function() {
  var dlBtns = document.querySelectorAll('#dlBtn, .js-dl-trigger');
  var dlModal = document.getElementById('dlModal');
  var dlModalClose = document.getElementById('dlModalClose');
  if (!dlBtns.length || !dlModal) return;

  function handleClick(e) {
    if (e.currentTarget.tagName === 'A') e.preventDefault();
    var submitted = false;
    try { submitted = localStorage.getItem('cx_form_submitted') === '1'; } catch(e2) {}

    if (submitted) {
      // フォーム記入済み → 直接DL
      var a = document.createElement('a');
      a.href = 'material/docs/ContentsX_アライアンス提案書.pdf';
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // 未記入 → モーダル表示
      dlModal.classList.add('active');
    }
  }
  dlBtns.forEach(function(b) { b.addEventListener('click', handleClick); });

  if (dlModalClose) {
    dlModalClose.addEventListener('click', function() {
      dlModal.classList.remove('active');
    });
  }

  dlModal.addEventListener('click', function(e) {
    if (e.target === dlModal) dlModal.classList.remove('active');
  });
});
