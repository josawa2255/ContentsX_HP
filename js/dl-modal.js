// ===== 資料DLモーダル 共通スクリプト =====
// dlBtn      : 資料DLボタン（id="dlBtn"）
// dlModal    : モーダルオーバーレイ（id="dlModal"）
// dlModalClose : 閉じるボタン（id="dlModalClose"）
// cx_form_submitted : localStorage フラグ（contact.js で設定）

document.addEventListener('DOMContentLoaded', function() {
  var dlBtn = document.getElementById('dlBtn');
  var dlModal = document.getElementById('dlModal');
  var dlModalClose = document.getElementById('dlModalClose');
  if (!dlBtn || !dlModal) return;

  dlBtn.addEventListener('click', function() {
    var submitted = false;
    try { submitted = localStorage.getItem('cx_form_submitted') === '1'; } catch(e) {}

    if (submitted) {
      // フォーム記入済み → 直接DL
      var a = document.createElement('a');
      a.href = 'material/ContentsX_アライアンス提案書.pdf';
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // 未記入 → モーダル表示
      dlModal.classList.add('active');
    }
  });

  if (dlModalClose) {
    dlModalClose.addEventListener('click', function() {
      dlModal.classList.remove('active');
    });
  }

  dlModal.addEventListener('click', function(e) {
    if (e.target === dlModal) dlModal.classList.remove('active');
  });
});
