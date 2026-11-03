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
      .replace(/[^a-z0-9| ]/g, '').replace(/\|{2,}/g, '|').replace(/^\||\|$/g, '').trim();
    if (plain.length > 200) plain = plain.slice(0, 200).replace(/\|[^|]*$/, '');
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
    var tags = Array.isArray(p.tags) ? p.tags : (cat ? cat.osm : []);
    var lines = tags
      .filter(function (kv) { return Array.isArray(kv) && /^[a-z0-9_:]+$/.test(kv[0]) && /^[a-z0-9_]+$/.test(kv[1]); })
      .slice(0, 12)
      .map(function (kv) { return '  nwr["' + kv[0] + '"="' + kv[1] + '"]' + around + ';'; });
    var hint = safeRegex(p.nameHint != null ? p.nameHint : cat && cat.nameHint);
    if (hint) lines.push('  nwr["name"~"' + hint + '",i]' + around + ';');
    if (!lines.length) throw new Error('There is nothing to search for: give a category, map tags or a name hint');
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

  /**
   * Nominatim URL for a place name, limited to one country when it is known.
   * options.limit > 1 asks for alternatives ("San Pedro" exists in many places)
   * and the address parts used to name them.
   */
  function geocodeUrl(place, countryCode, options) {
    var q = String(place || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
    if (!q) throw new Error('A place name is required, e.g. "Fontibón, Bogotá"');
    var limit = Math.min(10, Math.max(1, Math.round(Number(options && options.limit) || 1)));
    var params = new URLSearchParams({ q: q, format: 'jsonv2', limit: String(limit) });
    if (limit > 1) params.set('addressdetails', '1');
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

  // Nominatim address types that name a whole town or city (search all of it, up to the cap).
  var WHOLE_PLACE = ['city', 'town', 'village', 'municipality', 'hamlet'];

  function clean(text, max) {
    return String(text == null ? '' : text).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  /**
   * Every Nominatim hit -> { lat, lng, name, label, full, kind, country, bbox, wholePlace }.
   * Needs the address parts (geocodeUrl with options.limit > 1) to name homonyms apart.
   * label is short and tells homonyms apart: "San Pedro, Valle del Cauca".
   */
  function parsePlaces(results) {
    if (!Array.isArray(results)) return [];
    var seen = {};
    return results.map(function (hit) {
      var lat = Number(hit && hit.lat);
      var lng = Number(hit && hit.lon);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      var a = hit.address || {};
      var full = clean(hit.display_name, 200);
      var name = clean(hit.name || full.split(',')[0], 80);
      var town = a.city || a.town || a.village || a.municipality || a.county;
      var region = a.state || a.region || a.province || a.county;
      var parts = [name];
      if (town && clean(town, 80) !== name) parts.push(clean(town, 80));
      if (region && parts.indexOf(clean(region, 80)) === -1) parts.push(clean(region, 80));
      // Without address details, the first two parts of the full name ("Kennedy, Bogotá").
      if (parts.length === 1 && full.indexOf(',') !== -1) parts = full.split(',').slice(0, 2).map(function (x) { return x.trim(); });
      var bb = Array.isArray(hit.boundingbox) ? hit.boundingbox.map(Number) : null;
      var kind = clean(hit.addresstype || hit.type, 40);
      var place = {
        lat: lat, lng: lng, name: name, label: parts.filter(Boolean).join(', '), full: full,
        kind: kind,
        country: /^[a-z]{2}$/i.test(a.country_code || '') ? a.country_code.toUpperCase() : null,
        bbox: bb && bb.length === 4 && bb.every(isFinite) ? bb : null,
        wholePlace: WHOLE_PLACE.indexOf(kind) !== -1
      };
      var key = place.label + '|' + Math.round(lat * 100) + '|' + Math.round(lng * 100);
      if (seen[key]) return null;
      seen[key] = true;
      return place;
    }).filter(Boolean);
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad;
    var dLng = (lng2 - lng1) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * How far around the point to search. A town or city is searched whole when it
   * fits in the cap ("all of Barranquilla"); a bigger one is searched around its
   * centre and the caller says so. Neighbourhoods and addresses use the radius asked.
   * Returns { km, scope: 'radius' | 'whole' | 'centre' }.
   */
  function searchRadius(place, wantedKm) {
    var maxKm = MAX_RADIUS_M / 1000;
    var km = Math.min(maxKm, Math.max(1, Number(wantedKm) || 3));
    if (!place || !place.wholePlace || !place.bbox) return { km: km, scope: 'radius' };
    var b = place.bbox; // [south, north, west, east]
    var half = Math.max(
      haversineKm(place.lat, place.lng, b[0], place.lng), haversineKm(place.lat, place.lng, b[1], place.lng),
      haversineKm(place.lat, place.lng, place.lat, b[2]), haversineKm(place.lat, place.lng, place.lat, b[3])
    );
    if (half > maxKm) return { km: maxKm, scope: 'centre' };
    return { km: Math.max(km, Math.min(maxKm, Math.ceil(half))), scope: 'whole' };
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
    geocodeUrl: geocodeUrl, parseGeocode: parseGeocode, parsePlaces: parsePlaces, searchRadius: searchRadius,
    mapsSearchUrl: mapsSearchUrl
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.ScoutOsm = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
