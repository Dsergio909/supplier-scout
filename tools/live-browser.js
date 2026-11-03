#!/usr/bin/env node
/**
 * Supplier Scout — the web app in a real browser against the real services
 * (run by hand in GitHub Actions: .github/workflows/live-check.yml).
 *
 * Types real searches the way a buyer would, waits for every layer (national
 * suppliers from SECOP II, the map, the web searches), adds suppliers to the
 * list, fills a supplier from a pasted WhatsApp message and opens the quote
 * requests. Records what the page shows, any console or security-policy error,
 * screenshots, and the API responses (results/api.har) so the same searches
 * can be replayed offline while developing.
 *
 * Usage: node tools/live-browser.js http://127.0.0.1:8000/demo/
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_ = process.argv[2] || 'http://127.0.0.1:8000/demo/';
const OUT = path.join(__dirname, '..', 'results');
// Only the map services are recorded: SECOP responses carry individuals' ID numbers,
// and these results are published on a public branch.
const API = /nominatim\.openstreetmap\.org|overpass-api\.de|router\.project-osrm\.org/;
// Phones and emails are blurred in every screenshot (individuals' contacts are personal data).
const BLUR = '.contact a[href^="mailto:"], .contact a[href^="tel:"], #listRows a[href^="tel:"], #listRows a[href^="mailto:"], .near-item .meta, .rfq pre { filter: blur(4px); }';

const RUNS = [
  { tag: 'papeleria', what: 'papelería', place: 'Bogotá', viewport: { width: 1366, height: 900 }, nearby: true, add: 2 },
  { tag: 'aseo-papeleria', what: 'dotación de aseo y papelería', place: 'Bogotá', viewport: { width: 1366, height: 900 }, add: 1 },
  { tag: 'plomero-movil', what: 'plomero', place: 'Kennedy, Bogotá', viewport: { width: 390, height: 844 } },
  { tag: 'extintores', what: 'recarga de extintores', place: 'Medellín', viewport: { width: 1366, height: 900 } },
  { tag: 'toner', what: 'tóner para impresora', place: 'Bucaramanga', viewport: { width: 1366, height: 900 } },
  { tag: 'personas', what: 'recarga de extintores', place: 'Manizales', viewport: { width: 1366, height: 900 }, people: true },
  { tag: 'papeleria-movil', what: 'papelería', place: 'Chapinero, Bogotá', viewport: { width: 390, height: 844 } },
  { tag: 'mexico', what: 'papelería', place: 'Coyoacán', country: 'MX', viewport: { width: 1366, height: 900 } }
];

async function settle(page, maxSeconds) {
  for (let i = 0; i < maxSeconds; i++) {
    await page.waitForTimeout(1000);
    const busy = await page.locator('#results .loading').count();
    if (!busy && i > 1) return true;
  }
  return false;
}

async function run(page, r, problems) {
  const out = { tag: r.tag, what: r.what, place: r.place };
  await page.goto(URL_ + '#buscar', { waitUntil: 'networkidle' });
  if (r.country) await page.selectOption('#country', r.country);
  await page.fill('#what', r.what);
  await page.fill('#place', r.place);
  const started = Date.now();
  await page.click('#go');
  if (!(await settle(page, 60))) problems.push(r.tag + ': results still loading after 60 s');
  out.seconds = Math.round((Date.now() - started) / 100) / 10;
  out.status = (await page.locator('#status').textContent() || '').trim();
  out.layers = await page.locator('#results .layer h2').allTextContents();
  out.national = await page.locator('#layer-national tbody tr').count();
  out.nationalFirst = await page.locator('#layer-national tbody tr .name').allTextContents().then((n) => n.slice(0, 6));
  out.examples = await page.locator('#layer-national tbody tr .example').allTextContents().then((n) => n.slice(0, 4));
  out.phones = await page.locator('#layer-national a[href^="tel:"]').evaluateAll((as) => as.slice(0, 4).map((a) => a.getAttribute('href') + ' ' + a.textContent));
  out.alternatives = await page.locator('.alts button').allTextContents();
  out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  out.filters = await page.locator('.nat-chips button').allTextContents();
  out.personRows = await page.locator('#layer-national tbody tr .meta').evaluateAll((ms) => ms.filter((m) => /^Persona natural/.test(m.textContent)).length);
  out.personNote = await page.locator('.person-note').count();
  if (r.people && await page.locator('.nat-chips button').nth(2).count()) {
    await page.locator('.nat-chips button').nth(2).click();
    await page.waitForTimeout(300);
    out.peopleShown = await page.locator('#layer-national tbody tr .name').allTextContents().then((n) => n.slice(0, 6));
    out.peopleMeta = await page.locator('#layer-national tbody tr td:first-child .meta').allTextContents().then((n) => n.slice(0, 6));
    // An individual's ID must never be on screen: no "NIT" next to a person.
    out.peopleWithNit = out.peopleMeta.filter((m) => /NIT/.test(m)).length;
    await page.locator('#layer-national tbody tr .btn.primary').first().click();
  }
  out.nationalText = ((await page.locator('#layer-national').textContent().catch(() => '')) || '').slice(0, 300);
  out.webLinks = await page.locator('#layer-web a').evaluateAll((as) => as.map((a) => a.href));
  if (r.nearby && await page.locator('#layer-nearby .empty button').count()) {
    await page.locator('#layer-nearby .empty button').click();
    await settle(page, 60);
  }
  out.nearby = await page.locator('#layer-nearby .near-item').count();
  await page.waitForTimeout(2500); // let the map tiles arrive
  out.tiles = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('#map .map-tile'));
    return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length };
  });
  for (let i = 0; i < (r.add || 0); i++) {
    const b = page.locator('#layer-national tbody tr .btn.primary').first();
    if (await b.count()) await b.click();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `real-${r.tag}.png`), fullPage: true });
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-CO', recordHar: { path: path.join(OUT, 'api.har'), urlFilter: API, content: 'embed' } });
  for (const r of RUNS) {
    const page = await ctx.newPage();
    // A constructed stylesheet: the page's CSP (style-src 'self') stays fully in force and is still checked.
    await page.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const sh = new CSSStyleSheet(); sh.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh]; }); }, BLUR);
    await page.setViewportSize(r.viewport);
    page.on('pageerror', (e) => problems.push(r.tag + ' pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(r.tag + ' ' + m.type() + ': ' + m.text()); });
    try { results.push(await run(page, r, problems)); } catch (err) { results.push({ tag: r.tag, error: String(err && err.message || err) }); }
    console.log(JSON.stringify(results[results.length - 1]));
    if (r.tag === 'aseo-papeleria') {
      // My list: the suppliers added above, a known supplier from a WhatsApp message, and the quote requests.
      try {
        await page.goto(URL_ + '#lista');
        await page.click('#addSupplier');
        await page.fill('#pasteText', 'Distribuidora Ejemplo Nacional SAS\nPapelería, aseo y cafetería para empresas\nDespachos a todo el país, crédito a 60 días\nWhatsApp 300 555 0101 · ventas@distribuidoraejemplo.example');
        await page.click('#pasteFill');
        const note = await page.locator('#pasteNote').textContent();
        await page.screenshot({ path: path.join(OUT, 'real-editor.png') });
        await page.click('#editorSave');
        await page.waitForTimeout(300);
        const errorText = await page.locator('#editorError').textContent();
        if (await page.locator('#editor[open]').count()) await page.click('#editorCancel');
        await page.screenshot({ path: path.join(OUT, 'real-lista.png'), fullPage: true });
        await page.click('#askQuotes');
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, 'real-cotizaciones.png') });
        results.push({ tag: 'mi-lista', pasteNote: note, editorError: errorText, rows: await page.locator('#listRows tr').count(), rfq: await page.locator('#rfqList li').count() });
      } catch (err) {
        results.push({ tag: 'mi-lista', error: String(err && err.message || err) });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    }
    await page.close();
    await new Promise((res) => setTimeout(res, 2000));
  }
  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'live-browser.json'), JSON.stringify({ at: new Date().toISOString(), results, problems }, null, 2));
})();
