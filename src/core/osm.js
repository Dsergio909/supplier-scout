/**
 * Supplier Scout — OpenStreetMap queries and results, without the network.
 *
 * Builds the Overpass query and the Nominatim (geocoding) URL, and turns
 * their JSON into supplier records. The CLI connectors (src/connectors) and
 * the web demo (demo/live.js) do the fetching; this file only does the logic,
 * so it runs unchanged in Node, the browser and the tests.
 *
 * Why it matters for offline suppliers: OSM volunteers map shops and
 * workshops by walking the street, so many businesses that have no website
 * are on the map. stats.withoutWebsite shows how many.
 *
 * Also builds the official "search on Google Maps" link (no key, no scraping):
 * Google Maps lists businesses that are on neither the web nor OSM.
 *
 * Data © OpenStreetMap contributors, available under the ODbL.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Categories = isNode ? require('./categories') : root.ScoutCategories;
  var Countries = isNode ? require('./countries') : root.ScoutCountries;

  var ENDPOINT = 'https://overpass-api.de/api/interpreter';
  var GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
  var MAPS_SEARCH = 'https://www.google.com/maps/search/';
  var MAX_RADIUS_M = 10000;
  var MIN_RADIUS_M = 100;
  var ATTRIBUTION = 'Data © OpenStreetMap contributors (ODbL)';

  // Accent-insensitive matching: OSM names are written "Cartón", "Ferretería", "Papelaria".
  var ACCENTS = { a: '[aáàâã]', e: '[eéê]', i: '[ií]', o: '[oóôõ]', u: '[uúü]', n: '[nñ]', c: '[cç]' };

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * User text -> a safe Overpass regex. Only letters, digits, spaces and "|" survive,
   * so nothing can break out of the quoted string; accent classes are added by us.
   */
  function safeRegex(text) {
    var plain = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9| ]/g, '').replace(/\|{2,}/g, '|').replace(/^\||\|$/g, '').trim().slice(0, 80);
    return plain.replace(/[aeiounc]/g, function (ch) { return ACCENTS[ch]; });
  }

  function checkCoords(lat, lng) {
    var la = Number(lat);
    var ln = Number(lng);
    if (!isFinite(la) || !isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
      throw new Error('lat/lng are required and must be valid coordinates');
    }
    return [la, ln];
  }

  /** Overpass QL for one category around a point. */
  function buildQuery(params) {
    var p = params || {};
    var coords = checkCoords(p.lat, p.lng);
    var r = Math.round(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Number(p.radiusM) || 3000)));
    var cat = Categories.byId(p.category);
    var around = '(around:' + r + ',' + coords[0] + ',' + coords[1] + ')';
    var lines = (cat ? cat.osm : [])
      .filter(function (kv) { return /^[a-z0-9_:]+$/.test(kv[0]) && /^[a-z0-9_]+$/.test(kv[1]); })
      .map(function (kv) { return '  nwr["' + kv[0] + '"="' + kv[1] + '"]' + around + ';'; });
    var hint = safeRegex(p.nameHint != null ? p.nameHint : cat && cat.nameHint);
    if (hint) lines.push('  nwr["name"~"' + hint + '",i]' + around + ';');
    if (!lines.length) throw new Error('Unknown category and no name hint: nothing to search for');
    var max = Math.min(200, Math.max(1, Number(p.limit) || 60));
    return '[out:json][timeout:25];\n(\n' + lines.join('\n') + '\n);\nout center tags ' + max + ';';
  }

  function splitList(value) {
    return String(value || '').split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function unique(list) {
    return list.filter(function (x, i) { return list.indexOf(x) === i; });
  }

  /** Overpass JSON -> supplier records. */
  function normalize(json, options) {
    var opts = options || {};
    var seen = {};
    var suppliers = [];
    ((json && json.elements) || []).forEach(function (el) {
      var tags = el.tags || {};
      var key = el.type + '/' + el.id;
      if (!tags.name || seen[key]) return;
      seen[key] = true;
      var lat = el.lat != null ? el.lat : el.center && el.center.lat;
      var lng = el.lon != null ? el.lon : el.center && el.center.lon;
      var phones = splitList(tags.phone || tags['contact:phone'])
        .concat(splitList(tags['contact:mobile']), splitList(tags['contact:whatsapp']))
        .map(function (ph) { return Countries.normalizePhone(ph, opts.country); }).filter(Boolean);
      var website = tags.website || tags['contact:website'] || tags.url;
      var email = tags.email || tags['contact:email'];
      var street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      var detected = Categories.detect([tags.name, tags.shop, tags.craft, tags.description].filter(Boolean).join(' '));
      suppliers.push({
        id: 'osm-' + el.type + '-' + el.id,
        name: tags.name,
        categories: unique((opts.category ? [opts.category] : []).concat(detected)),
        phones: unique(phones),
        emails: email ? [email] : [],
        websites: website ? [website] : [],
        address: street || tags['addr:full'] || null,
        city: tags['addr:city'] || null,
        country: opts.country || null,
        lat: lat != null ? lat : null,
        lng: lng != null ? lng : null,
        sources: [{ type: 'map', ref: 'osm:' + el.type + '/' + el.id, at: opts.at || today() }],
        verification: 0,
        notes: tags.opening_hours ? 'Horario (OSM): ' + String(tags.opening_hours).slice(0, 120) : null
      });
    });
    var withWebsite = suppliers.filter(function (s) { return s.websites.length; }).length;
    return {
      suppliers: suppliers,
      stats: {
        total: suppliers.length,
        withWebsite: withWebsite,
        withoutWebsite: suppliers.length - withWebsite,
        withPhone: suppliers.filter(function (s) { return s.phones.length; }).length
      },
      attribution: ATTRIBUTION
    };
  }

  /** Nominatim URL for a place name, limited to one country when it is known. */
  function geocodeUrl(place, countryCode) {
    var q = String(place || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
    if (!q) throw new Error('A place name is required, e.g. "Fontibón, Bogotá"');
    var params = new URLSearchParams({ q: q, format: 'jsonv2', limit: '1' });
    if (/^[A-Z]{2}$/.test(countryCode || '') && countryCode !== 'XX') params.set('countrycodes', countryCode.toLowerCase());
    return GEOCODE_ENDPOINT + '?' + params.toString();
  }

  /** First Nominatim hit -> { lat, lng, label }, or null. */
  function parseGeocode(results, place) {
    var hit = Array.isArray(results) ? results[0] : null;
    if (!hit) return null;
    var lat = Number(hit.lat);
    var lng = Number(hit.lon);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat: lat, lng: lng, label: String(hit.display_name || place).slice(0, 160) };
  }

  /**
   * Official Google Maps search link ("Maps URLs", no key): opens Maps with the
   * search typed in, e.g. "Ferretería near Kennedy, Bogotá".
   */
  function mapsSearchUrl(what, where) {
    var clean = function (s) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); };
    var query = [clean(what), clean(where)].filter(Boolean).join(', ');
    if (!query) throw new Error('Nothing to search for');
    return MAPS_SEARCH + '?' + new URLSearchParams({ api: '1', query: query }).toString();
  }

  var api = {
    ENDPOINT: ENDPOINT, GEOCODE_ENDPOINT: GEOCODE_ENDPOINT, ATTRIBUTION: ATTRIBUTION, MAX_RADIUS_M: MAX_RADIUS_M,
    safeRegex: safeRegex, buildQuery: buildQuery, normalize: normalize,
    geocodeUrl: geocodeUrl, parseGeocode: parseGeocode, mapsSearchUrl: mapsSearchUrl
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.ScoutOsm = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
