// Renderer 3D WebGL2 per il modello di Napoli (napoli.glb) adattato a NapoliOS.
// Palette ardesia-salvia calda, complementare all'interfaccia chiara della PWA.

const multiply = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  }
  return o;
};

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

function perspective(aspect) {
  const f = 1 / Math.tan(0.35);
  const near = 3;
  const far = 900000;
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0
  ]);
}

function lookAt(eye, target) {
  const z = norm(sub(eye, target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
  ]);
}

// Conversione affine calibrata sul riferimento locale EPSG:32633 di transit.json (origin 14.25 E, 40.85 N)
const ORIGIN_LON = 14.25;
const ORIGIN_LAT = 40.85;
const AX = 84267.85350672371;
const BX = 1010.4958856523812;
const AZ = 555.5808964874301;
const BZ = -111064.0491717855;

export class NapoliRenderer {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    if (!this.gl) {
      throw new Error('WebGL 2 non disponibile per il modello 3D di Napoli.');
    }

    this.target = [-400, 120, -450];
    this.distance = 13500;
    this.az = 0.20;
    this.el = 0.78;
    this.dim = 0; // 0 = accesa, 1 = spenta/dormiente (scena apertura)
    this.dirty = true;
    this.meshes = [];
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.onClick = null;
    this.onManualMove = null;
    this.pointers = new Map();
    this.elevSamples = [];
    this.cameraAnim = null;
    this.dimAnim = null;

    this.bindInput();
    this.observer = new ResizeObserver(() => {
      this.dirty = true;
    });
    this.observer.observe(canvas.parentElement);
  }

  async load(glbUrl = './assets/city/napoli.glb') {
    const response = await fetch(glbUrl);
    if (!response.ok) {
      throw new Error(`Impossibile caricare ${glbUrl}: HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const gl = this.gl;
    const dv = new DataView(buffer);
    const jl = dv.getUint32(12, true);
    const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jl)));
    const offset = 20 + jl + 8;

    const vs = `#version 300 es
precision highp float;
in vec3 position;
uniform mat4 matrix;
out vec3 pos;
void main() {
  pos = position;
  gl_Position = matrix * vec4(position, 1.0);
}`;

    const fs = `#version 300 es
precision highp float;
in vec3 pos;
uniform vec3 color;
uniform vec3 eye;
uniform float dim;
out vec4 outputColor;
void main() {
  vec3 normal = normalize(cross(dFdx(pos), dFdy(pos)));
  float light = 0.54 + 0.46 * max(dot(normal, normalize(vec3(-0.45, 0.85, 0.58))), 0.0);
  float haze = clamp(length(pos - eye) / 72000.0, 0.0, 0.34);
  vec3 fog = mix(vec3(0.068, 0.105, 0.098), vec3(0.036, 0.048, 0.046), dim);
  vec3 lit = color * light;
  float lum = dot(lit, vec3(0.299, 0.587, 0.114));
  vec3 muted = mix(lit, vec3(lum * 0.92, lum * 0.96, lum * 0.94), 0.72 * dim) * mix(1.0, 0.44, dim);
  outputColor = vec4(mix(muted, fog, haze), 1.0);
}`;

    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s));
      }
      return s;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    this.program = program;
    gl.useProgram(program);
    const attr = gl.getAttribLocation(program, 'position');
    this.uMatrix = gl.getUniformLocation(program, 'matrix');
    this.uColor = gl.getUniformLocation(program, 'color');
    this.uEye = gl.getUniformLocation(program, 'eye');
    this.uDim = gl.getUniformLocation(program, 'dim');

    const read = (i) => {
      const a = doc.accessors[i];
      const v = doc.bufferViews[a.bufferView];
      const C = a.componentType === 5126 ? Float32Array : Uint32Array;
      return new C(buffer, offset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * (a.type === 'VEC3' ? 3 : 1));
    };

    // Palette ardesia-salvia calda, complementare a Fatt' APPosta
    const colors = {
      Terreno_Napoli: [0.115, 0.172, 0.155],
      Mare_e_acque: [0.055, 0.106, 0.132],
      Strade_principali: [0.225, 0.305, 0.282],
      Edifici_semplificati: [0.275, 0.352, 0.330]
    };

    for (const mesh of doc.meshes) {
      const p = mesh.primitives[0];
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const v = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, v);
      gl.bufferData(gl.ARRAY_BUFFER, read(p.attributes.POSITION), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, 3, gl.FLOAT, false, 0, 0);
      const b = gl.createBuffer();
      const indices = read(p.indices);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      this.meshes.push({
        name: mesh.name,
        vao,
        count: indices.length,
        color: colors[mesh.name] || [0.2, 0.25, 0.24],
        visible: true
      });
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    this.dirty = true;
    this.draw();
  }

  setElevationReference(transitData) {
    const samples = [];
    for (const line of transitData?.lines || []) {
      if (line.kind === 'air') continue;
      for (const s of line.stations || []) {
        if (Array.isArray(s.position)) samples.push(s.position);
      }
      const path = line.path || [];
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i];
        if (p && p.length >= 4) samples.push([p[1], p[2], p[3]]);
      }
    }
    this.elevSamples = samples;
  }

  lonLatToXZ(lon, lat) {
    const dl = lon - ORIGIN_LON;
    const da = lat - ORIGIN_LAT;
    return [AX * dl + BX * da, AZ * dl + BZ * da];
  }

  sampleElevation(x, z) {
    if (!this.elevSamples.length) return 45;
    let num = 0;
    let den = 0;
    let bestD2 = Infinity;
    let bestY = 45;
    for (let i = 0; i < this.elevSamples.length; i++) {
      const p = this.elevSamples[i];
      const dx = p[0] - x;
      const dz = p[2] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestY = p[1];
      }
      if (d2 < 122500) { // entro 350 m
        const w = 1 / (d2 + 400);
        num += w * p[1];
        den += w;
      }
    }
    return den > 0 ? num / den : bestY;
  }

  lonLatToWorld(lon, lat, extraY = 10) {
    const [x, z] = this.lonLatToXZ(lon, lat);
    const y = this.sampleElevation(x, z);
    return [x, y + extraY, z];
  }

  setDormant(dormant, { animate = false, ms = 1200 } = {}) {
    const targetDim = typeof dormant === 'number' ? dormant : (dormant ? 1 : 0);
    if (!animate || ms <= 0) {
      this.dimAnim = null;
      if (this.dim !== targetDim) {
        this.dim = targetDim;
        this.dirty = true;
      }
      return;
    }
    this.dimAnim = {
      from: this.dim,
      to: targetDim,
      start: performance.now(),
      duration: ms
    };
  }

  flyToCamera({ view, target, center, distance, zoom, az, bearing, el, pitch, ms = 1600 } = {}, animate = false) {
    const aspect = Math.max(0.5, this.width / Math.max(1, this.height));
    let nextTarget = target ? [...target] : [...this.target];
    let nextDistance = distance ?? this.distance;
    let nextAz = az ?? this.az;
    let nextEl = el ?? this.el;

    if (view) {
      const preset = this.viewPreset(view, aspect);
      nextTarget = preset.target;
      nextDistance = preset.distance;
      nextAz = preset.az;
      nextEl = preset.el;
    } else {
      if (center && Array.isArray(center)) {
        nextTarget = this.lonLatToWorld(center[0], center[1], 0);
      }
      if (zoom != null && distance == null) {
        // Mappa approssimata zoom MapLibre -> distanza camera 3D
        nextDistance = Math.max(2500, Math.min(32000, 14500 * Math.pow(2, 13.5 - zoom)));
      }
      if (bearing != null && az == null) {
        nextAz = (-bearing * Math.PI) / 180;
      }
      if (pitch != null && el == null) {
        nextEl = Math.max(0.22, Math.min(1.54, ((90 - pitch) * Math.PI) / 180));
      }
    }

    if (!animate || ms <= 0) {
      this.cameraAnim = null;
      this.target = nextTarget;
      this.distance = nextDistance;
      this.az = nextAz;
      this.el = nextEl;
      this.dirty = true;
      return;
    }

    this.cameraAnim = {
      start: performance.now(),
      duration: ms,
      from: { target: [...this.target], distance: this.distance, az: this.az, el: this.el },
      to: { target: nextTarget, distance: nextDistance, az: nextAz, el: nextEl }
    };
  }

  viewPreset(type, aspect = Math.max(0.5, this.width / Math.max(1, this.height))) {
    if (type === 'city') {
      return {
        target: [-550, 110, -450],
        distance: Math.max(21000, 21000 / aspect),
        az: 0.16,
        el: 0.80
      };
    }
    if (type === 'top') {
      return {
        target: [-500, 110, -550],
        distance: Math.max(22000, 22000 / aspect),
        az: 0.04,
        el: 1.50
      };
    }
    // 'center' default
    return {
      target: [-450, 110, -350],
      distance: Math.max(11500, 11500 / aspect),
      az: 0.22,
      el: 0.76
    };
  }

  setView(type, animate = false) {
    this.flyToCamera({ view: type, ms: animate ? 1200 : 0 }, animate);
  }

  fitLine(line) {
    if (!line?.path?.length) return;
    const xs = line.path.map((p) => p[1]);
    const zs = line.path.map((p) => p[3]);
    const minx = Math.min(...xs);
    const maxx = Math.max(...xs);
    const minz = Math.min(...zs);
    const maxz = Math.max(...zs);
    const aspect = Math.max(0.5, this.width / Math.max(1, this.height));
    this.cameraAnim = null;
    this.target = [(minx + maxx) / 2, 100, (minz + maxz) / 2];
    this.distance = Math.max(4500, (maxz - minz) * 1.8, ((maxx - minx) * 1.65) / aspect);
    this.az = 0.12;
    this.el = 0.96;
    this.dirty = true;
  }

  zoom(factor) {
    this.cameraAnim = null;
    this.distance = Math.max(800, Math.min(180000, this.distance * factor));
    this.dirty = true;
  }

  setBuildings(visible) {
    const m = this.meshes.find((mesh) => mesh.name === 'Edifici_semplificati');
    if (m) m.visible = visible;
    this.dirty = true;
  }

  follow(position) {
    this.cameraAnim = null;
    this.target = this.target.map((v, i) => v + (position[i] - v) * 0.12);
    this.dirty = true;
  }

  tickAnimation(now) {
    if (this.cameraAnim) {
      const a = this.cameraAnim;
      const raw = Math.min(1, (now - a.start) / Math.max(1, a.duration));
      const t = smoothstep(raw);
      this.target = [
        lerp(a.from.target[0], a.to.target[0], t),
        lerp(a.from.target[1], a.to.target[1], t),
        lerp(a.from.target[2], a.to.target[2], t)
      ];
      this.distance = lerp(a.from.distance, a.to.distance, t);
      this.az = lerp(a.from.az, a.to.az, t);
      this.el = lerp(a.from.el, a.to.el, t);
      this.dirty = true;
      if (raw >= 1) this.cameraAnim = null;
    }
    if (this.dimAnim) {
      const d = this.dimAnim;
      const raw = Math.min(1, (now - d.start) / Math.max(1, d.duration));
      this.dim = lerp(d.from, d.to, smoothstep(raw));
      this.dirty = true;
      if (raw >= 1) this.dimAnim = null;
    }
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.7);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w !== this.width || h !== this.height || this.dpr !== dpr) {
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.overlay.width = Math.round(w * dpr);
      this.overlay.height = Math.round(h * dpr);
      this.dirty = true;
    }
  }

  draw(now = performance.now()) {
    this.tickAnimation(now);
    this.resize();
    if (!this.dirty || !this.program) return;

    const gl = this.gl;
    const eye = [
      this.target[0] + Math.sin(this.az) * Math.cos(this.el) * this.distance,
      this.target[1] + Math.sin(this.el) * this.distance,
      this.target[2] + Math.cos(this.az) * Math.cos(this.el) * this.distance
    ];
    this.matrix = multiply(perspective(this.width / this.height), lookAt(eye, this.target));

    const bgR = lerp(0.068, 0.036, this.dim);
    const bgG = lerp(0.105, 0.048, this.dim);
    const bgB = lerp(0.098, 0.046, this.dim);

    gl.useProgram(this.program);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(bgR, bgG, bgB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(this.uMatrix, false, this.matrix);
    gl.uniform3fv(this.uEye, eye);
    gl.uniform1f(this.uDim, this.dim);

    for (const m of this.meshes) {
      if (!m.visible) continue;
      gl.bindVertexArray(m.vao);
      gl.uniform3fv(this.uColor, m.color);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    this.dirty = false;
  }

  project(p) {
    const m = this.matrix;
    if (!m || !p) return null;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w < 1) return null;
    return [((x / w) * 0.5 + 0.5) * this.width, (0.5 - (y / w) * 0.5) * this.height, w];
  }

  bindInput() {
    const c = this.overlay;
    c.addEventListener('pointerdown', (e) => {
      this.cameraAnim = null;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      this.start = { x: e.clientX, y: e.clientY, time: performance.now(), moved: false };
      c.classList.add('dragging');
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const old = this.pointers.get(e.pointerId);
      const dx = e.clientX - old.x;
      const dy = e.clientY - old.y;
      if (Math.abs(e.clientX - this.start.x) + Math.abs(e.clientY - this.start.y) > 5) {
        this.start.moved = true;
      }
      if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const before = Math.hypot(old.x - other.x, old.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (after > 0) this.zoom(before / after);
        this.start.moved = true;
      } else if (e.shiftKey || e.buttons === 2) {
        const scale = this.distance * 0.0011;
        this.target[0] -= (dx * Math.cos(this.az) + dy * Math.sin(this.az)) * scale;
        this.target[2] += (dx * Math.sin(this.az) - dy * Math.cos(this.az)) * scale;
      } else {
        this.az -= dx * 0.005;
        this.el = Math.max(0.14, Math.min(1.55, this.el + dy * 0.004));
      }
      if (this.start.moved && this.onManualMove) this.onManualMove();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dirty = true;
    });
    c.addEventListener('pointerup', (e) => {
      const click = this.start && !this.start.moved && this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      c.classList.remove('dragging');
      if (click && this.onClick) {
        const r = c.getBoundingClientRect();
        this.onClick(e.clientX - r.left, e.clientY - r.top);
      }
    });
    c.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      c.classList.remove('dragging');
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(Math.exp(e.deltaY * 0.001));
      },
      { passive: false }
    );
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
