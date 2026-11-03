/**
 * Supplier Scout — the buyer's shortlist.
 *
 * How purchasing usually works: find several options, contact them, collect
 * at least three quotes and compare them in a table (cuadro comparativo) by
 * price, lead time, payment terms and warranty before choosing. The shortlist
 * keeps the suppliers picked from any search (sample or live map data) with
 * their status, and exports that comparison table as CSV.
 *
 * Saved entries come back from the browser's storage, which other pages on
 * the same site can write to, so every entry is checked like an import.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Csv = isNode ? require('./csv') : root.ScoutCsv;
  var Countries = isNode ? require('./countries') : root.ScoutCountries;

  var STATUSES = ['todo', 'contacted', 'quoted', 'chosen', 'discarded'];
  var QUOTES_GOAL = 3;
  var MAX_ENTRIES = 100;

  function str(value, max) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
  }
  function num(value) {
    var n = Number(value);
    return value !== null && value !== '' && isFinite(n) ? n : null;
  }

  /** One saved entry, cleaned; null when it is not usable. */
  function sanitizeEntry(value) {
    if (!value || typeof value !== 'object') return null;
    var id = str(value.id, 120);
    var name = str(value.name, 120);
    if (!id || !name) return null;
    var lat = num(value.lat);
    var lng = num(value.lng);
    var placed = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    var phone = str(value.phone, 20);
    var osm = str(value.osm, 40);
    return {
      id: id,
      name: name,
      phone: /^\+?[0-9]{6,15}$/.test(phone) ? phone : '',
      address: str(value.address, 160),
      city: str(value.city, 80),
      country: /^[A-Z]{2}$/.test(value.country || '') ? value.country : '',
      lat: placed ? lat : null,
      lng: placed ? lng : null,
      osm: /^osm:(node|way|relation)\/\d+$/.test(osm) ? osm : '',
      need: str(value.need, 120),
      place: str(value.place, 120),
      status: STATUSES.indexOf(value.status) !== -1 ? value.status : 'todo',
      price: str(value.price, 60),
      lead: str(value.lead, 60),
      payment: str(value.payment, 60),
      warranty: str(value.warranty, 60),
      notes: str(value.notes, 300),
      sample: value.sample === true,
      addedAt: /^\d{4}-\d{2}-\d{2}$/.test(value.addedAt || '') ? value.addedAt : ''
    };
  }

  function sanitize(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).map(sanitizeEntry).filter(function (e) {
      if (!e || seen[e.id]) return false;
      seen[e.id] = true;
      return true;
    }).slice(0, MAX_ENTRIES);
  }

  /** A supplier record (sample or map) -> a new shortlist entry. ctx: { need, place, sample, today } */
  function fromSupplier(s, ctx) {
    var c = ctx || {};
    var osm = (s.sources || []).map(function (src) { return src && src.ref; }).filter(function (ref) { return /^osm:/.test(ref || ''); })[0];
    return sanitizeEntry({
      id: s.id, name: s.name, phone: (s.phones || [])[0], address: s.address || '', city: s.city || '',
      country: s.country || '', lat: s.lat, lng: s.lng, osm: osm || '', need: c.need || '', place: c.place || '',
      status: 'todo', sample: !!c.sample, addedAt: c.today || ''
    });
  }

  /** Progress towards the usual three quotes. */
  function summary(list) {
    var count = function (st) { return list.filter(function (e) { return e.status === st; }).length; };
    var quoted = count('quoted') + count('chosen');
    return {
      total: list.length,
      todo: count('todo'),
      contacted: count('contacted'),
      quoted: quoted,
      chosen: count('chosen'),
      discarded: count('discarded'),
      goal: QUOTES_GOAL,
      goalReached: quoted >= QUOTES_GOAL
    };
  }

  /**
   * "+573005550210" -> "(+57) 3005550210": readable, and a cell that starts with
   * "+" would otherwise have to be escaped against spreadsheet formulas.
   */
  function phoneForSheet(phone, country) {
    if (!phone) return '';
    var code = String((Countries.getProfile(country || 'XX') || {}).callingCode || '');
    if (code && phone.indexOf('+' + code) === 0) return '(+' + code + ') ' + phone.slice(code.length + 1);
    return phone.charAt(0) === '+' ? '(+) ' + phone.slice(1) : phone;
  }

  /**
   * The comparison table as CSV text (opens in Excel or Google Sheets).
   * labels: { headers: [...12], status: { todo: '...' } }
   */
  function toCsv(list, labels) {
    var rows = [labels.headers];
    list.forEach(function (e) {
      rows.push([
        e.name, phoneForSheet(e.phone, e.country), [e.address, e.city].filter(Boolean).join(', '), e.need, e.place,
        labels.status[e.status] || e.status, e.price, e.lead, e.payment, e.warranty, e.notes,
        e.osm ? 'https://www.openstreetmap.org/' + e.osm.slice(4) : ''
      ]);
    });
    return Csv.toCsv(rows);
  }

  var api = { STATUSES: STATUSES, QUOTES_GOAL: QUOTES_GOAL, MAX_ENTRIES: MAX_ENTRIES, sanitize: sanitize, sanitizeEntry: sanitizeEntry, fromSupplier: fromSupplier, summary: summary, toCsv: toCsv };

  if (isNode) {
    module.exports = api;
  } else {
    root.ScoutShortlist = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
