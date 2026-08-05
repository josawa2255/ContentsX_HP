// URLパラメータ解析（流入元トラッキング + 自動入力）
var CX_PARAMS = new URLSearchParams(window.location.search);

// 採用ページからのposition自動入力
(function() {
  var position = CX_PARAMS.get('position');
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

// Contents X CRM の受信箱に問い合わせを流す（HubSpotへの送信とは独立）。
// CRM側は受信箱に溜めるだけで、担当者が承認して初めて会社・活動が作られる。
// ここのトークンは静的サイトに埋まる＝機密ではない。総当たり抑止用の門番で、
// 実質のスパム対策はCRM側のレート制限とハニーポット。
// ⚠️ ローテーション時は CRM側 Vercel の INBOUND_SECRET と必ず同時に更新する
//    （片方だけだとCRM送信が全件401で落ちるが、HubSpot受付は正常に動き続ける）。
// エンドポイントは Vercel の本番URL。独自ドメイン crm.contentsx.jp は
// 割当が保留中（現在NXDOMAIN）のため、割当後にここを差し替える。
var CRM_ENDPOINT = 'https://contentsx-crm.vercel.app/api/inbound/web';
var CRM_TOKEN    = 'ENoK7H4O60a8KdKlTal12exoV2rqSNlIb841sj3dSeo=';

// 二重送信ガード: ボタンの disabled だけだと、Enter や requestSubmit() など
// ボタンを経由しない送信経路をすり抜ける。フォーム単位のフラグで塞ぐ（BUGS #046）
var cxIsSubmitting = false;

document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();

  if (cxIsSubmitting) return;
  cxIsSubmitting = true;

  var submitBtn = e.target.querySelector('.form-submit');
  submitBtn.disabled = true;
  submitBtn.classList.add('is-sending');

  var company = document.getElementById('company').value;
  var department = document.getElementById('department').value;
  var fullName = document.getElementById('fullName').value;
  var email = document.getElementById('email').value;
  var message = document.getElementById('message').value;

  // 流入元トラッキング情報をメッセージに付加
  var tracking = [];
  var utmSource   = CX_PARAMS.get('utm_source');
  var utmMedium   = CX_PARAMS.get('utm_medium');
  var utmCampaign = CX_PARAMS.get('utm_campaign');
  var source      = CX_PARAMS.get('source');
  if (utmSource)   tracking.push('流入元: ' + utmSource);
  if (utmMedium)   tracking.push('媒体: ' + utmMedium);
  if (utmCampaign) tracking.push('キャンペーン: ' + utmCampaign);
  if (source)      tracking.push('参照ページ: ' + source);
  var behaviorLog = typeof window.bmGetTrackingNote === 'function' ? window.bmGetTrackingNote() : '';
  var trackingNote = tracking.length > 0 || behaviorLog ? '\n\n---\n[トラッキング]\n' + tracking.join('\n') + behaviorLog : '';

  var fields = [
    { name: 'company',   value: company },
    { name: 'busyo',     value: department },
    { name: 'lastname',  value: fullName },
    { name: 'firstname', value: fullName },
    { name: 'email',     value: email },
    { name: 'message',   value: message + trackingNote }
  ];

  var payload = {
    fields: fields,
    context: {
      pageUri: window.location.href,
      pageName: document.title
    }
  };

  // CRM受信箱へも送る（HubSpotとは独立。失敗しても送信者には影響させない＝
  // CRMが落ちていてもHubSpot側の受付とサンクス表示は従来どおり動く）。
  // ただし採用応募（recruit.html から ?position= 付きで遷移）は営業リードではないため送らない。
  var isRecruitApplication = !!CX_PARAMS.get('position');
  if (!isRecruitApplication) {
    try {
      fetch(CRM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CRM_TOKEN
        },
        body: JSON.stringify({
          site: 'contentsx',
          company_name: company,
          department: department,
          full_name: fullName,
          email: email,
          message: message,
          page_url: window.location.href,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          referrer: document.referrer || null,
          hp: document.getElementById('cxWebsite') ? document.getElementById('cxWebsite').value : ''
        })
      }).catch(function (err) {
        console.warn('CRM inbound failed (ignored):', err);
      });
    } catch (err) {
      console.warn('CRM inbound skipped:', err);
    }
  }

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
      + '<a href="material/docs/ContentsX_アライアンス提案書.pdf" download style="display:inline-block;padding:12px 32px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:4px;transition:filter 0.2s;">資料ダウンロード</a>'
      + '</div>';
    form.parentNode.insertBefore(thanks, form.nextSibling);
    form.style.display = 'none';
  })
  .catch(function(err) {
    cxIsSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-sending');
    // 応答が取れなかっただけで送信自体は届いている場合がある（送信後の通信断など）。
    // 「もう一度お試しください」と促すと、届いているのに再送されて重複する（BUGS #046）
    alert('送信結果を確認できませんでした。\n通信状況によっては、すでに送信が完了している場合があります。\n重複を避けるため、しばらく経ってからもう一度お試しください。');
  });
});
