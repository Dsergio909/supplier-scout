/**
 * Supplier Scout — understand what the buyer typed.
 *
 * "mantenimiento de aires acondicionados", "plomero", "cajas de cartón" or
 * "recarga de extintores" becomes what to look for on the map: OpenStreetMap
 * tags (craft=hvac, shop=packaging...) and words to find in business names.
 *
 * Specific trades and services come first; the broad purchase categories
 * (src/core/categories.js) are the fallback; anything else is searched by
 * name. Rules only, no AI, so the result is predictable and explainable.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Text = isNode ? require('./text') : root.ScoutText;
  var Categories = isNode ? require('./categories') : root.ScoutCategories;

  /**
   * Keywords are written in singular and without accents; plurals ("aires",
   * "reparaciones") match automatically. osm: tags searched on the map.
   * nameHint: stems searched in business names (letters, digits, spaces, "|").
   */
  var SERVICES = [
    {
      id: 'hvac', category: 'maintenance',
      label: { es: 'Aire acondicionado y refrigeración', en: 'Air conditioning & refrigeration', pt: 'Ar-condicionado e refrigeração', fr: 'Climatisation et froid' },
      keywords: ['aire acondicionado', 'aires acondicionado', 'acondicionado', 'climatizacion', 'refrigeracion', 'refrigeracion industrial', 'cuarto frio', 'minisplit', 'mini split', 'ventilacion', 'hvac', 'air conditioning', 'air conditioner', 'refrigeration', 'ar condicionado', 'refrigeracao', 'climatizacao', 'climatisation', 'frigoriste'],
      osm: [['craft', 'hvac'], ['shop', 'hvac'], ['craft', 'refrigeration']],
      nameHint: 'refrigera|climatiza|acondicionad|ventilaci|minisplit|hvac|climatisation'
    },
    {
      id: 'plumbing', category: 'maintenance',
      label: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento', fr: 'Plomberie' },
      keywords: ['plomero', 'plomeria', 'fontanero', 'fontaneria', 'gasfiter', 'gasfiteria', 'tuberia', 'destape', 'destapador', 'fuga de agua', 'plumber', 'plumbing', 'encanador', 'encanamento', 'bombeiro hidraulico', 'plombier', 'plomberie'],
      osm: [['craft', 'plumber']],
      nameHint: 'plomer|fontaner|gasfit|hidraul|encanad|plomb|destape'
    },
    {
      id: 'electrical', category: 'maintenance',
      label: { es: 'Electricista', en: 'Electrician', pt: 'Eletricista', fr: 'Électricien' },
      keywords: ['electricista', 'instalacion electrica', 'red electrica', 'tablero electrico', 'cableado', 'electrician', 'electrical work', 'eletricista', 'instalacao eletrica', 'electricien'],
      osm: [['craft', 'electrician']],
      nameHint: 'electricist|eletricist|electricien|instalaciones electricas'
    },
    {
      id: 'locksmith', category: 'maintenance',
      label: { es: 'Cerrajería', en: 'Locksmith', pt: 'Chaveiro', fr: 'Serrurerie' },
      keywords: ['cerrajero', 'cerrajeria', 'chapa', 'duplicado de llave', 'locksmith', 'chaveiro', 'serrurier', 'serrurerie'],
      osm: [['craft', 'locksmith'], ['shop', 'locksmith'], ['craft', 'key_cutter']],
      nameHint: 'cerrajer|chaveir|serrur'
    },
    {
      id: 'metalwork', category: 'maintenance',
      label: { es: 'Soldadura y estructuras metálicas', en: 'Welding & metalwork', pt: 'Serralheria e solda', fr: 'Soudure et métallerie' },
      keywords: ['soldadura', 'soldador', 'herreria', 'herrero', 'estructura metalica', 'ornamentacion', 'metalmecanica', 'reja', 'welding', 'welder', 'metalwork', 'serralheria', 'serralheiro', 'solda', 'soudure', 'metallerie', 'ferronnerie'],
      osm: [['craft', 'metal_construction'], ['craft', 'welder'], ['craft', 'blacksmith']],
      nameHint: 'soldad|herrer|metalic|metalmec|ornamenta|serralher|soudur|metaller'
    },
    {
      id: 'painting', category: 'maintenance',
      label: { es: 'Pintores', en: 'Painters', pt: 'Pintores', fr: 'Peintres' },
      keywords: ['pintor', 'servicio de pintura', 'pintura de fachada', 'pintura de pared', 'painter', 'painting service', 'peintre'],
      osm: [['craft', 'painter']],
      nameHint: 'pintor|peintr'
    },
    {
      id: 'glass', category: 'maintenance',
      label: { es: 'Vidrios y ventanas', en: 'Glass & windows', pt: 'Vidraçaria e janelas', fr: 'Vitrerie et fenêtres' },
      keywords: ['vidrio', 'vidrieria', 'ventaneria', 'ventana', 'espejo', 'aluminio y vidrio', 'glazier', 'glass', 'vidracaria', 'vidraceiro', 'vitrier', 'vitrerie'],
      osm: [['craft', 'glaziery'], ['craft', 'window_construction']],
      nameHint: 'vidri|ventaner|vidrac|vitr'
    },
    {
      id: 'building', category: 'maintenance',
      label: { es: 'Obras y remodelaciones', en: 'Building & renovation', pt: 'Obras e reformas', fr: 'Travaux et rénovation' },
      keywords: ['reparacion locativa', 'locativa', 'obra civil', 'construccion', 'remodelacion', 'albanil', 'mamposteria', 'enchape', 'drywall', 'piso', 'builder', 'renovation', 'construction', 'pedreiro', 'reforma', 'macon', 'renovation'],
      osm: [['craft', 'builder'], ['craft', 'tiler'], ['craft', 'plasterer'], ['craft', 'floorer']],
      nameHint: 'construc|remodela|drywall|enchap|reformas'
    },
    {
      id: 'roofing', category: 'maintenance',
      label: { es: 'Techos e impermeabilización', en: 'Roofing & waterproofing', pt: 'Telhados e impermeabilização', fr: 'Toiture et étanchéité' },
      keywords: ['techo', 'cubierta', 'teja', 'impermeabilizacion', 'gotera', 'canal', 'roofer', 'roofing', 'waterproofing', 'telhado', 'impermeabilizacao', 'calha', 'toiture', 'couvreur', 'etancheite'],
      osm: [['craft', 'roofer'], ['craft', 'insulation']],
      nameHint: 'techo|cubierta|impermeabiliz|telhad|toitur|couvreur'
    },
    {
      id: 'gardening', category: 'maintenance',
      label: { es: 'Jardinería', en: 'Gardening', pt: 'Jardinagem', fr: 'Jardinage' },
      keywords: ['jardin', 'jardineria', 'jardinero', 'poda', 'paisajismo', 'vivero', 'zona verde', 'gardener', 'gardening', 'landscaping', 'jardinagem', 'paisagismo', 'jardinier', 'jardinage', 'paysagiste'],
      osm: [['craft', 'gardener'], ['shop', 'garden_centre'], ['landuse', 'plant_nursery']],
      nameHint: 'jardin|vivero|paisaj|paisag|paysag'
    },
    {
      id: 'pest', category: 'maintenance',
      label: { es: 'Fumigación y control de plagas', en: 'Pest control', pt: 'Dedetização', fr: 'Désinsectisation' },
      keywords: ['fumigacion', 'fumigador', 'control de plaga', 'plaga', 'desratizacion', 'pest control', 'fumigation', 'dedetizacao', 'desratizacao', 'desinsectisation', 'deratisation'],
      osm: [['craft', 'pest_control'], ['shop', 'pest_control']],
      nameHint: 'fumiga|plaga|dedetiz|desratiz|desinsect|derat'
    },
    {
      id: 'cleaningService', category: 'cleaning',
      label: { es: 'Servicio de aseo y limpieza', en: 'Cleaning services', pt: 'Serviços de limpeza', fr: 'Services de nettoyage' },
      keywords: ['servicio de aseo', 'aseo de oficina', 'limpieza de oficina', 'servicio de limpieza', 'empresa de aseo', 'lavado de tapete', 'lavado de mueble', 'lavado de tanque', 'cleaning service', 'janitorial service', 'servico de limpeza', 'faxina', 'societe de nettoyage'],
      osm: [['craft', 'cleaning'], ['office', 'cleaning']],
      nameHint: 'aseo|limpieza|cleaning|limpeza|nettoyage'
    },
    {
      id: 'vehicles', category: 'maintenance',
      label: { es: 'Talleres de vehículos', en: 'Vehicle repair', pt: 'Oficinas mecânicas', fr: 'Garages automobiles' },
      keywords: ['mecanico', 'taller mecanico', 'taller automotriz', 'vehiculo', 'carro', 'camion', 'moto', 'llanta', 'montallanta', 'vulcanizadora', 'gomeria', 'latoneria', 'lubricentro', 'lavadero de carro', 'car repair', 'mechanic', 'tyre', 'oficina mecanica', 'mecanica', 'pneu', 'garagiste'],
      osm: [['shop', 'car_repair'], ['shop', 'tyres'], ['shop', 'motorcycle_repair'], ['amenity', 'car_wash']],
      nameHint: 'mecanic|automotr|llant|lubric|latoner|autopart|montallant|vulcaniz|gomeri'
    },
    {
      id: 'machining', category: 'maintenance',
      label: { es: 'Tornería y mecanizado', en: 'Machining & turning', pt: 'Tornearia e usinagem', fr: 'Usinage et tournage' },
      keywords: ['torno', 'tornero', 'torneria', 'mecanizado', 'rectificadora', 'fresadora', 'cnc', 'corte laser', 'machining', 'machine shop', 'tornearia', 'usinagem', 'usinage', 'tournage'],
      osm: [['craft', 'machinist'], ['craft', 'turner']],
      nameHint: 'torner|tornos|mecaniz|rectific|fresad|cnc|usinag|tornear'
    },
    {
      id: 'laundry', category: 'cleaning',
      label: { es: 'Lavandería', en: 'Laundry', pt: 'Lavanderia', fr: 'Blanchisserie' },
      keywords: ['lavanderia', 'lavado de ropa', 'lavado de uniforme', 'tintoreria', 'laundry', 'dry cleaning', 'lavanderia industrial', 'blanchisserie', 'pressing'],
      osm: [['shop', 'laundry'], ['shop', 'dry_cleaning']],
      nameHint: 'lavander|tintorer|laundry|blanchiss'
    },
    {
      id: 'it', category: 'electronics',
      label: { es: 'Computadores y soporte técnico', en: 'Computers & IT support', pt: 'Informática e suporte', fr: 'Informatique et support' },
      keywords: ['computador', 'computadora', 'portatil', 'soporte tecnico', 'sistemas', 'red de datos', 'cableado estructurado', 'informatica', 'impresora', 'computer', 'it support', 'laptop', 'printer repair', 'suporte tecnico', 'informatique', 'ordinateur'],
      osm: [['shop', 'computer'], ['craft', 'electronics_repair'], ['office', 'it']],
      nameHint: 'computad|sistemas|informatic|soporte|tecnolog|informatiq'
    },
    {
      id: 'appliances', category: 'electronics',
      label: { es: 'Electrodomésticos', en: 'Appliances', pt: 'Eletrodomésticos', fr: 'Électroménager' },
      keywords: ['electrodomestico', 'nevera', 'lavadora', 'estufa', 'horno industrial', 'appliance', 'fridge', 'washing machine', 'eletrodomestico', 'geladeira', 'electromenager'],
      osm: [['shop', 'appliance'], ['craft', 'electronics_repair']],
      nameHint: 'electrodomest|eletrodomest|lavador|nevera|electromenag'
    },
    {
      id: 'upholstery', category: 'furniture',
      label: { es: 'Tapicería', en: 'Upholstery', pt: 'Estofaria', fr: 'Tapisserie' },
      keywords: ['tapiceria', 'tapicero', 'tapizado', 'upholstery', 'upholsterer', 'estofaria', 'estofador', 'tapissier'],
      osm: [['craft', 'upholsterer']],
      nameHint: 'tapic|tapiz|estof|tapiss'
    },
    {
      id: 'signs', category: 'printing',
      label: { es: 'Avisos y señalización', en: 'Signs & signage', pt: 'Letreiros e sinalização', fr: 'Enseignes et signalétique' },
      keywords: ['aviso', 'letrero', 'senalizacion', 'valla', 'rotulo', 'acrilico', 'sign', 'signage', 'letreiro', 'sinalizacao', 'enseigne', 'signaletique'],
      osm: [['craft', 'signmaker']],
      nameHint: 'aviso|letrer|senaliz|rotul|letreir|enseign|signal'
    },
    {
      id: 'catering', category: 'food',
      label: { es: 'Catering y eventos', en: 'Catering & events', pt: 'Buffet e eventos', fr: 'Traiteur et événements' },
      keywords: ['catering', 'banquete', 'refrigerio', 'almuerzo', 'buffet', 'evento', 'caterer', 'traiteur'],
      osm: [['craft', 'caterer']],
      nameHint: 'catering|banquet|buffet|traiteur|eventos'
    },
    {
      id: 'moving', category: 'transport',
      label: { es: 'Mudanzas y acarreos', en: 'Moving & haulage', pt: 'Mudanças e fretes', fr: 'Déménagement' },
      keywords: ['trasteo', 'mudanza', 'acarreo', 'flete', 'moving', 'removals', 'mudanca', 'frete', 'demenagement'],
      osm: [['office', 'moving_company']],
      nameHint: 'trasteo|mudanz|acarreo|mudanc|demenag'
    },
    {
      id: 'security', category: null,
      label: { es: 'Seguridad, cámaras y alarmas', en: 'Security, cameras & alarms', pt: 'Segurança, câmeras e alarmes', fr: 'Sécurité, caméras et alarmes' },
      keywords: ['vigilancia', 'seguridad privada', 'camara de seguridad', 'camara', 'alarma', 'cctv', 'control de acceso', 'security', 'alarm', 'seguranca', 'alarme', 'securite', 'videosurveillance'],
      osm: [['office', 'security'], ['shop', 'security']],
      nameHint: 'segurid|vigilan|alarm|cctv|seguranc|securit'
    },
    {
      id: 'fireSafety', category: 'maintenance',
      label: { es: 'Extintores y seguridad industrial', en: 'Fire extinguishers & safety', pt: 'Extintores e segurança do trabalho', fr: 'Extincteurs et sécurité' },
      keywords: ['extintor', 'recarga de extintor', 'seguridad industrial', 'dotacion de seguridad', 'epp', 'fire extinguisher', 'safety equipment', 'seguranca do trabalho', 'extincteur'],
      osm: [['shop', 'fire_extinguisher'], ['shop', 'safety_equipment']],
      nameHint: 'extintor|extinguish|seguridad industrial|extincteur'
    },
    {
      id: 'elevators', category: 'maintenance',
      label: { es: 'Ascensores', en: 'Elevators', pt: 'Elevadores', fr: 'Ascenseurs' },
      keywords: ['ascensor', 'elevador', 'montacarga', 'escalera electrica', 'elevator', 'lift', 'ascenseur'],
      osm: [],
      nameHint: 'ascensor|elevador|montacarga|elevator|ascenseur'
    },
    {
      id: 'power', category: 'maintenance',
      label: { es: 'Plantas eléctricas y motores', en: 'Generators & motors', pt: 'Geradores e motores', fr: 'Groupes électrogènes et moteurs' },
      keywords: ['planta electrica', 'generador', 'motobomba', 'bomba de agua', 'motor electrico', 'rebobinado', 'generator', 'water pump', 'gerador', 'groupe electrogene'],
      osm: [],
      nameHint: 'planta electric|generador|motobomb|bombas|rebobin|motores|gerador'
    },
    {
      id: 'accounting', category: null,
      label: { es: 'Contabilidad', en: 'Accounting', pt: 'Contabilidade', fr: 'Comptabilité' },
      keywords: ['contador', 'contabilidad', 'revisor fiscal', 'auditoria', 'accountant', 'accounting', 'contabilidade', 'contador publico', 'comptable', 'comptabilite'],
      osm: [['office', 'accountant']],
      nameHint: 'contab|contador|auditor|comptab'
    },
    {
      id: 'legal', category: null,
      label: { es: 'Abogados', en: 'Lawyers', pt: 'Advogados', fr: 'Avocats' },
      keywords: ['abogado', 'asesoria legal', 'juridico', 'lawyer', 'legal advice', 'advogado', 'avocat'],
      osm: [['office', 'lawyer']],
      nameHint: 'abogad|juridic|advogad|avocat'
    }
  ];

  // Words that only say "service" or "repair": on their own they mean the
  // maintenance category, next to other words they add nothing to the search.
  var GENERIC = ['mantenimiento', 'reparacion', 'arreglo', 'servicio', 'tecnico', 'instalacion', 'preventivo', 'correctivo',
    'maintenance', 'repair', 'service', 'technician', 'installation', 'manutencao', 'reparo', 'conserto', 'servico',
    'instalacao', 'entretien', 'reparation', 'depannage'];

  var STOP = ['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'para',
    'por', 'con', 'sin', 'que', 'mi', 'mis', 'su', 'sus', 'se', 'lo', 'le', 'necesito', 'necesitamos', 'busco', 'buscamos',
    'quiero', 'proveedor', 'proveedores', 'empresa', 'empresas', 'cerca', 'barato', 'bueno', 'urgente', 'oficina', 'bodega',
    'the', 'of', 'for', 'and', 'or', 'in', 'near', 'need', 'supplier', 'suppliers', 'company', 'do', 'da', 'das', 'dos', 'no',
    'na', 'nas', 'nos', 'preciso', 'fornecedor', 'fornecedores', 'des', 'du', 'le', 'les', 'pour', 'et', 'ou', 'fournisseur'];

  function singular(word) {
    if (word.length > 4 && /[^aeiou]es$/.test(word) && /(ion|or|dor|al|ar|er|il|ol|ul|n|r|l|d|z|j)es$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && /s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
    return word;
  }

  function sameWord(a, b) {
    return a === b || singular(a) === singular(b);
  }

  /** Index of the first place where all words of `phrase` appear in a row in `words`, or -1. */
  function findPhrase(words, phrase) {
    for (var i = 0; i + phrase.length <= words.length; i++) {
      var ok = true;
      for (var j = 0; j < phrase.length && ok; j++) ok = sameWord(words[i + j], phrase[j]);
      if (ok) return i;
    }
    return -1;
  }

  function prepare(list) {
    return list.map(function (entry) {
      return entry.keywords.map(function (kw) { return Text.normalize(kw).split(' '); });
    });
  }
  var SERVICE_KEYS = prepare(SERVICES);
  var CATEGORY_KEYS = prepare(Categories.CATEGORIES).map(function (phrases) {
    // A category is not chosen just because the text says "mantenimiento".
    return phrases.filter(function (p) { return !(p.length === 1 && GENERIC.indexOf(singular(p[0])) !== -1); });
  });

  function unique(list) {
    var seen = {};
    return list.filter(function (x) {
      var key = JSON.stringify(x);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function byId(id) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i];
    return null;
  }

  /**
   * Text -> what to search.
   * { kind: 'service' | 'category' | 'name' | 'empty', services, categories, tags, nameHint, terms }
   */
  function interpret(text) {
    var words = Text.normalize(String(text || '').slice(0, 200)).split(' ').filter(Boolean);
    var used = {};
    function mark(phrases) {
      var hit = false;
      phrases.forEach(function (p) {
        var at = findPhrase(words, p);
        if (at !== -1) {
          hit = true;
          for (var k = 0; k < p.length; k++) used[at + k] = true;
        }
      });
      return hit;
    }
    var services = SERVICES.filter(function (s, i) { return mark(SERVICE_KEYS[i]); });
    var categories = Categories.CATEGORIES.filter(function (c, i) { return mark(CATEGORY_KEYS[i]); });
    var generic = words.some(function (w) { return GENERIC.indexOf(singular(w)) !== -1 || GENERIC.indexOf(w) !== -1; });
    var terms = unique(words.filter(function (w, i) {
      return !used[i] && w.length >= 3 && STOP.indexOf(w) === -1 && GENERIC.indexOf(w) === -1 && GENERIC.indexOf(singular(w)) === -1;
    }).map(singular));

    if (services.length) {
      return {
        kind: 'service',
        services: services.map(function (s) { return s.id; }),
        categories: unique(services.map(function (s) { return s.category; }).filter(Boolean)),
        tags: unique([].concat.apply([], services.map(function (s) { return s.osm; }))),
        nameHint: services.map(function (s) { return s.nameHint; }).join('|'),
        terms: terms
      };
    }
    if (categories.length) {
      return {
        kind: 'category',
        services: [],
        categories: categories.map(function (c) { return c.id; }),
        tags: unique([].concat.apply([], categories.map(function (c) { return c.osm; }))),
        nameHint: categories.map(function (c) { return c.nameHint; }).join('|'),
        terms: terms
      };
    }
    if (terms.length) {
      return { kind: 'name', services: [], categories: [], tags: [], nameHint: terms.slice(0, 6).join('|'), terms: terms };
    }
    if (generic) {
      var maint = Categories.byId('maintenance');
      return { kind: 'category', services: [], categories: ['maintenance'], tags: maint.osm, nameHint: maint.nameHint, terms: [] };
    }
    return { kind: 'empty', services: [], categories: [], tags: [], nameHint: '', terms: [] };
  }

  /** Labels of what was understood, for "I understood: …". */
  function describe(result, lang) {
    if (!result) return [];
    if (result.kind === 'service') return result.services.map(function (id) { return byId(id).label[lang] || byId(id).label.es; });
    if (result.kind === 'category') return result.categories.map(function (id) { var c = Categories.byId(id); return c.label[lang] || c.label.es; });
    return [];
  }

  var api = { SERVICES: SERVICES, byId: byId, interpret: interpret, describe: describe, singular: singular };

  if (isNode) {
    module.exports = api;
  } else {
    root.ScoutServices = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
