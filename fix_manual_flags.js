const fs = require('fs');
const path = 'Cislunar Junior - Cañon Labs.html';
let content = fs.readFileSync(path, 'utf8');

// Primero, quitar todos los flags manual: true existentes
content = content.replace(/\{ manual: true, faseVuelo: '[^']*', vehiculo: '[^']*', /g, '{ ');

// Ahora añadir los correctos
const missionMarkers = [
  { idx: 0, marker: "n: 'Apolo 11'" },
  { idx: 1, marker: "n: 'Apolo 13'" },
  { idx: 2, marker: "n: 'Artemis II'" },
  { idx: 3, marker: "n: 'Marte'" }
];

// Índices CORRECTOS basados en la estructura 7-fases actual
const manualEvents = {
  0: { // Apolo 11 - 12 eventos
    2: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },      // T-00:00 Despegue
    4: { faseVuelo: 'tli', vehiculo: 'saturnV' },          // T+02:44 TLI
    5: { faseVuelo: 'acople', vehiculo: 'csm_lm' },        // T+03:20 Separación y giro
    7: { faseVuelo: 'descenso', vehiculo: 'lm_eagle' },    // Día 4 Alunizaje
    9: { faseVuelo: 'ascenso', vehiculo: 'lm_ascent' },    // Día 5 Despegue LM
    11: { faseVuelo: 'entrada', vehiculo: 'cm_columbia' }  // Día 8 Reentrada
  },
  1: { // Apolo 13 - 10 eventos
    1: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },      // T-00:00 Despegue
    6: { faseVuelo: 'maniobra', vehiculo: 'lm_aquarius' }, // Día 4 PC+2
    9: { faseVuelo: 'entrada', vehiculo: 'cm_odyssey' }    // Día 6 Reentrada
  },
  2: { // Artemis II - 10 eventos
    2: { faseVuelo: 'ascenso', vehiculo: 'sls' },          // T-00:00 Despegue SLS
    3: { faseVuelo: 'tli', vehiculo: 'icps' },             // Día 1 TLI
    8: { faseVuelo: 'entrada', vehiculo: 'orion' },        // Día 8 Ventana reentrada
    9: { faseVuelo: 'amarizaje', vehiculo: 'orion' }       // Día 10 Amarizaje
  },
  3: { // Marte - 14 eventos (ya correctos)
    2: { faseVuelo: 'tmi', vehiculo: 'deep_transport' },   // Día 1 TMI
    9: { faseVuelo: 'moi', vehiculo: 'deep_transport' },   // Día 259 MOI
    11: { faseVuelo: 'edl', vehiculo: 'mars_descent' },    // Día 270 EDL
    13: { faseVuelo: 'ascenso', vehiculo: 'mars_ascent' }  // Día 280 Ascenso
  }
};

function addManualToMission(content, missionIdx, events) {
  const marker = missionMarkers[missionIdx].marker;
  const missionStart = content.indexOf(marker);
  if (missionStart === -1) {
    console.error(`No se encontró misión ${missionIdx} (${marker})`);
    return content;
  }
  
  const eStart = content.indexOf('e: [', missionStart);
  if (eStart === -1) {
    console.error(`No se encontró e: [ para misión ${missionIdx}`);
    return content;
  }
  
  // Parsear eventos uno por uno
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let eventCount = -1;
  let eventStart = -1;
  
  for (let i = eStart + 3; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i-1];
    
    if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar && prev !== '\\') {
      inString = false;
    } else if (!inString) {
      if (ch === '{' && braceCount === 0) {
        eventCount++;
        eventStart = i;
        braceCount = 1;
      } else if (ch === '{') {
        braceCount++;
      } else if (ch === '}') {
        braceCount--;
        if (braceCount === 0 && events[eventCount]) {
          const eventEnd = i + 1;
          const eventStr = content.substring(eventStart, eventEnd);
          
          if (eventStr.includes('manual:')) {
            // Ya tiene manual, saltar
          } else {
            const props = events[eventCount];
            const newEventStr = eventStr.replace('{ p:', `{ manual: true, faseVuelo: '${props.faseVuelo}', vehiculo: '${props.vehiculo}', p:`);
            content = content.substring(0, eventStart) + newEventStr + content.substring(eventEnd);
            console.log(`Misión ${missionIdx}, Evento ${eventCount}: añadido ${props.faseVuelo} (${props.vehiculo})`);
            const diff = newEventStr.length - eventStr.length;
            i += diff;
          }
        }
      }
    }
    // Parar al final de la misión
    if (!inString && ch === '{' && braceCount === 0 && i > eStart + 100) {
      const next = content.substring(i, i + 10);
      if (next.startsWith('{ n:')) break;
    }
  }
  
  return content;
}

for (const [missionIdx, events] of Object.entries(manualEvents)) {
  content = addManualToMission(content, parseInt(missionIdx), events);
}

fs.writeFileSync(path, content, 'utf8');
console.log('¡Flags manuales corregidos!');