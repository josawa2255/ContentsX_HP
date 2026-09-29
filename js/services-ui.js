/* Progressive enhancement for service cards and detail tabs. */
(() => {
  document.documentElement.classList.add('cxs-js');
  document.addEventListener('click', (event) => {
    const expand = event.target.closest('.cxs-card__expand');
    const close = event.target.closest('.cxs-card__close');
    const control = expand || close;
    if (!control) return;
    const card = control.closest('.cxs-card');
    const expanded = Boolean(expand);
    card.dataset.expanded = String(expanded);
    card.querySelector('.cxs-card__expand').setAttribute('aria-expanded', String(expanded));
    if (!expanded) card.querySelector('.cxs-card__expand').focus();
  });

  for (const tablist of document.querySelectorAll('.cxs-tabs[role="tablist"]')) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const select = (selected, focus = false) => {
      for (const tab of tabs) {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      }
      if (focus) selected.focus();
    };
    if (!tabs.length) continue;
    select(tabs[0]);
    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab && tablist.contains(tab)) select(tab);
    });
    tablist.addEventListener('keydown', (event) => {
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      let next;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next], true);
    });
  }
})();
