/* Native scroll only: no wheel/touch interception, timers, or scroll locking. */
(function () {
  'use strict';
  var transition = document.querySelector('.cxha-transition');
  if (!transition) return;
  var stage = transition.querySelector('.cxha-stage');
  var frame = transition.querySelector('.cxha-hero-frame');
  var hero = frame.querySelector('.cxh-hero');
  var visual = hero.querySelector('.cxh-hero-visual');
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
  // Starts at scroll speed (no dead zone) and settles softly onto the photo.
  function follow(value) { value = clamp(value); return value + value * value - value * value * value; }
  function lerp(from, to, t) { return from + (to - from) * t; }

  // Scroll share per phase. The Hero becomes the main visual in one move (0 → morphEnd),
  // the photo is fully in place underneath before the aligned Hero dissolves away.
  var PC = { distance:1.15, morphEnd:.78, clipCurve:1.4, copy:[.1,.4], wordmark:[.12,.4], office:[.6,.8], hero:[.78,.96],
    steps:{ heading:[.24,.48], body:[.34,.58], links:[.66,.9], values:[.74,.98] } };
  // SP: the photo window is near the Hero's width, so the move is mostly vertical and shorter.
  var SP = { distance:1, morphEnd:.76, clipCurve:1, copy:[.1,.38], wordmark:[.12,.4], office:[.58,.78], hero:[.76,.95],
    steps:{ heading:[.22,.46], body:[.32,.56], links:[.62,.88], values:[.72,.98] } };

  function measure() {
    var tune = mobile.matches ? SP : PC;
    var header = parseFloat(getComputedStyle(transition).getPropertyValue('--cxha-header'));
    var heroHeight = hero.offsetHeight;
    var heroWidth = hero.offsetWidth;
    // ABOUT fills at least one screen, so the pinned stage never shows an empty white band below it.
    // The Hero may be taller; its lower part is only visible while it is shrinking inside the stage.
    var fill = Math.max(0, window.innerHeight - header);
    transition.style.setProperty('--cxha-about-min', fill + 'px');
    var sceneHeight = Math.max(fill, about.offsetHeight);
    var distance = Math.max(480, Math.min(1000, window.innerHeight * tune.distance));
    transition.style.setProperty('--cxha-scene-height', sceneHeight + 'px');
    transition.style.setProperty('--cxha-distance', distance + 'px');
    transition.classList.add('cxha-ready');
    var stageRect = stage.getBoundingClientRect();
    var photoRect = office.getBoundingClientRect();
    // Crop window inside the Hero (unscaled Hero coordinates): the largest area with the photo's
    // aspect ratio, centred on the Hero artwork. On SP the artwork starts at 41%, so the plain
    // upper part is cropped away instead of shrinking into an empty box.
    var aspect = photoRect.width / photoRect.height;
    var top = Math.max(0, Math.min(heroHeight, visual.offsetTop));
    var areaHeight = Math.max(1, Math.min(heroHeight, visual.offsetTop + visual.offsetHeight) - top);
    var cropWidth = Math.min(heroWidth, heroHeight * aspect);
    var cropHeight = cropWidth / aspect;
    var cropX = (heroWidth - cropWidth) / 2;
    var cropY = Math.max(0, Math.min(heroHeight - cropHeight, top + (areaHeight - cropHeight) / 2));
    var scale = photoRect.width / cropWidth;
    metrics = {
      tune: tune,
      start: transition.getBoundingClientRect().top + window.scrollY - header,
      distance: distance,
      width: heroWidth, height: heroHeight,
      crop: [cropY, heroWidth - cropX - cropWidth, heroHeight - cropY - cropHeight, cropX],
      scale: scale,
      radius: parseFloat(getComputedStyle(office).borderTopLeftRadius) || 0,
      x: photoRect.left - stageRect.left - cropX * scale,
      y: photoRect.top - stageRect.top - cropY * scale
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
    var tune = metrics.tune;
    // One progress value drives scale, position and crop together, so the path never changes course.
    var m = follow(p / tune.morphEnd);
    // The crop closes slightly behind the shrink, keeping the Hero copy readable while it fades.
    var c = Math.pow(m, tune.clipCurve);
    var scale = lerp(1, metrics.scale, m);
    var crop = metrics.crop.map(function (edge) { return (edge * c).toFixed(2) + 'px'; });
    // Rounded corners reach the photo's on-screen radius exactly when the two overlap.
    var radius = (metrics.radius * c / scale).toFixed(2);
    transition.style.setProperty('--cxha-hero-transform', p === 0 ? 'none' : 'translate(' + lerp(0, metrics.x, m) + 'px,' + lerp(0, metrics.y, m) + 'px) scale(' + scale + ')');
    transition.style.setProperty('--cxha-hero-clip', p === 0 ? 'none' : 'inset(' + crop.join(' ') + ' round ' + radius + 'px)');
    transition.style.setProperty('--cxha-compositing', p > 0 && p < 1 ? 'transform,opacity' : 'auto');
    transition.style.setProperty('--cxha-copy-opacity', 1 - range(p, tune.copy[0], tune.copy[1]));
    // The photo is complete underneath before the aligned Hero starts to dissolve: no see-through dip.
    transition.style.setProperty('--cxha-hero-opacity', 1 - range(p, tune.hero[0], tune.hero[1]));
    transition.style.setProperty('--cxha-wordmark', range(p, tune.wordmark[0], tune.wordmark[1]));
    transition.style.setProperty('--cxha-office', range(p, tune.office[0], tune.office[1]));
    transition.style.setProperty('--cxha-about-pointer', p >= .35 ? 'auto' : 'none');
    // Heading (overlaps the fading Hero copy) → body → main visual → Purpose/Company links → business cards.
    steps.forEach(function (node) {
      var timing = tune.steps[node.dataset.cxhaStep];
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
