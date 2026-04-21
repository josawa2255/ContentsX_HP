/**
 * クライアント企業ロゴ（トップページカルーセル用）
 *
 * 各クライアントの logo パスと url を実データに置き換え。
 * - logo: '' (空) の場合は社名テキストタイルで表示
 * - url:  '' (空) の場合は <span> 扱い（リンクなし）
 *
 * 推奨ロゴ仕様: 横長 / 高さ 48px 基準 / SVG or WebP / 白or透過背景
 * 配置先例: /material/images/clients/{slug}.webp
 */
const CLIENT_LOGOS = [
  { name: '一戸ホーム',           url: 'https://www.ichinohe-home.co.jp/',  logo: '' },
  { name: 'ASOBI SYSTEM',        url: 'https://asobisystem.com/',           logo: '' },
  { name: 'BMS運送',              url: '',                                   logo: '' },
  { name: 'DIAMOND',             url: '',                                   logo: '' },
  { name: 'FRESH CAREER',        url: '',                                   logo: '' },
  { name: 'マクニカ',             url: 'https://www.macnica.co.jp/',         logo: '' },
  { name: 'ライフエンターテイメント', url: '',                                   logo: '' },
  { name: '瀬古恭介',             url: '',                                   logo: '' }
];
