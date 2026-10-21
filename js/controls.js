/* ===========================================================================
 * CISLUNAR JUNIOR — Control de entrada
 * Cañon Labs · NASA Space Apps Challenge 2026
 *
 * Dos niveles de mando que nunca se pisan:
 *
 *   · VUELO     WASD y flechas mueven el mando de actitud, Shift/Espacio el
 *               empuje, y una fila de teclas de una sola pulsación (H, C, R,
 *               P…) hace lo que su nombre dice.
 *   · CABINA    Tab recorre monitores, F1..F6 saltan a uno, ↑↓ eligen elemento,
 *               ←→ lo ajustan, Enter lo activan y Esc devuelve el control al
 *               vehículo.
 *
 * El reparto depende de dónde esté el foco: si un monitor lo tiene, las flechas
 * navegan sus elementos y no vuelan. `Tab` en vuelo entrega el foco a la cabina,
 * y `Esc` lo devuelve, de modo que se puede jugar entero sin ratón.
 * Código original de Cañon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  var CJ = root.CJ || (root.CJ = {});

  CJ.CTL = (function () {
    /* -------------------------------------------------------------------
     * Mapa de teclas de vuelo
     * ----------------------------------------------------------------- */
    var VUELO = {
      KeyW: 'pitchDown', ArrowUp: 'pitchUp',
      KeyS: 'pitchUp',   ArrowDown: 'pitchDown',
      KeyA: 'yawLeft',   ArrowLeft: 'yawRight',
      KeyD: 'yawRight',  ArrowRight: 'yawLeft',
      KeyQ: 'rollLeft',  KeyE: 'rollRight',
      ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
      Space: 'throttleDown',
      KeyH: 'cycleAssist',
      KeyC: 'cycleCamera',
      KeyR: 'resetAttitude',
      KeyP: 'pause',
      KeyF: 'focusVehicle'
    };

    /* Instantáneas: se disparan al bajar la tecla, sin depender de dt. */
    var ACCIONES = ['cycleAssist', 'cycleCamera', 'resetAttitude', 'pause', 'focusVehicle'];

    /* -------------------------------------------------------------------
     * Estado
     * ----------------------------------------------------------------- */
    var cfg = {
      deadzone: 0.06,
      suavizado: 0.12,
      razonTimbre: 0.55      // rapidez con la que responde la actitud
    };

    var teclas = {};
    var raw = { pitch: 0, yaw: 0, roll: 0, throttle: 0 };
    var sm = { pitch: 0, yaw: 0, roll: 0, throttle: 0 };

    var focoCabina = false;      // ¿las flechas están navegando un monitor?
    var modoRaton = false;       // ¿el puntero manda? (conmutable con `)
    var ultTecla = 0;            // marca para el autoguardado del ajuste
    var ajustes = { ultimaTecla: 0 };

    var on = {};                 // retrollamadas
    var DESTINO = {
      cycleAssist: 'onCycleAssist',
      cycleCamera: 'onCycleCamera',
      resetAttitude: 'onResetAttitude',
      confirmChecklist: 'onConfirmChecklist',
      pause: 'onPause',
      focusVehicle: 'onFocusVehicle',
      cockpitFocus: 'onCockpitFocus',
      cockpitBlur: 'onCockpitBlur',
      cockpitActivate: 'onCockpitActivate',
      cockpitAdjust: 'onCockpitAdjust',
      cockpitMove: 'onCockpitMove',
      cockpitEnter: 'onCockpitEnter'
    };

    /* -------------------------------------------------------------------
     * Registro
     * ----------------------------------------------------------------- */
    function init(opciones) {
      if (opciones) for (var k in opciones) cfg[k] = opciones[k];
      if (typeof root.addEventListener !== 'function') return;
      root.addEventListener('keydown', alPulsar, { passive: false });
      root.addEventListener('keyup', alSoltar);
      root.addEventListener('blur', soltarTodo);
    }

    function setCallbacks(cb) {
      if (!cb) return;
      for (var k in cb) on[k] = cb[k];
    }

    /**
     * Llama a una retrollamada registrada reenviando sus argumentos.
     * Sin el reenvío, las que necesitan datos (qué tecla se pulsó, en qué
     * dirección se mueve el resaltado) recibían `undefined` y no hacían nada.
     */
    function llama(nombre) {
      var f = on[nombre];
      if (typeof f !== 'function') return false;
      var args = Array.prototype.slice.call(arguments, 1);
      f.apply(null, args);
      return true;
    }

    /* -------------------------------------------------------------------
     * Teclado
     * ----------------------------------------------------------------- */
    function alPulsar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = e.code || '';
      var k = e.key || '';
      var cab = CJ.COCKPIT;

      /* --- la tecla ` conmuta mando ratón / teclado --- */
      if (c === 'Backquote' || k === '`') {
        e.preventDefault();
        modoRaton = !modoRaton;
        if (modoRaton && focoCabina) soltarFoco();
        llama('onAlternarEntrada');
        return;
      }

      /* --- mientras un monitor tiene el foco, todo va a la cabina --- */
      if (focoCabina && cab) {
        switch (c) {
          case 'Escape':
            e.preventDefault(); soltarFoco(); return;
          case 'Tab':
            e.preventDefault();
            if (e.shiftKey) llama('onCockpitAnterior'); else llama('onCockpitSiguiente');
            return;
          case 'ArrowUp':
            e.preventDefault(); llama('onCockpitMove', -1); return;
          case 'ArrowDown':
            e.preventDefault(); llama('onCockpitMove', 1); return;
          case 'ArrowLeft':
            e.preventDefault(); llama('onCockpitAdjust', -1); return;
          case 'ArrowRight':
            e.preventDefault(); llama('onCockpitAdjust', 1); return;
          case 'Enter':
            e.preventDefault(); llama('onCockpitEnter'); return;
          case 'Space':
            /* Espacio sigue siendo "frenar" en vuelo: sólo cuando la cabina
             * tiene el foco se comporta como activación del elemento
             * resaltado. */
            e.preventDefault(); llama('onCockpitEnter'); return;
        }
        if (c.indexOf('F') === 0 && c.length <= 3 && /^F[1-6]$/.test(c)) {
          e.preventDefault(); llama('onCockpitTecla', c); return;
        }
      }

      /* --- Tab sin foco: entra en la cabina --- */
      if (c === 'Tab' && cab) {
        e.preventDefault();
        if (e.shiftKey) llama('onCockpitAnterior'); else llama('onCockpitSiguiente');
        tomarFoco();
        return;
      }

      /* --- F1..F6 siempre cambian de monitor --- */
      if (cab && /^F[1-6]$/.test(c)) {
        e.preventDefault();
        llama('onCockpitTecla', c);
        tomarFoco();
        return;
      }

      var accion = VUELO[c];
      if (!accion) return;
      if (/^(Arrow|Space|Shift)/.test(c)) e.preventDefault();

      teclas[c] = true;

      if (ACCIONES.indexOf(accion) >= 0) {
        var destino = DESTINO[accion];
        if (destino && on[destino]) { on[destino](); }
        else llama('on' + accion.charAt(0).toUpperCase() + accion.slice(1));
        /* Una acción instantánea no debe quedar pulsada: la repetición
         * automática del teclado la mantendría y el motor acabaría girando
         * solo al dejar de tocarla. */
        teclas[c] = false;
        return;
      }
      if (accion === 'confirmChecklist') { llama('onConfirmChecklist'); teclas[c] = false; return; }

      actualizarRaw();
      ultTecla = (root.Date && root.Date.now) ? root.Date.now() : ultTecla + 1;
    }

    function alSoltar(e) {
      var c = e.code || '';
      teclas[c] = false;
      actualizarRaw();
    }

    function soltarTodo() {
      teclas = {};
      raw.pitch = raw.yaw = raw.roll = raw.throttle = 0;
      sm.pitch = sm.yaw = sm.roll = sm.throttle = 0;
    }

    function actualizarRaw() {
      raw.pitch    = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0);
      raw.yaw      = (teclas.KeyA || teclas.ArrowLeft ? 1 : 0) - (teclas.KeyD || teclas.ArrowRight ? 1 : 0);
      raw.roll     = (teclas.KeyQ ? 1 : 0) - (teclas.KeyE ? 1 : 0);
      raw.throttle = (teclas.ShiftLeft || teclas.ShiftRight ? 1 : 0) - (teclas.Space ? 1 : 0);
    }

    /* -------------------------------------------------------------------
     * Bucle
     * ----------------------------------------------------------------- */
    function update(dt) {
      if (!dt || dt < 0) dt = 0;
      var cab = CJ.COCKPIT;

      /* Con un monitor enfocado las flechas ya no vuelan: se sueltan para
       * que el mando se centre en vez de quedarse clavado en el último
       * valor. */
      if (focoCabina && cab) {
        raw.pitch = raw.yaw = raw.roll = 0;
      }

      var a = 1 - Math.exp(-dt / cfg.suavizado);
      sm.pitch    += (raw.pitch    - sm.pitch) * a;
      sm.yaw      += (raw.yaw      - sm.yaw) * a;
      sm.roll     += (raw.roll     - sm.roll) * a;
      sm.throttle += (raw.throttle - sm.throttle) * a;

      var d = cfg.deadzone;
      if (Math.abs(sm.pitch) < d) sm.pitch = 0;
      if (Math.abs(sm.yaw) < d) sm.yaw = 0;
      if (Math.abs(sm.roll) < d) sm.roll = 0;
      if (Math.abs(sm.throttle) < d) sm.throttle = 0;
    }

    function getState() {
      return {
        pitch: sm.pitch, yaw: sm.yaw, roll: sm.roll, throttle: sm.throttle,
        raw: { pitch: raw.pitch, yaw: raw.yaw, roll: raw.roll, throttle: raw.throttle },
        teclas: teclas
      };
    }

    /* -------------------------------------------------------------------
     * Foco
     * ----------------------------------------------------------------- */
    function tomarFoco() {
      if (focoCabina) return true;
      focoCabina = true;
      soltarTodo();
      llama('onCockpitFocus');
      return true;
    }

    function soltarFoco() {
      if (!focoCabina) return false;
      focoCabina = false;
      soltarTodo();
      llama('onCockpitBlur');
      return true;
    }

    function alternarFoco() { return focoCabina ? soltarFoco() : tomarFoco(); }

    /* Un clic sobre un monitor se guarda el foco; un clic fuera lo suelta. */
    function focoEnMonitor(mon) {
      if (mon) return tomarFoco();
      return soltarFoco();
    }

    /* -------------------------------------------------------------------
     * API
     * ----------------------------------------------------------------- */
    return {
      init: init,
      setCallbacks: setCallbacks,
      update: update,
      getState: getState,
      soltarTodo: soltarTodo,
      KEY_MAP: VUELO,
      cfg: cfg,

      /* foco y navegación */
      tomarFoco: tomarFoco,
      soltarFoco: soltarFoco,
      alternarFoco: alternarFoco,
      focoEnMonitor: focoEnMonitor,
      tieneFoco: function () { return focoCabina; },
      modoRaton: function () { return modoRaton; },
      alternarEntrada: function () {
        modoRaton = !modoRaton;
        if (modoRaton) soltarFoco();
        return modoRaton;
      },

      /* Retrollamada simulada para el arnés y las capturas automáticas */
      simular: function (code, down) {
        if (down) alPulsar({ code: code, key: code, preventDefault: function () {}, shiftKey: false });
        else alSoltar({ code: code });
      },
      estado: function () {
        return { foco: focoCabina, raton: modoRaton, teclas: teclas, sm: sm };
      }
    };
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = CJ.CTL;

})(typeof window !== 'undefined' ? window : this);