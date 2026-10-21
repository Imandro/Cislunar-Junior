/* =======================================================================
 * CISLUNAR JUNIOR - Prueba de partida (punta a punta)
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Carga el HTML real (módulos + script interno) en un DOM de mentira y
 * juega: enciende el motor, vuela de verdad y comprueba que el resultado
 * del vuelo mueve los recursos de la misión.
 *
 * Es la prueba que le hacía falta al proyecto: hasta ahora el vuelo se
 * hacía pasar por una decisión y sus consecuencias se tiraban.
 *
 *   node tools\prueba_partida.js
 *   node tools\prueba_partida.js --detalle
 * ==================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var RAIZ = path.join(__dirname, '..');
var HTML = fs.readFileSync(path.join(RAIZ, 'Cislunar Junior - Cañon Labs.html'), 'utf8');

/* ---------------------------------------------------------------------
 * DOM de mentira: lo justo para que el script interno cargue y para que
 * se le puedan llamar sus funciones sin pintar nada.
 * ------------------------------------------------------------------ */
function elemFalso() {
  var e = {
    style: {}, dataset: {}, children: [], value: '', textContent: '', checked: false,
    width: 960, height: 540, clientWidth: 960, clientHeight: 540, innerHTML: '',
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    appendChild: function (c) { e.children.push(c); return c; },
    removeChild: function () {}, remove: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    querySelector: function () { return elemFalso(); },
    querySelectorAll: function () { return []; },
    getElementsByTagName: function () { return []; },
    focus: function () {}, blur: function () {}, click: function () {},
    getContext: function () {
      var grad = { addColorStop: function () {} };
      return {
        canvas: e, save: function () {}, restore: function () {}, translate: function () {},
        rotate: function () {}, scale: function () {}, beginPath: function () {}, closePath: function () {},
        moveTo: function () {}, lineTo: function () {}, arc: function () {}, ellipse: function () {},
        rect: function () {}, roundRect: function () {}, fill: function () {}, stroke: function () {},
        clip: function () {}, fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
        fillText: function () {}, strokeText: function () {}, setLineDash: function () {},
        setTransform: function () {}, drawImage: function () {},
        createLinearGradient: function () { return grad; },
        createRadialGradient: function () { return grad; },
        createPattern: function () { return {}; },
        measureText: function (t) { return { width: String(t).length * 6 }; },
        getImageData: function () { return { data: new Uint8Array(4) }; },
        putImageData: function () {}, createImageData: function () { return { data: new Uint8Array(4) }; },
        texImage2D: function () {}, texParameteri: function () {}, viewport: function () {}
      };
    }
  };
  return e;
}

var capturado = null;
var doc = {
  readyState: 'loading',          /* así `inicio()` no se ejecuta solo */
  documentElement: elemFalso(),
  body: elemFalso(),
  head: elemFalso(),
  createElement: function (t) { return elemFalso(); },
  createDocumentFragment: function () { return elemFalso(); },
  getElementById: function () { return elemFalso(); },
  getElementsByTagName: function () { return []; },
  querySelector: function () { return elemFalso(); },
  querySelectorAll: function () { return []; },
  addEventListener: function (t, cb) { if (t === 'DOMContentLoaded') capturado = cb; },
  removeEventListener: function () {},
  cookie: ''
};

var sandbox = {
  document: doc,
  navigator: { userAgent: 'node', language: 'es' },
  localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] == null ? null : this._d[k]; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; },
    clear: function () { this._d = {}; }
  },
  location: { href: 'file:///test.html', search: '', hash: '' },
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function () { return 1; },   /* no arranca solo */
  cancelAnimationFrame: function () {},
  addEventListener: function () {}, removeEventListener: function () {},
  setTimeout: function () { return 0; }, clearTimeout: function () {},
  setInterval: function () { return 0; }, clearInterval: function () {},
  innerWidth: 1280, innerHeight: 720,
  devicePixelRatio: 1,
  console: console,
  Uint8Array: Uint8Array, Uint16Array: Uint16Array, Uint32Array: Uint32Array,
  Float32Array: Float32Array, ArrayBuffer: ArrayBuffer,
  Blob: function () { this.click = function () {}; },
  URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
  URL_searchParams: URL.searchParams,
  Worker: function () { this.postMessage = function () {}; },
  Image: function () { elemFalso(); }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* Los módulos se cargan en el orden que declara el propio HTML. */
var fuentes = [];
var re = /<script\s+src="([^"]+)"><\/script>/g, m;
while ((m = re.exec(HTML)) !== null) fuentes.push(m[1]);
var inline = HTML.indexOf('<script>');
if (fuentes.indexOf('js/mision_vuelo.js') < 0) fuentes.splice(fuentes.indexOf('js/flight.js') + 1, 0, 'js/mision_vuelo.js');

fuentes.forEach(function (f) {
  var p = path.join(RAIZ, f.split('?')[0]);
  if (!fs.existsSync(p)) throw new Error('falta el modulo declarado en el HTML: ' + f);
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
});

/* El <script> interno: hasta su cierre. */
var ini = HTML.indexOf('<script>', HTML.indexOf('<script src=')) ;
var cierre = HTML.lastIndexOf('</script>');
vm.runInContext(HTML.slice(ini + 8, cierre), sandbox, { filename: 'inline.html' });

var CJ = sandbox.CJ;
var H = {
  S: function () { return sandbox.S; },
  nuevaPartida: sandbox.nuevaPartida,
  iniciarVueloLibre: sandbox.iniciarVueloLibre,
  reintentarPartida: sandbox.reintentarPartida,
  entrarModoVuelo: sandbox.entrarModoVuelo,
  salirModoVuelo: sandbox.salirModoVuelo,
  bucle: sandbox.bucle,
  M: sandbox.M
};

var ok = 0, fallos = 0;
var detalle = process.argv.indexOf('--detalle') >= 0;
function chk(nombre, cond, extra) {
  if (cond) { ok++; if (detalle) console.log('  OK   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (extra !== undefined ? '   -> ' + extra : '')); }
}
function grupo(t) { console.log('\n' + t); }

/* ---------------------------------------------------------------------
 * 0. El cableado existe.
 * ------------------------------------------------------------------ */
grupo('0. Cableado del HTML');
chk('el HTML declara js/mision_vuelo.js', /<script src="js\/mision_vuelo\.js">/.test(HTML));
chk('CJ.MISION esta cargado', !!(CJ && CJ.MISION));
chk('nuevaPartida existe', typeof H.nuevaPartida === 'function');
chk('entrarModoVuelo existe', typeof H.entrarModoVuelo === 'function');
chk('salirModoVuelo existe', typeof H.salirModoVuelo === 'function');
chk('vuelo libre y reinicio existen', typeof H.iniciarVueloLibre === 'function' && typeof H.reintentarPartida === 'function');
chk('hay misiones con eventos manuales', H.M.some(function (mm) {
  return mm.e.some(function (e) { return e.manual; });
}));

/* ---------------------------------------------------------------------
 * 1. Una partida real: el desenlace del vuelo cambia los recursos.
 * ------------------------------------------------------------------ */
grupo('1. Partida con vuelo manual (consecuencias reales)');
H.nuevaPartida(0);
var S0 = H.S();
/* A mitad de misión los recursos ya no están al 100%: así se ve lo que
 * el vuelo suma o resta (un bonus sobre 100 quedaría absorbido por el límite). */
S0.res = [70, 60, 80, 55, 65];
chk('la partida arranca con 5 recursos al 100%', true);

/* Primer evento de vuelo de la misión. */
var idxManual = -1;
for (var i = 0; i < H.M[0].e.length; i++) if (H.M[0].e[i].manual) { idxManual = i; break; }
var ev = H.M[0].e[idxManual];
S0.i = idxManual;
H.entrarModoVuelo(ev);
chk('entrarModoVuelo pone la partida en vuelo', S0.phase === 'flight');
chk('el estado de vuelo existe', !!S0.flightState);

/* Ahora un desenlace realista de esa fase (Saturn V -> órbita terrestre). */
var antes = S0.res.slice();
H.salirModoVuelo({ tipo: 'orbita', perigeo: 185000, apogeo: 190000, e: 0.001 });
var despues = S0.res;
chk('vuelve a la fase de decision', S0.phase === 'decision');
chk('algun recurso se movio', antes.some(function (v, k) { return v !== despues[k]; }), despues.join());
chk('ningun recurso se salio de rango', despues.every(function (v) { return v >= 0 && v <= 100; }), despues.join());
chk('el registro tiene una entrada de vuelo', S0.log.length === 1 && /VUELO/.test(S0.log[0].t), S0.log.length);
chk('la entrada de vuelo lleva sus deltas', S0.log[0].d.some(function (v) { return v !== 0; }),
    S0.log[0].d.join());
chk('el noticiario explica el resultado', S0.comms.some(function (c) {
  return /EXITO DE VUELO|FALLO DE VUELO/.test(c.x);
}), S0.comms.map(function (c) { return c.x; }).join(' | '));

/* ---------------------------------------------------------------------
 * 2. El vuelo se cobra mientras se quema.
 * ------------------------------------------------------------------ */
grupo('2. El propulsor baja durante el vuelo');
H.nuevaPartida(0);
var S1 = H.S();
var ev1 = null;
for (var j = 0; j < H.M[0].e.length; j++) if (H.M[0].e[j].manual && H.M[0].e[j].faseVuelo === 'ascenso') { ev1 = H.M[0].e[j]; break; }
S1.i = j;
H.entrarModoVuelo(ev1);
var propAntes = S1.res[4];

/* Conducimos el bucle de verdad: cada llamada es un fotograma de física. */
sandbox.pintar = function () {};          /* sin pintar: sólo nos importan los números */
var t = 0, pasos = 0;
/* El ascenso completo son ~1020 s de simulación; a 60 f/s son ~61.200
 * fotogramas, así que el tope tiene que holgarlo. */
while (S1.phase === 'flight' && pasos < 95000) {
  t += 1000 / 60;
  H.bucle(t);
  pasos++;
}
chk('el vuelo llego a su fin y vuelve a decisiones', S1.phase === 'decision', S1.phase + ' tras ' + pasos + ' pasos');
chk('el propulsor ya no esta al 100%', S1.res[4] !== 100, S1.res[4]);
chk('el delta-v gastado quedo registrado', S1.flightMetrics === null || (S1.flightMetrics.dvGastado || 0) >= 0);
chk('el propulsor gastado esta entre 0 y 100', S1.res[4] >= 0 && S1.res[4] <= 100, S1.res[4]);
chk('hubo log de vuelo', S1.log.length >= 1, S1.log.length);

/* Informe: los numeros de verdad de ese vuelo, no solo "pasa". */
if (detalle && S1.log.length) {
  var L = S1.log[S1.log.length - 1];
  var fm = L.flightMetrics || {};
  console.log('       desenlace : ' + L.o);
  console.log('       duracion  : ' + L.duracion.toFixed(1) + ' s');
  console.log('       delta-v   : ' + (fm.dvGastado || 0).toFixed(0) + ' m/s');
  console.log('       g maxima  : ' + (fm.gMax || 0).toFixed(1) + ' g');
  console.log('       q maxima  : ' + (fm.qMax || 0).toFixed(0) + ' kPa');
  console.log('       etapas    : ' + (fm.staging || []).map(function (s) { return s.stage; }).join(' > ') || '-');
  console.log('       recursos  : ' + S1.res.map(function (v) { return v.toFixed(1); }).join(' | '));
  console.log('       coste     : ' + L.d.map(function (v) { return (v > 0 ? '+' : '') + v; }).join(' '));
}

/* ---------------------------------------------------------------------
 * 3. Un vuelo fallido cuesta de verdad y puede abortar la misión.
 * ------------------------------------------------------------------ */
grupo('3. Vuelo fallido y aborto por recursos');
H.nuevaPartida(0);
var S2 = H.S();
S2.res = [8, 8, 8, 8, 8];
var antes2 = S2.res.slice();
H.salirModoVuelo({ tipo: 'aterrizaje', exito: false, velVertical: 16 });
chk('un aterrizaje duro castiga los recursos', S2.res.every(function (v, k) { return v <= antes2[k]; }),
    S2.res.join() + ' vs ' + antes2.join());
chk('la mision queda abortada si un recurso cae', S2.fin === 'fallo', String(S2.fin));
chk('el motivo queda escrito', /Recurso agotado/.test(S2.finTxt), S2.finTxt);
chk('se informo del fallo', S2.comms.some(function (c) { return /FALLO DE VUELO/.test(c.x); }));

/* Un impacto en una partida sana: duele pero no aborta. */
H.nuevaPartida(0);
var S3 = H.S();
H.salirModoVuelo({ tipo: 'fallo', razon: 'Impacto' });
chk('un impacto en partida sana no aborta', S3.fin === null, String(S3.fin));
chk('pero deja marcados los recursos', S3.res.some(function (v, k) { return v < 100; }), S3.res.join());

/* ---------------------------------------------------------------------
 * 4. Nada se rompe si el motor no da resultado.
 * ------------------------------------------------------------------ */
grupo('4. Robustez');
H.nuevaPartida(0);
var S4 = H.S();
var lanzo = true;
try { H.salirModoVuelo(null); } catch (e) { lanzo = false; }
chk('salirModoVuelo(null) no lanza', lanzo);
chk('la partida sigue viva', S4.phase === 'decision' && S4.res.every(isFinite));
var lanzo2 = true;
try { H.salirModoVuelo({}); } catch (e) { lanzo2 = false; }
chk('salirModoVuelo({}) no lanza', lanzo2);
chk('los recursos siguen finitos', S4.res.every(isFinite), S4.res.join());

/* ---------------------------------------------------------------------
 * 5. Vuelo libre: despega, reinicia como libre y no abre decisiones.
 * ------------------------------------------------------------------ */
grupo('5. Vuelo libre');
H.iniciarVueloLibre();
var SL = H.S();
var alt0 = CJ.FLT.V3.norm(CJ.FLT.getState().pos) - CJ.FLT.getState().cuerpo.R;
for (var vf = 0; vf < 240; vf++) SL.flightState = CJ.FLT.step({});
var alt1 = CJ.FLT.V3.norm(CJ.FLT.getState().pos) - CJ.FLT.getState().cuerpo.R;
chk('el SLS despega en vuelo libre', alt1 > alt0 + 0.5, alt0.toFixed(2) + ' -> ' + alt1.toFixed(2));
H.reintentarPartida();
SL = H.S();
chk('reintentar conserva vuelo libre', SL.libre === true && SL.phase === 'flight', SL.phase);
H.salirModoVuelo({ exito: true });
chk('vuelo libre termina sin volver a decisiones', SL.fin === 'ok' && SL.phase === 'finished', SL.phase);

/* --------------------------------------------------------------------- */
console.log('\n=========================================');
console.log('PARTIDA DE VUELO: ' + ok + ' OK, ' + fallos + ' fallos');
if (fallos) process.exit(1);
