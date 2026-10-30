/* Pure geometry shared by the file:// application and Node's built-in tests. */
(function (root) {
  'use strict';
  const assets = Object.freeze({
    bird: { file: 'bird1.png', bounds: [111, 107, 390, 358], kind: 'animal' },
    hedgehog: { file: 'hedgehog.png', bounds: [111, 127, 388, 358], kind: 'animal' },
    raccoon: { file: 'raccoon.png', bounds: [41, 65, 409, 358], kind: 'animal' },
    bush: { file: 'bush.png', bounds: [30, 42, 480, 358], kind: 'plant' },
    flowers: { file: 'bush2.png', bounds: [0, 218, 501, 358], kind: 'plant' },
    lavender: { file: 'bush3.png', bounds: [43, 47, 457, 358], kind: 'plant' },
    tree: { file: 'tree (1).png', bounds: [72, 12, 427, 358], kind: 'plant', tree: true },
    tree2: { file: 'tree2.png', bounds: [129, 0, 388, 358], kind: 'plant', tree: true },
  });
  const depth = [0.8, 1, 1.2]; // back, middle, front
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function makeScene(animals, plants) {
    const result = [];
    const animalSpecies = ['bird', 'hedgehog', 'raccoon'];
    const plantSpecies = ['tree', 'bush', 'flowers', 'tree2', 'lavender'];
    for (let i = 0; i < clamp(Math.round(animals), 0, 10); i++) {
      result.push({ id: `animal-${i}`, species: animalSpecies[i % 3], row: [1, 2, 0][i % 3], order: i * 2 });
    }
    for (let i = 0; i < clamp(Math.round(plants), 0, 10); i++) {
      result.push({ id: `plant-${i}`, species: plantSpecies[i % 5], row: [0, 1, 2, 0, 1][i % 5], order: i * 2 + 1 });
    }
    return result;
  }
  function geometry(width, height) {
    const cover = Math.max(width / 1920, height / 1080);
    const dirtTop = clamp(height - 122 * cover, 0, height);
    const grassTop = clamp(height - 635 * cover, 0, dirtTop);
    const grassHeight = dirtTop - grassTop;
    const bands = [[.08, .25], [.44, .64], [.82, .98]].map(([a, b]) => ({ top: grassTop + grassHeight * a, bottom: grassTop + grassHeight * b }));
    return { dirtTop, grassTop, bands };
  }
  function layoutScene(items, width, height, previous = []) {
    const ground = geometry(width, height);
    const margin = Math.min(24, width * .035);
    const gap = Math.min(18, width * .025);
    const motion = Math.min(6, width * .008, (ground.dirtTop - ground.grassTop) * .025);
    const baseWidth = clamp(height * .48, 180, 501);
    const rows = depth.map((_, row) => items.filter(item => item.row === row).sort((a, b) => a.order - b.order));
    // A single density factor preserves the intended depth relationship everywhere.
    let density = 1;
    for (const [row, members] of rows.entries()) {
      const total = members.reduce((sum, item) => { const b = assets[item.species].bounds; return sum + baseWidth * depth[row] * (b[2] - b[0]) / 501; }, 0);
      if (total) density = Math.min(density, Math.max(1, width - margin * 2 - gap * Math.max(0, members.length - 1) - members.length * motion * 2) / total);
      for (const item of members) {
        const b = assets[item.species].bounds;
        const band = ground.bands[row];
        const availableHeight = Math.max(1, band.bottom - motion * 3 - (band.bottom - band.top) * .22 - 10);
        density = Math.min(density, availableHeight / (baseWidth * depth[row] * (b[3] - b[1]) / 501));
      }
    }
    const placements = [];
    for (const [row, members] of rows.entries()) {
      const band = ground.bands[row];
      const prepared = members.map(item => {
        const asset = assets[item.species];
        const [left, top, right, bottom] = asset.bounds;
        const scale = baseWidth * depth[row] * density / 501;
        const visibleWidth = (right - left) * scale;
        const visibleHeight = (bottom - top) * scale;
        const rowMotion = Math.min(motion, (band.bottom - band.top) / 5);
        const y = band.bottom - rowMotion * 1.5 - ((item.order * 7) % 13) / 13 * Math.max(0, (band.bottom - band.top) * .22);
        return { ...item, asset, scale, visibleWidth, visibleHeight, reservedWidth: visibleWidth + motion * 2, y, motion: rowMotion, band, viewWidth: width };
      });
      const placed = [];
      let canPreserve = previous.length > 0;
      if (canPreserve) {
        for (const item of prepared) {
          const old = previous.find(p => p.id === item.id);
          if (!old) continue;
          const x = old.x / old.viewWidth * width;
          if (x - item.reservedWidth / 2 < margin || x + item.reservedWidth / 2 > width - margin || placed.some(p => Math.abs(p.x - x) < (p.reservedWidth + item.reservedWidth) / 2 + gap - .01)) { canPreserve = false; break; }
          placed.push({ ...item, x });
        }
        if (canPreserve) {
          for (const item of prepared.filter(p => !placed.some(q => p.id === q.id))) {
            const sorted = [...placed].sort((a, b) => a.x - b.x);
            let start = margin;
            const spaces = [];
            for (const p of sorted) { spaces.push([start, p.x - p.reservedWidth / 2 - gap]); start = p.x + p.reservedWidth / 2 + gap; }
            spaces.push([start, width - margin]);
            spaces.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
            const space = spaces.find(([a, b]) => b - a >= item.reservedWidth);
            if (!space) { canPreserve = false; break; }
            placed.push({ ...item, x: (space[0] + space[1]) / 2 });
          }
        }
      }
      if (canPreserve) placements.push(...placed);
      else {
        const total = prepared.reduce((n, p) => n + p.reservedWidth, 0);
        const spacing = prepared.length ? Math.max(0, (width - margin * 2 - total - gap * (prepared.length - 1)) / (prepared.length + 1)) : 0;
        let cursor = margin + spacing;
        for (const item of prepared) { placements.push({ ...item, x: cursor + item.reservedWidth / 2 }); cursor += item.reservedWidth + gap + spacing; }
      }
    }
    return { ...ground, placements, density, gap };
  }
  const api = { assets, depth, makeScene, geometry, layoutScene };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MiniTuinLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
