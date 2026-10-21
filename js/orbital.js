/* ===========================================================================
 * CISLUNAR JUNIOR - Nucleo de mecanica orbital
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Reimplementacion original de propagacion orbital kepleriana.
 * Todo el codigo de este archivo es original de Canon Labs.
 *
 * Teoria empleada (dominio publico, fisica clasica):
 *   - Ecuacion vis-viva:      v^2 = mu(2/r - 1/a)
 *   - Leyes de Kepler y elementos orbitales (a, e, i, raan, argp, nu)
 *   - Rotacion de ejes del marco perifocal al marco inercial
 * =========================================================================== */
(function (root) {
  'use strict';

  // --- Constantes fisicas -------------------------------------------------
  // Valores de referencia publicos (NASA/JPL Planetary Fact Sheet).
  var G0 = 9.80665;              // gravedad estandar, m/s^2
  var AU = 1.495978707e11;       // unidad astronomica, m
  var C_LIGHT = 299792458;       // velocidad de la luz, m/s

  var CUERPOS = {
    // mu = GM en m^3/s^2 ; R = radio ecuatorial en km ; a = semieje mayor en m
    tierra: { nombre: 'Tierra', mu: 3.986004418e14, R: 6371.0, a: AU, periodo: 365.256363 },
    luna:   { nombre: 'Luna',   mu: 4.9048695e12,  R: 1737.4, a: 384400e3, periodo: 27.321661 },
    marte:  { nombre: 'Marte',  mu: 4.282837e13,   R: 3389.5, a: 2.27953e11, periodo: 686.980 },
    sol:    { nombre: 'Sol',    mu: 1.32712440018e20, R: 695700, a: 0, periodo: 0 }
  };

  var GRADOS = Math.PI / 180;

  function rad(g) { return g * GRADOS; }
  function gra(r) { return r / GRADOS; }

  /** Limita un valor al intervalo 0..1 */
  function sat(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /** Magnitud de un vector 3D */
  function mod3(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

  /* =======================================================================
   * ECUACION VIS-VIVA
   * Velocidad de una conica de semieje `a` a distancia `r` del foco.
   * ==================================================================== */
  function visViva(mu, r, a) {
    if (!(a > 0) || !(r > 0)) return NaN;
    var v2 = mu * (2 / r - 1 / a);
    return v2 > 0 ? Math.sqrt(v2) : 0;
  }

  /** Velocidad de escape desde la superficie de un cuerpo. */
  function velocidadEscape(mu, r) {
    return Math.sqrt(2 * mu / r);
  }

  /** Velocidad circular en orbita de radio `r`. */
  function velocidadCircular(mu, r) {
    return Math.sqrt(mu / r);
  }

  /** Radio aproximado asociado a un mu dado (para el calculo de altura). */
  function cuerpoPorDefectoR(mu) {
    var mejor = 0, dif = Infinity;
    for (var k in CUERPOS) {
      var d = Math.abs(CUERPOS[k].mu - mu) / CUERPOS[k].mu;
      if (d < dif) { dif = d; mejor = CUERPOS[k].R * 1000; }
    }
    return mejor;
  }

  /* =======================================================================
   * ROTACION DE MARCOS
   * RZ(t): x' = x cos t - y sen t ;  y' = x sen t + y cos t
   * RX(t): y' = y cos t - z sen t ;  z' = y sen t + z cos t
   * Cadena completa: RZ(raan) . RX(inc) . RZ(argp)
   * Verificada por ida y vuelta contra aElementos().
   * ==================================================================== */
  function pasarAInercial(rp, vp, inc, raan, argp) {
    var c1 = Math.cos(argp), s1 = Math.sin(argp);
    var r1 = [rp[0] * c1 - rp[1] * s1, rp[0] * s1 + rp[1] * c1, rp[2]];
    var v1 = [vp[0] * c1 - vp[1] * s1, vp[0] * s1 + vp[1] * c1, vp[2]];

    var c2 = Math.cos(inc), s2 = Math.sin(inc);
    var r2 = [r1[0], r1[1] * c2 - r1[2] * s2, r1[1] * s2 + r1[2] * c2];
    var v2 = [v1[0], v1[1] * c2 - v1[2] * s2, v1[1] * s2 + v1[2] * c2];

    var c3 = Math.cos(raan), s3 = Math.sin(raan);
    var r3 = [r2[0] * c3 - r2[1] * s3, r2[0] * s3 + r2[1] * c3, r2[2]];
    var v3 = [v2[0] * c3 - v2[1] * s3, v2[0] * s3 + v2[1] * c3, v2[2]];

    return { r: r3, v: v3 };
  }

  /* =======================================================================
   * ELEMENTOS ORBITALES -> VECTOR DE ESTADO
   * ==================================================================== */
  function desdeElementos(mu, a, e, inc, raan, argp, nu) {
    var p = a * (1 - e * e);
    var r = p / (1 + e * Math.cos(nu));
    var k = Math.sqrt(mu / p);
    // Marco perifocal: X hacia el periapside
    var rp = [r * Math.cos(nu), r * Math.sin(nu), 0];
    var vp = [-k * Math.sin(nu), k * (e + Math.cos(nu)), 0];

    var m = pasarAInercial(rp, vp, inc, raan, argp);
    m.radio = r;
    m.velocidad = Math.sqrt(mu * (2 / r - 1 / a));
    m.altura = r - cuerpoPorDefectoR(mu);
    m.periodo = 2 * Math.PI * Math.sqrt(a * a * a / mu);
    m.excentricidad = e;
    m.a = a;
    m.inc = inc;
    m.raan = raan;
    m.argp = argp;
    m.nu = nu;
    return m;
  }

  /* =======================================================================
   * VECTOR DE ESTADO -> ELEMENTOS ORBITALES
   * ==================================================================== */
  function aElementos(mu, r, v) {
    var rm = mod3(r);
    var vm = mod3(v);

    // momento angular especifico  h = r x v
    var hx = r[1] * v[2] - r[2] * v[1];
    var hy = r[2] * v[0] - r[0] * v[2];
    var hz = r[0] * v[1] - r[1] * v[0];
    var hm = Math.hypot(hx, hy, hz);

    // energia especifica -> semieje mayor
    var energia = (vm * vm) / 2 - mu / rm;
    var semieje = -mu / (2 * energia);
    var exc = energia > 0
      ? Infinity
      : Math.sqrt(Math.max(0, 1 + (2 * energia * hm * hm) / (mu * mu)));

    // inclinacion
    var inc = Math.acos(Math.max(-1, Math.min(1, hz / hm)));

    // nodo ascendente:  n = z x h  =  (-hy, hx, 0)
    var nx = -hy, ny = hx;
    var nm = Math.hypot(nx, ny);

    var raan = nm > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, nx / nm))) : 0;
    if (nm > 1e-9 && ny < 0) raan = 2 * Math.PI - raan;

    // vector excentricidad
    var rdotv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
    var ex = ((vm * vm - mu / rm) * r[0] - rdotv * v[0]) / mu;
    var ey = ((vm * vm - mu / rm) * r[1] - rdotv * v[1]) / mu;
    var ez = ((vm * vm - mu / rm) * r[2] - rdotv * v[2]) / mu;

    // periapside y anomalia verdadera no estan definidas si exc = 0
    var degenerado = nm <= 1e-9 || exc <= 1e-9;

    var argp = 0;
    if (!degenerado) {
      argp = Math.acos(Math.max(-1, Math.min(1, (nx * ex + ny * ey) / (nm * exc))));
      if (ez < 0) argp = 2 * Math.PI - argp;
    }

    var nu = 0;
    if (!degenerado) {
      nu = Math.acos(Math.max(-1, Math.min(1, (ex * r[0] + ey * r[1] + ez * r[2]) / (exc * rm))));
      if (rdotv < 0) nu = 2 * Math.PI - nu;
    }

    return {
      a: semieje, e: exc, inc: inc, raan: raan, argp: argp, nu: nu,
      // energia negativa = orbita ligada, con periodo finito
      periodo: energia < 0 ? 2 * Math.PI * Math.sqrt(semieje * semieje * semieje / mu) : Infinity,
      energia: energia
    };
  }

  /* =======================================================================
   * PROPAGACION
   * Resuelve la ecuacion de Kepler por Newton-Raphson.
   * ==================================================================== */
  function avanzar(mu, estado, dt) {
    var a = estado.a, e = estado.e;
    if (!isFinite(a) || a <= 0) return null;      // hiperbola/parabola:handled abajo
    var n = Math.sqrt(mu / (a * a * a));          // movimiento medio

    if (Math.abs(e - 1) < 1e-6) return propagarRecta(mu, estado, dt);

    if (e < 1) {
      // anomalia verdadera -> excentrica -> media
      var E0 = 2 * Math.atan2(
        Math.sqrt(1 - e) * Math.sin(estado.nu / 2),
        Math.sqrt(1 + e) * Math.cos(estado.nu / 2)
      );
      var M = E0 - e * Math.sin(E0) + n * dt;
      M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      var E = e < 0.8 ? M : Math.PI;
      for (var i = 0; i < 60; i++) {
        var f = E - e * Math.sin(E) - M;
        var paso = f / (1 - e * Math.cos(E));
        E -= paso;
        if (Math.abs(paso) < 1e-12) break;
      }
      var beta = Math.sqrt(Math.max(0, 1 - e * e));
      var nu = Math.atan2(beta * Math.sin(E), Math.cos(E) - e);
      return desdeElementos(mu, a, e, estado.inc, estado.raan, estado.argp, nu);
    }

    // orbita hiperbolica: ecuacion en la anomalia hiperbolica H
    var H = e < 1.3 ? Math.log(2 / (e + 1)) + (e - 1) / Math.sqrt(e * e - 1) : 0.1;
    var Mh = n * dt;
    for (var j = 0; j < 80; j++) {
      var fh = e * Math.sinh(H) - H - Mh;
      var dh = fh / (e * Math.cosh(H) - 1);
      H -= dh;
      if (Math.abs(dh) < 1e-11) break;
    }
    var g = Math.sqrt(Math.max(0, e * e - 1));
    var nuH = Math.atan2(g * Math.sinh(H), e - Math.cosh(H));
    return desdeElementos(mu, Math.abs(a), e, estado.inc, estado.raan, estado.argp, nuH);
  }

  /** Trayectorias de energia ~ 0: aproximacion lineal. */
  function propagarRecta(mu, estado, dt) {
    var m = desdeElementos(mu, 1e9, 1.0000001, estado.inc, estado.raan, estado.argp, estado.nu);
    return {
      r: [m.r[0] + m.v[0] * dt, m.r[1] + m.v[1] * dt, m.r[2] + m.v[2] * dt],
      v: m.v
    };
  }

  /* =======================================================================
   * MUESTREO DE LA TRAYECTORIA PARA DIBUJAR
   * ==================================================================== */
  function trazar(mu, estado, segmentos) {
    segmentos = segmentos || 180;
    var pts = [], i;
    var a = estado.a, e = estado.e;
    var esElipse = isFinite(a) && a > 0 && e < 0.995;

    if (esElipse) {
      for (i = 0; i <= segmentos; i++) {
        var E = (i / segmentos) * 2 * Math.PI;
        var cosE = Math.cos(E), senE = Math.sin(E);
        var xp = a * (cosE - e);
        var yp = a * Math.sqrt(Math.max(0, 1 - e * e)) * senE;
        pts.push(pasarAInercial([xp, yp, 0], [0, 0, 0], estado.inc, estado.raan, estado.argp).r);
      }
    } else {
      var p = a * (1 - e * e);
      if (!isFinite(p) || p <= 0) p = estado.radio || 1e9;
      var limite = esElipse ? Math.PI : Math.min(Math.acos(-1 / Math.max(1.0001, e)) - 0.02, Math.PI * 0.98);
      for (i = 0; i <= segmentos; i++) {
        var nu = -limite + (2 * limite * i) / segmentos;
        var rr = p / (1 + e * Math.cos(nu));
        var k = Math.sqrt(mu / p);
        pts.push(pasarAInercial(
          [rr * Math.cos(nu), rr * Math.sin(nu), 0],
          [-k * Math.sin(nu), k * (e + Math.cos(nu)), 0],
          estado.inc, estado.raan, estado.argp
        ).r);
      }
    }
    return pts;
  }

  /* =======================================================================
   * DENSIDAD ATMOSFERICA (modelo exponencial)
   * ==================================================================== */
  function densidadAtmosferica(cuerpo, alt) {
    if (alt < 0 || alt > 120000) return 0;
    var esMarte = cuerpo.nombre === 'Marte';
    var escala = esMarte ? 11100 : 8500;          // m
    var base = esMarte ? 0.020 : 1.225;           // kg/m^3
    return base * Math.exp(-alt / escala);
  }

  /** Peso Isp equivalente de una pila de etapas, en segundos. */
  function pesoIsp(etapas) {
    var empuje = 0, flujo = 0;
    for (var i = 0; i < etapas.length; i++) {
      if (etapas[i].propelente <= 0 || etapas[i].isp <= 0) continue;
      empuje += etapas[i].empuje;
      flujo += etapas[i].empuje / (etapas[i].isp * G0);
    }
    return empuje > 0 && flujo > 0 ? (empuje / flujo) / G0 : 0;
  }

  /* =======================================================================
   * PERFIL DE ASCENSO
   * Integra el ascenso con gravedad, arrastre cuadratico y consumo de
   * propelente. Devuelve la trayectoria muestreada y los elementos
   * orbitales resultantes.
   * ==================================================================== */
  function perfilAscenso(cuerpo, etapas, opciones) {
    opciones = opciones || {};
    var dt = opciones.dt || 2;                     // s por paso
    var RAD = cuerpo.R * 1000;                     // radio del cuerpo, m
    var suelo = opciones.suelo != null ? opciones.suelo : RAD;
    var mu = cuerpo.mu;

    var masa = 0;
    for (var q = 0; q < etapas.length; q++) {
      masa += etapas[q].seca + etapas[q].propelente;
    }

    var r = [suelo + 50, 0, 0];
    var v = [0, 0, 0];
    var puntos = [suelo + 50];
    var empujeTotal = etapas.reduce(function (s, e) { return s + e.empuje; }, 0);
    var ispTotal = pesoIsp(etapas);

    var t = 0;
    var quedan = etapas.map(function (e) {
      return e.propInicial != null ? e.propInicial : e.propelente;
    });
    var activas = etapas.map(function () { return true; });
    var alturaMax = 0, apogeo = suelo + 50;

    for (var paso = 0; paso < 4000; paso++) {
      var i;

      var hayCombustible = false;
      for (i = 0; i < etapas.length; i++) {
        if (activas[i] && quedan[i] > 0) hayCombustible = true;
      }
      var empuje = hayCombustible ? empujeTotal : 0;

      var rm = mod3(r) || 1;
      var gm = mu / (rm * rm);
      var ax = -gm * r[0] / rm, ay = -gm * r[1] / rm, az = -gm * r[2] / rm;

      // arrastre cuadratico dentro de la atmosfera
      var dens = densidadAtmosferica(cuerpo, rm - RAD);
      var vmag = mod3(v);
      if (dens > 0 && vmag > 1e-6) {
        var ad = 0.5 * dens * vmag * vmag * 30 / masa;   // 30 m^2 efectivos
        ax -= ad * v[0] / vmag;
        ay -= ad * v[1] / vmag;
        az -= ad * v[2] / vmag;
      }

      // empuje a lo largo de +r
      if (empuje > 0) {
        ax += empuje * r[0] / rm / masa;
        ay += empuje * r[1] / rm / masa;
        az += empuje * r[2] / rm / masa;
      }

      // Euler semi-implicito
      v[0] += ax * dt; v[1] += ay * dt; v[2] += az * dt;
      r[0] += v[0] * dt; r[1] += v[1] * dt; r[2] += v[2] * dt;

      // consumo de propelente repartido entre etapas activas
      if (empuje > 0 && ispTotal > 0) {
        var gastado = (empuje / (ispTotal * G0)) * dt;
        var totalQueda = 0;
        for (i = 0; i < etapas.length; i++) if (activas[i]) totalQueda += quedan[i];
        if (totalQueda > 0) {
          if (gastado > totalQueda) gastado = totalQueda;
          for (i = 0; i < etapas.length; i++) {
            if (!activas[i]) continue;
            var cuota = quedan[i] > 0 ? gastado * (quedan[i] / totalQueda) : 0;
            quedan[i] -= cuota;
            masa -= cuota;
            if (quedan[i] <= 0.01) { quedan[i] = 0; activas[i] = false; }
          }
        }
      }

      t += dt;
      rm = mod3(r);
      if (rm > apogeo) apogeo = rm;
      if (rm - RAD > alturaMax) alturaMax = rm - RAD;
      if (paso % 2 === 0) puntos.push(rm);
      if (t > 900) break;
    }

    var rmF = mod3(r);
    return {
      puntos: puntos,
      alturaFinal: rmF - RAD,
      alturaMax: alturaMax,
      apogeo: apogeo - RAD,
      periapsis: rmF - RAD,
      velocidad: mod3(v),
      masaFinal: masa,
      elementos: aElementos(mu, r, v),
      tiempo: t
    };
  }

  /* =======================================================================
   * API PUBLICA
   * ==================================================================== */
  var ORB = {
    G0: G0,
    AU: AU,
    C_LIGHT: C_LIGHT,
    CUERPOS: CUERPOS,
    rad: rad,
    gra: gra,
    sat: sat,
    mod3: mod3,
    visViva: visViva,
    velocidadEscape: velocidadEscape,
    velocidadCircular: velocidadCircular,
    desdeElementos: desdeElementos,
    aElementos: aElementos,
    avanzar: avanzar,
    trazar: trazar,
    perfilAscenso: perfilAscenso,
    pesoIsp: pesoIsp,
    densidadAtmosferica: densidadAtmosferica
  };

  var CJ = root.CJ || (root.CJ = {});
  CJ.ORB = ORB;

  if (typeof module !== 'undefined' && module.exports) module.exports = ORB;

})(typeof window !== 'undefined' ? window : this);