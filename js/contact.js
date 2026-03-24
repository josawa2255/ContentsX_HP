// HubSpot Forms API 送信
var HUBSPOT_PORTAL_ID = '48367061';
var HUBSPOT_FORM_GUID = 'd8b2249d-923b-b53e-2e64-c81a4f77f4cb';

document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();

  var submitBtn = e.target.querySelector('.form-submit');
  var originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '送信中...';

  var lastName = document.getElementById('lastName').value;
  var firstName = document.getElementById('firstName').value;
  var lastNameKana = document.getElementById('lastNameKana').value;
  var firstNameKana = document.getElementById('firstNameKana').value;
  var company = document.getElementById('company').value;
  var position = document.getElementById('position').value;
  var email = document.getElementById('email').value;
  var phone = document.getElementById('phone').value;
  var category = document.getElementById('category');
  var categoryText = category.options[category.selectedIndex].text;
  var message = document.getElementById('message').value;

  var fields = [
    { name: 'lastname',  value: lastName },
    { name: 'firstname', value: firstName },
    { name: 'lastname_kana',  value: lastNameKana },
    { name: 'firstname_kana', value: firstNameKana },
    { name: 'company',   value: company },
    { name: 'jobtitle',  value: position },
    { name: 'email',     value: email },
    { name: 'phone',     value: phone },
    { name: 'inquiry_type', value: categoryText },
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
    return res.text().then(function(t) { throw new Error(t); });
  })
  .then(function() {
    // 送信成功
    submitBtn.textContent = '送信完了';
    submitBtn.style.background = '#2e7d32';
    var form = document.getElementById('contactForm');
    // サンクスメッセージ表示
    var thanks = document.createElement('div');
    thanks.className = 'form-thanks';
    thanks.innerHTML = '<p style="text-align:center;font-size:18px;font-weight:700;color:var(--accent);margin-top:24px;">お問い合わせありがとうございます。</p>'
      + '<p style="text-align:center;font-size:14px;color:var(--text-muted);margin-top:8px;">3営業日以内にご連絡いたします。</p>';
    form.parentNode.insertBefore(thanks, form.nextSibling);
    form.style.display = 'none';
  })
  .catch(function(err) {
    console.error('HubSpot submission error:', err);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    alert('送信に失敗しました。お手数ですが、もう一度お試しください。');
  });
});
