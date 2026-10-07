/* Only the Hero and meeting photo reveal. Every paragraph stays stationary. */
(function () {
  'use strict';
  var items = Array.from(document.querySelectorAll('.cm-hero [data-cm-reveal], .cm-team[data-cm-reveal]'));
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var observer;

  function show(item) {
    item.classList.add('cm-visible');
    if (observer) observer.unobserve(item);
  }

  function showAll() {
    if (observer) observer.disconnect();
    items.forEach(function (item) {
      item.classList.remove('cm-reveal-ready');
      item.classList.add('cm-visible');
    });
  }

  if (motion.matches || !('IntersectionObserver' in window)) return;
  try {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    items.forEach(function (item) {
      observer.observe(item);
      item.classList.add('cm-reveal-ready');
    });
  } catch (error) {
    showAll();
    return;
  }
  // Keyboard navigation and a motion preference change reveal content immediately.
  document.addEventListener('focusin', function (event) {
    var item = event.target.closest('[data-cm-reveal]');
    if (item) show(item);
  });
  motion.addEventListener('change', function (event) {
    if (event.matches) showAll();
  });
}());
