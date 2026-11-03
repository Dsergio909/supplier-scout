/**
 * Supplier Scout — where to look, depending on what is being bought.
 *
 * Purchasing does not look for everything on a map. A plumber or a locksmith
 * has to come to you, so nearby matters. Stationery, cleaning supplies or
 * uniforms are usually bought from national distributors that deliver
 * anywhere, give credit and invoice properly, even if their warehouse is in
 * another city. So every search is answered in layers:
 *
 *   - national suppliers (public procurement records, where available),
 *   - the buyer's own known suppliers,
 *   - businesses nearby (the map),
 *   - ready-made web searches (Google, Facebook, LinkedIn, Google Maps):
 *     links only, opened by the buyer, nothing is scraped.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Categories = isNode ? require('./categories') : root.ScoutCategories;

  // Categories that are mostly goods delivered from anywhere (national first).
  var GOODS = ['packaging', 'hardware', 'printing', 'textiles', 'electronics', 'food', 'cleaning', 'office', 'furniture', '3dprint'];
  // Services that are bought from firms, not from the corner shop (national is useful too).
  var FIRM_SERVICES = ['security', 'it', 'accounting', 'legal', 'cleaningService', 'pest', 'fireSafety', 'elevators', 'power', 'moving', 'catering', 'laundry'];

  var PHRASES = {
    es: { wholesale: '{need} mayorista para empresas {country}', national: 'distribuidor de {need} con despacho nacional {country}', local: '{need} {place}', fb: '{need} {where}' },
    en: { wholesale: '{need} wholesale supplier for businesses {country}', national: '{need} distributor nationwide delivery {country}', local: '{need} {place}', fb: '{need} {where}' },
    pt: { wholesale: '{need} atacado para empresas {country}', national: 'distribuidor de {need} entrega nacional {country}', local: '{need} {place}', fb: '{need} {where}' },
    fr: { wholesale: '{need} grossiste pour entreprises {country}', national: 'distributeur {need} livraison nationale {country}', local: '{need} {place}', fb: '{need} {where}' }
  };

  function clean(text, max) {
    return String(text || '').replace(/[\u0000-\u001f<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }
  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (_, k) { return values[k] || ''; }).replace(/\s+/g, ' ').trim();
  }

  /**
   * How to weigh distance for an interpreted need (see ScoutServices.interpret):
   *   'onsite'  — someone has to come (plumber, locksmith): nearby first.
   *   'firm'    — a service usually contracted from companies (security, IT): both.
   *   'goods'   — supplies that can be shipped (stationery, cleaning): national first.
   *   'unknown' — free text that matched nothing: show every layer.
   */
  function scopeOf(interpretation) {
    var i = interpretation || {};
    if (i.kind === 'service') {
      var firm = (i.services || []).some(function (id) { return FIRM_SERVICES.indexOf(id) !== -1; });
      return firm ? 'firm' : 'onsite';
    }
    if (i.kind === 'category') {
      var goods = (i.categories || []).some(function (id) { return GOODS.indexOf(id) !== -1; });
      return goods ? 'goods' : 'onsite';
    }
    return 'unknown';
  }

  /** Layer order for a scope: which results the buyer sees first. */
  function layerOrder(scope) {
    if (scope === 'onsite') return ['nearby', 'mine', 'national', 'web'];
    return ['national', 'mine', 'nearby', 'web'];
  }

  /**
   * Ready-made searches the buyer opens in a new tab. Nothing is fetched or
   * copied from these sites: they are plain links, like typing it yourself.
   * opts: { need, place, countryName, scope, lang }
   */
  function webSearches(opts) {
    var o = opts || {};
    var lang = PHRASES[o.lang] ? o.lang : 'es';
    var p = PHRASES[lang];
    var need = clean(o.need);
    if (!need) return [];
    var values = { need: need, place: clean(o.place), country: clean(o.countryName, 40) };
    values.where = o.scope === 'onsite' ? values.place : values.country;
    var list = [];
    function add(id, query, url) { list.push({ id: id, query: query, url: url }); }
    var enc = encodeURIComponent;
    if (o.scope !== 'onsite') {
      var wholesale = fill(p.wholesale, values);
      var national = fill(p.national, values);
      add('google-wholesale', wholesale, 'https://www.google.com/search?q=' + enc(wholesale));
      add('google-national', national, 'https://www.google.com/search?q=' + enc(national));
      add('linkedin', need, 'https://www.linkedin.com/search/results/companies/?keywords=' + enc(fill('{need} {country}', values)));
    }
    var local = fill(p.local, values);
    add('google-local', local, 'https://www.google.com/search?q=' + enc(local));
    var fb = fill(p.fb, values);
    add('facebook', fb, 'https://www.facebook.com/search/pages/?q=' + enc(fb));
    add('maps', local, 'https://www.google.com/maps/search/' + enc(local));
    return list;
  }

  /** Category ids a known supplier covers that match the interpreted need. */
  function coversNeed(supplierCategories, interpretation) {
    var wanted = (interpretation && interpretation.categories) || [];
    return (supplierCategories || []).filter(function (c) { return wanted.indexOf(c) !== -1; });
  }

  function categoryLabel(id, lang) {
    var c = Categories.byId(id);
    return c ? (c.label[lang] || c.label.es) : id;
  }

  var api = {
    GOODS: GOODS,
    FIRM_SERVICES: FIRM_SERVICES,
    scopeOf: scopeOf,
    layerOrder: layerOrder,
    webSearches: webSearches,
    coversNeed: coversNeed,
    categoryLabel: categoryLabel
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.ScoutChannels = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
