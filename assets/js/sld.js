/* SLD cover player: each cover is mapped to its track. The audioMotion
   analyzer draws behind the cover, colored from the cover's own pixels,
   and the cover pulses with the low end. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = document.getElementById('audio');
  const crate = [...document.querySelectorAll('#crate button')];
  const stageAsset = document.getElementById('stage-asset');
  const stageCover = document.querySelector('.stage-cover');
  const stageImg = document.getElementById('stage-img');
  const stageDl = document.getElementById('stage-download');
  const stageDlBtn = document.getElementById('stage-download-btn');
  const title = document.getElementById('track-title');
  const time = document.getElementById('time');
  const scrub = document.getElementById('scrub');
  const playBtn = document.getElementById('play');
  const playIcon = document.getElementById('play-icon');
  const player = document.getElementById('player');
  const PLAY = 'M8 5v14l11-7z';
  const PAUSE = 'M7 5h4v14H7zM13 5h4v14h-4z';
  let current = -1;
  let analyzer = null;
  const gradients = {};

  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

  // Three vivid colors from a cover: bucket pixels by hue, keep the
  // most common saturated buckets, ordered dark to light.
  function paletteFrom(img) {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 40, 40);
    const d = ctx.getImageData(0, 0, 40, 40).data;
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 40 || max < 60) continue; // skip greys and near-black
      let h;
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      const key = Math.round(((h * 60 + 360) % 360) / 30);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 3)
      .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
    // Fall back to the brand palette for covers that are mostly greyscale.
    const brand = [[141, 27, 255], [230, 0, 126], [0, 160, 233]];
    while (top.length < 3) top.push(brand[top.length]);
    return top.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]))
      .map(([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`);
  }

  function ensureAnalyzer() {
    if (analyzer || typeof AudioMotionAnalyzer === 'undefined') return;
    analyzer = new AudioMotionAnalyzer(document.getElementById('viz'), {
      source: audio,
      mode: 4,
      roundBars: true,
      barSpace: 0.35,
      reflexRatio: 0.25,
      reflexAlpha: 0.2,
      showScaleX: false,
      showPeaks: false,
      overlay: true,
      showBgColor: false,
      bgAlpha: 0,
      smoothing: 0.75,
      minDecibels: -85,
      maxDecibels: -25,
      weightingFilter: 'D',
      frequencyScale: 'log',
      maxFPS: 60,
      onCanvasDraw: (instance) => {
        if (reduced) return;
        stageCover.style.setProperty('--pulse', (1 + instance.getEnergy('bass') * 0.09).toFixed(4));
      }
    });
  }

  function applyGradient(i) {
    if (!analyzer) return;
    const name = `cover-${i}`;
    if (!gradients[name]) {
      try {
        const colors = paletteFrom(crate[i].querySelector('img'));
        analyzer.registerGradient(name, { bgColor: '#000', colorStops: colors });
        gradients[name] = true;
      } catch (e) {
        return; // image not ready or unreadable; keep the current gradient
      }
    }
    analyzer.gradient = name;
  }

  function setPlaying(on) {
    playIcon.setAttribute('d', on ? PAUSE : PLAY);
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    player.classList.toggle('is-playing', on);
  }

  function select(i, autoplay) {
    i = (i + crate.length) % crate.length;
    const btn = crate[i];
    const { name, cover } = btn.dataset;
    const from = btn.querySelector('img').getBoundingClientRect();

    current = i;
    crate.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    title.textContent = name;
    stageImg.src = cover;
    stageImg.alt = `Cover art for ${name}`;
    stageAsset.dataset.title = `${name}, cover art`;
    stageAsset.dataset.full = cover;
    const file = `StevieMcLane_SLD_${name.replace(/[^a-z0-9]+/gi, '')}_Cover.webp`;
    stageDl.href = stageDlBtn.href = cover;
    stageDl.download = stageDlBtn.download = file;
    stageDlBtn.setAttribute('aria-label', `Download the ${name} cover`);

    audio.src = btn.dataset.audio;
    scrub.value = 0;
    scrub.style.setProperty('--p', '0%');
    time.textContent = '0:00';
    if (autoplay) {
      ensureAnalyzer();
      applyGradient(i);
      audio.play().catch(() => setPlaying(false));
    }

    // Fly the picked cover from the crate into the stage.
    if (window.gsap && !reduced && from.width) {
      const to = stageImg.getBoundingClientRect();
      gsap.fromTo(stageImg, {
        x: from.left - to.left,
        y: from.top - to.top,
        scaleX: from.width / to.width,
        scaleY: from.height / to.height,
        transformOrigin: '0 0'
      }, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: 'expo.out' });
    }
  }

  crate.forEach((btn, i) => btn.addEventListener('click', () => {
    if (i === current) { audio.paused ? audio.play() : audio.pause(); return; }
    select(i, true);
  }));
  document.getElementById('prev').addEventListener('click', () => select(current - 1, !audio.paused || current < 0));
  document.getElementById('next').addEventListener('click', () => select(current + 1, !audio.paused || current < 0));
  playBtn.addEventListener('click', () => {
    ensureAnalyzer();
    applyGradient(current);
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });

  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => select(current + 1, true));
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const p = audio.currentTime / audio.duration;
    if (!scrub.matches(':active')) scrub.value = Math.round(p * 1000);
    scrub.style.setProperty('--p', `${p * 100}%`);
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  });
  scrub.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (scrub.value / 1000) * audio.duration;
    scrub.style.setProperty('--p', `${scrub.value / 10}%`);
  });
  // Stop the music when the visitor leaves for another page.
  addEventListener('pagehide', () => audio.pause());

  // Load the first cover without playing (browsers block autoplay with sound).
  current = 0;
  const first = crate[0];
  crate[0].setAttribute('aria-pressed', 'true');
  title.textContent = first.dataset.name;
  stageImg.src = first.dataset.cover;
  stageImg.alt = `Cover art for ${first.dataset.name}`;
  stageAsset.dataset.title = `${first.dataset.name}, cover art`;
  stageAsset.dataset.full = first.dataset.cover;
  stageDl.href = stageDlBtn.href = first.dataset.cover;
  stageDl.download = stageDlBtn.download = 'StevieMcLane_SLD_Bankroll_Cover.webp';
  audio.src = first.dataset.audio;
})();
