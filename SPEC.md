# ContentsX 仕様書

**ドメイン**: contentsx.jp
**リポジトリ**: [josawa2255/ContentsX_HP](https://github.com/josawa2255/ContentsX_HP)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-09-29

> このファイルは ContentsX 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約し、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | i18n.js, wp-api.js, home-2026.js | 2026年9月版。X字の都市ビジュアル、Sales X / Creative X、支援の流れ、サービス、会社紹介、既存News、相談CTA。CSSは `css/home-2026.css`。ヘッダーは一時撤去 |
| サービス一覧 | `services/index.html` | i18n.js, nav.js, services-ui.js | データから生成するSales X / Creative Xのサービス一覧 |
| Sales X / Creative X | `services/sales-x/index.html`・`services/creative-x/index.html` | i18n.js, nav.js, service-media.js | 事業群ごとの紹介ページ |
| サービス詳細 | `services/{slug}/index.html` | i18n.js, nav.js, services-ui.js | 7サービスの詳細ページ |
| 会社概要 | `company.html` | script.js, cta.js, dl-modal.js | |
| ContentsXについて | `about.html` | i18n.js, nav.js, sitewide-motion.js | 事業紹介・理念・ミッション/ビジョン・3つのバリュー・代表メッセージを統合。デザインは `css/about-2026.css`、画像は `material/images/about-2026/`。各セクションは共通のスクロール演出を使用し、動きの軽減設定に対応。代表写真は素材待ちでブランド仮表示 |
| トップメッセージ | `message.html` | 転送のみ | 一時非表示。`/about#message` へ転送 |
| 役員紹介 | `leadership.html` | 転送のみ | 一時非表示。`/about#message` へ転送 |
| 主要関連会社 | `partners.html` | 転送のみ | 一時非表示。`/company` へ転送 |
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

## 3. トップページ 2026年9月版 ⭐

- デザイン基準: `/Users/hirasawa4323/Documents/contentX/デザイン案画像/会社HP/TOP確定/分析出力 1〜14.png`。奇数=PC、偶数=SP、番号順=ページ上から下。トップのヘッダーは2026-09-29の追加指示で一時撤去（他ページは既存ヘッダーを維持）。お知らせセクションのマークアップと `wp-api.js` による更新は維持。
- 構成: Hero → コンセプト → Sales X / Creative X → 売上が生まれるまでの流れ → サービス一覧 → Contents Xとは → News → 相談CTA → フッター。旧ロゴカルーセル・新作情報・制作事例モーダル・旧Hero OPはトップから撤去。
- 白・無彩色を土台に、画像内の青とオレンジをSales X / Creative Xの識別色として使用。旧マゼンタテーマはトップとサービスページで使わない（`body[data-theme="neutral"]`）。その他のページのテーマは変更しない。
- 素材: `material/home-2026/{hero,sales,creative,about,contact}.jpg` と事業紹介用の `sales-safe.jpg` / `creative-safe.jpg`。ユーザー指定デザインを参照に生成した画像で、文字とロゴは画像へ焼き込まずHTMLで重ねる。事業紹介の元画像は被写体が素材の端で切れていたため、余白を設けて再生成した `*-safe.jpg` を表示に使用する。生成したオフィスはイメージ画像として扱う。
- モーション: `js/home-2026.js` と `css/home-2026.css`。ヒーロー文字の登場、スクロールでの段階的な表示、画像の左→右ワイプ（Sales X / Creative X の写真にも適用）、カード・ボタンのホバー移動。`prefers-reduced-motion: reduce` では瞬時表示。JS不在でも内容は表示する。ワイプ要素自身を幅0にクリップすると交差監視できないため、親コンテナを監視して子要素を表示する。
- サービスとその他の下層ページは `js/sitewide-motion.js` を共用する。見出し・カード群は下から24px/0.75秒で1回だけ登場し、主な写真は左から右へ1.05秒で表示する。初画面は即時表示、`prefers-reduced-motion` とJS不在時も内容を表示する。サービス生成テンプレートにも同JSの読込を置く。
- ヒーロー右側の理念コピーは、都市画像の明暗の上でも読めるよう紺色の字に白い縁と淡い白い影を重ねる。事業紹介の中央ロゴは、青とオレンジが交差する文字なしのXマークをインラインSVGで表示する。独立したグリッド列に配置して左右の文言・CTAに重ならないようにし、SVGの viewBox に余白を取って両端を欠けずに描画する。写真は左カードを左寄せ、右カードを右寄せとして、余白付き素材の人物と作画の手を表示する。
- レスポンシブ: 768px以下でヒーローを縦構成、事業カードとサービス欄を1列にする。事業紹介は1100px以下で縦並びに切り替える。文字は `clamp()` で連続スケール。320/390/412/448/640/768/1024/1100/1101/1280/1440/1920pxの横溢れ・事業カード内の文字収まりをブラウザ確認。
- リンク: 総合ページは `/services/`。他ページの共通ナビにも独立した「サービス」を置く。ビズフォーム `https://bizform.contentsx.jp/`、ビズマンガ `https://bizmanga.contentsx.jp/`、ビズ採用 `https://ichioshi.contentsx.jp/` は公開先へ直リンク。その他の個別紹介は `/services/{slug}/`、Sales X / Creative Xの紹介は `/services/#list-group-{sales|creative}` に向ける。制作スタジオ・IP開発は総合ページへ。
- 旧トップ用JS（`script.js`、`hero-new.js`、`hero-fx.js`、`cta.js` 等）はトップでは読み込まず、他ページ用の実装とファイルは残す。トップではヘッダー撤去に合わせ `nav.js` も読み込まない。`i18n.js` は引き続き読み込む。他ページでは `i18n.js` → `nav.js` の読込順を維持。

### 3.0 サービスページ生成（Issue #20）

- `data/services.json`、`data/service-groups.json`、`data/design-tokens.json` を正本とし、`tools/build-services.py` が `/services/`、事業群2ページ、個別7ページ、共通デザイントークンCSS、サイトマップのサービスURLを生成する。トップは独立デザインで生成マーカーを持たないため、ビルドはトップを上書きしない。
- 生成するサービスページのヘッダー・フッターは `services/index.html` を正本とする。トップにはヘッダーがないため、そこから抽出しない。全ページのサービス導線とフッターの新作情報は実在するURLへ向ける。
- サービスカードはhover/focusまたはスマホのタップで概要を示す。JSなしでも内容を表示する。ビズAIO・ビズカルテは準備中、ビズマンガ・ビズアニメ・ビズ採用は公開先の公式サイトへ誘導し、ビズアニメ・ビズビデオの実作品動画はユーザー操作後に再生する。
- サービス生成は `python3 tools/build-services.py --check` と `python3 -m unittest discover -s tests -p test_build_services.py` で確認する。Pagesワークフローも同じ生成処理とテストを実行する。

### 3.1 旧Hero v2（2026-09-29トップから撤去・履歴）

**2026-05-10 v2 採用、2026-09-29撤去**: 旧 hero (テキストロゴ+タグライン+カルーセル) を撤去し、左コピー+中央キャラ+右5サービスカード+下USPマーキー帯の構成に刷新していた。CSS: `css/hero-v2.css`（現在のトップでは未使用）。以下は過去の実装記録。

**2026-07-02 キャラ一体化**: 従来「背景飛沫(`hero_bg`) + 透過キャラ(`hero_chars`)」の2層構成だったが、飛沫と女性キャラ2人を1枚に焼き込んだ画像へ差し替え。専用キャラレイヤー(`.hv2-chars`)と `hero_chars.*` は廃止。女性キャラは背景イラストの一部として描画され、PC では右サービスカードが手前に重なる。PC グリッドは `minmax(620px,1fr) 280px` の2列に変更、`.hv2-bg` の opacity は 1。

**2026-07-07 イラスト改訂版へ差し替え**: 同キャラ・同構図の改訂版イラスト（元データ anime_high_quality_3840px.png 3840×2166、飛沫がより濃いバージョン）から hero_bg 6ファイルを再生成して置換。寸法・ファイル名は従来と完全同一（PC 1672×941 / SP 1375×1144、各 avif/webp/png）のため HTML/CSS 変更なし。元画像は16:9より微妙に縦長のため PC は crop 3840×2160(+0,3) で正規化してから縮小、SP はキャラ中心が右寄り約66%になるよう crop 2596×2160(+344,3) してから縮小。変換は ffmpeg(lanczos, rgb24化) + cwebp(-q82) + avifenc(-q60)。

### 3.1 PC レイアウト
| エリア | 内容 |
|---|---|
| 背景(キャラ一体) | `material/hero/hero_bg.{avif,webp,png}` (1672×941) マゼンタ飛沫+女性キャラ2人の一枚絵を全幅描画 (object-fit:cover, opacity:1) |
| 左コピー | `<h1 class="hv2-headline">` 「ストーリーで／成果を／生み出す」(成果 em 巨大化、回転+skew+SVGグランジフィルタ) + サブコピー「漫画・動画・Web・IPを横断し、企業の成長を加速する。」。**見出し・サブとも白の縁取り(8方向 text-shadow + ソフトハロー)で背景画像から可読性を確保 (2026-07-02)** |
| 右カード | `.hv2-services` の5サービス(DOM順=表示順): ビズマンガ(→ bizmanga.contentsx.jp) / スクール(→ newmanga-academy.contentsx.jp = ニューマンガアカデミーLP、2026-08-22設定) / コンテンツ採用(フル幅、→ ichioshi.contentsx.jp 2026-07-07設定、2026-07-07にスクール直後へ移動) / コンテンツセールス / IP事業。未確定の2枚(コンテンツセールス・IP事業)は `href="#"` + `data-todo` 属性。スキューシャドウ枠 |
| CTA | primary「お問い合わせ」(マゼンタ pill) + ghost「資料ダウンロード」(白枠 pill)、hover で alt テキストへスライド |
| 下帯 | `.hv2-strap` USPマーキー (業界最安値クラス／対応領域 国内外20+言語／最短2週間納品／企画から運用まで一気通貫) |

### 3.2 SP レイアウト (max-width: 768px)
| 不変条件 | 詳細 |
|---|---|
| ビジュアルゾーン(比率固定) | `.hv2-bg` を `inset: 60px 0 auto 0 / height: var(--hv2-visual-h)` に閉じ込め、キャラ一体の一枚絵 (`hero_bg_sp.{avif,webp,png}` 1375×1144) を全幅描画。**`--hv2-visual-h = calc(100vw * 1144 / 1375)`** とし box の縦横比を画像と一致させることで `object-fit:cover` でもクロップせず画像全体を表示（トリミングで縦長化するのを防止）。下端は `mask-image` + `::after` 70px 白オーバーレイでフェード |
| CTA を画像の下へ(絶対条件) | `.hv2-ctas` は `.hv2-copy`(flex縦)の**子**なので `grid-area` は効かない。`.hv2-copy { min-height: calc(var(--hv2-visual-h) + 96px) }` で画像高+余白を確保し、`.hv2-ctas { margin-top: auto }` で下端へ落とす。→ 画面幅で画像高が変わっても CTA は常に画像の直下(≒下端+16px)に並ぶ。検証: 360/390/430/768 で `ctas.top >= bg.bottom` |
| 見出し傾斜 | `transform: rotate(-6deg) skewX(-9deg)`、SP は SVG グランジフィルタを解除 (filter:none) |
| sub copy 傾斜 | 見出しと同じ `rotate(-6deg) skewX(-9deg)` で `transform-origin: left bottom` 統一 |
| client-logos 連結 | section 暗黙の `padding: 100px 0` を `padding-bottom: 0` で hero から解除し、client-logos `padding: 24px 0 28px / margin-top: 0` で接続 |

> 2026-07-02: キャラ一体化＋SP一枚絵の比率固定表示に刷新。旧「bg/chars 下端一致」ルール（`--hv2-chars-h` / `chars.top = visual_h - chars_h`）・透過キャラ `right:-100px`・固定 `margin-top:166px` は全廃止。

### 3.3 CSS変数（SP）
```css
.hv2-hero {
  /* 一枚絵をトリミングせず全幅表示するため画像比率(1375:1144)で高さを算出 */
  --hv2-visual-h: calc(100vw * 1144 / 1375);
}
```
画像は比率固定で全体表示。CTA は `.hv2-copy` の min-height + `.hv2-ctas { margin-top:auto }` で画像直下へ。`--hv2-chars-h` は廃止済み。

### 3.4 旧仕様（撤去済み・参考）
旧 hero (テキストロゴ「ContentsX_hero.webp」+ タグライン「埋もれていた物語に光を当てる」+ カルーセル + Phase 2 演出) は v2 採用で実質非表示となった。`hero-new.js` / `hero-fx.js` のトップでの読込は2026-09-29に終了。0〜3.6s イントロオーバーレイ系は 2026-05-10 撤去済み (`heroIntroOverlay` / `startIntro` / `finishIntro` 系全削除)。

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
| HubSpot Forms | お問い合わせ | Portal `48367061` / Form `b6da14d0-d60d-4357-89fc-0015ed32b704`。⚠️ **部署（`busyo`）は HubSpot 側で必須**＝空だと送信が拒否される（B/C 共通フォーム）。`contact.html` の部署欄は `required`、加えて `js/contact.js` が送信時に前後の空白を除いて空なら `setCustomValidity` で止める（HTML の `required` は空白だけの入力を通すため。メッセージは日英切替に追従。2026-09-29） |
| Contents X CRM（ビズカルテ） | お問い合わせをCRMの受信箱へ連携（2026-07-29 追加・2026-09-29 **貼り付けコード方式**へ移行） | **貼り付けコード方式**: CRM の貼り付けコード `https://contentsx-crm.vercel.app/embed/inbound-v1.js` を `contact.html` の `</body>` 直前で1行読み込む（`data-source-key`＝本サイトの公開キー・`data-auto="false"`・`data-honeypot="#cxWebsite"`・`async`）。`js/contact.js` の送信処理で、HubSpot送信の直前に `copyToCrm(form)` を1回呼ぶ（中身は `BizcarteInbound.sendForm(form)`。貼り付けコードは async なので、送信時にまだ読み込めていなければ `load` を待って送る。例外は外へ出さない。読み込み失敗・API 欠落はコンソールに警告を残す。貼り付けコードは `script[data-source-key]` で探すのでファイル名に依存しない）。受信箱の種類は `form_kind: "inquiry"`（お問い合わせ）。⚠️ **採用応募（`recruit.html` から `?position=` 付きで遷移）は呼ばない＝CRMに送らない**（営業リードのみをCRMに入れる方針。HubSpotには従来どおり全件届く）。項目は5つの入力欄の `data-crm-field`（company→`company_name`／department→`department`／fullName→`full_name`／email→`email`／message→`message`）で明示している。ハニーポット `#cxWebsite`（`data-i18n-skip`・`name="website"`＋`tabindex="-1"`）は値が入るとCRM側が黙って破棄する。送信先は `/api/inbound/s/<公開キー>`。公開キーは**秘密ではない**（ブラウザに出る前提）。CRM側は**登録済みの送信元ドメインだけ**を受け付ける＝本番ドメイン `https://contentsx.jp` 以外（localhost 等）からの送信は拒否される（HPの受付には影響なし）。連投制限は送信元ごとに10分5件。`data-auto="false"` は必須（外すと入力チェックで止まった送信まで拾う）。**トークンの管理は不要**（旧方式の `CRM_TOKEN`／CRM側 `INBOUND_SECRET` の同期ルールは廃止）。CSP は `script-src` に `https://contentsx-crm.vercel.app/embed/inbound-v1.js` を**ファイル単位で**追加（`connect-src 'self' https: wss:` は既に CRM への送信を許しているので変更なし）。SRI（`integrity`）は**付けない**（CRM 側が同じファイル名のまま互換更新するため、付けると更新のたびに読み込みが止まり CRM にだけ届かなくなる。ルート docs/operations/SECURITY.md に例外として記録）。⚠️ **CRM のドメインを変えるときは、`contact.html` の script の `src` と CSP の `script-src` の2か所を直す**。**CRM 送信は応答を待たず例外も外へ出さないため、失敗しても HubSpot 送信・完了表示・Google広告CVは従来どおり動く**。CRM側は受信箱に溜めるだけで、担当者が承認して初めて会社・担当者・活動が作られる。⚠️ 2026-09-24 の CRM の組織分離から旧経路（`/api/inbound/web` への並行 POST）は 404 になり、この間 HubSpot には届き CRM には届いていなかった（BUGS #056） |
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

## 8. 制作事例モーダル（2026-09-29トップから撤去）

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

[CORPORATE-PAGE-VISIBILITY.md](CORPORATE-PAGE-VISIBILITY.md) に非表示箇所と復帰手順を記録。`partners.html` は現在転送のみで、以下は旧ページの素材に関する記録:
- 旧掲載: DM Solutions / KIRINZ
- **ASOBISYSTEMは2026-07-08にコメントアウトで非表示化**（`TEMP-HIDDEN-ASOBI-SYSTEM`マーカー、HTML内に残置。復活は該当ブロックのコメント解除のみ）
- ロゴ画像: `material/images/partners/*.webp`
- **背景透過済み**（PIL で RGB>=240を透明化）
- `max-width: 320px` でカラム幅に収める

## 12. 既知の注意点

| 事項 | 詳細 |
|---|---|
| hreflang | **2026-04-14 全ページから削除済**（JS言語切替1URL構成のため誤実装だった。sitemap.xml からも削除） |
| image alt | hero キャラ画像に alt が無い |
| image width/height | 未指定 → CLS悪化要因 |
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

### 2026年9月のページ横断デザイン

- トップページとサービスページはそれぞれの担当作業ツリーで設計する。**その他のContents Xページ全体**（会社情報、採用、お問い合わせ、ニュース、コラム、FAQ、法務ページ、404）は第三の担当範囲として統一感を維持する。別セッション間の変更・色の決定は「claude連絡網」で共有する。
- 下層ページは `css/sitewide-cohesion.css` と `body.cx-sitewide` を使用。白を土台に、濃紺 `#07143b`、Sales X の青 `#005bfa`、Creative X のオレンジ `#fa4d12` を共通の視覚語彙とする。見出し、ラベル、リンク、ボタン、淡色背景、境界線の基準をこのCSSへ集約する。
- `body[data-theme="magenta-hot"]` と旧テーマ定義は互換性のため残す。下層ページでは `body.cx-sitewide` の変数が優先する。トップ・サービスのレイアウトにはこのクラスを付けない。
- コラム静的記事は生成物と `tools/templates/c-column.html.tpl` の両方へ共通CSSを読み込む。再ビルド後も外観を維持するため、テンプレートの指定を削除しない。
- レスポンシブ検証幅は 320/390/412/448/640/768/1024/1440px。本文はユーザーの文字拡大設定を尊重する。
- UIとモーションの共通基準は [MOTION-UI-2026.md](MOTION-UI-2026.md)。下層ページは `js/sitewide-motion.js` がセクションの1回だけの登場演出を担う。JS無し・動きの軽減設定時は常時表示する。
- フォント・文字階層・色の役割・写真上の文字は [DESIGN-SYSTEM-2026.md](DESIGN-SYSTEM-2026.md) に集約。CSSの正本は `css/brand-system-2026.css`。下層ページは `css/sitewide-cohesion.css` から読み込み、トップ/サービス担当も同じ変数を使用する。通常サイズの Creative X 文字には `#b83806` を使い、鮮やかな `#fa4d12` は大きい見出しや装飾に限定する。
- 共通の小部品は `cx-ui-surface`（淡色面と枠）、`cx-ui-pill`（丸い外形）、`cx-ui-card`（カード反応）、`cx-ui-action`（操作反応）。ページ固有クラスは配置・内容を担当する。旧生成コラムカード `cx-col-card` の動きは生成テンプレート互換のため保持する。
- 下層ページの確認結果とページ別の調整範囲は [DESIGN-SYSTEM-2026.md](DESIGN-SYSTEM-2026.md) に記録。採用ヒーローはPC/SP専用の生成WebP、会社概要とコラム一覧にも制作・会議イメージの生成WebPを使用。いずれも社内写真を雰囲気の参考にした架空の人物・場所で、写真の転載ではない。会社概要の旧 `js/script.js` は不要なホーム専用処理によるエラーを避けるため外し、共通ナビは `js/nav.js` で動かす。
- ニュース一覧は `js/wp-api.js` の `wp-news-ready` イベントを受け、`detail.status` が `ready` / `empty` / `error` のいずれかで表示を切り替える。`wp-data-ready` は作品取得完了の通知であり、ニュース完了の判定には使わない。コラム記事の配色と書体は `tools/templates/c-column.html.tpl` と既存の生成HTMLへ同時に適用する。

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
