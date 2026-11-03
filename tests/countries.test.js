const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core/countries');

test('Colombia NIT: check digit is computed and verified', () => {
  const base = '999000123';
  const dv = C.nitCheckDigit(base);
  assert.equal(C.validators.nit(`999.000.123-${dv}`).valid, true);
  assert.equal(C.validators.nit(`999.000.123-${(dv + 1) % 10}`).valid, false);
  const noDv = C.validators.nit('999000123');
  assert.equal(noDv.valid, null, 'without a check digit we cannot tell');
  assert.equal(noDv.expectedCheckDigit, dv);
  assert.equal(C.validators.nit('12-34').valid, false);
});

test('Chile RUT, Argentina CUIT, Peru RUC and Brazil CNPJ checksums', () => {
  assert.equal(C.validators.rut('12.345.678-5').valid, true);
  assert.equal(C.validators.rut('12.345.678-4').valid, false);
  assert.equal(C.validators.cuit('20-12345678-6').valid, true);
  assert.equal(C.validators.cuit('20-12345678-5').valid, false);
  assert.equal(C.validators.ruc('20999000101').valid, true); // 5·2+4·0+3·9+2·9+7·9+6·0+5·0+4·0+3·1+2·0 = 121 -> 11 - 0 -> 1
  assert.equal(C.validators.ruc('20999000102').valid, false);
  assert.equal(C.validators.ruc('30999000105').valid, false, 'RUC must start with 10, 15, 16, 17 or 20');
  assert.equal(C.validators.cnpj('11.222.333/0001-81').valid, true);
  assert.equal(C.validators.cnpj('11.222.333/0001-82').valid, false);
  assert.equal(C.validators.cnpj('11.111.111/1111-11').valid, false, 'repeated digits are rejected');
});

test('format-only validators say so', () => {
  const rfc = C.validators.rfc('EAN990101AB1');
  assert.deepEqual([rfc.valid, rfc.checked], [true, 'format']);
  assert.equal(C.validators.rfc('EAN-9901').valid, false);
  assert.equal(C.getProfile('XX').validateTaxId('anything').valid, null);
});

test('unknown country codes fall back to the generic profile', () => {
  assert.equal(C.getProfile('ZZ').code, 'XX');
  assert.equal(C.getProfile('co').code, 'CO');
});

test('tax ID labels map to countries', () => {
  assert.equal(C.countryForTaxLabel('RFC'), 'MX');
  assert.equal(C.countryForTaxLabel('N.I.T'), 'CO');
  assert.equal(C.countryForTaxLabel('CUIL'), 'AR');
  assert.equal(C.countryForTaxLabel('XYZ'), null);
});

test('phones are normalised to E.164 per country', () => {
  assert.equal(C.normalizePhone('999 000 0001', 'CO'), '+579990000001');
  assert.equal(C.normalizePhone('(999) 000 0102', 'CO'), '+579990000102');
  assert.equal(C.normalizePhone('57 999 000 0001', 'CO'), '+579990000001');
  assert.equal(C.normalizePhone('+1 305 555 0142', 'CO'), '+13055550142', 'an explicit + wins over the country');
  assert.equal(C.normalizePhone('0034 912 000 000', 'CO'), '+34912000000');
  assert.equal(C.normalizePhone('55 0000 0201', 'MX'), '+525500000201');
  assert.equal(C.normalizePhone('12345', 'CO'), null);
  assert.equal(C.normalizePhone('9990000001', 'XX'), null, 'no calling code, no guess');
});

test('money is formatted with the local convention', () => {
  assert.match(C.formatMoney(1457750, 'CO'), /1\.457\.750/);
  assert.match(C.formatMoney(18.5, 'MX'), /18\.50/);
  assert.match(C.formatMoney(10, 'CO', 'USD'), /10,00/);
});

// Fictional numbers with correct check digits. The algorithms were checked against
// examples published by each tax authority; those real numbers are not kept here.
test('check digits across Latin America, Spain, Portugal and France', () => {
  const ok = (fn, value) => assert.deepEqual([C.validators[fn](value).valid, C.validators[fn](value).checked], [true, 'checksum'], `${fn} ${value}`);
  const bad = (fn, value) => assert.equal(C.validators[fn](value).valid, false, `${fn} ${value}`);
  ok('ecuador', '1799900013001'); bad('ecuador', '1799900014001'); // company RUC: weights 4,3,2,7,6,5,4,3,2
  ok('ecuador', '1760001040001'); bad('ecuador', '1760001050001'); // public entity RUC: weights 3,2,7,6,5,4,3,2
  ok('ecuador', '1719990002'); bad('ecuador', '1719990003'); // cédula: mod 10
  ok('guatemala', '9990001-7'); bad('guatemala', '9990001-8');
  ok('paraguay', '80999001-6'); bad('paraguay', '80999001-7');
  ok('dominican', '199900014'); bad('dominican', '199900015'); // RNC: weights 7,9,8,6,5,4,3,2
  ok('dominican', '00199900010'); bad('dominican', '00199900011'); // cédula: Luhn
  ok('uruguay', '219990000013'); bad('uruguay', '219990000014');
  ok('portugal', '509990002'); bad('portugal', '509990003');
  ok('france', '999000128'); bad('france', '999000129'); // SIREN: Luhn
  ok('france', '99900012800010'); bad('france', '99900012800011'); // SIRET
  ok('nif', '12345678Z'); bad('nif', '12345678A'); // DNI: mod 23 letter
  ok('nif', 'X1234567L'); // NIE: X = 0
  ok('nif', 'B99900011'); bad('nif', 'B99900012'); // company: 9·2→9, 9, 9·2→9, 0, 0, 0, 1·2 = 29 -> control 1
  ok('nif', 'P9990001A'); bad('nif', 'P99900011'); // public bodies write the control as a letter
});

test('Brazil: the alphanumeric CNPJ (from July 2026) validates like the numeric one', () => {
  assert.equal(C.validators.cnpj('12.ABC.345/01DE-35').valid, true, 'example published by the Receita Federal');
  assert.equal(C.validators.cnpj('12.ABC.345/01DE-36').valid, false);
  assert.equal(C.validators.cnpj('12ABC999000101').valid, true);
  assert.equal(C.validators.cnpj('12.abc.345/01de-35').normalized, '12ABC34501DE35');
});

test('where only the format can be checked, the result says so', () => {
  const formatOnly = { rif: 'J-99900001-0', bolivia: '99900010', costaRica: '3-101-999000', panama: '155599900-2-2020',
    honduras: '08019999000001', salvador: '0614-999999-999-9', nicaragua: 'J0310000999001' };
  for (const [fn, value] of Object.entries(formatOnly)) {
    assert.deepEqual([C.validators[fn](value).valid, C.validators[fn](value).checked], [true, 'format'], fn);
  }
});

test('every country profile is complete and consistent', () => {
  const codes = Object.keys(C.PROFILES);
  assert.ok(codes.length >= 24);
  for (const code of codes) {
    const p = C.PROFILES[code];
    assert.equal(p.code, code);
    for (const lang of ['es', 'en', 'pt', 'fr']) assert.ok(p.name[lang], `${code} name in ${lang}`);
    assert.match(p.currency, /^[A-Z]{3}$/, code);
    assert.ok(p.vatRate >= 0 && p.vatRate < 0.3, code);
    assert.ok(p.vatName && p.taxIdName && p.taxIdLabels.length, code);
    assert.equal(typeof p.validateTaxId, 'function', code);
    assert.ok(['es', 'en', 'pt', 'fr'].includes(p.language), code);
    assert.doesNotThrow(() => C.formatMoney(1234.5, code), code);
    if (code !== 'XX') {
      assert.match(p.callingCode, /^\d{1,3}$/, code);
      assert.ok(p.nationalLengths.length, code);
      assert.ok(p.procurement.length || p.businessRegistry.length, `${code} says where to look for suppliers`);
    }
  }
  const spanishSpeaking = ['MX', 'GT', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'DO', 'PR', 'CO', 'VE', 'EC', 'PE', 'BO', 'CL', 'AR', 'PY', 'UY', 'ES'];
  const missing = spanishSpeaking.filter((c) => !C.PROFILES[c]);
  assert.deepEqual(missing, ['CU'], 'Cuba uses the generic profile (+53 numbers still work when written with +)');
});

test('one label, several countries: "RUC" and "NIT" are resolved by the check digit, not by guessing', () => {
  assert.deepEqual(C.countriesForTaxLabel('RUC').sort(), ['EC', 'NI', 'PA', 'PE', 'PY']);
  assert.deepEqual(C.countriesForTaxLabel('nit').sort(), ['BO', 'CO', 'GT', 'SV']);
  assert.deepEqual(C.countriesForTaxLabel('Cédula Jurídica'), ['CR']);
  assert.deepEqual(C.countriesForTaxLabel('NIF').sort(), ['ES', 'PT']);
});

test('local dialling habits become one international number', () => {
  // Fictional numbers (zeros, or ranges reserved for fiction).
  const cases = [
    ['011 15-0000-0601', 'AR', '+5491100000601'], // Buenos Aires mobile, old style
    ['+54 9 11 0000 0601', 'AR', '+5491100000601'],
    ['15 0000 0601', 'AR', null], // a "15" mobile without its area code cannot be dialled
    ['044 55 0000 0201', 'MX', '+525500000201'], // retired Mexican mobile prefix
    ['+52 1 55 0000 0201', 'MX', '+525500000201'],
    ['(1) 000 0601', 'CO', '+576010000601'], // Bogotá landline before the 2021 change
    ['+57 1 000 0601', 'CO', '+576010000601'],
    ['0 21 11 90000-0601', 'BR', '+5511900000601'], // trunk 0 + carrier code 21
    ['809-555-0123', 'DO', '+18095550123'], // 555-01xx: reserved for fiction in the NANP
    ['787-555-0100', 'PR', '+17875550100'],
    ['0990000601', 'EC', '+593990000601'],
    ['099 000 601', 'UY', '+59899000601'],
    ['0981 000601', 'PY', '+595981000601'],
    ['0414-0000601', 'VE', '+584140000601'],
    ['2000-0601', 'CR', '+50620000601'],
    ['5000-0601', 'GT', '+50250000601'],
    ['06 39 98 00 01', 'FR', '+33639980001'], // ARCEP range reserved for fiction,
    ['910 000 601', 'PT', '+351910000601'],
    ['+53 5 0000601', 'XX', '+5350000601']
  ];
  for (const [raw, country, expected] of cases) assert.equal(C.normalizePhone(raw, country), expected, `${country} ${raw}`);
});

test('currencies without cents and dollarised countries', () => {
  assert.doesNotMatch(C.formatMoney(150000, 'PY'), /[.,]00\b/);
  assert.equal(C.getProfile('EC').currency, 'USD');
  assert.equal(C.getProfile('SV').currency, 'USD');
  assert.equal(C.getProfile('PA').vatName, 'ITBMS');
  assert.equal(C.getProfile('DO').vatName, 'ITBIS');
});

test('docs/countries.md lists every country profile', () => {
  const doc = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'docs', 'countries.md'), 'utf8');
  for (const p of Object.values(C.PROFILES)) {
    if (p.code === 'XX') continue;
    assert.ok(doc.includes(`${p.name.en} (${p.code})`), `${p.code} missing from docs/countries.md`);
    const row = doc.split('\n').find((line) => line.startsWith(`| ${p.name.en} (${p.code})`));
    assert.ok(row.includes(p.taxIdCheck === 'checksum' ? '✓ check digit' : 'format only'), `${p.code}: the docs must match the validator`);
  }
});

test('official portals to check a supplier, by country', () => {
  assert.deepEqual(C.verifyLinks('CO').map((l) => l.name), ['RUES', 'DIAN']);
  for (const code of ['CO', 'MX', 'PE', 'CL', 'AR', 'EC', 'BR']) {
    const links = C.verifyLinks(code);
    assert.ok(links.length, code);
    for (const l of links) assert.match(l.url, /^https:\/\/www\.[a-z.]*(gov\.co|org\.co|gob\.mx|gob\.pe|sii\.cl|gob\.ar|gob\.ec|gov\.br)\//, l.url);
  }
  assert.deepEqual(C.verifyLinks('XX'), []);
});
