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
    const out = { name, status: res.status, ms: Date.now() - started, bytes: text.length, head: text.slice(0, 200), cors: res.headers.get('access-control-allow-origin') };
    Object.defineProperty(out, 'text', { value: text, enumerable: false });
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
      const arr = JSON.parse(r.text);
      r.elements = arr.length;
      r.names = arr.slice(0, 6).map((e) => `${e.name} [${e.category}=${e.type}]${e.extratags && (e.extratags.phone || e.extratags['contact:phone']) ? ' tel' : ''}`);
      r.kinds = [...new Set(arr.map((e) => e.category + '=' + e.type))].slice(0, 8);
    } catch (e) { r.parseError = String(e.message); }
    delete r.head;
    results.push(r);
    await sleep(1100);
  }
  // What kind of place each "Manizales" is (a city and rural areas share the name).
  {
    await sleep(1500);
    const r = await probe('nominatim lugares Manizales', 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: 'Manizales', format: 'jsonv2', limit: '5', addressdetails: '1', countrycodes: 'co' }));
    try { r.names = JSON.parse(r.text).map((e) => [e.name, e.addresstype, e.category + '=' + e.type, 'rank ' + e.place_rank, (e.address && (e.address.city || e.address.town || e.address.municipality || e.address.county)) || '', e.address && e.address.state].join(' | ')); } catch (e) { r.parseError = String(e.message); }
    delete r.head;
    results.push(r);
  }
  // SECOP II (datos.gov.co): national suppliers that already sell a category to public entities.
  const secop = async (name, url) => {
    await sleep(1200);
    const r = await probe(name, url, { headers: { Origin: 'https://dsergio909.github.io' } });
    try {
      const j = JSON.parse(r.text);
      // Document numbers and contact details are not kept in the results: an individual's ID is their national ID.
      if (Array.isArray(j)) { r.rows = j.length; r.sample = j.slice(0, 8).map((x) => { const y = {}; Object.keys(x).forEach((k) => { if (!/documento|^nit$|telefono|correo|direcci|representante/.test(k)) y[k] = x[k]; }); return y; }); }
      else if (j.columns) { r.columns = j.columns.map((c) => c.fieldName + ':' + c.dataTypeName); r.datasetName = j.name; }
      else r.json = j;
    } catch (e) { r.parseError = String(e.message); }
    delete r.head;
    return r;
  };
  const SODA = 'https://www.datos.gov.co';
  results.push(await secop('secop contratos meta', SODA + '/api/views/jbjy-vk9h.json'));
  results.push(await secop('secop procesos meta', SODA + '/api/views/p6dx-8zbt.json'));
  results.push(await secop('secop proveedores meta', SODA + '/api/views/qmzu-gj57.json'));
  const q = (params) => SODA + '/resource/jbjy-vk9h.json?' + new URLSearchParams(params);
  results.push(await secop('secop contratos q papeleria (crudo)', q({ $q: 'papelería', $limit: '5' })));
  results.push(await secop('secop contratos q papeleria agrupado', q({
    $select: 'proveedor_adjudicado, documento_proveedor, tipodocproveedor, departamento, count(*) as n, max(fecha_de_firma) as ultima',
    $q: 'papelería', $where: "fecha_de_firma > '2024-01-01T00:00:00'",
    $group: 'proveedor_adjudicado, documento_proveedor, tipodocproveedor, departamento', $order: 'n DESC', $limit: '500'
  })));
  results.push(await secop('secop contratos like aseo agrupado', q({
    $select: 'proveedor_adjudicado, documento_proveedor, departamento, count(*) as n',
    $where: "fecha_de_firma > '2024-01-01T00:00:00' AND upper(objeto_del_contrato) like '%ASEO%'",
    $group: 'proveedor_adjudicado, documento_proveedor, departamento', $order: 'n DESC', $limit: '300'
  })));
  // Which wording finds the right companies, and is filtering by the contract description fast enough?
  const since = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10) + 'T00:00:00';
  const variants = [
    ['vigilancia', null], ['vigilancia privada', 'VIGILANCIA'], ['seguridad privada vigilancia', null],
    ['cajas carton', 'CAJA'], ['empaques', 'EMPAQUE'], ['toner', 'TONER'], ['toner impresora', null],
    ['mantenimiento hidrosanitario', 'HIDROSANITARI'], ['plomeria', null], ['recarga extintores', 'EXTINTOR'],
    ['papeleria', 'PAPELER'], ['utiles de oficina', null], ['aseo', 'ASEO']
  ];
  for (const [term, like] of variants) {
    const base = { $q: term, $group: 'proveedor_adjudicado, departamento', $order: 'n DESC', $limit: '1000' };
    const where = "tipodocproveedor = 'NIT' AND fecha_de_firma > '" + since + "'";
    const plain = await secop('secop variante q=' + term, q(Object.assign({}, base, { $select: 'proveedor_adjudicado, departamento, count(*) as n, max(objeto_del_contrato) as ejemplo', $where: where })));
    if (plain.sample) { plain.sample = plain.sample.map((x) => x.proveedor_adjudicado + ' · ' + x.n + ' · ' + String(x.ejemplo || '').slice(0, 90)); }
    results.push(plain);
    if (like) {
      const f = await secop('secop variante q=' + term + ' + like ' + like, q(Object.assign({}, base, { $select: 'proveedor_adjudicado, departamento, count(*) as n', $where: where + " AND upper(objeto_del_contrato) like '%" + like + "%'" })));
      if (f.sample) f.sample = f.sample.map((x) => x.proveedor_adjudicado + ' · ' + x.n);
      results.push(f);
    }
  }
  // Individuals (personas naturales): how many, and how to tell a small supplier
  // from a person hired as quasi-staff ("prestación de servicios profesionales y de apoyo a la gestión").
  const sinceN = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10) + 'T00:00:00';
  const termsN = [['papeleria', 'PAPELER'], ['extintores', 'EXTINTOR'], ['fumigacion', 'FUMIGACI'], ['mantenimiento hidrosanitario', 'HIDROSANITARI'],
    ['aire acondicionado', 'AIRE'], ['aseo', 'ASEO'], ['cerrajeria', 'CERRAJER'], ['cajas carton', 'CAJA']];
  for (const [term, like] of termsN) {
    const where = "fecha_de_firma > '" + sinceN + "' AND upper(objeto_del_contrato) like '%" + like + "%'";
    const byType = await secop('personas: tipos q=' + term, q({ $select: 'tipodocproveedor, tipo_de_contrato, justificacion_modalidad_de, count(*) as n', $q: term, $where: where,
      $group: 'tipodocproveedor, tipo_de_contrato, justificacion_modalidad_de', $order: 'n DESC', $limit: '40' }));
    if (byType.sample) byType.sample = (JSON.parse(byType.text) || []).map((x) => [x.tipodocproveedor, x.tipo_de_contrato, x.justificacion_modalidad_de, x.n].join(' | '));
    results.push(byType);
    const people = await secop('personas: top q=' + term, q({ $select: 'proveedor_adjudicado, tipodocproveedor, departamento, count(*) as n, max(objeto_del_contrato) as ejemplo, max(tipo_de_contrato) as tipo, max(justificacion_modalidad_de) as just, max(valor_del_contrato) as valor',
      $q: term, $where: where + " AND tipodocproveedor != 'NIT'", $group: 'proveedor_adjudicado, tipodocproveedor, departamento', $order: 'n DESC', $limit: '15' }));
    if (people.sample) people.sample = (JSON.parse(people.text) || []).map((x) => [x.proveedor_adjudicado, x.tipodocproveedor, x.departamento, x.n, x.tipo, x.just, x.valor, String(x.ejemplo || '').slice(0, 110)].join(' | '));
    results.push(people);
  }
  results.push(await secop('personas: tipos de documento', q({ $select: 'tipodocproveedor, count(*) as n', $q: 'suministro', $where: "fecha_de_firma > '" + sinceN + "'", $group: 'tipodocproveedor', $order: 'n DESC', $limit: '20' })));
  results.push(await secop('personas: tipo_empresa en registro', SODA + '/resource/qmzu-gj57.json?' + new URLSearchParams({ $select: 'tipo_empresa, espyme, count(*) as n', $group: 'tipo_empresa, espyme', $order: 'n DESC', $limit: '30' })));
  results.push(await secop('secop proveedores q papeleria', SODA + '/resource/qmzu-gj57.json?' + new URLSearchParams({ $q: 'papeleria', $limit: '10' })));

  await sleep(2000);
  results.push(await probe('overpass-api.de status', 'https://overpass-api.de/api/status'));
  for (const r of results) console.log(JSON.stringify(r));
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
})();
