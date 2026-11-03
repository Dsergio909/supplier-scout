/**
 * Place name -> coordinates with OpenStreetMap Nominatim (free, no key).
 * Usage policy: at most one request per second and an identifying User-Agent,
 * both respected here (the agent calls it once per search).
 *
 * The URL and the parsing live in src/core/osm.js, shared with the web demo.
 *
 * Data © OpenStreetMap contributors (ODbL).
 */
'use strict';

const Osm = require('../core/osm');
const { fetchJson } = require('./http');

const ENDPOINT = Osm.GEOCODE_ENDPOINT;
const buildUrl = Osm.geocodeUrl;

async function geocode(place, countryCode, options = {}) {
  const results = await fetchJson(buildUrl(place, countryCode), { fetchImpl: options.fetchImpl });
  return Osm.parseGeocode(results, place);
}

module.exports = { ENDPOINT, buildUrl, geocode };
