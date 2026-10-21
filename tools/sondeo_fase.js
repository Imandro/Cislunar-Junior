/* Traza una fase concreta: node tools\sondeo_fase.js vehiculo fase [asistencia] */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = { console: console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'flight.js'), 'utf8'),
                ctx, { filename: 'flight.js' });
var F = ctx.CJ.FLT;

var veh = process.argv[2] || 'lm_eagle', fase = process.argv[3] || 'descenso';
var asis = Number(process.argv[4] || 3);
F.init(fase, veh, { asistencia: asis });
console.log('=== ' + veh + ' / ' + fase + ' (asistencia ' + asis + ') ===');
console.log('t(s)   alt(km)  vel(m/s)  pitch  thr   masa(t)   dv');
var r = null, i = 0, ult = -1;
for (i = 0; i < 140000; i++) {
  r = F.step({ pitch: 0, yaw: 0, roll: 0, throttle: 0 });
  if (i % 600 === 0 || (r.stage !== ult && i < 2000)) {
    ult = r.stage;
    console.log(String(Math.round(r.t)).padStart(4) + ' ' +
      ((r.alt || 0) / 1000).toFixed(2).padStart(9) + ' ' +
      (r.velMag || 0).toFixed(0).padStart(9) + ' ' +
      (r.att[0] * 57.2958).toFixed(0).padStart(6) + ' ' +
      (r.throttle || 0).toFixed(2).padStart(6) + ' ' +
      ((r.masa || 0) / 1000).toFixed(1).padStart(9) + ' ' +
      ((r.metricas && r.metricas.dvGastado) || 0).toFixed(0).padStart(7));
  }
  if (r.estado !== 'flight') break;
}
console.log('--- fin: ' + JSON.stringify(r && r.fin) + ' t=' + (r && r.t).toFixed(1));
