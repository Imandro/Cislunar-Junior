const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find Artemis mission
const startMarker = '/* ------------------------------------------------------------- Artemis */';
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

const newArtemis = `/* ------------------------------------------------------------- Artemis */
{
  n: 'Artemis II', k: 2, f: '~10 días de vuelo', d: '≈10 d',
  v: 'SLS Block 1 · Orion',
  x: 'Primer vuelo tripulado de Orion y el SLS: sobrevuelo lunar sin alunizaje y regreso a la Tierra.',
  img: 'assets/artemis2.jpg', ck: 'artemis2', ico: 'sl',
  r: [['Reid Wiseman', 'Comandante'], ['Victor Glover', 'Piloto'],
      ['Christina Koch', 'Especialista de misión'], ['Jeremy Hansen', 'Especialista (CSA)']],
  e: [
    { p:0, r:4, t:'T−04:00', h:'Carga de propelente',
      c:['SPACECOM','Carga de hidrógeno líquido en curso en la plataforma.'],
      o:[['Carga completa con margen térmico',[2,1,0,0,6],5,
          'El hidrógeno se mantiene a −253 °C. Cargar completo garantiza que la quema de inyección translunar ocurra sin recortes.'],
         ['Cargar menos para acortar la ventana de exposición',[-1,0,0,0,-4],8,
          'Menos propelente en tierra recorta el tiempo de la ventana, pero aprieta el margen de toda la misión.']] },
    { p:0, r:1, t:'T−00:45', h:'Verificación final de sistemas',
      c:['LAUNCH','Todas las estaciones, verificación final de GO/NO-GO.'],
      o:[['Ronda completa de GO/NO-GO con margen',[3,2,1,1,0],3,
          'Cada sistema reporta GO: propulsión, navegación, ECLSS, comunicaciones. El margen absorbe lo imprevisto.'],
         ['Verificación abreviada para mantener la ventana',[-2,-2,0,0,4],7,
          'Saltar cheques no críticos gana minutos, pero deja sin validar redundancias que podrían fallar en vuelo.']] },
    { p:1, r:4, t:'T−00:00', h:'Despegue del SLS',
      c:['SPACECOM','Despegue del SLS con la tripulación de Artemis II a bordo.'],
      o:[['Perfil de ascenso nominal con los cuatro RS-25',[0,-4,0,0,-12],9,
          'Los cuatro motores del núcleo y los dos boosters sacan a Orion del pozo gravitatorio en unos 8 minutos.'],
         ['Perfil de ascenso más suave para aliviar las cargas',[2,-2,0,0,-8],6,
          'Un ascenso más suave reduce las g sobre la tripulación, pero quema más propelente contra la gravedad.']] },
    { p:2, r:4, t:'Día 1', h:'Inyección translunar (TLI)',
      c:['Houston','Quemada de inyección translunar confirmada.'],
      o:[['Inyección translunar con el motor principal del ICPS',[0,-3,0,0,-11],7,
          'El etapa de ajuste empuja a Orion a la velocidad de escape terrestre; a partir de ahí la Luna hace el resto.'],
         ['Aplazar y corregir con los propulsores RCS',[-2,-2,0,0,-4],10,
          'Retrasar la quemada principal da más tiempo de verificación, pero obliga a gastar propelente de control más tarde.']] },
    { p:2, r:0, t:'Día 2', h:'Pruebas de sistemas en tránsito',
      c:['CAPCOM','Orion, procedan con la validación de navegación óptica y comunicaciones.'],
      o:[['Suite completa de pruebas: nave estelar, radar, láser',[1,-1,2,0,-3],5,
          'Validar todos los sensores en el espacio profundo asegura que el sobrevuelo lunar tendrá datos de máxima calidad.'],
         ['Pruebas mínimas y ahorrar consumibles',[-1,1,0,1,0],4,
          'Solo lo esencial deja más margen de agua y energía, pero deja incertidumbre en la navegación de precisión.']] },
    { p:3, r:2, t:'Día 4', h:'Punto más lejano / Sobrevuelo lunar',
      c:['CAPCOM','Orion en el punto más lejano de la trayectoria de retorno libre.'],
      o:[['Sobrevuelo lunar de precisión para calibrar sensores',[0,0,5,0,-5],5,
          'A unos 7.400 km de la superficie, Orion valida su escudo térmico y sus cámaras sobre el terreno real.'],
         ['Mantener distancia y ahorrar consumibles',[-1,0,1,1,0],4,
          'No acercarse ahorra recursos, pero deja sin validar el sistema de guía en el lado oscuro de la Luna.']] },
    { p:4, r:4, t:'Día 6', h:'Quemada de salida lunar (TEI)',
      c:['Flight','Quemada de inyección transtierra confirmada. Rumbo a casa.'],
      o:[['TEI con el motor principal del módulo de servicio',[0,-3,0,0,-10],6,
          'La quemada de salida lunar es la maniobra crítica que compromete a la nave a la reentrada terrestre.'],
         ['TEI dividida en dos pulsos para control térmico',[-2,-2,0,0,-6],8,
          'Dos pulsos reparten el calor del motor, pero exigen navegación intermedia precisa y más tiempo.']] },
    { p:5, r:0, t:'Día 8', h:'Ventana de reentrada',
      c:['Flight','Ventana de reentrada abierta. Tripulación, a sus puestos.'],
      o:[['Reentrada directa con el escudo en configuración nominal',[0,0,4,0,-4],8,
          'La cápsula entra a unos 40.000 km/h con un ángulo de unos 5,5°; el escudo absorbe el calor de la fricción durante varios minutos.'],
         ['Ángulo de entrada más agresivo para probar el límite',[-2,0,7,0,-6],15,
          'Un ángulo más pronunciado deja medir el margen real del escudo térmico, pero suben el calor y las cargas.']] },
    { p:6, r:4, t:'Día 10', h:'Amarizaje / Recuperación',
      c:['Recovery','Avistamiento de la cápsula. Descenso nominal.'],
      o:[['Soltar los paracaídas de maniobra en el orden nominal',[0,0,1,0,-2],3,
          'Los dos paracaídas de maniobra estabilizan la cápsula justo antes del despliegue de los tres principales.'],
         ['Probar el modo redundante durante el descenso',[1,-1,3,0,-4],9,
          'Validar la copia de seguridad en vuelo deja el sistema probado, a cambio de más oscilación en la caída.']] }
  ]
},`;

html = html.slice(0, startIdx) + newArtemis + html.slice(endIdx);
fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Replaced Artemis mission');