/* Play approved YouTube examples with only the controls needed on this page. */
let youtubeApiPromise;
let videoSequence = 0;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube player API could not load'));
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function iconButton(action, label, symbol) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cxg-video-controls__button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.textContent = symbol;
  return button;
}

function startVideo(button) {
  const id = button.dataset.youtubeId;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return;
  const title = button.getAttribute('aria-label') || '制作事例の動画';
  const wrapper = document.createElement('div');
  wrapper.className = 'cxg-video-shell';
  wrapper.dataset.youtubeId = id;
  const surface = iconButton('play', '動画を一時停止', '');
  surface.className = 'cxg-video-surface';
  const controls = document.createElement('div');
  controls.className = 'cxg-video-controls';
  const youtube = document.createElement('a');
  youtube.className = 'cxg-video-controls__youtube';
  youtube.href = `https://www.youtube.com/watch?v=${id}`;
  youtube.target = '_blank';
  youtube.rel = 'noopener noreferrer';
  youtube.setAttribute('aria-label', 'YouTubeで動画を開く');
  youtube.textContent = '▶';
  const volume = iconButton('volume', '音声をミュート', '◖))');
  const captions = iconButton('captions', '字幕を表示', 'CC');
  const progress = document.createElement('input');
  progress.className = 'cxg-video-controls__progress';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '100';
  progress.value = '0';
  progress.setAttribute('aria-label', '動画の再生位置');
  const fullscreen = iconButton('fullscreen', '動画を拡大', '⛶');
  controls.append(youtube, volume, captions, progress, fullscreen);
  wrapper.append(surface, controls);
  button.replaceWith(wrapper);
  wrapper.closest('.cxg-service-card')?.classList.add('cxg-service-card--playing');

  let player;
  let captionsOn = false;
  let pendingTime = 0;
  let playing = true;
  let muted = false;

  function createIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = `cxg-video-${++videoSequence}`;
    iframe.className = 'cxg-video-player';
    iframe.title = title;
    const params = new URLSearchParams({
      autoplay: '1', mute: '0', playsinline: '1', rel: '0', controls: '0',
      disablekb: '1', fs: '0', enablejsapi: '1', cc_load_policy: captionsOn ? '1' : '0',
      origin: location.origin,
    });
    if (pendingTime > 0) params.set('start', String(Math.floor(pendingTime)));
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    wrapper.prepend(iframe);
    loadYouTubeApi().then((YT) => {
      if (!iframe.isConnected) return;
      player = new YT.Player(iframe, {
        events: {
          onReady: () => {
            if (muted) player.mute();
            if (!playing) player.pauseVideo();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING) playing = true;
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) playing = false;
            surface.setAttribute('aria-label', playing ? '動画を一時停止' : '動画を再生');
          },
        },
      });
    }).catch(() => {
      wrapper.classList.add('cxg-video-shell--fallback');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
    });
  }

  surface.addEventListener('click', () => {
    if (!player || typeof player.getPlayerState !== 'function') return;
    if (player.getPlayerState() === window.YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  });
  volume.addEventListener('click', () => {
    muted = !muted;
    if (player && typeof player.mute === 'function') {
      if (muted) player.mute();
      else player.unMute();
    }
    volume.textContent = muted ? '◖×' : '◖))';
    volume.setAttribute('aria-label', muted ? '音声をオンにする' : '音声をミュート');
  });
  captions.addEventListener('click', () => {
    pendingTime = player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
    if (player && typeof player.destroy === 'function') player.destroy();
    else wrapper.querySelector('iframe')?.remove();
    player = undefined;
    captionsOn = !captionsOn;
    captions.setAttribute('aria-pressed', String(captionsOn));
    captions.setAttribute('aria-label', captionsOn ? '字幕を非表示' : '字幕を表示');
    createIframe();
  });
  progress.addEventListener('input', () => {
    if (!player || typeof player.getDuration !== 'function') return;
    const duration = player.getDuration();
    if (duration > 0) player.seekTo(duration * Number(progress.value) / 100, true);
  });
  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement === wrapper) document.exitFullscreen();
    else wrapper.requestFullscreen?.();
  });
  setInterval(() => {
    if (!wrapper.isConnected || !player || typeof player.getDuration !== 'function') return;
    const duration = player.getDuration();
    if (duration > 0 && document.activeElement !== progress) {
      progress.value = String(Math.round(player.getCurrentTime() / duration * 100));
      progress.style.setProperty('--cxg-progress', `${progress.value}%`);
    }
  }, 500);
  createIframe();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.cxg-video-play');
  if (button) startVideo(button);
});
