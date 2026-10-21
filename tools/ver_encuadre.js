/* Comprobación del encuadre de los monitores de cabina: proyecta las cuatro
 * esquinas de cada pantalla con las matrices reales del sombreado y dice si
 * caen dentro del cuadro. Uso:  node tools/ver_encuadre.js [ancho] [alto]      */
'use strict';
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const PROY = path.resolve(__dirname, '..');

const W = parseInt(process.argv[2] || '1440', 10);
const H = parseInt(process.argv[3] || '810', 10);

const sb = { console, Math, JSON, Object, Array, Float32Array, Uint16Array,
             module: { exports: {} } };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
function cargar(f) {
  vm.runInContext(fs.readFileSync(path.join(PROY, f), 'utf8'), sb, { filename: f });
}
cargar('js/glcore.js');
cargar('js/cockpit.js');
const CJ = sb.CJ, CAB = CJ.COCKPIT, M = CJ.GL.matrices;

const asp = W / H;
const proj = M.perspectiva(CAB.FOV, asp, 0.1, 20);
const vista = M.mul(M.mul(M.rotX(0), M.rotY(0)), M.escala(1, 1, -1));
const mvp = M.mul(proj, vista);

console.log('lienzo ' + W + '×' + H + '  fov ' + CAB.FOV.toFixed(3) + ' rad  asp ' + asp.toFixed(3));
const MARCA_MAL = 'FALLO ';
console.log('monitor      x_min  x_max  y_min  y_max   z    proporción');
let malos = 0;
for (const mon of CAB.MONITORES.concat([CAB.CENTRAL])) {
  const q = CAB.rectLocal(mon);
  const ns = q.map(p => {
    const v = [p[0], p[1], p[2], 1], r = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++)
      r[i] = mvp[i]*v[0] + mvp[4+i]*v[1] + mvp[8+i]*v[2] + mvp[12+i];
    return [r[0]/r[3], r[1]/r[3]];
  });
  const xs = ns.map(n => n[0]), ys = ns.map(n => n[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ok = x0 >= -1 && x1 <= 1 && y0 >= -1 && y1 <= 1;
  if (!ok) malos++;
  console.log(
    (ok ? '  ok  ' : MARCA_MAL) + ' ' + mon.id.padEnd(11) +
    x0.toFixed(2).padStart(6) + x1.toFixed(2).padStart(7) +
    y0.toFixed(2).padStart(7) + y1.toFixed(2).padStart(7) +
    q[0][2].toFixed(2).padStart(6) + '     ' + (mon.t[0]/mon.t[1]).toFixed(2));
}
console.log(malos ? malos + ' monitores fuera de cuadro' : 'todos los monitores dentro de cuadro');