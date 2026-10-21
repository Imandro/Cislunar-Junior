/* Arnés de prueba de Cislunar Junior: ejecuta los módulos y el script
 * principal del HTML en un contexto con DOM simulado, y recorre misiones,
 * vistas, pestañas, laboratorio y modales.
 *
 * Uso:  node tools/prueba_simulador.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const PROY = path.resolve(__dirname, '..');
const fallos = [];
let ok = 0;
function chk(cond, msg) { if (cond) { ok++; } else { fallos.push(msg); } }

/* ------------------------- DOM simulado ------------------------- */
function ctx2d() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 20 });
      if (k === 'canvas') return { width: 960, height: 340 };
      if (k in t) return t[k];
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/* Registro de nodos por id. Como el DOM simulado no parsea el HTML, el
 * conjunto de ids se registra al asignar innerHTML y al añadir nodos con
 * appendChild, que es como el juego construye su interfaz. */
const porId = {};
function registrar(n) {
  if (!n) return;
  if (n.id) porId[n.id] = n;
  (n.children || []).forEach(registrar);
}

function nodo(tag) {
  const n = {
    tagName: (tag || 'div').toUpperCase(),
    id: '',
    _html: '',
    children: [],
    style: {},
    dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    clientWidth: 960, clientHeight: 340, width: 960, height: 340,
    parentNode: null,
    textContent: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      this.children = [nodo('div')];
      const ids = this._html.match(/id="[^"]+"/g) || [];
      ids.forEach(m => {
        const id = m.slice(4, -1);
        if (!porId[id]) porId[id] = nodo('div');   // nunca se pisan los reales
      });
    },
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); registrar(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
    querySelector() { return nodo('span'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {}, removeAttribute() {},
    getContext() { return ctx2d(); },
    setPointerCapture() {},
    closest() { return null; },
    focus() {}
  };
  return n;
}

/* #app es el único elemento que ya existe en el documento real */
porId.app = nodo('div');
porId.app.id = 'app';

const docHnd = {};                     // manejadores registrados por tipo de evento
const doc = {
  readyState: 'complete',
  documentElement: nodo('html'),
  head: nodo('head'),
  body: nodo('body'),
  activeElement: null,
  getElementById(id) { return porId[id] || nodo('div'); },   // no se cachean ausencias
  createElement(t) { return nodo(t); },
  addEventListener(tipo, fn) { (docHnd[tipo] = docHnd[tipo] || []).push(fn); },
  querySelector() { return null; }
};
/** Despacha un evento sintético a todos los manejadores registrados. */
function despacha(tipo, ev) { (docHnd[tipo] || []).forEach(f => f(ev)); }

const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean,
  Float32Array, Uint16Array, Uint32Array, isNaN, isFinite, parseInt, parseFloat,
  Error, TypeError, RegExp, Promise,
  document: doc,
  location: { hash: '', href: '' },
  navigator: { userAgent: 'arnes' },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: (f) => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

/* ------------------------- aleatoriedad reproducible -------------------------
 * `ap()` tira los dados de los incidentes imprevistos con Math.random. Con el
 * generador real cada partida terminaba en un punto distinto, así que el
 * número de comprobaciones variaba de una ejecución a la otra y cualquier
 * regresión se escondía en ese ruido. Se sustituye por un PRNG con semilla
 * fija ANTES de cargar nada: mismas tiradas en cada ejecución.
 */
const SEMILLA = 0x5EEDCAFE;
let semilla = SEMILLA >>> 0;
vm.runInContext(
  'Math.random = function () {' +
  '  semilla = (semilla * 1664525 + 1013904223) >>> 0;' +
  '  return semilla / 4294967296;' +
  '};', sandbox);
sandbox.semilla = semilla;
function fijarSemilla() { vm.runInContext('semilla = ' + (SEMILLA >>> 0) + ';', sandbox); }
fijarSemilla();

function ejecutar(file) {
  const src = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(src, sandbox, { filename: file });
  } catch (e) {
    fallos.push('EJECUCIÓN ' + path.basename(file) + ': ' + e.message);
  }
}

/* ------------------------- carga de módulos ------------------------- */
['js/orbital.js', 'js/glcore.js', 'js/vehiculo.js', 'js/iconos.js',
 'js/creditos.js', 'js/arranque.js', 'js/laboratorio.js', 'js/cabina.js',
 'js/controls.js', 'js/flight.js', 'js/hud_flight.js', 'js/stages.js', 'js/academia.js'
].forEach(f => ejecutar(path.join(PROY, f)));

const CJ = sandbox.CJ || {};
chk(!!CJ.ORB, 'CJ.ORB ausente');
chk(!!CJ.GL, 'CJ.GL ausente');
chk(!!CJ.VHL, 'CJ.VHL ausente');
chk(!!CJ.ICO, 'CJ.ICO ausente');
chk(!!CJ.CREDITOS, 'CJ.CREDITOS ausente');
chk(!!CJ.BOOT, 'CJ.BOOT ausente');
chk(!!CJ.LAB, 'CJ.LAB ausente');
chk(!!CJ.CAB && typeof CJ.CAB.html === 'function' && typeof CJ.CAB.reticula === 'function',
    'CJ.CAB no expone html/actualizar/reticula');

/* el arranque se resuelve de inmediato en pruebas */
CJ.BOOT.cargar = function (tarea) { if (typeof tarea === 'function') tarea(); return Promise.resolve(); };

/* script principal del HTML */
const html = fs.readFileSync(path.join(PROY, 'Cislunar Junior - Cañon Labs.html'), 'utf8');
// Get the last script tag (the inline script), not the first (empty module scripts)
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
try {
  vm.runInContext(inline, sandbox, { filename: 'inline.js' });
} catch (e) {
  fallos.push('EJECUCIÓN script principal: ' + e.message);
}

/* ------------------------- guion de las misiones ------------------------- */
/* Con --guion se imprime el desarrollo completo de cada expedición en vez de
 * ejecutar las comprobaciones. Sirve para revisar el contenido de una pasada. */
if (process.argv.includes('--guion')) {
  const PH = sandbox.PH;
  const NM = sandbox.NM;
  for (let m = 0; m < 4; m++) {
    const mis = sandbox.M[m];
    console.log('\n════════ ' + mis.n + '  ·  ' + mis.f + '  ·  ' + mis.d + '  ·  ' + mis.v);
    console.log('   ' + mis.x);
    console.log('   Tripulación: ' + mis.r.map(r => r[0] + ' (' + r[1] + ')').join(' · '));
    sandbox.nuevaPartida(m);
    let n = 0;
    while (!sandbox.S.fin && n < 30) {
      const ev = sandbox.M[m].e[sandbox.S.i];
      console.log('\n[' + ev.t + ']  ' + PH[ev.p] + '  —  ' + ev.c[0] + ': ' + ev.c[1]);
      if (ev.w) console.log('   >>> ' + ev.w[0] + ': ' + ev.w[1]);
      ev.o.forEach((o, i) => {
        const d = o[1].map((v, j) => v ? (v > 0 ? '+' : '') + v + ' ' + NM[j] : null)
                       .filter(Boolean).join(', ') || 'sin cambios';
        console.log('   ' + (i + 1) + ') ' + o[0] + '   [' + d + ']   riesgo ' + o[2] + '%');
        console.log('        ' + o[3]);
      });
      sandbox.ap(0);
      console.log('   → recursos: ' + sandbox.S.res.map(v => Math.round(v)).join(' / '));
      n++;
    }
    console.log('\n   DESDENLACE: ' + (sandbox.S.fin === 'ok' ? 'MISIÓN CUMPLIDA' : 'MISIÓN ABORTADA') +
                ' — ' + sandbox.S.finTxt);
    console.log('   ' + sandbox.S.dec + ' decisiones · ' + sandbox.S.inc + ' incidentes imprevistos');
  }
  process.exit(0);
}

/* ------------------------- pruebas ------------------------- */
const app = () => (porId.app ? porId.app.innerHTML : '');
const modal = () => doc.getElementById('modal').innerHTML;
const tutorial = () => doc.getElementById('tutorialOverlay').innerHTML;
chk(/mcard/.test(app()), 'la pantalla de selección no se dibujó');
chk((app().match(/class="mcard"/g) || []).length === 4, 'debería haber 4 tarjetas de misión');
['Apolo 11', 'Apolo 13', 'Artemis II', 'Marte'].forEach(n =>
  chk(app().includes(n), 'falta la misión ' + n + ' en la selección'));

/* Encuadre: cada modelo debe proyectarse dentro del visor, ni fuera de pantalla
 * ni diminuto. Usa la misma matemática que el renderizador de respaldo. */
function encuadrar(ft, polys, W, H) {
  const dist = ft[1] * 2.4, fov = 2 * Math.atan(1 / (4.128 * 1));
  const k = (H * 0.43) / (dist * Math.tan(fov / 2));
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of polys) for (const v of p.v) {
    const y0 = v[1] - ft[0], w = dist / (dist + v[2]);
    const X = W / 2 + v[0] * k * w, Y = H / 2 - y0 * k * w;
    if (X < minx) minx = X; if (X > maxx) maxx = X;
    if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
  }
  return { minx, maxx, miny, maxy };
}
function compruebaEncuadre(nombre, ft, polys) {
  const W = 960, H = 340;
  const b = encuadrar(ft, polys, W, H);
  const alto = b.maxy - b.miny, ancho = b.maxx - b.minx;
  const cY = (b.miny + b.maxy) / 2, cX = (b.minx + b.maxx) / 2;
  chk(alto > H * 0.25, nombre + ': el modelo queda demasiado pequeño (alto ' + Math.round(alto) + 'px)');
  chk(alto < H * 1.35, nombre + ': el modelo desborda el visor por arriba/abajo (alto ' + Math.round(alto) + 'px)');
  chk(ancho < W * 1.25, nombre + ': el modelo desborda el visor por los lados (ancho ' + Math.round(ancho) + 'px)');
  chk(cY > -H * 0.3 && cY < H * 1.3, nombre + ': el modelo sale del encuadre en vertical');
  chk(cX > -W * 0.3 && cX < W * 1.3, nombre + ': el modelo sale del encuadre en horizontal');
}

/* Geometría de todos los modelos y combinaciones de piezas */
const SETS = {
  SA: ['pad', 's1', 's2', 's3', 'csm', 'esc', 'lm', 'dock'],
  SL: ['pad', 'core', 'b1', 'b2', 'ics', 'orion'],
  AP: ['ds', 'as', 'flag', 'cm'],
  OR: ['sm', 'cm', 'panels', 'esc'],
  DS: ['pad', 'hab', 'node', 'serv', 'caps', 'panels', 'aero', 'chute', 'legs']
};
Object.keys(SETS).forEach(s => {
  const t = new Set(SETS[s]);
  const g = CJ.GL ? null : null;
  const polys = sandbox.MD2.polys(s, t);
  chk(Array.isArray(polys) && polys.length > 40, 'modelo ' + s + ': pocos polígonos (' + (polys || []).length + ')');
  let bad = 0;
  (polys || []).forEach(p => {
    if (!p.v || p.v.length < 3 || !p.c) bad++;
    else p.v.forEach(v => { if (!isFinite(v[0]) || !isFinite(v[1]) || !isFinite(v[2])) bad++; });
  });
  chk(bad === 0, 'modelo ' + s + ': ' + bad + ' polígonos inválidos');
});

/* Recorrido completo de las cuatro misiones */
const NRES = sandbox.NM;
for (let m = 0; m < 4; m++) {
  sandbox.MODO = 'sel';
  sandbox.nuevaPartida(m);
  const nom = sandbox.M[m].n;

  chk(app().includes('visor'), nom + ': falta el visor');
  chk(app().includes('Decisión'), nom + ': falta la consola');
  chk(app().includes('cabinHost') || app().includes('cabHost'), nom + ': falta el panel de cabina');
  chk(app().includes(nom), nom + ': no aparece el nombre en la partida');

  /* las cuatro vistas deben dibujarse sin error */
  for (let v = 0; v < 3; v++) {
    sandbox.VM = v;
    try { sandbox.pintar(); ok++; } catch (e) { fallos.push(nom + ': pintar() vista ' + v + ' → ' + e.message); }
  }
  sandbox.VM = 0;

  /* las cuatro pestañas */
  for (let t = 0; t < 4; t++) {
    sandbox.S.tab = t;
    try { sandbox.GR(); ok++; } catch (e) { fallos.push(nom + ': GR() pestaña ' + t + ' → ' + e.message); }
  }
  sandbox.S.tab = 0;

  /* cada evento debe encuadrar un modelo con piezas y un encaje finito,
     tanto al principio como al final de su animación */
  for (let i = 0; i < sandbox.M[m].e.length; i++) {
    for (const av of [0, 0.5, 1]) {
      sandbox.S.i = i; sandbox.ANIM = av;
      const et = ' ev' + i + ' ANIM=' + av;
      let inf;
      try { inf = sandbox.escena3D(); } catch (e) { fallos.push(nom + et + ': escena3D → ' + e.message); continue; }
      chk(isFinite(inf.ft[0]) && isFinite(inf.ft[1]) && inf.ft[1] > 0,
          nom + et + ': encuadre inválido ' + JSON.stringify(inf.ft));
      const g = sandbox.MD2.polys(inf.set, inf.t);
      chk(g.length > 10, nom + et + ': modelo ' + inf.set + ' con solo ' + g.length + ' polígonos');
      chk(typeof inf.nom === 'string' && inf.nom.length > 0, nom + et + ': sin nombre de vehículo');
      compruebaEncuadre(nom + et + ' [' + inf.set + ']', inf.ft, g);
    }
  }

  /* jugar la misión entera eligiendo siempre la primera opción */
  sandbox.nuevaPartida(m);
  let pasos = 0;
  while (!sandbox.S.fin && pasos < 40) {
    const antes = sandbox.S.i;
    sandbox.ap(0);
    pasos++;
    chk(sandbox.S.i !== antes || sandbox.S.fin, nom + ': la partida no avanza en el paso ' + pasos);
    for (let r = 0; r < 5; r++) {
      chk(sandbox.S.res[r] >= 0 && sandbox.S.res[r] <= 100,
          nom + ': recurso ' + NRES[r] + ' fuera de rango (' + sandbox.S.res[r] + ')');
    }
  }
  chk(!!sandbox.S.fin, nom + ': la misión no termina en 40 pasos');
  chk(sandbox.S.dec > 0, nom + ': no se registraron decisiones');
  chk(app().includes('Misión cumplida') || app().includes('Misión abortada'),
      nom + ': no se muestra el desenlace');

  /* elección arriesgada: segunda opción en todos los eventos */
  sandbox.nuevaPartida(m);
  let p2 = 0;
  while (!sandbox.S.fin && p2 < 40) { sandbox.ap(1); p2++; }
  chk(!!sandbox.S.fin, nom + ': la misión con elecciones arriesgadas no termina');
}

/* La plataforma queda fija mientras el vehículo asciende y las piezas se
 * separan; la misión marciana comienza en órbita terrestre. */
for (let m = 0; m < 3; m++) {
  sandbox.nuevaPartida(m);
  sandbox.ANIM = 0;
  let escena = sandbox.escena3D();
  chk(escena.lanzamiento && escena.terreno === 'tierra' && escena.ascenso === 0,
      'misión ' + m + ': la preparación no muestra la plataforma terrestre');
  sandbox.S.i = sandbox.M[m].e.findIndex(e => e.p === 1);
  sandbox.ANIM = 0.8;
  escena = sandbox.escena3D();
  const geo = [];
  sandbox.agregarVehiculoExterior(geo, escena, true);
  chk(escena.ascenso > 100 && geo.some(g => g.clave.startsWith('pad-') && !g.off) &&
      geo.some(g => g.clave.startsWith('v-') && g.off && g.off[1] === escena.ascenso),
      'misión ' + m + ': el cohete no se aleja de una plataforma fija');
  chk(escena.separadas.length > 0, 'misión ' + m + ': no se ven las etapas separadas');
}
sandbox.nuevaPartida(3);
chk(!sandbox.escena3D().lanzamiento && sandbox.escena3D().planeta === 'tierra' &&
    sandbox.escena3D().terreno === null,
    'Marte debe comenzar en órbita terrestre, sin plataforma ficticia');

/* fallo forzado: consumir todos los recursos */
sandbox.nuevaPartida(0);
sandbox.S.res = [1, 1, 1, 1, 1];
sandbox.ap(1);
chk(sandbox.S.fin === 'fallo', 'no se detecta el fallo por recurso agotado' +
    ' [fin=' + JSON.stringify(sandbox.S.fin) +
    ' res=' + JSON.stringify(sandbox.S.res) +
    ' i=' + sandbox.S.i +
    ' d=' + JSON.stringify(sandbox.M[0].e[sandbox.S.i].o[1][1]) +
    ' D=' + JSON.stringify(sandbox.D) + ']');
chk(/Recurso agotado/.test(sandbox.S.finTxt), 'el texto de fallo no indica el recurso' +
    ' [finTxt=' + JSON.stringify(sandbox.S.finTxt) + ']');

/* Un incidente tiene que castigar: INC ya guarda los castigos negativos y se
 * suma. Restándolo, las opciones arriesgadas salían gratis y además encubrían
 * el fallo por recurso agotado (solo se notaba con la tirada de 2 %). */
vm.runInContext('__r0 = Math.random; Math.random = function () { return 0; };', sandbox);
sandbox.nuevaPartida(0);
sandbox.ap(0);                                    // riesgo 10 % → incidente seguro
vm.runInContext('Math.random = __r0;', sandbox);
chk(sandbox.S.inc === 1, 'el incidente forzado no se registra (inc=' + sandbox.S.inc + ')');
chk(sandbox.S.res[4] <= 95, 'el incidente no castiga el recurso Consumo (res=' +
    JSON.stringify(sandbox.S.res) + ')');
chk(sandbox.S.res.every(function (v) { return v < 100; }),
    'el incidente se aplicó con el signo equivocado y subió recursos (' +
    JSON.stringify(sandbox.S.res) + ')');

/* vistas de cada misión en modo 3D con distintos encuadres */
sandbox.nuevaPartida(3);
for (let i = 0; i < sandbox.M[3].e.length; i++) {
  sandbox.S.i = i;
  for (const a of [0, 0.5, 1]) {
    sandbox.ANIM = a;
    try { sandbox.pintar(); ok++; } catch (e) { fallos.push('Marte ev' + i + ' ANIM=' + a + ': ' + e.message); }
  }
}

/* el visor debe sobrevivir a los re-renders para conservar el contexto WebGL */
sandbox.nuevaPartida(0);
const cvGL1 = sandbox.NODVIS && sandbox.NODVIS.children[0];
sandbox.GR(); sandbox.VM = 1; sandbox.GR(); sandbox.VM = 0; sandbox.GR();
const cvGL2 = sandbox.NODVIS && sandbox.NODVIS.children[0];
chk(!!cvGL1 && cvGL1 === cvGL2,
    'el canvas WebGL se recrea en cada render: se perdería el contexto de R3D');

/* teclado: las tarjetas se pueden arrancar con Enter y las vistas con 1/2/3 */
const tarj = nodo('div');
tarj.classList.add('mcard'); tarj.dataset.m = '3';
doc.activeElement = tarj;
despacha('keydown', { key: 'Enter', preventDefault() {} });
chk(!!sandbox.S && sandbox.S.m === 3, 'Enter sobre una tarjeta no arrancó la misión de Marte');
tarj.dataset.m = '2';
despacha('keydown', { key: ' ', preventDefault() {} });
chk(!!sandbox.S && sandbox.S.m === 2, 'Espacio sobre una tarjeta no arrancó Artemis II');
despacha('keydown', { key: '2', preventDefault() {} });
chk(sandbox.VM === 1, 'la tecla 2 no cambia a la vista Escena');
despacha('keydown', { key: '3', preventDefault() {} });
chk(sandbox.VM === 2, 'la tecla 3 no cambia a la vista Trayectoria');
despacha('keydown', { key: '1', preventDefault() {} });
chk(sandbox.VM === 0, 'la tecla 1 no vuelve al vehículo 3D');
const yaw0 = sandbox.YAW;
despacha('keydown', { key: 'ArrowLeft', preventDefault() {} });
chk(sandbox.YAW !== yaw0, 'las flechas no rotan el vehículo 3D');
const zm0 = sandbox.ZM;
despacha('keydown', { key: '+', preventDefault() {} });
chk(sandbox.ZM === zm0, 'la tecla + acerca el visor dentro de cabina');
sandbox.VISTA_EXTERIOR = true;
despacha('keydown', { key: '+', preventDefault() {} });
chk(sandbox.ZM > zm0, 'la tecla + no acerca el visor en Exterior');
sandbox.VISTA_EXTERIOR = false;
doc.activeElement = null;

/* estructura del HTML generado en pantalla de selección */
sandbox.mostrarSel();
const sh = app();
['class="selgrid"', 'class="mcard"', 'class="mimg"', 'Laboratorio de cohetes',
 'Ajustes', 'Créditos', 'Cómo se juega', 'NASA Space Apps'].forEach(t =>
  chk(sh.includes(t), 'la selección no incluye «' + t + '»'));
chk((sh.match(/class="mcard"/g) || []).length === 4, 'la selección no muestra 4 misiones');
chk((sh.match(/role="button"/g) || []).length === 4, 'las tarjetas no tienen role="button"');
chk((sh.match(/tabindex="0"/g) || []).length === 4, 'las tarjetas no son navegables con Tab');
chk(/assets\/apolo11\.jpg/.test(sh) && /assets\/marte\.jpg/.test(sh),
    'la selección no referencia las fotografías de NASA');

/* estructura del HTML generado durante la partida */
sandbox.nuevaPartida(2);
const gh = app();
['class="fases"', 'class="reschips"', 'id="visorSlot"', 'id="cabHost"', 'class="timeline"',
 'class="cons"', 'class="tabs"', 'class="pane"',
 'Laboratorio', 'Ajustes', 'Menú', 'NASA'].forEach(t =>
  chk(gh.includes(t), 'la consola no incluye «' + t + '»'));
/* los botones de vista están en el visor persistente */
const vb = doc.getElementById('vbtns').innerHTML;
['data-v="0"', 'data-v="1"', 'data-v="2"', 'Vehículo 3D', 'Escena', 'Trayectoria'].forEach(t =>
  chk(vb.includes(t), 'los controles de vista no incluyen «' + t + '»'));
chk(/Saturn|SLS|Orion|Marte|Módulo/.test(doc.getElementById('vtag').textContent),
    'la etiqueta del visor no identifica el vehículo');
chk((gh.match(/class="tab/g) || []).length >= 4, 'faltan pestañas en la consola');
chk((gh.match(/class="rc[ "]/g) || []).length >= 5, 'faltan barras de recursos');
chk((gh.match(/class="tl /g) || []).length >= 5, 'faltan hitos en la línea de tiempo');
sandbox.S.tab = 1; sandbox.GR();
chk(/Soporte vital/.test(app()) && /Propelente/.test(app()), 'la pestaña Sistemas no lista los recursos');
sandbox.S.tab = 3; sandbox.GR();
chk(/Comandante|Piloto|Especialista/.test(app()), 'la pestaña Tripulación no lista a la tripulación');
sandbox.S.tab = 0; sandbox.GR();

/* las fases mostradas deben ser las que la expedición realmente usa */
for (let mi = 0; mi < 4; mi++) {
  sandbox.nuevaPartida(mi);
  const fasesUsadas = new Set(sandbox.M[mi].e.map(e => e.p));
  const chips = Array.from(app().matchAll(/class="fchip[^"]*">([^<]+)</g)).map(m => m[1]);
  chk(chips.length === fasesUsadas.size,
      sandbox.M[mi].n + ': se muestran ' + chips.length + ' fases y la expedición usa ' + fasesUsadas.size);
  chips.forEach(c => chk(fasesUsadas.has(sandbox.PH.indexOf(c)),
      sandbox.M[mi].n + ': la fase «' + c + '» no corresponde a ningún evento'));
}
sandbox.nuevaPartida(3);
chk(app().includes('>Llegada<'), 'Marte no muestra la fase Llegada');
chk(!/fchip[^>]*>Regreso</.test(app()), 'Marte muestra la fase Regreso, que no le corresponde');
sandbox.nuevaPartida(0);
chk(/fchip[^>]*>Regreso</.test(app()), 'Apolo 11 no muestra la fase Regreso');

/* los créditos deben citar los identificadores reales de NASA */
sandbox.abrirCreditos();
const ch = modal();
['as11-40-5927', 'S70-34902', 'PIA14838', 'KSC-20230602-PH-GEB01-0010',
 'images.nasa.gov', 'Dominio público (NASA)', 'NASA / JPL-Caltech'].forEach(t =>
  chk(ch.includes(t), 'los créditos no citan «' + t + '»'));
chk(ch.includes('mbox wide'), 'el modal de créditos no usa el ancho completo');
sandbox.cerrarModal();

/* laboratorio y modales */
try { sandbox.abrirLab(); ok++; chk(/Laboratorio de cohetes/.test(app()), 'el laboratorio no se dibuja'); }
catch (e) { fallos.push('abrirLab → ' + e.message); }
try { sandbox.abrirAjustes(); ok++; chk(/Ajustes/.test(modal()), 'el modal de ajustes no se dibuja'); }
catch (e) { fallos.push('abrirAjustes → ' + e.message); }
try { sandbox.abrirCreditos(); ok++; chk(/Créditos/.test(modal()), 'el modal de créditos no se dibuja'); }
catch (e) { fallos.push('abrirCreditos → ' + e.message); }
try { sandbox.cerrarModal(); ok++; } catch (e) { fallos.push('cerrarModal → ' + e.message); }
try {
  sandbox.abrirTutorial(0);
  chk(/Elige cómo quieres volar/.test(tutorial()), 'el tutorial no explica el inicio');
  sandbox.abrirTutorial(3);
  chk(/DU1 · Ruta/.test(tutorial()) && /F1/.test(tutorial()), 'el tutorial no explica los instrumentos');
  sandbox.abrirTutorial(5);
  chk(/Controles básicos de vuelo/.test(tutorial()) && /Shift/.test(tutorial()), 'el tutorial no explica el pilotaje');
  sandbox.cerrarTutorial(); ok++;
} catch (e) { fallos.push('tutorial → ' + e.message); }

/* enrutado de clics de la interfaz */
function btn(dataset) {
  const n = nodo('button');
  n.dataset = dataset;
  n.closest = function (sel) {
    for (const k in dataset) if (sel.indexOf('[data-' + k + ']') >= 0) return n;
    if (dataset.m != null && sel.indexOf('.mcard') >= 0) return n;
    return null;
  };
  return n;
}
function clic(dataset) {
  try { sandbox.onClickGlobal({ target: btn(dataset) }); ok++; }
  catch (e) { fallos.push('clic ' + JSON.stringify(dataset) + ' → ' + e.message); }
}

 sandbox.mostrarSel();
clic({ tutorial: 'open' });
chk(/Elige cómo quieres volar/.test(tutorial()), 'abrir tutorial por clic no funcionó');
clic({ tutorial: 'next' });
chk(sandbox.TUTORIAL_PASO === 1, 'Siguiente no avanzó el tutorial');
clic({ tutorial: 'prev' });
chk(sandbox.TUTORIAL_PASO === 0, 'Atrás no retrocedió el tutorial');
clic({ tutorial: 'close' });
clic({ m: '1' });
chk(sandbox.S && sandbox.S.m === 1, 'el clic en la tarjeta no arrancó Apolo 13');
clic({ v: '1' });
chk(sandbox.VM === 1, 'el cambio a la vista Escena no funcionó');
clic({ v: '2' });
chk(sandbox.VM === 2, 'el cambio a la vista Trayectoria no funcionó');
clic({ v: '0' });
chk(sandbox.VM === 0, 'el cambio a la vista Vehículo 3D no funcionó');
clic({ t: '2' });
chk(sandbox.S.tab === 2, 'el cambio de pestaña no funcionó');
clic({ t: '0' });
clic({ o: '1' });
chk(sandbox.S.elej === 1, 'la elección de opción no se registró');
const i0 = sandbox.S.i;
clic({ a: 'confirmar' });
chk(sandbox.S.i === i0 + 1 || !!sandbox.S.fin, 'confirmar no avanzó el evento');
clic({ a: 'asiento', i: '2' });
chk(sandbox.S.seat === 2, 'el cambio de asiento no funcionó');
clic({ a: 'ajustes' });
chk(/Ajustes/.test(modal()), 'abrir ajustes por clic no funcionó');
clic({ ax: 'tema', v: 'dark' });
chk(sandbox.AJ.tema === 'dark', 'el cambio de tema no se aplicó');
clic({ ax: 'tema', v: 'auto' });
clic({ ax: 'sonido', v: '0' });
chk(sandbox.AJ.sonido === 0, 'el ajuste de sonido no se aplicó');
clic({ ax: 'sonido', v: '1' });
clic({ ax: 'cerrar' });
clic({ a: 'menú' });
chk(/mcard/.test(app()), 'volver al menú por clic no funcionó');
clic({ a: 'lab' });
chk(/Laboratorio/.test(app()), 'abrir el laboratorio por clic no funcionó');
clic({ a: 'menú' });
chk(/mcard/.test(app()), 'no se volvió al menú desde el laboratorio');
clic({ a: 'creditos' });
chk(/Créditos/.test(modal()), 'abrir créditos por clic no funcionó');
clic({ ax: 'cerrar' });

/* panel de cabina */
try {
  const n = nodo('div');
  CJ.CAB.actualizar(n, { fase: 'Misión', met: 'Día 60', alt: 1234.5, vel: 3.21, dv: 480,
                         res: [80, 60, 40, 20, 5], alerta: 'ALERTA' });
  ok++;
} catch (e) { fallos.push('CAB.actualizar → ' + e.message); }
try {
  const X = ctx2d();
  CJ.CAB.reticula(X, 960, 340, { alt: 10, vel: 1, dv: 5, res: [1, 2, 3, 4, 5], alerta: 'X' });
  ok++;
} catch (e) { fallos.push('CAB.reticula → ' + e.message); }

/* selección y ajustes persisten */
try { sandbox.mostrarSel(); ok++; chk(/mcard/.test(app()), 'no se vuelve a la selección'); }
catch (e) { fallos.push('mostrarSel → ' + e.message); }

/* ------------------------- informe ------------------------- */
console.log('comprobaciones correctas: ' + ok);
if (fallos.length) {
  console.log('FALLOS: ' + fallos.length);
  fallos.slice(0, 40).forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('TODO CORRECTO');
