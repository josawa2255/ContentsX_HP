document.addEventListener('DOMContentLoaded', function() {

  // ===== イントロオーバーレイアニメーション =====
  const introOverlay = document.getElementById('heroIntroOverlay');
  const introLine1 = document.getElementById('heroIntroLine1');
  const introLine2 = document.getElementById('heroIntroLine2');

  // 2026-04-19: 1文字ずつ波打ちは廃止。行単位で fade-in（.visible class が制御）。
  // splitIntroLine は未使用。

  // 画像ロゴは .hero-logo-wrap--play で派手にbounce登場（2026-04-19 画像ロゴ化）
  const heroLogoWrap = document.getElementById('heroLogoWrap');

  var introTimers = [];
  var introFinished = false;

  function finishIntro() {
    if (introFinished) return;
    introFinished = true;
    introTimers.forEach(clearTimeout);
    introTimers = [];
    if (introOverlay) {
      introOverlay.classList.add('fade-out');
      setTimeout(function() {
        introOverlay.style.display = 'none';
      }, 600);
    }
    startHeroAnimation();
    // タグライン等に通知
    window.dispatchEvent(new CustomEvent('hero-intro-done'));
  }

  function startIntro() {
    // 0.3s → 1行目「埋もれていた物語に」表示
    introTimers.push(setTimeout(function() {
      if (introLine1) introLine1.classList.add('visible');
    }, 300));

    // 1.5s → 2行目「光を当てる」表示（line1 を 1.2秒読ませてから／OP尺は維持）
    introTimers.push(setTimeout(function() {
      if (introLine2) introLine2.classList.add('visible');
    }, 1500));

    // 2.8s → フェードアウト開始（OP尺維持）
    introTimers.push(setTimeout(function() {
      if (introOverlay) introOverlay.classList.add('fade-out');
    }, 2800));

    // 3.6s → オーバーレイ完全除去 & ヒーローアニメーション開始（OP尺維持）
    introTimers.push(setTimeout(function() {
      finishIntro();
    }, 3600));
  }

  // SKIPボタン: イントロ→Phase1→Phase2全てスキップして即カルーセル表示
  var introSkipBtn = document.getElementById('heroIntroSkip');
  if (introSkipBtn) {
    introSkipBtn.addEventListener('click', function() {
      finishIntro();
      var heroSec = document.getElementById('hero');
      if (heroSec && !heroSec.classList.contains('hero--phase2')) {
        heroSec.classList.add('hero--phase2');
        window.dispatchEvent(new CustomEvent('hero-phase2-start'));
      }
    });
  }

  function startHeroAnimation() {
    // 画像ロゴの bounce + glow 発動
    if (heroLogoWrap) {
      heroLogoWrap.classList.add('hero-logo-wrap--play');
    }

    // Phase 2: 5.5秒後にカルーセルへトランジション
    setTimeout(function() {
      if (heroSection) heroSection.classList.add('hero--phase2');
      window.dispatchEvent(new CustomEvent('hero-phase2-start'));
    }, 5500);
  }

  // モバイル(≤768px)はOPをスキップして即Phase2(カルーセル)へ
  var isMobile = window.innerWidth <= 768;
  if (isMobile) {
    if (introOverlay) introOverlay.style.display = 'none';
    finishIntro();
    // Phase1もスキップして即Phase2へ
    var heroSecEarly = document.getElementById('hero');
    if (heroSecEarly) {
      heroSecEarly.classList.add('hero--phase2');
      window.dispatchEvent(new CustomEvent('hero-phase2-start'));
    }
  } else {
    startIntro();
  }

  // ===== ヒーロー: ビズちゃんアニメーション + 作品カルーセル =====
  const heroSection = document.getElementById('hero');
  const heroBizchar = document.getElementById('heroBizchar');
  const heroWorksBg = document.getElementById('heroWorksBg');
  const bizcharImgs = heroBizchar ? heroBizchar.querySelectorAll('.hero-bizchar-img') : [];

  // --- Phase 1: ビズちゃん画像切替（intro text と同期）---
  // data-step="line1" は初期active（埋もれていた物語に=海）
  // line2 表示時(0.9s) → data-step="line2" (光を当てる=スタジオ)
  // logo 表示時(3.6s) → data-step="logo" (ContentsX=屋上)
  function activateBizcharStep(step) {
    if (!bizcharImgs.length) return;
    bizcharImgs.forEach(function(img) {
      img.classList.toggle('active', img.dataset.step === step);
    });
  }
  // line2 切替 (1.5s に合わせて)
  setTimeout(function() { activateBizcharStep('line2'); }, 1500);
  // logo 切替 (finishIntro 直前 = 3.6s)
  setTimeout(function() { activateBizcharStep('logo'); }, 3600);

  // --- 鎖アニメーション (requestAnimationFrame で60fps滑らか制御) ---

  // --- O(1) ルックアップ用マップを構築 ---
  const worksMap = (typeof WORKS_DETAIL_DATA !== 'undefined')
    ? WORKS_DETAIL_DATA.reduce((map, w) => { map[w.id] = w; return map; }, Object.create(null))
    : null;

  /* フィルタ済み作品リスト（show_hero_site + hero_order_cx） */
  function getHeroWorks() {
    return WORKS_DETAIL_DATA.filter(w => {
      if ('show_hero_site' in w) {
        return w.show_hero_site === 'both' || w.show_hero_site === 'contentsx';
      }
      return w.show_hero !== false;
    }).slice().sort((a, b) => {
      const ao = typeof a.hero_order_cx === 'number' ? a.hero_order_cx : 9999;
      const bo = typeof b.hero_order_cx === 'number' ? b.hero_order_cx : 9999;
      return ao - bo;
    });
  }

  /* 最後に描画した並び順を保持（差分検出用） */
  let lastRenderedOrder = null;

  // ===== デバイス別表示行数 =====
  // PC=3行 / タブレット=4行 / スマホ=5行（順番後ろの作品ほどスマホでだけ追加表示）
  function getActiveRowCount() {
    const w = window.innerWidth;
    if (w >= 1024) return 3;
    if (w >= 768) return 4;
    return 5;
  }

  // --- 作品カルーセル構築 (集英社スタイル) ---
  function buildHeroCarousel() {
    if (!heroWorksBg || !worksMap) return;
    const works = getHeroWorks();
    const row1 = document.getElementById('heroWorksRow1');
    const row2 = document.getElementById('heroWorksRow2');
    const row3 = document.getElementById('heroWorksRow3');
    const row4 = document.getElementById('heroWorksRow4');
    const row5 = document.getElementById('heroWorksRow5');
    if (!row1 || !row2 || !row3) return;

    const allRowEls = [row1, row2, row3, row4, row5].filter(Boolean);
    const numRows = Math.min(getActiveRowCount(), allRowEls.length);

    // 余った行は非表示
    allRowEls.forEach((el, idx) => {
      el.style.display = idx < numRows ? '' : 'none';
    });

    const rowEls = allRowEls.slice(0, numRows);
    const rows = Array.from({ length: numRows }, () => []);
    works.forEach((w, i) => rows[i % numRows].push(w));

    rowEls.forEach((rowEl, ri) => {
      const items = rows[ri];
      if (items.length === 0) return;
      rowEl.innerHTML = '';

      // DocumentFragment でバッチDOM操作
      const frag = document.createDocumentFragment();
      const renderItems = [...items, ...items, ...items, ...items];
      const itemCount = items.length;
      renderItems.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'hero-works-cover';
        div.dataset.workId = item.id;
        const img = document.createElement('img');
        /* WordPress画像があればそちら、なければローカルパス */
        img.src = item.thumbnail || `material/manga/${item.id}/01.webp`;
        img.alt = item.title_ja;
        /* CLS対策: width/height 明示（CSS で比率維持、object-fit: cover） */
        img.width = 200;
        img.height = 280;
        /* 最初の1セットだけeager、複製分はlazyで帯域節約 */
        const isFirstSet = idx < itemCount;
        img.loading = isFirstSet ? 'eager' : 'lazy';
        if (isFirstSet) img.fetchPriority = 'high';
        img.decoding = 'async';
        /* 縦長Webtoon画像は上部を表示（中央だと意味ある内容が見えない） */
        img.style.objectPosition = 'top center';
        div.appendChild(img);
        frag.appendChild(div);

        // クリック → 制作事例モーダル（bizmanga.com/works/ 風）
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          openWorkDetail(item.id);
        });
      });
      rowEl.appendChild(frag);
    });
    lastRenderedOrder = works.map(w => w.id).join(',');
  }
  buildHeroCarousel();

  /* WordPress データ到着後:
     静的 WORKS_DETAIL_DATA は show_hero_site を持たないため初回は全作品表示。
     WP データ到着後にフィルター結果を比較し、
       - 並び順が同じ → サムネURLだけ差し替え（高速パス、DOM再構築なし）
       - 並び順が変わる → 再構築
     という二段構えで最小コストで整合させる。 */
  window.addEventListener('wp-data-ready', function() {
    if (typeof WORKS_DETAIL_DATA !== 'undefined') {
      Object.keys(worksMap || {}).forEach(k => delete worksMap[k]);
      WORKS_DETAIL_DATA.forEach(w => { if (worksMap) worksMap[w.id] = w; });
    }
    const nextWorks = getHeroWorks();
    const nextOrder = nextWorks.map(w => w.id).join(',');
    if (nextOrder === lastRenderedOrder && heroWorksBg) {
      heroWorksBg.querySelectorAll('.hero-works-cover').forEach(div => {
        const work = worksMap && worksMap[div.dataset.workId];
        if (work && work.thumbnail) {
          const img = div.querySelector('img');
          if (img && img.src !== work.thumbnail) img.src = work.thumbnail;
        }
      });
    } else {
      buildHeroCarousel();
    }
  });

  // ブレークポイントを跨ぐリサイズで再振り分け（debounce）
  let lastRowCount = getActiveRowCount();
  let resizeTimer = null;
  window.addEventListener('resize', function() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      const current = getActiveRowCount();
      if (current !== lastRowCount) {
        lastRowCount = current;
        lastRenderedOrder = null; // 再構築強制
        buildHeroCarousel();
      }
    }, 200);
  });

  // ===== 制作事例モーダル (BizMangaスタイル) =====
  const wdOverlay = document.getElementById('workDetailOverlay');
  const wdClose = document.getElementById('workDetailClose');
  const wdCarousel = document.getElementById('workDetailCarousel');
  const wdDots = document.getElementById('workDetailDots');
  const wdPrev = document.getElementById('workDetailPrev');
  const wdNext = document.getElementById('workDetailNext');
  const wdTitle = document.getElementById('workDetailTitle');
  const wdCategory = document.getElementById('workDetailCategory');
  const wdMedia = document.getElementById('workDetailMedia');
  const wdSpec = document.getElementById('workDetailSpec');
  const wdPoint = document.getElementById('workDetailPoint');
  const wdComment = document.getElementById('workDetailComment');

  let wdCurrentPage = 0;
  let wdTotalPages = 0;

  function openWorkDetail(workId) {
    if (!wdOverlay || !worksMap) return;
    // O(1) ルックアップ（旧: .find() O(n)）
    const work = worksMap[workId];
    if (!work) return;

    if (wdTitle) wdTitle.textContent = work.title_ja;
    if (wdCategory) wdCategory.textContent = work.category;
    if (wdMedia) wdMedia.innerHTML = work.media.map(m => `<li>${m}</li>`).join('');
    if (wdSpec) wdSpec.innerHTML = `<li>制作仕様：ページ数${work.spec.pages}</li><li>納期：${work.spec.period}</li>`;
    if (wdPoint) wdPoint.textContent = work.point;
    if (wdComment) wdComment.textContent = work.comment;

    const previewPages = Math.min(work.pages, 5);
    wdTotalPages = previewPages;
    wdCurrentPage = 0;

    if (wdCarousel) {
      wdCarousel.innerHTML = '';
      wdCarousel.style.transform = 'translateX(0)';

      // DocumentFragment でバッチDOM操作
      function buildCarouselPages(isVertical) {
        const frag = document.createDocumentFragment();
        const hasGallery = work.gallery && work.gallery.length > 0;
        for (let i = 1; i <= previewPages; i++) {
          const img = document.createElement('img');
          /* WordPress ギャラリーがあればそちら、なければローカルパス */
          if (hasGallery && work.gallery[i - 1]) {
            img.src = work.gallery[i - 1];
          } else {
            img.src = `material/manga/${work.id}/${String(i).padStart(2, '0')}.webp`;
          }
          img.alt = `${work.title_ja} ${i}ページ`;
          frag.appendChild(img);
        }
        wdCarousel.appendChild(frag);
      }

      // 縦読み判定: 1ページ目 or 2ページ目が縦長なら縦スクロール
      const isVerticalRatio = (r) => r < 0.85;
      function applyVertical() {
        wdCarousel.classList.add('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.add('has-vertical-scroll');
        wdCarousel.style.transform = '';
        buildCarouselPages(true);
        if (wdDots) wdDots.style.display = 'none';
        if (wdPrev) wdPrev.style.display = 'none';
        if (wdNext) wdNext.style.display = 'none';
      }
      function applyCarousel() {
        wdCarousel.classList.remove('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.remove('has-vertical-scroll');
        buildCarouselPages(false);
        if (wdDots) {
          wdDots.style.display = 'flex';
          wdDots.innerHTML = '';
          const dotFrag = document.createDocumentFragment();
          for (let i = 0; i < previewPages; i++) {
            const dot = document.createElement('div');
            dot.className = 'work-detail-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => goToWdPage(i));
            dotFrag.appendChild(dot);
          }
          wdDots.appendChild(dotFrag);
        }
        if (wdPrev) wdPrev.style.display = '';
        if (wdNext) wdNext.style.display = '';
      }

      // 即座にカルーセルモードで仮表示（体感速度向上）
      applyCarousel();

      // 1ページ目 or 2ページ目で縦読み判定（表紙が横長でも本編が縦長なら縦読み）
      const hasGal = work.gallery && work.gallery.length > 0;
      const firstSrc = (hasGal && work.gallery[0]) ? work.gallery[0] : `material/manga/${work.id}/01.webp`;
      const secondSrc = (hasGal && work.gallery[1]) ? work.gallery[1] : `material/manga/${work.id}/02.webp`;

      const testImg = new Image();
      testImg.src = firstSrc;
      testImg.onload = () => {
        if (isVerticalRatio(testImg.naturalWidth / testImg.naturalHeight)) {
          applyVertical();
        } else if (work.pages > 1) {
          const testImg2 = new Image();
          testImg2.src = secondSrc;
          testImg2.onload = () => {
            if (isVerticalRatio(testImg2.naturalWidth / testImg2.naturalHeight)) {
              applyVertical();
            }
          };
        }
      };
    }

    wdOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function goToWdPage(idx) {
    wdCurrentPage = idx;
    if (wdCarousel) wdCarousel.style.transform = `translateX(-${idx * 100}%)`;
    if (wdDots) {
      wdDots.querySelectorAll('.work-detail-dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    }
  }

  if (wdPrev) wdPrev.addEventListener('click', () => {
    if (wdCurrentPage > 0) goToWdPage(wdCurrentPage - 1);
  });
  if (wdNext) wdNext.addEventListener('click', () => {
    if (wdCurrentPage < wdTotalPages - 1) goToWdPage(wdCurrentPage + 1);
  });
  if (wdClose) wdClose.addEventListener('click', () => {
    wdOverlay.classList.remove('active');
    document.body.style.overflow = '';
  });
  if (wdOverlay) wdOverlay.addEventListener('click', (e) => {
    if (e.target === wdOverlay) {
      wdOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // ===== スマホ用: 横スワイプでページ切替 =====
  if (wdCarousel) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    const SWIPE_THRESHOLD = 40;
    wdCarousel.addEventListener('touchstart', (e) => {
      if (wdCarousel.classList.contains('vertical-scroll')) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
    }, { passive: true });
    wdCarousel.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
    wdCarousel.addEventListener('touchend', (e) => {
      if (wdCarousel.classList.contains('vertical-scroll')) return;
      if (!touchMoved) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < -SWIPE_THRESHOLD && wdCurrentPage < wdTotalPages - 1) {
        goToWdPage(wdCurrentPage + 1);
      } else if (dx > SWIPE_THRESHOLD && wdCurrentPage > 0) {
        goToWdPage(wdCurrentPage - 1);
      }
    }, { passive: true });
  }

});
