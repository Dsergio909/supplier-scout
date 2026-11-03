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
  const post = (q) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'data=' + encodeURIComponent(q) });
  results.push(await probe('nominatim', 'https://nominatim.openstreetmap.org/search?q=Kennedy%2C%20Bogot%C3%A1&format=jsonv2&limit=1&countrycodes=co'));
  for (const [name, url] of SERVERS) {
    await sleep(2000);
    results.push(await probe(name + ' light', url, post(LIGHT)));
  }
  await sleep(2000);
  results.push(await probe('overpass-api.de heavy', SERVERS[0][1], post(HEAVY)));
  await sleep(2000);
  results.push(await probe('overpass-api.de light again', SERVERS[0][1], post(LIGHT)));
  await sleep(1500);
  results.push(await probe('osrm', 'https://router.project-osrm.org/table/v1/driving/-74.151,4.628;-74.140,4.630?sources=0&annotations=duration,distance'));
  for (const r of results) console.log(JSON.stringify(r));
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
})();
