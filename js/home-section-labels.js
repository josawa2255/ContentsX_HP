/* Fixed section names (Issue #89 / #93). Copies the section names into every backdrop and marks the
   name of the section under a line 40% down the screen as current. CSS fixes them to the screen and
   fades between them (0.2s). Without JS the names scroll with their sections as before.
   Passive scroll + requestAnimationFrame, no scroll locking. */
(function () {
  'use strict';
  var LINE = 0.4; // share of the screen height where the current section is read
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cxsb-section'))
    .filter(function (s) { return s.id && s.querySelector(':scope > .cxsb-label') && s.querySelector(':scope > .cxsb-backdrop'); });
  if (!sections.length) return;
  var names = sections.map(function (s) {
    return { id: s.id, text: s.querySelector(':scope > .cxsb-label').textContent.trim() };
  });
  var spans = [];
  sections.forEach(function (s) {
    var layer = document.createElement('div');
    layer.className = 'cxsb-names';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-i18n-skip', '');
    names.forEach(function (n) {
      var span = document.createElement('span');
      span.className = 'cxsb-name';
      span.setAttribute('data-for', n.id);
      span.textContent = n.text;
      layer.appendChild(span);
      spans.push(span);
    });
    s.querySelector(':scope > .cxsb-backdrop').appendChild(layer);
  });
  document.documentElement.classList.add('cxsb-fixed-labels');

  var current = null;
  var raf = 0;
  function update() {
    raf = 0;
    var y = window.innerHeight * LINE;
    var next = '';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (!s.getClientRects().length) continue; // hidden section
      var r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { next = s.id; break; }
    }
    if (next === current) return;
    current = next;
    spans.forEach(function (span) { span.classList.toggle('is-current', span.getAttribute('data-for') === current); });
  }
  function schedule() { if (!raf) raf = window.requestAnimationFrame(update); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  schedule();
})();
