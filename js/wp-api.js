/* ============================================================
   WordPress API クライアント
   ============================================================
   WP_CONFIG.enabled = true の場合:
     WordPress REST API からデータを取得し、既存の
     WORKS_DETAIL_DATA / NEW_WORKS_DATA / News DOM を上書き。

   WP_CONFIG.enabled = false の場合:
     何もしない（既存の JS データファイルをそのまま使用）。

   ■ 読み込み順序（index.html の例）:
     1. js/wp-config.js
     2. js/data/works-detail.js   ← フォールバック用
     3. js/data/new-works.js      ← フォールバック用
     4. js/wp-api.js              ← このファイル（DOMContentLoaded で実行）
   ============================================================ */

(function () {
  'use strict';

  /* ── 設定チェック ── */
  if (typeof WP_CONFIG === 'undefined' || !WP_CONFIG.enabled || !WP_CONFIG.apiBase) return;

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

  /* ── 漫画事例データを上書き ── */
  async function loadWorks() {
    const data = await apiFetch('/works?site=contentsx');
    if (!data || !Array.isArray(data)) return;

    /* グローバル変数を上書き */
    if (typeof WORKS_DETAIL_DATA !== 'undefined') {
      WORKS_DETAIL_DATA.length = 0;
      data.forEach(w => WORKS_DETAIL_DATA.push(w));
    } else {
      window.WORKS_DETAIL_DATA = data;
    }
    console.log(`[WP-API] 漫画事例: ${data.length}件 loaded`);
  }

  /* ── 新作情報データを上書き ── */
  async function loadNewWorks() {
    const data = await apiFetch('/works-new?site=contentsx');
    if (!data || !Array.isArray(data)) return;

    if (typeof NEW_WORKS_DATA !== 'undefined') {
      NEW_WORKS_DATA.length = 0;
      data.forEach(w => NEW_WORKS_DATA.push(w));
    } else {
      window.NEW_WORKS_DATA = data;
    }
    console.log(`[WP-API] 新作情報: ${data.length}件 loaded`);
  }

  /* ── ニュース DOM を動的に生成 ── */
  async function loadNews() {
    const data = await apiFetch('/news?site=contentsx');
    if (!data || !Array.isArray(data)) return;

    const list = document.querySelector('.news-list');
    if (!list) return;

    const lang = document.documentElement.lang || 'ja';
    list.innerHTML = '';

    data.forEach(item => {
      const li = document.createElement('li');
      li.className = 'news-item';

      const time = document.createElement('time');
      time.className = 'news-date';
      time.textContent = item.date;

      const tag = document.createElement('span');
      tag.className = 'news-tag';
      tag.setAttribute('data-ja', item.tag_ja || '');
      tag.setAttribute('data-en', item.tag_en || item.tag_ja || '');
      tag.textContent = lang === 'en' ? (item.tag_en || item.tag_ja) : item.tag_ja;

      const hasLink = item.url || (item.has_detail && item.id);
      let titleEl;
      if (hasLink) {
        titleEl = document.createElement('a');
        titleEl.className = 'news-link';
        titleEl.href = item.url || ('news-detail.html?id=' + item.id);
      } else {
        titleEl = document.createElement('span');
        titleEl.className = 'news-link news-link--plain';
      }
      titleEl.setAttribute('data-ja', item.title_ja || '');
      titleEl.setAttribute('data-en', item.title_en || item.title_ja || '');
      titleEl.textContent = lang === 'en' ? (item.title_en || item.title_ja) : item.title_ja;

      li.appendChild(time);
      li.appendChild(tag);
      li.appendChild(titleEl);
      list.appendChild(li);
    });

    console.log(`[WP-API] ニュース: ${data.length}件 rendered`);
  }

  /* ── 初期化 ── */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await Promise.all([
        loadWorks(),
        loadNewWorks(),
        loadNews(),
      ]);

      /* Hero や新作情報の再描画が必要ならイベント発火 */
      window.dispatchEvent(new CustomEvent('wp-data-ready'));
    } catch (e) {
      console.warn('[WP-API] 初期化エラー（ローカルデータで継続）:', e);
    }
  });

})();
