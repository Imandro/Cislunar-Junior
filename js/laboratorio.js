/* ===========================================================================
 * CISLUNAR JUNIOR - Laboratorio de cohetes (interfaz)
 * Cañon Labs - NASA Space Apps Challenge 2026
 *
 * Interfaz del constructor de vehiculos: permite montar etapas, muestra el
 * presupuesto de masa y delta-v, y simula el ascenso con prediccion de
 * trayectoria. Codigo y diseno originales de Canon Labs.
 * =========================================================================== */
(function (root) {
  'use strict';

  var doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  var VHL = (root.CJ && root.CJ.VHL) || null;
  var ORB = (root.CJ && root.CJ.ORB) || null;
  var G0 = 9.80665;

  // Estado del laboratorio
  var LAB = null;
  var SECCION = 'constructor';   // 'constructor' | 'trayectoria' | 'resumen'
  var LOG = [];

  /* =======================================================================
   * UTILIDADES DE TEXTO
   * ==================================================================== */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmt(n, dec) {
    dec = dec == null ? 0 : dec;
    if (n == null || !isFinite(n)) return '—';
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function kg(n) { return fmt(n) + ' kg'; }
  function mps(n) { return fmt(n) + ' m/s'; }
  function km(n) { return fmt(n / 1000, 1) + ' km'; }

  function registrar(txt, tipo) {
    LOG.unshift({ txt: txt, tipo: tipo || 'g' });
    if (LOG.length > 30) LOG.pop();
  }

  /* =======================================================================
   * PERSISTENCIA (localStorage envuelto en try/catch)
   * ==================================================================== */
  var CLAVE = 'cj-lab-v1';
  function guardar() {
    try {
      if (LAB) localStorage.setItem(CLAVE, JSON.stringify(LAB));
    } catch (e) { /* file:// puede bloquearlo */ }
  }
  function cargar() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && p.etapas && p.etapas.length) ? p : null;
    } catch (e) { return null; }
  }
  function reiniciar() {
    LAB = {
      nombre: 'Mi cohete',
      perfil: 'marte',
      etapas: []
    };
    registrar('Laboratorio reiniciado', 'g');
  }

  /* =======================================================================
   * MODELO DE DATOS DEL LABORATORIO
   * ==================================================================== */
  function presetA(id) {
    const p = VHL.PRESETS[id];
    if (!p) return;
    LAB.nombre = p.nombre;
    LAB.perfil = p.perfil;
    LAB.etapas = JSON.parse(JSON.stringify(p.etapas));
    registrar('Cargado: ' + p.nombre, 'g');
    guardar();
  }

  function anadirEtapa() {
    LAB.etapas.push({ motores: ['RS25'], tanques: ['TRS25'], carga: null, estructural: 0 });
    registrar('Etapa añadida', 'g');
    guardar();
  }
  function quitarEtapa(i) {
    if (LAB.etapas.length <= 1) { registrar('Debe quedar al menos una etapa', 'r'); return; }
    const e = LAB.etapas.splice(i, 1)[0];
    registrar('Etapa retirada', 'w');
    guardar();
  }
  function arriba(i) {
    if (i <= 0) return;
    const t = LAB.etapas; [t[i - 1], t[i]] = [t[i], t[i - 1]];
    guardar();
  }
  function abajo(i) {
    if (i >= LAB.etapas.length - 1) return;
    const t = LAB.etapas; [t[i + 1], t[i]] = [t[i], t[i + 1]];
    guardar();
  }
  function setMotor(i, compId, veces) {
    LAB.etapas[i].motores = veces <= 0 ? [] : new Array(veces).fill(compId);
    guardar();
  }
  function setTanque(i, compId) {
    LAB.etapas[i].tanques = compId ? [compId] : [];
    guardar();
  }
  function setCarga(i, compId) {
    LAB.etapas[i].carga = compId || null;
    guardar();
  }
  function setEstructura(i, kg) {
    LAB.etapas[i].estructural = Math.max(0, kg || 0);
    guardar();
  }
  function setPerfil(p) { LAB.perfil = p; guardar(); }
  function setNombre(n) { LAB.nombre = n; guardar(); }

  /* =======================================================================
   * ANALISIS Y SIMULACION
   * ==================================================================== */
  function analizar() {
    if (!LAB || !LAB.etapas.length) return null;
    try {
      return VHL.analizar({ perfil: LAB.perfil, etapas: LAB.etapas });
    } catch (e) {
      registrar('Error al analizar: ' + (e.message || ''), 'r');
      return null;
    }
  }

  /** Simula el ascenso con las etapas montadas. */
  function simularAscenso() {
    const r = analizar();
    if (!r) return null;
    const etapas = r.etapas.map((e, i) => ({
      seca: e.seca,
      propelente: e.propelente,
      empuje: e.empuje,
      isp: e.isp
    }));
    return ORB.perfilAscenso(ORB.CUERPOS.tierra, etapas, { dt: 2 });
  }

  /* =======================================================================
   * DIBUJO DE LA TRAYECTORIA (canvas)
   * ==================================================================== */
  function pintarTrayectoria(canvas, perfil) {
    if (!canvas || !perfil) return;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width = 720, H = canvas.height = 340;
    const R = ORB.CUERPOS.tierra.R * 1000;

    // Fondo estrellas
    ctx.fillStyle = '#04070c';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.random() * 0.7).toFixed(2) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }

    // Escala: ajustar la altura máxima al alto del canvas
    const altMax = Math.max(perfil.alturaMax, 60000);
    const escala = (H - 60) / (R * (1 + altMax / R));
    const cx = W / 2, cy = H - 24;
    const rPx = R * escala;

    // Tierra (semicírculo)
    const g = ctx.createRadialGradient(cx, cy - rPx * 0.2, rPx * 0.1, cx, cy, rPx);
    g.addColorStop(0, '#6fb7ff'); g.addColorStop(0.4, '#1c5aa6'); g.addColorStop(1, '#0a2a55');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rPx, 0, Math.PI * 2); ctx.fill();

    // Trajectory (perfil.altura a lo largo del tiempo)
    const puntos = perfil.puntos || [];
    if (puntos.length > 1) {
      ctx.strokeStyle = '#8fc9ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      puntos.forEach((alt, idx) => {
        const x = 40 + (W - 80) * (idx / (puntos.length - 1));
        const rr = R + alt;
        const y = cy - (rr - R) * escala;
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Relleno bajo la curva
      ctx.lineTo(W - 40, cy);
      ctx.lineTo(40, cy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(92,184,255,.10)';
      ctx.fill();

      // Nave en el punto mas alto
      const pico = puntos.indexOf(Math.max.apply(null, puntos));
      const px = 40 + (W - 80) * (pico / (puntos.length - 1));
      const py = cy - (R + puntos[pico] - R) * escala;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill();
      // estela
      ctx.strokeStyle = 'rgba(255,200,90,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 12); ctx.stroke();
      // etiqueta apogeo
      ctx.fillStyle = '#8fc9ff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('apogeo ' + km(perfil.apogeo), px, Math.max(14, py - 8));
    }

    // Etiquetas
    ctx.fillStyle = '#5b7fa5';
    ctx.font = '12px ui-monospace,monospace';
    ctx.textAlign = 'left';
    ctx.fillText('altura ' + km(perfil.alturaMax), 12, 20);
    ctx.fillText('velocidad final ' + (perfil.velocidad / 1000).toFixed(2) + ' km/s', 12, 38);
    ctx.textAlign = 'right';
    ctx.fillText('tiempo ' + fmt(perfil.tiempo) + ' s', W - 12, 20);
  }

  /* =======================================================================
   * SELECT OPTIONS
   * ==================================================================== */
  function optsComponentes(filtro) {
    return Object.keys(VHL.COMPONENTES)
      .filter(id => {
        const c = VHL.COMPONENTES[id];
        if (filtro === 'motor') return !!c.empuje;
        if (filtro === 'tanque') return !!c.propelente;
        if (filtro === 'carga') return !!c.masa && !c.empuje && !c.propelente;
        return true;
      })
      .map(id => `<option value="${id}">${esc(VHL.COMPONENTES[id].nombre)}</option>`)
      .join('');
  }

  /* =======================================================================
   * RENDER: CONSTRUCTOR
   * ==================================================================== */
  function renderConstructor(analisis, perfilAsc) {
    const obj = VHL.OBJETIVOS[LAB.perfil] || { dv: 0, nombre: '—' };
    const dvEstado = analisis ? (analisis.dvTotal >= obj.dv ? 'ok2' : 'bd2') : '';
    const twr = analisis ? analisis.twr : 0;
    const twrEstado = twr >= 1 ? 'ok2' : 'bd2';

    let etapasHtml = '';
    LAB.etapas.forEach((e, i) => {
      const motor = e.motores && e.motores.length ? VHL.COMPONENTES[e.motores[0]] : null;
      const cant = e.motores ? e.motores.length : 0;
      const tanque = e.tanques && e.tanques[0] ? VHL.COMPONENTES[e.tanques[0]] : null;
      const carga = e.carga ? VHL.COMPONENTES[e.carga] : null;
      const det = analisis ? analisis.detalle[i] : null;

      etapasHtml += `<div class=et>
        <span class=nm>Etapa ${i + 1} ${i === 0 ? '(inferior)' : i === LAB.etapas.length - 1 ? '(superior)' : ''}</span>
        <select data-lab=motor data-i=${i}>
          <option value=''>— motor —</option>
          ${Object.keys(VHL.COMPONENTES).filter(id => VHL.COMPONENTES[id].empuje).map(id =>
            `<option value=${id} ${motor && motor.id === id ? 'selected' : ''}>${esc(VHL.COMPONENTES[id].nombre)}</option>`).join('')}
        </select>
        <select data-lab=canMot data-i=${i} ${motor ? '' : 'disabled'}>
          ${[1,2,3,4,5,6,7,8,9].map(n => `<option value=${n} ${cant === n ? 'selected' : ''}>${n}×</option>`).join('')}
        </select>
        <select data-lab=tanque data-i=${i}>
          <option value=''>— tanque —</option>
          ${Object.keys(VHL.COMPONENTES).filter(id => VHL.COMPONENTES[id].propelente).map(id =>
            `<option value=${id} ${tanque && tanque.id === id ? 'selected' : ''}>${esc(VHL.COMPONENTES[id].nombre)}</option>`).join('')}
        </select>
        <select data-lab=carga data-i=${i}>
          <option value=''>— carga —</option>
          ${Object.keys(VHL.COMPONENTES).filter(id => VHL.COMPONENTES[id].masa && !VHL.COMPONENTES[id].empuje && !VHL.COMPONENTES[id].propelente).map(id =>
            `<option value=${id} ${carga && carga.id === id ? 'selected' : ''}>${esc(VHL.COMPONENTES[id].nombre)}</option>`).join('')}
        </select>
        <input type=number data-lab=estr data-i=${i} value=${e.estructural||0} min=0 step=1000 style='width:82px;background:#0b0f14;color:#e6edf5;border:1px solid #2a3440;border-radius:6px;padding:4px 6px;font:inherit;font-size:12px' title='estructura (kg)' placeholder='estruct.'>
        <div class=sm style='width:100%;color:#5b7fa5'>${det ?
          `Δv ${fmt(det.dv)} m/s · empuje ${(det.empuje/1e6).toFixed(2)} MN · TWR ${det.twr.toFixed(2)}` : '—'}</div>
        <div class=sm style='width:100%'>
          <button class=x data-lab=up data-i=${i} ${i===0?'disabled':''}>↑</button>
          <button class=x data-lab=down data-i=${i} ${i===LAB.etapas.length-1?'disabled':''}>↓</button>
          <button class=x data-lab=rm data-i=${i} ${LAB.etapas.length<=1?'disabled':''}>Quitar</button>
        </div>
      </div>`;
    });

    return `
      <div class=lgs2>
        ${Object.keys(VHL.PRESETS).filter(k=>k!=='apoloSimple').map(k =>
          `<div class='chip ${LAB.perfil===VHL.PRESETS[k].perfil?'on':''}' data-lab=preset data-v=${k}>${esc(VHL.PRESETS[k].nombre)}</div>`).join('')}
        <div class='chip' data-lab=add>+ Etapa</div>
      </div>

      <div class=lgs2>
        <span style='font-size:12px;color:#8a9bad'>Nombre:</span>
        <input value="${esc(LAB.nombre)}" data-lab=nombre style='background:#0b0f14;color:#e6edf5;border:1px solid #2a3440;border-radius:6px;padding:5px 8px;font:inherit;font-size:13px;width:180px'>
        <span style='font-size:12px;color:#8a9bad'>Perfil:</span>
        <select data-lab=perfil style='background:#0b0f14;color:#e6edf5;border:1px solid #2a3440;border-radius:6px;padding:5px;font:inherit;font-size:12px'>
          ${Object.keys(VHL.OBJETIVOS).map(p=>`<option value=${p} ${LAB.perfil===p?'selected':''}>${esc(p)} (${fmt(VHL.OBJETIVOS[p].dv)} m/s)</option>`).join('')}
        </select>
      </div>

      ${etapasHtml}

      <div class=vres>
        <h4>Presupuesto</h4>
        <div class=mm>
          <div><span>Masa total</span><b>${analisis ? kg(analisis.masaTotal) : '—'}</b></div>
          <div><span>Δv total</span><b class=${dvEstado}>${analisis ? fmt(analisis.dvTotal) + ' m/s' : '—'}</b></div>
          <div><span>Objetivo (${esc(obj.nombre)})</span><b>${fmt(obj.dv)} m/s</b></div>
          <div><span>TWR de despegue</span><b class=${twrEstado}>${analisis ? twr.toFixed(2) : '—'}</b></div>
          <div><span>Isp efectivo</span><b>${analisis ? fmt(analisis.ispEfectivo) + ' s' : '—'}</b></div>
          <div><span>Carga útil</span><b>${analisis ? kg(analisis.cargaUtil) : '—'}</b></div>
        </div>
        ${analisis && analisis.motivoFallo ? `<p class='w a' style='margin:8px 0 0'><b>PENDIENTE</b> ${esc(analisis.motivoFallo)}</p>` : ''}
        ${analisis && !analisis.motivoFallo ? `<p style='margin:8px 0 0;color:#4fd18b'><b>LISTO</b> El diseño cumple el objetivo de la misión.</p>` : ''}
        ${analisis && analisis.aviso ? `<p class=w style='margin:6px 0 0'><b>AVISO</b> ${esc(analisis.aviso)}</p>` : ''}
      </div>

      <div style='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0'>
        <button class=vbtn data-lab=tab data-v=trayectoria>Predecir trayectoria →</button>
        <button class=vbtn g data-lab=guardar>Guardar diseño</button>
        <button class=vbtn g data-lab=reset>Reiniciar</button>
      </div>

      <div class=vlog>${LOG.map(l=>`<p class=${l.tipo+'2'}>${esc(l.txt)}</p>`).join('')}</div>
    `;
  }

  /* =======================================================================
   * RENDER: TRAYECTORIA
   * ==================================================================== */
  function renderTrayectoria(analisis, perfilAsc) {
    return `
      <p class=mu style='font-size:13px'>Simulación de ascenso con gravedad, arrastre atmosférico y consumo de propelente.</p>
      <canvas id=labCanvas width=720 height=340></canvas>
      ${perfilAsc ? `<div class=vres><div class=mm>
        <div><span>Altura máxima</span><b>${km(perfilAsc.alturaMax)}</b></div>
        <div><span>Apogeo alcanzado</span><b>${km(perfilAsc.apogeo)}</b></div>
        <div><span>Velocidad final</span><b>${(perfilAsc.velocidad/1000).toFixed(2)} km/s</b></div>
        <div><span>Tiempo de vuelo</span><b>${fmt(perfilAsc.tiempo)} s</b></div>
        <div><span>Masa restante</span><b>${kg(perfilAsc.masaFinal)}</b></div>
        <div><span>Excentricidad</span><b>${perfilAsc.elementos && isFinite(perfilAsc.elementos.e) ? perfilAsc.elementos.e.toFixed(3) : '—'}</b></div>
      </div></div>` : '<p class=mu>Sin datos de simulación.</p>'}
      <div style='display:flex;gap:8px;margin:10px 0'>
        <button class=vbtn g data-lab=tab data-v=constructor>← Volver al constructor</button>
      </div>
      <div class=vlog>${LOG.map(l=>`<p class=${l.tipo+'2'}>${esc(l.txt)}</p>`).join('')}</div>
    `;
  }

  /* =======================================================================
   * RENDER PRINCIPAL
   * ==================================================================== */
  function render(container) {
    if (!container) return;
    if (!LAB) LAB = cargar() || { nombre: 'Mi cohete', perfil: 'marte', etapas: [{ motores: ['VTVL'], tanques: ['TVTVL'], carga: 'HAB', estructural: 60000 }] };

    const analisis = analizar();
    const perfilAsc = SECCION === 'trayectoria' ? simularAscenso() : null;

    let contenido;
    if (SECCION === 'trayectoria') contenido = renderTrayectoria(analisis, perfilAsc);
    else contenido = renderConstructor(analisis, null);

    container.innerHTML = `
      <div class=wrap lc>
        <div class=top><h1>Laboratorio de cohetes</h1><button class='btn g' data-lab=salir>← Volver al menú</button></div>
        <h2>${esc(LAB.nombre)}</h2>
        ${contenido}
      </div>`;

    if (SECCION === 'trayectoria') {
      const c = container.querySelector('#labCanvas');
      pintarTrayectoria(c, perfilAsc);
    }
  }

  /* =======================================================================
   * EVENTOS
   * ==================================================================== */
  function conectarEventos(container) {
    // Cambios en selects e inputs
    container.addEventListener('change', ev => {
      const t = ev.target.closest('[data-lab]');
      if (!t) return;
      const tipo = t.dataset.lab;
      const i = parseInt(t.dataset.i, 10);
      const v = t.value;
      if (tipo === 'motor') {
        setMotor(i, v || null, 1);
        registrar(v ? 'Etapa ' + (i + 1) + ': motor cambiado' : 'Etapa ' + (i + 1) + ': sin motor', 'w');
      } else if (tipo === 'canMot') {
        const cur = LAB.etapas[i].motores[0];
        if (cur) setMotor(i, cur, parseInt(v, 10));
      } else if (tipo === 'tanque') {
        setTanque(i, v || null);
        registrar(v ? 'Etapa ' + (i + 1) + ': tanque cambiado' : 'Etapa ' + (i + 1) + ': sin tanque', 'w');
      } else if (tipo === 'carga') {
        setCarga(i, v || null);
      } else if (tipo === 'estr') {
        setEstructura(i, parseInt(v, 10));
      } else if (tipo === 'perfil') {
        setPerfil(v);
      } else if (tipo === 'nombre') {
        setNombre(v);
      }
      render(container);
    });

    // Clics en botones/chips
    container.addEventListener('click', ev => {
      const b = ev.target.closest('[data-lab]');
      if (!b) return;
      const tipo = b.dataset.lab;
      const i = parseInt(b.dataset.i, 10);
      const v = b.dataset.v;
      if (tipo === 'add') { anadirEtapa(); }
      else if (tipo === 'rm') { quitarEtapa(i); }
      else if (tipo === 'up') { arriba(i); }
      else if (tipo === 'down') { abajo(i); }
      else if (tipo === 'preset') { presetA(v); SECCION = 'constructor'; }
      else if (tipo === 'tab') { SECCION = v; }
      else if (tipo === 'guardar') { guardar(); registrar('Diseño guardado', 'g'); }
      else if (tipo === 'reset') { reiniciar(); SECCION = 'constructor'; }
      render(container);
    });
  }

  var API = {
    montar: function (container) {
      render(container);
      conectarEventos(container);
    },
    render: render,
    conectarEventos: conectarEventos
  };

  var CJ = root.CJ || (root.CJ = {});
  CJ.LAB = API;

})(typeof window !== 'undefined' ? window : this);