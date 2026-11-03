// OpenStreetMap logic shared by the CLI and the web demo, the Google Maps link,
// and the browser live search (demo/live.js) run against fake responses.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Osm = require('../src/core/osm');
const Countries = require('../src/core/countries');
const Categories = require('../src/core/categories');

test('Google Maps link: official search URL, no key, text encoded', () => {
  const url = new URL(Osm.mapsSearchUrl('Ferretería', 'Kennedy, Bogotá, Colombia'));
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/search/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), 'Ferretería, Kennedy, Bogotá, Colombia');
  assert.equal([...url.searchParams.keys()].length, 2, 'nothing else, no API key');
  assert.equal(new URL(Osm.mapsSearchUrl('a\nb', '  c  ')).searchParams.get('query'), 'a b, c', 'control characters and extra spaces removed');
  assert.throws(() => Osm.mapsSearchUrl('', ''));
});

test('geocoding URL is limited to the chosen country and parses the first hit', () => {
  const url = new URL(Osm.geocodeUrl('Kennedy, Bogotá', 'CO'));
  assert.equal(url.searchParams.get('countrycodes'), 'co');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.deepEqual(Osm.parseGeocode([{ lat: '4.62', lon: '-74.15', display_name: 'Kennedy, Bogotá' }], 'x'), { lat: 4.62, lng: -74.15, label: 'Kennedy, Bogotá' });
  assert.equal(Osm.parseGeocode([], 'x'), null);
  assert.equal(Osm.parseGeocode([{ lat: 'x', lon: 'y' }], 'x'), null);
});

function loadLive(fakeFetch) {
  const ctx = { ScoutCountries: Countries, ScoutCategories: Categories, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: fakeFetch };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'osm.js'), 'utf8'), ctx);
  ctx.ScoutText = require('../src/core/text');
  ctx.ScoutServices = require('../src/core/services');
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'demo', 'live.js'), 'utf8'), ctx);
  return ctx.ScoutLive;
}

// Objects built inside the vm context have another realm's prototypes: compare plain values.
const plain = (v) => JSON.parse(JSON.stringify(v));

function response(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) });
}

test('live search: geocodes, queries Overpass and returns a dataset the demo can load', async () => {
  const calls = [];
  const Live = loadLive((url, init) => {
    calls.push({ url, init });
    if (url.startsWith(Osm.GEOCODE_ENDPOINT)) return response(200, [{ lat: '4.628', lon: '-74.151', display_name: 'Kennedy, Bogotá' }]);
    return response(200, { elements: [
      { type: 'node', id: 1, lat: 4.63, lon: -74.15, tags: { name: 'Ferretería El Tornillo', shop: 'hardware', phone: '601 555 1234' } },
      { type: 'way', id: 2, center: { lat: 4.62, lon: -74.16 }, tags: { name: 'Depósito La 38', shop: 'hardware', website: 'https://deposito.example' } },
      { type: 'node', id: 3, lat: 4.6, lon: -74.1, tags: { shop: 'hardware' } }
    ] });
  });
  const res = await Live.search({ place: 'Kennedy, Bogotá', country: 'CO', category: 'hardware', radiusKm: 25, fx: { USD: 3900 } });
  assert.equal(calls.length, 2, 'one geocoding call and one Overpass call');
  assert.equal(calls[0].init.referrerPolicy, 'strict-origin-when-cross-origin', 'Nominatim asks browser apps for a Referer');
  assert.equal(calls[1].init.method, 'POST');
  assert.match(decodeURIComponent(calls[1].init.body), /around:10000,4\.628,-74\.151/, 'radius capped at 10 km');
  assert.equal(res.radiusKm, 10);
  assert.equal(res.dataset.suppliers.length, 2, 'unnamed places are skipped');
  assert.deepEqual(plain(res.stats), { total: 2, withWebsite: 1, withoutWebsite: 1, withPhone: 1 });
  assert.equal(res.dataset.live, true);
  assert.deepEqual(plain(res.dataset.origins), [{ id: 'live', label: 'Kennedy, Bogotá', lat: 4.628, lng: -74.151 }]);
  assert.equal(res.dataset.needs[0].originId, 'live');
  assert.equal(res.dataset.suppliers[0].sources[0].type, 'map');
});

test('live search: clear error codes for the cases the page explains', async () => {
  const notFound = loadLive(() => response(200, []));
  await assert.rejects(notFound.search({ place: 'Nowhere', country: 'CO', category: 'hardware' }), { code: 'place-not-found' });
  const busy = loadLive((url) => (url.startsWith(Osm.GEOCODE_ENDPOINT) ? response(200, [{ lat: '1', lon: '1' }]) : response(429, {})));
  await assert.rejects(busy.search({ place: 'X', country: 'CO', category: 'hardware' }), { code: 'busy' });
  const offline = loadLive(() => Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(offline.search({ place: 'X', country: 'CO', category: 'hardware' }), { code: 'network' });
});

test('live search: what the buyer typed decides the map query, with no quantity', async () => {
  let body = '';
  const Live = loadLive((url, init) => {
    if (url.startsWith(Osm.GEOCODE_ENDPOINT)) return response(200, [{ lat: '4.628', lon: '-74.151' }]);
    body = decodeURIComponent(init.body);
    return response(200, { elements: [{ type: 'node', id: 9, lat: 4.63, lon: -74.15, tags: { name: 'Refrigeración Polar', craft: 'hvac' } }] });
  });
  const res = await Live.search({ what: 'mantenimiento de aires acondicionados', place: 'Kennedy, Bogotá', country: 'CO', radiusKm: 5 });
  assert.match(body, /nwr\["craft"="hvac"\]/);
  assert.doesNotMatch(body, /plumber/);
  assert.equal(res.dataset.needs[0].item, 'mantenimiento de aires acondicionados');
  assert.equal(res.dataset.needs[0].quantity, null);
  assert.equal(res.dataset.suppliers[0].name, 'Refrigeración Polar');
  await assert.rejects(Live.search({ what: 'de la', place: 'X', country: 'CO' }), { code: 'nothing-to-search' });
});
