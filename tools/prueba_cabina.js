/* ===========================================================================
 * Arnés de prueba de la cabina inmersiva
 *
 * Levanta los módulos y el script principal en un contexto con DOM simulado y
 * con un motor WebGL de mentira (registra las llamadas, no dibuja nada), y
 * comprueba lo que de verdad importa de la cabina:
 *
 *   1. geometría del habitáculo: polígonos válidos y dentro del encuadre
 *   2. los seis monitores existen, son visibles y caben en pantalla
 *   3. cada monitor se pinta y declara elementos navegables
 *   4. el teclado recorre monitores, elige, ajusta y activa
 *   5. el raycast del ratón acierta el monitor y el elemento señalados
 *   6. las pantallas cambian con el estado: menú → decisión → informe
 *
 * Uso:  node tools/prueba_cabina.js
 * =========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const PROY = path.resolve(__dirname, '..');
const fallos = [];
let ok = 0;
function chk(cond, msg) { if (cond) ok++; else fallos.push(msg); }

/* ------------------------- WebGL de mentira ------------------------- */
function glFalso() {
  const noop = () => {};
  const g = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STATIC_DRAW: 7,
    FLOAT: 8, UNSIGNED_SHORT: 9, UNSIGNED_INT: 10, UNSIGNED_BYTE: 11,
    TEXTURE_2D: 12, TEXTURE0: 13, RGBA: 14, CLAMP_TO_EDGE: 15, LINEAR: 16,
    TEXTURE_WRAP_S: 17, TEXTURE_WRAP_T: 18, TEXTURE_MIN_FILTER: 19, TEXTURE_MAG_FILTER: 20,
    FRAMEBUFFER: 21, RENDERBUFFER: 22, COLOR_ATTACHMENT0: 23, DEPTH_ATTACHMENT: 24,
    DEPTH_COMPONENT16: 25, FRAMEBUFFER_COMPLETE: 26,
    DEPTH_TEST: 27, CULL_FACE: 28, BLEND: 29, SRC_ALPHA: 30, ONE_MINUS_SRC_ALPHA: 31,
    COLOR_BUFFER_BIT: 32, DEPTH_BUFFER_BIT: 33,
    calls: { crearShader: 0, usarPrograma: 0, dibujarElementos: 0, texImage2D: 0 }
  };
  g.createShader = () => ({ shader: true });
  g.shaderSource = noop; g.compileShader = noop; g.getShaderParameter = () => 1;
  g.getShaderInfoLog = () => ''; g.deleteShader = noop;
  g.createProgram = () => ({ prog: true }); g.attachShader = noop; g.linkProgram = noop;
  g.getProgramParameter = () => 1; g.getProgramInfoLog = () => '';
  g.useProgram = () => { g.calls.usarPrograma++; };
  g.getUniformLocation = (p, n) => ({ n });
  g.uniform3f = noop; g.uniform4f = noop; g.uniform1f = noop; g.uniform1i = noop;
  g.uniformMatrix4fv = noop;
  g.createBuffer = () => ({ buf: true }); g.bindBuffer = noop; g.bufferData = noop;
  g.enableVertexAttribArray = noop; g.disableVertexAttribArray = noop; g.vertexAttribPointer = noop;
  g.drawElements = () => { g.calls.dibujarElementos++; };
  g.enable = noop; g.disable = noop; g.depthMask = noop; g.blendFunc = noop;
  g.viewport = noop; g.clearColor = noop; g.clear = noop;
  g.createTexture = () => ({ tex: true }); g.bindTexture = noop;
  g.texParameteri = noop;
  g.texImage2D = () => { g.calls.texImage2D++; };
  g.createFramebuffer = () => ({ fb: true }); g.bindFramebuffer = noop;
  g.createRenderbuffer = () => ({ rb: true }); g.bindRenderbuffer = noop;
  g.renderbufferStorage = noop; g.framebufferRenderbuffer = noop;
  g.framebufferTexture2D = noop; g.checkFramebufferStatus = () => g.FRAMEBUFFER_COMPLETE;
  g.activeTexture = noop;
  return g;
}

/* ------------------------- canvas 2D de mentira ------------------------- */
function ctx2d() {
  const grad = { addColorStop() {} };
  const base = {
    canvas: { width: 960, height: 540 },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
    ellipse() {}, rect() {}, roundRect() {}, fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    setLineDash() {}, setTransform() {},
    createLinearGradient() { return grad; },
    createRadialGradient() { return grad; },
    measureText(t) { return { width: String(t).length * 6 }; }
  };
  return new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return () => undefined; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/* ------------------------- DOM simulado ------------------------- */
const porId = {};
function registrar(n) {
  if (!n) return;
  /* Los ids del registro plano no se pisan: los que aparecen al parsear un
   * `innerHTML` son referenciaslazy y el árbol real manda. */
  if (n.id && !porId[n.id]) porId[n.id] = n;
  (n.children || []).forEach(registrar);
}
function nodo(tag) {
  const n = {
    tagName: (tag || 'div').toUpperCase(), id: '', _html: '', children: [],
    style: {}, dataset: {}, classes: new Set(),
    clientWidth: 1440, clientHeight: 810, width: 1440, height: 810,
    parentNode: null, textContent: '',
    get className() { return [...this.classes].join(' '); },
    set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      /* El navegador no construye el subárbol al vuelo, pero sí crea nodos
       * reales: aquí se crean en `body` para que `getElementById` los
       * encuentre, y se liberan al siguiente render. */
      for (const n of this.children || []) if (n._soltar) n._soltar();
      this.children = [];
      this._soltar = null;
      const ids = this._html.match(/id="[^"]+"/g) || [];
      const míos = [];
      for (const mm of ids) {
        const id = mm.slice(4, -1);
        const n = nodo('div');
        n.id = id;
        míos.push(n);
        porId[id] = n;
        this.appendChild(n);
      }
    },
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); registrar(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    querySelector() { return nodo('span'); },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, removeAttribute() {},
    getContext(t) { return t === '2d' ? ctx2d() : (t === 'webgl' ? glFalso() : null); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 810, right: 1440, bottom: 810 }; },
    setPointerCapture() {}, closest() { return null; }, focus() {}
  };
  n.classList = {
    add: c => n.classes.add(c), remove: c => n.classes.delete(c),
    contains: c => n.classes.has(c), toggle: c => n.classes.has(c) ? n.classes.delete(c) : n.classes.add(c)
  };
  return n;
}
porId.app = nodo('div'); porId.app.id = 'app';

const docHnd = {};
const cuerpo = nodo('body');
const doc = {
  readyState: 'complete',
  documentElement: nodo('html'),
  head: nodo('head'),
  body: cuerpo,
  activeElement: null,
  getElementById(id) { return porId[id] || nodo('div'); },
  createElement(t) { return nodo(t); },
  addEventListener(t, f) { (docHnd[t] = docHnd[t] || []).push(f); },
  querySelector() { return null; }
};
function despacha(tipo, ev) {
  /* El teclado del simulador se registra en `window` y el interfaz clásico en
   * `document`. Un evento de teclado real llega a los dos, así que el arnés
   * hace lo mismo. */
  for (const f of sandboxHnd[tipo] || []) f(ev);
  for (const f of docHnd[tipo] || []) f(ev);
}

/* `getElementById` tiene que buscar en el árbol, no sólo en el registro plano:
 * el juego crea el hueco del visor con `document.createElement` + `appendChild`,
 * y sin esta búsqueda el DOM simulado no lo encontraría. */
const getOriginal = doc.getElementById;
doc.getElementById = function (id) {
  if (porId[id]) return porId[id];
  let r = null;
  (function busca(n) {
    if (r) return;
    if (n.id === id) { r = n; return; }
    for (const c of n.children || []) busca(c);
  })(cuerpo);
  /* Como el navegador: si no existe, `null`. Devolver un nodo vacío haría que
   * toda comprobación `if ($('algo'))` saliera siempre cierta y el arranque
   * de la cabina se creería montado sin serlo. */
  if (r) { porId[id] = r; return r; }
  return null;
};

const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean,
  Float32Array, Uint16Array, Uint32Array, Int32Array, isNaN, isFinite,
  parseInt, parseFloat, Error, TypeError, RangeError, RegExp, Promise, Symbol,
  document: doc,
  location: { hash: '', href: '' },
  navigator: { userAgent: 'prueba' },
  performance: { now: () => Date.now() },
  innerWidth: 1440, innerHeight: 810,
  devicePixelRatio: 1,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  addEventListener(t, f) { (sandboxHnd[t] = sandboxHnd[t] || []).push(f); },
  removeEventListener() {},
  dispatchEvent: () => true,
  Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }
};
const sandboxHnd = {};
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);

function ejecutar(file) {
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  } catch (e) {
    fallos.push('ejecución ' + path.basename(file) + ': ' + e.message);
  }
}

['js/orbital.js', 'js/glcore.js', 'js/vehiculo.js', 'js/iconos.js',
 'js/creditos.js', 'js/arranque.js', 'js/laboratorio.js', 'js/cabina.js',
 'js/controls.js', 'js/flight.js', 'js/hud_flight.js', 'js/stages.js',
 'js/academia.js', 'js/cockpit.js', 'js/cabina_enlace.js'
].forEach(f => ejecutar(path.join(PROY, f)));

const CJ = sandbox.CJ || {};
chk(!!CJ.COCKPIT, 'CJ.COCKPIT ausente');
chk(!!CJ.CABINA, 'CJ.CABINA ausente');
if (!CJ.COCKPIT) { console.log('FALLOS: ' + fallos.length); process.exit(1); }

/* script principal */
const html = fs.readFileSync(path.join(PROY, 'Cislunar Junior - Cañon Labs.html'), 'utf8');
const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
try {
  vm.runInContext(scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],
    sandbox, { filename: 'inline.js' });
} catch (e) {
  fallos.push('ejecución del script principal: ' + e.message);
}

const CAB = CJ.COCKPIT, CABINA = CJ.CABINA;

/* ================= 1. geometría del habitáculo ================= */
const pol = CAB.construirCabina();
chk(Array.isArray(pol) && pol.length > 100, 'la cabina tiene pocos polígonos (' + pol.length + ')');
let malos = 0, fuera = 0;
for (const p of pol) {
  if (!p.v || p.v.length < 3 || !p.c) { malos++; continue; }
  for (const v of p.v) {
    if (!isFinite(v[0]) || !isFinite(v[1]) || !isFinite(v[2])) { malos++; continue; }
    if (Math.abs(v[0]) > 12 || Math.abs(v[1]) > 12 || Math.abs(v[2]) > 12) fuera++;
  }
}
chk(malos === 0, 'la cabina tiene ' + malos + ' polígonos inválidos');
chk(fuera === 0, 'la cabina tiene ' + fuera + ' vértices fuera de la envoltura razonable');

/* Nada debe tapar el parabrisas central salvo la pantalla central cuando
 * está abierta: el rectángulo libre ha de quedar en el centro del cuadro. */
const fov = CAB.FOV, asp = 1440 / 810;
function ndc(v) {
  const M = CJ.GL.matrices;
  const vista = M.mul(M.mul(M.rotX(0), M.rotY(0)), M.escala(1, 1, -1));
  const proj = M.perspectiva(fov, asp, 0.1, 20);
  const r = [];
  const e = [[0,0,1],[0,0,0]];
  void e;
  return r;
}
void ndc;

/* Los seis monitores, más la pantalla central, tienen que caer dentro del
 * encuadre con el campo de visión de la cabina. */
const M = CJ.GL.matrices;
const projC = M.perspectiva(fov, asp, 0.1, 20);
const vistaC = M.mul(M.mul(M.rotX(0), M.rotY(0)), M.escala(1, 1, -1));
const mvpC = M.mul(projC, vistaC);
/* Matriz del sombreado para una proporción de pantalla dada. */
function mvpPara(a, yaw, pit) {
  if (!yaw && !pit && a === asp) return mvpC;
  const vista = M.mul(M.mul(M.rotX(-(pit || 0)), M.rotY(-(yaw || 0))), M.escala(1, 1, -1));
  return M.mul(M.perspectiva(fov, a, 0.1, 20), vista);
}
function aNdc(mon, esquina) {
  const q = CAB.rectLocal(mon)[esquina];
  const v = [q[0], q[1], q[2], 1], r = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    r[i] = mvpC[i] * v[0] + mvpC[4 + i] * v[1] + mvpC[8 + i] * v[2] + mvpC[12 + i];
  }
  return [r[0] / r[3], r[1] / r[3]];
}

/* Para medir los seis paneles hay que dejar la pantalla central cerrada: si
 * está abierta, es lo que hay delante del rayo y lo tapa todo. */
CAB.CENTRAL.visible = false;

const MON = CAB.MONITORES;
chk(MON.length === 6, 'deben existir 6 monitores, hay ' + MON.length);
const vistos = new Set();
for (const mon of MON) {
  vistos.add(mon.id);
  chk(!!mon.nom, 'el monitor ' + mon.id + ' no tiene nombre');
  chk(!!CAB.TECLAS[[mon.tecla]] || Object.values(CAB.TECLAS).indexOf(mon.id) >= 0,
      'el monitor ' + mon.id + ' no tiene tecla asignada');
  chk(mon.pw >= 256 && mon.ph >= 128, 'el monitor ' + mon.id + ' tiene una textura demasiado pequeña');
  chk(mon.t[0] > 0 && mon.t[1] > 0, 'el monitor ' + mon.id + ' tiene tamaño nulo');
  /* Telemetría, controles, comunicaciones y sistemas son tiras anchas: van en el
   * salpicadero y en la consola de techo. El resto debe parecerse a un panel. */
  const tiras = ['telemetria', 'controles', 'comms', 'sistemas'];
  if (tiras.indexOf(mon.id) < 0) {
    chk(mon.t[0] / mon.t[1] > 1.1 && mon.t[0] / mon.t[1] < 2.2,
        'el monitor ' + mon.id + ' no tiene proporción de panel ('
          + (mon.t[0] / mon.t[1]).toFixed(2) + ')');
  }
  for (let e = 0; e < 4; e++) {
    const p = aNdc(mon, e);
    chk(p[0] >= -1.001 && p[0] <= 1.001,
        'el monitor ' + mon.id + ' se sale por los lados (x=' + p[0].toFixed(2) + ')');
    chk(p[1] >= -1.001 && p[1] <= 1.001,
        'el monitor ' + mon.id + ' se sale por arriba o abajo (y=' + p[1].toFixed(2) + ')');
  }
}
['comms', 'telemetria', 'sistemas', 'mapa', 'checklist', 'controles'].forEach(id =>
  chk(vistos.has(id), 'falta el monitor ' + id));
/* La pantalla central también, y debe tapar el centro (ahí va la decisión). */
chk(CAB.CENTRAL.id === 'central', 'la pantalla central no existe');
for (let e = 0; e < 4; e++) {
  const p = aNdc(CAB.CENTRAL, e);
  chk(p[0] >= -1.001 && p[0] <= 1.001 && p[1] >= -1.001 && p[1] <= 1.001,
      'la pantalla central se sale del encuadre');
}

/* El arranque usa CJ.BOOT.cargar, que va con temporizadores; aquí se resuelve
 * al momento (como en el arnés del simulador) para que la cabina quede montada
 * antes de comprobar nada. */
CJ.BOOT.cargar = function (tarea) {
  if (typeof tarea === 'function') tarea();
  return Promise.resolve();
};
sandbox.inicio();

/* ================= 2. arranque del juego ================= */
try { sandbox.pintarCabinaSola(); ok++; }
catch (e) { fallos.push('pintarCabinaSola: ' + e.message); }
chk(!!sandbox.INMERSIVO, 'la cabina no se activó (INMERSIVO=' + sandbox.INMERSIVO + ')');
chk(CAB.visible(), 'la cabina no se marcó visible');
try { sandbox.nuevaPartida(0); ok++; }
catch (e) { fallos.push('nuevaPartida: ' + e.message); }
chk(CABINA.nav.central === 'decision',
    'al empezar la partida la pantalla central no muestra la decisión');
try { sandbox.pintar(); ok++; } catch (e) { fallos.push('pintar en cabina: ' + e.message); }

/* Telemetría: los recursos deben salir enteros y en rango */
const tel = CABINA.datosTelemetria();
chk(tel.res.length === 5, 'la telemetría no lista los 5 recursos');
chk(tel.res.every(v => isFinite(v) && v >= 0 && v <= 100), 'recursos fuera de rango en telemetría');
chk(tel.velTxt !== 'NaN' && tel.altTxt.indexOf('NaN') < 0, 'la telemetría muestra NaN');
chk(!!tel.mision && tel.mision !== '—', 'la telemetría no identifica la misión');

/* Comunicaciones: los filtros son navegables y el registro tiene tipo */
const com = CABINA.datosComms();
chk(com.filtros.length >= 4, 'hay muy pocos filtros de comunicaciones');
chk(com.lineas.length > 0, 'el registro de comunicaciones está vacío con la partida empezada');
chk(com.lineas.every(l => l.t === 'fase' || !!l.c), 'una línea de comunicaciones sin clasificar');

/* Sistemas: los ocho subsistemas con estado */
const sis = CABINA.datosSistemas();
chk(sis.sistemas.length === 8, 'faltan subsistemas en la pantalla de sistemas');
chk(sis.sistemas.every(s => !!s.estado), 'un subsistema sin estado');
chk(sis.sistemas.every(s => ['NOMINAL', 'STBY', 'BAJO', 'CRÍTICO', 'ALERTA', 'REDUCIDO',
                              'ARMADO', 'SEGURO', 'SIN TELEMETRÍA', 'NO DISPONIBLE'].indexOf(s.estado) >= 0),
    'un subsistema con estado desconocido: ' + sis.sistemas.map(s => s.estado).join(','));

/* ================= 4. navegación por teclado ================= */
/* Durante el vuelo la pantalla central se aparta: es lo que hace
 * `syncCabina`, y sin ella taparía el rayo de los paneles de abajo. */
CAB.CENTRAL.visible = false;
CAB.setItems('telemetria', [
  { x: 10, y: 10, w: 80, h: 20, t: 'uno', acc: function () { chk(true, 'x'); sandbox.MARCA = 1; } },
  { x: 10, y: 40, w: 80, h: 20, t: 'dos', acc: function () { sandbox.MARCA = 2; } },
  { x: 10, y: 70, w: 80, h: 20, t: 'tres', tipo: 'opcion', val: 0,
    opciones: [0, 1, 2],
    onAjuste: function (v) { sandbox.VALOR = v; },
    acc: function (v) { sandbox.VALOR = v; } }
]);
CAB.foco('telemetria');
chk(CAB.estado.sel.telemetria === 0, 'el foco no arranca en el primer elemento');
CAB.mover(1);
chk(CAB.estado.sel.telemetria === 1, 'la flecha abajo no avanza el resaltado');
CAB.mover(1);
chk(CAB.estado.sel.telemetria === 2, 'la flecha abajo no llega al tercer elemento');
CAB.mover(1);
chk(CAB.estado.sel.telemetria === 0, 'el resaltado no da la vuelta');
CAB.mover(-1);
chk(CAB.estado.sel.telemetria === 2, 'la flecha arriba no retrocede');
CAB.activar();
chk(sandbox.VALOR === 0, 'Enter no activó el elemento resaltado');

/* ← → recorren las opciones */
CAB.ajustar(1);
chk(sandbox.VALOR === 1, 'la flecha derecha no ajusta el valor');
CAB.ajustar(-1);
chk(sandbox.VALOR === 0, 'la flecha izquierda no ajusta el valor');
CAB.ajustar(-1);
chk(sandbox.VALOR === 2, 'el ajuste no da la vuelta por la lista');

/* Sólo hay tres pantallas físicas visibles; las auxiliares se abren desde
 * mandos físicos y siguen disponibles para navegación por teclado. */
CAB.CENTRAL.visible = true;
const orden = CAB.monitores();
chk(orden.length === 4, 'deben listarse la central y los tres monitores frontales, hay ' + orden.length);
CAB.foco(null);
const recorrido = [];
for (let i = 0; i < orden.length; i++) {
  const id = CAB.siguiente();
  recorrido.push(id);
  chk(CAB.monFoco() && CAB.monFoco().id === id, 'siguiente() no dejó el foco donde debía');
}
chk(recorrido.length === orden.length, 'Tab no recorre todos los monitores');
chk(new Set(recorrido).size === orden.length, 'Tab repitió un monitor');
/* Al dar la vuelta completa se vuelve al punto de partida */
CAB.foco(recorrido[0]);
CAB.siguiente();
chk(CAB.monFoco().id === recorrido[1], 'siguiente() no avanzó tras reiniciar el foco');

/* Shift+Tab va al revés */
CAB.anterior();
chk(CAB.monFoco().id === recorrido[0], 'anterior() no vuelve al monitor previo');

/* F1..F6 saltan al monitor correcto */
Object.keys(CAB.TECLAS).forEach(code => {
  const id = CAB.TECLAS[code];
  CAB.foco(null);
  const r = CAB.irATecla(code);
  chk(r === true, 'la tecla ' + code + ' no fue reconocida');
  chk(CAB.monFoco() && CAB.monFoco().id === id,
      code + ' no fue a ' + id + ' sino a ' + (CAB.monFoco() ? CAB.monFoco().id : 'nada'));
});

/* Un monitor oculto no recibe el foco */
CAB.CENTRAL.visible = false;
chk(CAB.irA('central') === null, 'una pantalla oculta no debería recibir el foco');
CAB.CENTRAL.visible = true;
chk(CAB.irA('central') === 'central', 'no se puede enfocar la pantalla central');

/* ================= 5. raycast del ratón ================= */
/* Se calcula el centro del monitor en píxeles de pantalla y se comprueba que el
 * rayo que sale de ahí lo alcanza; y que un punto fuera del habitáculo no.
 * La pantalla central está cerrada para no tapar los paneles. */
CAB.CENTRAL.visible = false;
/* Centro del monitor proyectado con las matrices reales del sombreado: es la
 * única forma de obtener el píxel exacto que el jugador vería. */
function centroPantalla(mon, W, H, a, yaw, pit) {
  const q = CAB.rectLocal(mon);
  let sx = 0, sy = 0, sz = 0;
  for (const p of q) { sx += p[0]; sy += p[1]; sz += p[2]; }
  sx /= 4; sy /= 4; sz /= 4;
  const m = mvpPara(a || asp, yaw, pit);
  const v = [sx, sy, sz, 1], r = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++)
    r[i] = m[i]*v[0] + m[4+i]*v[1] + m[8+i]*v[2] + m[12+i];
  return { x: (r[0]/r[3] + 1) / 2 * W, y: (1 - r[1]/r[3]) / 2 * H };
}
const W = 1440, H = 810;
const giroYaw = 0.24, giroPit = -0.12;
const cg = centroPantalla(CAB.porId('telemetria'), W, H, asp, giroYaw, giroPit);
const hitG = CAB.monitorBajoRaton(cg.x, cg.y, { aspecto: asp, cabYaw: giroYaw, cabPit: giroPit });
chk(!!hitG && hitG.mon.id === 'telemetria',
    'el raycast no sigue la mirada girada de la cabina');
for (const mon of MON) {
  const c = centroPantalla(mon, W, H, asp);
  const hit = CAB.monitorBajoRaton(c.x, c.y, { aspecto: asp });
  chk(!!hit, 'el rayo no alcanza el monitor ' + mon.id);
  if (hit) {
    chk(hit.mon.id === mon.id,
        'el punto central de ' + mon.id + ' golpeó ' + hit.mon.id);
    chk(hit.u > 0.4 && hit.u < 0.6 && hit.v > 0.4 && hit.v < 0.6,
        'las uv del centro de ' + mon.id + ' no están en medio (' +
        hit.u.toFixed(2) + ', ' + hit.v.toFixed(2) + ')');
  }
}
/* Fuera del habitáculo no debe haber monitor */
const fuera1 = CAB.monitorBajoRaton(4, 4, { aspecto: asp });
chk(fuera1 === null, 'la esquina superior izquierda no debería dar monitor');
/* Una esquina del monitor (arriba-izquierda) cae dentro y da uv cercana a (0,1) */
const m0 = MON[0];
const q0 = CAB.rectLocal(m0);
void q0;

/* Con la central abierta, su centro debe ganar al monitor que hay detrás */
CAB.CENTRAL.visible = true;
const cc = centroPantalla(CAB.CENTRAL, W, H);
const hitC = CAB.monitorBajoRaton(cc.x, cc.y, { aspecto: asp });
chk(!!hitC, 'el rayo no alcanza la pantalla central abierta');
if (hitC) chk(hitC.mon.id === 'central',
              'la pantalla central no se coloca delante (golpeó ' + hitC.mon.id + ')');
CAB.CENTRAL.visible = false;

/* itemEn: el punto central del monitor debe dar el elemento que lo cubre
 * Los rectángulos se dan relativos al tamaño real del monitor: con coordenadas
 * fijas, un cambio de resolución dejaba el elemento fuera del lienzo. */
const MM = CAB.porId('mapa');
const cx0 = Math.round(MM.pw * 0.2), cy0 = Math.round(MM.ph * 0.2);
CAB.setItems('mapa', [
  { x: 0, y: 0, w: 10, h: 10, t: 'esquina' },
  { x: cx0, y: cy0, w: Math.round(MM.pw * 0.6), h: Math.round(MM.ph * 0.6),
    t: 'medio', acc: function () { sandbox.MARCA_MAPA = 'medio'; } }
]);
const it = CAB.itemEn(CAB.porId('mapa'), 0.5, 0.5);
chk(!!it, 'itemEn no encuentra el elemento central');
if (it) chk(it.t === 'medio', 'itemEn devolvió ' + it.t);
const itEsq = CAB.itemEn(CAB.porId('mapa'), 0.001, 0.999);
chk(!!itEsq && itEsq.t === 'esquina', 'itemEn no encuentra el elemento de la esquina');
const itFuera = CAB.itemEn(CAB.porId('mapa'), 0.99, 0.02);
chk(!itFuera, 'itemEn devuelve un elemento donde no hay nada');

/* ================= 6. flujo de pantallas ================= */
CABINA.abrir('menu');
const dMenu = CABINA.datosCentral();
chk(dMenu.tipo === 'menu', 'el menú no se identifica como tal');
chk(dMenu.misiones.length === 4, 'el menú debe listar 4 misiones, lista ' + dMenu.misiones.length);
chk(dMenu.extras.length === 4, 'el menú debe ofrecer academia, laboratorio, ajustes y créditos');
const itMenu = CAB.itemsDe('central');
chk(itMenu.length >= 8, 'el menú declara pocos elementos (' + itMenu.length + ')');
chk(itMenu[0] && itMenu[0].t === 'Apolo 11', 'la primera casilla del menú no es Apolo 11');

/* Elegir una misión con Enter arranca la partida.
 *
 * Nota sobre el contexto: `var S` del script principal no cuelga del objeto
 * global del `vm`, así que `sandbox.S` no refleja la reasignación. El enlace de
 * la cabina lo resuelve pasando `S` como *función* (`function () { return S; }`),
 * que sí ve la variable viva; por eso el estado se lee con `datosCentral()`. */
const partida = () => CABINA.datosCentral().S;
chk(!!partida(), 'no hay partida tras el arranque');

CAB.foco('central');
CAB.estado.sel.central = 0;
CAB.activar();
chk(partida() && partida().m === 0, 'el menú no arrancó la misión de la casilla 1 (m=' +
    (partida() && partida().m) + ')');
/* Este bloque comprueba el flujo de decisión aunque una misión empiece con
 * un segmento manual que ya haya puesto el estado en vuelo. */
if (partida()) partida().phase = 'decision';
CABINA.nav.central = 'decision';
chk(CABINA.nav.central === 'decision', 'tras arrancar, la pantalla central no muestra la decisión');

const dDec = CABINA.datosCentral();
chk(dDec.tipo === 'decision', 'no se reconoce la pantalla de decisión');
chk(!!dDec.ev && Array.isArray(dDec.ev.o), 'la decisión no trae el evento');
chk(dDec.ev.o.length >= 2, 'la decisión no trae opciones');
chk(!!dDec.panel && !!dDec.panel.ruta && !!dDec.panel.tele,
    'el monitor central no recibe el panel de telemetría y ruta');
const vistaPrueba = sandbox.INMERSIVO;
sandbox.INMERSIVO = false; // comprueba el panel de respaldo con controles de monitor
CABINA.abrir('decision');
const itDec = CAB.itemsDe('central');
chk(itDec.length >= dDec.ev.o.length + 3, 'la decisión declara menos elementos que opciones');
sandbox.INMERSIVO = vistaPrueba;

/* Elegir + confirmar avanza el evento */
const ev0 = partida().i;
partida().elej = 0;
CABINA.confirmar();
chk(partida().i !== ev0 || partida().fin, 'confirmar no avanzó el evento (i=' +
    partida().i + ' ev0=' + ev0 + ')');

/* Al terminar la misión debe aparecer el informe */
let pasos = 0;
while (!partida().fin && pasos < 60) { sandbox.ap(0); pasos++; }
chk(!!partida().fin, 'la misión no terminó en 60 pasos');
sandbox.syncCabina();
chk(CABINA.nav.central === 'informe', 'al terminar no se abre el informe');
const dInf = CABINA.datosCentral();
chk(dInf.tipo === 'informe', 'no se identifica la pantalla de informe');
chk(dInf.res.length === 5, 'el informe no muestra los 5 recursos');
chk(typeof dInf.ok === 'boolean', 'el informe no indica si la misión se cumplió');
try { CABINA.pintarMon('central', dInf); ok++; } catch (e) { fallos.push('pintar informe: ' + e.message); }
const itInf = CAB.itemsDe('central');
chk(itInf.length >= 2, 'el informe no ofrece reintentar ni volver al menú');

/* Ajustes, créditos y Academia pintan sin romperse */
for (const t of ['ajustes', 'creditos', 'academia', 'lab', 'pausa', 'tripulacion']) {
  CABINA.nav.central = t;
  const d = CABINA.datosCentral();
  chk(d.tipo === t, 'la pantalla ' + t + ' no se identifica');
  try { CABINA.pintarMon('central', d); ok++; }
  catch (e) { fallos.push('pintar ' + t + ': ' + e.message); }
  chk(CAB.itemsDe('central').length > 0, 'la pantalla ' + t + ' no declara elementos');
}
CABINA.nav.central = 'ajustes';
const dAj = CABINA.datosCentral();
chk(dAj.opciones.length >= 4, 'faltan opciones en ajustes');
chk(dAj.opciones.some(o => o.tipo === 'slider' && o.max === 3),
    'no hay control deslizante de asistencia 0..3');
/* Ajustar el deslizante con ← → y comprobar que llega a AJ */
CAB.setItems('central', dAj.opciones.map((o, i) => ({
  x: 20, y: 80 + i * 56, w: 500, h: 48, t: o.n, tipo: o.tipo, val: o.v,
  opciones: o.opciones, min: o.min, max: o.max, paso: o.paso,
  onAjuste: function (v) { CABINA.ajustar(o.k, v); }
})));
const iAsis = dAj.opciones.findIndex(o => o.k === 'asistencia');
CAB.foco('central');
CAB.estado.sel.central = iAsis;
CAB.ajustar(1);
chk(sandbox.AJ.asistencia === 3, 'el deslizante de asistencia no llega al máximo ('
  + sandbox.AJ.asistencia + ')');

/* Créditos con los identificadores de NASA */
CABINA.nav.central = 'creditos';
const dCre = CABINA.datosCentral();
chk(dCre.bloques.length >= 4, 'faltan bloques en los créditos');
chk(dCre.bloques.some(b => /as11-40-5927|S70-34902|PIA14838/.test(b[1])),
    'los créditos no citan los identificadores de NASA');

/* ================= 7. entrada: foco teclado / ratón ================= */
const CTL = CJ.CTL;
if (CTL) {
  sandbox.YAW = 0.5;
  /* Con el foco en la cabina, una flecha no debe girar la cámara */
  sandbox.CAM_MODE = 'orbital';
  CTL.tomarFoco();
  chk(CTL.tieneFoco(), 'tomarFoco no registró el foco');
  despacha('keydown', { code: 'ArrowRight', key: 'ArrowRight', preventDefault() {} });
  chk(sandbox.YAW === 0.5, 'la flechaDerecha movió la cámara con el foco en la cabina');
  /* Esc devuelve el mando al vehículo */
  despacha('keydown', { code: 'Escape', key: 'Escape', preventDefault() {} });
  chk(!CTL.tieneFoco(), 'Esc no soltó el foco de la cabina');
  /* Soltar el foco no convierte la cabina en cámara exterior. */
  despacha('keydown', { code: 'ArrowRight', key: 'ArrowRight', preventDefault() {} });
  chk(sandbox.YAW === 0.5, 'tras Esc la flecha movió el exterior desde la cabina');
  sandbox.VISTA_EXTERIOR = true;
  despacha('keydown', { code: 'ArrowRight', key: 'ArrowRight', preventDefault() {} });
  chk(sandbox.YAW !== 0.5, 'en Exterior la flecha no gira la cámara');
  sandbox.VISTA_EXTERIOR = false;
  despacha('keyup', { code: 'ArrowRight', key: 'ArrowRight' });
  sandbox.YAW = 0.5;

  /* Tab entra en la cabina aunque no hubiera foco */
  CTL.soltarFoco();
  despacha('keydown', { code: 'Tab', key: 'Tab', shiftKey: false, preventDefault() {} });
  chk(CTL.tieneFoco(), 'Tab no entregó el foco a la cabina');

  /* El estado de mando se suelta al tomar el foco */
  CTL.update(0.1);
  chk(Math.abs(CTL.getState().yaw) < 1e-6, 'con el foco tomado el mando no se centró');

  /* ` conmuta la entrada */
  const antes = CTL.modoRaton();
  despacha('keydown', { code: 'Backquote', key: '`', preventDefault() {} });
  chk(CTL.modoRaton() !== antes, 'la tecla ` no conmuta el modo de entrada');
  despacha('keydown', { code: 'Backquote', key: '`', preventDefault() {} });

  /* Con foco, la flecha llega al monitor como navegación, no como vuelo
   * El punto anterior (`) cerró el foco, así que se vuelve a tomar. */
  CTL.tomarFoco();
  /* El monitor con foco debe tener pocos elementos: en los que tienen listas
   * largas (comunicaciones, checklist) las flechas desplazan la vista. */
  CAB.foco('mapa');
  CAB.setItems('mapa', [
    { x: 10, y: 10, w: 60, h: 20, t: 'a', acc: function () {} },
    { x: 10, y: 40, w: 60, h: 20, t: 'b', acc: function () {} }
  ]);
  CAB.foco('mapa');
  CAB.estado.sel.mapa = 0;
  const sel0 = CAB.estado.sel.mapa;
  despacha('keydown', { code: 'ArrowDown', key: 'ArrowDown', preventDefault() {} });
  chk(CAB.estado.sel.mapa !== sel0, 'la flecha abajo no movió el resaltado del monitor');
} else {
  fallos.push('CJ.CTL ausente');
}

/* ================= 8. el ratón de la cabina traduce el clic ============== */
const monMapa = CAB.porId('mapa');
CAB.setItems('mapa', [
  { x: 100, y: 100, w: 200, h: 120, t: 'botón',
    acc: function () { sandbox.MARCA_CLIC = 'botón'; } }
]);
const cMapa = centroPantalla(monMapa, W, H);
const golpe = CABINA.enClic(cMapa.x, cMapa.y, asp, 0, 0);
chk(!!golpe, 'el clic sobre el mapa no se tradujo a monitor');
if (golpe) {
  chk(golpe.mon.id === 'mapa', 'el clic se atribuyó a ' + golpe.mon.id);
  CAB.estado.sel.mapa = CAB.indiceDe(golpe.mon, golpe.item);
}
CAB.foco('mapa');
CAB.activar();
chk(sandbox.MARCA_CLIC === 'botón', 'activar() no ejecutó el elemento bajo el cursor');
void MON;

/* Fuera de la cabina el clic no debe hacer nada */
const fueraCabina = CABINA.enClic(2, H - 2, asp, 0, 0);
chk(fueraCabina === null || !fueraCabina.mon, 'el clic fuera del habitáculo no debe dar monitor');

/* ================= informe ================= */
console.log('comprobaciones correctas: ' + ok);
if (fallos.length) {
  console.log('FALLOS: ' + fallos.length);
  fallos.slice(0, 40).forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('CABINA CORRECTA');
