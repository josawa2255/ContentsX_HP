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
  });


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
  const showcaseData = {
    path: 'manga/ichinohe-home/',
    totalPages: 22
  };

  const flipbookEl = document.getElementById('flipbook');
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
    // 逆順に挿入: index 0 = 最終ページ(22), index 21 = 表紙(1)
    // → StPageFlipのLTRめくりが漫画RTLと合致する
    for (let i = showcaseData.totalPages; i >= 1; i--) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'flipbook-page';
      // 表紙(ページ1 = 最後のindex)と裏表紙(ページ22 = index 0)をハードカバーに
      if (i === 1 || i === showcaseData.totalPages) {
        pageDiv.setAttribute('data-density', 'hard');
      }
      const img = document.createElement('img');
      img.src = scSrc(i);
      img.alt = `一戸ホーム ${i}ページ`;
      img.draggable = false;
      pageDiv.appendChild(img);
      flipbookEl.appendChild(pageDiv);
    }
  }

  function initFlipbook() {
    const wrapEl = flipbookEl.parentElement;
    const availableWidth = wrapEl.clientWidth;
    const isMobile = window.innerWidth <= 768;

    // 漫画のアスペクト比 (1423:2134 ≈ 2:3)
    const ratio = 1423 / 2134;
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
    }

    // ページ要素を構築
    buildPageElements();

    pageFlip = new St.PageFlip(flipbookEl, {
      width: pageWidth,
      height: pageHeight,
      size: 'fixed',
      showCover: true,
      drawShadow: true,
      flippingTime: 700,
      usePortrait: isMobile,
      startPage: showcaseData.totalPages - 1,
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
      const total = showcaseData.totalPages;
      const isPortrait = window.innerWidth <= 768;
      const isCover = (pageIndex === 0 || pageIndex === total - 1);

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
    updateSlider(showcaseData.totalPages - 1);
    updateOverlays(showcaseData.totalPages - 1);
  }

  // 逆順indexから漫画ページ番号を算出
  function indexToMangaPage(idx) {
    return showcaseData.totalPages - idx;
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
    const mangaPage = Math.max(1, Math.min(total, Math.round(ratio * total)));
    // 漫画ページ番号 → 逆順index
    return total - mangaPage;
  }

  let sliderDragging = false;

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

  // 初期化 + リサイズ対応
  if (flipbookEl) {
    // ページ読み込み後に初期化（画像サイズの取得を待つ）
    setTimeout(initFlipbook, 100);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initFlipbook, 300);
    });
  }

});
