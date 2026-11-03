#!/usr/bin/env node
/**
 * Supplier Scout — check against the real services (run by hand in GitHub
 * Actions: .github/workflows/live-check.yml).
 *
 * Runs the web app's own search code (demo/live.js + src/core) against the real
 * OpenStreetMap services for searches a buyer would make, then checks every
 * result independently on the OpenStreetMap API: the place must exist and its
 * name must be the one the app showed. Nothing here is simulated.
 *
 * Polite by design: one identifying User-Agent, the app's own one-request-per-
 * second queues for Nominatim and OSRM, a pause between Overpass queries, and
 * only a few API lookups per search.
 *
 * Writes results/live-check.json and results/REPORT.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'results');
const UA = 'SupplierScout-live-check/1.0 (+https://github.com/Dsergio909/supplier-scout)';
const VERIFY_PER_SEARCH = 4;

const SCENARIOS = [
  { what: 'plomero', place: 'Kennedy, Bogotá', country: 'CO', radiusKm: 5 },
  { what: 'ferretería', place: 'Barranquilla', country: 'CO', radiusKm: 5 },
  { what: 'mantenimiento de aires acondicionados', place: 'Medellín', country: 'CO', radiusKm: 5 },
  { what: 'cajas de cartón', place: 'Fontibón, Bogotá', country: 'CO', radiusKm: 6 },
  { what: 'cerrajero', place: 'San Gil', country: 'CO', radiusKm: 5 },
  { what: 'plomero', place: 'San Pedro', country: 'CO', radiusKm: 5, expect: 'homonyms' },
  { what: 'ferretería', place: 'Lima', country: 'CO', radiusKm: 5, expect: 'other-country' },
  { what: 'fumigación', place: 'Miraflores, Lima', country: 'PE', radiusKm: 5 },
  { what: 'tlapalería', place: 'Coyoacán, Ciudad de México', country: 'MX', radiusKm: 4 },
  { what: 'borracharia', place: 'Pinheiros, São Paulo', country: 'BR', radiusKm: 4 },
  { what: 'recarga de extintores', place: 'Cali', country: 'CO', radiusKm: 6 },
  { what: 'papelería', place: 'Chapinero, Bogotá', country: 'CO', radiusKm: 3 }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function politeFetch(url, init) {
  const opts = Object.assign({}, init || {});
  opts.headers = Object.assign({ 'User-Agent': UA }, opts.headers || {});
  delete opts.referrerPolicy;
  return fetch(url, opts);
}

function loadApp() {
  const ctx = {
    ScoutCountries: require('../src/core/countries'),
    ScoutCategories: require('../src/core/categories'),
    ScoutOsm: require('../src/core/osm'),
    ScoutText: require('../src/core/text'),
    ScoutServices: require('../src/core/services'),
    URLSearchParams, AbortController, setTimeout, clearTimeout, Promise, Date, JSON, Math,
    fetch: politeFetch
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'demo', 'live.js'), 'utf8'), ctx);
  return ctx.ScoutLive;
}

function mainTag(tags) {
  for (const k of ['craft', 'shop', 'office', 'amenity', 'landuse']) if (tags && tags[k]) return k + '=' + tags[k];
  return '—';
}

/** Ask the OpenStreetMap API for the element and compare its name. */
async function verifyOnOsm(supplier) {
  const m = /^osm:(node|way|relation)\/(\d+)$/.exec(supplier.sources[0].ref);
  if (!m) return { ok: false, reason: 'no OSM reference' };
  const res = await politeFetch(`https://api.openstreetmap.org/api/0.6/${m[1]}/${m[2]}.json`, { headers: { Accept: 'application/json' } });
  if (res.status === 410) return { ok: false, reason: 'deleted on OSM' };
  if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status };
  const json = await res.json();
  const el = json.elements && json.elements[0];
  const name = el && el.tags && el.tags.name;
  return { ok: name === supplier.name, reason: name === supplier.name ? 'exists, same name' : `name on OSM: ${name || '(none)'}`, tag: mainTag(el && el.tags) };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const Live = loadApp();
  const Services = require('../src/core/services');
  const report = [];
  for (const sc of SCENARIOS) {
    const started = Date.now();
    const entry = { scenario: sc, understood: Services.describe(Services.interpret(sc.what), 'es') };
    try {
      const res = await Live.search(Object.assign({ fx: { USD: 1 } }, sc));
      entry.place = { label: res.point.label, full: res.point.full, kind: res.point.kind, country: res.country, lat: res.point.lat, lng: res.point.lng };
      entry.alternatives = res.alternatives.map((a) => a.label + (a.country && a.country !== res.country ? ' (' + a.country + ')' : ''));
      entry.movedFrom = res.movedFrom;
      entry.scope = res.scope;
      entry.radiusKm = res.radiusKm;
      entry.stats = res.stats;
      entry.travelTimes = res.travel ? Object.keys(res.travel).length : 0;
      const sups = res.dataset.suppliers;
      entry.results = sups.slice(0, 15).map((s) => ({
        name: s.name, ref: s.sources[0].ref, phone: s.phones[0] || null, web: s.websites[0] || null,
        address: [s.address, s.city].filter(Boolean).join(', ') || null,
        minutes: res.travel && res.travel[s.id] ? res.travel[s.id].minutes : null
      }));
      entry.verified = [];
      for (const s of sups.slice(0, VERIFY_PER_SEARCH)) {
        await sleep(1100);
        entry.verified.push(Object.assign({ name: s.name, ref: s.sources[0].ref }, await verifyOnOsm(s)));
      }
    } catch (err) {
      entry.error = (err && (err.code || err.message)) || String(err);
    }
    entry.seconds = Math.round((Date.now() - started) / 100) / 10;
    report.push(entry);
    console.log(JSON.stringify({ what: sc.what, place: sc.place, found: entry.stats && entry.stats.total, error: entry.error || null }));
    await sleep(3000); // be gentle with the public Overpass server
  }
  fs.writeFileSync(path.join(OUT, 'live-check.json'), JSON.stringify({ at: new Date().toISOString(), report }, null, 2));

  const lines = ['# Supplier Scout · prueba con datos reales', '', `Fecha: ${new Date().toISOString()}`, ''];
  for (const e of report) {
    const sc = e.scenario;
    lines.push(`## ${sc.what} · ${sc.place} (${sc.country})`, '');
    lines.push(`- Entendió: ${e.understood.join(', ') || '(por nombre)'}`);
    if (e.error) { lines.push(`- **Error:** ${e.error}`, ''); continue; }
    lines.push(`- Lugar: ${e.place.label} · ${e.place.kind || '?'} · ${e.place.country} · ${e.place.full}`);
    if (e.movedFrom) lines.push(`- Cambió de país: ${e.movedFrom} → ${e.place.country}`);
    if (e.alternatives.length) lines.push(`- Alternativas: ${e.alternatives.join(' · ')}`);
    lines.push(`- Alcance: ${e.scope}, ${e.radiusKm} km · ${e.seconds} s`);
    lines.push(`- Encontrados: ${e.stats.total} · sin web ${e.stats.withoutWebsite} · con teléfono ${e.stats.withPhone} · con tiempo en carro ${e.travelTimes}`);
    for (const r of e.results) lines.push(`  - ${r.name} · ${r.ref}${r.phone ? ' · ' + r.phone : ''}${r.minutes ? ' · ' + r.minutes + ' min' : ''}${r.address ? ' · ' + r.address : ''}`);
    lines.push(`- Verificados en la API de OSM: ${e.verified.filter((v) => v.ok).length}/${e.verified.length}`);
    for (const v of e.verified) lines.push(`  - ${v.ok ? 'OK' : 'NO'} ${v.name} (${v.ref}) — ${v.reason}${v.tag ? ' · ' + v.tag : ''}`);
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), lines.join('\n'));
}

main().catch((err) => { console.error(err); process.exit(1); });
