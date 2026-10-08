/* Fixed section names (Issue #89): marks the big name of the section that fully contains it as
   current. CSS fixes the names to the screen and fades between them; without JS they scroll with
   their sections as before. Passive scroll + requestAnimationFrame, no scroll locking. */
(function () {
  'use strict';
  var labels = Array.prototype.slice.call(document.querySelectorAll('.cxsb-section > .cxsb-label'));
  if (!labels.length) return;
  document.documentElement.classList.add('cxsb-fixed-labels');
  var raf = 0;
  function update() {
    raf = 0;
    labels.forEach(function (label) {
      var section = label.parentElement;
      if (!section.getClientRects().length) { label.classList.remove('is-current'); return; } // hidden section
      var s = section.getBoundingClientRect();
      var l = label.getBoundingClientRect();
      label.classList.toggle('is-current', s.top <= l.top + 1 && s.bottom >= l.bottom - 1);
    });
  }
  function schedule() { if (!raf) raf = window.requestAnimationFrame(update); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
