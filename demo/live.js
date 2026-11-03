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
  var ALTERNATIVES = 5;
  // Nominatim's policy: at most one request per second.
  var NOMINATIM_GAP_MS = 1100;
  // The public Overpass server can take 30 s or more to answer (measured from
  // GitHub's servers in November 2026). After this long the page stops waiting
  // and asks Nominatim instead: fast, and also OpenStreetMap data.
  var OVERPASS_TIMEOUT_MS = 15000;
  // After this long without an answer, Nominatim is asked in parallel; whichever
  // gives a usable answer first is shown (Overpass preferred: it is more complete).
  var FALLBACK_AFTER_MS = 5000;
  // Nominatim fallback: one request per tag, at most this many tags, plus one
  // search by the typed words when the tags found little.
  var FALLBACK_TAGS = 3;
  var FALLBACK_TEXT_BELOW = 10;
  // Enough for a whole town; the ranking orders them by distance.
  var MAX_RESULTS = 150;
  // Driving times from the OSRM demo server (FOSSGIS): one table request per
  // search, at most 100 places, non-commercial use. If it fails, the page
  // falls back to straight-line distance.
  var ROUTES_ENDPOINT = 'https://router.project-osrm.org/table/v1/driving/';
  var MAX_ROUTED = 99;
  var ROUTES_TIMEOUT_MS = 12000;
  var TIMEOUT_MS = 30000;

  function LiveError(code, detail) {
    var err = new Error(code + (detail ? ': ' + detail : ''));
    err.code = code;
    return err;
  }

  function fetchJson(url, init, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || TIMEOUT_MS);
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

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Nominatim and the OSRM demo server allow at most one request per second.
  // Calls to each service are queued so that holds across searches too,
  // even if someone clicks fast or picks alternatives one after another.
  var queues = {};
  function politely(service, task) {
    var q = queues[service] || (queues[service] = { last: 0, chain: Promise.resolve() });
    var run = q.chain.then(function () {
      var gap = q.last + NOMINATIM_GAP_MS - Date.now();
      return (gap > 0 ? wait(gap) : Promise.resolve()).then(function () {
        q.last = Date.now();
        return task();
      });
    });
    q.chain = run.catch(function () {});
    return run;
  }

  /**
   * Place name -> { places, movedFrom }. Looks in the chosen country first; if the
   * place is not there ("Lima" with Colombia selected), asks once more without a
   * country, one second later, and says which country it was found in.
   */
  function locate(place, country) {
    return politely('nominatim', function () { return fetchJson(Osm.geocodeUrl(place, country, { limit: ALTERNATIVES })); }).then(function (results) {
      var places = Osm.parsePlaces(results);
      if (places.length || !country) return { places: places, movedFrom: null };
      return politely('nominatim', function () {
        return fetchJson(Osm.geocodeUrl(place, null, { limit: ALTERNATIVES }));
      }).then(function (world) {
        return { places: Osm.parsePlaces(world), movedFrom: country };
      });
    });
  }

  function distanceKm(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * Driving time and road distance from `point` to the nearest suppliers.
   * Resolves { [supplierId]: { minutes, km } }, or null when the service fails.
   */
  function travelTimes(point, suppliers) {
    var placed = suppliers.filter(function (s) { return s.lat != null && s.lng != null; })
      .sort(function (a, b) { return distanceKm(point, a) - distanceKm(point, b); })
      .slice(0, MAX_ROUTED);
    if (!placed.length) return Promise.resolve(null);
    var coords = [point].concat(placed).map(function (p) { return Number(p.lng).toFixed(6) + ',' + Number(p.lat).toFixed(6); }).join(';');
    return politely('osrm', function () {
      return fetchJson(ROUTES_ENDPOINT + coords + '?sources=0&annotations=duration,distance', null, ROUTES_TIMEOUT_MS);
    }).then(function (json) {
      if (!json || json.code !== 'Ok' || !Array.isArray(json.durations) || !Array.isArray(json.durations[0])) return null;
      var out = {};
      placed.forEach(function (s, i) {
        var sec = json.durations[0][i + 1];
        var m = json.distances && json.distances[0] ? json.distances[0][i + 1] : null;
        if (typeof sec === 'number' && isFinite(sec) && sec >= 0) {
          out[s.id] = { minutes: Math.max(1, Math.round(sec / 60)), km: typeof m === 'number' && isFinite(m) ? Math.round(m / 100) / 10 : null };
        }
      });
      return out;
    }, function () { return null; });
  }

  /**
   * Geocode `place` (or use `point`, a place chosen among the alternatives or the
   * browser's location), search what the buyer typed (`what`, read by
   * ScoutServices.interpret: map tags + words in business names) within
   * `radiusKm` (capped at 10 km by Overpass etiquette) and return a dataset the
   * demo can load like the samples. A plain `category` still works.
   */
  function search(params) {
    var p = params || {};
    var place = String(p.place || '').trim();
    var what = String(p.what || '').trim().slice(0, 120);
    var wanted = what && root.ScoutServices ? root.ScoutServices.interpret(what) : null;
    if (wanted && wanted.kind === 'empty') wanted = null;
    var category = wanted ? wanted.categories[0] || '' : p.category;
    if (!wanted && !p.category) return Promise.reject(LiveError('nothing-to-search'));
    var given = p.point && isFinite(p.point.lat) && isFinite(p.point.lng) && Math.abs(p.point.lat) <= 90 && Math.abs(p.point.lng) <= 180
      ? p.point : null;
    if (p.point && !given) return Promise.reject(LiveError('place-not-found'));
    var located = given
      ? Promise.resolve({ places: [given], movedFrom: null, given: true })
      : locate(place, p.country);
    return located.then(function (loc) {
      var point = loc.places[0];
      if (!point) throw LiveError('place-not-found');
      var country = point.country || p.country;
      var scope = Osm.searchRadius(point, p.radiusKm);
      var radiusKm = scope.km;
      var query = wanted
        ? Osm.buildQuery({ tags: wanted.tags, nameHint: wanted.nameHint, lat: point.lat, lng: point.lng, radiusM: radiusKm * 1000, limit: MAX_RESULTS, serverTimeout: 12 })
        : Osm.buildQuery({ category: p.category, lat: point.lat, lng: point.lng, radiusM: radiusKm * 1000, limit: MAX_RESULTS, serverTimeout: 12 });
      var tags = wanted ? wanted.tags : ((root.ScoutCategories && root.ScoutCategories.byId(p.category) || {}).osm || []);
      var source = 'overpass';
      var overpass = fetchJson(Osm.ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      }, OVERPASS_TIMEOUT_MS).then(function (json) {
        return { ok: true, found: Osm.normalize(json, { country: country, category: category }) };
      }, function (err) { return { ok: false, err: err }; });

      function nominatimSearch() {
        var asks = tags.slice(0, FALLBACK_TAGS).map(function (tag) { return { tag: tag }; });
        var merged = [];
        var seen = {};
        function ask(a) {
          return politely('nominatim', function () {
            return fetchJson(Osm.poiSearchUrl({ tag: a.tag, text: a.text, lat: point.lat, lng: point.lng, radiusKm: radiusKm, country: country }));
          }).then(function (results) {
            Osm.normalizePois(results, { country: country, category: category, center: point, radiusKm: radiusKm, tag: a.tag }).suppliers.forEach(function (s) {
              if (!seen[s.id]) { seen[s.id] = true; merged.push(s); }
            });
          });
        }
        return asks.reduce(function (chain, a) { return chain.then(function () { return ask(a); }); }, Promise.resolve()).then(function () {
          // Few businesses by type: also look for the typed words in names ("Cerrajería La 10").
          if (merged.length < FALLBACK_TEXT_BELOW && what) return ask({ text: what });
        }).then(function () {
          var withWebsite = merged.filter(function (s) { return s.websites.length; }).length;
          return { suppliers: merged, stats: { total: merged.length, withWebsite: withWebsite, withoutWebsite: merged.length - withWebsite, withPhone: merged.filter(function (s) { return s.phones.length; }).length } };
        });
      }

      var late = wait(FALLBACK_AFTER_MS).then(function () { return { late: true }; });
      return Promise.race([overpass, late]).then(function (first) {
        if (first.ok) return first.found;
        if (p.noFallback) return overpass.then(function (o) { if (o.ok) return o.found; throw o.err; });
        // Overpass failed or is slow: ask Nominatim while Overpass keeps going.
        return nominatimSearch().then(function (fromNominatim) {
          return Promise.race([overpass, Promise.resolve({ pending: true })]).then(function (o) {
            if (o.ok) return o.found;
            source = 'nominatim';
            return fromNominatim;
          });
        }, function () {
          return overpass.then(function (o) { if (o.ok) return o.found; throw o.err; });
        });
      }).then(function (found) {
        var short = (point.label || place).slice(0, 60);
        var routes = p.noRoutes ? Promise.resolve(null) : travelTimes(point, found.suppliers);
        return routes.then(function (travel) { return {
          travel: travel,
          source: source,
          point: point,
          alternatives: loc.given ? [] : loc.places.slice(1),
          movedFrom: loc.movedFrom && country !== loc.movedFrom ? loc.movedFrom : null,
          country: country,
          scope: scope.scope,
          wanted: wanted,
          radiusKm: radiusKm,
          stats: found.stats,
          dataset: {
            live: true,
            country: country,
            label: { es: 'Búsqueda real · ' + short, en: 'Live search · ' + short, pt: 'Busca real · ' + short, fr: 'Recherche réelle · ' + short },
            clusters: '',
            fx: p.fx || { USD: 1 },
            origins: [{ id: 'live', label: short, lat: point.lat, lng: point.lng }],
            needs: [{
              id: 'live', category: category || '', item: what || p.item || '', quantity: Number(p.quantity) || null, unit: p.unit || 'unidad',
              originId: 'live', radiusKm: radiusKm, neededInDays: Number(p.neededInDays) || null
            }],
            suppliers: found.suppliers,
            quotes: [],
            referrals: []
          }
        }; });
      });
    });
  }

  root.ScoutLive = { search: search };
})(typeof globalThis !== 'undefined' ? globalThis : this);
