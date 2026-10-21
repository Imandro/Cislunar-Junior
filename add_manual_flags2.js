const fs = require('fs');
const path = 'Cislunar Junior - Cañon Labs.html';
let content = fs.readFileSync(path, 'utf8');

// Buscar cada misión por su nombre
const missionMarkers = [
  { idx: 0, marker: "n: 'Apolo 11'" },
  { idx: 1, marker: "n: 'Apolo 13'" },
  { idx: 2, marker: "n: 'Artemis II'" },
  { idx: 3, marker: "n: 'Marte'" }
];

const manualEvents = {
  0: { // Apolo 11
    2: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },
    5: { faseVuelo: 'tli', vehiculo: 'saturnV' },
    6: { faseVuelo: 'acople', vehiculo: 'csm_lm' },
    8: { faseVuelo: 'descenso', vehiculo: 'lm_eagle' },
    10: { faseVuelo: 'ascenso', vehiculo: 'lm_ascent' },
    11: { faseVuelo: 'entrada', vehiculo: 'cm_columbia' }
  },
  1: { // Apolo 13
    1: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },
    7: { faseVuelo: 'maniobra', vehiculo: 'lm_aquarius' },
    9: { faseVuelo: 'entrada', vehiculo: 'cm_odyssey' }
  },
  2: { // Artemis II
    2: { faseVuelo: 'ascenso', vehiculo: 'sls' },
    4: { faseVuelo: 'tli', vehiculo: 'icps' },
    8: { faseVuelo: 'entrada', vehiculo: 'orion' },
    9: { faseVuelo: 'amarizaje', vehiculo: 'orion' }
  },
  3: { // Marte
    2: { faseVuelo: 'tmi', vehiculo: 'deep_transport' },
    9: { faseVuelo: 'moi', vehiculo: 'deep_transport' },
    11: { faseVuelo: 'edl', vehiculo: 'mars_descent' },
    13: { faseVuelo: 'ascenso', vehiculo: 'mars_ascent' }
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
  let modified = false;
  
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
            console.log(`Misión ${missionIdx}, Evento ${eventCount}: ya tiene manual`);
          } else {
            const props = events[eventCount];
            const newEventStr = eventStr.replace('{ p:', `{ manual: true, faseVuelo: '${props.faseVuelo}', vehiculo: '${props.vehiculo}', p:`);
            content = content.substring(0, eventStart) + newEventStr + content.substring(eventEnd);
            console.log(`Misión ${missionIdx}, Evento ${eventCount}: añadido ${props.faseVuelo} (${props.vehiculo})`);
            modified = true;
            // Ajustar índice por el cambio de longitud
            const diff = newEventStr.length - eventStr.length;
            i += diff;
          }
        }
      }
    }
    // Parar si llegamos al final de la misión (siguiente { n: )
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
console.log('¡Flags manuales añadidos a todas las misiones!');