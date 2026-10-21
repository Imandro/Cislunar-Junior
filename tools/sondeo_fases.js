/* Sondeo de desarrollo: cómo acaba cada fase de vuelo con el asistente al
 * máximo. Sirve para ver de un vistazo si alguna fase quedó inalcanzable. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = { console: console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'flight.js'), 'utf8'),
                ctx, { filename: 'flight.js' });
var F = ctx.CJ.FLT;

var PARES = [
  ['saturnV', 'ascenso'], ['saturnV', 'tli'], ['csm_lm', 'acople'],
  ['lm_eagle', 'descenso'], ['lm_ascent', 'ascenso'], ['cm_columbia', 'entrada'],
  ['lm_aquarius', 'maniobra'], ['sls', 'ascenso'], ['icps', 'tli'],
  ['orion', 'entrada'], ['orion', 'amarizaje'],
  ['deep_transport', 'tmi'], ['deep_transport', 'moi'], ['mars_descent', 'edl'],
  ['mars_ascent', 'ascenso']
];

console.log('vehiculo           fase          asistencia  desenlace');
PARES.forEach(function (p) {
  var s = F.init(p[1], p[0], { asistencia: 3 });
  var r = null, i = 0;
  for (i = 0; i < 140000; i++) {
    r = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0 });
    if (r.estado !== 'flight') break;
  }
  var fin = r && r.fin ? r.fin.tipo : 'sin-fin';
  var det = fin === 'orbita' ? ' (' + Math.round(r.fin.perigeo / 1000) + 'x' +
            Math.round(r.fin.apogeo / 1000) + ' km)' :
            fin === 'aterrizaje' ? ' (vv=' + (r.fin.velVertical || 0).toFixed(1) + ' m/s)' :
            fin === 'fallo' ? ' (' + r.fin.razon + ')' : '';
  console.log(p[0].padEnd(18) + p[1].padEnd(14) + ('3').padStart(6) + '  ' +
              (fin + det).padEnd(50) + ' t=' + ((r && r.t) || 0).toFixed(0) + ' s');
});
