/**
 * ContentsX Hero FX — タグライン文字分割＋波シャイン
 * オープニング(intro)終了後に発動する
 */
(function() {
  'use strict';

  var tagline = document.getElementById('heroTagline');
  if (!tagline) return;

  var originalJa = tagline.getAttribute('data-ja') || tagline.textContent;
  var originalEn = tagline.getAttribute('data-en') || originalJa;
  var started = false;

  function splitChars(text) {
    tagline.innerHTML = '';
    var chars = Array.from(text);
    var len = chars.length;
    for (var ci = 0; ci < len; ci++) {
      var span = document.createElement('span');
      span.className = 'tl-char';
      span.textContent = chars[ci] === ' ' ? '\u00a0' : chars[ci];
      // --d: 登場時差, --wd: シャイン波の時差（必須：これが無いと波にならない）
      span.style.setProperty('--d', (0.1 + ci * 0.06) + 's');
      span.style.setProperty('--wd', (ci * 0.15) + 's');
      tagline.appendChild(span);
    }
    var lastDelay = 0.1 + (len - 1) * 0.06 + 0.6;
    setTimeout(function() {
      var nodes = tagline.querySelectorAll('.tl-char');
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].classList.add('wave-active');
      }
    }, lastDelay * 1000);
  }

  function getCurrentText() {
    var lang = (document.documentElement.lang || 'ja').toLowerCase();
    return lang === 'en' ? originalEn : originalJa;
  }

  function start() {
    if (started) return;
    started = true;
    tagline.classList.add('is-ready');
    splitChars(getCurrentText());
  }

  // Phase2（カルーセル）開始イベントを待つ
  window.addEventListener('hero-phase2-start', start);

  // SKIP時も発動（skipでstartHeroAnimation→5.5s後にphase2なので実質同じ）
  // フォールバック: イベントが来なくても10秒後に強制開始
  setTimeout(function() {
    if (!started) start();
  }, 10000);

  // 言語切替時に再分割（開始後のみ）
  window.addEventListener('i18n-lang-changed', function() {
    if (!started) return;
    splitChars(getCurrentText());
  });
})();
