  <section class="cxs-detail-hero" data-group="{{GROUP_ID}}" aria-labelledby="cxsDetailTitle">
    <div class="cxs-container">
      <nav class="cxs-breadcrumbs" aria-label="パンくずリスト">
        <ol><li><a href="/">ホーム</a></li><li><a href="/services/">サービス</a></li><li aria-current="page">{{NAME}}</li></ol>
      </nav>
      <div class="cxs-detail-hero__grid">
        <div class="cxs-detail-hero__copy">
          <p class="cxs-eyebrow">{{EYEBROW}}</p>
          <div class="cxs-detail-hero__title-row">{{ICON}}<h1 id="cxsDetailTitle">{{NAME}}</h1></div>
          <p class="cxs-detail-hero__tagline">{{SHORT_COPY}}</p>
          <p class="cxs-detail-hero__description">{{SUMMARY}}</p>
          {{TAGS}}
          <div class="cxs-detail-hero__actions"><a class="cxs-button" href="/contact">お問い合わせ <span aria-hidden="true">→</span></a><a class="cxs-button cxs-button--outline" href="/services/">サービス一覧へ</a></div>
        </div>
        <div class="cxs-detail-hero__visual">{{VISUAL_ICON}}</div>
      </div>
    </div>
  </section>
  {{DETAIL_SECTIONS}}
