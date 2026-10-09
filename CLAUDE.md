# ContentsX HP (contentsx.jp) — Claude Code 引き継ぎ資料

## リポジトリ
- GitHub: `josawa2255/ContentsX_HP` — **PUBLIC**
- デプロイ先: GitHub Pages → contentsx.jp
- DNS: お名前.com
- Git運用・レビューとマージ許可: [github.md](github.md)（リポジトリ所有者本人の確認による例外を含む）

> ⚠️ **WPプラグイン(PHP)はこのリポジトリにありません**（2026-08-04 分離）。
> マスターは `~/Documents/contentX/web/contentsx-wp-plugin/contentsx-cms/contentsx-cms.php`
> （GitHub: **PRIVATE** `josawa2255/contentsx-wp-plugin`）。
> このリポジトリがPUBLICのため、サーバー側で動くコードは置かない方針。
> 旧 `wordpress/contentsx-cms/` は削除済み（`wordpress/SETUP.md` のみ残置）。
> **push では本番反映されない** → お名前.comで手動アップロード（BUGS #002）。

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
i18n.js → nav.js の順序が必須。トップを含む全ページで共通ヘッダーに適用済み。

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
| トップ | index.html | i18n.js, nav.js, wp-api.js, home-2026.js, hero-about.js, home-section-labels.js, cx-manga-reader.js, cx-video-player.js, home-creative-x.js, home-topics.js（共通ヘッダーを使用。Creative X はWPのビューワー動画・マンガ作品をページ内のビューワーで表示、TOPICS はWP「Contents X ＞ TOPICS」から描画。仕様は SPEC.md §3） |
| サービス一覧・事業群・個別詳細 | services/ | i18n.js, nav.js, services-ui.js, service-media.js, sitewide-motion.js（`tools/build-services.py` で生成。仕様は SPEC.md §3） |
| 会社概要 | company.html | script.js, dl-modal.js |
| ContentsXについて | about.html | i18n.js, nav.js, sitewide-motion.js |
| 代表メッセージ | message.html | i18n.js, nav.js（`/message`。全文、支給画像、関連導線。SPEC.md §14） |
| 役員紹介（非表示） | leadership.html | `/about#message` へ転送 |
| 関連会社（非表示） | partners.html | `/company` へ転送 |
| 私たちの思い（旧URL） | our-thoughts.html | `/about#message` へ転送 |
| 採用情報 | recruit.html | recruit.js, dl-modal.js |
| お問い合わせ | contact.html | contact.js |
| ニュース一覧 | news.html | wp-config.js, wp-api.js, script.js |
| ニュース詳細 | news-detail.html | wp-config.js + インラインJS |

企業案内で非表示にした導線、復帰手順、画像素材の扱いは [CORPORATE-PAGE-VISIBILITY.md](CORPORATE-PAGE-VISIBILITY.md) を参照。**コラム（`/column`）も 2026-09-29 から共通ナビの導線だけ一時非表示**（ページ・検索掲載は公開のまま。戻し方も同ファイル）。

## bizmangaサブページ（contentsx.jp/bizmanga/）
**現在は301リダイレクトのみ**。2026-04-27にBizMangaサイトが独立ドメイン `bizmanga.contentsx.jp` へ完全移行。
旧URLのブックマーク・外部リンクを拾うため、最小限のリダイレクトHTMLだけを残してある。

- HTML 6本 + robots.txt + sitemap.xml （計8ファイル、各約1KB）
- `<meta http-equiv="refresh">` + `window.location.replace()` で即時転送
- `noindex, follow` + canonical で SEO処理済み
- robots.txt で `Disallow: /` (検索エンジンはクロール不要)
- **CSS/JS は不要** (インラインスタイルで完結)、削除済み (2026-05-12)

⛔ このフォルダを削除すると、旧URL `contentsx.jp/bizmanga/*` を踏んだ訪問者が404に飛ぶ。**削除厳禁。**

## 制作事例モーダル（旧トップの記録。2026-09-29撤去）
- データ: `js/data/works-detail.js`（22+作品、WORKS_DETAIL_DATA配列）
- 表示: `hero-new.js` の `openWorkDetail()` でモーダル表示
- カルーセル: 1ページ目の縦横比で縦読み(vertical-scroll)/カルーセル切替
- タイトル+カテゴリタグ: `.work-detail-title-row` でflexbox横並び（BizMangaと同仕様）

## 採用ページ（recruit.html）
- 募集職種カード選択 → セクション背景画像切替（recruit.js `switchPosBg()`）
- 「詳細を見る」→ 独立セクション `rc-detail-section` に分離済み（背景画像が透けない）
- 「応募する」→ contact.htmlへ遷移（position パラメータ付き）

<!-- 漫画ビューアは独立BizMangaサイト (bizmanga.contentsx.jp) に移行済み。
     旧 bizmanga/js/works.js は 2026-05-12 に削除。 -->

## 外部サービス
- HubSpot: Portal 48367061, Form b6da14d0-d60d-4357-89fc-0015ed32b704
- WordPress API: `https://cms.contentsx.jp/wp-json/contentsx/v1`（wp-config.js）
- DNS/ドメイン: お名前.com

## CSS設計
- メインサイト: `css/style.css`（共通）+ ページ別CSS。トップは `css/home-2026.css`（Hero→Aboutは `hero-about.css`、ABOUT / SERVICE / NEWS の共通背景とスナップは `home-sections.css`、Creative X は `home-creative-x.css`、Sales X は `home-sales-x.css`、TOPICS は `home-topics.css`、NEWS は `home-news.css`（行の描画は `wp-api.js` のトップ用分岐）。仕様は SPEC.md §3）、他ページは `recruit.css` 等を使用。
- **CSS構成・共通化の計画と、共通CSSを変えたときの全ページ撮り比べ（`tests/sitewide_check.py`）は [CSS-ARCHITECTURE.md](CSS-ARCHITECTURE.md)**。共通CSS・トークン・共通部品を触るPRは必ず撮り比べる。
- フッターは全ページ共通の `.cx-footer`（`css/site-footer.css`）。変更時は静的ページ・コラム記事テンプレ・`services/index.html` の3か所を揃える（SPEC.md §7.5）。
- トップ・サービス以外の下層ページは `css/sitewide-cohesion.css` と `body.cx-sitewide` を追加して共通の色、文字、余白、CTAを揃える（仕様は [SPEC.md §13](SPEC.md)）。コラム記事は `tools/templates/c-column.html.tpl` にも読み込みを置く。並列のトップ・サービス担当との色の調整は「claude連絡網」で共有する。
- トップ・サービス・下層ページ共通のモーションとUIの判断基準は [MOTION-UI-2026.md](MOTION-UI-2026.md)。サービスと下層ページの登場・画像ワイプ演出は `js/sitewide-motion.js`。動きの軽減設定とJS無効時の表示を必ず確認する。
- トップ・サービス・下層ページのフォント、色、文字階層、画像上の文字は [DESIGN-SYSTEM-2026.md](DESIGN-SYSTEM-2026.md) が正本。再利用する変数・画像文字クラスは `css/brand-system-2026.css`。担当ごとに色・フォントの値を新設しない。

## 未完了タスク
- トップページとSales X / Creative X紹介ページに続き、会社案内・採用・ニュース・コラム等の**その他すべてのページ**を同じデザイン体系に揃える。3体目のAIエージェントが担当予定（2026-09-29 平澤依頼）。色・余白・タイポグラフィー・共通ヘッダーを `data/design-tokens.json` とトップ/サービスの実装に照らして統一し、ページ固有機能と既存の外部連携は保つ。並列作業中は別worktreeを使い、トップ・サービス担当とは連絡網でリンク先と共通UIを調整する。
