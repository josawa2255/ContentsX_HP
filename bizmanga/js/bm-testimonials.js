/**
 * BizManga お客様の声 — WP APIから動的生成 + 詳細モーダル
 * - WP APIデータ到着時にカードを再構築
 * - カードクリック → 詳細モーダルを表示（WP投稿の本文を取得）
 * - フォールバック: HTMLに直書きされたカードをそのまま使用
 */
(function() {
  'use strict';

  var grid = document.getElementById('bmTestimonialsGrid');
  if (!grid) return;

  // WP API設定が有効か
  var apiEnabled = (typeof BM_WP_CONFIG !== 'undefined' && BM_WP_CONFIG.enabled);
  var API = apiEnabled ? BM_WP_CONFIG.apiBase.replace(/\/+$/, '') : '';

  // ===== カード生成 =====
  function buildTestimonialCards(data) {
    if (!data || data.length === 0) return; // フォールバック維持

    grid.innerHTML = '';
    var frag = document.createDocumentFragment();

    data.forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'bm-testimonial-card';
      if (item.id) card.dataset.testimonialId = item.id;
      card.style.cursor = 'pointer';

      var imgPosition = item.img_position || 'center';

      card.innerHTML =
        '<div class="bm-testimonial-cover">' +
          (item.thumbnail
            ? '<img src="' + item.thumbnail + '" alt="' + (item.heading || '') + '" loading="lazy" style="object-position:' + imgPosition + ';">'
            : '') +
        '</div>' +
        '<span class="bm-testimonial-tag" data-ja="' + (item.tag || '') + '" data-en="' + (item.tag || '') + '">' + (item.tag || '') + '</span>' +
        '<h3 class="bm-testimonial-title" data-ja="' + (item.heading || '') + '" data-en="' + (item.heading_en || item.heading || '') + '">' + (item.heading || '') + '</h3>' +
        '<p class="bm-testimonial-text" data-ja="' + (item.excerpt || '') + '" data-en="' + (item.excerpt_en || item.excerpt || '') + '">' + (item.excerpt || '') + '</p>';

      // クリック → 詳細モーダル
      (function(testimonialItem) {
        card.addEventListener('click', function() {
          openTestimonialDetail(testimonialItem);
        });
      })(item);

      frag.appendChild(card);
    });

    grid.appendChild(frag);

    // 言語切替が有効なら適用
    if (window.bmApplyLanguage) window.bmApplyLanguage();
  }

  // ===== 詳細モーダル =====
  var overlay = null;

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'bm-testimonial-overlay';
    overlay.innerHTML =
      '<div class="bm-testimonial-modal">' +
        '<button class="bm-testimonial-modal-close">&times;</button>' +
        '<div class="bm-testimonial-modal-cover" id="bmTestimonialModalCover"></div>' +
        '<div class="bm-testimonial-modal-body">' +
          '<span class="bm-testimonial-modal-tag" id="bmTestimonialModalTag"></span>' +
          '<h2 class="bm-testimonial-modal-title" id="bmTestimonialModalTitle"></h2>' +
          '<div class="bm-testimonial-modal-content" id="bmTestimonialModalContent">' +
            '<p class="bm-testimonial-modal-loading">読み込み中...</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 閉じるボタン
    overlay.querySelector('.bm-testimonial-modal-close').addEventListener('click', closeDetail);
    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeDetail();
    });
    // ESCで閉じる
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeDetail();
    });
  }

  function openTestimonialDetail(item) {
    createOverlay();

    var coverEl = document.getElementById('bmTestimonialModalCover');
    var tagEl = document.getElementById('bmTestimonialModalTag');
    var titleEl = document.getElementById('bmTestimonialModalTitle');
    var contentEl = document.getElementById('bmTestimonialModalContent');

    // 表紙画像
    if (item.thumbnail) {
      coverEl.innerHTML = '<img src="' + item.thumbnail + '" alt="' + (item.heading || '') + '" style="object-position:' + (item.img_position || 'center') + ';">';
      coverEl.style.display = '';
    } else {
      coverEl.innerHTML = '';
      coverEl.style.display = 'none';
    }

    tagEl.textContent = item.tag || '';
    titleEl.textContent = item.heading || '';
    contentEl.innerHTML = '<p class="bm-testimonial-modal-loading">読み込み中...</p>';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // WP APIから詳細（本文）を取得
    if (item.id && apiEnabled && window.bmApiFetch) {
      window.bmApiFetch('/testimonials/' + item.id).then(function(detail) {
        if (detail && detail.content) {
          contentEl.innerHTML = detail.content;
        } else {
          // 本文がない場合はカードの説明文を表示
          contentEl.innerHTML = '<p>' + (item.excerpt || 'コンテンツはまだ登録されていません。') + '</p>';
        }
      });
    } else {
      // API無効時はカードの説明文を表示
      contentEl.innerHTML = '<p>' + (item.excerpt || '') + '</p>';
    }
  }

  function closeDetail() {
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // ===== 既存HTMLカードにもクリックイベント付与（フォールバック用） =====
  function attachClickToExistingCards() {
    var cards = grid.querySelectorAll('.bm-testimonial-card');
    cards.forEach(function(card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var titleEl = card.querySelector('.bm-testimonial-title');
        var textEl = card.querySelector('.bm-testimonial-text');
        var tagEl = card.querySelector('.bm-testimonial-tag');
        var imgEl = card.querySelector('.bm-testimonial-cover img');
        openTestimonialDetail({
          heading: titleEl ? titleEl.textContent : '',
          excerpt: textEl ? textEl.textContent : '',
          tag: tagEl ? tagEl.textContent : '',
          thumbnail: imgEl ? imgEl.src : '',
          img_position: 'center'
        });
      });
    });
  }

  // 初期: 既存HTMLカードにクリックイベント付与
  attachClickToExistingCards();

  // WP APIデータ到着時に再構築
  window.addEventListener('bm-data-ready', function() {
    var wpData = window.BM_TESTIMONIALS_DATA;
    if (wpData && wpData.length > 0) {
      buildTestimonialCards(wpData);
    }
  });
})();
