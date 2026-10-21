/* ===========================================================================
 * CISLUNAR JUNIOR — Enlace cabina ↔ partida
 * Cañon Labs · NASA Space Apps Challenge 2026
 *
 * Traduce el estado de la partida (`S`, `M`, `AJ`) y los módulos de vuelo
 * (`CJ.FLT`, `CJ.STG`, `CJ.ORB`) a las cargas que cada monitor necesita, y
 * conecta la navegación con las acciones del juego.
 *
 * También decide qué pantalla central está abierta —menú, ficha de misión,
 * decisión, informe, ajustes, Academia, laboratorio o créditos— y la mantiene
 * coherente con `MODO` y `S.phase`, de forma que el estado del juego manda
 * siempre y la cabina sólo refleja.
 * Código original de Cañon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  var CJ = root.CJ || (root.CJ = {});

  CJ.CABINA = (function () {
    /* `CAB` y `HUD` se resuelven al usarlos, no al cargar: `cockpit.js` y
     * `hud_flight.js` pueden cargar después de este módulo, según el orden de
     * las etiquetas <script>, y capturarlos aquí dejaba el enlace en
     * undefined sin que se notase. */
    function CAB() { return CJ.COCKPIT || null; }
    function HUD() { return CJ.HUD || null; }

    /* Estado de la navegación */
    var nav = {
      central: 'menu',      // menú | mision | decision | informe | ajustes |
                            // academia | lab | creditos | pausa | tripulacion | nada
      idxMision: 0,
      anterior: 'menu',     // a dónde volver con "volver"
      academiaLeccion: -1,
      labEtapa: 0,
      filtroComms: 'all',
      capaMapa: 'trayectoria',
      zoomMapa: 1,
      recurso: 0,
      visible: false,
      cockpit: true         // ¿el jugador está dentro de la cabina?
    };

    /* Lo que el juego necesita saber de la cabina */
    var g = {
      S: null, M: null, AJ: null, PH: null, NM: null, NC: null,
      lecturas: null, escena3D: null
    };

    /* ================================================================== */
    /* ENLACE CON LA PARTIDA                                             */
    /* ================================================================== */

    /** El módulo principal registra aquí sus globales. */
    function enlazar(ref) {
      for (var k in ref) g[k] = ref[k];
      /* El HUD se resuelve al llamar: si el módulo todavía no ha cargado, la
       * cabina se queda sin datos ni acciones y no se nota hasta que el
       * jugador pulsa algo. */
      if (HUD()) { HUD().setFuente(fuente); HUD().setAcciones(acciones()); }
    }

    /* Estado del juego, con los valores por defecto si falta algo.
     * `S` llega como función porque `nuevaPartida` reasigna la variable: si se
     * copiara el objeto, el enlace se quedaría apuntando a la partida
     * anterior en cuanto se empiezan la segunda.
     *
     * Toda lectura y escritura pasa por `partida()`. Escribir `g.S.campo`
     * directamente devolvía `undefined` —`g.S` es una función, no el estado— y
     * el enlace fallaba en silencio. */
    function partida() {
      return typeof g.S === 'function' ? g.S() : g.S;
    }

    function fuente() {
      return {
        S: partida(),
        M: g.M || [], AJ: g.AJ || {}, PH: g.PH || [], NM: g.NM || [], NC: g.NC || []
      };
    }

    function acciones() {
      return {
        empezar: empezarMision,
        irMenu: irMenu,
        elegir: elegirOpcion,
        confirmar: confirmar,
        deshacer: deshacer,
        reintentar: reintentar,
        asiento: cambiarAsiento,
        verSistemas: function () { nav.central = 'tripulacion'; },
        cerrarTrip: function () { nav.central = decisionAbierta() ? 'decision' : 'menu'; },
        ajuste: ajustar,
        cerrarAjustes: cerrarAjustes,
        academia: function () { nav.central = 'academia'; },
        leccion: abrirLeccion,
        labEtapa: function (i) { nav.labEtapa = i; },
        labSimular: simularLab,
        exportar: exportarComms,
        commsFin: function () { nav.central = decisionAbierta() ? 'decision' : 'menu'; },
        setFiltro: function (v) {
          nav.filtroComms = v;
          if (partida()) partida().commFilter = v;
        },
        checklist: ejecutarChecklist,
        verTripulacion: function () { nav.anterior = 'decision'; nav.central = 'tripulacion'; },
        verInforme: function () {
          var S = partida();
          nav.anterior = 'decision';
          nav.central = (S && S.fin) ? 'informe' : 'informe_previo';
        },
        verRecurso: function (i) {
          nav.anterior = 'decision';
          nav.central = 'recursos';
          nav.recurso = i;
        },
        capaMapa: function (v) { nav.capaMapa = v; },
        zoomMapa: function (paso) {
          nav.zoomMapa = paso === 0 ? 1 : Math.max(0.8, Math.min(1.6, nav.zoomMapa + paso * 0.2));
        },
        montarChecklist: montarChecklist,
        irMonitor: function (id) { if (CJ.COCKPIT) CJ.COCKPIT.irA(id); },
        irDecision: function () { nav.central = 'decision'; },
        asis: cambiarAsistencia,
        throttle: function (v) { ajustarEmpuje(v / 100); }
      };
    }

    /* ================================================================== */
    /* NAVEGACIÓN                                                        */
    /* ================================================================== */

    function decisionAbierta() {
      var S = partida();
      return !!(S && !S.fin && S.phase !== 'flight' && g.M && g.M[S.m]);
    }

    function irMenu() {
      nav.central = 'menu';
      nav.idxMision = 0;
      if (typeof g.irMenuJuego === 'function') g.irMenuJuego();
    }

    function empezarMision(i) {
      nav.central = 'decision';
      if (typeof g.nuevaPartidaJuego !== 'function') return;
      g.nuevaPartidaJuego(i);
    }

    function abrirMision(i) {
      nav.idxMision = i;
      nav.central = 'mision';
      nav.anterior = 'menu';
    }

    function volver() {
      nav.central = nav.anterior || 'menu';
    }

    function elegirOpcion(i) {
      if (!puedeDecidir()) return;
      var S = partida();
      if (S) S.elej = i;
    }

    function confirmar() {
      var S = partida();
      if (!S || !puedeDecidir()) return;
      if (S.elej >= 0 && typeof g.apJuego === 'function') g.apJuego(S.elej);
    }

    function deshacer() { var S = partida(); if (S) S.elej = -1; }

    function reintentar() {
      var S = partida();
      if (!S) return;
      if (typeof g.reintentarPartida === 'function') g.reintentarPartida();
      else if (typeof g.nuevaPartidaJuego === 'function') g.nuevaPartidaJuego(S.m);
    }

    function cambiarAsiento(i) { var S = partida(); if (S) S.seat = i; }

    function puedeDecidir() {
      var S = partida();
      if (!S || S.fin || S.phase === 'flight') return false;
      if (typeof g.puedeDecidirJuego === 'function') return g.puedeDecidirJuego();
      return S.seat == null || S.seat === S.turno;
    }

    /* --- ajustes --- */
    function ajustar(k, v) {
      var A = g.AJ;
      if (!A) return;
      if (k === 'tema') { A.tema = v; if (g.aplicarTema) g.aplicarTema(); }
      else if (k === 'sonido') A.sonido = v;
      else if (k === 'rotar') A.rotar = v;
      else if (k === 'mov') A.mov = v;
      else if (k === 'asistencia') A.asistencia = v;
      else return;
      if (g.guardarAjustes) g.guardarAjustes();
    }

    function cerrarAjustes() {
      nav.central = nav.anterior === 'ajustes' ? 'menu' : (nav.anterior || 'menu');
    }

    /* --- Academia --- */
    function abrirLeccion(idx) {
      nav.academiaLeccion = idx;
      if (CJ.ACAD && typeof CJ.ACAD.startLesson === 'function') {
        CJ.ACAD.startLesson(idx);
      } else if (CJ.ACAD && typeof CJ.ACAD.init === 'function') {
        CJ.ACAD.init('academiaHost');
      }
    }

    /* --- laboratorio --- */
    function simularLab() {
      if (typeof g.labSimularJuego === 'function') g.labSimularJuego(nav.labEtapa);
    }

    function exportarComms() {
      if (typeof g.exportarCommsJuego === 'function') g.exportarCommsJuego();
    }

    /* --- mapa y checklist --- */
    function montarChecklist() {
      var S = partida();
      if (!S || !CJ.STG || !g.M) return;
      var fs = S.flightState || {};
      var veh = fs.vehiculo || vehiculoDe(S.m);
      var fase = fs.fase || faseDe(S.m);
      CJ.STG.init(veh, fase);
      tono(520, 0.06, 0.03);
    }

    function vehiculoDe(m) {
      var ev = g.M[m].e.find(function (e) { return e.manual; });
      return (ev && ev.vehiculo) || 'saturnV';
    }

    function faseDe(m) {
      var ev = g.M[m].e.find(function (e) { return e.manual; });
      return (ev && ev.faseVuelo) || 'ascenso';
    }

    /* --- vuelo --- */
    function cambiarAsistencia(v) {
      var S = partida();
      if (S && S.flightState) S.flightState.asistencia = v;
      if (CJ.FLT && CJ.FLT.setAsistencia) CJ.FLT.setAsistencia(v);
      if (g.AJ) g.AJ.asistencia = v;
    }

    function ajustarEmpuje(v) {
      var S = partida();
      if (S && S.flightState) S.flightState.impulso = Math.max(0, Math.min(1, v));
    }

    function ejecutarChecklist(key, accion) {
      if (!CJ.STG) return;
      if (typeof CJ.STG.confirmAction === 'function') CJ.STG.confirmAction(key);
      else if (typeof CJ.STG.confirmar === 'function') CJ.STG.confirmar(key);
      if (accion && typeof g.accionChecklist === 'function') g.accionChecklist(accion, key);
    }

    /* ================================================================== */
    /* CARGAS DE CADA MONITOR                                           */
    /* ================================================================== */

    function fmtNum(v, dec) {
      var n = Number(v);
      if (!isFinite(n)) return '—';
      return dec != null ? n.toFixed(dec) : String(Math.round(n));
    }

    function fmtAlt(km) {
      if (!isFinite(km)) return '—';
      if (km >= 100000) return (km / 1000).toFixed(0) + 'k km';
      if (km >= 1000) return km.toFixed(0) + ' km';
      return km.toFixed(km < 10 ? 2 : 1) + ' km';
    }

    function fmtPer(s) {
      if (!isFinite(s)) return '—';
      if (s >= 86400) return (s / 86400).toFixed(1) + ' d';
      if (s >= 3600) return (s / 3600).toFixed(1) + ' h';
      return (s / 60).toFixed(0) + ' min';
    }

    /** Extrapolación del período y la excentricidad desde las lecturas. */
    function periodoDe(a, e) {
      var mu = (CJ.ORB && CJ.ORB.CUERPOS && CJ.ORB.CUERPOS.tierra) ? CJ.ORB.CUERPOS.tierra.mu : 3.986e14;
      if (!a || a <= 0) return NaN;
      return 2 * Math.PI * Math.sqrt(a * a * a / mu);
    }

    function datosTelemetria() {
      var d = fuente(), S = d.S;
      var L = (S && g.lecturas) ? g.lecturas() : null;
      L = L || { alt: 0, vel: 0, dv: 0, res: S ? S.res : [0,0,0,0,0] };
      var orb = CJ.ORB;
      var a = NaN, e = NaN, nu = 0, r = NaN, R = 6371;
      if (S && g.M) {
        var ev = g.M[S.m].e[Math.min(S.i, g.M[S.m].e.length - 1)];
        var el = elementosDe(S.m, ev.p);
        if (el) {
          a = el.a; e = el.e; R = el.R;
          nu = (typeof g.progresoEvento === 'function' ? g.progresoEvento() : 0) * Math.PI *
               (ev.p === 2 || ev.p === 4 ? 1 : 0.5);
          r = a * (1 - e * e) / (1 + e * Math.cos(nu));
        }
      }
      return {
        S: S, NM: d.NM, res: S ? S.res : [0,0,0,0,0],
        L: L,
        att: S && S.flightState && S.flightState.att ? S.flightState.att : [0, 0, 0],
        optimo: S && S.flightState && S.flightState.optimo ? S.flightState.optimo.att : null,
        mision: S && g.M ? g.M[S.m].n : '—',
        altTxt: fmtAlt(L.alt),
        velTxt: L.vel.toFixed(3),
        peTxt: isFinite(r) ? fmtAlt(r * (1 - e) - R) : '—',
        apTxt: isFinite(r) ? fmtAlt(r * (1 + e) - R) : '—',
        perTxt: isFinite(a) ? fmtPer(periodoDe(a, e)) : '—',
        incTxt: isFinite(a) && isFinite(r) && a > 0
          ? (Math.acos(Math.max(-1, Math.min(1, (r * r + a * a - 1737 * 1737) / (2 * r * a))))
             * 180 / Math.PI).toFixed(1) : '—',
        dvTxt: fmtNum(L.dv, 0),
        faseOrb: L.fase || (S && d.PH && d.PH[ev ? ev.p : 0]) || '—'
      };
    }

    /** Elementos orbitales de la fase actual (misma tabla que usa lecturas). */
    function elementosDe(m, p) {
      var orb = CJ.ORB;
      if (!orb || !orb.CUERPOS) return null;
      var C = orb.CUERPOS;
      var TT = {
        0: { 0: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            1: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            2: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            3: { a: 1837, e: 0.01, mu: C.luna.mu, R: C.luna.R },
            4: { a: 1837, e: 0.01, mu: C.luna.mu, R: C.luna.R },
            5: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            6: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R } },
        1: { 0: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            1: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            2: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            3: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            4: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            5: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R } },
        2: { 0: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            1: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            2: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            3: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            4: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            5: { a: 243000, e: 0.97, mu: C.tierra.mu, R: C.tierra.R },
            6: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R } },
        3: { 0: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            1: { a: 6571, e: 0.001, mu: C.tierra.mu, R: C.tierra.R },
            2: { a: 1.2e8, e: 0.8, mu: C.sol.mu, R: C.sol.R },
            3: { a: 3689, e: 0.01, mu: C.marte.mu, R: C.marte.R } }
      };
      return (TT[m] && TT[m][p]) || null;
    }

    /* --- comunicaciones --- */
    var FILTROS = [
      { k: 'all', n: 'TODO' },
      { k: 'alerta', n: 'ALERTAS' },
      { k: 'sistemas', n: 'SISTEMAS' },
      { k: 'tripulacion', n: 'TRIPULACIÓN' },
      { k: 'decisiones', n: 'DECIS.' },
      { k: 'todo', n: 'CRONO' }
    ];

    function tipoDe(q) {
      var s = String(q || '').toLowerCase();
      if (s.indexOf('emerge') >= 0 || s.indexOf('alerta') >= 0 || s.indexOf('critic') >= 0 ||
          s.indexOf('peligro') >= 0) return 'alerta';
      if (s.indexOf('sistem') >= 0 || s.indexOf('aviso') >= 0 || s.indexOf('falla') >= 0) return 'sistemas';
      if (s.indexOf('tripul') >= 0 || s.indexOf('capit') >= 0) return 'tripulacion';
      return 'control';
    }

    function datosComms() {
      var d = fuente(), S = d.S;
      var lineas = [];
      if (S) {
        var m = g.M && g.M[S.m];
        var f = nav.filtroComms;
        var evs = m ? m.e : [];
        for (var i = 0; i < S.comms.length; i++) {
          var c = S.comms[i];
          var ev = null;
          for (var j = 0; j < evs.length; j++) if (evs[j].t === c.t) { ev = evs[j]; break; }
          var tipo = tipoDe(c.q);
          if (f === 'all' || f === 'todo' || f === tipo) {
            if (i === 0 || !S.comms[i - 1] || S.comms[i - 1].t !== c.t) {
              lineas.push({ t: 'fase', s: '· ' + c.t + ' · ' + (ev && d.PH ? d.PH[ev.p] : '') });
            }
            lineas.push({ c: tipo, tag: tagDe(tipo), s: (c.q || '') + (c.x ? ': ' + c.x : '') });
          }
        }
        for (i = 0; i < S.log.length; i++) {
          if (f === 'all' || f === 'decisiones') {
            lineas.push({ c: 'decision', tag: 'DEC',
                          s: S.log[i].t + ' → ' + (S.log[i].o || '') });
          }
        }
      }
      var act = null;
      for (var k = 0; k < FILTROS.length; k++) if (FILTROS[k].k === nav.filtroComms) act = FILTROS[k];
      return {
        S: S, lineas: lineas,
        filtros: FILTROS, filtro: nav.filtroComms,
        filtraNombre: act ? act.n : 'TODO'
      };
    }

    function tagDe(tipo) {
      return tipo === 'alerta' ? '⚠' : (tipo === 'sistemas' ? 'SYS' :
             (tipo === 'tripulacion' ? 'TRP' : 'CTR'));
    }

    /* --- sistemas --- */
    var SUBSISTEMAS = [
      { n: 'GNC — guiado, navegación y control' },
      { n: 'EPS — energía y buses' },
      { n: 'COM — comunicaciones y enlace' },
      { n: 'ECS — soporte vital' },
      { n: 'RCS — control de actitud' },
      { n: 'TCS — control térmico' },
      { n: 'C&DH — computadoras y datos' },
      { n: 'PIRO — pirotécnicos' }
    ];

    function datosSistemas() {
      var d = fuente(), S = d.S;
      var subs = [];
      var v;
      for (var i = 0; i < SUBSISTEMAS.length; i++) {
        subs.push({ n: SUBSISTEMAS[i].n, estado: 'NOMINAL', v: 100 });
      }
      var alertas = 0, alertaTxt = 'Sin alertas';
      if (S) {
        alertas = S.inc || 0;
        v = S.res[1];
        subs[1].estado = v > 45 ? 'NOMINAL' : (v > 22 ? 'BAJO' : 'CRÍTICO');
        subs[1].v = v;
        v = S.res[2];
        subs[2].estado = v > 45 ? 'NOMINAL' : (v > 22 ? 'BAJO' : 'CRÍTICO');
        subs[2].v = v;
        v = S.res[0];
        subs[3].estado = v > 45 ? 'NOMINAL' : (v > 22 ? 'BAJO' : 'CRÍTICO');
        subs[3].v = v;
        /* No inventar valores nominales cuando el modelo no ofrece telemetría. */
        if (S.rcs == null) { subs[4].v = null; subs[4].estado = 'SIN TELEMETRÍA'; }
        else { subs[4].v = S.rcs; subs[4].estado = S.rcs > 40 ? 'NOMINAL' : (S.rcs > 15 ? 'BAJO' : 'CRÍTICO'); }
        if (S.termico == null) { subs[5].v = null; subs[5].estado = 'SIN TELEMETRÍA'; }
        else { subs[5].v = S.termico; subs[5].estado = S.termico > 40 ? 'NOMINAL' : (S.termico > 15 ? 'ALERTA' : 'CRÍTICO'); }
        if (S.datos == null) { subs[6].v = null; subs[6].estado = 'SIN TELEMETRÍA'; }
        else { subs[6].v = S.datos; subs[6].estado = S.datos > 60 ? 'NOMINAL' : 'REDUCIDO'; }
        subs[7].estado = S.piroArmado == null ? 'NO DISPONIBLE' : (S.piroArmado ? 'ARMADO' : 'SEGURO');
        subs[7].v = null;

        var mins = [];
        for (i = 0; i < 5; i++) if (S.res[i] <= 22) mins.push(d.NM[i] + ' ' + Math.round(S.res[i]) + '%');
        if (mins.length) alertaTxt = mins.join(' · ');
        else if (alertas) alertaTxt = alertas + (alertas === 1 ? ' incidente imprevisto' : ' incidentes imprevistos');
        else alertaTxt = 'Sin alertas';
      }
      return {
        S: S, sistemas: subs, inc: alertas, alertasTxt: alertaTxt,
        alerta: alertas ? (S && S.inc > 2 ? 'ALARMA' : 'ATENCIÓN') : 'NOMINAL'
      };
    }

    /* --- mapa --- */
    function datosMapa() {
      var d = fuente(), S = d.S;
      var cuerpo = { n: 'TIERRA', g: ['#7fc0ff', '#0a2b52'] };
      var nu = 0, r = 1, dist = 0, els = [];
      if (S && g.M) {
        var ev = g.M[S.m].e[Math.min(S.i, g.M[S.m].e.length - 1)];
        var el = elementosDe(S.m, ev.p);
        if (el) {
          var k = typeof g.progresoEvento === 'function' ? g.progresoEvento() : 0;
          var ecc = el.e;
          nu = k * Math.PI * (ev.p === 2 || ev.p === 4 ? 1 : 0.5);
          r = el.a * (1 - ecc * ecc) / (1 + ecc * Math.cos(nu)) / el.a;
          dist = r * el.a - el.R;
          els = [
            ['a (semieje mayor)', (el.a).toFixed(0) + ' km'],
            ['e (excentricidad)', ecc.toFixed(4)],
            ['μ', (el.mu / 1e12).toFixed(3) + 'e12'],
            ['ν (anomalía)', (nu * 180 / Math.PI).toFixed(1) + '°'],
            ['r (radio)', (r * el.a).toFixed(0) + ' km']
          ];
        }
        if (S.m === 1) cuerpo = { n: 'LUNA', g: ['#e8e8ea', '#4a4a52'] };
        else if (S.m === 3 && ev.p === 3) cuerpo = { n: 'MARTE', g: ['#ff9a6b', '#6b2412'] };
        else if (S.m === 3) cuerpo = { n: 'SOL', g: ['#ffd76b', '#c26a00'] };
      }
      var puntos = [];
      if (S && g.M) {
        var evs = g.M[S.m].e;
        for (var i = 0; i < evs.length; i++) {
          if (!evs[i].h) continue;
          puntos.push([evs[i].t, evs[i].h]);
          if (puntos.length >= 5) break;
        }
      }
      return {
        S: S, cuerpo: cuerpo.n, cuerpoG: cuerpo.g,
        m: S ? S.m : 0,
        progreso: S && g.M ? Math.max(0, Math.min(1,
          (S.i + (typeof g.progresoEvento === 'function' ? g.progresoEvento() : 0)) / g.M[S.m].e.length)) : 0,
        avance: S && S.m !== 3 && typeof g.avanceRuta === 'function'
          ? g.avanceRuta(S.m, (S.i + (typeof g.progresoEvento === 'function' ? g.progresoEvento() : 0)) / g.M[S.m].e.length)
          : null,
        zoom: nav.zoomMapa,
        evento: S && g.M ? g.M[S.m].e[S.i].h : 'Sin misión',
        tiempo: S && g.M ? g.M[S.m].e[S.i].t : '—',
        nu: nu, objetivo: null,
        distTxt: dist > 0 ? fmtAlt(dist) + ' al centro' : '—',
        elementos: els.length ? els : [['—', '—']],
        puntos: puntos.length ? puntos : [['Sin hitos', '—']],
        capa: nav.capaMapa,
        capas: [
          { k: 'trayectoria', n: 'TRAYECTORIA' },
          { k: 'hitos', n: 'HITOS' },
          { k: 'elementos', n: 'ELEMENTOS' }
        ],
        pieMapa: '← → cambia de capa'
      };
    }

    /* --- checklist --- */
    function datosChecklist() {
      var d = fuente(), S = d.S;
      var items = [], hechos = [], prog = { done: 0, total: 0 };
      var faseNombre = '—';
      if (S && CJ.STG) {
        if (typeof CJ.STG.getChecklist === 'function') items = CJ.STG.getChecklist() || [];
        var fs = S.flightState || {};
        if (fs.fase) faseNombre = String(fs.fase).toUpperCase();
        var cl = CJ.STG.CHECKLISTS || {};
        if (fs.vehiculo && cl[fs.vehiculo]) {
          var key = null;
          for (var k in cl[fs.vehiculo]) if (items.length && k === fs.fase) key = k;
          if (!key && items.length) {
            for (var k2 in cl[fs.vehiculo]) {
              var its = cl[fs.vehiculo][k2];
              if (its.length === items.length) { key = k2; break; }
            }
          }
          if (key) faseNombre = key.toUpperCase();
        }
        if (typeof CJ.STG.getProgress === 'function') prog = CJ.STG.getProgress();
        if (typeof CJ.STG.isItemDone === 'function') {
          for (var i = 0; i < items.length; i++) {
            if (CJ.STG.isItemDone(items[i].key)) hechos.push(items[i].key);
          }
        }
      }
      return { S: S, items: items, hechos: hechos, prog: prog, faseNombre: faseNombre };
    }

    /* --- controles --- */
    var TECLAS_VUELO = [
      ['W / S', 'Cabeceo abajo / arriba'],
      ['A / D', 'Guiñada izquierda / derecha'],
      ['Q / E', 'Alabeo'],
      ['Shift / Espacio', 'Empuje + / −'],
      ['H', 'Nivel de asistencia'],
      ['C', 'Cámara orbital / libre'],
      ['R', 'Recuperar actitud'],
      ['P', 'Pausa'],
      ['Tab', 'Monitor siguiente'],
      ['F1..F6', 'Ir a un monitor'],
      ['↑ ↓', 'Elegir elemento del monitor'],
      ['← →', 'Ajustar el elemento'],
      ['Enter', 'Activar el elemento'],
      ['Esc', 'Devolver el mando al vehículo'],
      ['`', 'Alternar ratón / teclado']
    ];

    function datosControles() {
      var d = fuente(), S = d.S;
      var fs = (S && S.flightState) || {};
      var asis = fs.asistencia != null ? fs.asistencia : (d.AJ && d.AJ.asistencia != null ? d.AJ.asistencia : 2);
      var nombres = ['NINGUNA', 'PRINCIPIANTE', 'ESTÁNDAR', 'ASISTIDO'];
      var colores = ['#8a9bad', '#4fd18b', '#5cb8ff', '#ffb547'];
      var att = fs.att || [0, 0, 0];
      var opt = fs.optimo ? (fs.optimo.att || [att[0], att[1], att[2]]) : null;
      return {
        S: S,
        att: att, optimo: opt,
        throttle: fs.impulso != null ? fs.impulso : (fs.throttle || 0),
        asis: asis, asisNombre: nombres[asis] || nombres[2], asisColor: colores[asis] || colores[2],
        ayuda: fs.fase ? { fase: String(fs.fase).toUpperCase() } : null,
        teclas: TECLAS_VUELO
      };
    }

    function datosPanelMision(S, mis, ev) {
      return {
        tipo: 'panel_mision', S: S, mision: mis.n, fase: dFuentePH(ev.p), evento: ev.t,
        progreso: (S.i + 1) + ' / ' + mis.e.length, res: S.res,
        NM: fuente().NM, tele: datosTelemetria(), ruta: datosMapa()
      };
    }

    function dFuentePH(p) {
      var f = fuente(); return (f.PH && f.PH[p]) || '';
    }

    /* --- pantalla central --- */
    function datosCentral() {
      var d = fuente(), S = d.S, t = nav.central;
      var base = { tipo: t, S: S, NM: d.NM };

      if (t === 'panel_reposo') {
        base.tipo = 'vacio'; base.titulo = 'SIN MISIÓN ACTIVA';
        base.aviso = 'Elige una expedición en la ventana de preparación.';
        return base;
      }

      if (t === 'menu') {
        var ms = [];
        for (var i = 0; i < (g.M || []).length; i++) {
          var m = g.M[i];
          ms.push({ n: m.n, f: m.f, d: m.d, v: m.v,
                    nEv: m.e.length, nTrip: (m.r || []).length,
                    color: d.NC && d.NC[i] ? d.NC[i] : '#5cb8ff' });
        }
        base.misiones = ms;
        base.extras = [
          { n: 'Academia', acc: function () { nav.central = 'academia'; nav.anterior = 'menu'; } },
          { n: 'Laboratorio', acc: function () { nav.central = 'lab'; nav.anterior = 'menu'; } },
          { n: 'Ajustes', acc: function () { nav.central = 'ajustes'; nav.anterior = 'menu'; } },
          { n: 'Créditos', acc: function () { nav.central = 'creditos'; nav.anterior = 'menu'; } }
        ];
        return base;
      }

      if (t === 'mision') {
        var mm = (g.M || [])[nav.idxMision];
        if (!mm) { base.tipo = 'menu'; return datosCentral.call(null); }
        base.idx = nav.idxMision;
        base.mision = {
          n: mm.n, f: mm.f, d: mm.d, v: mm.v, x: mm.x,
          nEv: mm.e.length, nTrip: (mm.r || []).length,
          trip: mm.r || [],
          evs: mm.e.map(function (e) { return [e.t, d.PH[e.p] || '']; })
        };
        return base;
      }

      if (t === 'decision' && S && g.M) {
        var mis = g.M[S.m];
        var ev = mis.e[Math.min(S.i, mis.e.length - 1)];
        base.ev = ev;
        base.fase = d.PH[ev.p] || '';
        base.eleg = S.elej;
        base.critico = !!(ev.w && /EMERGENCIA|CRIT/i.test(String(ev.w[0])));
        base.panel = datosPanelMision(S, mis, ev);
        return base;
      }

      /* El monitor central queda como tablero de la nave durante toda la
       * misión; las decisiones y opciones se presentan en la capa HTML. */
      if (t === 'panel_mision' && S && g.M) {
        var md = g.M[S.m], evd = md.e[Math.min(S.i, md.e.length - 1)];
        return datosPanelMision(S, md, evd);
      }

      if (t === 'informe' && S) {
        var mm2 = g.M[S.m];
        var metricas = [];
        if (S.flightMetrics) {
          var fm = S.flightMetrics;
          metricas = [
            ['Duración de vuelo', fm.duracion != null ? fm.duracion.toFixed(1) + ' s' : '—'],
            ['Δv gastado', fm.dvGastado != null ? fm.dvGastado.toFixed(1) + ' m/s' : '—'],
            ['Desviación máxima', fm.desvMax != null ? fm.desvMax.toFixed(2) + '°' : '—'],
            ['Correcciones', fm.correcciones != null ? String(fm.correcciones) : '—'],
            ['Tiempo fuera de zona', fm.tiempoFuera != null ? fmtPer(fm.tiempoFuera) : '—'],
            ['Etapas separadas', fm.staging ? fm.staging.filter(function (s2) { return s2.limpio; }).length +
                ' / ' + fm.staging.length : '—'],
            ['Asistencia usada', ['ninguna', 'principiante', 'estándar', 'asistido'][
                fm.nivelAsistencia || 0]]
          ];
        } else {
          metricas = [['Vuelo manual', 'no se pilotó'], ['Decisiones', String(S.dec || 0)]];
        }
        var decs = [];
        for (var i2 = 0; i2 < (S.log || []).length; i2++) {
          var l = S.log[i2];
          decs.push({ t: l.t, o: l.o || '',
            d: (l.d || []).filter(Boolean).map(function (v) {
              return (v > 0 ? '+' : '') + v;
            }).join(' '), dn: (l.d || []).some(function (v) { return v < -8; }) });
        }
        base.ok = S.fin === 'ok';
        base.titulo = S.fin === 'ok' ? 'MISIÓN CUMPLIDA' : 'MISIÓN ABORTADA';
        base.sub = S.finTxt || '';
        base.res = S.res;
        base.metricas = metricas;
        base.decisiones = decs;
        base.mision = mm2 ? mm2.n : '';
        return base;
      }

      if (t === 'ajustes') {
        var A = d.AJ;
        base.opciones = [
          { k: 'tema', n: 'Tema', desc: 'Claro, oscuro o según el sistema',
            tipo: 'opcion', v: A.tema, opciones: ['auto', 'light', 'dark'],
            etiqueta: A.tema === 'auto' ? 'AUTO' : (A.tema === 'light' ? 'CLARO' : 'OSCURO') },
          { k: 'sonido', n: 'Sonido', desc: 'Avisos y confirmaciones',
            tipo: 'opcion', v: A.sonido, opciones: [1, 0],
            etiqueta: A.sonido ? 'SÍ' : 'NO' },
          { k: 'rotar', n: 'Rotación del vehículo', desc: 'Giro lento de la escena',
            tipo: 'opcion', v: A.rotar, opciones: [1, 0], etiqueta: A.rotar ? 'SÍ' : 'NO' },
          { k: 'mov', n: 'Animaciones', desc: 'Reducir movimiento para mareos',
            tipo: 'opcion', v: A.mov, opciones: ['auto', 'reducido'],
            etiqueta: A.mov === 'auto' ? 'COMPLETAS' : 'REDUCIDAS' },
          { k: 'asistencia', n: 'Asistencia de vuelo', desc: 'Nivel de ayuda por defecto',
            tipo: 'slider', v: A.asistencia == null ? 2 : A.asistencia, min: 0, max: 3, paso: 1 }
        ];
        return base;
      }

      if (t === 'academia') {
        var lec = [];
        var fuenteL = (CJ.ACAD && (CJ.ACAD.LECCIONES || CJ.ACAD.lecciones)) || [];
        for (var i3 = 0; i3 < fuenteL.length; i3++) {
          var L = fuenteL[i3];
          lec.push({
            idx: i3, n: L.titulo || L.n || ('Lección ' + (i3 + 1)),
            desc: L.desc || L.resumen || '',
            med: L.medalla || L.medal || '',
            estrellas: (CJ.ACAD && CJ.ACAD.getMedallaForLeccion) ?
              (CJ.ACAD.getMedallaForLeccion(L.id) === 'oro' ? 3 :
               CJ.ACAD.getMedallaForLeccion(L.id) === 'plata' ? 2 :
               CJ.ACAD.getMedallaForLeccion(L.id) === 'bronce' ? 1 : 0) : 0,
            mejor: (CJ.ACAD && CJ.ACAD.getProgress) ?
              CJ.ACAD.getProgress(L.id).mejorTiempo || null : null,
            color: L.color || '#5cb8ff'
          });
        }
        base.lecciones = lec;
        base.sub = 'Diez lecciones progresivas con física auténtica: de la evasión al examen final.';
        return base;
      }

      if (t === 'lab') {
        base.etapas = [
          { n: 'Primera etapa', desc: 'Etapa de despegue', tipo: 'opcion',
            v: 0, opciones: [0, 1], etiqueta: 'F-1' },
          { n: 'Segunda etapa', desc: 'Etapa orbital', tipo: 'opcion',
            v: 0, opciones: [0, 1], etiqueta: 'J-2' }
        ];
        base.sub = 'Monta etapas y motores, y comprueba con Tsiolkovski si el diseño llega a órbita.';
        return base;
      }

      if (t === 'creditos') {
        base.bloques = bloquesCreditos();
        return base;
      }

      if (t === 'pausa') {
        base.opciones = [
          { n: 'Reanudar', color: '#4fd18b', acc: function () { reanudar(); } },
          { n: 'Reiniciar vuelo', acc: function () { reanudar(); reintentar(); } },
          { n: 'Ajustes', acc: function () { nav.central = 'ajustes'; nav.anterior = 'pausa'; } },
          { n: 'Menú principal', acc: function () { reanudar(); irMenu(); } }
        ];
        return base;
      }

      if (t === 'tripulacion' && S && g.M) {
        var rr = (g.M[S.m].r || []).slice();
        base.trip = rr;
        base.seat = S.seat;
        return base;
      }

      /* Detalle de un recurso: por qué importa y cómo se ha movido. */
      if (t === 'recursos' && S) {
        var i = nav.recurso || 0;
        var mm3 = g.M && g.M[S.m];
        base.recurso = {
          i: i, n: d.NM[i], v: S.res[i],
          col: d.NC && d.NC[i] ? d.NC[i] : '#5cb8ff',
          desc: descripcionRecurso(i),
          consumo: S.res.map(function (v2, j) {
            return { n: d.NM[j], v: v2, delta: Math.round(v2 - 100) };
          }),
          eventos: (mm3 ? mm3.e : []).length,
          mission: mm3 ? mm3.n : ''
        };
        return base;
      }

      /* Un informe provisional antes del desenlace: el jugador consulta cómo
       * van los recursos sin cerrar la decisión en la que está. */
      if (t === 'informe_previo' && S) {
        base.previo = true;
        base.titulo = 'ESTADO DE MISIÓN';
        base.sub = (g.M && g.M[S.m] ? g.M[S.m].n : '') + ' · evento ' +
                   (S.i + 1) + ' de ' + (g.M && g.M[S.m] ? g.M[S.m].e.length : 0);
        base.res = S.res;
        base.NM = d.NM;
        base.NC = d.NC;
        base.dec = S.dec;
        base.inc = S.inc;
        base.decisiones = (S.log || []).slice(-6).map(function (l) {
          return { t: l.t, o: l.o || '',
                   d: (l.d || []).filter(Boolean).map(function (v2) {
                     return (v2 > 0 ? '+' : '') + v2; }).join(' '),
                   dn: (l.d || []).some(function (v2) { return v2 < -8; }) };
        });
        base.panel = datosPanelMision(S, g.M[S.m], g.M[S.m].e[Math.min(S.i, g.M[S.m].e.length - 1)]);
        return base;
      }

      base.tipo = 'vacio';
      base.titulo = 'CISLUNAR JUNIOR';
      base.aviso = '';
      return base;
    }

    /* Qué significa cada recurso y por qué hay que vigilarlo. */
    var DESC_RECURSO = [
      'Aire, agua y temperatura para la tripulación. Es lo que no admite retraso: ' +
      'si cae, no hay segunda oportunidad.',
      'Energía eléctrica de la nave. Baja el radar y las comunicaciones antes que ' +
      'los motores; con cuidado se alarga la misión.',
      'Blindaje contra la radiación. Se consume en tránsito y en las entradas ' +
      'atmosféricas; se recarga al pasar por el cinturón.',
      'Provisions y combustible de reserva. El combustible no se repone: cada maniobra ' +
      'que se retrase se paga con el margen de este número.',
      'Propelente total. Es el recurso con el que se paga cada maniobra: un delta-v ' +
      'de más sale de aquí y de ningún otro sitio.'
    ];

    function descripcionRecurso(i) {
      return DESC_RECURSO[i] || '';
    }

    function bloquesCreditos() {
      var mapa = (CJ.CREDITOS && CJ.CREDITOS.mapa) || {};
      var b = [];
      b.push(['AUTORÍA', 'Todo el código, los textos, la interfaz y el arte de este simulador son obra ' +
              'original de Cañon Labs para el NASA Space Apps Challenge 2026. No se ha copiado, ' +
              'rastreado ni modificado trabajo de terceros.']);
      b.push(['IMÁGENES (NASA, DOMINIO PÚBLICO)', 'Descargadas de images.nasa.gov, que publica material ' +
              'de la NASA en dominio público según sus guías de uso de medios.']);
      var ids = [];
      for (var k in mapa) {
        var c = mapa[k];
        ids.push((c.archivo || k) + ' · ' + (c.nasa_id || '—') + ' · ' + (c.licencia || 'Dominio público (NASA)'));
      }
      b.push(['ARCHIVOS', ids.join(' · ') || '—']);
      b.push(['DATOS', 'Fechas, duración y tripulación de Apolo 11 y 13: NASA Apollo Mission Reports. ' +
              'Artemis II: NASA. Marte: NASA/JPL datos públicos de misiones a Marte.']);
      b.push(['FÍSICA', 'Vis-viva, órbitas de Kepler, transferencia de Hohmann y ecuación de Tsiolkovski, ' +
              'todas de dominio público y calculadas aquí sin librerías externas.']);
      return b;
    }

    function reanudar() {
      var S = partida();
      if (S && S.phase === 'paused') S.phase = 'flight';
      nav.central = decisionAbierta() ? 'decision' : 'menu';
    }

    /* ================================================================== */
    /* PINTADO DE LA CABINA                                              */
    /* ================================================================== */

    /** Actualiza qué monitores se dibujan y devuelve la lista. */
    function monitoresVisibles() {
      var S = partida();
      var volando = !!(S && S.phase === 'flight');
      var ocultarCentral = !!(root.CJ && root.CJ.CABINA && root.CJ.CABINA.ocultarCentral);
      var central = !ocultarCentral && nav.central && nav.central !== 'nada' && nav.central !== 'vacio';
      CAB().CENTRAL.visible = central;
      return CAB().MONITORES;
    }

    function pintar(asp, cabYaw, cabPit) {
      if (!CAB() || !CAB().visible()) return false;
      var lista = monitoresVisibles();

      for (var i = 0; i < lista.length; i++) {
        var mon = lista[i];
        var d = null;
        if (mon.id === 'telemetria') d = datosTelemetria();
        else if (mon.id === 'comms') d = datosComms();
        else if (mon.id === 'sistemas') d = datosSistemas();
        else if (mon.id === 'mapa') d = datosMapa();
        else if (mon.id === 'checklist') d = datosChecklist();
        else if (mon.id === 'controles') d = datosControles();
        if (d) HUD().pintar(mon, d);
      }
      if (CAB().CENTRAL.visible) HUD().pintar(CAB().CENTRAL, datosCentral());

      return CAB().pintar({
        aspecto: asp, cabYaw: cabYaw || 0, cabPit: cabPit || 0,
        monitores: lista, incluirCentral: true
      });
    }

    /** Pinta un solo monitor: útil para pruebas y capturas. */
    function pintarMon(id, datos) {
      if (!CAB) return null;
      var mon = CAB().porId(id);
      if (!mon) return null;
      return HUD().pintar(mon, datos);
    }

    /**
     * Cambia la pantalla central y repinta sus elementos de golpe.
     * Es el camino que sigue el juego: sin este paso, la lista de `items`
     * seguiría apuntando a los botones de la pantalla anterior y Enter
     * pulsaría lo que el jugador no ve.
     */
    function abrir(tipo) {
      nav.central = tipo;
      if (!CAB) return null;
      var mon = CAB().CENTRAL;
      mon.visible = !!tipo && tipo !== 'nada';
      var cv = HUD().pintar(mon, datosCentral());
      /* El resaltado puede quedar fuera de rango al cambiar de pantalla: sin
       * este recorte, Enter intentaría activar un botón que ya no existe. */
      var l = CAB().itemsDe(mon.id) || [];
      if ((CAB().estado.sel[mon.id] || 0) >= l.length) CAB().estado.sel[mon.id] = 0;
      return cv;
    }

    /* ================================================================== */
    /* RUTÓN Y TECLADO                                                   */
    /* ================================================================== */

    /** Translada un clic de pantalla al monitor y elemento que hay debajo. */
    function enClic(clientX, clientY, asp, cabYaw, cabPit) {
      var hit = CAB().monitorBajoRaton(clientX, clientY, {
        aspecto: asp, cabYaw: cabYaw || 0, cabPit: cabPit || 0
      });
      if (!hit) { CAB().estado.hover = null; return null; }
      var it = CAB().itemEn(hit.mon, hit.u, hit.v);
      CAB().estado.hover = hit.mon.id;
      if (!it) return { mon: hit.mon, item: null };
      CAB().foco(hit.mon.id);
      CAB().estado.sel[hit.mon.id] = CAB().indiceDe(hit.mon, it);
      return { mon: hit.mon, item: it };
    }

    /* ================================================================== */
    /* API                                                               */
    /* ================================================================== */
    return {
      enlazar: enlazar,
      nav: nav,
      pintar: pintar,
      pintarMon: pintarMon,
      abrir: abrir,
      datosCentral: datosCentral,
      datosTelemetria: datosTelemetria,
      datosComms: datosComms,
      datosSistemas: datosSistemas,
      datosMapa: datosMapa,
      datosChecklist: datosChecklist,
      datosControles: datosControles,
      enClic: enClic,
      irMenu: irMenu,
      abrirMision: abrirMision,
      volver: volver,
      elegirOpcion: elegirOpcion,
      confirmar: confirmar,
      reintentar: reintentar,
      cambiarAsiento: cambiarAsiento,
      ajustar: ajustar,
      reanudar: reanudar,
      puedeDecidir: puedeDecidir,
      elementosDe: elementosDe
    };
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = CJ.CABINA;

})(typeof window !== 'undefined' ? window : this);
