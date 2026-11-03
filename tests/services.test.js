const test = require('node:test');
const assert = require('node:assert/strict');
const Services = require('../src/core/services');
const Osm = require('../src/core/osm');
const Score = require('../src/core/score');
const Schema = require('../src/core/schema');
const D = require('../src/core/dedupe');
const M = require('../src/core/messages');
const Out = require('../src/core/outreach');
const { DATASETS } = require('../src/data/sample');

test('a service written in plain words becomes map tags and name stems', () => {
  const r = Services.interpret('Servicio de mantenimiento para aires acondicionados');
  assert.equal(r.kind, 'service');
  assert.deepEqual(r.services, ['hvac']);
  assert.ok(r.tags.some(([k, v]) => k === 'craft' && v === 'hvac'));
  assert.match(r.nameHint, /refrigera/);
  assert.deepEqual(Services.describe(r, 'es'), ['Aire acondicionado y refrigeración']);
});

test('the same request in four languages, with plurals and accents', () => {
  for (const text of ['mantenimiento de aires acondicionados', 'air conditioning maintenance', 'manutenção de ar-condicionado', 'entretien de climatisation']) {
    assert.deepEqual(Services.interpret(text).services, ['hvac'], text);
  }
  assert.deepEqual(Services.interpret('recarga de extintores').services, ['fireSafety']);
  assert.deepEqual(Services.interpret('Fumigación de bodegas').services, ['pest']);
  assert.deepEqual(Services.interpret('necesito un electricista').services, ['electrical']);
  assert.deepEqual(Services.interpret('reparación de computadores').services, ['it']);
});

test('"mantenimiento" does not pull plumbers into a search for elevators', () => {
  const r = Services.interpret('mantenimiento de ascensores');
  assert.deepEqual(r.services, ['elevators']);
  assert.ok(!r.tags.some(([, v]) => v === 'plumber'));
});

test('products fall back to the purchase categories; unknown words search names', () => {
  assert.deepEqual(Services.interpret('cajas de cartón corrugado').categories, ['packaging']);
  assert.equal(Services.interpret('cajas de cartón').kind, 'category');
  const name = Services.interpret('arepas congeladas');
  assert.equal(name.kind, 'name');
  assert.deepEqual(name.terms, ['arepa', 'congelada']);
  assert.equal(Services.interpret('mantenimiento').categories[0], 'maintenance');
  assert.equal(Services.interpret('   ').kind, 'empty');
  assert.equal(Services.interpret('de la para').kind, 'empty');
});

test('every service builds a valid Overpass query, and user text cannot break out of it', () => {
  for (const s of Services.SERVICES) {
    const r = Services.interpret(s.keywords[0]);
    assert.ok(r.services.includes(s.id), s.id);
    const q = Osm.buildQuery({ tags: r.tags, nameHint: r.nameHint, lat: 4.6, lng: -74.1, radiusM: 3000 });
    assert.match(q, /^\[out:json\]/);
    for (const [k, v] of s.osm) assert.match(k + '=' + v, /^[a-z0-9_:]+=[a-z0-9_]+$/);
  }
  const evil = Services.interpret('"]; out; node["a"="b');
  const q = Osm.buildQuery({ tags: evil.tags, nameHint: evil.nameHint, lat: 1, lng: 1 });
  assert.equal((q.match(/"/g) || []).length % 2, 0);
  assert.ok(!/out;\s*node/.test(q.replace(/out center tags \d+;$/, '')));
});

test('without a quantity, quotes are compared by unit price and the minimum order is shown', () => {
  const ds = DATASETS.bogota;
  const db = D.autoMerge(Schema.sanitizeDatabase(ds)).db;
  const { ranked } = Score.rankSuppliers(db, { categories: ['packaging'], origin: ds.origins[0], radiusKm: 12 }, { country: 'CO', fx: ds.fx, monthlyRate: 0.015 });
  const market = ranked.find((r) => r.supplier.id === 'bog-cartonexpress');
  const ev = market.evidence.find((e) => e.code === 'unit_price');
  assert.equal(ev.minOrder, 1000);
  assert.ok(!market.warnings.some((w) => w.code === 'below_moq' || w.code === 'overbuy'));
  assert.match(M.explain(ev, 'es', { country: 'CO' }), /por unidad con impuestos.*compra mínima 1000 unidades/);
  const noQuote = ranked.find((r) => !r.cost);
  assert.ok(noQuote.warnings.some((w) => w.code === 'no_quote'));
});

test('a quote request for a service asks for the price of the job, with no quantity', () => {
  const text = Out.rfqMessage({ item: 'mantenimiento de aires acondicionados', deliveryZone: 'Kennedy', service: true }, 'Frío Total', 'es', 'CO');
  assert.match(text, /Necesitamos mantenimiento de aires acondicionados en Kennedy\./);
  assert.match(text, /valor del servicio/);
  assert.doesNotMatch(text, /unidades|presentación/);
  for (const lang of ['en', 'pt', 'fr']) assert.doesNotMatch(Out.rfqMessage({ item: 'x', service: true }, 'Y', lang, 'CO'), /undefined/);
});

test('regional words from across the region are understood', () => {
  const cases = {
    'gasfitero en Miraflores': 'plumbing', 'desentupidora': 'plumbing', 'fontanero': 'plumbing',
    'refaccionaria': 'vehicles', 'borracharia': 'vehicles', 'gomería': 'vehicles', 'montallantas': 'vehicles',
    'cristalero': 'glass', 'dedetizadora': 'pest', 'lavado de tinacos': 'cleaningService',
    'maestro de obra': 'building', 'chaveiro': 'locksmith', 'serralheria': 'metalwork'
  };
  for (const [text, id] of Object.entries(cases)) assert.deepEqual(Services.interpret(text).services, [id], text);
  for (const text of ['tlapalería', 'pinturería', 'corralón', 'ferragens', 'quincaillerie']) {
    assert.deepEqual(Services.interpret(text).categories, ['hardware'], text);
  }
});

// The map search also matches words inside business names, so a stem that is too
// broad brings real but unrelated places (a kindergarten for "jardinería").
test('name words are specific enough not to catch unrelated businesses', () => {
  const Categories = require('../src/core/categories');
  const matcher = (hint) => new RegExp(Osm.safeRegex(hint), 'i');
  const wrong = {
    gardening: ['Jardín Infantil Pequeños Genios'],
    security: ['EPS Seguridad Social', 'Secretaría de Seguridad'],
    it: ['Universidad Tecnológica de Bolívar', 'Soporte Vital Básico SAS']
  };
  for (const [id, names] of Object.entries(wrong)) {
    const m = matcher(Services.byId(id).nameHint);
    for (const n of names) assert.doesNotMatch(n, m, `${id} must not match "${n}"`);
  }
  const cat = (id) => matcher(Categories.byId(id).nameHint);
  assert.doesNotMatch('Banco Caja Social', cat('packaging'));
  assert.doesNotMatch('Caja de Compensación Familiar', cat('packaging'));
  assert.doesNotMatch('Oficina de Correos', cat('office'));
  assert.doesNotMatch('Cine 3D Imax', cat('3dprint'));
  // ...while the real trades are still found by name.
  assert.match('Jardinería y Paisajismo El Edén', matcher(Services.byId('gardening').nameHint));
  assert.match('Corrugados La Sabana', cat('packaging'));
  assert.match('Papelería El Lápiz', cat('office'));
  assert.match('Vigilancia Andina Ltda', matcher(Services.byId('security').nameHint));
});

// Standard OSM tags; the doubtful ones (hvac, refrigeration, machinist, cleaning, pest control, fire
// extinguishers, 3D printing, office supplies) were checked on the OSM wiki in November 2026 and fixed.
test('every map tag the search uses is a known OpenStreetMap tag', () => {
  const Categories = require('../src/core/categories');
  const documented = new Set(('amenity=car_wash amenity=marketplace amenity=post_office craft=blacksmith craft=builder craft=cabinet_maker ' +
    'craft=carpenter craft=caterer craft=cleaning craft=dressmaker craft=electrician craft=electronics_repair craft=floorer craft=gardener ' +
    'craft=glaziery craft=hvac craft=insulation craft=key_cutter craft=locksmith craft=metal_construction craft=painter craft=pest_control ' +
    'craft=plasterer craft=plumber craft=printer craft=roofer craft=signmaker craft=tailor craft=tiler craft=upholsterer craft=welder ' +
    'craft=window_construction landuse=plant_nursery office=accountant office=courier office=it office=lawyer office=logistics ' +
    'office=moving_company office=pest_control office=security shop=3d_printing shop=appliance shop=bakery shop=car_repair shop=chemist ' +
    'shop=cleaning_supplies shop=computer shop=copyshop shop=doityourself shop=dry_cleaning shop=electrical shop=electronics shop=fabric ' +
    'shop=furniture shop=garden_centre shop=greengrocer shop=hardware shop=hvac shop=laundry shop=lighting shop=locksmith ' +
    'shop=motorcycle_repair shop=office_supplies shop=pest_control shop=printing shop=safety_equipment shop=security shop=sewing ' +
    'shop=stationery shop=trade shop=tyres shop=wholesale').split(' '));
  // Not found on the wiki; kept because a tag nobody uses only returns nothing.
  const lowUse = new Set(['shop=packaging', 'craft=packaging']);
  const used = [...Services.SERVICES, ...Categories.CATEGORIES].flatMap((x) => x.osm.map(([k, v]) => `${k}=${v}`));
  for (const tag of used) assert.ok(documented.has(tag) || lowUse.has(tag), `${tag} is not a documented OSM tag`);
});
