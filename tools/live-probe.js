#!/usr/bin/env node
/**
 * Small, polite requests to each public service the web app uses (and to other
 * public Overpass servers that could back it up), recording status, time, size
 * and, for Overpass, how fresh the data is (osm3s.timestamp_osm_base).
 * Writes results/probe.json. Run by .github/workflows/live-check.yml.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'results');
const UA = 'SupplierScout-live-check/1.0 (+https://github.com/Dsergio909/supplier-scout)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(name, url, init) {
  const started = Date.now();
  const opts = Object.assign({}, init || {});
  opts.headers = Object.assign({ 'User-Agent': UA, Referer: 'https://dsergio909.github.io/' }, opts.headers || {});
  opts.signal = AbortSignal.timeout(60000);
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    const out = { name, status: res.status, ms: Date.now() - started, bytes: text.length, head: text.slice(0, 200) };
    try {
      const json = JSON.parse(text);
      if (json.osm3s) out.dataDate = json.osm3s.timestamp_osm_base;
      if (Array.isArray(json.elements)) {
        out.elements = json.elements.length;
        out.names = json.elements.slice(0, 6).map((e) => (e.tags && e.tags.name) + ' [' + ['craft', 'shop', 'office', 'amenity'].map((k) => e.tags && e.tags[k] ? k + '=' + e.tags[k] : '').filter(Boolean).join(',') + ']');
      }
    } catch (e) { /* not JSON */ }
    return out;
  } catch (err) {
    return { name, error: String(err && (err.cause && err.cause.code || err.name + ': ' + err.message)), ms: Date.now() - started };
  }
}

const AROUND = '(around:5000,4.628,-74.151)';
// What the app sent before: a name regex over every named object in the area.
const HEAVY = `[out:json][timeout:25];(nwr["craft"="plumber"]${AROUND};nwr["name"~"plomer|fontaner|hidraul",i]${AROUND};);out center tags 60;`;
// Name regex only on businesses (shop, craft, office).
const LIGHT = `[out:json][timeout:25];(nwr["craft"="plumber"]${AROUND};nwr["shop"]["name"~"plomer|fontaner|hidraul",i]${AROUND};nwr["craft"]["name"~"plomer|fontaner|hidraul",i]${AROUND};nwr["office"]["name"~"plomer|fontaner|hidraul",i]${AROUND};);out center tags 60;`;

const SERVERS = [
  ['overpass-api.de', 'https://overpass-api.de/api/interpreter'],
  ['private.coffee', 'https://overpass.private.coffee/api/interpreter'],
  ['kumi.systems', 'https://overpass.kumi.systems/api/interpreter'],
  ['mail.ru', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  // Nominatim can also search businesses near a point (its "special phrases"),
  // with phone and website in extratags. Is it a usable fallback when Overpass is down?
  const box = (lat, lng, d) => [lng - d, lat + d, lng + d, lat - d].map((x) => x.toFixed(4)).join(',');
  const nomi = (q, lat, lng, d) => 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    q, format: 'jsonv2', limit: '40', viewbox: box(lat, lng, d), bounded: '1', addressdetails: '1', extratags: '1'
  });
  const cases = [
    ['ferretería · Kennedy', 'ferretería', 4.628, -74.151, 0.05],
    ['hardware store · Kennedy', 'hardware store', 4.628, -74.151, 0.05],
    ['plomero · Kennedy', 'plomero', 4.628, -74.151, 0.05],
    ['plumber · Bogotá', 'plumber', 4.65, -74.10, 0.12],
    ['[shop=hardware] · Barranquilla', '[shop=hardware]', 10.98, -74.80, 0.08],
    ['ferretería · Barranquilla', 'ferretería', 10.98, -74.80, 0.08],
    ['papelería · Chapinero', 'papelería', 4.65, -74.06, 0.04],
    ['cerrajería · Medellín', 'cerrajería', 6.25, -75.57, 0.08]
  ];
  for (const [name, q, lat, lng, d] of cases) {
    await sleep(1500);
    const r = await probe('nominatim ' + name, nomi(q, lat, lng, d));
    try {
      const arr = JSON.parse(r.head.length < r.bytes ? (await (await fetch(nomi(q, lat, lng, d), { headers: { 'User-Agent': UA } })).text()) : r.head);
      r.elements = arr.length;
      r.names = arr.slice(0, 6).map((e) => `${e.name} [${e.category}=${e.type}]${e.extratags && (e.extratags.phone || e.extratags['contact:phone']) ? ' tel' : ''}`);
      r.kinds = [...new Set(arr.map((e) => e.category + '=' + e.type))].slice(0, 8);
    } catch (e) { r.parseError = String(e.message); }
    delete r.head;
    results.push(r);
    await sleep(1100);
  }
  await sleep(2000);
  results.push(await probe('overpass-api.de status', 'https://overpass-api.de/api/status'));
  for (const r of results) console.log(JSON.stringify(r));
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
})();
