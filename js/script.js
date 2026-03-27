/* ============================================
   ContentsX HP — JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ===== テーマ切替 =====
  const themeToggle = document.getElementById('themeToggle');
  const themePanel = document.getElementById('themePanel');
  const themeBtns = document.querySelectorAll('.theme-btn');

  themeToggle.addEventListener('click', () => {
    themePanel.classList.toggle('open');
  });

  // パネル外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.theme-switcher')) {
      themePanel.classList.remove('open');
    }
  });

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.body.setAttribute('data-theme', theme);

      // active状態を更新
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // ローカルストレージに保存
      try { localStorage.setItem('cx-theme', theme); } catch(e) {}
    });
  });

  // 保存されたテーマを復元
  try {
    const saved = localStorage.getItem('cx-theme');
    if (saved) {
      document.body.setAttribute('data-theme', saved);
      themeBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.theme === saved);
      });
    }
  } catch(e) {}


  // ===== ヒーロー背景クロスフェード =====
  const heroBgReveal = document.getElementById('heroBgReveal');
  if (heroBgReveal) {
    // ページ読み込み後にクロスフェード開始
    requestAnimationFrame(() => {
      heroBgReveal.classList.add('active');
    });
  }


  // ===== JP/EN 言語切替は nav.js に統合済み =====


  // ===== フローギャラリー: CSS scroll-snap + scrollIntoView =====
  (function() {
    var gallery = document.getElementById('flowGallery');
    if (!gallery) return;

    var items = gallery.querySelectorAll('.flow-gallery-item');
    var totalItems = items.length;
    if (totalItems === 0) return;

    var flowSteps = document.querySelectorAll('.flow-step[data-step]');
    var currentIndex = 0;

    // --- STEP連動ハイライト ---
    function highlightStep(stepNum) {
      flowSteps.forEach(function(el) { el.classList.remove('flow-hover'); });
      flowSteps.forEach(function(el) {
        if (el.getAttribute('data-step') === String(stepNum)) el.classList.add('flow-hover');
      });
    }
    highlightStep(1);

    // --- 中央に表示されているアイテムを検出 ---
    function detectCenteredItem() {
      var galRect = gallery.getBoundingClientRect();
      var center = galRect.left + galRect.width / 2;
      var closest = 0;
      var minDist = Infinity;
      items.forEach(function(item, i) {
        var r = item.getBoundingClientRect();
        var d = Math.abs((r.left + r.width / 2) - center);
        if (d < minDist) { minDist = d; closest = i; }
      });
      if (closest !== currentIndex) {
        currentIndex = closest;
        highlightStep(currentIndex + 1);
      }
    }

    var scrollTimer = null;
    gallery.addEventListener('scroll', function() {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(detectCenteredItem, 80);
    }, { passive: true });

    // --- ギャラリー内だけスクロール（ページ全体は動かさない）---
    function scrollToIndex(index, smooth) {
      index = Math.max(0, Math.min(index, totalItems - 1));
      var item = items[index];
      var scrollTarget = item.offsetLeft - (gallery.offsetWidth - item.offsetWidth) / 2;
      gallery.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: smooth ? 'smooth' : 'instant'
      });
      currentIndex = index;
      highlightStep(index + 1);
    }

    // 初期位置: STEP1を中央に（load後に再実行で確実に）
    gallery.scrollLeft = 0;
    window.addEventListener('load', function() {
      scrollToIndex(0, false);
    });

    // --- 左のステップをクリック ---
    flowSteps.forEach(function(el) {
      el.addEventListener('click', function() {
        var step = parseInt(el.getAttribute('data-step'), 10);
        if (step >= 1 && step <= totalItems) {
          scrollToIndex(step - 1, true);
          resetAuto();
        }
      });
    });

    // --- ホバー連動 ---
    flowSteps.forEach(function(el) {
      el.addEventListener('mouseenter', function() { highlightStep(el.getAttribute('data-step')); });
      el.addEventListener('mouseleave', function() { highlightStep(currentIndex + 1); });
    });
    items.forEach(function(el) {
      el.addEventListener('mouseenter', function() { highlightStep(el.getAttribute('data-step')); });
      el.addEventListener('mouseleave', function() { highlightStep(currentIndex + 1); });
    });

    // --- 画像クリックで進む/戻る ---
    gallery.addEventListener('click', function(e) {
      var rect = gallery.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      if (clickX > rect.width / 2) {
        if (currentIndex < totalItems - 1) { scrollToIndex(currentIndex + 1, true); resetAuto(); }
      } else {
        if (currentIndex > 0) { scrollToIndex(currentIndex - 1, true); resetAuto(); }
      }
    });

    // --- 4秒ごとに自動スクロール ---
    var autoInterval = setInterval(function() {
      if (currentIndex < totalItems - 1) {
        scrollToIndex(currentIndex + 1, true);
      } else {
        scrollToIndex(0, true);
      }
    }, 4000);

    function resetAuto() {
      clearInterval(autoInterval);
      autoInterval = setInterval(function() {
        if (currentIndex < totalItems - 1) {
          scrollToIndex(currentIndex + 1, true);
        } else {
          scrollToIndex(0, true);
        }
      }, 4000);
    }
    gallery.addEventListener('touchstart', resetAuto, { passive: true });
    gallery.addEventListener('wheel', resetAuto, { passive: true });
    flowSteps.forEach(function(el) { el.addEventListener('click', resetAuto); });
  })();


  // ===== ナビリンク：現在セクションのアクティブ表示 =====
  const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta)');
  const sections = [];
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      const sec = document.querySelector(href);
      if (sec) sections.push({ el: sec, link: link });
    }
  });

  function updateActiveNav() {
    const scrollY = window.scrollY + 120;
    let current = null;
    sections.forEach(s => {
      if (s.el.offsetTop <= scrollY) current = s;
    });
    navLinks.forEach(l => l.classList.remove('active'));
    if (current) current.link.classList.add('active');
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();


  // ===== ハンバーガーメニュー =====
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    nav.classList.toggle('open');
    hamburger.classList.toggle('active');
  });

  // ナビリンククリックでメニューを閉じる
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
    });
  });


  // ===== ヘッダースクロールエフェクト =====
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
      header.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
  }, { passive: true });


  // ===== スクロールアニメーション =====
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  // フェードイン対象の要素にクラスを付与
  const animateElements = document.querySelectorAll(
    '.mission-card, .portfolio-item, .service-card, .strength-card, .result-card, .flow'
  );
  animateElements.forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });

  // セクションタイトルもアニメーション
  document.querySelectorAll('.section-title, .section-label').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });


  // ===== スムーススクロール（ヘッダー高さ分オフセット） =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const headerHeight = header.offsetHeight;
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
    });
  });


  // ===== 数字カウントアップアニメーション =====
  const countUpObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const nums = entry.target.querySelectorAll('.hero-stat-num, .result-num');
        nums.forEach(num => {
          if (num.dataset.counted) return;
          num.dataset.counted = 'true';

          const text = num.textContent.trim();
          // 分数や特殊文字はスキップ
          if (text.includes('/') || text === '∞') return;

          const target = parseFloat(text);
          if (isNaN(target)) return;

          const duration = 1500;
          const start = performance.now();
          const isDecimal = text.includes('.');

          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            const current = target * eased;

            // innerHTMLの子要素を保持
            const unit = num.querySelector('.result-unit, .hero-stat-unit');
            const unitText = unit ? unit.outerHTML : '';

            if (isDecimal) {
              num.innerHTML = current.toFixed(1) + unitText;
            } else {
              num.innerHTML = Math.round(current) + unitText;
            }

            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        });
        countUpObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.hero-stats').forEach(el => {
    countUpObserver.observe(el);
  });


  // ===== 漫画ショーケース — StPageFlip =====
  const mangaList = {
    'ichinohe-home': {
      path: 'material/manga/ichinohe-home/',
      totalPages: 22,
      ratio: 1423 / 2134,
      client: '一戸ホーム',
      category: '営業',
      title: '一戸ホーム',
      tags: ['#住宅', '#紹介'],
      desc: '住宅メーカーの魅力をストーリー漫画で伝える営業ツール。漫画ならではの没入感で、お客様の理解と共感を引き出します。'
    },
    'omatome-ninja': {
      path: 'material/manga/omatome-ninja/',
      totalPages: 15,
      ratio: 2204 / 3516,
      client: 'おまとめ忍者',
      category: '紹介',
      title: 'おまとめ忍者',
      tags: ['#英語版', '#サービス紹介'],
      desc: '複数の借り入れを一本化する「おまとめ忍者」のサービス紹介漫画。キャラクターを活用し、わかりやすく訴求します。'
    },
    'diamond': {
      path: 'material/manga/diamond/',
      totalPages: 11,
      ratio: 1067 / 1667,
      client: 'DIAMOND',
      category: '採用',
      title: 'DIAMOND',
      tags: ['#採用', '#企業紹介'],
      desc: '企業の魅力を漫画で伝える採用ツール。候補者の興味と理解を引き出し、応募意欲を高めます。'
    }
  };

  let currentMangaKey = 'ichinohe-home';
  let showcaseData = mangaList[currentMangaKey];

  let flipbookEl = document.getElementById('flipbook');
  const scSlider = document.getElementById('scSlider');
  const scSliderTrack = document.getElementById('scSliderTrack');
  const scSliderFill = document.getElementById('scSliderFill');
  const scSliderThumb = document.getElementById('scSliderThumb');
  const scSliderPage = document.getElementById('scSliderPage');
  const scSliderTotal = document.getElementById('scSliderTotal');

  function padNum(n) { return String(n).padStart(2, '0'); }
  function scSrc(n) { return showcaseData.path + padNum(n) + '.webp'; }

  // StPageFlip の初期化（RTL漫画対応）
  let pageFlip = null;

  function buildPageElements() {
    flipbookEl.innerHTML = '';
    const total = showcaseData.totalPages;
    const needsBlank = (total % 2 !== 0); // 奇数ページなら空白を追加

    // DocumentFragment でバッチDOM操作（リフロー最小化）
    const frag = document.createDocumentFragment();

    // 逆順に挿入: index 0 = 最終ページ, 最後のindex = 表紙(1)
    // → StPageFlipのLTRめくりが漫画RTLと合致する

    // 奇数ページ時: 先頭にthanksページを追加して偶数にする
    if (needsBlank) {
      const thanksDiv = document.createElement('div');
      thanksDiv.className = 'flipbook-page';
      thanksDiv.setAttribute('data-density', 'hard');
      const thanksImg = document.createElement('img');
      thanksImg.src = 'material/manga/thanks_v02.webp';
      thanksImg.alt = 'Thanks';
      thanksImg.draggable = false;
      thanksDiv.appendChild(thanksImg);
      frag.appendChild(thanksDiv);
    }

    for (let i = total; i >= 1; i--) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'flipbook-page';
      if (i === 1 || i === total) {
        pageDiv.setAttribute('data-density', 'hard');
      }
      const img = document.createElement('img');
      // 表紙(1)・2ページ目・裏表紙付近は即ロード、それ以外はlazy
      if (i <= 2 || i >= total - 1) {
        img.src = scSrc(i);
      } else {
        img.loading = 'lazy';
        img.src = scSrc(i);
      }
      img.alt = `${showcaseData.title} ${i}ページ`;
      img.draggable = false;
      img.decoding = 'async';
      pageDiv.appendChild(img);
      frag.appendChild(pageDiv);
    }
    flipbookEl.appendChild(frag);
  }

  function initFlipbook() {
    const wrapEl = flipbookEl.parentElement;
    let availableWidth = wrapEl.clientWidth;
    const isMobile = window.innerWidth <= 768;

    // フォールバック: 幅が取得できない場合
    if (!availableWidth || availableWidth < 100) {
      availableWidth = Math.min(window.innerWidth * 0.9, 1000);
    }

    // 漫画のアスペクト比（作品ごとに異なる）
    const ratio = showcaseData.ratio;
    let pageWidth, pageHeight;

    if (isMobile) {
      // モバイル: シングルページ表示
      pageWidth = Math.min(availableWidth - 20, 460);
      pageHeight = Math.round(pageWidth / ratio);
    } else {
      // PC: 見開き表示 — 2ページ分の幅が available に収まるように
      pageWidth = Math.min(Math.floor((availableWidth - 20) / 2), 480);
      pageHeight = Math.round(pageWidth / ratio);
    }

    // 既存インスタンスを破棄
    if (pageFlip) {
      pageFlip.destroy();
      pageFlip = null;
    }

    // destroy() が #flipbook をDOMから削除する場合があるので再作成
    if (!flipbookEl.parentElement) {
      const wrap = document.querySelector('#showcaseViewer .flipbook-wrap');
      const newEl = document.createElement('div');
      newEl.id = 'flipbook';
      wrap.insertBefore(newEl, wrap.firstChild);
      flipbookEl = newEl;
    }

    // ページ要素を構築
    buildPageElements();

    // 実際のDOM要素数（空白ページ含む）
    const domPageCount = flipbookEl.querySelectorAll('.flipbook-page').length;

    pageFlip = new St.PageFlip(flipbookEl, {
      width: pageWidth,
      height: pageHeight,
      size: 'fixed',
      showCover: true,
      drawShadow: true,
      flippingTime: 450,
      usePortrait: isMobile,
      startPage: domPageCount - 1, // 表紙（ページ1）は常に最後のindex
      maxShadowOpacity: 0.4,
      mobileScrollSupport: false,
      clickEventForward: false,
      useMouseEvents: false,
      swipeDistance: 30,
      showPageCorners: false
    });

    // HTML描画モード（CSS RTLミラーリングと併用するため）
    pageFlip.loadFromHTML(flipbookEl.querySelectorAll('.flipbook-page'));

    const spineEl = document.getElementById('flipbookSpine');
    const zoneLeft = document.getElementById('flipZoneLeft');
    const zoneRight = document.getElementById('flipZoneRight');
    const flipWrap = flipbookEl.closest('.flipbook-wrap');

    // ページめくりイベント → スライダー同期 + UI表示切替
    pageFlip.on('flip', (e) => {
      updateSlider(e.data);
      updateOverlays(e.data);
    });
    pageFlip.on('changeState', () => {
      const currentPage = pageFlip.getCurrentPageIndex();
      updateSlider(currentPage);
      updateOverlays(currentPage);
    });

    // 折り目・クリックゾーンの表示切替
    function updateOverlays(pageIndex) {
      const isPortrait = window.innerWidth <= 768;
      const isCover = (pageIndex === 0 || pageIndex === domPageCount - 1);

      // 折り目: 見開き時のみ
      if (spineEl) {
        spineEl.style.opacity = (isPortrait || isCover) ? '0' : '1';
      }
      // クリックゾーンヒント: 表紙・裏表紙では非表示
      if (flipWrap) {
        if (isCover) {
          flipWrap.classList.add('no-zones');
        } else {
          flipWrap.classList.remove('no-zones');
        }
      }
    }

    // 初期スライダー更新（表紙=最後のindex=ページ1）
    updateSlider(domPageCount - 1);
    updateOverlays(domPageCount - 1);
  }

  // 逆順indexから漫画ページ番号を算出（空白ページ分を考慮）
  function indexToMangaPage(idx) {
    const hasBlank = (showcaseData.totalPages % 2 !== 0) ? 1 : 0;
    const mangaPage = showcaseData.totalPages - (idx - hasBlank);
    return Math.max(1, Math.min(showcaseData.totalPages, mangaPage));
  }

  function updateSlider(pageIndex) {
    const total = showcaseData.totalPages;
    const mangaPage = indexToMangaPage(pageIndex);
    const pct = (mangaPage / total) * 100;

    scSliderPage.textContent = mangaPage;
    scSliderTotal.textContent = total;
    scSliderFill.style.width = pct + '%';
    scSliderThumb.style.right = pct + '%';
  }

  // ピッコマ風スライダー — クリック＆ドラッグ操作
  function sliderPageFromX(clientX) {
    const rect = scSliderTrack.getBoundingClientRect();
    // 右端=最終ページ(進む)、左端=1ページ(戻る)
    const ratio = 1 - Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const total = showcaseData.totalPages;
    const hasBlank = (total % 2 !== 0) ? 1 : 0;
    const mangaPage = Math.max(1, Math.min(total, Math.round(ratio * total)));
    // 漫画ページ番号 → 逆順index（空白ページ分オフセット）
    return (total - mangaPage) + hasBlank;
  }

  let sliderDragging = false;

  if (!scSliderTrack) {
    // 制作実績セクションが存在しない場合はスライダー処理をスキップ
  } else {
  scSliderTrack.addEventListener('mousedown', function(e) {
    if (!pageFlip) return;
    e.preventDefault();
    sliderDragging = true;
    scSlider.classList.add('dragging');
    const page = sliderPageFromX(e.clientX);
    pageFlip.turnToPage(page);
    updateSlider(page);
  });

  document.addEventListener('mousemove', function(e) {
    if (!sliderDragging) return;
    const page = sliderPageFromX(e.clientX);
    pageFlip.turnToPage(page);
    updateSlider(page);
  });

  document.addEventListener('mouseup', function() {
    if (sliderDragging) {
      sliderDragging = false;
      scSlider.classList.remove('dragging');
    }
  });

  // タッチ対応
  scSliderTrack.addEventListener('touchstart', function(e) {
    if (!pageFlip) return;
    sliderDragging = true;
    scSlider.classList.add('dragging');
    const page = sliderPageFromX(e.touches[0].clientX);
    pageFlip.turnToPage(page);
    updateSlider(page);
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!sliderDragging) return;
    const page = sliderPageFromX(e.touches[0].clientX);
    pageFlip.turnToPage(page);
    updateSlider(page);
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (sliderDragging) {
      sliderDragging = false;
      scSlider.classList.remove('dragging');
    }
  });
  } // end scSliderTrack null check

  // 漫画ビューアの左側クリック=次ページ、右側クリック=前ページ
  // ※ページ配列が逆順なのでflipPrev=読み進める、flipNext=戻る
  const showcaseViewer = document.getElementById('showcaseViewer');
  if (showcaseViewer) {
    showcaseViewer.addEventListener('click', (e) => {
      if (e.target.closest('.sc-slider')) return;
      if (!pageFlip) return;

      // ビューア内のクリック位置で左右を判定
      const rect = showcaseViewer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const half = rect.width / 2;

      if (clickX < half) {
        // 左側クリック → 次ページ（左ページを右にめくる）
        pageFlip.flipPrev();
      } else {
        // 右側クリック → 前ページ（右ページを左にめくる）
        pageFlip.flipNext();
      }
    });
  }

  // ===== 漫画切り替え =====
  function switchManga(key) {
    if (!mangaList[key] || key === currentMangaKey) return;
    currentMangaKey = key;
    showcaseData = mangaList[key];

    // UI情報を更新
    const brandClient = document.getElementById('brandClient');
    const scCategory = document.getElementById('scCategory');
    const scTitle = document.getElementById('scTitle');
    const scTags = document.getElementById('scTags');
    const scDesc = document.getElementById('scDesc');
    const scPageCount = document.getElementById('scPageCount');

    if (brandClient) brandClient.textContent = showcaseData.client;
    if (scCategory) scCategory.textContent = showcaseData.category;
    if (scTitle) scTitle.textContent = showcaseData.title;
    if (scTags) {
      scTags.innerHTML = showcaseData.tags.map(t => `<span class="showcase-tag">${t}</span>`).join('');
    }
    if (scDesc) scDesc.textContent = showcaseData.desc;
    if (scPageCount) scPageCount.textContent = `全${showcaseData.totalPages}ページ`;

    // スライダー total テキスト更新
    if (scSliderTotal) scSliderTotal.textContent = showcaseData.totalPages;

    // ビューアを再初期化
    if (flipbookEl) initFlipbook();
  }

  // セレクターボタンのイベント
  const mangaSelector = document.getElementById('mangaSelector');
  if (mangaSelector) {
    mangaSelector.querySelectorAll('.manga-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mangaSelector.querySelectorAll('.manga-sel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchManga(btn.dataset.manga);
      });
    });
  }

  // 初期化 + リサイズ対応
  if (flipbookEl) {
    // レイアウト確定後に即初期化
    requestAnimationFrame(() => { requestAnimationFrame(initFlipbook); });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initFlipbook, 300);
    });
  }

  // アスペクト比キャッシュ（同じ漫画を再度開くとき即座に表示）
  const ratioCache = {};

  // ===== 新作情報 横スクロール =====
  // ===== 新作情報: JSONから動的生成 + 10件キュー =====
  const MAX_NEW_WORKS = 10;
  const worksTrack = document.getElementById('newWorksTrack');
  const prevBtn = document.getElementById('worksArrowPrev');
  const nextBtn = document.getElementById('worksArrowNext');

  function buildNewWorksCards(data) {
    if (!worksTrack) return;
    // 新しい順にソート（added降順）→ 最大10件
    const sorted = data
      .sort((a, b) => new Date(b.added) - new Date(a.added))
      .slice(0, MAX_NEW_WORKS);

    worksTrack.innerHTML = '';
    // DocumentFragment でバッチDOM操作
    const frag = document.createDocumentFragment();
    sorted.forEach(item => {
      const card = document.createElement('div');
      card.className = 'new-works-card';
      card.dataset.manga = item.id;
      card.dataset.pages = item.pages;
      card.innerHTML = `
        <div class="new-works-card-cover">
          <img src="material/manga/${item.id}/01.webp" alt="${item.title_ja}" loading="lazy">
        </div>
        <p class="new-works-card-title" data-ja="${item.title_ja}" data-en="${item.title_en}">${item.title_ja}</p>
      `;
      // カードクリック → ビューア起動
      card.addEventListener('click', () => {
        openMangaViewer(item.id, item.pages, item.title_ja);
      });
      frag.appendChild(card);
      // アスペクト比を先にキャッシュ（クリック時の待ちを排除）
      preloadCover(item.id);
    });
    worksTrack.appendChild(frag);
  }

  // データからカード生成（data/new-works.js のグローバル変数を使用）
  if (typeof NEW_WORKS_DATA !== 'undefined') {
    buildNewWorksCards(NEW_WORKS_DATA);
  } else {
    // フォールバック: サーバー環境ではfetchも試行
    fetch('data/new-works.json')
      .then(res => res.json())
      .then(data => buildNewWorksCards(data))
      .catch(err => console.warn('new-works data not available:', err));
  }

  if (prevBtn && nextBtn) {
    const scrollAmount = 224;
    nextBtn.addEventListener('click', () => {
      worksTrack.parentElement.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
    prevBtn.addEventListener('click', () => {
      worksTrack.parentElement.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
  }

  // ドラッグスクロール（ボタン有無に関係なく動作）
  if (worksTrack) {
    let isDragging = false;
    let startX, scrollLeft;
    const wrapper = worksTrack.parentElement;
    wrapper.style.overflowX = 'auto';
    wrapper.style.scrollbarWidth = 'none';
    wrapper.style.msOverflowStyle = 'none';

    wrapper.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.pageX - wrapper.offsetLeft;
      scrollLeft = wrapper.scrollLeft;
    });
    wrapper.addEventListener('mouseleave', () => isDragging = false);
    wrapper.addEventListener('mouseup', () => isDragging = false);
    wrapper.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - wrapper.offsetLeft;
      wrapper.scrollLeft = scrollLeft - (x - startX);
    });
  }

  // ===== 漫画ビューア（PC: フリップブック / スマホ・縦長: 縦スクロール） =====
  const mvOverlay = document.getElementById('mangaViewerOverlay');
  const mvClose = document.getElementById('mangaViewerClose');
  const mvFlipMode = document.getElementById('mangaViewerFlipMode');
  const mvScrollMode = document.getElementById('mangaViewerScrollMode');
  const mvScrollInner = document.getElementById('mangaViewerScrollInner');
  const mvFlipbookEl = document.getElementById('mangaViewerFlipbook');
  const mvTitle = document.getElementById('mvTitle');
  const mvSpine = document.getElementById('mvSpine');
  const mvSliderTrack = document.getElementById('mvSliderTrack');
  const mvSliderFill = document.getElementById('mvSliderFill');
  const mvSliderThumb = document.getElementById('mvSliderThumb');
  const mvSliderPage = document.getElementById('mvSliderPage');
  const mvSliderTotal = document.getElementById('mvSliderTotal');

  let mvPageFlip = null;
  let mvDomPageCount = 0;
  let mvTotalPages = 0;

  function mvPadNum(n) { return String(n).padStart(2, '0'); }

  function closeMangaViewer() {
    if (mvOverlay) mvOverlay.classList.remove('active');
    if (mvFlipMode) mvFlipMode.classList.remove('active');
    if (mvScrollMode) mvScrollMode.classList.remove('active');
    if (mvPageFlip) {
      mvPageFlip.destroy();
      mvPageFlip = null;
    }
    // destroy()がDOM要素を削除する場合があるので再作成
    let fbEl = document.getElementById('mangaViewerFlipbook');
    if (!fbEl) {
      const wrap = document.querySelector('.manga-viewer-flipbook-wrap .flipbook-wrap');
      if (wrap) {
        const newEl = document.createElement('div');
        newEl.id = 'mangaViewerFlipbook';
        wrap.insertBefore(newEl, wrap.firstChild);
      }
    } else {
      fbEl.innerHTML = '';
    }
    if (mvScrollInner) mvScrollInner.innerHTML = '';
    document.body.style.overflow = '';
  }

  // カード生成時に表紙画像をプリロードしてキャッシュ
  function preloadCover(mangaId) {
    if (ratioCache[mangaId]) return;
    const img = new Image();
    img.src = `material/manga/${mangaId}/01.webp`;
    img.onload = function() {
      ratioCache[mangaId] = img.naturalWidth / img.naturalHeight;
      // メモリリーク防止: コールバック参照を解除
      img.onload = null;
      img.onerror = null;
    };
    img.onerror = function() {
      img.onload = null;
      img.onerror = null;
    };
  }

  function openMangaViewer(mangaId, pages, title) {
    mvOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const isMobile = window.innerWidth <= 768;

    // キャッシュ済みなら即座に表示
    if (ratioCache[mangaId]) {
      const ratio = ratioCache[mangaId];
      if (isMobile || ratio < 0.55) {
        openScrollMode(mangaId, pages);
      } else {
        openFlipMode(mangaId, pages, ratio, title);
      }
      return;
    }

    // 未キャッシュ: スクロールモードを先に表示（即座）しつつ、比率取得後にフリップに切替
    if (isMobile) {
      openScrollMode(mangaId, pages);
      return;
    }

    // PC: 表紙画像の読み込みを非同期で待つが、UIは即表示
    const testImg = new Image();
    testImg.src = `material/manga/${mangaId}/01.webp`;
    testImg.onload = function() {
      const ratio = testImg.naturalWidth / testImg.naturalHeight;
      ratioCache[mangaId] = ratio;
      // メモリリーク防止
      testImg.onload = null;
      testImg.onerror = null;
      if (ratio < 0.55) {
        openScrollMode(mangaId, pages);
      } else {
        openFlipMode(mangaId, pages, ratio, title);
      }
    };
    testImg.onerror = function() {
      testImg.onload = null;
      testImg.onerror = null;
      openScrollMode(mangaId, pages);
    };
  }
  window.openMangaViewer = openMangaViewer; // グローバル公開

  // --- 縦スクロールモード ---
  function openScrollMode(mangaId, pages) {
    mvScrollMode.classList.add('active');
    mvScrollInner.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= pages; i++) {
      const img = document.createElement('img');
      img.loading = (i <= 3) ? 'eager' : 'lazy';
      img.src = `material/manga/${mangaId}/${mvPadNum(i)}.webp`;
      img.alt = `Page ${i}`;
      frag.appendChild(img);
    }
    mvScrollInner.appendChild(frag);
  }

  // --- フリップブックモード (PC) — 制作実績と同じUI ---
  function openFlipMode(mangaId, pages, ratio, title) {
    mvFlipMode.classList.add('active');
    mvTotalPages = pages;
    if (mvTitle) mvTitle.textContent = title || '';
    if (mvSliderTotal) mvSliderTotal.textContent = pages;
    if (mvSliderPage) mvSliderPage.textContent = '1';
    if (mvSliderFill) mvSliderFill.style.width = '0%';
    if (mvSliderThumb) mvSliderThumb.style.right = '0%';

    // レイアウト確定後にStPageFlipを初期化（display変更直後はclientWidthが0の場合がある）
    // ダブルRAF: 1回目でスタイル計算、2回目でレイアウト完了を保証
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      // 毎回最新のDOM要素を取得（destroy後に再作成されている場合）
      const currentFlipEl = document.getElementById('mangaViewerFlipbook');
      currentFlipEl.innerHTML = '';

      const needsBlank = (pages % 2 !== 0);
      // DocumentFragment でバッチDOM操作
      const frag = document.createDocumentFragment();

      if (needsBlank) {
        const thanksDiv = document.createElement('div');
        thanksDiv.className = 'flipbook-page';
        thanksDiv.setAttribute('data-density', 'hard');
        const thanksImg = document.createElement('img');
        thanksImg.src = 'material/manga/thanks_v02.webp';
        thanksImg.alt = 'Thanks';
        thanksImg.draggable = false;
        thanksDiv.appendChild(thanksImg);
        frag.appendChild(thanksDiv);
      }

      for (let i = pages; i >= 1; i--) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'flipbook-page';
        if (i === 1 || i === pages) pageDiv.setAttribute('data-density', 'hard');
        const img = document.createElement('img');
        // 表紙付近は即ロード、中間ページはlazy
        if (i <= 2 || i >= pages - 1) {
          img.src = `material/manga/${mangaId}/${mvPadNum(i)}.webp`;
        } else {
          img.loading = 'lazy';
          img.src = `material/manga/${mangaId}/${mvPadNum(i)}.webp`;
        }
        img.alt = `Page ${i}`;
        img.draggable = false;
        img.decoding = 'async';
        pageDiv.appendChild(img);
        frag.appendChild(pageDiv);
      }
      currentFlipEl.appendChild(frag);

      const wrapEl = currentFlipEl.closest('.manga-viewer-flipbook-wrap');
      let availW = (wrapEl ? wrapEl.clientWidth : window.innerWidth * 0.9);
      // フォールバック: レイアウト未確定で0の場合
      if (!availW || availW < 100) {
        availW = Math.min(window.innerWidth * 0.85, 1200);
      }
      let availH = window.innerHeight - 160;
      let pageWidth = Math.min(Math.floor((availW - 20) / 2), 480);
      let pageHeight = Math.round(pageWidth / ratio);
      if (pageHeight > availH) {
        pageHeight = availH;
        pageWidth = Math.round(pageHeight * ratio);
      }

      mvDomPageCount = currentFlipEl.querySelectorAll('.flipbook-page').length;

      mvPageFlip = new St.PageFlip(currentFlipEl, {
        width: pageWidth,
        height: pageHeight,
        size: 'fixed',
        showCover: true,
        drawShadow: true,
        flippingTime: 450,
        usePortrait: false,
        startPage: mvDomPageCount - 1,
        maxShadowOpacity: 0.4,
        mobileScrollSupport: false,
        clickEventForward: false,
        useMouseEvents: false,
        swipeDistance: 30,
        showPageCorners: false
      });

      mvPageFlip.loadFromHTML(currentFlipEl.querySelectorAll('.flipbook-page'));

      // 外側ガイドのアニメーションをリセット再生
      const guideL = document.getElementById('mvGuideLeft');
      const guideR = document.getElementById('mvGuideRight');
      [guideL, guideR].forEach(g => {
        if (g) { g.style.animation = 'none'; void g.offsetWidth; g.style.animation = ''; }
      });

      // 逆順indexから漫画ページ番号を算出（制作実績と同じロジック）
      const mvHasBlank = (mvTotalPages % 2 !== 0) ? 1 : 0;
      function mvIndexToPage(idx) {
        const mangaPage = mvTotalPages - (idx - mvHasBlank);
        return Math.max(1, Math.min(mvTotalPages, mangaPage));
      }

      // スライダー・折り目 更新（制作実績と同じ: rightベース）
      function mvUpdateUI(pageIndex) {
        const mangaPage = mvIndexToPage(pageIndex);
        const pct = (mangaPage / mvTotalPages) * 100;
        if (mvSliderPage) mvSliderPage.textContent = mangaPage;
        if (mvSliderTotal) mvSliderTotal.textContent = mvTotalPages;
        if (mvSliderFill) mvSliderFill.style.width = pct + '%';
        if (mvSliderThumb) mvSliderThumb.style.right = pct + '%';
        const isCover = (pageIndex === 0 || pageIndex === mvDomPageCount - 1);
        if (mvSpine) mvSpine.style.opacity = isCover ? '0' : '1';
      }

      mvPageFlip.on('flip', (e) => mvUpdateUI(e.data));
      mvPageFlip.on('changeState', () => mvUpdateUI(mvPageFlip.getCurrentPageIndex()));
      mvUpdateUI(mvDomPageCount - 1);

      // スライダークリックでジャンプ（制作実績と同じ: 右端=進む、左端=戻る）
      function mvSliderPageFromX(clientX) {
        const rect = mvSliderTrack.getBoundingClientRect();
        const r = 1 - Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const mangaPage = Math.max(1, Math.min(mvTotalPages, Math.round(r * mvTotalPages)));
        return (mvTotalPages - mangaPage) + mvHasBlank;
      }

      if (mvSliderTrack) {
        mvSliderTrack.onclick = function(e) {
          if (!mvPageFlip) return;
          const page = mvSliderPageFromX(e.clientX);
          mvPageFlip.turnToPage(page);
          mvUpdateUI(page);
        };
      }
    }); });
  }

  // クリックでページ送り（制作実績と同じ: 親要素にリスナー）
  // ※ flipbook-wrap 全体でクリックを検知
  const mvFlipWrapAll = document.querySelector('.manga-viewer-flipbook-wrap');
  if (mvFlipWrapAll) {
    mvFlipWrapAll.addEventListener('click', (e) => {
      if (e.target.closest('.mv-slider')) return;
      if (!mvPageFlip) return;

      const rect = mvFlipWrapAll.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const half = rect.width / 2;

      if (clickX < half) {
        // 左側クリック → 次ページ（読み進む）
        mvPageFlip.flipPrev();
      } else {
        // 右側クリック → 前ページ（戻る）
        mvPageFlip.flipNext();
      }
    });
  }

  if (mvClose) mvClose.addEventListener('click', closeMangaViewer);
  const mvCloseScroll = document.getElementById('mangaViewerCloseScroll');
  if (mvCloseScroll) mvCloseScroll.addEventListener('click', closeMangaViewer);
  if (mvOverlay) mvOverlay.addEventListener('click', (e) => {
    if (e.target === mvOverlay) closeMangaViewer();
  });

  // キーボード操作
  document.addEventListener('keydown', (e) => {
    if (!mvOverlay || !mvOverlay.classList.contains('active')) return;
    if (e.key === 'Escape') closeMangaViewer();
    if (mvPageFlip) {
      // 漫画RTL: ←キー=次ページ(読み進む), →キー=前ページ(戻る)
      if (e.key === 'ArrowLeft') mvPageFlip.flipPrev();
      if (e.key === 'ArrowRight') mvPageFlip.flipNext();
    }
  });

  // ===== セクションサイドナビ（ZOON風スクロールスパイ） =====
  var sectionDots = document.getElementById('sectionDots');
  if (sectionDots) {
    var dots = sectionDots.querySelectorAll('.section-dot');
    var activeLabel = document.getElementById('sectionActiveLabel');
    var navUp = document.getElementById('sectionNavUp');
    var navDown = document.getElementById('sectionNavDown');
    var sectionIds = [];
    dots.forEach(function(dot) { sectionIds.push(dot.getAttribute('data-section')); });

    var heroEl = document.getElementById('hero');
    var currentIdx = -1;

    function updateDots() {
      // ヒーロー下まで来たら表示
      if (heroEl) {
        var heroBottom = heroEl.offsetTop + heroEl.offsetHeight;
        if (window.scrollY + window.innerHeight * 0.3 > heroBottom) {
          sectionDots.classList.add('visible');
        } else {
          sectionDots.classList.remove('visible');
        }
      } else {
        sectionDots.classList.add('visible');
      }

      // 現在セクション判定
      var newIdx = -1;
      var scrollY = window.scrollY + window.innerHeight * 0.4;
      for (var i = sectionIds.length - 1; i >= 0; i--) {
        var el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollY) {
          newIdx = i;
          break;
        }
      }
      if (newIdx !== currentIdx) {
        currentIdx = newIdx;
        dots.forEach(function(dot, idx) {
          if (idx === currentIdx) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        });
        // アクティブラベル更新
        if (activeLabel && currentIdx >= 0) {
          activeLabel.textContent = dots[currentIdx].getAttribute('data-label');
        }
      }
    }

    window.addEventListener('scroll', updateDots, { passive: true });
    updateDots();

    // ドットクリック
    dots.forEach(function(dot) {
      dot.addEventListener('click', function(e) {
        e.preventDefault();
        var target = document.getElementById(dot.getAttribute('data-section'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // 上下矢印
    if (navUp) {
      navUp.addEventListener('click', function(e) {
        e.preventDefault();
        var prev = Math.max(0, currentIdx - 1);
        var target = document.getElementById(sectionIds[prev]);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    if (navDown) {
      navDown.addEventListener('click', function(e) {
        e.preventDefault();
        var next = Math.min(sectionIds.length - 1, currentIdx + 1);
        var target = document.getElementById(sectionIds[next]);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

});
