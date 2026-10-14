(() => {
  'use strict';
  const names = { a: 'エディトリアル', b: 'ストーリー', c: 'ブランドビジュアル' };
  const frame = document.getElementById('preview-frame');
  const canvas = document.querySelector('.apr-canvas');
  const viewport = document.querySelector('.apr-viewport');
  let pattern = 'a';
  let device = 'pc';
  function resize() {
    const width = device === 'pc' ? 1440 : 390;
    const height = device === 'pc' ? 1000 : 844;
    const available = viewport.clientWidth - parseFloat(getComputedStyle(viewport).paddingLeft) * 2;
    const scale = Math.min(1, available / width);
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    frame.width = width;
    frame.height = height;
    frame.style.transform = `scale(${scale})`;
    frame.title = `${pattern.toUpperCase()}案の${device === 'pc' ? 'PC' : 'スマホ'}プレビュー`;
  }
  document.querySelectorAll('[data-pattern]').forEach(button => {
    button.addEventListener('click', () => {
      pattern = button.dataset.pattern;
      document.querySelectorAll('[data-pattern]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      document.getElementById('preview-title').textContent = `${pattern.toUpperCase()}：${names[pattern]}`;
      frame.src = `/prototypes/about-2026/${pattern}.html`;
      document.getElementById('open-preview').href = frame.src;
      resize();
    });
  });
  document.querySelectorAll('[data-viewport]').forEach(button => {
    button.addEventListener('click', () => {
      device = button.dataset.viewport;
      document.querySelectorAll('[data-viewport]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      resize();
    });
  });
  new ResizeObserver(resize).observe(viewport);
  resize();
})();
