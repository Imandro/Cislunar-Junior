const fs = require('fs');
const path = 'Cislunar Junior - Cañon Labs.html';
let content = fs.readFileSync(path, 'utf8');

// Encontrar el array M
const startM = content.indexOf('var M = [');
if (startM === -1) {
  console.error('No se encontró var M = [');
  process.exit(1);
}

// Encontrar el final del array M (buscar '];;;' o '];')
let endM = content.indexOf('];;;', startM);
if (endM === -1) endM = content.indexOf('];', startM);
if (endM === -1) {
  console.error('No se encontró el final de M');
  process.exit(1);
}
endM += 3; // incluir '];;'

const mArrayStr = content.substring(startM, endM);
console.log('M array length:', mArrayStr.length);

// Ahora parsear y modificar - usamos una aproximación más simple: buscar eventos específicos
// y reemplazar sus definiciones

// Definir qué eventos son de vuelo manual por misión
const manualEvents = {
  // Apolo 11 (m=0): 12 eventos
  0: {
    2: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },      // T-00:00 Despegue
    5: { faseVuelo: 'tli', vehiculo: 'saturnV' },          // T+02:44 TLI
    6: { faseVuelo: 'acople', vehiculo: 'csm_lm' },        // T+03:20 Separación y giro
    8: { faseVuelo: 'descenso', vehiculo: 'lm_eagle' },    // Día 4 Alunizaje
    10: { faseVuelo: 'ascenso', vehiculo: 'lm_ascent' },   // Día 5 Despegue LM
    11: { faseVuelo: 'entrada', vehiculo: 'cm_columbia' }  // Día 8 Reentrada
  },
  // Apolo 13 (m=1): 10 eventos
  1: {
    1: { faseVuelo: 'ascenso', vehiculo: 'saturnV' },      // T-00:00 Despegue
    7: { faseVuelo: 'maniobra', vehiculo: 'lm_aquarius' }, // Día 4 PC+2
    9: { faseVuelo: 'entrada', vehiculo: 'cm_odyssey' }    // Día 6 Reentrada
  },
  // Artemis II (m=2): 10 eventos
  2: {
    2: { faseVuelo: 'ascenso', vehiculo: 'sls' },          // T-00:00 Despegue SLS
    4: { faseVuelo: 'tli', vehiculo: 'icps' },             // Día 1 TLI
    8: { faseVuelo: 'entrada', vehiculo: 'orion' },        // Día 8 Ventana reentrada
    9: { faseVuelo: 'amarizaje', vehiculo: 'orion' }       // Día 10 Amarizaje
  },
  // Marte (m=3): 14 eventos
  3: {
    2: { faseVuelo: 'tmi', vehiculo: 'deep_transport' },   // Día 1 TMI
    9: { faseVuelo: 'moi', vehiculo: 'deep_transport' },   // Día 259 MOI
    11: { faseVuelo: 'edl', vehiculo: 'mars_descent' },    // Día 270 EDL
    13: { faseVuelo: 'ascenso', vehiculo: 'mars_ascent' }  // Día 280 Ascenso
  }
};

// Función para añadir manual: true a un evento específico
function addManualFlag(content, missionIdx, eventIdx, props) {
  // Buscar el inicio de la misión
  const missionStart = content.indexOf(`/* ------------------------------------------------------------- ${missionIdx === 0 ? '11' : missionIdx === 1 ? '13' : missionIdx === 2 ? 'Artemis' : 'Marte'} */`);
  if (missionStart === -1) return content;
  
  // Buscar el array de eventos e: [
  const eStart = content.indexOf('e: [', missionStart);
  if (eStart === -1) return content;
  
  // Contar eventos hasta el que queremos
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
        if (braceCount === 0 && eventCount === eventIdx) {
          // Encontramos el evento completo
          const eventEnd = i + 1;
          const eventStr = content.substring(eventStart, eventEnd);
          
          // Verificar si ya tiene manual
          if (eventStr.includes('manual:')) {
            console.log(`Misión ${missionIdx}, Evento ${eventIdx}: ya tiene manual`);
            return content;
          }
          
          // Insertar manual: true, faseVuelo, vehiculo antes del corchete de cierre
          const propsStr = `manual: true, faseVuelo: '${props.faseVuelo}', vehiculo: '${props.vehiculo}', `;
          const newEventStr = eventStr.replace('{ p:', `{ manual: true, faseVuelo: '${props.faseVuelo}', vehiculo: '${props.vehiculo}', p:`);
          
          console.log(`Misión ${missionIdx}, Evento ${eventIdx}: añadido ${props.faseVuelo} (${props.vehiculo})`);
          return content.substring(0, eventStart) + newEventStr + content.substring(eventEnd);
        }
      }
    }
  }
  return content;
}

// Aplicar a todas las misiones
for (const [missionIdx, events] of Object.entries(manualEvents)) {
  for (const [eventIdx, props] of Object.entries(events)) {
    content = addManualFlag(content, parseInt(missionIdx), parseInt(eventIdx), props);
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('¡Flags manuales añadidos!');