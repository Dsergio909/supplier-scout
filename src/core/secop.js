/**
 * Supplier Scout — national suppliers from Colombia's public procurement data.
 *
 * SECOP II publishes every contract the state signs (datos.gov.co, dataset
 * jbjy-vk9h, open and CORS-enabled). A company that sold stationery to
 * entities in fourteen departments over the last two years is, by definition,
 * a supplier that delivers nationally, invoices formally and handles volume:
 * exactly what purchasing looks for besides the shop around the corner.
 *
 * One grouped query per need (provider x department, last two years), then
 * the rows are merged here into one entry per company with how many contracts,
 * in how many departments, when the last one was signed and which of the
 * buyer's needs it covers. Contact details come from a second public dataset,
 * the suppliers registered in SECOP II (qmzu-gj57), by tax ID.
 *
 * Companies and individuals (personas naturales) are both kept: in Latin
 * America many suppliers are individuals, often cheaper, and in SECOP they win
 * 30-40% of the contracts for stationery, extinguishers or air conditioning
 * (live check, November 2026). What is left out: people hired by the state as
 * quasi-staff ("prestación de servicios profesionales y de apoyo a la gestión"),
 * agreements with non-profits, leases, minors' ID documents, public utilities
 * and temporary joint ventures. An individual's tax ID is their national ID
 * number: it is used only to look up their public supplier contact and is
 * never shown, stored in the list or exported.
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var HOST = 'https://www.datos.gov.co';
  var CONTRACTS = 'jbjy-vk9h';
  var REGISTERED = 'qmzu-gj57';
  var DAY_MS = 86400000;
  var LOOKBACK_DAYS = 730;
  var ROW_LIMIT = 1000;
  var NATIONAL_MIN_DEPARTMENTS = 3;

  // What to look for in contract descriptions for each need (Spanish, as SECOP is).
  // [words for the full-text search, stem that must appear in the description].
  // Two words narrow the search a lot: "vigilancia" alone also finds
  // epidemiological surveillance, "vigilancia privada" only security firms
  // (checked against the live data, November 2026). The stem keeps companies
  // whose name or buyer matched but whose contract was about something else.
  var TERMS = {
    office: ['papelería', 'PAPELER'], cleaning: ['aseo', 'ASEO'], textiles: ['dotación', 'DOTACI'],
    packaging: ['cajas cartón', 'CAJA'], hardware: ['ferretería', 'FERRETER'], printing: ['impresos', 'IMPRES'],
    food: ['cafetería', 'CAFETER'], electronics: ['material eléctrico', 'ELECTRIC'], furniture: ['mobiliario', 'MOBILIARIO'],
    '3dprint': ['impresión 3D', ''], transport: ['transporte', 'TRANSPORTE'], maintenance: ['mantenimiento locativo', 'LOCATIV'],
    hvac: ['aire acondicionado', 'AIRE'], plumbing: ['mantenimiento hidrosanitario', 'HIDROSANITARI'],
    electrical: ['mantenimiento eléctrico', 'ELECTRIC'], locksmith: ['cerrajería', 'CERRAJER'],
    metalwork: ['estructuras metálicas', 'ESTRUCTURA'], painting: ['pintura', 'PINTURA'], glass: ['vidrios', 'VIDRIO'],
    building: ['obra civil', 'OBRA'], roofing: ['cubiertas', 'CUBIERTA'], gardening: ['jardinería', 'JARDINER'],
    pest: ['fumigación', 'FUMIGACI'], cleaningService: ['servicio de aseo', 'ASEO'], vehicles: ['mantenimiento vehículos', ''],
    machining: ['mecanizado', 'MECANIZAD'], laundry: ['lavandería', 'LAVANDER'], it: ['soporte técnico', ''],
    appliances: ['electrodomésticos', ''], upholstery: ['tapicería', 'TAPICER'], signs: ['señalización', ''],
    catering: ['alimentación', 'ALIMENTACI'], moving: ['trasteo', 'TRASTEO'], security: ['vigilancia privada', 'VIGILANCIA'],
    fireSafety: ['extintores', 'EXTINTOR'], elevators: ['ascensores', 'ASCENSOR'], power: ['planta eléctrica', 'PLANTA'],
    accounting: ['servicios contables', 'CONTAB'], legal: ['asesoría jurídica', '']
  };

  // Document types that can be a supplier. "Tarjeta de Identidad" (minors),
  // passports and temporary permits are left out.
  var DOC_TYPES = ['NIT', 'Cédula de Ciudadanía', 'Cédula de Extranjería', 'Otro', 'No Definido'];
  var PERSON_DOCS = /^c[eé]dula/i;
  // Contracts that are not a purchase from a supplier: people hired as
  // quasi-staff, agreements with non-profits (Decreto 092 de 2017) and leases.
  var NOT_A_PURCHASE_TYPES = ['Decreto 092 de 2017', 'Arrendamiento de inmuebles', 'Arrendamiento de muebles', 'Comodato', 'Empréstito'];
  var STAFF_JUSTIFICATION = 'Servicios profesionales y apoyo a la gestión';
  var STAFF_WORDS = ['APOYO A LA GESTI', 'SERVICIOS PROFESIONALES', 'OPERARI', 'SUBORDINACI', 'PLENA AUTONOM'];

  // Words that say nothing about what is bought.
  var STOP = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'para', 'con', 'en', 'por', 'a', 'al', 'un', 'una',
    'servicio', 'servicios', 'suministro', 'compra', 'proveedor', 'proveedores', 'empresa', 'empresas', 'necesito', 'busco'];

  // Public utilities (E.S.P.) and temporary joint ventures (consorcios, uniones
  // temporales) win public contracts but are not suppliers a company can call.
  var LEGAL_FORM = /\b(S\.?\s?A\.?\s?S|LTDA|LIMITADA|S\.\s?A|E\.\s?U|S\.?\s?C\.?\s?A|S\.?\s?EN\s?C)\.?$/i;
  var NOT_A_SUPPLIER = /\bE\.?\s?S\.?\s?P\b|servicios p[uú]blicos|^(consorcio|uni[oó]n temporal)\b/i;

  function clean(text, max) {
    return String(text || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  /**
   * Colombian companies (personas jurídicas) have a 9-digit NIT starting with 8
   * or 9, sometimes written with its check digit (10 digits, accepted only when
   * the digit is right). Individuals who register with a NIT use their ID number
   * (cédula), which does not follow that pattern. Returns the 9-digit company
   * NIT, or '' for an individual.
   */
  function companyNit(value) {
    var d = String(value || '').replace(/\D/g, '');
    if (/^[89]\d{8}$/.test(d)) return d;
    if (/^[89]\d{9}$/.test(d) && checkDigit(d.slice(0, 9)) === d.slice(9)) return d.slice(0, 9);
    return '';
  }

  /** An individual's document number (5 to 11 digits), or ''. */
  function personDoc(value) {
    var d = String(value || '').replace(/\D/g, '');
    return /^\d{5,11}$/.test(d) ? d : '';
  }

  /**
   * Who a contract row belongs to: { type: 'company' | 'person', doc } or null.
   * A company NIT (8xx/9xx) is a company whatever the document type says; a
   * cédula, or a NIT that is someone's ID number (a sole trader), is a person.
   */
  function classify(docType, docNumber) {
    var type = String(docType || '');
    if (PERSON_DOCS.test(type)) { var p = personDoc(docNumber); return p ? { type: 'person', doc: p } : null; }
    if (DOC_TYPES.indexOf(type) === -1 && type) return null;
    var nit = companyNit(docNumber);
    if (nit) return { type: 'company', doc: nit };
    // A NIT that looks like a company's but fails its check digit is a typo, not a person.
    if (type === 'NIT' && !/^[89]\d{8,9}$/.test(String(docNumber || '').replace(/\D/g, ''))) {
      var q = personDoc(docNumber);
      return q ? { type: 'person', doc: q } : null;
    }
    return null;
  }

  /** A stable list key for an individual that does not reveal their ID number. */
  function personKey(doc) {
    var h = 0x811c9dc5;
    var text = 'scout:' + doc;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'pn:' + ('0000000' + h.toString(16)).slice(-8);
  }

  /** DIAN check digit of a NIT (the registry sometimes stores it appended). */
  function checkDigit(nit) {
    var w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    var d = String(nit).split('').reverse();
    var sum = 0;
    for (var i = 0; i < d.length; i++) sum += Number(d[i]) * w[i];
    var r = sum % 11;
    return String(r > 1 ? 11 - r : r);
  }

  // Landline area codes since 2021 (CRC numbering plan): 60 + one digit per region.
  var AREA = [
    ['1', /bogota|cundinamarca/],
    ['2', /cauca|narino|valle/],
    ['4', /antioquia|cordoba|choco/],
    ['5', /atlantico|bolivar|cesar|guajira|magdalena|sucre|san andres/],
    ['6', /caldas|quindio|risaralda/],
    ['7', /arauca|santander/],
    ['8', /amazonas|boyaca|caqueta|casanare|guainia|guaviare|huila|meta|putumayo|tolima|vaupes|vichada/]
  ];

  /**
   * A phone from the registry as +57…, or '' when it cannot be dialled:
   * mobiles (3xx), landlines with area code (60x) and old 7-digit landlines,
   * which get the area code of the supplier's department.
   */
  function colombianPhone(raw, department) {
    var first = String(raw || '').split(/[\/,;]|\s-\s|\sy\s|\sext/i)[0];
    var d = first.replace(/\D/g, '').replace(/^0+/, '');
    if (/^57(3\d{9}|60\d{8})$/.test(d)) return '+' + d;
    if (/^(3\d{9}|60\d{8})$/.test(d)) return '+57' + d;
    if (/^[2-8]\d{6}$/.test(d)) {
      var dep = fold(department);
      for (var i = 0; i < AREA.length; i++) if (AREA[i][1].test(dep)) return '+5760' + AREA[i][0] + d;
    }
    return '';
  }

  // Search engines and link shorteners are not a supplier's website.
  var NOT_A_SITE = /^(www\.)?(google|bing|yahoo|duckduckgo)\.[a-z.]+(\/|$)|^(bit\.ly|goo\.gl|t\.co|tinyurl\.com)(\/|$)/;

  /** What the buyer typed, without accents and filler words: "tóner para impresora" -> "toner impresora". */
  function typedQuery(typed) {
    var words = fold(typed).split(' ').filter(function (w) { return w.length >= 3 && STOP.indexOf(w) === -1; });
    return words.slice(0, 4).join(' ');
  }

  /**
   * Searches for an interpretation (ScoutServices.interpret) and the typed text:
   * one per service or category (at most three), each { id, term, like }.
   * When there is a single need and the buyer was more specific than the
   * generic term ("tóner para impresora" is stationery, but "tóner" is what to
   * look for), the typed words go first, marked exact. Free text is used as typed.
   */
  function searchTerms(interpretation, typed) {
    var i = interpretation || {};
    var ids = (i.services || []).concat(i.kind === 'category' ? (i.categories || []) : []);
    var terms = [];
    ids.forEach(function (id) {
      var t = TERMS[id];
      if (t && !terms.some(function (x) { return x.term === t[0]; })) terms.push({ id: id, term: t[0], like: t[1] });
    });
    terms = terms.slice(0, 3);
    var q = typedQuery(typed);
    if (!terms.length) return q ? [{ id: 'text', term: clean(typed, 60), exact: true }] : [];
    if (terms.length === 1 && q && q.split(' ').some(function (w) { return fold(terms[0].term).split(' ').indexOf(w) === -1; })) {
      terms.unshift({ id: terms[0].id, term: clean(typed, 60), exact: true });
    }
    return terms;
  }

  function sinceDate(today, days) {
    var base = today ? new Date(today) : new Date();
    return new Date(base.getTime() - (days || LOOKBACK_DAYS) * DAY_MS).toISOString().slice(0, 10);
  }

  /** SoQL string literal: quotes doubled, control characters out. */
  function soql(text) {
    return clean(text, 100).replace(/'/g, "''");
  }

  /**
   * Grouped contracts query: companies x department that sold `term`, with one
   * contract description as an example. opts.like: a stem (A-Z only) that must
   * appear in the description; opts.exact: search the words as typed.
   */
  function contractsUrl(term, opts) {
    var o = opts || {};
    var params = new URLSearchParams();
    var like = String(o.like || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 20);
    params.set('$select', 'proveedor_adjudicado, documento_proveedor, tipodocproveedor, departamento, count(*) as n, max(fecha_de_firma) as ultima, max(objeto_del_contrato) as ejemplo');
    params.set('$q', (o.exact ? typedQuery(term) : fold(term)) || clean(term, 60));
    var list = function (values) { return values.map(function (v) { return "'" + soql(v) + "'"; }).join(', '); };
    params.set('$where', 'tipodocproveedor in (' + list(DOC_TYPES) + ") AND fecha_de_firma > '" + soql(sinceDate(o.today, o.days)) + "T00:00:00'" +
      ' AND (tipo_de_contrato IS NULL OR tipo_de_contrato not in (' + list(NOT_A_PURCHASE_TYPES) + '))' +
      " AND (justificacion_modalidad_de IS NULL OR justificacion_modalidad_de != '" + soql(STAFF_JUSTIFICATION) + "')" +
      // Wording of a personal-service contract, checked only for people with a cédula:
      // a cleaning company that sends "two operators" is still a supplier.
      " AND (tipodocproveedor not in ('Cédula de Ciudadanía', 'Cédula de Extranjería') OR (" +
      STAFF_WORDS.map(function (w) { return "upper(objeto_del_contrato) not like '%" + w + "%'"; }).join(' AND ') + '))' +
      (like.length >= 4 ? " AND upper(objeto_del_contrato) like '%" + like + "%'" : ''));
    params.set('$group', 'proveedor_adjudicado, documento_proveedor, tipodocproveedor, departamento');
    params.set('$order', 'n DESC');
    params.set('$limit', String(o.limit || ROW_LIMIT));
    return HOST + '/resource/' + CONTRACTS + '.json?' + params.toString();
  }

  /**
   * Contact details of registered suppliers, by tax ID (digits only), with and
   * without the check digit, since the registry stores either. Only the
   * supplier's own contact fields are read, never the legal representative's.
   */
  function contactsUrl(docs) {
    var list = [];
    (docs || []).slice(0, 40).forEach(function (n) {
      var d = companyNit(n) || personDoc(n);
      if (d && list.indexOf(d) === -1) list.push(d, d + checkDigit(d));
    });
    var params = new URLSearchParams();
    params.set('$select', 'nit, nombre, telefono, correo, sitio_web, departamento, municipio, esta_activa');
    params.set('$where', 'nit in (' + list.map(function (n) { return "'" + n + "'"; }).join(', ') + ')');
    params.set('$limit', '200');
    return HOST + '/resource/' + REGISTERED + '.json?' + params.toString();
  }

  function provided(value) {
    var v = clean(value, 120);
    return v && !/^(no provisto|no definido|n\/a|na|ninguno|0+)$/i.test(v) ? v : '';
  }

  function titleCase(name) {
    return clean(name, 120).toLowerCase().replace(/(^|[\s.(&-])([a-záéíóúñü])/g, function (_, p, c) { return p + c.toUpperCase(); })
      .replace(/\b(Sas|S\.a\.s\.?|Ltda|S\.a\.|Sa|Cia|E\.s\.p\.?|Esp)\b/g, function (m) { return m.toUpperCase(); })
      .replace(/ (De|Del|Y|E|En|Para) (?=\S)/g, function (m) { return m.toLowerCase(); });
  }

  /**
   * Merge grouped rows (one array per search term) into one entry per company.
   * groups: [{ id, term, rows: [{ proveedor_adjudicado, documento_proveedor, departamento, n, ultima }] }]
   * Returns entries sorted by reach: departments, then contracts, then recency.
   */
  function aggregate(groups, opts) {
    var o = opts || {};
    var byNit = {};
    (groups || []).forEach(function (g) {
      (g.rows || []).forEach(function (r) {
        var who = classify(r.tipodocproveedor === undefined ? 'NIT' : r.tipodocproveedor, r.documento_proveedor);
        var name = clean(r.proveedor_adjudicado, 120).replace(/\?{2,}|\uFFFD/g, '').replace(/[\s-]+$/, '');
        if (!who || !name || NOT_A_SUPPLIER.test(name)) return;
        // A name with a legal form ("… SAS", "… LTDA") is a company even when SECOP has it
        // under a number that is not a company NIT; that number stays hidden all the same.
        if (who.type === 'person' && LEGAL_FORM.test(name)) who = { type: 'company', doc: who.doc, hidden: true };
        var id = who.type + ':' + who.doc;
        var e = byNit[id];
        if (!e) {
          e = byNit[id] = { personType: who.type, key: who.type === 'company' && !who.hidden ? 'nit:' + who.doc : personKey(who.doc),
            nit: who.type === 'company' && !who.hidden ? who.doc : '', name: titleCase(name), contracts: 0, departments: [], last: '', needs: [],
            exact: false, example: '', exampleN: -1, contacts: null, seen: {} };
          // The person's ID number is kept out of sight: not enumerable, so it is never
          // rendered, serialised or saved; it is only used to look up the public contact.
          Object.defineProperty(e, 'doc', { value: who.doc, enumerable: false });
        }
        var n = Number(r.n) || 0;
        // The same contracts can come back for the typed words and for the generic term.
        var key = clean(r.departamento, 60) + '|' + n + '|' + r.ultima;
        if (!e.seen[key]) e.contracts += n;
        e.seen[key] = true;
        if (g.exact) e.exact = true;
        var example = describe(r.ejemplo);
        // Prefer an example that mentions what was searched (max() returns any one).
        var stems = fold(g.term).split(' ').filter(function (w) { return w.length >= 4; }).map(function (w) { return w.slice(0, 5); });
        var relevant = stems.some(function (st) { return fold(example).indexOf(st) !== -1; });
        var weight = n + (g.exact ? 100000 : 0) + (relevant ? 1000000 : 0);
        if (example && weight > e.exampleN) { e.example = example; e.exampleN = weight; }
        var dep = clean(r.departamento, 60);
        if (dep && e.departments.indexOf(dep) === -1) e.departments.push(dep);
        var last = String(r.ultima || '').slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(last) && last > e.last) e.last = last;
        if (e.needs.indexOf(g.id) === -1) e.needs.push(g.id);
      });
    });
    var list = Object.keys(byNit).map(function (k) {
      var e = byNit[k];
      delete e.seen;
      delete e.exampleN;
      e.departments.sort();
      e.reach = e.departments.length >= NATIONAL_MIN_DEPARTMENTS ? 'national' : (e.departments.length === 2 ? 'regional' : 'local');
      e.inBuyerRegion = !!o.region && e.departments.some(function (d) { return sameRegion(d, o.region); });
      return e;
    });
    list.sort(function (a, b) {
      return (b.needs.length - a.needs.length) || (Number(b.exact) - Number(a.exact)) || (b.departments.length - a.departments.length) ||
        (b.contracts - a.contracts) || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0);
    });
    // Keep room for both kinds: the best companies and the best individuals.
    var max = o.max || 40;
    var companies = list.filter(function (e) { return e.personType === 'company'; }).slice(0, max);
    var people = list.filter(function (e) { return e.personType === 'person'; }).slice(0, max);
    var keep = companies.slice(0, Math.max(max - people.length, Math.ceil(max / 2))).concat(people.slice(0, Math.max(max - companies.length, Math.floor(max / 2))));
    return list.filter(function (e) { return keep.indexOf(e) !== -1; });
  }

  /** A contract description as a short example: "Suministro de papelería, útiles de oficina…". */
  function describe(text) {
    var t = clean(text, 400).replace(/\s*;\s*/g, ', ').replace(/\s+,/g, ',')
      // Internal codes at the start: "AO-00-1009 - ", "54_9537_617 ", "RP09 - ", "TG ".
      .replace(/^(([A-Za-z]{0,4}[-_]?\d[\w-]*|(?!(?:EL|LA|LO|LOS|LAS|DEL|AL|UN|UNA|EN|DE|SE|SU|SUS|CON|POR|QUE|PARA)\b)[A-Z]{2,3})\s*[-:.]?\s+)+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ]{4})/, '');
    if (!t || /^item\b/i.test(t)) return '';
    t = t.toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.length > 140 ? t.slice(0, 139).replace(/[\s,.;:]+\S*$/, '') + '…' : t;
  }

  function fold(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** "Distrito Capital de Bogotá" vs "Bogotá, D.C.": same region for the buyer. */
  function sameRegion(department, region) {
    var a = fold(department), b = fold(region);
    if (!a || !b) return false;
    if (/bogota/.test(a) && /bogota/.test(b)) return true;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  /** "BOGOTÁ" + "Distrito Capital de Bogotá" -> "Bogotá"; "CALI" + "Valle del Cauca" -> "Cali, Valle del Cauca". */
  function placeName(town, department) {
    var t = titleCase(town), d = titleCase(department);
    if (/bogota/.test(fold(d))) d = 'Bogotá';
    if (!t) return d;
    return d && fold(d).indexOf(fold(t)) === -1 ? t + ', ' + d : t;
  }

  /** Attach public contact details (phone, email, website, city) to entries. */
  function attachContacts(entries, rows) {
    var byNit = {};
    (rows || []).forEach(function (r) {
      var digits = String(r.nit || '').replace(/\D/g, '');
      if (!digits) return;
      // The registry stores the number with or without its check digit.
      var keys = [digits];
      if (digits.length >= 6 && checkDigit(digits.slice(0, -1)) === digits.slice(-1)) keys.push(digits.slice(0, -1));
      var nit = keys.filter(function (k) { return !byNit[k]; })[0];
      if (!nit) return;
      var email = provided(r.correo).toLowerCase();
      var web = provided(r.sitio_web).toLowerCase().replace(/^https?:\/\//, '');
      byNit[nit] = {
        phone: colombianPhone(provided(r.telefono), r.departamento),
        email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) ? email : '',
        website: /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(web) && !NOT_A_SITE.test(web) ? 'https://' + web : '',
        city: placeName(provided(r.municipio), provided(r.departamento)),
        active: provided(r.esta_activa) !== 'No'
      };
      keys.forEach(function (k) { if (!byNit[k]) byNit[k] = byNit[nit]; });
    });
    (entries || []).forEach(function (e) { e.contacts = byNit[e.doc || e.nit] || null; });
    return entries;
  }

  var api = {
    HOST: HOST,
    CONTRACTS: CONTRACTS,
    REGISTERED: REGISTERED,
    NATIONAL_MIN_DEPARTMENTS: NATIONAL_MIN_DEPARTMENTS,
    TERMS: TERMS,
    typedQuery: typedQuery,
    describe: describe,
    searchTerms: searchTerms,
    contractsUrl: contractsUrl,
    contactsUrl: contactsUrl,
    aggregate: aggregate,
    attachContacts: attachContacts,
    sameRegion: sameRegion,
    titleCase: titleCase,
    companyNit: companyNit,
    personDoc: personDoc,
    classify: classify,
    personKey: personKey,
    checkDigit: checkDigit,
    colombianPhone: colombianPhone
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutSecop = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
