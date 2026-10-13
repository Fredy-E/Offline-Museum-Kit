'use strict';
/* UI regression for the portfolio preview shell (static, no browser).
 * Run: node tests/ui-regression.cjs
 * RED on the pre-redesign page (no data-ui-revision / prototype notice / ui tokens).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vendorCss = fs.readFileSync(path.join(ROOT, 'build', 'vendor', 'style.css'), 'utf8');

let n = 0;
function check(name, cond, extra) {
  n += 1;
  assert.ok(cond, `${name}${extra ? ' — ' + extra : ''}`);
  console.log(`ok ${n} - ${name}`);
}

// 1. Principal shell carries the preview revision marker.
check('principal shell has data-ui-revision="portfolio-preview-1"',
  html.includes('data-ui-revision="portfolio-preview-1"'));

// 2. Visible prototype notice with the exact approved wording.
const m = html.match(/<[^>]*id="prototype-notice"[^>]*>([\s\S]*?)<\/p>/);
check('#prototype-notice exists', !!m);
if (m) {
  const text = m[1].replace(/<[^>]+>/g, ' ');
  check('notice carries exact concept-prototype sentence',
    text.includes('Experimental concept prototype — idea exploration only.'), text.slice(0, 160));
  check('notice states not finished/production-ready',
    /not (a )?finished/i.test(text) && /production-ready/i.test(text), text.slice(0, 160));
}

// 3. Family UI tokens on :root (authoritative vendor stylesheet).
for (const tok of ['--ui-bg', '--ui-surface', '--ui-ink', '--ui-muted', '--ui-accent', '--ui-border', '--ui-radius']) {
  check(`vendor style defines ${tok}`, vendorCss.includes(tok));
}

// 4. Existing exhibit controls/ids/actions/content intact.
for (const id of ['intro', 'step', 'title', 'description', 'previous', 'next', 'dots', 'print', 'message', 'captions', 'canvas']) {
  check(`existing id #${id} intact`, html.includes(`id="${id}"`));
}
check('exhibit.json content embedded byte-identical (The sphere/torus/cylinder)',
  html.includes('The sphere') && html.includes('The torus') && html.includes('The cylinder'));
check('geometry/renderer modules embedded', html.includes('MeshGeometry') && html.includes('MeshRenderer'));
check('print button still wired to window.print', html.includes("$('print').onclick") || html.includes('id="print"'));

// 5. Readability/accessibility guardrails in authoritative CSS.
check('visible keyboard focus style', /:focus-visible/.test(vendorCss));
check('reduced-motion honored', /prefers-reduced-motion/.test(vendorCss));
check('system color scheme adaptation without persistence', /prefers-color-scheme:\s*light/.test(vendorCss));
check('print stylesheet keeps captions readable', /@media\s+print/.test(vendorCss + html) && /captions/.test(vendorCss + html));
check('responsive small-viewport rule', /max-width:\s*760px/.test(vendorCss) || /320px/.test(vendorCss));

// 6. System fonts only (no webfont/CDN fetches in the single file).
check('no external scripts/stylesheets', !/<script\s+src=|<link\s+[^>]*href="http/i.test(html));
check('no @import webfont', !/@import\s+url\(http/i.test(vendorCss + html));

console.log(`Passed: portfolio preview UI regression (${n} checks).`);
