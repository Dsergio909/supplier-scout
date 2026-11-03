/**
 * Supplier Scout — human-readable explanations (ES / EN / PT / FR).
 *
 * The core returns evidence and warnings as codes ({ code, ...params }).
 * This file turns them into sentences for the web app, the CLI and the agent.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Countries = isNode ? require('./countries') : root.ScoutCountries;

  /** 2.5 -> "2,5" in Spanish, Portuguese and French. */
  function decimal(value, lang) {
    var text = String(value);
    return lang === 'en' ? text : text.replace('.', ',');
  }

  // Base units from quotes.js, in each language ("1000 unit" -> "1000 unidades").
  // One unit: "por unidad", "per unit".
  var UNIT_ONE = {
    es: { unit: 'unidad', kg: 'kg', m: 'metro', l: 'litro' },
    en: { unit: 'unit', kg: 'kg', m: 'metre', l: 'litre' },
    pt: { unit: 'unidade', kg: 'kg', m: 'metro', l: 'litro' },
    fr: { unit: 'unité', kg: 'kg', m: 'mètre', l: 'litre' }
  };

  var UNIT_WORDS = {
    es: { unit: 'unidades', kg: 'kg', m: 'metros', l: 'litros' },
    en: { unit: 'units', kg: 'kg', m: 'metres', l: 'litres' },
    pt: { unit: 'unidades', kg: 'kg', m: 'metros', l: 'litros' },
    fr: { unit: 'unités', kg: 'kg', m: 'mètres', l: 'litres' }
  };

  function unitWord(unit, lang, one) {
    var table = one === 1 ? UNIT_ONE : UNIT_WORDS;
    var words = table[lang] || table.en;
    return Object.prototype.hasOwnProperty.call(words, unit) ? words[unit] : unit;
  }

  function km(value, lang) {
    return value < 1 ? Math.round(value * 1000) + ' m' : decimal(Math.round(value * 10) / 10, lang) + ' km';
  }

  var LEVELS = {
    es: ['Sin verificar', 'Contactado', 'Formal (ID tributario verificado)', 'Visitado / muestra recibida', 'Ya le compramos'],
    en: ['Unverified', 'Contacted', 'Formal (tax ID checked)', 'Visited / sample received', 'Bought from before'],
    pt: ['Não verificado', 'Contatado', 'Formal (CNPJ / ID fiscal verificado)', 'Visitado / amostra recebida', 'Já compramos dele'],
    fr: ['Non vérifié', 'Contacté', 'Formel (identifiant fiscal vérifié)', 'Visité / échantillon reçu', 'Déjà client']
  };

  var SOURCES = {
    es: { web: 'En línea', map: 'Mapa', registry: 'Registro público', referral: 'Referido', field: 'Campo', import: 'Importado', agent: 'Agente IA' },
    en: { web: 'Online', map: 'Map', registry: 'Public registry', referral: 'Referral', field: 'Field', import: 'Imported', agent: 'AI agent' },
    pt: { web: 'Online', map: 'Mapa', registry: 'Registro público', referral: 'Indicação', field: 'Campo', import: 'Importado', agent: 'Agente IA' },
    fr: { web: 'En ligne', map: 'Carte', registry: 'Registre public', referral: 'Recommandation', field: 'Terrain', import: 'Importé', agent: 'Agent IA' }
  };

  var BASIS = {
    es: { none: 'sin reseñas: valor neutro', external: 'reseñas en línea', internal: 'reseñas de tu equipo', both: 'reseñas en línea y de tu equipo' },
    en: { none: 'no reviews: neutral value', external: 'online reviews', internal: 'your team\'s reviews', both: 'online and team reviews' },
    pt: { none: 'sem avaliações: valor neutro', external: 'avaliações online', internal: 'avaliações da sua equipe', both: 'avaliações online e da equipe' },
    fr: { none: 'aucun avis : valeur neutre', external: 'avis en ligne', internal: 'avis de votre équipe', both: 'avis en ligne et de l\'équipe' }
  };

  var TEXT = {
    es: {
      unit_price: function (p, c) { return 'Cotizó ' + c.money(p.unitPrice) + ' por ' + unitWord(p.unit, 'es', 1) + ' con impuestos, sin envío' + (p.minOrder ? '; compra mínima ' + p.minOrder + ' ' + unitWord(p.unit, 'es') : '') + (p.paymentDays ? '; paga a ' + p.paymentDays + ' días' : '') + '. La cantidad y el total se negocian después.'; },
      price: function (p, c) { return 'Tu pedido cuesta ' + c.money(p.total) + ' en total (' + c.money(p.unitCost) + ' por unidad, con impuestos y envío)' + (p.paymentDays ? '; paga a ' + p.paymentDays + ' días' : '') + '.'; },
      rating: function (p) {
        var parts = [p.external ? p.external + ' en línea' : null, p.internal ? p.internal + ' de tu equipo' : null].filter(Boolean);
        return 'Calificación ajustada ' + decimal(p.value.toFixed(1), 'es') + '/5 (' + (parts.length ? 'reseñas: ' + parts.join(' + ') : BASIS.es.none) + ').';
      },
      distance: function (p) { return 'A ' + km(p.km, 'es') + ' de tu punto de búsqueda.'; },
      ships: function () { return 'Hace envíos: la distancia pesa menos.'; },
      trust: function (p) { return 'Confianza: ' + LEVELS.es[p.level] + (p.referrers ? ', recomendado por ' + p.referrers + (p.referrers === 1 ? ' fuente independiente' : ' fuentes independientes') + (p.mutual ? ' (' + p.mutual + ' mutua)' : '') : '') + '.'; },
      speed: function (p) { return 'Entrega en ' + p.days + (p.days === 1 ? ' día.' : ' días.'); },
      offline: function () { return 'Sin página web: encontrado fuera de internet (mapa, registro, referido o campo).'; },
      no_quote: function () { return 'Aún no hay cotización: el precio cuenta como neutro. Pide una.'; },
      too_slow: function (p) { return 'Tarda ' + p.days + ' días y lo necesitas en ' + p.needed + '.'; },
      over_budget: function (p, c) { return 'Supera tu presupuesto (' + c.money(p.total) + ' > ' + c.money(p.budget) + ').'; },
      below_moq: function (p) { return 'Compra mínima: ' + p.minOrder + ' ' + unitWord(p.unit, 'es') + '; el total ya la incluye.'; },
      overbuy: function (p) { return 'Por el tamaño del paquete compras ' + p.extra + ' ' + unitWord(p.unit, 'es') + ' de más.'; },
      fx_manual: function (p) { return 'Precio en ' + p.currency + ' convertido con tu tasa manual (' + p.rate + ').'; },
      fx_missing: function (p) { return 'Falta la tasa de cambio para ' + p.currency + '.'; },
      unit_mismatch: function (p) { return 'La cotización está en ' + unitWord(p.quoteUnit, 'es') + ' y pediste ' + unitWord(p.needUnit, 'es') + '.'; },
      unit_unknown: function () { return 'Unidad de la cotización no reconocida.'; },
      regional_unit: function (p) { return '"' + p.unit + '" se tomó como ' + (Math.round(p.kg * 100) / 100) + ' kg (valor usual en el país): confírmalo con el proveedor.'; },
      unverified: function () { return 'Nadie lo ha verificado todavía.'; },
      unknown_location: function () { return 'Sin ubicación exacta: la distancia cuenta como neutra.'; },
      no_consent: function () { return 'Sin autorización para tratar sus datos personales.'; },
      out_of_radius: function (p) { return 'Fuera de tu radio (' + km(p.km, 'es') + ') y no hace envíos.'; },
      tax_id_invalid: function (p) { return 'El ID tributario ' + p.value + ' no pasa la verificación' + (p.expected != null ? ' (dígito esperado: ' + p.expected + ')' : '') + '.'; },
      phone_unparsed: function (p) { return 'No pude interpretar el teléfono "' + p.raw + '".'; },
      name_missing: function () { return 'No encontré el nombre del proveedor.'; },
      category_missing: function () { return 'No reconocí qué vende: elige la categoría.'; },
      no_contact: function () { return 'No hay forma de contacto (teléfono, correo, web o redes).'; },
      tax_unknown: function (p) { return 'No dice si "' + (p.item || 'el precio') + '" incluye impuestos.'; },
      moq_unresolved: function (p) { return 'Pedido mínimo "' + p.qty + ' ' + p.unit + '": confirma cuántas unidades son.'; },
      currency_ambiguous: function (p) { return '"' + p.symbol + '" puede ser ' + p.options + ': se tomó ' + p.currency + '. Confírmalo.'; },
      tax_id: function (p) { return p.label + (p.valid === true ? ' válido' : p.valid === false ? ' inválido' : ' sin dígito de verificación') + '.'; },
      name: function (p) { return { heading: 'Nombre tomado del encabezado.', intro: 'Nombre tomado de la presentación ("somos...").', first_line: 'Nombre tomado de la primera línea.' }[p.how]; },
      same_tax_id: function () { return 'Mismo ID tributario.'; },
      same_phone: function () { return 'Mismo teléfono.'; },
      same_email: function () { return 'Mismo correo.'; },
      same_domain: function (p) { return 'Mismo dominio corporativo (' + p.domain + ').'; },
      similar_name: function (p) { return 'Nombre parecido (' + Math.round(p.similarity * 100) + '%)' + (p.km != null ? ' a ' + km(p.km, 'es') : '') + '.'; },
      tax_conflict: function () { return 'Pero tienen IDs tributarios distintos: podrían ser dos empresas.'; },
      ambiguous: function () { return 'Coincide con más de un registro: decide tú.'; }
    },
    en: {
      unit_price: function (p, c) { return 'Quoted ' + c.money(p.unitPrice) + ' per ' + unitWord(p.unit, 'en', 1) + ' with tax, before shipping' + (p.minOrder ? '; minimum order ' + p.minOrder + ' ' + unitWord(p.unit, 'en') : '') + (p.paymentDays ? '; pay in ' + p.paymentDays + ' days' : '') + '. Quantity and total are negotiated later.'; },
      price: function (p, c) { return 'Your order costs ' + c.money(p.total) + ' in total (' + c.money(p.unitCost) + ' per unit, tax and shipping included)' + (p.paymentDays ? '; pay in ' + p.paymentDays + ' days' : '') + '.'; },
      rating: function (p) {
        var parts = [p.external ? p.external + ' online' : null, p.internal ? p.internal + ' from your team' : null].filter(Boolean);
        return 'Adjusted rating ' + decimal(p.value.toFixed(1), 'en') + '/5 (' + (parts.length ? 'reviews: ' + parts.join(' + ') : BASIS.en.none) + ').';
      },
      distance: function (p) { return km(p.km, 'en') + ' from your search point.'; },
      ships: function () { return 'Delivers: distance matters less.'; },
      trust: function (p) { return 'Trust: ' + LEVELS.en[p.level] + (p.referrers ? ', recommended by ' + p.referrers + ' independent source' + (p.referrers === 1 ? '' : 's') + (p.mutual ? ' (' + p.mutual + ' mutual)' : '') : '') + '.'; },
      speed: function (p) { return 'Delivers in ' + p.days + (p.days === 1 ? ' day.' : ' days.'); },
      offline: function () { return 'No website: found offline (map, registry, referral or field).'; },
      no_quote: function () { return 'No quote yet: price counts as neutral. Ask for one.'; },
      too_slow: function (p) { return 'Takes ' + p.days + ' days and you need it in ' + p.needed + '.'; },
      over_budget: function (p, c) { return 'Over your budget (' + c.money(p.total) + ' > ' + c.money(p.budget) + ').'; },
      below_moq: function (p) { return 'Minimum order: ' + p.minOrder + ' ' + unitWord(p.unit, 'en') + '; the total already includes it.'; },
      overbuy: function (p) { return 'Pack size makes you buy ' + p.extra + ' ' + unitWord(p.unit, 'en') + ' extra.'; },
      fx_manual: function (p) { return 'Price in ' + p.currency + ' converted at your manual rate (' + p.rate + ').'; },
      fx_missing: function (p) { return 'Missing exchange rate for ' + p.currency + '.'; },
      unit_mismatch: function (p) { return 'Quote is per ' + unitWord(p.quoteUnit, 'en') + ' and you asked for ' + unitWord(p.needUnit, 'en') + '.'; },
      unit_unknown: function () { return 'Quote unit not recognised.'; },
      regional_unit: function (p) { return '"' + p.unit + '" was taken as ' + (Math.round(p.kg * 100) / 100) + ' kg (the usual value in this country): confirm it with the supplier.'; },
      unverified: function () { return 'Nobody has verified it yet.'; },
      unknown_location: function () { return 'No exact location: distance counts as neutral.'; },
      no_consent: function () { return 'No consent to process their personal data.'; },
      out_of_radius: function (p) { return 'Outside your radius (' + km(p.km, 'en') + ') and does not deliver.'; },
      tax_id_invalid: function (p) { return 'Tax ID ' + p.value + ' fails its check' + (p.expected != null ? ' (expected check digit: ' + p.expected + ')' : '') + '.'; },
      phone_unparsed: function (p) { return 'Could not read the phone "' + p.raw + '".'; },
      name_missing: function () { return 'Could not find the supplier name.'; },
      category_missing: function () { return 'Could not tell what they sell: pick the category.'; },
      no_contact: function () { return 'No way to contact them (phone, email, web or social).'; },
      tax_unknown: function (p) { return 'Does not say whether "' + (p.item || 'the price') + '" includes tax.'; },
      moq_unresolved: function (p) { return 'Minimum order "' + p.qty + ' ' + p.unit + '": confirm how many units that is.'; },
      currency_ambiguous: function (p) { return '"' + p.symbol + '" can mean ' + p.options + ': read as ' + p.currency + '. Please confirm.'; },
      tax_id: function (p) { return p.label + (p.valid === true ? ' valid' : p.valid === false ? ' invalid' : ' without check digit') + '.'; },
      name: function (p) { return { heading: 'Name taken from the heading.', intro: 'Name taken from the introduction ("we are...").', first_line: 'Name taken from the first line.' }[p.how]; },
      same_tax_id: function () { return 'Same tax ID.'; },
      same_phone: function () { return 'Same phone.'; },
      same_email: function () { return 'Same email.'; },
      same_domain: function (p) { return 'Same corporate domain (' + p.domain + ').'; },
      similar_name: function (p) { return 'Similar name (' + Math.round(p.similarity * 100) + '%)' + (p.km != null ? ' ' + km(p.km, 'en') + ' apart' : '') + '.'; },
      tax_conflict: function () { return 'But their tax IDs differ: they may be two companies.'; },
      ambiguous: function () { return 'Matches more than one record: you decide.'; }
    },
    pt: {
      unit_price: function (p, c) { return 'Orçou ' + c.money(p.unitPrice) + ' por ' + unitWord(p.unit, 'pt', 1) + ' com impostos, sem frete' + (p.minOrder ? '; pedido mínimo ' + p.minOrder + ' ' + unitWord(p.unit, 'pt') : '') + (p.paymentDays ? '; pagamento em ' + p.paymentDays + ' dias' : '') + '. Quantidade e total se negociam depois.'; },
      price: function (p, c) { return 'Seu pedido custa ' + c.money(p.total) + ' no total (' + c.money(p.unitCost) + ' por unidade, com impostos e frete)' + (p.paymentDays ? '; pagamento em ' + p.paymentDays + ' dias' : '') + '.'; },
      rating: function (p) {
        var parts = [p.external ? p.external + ' online' : null, p.internal ? p.internal + ' da sua equipe' : null].filter(Boolean);
        return 'Nota ajustada ' + decimal(p.value.toFixed(1), 'pt') + '/5 (' + (parts.length ? 'avaliações: ' + parts.join(' + ') : BASIS.pt.none) + ').';
      },
      distance: function (p) { return 'A ' + km(p.km, 'pt') + ' do seu ponto de busca.'; },
      ships: function () { return 'Faz entregas: a distância pesa menos.'; },
      trust: function (p) { return 'Confiança: ' + LEVELS.pt[p.level] + (p.referrers ? ', indicado por ' + p.referrers + (p.referrers === 1 ? ' fonte independente' : ' fontes independentes') + (p.mutual ? ' (' + p.mutual + ' mútua)' : '') : '') + '.'; },
      speed: function (p) { return 'Entrega em ' + p.days + (p.days === 1 ? ' dia.' : ' dias.'); },
      offline: function () { return 'Sem site: encontrado fora da internet (mapa, registro, indicação ou campo).'; },
      no_quote: function () { return 'Ainda sem orçamento: o preço conta como neutro. Peça um.'; },
      too_slow: function (p) { return 'Leva ' + p.days + ' dias e você precisa em ' + p.needed + '.'; },
      over_budget: function (p, c) { return 'Acima do seu orçamento (' + c.money(p.total) + ' > ' + c.money(p.budget) + ').'; },
      below_moq: function (p) { return 'Pedido mínimo: ' + p.minOrder + ' ' + unitWord(p.unit, 'pt') + '; o total já o inclui.'; },
      overbuy: function (p) { return 'Pelo tamanho da embalagem você compra ' + p.extra + ' ' + unitWord(p.unit, 'pt') + ' a mais.'; },
      fx_manual: function (p) { return 'Preço em ' + p.currency + ' convertido com a sua taxa manual (' + p.rate + ').'; },
      fx_missing: function (p) { return 'Falta a taxa de câmbio para ' + p.currency + '.'; },
      unit_mismatch: function (p) { return 'O orçamento está em ' + unitWord(p.quoteUnit, 'pt') + ' e você pediu ' + unitWord(p.needUnit, 'pt') + '.'; },
      unit_unknown: function () { return 'Unidade do orçamento não reconhecida.'; },
      regional_unit: function (p) { return '"' + p.unit + '" foi considerado ' + (Math.round(p.kg * 100) / 100) + ' kg (valor usual no país): confirme com o fornecedor.'; },
      unverified: function () { return 'Ninguém o verificou ainda.'; },
      unknown_location: function () { return 'Sem localização exata: a distância conta como neutra.'; },
      no_consent: function () { return 'Sem autorização para tratar seus dados pessoais.'; },
      out_of_radius: function (p) { return 'Fora do seu raio (' + km(p.km, 'pt') + ') e não faz entregas.'; },
      tax_id_invalid: function (p) { return 'O ID fiscal ' + p.value + ' não passa na verificação' + (p.expected != null ? ' (dígito esperado: ' + p.expected + ')' : '') + '.'; },
      phone_unparsed: function (p) { return 'Não consegui interpretar o telefone "' + p.raw + '".'; },
      name_missing: function () { return 'Não encontrei o nome do fornecedor.'; },
      category_missing: function () { return 'Não reconheci o que vende: escolha a categoria.'; },
      no_contact: function () { return 'Não há forma de contato (telefone, e-mail, site ou redes).'; },
      tax_unknown: function (p) { return 'Não diz se "' + (p.item || 'o preço') + '" inclui impostos.'; },
      moq_unresolved: function (p) { return 'Pedido mínimo "' + p.qty + ' ' + p.unit + '": confirme quantas unidades são.'; },
      currency_ambiguous: function (p) { return '"' + p.symbol + '" pode ser ' + p.options + ': foi lido como ' + p.currency + '. Confirme.'; },
      tax_id: function (p) { return p.label + (p.valid === true ? ' válido' : p.valid === false ? ' inválido' : ' sem dígito verificador') + '.'; },
      name: function (p) { return { heading: 'Nome tirado do cabeçalho.', intro: 'Nome tirado da apresentação ("somos...").', first_line: 'Nome tirado da primeira linha.' }[p.how]; },
      same_tax_id: function () { return 'Mesmo ID fiscal.'; },
      same_phone: function () { return 'Mesmo telefone.'; },
      same_email: function () { return 'Mesmo e-mail.'; },
      same_domain: function (p) { return 'Mesmo domínio corporativo (' + p.domain + ').'; },
      similar_name: function (p) { return 'Nome parecido (' + Math.round(p.similarity * 100) + '%)' + (p.km != null ? ' a ' + km(p.km, 'pt') : '') + '.'; },
      tax_conflict: function () { return 'Mas têm IDs fiscais diferentes: podem ser duas empresas.'; },
      ambiguous: function () { return 'Coincide com mais de um registro: decida você.'; }
    },
    fr: {
      unit_price: function (p, c) { return 'Devis de ' + c.money(p.unitPrice) + ' par ' + unitWord(p.unit, 'fr', 1) + ' taxes comprises, hors livraison' + (p.minOrder ? ' ; commande minimum ' + p.minOrder + ' ' + unitWord(p.unit, 'fr') : '') + (p.paymentDays ? ' ; paiement à ' + p.paymentDays + ' jours' : '') + '. La quantité et le total se négocient ensuite.'; },
      price: function (p, c) { return 'Votre commande coûte ' + c.money(p.total) + ' au total (' + c.money(p.unitCost) + ' par unité, taxes et livraison comprises)' + (p.paymentDays ? ' ; paiement à ' + p.paymentDays + ' jours' : '') + '.'; },
      rating: function (p) {
        var parts = [p.external ? p.external + ' en ligne' : null, p.internal ? p.internal + ' de votre équipe' : null].filter(Boolean);
        return 'Note ajustée ' + decimal(p.value.toFixed(1), 'fr') + '/5 (' + (parts.length ? 'avis : ' + parts.join(' + ') : BASIS.fr.none) + ').';
      },
      distance: function (p) { return 'À ' + km(p.km, 'fr') + ' de votre point de recherche.'; },
      ships: function () { return 'Livre : la distance compte moins.'; },
      trust: function (p) { return 'Confiance : ' + LEVELS.fr[p.level] + (p.referrers ? ', recommandé par ' + p.referrers + (p.referrers === 1 ? ' source indépendante' : ' sources indépendantes') + (p.mutual ? ' (' + p.mutual + ' mutuelle)' : '') : '') + '.'; },
      speed: function (p) { return 'Livre en ' + p.days + (p.days === 1 ? ' jour.' : ' jours.'); },
      offline: function () { return 'Pas de site web : trouvé hors ligne (carte, registre, recommandation ou terrain).'; },
      no_quote: function () { return 'Pas encore de devis : le prix compte comme neutre. Demandez-en un.'; },
      too_slow: function (p) { return 'Il faut ' + p.days + ' jours et vous en avez besoin en ' + p.needed + '.'; },
      over_budget: function (p, c) { return 'Dépasse votre budget (' + c.money(p.total) + ' > ' + c.money(p.budget) + ').'; },
      below_moq: function (p) { return 'Commande minimum : ' + p.minOrder + ' ' + unitWord(p.unit, 'fr') + ' ; le total l\'inclut déjà.'; },
      overbuy: function (p) { return 'La taille du lot vous fait acheter ' + p.extra + ' ' + unitWord(p.unit, 'fr') + ' de trop.'; },
      fx_manual: function (p) { return 'Prix en ' + p.currency + ' converti avec votre taux manuel (' + p.rate + ').'; },
      fx_missing: function (p) { return 'Il manque le taux de change pour ' + p.currency + '.'; },
      unit_mismatch: function (p) { return 'Le devis est en ' + unitWord(p.quoteUnit, 'fr') + ' et vous avez demandé des ' + unitWord(p.needUnit, 'fr') + '.'; },
      unit_unknown: function () { return 'Unité du devis non reconnue.'; },
      regional_unit: function (p) { return '« ' + p.unit + ' » a été compté comme ' + (Math.round(p.kg * 100) / 100) + ' kg (valeur habituelle dans le pays) : confirmez avec le fournisseur.'; },
      unverified: function () { return 'Personne ne l\'a encore vérifié.'; },
      unknown_location: function () { return 'Pas d\'adresse exacte : la distance compte comme neutre.'; },
      no_consent: function () { return 'Pas de consentement pour traiter ses données personnelles.'; },
      out_of_radius: function (p) { return 'Hors de votre rayon (' + km(p.km, 'fr') + ') et ne livre pas.'; },
      tax_id_invalid: function (p) { return 'L\'identifiant fiscal ' + p.value + ' ne passe pas la vérification' + (p.expected != null ? ' (chiffre attendu : ' + p.expected + ')' : '') + '.'; },
      phone_unparsed: function (p) { return 'Impossible de lire le téléphone « ' + p.raw + ' ».'; },
      name_missing: function () { return 'Nom du fournisseur introuvable.'; },
      category_missing: function () { return 'Impossible de savoir ce qu\'il vend : choisissez la catégorie.'; },
      no_contact: function () { return 'Aucun moyen de contact (téléphone, e-mail, site ou réseaux).'; },
      tax_unknown: function (p) { return 'Ne précise pas si « ' + (p.item || 'le prix') + ' » inclut les taxes.'; },
      moq_unresolved: function (p) { return 'Commande minimum « ' + p.qty + ' ' + p.unit + ' » : confirmez combien d\'unités cela fait.'; },
      currency_ambiguous: function (p) { return '« ' + p.symbol + ' » peut désigner ' + p.options + ' : lu comme ' + p.currency + '. À confirmer.'; },
      tax_id: function (p) { return p.label + (p.valid === true ? ' valide' : p.valid === false ? ' invalide' : ' sans chiffre de contrôle') + '.'; },
      name: function (p) { return { heading: 'Nom tiré de l\'en-tête.', intro: 'Nom tiré de la présentation (« nous sommes... »).', first_line: 'Nom tiré de la première ligne.' }[p.how]; },
      same_tax_id: function () { return 'Même identifiant fiscal.'; },
      same_phone: function () { return 'Même téléphone.'; },
      same_email: function () { return 'Même e-mail.'; },
      same_domain: function (p) { return 'Même domaine d\'entreprise (' + p.domain + ').'; },
      similar_name: function (p) { return 'Nom proche (' + Math.round(p.similarity * 100) + ' %)' + (p.km != null ? ' à ' + km(p.km, 'fr') : '') + '.'; },
      tax_conflict: function () { return 'Mais leurs identifiants fiscaux diffèrent : ce sont peut-être deux entreprises.'; },
      ambiguous: function () { return 'Correspond à plusieurs fiches : à vous de décider.'; }
    }
  };

  var LANGUAGES = ['es', 'en', 'pt', 'fr'];

  /** "pt-BR" -> "pt"; anything unsupported -> "en". */
  function pickLanguage(tag) {
    var base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    return LANGUAGES.indexOf(base) !== -1 ? base : 'en';
  }

  /** item: { code, ...params }. ctx: { country, currency } for money formatting. */
  function explain(item, lang, ctx) {
    var table = TEXT[pickLanguage(lang)];
    var fn = table[item.code];
    if (!fn) return item.code;
    var c = ctx || {};
    var helpers = {
      money: function (amount) { return Countries.formatMoney(amount, c.country, c.currency); }
    };
    return fn(item, helpers);
  }

  /** 0.115 -> "11,5 %" (fr), "11,5%" (es, pt), "11.5%" (en). */
  function formatPercent(rate, lang) {
    return decimal(Math.round(rate * 1000) / 10, lang) + (lang === 'fr' ? '\u00a0%' : '%');
  }

  var api = { explain: explain, formatPercent: formatPercent, formatDecimal: decimal, LEVELS: LEVELS, SOURCES: SOURCES, BASIS: BASIS, LANGUAGES: LANGUAGES, pickLanguage: pickLanguage, formatKm: km };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutMessages = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
