/* ===========================================================================
 * CISLUNAR JUNIOR - CABINA
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Panel de instrumentos del simulador. Dos piezas:
 *
 *   CJ.CAB.html()           marca del panel, lista para insertar en el DOM
 *   CJ.CAB.actualizar(n,d)  rellena el panel con las lecturas del vuelo
 *   CJ.CAB.reticula(X,w,h,d) pinta la retícula y los datos sobre el visor
 *
 * El módulo no guarda estado propio ni toca el DOM por su cuenta: recibe el
 * nodo y los datos, de modo que se puede probar con cualquier objeto plano.
 * Codigo original de Canon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  var doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  var NM = ['Soporte vital', 'Energía', 'Protección radiación', 'Agua y alimento', 'Propelente'];
  var NC = ['#0b6fb8', '#c26a00', '#7b4fc9', '#0f8a8a', '#b3261e'];

  /* =======================================================================
   * UTILIDADES
   * ==================================================================== */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(v, dec) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    var s = v.toFixed(dec == null ? 1 : dec);
    return s.replace('.', ',');          // coma decimal, como escribe la misión
  }

  function q(nodo, sel) { return nodo.querySelector ? nodo.querySelector(sel) : null; }

  function pon(nodo, sel, txt) {
    var e = q(nodo, sel);
    if (e) e.textContent = txt;
  }

  /* =======================================================================
   * MARCA DEL PANEL
   * ==================================================================== */
  function html() {
    return '' +
      '<div class="cab">' +
        '<div class="cabg"><span class="lbl">Altitud</span>' +
          '<b class="v alt">—</b><span class="un">km</span></div>' +
        '<div class="cabg"><span class="lbl">Velocidad</span>' +
          '<b class="v vel">—</b><span class="un">km/s</span></div>' +
        '<div class="cabg"><span class="lbl">Δv reservado</span>' +
          '<b class="v dv">—</b><span class="un">m/s</span></div>' +
        '<div class="cabg"><span class="lbl">Fase</span>' +
          '<b class="v fs">—</b><span class="un met">—</span></div>' +
        '<div class="cabbars"></div>' +
        '<div class="cabal"><span class="ok">Sistemas nominales</span></div>' +
      '</div>';
  }

  /* =======================================================================
   * ACTUALIZACIÓN DEL PANEL
   * d = {fase, met, alt, vel, dv, res:[5], alerta}
   * ==================================================================== */
  function actualizar(nodo, d) {
    if (!nodo || !d) return;

    pon(nodo, '.alt', num(d.alt, d.alt >= 100 ? 0 : 1));
    pon(nodo, '.vel', num(d.vel, 2));
    pon(nodo, '.dv', typeof d.dv === 'number' ? String(Math.round(d.dv)) : '—');
    pon(nodo, '.fs', d.fase == null ? '—' : String(d.fase));
    pon(nodo, '.met', d.met == null ? '' : String(d.met));

    var bars = q(nodo, '.cabbars');
    if (bars) {
      var res = d.res || [0, 0, 0, 0, 0], h = '', i;
      for (i = 0; i < 5; i++) {
        var v = Math.max(0, Math.min(100, Math.round(res[i] || 0)));
        h += '<div class="cbar' + (v <= 22 ? ' low' : '') + '" title="' + esc(NM[i]) + ' ' + v + ' / 100">' +
             '<i style="height:' + v + '%;background:' + NC[i] + '"></i>' +
             '<span>' + esc(NM[i].slice(0, 3)) + '</span></div>';
      }
      bars.innerHTML = h;
    }

    var al = q(nodo, '.cabal');
    if (al) {
      if (d.alerta) {
        al.className = 'cabal warn';
        al.innerHTML = '<b>' + esc(d.alerta) + '</b>';
      } else {
        al.className = 'cabal';
        al.innerHTML = '<span class="ok">Sistemas nominales</span>';
      }
    }
  }

  /* =======================================================================
   * RETÍCULA SOBRE EL VISOR
   * ==================================================================== */
  function reticula(X, W, H, d, camMode) {
    if (!X || !d) return;
    X.save();

    var m = 14, b = 24, i;
    X.lineWidth = 1;
    X.strokeStyle = d.alerta ? 'rgba(255,107,97,.75)' : 'rgba(143,201,255,.35)';

    /* esquinas del encuadre */
    var esq = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
    for (i = 0; i < esq.length; i++) {
      var e = esq[i];
      X.beginPath();
      X.moveTo(e[0] + e[2] * b, e[1]); X.lineTo(e[0], e[1]); X.lineTo(e[0], e[1] + e[3] * b);
      X.stroke();
    }

    /* retículo central */
    var cx = Math.round(W / 2), cy = Math.round(H / 2);
    X.strokeStyle = 'rgba(143,201,255,.5)';
    X.beginPath(); X.arc(cx, cy, 16, 0, 6.2832); X.stroke();
    X.beginPath();
    X.moveTo(cx - 32, cy); X.lineTo(cx - 11, cy);
    X.moveTo(cx + 11, cy); X.lineTo(cx + 32, cy);
    X.moveTo(cx, cy - 32); X.lineTo(cx, cy - 11);
    X.moveTo(cx, cy + 11); X.lineTo(cx, cy + 32);
    X.stroke();
    X.fillStyle = 'rgba(143,201,255,.75)';
    X.beginPath(); X.arc(cx, cy, 1.7, 0, 6.2832); X.fill();

    /* indicador de modo cámara (esquina superior izquierda) */
    if (camMode) {
      X.font = '500 10px ui-monospace,Consolas,monospace';
      X.textAlign = 'left'; X.textBaseline = 'top';
      var modoTxt = camMode === 'free' ? '🕹️ LIBRE' : '🎯 ORBITAL';
      var w = X.measureText(modoTxt).width;
      X.fillStyle = 'rgba(4,8,14,.55)';
      X.fillRect(m - 2, m - 2, w + 8, 16);
      X.fillStyle = camMode === 'free' ? '#ffb547' : '#8fc9ff';
      X.fillText(modoTxt, m + 2, m);
    }

    /* lecturas en la esquina superior derecha */
    var lineas = [
      'ALT ' + num(d.alt, d.alt >= 100 ? 0 : 1) + ' km',
      'VEL ' + num(d.vel, 2) + ' km/s',
      '\u0394v  ' + (typeof d.dv === 'number' ? Math.round(d.dv) : '\u2014') + ' m/s'
    ];
    X.font = '600 11px ui-monospace,Consolas,monospace';
    X.textAlign = 'right'; X.textBaseline = 'top';
    var y = m + 2;
    for (i = 0; i < lineas.length; i++) {
      var w = X.measureText(lineas[i]).width;
      X.fillStyle = 'rgba(4,8,14,.55)';
      X.fillRect(W - m - w - 9, y - 2, w + 9, 15);
      X.fillStyle = '#8fc9ff';
      X.fillText(lineas[i], W - m - 4, y);
      y += 17;
    }

    /* aviso crítico */
    if (d.alerta) {
      var t = 0;
      try { t = (root.performance && root.performance.now()) || 0; } catch (err) { t = 0; }
      if (Math.sin(t / 210) > -0.25) {
        X.fillStyle = 'rgba(255,107,97,.95)';
        X.font = '700 12px system-ui,sans-serif';
        X.textAlign = 'center'; X.textBaseline = 'alphabetic';
        X.fillText(String(d.alerta), cx, H - 54);
      }
    }

    X.restore();
  }

  var API = { html: html, actualizar: actualizar, reticula: reticula, nombres: NM };
  root.CJ = root.CJ || {};
  root.CJ.CAB = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : this);
