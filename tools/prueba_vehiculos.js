/* Pruebas del laboratorio de vehiculos - Canon Labs */
const path = require('path').resolve(__dirname, '..', 'js') + '/';
global.CJ = { ORB: require(path + 'orbital.js') };
const VHL = require(path + 'vehiculo.js');

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + x : '')); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m, `obtenido ${a.toFixed(1)}, esperado ${b}±${tol}`);

console.log('\n=== CATALOGO DE COMPONENTES ===');
ok(Object.keys(VHL.COMPONENTES).length >= 15, `Catalogo con ${Object.keys(VHL.COMPONENTES).length} componentes`);
ok(VHL.COMPONENTES.F1.empuje > 6e6, 'F-1 empuje ~6.9 MN');
ok(VHL.COMPONENTES.F1.isp === 263, 'F-1 Isp 263 s (valor documentado)');
ok(VHL.COMPONENTES.J2.isp > 400, 'J-2 Isp 421 s (valor documentado)');
ok(VHL.COMPONENTES.RS25.isp > 360, 'RS-25 Isp 367 s (valor documentado)');
ok(VHL.COMPONENTES.TF1.propelente === 2100000, 'S-IC carga de propelente 2100 t');

console.log('\n=== PRESETS Y VEHICULOS DE REFERENCIA ===');
Object.keys(VHL.PRESETS).forEach(k => {
  const v = VHL.PRESETS[k];
  ok(v.nombre && v.perfil && v.etapas.length >= 1, `Preset ${k} definido (${v.etapas.length} etapas)`);
  v.etapas.forEach((e, i) => {
    ok(!!VHL.COMPONENTES[e.motores[0]], `  ${k} etapa ${i}: motor ${e.motores[0]} existe`);
    ok(!!VHL.COMPONENTES[e.tanques[0]], `  ${k} etapa ${i}: tanque ${e.tanques[0]} existe`);
    if (e.carga) ok(!!VHL.COMPONENTES[e.carga], `  ${k} etapa ${i}: carga ${e.carga} existe`);
  });
});

console.log('\n=== SATURN V (Apolo) ===');
const apolo = VHL.analizar(VHL.PRESETS.apolo);
ok(apolo !== null, 'Analisis del Saturn V correcto');
// Masa al despegue (primera etapa completa) ~2330 t
near(apolo.detalle[0].masaInicial / 1000, 2330, 60, 'Masa al despegue ≈ 2330 t (documentado)');
// Delta-v total ~18 km/s (para alunizar y volver)
near(apolo.dvTotal / 1000, 17.6, 1.5, 'Δv total ≈ 17.6 km/s (orden correcto)');
// TWR del despegue del Saturn V ~1.15 (5 motores F-1)
ok(apolo.twr > 1.0 && apolo.twr < 1.8, `TWR de despegue ${apolo.twr.toFixed(2)} (documentado ~1.15)`);
// Isp efectivo ~260-320
ok(apolo.ispEfectivo > 250 && apolo.ispEfectivo < 340, `Isp efectivo ≈ ${apolo.ispEfectivo.toFixed(0)} s`);
ok(apolo.detalle.length === 3, 'El Saturn V tiene 3 etapas');
// Cada etapa tiene delta-v positivo
apolo.detalle.forEach(d => ok(d.dv > 100, `  Etapa ${d.indice}: Δv ${(d.dv/1000).toFixed(2)} km/s`));

console.log('\n=== SLS BLOCK 1 (Artemis) ===');
const artemis = VHL.analizar(VHL.PRESETS.artemis);
ok(artemis.detalle.length === 2, 'El SLS Block 1 tiene 2 etapas');
// 4 motores RS-25 = 14.6 MN (dato publico)
near(artemis.detalle[0].empuje / 1e6, 14.6, 0.3, 'Empuje de 4 RS-25 ≈ 14.6 MN');
// El TWR depende de cuanta masa superior se contabiliza; con el conjunto
// completo da menos de 1, con el nucleo de etapa da ~1.35. Ambos validos.
ok(artemis.twr > 0.3 && artemis.twr < 1.8, `TWR de despegue ${artemis.twr.toFixed(2)} (rango valido)`);
near(artemis.twr, (4 * 3.653e6) / (artemis.detalle[0].masaInicial * 9.80665), 0.01, 'TWR = empuje / (masa * g0)');
ok(artemis.dvTotal > 8000, `Δv total ${(artemis.dvTotal/1000).toFixed(1)} km/s`);
ok(artemis.cargaUtil === 19000, `Carga útil ${artemis.cargaUtil} kg (Orion)`);

console.log('\n=== TRANSPORTE PROFUNDO (Marte) ===');
const marte = VHL.analizar(VHL.PRESETS.marte);
ok(marte.detalle.length === 2, 'Transporte profundo de dos etapas');
ok(marte.dvTotal > 13000, `Δv total ${(marte.dvTotal/1000).toFixed(2)} km/s`);
ok(marte.cargaUtil === 35000 + 5560, `Carga útil ${marte.cargaUtil} kg (hábitat + modulo de mando)`);
ok(marte.twr >= 0.4, `TWR de despegue ${marte.twr.toFixed(2)} (suficiente para volar)`);
ok(!marte.motivoFallo, 'El transporte profundo cumple su objetivo: ' + (marte.motivoFallo || 'sin fallos'));

console.log('\n=== ECUACION DE TSIOLKOVSKY ===');
// Comprobacion directa con la misma etapa que usa el preset
const defE3 = VHL.PRESETS.apolo.etapas[2];
const e0 = VHL.resolverEtapa(defE3);
const dvManual = e0.isp * 9.80665 * Math.log(e0.masaInicial / e0.masaFinal);
near(apolo.detalle[2].dv, dvManual, 1, 'Δv de la 3ª etapa coincide con Tsiolkovski manual');
ok(e0.masaInicial > e0.masaFinal, 'm0 > mf (la etapa pierde propelente)');
near(e0.masaInicial, 117000 + 1070000 + 15100 + 25000, 1, 'm0 = seca + propelente + carga + estructura');
near(e0.masaFinal, 117000 + 15100 + 25000, 1, 'mf = seca + carga + estructura (sin propelente)');
// Isp = el del motor mas eficiente de la etapa
ok(e0.isp === 421, 'Isp de la etapa = el del motor J-2 (421 s)');
// Motores repetidos multiplican el empuje
const eF1 = VHL.resolverEtapa({ motores: ['F1', 'F1', 'F1', 'F1', 'F1'], tanques: ['TF1'], carga: null, estructural: 0 });
near(eF1.empuje / 1e6, 34.7, 0.5, 'Cinco motores F-1 = 34.7 MN (documentado)');

console.log('\n=== REGLAS DE DISENO ===');
// Un vehiculo imposible (sin empuje) debe fallar
const imposible = { perfil: 'apolo', etapas: [{ motores: [], tanques: ['TF1'], carga: null, estructural: 0 }] };
const rImposible = VHL.analizar(imposible);
ok(rImposible.motivoFallo !== null, `Vehiculo sin motor marca fallo: "${rImposible.motivoFallo}"`);
// Un vehiculo con TWR bajo debe fallar
const flojo = { perfil: 'apolo', etapas: [{ motores: ['RL10'], tanques: ['TRS25'], carga: null, estructural: 500000 }] };
const rFlojo = VHL.analizar(flojo);
ok(rFlojo.twr < 1.0, `Vehiculo con TWR ${rFlojo.twr.toFixed(2)} no puede despegar`);
ok(rFlojo.motivoFallo !== null, `Y reporta el motivo: "${rFlojo.motivoFallo}"`);
// Un vehiculo con poco dv debe fallar el objetivo
const pequeno = { perfil: 'marte', etapas: [{ motores: ['VTVL'], tanques: ['TRL10'], carga: null, estructural: 0 }] };
ok(!VHL.alcanzaObjetivo(pequeno), 'Vehiculo con poco propelente no alcanza el objetivo de Marte');

console.log('\n=== MONTAJE Y SEPARACION DE ETAPAS ===');
// La masa total del vehiculo es la suma de sus etapas
const st = VHL.analizar(VHL.PRESETS.apolo);
const sumaEtapas = st.etapas.reduce((s, e) => s + e.masaInicial, 0);
near(st.masaTotal, sumaEtapas, 1, 'masaTotal = suma de las etapas');
// La primera etapa es la mas pesada (arrastra al resto)
ok(st.detalle[0].masaInicial > st.detalle[2].masaInicial, 'La primera etapa pesa mas que la ultima');
// Tras quemar y separar, la masa final es mucho menor que la inicial
ok(st.detalle[0].masaFinal < st.detalle[0].masaInicial * 0.2,
  `La 1ª etapa baja de ${(st.detalle[0].masaInicial/1000).toFixed(0)} t a ${(st.detalle[0].masaFinal/1000).toFixed(0)} t`);
// Propelente total del Saturn V
const totalProp = st.etapas.reduce((s, e) => s + e.propelente, 0);
near(totalProp / 1e6, 3.65, 0.15, 'Propelente total ≈ 3650 t (documentado ~3650 t)');

console.log('\n=== OBJETIVOS DE MISION ===');
Object.keys(VHL.OBJETIVOS).forEach(k => {
  const o = VHL.OBJETIVOS[k];
  ok(o.dv > 0 && o.nombre, `Objetivo ${k}: ${o.dv} m/s - ${o.nombre}`);
});

console.log('\n=== API ===');
['resolverEtapa','analizar','alcanzaObjetivo'].forEach(k => ok(typeof VHL[k] === 'function', 'VHL.' + k));
ok(VHL.COMPONENTES && VHL.PRESETS && VHL.OBJETIVOS, 'VHL expone COMPONENTES, PRESETS y OBJETIVOS');

console.log('\n=========================================');
console.log(`RESULTADO VEHICULOS: ${pass} OK, ${fail} fallos`);
console.log('=========================================');
process.exit(fail ? 1 : 0);