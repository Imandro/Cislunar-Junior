# Cislunar Junior — Cañon Labs

**Simulador de decisiones de misión espacial** · NASA Space Apps Challenge 2026

Un archivo HTML, sin instalación, sin servidor y sin conexión a internet.
Abre `Cislunar Junior - Cañon Labs.html` en cualquier navegador y juega.
Con WebGL arrancas **dentro de la cabina**: un cockpit 3D a pantalla completa
donde toda la interfaz vive en monitores físicos del habitáculo.

---

## Cómo jugar

1. Abre `Cislunar Junior - Cañon Labs.html` con doble clic (funciona con `file://`).
2. Si el navegador soporta WebGL, arrancas **dentro de la cabina**: un cockpit 3D a
   pantalla completa donde toda la interfaz —menú, decisiones, telemetría,
   comunicaciones, mapa, checklist— vive en monitores físicos. Sin WebGL el juego
   cae solo al panel clásico descrito al final de esta sección.
3. Elige una de las **cuatro misiones** y en cada evento decide qué hacer.
   Cada opción consume recursos de forma distinta.
4. **Multijugador local**: abre la página en dos pestañas, sienta a un jugador
   distinto en cada asiento y cada uno decide a su turno. Las pestañas se
   sincronizan solas, sin internet.

### Cabina inmersiva

La especificación visual y funcional para la cabina universal inspirada en
Orion/Artemis II está en [README-CABINA-ORION.md](README-CABINA-ORION.md).
Describe los displays, mandos, asientos, alertas, sistemas habitables y cómo
adaptar esa misma interfaz a todos los vehículos del simulador.

El cockpit se recorre con teclado o ratón, y los dos conviven:

| Entrada | Acción |
|---|---|
| `Tab` / `Mayús+Tab` | Monitor siguiente / anterior |
| `F1`–`F6` | Salta directo a comunicaciones, telemetría, sistemas, mapa, checklist o controles |
| `↑` `↓` | Recorre los elementos del monitor con foco |
| `←` `→` | Ajusta el elemento resaltado (deslizadores, listas) |
| `Enter` / `Espacio` | Activa el elemento resaltado |
| `Esc` | Devuelve el mando al vehículo |
| `` ` `` (acento grave) | Conmuta modo ratón / teclado |
| Ratón | Apuntar y pulsar: el clic se resuelve con un rayo contra la geometría real de cada monitor |
| `WASD` / flechas / `Mayús` / `Espacio` | Con el foco fuera de la cabina: vuelo manual (actitud y empuje) |

La **pantalla central** se abre sobre el parabrisas para lo que exige lectura:
menú, ficha de misión, decisiones, ajustes, Academia, laboratorio, créditos e
informe. Los **seis monitores** laterales muestran en todo momento telemetría,
comunicaciones, sistemas, mapa orbital, checklist y controles de vuelo.

### Panel clásico (respaldo sin WebGL)

Sin WebGL el juego es igual de jugable con el panel HTML tradicional:

- **Vehículo 3D** — modelo sólido que puedes rotar arrastrando y acercar con la
  rueda (o con las flechas y `+`/`−`; `1`, `2`, `3` cambian de vista).
- **Escena** — animación 2D de la fase (lanzamiento, descenso, reentrada...).
- **Trayectoria** — la nave en su ruta orbital con la distancia a la Tierra o Marte.
- Justo debajo, el **panel de cabina** muestra altitud, velocidad, Δv reservado,
  fase y las cinco barras de recursos, con una retícula sobre el visor.
- Las **4 pestañas** de la consola muestran la decisión, el estado de los sistemas,
  el registro de comunicaciones y la tripulación.

### Los 5 recursos

| Recurso | Qué representa |
|---|---|
| Soporte vital | Oxígeno y presión de la cabina |
| Energía | Baterías, paneles solares y consumos de los equipos |
| Protección radiación | Blindaje del vehículo y apantallamiento con agua y alimento |
| Agua y alimento | Consumibles de la tripulación y del sistema de reciclaje |
| Propelente | Combustible para impulsivos y quemadas |

Si **cualquiera llega a 0, la misión fracasa**. Ahí está toda la tensión.

### Multijugador local

Abre el mismo archivo en varias ventanas o pestañas del **mismo navegador**.
Cada jugador reclama un puesto de tripulación y solo puede decidir en sus turnos.
Usa `BroadcastChannel`, sin servidor ni red.

---

## Las cuatro misiones

| # | Misión | Fecha | Duración | Vehículo |
|---|---|---|---|---|
| 11 | **Apolo 11** | 16–24 jul 1969 | 8 d 3 h | Saturn V · Columbia + Eagle |
| 13 | **Apolo 13** | 11–17 abr 1970 | 5 d 23 h | Saturn V · Odyssey + Aquarius |
| II | **Artemis II** | ~10 días | ~10 d | SLS · Orion |
| M  | **Marte** | Ventana de conjunción | ~259 d | Transporte profundo + ECLSS |

### La misión a Marte

Siete eventos con sus propias fases (**Preparación · Lanzamiento · Misión · Llegada**):

1. **T−04:00** — Verificación del transporte profundo y el ECLSS antes de la ventana.
2. **Día 1** — Inyección Trans-Marte (TMI), ~2,9 km/s.
3. **Día 60** — Tormenta solar: eyeción de masa coronal, refugio en zona blindada.
4. **Día 120** — Corrección de trayectoria heliocéntrica (thrusters o motor principal).
5. **Día 200** — Preparación de la inserción orbital marciana (MOI).
6. **Día 259** — Quemado de captura: pasar de largo o impacto.
7. **Día 274** — Descenso a la superficie: aeroshell, paracaídas, retrocohetes.

Tiene su propio **modelo 3D** (`MD2.DS`): módulo de servicio, habitáculo de tránsito,
nodo, cápsula de tripulación y paneles solares.

---

## Datos de referencia

Los datos provienen de información pública de la NASA (`nasa.gov`):

- **Apollo 11** — alunizaje en el Mar de la Tranquilidad, 20 jul 1969.
  ~21,5 kg de muestras, 2 h 30 min de actividad extravehicular.
- **Apollo 13** — fallo del tanque de oxígeno 2 a las 55 h 54 min.
  Bote salvavidas en Aquarius, adaptador de CO₂ improvisado en vuelo con materiales
  a bordo, y regreso el 17 abr 1970.
- **Artemis II** — primer vuelo tripulado de Orion y SLS, sobrevuelo lunar
  sin alunizaje. Verifica fechas y datos vigentes en `nasa.gov`.
- **Marte** — transferencia de Hohmann, ventana cada 26 meses,
  distancia máxima de la Tierra a Marte ≈ 55,8 millones de km, ~259 días.

> **Nota importante:** las misiones Apolo son históricas. Artemis II y Marte son
> **conceptos de simulación educativa**; verifica siempre el estado real
> del programa en `nasa.gov`.

---

## Recursos gráficos

### Imágenes de NASA (dominio público)

Las fotografías de las misiones son material de la NASA publicado en
[images.nasa.gov](https://images.nasa.gov), bajo su
[política de uso de medios](https://www.nasa.gov/nasa-brand-center/images-and-media/):
el contenido de la NASA no tiene derechos de autor en EE. UU. y su uso comercial
está permitido.

| Archivo | NASA ID | Contenido |
|---|---|---|
| `assets/apolo11.jpg` | `as11-40-5927` | Módulo lunar Apolo 11 sobre la superficie lunar |
| `assets/apolo13.jpg` | `S70-34902` | Centro de control durante el incidente de oxígeno del Apolo 13 |
| `assets/artemis2.jpg` | `KSC-20230602-PH-GEB01-0010` | Módulo de tripulación Orion para Artemis II |
| `assets/marte.jpg` | `PIA14838` | Curiosity y etapa de descenso (concepto artístico) |

Optimizadas a 900 px de ancho y calidad 78 (41 % menos de peso).

### Arte original de Cañon Labs

**Nada proviene de third parties.** Lo siguiente es original:

- **Iconos vectoriales** (`js/iconos.js`) — trazados geométricos propios:
  lanzador de tres etapas, lanzador pesado, transporte interplanetario,
  planeta rojo, cohete de laboratorio y emblema del proyecto.
- **Modelos 3D** (`MD2`) — Saturn V, SLS, Apolo, Orion y transporte marciano,
  construidos con geometría procedural.
- **Pantalla de arranque** — emblema orbital animado en canvas.
- **Iconografía del laboratorio** — presupuesto, barras y trayectoria.

> El APK analizado durante la fase de investigación **no aportó código, assets
> ni textos** a este proyecto. Solo se estudiaron conceptos de diseño
> (construcción por etapas, propagación orbital, fluidos) que se reimplementaron
  desde cero con la física pública correspondiente.

---

## Detalles técnicos

- **HTML5 + CSS3 + JavaScript**. Sin frameworks, sin CDN, sin npm, sin build.
- **Renderizado 3D** con dos caminos: un núcleo **WebGL** propio
  (`js/glcore.js`, shaders GLSL con iluminación difusa, especular Blinn-Phong,
  niebla de distancia y separación de superficies opacas y translúcidas) y,
  si el navegador no soporta WebGL, un **respaldo en `<canvas>` 2D** con
  proyección perspectiva y orden de pintor. Ambos comparten la misma
  geometría procedural.
- **Cabina inmersiva** (`js/cockpit.js`): con WebGL, un habitáculo 3D —salpicadero,
  parabrisas, consola de techo, mamparas, palancas— rodea la cámara con seis
  monitores físicos y una pantalla central. Vive en espacio de cámara (cabecea
  con la vista pero nunca se aleja), se pinta tras el mundo sin prueba de
  profundidad y cada pantalla es un lienzo 2D que se sube como textura cada
  fotograma. El ratón se resuelve con un **raycast Möller–Trumbore** contra la
  geometría real de cada monitor, así que lo que se ve y lo que se puede pulsar
  coinciden exactamente.
- **Interfaz diegética** (`js/hud_flight.js`): un kit de UI propio sobre canvas
  —cajas, texto con ajuste de línea, barras, LEDs, rejillas— y un pintor por
  monitor (telemetría, comunicaciones, sistemas, mapa, checklist, controles) y
  por pantalla central (menú, misión, decisión, informe, ajustes, Academia,
  laboratorio, créditos, pausa). Las pantallas son emisivas: no reciben la luz
  de la escena.
- **Puente partida ↔ cabina** (`js/cabina_enlace.js`): traduce el estado de la
  partida a las cargas de cada monitor y enruta las acciones de vuelta al juego;
  decide qué pantalla central está abierta y la mantiene coherente con la fase.
- **Doble mando** (`js/controls.js`): vuelo y cabina nunca se pisan. `Tab` entrega
  el foco a los monitores (las flechas navegan), `Esc` lo devuelve (las flechas
  vuelan), y `` ` `` conmuta el modo de entrada.
- **Panel de cabina clásico** (`js/cabina.js`): instrumentos de altitud, velocidad,
  Δv, fase y recursos, más una retícula dibujada sobre el visor. El módulo no
  guarda estado ni toca el DOM por su cuenta, así que es verificable por sí solo.
- **Mecánica orbital kepleriana** (`js/orbital.js`): ecuación vis-viva,
  conversión elementos ↔ vector de estado, propagación por Newton-Raphson,
  transferencia de Hohmann y perfil de ascenso con gravedad y arrastre.
- **Laboratorio de vehículos** (`js/vehiculo.js`): ecuación de Tsiolkovski,
  empuje sobre peso inicial (TWR) y presupuesto por etapa.
- **Presupuesto de recursos** lineal por evento con límites 0–100 y un
  porcentaje de incidente imprevisto por opción.
- **Multijugador local** por `BroadcastChannel`: varias pestañas reparten
  asientos de la tripulación y turnos de decisión, sin internet.
- **Persistencia** opcional en `localStorage` (diseños y ajustes), envuelta en
  `try/catch` para que funcione también donde está bloqueada.
- **Audio** con Web Audio API para las alertas.
- **Sin dependencias externas.** Funciona con `file://` y por HTTP.

### Estructura de archivos

```
Cislunar Junior - Cañon Labs.html   Juego principal (misiones, cabina y consola)
assets/                             Fotografías de NASA (dominio público)
js/orbital.js                       Mecánica orbital kepleriana
js/vehiculo.js                      Laboratorio de vehículos (Tsiolkovski)
js/glcore.js                        Núcleo de renderizado WebGL (shaders propios)
js/cockpit.js                       Cabina inmersiva: geometría, monitores, raycast
js/hud_flight.js                    Kit de UI en canvas y pintor de cada monitor
js/cabina_enlace.js                 Puente partida ↔ cabina y pantallas centrales
js/controls.js                      Doble mando: teclado/ratón de vuelo y de cabina
js/flight.js                        Física de vuelo manual (actitud, empuje, atmósfera)
js/stages.js                        Checklist por fase y vehículo
js/academia.js                      Flight Academy
js/mision_vuelo.js                  Empareja fases de misión con vuelo manual
js/cabina.js                        Panel clásico de instrumentos y retícula
js/iconos.js                        Iconos vectoriales originales
js/creditos.js                      Créditos y licencias de las imágenes
js/arranque.js                      Pantalla de carga y transiciones
js/laboratorio.js                   Interfaz del laboratorio de cohetes
tools/prueba_simulador.js           Arnés del simulador (mil seiscientas comprobaciones)
tools/prueba_cabina.js              Arnés de la cabina inmersiva (222 comprobaciones)
tools/prueba_orbital.js             Suite de física orbital (75 comprobaciones)
tools/prueba_vehiculos.js           Suite del laboratorio de vehículos (73)
tools/prueba_fisica.js              Suite de física de vuelo manual
tools/prueba_mision.js              Consecuencias del vuelo sobre la partida (41)
test_flight_integration.js          Integración de vuelo manual (62 comprobaciones)
test_academia.js                    Integración de la Academia
tools/prueba_mision.html            Humo visual: recorre una misión en un iframe
tools/prueba_lab.html               Humo visual: abre el laboratorio
tools/gl_test.html                  Humo visual: renderizador WebGL con píxel de control
tools/capturar.js                   Capturas por Chrome DevTools Protocol, sin dependencias
tools/cdp.js                        Cliente CDP reutilizable (WebSocket a mano)
tools/ver_cabina.js                 Verifica la cabina en un navegador real (9 puntos)
tools/ver_encuadre.js               Encuadre NDC de los monitores en varios tamaños
tools/capturas_cabina.json          Guion de 15 capturas de la cabina
tools/guion_final.json              Guion de revisión visual: 12 escenas de las 4 misiones
tools/guion_ndc.json                Comprobador de encuadre: proyecta cada escena por sus matrices
tools/guion_vuelo.json              Guion de capturas del vuelo manual
tools/resumen.js                    Lee la salida redirigida de PowerShell (UTF-16 con BOM)
tools/leer_enc.js                   Decodificador auxiliar de salidas de consola
tools/INFORME-ANALISIS-APK.md       Investigación previa (análisis de un APK de referencia)
tools/analizar_elf.py               Herramienta propia de esa investigación (ELF/IL2CPP)
tools/leer_metadata.py              Lector de global-metadata.dat de esa investigación
README.md                           Este documento
```

### Pruebas

El simulador se puede verificar sin navegador. `tools/prueba_simulador.js` monta
un DOM simulado, carga los ocho módulos y el script principal, y recorre las
cuatro misiones completas, las tres vistas, las cuatro pestañas, todas las fases
y combinaciones de piezas de los modelos 3D, el encuadre de cada modelo en el
visor, el enrutado de clics y de las teclas, el panel de cabina, los modales y
los dos desenlaces (misión cumplida y abortada). Aproximadamente mil
comprobaciones:

```bash
cd "C:\Users\Zbook de Mario\Desktop\Cislunar Junior"
node tools\prueba_simulador.js          # comprobaciones (mil seiscientas verificaciones)
node tools\prueba_simulador.js --guion  # imprime el desarrollo de las 4 misiones
node tools\prueba_cabina.js             # cabina inmersiva: 222 comprobaciones
node tools\prueba_mision.js             # consecuencias del vuelo: 41 comprobaciones
node tools\prueba_orbital.js            # física orbital: 75 comprobaciones
node tools\prueba_vehiculos.js          # laboratorio de vehículos: 73 comprobaciones
node test_flight_integration.js         # integración de vuelo manual: 62 comprobaciones
```

`tools/prueba_cabina.js` monta el DOM simulado con un motor WebGL falso que
registra las llamadas, y comprueba la geometría del habitáculo, el encuadre de
los seis monitores y la pantalla central a varias proporciones, que cada
monitor pinte y declare elementos navegables, que el teclado recorra monitores,
elija, ajuste y active, que el raycast del ratón acierte el monitor y el
elemento señalados, y que las pantallas centrales cambien con el estado
(menú → decisión → informe).

`tools/ver_encuadre.js` proyecta las cuatro esquinas de cada monitor por las
matrices reales del sombreado y avisa si algo se sale del cuadro; se comprueba
en 4:3 (el caso más apretado) y en 16:9:

```bash
node tools\ver_encuadre.js 1440 810
node tools\ver_encuadre.js 1024 768
```

Para una revisión visual, sírvelo por HTTP y abre las páginas de humo de
`tools/`: `prueba_mision.html` recorre una expedición entera dentro de un
iframe y anota lo que observa, `prueba_lab.html` abre el laboratorio y
`gl_test.html` comprueba el renderizador WebGL con un píxel de control.

#### Revisión visual automatizada

`tools/capturar.js` es un cliente de Chrome DevTools Protocol escrito para este
proyecto y sin dependencias: conecta directamente con una pestaña de Chromium en
modo *headless*, desactiva la caché, ejecuta el JavaScript de cada paso de un
guion JSON y guarda una captura por paso, informando de avisos y errores de
consola. `tools/guion_final.json` recorre doce escenas de las cuatro misiones
(vista 3D, escena 2D, trayectoria y el respaldo 2D que se usa cuando el
navegador no soporta WebGL).

```bash
# terminal 1: servidor local
python -m http.server 8899 --bind 127.0.0.1
# terminal 2: Chromium headless con depuración en el puerto 9333
node tools\capturar.js tools\guion_final.json    # capturas
node tools\capturar.js tools\guion_ndc.json      # encuadre de las 27 escenas
```

`guion_ndc.json` no mira capturas: proyecta cada modelo con las **matrices
reales** del visor (perspectiva × vista, con el límite de picado del terreno) y
avisa si alguna esquina cae fuera de `[-1, 1]`, es decir, fuera del visor.

#### Cabina en un navegador real

Lo que depende del WebGL de verdad no se puede comprobar con un DOM simulado.
`tools/ver_cabina.js` habla con el navegador por CDP y verifica sobre la página
viva que la cabina esté montada, que los seis monitores tengan geometría y
tecla, que el menú declare sus elementos, que cada monitor pinte, que el raycast
acierte los centros, que Tab entre y Esc salga, que F1–F6 salten a su monitor,
que Enter arranque la misión y que no haya errores de consola:

```bash
# terminal 1: servidor local
python -m http.server 8899 --bind 127.0.0.1
# terminal 2: Chromium/Brave headless con depuración en el puerto 9333
brave --headless=new --remote-debugging-port=9333 --use-gl=swiftshader ^
      --user-data-dir=%TEMP%\cjcdp "http://127.0.0.1:8899/Cislunar%20Junior%20-%20Ca%C3%B1on%20Labs.html"
# terminal 3
node tools\ver_cabina.js                 # 9 comprobaciones en vivo
node tools\capturar.js tools\capturas_cabina.json   # 15 capturas de la cabina
```

El cliente CDP (`tools/cdp.js`) está escrito desde cero —handshake y tramas
WebSocket con `net` y `crypto`—, así que no añade dependencias al proyecto.

### Publicación

El proyecto usa **scripts clásicos** (no módulos ES), así que funciona igual en
cualquier hosting estático y abriendo el archivo directamente con doble clic
(`file://`). Para probarlo por HTTP:

```bash
cd "C:\Users\Zbook de Mario\Desktop\Cislunar Junior"
python -m http.server 8899
```

Luego abre `http://localhost:8899/`.

Dos restricciones del navegador están previstas: los **módulos ES** sí están
bloqueados en `file://` (por eso el proyecto usa scripts clásicos) y
`localStorage` también puede estarlo en Chrome; los ajustes y los diseños del
laboratorio están envueltos en `try/catch`, así que el juego funciona igual.
Para publicarlo, sube la carpeta suelta a [Netlify Drop](https://app.netlify.com/drop),
GitHub Pages o similar.

### Estructura interna del código

| Bloque | Contenido |
|---|---|
| `NM`, `NC`, `PH`, `D` | Nombres y colores de recursos, fases, consumo base por turno |
| `SV` | Iconos SVG por familia de vehículo (respaldo de `js/iconos.js`) |
| `M` | Las 4 misiones: tripulación, eventos, opciones, deltas y riesgo |
| `HR`, `TT`, `SC`, `DU` | Hitos, duración total, lista de escenas y duración por escena |
| `SAT`, `SLS`, `BOOST2D` | Pilas 2D de cohetes para las escenas planas |
| `caja`, `cil`, `placa`, `esferaGL`, `discoGL` | Constructores de geometría procedural |
| `MD2` | Modelos 3D: `SA` (Saturn V), `SL` (SLS), `AP` (Apolo), `OR` (Orion), `DS` (Marte) |
| `SCN` | Escenas 2D: `pad`, `up`, `land`, `surf`, `asc`, `boom`, `burn`, `fly`, `re`, `moi`, `mdes` |
| `escena3D`, `pintar3D2D`, `pintar` | Selección de modelo y piezas, respaldo 2D y bucle de dibujo |
| `INMERSIVO`, `activarCabina`, `pintarInmersivo` | Cabina a pantalla completa: mundo y cockpit en un solo lienzo |
| `CJ.COCKPIT`, `CJ.HUD`, `CJ.CABINA`, `CJ.CTL` | Módulos de cabina: monitores, pintado, enlace y doble mando |
| `ap`, `GR`, `mostrarSel`, `abrirLab` | Lógica de partida, consola, selección y laboratorio |
| `abrirSala`, `emitir` | Sala local por `BroadcastChannel` |

---

## Roadmap de mejoras

Este roadmap recoge el siguiente tramo de trabajo del simulador. La prioridad es
que el vuelo se entienda visualmente: primero debe sentirse el despegue desde la
Tierra, luego debe poder seguirse la trayectoria por el sistema solar y, durante
todo el recorrido, la cabina debe presentar la información con claridad.

### Estado actual y objetivo

El simulador ya cuenta con cabina 3D, monitores de telemetría, sistemas y mapa,
vistas de cabina/instrumentos/exterior, varios vehículos y misiones, una ruta
orbital de misión y un motor de vuelo. La vista exterior y el mapa pueden
mejorarse para contar mejor la geografía del lanzamiento y el recorrido completo.
Las propuestas siguientes son objetivos de desarrollo; no implican que esas
funciones ya estén terminadas.

### Avance del repaso visual · 20 de octubre de 2026

- **Cabina:** los tres displays principales están separados y los laterales
  apuntan hacia el piloto; se ampliaron sus áreas, se añadieron carcasas con
  profundidad y teclas físicas debajo. Los mandos auxiliares ahora ocupan una
  segunda franja del tablero, sin montarse sobre esas teclas. El texto creció
  y la rejilla es más sutil para priorizar los datos. La geometría y el raycast
  comparten el mismo rectángulo de pantalla.
- **Lanzamiento:** el encuadre exterior deja más margen alrededor del SLS, la
  torre se apartó de los propulsores y el fondo de la escena terrestre ahora
  presenta degradado atmosférico que se desvanece durante el ascenso.
- **Mapa y composición:** la ruta de pantalla completa reserva franjas para el
  encabezado y la leyenda, y los modales se compactan en ventanas bajas.
- **Pendiente de revisar visualmente:** relieve y curvatura del terreno,
  distancias de cámara durante el ascenso, separación prolongada de etapas y
  legibilidad real de cada módulo en varios tamaños.

### Prioridad 1 — Despegue desde la Tierra y vista exterior

La vista exterior debe empezar en el lugar de lanzamiento. En una misión que
despegue de la Tierra, el jugador debería reconocer la Tierra y una plataforma
de lanzamiento antes de que el cohete abandone el suelo. El ascenso debe mostrar
claramente cómo la nave se aleja, en vez de presentar el vehículo aislado sobre
un fondo espacial desde el inicio.

**Trabajo recomendado**

- Preparar una escena terrestre de lanzamiento con plataforma, torre de servicio,
  brazo de acceso, luces, horizonte y cielo atmosférico. Dar identidad al lugar
  con una etiqueta de misión (por ejemplo, centro de lanzamiento y zona) sin
  afirmar que una base ficticia sea una reproducción exacta.
- Colocar el cohete sobre el pad con orientación vertical y escala legible. El
  encuadre inicial debe mostrar el vehículo completo y la plataforma en el tamaño
  normal de escritorio y en ventanas panorámicas.
- Animar una secuencia legible: encendido, iluminación del penacho, humo que se
  dispersa, liberación de sujeciones, separación de la torre y ascenso inicial.
  Mantener el humo y la llama acotados para que no tapen el cohete ni el texto.
- Hacer que el suelo y el pad retrocedan mientras el cohete gana altura; después
  revelar la curvatura y la atmósfera de la Tierra. La cámara debe comunicar
  distancia y escala con referencias del terreno, nubes y horizonte.
- Sincronizar la secuencia con la fase y el tiempo de misión. Al pausar, cambiar
  de cámara o volver a cabina, conservar la misma posición, etapa y progreso del
  vuelo: la animación no debe reiniciarse ni saltar a otra ubicación.
- Representar el descarte de etapas en el exterior: mostrar el desacople, la
  separación visible entre etapa y vehículo, y la trayectoria independiente de
  la pieza descartada durante unos segundos. No ocultar la etapa antes de que el
  evento de misión indique que se separó.
- Ofrecer cámaras exterior estables: seguimiento desde atrás, lateral/orbital y
  vista amplia con la Tierra. Indicar siempre el nombre de la cámara y permitir
  volver a una vista predeterminada.
- Diferenciar las misiones que no despegan de la Tierra. La escena de Apolo que
  comienza en órbita o en la superficie lunar debe conservar su contexto; no
  forzar una plataforma terrestre a todas las misiones.

**Criterios para darlo por listo**

1. Al iniciar el ascenso terrestre se ven el cohete sobre el pad y referencias
   del lugar; no aparece flotando en espacio profundo.
2. El vehículo asciende de forma continua y el pad/horizonte se alejan con una
   transición suave a una vista de la Tierra desde altura.
3. La vista de cabina y la exterior muestran el mismo tiempo, etapa y estado de
   misión al alternar entre ellas.
4. Las separaciones se distinguen con claridad y no dejan geometría perdida en
   pantalla.

### Prioridad 2 — Mapa de ruta como mapa del sistema solar

El monitor de ruta debe dejar de parecer un diagrama orbital genérico y ayudar a
ubicar la nave entre cuerpos celestes. Se recomienda una representación
heliocéntrica esquemática: Sol, órbitas, planetas relevantes, destino, ruta de
transferencia y posición actual de la nave. El mapa es una herramienta de
orientación, así que debe explicar qué se está viendo sin exigir leer números
minúsculos.

**Trabajo recomendado**

- Dibujar el Sol como referencia central y las órbitas relevantes de cada
  misión. Para trayectos cislunares, mostrar también la órbita de la Luna y la
  geometría Tierra–Luna en un recuadro o acercamiento dedicado.
- Marcar con etiquetas claras la Tierra, la Luna, Marte cuando corresponda, el
  destino, la nave y los hitos de la ruta (inyección, corrección, sobrevuelo,
  inserción o aterrizaje, según la misión).
- Diferenciar visualmente la órbita de cada cuerpo de la trayectoria de la nave.
  Usar una línea tenue para el recorrido planeado y un marcador contrastante para
  el progreso real; resaltar el siguiente hito.
- Mostrar dirección de movimiento, tramo actual y distancia/tiempo restantes en
  una leyenda breve. Mantener esos datos vinculados al mismo estado de vuelo que
  alimenta la telemetría.
- Añadir controles de acercar, alejar y centrar/volver a la ruta completa. El
  zoom debe afectar solo al mapa cuando el usuario interactúe con sus controles,
  sin modificar la escala del exterior o de la cabina.
- Mantener texto legible a distintos tamaños, contraste suficiente sobre el
  fondo, zonas de clic amplias y un modo de detalle reducido para pantallas
  pequeñas.
- Indicar explícitamente «esquema no a escala» cuando se compriman distancias o
  se exagere el tamaño de cuerpos para que sean visibles. Si se ofrece escala
  física, mostrarla aparte y explicar qué no puede apreciarse a esa escala.
- En misiones históricas, mostrar solo los cuerpos y maniobras necesarios para
  entender el viaje. Evitar dibujar una órbita heliocéntrica que sugiera una
  precisión que la simulación no calcula.

**Criterios para darlo por listo**

1. Se reconoce de un vistazo dónde están el Sol, la Tierra, el destino y la nave.
2. La ruta y el marcador de posición avanzan al ritmo de la simulación y cambian
   con los hitos de misión.
3. Las etiquetas y los hitos no se pisan entre sí y se leen en la pantalla del
   monitor sin abrir un panel que cubra la ruta.
4. Los mapas cislunares y los interplanetarios comunican escalas distintas sin
   confundir al usuario.

### Prioridad 3 — Planetas, espacio y profundidad

- Mejorar Tierra, Luna y Marte con iluminación coherente, textura o detalle
  procedural, relieve/horizonte y una atmósfera discreta donde corresponda.
- Diferenciar el lado iluminado y el lado nocturno; mostrar nubes y terminador
  de día/noche sin ocultar el marcador de nave.
- Añadir capas de distancia (estrellas, cuerpos próximos y planeta de referencia)
  para que el movimiento se perciba sin abusar de efectos o partículas.
- Mantener consistencia de cámara y orientación al pasar de pad a ascenso, órbita,
  transferencia y llegada. Evitar cambios bruscos de escala que hagan parecer
  que el vehículo gira o se teletransporta.
- Validar el encuadre y el rendimiento en WebGL y en el respaldo 2D; reducir
  detalle cuando el dispositivo no pueda sostener el renderizado.

### Prioridad 4 — Controles y presentación de datos

- Separar con claridad las acciones del jugador, la navegación de monitores y
  los controles de cámara. Mostrar una ayuda breve según la vista activa.
- Asegurar que los controles visuales tengan áreas pulsables generosas y que el
  foco/selección responda inmediatamente a ratón y teclado.
- Conservar la regla actual de zoom: la rueda y `+`/`-` no deben acercar el
  exterior mientras se está en Cabina o Instrumentos; el zoom de cámara vive en
  Exterior y el zoom de ruta vive dentro del mapa.
- Mantener decisiones y preparación en un modal o pantalla dedicada, dejando los
  monitores disponibles para telemetría, sistemas, comunicaciones y ruta.
- Dar prioridad a las lecturas importantes: unidad junto al valor, estado
  normal/precaución/alarma con color y texto, tamaños legibles y contraste alto.
- Revisar relaciones de aspecto 16:9, 16:10 y 4:3, además de escalado del
  navegador y ventanas reducidas. Ningún dato crítico debe quedar fuera del
  monitor o debajo de la estructura de cabina.

### Prioridad 5 — Integración de misión y pulido

- Mantener una fuente de estado única para tiempo, fase, posición, etapa, cámara,
  telemetría y mapa. Evitar que cada vista calcule una versión distinta de la
  misión.
- Añadir transiciones cortas entre eventos sin bloquear controles ni esconder
  decisiones pendientes.
- Mostrar estados vacíos y de error con mensajes útiles (por ejemplo, datos de
  ruta no disponibles) en lugar de dejar una pantalla en blanco.
- Revisar textos, unidades, nombres y símbolos en español; distinguir con claridad
  datos históricos, valores simulados y estimaciones educativas.
- Incorporar una opción de reducir movimiento/efectos para accesibilidad y para
  equipos modestos.

### Orden sugerido de implementación

| Orden | Entrega | Resultado verificable |
|---|---|---|
| 1 | Especificar estados de vuelo y cámaras exterior | Tabla de fases, cámara y punto de referencia por misión |
| 2 | Construir escena del pad terrestre | Cohete colocado, torre y horizonte con encuadre adaptable |
| 3 | Implementar ascenso continuo y separación de etapas | Estado visual ligado al tiempo y a los eventos de misión |
| 4 | Diseñar mapa heliocéntrico esquemático | Sol, órbitas, ruta, posición, destino y leyenda legible |
| 5 | Sincronizar mapa, telemetría y navegación | Mismos hitos y progreso en todos los instrumentos |
| 6 | Pulir planetas, cámaras y rendimiento | Transiciones coherentes y calidad adaptable |
| 7 | Hacer revisión visual por misión y tamaño | Capturas revisadas y lista de defectos cerrada |

### Validación de cada entrega

Usar las pruebas automatizadas existentes para proteger física, misiones,
controles y cabina. Para cambios visuales, además de las pruebas, recorrer en un
navegador real el inicio de misión, el ascenso, la separación de etapas, el mapa,
la alternancia entre cabina e instrumentos y las cámaras exteriores. Revisar al
menos una misión terrestre, una misión cislunar y Marte, en 16:9 y en una ventana
4:3 o estrecha. Registrar las capturas por fase y comparar que no haya texto
recortado, objetos atravesando el monitor, saltos de escala, clics desalineados
ni estados de cámara que se reinicien.

Comandos disponibles actualmente (Node.js):

```bash
node tools/prueba_simulador.js
node tools/prueba_cabina.js
node tools/prueba_partida.js
node tools/prueba_orbital.js
node tools/prueba_fisica.js
node tools/prueba_mision.js
node tools/prueba_vehiculos.js
node test_flight_integration.js
```

Para revisar el encuadre del cockpit y las escenas existentes:

```bash
node tools/ver_encuadre.js 1440 810
node tools/ver_encuadre.js 1024 768
```

La revisión visual automatizada y los guiones CDP se describen en la sección
**Pruebas** de este README. Los cambios de vuelo exterior y mapa deberían sumar
casos a esos guiones para que se comprueben también el pad, el ascenso, la
separación y los mapas de cada familia de misión.

## Cañon Labs

Proyecto de **Cañon Labs** para el NASA Space Apps Challenge 2026.

Simulación educativa. Los vehículos, nombres de misión y eventos están inspirados
en programas públicos de la NASA; los modelos 3D, el código, los textos y el diseño
son originales.
