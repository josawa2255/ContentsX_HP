document.addEventListener('DOMContentLoaded', function() {

  // ===== イントロオーバーレイアニメーション =====
  const introOverlay = document.getElementById('heroIntroOverlay');
  const introLine1 = document.getElementById('heroIntroLine1');
  const introLine2 = document.getElementById('heroIntroLine2');

  // ロゴアニメを一時停止（イントロ終了後に発火させる）
  const heroLogoMain = document.getElementById('heroLogoMain');
  if (heroLogoMain) {
    heroLogoMain.style.animationPlayState = 'paused';
    heroLogoMain.style.opacity = '0';
  }

  function startIntro() {
    // 0.3s → 1行目表示
    setTimeout(function() {
      if (introLine1) introLine1.classList.add('visible');
    }, 300);

    // 0.9s → 2行目表示
    setTimeout(function() {
      if (introLine2) introLine2.classList.add('visible');
    }, 900);

    // 2.8s → フェードアウト開始
    setTimeout(function() {
      if (introOverlay) introOverlay.classList.add('fade-out');
    }, 2800);

    // 3.6s → オーバーレイ完全除去 & ヒーローアニメーション開始
    setTimeout(function() {
      if (introOverlay) introOverlay.style.display = 'none';
      startHeroAnimation();
    }, 3600);
  }

  function startHeroAnimation() {
    // ロゴアニメーション再開
    if (heroLogoMain) {
      heroLogoMain.style.animation = 'none';
      // reflow を強制
      void heroLogoMain.offsetWidth;
      heroLogoMain.style.animation = '';
      heroLogoMain.style.animationPlayState = 'running';
    }

    // 鎖アニメーション開始（モバイルはCSS非表示のためPC専用）
    animateChain(document.querySelector('.hero-chain--turq'), {
      duration: 5500,
      delay: 0,
      fromDist: 80, toDist: -120,
      angle: -30,
      scale: 5
    });
    animateChain(document.querySelector('.hero-chain--orange'), {
      duration: 5500,
      delay: 300,
      fromDist: -80, toDist: 120,
      angle: -30,
      scale: 5
    });

    // Phase 2: 5.5秒後にカルーセルへトランジション
    setTimeout(function() {
      if (heroSection) heroSection.classList.add('hero--phase2');
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
      bizcharImgs[bizcharIdx].classList.add('active');
      if (bizcharIdx !== 0) {
        setTimeout(nextBizchar, 1200);
      }
    }
    setTimeout(nextBizchar, 1200);
  }

  // --- 鎖アニメーション (requestAnimationFrame で60fps滑らか制御) ---
  // 斜め方向: チェーンの角度に沿ってX+Y同時移動 + scale(5)
  function animateChain(el, config) {
    if (!el) return;
    const dur = config.duration;
    const delay = config.delay || 0;
    const start = performance.now() + delay;
    const angle = config.angle || 0;
    const scale = config.scale || 1;
    const angleRad = angle * Math.PI / 180;
    // 事前計算: cos/sinは固定値なのでループ外で算出
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const fromDist = config.fromDist;
    const toDist = config.toDist;
    const distRange = toDist - fromDist;
    // rotate + scale は固定なので文字列を事前構築
    const rotateScale = ` rotate(${angle}deg) scale(${scale})`;

    function smoothstep(t) {
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    }

    function opacityCurve(t) {
      if (t < 0.15) return 0.85 * smoothstep(t / 0.15);
      if (t > 0.80) return 0.85 * smoothstep((1 - t) / 0.20);
      return 0.85;
    }

    function tick(now) {
      const elapsed = now - start;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }

      const t = Math.min(elapsed / dur, 1);
      const move = 1 - Math.pow(1 - t, 2.5);

      const dist = fromDist + distRange * move;
      const xVw = dist * cosA;
      const yVw = dist * sinA;

      el.style.opacity = opacityCurve(t);
      el.style.transform = `translate(${xVw}vw, ${yVw}vw)` + rotateScale;

      if (t < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  // 鎖アニメーション・Phase 2 は startHeroAnimation() から呼び出し（イントロ終了後）

  // --- O(1) ルックアップ用マップを構築 ---
  const worksMap = (typeof WORKS_DETAIL_DATA !== 'undefined')
    ? WORKS_DETAIL_DATA.reduce((map, w) => { map[w.id] = w; return map; }, Object.create(null))
    : null;

  // --- 作品カルーセル構築 (集英社スタイル) ---
  function buildHeroCarousel() {
    if (!heroWorksBg || !worksMap) return;
    const works = WORKS_DETAIL_DATA;
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
      renderItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'hero-works-cover';
        div.dataset.workId = item.id;
        const img = document.createElement('img');
        /* WordPress画像があればそちら、なければローカルパス */
        img.src = item.thumbnail || `material/manga/${item.id}/01.webp`;
        img.alt = item.title_ja;
        img.loading = 'lazy';
        img.decoding = 'async';
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

      // 1ページ目の画像で縦長判定
      const testImg = new Image();
      const firstPageSrc = (work.gallery && work.gallery[0]) ? work.gallery[0] : `material/manga/${work.id}/01.webp`;
      testImg.src = firstPageSrc;
      testImg.onload = function() {
        const ratio = testImg.naturalWidth / testImg.naturalHeight;
        const isVertical = ratio < 0.2; // 極端に縦長 = 縦読み漫画

        if (isVertical) {
          // 縦スクロールモード
          wdCarousel.classList.add('vertical-scroll');
          // :has() フォールバック — 親にもクラス付与
          if (wdCarousel.parentElement) wdCarousel.parentElement.classList.add('has-vertical-scroll');
          wdCarousel.style.transform = '';
          buildCarouselPages(true);
          // 縦読みではドットとナビ矢印を非表示
          if (wdDots) wdDots.style.display = 'none';
          if (wdPrev) wdPrev.style.display = 'none';
          if (wdNext) wdNext.style.display = 'none';
        } else {
          // 通常カルーセルモード
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
        // メモリリーク防止: コールバック参照を解除
        testImg.onload = null;
        testImg.onerror = null;
      };
      // フォールバック: 画像読み込み失敗時は通常カルーセル
      testImg.onerror = function() {
        wdCarousel.classList.remove('vertical-scroll');
        if (wdCarousel.parentElement) wdCarousel.parentElement.classList.remove('has-vertical-scroll');
        buildCarouselPages(false);
        // メモリリーク防止
        testImg.onload = null;
        testImg.onerror = null;
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

});
