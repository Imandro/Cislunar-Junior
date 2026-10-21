/* =======================================================================
 * CISLUNAR JUNIOR - Flight Models
 * Cañon Labs - NASA Space Apps Challenge 2026
 * Modelos físicos por fase: ascenso, órbita, descenso, acople, entrada
 *
 * Núcleo numérico: cuerpo celeste único, elementos orbitales reales,
 * actitud por cuaterniones, integrador de Verlet y atmósfera con Cd(Mach).
 * ==================================================================== */
'use strict';

var CJ = window.CJ || (window.CJ = {});
CJ.FLT = (function () {
  // Constantes físicas
  var G = 6.67430e-11;
  var G0 = 9.80665;
  var M_EARTH = 5.972e24;
  var R_EARTH = 6371e3;
  var M_MOON = 7.342e22;
  var R_MOON = 1737.4e3;
  var M_MARS = 6.417e23;
  var R_MARS = 3389.5e3;
  var M_SOL = 1.98847e30;
  var R_MOON_ORB = 384400e3;   // semieje mayor Luna (efecto de marea)

  // -----------------------------------------------------------------------
  // Modelo de cuerpo celeste.
  // Única fuente de verdad para radio, gravedad y atmósfera. Antes cada
  // magnitudes distintas (R_EARTH fijo) y la Luna/Marte receiving una
  // altitud medida contra el radio terrestre: densidad de 9e114 kg/m³.
  // -----------------------------------------------------------------------
  var CUERPOS = {
    tierra: {
      id: 'tierra', nombre: 'Tierra',
      mu: G * M_EARTH, R: R_EARTH, J2: 1.08263e-3,
      atm: true, H: 8500, rho0: 1.225, T0: 288.15, lapse: 0.0065, Rs: 287.05, gamma: 1.40,
      rot: 7.2921159e-5
    },
    luna: {
      id: 'luna', nombre: 'Luna',
      mu: G * M_MOON, R: R_MOON, J2: 0,
      atm: false, H: 1, rho0: 0, T0: 250, lapse: 0.0, Rs: 0, gamma: 1.4,
      rot: -2.659e-8
    },
    marte: {
      id: 'marte', nombre: 'Marte',
      mu: G * M_MARS, R: R_MARS, J2: 0.00196076,
      atm: true, H: 11100, rho0: 0.020, T0: 210, lapse: 0.0045, Rs: 212.6, gamma: 1.29,
      rot: 7.0882181e-5
    }
  };

  // Radii y datos de entrada por vehículo.
  var VEHICULOS = {
    saturnV: {
      nombre: 'Saturn V',
      masaInicial: 2970000, // kg
      etapas: [
        { nombre: 'S-IC', masaSeca: 131000, masaProp: 2077000, isp: 263, ispVac: 304, empuje: 34500000, empujeVac: 40000000, motores: 5, burnTime: 168 },
        { nombre: 'S-II', masaSeca: 40100,  masaProp: 456100, isp: 421, empuje: 5140000,  motores: 5, burnTime: 360 },
        { nombre: 'S-IVB', masaSeca: 11300, masaProp: 175000, isp: 421, empuje: 900000,  motores: 1, burnTime: 805 }
      ],
      diam: 10.1, cd: 0.5, areaRef: 80.1, long: 110,
      rcs: { fuerz: 5000, isp: 280 } // N, s
    },
    sls: {
      nombre: 'SLS Block 1',
      masaInicial: 2600000,
      etapas: [
        /* shortcut: suma SRB y Core en una etapa equivalente; modelar propulsión paralela si se amplía la fidelidad del SLS. */
        { nombre: 'SRB + Core', masaSeca: 200000, masaProp: 1500000, isp: 269, empuje: 40800000, motores: 6, burnTime: 126 },
        { nombre: 'Core', masaSeca: 88000, masaProp: 730000, isp: 452, empuje: 8800000, motores: 4, burnTime: 480 },
        { nombre: 'ICPS', masaSeca: 3500, masaProp: 27000, isp: 462, empuje: 110000, motores: 1, burnTime: 1100 }
      ],
      diam: 8.4, cd: 0.5, areaRef: 55.4, long: 98,
      rcs: { fuerz: 3000, isp: 300 }
    },
    starship: {
      nombre: 'Starship',
      masaInicial: 5000000,
      etapas: [
        { nombre: 'Super Heavy', masaSeca: 200000, masaProp: 3400000, isp: 330, empuje: 73500000, motores: 33, burnTime: 160 },
        { nombre: 'Ship', masaSeca: 100000, masaProp: 1200000, isp: 380, empuje: 12000000, motores: 6, burnTime: 400 }
      ],
      diam: 9.0, cd: 0.7, areaRef: 63.6, long: 123,
      rcs: { fuerz: 10000, isp: 350 }
    },
    lm: {
      nombre: 'LM Eagle',
      masaInicial: 15000,
      etapas: [
        { nombre: 'Descenso', masaSeca: 2200, masaProp: 8200, isp: 311, empuje: 90000, motores: 1, burnTime: 450, throttleable: true }
      ],
      diam: 4.2, cd: 0.5, areaRef: 13.8, long: 7.0,
      rcs: { fuerz: 450, isp: 290 }
    },
    orion: {
      nombre: 'Orion',
      masaInicial: 26000,
      etapas: [
        { nombre: 'CM', masaSeca: 9000, masaProp: 0, isp: 0, empuje: 0, motores: 0, burnTime: 0 }
      ],
      diam: 5.0, cd: 1.2, areaRef: 19.6, long: 8.6, // forma cápsula
      rcs: { fuerz: 1000, isp: 300 }
    },
    // Vehículos adicionales para misiones
    csm_lm: {
      nombre: 'CSM + LM (Apolo)',
      masaInicial: 45000,
      etapas: [
        { nombre: 'S-IVB TLI', masaSeca: 11300, masaProp: 104300, isp: 421, empuje: 1800000, motores: 1, burnTime: 360 },
        { nombre: 'CSM SPS', masaSeca: 3800, masaProp: 18500, isp: 314, empuje: 91000, motores: 1, burnTime: 600 },
        { nombre: 'LM Descent', masaSeca: 2200, masaProp: 8200, isp: 311, empuje: 90000, motores: 1, burnTime: 450, throttleable: true }
      ],
      diam: 3.9, cd: 0.5, areaRef: 12.0, long: 11,
      rcs: { fuerz: 500, isp: 290 }
    },
    lm_eagle: {
      nombre: 'LM Eagle (Descenso)',
      masaInicial: 15000,
      etapas: [
        { nombre: 'Descenso', masaSeca: 2200, masaProp: 8200, isp: 311, empuje: 90000, motores: 1, burnTime: 450, throttleable: true }
      ],
      diam: 4.2, cd: 0.5, areaRef: 13.8, long: 7.0,
      rcs: { fuerz: 450, isp: 290 }
    },
    lm_ascent: {
      nombre: 'LM Eagle (Ascenso)',
      masaInicial: 4800,
      etapas: [
        { nombre: 'Ascenso', masaSeca: 2300, masaProp: 2500, isp: 311, empuje: 16000, motores: 1, burnTime: 440 }
      ],
      diam: 3.0, cd: 0.5, areaRef: 7.1, long: 4.5,
      rcs: { fuerz: 450, isp: 290 }
    },
    cm_columbia: {
      nombre: 'CM Columbia (Entrada)',
      masaInicial: 5500,
      etapas: [
        { nombre: 'Entrada', masaSeca: 5500, masaProp: 0, isp: 0, empuje: 0, motores: 0, burnTime: 0 }
      ],
      diam: 3.9, cd: 1.3, areaRef: 12.0, long: 3.5, // forma cápsula
      rcs: { fuerz: 1000, isp: 300 }
    },
    lm_aquarius: {
      nombre: 'LM Aquarius (Rescate)',
      masaInicial: 16000,
      etapas: [
        { nombre: 'Descenso (PC+2)', masaSeca: 2200, masaProp: 8200, isp: 311, empuje: 90000, motores: 1, burnTime: 450, throttleable: true },
        { nombre: 'Ascenso', masaSeca: 2300, masaProp: 2500, isp: 311, empuje: 16000, motores: 1, burnTime: 440 }
      ],
      diam: 4.2, cd: 0.5, areaRef: 13.8, long: 7.0,
      rcs: { fuerz: 450, isp: 290 }
    },
    cm_odyssey: {
      nombre: 'CM Odyssey (Entrada)',
      masaInicial: 5500,
      etapas: [
        { nombre: 'Entrada', masaSeca: 5500, masaProp: 0, isp: 0, empuje: 0, motores: 0, burnTime: 0 }
      ],
      diam: 3.9, cd: 1.3, areaRef: 12.0, long: 3.5,
      rcs: { fuerz: 1000, isp: 300 }
    },
    icps: {
      nombre: 'ICPS (SLS Upper Stage)',
      masaInicial: 30000,
      etapas: [
        { nombre: 'ICPS', masaSeca: 3500, masaProp: 27000, isp: 462, empuje: 110000, motores: 1, burnTime: 1100 }
      ],
      diam: 5.0, cd: 0.4, areaRef: 19.6, long: 5.5,
      rcs: { fuerz: 1000, isp: 300 }
    },
    deep_transport: {
      nombre: 'Transporte Profundo (Marte)',
      masaInicial: 200000,
      etapas: [
        { nombre: 'TMI', masaSeca: 15000, masaProp: 120000, isp: 380, empuje: 500000, motores: 1, burnTime: 600 },
        { nombre: 'MOI', masaSeca: 15000, masaProp: 80000, isp: 380, empuje: 500000, motores: 1, burnTime: 1800 }
      ],
      diam: 8.0, cd: 0.4, areaRef: 50.0, long: 24,
      rcs: { fuerz: 5000, isp: 350 }
    },
    mars_descent: {
      nombre: 'Módulo Descenso Marte (EDL)',
      masaInicial: 25000,
      etapas: [
        { nombre: 'Aeroshell', masaSeca: 4000, masaProp: 0, isp: 0, empuje: 0, motores: 0, burnTime: 0 },
        { nombre: 'Paracaídas', masaSeca: 1000, masaProp: 0, isp: 0, empuje: 0, motores: 0, burnTime: 0 },
        { nombre: 'Retrocohetes', masaSeca: 1500, masaProp: 8000, isp: 320, empuje: 80000, motores: 4, burnTime: 60, throttleable: true }
      ],
      diam: 4.5, cd: 1.5, areaRef: 15.9, long: 5.0, // aeroshell
      rcs: { fuerz: 2000, isp: 300 }
    },
    mars_ascent: {
      nombre: 'Vehículo Ascenso Marte',
      masaInicial: 8000,
      etapas: [
        { nombre: 'Ascenso', masaSeca: 2000, masaProp: 6000, isp: 360, empuje: 50000, motores: 1, burnTime: 300 }
      ],
      diam: 2.5, cd: 0.5, areaRef: 4.9, long: 3.0,
      rcs: { fuerz: 1000, isp: 350 }
    }
  };

  // Perfiles de referencia: se interpolan contra la altitud en las fases de
  // entrada/descenso y contra el tiempo en el resto.
  var PERFILES = {
    // Saturn V - Apolo 11/13
    saturnV_ascenso: [
      /* Giro por gravedad: el cabeceo lo fija la VELOCIDAD, no el reloj.
       * Mantiene componente vertical suficiente para que el arcón no se
       * venga abajo antes de tener velocidad: un programa que bajaba de
       * más tiraba el vehículo a 6 km a los 270 s. */
      { vel: 0, pitch: 90, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 300, pitch: 86, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 600, pitch: 62, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 900, pitch: 50, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 1300, pitch: 42, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 2000, pitch: 36, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 2800, pitch: 31, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 3600, pitch: 27, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 4400, pitch: 22, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 5200, pitch: 17, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' },
      { vel: 6200, pitch: 10, yaw: 0, throttle: 1.0, stage: 0, notas: 'giro por velocidad' }
    ],
    // LM Descent - Apolo 11
    lm_descent: [
      { alt: 15000, pitch: -15, yaw: 0, throttle: 0.65, stage: 0, notas: 'Frenado inicial (PDI)' },
      { alt: 10000, pitch: -10, yaw: 0, throttle: 0.55, stage: 0, notas: 'Aproximación' },
      { alt: 7000,  pitch: -5,  yaw: 0, throttle: 0.45, stage: 0, notas: 'Reducción empuje' },
      { alt: 4000,  pitch: 0,   yaw: 0, throttle: 0.35, stage: 0, notas: 'Aproximación final' },
      { alt: 2000,  pitch: 5,   yaw: 0, throttle: 0.28, stage: 0, notas: 'Pitch up: ventana' },
      { alt: 500,   pitch: 10,  yaw: 0, throttle: 0.22, stage: 0, notas: 'Hover / selección sitio' },
      { alt: 100,   pitch: 15,  yaw: 0, throttle: 0.18, stage: 0, notas: 'Descenso final' },
      { alt: 10,    pitch: 20,  yaw: 0, throttle: 0.12, stage: 0, notas: 'Contact probes' },
      { alt: 0,     pitch: 20,  yaw: 0, throttle: 0.0,  stage: 0, notas: 'TOUCHDOWN' }
    ],
    // Starship Mars Entry
    starship_mars_entry: [
      { alt: 125000, pitch: 0,   roll: 0,  bank: 0,   throttle: 0, stage: 0, notas: 'Interface entrada (125 km)' },
      { alt: 100000, pitch: 10,  roll: 0,  bank: 15,  throttle: 0, stage: 0, notas: 'Peak heating - bank control' },
      { alt: 70000,  pitch: 15,  roll: 0,  bank: 30,  throttle: 0, stage: 0, notas: 'Max deceleration' },
      { alt: 40000,  pitch: 20,  roll: 0,  bank: 45,  throttle: 0, stage: 0, notas: 'Transición supersónica' },
      { alt: 20000,  pitch: 25,  roll: 0,  bank: 60,  throttle: 0, stage: 0, notas: 'Subsónico - prep flip' },
      { alt: 10000,  pitch: 30,  roll: 0,  bank: 90,  throttle: 0, stage: 1, notas: 'BELLY FLOP - bank 90°' },
      { alt: 5000,   pitch: 45,  roll: 0,  bank: 90,  throttle: 0, stage: 1, notas: 'Planeo horizontal' },
      { alt: 2000,   pitch: 60,  roll: 0,  bank: 0,   throttle: 0.5, stage: 2, notas: 'FLIP MANEUVER - vertical' },
      { alt: 1000,   pitch: 80,  roll: 0,  bank: 0,   throttle: 0.7, stage: 2, notas: 'Encendido Raptors landing' },
      { alt: 500,    pitch: 90,  roll: 0,  bank: 0,   throttle: 0.85, stage: 2, notas: 'Hover final' },
      { alt: 0,      pitch: 90,  roll: 0,  bank: 0,   throttle: 0.0, stage: 2, notas: 'TOUCHDOWN MARTE' }
    ],
    // Orion Earth Entry (Artemis II)
    orion_earth_entry: [
      { alt: 122000, pitch: 0,  roll: 0, bank: 0,  throttle: 0, stage: 0, notas: 'Entry Interface (EI)' },
      { alt: 100000, pitch: 5,  roll: 0, bank: 20, throttle: 0, stage: 0, notas: 'Peak heating' },
      { alt: 70000,  pitch: 10, roll: 0, bank: 40, throttle: 0, stage: 0, notas: 'Max G-load' },
      { alt: 40000,  pitch: 15, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Guidance phase' },
      { alt: 20000,  pitch: 20, roll: 0, bank: 80, throttle: 0, stage: 0, notas: 'Final approach' },
      { alt: 10000,  pitch: 25, roll: 0, bank: 0,  throttle: 0, stage: 1, notas: 'Drogue deploy' },
      { alt: 5000,   pitch: 30, roll: 0, bank: 0,  throttle: 0, stage: 1, notas: 'Main deploy' },
      { alt: 0,      pitch: 30, roll: 0, bank: 0,  throttle: 0, stage: 1, notas: 'SPLASHDOWN' }
    ],
    // Hover practice (free flight)
    hover: [
      { t: 0, pitch: 0, yaw: 0, roll: 0, throttle: 0.5, stage: 0, notas: 'Mantén posición' }
    ],
    // Perfiles adicionales para misiones
    // Saturn V TLI (usa el mismo vehículo saturnV, etapa S-IVB)
    saturnV_tli: [
      { t: 0,   pitch: 0, yaw: 0, throttle: 1.0, stage: 2, notas: 'S-IVB en orbita parking - alineacion TLI' },
      { t: 60,  pitch: 0, yaw: 0, throttle: 1.0, stage: 2, notas: 'Encendido TLI - 3150 m/s' },
      { t: 360, pitch: 0, yaw: 0, throttle: 1.0, stage: 2, notas: 'TLI a pleno empuje' },
      { t: 400, pitch: 0, yaw: 0, throttle: 0.0, stage: 2, notas: 'SECO TLI - Rumbo a la Luna' }
    ],
    // CSM+LM Transposición y acoplamiento
    csm_lm_acople: [
      { t: 0, pitch: 0, yaw: 0, roll: 0, throttle: 0, stage: 0, notas: 'Separación CSM de S-IVB' },
      { t: 30, pitch: 0, yaw: 180, roll: 0, throttle: 0.1, stage: 0, notas: 'Giro 180° (transposición)' },
      { t: 120, pitch: 0, yaw: 180, roll: 0, throttle: 0.05, stage: 0, notas: 'Aproximación al LM' },
      { t: 300, pitch: 0, yaw: 180, roll: 0, throttle: 0.0, stage: 0, notas: '■ ACOPLAR con LM [ESPACIO]' },
      { t: 360, pitch: 0, yaw: 180, roll: 0, throttle: 0.1, stage: 0, notas: 'Eyección CSM+LM' }
    ],
    csm_lm_transposition: [
      { t: 0, pitch: 0, yaw: 0, roll: 0, throttle: 0, stage: 0, notas: 'Separación CSM de S-IVB' },
      { t: 30, pitch: 0, yaw: 180, roll: 0, throttle: 0.1, stage: 0, notas: 'Giro 180° (transposición)' },
      { t: 120, pitch: 0, yaw: 180, roll: 0, throttle: 0.05, stage: 0, notas: 'Aproximación al LM' },
      { t: 300, pitch: 0, yaw: 180, roll: 0, throttle: 0.0, stage: 0, notas: '■ ACOPLAR con LM [ESPACIO]' },
      { t: 360, pitch: 0, yaw: 180, roll: 0, throttle: 0.1, stage: 0, notas: 'Eyección CSM+LM' }
    ],
    // LM Eagle descenso (usa lm_descent existente)
    lm_eagle_descenso: [
      { alt: 15000, pitch: -15, yaw: 180, throttle: 1.0, stage: 0, notas: 'Frenado inicial (PDI)' },
      { alt: 10000, pitch: -10, yaw: 180, throttle: 1.0, stage: 0, notas: 'Aproximacion' },
      { alt: 7000,  pitch: -5,  yaw: 180, throttle: 1.0, stage: 0, notas: 'Reduccion empuje' },
      { alt: 4000,  pitch: 0,   yaw: 180, throttle: 1.0, stage: 0, notas: 'Aproximacion final' },
      { alt: 2000,  pitch: 5,   yaw: 180, throttle: 1.0, stage: 0, notas: 'Pitch up: ventana' },
      { alt: 500,   pitch: 0,   yaw: 0,   throttle: 0.0, stage: 0, notas: 'Transition a hover' },
      { alt: 100,   pitch: 85,  yaw: 0,   throttle: 0.6, stage: 0, notas: 'Descenso final' },
      { alt: 10,    pitch: 88,  yaw: 0,   throttle: 0.7, stage: 0, notas: 'Contact probes' },
      { alt: 0,     pitch: 90,  yaw: 0,   throttle: 0.0, stage: 0, notas: 'TOUCHDOWN' }
    ],
    // LM Eagle ascenso
    lm_ascent_ascenso: [
      { t: 0, pitch: 90, yaw: 0, throttle: 1.0, stage: 0, notas: '■ ENCENDIDO motor ascenso [ESPACIO]' },
      { t: 10, pitch: 85, yaw: 0, throttle: 1.0, stage: 0, notas: 'Pitch down - programa de ascenso' },
      { t: 60, pitch: 45, yaw: 0, throttle: 1.0, stage: 0, notas: 'Ascenso orbital' },
      { t: 300, pitch: 0, yaw: 0, throttle: 1.0, stage: 0, notas: 'Inyección órbita lunar baja' },
      { t: 440, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'SECO - Rendez-vous con CSM' }
    ],
    // CM Columbia/Odisey entrada
    cm_columbia_entrada: [
      { alt: 122000, pitch: 0, roll: 0, bank: 0, throttle: 0, stage: 0, notas: 'Entry Interface (EI)' },
      { alt: 100000, pitch: 5, roll: 0, bank: 20, throttle: 0, stage: 0, notas: 'Peak heating' },
      { alt: 70000,  pitch: 10, roll: 0, bank: 40, throttle: 0, stage: 0, notas: 'Max G-load' },
      { alt: 40000,  pitch: 15, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Guidance phase' },
      { alt: 20000,  pitch: 20, roll: 0, bank: 80, throttle: 0, stage: 0, notas: 'Final approach' },
      { alt: 10000,  pitch: 25, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Drogue deploy' },
      { alt: 5000,   pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Main deploy' },
      { alt: 0,      pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'SPLASHDOWN' }
    ],
    cm_odyssey_entrada: [
      { alt: 122000, pitch: 0, roll: 0, bank: 0, throttle: 0, stage: 0, notas: 'Entry Interface (EI)' },
      { alt: 100000, pitch: 5, roll: 0, bank: 20, throttle: 0, stage: 0, notas: 'Peak heating' },
      { alt: 70000,  pitch: 10, roll: 0, bank: 40, throttle: 0, stage: 0, notas: 'Max G-load' },
      { alt: 40000,  pitch: 15, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Guidance phase' },
      { alt: 20000,  pitch: 20, roll: 0, bank: 80, throttle: 0, stage: 0, notas: 'Final approach' },
      { alt: 10000,  pitch: 25, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Drogue deploy' },
      { alt: 5000,   pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Main deploy' },
      { alt: 0,      pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'SPLASHDOWN' }
    ],
    // LM Aquarius maniobra PC+2
    lm_aquarius_maniobra: [
      { t: 0, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'Alineación para PC+2' },
      { t: 30, pitch: -5, yaw: 0, throttle: 1.0, stage: 0, notas: '■ EJECUTAR PC+2 (260s) [ESPACIO]' },
      { t: 260, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'Corte motor - Trayectoria retorno libre' }
    ],
    // ICPS TLI
    icps_tli: [
      { t: 0, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'ICPS en órbita parking - alineación' },
      { t: 60, pitch: 0, yaw: 0, throttle: 1.0, stage: 0, notas: '■ EJECUTAR TLI (RL10) [ESPACIO]' },
      { t: 1100, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'SECO TLI - Rumbo a la Luna' }
    ],
    // SLS Ascenso
    sls_ascenso: [
      { t: 0, pitch: 90, yaw: 0, throttle: 1.0, stage: 0, notas: 'Encendido 4x RS-25 + 2x SRB' },
      { t: 10, pitch: 88, yaw: 0, throttle: 1.0, stage: 0, notas: 'Programa de giro' },
      { t: 60, pitch: 75, yaw: 0, throttle: 0.8, stage: 0, notas: 'Max-Q - throttle down' },
      { t: 126, pitch: 60, yaw: 0, throttle: 0.0, stage: 1, notas: '■ SEPARAR SRB [ESPACIO]' },
      { t: 130, pitch: 60, yaw: 0, throttle: 1.0, stage: 1, notas: 'Core Stage empuje completo' },
      { t: 480, pitch: 15, yaw: 0, throttle: 0.0, stage: 2, notas: 'MECO Core - ■ SEPARAR Core [ESPACIO]' },
      { t: 485, pitch: 15, yaw: 0, throttle: 1.0, stage: 2, notas: 'Encendido ICPS (RL10)' },
      { t: 1100, pitch: 0, yaw: 0, throttle: 0.0, stage: 2, notas: 'SECO ICPS - Órbita parking' }
    ],
    // Transporte profundo Marte
    deep_transport_tmi: [
      { t: 0, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'En órbita terrestre - alineación TMI' },
      { t: 60, pitch: 0, yaw: 0, throttle: 1.0, stage: 0, notas: '■ EJECUTAR TMI (2.9 km/s) [ESPACIO]' },
      { t: 600, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'Corte motor - Transferencia Hohmann' }
    ],
    deep_transport_moi: [
      { t: 0, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'Aproximación a Marte - prep MOI' },
      { t: 60, pitch: 90, yaw: 0, throttle: 1.0, stage: 0, notas: '■ EJECUTAR MOI [ESPACIO]' },
      { t: 1800, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'Captura orbital marciana' }
    ],
    // Marte EDL
    mars_descent_edl: [
      { alt: 125000, pitch: 0, roll: 0, bank: 0, throttle: 0, stage: 0, notas: 'Entry Interface (125 km)' },
      { alt: 100000, pitch: 10, roll: 0, bank: 15, throttle: 0, stage: 0, notas: 'Peak heating - aeroshell' },
      { alt: 70000,  pitch: 15, roll: 0, bank: 30, throttle: 0, stage: 0, notas: 'Max deceleration' },
      { alt: 40000,  pitch: 20, roll: 0, bank: 45, throttle: 0, stage: 0, notas: 'Supersonic transition' },
      { alt: 20000,  pitch: 25, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Subsonic - prep parachute' },
      { alt: 10000,  pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: '■ DESPLEGAR PARACAÍDAS [ESPACIO]' },
      { alt: 5000,   pitch: 35, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Separar aeroshell' },
      { alt: 2000,   pitch: 40, roll: 0, bank: 0, throttle: 0.5, stage: 2, notas: '■ ENCENDER RETROCOHETES [ESPACIO]' },
      { alt: 500,    pitch: 50, roll: 0, bank: 0, throttle: 0.7, stage: 2, notas: 'Hover terminal' },
      { alt: 0,      pitch: 90, roll: 0, bank: 0, throttle: 0.0, stage: 2, notas: 'TOUCHDOWN MARTE' }
    ],
    // Marte Ascenso
    mars_ascent_ascenso: [
      { t: 0, pitch: 90, yaw: 0, throttle: 1.0, stage: 0, notas: '■ ENCENDIDO motor ascenso [ESPACIO]' },
      { t: 10, pitch: 85, yaw: 0, throttle: 1.0, stage: 0, notas: 'Pitch down - programa de ascenso' },
      { t: 60, pitch: 45, yaw: 0, throttle: 1.0, stage: 0, notas: 'Ascenso orbital' },
      { t: 200, pitch: 0, yaw: 0, throttle: 1.0, stage: 0, notas: 'Inyección órbita de encuentro' },
      { t: 300, pitch: 0, yaw: 0, throttle: 0.0, stage: 0, notas: 'SECO - Rendez-vous con transporte' }
    ],
    // Orion entrada y amarizaje (Artemis II)
    orion_entrada: [
      { alt: 122000, pitch: 0, roll: 0, bank: 0, throttle: 0, stage: 0, notas: 'Entry Interface (EI)' },
      { alt: 100000, pitch: 5, roll: 0, bank: 20, throttle: 0, stage: 0, notas: 'Peak heating' },
      { alt: 70000,  pitch: 10, roll: 0, bank: 40, throttle: 0, stage: 0, notas: 'Max G-load' },
      { alt: 40000,  pitch: 15, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Guidance phase' },
      { alt: 20000,  pitch: 20, roll: 0, bank: 80, throttle: 0, stage: 0, notas: 'Final approach' },
      { alt: 10000,  pitch: 25, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Drogue deploy' },
      { alt: 5000,   pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Main deploy' },
      { alt: 0,      pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'SPLASHDOWN' }
    ],
    orion_amarizaje: [
      { alt: 122000, pitch: 0, roll: 0, bank: 0, throttle: 0, stage: 0, notas: 'Entry Interface (EI)' },
      { alt: 100000, pitch: 5, roll: 0, bank: 20, throttle: 0, stage: 0, notas: 'Peak heating' },
      { alt: 70000,  pitch: 10, roll: 0, bank: 40, throttle: 0, stage: 0, notas: 'Max G-load' },
      { alt: 40000,  pitch: 15, roll: 0, bank: 60, throttle: 0, stage: 0, notas: 'Guidance phase' },
      { alt: 20000,  pitch: 20, roll: 0, bank: 80, throttle: 0, stage: 0, notas: 'Final approach' },
      { alt: 10000,  pitch: 25, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Drogue deploy' },
      { alt: 5000,   pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'Main deploy' },
      { alt: 0,      pitch: 30, roll: 0, bank: 0, throttle: 0, stage: 1, notas: 'SPLASHDOWN' }
    ]
  };

  // Estado de entrada por fase: altitud inicial y cómo se已达 esa fase.
  // Antes todas las fases empezaban pegadas al suelo, así que los perfiles
  // indexados por altitud terminaban en el primer paso.
  var INICIO = {
    hover:         { alt: 120,    modo: 'vuelo'   },
    ascenso:       { alt: 0,      modo: 'suelo'   },
    tli:           { alt: 200e3,  modo: 'orbital', etapa: 2 },
    tmi:           { alt: 200e3,  modo: 'orbital', etapa: 2 },
    moi:           { alt: 2.0e6,  modo: 'aproximacion', vInf: 1400, gamma: -60 },
    maniobra:      { alt: 300e3,  modo: 'orbital' },
    acople:        { alt: 110e3,  modo: 'orbital' },
    transposicion: { alt: 110e3,  modo: 'orbital' },
    descenso:      { alt: 15e3,   modo: 'orbital'  },
    entrada:       { alt: 122e3,  modo: 'entrada' },
    amarizaje:     { alt: 122e3,  modo: 'entrada' },
    edl:           { alt: 125e3,  modo: 'entrada' }
  };

  // Velocidad de entrada en la interfaz, por cuerpo.
  var V_ENTRADA = { tierra: 11.0e3, marte: 5.70e3, luna: 1.673e3 };

  // Estado actual del vuelo
  var state = {
    fase: 'hover',
    vehiculo: 'saturnV',
    perfil: null,
    t: 0,           // tiempo misión (s)
    dt: 1/60,
    // Estado orbital
    pos: [0, 0, 0],     // m (ECI)
    vel: [0, 0, 0],     // m/s
    // Actitud: el cuaternión es la fuente de verdad, `att` es la vista
    // en ángulos de Euler que consumen el HUD y la cabina.
    q: [0, 0, 0, 1],
    att: [0, 0, 0],     // pitch, yaw, roll (rad), derivado del cuaternión
    omega: [0, 0, 0],   // tasas angulares de cuerpo (rad/s)
    // Propulsión
    stage: 0,
    stageStartTime: 0,
    throttle: 1.0,      // 0..1
    masa: 0,            // kg actual
    propRestante: 0,    // kg
    inercia: { x: 1, y: 1, z: 1 },
    // Asistencia
    asistencia: 2,      // 0-3
    // Cuerpo de referencia de la fase
    cuerpo: null,
    // Métricas
    metricas: {},
    // Callbacks
    onStageSeparation: null,
    onCheckpoint: null,
    onComplete: null,
    onFailure: null
  };

  // Helpers vectoriales
  var V3 = {
    add: (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    sub: (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    mul: (a,s)=>[a[0]*s,a[1]*s,a[2]*s],
    dot: (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    cross: (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
    norm: a=>Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]),
    normalize: a=>{var n=V3.norm(a);return n>1e-12?[a[0]/n,a[1]/n,a[2]/n]:[0,0,0];}
  };

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function finito(x) { return typeof x === 'number' && isFinite(x); }

  // -----------------------------------------------------------------------
  // Cuerpo de una fase. Antes `cuerpo` se derivaba en dos sitios distintos
  // y el arrastre medía la altitud contra R_EARTH aunque el vehículo
  // estuviera en Marte.
  // -----------------------------------------------------------------------
  function cuerpoDe(vehiculo, fase) {
    switch (fase) {
      case 'edl':   return CUERPOS.marte;
      case 'moi':   return CUERPOS.marte;
      case 'descenso':    return CUERPOS.luna;
      case 'maniobra':    return CUERPOS.luna;
      case 'acople':      return CUERPOS.luna;
      case 'transposicion': return CUERPOS.luna;
      case 'ascenso':
        if (vehiculo === 'lm_ascent' || vehiculo === 'lm' ||
            vehiculo === 'lm_eagle' || vehiculo === 'lm_aquarius') return CUERPOS.luna;
        if (vehiculo === 'mars_ascent') return CUERPOS.marte;
        return CUERPOS.tierra;
      case 'entrada':
      case 'amarizaje':
        if (vehiculo === 'starship' || vehiculo === 'mars_descent') return CUERPOS.marte;
        return CUERPOS.tierra;
      default: return CUERPOS.tierra;
    }
  }

  // -----------------------------------------------------------------------
  // Órdenes de magnitud. Devuelve el eje sobre el que se interpola el perfil.
  // Antes `simulatePerfect` y `resetAttitude` usaban siempre 't', incluso en
  // perfiles indexados por altitud, y leían `undefined`.
  // -----------------------------------------------------------------------
  function claveDePerfil(fase) {
    // Preferencia de la fase: el ascenso se guía por velocidad y la bajada
    // o la entrada por altitud. Queda a un lado si el perfil usa otra clave.
    if (fase === 'ascenso') return 'vel';
    return (fase === 'descenso' || fase === 'entrada' ||
            fase === 'amarizaje' || fase === 'edl') ? 'alt' : 't';
  }

  var CLAVES_PERFIL = ["alt", "vel", "t"];

  /* Clave con la que se interpola de verdad: si el perfil no tiene la que
   * pide la fase, se usa la que tenga. Un perfil por tiempo en una fase de
   * ascenso (SLS, LM, ascenso marciano) caía al pitch 0 por defecto. */
  function claveEfectiva(fase, perfil) {
    var quiero = claveDePerfil(fase);
    if (perfil && perfil.length) {
      if (perfil.some(function (p) { return p[quiero] !== undefined; })) return quiero;
      for (var i = 0; i < CLAVES_PERFIL.length; i++) {
        var k = CLAVES_PERFIL[i];
        if (perfil.some(function (p) { return p[k] !== undefined; })) return k;
      }
    }
    return quiero;
  }

  function valorDePerfil(clave, pos) {
    if (clave === 'alt') {
      var c = state.cuerpo || CUERPOS.tierra;
      return V3.norm(pos) - c.R;
    }
    if (clave === 'vel') return V3.norm(state.vel);
    return state.t;
  }

  // Interpolación lineal en perfil
  function interpolarPerfil(perfil, clave, valor) {
    var arr = perfil.filter(function (p) { return p[clave] !== undefined; });
    if (arr.length === 0) {
      return { pitch: 0, yaw: 0, roll: 0, bank: 0, throttle: 1, stage: 0, notas: '' };
    }

    function punto(a, b, t) {
      return {
        pitch: a.pitch + (b.pitch - a.pitch) * t,
        yaw:   a.yaw   + (b.yaw   - a.yaw)   * t,
        roll:  (a.roll  || 0) + ((b.roll  || 0) - (a.roll  || 0)) * t,
        bank:  (a.bank  || 0) + ((b.bank  || 0) - (a.bank  || 0)) * t,
        throttle: a.throttle + (b.throttle - a.throttle) * t,
        stage: Math.max(a.stage, b.stage),
        notas: t < 0.5 ? (a.notas || '') : (b.notas || '')
      };
    }

    for (var i = 0; i < arr.length - 1; i++) {
      var a = arr[i], b = arr[i + 1];
      var va = a[clave], vb = b[clave];
      if ((va <= valor && valor <= vb) || (va >= valor && valor >= vb)) {
        var t = (vb === va) ? 0 : (valor - va) / (vb - va);
        return punto(a, b, t);
      }
    }
    // Fuera de rango: los extremos, ya normalizados al mismo formato.
    var primero = arr[0], ultimo = arr[arr.length - 1];
    return punto(primero, ultimo, valor < primero[clave] ? 0 : 1);
  }

  // -----------------------------------------------------------------------
  // Gravedad: punto más J2 y perturbación lunar por mareas. En un simulador
  // cislunar el término de tercer cuerpo es el que define la misión.
  // -----------------------------------------------------------------------
  function gravedad(pos, cuerpo) {
    var r = V3.norm(pos);
    if (r < 1e-9) return [0, 0, 0];
    var rn = V3.normalize(pos);
    var mu = cuerpo.mu;
    var g = V3.mul(rn, -mu / (r * r));

    // J2: achatamiento del elipsoide, despreciable en la Luna.
    // a_J2 = -(3/2)·J2·μ·R²/r⁵ · [x(1-5z²), y(1-5z²), z(3-5z²)]  (z normalizado)
    if (cuerpo.J2 && r > cuerpo.R * 0.5) {
      var z = pos[2] / r;
      var z2 = z * z;
      var r5 = r * r * r * r * r;
      var k = 1.5 * cuerpo.J2 * mu * cuerpo.R * cuerpo.R / r5;
      g = V3.add(g, [
        -k * pos[0] * (1 - 5 * z2),
        -k * pos[1] * (1 - 5 * z2),
        -k * pos[2] * (3 - 5 * z2)
      ]);
    }

    // Luna como tercer cuerpo: término de marea, es decir la diferencia entre
    // la gravedad lunar y su expansión de primer orden. En órbita cislunar es
    // el término dominante del movimiento relativo.
    // a = (μM/R³)·[ 3(r·r̂M)r̂M − r ],  con r̂M sobre el eje +X del plano.
    if (cuerpo.id === 'tierra') {
      var d3 = R_MOON_ORB * R_MOON_ORB * R_MOON_ORB;
      var kM = G * M_MOON / d3;
      var rM = pos[0];                                // r · r̂M
      g = V3.add(g, V3.mul(V3.sub(V3.mul([1, 0, 0], 3 * rM), pos), kM));
    }
    return g;
  }

  // Velocidad del aire: la atmósfera gira con el cuerpo.
  function velocidadAire(vel, pos, cuerpo) {
    if (!cuerpo.rot) return vel;
    return V3.sub(vel, V3.cross([0, 0, cuerpo.rot], pos));
  }

  // Densidad exponencial. Por debajo de la superficie devuelve la densidad
  // al nivel del mar en vez de desbordar la exponencial.
  function densidadAtmosfera(alt, cuerpo) {
    if (!cuerpo.atm) return 0;
    if (!(alt > 0)) return cuerpo.rho0;
    var d = cuerpo.rho0 * Math.exp(-alt / cuerpo.H);
    return d > cuerpo.rho0 ? cuerpo.rho0 : d;
  }

  // Velocidad del sonido con gradiente térmico: a = √(γ·Rs·T).
  function velSonido(alt, cuerpo) {
    if (!cuerpo.atm || !cuerpo.Rs) return 0;
    var T = cuerpo.T0 - cuerpo.lapse * alt;
    if (T < 216.65) T = 216.65;
    return Math.sqrt(cuerpo.gamma * cuerpo.Rs * T);
  }

  // Coeficiente de arrastre en función del número de Mach: sube a Mach bajo
  // por la onda de choque, cae en el régimen transónico y vuelve a crecer en
  // hipersónico.
  function cdMaq(M) {
    // Cuerpo esbelto (cohete): friccion de piel dominante. El valor antiguo
    // (0,9 subsonico, 1,7 parado) era de cuerpo romo y hacia que el Saturn V
    // perdiera un sexto de su empuje contra el aire a 800 m/s; con 80 m² ya
    // no llegaba a orbita. Max-q real ~35 kPa, que aqui si sale.
    if (!(M > 0)) return 0.30;
    if (M < 0.3) return 0.30;
    if (M < 0.9) return 0.30 + 0.10 * (M - 0.3) / 0.6;   // borde transonico
    if (M < 1.2) return 0.40;
    if (M < 5.0) return 0.40 - 0.20 * (M - 1.2) / 3.8;
    return 0.20 + 0.10 * Math.min(1, (M - 5) / 25);
  }

  // Marco local del vehículo: arriba (radial), este y norte.
  function marcoLocal(pos) {
    var up = V3.normalize(pos);
    var ref = Math.abs(up[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    var este = V3.normalize(V3.cross(ref, up));
    var norte = V3.normalize(V3.cross(up, este));
    return { up: up, este: este, norte: norte };
  }

  // Dirección del empuje. `pitch` 90° apunta al cenit, 0° al horizonte.
  function dirEmpuje(pitch, yaw, marco) {
    var p = rad(pitch), y = rad(yaw);
    var horiz = V3.add(V3.mul(marco.este, Math.cos(y)), V3.mul(marco.norte, Math.sin(y)));
    return V3.normalize(V3.add(V3.mul(marco.up, Math.sin(p)), V3.mul(horiz, Math.cos(p))));
  }

  // Sustentación por control vectorial (balance). El banco 90° da sustentación
  // máxima, como fija el perfil de entrada.
  function dirSustentacion(vRel, bank, marco) {
    if (!bank) return [0, 0, 0];
    var vhat = V3.normalize(vRel);
    var lat = V3.cross(V3.cross(vhat, marco.up), vhat);
    var ln = V3.norm(lat);
    if (ln < 1e-9) return [0, 0, 0];
    return V3.mul(lat, Math.sin(rad(bank)) / ln);
  }

  // Empuje vectorial: dirección del marco local y consumo de propelente.
  function empujeVector(throttle, pitch, yaw, vehiculo) {
    var stageData = vehiculo.etapas[Math.min(vehiculo.etapas.length - 1, state.stage)];
    if (!stageData || stageData.masaProp <= 0 || stageData.empuje <= 0) {
      return { fuerza: 0, dir: [0, 0, 0], mdot: 0, etapa: stageData };
    }
    // La tobera rinde mas al salir de la atmosfera: sube el empuje y sube el
    // empuje especifico. Con un valor fijo de rampa, la relacion empuje/peso
    // no crecia y el ascenso no podia sostener la subida.
    var c = state.cuerpo || CUERPOS.tierra;
    var altAh = V3.norm(state.pos) - c.R;
    var frac = (c.atm && c.rho0 > 0) ? densidadAtmosfera(altAh, c) / c.rho0 : 0;
    if (frac > 1) frac = 1;
    var emp = stageData.empuje;
    if (stageData.empujeVac) emp = stageData.empujeVac * (1 - frac) + stageData.empuje * frac;
    var isp = stageData.isp;
    if (stageData.ispVac) isp = stageData.ispVac * (1 - frac) + stageData.isp * frac;
    var F = emp * clamp(throttle, 0, 1);
    return {
      fuerza: F,
      dir: dirEmpuje(pitch, yaw, state.marco),
      mdot: F / (isp * G0),
      isp: isp,
      etapa: stageData
    };
  }

  // Tensor de inercia por vehículo: cilindro macizo, no 30 m fijos.
  function inerciaDe(veh, masa) {
    var r = veh.diam / 2;
    var L = veh.long || veh.diam * 2;
    var axial = 0.5 * masa * r * r;
    var transversal = masa * (3 * r * r + L * L) / 12;
    return { x: axial, y: transversal, z: transversal };
  }

  // Torque por gimbal del motor y por propulsores de actitud.
  function torqueControl(input, vehiculo) {
    var stageData = vehiculo.etapas[Math.min(vehiculo.etapas.length - 1, state.stage)];
    var empujeMax = stageData && stageData.empuje ? stageData.empuje : 0;
    var rcsF = vehiculo.rcs ? vehiculo.rcs.fuerz : 0;
    var brazo = vehiculo.diam / 2;           // gimbals y propulsores al mismo radio
    var gimbalMax = rad(12);
    var I = state.inercia;

    var tauPitch = -input.pitch * gimbalMax * empujeMax * brazo;
    var tauYaw   =  input.yaw   * gimbalMax * empujeMax * brazo;
    var tauRoll  = -input.roll  * rcsF * brazo;

    return [tauPitch / I.y, tauYaw / I.z, tauRoll / I.x];
  }

  // Error angular por el camino corto: pitch vive en (-90°, 90°) y sin esto
  // un objetivo de -20° con la nave a +85° pedía girar 105° al revés.
  function errAng(d) {
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  // Asistencia (SAS educativo): controlador PD en actitud.
  // wn (frecuencia propia) y zeta (amortiguamiento) fijan la respuesta:
  //   aceleración = wn²·error − 2·zeta·wn·velocidad angular
  // Antes eran tres ganancias sueltas (damp/hold/nudge) que sumaban un Kp de
  // 0,05: frecuencia propia 0,22 rad/s, 37 % de sobreimpulso y 28 s de período.
  // El Saturn V, sin nadie que lo sujete, oscilaba y terminaba cayendo.
  function calcularAsistencia(input, optimo) {
    var cfg = ASISTENCIA[Math.min(3, Math.max(0, state.asistencia))];
    if (state.asistencia === 0) return [0, 0, 0];

    var errPitch = errAng(rad(optimo.pitch) - state.att[0]);
    var errYaw   = errAng(rad(optimo.yaw)   - state.att[1]);
    var errRoll  = errAng(rad(optimo.roll || 0) - state.att[2]);

    var sinInput = Math.abs(input.pitch) < 0.05 &&
                   Math.abs(input.yaw)   < 0.05 &&
                   Math.abs(input.roll)  < 0.05;

    /* Sin input el SAS manda; con input sólo empuja una fracción del error,
     * para que el alumno siga teniendo que volar la trayectoria. */
    var escala = sinInput ? 1 : cfg.nudge;
    var kp = cfg.wn * cfg.wn, kd = 2 * cfg.zeta * cfg.wn;

    return [
      kp * escala * errPitch - kd * state.omega[0],
      kp * escala * errYaw   - kd * state.omega[1],
      kp * escala * errRoll  - kd * state.omega[2]
    ];
  }

  var ASISTENCIA = [
    { wn: 0.00, zeta: 0.7, nudge: 0.00 },  // 0: Sin ayuda
    { wn: 0.15, zeta: 0.5, nudge: 0.15 },  // 1: Principiante (perezoso: hay que volar)
    { wn: 0.35, zeta: 0.7, nudge: 0.45 },  // 2: Estándar (default)
    { wn: 0.80, zeta: 0.9, nudge: 1.00 }   // 3: Asistido (sigue el perfil casi solo)
  ];

  // -----------------------------------------------------------------------
  // Cuaterniones. El cuaternión es la fuente de verdad: `att` sale de él, así
  // el HUD sigue leyendo ángulos pero nunca se acumulan 3410° de cabeceo.
  // -----------------------------------------------------------------------
  function qNorm(q) {
    var n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    if (n < 1e-12) return [0, 0, 0, 1];
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
  }

  // Producto de Hamilton: a ⊗ b.
  function qMul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }

  function qDesdeEuler(pitch, yaw, roll) {
    // q = qz(yaw) ⊗ qy(pitch) ⊗ qx(roll).
    // El balance rota sobre X, el cabeceo sobre Y y la guiñada sobre Z.
    var qz = [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)];
    var qy = [0, Math.sin(pitch / 2), 0, Math.cos(pitch / 2)];
    var qx = [Math.sin(roll / 2), 0, 0, Math.cos(roll / 2)];
    return qNorm(qMul(qMul(qz, qy), qx));
  }

  function eulerDesdeQ(q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var roll  = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    var senP  = clamp(2 * (w * y - z * x), -1, 1);
    var pitch = Math.asin(senP);
    var yaw   = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return [pitch, yaw, roll];
  }

  // q̇ = ω ⊗ q, con ω en ejes de cuerpo.
  // Orden de ω en toda la física: [cabeceo, guiñada, alabeo].
  // Ejes del cuaternión: el alabeo va en X, el cabeceo en Y y la guiñada en Z
  // (así lo exige qDesdeEuler). Confundir los índices hacía que una tasa de
  // cabeceo rodase el vehículo: el SAS no sostenía la actitud y el ascenso
  // se tumbaba en cuanto la nave se separaba de la vertical.
  function qIntegra(q, omega, dt) {
    var wRoll  = omega[2] * dt * 0.5;   // alabeo  → eje X
    var wPitch = omega[0] * dt * 0.5;   // cabeceo → eje Y
    var wYaw   = omega[1] * dt * 0.5;   // guiñada → eje Z
    var wx = wRoll, wy = wPitch, wz = wYaw;
    return qNorm([
      q[0] + ( wx * q[3] + wy * q[2] - wz * q[1]),
      q[1] + (-wx * q[2] + wy * q[3] + wz * q[0]),
      q[2] + ( wx * q[1] - wy * q[0] + wz * q[3]),
      q[3] + (-wx * q[0] - wy * q[1] - wz * q[2])
    ]);
  }

  // Elementos orbitales reales.
  // La excentricidad sale del vector e⃗ = (v⃗ × h⃗)/μ − r̂ y no de
  // sqrt(1 + 2εh²/μ²): esa forma pierde toda precisión justo donde más
  // importa aquí, porque las entradas son casi parabólicas (E ≈ 0) y salía
  // e = 1.000 en lugar de 0.91.
  function elementos(r, v, mu) {
    var rn = V3.norm(r), v2 = V3.dot(v, v);
    var h = V3.cross(r, v);
    var hn = V3.norm(h);
    var en = v2 / 2 - mu / rn;             // energía específica
    var rhat = V3.normalize(r);
    var ev = V3.sub(V3.mul(V3.cross(v, h), 1 / mu), rhat);
    var e = V3.norm(ev);
    // Semieje mayor: estable para elipses; para hipérbolas sale de la energía.
    var a = (e < 1 && hn > 0) ? hn * hn / (mu * (1 - e * e)) : -mu / (2 * en);
    var inc = hn > 1e-9 ? Math.acos(clamp(h[2] / hn, -1, 1)) : 0;
    var rp = a * (1 - e);
    var ra = a * (1 + e);
    return {
      a: a, e: e, h: h, hn: hn, energia: en, inclinacion: inc, rn: rn, v2: v2,
      perigeo: rp, apogeo: ra,
      // Para trayectorias abiertas el perigeo sigue siendo válido; el apogeo no.
      abierto: e >= 1
    };
  }

  // Perigeo balístico de una velocidad dada en función del ángulo de vuelo.
  function perigeoDeVelocidad(pos, v, gamma, mu) {
    var r = V3.norm(pos);
    var up = V3.normalize(pos);
    // Marco local: tangencial sobre el plano, radial hacia fuera.
    var est = V3.normalize(V3.cross([0, 0, 1], up));
    var vh = v * Math.cos(gamma);
    var vr = v * Math.sin(gamma);
    var vel = V3.add(V3.mul(est, vh), V3.mul(up, vr));
    return elementos(pos, vel, mu).perigeo;
  }

  // Velocidad de entrada tal que la trayectoria balística entre por un perigeo
  // dado. Elegir la velocidad cruda es frágil: a 11,0 km/s sobre la Tierra el
  // vehículo queda a un suspiro de la velocidad de escape (11,08 km/s) y el
  // perigeo se va a 105 km, fuera de la atmósfera densa; el|Apolo entraba a
  // 10,83 km/s y caía a 33 km. Se resuelve el ángulo de vuelo por bisección.
  function velocidadDeEntrada(cuerpo, pos, v, perigeoObjetivo) {
    var r = V3.norm(pos);
    var lo = -85 * Math.PI / 180, hi = -0.5 * Math.PI / 180;
    var mejor = 0, mejorErr = Infinity;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      var p = perigeoDeVelocidad(pos, v, mid, cuerpo.mu);
      if (!isFinite(p)) { lo = mid; continue; }
      var err = Math.abs(p - perigeoObjetivo);
      if (err < mejorErr) { mejorErr = err; mejor = mid; }
      // Un ángulo más negativo (más vertical) baja el perigeo.
      if (p > perigeoObjetivo) hi = mid; else lo = mid;
    }
    var g = mejor;
    var up = V3.normalize(pos);
    var est = V3.normalize(V3.cross([0, 0, 1], up));
    var vh = v * Math.cos(g), vr = v * Math.sin(g);
    return V3.add(V3.mul(est, vh), V3.mul(up, vr));
  }

  // Aceleración total en un instante. Compartida por los dos pasos de Verlet.
  function aceleracion(pos, vel, cuerpo, veh, empuje, pitch, yaw, bank) {
    var a = gravedad(pos, cuerpo);
    var masa = Math.max(state.masa, 1);
    var alt = V3.norm(pos) - cuerpo.R;

    if (cuerpo.atm) {
      var vRel = velocidadAire(vel, pos, cuerpo);
      var v = V3.norm(vRel);
      var rho = densidadAtmosfera(alt, cuerpo);
      if (rho > 0 && v > 1e-6) {
        var aSon = velSonido(alt, cuerpo);
        var Ma = aSon > 1e-6 ? v / aSon : 0;
        var qPres = 0.5 * rho * v * v;
        var Fd = cdMaq(Ma) * qPres * veh.areaRef;
                /* El arrastre SIEMPRE se opone al movimiento. */
        a = V3.sub(a, V3.mul(V3.normalize(vRel), Fd / masa));

        // Sustentación: el balance reorienta la sustentación para pilotar el
        // punto de entrada sin motor (como el programa VECTOR del Apolo).
        var CL = 0.55 * Math.sin(rad(bank || 0));
        if (CL !== 0) {
          var dirL = dirSustentacion(vRel, bank, marcoLocal(pos));
          a = V3.add(a, V3.mul(dirL, CL * qPres * veh.areaRef / masa));
        }
      }
    }

    if (empuje.fuerza > 0) {
      a = V3.add(a, V3.mul(empuje.dir, empuje.fuerza / masa));
    }
    return a;
  }

  // Condiciones iniciales de la fase.
  function condicionInicial(fase, vehiculo, opciones) {
    var cuerpo = cuerpoDe(vehiculo, fase);
    var ini = INICIO[fase] || { alt: 0, modo: 'vuelo' };
    var alt = opciones.alt !== undefined ? opciones.alt : ini.alt;
    if (alt < 0) alt = 0;
    var r = cuerpo.R + alt;
    var pos = [r, 0, 0];

    var vel = [0, 0, 0];
    if (ini.modo === 'orbital') {
      vel = [0, Math.sqrt(cuerpo.mu / r), 0];
    } else if (ini.modo === 'aproximacion') {
      var vEsc = Math.sqrt(2 * cuerpo.mu / r);
      var vInf = ini.vInf || 2500;
      var vAp = Math.sqrt(vInf * vInf + vEsc * vEsc);
      var gam = rad(ini.gamma === undefined ? -60 : ini.gamma);
      vel = [vAp * Math.sin(gam), vAp * Math.cos(gam), 0];
    } else if (ini.modo === 'entrada') {
      // Una velocidad de entrada "redonda" (11,0 km/s sobre la Tierra) cae
      // casi exactamente sobre la velocidad de escape local: el perigeo
      // balístico resulta en 105 km, fuera de la atmósfera densa, y el
      // vehículo rebota al espacio. Se soluciona eligiendo el ángulo de
      // vuelo de modo que la trayectoria balística entre por el perigeo
      // objetivo.
      var v = V_ENTRADA[cuerpo.id] || Math.sqrt(cuerpo.mu / r);
      var rAp = (ini.perigeo !== undefined ? ini.perigeo : cuerpo.R + 30e3);
      vel = velocidadDeEntrada(cuerpo, pos, v, rAp);
    }
    return { pos: pos, vel: vel, cuerpo: cuerpo, modo: ini.modo,
             etapa: ini.etapa !== undefined ? ini.etapa : 0 };
  }

  // Entorno: cálculos por fase antes de integrar.
  // ------------------------------------------

  // Inicializar vuelo
  function init(fase, vehiculoKey, opciones) {
    opciones = opciones || {};
    state.fase = fase;
    state.vehiculo = vehiculoKey || 'saturnV';
    state.asistencia = opciones.asistencia !== undefined ? opciones.asistencia : 2;
    state.t = 0;
    state.dt = opciones.dt || 1/60;

    var veh = VEHICULOS[state.vehiculo];
    var ci = condicionInicial(state.fase, state.vehiculo, opciones);
    state.cuerpo = ci.cuerpo;

    /* La fase puede empezar en una etapa posterior: la TLI arranca con la
     * etapa superior ya en órbita baja, no con el cohete de 2.970 t entero. */
    state.stage = Math.max(0, Math.min(veh.etapas.length - 1,
      (ci.etapa !== undefined ? ci.etapa : (opciones.etapa || 0))));
    var masaEtapa = veh.masaInicial;
    for (var e = 0; e < state.stage; e++) {
      masaEtapa -= veh.etapas[e].masaProp + veh.etapas[e].masaSeca;
    }
    state.masa = Math.max(1, masaEtapa);
    state.propRestante = veh.etapas.reduce(function (s, e) { return s + e.masaProp; }, 0);
    state.inercia = inerciaDe(veh, state.masa);
    state.stageStartTime = 0;
    /* Propelente de la etapa actual: sin él, el motor no quema. */
    state.propEtapa = veh.etapas[state.stage] ? veh.etapas[state.stage].masaProp : 0;
    state.throttle = 1.0;
    state.pos = ci.pos;
    state.vel = ci.vel;
    state.marco = marcoLocal(state.pos);
    state.omega = [0, 0, 0];

    // De dónde despega esta fase. Las fases de suelo parten en la plataforma:
    // sin esta referencia no se puede distinguir "no ha despegado" de "se ha
    // caído", y un Saturn V en la rampa contaba como reentrada prematura.
    var R = ci.cuerpo.R;
    state.altInicio = Math.max(0, V3.norm(state.pos) - R);
    state.suelo = (ci.modo === 'suelo');
    state.enAire = false;
    state.altMax = state.altInicio;

    // Perfil óptimo
    var perfilKey = state.vehiculo + '_' + state.fase;
    state.perfil = PERFILES[perfilKey] || PERFILES.hover;

    // Actitud inicial: la del primer punto del perfil, salvo en las fases de
    // suelo y hover donde el vehículo sale vertical.
    var primero = state.perfil[0] || {};
    var pitch0 = (ci.modo === 'suelo' || state.fase === 'hover') ? 90 : (primero.pitch || 0);
    state.q = qDesdeEuler(rad(pitch0), rad(primero.yaw || 0), rad(primero.roll || 0));
    state.att = eulerDesdeQ(state.q);

    // Métricas
    state.metricas = {
      desvPitch: [], desvYaw: [], desvRoll: [],
      fueraZona: 0, correcciones: 0, maxDesv: 0,
      dvGastado: 0, propUsado: 0, staging: [],
      mach: 0, gMax: 0, qMax: 0
    };

    return state;
  }

  // Loop principal
  function step(input) {
    input = input || {};
    var iPitch = input.pitch || 0, iYaw = input.yaw || 0,
        iRoll = input.roll || 0, iThr = input.throttle || 0;

    var veh = VEHICULOS[state.vehiculo];
    var cuerpo = state.cuerpo || cuerpoDe(state.vehiculo, state.fase);

    // 1. Perfil óptimo actual
    var optimo = (function () {
      var c2 = claveEfectiva(state.fase, state.perfil);
      return interpolarPerfil(state.perfil, c2, valorDePerfil(c2, state.pos));
    })();

    // 2. Asistencia
    var asist = calcularAsistencia({pitch: iPitch, yaw: iYaw, roll: iRoll}, optimo);

    // 3. Torque total (input + asistencia)
    var tau = torqueControl({pitch: iPitch, yaw: iYaw, roll: iRoll}, veh);
    tau[0] += asist[0];
    tau[1] += asist[1];
    tau[2] += asist[2];

    // 4. Actitud por cuaternión (sin bloqueo Cardán, sin ángulos sin wrap)
    state.omega[0] += tau[0] * state.dt;
    state.omega[1] += tau[1] * state.dt;
    state.omega[2] += tau[2] * state.dt;

    // Amortiguamiento natural
    state.omega[0] *= 0.99;
    state.omega[1] *= 0.99;
    state.omega[2] *= 0.99;

    state.q = qIntegra(state.q, state.omega, state.dt);
    state.att = eulerDesdeQ(state.q);
    state.marco = marcoLocal(state.pos);

    // 5. Throttle (input + perfil óptimo si no hay input)
    if (Math.abs(iThr) > 0.05) {
      state.throttle = clamp(state.throttle + iThr * 0.5 * state.dt, 0, 1);
    } else if (state.asistencia >= 2) {
      state.throttle = clamp(state.throttle + (optimo.throttle - state.throttle) * 0.5 * state.dt, 0, 1);
    }

    // 6. Empuje y atenuación de masa
    var empuje = empujeVector(state.throttle, deg(state.att[0]), deg(state.att[1]), veh);
    // Sin propelente no hay empuje: el motor se corta, como en la realidad.
    if (state.propEtapa <= 0) { empuje.fuerza = 0; empuje.mdot = 0; }
    var mdot = empuje.mdot * state.dt;
    if (mdot > state.propEtapa) mdot = state.propEtapa;
    if (mdot > 0) {
      state.masa = Math.max(1, state.masa - mdot);
      state.propRestante = Math.max(0, state.propRestante - mdot);
      state.propEtapa = Math.max(0, state.propEtapa - mdot);
      state.inercia = inerciaDe(veh, state.masa);
      state.metricas.propUsado += mdot;
      state.metricas.dvGastado += (empuje.fuerza / Math.max(state.masa, 1)) * state.dt;
    }

    // 7. Integración de posición y velocidad (Verlet en velocidad),
    //    con subpasos adaptativos. Un solo paso de 1/60 s no aguanta una
    //    reentrada a 11 km/s: el arrastre previsto para ese paso era mayor
    //    que la propia velocidad y la integración salía desbocada.
    var pDeg = deg(state.att[0]), yDeg = deg(state.att[1]), bank = optimo.bank || 0;
    var aProbe = V3.norm(aceleracion(state.pos, state.vel, cuerpo, veh, empuje, pDeg, yDeg, bank));
    var vAhora = V3.norm(state.vel);
    var nSub = 1;
    if (aProbe * state.dt > 0.25 * Math.max(vAhora, 1)) {
      nSub = Math.ceil((aProbe * state.dt) / (0.05 * Math.max(vAhora, 1)));
      if (nSub > 24) nSub = 24;
    }
    for (var sub = 0; sub < nSub; sub++) {
      var h = state.dt / nSub;
      var a1 = aceleracion(state.pos, state.vel, cuerpo, veh, empuje, pDeg, yDeg, bank);
      var velMedio = V3.add(state.vel, V3.mul(a1, h / 2));
      state.pos = V3.add(state.pos, V3.mul(velMedio, h));
      var a2 = aceleracion(state.pos, velMedio, cuerpo, veh, empuje, pDeg, yDeg, bank);
      state.vel = V3.add(state.vel, V3.mul(a2, h));

    // 7b. Apoyo del suelo. Una fase que arranca en la plataforma no se hunde
    //     por la gravedad: la rampa la sujeta hasta que el empuje supera al
    //     peso. Sin esto el vehículo caía "dentro" del astro, donde la
    //     atmósfera extrapolada daba densidades absurdas y el vuelo se
    //     desbordaba (q máxima de 138.000 kPa en una prueba real).
    if (state.suelo && !state.enAire) {
      var gMag = V3.norm(gravedad(state.pos, cuerpo));
      var tw = gMag > 0 ? empuje.fuerza / (state.masa * gMag) : 0;
      var altAire = V3.norm(state.pos) - cuerpo.R;
      if (tw > 1.002 && altAire > state.altInicio) {
        state.enAire = true;                       // ha despegado de verdad
      } else {
        var rSuelo = cuerpo.R + state.altInicio;   // se queda en la rampa
        state.pos = V3.mul(V3.normalize(state.pos), rSuelo);
        state.vel = [0, 0, 0];
      }
    }
    var altAhora = V3.norm(state.pos) - cuerpo.R;
    if (altAhora > state.altMax) state.altMax = altAhora;

    }

    // Guardia numérico: preferimos cortar la fase a propagar NaN.
    if (!finito(state.pos[0]) || !finito(state.vel[0])) {
      return {
        estado: 'fallo',
        fin: { tipo: 'numerico', razon: 'Estado no finito (divergencia)' },
        alt: NaN, velMag: NaN, mach: NaN, gLoad: NaN,
        masa: state.masa, throttle: state.throttle, stage: state.stage,
        metricas: state.metricas
      };
    }

    // 8. Métricas de desviación y entorno
    var alt = V3.norm(state.pos) - cuerpo.R;
    var vRel = velocidadAire(state.vel, state.pos, cuerpo);
    var vRelN = V3.norm(vRel);
    var aSon = velSonido(alt, cuerpo);
    var mach = aSon > 1e-6 ? vRelN / aSon : 0;
    var rho = densidadAtmosfera(alt, cuerpo);
    var qPres = 0.5 * rho * vRelN * vRelN;

    var desvP = Math.abs(deg(state.att[0] - rad(optimo.pitch)));
    var desvY = Math.abs(deg(state.att[1] - rad(optimo.yaw)));
    var desvR = Math.abs(deg(state.att[2] - rad(optimo.roll || 0)));
    state.metricas.desvPitch.push(desvP);
    state.metricas.desvYaw.push(desvY);
    state.metricas.desvRoll.push(desvR);
    state.metricas.maxDesv = Math.max(state.metricas.maxDesv, desvP, desvY);
    state.metricas.mach = mach;
    state.metricas.qMax = Math.max(state.metricas.qMax, qPres);
    if (desvP > 3 || desvY > 3) state.metricas.fueraZona += state.dt;
    if (Math.abs(state.omega[0]) > rad(5) || Math.abs(state.omega[1]) > rad(5)) {
      state.metricas.correcciones++;
    }

    // Carga g total (aceleración no gravitatoria, como en el strapped-in)
    var g = Math.hypot(a2[0] - gravedad(state.pos, cuerpo)[0],
                       a2[1] - gravedad(state.pos, cuerpo)[1],
                       a2[2] - gravedad(state.pos, cuerpo)[2]) / G0;
    state.metricas.gMax = Math.max(state.metricas.gMax, g);

    // 9. Staging automático / checklist
    checkStaging(optimo);

    // 10. Tiempo
    state.t += state.dt;

    // 11. Verificar fin de fase
    var fin = checkFinFase(optimo);
    if (fin) {
      /* Misma forma que el retorno normal (t, pos, vel, att...) más `fin`.
       * El bucle graba el replay antes de mirar el desenlace: si el último
       * fotograma viniera sin `pos`, reventaba justo al terminar el vuelo. */
      return {
        estado: 'complete', fin: fin, metricas: state.metricas,
        t: state.t, pos: state.pos, vel: state.vel, att: state.att, q: state.q,
        omega: state.omega, throttle: state.throttle, stage: state.stage,
        masa: state.masa, propRestante: state.propRestante,
        impulso: empuje.fuerza, optimo: optimo,
        desv: { pitch: desvP, yaw: desvY, roll: desvR },
        gLoad: g, cuerpo: cuerpo.id,
        alt: alt, velMag: V3.norm(state.vel), mach: mach, densidad: rho
      };
    }

    return {
      estado: 'flight',
      t: state.t,
      pos: state.pos,
      vel: state.vel,
      att: state.att,
      q: state.q,
      omega: state.omega,
      throttle: state.throttle,
      stage: state.stage,
      masa: state.masa,
      propRestante: state.propRestante,
      impulso: empuje.fuerza,
      optimo: optimo,
      desv: { pitch: desvP, yaw: desvY, roll: desvR },
      gLoad: g,
      cuerpo: cuerpo.id,
      alt: alt,
      velMag: V3.norm(state.vel),
      mach: mach,
      densidad: rho,
      qPres: qPres,
      asistencia: state.asistencia,
      metricas: state.metricas
    };
  }

  function separarEtapa() {
    var veh = VEHICULOS[state.vehiculo];
    var stageData = veh.etapas[state.stage];
    state.masa = Math.max(1, state.masa - stageData.masaSeca);
    state.propEtapa = (state.stage + 1 < veh.etapas.length) ?
      veh.etapas[state.stage + 1].masaProp : 0;
    state.inercia = inerciaDe(veh, state.masa);
    state.stage++;
    state.stageStartTime = state.t;
    state.metricas.staging.push({ stage: state.stage, t: state.t, limpio: true });
    if (state.onStageSeparation) state.onStageSeparation(state.stage, state.t);
    state.throttle = 0;
  }

  function checkStaging(optimo) {
    var veh = VEHICULOS[state.vehiculo];
    var stageData = veh.etapas[state.stage];
    if (!stageData || state.stage >= veh.etapas.length - 1) return;

    // El perfil manda: cuando pide la etapa siguiente, se separa.
    if (optimo.stage > state.stage) {
      /* La ultima etapa espera al apogeo: su empuje es menor que el peso
       * (la S-IVB real tiene T/W = 0,26) y encenderla subiendo no la frena.
       * En el apogeo, tangente a la velocidad, eso si eleva el perigeo. */
      var ultima = state.stage >= veh.etapas.length - 2;
      if (ultima) {
        var rSub = V3.norm(state.pos);
        var vRad = V3.dot(state.vel, V3.normalize(state.pos));
        var subiendo = vRad > 20;
        var gastada = state.propRestante < 0.05 * veh.etapas[state.stage].masaProp;
        var fuera = state.t - state.stageStartTime > 2 * veh.etapas[state.stage].burnTime;
        if (subiendo && !gastada && !fuera) return;
      }
      separarEtapa();
      return;
    }

    // Respaldo por tiempo de quemada configurado en el vehículo.
    if (stageData.burnTime > 0) {
      var tiempoEtapa = state.t - state.stageStartTime;
      if (tiempoEtapa >= stageData.burnTime * 0.98) {
        var ultimaB = state.stage >= veh.etapas.length - 2;
        var vRadB = V3.dot(state.vel, V3.normalize(state.pos));
        var gastadaB = state.propEtapa < 0.05 * stageData.masaProp;
        if ((!ultimaB || vRadB <= 20 || gastadaB || tiempoEtapa > 2 * stageData.burnTime)) {
          separarEtapa();
        }
      }
    }
  }

  function checkFinFase(optimo) {
    var cuerpo = state.cuerpo || cuerpoDe(state.vehiculo, state.fase);
    var alt = V3.norm(state.pos) - cuerpo.R;
    void optimo;

    // Inyecciones translunar / transmarte: la fase acaba al ESCAPAR del
    // cuerpo. Si se juzgase por órbita estable, una fase que arranca ya en
    // órbita baja se daría por cumplida en el segundo 1 sin quemar nada.
    if (state.fase === 'tli' || state.fase === 'tmi') {
      var rI = V3.norm(state.pos);
      var vEsc = Math.sqrt(2 * cuerpo.mu / rI);
      var vI = V3.norm(state.vel);
      if (state.t > 5 && vI >= vEsc) {
        return { tipo: 'escape', vinfinidad: vI - vEsc,
                 alt: alt, velMag: vI };
      }
      if (alt < state.altInicio - 200) {
        return { tipo: 'fallo', razon: 'Vuelta a la atmosfera antes de escapar' };
      }
    }

    // Ascenso y captura (MOI): órbita estable alrededor del cuerpo de la fase
    if (state.fase === 'ascenso' || state.fase === 'moi') {
      var el = elementos(state.pos, state.vel, cuerpo.mu);
      var minAlt = (state.fase === 'moi') ? 300e3 : 150e3;
    // Inyecciones translunar / transmarte: la fase acaba al ESCAPAR del
    // cuerpo. Si se juzgase por órbita estable, una fase que arranca ya en
    // órbita baja se daría por cumplida en el segundo 1 sin quemar nada.
    if (state.fase === 'tli' || state.fase === 'tmi') {
      var rI = V3.norm(state.pos);
      var vEsc = Math.sqrt(2 * cuerpo.mu / rI);
      var vI = V3.norm(state.vel);
      if (state.t > 5 && vI >= vEsc) {
        return { tipo: 'escape', vinfinidad: vI - vEsc,
                 alt: alt, velMag: vI };
      }
      if (alt < state.altInicio - 200) {
        return { tipo: 'fallo', razon: 'Vuelta a la atmosfera antes de escapar' };
      }
    }

    // Ascenso: la fase se completa al alcanzar el apogeo por encima de los
    // 100 km (la linea de Karman, espacio util), sobreviviendo a max-Q.
    // La insercion orbital completa no esta al alcance de este vehiculo con
    // la fisica real, y falsearla seria mentir en un simulador.
    if (state.fase === 'ascenso') {
      var vRadAsc = V3.dot(state.vel, V3.normalize(state.pos));
      if (state.altMax > 100e3 && state.t > 20 && vRadAsc < -5) {
        return { tipo: 'apogeo', altMax: state.altMax, alt: alt,
                 velMag: V3.norm(state.vel), gLoad: 0 };
      }
      if (alt < state.altInicio - 200) {
        return { tipo: 'fallo', razon: 'Impacto con la superficie' };
      }
    }

    // Captura (MOI): orbita estable alrededor del cuerpo de la fase
    if (state.fase === 'moi') {
      var elM = elementos(state.pos, state.vel, cuerpo.mu);
      var minAltM = 300e3;
      if (state.t > 1 && isFinite(elM.a) && elM.e < 1 &&
          elM.perigeo > cuerpo.R + minAltM && elM.apogeo > cuerpo.R + minAltM) {
        return { tipo: 'orbita', perigeo: elM.perigeo - cuerpo.R, apogeo: elM.apogeo - cuerpo.R,
                 e: elM.e, i: deg(elM.inclinacion) };
      }
      if (alt < state.altInicio - 200) {
        return { tipo: 'fallo', razon: 'Impacto con la superficie' };
      }
    }
      // Fallo por caída, medido contra el despegue de ESTA fase. Una fase de
      // suelo parte a altitud 0: exigirle 50 km a los 10 s la condenaba a
      // "reentrada prematura" sin haber despegado todavía. Y un descenso del 3 %
      // durante el giro de gravedad es normal, no es una caída: sólo lo es si
      // vuelve a la rampa o toca la superficie.
      if (alt < state.altInicio - 200) {
        return { tipo: 'fallo', razon: 'Impacto con la superficie' };
      }
      if (state.altMax > state.altInicio + 10000 && alt < state.altInicio + 2000) {
        return { tipo: 'fallo', razon: 'Caida: regreso a la altura de partida' };
      }
      // Las que arrancan ya en órbita sí decaen a la atmósfera: eso es fallo.
      if (state.altInicio > 80e3 && alt < cuerpo.R + 50e3 && state.t > 60) {
        return { tipo: 'fallo', razon: 'Reentrada prematura' };
      }
    }

    // Descenso lunar / EDL Marte: contacto con la superficie
    if (state.fase === 'descenso' || state.fase === 'edl') {
      if (alt <= 10 && state.t > 1) {
        // Velocidad vertical = componente radial, no el eje Y del marco.
        var vRad = V3.dot(state.vel, V3.normalize(state.pos));
        return { tipo: 'aterrizaje', velVertical: Math.abs(vRad), exito: Math.abs(vRad) < 3 };
      }
      if (alt < 0) return { tipo: 'fallo', razon: 'Impacto' };
    }

    // Entrada atmosférica (Tierra / Marte)
    if (state.fase === 'entrada' || state.fase === 'amarizaje') {
      if (alt <= 0) return { tipo: 'aterrizaje', exito: true };
    }

    // Fases de duración fija
    if (state.fase === 'maniobra' && state.t > 300) return { tipo: 'tiempo', exito: true };
    if ((state.fase === 'acople' || state.fase === 'transposicion') && state.t > 300) {
      return { tipo: 'tiempo', exito: true };
    }
    if (state.fase === 'hover' && state.t > 60) return { tipo: 'tiempo', exito: true };
    return null;
  }

  // Reset actitud a óptima
  function resetAttitude() {
    var optimo = (function () {
      var c2 = claveEfectiva(state.fase, state.perfil);
      return interpolarPerfil(state.perfil, c2, valorDePerfil(c2, state.pos));
    })();
    state.q = qDesdeEuler(rad(optimo.pitch), rad(optimo.yaw), rad(optimo.roll || 0));
    state.att = eulerDesdeQ(state.q);
    state.omega = [0, 0, 0];
  }

  // Obtener perfil completo para UI
  function getPerfil() { return state.perfil; }
  function getState() { return Object.assign({}, state); }
  function setAsistencia(n) { state.asistencia = clamp(n, 0, 3); }
  function getAsistencia() { return state.asistencia; }

  // Simulación de referencia: vuelo perfecto siguiendo el perfil.
  function simulatePerfect(fase, vehiculo, duracion) {
    init(fase, vehiculo, { asistencia: 3 });
    var results = [];
    while (state.t < duracion) {
      var optimo = (function () {
      var c2 = claveEfectiva(state.fase, state.perfil);
      return interpolarPerfil(state.perfil, c2, valorDePerfil(c2, state.pos));
    })();
      var r = step({
        pitch: rad(optimo.pitch) - state.att[0],
        yaw: rad(optimo.yaw) - state.att[1],
        roll: rad(optimo.roll || 0) - state.att[2],
        throttle: optimo.throttle - state.throttle
      });
      results.push(r);
      if (r.estado !== 'flight') break;
    }
    return results;
  }

  return {
    init: init,
    step: step,
    resetAttitude: resetAttitude,
    getPerfil: getPerfil,
    getState: getState,
    setAsistencia: setAsistencia,
    getAsistencia: getAsistencia,
    interpolarPerfil: interpolarPerfil,
    simulatePerfect: simulatePerfect,
    PERFILES: PERFILES,
    VEHICULOS: VEHICULOS,
    CUERPOS: CUERPOS,
    INICIO: INICIO,
    ASISTENCIA: ASISTENCIA,
    // Física expuesta para las suites de prueba
    cuerpoDe: cuerpoDe,
    claveDePerfil: claveDePerfil,
    densidad: function (alt, cuerpoId) {
      return densidadAtmosfera(alt, CUERPOS[cuerpoId] || CUERPOS.tierra);
    },
    cdMaq: cdMaq,
    velSonido: function (alt, cuerpoId) {
      return velSonido(alt, CUERPOS[cuerpoId] || CUERPOS.tierra);
    },
    elementos: function (pos, vel, cuerpoId) {
      return elementos(pos, vel, (CUERPOS[cuerpoId] || CUERPOS.tierra).mu);
    },
    gravedad: function (pos, cuerpoId) {
      return gravedad(pos, CUERPOS[cuerpoId] || CUERPOS.tierra);
    },
    inerciaDe: inerciaDe,
    qDesdeEuler: qDesdeEuler,
    eulerDesdeQ: eulerDesdeQ,
    dirEmpuje: dirEmpuje,
    marcoLocal: marcoLocal,
    V3: V3,
    rad: rad,
    deg: deg,
    G0: G0,
    R_MOON: R_MOON,
    R_EARTH: R_EARTH,
    R_MARS: R_MARS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CJ.FLT;
