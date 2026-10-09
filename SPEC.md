# ContentsX 仕様書

**ドメイン**: contentsx.jp
**リポジトリ**: [josawa2255/ContentsX_HP](https://github.com/josawa2255/ContentsX_HP)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-10-07

> このファイルは ContentsX 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約し、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | i18n.js, wp-api.js, home-2026.js | 2026年9月版。X字の都市ビジュアル、Sales X / Creative X、支援の流れ、サービス、会社紹介、既存News（写真付きの相談CTAは2026-10-08に撤去し、共通フッター上部の小さな導線に置き換え）。CSSは `css/home-2026.css`。ヘッダーは一時撤去 |
| サービス一覧 | `services/index.html` | i18n.js, nav.js, service-media.js | Creative X / Sales Xの事業紹介とサービス一覧。動画はページ内再生 |
| Sales X / Creative X | `services/sales-x/index.html`・`services/creative-x/index.html` | i18n.js, nav.js, service-media.js | 事業群ごとの紹介ページ |
| 旧サービス詳細URL | `services/{slug}/index.html` | 転送のみ | 個別詳細は廃止。公式サイトまたは一覧の該当サービスへ転送 |
| 会社概要 | `company.html` | script.js, cta.js, dl-modal.js | |
| ContentsXについて | `about.html` | i18n.js, nav.js, sitewide-motion.js | 事業紹介・理念・ミッション/ビジョン・3つのバリュー・代表メッセージを統合。デザインは `css/about-2026.css`、画像は `material/images/about-2026/`。各セクションは共通のスクロール演出を使用し、動きの軽減設定に対応。代表メッセージには黒宮代表の実写真、事業紹介とバリュー03には実際の会議写真を掲載。バリュー01は20代前半〜中盤の日本人男女の生成イメージ。バリュー02は提供された実会議写真の人物・会議室を参考に生成した別場面のイメージであり、実際の会議記録ではない |
| 代表メッセージ | `message.html` | i18n.js, nav.js | `/message`。旧メッセージの導入＋5章を全文掲載。支給ポートレートと会議イメージ、共通ヘッダー・フッター・パンくず。PCは写真の左にタイトル、1024px以下は画像→タイトル→本文。本文は最大760px。独自スクロール演出なし |
| 役員紹介 | `leadership.html` | 転送のみ | 一時非表示。`/about#message` へ転送 |
| 主要関連会社 | `partners.html` | 転送のみ | 一時非表示。`/company` へ転送 |
| 採用情報 | `recruit.html` | recruit.js, cta.js, dl-modal.js | 募集職種カード選択 + 詳細セクション |
| お問い合わせ | `contact.html` | contact.js | HubSpot Forms API + 送信ボタン演出 |
| ニュース一覧 | `news.html` | wp-config.js, wp-api.js, script.js | |
| ニュース詳細 | `news-detail.html` | wp-config.js + インラインJS | |
| コラム一覧 | `column.html` | i18n.js, nav.js, column.js | Featured + カテゴリチップフィルタ + カードグリッド。`tools/build-c-columns.py` が WP API (`?site=contentx`) からカード・カテゴリ・ItemList JSON-LD・Featured を自動注入（`<!-- BUILD:COLUMN_GRID -->` マーカー間） |
| コラム個別 | `column/{slug}.html` | (静的) | `tools/build-c-columns.py` で生成。`/column/` は `column/index.html` の meta refresh で `/column` へリダイレクト |
| Chrome 拡張機能一覧 | `extensions/index.html` | i18n.js, nav.js | `/extensions/`。拡張機能ごとにカードを追加できる一覧。全ページ共通フッター（§7.5）から導線を設置 |
| TabLabo 紹介 | `extensions/tablabo/index.html` | i18n.js, nav.js | `/extensions/tablabo/`。機能・画面・料金・法人導入の案内 |
| TabLabo ポリシー・規約 | `extensions/tablabo/privacy.html`・`extensions/tablabo/terms.html` | i18n.js, nav.js | 拡張子なしURL。本文は日本語の正本を保持し、自動翻訳の対象外 |
| TabLabo AIアクセス許可 | `extensions/tablabo/oauth/consent/index.html` | 提供HTML内のJS・supabase-js | `/extensions/tablabo/oauth/consent/`。共通UIと計測タグを入れない独立画面。noindex |

### 1.1 Chrome 拡張機能・TabLabo（Issue #69）

- デザインは `css/extensions.css` と既存の `css/style.css`・`css/sitewide-cohesion.css`。企業の濃紺・共通トークンを使用し、TabLaboの製品色は紫 `#4f46e5`。提供された実画面5枚をWebPで `material/extensions/tablabo/` に配置。画像は全体表示し、クリックで元寸法の画像を別タブに開く。UI内のデータは架空のテストデータ。
- 一覧に拡張機能を追加する際は `extensions/index.html` の `.ext-grid` 内に `.ext-card` の `article` を追加し、画像・原稿・紹介先を変更する。紹介ページも追加し、`sitemap.xml` に公開URLを登録する。OAuth許可画面はサイトマップへ載せない。
- 紹介と一覧は日英の `data-ja` / `data-en` を使用。規約・ポリシーの本文は `data-i18n-skip` で日本語を維持。共通JSは `i18n.js` → `nav.js` の順。`base href="/"` と絶対パスで深い階層のナビ・画像・CSSを解決する。
- ストアURLが未確定の間、CTAは「限定公開中・お問い合わせ」で `/contact` へ。確定後は紹介と一覧のCTAをストアへの導線へ差し替える。窓口は `help@contentsx.jp`。
- 規約・ポリシーは提供原稿の本文を保持し、草案・根拠・編集者向けの注記を公開HTMLから除く。初回公開日は2026年10月7日（日本時間）。`data-publication-date` の制定日・最終更新日4箇所に同日を設定。改定時は制定日を維持し、最終更新日だけ実際の改定日に変更する。未確定表示のまま公開しない。
- 公開は所有者の内容確認・明示的なマージ許可後に行い、公開URL5件を依頼元へ連絡する。ポリシーと規約は `/extensions/tablabo/privacy`・`/extensions/tablabo/terms`、紹介・一覧・OAuth許可画面は末尾 `/` を維持する。
- OAuth許可画面はTabLabo担当のHTMLをバイト単位で変更せず配置。ヘッダー・フッター・計測・共通CSS/JS・`base`・転送処理を追加しない。SupabaseのURLとpublishableキーはブラウザ公開を前提とする値。変更が必要な場合は担当へ依頼し、更新原稿を再配置する。
- OAuthの公開前検証は `?authorization_id=test` 付きのURLで「TabLabo にログイン」または「この接続の情報を確認できませんでした」の表示を確認する。ローカル検証では認証SDKをスタブ化し、Googleログイン・トークン発行・許可/拒否の本番書き込みを行わない。
- 再検証用スクリプト: `python3 tests/verify_extensions_layout.py --url http://127.0.0.1:8769` と `python3 tests/verify_tablabo_oauth.py --url http://127.0.0.1:8769`（Python PlaywrightとGoogle Chromeが必要）。先に `python3 tools/preview-extensions.py --port 8769` で、拡張子なしの `.html` 解決に対応したローカルサーバーを起動する。OAuth検証には提供HTMLのSHA-256一致チェックを含むため、原稿を更新した場合は担当から受け取った版との一致を確認してハッシュも更新する。PR確認用の画像は `tests/screenshots/extensions/`。

### 1.2 TabLabo規約・ポリシーの原稿更新（Issue #71）

- 2026年10月7日、TabLaboのmain（コミット `715bf521c0940b9d118acbaa6c56269139fcc2fe`）の `docs/store/terms.md`・`docs/store/privacy-policy.md` から本文を取得して更新。作業ツリーの古い原稿ではなく、依頼元が指定したmainのコミットを参照する。
- 利用規約の第7条に無料プラン・月額300円の有料プラン・1人あたり月額200円の組織プラン、支払い・解約等を反映。料金条項は11項目と第1項内の2つの箇条書きの階層を保持する。
- プライバシーポリシーにURLごとのメモ・作業の栞・候補トレイ・共有リンク・AI連携の記録・個人/組織プランの契約情報・ピン留め、端末内の起動日時とタブID、Stripeへの委託を反映。
- 同日内の差し替えのため、制定日・最終更新日は2026年10月7日を維持。草案・編集者向け注記は除外し、日本語の本文を保持。ピン留めの行は依頼に従って含める。
- 一覧・紹介・OAuth同意画面は変更しない。特定商取引法に基づく表記はStripeの準備後に依頼元から別途依頼されるため、本作業では追加しない。

## 2. URL パラメータ

### 2.1 プラン事前選択（BizMangaと共通）
`?plan=light|standard|premium` — お問い合わせフォーム経由

### 2.2 採用ポジション事前選択
`?position={職種名}` — contact.html で position フィールドに自動入力

### 2.3 UTM / トラッキング
`?utm_source=` `?utm_medium=` `?utm_campaign=` `?source=`
contact フォーム送信時にメッセージ末尾にトラッキング情報を自動付加

### 2.4 TabLabo OAuth許可画面
`/extensions/tablabo/oauth/consent/?authorization_id=...` — AIアプリから受け取った認可要求IDを保持する。Googleログインから戻る `?code=...` は提供HTMLのSupabase SDKが処理する。URLの正規化や転送でクエリを削除しない。

## 3. トップページ 2026年9月版 ⭐

- デザイン基準: `/Users/hirasawa4323/Documents/contentX/デザイン案画像/会社HP/TOP確定/分析出力 1〜14.png`。奇数=PC、偶数=SP、番号順=ページ上から下。トップも他ページと同じ共通ヘッダーを使用し、固定ヘッダーの高さ分だけヒーローを下げる。お知らせセクションのマークアップと `wp-api.js` による更新は維持。
- 構成: Hero → About（Heroからスクロール連動で接続。ABOUT・Creative X・Sales X・TOPICS・Newsは共通背景。ABOUT〜NEWS は継ぎ目なく連続） → Creative X → Sales X →（サービス一覧＝非表示中）→ TOPICS → News → フッター（写真付きの相談CTA `.cxh-contact` は Issue #94 で撤去。NEWSは最後のセクションなので下の余白を白フェードより広く取り、白になりきってから濃紺のフッターへ切り替える）。旧ロゴカルーセル・新作情報・制作事例モーダル・旧Hero OPはトップから撤去。
- 2026-10-07（Issue #83）: コンセプト（Sales X × Creative X = Contents X）・Sales X / Creative X の2枚カード・「売上が生まれるまでの流れ」を削除。ABOUT / Creative X / Sales X と内容が重なり、共通背景を白いブロックで途切れさせていたため。サービス同士のつながり（接点 → 価値 → 顧客情報）はサービス一覧ページ `/services/` で伝える。`css/home-2026.css` の `.cxh-concept` / `.cxh-pillar*` / `.cxh-mark` / `.cxh-flow*` の指定は未使用のまま残っている（戻す場合に備えて削除していない）。
- 2026-10-07（Issue #85）: サービス一覧（SERVICE、`#about`「2つの事業で、企業の成長を支えます。」）を `hidden` 属性で一時非表示（マークアップは `TEMP-HIDDEN SERVICE` コメント付きで残置）。Creative X / Sales X と内容が重なるため。後で「Contents X のまとめ」セクションとして作り直す予定。戻すときは `hidden` を外す（Sales X → SERVICE → TOPICS の `cxsb-join-*` はそのまま使える）。下層9ページの下部メニュー「サービス」は `./#about` から `/services/` に付け替えた。「制作スタジオ・IP開発（YOAKE STUDIO）」は現在トップに出ていない。
- 2026-10-07（Issue #85）: 会社紹介「Contents Xとは？ 法人の営業と売上づくりを支援する会社です。」（`#company-intro`）を削除。ABOUT の会社説明・Purpose（/about）・Company（/company）と重なるため。TOPICS → NEWS を共通背景で継ぎ目なくつなぐ。
- 白・無彩色を土台に、画像内の青とオレンジをSales X / Creative Xの識別色として使用。旧マゼンタテーマはトップとサービスページで使わない（`body[data-theme="neutral"]`）。その他のページのテーマは変更しない。
- 共通ヘッダーの「お問い合わせ」は通常時に淡いグレー地・濃紺文字、ホバーとキーボードフォーカス時に濃紺地・白文字で常に可読にする。言語切替の JP / EN ボタンは一時非表示（`css/style.css` の `.header-lang-switch`）とし、`i18n.js` / `nav.js` の言語切替ロジックと読込順は維持する。
- 共通ヘッダーの「ホーム」は単独リンクとし、ホバーやスマホメニューで「ニュース」「新作情報」の子メニューを表示しない。トップ内では `#hero` へ、その他のページでは `/` へ遷移する。「サービス」は `/services/` への親リンクとし、PCではホバー・キーボードフォーカスで Sales X / Creative X、その各項目のホバー・フォーカスで各サービスの二段メニューを表示。Sales X / Creative X 自体も紹介ページへ直接遷移できる。スマホのドロワーでは各事業のサービスリンクを常時表示する。「企業案内」の子メニューは維持する。
- 素材: `material/home-2026/{hero,sales,creative,about,contact}.jpg` と事業紹介用の `sales-safe.jpg` / `creative-safe.jpg`。ユーザー指定デザインを参照に生成した画像で、文字とロゴは画像へ焼き込まずHTMLで重ねる。事業紹介の元画像は被写体が素材の端で切れていたため、余白を設けて再生成した `*-safe.jpg` を表示に使用する。生成したオフィスはイメージ画像として扱う。
- モーション: `js/home-2026.js` と `css/home-2026.css`。ヒーロー文字の登場、スクロールでの段階的な表示、画像の左→右ワイプ（Sales X / Creative X の写真にも適用）、カード・ボタンのホバー移動。`prefers-reduced-motion: reduce` では瞬時表示。JS不在でも内容は表示する。ワイプ要素自身を幅0にクリップすると交差監視できないため、親コンテナを監視して子要素を表示する。
- サービスとその他の下層ページは `js/sitewide-motion.js` を共用する。見出し・カード群は下から24px/0.75秒で1回だけ登場し、主な写真は左から右へ1.05秒で表示する。会社概要・ニュース・コラムの初画面の見出しは0.8秒で軽く登場する。WP由来の一覧が後から表示された場合は、その時点で表示位置を判定する。`prefers-reduced-motion` とJS不在時も内容を表示する。サービス生成テンプレートにも同JSの読込を置く。
- ヒーロー右側の理念コピーは、都市画像の明暗の上でも読めるよう紺色の字に白い縁と淡い白い影を重ねる。事業紹介の中央ロゴは、青とオレンジが交差する文字なしのXマークをインラインSVGで表示する。独立したグリッド列に配置して左右の文言・CTAに重ならないようにし、SVGの viewBox に余白を取って両端を欠けずに描画する。写真は左カードを左寄せ、右カードを右寄せとして、余白付き素材の人物と作画の手を表示する。
- レスポンシブ: 768px以下でヒーローを縦構成、事業カードとサービス欄を1列にする。事業紹介は1100px以下で縦並びに切り替える。文字は `clamp()` で連続スケール。320/390/412/448/640/768/1024/1100/1101/1280/1440/1920pxの横溢れ・事業カード内の文字収まりをブラウザ確認。
- リンク: 総合ページは `/services/`。他ページの共通ナビにも独立した「サービス」を置く。ビズフォーム・ビズマンガ・ビズアニメ・ビズ採用は公開先へ直リンク。ビズビデオは一覧内の動画カード、準備中のビズAIO・ビズカルテは一覧内の該当カードへ。Sales X / Creative Xの紹介は `/services/sales-x/` と `/services/creative-x/` に向ける。
- 旧トップ用JS（`script.js`、`hero-new.js`、`hero-fx.js`、`cta.js` 等）はトップでは読み込まず、他ページ用の実装とファイルは残す。トップを含む全ページで `i18n.js` → `nav.js` の読込順を維持。共通ヘッダーは1280px以下でドロワーに切り替え、文字拡大時のナビ重なりも避ける。トップは固定ヘッダーの下からヒーローを開始する。

### Hero直下のAboutと接続演出（Issue #59）

- `index.html` の既存Heroはマークアップ・初期デザインを維持し、`.cxha-transition` / `.cxha-stage` / `.cxha-hero-frame` で包む。直後に `#home-about` を置く。既存のサービス用 `#about` と会社案内URL `/about` は維持する。
- ABOUTの内容・レイアウトは Issue #63 で刷新（下の「ABOUTの構成（Issue #63）」）。この節は Hero→ABOUT の接続演出の仕様。
- ユーザー提供のオフィス素材 `material/home-2026/about-office-pc.webp`（1672×941）は、#63 以降 Purpose / Company カードの画像（別crop）として使う。スマホ用の縦長版 `about-office-mobile.webp` は #63 で不要になり削除。オフィスはイメージ画像であり、実際の所在地写真として扱わない。遷移参考画像は実装素材には含めない。
- 専用の `css/hero-about.css` / `js/hero-about.js` を使用。ネイティブスクロールとstickyで、PCは画面高の1.15倍・SPは1.0倍（どちらも480〜1000px）のスクロール区間に追従する。
- 動き（2026-10-08、Issue #91で一続きの動きに改修）: 1つの進み具合でHeroの縮小・移動・切り抜きを同時に動かし、メインビジュアル `.cxha-office` の位置・大きさ・角丸にぴったり重ねる（途中で中央縮小→移動に切り替わらない）。切り抜く範囲は写真と同じ縦横比で、Heroの背景画像 `.cxh-hero-visual` の実位置の中央から自動で決める（SPは画像が41%から始まるので上の無地部分を切り落とす）。PCは切り抜きを縮小より少し遅らせてHeroの文字を残し、SPは中心が往復しないよう縮小と同じ進み方にする。進み具合の曲線は開始直後からスクロールに追従し、写真位置で静かに止まる。
- 表示順: Heroの文字は区間の10〜40%（SP 10〜38%）で薄くなり、Aboutの見出し（24〜48%）と重なって引き継ぐ→本文→Heroが写真位置に着く直前に写真を下で完成させる（60〜80%）→重なったHeroが溶けて消える（78〜96%）→Purpose / Company→事業カード。写真が完成してからHeroを消すので、途中で背景が透けない。PC/SPの値は `js/hero-about.js` の `PC` / `SP`。
- 描画は受動的なscroll監視とrequestAnimationFrameでまとめる。wheel/touchのキャンセルやスクロールロックを行わない。逆スクロールでも同じ量に戻り、サイズ変更・文字拡大・フォント読込・i18n切替・履歴復帰時には実寸から再計算する。非表示のAboutがHeroのCTAを遮らないよう初期はpointer-eventsを無効にする。薄くなったHeroのリンクはinertでクリック・フォーカスを抑え、完了後にaria-hiddenにする。
- `#home-about` への直接アクセスは演出完了位置へ、既存ナビの `#hero` は縮小前の先頭へ戻す。通常のアンカー操作・戻る/進むで表示状態が食い違わないようにする。
- JS無効時と `prefers-reduced-motion: reduce` ではHero→Aboutを通常フローで全表示し、sticky・縮小・フェードを使わない。設定の実行中変更にも追従する。i18n.js → nav.jsの既存読込順は維持する。

### ABOUT / SERVICE / NEWS の共通背景（Issue #61）

- 対象は `#home-about`（ABOUT）、`#about`（サービス一覧＝SERVICE）、`#news`（NEWS）の3つ。各セクションに `.cxsb-section` を付け、間のコンセプト・Sales X / Creative X・流れ・会社紹介は従来どおり白系の背景のまま残す。
- 背景はハンドオフ（ContentsX_About_Handoff）の `02_common_bg_pc` / `03_common_bg_sp`（= #59 のオフィス画像）に、ぼかし（PC 15px・SP 16px相当）と明るさ調整を焼き込んだもの。`material/home-2026/section-bg-pc.webp`（1672×941）と `section-bg-mobile.webp`（941×1672）を、768px以下または縦長画面（縦横比3:4以下）で切り替える。CSSの `filter: blur` はスクロール中の描画負荷が高いため使わない。実在のオフィス写真としては扱わない。
- 各セクション先頭の `.cxsb-backdrop` を `position:fixed` で画面全体に置き、セクション側の `clip-path:inset(0)` で切り抜く。背景は動かず、カード・見出しだけが上を流れる（`background-attachment:fixed` は iOS で効かないため使わない）。白いベールで濃紺文字の可読性を保ち、上下端は白へフェードして隣の白いセクションへつなぐ。
- 各セクション上部に大きく薄い英字 `.cxsb-label`（ABOUT / SERVICE / NEWS、`aria-hidden`・`data-i18n-skip`・`text-size-adjust:100%`）。ABOUTは #59 の巨大文字 `.cxha-wordmark` の文言を「CONTENTS X」から「ABOUT」へ変更して流用し、表示タイミングは #59 のスクロール連動のまま。
- 動き: SERVICE / NEWS の英字は左から軽くスライドしてフェード、サービス列とニュースのカードは下から＋scale .97→1 で登場、ニュースの行は0.08秒ずつ時間差。いずれも `home-2026.js` の既存 `data-cxh-reveal` を使い、新しいJSは追加しない。ニュースの行はhover可能な端末だけ右へ4px動かす。NEWSの一覧は白いカードにし、本文幅はサービスと同じ `min(100% - 80px, 1250px)`（スマホは `min(100% - 32px, 560px)`）。
- スクロールスナップ: 1025px以上かつマウス操作の端末だけ `html` に `scroll-snap-type:y proximity`。SERVICE / NEWS は先頭（固定ヘッダー64px下）、ABOUTは #59 の演出完了位置に置いた `.cxsb-about-snap` に吸着する。背の高いセクションの途中では引き戻さない。1024px以下・タッチ端末ではスナップなし。既存の `.cxh-home main [id]` の80pxずらしより後に読み込み、同じ詳細度で64pxに上書きしている。
- CSSは `css/home-sections.css`（`hero-about.css` の後に読込）。検証は `python3 tests/test_section_backdrop.py --url <loopback preview> --artifacts <output>`（16幅、背景の固定、画像切替、隣セクションへの漏れ、文字1.4倍、PCのみのスナップ、hover、動き軽減、JS無効）。

### ABOUTの構成（Issue #63）

- 基準: ハンドオフ `ContentsX_About_Handoff/00_reference_about.png`。画面を1枚画像にせず、背景・画像・文字・カードをHTML/CSSで分ける。ヘッダーは共通ヘッダーのまま。
- PC（1101px以上）: 左に見出し「コンテンツで、企業の可能性をひらく。」と本文、中央に大きなメインビジュアル `.cxha-office`（2026-10-09 から社員の集合写真 `material/home-2026/about-team-photo.webp`、2000×1500。PCは2:1の枠で後列の頭と前列の顔が入る位置〈`object-position: 50% 35%`〉、768px以下は4:3で全体を表示。旧画像 `about-main-visual.webp` は戻す場合に備えて残置）、右に Purpose 導線（「コンテンツの力で、社会にもっといい未来を。」OUR PURPOSE → `/about`）と Company 導線（「私たちについて」COMPANY → `/company`）。下段は半透明の白い帯に「価値を生み出す、2つの力。」の導入文と、Sales X（→ `/services/sales-x/`）/ Creative X（→ `/services/creative-x/`）の2カード。Contents Xカードは置かない。カードのXは Sales X が青、Creative X がオレンジ。
- Purpose / Company カードは新しい画像を増やさず、`about-office-pc.webp` を `background-size` / `background-position` で別の範囲に切り出し、Purpose は白、Company は濃紺のグラデーションを重ねる。
- 769〜1100px: 見出し・本文を上段の全幅、メインビジュアルとPurpose / Companyを2列、導入文を全幅にして事業カードを2列。
- 768px以下: ABOUT → 見出し/本文 → メインビジュアル（4:3）→ Purpose → Company → Sales X → Creative X の1カラム。導入文はスマホでは出さない。横移動や強いstickyは使わない（#59の縮小演出は中央線のまま縦方向）。
- hover（hover可能な端末のみ・0.2秒）: Purpose / Companyの画像を1.02倍、矢印を3px右へ、重ねた色をわずかに薄く。事業カードは背景を白に、影を強め、矢印を3px右へ。キーボードフォーカスは青い枠。
- 高さ（2026-10-04、平澤さんの1470×800表示で見切れ・白い帯の指摘）: スクロール演出中のABOUTは少なくとも1画面分（画面高−ヘッダー、JSが `--cxha-about-min` に設定）の高さを持ち、中身を縦中央に置く。以前はHeroの高さに合わせた舞台の下に白い帯が出ていた。PC（1101px以上）は余白・Purpose/Companyの高さ・事業カードを `svh` でも縮め、1366×650〜1920×1080でABOUT全体が1画面に収まる。
- 登場は #59 のスクロール連動の中で、見出し→メインビジュアル→導線カード→事業カードの順に軽くfade-up。`prefers-reduced-motion: reduce` とJS無効時は全表示し、hoverの変化も止める。
- CSSは `css/hero-about.css`、背景とスナップは `css/home-sections.css`（#61）。検証は `tests/test_hero_about.py`（#59の演出・Hero比較）と `tests/test_section_backdrop.py`（リンク先4件、事業カード2枚、SPの並び順、hover）。

### Creative X セクション（Issue #65、ビューワー化 Issue #97）

- 位置: ABOUT（`.cxha-transition`）の直後、`#creative-x`。デザインは 2026-10-04 改訂版を土台に、2026-10-08（Issue #97）で右上の PICK UP を「メインビューワー」に置き換えた。画面を1枚画像にせずHTML/CSS/JSで組む。
- 背景: ABOUTの共通背景（`.cxsb-section`）をそのまま継続。ABOUTに `.cxsb-join-next`、Creative Xに `.cxsb-join-prev` を付け、境目の白いフェードを出さず1枚の景色として続ける。上部に薄い大きな `CREATIVE X`。PCのスナップ対象。
- しくみ: 下の3カード（ビズマンガ / ビズアニメ / ビズビデオ）がタブで、上のメインビューワー1枠の中身を切り替える。初期表示はビズアニメ。HTML上のカードは各サービスへのリンク（ビズ書庫 / ビズアニメ公式 / `/services/#bizvideo`）で、JSがタブに変える。JSが動けば普通のクリックではページ移動・ポップアップはせず、Ctrl/⌘クリックは各サービスを新しいタブで開ける。切替は約200msのフェード（動き軽減時は即時）、切替時は再生中の動画を止め、マンガは1ページ目・拡大なしに戻す。タブはスペースキー・矢印キー・Home/End でも操作できる（`role="tab"` / `tabpanel` はJSが付ける）。
- PC（1101px以上）: 上段は左に「Creative X ——」・見出し「想いを、伝わるカタチに。」・説明・青いボタン「Creative X について →」（`/services/creative-x/`）、右にメインビューワー（濃紺の枠）。下段は左に「OUR WORKS ——」「作品で見る Creative X」・説明、右に3カード（画像・色付きのサービス名・一文・丸い矢印。選択中は枠線とサービス色の丸）。最下部に区切り線と「IDEAS INTO IMPACT」。ビューワーの高さはサービスを切り替えても変わらない。
- 1100px以下: 1列で「見出し・説明・ボタン → OUR WORKS → 3カード（横3列）→ ビューワー」。カードをビューワーの上に置き、ビューワーの高さが変わっても押したカードが動かないようにする。768px以下はカードを画像＋名前だけの小さなタブにし、592px以下はビューワーを画面の端から端まで広げる。
- ビズマンガ（`js/cx-manga-reader.js`）: ページ内で読めるマンガビューワー。BizManga の読み方の規則を写している（BizManga のJSは読み込まず、BizManga 側は変更しない）。右綴じで、PC（769px以上）は見開き [1,2],[3,4]… の若い番号が右、最終ページが奇数なら左に `/material/manga/thanks_v02.webp`。768px以下は1ページずつ。`view_type` が `vertical_only` / `vertical`、または1ページ目の縦横比が1.8超なら縦スクロール表示。1ページ目が読み込めないときは BizManga と同じく「縦読みではない」として表示を続ける。判定は BizManga の `bm-view-type.js` を読み込まずに写している（別サイトのため）ので、BizManga 側の判定を変えたら `js/cx-manga-reader.js` も合わせる。「次へ」は左・「前へ」は右、←キー＝次・→キー＝前、スワイプは左へ＝次。ページ番号表示、拡大ボタン（2倍・スクロールで移動）。ページは切り取らない（`object-fit: contain`）。PCではページを枠の高さいっぱいに使い、ボタン類は左右の余白に重ねる。
- ビズアニメ / ビズビデオ（`js/cx-video-player.js`）: 共通の16:9プレイヤー。各3本、下にサムネイル列（前後ボタン、横スクロール、SPは指で横に動かす）。最初はポスター・タイトル・説明と再生ボタンだけで、押すとその場で埋め込みを作って再生（自動再生しない）。別の動画・別サービスを選ぶと埋め込みを外して止める。読み込み中・再生できないときは文字で知らせる。高画質サムネイル（maxresdefault）が無い動画は YouTube の灰色の代わり画像になるため、標準サイズ（hqdefault）に切り替える。
- データ（`js/home-creative-x.js`、`WP_CONFIG.apiBase` 経由）:
  - 動画: `GET /bizanime-videos` の `viewer`（WPプラグイン「ビズアニメ・ビズビデオ動画」＞「CREATIVE X ビューワー動画」。種別・タイトル・説明・URL・ポスター・表示ON/OFF・並び順）。種別ごとに再生できるものを先頭から3本。ビューワー動画が未登録の種別は、ビズアニメは `playlists` のビズアニメ分 → 既存の `cases`（単体動画）、ビズビデオは `playlists` のビズビデオ分で代用する。
  - マンガ: `GET /works?site=contentsx`（「ContentsX新作情報に表示」＝掲載可否、`cx_sort_order`＝表示順）のうち、ページ画像（`gallery`）を持つ先頭の作品。
  - 埋め込みURLはフロントで検証済みIDから組み立てる（YouTube は `youtube-nocookie.com/embed/{id}`、プレイリストは `embed/videoseries?list=`、Google ドライブは `drive.google.com/file/d/{id}/preview`、mp4 は `<video>`）。APIの `embed` は使わない。画像は `cms.contentsx.jp` / `contentsx.jp` / `i.ytimg.com` の https とサイト内パスのみ。文字は textContent で入れ、HTMLとして解釈しない。
- 高さ: PC はビューワー（`--cxcx-stage-h`、画面の高さの35%。高さ760px以下は31%、680px以下は27%）・余白・見出し・カード画像を `svh` で縮め、1366×650〜1920×1080 でカードまで1画面に収まる（1470×800・1280×720 では「IDEAS INTO IMPACT」まで）。
- 状態: データ取得中は「読み込み中…」。取得に失敗したら「動画（漫画）を読み込めませんでした」、データが無ければ「準備中です」と出し、どちらも各サービスへのリンクを添える（動画とマンガは別々に判定）。JS無効・WP設定が無効のときは `index.html` の静的な表示（I eye のポスターとビズアニメへのリンク、3カードは各サービスへのリンク）が残る。
- CSSは `css/home-creative-x.css`、検証は `python3 tests/test_creative_x.py --url <loopback preview> --artifacts <output>`（WP応答と画像をフィクスチャに置換。19幅の並び・横はみ出し・文字1.4倍、タブ操作・キーボード、動画の非自動再生・停止・埋め込みURL・XSS・不正URL、マンガの見開き順・サンクスページ・キー操作・拡大・リセット・SPスワイプ・縦読み、切替でビューワーの高さが変わらない、ノートPC6サイズで1画面、スナップ、ビューワー動画未登録時、取得中・取得失敗時、動き軽減、JS無効）。
- WP側は別リポジトリ `contentsx-wp-plugin` の `contentsx-cms/bizanime-videos.php`（プレイリストは 2026-10-03 本番反映。ビューワー動画の欄・REST `viewer` は Issue #97 で追加）。

### Sales X セクション（Issue #67）

- 位置: Creative X の直後、`#sales-x`。共通背景を継続し、Creative X に `.cxsb-join-next`、Sales X に `.cxsb-join-prev` を付けて継ぎ目を出さない。上部に薄い大きな `SALES X`。PCのスナップ対象。
- PC（1101px以上）: 左に見出し「新しい接点を、売上につなげる。」・説明・「Sales Xについて見る」（`/services/sales-x/`）、右に4サービスを2列×2行。1440×900で4枚が1画面に収まる高さ。769〜1100px は説明が上・カードは2×2。768px以下は4枚を縦並び。
- カード: 同じ大きさ・角丸16px。画像（`material/home-2026/sales-x-*.webp`、1448×1086、ユーザー提供のイメージ画像）はビジュアル素材としてだけ使い、カテゴリ・サービス名・説明・CTAは画像の下端に重ねた白いパネルにHTMLで書く。カード全体がリンク。

| カード | 色（線・文字） | 遷移先 | 画像 |
|---|---|---|---|
| ビズフォーム（新規開拓代行） | 青 `#1265e8` / `#0d4fb8`（ビズフォームサイトのブランド色） | https://bizform.contentsx.jp/ | `material/service-2026/bizform-research-v2.webp`（暫定・下記） |
| ビズ採用（採用支援） | ピンク `#ec2d87` / `#c0186b`（ビズ採用サイトの `--rx-accent`） | https://ichioshi.contentsx.jp/ | `sales-x-bizrecruit.webp` |
| ビズAIO（AI検索最適化） | 紫 `#7c4dff` / `#5b30d6` | `/services/#bizaio` | `material/service-2026/bizaio-search-v2.webp`（暫定・下記） |
| ビズカルテ（次世代AI CRM） | オレンジ `#f26a1b` / `#b4470b` | `/services/#bizkarte` | `sales-x-bizkarte.webp` |

- 高さ（2026-10-04）: PC（1101px以上）はカード画像の高さを画面の高さ（`svh`）に合わせ（21:9 → `clamp(88px,15.5svh,200px)`）、余白も縮めて、1366×650〜1920×1080で4枚が1画面に収まる。
- 画像の暫定差し替え（2026-10-07 平澤さん判断）: 提供画像のうちビズフォーム（実在企業のロゴが送信先として描かれていた）とビズAIO（実在メディアの架空記事の引用・根拠のない「導入企業1,000社以上」・BizAIOをCRMと説明）は公開せず、サービス一覧で使っている既存画像に差し替えた。作り直した画像が届いたら `material/home-2026/sales-x-bizform.webp` / `sales-x-bizaio.webp` として追加し、`index.html` の該当2枚の `src` と `width/height` を戻す。
- 文字色は白地でWCAGのコントラスト4.5:1以上になる濃い色を使い、鮮やかな色は線と画像側に使う。PCのhoverは画像1.03倍・矢印4px右、表示時は既存の `data-cxh-reveal` で軽いfade-up（2〜4枚目は0.08秒ずつ遅らせる）。新しいJSは追加しない。
- CSSは `css/home-sales-x.css`、検証は `python3 tests/test_sales_x.py --url <loopback preview> --artifacts <output>`（17幅、2×2・縦並び・同じ大きさ、リンク先、文字がHTMLであること、hover、カード全体のリンク、スナップ、動き軽減、JS無効）。

### TOPICS セクション（Issue #76）

- 目的: 正式な NEWS とは別に、動画・代表メッセージ・プレスリリース・コラム・事例などを横断して載せる「読む・選ぶ」場所。上のセクションほど演出せず、静かで見やすくする（参考: レバレジーズ「INTERVIEW by meLev」）。
- 位置: SERVICE（サービス一覧 `#about`）の直後、`#topics`。SERVICE に `.cxsb-join-next`、TOPICS に `.cxsb-join-prev` を付け、共通背景を継ぎ目なく続ける。上部に薄い大きな `TOPICS`。PCのスナップ対象。NEWS（`#news`）はこの後ろ（間に会社紹介）。
- 見出し: 「TOPICS ——」「Contents X を、もっと知る。」。PCは右上に前後の丸い矢印（1枚ずつ移動。端・全件が収まるときは押せない表示）。SP（768px以下）は矢印なしの横スワイプで、次のカードが少し見える（1枚82%）。
- カード: サムネイル（16:9）/ 種別（英大文字、MESSAGE・VIDEO・PRESS・COLUMN・CASE など自由）/ 日付 / タイトル（2行まで）/ タグ（#付き）。PCは3枚横並び、4枚目以降は横に並び矢印で送る。hover は画像1.02倍・矢印3px右・タイトルを青に。カード全体がリンクで、サイト内は同じタブ（→）、外部（YouTube・PR TIMES等）は新しいタブ（↗、読み上げに「外部サイトが開きます」）。
- データ（`js/home-topics.js`）: `GET /contentsx/v1/topics`（WPプラグイン「Contents X ＞ TOPICS」、`contentsx-cms/contentsx-topics.php`）。表示ONのみ、PICK UP を先頭に、あとは管理画面の並び順。リンクは `/` 始まりのサイト内パスか http(s)、画像は `cms.contentsx.jp` / `contentsx.jp` / `i.ytimg.com` の https かサイト内パスのみ、日付は実在する日付のみ表示。文字は textContent。
- 初期3件（`index.html` に同じ内容を JS無効・取得失敗時の表示として記載）: MESSAGE 2026-09-29「代表メッセージ｜全国で見てきたあの光景を、一社ずつ変えていきたい。」→ `/about#message` / VIDEO 2026-08-11 マクニカ対談（YouTube `w_O3iaQKduQ`）/ PRESS 2026-08-31 KIRINZ との共同創業（PR TIMES）。サムネイルは `material/home-2026/topics/topics-message-kuromiya.webp`（代表写真を16:9に切り出し）、YouTube の自動サムネイル、`topics-press-kirinz.webp`（リリース画像の中段のコマを切り出し）。
- NEWS セクションと代表メッセージ本文ページは、このプロジェクトでは作らない（代表メッセージのリンク先は既存の `/about#message`）。
- CSSは `css/home-topics.css`、検証は `python3 tests/test_topics.py --url <loopback preview> --artifacts <output>`（WP応答をフィクスチャに置換。15幅、位置と背景、カードの項目、リンク、hover、矢印、不正データ、取得失敗時、ノートPCで1画面、スナップ、動き軽減、JS無効）。

### NEWS セクション（2026-10-07 ブラッシュアップ・Issue #85）

- 方針: 情報を確認する場所なので、演出は控えて読みやすさ・一覧性を優先。目指す形は「巨大な薄い NEWS ＋ 右上の一覧リンク ＋ シンプルな4件の一覧」。共通背景は TOPICS から継ぎ目なく続く（`.cxsb-join-prev`）。
- 見出し: 巨大な薄い `NEWS`（`.cxsb-label`）は残し、黒文字の「News」は表示しない（読み上げ用に `#cxnw-title`「ニュース」を視覚的に隠して残す）。「一覧を見る →」（`/news`、常に表示）は一覧の右上。
- 一覧: 最新4件（`wp-api.js` の `NEWS_HOME_LIMIT = 4`）。白い大枠は枠線・影を弱めた半透明。行は「サムネイル / カテゴリ / 日付 / タイトル / 矢印」の順で、行全体が1つのリンク（`a.cxnw-row`）。全行同じ高さ（`grid-auto-rows:1fr`、区切り線は行の内側に描く）、サムネイルは全行同じ 8:5 の枠に `contain`（WPの crop 指定がある画像は cover＋中心位置）。タイトルは濃紺・太字で最も強く、日付はやや薄く、カテゴリは小さな枠付きラベル。PC は横一列（2行まで）、1024px以下はサムネイル右に「カテゴリ・日付」→タイトル、768px以下はサムネイル88px・タイトル3行まで・行の高さ96px以上。
- 動き: 一覧全体が画面に入ったときに軽く fade-up（`data-cxh-reveal`）するだけ。hover は行の背景がごく薄く変わり、矢印が4px右、サムネイル1.02倍。行ごとの時間差アニメーションと行の横移動は廃止。
- 描画: `js/wp-api.js` の `loadNews()` が、トップ（`body` に `data-page-news` が無いとき）だけ上の行を描く。`/news` ページは従来の描画のまま。WP の `url` は http(s) か `/` 始まりだけリンクにし、それ以外は詳細ページ `/news-detail?id=` へ。`index.html` の4件は JS無効・取得失敗時の表示（2026-10-07 時点の最新4件）。
- CSS は `css/home-news.css`（旧 NEWS 指定は `home-sections.css` から削除）。検証は `python3 tests/test_news.py --url <拡張子なしURL対応のプレビュー> --artifacts <output>`（16幅、4行同じ高さ・同じサムネイル、表示順、文字の強弱、右上リンク、SPの並び、hover、不正データ、取得失敗・JS無効、/news が従来どおり）。

### 大きな半透明のセクション名を画面に固定（Issue #89 / タイミング改善 #93）

- ABOUT / CREATIVE X / SALES X / TOPICS / NEWS の大きな半透明文字を、背景の景色と同じく画面に固定する（ヘッダー下 `64px + clamp(10px,1.6vw,26px)`、480px以下は 56px 基準）。
- 仕組み（#93）: `js/home-section-labels.js` が各セクションの名前を**すべての背景（`.cxsb-backdrop`）の中に** `.cxsb-names > .cxsb-name` として描き、`html.cxsb-fixed-labels` を付けて元の `.cxsb-label` を隠す。どの背景にも同じ名前が同じ位置に出るので、セクションの境目をまたいでも文字が切れない。
- 切り替え: 画面の**上から40%の線**を含むセクションの名前を出す（2026-10-08 平澤さん「もっと早く出したい・少し戻っても残してほしい」）。下にスクロールすると次のセクションの上端がこの線を越えた時点で切り替わり、少し上に戻っても上端がこの線より下がるまでは今の名前が残る。切り替えは0.2秒のフェード。ABOUT は Hero → ABOUT の演出（`--cxha-wordmark`）に合わせて現れる。
- JS無効時は元の `.cxsb-label` がセクションと一緒に流れる。動き軽減時はフェードなし。CSS は `css/home-sections.css`。
- 検証: `tests/test_section_backdrop.py`（PC・スマホで、各セクションの名前が1つ・スクロールしても同じ位置・上端が画面の30%まで戻っても残る・50%まで戻ると前の名前に戻る）。

### 3.0 サービスページ生成（Issue #20）

- `data/services.json`、`data/service-groups.json`、`data/design-tokens.json` を正本とし、`tools/build-services.py` が `/services/`、事業群2ページ、旧個別URLの転送ページ7件、共通デザイントークンCSS、サイトマップを生成する。`href` は旧URL、`destination` は現在の遷移先で、生成ページは後者を使う。個別詳細ページは公開しない。サイトマップには一覧と事業群2ページだけを載せる。トップは独立デザインで生成マーカーを持たないため、ビルドはトップを上書きしない。
- 一覧は `tools/templates/service-list.html.tpl` と `css/service-directory-2026.css` で生成する。冒頭の重複ヒーローと事業カードを置かず、Creative X の写真・紹介から始める。Creative X → Sales Xの順に、画像左・濃紺の説明右の事業紹介、1文の概要を添えたサービスカードを置く。事業紹介の写真は装飾画像とし、各事業ページへの遷移は説明側のCTA1個に絞る。最初のCreative X見出しを一覧のH1とする。領域間の帯は見出しで、クリックできるリンクにはしない。PCのホバー/キーボードフォーカスで補足文を表示し、タッチ端末は常時見える1文を残す。公式サイトがある静止画カードは画像・見出し・CTAを同じ公開先へ向ける。動画カードのポスターはページ内再生で、ビズアニメの見出しとCTAのみ公式サイトへ進む。
- 生成するサービスページのヘッダー・フッターは `services/index.html` を正本とする。トップのヘッダー構成が変わっても、生成時はトップから抽出しない。全ページのサービス導線は実在するURLへ向ける。フッターは全ページ共通（§7.5）。
- サービスカードはPCのhover/focusで補足文を示し、スマホでは1文の概要を常時表示する。JSなしでも概要は読める。ビズAIO・ビズカルテは準備中、公開済みサービスは公式サイトへ誘導し、ビズアニメ・ビズビデオの実作品動画はユーザー操作後にページ内で再生する。
- サービス生成は `python3 tools/build-services.py --check` と `python3 -m unittest discover -s tests -p test_build_services.py` で確認する。Pagesワークフローも同じ生成処理とテストを実行する。
- Sales X・Creative Xの紹介ページは `tools/templates/service-group-*.html.tpl` と `css/service-landing-2026.css` から生成する。白・濃紺を土台に、Sales Xの青 `#005bfa` とCreative Xのオレンジ `#fa4d12` を使う。ヒーロー・相談CTAの画像は背景と境界をつなげ、スマホでは本文の下に置く。Creative Xのヒーローは `creative-hero-v2.webp`、Sales Xは `sales-hero-v2.webp`。Creative Xの「夜明けスタジオ」は表示しない。Sales Xのビズフォーム画像は実際の業務内容に沿った `bizform-research-v2.webp` を使う。
- ビズマンガは共用WordPressの「正義の値段」表紙、ビズアニメとビズビデオは公式の実作品ポスターを使用する。後2者はポスターを押すと `js/service-media.js` がローカルのH.264/AAC MP4をページ内で音声付き再生する。YouTubeのiframe・投稿者表示・外部リンクは置かない。再生/一時停止・音量・字幕・進捗バー・拡大操作はホバー/フォーカス時に表示し、タッチ端末では常時表示する。`media-src 'self'` をサービスページのCSPに指定する。
- ビズAIO・ビズカルテは画像エリアのホバー/フォーカス時に紺・青の「乞うご期待」を表示し、詳細リンクを出さない。ビズ採用は公式サービスページのヒーロー画像を使い、`https://ichioshi.contentsx.jp/service.html` に遷移する。ビズマンガは `https://bizmanga.contentsx.jp/`、ビズアニメは `https://bizmanga.contentsx.jp/bizanime` に直リンクする。ビズビデオは一覧内で再生し、制作相談へ誘導する。両事業ページは独自の相談CTAを持つため共通CTAは重複表示しない。

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

### 7.5 共通フッター（2026-10-08 統一、Issue #87）
- 全ページ同じHTML・同じCSS（`.cx-footer`、`css/site-footer.css`）。各ページの `</head>` 直前で最後に読み込み、旧フッター（`.footer` / `.ax-footer` / `.cxh-footer`）のCSSとは干渉させない。旧フッターのCSSは未使用のまま残っている。
- 参考: レバレジーズ株式会社のコーポレートサイトのフッター。濃紺（`--cx-color-ink` #07143b）の面に白抜きロゴ。
- 構成: 左＝ロゴ＋小さなリンク2段（会社概要・私たちについて・ニュース・採用情報・お問い合わせ／よくあるご質問・プライバシーポリシー・利用規約・Chrome 拡張機能）、右＝Sales X・Creative X のサービス一覧2列（外部サイトへのリンクは左上に角の印＋別タブ）、下＝`© 2026 Contents X Inc.`。住所・会社名の文字表記は置かない（会社概要・構造化データに記載）。
- 768px以下は縦積み。リンクの高さは44px以上。各リンクに `data-ja` / `data-en`。
- 上部の小さなお問い合わせ導線 `.cx-footer__contact`（Issue #94）: 「まずはご相談ください／利用するサービスが決まっていなくても構いません。」＋白枠の「お問い合わせ」ボタン（`/contact`）。濃紺の面はそのまま、下に区切り線。768px以下は縦積みでボタン全幅。
- **専用CTAがあるページでは導線を出さない**: そのページのCTAセクション（またはお問い合わせフォーム）に `data-cx-page-cta` を付けると、`body:has([data-cx-page-cta])` で導線が消える。現在の付与先: 共通CTA `#cxCtaMount`（会社概要・採用・サービス一覧／`service-page.html.tpl`）、私たちについての `.ax-contact`、Sales X / Creative X の `.cxg-contact`（`service-group-*.html.tpl`）、拡張機能の `.ext-cta`、お問い合わせの `#contactForm`。下層ページに専用CTAを新設したら同じ属性を付ける。
- **変更するときは3か所を同じ内容にする**: 静的ページ全部（`<footer class="cx-footer">` を一括置換）、`tools/templates/c-column.html.tpl`（コラム記事の生成元）、`services/index.html`（`tools/build-services.py` がサービスページへ複製）。置換後に `python3 tools/build-services.py --check` で差分がないことを確認する。
- サービス名・遷移先は `data/services.json` と `js/nav.js` に合わせる（サービスを増減したらフッターも直す）。

## 7.4 コラム機能（2026-05-08 新設）
- 個別記事は WP CMS → `tools/build-c-columns.py` → `column/{slug}.html` で静的生成（既存）
- WP API は `?site=contentsx` フィルタで取得（`show_site` が `contentsx` または `both` の記事のみ）。⚠️ 過去に `contentx`（sなし）と誤記しC向けコラムが0件になっていた（BUGS.md #041、2026-06-12修正）
- 一覧ページ `column.html` も build-c-columns.py が自動更新（Featured 1本 + カードグリッド + カテゴリチップ + ItemList JSON-LD）
- マーカー: `<!-- BUILD:COLUMN_GRID -->` ... `<!-- /BUILD:COLUMN_GRID -->`
- `/column/` アクセス時は `column/index.html` の meta refresh で `/column` (= column.html) へ転送
- ⚠️ **2026-09-29 から導線だけ一時非表示**: 共通ナビ（`js/nav.js`）の「コラム」をコメントアウトした。一覧 `/column`・記事 `/column/{slug}`・sitemap・llms.txt・feed・WP からの自動ビルドは**そのまま公開**（URL を直接開ける・検索にも残る）。他ページからコラムへのリンクはナビの1か所だけだった。戻し方と経緯は [CORPORATE-PAGE-VISIBILITY.md](CORPORATE-PAGE-VISIBILITY.md)「コラムの導線」
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
- 会社概要 `company.html` の会社情報は480px以下で項目名と内容を縦並びにし、長い社名・事業内容の本文幅を確保する。481px以上は2列表示とする。
- 会社概要 `company.html` 左側の紹介文（`.company-description`）は2026-09-29に営業支援の訴求へ差し替え。見出し1行（h2 `.company-description-lead`「営業の悩みを、売上につながる仕組みに。」）＋本文3段落の構成で、各段落に `data-ja`/`data-en` を付ける。旧文「埋もれていた物語に、光を当てる」「人の手7割・AI3割」は会社概要から削除（`llms.txt`・`faq.html`・`i18n/en.json` には旧文が残っている＝未変更）。meta description・og/twitter・構造化データの説明文も営業支援の訴求に合わせ、ページ内フッターの英語社名は `Contents X Inc.` にした。
- 同日、右側の会社情報（`.company-info`）を「会社名／設立／資本金（1,000万円）／役員（代表取締役 黒宮 大貴・取締役 鵜池 航太）／事業内容（4行）／所在地」に更新。複数行の項目は `data-ja`/`data-en` に `<br>` を入れ、i18n が innerHTML で差し替える。社名の表記ゆれ（コンテンツエックス等）は表から外し、構造化データの `alternateName` に残している。
- UIとモーションの共通基準は [MOTION-UI-2026.md](MOTION-UI-2026.md)。下層ページは `js/sitewide-motion.js` がセクションの1回だけの登場演出を担う。JS無し・動きの軽減設定時は常時表示する。
- フォント・文字階層・色の役割・写真上の文字は [DESIGN-SYSTEM-2026.md](DESIGN-SYSTEM-2026.md) に集約。CSSの正本は `css/brand-system-2026.css`。下層ページは `css/sitewide-cohesion.css` から読み込み、トップ/サービス担当も同じ変数を使用する。通常サイズの Creative X 文字には `#b83806` を使い、鮮やかな `#fa4d12` は大きい見出しや装飾に限定する。
- 共通の小部品は `cx-ui-surface`（淡色面と枠）、`cx-ui-pill`（丸い外形）、`cx-ui-card`（カード反応）、`cx-ui-action`（操作反応）。ページ固有クラスは配置・内容を担当する。旧生成コラムカード `cx-col-card` の動きは生成テンプレート互換のため保持する。

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

## 14. 代表メッセージ独立ページ（2026-10-07）

- 正規URL: `/message`。既存の `message.html` を再利用する。新規 `company/` ディレクトリが既存の拡張子なしURL `/company` を遮らない構成。企業案内の共通ナビ、`/about#message` 内の「代表メッセージを全文読む」、TOPICSから遷移する。旧 `/message` の転送を解除し、このページを正規URLとして再公開する。
- 原稿: Git履歴 `07a92552329b2892871cc984cf46fc3127555387:message.html` の導入＋5章を全文使用。本文・見出し・企業向け/クリエイター向けの説明を改変・要約しない。日英切替でも原文の句読点・文言を保つ。
- 写真: `material/images/message-2026/portrait.webp`（支給「明るいオフィスのビジネスポートレート.png」、元ファイル `ChatGPT 画像 2026年10月7日 13_59_44-1.png`）、`team-meeting.webp`（支給「ホワイトボード前のチームミーティング.png」、元ファイル `ChatGPT 画像 2026年10月7日 14_00_10.png`）。どちらも1448×1086、支給画像をWebPへ変換。背景や人物の追加・生成・修正は行っていない。支給イメージを実際の会議記録と扱わない。会議画像は第4章の採用・仲間に関する段落の直後。
- デザイン: `css/message-2026.css`。既存の濃紺・白・Noto Sans JPと共通トークンを使用。本文760px、関連導線はPC3列/SP1列。1024px以下は画像→タイトル→本文。独自のスクロールアニメーション・固定演出は追加しない。
- 関連導線: `/about`（私たちについて）、`/company`（会社概要）、`/company#officers`（役員紹介。現在公開されている役員情報）、`/`。非表示中の `/leadership` は復元しない。
- 共通ナビの企業案内に `/message` を追加する。i18n.js → nav.js の順序を維持。
- 検証: `python3 tests/test_message.py --url http://127.0.0.1:8777`。loopback previewで原稿一致、320〜1920px・境界幅、1.4倍文字拡大、日英往復、タッチナビ、関連導線、画像比率、既存URL、JS無効/動き軽減を確認する。

### 14.1 TOPICSとの接続

- TOPICS制作PR #78を土台にする。静的フォールバックカードの代表メッセージは `/message`。
- `js/home-topics.js` は WordPress の `type: MESSAGE` かつ既知の自サイトURL（`/about#message`・`/message`・`/message.html`）だけを `/message` に揃える。言語等のクエリを保持し、外部サイトや別のMESSAGEリンクは変更しない。本番WPの書換えは不要。
- `tests/test_topics.py` の旧リンクfixtureを維持して新しい行き先を検証する。静的・WP正常・取得失敗・JS無効の各経路と実クリックを確認する。
