/* ============================================================
   WordPress API 設定
   ============================================================
   ■ 使い方
   WP_API_BASE を WordPress のインストール先に変更してください。
   例: https://cms.contentsx.jp/wp-json/contentsx/v1

   ■ フォールバック
   WordPress に接続できない場合は、ローカルの JS データファイル
   （works-detail.js / new-works.js）を自動で使います。
   ============================================================ */

const WP_CONFIG = {
  /* WordPress REST API のベースURL（末尾スラッシュなし） */
  apiBase: '',   // 例: 'https://cms.contentsx.jp/wp-json/contentsx/v1'

  /* true にすると WordPress API から取得、false ならローカルJS */
  enabled: false,

  /* API タイムアウト（ミリ秒） */
  timeout: 5000,

  /* キャッシュ有効期間（ミリ秒）— ブラウザメモリ内 */
  cacheTTL: 5 * 60 * 1000,   // 5分
};
