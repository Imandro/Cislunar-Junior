/* ===========================================================================
 * CISLUNAR JUNIOR - Creditos y licencias de imagenes
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Las imagenes de assets/ son material de dominio publico de la NASA.
 * No se ha copiado, rastreado ni modificado trabajo de terceros: se
 * descargaron directamente de images.nasa.gov, que publica imagenes en
 * dominio publico segun su politica de uso de medios.
 *
 *   NASA Media Usage Guidelines:
 *   https://www.nasa.gov/nasa-brand-center/images-and-media/
 *   "El contenido de la NASA no tiene derechos de autor en los Estados
 *    Unidos ... El uso comercial de imagenes NASA es permitido."
 * =========================================================================== */
(function (root) {
  'use strict';

  var CREDITOS = {
    apolo11: {
      archivo: 'assets/apolo11.jpg',
      nasa_id: 'as11-40-5927',
      titulo: 'Módulo lunar Apolo 11 en reposo sobre la superficie lunar',
      fuente: 'NASA / Apollo 11',
      fecha: '1969',
      licencia: 'Dominio público (NASA)'
    },
    apolo13: {
      archivo: 'assets/apolo13.jpg',
      nasa_id: 'S70-34902',
      titulo: 'Centro de control durante el incidente de oxígeno del Apolo 13',
      fuente: 'NASA',
      fecha: '1970',
      licencia: 'Dominio público (NASA)'
    },
    artemis2: {
      archivo: 'assets/artemis2.jpg',
      nasa_id: 'KSC-20230602-PH-GEB01-0010',
      titulo: 'Módulo de tripulación Orion para Artemis II',
      fuente: 'NASA Kennedy Space Center',
      fecha: '2023',
      licencia: 'Dominio público (NASA)'
    },
    marte: {
      archivo: 'assets/marte.jpg',
      nasa_id: 'PIA14838',
      titulo: 'Curiosity y etapa de descenso, concepto artístico',
      fuente: 'NASA / JPL-Caltech',
      fecha: '2012',
      licencia: 'Dominio público (NASA)'
    }
  };

  /** Texto de atribucion corto para pie de imagen. */
  function atribuir(clave) {
    const c = CREDITOS[clave];
    if (!c) return '';
    return c.fuente + ' · ' + c.licencia + ' · NASA ID ' + c.nasa_id;
  }

  var CJ = root.CJ || (root.CJ = {});
  CJ.CREDITOS = { mapa: CREDITOS, atribuir: atribuir };

  if (typeof module !== 'undefined' && module.exports) module.exports = CJ.CREDITOS;

})(typeof window !== 'undefined' ? window : this);