# ContentsX 仕様書

**ドメイン**: contentsx.jp
**リポジトリ**: [josawa2255/ContentsX_HP](https://github.com/josawa2255/ContentsX_HP)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-04-20

> このファイルは ContentsX 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約し、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | script.js, hero-new.js, hero-fx.js, wp-api.js, dl-modal.js, cta.js, services-ui.js | Sales X / Creative X Hero (左コピー + 右2カード、PC/SP専用画像) + クライアントロゴカルーセル + サービス一覧への短い導線 + News + 新作情報 + 3事業領域 + CTA |
| サービス一覧 | `services/index.html` | i18n.js, nav.js, cta.js, services-ui.js | `data/services.json` と `data/service-groups.json` から生成。Sales X / Creative X ごとのカード一覧 |
| Sales X / Creative X | `services/sales-x/index.html`・`services/creative-x/index.html` | i18n.js, nav.js, dl-modal.js | 事業群ごとの紹介ページ。PC・スマホ参考画像の構成をHTML/CSSで実装。Creative Xのビズマンガ・ビズアニメから公式サイトへ遷移 |
| サービス詳細 | `services/{slug}/index.html` | i18n.js, nav.js, cta.js, services-ui.js | 7サービスを共通テンプレートから生成。データにない任意セクションは非表示 |
| 会社概要 | `company.html` | script.js, cta.js, dl-modal.js | |
| 役員紹介 | `leadership.html` | script.js, cta.js, dl-modal.js | |
| Contents Xについて | `about.html` | cta.js, dl-modal.js | mixi風。Purpose/Mission/Vision/Values(信じる/届ける/共に)+事業構造+出版モデル比較+グローバル網103社+ロードマップ2026-2028+代表メッセージ誘導+関連リンク（2026-04-23 新設） |
| トップメッセージ | `message.html` | cta.js, dl-modal.js | 旧 our-thoughts を代表 黒宮 一人称メッセージにリニューアル。CSSは `our-thoughts.css` 流用（ot-* クラス）。旧 `our-thoughts.html` は `/message` への JS+meta リダイレクト |
| 主要関連会社 | `partners.html` | script.js, dl-modal.js | 提携2社表示中（DM Solutions / KIRINZ）。ASOBISYSTEMは2026-07-08非表示 |
| 採用情報 | `recruit.html` | recruit.js, cta.js, dl-modal.js | 募集職種カード選択 + 詳細セクション |
| お問い合わせ | `contact.html` | contact.js | HubSpot Forms API + 送信ボタン演出 |
| ニュース一覧 | `news.html` | wp-config.js, wp-api.js, script.js | |
| ニュース詳細 | `news-detail.html` | wp-config.js + インラインJS | |
| コラム一覧 | `column.html` | i18n.js, nav.js, column.js | Featured + カテゴリチップフィルタ + カードグリッド。`tools/build-c-columns.py` が WP API (`?site=contentx`) からカード・カテゴリ・ItemList JSON-LD・Featured を自動注入（`<!-- BUILD:COLUMN_GRID -->` マーカー間） |
| コラム個別 | `column/{slug}.html` | (静的) | `tools/build-c-columns.py` で生成。`/column/` は `column/index.html` の meta refresh で `/column` へリダイレクト |

## 2. URL パラメータ

### 2.1 プラン事前選択（BizMangaと共通）
`?plan=light|standard|premium` — お問い合わせフォーム経由

### 2.2 採用ポジション事前選択
`?position={職種名}` — contact.html で position フィールドに自動入力

### 2.3 UTM / トラッキング
`?utm_source=` `?utm_medium=` `?utm_campaign=` `?source=`
contact フォーム送信時にメッセージ末尾にトラッキング情報を自動付加

## 3. TOP Hero — Sales X / Creative X（トップページ）⭐

**2026-09-26 Issue #16 採用**: 既存ヘッダー直下のヒーローを、左の企業コピーと右の Sales X / Creative X カードで構成する白〜薄青基調のデザインへ刷新。専用CSSは `css/hero-sales-creative.css`。既存ヘッダーのDOM/CSS/JSは変更しない。

### 3.1 掲載コピー

- メインコピー: 「企業の価値を、売上に変える。」
- リード: 法人の売上づくり、新規商談、検索・AI対策、顧客管理、マンガ・アニメ・映像による価値訴求を一連の流れとして支援する説明
- 事業カード: Sales X「営業の仕組みをつくる」 / Creative X「価値を、伝わるカタチにする」
- 装飾コピー: `BUSINESS × CREATIVE` / `CREATE A BRIGHTER TOMORROW`

文言は支給プロンプトを正本とし、要約・改変しない。

### 3.2 画像アセット

| 用途 | PC | SP |
|---|---|---|
| X型背景 | `material/contentsx-hero/desktop/bg-x.png` (1586×992) | `material/contentsx-hero/mobile/bg-x.png` (941×1672) |
| Sales Xカード | `material/contentsx-hero/desktop/sales-card.png` (1448×1086) | `material/contentsx-hero/mobile/sales-card.png` (1122×1402) |
| Creative Xカード | `material/contentsx-hero/desktop/creative-card.png` (1448×1086) | `material/contentsx-hero/mobile/creative-card.png` (1122×1402) |

- 背景とカードは `<picture>` で768px以下をSP画像へ切り替える。
- PNGのアルファは維持する。カード画像の大きな透明外周は、元ファイルを加工せず `.cxh-card` のCSSクリッピングで除く。
- 背景とSalesカードはLCP候補のため eager / `fetchpriority="high"`。Creativeカードもファーストビュー内のため eager、画像寸法属性は実ファイル比と一致させる。

### 3.3 レイアウト

| 幅 | 仕様 |
|---|---|
| 769px以上 | 左コピー / 右カードの2列。添付の小さめの表示感に合わせて最大幅1296px、左右余白は `clamp()`、カード2枚を縦積み。既存ヘッダーは変更しない |
| 768px以下 | コピー → Sales X → Creative X の1列。背景・カードともSP専用画像へ切替 |
| 320〜340px | 見出しと本文を連続スケールのまま最小値へ調整し、横スクロールを禁止 |

見出しはモバイル帯を `clamp() + vw` で連続スケールさせる。grid/flex子には `min-width:0` を付け、320/390/412/448/640/768/1024/1440pxで横スクロールと境界崩れを検証する。

### 3.4 アクセシビリティ

カード画像の左側に焼き込まれた文字はCSSの不透明パネルで覆い、Sales X / Creative Xの名称・見出し・本文を**画面に表示されるHTML**として重ねる。名称は`h2`、見出しは`h3`、本文は`p`で提供し、画像の文字だけに依存しない。背景とカード画像は重複読み上げを防ぐため `alt=""` + `aria-hidden="true"`。メインコピーとリードも画像化せずHTMLで提供する。

### 3.5 データ駆動サービスシステム（Issue #20）

- 正本は `data/services.json`（サービス情報）、`data/service-groups.json`（分類）、`data/design-tokens.json`（色・余白・文字等）。`data/service-data.schema.json` が項目定義。新サービスはデータに1件追加し、必要時のみ画像を `material/` に追加する。
- `python3 tools/build-services.py` でTOPの `<!-- BUILD:SERVICES -->`（一覧への短い導線のみ）、`services/index.html`（全サービスカードを集約）、`services/{sales,creative}-x/index.html`、`services/{slug}/index.html`、`css/web-system-tokens.css`、sitemapのサービスURLを生成する。Pagesデプロイでも同コマンドを実行する。`--check` は生成物の鮮度確認。
- テンプレートは `tools/templates/`、共通CSSは `css/web-system.css`。カードは `repeat(auto-fit,minmax(min(100%,240px),1fr))` で件数に依存しない。Sales/Creativeはグループ属性とtokenで切り替える。支給PNGは装飾、SVGは共通アイコンであり、主要文言はすべてHTMLテキスト。
- PCカードはhover/focusで概要とサービス別の画像をオーバーレイ表示。画像は `data/services.json` の任意 `hoverImage` を参照する。ビズフォームは公式サイトの「企業を選ぶ→調査→一社ごとの文面作成→フォーム送信」という実務を踏まえた生成画像、ビズAIOはAI検索で企業情報が発見される場面、ビズカルテは顧客とのやりとりを次の営業行動へつなぐ場面の生成画像を使う。ビズマンガは共用WordPress掲載の「正義の値段」表紙、ビズアニメ・ビズビデオは実際の動画のポスター、ビズ採用は公式サービスページのヒーロー画像をローカル保存して使う。ビズAIO・ビズカルテはホバー/フォーカス時に「乞うご期待」を表示して詳細リンクを出さない。画像は装飾扱いで主要文言は常にHTMLテキスト。モバイルは `js/services-ui.js` による `aria-expanded` 付き展開、JavaScript無効時は概要を常時表示。詳細のタブはキーボードの左右矢印/Home/Endに対応し、JavaScript無効時は全パネルを表示。
- 詳細ページは固有title/description/canonical/OGP、BreadcrumbList/Service JSON-LDを持つ。ビズアニメ・ビズビデオの詳細ヒーローも制作事例動画をクリック再生できる。任意の課題・特徴・導入手順・活用シーン・FAQは該当データがある時だけ出力し、実在しない数値・価格・評価は加えない。
- サイトマップはサービス欄をビルドで更新する。ニュース更新用 `tools/generate-sitemap.py` はNEWSマーカー内だけを置換し、サービス・コラム等のURLを保持する。
- 既存ヘッダー・フッター・CTAを流用し、ヘッダーの「サービス」は独立したトップ階層の項目として `/services/` に直結させる。TOPフッターも同URL。既存のヒーローは前段のIssue #16の実装を維持する。
- Sales X・Creative Xの紹介ページは `tools/templates/service-group-*.html.tpl` と `css/service-landing-2026.css` で構成。トップページ現行案の青 `#005bfa`・橙 `#fa4d12` に合わせ、本文は画像に焼き込まずHTMLで保持する。参考画像はレイアウトの参照に使う。画像は `material/service-2026/` に置く。両ヒーローと相談CTAの画像は背景と重ねて境界をフェードさせ、モバイルでは本文の下に配置する。Creative Xのヒーローは女性・撮影カメラ・モニターと橙/紺の斜線を組み合わせた `creative-hero-v2.webp`、Sales Xはチームと青/紺の斜線を組み合わせた `sales-hero-v2.webp`。Creative Xの「夜明けスタジオ」節は表示しない。Sales Xのビズフォームは公式サイトの業務内容に合わせた `bizform-research-v2.webp` を使用する。Sales Xの詳細カードは参考事業ページに合わせ、画像を上、説明を下に置き、デスクトップのホバー/フォーカス時に画像面へ青/紺の説明を重ねる。ビズマンガは共用WordPressの「正義の値段」高解像度表紙、ビズアニメは公式ページのiPadで流れる「I eye」、ビズビデオは「私を置いて、記憶だけ残った街」の公式動画ポスターを使用する。後2者はポスターを押すと `js/service-media.js` がローカルのH.264/AAC MP4を音声付きで再生し、ページ内で完結する。YouTubeのiframe・投稿者表示・外部リンクは置かない。ページ側の再生/一時停止・音量・自動生成字幕・進捗バー・拡大操作をホバー/フォーカス時に表示し、タッチ端末では常時表示する。
- Sales XのビズAIO・ビズカルテは画像エリアでホバー/フォーカス時に「乞うご期待」へ切り替え、詳細リンクを出さない。ビズ採用の画像は公式サービスページのヒーローを使用し、カード・詳細行・一覧カードから `https://ichioshi.contentsx.jp/service.html` へ遷移する。Creative Xのビズマンガは `https://bizmanga.contentsx.jp/`、ビズアニメは `https://bizmanga.contentsx.jp/bizanime` へ直接誘導する。ビズビデオは内部詳細ページに誘導。資料ダウンロードは既存の `js/dl-modal.js` を使用する。Sales X・Creative Xページには独自の相談CTAがあるため、共通CTAは重複表示しない。

## 4. 共通 JS コンポーネント

| ファイル | 役割 | 呼び出し方 |
|---|---|---|
| `js/cta.js` | 共通CTAセクション生成 | `<section id="cxCtaMount"></section>` を置く（6ページで共有） |
| `js/nav.js` | ヘッダーナビ + ハンバーガー + 言語切替 | 全ページ（defer） |
| `js/i18n.js` | i18nエンジン | 全ページ（nav.jsより先） |
| `js/column.js` | コラム一覧の Featured 表示・カテゴリチップ生成・絞り込み | `column.html`（`#cx-column-data` JSONを読む） |
| `js/dl-modal.js` | 資料DLモーダル | contact送信済みか localStorage で判定 |
| `js/wp-api.js` | WP API クライアント | `WORKS_DETAIL_DATA` / `NEW_WORKS_DATA` 上書き |
| `js/wp-config.js` | WP設定 | API baseURL / cache TTL |
| `js/services-ui.js` | サービスカード展開と詳細タブ | TOP・サービス一覧・各詳細（defer） |

### 4.1 CTA セクション共有化 ⭐
- 6ページで CTA を重複コピペしていた問題を解消
- `<section id="cxCtaMount"></section>` + `<script src="js/cta.js">` の2行だけ書けば挿入される
- ボタンは **nav-cta (上部メニューと同じスキューフィル)** で統一
- 1箇所編集で全ページ反映

## 5. i18n 仕様

- **方式**: 2層構造（`data-ja`/`data-en` 属性 + `i18n/en.json` 辞書 336エントリ）
- **localStorageキー**: `cx-lang`
- **公開API**: `window.i18n` (switchLang/t/translateAll/addTranslations/getLang/getDict/translateElement)
- **スクリプト読込順序（必須）**:
  ```html
  <script src="js/i18n.js" defer></script>
  <script src="js/nav.js" defer></script>
  ```
- **placeholder翻訳**: `data-ph-ja` / `data-ph-en` （contact フォーム）
- **MutationObserver**: 英語モード中の動的DOMを自動翻訳
- **data-i18n-skip**: 翻訳対象外
- **data-i18n-html**: innerHTML翻訳（改行タグ含む）
- **カスタムイベント**: `i18n-lang-changed` で他JSに言語変更通知

## 6. 外部連携

| サービス | 用途 | 設定値 |
|---|---|---|
| HubSpot Forms | お問い合わせ | Portal `48367061` / Form `b6da14d0-d60d-4357-89fc-0015ed32b704` |
| Contents X CRM | お問い合わせをCRMの受信箱へ連携（2026-07-29 追加） | `js/contact.js` の送信時に **HubSpotと並行して** `https://contentsx-crm.vercel.app/api/inbound/web` へも POST（`CRM_ENDPOINT` / `CRM_TOKEN` 定数、`site: "contentsx"`）。独自ドメイン `crm.contentsx.jp` は**割当保留中（NXDOMAIN）**のため、現状はVercelの本番URLを直接指定。割当後に `CRM_ENDPOINT` と本行を差し替える。**CRM送信が失敗してもHubSpot送信・サンクス表示・資料DLリンクは従来どおり動く**（`.catch` で握りつぶす=送信者に影響させない）。⚠️ **採用応募（`recruit.html` から `?position=` 付きで遷移）はCRMに送らない**（営業リードのみをCRMに入れる方針。HubSpotには従来どおり全件届く）。CRM側は受信箱に溜めるだけで、担当者が `/inbox` で承認して初めて会社・担当者・活動が作られる。フォーム末尾の**ハニーポット `#cxWebsite`**（画面外・aria-hidden・`data-i18n-skip`）はボット検知用で、値が入るとCRM側が黙って破棄する。`CRM_TOKEN` は静的サイトに埋まる=機密ではない（総当たり抑止の門番。実質の対策はCRM側のレート制限とハニーポット）。⚠️ **トークンをローテーションする時は、CRM側 Vercel の `INBOUND_SECRET`・BizManga の `contact.html`・本サイトの `js/contact.js`・イチオシ採用の `js/main.js` の4箇所を同時に更新する**（イチオシ採用は別リポジトリ josawa2255/recruitx＝`crm-token-sync` フックでは検知できない。2026-08-04 追加）。一部だけだとそのサイトのCRM送信が全件401で落ちるが、HubSpot受付は正常に動き続けるため気づきにくい |
| Google Analytics 4 | アクセス解析 | 測定ID `G-B000C4JCCX`（全HTMLの `<head>` に `gtag.js`、2026-04-16 設置） |
| Google Ads | コンバージョン計測・リマケ | コンバージョンID `AW-18108125426`（GA4タグ直下に `gtag('config', 'AW-...')` 追加、2026-05-09 設置）。**CV計測イベント2種**: ①「お問合せフォーム到達」(`9tNKCNH49agcEPKh0LpD`) = `contact.html` head で発火 / ②「送信完了サンクス」(`F13ECI3R3qgcEPKh0LpD`) = `js/contact.js` の HubSpot送信成功 `.then()` 内で発火（2026-05-20 ラベル末尾を `…Cl…`→`…CI…` に是正、B/C共通） |
| WordPress REST API | 漫画事例 / ニュース | `https://cms.contentsx.jp/wp-json/contentsx/v1` |
| GitHub Pages | ホスティング | `contentsx.jp` (CNAME) |

### WP API エンドポイント
- `/works?site=contentsx` — 漫画事例
- `/works-new?site=contentsx` — 新作情報
- `/news?site=contentsx&per_page=50` — ニュース

### WP 管理画面メニュー・CORS（2026-06-12 再編）
- 左メニュー階層ルール: **複数サービス共通**（漫画事例・ニュース・コラム）= 最上階層 / **サービス専用** = サービス名親メニュー配下（ビズマンガ > お客様の声・赤ペン・ネーム）。親メニューは `add_menu_page('cxcms-bizmanga')` ＋ CPT側 `show_in_menu` で実現
- CORS許可オリジン: `contentsx.jp` / `www.contentsx.jp` / `bizmanga.contentsx.jp` / `ichioshi.contentsx.jp`（イチオシ採用、2026-07-09ドメイン改名）/ `recruitx.contentsx.jp`（旧ドメイン、移行期間中残置）
- **掲載先の多サイト化（2026-06-12）**: ニュース・コラムの掲載先がチェックボックス複数選択（BizManga/ContentsX/イチオシ採用）に。保存値はCSV、旧値 `both`=B+C固定で後方互換（`cxcms_show_site_list()`）。`/columns?site=ichioshi` `/news?site=ichioshi` が利用可能。移行時にライブ全64件で新旧フィルタ結果の完全一致を検証済み
- **リクルートX→イチオシ採用 改名（2026-07-09）**: サイトキーの正式名を `recruitx`→`ichioshi` に変更。旧キーはDB保存値・APIパラメータとも `cxcms_normalize_site_key()` で読み込み時に `ichioshi` へ正規化（DB移行不要・`?site=recruitx` も引き続き動作）。新規保存は常に `ichioshi`。WP管理メニューは「イチオシ採用」（スラッグ `cxcms-ichioshi`）。CPT `rx_case`・タクソノミー `rx_case_tag`・メタキー `rx_case_*` はDB結合のため旧名維持
- 新サービスのWP取り込み手順はルートの **wp-service-onboard スキル**（`.claude/skills/wp-service-onboard/`）参照

### WP 編集可能フィールド
- `cx_title_en` / `cx_subtitle_ja` / `cx_subtitle_en`
- `cx_pages` / `cx_client` / `cx_point` / `cx_comment`
- `cx_sort_order` — 表示順（**数字が小さい＝先に表示**）
- `cx_show_hero_site` — Heroカルーセル表示先（both/bizmanga/contentsx/none）
- `cx_show_new_contentsx` — 新作情報表示フラグ
- **クイック編集対応**: 漫画事例一覧で「サブタイトル」列＋クイック編集から `cx_subtitle_ja` / `cx_subtitle_en` を直接編集可（contentsx-cms.php `quick_edit_custom_box` + `cx_qe_subtitle_*` を inline-save で保存。通常編集画面の保存とは別経路）

### 漫画PDFの一括分割（2026-08-04 新設）⭐

漫画家の納品が「複数ページを1本にまとめたPDF」のため、**管理画面から全ページを一括でWebP化してギャラリーへ入れる**機能。漫画事例の編集画面、ギャラリー欄の「PDFから一括取り込み」ボタン。

**処理の流れ**: PDFを選択 → `cxcms_pdf_info`（Imagick `pingImage` でページ数取得）→ `cxcms_pdf_split_page` を**1ページずつ**呼ぶ → 各ページをWebP化してメディア登録 → `cx_gallery` へページ順に追加。

- **1リクエスト1ページ**。タイムアウトとメモリ枯渇を避けるため一括処理はしない。進捗は「変換中… 3 / 10 ページ」と表示
- ファイル名は `{元PDF名}-p01.webp` のゼロ埋め連番。既存の「ファイル名の数字で並べ替え」ロジックにそのまま乗る
- 既存のギャラリー画像は消さず**追加**される。取り込み後に**投稿を保存するまで確定しない**
- 失敗時はそこで停止し、「何枚目で失敗したか・何枚は取り込み済みか」を表示（途中まで残る）

**設定値**（`define` で上書き可）:

| 定数 | 既定 | 根拠 |
|---|---|---|
| `CXCMS_PDF_DPI` | `150` | 元PDFの埋め込み画像が概ね100〜160ppi。150/200/300dpiを実測比較し、**150超は容量が増えるだけで画質は変わらなかった**（300dpi q92 は 6.13MB/10P、150dpi q85 は 2.02MB/10P） |
| `CXCMS_PDF_QUALITY` | `85` | q75(1.44MB)でも十分だが、差0.6MBで安全マージンを取る |
| `CXCMS_PDF_MAX_PAGES` | `200` | 暴走防止 |

**サーバー要件**: Imagick + Ghostscript。2026-08-04 に本番実測（Imagick 3.8.1 / Ghostscript 9.54.0）で**実PDFのラスタライズ動作を確認済み**。
⚠️ ただし**中身が空のダミーPDFではサムネイルが生成されなかった**（イチオシ採用側の検証）。「PDFサムネが出ない＝機能しない」と即断しないこと。実データで判定する。
⚠️ Imagick の `policy.xml` でPDFが禁止されている環境では動かない。その場合 `cxcms_pdf_info` が「サーバー側でPDF処理が許可されていない可能性」を返す。

**実装上の注意**:
- `setResolution()` は **`readImage()` より前**に呼ぶ（後だと効かない）
- 透過PDF対策に `setImageBackgroundColor('white')` + `flattenImages()`（省くと透過部分が黒くなる）
- 生成WebPは既存の `image_editor_output_format` フィルタとは**別経路**（Imagickで直接WebP出力するため）

### ニュース（cx_news）の編集可能フィールド
- `cx_news_title_en` / `cx_news_content_en` / `cx_news_url`
- `cx_news_show_site` — 表示先サイト。**2026-06-12 チェックボックス複数選択化**: 新形式はCSV（`bizmanga,contentsx,ichioshi` 等）、未チェック=`none`。旧値 `both` は「BizManga+ContentsX」の意味で固定（ichioshiには出ない）。旧キー `recruitx` は読み込み時に `ichioshi` へ正規化（2026-07-09改名）。コラム `cx_column_show_site` も同形式
**画像表示設定（top/detail 別々に保存）**
- `cx_news_image_mode_top` / `_mode_detail` — `contain`（全体表示）か `crop`（トリミング）
- `cx_news_image_crop_x_top` / `_y_top` / `_w_top` / `_h_top` — ホーム/一覧用のトリミング範囲（全て0-100%）
- `cx_news_image_crop_x_detail` / `_y_detail` / `_w_detail` / `_h_detail` — 詳細ページ用のトリミング範囲
- 旧 `cx_news_image_mode` / `_crop_*` / `_fit` / `_position` — 後方互換のため残置（top/detail未設定時のフォールバック）

**WP管理画面**: 「画像表示の調節」`<details>` 折りたたみボタンを開くと、「ホーム・一覧表示」「記事詳細ページ」の2ブロックが現れる。各ブロックに「全体表示／トリミング」のセグメントコントロール風タブ + Cropper.js (CDN 1.6.1) のクロップUI + リアルタイム表示プレビュー。1200px以上で2ブロック横並び、それ以下は縦並び（サイドバー幅対応）

**フロント描画**:
- `wp-api.js`（一覧描画）→ `image_mode_top` + `image_crop_*_top` を使用、なければ旧 `image_mode` 系にフォールバック
- `news-detail.html`（詳細）→ `image_mode_detail` + `image_crop_*_detail` を使用、なければ旧 `image_mode` 系にフォールバック
- `mode=contain` → `<img>` で width:100% height:auto（行幅は揃い、画像高さは画像比追従）
- `mode=crop` → `<div role="img">` + `aspect-ratio` + `background-image/size/position` で範囲再現

**CSS**: `.news-thumb` は `width: 200px / max-height: 280px / align-self: flex-start`（SP は 100px）

## 7. ヘッダー/ナビ仕様

### 7.1 モバイルヘッダー必須ルール ⭐再発防止
スマホでハンバーガーが押せない問題が過去に再発した履歴あり。**ヘッダー変更時は必ず以下を守る**:

1. `.hamburger` に `order: 10` + `flex-shrink: 0` + `min-width/height: 44px` + `z-index: 99999`
2. 言語ボタンは `width: 44px; height: 32px` 程度に縮小
3. `.header-right` は `gap: 8px` + `flex-wrap: nowrap` + `min-width: 0`
4. `.header-inner` の padding は 16px 以下
5. `touchend` イベントも `click` と一緒に登録（iOS Safari対策）
6. **`.header` に `isolation: isolate`** + `.header-right` に `position: relative; z-index: 10`
7. **320px (iPhone SE) まで想定**

### 7.2 ドロップダウン仕様
- PC: hover で展開
- モバイル: 1回目タップで展開、2回目タップで遷移
- 同時に1つだけ開く（他のドロップダウンは自動で閉じる）
- `touchend` ハンドラで iOS 対応

### 7.3 現在のメニュー構成
```
ホーム | 企業案内 ▾ (Contents Xについて / トップメッセージ / 会社概要 / 役員紹介 / 主要関連会社) | コラム | 採用情報 | お問い合わせ
```
- ⚠️ 「強み」は一時削除中（BizManga特化のため）→ 他事業展開後に全面刷新してメニュー復帰予定

## 7.4 コラム機能（2026-05-08 新設）
- 個別記事は WP CMS → `tools/build-c-columns.py` → `column/{slug}.html` で静的生成（既存）
- WP API は `?site=contentsx` フィルタで取得（`show_site` が `contentsx` または `both` の記事のみ）。⚠️ 過去に `contentx`（sなし）と誤記しC向けコラムが0件になっていた（BUGS.md #041、2026-06-12修正）
- 一覧ページ `column.html` も build-c-columns.py が自動更新（Featured 1本 + カードグリッド + カテゴリチップ + ItemList JSON-LD）
- マーカー: `<!-- BUILD:COLUMN_GRID -->` ... `<!-- /BUILD:COLUMN_GRID -->`
- `/column/` アクセス時は `column/index.html` の meta refresh で `/column` (= column.html) へ転送
- `--skip-listing` で個別ページのみ生成可能

## 8. 制作事例モーダル（トップページ）

- `openWorkDetail(workId)` で起動（hero-new.js）
- カルーセル: 1ページ目の縦横比で縦読み(vertical-scroll)/カルーセル切替
- **スマホ対応**: 横スワイプでページ切替（閾値40px、縦スワイプ優先）
- タイトル+カテゴリタグ: `.work-detail-title-row` で flex 横並び

## 9. 採用ページ（recruit.html）

### 9.1 ポジション選択演出
- 3つの募集職種カード（漫画家 / マンガ製作担当 / 営業）
- カード選択 → 背景画像切替 + アクションボタン表示
- **背景**: `switchPosBg()` で positions セクション + detail セクション両方に同じ画像を適用
- **PC（1024px+, hover可）**: `background-attachment: fixed` で2つのセクションがシームレスに繋がる
- **モバイル（767px以下）**: 背景画像非表示（描画崩れ回避）
- 「詳細を見る」→ 独立セクション `rc-detail-section` で表示（半透明カード + blur）
- 「応募する」→ `contact.html?position={職種名}` へ遷移

## 10. お問い合わせボタン（送信ボタン）

- `cb-submit` クラス: 紙飛行機アイコンのhover拡張ボタン
- 右端の丸アイコンが **hover で横に伸びて** ボタン全体をカバー
- 共通スタイルは `style.css` に定義（全ページ利用可）

## 11. パートナー企業ロゴ

[partners.html](partners.html) で掲載:
- 表示中: DM Solutions / KIRINZ
- **ASOBISYSTEMは2026-07-08にコメントアウトで非表示化**（`TEMP-HIDDEN-ASOBI-SYSTEM`マーカー、HTML内に残置。復活は該当ブロックのコメント解除のみ）
- ロゴ画像: `material/images/partners/*.webp`
- **背景透過済み**（PIL で RGB>=240を透明化）
- `max-width: 320px` でカラム幅に収める

## 12. 既知の注意点

| 事項 | 詳細 |
|---|---|
| hreflang | **2026-04-14 全ページから削除済**（JS言語切替1URL構成のため誤実装だった。sitemap.xml からも削除） |
| image alt | Heroの背景・文字入りカードは装飾画像として `alt=""`。同内容をHTML見出し・本文（カード内文言は `.sr-only`）で提供 |
| image width/height | Hero背景・カードは実ファイル寸法を指定済み。その他の未指定画像は引き続きCLS改善対象 |
| description | **2026-04-14 index/news/news-detail/our-thoughts/recruit の5ページを73〜90文字に拡充**（meta/og/twitter/JSON-LD の4箇所同期） |
| Organization.sameAs | **2026-04-14 `https://x.com/Bizmanga_` 追加**。他SNSは未開設 |
| Organization 詳細 | **2026-04-14 `foundingDate: 2026-03-03` / `address`（目黒区） / `subOrganization`（BizManga） / `alternateName` を追加** |
| OG画像 | 全ページ共通で `ContentsX.webp`（ロゴ）を流用中。1200×630px の専用OGP画像が未作成（TODO） |
| data-theme | 現在 `magenta-hot` がデフォルト（`var(--accent): #FF0090`）|

### 2026-04-14 SEO改善実施

- hreflangタグを全HTML・sitemap.xmlから削除（誤実装解消）
- index.html のヒーローロゴを `<h2>` → `<h1>` に変更し、sr-only h1 を削除（見出し順序の正規化）
- `<meta name="referrer" content="strict-origin-when-cross-origin">` を全ページに追加
- ルートに [llms.txt](llms.txt) を新設（AI検索エンジン向け事業概要・主要ページ一覧）
- 5ページ（index / news / news-detail / our-thoughts / recruit）の meta/og/twitter/JSON-LD description を73〜90文字に拡充
- Organization スキーマに `foundingDate` / `address` / `alternateName` / `sameAs`（X: Bizmanga_）/ `subOrganization` を追加
- **news-detail 個別記事のインデックス対応**:
  - [tools/generate-sitemap.py](tools/generate-sitemap.py) を新設（WP APIから news 一覧取得して sitemap.xml を再生成）
  - sitemap.xml を `?id=N` 形式で個別記事URLを列挙する構成に変更
  - news-detail.html に canonical / OG / twitter / description / JSON-LD `NewsArticle` の動的更新スクリプトを追加
  - `why-contentsx.html` および `css/why-contentsx.css` を削除（2026-04-19）。元々メニューから非表示・孤立ページだったため完全撤去

### sitemap再生成ルール

ニュース記事を WordPress で追加・更新したら以下を実行:

```bash
cd ContentX
python3 tools/generate-sitemap.py
git add sitemap.xml && git commit -m "chore(sitemap): news更新" && git push
```

GitHub Actions 等で月次自動化も可能（TODO）。

### 2026-04-20 SEO採点反映改善 第2弾（81→86→90+目標）

- **画像 width/height 属性を一括追加**（CLS対策）: ヘッダーロゴなど主要画像にwidth/height明示
- alt属性欠落: 0件を確認（空alt はすべて `role="presentation"` / JS動的代入 / WP本文で問題なし）

### 2026-04-20 SEO採点反映改善（監査スコア 81/100）

**[bizmanga サブディレクトリ強化]**（6ページ）
- `contentsx.jp/bizmanga/{index,works,biz-library,pricing,faq,contact}.html` に以下を一括注入:
  - `<link rel="alternate" hreflang="ja">` + `hreflang="x-default"`（メインサイトと一致）
  - `BreadcrumbList` JSON-LD（ホーム → ビズマンガ → 該当ページ）
  - index.html のみ `Organization` + `Service` + `AggregateOffer`（lowPrice 11,300 JPY）JSON-LD も追加
- 注入スクリプト: `.seo-audit/tmp-bizmanga-subdir-patch.py`（一時ツール。再実行は冪等）

**[OG画像の個別化]**
- `ContentX/material/images/og/` に `og-faq.webp` / `og-terms.webp` / `og-privacy.webp` を新規生成（1200×630 WebP、黒背景 + 赤アクセント `#E53935`）
- `faq.html` / `terms.html` / `privacy.html` の `og:image` / `twitter:image` 参照を個別画像に差替
- 生成スクリプト: `.seo-audit/tmp-og-gen.py`（Pillow + Hiragino Sans GB）

**[ニュースfallback現行化]**
- `index.html` の news-list fallback 3件を古い日付（2026.02-03月）から WP API 最新3件（2026.03.15-03.27）に置換。リンクを `news-detail?id={id}` に接続

### 2026-04-21 郵便番号統一 + GBP登録

- **郵便番号統一**: `153-0042 / 153-0063` の混在を `153-0061`（中目黒1丁目の正式番号）に統一。修正箇所: [index.html:90](index.html#L90), [company.html:100](company.html#L100), [faq.html:185,279](faq.html#L185), [bizmanga/index.html:434](bizmanga/index.html#L434), [llms.txt](llms.txt)（3箇所）
- **GBP登録**: business.google.com に登録完了（CEO決裁取得済み）。住所認証/写真/初期投稿が次の課題。確定後に Organization schema の `sameAs` に GBP プロフィールURL追加 + llms.txt の Local SEO セクションに記載予定
- **llms.txt 更新**: Last updated `2026-04-21` / Version `1.5`
- **SEO厳格採点実施**: ルート [.seo-audit/STRICT-SCORE-2026-04-21.md](../.seo-audit/STRICT-SCORE-2026-04-21.md)。コード品質ベースの旧採点(87)から、検索可視性・Authorityを15%+5%加味した厳格採点で **68/100** に下方修正。GSC実データで「contentsx」(自社名) と「ビズマンガ」(姉妹サイト名) 以外のターゲット全てが圏外と判明

### 2026-04-17 SEO監査 第2弾

- FAQ schema内のURL typo修正（`contactsx.jp` → `contentsx.jp`）
- 全7ページのpublisher JSON-LDを `@id` 参照パターンに統一（privacy/termsと同じ形式）
- Organization schema: `sameAs` からサブドメインURL除去、`postalCode: 153-0042` 追加
- news.html の WebPage JSON-LD を `<body>` → `<head>` に移動
- leadership.html の Person `worksFor` を `@id` 参照に修正
- FAQPage schema に `dateModified` 追加
- ホームページロゴ `href="#"` → `"./"` に修正
- llms.txt に英語ファクトブロック追加（Key Facts (English) セクション）
- robots.txt に Bytespider ブロック追加
- sitemap.xml lastmod 日付更新
- WP API columns エンドポイントに `modified_ymd` フィールド追加（contentsx-cms.php）

### 2026-04-14 Medium優先度対応

- 全ページに `BreadcrumbList` JSON-LD を追加
- 全ページに `twitter:site: @Bizmanga_` を追加

## 13. テーマカラー

CSS変数 `--accent` は `data-theme` で切替可能:

| テーマ | `--accent` |
|---|---|
| デフォルト | `#6fc31c` (緑) |
| magenta-hot | `#FF0090` |
| magenta-rose | `#E91E8C` |
| magenta-deep | `#C2185B` |

現状 `<body data-theme="magenta-hot">` で運用

## 14. 参照ドキュメント

| ファイル | 内容 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code 引き継ぎ資料 |
| [../SPEC.md](../SPEC.md) | プロジェクト全体仕様（B/C横断） |
| [../STYLE-GUIDE.md](../STYLE-GUIDE.md) | デザインルール |
| [../COMPONENT.md](../COMPONENT.md) | 再利用UIパーツ |
| [../SEO.md](../SEO.md) | SEOメタデータ一覧 |
| [../CHECKLIST.md](../CHECKLIST.md) | 公開前チェックリスト |

## 15. よくある落とし穴（Gotchas）

1. **CTA変更忘れ** → [js/cta.js](js/cta.js) 1箇所を編集すれば6ページ全てに反映される（手動コピペ禁止）
2. **モバイルでハンバーガー押せない** → §7.1 のチェックリスト
3. **新作情報に漫画事例を出したい** → 2026-08-05以降は`cx_show_new_contentsx`が未設定でも表示される（明示的に`0`を入れた作品だけ除外）。表示件数は`added`降順で最大10件（`script.js` `MAX_NEW_WORKS`）。**画面が更新されない場合**: `js/wp-api.js` `loadNewWorks()`完了時に発火する`wp-new-works-ready`イベントを`js/script.js`側で購読して`buildNewWorksCards()`を再実行する構成（2026-08-31修正、[BUGS.md #052](../BUGS.md)）。この購読が無いと`wp-data-ready`（`/works`取得完了時のみ発火）のタイミングでフォールバック`js/data/new-works.js`のまま描画が固定されてしまう
4. **Heroカルーセルから特定漫画を外したい** → WP `cx_show_hero_site` を `bizmanga` or `none` に（2026-04-16修正: 静的 `WORKS_DETAIL_DATA` には `show_hero_site` が無いので初回描画は全作品表示。`wp-data-ready` で `buildHeroCarousel()` を再実行してフィルターを効かせている。サムネ差し替えのみだとCMS設定が反映されない）
5. **i18n 切替が動かない** → `i18n.js` が `nav.js` より先にロードされているか確認
6. **テキストロゴの X だけ色を変えたい** → `.hlt-char--x` クラス
7. **ヒーロー演出のタイミング変更** → `hero-new.js` の `startIntro()` / `startHeroAnimation()` の setTimeout 数値
8. **タグラインの波・点滅を止めたい** → `hero-new.css` の `cxCharRipple` / `cxCharBlink` keyframes
9. **資料DL制限** → お問い合わせ送信済みか `localStorage.cx_form_submitted` で判定
10. **bizmangaサブページは別ナビ** → `ContentX/bizmanga/` 配下は `bm-nav.js` を使用（独立BizMangaサイトとは別物）
