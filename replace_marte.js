const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find Marte mission
const startMarker = '/* ---------------------------------------------------------------- Marte */';
const startIdx = html.indexOf(startMarker);

let braceCount = 0;
let inMission = false;
let endIdx = -1;
for (let i = startIdx; i < html.length; i++) {
  if (html[i] === '{') { braceCount++; inMission = true; }
  else if (html[i] === '}') { 
    braceCount--; 
    if (inMission && braceCount === 0) { 
      if (html[i+1] === ',') {
        endIdx = i + 2; 
        break;
      }
    } 
  }
}

const newMarte = `/* ---------------------------------------------------------------- Marte */
{
  n: 'Marte', k: 3, f: 'Ventana de conjunción', d: '≈259 d',
  v: 'Transporte profundo · hábitat ECLSS',
  x: 'Transferencia de Hohmann hasta el planeta rojo: 259 días de tránsito, 26 meses hasta la siguiente ventana.',
  img: 'assets/marte.jpg', ck: 'marte', ico: 'ds',
  r: [['Comandante', 'Mando y navegación'], ['Piloto', 'Transferencia y descenso'],
      ['Científico', 'Sistemas ECLSS y geología'], ['Tierra', 'Control de misión']],
  e: [
    { p:0, r:0, t:'T−04:00', h:'Verificación del ECLSS',
      c:['MX','Verificación del circuito de soporte vital y de la tripulación antes de la ventana.'],
      o:[['Barrido completo del sistema de soporte vital',[6,3,2,5,0],6,
          'El ECLSS recicla el aire y la mayor parte del agua del hábitat. Verificarlo ahora evita una fuga a millones de kilómetros de casa.'],
         ['Aprovisionar rápido y ganar tiempo de ventana',[-2,-1,0,4,5],9,
          'Ganar horas deja más margen de lanzamiento, pero reduce el tiempo para detectar fugas en los circuitos cerrados.']] },
    { p:0, r:1, t:'T−00:45', h:'Verificación final de sistemas',
      c:['MX','Todas las estaciones, GO/NO-GO para la inyección trans-Marte.'],
      o:[['Ronda completa de verificación con margen',[4,3,2,3,0],4,
          'Cada sistema crítico reporta GO: propulsión, navegación, ECLSS, comunicaciones, blindaje.'],
         ['Verificación abreviada para ganar la ventana',[-2,-2,0,0,5],8,
          'Ahorra minutos en la plataforma, pero deja sin validar redundancias para 9 meses de vuelo.']] },
    { p:1, r:4, t:'Día 1', h:'Inyección Trans-Marte (TMI)',
      c:['MX','Inyección Trans-Marte: 2,9 km/s sobre la órbita terrestre.'],
      o:[['Quemada TMI nominal con el motor principal',[0,-5,0,0,-15],10,
          'La quemada más grande de la misión coloca el transporte en transferencia de Hohmann hacia Marte.'],
         ['Dividir la quema en dos pulsos para control térmico',[-2,-3,0,0,-9],7,
          'Dos pulsos reparten el calor del motor, pero alargan la ventana y dejan la trayectoria menos limpia.']] },
    { p:2, r:1, t:'Día 7', h:'Separación de la etapa de inyección',
      c:['GNC','Separación de la etapa de inyección confirmada. Vuelo libre iniciado.'],
      o:[['Separación limpia y verificación de puertos',[0,1,1,0,-2],3,
          'La etapa se aleja sin incidentes; los sensores confirman que no hay residuos en la trayectoria.'],
         ['Separación rápida sin verificación completa',[-1,0,0,0,-4],12,
          'Gana tiempo, pero un fragmento suelto podría dañar el blindaje térmico meses después.']] },
    { p:2, r:2, t:'Día 60', h:'Tormenta solar',
      c:['MED','Tormenta solar detectada: eyección de masa coronal en camino.'],
      w:['ALERTA','La radiación puede superar el límite seguro del hábitat durante varias horas.'],
      o:[['Refugio en la zona blindada rodeada de tanques',[5,0,10,-7,0],12,
          'Agua y alimento alrededor de la tripulación son el mejor blindaje improvisado contra partículas energéticas.'],
         ['Seguir con el trabajo programado y confiar en el blindaje',[-8,-2,-4,2,0],20,
          'Ignorar la tormenta mantiene el calendario, pero la dosis acumulada puede superar el límite de la misión.']] },
    { p:2, r:4, t:'Día 120', h:'Corrección heliocéntrica (TCM-1)',
      c:['GNC','Corrección heliocéntrica pendiente: Δv de 12 m/s.'],
      o:[['Corrección con el motor principal de crucero',[-1,-3,0,0,-8],6,
          'El motor de crucero corrige la trayectoria con la máxima precisión disponible y los menores riesgos de alineación.'],
         ['Corrección con los propulsores de control de reacción',[-2,-1,0,0,-3],11,
          'Los RCS son más finos pero más lentos: una dosis mal calculada obliga a repetir la quemada y gastar más.']] },
    { p:2, r:4, t:'Día 180', h:'Corrección heliocéntrica (TCM-2)',
      c:['GNC','Segunda corrección de trayectoria: Δv de 8 m/s.'],
      o:[['TCM-2 con motor principal, perfil nominal',[0,-2,0,0,-6],5,
          'Ajuste fino que coloca el periapsis marciano en la ventana de captura óptima.'],
         ['Omitir TCM-2 y corregir en MOI',[-1,-1,0,0,-2],10,
          'Ahorra propelente ahora, pero exige una quemada de captura mayor y más arriesgada.']] },
    { p:2, r:4, t:'Día 200', h:'Preparación de MOI',
      c:['MX','Preparación de la inserción orbital marciana: escudo y módulo, listos.'],
      o:[['Orientar el escudo térmico y sellar la burbuja',[0,0,4,0,-6],7,
          'La entrada a la atmósfera marciana a unos 6,5 km/s se frena primero con el aeroshell, antes de encender los retrocohetes.'],
         ['Aprovisionar y revisar el módulo de descenso',[1,0,2,3,-4],5,
          'Revisar el módulo ahora evita sorpresas al separarlo en órbita, cuando ya no habrá vuelta atrás.']] },
    { p:2, r:4, t:'Día 259', h:'Quemado de captura (MOI)',
      c:['MED','Quemado de captura a 100 segundos del periapsis.'],
      w:['CRÍTICO','Si la quemada falla, la nave pasa de largo y no habrá otra ventana en 26 meses.'],
      o:[['Quemado de captura nominal con el motor principal',[-2,-5,0,0,-17],14,
          'La órbita de captura es la única puerta de entrada: casi media hora de empuje continuo con la nave orientada a ciegas.'],
         ['Entrada atmosférica aerofrenada para capturar',[0,-2,5,0,-6],20,
          'Aprovechar la atmósfera marciana ahorra combustible, pero somete al vehículo a calor y cargas extremas.']] },
    { p:3, r:4, t:'Día 265', h:'Desacoplo del módulo de descenso',
      c:['DESC','Desacoplo del módulo de descenso confirmado. Órbita de espera estable.'],
      o:[['Desacoplo verificado y chequeo de sistemas completo',[0,0,3,0,-3],4,
          'El módulo de descenso se separa limpiamente; todos los sistemas reportan GO para la entrada.'],
         ['Desacoplo rápido para ahorrar órbita',[-2,-1,0,0,-5],11,
          'Menos tiempo en órbita baja, pero sin verificación completa el descenso es una incógnita.']] },
    { p:4, r:4, t:'Día 274', h:'Descenso final (EDL)',
      c:['DESC','Descenso: paracaídas desplegados, retrocohetes en T−20 s.'],
      o:[['Descenso guiado con radar y retrocohetes',[1,0,3,0,-11],11,
          'Los retrocohetes frenan desde cientos de metros a casi cero en los últimos segundos; el aterrizaje suave protege el hábitat.'],
         ['Aterrizaje con margen de caída más holgado',[-3,-1,0,0,-4],16,
          'Confiar en el colchizado ahorra combustible, pero un contacto con demasiada velocidad daña el tren de aterrizaje.']] },
    { p:5, r:2, t:'Día 275', h:'Primer contacto / Superficie',
      c:['SURF','Hábitat en superficie. Presurización nominal. Primera EVA en 2 horas.'],
      o:[['EVA inmediata: izar bandera y desplegar antena',[2,0,4,1,-5],6,
          'La primera actividad extravehicular valida los trajes y deja la comunicación de superficie operativa.'],
         ['Esperar verificación completa antes de salir',[-1,0,1,0,-1],3,
          'Más seguro, pero pierde la ventana de luz óptima y retrasa el inicio de operaciones científicas.']] },
    { p:6, r:4, t:'Día 280', h:'Operaciones de superficie / Regreso',
      c:['MX','Misión de superficie completada. Preparación para ascenso y retorno.'],
      o:[['Ascenso directo a órbita de encuentro',[0,-4,0,0,-12],8,
          'El vehículo de ascenso alcanza la órbita de encuentro con el transporte en una sola quemada.'],
         ['Ascenso en dos fases con órbita de espera',[-2,-2,0,0,-7],12,
          'Más flexible si el transporte está descentrado, pero consume más propelente total.']] }
  ]
},`;

html = html.slice(0, startIdx) + newMarte + html.slice(endIdx);
fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Replaced Marte mission');