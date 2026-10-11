// 法人向けお問い合わせ（/contact）。共通の部品は js/form-common.js（採用エントリーと共用）
var CX_PARAMS = window.cxForm.params;

// 採用応募は別フォーム（/recruit/entry）。旧リンク /contact?position=職種 で来たら、
// 営業の問い合わせとして送られないよう、職種を付けたまま採用フォームへ移す
if (CX_PARAMS.get('position')) {
  window.location.replace('/recruit/entry?position=' + encodeURIComponent(CX_PARAMS.get('position')));
}

// HubSpot の送信先（B/C 共通の法人お問い合わせフォーム）
var HUBSPOT_FORM_GUID = 'b6da14d0-d60d-4357-89fc-0015ed32b704';

// CRM（ビズカルテ）の受信箱へ写しを送る。送信は contact.html 末尾の貼り付けコード
// （embed/inbound-v1.js）が行う。項目は各入力欄の data-crm-field で指定している。
// 貼り付けコードは async なので、送信時にまだ読み込めていなければ読み込み完了を待って送る。
// 例外は外へ出さない＝CRM 側が壊れていても HubSpot への送信とサンクス表示は止めない。
// CRM に届かないことは画面に出ないため（BUGS #056）、届けられなかったときはコンソールに残す。
function copyToCrm(form) {
  try {
    if (window.BizcarteInbound && typeof window.BizcarteInbound.sendForm === 'function') {
      window.BizcarteInbound.sendForm(form);
      return;
    }
    // ファイル名ではなく公開キーの属性で探す（貼り付けコードの版が変わってもここは直さなくてよい）
    var s = document.querySelector('script[data-source-key]');
    if (!s) {
      console.warn('CRM inbound skipped: 貼り付けコードが見つかりません');
      return;
    }
    var settled = false;
    s.addEventListener('load', function () {
      settled = true;
      try {
        if (window.BizcarteInbound) window.BizcarteInbound.sendForm(form);
        else console.warn('CRM inbound skipped: 貼り付けコードは読み込めたが BizcarteInbound がありません');
      } catch (err) { console.warn('CRM inbound failed (ignored):', err); }
    }, { once: true });
    s.addEventListener('error', function () {
      settled = true;
      console.warn('CRM inbound skipped: 貼り付けコードを読み込めませんでした');
    }, { once: true });
    // 送信より前に読み込みが失敗・完了していると上のイベントは二度と来ないため、時間で見切って記録する
    setTimeout(function () {
      if (!settled && !window.BizcarteInbound) console.warn('CRM inbound skipped: 貼り付けコードが読み込めていません');
    }, 8000);
  } catch (err) { console.warn('CRM inbound failed (ignored):', err); }
}

// 部署は HubSpot のフォーム側で必須（空だと送信が拒否される）。空白だけの入力も止める
var departmentInput = document.getElementById('department');

document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();

  if (!window.cxForm.requireTrimmed(departmentInput, '部署を入力してください', 'Please enter your department.')) return;

  var submitBtn = e.target.querySelector('.form-submit');
  window.cxForm.setSending(submitBtn, true);

  var company = document.getElementById('company').value;
  var department = document.getElementById('department').value;
  var fullName = document.getElementById('fullName').value;
  var email = document.getElementById('email').value;
  var message = document.getElementById('message').value;

  // 流入元トラッキング情報をメッセージに付加
  var trackingNote = window.cxForm.trackingNote();

  var fields = [
    { name: 'company',   value: company },
    { name: 'busyo',     value: department },
    { name: 'lastname',  value: fullName },
    { name: 'firstname', value: fullName },
    { name: 'email',     value: email },
    { name: 'message',   value: message + trackingNote }
  ];

  // CRM の受信箱へも送る（失敗しても HubSpot の受付・完了表示には影響しない）。
  // 採用応募は /recruit/entry に分けたので、ここに来るのは法人のお問い合わせだけ
  copyToCrm(e.target);

  window.cxForm.submitHubSpot(HUBSPOT_FORM_GUID, fields)
  .then(function() {
    // Google広告コンバージョン: お問合せフォーム送信完了サンクス
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {'send_to': 'AW-18108125426/F13ECI3R3qgcEPKh0LpD'});
    }
    // 送信成功 — 資料DL許可フラグを保存
    try { localStorage.setItem('cx_form_submitted', '1'); } catch(e) {}
    var form = document.getElementById('contactForm');
    // サンクスメッセージ + 資料DLリンク表示
    var thanks = document.createElement('div');
    thanks.className = 'form-thanks';
    thanks.innerHTML = '<p style="text-align:center;font-size:18px;font-weight:700;color:var(--accent);margin-top:24px;">お問い合わせありがとうございます。</p>'
      + '<p style="text-align:center;font-size:14px;color:var(--text-muted);margin-top:8px;">3営業日以内にご連絡いたします。</p>'
      + '<div style="text-align:center;margin-top:32px;padding:24px;background:var(--bg-light);border-radius:8px;">'
      + '<p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">サービス資料をダウンロード</p>'
      + '<a href="/material/docs/ContentsX_アライアンス提案書.pdf" download style="display:inline-block;padding:12px 32px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:4px;transition:filter 0.2s;">資料ダウンロード</a>'
      + '</div>';
    form.parentNode.insertBefore(thanks, form.nextSibling);
    form.style.display = 'none';
  })
  .catch(function(err) {
    window.cxForm.setSending(submitBtn, false);
    alert('送信に失敗しました。お手数ですが、もう一度お試しください。');
  });
});
