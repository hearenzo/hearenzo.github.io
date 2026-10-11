// Listen pages — single-track player for /listen/<slug>/.
// Tries to start playback on arrival (QR scans are an explicit intent to
// listen); when the browser refuses autoplay, the play button breathes and one
// tap starts the track. The waveform is precomputed and passed in data-peaks.
(() => {
  const root = document.querySelector('[data-listen]');
  if (!root) return;

  const audio = root.querySelector('audio');
  const playBtn = root.querySelector('.listen-play');
  const wave = root.querySelector('.listen-wave');
  const canvas = wave.querySelector('canvas');
  const timeNow = root.querySelector('[data-time-now]');
  const timeTotal = root.querySelector('[data-time-total]');
  const status = root.querySelector('.listen-status');

  const peaks = JSON.parse(root.dataset.peaks || '[]');
  const title = root.dataset.title || document.title;
  let duration = Number(root.dataset.duration) || 0;
  let frame = 0;
  let dragging = false;

  const css = getComputedStyle(document.documentElement);
  const colorRest = css.getPropertyValue('--wave-rest').trim() || 'rgba(255,255,255,0.22)';
  const colorPlayed = css.getPropertyValue('--wave-played').trim() || '#fff';

  function fmt(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function setState(state, message = '') {
    root.dataset.state = state;
    status.textContent = message;
    const playing = state === 'playing' || state === 'loading';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playBtn.setAttribute('aria-pressed', String(playing));
  }

  // Waveform ---------------------------------------------------------------

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const n = peaks.length;
    if (!n) return;
    const step = w / n;
    const barW = Math.max(1, step * 0.5);
    const mid = h / 2;
    const progress = duration ? audio.currentTime / duration : 0;

    for (let i = 0; i < n; i += 1) {
      const amp = Math.max(1, (peaks[i] / 100) * h);
      ctx.fillStyle = (i + 0.5) / n <= progress ? colorPlayed : colorRest;
      ctx.fillRect(i * step + (step - barW) / 2, mid - amp / 2, barW, amp);
    }

    if (progress > 0) {
      ctx.fillStyle = colorPlayed;
      ctx.fillRect(Math.min(w - 1, progress * w), 0, 1, h);
    }
  }

  function updateTime() {
    timeNow.textContent = fmt(audio.currentTime);
    wave.setAttribute('aria-valuenow', String(Math.floor(audio.currentTime)));
    wave.setAttribute('aria-valuetext', `${fmt(audio.currentTime)} of ${fmt(duration)}`);
  }

  function tick() {
    draw();
    updateTime();
    frame = audio.paused ? 0 : requestAnimationFrame(tick);
  }

  function startTicking() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // Playback ---------------------------------------------------------------

  async function play() {
    root.dataset.started = '';
    try {
      await audio.play();
    } catch (err) {
      if (err && err.name === 'NotAllowedError') setState('ready');
    }
  }

  function toggle() {
    if (audio.paused) play();
    else audio.pause();
  }

  function seekTo(seconds) {
    if (!duration) return;
    audio.currentTime = Math.min(Math.max(0, seconds), duration);
    draw();
    updateTime();
  }

  function seekFromPointer(event) {
    const rect = wave.getBoundingClientRect();
    const ratio = Math.min(Math.max(0, (event.clientX - rect.left) / rect.width), 1);
    seekTo(ratio * duration);
  }

  playBtn.addEventListener('click', toggle);

  wave.addEventListener('pointerdown', (event) => {
    dragging = true;
    wave.setPointerCapture(event.pointerId);
    seekFromPointer(event);
    if (audio.paused) play();
  });
  wave.addEventListener('pointermove', (event) => {
    if (dragging) seekFromPointer(event);
  });
  wave.addEventListener('pointerup', () => {
    dragging = false;
  });
  wave.addEventListener('pointercancel', () => {
    dragging = false;
  });

  wave.addEventListener('keydown', (event) => {
    const jumps = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 };
    if (event.key in jumps) seekTo(audio.currentTime + jumps[event.key]);
    else if (event.key === 'Home') seekTo(0);
    else if (event.key === 'End') seekTo(duration - 0.5);
    else return;
    event.preventDefault();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== ' ' || event.target.closest('button, a, [role="slider"]')) return;
    event.preventDefault();
    toggle();
  });

  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) duration = audio.duration;
    timeTotal.textContent = fmt(duration);
    wave.setAttribute('aria-valuemax', String(Math.floor(duration)));
    draw();
  });
  audio.addEventListener('play', () => {
    root.dataset.started = '';
    setState('playing');
    startTicking();
  });
  audio.addEventListener('waiting', () => setState('loading', 'loading…'));
  audio.addEventListener('playing', () => setState('playing'));
  audio.addEventListener('pause', () => {
    setState(audio.ended ? 'ended' : 'paused');
    draw();
  });
  audio.addEventListener('timeupdate', () => {
    if (audio.paused) {
      draw();
      updateTime();
    }
  });
  audio.addEventListener('error', () => setState('error', 'could not load audio — please reload'));

  // Lock screen / notification controls
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Myungseok Oh',
      album: 'hearenzo.github.io',
      artwork: [{ src: '/assets/img/og.png', sizes: '1200x630', type: 'image/png' }]
    });
    const handlers = {
      play,
      pause: () => audio.pause(),
      seekto: (details) => seekTo(details.seekTime),
      seekbackward: () => seekTo(audio.currentTime - 10),
      seekforward: () => seekTo(audio.currentTime + 10)
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_) {
        /* action not supported on this platform */
      }
    }
  }

  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(canvas);
  else window.addEventListener('resize', draw);

  setState('idle');
  draw();
  updateTime();

  // A QR scan is an explicit intent to listen — try straight away. Most mobile
  // browsers refuse sound without a tap; then the button invites one.
  audio.play().then(
    () => {
      root.dataset.started = '';
    },
    () => {
      if (audio.paused) setState('ready');
    }
  );
})();
