/* Quiet, one-time reveals for Contents X pages outside Home and Services.
   The page stays fully readable if this script or IntersectionObserver is absent. */
(function () {
  'use strict';

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var selector = [
    '.ab-section-head', '.ab-statement', '.ab-biz-grid', '.ab-global-grid',
    '.ab-related-grid', '.ab-cta-message-inner',
    '.ax-panel-copy', '.ax-purpose-card', '.ax-value-card',
    '.ax-message-copy', '.ax-portrait', '.ax-contact-inner',
    '.ot-section > h2', '.ot-section-alt h2', '.ot-lead', '.ot-values-grid',
    '.ot-paths', '.ot-closing',
    '.company-info', '.leader-card', '.partners-cards', '.partners-recruit',
    '.rc-section-title', '.rc-pos-cards', '.rc-flow',
    '.cx-col-featured-card', '.cx-col-grid', '.cx-col-toc', '.cx-col-cta',
    '.news-list', '.faq-list', '.faq-cta', '.legal-page h2'
  ].join(',');

  function start() {
    var body = document.body;
    if (!body || !body.classList.contains('cx-sitewide') ||
        motionQuery.matches || !('IntersectionObserver' in window)) return;

    var seen = new WeakSet();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('cx-motion-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    function add(element) {
      if (seen.has(element) || element.closest('[hidden], .dl-modal')) return;
      seen.add(element);
      /* First-screen content must never wait for scroll or a delayed observer. */
      if (element.getBoundingClientRect().top < window.innerHeight * 0.96) return;
      element.classList.add('cx-motion-pending');
      observer.observe(element);
    }

    function scan(root) {
      if (root.nodeType !== 1) return;
      if (root.matches(selector)) add(root);
      root.querySelectorAll(selector).forEach(add);
    }

    scan(body);
    /* News and column cards can arrive after WordPress data loads. */
    var mutations = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(scan);
      });
    });
    mutations.observe(body, { childList: true, subtree: true });

    function showAllForReducedMotion() {
      if (!motionQuery.matches) return;
      observer.disconnect();
      mutations.disconnect();
      body.querySelectorAll('.cx-motion-pending').forEach(function (node) {
        node.classList.add('cx-motion-visible');
      });
    }
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', showAllForReducedMotion, { once: true });
    } else if (motionQuery.addListener) {
      motionQuery.addListener(showAllForReducedMotion);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
