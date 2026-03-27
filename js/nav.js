/**
 * 共通ナビゲーション + 言語切替
 * 全ページでこのファイルを読み込むだけでメニュー＆JP/EN切替が統一される。
 * メニュー変更時はここだけ編集すればOK。
 */
(function() {
  // ===== メニュー定義（ここだけ変えれば全ページ反映） =====
  var NAV_ITEMS = [
    { label: 'ホーム', labelEn: 'Home', href: 'index.html', indexHref: '#hero',
      children: [
        { label: '新作情報',         labelEn: 'Latest Works',  href: '#new-works' },
        { label: 'ニュース',        labelEn: 'News',          href: '#news' },
        { label: 'サービス',         labelEn: 'Services',      href: '#about' },
        { label: '漫画制作フロー',    labelEn: 'Workflow',      href: '#flow' }
      ]
    },
    { label: '企業',   labelEn: 'Corporate',      href: 'company.html',  indexHref: 'company.html',
      children: [
        { label: '私たちの思い',    labelEn: 'Our Thoughts',   href: 'our-thoughts.html' },
        { label: '会社概要',       labelEn: 'Company',        href: 'company.html' },
        { label: '主要関連会社',    labelEn: 'Partners',       href: 'partners.html' },
        { label: '役員紹介',       labelEn: 'Leadership',     href: 'leadership.html' }
      ]
    },
    { label: '強み', labelEn: 'Strengths',       href: 'why-contentsx.html',  indexHref: 'why-contentsx.html' },
    { label: '採用情報',   labelEn: 'Recruit',      href: 'recruit.html',        indexHref: 'recruit.html' },
    { label: 'お問い合わせ', labelEn: 'Contact',      href: 'contact.html',        indexHref: 'contact.html', cta: true }
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

  // href解決ヘルパー
  function resolveHref(rawHref) {
    if (rawHref.startsWith('#')) {
      return isIndex ? rawHref : 'index.html' + rawHref;
    }
    return rawHref;
  }

  // リンク生成
  NAV_ITEMS.forEach(function(item) {
    // ドロップダウン（childrenあり）
    if (item.children && item.children.length > 0) {
      var wrapper = document.createElement('div');
      wrapper.className = 'nav-dropdown';

      // 親リンク
      var a = document.createElement('a');
      var rawHref = isIndex && item.indexHref ? item.indexHref : item.href;
      a.href = resolveHref(rawHref);
      a.className = 'nav-link nav-dropdown-toggle';
      if (!rawHref.startsWith('#') && rawHref === currentFile) {
        a.className += ' active';
      }
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;

      // ▼ アイコン
      var arrow = document.createElement('span');
      arrow.className = 'nav-dropdown-arrow';
      arrow.textContent = '▾';
      a.appendChild(arrow);

      wrapper.appendChild(a);

      // サブメニュー
      var sub = document.createElement('div');
      sub.className = 'nav-dropdown-menu';
      item.children.forEach(function(child) {
        var ca = document.createElement('a');
        var childHref = child.href;
        ca.href = resolveHref(childHref);
        ca.className = 'nav-dropdown-item';
        ca.setAttribute('data-ja', child.label);
        ca.setAttribute('data-en', child.labelEn);
        ca.textContent = currentLang === 'en' ? child.labelEn : child.label;
        sub.appendChild(ca);
      });
      wrapper.appendChild(sub);
      nav.appendChild(wrapper);
    } else {
      // 通常リンク（変更なし）
      var a = document.createElement('a');
      var rawHref = item.href;
      if (rawHref.startsWith('#')) {
        a.href = isIndex ? rawHref : 'index.html' + rawHref;
      } else {
        a.href = rawHref;
      }
      a.className = 'nav-link';
      if (item.cta) a.className += ' nav-cta';
      if (!rawHref.startsWith('#') && rawHref === currentFile) {
        a.className += ' active';
      }
      a.setAttribute('data-ja', item.label);
      a.setAttribute('data-en', item.labelEn);
      a.textContent = currentLang === 'en' ? item.labelEn : item.label;
      nav.appendChild(a);
    }
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
      var newText = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-ja');
      // ドロップダウントグルの場合、矢印spanを保持
      var arrow = el.querySelector('.nav-dropdown-arrow');
      if (arrow) {
        el.firstChild.textContent = newText;
      } else {
        el.textContent = newText;
      }
    });

    // placeholder切替 (data-ph-ja / data-ph-en)
    document.querySelectorAll('[data-ph-ja][data-ph-en]').forEach(function(el) {
      el.placeholder = lang === 'en' ? el.getAttribute('data-ph-en') : el.getAttribute('data-ph-ja');
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
    nav.querySelectorAll('.nav-link, .nav-dropdown-item').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // グローバルに switchLang を公開（他スクリプトからも呼べるように）
  window.switchLang = switchLang;
})();
