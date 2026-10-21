/* =======================================================================
 * CISLUNAR JUNIOR - Consecuencias del vuelo sobre la partida
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Cada comprobación es una regla del juego que dependía de que el vuelo
 * se hiciera pasar por una decisión. Si una falla, esa regla se ha roto.
 *
 *   node tools\prueba_mision.js
 *   node tools\prueba_mision.js --detalle
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
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'mision_vuelo.js'), 'utf8'), ctx, { filename: 'mision_vuelo.js' });

var M = ctx.CJ.MISION;

var ok = 0, fallos = 0;
var detalle = process.argv.indexOf('--detalle') >= 0;

function chk(nombre, cond, fallo) {
  if (cond) { ok++; if (detalle) console.log('  OK   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (fallo !== undefined ? '   -> ' + fallo : '')); }
}
function grupo(t) { console.log('\n' + t); }

/* ---------------------------------------------------------------------
 * 1. El propulsor se consume mientras se quema.
 *    Antes el ΔV gastado en vuelo no restaba nada: sepodía hacer la TLI
 *    completa y quedarse con el propelente intacto.
 * ------------------------------------------------------------------ */
grupo('1. Consumo de propelente proporcional al delta-v');
chk('0 m/s no cuesta nada', M.costeDeltaV(0) === 0);
chk('un valor negativo tampoco', M.costeDeltaV(-50) === 0);
chk('300 m/s cuestan exactamente 1 punto', Math.abs(M.costeDeltaV(300) - 1) < 1e-9);
chk('la TLI de Apolo 11 (3150 m/s) cuesta 10,5 puntos',
    Math.abs(M.costeDeltaV(3150) - 10.5) < 1e-9, M.costeDeltaV(3150));
chk('la relación es lineal', Math.abs(M.costeDeltaV(600) - 2) < 1e-9 &&
                             Math.abs(M.costeDeltaV(1800) - 6) < 1e-9);

/* ---------------------------------------------------------------------
 * 2. Órbita lograda: recompensa, no castigo.
 * ------------------------------------------------------------------ */
grupo('2. Orbita lograda');
var orb = M.evaluar({ tipo: 'orbita', perigeo: 185000, apogeo: 190000, e: 0.001 }, {});
chk('es un exito', orb.exito === true);
chk('no castiga el soporte vital', orb.deltas[0] >= 0, orb.deltas[0]);
chk('devuelve cinco deltas', orb.deltas.length === 5);
chk('todos los deltas estan acotados', orb.deltas.every(function (v) { return v >= -100 && v <= 100; }));
chk('el titulo menciona la orbita', /rbita/.test(orb.titulo), orb.titulo);

/* ---------------------------------------------------------------------
 * 3. Descenso: la velocidad de contacto decide.
 * ------------------------------------------------------------------ */
grupo('3. Descenso lunar / EDL');
var suave = M.evaluar({ tipo: 'aterrizaje', exito: true, velVertical: 0.8 }, {});
chk('aterrizaje suave: exito', suave.exito === true);
chk('aterrizaje suave: apenas castiga', suave.deltas[0] >= -2, suave.deltas[0]);
chk('aterrizaje suave: no gasta recursos criticos', suave.deltas[3] >= -2, suave.deltas[3]);

var duro = M.evaluar({ tipo: 'aterrizaje', exito: false, velVertical: 14 }, {});
chk('contacto duro: no es exito', duro.exito === false);
chk('contacto duro: castiga la tripulacion', duro.deltas[0] <= -20, duro.deltas[0]);
chk('contacto duro: castiga la proteccion', duro.deltas[2] <= -14, duro.deltas[2]);
chk('contacto duro: cuanta mas velocidad, peor',
    (function () {
      var peor = M.evaluar({ tipo: 'aterrizaje', exito: false, velVertical: 20 }, {});
      return peor.deltas[0] <= duro.deltas[0];
    })());

/* ---------------------------------------------------------------------
 * 4. Impacto: el fallo caro.
 * ------------------------------------------------------------------ */
grupo('4. Impacto y perdida de la etapa');
var imp = M.evaluar({ tipo: 'fallo', razon: 'Impacto' }, {});
chk('impacto: no es exito', imp.exito === false);
chk('impacto: castiga los cinco recursos', imp.deltas.every(function (v) { return v < 0; }));
chk('impacto: el soporte vital es el mas danado', imp.deltas[0] <= imp.deltas[1] &&
                                                       imp.deltas[0] <= imp.deltas[3]);
chk('una divergencia numerica no se confunde con un impacto',
    M.evaluar({ tipo: 'numerico', razon: 'divergencia' }, {}).deltas[0] > imp.deltas[0]);

/* ---------------------------------------------------------------------
 * 5. Las cargas del vuelo pasan factura.
 * ------------------------------------------------------------------ */
grupo('5. Cargas y presion dinamica');
var nominal = M.evaluar({ tipo: 'orbita', perigeo: 185000, apogeo: 190000 }, { gMax: 3.5, qMax: 22 });
var cargado = M.evaluar({ tipo: 'orbita', perigeo: 185000, apogeo: 190000 }, { gMax: 11, qMax: 90 });
chk('cargas nominales: no castigan', nominal.deltas[0] >= 0 && nominal.deltas[1] >= 0,
    nominal.deltas[0] + '/' + nominal.deltas[1]);
chk('11 g castigan la tripulacion', cargado.deltas[0] < 0, cargado.deltas[0]);
chk('90 kPa castigan la energia', cargado.deltas[1] < 0, cargado.deltas[1]);
chk('el umbral es 6 g',
    M.evaluar({ tipo: 'orbita' }, { gMax: 6 }).deltas[0] === 1 &&
    M.evaluar({ tipo: 'orbita' }, { gMax: 8 }).deltas[0] < 1);
chk('el texto explica el porque', /g sobre la tripulaci/.test(cargado.detalle), cargado.detalle);

/* ---------------------------------------------------------------------
 * 6. El propulsor tambien paga al final.
 * ------------------------------------------------------------------ */
grupo('6. Propelente quemado en la factura final');
var quemado = M.evaluar({ tipo: 'orbita', perigeo: 185000, apogeo: 190000 }, { dvSedimento: 900 });
chk('900 m/s de sedimento restan 3 puntos de propelente', quemado.deltas[4] === -3, quemado.deltas[4]);
chk('sin sedimento no se cobra propulsor', M.evaluar({ tipo: 'orbita', perigeo: 185000 }, {}).deltas[4] === 0,
    M.evaluar({ tipo: 'orbita', perigeo: 185000 }, {}).deltas[4]);

/* ---------------------------------------------------------------------
 * 7. Deteccion de recursos agotados.
 * ------------------------------------------------------------------ */
grupo('7. Recursos agotados');
chk('partida sana: nada agotado', M.agotado([100, 100, 100, 100, 100]) === -1);
chk('propelente a cero se detecta', M.agotado([100, 100, 100, 100, 0]) === 4);
chk('detecta el primero que cae', M.agotado([50, 0, 20, 0, 100]) === 1);
chk('un recurso negativo tambien', M.agotado([10, -3, 10, 10, 10]) === 1);

/* ---------------------------------------------------------------------
 * 8. Pureza: la misma entrada da la misma salida.
 * ------------------------------------------------------------------ */
grupo('8. Determinismo');
var a = M.evaluar({ tipo: 'aterrizaje', exito: true, velVertical: 1.2 }, { gMax: 5, qMax: 30 });
var b = M.evaluar({ tipo: 'aterrizaje', exito: true, velVertical: 1.2 }, { gMax: 5, qMax: 30 });
chk('evaluar es determinista', JSON.stringify(a) === JSON.stringify(b));
chk('no deja NaN en los deltas', a.deltas.every(function (v) { return isFinite(v); }));
chk('no muta la entrada',
    (function () {
      var r = { tipo: 'fallo', razon: 'x' }, m = { gMax: 9 };
      M.evaluar(r, m);
      return Object.keys(r).length === 2 && m.gMax === 9;
    })());
chk('aguanta metricas vacias',
    (function () {
      var e = M.evaluar({ tipo: 'tiempo', exito: true }, null);
      return e.exito === true && e.deltas.every(isFinite);
    })());
chk('aguanta un resultado vacio sin romperse',
    (function () { var e = M.evaluar({}, {}); return e.exito === true && e.deltas.length === 5; })());

/* ---------------------------------------------------------------------
 * 9. Calidad de vuelo (para medallas de la academia).
 * ------------------------------------------------------------------ */
grupo('9. Calidad del vuelo');
chk('vuelo perfecto: calidad 1', M.calidad({ gMax: 3, qMax: 10 }, 'orbita') === 1);
chk('vuelo salvaje: calidad baja', M.calidad({ gMax: 16, qMax: 120, fueraZona: 200 }, 'orbita') < 0.5);
chk('un impacto nunca es calidad 1', M.calidad({}, 'impacto') < 1);
chk('nunca sale del rango 0..1',
    M.calidad({ gMax: 100, qMax: 9999, fueraZona: 9e9 }, 'orbita') >= 0);

/* --------------------------------------------------------------------- */
console.log('\n=========================================');
console.log('CONSECUENCIA DE VUELO: ' + ok + ' OK, ' + fallos + ' fallos');
if (fallos) process.exit(1);
