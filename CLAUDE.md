# CLAUDE.md

## Antes de empezar: lee la memoria (cerebro)
La memoria de mis proyectos es mi repo **privado** `Dsergio909/cerebro` (copia diaria de mi Obsidian). Al empezar cualquier sesión, antes de proponer o cambiar nada:

1. Abre ese repo (en la nube: agrégalo a la sesión) y lee:
   - `Proyectos/Como trabajar con Sergio.md`: cómo me gusta trabajar, diseño, decisiones tomadas y privacidad.
   - `Como_actualizar_el_cerebro.md`
   - `Proyectos/Supplier Scout.md`: estado y pendientes de este proyecto.
2. Si no puedes abrirlo o la nota todavía no existe, sigue las reglas mínimas de abajo y avísame.
3. Desde la nube el cerebro **solo se lee**. Al terminar con cambios, entrégame un paquete en Markdown con lo que hay que cambiar en cada nota y sección, para pasárselo a Claude Code en mi PC.

## Reglas mínimas (por si no se puede leer el cerebro)
- Háblame en español, simple y paso a paso.
- **Diseño profesional, como software empresarial.** Nada infantil ni con el «look Claude»: sin neón, pixel art, letra de videojuego o de consola, brillos, emojis de adorno ni avatares en caricatura. Estilo de Supplier Radar y Supplier Scout (desde nov-2026): letra del sistema (Segoe UI / -apple-system), fondo claro, un solo azul (#1a5fb4), bordes finos, color solo para estados, modo oscuro automático. El portafolio usa IBM Plex con banda oscura (#14202a) y verde azulado (#0b6b66), aprobado por Sergio.
- **Antes de publicar algo visible** (diseño, textos, imágenes): muéstrame el antes y el después en capturas y espera mi «sí».
- Prueba y audita tú mismo; comprueba con datos reales. Sin cifras inventadas. Quita lo que no sirva.
- No vuelvas a proponer algo que ya se decidió: está en el cerebro.
- Nunca mi número de teléfono, claves, tokens, cédulas ni direcciones exactas. Nada interno de la empresa de mi práctica. Datos de ejemplo siempre ficticios.
- Nada de `push --force` ni borrar ramas o repos sin mi permiso explícito.

## Estado del proyecto (3-nov-2026)
- Búsqueda por capas, no solo mapa: proveedores nacionales (SECOP II, Colombia), tus proveedores con sus condiciones, cercanos (OpenStreetMap) y búsquedas en Google, Facebook y LinkedIn. El orden depende de si es insumo, servicio en sitio o servicio de empresa. Pedido de Sergio: en compras se usan grandes distribuidores nacionales por el despacho y los pagos a plazo, y un proveedor puede cubrir varias categorías.
- Capa nacional: empresas y personas naturales (decisión de Sergio, 3-nov: en LATAM muchos proveedores son personas naturales y a veces más baratas). Se excluyen contratistas de «apoyo a la gestión», Decreto 092, arriendos, tarjetas de identidad, E.S.P. y consorcios. La cédula de una persona nunca se muestra, guarda ni exporta. Un contrato real como ejemplo; teléfonos con indicativo.
- Mi lista: varias categorías por proveedor, condiciones comerciales y meta de 3 cotizaciones por categoría. Las pestañas Cotizaciones, Fuera de internet, Revisión y Datos se quitaron de la web (siguen en la CLI y el agente).
- Probado con datos reales en GitHub Actions (live-check.yml): 58 de 58 proveedores (empresas y personas naturales) verificados por documento en 12 búsquedas, 0 contratos de personal de apoyo colados y 21 de 21 negocios del mapa; 198 pruebas; accesibilidad (axe) sin fallas.
- Un distribuidor que no le vende al Estado no sale en la capa nacional: se encuentra por las búsquedas en internet y se guarda en Mi lista (comprobado con un caso real; detalle en el cerebro, no en este repo público).

## Registro de carrera
Al cerrar ("cierra el chat") o cuando diga "registra esto", revisa si pasó algo que cumpla al menos uno de estos criterios: terminé o entregué algo, tomé una decisión importante con su razón, obtuve un resultado concreto, aprendí una herramienta usándola de verdad, o algo falló y entendí por qué. Si nada cumple, dime "nada para registrar".

- En mi Google Drive, carpeta Cerebro: Carrera/REGISTRO.md (registro) y Carrera/00_Carrera.md (formato).
- Si aparece una copia que dice "Este cerebro se mudó" (por ejemplo, en la carpeta vieja `Cerebro_Carrera`), ignórala.

Puedes escribir la entrada tú mismo: agrégala al final de REGISTRO.md sin editar ni borrar las anteriores, y confírmame en una línea. Si tu herramienta no puede agregar al final sin reemplazar el archivo completo o crear uno nuevo (por ejemplo, el conector de Drive desde la nube), no lo hagas: entrégame la entrada en un bloque de código para que yo la pegue.

Si no puedes leer 00_Carrera.md, usa este formato:

```markdown
## AAAA-MM-DD · <Proyecto> · <título corto>
- Qué hice:
- Problema que resuelve:
- Herramientas:
- Resultado o evidencia: (si no hay cifra real, no se inventa)
- Qué aprendí o qué falló:
- ¿Lo puedo defender en entrevista?: sí / parcial (qué me falta)
- ¿Se puede mostrar en público?: sí / no / solo sin datos internos
```

Máximo 8 líneas. Sin cifras inventadas, sin datos de terceros, sin claves ni rutas privadas.
