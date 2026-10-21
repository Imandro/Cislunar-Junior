const fs = require('fs');
const path = 'Cislunar Junior - Cañon Labs.html';
let content = fs.readFileSync(path, 'utf8');

const newPintar = `function pintar() {
  if (MODO !== 'juego' || !S) return;
  var vis = $('visor'), cv = $('cv'), glc = $('gl');
  if (!vis || !cv) return;
  var d = dimensionar();
  if (!d) return;
  var W = d.w, H = d.h;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr));
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  var X = cv.getContext('2d');
  X.setTransform(dpr, 0, 0, dpr, 0, 0);
  var nomVis = M[S.m].v;

  // === MODO VUELO MANUAL ===
  if (S.phase === 'flight' && S.flightState) {
    if (VM === 0) {
      var info = escena3D();
      MD2.info[info.set].nom = info.nom;
      nomVis = info.nom;

      // Actualizar cámara libre si está activa
      var now = performance.now() / 1000;
      if (!pintar._lastTime) pintar._lastTime = now;
      var dt = now - pintar._lastTime;
      pintar._lastTime = now;
      actualizarCamaraLibre(dt, info);

      var viewParams = buildViewMatrix(info);
      var distCam, pitCam, fovG, asp;

      if (R3D) {
        glc.style.display = 'block';
        asp = R3D.ajustar(W, H);
        R3D.fondo(4, 7, 12);
        fovG = 2 * Math.atan(1 / (4.128 * ZM));

        var geo = [];
        geo.push({ clave: 'estrellas', polys: FONDO.estrellas });
        if (info.terreno) geo.push({ clave: 's-' + info.terreno, polys: FONDO[info.terreno] });
        if (info.planeta) {
          var fp = info.planeta === 'tierra' ? 1 : info.planeta === 'luna' ? 0.66 : 0.95;
          var tf = Math.tan(fovG / 2), DP = 900;
          var px = 0.68 * asp * tf, py = 0.6 * tf, pl = Math.sqrt(px * px + py * py + 1);
          geo.push({
            clave: 'p-' + info.planeta, polys: FONDO[info.planeta],
            off: [px / pl * DP, py / pl * DP, -DP / pl],
            esc: DP * 0.38 * fp * tf / FONDO.planR[info.planeta]
          });
        }
        geo.push({ clave: 'v-' + info.set + '-' + info.tk, polys: MD2.polys(info.set, info.t) });

        if (CAM_MODE === 'free') {
          var viewMat = viewParams;
          R3D.dibujar(
            { viewMatrix: viewMat, fov: fovG, aspecto: asp },
            geo, { cielo: [4, 7, 12], niebla: 3000, brillo: 1 });
          pitCam = PIT;
        } else {
          distCam = info.ft[1] * 2.4;
          pitCam = viewParams.pit;
          R3D.dibujar(
            { foco: viewParams.foco, dist: viewParams.dist,
              fov: fovG, aspecto: asp, yaw: viewParams.yaw, pit: viewParams.pit },
            geo, { cielo: [4, 7, 12], niebla: 3000, brillo: 1 });
        }
        X.clearRect(0, 0, W, H);
      } else {
        glc.style.display = 'none';
        var pitCam2D = (CAM_MODE === 'free') ? PIT : (viewParams.pit || PIT);
        pintar3D2D(X, info, W, H, pitCam2D);
      }

      // === HUD DE VUELO (reemplaza reticula normal) ===
      if (CJ.HUD && CJ.HUD.draw) {
        // Obtener checklist actual para la etapa
        var checklist = [];
        if (CJ.STG && CJ.STG.getItemsForStage && S.flightState.stage !== undefined) {
          checklist = CJ.STG.getItemsForStage(S.flightState.stage);
        }
        CJ.HUD.draw(S.flightState, S.flightState.optimo || {}, checklist);
      }
    } else {
      glc.style.display = 'none';
      X.clearRect(0, 0, W, H);
      // Fallback 2D en modo vuelo
      if (CJ.HUD && CJ.HUD.draw) {
        var checklist = [];
        if (CJ.STG && CJ.STG.getItemsForStage && S.flightState.stage !== undefined) {
          checklist = CJ.STG.getItemsForStage(S.flightState.stage);
        }
        CJ.HUD.draw(S.flightState, S.flightState.optimo || {}, checklist);
      }
    }

    // Overlay de pausa
    if (S.phase === 'paused') {
      X.fillStyle = 'rgba(10,15,22,0.95)';
      X.fillRect(0, 0, W, H);
      X.fillStyle = '#5cb8ff';
      X.font = 'bold 24px "Orbitron", monospace';
      X.textAlign = 'center';
      X.fillText('⏸ PAUSA', W/2, H/2);
      X.font = '12px "Orbitron", monospace';
      X.fillStyle = '#8a9bad';
      X.fillText('[P] Reanudar  [H] Asistencia  [R] Reset Att  [C] Cámara', W/2, H/2 + 40);
    }

    var tg = $('vtag');
    if (tg && tg.textContent !== nomVis) tg.textContent = nomVis;
    var hi = $('vhint');
    var txtHi = 'VUELO MANUAL: WASD/Arrows pitch+yaw | Q/E roll | Shift/Space throttle | H asistencia | C cámara | R reset | P pausa | Enter/Space checklist';
    if (hi && hi.textContent !== txtHi) hi.textContent = txtHi;
    return;
  }

  // === MODO DECISIÓN NORMAL ===
  if (VM === 0) {
    var info = escena3D();
    MD2.info[info.set].nom = info.nom;
    nomVis = info.nom;

    // Actualizar cámara libre si está activa
    var now = performance.now() / 1000;
    if (!pintar._lastTime) pintar._lastTime = now;
    var dt = now - pintar._lastTime;
    pintar._lastTime = now;
    actualizarCamaraLibre(dt, info);

    var viewParams = buildViewMatrix(info);
    var distCam, pitCam, fovG, asp;

    if (R3D) {
      glc.style.display = 'block';
      asp = R3D.ajustar(W, H);
      R3D.fondo(4, 7, 12);
      fovG = 2 * Math.atan(1 / (4.128 * ZM));

      var geo = [];
      geo.push({ clave: 'estrellas', polys: FONDO.estrellas });
      if (info.terreno) geo.push({ clave: 's-' + info.terreno, polys: FONDO[info.terreno] });
      if (info.planeta) {
        var fp = info.planeta === 'tierra' ? 1 : info.planeta === 'luna' ? 0.66 : 0.95;
        var tf = Math.tan(fovG / 2), DP = 900;
        var px = 0.68 * asp * tf, py = 0.6 * tf, pl = Math.sqrt(px * px + py * py + 1);
        geo.push({
          clave: 'p-' + info.planeta, polys: FONDO[info.planeta],
          off: [px / pl * DP, py / pl * DP, -DP / pl],
          esc: DP * 0.38 * fp * tf / FONDO.planR[info.planeta]
        });
      }
      geo.push({ clave: 'v-' + info.set + '-' + info.tk, polys: MD2.polys(info.set, info.t) });

      if (CAM_MODE === 'free') {
        var viewMat = viewParams;
        R3D.dibujar(
          { viewMatrix: viewMat, fov: fovG, aspecto: asp },
          geo, { cielo: [4, 7, 12], niebla: 3000, brillo: 1 });
        pitCam = PIT;
      } else {
        distCam = info.ft[1] * 2.4;
        pitCam = viewParams.pit;
        R3D.dibujar(
          { foco: viewParams.foco, dist: viewParams.dist,
            fov: fovG, aspecto: asp, yaw: viewParams.yaw, pit: viewParams.pit },
          geo, { cielo: [4, 7, 12], niebla: 3000, brillo: 1 });
      }
      X.clearRect(0, 0, W, H);
    } else {
      glc.style.display = 'none';
      var pitCam2D = (CAM_MODE === 'free') ? PIT : (viewParams.pit || PIT);
      pintar3D2D(X, info, W, H, pitCam2D);
    }

    if (CAB) CAB.reticula(X, W, H, lecturas(), CAM_MODE);
  } else {
    glc.style.display = 'none';
    X.clearRect(0, 0, W, H);
    if (VM === 1) SCN[escenaActual()](X, W, H, ANIM, T);
    else dibujaTrayectoria(X, W, H, S.m, c01((S.i + ANIM) / M[S.m].e.length), T);
  }

  var tg = $('vtag');
  if (tg && tg.textContent !== nomVis) tg.textContent = nomVis;
  var hi = $('vhint');
  var txtHi = VM === 0 ?
    (CAM_MODE === 'free' ? 'WASD mover · Arrastrar rotar · Rueda FOV · C alternar · R reset' :
                         'Arrastra para rotar · rueda para acercar · C modo libre') :
    VM === 1 ? 'Animación 2D de la fase' : 'Ruta orbital y distancia';
  if (hi && hi.textContent !== txtHi) hi.textContent = txtHi;
}`;

const start = content.indexOf('function pintar() {');
const end = content.indexOf('function bucle(ts) {');
content = content.substring(0, start) + newPintar + '\n\n' + content.substring(end);

fs.writeFileSync(path, content, 'utf8');
console.log('pintar() function replaced successfully');