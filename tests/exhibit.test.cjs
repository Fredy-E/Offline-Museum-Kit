const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exhibit.json'), 'utf8'));
assert(typeof data.title === 'string' && data.title.length > 0);
assert(typeof data.description === 'string' && data.description.length > 0);
assert(Array.isArray(data.items) && data.items.length >= 1);
for (const item of data.items) {
  assert(typeof item.title === 'string' && item.title.length > 0);
  assert(typeof item.description === 'string');
  assert(['sphere', 'torus', 'cylinder'].includes(item.shape), `unknown shape: ${item.shape}`);
}
console.log(`Passed: exhibit data structure (${data.items.length} exhibits).`);
