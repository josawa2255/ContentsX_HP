/* ============================================================
   WordPress API クライアント
   ============================================================
   WP_CONFIG.enabled = true の場合:
     WordPress REST API からニュースを取得し、.news-list を描画する。
     描画が終わったら（失敗時も）wp-data-ready を発火する（/news の読み込み表示を消す合図）。

   WP_CONFIG.enabled = false の場合: 何もしない。

   ■ 読み込み順序: js/wp-config.js → js/wp-api.js（DOMContentLoaded で実行）
   2026-10-13: 旧トップ用の /works・/works-new の取得（WORKS_DETAIL_DATA / NEW_WORKS_DATA）は
   使うページが無くなったため削除。
   ============================================================ */

(function () {
  'use strict';

  /* ── 設定チェック（無効でも wp-data-ready は出す。/news の読み込み表示が残らないように） ── */
  if (typeof WP_CONFIG === 'undefined' || !WP_CONFIG.enabled || !WP_CONFIG.apiBase) {
    document.addEventListener('DOMContentLoaded', () => {
      window.dispatchEvent(new CustomEvent('wp-data-ready'));
    });
    return;
  }

  const API = WP_CONFIG.apiBase.replace(/\/+$/, '');
  const TIMEOUT = WP_CONFIG.timeout || 5000;
  const CACHE_TTL = WP_CONFIG.cacheTTL || 300000;
  const cache = {};

  /* ── フェッチ with タイムアウト + キャッシュ ── */
  async function apiFetch(endpoint) {
    const url = `${API}${endpoint}`;
    const now = Date.now();

    if (cache[url] && (now - cache[url].ts) < CACHE_TTL) {
      return cache[url].data;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache[url] = { data, ts: now };
      return data;
    } catch (e) {
      clearTimeout(timer);
      console.warn(`[WP-API] ${url} failed:`, e.message);
      return null;
    }
  }

  /* ── ニュース DOM を動的に生成 ── */
  const NEWS_HOME_LIMIT = 4;

  /* 管理画面で決めたクロップ範囲の中心（%）。トップ用の *_top を優先 */
  function cropCenter(item) {
    const w = parseFloat(item.image_crop_w_top || item.image_crop_w) || 100;
    const h = parseFloat(item.image_crop_h_top || item.image_crop_h) || 100;
    const x = parseFloat(item.image_crop_x_top || item.image_crop_x) || 0;
    const y = parseFloat(item.image_crop_y_top || item.image_crop_y) || 0;
    const clamp = v => Math.max(0, Math.min(100, v)).toFixed(2) + '%';
    return clamp(x + w / 2) + ' ' + clamp(y + h / 2);
  }

  async function loadNews() {
    const data = await apiFetch('/news?site=contentsx&per_page=50');
    if (!data || !Array.isArray(data)) return;

    window.CX_NEWS_DATA = data;

    const list = document.querySelector('.news-list');
    if (!list) return;

    const lang = document.documentElement.lang || 'ja';

    /* ホームでは最大5件表示 */
    const isHome = !document.body.hasAttribute('data-page-news');
    const displayData = isHome ? data.slice(0, NEWS_HOME_LIMIT) : data;

    const FALLBACK_THUMB = 'https://contentsx.jp/material/images/og/og-index.webp';

    /* トップ（2026-10-07 Issue #85）: 行全体を1つのリンクにした簡素な一覧。
       サムネイル / カテゴリ / 日付 / タイトル / 矢印。/news ページは下の従来の描画のまま。 */
    if (isHome) {
      const rows = [];
      displayData.forEach(item => {
        // 外部URLは http(s) か / 始まりのサイト内パスだけ通す（javascript: 等は詳細ページへ）
        const safeUrl = /^(https?:\/\/|\/(?!\/))/i.test(item.url || '') ? item.url : '';
        const hasLink = safeUrl || (item.has_detail && item.id);
        const li = document.createElement('li');
        li.className = 'cxnw-item';
        const row = document.createElement(hasLink ? 'a' : 'div');
        row.className = 'cxnw-row';
        if (hasLink) row.href = safeUrl || ('/news-detail?id=' + encodeURIComponent(item.id));

        const thumb = document.createElement('span');
        thumb.className = 'cxnw-thumb';
        const img = document.createElement('img');
        img.src = item.thumbnail || FALLBACK_THUMB;
        img.alt = '';
        img.width = 160; img.height = 100;
        img.loading = 'lazy'; img.decoding = 'async';
        const mode = item.image_mode_top || item.image_mode || 'contain';
        if (mode === 'crop' && item.thumbnail) {
          // crop: 枠を埋め、管理画面で決めたクロップ中心を枠の中央に置く
          img.style.objectFit = 'cover';
          img.style.objectPosition = cropCenter(item);
        }
        img.onerror = function () { this.onerror = null; this.src = FALLBACK_THUMB; };
        thumb.appendChild(img);
        row.appendChild(thumb);

        const tag = document.createElement('span');
        tag.className = 'cxnw-tag';
        tag.setAttribute('data-ja', item.tag_ja || '');
        tag.setAttribute('data-en', item.tag_en || item.tag_ja || '');
        tag.textContent = (lang === 'en' ? (item.tag_en || item.tag_ja) : item.tag_ja) || '';
        if (tag.textContent) row.appendChild(tag);

        const time = document.createElement('time');
        time.className = 'cxnw-date';
        time.textContent = item.date || '';
        if (/^\d{4}\.\d{2}\.\d{2}$/.test(item.date || '')) time.dateTime = item.date.replace(/\./g, '-');
        row.appendChild(time);

        const title = document.createElement('span');
        title.className = 'cxnw-title';
        title.setAttribute('data-ja', item.title_ja || '');
        title.setAttribute('data-en', item.title_en || item.title_ja || '');
        title.textContent = lang === 'en' ? (item.title_en || item.title_ja) : item.title_ja;
        row.appendChild(title);

        const arrow = document.createElement('span');
        arrow.className = 'cxnw-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        row.appendChild(arrow);

        li.appendChild(row);
        rows.push(li);
      });
      if (rows.length) {
        while (list.firstChild) list.removeChild(list.firstChild);
        rows.forEach(li => list.appendChild(li));
      }
      console.log(`[WP-API] ニュース(トップ): ${rows.length}/${data.length}件 rendered`);
      return;
    }

    while (list.firstChild) list.removeChild(list.firstChild);

    displayData.forEach(item => {
      const li = document.createElement('li');
      li.className = 'news-item';

      const hasLink = item.url || (item.has_detail && item.id);
      const linkUrl = hasLink ? (item.url || ('news-detail.html?id=' + item.id)) : '';

      /* サムネイル（左） */
      let thumbWrap;
      if (hasLink) {
        thumbWrap = document.createElement('a');
        thumbWrap.href = linkUrl;
      } else {
        thumbWrap = document.createElement('div');
      }
      thumbWrap.className = 'news-thumb';
      const src = item.thumbnail || FALLBACK_THUMB;
      const mode = item.image_mode_top || item.image_mode || 'contain';
      if (mode === 'crop' && item.thumbnail) {
        // crop: 親枠 (aspect-ratio:5/3) を cover で埋め、クロップ中心を背景中央に置く
        const cropEl = document.createElement('div');
        cropEl.className = 'news-thumb-crop';
        cropEl.setAttribute('role', 'img');
        cropEl.setAttribute('aria-label', item.title_ja || '');
        cropEl.style.backgroundImage = 'url(' + src + ')';
        cropEl.style.backgroundPosition = cropCenter(item);
        thumbWrap.appendChild(cropEl);
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = item.title_ja || '';
        img.loading = 'lazy';
        img.width = 200; img.height = 120;
        // 旧データ後方互換
        if (!item.image_mode_top && !item.image_mode && item.image_fit)      img.style.objectFit      = item.image_fit;
        if (!item.image_mode_top && !item.image_mode && item.image_position) img.style.objectPosition = item.image_position;
        img.onerror = function() { this.src = FALLBACK_THUMB; };
        thumbWrap.appendChild(img);
      }
      li.appendChild(thumbWrap);

      /* 右側: メタ + タイトル */
      const body = document.createElement('div');
      body.className = 'news-body';

      const meta = document.createElement('div');
      meta.className = 'news-meta';
      const tagText = lang === 'en' ? (item.tag_en || item.tag_ja) : item.tag_ja;
      if (tagText) {
        const tag = document.createElement('span');
        tag.className = 'news-tag';
        tag.setAttribute('data-ja', item.tag_ja || '');
        tag.setAttribute('data-en', item.tag_en || item.tag_ja || '');
        tag.textContent = tagText;
        meta.appendChild(tag);
      }
      const time = document.createElement('time');
      time.className = 'news-date';
      time.textContent = item.date;
      meta.appendChild(time);
      body.appendChild(meta);

      let titleEl;
      if (hasLink) {
        titleEl = document.createElement('a');
        titleEl.className = 'news-link';
        titleEl.href = linkUrl;
      } else {
        titleEl = document.createElement('span');
        titleEl.className = 'news-link news-link--plain';
      }
      titleEl.setAttribute('data-ja', item.title_ja || '');
      titleEl.setAttribute('data-en', item.title_en || item.title_ja || '');
      titleEl.textContent = lang === 'en' ? (item.title_en || item.title_ja) : item.title_ja;

      body.appendChild(titleEl);
      li.appendChild(body);
      list.appendChild(li);
    });

    console.log(`[WP-API] ニュース: ${displayData.length}/${data.length}件 rendered`);
  }

  /* ── 初期化 ── */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadNews();
    } catch (e) {
      console.warn('[WP-API] 初期化エラー:', e);
    } finally {
      window.dispatchEvent(new CustomEvent('wp-data-ready'));
    }
  });

})();
