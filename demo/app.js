/**
 * Supplier Scout — browser app.
 *
 * One search, answered in layers (src/core/channels.js): national suppliers
 * from public procurement data, the buyer's own suppliers, businesses nearby
 * on the open map and ready-made web searches (Google, Facebook, LinkedIn).
 * Every decision comes from src/core; the network is used only by demo/live.js.
 * Untrusted text is always rendered with textContent.
 */
(function () {
  'use strict';

  var I18N = window.ScoutI18n;
  var Services = window.ScoutServices;
  var Categories = window.ScoutCategories;
  var Countries = window.ScoutCountries;
  var Channels = window.ScoutChannels;
  var Short = window.ScoutShortlist;
  var Outreach = window.ScoutOutreach;
  var Capture = window.ScoutCapture;
  var Live = window.ScoutLive;
  var STORAGE = 'supplier-scout:v1:';
  var NATIONAL_SHOWN = 10;
  var NEARBY_SHOWN = 40;
  var VIEWS = { buscar: 'search', search: 'search', lista: 'list', list: 'list' };

  var prefs = { lang: detectLanguage(), country: 'CO' };
  var list = Short.sanitize(readStorage('shortlist'));
  var state = { view: 'search', filter: 'all', search: null, editing: null, seq: 0 };
  var map = null;

  // ---------- helpers ----------

  function detectLanguage() {
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i]).slice(0, 2).toLowerCase();
      if (I18N[l]) return l;
    }
    return 'es';
  }
  function t(key) {
    return key.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, I18N[prefs.lang]);
  }
  function fmt(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (_, k) { return values[k] === undefined ? '' : values[k]; });
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  /** The one helper for links that open another site. */
  function link(href, text, cls) {
    var a = el('a', cls || '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }
  function button(text, cls, onClick) {
    var b = el('button', cls || 'btn small', text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function readStorage(key) {
    try { return JSON.parse(window.localStorage.getItem(STORAGE + key) || 'null'); } catch (err) { return null; }
  }
  function writeStorage(key, value) {
    try { window.localStorage.setItem(STORAGE + key, JSON.stringify(value)); } catch (err) { /* private mode: list lasts this visit */ }
  }
  function saveList() { writeStorage('shortlist', list); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return '';
    return new Intl.DateTimeFormat(prefs.lang, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
  }
  function countryName(code) {
    var p = Countries.getProfile(code);
    return (p.name && (p.name[prefs.lang] || p.name.es)) || code;
  }
  function needLabel(id, typed) {
    if (id === 'text') return typed;
    var s = Services.byId(id);
    if (s) return s.label[prefs.lang] || s.label.es;
    return Channels.categoryLabel(id, prefs.lang);
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
  function inList(id) { return list.some(function (e) { return e.id === id; }); }

  // ---------- static texts ----------

  function renderTexts() {
    document.documentElement.lang = prefs.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-label]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-label'))); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === prefs.lang)); });
    $('what').placeholder = t('whatPh');
    $('place').placeholder = t('placePh');
    $('howLink').href = prefs.lang === 'es' || prefs.lang === 'pt'
      ? 'https://github.com/Dsergio909/supplier-scout/blob/main/docs/como-funciona.md'
      : 'https://github.com/Dsergio909/supplier-scout/blob/main/docs/how-it-works.md';
    $('listWrap').setAttribute('aria-label', t('listTable'));

    var sel = clear($('country'));
    Object.keys(Countries.PROFILES).filter(function (c) { return c !== 'XX'; }).map(function (c) {
      return { code: c, name: countryName(c) };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, prefs.lang); }).forEach(function (c) {
      var o = el('option', '', c.name);
      o.value = c.code;
      sel.appendChild(o);
    });
    sel.value = prefs.country;

    var ex = clear($('examples'));
    t('examples').forEach(function (text) {
      ex.appendChild(button(text, '', function () { $('what').value = text; runSearch(); }));
    });
  }

  // ---------- views ----------

  function route() {
    var key = (location.hash || '').replace('#', '').toLowerCase();
    state.view = VIEWS[key] || 'search';
    render();
  }

  function render() {
    document.querySelectorAll('[data-view]').forEach(function (a) {
      if (a.getAttribute('data-view') === state.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('view-search').hidden = state.view !== 'search';
    $('view-list').hidden = state.view !== 'list';
    $('listBadge').textContent = list.length ? String(list.length) : '';
    if (state.view === 'search') renderResults();
    else renderList();
  }

  // ---------- search ----------

  function runSearch(point) {
    var what = $('what').value.trim();
    var place = $('place').value.trim();
    var interp = Services.interpret(what);
    var status = $('status');
    if (!what || interp.kind === 'empty') {
      status.className = 'status error';
      status.textContent = t('errors.nothing-to-search');
      $('what').focus();
      return;
    }
    prefs.country = $('country').value;
    var seq = ++state.seq;
    var s = state.search = {
      seq: seq, what: what, place: place, country: prefs.country, interp: interp, scope: Channels.scopeOf(interp),
      point: point || null, region: '', alternatives: [], movedFrom: null, placeError: null,
      national: { status: prefs.country === 'CO' ? 'loading' : 'unsupported', suppliers: [], failed: [], terms: [], showAll: false },
      nearby: { status: 'idle', result: null, error: null, showAll: false }
    };
    $('go').disabled = true;
    $('go').textContent = t('searching');
    render();

    var located = s.point ? Promise.resolve({ places: [s.point], movedFrom: null })
      : (place ? Live.locate(place, s.country) : Promise.resolve({ places: [], movedFrom: null }));
    var national = s.national.status === 'loading'
      ? located.catch(function () { return { places: [] }; }).then(function (loc) {
        var p = loc.places && loc.places[0];
        s.region = p ? (p.full || p.label || '') : '';
        return Live.national({ what: what, interpretation: interp, region: s.region, today: today() });
      }).then(function (res) {
        if (state.search !== s) return;
        s.national = { status: 'done', suppliers: res.suppliers, failed: res.failed, terms: res.terms, showAll: false };
        render();
      }, function (err) {
        if (state.search !== s) return;
        s.national = { status: 'error', error: err.code || 'network', suppliers: [], failed: [], terms: [], showAll: false };
        render();
      })
      : Promise.resolve();

    var nearby = located.then(function (loc) {
      if (state.search !== s) return;
      if (place && !loc.places.length) { s.placeError = 'place-not-found'; render(); return; }
      s.point = loc.places[0] || null;
      s.alternatives = s.point && !point ? window.ScoutOsm.otherPlaces(loc.places) : [];
      s.movedFrom = loc.movedFrom && s.point && s.point.country && s.point.country !== loc.movedFrom ? loc.movedFrom : null;
      if (s.point && s.scope !== 'goods') return searchNearby(s);
      render();
    }, function (err) {
      if (state.search !== s) return;
      s.placeError = err.code || 'network';
      render();
    });

    Promise.all([national, nearby]).then(function () {
      if (state.seq !== seq) return;
      $('go').disabled = false;
      $('go').textContent = t('search');
    });
  }

  function searchNearby(s) {
    s.nearby = { status: 'loading', result: null, error: null, showAll: false };
    render();
    return Live.search({ what: s.what, point: s.point, country: s.country }).then(function (res) {
      if (state.search !== s) return;
      s.nearby = { status: 'done', result: res, error: null, showAll: false };
      render();
    }, function (err) {
      if (state.search !== s) return;
      s.nearby = { status: 'error', result: null, error: err.code || 'network', showAll: false };
      render();
    });
  }

  function renderStatus(s) {
    var box = clear($('status'));
    box.className = 'status';
    if (!s) return;
    var labels = Services.describe(s.interp, prefs.lang);
    add(box, el('span', 'understood', t('understood') + ' '),
      document.createTextNode(labels.length ? labels.join(' · ') + '. ' : fmt(t('understoodText'), { text: s.what }) + ' '),
      document.createTextNode(t('scope.' + s.scope)));
    if (s.movedFrom) box.appendChild(add(el('div', 'alts'), document.createTextNode(fmt(t('movedFrom'), { from: countryName(s.movedFrom), to: countryName(s.point.country) }))));
    if (s.placeError) box.appendChild(el('div', 'alts error', t('errors.' + s.placeError) || t('errors.network')));
    if (s.alternatives.length) {
      var alts = add(el('div', 'alts'), el('span', '', t('altPlaces')));
      s.alternatives.forEach(function (p) {
        alts.appendChild(button(p.label + (p.country && p.country !== s.country ? ' (' + countryName(p.country) + ')' : ''), '', function () {
          $('place').value = p.label;
          runSearch(p);
        }));
      });
      box.appendChild(alts);
    }
  }

  function layer(id, title, sub) {
    var sec = el('section', 'layer');
    sec.id = 'layer-' + id;
    sec.setAttribute('aria-labelledby', 'h-' + id);
    var head = el('div', 'layer-head');
    var h = el('h2', '', title);
    h.id = 'h-' + id;
    add(head, add(el('div'), h, sub ? el('p', 'sub', sub) : null));
    sec.appendChild(head);
    return sec;
  }

  function renderResults() {
    var s = state.search;
    renderStatus(s);
    var box = clear($('results'));
    if (!s) return;
    Channels.layerOrder(s.scope).forEach(function (id) {
      if (id === 'national') box.appendChild(nationalLayer(s));
      if (id === 'mine') box.appendChild(mineLayer(s));
      if (id === 'nearby') box.appendChild(nearbyLayer(s));
      if (id === 'web') box.appendChild(webLayer(s));
    });
  }

  // ----- national -----

  function termsText(s) {
    var terms = s.national.terms.length ? s.national.terms : window.ScoutSecop.searchTerms(s.interp, s.what);
    return terms.map(function (x) { return x.term; }).join('», «');
  }

  /** "Persona natural" in Colombia, "persona física" in Mexico, "persona humana" in Argentina. */
  function personLabel(type, country) {
    if (type !== 'person') return t('personType.company');
    if (prefs.lang === 'es' && country === 'MX') return 'Persona física';
    if (prefs.lang === 'es' && country === 'AR') return 'Persona humana';
    return t('personType.person');
  }

  /** +573001234567 -> 300 123 4567; +576017470153 -> 601 747 0153. */
  function phoneText(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (/^57\d{10}$/.test(d)) { d = d.slice(2); return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6); }
    return phone;
  }

  /** https://www.example.com/v2/index.php -> example.com */
  function siteText(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
  }

  function nationalLayer(s) {
    var n = s.national;
    var sec = layer('national', t('layer.national'), n.status === 'unsupported' ? null : fmt(t('natSub'), { terms: termsText(s) }));
    if (n.status === 'unsupported') { sec.appendChild(el('p', 'empty', fmt(t('natNotCO'), { country: countryName(s.country) }))); return sec; }
    if (n.status === 'loading') { sec.appendChild(el('p', 'loading', t('natLoading'))); return sec; }
    if (n.status === 'error') { sec.appendChild(el('p', 'empty', t('errors.' + n.error) || t('errors.network'))); return sec; }
    if (!n.suppliers.length) { sec.appendChild(el('p', 'empty', fmt(t('natNone'), { terms: termsText(s) }))); return sec; }

    var wrap = el('div', 'table-wrap');
    var table = el('table', 'grid nat-table');
    var head = el('tr');
    [t('colCompany'), t('colReach'), t('colContracts'), t('colCovers'), t('colContact')].forEach(function (h) {
      var th = el('th', '', h);
      th.scope = 'col';
      head.appendChild(th);
    });
    var actionsTh = add(el('th'), el('span', 'sr-only', t('colActions')));
    actionsTh.scope = 'col';
    head.appendChild(actionsTh);
    table.appendChild(add(el('thead'), head));
    // Companies and individuals: both are suppliers; the buyer can look at either.
    var counts = { all: n.suppliers.length, company: 0, person: 0 };
    n.suppliers.forEach(function (e) { counts[e.personType] = (counts[e.personType] || 0) + 1; });
    var filter = n.typeFilter && counts[n.typeFilter] ? n.typeFilter : 'all';
    var pool = filter === 'all' ? n.suppliers : n.suppliers.filter(function (e) { return e.personType === filter; });
    if (counts.person && counts.company) {
      var chips = add(el('div', 'chips nat-chips'), el('span', 'meta inline', t('natFilterLabel')));
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', t('natFilterLabel'));
      ['all', 'company', 'person'].forEach(function (k) {
        var b = button(fmt(t('natFilter.' + k), { n: counts[k] }), 'chip' + (filter === k ? ' on' : ''), function () { n.typeFilter = k; n.showAll = false; render(); });
        b.setAttribute('aria-pressed', String(filter === k));
        chips.appendChild(b);
      });
      sec.appendChild(chips);
    }
    var body = el('tbody');
    var shown = n.showAll ? pool : pool.slice(0, NATIONAL_SHOWN);
    var multiple = (n.terms || []).map(function (x) { return x.id; }).filter(function (id, i, a) { return a.indexOf(id) === i; }).length > 1;
    shown.forEach(function (e) {
      var c = e.contacts || {};
      var reachCls = e.reach === 'national' ? 'ok' : (e.reach === 'regional' ? 'info' : 'none');
      var reach = add(el('td', 'reach'), el('span', 'st ' + reachCls, t('reach.' + e.reach)),
        el('span', 'meta', (e.departments.length === 1 ? t('oneDepartment') : fmt(t('departments'), { n: e.departments.length })) +
          (e.inBuyerRegion ? ' · ' + t('inYourRegion') : '')));
      reach.title = e.departments.join(', ');
      var covers = el('td', 'sold');
      if (multiple) e.needs.forEach(function (id) { covers.appendChild(el('span', 'tag hit', needLabel(id, s.what))); });
      if (e.example) covers.appendChild(el('span', 'example', e.example));
      else if (!multiple) covers.appendChild(el('span', 'tag', needLabel(e.needs[0], s.what)));
      var contact = el('td', 'contact');
      if (c.phone) contact.appendChild(link('tel:' + c.phone, phoneText(c.phone)));
      if (c.email) contact.appendChild(link('mailto:' + c.email, c.email));
      if (c.website) contact.appendChild(link(c.website, siteText(c.website)));
      if (!contact.firstChild) contact.appendChild(el('span', 'muted', t('none')));
      var person = e.personType === 'person';
      var saved = inList(e.key);
      var addBtn = button(saved ? t('added') : t('add'), saved ? 'btn small' : 'btn small primary', function () { addNational(e, s); });
      addBtn.disabled = saved;
      var actions = add(el('td'), add(el('div', 'row-actions'), addBtn,
        // An individual is searched by name and city, never by their ID number.
        link('https://www.google.com/search?q=' + encodeURIComponent(person ? e.name + (c.city ? ' ' + c.city : '') : e.name + ' NIT ' + e.nit), t('webSearch'), 'btn small')));
      body.appendChild(add(el('tr'),
        add(el('td'), el('span', 'name', e.name), el('span', 'meta', (person ? personLabel('person', 'CO') : 'NIT ' + e.nit) + (c.city ? ' · ' + c.city : ''))),
        reach,
        add(el('td', 'num'), el('span', '', fmt(t('contracts'), { n: e.contracts })), el('span', 'meta', fmt(t('lastContract'), { date: fmtDate(e.last) }))),
        covers, contact, actions));
    });
    table.appendChild(body);
    sec.appendChild(add(wrap, table));
    if (pool.length > NATIONAL_SHOWN) {
      sec.appendChild(add(el('div', 'more-row'), button(n.showAll ? t('showLess') : fmt(t('showMore'), { n: pool.length - NATIONAL_SHOWN }), 'link-btn', function () {
        n.showAll = !n.showAll;
        render();
      })));
    }
    if (counts.person) sec.appendChild(el('p', 'person-note', t('natPersonNote')));
    var foot = add(el('div', 'layer-foot'), el('span', '', t('natSource')));
    if (n.failed.length) foot.appendChild(el('span', '', fmt(t('natPartial'), { terms: n.failed.join(', ') })));
    sec.appendChild(foot);
    return sec;
  }

  function wantedCategories(s) {
    var cats = (s.interp.categories || []).slice();
    return cats.length ? cats : [];
  }

  function addNational(e, s) {
    if (inList(e.key)) return;
    var entry = Short.fromNational(e, { need: s.what, today: today(), categories: wantedCategories(s) });
    if (entry) { list.push(entry); saveList(); render(); }
  }

  // ----- mine -----

  function termsLine(e) {
    var parts = [];
    if (e.creditDays !== null) parts.push(fmt(t('credit'), { n: e.creditDays }));
    if (e.payment) parts.push(t('payment.' + e.payment) || e.payment);
    if (e.delivery) parts.push(fmt(t('delivery'), { where: (t('coverage.' + e.delivery) || '').toLowerCase() }));
    if (e.eInvoice) parts.push(t('eInvoice'));
    return parts.length ? parts.join(' · ') : t('noTerms');
  }

  function mineLayer(s) {
    var cats = wantedCategories(s);
    var mine = cats.length ? Short.covering(list, cats) : [];
    var sec = layer('mine', t('layer.mine'), t('mineSub'));
    if (!mine.length) {
      sec.appendChild(add(el('div', 'empty'), el('p', '', t('mineNone')),
        button(t('addKnown'), 'btn small', function () { openEditor(null, cats); })));
      return sec;
    }
    var ul = el('ul', 'near-list plain');
    mine.forEach(function (e) {
      ul.appendChild(add(el('li', 'near-item'),
        add(el('div', 'near-top'), el('span', 'name', e.name), el('span', 'st ' + (e.status === 'quoted' || e.status === 'chosen' ? 'ok' : 'none'), t('status.' + e.status))),
        el('span', 'meta', t('source.' + e.source) + (e.personType ? ' · ' + personLabel(e.personType, e.country || prefs.country) : '') + (e.city ? ' · ' + e.city : '') + (e.phone ? ' · ' + phoneText(e.phone) : '')),
        el('span', 'terms', termsLine(e)),
        add(el('div', 'row-actions'), button(t('edit'), 'btn small', function () { openEditor(e); }))));
    });
    sec.appendChild(ul);
    return sec;
  }

  // ----- nearby -----

  function nearbyLayer(s) {
    var placeLabel = s.point ? (s.point.name || s.point.label || s.place) : s.place;
    var sec = layer('nearby', placeLabel ? fmt(t('layer.nearby'), { place: placeLabel }) : t('layer.nearbyAny'), t('nearSub'));
    var nb = s.nearby;
    if (!s.point) {
      sec.appendChild(el('p', 'empty', s.placeError ? (t('errors.' + s.placeError) || t('errors.network')) : t('nearNeedPlace')));
      return sec;
    }
    if (nb.status === 'idle') {
      sec.appendChild(add(el('div', 'empty'), button(fmt(t('nearRun'), { place: placeLabel }), 'btn', function () { searchNearby(s); })));
      return sec;
    }
    if (nb.status === 'loading') { sec.appendChild(el('p', 'loading', t('nearLoading'))); return sec; }
    if (nb.status === 'error') { sec.appendChild(el('p', 'empty', t('errors.' + nb.error) || t('errors.network'))); return sec; }
    var res = nb.result;
    var found = res.dataset.suppliers;
    if (!found.length) { sec.appendChild(el('p', 'empty', t('nearNone'))); return sec; }
    var travel = res.travel || {};
    var origin = res.point;
    var items = found.map(function (sup) {
      var tr = travel[sup.id];
      var km = sup.lat != null ? haversine(origin, sup) : null;
      return { s: sup, minutes: tr ? tr.minutes : null, km: tr && tr.km != null ? tr.km : km };
    }).sort(function (a, b) {
      var am = a.minutes === null ? Infinity : a.minutes, bm = b.minutes === null ? Infinity : b.minutes;
      return (am - bm) || ((a.km === null ? Infinity : a.km) - (b.km === null ? Infinity : b.km));
    });
    var shown = nb.showAll ? items : items.slice(0, NEARBY_SHOWN);
    var grid = el('div', 'near-grid');
    var ul = el('ul', 'near-list');
    shown.forEach(function (it, i) {
      var sup = it.s;
      var li = el('li', 'near-item');
      li.id = 'near-' + i;
      var dist = it.minutes !== null ? fmt(t('driveMin'), { n: it.minutes }) : (it.km !== null ? fmt(t('km'), { n: Math.round(it.km * 10) / 10 }) : '');
      var saved = inList(sup.id);
      var addBtn = button(saved ? t('added') : t('add'), saved ? 'btn small' : 'btn small primary', function () {
        if (inList(sup.id)) return;
        var entry = Short.fromSupplier(sup, { need: s.what, place: s.place, today: today(), categories: wantedCategories(s) });
        if (entry) { list.push(entry); saveList(); render(); }
      });
      addBtn.disabled = saved;
      var osm = (sup.sources || []).map(function (x) { return x && x.ref; }).filter(function (r) { return /^osm:/.test(r || ''); })[0];
      add(li,
        add(el('div', 'near-top'), add(el('span', 'name'), el('span', 'near-num', String(i + 1)), document.createTextNode(sup.name)), el('span', 'meta', dist)),
        el('span', 'meta', [sup.address, sup.city].filter(Boolean).join(', ')),
        el('span', 'meta', (sup.phones[0] || t('noPhone')) + (sup.websites[0] ? ' · ' + sup.websites[0].replace(/^https?:\/\//, '') : '')),
        add(el('div', 'row-actions'), addBtn, osm ? link('https://www.openstreetmap.org/' + osm.slice(4), t('openMap'), 'btn small') : null));
      ul.appendChild(li);
    });
    var mapBox = el('div', 'map');
    mapBox.id = 'map';
    add(grid, ul, mapBox);
    sec.appendChild(grid);
    if (items.length > NEARBY_SHOWN) {
      sec.appendChild(add(el('div', 'more-row'), button(nb.showAll ? t('showLess') : fmt(t('showMore'), { n: items.length - NEARBY_SHOWN }), 'link-btn', function () {
        nb.showAll = !nb.showAll;
        render();
      })));
    }
    var st = res.stats || {};
    var foot = add(el('div', 'layer-foot'), el('span', '', fmt(t('nearFound'), { n: found.length, web: st.withoutWebsite || 0, phone: st.withPhone || 0 })));
    if (res.source === 'nominatim') foot.appendChild(el('span', '', t('nearFallback')));
    sec.appendChild(foot);

    // The map lives inside this layer; recreate it whenever the layer is drawn.
    setTimeout(function () {
      if (!document.getElementById('map')) return;
      map = window.ScoutMap.create(mapBox, { onSelect: function (id) {
        var idx = shown.map(function (x) { return x.s.id; }).indexOf(id);
        var target = document.getElementById('near-' + idx);
        if (!target) return;
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        target.classList.remove('flash');
        void target.offsetWidth;
        target.classList.add('flash');
      } });
      map.setLabels({ zoomIn: t('zoomIn'), zoomOut: t('zoomOut') });
      map.show({
        center: { lat: origin.lat, lng: origin.lng }, radiusKm: res.radiusKm, label: fmt(t('layer.nearby'), { place: placeLabel }),
        points: shown.filter(function (x) { return x.s.lat != null; }).map(function (x) {
          return { id: x.s.id, lat: x.s.lat, lng: x.s.lng, rank: shown.indexOf(x) + 1, color: 'var(--accent)', title: (shown.indexOf(x) + 1) + '. ' + x.s.name };
        })
      });
    }, 0);
    return sec;
  }

  function haversine(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // ----- web -----

  function webLayer(s) {
    var sec = layer('web', t('layer.web'), t('webSub'));
    var links = Channels.webSearches({
      need: s.what, place: s.point ? (s.point.label || s.place) : s.place, countryName: countryName(s.country), scope: s.scope, lang: prefs.lang
    });
    var row = el('div', 'web-links');
    links.forEach(function (l) {
      var a = link(l.url, t('web.' + l.id), 'btn');
      a.title = l.query;
      row.appendChild(a);
    });
    sec.appendChild(add(el('div', 'layer-body'), row));
    return sec;
  }

  // ---------- my list ----------

  function listCategories() {
    var seen = [];
    list.forEach(function (e) { e.categories.forEach(function (c) { if (seen.indexOf(c) === -1) seen.push(c); }); });
    return seen;
  }

  function renderList() {
    var cats = listCategories();
    if (state.filter !== 'all' && cats.indexOf(state.filter) === -1) state.filter = 'all';

    var goals = clear($('goals'));
    cats.forEach(function (c) {
      var g = Short.goalFor(list, c);
      goals.appendChild(el('span', g.reached ? 'goal done' : 'goal', fmt(t('goalLine'), { cat: Channels.categoryLabel(c, prefs.lang), q: g.quoted, goal: g.goal })));
    });

    var chips = clear($('catChips'));
    $('catChips').setAttribute('aria-label', t('colCategories'));
    [['all', t('allCategories') + ' ' + list.length]].concat(cats.map(function (c) {
      return [c, Channels.categoryLabel(c, prefs.lang) + ' ' + Short.covering(list, [c]).length];
    })).forEach(function (c) {
      var b = button(c[1], '', function () { state.filter = c[0]; renderList(); });
      b.setAttribute('aria-pressed', String(state.filter === c[0]));
      chips.appendChild(b);
    });

    var rows = state.filter === 'all' ? list : list.filter(function (e) { return e.categories.indexOf(state.filter) !== -1; });
    var body = clear($('listRows'));
    if (!rows.length) {
      var td = el('td', 'empty', t('listEmpty'));
      td.colSpan = 6;
      body.appendChild(add(el('tr'), td));
    }
    rows.forEach(function (e) {
      var cats2 = el('td');
      e.categories.forEach(function (c) { cats2.appendChild(el('span', 'tag', Channels.categoryLabel(c, prefs.lang))); });
      var contact = el('td', 'contact');
      if (e.phone) contact.appendChild(link('tel:' + e.phone, phoneText(e.phone)));
      if (e.email) contact.appendChild(link('mailto:' + e.email, e.email));
      if (e.website) contact.appendChild(link(e.website, siteText(e.website)));
      if (!contact.firstChild) contact.appendChild(el('span', 'muted', t('none')));
      var sel = el('select');
      sel.setAttribute('aria-label', t('colStatus') + ': ' + e.name);
      Short.STATUSES.forEach(function (st) {
        var o = el('option', '', t('status.' + st));
        o.value = st;
        sel.appendChild(o);
      });
      sel.value = e.status;
      sel.addEventListener('change', function () { e.status = sel.value; saveList(); render(); });
      var meta = [t('source.' + e.source)];
      if (e.personType) meta.push(personLabel(e.personType, e.country || prefs.country));
      if (e.nit) meta.push('NIT ' + e.nit);
      if (e.city) meta.push(e.city);
      body.appendChild(add(el('tr'),
        add(el('td'), el('span', 'name', e.name), el('span', 'meta', meta.join(' · '))),
        cats2, contact, el('td', 'terms', termsLine(e)), add(el('td'), sel),
        add(el('td'), add(el('div', 'row-actions'),
          button(t('edit'), 'btn small', function () { openEditor(e); }),
          button(t('remove'), 'btn small', function () {
            list = list.filter(function (x) { return x.id !== e.id; });
            saveList();
            render();
          })))));
    });

    var verify = clear($('verify'));
    var links = Countries.verifyLinks(prefs.country);
    if (links.length) {
      verify.appendChild(el('span', '', t('verify')));
      links.forEach(function (l) { verify.appendChild(link(l.url, l.name)); });
    }
    $('exportCsv').disabled = !list.length;
    $('askQuotes').disabled = !list.length;
    $('clearList').hidden = !list.length;
  }

  // ---------- editor ----------

  function fillSelect(sel, values, labelOf, allowEmpty) {
    clear(sel);
    if (allowEmpty) {
      var o0 = el('option', '', t('choose'));
      o0.value = '';
      sel.appendChild(o0);
    }
    values.forEach(function (v) {
      var o = el('option', '', labelOf(v));
      o.value = v;
      sel.appendChild(o);
    });
  }

  function openEditor(entry, presetCategories) {
    state.editing = entry || null;
    $('editorTitle').textContent = entry ? t('formTitleEdit') : t('formTitleNew');
    $('editorError').textContent = '';
    $('pasteText').value = '';
    $('pasteNote').textContent = '';
    fillSelect($('ePersonType'), Short.PERSON_TYPES, function (v) { return personLabel(v, prefs.country); }, true);
    fillSelect($('eCoverage'), Short.COVERAGE, function (v) { return t('coverage.' + v); }, true);
    fillSelect($('eDelivery'), Short.COVERAGE, function (v) { return t('coverage.' + v); }, true);
    fillSelect($('ePayment'), Short.PAYMENT, function (v) { return t('payment.' + v); }, true);
    fillSelect($('eStatus'), Short.STATUSES, function (v) { return t('status.' + v); }, false);
    var chosen = entry ? entry.categories : (presetCategories || []);
    var box = clear($('eCats'));
    Categories.CATEGORIES.forEach(function (c) {
      var lab = el('label');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.value = c.id;
      cb.checked = chosen.indexOf(c.id) !== -1;
      add(box, add(lab, cb, el('span', '', c.label[prefs.lang] || c.label.es)));
    });
    var e = entry || {};
    $('eName').value = e.name || '';
    $('ePersonType').value = e.personType || '';
    $('eNit').value = e.nit || '';
    $('eCoverage').value = e.coverage || '';
    $('eCity').value = e.city || '';
    $('ePhone').value = e.phone || '';
    $('eEmail').value = e.email || '';
    $('eWebsite').value = e.website || '';
    $('eCredit').value = e.creditDays === null || e.creditDays === undefined ? '' : String(e.creditDays);
    $('ePayment').value = Short.PAYMENT.indexOf(e.payment) !== -1 ? e.payment : '';
    $('eDelivery').value = e.delivery || '';
    $('eInvoice').checked = !!e.eInvoice;
    $('ePrice').value = e.price || '';
    $('eLead').value = e.lead || '';
    $('eStatus').value = e.status || 'todo';
    $('eNotes').value = e.notes || '';
    $('editor').showModal();
    $('eName').focus();
  }

  function fillFromText() {
    var text = $('pasteText').value;
    var r = Capture.parseCapture(text, { country: prefs.country });
    var d = r.draft;
    var filled = [];
    function set(id, value, label) { if (value && !$(id).value) { $(id).value = value; filled.push(label); } }
    set('eName', d.name, t('fName'));
    set('ePhone', d.phones[0], t('fPhone'));
    set('eEmail', d.emails[0], t('fEmail'));
    set('eWebsite', (d.websites[0] || '').replace(/^http:\/\//, 'https://'), t('fWebsite'));
    set('eCity', d.city, t('fCity'));
    if (d.taxId && d.taxId.value) set('eNit', String(d.taxId.value).replace(/\D/g, '').slice(0, 12), t('fNit'));
    // A Colombian company NIT (8xx/9xx) says it is a company; anything else is left for the buyer to choose.
    if (d.taxId && d.taxId.value && !$('ePersonType').value && window.ScoutSecop.companyNit(d.taxId.value)) $('ePersonType').value = 'company';
    if (d.paymentDays != null) set('eCredit', String(d.paymentDays), t('fCredit'));
    if (d.ships && !$('eDelivery').value) { $('eDelivery').value = 'national'; filled.push(t('fDelivery')); }
    if (d.categories.length) {
      document.querySelectorAll('#eCats input').forEach(function (cb) { if (d.categories.indexOf(cb.value) !== -1) cb.checked = true; });
      filled.push(t('fCategories'));
    }
    $('pasteNote').textContent = filled.length ? fmt(t('pasteDone'), { fields: filled.join(', ') }) : t('pasteNothing');
  }

  function saveEditor(ev) {
    ev.preventDefault();
    var err = $('editorError');
    var name = $('eName').value.trim();
    var cats = Array.prototype.slice.call(document.querySelectorAll('#eCats input:checked')).map(function (cb) { return cb.value; });
    var rawPhone = $('ePhone').value.trim();
    var phone = rawPhone ? Countries.normalizePhone(rawPhone, prefs.country) : '';
    var email = $('eEmail').value.trim().toLowerCase();
    var web = $('eWebsite').value.trim();
    if (!name) { err.textContent = t('nameRequired'); $('eName').focus(); return; }
    if (!cats.length) { err.textContent = t('categoryRequired'); return; }
    if (rawPhone && !phone) { err.textContent = t('phoneInvalid'); $('ePhone').focus(); return; }
    if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/.test(email)) { err.textContent = t('emailInvalid'); $('eEmail').focus(); return; }
    if (web && !/^https:\/\/[^\s<>"]+$/i.test(web)) { err.textContent = t('websiteInvalid'); $('eWebsite').focus(); return; }
    var base = state.editing || { id: 'm:' + Date.now().toString(36), source: 'manual', addedAt: today(), country: prefs.country };
    var entry = Short.sanitizeEntry(Object.assign({}, base, {
      name: name, categories: cats, personType: $('ePersonType').value, nit: $('eNit').value.replace(/\D/g, ''), coverage: $('eCoverage').value, city: $('eCity').value,
      phone: phone || '', email: email, website: web, creditDays: $('eCredit').value === '' ? null : $('eCredit').value,
      payment: $('ePayment').value, delivery: $('eDelivery').value, eInvoice: $('eInvoice').checked,
      price: $('ePrice').value, lead: $('eLead').value, status: $('eStatus').value, notes: $('eNotes').value
    }));
    if (!entry) return;
    var at = list.map(function (x) { return x.id; }).indexOf(entry.id);
    if (at === -1) {
      if (list.length >= Short.MAX_ENTRIES) return;
      list.push(entry);
    } else list[at] = entry;
    saveList();
    $('editor').close();
    render();
  }

  // ---------- quote requests ----------

  function openQuotes() {
    var s = state.search;
    $('qNeed').value = s ? s.what : (state.filter !== 'all' ? Channels.categoryLabel(state.filter, prefs.lang).toLowerCase() : '');
    renderQuotes();
    $('quotes').showModal();
  }

  function renderQuotes() {
    var need = $('qNeed').value.trim();
    var ul = clear($('rfqList'));
    var todo = list.filter(function (e) {
      return e.status === 'todo' && (e.phone || e.email) && (state.filter === 'all' || e.categories.indexOf(state.filter) !== -1);
    });
    if (!todo.length) { ul.appendChild(el('li', 'empty', t('quotesNone'))); return; }
    var onsite = !!state.search && (state.search.scope === 'onsite' || state.search.scope === 'firm');
    todo.forEach(function (e) {
      var msg = Outreach.rfqMessage({ item: need, service: onsite, documents: true, person: e.personType === 'person' }, e.name, prefs.lang, e.country || prefs.country);
      function contacted() { e.status = 'contacted'; saveList(); setTimeout(function () { renderQuotes(); render(); }, 300); }
      var row = add(el('div', 'row-actions'));
      var wa = e.phone && Outreach.whatsappLink(e.phone, msg);
      if (wa) { var a = link(wa, t('whatsapp'), 'btn small primary'); a.addEventListener('click', contacted); row.appendChild(a); }
      if (e.email) {
        var subject = t('quotesTitle') + (need ? ': ' + need : '');
        var m = link('mailto:' + e.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg), t('email'), 'btn small');
        m.addEventListener('click', contacted);
        row.appendChild(m);
      }
      var copyBtn = button(t('copy'), 'btn small', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { copyBtn.textContent = t('copied'); }, function () {});
      });
      row.appendChild(copyBtn);
      ul.appendChild(add(el('li'), el('span', 'name', e.name), el('pre', '', msg), row));
    });
  }

  // ---------- location ----------

  function nearMe() {
    var status = $('status');
    function fail(code) { status.className = 'status error'; status.textContent = t('geoError.' + code); }
    if (!navigator.geolocation) { fail('unsupported'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      // About 100 m of precision is enough; the exact position never leaves the browser.
      var coarse = function (x) { return Math.round(x * 1000) / 1000; };
      $('place').value = t('myLocation');
      runSearch({ lat: coarse(pos.coords.latitude), lng: coarse(pos.coords.longitude), label: t('myLocation'), name: t('myLocation'), country: prefs.country });
    }, function (err) { fail(err && err.code === 1 ? 'denied' : 'unavailable'); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }

  // ---------- wiring ----------

  $('searchForm').addEventListener('submit', function (ev) { ev.preventDefault(); runSearch(); });
  $('nearMe').addEventListener('click', nearMe);
  $('country').addEventListener('change', function () { prefs.country = $('country').value; if (state.view === 'list') renderList(); });
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { prefs.lang = b.getAttribute('data-lang'); renderTexts(); render(); });
  });
  $('addSupplier').addEventListener('click', function () { openEditor(null, state.filter !== 'all' ? [state.filter] : []); });
  $('askQuotes').addEventListener('click', openQuotes);
  $('qNeed').addEventListener('input', renderQuotes);
  $('quotesClose').addEventListener('click', function () { $('quotes').close(); });
  $('exportCsv').addEventListener('click', function () {
    var labels = { headers: t('csvHeaders'), status: t('status'), coverage: t('coverage'), yes: t('yes'), categories: {},
      personTypes: { company: personLabel('company'), person: personLabel('person', prefs.country) } };
    Categories.CATEGORIES.forEach(function (c) { labels.categories[c.id] = c.label[prefs.lang] || c.label.es; });
    download('supplier-scout-lista-' + today() + '.csv', '﻿' + Short.toCsv(list, labels), 'text/csv;charset=utf-8');
  });
  $('clearList').addEventListener('click', function () {
    if (!window.confirm(t('confirmClear'))) return;
    list = [];
    saveList();
    render();
  });
  $('pasteFill').addEventListener('click', fillFromText);
  $('editorForm').addEventListener('submit', saveEditor);
  $('editorClose').addEventListener('click', function () { $('editor').close(); });
  $('editorCancel').addEventListener('click', function () { $('editor').close(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', function (ev) {
    if (ev.key === STORAGE + 'shortlist') { list = Short.sanitize(readStorage('shortlist')); render(); }
  });

  renderTexts();
  route();
})();
