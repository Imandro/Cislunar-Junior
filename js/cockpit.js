/* ===========================================================================
 * CISLUNAR JUNIOR — Cabina inmersiva
 * Cañon Labs · NASA Space Apps Challenge 2026
 *
 * Modela el habitáculo del piloto alrededor de la cabeza: salpicadero, marco del
 * parabrisas, consola de techo, mamparas laterales y seis monitores físicos.
 * Todo lo que el juego muestra —comunicaciones, telemetría, sistemas, mapa,
 * checklist y controles— se dibuja en un lienzo 2D que se sube como textura y
 * se coloca sobre su pantalla, sin una sola capa de HTML encima.
 *
 * Dos formas de entrar:
 *   - teclado: Tab recorre monitores, F1..F6 saltan a uno directo, ↑↓ eligen
 *     elemento, ←→ ajustan, Enter activa, Esc suelta el foco.
 *   - ratón: cada monitor es un rectángulo en el espacio de la cámara, así que
 *     basta deshacer la proyección y buscar dónde corta el rayo. Se usa la
 *     misma cuenta que el sombreado, de modo que lo que se ve y lo que se puede
 *     pulsar coinciden exactamente.
 *
 * La cabina vive en espacio de cámara (no en el mundo): cabecea con la vista,
 * pero no se aleja del vehículo ni con el zoom.
 * Código original de Cañon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  var CJ = root.CJ || (root.CJ = {});

  /* =======================================================================
   * MONITORES
   *
   * `p` posición en espacio de cámara (x a la derecha, y arriba, z hacia el
   * observador), `r` giro en radianes ([0] cabeceo en X, [1] guiñada en Y) y
   * `t` tamaño en unidades de mundo. El lienzo de cada uno tiene su propia
   * resolución: los paneles anchos la aprovechan para no dibujar texto
   * microscópico.
   *
   * Tres pantallas principales forman una fila bajo el parabrisas. Las tres
   * vistas auxiliares se abren desde mandos físicos bajo esa fila.
   * ==================================================================== */
  var MONITORES = [
    { id: 'comms',      nom: 'COMUNICACIONES', tecla: 'F1', visible: false,
      p: [-1.65, -2.18, 3.48], r: [-0.08,  0.08, 0], t: [0.66, 0.31], pw: 660, ph: 269 },
    { id: 'telemetria', nom: 'DU2 · VUELO',    tecla: 'F2',
      p: [ 0.00, -0.96, 3.67], r: [-0.04,  0.00, 0], t: [1.28, 1.20], pw: 840, ph: 900 },
    { id: 'sistemas',   nom: 'DU3 · SISTEMAS', tecla: 'F3',
      p: [ 1.65, -0.97, 3.63], r: [-0.05, -0.16, 0], t: [1.72, 1.08], pw: 960, ph: 650 },
    { id: 'mapa',       nom: 'DU1 · RUTA',      tecla: 'F4',
      p: [-1.65, -0.97, 3.63], r: [-0.05,  0.16, 0], t: [1.72, 1.08], pw: 960, ph: 650 },
    { id: 'checklist',  nom: 'CHECKLIST',      tecla: 'F5', visible: false,
      p: [ 1.65, -2.18, 3.48], r: [-0.08, -0.08, 0], t: [0.66, 0.31], pw: 620, ph: 350 },
    { id: 'controles',  nom: 'CONTROLES',      tecla: 'F6', visible: false,
      p: [ 0.00, -2.18, 3.48], r: [-0.08,  0.00, 0], t: [0.66, 0.30], pw: 700, ph: 460 }
  ];

  var MANDOS = [
    { id: 'comms', titulo: 'COMMS', tecla: 'F1', p: [-1.65, -2.18, 3.48], t: [0.76, 0.32], r: [-0.08, 0.08, 0] },
    { id: 'controles', titulo: 'MANDOS', tecla: 'F6', p: [0, -2.18, 3.48], t: [0.76, 0.32], r: [-0.08, 0, 0] },
    { id: 'checklist', titulo: 'CHECKLIST', tecla: 'F5', p: [1.65, -2.18, 3.48], t: [0.76, 0.32], r: [-0.08, -0.08, 0] }
  ];

  /* Pantalla central reservada para menú y pantallas auxiliares. En misión
   * se oculta: datos y ruta están en los monitores físicos y decisiones en modal. */
  var CENTRAL = { id: 'central', nom: 'PANTALLA CENTRAL', tecla: 'Tab',
                  p: [0, 0.02, 2.94], r: [-0.04, 0, 0], t: [4.30, 2.06],
                  pw: 1400, ph: 672 };

  var TECLAS = { 'F1': 'comms', 'F2': 'telemetria', 'F3': 'sistemas',
                 'F4': 'mapa', 'F5': 'checklist', 'F6': 'controles' };

  /* =======================================================================
   * ESTADO
   * ==================================================================== */
  var est = {
    R3D: null,
    canvas: null,
    cab: null,            // geometría de la cabina, ya subida
    tex: {},              // id -> textura WebGL
    items: {},            // id -> [{t, tipo, acc, val, x, y, w, h}]
    sel: {},              // id -> índice del elemento resaltado
    foco: null,           // id del monitor con el foco del teclado
    scroll: {},           // id -> desplazamiento del contenido
    hover: null,          // monitor bajo el puntero
    visible: false,
    cabYaw: 0, cabPit: 0, // inclinación actual de la cabeza dentro de la cabina
    cabYawObjetivo: 0, cabPitObjetivo: 0,
    cabX: 0, cabY: 0
  };

  /* =======================================================================
   * GEOMETRÍA — sólo cajas y cuadriláteros con esquinas explícitas, que es lo
   * único que hace falta para un habitáculo y evita cualquier dependencia de
   * rotaciones compuestas en el 건설.
   * ==================================================================== */
  var C = {
    casco:  [ 24,  29,  39, 1, 24],
    claro:  [ 46,  55,  70, 1, 46],
    hueco:  [  8,  10,  15, 1,  8],
    marco:  [ 64,  74,  90, 1, 54],
    negro:  [ 11,  13,  17, 1, 12],
    metal:  [146, 158, 174, 1, 96],
    ledV:   [ 34, 104,  58, 1, 74],
    ledA:   [150,  98,  20, 1, 74],
    ledR:   [128,  32,  36, 1, 74],
    gris:   [ 76,  84,  96, 1, 44]
  };

  /** Los ocho vértices de una caja, en orden: cara -Z, +Z, -X, +X, -Y, +Y. */
  function caja2(x0, y0, z0, x1, y1, z1, c) {
    var v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
             [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    return [
      { v:[v[4],v[5],v[6],v[7]], c:c },   // +Z
      { v:[v[1],v[0],v[3],v[2]], c:c },   // -Z
      { v:[v[4],v[0],v[3],v[7]], c:c },   // -X
      { v:[v[1],v[5],v[6],v[2]], c:c },   // +X
      { v:[v[4],v[5],v[1],v[0]], c:c },   // -Y
      { v:[v[3],v[2],v[6],v[7]], c:c }    // +Y
    ];
  }

  /** Cuadrilátero a partir de sus cuatro esquinas ya en orden. */
  function quad(a, b, c, d, col) { return [{ v: [a, b, c, d], c: col }]; }

  /** Barra cilíndrica entre dos puntos, con `n` lados. */
  function barra(a, b, r, col, n) {
    n = n || 6;
    var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    var L = Math.hypot(ux, uy, uz) || 1;
    ux/=L; uy/=L; uz/=L;
    // base perpendicular
    var px = 0, py = 1, pz = 0;
    if (Math.abs(uy) > 0.9) { px = 1; py = 0; }
    var e1 = [py*uz - pz*uy, pz*ux - px*uz, px*uy - py*ux];
    var l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1;
    e1 = [e1[0]/l1, e1[1]/l1, e1[2]/l1];
    var e2 = [uy*e1[2] - uz*e1[1], uz*e1[0] - ux*e1[2], ux*e1[1] - uy*e1[0]];
    var out = [], i, j;
    for (i = 0; i < n; i++) {
      var t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2;
      var c0 = Math.cos(t0)*r, s0 = Math.sin(t0)*r;
      var c1 = Math.cos(t1)*r, s1 = Math.sin(t1)*r;
      var A = [a[0]+e1[0]*c0+e2[0]*s0, a[1]+e1[1]*c0+e2[1]*s0, a[2]+e1[2]*c0+e2[2]*s0];
      var B = [a[0]+e1[0]*c1+e2[0]*s1, a[1]+e1[1]*c1+e2[1]*s1, a[2]+e1[2]*c1+e2[2]*s1];
      var A2 = [A[0]+ux*L, A[1]+uy*L, A[2]+uz*L];
      var B2 = [B[0]+ux*L, B[1]+uy*L, B[2]+uz*L];
      out.push({ v: [A, B, B2, A2], c: col });
    }
    return out;
  }

  function anade(G, arr) {
    if (!arr) return G;
    for (var i = 0; i < arr.length; i++) G.push(arr[i]);
    return G;
  }

  /**
   * Habitáculo. Se coloca por franjas para que cada monitor tenga detrás un
   * panel del mismo color: salpicadero en la mitad inferior, consola de techo
   * arriba y mamparas en los flancos. El hueco central —el parabrisas— queda
   * libre para ver el espacio, y cuando se abre la pantalla central lo tapa.
   */
  function construirCabina() {
    var G = [], i, x;

    // Revestimiento y ventilación del habitáculo, fuera de las superficies de lectura.
    for (var lado = -1; lado <= 1; lado += 2) {
      var sx = lado * 3.05;
      anade(G, caja2(sx - 0.34, -1.85, 3.05, sx + 0.34, 1.50, 3.20, [134,143,149,1,20]));
      anade(G, caja2(sx - 0.24, 0.30, 3.21, sx + 0.24, 0.85, 3.24, C.negro));
      for (var v = 0; v < 6; v++)
        anade(G, caja2(sx - 0.21, 0.34 + v * 0.08, 3.25, sx + 0.21, 0.36 + v * 0.08, 3.27, C.gris));
      anade(G, barra([sx, -0.9, 3.3], [sx, -0.2, 3.3], 0.045, C.metal, 8));
    }

    /* --- salpicadero bajo el parabrisas --- */
    anade(G, caja2(-4.9, -1.78, 2.86, 4.9, -1.10, 3.46, C.casco));
    anade(G, caja2(-4.9, -1.14, 3.44, 4.9, -1.08, 3.54, C.claro));  // canto
    /* Segundo nivel separado para mandos auxiliares; evita que compartan
     * espacio con las teclas bajo las tres pantallas principales. */
    anade(G, caja2(-2.72, -2.48, 2.86, 2.72, -1.82, 3.40, C.casco));
    anade(G, caja2(-2.66, -2.43, 3.39, 2.66, -1.88, 3.43, C.marco));
    anade(G, caja2(-2.62, -1.92, 3.43, 2.62, -1.87, 3.46, C.claro));
    for (i = -7; i <= 7; i++) {                                       // interruptores
      x = i * 0.31;
      anade(G, caja2(x - 0.10, -1.91, 3.54, x + 0.10, -1.81, 3.60,
                     (i % 3 === 0) ? C.ledV : (i % 3 === 1 ? C.ledA : C.gris)));
    }

    /* Los asientos se ven sólo en el borde inferior: dan escala humana sin
     * invadir el tablero ni fingir tripulación animada. */
    for (var asiento = -1; asiento <= 1; asiento += 2) {
      var ax = asiento * 2.34;
      anade(G, caja2(ax - 0.64, -3.10, 2.14, ax + 0.64, -1.77, 2.52, C.negro));
      anade(G, caja2(ax - 0.55, -2.98, 2.50, ax + 0.55, -2.04, 2.66, C.casco));
      anade(G, caja2(ax - 0.58, -2.07, 2.48, ax + 0.58, -1.86, 2.72, C.marco));
      anade(G, caja2(ax - 0.40, -1.88, 2.46, ax + 0.40, -1.54, 2.64, C.gris));
      anade(G, caja2(ax - 0.30, -1.80, 2.64, ax + 0.30, -1.60, 2.71, C.casco));
      anade(G, barra([ax - 0.48, -2.72, 2.68], [ax + 0.48, -2.72, 2.68], 0.035, C.metal, 6));
    }

    /* Reposapiés y pedales: completan el punto de vista del astronauta y
     * mantienen el centro libre para la consola y sus mandos. */
    for (i = -1; i <= 1; i += 2) {
      var px = i * 0.72;
      anade(G, caja2(px - 0.22, -3.16, 2.72, px + 0.22, -2.92, 3.22, C.casco));
      anade(G, caja2(px - 0.16, -3.03, 3.22, px + 0.16, -2.90, 3.32, C.metal));
      anade(G, barra([px, -2.94, 3.28], [px, -2.64, 3.48], 0.028, C.gris, 6));
    }

    /* Los tres displays quedan separados por un borde físico; el soporte
     * oscuro impide que sus marcos parezcan una sola pantalla superpuesta. */
    var displays = [MONITORES[1], MONITORES[2], MONITORES[3]];
    for (i = 0; i < displays.length; i++) {
      var d = displays[i], dx = d.p[0], dy = d.p[1], dw = d.t[0] / 2, dh = d.t[1] / 2;
      for (var key = 0; key < 5; key++) {
        var kx = dx - dw * 0.78 + key * dw * 0.39;
        anade(G, caja2(kx - 0.045, dy - dh - 0.17, 3.58,
                       kx + 0.045, dy - dh - 0.08, 3.65,
                       key === 2 ? C.ledV : C.gris));
      }
    }

    /* Mandos físicos agrupados bajo los tres displays; cada grupo abre su
     * pantalla auxiliar. El relieve y los colores los hacen distinguibles. */
    for (i = 0; i < MANDOS.length; i++) {
      var m = MANDOS[i], mx = m.p[0], color = i === 0 ? C.ledV : (i === 1 ? C.ledA : C.gris);
      anade(G, caja2(mx - 0.39, -2.39, 3.40, mx + 0.39, -1.97, 3.48, C.negro));
      anade(G, caja2(mx - 0.35, -2.34, 3.48, mx + 0.35, -2.02, 3.50, C.marco));
      for (var bi = -1; bi <= 1; bi++) {
        anade(G, caja2(mx + bi * 0.18 - 0.05, -2.30, 3.50, mx + bi * 0.18 + 0.05, -2.08, 3.54,
                       bi === 0 ? color : C.gris));
      }
    }

    /* --- zócalo inferior: cierra la vista por abajo --- */
    anade(G, quad([-4.9,-1.86,2.78], [4.9,-1.86,2.78], [4.9,-3.30,2.06], [-4.9,-3.30,2.06], C.negro));

    /* --- franco del parabrisas: deja libre el hueco central --- */
    anade(G, caja2(-2.62, -1.10, 2.92, -2.24, 1.66, 3.12, C.casco));  // franja izq
    anade(G, caja2( 2.24, -1.10, 2.92,  2.62, 1.66, 3.12, C.casco));  // franja der
    anade(G, caja2(-1.30, -0.16, 2.92,  1.30,  0.08, 3.12, C.marco));  // base
    anade(G, caja2(-1.34,  1.34, 2.92,  1.34,  1.66, 3.12, C.casco));  // dintel
    // montantes interiores
    anade(G, caja2(-1.36, -0.16, 2.94, -1.28, 1.34, 3.08, C.marco));
    anade(G, caja2( 1.28, -0.16, 2.94,  1.36, 1.34, 3.08, C.marco));
    anade(G, quad([-2.62,1.60,2.92], [2.62,1.60,2.92], [2.44,1.94,3.32], [-2.44,1.94,3.32], C.claro));

    /* --- techo y consola superior --- */
    anade(G, caja2(-3.60, 1.66, 2.88, 3.60, 2.22, 4.02, C.casco));
    anade(G, quad([-3.60,1.64,2.88], [3.60,1.64,2.88], [3.26,1.98,3.32], [-3.26,1.98,3.32], C.claro));
    for (i = -7; i <= 7; i++) {
      anade(G, caja2(i*0.26 - 0.05, 1.56, 2.84, i*0.26 + 0.05, 1.66, 2.90,
                     (i === 0) ? C.ledR : ((i % 2) ? C.gris : C.ledV)));
    }

    /* --- mamparas laterales: sostienen mapa y checklist --- */
    anade(G, quad([-4.90,-1.34,2.88], [-4.90,-1.34,2.10], [-4.90,1.70,2.10], [-4.90,1.70,2.88], C.casco));
    anade(G, quad([ 4.90,-1.34,2.88], [ 4.90,-1.34,2.10], [ 4.90,1.70,2.10], [ 4.90,1.70,2.88], C.casco));
    anade(G, barra([-4.82,-1.30,2.86], [-4.82,1.66,2.86], 0.045, C.marco, 6));
    anade(G, barra([ 4.82,-1.30,2.86], [ 4.82,1.66,2.86], 0.045, C.marco, 6));

    /* --- bipsticks --- */
    anade(G, bipstick(-1.66, -1.42, 3.04, -1));
    anade(G, bipstick( 1.66, -1.42, 3.04,  1));

    /* --- consola central entre las piernas --- */
    anade(G, caja2(-0.70, -2.06, 2.58, 0.70, -1.48, 3.26, C.casco));
    anade(G, caja2(-0.60, -2.04, 3.24, 0.60, -1.54, 3.32, C.negro));
    anade(G, caja2(-0.54, -2.00, 3.32, 0.54, -1.88, 3.38, C.marco));
    anade(G, barra([0, -1.58, 3.28], [0, -1.16, 3.52], 0.045, C.metal, 8));
    anade(G, caja2(-0.18, -1.24, 3.46, 0.18, -1.08, 3.60, C.ledR));

    /* Iluminación de cortesía tenue: separa casco, consola y parabrisas sin
     * alterar los colores semánticos de los sistemas. */
    for (i = -2; i <= 2; i++) {
      anade(G, caja2(i * 0.58 - 0.07, 1.38, 3.09, i * 0.58 + 0.07, 1.43, 3.13,
                     i === 0 ? C.ledA : C.ledV));
    }

    /* --- arcos de la visera: enmarcan el parabrisas --- */
    anade(G, barra([-2.46, 0.10, 2.88], [-2.10, 1.62, 3.16], 0.06, C.claro, 8));
    anade(G, barra([ 2.46, 0.10, 2.88], [ 2.10, 1.62, 3.16], 0.06, C.claro, 8));

    /* --- fondo lejano del hueco --- */
    anade(G, quad([-6,-2.2,2.0], [6,-2.2,2.0], [6,-3.4,1.4], [-6,-3.4,1.4], C.hueco));

    return G;
  }

    /** Mando lateral con palanca y gatillo. */
  function bipstick(x, y, z, lado) {
    var g = [];
    anade(g, caja2(x - 0.13, y - 0.50, z, x + 0.13, y + 0.04, z + 0.20, C.casco));
    anade(g, barra([x, y - 0.02, z + 0.10], [x, y + 0.44, z + 0.34], 0.04, C.metal, 8));
    anade(g, caja2(x - 0.08, y + 0.38, z + 0.28, x + 0.08, y + 0.48, z + 0.24, C.ledR));
    anade(g, caja2(x - 0.10, y - 0.30, z + 0.18, x + 0.10, y - 0.16, z + 0.26,
                   lado < 0 ? C.ledV : C.ledA));
    return g;
  }
  var lienzos = {};

  /** Devuelve (creando si hace falta) el lienzo 2D de un monitor. */
  function lienzo(id, w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var c = lienzos[id];
    if (!c) { c = document.createElement('canvas'); lienzos[id] = c; }
    if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
    return c;
  }

  /**
   * Lienzo 2D del monitor, ya limpio y listo para dibujar.
   * `contexto2D` da el contexto sin borrar: se usa para retoques sobre una
   * textura que la cabina ya subió a la GPU en este mismo fotograma.
   */
  function superficie(id, w, h) {
    var c = lienzo(id, w, h);
    if (!c) return null;
    var X = c.getContext('2d');
    if (!X) return null;
    X.setTransform(1, 0, 0, 1, 0, 0);
    X.globalAlpha = 1;
    X.clearRect(0, 0, w, h);
    return { cv: c, X: X, w: w, h: h };
  }

  function contexto2D(id, w, h) {
    var c = lienzo(id, w, h);
    if (!c) return null;
    return c.getContext('2d') || null;
  }

  function texturaDe(mon) {
    if (!est.R3D || !est.R3D.crearTextura) return null;
    var c = lienzo(mon.id, mon.pw, mon.ph);
    if (!c) return null;
    var t = est.tex[mon.id];
    if (!t) { t = est.R3D.crearTextura(null); est.tex[mon.id] = t; }
    est.R3D.actualizarTextura(t, c);
    return t;
  }

  /* =======================================================================
   * PINTADO
   * ==================================================================== */
  var FOV_CAB = 1.30;             // ≈74°: mantiene todos los mandos físicos dentro del cuadro

  function fov() { return FOV_CAB; }

  var PLACA = null;
  function placa() {
    if (!PLACA) PLACA = [{ v: [[-0.5,-0.5,0],[0.5,-0.5,0],[0.5,0.5,0],[-0.5,0.5,0]],
                          c: [255,255,255,1,100] }];
    return PLACA;
  }

  /** Bisel de cada pantalla, en su mismo plano para que viaje con ella. */
  var biseles = {};
  function bisel(mon) {
    var g = biseles[mon.id];
    if (g) return g;
    var w = mon.t[0] / 2 + 0.035, h = mon.t[1] / 2 + 0.035, b = 0.055, z = -0.01;
    var ow = w + 0.10, oh = h + 0.10, rear = 0.10;
    /* Marco con profundidad: la pantalla queda encajada en una carcasa, no
     * como una textura pegada a una plancha plana. */
    g = [
      { v: [[-ow,h,z], [ow,h,z], [ow,oh,z], [-ow,oh,z]], c: C.negro },
      { v: [[-ow,-oh,z], [ow,-oh,z], [ow,-h,z], [-ow,-h,z]], c: C.negro },
      { v: [[-ow,-h,z], [-w,-h,z], [-w,h,z], [-ow,h,z]], c: C.negro },
      { v: [[w,-h,z], [ow,-h,z], [ow,h,z], [w,h,z]], c: C.negro },
      { v: [[-ow,oh,z], [ow,oh,z], [ow,oh,rear], [-ow,oh,rear]], c: C.marco },
      { v: [[-ow,-oh,rear], [ow,-oh,rear], [ow,-oh,z], [-ow,-oh,z]], c: C.marco },
      { v: [[-ow,-oh,z], [-ow,-h,z], [-ow,-h,rear], [-ow,-oh,rear]], c: C.marco },
      { v: [[ow,-h,z], [ow,-oh,z], [ow,-oh,rear], [ow,-h,rear]], c: C.marco }
    ];
    g = g.concat([
      { v: [[-w, h, z], [w, h, z], [w, h+b, z], [-w, h+b, z]], c: C.marco },
      { v: [[-w, -h-b, z], [w, -h-b, z], [w, -h, z], [-w, -h, z]], c: C.marco },
      { v: [[-w, -h, z], [-w+b, -h, z], [-w+b, h, z], [-w, h, z]], c: C.marco },
      { v: [[w-b, -h, z], [w, -h, z], [w, h, z], [w-b, h, z]], c: C.marco }
    ]);
    var s = 0.018;
    if (mon.id !== 'central') {
      for (var side = -1; side <= 1; side += 2) {
        for (var k = 0; k < 5; k++) {
          var ky = -h * 0.75 + k * h * 0.375;
          anade(g, caja2(side * (w + 0.05) - 0.026, ky - 0.025, -0.035,
                        side * (w + 0.05) + 0.026, ky + 0.025, -0.015, C.gris));
        }
      }
    }
    [[-w-s,-h-s],[w+s,-h-s],[-w-s,h+s],[w+s,h+s]].forEach(function (p) {
      g.push({ v: [[p[0]-s,p[1]-s,z],[p[0]+s,p[1]-s,z],
                   [p[0]+s,p[1]+s,z],[p[0]-s,p[1]+s,z]], c: C.metal });
    });
    biseles[mon.id] = g;
    return g;
  }

  /**
   * Dibuja la cabina y sus monitores sobre la escena ya pintada.
   * `opciones.aspecto` y `opciones.cabYaw/cabPit` describen el encuadre.
   */
  function pintar(opciones) {
    if (!est.R3D || !est.cab) return false;
    opciones = opciones || {};
    est.cabYaw = opciones.cabYaw || 0;
    est.cabPit = opciones.cabPit || 0;
    var cam = {
      fov: opciones.fov || FOV_CAB,
      aspecto: opciones.aspecto || 1.7,
      yaw: opciones.cabYaw || 0,
      pit: opciones.cabPit || 0
    };
    est.R3D.dibujar(cam, [{ clave: 'cabina', polys: est.cab }],
      { soloVista: true, sinProfundidad: true, niebla: 4000,
        brillo: opciones.brillo == null ? 1 : opciones.brillo });

    /* La pantalla central es un monitor más: si no entra en la lista, su textura
     * no se sube nunca y el hueco del parabrisas se ve negro aunque el HUD haya
     * pintado su lienzo. */
    var lista = (opciones.monitores || MONITORES).slice();
    if (opciones.incluirCentral !== false && CENTRAL.visible !== false) {
      lista = lista.concat([CENTRAL]);
    }
    var items = [];
    for (var mi = 0; mi < MANDOS.length; mi++) {
      var mando = MANDOS[mi], tag = 'mando-' + mando.id;
      if (!lienzos[tag]) {
        var sup = superficie(tag, 360, 150), ctx = sup && sup.X;
        if (ctx) {
          ctx.fillStyle = '#111b24'; ctx.fillRect(0, 0, 360, 150);
          ctx.strokeStyle = '#8ba5b6'; ctx.lineWidth = 4; ctx.strokeRect(3, 3, 354, 144);
          ctx.textAlign = 'center'; ctx.fillStyle = '#e1edf4';
          ctx.font = 'bold 36px sans-serif'; ctx.fillText(mando.titulo, 180, 65);
          ctx.fillStyle = '#85cbe9'; ctx.font = '24px sans-serif'; ctx.fillText(mando.tecla + ' · ABRIR', 180, 112);
        }
      }
      var mt = texturaDe({ id: tag, pw: 360, ph: 150 });
      if (mt) items.push({ clave: 'placa', polys: placa(), textura: mt, mono: true,
        off: mando.p, esc: mando.t, rot: [mando.r[0], mando.r[1], 0] });
    }
    for (var i = 0; i < lista.length; i++) {
      var mon = lista[i];
      if (mon.visible === false) continue;
      var tex = texturaDe(mon);
      if (!tex) continue;
      items.push({ clave: 'placa', polys: placa(), textura: tex, mono: true,
                   off: mon.p, esc: mon.t, rot: [mon.r[0], mon.r[1], 0] });
    }
    /* Dibuja los marcos antes que los paneles: la pantalla central se despliega
     * sobre el parabrisas y debe tapar los biseles de los monitores laterales
     * cuando sus proyecciones se cruzan. */
    var mar = [];
    for (i = 0; i < lista.length; i++) {
      var m2 = lista[i];
      if (m2.visible === false) continue;
      mar.push({ clave: 'bisel:' + m2.id, polys: bisel(m2), mono: false,
                 off: m2.p, esc: 1, rot: [m2.r[0], m2.r[1], 0] });
    }
    if (mar.length) est.R3D.dibujarTexturado(cam, mar, { soloVista: true, sinProfundidad: true });
    if (items.length) {
      est.R3D.dibujarTexturado(cam, items, { soloVista: true, sinProfundidad: true });
    }
    return true;
  }

  /* =======================================================================
   * RAYCAST
   * ==================================================================== */
  /** Inversa de P·V por Gauss-Jordan con pivoteo parcial. */
  function inversa(m) {
    var n = 4, a = [], i, j, k, d, t;
    for (i = 0; i < n; i++) {
      a.push([m[0*n+i], m[1*n+i], m[2*n+i], m[3*n+i],
              i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0]);
    }
    for (i = 0; i < n; i++) {
      var p = i;
      for (j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
      if (Math.abs(a[p][i]) < 1e-12) return CJ.GL.matrices.ident();
      t = a[i]; a[i] = a[p]; a[p] = t;
      d = a[i][i];
      for (j = 0; j < 2 * n; j++) a[i][j] /= d;
      for (j = 0; j < n; j++) {
        if (j === i) continue;
        var f = a[j][i];
        if (!f) continue;
        for (k = 0; k < 2 * n; k++) a[j][k] -= f * a[i][k];
      }
    }
    var out = new Float32Array(16);
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) out[j*n+i] = a[i][n+j];
    return out;
  }

  function aplica(m, v) {
    return [
      m[0]*v[0] + m[4]*v[1] + m[8]*v[2]  + m[12]*v[3],
      m[1]*v[0] + m[5]*v[1] + m[9]*v[2]  + m[13]*v[3],
      m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
      m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3]
    ];
  }

  /** Rectángulo de un monitor en coordenadas de cámara, con su giro. */
  function rectLocal(mon) {
    var cy = Math.cos(mon.r[1]), sy = Math.sin(mon.r[1]);
    var cx = Math.cos(mon.r[0]), sx = Math.sin(mon.r[0]);
    var e = [[-1,-1], [1,-1], [1,1], [-1,1]], out = [], i;
    for (i = 0; i < 4; i++) {
      var x = e[i][0] * mon.t[0] / 2, y = e[i][1] * mon.t[1] / 2;
      var y1 = y * cx, z1 = -y * sx;
      var x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
      out.push([x2 + mon.p[0], y1 + mon.p[1], z2 + mon.p[2]]);
    }
    return out;
  }

  /** Rectángulo del monitor en NDC (para dibujar el foco y probar el ratón). */
  function rectNDC(mon, aspecto, cabYaw, cabPit) {
    var M = CJ.GL.matrices;
    var proj = M.perspectiva(FOV_CAB, aspecto, 0.1, 20);
    cabYaw = cabYaw == null ? est.cabYaw : cabYaw;
    cabPit = cabPit == null ? est.cabPit : cabPit;
    var vista = CJ.GL.matrices.mul(
      M.mul(M.rotX(-cabPit), M.rotY(-cabYaw)), M.escala(1, 1, -1));
    var q = rectLocal(mon), out = [];
    for (var i = 0; i < 4; i++) {
      var v = aplica(proj, aplica(vista, [q[i][0], q[i][1], q[i][2], 1]));
      out.push([v[0] / v[3], v[1] / v[3]]);
    }
    return out;
  }

  /** Punto del monitor bajo el puntero, o null. */
  function monitorBajoRaton(clientX, clientY, opciones) {
    if (!est.canvas) return null;
    opciones = opciones || {};
    var asp = opciones.aspecto || 1.7;
    var r = (est.canvas.getBoundingClientRect && est.canvas.getBoundingClientRect()) || null;
    var w = r && r.width ? r.width : est.canvas.clientWidth || est.canvas.width;
    var h = r && r.height ? r.height : est.canvas.clientHeight || est.canvas.height;
    if (!w || !h) return null;
    var nx = ((clientX - (r ? r.left : 0)) / w) * 2 - 1;
    var ny = 1 - ((clientY - (r ? r.top : 0)) / h) * 2;
    if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;

    var M = CJ.GL.matrices;
    /* Se deshace exactamente la misma cadena que usa el sombreado —
     * perspectiva × rotaciones × reflejo en Z— con lo que el punto de pantalla
     * que el jugador señala y el que el sombreado coloca coinciden. La cabina
     * queda detrás del plano cercano y sus monitores en z positivo, así que el
     * rayo sale hacia +z sin ninguna inversión extra. */
    var vista = M.mul(M.mul(M.rotX(-(opciones.cabPit || 0)), M.rotY(-(opciones.cabYaw || 0))),
                      M.escala(1, 1, -1));
    var inv = inversa(M.mul(M.perspectiva(FOV_CAB, asp, 0.1, 20), vista));
    var a = aplica(inv, [nx, ny, -1, 1]);
    var b = aplica(inv, [nx, ny,  1, 1]);
    var o = [a[0]/a[3], a[1]/a[3], a[2]/a[3]];
    var d = [b[0]/b[3] - o[0], b[1]/b[3] - o[1], b[2]/b[3] - o[2]];
    var L = Math.hypot(d[0], d[1], d[2]) || 1;
    d = [d[0]/L, d[1]/L, d[2]/L];

    var lista = opciones.monitores || MONITORES;
    /* No se puede recibir clic en la pantalla central cuando está oculta: en
     * la vista Instrumentos eso interceptaba los rayos y bloqueaba los seis
     * monitores físicos que sí se ven en la cabina. */
    if (opciones.incluirCentral !== false && CENTRAL.visible !== false) {
      lista = [CENTRAL].concat(lista);
    }
    var mejor = null;
    for (var i = 0; i < lista.length; i++) {
      var mon = lista[i];
      if (mon.visible === false) continue;
      var q = rectLocal(mon);
      var hit = triPunto(o, d, q[0], q[1], q[2], 0, 0, 1, 0, 1, 1) ||
                triPunto(o, d, q[0], q[2], q[3], 0, 0, 1, 1, 0, 1);
      var borde = false;
      if (!hit && mon.id !== 'central') {
        var qb = rectLocal({ p: mon.p, r: mon.r, t: [mon.t[0] + 0.27, mon.t[1] + 0.27] });
        hit = triPunto(o, d, qb[0], qb[1], qb[2], 0, 0, 1, 0, 1, 1) ||
              triPunto(o, d, qb[0], qb[2], qb[3], 0, 0, 1, 1, 0, 1);
        borde = !!hit;
      }
      if (!hit) continue;
      if (!mejor || hit.t < mejor.t) mejor = { t: hit.t, mon: mon, u: hit.u, v: hit.v, mando: borde };
    }
    /* Los mandos inferiores son superficies clicables separadas de las
     * pantallas. Devuelven el módulo enlazado a cada grupo físico. */
    for (i = 0; i < MANDOS.length; i++) {
      var mando = MANDOS[i], mq = rectLocal(mando);
      var mh = triPunto(o, d, mq[0], mq[1], mq[2], 0, 0, 1, 0, 1, 1) ||
               triPunto(o, d, mq[0], mq[2], mq[3], 0, 0, 1, 1, 0, 1);
      var modulo = porId(mando.id);
      if (mh && modulo && (!mejor || mh.t < mejor.t)) mejor = { t: mh.t, mon: modulo, u: mh.u, v: mh.v, mando: true };
    }
    return mejor;
  }

  /**
   * Intersección rayo-triángulo de Möller–Trumbore.
   * Devuelve la distancia y las coordenadas del punto dentro del triángulo, o
   * null si no hay impacto.
   *
   * Los parámetros uv se pasan como `c0, d0, c1, d1, c2, d2`: usar nombres como
   * `u0, v0` hacía que `var v` (la segunda coordenada barycéntrica) chocara con
   * `v0` y devolviera NaN silenciosamente en cuanto había uv.
   */
  function triPunto(o, d, a, b, c, c0, d0, c1, d1, c2, d2) {
    var e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    var e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    var p = [d[1]*e2[2] - d[2]*e2[1], d[2]*e2[0] - d[0]*e2[2], d[0]*e2[1] - d[1]*e2[0]];
    var det = e1[0]*p[0] + e1[1]*p[1] + e1[2]*p[2];
    if (Math.abs(det) < 1e-9) return null;
    var inv = 1 / det;
    var tv = [o[0]-a[0], o[1]-a[1], o[2]-a[2]];
    var bu = (tv[0]*p[0] + tv[1]*p[1] + tv[2]*p[2]) * inv;
    if (bu < -1e-6 || bu > 1 + 1e-6) return null;
    var q = [tv[1]*e1[2] - tv[2]*e1[1], tv[2]*e1[0] - tv[0]*e1[2], tv[0]*e1[1] - tv[1]*e1[0]];
    var bv = (d[0]*q[0] + d[1]*q[1] + d[2]*q[2]) * inv;
    if (bv < -1e-6 || bu + bv > 1 + 1e-6) return null;
    var t = (e2[0]*q[0] + e2[1]*q[1] + e2[2]*q[2]) * inv;
    if (!(t > 0)) return null;      /* también descarta NaN */
    return {
      t: t,
      u: c0 + bu * (c1 - c0) + bv * (c2 - c0),
      v: d0 + bu * (d1 - d0) + bv * (d2 - d0)
    };
  }

  /* =======================================================================
   * NAVEGACIÓN POR TECLADO
   * ==================================================================== */
  function monitores() {
    var l = [];
    if (CENTRAL.visible !== false) l.push(CENTRAL);
    for (var i = 0; i < MONITORES.length; i++) {
      if (MONITORES[i].visible !== false) l.push(MONITORES[i]);
    }
    return l;
  }

  function porId(id) {
    if (!id) return null;
    if (CENTRAL.id === id) return CENTRAL;
    for (var i = 0; i < MONITORES.length; i++) if (MONITORES[i].id === id) return MONITORES[i];
    return null;
  }

  function setItems(id, items) {
    est.items[id] = items || [];
    var s = est.sel[id] || 0;
    if (s >= est.items[id].length) est.sel[id] = 0;
  }

  function itemsDe(id) { return est.items[id] || []; }

  function foco(id) {
    if (id && !porId(id)) return null;
    est.foco = id || null;
    if (id) {
      if (est.sel[id] == null) est.sel[id] = 0;
      if (est.scroll[id] == null) est.scroll[id] = 0;
    }
    return est.foco;
  }

  function monFoco() { return porId(est.foco); }

  function tieneFoco() { return !!est.foco; }

  function siguiente() {
    var l = monitores(), a = est.foco ? l.findIndex(function (m) { return m.id === est.foco; }) : -1;
    if (!l.length) return null;
    var id = l[(a + 1) % l.length].id;
    return foco(id);
  }

  function anterior() {
    var l = monitores(), a = est.foco ? l.findIndex(function (m) { return m.id === est.foco; }) : 0;
    if (!l.length) return null;
    var id = l[(a - 1 + l.length) % l.length].id;
    return foco(id);
  }

  function irA(id) {
    var m = porId(id);
    if (!m || (m === CENTRAL && m.visible === false)) return null;
    return foco(id);
  }

  /** F1..F6 y Tab. Devuelve true si la tecla era de cabina. */
  function teclaDeCabina(code, shift) {
    if (code === 'Tab') { shift ? anterior() : siguiente(); return true; }
    var id = TECLAS[code];
    if (id) { irA(id); return true; }
    return false;
  }

  /** Mueve el resaltado. true si el teclado sigue en la cabina. */
  function mover(d) {
    if (!est.foco) return false;
    var l = itemsDe(est.foco);
    if (!l.length) return true;
    var s = est.sel[est.foco] || 0;
    est.sel[est.foco] = (s + d + l.length) % l.length;
    est.scroll[est.foco] = 0;
    return true;
  }

  /** Ajusta el elemento: deslizador o lista de opciones. */
  function ajustar(d) {
    if (!est.foco) return false;
    var l = itemsDe(est.foco);
    var it = l[est.sel[est.foco] || 0];
    if (!it) return true;
    if (it.tipo === 'slider') {
      it.val = Math.max(it.min, Math.min(it.max, it.val + d * (it.paso || 1)));
      if (it.onAjuste) it.onAjuste(it.val, it);
    } else if (it.tipo === 'opcion' && it.opciones && it.opciones.length) {
      var i = it.opciones.indexOf(it.val);
      if (i < 0) i = 0;
      it.val = it.opciones[(i + d + it.opciones.length) % it.opciones.length];
      if (it.onAjuste) it.onAjuste(it.val, it);
    }
    return true;
  }

  function activar() {
    if (!est.foco) return false;
    var l = itemsDe(est.foco);
    var it = l[est.sel[est.foco] || 0];
    if (!it) return true;
    if (typeof it.acc === 'function') it.acc(it.val, it);
    return true;
  }

  function activarItem(it) {
    if (!it) return false;
    if (typeof it.acc === 'function') it.acc(it.val, it);
    return true;
  }

  /** Elemento bajo un punto (u,v) normalizado de la textura de un monitor. */
  function itemEn(mon, u, v) {
    if (!mon) return null;
    var l = itemsDe(mon.id);
    var x = u * mon.pw, y = (1 - v) * mon.ph;
    var best = null;
    for (var i = 0; i < l.length; i++) {
      var it = l[i];
      if (it.x == null || it.w == null) continue;
      if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) {
        if (!best || (it.z || 0) >= (best.z || 0)) best = it;
      }
    }
    return best;
  }

  function indiceDe(mon, it) {
    if (!mon || !it) return 0;
    var l = itemsDe(mon.id);
    for (var i = 0; i < l.length; i++) if (l[i] === it) return i;
    return 0;
  }

  /* =======================================================================
   * API
   * ==================================================================== */
  function init(r3d, canvas) {
    est.R3D = r3d;
    est.canvas = canvas;
    est.cab = null;
    /* `subir` vive en el renderizador (la instancia que devuelve CJ.GL.crear),
     * no en CJ.GL: confundirlos dejaba la cabina sin geometría y el habitáculo
     * no se veía en pantalla, sólo el fondo. */
    if (r3d && typeof r3d.subir === 'function') {
      est.cab = r3d.subir('cabina', construirCabina());
    }
    for (var i = 0; i < MONITORES.length; i++) est.items[MONITORES[i].id] = [];
    est.items.central = [];
    est.foco = null;
    est.visible = false;
  }

  function mostrar(v) { est.visible = !!v; return est.visible; }

  CJ.COCKPIT = {
    MONITORES: MONITORES,
    CENTRAL: CENTRAL,
    TECLAS: TECLAS,
    FOV: FOV_CAB,
    C: C,
    init: init,
    pintar: pintar,
    fov: fov,
    mostrar: mostrar,
    visible: function () { return est.visible; },
    superficie: superficie,
    canvasMonitor: function (id) { return lienzo(id); },
    contexto2D: contexto2D,
    setItems: setItems,
    itemsDe: itemsDe,
    itemEn: itemEn,
    indiceDe: indiceDe,
    porId: porId,
    monitores: monitores,
    foco: foco,
    monFoco: monFoco,
    tieneFoco: tieneFoco,
    siguiente: siguiente,
    anterior: anterior,
    irA: irA,
    irATecla: teclaDeCabina,
    mover: mover,
    ajustar: ajustar,
    activar: activar,
    activarItem: activarItem,
    monitorBajoRaton: monitorBajoRaton,
    rectLocal: rectLocal,
    rectNDC: rectNDC,
    construirCabina: construirCabina,
    estado: est
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CJ.COCKPIT;

})(typeof window !== 'undefined' ? window : this);
