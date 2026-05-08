/**
 * ContentsX コラム一覧ページ
 * - cx-column-data (JSON) からカテゴリチップ・Featured を生成
 * - チップクリックでカード絞り込み
 */
(function () {
  var dataEl = document.getElementById('cx-column-data');
  if (!dataEl) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }

  var lang = (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'ja';

  // ===== Featured =====
  if (data.featured && data.featured.slug) {
    var f = data.featured;
    var sec = document.getElementById('cxColumnFeatured');
    var card = document.getElementById('cxColumnFeaturedCard');
    var img = document.getElementById('cxColumnFeaturedImg');
    var dateEl = document.getElementById('cxColumnFeaturedDate');
    var catEl = document.getElementById('cxColumnFeaturedCat');
    var titleEl = document.getElementById('cxColumnFeaturedTitle');
    var excerptEl = document.getElementById('cxColumnFeaturedExcerpt');
    if (sec && card) {
      card.href = '/column/' + f.slug;
      if (img) {
        img.src = f.thumbnail || '';
        img.alt = f.title || '';
      }
      if (dateEl) dateEl.textContent = (f.date || '').replace(/-/g, '.');
      if (catEl) catEl.textContent = f.category || '';
      if (titleEl) titleEl.textContent = f.title || '';
      if (excerptEl) excerptEl.textContent = f.excerpt || '';
      sec.style.display = '';
    }
  }

  // ===== カテゴリチップ =====
  var filterList = document.getElementById('cxColumnFilter');
  if (filterList && Array.isArray(data.categories)) {
    data.categories.forEach(function (cat) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'cx-col-filter-chip';
      btn.setAttribute('data-filter', cat.name);
      btn.textContent = cat.name + ' (' + cat.count + ')';
      li.appendChild(btn);
      filterList.appendChild(li);
    });
  }

  // ===== フィルタ動作 =====
  var grid = document.getElementById('cxColumnGrid');
  var emptyEl = document.getElementById('cxColumnEmpty');

  function applyFilter(value) {
    if (!grid) return;
    var cards = grid.querySelectorAll('.cx-col-card');
    var visible = 0;
    cards.forEach(function (card) {
      var cat = card.getAttribute('data-category') || '';
      var show = (value === 'all') || (cat === value);
      card.setAttribute('data-hidden', show ? 'false' : 'true');
      if (show) visible++;
    });
    if (emptyEl) emptyEl.classList.toggle('is-active', visible === 0);
  }

  if (filterList) {
    filterList.addEventListener('click', function (e) {
      var btn = e.target.closest('.cx-col-filter-chip');
      if (!btn) return;
      filterList.querySelectorAll('.cx-col-filter-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      applyFilter(btn.getAttribute('data-filter'));
    });
  }

  // 言語切替時の再翻訳
  document.addEventListener('i18n-lang-changed', function () {
    if (window.i18n && window.i18n.translateAll) {
      window.i18n.translateAll();
    }
  });
})();
