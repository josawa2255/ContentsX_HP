/* Hero → About hand-off (Issue #59; fade hand-off since Issue #108). Native scroll only: no
   wheel/touch interception, timers, or scroll locking.
   While the stage is pinned, one progress value (0 → 1) drives everything: the Hero copy fades, the
   three cards shrink slightly and recede upwards as they fade, then the whole Hero dissolves while
   ABOUT's heading, text, photo and links come in underneath. The photo grows from 96% to 100%.
   When the Hero is taller than the screen (tablet/SP), it first scrolls normally until its bottom is
   in view (--cxha-overflow); only then does the stage pin and the hand-off start, so the cards at
   the bottom of the Hero are never faded before they have been seen.
   Fires `cxha:hero` on document ({ active }) when the Hero stops / starts being the scene, so the
   Hero's video can stop (js/home-hero.js). */
(function () {
  'use strict';
  var transition = document.querySelector('.cxha-transition');
  if (!transition) return;
  var stage = transition.querySelector('.cxha-stage');
  var frame = transition.querySelector('.cxha-hero-frame');
  var hero = frame.querySelector('.cxh-hero');
  var about = transition.querySelector('.cxha-about');
  var steps = about.querySelectorAll('[data-cxha-step]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobile = window.matchMedia('(max-width: 768px)');
  var metrics;
  var raf = 0;
  var needsMeasure = true;
  var lastProgress = -1;
  var heroActive = true;
  var pendingHash = location.hash;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function ease(value) { value = clamp(value); return value * value * (3 - 2 * value); }
  function range(p, start, end) { return ease((p - start) / (end - start)); }

  // Scroll share per phase. The Hero is fully gone at `hero[1]`; ABOUT finishes by the end.
  var PC = { distance:1, copy:[.04,.3], cards:[.04,.62], cardsFade:[.22,.6], shift:-64, hero:[.32,.64], wordmark:[.3,.6], office:[.46,.76],
    steps:{ heading:[.34,.6], body:[.42,.68], links:[.6,.86], values:[.68,.96] } };
  var SP = { distance:.85, copy:[.04,.28], cards:[.04,.6], cardsFade:[.2,.58], shift:-36, hero:[.3,.62], wordmark:[.3,.58], office:[.44,.74],
    steps:{ heading:[.32,.58], body:[.4,.66], links:[.58,.84], values:[.66,.95] } };

  function measure() {
    var tune = mobile.matches ? SP : PC;
    var header = parseFloat(getComputedStyle(transition).getPropertyValue('--cxha-header'));
    // ABOUT fills at least one screen, so the pinned stage never shows an empty white band below it.
    var fill = Math.max(0, window.innerHeight - header);
    transition.style.setProperty('--cxha-about-min', fill + 'px');
    var overflow = Math.max(0, Math.round(hero.offsetHeight - fill));
    transition.style.setProperty('--cxha-overflow', overflow + 'px');
    // Set every size first and only then switch to the pinned layout: a pinned stage without sizes
    // briefly puts the ABOUT snap point at the top, and scroll snapping would follow it down.
    var sceneHeight = Math.max(hero.offsetHeight, overflow + Math.max(fill, about.offsetHeight));
    var distance = Math.max(420, Math.min(900, window.innerHeight * tune.distance));
    transition.style.setProperty('--cxha-scene-height', sceneHeight + 'px');
    transition.style.setProperty('--cxha-distance', distance + 'px');
    transition.classList.add('cxha-ready');
    var top = transition.getBoundingClientRect().top + window.scrollY - header;
    metrics = { tune: tune, top: top, start: top + overflow, distance: distance };
    needsMeasure = false;
    lastProgress = -1;
  }
  function report(active) {
    if (active === heroActive) return;
    heroActive = active;
    document.dispatchEvent(new CustomEvent('cxha:hero', { detail: { active: active } }));
  }

  function render() {
    raf = 0;
    if (reduced.matches) {
      transition.classList.remove('cxha-ready');
      frame.inert = false;
      frame.removeAttribute('aria-hidden');
      report(true);
      return;
    }
    if (needsMeasure || !metrics) measure();
    if (pendingHash === '#home-about' || pendingHash === '#hero') {
      window.scrollTo({ top:Math.max(0, pendingHash === '#home-about' ? metrics.start + metrics.distance : metrics.top), behavior:'instant' });
    }
    pendingHash = '';
    var p = clamp((window.scrollY - metrics.start) / metrics.distance);
    // "Left the Hero" once the hand-off is clearly under way (a small reflow, e.g. the Hero video
    // opening on a phone, must not count as leaving).
    report(p < .2);
    if (p === lastProgress) return;
    lastProgress = p;
    var tune = metrics.tune;
    var k = range(p, tune.cards[0], tune.cards[1]);
    transition.style.setProperty('--cxha-compositing', p > 0 && p < 1 ? 'transform,opacity' : 'auto');
    transition.style.setProperty('--cxha-copy-opacity', 1 - range(p, tune.copy[0], tune.copy[1]));
    // Cards: a little smaller and further back (upwards) as they fade.
    transition.style.setProperty('--cxha-cards-scale', (1 - .12 * k).toFixed(4));
    transition.style.setProperty('--cxha-cards-shift', (tune.shift * k).toFixed(2) + 'px');
    transition.style.setProperty('--cxha-cards-opacity', (1 - range(p, tune.cardsFade[0], tune.cardsFade[1])).toFixed(4));
    transition.style.setProperty('--cxha-hero-opacity', 1 - range(p, tune.hero[0], tune.hero[1]));
    transition.style.setProperty('--cxha-wordmark', range(p, tune.wordmark[0], tune.wordmark[1]));
    transition.style.setProperty('--cxha-office', range(p, tune.office[0], tune.office[1]));
    transition.style.setProperty('--cxha-about-pointer', p >= .4 ? 'auto' : 'none');
    // Heading → body → main visual → Purpose/Company links → business cards.
    steps.forEach(function (node) {
      var timing = tune.steps[node.dataset.cxhaStep];
      node.style.setProperty('--cxha-step', range(p, timing[0], timing[1]));
    });
    // Fading Hero links must not intercept pointer or keyboard input.
    frame.inert = p >= .3;
    if (p >= tune.hero[1]) frame.setAttribute('aria-hidden', 'true');
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
    window.scrollTo({ top:Math.max(0, hash === '#home-about' ? metrics.start + metrics.distance : metrics.top), behavior:'smooth' });
  });
  reduced.addEventListener('change', refresh);
  mobile.addEventListener('change', refresh);
  document.addEventListener('i18n-lang-changed', refresh);
  // Reflow (fonts, text zoom, translation, the Hero video opening) changes the scene height.
  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(refresh);
    observer.observe(hero);
    observer.observe(about);
  }
  if (document.fonts) document.fonts.ready.then(refresh);
  schedule();
})();
