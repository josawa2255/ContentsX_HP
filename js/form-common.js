/* ============================================
   フォーム共通の部品（お問い合わせ /contact と 採用エントリー /recruit/entry で共用）
   - 画面の作り・項目・送信先・完了表示は各ページの JS が持つ。ここは中身を持たない道具だけ
   - 読み込み順: このファイル → 各ページの JS（contact.js / recruit-entry.js）
   ============================================ */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var HUBSPOT_PORTAL_ID = '48367061';

  function isEn() {
    return !!(window.i18n && typeof window.i18n.getLang === 'function' && window.i18n.getLang() === 'en');
  }

  // HTML の required は空白だけの入力を通すので、送信時に前後の空白を除いて空なら止める。
  // 止めたら入力欄にメッセージを出し、次に入力されたら解除する。
  function requireTrimmed(input, messageJa, messageEn) {
    if (!input) return true;
    if (!input.dataset.cxTrimWatch) {
      input.dataset.cxTrimWatch = '1';
      input.addEventListener('input', function () { input.setCustomValidity(''); });
    }
    if (input.value.trim()) return true;
    input.setCustomValidity(isEn() ? messageEn : messageJa);
    input.reportValidity();
    return false;
  }

  // 流入元（utm_* / source）と行動ログ（tracking.js）を本文の末尾に付ける文
  function trackingNote() {
    var lines = [];
    var map = [['utm_source', '流入元'], ['utm_medium', '媒体'], ['utm_campaign', 'キャンペーン'], ['source', '参照ページ']];
    map.forEach(function (m) {
      var v = params.get(m[0]);
      if (v) lines.push(m[1] + ': ' + v);
    });
    var behaviorLog = typeof window.bmGetTrackingNote === 'function' ? window.bmGetTrackingNote() : '';
    return lines.length > 0 || behaviorLog ? '\n\n---\n[トラッキング]\n' + lines.join('\n') + behaviorLog : '';
  }

  // HubSpot Forms API（v3）へ送る。fields は [{ name, value }]。成功で resolve、失敗で reject
  function submitHubSpot(formGuid, fields) {
    var url = 'https://api.hsforms.com/submissions/v3/integration/submit/' + HUBSPOT_PORTAL_ID + '/' + formGuid;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: fields,
        context: { pageUri: window.location.href, pageName: document.title }
      })
    }).then(function (res) {
      if (res.ok) return res.json();
      return res.text().then(function (t) { throw new Error(t); });
    });
  }

  // 送信中はボタンを押せなくする（二重送信の防止）
  function setSending(button, sending) {
    if (!button) return;
    button.disabled = sending;
    button.classList.toggle('is-sending', sending);
  }

  window.cxForm = {
    params: params,
    isEn: isEn,
    requireTrimmed: requireTrimmed,
    trackingNote: trackingNote,
    submitHubSpot: submitHubSpot,
    setSending: setSending
  };
})();
