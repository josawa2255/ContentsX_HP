# 企業案内の公開状態（2026-09-29）

## 公開するページ

- `/about` (`about.html`): 「ContentsXについて」。事業、理念、ミッション・ビジョン、バリュー、代表メッセージを一つのページに掲載する。代表メッセージのアンカーは `#message`。
- `/company` (`company.html`): 会社概要。

## 一時非表示のページと導線

| 元のページ | 現在の動作 | 非表示にした場所 |
|---|---|---|
| `/message` (`message.html`) | `noindex`、`/about#message` に転送 | 共通ナビ `js/nav.js` の「トップメッセージ」、記事フッター `column/*.html` と `tools/templates/c-column.html.tpl` の「代表メッセージ」、サイトマップ |
| `/leadership` (`leadership.html`) | `noindex`、`/about#message` に転送 | 共通ナビの「役員紹介」、記事フッターの「経営陣」、`faq.html` と `404.html` のリンク、サイトマップ |
| `/partners` (`partners.html`) | `noindex`、`/company` に転送 | 共通ナビの「主要関連会社」、トップ・会社概要・採用・ニュース・フォーム等の共通フッターの「パートナー」、サイトマップ |
| `/our-thoughts` (`our-thoughts.html`) | `noindex`、`/about#message` に転送 | `recruit.html` のリンクを `/about#message` に変更 |

検索・アプリ向けの導線も `sitemap.xml`、`tools/generate-sitemap.py`、`manifest.json`、`llms.txt`、`index.html` の JSON-LD、`SEO-STRATEGY.md` で更新した。

旧URLを消さずに転送を残す。元のHTML本文はブランチ開始時点のコミット `07a92552329b2892871cc984cf46fc3127555387` の Git 履歴に残る。再公開する場合は、公開内容を確認してから該当HTMLを復元し、ナビ・フッター・記事テンプレート・検索向けの導線とこの表を同時に更新する。

## コラムの導線（2026-09-29 一時非表示）

平澤さんの指示で、コラムは**導線だけ**を外した（ページは消さない・転送しない・検索からも外さない）。

| 対象 | 現在の動作 | 非表示にした場所 |
|---|---|---|
| `/column`（`column.html`）と `/column/{slug}` の記事 | そのまま公開。URL を直接開ける・`sitemap.xml`・`llms.txt`・`feed.xml` にも掲載のまま。WP からの自動ビルドも従来どおり | 共通ナビ `js/nav.js` の「コラム」（PC ナビ・スマホのメニューとも）。他ページからコラムへのリンクはこの1か所だけだった |

- コラムの中（一覧のフッター・記事内のリンク・パンくず）は触っていない
- BizManga の一部ページ（`manga-types.html` 等）から ContentsX の記事 `/column/btob-manga-cvr-strategy` へのリンクがある（BUGS #055）。今回の対象は ContentsX 側の導線だけなので残している
- **戻すとき**: `js/nav.js` の `NAV_ITEMS` でコメントアウトしてある「コラム」の行を戻し、この節と SPEC.md §7.4 の注記を消す

## `/about` の実装

- デザイン: `css/about-2026.css`。サイト共通の `css/sitewide-cohesion.css` にある色・文字・ボタンのトークンを使用。
- 画像: `material/images/about-2026/*.webp`。参考デザインをもとに生成したイメージ素材。オフィス写真は実在するContents X オフィスではない。価値観セクションの人物も実在社員ではない。
- 代表写真: 元の `material/images/leadership/kuromiya.webp` はリポジトリに存在しなかったため、現在はブランドの X を仮表示。実際の代表写真を受領したらここだけ差し替える。実在人物のAI生成肖像を代用しない。
- 代表メッセージ本文: 旧 `message.html` の文章を抜粋して構成。見出しは支給されたデザイン案を採用。

## 画像生成記録

組み込みの `image_gen` で生成し、`cwebp -q 82` でWebPに変換した。画像内に実在の人物・場所・社名ロゴを描かせず、ロゴはHTML側で既存素材を重ねた。

| ファイル | 生成時の指示の要点 |
|---|---|
| `office-concept.webp` | 明るく洗練された日本の企業受付。右側の壁を無地に残し、社名を後から重ねられる構図 |
| `tokyo-sunset.webp` | 東京の高層ビルを夕日とオレンジの空で撮影したような横長景観 |
| `tokyo-daylight.webp` | 青空、白い雲、東京タワーが見える東京の昼の横長景観 |
| `value-initiate.webp` | ノートを広げて一緒に計画するビジネスパーソンの手元 |
| `value-create.webp` | オフィスで資料とPCを見ながら協働する小さなチーム |
| `value-collaborate.webp` | 企業の担当者同士が対話する明るいオフィスの場面 |
