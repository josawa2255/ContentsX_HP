/* Start a service sample after a deliberate click so its audio can play. */
document.addEventListener('click', (event) => {
  const button = event.target.closest('.cxg-video-play');
  if (!button) return;
  const id = button.dataset.youtubeId;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return;

  const player = document.createElement('iframe');
  player.className = 'cxg-video-player';
  player.title = button.getAttribute('aria-label') || '制作事例の動画';
  player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&playsinline=1&rel=0`;
  player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  player.allowFullscreen = true;
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  button.replaceWith(player);
  player.focus();
});
