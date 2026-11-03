/**
 * Supplier Scout — outreach messages.
 *
 * Two messages do most of the work of finding offline suppliers:
 *  1. a quote request (RFQ) that asks for everything needed to compare
 *     fairly: unit, tax, shipping, minimum order, lead time and payment terms;
 *  2. a referral request ("who do you buy X from?"), sent to current
 *     suppliers and colleagues. This is how suppliers with no web presence
 *     are found: through people who already buy from them.
 *
 * The app and the agent only DRAFT these messages. A person sends them.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Categories = isNode ? require('./categories') : root.ScoutCategories;

  var Countries = isNode ? require('./countries') : root.ScoutCountries;

  var UNIT_LABEL = {
    es: { unidad: 'unidades', unit: 'unidades', kg: 'kg', m: 'metros', l: 'litros', docena: 'docenas' },
    en: { unidad: 'units', unit: 'units', kg: 'kg', m: 'metres', l: 'litres', docena: 'dozen' },
    pt: { unidad: 'unidades', unit: 'unidades', kg: 'kg', m: 'metros', l: 'litros', docena: 'dúzias' },
    fr: { unidad: 'unités', unit: 'unités', kg: 'kg', m: 'mètres', l: 'litres', docena: 'douzaines' }
  };

  function language(lang) {
    return UNIT_LABEL[lang] ? lang : 'en';
  }

  function categoryLabel(id, lang) {
    var cat = Categories.byId(id);
    return cat ? cat.label[lang] || cat.label.en : id;
  }

  /** The local name of the sales tax: IVA, IGV, ITBIS, ITBMS, ISV, IVU, TVA... */
  function taxName(country, lang) {
    var profile = Countries.getProfile(country);
    if (profile.code !== 'XX' && profile.vatRate > 0) return profile.vatName;
    return { es: 'impuestos', en: 'tax', pt: 'impostos', fr: 'taxes' }[lang];
  }

  var RFQ = {
    es: function (who, qty, what, zone, days, tax, service) {
      return [
        'Hola' + who + ', le escribe [tu nombre] de [tu empresa].',
        (service ? 'Necesitamos ' + what + (zone ? ' en ' + zone : '') : 'Estamos cotizando ' + (qty ? qty + 'de ' : '') + what + (zone ? ', con entrega en ' + zone : '')) + (days ? ', para dentro de ' + days + ' días' : '') + '.',
        service ? '¿Nos podría enviar una cotización con: valor del servicio, qué incluye, si incluye ' + tax + ', tiempo de respuesta y forma de pago?' : '¿Nos podría enviar: precio unitario y presentación (caja, paquete...), si incluye ' + tax + ', costo de envío, pedido mínimo, tiempo de entrega y forma de pago?',
        '¡Muchas gracias!'
      ];
    },
    en: function (who, qty, what, zone, days, tax, service) {
      return [
        'Hello' + who + ', this is [your name] from [your company].',
        (service ? 'We need ' + what + (zone ? ' in ' + zone : '') : 'We are requesting quotes for ' + (qty ? qty + 'of ' : '') + what + (zone ? ', delivered to ' + zone : '')) + (days ? ', needed within ' + days + ' days' : '') + '.',
        service ? 'Could you send us a quote with: the price of the service, what it includes, whether ' + tax + ' is included, response time and payment terms?' : 'Could you send us: unit price and pack size, whether ' + tax + ' is included, shipping cost, minimum order, lead time and payment terms?',
        'Thank you!'
      ];
    },
    pt: function (who, qty, what, zone, days, tax, service) {
      return [
        'Olá' + who + ', aqui é [seu nome] da [sua empresa].',
        (service ? 'Precisamos de ' + what + (zone ? ' em ' + zone : '') : 'Estamos cotando ' + (qty ? qty + 'de ' : '') + what + (zone ? ', com entrega em ' + zone : '')) + (days ? ', para daqui a ' + days + ' dias' : '') + '.',
        service ? 'Poderia nos enviar um orçamento com: valor do serviço, o que inclui, se inclui ' + tax + ', prazo de atendimento e forma de pagamento?' : 'Poderia nos enviar: preço unitário e embalagem (caixa, pacote...), se inclui ' + tax + ', valor do frete, pedido mínimo, prazo de entrega e forma de pagamento?',
        'Muito obrigado!'
      ];
    },
    fr: function (who, qty, what, zone, days, tax, service) {
      return [
        'Bonjour' + who + ', je suis [votre nom] de [votre entreprise].',
        (service ? 'Nous avons besoin de : ' + what + (zone ? ', à ' + zone : '') : 'Nous demandons des devis pour ' + (qty ? qty + 'de ' : '') + what + (zone ? ', livraison à ' + zone : '')) + (days ? ', sous ' + days + ' jours' : '') + '.',
        service ? 'Pourriez-vous nous envoyer un devis avec : le prix de la prestation, ce qu\'elle comprend, si la ' + tax + ' est comprise, le délai d\'intervention et les conditions de paiement ?' : 'Pourriez-vous nous indiquer : prix unitaire et conditionnement (boîte, paquet...), si la ' + tax + ' est comprise, frais de livraison, commande minimum, délai de livraison et conditions de paiement ?',
        'Merci beaucoup !'
      ];
    }
  };

  /**
   * What purchasing usually asks for before registering a new supplier. Colombia
   * has a well-known list (RUT, Cámara de Comercio, bank certificate, ID); other
   * countries get the same idea named with their own tax ID.
   */
  function documentsLine(country, lang, person, service) {
    var profile = Countries.getProfile(country);
    var taxId = profile.code !== 'XX' && profile.taxIdName ? profile.taxIdName : null;
    var l = language(lang);
    // An individual (persona natural / física) has no Chamber of Commerce certificate
    // of legal representation: their own ID, and a business registration only if they have one.
    if (person && profile.code === 'CO') {
      return {
        es: 'Si avanzamos, para inscribirlo como proveedor le pediremos: RUT actualizado, copia de la cédula, certificación bancaria y, si tiene, el registro mercantil de la Cámara de Comercio.' + (service ? ' Como es un servicio, también el soporte de pago de seguridad social.' : ''),
        en: 'If we go ahead, to register you as a supplier we will ask for: an up-to-date RUT, a copy of your ID, a bank certificate and, if you have one, your Chamber of Commerce business registration.' + (service ? ' As it is a service, also proof of social security payments.' : ''),
        pt: 'Se avançarmos, para cadastrá-lo como fornecedor pediremos: RUT atualizado, cópia do documento de identidade, declaração bancária e, se tiver, o registro na Câmara de Comércio.' + (service ? ' Por ser um serviço, também o comprovante de seguridade social.' : ''),
        fr: 'Si nous avançons, pour vous référencer comme fournisseur nous demanderons : RUT à jour, copie de votre pièce d\'identité, attestation bancaire et, si vous l\'avez, votre immatriculation à la Chambre de commerce.' + (service ? ' Comme il s\'agit d\'un service, aussi la preuve des cotisations sociales.' : '')
      }[l];
    }
    if (person) {
      var taxP = taxId || { es: 'su identificación tributaria', en: 'your tax ID', pt: 'sua identificação fiscal', fr: 'votre identifiant fiscal' }[l];
      return {
        es: 'Si avanzamos, para inscribirlo como proveedor le pediremos: ' + taxP + ', una certificación bancaria y su documento de identidad.',
        en: 'If we go ahead, to register you as a supplier we will ask for: ' + taxP + ', a bank certificate and your ID.',
        pt: 'Se avançarmos, para cadastrá-lo como fornecedor pediremos: ' + taxP + ', uma declaração bancária e seu documento de identidade.',
        fr: 'Si nous avançons, pour vous référencer comme fournisseur nous demanderons : ' + taxP + ', une attestation bancaire et votre pièce d\'identité.'
      }[l];
    }
    if (profile.code === 'CO') {
      return {
        es: 'Si avanzamos, para inscribirlos como proveedor les pediremos: RUT actualizado, certificado de existencia y representación legal de la Cámara de Comercio reciente, certificación bancaria y copia de la cédula del representante legal.',
        en: 'If we go ahead, to register you as a supplier we will ask for: an up-to-date RUT, a recent Chamber of Commerce certificate of existence and legal representation, a bank certificate and a copy of the legal representative\'s ID.',
        pt: 'Se avançarmos, para cadastrá-los como fornecedor pediremos: RUT atualizado, certidão recente da Câmara de Comércio, declaração bancária e cópia do documento do representante legal.',
        fr: 'Si nous avançons, pour vous référencer comme fournisseur nous demanderons : RUT à jour, extrait récent de la Chambre de commerce, attestation bancaire et copie de la pièce d\'identité du représentant légal.'
      }[language(lang)];
    }
    var tax = taxId || { es: 'su identificación tributaria', en: 'your tax ID', pt: 'sua identificação fiscal', fr: 'votre identifiant fiscal' }[language(lang)];
    return {
      es: 'Si avanzamos, para inscribirlos como proveedor les pediremos: ' + tax + ', el registro de la empresa, una certificación bancaria y el documento del representante legal.',
      en: 'If we go ahead, to register you as a supplier we will ask for: ' + tax + ', the company registration, a bank certificate and the legal representative\'s ID.',
      pt: 'Se avançarmos, para cadastrá-los como fornecedor pediremos: ' + tax + ', o registro da empresa, uma declaração bancária e o documento do representante legal.',
      fr: 'Si nous avançons, pour vous référencer comme fournisseur nous demanderons : ' + tax + ', l\'immatriculation de l\'entreprise, une attestation bancaire et la pièce d\'identité du représentant légal.'
    }[language(lang)];
  }

  /**
   * need: { category, item, quantity, unit, neededInDays, deliveryZone, service, documents }.
   * documents: true adds the papers needed to register the supplier; person: true
   * asks an individual (persona natural) for their own papers instead of a company's.
   * service: true asks for the price of a service instead of unit price and pack size.
   * country (optional) names the local sales tax: "si incluye IGV" in Peru, "ITBIS" in the Dominican Republic.
   */
  function rfqMessage(need, supplierName, lang, country) {
    var l = language(lang);
    var what = need.item || categoryLabel(need.category, l).toLowerCase();
    var unit = UNIT_LABEL[l][need.unit] || need.unit || '';
    var qty = need.quantity ? need.quantity + ' ' + unit + ' ' : '';
    var lines = RFQ[l](supplierName ? ' ' + supplierName : '', qty, what, need.deliveryZone, need.neededInDays, taxName(country, l), !!need.service);
    if (need.documents) lines.splice(lines.length - 1, 0, documentsLine(country, l, !!need.person, !!need.service));
    return lines.join('\n');
  }

  var REFERRAL = {
    es: function (what) {
      return [
        '¡Hola! Una consulta rápida: estamos buscando un proveedor confiable de ' + what + '.',
        '¿Hay alguien a quien usted le compre o que nos recomiende, aunque no tenga página web o solo venda por teléfono o WhatsApp?',
        'Con un nombre y un número nos ayuda muchísimo. ¡Gracias!'
      ];
    },
    en: function (what) {
      return [
        'Hi! Quick question: we are looking for a reliable supplier of ' + what + '.',
        'Is there anyone you buy from, or would recommend, even if they have no website or only sell by phone or WhatsApp?',
        'A name and a phone number would be great. Thanks!'
      ];
    },
    pt: function (what) {
      return [
        'Olá! Uma pergunta rápida: estamos procurando um fornecedor confiável de ' + what + '.',
        'Tem alguém de quem você compra ou que recomendaria, mesmo que não tenha site ou só venda por telefone ou WhatsApp?',
        'Um nome e um número já ajudam muito. Obrigado!'
      ];
    },
    fr: function (what) {
      return [
        'Bonjour ! Petite question : nous cherchons un fournisseur fiable pour : ' + what + '.',
        'Y a-t-il quelqu\'un chez qui vous achetez, ou que vous recommanderiez, même sans site web ou qui ne vend que par téléphone ou WhatsApp ?',
        'Un nom et un numéro nous aideraient beaucoup. Merci !'
      ];
    }
  };

  /** "Who do you buy X from?" for current suppliers and colleagues. */
  function referralRequest(category, lang) {
    var l = language(lang);
    return REFERRAL[l](categoryLabel(category, l).toLowerCase()).join('\n');
  }

  /** wa.me link with the message pre-filled, or null without a phone. Opens WhatsApp; nothing is sent automatically. */
  function whatsappLink(e164, message) {
    var digits = String(e164 || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return 'https://wa.me/' + digits + (message ? '?text=' + encodeURIComponent(message) : '');
  }

  var api = { rfqMessage: rfqMessage, referralRequest: referralRequest, whatsappLink: whatsappLink };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutOutreach = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
