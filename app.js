(function () {
  'use strict';
  const { makeScene, layoutScene } = window.MiniTuinLayout;
  const $ = id => document.getElementById(id);
  const state = { animals: 4, plants: 5, temperature: 20, wetness: 0, rain: 0, light: 100 };
  const nodes = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = $('rain');
  const context = canvas.getContext('2d');
  let width = innerWidth;
  let height = innerHeight;
  let placements = [];
  let rainDrops = [];
  let frame = 0;
  let clockTimer = 0;
  let lastFrame = null;
  let animationTime = 0;
  let nextBee = random(15000, 30000);
  let flight = null;
  function random(min, max) { return min + Math.random() * (max - min); }
  function phase(id) { return [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000; }

  function renderScene() {
    const layout = layoutScene(makeScene(state.animals, state.plants), width, height, placements);
    placements = layout.placements;
    $('wetness').style.top = `${layout.dirtTop}px`;
    for (const [id, node] of nodes) {
      if (!placements.some(p => p.id === id)) { node.remove(); nodes.delete(id); }
    }
    for (const p of placements) {
      let node = nodes.get(p.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'sprite';
        node.dataset.id = p.id;
        node.dataset.species = p.species;
        node.dataset.kind = p.asset.kind;
        node.dataset.row = ['back', 'middle', 'front'][p.row];
        const img = new Image();
        img.alt = '';
        img.draggable = false;
        img.src = `assets/${p.asset.file}`;
        node.append(img);
        $('sprites').append(node);
        nodes.set(p.id, node);
      }
      Object.assign(node.style, {
        left: `${p.x - p.visibleWidth / 2}px`, top: `${p.y - p.visibleHeight}px`,
        width: `${p.visibleWidth}px`, height: `${p.visibleHeight}px`,
        zIndex: String(p.row * 10000 + Math.round(p.y)),
      });
      Object.assign(node.firstChild.style, {
        width: `${501 * p.scale}px`, height: `${358 * p.scale}px`,
        left: `${-p.asset.bounds[0] * p.scale}px`, top: `${-p.asset.bounds[1] * p.scale}px`,
      });
    }
    moveAnimals();
  }

  function moveAnimals() {
    for (const p of placements) {
      let dx = 0;
      let dy = 0;
      if (p.asset.kind === 'animal' && !reducedMotion.matches) {
        const seed = phase(p.id);
        const time = animationTime / 1000;
        if (p.species === 'bird') {
          const interval = 6500 + seed * 5;
          const progress = ((animationTime + seed * 8) % interval) / 500;
          if (progress < 1) { dy = -Math.sin(progress * Math.PI) * p.motion * 1.5; dx = Math.sin(progress * Math.PI * 2) * p.motion * .35; }
        } else {
          dx = Math.sin(time * .65 + seed) * p.motion * .8;
          dy = Math.sin(time * .9 + seed * .5) * p.motion * .35;
        }
      }
      nodes.get(p.id).style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  function makeDrop(anywhere = true) {
    return { x: random(-40, width + 40), y: anywhere ? random(-height * .1, height) : random(-70, -10), speed: random(420, 850), length: random(9, 23), alpha: random(.16, .48) };
  }
  function syncRain() {
    const desired = state.rain === 0 ? 0 : Math.max(1, Math.round(width * height / 2400 * state.rain / 100));
    rainDrops.length = Math.min(rainDrops.length, desired);
    while (rainDrops.length < desired) rainDrops.push(makeDrop());
    drawRain(0);
  }
  function drawRain(delta) {
    context.clearRect(0, 0, width, height);
    const intensity = state.rain / 100;
    context.lineWidth = .7 + intensity * .7;
    context.lineCap = 'round';
    for (const drop of rainDrops) {
      drop.y += drop.speed * (.55 + intensity) * delta / 1000;
      drop.x += (45 + intensity * 130) * delta / 1000;
      if (drop.y > height + 30 || drop.x > width + 50) Object.assign(drop, makeDrop(false));
      const length = drop.length * (.5 + intensity);
      context.strokeStyle = `rgba(218, 235, 246, ${drop.alpha})`;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x + length * (.1 + intensity * .16), drop.y + length);
      context.stroke();
    }
  }

  function moveBee() {
    const bee = $('bee');
    if (!flight && animationTime >= nextBee) {
      flight = { start: animationTime, duration: random(8000, 12000), direction: Math.random() < .5 ? 1 : -1, y: random(.22, .52), wave: random(0, Math.PI * 2) };
    }
    if (!flight) { bee.hidden = true; return; }
    const progress = (animationTime - flight.start) / flight.duration;
    if (progress >= 1) { flight = null; nextBee = animationTime + random(15000, 30000); bee.hidden = true; return; }
    bee.hidden = false;
    const travel = progress * (width + 150) - 75;
    const x = flight.direction === 1 ? travel : width - travel;
    const curve = Math.sin(progress * Math.PI * 2 + flight.wave);
    const flutter = Math.sin(progress * Math.PI * 18);
    const y = height * flight.y + curve * height * .1 + flutter * Math.min(14, height * .025);
    const tilt = Math.cos(progress * Math.PI * 2 + flight.wave) * 14 + flutter * 5;
    bee.style.transform = `translate(${x}px, ${y}px) scaleX(${flight.direction}) rotate(${tilt}deg)`;
  }

  function tick(now) {
    const delta = lastFrame === null ? 0 : Math.min(now - lastFrame, 64);
    lastFrame = now;
    animationTime += delta;
    moveAnimals();
    drawRain(delta);
    moveBee();
    frame = requestAnimationFrame(tick);
  }
  function updateClock() {
    const date = new Date();
    const text = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    $('clock').textContent = text;
    $('clock').dateTime = date.toISOString();
  }
  function syncPlayback() {
    cancelAnimationFrame(frame);
    clearInterval(clockTimer);
    lastFrame = null;
    if (document.hidden) return;
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
    if (reducedMotion.matches) { $('bee').hidden = true; moveAnimals(); drawRain(0); }
    else frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    rainDrops = [];
    renderScene();
    syncRain();
  }
  const sliders = [
    ['animals', 'animals', 'animals-value', ''],
    ['plants', 'plants', 'plants-value', ''],
    ['temperature', 'temperature', 'temperature-value', '°C'],
    ['wetness-input', 'wetness', 'wetness-value', '%'],
    ['rain-input', 'rain', 'rain-value', '%'],
    ['light', 'light', 'light-value', '%'],
  ];
  for (const [id, key, output, suffix] of sliders) {
    const input = $(id);
    // Explicitly restore defaults even when the browser restores form values.
    input.value = state[key];
    const update = () => {
      state[key] = Number(input.value);
      $(output).textContent = `${input.value}${suffix}`;
      input.style.setProperty('--fill', `${(state[key] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
      if (key === 'animals' || key === 'plants') renderScene();
      if (key === 'temperature') $('temperature-display').innerHTML = `${state.temperature}<span>°C</span>`;
      if (key === 'wetness') $('wetness').style.opacity = state.wetness / 100;
      if (key === 'rain') syncRain();
      if (key === 'light') $('shade').style.opacity = (1 - state.light / 100) * .84;
    };
    input.addEventListener('input', update);
    update();
  }
  $('randomize').addEventListener('click', () => {
    const values = sliders.map(([id]) => {
      const input = $(id);
      const min = Number(input.min);
      const step = Number(input.step);
      const steps = Math.round((Number(input.max) - min) / step);
      return [input, min + Math.floor(Math.random() * (steps + 1)) * step];
    });
    for (const [input, value] of values) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  function setPanel(open, returnFocus = false) {
    $('controls').hidden = !open;
    $('panel-toggle').setAttribute('aria-expanded', String(open));
    $('panel-toggle').setAttribute('aria-label', `${open ? 'Close' : 'Open'} garden controls`);
    if (returnFocus) $('panel-toggle').focus();
  }
  $('panel-toggle').addEventListener('click', () => setPanel($('controls').hidden));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('controls').hidden) setPanel(false, true);
  });
  document.addEventListener('pointerdown', event => {
    if (!$('controls').hidden && !$('controls').contains(event.target) && !$('panel-toggle').contains(event.target)) setPanel(false);
  });
  for (const [toggle, target] of [['show-temperature', 'temperature-display'], ['show-clock', 'clock']]) {
    $(toggle).checked = true;
    $(toggle).addEventListener('change', () => { $(target).hidden = !$(toggle).checked; });
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  resize();
  syncPlayback();
})();
