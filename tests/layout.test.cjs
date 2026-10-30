const test = require('node:test');
const assert = require('node:assert/strict');
const { makeScene, layoutScene, assets, geometry } = require('../layout.js');

test('all slider count combinations give exact counts and keep trees at the back', () => {
  for (let animals = 0; animals <= 10; animals++) {
    for (let plants = 0; plants <= 10; plants++) {
      const items = makeScene(animals, plants);
      assert.equal(items.filter(i => assets[i.species].kind === 'animal').length, animals);
      assert.equal(items.filter(i => assets[i.species].kind === 'plant').length, plants);
      assert.equal(new Set(items.map(i => i.id)).size, items.length);
      for (const item of items) if (assets[item.species].tree) assert.equal(item.row, 0);
    }
  }
});

for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [320, 568], [2560, 720], [844, 390]]) {
  test(`placement stays visible, within bands, and separated at ${width}×${height}`, () => {
    for (let animals = 0; animals <= 10; animals++) {
      for (let plants = 0; plants <= 10; plants++) {
        const { placements, bands, gap } = layoutScene(makeScene(animals, plants), width, height);
        for (const p of placements) {
          assert.ok(p.scale > 0);
          assert.ok(p.x - p.visibleWidth / 2 - p.motion >= 0);
          assert.ok(p.x + p.visibleWidth / 2 + p.motion <= width);
          assert.ok(p.y - p.visibleHeight - p.motion * 1.5 >= 0);
          assert.ok(p.y - p.motion * 1.5 >= bands[p.row].top);
          assert.ok(p.y + p.motion <= bands[p.row].bottom);
        }
        for (let row = 0; row < 3; row++) {
          const members = placements.filter(p => p.row === row).sort((a, b) => a.x - b.x);
          for (let i = 1; i < members.length; i++) {
            const a = members[i - 1], b = members[i];
            assert.ok(b.x - a.x >= (a.reservedWidth + b.reservedWidth) / 2 + gap - .01, 'Motion envelopes must not overlap');
          }
        }
      }
    }
  });
}

test('removing a sprite preserves survivor positions when they still fit', () => {
  const before = layoutScene(makeScene(4, 5), 1920, 1080);
  const after = layoutScene(makeScene(3, 5), 1920, 1080, before.placements);
  for (const p of after.placements) {
    assert.equal(p.x, before.placements.find(q => q.id === p.id).x);
  }
});

test('rapid count changes and resizing preserve valid packing', () => {
  let previous = [];
  for (let i = 0; i < 100; i++) {
    const width = i % 2 ? 390 : 1366;
    const height = i % 2 ? 844 : 768;
    const result = layoutScene(makeScene(i % 11, (i * 7) % 11), width, height, previous);
    for (const p of result.placements) {
      assert.ok(p.x - p.reservedWidth / 2 >= -0.01 && p.x + p.reservedWidth / 2 <= width + .01);
      for (const q of result.placements) if (p.id !== q.id && p.row === q.row) {
        assert.ok(Math.abs(p.x - q.x) + .01 >= (p.reservedWidth + q.reservedWidth) / 2 + result.gap);
      }
    }
    previous = result.placements;
  }
});

test('wetness follows the cover-scaled dirt boundary', () => {
  assert.equal(geometry(1920, 1080).dirtTop, 958);
  assert.equal(geometry(390, 844).dirtTop, 844 - 122 * (844 / 1080));
});
