/* ===========================================================================
 * CISLUNAR JUNIOR - Nucleo de renderizado WebGL
 * Canon Labs - NASA Space Apps Challenge 2026
 *
 * Motor 3D propio sobre WebGL:
 *   - shaders GLSL con iluminacion por normal y especular
 *   - matrices de perspectiva y vista escritas desde cero
 *   - conversion de la geometria procedural (fr/bx) a buffers de GPU
 *   - texturas aunque se generen a partir de canvas 2D
 *   - separacion entre superficies opacas y translucidas
 *
 * Codigo original de Canon Labs. Sin dependencias externas.
 * =========================================================================== */
(function (root) {
  'use strict';

  /* =======================================================================
   * MATRICES 4x4 (orden columna mayor, como espera WebGL)
   * ==================================================================== */
  var M = {
    ident: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },

    /** Proyeccion perspectiva. fovY en radianes. */
    perspectiva: function (fovY, aspecto, cerca, lejos) {
      var f = 1 / Math.tan(fovY / 2);
      var nf = 1 / (cerca - lejos);
      return new Float32Array([
        f / aspecto, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (cerca + lejos) * nf, -1,
        0, 0, 2 * cerca * lejos * nf, 0
      ]);
    },

    /** Translation. */
    traslacion: function (x, y, z) {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    },

    /** Rotacion en el eje Y. */
    rotY: function (a) {
      var c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    },

    /** Rotacion en el eje X. */
    rotX: function (a) {
      var c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    },

    /** Rotacion en el eje Z. */
    rotZ: function (a) {
      var c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    },

    /**
     * Escala por eje. Con (1,1,-1) refleja el mundo en Z: convierte la
     * convencion de profundidad del respaldo 2D (la mirada va hacia +Z) en la
     * de OpenGL (la mirada va hacia -Z) sin alterar el encuadre.
     */
    escala: function (x, y, z) {
      return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
    },

    /** Producto A*B. */
    mul: function (A, B) {
      var r = new Float32Array(16);
      for (var c = 0; c < 4; c++) {
        for (var f = 0; f < 4; f++) {
          r[c * 4 + f] =
            A[0 * 4 + f] * B[c * 4 + 0] +
            A[1 * 4 + f] * B[c * 4 + 1] +
            A[2 * 4 + f] * B[c * 4 + 2] +
            A[3 * 4 + f] * B[c * 4 + 3];
        }
      }
      return r;
    },

    /** Normal de una cara (producto cruz), para iluminacion. */
    normalCara: function (a, b, c) {
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy;
      var ny = uz * vx - ux * vz;
      var nz = ux * vy - uy * vx;
      var l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    }
  };

  /* =======================================================================
   * SHADERS
   * ==================================================================== */
  var VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'attribute vec4 aCol;',
    'uniform mat4 uMVP;',
    'varying vec4 vCol;',
    'varying vec3 vNor;',
    'varying vec3 vPos;',
    'void main(){',
    '  vec4 p = uMVP * vec4(aPos,1.0);',
    '  gl_Position = p;',
    '  vCol = aCol;',
    '  vNor = (mat3(uMVP) * aNor);',
    '  vPos = p.xyz;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec4 vCol;',
    'varying vec3 vNor;',
    'varying vec3 vPos;',
    'uniform vec3 uLuz;',
    'uniform vec3 uLuz2;',
    'uniform vec3 uCam;',
    'uniform vec4 uNeblina;',   // rgb color, a = densidad
    'uniform float uBrillo;',
    'void main(){',
    '  vec3 n = normalize(vNor);',
    '  if(!gl_FrontFacing) n = -n;',
    // difusa clave
    '  float d1 = max(dot(n,uLuz),0.0);',
    // relleno desde el lado opuesto
    '  float d2 = max(dot(n,uLuz2),0.0);',
    // especular (Blinn-Phong)
    '  vec3 v = normalize(uCam - vPos);',
    '  vec3 h = normalize(uLuz + v);',
    '  float sp = pow(max(dot(n,h),0.0), 26.0) * 0.35;',
    // ambiente
    '  float amb = 0.30;',
    '  float luz = amb + 0.72*d1 + 0.26*d2 + sp;',
    '  vec3 rgb = vCol.rgb * luz * uBrillo;',
    // niebla de distancia hacia el color de fondo
    '  float dist = length(vPos - uCam);',
    '  float f = clamp((dist - uNeblina.a*0.35) / (uNeblina.a*1.6), 0.0, 0.75);',
    '  rgb = mix(rgb, uNeblina.rgb, f);',
    '  gl_FragColor = vec4(rgb, vCol.a);',
    '}'
  ].join('\n');

  // Variante con textura (monitores)
  var VS_TEX = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'attribute vec4 aCol;',
    'attribute vec2 aUV;',
    'uniform mat4 uMVP;',
    'varying vec4 vCol;',
    'varying vec3 vNor;',
    'varying vec2 vUV;',
    'varying vec3 vPos;',
    'void main(){',
    '  vec4 p = uMVP * vec4(aPos,1.0);',
    '  gl_Position = p;',
    '  vCol = aCol;',
    '  vNor = (mat3(uMVP) * aNor);',
    '  vUV = aUV;',
    '  vPos = p.xyz;',
    '}'
  ].join('\n');

  var FS_TEX = [
    'precision mediump float;',
    'varying vec4 vCol;',
    'varying vec3 vNor;',
    'varying vec2 vUV;',
    'varying vec3 vPos;',
    'uniform sampler2D uTex;',
    'uniform vec3 uLuz;',
    'uniform vec3 uCam;',
    'uniform float uMono;',      // 0 = usa el color de la textura
    'void main(){',
    '  vec4 t = texture2D(uTex, vUV);',
    '  vec3 n = normalize(vNor);',
    '  if(!gl_FrontFacing) n = -n;',
    '  float d = max(dot(n,uLuz),0.0);',
    '  vec3 base = mix(vCol.rgb, t.rgb, uMono);',
    '  /* Con uMono>0.5 la superficie es una pantalla: emite su propia luz y no',
    '   * debe oscurecerse con la orientación, o los monitores de cabina se ven',
    '   * negros mirándolos de frente. */',
    '  float luz = (uMono > 0.5) ? 1.0 : (0.62 + 0.48*d);',
    '  gl_FragColor = vec4(base*luz, vCol.a * (uMono>0.5 ? 1.0 : t.a));',
    '}'
  ].join('\n');

  /* =======================================================================
   * COMPILACION
   * ==================================================================== */
  function compilar(gl, tipo, fuente) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader: ' + err);
    }
    return s;
  }

  function programa(gl, vs, fs) {
    var p = gl.createProgram();
    var a = compilar(gl, gl.VERTEX_SHADER, vs);
    var b = compilar(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, a); gl.attachShader(p, b);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Link: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(a); gl.deleteShader(b);
    return p;
  }

  /* =======================================================================
   * RENDERIZADOR
   * ==================================================================== */
  function crear(canvas) {
    var gl = null;
    try {
      var opciones = { alpha: true, antialias: true, depth: true,
                      preserveDrawingBuffer: true, premultipliedAlpha: false };
      gl = canvas.getContext('webgl', opciones) ||
           canvas.getContext('experimental-webgl', opciones);
    } catch (e) { gl = null; }
    if (!gl) return null;   // sin WebGL: el llamador usa el fallback

    var prog;
    var progTex;
    try {
      prog = programa(gl, VS, FS);
      progTex = programa(gl, VS_TEX, FS_TEX);
    } catch (e) {
      return null;
    }

    // cache de geometrias ya subidas, por clave
    var cache = {};

    gl.enable(gl.DEPTH_TEST);
    // Se pintan las dos caras: la geometría procedural del simulador se genera
    // con ambos sentidos de giro y el shader ya corrige la normal en la cara
    // trasera (gl_FrontFacing), así que el recorte solo traería caras ausentes.
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /* -------------------------------------------------------------------
     * CONVERSION DE GEOMETRIA
     * polys: [{v:[[x,y,z]..], c:[r,g,b,a,brillo], n?:[nx,ny,nz]}]
     * `n` es opcional: si viene, se usa en lugar de la normal geométrica
     * (lo emplea la cúpula de estrellas para iluminarse por igual).
     * Devuelve buffers WebGL reutilizables.
     * ----------------------------------------------------------------- */
    function construir(polys) {
      var n = polys.length;
      if (!n) return null;

      // Cuenta vertices totales admitiendo triangulos y cuadrilateros
      var total = 0, i;
      for (i = 0; i < n; i++) {
        var k = polys[i].v.length;
        if (k >= 3) total += (k - 2) * 3;
      }
      if (!total) return null;

      var pos = new Float32Array(total * 3);
      var nor = new Float32Array(total * 3);
      var col = new Float32Array(total * 4);
      var uvs = new Float32Array(total * 2);
      var idx = new (total > 65535 ? Uint32Array : Uint16Array)(total);

      var vi = 0, ii = 0;

      for (i = 0; i < n; i++) {
        var g = polys[i];
        var vs = g.v;
        if (vs.length < 3) continue;
        var c = g.c || [200, 200, 205, .9, 40];
        var nv = g.n || M.normalCara(vs[0], vs[1], vs[2]);

        var base = vi;
        for (var j = 0; j < vs.length; j++) {
          pos[vi * 3 + 0] = vs[j][0];
          pos[vi * 3 + 1] = vs[j][1];
          pos[vi * 3 + 2] = vs[j][2];
          /* La normal sale del mismo orden de vértices que usa el respaldo 2D
           * (`nrm`). Cualquier "corrección" de signo basada en el grosor del
           * polígono es ruido de coma flotante: en una cara plana cada término
           * es perpendicular a la normal y el producto es ~1e-16, con lo que el
           * signo quedaba al azar y el iluminado salía a manchas. */
          nor[vi * 3 + 0] = nv[0];
          nor[vi * 3 + 1] = nv[1];
          nor[vi * 3 + 2] = nv[2];
          col[vi * 4 + 0] = c[0] / 255;
          col[vi * 4 + 1] = c[1] / 255;
          col[vi * 4 + 2] = c[2] / 255;
          col[vi * 4 + 3] = (c.length > 3 ? c[3] : 1);
          uvs[vi * 2 + 0] = (j === 1 || j === 2) ? 1 : 0;
          /* Los canvases empiezan arriba; en WebGL v=0 está abajo. Esta
           * inversión explícita mantiene la interfaz derecha sin depender del
           * flip global de la textura. */
          uvs[vi * 2 + 1] = (j >= 2) ? 0 : 1;
          vi++;
        }

        // Abanico de triangulos
        for (var f = 1; f < vs.length - 1; f++) {
          idx[ii++] = base;
          idx[ii++] = base + f;
          idx[ii++] = base + f + 1;
        }
      }

      if (!vi || !ii) return null;

      /* Cada geometría conserva sus propios buffers. Antes todas compartían los
       * mismos cinco buffers, con lo que `subir` los sobrescribía con la última
       * pieza del conjunto: solo esa se dibujaba bien y el resto se leía con los
       * índices y el recuento ajenos, saliendo invisible o con
       * INVALID_OPERATION. Con la cúpula de estrellas añadida al conjunto el
       * fallo quedó al descubierto. */
      var bP = gl.createBuffer(), bN = gl.createBuffer(),
          bC = gl.createBuffer(), bU = gl.createBuffer(), bI = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, bP);
      gl.bufferData(gl.ARRAY_BUFFER, pos.subarray(0, vi * 3), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bN);
      gl.bufferData(gl.ARRAY_BUFFER, nor.subarray(0, vi * 3), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bC);
      gl.bufferData(gl.ARRAY_BUFFER, col.subarray(0, vi * 4), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bU);
      gl.bufferData(gl.ARRAY_BUFFER, uvs.subarray(0, vi * 2), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, ii), gl.STATIC_DRAW);

      return { pos: bP, nor: bN, col: bC, uv: bU, idx: bI, n: ii,
               tipo: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    }

    /** Agrupa y sube un conjunto de piezas identified por clave. */
    function subir(clave, polys) {
      if (cache[clave]) return cache[clave];
      var d = construir(polys);
      if (d) cache[clave] = d;
      return d;
    }

    /* -------------------------------------------------------------------
     * TEXTURAS
     * ----------------------------------------------------------------- */
    function crearTextura(cv) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (cv) actualizarTextura(t, cv);
      return t;
    }

    function actualizarTextura(tex, cv) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      /* La orientación vertical se define explícitamente en las UV del quad.
       * Mantener apagado el flip evita que el estado global de WebGL cambie
       * el resultado según la implementación del navegador. */
      if (typeof gl.pixelStorei === 'function') {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    }

    /* -------------------------------------------------------------------
     * DIBUJO
     * ----------------------------------------------------------------- */
    function ajustar(an, al) {
      var dpr = Math.min(root.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(an * dpr));
      var h = Math.max(1, Math.round(al * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      return w / h;
    }

    function fondo(r, g, b, transparente) {
      gl.clearColor(r / 255, g / 255, b / 255, transparente ? 0 : 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /* -------------------------------------------------------------------
     * Matriz de vista.
     *
     * `soloVista` deja la cámara en el origen: la geometría se interpreta en
     * coordenadas de cámara (x derecha, y arriba, z negativo hacia delante) sin
     * la traslación al foco ni el alejamiento `dist`. Es lo que permite pegar
     * la cabina y sus monitores a la cabeza del piloto: se mueven con el giro
     * y el cabeceo, pero no con la distancia al vehículo.
     * ----------------------------------------------------------------- */
    function matrizVista(cam, solo) {
      var base = M.mul(M.mul(M.rotX(-cam.pit || 0), M.rotY(-cam.yaw || 0)),
                       M.escala(1, 1, -1));
      if (solo) return base;
      return M.mul(M.traslacion(0, 0, -cam.dist),
                   M.mul(base, M.traslacion(-cam.foco[0], -cam.foco[1], -cam.foco[2])));
    }

    /** Posición de la cámara en el mundo (inversa de la vista sobre el origen). */
    function posicionCam(cam) {
      var cp = Math.cos(cam.pit || 0), sp = Math.sin(cam.pit || 0);
      var cy = Math.cos(cam.yaw || 0), sy = Math.sin(cam.yaw || 0);
      return [cam.foco[0] + sy * cp * cam.dist,
              cam.foco[1] - sp * cam.dist,
              cam.foco[2] - cy * cp * cam.dist];
    }

    /**
     * Dibuja un conjunto de piezas.
     * cam: {foco:[x,y,z], dist, fov, yaw, pit}
     * geo: array de {clave, polys}
     * opciones: {cielo:[r,g,b], niebla, brillo}
     */
    function dibujar(cam, geo, opciones) {
      opciones = opciones || {};
      gl.useProgram(prog);

      var loc = {
        mvp: gl.getUniformLocation(prog, 'uMVP'),
        luz: gl.getUniformLocation(prog, 'uLuz'),
        luz2: gl.getUniformLocation(prog, 'uLuz2'),
        cam: gl.getUniformLocation(prog, 'uCam'),
        neb: gl.getUniformLocation(prog, 'uNeblina'),
        br: gl.getUniformLocation(prog, 'uBrillo')
      };

      var proj = M.perspectiva(cam.fov, cam.aspecto, 0.5, 4000);
      /* La cámara orbital del simulador queda definida por el respaldo 2D:
       *   1. el foco pasa al origen del mundo,
       *   2. se refleja en Z (aquel respaldo mira hacia +Z, OpenGL hacia -Z),
       *   3. se aplica la órbita yaw/pit,
       *   4. por último se aleja el conjunto `dist` para situar la cámara.
       * El orden importa: si la traslación de distancia va después de la
       * rotación, el foco se sale del encuadre; si va antes sin el reflejo,
       * el modelo queda detrás de la cámara y todo se recorta. */
      var vista = matrizVista(cam, opciones.soloVista);
      var mvpBase = M.mul(proj, vista);

      gl.uniform3f(loc.luz, 0.42, 0.68, 0.86);
      gl.uniform3f(loc.luz2, -0.55, -0.32, 0.42);
      var posCam = opciones.soloVista ? [0, 0, 0] : posicionCam(cam);
      gl.uniform3f(loc.cam, posCam[0], posCam[1], posCam[2]);
      var neb = opciones.cielo || [4, 7, 12];
      gl.uniform4f(loc.neb, neb[0] / 255, neb[1] / 255, neb[2] / 255,
        opciones.niebla || 600);
      gl.uniform1f(loc.br, opciones.brillo == null ? 1 : opciones.brillo);

      gl.enableVertexAttribArray(0);          // aPos
      gl.enableVertexAttribArray(1);          // aNor
      gl.enableVertexAttribArray(2);          // aCol

      // Opacas primero (con escritura de profundidad), translucidas despues
      var opacas = [], transl;
      geo.forEach(function (g) {
        var d = subir(g.clave, g.polys);
        if (!d) return;
        (g.translucido ? transl : opacas).push({ d: d, off: g.off, esc: g.esc });
      });

      /* Cada pieza trae sus propios buffers: hay que enlazarlos otra vez antes
       * de dibujar, porque entre lote y lote se cambia el ELEMENT_ARRAY_BUFFER
       * y los arrays de atributos. `off`/`esc` desplazan y escalan el lote en
       * el espacio de la vista, que es como se colocan los planetas de fondo. */
      function lote(it) {
        var d = it.d;
        gl.bindBuffer(gl.ARRAY_BUFFER, d.pos);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, d.nor);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, d.col);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idx);
        /* `off`/`esc` se aplican DESPUÉS de la vista (proj·vista·m), no antes:
         * con proj·(m·vista) el reflejo en Z de la vista quedaba el último y
         * todo lo colocado así salía con w negativa, fuera del plano cercano,
         * así que se recortaba sin que nadie lo viera. */
        if (it.off || it.esc) {
          var m = M.ident();
          if (it.off) m = M.mul(m, M.traslacion(it.off[0], it.off[1], it.off[2]));
          if (it.esc) m = M.mul(m, M.escala(it.esc, it.esc, it.esc));
          gl.uniformMatrix4fv(loc.mvp, false, M.mul(mvpBase, m));
        } else {
          gl.uniformMatrix4fv(loc.mvp, false, mvpBase);
        }
        gl.drawElements(gl.TRIANGLES, d.n, d.tipo, 0);
      }

      /* La cabina se pinta encima del mundo sin recortarse contra él: el
       *_DEPTH_TEST_ se desactiva porque la cabina está en espacio de cámara a
       * una distancia fija (~2 unidades) y el vehículo, a veces, queda más
       * cerca. Con la prueba activa el salpicadero se vería atravesado por el
       * modelo. */
      if (opciones.sinProfundidad) gl.disable(gl.DEPTH_TEST);

      gl.disable(gl.BLEND);
      gl.depthMask(true);
      opacas.forEach(lote);

      if (transl && transl.length) {
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        transl.forEach(lote);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    }

    /* -------------------------------------------------------------------
     * DIBUJO TEXTURIZADO (monitores de la cabina)
     * ----------------------------------------------------------------- */
    function dibujarTexturado(cam, items, opciones) {
      opciones = opciones || {};
      gl.useProgram(progTex);
      var L = {
        mvp: gl.getUniformLocation(progTex, 'uMVP'),
        luz: gl.getUniformLocation(progTex, 'uLuz'),
        cam: gl.getUniformLocation(progTex, 'uCam'),
        mono: gl.getUniformLocation(progTex, 'uMono')
      };
      var proj = M.perspectiva(cam.fov, cam.aspecto, 0.5, 4000);
      var vista = matrizVista(cam, opciones.soloVista);
      var mvpBase = M.mul(proj, vista);
      gl.uniformMatrix4fv(L.mvp, false, mvpBase);
      gl.uniform3f(L.luz, 0.3, 0.5, 0.8);
      var posCam = opciones.soloVista ? [0, 0, 0] : posicionCam(cam);
      gl.uniform3f(L.cam, posCam[0], posCam[1], posCam[2]);

      gl.enableVertexAttribArray(0);          // aPos
      gl.enableVertexAttribArray(1);          // aNor
      gl.enableVertexAttribArray(2);          // aCol
      gl.enableVertexAttribArray(3);          // aUV

      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(progTex, 'uTex'), 0);

      /* La cabina se pinta encima del mundo sin recortarse contra él: los
       * monitores están en espacio de cámara a distancia fija y el vehículo,
       * a veces, queda más cerca. Con la prueba de profundidad activa las
       * pantallas se verían atravesadas por el modelo. */
      if (opciones.sinProfundidad) gl.disable(gl.DEPTH_TEST);

      gl.disable(gl.BLEND);
      gl.depthMask(true);

      items.forEach(function (it) {
        var d = subir('tex:' + it.clave, it.polys);
        if (!d) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, d.pos);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, d.nor);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, d.col);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, d.uv);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idx);
        if (it.textura) {
          gl.bindTexture(gl.TEXTURE_2D, it.textura);
        }
        /* Las pantallas de cabina se componen con `off` (posición), `esc`
         * (tamaño) y `rot`, así que la textura llega tal cual: `uMono`=1
         * desactiva el mezclado con el color del vértice y el panel se ve como
         * una superficie emisiva. */
        if (it.off || it.esc) {
          var m = M.ident();
          if (it.esc) {
            /* `esc` admite escalar (figura regular) o par [ancho, alto], que es
             * lo que necesitan los monitores de cabina: son paneles anchos y
             * achatados, no cuadrados. */
            var ex = typeof it.esc === 'number' ? it.esc : it.esc[0];
            var ey = typeof it.esc === 'number' ? it.esc : it.esc[1];
            m = M.mul(m, M.escala(ex, ey, 1));
          }
          /* Escala y gira la superficie en torno a su centro; aplica su
           * posición al final para que el tamaño no desplace el monitor. */
          if (it.rot) {
            if (it.rot[0]) m = M.mul(M.rotX(it.rot[0]), m);
            if (it.rot[1]) m = M.mul(M.rotY(it.rot[1]), m);
            if (it.rot[2]) m = M.mul(M.rotZ(it.rot[2]), m);
          }
          if (it.off) m = M.mul(M.traslacion(it.off[0], it.off[1], it.off[2]), m);
          /* Igual que en `dibujar`: el desplazamiento va después de la vista
           * (proj·vista·m). */
          gl.uniformMatrix4fv(L.mvp, false, M.mul(mvpBase, m));
        }
        gl.uniform1f(L.mono, it.mono === false ? 0 : 1);
        gl.drawElements(gl.TRIANGLES, d.n, d.tipo, 0);
      });

      if (opciones.sinProfundidad) gl.enable(gl.DEPTH_TEST);

      /* Soltar el atributo 3 para que el dibujo opaco no arrastre un array
       * habilitado sin geometría propia. */
      gl.disableVertexAttribArray(3);
    }

    /** Pantalla plana de 1x1 con UV completa: la placa que lleva cada monitor. */
    function placaMonitor() {
      return { v: [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]],
               c: [255, 255, 255, 1, 100] };
    }

    function borrarCache() { cache = {}; }

    /* -------------------------------------------------------------------
     * FRAMEBUFFERS RTT (Render-to-Texture) para monitores de cabina
     * ----------------------------------------------------------------- */
    function crearFramebuffer(w, h) {
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      var rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.warn('RTT framebuffer incompleto:', status);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      return { fb: fb, tex: tex, rb: rb, w: w, h: h };
    }

    function redimensionarFramebuffer(rtt, w, h) {
      if (rtt.w === w && rtt.h === h) return;
      gl.bindTexture(gl.TEXTURE_2D, rtt.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, rtt.rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      rtt.w = w; rtt.h = h;
    }

    function conFramebuffer(rtt, fn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rtt.fb);
      gl.viewport(0, 0, rtt.w, rtt.h);
      gl.clearColor(0.02, 0.03, 0.05, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      fn();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    return {
      gl: gl,
      ajustar: ajustar,
      fondo: fondo,
      dibujar: dibujar,
      dibujarTexturado: dibujarTexturado,
      matrizVista: matrizVista,
      placaMonitor: placaMonitor,
      subir: subir,
      crearTextura: crearTextura,
      actualizarTextura: actualizarTextura,
      borrarCache: borrarCache,
      matrices: M,
      // RTT API
      crearFramebuffer: crearFramebuffer,
      redimensionarFramebuffer: redimensionarFramebuffer,
      conFramebuffer: conFramebuffer
    };
  }

  var GLC = { crear: crear, matrices: M };

  var CJ = root.CJ || (root.CJ = {});
  CJ.GL = GLC;

  if (typeof module !== 'undefined' && module.exports) module.exports = GLC;

})(typeof window !== 'undefined' ? window : this);
