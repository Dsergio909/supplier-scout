/**
 * Supplier Scout — live search on OpenStreetMap from the browser.
 *
 * The only file of the demo that uses the network, and only towards the two
 * OpenStreetMap services the Content-Security-Policy allows: Nominatim (place
 * name -> coordinates) and Overpass (businesses around that point). Query
 * building and parsing come from src/core/osm.js, the same code the CLI uses.
 *
 * Nominatim's usage policy asks browser apps to send a Referer and stay under
 * one request per second: each search makes one geocoding call and the button
 * is disabled while a search runs.
 */
(function (root) {
  'use strict';

  var Osm = root.ScoutOsm;
  var MAX_BYTES = 5 * 1024 * 1024;
  var TIMEOUT_MS = 30000;

  function LiveError(code, detail) {
    var err = new Error(code + (detail ? ': ' + detail : ''));
    err.code = code;
    return err;
  }

  function fetchJson(url, init) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    var options = Object.assign({
      headers: { Accept: 'application/json' },
      // The page sets no-referrer for its links; OSM's policy asks API callers for one.
      referrerPolicy: 'strict-origin-when-cross-origin',
      credentials: 'omit',
      signal: controller.signal
    }, init || {});
    return fetch(url, options).then(function (res) {
      return res.text().then(function (text) {
        if (text.length > MAX_BYTES) throw LiveError('too-large');
        if (res.status === 429 || res.status === 504) throw LiveError('busy', String(res.status));
        if (!res.ok) throw LiveError('http', String(res.status));
        try { return JSON.parse(text); } catch (e) { throw LiveError('bad-response'); }
      });
    }, function (err) {
      throw LiveError(err && err.name === 'AbortError' ? 'timeout' : 'network');
    }).finally(function () { clearTimeout(timer); });
  }

  /**
   * Geocode `place`, search `category` within `radiusKm` (capped at 10 km by
   * Overpass etiquette) and return a dataset the demo can load like the samples.
   */
  function search(params) {
    var p = params || {};
    var radiusKm = Math.min(Osm.MAX_RADIUS_M / 1000, Math.max(1, Number(p.radiusKm) || 3));
    var place = String(p.place || '').trim();
    return fetchJson(Osm.geocodeUrl(place, p.country)).then(function (results) {
      var point = Osm.parseGeocode(results, place);
      if (!point) throw LiveError('place-not-found');
      var query = Osm.buildQuery({ category: p.category, lat: point.lat, lng: point.lng, radiusM: radiusKm * 1000 });
      return fetchJson(Osm.ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      }).then(function (json) {
        var found = Osm.normalize(json, { country: p.country, category: p.category });
        var short = place.slice(0, 60);
        return {
          point: point,
          radiusKm: radiusKm,
          stats: found.stats,
          dataset: {
            live: true,
            country: p.country,
            label: { es: 'Búsqueda real · ' + short, en: 'Live search · ' + short, pt: 'Busca real · ' + short, fr: 'Recherche réelle · ' + short },
            clusters: '',
            fx: p.fx || { USD: 1 },
            origins: [{ id: 'live', label: short, lat: point.lat, lng: point.lng }],
            needs: [{
              id: 'live', category: p.category, item: p.item || '', quantity: Number(p.quantity) || 1, unit: p.unit || 'unidad',
              originId: 'live', radiusKm: radiusKm, neededInDays: Number(p.neededInDays) || null
            }],
            suppliers: found.suppliers,
            quotes: [],
            referrals: []
          }
        };
      });
    });
  }

  root.ScoutLive = { search: search };
})(typeof globalThis !== 'undefined' ? globalThis : this);
