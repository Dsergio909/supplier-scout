#!/usr/bin/env node
/**
 * One small request to each public service the web app uses, recording the
 * status, the time and the start of the answer, to tell which one fails and why.
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
    return { name, status: res.status, ms: Date.now() - started, bytes: text.length, head: text.slice(0, 400), headers: Object.fromEntries([...res.headers].filter(([k]) => /retry|rate|content-type|server|x-/i.test(k))) };
  } catch (err) {
    return { name, error: String(err && (err.cause && err.cause.code || err.name + ': ' + err.message)), ms: Date.now() - started };
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const q = '[out:json][timeout:25];(nwr["craft"="plumber"](around:2000,4.628,-74.151););out center tags 20;';
  const results = [];
  results.push(await probe('nominatim', 'https://nominatim.openstreetmap.org/search?q=Kennedy%2C%20Bogot%C3%A1&format=jsonv2&limit=1&countrycodes=co'));
  await sleep(1500);
  results.push(await probe('overpass-status', 'https://overpass-api.de/api/status'));
  await sleep(1500);
  results.push(await probe('overpass-query', 'https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'data=' + encodeURIComponent(q)
  }));
  await sleep(1500);
  results.push(await probe('overpass-query-get', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q)));
  await sleep(1500);
  results.push(await probe('osrm', 'https://router.project-osrm.org/table/v1/driving/-74.151,4.628;-74.140,4.630?sources=0&annotations=duration,distance'));
  await sleep(1500);
  results.push(await probe('osm-api', 'https://api.openstreetmap.org/api/0.6/node/1.json'));
  for (const r of results) console.log(JSON.stringify(r));
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
})();
