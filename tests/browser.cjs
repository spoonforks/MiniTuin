/* Use --http only in managed browsers that prohibit file:// navigation. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const useHttp = process.argv.includes('--http');
let server;
let browser;
let checks = 0;
const pass = message => { checks++; console.log(`PASS ${message}`); };

async function main() {
  let url = pathToFileURL(path.join(root, 'index.html')).href;
  if (useHttp) {
    server = http.createServer(async (req, res) => {
      try {
        const filename = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
        if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
        res.end(await fs.readFile(filename));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}/index.html`;
  }
  browser = await chromium.launch({
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', req => { if (!req.url().startsWith('file:') && !req.url().startsWith('data:') && !req.url().startsWith(new URL(url).origin + '/')) external.push(req.url()); });
  // Deterministic randomness makes a complete bee flight observable with the virtual clock.
  await page.addInitScript(() => { Math.random = () => .5; });
  await page.clock.install({ time: new Date('2026-10-30T12:00:00') });
  await page.goto(url);
  await page.clock.pauseAt(new Date('2026-10-30T12:00:01'));
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
  assert.equal(await page.locator('.sprite').count(), 9);
  assert.equal(await page.locator('#controls').isVisible(), false);
  assert.equal(await page.locator('#temperature-display').innerText(), '20°C');
  assert.match(await page.locator('#clock').innerText(), /^\d{2}:\d{2}$/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.backyard')).backgroundSize), 'cover');
  pass(`${useHttp ? 'HTTP fallback' : 'Direct-file'} startup, all image assets, and defaults`);

  const set = async (id, value) => page.locator(`#${id}`).evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  await page.locator('#panel-toggle').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#controls').isVisible(), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#animals').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-kind="animal"]').count(), 5);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#controls').isVisible(), false);
  assert.equal(await page.locator('#panel-toggle').evaluate(el => el === document.activeElement), true);
  await page.click('#panel-toggle');
  pass('Keyboard panel access, slider operation, Escape, and focus return');

  for (const value of [0, 10, 2, 9, 1, 8, 0, 10]) {
    await set('animals', value);
    await set('plants', value);
    assert.equal(await page.locator('[data-kind="animal"]').count(), value);
    assert.equal(await page.locator('[data-kind="plant"]').count(), value);
  }
  const treeRows = await page.locator('[data-species="tree"], [data-species="tree2"]').evaluateAll(nodes => nodes.map(n => n.dataset.row));
  assert.ok(treeRows.length && treeRows.every(row => row === 'back'));
  pass('Exact zero/maximum counts, rapid updates, and tree restrictions');

  for (const value of [-5, 35]) {
    await set('temperature', value);
    assert.equal(await page.locator('#temperature-display').innerText(), `${value}°C`);
  }
  await set('wetness-input', 50);
  assert.equal(await page.locator('#wetness').evaluate(el => getComputedStyle(el).opacity), '0.5');
  await set('light', 0);
  assert.equal(await page.locator('#shade').evaluate(el => getComputedStyle(el).opacity), '0.84');
  for (const [toggle, target] of [['show-temperature', 'temperature-display'], ['show-clock', 'clock']]) {
    await page.locator(`#${toggle}`).uncheck();
    assert.equal(await page.locator(`#${target}`).isVisible(), false);
    await page.locator(`#${toggle}`).check();
    assert.equal(await page.locator(`#${target}`).isVisible(), true);
  }
  pass('Temperature extremes, wetness, darkness, and independent visibility toggles');

  const rainPixels = () => page.locator('#rain').evaluate(el => {
    const context = el.getContext('2d');
    const bytes = context.getImageData(0, 0, el.width, el.height).data;
    let alpha = 0;
    for (let i = 3; i < bytes.length; i += 4) alpha += bytes[i];
    return alpha;
  });
  await set('rain-input', 20);
  const drizzle = await rainPixels();
  await set('rain-input', 100);
  const storm = await rainPixels();
  assert.ok(drizzle > 0 && storm > drizzle);
  const rainBefore = await page.locator('#rain').evaluate(el => el.toDataURL());
  await page.clock.runFor(160);
  assert.notEqual(await page.locator('#rain').evaluate(el => el.toDataURL()), rainBefore);
  assert.equal(await page.locator('#wetness-input').inputValue(), '50');
  assert.equal(await page.locator('#temperature').inputValue(), '35');
  assert.equal(await page.locator('#light').inputValue(), '0');
  await set('rain-input', 0);
  assert.equal(await rainPixels(), 0);
  await set('light', 100);
  pass('Rain density and animation, clear sky, and independent environmental controls');

  await page.locator('#show-clock').uncheck();
  await page.locator('#show-temperature').uncheck();
  for (const randomValue of [0, .999999, .5]) {
    await page.evaluate(value => {
      let sliderSamples = 6;
      Math.random = () => sliderSamples-- > 0 ? value : .5;
    }, randomValue);
    await page.locator('#randomize').focus();
    await page.keyboard.press('Enter');
    const values = await page.locator('input[type="range"]').evaluateAll(inputs => inputs.map(input => ({
      min: Number(input.min), max: Number(input.max), value: Number(input.value),
      fill: input.style.getPropertyValue('--fill'),
      output: document.querySelector(`output[for="${input.id}"]`).textContent,
    })));
    for (const input of values) {
      assert.ok(Number.isInteger(input.value) && input.value >= input.min && input.value <= input.max);
      if (randomValue === 0) assert.equal(input.value, input.min);
      if (randomValue > .99) assert.equal(input.value, input.max);
      assert.equal(parseFloat(input.output), input.value);
      assert.equal(parseFloat(input.fill), (input.value - input.min) / (input.max - input.min) * 100);
    }
    assert.equal(await page.locator('[data-kind="animal"]').count(), values[0].value);
    assert.equal(await page.locator('[data-kind="plant"]').count(), values[1].value);
    assert.equal(await page.locator('#temperature-display').textContent(), `${values[2].value}°C`);
    assert.equal(await page.locator('#wetness').evaluate(el => Number(el.style.opacity)), values[3].value / 100);
    assert.equal(await page.locator('#shade').evaluate(el => Number(el.style.opacity)), (1 - values[5].value / 100) * .84);
    assert.equal((await rainPixels()) > 0, values[4].value > 0);
    assert.equal(await page.locator('#clock').isVisible(), false);
    assert.equal(await page.locator('#temperature-display').isVisible(), false);
  }
  await page.locator('#show-clock').check();
  await page.locator('#show-temperature').check();
  await set('animals', 10);
  await set('plants', 10);
  await set('rain-input', 0);
  await set('light', 100);
  pass('Keyboard randomization, full slider ranges, synchronized scene/readouts, and preserved visibility preferences');

  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [2560, 720], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await new Promise(resolve => setTimeout(resolve, 100));
    await page.clock.runFor(32);
    const scene = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sprite')].map(n => {
        const b = n.getBoundingClientRect();
        return { row: n.dataset.row, left: b.left, right: b.right, top: b.top, bottom: b.bottom, z: Number(n.style.zIndex) };
      });
      const panel = document.querySelector('#controls').getBoundingClientRect();
      return { items, dirtTop: parseFloat(document.querySelector('#wetness').style.top), panel: { left: panel.left, right: panel.right, bottom: panel.bottom }, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.equal(scene.scrollWidth, width);
    assert.ok(Math.abs(scene.dirtTop - (height - 122 * Math.max(width / 1920, height / 1080))) < 1, `Dirt at ${scene.dirtTop} for ${width}×${height}`);
    assert.ok(scene.panel.left >= 0 && scene.panel.right <= width && scene.panel.bottom <= height);
    for (const p of scene.items) {
      assert.ok(p.left >= 0 && p.right <= width + .1 && p.top >= 0 && p.bottom <= height);
      for (const q of scene.items) {
        if (p.row === q.row && p.left < q.left) assert.ok(p.right < q.left);
        if (p.row === 'front' && q.row === 'back') assert.ok(p.z > q.z);
      }
    }
  }
  pass('Responsive geometry, full coverage, spacing, dirt alignment, panel fit, and depth order');

  await page.setViewportSize({ width: 1440, height: 900 });
  await set('animals', 4);
  await set('plants', 5);
  await set('temperature', 20);
  await set('wetness-input', 0);
  const transforms = () => page.locator('[data-kind="animal"]').evaluateAll(nodes => nodes.map(n => n.style.transform));
  const animalBefore = await transforms();
  let sawHop = false;
  for (let i = 0; i < 80; i++) {
    await page.clock.runFor(100);
    sawHop ||= await page.locator('[data-species="bird"]').evaluateAll(nodes => nodes.some(n => { const m = new DOMMatrix(getComputedStyle(n).transform); return m.m42 < -.5; }));
  }
  assert.ok(sawHop);
  assert.notDeepEqual(await transforms(), animalBefore);
  pass('Bird hopping and subtle movement of other animals');

  let sawBee = false;
  let completedFlight = false;
  const beePositions = [];
  for (let i = 0; i < 70; i++) {
    await page.clock.runFor(500);
    const visible = await page.locator('#bee').isVisible();
    if (visible) { sawBee = true; beePositions.push(await page.locator('#bee').evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return [m.m41, m.m42]; })); }
    if (sawBee && !visible) { completedFlight = true; break; }
  }
  assert.ok(sawBee && completedFlight);
  assert.ok(new Set(beePositions.map(p => Math.round(p[1]))).size > 4);
  pass('A complete independently scheduled, curved bee flight');

  const clockBefore = await page.locator('#clock').innerText();
  await page.clock.runFor(61000);
  assert.notEqual(await page.locator('#clock').innerText(), clockBefore);
  pass('Clock advances with browser-local time');

  await set('rain-input', 100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await new Promise(resolve => setTimeout(resolve, 100));
  await page.clock.runFor(32);
  const stillAnimals = await transforms();
  const stillRain = await page.locator('#rain').evaluate(el => el.toDataURL());
  await page.clock.runFor(1000);
  assert.deepEqual(await transforms(), stillAnimals);
  assert.ok(await page.locator('#rain').evaluate(el => el.toDataURL()) === stillRain, 'Rain should remain still with reduced motion');
  assert.equal(await page.locator('#bee').isVisible(), false);
  await set('animals', 3);
  assert.equal(await page.locator('[data-kind="animal"]').count(), 3);
  pass('Reduced motion freezes animations while keeping controls functional');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await new Promise(resolve => setTimeout(resolve, 100));
  await page.clock.runFor(100);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const pausedAnimals = await transforms();
  const pausedRain = await page.locator('#rain').evaluate(el => el.toDataURL());
  await page.clock.runFor(1000);
  assert.deepEqual(await transforms(), pausedAnimals);
  assert.ok(await page.locator('#rain').evaluate(el => el.toDataURL()) === pausedRain, 'Rain should remain still while hidden');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(300);
  assert.notDeepEqual(await transforms(), pausedAnimals);
  pass('Hidden-page pause and visible-page resume');

  await page.reload();
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
  assert.equal(await page.locator('#animals').inputValue(), '4');
  assert.equal(await page.locator('#plants').inputValue(), '5');
  assert.equal(await page.locator('#rain-input').inputValue(), '0');
  assert.equal(await page.locator('#controls').isVisible(), false);
  await page.screenshot({ path: path.join(os.tmpdir(), 'minituin-desktop.png') });
  await page.click('#panel-toggle');
  await page.screenshot({ path: path.join(os.tmpdir(), 'minituin-panel.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(os.tmpdir(), 'minituin-portrait.png') });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  pass('Reload defaults, no console errors, and no external requests');
  console.log(`${checks} browser checks passed (${useHttp ? 'HTTP; file navigation is not validated by this run' : 'file://'}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
