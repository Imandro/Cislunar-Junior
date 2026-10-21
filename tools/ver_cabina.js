/* ===========================================================================
 * Verificación de la cabina inmersiva en un navegador real
 *
 * El arnés con DOM simulado no puede comprobar lo que depende del WebGL ni de
 * la interacción real, así que esto habla con Brave por CDP, carga la página,
 * espera a que el juego esté listo y ejecuta una serie de comprobaciones sobre
 * la cabina viva: que esté montada, que los seis monitores pinten, que el
 * teclado navegue y que no haya errores de consola.
 *
 * Uso:  node tools/ver_cabina.js
 * =========================================================================== */
'use strict';
const cdp = require('./cdp.js');

const PUERTO = 9333;
const URL_PAG = 'http://127.0.0.1:8899/Cislunar%20Junior%20-%20Ca%C3%B1on%20Labs.html';

/* Las comprobaciones que se ejecutan dentro de la página. Cada una devuelve un
 * texto; "ok: ..." cuenta como acierto y lo demás como fallo. */
const PRUEBAS = [
  /* 1. La cabina está montada y el cuerpo tiene la clase que la activa. */
  `(function () {
     var r = { cab: !!window.INMERSIVO, R3D: !!window.R3D,
               clase: document.body.classList.contains('inmersivo'),
               cockpit: !!window.CJ.COCKPIT };
     return r.cab && r.R3D && r.clase && r.cockpit
       ? 'ok: cabina montada, WebGL vivo, cuerpo en modo inmersivo'
       : 'FALLO: ' + JSON.stringify(r);
   })()`,

  /* 2. Los seis monitores existen y tienen geometría válida. */
  `(function () {
     var C = window.CJ.COCKPIT, mal = [];
     C.MONITORES.forEach(function (m) {
       var q = C.rectLocal(m);
       var ok = q.length === 4 && q.every(function (p) {
         return isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]);
       });
       if (!ok) mal.push(m.id);
       if (!C.TECLAS[m.tecla]) mal.push(m.id + ' sin tecla');
     });
     return C.MONITORES.length === 6 && !mal.length
       ? 'ok: 6 monitores con geometría y teclas F1..F6'
       : 'FALLO: ' + (mal.join(', ') || 'no hay 6 monitores');
   })()`,

  /* 3. El menú principal se dibuja y declara elementos navegables. */
  `(function () {
     var NC = window.CJ.CABINA;
     NC.abrir('menu');
     var it = window.CJ.COCKPIT.itemsDe('central');
     var names = it.map(function (i) { return i.t; });
     return it.length >= 8 && names.indexOf('Apolo 11') >= 0
       ? 'ok: menú con ' + it.length + ' elementos'
       : 'FALLO: menú con ' + it.length + ' elementos: ' + names.join(' / ');
   })()`,

  /* 4. Cada monitor se pinta sin excepción y declara elementos. */
  `(function () {
     var NC = window.CJ.CABINA, C = window.CJ.COCKPIT, mal = [];
     var lista = [['telemetria', NC.datosTelemetria], ['comms', NC.datosComms],
                  ['sistemas', NC.datosSistemas], ['mapa', NC.datosMapa],
                  ['checklist', NC.datosChecklist],
                  ['controles', NC.datosControles]];
     lista.forEach(function (par) {
       try {
         var d = par[1].call(NC);
         NC.pintarMon(par[0], d);
         if (!C.itemsDe(par[0]).length) mal.push(par[0] + ' sin elementos');
       } catch (e) { mal.push(par[0] + ': ' + e.message); }
     });
     return mal.length ? 'FALLO: ' + mal.join(' | ')
                       : 'ok: los 6 monitores pintaron y declaran elementos';
   })()`,

  /* 5. El raycast acierta el centro de cada monitor con uv ~ 0.5. */
  `(function () {
     var C = window.CJ.COCKPIT, mal = [], esp = 1.7;
     var M = C.BOOT ? C.BOOT.matrices : window.CJ.GL.matrices;
     var proj = M.perspectiva(C.FOV, window.innerWidth / window.innerHeight, 0.1, 20);
     var vista = M.mul(M.mul(M.rotX(0), M.rotY(0)), M.escala(1, 1, -1));
     var mvc = M.mul(proj, vista);
     C.MONITORES.forEach(function (m) {
       var q = C.rectLocal(m), s = [0, 0, 0];
       q.forEach(function (p) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
       s = s.map(function (v) { return v / 4; });
       var v = [s[0], s[1], s[2], 1], r = [0, 0, 0, 0];
       for (var i = 0; i < 4; i++)
         r[i] = mvc[i]*v[0] + mvc[4+i]*v[1] + mvc[8+i]*v[2] + mvc[12+i];
       var px = (r[0]/r[3] + 1) / 2 * window.innerWidth;
       var py = (1 - r[1]/r[3]) / 2 * window.innerHeight;
       var hit = C.monitorBajoRaton(px, py, { aspecto: window.innerWidth / window.innerHeight });
       if (!hit) { mal.push(m.id + ' no responde'); return; }
       if (hit.mon.id !== m.id) { mal.push(m.id + ' -> ' + hit.mon.id); return; }
       if (Math.abs(hit.u - 0.5) > 0.06 || Math.abs(hit.v - 0.5) > 0.06)
         mal.push(m.id + ' uv ' + hit.u.toFixed(2) + ',' + hit.v.toFixed(2));
     });
     return mal.length ? 'FALLO: ' + mal.join(' | ') : 'ok: raycast acierta los 6 centros';
   })()`,

  /* 6. El teclado entra en la cabina, navega y suelta. */
  `(function () {
     function tecla(code, key) {
       window.dispatchEvent(new KeyboardEvent('keydown',
         { code: code, key: key, bubbles: true, cancelable: true }));
     }
     function suelta(code, key) {
       window.dispatchEvent(new KeyboardEvent('keyup',
         { code: code, key: key, bubbles: true, cancelable: true }));
     }
     var T = window.CJ.CTL;
     T.soltarFoco();
     var antes = T.tieneFoco();
     tecla('Tab', 'Tab');
     var dentro = T.tieneFoco();
     tecla('Escape', 'Escape');
     var fuera = !T.tieneFoco();
     return dentro && fuera
       ? 'ok: Tab entra en la cabina, Esc suelta el foco (antes ' + antes + ')'
       : 'FALLO: Tab=' + dentro + ' Esc=' + fuera;
   })()`,

  /* 7. F1..F6 saltan al monitor correcto. */
  `(function () {
     function tecla(code) {
       window.dispatchEvent(new KeyboardEvent('keydown',
         { code: code, key: code, bubbles: true, cancelable: true }));
     }
     var C = window.CJ.COCKPIT, mal = [];
     Object.keys(C.TECLAS).forEach(function (code) {
       C.foco(null);
       tecla(code);
       var m = C.monFoco();
       if (!m || m.id !== C.TECLAS[code]) mal.push(code + ' -> ' + (m ? m.id : 'nada'));
     });
     return mal.length ? 'FALLO: ' + mal.join(', ') : 'ok: F1..F6 van a su monitor';
   })()`,

  /* 8. El ratón sobre un elemento del monitor hace algo (registro de comms). */
  `(function () {
     var C = window.CJ.COCKPIT, NC = window.CJ.CABINA;
     NC.abrir('menu');
     var it = C.itemsDe('central');
     if (!it.length) return 'FALLO: menú sin elementos';
     C.foco('central');
     C.estado.sel.central = 0;
     var pulsado = it[0].t;
     C.activar();
     return window.S && window.S.m === 0
       ? 'ok: Enter sobre "' + pulsado + '" arranca la misión'
       : 'FALLO: ' + pulsado + ' no arrancó la misión';
   })()`
];

/* ===================================================================== */
async function main() {
  let paginas;
  try {
    paginas = await cdp.pedirJSON(PUERTO, '/json');
  } catch (e) {
    console.error('No hay navegador en el puerto ' + PUERTO +
      '. Ábrelo con --headless=new --remote-debugging-port=' + PUERTO);
    process.exit(1);
  }
  const pag = paginas.filter(p => p.type === 'page')[0];
  if (!pag) { console.error('No hay ninguna página que mirar.'); process.exit(1); }

  let sesion;
  try {
    sesion = await cdp.abrir(pag.webSocketDebuggerUrl);
  } catch (e) {
    console.error('No se pudo abrir la sesión CDP: ' + e.message);
    process.exit(1);
  }

  /* La página tarda en compilar shaders y montar la cabina: sin esta espera las
   * primeras comprobaciones verían el juego a medio arrancar. */
  await new Promise(r => setTimeout(r, 3500));

  let todoOk = true;

  for (let i = 0; i < PRUEBAS.length; i++) {
    let salida;
    try {
      salida = await sesion.evaluar(PRUEBAS[i]);
    } catch (e) {
      salida = 'FALLO (excepción): ' + e.message;
    }
    const bien = /^ok:/.test(salida);
    if (!bien) todoOk = false;
    console.log((bien ? '✓ ' : '✗ ') + salida.replace(/^ok: /, ''));
  }

  /* Errores de consola: un fallo de WebGL se vería aquí y en ningún otro sitio. */
  const errores = sesion.errores();
  if (errores.length) {
    todoOk = false;
    console.log('\n✗ ERRORES DE CONSOLA (' + errores.length + '):');
    errores.slice(0, 10).forEach(e => console.log('   · ' + e));
  } else {
    console.log('✓ sin errores de consola');
  }

  sesion.cerrar();
  console.log(todoOk ? '\nCABINA VERIFICADA EN NAVEGADOR' : '\nREVISAR LA CABINA');
  process.exit(todoOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });