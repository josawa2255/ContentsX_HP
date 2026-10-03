/* Native scroll only: no wheel/touch interception, timers, or scroll locking. */
(function () {
  'use strict';
  var transition = document.querySelector('.cxha-transition');
  if (!transition) return;
  var stage = transition.querySelector('.cxha-stage');
  var frame = transition.querySelector('.cxha-hero-frame');
  var hero = frame.querySelector('.cxh-hero');
  var about = transition.querySelector('.cxha-about');
  var office = about.querySelector('.cxha-office');
  var steps = about.querySelectorAll('[data-cxha-step]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobile = window.matchMedia('(max-width: 768px)');
  var metrics;
  var raf = 0;
  var needsMeasure = true;
  var lastProgress = -1;
  var pendingHash = location.hash;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) { value = clamp(value); return value * value * (3 - 2 * value); }
  function range(p, start, end) { return ease((p - start) / (end - start)); }

  function measure() {
    var header = parseFloat(getComputedStyle(transition).getPropertyValue('--cxha-header'));
    var heroHeight = hero.offsetHeight;
    var heroWidth = hero.offsetWidth;
    var sceneHeight = Math.max(heroHeight, about.offsetHeight);
    var distance = Math.max(480, Math.min(1000, window.innerHeight * 1.15));
    transition.style.setProperty('--cxha-scene-height', sceneHeight + 'px');
    transition.style.setProperty('--cxha-distance', distance + 'px');
    transition.classList.add('cxha-ready');
    var stageRect = stage.getBoundingClientRect();
    var photoRect = office.getBoundingClientRect();
    metrics = {
      start: transition.getBoundingClientRect().top + window.scrollY - header,
      distance: distance,
      width: heroWidth, height: heroHeight,
      x: photoRect.left - stageRect.left, y: photoRect.top - stageRect.top,
      sx: photoRect.width / heroWidth, sy: photoRect.height / heroHeight
    };
    needsMeasure = false;
    lastProgress = -1;
  }

  function render() {
    raf = 0;
    if (reduced.matches) {
      transition.classList.remove('cxha-ready');
      frame.inert = false;
      frame.removeAttribute('aria-hidden');
      return;
    }
    if (needsMeasure || !metrics) measure();
    if (pendingHash === '#home-about' || pendingHash === '#hero') {
      window.scrollTo({ top:Math.max(0, metrics.start + (pendingHash === '#home-about' ? metrics.distance : 0)), behavior:'instant' });
    }
    pendingHash = '';
    var p = clamp((window.scrollY - metrics.start) / metrics.distance);
    if (p === lastProgress) return;
    lastProgress = p;
    var shrink = range(p, 0, .52);
    var move = range(p, .28, .84);
    var centerScale = 1 - .32 * shrink;
    // Uniform scaling keeps the existing X artwork undistorted during the dissolve.
    var finalScale = Math.min(metrics.sx, metrics.sy);
    var scale = centerScale + (finalScale - centerScale) * move;
    var x = metrics.width * (1 - centerScale) / 2;
    var y = metrics.height * (1 - centerScale) / 2;
    // Mobile stays on the center line, including when the photo width changes.
    var targetX = mobile.matches ? metrics.width * (1 - finalScale) / 2 : metrics.x + metrics.width * (metrics.sx - finalScale) / 2;
    var targetY = metrics.y + metrics.height * (metrics.sy - finalScale) / 2;
    x += (targetX - x) * move;
    y += (targetY - y) * move;
    transition.style.setProperty('--cxha-hero-transform', p === 0 ? 'none' : 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')');
    transition.style.setProperty('--cxha-compositing', p > 0 && p < 1 ? 'transform,opacity' : 'auto');
    transition.style.setProperty('--cxha-copy-opacity', 1 - range(p, .08, .35));
    transition.style.setProperty('--cxha-hero-opacity', 1 - range(p, .54, .94));
    transition.style.setProperty('--cxha-wordmark', range(p, .12, .4));
    transition.style.setProperty('--cxha-office', range(p, .54, .94));
    transition.style.setProperty('--cxha-about-pointer', p >= .35 ? 'auto' : 'none');
    // Heading → main visual (office, .54–.94) → Purpose/Company links → business cards.
    var timings = { label:[.26,.48], heading:[.34,.58], body:[.44,.7], links:[.62,.9], values:[.72,.98] };
    steps.forEach(function (node) {
      var timing = timings[node.dataset.cxhaStep];
      node.style.setProperty('--cxha-step', range(p, timing[0], timing[1]));
    });
    // Invisible Hero links must not intercept pointer or keyboard input.
    frame.inert = p >= .35;
    if (p >= .94) frame.setAttribute('aria-hidden', 'true');
    else frame.removeAttribute('aria-hidden');
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(render); }
  function refresh() { needsMeasure = true; schedule(); }
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', refresh, { passive:true });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('hashchange', function () { pendingHash = location.hash; schedule(); });
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest('a[href="#hero"], a[href="#home-about"]');
    if (!anchor || reduced.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (needsMeasure || !metrics) measure();
    var hash = anchor.getAttribute('href');
    if (location.hash !== hash) history.pushState(null, '', hash);
    window.scrollTo({ top:Math.max(0, metrics.start + (hash === '#home-about' ? metrics.distance : 0)), behavior:'smooth' });
  });
  reduced.addEventListener('change', refresh);
  mobile.addEventListener('change', refresh);
  document.addEventListener('i18n-lang-changed', refresh);
  // Reflow (fonts, text zoom, translation) changes the photo destination.
  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(refresh);
    observer.observe(hero);
    observer.observe(about);
  }
  if (document.fonts) document.fonts.ready.then(refresh);
  schedule();
})();
