/* ===========================================================================
 * Cliente CDP mínimo, reutilizable
 *
 * `capturar.js` lleva el mismo protocolo pero pensado para recorrer un guion de
 * capturas. Esto expone lo que cualquier comprobación necesita (abrir una
 * página, evaluar JavaScript, leer los errores de consola) para no duplicar el
 * manejo de WebSocket en cada herramienta nueva.
 *
 * Uso:
 *   const cdp = require('./cdp.js');
 *   const s = await cdp.abrir(urlWs);
 *   s.awaitable = await s.evaluar('1 + 1');
 *   s.errores(); s.cerrar();
 * =========================================================================== */
'use strict';
const net = require('net');
const http = require('http');
const crypto = require('crypto');

/* ------------------------------ WebSocket ------------------------------ */
function leerTrama(buf) {
  for (;;) {
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    const op = b0 & 0x0f;
    const enm = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    const ini = off + (enm ? 4 : 0);
    if (buf.length < ini + len) return null;
    const pago = Buffer.from(buf.slice(ini, ini + len));
    if (enm) {
      const mk = buf.slice(off, off + 4);
      for (let k = 0; k < pago.length; k++) pago[k] ^= mk[k & 3];
    }
    return { op: op, texto: pago.toString('utf8'), resto: buf.slice(ini + len) };
  }
}

function enviarTexto(sock, texto) {
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

function pedirJSON(puerto, ruta) {
  return new Promise((ok, mal) => {
    const req = http.get({ host: '127.0.0.1', port: puerto, path: ruta }, r => {
      let s = '';
      r.on('data', d => s += d);
      r.on('end', () => { req.destroy(); try { ok(JSON.parse(s)); } catch (e) { mal(e); } });
    });
    req.on('error', mal);
  });
}

/**
 * Abre una sesión sobre la página dada.
 * Devuelve una promesa con un objeto que sabe evaluar y recoger errores.
 */
function abrir(urlWs, opciones) {
  opciones = opciones || {};
  const u = new URL(urlWs);
  const clave = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(Number(u.port), u.hostname);

  return new Promise((listo, mal) => {
let cola = Buffer.alloc(0);
    let handshook = false;
    let id = 0;
    const pendientes = new Map();
    const consoleErrores = [];
    let cerrado = false;
    /* Los comandos sólo se pueden escribir cuando el túnel WebSocket está
     * establecido: escribir antes se pierde en silencio y la sesión se queda
     * esperando una respuesta que nunca llega. */
    const enEspera = [];

    sock.on('connect', () => {
      sock.write(
        'GET ' + u.pathname + u.search + ' HTTP/1.1\r\n' +
        'Host: ' + u.host + '\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + clave + '\r\n' +
        'Sec-WebSocket-Version: 13\r\n\r\n');
    });

    sock.on('error', e => mal(e));

    sock.on('data', chunk => {
      cola = Buffer.concat([cola, chunk]);
      if (!handshook) {
        const i = cola.indexOf('\r\n\r\n');
        if (i < 0) return;
        cola = cola.slice(i + 4);
        handshook = true;
        /* Ahora sí: vaciar lo que se fue pidiendo antes de tiempo. */
        while (enEspera.length) enviarTexto(sock, enEspera.shift());
      }
      for (;;) {
        const t = leerTrama(cola);
        if (!t) return;
        cola = t.resto;
        if (t.op === 0x9) {            /* ping: hay que contestar */
          const mk = crypto.randomBytes(4);
          const n = Buffer.from(t.texto, 'utf8');
          let cab;
          if (n.length < 126) { cab = Buffer.alloc(2); cab[1] = 0x80 | n.length; }
          else if (n.length < 65536) { cab = Buffer.alloc(4); cab[1] = 0x80 | 126; cab.writeUInt16BE(n.length, 2); }
          else { cab = Buffer.alloc(10); cab[1] = 0x80 | 127; cab.writeBigUInt64BE(BigInt(n.length), 2); }
          cab[0] = 0x8a;
          sock.write(Buffer.concat([cab, mk, n]));
          continue;
        }
        if (t.op !== 0x1) continue;
        let msg;
        try { msg = JSON.parse(t.texto); } catch (e) { continue; }
        /* Los errores de consola llegan como eventos, no como respuesta. */
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params &&
            msg.params.type === 'error')
          consoleErrores.push((msg.params.args || [])
            .map(a => a.value || a.description || a.type).join(' '));
        if (msg.method === 'Runtime.exceptionThrown' && msg.params)
          consoleErrores.push((msg.params.exceptionDetails &&
            (msg.params.exceptionDetails.exception &&
             msg.params.exceptionDetails.exception.description)) ||
            'excepción no detallada');
        if (msg.id && pendientes.has(msg.id)) {
          const p = pendientes.get(msg.id);
          pendientes.delete(msg.id);
          if (msg.error) p.mal(new Error(msg.error.message));
          else p.ok(msg.result);
        }
      }
    });

    function enviar(metodo, params) {
      return new Promise((resp, falla) => {
        if (cerrado) { falla(new Error('sesión cerrada')); return; }
        id++;
        pendientes.set(id, { ok: resp, mal: falla });
        const trama = JSON.stringify({ id: id, method: metodo, params: params || {} });
        if (handshook) enviarTexto(sock, trama);
        else enEspera.push(trama);
      });
    }

    /* Lo primero es habilitar la consola y el Runtime: sin esto no se ven los
     * errores, y un fallo de WebGL pasaría desapercibido. La página ya está
     * cargada (el navegador se abrió con su URL), así que no se navega a menos
     * que se pida otra. */
    enviar('Runtime.enable', {})
      .then(() => {
        if (opciones.url) return enviar('Page.navigate', { url: opciones.url });
      })
      .catch(mal)
      .then(() => {
        listo({
          evaluar: function (expr) {
            return enviar('Runtime.evaluate', {
              expression: expr, returnByValue: true, awaitPromise: true
            }).then(r => {
              if (r && r.exceptionDetails)
                throw new Error(r.exceptionDetails.exception &&
                  r.exceptionDetails.exception.description ||
                  r.exceptionDetails.text);
              return r && r.result ? r.result.value : undefined;
            });
          },
          errores: function () { return consoleErrores.slice(); },
          cerrar: function () {
            cerrado = true;
            try { sock.destroy(); } catch (e) {}
          }
        });
      })
      .catch(mal);
  });
}

module.exports = {
  abrir: abrir,
  pedirJSON: pedirJSON
};