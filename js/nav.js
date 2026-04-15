/**
 * 共通ナビゲーション + 言語切替
 * 全ページでこのファイルを読み込むだけでメニュー＆JP/EN切替が統一される。
 * メニュー変更時はここだけ編集すればOK。
 */
(function() {
  // ===== メニュー定義（ここだけ変えれば全ページ反映） =====
  var NAV_ITEMS = [
    { label: 'ホーム', labelEn: 'Home', href: './', indexHref: '#hero',
      children: [
        { label: 'ニュース',        labelEn: 'News',          href: '#news' },
        { label: '新作情報',         labelEn: 'Latest Works',  href: '#new-works' },
        { label: 'サービス',         labelEn: 'Services',      href: '#about' },
        { label: '漫画制作フロー',    labelEn: 'Workflow',      href: '#flow' }
      ]
    },
    { label: '企業',   labelEn: 'Corporate',      href: 'company',  indexHref: 'company',
      children: [
        { label: '私たちの思い',    labelEn: 'Our Thoughts',   href: 'our-thoughts' },
        { label: '会社概要',       labelEn: 'Company',        href: 'company' },
        { label: '主要関連会社',    labelEn: 'Partners',       href: 'partners' },
        { label: '役員紹介',       labelEn: 'Leadership',     href: 'leadership' }
      ]
    },
    { label: '採用情報',   labelEn: 'Recruit',      href: 'recruit',        indexHref: 'recruit' },
    { label: 'お問い合わせ', labelEn: 'Contact',      href: 'contact',        indexHref: 'contact', cta: true }
  ];

  // 現在のファイル名を取得
  var path = location.pathname;
  var currentFile = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'index';
  var isIndex = (currentFile === 'index' || currentFile === '' || currentFile === '/');

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
      return isIndex ? rawHref : './' + rawHref;
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
      var childActive = false;
      item.children.forEach(function(child) {
        var ca = document.createElement('a');
        var childHref = child.href;
        ca.href = resolveHref(childHref);
        ca.className = 'nav-dropdown-item';
        if (!childHref.startsWith('#') && childHref === currentFile) { ca.className += ' active'; childActive = true; }
        ca.setAttribute('data-ja', child.label);
        ca.setAttribute('data-en', child.labelEn);
        ca.textContent = currentLang === 'en' ? child.labelEn : child.label;
        sub.appendChild(ca);
      });
      if (childActive) a.className += ' active';
      wrapper.appendChild(sub);
      nav.appendChild(wrapper);
    } else {
      // 通常リンク（変更なし）
      var a = document.createElement('a');
      var rawHref = item.href;
      if (rawHref.startsWith('#')) {
        a.href = isIndex ? rawHref : './' + rawHref;
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
    // i18n.js がロード済みならそちらに委譲
    if (window.i18n && typeof window.i18n.switchLang === 'function') {
      window.i18n.switchLang(lang);
      currentLang = lang;
      return;
    }

    // fallback: i18n.js 未ロード時の従来処理
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
  // i18n.js がロード済みの場合はそちらが初期化するので二重実行を避ける
  if (currentLang === 'en') {
    if (!window.i18n) {
      switchLang('en');
    }
  }

  // ===== ハンバーガーメニュー =====
  var hamburger = document.getElementById('hamburger');
  if (hamburger) {
    /* a11y属性の初期化 */
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', 'nav');
    nav.setAttribute('aria-label', 'メインナビゲーション');

    var toggleMenu = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      var willOpen = !nav.classList.contains('open');
      nav.classList.toggle('open', willOpen);
      hamburger.classList.toggle('active', willOpen);
      hamburger.classList.toggle('is-open', willOpen); /* X化 */
      hamburger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      hamburger.setAttribute('aria-label', willOpen ? 'メニューを閉じる' : 'メニューを開く');
      document.body.classList.toggle('nav-locked', willOpen); /* スクロールロック */
      if (!willOpen) {
        nav.querySelectorAll('.nav-dropdown.is-open').forEach(function(d) {
          d.classList.remove('is-open');
          var toggle = d.querySelector('.nav-dropdown-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
      }
    };
    /* ESCキーで閉じる */
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        toggleMenu();
        hamburger.focus();
      }
    });
    hamburger.addEventListener('click', toggleMenu);
    // iOS Safari 対策: touchend でも発火
    hamburger.addEventListener('touchend', function(e) {
      toggleMenu(e);
    }, { passive: false });
    // モバイル: ドロップダウン親をタップ
    // 1回目 → サブメニュー開く、2回目 → リンク先へ遷移
    nav.querySelectorAll('.nav-dropdown-toggle').forEach(function(toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-haspopup', 'true');
      var handleDropdownTap = function(e) {
        if (!nav.classList.contains('open')) return;
        var dropdown = toggle.closest('.nav-dropdown');
        if (!dropdown.classList.contains('is-open')) {
          // 1回目: 開く
          e.preventDefault();
          e.stopPropagation();
          // 他の開いてるドロップダウンを閉じる（同時に1つだけ開く）
          nav.querySelectorAll('.nav-dropdown.is-open').forEach(function(d) {
            if (d !== dropdown) {
              d.classList.remove('is-open');
              var otherToggle = d.querySelector('.nav-dropdown-toggle');
              if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
            }
          });
          dropdown.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        }
        // 2回目（is-open状態）→ デフォルト動作で遷移
      };
      toggle.addEventListener('click', handleDropdownTap);
      // iOS Safari 対策: touchend でも発火（preventDefaultでクリック抑制）
      toggle.addEventListener('touchend', function(e) {
        if (!nav.classList.contains('open')) return;
        var dropdown = toggle.closest('.nav-dropdown');
        if (!dropdown.classList.contains('is-open')) {
          e.preventDefault();
          e.stopPropagation();
          nav.querySelectorAll('.nav-dropdown.is-open').forEach(function(d) {
            if (d !== dropdown) d.classList.remove('is-open');
          });
          dropdown.classList.add('is-open');
        }
        // is-openなら何もしない → click が自然に遷移
      }, { passive: false });
    });
    var closeMenu = function() {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.classList.remove('is-open');
      document.body.classList.remove('nav-locked');
    };
    // PC: サブメニュークリック後は一度ドロップダウンから離れるまで閉じたままにする
    var dismissDesktopDropdown = function(dropdown) {
      if (!dropdown) return;
      dropdown.classList.add('nav-dropdown-dismissed');
      var reset = function() {
        dropdown.classList.remove('nav-dropdown-dismissed');
        dropdown.removeEventListener('mouseleave', reset);
      };
      dropdown.addEventListener('mouseleave', reset);
    };
    // サブメニュー項目クリックでメニュー閉じる
    nav.querySelectorAll('.nav-dropdown-item').forEach(function(link) {
      link.addEventListener('click', function() {
        closeMenu();
        /* PCホバードロップダウンの強制閉じ */
        if (window.innerWidth > 768) {
          dismissDesktopDropdown(link.closest('.nav-dropdown'));
        }
      });
    });
    // 通常リンククリックでメニュー閉じる
    nav.querySelectorAll('.nav-link:not(.nav-dropdown-toggle)').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
  }

  // グローバルに switchLang を公開（他スクリプトからも呼べるように）
  window.switchLang = switchLang;
})();
