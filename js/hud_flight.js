/* ===========================================================================
 * CISLUNAR JUNIOR — Paneles de cabina
 * Cañon Labs · NASA Space Apps Challenge 2026
 *
 * Dibuja el contenido de cada monitor físico del habitáculo sobre un lienzo 2D
 * que `CJ.COCKPIT` sube como textura WebGL. Aquí ya no hay HTML: cada panel es
 * una función de dibujo y, además, declara la lista de elementos navegables
 * con teclado y ratón (posición en píxeles de su textura, etiqueta y acción).
 *
 * Las seis pantallas:
 *   TELEMETRÍA   lecturas orbitales, recursos y actitud
 *   COMMS        registro de comunicaciones con filtros
 *   SISTEMAS     estado de los subsistemas y alertas
 *   MAPA         plano orbital con la nave y el objetivo
 *   CHECKLIST    procedimiento de la fase con casillas
 *   CONTROLES    ayuda de teclado, asistencia y modo de vuelo
 * y una pantalla central que se abre sobre el parabrisas para el menú, las
 * decisiones, los ajustes y el informe de misión.
 *
 * El módulo no conoce el estado del juego: lo pide a `fuente()` y llama a las
 * acciones registradas en `acciones()`. Así se puede probar sin arranque.
 * Código original de Cañon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  var CJ = root.CJ || (root.CJ = {});

  /* =======================================================================
   * PALETA
   * Tonos de instrumento: fondo casi negro, rejilla azul apagada y tres
   * colores de estado (nominal / atención / alarma) reused en todos los
   * paneles para que el piloto los lea igual en los seis.
   * ==================================================================== */
  /* Tonos de instrumento. Son pantallas emisivas dentro de un habitáculo oscuro:
   * el fondo va claro a propósito, para que cada panel se distinga del casco
   * negro de la cabina y el texto se lea de un vistazo. */
  var K = {
    bg:      '#070b11',
    panel:   '#101823',
    panel2:  '#182433',
    linea:   '#40536a',
    rejilla: 'rgba(120,200,255,0.065)',
    txt:     '#f0f6ff',
    txt2:    '#b6c6dc',
    txt3:    '#8496ae',
    ac:      '#8fd2ff',
    ok:      '#6fe8a8',
    wn:      '#ffca6a',
    bd:      '#ff9188',
    violeta: '#c9aeff',
    foco:    '#ffeb95'
  };

  /* ----------------------------------------------------------------------
   * Superficie de compatibilidad con la Academia (y con pruebas antiguas).
   * `academia.js` fue escrito contra un HUD previo que exponía `colors`,
   * `init(canvas)` y `draw(...)`. Ese HUD fue sustituido por el pintado de
   * monitores (`pintar`), pero la academia sigue referenciando la API vieja.
   * Se reexpone una superficie mínima: `colors` para las tintas y un par de
   * ganchos no-operativos para que nunca lance TypeError.
   * -------------------------------------------------------------------- */
  var colores = {
    fg:   K.txt,   // texto principal
    bg:   K.bg,    // fondo
    ok:   K.ok,    // OK / bueno
    wn:   K.wn,    // aviso
    bd:   K.bd,    // malo / peligro
    ac:   K.ac,    // activo / acento
    muted: K.txt3  // secundario
  };
  var HUD_COMPAT = {
    init: function () { /* sin lienzo propio: se pinta sobre CJ.COCKPIT */ },
    draw: function () { /* idem: no hay lienzo superpuesto */ },
    colors: colores,
    paleta: K
  };

  var F = {
    t:  'bold 15px "Segoe UI", system-ui, sans-serif',
    ts: '11px "Segoe UI", system-ui, sans-serif',
    tb: '11px "Consolas", "SF Mono", monospace',
    tb2:'bold 20px "Consolas", "SF Mono", monospace',
    m:  '12px "Segoe UI", system-ui, sans-serif',
    mb: 'bold 13px "Consolas", "SF Mono", monospace'
  };
  var ESCALA_TEXTO_CENTRAL = 1;

  /** Amplía los textos pequeños del monitor central, no los paneles laterales. */
  function fuenteVisible(f) {
    f = f || F.m;
    if (ESCALA_TEXTO_CENTRAL === 1) return f;
    return String(f).replace(/(\d+(?:\.\d+)?)px/g, function (_, px) {
      var n = parseFloat(px);
      return (n <= 20 ? Math.round(n * ESCALA_TEXTO_CENTRAL) : n) + 'px';
    });
  }

  /* =======================================================================
   * ENTRADA DE DATOS
   * ==================================================================== */
  var fuente = function () {
    return { S: null, M: [], AJ: {}, PH: [], NM: [], NC: [] };
  };
  var acc = {};

  function setFuente(f) { if (typeof f === 'function') fuente = f; }
  function setAcciones(a) { if (a) for (var k in a) acc[k] = a[k]; }
  function setEscalaTexto(v) { ESCALA_TEXTO_CENTRAL = Math.max(1, Math.min(3.2, Number(v) || 1)); }

  /* =======================================================================
   * PRIMITIVAS DE DIBUJO
   * ==================================================================== */
  function fondo(X, w, h, c) {
    X.fillStyle = c || K.bg;
    X.fillRect(0, 0, w, h);
  }

  /** Rejilla de fondo: da la sensación de tubo de rayos. */
  function rejilla(X, w, h, paso) {
    X.strokeStyle = K.rejilla;
    X.lineWidth = 1;
    X.beginPath();
    for (var x = 0; x <= w; x += paso) { X.moveTo(x + 0.5, 0); X.lineTo(x + 0.5, h); }
    for (var y = 0; y <= h; y += paso) { X.moveTo(0, y + 0.5); X.lineTo(w, y + 0.5); }
    X.stroke();
  }

  function caja(X, x, y, w, h, r, borde, relleno) {
    r = Math.min(r == null ? 5 : r, w / 2, h / 2);
    X.beginPath();
    if (X.roundRect) X.roundRect(x, y, w, h, r);
    else X.rect(x, y, w, h);
    if (relleno) { X.fillStyle = relleno; X.fill(); }
    if (borde) { X.strokeStyle = borde; X.lineWidth = 1; X.stroke(); }
  }

  function txt(X, s, x, y, f, c, al, base) {
    X.font = fuenteVisible(f); X.fillStyle = c || K.txt;
    X.textAlign = al || 'left'; X.textBaseline = base || 'top';
    X.fillText(s == null ? '' : String(s), x, y);
  }

  /** Texto que se recorta con puntos suspensivos en vez de salirse. */
  function txtCorta(X, s, x, y, maxw, f, c, al, base) {
    X.font = fuenteVisible(f);
    var t = String(s == null ? '' : s);
    if (X.measureText(t).width <= maxw) {
      X.fillStyle = c || K.txt; X.textAlign = al || 'left'; X.textBaseline = base || 'top';
      X.fillText(t, x, y);
      return;
    }
    var lo = 0, hi = t.length;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (X.measureText(t.slice(0, mid) + '…').width <= maxw) lo = mid; else hi = mid - 1;
    }
    X.fillStyle = c || K.txt; X.textAlign = al || 'left'; X.textBaseline = base || 'top';
    X.fillText(t.slice(0, lo) + '…', x, y);
  }

  /** Reparte un texto en varias líneas que caben en `maxw`. */
  function envolver(X, s, x, y, maxw, lh, f, c, maxL) {
    X.font = fuenteVisible(f); X.fillStyle = c || K.txt2;
    X.textAlign = 'left'; X.textBaseline = 'top';
    var palabras = String(s || '').split(/\s+/), linea = '', lineas = [];
    for (var i = 0; i < palabras.length; i++) {
      var pr = linea ? linea + ' ' + palabras[i] : palabras[i];
      if (X.measureText(pr).width > maxw && linea) { lineas.push(linea); linea = palabras[i]; }
      else linea = pr;
    }
    if (linea) lineas.push(linea);
    if (maxL && lineas.length > maxL) lineas.length = maxL;
    for (i = 0; i < lineas.length; i++) X.fillText(lineas[i], x, y + i * lh);
    return lineas.length;
  }

  function barra(X, x, y, w, h, v, max, col) {
    caja(X, x, y, w, h, h / 2, null, 'rgba(0,0,0,0.55)');
    var t = Math.max(0, Math.min(1, v / (max || 100)));
    if (t > 0) caja(X, x, y, Math.max(h, w * t), h, h / 2, null, col || K.ok);
  }

  function led(X, cx, cy, r, col) {
    X.beginPath(); X.arc(cx, cy, r, 0, Math.PI * 2);
    X.fillStyle = col; X.fill();
  }

  /** Piezas de la retícula táctica: datos densos, con lectura por filas. */
  function bandaEstado(X, x, y, w, etiqueta, valor, col) {
    caja(X, x, y, w, 22, 3, col || K.linea, 'rgba(5,12,20,.55)');
    txt(X, etiqueta, x + 8, y + 5, F.ts, K.txt3);
    txtCorta(X, valor || '—', x + w - 8, y + 4, w * 0.62, F.mb, col || K.txt, 'right');
  }

  function filaTactica(X, x, y, w, h, etiqueta, valor, col, alterna) {
    caja(X, x, y, w, h, 3, 'rgba(101,142,181,.46)', alterna ? 'rgba(14,28,43,.92)' : 'rgba(9,19,31,.90)');
    X.fillStyle = col || K.ac; X.fillRect(x, y, 3, h);
    var lp = Math.max(11, Math.min(15, Math.round(h * 0.18)));
    var vp = Math.max(15, Math.min(30, Math.round(h * 0.34)));
    txtCorta(X, etiqueta, x + 10, y + Math.max(6, h * 0.12), w - 20,
             lp + 'px "Segoe UI", system-ui, sans-serif', K.txt3);
    txtCorta(X, valor, x + w - 10, y + h - Math.max(7, h * 0.10), w - 20,
             'bold ' + vp + 'px "Consolas", "SF Mono", monospace', col || K.txt, 'right', 'bottom');
  }

  function botonTactico(X, mon, it, etiqueta, col) {
    caja(X, it.x, it.y, it.w, it.h, 4, col || K.linea, 'rgba(16,34,52,.72)');
    txt(X, etiqueta, it.x + it.w / 2, it.y + it.h / 2 - 6, F.ts, col || K.txt2, 'center', 'middle');
    cajaFoco(X, mon, it, 0, 0, col || K.foco);
  }

  /** Cabecera común de todos los monitores. */
  function cabecera(X, w, h, titulo, sub, estado, estadoCol) {
    fondo(X, w, h, K.panel);
    if (titulo.indexOf('RUTA') >= 0 || titulo.indexOf('MAPA') >= 0) rejilla(X, w, h, 24);
    var hh = Math.max(50, Math.min(78, Math.round(h * 0.13)));
    caja(X, 0, 0, w, hh, 0, null, '#0b131d');
    X.fillStyle = 'rgba(173,211,243,.14)'; X.fillRect(0, 18, w, 1);
    X.fillStyle = K.ac; X.fillRect(0, 0, 4, hh); X.fillRect(0, hh - 2, w, 2);
    txt(X, 'GNC  /  FLIGHT DISPLAY', 12, 5, F.ts, K.txt3);
    estado = estado || 'SIM'; estadoCol = estadoCol || K.ac;
    led(X, w - 12, 10, 3, estadoCol);
    txt(X, estado, w - 20, 5, F.ts, estadoCol, 'right');
    txt(X, titulo, 12, 27, F.t, K.txt);
    if (sub) txtCorta(X, sub, w - 10, 29, w * 0.42, F.ts, K.ac, 'right');
    return hh;
  }

  /* =======================================================================
   * NAVEGACIÓN: declara los elementos de cada monitor
   * ==================================================================== */
  function idDe(mon) { return mon && mon.id; }

  /** Marca un elemento para teclado y ratón. `acc` es la acción al activar. */
  function item(mon, x, y, w, h, etiqueta, fn, extra) {
    var it = { x: x, y: y, w: w, h: h, t: etiqueta, acc: fn };
    if (extra) for (var k in extra) it[k] = extra[k];
    return it;
  }

  function cajaFoco(X, mon, it, w, h, col) {
    if (!it || !mon) return;
    var l = est.items[mon.id] || [];
    if (l[selDe(mon.id)] !== it) return;
    var g = 4;
    caja(X, it.x - g, it.y - g, it.w + 2 * g, it.h + 2 * g, 6, null, 'rgba(255,226,122,0.10)');
    caja(X, it.x - g, it.y - g, it.w + 2 * g, it.h + 2 * g, 6, col || K.foco, null);
    led(X, it.x - g - 7, it.y + it.h / 2, 3, col || K.foco);
  }

  /* El índice resaltado y el desplazamiento de cada monitor viven en el estado
   * de la cabina, que es quien los consulta el ratón y el teclado. */
  function estDe() {
    return (CJ.COCKPIT && CJ.COCKPIT.estado) ? CJ.COCKPIT.estado : est;
  }
  function selDe(id) { return estDe().sel[id] || 0; }
  function setSelDe(id, i) { estDe().sel[id] = i; }
  function scrollDe(id) { return estDe().scroll[id] || 0; }
  function setScrollDe(id, v) { estDe().scroll[id] = v; }

  var est = { sel: {}, items: {} };

  function setSel(id, i) { setSelDe(id, i); }

  /* =======================================================================
   * TELEMETRÍA
   * ==================================================================== */
  function pTelemetria(X, w, h, mon, d) {
    var hh = cabecera(X, w, h, 'DU2 · VUELO', d.mision + ' · SIMULACIÓN', 'SIM', K.ac);
    var L = d.L, col = 8, completo = !!mon.ampliado, y = hh + 8;
    var todas = [
      ['ALTITUD',    d.altTxt,      K.txt],
      ['VELOCIDAD',  d.velTxt + ' km/s', K.txt],
      ['PERIAPSIS',  d.peTxt,       K.txt],
      ['APOAPSIS',   d.apTxt,       K.txt],
      ['PERÍODO',    d.perTxt,      K.txt],
      ['INCLINACIÓN',d.incTxt + '°', K.txt],
      ['Δv RESTANTE',d.dvTxt + ' m/s', L.dv > 80 ? K.ok : (L.dv > 25 ? K.wn : K.bd)],
      ['FASE ORBITAL', d.faseOrb || '—', K.ac]
    ];
    var lecturas = completo ? todas : [todas[0], todas[1], todas[6], todas[7]];
    var cw = (w - col * 3) / 2, rh = completo ? Math.max(58, Math.min(76, (h - hh - 175) / 4)) :
      Math.max(78, Math.min(116, (h - hh - 210) / 2));
    for (var i = 0; i < lecturas.length; i++) {
      var x = col + (i % 2) * (cw + col), yy = y + Math.floor(i / 2) * rh;
      filaTactica(X, x, yy, cw, rh - 6, lecturas[i][0], lecturas[i][1], lecturas[i][2], i % 2);
    }

    /* recursos */
    var ry = y + Math.ceil(lecturas.length / 2) * rh + 4;
    var resourceH = Math.max(70, h - ry - 8);
    caja(X, 6, ry - 4, w - 12, resourceH, 4, K.linea, 'rgba(8,20,32,.80)');
    txt(X, completo ? 'RECURSOS · RESERVAS DE MISIÓN' : 'RECURSOS CRÍTICOS', 12, ry + 3, F.ts, K.ac);
    var indices = completo ? [0, 1, 2, 3, 4] : [0, 1, 2];
    var rw = (w - 24) / indices.length;
    for (i = 0; i < indices.length; i++) {
      var ri = indices[i], rx = 12 + i * rw, v = d.res[ri];
      var nm = ri, resY = ry + 23;
      txtCorta(X, d.NM[ri], rx, resY, rw - 6, F.ts, K.txt3);
      var c = v > 55 ? K.ok : (v > 25 ? K.wn : K.bd);
      txt(X, Math.round(v) + '%', rx, resY + 18, F.mb, c);
      barra(X, rx, resY + 37, rw - 10, 6, v, 100, c);
      /* Cada recurso abre su pestaña correspondiente en la pantalla central:
       * es el único sitio donde se puede ver el detalle y el porqué. */
      var itR = item(mon, rx - 2, resY, rw - 6, 44, d.NM[ri], (function (n) {
        return function () { if (acc.verRecurso) acc.verRecurso(n); };
      })(nm), { z: 2 });
      cajaFoco(X, mon, itR, w, h);
      d._items.push(itR);
    }
    var ar = Math.max(42, Math.min(completo ? 64 : 108, resourceH * 0.24, w * 0.13));
    var acx = w / 2, acy = Math.min(h - ar - 18, ry + resourceH - ar - 12);
    if (acy > ry + 82) {
      dibujarActitud(X, acx, acy, ar, d.att || [0, 0, 0], d.optimo);
      txt(X, 'DIRECTOR DE ACTITUD · RHC', acx, acy + ar + 5, F.ts, K.txt3, 'center');
    }
  }

  /* =======================================================================
   * COMUNICACIONES
   * ==================================================================== */
  function pComms(X, w, h, mon, d) {
    var S = d.S;
    var hh = cabecera(X, w, h, 'COMUNICACIONES',
                      S && S.unseenComms ? S.unseenComms + ' sin leer' : d.filtraNombre,
                      S && S.unseenComms ? 'NUEVO' : 'ENLACE', S && S.unseenComms ? K.wn : K.ok);
    var y = hh + 6;

    /* filtros navegables */
    var filtros = d.filtros, fx = 8, fh = Math.round(h * 0.10);
    for (var f = 0; f < filtros.length; f++) {
      var act = d.filtro === filtros[f].k;
      var lab = filtros[f].n;
      X.font = fuenteVisible(F.ts);
      var bw = Math.max(40, Math.min(150, X.measureText(lab).width + 16));
      var it = item(mon, fx, y, bw, fh - 3, lab, function (v) {
        if (acc.setFiltro) acc.setFiltro(v);
      }, { tipo: 'opcion', val: d.filtro, opciones: filtros.map(function (x2) { return x2.k; }),
           z: 2 });
      caja(X, fx, y, bw, fh - 3, 4, act ? K.ac : K.linea, act ? 'rgba(92,184,255,0.22)' : null);
      txt(X, lab, fx + bw / 2, y + (fh - 3) / 2 - 6, F.ts, act ? K.txt : K.txt3, 'center', 'middle');
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
      fx += bw + 5;
    }
    y += fh + 6;

    /* registro con desplazamiento y mensajes por el borde */
    var ay = h - Math.round(h * 0.085);
    var lh = mon.ampliado ? 62 : Math.round(h * 0.072);
    var vis = Math.max(1, Math.floor((ay - y - 8) / lh));
    var total = d.lineas.length;
    var off = Math.max(0, Math.min(total - vis, scrollDe(mon.id)));
    setScrollDe(mon.id, off);
    for (var i = 0; i < vis; i++) {
      var L = d.lineas[off + i];
      if (!L) break;
      var yy = y + i * lh;
      if (L.t === 'fase') {
        X.fillStyle = 'rgba(143,210,255,.10)'; X.fillRect(8, yy, w - 18, lh - 2);
        txt(X, L.s, 8, yy + 2, F.ts, K.txt3);
        continue;
      }
      var tc = L.c === 'alerta' ? K.bd : (L.c === 'tripulacion' ? K.ok :
               (L.c === 'sistemas' ? K.wn : (L.c === 'decision' ? K.violeta : K.ac)));
      caja(X, 6, yy, w - 16, lh - 3, 2, 'rgba(89,122,154,.28)', i % 2 ? 'rgba(13,28,43,.68)' : 'rgba(8,18,30,.72)');
      X.fillStyle = tc; X.fillRect(6, yy, 3, lh - 3);
      txt(X, L.tag, 12, yy + 5, F.ts, tc);
      if (mon.ampliado) envolver(X, L.s, 66, yy + 5, w - 78, 17, F.m,
                                L.c === 'alerta' ? K.txt : K.txt2, 3);
      else txtCorta(X, L.s, 56, yy + 1, w - 66, F.m, L.c === 'alerta' ? K.txt : K.txt2);
    }
    if (total > vis) {
      var pista = ay - y - 4, ph = pista * vis / total;
      caja(X, w - 5, y, 3, pista, 1.5, null, 'rgba(92,184,255,0.25)');
      caja(X, w - 5, y + (pista - ph) * off / Math.max(1, total - vis), 3, ph, 1.5, null, K.ac);
    }

    /* acciones al pie */
    caja(X, 6, ay - 4, w - 12, h - ay - 2, 5, K.linea, K.panel2);
    var b1 = item(mon, 10, ay, (w - 26) / 2, h - ay - 10, 'EXPORTAR', function () {
      if (acc.exportar) acc.exportar();
    }, { z: 2 });
    var b2 = item(mon, 16 + (w - 26) / 2, ay, (w - 26) / 2, h - ay - 10, 'FINAL', function () {
      if (acc.commsFin) acc.commsFin();
    }, { z: 2 });
    botonTactico(X, mon, b1, 'EXPORTAR', K.ac);
    botonTactico(X, mon, b2, 'FINAL', K.ac);
    d._items.push(b1, b2);
  }

  /* =======================================================================
   * SISTEMAS
   * ==================================================================== */
  function pSistemas(X, w, h, mon, d) {
    var estadoCol = d.alerta === 'ALARMA' ? K.bd : (d.alerta === 'ATENCIÓN' ? K.wn : K.ok);
    var hh = cabecera(X, w, h, 'DU3 · SISTEMAS', d.alerta || 'NOMINAL', d.alerta || 'NOM', estadoCol);
    var y = hh + 8, completo = !!mon.ampliado;
    var incidencias = d.sistemas.filter(function (s) { return !/^(NOMINAL|SEGURO)$/.test(s.estado); });
    var lista = completo ? d.sistemas : (incidencias.length ? incidencias.slice(0, 4) : d.sistemas.slice(0, 4));
    bandaEstado(X, 8, y, w - 16, 'ALERTAS', d.alertasTxt || 'Sin alertas', d.inc ? K.wn : K.ok);
    y += 29;
    var ay = h - (completo ? 52 : 34), by = ay - 33;
    var rh = Math.max(completo ? 35 : 52, Math.floor((by - y - 6) / Math.max(1, lista.length)));
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      var c = /^(NOMINAL|SEGURO)$/.test(s.estado) ? K.ok :
              (/^(CRÍTICO|ALARMA|ALERTA)$/.test(s.estado) ? K.bd : K.wn);
      filaTactica(X, 8, y, w - 16, rh - 4, s.n,
                  s.estado + (s.v != null ? ' · ' + Math.round(s.v) + '%' : ''), c, i % 2);
      y += rh;
    }
    /* Botonera: la lectura sola es útil, pero desde aquí se salta a la vista de
     * tripulación o al informe de misión sin pasar por la pantalla central. */
    var bw = (w - 22) / 2;
    var b1 = item(mon, 8, by, bw, 28, 'tripulación', function () {
      if (acc.verTripulacion) acc.verTripulacion();
    }, { z: 2 });
    var b2 = item(mon, 14 + bw, by, bw, 28, 'informe', function () {
      if (acc.verInforme) acc.verInforme();
    }, { z: 2 });
    botonTactico(X, mon, b1, 'TRIPULACIÓN', K.ac);
    botonTactico(X, mon, b2, 'INFORME', K.ac);
    cajaFoco(X, mon, b1, w, h); cajaFoco(X, mon, b2, w, h);
    d._items.push(b1, b2);

    if (!completo) {
      txt(X, incidencias.length ? incidencias.length + ' SUBSISTEMAS REQUIEREN ATENCIÓN' : 'TODOS LOS SUBSISTEMAS NOMINALES',
          12, h - 18, F.ts, incidencias.length ? K.wn : K.ok);
    }
  }

  /* =======================================================================
   * MAPA ORBITAL
   * ==================================================================== */
  function dibujarRuta(X, x, y, w, h, d) {
    var zoom = d.zoom || 1, marte = d.m === 3;
    var fs = Math.max(14, Math.min(27, w / 31));
    var p = Math.max(0, Math.min(1, d.progreso || 0));
    X.save();
    X.fillStyle = '#0d192a'; X.fillRect(x, y, w, h);
    X.beginPath(); X.rect(x, y, w, h); X.clip();
    for (var i = 0; i < 28; i++) {
      X.fillStyle = i % 5 ? 'rgba(175,207,242,.23)' : 'rgba(225,240,255,.5)';
      X.fillRect(x + 12 + (i * 79 % Math.max(20, w - 24)),
                 y + 10 + (i * 47 % Math.max(20, h - 20)), 1.5, 1.5);
    }
    function rotulo(s, px, py, col, align) {
      X.font = '600 ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      X.fillStyle = col || K.txt; X.textBaseline = 'top'; X.textAlign = align || 'center';
      X.fillText(s, px, py);
    }
    function circulo(px, py, r, a, b) {
      var gr = X.createRadialGradient(px - r * .3, py - r * .3, 1, px, py, r);
      gr.addColorStop(0, a); gr.addColorStop(1, b);
      X.fillStyle = gr; X.beginPath(); X.arc(px, py, r, 0, Math.PI * 2); X.fill();
    }
    function marcador(px, py) {
      X.fillStyle = K.ac; X.beginPath(); X.arc(px, py, 7, 0, Math.PI * 2); X.fill();
      X.strokeStyle = '#fff'; X.lineWidth = 2; X.beginPath(); X.arc(px, py, 11, 0, Math.PI * 2); X.stroke();
      rotulo('NAVE', px, py - 31, K.txt);
    }
    X.strokeStyle = 'rgba(125,164,205,.37)'; X.lineWidth = 1.4;
    if (marte) {
      var sx = x + w * .47, sy = y + h * .52;
      var R = Math.min(w * .43, h * .44) * zoom;
      var rt = R * .60, rm = R * .91;
      [R * .36, rt, rm].forEach(function (r) {
        X.beginPath(); X.arc(sx, sy, r, 0, Math.PI * 2); X.stroke();
      });
      circulo(sx, sy, Math.max(13, R * .10), '#ffe69a', '#b65e16');
      rotulo('SOL', sx, sy + Math.max(13, R * .10) + 5, K.wn);
      var ea = -.75, ma = 1.78;
      var ex = sx + Math.cos(ea) * rt, ey = sy + Math.sin(ea) * rt;
      var mx = sx + Math.cos(ma) * rm, my = sy + Math.sin(ma) * rm;
      circulo(ex, ey, Math.max(8, R * .065), '#9ad9ff', '#175eab');
      circulo(mx, my, Math.max(8, R * .057), '#ffbd87', '#9c3d24');
      /* Al salir de la Tierra, la nave parte del mismo punto: el rótulo del
       * planeta queda bajo la trayectoria para no invadir el marcador NAVE. */
      rotulo('TIERRA', ex + 14, ey + 10, K.txt2, 'left');
      rotulo('MARTE', mx + 10, my + 3, K.txt2, 'left');
      function punto(t) {
        var a = ea + (ma - ea) * t, r = rt + (rm - rt) * t;
        return [sx + Math.cos(a) * r, sy + Math.sin(a) * r];
      }
      X.setLineDash([6, 6]); X.strokeStyle = 'rgba(255,196,112,.65)'; X.lineWidth = 3;
      X.beginPath(); for (i = 0; i <= 48; i++) {
        var q = punto(i / 48); if (i) X.lineTo(q[0], q[1]); else X.moveTo(q[0], q[1]);
      } X.stroke(); X.setLineDash([]);
      var t = Math.max(0, Math.min(1, (p - .14) / .59));
      X.strokeStyle = K.wn; X.lineWidth = 4; X.beginPath();
      for (i = 0; i <= 48 * t; i++) {
        q = punto(i / 48); if (i) X.lineTo(q[0], q[1]); else X.moveTo(q[0], q[1]);
      }
      q = punto(t); X.lineTo(q[0], q[1]); X.stroke(); marcador(q[0], q[1]);
    } else {
      /* Dejar margen bajo los rótulos: el visor ampliado recorta el borde del canvas. */
      var solX = x + w * .13, solY = y + h * .40;
      var tx = x + w * .40, ty = y + h * .45;
      var lx = x + w * .79, ly = y + h * .27;
      var radio = Math.min(w, h) * zoom;
      X.beginPath(); X.ellipse(solX, solY, w * .27 * zoom, h * .42 * zoom, 0, 0, Math.PI * 2); X.stroke();
      X.beginPath(); X.ellipse(tx, ty, w * .43 * zoom, h * .30 * zoom, -.18, 0, Math.PI * 2); X.stroke();
      circulo(solX, solY, Math.max(12, radio * .055), '#ffe69a', '#b65e16');
      circulo(tx, ty, Math.max(13, radio * .075), '#9ad9ff', '#175eab');
      circulo(lx, ly, Math.max(8, radio * .045), '#e5e8ee', '#626b79');
      rotulo('SOL', solX, solY + 23, K.wn);
      rotulo('TIERRA', tx, ty + 25, K.txt2);
      rotulo('LUNA', lx, ly + 18, K.txt2);
      var avance = d.avance || { ida: Math.max(0, Math.min(1, (p - .12) / .37)),
                                   vuelta: Math.max(0, Math.min(1, (p - .58) / .42)) };
      var vuelta = avance.vuelta > 0;
      var ax = vuelta ? lx : tx, ay = vuelta ? ly : ty;
      var bx = vuelta ? tx : lx, by = vuelta ? ty : ly;
      var controlX = x + w * .59, controlY = vuelta ? y + h * .84 : y + h * .06;
      X.setLineDash([6, 6]); X.strokeStyle = 'rgba(255,196,112,.7)'; X.lineWidth = 3;
      X.beginPath(); X.moveTo(ax, ay); X.quadraticCurveTo(controlX, controlY, bx, by); X.stroke(); X.setLineDash([]);
      var f = Math.max(0, Math.min(1, vuelta ? avance.vuelta : avance.ida));
      function bez(t) { var u = 1 - t; return [u*u*ax + 2*u*t*controlX + t*t*bx,
                                                u*u*ay + 2*u*t*controlY + t*t*by]; }
      X.strokeStyle = K.wn; X.lineWidth = 4; X.beginPath();
      for (i = 0; i <= 40 * f; i++) {
        q = bez(i / 40); if (i) X.lineTo(q[0], q[1]); else X.moveTo(q[0], q[1]);
      }
      q = bez(f); X.lineTo(q[0], q[1]); X.stroke(); marcador(q[0], q[1]);
    }
    rotulo('ESQUEMA NO A ESCALA', x + w - 10, y + h - fs - 9, K.txt2, 'right');
    X.restore();
  }

  function pMapa(X, w, h, mon, d) {
    var hh = cabecera(X, w, h, 'DU1 · RUTA', d.m === 3 ? 'TIERRA → MARTE' : 'TIERRA → LUNA', 'ESQ', K.ac);
    var pie = mon.ampliado ? 78 : 64;
    dibujarRuta(X, 8, hh + 8, w - 16, h - hh - pie, d);
    bandaEstado(X, 8, h - pie + 3, w - 16, 'SIGUIENTE HITO', d.evento || 'Ruta de misión', K.ac);
    txtCorta(X, 'TIEMPO DE MISIÓN · ' + (d.tiempo || '—'), 14, h - pie + 29,
             w - 28, F.ts, K.txt2);
    var nombres = ['−', 'CENTRAR', '+'], pasos = [-1, 0, 1], bw = 88;
    for (var z = 0; z < 3; z++) {
      var bx = w - 8 - (3 - z) * (bw + 5);
      var it = item(mon, bx, h - 30, bw, 24, nombres[z], function (paso) {
        if (acc.zoomMapa) acc.zoomMapa(paso);
      }, { z: 3, val: pasos[z] });
      botonTactico(X, mon, it, nombres[z], z === 1 ? K.ac : K.linea);
      d._items.push(it);
    }
  }

  /* =======================================================================
   * CHECKLIST
   * ==================================================================== */
  function pChecklist(X, w, h, mon, d) {
    var S = d.S;
    var hh = cabecera(X, w, h, 'CHECKLIST', d.faseNombre,
                      d.prog.done + '/' + d.prog.total, d.prog.done >= d.prog.total ? K.ok : K.wn);
    var y = hh + 6;
    var p = d.prog;
    bandaEstado(X, 8, y, w - 16, 'PROCEDIMIENTO', p.done + '/' + p.total + ' COMPLETADO', p.done >= p.total ? K.ok : K.ac);
    barra(X, 16, y + 25, w - 32, 6, p.done, Math.max(1, p.total), p.done >= p.total ? K.ok : K.ac);
    y += 38;

    if (!d.items.length) {
      txt(X, 'Sin procedimiento activo', 16, y + 8, F.m, K.txt3);
      txt(X, 'El checklist se carga al entrar en una fase de vuelo manual.',
          16, y + 26, F.ts, K.txt3);
      /* Aun sin lista hay algo que hacer: montar el procedimiento de esta
       * fase, que es justo lo que el piloto echa de menos aquí. */
      var bx = 16, bw2 = (w - 40) / 2;
      var itM = item(mon, bx, y + 52, bw2, 32, 'montar procedimiento', function () {
        if (acc.montarChecklist) acc.montarChecklist();
      }, { z: 2 });
      var itV = item(mon, bx + bw2 + 8, y + 52, bw2, 32, 'ver mapa', function () {
        if (acc.irMonitor) acc.irMonitor('mapa');
      }, { z: 2 });
      botonTactico(X, mon, itM, 'MONTAR PROCEDIMIENTO', K.ac);
      botonTactico(X, mon, itV, 'VER MAPA', K.ac);
      d._items.push(itM, itV);
      return;
    }

    var lh = mon.ampliado ? 48 : 30, vis = Math.floor((h - y - 30) / lh);
    var off = Math.max(0, Math.min(d.items.length - vis, scrollDe(mon.id)));
    setScrollDe(mon.id, off);
    for (var i = 0; i < vis; i++) {
      var paso = d.items[off + i];
      if (!paso) break;
      var yy = y + i * lh;
      var hecho = d.hechos.indexOf(paso.key) >= 0;
      var esAcc = !!paso.accion;
      var nav = item(mon, 10, yy, w - 20, lh - 4, paso.notas,
        (function (key, accion) { return function () {
          if (acc.checklist) acc.checklist(key, accion || null);
        }; })(paso.key, paso.accion),
        { z: esAcc ? 2 : 1, key: paso.key, accion: paso.accion });

      caja(X, 10, yy, w - 20, lh - 4, 4, K.linea,
           hecho ? 'rgba(79,209,139,0.08)' : (esAcc ? 'rgba(255,181,71,0.07)' : K.panel2));
      /* casilla */
      caja(X, 16, yy + 6, 12, 12, 2, hecho ? K.ok : K.txt3, hecho ? 'rgba(79,209,139,0.2)' : null);
      if (hecho) {
        X.strokeStyle = K.ok; X.lineWidth = 2; X.beginPath();
        X.moveTo(18, yy + 12); X.lineTo(21, yy + 15.5); X.lineTo(26, yy + 8); X.stroke();
      }
      if (mon.ampliado) envolver(X, paso.notas, 38, yy + 6, w - 100, 17, F.m,
                                hecho ? K.txt3 : (esAcc ? K.wn : K.txt), 2);
      else txtCorta(X, paso.notas, 34, yy + 6, w - 90,
                    F.m, hecho ? K.txt3 : (esAcc ? K.wn : K.txt));
      if (!paso.requerido) txt(X, 'OPT', w - 16, yy + 7, F.ts, K.txt3, 'right');
      cajaFoco(X, mon, nav, w, h);
      d._items.push(nav);
    }
    var ay = h - 22;
    txt(X, 'ENTER · ejecutar    ESPACIO · confirmar acción', 12, ay, F.ts, K.txt3);
  }

  /* =======================================================================
   * CONTROLES
   * ==================================================================== */
  function pControles(X, w, h, mon, d) {
    var hh = cabecera(X, w, h, 'MANDOS RHC / THC',
                      d.ayuda ? d.ayuda.fase : 'piloto automático', d.asisNombre, d.asisColor);
    var y = hh + 6;

    /* Presentación vertical para el visor ampliado: el panel original es una
     * franja de cabina, mientras que aquí debe ocupar y aprovechar el modelo. */
    if (h > w) {
      var pr = Math.min(92, (w - 40) * 0.22), pcx = w / 2, pcy = y + pr + 8;
      dibujarActitud(X, pcx, pcy, pr, d.att, d.optimo);
      X.fillStyle = K.txt3; X.font = F.ts; X.textAlign = 'center';
      X.fillText('RHC · ACTITUD Y RUMBO', pcx, pcy + pr + 17);
      var rowY = pcy + pr + 30, gap = 8, boxW = (w - 24 - gap) / 2;
      var asisX = 8, thrX = asisX + boxW + gap;
      caja(X, asisX, rowY, boxW, 56, 5, K.linea, K.panel2);
      txt(X, 'ASISTENCIA', asisX + 8, rowY + 7, F.ts, K.txt3);
      txtCorta(X, d.asisNombre, asisX + 8, rowY + 29, boxW - 16, F.mb, d.asisColor);
      var pia = item(mon, asisX, rowY, boxW, 56, 'asistencia', function (v) {
        if (acc.asis) acc.asis(v);
      }, { tipo: 'opcion', val: d.asis, opciones: [0, 1, 2, 3], z: 3 });
      cajaFoco(X, mon, pia, w, h); d._items.push(pia);
      caja(X, thrX, rowY, boxW, 56, 5, K.linea, K.panel2);
      txt(X, 'EMPUJE', thrX + 8, rowY + 7, F.ts, K.txt3);
      txt(X, Math.round(d.throttle * 100) + '%', thrX + 8, rowY + 29, F.mb, K.txt);
      var pit = item(mon, thrX, rowY, boxW, 56, 'empuje', function (v) {
        if (acc.throttle) acc.throttle(v);
      }, { tipo: 'slider', val: d.throttle, min: 0, max: 100, paso: 5, z: 3 });
      cajaFoco(X, mon, pit, w, h); d._items.push(pit);
      var ky = rowY + 67, kw = (w - 24) / 2;
      txt(X, 'MANDO', 12, ky, F.ts, K.ac);
      txt(X, 'ACCIÓN', 12 + kw, ky, F.ts, K.ac);
      ky += 16;
      for (var pk = 0; pk < d.teclas.length && ky < h - 16; pk++) {
        txt(X, d.teclas[pk][0], 12, ky, F.tb, K.ac);
        txtCorta(X, d.teclas[pk][1], 12 + kw, ky, kw - 8, F.ts, K.txt2);
        X.strokeStyle = 'rgba(255,255,255,0.07)'; X.beginPath();
        X.moveTo(12, ky + 14); X.lineTo(w - 12, ky + 14); X.stroke();
        ky += 18;
      }
      return;
    }

    /* mando de actitud: esfera artificial */
    var mr = Math.min(h - y - 12, w * 0.11);
    var mx = 8 + mr, my = y + mr;
    dibujarActitud(X, mx, my, mr, d.att, d.optimo);
    txt(X, 'RHC', mx, my + mr + 3, F.ts, K.ac, 'center');

    /* asistencia */
    var ax = mx + mr + 16, aw = 150;
    caja(X, ax, y, aw, 46, 5, K.linea, K.panel2);
    txt(X, 'ASISTENCIA', ax + 8, y + 6, F.ts, K.txt3);
    txt(X, d.asisNombre, ax + 8, y + 20, F.mb, d.asisColor);
    var itA = item(mon, ax, y, aw, 46, 'asistencia', function (v) {
      if (acc.asis) acc.asis(v);
    }, { tipo: 'opcion', val: d.asis, opciones: [0, 1, 2, 3], z: 3 });
    cajaFoco(X, mon, itA, w, h);
    d._items.push(itA);

    /* velocidad de empuje */
    var tx = ax + aw + 14;
    caja(X, tx, y, w - tx - 8, 46, 5, K.linea, K.panel2);
    txt(X, 'EMPUJE', tx + 8, y + 6, F.ts, K.txt3);
    txt(X, Math.round(d.throttle * 100) + '%', tx + 8, y + 20, F.mb, K.txt);
    var itT = item(mon, tx, y, w - tx - 8, 46, 'empuje', function (v) {
      if (acc.throttle) acc.throttle(v);
    }, { tipo: 'slider', val: d.throttle, min: 0, max: 100, paso: 5, z: 3 });
    cajaFoco(X, mon, itT, w, h);
    d._items.push(itT);

    y += 52;

    /* tabla de teclas */
    var tablaX = mon.ampliado ? ax : 12;
    var cw = mon.ampliado ? 92 : (w - 24) / 2;
    if (mon.ampliado) y = Math.max(y, my + mr + 18);
    txt(X, 'MANDO', tablaX, y, F.ts, K.ac);
    txt(X, 'ACCIÓN', tablaX + cw, y, F.ts, K.ac);
    y += 15;
    for (var i = 0; i < d.teclas.length; i++) {
      if (y > h - 30) break;
      var t = d.teclas[i];
      txt(X, t[0], tablaX, y, F.tb, K.ac);
      txtCorta(X, t[1], tablaX + cw, y, w - tablaX - cw - 12, F.ts, K.txt2);
      X.strokeStyle = 'rgba(255,255,255,0.05)';
      X.beginPath(); X.moveTo(tablaX, y + 13.5); X.lineTo(w - 12, y + 13.5); X.stroke();
      y += mon.ampliado ? 18 : 16;
    }
  }

  /** Esfera artificial con el objetivo fantasma (◇) del piloto automático. */
  function dibujarActitud(X, cx, cy, r, att, opt) {
    X.save();
    X.beginPath(); X.arc(cx, cy, r, 0, Math.PI * 2); X.clip();

    X.translate(cx, cy);
    X.rotate(-(att[2] || 0));
    var off = (att[0] || 0) / (Math.PI / 2) * r;
    var g = X.createLinearGradient(0, -r + off, 0, r + off);
    g.addColorStop(0, '#0d2c50'); g.addColorStop(0.49, '#3f8fd0');
    g.addColorStop(0.51, '#6b4a2c'); g.addColorStop(1, '#241609');
    X.fillStyle = g; X.fillRect(-r, -r, r * 2, r * 2);

    X.strokeStyle = 'rgba(255,255,255,0.85)'; X.lineWidth = 2;
    X.beginPath(); X.moveTo(-r, off); X.lineTo(r, off); X.stroke();

    X.strokeStyle = 'rgba(255,255,255,0.35)'; X.lineWidth = 1;
    X.font = F.ts; X.textAlign = 'center'; X.textBaseline = 'middle';
    for (var p = -80; p <= 80; p += 10) {
      var yy = off + (p / 90) * r;
      var largo = (p % 30 === 0);
      X.beginPath(); X.moveTo(-(largo ? r * 0.45 : r * 0.24), yy);
      X.lineTo(largo ? r * 0.45 : r * 0.24, yy); X.stroke();
      if (largo && p !== 0) {
        X.fillStyle = 'rgba(255,255,255,0.6)';
        X.fillText(String(p), r * 0.66, yy);
      }
    }
    X.restore();

    /* marcas de alabeo en el borde */
    X.strokeStyle = 'rgba(255,255,255,0.5)'; X.lineWidth = 1.5;
    for (var a = -60; a <= 60; a += 15) {
      var rad = (att[2] || 0) + a * Math.PI / 180;
      var largo = (a % 30 === 0) ? 0.82 : 0.90;
      X.beginPath();
      X.moveTo(cx + Math.sin(rad) * r, cy - Math.cos(rad) * r);
      X.lineTo(cx + Math.sin(rad) * r * largo, cy - Math.cos(rad) * r * largo);
      X.stroke();
    }

    /* indicador de actitud (referencia fija) */
    X.strokeStyle = '#ffe27a'; X.lineWidth = 2.5;
    X.beginPath();
    X.moveTo(cx - r * 0.40, cy); X.lineTo(cx - r * 0.14, cy);
    X.moveTo(cx + r * 0.14, cy); X.lineTo(cx + r * 0.40, cy);
    X.stroke();
    X.beginPath(); X.arc(cx, cy, 2.5, 0, Math.PI * 2); X.fillStyle = '#ffe27a'; X.fill();

    /* objetivo fantasma */
    if (opt) {
      var dp = (opt[0] - att[0]) / (Math.PI / 2) * r;
      var dy = (att[2] - opt[2]);
      var ox = cx + (dy || 0) * r * 1.2, oy = cy - dp;
      X.strokeStyle = 'rgba(255,181,71,0.85)'; X.lineWidth = 1.8;
      X.beginPath(); X.moveTo(ox, oy - 6); X.lineTo(ox + 5, oy + 4);
      X.lineTo(ox - 5, oy + 4); X.closePath(); X.stroke();
    }
  }

  /* =======================================================================
   * PANTALLA CENTRAL
   * ==================================================================== */
  function pCentral(X, w, h, mon, d) {
    fondo(X, w, h, K.bg);
    rejilla(X, w, h, 20);
    var t = d.tipo;
    var anterior = ESCALA_TEXTO_CENTRAL;
    ESCALA_TEXTO_CENTRAL = 2;
    try {
      if (t === 'menu')      return cMenu(X, w, h, mon, d);
      if (t === 'panel_mision') return cPanelMision(X, w, h, mon, d);
      if (t === 'mision')    return cMision(X, w, h, mon, d);
      if (t === 'decision')  return root.INMERSIVO && d.panel ? cPanelMision(X, w, h, mon, d.panel) : cDecision(X, w, h, mon, d);
      if (t === 'informe')   return cInforme(X, w, h, mon, d);
      if (t === 'ajustes')   return cAjustes(X, w, h, mon, d);
      if (t === 'academia')  return cAcademia(X, w, h, mon, d);
      if (t === 'lab')       return cLab(X, w, h, mon, d);
      if (t === 'creditos')  return cCreditos(X, w, h, mon, d);
      if (t === 'pausa')     return cPausa(X, w, h, mon, d);
      if (t === 'tripulacion') return cTripulacion(X, w, h, mon, d);
      if (t === 'recursos')   return cRecursos(X, w, h, mon, d);
      if (t === 'informe_previo') return d.panel ? cPanelMision(X, w, h, mon, d.panel) : cInformePrevio(X, w, h, mon, d);
      if (t === 'vacio')     return cVacio(X, w, h, d);
      return cVacio(X, w, h, d);
    } finally {
      ESCALA_TEXTO_CENTRAL = anterior;
    }
  }

  /* Monitor central de misión: telemetría y trayectoria, sin decisiones. */
  function cPanelMision(X, w, h, mon, d) {
    fondo(X, w, h, K.bg);
    rejilla(X, w, h, 32);
    X.fillStyle = 'rgba(5,12,21,.78)'; X.fillRect(14, 12, w - 28, 232);
    txt(X, 'ESTADO DE LA NAVE', 26, 24, 'bold 25px "Segoe UI", system-ui, sans-serif', K.ac);
    txtCorta(X, d.mision + ' · ' + d.fase + ' · ' + d.evento, 26, 49, w - 52, F.m, K.txt2);
    txt(X, 'EVENTO ' + d.progreso, w - 26, 26, F.ts, K.txt3, 'right');

    var tele = d.tele || {}, lect = [
      ['ALTITUD', tele.altTxt || '—'], ['VELOCIDAD', (tele.velTxt || '—') + ' km/s'],
      ['Δv RESTANTE', (tele.dvTxt || '—') + ' m/s']
    ];
    var gap = 10, bx = 26, by = 68, bw = (w - 52 - gap * 2) / 3, bh = 72;
    for (var i = 0; i < lect.length; i++) {
      var x = bx + i * (bw + gap);
      caja(X, x, by, bw, bh, 7, K.linea, K.panel2);
      txt(X, lect[i][0], x + 12, by + 10, F.m, K.txt2);
      txtCorta(X, lect[i][1], x + 12, by + 38, bw - 24, F.tb2, i === 2 ? K.ok : K.txt);
    }

    txt(X, 'RECURSOS', 26, 160, F.m, K.ac);
    var rw = (w - 52) / 5;
    for (i = 0; i < 5; i++) {
      var rv = d.res[i], rc = rv > 55 ? K.ok : (rv > 25 ? K.wn : K.bd), rx = 26 + i * rw;
      txtCorta(X, d.NM[i], rx, 181, rw - 10, F.m, K.txt2);
      txt(X, Math.round(rv) + '%', rx, 204, F.mb, rc);
      barra(X, rx, 218, rw - 16, 8, rv, 100, rc);
    }

    var ruta = d.ruta || {};
    txt(X, 'RUTA · SISTEMA SOLAR', 26, 242, F.ts, K.ac);
    dibujarRuta(X, w * .39, 264, w * .59, h - 294, ruta);

    var hitos = (ruta.puntos || []).slice(0, 4), hx = 26, hy = 278, hw = w * 0.32;
    caja(X, hx, hy, hw, h - hy - 24, 8, K.linea, 'rgba(4,10,18,0.48)');
    txt(X, 'PRÓXIMOS HITOS', hx + 14, hy + 14, F.ts, K.ac);
    for (i = 0; i < hitos.length; i++) {
      var yy = hy + 40 + i * 48;
      if (yy > h - 48) break;
      led(X, hx + 17, yy + 5, 4, i === 0 ? K.ok : K.ac);
      txtCorta(X, hitos[i][0], hx + 31, yy, hw - 44, F.m, K.txt);
      txtCorta(X, hitos[i][1], hx + 31, yy + 19, hw - 44, F.ts, K.txt3);
    }
    txt(X, d.tele && d.tele.faseOrb ? 'FASE · ' + d.tele.faseOrb : 'SISTEMAS · NOMINALES',
        w - 26, h - 18, F.ts, K.txt3, 'right');
  }

  /* --- detalle de un recurso --- */
  function cRecursos(X, w, h, mon, d) {
    var r = d.recurso;
    fondo(X, w, h, K.bg);
    rejilla(X, w, h, 20);
    var i = r.i;
    txt(X, 'RECURSO ' + (i + 1) + ' DE 5', 24, 20, F.ts, K.txt3);
    txt(X, r.n.toUpperCase(), 24, 40, 'bold 30px "Segoe UI", system-ui, sans-serif', r.col);
    var c = r.v > 55 ? K.ok : (r.v > 25 ? K.wn : K.bd);
    txt(X, Math.round(r.v) + '%', w - 24, 40, 'bold 34px "Consolas", monospace', c, 'right');
    barra(X, 24, 84, w - 48, 10, r.v, 100, c);

    txt(X, 'POR QUÉ IMPORTA', 24, 112, F.ts, K.ac);
    envolver(X, r.desc, 24, 132, w - 48, 20, F.m, K.txt2, 4);

    /* Cómo se ha movido cada uno desde el inicio */
    txt(X, 'TODOS LOS RECURSOS', 24, 232, F.ts, K.ac);
    for (var j = 0; j < r.consumo.length; j++) {
      var cc = r.consumo[j], col = cc.v > 55 ? K.ok : (cc.v > 25 ? K.wn : K.bd);
      var y = 254 + j * 32;
      txtCorta(X, cc.n, 24, y + 4, 180, F.m, K.txt);
      barra(X, 220, y + 6, w - 320, 8, cc.v, 100, col);
      txt(X, Math.round(cc.v) + '%', w - 92, y + 2, F.mb, col, 'right');
      txt(X, (cc.delta > 0 ? '+' : '') + cc.delta, w - 24, y + 2, F.tb,
          cc.delta < -8 ? K.bd : (cc.delta < 0 ? K.wn : K.ok), 'right');
    }

    txt(X, r.mission + ' · ' + r.eventos + ' eventos previstos', 24, h - 24, F.ts, K.txt3);
    var b1 = item(mon, 24, h - 56, 180, 40, 'VOLVER', function () {
      if (acc.irDecision) acc.irDecision();
    }, { z: 4 });
    boton(X, b1, 'VOLVER', K.ac);
    d._items.push(b1);
  }

  /* --- informe provisional, antes del desenlace --- */
  function cInformePrevio(X, w, h, mon, d) {
    fondo(X, w, h, K.bg);
    rejilla(X, w, h, 20);
    txt(X, d.titulo, 24, 22, 'bold 26px "Segoe UI", system-ui, sans-serif', K.ac);
    txt(X, d.sub, 24, 54, F.m, K.txt2);

    var cw = (w - 40) / 5;
    for (var i = 0; i < 5; i++) {
      var v = d.res[i], col = v > 55 ? K.ok : (v > 25 ? K.wn : K.bd);
      var x = 20 + i * cw;
      caja(X, x, 84, cw - 6, 66, 6, K.linea, K.panel);
      txtCorta(X, d.NM[i], x + 8, 92, cw - 22, F.ts, K.txt3);
      txt(X, Math.round(v) + '%', x + 8, 110, F.tb2, col);
      barra(X, x + 8, 138, cw - 22, 6, v, 100, col);
    }

    txt(X, d.dec + ' decisiones · ' + d.inc + ' incidentes imprevistos', 24, 166, F.ts, K.txt3);
    txt(X, 'ÚLTIMAS DECISIONES', 24, 194, F.ts, K.ac);
    var y = 216;
    for (i = 0; i < d.decisiones.length && y < h - 90; i++) {
      var dd = d.decisiones[i];
      txt(X, dd.t, 24, y, F.ts, K.txt2);
      txt(X, dd.o, 24, y + 14, F.m, K.txt);
      txt(X, dd.d, w - 24, y + 6, F.ts, dd.dn ? K.bd : K.ok, 'right');
      y += 32;
    }
    if (!d.decisiones.length)
      txt(X, 'Todavía no se ha decidido nada.', 24, y, F.m, K.txt3);

    var bw = (w - 60) / 2;
    var b1 = item(mon, 20, h - 52, bw, 40, 'VOLVER', function () {
      if (acc.irDecision) acc.irDecision();
    }, { z: 4 });
    var b2 = item(mon, 28 + bw, h - 52, bw, 40, 'CONTINUAR', function () {
      if (acc.irDecision) acc.irDecision();
    }, { z: 4 });
    boton(X, b1, 'VOLVER', K.ac); boton(X, b2, 'CONTINUAR', K.ok);
    d._items.push(b1, b2);
  }

  function cVacio(X, w, h, d) {
    txt(X, d.titulo || 'CISLUNAR JUNIOR', w / 2, h / 2 - 10, F.tb2, K.ac, 'center', 'middle');
    txt(X, d.aviso || '', w / 2, h / 2 + 18, F.m, K.txt2, 'center', 'middle');
  }

  /* --- menú principal --- */
  function cMenu(X, w, h, mon, d) {
    txt(X, 'CAÑON LABS · NASA SPACE APPS 2026', w / 2, 26, F.ts, K.txt3, 'center');
    txt(X, 'CISLUNAR JUNIOR', w / 2, 46, 'bold 34px "Segoe UI", system-ui, sans-serif', K.txt, 'center');
    txt(X, 'Simulador de decisiones de misión espacial', w / 2, 82, F.m, K.txt2, 'center');

    var cw = (w - 40) / 2 - 8, ch = 68;
    var y0 = 108;
    for (var i = 0; i < d.misiones.length; i++) {
      var ms = d.misiones[i];
      var x = 20 + (i % 2) * (cw + 16), y = y0 + Math.floor(i / 2) * (ch + 10);
      /* El índice se fija con `let`, no con `var`: las variables de bloque de `let`
     * tienen vida propia por vuelta, de modo que cada tarjeta conserva la suya.
     * Con `var` las cuatro compartían una y Enter arrancaba siempre la última
     * misión de la lista. */
      const cual = i;
      var it = item(mon, x, y, cw, ch, ms.n, function () {
        if (acc.empezar) acc.empezar(cual);
      }, { z: 2, indice: cual });
      caja(X, x, y, cw, ch, 7, K.linea, K.panel);
      caja(X, x, y, 5, ch, 3, null, ms.color);
      txt(X, ms.n, x + 16, y + 10, 'bold 17px "Segoe UI", system-ui, sans-serif', K.txt);
      txt(X, ms.f + ' · ' + ms.d, x + 16, y + 32, F.ts, K.txt2);
      txt(X, ms.v + ' · ' + ms.nEv + ' eventos · ' + ms.nTrip + ' asientos', x + 16, y + 48, F.ts, K.txt3);
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }

    var by = y0 + 2 * (ch + 10) + 12, bw = (w - 60) / 4;
    for (i = 0; i < d.extras.length; i++) {
      /* `ex` también necesita vida propia: con `var`, los cuatro botones del pie
       * (Academia, Laboratorio, Ajustes, Créditos) compartían una variable y
       * todos abrían lo mismo. */
      const ex = d.extras[i];
      var bx = 20 + i * (bw + 6);
      var it2 = item(mon, bx, by, bw, 40, ex.n, function () { if (ex.acc) ex.acc(); }, { z: 2 });
      caja(X, bx, by, bw, 40, 6, K.linea, K.panel2);
      txt(X, ex.n, bx + bw / 2, by + 20, F.m, K.txt2, 'center', 'middle');
      cajaFoco(X, mon, it2, w, h);
      d._items.push(it2);
    }

    /* Mantén las dos líneas dentro del lienzo: con textBaseline=top, la
     * segunda línea anterior empezaba en h-10 y se cortaba por abajo. */
    txt(X, '↑↓ elegir   ENTER seleccionar   F1..F6 monitores   TAB siguiente pantalla   ESC soltar foco',
        w / 2, h - 40, F.ts, K.txt3, 'center');
    txtCorta(X, 'Datos de misión: NASA (Apollo 11, Apollo 13, Artemis II, Marte). Imágenes del dominio público.',
        24, h - 22, w - 48, F.ts, K.txt3, 'center');
  }

  /* --- ficha de misión --- */
  function cMision(X, w, h, mon, d) {
    var ms = d.mision;
    txt(X, ms.n.toUpperCase(), 24, 24, 'bold 26px "Segoe UI", system-ui, sans-serif', K.txt);
    txt(X, ms.f + ' · ' + ms.d, 24, 58, F.m, K.txt2);
    txt(X, ms.v + '  ·  ' + ms.nEv + ' eventos  ·  ' + ms.nTrip + ' asientos',
        24, 80, F.ts, K.txt3);
    X.fillStyle = K.linea; X.fillRect(24, 100, w - 48, 1);

    txt(X, 'RESUMEN', 24, 112, F.ts, K.ac);
    envolver(X, ms.x, 24, 132, w * 0.56, 20, F.m, K.txt2, 6);

    txt(X, 'TRIPULACIÓN', 24, 274, F.ts, K.ac);
    for (var i = 0; i < ms.trip.length; i++) {
      txt(X, (i + 1) + '.', 24, 294 + i * 18, F.ts, K.txt3);
      txt(X, ms.trip[i][0], 40, 294 + i * 18, F.m, K.txt);
      txt(X, ms.trip[i][1], 240, 294 + i * 18, F.ts, K.txt2);
    }

    /* eventos de la misión, columna derecha */
    var cx = w * 0.60;
    txt(X, 'SECUENCIA DE EVENTOS', cx, 112, F.ts, K.ac);
    var ly = 132;
    for (i = 0; i < ms.evs.length && ly < h - 80; i++) {
      txt(X, String(i + 1).padStart(2, '0'), cx, ly, F.tb, K.txt3);
      txt(X, ms.evs[i][0], cx + 26, ly, F.m, K.txt);
      txt(X, ms.evs[i][1], cx + 26, ly + 15, F.ts, K.txt3);
      ly += 32;
    }

    var by = h - 56, bw = (w - 68) / 2;
    var b1 = item(mon, 24, by, bw, 40, 'EMPEZAR', function () { if (acc.empezar) acc.empezar(d.idx); },
                  { z: 3, tipo: 'ok' });
    var b2 = item(mon, 32 + bw, by, bw, 40, 'VOLVER', function () { if (acc.irMenu) acc.irMenu(); },
                  { z: 3 });
    boton(X, b1, 'EMPEZAR', K.ok); boton(X, b2, 'VOLVER', K.ac);
    d._items.push(b1, b2);
  }

  function boton(X, b, txt0, col) {
    caja(X, b.x, b.y, b.w, b.h, 6, col, 'rgba(255,255,255,0.04)');
    txt(X, txt0, b.x + b.w / 2, b.y + b.h / 2 - 8, F.m, col, 'center', 'middle');
  }

  /* --- decisión --- */
  function cDecision(X, w, h, mon, d) {
    var ev = d.ev;
    var crit = d.critico;
    txt(X, d.fase, 22, 18, F.ts, crit ? K.bd : K.ac);
    txtCorta(X, ev.t, 22, 34, w - 44, 'bold 22px "Segoe UI", system-ui, sans-serif', K.txt);
    if (ev.w) {
      caja(X, 22, 64, w - 44, 46, 6, K.bd, 'rgba(255,107,97,0.12)');
      txt(X, '⚠ ' + ev.w[0], 32, 70, F.ts, K.bd);
      txtCorta(X, ev.w[1], 32, 85, w - 68, F.ts, K.txt2);
    }
    var y0 = ev.w ? 122 : 76;

    /* contexto */
    txtCorta(X, ev.c[0] + ': ' + ev.c[1], 22, y0, w - 44, F.m, K.txt2);
    y0 += 24;

    var bh = 62, gap = 8;
    for (var i = 0; i < ev.o.length; i++) {
      var o = ev.o[i], y = y0 + i * (bh + gap);
      var sel = d.eleg === i;
      const cual = i;                 /* vida propia por vuelta */
      var it = item(mon, 20, y, w - 40, bh, o[0], function () {
        if (acc.elegir) acc.elegir(cual);
      }, { z: 3, indice: cual });
      caja(X, 20, y, w - 40, bh, 7, sel ? K.ac : K.linea, sel ? 'rgba(92,184,255,0.14)' : K.panel);
      txt(X, (i + 1) + '.', 32, y + 8, F.mb, sel ? K.ac : K.txt3);
      txtCorta(X, o[0], 54, y + 7, w - 130, F.m, K.txt);
      txtCorta(X, o[3], 54, y + 28, w - 130, F.ts, K.txt3);
      /* delta de recursos */
      var dx = w - 34;
      for (var r = 0; r < 5; r++) {
        var v = o[1][r];
        if (!v) continue;
        txt(X, (v > 0 ? '+' : '') + v, dx, y + 8 + r * 10, F.ts,
            v > 0 ? K.ok : K.bd, 'right');
        dx -= 26;
      }
      txt(X, 'riesgo ' + o[2] + '%', w - 34, y + bh - 16, F.ts,
          o[2] > 30 ? K.bd : (o[2] > 12 ? K.wn : K.txt3), 'right');
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }

    y0 = y0 + ev.o.length * (bh + gap) + 4;
    var by = Math.max(y0, h - 52), bw = (w - 60) / 3;
    var b1 = item(mon, 20, by, bw, 40, 'CONFIRMAR', function () { if (acc.confirmar) acc.confirmar(); },
                  { z: 4, tipo: 'ok' });
    var b2 = item(mon, 26 + bw, by, bw, 40, 'DESHACER', function () { if (acc.deshacer) acc.deshacer(); },
                  { z: 4 });
    var b3 = item(mon, 32 + 2 * bw, by, bw, 40, 'SISTEMAS', function () { if (acc.verSistemas) acc.verSistemas(); },
                  { z: 4 });
    boton(X, b1, 'CONFIRMAR', K.ok); boton(X, b2, 'DESHACER', K.ac); boton(X, b3, 'SISTEMAS', K.txt2);
    d._items.push(b1, b2, b3);
  }

  /* --- informe de misión --- */
  function cInforme(X, w, h, mon, d) {
    var ok = d.ok;
    txt(X, d.titulo, w / 2, 24, 'bold 28px "Segoe UI", system-ui, sans-serif',
        ok ? K.ok : K.bd, 'center');
    txt(X, d.sub, w / 2, 58, F.m, K.txt2, 'center');

    /* recursos finales */
    var cw = (w - 40) / 5, y = 86;
    for (var i = 0; i < 5; i++) {
      var v = d.res[i], c = v > 55 ? K.ok : (v > 25 ? K.wn : K.bd);
      var x = 20 + i * cw;
      caja(X, x, y, cw - 6, 62, 6, K.linea, K.panel);
      txt(X, d.NM[i], x + 8, y + 8, F.ts, K.txt3);
      txt(X, Math.round(v) + '%', x + 8, y + 24, F.tb2, c);
      barra(X, x + 8, y + 48, cw - 22, 6, v, 100, c);
    }

    /* métricas */
    txt(X, 'MÉTRICAS DE VUELO', 20, 166, F.ts, K.ac);
    var my = 186;
    for (i = 0; i < d.metricas.length && i < 7; i++) {
      txt(X, d.metricas[i][0], 20, my + i * 19, F.ts, K.txt3);
      txt(X, d.metricas[i][1], w * 0.46, my + i * 19, F.mb, K.txt, 'right');
      X.strokeStyle = 'rgba(255,255,255,0.05)';
      X.beginPath(); X.moveTo(20, my + i * 19 + 15.5); X.lineTo(w * 0.46, my + i * 19 + 15.5); X.stroke();
    }

    /* registro de decisiones */
    txt(X, 'REGISTRO DE DECISIONES', w * 0.52, 166, F.ts, K.ac);
    var dy = 186;
    for (i = 0; i < d.decisiones.length && dy < h - 70; i++) {
      var dd = d.decisiones[i];
      txt(X, dd.t, w * 0.52, dy, F.ts, K.txt2);
      txt(X, dd.o, w * 0.52, dy + 13, F.m, K.txt);
      txt(X, dd.d, w - 20, dy + 6, F.ts, dd.dn ? K.bd : K.ok, 'right');
      dy += 30;
    }
    if (d.decisiones.length && i < d.decisiones.length) {
      txt(X, '+' + (d.decisiones.length - i) + ' más', w * 0.52, dy, F.ts, K.txt3);
    }

    var by = h - 52, bw = (w - 60) / 2;
    var b1 = item(mon, 20, by, bw, 40, 'REINTENTAR', function () { if (acc.reintentar) acc.reintentar(); },
                  { z: 4, tipo: 'ok' });
    var b2 = item(mon, 28 + bw, by, bw, 40, 'MENÚ', function () { if (acc.irMenu) acc.irMenu(); },
                  { z: 4 });
    boton(X, b1, 'REINTENTAR', K.ok); boton(X, b2, 'MENÚ', K.ac);
    d._items.push(b1, b2);
  }

  /* --- ajustes --- */
  function cAjustes(X, w, h, mon, d) {
    txt(X, 'AJUSTES DE VUELO', 24, 24, 'bold 24px "Segoe UI", system-ui, sans-serif', K.txt);
    txt(X, '← → ajustar   ENTER aceptar', w - 24, 32, F.ts, K.txt3, 'right');
    X.fillStyle = K.linea; X.fillRect(24, 62, w - 48, 1);

    for (var i = 0; i < d.opciones.length; i++) {
      var o = d.opciones[i];
      var y = 82 + i * 56;
      var it = item(mon, 24, y, w - 48, 48, o.n,
        function () { if (acc.ajuste) acc.ajuste(o.k, o.v); },
        { tipo: o.tipo, val: o.v, min: o.min, max: o.max, paso: o.paso,
          opciones: o.opciones, z: 2 });
      caja(X, 24, y, w - 48, 48, 6, null, i % 2 ? K.panel : K.panel2);
      txt(X, o.n, 36, y + 8, F.m, K.txt);
      txt(X, o.desc, 36, y + 26, F.ts, K.txt3);
      if (o.tipo === 'opcion') {
        txt(X, o.etiqueta, w - 36, y + 20, F.mb, K.ac, 'right');
      } else {
        var bw = 180, bx = w - 36 - bw;
        barra(X, bx, y + 20, bw, 8, o.v - (o.min || 0), (o.max || 100) - (o.min || 0), K.ac);
        txt(X, String(o.v), w - 36, y + 6, F.tb, K.txt, 'right');
      }
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }
    var by = h - 50, bw2 = (w - 60) / 2;
    var b1 = item(mon, 24, by, bw2, 40, 'CERRAR', function () { if (acc.cerrarAjustes) acc.cerrarAjustes(); },
                  { z: 4 });
    boton(X, b1, 'CERRAR', K.ac);
    d._items.push(b1);
  }

  /* --- Academia --- */
  function cAcademia(X, w, h, mon, d) {
    txt(X, 'ACADEMIA DE VUELO', 24, 24, 'bold 24px "Segoe UI", system-ui, sans-serif', K.txt);
    txt(X, d.sub, 24, 56, F.m, K.txt2);

    var colW = (w - 60) / 3;
    for (var i = 0; i < d.lecciones.length; i++) {
      var L = d.lecciones[i];
      var x = 20 + (i % 3) * (colW + 10), y = 92 + Math.floor(i / 3) * 96;
      if (y > h - 90) break;
      var it = item(mon, x, y, colW, 86, L.n, function () { if (acc.leccion) acc.leccion(L.idx); },
                    { z: 2, indice: i });
      caja(X, x, y, colW, 86, 7, K.linea, K.panel);
      caja(X, x, y, colW, 4, 2, null, L.color);
      txtCorta(X, String(i + 1).padStart(2, '0') + '  ' + L.n, x + 10, y + 12, colW - 20, F.m, K.txt);
      txt(X, L.desc, x + 10, y + 32, F.ts, K.txt3);
      txt(X, L.med, x + 10, y + 50, F.ts, K.txt2);
      /* progreso */
      for (var s = 0; s < 3; s++) {
        led(X, x + 14 + s * 13, y + 70, 4, s < L.estrellas ? K.foco : K.linea);
      }
      if (L.mejor) txt(X, 'mejor ' + L.mejor, x + colW - 10, y + 64, F.ts, K.wn, 'right');
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }
    var by = h - 50, bw = (w - 60) / 2;
    var b1 = item(mon, 20, by, bw, 40, 'MENÚ', function () { if (acc.irMenu) acc.irMenu(); }, { z: 4 });
    var b2 = item(mon, 28 + bw, by, bw, 40, 'CERRAR', function () { if (acc.academia) acc.academia(); }, { z: 4 });
    boton(X, b1, 'MENÚ', K.ac); boton(X, b2, 'CERRAR', K.ac);
    d._items.push(b1, b2);
  }

  /* --- Laboratorio --- */
  function cLab(X, w, h, mon, d) {
    txt(X, 'LABORATORIO DE COHETES', 24, 24, 'bold 24px "Segoe UI", system-ui, sans-serif', K.txt);
    txt(X, d.sub, 24, 56, F.m, K.txt2);
    var y = 96;
    txt(X, 'ETAPAS DEL DISEÑO', 24, y, F.ts, K.ac); y += 22;
    for (var i = 0; i < d.etapas.length; i++) {
      var e = d.etapas[i];
      const cual = i;                 /* vida propia por vuelta */
      var it = item(mon, 24, y, w - 48, 42, e.n,
        function () { if (acc.labEtapa) acc.labEtapa(cual); },
        { tipo: 'opcion', val: e.v, opciones: e.opciones, z: 2 });
      caja(X, 24, y, w - 48, 42, 6, null, i % 2 ? K.panel : K.panel2);
      txt(X, e.n, 36, y + 14, F.m, K.txt);
      txt(X, e.desc, w - 36, y + 14, F.ts, K.txt3, 'right');
      txt(X, e.etiqueta, 36, y + 6, F.ts, K.ac);
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
      y += 46;
      if (y > h - 100) break;
    }
    var by = h - 50, bw = (w - 60) / 2;
    var b1 = item(mon, 20, by, bw, 40, 'SIMULAR', function () { if (acc.labSimular) acc.labSimular(); },
                  { z: 4, tipo: 'ok' });
    var b2 = item(mon, 28 + bw, by, bw, 40, 'MENÚ', function () { if (acc.irMenu) acc.irMenu(); }, { z: 4 });
    boton(X, b1, 'SIMULAR', K.ok); boton(X, b2, 'MENÚ', K.ac);
    d._items.push(b1, b2);
  }

  /* --- créditos --- */
  function cCreditos(X, w, h, mon, d) {
    txt(X, 'CRÉDITOS Y FUENTES', 24, 22, 'bold 22px "Segoe UI", system-ui, sans-serif', K.txt);
    var y = 58;
    for (var i = 0; i < d.bloques.length; i++) {
      var b = d.bloques[i];
      if (y > h - 90) break;
      txt(X, b[0], 24, y, F.ts, K.ac); y += 18;
      y += envolver(X, b[1], 24, y, w - 48, 16, F.ts, K.txt2, 6) * 16 + 12;
    }
    var by = h - 46;
    var b1 = item(mon, 24, by, 140, 36, 'CERRAR', function () { if (acc.cerrarAjustes) acc.cerrarAjustes(); },
                  { z: 4 });
    boton(X, b1, 'CERRAR', K.ac);
    d._items.push(b1);
  }

  /* --- pausa --- */
  function cPausa(X, w, h, mon, d) {
    fondo(X, w, h, 'rgba(7,10,16,0.96)');
    txt(X, '⏸  PAUSA', w / 2, 90, 'bold 34px "Segoe UI", system-ui, sans-serif', K.ac, 'center');
    txt(X, 'La simulación está detenida. Nada avanza hasta que elijas.', w / 2, 134, F.m, K.txt2, 'center');
    var bw = 260, by = 190;
    for (var i = 0; i < d.opciones.length; i++) {
      var o = d.opciones[i];
      var x = w / 2 - bw / 2, y = by + i * 52;
      var it = item(mon, x, y, bw, 44, o.n, o.acc, { z: 2 });
      boton(X, it, o.n, o.color || K.ac);
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }
  }

  /* --- tripulación --- */
  function cTripulacion(X, w, h, mon, d) {
    txt(X, 'TRIPULACIÓN', 24, 24, 'bold 24px "Segoe UI", system-ui, sans-serif', K.txt);
    txt(X, '↑↓ elegir asiento   ENTER Sitúa el puesto', 24, 56, F.ts, K.txt3);
    for (var i = 0; i < d.trip.length; i++) {
      var p = d.trip[i], y = 96 + i * 72;
      if (y > h - 90) break;
      var act = i === d.seat;
      const cual = i;
      var it = item(mon, 24, y, w - 48, 62, p[0], function () { if (acc.asiento) acc.asiento(cual); },
                    { z: 2, indice: cual });
      caja(X, 24, y, w - 48, 62, 7, act ? K.ac : K.linea, act ? 'rgba(92,184,255,0.12)' : K.panel);
      txt(X, String(i + 1), 38, y + 20, F.tb2, act ? K.ac : K.txt3);
      txt(X, p[0], 74, y + 12, 'bold 16px "Segoe UI", system-ui, sans-serif', K.txt);
      txt(X, p[1], 74, y + 34, F.ts, K.txt2);
      txt(X, act ? 'TU PUESTO' : '', w - 38, y + 24, F.ts, act ? K.ac : K.txt3, 'right');
      cajaFoco(X, mon, it, w, h);
      d._items.push(it);
    }
    var b1 = item(mon, 24, h - 48, 160, 38, 'VOLVER', function () { if (acc.cerrarTrip) acc.cerrarTrip(); },
                  { z: 4 });
    boton(X, b1, 'VOLVER', K.ac);
    d._items.push(b1);
  }

  /* =======================================================================
   * DESPACHO
   * ==================================================================== */
  var PANT = {
    'telemetria': pTelemetria,
    'comms':      pComms,
    'sistemas':   pSistemas,
    'mapa':       pMapa,
    'checklist':  pChecklist,
    'controles':  pControles,
    'central':    pCentral
  };

  /**
   * Pinta un monitor y registra sus elementos navegables.
   * `datos[tipo]` es la carga específica de cada pantalla.
   */
  function pintar(mon, datos) {
    var s = CJ.COCKPIT ? CJ.COCKPIT.superficie(mon.id, mon.pw, mon.ph) : null;
    if (!s) return null;
    var X = s.X;
    datos = datos || {};
    datos._items = [];
    var fn = PANT[mon.id], escala = ESCALA_TEXTO_CENTRAL;
    /* El tamaño físico de cada DU ya lo resuelve su textura. Escalar sólo la
     * tipografía provocaba solapes y no simulaba una pantalla de cabina real. */
    try { if (fn) fn(X, s.w, s.h, mon, datos); }
    finally { ESCALA_TEXTO_CENTRAL = escala; }
    if (CJ.COCKPIT) {
      var i = selDe(mon.id);
      if (i >= datos._items.length) setSelDe(mon.id, 0);
      CJ.COCKPIT.setItems(mon.id, datos._items);
    }
    return s.cv;
  }

  /** Subraya el elemento resaltado en la textura ya pintada. */
  function marcarFoco(mon) {
    var s = CJ.COCKPIT ? CJ.COCKPIT.contexto2D(mon.id) : null;
    if (!s) return;
    var l = estDe().items[mon.id] || [];
    var it = l[selDe(mon.id)];
    if (!it || it.x == null) return;
    s.strokeStyle = K.foco; s.lineWidth = 3;
    s.strokeRect(it.x - 4, it.y - 4, it.w + 8, it.h + 8);
  }

  CJ.HUD = {
    K: K, F: F,
    setFuente: setFuente,
    setAcciones: setAcciones,
    setEscalaTexto: setEscalaTexto,
    dibujarRuta: dibujarRuta,
    pintar: pintar,
    marcarFoco: marcarFoco,
    primitivas: { fondo: fondo, caja: caja, txt: txt, txtCorta: txtCorta,
                   envolver: envolver, barra: barra, led: led, cabecera: cabecera,
                   rejilla: rejilla, item: item },
    estado: est,
    compat: HUD_COMPAT,
    /* Exportado para el arnés de pruebas */
    _p: { pTelemetria: pTelemetria, pComms: pComms, pSistemas: pSistemas,
          pMapa: pMapa, pChecklist: pChecklist, pControles: pControles,
          pCentral: pCentral, dibujarActitud: dibujarActitud }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CJ.HUD;

})(typeof window !== 'undefined' ? window : this);
