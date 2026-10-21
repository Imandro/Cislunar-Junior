const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find the end of M array (the first ]; after Marte mission)
const endM = html.indexOf('];', 44277);

// The arrays to add after M
const arrays = `
/* =======================================================================
 * HITOS, DURACIONES Y ESCENAS POR MISIÓN
 * HR: hitos que marcan la línea de tiempo (índice de evento → etiqueta)
 * TT: duración total legible
 * SC: lista de escenas 2D disponibles por misión
 * DU: duración (s) de cada escena
 * ==================================================================== */
var HR = [
  [[0,'Carga'],[1,'TLI'],[2,'Separación'],[4,'Descenso'],[5,'Alarma'],[6,'EVA'],[8,'Despegue'],[10,'TEI'],[11,'Reentrada']],
  [[0,'Pre-vuelo'],[1,'TLI'],[2,'Separación'],[3,'Falla'],[4,'CO₂'],[6,'Apagón'],[7,'PC+2'],[8,'Reentrada'],[9,'Splashdown']],
  [[0,'Carga'],[1,'Verificación'],[2,'Despegue'],[3,'TLI'],[4,'Pruebas'],[5,'Sobrevuelo'],[6,'TEI'],[7,'Entrada'],[8,'Amarizaje']],
  [[0,'ECLSS'],[1,'Verificación'],[2,'TMI'],[3,'Separación'],[4,'Tormenta'],[5,'TCM-1'],[6,'TCM-2'],[7,'MOI Prep'],[8,'MOI'],[9,'Desacoplo'],[10,'Descenso'],[11,'Superficie'],[12,'Ascenso']]
];
var TT = ['8 d 3 h', '5 d 23 h', '≈10 d', '≈259 d'];
var SC = [
  ['pad','up','fly','land','surf','asc','re'],
  ['pad','up','fly','burn','re'],
  ['pad','up','fly','re'],
  ['pad','up','fly','moi','mdes']
];
var DU = [[6,7,8,9,9,6,7],[6,7,6,9,7,7],[6,7,11,8],[6,7,13,7,8]];
`;

// Insert after M array
html = html.slice(0, endM + 2) + arrays + html.slice(endM + 2);

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Added SC, HR, TT, DU arrays');