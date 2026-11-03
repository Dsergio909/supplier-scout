// Connectors against recorded-shape fixtures. No network: see helpers/fake-fetch.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const osm = require('../src/connectors/osm');
const socrata = require('../src/connectors/socrata');
const places = require('../src/connectors/places');
const { fetchJson, readLimited, HttpError, USER_AGENT } = require('../src/connectors/http');
const Schema = require('../src/core/schema');
const { fakeFetch, fixture } = require('./helpers/fake-fetch');

// ---------- OpenStreetMap ----------

test('OSM query: category tags plus an accent-insensitive name search', () => {
  const q = osm.buildQuery({ category: 'packaging', lat: 4.6782, lng: -74.1411, radiusM: 3000 });
  assert.match(q, /nwr\["shop"="packaging"\]\(around:3000,4\.6782,-74\.1411\);/);
  assert.match(q, /nwr\["shop"\]\["name"~"[^"]*\[cç\]\[aáàâã\]rt\[oóôõ\]\[nñ\][^"]*",i\]/, 'matches "cartón" and "carton"');
  for (const key of ['shop', 'craft', 'office']) assert.ok(q.includes(`nwr["${key}"]["name"~`), `name words only on ${key}=*`);
  assert.doesNotMatch(q, /nwr\["name"~/, 'never a name search over every object');
  assert.match(q, /out center tags 60;$/);
});

test('OSM query: radius is clamped and user text cannot break out of the query', () => {
  assert.match(osm.buildQuery({ category: 'hardware', lat: 1, lng: 1, radiusM: 999999 }), /around:10000,/);
  const q = osm.buildQuery({ lat: 1, lng: 1, nameHint: 'x"](around:1,0,0);out;node(1);//' });
  assert.equal((q.match(/"/g) || []).length % 2, 0);
  assert.doesNotMatch(q, /\);out;node/);
  assert.throws(() => osm.buildQuery({ category: 'packaging', lat: 'abc', lng: 1 }), /coordinates/);
  assert.throws(() => osm.buildQuery({ lat: 1, lng: 1, nameHint: '!!!' }), /nothing to search/);
});

test('OSM search: POST with a User-Agent, normalised records and offline stats', async () => {
  const fetch = fakeFetch([['overpass', fixture('overpass.json')]]);
  const out = await osm.searchOsm({ category: 'packaging', lat: 4.6782, lng: -74.1411, radiusM: 2000, country: 'CO', at: '2026-09-29' }, { fetchImpl: fetch });
  const call = fetch.calls[0];
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers['User-Agent'], USER_AGENT);
  assert.match(call.init.body, /^data=%5Bout%3Ajson%5D/);

  assert.deepEqual(out.stats, { total: 3, withWebsite: 1, withoutWebsite: 2, withPhone: 2 });
  const [porvenir, industrial, whatsapp] = out.suppliers;
  assert.deepEqual(porvenir.phones, ['+579990000301', '+579990000302']);
  assert.equal(porvenir.id, 'osm-node-9001');
  assert.match(porvenir.notes, /Mo-Sa/);
  assert.deepEqual([industrial.lat, industrial.lng, industrial.address], [4.665, -74.135, 'Calle 17 96-40']);
  assert.deepEqual(whatsapp.phones, ['+579990000303']);
  assert.deepEqual(porvenir.sources, [{ type: 'map', ref: 'osm:node/9001', at: '2026-09-29' }]);
  assert.match(out.attribution, /OpenStreetMap contributors/);
  assert.equal(Schema.sanitizeDatabase({ suppliers: out.suppliers }).suppliers.length, 3);
});

// ---------- Socrata / SECOP ----------

function socrataFetch() {
  return fakeFetch([
    ['/api/views/qmzu-gj57.json', fixture('socrata-meta.json')],
    ['/resource/qmzu-gj57.json', fixture('socrata-rows.json')]
  ]);
}

test('Socrata: columns are recognised from the metadata, not hard-coded', () => {
  const meta = JSON.parse(fixture('socrata-meta.json'));
  assert.deepEqual(socrata.mapFields(meta.columns), {
    name: 'nombre', taxId: 'nit', phone: 'telefono', email: 'correo', city: 'municipio',
    region: 'departamento', category: 'descripcion_categoria_principal', location: 'ubicacion'
  });
});

test('Socrata: query URL escapes quotes in SoQL and caps the limit', () => {
  const url = socrata.buildUrl('secop-co', { city: 'municipio' }, { keywords: 'cartón', city: "Bogotá' OR '1'='1", limit: 5000 });
  const params = new URL(url).searchParams;
  assert.ok(url.startsWith('https://www.datos.gov.co/resource/qmzu-gj57.json?'));
  assert.equal(params.get('$limit'), '200');
  assert.equal(params.get('$q'), 'cartón');
  assert.equal(params.get('$where'), "upper(municipio) like upper('%Bogotá'' OR ''1''=''1%')");
  assert.throws(() => socrata.resolve({ domain: 'http://evil', dataset: 'abcd-1234' }), /invalid/);
});

test('SECOP search: registry records with a valid NIT are "formal"', async () => {
  const fetch = socrataFetch();
  const out = await socrata.searchSocrata('secop-co', { keywords: 'cajas', city: 'Funza' }, { fetchImpl: fetch, appToken: 'demo-token', at: '2026-09-29' });
  assert.equal(fetch.calls.length, 2);
  assert.equal(fetch.calls[1].init.headers['X-App-Token'], 'demo-token');
  assert.equal(out.suppliers.length, 2, 'rows without a name are skipped');
  const [sabana, impresos] = out.suppliers;
  assert.deepEqual(sabana.categories, ['packaging']);
  assert.equal(sabana.taxId.valid, true);
  assert.equal(sabana.verification, 2);
  assert.deepEqual([sabana.lat, sabana.lng], [4.716, -74.211]);
  assert.deepEqual(sabana.phones, ['+579990000104']);
  assert.equal(impresos.taxId.valid, false, 'wrong check digit');
  assert.equal(impresos.verification, 0);
  assert.equal(impresos.lat, null, '(0,0) is treated as missing');
  assert.deepEqual(impresos.categories, ['printing']);
});

test('Socrata: a dataset without a recognisable name column fails loudly', async () => {
  const fetch = fakeFetch([
    ['/api/views/', { name: 'Other', columns: [{ name: 'Foo', fieldName: 'foo' }] }],
    ['/resource/', []]
  ]);
  await assert.rejects(socrata.searchSocrata('secop-co', {}, { fetchImpl: fetch }), /Could not find a name column.*Foo/);
});

test('Socrata: WKT and GeoJSON points', () => {
  assert.deepEqual(socrata.readPoint('POINT (-74.1 4.6)'), { lat: 4.6, lng: -74.1 });
  assert.deepEqual(socrata.readPoint({ type: 'Point', coordinates: [-99.1, 19.4] }), { lat: 19.4, lng: -99.1 });
  assert.equal(socrata.readPoint(null), null);
});

// ---------- Google Places ----------

test('Places: no key, no request', async () => {
  const fetch = fakeFetch([]);
  await assert.rejects(places.searchPlaces({ query: 'cajas' }, { fetchImpl: fetch, apiKey: '' }), /GOOGLE_PLACES_API_KEY/);
  assert.equal(fetch.calls.length, 0);
});

test('Places: key and field mask go in headers, location bias in the body', () => {
  const req = places.buildRequest({ query: 'cajas de cartón', lat: 4.67, lng: -74.14, radiusM: 3000, regionCode: 'CO', languageCode: 'es' }, 'demo-key');
  assert.equal(req.init.headers['X-Goog-Api-Key'], 'demo-key');
  assert.match(req.init.headers['X-Goog-FieldMask'], /places\.rating,places\.userRatingCount/);
  const body = JSON.parse(req.init.body);
  assert.deepEqual(body.locationBias.circle, { center: { latitude: 4.67, longitude: -74.14 }, radius: 3000 });
  assert.equal(body.regionCode, 'CO');
  assert.ok(!req.url.includes('demo-key'), 'the key never goes in the URL');
});

test('Places: ratings kept, closed businesses dropped, records flagged for refresh', async () => {
  const fetch = fakeFetch([['places.googleapis.com', fixture('places.json')]]);
  const out = await places.searchPlaces({ query: 'cajas', country: 'CO', category: 'packaging', at: '2026-09-29' }, { fetchImpl: fetch, apiKey: 'demo-key' });
  assert.equal(out.suppliers.length, 2);
  const [maps, web] = out.suppliers;
  assert.deepEqual(maps.rating, { avg: 4.4, count: 37, source: 'google' });
  assert.deepEqual(maps.phones, ['+579990000401']);
  assert.deepEqual(web.phones, ['+579990000402']);
  assert.ok(maps.categories.includes('packaging'));
  assert.match(maps.notes, /Google/);
});

// ---------- http ----------

test('HTTP errors carry the status and a short body', async () => {
  const fetch = fakeFetch([['x', 'rate limited', 429]]);
  await assert.rejects(fetchJson('https://x.example/', { fetchImpl: fetch }), (err) => err instanceof HttpError && err.status === 429);
});

test('Places: a missing coordinate never becomes (0, 0)', () => {
  for (const [lat, lng] of [[null, null], [undefined, undefined], ['', ''], [4.6, null], ['abc', -74]]) {
    const body = JSON.parse(places.buildRequest({ query: 'cajas', lat, lng }, 'demo-key').init.body);
    assert.equal(body.locationBias, undefined, JSON.stringify([lat, lng]));
  }
});

test('responses over the size limit are rejected without reading them whole', async () => {
  const headers = { get: (h) => (h === 'content-length' ? '999999999' : null) };
  await assert.rejects(readLimited({ headers, text: async () => { throw new Error('should not read'); } }, 1000), /too large/);

  let cancelled = false;
  const chunks = [new Uint8Array(600), new Uint8Array(600), new Uint8Array(600)];
  const body = { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true }), cancel: async () => { cancelled = true; } }) };
  await assert.rejects(readLimited({ headers: { get: () => null }, body }, 1000), /too large/);
  assert.equal(cancelled, true);
  assert.equal(chunks.length, 1, 'stopped reading at the limit');

  const ok = [new TextEncoder().encode('{"a":'), new TextEncoder().encode('1}')];
  const small = { getReader: () => ({ read: async () => (ok.length ? { done: false, value: ok.shift() } : { done: true }), cancel: async () => {} }) };
  assert.equal(await readLimited({ headers: { get: () => null }, body: small }, 1000), '{"a":1}');
});

// ---------- Open Contracting Data Standard (OCDS) ----------

const ocds = require('../src/connectors/ocds');

test('OCDS: tenderers and awarded suppliers become records; buyers do not', () => {
  const releases = ocds.parseText(fixture('ocds-release-package.json'));
  assert.equal(releases.length, 2);
  const suppliers = ocds.normalizeReleases(releases, { country: 'PY', label: 'DNCP demo', at: '2026-09-29' });
  assert.deepEqual(suppliers.map((s) => s.name), ['Cartonera Guaraní S.A.', 'Distribuidora Bad Digit', 'Embalajes del Este', 'Imprenta Ñandutí']);
  assert.ok(!suppliers.some((s) => /Compradora/.test(s.name)), 'the buyer is not a supplier');
  const [cartonera, bad, este, imprenta] = suppliers;
  assert.deepEqual(cartonera.taxId, { value: '80999001-6', label: 'RUC', country: 'PY', valid: true, checked: 'checksum' });
  assert.equal(cartonera.sources[0].ref, 'DNCP demo · 2 awards', 'the same RUC written two ways is one supplier');
  assert.deepEqual([cartonera.phones, cartonera.emails, cartonera.websites], [['+595981000601'], ['ventas@cartoneraguarani.example'], ['https://cartoneraguarani.example/']]);
  assert.deepEqual([cartonera.city, cartonera.categories, cartonera.verification], ['Asunción', ['packaging'], 2]);
  assert.deepEqual([bad.taxId.valid, bad.verification, bad.sources[0].ref], [false, 0, 'DNCP demo · 1 bid'], 'a cancelled award is not a win');
  assert.equal(este.taxId.valid, true);
  assert.deepEqual([imprenta.taxId, imprenta.categories], [null, ['printing']]);
});

test('OCDS: the contact person\'s name is never imported', () => {
  const suppliers = ocds.normalizeReleases(ocds.parseText(fixture('ocds-release-package.json')), { country: 'PY' });
  assert.doesNotMatch(JSON.stringify(suppliers), /Persona Ficticia/);
});

test('OCDS: record packages, plain arrays and JSON Lines are all read', () => {
  const pkg = JSON.parse(fixture('ocds-release-package.json'));
  const records = { records: pkg.releases.map((r) => ({ ocid: r.ocid, compiledRelease: r })) };
  assert.equal(ocds.parseText(JSON.stringify(records)).length, 2);
  assert.equal(ocds.parseText(JSON.stringify(pkg.releases)).length, 2);
  assert.equal(ocds.parseText(pkg.releases.map((r) => JSON.stringify(r)).join('\n')).length, 2);
  assert.throws(() => ocds.parseText('{not json'), /Not valid OCDS JSON/);
});

test('OCDS: the identifier scheme tells the country; filters by keyword and category', () => {
  assert.equal(ocds.countryFromScheme('PY-RUC'), 'PY');
  assert.equal(ocds.countryFromScheme('MX-RFC'), 'MX');
  assert.equal(ocds.countryFromScheme('XI-PB'), null, 'not a country code');
  const releases = ocds.parseText(fixture('ocds-release-package.json'));
  const noCountry = ocds.normalizeReleases(releases, {});
  assert.equal(noCountry[0].taxId.country, 'PY', 'validated as Paraguayan even when the country is not given');
  assert.deepEqual(ocds.normalizeReleases(releases, { keywords: 'afiches' }).map((s) => s.name), ['Distribuidora Bad Digit', 'Imprenta Ñandutí']);
  assert.deepEqual(ocds.normalizeReleases(releases, { category: 'packaging' }).map((s) => s.name), ['Cartonera Guaraní S.A.', 'Embalajes del Este']);
});

test('OCDS: only https URLs are fetched and the result passes the import gate', async () => {
  await assert.rejects(ocds.searchOcds({ url: 'http://ocds.example/x.json' }), /https/);
  await assert.rejects(ocds.searchOcds({}), /--file .* or --url/);
  const fetch = fakeFetch([['ocds.example', fixture('ocds-release-package.json')]]);
  const out = await ocds.searchOcds({ url: 'https://ocds.example/demo/release-package.json' }, { country: 'PY' }, { fetchImpl: fetch, at: '2026-09-29' });
  assert.equal(out.releases, 2);
  const db = Schema.sanitizeDatabase({ country: 'PY', suppliers: out.suppliers });
  assert.equal(db.suppliers.length, 4);
  assert.equal(db.suppliers[0].sources[0].type, 'registry');
});
