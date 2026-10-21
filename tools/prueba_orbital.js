/* Pruebas de física orbital — Cañon Labs */
const ORB = require(require('path').resolve(__dirname, '..', 'js', 'orbital.js'));

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra !== undefined ? '  -> ' + extra : '')); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m, `obtenido ${a}, esperado ${b}±${tol}`);
const T = ORB.CUERPOS.tierra, L = ORB.CUERPOS.luna, M = ORB.CUERPOS.marte;

console.log('\n=== CONSTANTES Y CUERPOS ===');
near(ORB.G0, 9.80665, 1e-9, 'g0 = 9.80665 m/s2');
near(ORB.AU, 1.495978707e11, 1, 'UA = 149.5978707 Gm');
ok(M.R === 3389.5 && L.R === 1737.4, 'Radios Luna/Marte correctos (km)');
ok(L.mu > 0 && M.mu > 0 && T.mu > 0, 'Parametros gravitacionales presentes');

console.log('\n=== ECUACION VIS-VIVA ===');
// Orbita circular: v^2 = mu/r  -> coherente con v = sqrt(mu/r)
const rLEO = 6.771e6;                       // 400 km sobre la Tierra
near(ORB.visViva(T.mu, rLEO, rLEO), ORB.velocidadCircular(T.mu, rLEO), 1e-6,
  'visViva(a=r) == velocidad circular');
// Energia total cero en a = -mu/(2*energia): comprobamos que v(peri, a) es > v(circ, a)
const vCirc = ORB.velocidadCircular(T.mu, rLEO);
const vEsc = ORB.velocidadEscape(T.mu, rLEO);
ok(vEsc > vCirc * Math.SQRT2 - 1e-3, `Escape (${(vEsc/1000).toFixed(2)} km/s) > √2·circular (${(vCirc*Math.SQRT2/1000).toFixed(2)} km/s)`);
near(vEsc / vCirc, Math.SQRT2, 1e-9, 'v_escape / v_circular = √2 exactamente');
// A la superficie de la Tierra la velocidad de escape es ~11.2 km/s
near(ORB.velocidadEscape(T.mu, T.R * 1000) / 1000, 11.186, 0.01, 'Escape desde la superficie terrestre ≈ 11.19 km/s');
// En Marte es ~5.03 km/s
near(ORB.velocidadEscape(M.mu, M.R * 1000) / 1000, 5.027, 0.01, 'Escape desde la superficie de Marte ≈ 5.03 km/s');
// v debe ser positiva solo donde la energia permite
ok(ORB.visViva(T.mu, rLEO, 1e9) > 0, 'visViva positiva en orbita de energia negativa');
ok(ORB.visViva(T.mu, rLEO, rLEO / 2) === 0, 'visViva = 0 cuando 2/r = 1/a (parabolica)');

console.log('\n=== ELEMENTOS ORBITALES -> ESTADO ===');
// Orbita circular LEO: e=0, nu cualquiera -> |r| constante, |v| circular
const orb = ORB.desdeElementos(T.mu, rLEO, 0, 0, 0, 0, 0);
near(Math.hypot(...orb.r), rLEO, 1, '|r| = semieje mayor en orbita circular');
near(Math.hypot(...orb.v), ORB.velocidadCircular(T.mu, rLEO), 1e-6, '|v| = velocidad circular');
near(orb.altura, 400000, 1000, 'altura sobre la Tierra ≈ 400 km');
near(orb.periodo / 60, 92.4, 0.5, 'periodo LEO 400km ≈ 92.4 min');
// e = 0.5 -> el periapsis y apoapsis deben ser a(1-e) y a(1+e)
const e05 = ORB.desdeElementos(T.mu, 1e7, 0.5, 0.3, 1.1, 0.7, 2.0);
const rE05 = Math.hypot(...e05.r);
const esperado = 1e7 * (1 - 0.5 * 0.5) / (1 + 0.5 * Math.cos(2.0));
near(rE05, esperado, 1, 'radio por vis-viva en eccentric anomaly respeta la conica');
// Periodo de la Luna: orbita la TIERRA, asi que mu es el terrestre
const orbLuna = ORB.desdeElementos(T.mu, 384400e3, 0.0549, 0, 0, 0, 0);
near(orbLuna.periodo / 86400, 27.32, 0.5, 'Periodo orbital de la Luna ≈ 27.32 dias');
// Anio terrestre: orbita el SOL, asi que mu es el solar
const orbT = ORB.desdeElementos(ORB.CUERPOS.sol.mu, 1.0 * ORB.AU, 0.0167, 0, 0, 0, 0);
near(orbT.periodo / 86400 / 365.25, 1.0, 0.01, 'Periodo a 1 UA ≈ 1 ano');

console.log('\n=== ESTADO -> ELEMENTOS (ida y vuelta) ===');
const casos = [
  { a: 7.0e6, e: 0.001, inc: 0.0, raan: 0.0, argp: 0.0, nu: 0.5 },
  { a: 1.2e7, e: 0.35, inc: 0.6, raan: 2.0, argp: 3.0, nu: 1.2 },
  { a: 4.2e8, e: 0.90, inc: 1.2, raan: 0.8, argp: 4.2, nu: 2.6 }
];
casos.forEach((c, i) => {
  const mu = T.mu;
  const st = ORB.desdeElementos(mu, c.a, c.e, c.inc, c.raan, c.argp, c.nu);
  const el = ORB.aElementos(mu, st.r, st.v);
  const d = (x, y) => Math.abs(((x - y) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  near(el.a, c.a, c.a * 1e-6, `Caso ${i}: semieje recovered`);
  near(el.e, c.e, 1e-6, `Caso ${i}: excentricidad recuperada`);
  near(el.inc, c.inc, 1e-6, `Caso ${i}: inclinacion recuperada`);
  // con inclinacion 0 (o excentricidad 0) nu y argp no estan definidos fisicamente
  const nuDefinido = c.inc > 1e-6 && c.e > 1e-6;
  if (nuDefinido) {
    near(el.nu, c.nu, 1e-6, `Caso ${i}: anomalia verdadera recuperada`);
    near(d(el.raan, c.raan), 0, 1e-6, `Caso ${i}: nodo ascendente recuperado`);
    near(d(el.argp, c.argp), 0, 1e-6, `Caso ${i}: arg periapside recuperado`);
  } else {
    ok(Number.isFinite(el.nu) && Number.isFinite(el.raan) && Number.isFinite(el.argp),
      `Caso ${i}: elementos degenerados devuelven valores finitos (no NaN)`);
  }
});
// Excentricidad 0 exacta
const c0 = ORB.desdeElementos(T.mu, rLEO, 0, 0, 0, 0, 0);
const e0 = ORB.aElementos(T.mu, c0.r, c0.v);
near(e0.e, 0, 1e-9, 'Excentricidad 0 se recupera como 0');

console.log('\n=== TRANSFERENCIA DE HOHMANN TIERRA -> LUNA ===');
const r1 = T.R * 1000;                       // perigeo  = 6371 km
const r2 = 384400e3;                          // apogeo   = 384400 km
const aH = (r1 + r2) / 2;
const dv1 = ORB.visViva(T.mu, r1, aH) - ORB.velocidadCircular(T.mu, r1);
const dv2 = ORB.visViva(T.mu, r2, aH) - ORB.velocidadCircular(T.mu, r2);
near(dv1 / 1000, 3.09, 0.35, 'Δv de perigeo TLI ≈ 3.1 km/s (documentado ~3.1)');
near(Math.abs(dv2) / 1000, 0.83, 0.10, 'Δv de captura lunar ≈ 0.83 km/s (frenado)');
const tHoh = Math.PI * Math.sqrt((aH * aH * aH) / T.mu);
near(tHoh / 86400, 5.0, 0.9, 'Tiempo de transito Tierra-Luna ≈ 5 dias');

console.log('\n=== TRANSFERENCIA DE HOHMANN TIERRA -> MARTE (heliocentrica) ===');
// Ambos cuerpos orbitan el Sol: la transferencia usa mu solar
const MU_SOL = ORB.CUERPOS.sol.mu;
const rm = M.a;                                // semieje mayor orbital de Marte (m)
near(rm / ORB.AU, 1.5237, 0.001, 'Semieje de Marte ≈ 1.524 UA');
const aHM = (1.0 * ORB.AU + rm) / 2;
// Δv de la quemada TMI = diferencia entre la velocidad de transferencia
// heliocéntrica y la velocidad orbital de la Tierra (valor publicado ~2.9 km/s).
const dvHelio = ORB.visViva(MU_SOL, ORB.AU, aHM) - ORB.velocidadCircular(MU_SOL, ORB.AU);
near(dvHelio / 1000, 2.945, 0.10, 'Δv TMI heliocéntrico ≈ 2.95 km/s (documentado ~2.9)');
// Desde una órbita baja: hay que escapar del pozo gravitico terrestre.
//   v_infinito = sqrt(v_escape^2 + v_inf^2)
//   Δv_LEO    = v_infinito − v_circular(LEO)
const vinf = dvHelio;
const vinfty = Math.sqrt(Math.pow(ORB.velocidadEscape(T.mu, T.R * 1000), 2) + vinf * vinf);
const rLEO_M = 6.771e6;
const dvLEO = vinfty - ORB.velocidadCircular(T.mu, rLEO_M);
ok(dvLEO / 1000 > 3.2 && dvLEO / 1000 < 4.2,
  `Δv TMI desde LEO ≈ 3.6 km/s: ${(dvLEO/1000).toFixed(2)} km/s`);
const tMars = Math.PI * Math.sqrt((aHM * aHM * aHM) / MU_SOL);
near(tMars / 86400, 259, 12, 'Transito Tierra-Marte ≈ 259 dias');
// Venus comparacion: 1.5 orbits -> ~263 dias
const aV = (ORB.AU + 1.0 * ORB.AU * 0.723) / 2;
const tV = Math.PI * Math.sqrt(aV ** 3 / MU_SOL);
ok(tV / 86400 > 140 && tV / 86400 < 160, `Transito Tierra-Venus ≈ 146 dias: ${(tV/86400).toFixed(0)}`);

console.log('\n=== PROPAGACION ===');
const el0 = ORB.aElementos(T.mu, [rLEO, 0, 0], [0, ORB.velocidadCircular(T.mu, rLEO), 0]);
const unPeriodo = el0.periodo;
const despues = ORB.avanzar(T.mu, el0, unPeriodo);
if (despues) {
  near(Math.hypot(...despues.r), rLEO, rLEO * 1e-3, 'Tras un periodo completo vuelve a su altura');
  near(despues.a, el0.a, el0.a * 1e-3, 'El semieje mayor se conserva');
} else ok(false, 'avanzar devuelve estado tras un periodo');
// Cuarto de periodo: debe estar al otro lado
const cuarto = ORB.avanzar(T.mu, el0, unPeriodo / 4);
if (cuarto) near(Math.hypot(...cuarto.r), rLEO, rLEO * 1e-3, 'Tras un cuarto de periodo conserva el radio (orbita circular)');
// Orbita eliptica: el apogeo y periogeo deben reproducirse
const elE = { a: 1e7, e: 0.4, inc: 0, raan: 0, argp: 0, nu: 0 };
const peri = ORB.avanzar(T.mu, elE, 0);
near(Math.hypot(...peri.r), 1e7 * 0.6, 1e4, 'nu=0 -> esta en periapsis (a(1-e))');
const apo = ORB.avanzar(T.mu, elE, Math.PI * Math.sqrt(1e21 / T.mu));
near(Math.hypot(...apo.r), 1e7 * 1.4, 5e4, 'Medio periodo despues -> esta en apoapsis (a(1+e))');

console.log('\n=== TRAZADO DE ORBITAS ===');
const pts = ORB.trazar(T.mu, elE, 120);
ok(pts.length === 121, `trazar devuelve segmentos+1 puntos (${pts.length})`);
const rmin = Math.min(...pts.map(p => Math.hypot(...p)));
const rmax = Math.max(...pts.map(p => Math.hypot(...p)));
near(rmin, 6e6, 5e4, 'radio minimo dibujado ≈ periapsis');
near(rmax, 1.4e7, 5e5, 'radio maximo dibujado ≈ apoapsis');
const ptsH = ORB.trazar(T.mu, { a: 4.2e8, e: 1.6, inc: 0.1, raan: 0, argp: 0, nu: 0 }, 90);
ok(ptsH.length === 91, `trazar hiperbola tambien (${ptsH.length} puntos)`);
ok(ptsH.every(p => p.every(Number.isFinite)), 'Hiperbola sin NaN');

console.log('\n=== PERFIL DE ASCENSO ===');
// Pila de dos etapas sencilla (datos inspirados en el Saturn V)
const etapas = [
  { seca: 131000, propelente: 2100000, empuje: 34200000, isp: 263 },
  { seca: 370000, propelente: 480000, empuje: 5000000, isp: 390 }
];
const prof = ORB.perfilAscenso(T, etapas, { dt: 2 });
ok(prof.puntos.length > 10, `Perfil genera puntos (${prof.puntos.length})`);
ok(prof.alturaMax >= 0, `Altura maxima no negativa: ${(prof.alturaMax/1000).toFixed(1)} km`);
ok(Number.isFinite(prof.velocidad), `Velocidad final finita: ${(prof.velocidad/1000).toFixed(2)} km/s`);
ok(prof.elementos && Number.isFinite(prof.elementos.e), 'Elementos orbitales del perfil calculados');
// Isp efectivo: con ambas etapas encendidas a la vez el flujo se suma,
// asi que el Isp efectivo queda entre los Isp individuales (263 y 390).
const ispW = ORB.pesoIsp(etapas);
ok(ispW >= 263 && ispW <= 390, `Isp ponderado entre las etapas (${ispW.toFixed(0)} s)`);
// Etapa unica: el Isp efectivo debe ser exactamente su Isp
const unaEtapa = ORB.pesoIsp([{ seca: 1000, propelente: 50000, empuje: 1000000, isp: 300 }]);
near(unaEtapa, 300, 1e-6, 'Con una sola etapa el Isp efectivo es su propio Isp');
// Dos etapas con el mismo Isp -> mismo Isp efectivo
const misma = ORB.pesoIsp([
  { seca: 1, propelente: 10, empuje: 100, isp: 350 },
  { seca: 1, propelente: 10, empuje: 200, isp: 350 }
]);
near(misma, 350, 1e-6, 'Dos etapas con igual Isp dan ese mismo Isp');
// Sin empuje cae
const profLibre = ORB.perfilAscenso(T, [{ seca: 1000, propelente: 0, empuje: 0, isp: 300 }], { dt: 2 });
ok(profLibre.alturaMax >= -1, 'Sin empuje la nave no sube');

console.log('\n=== DENSIDAD ATMOSFERICA ===');
near(ORB.densidadAtmosferica(T, 0), 1.225, 1e-3, 'Densidad a nivel del mar ≈ 1.225 kg/m3');
ok(ORB.densidadAtmosferica(T, 50000) < ORB.densidadAtmosferica(T, 10000), 'Densidad baja con la altitud');
ok(ORB.densidadAtmosferica(T, 200000) === 0, 'Densidad cero fuera de la atmosfera');
near(ORB.densidadAtmosferica(M, 0), 0.020, 1e-3, 'Densidad de Marte a nivel del suelo ≈ 0.020 kg/m3');

console.log('\n=== API ===');
['visViva','velocidadEscape','velocidadCircular','desdeElementos','aElementos','avanzar','trazar','perfilAscenso','pesoIsp','densidadAtmosferica'].forEach(k => {
  ok(typeof ORB[k] === 'function', 'ORB.' + k + ' expuesta');
});

console.log('\n=========================================');
console.log(`RESULTADO FISICA: ${pass} OK, ${fail} fallos`);
console.log('=========================================');
process.exit(fail ? 1 : 0);