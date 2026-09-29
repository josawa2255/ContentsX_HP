/* Play the approved works directly in this page, with no third-party player UI. */
function mediaButton(action, label, symbol) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cxg-video-controls__button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.textContent = symbol;
  return button;
}

function startServiceVideo(poster) {
  const src = poster.dataset.videoSrc;
  const captionsSrc = poster.dataset.captionSrc;
  if (!/^\/material\/service-2026\/[\w-]+\.mp4$/.test(src || '')) return;

  const shell = document.createElement('div');
  shell.className = 'cxg-video-shell';
  shell.dataset.playing = 'true';
  const video = document.createElement('video');
  video.className = 'cxg-video-player';
  video.src = src;
  video.preload = 'metadata';
  video.playsInline = true;
  video.poster = poster.querySelector('img')?.src || '';
  video.setAttribute('aria-label', poster.getAttribute('aria-label') || '制作事例の動画');
  if (/^\/material\/service-2026\/[\w-]+\.ja\.vtt$/.test(captionsSrc || '')) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = '日本語（自動生成）';
    track.srclang = 'ja';
    track.src = captionsSrc;
    video.append(track);
  }

  const surface = mediaButton('surface', '動画を一時停止', '');
  surface.className = 'cxg-video-surface';
  const controls = document.createElement('div');
  controls.className = 'cxg-video-controls';
  const play = mediaButton('play', '動画を一時停止', 'Ⅱ');
  const volume = mediaButton('volume', '音声をミュート', '◖))');
  const captions = mediaButton('captions', '自動字幕を表示', 'CC');
  captions.setAttribute('aria-pressed', 'false');
  const progress = document.createElement('input');
  progress.className = 'cxg-video-controls__progress';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '100';
  progress.value = '0';
  progress.setAttribute('aria-label', '動画の再生位置');
  const fullscreen = mediaButton('fullscreen', '動画を拡大', '⛶');
  controls.append(play, volume, captions, progress, fullscreen);
  shell.append(video, surface, controls);
  poster.replaceWith(shell);
  shell.closest('.cxg-service-card')?.classList.add('cxg-service-card--playing');
  shell.closest('.cxsd-card')?.classList.add('cxsd-card--playing');

  function syncPlayState() {
    const playing = !video.paused && !video.ended;
    shell.dataset.playing = String(playing);
    play.textContent = playing ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', playing ? '動画を一時停止' : '動画を再生');
    surface.setAttribute('aria-label', playing ? '動画を一時停止' : '動画を再生');
  }

  function togglePlay() {
    if (video.paused || video.ended) video.play().catch(() => { shell.dataset.playing = 'false'; });
    else video.pause();
  }

  play.addEventListener('click', togglePlay);
  surface.addEventListener('click', togglePlay);
  video.addEventListener('play', syncPlayState);
  video.addEventListener('pause', syncPlayState);
  video.addEventListener('ended', syncPlayState);
  video.addEventListener('timeupdate', () => {
    if (!Number.isFinite(video.duration) || !video.duration || document.activeElement === progress) return;
    progress.value = String(Math.round(video.currentTime / video.duration * 100));
    progress.style.setProperty('--cxg-progress', `${progress.value}%`);
  });
  progress.addEventListener('input', () => {
    if (Number.isFinite(video.duration) && video.duration) {
      video.currentTime = video.duration * Number(progress.value) / 100;
      progress.style.setProperty('--cxg-progress', `${progress.value}%`);
    }
  });
  volume.addEventListener('click', () => {
    video.muted = !video.muted;
    volume.textContent = video.muted ? '◖×' : '◖))';
    volume.setAttribute('aria-label', video.muted ? '音声をオンにする' : '音声をミュート');
  });
  captions.addEventListener('click', () => {
    const track = video.textTracks[0];
    if (!track) return;
    const enabled = track.mode !== 'showing';
    track.mode = enabled ? 'showing' : 'disabled';
    captions.setAttribute('aria-pressed', String(enabled));
    captions.setAttribute('aria-label', enabled ? '自動字幕を非表示' : '自動字幕を表示');
  });
  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement === shell) document.exitFullscreen();
    else if (shell.requestFullscreen) shell.requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  });

  video.play().catch(() => {
    shell.dataset.playing = 'false';
    syncPlayState();
  });
}

document.addEventListener('click', (event) => {
  const poster = event.target.closest('.cxg-video-play');
  if (poster) startServiceVideo(poster);
});
