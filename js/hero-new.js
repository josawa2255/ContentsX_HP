document.addEventListener('DOMContentLoaded', function() {

  // ===== イントロオーバーレイアニメーション =====
  const introOverlay = document.getElementById('heroIntroOverlay');
  const introLine1 = document.getElementById('heroIntroLine1');
  const introLine2 = document.getElementById('heroIntroLine2');

  // イントロ文字を1文字ずつ spanに分割 (波打ちエフェクト用)
  function splitIntroLine(line) {
    if (!line) return;
    const text = line.getAttribute('data-ja') || line.textContent;
    line.innerHTML = '';
    const chars = Array.from(text);
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'hii-char';
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      span.style.setProperty('--i', i);
      line.appendChild(span);
    });
  }
  splitIntroLine(introLine1);
  splitIntroLine(introLine2);

  // テキストロゴの再生はCSS animation-play-state: paused + .hero-logo-text--play で制御
  const heroLogoText = document.getElementById('heroLogoText');

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
    // 0.3s → 1行目表示
    introTimers.push(setTimeout(function() {
      if (introLine1) introLine1.classList.add('visible');
    }, 300));

    // 0.9s → 2行目表示
    introTimers.push(setTimeout(function() {
      if (introLine2) introLine2.classList.add('visible');
    }, 900));

    // 2.8s → フェードアウト開始
    introTimers.push(setTimeout(function() {
      if (introOverlay) introOverlay.classList.add('fade-out');
    }, 2800));

    // 3.6s → オーバーレイ完全除去 & ヒーローアニメーション開始
    introTimers.push(setTimeout(function() {
      finishIntro();
    }, 3600));
  }

  // SKIPボタン
  var introSkipBtn = document.getElementById('heroIntroSkip');
  if (introSkipBtn) {
    introSkipBtn.addEventListener('click', finishIntro);
  }

  function startHeroAnimation() {
    // テキストロゴの pop-up エフェクト発動
    if (heroLogoText) {
      heroLogoText.classList.add('hero-logo-text--play');
    }

    // Phase 2: 5.5秒後にカルーセルへトランジション
    setTimeout(function() {
      if (heroSection) heroSection.classList.add('hero--phase2');
      window.dispatchEvent(new CustomEvent('hero-phase2-start'));
    }, 5500);
  }

  startIntro();

  // ===== ヒーロー: ビズちゃんアニメーション + 作品カルーセル =====
  const heroSection = document.getElementById('hero');
  const heroBizchar = document.getElementById('heroBizchar');
  const heroWorksBg = document.getElementById('heroWorksBg');
  const bizcharImgs = heroBizchar ? heroBizchar.querySelectorAll('.hero-bizchar-img') : [];

  // --- Phase 1: ビズちゃんクロスフェード (1.2秒ごとに切替) ---
  // 修正: setInterval → setTimeout チェーンで確実にクリーンアップ
  if (bizcharImgs.length > 1) {
    let bizcharIdx = 0;
    function nextBizchar() {
      bizcharImgs[bizcharIdx].classList.remove('active');
      bizcharIdx = (bizcharIdx + 1) % bizcharImgs.length;
      const nextImg = bizcharImgs[bizcharIdx];
      /* 遅延読込: data-src を src に昇格（LCP後に実行される） */
      if (!nextImg.src && nextImg.dataset.src) {
        nextImg.src = nextImg.dataset.src;
      }
      nextImg.classList.add('active');
      if (bizcharIdx !== 0) {
        setTimeout(nextBizchar, 1200);
      }
    }
    setTimeout(nextBizchar, 1200);
  }

  // --- 鎖アニメーション (requestAnimationFrame で60fps滑らか制御) ---

  // --- O(1) ルックアップ用マップを構築 ---
  const worksMap = (typeof WORKS_DETAIL_DATA !== 'undefined')
    ? WORKS_DETAIL_DATA.reduce((map, w) => { map[w.id] = w; return map; }, Object.create(null))
    : null;

  // --- 作品カルーセル構築 (集英社スタイル) ---
  function buildHeroCarousel() {
    if (!heroWorksBg || !worksMap) return;
    /* show_hero_site でフィルタ: 'both' or 'contentsx' → ContentsXヒーローに表示 */
    /* 後方互換: show_hero_site がない場合は旧 show_hero フラグで判定 */
    const allWorks = WORKS_DETAIL_DATA;
    const works = allWorks.filter(w => {
      if ('show_hero_site' in w) {
        return w.show_hero_site === 'both' || w.show_hero_site === 'contentsx';
      }
      return w.show_hero !== false;
    });
    const row1 = document.getElementById('heroWorksRow1');
    const row2 = document.getElementById('heroWorksRow2');
    const row3 = document.getElementById('heroWorksRow3');
    const row4 = document.getElementById('heroWorksRow4');
    const row5 = document.getElementById('heroWorksRow5');
    if (!row1 || !row2 || !row3) return;

    const rowEls = [row1, row2, row3, row4, row5].filter(Boolean);
    const numRows = rowEls.length;
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
  }
  buildHeroCarousel();

  /* WordPress データ到着後にサムネURLだけ差し替え（DOM再構築せず高速） */
  window.addEventListener('wp-data-ready', function() {
    if (typeof WORKS_DETAIL_DATA !== 'undefined') {
      Object.keys(worksMap || {}).forEach(k => delete worksMap[k]);
      WORKS_DETAIL_DATA.forEach(w => { if (worksMap) worksMap[w.id] = w; });
    }
    // 既存のimgタグのsrcをWPサムネイルに差し替え
    if (heroWorksBg) {
      heroWorksBg.querySelectorAll('.hero-works-cover').forEach(div => {
        const id = div.dataset.workId;
        const work = worksMap && worksMap[id];
        if (work && work.thumbnail) {
          const img = div.querySelector('img');
          if (img && img.src !== work.thumbnail) img.src = work.thumbnail;
        }
      });
    }
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
      const isVerticalRatio = (r) => r < 0.2;
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

      // 1ページ目で縦読み判定
      const hasGal = work.gallery && work.gallery.length > 0;
      const firstSrc = (hasGal && work.gallery[0]) ? work.gallery[0] : `material/manga/${work.id}/01.webp`;

      const testImg = new Image();
      testImg.src = firstSrc;
      testImg.onload = () => {
        if (isVerticalRatio(testImg.naturalWidth / testImg.naturalHeight)) {
          applyVertical();
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
