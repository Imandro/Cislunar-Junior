/* Sondeo de desarrollo (no es una prueba): telemetría del ascenso del Saturn V.
 *   node tools\sondeo_ascenso.js [ruta-a-flight.js]
 * Sirve para ajustar la guía de giro sin adivinar: imprime altitud,
 * velocidad, cabeceo ordenado y gasto cada pocos segundos. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var RAIZ = path.join(__dirname, '..');
var cual = process.argv[2] || 'js\\flight.js';
var ctx = { console: console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.isAbsolute(cual) ? cual : path.join(RAIZ, cual), 'utf8'),
                ctx, { filename: 'flight.js' });
var F = ctx.CJ.FLT;

F.init('ascenso', 'saturnV', { asistencia: 2 });
console.log('t(s)   alt(km)  vel(m/s)  pitch  obj   thr   masa(t)  etapa  dv(m/s)');
var r = null, i = 0;
for (i = 0; i < 90000; i++) {
  r = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0 });
  if (i % 240 === 0 || !i || r.estado !== 'flight') {
    console.log(
      String(Math.round(r.t)).padStart(4) + ' ' +
      ((r.alt || 0) / 1000).toFixed(1).padStart(8) + ' ' +
      (r.velMag || 0).toFixed(0).padStart(9) + ' ' +
      (r.att[0] * 57.2958).toFixed(0).padStart(7) + ' ' +
      (r.optimo ? r.optimo.pitch.toFixed(0) : '?').padStart(5) + ' ' +
      (r.throttle || 0).toFixed(2).padStart(6) + ' ' +
      ((r.masa || 0) / 1000).toFixed(0).padStart(8) + ' ' +
      String(r.stage).padStart(7) + ' ' +
      ((r.metricas && r.metricas.dvGastado) || 0).toFixed(0).padStart(8));
  }
  if (r.estado !== 'flight') break;
}
console.log('--- fin en t=' + (r && r.t).toFixed(1) + ' s, estado=' + r.estado +
            ', fin=' + JSON.stringify(r && r.fin));
