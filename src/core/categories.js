/**
 * Supplier Scout — purchase categories.
 *
 * One list drives three things: detecting categories in captured text
 * (keywords in Spanish, English and Portuguese), building OpenStreetMap
 * queries (tags), and labelling the UI.
 *
 * Runs unchanged in Node and the browser.
 */
(function (root) {
  'use strict';

  var Text = typeof module !== 'undefined' && module.exports ? require('./text') : root.ScoutText;

  var CATEGORIES = [
    {
      id: 'packaging', label: { es: 'Empaques y cajas', en: 'Packaging', pt: 'Embalagens', fr: 'Emballages' },
      keywords: ['empaque', 'empaques', 'carton', 'corrugado', 'embalaje', 'embalajes', 'cajas de carton', 'bolsas plasticas', 'kraft', 'stretch', 'packaging', 'cardboard', 'embalagem', 'embalagens', 'papelao', 'caixas de papelao', 'emballage', 'emballages', 'cartons'],
      osm: [['shop', 'packaging'], ['craft', 'packaging']], nameHint: 'empaque|carton|embalaje|packaging|embalagem|papelao|emballage|corrugad'
    },
    {
      id: 'hardware', label: { es: 'Ferretería', en: 'Hardware', pt: 'Ferragens', fr: 'Quincaillerie' },
      keywords: ['ferreteria', 'tlapaleria', 'pintureria', 'casa de materiales', 'ferreteria industrial', 'tornillo', 'tornillos', 'tornilleria', 'pijas', 'clavos', 'herraje', 'herrajes', 'herramienta', 'herramientas', 'pintura', 'pinturas', 'materiales de construccion', 'corralon', 'deposito de materiales', 'cemento', 'hardware', 'tools', 'ferragens', 'ferragem', 'parafusos', 'material de construcao', 'quincaillerie', 'outillage'],
      osm: [['shop', 'hardware'], ['shop', 'doityourself'], ['shop', 'trade']], nameHint: 'ferreter|tlapaler|tornill|herraj|ferragen|quincaill'
    },
    {
      id: 'printing', label: { es: 'Impresión y litografía', en: 'Printing', pt: 'Gráfica e impressão', fr: 'Imprimerie' },
      keywords: ['impresion', 'impresiones', 'fotocopia', 'fotocopias', 'copias', 'litografia', 'tipografia', 'imprenta', 'serigrafia', 'rotulos', 'pendon', 'pendones', 'sticker', 'stickers', 'volantes', 'gran formato', 'printing', 'print shop', 'grafica', 'impressao', 'imprimerie'],
      osm: [['shop', 'copyshop'], ['craft', 'printer'], ['shop', 'printing']], nameHint: 'litograf|impres|tipograf|imprenta'
    },
    {
      id: 'textiles', label: { es: 'Textiles y confección', en: 'Textiles & sewing', pt: 'Tecidos e confecção', fr: 'Textile et couture' },
      keywords: ['tela', 'telas', 'textil', 'textiles', 'confeccion', 'confecciones', 'maquila', 'bordado', 'bordados', 'uniforme', 'uniformes', 'dotacion', 'costura', 'fabric', 'tecidos', 'confeccao', 'tissu', 'tissus', 'couture'],
      osm: [['shop', 'fabric'], ['craft', 'tailor'], ['craft', 'dressmaker'], ['shop', 'sewing']], nameHint: 'textil|confecci|bordad|telas|dotaci'
    },
    {
      id: 'electronics', label: { es: 'Electrónica y eléctricos', en: 'Electronics & electrical', pt: 'Eletrônicos e material elétrico', fr: 'Électronique et électricité' },
      keywords: ['electronica', 'electronicos', 'componentes', 'cable', 'cables', 'electricos', 'material electrico', 'led', 'iluminacion', 'electronics', 'electrical', 'eletronicos', 'eletronica', 'material eletrico', 'electronique'],
      osm: [['shop', 'electronics'], ['shop', 'electrical'], ['shop', 'lighting']], nameHint: 'electr|ilumina'
    },
    {
      id: 'food', label: { es: 'Alimentos y cafetería', en: 'Food & catering', pt: 'Alimentos e café', fr: 'Alimentation et traiteur' },
      keywords: ['alimentos', 'viveres', 'abarrotes', 'colmado', 'pulperia', 'frutas', 'verduras', 'cafe', 'refrigerios', 'catering', 'panaderia', 'food', 'groceries', 'mantimentos', 'hortifruti', 'epicerie', 'alimentation'],
      osm: [['shop', 'wholesale'], ['shop', 'greengrocer'], ['shop', 'bakery'], ['amenity', 'marketplace']], nameHint: 'alimento|viveres|abarrote|frut|catering'
    },
    {
      id: 'cleaning', label: { es: 'Aseo y limpieza', en: 'Cleaning supplies', pt: 'Produtos de limpeza', fr: 'Produits d\'entretien' },
      keywords: ['aseo', 'limpieza', 'productos de limpieza', 'desinfectante', 'detergente', 'quimicos', 'jabon', 'cleaning', 'janitorial', 'limpeza', 'produtos de limpeza', 'nettoyage', 'entretien'],
      osm: [['shop', 'cleaning_supplies'], ['shop', 'chemist']], nameHint: 'aseo|limpieza|quimicos de limpieza|productos de limpieza'
    },
    {
      id: 'transport', label: { es: 'Transporte y mensajería', en: 'Transport & courier', pt: 'Transporte e entregas', fr: 'Transport et coursiers' },
      keywords: ['transporte', 'mensajeria', 'logistica', 'fletes', 'acarreo', 'acarreos', 'trasteo', 'trasteos', 'mudanza', 'mudanzas', 'courier', 'freight', 'transportadora', 'fretes', 'mudancas', 'logistique', 'transport', 'demenagement'],
      osm: [['office', 'courier'], ['amenity', 'post_office'], ['office', 'logistics']], nameHint: 'transport|mensajer|logistic|acarreo|trasteo'
    },
    {
      id: 'maintenance', label: { es: 'Mantenimiento y reparaciones', en: 'Maintenance & repairs', pt: 'Manutenção e reparos', fr: 'Maintenance et réparations' },
      keywords: ['mantenimiento', 'plomeria', 'plomero', 'fontaneria', 'fontanero', 'gasfiteria', 'gasfiter', 'electricista', 'reparacion', 'reparaciones', 'soldadura', 'herreria', 'tecnico', 'cerrajeria', 'maintenance', 'repair', 'manutencao', 'encanador', 'eletricista', 'serralheria', 'plombier', 'plomberie', 'electricien', 'depannage'],
      osm: [['craft', 'plumber'], ['craft', 'electrician'], ['craft', 'metal_construction'], ['shop', 'locksmith'], ['craft', 'locksmith']], nameHint: 'mantenim|plomer|fontaner|gasfit|electricist|soldad|cerrajer|herrer|serralher|plomb'
    },
    {
      id: 'office', label: { es: 'Papelería y oficina', en: 'Office supplies', pt: 'Papelaria e escritório', fr: 'Fournitures de bureau' },
      keywords: ['papeleria', 'libreria', 'utiles', 'utiles escolares', 'oficina', 'resma', 'resmas', 'toner', 'cartucho', 'stationery', 'office supplies', 'papelaria', 'material de escritorio', 'papeterie', 'fournitures de bureau'],
      osm: [['shop', 'stationery'], ['shop', 'office_supplies']], nameHint: 'papeler|utiles de oficina|suministros de oficina|papelaria|papeterie'
    },
    {
      id: 'furniture', label: { es: 'Carpintería y muebles', en: 'Carpentry & furniture', pt: 'Marcenaria e móveis', fr: 'Menuiserie et meubles' },
      keywords: ['carpinteria', 'mueble', 'muebles', 'muebleria', 'madera', 'maderas', 'maderera', 'madereria', 'aserradero', 'triplay', 'ebanisteria', 'mdf', 'furniture', 'carpentry', 'moveis', 'marcenaria', 'madeira', 'menuiserie', 'meubles', 'ebenisterie'],
      osm: [['craft', 'carpenter'], ['shop', 'furniture'], ['craft', 'cabinet_maker']], nameHint: 'carpinter|mueble|madera|ebanist'
    },
    {
      id: '3dprint', label: { es: 'Impresión 3D y filamento', en: '3D printing & filament', pt: 'Impressão 3D e filamento', fr: 'Impression 3D et filament' },
      keywords: ['impresion 3d', 'filamento', 'filamentos', 'pla', 'petg', 'resina', '3d printing', 'filament', 'impressao 3d', 'impression 3d'],
      osm: [['shop', '3d_printing']], nameHint: 'impresion 3d|impresiones 3d|3d print|impressao 3d|filament'
    }
  ];

  function byId(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return null;
  }

  var NORMALIZED = CATEGORIES.map(function (cat) {
    return cat.keywords.map(function (kw) { return ' ' + Text.normalize(kw) + ' '; });
  });

  /** Category ids whose keywords appear in the text (accent-insensitive, whole words, any of ES/EN/PT/FR). */
  function detect(text) {
    var hay = ' ' + Text.normalize(text) + ' ';
    return CATEGORIES.filter(function (cat, i) {
      return NORMALIZED[i].some(function (kw) { return hay.indexOf(kw) !== -1; });
    }).map(function (cat) { return cat.id; });
  }

  var api = { CATEGORIES: CATEGORIES, byId: byId, detect: detect };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScoutCategories = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
