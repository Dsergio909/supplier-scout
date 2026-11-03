# Cómo funciona Supplier Scout

**Español** · [English](how-it-works.md)

Supplier Scout sirve para encontrar proveedores nuevos, **incluidos los que no tienen página web**, y compararlos por lo que realmente cuesta tu pedido. La [demo](https://dsergio909.github.io/supplier-scout/) funciona en el navegador, sin instalar nada y sin crear cuenta.

## El problema

Buscar un proveedor nuevo suele ser una búsqueda en Google, una hoja de cálculo y algunas llamadas. Fallan tres cosas:

1. **Muchos buenos proveedores no están en internet.** Talleres, negocios familiares y distribuidores que venden por teléfono o WhatsApp no tienen página web, pero sí un local en la calle.
2. **El precio de lista más bajo casi nunca es el pedido más barato.** Paquetes completos, compra mínima, impuesto, envío y plazo de pago cambian la cuenta.
3. **Las estrellas engañan.** Un 5,0 con 2 reseñas no vale más que un 4,7 con 300, y "sin reseñas" no significa "malo".

## Buscar negocios reales cerca de ti

Arriba de la pestaña **Buscar** está el panel **Buscar negocios reales**:

1. Elige **qué buscas** (ferretería, empaques, impresión, textiles, aseo, etc.), el **país** y escribe **la zona o barrio y la ciudad**, por ejemplo *Kennedy, Bogotá*.
2. Pulsa **Buscar en el mapa**. En unos segundos aparecen en el ranking los negocios que existen de verdad en esa zona, con su teléfono, dirección y horario cuando el mapa los tiene.
3. El mensaje de resultado dice cuántos encontró, **cuántos no tienen página web** y cuántos tienen teléfono.
4. Pulsa **Ver en Google Maps** para abrir la misma búsqueda en Google Maps. Google suele tener más negocios; desde ahí puedes llamar, ver fotos y leer reseñas.
5. **Volver a los datos de ejemplo** regresa a la demo con proveedores ficticios.

### De dónde salen los datos

| Fuente | Qué aporta | Cómo se usa |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) | Un mapa comunitario: voluntarios registran locales y talleres caminando por la calle, por eso aparecen muchos negocios sin página web | La app consulta su buscador de lugares (Nominatim) para ubicar la zona y su servicio Overpass para listar los negocios de la categoría alrededor. Gratis y sin clave |
| Google Maps | Más negocios, fotos y reseñas | Solo un enlace oficial que abre la búsqueda en Google Maps. **No** usa claves de Google ni copia sus datos: copiar datos de Google Maps está prohibido por sus condiciones de uso |

**Nada se inventa.** Cada resultado de la búsqueda real es un lugar que existe en OpenStreetMap, con un enlace a su ficha. Si el mapa no tiene negocios de esa categoría en la zona, la app lo dice y te sugiere ampliar el radio o abrir Google Maps. Los datos de ejemplo de la demo (Bogotá, Ciudad de México y São Paulo) sí son ficticios y están marcados como tales.

### Límites de la búsqueda real

- El radio máximo es de **10 km**, para no saturar el servicio gratuito de OpenStreetMap. Si pides más, la app busca 10 km y te avisa.
- Los datos del mapa pueden estar incompletos o desactualizados: **confirma por teléfono antes de comprar**.
- Los negocios encontrados no traen precios ni reseñas. Aparecen con reseñas "sin reseñas" (neutro) y "sin cotización", y el ranking te dice qué preguntar.
- La búsqueda real no se guarda en el navegador: si recargas la página, vuelves a los datos de ejemplo. Para conservarla, usa **Exportar** en la pestaña **Datos**.

## Las cinco pestañas

| Pestaña | Para qué sirve |
|---|---|
| **1 Buscar** | Describe tu necesidad (categoría, cantidad, desde dónde, en cuántos días, radio y presupuesto), elige una prioridad y mira el ranking. Cada proveedor explica **por qué** quedó en ese puesto y tiene un borrador de solicitud de cotización |
| **2 Cotizaciones** | Convierte cada cotización al costo real de **tu** pedido: paquetes completos, compra mínima, impuesto, envío, moneda y el valor de pagar a plazo |
| **3 Fuera de internet** | Dónde buscar proveedores formales en tu país (compras públicas, registro de empresas), un lector de tarjetas, volantes y mensajes de WhatsApp que funciona sin IA, y un mensaje para pedir recomendaciones |
| **4 Revisión** | Los proveedores nuevos y los posibles duplicados esperan a que una persona los apruebe. El sistema no adivina |
| **5 Datos** | De dónde vienen tus proveedores, importar CSV o JSON (listas de ferias, cámaras de comercio, tu hoja actual) y exportar a CSV para Google Sheets |

## Cómo arma el ranking

| Factor | Qué mide | Si falta el dato |
|---|---|---|
| Precio | El total de **tu** pedido comparado con la opción más barata | Neutro, con el aviso "pide cotización" |
| Reseñas | Promedio bayesiano: las reseñas en línea pesan menos cuando son pocas y las de tu equipo pesan el triple | Neutro |
| Distancia | Dentro de tu radio; quien hace envíos no queda por fuera aunque esté lejos | Neutro |
| Confianza | Nivel de verificación (contactado, formal, visitado, ya le compramos) y recomendaciones independientes | Nivel más bajo |
| Rapidez | Días de entrega; aviso si no llega a tiempo | Neutro |

Las prioridades (equilibrado, más barato, más confiable, más cerca, urgente) cambian el peso de cada factor, o puedes moverlos a mano.

**Por qué "neutro" y no "cero":** si un dato que falta contara como cero, un taller sin reseñas en internet y sin cotización todavía perdería siempre contra una tienda en línea. Con neutro compite, y la app te dice qué preguntarle.

## Privacidad y seguridad

- La página solo se conecta a los dos servicios de OpenStreetMap, y únicamente cuando pulsas **Buscar en el mapa**. Lo bloquea una política de seguridad (CSP) en la propia página: no puede hablar con ningún otro servidor.
- No hay cookies, cuentas ni analítica. Lo que capturas o importas se queda en tu navegador.
- Las solicitudes de cotización y de recomendaciones son **borradores**: los revisas y los envías tú. Nada se envía solo.

## Para usuarios avanzados

Fuera del navegador, el mismo código tiene conectores para la línea de comandos (OpenStreetMap, SECOP II de Colombia, datos abiertos de compras públicas OCDS, portales Socrata, CSV y Google Places si tienes una clave propia) y un agente opcional con la API de Claude. Generan un JSON que importas en la pestaña **Datos**. Las instrucciones están en el [README](../README.md#run-it).

## Cómo explicarlo en 2 minutos

> Cuando buscas proveedores en Google solo encuentras a los que tienen página web, y en Latinoamérica muchos de los mejores no la tienen: son talleres y locales que venden por teléfono o WhatsApp. Supplier Scout busca en OpenStreetMap, un mapa comunitario donde esos negocios sí aparecen porque los registran personas que caminan la calle, y te dice cuántos no tienen web. Con un clic abres la misma búsqueda en Google Maps, sin copiar sus datos. Después no ordena por el precio de lista, sino por lo que realmente cuesta tu pedido, con compra mínima, impuesto y envío, y trata las reseñas con cuidado: pocas reseñas pesan poco y "sin reseñas" es neutro, no malo. Todo lo nuevo pasa por revisión humana y los mensajes son borradores que envías tú.
