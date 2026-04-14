# ContentsX 仕様書

**ドメイン**: contentsx.jp
**リポジトリ**: [josawa2255/ContentsX_HP](https://github.com/josawa2255/ContentsX_HP)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-04-14

> このファイルは ContentsX 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約し、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | script.js, hero-new.js, hero-fx.js, wp-api.js, dl-modal.js, cta.js | Hero (イントロ + テキストロゴ + タグライン) + 新作情報 + About + CTA |
| 会社概要 | `company.html` | script.js, cta.js, dl-modal.js | |
| 役員紹介 | `leadership.html` | script.js, cta.js, dl-modal.js | |
| 私たちの思い | `our-thoughts.html` | cta.js, dl-modal.js | |
| 主要関連会社 | `partners.html` | script.js, dl-modal.js | 提携3社（ASOBISYSTEM / DM Solutions / KIRINZ） |
| 強み | `why-contentsx.html` | cta.js, dl-modal.js + インラインJS | ⚠️ メニューから非表示中（BizManga特化のため） |
| 採用情報 | `recruit.html` | recruit.js, cta.js, dl-modal.js | 募集職種カード選択 + 詳細セクション |
| お問い合わせ | `contact.html` | contact.js | HubSpot Forms API + 送信ボタン演出 |
| ニュース一覧 | `news.html` | wp-config.js, wp-api.js, script.js | |
| ニュース詳細 | `news-detail.html` | wp-config.js + インラインJS | |

## 2. URL パラメータ

### 2.1 プラン事前選択（BizMangaと共通）
`?plan=light|standard|premium` — お問い合わせフォーム経由

### 2.2 採用ポジション事前選択
`?position={職種名}` — contact.html で position フィールドに自動入力

### 2.3 UTM / トラッキング
`?utm_source=` `?utm_medium=` `?utm_campaign=` `?source=`
contact フォーム送信時にメッセージ末尾にトラッキング情報を自動付加

## 3. Hero セクション（トップページ）

### 3.1 フェーズ構成
| フェーズ | 時間 | 内容 |
|---|---|---|
| イントロオーバーレイ | 0〜3.6s | 「埋もれていた物語に、光を当てる。」を1文字ずつ波打ちで表示（SKIP可） |
| Phase 1 | 3.6〜9.1s | ビズちゃんキャラクター（屋上/スタジオ/海）が1.2秒ごとにクロスフェード + テキストロゴ "Contents X" がポップアップ |
| Phase 2 | 9.1s〜 | カルーセル背景（5行マーキー）+ タグラインが波・点滅で登場 |

### 3.2 主要要素
| 要素 | 詳細 |
|---|---|
| 背景画像 | `hp-material-1.webp` 固定 (`background-attachment: fixed`)、BizMangaと共通 |
| Intro overlay | SKIPボタン付き。クリックで `finishIntro()` → `hero-intro-done` イベント発火 |
| テキストロゴ | `.hero-logo-text` 内に C/o/n/t/e/n/t/s/空白/X の span。**X だけマゼンタ**。animista `text-pop-up-top` エフェクト（3Dっぽい多段text-shadow + 下から突き上げ） |
| タグライン | 「埋もれていた物語に光を当てる」— `visibility: hidden` でスタート、`hero-phase2-start` イベントで発動 |
| タグライン点滅 | 8秒周期で 白 ⇔ マゼンタ |
| タグライン波 | 6秒周期で文字ごとに0.15sずつ時差の `cxCharRipple`（scale+translateY+グロウ） |
| カルーセル | 5行マーキー、`WORKS_DETAIL_DATA` から `show_hero_site` が `both` or `contentsx` のものを表示 |

### 3.3 重要イベント
```javascript
window.dispatchEvent(new CustomEvent('hero-intro-done'));    // introフェードアウト時
window.dispatchEvent(new CustomEvent('hero-phase2-start'));  // カルーセル切替時
```

## 4. 共通 JS コンポーネント

| ファイル | 役割 | 呼び出し方 |
|---|---|---|
| `js/cta.js` | 共通CTAセクション生成 | `<section id="cxCtaMount"></section>` を置く（6ページで共有） |
| `js/nav.js` | ヘッダーナビ + ハンバーガー + 言語切替 | 全ページ（defer） |
| `js/i18n.js` | i18nエンジン | 全ページ（nav.jsより先） |
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
| HubSpot Forms | お問い合わせ | Portal `48367061` / Form `b6da14d0-d60d-4357-89fc-0015ed32b704` |
| WordPress REST API | 漫画事例 / ニュース | `https://cms.contentsx.jp/wp-json/contentsx/v1` |
| GitHub Pages | ホスティング | `contentsx.jp` (CNAME) |

### WP API エンドポイント
- `/works?site=contentsx` — 漫画事例
- `/works-new?site=contentsx` — 新作情報
- `/news?site=contentsx&per_page=50` — ニュース

### WP 編集可能フィールド
- `cx_title_en` / `cx_subtitle_ja` / `cx_subtitle_en`
- `cx_pages` / `cx_client` / `cx_point` / `cx_comment`
- `cx_sort_order` — 表示順（**数字が小さい＝先に表示**）
- `cx_show_hero_site` — Heroカルーセル表示先（both/bizmanga/contentsx/none）
- `cx_show_new_contentsx` — 新作情報表示フラグ

## 7. ヘッダー/ナビ仕様

### 7.1 モバイルヘッダー必須ルール ⭐再発防止
スマホでハンバーガーが押せない問題が過去に再発した履歴あり。**ヘッダー変更時は必ず以下を守る**:

1. `.hamburger` に `order: 10` + `flex-shrink: 0` + `min-width/height: 44px` + `z-index: 99999`
2. 言語ボタンは `width: 44px; height: 32px` 程度に縮小
3. `.header-right` は `gap: 8px` + `flex-wrap: nowrap` + `min-width: 0`
4. `.header-inner` の padding は 16px 以下
5. `touchend` イベントも `click` と一緒に登録（iOS Safari対策）
6. **`.header` に `isolation: isolate`** + `.header-right` に `position: relative; z-index: 10`
7. `hero-intro-overlay` は `pointer-events: none`（SKIPボタンのみ auto）— ヘッダータップを邪魔しない
8. **320px (iPhone SE) まで想定**

### 7.2 ドロップダウン仕様
- PC: hover で展開
- モバイル: 1回目タップで展開、2回目タップで遷移
- 同時に1つだけ開く（他のドロップダウンは自動で閉じる）
- `touchend` ハンドラで iOS 対応

### 7.3 現在のメニュー構成
```
ホーム | 企業 ▾ (会社概要/主要関連会社/役員紹介) | 採用情報 | お問い合わせ
```
- ⚠️ 「強み」は一時削除中（BizManga特化のため）→ 他事業展開後に全面刷新してメニュー復帰予定

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

[partners.html](partners.html) で3社掲載:
- ASOBISYSTEM / DM Solutions / KIRINZ
- ロゴ画像: `material/images/partners/*.webp`
- **背景透過済み**（PIL で RGB>=240を透明化）
- `max-width: 320px` でカラム幅に収める

## 12. 既知の注意点

| 事項 | 詳細 |
|---|---|
| hreflang | **2026-04-14 全ページから削除済**（JS言語切替1URL構成のため誤実装だった。sitemap.xml からも削除） |
| image alt | hero キャラ画像に alt が無い |
| image width/height | 未指定 → CLS悪化要因 |
| description | 現状68文字で短い。推奨 120-160字 |
| Organization.sameAs | 空配列 → SNS URLを追加推奨 |
| OG画像 | 全ページ共通で `ContentsX.webp`（ロゴ）を流用中。1200×630px の専用OGP画像が未作成（TODO） |
| data-theme | 現在 `magenta-hot` がデフォルト（`var(--accent): #FF0090`）|

### 2026-04-14 SEO改善実施

- hreflangタグを全HTML・sitemap.xmlから削除（誤実装解消）
- index.html のヒーローロゴを `<h2>` → `<h1>` に変更し、sr-only h1 を削除（見出し順序の正規化）
- `<meta name="referrer" content="strict-origin-when-cross-origin">` を全ページに追加
- ルートに [llms.txt](llms.txt) を新設（AI検索エンジン向け事業概要・主要ページ一覧）

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
3. **新作情報に漫画事例を出したい** → WP `cx_show_new_contentsx` フラグを立てる（`/works-new` エンドポイント）
4. **Heroカルーセルから特定漫画を外したい** → WP `cx_show_hero_site` を `bizmanga` or `none` に
5. **i18n 切替が動かない** → `i18n.js` が `nav.js` より先にロードされているか確認
6. **テキストロゴの X だけ色を変えたい** → `.hlt-char--x` クラス
7. **ヒーロー演出のタイミング変更** → `hero-new.js` の `startIntro()` / `startHeroAnimation()` の setTimeout 数値
8. **タグラインの波・点滅を止めたい** → `hero-new.css` の `cxCharRipple` / `cxCharBlink` keyframes
9. **資料DL制限** → お問い合わせ送信済みか `localStorage.cx_form_submitted` で判定
10. **bizmangaサブページは別ナビ** → `ContentX/bizmanga/` 配下は `bm-nav.js` を使用（独立BizMangaサイトとは別物）
