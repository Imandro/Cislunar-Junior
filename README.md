# Cislunar Junior

> Simulador interactivo de decisiones de misión espacial — Cañon Labs · NASA Space Apps Challenge 2026

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#licencia)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Platform](https://img.shields.io/badge/platform-web-lightgrey.svg)]()
[![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

## 📖 Descripción

**Cislunar Junior** es un simulador en el navegador que recrea misiones espaciales reales (Apolo 11, Apolo 13, Artemis II y Marte). El jugador gestiona recursos (soporte vital, energía, protección contra radiación, agua/alimento y propelente) tomando decisiones por evento, y puede pilotar la misión en un simulador de vuelo con cabina 3D inmersiva o en modo 2D clásico. Incluye una Academia de Vuelo con 10 lecciones y un Laboratorio de cohetes para diseñar vehículos.

## ✨ Características principales

- 🚀 **4 misiones** basadas en datos reales de la NASA.
- 🎮 **Simulador de vuelo** con física orbital y atmosférica (gravedad + J2, arrastre Mach-dependiente, empuje vectorial, integración Verlet, actitud por cuaterniones, asistencia SAS).
- 🛸 **Cabina 3D inmersiva** (WebGL + GLSL) con 6 monitores y pantalla central, con fallback 2D.
- 👥 **Multijugador local** mediante `BroadcastChannel`.
- 🎓 **Academia de Vuelo**: 10 lecciones progresivas con medallas y certificado.
- 🔬 **Laboratorio de cohetes**: constructor por etapas, presupuesto Δv (Tsiolkovski), TWR y simulación de ascenso.
- 📴 **Sin dependencias**: HTML5/CSS3/JS puro, sin frameworks ni build.

## 🛠️ Tecnologías

| Capa | Tecnología |
|---|---|
| Lenguaje | JavaScript (ES5/ES6), HTML5, CSS3 |
| Render 3D | WebGL 1.0 + GLSL (shaders propios) |
| Render 2D | Canvas 2D |
| Audio | Web Audio API |
| Persistencia | `localStorage` (envuelto en try/catch) |
| Multijugador | `BroadcastChannel` |
| Pruebas | Node.js (scripts en `tools/`) |
| Servidor | Estático (cualquier HTTP server) |

Sin frameworks, sin bundler, sin npm.

## 🚀 Ejecución

No requiere instalación.

```bash
# Opción 1: abrir directamente
# doble clic en "Cislunar Junior - Cañon Labs.html"

# Opción 2: servidor estático
python -m http.server 8899
# abrir http://localhost:8899/
```

### Pruebas (Node.js)

```bash
node tools\prueba_simulador.js
node tools\prueba_cabina.js
node tools\prueba_orbital.js
node tools\prueba_mision.js
node tools\prueba_vehiculos.js
node tools\prueba_lab.js
```

## 📁 Estructura del proyecto

```
Cislunar Junior/
├── Cislunar Junior - Cañon Labs.html   # entrada principal (standalone)
├── js/                                 # 19 módulos
│   ├── orbital.js, vehiculo.js, flight.js, stages.js, mision_vuelo.js
│   ├── cabina.js, cockpit.js, hud_flight.js, controls.js
│   ├── academia.js, laboratorio.js, glcore.js, iconos.js, creditos.js
│   └── arranque.js, cabina_enlace.js, mision_vuelo.js, ...
├── assets/                             # fotos NASA (dominio público)
├── tools/                              # pruebas, capturas CDP, guiones JSON, análisis APK
├── docs/screenshots/                   # capturas
├── README.md
└── README-CABINA-ORION.md              # spec de cabina Orion
```

## 🎮 Controles (vuelo)

| Tecla | Acción |
|---|---|
| W/S o ↑/↓ | Pitch |
| A/D o ←/→ | Yaw |
| Q/E | Roll |
| Shift / Espacio | Throttle + / − |
| H | Ciclar asistencia (0–3) |
| C | Ciclar cámara |
| R | Reset actitud |
| P | Pausa |
| Tab / F1–F6 | Monitores de cabina |
| `` ` `` | Alternar modo ratón/teclado |

## 📸 Capturas

![Menú principal](docs/screenshots/menu.png)

## 🖼️ Recursos gráficos

Imágenes NASA de dominio público (ver `js/creditos.js`):

| Archivo | NASA ID | Contenido |
|---|---|---|
| `assets/apolo11.jpg` | as11-40-5927 | Módulo lunar Apolo 11 |
| `assets/apolo13.jpg` | S70-34902 | Control de misión Apolo 13 |
| `assets/artemis2.jpg` | KSC-20230602-PH-GEB01-0010 | Módulo tripulado Orion (Artemis II) |
| `assets/marte.jpg` | PIA14838 | Curiosity (concepto artístico) |

Arte original (iconos vectoriales, modelos 3D procedurales MD2, emblema animado) © Cañon Labs.

## 👥 Créditos

- Datos de misión: NASA (Apolo 11/13, Artemis II, Marte).
- Imágenes: dominio público NASA.
- Desarrollo: Cañon Labs.

## 📄 Licencia

Código del proyecto © Cañon Labs. Imágenes NASA en dominio público.
