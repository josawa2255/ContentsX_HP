// 採用ページからのposition自動入力
(function() {
  var params = new URLSearchParams(window.location.search);
  var position = params.get('position');
  if (position) {
    var msgField = document.getElementById('message');
    if (msgField) {
      msgField.value = '【応募】' + position + '\n\n';
    }
  }
})();

// HubSpot Forms API 送信
var HUBSPOT_PORTAL_ID = '48367061';
var HUBSPOT_FORM_GUID = 'b6da14d0-d60d-4357-89fc-0015ed32b704';

document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();

  var submitBtn = e.target.querySelector('.form-submit');
  var originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '送信中...';

  var company = document.getElementById('company').value;
  var department = document.getElementById('department').value;
  var fullName = document.getElementById('fullName').value;
  var email = document.getElementById('email').value;
  var message = document.getElementById('message').value;

  var fields = [
    { name: 'company',   value: company },
    { name: 'busyo',     value: department },
    { name: 'lastname',  value: fullName },
    { name: 'firstname', value: fullName },
    { name: 'email',     value: email },
    { name: 'message',   value: message }
  ];

  var payload = {
    fields: fields,
    context: {
      pageUri: window.location.href,
      pageName: document.title
    }
  };

  var url = 'https://api.hsforms.com/submissions/v3/integration/submit/'
    + HUBSPOT_PORTAL_ID + '/' + HUBSPOT_FORM_GUID;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    if (res.ok) {
      return res.json();
    }
    return res.text().then(function(t) {
      throw new Error(t);
    });
  })
  .then(function() {
    // 送信成功 — 資料DL許可フラグを保存
    try { localStorage.setItem('cx_form_submitted', '1'); } catch(e) {}
    submitBtn.textContent = '送信完了';
    submitBtn.style.background = '#2e7d32';
    var form = document.getElementById('contactForm');
    // サンクスメッセージ + 資料DLリンク表示
    var thanks = document.createElement('div');
    thanks.className = 'form-thanks';
    thanks.innerHTML = '<p style="text-align:center;font-size:18px;font-weight:700;color:var(--accent);margin-top:24px;">お問い合わせありがとうございます。</p>'
      + '<p style="text-align:center;font-size:14px;color:var(--text-muted);margin-top:8px;">3営業日以内にご連絡いたします。</p>'
      + '<div style="text-align:center;margin-top:32px;padding:24px;background:var(--bg-light);border-radius:8px;">'
      + '<p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">サービス資料をダウンロード</p>'
      + '<a href="material/docs/ContentsX_アライアンス提案書.pdf" download style="display:inline-block;padding:12px 32px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:4px;transition:filter 0.2s;">資料ダウンロード</a>'
      + '</div>';
    form.parentNode.insertBefore(thanks, form.nextSibling);
    form.style.display = 'none';
  })
  .catch(function(err) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    alert('送信に失敗しました。お手数ですが、もう一度お試しください。');
  });
});
