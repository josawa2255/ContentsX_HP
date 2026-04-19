# ContentsX HP (contentsx.jp) — Claude Code 引き継ぎ資料

## リポジトリ
- GitHub: `josawa2255/ContentsX_HP`
- デプロイ先: GitHub Pages → contentsx.jp
- DNS: お名前.com

## i18n（日英切替）システム

### アーキテクチャ（2層構造）
1. **JSON辞書** `i18n/en.json`（336エントリ）: テキストノード走査で日本語→英語に自動置換
2. **data属性** `data-ja` / `data-en`: HTML要素に直接付与。JSON辞書より優先

### 主要ファイル
- `js/i18n.js` — i18nエンジン本体
- `i18n/en.json` — 翻訳辞書
- `js/nav.js` — `switchLang()` は `window.i18n.switchLang()` に委譲。未ロード時はfallbackで直接走査

### 設定値
- localStorageキー: `cx-lang`
- 言語ボタンクラス: `.header-lang-btn`
- パブリックAPI: `window.i18n`（`switchLang`, `t`, `translateAll`, `addTranslations`, `getLang`, `getDict`, `translateElement`）

### スクリプト読込順序（必須）
```html
<script src="js/i18n.js" defer></script>
<script src="js/nav.js" defer></script>
```
i18n.js → nav.js の順序が必須。全10ページに適用済み。

### 特殊対応
- `data-ph-ja` / `data-ph-en`: input placeholder の翻訳（contact.html）
- `.nav-dropdown-arrow` span: 翻訳時にドロップダウン矢印を保持
- MutationObserver: ENモード中の動的DOM要素を自動翻訳
- `data-i18n-skip`: 翻訳対象外指定
- `data-i18n-html`: innerHTML翻訳（改行タグ含む場合）
- カスタムイベント `i18n-lang-changed` で他JSに言語変更を通知
- 二重実行回避: `if (!window.i18n) { switchLang('en'); }`

## ページ構成

| ページ | ファイル | 主要JS |
|--------|---------|--------|
| トップ | index.html | script.js, hero-new.js, wp-api.js, dl-modal.js |
| 会社概要 | company.html | script.js, dl-modal.js |
| 役員紹介 | leadership.html | script.js, dl-modal.js |
| 私たちの思い | our-thoughts.html | dl-modal.js |
| 主要関連会社 | partners.html | script.js, dl-modal.js |
| 採用情報 | recruit.html | recruit.js, dl-modal.js |
| お問い合わせ | contact.html | contact.js |
| ニュース一覧 | news.html | wp-config.js, wp-api.js, script.js |
| ニュース詳細 | news-detail.html | wp-config.js + インラインJS |

## bizmangaサブページ（contentsx.jp/bizmanga/）
ContentsXのnav.js/i18n.jsは使わない。BizManga独自の`bm-nav.js`を使用。
bm-i18n.jsは未追加（独立BizMangaサイトには追加済み）。

| ページ | ファイル |
|--------|---------|
| トップ | bizmanga/index.html |
| 制作事例 | bizmanga/works.html |
| ビズ書庫 | bizmanga/biz-library.html |
| 料金 | bizmanga/pricing.html |
| FAQ | bizmanga/faq.html |
| お問い合わせ | bizmanga/contact.html |

## 制作事例モーダル（index.html）
- データ: `js/data/works-detail.js`（22+作品、WORKS_DETAIL_DATA配列）
- 表示: `hero-new.js` の `openWorkDetail()` でモーダル表示
- カルーセル: 1ページ目の縦横比で縦読み(vertical-scroll)/カルーセル切替
- タイトル+カテゴリタグ: `.work-detail-title-row` でflexbox横並び（BizMangaと同仕様）

## 採用ページ（recruit.html）
- 募集職種カード選択 → セクション背景画像切替（recruit.js `switchPosBg()`）
- 「詳細を見る」→ 独立セクション `rc-detail-section` に分離済み（背景画像が透けない）
- 「応募する」→ contact.htmlへ遷移（position パラメータ付き）

## 漫画ビューア（bizmanga/js/works.js）
- 見開き(spread)/縦スクロール(vertical)/強制縦(vertical_only) の3モード
- PCデフォルト: spread、SPデフォルト: vertical
- ページ送り: `waitForImage()` で画像読み込み完了を待ってからフラグ解除

## 外部サービス
- HubSpot: Portal 48367061, Form b6da14d0-d60d-4357-89fc-0015ed32b704
- WordPress API: `https://cms.contentsx.jp/wp-json/contentsx/v1`（wp-config.js）
- DNS/ドメイン: お名前.com

## CSS設計
- メインサイト: `css/style.css`（共通）+ ページ別CSS（`hero-new.css`, `recruit.css` 等）
- bizmangaサブ: `bizmanga/css/bizmanga.css` + `bizmanga/css/works.css`

## 未完了タスク
- CORS修正: WPプラグインをcms.contentsx.jpサーバーにファイルマネージャーでアップロード必要
- bizmangaサブページへのbm-i18n.js追加（6ページ）
- git push 未実施（i18n全体、制作事例タグ横並び、採用ページ詳細セクション分離）
