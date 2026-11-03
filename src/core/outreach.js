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
        'Estamos cotizando ' + (qty ? qty + 'de ' : '') + what + (zone ? (service ? ', en ' : ', con entrega en ') + zone : '') + (days ? ', para dentro de ' + days + ' días' : '') + '.',
        service ? '¿Nos podría enviar una cotización con: valor del servicio, qué incluye, si incluye ' + tax + ', tiempo de respuesta y forma de pago?' : '¿Nos podría enviar: precio unitario y presentación (caja, paquete...), si incluye ' + tax + ', costo de envío, pedido mínimo, tiempo de entrega y forma de pago?',
        '¡Muchas gracias!'
      ];
    },
    en: function (who, qty, what, zone, days, tax, service) {
      return [
        'Hello' + who + ', this is [your name] from [your company].',
        'We are requesting quotes for ' + (qty ? qty + 'of ' : '') + what + (zone ? (service ? ', in ' : ', delivered to ') + zone : '') + (days ? ', needed within ' + days + ' days' : '') + '.',
        service ? 'Could you send us a quote with: the price of the service, what it includes, whether ' + tax + ' is included, response time and payment terms?' : 'Could you send us: unit price and pack size, whether ' + tax + ' is included, shipping cost, minimum order, lead time and payment terms?',
        'Thank you!'
      ];
    },
    pt: function (who, qty, what, zone, days, tax, service) {
      return [
        'Olá' + who + ', aqui é [seu nome] da [sua empresa].',
        'Estamos cotando ' + (qty ? qty + 'de ' : '') + what + (zone ? (service ? ', em ' : ', com entrega em ') + zone : '') + (days ? ', para daqui a ' + days + ' dias' : '') + '.',
        service ? 'Poderia nos enviar um orçamento com: valor do serviço, o que inclui, se inclui ' + tax + ', prazo de atendimento e forma de pagamento?' : 'Poderia nos enviar: preço unitário e embalagem (caixa, pacote...), se inclui ' + tax + ', valor do frete, pedido mínimo, prazo de entrega e forma de pagamento?',
        'Muito obrigado!'
      ];
    },
    fr: function (who, qty, what, zone, days, tax, service) {
      return [
        'Bonjour' + who + ', je suis [votre nom] de [votre entreprise].',
        'Nous demandons des devis pour ' + (qty ? qty + 'de ' : '') + what + (zone ? (service ? ', à ' : ', livraison à ') + zone : '') + (days ? ', sous ' + days + ' jours' : '') + '.',
        service ? 'Pourriez-vous nous envoyer un devis avec : le prix de la prestation, ce qu\'elle comprend, si la ' + tax + ' est comprise, le délai d\'intervention et les conditions de paiement ?' : 'Pourriez-vous nous indiquer : prix unitaire et conditionnement (boîte, paquet...), si la ' + tax + ' est comprise, frais de livraison, commande minimum, délai de livraison et conditions de paiement ?',
        'Merci beaucoup !'
      ];
    }
  };

  /**
   * need: { category, item, quantity, unit, neededInDays, deliveryZone, service }.
   * service: true asks for the price of a service instead of unit price and pack size.
   * country (optional) names the local sales tax: "si incluye IGV" in Peru, "ITBIS" in the Dominican Republic.
   */
  function rfqMessage(need, supplierName, lang, country) {
    var l = language(lang);
    var what = need.item || categoryLabel(need.category, l).toLowerCase();
    var unit = UNIT_LABEL[l][need.unit] || need.unit || '';
    var qty = need.quantity ? need.quantity + ' ' + unit + ' ' : '';
    return RFQ[l](supplierName ? ' ' + supplierName : '', qty, what, need.deliveryZone, need.neededInDays, taxName(country, l), !!need.service).join('\n');
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
