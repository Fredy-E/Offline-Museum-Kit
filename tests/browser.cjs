'use strict';
/*
 * End-to-end browser checks for Offline Museum Kit.
 *
 * Run:
 *   npm ci
 *   npm run test:browser
 *
 * Browser selection (optional env):
 *   PW_CHANNEL=chrome    use the locally installed Chrome (default on dev machines)
 *   PW_CHANNEL=msedge    use the locally installed Edge
 *   PW_CHANNEL=bundled   force the Playwright-bundled Chromium
 *   unset + CI=true      bundled Chromium (CI: npx playwright install chromium)
 *
 * Every check runs in its own isolated browser context. The page is opened both
 * via file:// (primary usage) and through a loopback-only static server that
 * serves a fixed allowlist (hosted-compatibility check). Rendering checks read
 * real pixels back from the WebGL2 drawing buffer. Rebuild reproducibility of
 * build/build_museum.py is checked separately by tests/test_build_museum.py
 * and by the CI diff check.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'test-results');
const FILE_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const SERVE_ALLOWLIST = ['index.html'];
const TEST_TIMEOUT_MS = 60_000;

function launchOptions() {
  const channel = process.env.PW_CHANNEL;
  if (channel === 'bundled' || channel === '') return {};
  if (channel) return { channel };
  return process.env.CI ? {} : { channel: 'chrome' };
}

async function launchBrowser() {
  const { chromium } = require('playwright');
  return chromium.launch(launchOptions());
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
    };
    const server = http.createServer((req, res) => {
      let name;
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        name = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      } catch {
        res.writeHead(400); res.end('bad request'); return;
      }
      if (name === 'favicon.ico') { res.writeHead(204); res.end(); return; } // browsers auto-request this; the app ships none
      if (!SERVE_ALLOWLIST.includes(name)) { res.writeHead(404); res.end('not found'); return; }
      try {
        const body = fs.readFileSync(path.join(ROOT, name));
        res.writeHead(200, {
          'content-type': types[path.extname(name)] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(body);
      } catch {
        res.writeHead(500); res.end('error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

function trackOffsiteRequests(context, allowedPrefixes) {
  const offsite = [];
  context.on('request', (request) => {
    const url = request.url();
    if (!allowedPrefixes.some((prefix) => url.startsWith(prefix))) offsite.push(url);
  });
  return offsite;
}

function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  return errors;
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${TEST_TIMEOUT_MS} ms`)), TEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/*
 * Forces a synchronous redraw via the page's own draw() and reads the drawing
 * buffer in the same task (no preserveDrawingBuffer needed). Background clear
 * color is (0.025, 0.045, 0.085); anything farther than a small threshold
 * counts as model pixels.
 */
async function canvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { webgl2: false };
    draw();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let nonBg = 0;
    for (let i = 0; i < px.length; i += 4) {
      const distance = Math.abs(px[i] - 6) + Math.abs(px[i + 1] - 11) + Math.abs(px[i + 2] - 22);
      if (distance > 30) nonBg += 1;
    }
    return { webgl2: true, w, h, nonBg, total: w * h };
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('file:// load: single-file page, exhibit 1 of 3, canvas renders', async (context) => {
  const offsite = trackOffsiteRequests(context, ['file://', 'blob:', 'data:']);
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  await page.goto(FILE_URL);
  assert.equal(await page.evaluate(() => document.querySelectorAll('script[src], link[href]').length), 0, 'no external scripts or stylesheets');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 1 / 3');
  assert.equal(await page.locator('#title').textContent(), 'The sphere');
  assert.equal(await page.locator('#previous').isDisabled(), true);
  assert.equal(await page.locator('#next').isDisabled(), false);
  assert.equal(await page.locator('#captions article').count(), 3);
  assert.equal(await page.locator('#dots button').count(), 3);
  const stats = await canvasStats(page);
  assert.equal(stats.webgl2, true, 'WebGL2 context present');
  assert.ok(stats.nonBg > 500, `exhibit renders (nonBg=${stats.nonBg})`);
  await page.screenshot({ path: path.join(ARTIFACTS, 'museum-file.png'), fullPage: true });
  assert.deepEqual(offsite, [], 'no requests outside file://');
  assert.deepEqual(errors, [], 'no page or console errors');
});

test('navigation clamps at both ends and responds to keys and dots', async (context) => {
  const page = await context.newPage();
  await page.goto(FILE_URL);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 1 / 3');
  assert.equal(await page.locator('#previous').isDisabled(), true);
  await page.click('#next');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 2 / 3');
  assert.equal(await page.locator('#title').textContent(), 'The torus');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 3 / 3');
  assert.equal(await page.locator('#title').textContent(), 'The cylinder');
  assert.equal(await page.locator('#next').isDisabled(), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 3 / 3');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 1 / 3');
  assert.equal(await page.locator('#previous').isDisabled(), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 1 / 3');
  await page.locator('#dots button').nth(1).click();
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 2 / 3');
  assert.equal(await page.locator('#dots button').nth(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#dots button').nth(0).getAttribute('aria-pressed'), 'false');
  const stats = await canvasStats(page);
  assert.ok(stats.nonBg > 500, `exhibit renders after navigation (nonBg=${stats.nonBg})`);
});

test('no-WebGL fallback keeps captions readable and navigation working', async (context) => {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...rest);
    };
  });
  const page = await context.newPage();
  const errors = trackPageErrors(page);
  await page.goto(FILE_URL);
  assert.match(await page.locator('#message').textContent(), /3D rendering is unavailable\. All exhibit captions and navigation still work\./);
  assert.equal(await page.locator('#canvas').isVisible(), false);
  assert.equal(await page.locator('#captions article').count(), 3);
  assert.equal(await page.locator('#title').textContent(), 'The sphere');
  await page.click('#next');
  assert.equal(await page.locator('#title').textContent(), 'The torus');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 3 / 3');
  assert.deepEqual(errors, [], 'no page or console errors');
});

test('print mode keeps captions readable and hides interactive chrome', async (context) => {
  await context.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls += 1; };
  });
  const page = await context.newPage();
  await page.goto(FILE_URL);
  await page.click('#print');
  assert.equal(await page.evaluate(() => window.__printCalls), 1, 'print button wired to window.print');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#canvas').evaluate((el) => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.toolbar').first().evaluate((el) => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('#captions article').first().isVisible(), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'screen' });
  assert.equal(await page.locator('#canvas').isVisible(), true, 'canvas visible again on screen');
});

test('hosted compatibility: loopback server serves only the fixed page', async (context) => {
  const { server, origin } = await startStaticServer();
  try {
    const offsite = trackOffsiteRequests(context, [`${origin}/`, 'blob:', 'data:']);
    const page = await context.newPage();
    const errors = trackPageErrors(page);
    await page.goto(`${origin}/`);
    assert.equal(await page.locator('#step').textContent(), 'EXHIBIT 1 / 3');
    await page.click('#next');
    assert.equal(await page.locator('#title').textContent(), 'The torus');
    const stats = await canvasStats(page);
    assert.equal(stats.webgl2, true);
    assert.ok(stats.nonBg > 500, `exhibit renders over http (nonBg=${stats.nonBg})`);
    for (const probe of ['/exhibit.json', '/build/build_museum.py', '/package.json', '/%2e%2e/package.json']) {
      const response = await context.request.get(`${origin}${probe}`);
      assert.equal(response.status(), 404, `expected 404 for ${probe}`);
    }
    assert.deepEqual(offsite, [], 'no requests outside the loopback origin');
    assert.deepEqual(errors, [], 'no page or console errors');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function runTests() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const browser = await launchBrowser();
  let failures = 0;
  for (const { name, fn } of tests) {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    try {
      await withTimeout(fn(context), name);
      console.log(`ok - ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL - ${name}`);
      console.error(error && error.stack ? error.stack : error);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  console.log(`${tests.length - failures}/${tests.length} browser checks passed`);
  process.exit(failures ? 1 : 0);
}

module.exports = { launchBrowser, startStaticServer };

if (require.main === module) {
  runTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
