/* ===========================================================================
 * CAPTURADOR CDP SIN DEPENDENCIAS - Canon Labs
 *
 * Habla con Brave/Chrome por el protocolo de depuración remota usando solo
 * net, http y crypto de Node (sin npm, sin librería WebSocket externa). Sirve
 * para verificar el simulador en un navegador real: captura PNG y recoge los
 * errores de consola, que es justo lo que el arnés con DOM simulado no puede
 * comprobar.
 *
 *   1. levantar el navegador:
 *        brave --headless=new --remote-debugging-port=9333 --user-data-dir=TMP about:blank
 *   2. levantar el proyecto:
 *        python -m http.server 8899 --bind 127.0.0.1
 *   3. capturar:
 *        node tools/capturar.js tools/guion_capturas.json
 *
 * El guion es un JSON:
 *   { "puerto": 9333, "url": "http://...", "ancho": 1280, "alto": 900,
 *     "salida": "carpeta",
 *     "pasos": [ {"espera":3000, "salida":"a.png"},
 *                {"js":"nuevaPartida(0)", "salida":"b.png"} ] }
 * =========================================================================== */
'use strict';
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ------------------------------ WebSocket ------------------------------ */
function wsAbrir(url, alMenosUnFrame) {
  const u = new URL(url);
  const clave = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(Number(u.port), u.hostname);
  const lector = crearLector(alMenosUnFrame);
  let handshook = false, cola = Buffer.alloc(0);

  sock.on('connect', () => {
    sock.write(
      'GET ' + u.pathname + u.search + ' HTTP/1.1\r\n' +
      'Host: ' + u.host + '\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Key: ' + clave + '\r\n' +
      'Sec-WebSocket-Version: 13\r\n\r\n');
  });

  sock.on('data', d => {
    cola = Buffer.concat([cola, d]);
    if (!handshook) {
      const i = cola.indexOf('\r\n\r\n');
      if (i < 0) return;
      const cab = cola.slice(0, i).toString('utf8');
      if (!/^HTTP\/1\.1 101/.test(cab)) {
        console.error('Enlace WebSocket rechazado: ' + cab.split('\r\n')[0]);
        process.exit(1);
      }
      const resto = cola.slice(i + 4);
      cola = Buffer.alloc(0);
      handshook = true;
      if (resto.length) lector(resto);
      return;
    }
    lector(d);
  });

  sock.on('error', e => { console.error('ERROR de socket: ' + e.message); process.exit(1); });
  return sock;
}

function crearLector(onMensaje) {
  let buf = Buffer.alloc(0);
  return function feed(chunk) {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1];
      const op = b0 & 0x0f;
      const enm = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const ini = off + (enm ? 4 : 0);
      if (buf.length < ini + len) return;
      const pago = Buffer.from(buf.slice(ini, ini + len));
      if (enm) {
        const mk = buf.slice(off, off + 4);
        for (let k = 0; k < pago.length; k++) pago[k] ^= mk[k & 3];
      }
      buf = buf.slice(ini + len);
      onMensaje(op, pago);
    }
  };
}

/** Envía un texto como trama de texto enmascarada (obligatorio en cliente). */
function wsTexto(sock, texto) {
  const data = Buffer.from(texto, 'utf8');
  const mk = crypto.randomBytes(4);
  let cab;
  if (data.length < 126) { cab = Buffer.alloc(2); cab[1] = 0x80 | data.length; }
  else if (data.length < 65536) { cab = Buffer.alloc(4); cab[1] = 0x80 | 126; cab.writeUInt16BE(data.length, 2); }
  else { cab = Buffer.alloc(10); cab[1] = 0x80 | 127; cab.writeBigUInt64BE(BigInt(data.length), 2); }
  cab[0] = 0x81;
  const enm = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) enm[i] = data[i] ^ mk[i & 3];
  sock.write(Buffer.concat([cab, mk, enm]));
}

/** Responde al ping del navegador con un pong idéntico. */
function wsPong(sock, pago) {
  const mk = crypto.randomBytes(4);
  let cab;
  if (pago.length < 126) { cab = Buffer.alloc(2); cab[1] = 0x80 | pago.length; }
  else { cab = Buffer.alloc(4); cab[1] = 0x80 | 126; cab.writeUInt16BE(pago.length, 2); }
  cab[0] = 0x8a;
  const enm = Buffer.alloc(pago.length);
  for (let i = 0; i < pago.length; i++) enm[i] = pago[i] ^ mk[i & 3];
  sock.write(Buffer.concat([cab, mk, enm]));
}

/* --------------------------------- CDP --------------------------------- */
function pedirJSON(puerto, ruta) {
  return new Promise((ok, mal) => {
    const req = http.get({ host: '127.0.0.1', port: puerto, path: ruta }, r => {
      let s = '';
      r.on('data', d => s += d);
      r.on('end', () => { req.destroy(); try { ok(JSON.parse(s)); } catch (e) { mal(e); } });
    });
    req.on('error', mal);
    req.setTimeout(8000, () => { req.destroy(); mal(new Error('sin respuesta en ' + ruta)); });
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const guionRuta = process.argv[2];
  if (!guionRuta) { console.error('Uso: node tools/capturar.js <guion.json>'); process.exit(1); }
  const guion = JSON.parse(fs.readFileSync(guionRuta, 'utf8').replace(/^﻿/, ''));
  const puerto = guion.puerto || 9333;
  const salidaDir = guion.salida || '.';
  if (!fs.existsSync(salidaDir)) fs.mkdirSync(salidaDir, { recursive: true });

  /* la pestaña ya existe: se lanza el navegador con la URL como argumento */
  const lista = await pedirJSON(puerto, '/json/list');
  const pagina = (lista || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl) ||
                 (lista || [])[0];
  if (!pagina || !pagina.webSocketDebuggerUrl) {
    console.error('No hay ninguna pestaña depurable en el puerto ' + puerto +
                  '. Lanza el navegador con --remote-debugging-port=' + puerto + '.');
    process.exit(1);
  }

  let nid = 0;
  const pend = new Map();
  const errores = [];
  const avisos = [];

  const lectorJSON = txt => {
    let obj;
    try { obj = JSON.parse(txt); } catch (e) { return; }
    if (obj.id && pend.has(obj.id)) {
      const p = pend.get(obj.id); pend.delete(obj.id);
      if (obj.error) p.mal(new Error(obj.error.message)); else p.ok(obj.result);
      return;
    }
    if (obj.method === 'Runtime.consoleAPICalled') {
      const t = obj.params.type;
      const txt2 = (obj.params.args || []).map(a =>
        a.value !== undefined ? String(a.value) : (a.description || a.type || '')).join(' ');
      if (t === 'error' || t === 'warning') errores.push('[' + t + '] ' + txt2);
      else avisos.push(txt2);
    } else if (obj.method === 'Runtime.exceptionThrown') {
      const d2 = obj.params.exceptionDetails || {};
      errores.push('EXCEPCIÓN: ' + (d2.exception && d2.exception.description
        ? d2.exception.description : d2.text));
    } else if (obj.method === 'Log.entryAdded') {
      const e = obj.params.entry || {};
      if (e.level === 'error') errores.push('[log] ' + e.text + (e.url ? '  ' + e.url : ''));
    }
  };

  const sock = wsAbrir(pagina.webSocketDebuggerUrl, (op, pago) => {
    if (op === 0x1) lectorJSON(pago.toString('utf8'));
    else if (op === 0x9) wsPong(sock, pago);
    else if (op === 0x8) { console.error('El navegador cerró la conexión.'); process.exit(1); }
  });

  const enviar = (metodo, params) => new Promise((ok, mal) => {
    const id = ++nid;
    pend.set(id, { ok, mal });
    wsTexto(sock, JSON.stringify({ id, method: metodo, params: params || {} }));
    setTimeout(() => {
      if (pend.has(id)) { pend.delete(id); mal(new Error('sin respuesta a ' + metodo)); }
    }, 30000);
  });

  await dormir(150);                 // dejar terminar el enlace
  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Log.enable');
  /* Sin caché: si no, al recargar la misma URL el navegador reutiliza la copia
   * en memoria y los cambios en HTML/JS no llegan a la captura. */
  await enviar('Network.enable');
  await enviar('Network.setCacheDisabled', { cacheDisabled: true });
  await enviar('Emulation.setDeviceMetricsOverride',
    { width: guion.ancho || 1280, height: guion.alto || 900, deviceScaleFactor: 1, mobile: false });

  console.log('Navegando a ' + guion.url);
  await enviar('Page.navigate', { url: guion.url });
  await dormir(guion.esperaInicial || 4500);

  for (const paso of guion.pasos || []) {
    if (paso.js) {
      const r = await enviar('Runtime.evaluate',
        { expression: paso.js, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        errores.push('EVAL «' + paso.js.slice(0, 70) + '» → ' +
          (r.exceptionDetails.exception && r.exceptionDetails.exception.description
            ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
      } else if (guion.verbose && r.result && r.result.value !== undefined) {
        console.log('  ⇒ ' + JSON.stringify(r.result.value).slice(0, 300));
      }
    }
    if (paso.espera) await dormir(paso.espera);
    if (paso.salida) {
      /* Sin requestAnimationFrame el compositor no presenta el lienzo nuevo:
       * la captura saldría con el fotograma anterior. Un repintado mínimo
       * del DOM lo obliga a componer. */
await enviar('Runtime.evaluate', {
        expression: [
          '(function(){',
          '  var c = document.getElementById("gl");',
          '  var g = c && (c.getContext("webgl") || c.getContext("experimental-webgl"));',
          '  if (g) {',
          '    g.finish();',
          '    if (typeof g.commit === "function") { try { g.commit(); } catch (e) {} }',
          '  }',
          '  var b = document.body;',
          '  b.style.transform = "translateZ(" + Math.random() + ")";',
          '  b.offsetHeight;',
          '  b.style.transform = "";',
          '  b.offsetHeight;',
          '  return 1;',
          '})()'
        ].join('\n')
      }).catch(() => {});
      const shot = await enviar('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(salidaDir, paso.salida), buf);
      console.log('  capturado ' + paso.salida + ' (' + Math.round(buf.length / 1024) + ' KB)');
    }
  }

  console.log('\n--- avisos de consola (' + avisos.length + ') ---');
  avisos.slice(0, 12).forEach(a => console.log('  ' + a.slice(0, 160)));
  console.log('--- ERRORES (' + errores.length + ') ---');
  if (!errores.length) console.log('  ninguno');
  errores.slice(0, 25).forEach(e => console.log('  ✗ ' + e.slice(0, 240)));
  try { sock.destroy(); } catch (e) {}
  process.exit(errores.length ? 1 : 0);
}

main().catch(e => { console.error('FALLO: ' + e.message); process.exit(1); });
