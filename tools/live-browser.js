#!/usr/bin/env node
/**
 * Supplier Scout — the web app in a real browser against the real services
 * (run by hand in GitHub Actions: .github/workflows/live-check.yml).
 *
 * Serves the site locally, types real searches the way a buyer would and
 * records what the page shows: the status line, the cards, whether the map
 * tiles loaded, and any console or security-policy error. Saves screenshots.
 *
 * Usage: node tools/live-browser.js http://127.0.0.1:8000/demo/
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_ = process.argv[2] || 'http://127.0.0.1:8000/demo/';
const OUT = path.join(__dirname, '..', 'results');

const RUNS = [
  { tag: 'bogota', what: 'plomero', place: 'Kennedy, Bogotá', viewport: { width: 1280, height: 900 } },
  { tag: 'barranquilla', what: 'ferretería', place: 'Barranquilla', viewport: { width: 1280, height: 900 } },
  { tag: 'movil-medellin', what: 'mantenimiento de aires acondicionados', place: 'Medellín', viewport: { width: 390, height: 844 } }
];

async function run(browser, r) {
  const ctx = await browser.newContext({ viewport: r.viewport, locale: 'es-CO' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.type() + ': ' + m.text()); });
  const out = { tag: r.tag, what: r.what, place: r.place };
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.fill('#liveWhat', r.what);
  await page.fill('#livePlace', r.place);
  await page.waitForTimeout(400);
  await page.click('#liveSearch');
  await page.waitForFunction(() => {
    const s = document.getElementById('liveStatus');
    return s && /ok|warn|error/.test(s.className);
  }, null, { timeout: 90000 }).catch(() => problems.push('no final status after 90 s'));
  await page.waitForTimeout(3000); // let the map tiles arrive
  out.status = await page.locator('#liveStatus').textContent();
  out.understood = await page.locator('#understood').textContent();
  out.badge = await page.locator('#envBadge').textContent();
  out.cards = await page.locator('#results .card').count();
  out.first = await page.locator('#results .card .name').allTextContents().then((n) => n.slice(0, 8));
  out.firstFacts = await page.locator('#results .card .facts').first().textContent().catch(() => null);
  out.tiles = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('#map .map-tile'));
    return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length };
  });
  out.markers = await page.locator('#map .map-marker').count();
  out.alternatives = await page.locator('#altRow').isVisible() ? await page.locator('#altChips').textContent() : null;
  await page.screenshot({ path: path.join(OUT, `real-${r.tag}.png`), fullPage: false });
  await page.locator('#map').screenshot({ path: path.join(OUT, `real-${r.tag}-mapa.png`) }).catch(() => {});
  await page.locator('#results').screenshot({ path: path.join(OUT, `real-${r.tag}-resultados.png`) }).catch(() => {});
  if (r.tag === 'bogota' && out.cards >= 3) {
    for (let i = 0; i < 3; i++) await page.locator('#results .card').nth(i).locator('.actions button').first().click();
    await page.click('[data-tab="list"]');
    await page.click('#bulkOpen');
    await page.waitForTimeout(300);
    out.bulkPreview = await page.locator('#bulkPreview').textContent();
    await page.screenshot({ path: path.join(OUT, `real-${r.tag}-lista.png`), fullPage: true });
  }
  out.problems = problems;
  await ctx.close();
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  for (const r of RUNS) {
    try { results.push(await run(browser, r)); } catch (err) { results.push({ tag: r.tag, error: String(err && err.message || err) }); }
    console.log(JSON.stringify(results[results.length - 1]));
    await new Promise((res) => setTimeout(res, 3000));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'live-browser.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
})();
