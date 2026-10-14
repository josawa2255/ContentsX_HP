/* ============================================================
   WordPress API 設定
   ============================================================
   ■ 使い方
   WP_API_BASE を WordPress のインストール先に変更してください。
   例: https://cms.contentsx.jp/wp-json/contentsx/v1

   ■ フォールバック
   WordPress に接続できない場合は、各ページの HTML に書いてある初期表示のまま残します
   （TOPICS の3枚、ニュースの読み込み表示など）。
   ============================================================ */

const WP_CONFIG = {
  /* WordPress REST API のベースURL（末尾スラッシュなし） */
  apiBase: 'https://cms.contentsx.jp/wp-json/contentsx/v1',

  /* true にすると WordPress API から取得、false なら取得しない */
  enabled: true,

  /* API タイムアウト（ミリ秒） */
  timeout: 3000,

  /* キャッシュ有効期間（ミリ秒）— ブラウザメモリ内 */
  cacheTTL: 5 * 60 * 1000,   // 5分
};
