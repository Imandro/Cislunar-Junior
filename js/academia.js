/* =======================================================================
 * CISLUNAR JUNIOR - Academia de Vuelo (Flight School)
 * Cañon Labs - NASA Space Apps Challenge 2026
 * Módulo de aprendizaje progresivo: lecciones, debrief, replay, certificados
 * ==================================================================== */
'use strict';

var CJ = window.CJ || (window.CJ = {});
CJ.ACAD = (function () {
  // Compatibilidad hacia atrás: academia fue escrita contra CJ.HUD.colors y
  // CJ.HUD.draw, que el HUD de monitores ya no expone tal cual. Se reexpone
  // a través de compat (definido en hud_flight.js).
  if (CJ.HUD && CJ.HUD.compat && !CJ.HUD.colors) {
    CJ.HUD.colors = CJ.HUD.compat.colors;
    CJ.HUD.init = CJ.HUD.compat.init;
    CJ.HUD.draw = CJ.HUD.compat.draw;
  }
  // Estado academia
  var state = {
    modo: 'menu', // menu, flight, debrief, replay
    leccionActual: null,
    vehiculo: 'saturnV',
    fase: 'hover',
    asistencia: 2,
    // Vuelo
    flightState: null,
    metricas: {},
    replay: [],
    replayIndex: 0,
    replaySpeed: 1,
    // UI
    canvas: null,
    ctx: null,
    container: null,
    animId: null,
    lastTime: 0
  };

  // Definición de lecciones
  var LECCIONES = [
    { id: 'hover',      nombre: '1. Controles Básicos',       vehiculo: 'saturnV', fase: 'hover',      duracion: 60,  objetivo: 'Mantén posición 30s',          desbloquea: 'attitude',  medallaMin: 'bronce' },
    { id: 'attitude',   nombre: '2. Actitud y SAS',           vehiculo: 'saturnV', fase: 'hover',      duracion: 90,  objetivo: 'Sigue ◇ con asistencia 1',       desbloquea: 'ascent',    medallaMin: 'bronce' },
    { id: 'ascent',     nombre: '3. Ascenso Saturn V',        vehiculo: 'saturnV', fase: 'ascenso',    duracion: 180, objetivo: 'Órbita 180×180 km, ΔV < 3200',   desbloquea: 'staging',   medallaMin: 'bronce' },
    { id: 'staging',    nombre: '4. Separación de Etapas',    vehiculo: 'saturnV', fase: 'ascenso',    duracion: 180, objetivo: 'S-IC + S-II + S-IVB limpios',    desbloquea: 'tli',       medallaMin: 'plata' },
    { id: 'tli',        nombre: '5. Inyección Translunar',    vehiculo: 'saturnV', fase: 'ascenso',    duracion: 120, objetivo: 'Quemada TLI ±50 m/s',            desbloquea: 'docking',   medallaMin: 'plata' },
    { id: 'docking',    nombre: '6. Acoplamiento (6 DOF)',    vehiculo: 'saturnV', fase: 'acople',     duracion: 180, objetivo: 'Dock suave < 0.1 m/s',           desbloquea: 'descent',   medallaMin: 'plata' },
    { id: 'descent',    nombre: '7. Descenso Lunar (LM)',     vehiculo: 'lm',      fase: 'descenso',   duracion: 240, objetivo: 'Aterrizaje < 2 m/s vertical',    desbloquea: 'entry',     medallaMin: 'plata' },
    { id: 'entry',      nombre: '8. Entrada Atmosférica',     vehiculo: 'orion',   fase: 'entrada',    duracion: 180, objetivo: 'G-load < 4g, zona ±10 km',       desbloquea: 'mars',      medallaMin: 'plata' },
    { id: 'mars',       nombre: '9. Entrada Marciana (Starship)', vehiculo: 'starship', fase: 'entrada', duracion: 240, objetivo: 'Flip + landing < 3 m/s',         desbloquea: 'final',     medallaMin: 'oro' },
    { id: 'final',      nombre: '10. Examen Final: Apolo 11', vehiculo: 'saturnV', fase: 'mision',     duracion: 600, objetivo: 'Misión completa sin asistencia',   desbloquea: null,        medallaMin: 'oro', certificado: true }
  ];

  // Medallas
  var MEDALLAS = { ninguno: 0, bronce: 1, plata: 2, oro: 3 };
  var MEDALLA_NOMBRES = ['NINGUNA', 'BRONCE', 'PLATA', 'ORO'];
  var MEDALLA_COLORES = ['#8a9bad', '#cd7f32', '#c0c0c0', '#ffd700'];

  // Persistencia
  var STORAGE_KEY = 'cj_academia_v2';

  function loadProgress() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data.lecciones || {};
    } catch (e) { return {}; }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lecciones: progress, version: 2 }));
    } catch (e) { console.warn('No se pudo guardar progreso academia', e); }
  }

  function getProgress(leccionId) {
    var prog = loadProgress();
    return prog[leccionId] || { medalla: 'ninguno', mejorTiempo: 0, intentos: 0, mejorMetricas: null };
  }

  function setProgress(leccionId, medalla, tiempo, metricas) {
    var prog = loadProgress();
    var prev = prog[leccionId] || { medalla: 'ninguno', mejorTiempo: 0, intentos: 0 };
    prev.intentos = (prev.intentos || 0) + 1;
    if (MEDALLAS[medalla] > MEDALLAS[prev.medalla]) prev.medalla = medalla;
    if (tiempo > 0 && (prev.mejorTiempo === 0 || tiempo < prev.mejorTiempo)) prev.mejorTiempo = tiempo;
    if (metricas && (!prev.mejorMetricas || metricas.dvGastado < prev.mejorMetricas.dvGastado)) {
      prev.mejorMetricas = metricas;
    }
    prog[leccionId] = prev;
    saveProgress(prog);
  }

  function isUnlocked(leccionId) {
    if (leccionId === 'hover') return true;
    var idx = LECCIONES.findIndex(l => l.id === leccionId);
    if (idx <= 0) return true;
    var prev = LECCIONES[idx - 1];
    return getProgress(prev.id).medalla !== 'ninguno';
  }

  function getMedallaForLeccion(leccionId) {
    return getProgress(leccionId).medalla;
  }

  // Inicializar UI
  function init(containerId) {
    state.container = document.getElementById(containerId);
    if (!state.container) {
      console.error('Contenedor academia no encontrado:', containerId);
      return;
    }
    renderMenu();
    setupKeyboard();
  }

  function setupKeyboard() {
    window.addEventListener('keydown', function(e) {
      if (state.modo === 'flight') {
        // Teclas globales en vuelo
        if (e.code === 'KeyH') cycleAssistencia();
        else if (e.code === 'KeyC') cycleCamera();
        else if (e.code === 'KeyR') CJ.FLT.resetAttitude();
        else if (e.code === 'KeyP') togglePause();
        else if (e.code === 'Enter' || e.code === 'Space') {
          handleChecklistAction();
        }
      } else if (state.modo === 'replay') {
        if (e.code === 'Space') toggleReplayPause();
        else if (e.code === 'ArrowRight') state.replaySpeed = Math.min(4, state.replaySpeed * 1.5);
        else if (e.code === 'ArrowLeft') state.replaySpeed = Math.max(0.25, state.replaySpeed / 1.5);
      }
    });
  }

  function renderMenu() {
    state.modo = 'menu';
    var prog = loadProgress();
    var html = '<div class="academia-wrap">';
    html += '<div class="academia-header">';
    html += '<h1>🏫 ACADEMIA CAÑON LABS</h1>';
    html += '<div class="academia-stats">';
    var totalOro = Object.values(prog).filter(p => p.medalla === 'oro').length;
    var totalPlata = Object.values(prog).filter(p => p.medalla === 'plata').length;
    var totalBronce = Object.values(prog).filter(p => p.medalla === 'bronce').length;
    html += '<span class="stat"><b style="color:#ffd700">●</b> ' + totalOro + '</span>';
    html += '<span class="stat"><b style="color:#c0c0c0">●</b> ' + totalPlata + '</span>';
    html += '<span class="stat"><b style="color:#cd7f32">●</b> ' + totalBronce + '</span>';
    html += '<span class="stat">Lecciones: ' + Object.keys(prog).length + '/' + LECCIONES.length + '</span>';
    html += '</div></div>';

    html += '<div class="academia-list">';
    LECCIONES.forEach(function(L, i) {
      var unlocked = isUnlocked(L.id);
      var p = getProgress(L.id);
      var medalla = p.medalla;
      var medalHtml = medalla !== 'ninguno' ?
        '<span class="medalla medalla-' + medalla + '" title="' + MEDALLA_NOMBRES[MEDALLAS[medalla]] + '">' +
        '●' + '</span>' : '<span class="medalla medalla-locked">🔒</span>';
      var timeHtml = p.mejorTiempo ? ' • ' + formatTime(p.mejorTiempo) : '';
      var currentClass = (state.leccionActual === L.id && state.modo !== 'menu') ? ' current' : '';
      html += '<div class="leccion' + (unlocked ? '' : ' locked') + currentClass + '" data-id="' + L.id + '">';
      html += medalHtml;
      html += '<span class="leccion-num">' + (i+1) + '.</span>';
      html += '<span class="leccion-nombre">' + L.nombre + '</span>';
      html += '<span class="leccion-objetivo">' + L.objetivo + '</span>';
      html += '<span class="leccion-time">' + timeHtml + '</span>';
      html += '<span class="leccion-intentos">(' + (p.intentos || 0) + ' intentos)</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="academia-footer">';
    html += '<button class="btn" data-a="menu">← Volver al Menú Principal</button>';
    html += '<button class="btn" data-a="freeflight">Vuelo Libre (Sandbox)</button>';
    html += '</div></div>';

    state.container.innerHTML = html;
    bindMenuEvents();
  }

  function bindMenuEvents() {
    state.container.querySelectorAll('.leccion:not(.locked)').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = this.dataset.id;
        if (id) iniciarLeccion(id);
      });
    });
    state.container.querySelector('[data-a="menu"]').addEventListener('click', volverMenu);
    state.container.querySelector('[data-a="freeflight"]').addEventListener('click', abrirVueloLibre);
  }

  function iniciarLeccion(id) {
    var L = LECCIONES.find(l => l.id === id);
    if (!L) return;
    if (!isUnlocked(id)) return;

    state.leccionActual = id;
    state.vehiculo = L.vehiculo;
    state.fase = L.fase;
    state.asistencia = (L.id === 'attitude') ? 1 : (L.id === 'final' ? 0 : 2);
    state.modo = 'flight';

    // Crear canvas HUD
    state.container.innerHTML = '<canvas id="academiaCanvas"></canvas><div id="academiaOverlay"></div>';
    state.canvas = document.getElementById('academiaCanvas');
    state.ctx = state.canvas.getContext('2d');
    // Compatibilidad con el HUD de monitores: no hay canvas propio, se pinta
    // sobre CJ.COCKPIT. Se guarda la referencia por si alguna ruta vieja la usa.
    if (CJ.HUD && CJ.HUD.compat && CJ.HUD.compat.init) CJ.HUD.compat.init(state.canvas);

    // Inicializar vuelo
    state.flightState = CJ.FLT.init(L.fase, L.vehiculo, { asistencia: state.asistencia });
    CJ.STG.init(L.vehiculo, L.fase);
    CJ.STG.setActionCallback(handleStageAction);

    // Configurar controles
    CJ.CTL.setCallbacks({
      onCycleAssist: cycleAssistencia,
      onCycleCamera: cycleCamera,
      onResetAttitude: function() { CJ.FLT.resetAttitude(); },
      onConfirmChecklist: handleChecklistAction,
      onPause: togglePause,
      onToggleFreeCamera: toggleFreeCamera
    });

    // Métricas
    state.metricas = {
      desvPitch: [], desvYaw: [], desvRoll: [],
      fueraZona: 0, correcciones: 0, maxDesv: 0,
      dvGastado: 0, propUsado: 0, staging: []
    };
    state.replay = [];
    state.lastTime = performance.now();
    state.animId = requestAnimationFrame(loopFlight);
  }

  function loopFlight(timestamp) {
    if (state.modo !== 'flight') return;
    var dt = Math.min(1/30, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;

    // Input
    CJ.CTL.update(dt);
    var input = CJ.CTL.getState();

    // Step flight
    var result = CJ.FLT.step(input);

    // Grabar replay
    if (Math.floor(result.t * 2) !== Math.floor((result.t - dt) * 2)) {
      state.replay.push({
        t: result.t,
        pos: [...result.pos],
        vel: [...result.vel],
        att: [...result.att],
        throttle: result.throttle,
        stage: result.stage,
        input: { ...input }
      });
    }

    // Actualizar métricas
    state.metricas = result.metricas;

    // Dibujar HUD
    var checklist = CJ.STG.getItemsForStage(result.stage);
    CJ.HUD.draw(result, result.optimo, checklist);

    // Overlay info lección
    drawLessonOverlay(result);

    // Verificar fin
    if (result.estado === 'complete') {
      finishLeccion(result.fin);
      return;
    }

    state.animId = requestAnimationFrame(loopFlight);
  }

  function drawLessonOverlay(result) {
    var ctx = state.ctx;
    var L = LECCIONES.find(l => l.id === state.leccionActual);
    if (!L) return;

    ctx.save();
    ctx.font = '12px "Orbitron", monospace';
    ctx.fillStyle = CJ.HUD.colors.fg;
    ctx.textAlign = 'left';
    ctx.fillText('LECCIÓN: ' + L.nombre, 14, 30);

    // Tiempo restante
    var remaining = Math.max(0, L.duracion - result.t);
    var color = remaining < 10 ? CJ.HUD.colors.bd : remaining < 30 ? CJ.HUD.colors.wn : CJ.HUD.colors.ok;
    ctx.fillStyle = color;
    ctx.fillText('TIEMPO: ' + formatTime(remaining) + ' / ' + formatTime(L.duracion), 14, 50);

    // Objetivo
    ctx.fillStyle = CJ.HUD.colors.muted;
    ctx.font = '11px "Orbitron", monospace';
    ctx.fillText('OBJETIVO: ' + L.objetivo, 14, 70);

    // Checklist item actual
    var currentItem = CJ.STG.getCurrentItem();
    if (currentItem) {
      ctx.fillStyle = CJ.HUD.colors.ac;
      ctx.font = 'bold 12px "Orbitron", monospace';
      var txt = currentItem.notas;
      if (currentItem.accion) txt += '  ← PULSA ESPACIO/ENTER';
      ctx.fillText('SIGUIENTE: ' + txt, 14, 95);
    }

    ctx.restore();
  }

  function finishLeccion(fin) {
    cancelAnimationFrame(state.animId);
    state.modo = 'debrief';

    var L = LECCIONES.find(l => l.id === state.leccionActual);
    var tiempo = state.flightState.t;

    // Calcular medalla
    var medalla = calcularMedalla(L, fin, state.metricas, tiempo);
    setProgress(state.leccionActual, medalla, tiempo, state.metricas);

    // Desbloquear siguiente
    var nextIdx = LECCIONES.findIndex(l => l.id === state.leccionActual) + 1;
    var nextUnlocked = nextIdx < LECCIONES.length && isUnlocked(LECCIONES[nextIdx].id);

    renderDebrief(L, fin, medalla, tiempo, nextUnlocked);
  }

  function calcularMedalla(L, fin, metricas, tiempo) {
    if (fin.tipo === 'fallo' || !fin.exito) return 'ninguno';

    var dvOptimo = getDvOptimo(L.id);
    var dvExtra = metricas.dvGastado - dvOptimo;
    var desvMedia = avg(metricas.desvPitch);
    var desvMax = metricas.maxDesv;
    var stagingOk = metricas.staging.filter(s => s.limpio).length;
    var stagingTotal = metricas.staging.length;

    // Criterios por lección
    var criterios = {
      hover: { dv: 100, desv: 5, desvMax: 15, staging: 0 },
      attitude: { dv: 200, desv: 3, desvMax: 10, staging: 0 },
      ascent: { dv: 200, desv: 2.5, desvMax: 6, staging: 3 },
      staging: { dv: 150, desv: 2, desvMax: 5, staging: 3 },
      tli: { dv: 80, desv: 2, desvMax: 5, staging: 0 },
      docking: { dv: 100, desv: 1.5, desvMax: 4, staging: 0 },
      descent: { dv: 150, desv: 2, desvMax: 5, staging: 0 },
      entry: { dv: 100, desv: 2, desvMax: 5, staging: 0 },
      mars: { dv: 200, desv: 2.5, desvMax: 6, staging: 0 },
      final: { dv: 100, desv: 1, desvMax: 3, staging: 3 }
    };
    var c = criterios[L.id] || criterios.ascent;

    var score = 0;
    if (dvExtra <= c.dv) score += 3;
    else if (dvExtra <= c.dv * 2) score += 2;
    else if (dvExtra <= c.dv * 4) score += 1;

    if (desvMedia <= c.desv) score += 3;
    else if (desvMedia <= c.desv * 2) score += 2;
    else if (desvMedia <= c.desv * 3) score += 1;

    if (desvMax <= c.desvMax) score += 2;
    else if (desvMax <= c.desvMax * 2) score += 1;

    if (stagingTotal === 0 || stagingOk >= c.staging) score += 2;
    else if (stagingOk >= c.staging - 1) score += 1;

    // Tiempo
    var timeRatio = tiempo / L.duracion;
    if (timeRatio >= 0.7 && timeRatio <= 1.2) score += 1;

    if (score >= 10) return 'oro';
    if (score >= 7) return 'plata';
    if (score >= 4) return 'bronce';
    return 'ninguno';
  }

  function getDvOptimo(leccionId) {
    var optimos = {
      hover: 0, attitude: 50, ascent: 3150, staging: 3150,
      tli: 3150, docking: 50, descent: 2100, entry: 100, mars: 1200, final: 9500
    };
    return optimos[leccionId] || 3150;
  }

  function renderDebrief(L, fin, medalla, tiempo, nextUnlocked) {
    var p = getProgress(L.id);
    var html = '<div class="academia-wrap debrief">';
    html += '<div class="debrief-header">';
    html += '<h1>📋 DEBRIEF: ' + L.nombre.toUpperCase() + '</h1>';
    html += '<div class="medalla-grande medalla-' + medalla + '">' + MEDALLA_NOMBRES[MEDALLAS[medalla]] + '</div>';
    html += '</div>';

    html += '<div class="debrief-grid">';
    // Columna 1: Resultado
    html += '<div class="debrief-panel">';
    html += '<h3>RESULTADO</h3>';
    html += '<div class="result-row"><span>Estado:</span><b class="' + (fin.exito ? 'ok' : 'bd') + '">' + (fin.exito ? '✓ ' + fin.tipo.toUpperCase() : '✗ ' + (fin.razon || 'FALLO')) + '</b></div>';
    html += '<div class="result-row"><span>Tiempo:</span><b>' + formatTime(tiempo) + ' / ' + formatTime(L.duracion) + '</b></div>';
    html += '<div class="result-row"><span>ΔV gastado:</span><b>' + (state.metricas.dvGastado/1000).toFixed(2) + ' km/s</b> (óptimo ' + (getDvOptimo(L.id)/1000).toFixed(2) + ' km/s)</div>';
    html += '<div class="result-row"><span>ΔV extra:</span><b class="' + ((state.metricas.dvGastado - getDvOptimo(L.id)) < 200 ? 'ok' : 'wn') + '">' + ((state.metricas.dvGastado - getDvOptimo(L.id))/1000).toFixed(2) + ' km/s</b></div>';
    html += '<div class="result-row"><span>Propelente usado:</span><b>' + formatMass(state.metricas.propUsado) + '</b></div>';
    html += '</div>';

    // Columna 2: Pilotaje
    html += '<div class="debrief-panel">';
    html += '<h3>MÉTRICAS DE PILOTAJE</h3>';
    html += '<div class="metric-bar"><span>Desv. media pitch:</span><b>' + avg(state.metricas.desvPitch).toFixed(1) + '°</b><div class="bar"><i style="width:' + Math.min(100, avg(state.metricas.desvPitch)*20) + '%;background:' + (avg(state.metricas.desvPitch) < 2 ? CJ.HUD.colors.ok : CJ.HUD.colors.wn) + '"></i></div></div>';
    html += '<div class="metric-bar"><span>Desv. máx pitch:</span><b>' + state.metricas.maxDesv.toFixed(1) + '°</b><div class="bar"><i style="width:' + Math.min(100, state.metricas.maxDesv*10) + '%;background:' + (state.metricas.maxDesv < 5 ? CJ.HUD.colors.ok : CJ.HUD.colors.bd) + '"></i></div></div>';
    html += '<div class="metric-bar"><span>Tiempo fuera zona (±3°):</span><b>' + state.metricas.fueraZona.toFixed(1) + 's</b><div class="bar"><i style="width:' + Math.min(100, state.metricas.fueraZona*5) + '%;background:' + (state.metricas.fueraZona < 5 ? CJ.HUD.colors.ok : CJ.HUD.colors.wn) + '"></i></div></div>';
    html += '<div class="metric-bar"><span>Correcciones bruscas:</span><b>' + state.metricas.correcciones + '</b></div>';
    html += '<div class="metric-bar"><span>Asistencia usada:</span><b>Nivel ' + state.asistencia + ' (' + ['Sin ayuda','Principiante','Estándar','Asistido'][state.asistencia] + ')</b></div>';
    html += '</div>';

    // Columna 3: Etapas
    html += '<div class="debrief-panel">';
    html += '<h3>ETAPAS / CHECKLIST</h3>';
    state.metricas.staging.forEach(function(s) {
      html += '<div class="result-row"><span>Etapa ' + (s.stage+1) + ':</span><b class="' + (s.limpio ? 'ok' : 'bd') + '">' + (s.limpio ? '✓ Limpia' : '✗ Problemas') + ' @ T+' + formatTime(s.t) + '</b></div>';
    });
    var prog = CJ.STG.getProgress();
    html += '<div class="result-row"><span>Checklist:</span><b>' + prog.done + '/' + prog.total + ' (' + Math.round(prog.pct*100) + '%)</b></div>';
    html += '</div>';
    html += '</div>';

    // Consejo
    html += '<div class="debrief-advice">';
    html += '<h3>💡 ANÁLISIS</h3>';
    html += '<p>' + generarConsejo(L, fin, state.metricas, medalla) + '</p>';
    html += '</div>';

    // Botones
    html += '<div class="debrief-actions">';
    html += '<button class="btn" data-a="retry">🔄 Reintentar</button>';
    if (nextUnlocked) html += '<button class="btn" data-a="next">▶ Siguiente Lección</button>';
    else html += '<button class="btn" data-a="menu" style="opacity:0.5">🔒 Siguiente Bloqueada</button>';
    html += '<button class="btn" data-a="replay">🎬 Ver Replay</button>';
    html += '<button class="btn" data-a="menu">← Menú Academia</button>';
    html += '</div></div>';

    state.container.innerHTML = html;
    bindDebriefEvents();
  }

  function bindDebriefEvents() {
    state.container.querySelector('[data-a="retry"]').addEventListener('click', function() { iniciarLeccion(state.leccionActual); });
    state.container.querySelector('[data-a="next"]').addEventListener('click', function() {
      var idx = LECCIONES.findIndex(l => l.id === state.leccionActual) + 1;
      if (idx < LECCIONES.length) iniciarLeccion(LECCIONES[idx].id);
    });
    state.container.querySelector('[data-a="replay"]').addEventListener('click', iniciarReplay);
    state.container.querySelector('[data-a="menu"]').addEventListener('click', volverMenu);
  }

  function generarConsejo(L, fin, m, medalla) {
    if (!fin.exito) return 'La misión falló. Revisa los controles básicos en lecciones anteriores.';
    var tips = [];
    if (m.dvGastado - getDvOptimo(L.id) > 200) tips.push('Gastaste ΔV extra. Sigue más fielmente el ◇ objetivo y reduce correcciones bruscas.');
    if (avg(m.desvPitch) > 3) tips.push('Desviación de pitch alta. Usa inputs más suaves y anticipa el programa de giro.');
    if (m.fueraZona > 10) tips.push('Pasaste mucho tiempo fuera de la zona óptima. La asistencia nivel 2 ayuda a aprender la trayectoria.');
    if (m.correcciones > 10) tips.push('Muchas correcciones bruscas. Intenta volar "suave" - el cohete responde con inercia.');
    if (medalla === 'oro') tips.push('¡Excelente! Dominas esta fase. Prueba bajar la asistencia al siguiente nivel.');
    return tips.join(' ') || 'Buen trabajo. La práctica constante mejora la precisión.';
  }

  function iniciarReplay() {
    state.modo = 'replay';
    state.replayIndex = 0;
    state.replaySpeed = 1;
    state.replayPaused = false;

    state.container.innerHTML = '<canvas id="academiaCanvas"></canvas><div id="academiaOverlay"></div>';
    state.canvas = document.getElementById('academiaCanvas');
    state.ctx = state.canvas.getContext('2d');
    // Compatibilidad con el HUD de monitores: no hay canvas propio, se pinta
    // sobre CJ.COCKPIT. Se guarda la referencia por si alguna ruta vieja la usa.
    if (CJ.HUD && CJ.HUD.compat && CJ.HUD.compat.init) CJ.HUD.compat.init(state.canvas);

    state.lastTime = performance.now();
    state.animId = requestAnimationFrame(loopReplay);
  }

  function loopReplay(timestamp) {
    if (state.modo !== 'replay') return;
    var dt = (timestamp - state.lastTime) / 1000 * state.replaySpeed;
    state.lastTime = timestamp;

    if (!state.replayPaused) {
      state.replayIndex = Math.min(state.replayIndex + dt * 60, state.replay.length - 1);
    }

    var frame = state.replay[Math.floor(state.replayIndex)];
    if (frame) {
      // Reconstruir estado para HUD
      var fakeState = {
        t: frame.t,
        fase: state.fase,
        vehiculo: state.vehiculo,
        pos: frame.pos,
        vel: frame.vel,
        att: frame.att,
        throttle: frame.throttle,
        stage: frame.stage,
        masa: 0, propRestante: 0, gLoad: 1, velMag: 0, alt: 0,
        metricas: state.metricas,
        optimo: CJ.FLT.interpolarPerfil(CJ.FLT.getPerfil(), state.fase === 'descenso' ? 'alt' : 't',
          state.fase === 'descenso' ? CJ.FLT.V3.norm(frame.pos) - CJ.FLT.R_MOON : frame.t)
      };
      var checklist = CJ.STG.getItemsForStage(frame.stage);
      CJ.HUD.draw(fakeState, fakeState.optimo, checklist);

      // Overlay replay
      state.ctx.save();
      state.ctx.font = '14px "Orbitron", monospace';
      state.ctx.fillStyle = CJ.HUD.colors.wn;
      state.ctx.textAlign = 'center';
      state.ctx.fillText('▶ REPLAY ' + (state.replayPaused ? '⏸ PAUSA' : '') + '  ' + formatTime(frame.t) + '  Velocidad: ' + state.replaySpeed.toFixed(1)+'x', state.canvas.width/2, 30);
      state.ctx.fillStyle = CJ.HUD.colors.muted;
      state.ctx.font = '11px "Orbitron", monospace';
      state.ctx.fillText('[ESPACIO] Pausa  [←/→] Velocidad  [ESC] Salir', state.canvas.width/2, 55);
      state.ctx.restore();
    }

    if (state.replayIndex >= state.replay.length - 1 && !state.replayPaused) {
      state.replayPaused = true;
    }

    state.animId = requestAnimationFrame(loopReplay);
  }

  function toggleReplayPause() { state.replayPaused = !state.replayPaused; }

  function handleStageAction(action) {
    if (action === 'stage' || action === 'tli' || action === 'dock' || action === 'pdi' || action === 'land' || action === 'flip' || action === 'flop' || action === 'fairing' || action === 'drogue' || action === 'main') {
      var item = CJ.STG.getCurrentItem();
      if (item) CJ.STG.markComplete(item.key);
    }
  }

  function handleChecklistAction() {
    var item = CJ.STG.getCurrentItem();
    if (item && item.accion) {
      CJ.STG.markComplete(item.key);
      // Simular confirmación automática tras acción
      setTimeout(function() { CJ.STG.confirmAction(item.key); }, 100);
    }
  }

  function cycleAssistencia() {
    state.asistencia = (state.asistencia + 1) % 4;
    CJ.FLT.setAsistencia(state.asistencia);
    // Feedback sonoro visual
    if (state.flightState) {
      state.flightState.asistencia = state.asistencia;
    }
  }

  function cycleCamera() {
    // TODO: Integrar con cámara 3D
    console.log('Ciclo cámara (pendiente integración 3D)');
  }

  function togglePause() {
    if (state.modo === 'flight') {
      state.modo = state.paused ? 'flight' : 'paused';
      state.paused = !state.paused;
      if (!state.paused) {
        state.lastTime = performance.now();
        state.animId = requestAnimationFrame(loopFlight);
      } else {
        cancelAnimationFrame(state.animId);
        drawPauseOverlay();
      }
    }
  }

  function drawPauseOverlay() {
    var ctx = state.ctx;
    ctx.fillStyle = 'rgba(10,15,22,0.95)';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    ctx.fillStyle = CJ.HUD.colors.ac;
    ctx.font = 'bold 24px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSA', state.canvas.width/2, state.canvas.height/2);
    ctx.font = '12px "Orbitron", monospace';
    ctx.fillStyle = CJ.HUD.colors.muted;
    ctx.fillText('[P] Reanudar  [H] Asistencia  [R] Reset Att  [ESC] Menú', state.canvas.width/2, state.canvas.height/2 + 40);
  }

  function toggleFreeCamera() {
    // Placeholder para integración futura
  }

  function abrirVueloLibre() {
    state.modo = 'freeflight';
    state.container.innerHTML = '<div class="academia-wrap"><h2>🛸 VUELO LIBRE (Próximamente)</h2><p>Selecciona vehículo, fase, condiciones iniciales y practica sin objetivos.</p><button class="btn" data-a="menu">← Volver</button></div>';
    state.container.querySelector('[data-a="menu"]').addEventListener('click', volverMenu);
  }

  function volverMenu() {
    if (state.animId) cancelAnimationFrame(state.animId);
    state.modo = 'menu';
    renderMenu();
  }

  function formatTime(t) {
    var m = Math.floor(t/60), s = Math.floor(t%60);
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }

  function formatMass(m) {
    if (m > 1000000) return (m/1000000).toFixed(1)+' Mt';
    if (m > 1000) return (m/1000).toFixed(1)+' t';
    return Math.round(m)+' kg';
  }

  function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

  // API pública
  return {
    init: init,
    startLesson: iniciarLeccion,
    LECCIONES: LECCIONES,
    getProgress: getProgress,
    isUnlocked: isUnlocked,
    getMedallaForLeccion: getMedallaForLeccion,
    loadProgress: loadProgress,
    saveProgress: saveProgress
  };
})();