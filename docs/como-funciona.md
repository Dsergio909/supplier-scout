# Cómo funciona Supplier Scout

**Español** · [English](how-it-works.md)

Supplier Scout sirve para encontrar proveedores de productos y servicios como se hace en compras: reunir varias opciones para cada necesidad y compararlas antes de pedir cotización. La [demo](https://dsergio909.github.io/supplier-scout/) funciona en el navegador, sin instalar nada y sin crear cuenta.

## El problema

Un mapa responde «¿quién está cerca de mí?». En compras la pregunta es otra: «¿quién me puede surtir esto y en qué condiciones?». Muchas veces la mejor respuesta no está cerca:

1. **Los insumos se compran a empresas nacionales.** La papelería, el aseo, la dotación o el tóner se suelen comprar a distribuidores que despachan a todo el país, facturan electrónicamente y dan crédito a 30, 60 o 90 días o pagos trimestrales. Su bodega está en otra ciudad, así que un mapa nunca los muestra.
2. **Un proveedor puede cubrir varias necesidades.** El que manda la papelería también puede mandar el aseo y la cafetería: un solo proveedor para inscribir, un contrato y una factura.
3. **Compras necesita varias opciones.** Lo normal es pedir tres cotizaciones, y las opciones salen de lugares distintos: los proveedores del Estado, los que ya conoces, el local de la esquina, una página de Facebook, una recomendación.
4. **Muchos buenos proveedores pequeños no están en internet.** Talleres y negocios familiares venden por teléfono o WhatsApp y aparecen en mapas comunitarios, no en Google.

## Buscar

1. En **¿Qué necesitas?** escribe con tus palabras: *papelería*, *dotación de aseo y papelería*, *recarga de extintores*, *vigilancia privada*, *plomero*. También puedes tocar uno de los ejemplos.
2. Escribe **la ciudad o la zona** (*Bogotá*, *Kennedy, Bogotá*, *San Gil*) o pulsa **Usar mi ubicación**. Elige el **país**.
3. Pulsa **Buscar**. Arriba aparece lo que entendió y por qué ordena así los resultados:
   - **Insumos** (papelería, aseo, dotación, empaques): *se pueden despachar desde cualquier ciudad, así que primero van los proveedores nacionales*.
   - **Servicios en sitio** (plomero, cerrajero, electricista): *alguien tiene que ir al sitio: primero van los proveedores cercanos*.
   - **Servicios que suelen prestar empresas** (vigilancia, extintores, fumigación): verás nacionales y cercanos.

Los resultados salen en cuatro capas.

### 1. Proveedores nacionales (Colombia)

Empresas **y personas naturales** que ya les venden esa necesidad a entidades públicas, según **SECOP II**, el sistema de compras públicas de Colombia, que publica cada contrato como dato abierto en datos.gov.co.

| Columna | Qué dice |
|---|---|
| Proveedor | Nombre y ciudad registrada; el NIT si es empresa, o *Persona natural* (su cédula no se muestra) |
| Alcance | **Nacional** si vendió en 3 o más departamentos en los últimos 2 años, **Regional** si en 2, **Local** si en 1, y si incluye tu zona |
| Contratos | Cuántos contratos de eso firmó y la fecha del último |
| Qué ha vendido | **Un contrato real como ejemplo**, como *Suministro de papelería, útiles de oficina, tóner y tintas…*. Así ves por qué aparece |
| Contacto | Teléfono, correo y página web que el proveedor registró en SECOP. Los fijos viejos de 7 cifras salen con su indicativo (601, 604…) para que se puedan marcar |

- **Por qué sirve:** una empresa que vende en muchos departamentos ya despacha a todo el país, factura formalmente y maneja volumen. Es el tipo de proveedor que da crédito o pagos trimestrales.
- **Varias necesidades:** si pides *aseo y papelería*, primero van las empresas que venden las dos cosas.
- **Tus palabras primero:** si escribiste algo más específico que la categoría (*tóner para impresora* en vez de *papelería*), primero van las empresas que vendieron exactamente eso.
- **Empresas y personas naturales.** En Latinoamérica muchos proveedores son personas naturales, y a veces son más baratas: en SECOP ganan entre el 30 y el 40 % de los contratos de papelería, extintores, fumigación o aires acondicionados. Arriba de la tabla puedes ver **Todos**, solo **Empresas** o solo **Personas naturales**.
- **Lo que se deja por fuera:** las personas que el Estado contrata casi como empleados (*prestación de servicios profesionales y de apoyo a la gestión*, *operario*, *sin subordinación*), los convenios con entidades sin ánimo de lucro (Decreto 092 de 2017), los arriendos, los documentos de menores de edad, las empresas de servicios públicos (E.S.P.) y los consorcios y uniones temporales.
- **Cuidado con los datos de una persona.** Su NIT es su cédula: la app la usa solo para buscar su contacto público y **nunca la muestra, ni la guarda en Mi lista, ni la exporta**; Google se busca por su nombre y ciudad. Su teléfono y correo son datos personales: úsalos solo para pedir cotización (Ley 1581 de 2012).
- **Antes de comprarle a una persona natural:** pide su RUT; si no factura electrónicamente, tu empresa emite el *documento soporte*; si es un servicio, pide también el pago de seguridad social. La solicitud de cotización ya le pide sus propios papeles (cédula, RUT, certificación bancaria y registro mercantil si tiene), no los de una empresa.
- **Agregar a mi lista** lo guarda con su contacto y cobertura (y el NIT si es empresa). **Buscar en Google** abre su nombre (y el NIT si es empresa) en Google para ver su página, reseñas o noticias.

Para otros países todavía no hay un registro conectado: la capa lo dice y deja las búsquedas en internet.

### 2. Tus proveedores para esto

Los que ya guardaste en **Mi lista** para esas categorías, con sus condiciones. Si no tienes, **Agregar un proveedor que ya conozco** abre el formulario.

### 3. Cerca

Negocios reales de **OpenStreetMap**, el mapa comunitario donde personas registran locales y talleres caminando por la calle; por eso aparecen muchos negocios sin página web.

- Un mapa con el radio de búsqueda y un número por negocio; tocar el número lleva a su tarjeta.
- El tiempo aproximado en carro (servicio OSRM, sin tráfico), la dirección, el horario y el teléfono cuando el mapa los tiene.
- Para insumos esta capa no se carga sola: pulsa **Buscar también tiendas cerca**.
- Abajo dice cuántos encontró, cuántos no tienen página web y cuántos tienen teléfono.

**El lugar.** Si escribes solo *Barranquilla* o *San Gil*, busca en todo el municipio (hasta 10 km del centro en ciudades grandes, y te avisa). Si hay pueblos con el mismo nombre (*San Pedro*), dice cuál eligió y ofrece los otros. Si escribes *Lima* con Colombia elegido, lo busca en el resto del mundo y cambia el país.

### 4. Buscar en internet

Búsquedas listas que se abren en otra pestaña:

| Botón | Qué busca |
|---|---|
| Google: mayoristas | *papelería mayorista para empresas Colombia* |
| Google: despacho nacional | *distribuidor de papelería con despacho nacional Colombia* |
| LinkedIn: empresas | Páginas de empresas del sector |
| Google: en la zona | La necesidad más tu zona |
| Facebook: páginas | Páginas de negocios (muchos proveedores pequeños solo están ahí) |
| Google Maps | La misma búsqueda en el mapa de Google, que suele tener más negocios, fotos y reseñas |

Para un servicio en sitio (un plomero) solo aparecen las búsquedas de la zona. Son enlaces normales: Supplier Scout no copia datos de esos sitios (copiar datos de Google o Facebook va contra sus condiciones). Si encuentras uno bueno, agrégalo a tu lista con **Agregar proveedor**.

## Mi lista: de las opciones a la decisión

En compras se reúnen varias opciones, se piden **al menos tres cotizaciones** y se comparan en un **cuadro comparativo** antes de elegir. **Mi lista** sigue ese proceso.

- **Agregar proveedor:** pega un mensaje de WhatsApp, una tarjeta o un correo y pulsa **Llenar desde el texto**. La app saca el nombre, el teléfono, el correo, los días de crédito, a dónde despacha y qué vende, y dice qué llenó para que lo revises. Funciona sin IA y sin internet.
- **Cada proveedor puede tener varias categorías** (papelería y aseo) y sus **condiciones comerciales**: días de crédito, forma de pago (de contado, mensual, trimestral u otra), a dónde despacha (local, regional o nacional), si da factura electrónica, precio, tiempo de entrega y notas.
- **Avance por categoría:** arriba ves *Papelería y oficina: 1 de 3 cotizaciones*, y puedes filtrar la lista por categoría.
- **Estado:** *Por contactar*, *Contactado*, *Cotizó*, *Elegido* o *Descartado*.
- **Pedir cotizaciones** arma un mensaje para cada proveedor por contactar, con su nombre, que también pide los documentos para inscribirlo como proveedor (en Colombia: RUT, Cámara de Comercio, certificación bancaria y cédula del representante legal). Lo abres en WhatsApp o en tu correo, o lo copias, y el proveedor pasa a *Contactado*.
- **Verificar empresa:** enlaces a RUES y DIAN (o al portal tributario de cada país).
- **Descargar cuadro (Excel):** un archivo que abre en Excel o Google Sheets con contacto, NIT, categorías, cobertura, crédito, forma de pago, factura electrónica, precio, entrega, estado y notas.

La lista se guarda solo en tu navegador.

## Comprobado con datos reales

En noviembre de 2026 la app se probó contra los servicios reales con un flujo manual de GitHub Actions (`live-check.yml`): las consultas de SECOP II con el mismo código de la página, cada empresa verificada por su NIT en los datos de SECOP y en el registro de proveedores, la búsqueda en OpenStreetMap y la página completa en un navegador, en computador y en celular. Última ronda (3 de noviembre de 2026): **10 búsquedas nacionales** (papelería, aseo y papelería, recarga de extintores, vigilancia privada, vigilancia, cajas de cartón, tóner, uniformes, productos de aseo y plomero). En 9 las empresas son del tipo correcto; para *plomero* salen proveedores de ferretería y mantenimiento, porque el Estado casi nunca contrata la plomería sola. **Las 40 empresas revisadas por NIT** tienen contratos con ese NIT y están en el registro de proveedores de SECOP, y **los 21 negocios del mapa revisados** existen en OpenStreetMap con el mismo nombre. En el navegador las búsquedas tardaron de 3 a 9 segundos, en computador y en celular, sin errores y sin nada más ancho que la pantalla. La primera ronda fue la que dio forma a esta versión: con una sola palabra salían empresas equivocadas (*vigilancia* traía vigilancia epidemiológica y *empaques* traía lavanderías), aparecían personas naturales con su cédula, los fijos viejos no tenían indicativo y la tabla nacional se salía de la pantalla del celular. Todo eso quedó corregido y con pruebas. **Con personas naturales (segunda ronda, el mismo día):** 12 búsquedas nacionales; las personas naturales son entre 15 y 20 de los 40 proveedores en la mayoría (2 en vigilancia privada, 0 en cajas de cartón), ninguna es un contrato de personal de apoyo, y los 58 proveedores revisados (empresas y personas) tienen contratos con ese documento y están en el registro. Hay personas naturales con alcance nacional: una que recarga extintores vende en 17 departamentos. Ninguna cédula aparece en pantalla (revisado en el navegador) ni en los resultados publicados. El mapa solo no encontró nada en 6 de 12 búsquedas (cajas de cartón en Fontibón, recarga de extintores en Cali, cerrajero en San Gil): por eso es una capa de cuatro.

## Límites

- La capa nacional existe solo para Colombia.
- SECOP muestra quién le vende al Estado. Es una buena señal de capacidad y formalidad, pero no es todo el mercado: muchos buenos proveedores nunca le venden al Estado. Por eso están las otras capas.
- El ejemplo es uno de los contratos de la empresa y el contacto es el que ella registró en SECOP: **confirma por teléfono antes de comprar**.
- El mapa depende de lo que la comunidad haya registrado: para plomeros, cerrajeros o recarga de extintores a veces encuentra pocos o ninguno. Para eso están Google Maps y Facebook.
- Los tiempos en carro no tienen en cuenta el tráfico.

## Privacidad y seguridad

- La página solo se conecta a datos.gov.co (SECOP II), al buscador de lugares de OpenStreetMap (Nominatim), a sus datos (Overpass) y a los tiempos en carro (OSRM), y solo cuando pulsas **Buscar**. Lo garantiza una política de seguridad (CSP) en la propia página.
- A datos.gov.co solo se envían las palabras buscadas. Si usas tu ubicación, se envía redondeada a unos 100 m.
- No hay cookies, cuentas ni analítica. Tu lista se queda en tu navegador.
- La página no construye HTML a partir de texto externo (Trusted Types activado): un nombre malicioso en el mapa o en SECOP no puede ejecutar código.
- Los mensajes son **borradores**: los revisas y los envías tú.

## Para usuarios avanzados

Fuera del navegador, el mismo código tiene una línea de comandos y un agente opcional con la API de Claude: conectores (OpenStreetMap, SECOP II, datos de compras públicas OCDS, portales Socrata, CSV de ferias y cámaras de comercio, Google Places con tu propia clave), costo real del pedido (paquetes, compra mínima, impuesto, envío, moneda y plazo de pago), reseñas justas, confianza por recomendaciones y detección de duplicados. Instrucciones en el [README](../README.md#run-it).

## Cómo explicarlo en 2 minutos

> Escribes lo que necesitas, por ejemplo «papelería», y tu ciudad. En compras, la papelería no se le compra a la papelería del barrio: se le compra a distribuidores grandes que despachan a todo el país y dan crédito. Supplier Scout los encuentra en los datos abiertos de compras públicas: empresas que ya le venden papelería al Estado en muchos departamentos, con un contrato real de ejemplo y su contacto. Si pides aseo y papelería, primero salen las que venden las dos cosas. Luego ves los proveedores que ya tienes con sus condiciones de pago, los negocios cercanos en el mapa y búsquedas listas en Google, LinkedIn y Facebook. Si buscas un plomero, el orden cambia: primero los cercanos. Guardas los que te sirven, pides las tres cotizaciones por WhatsApp o correo y descargas el cuadro comparativo.
