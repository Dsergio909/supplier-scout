// Static guards for the demo page: it must deploy as-is to GitHub Pages and stay locked down.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'demo', 'app.js'), 'utf8');

test('every script the page loads exists and is one Pages deploys (demo/, src/core, src/data)', () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 10);
  for (const src of srcs) {
    const file = path.join(root, 'demo', src);
    assert.ok(fs.existsSync(file), src);
    assert.match(path.relative(root, file), /^(demo|src[\\/](core|data))[\\/]/, src);
  }
});

test('strict Content-Security-Policy: own scripts only, network only to OpenStreetMap, no inline code', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.match(csp, /default-src 'none'/);
  const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(directives['connect-src'], ['https://nominatim.openstreetmap.org', 'https://overpass-api.de'],
    'the live search may reach the two OpenStreetMap services and nothing else');
  for (const [name, values] of Object.entries(directives)) {
    if (name !== 'connect-src') assert.ok(!values.some((v) => /^https?:/.test(v)), `${name} allows no other site (fonts are self-hosted)`);
  }
  assert.doesNotMatch(html, /<link[^>]+href="https?:/, 'no stylesheet or font from another site');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)|<script(?![^>]*src=)[^>]*>/, 'no inline scripts');
  assert.doesNotMatch(html, /\son[a-z]+="/i, 'no inline event handlers');
});

test('the app never renders untrusted text as HTML', () => {
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
});

test('only demo/live.js uses the network; the core modules and the rest of the page never do', () => {
  for (const file of fs.readdirSync(path.join(root, 'src', 'core'))) {
    const code = fs.readFileSync(path.join(root, 'src', 'core', file), 'utf8');
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/, file);
  }
  for (const file of fs.readdirSync(path.join(root, 'demo')).filter((f) => f.endsWith('.js') && f !== 'live.js')) {
    const code = fs.readFileSync(path.join(root, 'demo', file), 'utf8');
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/, file);
  }
});

test('self-hosted fonts exist, with their licence', () => {
  const css = fs.readFileSync(path.join(root, 'demo', 'style.css'), 'utf8');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 4, 'IBM Plex Sans 400/500/600 and Plex Mono 400');
  urls.forEach((u) => assert.ok(fs.existsSync(path.join(root, 'demo', u)), u));
  assert.ok(fs.readdirSync(path.join(root, 'demo', 'fonts')).some((f) => /^OFL/.test(f)));
});

test('every interface text exists in Spanish, English, Portuguese and French', () => {
  global.window = global;
  require('../demo/i18n.js');
  const all = global.ScoutI18n;
  const keys = (o, prefix = '') => Object.keys(o).flatMap((k) => (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? keys(o[k], prefix + k + '.') : [prefix + k]));
  assert.deepEqual(Object.keys(all), ['es', 'en', 'pt', 'fr']);
  for (const lang of ['en', 'pt', 'fr']) {
    assert.deepEqual(keys(all[lang]).sort(), keys(all.es).sort(), lang);
    assert.equal(all[lang].ways.length, all.es.ways.length, lang);
    const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of keys(all.es)) {
      const get = (o) => k.split('.').reduce((v, part) => v[part], o);
      assert.equal(placeholders(get(all[lang])), placeholders(get(all.es)), `${lang}.${k} keeps the same {placeholders}`);
    }
  }
  const buttons = [...html.matchAll(/data-lang="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['es', 'en', 'pt', 'fr'], 'one button per language');
});
