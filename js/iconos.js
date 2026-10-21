/* ===========================================================================
 * CISLUNAR JUNIOR - Iconografia vectorial propia
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Todos los iconos son drawings vectoriales originales de Canon Labs:
 * construidos con trazados geometricos propios, no convertidos ni trazados
 * sobre imagenes de terceros.
 *
 * Estetica: linea cian sobre fondo profundo, siluetas tecnicas con
 *de de paneles y toberas. Inspirada en planos de ingenieria, no en
 * renderizado fotorrealista.
 * =========================================================================== */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var C = {
    linea: '#5cb8ff',
    tenue: '#2a4a73',
    claro: '#e8f2ff',
    medio: '#8fc9ff',
    calido: '#ffb547'
  };

  /* =======================================================================
   * Icono: cohete de tres etapas (estilo Apolo)
   * ==================================================================== */
  function icVehiculoLunar() {
    return '<svg viewBox="0 0 120 300" fill="none" stroke="' + C.linea + '" ' +
      'stroke-width="1.4" stroke-linejoin="round">' +
      // punta y escape
      '<path d="M60 6c6 14 9 26 9 38H51c0-12 3-24 9-38z" fill="' + C.tenue + '"/>' +
      '<rect x="51" y="44" width="18" height="12" fill="' + C.medio + '"/>' +
      // etapa superior
      '<rect x="49" y="56" width="22" height="54"/>' +
      '<path d="M49 70h22M49 84h22M49 98h22" stroke="' + C.tenue + '" stroke-width="1"/>' +
      '<rect x="52" y="60" width="4" height="46" fill="' + C.tenue + '"/>' +
      // escalon
      '<path d="M47 110h26v8H47z" fill="' + C.medio + '"/>' +
      // etapa intermedia
      '<rect x="45" y="118" width="30" height="62"/>' +
      '<path d="M45 136h30M45 152h30" stroke="' + C.tenue + '" stroke-width="1"/>' +
      // modulo lunar lateral
      '<rect x="16" y="126" width="22" height="26" stroke="' + C.calido + '"/>' +
      '<path d="M16 134h22M16 142h22" stroke="' + C.calido + '" stroke-width="0.8" opacity="0.7"/>' +
      '<path d="M38 133l7 6-7 6" stroke="' + C.calido + '"/>' +
      // etapa inferior
      '<rect x="43" y="180" width="34" height="78"/>' +
      '<path d="M43 202h34M43 224h34" stroke="' + C.tenue + '" stroke-width="1"/>' +
      // aletas
      '<path d="M43 236l-11 22h11z" fill="' + C.tenue + '"/>' +
      '<path d="M77 236l11 22H77z" fill="' + C.tenue + '"/>' +
      // toberas
      '<path d="M48 258h9l-2 20h-5z" fill="' + C.medio + '"/>' +
      '<path d="M63 258h9l-2 20h-5z" fill="' + C.medio + '"/>' +
      '<path d="M50 278l2 16M70 278l-2 16" stroke="' + C.calido + '" stroke-width="2"/>' +
      '</svg>';
  }

  /* =======================================================================
   * Icono: lanzador pesado de dos etapas (estilo Artemis)
   * ==================================================================== */
  function icVehiculoPesado() {
    return '<svg viewBox="0 0 120 300" fill="none" stroke="' + C.linea + '" ' +
      'stroke-width="1.4" stroke-linejoin="round">' +
      // punta
      '<path d="M60 4c7 16 10 28 10 40H50c0-12 3-24 10-40z" fill="' + C.tenue + '"/>' +
      // cabina
      '<rect x="50" y="44" width="20" height="16" fill="' + C.medio + '"/>' +
      '<path d="M54 52h3M63 52h3" stroke="' + C.claro + '" stroke-width="1.4"/>' +
      // etapa superior
      '<rect x="48" y="60" width="24" height="40"/>' +
      '<path d="M48 74h24" stroke="' + C.tenue + '"/>' +
      // tanks laterales de propulsor
      '<rect x="26" y="112" width="14" height="126" fill="' + C.tenue + '"/>' +
      '<rect x="80" y="112" width="14" height="126" fill="' + C.tenue + '"/>' +
      '<path d="M33 104c0-8 14-8 14 0" stroke="' + C.linea + '"/>' +
      '<path d="M87 104c0-8 14-8 14 0" stroke="' + C.linea + '"/>' +
      // etapa central naranja
      '<rect x="44" y="100" width="32" height="140" fill="' + C.calido + '" fill-opacity="0.14"/>' +
      '<path d="M44 126h32M44 152h32M44 178h32M44 204h32" stroke="' + C.calido + '" stroke-width="0.9" opacity="0.6"/>' +
      // aletas
      '<path d="M44 220l-12 22h12z" fill="' + C.tenue + '"/>' +
      '<path d="M76 220l12 22H76z" fill="' + C.tenue + '"/>' +
      // toberas
      '<path d="M47 240h9l-2 22h-5z" fill="' + C.medio + '"/>' +
      '<path d="M64 240h9l-2 22h-5z" fill="' + C.medio + '"/>' +
      '<path d="M49 262l1 18M69 262l-1 18" stroke="' + C.calido + '" stroke-width="2.2"/>' +
      '<path d="M29 238h8l-2 14h-4zM83 238h8l-2 14h-4z" fill="' + C.medio + '"/>' +
      '<path d="M31 252l1 12M89 252l-1 12" stroke="' + C.calido + '" stroke-width="1.6"/>' +
      '</svg>';
  }

  /* =======================================================================
   * Icono: transporte interplanetario
   * ==================================================================== */
  function icTransporte() {
    return '<svg viewBox="0 0 120 300" fill="none" stroke="' + C.linea + '" ' +
      'stroke-width="1.4" stroke-linejoin="round">' +
      //anea solar superior
      '<rect x="34" y="26" width="52" height="18" fill="' + C.tenue + '"/>' +
      '<path d="M41 26v18M48 26v18M55 26v18M62 26v18M69 26v18M76 26v18" stroke="' + C.claro + '" stroke-width="0.6" opacity="0.6"/>' +
      // antena
      '<path d="M60 14v12M56 14h8" stroke="' + C.medio + '"/>' +
      // modulo de tripulacion (cono)
      '<path d="M52 44h16l6 22H46z" fill="' + C.medio + '"/>' +
      '<path d="M52 52h16" stroke="' + C.claro + '" stroke-width="1"/>' +
      // nodo
      '<rect x="49" y="66" width="22" height="12"/>' +
      // habitaculo (cilindro grande con ventanas)
      '<rect x="40" y="78" width="40" height="96" fill="' + C.tenue + '" fill-opacity="0.5"/>' +
      '<path d="M46 92h4M56 92h4M66 92h4M46 112h4M56 112h4M66 112h4M46 132h4M56 132h4M66 132h4M46 152h4M56 152h4M66 152h4" ' +
      'stroke="' + C.claro + '" stroke-width="1.2"/>' +
      // paneles solares laterales
      '<rect x="6" y="98" width="34" height="20" fill="' + C.tenue + '"/>' +
      '<rect x="80" y="98" width="34" height="20" fill="' + C.tenue + '"/>' +
      '<path d="M13 98v20M20 98v20M27 98v20M87 98v20M94 98v20M101 98v20" stroke="' + C.claro + '" stroke-width="0.6" opacity="0.5"/>' +
      '<path d="M40 106h6M74 106h6" stroke="' + C.linea + '"/>' +
      // radiadores
      '<rect x="42" y="180" width="36" height="16" fill="' + C.tenue + '" fill-opacity="0.4"/>' +
      '<path d="M42 184h36M42 190h36" stroke="' + C.claro + '" stroke-width="0.5" opacity="0.5"/>' +
      // motor
      '<rect x="50" y="196" width="20" height="26" fill="' + C.medio + '"/>' +
      '<path d="M54 222l2 16h8l2-16" fill="' + C.medio + '"/>' +
      '<path d="M57 238l2 26h2l2-26" stroke="' + C.calido + '" stroke-width="2.4"/>' +
      '</svg>';
  }

  /* =======================================================================
   * Icono: planeta rojo
   * ==================================================================== */
  function icPlaneta() {
    return '<svg viewBox="0 0 160 160" fill="none" stroke="' + C.linea + '" stroke-width="1.3">' +
      '<circle cx="80" cy="80" r="54" fill="#8b3a2a" fill-opacity="0.35"/>' +
      '<circle cx="80" cy="80" r="54"/>' +
      // cráteres
      '<circle cx="62" cy="62" r="9" fill="#a0442e" fill-opacity="0.5" stroke="none"/>' +
      '<circle cx="96" cy="70" r="6" fill="#7a2d1f" fill-opacity="0.5" stroke="none"/>' +
      '<circle cx="70" cy="98" r="11" fill="#933c28" fill-opacity="0.4" stroke="none"/>' +
      '<circle cx="104" cy="104" r="7" fill="#6e2718" fill-opacity="0.5" stroke="none"/>' +
      // casquete polar
      '<path d="M42 52a54 54 0 0 1 26-22" stroke="' + C.claro + '" stroke-width="2.4" stroke-linecap="round"/>' +
      // terminador
      '<path d="M80 26a54 54 0 0 1 0 108" stroke="#0a0f16" stroke-width="3" opacity="0.35"/>' +
      '</svg>';
  }

  /* =======================================================================
   * Icono: cohete generico (para el laboratorio)
   * ==================================================================== */
  function icCoheteLab() {
    return '<svg viewBox="0 0 120 200" fill="none" stroke="' + C.linea + '" stroke-width="1.4" stroke-linejoin="round">' +
      '<path d="M60 8c7 14 10 28 10 42H50c0-14 3-28 10-42z" fill="' + C.tenue + '"/>' +
      '<rect x="49" y="50" width="22" height="72"/>' +
      '<path d="M49 70h22M49 90h22" stroke="' + C.tenue + '"/>' +
      '<path d="M49 100l-10 20h10zM71 100l10 20H71z" fill="' + C.tenue + '"/>' +
      '<path d="M53 122l-3 18M67 122l3 18" stroke="' + C.linea + '"/>' +
      '<path d="M50 140l-8 16M70 140l8 16" stroke="' + C.calido + '" stroke-width="2"/>' +
      // vectores de empuje
      '<path d="M60 166v14M54 172l-5 10M66 172l5 10" stroke="' + C.calido + '" stroke-width="1.6" opacity="0.7"/>' +
      '</svg>';
  }

  /* =======================================================================
   * Icono: emblem / insignia del proyecto
   * ==================================================================== */
  function icEmblema() {
    return '<svg viewBox="0 0 120 120" fill="none" stroke="' + C.linea + '" stroke-width="1.3">' +
      '<circle cx="60" cy="60" r="52" opacity="0.55"/>' +
      '<circle cx="60" cy="60" r="43" stroke="' + C.tenue + '"/>' +
      '<circle cx="60" cy="60" r="17" fill="#12325c"/>' +
      '<path d="M52 54a12 12 0 0 1 8-4" stroke="' + C.claro + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g class="orb-giro">' +
      '<ellipse cx="60" cy="60" rx="38" ry="13" transform="rotate(-28 60 60)" stroke="' + C.medio + '"/>' +
      '<circle cx="92" cy="44" r="4.5" fill="' + C.claro + '" stroke="none"/>' +
      '</g>' +
      // estrella
      '<path d="M60 10l1.7 3.8 4.1 1.4-3.4 2.4 1.2 4.1L60 19.8l-3.6 1.9 1.2-4.1-3.4-2.4 4.1-1.4z" fill="' + C.claro + '" stroke="none"/>' +
      '</svg>';
  }

  /* =======================================================================
   * API
   * ==================================================================== */
  var ICO = {
    vehiculoLunar: icVehiculoLunar,
    vehiculoPesado: icVehiculoPesado,
    transporte: icTransporte,
    planeta: icPlaneta,
    coheteLab: icCoheteLab,
    emblema: icEmblema
  };

  var CJ = root.CJ || (root.CJ = {});
  CJ.ICO = ICO;

})(typeof window !== 'undefined' ? window : this);