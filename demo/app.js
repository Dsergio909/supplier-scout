/**
 * Supplier Scout — browser demo.
 *
 * Every decision (ranking, costs, capture parsing, duplicates, trust) comes
 * from src/core, the same code the CLI, the agent and the tests use. This
 * file only wires it to the page. All content is rendered with textContent.
 * The only network calls are the live OpenStreetMap search in live.js, and
 * the Content-Security-Policy allows no other host.
 */
(function () {
  'use strict';

  var C = window.ScoutCountries;
  var Cat = window.ScoutCategories;
  var Geo = window.ScoutGeo;
  var Q = window.ScoutQuotes;
  var Schema = window.ScoutSchema;
  var Dedupe = window.ScoutDedupe;
  var Score = window.ScoutScore;
  var Capture = window.ScoutCapture;
  var Csv = window.ScoutCsv;
  var M = window.ScoutMessages;
  var Out = window.ScoutOutreach;
  var Sample = window.ScoutSample;
  var Osm = window.ScoutOsm;
  var Live = window.ScoutLive;
  var Services = window.ScoutServices;
  var Text = window.ScoutText;

  var STORAGE = 'supplier-scout:v1:';
  var MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  var UNITS = ['unidad', 'kg', 'm', 'l', 'docena'];
  var SOURCE_COLORS = {
    web: 'var(--blue)', map: 'var(--green)', registry: 'var(--amber)', referral: 'var(--pink)',
    field: 'var(--violet)', import: 'var(--muted)', agent: 'var(--cyan)'
  };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var I18N = window.ScoutI18n;
  var TABS = ['search', 'quotes', 'offline', 'review', 'data'];
  var MAX_LISTED = 50;

  var state = null;
  var prefs = { lang: detectLanguage(), datasetId: 'bogota' };
  // Live search status. Live results are never saved: they are real data, shown fresh.
  var live = { busy: false, status: '', kind: '', country: null, lastSampleId: 'bogota' };

  /** The first browser language we speak (pt-BR -> pt), otherwise English. */
  function detectLanguage() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i]).toLowerCase().split('-')[0];
      if (I18N[base]) return base;
    }
    return 'en';
  }

  // ---------- helpers ----------

  function t(key) { return I18N[prefs.lang][key]; }
  function fmt(template, params) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dataset() { return Sample.DATASETS[prefs.datasetId]; }
  function country() { return dataset().country; }
  function money(amount, currency) { return C.formatMoney(amount, country(), currency); }
  function unitText(qty, unit) {
    var word = qty === 1 ? t('unitOne')[unit] : t('units')[unit];
    return qty + ' ' + (word || unit);
  }
  function catLabel(id) { var c = Cat.byId(id); return c ? c.label[prefs.lang] : id; }
  var byIdCache = { list: null, length: -1, map: null };

  function supplierById(id) {
    var list = state.db.suppliers;
    if (byIdCache.list !== list || byIdCache.length !== list.length) {
      byIdCache = { list: list, length: list.length, map: new Map(list.map(function (s) { return [s.id, s]; })) };
    }
    return byIdCache.map.get(id) || null;
  }

  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function pairKey(p) { return [p.a, p.b].sort().join('|'); }
  function explain(item) { return M.explain(item, prefs.lang, { country: country() }); }
  function option(value, label, selected) {
    var o = el('option', null, label);
    o.value = value;
    if (selected) o.selected = true;
    return o;
  }
  function fillSelect(select, options, selected) {
    clear(select);
    options.forEach(function (o) { select.appendChild(option(o.value, o.label, String(o.value) === String(selected))); });
  }
  function button(label, cls, onClick) {
    var b = el('button', cls || 'btn small', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function link(href, label) {
    var a = el('a', 'btn small', label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function copyText(text, trigger) {
    function done() {
      var original = trigger.textContent;
      trigger.textContent = t('copied');
      setTimeout(function () { trigger.textContent = original; }, 1400);
    }
    function selectForManualCopy() {
      var pre = trigger.closest('.panel, .outreach');
      var target = pre && pre.querySelector('pre');
      if (!target || !window.getSelection) return;
      var range = document.createRange();
      range.selectNodeContents(target);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    // No clipboard access (e.g. a page opened from a file): select the text so Ctrl+C works.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, selectForManualCopy);
    } else {
      selectForManualCopy();
    }
  }

  function download(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- state & storage ----------

  function readStorage(key) {
    try { return JSON.parse(window.localStorage.getItem(STORAGE + key) || 'null'); } catch (err) { return null; }
  }
  function writeStorage(key, value) {
    try { window.localStorage.setItem(STORAGE + key, JSON.stringify(value)); } catch (err) { /* private mode: fine */ }
  }
  function removeStorage(key) {
    try { window.localStorage.removeItem(STORAGE + key); } catch (err) { /* ignore */ }
  }

  function defaultNeed(ds) {
    var n = ds.needs[0];
    return {
      query: n.item || catLabel(n.category), presetId: n.id, category: n.category, item: n.item,
      quantity: n.quantity || 1, unit: n.unit, originId: n.originId, radiusKm: n.radiusKm, neededInDays: null, budget: null
    };
  }

  function freshState() {
    var ds = dataset();
    var clean = Schema.sanitizeDatabase(ds);
    var names = {};
    clean.suppliers.forEach(function (s) { names[s.id] = s.name; });
    var merged = Dedupe.autoMerge(clean);
    return {
      db: merged.db,
      autoMerged: merged.merged.map(function (p) {
        return { a: names[p.a], b: names[p.b], evidence: p.evidence };
      }),
      pending: Object.create(null),
      distinct: Object.create(null),
      need: defaultNeed(ds),
      preset: 'balanced',
      weights: Object.assign({}, Score.PRESETS.balanced),
      settings: { vat: Math.round(C.getProfile(ds.country).vatRate * 1000) / 10, monthlyRate: 1.5, fxUsd: ds.fx.USD },
      tab: 'search',
      capture: null,
      openRfq: null
    };
  }

  function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finiteOr(value, fallback) {
    var n = Number(value);
    return value !== null && value !== '' && isFinite(n) ? n : fallback;
  }

  /**
   * Browser storage is shared by every page on dsergio909.github.io and can be edited by
   * hand, so a saved state is treated like an import: every field is checked before use.
   */
  function loadState() {
    var saved = dataset().live ? null : readStorage('state:' + prefs.datasetId);
    var base = freshState();
    if (saved && saved.db) {
      base.db = Schema.sanitizeDatabase(saved.db);
      var ids = new Set(base.db.suppliers.map(function (s) { return s.id; }));
      Object.keys(plainObject(saved.pending)).forEach(function (id) {
        if (ids.has(id)) base.pending[id] = { reason: 'saved' };
      });
      Object.keys(plainObject(saved.distinct)).forEach(function (key) {
        if (/^[^|]{1,80}\|[^|]{1,80}$/.test(key)) base.distinct[key] = true;
      });
      var need = plainObject(saved.need);
      if (Cat.byId(need.category)) base.need.category = need.category;
      if (UNITS.indexOf(need.unit) !== -1) base.need.unit = need.unit;
      if (dataset().origins.some(function (o) { return o.id === need.originId; })) base.need.originId = need.originId;
      if (typeof need.item === 'string') base.need.item = need.item.slice(0, 120);
      if (typeof need.query === 'string') base.need.query = need.query.slice(0, 120);
      base.need.presetId = dataset().needs.some(function (n) { return n.id === need.presetId; }) ? need.presetId : '';
      base.need.quantity = Math.max(0.001, finiteOr(need.quantity, base.need.quantity));
      base.need.radiusKm = Math.min(25, Math.max(1, finiteOr(need.radiusKm, base.need.radiusKm)));
      if (Score.PRESETS[saved.preset]) base.preset = saved.preset;
      else if (saved.preset === null) base.preset = null;
      var weights = plainObject(saved.weights);
      Score.FACTORS.forEach(function (f) { base.weights[f] = Math.min(6, Math.max(0, finiteOr(weights[f], base.weights[f]))); });
      var settings = plainObject(saved.settings);
      ['vat', 'monthlyRate', 'fxUsd'].forEach(function (k) { base.settings[k] = Math.max(0, finiteOr(settings[k], base.settings[k])); });
      if (TABS.indexOf(saved.tab) !== -1) base.tab = saved.tab;
    }
    state = base;
  }

  function saveState() {
    writeStorage('prefs', prefs);
    if (dataset().live) return;
    writeStorage('state:' + prefs.datasetId, {
      db: state.db, pending: state.pending, distinct: state.distinct, need: state.need,
      preset: state.preset, weights: state.weights, settings: state.settings, tab: state.tab
    });
  }

  function settings() {
    return {
      country: country(),
      vatRate: (Number(state.settings.vat) || 0) / 100,
      monthlyRate: (Number(state.settings.monthlyRate) || 0) / 100,
      fx: { USD: Number(state.settings.fxUsd) || 0 }
    };
  }

  function origin() {
    var list = dataset().origins;
    for (var i = 0; i < list.length; i++) if (list[i].id === state.need.originId) return list[i];
    return list[0];
  }

  /** The order typed in the Quotes tab: only there do quantities matter. */
  function currentNeed() {
    return {
      category: state.need.category,
      item: state.need.item,
      quantity: Number(state.need.quantity) || 1,
      unit: state.need.unit,
      origin: origin(),
      radiusKm: Number(state.need.radiusKm) || 10,
      weights: state.weights
    };
  }

  var wantedCache = { text: null, value: null };
  /** What the buyer typed, read by ScoutServices (map tags, categories, words in names). */
  function wanted() {
    var text = state.need.query || '';
    if (wantedCache.text !== text) wantedCache = { text: text, value: Services.interpret(text) };
    return wantedCache.value;
  }

  /**
   * The Search tab ranks options without a quantity: amounts are negotiated
   * later. Live results already match the search; sample data is filtered by
   * what was typed (categories, or words in the name).
   */
  function searchNeed() {
    var need = { origin: origin(), radiusKm: Number(state.need.radiusKm) || 10, weights: state.weights, quantity: null };
    var w = wanted();
    if (!dataset().live && w.kind === 'category') need.categories = w.categories;
    return need;
  }

  /**
   * Sample data only: a specific trade ("aire acondicionado") or plain words are
   * matched against names and notes; a broad category is filtered by searchNeed.
   */
  function searchDb() {
    var w = wanted();
    if (dataset().live || w.kind === 'empty' || w.kind === 'category') return state.db;
    var stems = w.nameHint.split('|').map(function (x) { return Text.normalize(x); }).filter(function (x) { return x.length >= 3; });
    var suppliers = state.db.suppliers.filter(function (sup) {
      var hay = Text.normalize([sup.name, sup.notes].join(' '));
      return stems.some(function (st) { return hay.indexOf(st) !== -1; });
    });
    return { suppliers: suppliers, quotes: state.db.quotes, referrals: state.db.referrals };
  }

  // Finding duplicates compares every pair of suppliers, so it runs only when the list changes.
  var pairsCache = { suppliers: null, length: -1, pairs: [] };

  function reviewPairs() {
    var list = state.db.suppliers;
    if (pairsCache.suppliers !== list || pairsCache.length !== list.length) {
      pairsCache = { suppliers: list, length: list.length, pairs: Dedupe.findDuplicates(list) };
    }
    return pairsCache.pairs.filter(function (p) { return !state.distinct[pairKey(p)]; });
  }

  function prunePending() {
    Object.keys(state.pending).forEach(function (id) { if (!supplierById(id)) delete state.pending[id]; });
  }

  // ---------- static texts ----------

  function applyI18n() {
    document.documentElement.lang = prefs.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var value = t(node.getAttribute('data-i18n'));
      if (typeof value === 'string') node.textContent = value;
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === prefs.lang));
    });
    fillSelect($('dataset'), Object.keys(Sample.DATASETS).map(function (id) {
      return { value: id, label: Sample.DATASETS[id].label[prefs.lang] };
    }), prefs.datasetId);
    $('langGroup').setAttribute('aria-label', t('language'));
    $('howLink').href = 'https://github.com/Dsergio909/supplier-scout/blob/main/docs/' +
      (prefs.lang === 'es' ? 'como-funciona.md' : 'how-it-works.md');
    var profile = C.getProfile(country());
    var params = {
      procurement: profile.procurement.join(', ') || '—',
      registry: profile.businessRegistry.join(', ') || '—',
      city: profile.sampleCity,
      clusters: dataset().clusters || '—'
    };
    var ways = clear($('ways'));
    t('ways').forEach(function (w) {
      var li = el('li');
      li.appendChild(el('strong', null, w[0]));
      li.appendChild(document.createTextNode(' ' + fmt(w[1], params)));
      ways.appendChild(li);
    });
    renderCountryInfo(profile);
  }

  /** Where formal suppliers show up in this country, even without a website. */
  function renderCountryInfo(profile) {
    $('countryTitle').textContent = fmt(t('countryTitle'), { country: profile.name[prefs.lang] });
    var rows = [
      [t('countryTax'), profile.vatName + ' ' + (profile.vatRate ? M.formatPercent(profile.vatRate, prefs.lang) : '(' + t('countryTaxVaries') + ')') + ' · ' + profile.currency],
      [t('countryTaxId'), profile.taxIdName + ' (' + (profile.taxIdCheck === 'checksum' ? t('countryCheck') : t('countryFormat')) + ')'],
      [t('countryProcurement'), profile.procurement.join(' · ') || '—'],
      [t('countryRegistry'), profile.businessRegistry.join(' · ') || '—'],
      [t('countryDataLaw'), profile.dataLaw || t('countryNoLaw')]
    ];
    var dl = clear($('countryInfo'));
    rows.forEach(function (r) {
      dl.appendChild(el('dt', null, r[0]));
      dl.appendChild(el('dd', null, r[1]));
    });
  }

  function renderConsentLabel() {
    var profile = C.getProfile($('captureCountry').value || country());
    var law = profile.dataLaw ? fmt(t('consentLaw'), { country: profile.name[prefs.lang], law: profile.dataLaw }) : t('consentNoLaw');
    $('consentText').textContent = t('consent') + ' (' + law + ')';
  }

  // ---------- KPIs & tabs ----------

  function renderKpis() {
    var s = state.db.suppliers;
    var offline = s.filter(Schema.isOffline).length;
    var toReview = Object.keys(state.pending).length + reviewPairs().length;
    var items = [
      [t('kpiTotal'), s.length, 'var(--blue)'],
      [t('kpiOffline'), offline, 'var(--pink)'],
      [t('kpiReferrals'), state.db.referrals.length, 'var(--green)'],
      [t('kpiReview'), toReview, 'var(--amber)']
    ];
    var box = clear($('kpis'));
    items.forEach(function (k) {
      var d = el('div', 'kpi');
      d.style.setProperty('--c', k[2]);
      d.appendChild(el('span', 'l', k[0]));
      d.appendChild(el('span', 'n', String(k[1])));
      box.appendChild(d);
    });
    $('reviewBadge').textContent = toReview ? String(toReview) : '';
  }

  function renderTabs() {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      var active = b.getAttribute('data-tab') === state.tab;
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
      $('panel-' + b.getAttribute('data-tab')).hidden = !active;
    });
  }

  // ---------- 1 · search ----------

  function renderNeedForm() {
    var ds = dataset();
    var n = state.need;
    var cats = Cat.CATEGORIES.map(function (c) { return { value: c.id, label: c.label[prefs.lang] }; });
    fillSelect($('category'), cats, n.category);
    fillSelect($('referralCategory'), cats, $('referralCategory').value || n.category);
    var units = UNITS.map(function (u) { return { value: u, label: t('units')[u] }; });
    fillSelect($('unit'), units, n.unit);
    fillSelect($('qUnit'), units, n.unit);
    fillSelect($('origin'), ds.origins.map(function (o) { return { value: o.id, label: o.label }; }), n.originId);
    $('originField').hidden = ds.origins.length < 2;
    $('item').value = n.item || '';
    $('quantity').value = n.quantity;
    $('radius').value = n.radiusKm;
    $('radiusOut').textContent = n.radiusKm + ' km';

    var presets = clear($('presets'));
    Object.keys(Score.PRESETS).forEach(function (id) {
      var b = button(t('preset')[id], '', function () {
        state.preset = id;
        state.weights = Object.assign({}, Score.PRESETS[id]);
        render();
      });
      b.setAttribute('aria-pressed', String(state.preset === id));
      presets.appendChild(b);
    });
    var sliders = clear($('weightSliders'));
    Score.FACTORS.forEach(function (f) {
      var label = el('label');
      label.appendChild(el('span', null, t('factor')[f]));
      var input = el('input');
      input.type = 'range'; input.min = '0'; input.max = '6'; input.step = '1';
      input.value = state.weights[f];
      input.setAttribute('aria-label', t('factor')[f]);
      var out = el('strong', null, String(state.weights[f]));
      input.addEventListener('input', function () {
        state.weights[f] = Number(input.value);
        state.preset = null;
        out.textContent = input.value;
        renderResults();
        saveState();
      });
      label.appendChild(input);
      label.appendChild(out);
      sliders.appendChild(label);
    });
  }

  function renderRadar(result) {
    var box = clear($('radar'));
    var o = origin();
    var radius = Number(state.need.radiusKm) || 10;
    var size = 320;
    var c = size / 2;
    var R = 140;
    var scale = R / radius;
    var desc = svg('desc', { id: 'radarDesc' });
    desc.textContent = fmt(t('radarDesc'), { o: o.label });
    box.appendChild(desc);
    [1, 2, 3].forEach(function (i) {
      box.appendChild(svg('circle', { cx: c, cy: c, r: (R * i) / 3, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1 }));
    });
    box.appendChild(svg('line', { x1: c, y1: c - R - 8, x2: c, y2: c + R + 8, stroke: 'var(--line)', 'stroke-width': 1 }));
    box.appendChild(svg('line', { x1: c - R - 8, y1: c, x2: c + R + 8, y2: c, stroke: 'var(--line)', 'stroke-width': 1 }));
    var sweep = svg('g', { class: 'sweep' });
    sweep.appendChild(svg('line', { x1: c, y1: c, x2: c, y2: c - R, stroke: 'var(--brand)', 'stroke-width': 1.5, opacity: 0.35 }));
    box.appendChild(sweep);

    var noCoords = 0;
    var points = result.ranked.map(function (r) { return { r: r, excluded: false }; })
      .concat(result.excluded.map(function (x) { return { r: { supplier: x.supplier }, excluded: true }; }));
    points.forEach(function (p) {
      var s = p.r.supplier;
      var off = Geo.offsetKm(o, s);
      if (!off) { noCoords++; return; }
      var dx = off.x * scale;
      var dy = -off.y * scale;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > R + 6) { dx = (dx / len) * (R + 6); dy = (dy / len) * (R + 6); }
      var x = Math.round(c + dx - 4);
      var y = Math.round(c + dy - 4);
      var color = SOURCE_COLORS[(s.sources[0] || {}).type] || 'var(--muted)';
      var g = svg('g', {});
      var title = svg('title', {});
      var km = Geo.distanceKm(o, s);
      title.textContent = s.name + ' · ' + M.formatKm(km, prefs.lang) + (p.r.rank ? ' · #' + p.r.rank : '');
      g.appendChild(title);
      g.appendChild(svg('circle', p.excluded
        ? { cx: x + 4, cy: y + 4, r: 4, fill: 'none', stroke: color, 'stroke-width': 1.5, opacity: 0.6 }
        : { cx: x + 4, cy: y + 4, r: 4.5, fill: color }));
      if (p.r.rank && p.r.rank <= 3) {
        var label = svg('text', { x: x + 11, y: y + 8, fill: 'var(--text)', 'font-family': 'Plex Sans, sans-serif', 'font-size': 11, 'font-weight': 600 });
        label.textContent = String(p.r.rank);
        g.appendChild(label);
      }
      box.appendChild(g);
    });
    box.appendChild(svg('circle', { cx: c, cy: c, r: 6, fill: 'var(--surface)', stroke: 'var(--text)', 'stroke-width': 2 }));
    box.appendChild(svg('circle', { cx: c, cy: c, r: 2, fill: 'var(--text)' }));
    var hint = fmt(t('radarHint'), { n: Math.round((radius / 3) * 10) / 10 });
    $('radarHint').textContent = noCoords ? hint + ' · ' + fmt(t('radarNoCoords'), { n: noCoords }) : hint;

    var legend = clear($('sourceLegend'));
    Object.keys(SOURCE_COLORS).forEach(function (type) {
      var li = el('li');
      var dot = el('i', 'dot');
      dot.style.setProperty('--c', SOURCE_COLORS[type]);
      li.appendChild(dot);
      li.appendChild(document.createTextNode(M.SOURCES[prefs.lang][type]));
      legend.appendChild(li);
    });
  }

  function sourceChips(s) {
    var wrap = el('div', 'chips');
    var seen = {};
    (s.sources || []).forEach(function (src) {
      if (seen[src.type]) return;
      seen[src.type] = true;
      var chip = el('span', 'chip src', M.SOURCES[prefs.lang][src.type]);
      chip.style.setProperty('--c', SOURCE_COLORS[src.type]);
      chip.title = src.ref || '';
      wrap.appendChild(chip);
    });
    if (Schema.isOffline(s)) wrap.appendChild(el('span', 'chip offline', t('noWeb')));
    wrap.appendChild(el('span', 'chip level', M.LEVELS[prefs.lang][s.verification || 0]));
    return wrap;
  }

  // Trades and services (not goods): the quote request asks for the price of the job.
  var GOODS_SERVICES = ['upholstery', 'signs', 'appliances', 'fireSafety'];
  function isService(id) { return GOODS_SERVICES.indexOf(id) === -1; }

  function outreachBlock(s) {
    var w = wanted();
    var what = w.kind === 'empty' ? state.need.item : state.need.query;
    var category = w.categories[0] || state.need.category;
    // Asking for a quote never needs a quantity: it is negotiated afterwards.
    var text = Out.rfqMessage({ category: category, item: what, deliveryZone: origin().label, service: w.kind === 'service' && w.services.some(isService) }, s.name, prefs.lang, country());
    var box = el('div', 'outreach');
    box.appendChild(el('p', 'hint', t('rfqHint')));
    var pre = el('pre', 'message', text);
    box.appendChild(pre);
    var actions = el('div', 'actions');
    var copyBtn = button(t('copy'), 'btn small', function () { copyText(text, copyBtn); });
    actions.appendChild(copyBtn);
    var wa = s.phones && s.phones[0] ? Out.whatsappLink(s.phones[0], text) : null;
    if (wa) actions.appendChild(link(wa, t('whatsapp')));
    if (s.emails && s.emails[0]) {
      actions.appendChild(link('mailto:' + encodeURIComponent(s.emails[0]).replace('%40', '@') + '?subject=' + encodeURIComponent(t('rfq')) + '&body=' + encodeURIComponent(text), t('email')));
    }
    if (s.websites && s.websites[0]) {
      var url = Schema.cleanUrl(s.websites[0]);
      if (url) actions.appendChild(link(url, t('website')));
    }
    box.appendChild(actions);
    return box;
  }

  function resultCard(r) {
    var s = r.supplier;
    var li = el('li', 'card' + (r.rank <= 3 ? ' podium' : ''));
    var head = el('div', 'card-head');
    var title = el('div', 'card-title');
    title.appendChild(el('span', 'rank', '#' + r.rank));
    var nameBox = el('div');
    nameBox.appendChild(el('div', 'name', s.name));
    nameBox.appendChild(sourceChips(s));
    title.appendChild(nameBox);
    head.appendChild(title);
    var score = el('div', 'score');
    score.appendChild(el('span', 'n', String(r.score)));
    var meter = el('div', 'meter');
    meter.setAttribute('aria-hidden', 'true');
    for (var i = 1; i <= 10; i++) meter.appendChild(el('i', i * 10 <= r.score + 5 ? 'on' : ''));
    score.appendChild(meter);
    head.appendChild(score);
    li.appendChild(head);

    var facts = el('div', 'facts');
    function fact(label, value) {
      var d = el('div');
      d.appendChild(el('span', null, label));
      d.appendChild(el('strong', null, value));
      facts.appendChild(d);
    }
    fact(t('quotedPrice'), r.cost ? fmt(t('perUnitOf'), { price: money(r.cost.unitPrice), unit: t('unitOne')[r.cost.unit === 'unit' ? 'unidad' : r.cost.unit] || r.cost.unit }) : t('noQuote'));
    fact(t('phone'), s.phones && s.phones[0] ? s.phones[0] : t('none'));
    fact(t('distance'), r.km === null ? t('none') : M.formatKm(r.km, prefs.lang));
    // A neutral prior is not a review: say so instead of showing a made-up average.
    var reviewed = r.rating.externalCount || r.rating.internalCount;
    fact(t('rating'), reviewed ? M.formatDecimal(r.rating.value.toFixed(1), prefs.lang) + ' / 5' : t('ratingNone'));
    li.appendChild(facts);

    var bars = el('div', 'factor-bars');
    Score.FACTORS.forEach(function (f) {
      var d = el('div');
      d.appendChild(el('span', null, t('factor')[f]));
      var b = el('b');
      var fill = el('i');
      fill.style.width = Math.round(r.factors[f] * 100) + '%';
      b.appendChild(fill);
      d.appendChild(b);
      bars.appendChild(d);
    });
    li.appendChild(bars);

    var why = el('details', 'why');
    why.appendChild(el('summary', null, t('why') + (r.warnings.length ? ' (' + r.warnings.length + ' ⚠)' : '')));
    var ul = el('ul');
    r.evidence.forEach(function (e) { ul.appendChild(el('li', null, explain(e))); });
    r.warnings.forEach(function (w) { ul.appendChild(el('li', 'warn', '⚠ ' + explain(w))); });
    why.appendChild(ul);
    li.appendChild(why);

    var actions = el('div', 'actions');
    actions.appendChild(button(t('rfq'), 'btn small', function () {
      state.openRfq = state.openRfq === s.id ? null : s.id;
      renderResults();
    }));
    var osmRef = (s.sources || []).map(function (src) { return /^osm:(node|way|relation)\/(\d+)$/.exec(src && src.ref || ''); }).filter(Boolean)[0];
    if (osmRef) {
      actions.appendChild(link('https://www.openstreetmap.org/' + osmRef[1] + '/' + osmRef[2], t('mapEntry')));
      actions.appendChild(link(Osm.mapsSearchUrl(s.name, [s.address, s.city || origin().label].filter(Boolean).join(', ')), t('mapsEntry')));
    }
    li.appendChild(actions);
    if (state.openRfq === s.id) li.appendChild(outreachBlock(s));
    return li;
  }

  function renderResults() {
    var result = Score.rankSuppliers(searchDb(), searchNeed(), settings());
    var list = clear($('results'));
    $('resultCount').textContent = result.ranked.length ? '(' + result.ranked.length + ')' : '';
    if (!result.ranked.length) {
      var w = wanted();
      list.appendChild(el('li', 'empty', !dataset().live && w.kind !== 'empty' ? fmt(t('noMatchSample'), { q: state.need.query }) : t('noResults')));
    }
    result.ranked.slice(0, MAX_LISTED).forEach(function (r) { list.appendChild(resultCard(r)); });
    if (result.ranked.length > MAX_LISTED) list.appendChild(el('li', 'hint', fmt(t('showingFirst'), { n: MAX_LISTED, total: result.ranked.length })));
    var ex = clear($('excluded'));
    if (result.excluded.length) {
      var box = el('div', 'excluded');
      box.appendChild(el('span', null, t('excludedTitle')));
      var ul = el('ul');
      result.excluded.forEach(function (x) { ul.appendChild(el('li', null, x.supplier.name + ' — ' + explain(x.reason))); });
      box.appendChild(ul);
      ex.appendChild(box);
    }
    renderRadar(result);
    return result;
  }

  // ---------- 2 · quotes ----------

  function renderQuotes() {
    $('vat').value = state.settings.vat;
    $('monthlyRate').value = state.settings.monthlyRate;
    $('fxUsd').value = state.settings.fxUsd;
    var need = currentNeed();
    var quotes = state.db.quotes.filter(function (q) { return q.category === need.category && supplierById(q.supplierId); });
    var cmp = Q.compareQuotes(quotes, need, settings());
    var table = clear($('quoteTable'));
    var cols = ['colSupplier', 'colItem', 'colListPrice', 'colPack', 'colTax', 'colShipping', 'colMoq', 'colBuy', 'colTotal', 'colUnit', 'colTerms', 'colPv', 'colLead'];
    var thead = el('thead');
    var hr = el('tr');
    cols.forEach(function (k) { hr.appendChild(el('th', null, t(k))); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    function row(entry, cls) {
      var q = entry.quote;
      var c = entry.cost;
      var tr = el('tr', cls);
      var cells = [
        (supplierById(q.supplierId) || {}).name, q.item || t('none'),
        money(q.price, q.currency), unitText(q.per.qty, q.per.unit), q.taxIncluded ? t('taxIncl') : t('taxExcl'),
        money(q.shipping || 0, q.currency), q.minOrder ? unitText(q.minOrder.qty, q.minOrder.unit) : t('none'),
        c.ok ? c.packs + ' × ' + q.per.qty + ' = ' + c.purchased : t('none'), c.ok ? money(c.total) : explain(c.warnings[0]),
        c.ok ? money(c.unitCost) : t('none'), String(q.paymentDays || 0), c.ok ? money(c.presentValue) : t('none'),
        q.leadDays == null ? t('none') : String(q.leadDays)
      ];
      cells.forEach(function (v, i) { tr.appendChild(el('td', i >= 2 && i !== 3 && i !== 4 ? 'num' : null, v)); });
      tbody.appendChild(tr);
    }
    cmp.ranked.forEach(function (entry) {
      row(entry, (entry.cheapestTotal ? 'best' : '') + (entry.cheapestListPrice && !entry.cheapestTotal ? ' list-cheapest' : ''));
    });
    cmp.invalid.forEach(function (entry) { row(entry, 'invalid'); });
    if (!quotes.length) {
      var tr = el('tr');
      var td = el('td', 'empty', t('noQuotes'));
      td.colSpan = cols.length;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    var callout = $('quoteCallout');
    callout.hidden = !cmp.listPriceMisleads;
    if (cmp.listPriceMisleads) {
      var listRow = cmp.ranked.filter(function (r) { return r.cheapestListPrice; })[0];
      callout.textContent = fmt(t('callout'), {
        list: supplierById(listRow.quote.supplierId).name,
        best: supplierById(cmp.ranked[0].quote.supplierId).name
      });
    }

    var inCategory = state.db.suppliers.filter(function (s) { return s.categories.indexOf(need.category) !== -1; });
    fillSelect($('qSupplier'), (inCategory.length ? inCategory : state.db.suppliers).map(function (s) {
      return { value: s.id, label: s.name };
    }), $('qSupplier').value);
  }

  // ---------- 3 · offline ----------

  function renderCapturePreview() {
    var box = clear($('capturePreview'));
    var cap = state.capture;
    if (!cap) { box.appendChild(el('p', 'empty', t('previewEmpty'))); return; }
    var d = cap.draft;
    var labels = t('fieldLabels');
    var fields = el('div', 'fields');
    function field(key, value, conf) {
      var row = el('div', 'field');
      row.appendChild(el('span', null, labels[key]));
      row.appendChild(el('span', null, value || t('none')));
      if (conf && value) row.appendChild(el('span', 'chip ' + (conf === 'high' ? 'exact' : conf), t('conf')[conf]));
      else row.appendChild(el('span'));
      fields.appendChild(row);
    }
    field('name', d.name, cap.confidence.name);
    field('taxId', d.taxId ? d.taxId.label + ' ' + d.taxId.value + (d.taxId.valid === true ? ' ✓' : d.taxId.valid === false ? ' ✗' : '') : null, cap.confidence.taxId);
    field('phones', d.phones.join(', '), cap.confidence.phones);
    field('emails', d.emails.join(', '), cap.confidence.emails);
    field('websites', d.websites.join(', '));
    field('socials', d.socials.join(', '));
    field('address', d.address, cap.confidence.address);
    field('city', d.city);
    field('categories', d.categories.map(catLabel).join(', '), cap.confidence.categories);
    field('prices', d.prices.map(function (p) {
      return (p.item ? p.item + ': ' : '') + C.formatMoney(p.price, d.country, p.currency) + ' / ' + unitText(p.per.qty, p.per.unit) +
        (p.taxIncluded === true ? ' (' + t('taxIncl') + ')' : p.taxIncluded === false ? ' (' + t('taxExcl') + ')' : '');
    }).join(' · '));
    var terms = t('terms');
    field('terms', [
      d.leadDays != null ? fmt(terms.leadDays, { n: d.leadDays }) : null,
      d.paymentDays != null ? fmt(terms.paymentDays, { n: d.paymentDays }) : null,
      d.minOrder ? fmt(terms.minOrder, { n: d.minOrder.qty + ' ' + d.minOrder.unit }) : null,
      d.ships ? terms.ships : null,
      d.shipping != null ? fmt(terms.shipping, { n: C.formatMoney(d.shipping, d.country) }) : null
    ].filter(Boolean).join(' · '));
    box.appendChild(fields);
    box.appendChild(el('p', 'hint', fmt(t('completeness'), { n: Math.round(cap.completeness * 100) })));
    if (cap.warnings.length) {
      var ul = el('ul', 'warnings');
      cap.warnings.forEach(function (w) { ul.appendChild(el('li', null, explain(w))); });
      box.appendChild(ul);
    }
    var add = button(t('addToReview'), 'btn primary', addCapture);
    box.appendChild(add);
    box.appendChild(el('p', 'status-line', state.captureStatus || ''));
  }

  function addCapture() {
    var cap = state.capture;
    var d = cap.draft;
    if (!d.name) { state.captureStatus = t('captureNeedsName'); renderCapturePreview(); return; }
    var id = uid('cap');
    var source = $('captureSource').value === 'referral' ? 'referral' : 'field';
    var referrer = $('captureReferrer').value.trim().slice(0, 80);
    var categories = d.categories.length ? d.categories : [state.need.category];
    var supplier = Schema.sanitizeSupplier({
      id: id, name: d.name, categories: categories, taxId: d.taxId, phones: d.phones, emails: d.emails,
      websites: d.websites, socials: d.socials, address: d.address, city: d.city, country: d.country,
      ships: d.ships, leadDays: d.leadDays,
      sources: [{ type: source, ref: source === 'referral' ? (referrer || 'referido') : 'captura de campo', at: today() }],
      verification: 0, consent: $('captureConsent').checked ? true : null
    }, 0);
    state.db.suppliers.push(supplier);
    d.prices.forEach(function (p, i) {
      var quote = Schema.sanitizeQuote({
        id: id + '-q' + i, supplierId: id, category: categories[0], item: p.item, price: p.price, currency: p.currency,
        per: p.per, taxIncluded: p.taxIncluded === true, shipping: d.shipping || 0,
        minOrder: d.minOrder && d.minOrder.resolved ? { qty: d.minOrder.qty, unit: d.minOrder.unit } : null,
        leadDays: d.leadDays, paymentDays: d.paymentDays || 0, at: today()
      }, i);
      if (quote) state.db.quotes.push(quote);
    });
    if (referrer) {
      state.db.referrals.push(Schema.sanitizeReferral({
        id: uid('ref'), from: 'person:' + referrer.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), fromLabel: referrer,
        to: id, relation: 'colleague', at: today()
      }, 0));
    }
    state.pending[id] = { reason: 'capture', at: today() };
    state.captureStatus = t('captureAdded');
    render();
  }

  function renderOffline() {
    var profiles = Object.keys(C.PROFILES).map(function (code) { return { value: code, label: C.PROFILES[code].name[prefs.lang] }; });
    fillSelect($('captureCountry'), profiles, $('captureCountry').value || country());
    fillSelect($('captureSource'), [{ value: 'field', label: t('srcField') }, { value: 'referral', label: t('srcReferral') }], $('captureSource').value || 'field');
    renderConsentLabel();
    renderCapturePreview();
    $('referralMessage').textContent = Out.referralRequest($('referralCategory').value || state.need.category, prefs.lang);

    var net = clear($('network'));
    if (!state.db.referrals.length) net.appendChild(el('li', 'empty', t('noReferrals')));
    state.db.referrals.forEach(function (r) {
      var from = supplierById(r.from);
      var to = supplierById(r.to);
      if (!to) return;
      var mutual = state.db.referrals.some(function (b) { return b.from === r.to && b.to === r.from; });
      var li = el('li', 'row');
      var left = el('span');
      left.appendChild(document.createTextNode((from ? from.name : r.fromLabel || r.from) + ' '));
      left.appendChild(el('span', 'arrow', '→'));
      left.appendChild(document.createTextNode(' ' + to.name));
      li.appendChild(left);
      var chips = el('span', 'chips');
      chips.appendChild(el('span', 'chip level', t('relation')[r.relation] || r.relation));
      if (mutual) chips.appendChild(el('span', 'chip warn', t('mutual')));
      li.appendChild(chips);
      net.appendChild(li);
    });
  }

  // ---------- 4 · review ----------

  function supplierSide(s) {
    var side = el('div', 'side');
    side.appendChild(el('strong', null, s.name));
    side.appendChild(sourceChips(s));
    if (s.taxId) side.appendChild(el('span', null, s.taxId.label + ' ' + s.taxId.value));
    if (s.phones.length) side.appendChild(el('span', null, s.phones.join(', ')));
    if (s.address || s.city) side.appendChild(el('span', null, [s.address, s.city].filter(Boolean).join(', ')));
    return side;
  }

  function renderReview() {
    prunePending();
    var list = clear($('pending'));
    var ids = Object.keys(state.pending);
    if (!ids.length) list.appendChild(el('li', 'empty', t('pendingEmpty')));
    if (ids.length > MAX_LISTED) list.appendChild(el('li', 'hint', fmt(t('showingFirst'), { n: MAX_LISTED, total: ids.length })));
    ids.slice(0, MAX_LISTED).forEach(function (id) {
      var s = supplierById(id);
      var li = el('li', 'card');
      li.appendChild(supplierSide(s));
      var actions = el('div', 'actions');
      actions.appendChild(el('span', 'hint', t('markLevel')));
      [1, 2, 3].forEach(function (level) {
        var b = button(M.LEVELS[prefs.lang][level], 'btn small', function () { s.verification = level; render(); });
        b.setAttribute('aria-pressed', String(s.verification === level));
        actions.appendChild(b);
      });
      actions.appendChild(button(t('approve'), 'btn small primary', function () { delete state.pending[id]; render(); }));
      actions.appendChild(button(t('discard'), 'btn small danger', function () {
        state.db.suppliers = state.db.suppliers.filter(function (x) { return x.id !== id; });
        state.db.quotes = state.db.quotes.filter(function (q) { return q.supplierId !== id; });
        state.db.referrals = state.db.referrals.filter(function (r) { return r.to !== id && r.from !== id; });
        delete state.pending[id];
        render();
      }));
      li.appendChild(actions);
      list.appendChild(li);
    });

    var dupes = clear($('dupes'));
    var pairs = reviewPairs();
    if (!pairs.length) dupes.appendChild(el('li', 'empty', t('dupesEmpty')));
    if (pairs.length > MAX_LISTED) dupes.appendChild(el('li', 'hint', fmt(t('showingFirst'), { n: MAX_LISTED, total: pairs.length })));
    pairs.slice(0, MAX_LISTED).forEach(function (p) {
      var a = supplierById(p.a);
      var b = supplierById(p.b);
      var li = el('li', 'card');
      var head = el('div', 'chips');
      head.appendChild(el('span', 'chip ' + p.tier, p.tier.toUpperCase()));
      head.appendChild(el('span', 'hint', t('suggestion')[p.decision]));
      li.appendChild(head);
      var pair = el('div', 'pair');
      pair.appendChild(supplierSide(a));
      pair.appendChild(supplierSide(b));
      li.appendChild(pair);
      var ul = el('ul', 'warnings');
      p.evidence.forEach(function (e) { ul.appendChild(el('li', null, explain(e))); });
      li.appendChild(ul);
      var actions = el('div', 'actions');
      actions.appendChild(button(t('merge'), 'btn small primary', function () {
        state.db = Dedupe.applyMerge(state.db, p.a, p.b);
        if (state.pending[p.b]) { state.pending[p.a] = state.pending[p.b]; delete state.pending[p.b]; }
        render();
      }));
      actions.appendChild(button(t('distinct'), 'btn small', function () { state.distinct[pairKey(p)] = true; render(); }));
      li.appendChild(actions);
      dupes.appendChild(li);
    });

    var log = clear($('mergeLog'));
    state.autoMerged.forEach(function (m) {
      log.appendChild(el('li', null, fmt(t('autoMerged'), { a: m.a, b: m.b, why: m.evidence.map(explain).join(' ') })));
    });
  }

  // ---------- 5 · data ----------

  function renderData() {
    var s = state.db.suppliers;
    var counts = {};
    s.forEach(function (x) {
      var seen = {};
      x.sources.forEach(function (src) {
        if (seen[src.type]) return;
        seen[src.type] = true;
        counts[src.type] = (counts[src.type] || 0) + 1;
      });
    });
    var ul = clear($('sourceStats'));
    Object.keys(SOURCE_COLORS).forEach(function (type) {
      var li = el('li');
      li.appendChild(el('span', null, M.SOURCES[prefs.lang][type]));
      var b = el('b');
      var fill = el('i');
      fill.style.setProperty('--c', SOURCE_COLORS[type]);
      fill.style.width = s.length ? Math.round(((counts[type] || 0) / s.length) * 100) + '%' : '0';
      b.appendChild(fill);
      li.appendChild(b);
      li.appendChild(el('strong', null, String(counts[type] || 0)));
      ul.appendChild(li);
    });
    var offline = s.filter(Schema.isOffline).length;
    ul.appendChild(el('li', 'hint', fmt(t('offlineShare'), { p: s.length ? Math.round((offline / s.length) * 100) : 0 })));
  }

  function prefixIds(db, prefix) {
    function re(id) { return id && id.indexOf('person:') !== 0 ? prefix + id : id; }
    return {
      suppliers: db.suppliers.map(function (s) { return Object.assign({}, s, { id: re(s.id) }); }),
      quotes: db.quotes.map(function (q) { return Object.assign({}, q, { id: re(q.id), supplierId: re(q.supplierId) }); }),
      referrals: db.referrals.map(function (r) { return Object.assign({}, r, { id: re(r.id), from: re(r.from), to: re(r.to) }); })
    };
  }

  function importDb(incoming) {
    var fresh = prefixIds(Schema.sanitizeDatabase(incoming), uid('imp') + '-');
    var combined = Schema.sanitizeDatabase({
      country: state.db.country,
      suppliers: state.db.suppliers.concat(fresh.suppliers),
      quotes: state.db.quotes.concat(fresh.quotes),
      referrals: state.db.referrals.concat(fresh.referrals)
    });
    var before = combined.suppliers.length;
    var result = Dedupe.autoMerge(combined);
    state.db = result.db;
    fresh.suppliers.forEach(function (s) { state.pending[s.id] = { reason: 'import', at: today() }; });
    prunePending();
    return { added: fresh.suppliers.length, merged: before - result.db.suppliers.length };
  }

  function readFile(input, onText) {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { $('ioStatus').textContent = t('tooBig'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try { onText(String(reader.result), file.name); } catch (err) { $('ioStatus').textContent = fmt(t('importError'), { e: err.message }); }
    };
    reader.readAsText(file);
  }

  // ---------- render & events ----------

  // ---------- live search & theme ----------

  function storedTheme() {
    try { return window.localStorage.getItem(STORAGE + 'theme'); } catch (err) { return null; }
  }
  function isDark() {
    var forced = document.documentElement.getAttribute('data-theme');
    if (forced) return forced === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function countryName(code) {
    var profile = C.getProfile(code);
    return profile.name[prefs.lang] || profile.name.en || code;
  }

  function defaultPlace() {
    var o = origin();
    var city = C.getProfile(country()).sampleCity;
    return dataset().live || !city || o.label === city ? o.label : o.label + ', ' + city;
  }

  function updateMapsLink() {
    var place = $('livePlace').value.trim() || defaultPlace();
    var where = place + ', ' + countryName($('liveCountry').value || country());
    var what = (state.need.query || '').trim() || catLabel(state.need.category);
    try { $('mapsLink').href = Osm.mapsSearchUrl(what, where); } catch (err) { /* keep the previous link */ }
  }

  function renderUnderstood() {
    var box = clear($('understood'));
    var w = wanted();
    if (!(state.need.query || '').trim()) return;
    if (w.kind === 'service' || w.kind === 'category') {
      box.appendChild(el('span', null, t('understood')));
      Services.describe(w, prefs.lang).forEach(function (label) { box.appendChild(el('span', 'tag-ok', label)); });
    } else if (w.kind === 'name') {
      box.appendChild(el('span', null, fmt(t('understoodName'), { terms: w.terms.slice(0, 6).join(', ') })));
    } else {
      box.appendChild(el('span', null, t('understoodEmpty')));
    }
  }

  function renderTryChips() {
    var box = clear($('tryChips'));
    t('tryExamples').forEach(function (text) {
      box.appendChild(button(text, '', function () {
        $('liveWhat').value = text;
        onQueryChange(text);
      }));
    });
  }

  function renderLive() {
    var what = $('liveWhat');
    what.placeholder = t('whatPh');
    if (document.activeElement !== what) what.value = state.need.query || '';
    renderUnderstood();
    renderTryChips();
    var codes = Object.keys(C.PROFILES).filter(function (code) { return code !== 'XX'; })
      .sort(function (a, b) { return countryName(a).localeCompare(countryName(b), prefs.lang); });
    fillSelect($('liveCountry'), codes.map(function (code) { return { value: code, label: countryName(code) }; }), live.country || country());
    var input = $('livePlace');
    input.placeholder = t('livePlacePh');
    if (!input.value) input.value = defaultPlace();
    $('liveSearch').disabled = live.busy;
    $('liveSearch').setAttribute('aria-busy', String(live.busy));
    var status = $('liveStatus');
    status.textContent = live.status;
    status.className = 'status-line' + (live.kind ? ' ' + live.kind : '');
    $('liveBackWrap').hidden = !dataset().live;
    var fine = document.querySelector('[data-i18n="fictional"]');
    if (fine && dataset().live) fine.textContent = t('liveNote');
    var badge = $('envBadge');
    badge.textContent = dataset().live ? t('liveBadge') : t('sampleBadge');
    badge.className = 'env' + (dataset().live ? ' real' : '');
    $('theme').setAttribute('aria-label', isDark() ? t('themeLight') : t('themeDark'));
    $('theme').title = $('theme').getAttribute('aria-label');
    updateMapsLink();
  }

  function fxFor(code) {
    var keys = Object.keys(Sample.DATASETS);
    for (var i = 0; i < keys.length; i++) {
      var ds = Sample.DATASETS[keys[i]];
      if (!ds.live && ds.country === code) return ds.fx;
    }
    return { USD: 1 };
  }

  function liveSearch() {
    if (live.busy) return;
    var place = $('livePlace').value.trim();
    if (!place) { $('livePlace').focus(); return; }
    var what = $('liveWhat').value.trim().slice(0, 120);
    if (!what || Services.interpret(what).kind === 'empty') {
      live.kind = 'error';
      live.status = t('liveError')['nothing-to-search'];
      renderLive();
      $('liveWhat').focus();
      return;
    }
    var code = $('liveCountry').value || country();
    var radiusKm = state.need.radiusKm;
    live.busy = true;
    live.country = code;
    live.kind = 'busy';
    live.status = fmt(t('liveSearching'), { cat: what, place: place });
    renderLive();
    Live.search({
      what: what, place: place, country: code, radiusKm: radiusKm, fx: fxFor(code), unit: state.need.unit
    }).then(function (res) {
      if (!dataset().live) live.lastSampleId = prefs.datasetId;
      saveState();
      Sample.DATASETS.live = res.dataset;
      prefs.datasetId = 'live';
      loadState();
      state.tab = 'search';
      live.busy = false;
      var st = res.stats;
      live.kind = st.total ? 'ok' : 'warn';
      live.status = st.total
        ? fmt(t('liveFound'), { n: st.total, place: place, offline: st.withoutWebsite, phone: st.withPhone })
        : fmt(t('liveNone'), { cat: what, place: place });
      if (Number(radiusKm) > res.radiusKm) live.status += ' ' + fmt(t('liveCapped'), { km: res.radiusKm });
      render();
    }, function (err) {
      live.busy = false;
      live.kind = 'error';
      live.status = t('liveError')[err && err.code] || t('liveError').http;
      renderLive();
    });
  }

  function render() {
    applyI18n();
    renderLive();
    renderKpis();
    renderTabs();
    renderNeedForm();
    renderResults();
    renderQuotes();
    renderOffline();
    renderReview();
    renderData();
    saveState();
  }

  function onNeedChange(field, value) {
    state.need[field] = value;
    state.need.presetId = '';
    render();
  }

  /**
   * The buyer typed what they need. The ranking of the sample data follows it;
   * the Quotes tab follows its category, so quotes match what is being sought.
   */
  function onQueryChange(value) {
    state.need.query = String(value || '').slice(0, 120);
    var w = wanted();
    if (w.categories.length && w.categories[0] !== state.need.category) {
      state.need.category = w.categories[0];
      state.need.item = '';
    }
    state.need.presetId = '';
    state.openRfq = null;
    renderLive();
    renderNeedForm();
    renderResults();
    renderQuotes();
    saveState();
  }

  function bind() {
    $('liveForm').addEventListener('submit', function (e) { e.preventDefault(); liveSearch(); });
    var queryTimer = null;
    $('liveWhat').addEventListener('input', function () {
      var value = $('liveWhat').value.slice(0, 120);
      clearTimeout(queryTimer);
      queryTimer = setTimeout(function () { onQueryChange(value); }, 200);
    });
    $('liveCountry').addEventListener('change', function () { live.country = $('liveCountry').value; updateMapsLink(); });
    $('livePlace').addEventListener('input', updateMapsLink);
    $('liveBack').addEventListener('click', function () {
      prefs.datasetId = Sample.DATASETS[live.lastSampleId] ? live.lastSampleId : 'bogota';
      live.status = '';
      live.kind = '';
      $('livePlace').value = '';
      loadState();
      render();
    });
    $('theme').addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { window.localStorage.setItem(STORAGE + 'theme', next); } catch (err) { /* private mode */ }
      renderLive();
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { prefs.lang = b.getAttribute('data-lang'); render(); });
    });
    $('dataset').addEventListener('change', function () {
      saveState();
      if (!Sample.DATASETS[$('dataset').value].live) live.lastSampleId = $('dataset').value;
      $('livePlace').value = '';
      prefs.datasetId = $('dataset').value;
      loadState();
      render();
    });
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        state.tab = next.getAttribute('data-tab');
        render();
        next.focus();
      });
    });

    $('category').addEventListener('change', function () { onNeedChange('category', $('category').value); });
    $('item').addEventListener('change', function () { onNeedChange('item', $('item').value.slice(0, 120)); });
    $('quantity').addEventListener('change', function () { onNeedChange('quantity', Math.max(0, Number($('quantity').value) || 1)); });
    $('unit').addEventListener('change', function () { onNeedChange('unit', $('unit').value); });
    $('origin').addEventListener('change', function () { onNeedChange('originId', $('origin').value); });
    $('radius').addEventListener('input', function () {
      state.need.radiusKm = Number($('radius').value);
      $('radiusOut').textContent = state.need.radiusKm + ' km';
      renderResults();
    });
    $('radius').addEventListener('change', function () { render(); });
    $('needForm').addEventListener('submit', function (e) { e.preventDefault(); });

    ['vat', 'monthlyRate', 'fxUsd'].forEach(function (id) {
      $(id).addEventListener('change', function () { state.settings[id] = Math.max(0, Number($(id).value) || 0); render(); });
    });
    $('quoteForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var need = currentNeed();
      var moq = Number($('qMoq').value);
      var quote = Schema.sanitizeQuote({
        id: uid('q'), supplierId: $('qSupplier').value, category: need.category, item: need.item,
        price: Number($('qPrice').value), currency: C.getProfile(country()).currency,
        per: { qty: Number($('qPack').value) || 1, unit: $('qUnit').value }, taxIncluded: $('qTax').checked,
        shipping: Number($('qShipping').value) || 0, minOrder: moq ? { qty: moq, unit: $('qUnit').value } : null,
        leadDays: $('qLead').value === '' ? null : Number($('qLead').value), paymentDays: Number($('qTerms').value) || 0, at: today()
      }, 0);
      if (!quote) return;
      state.db.quotes.push(quote);
      $('quoteForm').reset();
      render();
    });

    document.querySelectorAll('[data-example]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-example');
        $('captureText').value = Sample.CAPTURE_EXAMPLES[key];
        $('captureCountry').value = { flyer: 'MX', cartao: 'BR' }[key] || 'CO';
        renderConsentLabel();
        $('captureSource').value = 'field';
        $('captureReferrer').value = '';
      });
    });
    $('captureCountry').addEventListener('change', renderConsentLabel);
    $('extract').addEventListener('click', function () {
      state.capture = Capture.parseCapture($('captureText').value, { country: $('captureCountry').value });
      state.captureStatus = '';
      renderCapturePreview();
    });
    $('referralCategory').addEventListener('change', function () { renderOffline(); });
    $('copyReferral').addEventListener('click', function () { copyText($('referralMessage').textContent, $('copyReferral')); });

    $('importJson').addEventListener('change', function () {
      readFile($('importJson'), function (text) {
        var r = importDb(JSON.parse(text));
        $('ioStatus').textContent = fmt(t('imported'), { n: r.added, m: r.merged });
        render();
      });
    });
    $('importCsv').addEventListener('change', function () {
      readFile($('importCsv'), function (text, name) {
        var out = Csv.importSuppliers(text, { country: country(), source: 'import', ref: name.slice(0, 80), today: today() });
        var r = importDb({ suppliers: out.suppliers });
        $('ioStatus').textContent = fmt(t('imported'), { n: r.added, m: r.merged }) + ' ' + fmt(t('csvColumns'), { c: Object.keys(out.mapping).join(', ') || '—' });
        render();
      });
    });
    $('exportJson').addEventListener('click', function () {
      var db = { version: 1, country: country(), suppliers: state.db.suppliers, quotes: state.db.quotes, referrals: state.db.referrals };
      download('supplier-scout-' + prefs.datasetId + '.json', JSON.stringify(db, null, 2), 'application/json');
    });
    $('exportCsv').addEventListener('click', function () {
      download('supplier-scout-' + prefs.datasetId + '.csv', '\uFEFF' + Csv.toCsv(Csv.exportRows(state.db.suppliers)), 'text/csv;charset=utf-8');
    });
    $('reset').addEventListener('click', function () {
      removeStorage('state:' + prefs.datasetId);
      loadState();
      render();
      $('ioStatus').textContent = t('resetDone');
    });
  }

  var savedTheme = storedTheme();
  if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.setAttribute('data-theme', savedTheme);
  var savedPrefs = readStorage('prefs');
  if (savedPrefs && I18N[savedPrefs.lang]) prefs.lang = savedPrefs.lang;
  if (savedPrefs && Sample.DATASETS[savedPrefs.datasetId]) prefs.datasetId = savedPrefs.datasetId;
  loadState();
  bind();
  render();
})();
