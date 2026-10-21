/* =======================================================================
 * CISLUNAR JUNIOR - Consecuencias del vuelo sobre la misión
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Antes el vuelo manual era un minijuego desconectado: `salirModoVuelo`
 * leía el resultado, lo escribía en el log y lo tiraba. Aquí el resultado
 * real del motor de física se traduce a efectos sobre la partida:
 *
 *   1. `costeDeltaV`  — el propelente baja MIENTRAS se quema, no al final.
 *   2. `evaluar`      — el desenlace (órbita lograda, descenso suave o
 *                       impacto) ajusta los cinco recursos de S.res.
 *   3. `agotado`      — qué recurso, si alguno, queda por debajo de cero.
 *
 * Todo aquí es puro: mismas entradas, mismas salidas. Sin DOM, sin Math.random.
 * Así se puede comprobar con `node tools\prueba_mision.js`.
 * ==================================================================== */
'use strict';

var CJ = window.CJ || (window.CJ = {});

CJ.MISION = (function () {

  /* ---------------------------------------------------------------------
   * Índices de recursos, igual que NM en la consola:
   *   0 Soporte vital · 1 Energía · 2 Protección radiación
   *   3 Agua y alimento · 4 Propelente
   * ------------------------------------------------------------------ */
  var REC = {
    vida: 0, energia: 1, radiacion: 2, agua: 3, prop: 4
  };

  var R_VIDA = REC.vida, R_ENER = REC.energia,
      R_RAD = REC.radiacion, R_AGUA = REC.agua, R_PROP = REC.prop;

  /* Metros por segundo de Δv por cada punto de propelente. Calibrado contra
   * la narrativa del propio juego: en Apolo 11 la TLI (3.150 m/s) cuesta 11
   * puntos, es decir ~286 m/s por punto. Redondeado a 300. */
  var MPS_POR_PUNTO = 300;

  /* Consecuencias del desenlace. Deltas sobre S.res, en puntos. */
  var EFECTO = {
    orbita:      [1, 1, 0, 0, 0],        // órbita estable lograda
    tiempo:      [0, -1, 0, -1, 0],     // fase de duración cumplida
    divergencia: [-6, -3, -5, -5, -2],  // guía perdida: la física dejó de valer
    aterrizaje:  [0, -1, -1, -2, 0],    // toque suave
    aterrizajeDuro: [-22, -10, -15, -12, 0],
    /* La etapa se pierde con el propelente que le quedaba. */
    impacto:     [-30, -20, -18, -18, -10]
  };

  /* Umbrales de carga. Por encima castigan; por debajo no. */
  var G_TOPE = 6;      // g sostenidos que el cuerpo tolera sin pérdida
  var G_POR_PUNTO = 2; // g de más por cada punto de soporte vital
  var Q_TOPE = 40;     // kPa de presión dinámica segura
  var Q_POR_PUNTO = 25;

  /** Puntos de propelente que cuesta un Δv dado, en m/s. */
  function costeDeltaV(dv) {
    if (!(dv > 0)) return 0;
    return dv / MPS_POR_PUNTO;
  }

  /** Deltas de un Δv ya gastado (uso interno de `evaluar`). */
  function deltasPorDeltaV(dv) {
    var d = [0, 0, 0, 0, 0];
    d[R_PROP] -= costeDeltaV(dv);
    return d;
  }

  /** Primer recurso que toca suelo o se va por debajo; -1 si todos aguantan. */
  function agotado(res) {
    for (var i = 0; i < res.length; i++) if (res[i] <= 0) return i;
    return -1;
  }

  /** Medida de "lo bien que se voló": 0 = desastre, 1 = nominal. */
  function calidad(m, tipo) {
    var c = 1;
    if (!m) return c;
    if (m.gMax > G_TOPE) c -= (m.gMax - G_TOPE) / (G_POR_PUNTO * 4);
    if (m.qMax > Q_TOPE) c -= (m.qMax - Q_TOPE) / (Q_POR_PUNTO * 3);
    var fuera = m.fueraZona || 0;
    if (fuera > 5) c -= Math.min(0.3, fuera / 400);
    var prop = m.propUsado || m.prop || 0;
    var masa = m.masaInicial || 0;
    if (masa > 0 && prop > masa) c -= 0.15;
    if (tipo === 'aterrizajeDuro' || tipo === 'impacto') c -= 0.5;
    return c < 0 ? 0 : (c > 1 ? 1 : c);
  }

  /** Suma de deltas, con clamp a un rango para que nada desborde. */
  function sumar(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]]; }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  /* ---------------------------------------------------------------------
   * EVALUAR: traducción del desenlace del motor a efectos de partida.
   * `res`  → resultado.fin devuelto por CJ.FLT.step cuando estado==='complete'
   * `med`  → métricas de vuelo (dvGastado, gMax, qMax, fueraZona, propUsado)
   * Devuelve { exito, tipo, titulo, detalle, deltas } con deltas = [-100..100] ×5.
   * ------------------------------------------------------------------ */
  function evaluar(res, med) {
    var tipo = res && res.tipo;
    var d, titulo, detalle, exito;

    if (tipo === 'aterrizaje') {
      var suave = !!res.exito;
      var vv = (res.velVertical != null && isFinite(res.velVertical)) ? res.velVertical : 0;
      if (suave) {
        d = EFECTO.aterrizaje.slice();
        exito = true;
        titulo = 'Alunizaje / aterrizaje logrado';
        detalle = 'Contacto con la superficie a ' + vv.toFixed(2) + ' m/s verticales. ' +
                  'La tripulación y el vehículo quedan operativos.';
      } else {
        d = EFECTO.aterrizajeDuro.slice();
        exito = false;
        titulo = 'Impacto contra la superficie';
        detalle = 'Contacto a ' + vv.toFixed(2) + ' m/s verticales: demasiado rápido ' +
                  'para el sistema de aterrizaje. Daños estructurales y en la tripulación.';
      }
      // Penalización extra por dureza creciente del contacto.
      if (vv > 3) {
        var extra = Math.round(clamp((vv - 3) / 2, 0, 12));
        d[R_VIDA] -= extra * 0.6;
        d[R_RAD] -= extra * 0.4;
      }
    } else if (tipo === 'fallo') {
      d = EFECTO.impacto.slice();
      exito = false;
      titulo = 'Vuelo perdido';
      detalle = 'El vehículo impactó antes de cumplir la fase (' +
                (res.razon || 'caída') + '). Pérdida de la etapa.';
      if (res.razon && /numer/i.test(res.razon)) d = EFECTO.divergencia.slice();
    } else if (tipo === 'numerico') {
      d = EFECTO.divergencia.slice();
      exito = false;
      titulo = 'Simulación no convergente';
      detalle = res.razon || 'La integración se desbordó; no hay desenlace físico.';
    } else if (tipo === 'apogeo') {
      d = EFECTO.orbita.slice();
      exito = true;
      titulo = 'Apogeo alcanzado';
      detalle = 'El cohete llego a ' + Math.round((res.altMax || 0) / 1000) +
                ' km de altitud con ' + Math.round((res.velMag || 0)) +
                ' m/s de velocidad. La mision sigue: la insercion orbital completa queda fuera del alcance de este vehiculo, y eso es fisica real.';
    } else if (tipo === 'tiempo') {
      d = EFECTO.tiempo.slice();
      exito = true;
      titulo = 'Fase de duración cumplida';
      detalle = 'Maniobra sostenida completada dentro del margen de consumo.';
    } else {
      /* orbita y cualquier otro tipo que el motor añada en el futuro */
      d = EFECTO.orbita.slice();
      exito = true;
      titulo = 'Órbita alcanzada';
      detalle = 'Órbita estable: perigeo ' + Math.round((res.perigeo || 0) / 1000) +
                ' km, apogeo ' + Math.round((res.apogeo || 0) / 1000) + ' km.';
      if (res.e != null) detalle += ' Excentricidad ' + res.e.toFixed(3) + '.';
    }

    /* Efectos acumulados durante el vuelo: cargas, presión dinámica y
     * propelente ya quemado. Se aplican sobre el desenlace, no en su lugar. */
    if (med) {
      var gx = (med.gMax || 0) - G_TOPE;
      if (gx > 0) {
        var vida = Math.round(clamp(gx / G_POR_PUNTO, 0, 8));
        d[R_VIDA] -= vida;
        if (vida > 0) detalle += ' Cargas de hasta ' + med.gMax.toFixed(1) +
                                    ' g sobre la tripulación.';
      }
      if ((med.qMax || 0) > Q_TOPE) {
        var est = Math.round(clamp((med.qMax - Q_TOPE) / Q_POR_PUNTO, 0, 8));
        d[R_ENER] -= est;
        if (est > 0) detalle += ' Presión dinámica máxima ' +
                                    Math.round(med.qMax) + ' kPa: esfuerzo estructural.';
      }
    }

    /* El Δv gastado ya se fue descontando en vivo; aquí sólo la factura final
     * del propulsor si acaso quedó sedimento (propUsado no cubierto). */
    d = sumar(d, deltasPorDeltaV((med && med.dvSedimento) || 0));

    for (var i = 0; i < 5; i++) d[i] = Math.round(clamp(d[i], -100, 100));

    return { exito: exito, tipo: tipo, titulo: titulo, detalle: detalle, deltas: d };
  }

  /* ---- api pública ---- */
  return {
    REC: REC,
    MPS_POR_PUNTO: MPS_POR_PUNTO,
    G_TOPE: G_TOPE,
    Q_TOPE: Q_TOPE,
    costeDeltaV: costeDeltaV,
    agotado: agotado,
    evaluar: evaluar,
    calidad: calidad
  };
})();

/* Cargable en node para las pruebas */
if (typeof module !== 'undefined' && module.exports) module.exports = CJ.MISION;
