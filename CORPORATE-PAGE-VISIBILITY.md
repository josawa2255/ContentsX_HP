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

## `/about` の実装

- デザイン: `css/about-2026.css`。サイト共通の `css/sitewide-cohesion.css` にある色・文字・ボタンのトークンを使用。
- 画像: `material/images/about-2026/*.webp`。参考デザインをもとに生成したイメージ素材。オフィス写真は実在するContents X オフィスではない。価値観セクションの人物も実在社員ではない。
- 代表写真: 元の `material/images/leadership/kuromiya.webp` はリポジトリに存在しなかったため、現在はブランドの X を仮表示。実際の代表写真を受領したらここだけ差し替える。実在人物のAI生成肖像を代用しない。
- 代表メッセージ本文: 旧 `message.html` の文章を抜粋して構成。見出しは支給されたデザイン案を採用。
