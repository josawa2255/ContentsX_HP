<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms https://cms.contentsx.jp https://fonts.googleapis.com https://js.hubspot.com https://js.hs-scripts.com https://js.hs-analytics.net https://js.hs-banner.com https://forms.hsforms.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: wss:; frame-src https: data:; object-src 'none'; base-uri 'self'">
  <meta http-equiv="Permissions-Policy" content="interest-cohort=(), browsing-topics=()">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <!-- Google tag (gtag.js) - GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-B000C4JCCX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-B000C4JCCX');
  </script>
  <!-- Microsoft Clarity -->
  <script type="text/javascript">
  (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wd1694xs70");
  </script>
  <title>{{TITLE}}</title>
  <meta name="description" content="{{DESCRIPTION}}">
  <link rel="canonical" href="https://contentsx.jp/column/{{SLUG}}">
  <link rel="alternate" hreflang="ja" href="https://contentsx.jp/column/{{SLUG}}">
  <link rel="alternate" hreflang="en" href="https://contentsx.jp/column/{{SLUG}}?lang=en">
  <link rel="alternate" hreflang="x-default" href="https://contentsx.jp/column/{{SLUG}}">
  <!-- OG tags -->
  <meta property="og:title" content="{{TITLE}}">
  <meta property="og:description" content="{{DESCRIPTION}}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://contentsx.jp/column/{{SLUG}}">
  <meta property="og:site_name" content="ContentsX">
  <meta property="og:image" content="{{THUMBNAIL}}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{{TITLE_SHORT}}">
  <meta property="og:locale" content="ja_JP">
  <meta property="article:published_time" content="{{DATE_PUBLISHED}}">
  <meta property="article:modified_time" content="{{DATE_MODIFIED}}">
  <meta property="article:section" content="{{CATEGORY}}">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@Bizmanga_">
  <meta name="twitter:title" content="{{TITLE}}">
  <meta name="twitter:description" content="{{DESCRIPTION}}">
  <meta name="twitter:image" content="{{THUMBNAIL}}">
  <!-- JSON-LD: Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": "https://contentsx.jp/column/{{SLUG}}#article",
    "headline": "{{TITLE_SHORT}}",
    "description": "{{DESCRIPTION}}",
    "image": "{{THUMBNAIL}}",
    "datePublished": "{{DATE_PUBLISHED}}",
    "dateModified": "{{DATE_MODIFIED}}",
    "author": {
      "@type": "Organization",
      "@id": "https://contentsx.jp/#organization",
      "name": "ContentsX編集部",
      "url": "https://contentsx.jp/"
    },
    "publisher": { "@id": "https://contentsx.jp/#organization" },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://contentsx.jp/column/{{SLUG}}"
    },
    "articleSection": "{{CATEGORY}}",
    "inLanguage": "ja-JP"
  }
  </script>
  <!-- JSON-LD: Breadcrumb -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://contentsx.jp/" },
      { "@type": "ListItem", "position": 2, "name": "コラム", "item": "https://contentsx.jp/news" },
      { "@type": "ListItem", "position": 3, "name": "{{TITLE_SHORT}}", "item": "https://contentsx.jp/column/{{SLUG}}" }
    ]
  }
  </script>
  <!-- favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/webp" href="/material/images/logo/contentsx-icon.webp">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#b85a2b">
  <!-- Fonts & CSS -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@400;700;900&display=swap">
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .cx-col-page { background: #fff; }
    .cx-col-hero { position: relative; min-height: 420px; display: flex; align-items: center; justify-content: center; padding: 80px 24px 60px; background: linear-gradient(135deg, #1a1a1a 0%, #2a1a0f 100%); color: #fff; overflow: hidden; }
    .cx-col-hero::before { content: ''; position: absolute; inset: 0; background: url('{{THUMBNAIL}}') center/cover; opacity: 0.35; filter: blur(2px); }
    .cx-col-hero-inner { position: relative; max-width: 880px; text-align: center; }
    .cx-col-hero-cat { display: inline-block; padding: 6px 16px; background: rgba(184, 90, 43, 0.9); color: #fff; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 20px; }
    .cx-col-hero h1 { font-family: 'Noto Serif JP', serif; font-size: clamp(22px, 4vw, 36px); font-weight: 900; line-height: 1.5; margin-bottom: 24px; color: #fff; }
    .cx-col-hero-meta { font-size: 13px; color: rgba(255,255,255,0.7); letter-spacing: 0.05em; }
    .cx-col-body { max-width: 760px; margin: 0 auto; padding: 60px 24px 80px; font-size: 16px; line-height: 1.95; color: #2a2520; }
    .cx-col-body h2 { font-family: 'Noto Serif JP', serif; font-size: 24px; font-weight: 900; color: #1a1a1a; margin: 48px 0 20px; padding-bottom: 12px; border-bottom: 3px solid #b85a2b; }
    .cx-col-body h3 { font-size: 19px; font-weight: 700; color: #1a1a1a; margin: 32px 0 14px; padding-left: 14px; border-left: 4px solid #b85a2b; }
    .cx-col-body p { margin-bottom: 20px; }
    .cx-col-body img { max-width: 100%; height: auto; display: block; margin: 32px auto; border-radius: 8px; }
    .cx-col-body ul, .cx-col-body ol { margin: 16px 0 20px 24px; }
    .cx-col-body li { margin-bottom: 8px; }
    .cx-col-body a { color: #b85a2b; text-decoration: underline; text-underline-offset: 3px; }
    .cx-col-body a:hover { color: #8a4520; }
    .cx-col-body strong { color: #b85a2b; font-weight: 700; }
    .cx-col-body blockquote { border-left: 4px solid #b85a2b; background: #faf7f2; padding: 16px 20px; margin: 24px 0; font-style: italic; color: #555; }
    .cx-col-cta { max-width: 760px; margin: 40px auto 0; padding: 40px 32px; background: linear-gradient(135deg, #b85a2b 0%, #d17a4a 100%); border-radius: 16px; color: #fff; text-align: center; }
    .cx-col-cta h3 { font-size: 22px; font-weight: 900; margin-bottom: 12px; color: #fff; border: 0; padding: 0; }
    .cx-col-cta p { font-size: 14px; opacity: 0.95; margin-bottom: 24px; }
    .cx-col-cta-btn { display: inline-block; padding: 14px 36px; background: #fff; color: #b85a2b; border-radius: 100px; font-weight: 700; font-size: 15px; text-decoration: none; transition: all 0.2s; }
    .cx-col-cta-btn:hover { background: #1a1a1a; color: #fff; }
    .cx-col-related { max-width: 960px; margin: 60px auto 40px; padding: 0 24px; }
    .cx-col-related h2 { font-family: 'Noto Serif JP', serif; font-size: 22px; font-weight: 900; margin-bottom: 24px; text-align: center; border-bottom: 3px solid #b85a2b; display: inline-block; padding-bottom: 8px; }
    .cx-col-related-head { text-align: center; margin-bottom: 32px; }
    .cx-col-related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
    .cx-col-related-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: transform 0.2s; text-decoration: none; color: inherit; display: block; }
    .cx-col-related-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(184, 90, 43, 0.15); }
    .cx-col-related-card-img { aspect-ratio: 16/9; background: #f5f3ee; overflow: hidden; }
    .cx-col-related-card-img img { width: 100%; height: 100%; object-fit: cover; }
    .cx-col-related-card-body { padding: 16px 18px 18px; }
    .cx-col-related-card-cat { font-size: 11px; color: #b85a2b; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.05em; }
    .cx-col-related-card-title { font-size: 14px; font-weight: 700; line-height: 1.5; color: #1a1a1a; }
    @media (max-width: 640px) { .cx-col-hero { min-height: 320px; padding: 60px 20px 40px; } .cx-col-body { padding: 40px 20px 60px; font-size: 15px; } .cx-col-body h2 { font-size: 20px; } }
  </style>
  <link rel="alternate" type="application/rss+xml" title="ContentsX RSS" href="https://contentsx.jp/feed.xml">
</head>
<body class="cx-col-page">

  <!-- ===== Header ===== -->
  <header class="header" id="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img width="180" height="36" src="/material/images/logo/ContentsX.webp" alt="ContentsX" class="logo-img">
      </a>
      <nav class="nav" id="nav"><!-- nav.js が生成 --></nav>
      <div class="header-right">
        <button class="hamburger" id="hamburger" aria-label="メニュー">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <!-- ===== Hero ===== -->
  <section class="cx-col-hero">
    <div class="cx-col-hero-inner">
      <span class="cx-col-hero-cat">{{CATEGORY}}</span>
      <h1>{{TITLE_SHORT}}</h1>
      <p class="cx-col-hero-meta">{{DATE_DISPLAY}} · ContentsX編集部</p>
    </div>
  </section>

  <!-- ===== Article Body ===== -->
  <article class="cx-col-body">
    {{CONTENT}}

    <!-- CTA -->
    <section class="cx-col-cta">
      <h3>ビジネス漫画制作のご相談はContentsXへ</h3>
      <p>マンガ・Webtoon・動画・IP開発まで、企業の「伝える」をワンストップでサポート。<br>初回相談は完全無料、業界屈指のクリエイター陣がお応えします。</p>
      <a href="/contact" class="cx-col-cta-btn">無料相談・お問い合わせ →</a>
    </section>
  </article>

  <!-- ===== Related Articles ===== -->
  <section class="cx-col-related">
    <div class="cx-col-related-head">
      <h2>関連記事</h2>
    </div>
    <div class="cx-col-related-grid">
      {{RELATED_CARDS}}
    </div>
  </section>

  <!-- ===== Footer ===== -->
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-nav">
        <ul>
          <li><a href="/">ホーム</a></li>
          <li><a href="/about">会社について</a></li>
          <li><a href="/message">代表メッセージ</a></li>
          <li><a href="/leadership">経営陣</a></li>
          <li><a href="/news">ニュース</a></li>
          <li><a href="/faq">よくある質問</a></li>
          <li><a href="/contact">お問い合わせ</a></li>
          <li><a href="/privacy">プライバシーポリシー</a></li>
        </ul>
      </div>
      <div class="footer-company">Contents X 株式会社 ／ 東京都目黒区中目黒1-8-8 目黒F2ビル1F</div>
      <div class="footer-copy">&copy; 2026 Contents X Co., Ltd. All Rights Reserved.</div>
    </div>
  </footer>

  <!-- Scripts -->
  <script src="/js/i18n.js" defer></script>
  <script src="/js/nav.js" defer></script>
</body>
</html>
