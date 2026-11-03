/**
 * OpenStreetMap (Overpass API) connector. Works in any country, free, no key.
 *
 * The query building and the parsing live in src/core/osm.js so the web
 * demo can use them too; this file only does the HTTP call for the CLI and
 * the agent.
 *
 * Data © OpenStreetMap contributors, available under the ODbL.
 */
'use strict';

const Osm = require('../core/osm');
const { fetchJson } = require('./http');

const { ENDPOINT, ATTRIBUTION, MAX_RADIUS_M, buildQuery, normalize, safeRegex } = Osm;

async function searchOsm(params, options = {}) {
  const query = buildQuery(params);
  const json = await fetchJson(options.endpoint || ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    fetchImpl: options.fetchImpl
  });
  return Object.assign(normalize(json, params), { query });
}

module.exports = { ENDPOINT, ATTRIBUTION, MAX_RADIUS_M, buildQuery, normalize, searchOsm, safeRegex };
