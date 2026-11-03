const test = require('node:test');
const assert = require('node:assert/strict');
const Short = require('../src/core/shortlist');
const Out = require('../src/core/outreach');

const supplier = {
  id: 'osm-node-7', name: 'Refrigeración Polar', phones: ['+576015550107'], address: 'Calle 38 Sur 78-10', city: 'Bogotá',
  country: 'CO', lat: 4.63, lng: -74.15, sources: [{ type: 'map', ref: 'osm:node/7' }]
};

test('a supplier from the map becomes a shortlist entry, ready to call', () => {
  const e = Short.fromSupplier(supplier, { need: 'mantenimiento de aires', place: 'Kennedy, Bogotá', today: '2026-11-03' });
  assert.equal(e.status, 'todo');
  assert.equal(e.phone, '+576015550107');
  assert.equal(e.osm, 'osm:node/7');
  assert.equal(e.need, 'mantenimiento de aires');
  assert.equal(e.addedAt, '2026-11-03');
});

test('saved entries are checked like an import', () => {
  const list = Short.sanitize([
    { id: 'a', name: 'A', status: 'quoted', phone: 'javascript:alert(1)', osm: 'https://evil.example', lat: 999, lng: 1 },
    { id: 'a', name: 'duplicate' },
    { id: '', name: 'no id' },
    { name: 'no id either' },
    null, 'text',
    { id: 'b', name: 'B', status: 'hacked', notes: 'x'.repeat(1000) }
  ]);
  assert.deepEqual(list.map((e) => e.id), ['a', 'b']);
  assert.equal(list[0].phone, '');
  assert.equal(list[0].osm, '');
  assert.equal(list[0].lat, null);
  assert.equal(list[1].status, 'todo');
  assert.equal(list[1].notes.length, 300);
  assert.deepEqual(Short.sanitize('not a list'), []);
  assert.equal(Short.sanitize(Array.from({ length: 300 }, (_, i) => ({ id: 'x' + i, name: 'X' }))).length, Short.MAX_ENTRIES);
});

test('progress counts towards the usual three quotes', () => {
  const list = Short.sanitize([
    { id: '1', name: 'A', status: 'quoted' }, { id: '2', name: 'B', status: 'contacted' },
    { id: '3', name: 'C', status: 'chosen' }, { id: '4', name: 'D', status: 'discarded' }
  ]);
  const sum = Short.summary(list);
  assert.equal(sum.quoted, 2);
  assert.equal(sum.goal, 3);
  assert.equal(sum.goalReached, false);
  list[1].status = 'quoted';
  assert.equal(Short.summary(list).goalReached, true);
});

test('the comparison table exports safely to Excel or Sheets', () => {
  const e = Short.fromSupplier(Object.assign({}, supplier, { name: '=HYPERLINK("http://evil")' }), {});
  e.price = '+3200';
  const csv = Short.toCsv([e], { headers: ['Proveedor', 'Teléfono', 'Dirección', 'Qué', 'Zona', 'Estado', 'Precio', 'Entrega', 'Pago', 'Garantía', 'Notas', 'Mapa'], status: { todo: 'Por contactar' } });
  const [head, row] = csv.trim().split('\r\n');
  assert.match(head, /^Proveedor,Teléfono/);
  assert.match(row, /^"'=HYPERLINK/, 'formulas are neutralised');
  assert.match(row, /,'\+3200,/);
  assert.match(row, /Por contactar/);
  assert.match(row, /https:\/\/www\.openstreetmap\.org\/node\/7(,|$)/);
});

test('a quote request can include the documents to register the supplier', () => {
  const co = Out.rfqMessage({ item: 'plomería', service: true, documents: true }, 'X', 'es', 'CO');
  assert.match(co, /RUT actualizado.*Cámara de Comercio.*certificación bancaria.*cédula del representante legal/);
  assert.match(co, /¡Muchas gracias!$/, 'the thanks stays last');
  assert.match(Out.rfqMessage({ item: 'cajas', documents: true }, 'X', 'es', 'PE'), /RUC/);
  assert.doesNotMatch(Out.rfqMessage({ item: 'cajas' }, 'X', 'es', 'CO'), /RUT/);
  for (const lang of ['en', 'pt', 'fr']) assert.doesNotMatch(Out.rfqMessage({ item: 'x', documents: true }, 'X', lang, 'MX'), /undefined/);
});
