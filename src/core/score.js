/**
 * Supplier Scout — explainable ranking.
 *
 * Five factors, each 0..1, combined with weights you choose:
 *
 *   price     real cost of YOUR order (see quotes.js), relative to the cheapest option
 *   rating    Bayesian blend of online and team reviews (see reviews.js)
 *   distance  inside your search radius; suppliers that deliver are not penalised much
 *   trust     your verification level plus independent referrals (see trust.js)
 *   speed     lead time, and a hard warning if it misses your deadline
 *
 * Missing data scores neutral (0.5), never zero, and produces a warning.
 * That is what lets an offline supplier with no reviews and no quote yet
 * compete with a web shop: it is "unknown", not "bad".
 *
 * Every result carries its evidence so the UI can answer "why this one?".
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Geo = isNode ? require('./geo') : root.ScoutGeo;
  var Quotes = isNode ? require('./quotes') : root.ScoutQuotes;
  var Reviews = isNode ? require('./reviews') : root.ScoutReviews;
  var Trust = isNode ? require('./trust') : root.ScoutTrust;
  var Schema = isNode ? require('./schema') : root.ScoutSchema;

  var FACTORS = ['price', 'rating', 'distance', 'trust', 'speed'];
  var NEUTRAL = 0.5;
  var SHIPS_FLOOR = 0.6;
  var SPEED_HORIZON_DAYS = 30;

  var PRESETS = {
    balanced: { price: 3, rating: 2, distance: 2, trust: 2, speed: 1 },
    cheapest: { price: 6, rating: 1, distance: 1, trust: 1, speed: 1 },
    reliable: { price: 1, rating: 3, distance: 1, trust: 4, speed: 1 },
    nearest:  { price: 1, rating: 1, distance: 5, trust: 1, speed: 2 },
    urgent:   { price: 1, rating: 1, distance: 2, trust: 1, speed: 5 }
  };

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  /**
   * db:   { suppliers, quotes, referrals }
   * need: { category | categories, quantity, unit, origin: { lat, lng }, radiusKm, neededInDays, budget, weights }
   *
   * Without a quantity (the usual case when you are still looking for options
   * and will negotiate amounts later) quotes are compared by unit price with
   * tax, for the smallest amount each supplier sells; shipping is left out.
   * settings: quote settings (country, vatRate, fx, monthlyRate) — see quotes.landedCost
   *
   * Returns { ranked: [...], excluded: [...] }, ranked best first.
   */
  /**
   * Price per unit with tax for the smallest amount the supplier sells (one
   * pack, or the minimum order), in the base currency. presentValue is that
   * unit price discounted by the payment term, so quotes compare like totals do.
   */
  function unitPrice(quote, settings) {
    var per = quote.per || {};
    var probe = Quotes.landedCost(quote, { quantity: per.qty, unit: per.unit }, settings);
    if (!probe.ok) return probe;
    var moq = quote.minOrder ? Quotes.toBase(quote.minOrder.qty, quote.minOrder.unit, settings.country) : null;
    var pack = Quotes.toBase(per.qty, per.unit, settings.country);
    var min = moq && pack && moq.unit === probe.unit && moq.qty > pack.qty ? moq.qty : null;
    var price = (probe.subtotal + probe.tax) / probe.purchased;
    var months = (Number(quote.paymentDays) || 0) / 30;
    var monthlyRate = Number(settings.monthlyRate) || 0;
    return {
      ok: true,
      unitPrice: Math.round(price * 100) / 100,
      unit: probe.unit,
      minOrder: min,
      currency: probe.currency,
      presentValue: price / Math.pow(1 + monthlyRate, months),
      warnings: probe.warnings.filter(function (w) { return w.code === 'fx_manual' || w.code === 'regional_unit'; })
    };
  }

  function rankSuppliers(db, need, settings) {
    var weights = Object.assign({}, PRESETS.balanced, need.weights || {});
    var radius = Number(need.radiusKm) > 0 ? Number(need.radiusKm) : 10;
    var byId = Trust.indexById(db.suppliers);
    var referralIndex = Trust.buildReferralIndex(db.referrals);
    var quotesBySupplier = new Map();
    db.quotes.forEach(function (q) {
      if (!quotesBySupplier.has(q.supplierId)) quotesBySupplier.set(q.supplierId, []);
      quotesBySupplier.get(q.supplierId).push(q);
    });
    var candidates = [];
    var excluded = [];
    var wantedCats = (Array.isArray(need.categories) ? need.categories : [need.category]).filter(Boolean);
    var byUnit = !(Number(need.quantity) > 0);

    db.suppliers.forEach(function (supplier) {
      if (wantedCats.length && !(supplier.categories || []).some(function (c) { return wantedCats.indexOf(c) !== -1; })) return;
      var km = Geo.distanceKm(need.origin, supplier);
      if (km !== null && km > radius && !supplier.ships) {
        excluded.push({ supplier: supplier, reason: { code: 'out_of_radius', km: round2(km) } });
        return;
      }
      var costs = (quotesBySupplier.get(supplier.id) || [])
        .filter(function (q) { return !wantedCats.length || !q.category || wantedCats.indexOf(q.category) !== -1; })
        .map(function (q) { return { quote: q, cost: byUnit ? unitPrice(q, settings) : Quotes.landedCost(q, need, settings) }; });
      var valid = costs.filter(function (c) { return c.cost.ok; });
      valid.sort(function (x, y) { return x.cost.presentValue - y.cost.presentValue; });
      candidates.push({
        supplier: supplier,
        km: km,
        best: valid[0] || null,
        costIssues: costs.filter(function (c) { return !c.cost.ok; }).map(function (c) { return c.cost.warnings[0]; })
      });
    });

    var cheapest = null;
    candidates.forEach(function (c) {
      if (c.best && (cheapest === null || c.best.cost.presentValue < cheapest)) cheapest = c.best.cost.presentValue;
    });

    var ranked = candidates.map(function (c) {
      var s = c.supplier;
      var factors = {};
      var evidence = [];
      var warnings = [];

      // price
      if (c.best && byUnit) {
        factors.price = cheapest > 0 ? clamp01(cheapest / c.best.cost.presentValue) : 1;
        evidence.push({ code: 'unit_price', unitPrice: c.best.cost.unitPrice, unit: c.best.cost.unit, minOrder: c.best.cost.minOrder, paymentDays: c.best.quote.paymentDays || 0 });
        c.best.cost.warnings.forEach(function (w) { (w.code === 'fx_manual' ? evidence : warnings).push(w); });
      } else if (c.best) {
        factors.price = cheapest > 0 ? clamp01(cheapest / c.best.cost.presentValue) : 1;
        evidence.push({ code: 'price', total: c.best.cost.total, unitCost: c.best.cost.unitCost, currency: c.best.cost.currency, paymentDays: c.best.quote.paymentDays || 0 });
        c.best.cost.warnings.forEach(function (w) { (w.code === 'fx_manual' ? evidence : warnings).push(w); });
        if (need.budget && c.best.cost.total > need.budget) warnings.push({ code: 'over_budget', total: c.best.cost.total, budget: need.budget });
      } else {
        factors.price = NEUTRAL;
        warnings.push({ code: 'no_quote' });
        c.costIssues.forEach(function (w) { if (w) warnings.push(w); });
      }

      // rating
      var rating = Reviews.blendRating(s);
      factors.rating = clamp01((rating.value - 1) / 4);
      evidence.push({ code: 'rating', value: rating.value, basis: rating.basis, external: rating.externalCount, internal: rating.internalCount });

      // distance
      if (c.km === null) {
        factors.distance = NEUTRAL;
        warnings.push({ code: 'unknown_location' });
      } else {
        factors.distance = clamp01(1 - c.km / radius);
        evidence.push({ code: 'distance', km: round2(c.km) });
      }
      if (s.ships) {
        factors.distance = Math.max(factors.distance, SHIPS_FLOOR);
        evidence.push({ code: 'ships' });
      }

      // trust
      var trust = Trust.trustScore(s, referralIndex, byId);
      factors.trust = trust.value;
      evidence.push({ code: 'trust', level: trust.level, referrers: trust.referrals.count, mutual: trust.referrals.mutual });
      if (trust.level === 0) warnings.push({ code: 'unverified' });

      // speed
      var lead = c.best && c.best.quote.leadDays != null ? c.best.quote.leadDays : s.leadDays;
      if (lead == null) {
        factors.speed = NEUTRAL;
      } else if (need.neededInDays && lead > need.neededInDays) {
        factors.speed = 0;
        warnings.push({ code: 'too_slow', days: lead, needed: need.neededInDays });
      } else {
        factors.speed = clamp01(1 - lead / SPEED_HORIZON_DAYS);
        evidence.push({ code: 'speed', days: lead });
      }

      if (Schema.isOffline(s)) evidence.push({ code: 'offline' });
      if (s.consent === false) warnings.push({ code: 'no_consent' });

      var totalWeight = 0;
      var sum = 0;
      FACTORS.forEach(function (f) {
        var w = Math.max(0, Number(weights[f]) || 0);
        totalWeight += w;
        sum += w * factors[f];
      });
      var score = totalWeight ? Math.round((100 * sum) / totalWeight) : 0;

      Object.keys(factors).forEach(function (f) { factors[f] = round2(factors[f]); });
      return {
        supplier: s,
        score: score,
        factors: factors,
        km: c.km === null ? null : round2(c.km),
        bestQuote: c.best ? c.best.quote : null,
        cost: c.best ? c.best.cost : null,
        rating: rating,
        trust: trust,
        evidence: evidence,
        warnings: warnings
      };
    });

    ranked.sort(function (a, b) {
      return b.score - a.score || b.factors.trust - a.factors.trust || a.supplier.name.localeCompare(b.supplier.name);
    });
    ranked.forEach(function (r, i) { r.rank = i + 1; });
    return { ranked: ranked, excluded: excluded };
  }

  var api = { FACTORS: FACTORS, PRESETS: PRESETS, NEUTRAL: NEUTRAL, rankSuppliers: rankSuppliers };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutScore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
