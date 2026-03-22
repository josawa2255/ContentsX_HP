/**
 * 共通ナビゲーション + 言語切替
 * 全ページでこのファイルを読み込むだけでメニュー＆JP/EN切替が統一される。
 * メニュー変更時はここだけ編集すればOK。
 */
(function() {
  // ===== メニュー定義（ここだけ変えれば全ページ反映） =====
  var NAV_ITEMS = [
    { label: 'サービス',    labelEn: 'Services',     href: '#about',              indexHref: '#about' },
    { label: '実績',        labelEn: 'Works',        href: '#works',              indexHref: '#works' },
    { label: '会社概要',    labelEn: 'Company',      href: '#company',            indexHref: '#company' },
    { label: '選ばれる理由', labelEn: 'Why Us',       href: 'why-contentsx.html',  indexHref: 'why-contentsx.html' },
    { label: '伝えたい思い', labelEn: 'Our Thoughts', href: 'our-thoughts.html',   indexHref: 'our-thoughts.html' },
    { label: 'お問い合わせ', labelEn: 'Contact',      href: '#contact',            indexHref: '#contact', cta: true }
  ];

  // 現在のファイル名を取得
  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  var isIndex = (currentFile === 'index.html' || currentFile === '' || currentFile === '/');

  // ===== 言語状態の管理 =====
  var currentLang = 'ja';
  try { currentLang = localStorage.getItem('cx-lang') || 'ja'; } catch(e) {}

  // ナビ要素を取得
  var nav = document.getElementById('nav');
  if (!nav) return;

  // 既存のリンクをクリア
  nav.innerHTML = '';

  // リンク生成
  NAV_ITEMS.forEach(function(item) {
    var a = document.createElement('a');

    // hrefの解決: indexページならそのまま、他ページならindex.html付き
    var rawHref = item.href;
    if (rawHref.startsWith('#')) {
      a.href = isIndex ? rawHref : 'index.html' + rawHref;
    } else {
      a.href = rawHref;
    }

    // クラス設定
    a.className = 'nav-link';
    if (item.cta) a.className += ' nav-cta';

    // activeクラス（現在のページと一致する場合）
    if (!rawHref.startsWith('#') && rawHref === currentFile) {
      a.className += ' active';
    }

    // 言語対応: data属性にJP/EN両方持たせる
    a.setAttribute('data-ja', item.label);
    a.setAttribute('data-en', item.labelEn);
    a.textContent = currentLang === 'en' ? item.labelEn : item.label;
    nav.appendChild(a);
  });

  // ===== 言語切替ボタンの挿入 =====
  var headerRight = document.querySelector('.header-right');
  if (headerRight) {
    // 既存の言語ボタンがあれば削除（重複防止）
    var existing = headerRight.querySelector('.header-lang-switch');
    if (existing) existing.remove();

    var langSwitch = document.createElement('div');
    langSwitch.className = 'header-lang-switch';
    langSwitch.id = 'headerLangSwitch';
    langSwitch.innerHTML =
      '<button class="header-lang-btn' + (currentLang === 'ja' ? ' active' : '') + '" data-lang="ja">\u65E5\u672C\u8A9E</button>' +
      '<button class="header-lang-btn' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en">EN</button>';

    // ハンバーガーの前に挿入
    var hamburger = headerRight.querySelector('.hamburger');
    if (hamburger) {
      headerRight.insertBefore(langSwitch, hamburger);
    } else {
      headerRight.appendChild(langSwitch);
    }
  }

  // ===== 言語切替ロジック =====
  function switchLang(lang) {
    currentLang = lang;
    try { localStorage.setItem('cx-lang', lang); } catch(e) {}

    // ボタンの active 切替
    document.querySelectorAll('.header-lang-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    // data-ja / data-en を持つ全要素のテキストを切替
    document.querySelectorAll('[data-ja][data-en]').forEach(function(el) {
      el.textContent = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-ja');
    });

    // html lang 属性も更新
    document.documentElement.lang = lang;
  }

  // ボタンにイベント登録
  document.querySelectorAll('.header-lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchLang(btn.getAttribute('data-lang'));
    });
  });

  // 初回: localStorageにENが保存されていればEN表示に切替
  if (currentLang === 'en') {
    switchLang('en');
  }

  // ===== ハンバーガーメニュー =====
  var hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      nav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
    nav.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // グローバルに switchLang を公開（他スクリプトからも呼べるように）
  window.switchLang = switchLang;
})();
