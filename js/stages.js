/* =======================================================================
 * CISLUNAR JUNIOR - Stage Manager / Checklist
 * Cañon Labs - NASA Space Apps Challenge 2026
 * Gestión de separación de etapas y checklists por misión/vehículo
 * ==================================================================== */
'use strict';

var CJ = window.CJ || (window.CJ = {});
CJ.STG = (function () {
  // Checklists por vehículo y fase
  var CHECKLISTS = {
    saturnV: {
      ascenso: [
        { key: 'prelaunch', stage: -1, notas: 'Verificación GO/NO-GO completa', requerido: true },
        { key: 'ignition', stage: 0, notas: 'Encendido 5x F-1 confirmado', requerido: true },
        { key: 'liftoff', stage: 0, notas: 'Despegue - torre liberada', requerido: true },
        { key: 'roll', stage: 0, notas: 'Programa de giro iniciado (T+10s)', requerido: true },
        { key: 'maxq', stage: 0, notas: 'Max-Q - Throttle 85% (T+40s)', requerido: false },
        { key: 'meco_ic', stage: 0, notas: 'Corte central S-IC (T+135s)', requerido: true },
        { key: 'sep_sic', stage: 0, notas: '■ SEPARAR S-IC [ESPACIO]', requerido: true, accion: 'stage' },
        { key: 'ign_sii', stage: 1, notas: 'Encendido 5x J-2 S-II confirmado', requerido: true },
        { key: 'sep_sii', stage: 1, notas: '■ SEPARAR S-II [ESPACIO]', requerido: true, accion: 'stage' },
        { key: 'ign_sivb1', stage: 2, notas: 'Encendido J-2 S-IVB (1ª quemada)', requerido: true },
        { key: 'seco_sivb1', stage: 2, notas: 'SECO S-IVB - Órbita parking', requerido: true },
        { key: 'tli_prep', stage: 2, notas: 'Verificación sistemas para TLI', requerido: false },
        { key: 'tli_burn', stage: 2, notas: '■ QUemar TLI [ESPACIO]', requerido: true, accion: 'tli' }
      ],
      tli: [
        { key: 'tli_align', stage: 2, notas: 'Alineación plataforma inercial', requerido: true },
        { key: 'tli_burn', stage: 2, notas: '■ EJECUTAR TLI (3150 m/s) [ESPACIO]', requerido: true, accion: 'tli' },
        { key: 'tli_cutoff', stage: 2, notas: 'Corte S-IVB - Rumbo a la Luna', requerido: true }
      ],
      transposition: [
        { key: 'sep_csm', stage: 2, notas: 'Separación CSM de S-IVB', requerido: true },
        { key: 'turnaround', stage: 2, notas: 'Giro 180° (transposición)', requerido: true },
        { key: 'dock', stage: 2, notas: '■ ACOPLAR con LM [ESPACIO]', requerido: true, accion: 'dock' },
        { key: 'eject', stage: 2, notas: 'Eyección CSM+LM de S-IVB', requerido: true }
      ]
    },
    lm: {
      descenso: [
        { key: 'doi', stage: 0, notas: 'DOI - Descenso órbita 15 km', requerido: true },
        { key: 'pdi', stage: 0, notas: '■ PDI - Encendido motor descenso [ESPACIO]', requerido: true, accion: 'pdi' },
        { key: 'braking', stage: 0, notas: 'Frenado: throttle 65% → 45%', requerido: false },
        { key: 'approach', stage: 0, notas: 'Aproximación: pitch up, ventana', requerido: false },
        { key: 'landing', stage: 0, notas: '■ ATERRIZAJE manual [ESPACIO]', requerido: true, accion: 'land' },
        { key: 'shutdown', stage: 0, notas: 'Corte motor - Contact probes', requerido: true }
      ]
    },
    starship: {
      ascenso: [
        { key: 'ignition', stage: 0, notas: 'Encendido 33x Raptor Super Heavy', requerido: true },
        { key: 'liftoff', stage: 0, notas: 'Despegue', requerido: true },
        { key: 'maxq', stage: 0, notas: 'Max-Q - Throttle down', requerido: false },
        { key: 'meco', stage: 0, notas: 'MECO Super Heavy', requerido: true },
        { key: 'hotstage', stage: 0, notas: '■ HOT-STAGING [ESPACIO]', requerido: true, accion: 'stage' },
        { key: 'boostback', stage: 0, notas: 'Boostback burn (booster)', requerido: false },
        { key: 'ign_ship', stage: 1, notas: 'Encendido 6x Raptor Ship', requerido: true },
        { key: 'sep_fairing', stage: 1, notas: '■ Separar cofia [ESPACIO]', requerido: true, accion: 'fairing' },
        { key: 'orbit', stage: 1, notas: 'SECO Ship - Órbita alcanzada', requerido: true }
      ],
      entrada: [
        { key: 'entry_if', stage: 0, notas: 'Entry Interface 125 km', requerido: true },
        { key: 'peak_heat', stage: 0, notas: 'Peak heating - Bank 15°', requerido: false },
        { key: 'max_g', stage: 0, notas: 'Max G-load - Bank 30-45°', requerido: false },
        { key: 'belly_flop', stage: 1, notas: '■ BELLY FLOP - Bank 90° [ESPACIO]', requerido: true, accion: 'flop' },
        { key: 'glide', stage: 1, notas: 'Planeo horizontal controlado', requerido: false },
        { key: 'flip', stage: 2, notas: '■ FLIP MANEUVER - Vertical [ESPACIO]', requerido: true, accion: 'flip' },
        { key: 'landing_burn', stage: 2, notas: 'Encendido Raptors landing', requerido: true },
        { key: 'touchdown', stage: 2, notas: '■ TOUCHDOWN [ESPACIO]', requerido: true, accion: 'land' }
      ]
    },
    sls: {
      ascenso: [
        { key: 'ignition', stage: 0, notas: 'Encendido 4x RS-25 + 2x SRB', requerido: true },
        { key: 'liftoff', stage: 0, notas: 'Despegue', requerido: true },
        { key: 'sr_sep', stage: 0, notas: '■ SEPARAR SRB [ESPACIO]', requerido: true, accion: 'stage' },
        { key: 'core_meco', stage: 1, notas: 'MECO Core Stage', requerido: true },
        { key: 'core_sep', stage: 1, notas: '■ SEPARAR Core [ESPACIO]', requerido: true, accion: 'stage' },
        { key: 'icps_ign', stage: 2, notas: 'Encendido ICPS (RL10)', requerido: true },
        { key: 'icps_seco', stage: 2, notas: 'SECO ICPS - Órbita parking', requerido: true }
      ]
    },
    orion: {
      entrada: [
        { key: 'entry_if', stage: 0, notas: 'Entry Interface 122 km', requerido: true },
        { key: 'peak_heat', stage: 0, notas: 'Peak heating - Bank control', requerido: false },
        { key: 'max_g', stage: 0, notas: 'Max G-load ~9g', requerido: false },
        { key: 'drogue', stage: 1, notas: '■ DESPLEGAR DROGUE [ESPACIO]', requerido: true, accion: 'drogue' },
        { key: 'main', stage: 1, notas: '■ DESPLEGAR MAIN [ESPACIO]', requerido: true, accion: 'main' },
        { key: 'splashdown', stage: 1, notas: 'Aterrizaje en agua', requerido: true }
      ]
    },
    // Vehículos adicionales
    csm_lm: {
      transposition: [
        { key: 'sep_csm', stage: 2, notas: 'Separación CSM de S-IVB', requerido: true },
        { key: 'turnaround', stage: 2, notas: 'Giro 180° (transposición)', requerido: true },
        { key: 'dock', stage: 2, notas: '■ ACOPLAR con LM [ESPACIO]', requerido: true, accion: 'dock' },
        { key: 'eject', stage: 2, notas: 'Eyección CSM+LM de S-IVB', requerido: true }
      ],
      acople: [
        { key: 'sep_csm', stage: 2, notas: 'Separación CSM de S-IVB', requerido: true },
        { key: 'turnaround', stage: 2, notas: 'Giro 180° (transposición)', requerido: true },
        { key: 'dock', stage: 2, notas: '■ ACOPLAR con LM [ESPACIO]', requerido: true, accion: 'dock' },
        { key: 'eject', stage: 2, notas: 'Eyección CSM+LM de S-IVB', requerido: true }
      ]
    },
    lm_eagle: {
      descenso: [
        { key: 'doi', stage: 0, notas: 'DOI - Descenso órbita 15 km', requerido: true },
        { key: 'pdi', stage: 0, notas: '■ PDI - Encendido motor descenso [ESPACIO]', requerido: true, accion: 'pdi' },
        { key: 'braking', stage: 0, notas: 'Frenado: throttle 65% → 45%', requerido: false },
        { key: 'approach', stage: 0, notas: 'Aproximación: pitch up, ventana', requerido: false },
        { key: 'landing', stage: 0, notas: '■ ATERRIZAJE manual [ESPACIO]', requerido: true, accion: 'land' },
        { key: 'shutdown', stage: 0, notas: 'Corte motor - Contact probes', requerido: true }
      ]
    },
    lm_ascent: {
      ascenso: [
        { key: 'prep', stage: 0, notas: 'Preparación etapa de ascenso', requerido: true },
        { key: 'ignition', stage: 0, notas: '■ ENCENDIDO motor ascenso [ESPACIO]', requerido: true, accion: 'ignition' },
        { key: 'pitch', stage: 0, notas: 'Programa de pitch - actitud orbital', requerido: false },
        { key: 'seco', stage: 0, notas: 'SECO - Órbita alcanzada', requerido: true },
        { key: 'rendezvous', stage: 0, notas: 'Maniobra de rendez-vous con CSM', requerido: false },
        { key: 'dock', stage: 0, notas: '■ ACOPLAR con CSM [ESPACIO]', requerido: true, accion: 'dock' }
      ]
    },
    cm_columbia: {
      entrada: [
        { key: 'entry_if', stage: 0, notas: 'Entry Interface 122 km', requerido: true },
        { key: 'peak_heat', stage: 0, notas: 'Peak heating - Bank control', requerido: false },
        { key: 'max_g', stage: 0, notas: 'Max G-load ~6g', requerido: false },
        { key: 'drogue', stage: 1, notas: '■ DESPLEGAR DROGUE [ESPACIO]', requerido: true, accion: 'drogue' },
        { key: 'main', stage: 1, notas: '■ DESPLEGAR MAIN [ESPACIO]', requerido: true, accion: 'main' },
        { key: 'splashdown', stage: 1, notas: 'Amarizaje en Pacífico', requerido: true }
      ]
    },
    lm_aquarius: {
      maniobra: [
        { key: 'prep', stage: 0, notas: 'Preparación quemada PC+2', requerido: true },
        { key: 'align', stage: 0, notas: 'Alineación plataforma inercial LM', requerido: true },
        { key: 'burn', stage: 0, notas: '■ EJECUTAR PC+2 (260s) [ESPACIO]', requerido: true, accion: 'burn' },
        { key: 'cutoff', stage: 0, notas: 'Corte motor - Trayectoria retorno libre', requerido: true },
        { key: 'mcc', stage: 0, notas: 'Correcciones de trayectoria (MCC)', requerido: false }
      ],
      ascenso: [
        { key: 'prep', stage: 0, notas: 'Preparación etapa de ascenso', requerido: true },
        { key: 'ignition', stage: 0, notas: '■ ENCENDIDO motor ascenso [ESPACIO]', requerido: true, accion: 'ignition' },
        { key: 'pitch', stage: 0, notas: 'Programa de pitch - actitud orbital', requerido: false },
        { key: 'seco', stage: 0, notas: 'SECO - Órbita alcanzada', requerido: true },
        { key: 'rendezvous', stage: 0, notas: 'Maniobra de rendez-vous con CSM', requerido: false },
        { key: 'dock', stage: 0, notas: '■ ACOPLAR con CSM [ESPACIO]', requerido: true, accion: 'dock' }
      ]
    },
    cm_odyssey: {
      entrada: [
        { key: 'entry_if', stage: 0, notas: 'Entry Interface 122 km', requerido: true },
        { key: 'peak_heat', stage: 0, notas: 'Peak heating - Bank control', requerido: false },
        { key: 'max_g', stage: 0, notas: 'Max G-load ~6g', requerido: false },
        { key: 'drogue', stage: 1, notas: '■ DESPLEGAR DROGUE [ESPACIO]', requerido: true, accion: 'drogue' },
        { key: 'main', stage: 1, notas: '■ DESPLEGAR MAIN [ESPACIO]', requerido: true, accion: 'main' },
        { key: 'splashdown', stage: 1, notas: 'Amarizaje en Pacífico', requerido: true }
      ]
    },
    icps: {
      tli: [
        { key: 'align', stage: 2, notas: 'Alineación plataforma inercial', requerido: true },
        { key: 'tli_burn', stage: 2, notas: '■ EJECUTAR TLI [ESPACIO]', requerido: true, accion: 'tli' },
        { key: 'cutoff', stage: 2, notas: 'Corte RL10 - Rumbo a la Luna', requerido: true }
      ]
    },
    deep_transport: {
      tmi: [
        { key: 'align', stage: 0, notas: 'Alineación para inyección Trans-Marte', requerido: true },
        { key: 'tmi_burn', stage: 0, notas: '■ EJECUTAR TMI (2.9 km/s) [ESPACIO]', requerido: true, accion: 'tmi' },
        { key: 'cutoff', stage: 0, notas: 'Corte motor - Transferencia Hohmann', requerido: true }
      ],
      moi: [
        { key: 'prep', stage: 0, notas: 'Preparación escudo térmico y captura', requerido: true },
        { key: 'moi_burn', stage: 0, notas: '■ EJECUTAR MOI [ESPACIO]', requerido: true, accion: 'moi' },
        { key: 'capture', stage: 0, notas: 'Captura orbital marciana confirmada', requerido: true }
      ]
    },
    mars_descent: {
      edl: [
        { key: 'entry_if', stage: 0, notas: 'Entry Interface 125 km', requerido: true },
        { key: 'peak_heat', stage: 0, notas: 'Peak heating - aeroshell', requerido: false },
        { key: 'max_g', stage: 0, notas: 'Max G-load ~12g', requerido: false },
        { key: 'parachute', stage: 1, notas: '■ DESPLEGAR PARACAÍDAS [ESPACIO]', requerido: true, accion: 'parachute' },
        { key: 'heat_shield', stage: 1, notas: 'Separar escudo térmico', requerido: true },
        { key: 'retro', stage: 2, notas: '■ ENCENDER RETROCOHETES [ESPACIO]', requerido: true, accion: 'retro' },
        { key: 'touchdown', stage: 2, notas: '■ TOUCHDOWN [ESPACIO]', requerido: true, accion: 'land' }
      ]
    },
    mars_ascent: {
      ascenso: [
        { key: 'prep', stage: 0, notas: 'Preparación vehículo de ascenso', requerido: true },
        { key: 'ignition', stage: 0, notas: '■ ENCENDIDO motor ascenso [ESPACIO]', requerido: true, accion: 'ignition' },
        { key: 'pitch', stage: 0, notas: 'Programa de pitch - órbita de encuentro', requerido: false },
        { key: 'seco', stage: 0, notas: 'SECO - Órbita alcanzada', requerido: true },
        { key: 'rendezvous', stage: 0, notas: 'Rendez-vous con transporte', requerido: false },
        { key: 'dock', stage: 0, notas: '■ ACOPLAR con transporte [ESPACIO]', requerido: true, accion: 'dock' }
      ]
    }
  };

  // Estado actual
  var currentChecklist = [];
  var currentVehicle = 'saturnV';
  var currentPhase = 'ascenso';
  var completedItems = new Set();
  var pendingAction = null; // {key, action, resolve}
  var onActionRequired = null;

  function init(vehiculo, fase) {
    currentVehicle = vehiculo;
    currentPhase = fase;
    var cl = CHECKLISTS[vehiculo] && CHECKLISTS[vehiculo][fase];
    currentChecklist = cl ? JSON.parse(JSON.stringify(cl)) : [];
    completedItems.clear();
    pendingAction = null;
    return currentChecklist;
  }

  function getChecklist() { return currentChecklist; }

  function getCurrentItem() {
    return currentChecklist.find(item => !completedItems.has(item.key));
  }

  function getItemsForStage(stage) {
    return currentChecklist.filter(item => item.stage === stage);
  }

  function markComplete(key) {
    completedItems.add(key);
    var item = currentChecklist.find(i => i.key === key);
    if (item && item.accion) {
      pendingAction = { key: key, action: item.accion };
      return item.accion;
    }
    return null;
  }

  function confirmAction(key) {
    if (pendingAction && pendingAction.key === key) {
      pendingAction = null;
      return true;
    }
    return false;
  }

  function getPendingAction() { return pendingAction; }

  function isItemDone(key) { return completedItems.has(key); }

  function getProgress() {
    var total = currentChecklist.filter(i => i.requerido).length;
    var done = currentChecklist.filter(i => i.requerido && completedItems.has(i.key)).length;
    return { total: total, done: done, pct: total ? done/total : 1 };
  }

  function setActionCallback(cb) { onActionRequired = cb; }

  function triggerAction(action) {
    if (onActionRequired) onActionRequired(action);
  }

  // Generar checklist dinámico desde perfil de vuelo
  function generarDesdePerfil(perfil, vehiculo) {
    var items = [];
    var stage = -1;
    perfil.forEach(function(p, i) {
      if (p.stage !== undefined && p.stage > stage) {
        stage = p.stage;
        items.push({
          key: 'stage_'+stage,
          stage: stage,
          notas: '■ ETAPA '+ (stage+1) +': '+ (CJ.FLT.VEHICULOS[vehiculo].etapas[stage]?.nombre || 'Desconocida'),
          requerido: true,
          accion: 'stage'
        });
      }
      if (p.notas && p.notas.includes('■')) {
        items.push({
          key: 'action_'+i,
          stage: stage,
          notas: p.notas,
          requerido: true,
          accion: 'manual'
        });
      }
    });
    return items;
  }

  // Checklist genérico para cualquier vehículo/fase
  function getGenericChecklist(vehiculo, fase) {
    var veh = CJ.FLT.VEHICULOS[vehiculo];
    if (!veh) return [];

    if (fase === 'ascenso') {
      var items = [{ key: 'prelaunch', stage: -1, notas: 'Verificación final GO/NO-GO', requerido: true }];
      veh.etapas.forEach(function(stg, i) {
        items.push({ key: 'ign_'+i, stage: i, notas: 'Encendido '+stg.nombre+' confirmado', requerido: true });
        if (i < veh.etapas.length - 1) {
          items.push({ key: 'sep_'+i, stage: i, notas: '■ SEPARAR '+stg.nombre+' [ESPACIO]', requerido: true, accion: 'stage' });
        } else {
          items.push({ key: 'seco_'+i, stage: i, notas: 'SECO '+stg.nombre+' - Órbita', requerido: true });
        }
      });
      return items;
    }
    if (fase === 'descenso') {
      return [
        { key: 'orbit', stage: 0, notas: 'Órbita de descenso establecida', requerido: true },
        { key: 'pdi', stage: 0, notas: '■ PDI - Iniciar descenso [ESPACIO]', requerido: true, accion: 'pdi' },
        { key: 'braking', stage: 0, notas: 'Fase de frenado', requerido: false },
        { key: 'approach', stage: 0, notas: 'Aproximación final', requerido: false },
        { key: 'land', stage: 0, notas: '■ ATERRIZAJE [ESPACIO]', requerido: true, accion: 'land' }
      ];
    }
    if (fase === 'entrada') {
      return [
        { key: 'entry', stage: 0, notas: 'Entry Interface', requerido: true },
        { key: 'peak', stage: 0, notas: 'Peak heating', requerido: false },
        { key: 'maxg', stage: 0, notas: 'Max G-load', requerido: false },
        { key: 'chute1', stage: 1, notas: '■ PARACAÍDAS DROGUE [ESPACIO]', requerido: true, accion: 'drogue' },
        { key: 'chute2', stage: 1, notas: '■ PARACAÍDAS MAIN [ESPACIO]', requerido: true, accion: 'main' },
        { key: 'land', stage: 1, notas: 'Aterrizaje', requerido: true }
      ];
    }
    if (fase === 'acople') {
      return [
        { key: 'sep', stage: 0, notas: 'Separación de etapa superior', requerido: true },
        { key: 'turn', stage: 0, notas: 'Giro 180° (transposición)', requerido: true },
        { key: 'dock', stage: 0, notas: '■ ACOPLAMIENTO [ESPACIO]', requerido: true, accion: 'dock' },
        { key: 'eject', stage: 0, notas: 'Eyección del vehículo', requerido: true }
      ];
    }
    if (fase === 'hover') {
      return [
        { key: 'stable', stage: 0, notas: 'Estabilizar posición', requerido: true },
        { key: 'hold30', stage: 0, notas: 'Mantener 30 segundos', requerido: true }
      ];
    }
    return [];
  }

  return {
    init: init,
    getChecklist: getChecklist,
    getCurrentItem: getCurrentItem,
    getItemsForStage: getItemsForStage,
    markComplete: markComplete,
    confirmAction: confirmAction,
    getPendingAction: getPendingAction,
    isItemDone: isItemDone,
    getProgress: getProgress,
    setActionCallback: setActionCallback,
    generarDesdePerfil: generarDesdePerfil,
    getGenericChecklist: getGenericChecklist,
    CHECKLISTS: CHECKLISTS
  };
})();