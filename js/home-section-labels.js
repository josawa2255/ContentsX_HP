/* Fixed section names (Issue #89 / #93). Copies the section names into every backdrop and marks the
   name of the section under a line 40% down the screen as current. CSS fixes them to the screen and
   fades between them (0.2s). Without JS the names scroll with their sections as before.
   Passive scroll + requestAnimationFrame, no scroll locking.
   Shared with /recruit (#135): sections that sit on one shared background instead of their own
   .cxsb-backdrop opt in with data-cxsb-name="NAME" and draw into the closest [data-cxsb-names-host]
   (the recruit page's sticky .rc-stage__bg). Pages without these attributes behave exactly as before. */
(function () {
  'use strict';
  var LINE = 0.4; // share of the screen height where the current section is read
  var entries = [];
  Array.prototype.forEach.call(document.querySelectorAll('.cxsb-section, [data-cxsb-name]'), function (s) {
    if (!s.id) return;
    var own = s.querySelector(':scope > .cxsb-label');
    var backdrop = s.querySelector(':scope > .cxsb-backdrop');
    if (own && backdrop) {
      entries.push({ el: s, id: s.id, text: own.textContent.trim(), host: backdrop });
    } else if (s.hasAttribute('data-cxsb-name')) {
      var host = s.closest('[data-cxsb-names-host-scope]');
      host = host && host.querySelector('[data-cxsb-names-host]');
      if (host) entries.push({ el: s, id: s.id, text: s.getAttribute('data-cxsb-name'), host: host });
    }
  });
  if (!entries.length) return;
  var sections = entries.map(function (e) { return e.el; });
  var hosts = [];
  entries.forEach(function (e) { if (hosts.indexOf(e.host) === -1) hosts.push(e.host); });

  var spans = [];
  hosts.forEach(function (host) {
    var layer = document.createElement('div');
    layer.className = 'cxsb-names';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-i18n-skip', '');
    entries.forEach(function (n) {
      var span = document.createElement('span');
      span.className = 'cxsb-name';
      span.setAttribute('data-for', n.id);
      span.textContent = n.text;
      layer.appendChild(span);
      spans.push(span);
    });
    host.appendChild(layer);
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
