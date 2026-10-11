/* ============================================
   採用エントリー（/recruit/entry）
   - 共通の部品は js/form-common.js（お問い合わせと共用）
   - 法人の営業リードと混ざらないように:
       * CRM（ビズカルテ）の受信箱へは送らない（貼り付けコードも読み込んでいない）
       * Google広告のお問い合わせコンバージョンは送らない。計測は GA4 の recruit_entry_submit だけ
       * 送信内容の先頭と「部署」欄に「採用応募」と入れ、受け取った側で見分けられるようにする
   ============================================ */
(function () {
  'use strict';

  // ⚠️ 送信先（暫定）: 採用専用の受付先がまだ無いため、今までの採用応募と同じ
  // HubSpot の B/C 共通お問い合わせフォームに送っている（SPEC.md §9.7）。
  // 採用専用のフォーム（GUID）が用意できたら、ここを差し替えるだけでよい。
  var RECRUIT_HUBSPOT_FORM_GUID = 'b6da14d0-d60d-4357-89fc-0015ed32b704';
  var RECRUIT_LABEL = '採用応募';

  var form = document.getElementById('recruitEntryForm');
  if (!form || !window.cxForm) return;
  var cx = window.cxForm;
  var thanks = document.getElementById('recruitEntryThanks');
  var positionSelect = document.getElementById('position');
  var typeError = document.getElementById('hiringTypeError');
  var typeInputs = form.querySelectorAll('input[name="hiringType"]');

  // --- 希望職種の自動選択（?position=職種名）---
  // リストに無い職種名（旧リンクの文言など）は「その他・未定」にし、元の文字は本文の先頭に残す
  var requested = (cx.params.get('position') || '').trim();
  if (requested) {
    var match = Array.prototype.some.call(positionSelect.options, function (o) { return o.value === requested; });
    positionSelect.value = match ? requested : 'その他・未定';
    if (!match) {
      var msg = document.getElementById('message');
      if (msg && !msg.value) msg.value = '希望職種: ' + requested + '\n\n';
    }
  }
  // ?type=新卒 / 正社員（中途） / インターン で応募区分も選べる（採用ページ以外から案内するとき用）
  var requestedType = (cx.params.get('type') || '').trim();
  Array.prototype.forEach.call(typeInputs, function (r) { if (r.value === requestedType) r.checked = true; });

  // --- 入力チェック ---
  // ブラウザ標準の検査（required / email / url）に加え、空白だけの入力と応募区分の未選択を止める
  var showTypeError = function (show) {
    typeError.hidden = !show;
    Array.prototype.forEach.call(typeInputs, function (r) { r.setAttribute('aria-invalid', String(show)); });
    if (show) typeError.setAttribute('role', 'alert');
  };
  Array.prototype.forEach.call(typeInputs, function (r) {
    r.addEventListener('change', function () { showTypeError(false); });
  });

  var validate = function () {
    var typeChecked = form.querySelector('input[name="hiringType"]:checked');
    if (!typeChecked) {
      showTypeError(true);
      typeInputs[0].focus();
      return false;
    }
    if (!cx.requireTrimmed(document.getElementById('fullName'), 'お名前を入力してください', 'Please enter your name.')) return false;
    if (!cx.requireTrimmed(document.getElementById('message'), '志望動機・自己PR・ご質問を入力してください', 'Please enter a message.')) return false;
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  };

  var value = function (id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  var showThanks = function () {
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
    thanks.scrollIntoView({ block: 'center' });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    // ハニーポットに値があればボット。送らずに完了表示だけ出す
    if (value('cxWebsite')) { showThanks(); return; }

    var submitBtn = form.querySelector('.form-submit');
    cx.setSending(submitBtn, true);

    var hiringType = form.querySelector('input[name="hiringType"]:checked').value;
    var position = positionSelect.value;
    var fullName = value('fullName');
    var affiliation = value('affiliation');

    // 受け取った側が一目で採用応募と分かる本文（項目名つき）
    var body = [
      '【' + RECRUIT_LABEL + '】' + hiringType + '／' + position,
      '',
      '応募区分: ' + hiringType,
      '希望職種: ' + position,
      'お名前: ' + fullName,
      'ふりがな: ' + (value('furigana') || '—'),
      'メール: ' + value('email'),
      '電話番号: ' + (value('phone') || '—'),
      '学校名・所属: ' + (affiliation || '—'),
      '卒業（予定）年月: ' + (value('graduation') || '—'),
      'ポートフォリオ・経歴: ' + (value('portfolio') || '—'),
      '',
      '--- 志望動機・自己PR・ご質問 ---',
      value('message')
    ].join('\n') + cx.trackingNote();

    // 項目名は共通フォームのもの。company / busyo（部署）はフォーム側で必須なので、所属と「採用応募」を入れる
    var fields = [
      { name: 'company',   value: affiliation || '（個人）' + RECRUIT_LABEL },
      { name: 'busyo',     value: RECRUIT_LABEL + '（' + hiringType + '）' },
      { name: 'lastname',  value: fullName },
      { name: 'firstname', value: fullName },
      { name: 'email',     value: value('email') },
      { name: 'message',   value: body }
    ];

    cx.submitHubSpot(RECRUIT_HUBSPOT_FORM_GUID, fields)
      .then(function () {
        // 採用の応募数は GA4 のイベントで数える（広告のお問い合わせコンバージョンには入れない）
        if (typeof gtag === 'function') {
          gtag('event', 'recruit_entry_submit', { hiring_type: hiringType, position: position });
        }
        showThanks();
      })
      .catch(function () {
        cx.setSending(submitBtn, false);
        alert(cx.isEn()
          ? 'Sending failed. Please try again.'
          : '送信に失敗しました。お手数ですが、もう一度お試しください。');
      });
  });
})();
