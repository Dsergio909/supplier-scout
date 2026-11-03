const test = require('node:test');
const assert = require('node:assert/strict');
const Channels = require('../src/core/channels');
const Secop = require('../src/core/secop');
const Services = require('../src/core/services');
const Short = require('../src/core/shortlist');

test('supplies are searched nationally first, on-site services nearby first', () => {
  assert.equal(Channels.scopeOf(Services.interpret('papelería')), 'goods');
  assert.equal(Channels.scopeOf(Services.interpret('dotación de aseo y papelería')), 'goods');
  assert.equal(Channels.scopeOf(Services.interpret('plomero')), 'onsite');
  assert.equal(Channels.scopeOf(Services.interpret('cerrajero')), 'onsite');
  assert.equal(Channels.scopeOf(Services.interpret('vigilancia privada')), 'firm');
  assert.equal(Channels.scopeOf(Services.interpret('xyzzy')), 'unknown');
  assert.deepEqual(Channels.layerOrder('goods').slice(0, 2), ['national', 'mine']);
  assert.equal(Channels.layerOrder('onsite')[0], 'nearby');
});

test('web searches are plain links, including Facebook, and never empty', () => {
  const goods = Channels.webSearches({ need: 'papelería', place: 'Bogotá', countryName: 'Colombia', scope: 'goods', lang: 'es' });
  const ids = goods.map((l) => l.id);
  assert.ok(ids.includes('facebook') && ids.includes('google-wholesale') && ids.includes('linkedin') && ids.includes('maps'));
  assert.match(goods.find((l) => l.id === 'google-wholesale').url, /^https:\/\/www\.google\.com\/search\?q=papeler%C3%ADa%20mayorista%20para%20empresas%20Colombia$/);
  assert.match(goods.find((l) => l.id === 'facebook').url, /^https:\/\/www\.facebook\.com\/search\/pages\/\?q=/);
  const onsite = Channels.webSearches({ need: 'plomero', place: 'Kennedy, Bogotá', countryName: 'Colombia', scope: 'onsite', lang: 'es' });
  assert.ok(!onsite.some((l) => l.id === 'linkedin'), 'a plumber is not searched on LinkedIn');
  assert.match(onsite.find((l) => l.id === 'facebook').query, /plomero Kennedy, Bogotá/);
  assert.deepEqual(Channels.webSearches({ need: '   ' }), []);
  assert.doesNotMatch(Channels.webSearches({ need: '<script>"x"', scope: 'goods' })[0].url, /[<>"]/);
});

test('SECOP terms: precise words per need, the typed words first when more specific', () => {
  assert.deepEqual(Secop.searchTerms(Services.interpret('dotación de aseo y papelería')).map((t) => t.term).sort(), ['aseo', 'papelería'],
    '"dotación de aseo" means supplies, not uniforms');
  assert.ok(Services.interpret('dotación de uniformes y botas').categories.includes('textiles'));
  assert.deepEqual(Secop.searchTerms(Services.interpret('papelería'), 'papelería'), [{ id: 'office', term: 'papelería', like: 'PAPELER' }]);
  assert.deepEqual(Secop.searchTerms({ kind: 'name', services: [], categories: [] }, 'arepas'), [{ id: 'text', term: 'arepas', exact: true }]);
  // Live check, Nov 2026: "vigilancia" alone brought epidemiological surveillance; two words bring security firms.
  assert.equal(Secop.searchTerms(Services.interpret('vigilancia'), 'vigilancia')[0].term, 'vigilancia privada');
  // "empaques" brought laundries and bakeries; "cajas cartón" brings carton makers.
  assert.deepEqual(Secop.searchTerms(Services.interpret('cajas de cartón'), 'cajas de cartón').map((t) => t.term), ['cajas cartón']);
  const toner = Secop.searchTerms(Services.interpret('tóner para impresora'), 'tóner para impresora');
  assert.deepEqual(toner.map((t) => [t.id, t.term, !!t.exact]), [['office', 'tóner para impresora', true], ['office', 'papelería', false]],
    'toner is stationery, and the typed words go first');
  assert.equal(Secop.typedQuery('Suministro de tóner para impresora'), 'toner impresora');
});

test('toner and ink are supplies, not printer repair', () => {
  assert.deepEqual(Services.interpret('tóner para impresora').services, []);
  assert.deepEqual(Services.interpret('cartuchos de tinta').categories, ['office']);
  assert.deepEqual(Services.interpret('reparación de impresora').services, ['it']);
});

test('SECOP queries: companies and individuals, the last two years, no staff contracts, escaped input', () => {
  const url = new URL(Secop.contractsUrl("papel'ería", { today: '2026-11-03' }));
  assert.equal(url.origin, 'https://www.datos.gov.co');
  const where = url.searchParams.get('$where');
  assert.match(where, /^tipodocproveedor in \('NIT', 'Cédula de Ciudadanía', 'Cédula de Extranjería', 'Otro', 'No Definido'\) AND fecha_de_firma > '2024-11-03T00:00:00'/);
  assert.doesNotMatch(where, /Tarjeta de Identidad/, 'minors are never searched');
  assert.match(where, /tipo_de_contrato not in \('Decreto 092 de 2017', 'Arrendamiento de inmuebles'/, 'agreements with non-profits and leases are not purchases');
  assert.match(where, /justificacion_modalidad_de != 'Servicios profesionales y apoyo a la gestión'/, 'people hired as quasi-staff are not suppliers');
  assert.match(where, /tipodocproveedor not in \('Cédula de Ciudadanía', 'Cédula de Extranjería'\) OR \(upper\(objeto_del_contrato\) not like '%APOYO A LA GESTI%'/,
    'staff wording is checked only for people, so a cleaning company that sends operators stays');
  assert.equal(url.searchParams.get('$q'), 'papel eria');
  assert.match(url.searchParams.get('$select'), /tipodocproveedor/);
  assert.match(url.searchParams.get('$select'), /max\(objeto_del_contrato\) as ejemplo/, 'one real contract as evidence');
  const filtered = new URL(Secop.contractsUrl('extintores', { today: '2026-11-03', like: "EXTINTOR'%" }));
  assert.match(filtered.searchParams.get('$where'), / AND upper\(objeto_del_contrato\) like '%EXTINTOR%'$/, 'the stem is letters only');
  assert.equal(new URL(Secop.contractsUrl('tóner para impresora', { exact: true })).searchParams.get('$q'), 'toner impresora');
  const contacts = new URL(Secop.contactsUrl(['860.026.740', "1'); drop", '']));
  assert.equal(contacts.searchParams.get('$where'), "nit in ('860026740', '8600267405')", 'with and without the check digit; nothing else');
  assert.match(new URL(Secop.contactsUrl(['900000001']).replace('900000001', '900000001')).searchParams.get('$select'), /^nit, nombre, telefono, correo, sitio_web, departamento, municipio, esta_activa$/,
    'never the legal representative\'s personal fields');
});

const groups = [
  { id: 'office', term: 'papelería', rows: [
    { proveedor_adjudicado: 'PAPELERIA LOS ANDES SAS', documento_proveedor: '860026740', departamento: 'Distrito Capital de Bogotá', n: '46', ultima: '2026-10-19T16:36:19.391' },
    { proveedor_adjudicado: 'PAPELERIA LOS ANDES SAS', documento_proveedor: '860026740', departamento: 'Cundinamarca', n: '5', ultima: '2026-08-01T00:00:00' },
    { proveedor_adjudicado: 'PAPELERIA LOS ANDES SAS', documento_proveedor: '860026740', departamento: 'Meta', n: '2', ultima: '2025-01-01T00:00:00' },
    { proveedor_adjudicado: 'GRUPO LOS LAGOS SAS', documento_proveedor: '860053274', departamento: 'Distrito Capital de Bogotá', n: '57', ultima: '2026-10-27T15:19:35.026' },
    { proveedor_adjudicado: 'Sin nit', documento_proveedor: '', departamento: 'X', n: '9' }
  ] },
  { id: 'cleaning', term: 'aseo', rows: [
    { proveedor_adjudicado: 'GRUPO LOS LAGOS SAS', documento_proveedor: '860053274', departamento: 'Antioquia', n: '3', ultima: '2026-01-01T00:00:00' }
  ] }
];

test('companies are merged across departments and needs, covering more needs first', () => {
  const list = Secop.aggregate(groups, { region: 'Bogotá, D.C.' });
  assert.equal(list.length, 2, 'rows without a tax ID are dropped');
  assert.equal(list[0].nit, '860053274', 'covers both needs (stationery and cleaning)');
  assert.deepEqual(list[0].needs, ['office', 'cleaning']);
  assert.equal(list[0].name, 'Grupo Los Lagos SAS');
  const andes = list[1];
  assert.equal(andes.contracts, 53);
  assert.equal(andes.departments.length, 3);
  assert.equal(andes.reach, 'national');
  assert.equal(andes.last, '2026-10-19');
  assert.equal(andes.inBuyerRegion, true, 'Distrito Capital de Bogotá matches Bogotá, D.C.');
});

test('public contact details are attached only when they are real values', () => {
  const list = Secop.attachContacts(Secop.aggregate(groups), [
    { nit: '860026740', telefono: '601 555 0101', correo: 'VENTAS@EJEMPLO.EXAMPLE', sitio_web: 'www.ejemplo.example', municipio: 'BOGOTÁ', departamento: 'Distrito Capital de Bogotá', esta_activa: 'Si' },
    { nit: '860053274', telefono: 'No Provisto', correo: 'No Provisto', sitio_web: 'No Definido' }
  ]);
  const andes = list.find((e) => e.nit === '860026740').contacts;
  assert.equal(andes.phone, '+576015550101');
  assert.equal(andes.email, 'ventas@ejemplo.example');
  assert.equal(andes.website, 'https://www.ejemplo.example');
  assert.deepEqual(list.find((e) => e.nit === '860053274').contacts, { phone: '', email: '', website: '', city: '', active: true });
});

test('a national supplier becomes a list entry with its tax ID, coverage and categories', () => {
  const e = Secop.attachContacts(Secop.aggregate(groups), [{ nit: '860026740', telefono: '6015550101', correo: 'v@x.example' }])[1];
  const entry = Short.fromNational(e, { need: 'papelería', categories: ['office', 'cleaning'], today: '2026-11-03' });
  assert.equal(entry.id, 'nit:860026740');
  assert.equal(entry.source, 'national');
  assert.equal(entry.phone, '+576015550101');
  assert.equal(entry.coverage, 'national');
  assert.equal(entry.delivery, 'national');
  assert.deepEqual(entry.categories, ['office', 'cleaning']);
});

test('saved suppliers: several categories, terms as given, and the three-quotes goal per need', () => {
  const list = Short.sanitize([
    { id: 'm1', name: 'Distribuidora Nacional Ejemplo', source: 'manual', categories: ['office', 'cleaning', '<x>'], coverage: 'national', creditDays: '90', payment: 'quarterly', eInvoice: true, status: 'quoted' },
    { id: 'm2', name: 'Papelería del barrio', categories: ['office'], status: 'contacted', creditDays: -5 },
    { id: 'm3', name: 'Otro', categories: ['office'], status: 'discarded' }
  ]);
  assert.deepEqual(list[0].categories, ['office', 'cleaning']);
  assert.equal(list[0].creditDays, 90);
  assert.equal(list[0].payment, 'quarterly');
  assert.equal(list[1].creditDays, null, 'impossible values are dropped');
  assert.deepEqual(Short.covering(list, ['cleaning']).map((e) => e.id), ['m1']);
  assert.deepEqual(Short.goalFor(list, 'office'), { category: 'office', suppliers: 2, quoted: 1, goal: 3, reached: false });
});

test('companies and individuals are both kept; utilities, joint ventures, minors and bad NITs are not', () => {
  // Fictional names and numbers: an individual's tax ID is their national ID.
  const rows = [
    { proveedor_adjudicado: 'EXTINTORES DEL EJEMPLO', documento_proveedor: '1000000001', tipodocproveedor: 'Cédula de Ciudadanía', departamento: 'Atlántico', n: '36' },
    { proveedor_adjudicado: 'FUMIGACIONES MODELO', documento_proveedor: '12345678', tipodocproveedor: 'NIT', departamento: 'Meta', n: '14' },
    { proveedor_adjudicado: 'PERSONA MENOR EJEMPLO', documento_proveedor: '1000000002', tipodocproveedor: 'Tarjeta de Identidad', departamento: 'Meta', n: '3' },
    { proveedor_adjudicado: 'EMPRESA METROPOLITANA DE ASEO S.A. E.S.P.', documento_proveedor: '890000000', tipodocproveedor: 'NIT', departamento: 'Huila', n: '26' },
    { proveedor_adjudicado: 'CONSORCIO PARQUES LC', documento_proveedor: '901000000', tipodocproveedor: 'NIT', departamento: 'Bogotá', n: '1' },
    { proveedor_adjudicado: 'DRYCOL SAS', documento_proveedor: '9000752257', tipodocproveedor: 'NIT', departamento: 'Atlántico', n: '6' },
    { proveedor_adjudicado: 'MAL DIGITO SAS', documento_proveedor: '9000752251', tipodocproveedor: 'NIT', departamento: 'Atlántico', n: '6' },
    { proveedor_adjudicado: 'SERVICIOS EJEMPLO SAS', documento_proveedor: '901234567', tipodocproveedor: 'Otro', departamento: 'Meta', n: '2' }
  ];
  const list = Secop.aggregate([{ id: 'x', term: 'x', rows }]);
  assert.deepEqual(list.map((e) => [e.name, e.personType]).sort(), [
    ['Drycol SAS', 'company'], ['Extintores del Ejemplo', 'person'], ['Fumigaciones Modelo', 'person'], ['Servicios Ejemplo SAS', 'company']
  ], 'a cédula and a sole trader\'s NIT are individuals; a 10-digit NIT counts only with the right check digit');
  assert.equal(Secop.checkDigit('900075225'), '7');
  const person = list.find((e) => e.personType === 'person' && e.name === 'Extintores del Ejemplo');
  assert.equal(person.nit, '', 'no tax ID shown for an individual');
  assert.match(person.key, /^pn:[0-9a-f]{8}$/);
  assert.doesNotMatch(JSON.stringify(list), /1000000001|12345678/, 'an individual\'s ID number is never serialised');
  assert.equal(person.doc, '1000000001', 'it is kept out of sight only to look up the public contact');
  assert.match(Secop.contactsUrl([person.doc]), /1000000001/);
});

test('an individual saved to the list keeps no ID number; quote requests ask them for their own papers', () => {
  const [e] = Secop.attachContacts(Secop.aggregate([{ id: 'fireSafety', term: 'extintores', rows: [
    { proveedor_adjudicado: 'EXTINTORES DEL EJEMPLO', documento_proveedor: '1000000001', tipodocproveedor: 'Cédula de Ciudadanía', departamento: 'Caldas', n: '9' }] }]),
  [{ nit: '1000000001' + Secop.checkDigit('1000000001'), telefono: '3001234567', correo: 'ventas@extintoresejemplo.example', departamento: 'Caldas' }]);
  assert.equal(e.contacts.phone, '+573001234567', 'the registry stores the ID with its check digit; it still matches');
  const entry = Short.fromNational(e, { need: 'extintores', categories: ['maintenance'], today: '2026-11-03' });
  assert.equal(entry.personType, 'person');
  assert.equal(entry.nit, '');
  assert.match(entry.id, /^pn:/);
  assert.doesNotMatch(JSON.stringify(entry), /1000000001/);
  assert.deepEqual(Short.sanitize([entry])[0], entry, 'survives a round trip through storage');
  const Outreach = require('../src/core/outreach');
  const msg = Outreach.rfqMessage({ item: 'recarga de extintores', service: true, documents: true, person: true }, entry.name, 'es', 'CO');
  assert.match(msg, /RUT actualizado, copia de la cédula, certificación bancaria y, si tiene, el registro mercantil/);
  assert.match(msg, /seguridad social/);
  assert.doesNotMatch(msg, /representante legal/);
  assert.match(Outreach.rfqMessage({ item: 'papelería', documents: true }, 'X SAS', 'es', 'CO'), /representación legal/, 'companies keep the company list');
  const csv = Short.toCsv([entry], { headers: Array(20).fill('h'), status: {}, personTypes: { company: 'Empresa', person: 'Persona natural' } });
  assert.match(csv.split('\n')[1], /Persona natural\s*$/);
});

test('the list keeps room for both companies and individuals', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ proveedor_adjudicado: 'EMPRESA ' + i + ' SAS', documento_proveedor: String(900000100 + i), tipodocproveedor: 'NIT', departamento: 'D' + (i % 5), n: '50' });
  for (let i = 0; i < 30; i++) rows.push({ proveedor_adjudicado: 'PERSONA ' + i, documento_proveedor: String(10000000 + i), tipodocproveedor: 'Cédula de Ciudadanía', departamento: 'Meta', n: '5' });
  const list = Secop.aggregate([{ id: 'office', term: 'papelería', rows }], { max: 40 });
  assert.equal(list.length, 40);
  assert.equal(list.filter((e) => e.personType === 'person').length, 20, 'individuals are not crowded out by companies with more departments');
});

test('the typed words rank first, contracts are not counted twice, and an example is kept', () => {
  const same = { proveedor_adjudicado: 'COMPUTAR SAS', documento_proveedor: '900000001', departamento: 'Tolima', n: '10', ultima: '2026-10-01T00:00:00',
    ejemplo: 'SUMINISTRO DE TINTAS; CARTUCHOS Y TONER PARA IMPRESORAS' };
  const list = Secop.aggregate([
    { id: 'office', term: 'tóner para impresora', exact: true, rows: [same] },
    { id: 'office', term: 'papelería', rows: [Object.assign({}, same, { ejemplo: 'PAPELERIA' }),
      { proveedor_adjudicado: 'PAPELERIA GRANDE SAS', documento_proveedor: '900000002', departamento: 'Meta', n: '90', ultima: '2026-10-01T00:00:00' },
      { proveedor_adjudicado: 'PAPELERIA GRANDE SAS', documento_proveedor: '900000002', departamento: 'Huila', n: '9', ultima: '2026-10-01T00:00:00' }] }
  ]);
  assert.equal(list[0].name, 'Computar SAS', 'found with the buyer\'s own words');
  assert.equal(list[0].contracts, 10);
  assert.equal(list[0].example, 'Suministro de tintas, cartuchos y toner para impresoras');
  assert.equal(Secop.describe('x'.repeat(300)).length, 140);
});

test('registry phones become dialable numbers with the area code, junk websites are dropped', () => {
  assert.equal(Secop.colombianPhone('7470153', 'Distrito Capital de Bogotá'), '+576017470153');
  assert.equal(Secop.colombianPhone('4441234', 'Antioquia'), '+576044441234');
  assert.equal(Secop.colombianPhone('5617679 ext 3', 'Cundinamarca'), '+576015617679');
  assert.equal(Secop.colombianPhone('324 479 8678'), '+573244798678');
  assert.equal(Secop.colombianPhone('14634209', 'Bogotá'), '', 'not a number anyone can dial');
  assert.equal(Secop.colombianPhone('7470153', ''), '', 'no area code without the department');
  const [e] = Secop.attachContacts([{ nit: '900000001' }], [{ nit: '900000001' + Secop.checkDigit('900000001'), telefono: '3001234567', sitio_web: 'www.google.com/search?q=extintores' }]);
  assert.equal(e.contacts.website, '');
  assert.equal(e.contacts.phone, '+573001234567');
});

test('place alternatives are real homonyms, not a second hit for the same city', () => {
  const Osm = require('../src/core/osm');
  const places = Osm.parsePlaces([
    { lat: '6.2442', lon: '-75.5812', name: 'Medellín', address: { city: 'Medellín', state: 'Antioquia', country_code: 'co' }, addresstype: 'city' },
    { lat: '6.2518', lon: '-75.5636', name: 'Perímetro Urbano Medellín', address: { city: 'Medellín', state: 'Antioquia', country_code: 'co' }, addresstype: 'suburb' },
    { lat: '4.6097', lon: '-74.0817', name: 'Bogotá ciudad', address: { city: 'Bogotá', state: 'Bogotá, Distrito Capital', country_code: 'co' }, addresstype: 'city' }
  ]);
  assert.equal(places[2].label, 'Bogotá');
  assert.deepEqual(Osm.otherPlaces(places).map((p) => p.label), ['Bogotá']);
});

test('contract examples read cleanly: no internal codes, no item tables, articles kept', () => {
  assert.equal(Secop.describe('AO-00-1009 - CONTRATO DE SUMINISTRO INTEGRAL DEL SERVICIO DE ASEO'), 'Contrato de suministro integral del servicio de aseo');
  assert.equal(Secop.describe('54_9537_617 CONTRATAR EL SUMINISTRO DE UNIFORMES'), 'Contratar el suministro de uniformes');
  assert.equal(Secop.describe('TG ADQUISICIÓN DE TONERS'), 'Adquisición de toners');
  assert.equal(Secop.describe('EL CONTRATISTA SE OBLIGA A SUMINISTRAR CAJAS'), 'El contratista se obliga a suministrar cajas');
  assert.equal(Secop.describe('ITEM ELEMENTO DESCRIPCION CANTIDAD PRECIO'), '');
  const [e] = Secop.aggregate([{ id: 'office', term: 'tóner', exact: true, rows: [
    { proveedor_adjudicado: 'X SAS', documento_proveedor: '900000001', departamento: 'Meta', n: '9', ejemplo: 'SERVICIO DE MANTENIMIENTO DE IMPRESORAS' },
    { proveedor_adjudicado: 'X SAS', documento_proveedor: '900000001', departamento: 'Huila', n: '2', ejemplo: 'SUMINISTRO DE TONER' }
  ] }]);
  assert.equal(e.example, 'Suministro de toner', 'an example that mentions what was searched wins');
  assert.equal(Secop.aggregate([{ id: 'x', term: 'x', rows: [{ proveedor_adjudicado: 'AVIZOR LTDA - PROTEGE TU PATRIMONIO??', documento_proveedor: '830024478', departamento: 'Meta', n: '1' }] }])[0].name,
    'Avizor LTDA - Protege Tu Patrimonio');
});

test('district names read like the buyer says them', () => {
  const Osm = require('../src/core/osm');
  const [p] = Osm.parsePlaces([{ lat: '4.65', lon: '-74.06', name: 'UPZs Localidad Chapinero', address: { city: 'Bogotá', state: 'Bogotá, Distrito Capital', country_code: 'co' }, addresstype: 'suburb' }]);
  assert.equal(p.name, 'Chapinero');
  assert.equal(p.label, 'Chapinero, Bogotá');
});

test('business cities read like the buyer says them', () => {
  const Osm = require('../src/core/osm');
  assert.equal(Osm.cityName('Perímetro Urbano Barranquilla'), 'Barranquilla');
  assert.equal(Osm.cityName('Bogotá ciudad'), 'Bogotá');
  assert.equal(Osm.cityName(''), null);
});

test('a city is not confused with hamlets of the same name; Bogotá reads as Bogotá', () => {
  const Osm = require('../src/core/osm');
  const places = Osm.parsePlaces([
    { lat: '5.0689', lon: '-75.5174', name: 'Manizales', address: { city: 'Manizales', state: 'Caldas', country_code: 'co' }, addresstype: 'city' },
    { lat: '7.6', lon: '-75.3', name: 'Manizales', address: { municipality: 'Cáceres', state: 'Antioquia', country_code: 'co' }, addresstype: 'hamlet' },
    { lat: '6.0', lon: '-74.9', name: 'Manizales', address: { municipality: 'San Luis', state: 'Antioquia', country_code: 'co' }, addresstype: 'hamlet' }
  ]);
  assert.deepEqual(Osm.otherPlaces(places), []);
  // As Nominatim really returned it (live probe, 3 Nov 2026).
  const real = Osm.parsePlaces([
    { lat: '5.0689', lon: '-75.5174', name: 'Perímetro Urbano Manizales', address: { city: 'Perímetro Urbano Manizales', state: 'Caldas', country_code: 'co' }, addresstype: 'city', place_rank: 14 },
    { lat: '7.6', lon: '-75.3', name: 'Manizales', address: { city: 'Cáceres', state: 'Antioquia', country_code: 'co' }, addresstype: 'city_district', place_rank: 14 },
    { lat: '7.5', lon: '-75.2', name: 'Manizales', address: { town: 'Cáceres', state: 'Antioquia', country_code: 'co' }, addresstype: 'village', place_rank: 16 },
    { lat: '6.0', lon: '-74.9', name: 'Manizales', address: { city: 'San Luis', state: 'Antioquia', country_code: 'co' }, addresstype: 'city_district', place_rank: 16 },
    { lat: '6.3', lon: '-75.0', name: 'Manizales', address: { city: 'Manizales', state: 'Antioquia', country_code: 'co' }, addresstype: 'city', place_rank: 16 }
  ]);
  assert.equal(real[0].label, 'Manizales, Caldas');
  assert.deepEqual(Osm.otherPlaces(real), []);
  const [e] = Secop.attachContacts([{ nit: '900000001' }], [{ nit: '900000001', municipio: 'No Provisto', departamento: 'Distrito Capital de Bogotá' }]);
  assert.equal(e.contacts.city, 'Bogotá');
});

test('a company registered under a non-company number is a company, with the number hidden', () => {
  const [e] = Secop.aggregate([{ id: 'cleaning', term: 'aseo', rows: [
    { proveedor_adjudicado: 'ASEO EJEMPLO SAS', documento_proveedor: '12345678', tipodocproveedor: 'NIT', departamento: 'Meta', n: '4' }] }]);
  assert.equal(e.personType, 'company');
  assert.equal(e.nit, '', 'the number may be someone\'s ID: not shown');
  assert.match(e.key, /^pn:/);
  assert.doesNotMatch(JSON.stringify(e), /12345678/);
  assert.equal(Secop.aggregate([{ id: 'x', term: 'x', rows: [{ proveedor_adjudicado: 'MARIA SAS TORRES', documento_proveedor: '12345678', tipodocproveedor: 'Cédula de Ciudadanía', departamento: 'Meta', n: '1' }] }])[0].personType, 'person',
    'only a legal form at the end of the name counts');
});
