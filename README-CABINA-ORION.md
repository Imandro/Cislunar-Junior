# Especificación de cabina Orion para Cislunar Junior

Guía de diseño para que la cabina del simulador se sienta como una nave moderna
inspirada en Orion y Artemis II, sea legible y funcione con las mismas reglas en
todas las misiones.

## Decisión de diseño del simulador

El juego mantendrá **una interfaz común inspirada en Orion** para Saturn V,
SLS/Orion y el transporte a Marte: misma distribución de pantallas, navegación,
mandos y lectura de alarmas. Así el jugador no tiene que aprender otra cabina al
cambiar de misión.

Esto es una **convención visual del juego**, no una afirmación histórica. No
existe una cabina real idéntica para todos esos vehículos: Apollo y Orion son
naves distintas, y el transporte marciano del juego es un concepto. Los nombres,
la geometría exterior y los datos de misión deben seguir identificando el
vehículo activo. La interfaz común puede cambiar sus páginas y funciones según
la misión sin cambiar su posición física.

La meta es una cabina **Orion-inspired**, no una réplica técnica certificada ni
una copia exacta del hardware, software o procedimientos operativos de NASA.
Las cifras y referencias de Orion que siguen se documentan por separado de las
decisiones educativas del simulador.

## Referencia pública de Orion

NASA describe para Orion cuatro asientos de tripulación, tres unidades de
visualización, siete paneles de interruptores, dos mandos rotacionales, dos
mandos traslacionales y dos dispositivos de control de cursor. Las tres
pantallas están delante de los puestos de comandante y piloto; la central es
compartida. Los bordes de pantalla tienen teclas físicas, y los CCD permiten
operar las pantallas desde el asiento. La cabina también incluye sistemas de
soporte vital y equipo habitable.

Fuentes primarias:

- [NASA — Crew Systems: Orion, asientos, displays y controles](https://www.nasa.gov/reference/crew-systems/)
- [NASA — How to Fly NASA’s Orion Spacecraft: RHC, THC y CCD](https://www.nasa.gov/missions/artemis/orion/how-to-fly-nasas-orion-spacecraft/)
- [NASA — Meet NASA’s Orion Spacecraft: interfaz y soporte vital](https://www.nasa.gov/missions/meet-nasas-orion-spacecraft/)
- [NASA — Orion Reference Guide (PDF)](https://www.nasa.gov/wp-content/uploads/2023/02/orion-reference-guide-111022.pdf)

El simulador no necesita reproducir cada cable, panel o procedimiento del
vehículo real. Debe representar las funciones y relaciones espaciales que hacen
comprensible una cabina Orion.

## Distribución de la cabina

### Campo de visión

- La cámara se coloca desde el punto de vista de la tripulación, mirando hacia
  delante desde un asiento de comandante/piloto.
- El parabrisas debe seguir siendo la mayor superficie visual libre. El panel
  queda debajo de la línea de visión y no tapa el horizonte ni el cohete durante
  el lanzamiento.
- La vista interior es estable: las flechas, la rueda y los controles del mapa
  no deben rotar ni acercar el exterior. Solo Exterior permite mover/acercar la
  cámara de seguimiento; el mapa conserva su propio zoom.
- La geometría que se muestra y sus áreas de clic deben coincidir. Ningún
  monitor debe recibir clics por una zona que visualmente pertenezca al marco o
  a otro monitor.
- La cabina debe funcionar en 16:9, 16:10, 4:3 y ventanas estrechas. En una
  ventana pequeña se priorizan parabrisas, los tres displays y controles
  esenciales; los paneles laterales secundarios pueden pasar a una página o
  acercamiento, nunca cubrir datos importantes.

### Tres unidades de visualización

Mantener las tres pantallas frontales de Orion: DU1 a la izquierda, DU2 al
centro y DU3 a la derecha. Las laterales se orientan hacia el asiento; DU2 se
comparte. Deben tener marcos, profundidad, reflejos discretos y teclas de borde,
sin convertirse en tres tarjetas flotantes sobre el cristal.

| Display | Uso recomendado en el simulador |
|---|---|
| **DU1 — comandante** | Mapa y orientación: cuerpo central, órbita, trayectoria prevista, posición actual, siguiente hito y distancias. |
| **DU2 — compartido** | Estado principal de vuelo: fase, tiempo, altitud, velocidad, actitud, propelente, energía, soporte vital y mensajes de prioridad. |
| **DU3 — piloto** | Estado de sistemas, propulsión, energía, comunicaciones y procedimientos activos. |

El reparto es una propuesta funcional del simulador, no una asignación oficial
de pantallas para cada evento real de Artemis II. Las páginas pueden cambiar
con el contexto, pero los datos no deben duplicarse con valores incompatibles.

### Interacción con pantallas

- Añadir teclas físicas alrededor del bisel y un control tipo cursor/selector
  junto a cada puesto. Permitir ratón como facilidad de juego, pero conservar
  una navegación equivalente por teclado.
- Mostrar selección, foco, pulsación y estado deshabilitado de forma clara.
  Los controles tienen área de interacción generosa y respuesta inmediata.
- Los módulos Mapa, Telemetría y Sistemas se abren en el display seleccionado.
  Comunicaciones y Checklist también quedan disponibles desde teclas de acceso
  o controles auxiliares; Controles se asocia a los mandos de vuelo.
- Una ampliación se presenta como página dentro del display/cabina. Debe poder
  cerrarse y devolver el foco a la pantalla anterior sin perder misión, cámara,
  zoom de mapa, selección ni scroll.
- El monitor no muestra decisiones de preparación encima de telemetría. Las
  decisiones y briefing se presentan como procedimientos/modales posponibles;
  los monitores siguen visibles alrededor.
- Nada de clics de misión debe depender exclusivamente de un botón físico
  diminuto o de acertar un píxel.

## Mandos físicos y paneles

- Representar las dos familias de mando, aunque la cámara use el puesto del
  piloto: **RHC** para rotación/actitud y **THC** para traslación.
- Darles silueta, empuñadura, base, ejes y estados visuales propios. Al activar
  un mando, mostrar en un indicador qué eje y sentido se está ordenando; no
  confundir actitud con movimiento lineal.
- Mantener teclas de borde, interruptores y perillas visibles bajo o junto a
  los displays. Los interruptores pueden resumirse en grupos de sistema; no es
  necesario dibujar decenas de controles minúsculos.
- Incluir mandos de cursor para navegar pantallas y un acceso rápido a alarmas y
  procedimientos urgentes. En gravedad alta, el simulador debe permitir operar
  sin exigir alcance físico a cada zona de pantalla.
- Si un control no está implementado, que se vea inactivo y tenga una
  explicación breve. No presentar controles decorativos como si produjeran un
  efecto real.

## Contenido de pantallas

### Telemetría de vuelo

Mostrar siempre unidades y etiquetas, con actualización desde el mismo estado
que usa el motor de misión:

- fase, tiempo de misión y tiempo hasta el siguiente hito;
- altitud sobre el cuerpo local, velocidad y vector/actitud cuando estén
  disponibles;
- propelente o Δv, energía, soporte vital, agua/alimento y protección frente a
  radiación;
- cuerpo de referencia y estado de etapa/configuración;
- fuente y calidad de la lectura: calculada, simulada, estimada o no disponible.

No inventar precisión: si la física de una misión no calcula una variable,
mostrar «estimación educativa» o «sin dato» en vez de un número engañoso.

### Ruta

- En ruta interplanetaria: Sol como referencia, órbitas esquemáticas, cuerpos
  relevantes, trayectoria, posición de la nave, dirección, destino y próximo
  hito.
- En lanzamiento y vuelo cislunar: Tierra, Luna y órbita/ruta pertinente, con
  un encuadre que permita reconocer las distancias relativas.
- Etiquetar claramente cualquier mapa que no esté a escala. El zoom y el
  centrado afectan solamente al mapa.

### Sistemas

Agrupar estado por sistema en lugar de una lista apretada:

- guiado, navegación y control (GNC);
- propulsión y propelente;
- energía y generación/almacenamiento;
- soporte vital y ambiente de cabina;
- comunicaciones y enlaces;
- térmico y protección;
- configuración de vehículo y etapas.

Cada indicador presenta nombre, estado textual e intensidad. Color acompaña al
texto, nunca lo sustituye: **Normal**, **Atención**, **Alarma**, **Fuera de
línea** o **Sin telemetría**. Un sistema no aplicable a ese vehículo se marca
«No instalado / No aplica», no como averiado.

### Comunicaciones y checklist

- Identificar interlocutor/canal, hora, estado del enlace y último mensaje.
- Dar prioridad visual a instrucciones de misión y alertas; distinguirlas de
  ambientación o mensajes informativos.
- Checklist asociado a fase y vehículo. Mostrar pasos completados, paso actual,
  bloqueos y confirmación requerida. No permitir marcar como hecho un paso que
  el estado de misión aún no admite.
- Al abrir un procedimiento, mantener a la vista la alarma relacionada y el
  sistema afectado.

## Alertas y seguridad de interacción

- Tres niveles legibles y consistentes: aviso informativo, precaución y alarma
  urgente. Usar texto, icono/forma, color y sonido configurable.
- La alarma urgente debe poder abrir su procedimiento desde cualquier pantalla
  y quedar distinguible aunque el usuario haya abierto otra vista.
- No saturar con alertas repetidas: actualizar una alerta activa en vez de
  duplicarla cada fotograma.
- Confirmaciones explícitas para acciones de misión irreversibles dentro del
  juego; posponer no debe descartar la decisión ni ocultar la lectura del
  vehículo.
- El modo silencioso o reducir movimiento no debe eliminar el estado visual de
  una alerta.

## Habitabilidad que debe sugerir el modelo 3D

La cabina no es solo un tablero. Debe sugerir un volumen habitable, con objetos
asegurados para microgravedad y lugares reconocibles para la tripulación:

- cuatro puestos sugeridos por el volumen interior, aunque la vista del jugador
  esté sentada en uno;
- asiento delantero con respaldo, reposacabezas, apoyabrazos, sujeción de cinco
  puntos y soporte para pies; la cabina y la postura cambian entre lanzamiento,
  microgravedad y reentrada solo si la simulación representa ese cambio;
- estructura interior, laterales, portillos/ventanas, iluminación de trabajo y
  servicio, ventilación y almacenamiento asegurado;
- señales visuales de soporte vital: presión, temperatura, humedad, ventilación,
  CO₂ y condición de cabina, sin fingir que se simula hardware detallado;
- equipo de supervivencia y elementos de habitabilidad contextualizados en
  páginas o zonas laterales cuando el encuadre no permita modelarlos sin tapar
  la visión: traje, agua, alimento, equipo médico, residuos y refugio de
  radiación;
- sonidos ambientales y avisos opcionales, con volumen y reducción de
  movimiento configurables.

No hace falta llenar la pantalla de cables ni modelar cada tornillo. Se prioriza
la escala humana, el orden, los objetos sujetos y una iluminación que permita
leer los instrumentos.

## Coherencia entre misiones

Antes de renderizar cualquier vista, construir un único paquete de estado de
misión y compartirlo con Cabina, Instrumentos, Exterior, Ruta y los monitores.
Como mínimo debe contener:

```text
misión · vehículo · fase · tiempo · progreso · cuerpo de referencia
posición · velocidad · actitud · etapa/configuración
telemetría · sistemas · ambiente exterior · alertas · checklist
```

- Cabina e Instrumentos representan el mismo lugar, hora, cuerpo, clima,
  iluminación y estado de vuelo. La vista de instrumentos puede ampliar una
  pantalla, no teletransportar la escena.
- Exterior cambia el punto de vista, no el estado de vuelo.
- La atmósfera, nubes, horizonte y oscurecimiento dependen de altitud/fase y del
  cuerpo actual. En ascenso terrestre, el azul pierde intensidad gradualmente
  por capas y el cielo pasa a negro al abandonar la atmósfera; no aplicar cielo
  terrestre a una fase lunar, orbital o de Marte sin motivo.
- Ruta deriva su marcador de la posición y progreso del mismo paquete; nunca
  avanza con un reloj independiente.
- Cambiar de misión configura vehicle-data y páginas de sistemas, pero mantiene
  la plantilla física Orion-inspirada para cumplir la decisión de diseño del
  juego.

## Guía visual

- Paleta sobria de cabina: panel grafito, biseles oscuros, pantallas emisivas de
  alto contraste y acentos limitados a estados/selección.
- Evitar la rejilla decorativa detrás de todo el texto. Reservar el fondo para
  mapas; usar superficies sólidas en telemetría, checklist y procedimientos.
- Tipografía sans serif legible; cifras tabulares para lecturas que cambian;
  nunca hacer del microtexto un requisito para entender el estado.
- Priorizar 4–6 datos clave en primer plano; el resto se abre como detalle. Las
  unidades se escriben junto al valor y el contraste se valida tanto en cabina
  oscura como iluminada.
- Marcos, botones y mandos mantienen perspectiva coherente, espesor, sombras y
  puntos de anclaje. No deben flotar, cruzarse con el parabrisas ni bailar al
  navegar los monitores.
- La cámara y el tablero deben permanecer estables durante zoom, movimiento del
  ratón o navegación interna. Solo cambia la vista exterior cuando se selecciona
  Exterior.

## Relación con los módulos existentes

Reutilizar la estructura del proyecto; no crear una segunda implementación de
los instrumentos:

| Módulo | Responsabilidad que debe conservar |
|---|---|
| `js/cockpit.js` | Geometría de la cabina, monitores, zonas de clic y controles físicos. |
| `js/hud_flight.js` | Pintado, tipografía, estados e interacción visual de cada display. |
| `js/cabina_enlace.js` | Traducción del estado de misión a las vistas y rutas de acciones. |
| `js/controls.js` | Foco, teclado y separación entre navegación de cabina y mando de vuelo. |
| `js/flight.js` / `js/orbital.js` | Estado calculado de vuelo y cuerpo de referencia; no duplicarlo en HUD. |
| `Cislunar Junior - Cañon Labs.html` | Selección de vista, ciclo de render y composición general. |

No añadir dependencias para el rediseño. Los datos desconocidos deben tener un
estado explícito y no causar errores de renderizado.

## Orden de implementación

1. **Congelar la referencia de interfaz:** punto de vista, posición de displays,
   mandos y zonas de interacción para los tamaños soportados.
2. **Alinear geometría y clic:** cada superficie visual debe corresponder a su
   raycast/zona accesible; comprobar ratón, teclado y cursor.
3. **Consolidar el estado único:** validar que Cabina, Instrumentos, Exterior y
   Ruta reflejen el mismo tiempo, fase, cuerpo, clima y telemetría.
4. **Pulir pantallas:** jerarquía tipográfica, contraste, unidades, alarmas,
   páginas por fase y adaptación a pantallas pequeñas.
5. **Completar controles físicos:** RHC, THC, CCD y mandos de borde con estados
   funcionales o deshabilitados explícitos.
6. **Agregar habitabilidad visible sin congestión:** asientos, estructura,
   ventilación, almacenamiento y señales de sistemas de soporte vital.
7. **Revisar cada vehículo y misión:** validar que la plantilla común se sienta
   continua sin presentar como histórico lo que es una licencia de juego.

## Criterios de aceptación

## Estado de implementación

- [x] Tres displays físicos bajo el parabrisas: **DU1 · Ruta**, **DU2 · Vuelo**
  y **DU3 · Sistemas**, con teclas de bisel y mandos auxiliares visibles.
- [x] Cada display y mando abre una pantalla ampliada sobre la cabina y vuelve
  a la misma vista sin desplazar la cámara exterior.
- [x] La cabina incorpora revestimientos, ventilación, agarraderas, consola
  inferior y señalización de mandos para que el tablero no parezca flotante.
- [x] El punto de vista incorpora asientos, reposapiés, pedales, consola central
  e iluminación tenue sin tapar el parabrisas ni los tres displays.
- [x] La rejilla queda reservada al mapa; telemetría y sistemas usan fondos
  sólidos. Los campos que no aporta el simulador indican `SIN TELEMETRÍA` o
  `NO DISPONIBLE`.
- [x] Los seis módulos usan encabezado, bandas de estado y filas tácticas. Las
  pantallas físicas resumen datos; el modal muestra el detalle completo y se
  ajusta al espacio disponible sin recortar su canvas.
- [x] Ruta usa un encuadre con margen de rótulos y un zoom independiente.
- [x] Flechas, rueda y `+`/`-` no mueven ni acercan el exterior desde Cabina o
  Instrumentos.
- [x] La mirada desde el asiento usa botón derecho y arrastre, conserva la
  orientación dentro de límites de 45°/25° y puede volver al centro sin mover
  la cámara Exterior. Ventana, cabina y raycast comparten la misma orientación.
- [x] Los seis módulos reutilizan un único bisel ampliado. Comunicaciones y
  Checklist admiten desplazamiento y cada módulo usa una resolución de lectura
  independiente de su pequeño control físico.
- [x] El modo Vuelo libre despega, se reinicia como Vuelo libre y finaliza sin
  volver al flujo de decisiones.
- [x] El primer acceso muestra un tutorial de seis pasos sobre misiones, vistas,
  cámara, instrumentos, decisiones y pilotaje. Puede abrirse de nuevo desde
  Preparación o desde la barra superior durante una misión.
- [x] Las pruebas automatizadas de cabina, simulador, partida y encuadre pasan
  en 1440×810, 1024×768 y 800×700.
- [ ] Validar visualmente el ciclo completo de las cuatro misiones en cada
  tamaño de pantalla indicado abajo.

- [ ] Cabina legible en 16:9, 16:10, 4:3 y ventana estrecha; sin recortes,
  intersecciones o elementos flotantes.
- [x] Tres displays ubicados bajo el parabrisas, con DU2 compartida y teclas de
  bisel visibles.
- [x] Mapa, Telemetría, Sistemas, Comunicaciones, Checklist y Controles se
  pueden abrir, manejar y cerrar sin perder su estado.
- [x] El foco y el clic coinciden con la geometría de cada control; la respuesta
  se percibe al primer clic.
- [x] Flechas y zoom no alteran el exterior desde Cabina/Instrumentos; Exterior
  y el mapa conservan controles separados.
- [ ] Una misma fase muestra la misma escena, hora, ambiente, etapa y lecturas
  en Cabina, Instrumentos y Exterior.
- [ ] Las transiciones atmosféricas siguen la altura y el planeta; ruta,
  telemetría y misión usan el mismo progreso.
- [ ] Alarmas tienen nivel, texto y procedimiento relacionado; color nunca es
  el único indicador.
- [ ] Valores no simulados se marcan como estimados o no disponibles.
- [ ] La interfaz se identifica como inspirada en Orion; no afirma que las
  cabinas de Apollo, SLS y Marte sean hardware idéntico.
- [ ] Las pruebas existentes de misión, partida, cabina y simulador pasan, y se
  revisa visualmente una misión terrestre, Artemis II y Marte.

## Fuentes y precisión

Este documento resume información pública de NASA enlazada arriba y la separa
de decisiones propias del simulador. El software del juego es educativo: no es
un entrenador de vuelo, una reproducción certificada de Orion ni una guía de
procedimientos reales. Revisar las fuentes oficiales antes de presentar datos
como vigentes o exactos.

