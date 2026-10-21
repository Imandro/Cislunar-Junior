/* ===========================================================================
 * CISLUNAR JUNIOR - Pantalla de arranque y transiciones
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Reimplementacion original de la pantalla de carga, barra de progreso y
 * transiciones de ventana. Codigo y diseno originales de Canon Labs.
 * No usa imagenes ni assets externos: todo se dibuja con canvas y CSS.
 * =========================================================================== */
(function (root) {
  'use strict';

  var doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  /* =======================================================================
   * ESTILOS DE LA PANTALLA DE ARRANQUE
   * ==================================================================== */
  var CSS = [
    '#cj-boot{position:fixed;inset:0;z-index:9999;background:#03050a;display:flex;',
    'flex-direction:column;align-items:center;justify-content:center;gap:18px;',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#8fc9ff;',
    'transition:opacity .55s ease;font-family:system-ui,sans-serif}',
    '#cj-boot.oculto{opacity:0;pointer-events:none}',
    '#cj-boot canvas{border-radius:12px}',
    '#cj-boot .titulo{font-size:clamp(22px,4vw,34px);font-weight:700;letter-spacing:.14em;',
    'background:linear-gradient(90deg,#fff,#8fc9ff);-webkit-background-clip:text;',
    'background-clip:text;color:transparent;text-align:center}',
    '#cj-boot .sub{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#5b7fa5}',
    '#cj-boot .barra{width:min(320px,80vw);height:4px;background:#16283d;border-radius:4px;overflow:hidden}',
    '#cj-boot .barra i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#5cb8ff,#8fc9ff);',
    'transition:width .18s ease;box-shadow:0 0 8px #5cb8ff}',
    '#cj-boot .pct{font-size:11px;letter-spacing:.2em;color:#5b7fa5;font-variant-numeric:tabular-nums}',
    '#cj-boot .marca{position:absolute;bottom:22px;font-size:12px;letter-spacing:.18em;color:#3d5a7a}',
    '#cj-boot .hint{font-size:11px;color:#3d5a7a;letter-spacing:.08em;text-align:center;max-width:80vw}'
  ].join('');

  /* =======================================================================
   * ESTADO
   * ==================================================================== */
  var nodo = null, canvas = null, ctx = null, progreso = 0, destino = 0;
  var animId = null, t0 = 0, msgActual = '', resuelto = null;
  var textosCarga = null;

  /* =======================================================================
   * DIBUJO DEL EMBLEMA (estrella orbital, original)
   * ==================================================================== */
  function pintar(t) {
    if (!ctx) return;
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2;

    // rejilla radial sutil
    ctx.strokeStyle = 'rgba(92,184,255,.10)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, 26 * i, 0, Math.PI * 2); ctx.stroke();
    }

    // planeta central
    var g = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 22);
    g.addColorStop(0, '#2a6bb0'); g.addColorStop(1, '#0a1c33');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(92,184,255,.6)'; ctx.stroke();

    // orbita eliptica + satelite girando
    var ang = t / 1000;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.42);
    ctx.strokeStyle = 'rgba(143,201,255,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2); ctx.stroke();
    // satelite
    var sx = Math.cos(ang) * 46, sy = Math.sin(ang) * 16;
    ctx.rotate(0.42);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    // haz del satelite
    ctx.strokeStyle = 'rgba(143,201,255,.25)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.restore();

    // estrella fugaz ocasional
    if (Math.random() > 0.985) {
      var sx2 = Math.random() * w, sy2 = Math.random() * h * 0.6;
      var fg = ctx.createLinearGradient(sx2, sy2, sx2 + 40, sy2 + 40);
      fg.addColorStop(0, 'rgba(255,255,255,.8)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = fg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(sx2 + 40, sy2 + 40); ctx.stroke();
    }
  }

  /* =======================================================================
   * BUCLE DE ANIMACION
   * ==================================================================== */
  function bucle(t) {
    animId = requestAnimationFrame(bucle);
    progreso += (destino - progreso) * 0.06;
    pintar(t);
    if (nodo) {
      var barra = nodo.querySelector('.barra i');
      var pct = nodo.querySelector('.pct');
      var msg = nodo.querySelector('.msg');
      if (barra) barra.style.width = progreso.toFixed(1) + '%';
      if (pct) pct.textContent = Math.round(progreso) + '%';
      if (msg && msgActual) msg.textContent = msgActual;
    }
    // Cuando la barra llega al final, se resuelve la promesa de arranque
    if (resuelto && progreso >= 99.4) {
      progreso = 100;
      var fn = resuelto; resuelto = null;
      fn();
    }
  }

  /* =======================================================================
   * API PUBLICA
   * ==================================================================== */

  /** Monta la pantalla de arranque. Devuelve una promesa que resuelve al terminar. */
  function arrancar(opciones) {
    opciones = opciones || {};
    textosCarga = opciones.pasos || [
      'Iniciando sistema de vuelo',
      'Cargando datos orbitales',
      'Preparando módulos de misión',
      'Calibrando instrumentos',
      'Listo para launching'
    ];

    // estilos
    if (!doc.getElementById('cj-boot-css')) {
      var st = doc.createElement('style');
      st.id = 'cj-boot-css';
      st.textContent = CSS;
      doc.head.appendChild(st);
    }

    // estructura
    nodo = doc.createElement('div');
    nodo.id = 'cj-boot';
    canvas = doc.createElement('canvas');
    canvas.width = 150; canvas.height = 150;
    ctx = canvas.getContext && canvas.getContext('2d');
    nodo.appendChild(canvas);
    var d = doc.createElement('div'); d.className = 'titulo'; d.textContent = 'CISLUNAR JUNIOR';
    var s = doc.createElement('div'); s.className = 'sub'; s.textContent = 'Cañon Labs';
    var barra = doc.createElement('div'); barra.className = 'barra'; barra.innerHTML = '<i></i>';
    var pct = doc.createElement('div'); pct.className = 'pct'; pct.textContent = '0%';
    var msg = doc.createElement('div'); msg.className = 'msg'; msg.style.cssText = 'font-size:11px;color:#5b7fa5;letter-spacing:.06em';
    var hint = doc.createElement('div'); hint.className = 'hint';
    hint.textContent = opciones.hint || 'Simulador de decisiones de misión espacial · NASA Space Apps 2026';
    var marca = doc.createElement('div'); marca.className = 'marca'; marca.textContent = 'CAÑON LABS';
    nodo.appendChild(d); nodo.appendChild(s); nodo.appendChild(barra);
    nodo.appendChild(pct); nodo.appendChild(msg); nodo.appendChild(hint); nodo.appendChild(marca);
    doc.body.appendChild(nodo);

    progreso = 0; destino = 0; t0 = Date.now();
    if (!animId) animId = requestAnimationFrame(bucle);

    // El texto del mensaje avanza por pasos mientras carga
    var i = 0; msgActual = textosCarga[0];
    var tick = setInterval(function () {
      i++;
      destino = (i / textosCarga.length) * 100;
      msgActual = textosCarga[Math.min(i, textosCarga.length - 1)];
      if (destino >= 100 && i >= textosCarga.length) clearInterval(tick);
    }, 260);

    // Promesa: se resuelve cuando el progreso alcanza 100
    // Red de seguridad: si requestAnimationFrame se pausa (pestana oculta,
    // ahorro de energia, navegador sin compositor), la carga se completa igual.
    return new Promise(function (resolve) {
      var listo = false;
      var seguro = null;
      resuelto = function () {
        if (listo) return;
        listo = true;
        clearInterval(tick);
        if (seguro) clearTimeout(seguro);
        progreso = 100;
        resolve();
      };
      seguro = setTimeout(function () { resuelto(); }, 280 * textosCarga.length + 900);
    });
  }

  /** Oculta la pantalla de arranque con un desvanecido. */
  function ocultar() {
    return new Promise(function (resolve) {
      if (!nodo) return resolve();
      destino = 100;
      // fuerza al 100 y espera un instante para que se vea completo
      progreso = 100;
      setTimeout(function () {
        nodo.classList.add('oculto');
        setTimeout(function () {
          if (animId) cancelAnimationFrame(animId);
          animId = null;
          if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
          nodo = null;
          resolve();
        }, 600);
      }, 350);
    });
  }

  /** Atajo: arranca la carga, ejecuta una tarea, y oculta. */
  function cargar(tarea, opciones) {
    return arrancar(opciones).then(function () {
      // Simula el trabajo real de carga
      return new Promise(function (r) { setTimeout(r, 60); });
    }).then(function () {
      if (typeof tarea === 'function') tarea();
      return ocultar();
    });
  }

  var BOOT = {
    arrancar: arrancar,
    ocultar: ocultar,
    cargar: cargar,
    _pintar: pintar
  };

  var CJ = root.CJ || (root.CJ = {});
  CJ.BOOT = BOOT;

})(typeof window !== 'undefined' ? window : this);