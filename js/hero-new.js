document.addEventListener('DOMContentLoaded', function() {

  // ===== OP（イントロオーバーレイ）廃止: 全端末で即 Phase2 カルーセルへ =====
  // 旧仕様: 0.3s line1 / 1.5s line2 / 2.8s fade-out / 3.6s finishIntro / 5.5s phase2
  // 2026-05-10 ユーザー判断によりOP撤去。HTML overlay と test_hero_op.py も削除済み。
  const introOverlay = document.getElementById('heroIntroOverlay');
  if (introOverlay) introOverlay.style.display = 'none';

  const heroLogoWrap = document.getElementById('heroLogoWrap');
  if (heroLogoWrap) heroLogoWrap.classList.add('hero-logo-wrap--play');

  // intro 完了通知だけは互換のため発火（タグライン等が listen している）
  window.dispatchEvent(new CustomEvent('hero-intro-done'));

  var heroSecEarly = document.getElementById('hero');
  if (heroSecEarly) {
    heroSecEarly.classList.add('hero--phase2');
    window.dispatchEvent(new CustomEvent('hero-phase2-start'));
  }

  // ===== ヒーロー: ビズちゃんアニメーション + 作品カルーセル =====
  const heroSection = document.getElementById('hero');
  const heroBizchar = document.getElementById('heroBizchar');
  const heroWorksBg = document.getElementById('heroWorksBg');
  const bizcharImgs = heroBizchar ? heroBizchar.querySelectorAll('.hero-bizchar-img') : [];

  // --- Phase 1 ビズちゃん画像切替は OP 廃止に伴い削除（2026-05-10） ---
  // 旧: line1=海/line2=スタジオ/logo=屋上 を 1.5s/3.6s で切り替えていた

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

      // データの mode フィールドで判定（画像ロード不要）
      if (work.mode === 'vertical') {
        applyVertical();
      }
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
