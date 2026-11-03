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
    ScoutSecop: require('../src/core/secop'),
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

// National suppliers (SECOP II): what a buyer types, and the region of the buyer.
const NATIONAL = [
  { what: 'papelería', region: 'Bogotá, Distrito Capital' },
  { what: 'dotación de aseo y papelería', region: 'Bogotá, Distrito Capital' },
  { what: 'recarga de extintores', region: 'Antioquia' },
  { what: 'vigilancia privada', region: 'Valle del Cauca' },
  { what: 'cajas de cartón', region: 'Atlántico' },
  { what: 'tóner para impresora', region: 'Santander' },
  { what: 'uniformes y dotación', region: 'Bogotá, Distrito Capital' },
  { what: 'plomero', region: 'Bogotá, Distrito Capital' },
  { what: 'vigilancia', region: 'Bogotá, Distrito Capital' },
  { what: 'productos de aseo', region: 'Atlántico' },
  { what: 'fumigación', region: 'Antioquia' },
  { what: 'mantenimiento de aires acondicionados', region: 'Atlántico' }
];
// Wording of a personal-service contract: none of these should reach the list.
const STAFF = /apoyo a la gesti|servicios profesionales|operari|subordinaci|plena autonom/i;
const SODA = 'https://www.datos.gov.co/resource/';
const ScoutSecopNode = require('../src/core/secop');

/** Independent check: the company has contracts under that tax ID, and appears in the registry. */
async function verifyNational(e) {
  const q = (dataset, params) => politeFetch(SODA + dataset + '.json?' + new URLSearchParams(params)).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
  // e.doc (an individual's ID) is used for the lookup and never printed.
  const id = e.doc || e.nit;
  const forms = [id, id + ScoutSecopNode.checkDigit(id)].map((x) => `'${x}'`).join(', ');
  const contracts = await q('jbjy-vk9h', { $select: 'count(*) as n, max(proveedor_adjudicado) as name', $where: `documento_proveedor in (${forms})` });
  await sleep(600);
  const registered = await q('qmzu-gj57', { $select: 'nombre, esta_activa', $where: `nit in (${forms})`, $limit: '1' });
  const n = Number(contracts[0] && contracts[0].n) || 0;
  return { nit: e.name + ' · ' + (e.personType === 'person' ? 'persona natural (documento oculto)' : e.nit), contracts: n, inRegistry: registered.length > 0, active: registered[0] ? registered[0].esta_activa : null, ok: n > 0 };
}

async function nationalChecks(Live, Services) {
  const out = [];
  for (const sc of NATIONAL) {
    const started = Date.now();
    const entry = { scenario: sc };
    try {
      const interp = Services.interpret(sc.what);
      entry.understood = Services.describe(interp, 'es');
      const res = await Live.national({ what: sc.what, interpretation: interp, region: sc.region, today: new Date().toISOString().slice(0, 10) });
      entry.terms = res.terms.map((t) => t.term + (t.exact ? ' (como lo escribió)' : '') + (t.like ? ' [' + t.like + ']' : ''));
      entry.failed = res.failed;
      entry.found = res.suppliers.length;
      entry.reach = { national: 0, regional: 0, local: 0 };
      res.suppliers.forEach((s) => { entry.reach[s.reach]++; });
      entry.withContact = res.suppliers.filter((s) => s.contacts && (s.contacts.phone || s.contacts.email)).length;
      entry.inRegion = res.suppliers.filter((s) => s.inBuyerRegion).length;
      entry.multiNeed = res.suppliers.filter((s) => s.needs.length > 1).length;
      entry.withPhone = res.suppliers.filter((s) => s.contacts && s.contacts.phone).length;
      entry.people = res.suppliers.filter((s) => s.personType === 'person').length;
      // Only individuals: a cleaning company that sends «operarias» is a real supplier.
      entry.staffLeaks = res.suppliers.filter((s) => s.personType === 'person' && STAFF.test(s.example || '')).map((s) => s.name + ': ' + s.example);
      const firstPeople = res.suppliers.filter((s) => s.personType === 'person').slice(0, 4);
      entry.topPeople = firstPeople.map((s) => ({ name: s.name, departments: s.departments.length, contracts: s.contracts, example: s.example, contact: !!(s.contacts && (s.contacts.phone || s.contacts.email)) }));
      entry.top = res.suppliers.filter((s) => s.personType === 'company').slice(0, 6).map((s) => ({ name: s.name, nit: s.nit, departments: s.departments.length, contracts: s.contracts, last: s.last, needs: s.needs, exact: s.exact, example: s.example, phone: s.contacts ? s.contacts.phone : '', website: s.contacts ? s.contacts.website : '', contact: !!(s.contacts && (s.contacts.phone || s.contacts.email)) }));
      entry.verified = [];
      for (const s of res.suppliers.filter((x) => x.personType === 'company').slice(0, 3).concat(firstPeople.slice(0, 2))) {
        await sleep(800);
        entry.verified.push(await verifyNational(s).catch((err) => ({ nit: s.name, ok: false, error: String(err.message) })));
      }
    } catch (err) {
      entry.error = (err && [err.code, err.message].filter(Boolean).join(' · ')) || String(err);
    }
    entry.seconds = Math.round((Date.now() - started) / 100) / 10;
    out.push(entry);
    console.log(JSON.stringify({ national: sc.what, found: entry.found, error: entry.error || null, seconds: entry.seconds }));
    await sleep(1500);
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const Live = loadApp();
  const Services = require('../src/core/services');
  const national = await nationalChecks(Live, Services);
  fs.writeFileSync(path.join(OUT, 'national.json'), JSON.stringify({ at: new Date().toISOString(), national }, null, 2));
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
      entry.error = (err && [err.code, err.message].filter(Boolean).join(' · ')) || String(err);
    }
    entry.seconds = Math.round((Date.now() - started) / 100) / 10;
    report.push(entry);
    console.log(JSON.stringify({ what: sc.what, place: sc.place, found: entry.stats && entry.stats.total, error: entry.error || null }));
    await sleep(3000); // be gentle with the public Overpass server
  }
  fs.writeFileSync(path.join(OUT, 'live-check.json'), JSON.stringify({ at: new Date().toISOString(), report }, null, 2));

  const lines = ['# Supplier Scout · prueba con datos reales', '', `Fecha: ${new Date().toISOString()}`, '', '# Proveedores nacionales (SECOP II)', ''];
  for (const e of national) {
    lines.push(`## ${e.scenario.what} · zona ${e.scenario.region}`, '');
    if (e.error) { lines.push(`- **Error:** ${e.error}`, ''); continue; }
    lines.push(`- Entendió: ${e.understood.join(', ') || '(por nombre)'} · términos: ${e.terms.join(', ')}${e.failed.length ? ' · fallaron: ' + e.failed.join(', ') : ''} · ${e.seconds} s`);
    lines.push(`- Empresas: ${e.found} · nacionales ${e.reach.national}, regionales ${e.reach.regional}, locales ${e.reach.local} · con contacto ${e.withContact} · con teléfono marcable ${e.withPhone} · en la zona ${e.inRegion} · cubren varias necesidades ${e.multiNeed}`);
    lines.push(`- Personas naturales: ${e.people} · contratos de personal («apoyo a la gestión») de personas que se colaron: ${e.staffLeaks.length}${e.staffLeaks.length ? ' → ' + e.staffLeaks.join(' | ') : ''}`);
    for (const r of e.topPeople) lines.push(`  - (persona natural) ${r.name} · ${r.departments} dptos · ${r.contracts} contratos${r.contact ? ' · con contacto' : ''}\n    - Ej.: ${r.example || '(sin ejemplo)'}`);
    for (const r of e.top) lines.push(`  - ${r.name} · NIT ${r.nit} · ${r.departments} dptos · ${r.contracts} contratos · último ${r.last} · ${r.needs.join('+')}${r.exact ? ' · palabras exactas' : ''}${r.phone ? ' · ' + r.phone : ''}${r.website ? ' · ' + r.website : ''}\n    - Ej.: ${r.example || '(sin ejemplo)'}`);
    lines.push(`- Verificadas por NIT en los datos de SECOP: ${e.verified.filter((v) => v.ok).length}/${e.verified.length}`);
    for (const v of e.verified) lines.push(`  - ${v.ok ? 'OK' : 'NO'} ${v.nit} · ${v.contracts} contratos con ese NIT · en el registro de proveedores: ${v.inRegistry ? 'sí' : 'no'}${v.error ? ' · ' + v.error : ''}`);
    lines.push('');
  }
  lines.push('# Negocios cercanos (OpenStreetMap)', '');
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
