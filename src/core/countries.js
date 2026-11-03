/**
 * Supplier Scout — country profiles.
 *
 * Everything that changes from one country to another lives here: currency,
 * default sales tax, the name and check-digit rules of the business tax ID,
 * the phone calling code and small market conventions. Adding a country means
 * adding one object; nothing else in the code is country-specific.
 *
 * Tax rates are defaults for comparing quotes, editable in the app. They are
 * not tax advice.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  function digitsOnly(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  // ---------- tax ID validators ----------
  // Each returns { valid: true | false | null, checked: 'checksum' | 'format' | 'none', normalized }.
  // valid === null means "cannot tell" (no check digit given, or no rule for this country).

  /** Colombia, NIT: DIAN weights 3,7,13,...,71 applied right to left; mod 11. */
  function nitCheckDigit(base) {
    var weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    var digits = base.split('').reverse();
    var sum = 0;
    for (var i = 0; i < digits.length; i++) sum += Number(digits[i]) * weights[i];
    var rest = sum % 11;
    return rest > 1 ? 11 - rest : rest;
  }

  function validateNit(raw) {
    var text = String(raw || '').trim();
    var match = /^([\d.\s]{6,15})(?:\s*-\s*(\d))?$/.exec(text);
    if (!match) return { valid: false, checked: 'format', normalized: digitsOnly(text) };
    var base = digitsOnly(match[1]);
    if (base.length < 6 || base.length > 10) return { valid: false, checked: 'format', normalized: base };
    var expected = nitCheckDigit(base);
    if (match[2] === undefined) {
      return { valid: null, checked: 'checksum', normalized: base, expectedCheckDigit: expected };
    }
    return {
      valid: Number(match[2]) === expected,
      checked: 'checksum',
      normalized: base + '-' + match[2],
      expectedCheckDigit: expected
    };
  }

  /** Chile, RUT: weights 2..7 cycling from the right; 11 -> 0, 10 -> K. */
  function validateRut(raw) {
    var text = String(raw || '').toUpperCase().replace(/[.\s]/g, '');
    var match = /^(\d{7,8})-?([\dK])$/.exec(text);
    if (!match) return { valid: false, checked: 'format', normalized: text };
    var sum = 0;
    var factor = 2;
    match[1].split('').reverse().forEach(function (d) {
      sum += Number(d) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    });
    var rest = 11 - (sum % 11);
    var expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);
    return { valid: expected === match[2], checked: 'checksum', normalized: match[1] + '-' + match[2] };
  }

  function weightedMod11(digits, weights) {
    var sum = 0;
    for (var i = 0; i < weights.length; i++) sum += Number(digits[i]) * weights[i];
    return sum % 11;
  }

  /** Argentina, CUIT/CUIL: 11 digits, weights 5432765432. */
  function validateCuit(raw) {
    var digits = digitsOnly(raw);
    if (digits.length !== 11) return { valid: false, checked: 'format', normalized: digits };
    var rest = 11 - weightedMod11(digits, [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]);
    var expected = rest === 11 ? 0 : rest; // 10 never appears in a valid CUIT
    return {
      valid: rest !== 10 && expected === Number(digits[10]),
      checked: 'checksum',
      normalized: digits.slice(0, 2) + '-' + digits.slice(2, 10) + '-' + digits[10]
    };
  }

  /** Peru, RUC: 11 digits, same weights as CUIT; 10 -> 0, 11 -> 1. */
  function validateRuc(raw) {
    var digits = digitsOnly(raw);
    if (digits.length !== 11 || !/^(10|15|16|17|20)/.test(digits)) {
      return { valid: false, checked: 'format', normalized: digits };
    }
    var rest = 11 - weightedMod11(digits, [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]);
    var expected = rest === 10 ? 0 : rest === 11 ? 1 : rest;
    return { valid: expected === Number(digits[10]), checked: 'checksum', normalized: digits };
  }

  /**
   * Brazil, CNPJ: two check digits, mod 11. Since July 2026 new CNPJs may carry
   * letters in the first 12 positions; each character counts as its ASCII code
   * minus 48 (Receita Federal's rule; "12.ABC.345/01DE-35" is valid).
   */
  function validateCnpj(raw) {
    var text = String(raw || '').toUpperCase().replace(/[.\/\-\s]/g, '');
    if (!/^[A-Z0-9]{12}\d{2}$/.test(text) || /^(.)\1+$/.test(text)) {
      return { valid: false, checked: 'format', normalized: text };
    }
    function dv(slice, weights) {
      var sum = 0;
      for (var i = 0; i < weights.length; i++) sum += (slice.charCodeAt(i) - 48) * weights[i];
      var rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    }
    var first = dv(text, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    var second = dv(text, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return {
      valid: first === Number(text[12]) && second === Number(text[13]),
      checked: 'checksum',
      normalized: text
    };
  }

  /** Ecuador: cédula (10 digits, mod 10) and RUC (13 digits; private companies and public entities use mod 11). */
  function ecuadorCedulaOk(d) {
    var province = Number(d.slice(0, 2));
    if (!((province >= 1 && province <= 24) || province === 30) || Number(d[2]) >= 6) return false;
    var sum = 0;
    for (var i = 0; i < 9; i++) {
      var p = Number(d[i]) * (i % 2 === 0 ? 2 : 1);
      sum += p > 9 ? p - 9 : p;
    }
    return (10 - (sum % 10)) % 10 === Number(d[9]);
  }

  function validateEcuador(raw) {
    var d = digitsOnly(raw);
    if (d.length === 10) return { valid: ecuadorCedulaOk(d), checked: 'checksum', normalized: d };
    if (d.length !== 13) return { valid: false, checked: 'format', normalized: d };
    var third = Number(d[2]);
    var valid = false;
    if (third < 6) {
      valid = ecuadorCedulaOk(d.slice(0, 10)) && d.slice(10) !== '000';
    } else if (third === 9) { // private company: weights 4,3,2,7,6,5,4,3,2 -> 10th digit
      var r9 = weightedMod11(d, [4, 3, 2, 7, 6, 5, 4, 3, 2]);
      var dv9 = r9 === 0 ? 0 : 11 - r9;
      valid = dv9 < 10 && dv9 === Number(d[9]) && d.slice(10) !== '000';
    } else if (third === 6) { // public entity: weights 3,2,7,6,5,4,3,2 -> 9th digit
      var r6 = weightedMod11(d, [3, 2, 7, 6, 5, 4, 3, 2]);
      var dv6 = r6 === 0 ? 0 : 11 - r6;
      valid = dv6 < 10 && dv6 === Number(d[8]) && d.slice(9) !== '0000';
    }
    return { valid: valid, checked: 'checksum', normalized: d };
  }

  /** Uruguay, RUT: 12 digits, weights 4,3,2,9,8,7,6,5,4,3,2; a result of 10 is never valid. */
  function validateUruguay(raw) {
    var d = digitsOnly(raw);
    var dept = Number(d.slice(0, 2));
    if (d.length !== 12 || dept < 1 || dept > 21 || d.slice(2, 8) === '000000' || d.slice(8, 10) !== '00') {
      return { valid: false, checked: 'format', normalized: d };
    }
    var rest = weightedMod11(d, [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    var dv = rest === 0 ? 0 : 11 - rest;
    return { valid: dv < 10 && dv === Number(d[11]), checked: 'checksum', normalized: d };
  }

  /** Paraguay, RUC: SET/DNIT "base 11" weights 2..11 cycling from the right. Without "-DV" we cannot tell. */
  function paraguayDv(base) {
    var sum = 0;
    var k = 2;
    for (var i = base.length - 1; i >= 0; i--) {
      if (k > 11) k = 2;
      sum += Number(base[i]) * k;
      k++;
    }
    var rest = sum % 11;
    return rest > 1 ? 11 - rest : 0;
  }

  function validateParaguay(raw) {
    var text = String(raw || '').trim();
    var match = /^(\d{3,9})(?:\s*-\s*(\d))?$/.exec(text.replace(/[.\s](?=\d)/g, ''));
    if (!match) return { valid: false, checked: 'format', normalized: digitsOnly(text) };
    var expected = paraguayDv(match[1]);
    if (match[2] === undefined) return { valid: null, checked: 'checksum', normalized: match[1], expectedCheckDigit: expected };
    return { valid: expected === Number(match[2]), checked: 'checksum', normalized: match[1] + '-' + match[2], expectedCheckDigit: expected };
  }

  /** Guatemala, NIT: weights grow from 2 at the right; 10 is written "K". The last character is the check digit. */
  function validateGuatemala(raw) {
    var text = String(raw || '').toUpperCase().replace(/[\s.]/g, '');
    var match = /^(\d{1,12})-?([\dK])$/.exec(text);
    if (!match) return { valid: false, checked: 'format', normalized: text };
    var base = match[1];
    var sum = 0;
    for (var i = 0; i < base.length; i++) sum += Number(base[i]) * (base.length + 1 - i);
    var value = (11 - (sum % 11)) % 11;
    var expected = value === 10 ? 'K' : String(value);
    return { valid: expected === match[2], checked: 'checksum', normalized: base + '-' + match[2] };
  }

  /** Luhn (mod 10), used by France's SIREN/SIRET and the Dominican cédula. */
  function luhnOk(d) {
    var sum = 0;
    for (var i = 0; i < d.length; i++) {
      var n = Number(d[d.length - 1 - i]);
      if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }

  /** Dominican Republic: RNC (9 digits, weights 7,9,8,6,5,4,3,2) or cédula (11 digits, Luhn). */
  function validateDominican(raw) {
    var d = digitsOnly(raw);
    if (d.length === 11) return { valid: luhnOk(d), checked: 'checksum', normalized: d };
    if (d.length !== 9) return { valid: false, checked: 'format', normalized: d };
    var rest = weightedMod11(d, [7, 9, 8, 6, 5, 4, 3, 2]);
    var expected = rest === 0 ? 2 : rest === 1 ? 1 : 11 - rest;
    return { valid: expected === Number(d[8]), checked: 'checksum', normalized: d };
  }

  /** Portugal, NIF/NIPC: 9 digits, weights 9..2, mod 11 (10 and 11 become 0). */
  function validatePortugal(raw) {
    var d = digitsOnly(raw);
    if (d.length !== 9 || d[0] === '0') return { valid: false, checked: 'format', normalized: d };
    var rest = weightedMod11(d, [9, 8, 7, 6, 5, 4, 3, 2]);
    var expected = rest < 2 ? 0 : 11 - rest;
    return { valid: expected === Number(d[8]), checked: 'checksum', normalized: d };
  }

  /** France, SIREN (9 digits) or SIRET (14): Luhn; La Poste's SIRETs use a digit sum divisible by 5. */
  function validateFrance(raw) {
    var d = digitsOnly(raw);
    if (d.length !== 9 && d.length !== 14) return { valid: false, checked: 'format', normalized: d };
    var laPoste = d.length === 14 && d.indexOf('356000000') === 0;
    var valid = laPoste ? d.split('').reduce(function (a, c) { return a + Number(c); }, 0) % 5 === 0 : luhnOk(d);
    return { valid: valid, checked: 'checksum', normalized: d };
  }

  function formatValidator(pattern, clean) {
    var fn = function (raw) {
      var text = clean(String(raw || ''));
      return { valid: pattern.test(text), checked: 'format', normalized: text };
    };
    fn.formatOnly = true;
    return fn;
  }

  var upperNoSpaces = function (text) { return text.toUpperCase().replace(/[\s-]/g, ''); };

  /** Mexico, RFC (format only; the homoclave check digit is not verified). */
  var validateRfc = formatValidator(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, upperNoSpaces);
  /** United States, EIN (format only). */
  var validateEin = formatValidator(/^\d{9}$/, function (t) { return digitsOnly(t); });
  /**
   * Spain, NIF. People (DNI, and NIE with X/Y/Z = 0/1/2): 8 digits + letter from mod 23.
   * Companies (old CIF, still the NIF): letter + 7 digits + control; digits in odd places are doubled
   * (digit sum), the control is 10 - total mod 10, written as a digit or as the letter JABCDEFGHI.
   */
  var DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
  function validateNif(raw) {
    var text = upperNoSpaces(String(raw || ''));
    var person = /^([XYZ]|\d)(\d{7})([A-Z])$/.exec(text);
    if (person) {
      var lead = 'XYZ'.indexOf(person[1]);
      var number = Number((lead === -1 ? person[1] : String(lead)) + person[2]);
      return { valid: DNI_LETTERS[number % 23] === person[3], checked: 'checksum', normalized: text };
    }
    var company = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(text);
    if (!company) return { valid: false, checked: 'format', normalized: text };
    var sum = 0;
    company[2].split('').forEach(function (c, i) {
      var n = Number(c);
      if (i % 2 === 0) { n *= 2; n = Math.floor(n / 10) + (n % 10); }
      sum += n;
    });
    var control = (10 - (sum % 10)) % 10;
    var mustBeLetter = 'NPQRSW'.indexOf(company[1]) !== -1;
    var mustBeDigit = 'ABEH'.indexOf(company[1]) !== -1;
    var asDigit = company[3] === String(control);
    var asLetter = company[3] === 'JABCDEFGHI'[control];
    var valid = mustBeLetter ? asLetter : mustBeDigit ? asDigit : asDigit || asLetter;
    return { valid: valid, checked: 'checksum', normalized: text };
  }
  // Format only: the check-digit rules of these IDs were not verified against official examples.
  /** Venezuela, RIF: V, E, J, P, G or C + 8 digits + check digit. */
  var validateRif = formatValidator(/^[VEJPGC]\d{9}$/, upperNoSpaces);
  /** Bolivia, NIT. */
  var validateBolivia = formatValidator(/^\d{5,12}$/, function (t) { return digitsOnly(t); });
  /** Costa Rica: cédula física (9), jurídica (10) or DIMEX (11-12). */
  var validateCostaRica = formatValidator(/^\d{9,12}$/, function (t) { return digitsOnly(t); });
  /** Panamá, RUC: several shapes ("8-123-456", "155612345-2-2015"). */
  var validatePanama = formatValidator(/^(?=.*\d)[0-9A-Z]{1,12}(-[0-9A-Z]{1,10}){1,3}$/, function (t) { return t.toUpperCase().replace(/\s|DV.*$/g, ''); });
  /** Honduras, RTN: 14 digits. */
  var validateHonduras = formatValidator(/^\d{14}$/, function (t) { return digitsOnly(t); });
  /** El Salvador: NIT (14 digits) or DUI used as NIT (9 digits). */
  var validateSalvador = formatValidator(/^(\d{14}|\d{9})$/, function (t) { return digitsOnly(t); });
  /** Nicaragua, RUC: a letter or digit followed by 13 characters (e.g. J0310000000123). */
  var validateNicaragua = formatValidator(/^[A-Z0-9]\d{12}[A-Z0-9]$/, upperNoSpaces);

  function noValidator(raw) {
    return { valid: null, checked: 'none', normalized: String(raw || '').trim() };
  }

  // ---------- profiles ----------

  // name, currency, default sales tax (editable in the app), tax ID and its checker,
  // phone calling code and national number lengths, commercial weights that vary by
  // country, the interface language, and where to look for suppliers offline.
  function profile(code, name, o) {
    return {
      code: code, name: name, currency: o.currency, locale: o.locale, language: o.language || 'es',
      vatRate: o.vatRate, vatName: o.vatName, taxIdName: o.taxIdName, taxIdLabels: o.taxIdLabels,
      validateTaxId: o.validate || noValidator, taxIdCheck: !o.validate ? 'none' : o.validate.formatOnly ? 'format' : 'checksum',
      callingCode: o.callingCode || '', nationalLengths: o.nationalLengths || [],
      poundKg: o.poundKg || 0.453592, arrobaKg: o.arrobaKg || 11.5, quintalKg: o.quintalKg || 45.36,
      dataLaw: o.dataLaw || null, procurement: o.procurement || [], businessRegistry: o.businessRegistry || [],
      registries: o.registries || [], localPhone: o.localPhone || null, sampleCity: o.sampleCity || ''
    };
  }

  // Local dialling habits that a plain "add the calling code" rule gets wrong.
  function argentinaMobile(d) {
    // "011 15-1234-5678": area code (2-4 digits) + "15" + number -> +54 9 area number
    var n = d.replace(/^0/, '');
    // "15 1234 5678" with no area code cannot be dialled from outside: refuse rather than guess the city
    if (n.length === 10 && /^15/.test(n)) return false;
    if (n.length !== 12) return null;
    for (var len = 2; len <= 4; len++) {
      if (n.substr(len, 2) === '15') return '+549' + n.slice(0, len) + n.slice(len + 2);
    }
    return null;
  }
  function mexicoLegacy(d) {
    // "044 55 1234 5678" / "045 ..." (old mobile prefixes) and "01 55 ..." (old long distance)
    if (d.length === 13 && /^04[45]/.test(d)) return '+52' + d.slice(3);
    if (d.length === 12 && /^01/.test(d)) return '+52' + d.slice(2);
    return null;
  }
  function colombiaLegacy(d) {
    // Since 2021 landlines are "60" + area + number: "(1) 555 1234" is now 601 555 1234.
    return d.length === 8 && /^[124-8]/.test(d) ? '+5760' + d : null;
  }
  function brazilCarrier(d) {
    // "0 21 11 98765-4321": trunk 0 + long-distance carrier code + area + number
    if (d[0] !== '0') return null;
    var n = d.slice(1);
    return n.length === 12 || n.length === 13 ? '+55' + n.slice(2) : null;
  }

  var PROFILES = {
    CO: profile('CO', { es: 'Colombia', en: 'Colombia', pt: 'Colômbia', fr: 'Colombie' }, {
      currency: 'COP', locale: 'es-CO', vatRate: 0.19, vatName: 'IVA', taxIdName: 'NIT', taxIdLabels: ['NIT', 'N.I.T'],
      validate: validateNit, callingCode: '57', nationalLengths: [10], localPhone: colombiaLegacy,
      poundKg: 0.5, arrobaKg: 12.5, quintalKg: 50, // "una libra" in Colombian markets is 500 g
      dataLaw: 'Ley 1581 de 2012', procurement: ['SECOP II'], businessRegistry: ['RUES'], registries: ['secop-co'], sampleCity: 'Bogotá'
    }),
    MX: profile('MX', { es: 'México', en: 'Mexico', pt: 'México', fr: 'Mexique' }, {
      currency: 'MXN', locale: 'es-MX', vatRate: 0.16, vatName: 'IVA', taxIdName: 'RFC', taxIdLabels: ['RFC'],
      validate: validateRfc, callingCode: '52', nationalLengths: [10], localPhone: mexicoLegacy, quintalKg: 46,
      dataLaw: 'LFPDPPP', procurement: ['ComprasMX'], businessRegistry: ['SIEM'], sampleCity: 'Ciudad de México'
    }),
    GT: profile('GT', { es: 'Guatemala', en: 'Guatemala', pt: 'Guatemala', fr: 'Guatemala' }, {
      currency: 'GTQ', locale: 'es-GT', vatRate: 0.12, vatName: 'IVA', taxIdName: 'NIT', taxIdLabels: ['NIT'],
      validate: validateGuatemala, callingCode: '502', nationalLengths: [8],
      procurement: ['Guatecompras'], businessRegistry: ['Registro Mercantil', 'SAT'], sampleCity: 'Ciudad de Guatemala'
    }),
    SV: profile('SV', { es: 'El Salvador', en: 'El Salvador', pt: 'El Salvador', fr: 'Salvador' }, {
      currency: 'USD', locale: 'es-SV', vatRate: 0.13, vatName: 'IVA', taxIdName: 'NIT', taxIdLabels: ['NIT', 'NRC'],
      validate: validateSalvador, callingCode: '503', nationalLengths: [8],
      procurement: ['COMPRASAL'], businessRegistry: ['CNR'], sampleCity: 'San Salvador'
    }),
    HN: profile('HN', { es: 'Honduras', en: 'Honduras', pt: 'Honduras', fr: 'Honduras' }, {
      currency: 'HNL', locale: 'es-HN', vatRate: 0.15, vatName: 'ISV', taxIdName: 'RTN', taxIdLabels: ['RTN'],
      validate: validateHonduras, callingCode: '504', nationalLengths: [8],
      procurement: ['HonduCompras'], businessRegistry: ['Registro Mercantil'], sampleCity: 'Tegucigalpa'
    }),
    NI: profile('NI', { es: 'Nicaragua', en: 'Nicaragua', pt: 'Nicarágua', fr: 'Nicaragua' }, {
      currency: 'NIO', locale: 'es-NI', vatRate: 0.15, vatName: 'IVA', taxIdName: 'RUC', taxIdLabels: ['RUC'],
      validate: validateNicaragua, callingCode: '505', nationalLengths: [8],
      dataLaw: 'Ley 787', procurement: ['SISCAE'], businessRegistry: ['Registro Público Mercantil'], sampleCity: 'Managua'
    }),
    CR: profile('CR', { es: 'Costa Rica', en: 'Costa Rica', pt: 'Costa Rica', fr: 'Costa Rica' }, {
      currency: 'CRC', locale: 'es-CR', vatRate: 0.13, vatName: 'IVA', taxIdName: 'Cédula jurídica',
      taxIdLabels: ['CEDULA JURIDICA', 'CÉDULA JURÍDICA', 'CED JUR'], validate: validateCostaRica, callingCode: '506', nationalLengths: [8],
      dataLaw: 'Ley 8968', procurement: ['SICOP'], businessRegistry: ['Registro Nacional'], sampleCity: 'San José'
    }),
    PA: profile('PA', { es: 'Panamá', en: 'Panama', pt: 'Panamá', fr: 'Panama' }, {
      currency: 'USD', locale: 'es-PA', vatRate: 0.07, vatName: 'ITBMS', taxIdName: 'RUC', taxIdLabels: ['RUC'],
      validate: validatePanama, callingCode: '507', nationalLengths: [8, 7],
      dataLaw: 'Ley 81 de 2019', procurement: ['PanamaCompra'], businessRegistry: ['Registro Público'], sampleCity: 'Ciudad de Panamá'
    }),
    DO: profile('DO', { es: 'República Dominicana', en: 'Dominican Republic', pt: 'República Dominicana', fr: 'République dominicaine' }, {
      currency: 'DOP', locale: 'es-DO', vatRate: 0.18, vatName: 'ITBIS', taxIdName: 'RNC', taxIdLabels: ['RNC'],
      validate: validateDominican, callingCode: '1', nationalLengths: [10],
      dataLaw: 'Ley 172-13', procurement: ['Portal Transaccional (DGCP)'], businessRegistry: ['DGII (consulta RNC)'], sampleCity: 'Santo Domingo'
    }),
    VE: profile('VE', { es: 'Venezuela', en: 'Venezuela', pt: 'Venezuela', fr: 'Venezuela' }, {
      currency: 'VES', locale: 'es-VE', vatRate: 0.16, vatName: 'IVA', taxIdName: 'RIF', taxIdLabels: ['RIF'],
      validate: validateRif, callingCode: '58', nationalLengths: [10],
      procurement: ['RNC (Registro Nacional de Contratistas)'], businessRegistry: ['SENIAT (consulta RIF)'], sampleCity: 'Caracas'
    }),
    EC: profile('EC', { es: 'Ecuador', en: 'Ecuador', pt: 'Equador', fr: 'Équateur' }, {
      currency: 'USD', locale: 'es-EC', vatRate: 0.15, vatName: 'IVA', taxIdName: 'RUC', taxIdLabels: ['RUC'],
      validate: validateEcuador, callingCode: '593', nationalLengths: [9, 8],
      dataLaw: 'LOPDP', procurement: ['SERCOP (Compras Públicas)'], businessRegistry: ['SRI (consulta RUC)', 'Superintendencia de Compañías'], sampleCity: 'Quito'
    }),
    PE: profile('PE', { es: 'Perú', en: 'Peru', pt: 'Peru', fr: 'Pérou' }, {
      currency: 'PEN', locale: 'es-PE', vatRate: 0.18, vatName: 'IGV', taxIdName: 'RUC', taxIdLabels: ['RUC'],
      validate: validateRuc, callingCode: '51', nationalLengths: [9, 8],
      dataLaw: 'Ley 29733', procurement: ['SEACE', 'RNP'], businessRegistry: ['SUNAT (consulta RUC)'], sampleCity: 'Lima'
    }),
    BO: profile('BO', { es: 'Bolivia', en: 'Bolivia', pt: 'Bolívia', fr: 'Bolivie' }, {
      currency: 'BOB', locale: 'es-BO', vatRate: 0.13, vatName: 'IVA', taxIdName: 'NIT', taxIdLabels: ['NIT'],
      validate: validateBolivia, callingCode: '591', nationalLengths: [8],
      procurement: ['SICOES'], businessRegistry: ['SEPREC'], sampleCity: 'La Paz'
    }),
    CL: profile('CL', { es: 'Chile', en: 'Chile', pt: 'Chile', fr: 'Chili' }, {
      currency: 'CLP', locale: 'es-CL', vatRate: 0.19, vatName: 'IVA', taxIdName: 'RUT', taxIdLabels: ['RUT'],
      validate: validateRut, callingCode: '56', nationalLengths: [9],
      dataLaw: 'Ley 19.628', procurement: ['Mercado Público (ChileCompra)'], businessRegistry: ['SII', 'Registro de Empresas y Sociedades'], sampleCity: 'Santiago'
    }),
    AR: profile('AR', { es: 'Argentina', en: 'Argentina', pt: 'Argentina', fr: 'Argentine' }, {
      currency: 'ARS', locale: 'es-AR', vatRate: 0.21, vatName: 'IVA', taxIdName: 'CUIT', taxIdLabels: ['CUIT', 'CUIL'],
      validate: validateCuit, callingCode: '54', nationalLengths: [10, 11], localPhone: argentinaMobile,
      dataLaw: 'Ley 25.326', procurement: ['COMPR.AR'], businessRegistry: ['ARCA (ex AFIP)'], sampleCity: 'Buenos Aires'
    }),
    PY: profile('PY', { es: 'Paraguay', en: 'Paraguay', pt: 'Paraguai', fr: 'Paraguay' }, {
      currency: 'PYG', locale: 'es-PY', vatRate: 0.10, vatName: 'IVA', taxIdName: 'RUC', taxIdLabels: ['RUC'],
      validate: validateParaguay, callingCode: '595', nationalLengths: [9, 8],
      procurement: ['DNCP'], businessRegistry: ['DNIT (consulta RUC)'], sampleCity: 'Asunción'
    }),
    UY: profile('UY', { es: 'Uruguay', en: 'Uruguay', pt: 'Uruguai', fr: 'Uruguay' }, {
      currency: 'UYU', locale: 'es-UY', vatRate: 0.22, vatName: 'IVA', taxIdName: 'RUT', taxIdLabels: ['RUT'],
      validate: validateUruguay, callingCode: '598', nationalLengths: [8],
      dataLaw: 'Ley 18.331', procurement: ['ARCE', 'RUPE'], businessRegistry: ['DGI'], sampleCity: 'Montevideo'
    }),
    PR: profile('PR', { es: 'Puerto Rico', en: 'Puerto Rico', pt: 'Porto Rico', fr: 'Porto Rico' }, {
      currency: 'USD', locale: 'es-PR', vatRate: 0.115, vatName: 'IVU', taxIdName: 'EIN', taxIdLabels: ['EIN'],
      validate: validateEin, callingCode: '1', nationalLengths: [10],
      businessRegistry: ['Registro de Corporaciones'], sampleCity: 'San Juan'
    }),
    BR: profile('BR', { es: 'Brasil', en: 'Brazil', pt: 'Brasil', fr: 'Brésil' }, {
      currency: 'BRL', locale: 'pt-BR', language: 'pt', vatRate: 0, vatName: 'Impostos', taxIdName: 'CNPJ', taxIdLabels: ['CNPJ'],
      validate: validateCnpj, callingCode: '55', nationalLengths: [10, 11], localPhone: brazilCarrier, arrobaKg: 15,
      dataLaw: 'LGPD', procurement: ['PNCP', 'Compras.gov.br'], businessRegistry: ['Receita Federal (dados abertos CNPJ)'], sampleCity: 'São Paulo'
    }),
    US: profile('US', { es: 'Estados Unidos', en: 'United States', pt: 'Estados Unidos', fr: 'États-Unis' }, {
      currency: 'USD', locale: 'en-US', language: 'en', vatRate: 0, vatName: 'Sales tax', taxIdName: 'EIN', taxIdLabels: ['EIN'],
      validate: validateEin, callingCode: '1', nationalLengths: [10],
      procurement: ['SAM.gov'], businessRegistry: ['OpenCorporates'], sampleCity: 'Miami'
    }),
    ES: profile('ES', { es: 'España', en: 'Spain', pt: 'Espanha', fr: 'Espagne' }, {
      currency: 'EUR', locale: 'es-ES', vatRate: 0.21, vatName: 'IVA', taxIdName: 'NIF', taxIdLabels: ['NIF', 'CIF'],
      validate: validateNif, callingCode: '34', nationalLengths: [9],
      dataLaw: 'RGPD', procurement: ['Plataforma de Contratación del Sector Público'], businessRegistry: ['Registro Mercantil'], sampleCity: 'Madrid'
    }),
    PT: profile('PT', { es: 'Portugal', en: 'Portugal', pt: 'Portugal', fr: 'Portugal' }, {
      currency: 'EUR', locale: 'pt-PT', language: 'pt', vatRate: 0.23, vatName: 'IVA', taxIdName: 'NIF', taxIdLabels: ['NIF', 'NIPC', 'CONTRIBUINTE'],
      validate: validatePortugal, callingCode: '351', nationalLengths: [9],
      dataLaw: 'RGPD', procurement: ['Portal BASE'], businessRegistry: ['Registo Comercial'], sampleCity: 'Lisboa'
    }),
    FR: profile('FR', { es: 'Francia', en: 'France', pt: 'França', fr: 'France' }, {
      currency: 'EUR', locale: 'fr-FR', language: 'fr', vatRate: 0.20, vatName: 'TVA', taxIdName: 'SIREN', taxIdLabels: ['SIREN', 'SIRET'],
      validate: validateFrance, callingCode: '33', nationalLengths: [9],
      dataLaw: 'RGPD', procurement: ['BOAMP', 'PLACE'], businessRegistry: ['Annuaire des entreprises (SIRENE)'], sampleCity: 'Paris'
    }),
    XX: profile('XX', { es: 'Otro país', en: 'Other country', pt: 'Outro país', fr: 'Autre pays' }, {
      currency: 'USD', locale: 'en-US', language: 'en', vatRate: 0, vatName: 'Tax', taxIdName: 'Tax ID', taxIdLabels: ['TAX ID', 'VAT']
    })
  };

  function getProfile(code) {
    return PROFILES[String(code || '').toUpperCase()] || PROFILES.XX;
  }

  function cleanLabel(label) {
    return String(label || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Every country whose tax ID uses this label ("RUC" -> PE, EC, PY, PA, NI). */
  function countriesForTaxLabel(label) {
    var clean = cleanLabel(label);
    return Object.keys(PROFILES).filter(function (code) {
      return PROFILES[code].taxIdLabels.some(function (l) { return cleanLabel(l) === clean; });
    });
  }

  /** The first country for a label ("RFC" -> MX), or null. */
  function countryForTaxLabel(label) {
    return countriesForTaxLabel(label)[0] || null;
  }

  /** Old international forms that still circulate: +52 1 (Mexican mobiles), +57 + 8 digits (old Colombian landlines). */
  function fixInternational(digits) {
    if (/^521\d{10}$/.test(digits)) return '52' + digits.slice(3);
    if (/^57[124-8]\d{7}$/.test(digits)) return '5760' + digits.slice(2);
    return digits;
  }

  /**
   * Best-effort E.164 phone number ("+573000000001"), or null when the digits
   * cannot be a phone number for this country. Knows local habits such as
   * Argentina's "15", Mexico's old "044" and Colombia's pre-2021 landlines.
   */
  function normalizePhone(raw, countryCode) {
    var text = String(raw || '').trim();
    var profile = getProfile(countryCode);
    var digits = digitsOnly(text);
    if (/^(\+|00)/.test(text)) {
      if (text[0] !== '+') digits = digits.slice(2);
      digits = fixInternational(digits);
      return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
    }
    if (!profile.callingCode) return null;
    if (profile.localPhone) {
      var local = profile.localPhone(digits); // a number, null (not a local habit) or false (known to be incomplete)
      if (local === false) return null;
      if (local) return local;
    }
    var cc = profile.callingCode;
    for (var i = 0; i < profile.nationalLengths.length; i++) {
      var len = profile.nationalLengths[i];
      if (digits.length === cc.length + len && digits.indexOf(cc) === 0) return '+' + fixInternational(digits);
    }
    var national = digits.replace(/^0+/, ''); // trunk prefix
    if (profile.nationalLengths.indexOf(national.length) !== -1) return '+' + cc + national;
    return null;
  }

  /** Money in the profile's currency, e.g. "$ 18.500" for COP. */
  function formatMoney(amount, countryCode, currencyOverride) {
    var profile = getProfile(countryCode);
    var currency = currencyOverride || profile.currency;
    var noCents = ['COP', 'CLP', 'ARS', 'PYG'].indexOf(currency) !== -1;
    try {
      return new Intl.NumberFormat(profile.locale, {
        style: 'currency', currency: currency,
        maximumFractionDigits: noCents ? 0 : 2, minimumFractionDigits: noCents ? 0 : 2
      }).format(amount);
    } catch (err) {
      return currency + ' ' + Number(amount).toFixed(noCents ? 0 : 2);
    }
  }

  /**
   * Official portals where a buyer checks a supplier before registering it
   * (company registry, tax status, tax blacklists). Home pages only: deep links
   * to search forms change often, so the buyer searches by name or tax ID there.
   */
  var VERIFY = {
    CO: [['RUES', 'https://www.rues.org.co/'], ['DIAN', 'https://www.dian.gov.co/']],
    MX: [['SAT', 'https://www.sat.gob.mx/']],
    PE: [['SUNAT', 'https://www.sunat.gob.pe/']],
    CL: [['SII', 'https://www.sii.cl/']],
    AR: [['ARCA', 'https://www.afip.gob.ar/']],
    EC: [['SRI', 'https://www.sri.gob.ec/']],
    BR: [['Receita Federal', 'https://www.gov.br/receitafederal/']]
  };

  /** [{ name, url }] for a country, empty when none is known. */
  function verifyLinks(code) {
    return (VERIFY[code] || []).map(function (v) { return { name: v[0], url: v[1] }; });
  }

  var api = {
    PROFILES: PROFILES,
    verifyLinks: verifyLinks,
    getProfile: getProfile,
    countryForTaxLabel: countryForTaxLabel,
    countriesForTaxLabel: countriesForTaxLabel,
    normalizePhone: normalizePhone,
    formatMoney: formatMoney,
    digitsOnly: digitsOnly,
    validators: {
      nit: validateNit, rut: validateRut, cuit: validateCuit, ruc: validateRuc,
      cnpj: validateCnpj, rfc: validateRfc, ein: validateEin, nif: validateNif,
      ecuador: validateEcuador, uruguay: validateUruguay, paraguay: validateParaguay, guatemala: validateGuatemala,
      dominican: validateDominican, portugal: validatePortugal, france: validateFrance, rif: validateRif,
      bolivia: validateBolivia, costaRica: validateCostaRica, panama: validatePanama, honduras: validateHonduras,
      salvador: validateSalvador, nicaragua: validateNicaragua
    },
    luhnOk: luhnOk,
    nitCheckDigit: nitCheckDigit
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutCountries = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
