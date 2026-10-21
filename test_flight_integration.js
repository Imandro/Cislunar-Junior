/* Test de integración de vuelo manual - solo módulos de vuelo */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const PROY = path.resolve(__dirname, '.');
const fallos = [];
let ok = 0;
function chk(cond, msg) { if (cond) { ok++; console.log('✓', msg); } else { fallos.push(msg); console.log('✗', msg); } }

// Cargar módulos en contexto compartido
/* El HUD necesita poder preparar su lienzo 2D: `CJ.COCKPIT.superficie()` llama
 * a `document.createElement('canvas')` y devuelve el contexto ya limpio. Sin
 * ese doble los monitores no se pueden pintar para subirlos como textura. */
const lienzoPrueba = (w, h) => ({
  width: w, height: h,
  getContext: () => ctxPrueba(w, h),
  style: {}
});
function ctxPrueba(w, h) {
  const grad = { addColorStop() {} };
  return {
    canvas: { width: w, height: h },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    rect() {}, roundRect() {}, fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    setLineDash() {}, setTransform() {},
    createLinearGradient() { return grad; }, createRadialGradient() { return grad; },
    measureText(t) { return { width: String(t).length * 6 }; }
  };
}
/* `window` tiene que ser el propio contexto: los módulos comparten `CJ` a
 * través de `window.CJ`, así que si es un objeto aparte cada uno crea el suyo
 * y `CJ.HUD`, `CJ.CABINA` y compañía no se ven entre sí. */
const sandbox = { CJ: {}, document: {
  documentElement: {}, body: { appendChild() {}, classList: { add() {}, remove() {} } },
  createElement: (t) => (t === 'canvas' ? lienzoPrueba(640, 400) : {}),
  getElementById: () => null, addEventListener() {}, querySelector: () => null,
  readyState: 'complete', activeElement: null
}, navigator: {}, localStorage: {}, performance: { now: () => Date.now() }, requestAnimationFrame: (cb) => setTimeout(cb, 16), Math, Date, Array, Object, String, Number, Boolean, JSON, RegExp, Error, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['js/orbital.js', 'js/glcore.js', 'js/vehiculo.js', 'js/iconos.js',
 'js/creditos.js', 'js/arranque.js', 'js/laboratorio.js', 'js/cabina.js',
 'js/cockpit.js', 'js/cabina_enlace.js',
 'js/controls.js', 'js/flight.js', 'js/hud_flight.js', 'js/stages.js', 'js/academia.js'
].forEach(f => {
  const src = fs.readFileSync(path.join(PROY, f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
});

const CJ = sandbox.CJ || {};
chk(!!CJ.FLT, 'CJ.FLT cargado');
chk(!!CJ.FLT.init, 'CJ.FLT.init existe');
chk(!!CJ.FLT.VEHICULOS, 'CJ.FLT.VEHICULOS existe');

// Verificar todos los vehículos necesarios
const requiredVehicles = ['saturnV', 'lm_eagle', 'lm_ascent', 'cm_columbia', 'sls', 'icps', 'orion', 'deep_transport', 'mars_descent', 'mars_ascent', 'csm_lm', 'lm_aquarius', 'cm_odyssey'];
requiredVehicles.forEach(v => chk(!!CJ.FLT.VEHICULOS[v], `Vehículo ${v} en VEHICULOS`));

// Verificar perfiles requeridos
const requiredProfiles = ['saturnV_ascenso', 'saturnV_tli', 'csm_lm_acople', 'lm_eagle_descenso', 'lm_ascent_ascenso', 'cm_columbia_entrada', 'lm_aquarius_maniobra', 'icps_tli', 'sls_ascenso', 'deep_transport_tmi', 'deep_transport_moi', 'mars_descent_edl', 'mars_ascent_ascenso', 'orion_entrada', 'orion_amarizaje'];
requiredProfiles.forEach(p => chk(!!CJ.FLT.PERFILES[p], `Perfil ${p} en PERFILES`));

// Test init flight
try {
  const state = CJ.FLT.init('ascenso', 'saturnV', { asistencia: 2 });
  chk(!!state, 'FLT.init retorna estado');
  chk(state.fase === 'ascenso', 'Estado fase = ascenso');
  chk(state.vehiculo === 'saturnV', 'Estado vehiculo = saturnV');
  chk(state.perfil && state.perfil.length > 0, 'Perfil cargado');
  chk(!!CJ.FLT.getState, 'getState existe');
  chk(!!CJ.FLT.step, 'step existe');
  chk(!!CJ.FLT.resetAttitude, 'resetAttitude existe');
  
  // Test step
  const input = { pitch: 0, yaw: 0, roll: 0, throttle: 0 };
  const result = CJ.FLT.step(input);
  chk(!!result, 'FLT.step retorna resultado');
  chk(result.estado === 'flight' || result.estado === 'complete', 'Estado step válido');
  chk(typeof result.t === 'number', 'Tiempo en resultado');
  chk(Array.isArray(result.pos), 'Posición en resultado');
  chk(Array.isArray(result.vel), 'Velocidad en resultado');
  chk(Array.isArray(result.att), 'Actitud en resultado');
  chk(typeof result.throttle === 'number', 'Throttle en resultado');
  
  console.log(`  step result: t=${result.t.toFixed(1)}, estado=${result.estado}, stage=${result.stage}`);
} catch (e) {
  fallos.push('FLT.init/step error: ' + e.message);
}

// Test STG (stages/checklists)
chk(!!CJ.STG, 'CJ.STG cargado');
chk(!!CJ.STG.init, 'STG.init existe');
try {
  CJ.STG.init('saturnV', 'ascenso');
  const items = CJ.STG.getItemsForStage(0);
  chk(Array.isArray(items) && items.length > 0, 'Checklist items para stage 0');
  console.log(`  Checklist items: ${items.map(i => i.key).join(', ')}`);
} catch (e) {
  fallos.push('STG.init error: ' + e.message);
}

// Test CTL (controls)
chk(!!CJ.CTL, 'CJ.CTL cargado');
chk(!!CJ.CTL.update, 'CTL.update existe');
chk(!!CJ.CTL.getState, 'CTL.getState existe');
try {
  CJ.CTL.update(1/60);
  const state = CJ.CTL.getState();
  chk(!!state && typeof state.pitch === 'number', 'CTL.getState retorna input válido');
} catch (e) {
  fallos.push('CTL error: ' + e.message);
}

// Test HUD
chk(!!CJ.HUD, 'CJ.HUD cargado');
/* El HUD ya no pinta sobre el lienzo superpuesto: dibuja el contenido de cada
 * monitor del habitáculo sobre su propia textura. Lo que se comprueba aquí es
 * que esa ruta funciona y que declara elementos navegables. */
chk(typeof CJ.HUD.pintar === 'function', 'CJ.HUD.pintar (pintado de monitores) ausente');
chk(!!CJ.COCKPIT && !!CJ.CABINA, 'faltan los módulos de cabina para el HUD');
try {
  const mockState = { t: 10, pos: [6471000,0,0], vel: [0,7800,0], att: [0.1,0,0],
                      throttle: 1, stage: 0, fase: 'ascenso', vehiculo: 'saturnV',
                      impulso: 1, asistencia: 2, optimo: { att: [0.1, 0, 0] },
                      /* Los paneles leen el estado completo de la partida: sin
                       * recursos ni registro, varias rutas de datos fallan. */
                      m: 0, i: 0, res: [50, 50, 50, 50, 50], log: [], comms: [],
                      finish: false, elej: -1, seat: 0, turno: 0, dec: 0, inc: 0 };
  CJ.CABINA.enlazar({
    S: function () { return mockState; },
    /* Una misión mínima pero con forma real: la telemetría lee el evento en
     * curso para saber de qué fase habla. Sin él, `M[0].e[0]` es undefined y
     * el pintado se cae. */
    M: [{ e: [{ t: 'T+0', p: 1, c: ['Capcom', 'Listos para el ascenso'],
                w: null, o: [[['Opción', [0,0,0,0,0], 0, '...']]] }] }],
    AJ: { asistencia: 2 }, PH: ['Preparación', 'Lanzamiento'],
    NM: ['Tripulacion', 'Energia', 'Comunic.', 'Provisions', 'Propuls.'],
    NC: ['#0b6fb8','#c26a00','#7b4fc9','#0f8a8a','#b3261e'],
    lecturas: function () { return { alt: 100, vel: 1.5, dv: 200, res: [50,50,50,50,50] }; }
  });
  mockState.m = 0;
  mockState.i = 0;
  mockState.phase = 'decision';
  const cv = CJ.CABINA.pintarMon('telemetria', CJ.CABINA.datosTelemetria());
  chk(!!cv, 'CJ.HUD.pintar no dibujó el monitor de telemetría');
  const items = CJ.COCKPIT.itemsDe('telemetria');
  chk(items.length > 0, 'el monitor de telemetría declara elementos navegables');
  for (const it of items)
    chk(typeof it.acc === 'function' && isFinite(it.x) && isFinite(it.w),
        'un elemento del monitor sin acción o sin rectángulo');
} catch (e) {
  fallos.push('HUD.pintar error: ' + e.message);
}

console.log('\n=== RESUMEN ===');
console.log(`OK: ${ok}`);
if (fallos.length) {
  console.log('FALLOS:');
  fallos.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('¡INTEGRACIÓN DE VUELO VERIFICADA!');
}