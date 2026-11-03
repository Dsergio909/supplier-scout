# Cómo funciona Supplier Scout

**Español** · [English](how-it-works.md)

Supplier Scout sirve para encontrar proveedores nuevos de productos **y de servicios**, **incluidos los que no tienen página web**, y compararlos para decidir a quién pedirle cotización. La [demo](https://dsergio909.github.io/supplier-scout/) funciona en el navegador, sin instalar nada y sin crear cuenta.

## El problema

Buscar un proveedor nuevo suele ser una búsqueda en Google, una hoja de cálculo y algunas llamadas. Fallan tres cosas:

1. **Muchos buenos proveedores no están en internet.** Talleres, negocios familiares y distribuidores que venden por teléfono o WhatsApp no tienen página web, pero sí un local en la calle.
2. **El precio de lista más bajo casi nunca es el pedido más barato.** Paquetes completos, compra mínima, impuesto, envío y plazo de pago cambian la cuenta.
3. **Las estrellas engañan.** Un 5,0 con 2 reseñas no vale más que un 4,7 con 300, y "sin reseñas" no significa "malo".

## Buscar proveedores cerca de ti

Arriba de la pestaña **Buscar** está el buscador:

1. En **¿Qué necesitas?** escribe con tus palabras un producto o un servicio: *mantenimiento de aires acondicionados*, *plomero*, *recarga de extintores*, *fumigación*, *cajas de cartón*, *tornillería*. Debajo aparece lo que la app entendió, por ejemplo **Entendí: Aire acondicionado y refrigeración**.
2. Escribe **la ciudad, el pueblo o el barrio**: *Barranquilla*, *Guatavita*, *Kennedy, Bogotá*. Elige el **país**, o pulsa **Usar mi ubicación** para buscar donde estás.
3. Pulsa **Buscar en el mapa**. En unos segundos aparecen en el ranking los negocios que existen de verdad en esa zona, con su teléfono, dirección y horario cuando el mapa los tiene.
4. El mensaje de resultado dice cuántos encontró, **cuántos no tienen página web** y cuántos tienen teléfono.
5. Pulsa **Ver en Google Maps** para abrir la misma búsqueda en Google Maps. Google suele tener más negocios; desde ahí puedes llamar, ver fotos y leer reseñas.
6. Cada negocio muestra su dirección y horario cuando el mapa los tiene, un botón **Llamar**, **Ver en OpenStreetMap** (su ficha en el mapa) y **Buscar en Google Maps** (para ver fotos, reseñas y llamar). **Pedir cotización** arma un mensaje listo para WhatsApp o correo; si es un servicio, pide el valor del servicio, qué incluye y el tiempo de respuesta.
7. **Volver a los datos de ejemplo** regresa a la demo con proveedores ficticios.

**No necesitas poner cantidades.** En compras primero se buscan varias opciones y la cantidad se negocia con cada proveedor. Las cantidades solo aparecen en la pestaña **Cotizaciones**, cuando ya tienes precios y quieres comparar el costo real de un pedido.

### Cómo identifica el lugar

- **Ciudad o pueblo completo.** Si escribes solo *Barranquilla* o *San Gil*, busca en todo el municipio y sus alrededores. Si la ciudad mide más de 10 km desde el centro (Bogotá, Barranquilla, Medellín), busca 10 km alrededor del centro y te avisa: para otra zona, escribe el barrio (*Soledad, Atlántico* o *Kennedy, Bogotá*).
- **Nombres repetidos.** Muchos pueblos se llaman igual (*San Pedro*, *La Unión*, *Santa Rosa*). La app muestra dónde buscó, con el departamento (*San Pedro, Valle del Cauca*), y debajo te ofrece los otros: **¿No era ahí? Elige: San Pedro, Antioquia · San Pedro, Sucre**. Elegir otro no vuelve a consultar el buscador de lugares.
- **País equivocado.** Si escribes *Lima* con Colombia seleccionado, no lo encuentra en Colombia, lo busca en el resto del mundo, te dice *No lo encontré en Colombia: busqué en Lima (Perú)* y cambia el país.
- **Usar mi ubicación.** El navegador te pide permiso; la ubicación solo se usa para la consulta al mapa y no se guarda.
- El buscador de lugares es Nominatim, de OpenStreetMap. Por su política de uso, la app no sugiere lugares mientras escribes: busca cuando pulsas el botón.

### Cómo entiende lo que escribes

No usa inteligencia artificial: usa reglas, así que siempre se puede explicar qué buscó.

1. **Oficios y servicios** que reconoce en español, inglés, portugués y francés, con plurales y sin importar tildes: aire acondicionado y refrigeración, plomería, electricista, cerrajería, soldadura y estructuras metálicas, pintores, vidrios y ventanas, obras y remodelaciones (también *reparaciones locativas*), techos e impermeabilización, jardinería, fumigación, servicio de aseo, lavandería, talleres de vehículos y montallantas, tornería y mecanizado, computadores y soporte técnico, electrodomésticos, tapicería, avisos, catering, mudanzas, seguridad y cámaras, extintores y seguridad industrial, ascensores, plantas eléctricas y motobombas, contabilidad y abogados. Cada uno sabe qué etiquetas usa OpenStreetMap (por ejemplo `craft=hvac` para aire acondicionado) y qué palabras suelen ir en el nombre del negocio (*refrigeración*, *climatización*).
2. Si no es un oficio, busca en las **categorías de compra**: empaques, ferretería, impresión, textiles, electrónica, alimentos, aseo, transporte, mantenimiento, papelería, muebles e impresión 3D.
3. Si no reconoce nada, busca negocios que tengan **esas palabras en el nombre** y te lo dice: *Buscaré negocios que tengan en su nombre: arepa*.

La palabra *mantenimiento* sola no decide nada: en *mantenimiento de ascensores* busca empresas de ascensores, no plomeros.

### De dónde salen los datos

| Fuente | Qué aporta | Cómo se usa |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) | Un mapa comunitario: voluntarios registran locales y talleres caminando por la calle, por eso aparecen muchos negocios sin página web | La app consulta su buscador de lugares (Nominatim) para ubicar la zona y su servicio Overpass para listar los negocios de la categoría alrededor. Gratis y sin clave |
| Google Maps | Más negocios, fotos y reseñas | Solo un enlace oficial que abre la búsqueda en Google Maps. **No** usa claves de Google ni copia sus datos: copiar datos de Google Maps está prohibido por sus condiciones de uso |

**Nada se inventa.** Cada resultado de la búsqueda real es un lugar que existe en OpenStreetMap, con un enlace a su ficha. Si el mapa no tiene negocios de esa categoría en la zona, la app lo dice y te sugiere ampliar el radio o abrir Google Maps. Los datos de ejemplo de la demo (Bogotá, Ciudad de México y São Paulo) sí son ficticios y están marcados como tales.

### Límites de la búsqueda real

- El radio máximo es de **10 km**, para no saturar el servicio gratuito de OpenStreetMap. Si pides más, la app busca 10 km y te avisa.
- Si el servidor del mapa está ocupado, la app reintenta una vez a los 3 segundos; si sigue ocupado, te pide intentar en un minuto.
- Los datos del mapa pueden estar incompletos o desactualizados: **confirma por teléfono antes de comprar**.
- Los negocios encontrados no traen precios ni reseñas. Aparecen con "sin reseñas" (neutro) y "sin cotización", y el ranking te dice qué preguntar.
- Un negocio solo aparece si alguien lo registró en OpenStreetMap con la etiqueta o el nombre adecuados. Si no sale lo que buscas, prueba otras palabras ("refrigeración" en vez de "aires") o ábrelo en Google Maps.
- La búsqueda real no se guarda en el navegador: si recargas la página, vuelves a los datos de ejemplo. Para conservarla, usa **Exportar** en la pestaña **Datos**.

## El mapa y los tiempos en carro

- Al lado de los filtros hay un **mapa real de OpenStreetMap**. El círculo punteado es tu radio de búsqueda y cada número es el puesto del proveedor en el ranking. Arrastra para moverte, usa **+** y **−** para acercar o alejar y toca un número para ir a su tarjeta.
- En una búsqueda real, la app calcula **cuánto se tarda en carro** hasta cada negocio y la distancia por vía (servicio OSRM, sobre datos de OpenStreetMap). Son tiempos aproximados, sin tráfico. Si ese servicio no responde, muestra la distancia en línea recta.

## Mi lista corta: de las opciones a la decisión

En compras, la práctica habitual es reunir varias opciones, pedir **al menos tres cotizaciones** y compararlas en un **cuadro comparativo** (precio, tiempo de entrega, forma de pago, garantía) antes de elegir. La pestaña **Mi lista** sigue ese proceso:

1. En cada tarjeta, **Agregar a mi lista** guarda el proveedor, con su teléfono, dirección y lo que estabas buscando.
2. En **Mi lista** marcas cómo va cada uno: *Por contactar*, *Contactado*, *Cotizó*, *Elegido* o *Descartado*, y anotas el precio cotizado, el tiempo de entrega, la forma de pago y tus notas.
3. Arriba ves el avance: **2 de 3 cotizaciones recomendadas**.
4. **Descargar cuadro comparativo** genera un archivo que se abre en Excel o Google Sheets, con columnas para precio, entrega, forma de pago, garantía, notas y el enlace a la ficha en el mapa.

La lista se guarda solo en tu navegador y se mantiene aunque hagas otras búsquedas o recargues la página. La app también recuerda tus últimos 5 lugares buscados para repetirlos con un toque.

**Documentos para inscribir al proveedor.** En **Pedir cotización** puedes marcar *Incluir los documentos para inscribirlo como proveedor*. En Colombia el mensaje pide lo que suelen exigir las empresas: RUT actualizado, certificado de existencia y representación legal de la Cámara de Comercio reciente, certificación bancaria y copia de la cédula del representante legal. En otros países usa el nombre de su identificación tributaria (RUC, RFC, CNPJ...). Cada empresa tiene su propia lista: ajusta el mensaje si la tuya pide algo más, como el formato SAGRILAFT.

## Las seis pestañas

| Pestaña | Para qué sirve |
|---|---|
| **1 Buscar** | Escribe qué necesitas y dónde, ajusta el radio y la prioridad, y mira el ranking. Cada proveedor muestra su teléfono, el precio por unidad si ya cotizó, explica **por qué** quedó en ese puesto y tiene un borrador de solicitud de cotización |
| **2 Mi lista** | Los proveedores que vas a contactar, su estado y el cuadro comparativo para descargar |
| **3 Cotizaciones** | Cuando ya tienes precios: escribe la cantidad y convierte cada cotización al costo real del pedido (paquetes completos, compra mínima, impuesto, envío, moneda y el valor de pagar a plazo) |
| **4 Fuera de internet** | Dónde buscar proveedores formales en tu país (compras públicas, registro de empresas), un lector de tarjetas, volantes y mensajes de WhatsApp que funciona sin IA, y un mensaje para pedir recomendaciones |
| **5 Revisión** | Los proveedores nuevos y los posibles duplicados esperan a que una persona los apruebe. El sistema no adivina |
| **6 Datos** | De dónde vienen tus proveedores, importar CSV o JSON (listas de ferias, cámaras de comercio, tu hoja actual) y exportar a CSV para Google Sheets |

## Cómo arma el ranking

| Factor | Qué mide | Si falta el dato |
|---|---|---|
| Precio | El precio por unidad con impuesto que cotizó, comparado con el más barato (sin cantidad: la cantidad se negocia después). Avisa si tiene compra mínima | Neutro, con el aviso "pide cotización" |
| Reseñas | Promedio bayesiano: las reseñas en línea pesan menos cuando son pocas y las de tu equipo pesan el triple | Neutro |
| Distancia | Dentro de tu radio; quien hace envíos no queda por fuera aunque esté lejos | Neutro |
| Confianza | Nivel de verificación (contactado, formal, visitado, ya le compramos) y recomendaciones independientes | Nivel más bajo |
| Rapidez | Días de entrega; aviso si no llega a tiempo | Neutro |

Las prioridades (equilibrado, más barato, más confiable, más cerca, urgente) cambian el peso de cada factor, o puedes moverlos a mano.

**Por qué "neutro" y no "cero":** si un dato que falta contara como cero, un taller sin reseñas en internet y sin cotización todavía perdería siempre contra una tienda en línea. Con neutro compite, y la app te dice qué preguntarle.

## Privacidad y seguridad

- La página solo se conecta a servicios basados en OpenStreetMap: el buscador de lugares (Nominatim), los datos del mapa (Overpass) y los tiempos en carro (OSRM), y únicamente cuando pulsas **Buscar en el mapa**. Las imágenes del mapa vienen de los servidores de OpenStreetMap. Lo garantiza una política de seguridad (CSP) en la propia página: no puede hablar con ningún otro servidor.
- **Por qué no hay un servidor de mapas de respaldo:** los servidores alternativos de Overpass que revisé pueden entregar datos viejos sin avisar. Es preferible reintentar una vez y avisar a mostrar negocios desactualizados.
- **Por qué no hay reseñas de Google dentro de la app:** mostrar datos de Google junto a un mapa que no es de Google va contra sus condiciones, y la clave quedaría expuesta en el navegador. Para ver reseñas y fotos, cada tarjeta tiene **Buscar en Google Maps**.
- No hay cookies, cuentas ni analítica. Lo que capturas o importas se queda en tu navegador.
- Las solicitudes de cotización y de recomendaciones son **borradores**: los revisas y los envías tú. Nada se envía solo.

## Para usuarios avanzados

Fuera del navegador, el mismo código tiene conectores para la línea de comandos (OpenStreetMap, SECOP II de Colombia, datos abiertos de compras públicas OCDS, portales Socrata, CSV y Google Places si tienes una clave propia) y un agente opcional con la API de Claude. Generan un JSON que importas en la pestaña **Datos**. Las instrucciones están en el [README](../README.md#run-it).

## Cómo explicarlo en 2 minutos

> Escribes lo que necesitas como lo dirías en voz alta, por ejemplo "mantenimiento de aires acondicionados", y la zona. Cuando buscas proveedores en Google solo encuentras a los que tienen página web, y en Latinoamérica muchos de los mejores no la tienen: son talleres y locales que venden por teléfono o WhatsApp. Supplier Scout busca en OpenStreetMap, un mapa comunitario donde esos negocios sí aparecen porque los registran personas que caminan la calle, y te dice cuántos no tienen web. Con un clic abres la misma búsqueda en Google Maps, sin copiar sus datos. No te pide cantidades, porque en compras primero se buscan opciones y la cantidad se negocia después; cuando ya tienes cotizaciones, compara el costo real del pedido con compra mínima, impuesto y envío. Y trata las reseñas con cuidado: pocas reseñas pesan poco y "sin reseñas" es neutro, no malo. Todo lo nuevo pasa por revisión humana y los mensajes son borradores que envías tú.
