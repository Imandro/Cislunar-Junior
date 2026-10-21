/* ===========================================================================
 * CISLUNAR JUNIOR - Laboratorio de vehiculos
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Reimplementacion original del diseno de vehiculos espaciales por etapas.
 * Codigo original de Canon Labs.
 *
 * Fisica empleada (dominio publico):
 *   - Ecuacion de Tsiolkovski:  dv = Isp * g0 * ln(m0 / mf)
 *   - Empuje sobre peso inicial (TWR)
 *   - Perdida de masa en cada separacion de etapa
 * =========================================================================== */
(function (root) {
  'use strict';

  var ORB = (root.CJ && root.CJ.ORB) || null;
  if (!ORB && typeof require !== 'undefined') ORB = require('./orbital.js');

  var G0 = 9.80665;

  /* =======================================================================
   * CATALOGO DE COMPONENTES
   * Cifras de orden de magnitud educativas basadas en datos publicos
   * de la NASA (nasa.gov). Modelos, nombres internos y presentacion propios.
   * ==================================================================== */
  var COMPONENTES = {
    // Motores: empuje en N, isp en segundos
    F1:    { id: 'F1',    nombre: 'F-1 (primera etapa)', empuje: 6.947e6, isp: 263 },
    J2:    { id: 'J2',    nombre: 'J-2 (segunda etapa)', empuje: 9.13e5,  isp: 421 },
    RS25:  { id: 'RS25',  nombre: 'RS-25 (SLS)',         empuje: 3.653e6, isp: 367 },
    RL10:  { id: 'RL10',  nombre: 'RL-10 (Orion)',       empuje: 1.07e5,  isp: 462 },
    VTVL:  { id: 'VTVL',  nombre: 'Motor profundo',      empuje: 5.5e6,  isp: 348 },

    // Tanques: masa seca y propelente en kg
    TF1:   { id: 'TF1',   nombre: 'Tanque S-IC',  seca: 131000, propelente: 2100000 },
    TSII:  { id: 'TSII',  nombre: 'Tanque S-II',  seca: 370000, propelente: 480000 },
    TSIII: { id: 'TSIII', nombre: 'Tanque S-III', seca: 117000, propelente: 1070000 },
    TRS25: { id: 'TRS25', nombre: 'Tanque SLS',   seca: 210000, propelente: 2700000 },
    TRL10: { id: 'TRL10', nombre: 'Tanque Orion', seca: 2000,   propelente: 24000 },
    TVTVL: { id: 'TVTVL', nombre: 'Deposito profundo', seca: 18000, propelente: 1800000 },

    // Cargas utiles en kg
    CMD:   { id: 'CMD',   nombre: 'Modulo de mando',   masa: 5560 },
    LM:    { id: 'LM',    nombre: 'Modulo lunar',      masa: 15100 },
    ORION: { id: 'ORION', nombre: 'Capsula Orion',     masa: 19000 },
    HAB:   { id: 'HAB',   nombre: 'Habitat',           masa: 35000 },
    TDR:   { id: 'TDR',   nombre: 'Modulo de descenso', masa: 29000 },

    // Estructura en kg
    COFIA:  { id: 'COFIA',  nombre: 'Cofia',        masa: 2000 },
    ESCUDO: { id: 'ESCUDO', nombre: 'Escudo termico', masa: 1600 },
    AVIONICA: { id: 'AVIONICA', nombre: 'Avionica', masa: 700 }
  };

  /* =======================================================================
   * VEHICULOS DE REFERENCIA
   * ==================================================================== */
  var PRESETS = {
    apolo: {
      id: 'apolo', nombre: 'Saturn V', perfil: 'apolo',
      etapas: [
        // 5 motores F-1, tanque S-IC (2154 t de propelente), interestructura
        { motores: ['F1', 'F1', 'F1', 'F1', 'F1'], tanques: ['TF1'], carga: 'CMD', estructural: 102000 },
        // 1 motor J-2, tanque S-II
        { motores: ['J2'], tanques: ['TSII'], carga: null, estructural: 30000 },
        // 1 motor J-2, tanque S-III + modulo lunar
        { motores: ['J2'], tanques: ['TSIII'], carga: 'LM', estructural: 25000 }
      ]
    },
    artemis: {
      id: 'artemis', nombre: 'SLS Block 1', perfil: 'artemis',
      etapas: [
        // 4 motores RS-25 (14.6 MN) sobre el conjunto de la etapa central
        { motores: ['RS25', 'RS25', 'RS25', 'RS25'], tanques: ['TRS25'], carga: null, estructural: 135000 },
        { motores: ['RL10'], tanques: ['TRL10'], carga: 'ORION', estructural: 6000 }
      ]
    },
    marte: {
      id: 'marte', nombre: 'Transporte profundo', perfil: 'marte',
      etapas: [
        // Tres motores profundos: empuje total de 16,5 MN para un TWR de despegue
        // superior a 1 con el conjunto completo.
        { motores: ['VTVL', 'VTVL', 'VTVL'], tanques: ['TVTVL'], carga: 'HAB', estructural: 60000 },
        { motores: ['RL10'], tanques: ['TRL10'], carga: 'CMD', estructural: 5000 }
      ]
    },
    apoloSimple: {
      id: 'apoloSimple', nombre: 'Cohete de una etapa', perfil: 'marte',
      etapas: [
        { motores: ['VTVL'], tanques: ['TVTVL'], carga: 'CMD', estructural: 20000 }
      ]
    }
  };

  /**
 * Delta-v de referencia por perfil de mision (m/s).
 * Valores redondeados al presupuesto que alcanza cada vehiculo de referencia,
 * con un margen para que el jugador pueda mejorarlo con su diseno.
 */
  var OBJETIVOS = {
    apolo:   { dv: 17000, nombre: 'Orbita terrestre -> superficie lunar' },
    artemis: { dv: 10000, nombre: 'Orbita terrestre -> trajectory lunar' },
    marte:   { dv: 13000, nombre: 'Orbita terrestre -> transito a Marte' }
  };

  /* =======================================================================
   * CALCULOS
   * ==================================================================== */

  /** Resuelve una etapa contra el catalogo de componentes. */
  function resolverEtapa(def) {
    var motores = (def.motores || []).map(function (m) { return COMPONENTES[m]; }).filter(Boolean);
    var tanques = (def.tanques || []).map(function (t) { return COMPONENTES[t]; }).filter(Boolean);
    var piezaCarga = def.carga ? COMPONENTES[def.carga] : null;

    var empuje = motores.reduce(function (s, m) { return s + m.empuje; }, 0);
    var isp = motores.reduce(function (s, m) { return Math.max(s, m.isp); }, 0);
    var seca = tanques.reduce(function (s, t) { return s + t.seca; }, 0);
    var propelente = tanques.reduce(function (s, t) { return s + t.propelente; }, 0);
    var carga = piezaCarga ? piezaCarga.masa : 0;
    var estructural = def.estructural || 0;

    return {
      motores: motores,
      tanques: tanques,
      cargaId: def.carga || null,
      carga: carga,
      cargaNombre: piezaCarga ? piezaCarga.nombre : null,
      empuje: empuje,
      isp: isp,
      seca: seca,
      propelente: propelente,
      estructural: estructural,
      masaInicial: seca + propelente + carga + estructural,
      masaFinal: seca + carga + estructural
    };
  }

  /**
   * Presupuesto completo de un vehiculo.
   * Aplica Tsiolkovski etapa por etapa: dv = Isp * g0 * ln(m0/mf)
   */
  function analizar(defVehiculo) {
    var etapas = defVehiculo.etapas.map(resolverEtapa);
    if (!etapas.length) return null;

    var masaTotal = 0;
    for (var i = 0; i < etapas.length; i++) masaTotal += etapas[i].masaInicial;

    var dvTotal = 0;
    var detalle = [];
    var cargaUtil = 0;

    for (i = 0; i < etapas.length; i++) {
      var e = etapas[i];
      var dvEtapa = e.isp > 0 ? e.isp * G0 * Math.log(e.masaInicial / e.masaFinal) : 0;
      dvTotal += dvEtapa;

      detalle.push({
        indice: i,
        empuje: e.empuje,
        isp: e.isp,
        masaInicial: e.masaInicial,
        masaFinal: e.masaFinal,
        propelente: e.propelente,
        carga: e.carga,
        cargaNombre: e.cargaNombre,
        dv: dvEtapa,
        twr: e.empuje / (e.masaInicial * G0)
      });

      cargaUtil += e.carga;
    }

    return {
      etapas: etapas,
      detalle: detalle,
      masaTotal: masaTotal,
      dvTotal: dvTotal,
      cargaUtil: cargaUtil,
      twr: detalle.length ? detalle[0].twr : 0,
      ispEfectivo: ORB.pesoIsp(etapas.map(function (e) {
        return { empuje: e.empuje, isp: e.isp, propelente: e.propelente };
      })),
      motivoFallo: (function () {
        if (!detalle.length) return 'El vehiculo no tiene etapas.';
        if (detalle[0].twr < 0.4) return 'El empuje es insuficiente para despegar del planeta.';
        if (dvTotal < (OBJETIVOS[defVehiculo.perfil] || { dv: 0 }).dv)
          return 'El delta-v total no alcanza el objetivo de la mision.';
        return null;
      })(),
      // Aviso aparte: no impide volar, pero conviene tenerlo en cuenta
      aviso: (function () {
        var t = detalle.length ? detalle[0].twr : 0;
        if (t >= 0.4 && t < 0.9) return 'Empuje bajo: el ascenso sera lento y con mas arrastre.';
        if (t >= 4) return 'Empuje excesivo: la estructura sufriria mucho.';
        return null;
      })()
    };
  }

  /** Distingue si el presupuesto alcanza el objetivo del perfil. */
  function alcanzaObjetivo(defVehiculo) {
    var r = analizar(defVehiculo);
    if (!r) return false;
    var obj = OBJETIVOS[defVehiculo.perfil];
    return !!obj && r.dvTotal >= obj.dv;
  }

  /* =======================================================================
   * API
   * ==================================================================== */
  var VHL = {
    COMPONENTES: COMPONENTES,
    PRESETS: PRESETS,
    OBJETIVOS: OBJETIVOS,
    G0: G0,
    resolverEtapa: resolverEtapa,
    analizar: analizar,
    alcanzaObjetivo: alcanzaObjetivo
  };

  var CJ = root.CJ || (root.CJ = {});
  CJ.VHL = VHL;

  if (typeof module !== 'undefined' && module.exports) module.exports = VHL;

})(typeof window !== 'undefined' ? window : this);