/* Small enhancement only. Copy is always visible, even without JavaScript. */
(() => {
  'use strict';
  const story = document.querySelector('.ap-story');
  if (!story) return;
  const chapters = [...story.querySelectorAll('[data-story]')];
  const links = [...story.querySelectorAll('.ap-story-index a')];
  const captions = [...story.querySelectorAll('[data-story-caption]')];
  let pending = false;
  let previous = -1;
  function update() {
    pending = false;
    const line = Math.min(innerHeight * .45, 420);
    let active = 0;
    chapters.forEach((chapter, index) => {
      if (chapter.getBoundingClientRect().top <= line) active = index;
    });
    if (previous === active) return;
    previous = active;
    story.classList.toggle('is-chapter-1', active === 1);
    story.classList.toggle('is-chapter-2', active === 2);
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    captions.forEach((caption, index) => { caption.hidden = index !== active; });
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('pageshow', schedule);
  document.addEventListener('i18n-lang-changed', schedule);
  update();
})();
