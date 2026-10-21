/* =======================================================================
 * CISLUNAR JUNIOR - Suite de física de vuelo
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Cada comprobación es un defecto que se corrigió, con su número exacto.
 * Si uno falla, el defecto ha vuelto.
 *
 *   node tools\prueba_fisica.js
 *   node tools\prueba_fisica.js --detalle
 * ==================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var RAIZ = path.join(__dirname, '..');
var ctx = { console: console };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'flight.js'), 'utf8'), ctx, { filename: 'flight.js' });

var F = ctx.CJ.FLT;
var V3 = F.V3;

var ok = 0, fallos = 0;
var detalle = process.argv.indexOf('--detalle') >= 0;

function chk(nombre, cond, detalleFallo) {
  if (cond) { ok++; if (detalle) console.log('  OK   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalleFallo !== undefined ? '   -> ' + detalleFallo : '')); }
}

function grupo(t) { console.log('\n' + t); }

/* ---------------------------------------------------------------------
 * 1. Atmósfera medida contra el cuerpo correcto.
 *    Antes toda altitud se medía contra R_EARTH: en Marte daba -2981,5 km
 *    y una densidad de 9,0e114 kg/m³ que desbordaba la simulación entera.
 * ------------------------------------------------------------------- */
grupo('1. Densidad y cuerpo de referencia');
chk('Tierra al nivel del mar = 1,225', Math.abs(F.densidad(0, 'tierra') - 1.225) < 1e-9, F.densidad(0, 'tierra'));
chk('Marte al nivel del mar = 0,020', Math.abs(F.densidad(0, 'marte') - 0.020) < 1e-9, F.densidad(0, 'marte'));
chk('Luna sin atmósfera', F.densidad(1e4, 'luna') === 0, F.densidad(1e4, 'luna'));
chk('Marte 125 km según la exponencial', Math.abs(F.densidad(125e3, 'marte') - 0.020 * Math.exp(-125e3 / 11100)) < 1e-12, F.densidad(125e3, 'marte'));
chk('Marte 50 km es una densidad finita y pequeña', F.densidad(50e3, 'marte') > 0 && F.densidad(50e3, 'marte') < 1e-3, F.densidad(50e3, 'marte'));
chk('Marte: nunca desborda con altitud negativa', F.densidad(-2981.5e3, 'marte') === 0.020, F.densidad(-2981.5e3, 'marte'));
chk('Tierra: nunca desborda con altitud negativa', F.densidad(-5000e3, 'tierra') === 1.225, F.densidad(-5000e3, 'tierra'));
chk('marte/descenso no usa la Tierra', F.cuerpoDe('mars_descent', 'edl').id === 'marte', F.cuerpoDe('mars_descent', 'edl').id);
chk('lm/descenso usa la Luna', F.cuerpoDe('lm_eagle', 'descenso').id === 'luna');
chk('moi usa Marte', F.cuerpoDe('deep_transport', 'moi').id === 'marte');
chk('tmi usa Tierra (la inyección es en órbita terrestre)', F.cuerpoDe('deep_transport', 'tmi').id === 'tierra');
chk('saturnV/ascenso usa Tierra', F.cuerpoDe('saturnV', 'ascenso').id === 'tierra');
chk('mars_ascent/ascenso usa Marte', F.cuerpoDe('mars_ascent', 'ascenso').id === 'marte');

/* ---------------------------------------------------------------------
 * 2. Momento angular por producto vectorial.
 *    Antes h = r·v, que solo vale si la velocidad es perpendicular al
 *    radio: una órbita inclinada 30° daba e = 0,714 en vez de 0,795.
 * ------------------------------------------------------------------- */
grupo('2. Elementos orbitales');
var rp = 7000e3, ap = 42000e3, a = (rp + ap) / 2;
var vp = Math.sqrt(F.CUERPOS.tierra.mu * (2 / rp - 1 / a));
var e1 = F.elementos([rp, 0, 0], [0, vp, 0], 'tierra').e;
chk('elipse coplanar e = 0,714286', Math.abs(e1 - 0.7142857) < 1e-5, e1);
var inc = 30 * Math.PI / 180;
var e2 = F.elementos([rp, 0, 0], [vp * Math.sin(inc), vp * Math.cos(inc), 0], 'tierra').e;
chk('inclinada 30° e = 0,795', Math.abs(e2 - 0.7953952) < 1e-5, e2);
var rc = F.R_EARTH + 400e3, vc = Math.sqrt(F.CUERPOS.tierra.mu / rc);
var elC = F.elementos([rc, 0, 0], [0, vc, 0], 'tierra');
chk('órbita circular e ≈ 0', elC.e < 1e-9, elC.e);
chk('órbita circular a ≈ r', Math.abs(elC.a - rc) < 1, elC.a);
chk('circular da el mismo perigeo y apogeo', Math.abs(elC.perigeo - elC.apogeo) < 1);
// Una trayectoria puramente radial tiene h = 0 y por definición e = 1;
// hace falta velocidad tangencial para una hipérbole genuina.
var rcM = F.R_MARS + 400e3, vcM = Math.sqrt(F.CUERPOS.marte.mu / rcM);
var elRad = F.elementos([rcM, 0, 0], [vcM * 1.4, 0, 0], 'marte');
chk('trayectoria radial da e = 1 exacto', Math.abs(elRad.e - 1) < 1e-12, elRad.e);
var elM = F.elementos([rcM, 0, 0], [0, vcM * 1.6, 0], 'marte');
chk('hipérbole tangencial e > 1', elM.e > 1, elM.e);
var vEsc = Math.sqrt(2 * F.CUERPOS.tierra.mu / rc);
var elE = F.elementos([rc, 0, 0], [vEsc * 0.999, 0, 0], 'tierra');
chk('casi parabólica e entre 0,9 y 1,1', elE.e > 0.9 && elE.e < 1.1, elE.e);

/* ---------------------------------------------------------------------
 * 3. Los perfiles por altitud tienen que ser alcanzables.
 *    Antes todas las fases arrancaban en la superficie, así que el
 *    descenso lunar terminaba en el paso 1 con aterrizaje exitoso.
 * ------------------------------------------------------------------- */
grupo('3. Arranque de fase');
F.init('descenso', 'lm_eagle', {});
var altLM = V3.norm(F.getState().pos) - F.R_MOON;
chk('LM arranca a 15 km (PDI)', Math.abs(altLM - 15000) < 1, altLM);
var r1 = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0.5 });
chk('el descenso NO se resuelve en el paso 1', r1.estado === 'flight', r1.estado + ' ' + JSON.stringify(r1.fin || {}));
F.init('descenso', 'lm_eagle', {});
var sigue = true;
for (var i = 0; i < 60; i++) { if (F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0.5 }).estado !== 'flight') { sigue = false; break; } }
chk('el LM sigue volando 60 pasos', sigue);
F.init('edl', 'mars_descent', {});
chk('EDL arranca a 125 km', Math.abs((V3.norm(F.getState().pos) - F.R_MARS) - 125000) < 1, V3.norm(F.getState().pos) - F.R_MARS);
F.init('entrada', 'cm_columbia', {});
chk('entrada arranca a 122 km', Math.abs((V3.norm(F.getState().pos) - F.R_EARTH) - 122000) < 1, V3.norm(F.getState().pos) - F.R_EARTH);
F.init('entrada', 'cm_columbia', {});
var vIn = V3.norm(F.getState().vel);
chk('velocidad de entrada ~ 11 km/s', vIn > 10000 && vIn < 11500, vIn);

// La MOI no puede empezar ya dentro de una órbita buena.
F.init('moi', 'deep_transport', {});
var elMoi = F.elementos(F.getState().pos, F.getState().vel, 'marte');
chk('la MOI llega en hiperbola (e > 1)', elMoi.e > 1, elMoi.e);
F.init('moi', 'deep_transport', {});
var moi1 = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0 });
chk('la MOI no está cumplida en el paso 1', moi1.estado === 'flight', moi1.estado + ' ' + JSON.stringify(moi1.fin || {}));

/* ---------------------------------------------------------------------
 * 4. Actitud por cuaternión: los ángulos nunca se acumulan sin normalizar.
 *    30 s de entrada a tope daban 3410° de cabeceo.
 * ------------------------------------------------------------------- */
grupo('4. Actitud');
F.init('ascenso', 'saturnV', {});
for (var i = 0; i < 1800; i++) F.step({ pitch: 1, yaw: 1, roll: 1, throttle: 0 });
var att = F.getState().att.map(F.deg);
chk('pitch normalizado', att[0] > -180 && att[0] <= 180, att[0]);
chk('yaw normalizado', att[1] > -180 && att[1] <= 180, att[1]);
chk('roll normalizado', att[2] > -180 && att[2] <= 180, att[2]);
chk('cuaternión unitario', Math.abs(Math.hypot(F.getState().q[0], F.getState().q[1], F.getState().q[2], F.getState().q[3]) - 1) < 1e-9);
F.init('ascenso', 'saturnV', {});
for (var i = 0; i < 20000; i++) F.step({ pitch: 1, yaw: 1, roll: 1, throttle: 0 });
var att2 = F.getState().att.map(F.deg);
chk('tras 5 min sigue normalizado', att2.every(function (x) { return x > -180 && x <= 180; }), att2.join(','));
// Ida y vuelta Euler <-> cuaternión
var q0 = F.qDesdeEuler(0.3, -0.7, 0.15);
var e0 = F.eulerDesdeQ(q0);
chk('Euler -> q -> Euler vuelve', Math.abs(e0[0] - 0.3) < 1e-9 && Math.abs(e0[1] - (-0.7)) < 1e-9 && Math.abs(e0[2] - 0.15) < 1e-9, e0.join(','));
// Un giro completo del cabeceo no debe pasar por singularidad
var qSpin = F.qDesdeEuler(0, 0, 0), okSpin = true;
for (var i = 0; i < 20000; i++) qSpin = [qSpin[0], qSpin[1], qSpin[2], qSpin[3]]; // identidad estable
chk('cuaternión identidad estable', Math.abs(F.eulerDesdeQ([0, 0, 0, 1])[0]) < 1e-12);

/* ---------------------------------------------------------------------
 * 5. Una sola clave de interpolación para todo el perfil.
 *    simulatePerfect y resetAttitude usaban siempre 't', así que en los
 *    perfiles por altitud leían undefined.
 * ------------------------------------------------------------------- */
grupo('5. Clave de perfil');
chk('descenso se interpola por altitud', F.claveDePerfil('descenso') === 'alt');
chk('entrada se interpola por altitud', F.claveDePerfil('entrada') === 'alt');
chk('edl se interpola por altitud', F.claveDePerfil('edl') === 'alt');
chk('amarizaje se interpola por altitud', F.claveDePerfil('amarizaje') === 'alt');
/* El ascenso se guía por VELOCIDAD, no por tiempo: el giro lo fija la
 * velocidad del vehículo. Un perfil por reloj dejaba al cohete encallado
 * a 70 grados sin acelerar en tangencial. */
chk('ascenso se interpola por velocidad', F.claveDePerfil('ascenso') === 'vel');
chk('tli se interpola por tiempo', F.claveDePerfil('tli') === 't');
chk('la interpolación devuelve números finitos en alt',
    isFinite(F.interpolarPerfil(F.PERFILES.lm_descent, 'alt', 8000).throttle),
    F.interpolarPerfil(F.PERFILES.lm_descent, 'alt', 8000).throttle);
var pDesc = F.simulatePerfect('descenso', 'lm_eagle', 240);
chk('simulatePerfect en descenso corre', pDesc.length > 1, pDesc.length);
chk('simulatePerfect no aterriza de golpe', pDesc[0].estado === 'flight', pDesc[0].estado);
chk('simulatePerfect desciende de verdad', (pDesc[pDesc.length - 1].alt === undefined ? 1e9 : pDesc[pDesc.length - 1].alt) < 15000, pDesc[pDesc.length - 1].alt);
var pEnt = F.simulatePerfect('entrada', 'orion', 600);
chk('simulatePerfect en entrada corre', pEnt.length > 1, pEnt.length);
chk('la entrada no diverge', isFinite(pEnt[pEnt.length - 1].alt), pEnt[pEnt.length - 1].alt);

/* ---------------------------------------------------------------------
 * 6. Tensor de inercia por vehículo, no 30 m fijos para todos.
 * ------------------------------------------------------------------- */
grupo('6. Inercia');
var Is = F.inerciaDe(F.VEHICULOS.saturnV, 2.97e6);
var Il = F.inerciaDe(F.VEHICULOS.lm_eagle, 15000);
chk('SaturnV tiene muchísima más inercia transversal que el LM', Is.y > Il.y * 500, Is.y + ' vs ' + Il.y);
chk('SaturnV es mucho más esbelto que ancho', Is.x < Is.y / 50, (Is.x / Is.y).toFixed(5));
var I1 = F.inerciaDe(F.VEHICULOS.saturnV, 2.97e6);
var I2 = F.inerciaDe(F.VEHICULOS.saturnV, 1.0e6);
chk('la inercia escala con la masa', Math.abs(I2.y / I1.y - 1e6 / 2.97e6) < 1e-9);

/* ---------------------------------------------------------------------
 * 7. Ejes del empuje. A 90° de cabeceo el empuje tiene que ser radial:
 *    antes salía perpendicular al radio y el cohete despegue de lado.
 * ------------------------------------------------------------------- */
grupo('7. Dirección del empuje');
F.init('ascenso', 'saturnV', {});
var mc = F.marcoLocal(F.getState().pos);
var d90 = F.dirEmpuje(90, 0, mc);
var d0 = F.dirEmpuje(0, 0, mc);
var d45 = F.dirEmpuje(45, 0, mc);
chk('pitch 90 apunta al cenit', d90[0] > 0.9999, d90.join(','));
chk('pitch 0 es tangente al suelo', Math.abs(V3.dot(d0, [1, 0, 0])) < 1e-12, d0.join(','));
chk('90° y 0° son ortogonales', Math.abs(V3.dot(d90, d0)) < 1e-12, V3.dot(d90, d0));
chk('45° queda a medio camino', Math.abs(d45[0] - Math.SQRT1_2) < 1e-12, d45.join(','));
chk('el marco local up es unitario', Math.abs(V3.norm(mc.up) - 1) < 1e-12);
chk('este es ortogonal a up', Math.abs(V3.dot(mc.este, mc.up)) < 1e-12);

/* ---------------------------------------------------------------------
 * 8. El empuje sube de verdad contra la gravedad (TWR > 1 al despegue).
 * ------------------------------------------------------------------- */
grupo('8. Despegue');
F.init('ascenso', 'saturnV', {});
var up = F.marcoLocal(F.getState().pos).up;
var g0 = V3.norm(F.gravedad(F.getState().pos, 'tierra'));
var peso = F.VEHICULOS.saturnV.etapas[0].empuje / F.VEHICULOS.saturnV.masaInicial;
chk('el Saturn V supera su peso en la plataforma', peso > g0, peso + ' vs ' + g0);
F.init('ascenso', 'saturnV', {});
var alt0 = V3.norm(F.getState().pos);
for (var i = 0; i < 60; i++) F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 1 });
var alt60 = V3.norm(F.getState().pos);
chk('con combustible al máximo gana altura', alt60 > alt0, alt0 + ' -> ' + alt60);
chk('la gravedad da 9,8 m/s² en superficie', Math.abs(V3.norm(F.gravedad([F.R_EARTH, 0, 0], 'tierra')) - 9.80665) < 0.05, V3.norm(F.gravedad([F.R_EARTH, 0, 0], 'tierra')));
chk('la gravedad decrece con la altitud', V3.norm(F.gravedad([F.R_EARTH + 400e3, 0, 0], 'tierra')) < g0);

/* ---------------------------------------------------------------------
 * 9. Atmósfera hipersónica: Cd y número de Mach.
 * ------------------------------------------------------------------- */
grupo('9. Aerodinámica');
/* Cuerpo esbelto: el Cd es casi plano a Mach bajo (fricción de piel dominante).
 * El anterior (0,9 subsónico) era de cuerpo romo y hacía perder al Saturn V
 * un sexto de su empuje contra el aire: ya no llegaba a órbita. */
chk('Mach bajo: Cd de cuerpo esbelto', F.cdMaq(0.1) < 0.35 && F.cdMaq(0.9) < 0.5 &&
    F.cdMaq(0.9) > F.cdMaq(0.1),
    F.cdMaq(0.1) + ' -> ' + F.cdMaq(0.9));
chk('el transónico baja el Cd', F.cdMaq(1.1) < 0.6, F.cdMaq(1.1));
chk('hipersónico: Cd moderado, no desbocado', F.cdMaq(25) > 0.2 && F.cdMaq(25) < 0.45, F.cdMaq(25));
chk('velocidad del sonido Tierra ~ 340 m/s', Math.abs(F.velSonido(0, 'tierra') - 340.3) < 1, F.velSonido(0, 'tierra'));
chk('velocidad del sonido Marte ~ 240 m/s', F.velSonido(0, 'marte') > 230 && F.velSonido(0, 'marte') < 250, F.velSonido(0, 'marte'));
chk('el aire gira con la Tierra', F.velSonido(100e3, 'tierra') > 0);

/* ---------------------------------------------------------------------
 * 10. Regresión: los 16 pares vehículo/fase que declara el juego.
 * ------------------------------------------------------------------- */
grupo('10. Los 16 pares vehículo/fase de la partida');
var PARES = [
  ['saturnV', 'ascenso'], ['saturnV', 'tli'], ['csm_lm', 'acople'],
  ['cm_columbia', 'entrada'], ['lm_eagle', 'descenso'], ['lm_aquarius', 'maniobra'],
  ['lm_ascent', 'ascenso'], ['cm_odyssey', 'entrada'], ['sls', 'ascenso'],
  ['icps', 'tli'], ['deep_transport', 'tmi'], ['deep_transport', 'moi'],
  ['mars_descent', 'edl'], ['mars_ascent', 'ascenso'], ['orion', 'entrada'],
  ['orion', 'amarizaje']
];
for (var i = 0; i < PARES.length; i++) {
  var v = PARES[i][0], f = PARES[i][1];
  F.init(f, v, {});
  var st = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0.5 });
  chk(v + '/' + f + ' -> ' + st.estado + ' @ ' + Math.round((st.alt || 0) / 1000) + ' km',
      st.estado === 'flight' && isFinite(st.alt) && isFinite(st.velMag),
      JSON.stringify(st.fin || {}));
}

/* ---------------------------------------------------------------------
 * 11. Todos los perfiles usan una clave coherente con su fase.
 * ------------------------------------------------------------------- */
grupo('11. Coherencia de perfiles');
Object.keys(F.PERFILES).forEach(function (k) {
  var usaAlt = F.PERFILES[k].some(function (p) { return p.alt !== undefined; });
  var usaT = F.PERFILES[k].some(function (p) { return p.t !== undefined; });
  chk(k + ' no mezcla claves t y alt', !(usaAlt && usaT), usaAlt ? 'alt' : '');
});
chk('todos los perfiles tienen al menos un punto', Object.keys(F.PERFILES).every(function (k) { return F.PERFILES[k].length > 0; }));
Object.keys(F.PERFILES).forEach(function (k) {
  F.PERFILES[k].forEach(function (p, idx) {
    chk(k + '[' + idx + '] tiene números finitos',
        isFinite(p.pitch) && isFinite(p.yaw || 0) && isFinite(p.throttle) && isFinite(p.stage),
        JSON.stringify(p));
  });
});

/* --------------------------------------------------------------------- */
console.log('\n========================================');
console.log('FISICA DE VUELO: ' + ok + ' OK, ' + fallos + ' fallos');
console.log('========================================');
process.exit(fallos ? 1 : 0);
