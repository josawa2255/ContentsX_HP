/* Motion for the 2026 Contents X homepage. Content is visible when JS is off. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;
  root.classList.add('cxh-motion-ready');

  function start() {
    var targets = document.querySelectorAll('[data-cxh-reveal], [data-cxh-curtain]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (node) { node.classList.add('cxh-in-view'); });
      document.body.classList.add('cxh-loaded');
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('cxh-in-view');
        entry.target.querySelectorAll('[data-cxh-curtain]').forEach(function (node) {
          node.classList.add('cxh-in-view');
        });
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.04 });
    targets.forEach(function (node) {
      /* An element clipped to zero width cannot intersect; watch its container. */
      observer.observe(node.hasAttribute('data-cxh-curtain') ? node.parentElement : node);
    });
    requestAnimationFrame(function () {
      document.body.classList.add('cxh-loaded');
      document.querySelectorAll('.cxh-hero [data-cxh-reveal]').forEach(function (node) {
        node.classList.add('cxh-in-view');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
