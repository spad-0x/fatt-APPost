// NapoliOS — Sala operativa del Comune di Napoli con modello 3D realistico (napoli.glb),
// rete trasporti multimodale (transit.json) e motore deterministico a timeline.
import { startRegia, readRegiaParams, disableServiceWorker } from './regia.js';
import { NapoliRenderer } from './city/renderer.js';
import { MobilitySimulation } from './city/simulation.js';

const SCENES = ['apertura', 'dati', 'l1', 's2', 'notte', 'visione'];

const ALL_AGENTS = [
  'Emergenze',
  'Mobilità',
  'Sentinella',
  'Eventi',
  'Meteo',
  'Cronaca',
  'Comunicazione'
];

const BASE_EVENTS = [
  {
    id: 'ev-marina',
    badge: 'Traffico',
    time: '22:08',
    title: 'Coda in aumento su Via Marina',
    detail: 'Deflusso lungomare · pioggia leggera',
    level: 'amber',
    center: [14.2618, 40.8454]
  },
  {
    id: 'ev-cortile',
    badge: 'Evento',
    time: '22:15',
    title: 'Concerto Centro Storico',
    detail: 'Palazzo Marigliano · affluenza media',
    level: 'normal',
    center: [14.259, 40.849]
  }
];

const ILLUMINATED_CORRIDOR_LONLAT = [
  [14.2596, 40.8506],
  [14.2564, 40.8501],
  [14.2535, 40.8496],
  [14.2513, 40.8491],
  [14.2504, 40.8489]
];

const clone = (obj) => JSON.parse(JSON.stringify(obj));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDuration(s) {
  const sec = Math.max(0, Math.ceil(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function slicePath3D(pts, progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (!pts.length) return { line: [], point: [0, 0, 0] };
  if (p <= 0) return { line: [pts[0], pts[0]], point: pts[0] };
  if (p >= 1) return { line: pts.slice(), point: pts[pts.length - 1] };

  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    segs.push(len);
    total += len;
  }
  const target = total * p;
  let acc = 0;
  const line = [pts[0]];
  for (let i = 0; i < segs.length; i++) {
    const len = segs[i];
    if (acc + len >= target) {
      const r = len > 0 ? (target - acc) / len : 0;
      const pt = [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r,
        pts[i][2] + (pts[i + 1][2] - pts[i][2]) * r
      ];
      line.push(pt);
      return { line, point: pt };
    }
    acc += len;
    line.push(pts[i + 1]);
  }
  return { line: pts.slice(), point: pts[pts.length - 1] };
}

function drawPolyline2D(context, points) {
  context.beginPath();
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    if (pen) context.lineTo(p[0], p[1]);
    else {
      context.moveTo(p[0], p[1]);
      pen = true;
    }
  }
}

function drawCircle2D(context, x, y, r, fill) {
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
}

async function init() {
  const regia = readRegiaParams();
  // ?vista=mappa: solo la mappa 3D a tutto schermo (riprese degli atti in cui i pannelli non servono)
  document.documentElement.classList.toggle('is-solo-mappa', new URLSearchParams(location.search).get('vista') === 'mappa');
  if (!regia.scena) {
    const url = new URL(location.href);
    url.searchParams.set('scena', 'apertura');
    history.replaceState(null, '', url);
  } else {
    disableServiceWorker().catch(() => {});
  }

  const cityCanvas = document.getElementById('city-canvas');
  const motionCanvas = document.getElementById('motion-canvas');
  const ctx = motionCanvas.getContext('2d');
  const mapLoading = document.getElementById('map-loading');

  const renderer = new NapoliRenderer(cityCanvas, motionCanvas);

  const [transitData, assiBase, semsBase, percorsiBase, rischioBase] = await Promise.all([
    fetchJson('./assets/city/transit.json'),
    fetchJson('./geo/assi.geojson'),
    fetchJson('./geo/semafori.geojson'),
    fetchJson('./geo/percorsi.geojson'),
    fetchJson('./geo/rischio.geojson'),
    renderer.load('./assets/city/napoli.glb')
  ]);

  renderer.setElevationReference(transitData);
  mapLoading.hidden = true;

  transitData.lines.sort((a, b) => (a.code || a.id).localeCompare(b.code || b.id, 'it', { numeric: true }));
  const sim = new MobilitySimulation(transitData);

  // Pre-conversione dei dati GeoJSON di NapoliOS nello spazio 3D reale di napoli.glb
  const assi3dBase = assiBase.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    status: f.properties.status,
    pts: f.geometry.coordinates.map(([lon, lat]) => renderer.lonLatToWorld(lon, lat, 11))
  }));

  const sems3dBase = semsBase.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    corridor: f.properties.corridor,
    state: f.properties.state,
    controlled: Boolean(f.properties.controlled),
    pos: renderer.lonLatToWorld(f.geometry.coordinates[0], f.geometry.coordinates[1], 14)
  }));

  const percorsi3dBase = percorsiBase.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    state: f.properties.state,
    pts: f.geometry.coordinates.map(([lon, lat]) => renderer.lonLatToWorld(lon, lat, 13))
  }));

  const rischio3dBase = rischioBase.features.map((f) => {
    const ring = f.geometry.coordinates[0].map(([lon, lat]) => renderer.lonLatToWorld(lon, lat, 8));
    const n = Math.max(1, ring.length - 1);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
      sz += ring[i][2];
    }
    return {
      id: f.properties.id,
      name: f.properties.name,
      heat: f.properties.heat,
      lampo: f.properties.lampo,
      ring,
      center: [sx / n, sy / n + 6, sz / n]
    };
  });

  const illuminatedCorridorPts = ILLUMINATED_CORRIDOR_LONLAT.map(([lon, lat]) => renderer.lonLatToWorld(lon, lat, 13));
  const ambAPts = percorsi3dBase.find((f) => f.id === 'amb-a')?.pts || [];

  // Posizione di ogni semaforo del corridoio lungo il percorso A, come frazione 0–1 della lunghezza
  function pathFraction(pts, pos) {
    let total = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      cum.push(total);
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][2];
      const bx = pts[i][0], bz = pts[i][2];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const r = len2 > 0 ? Math.max(0, Math.min(1, ((pos[0] - ax) * dx + (pos[2] - az) * dz) / len2)) : 0;
      const d = Math.hypot(pos[0] - (ax + dx * r), pos[2] - (az + dz * r));
      if (d < bestD) { bestD = d; best = cum[i - 1] + (cum[i] - cum[i - 1]) * r; }
    }
    return total > 0 ? best / total : 0;
  }
  const semFraction = new Map(
    sems3dBase.filter((s) => s.corridor != null).map((s) => [s.id, pathFraction(ambAPts, s.pos)])
  );
  const WAVE_AHEAD = 0.26;   // tratto di percorso tenuto verde davanti al mezzo
  const WAVE_BEHIND = 0.025; // margine dopo il passaggio prima del ritorno al ciclo normale

  // Riferimenti DOM
  const statusClock = document.getElementById('status-clock');
  const statusEvents = document.getElementById('status-events');
  const statusCorridor = document.getElementById('status-corridor');
  const statusCorridorText = document.getElementById('status-corridor-text');
  const eventsList = document.getElementById('events-list');
  const eventsCount = document.getElementById('events-count');
  const mapMarkers = document.getElementById('map-markers');
  const mapCallouts = document.getElementById('map-callouts');
  const visionFlash = document.getElementById('vision-flash');
  const openingOverlay = document.getElementById('opening-overlay');
  const vehicleCard = document.getElementById('vehicle-selection');
  const kpiVehicles = document.getElementById('kpi-vehicles');
  const kpiLines = document.getElementById('kpi-lines');
  const kpiMoving = document.getElementById('kpi-moving');
  const agentsGrid = document.getElementById('agents-grid');
  const decisionCard = document.getElementById('decision-card');
  const decLevel = document.getElementById('dec-level');
  const decStatus = document.getElementById('dec-status');
  const decTitle = document.getElementById('dec-title');
  const decEffect = document.getElementById('dec-effect');
  const decCost = document.getElementById('dec-cost');
  const decRule = document.getElementById('dec-rule');
  const btnRevoca = document.getElementById('btn-revoca');
  const orchStream = document.getElementById('orch-stream');
  const registryBody = document.getElementById('registry-body');
  const modeButtons = [...document.querySelectorAll('.hud-pill[data-mode]')];
  const viewButtons = [...document.querySelectorAll('.hud-pill[data-view]')];

  // Stato visivo della scena 3D
  const sceneState = {
    mode: 'mixed',
    enabled: new Set(),
    highlight: new Set(),
    transitAlpha: 0.85,
    showAssi: true,
    showSemafori: true,
    showStations: true,
    showTrails: true,
    selectedVehicle: null,
    selectedStation: null,
    follow: false,
    assi: clone(assi3dBase),
    sems: clone(sems3dBase),
    routes: [],
    corridorLine: null,
    endpoints: [],
    blockPoint: null,
    ambPos: null,
    riskOpacity: 0,
    activeRiskIds: new Set(),
    rischio: clone(rischio3dBase),
    illuminatedCorridor: false,
    cameras: [],
    axisBadge: null,
    pins: [] // { id, pos, label, kind, node }
  };

  let routeRevision = 0;
  let overlayDirty = true;
  let engineRef = null;
  let lastHudTime = -Infinity;
  const hits = { vehicles: [], stations: [] };

  function computeEnabled(mode, highlightSet) {
    if (mode === 'none') return new Set();
    const set = new Set();
    for (const l of transitData.lines) {
      const match =
        mode === 'mixed'
          ? l.defaultVisible
          : mode === 'rail'
          ? ['metro', 'rail', 'funicular', 'tram'].includes(l.kind)
          : l.kind === mode;
      if (match || highlightSet.has(l.id)) set.add(l.id);
    }
    return set;
  }

  function applyTransitConfig({ mode = sceneState.mode, highlightLines = null, transitAlpha = sceneState.transitAlpha } = {}) {
    sceneState.mode = mode;
    if (highlightLines !== null) {
      sceneState.highlight = new Set(highlightLines);
    }
    sceneState.transitAlpha = transitAlpha;
    sceneState.enabled = computeEnabled(sceneState.mode, sceneState.highlight);
    modeButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.mode === sceneState.mode));
    if (sceneState.selectedVehicle) {
      const v = sim.vehicles.find((x) => x.id === sceneState.selectedVehicle);
      if (!v || !sceneState.enabled.has(v.lineId)) clearSelection();
    }
    routeRevision++;
    overlayDirty = true;
    updateKpis();
  }

  function setPin(id, pos, label, kind = 'accent') {
    const existing = sceneState.pins.find((p) => p.id === id);
    if (existing) {
      existing.pos = pos;
      existing.label = label;
      existing.kind = kind;
      existing.node.className = `map-pin is-${kind}`;
      existing.node.textContent = label;
      overlayDirty = true;
      return;
    }
    const node = el('div', `map-pin is-${kind}`, label);
    mapMarkers.appendChild(node);
    sceneState.pins.push({ id, pos, label, kind, node });
    overlayDirty = true;
  }

  function clearPins(filterPrefix = null) {
    sceneState.pins = sceneState.pins.filter((p) => {
      if (filterPrefix && !p.id.startsWith(filterPrefix)) return true;
      p.node.remove();
      return false;
    });
    overlayDirty = true;
  }

  function clearSelection() {
    sceneState.selectedVehicle = null;
    sceneState.selectedStation = null;
    sceneState.follow = false;
    vehicleCard.hidden = true;
    overlayDirty = true;
  }

  function vehicleName(v) {
    const l = sim.lineMap.get(v.lineId);
    const unit = l.kind === 'bus' ? 'bus' : 'mezzo';
    return v.callSign || `${l.code || l.id} · ${unit} ${v.index + 1}`;
  }

  function updateSelectionCard() {
    if (sceneState.selectedVehicle) {
      const v = sim.vehicles.find((x) => x.id === sceneState.selectedVehicle);
      if (!v || v.active === false || !sceneState.enabled.has(v.lineId)) {
        clearSelection();
        return;
      }
      const line = sim.lineMap.get(v.lineId);
      const air = line.kind === 'air';
      const statusMap = {
        moving: 'In movimento',
        dwell: 'In fermata',
        waiting: 'Attesa di sicurezza',
        approach: 'In avvicinamento',
        climb: 'In partenza',
        ground: 'A terra'
      };
      const stop = v.dwellRemaining > 0 ? line.stations[v.stationIndex] : sim.next(v);
      const nextTitle = air
        ? `${line.airRole === 'arrival' ? 'Atterraggio' : 'Uscita area'} · ${formatDuration(sim.eta(v))}`
        : v.dwellRemaining > 0
        ? `In fermata · riparte tra ${formatDuration(v.dwellRemaining)}`
        : `Prossima fermata · ${formatDuration(sim.eta(v))}`;

      vehicleCard.hidden = false;
      vehicleCard.innerHTML = `
        <div class="vc-head">
          <span class="vc-pill" style="--pill-color:${line.color}">${escapeHtml(line.code || line.id)}</span>
          <div class="vc-title">
            <strong>${escapeHtml(vehicleName(v))}</strong>
            <small>Direzione ${escapeHtml(sim.destination(v))}</small>
          </div>
          <button type="button" class="vc-close" aria-label="Chiudi dettagli">×</button>
        </div>
        <div class="vc-grid">
          <div><span>Stato</span><b>${escapeHtml(statusMap[v.status] || v.status)}</b></div>
          <div><span>Velocità</span><b>${Math.round(v.velocity * (air ? 1.94384 : 3.6))}${air ? ' kt' : ' km/h'}</b></div>
          <div><span>${air ? 'Quota' : 'Carico'}</span><b>${air ? Math.round(sim.position(v)[1]) + ' m' : v.occupancy + '%'}</b></div>
          <div><span>Fonte</span><b>Simulazione</b></div>
        </div>
        <div class="vc-next">
          <span>${escapeHtml(nextTitle)}</span>
          <strong>${escapeHtml(stop.name)}</strong>
        </div>
        <button type="button" class="vc-follow${sceneState.follow ? ' is-following' : ''}">
          ${sceneState.follow ? '◉ Seguendo il mezzo · interrompi' : '◎ Segui questo mezzo'}
        </button>
        <div class="vc-note">Dati simulati su rete ${escapeHtml(line.operator || 'ANM/EAV')}</div>
      `;
    } else if (sceneState.selectedStation) {
      const line = sim.lineMap.get(sceneState.selectedStation.lineId);
      const station = line?.stations?.[sceneState.selectedStation.index];
      if (!line || !station || !sceneState.enabled.has(line.id)) {
        clearSelection();
        return;
      }
      const arrivals = (sim.byLine.get(line.id) || [])
        .filter((v) => v.active !== false && (v.targetIndex === sceneState.selectedStation.index || (v.stationIndex === sceneState.selectedStation.index && v.dwellRemaining > 0)))
        .sort((a, b) => sim.eta(a) - sim.eta(b))
        .slice(0, 3);
      vehicleCard.hidden = false;
      vehicleCard.innerHTML = `
        <div class="vc-head">
          <span class="vc-pill" style="--pill-color:${line.color}">${escapeHtml(line.code || line.id)}</span>
          <div class="vc-title">
            <strong>${escapeHtml(station.name)}</strong>
            <small>Fermata · ${escapeHtml(line.name)}</small>
          </div>
          <button type="button" class="vc-close" aria-label="Chiudi dettagli">×</button>
        </div>
        <div class="vc-next">
          <span>PROSSIMI PASSAGGI SIMULATI</span>
          ${arrivals.length
            ? arrivals.map((v) => `<strong>${escapeHtml(vehicleName(v))} · ${v.stationIndex === sceneState.selectedStation.index && v.dwellRemaining > 0 ? 'in banchina' : formatDuration(sim.eta(v))}</strong>`).join('')
            : '<strong>Nessun mezzo nel tratto in arrivo</strong>'}
        </div>
        <div class="vc-note">Stime simulate · rete ${escapeHtml(line.operator || 'TPL')}</div>
      `;
    } else {
      vehicleCard.hidden = true;
    }
  }

  vehicleCard.addEventListener('click', (e) => {
    if (e.target.closest('.vc-close')) clearSelection();
    if (e.target.closest('.vc-follow')) {
      sceneState.follow = !sceneState.follow;
      if (sceneState.follow) {
        renderer.distance = 3200;
        renderer.el = 0.72;
        renderer.dirty = true;
      }
      updateSelectionCard();
    }
  });

  function updateKpis() {
    const visible = sim.vehicles.filter((v) => v.active !== false && sceneState.enabled.has(v.lineId));
    kpiVehicles.textContent = String(visible.length);
    kpiLines.textContent = String(sceneState.enabled.size);
    kpiMoving.textContent = String(visible.filter((v) => v.velocity > 0.3).length);
  }

  // Eventi UI dei filtri rapidi e viste camera
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTransitConfig({ mode: btn.dataset.mode, highlightLines: [], transitAlpha: 0.9 });
      renderFrame(performance.now());
    });
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      sceneState.follow = false;
      viewButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderer.setView(btn.dataset.view, true);
      overlayDirty = true;
      renderFrame(performance.now());
    });
  });

  renderer.onManualMove = () => {
    sceneState.follow = false;
    viewButtons.forEach((b) => b.classList.remove('is-active'));
  };

  renderer.onClick = (x, y) => {
    const nearest = (arr, maxR) =>
      arr
        .map((p) => ({ ...p, d: Math.hypot(p.x - x, p.y - y) }))
        .filter((p) => p.d < maxR)
        .sort((a, b) => a.d - b.d)[0];
    const veh = nearest(hits.vehicles, 18);
    if (veh) {
      sceneState.selectedVehicle = veh.id;
      sceneState.selectedStation = null;
      sceneState.follow = false;
      updateSelectionCard();
      overlayDirty = true;
      return;
    }
    const st = nearest(hits.stations, 12);
    if (st) {
      sceneState.selectedStation = { lineId: st.lineId, index: st.index };
      sceneState.selectedVehicle = null;
      sceneState.follow = false;
      updateSelectionCard();
      overlayDirty = true;
      return;
    }
    clearSelection();
  };

  // Cache del layer statico (infrastruttura OSM, linee TPL, fermate) rigenerata solo al cambio camera/filtri
  const routeCache = document.createElement('canvas');
  const rc = routeCache.getContext('2d');
  let cachedMatrix = null;
  let cachedRevision = -1;
  let cachedStations = [];

  function rebuildRouteCache() {
    if (
      cachedMatrix === renderer.matrix &&
      cachedRevision === routeRevision &&
      routeCache.width === renderer.overlay.width &&
      routeCache.height === renderer.overlay.height
    ) {
      return;
    }
    cachedMatrix = renderer.matrix;
    cachedRevision = routeRevision;
    routeCache.width = renderer.overlay.width;
    routeCache.height = renderer.overlay.height;
    rc.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    rc.clearRect(0, 0, renderer.width, renderer.height);
    rc.lineCap = 'round';
    rc.lineJoin = 'round';
    cachedStations = [];

    if (sceneState.mode === 'none' || sceneState.enabled.size === 0) return;

    const hasHighlight = sceneState.highlight.size > 0;
    const baseScale = sceneState.transitAlpha;

    // Binari urbani OSM di sfondo molto discreti
    if (transitData.infrastructure?.length) {
      rc.strokeStyle = '#9bb0ab';
      rc.globalAlpha = 0.18 * baseScale;
      rc.lineWidth = 0.8;
      for (const track of transitData.infrastructure) {
        drawPolyline2D(rc, track.map((p) => renderer.project(p.slice(1))));
        rc.stroke();
      }
      rc.globalAlpha = 1;
    }

    // Tracciati TPL: prima le linee di contesto, poi quelle evidenziate
    const orderedLines = [...transitData.lines].sort((a, b) => {
      const ha = sceneState.highlight.has(a.id) ? 1 : 0;
      const hb = sceneState.highlight.has(b.id) ? 1 : 0;
      return ha - hb;
    });

    for (const line of orderedLines) {
      if (!sceneState.enabled.has(line.id)) continue;
      const isHi = sceneState.highlight.has(line.id);
      const bus = line.kind === 'bus';
      const air = line.kind === 'air';
      const dimMul = hasHighlight && !isHi ? 0.34 : 1;

      rc.setLineDash(line.schematic ? [5, 4] : air ? [3, 6] : []);
      rc.strokeStyle = line.color;

      for (const geom of line.displayPaths || [line.path]) {
        const points = geom.map((p) => renderer.project([p[1], p[2], p[3]]));
        if (isHi || (!bus && !line.schematic && !air)) {
          drawPolyline2D(rc, points);
          rc.globalAlpha = (isHi ? 0.24 : 0.1) * baseScale * dimMul;
          rc.lineWidth = isHi ? 10 : 6;
          rc.stroke();
        }
        drawPolyline2D(rc, points);
        rc.globalAlpha = (isHi ? 0.96 : bus ? 0.42 : air ? 0.42 : line.schematic ? 0.65 : 0.85) * baseScale * dimMul;
        rc.lineWidth = isHi ? 3.2 : bus ? 1.2 : air ? 1.3 : 2.0;
        rc.stroke();
      }
      rc.setLineDash([]);
      rc.globalAlpha = 1;
    }

    // Fermate TPL
    if (sceneState.showStations) {
      const cells = new Set();
      for (const line of orderedLines) {
        if (!sceneState.enabled.has(line.id) || line.kind === 'air') continue;
        const isHi = sceneState.highlight.has(line.id);
        if (line.kind === 'bus' && !isHi && renderer.distance > 6800) continue;
        const dimMul = hasHighlight && !isHi ? 0.38 : 1;
        rc.globalAlpha = baseScale * dimMul;
        line.stations.forEach((station, index) => {
          const p = renderer.project(station.position);
          if (!p || p[0] < -16 || p[0] > renderer.width + 16 || p[1] < -16 || p[1] > renderer.height + 16) return;
          const key = `${Math.round(p[0] / 6)}:${Math.round(p[1] / 6)}`;
          if (cells.has(key) && line.kind === 'bus' && !isHi) return;
          cells.add(key);
          const r = isHi ? 3.8 : line.kind === 'bus' ? 2.0 : 3.0;
          drawCircle2D(rc, p[0], p[1], r + 1.1, '#101c1a');
          drawCircle2D(rc, p[0], p[1], r * 0.72, line.color);
          cachedStations.push({ x: p[0], y: p[1], lineId: line.id, index });
        });
      }
      rc.globalAlpha = 1;
    }
  }

  function collidesBox(box, placed, pad = 4) {
    return placed.some(
      (b) =>
        box.x < b.x + b.w + pad &&
        box.x + box.w + pad > b.x &&
        box.y < b.y + b.h + pad &&
        box.y + box.h + pad > b.y
    );
  }

  function drawOverlay() {
    rebuildRouteCache();
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    ctx.clearRect(0, 0, renderer.width, renderer.height);
    ctx.drawImage(routeCache, 0, 0, renderer.width, renderer.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    hits.vehicles = [];
    hits.stations = cachedStations;
    const placedBoxes = [];
    const deferredRiskLabels = [];

    // 1. Zone di rischio aggregate (scena Visione)
    if (sceneState.riskOpacity > 0) {
      for (const z of sceneState.rischio) {
        const pts = z.ring.map((p) => renderer.project(p)).filter(Boolean);
        if (pts.length < 3) continue;
        const isActive = sceneState.activeRiskIds.has(z.id);
        const fillAlpha = isActive ? sceneState.riskOpacity * 0.62 : sceneState.riskOpacity * 0.28;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = z.heat >= 0.85 ? `rgba(220, 38, 38, ${fillAlpha})` : `rgba(217, 119, 6, ${fillAlpha})`;
        ctx.fill();
        ctx.lineWidth = isActive ? 2.5 : 1.4;
        ctx.strokeStyle = isActive ? '#fca5a5' : 'rgba(251, 191, 36, 0.72)';
        ctx.stroke();

        if (isActive) {
          const cp = renderer.project(z.center);
          if (cp) {
            ctx.font = '600 10px Poppins, sans-serif';
            const text = `${z.name} · ${z.lampo}`;
            const w = ctx.measureText(text).width + 14;
            const h = 20;
            const offsets = [[0, 0], [0, 26], [0, -26], [-36, 26], [36, -26], [0, 50], [0, -50]];
            let box = { x: cp[0] - w / 2, y: cp[1] - 11, w, h };
            for (const [dx, dy] of offsets) {
              const cand = { x: cp[0] - w / 2 + dx, y: cp[1] - 11 + dy, w, h };
              if (!collidesBox(cand, placedBoxes, 6)) {
                box = cand;
                break;
              }
            }
            const distFromAnchor = Math.hypot(box.x + w / 2 - cp[0], box.y + h / 2 - cp[1]);
            placedBoxes.push(box);
            deferredRiskLabels.push({ cp, box, text, w, h, distFromAnchor });
          }
        }
      }
    }

    // 2. Corridoio pedonale illuminato (+40% Lampo 1 Visione)
    if (sceneState.illuminatedCorridor) {
      const pts = illuminatedCorridorPts.map((p) => renderer.project(p));
      drawPolyline2D(ctx, pts);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.34)';
      ctx.lineWidth = 15;
      ctx.stroke();
      drawPolyline2D(ctx, pts);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.stroke();
      for (const pt of pts) {
        if (!pt) continue;
        drawCircle2D(ctx, pt[0], pt[1], 7, 'rgba(253, 224, 71, 0.35)');
        drawCircle2D(ctx, pt[0], pt[1], 3, '#fef9c3');
      }
    }

    // 3. Assi stradali monitorati (verde / ambra / rosso)
    const hasHighlightedAxis = sceneState.assi.some((a) => a.highlight);
    if (sceneState.showAssi) {
      let highlightedAxis = null;
      for (const asse of sceneState.assi) {
        const pts = asse.pts.map((p) => renderer.project(p));
        if (asse.highlight) {
          highlightedAxis = { asse, pts: pts.filter(Boolean) };
          drawPolyline2D(ctx, pts);
          ctx.strokeStyle =
            asse.status === 'rosso'
              ? 'rgba(239, 68, 68, 0.30)'
              : asse.status === 'ambra'
              ? 'rgba(245, 158, 11, 0.30)'
              : 'rgba(34, 197, 94, 0.30)';
          ctx.globalAlpha = 1;
          ctx.lineWidth = 14;
          ctx.stroke();
        }
        drawPolyline2D(ctx, pts);
        ctx.strokeStyle = asse.status === 'rosso' ? '#ef4444' : asse.status === 'ambra' ? '#f59e0b' : '#22c55e';
        ctx.globalAlpha = asse.highlight ? 0.96 : hasHighlightedAxis ? 0.38 : 0.72;
        ctx.lineWidth = asse.highlight ? 6 : 3.2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (sceneState.axisBadge && highlightedAxis?.pts?.length) {
        const mid = highlightedAxis.pts[Math.floor(highlightedAxis.pts.length / 2)];
        const badgeColor =
          highlightedAxis.asse.status === 'rosso'
            ? '#ef4444'
            : highlightedAxis.asse.status === 'ambra'
            ? '#f59e0b'
            : '#22c55e';
        ctx.font = '600 11px Poppins, sans-serif';
        const w = ctx.measureText(sceneState.axisBadge).width + 20;
        const h = 24;
        const bx = Math.max(12, Math.min(renderer.width - w - 12, mid[0] - w / 2));
        const by = Math.max(64, mid[1] - 78); // sopra le etichette dei semafori comandati
        const box = { x: bx, y: by, w, h };
        placedBoxes.push(box);

        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(mid[0], mid[1]);
        ctx.lineTo(bx + w / 2, by + h);
        ctx.stroke();

        ctx.fillStyle = 'rgba(13, 25, 23, 0.94)';
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, 999);
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = badgeColor;
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(sceneState.axisBadge, bx + 10, by + 15.5);
      }
    }

    // 4. Percorsi candidati ambulanza (S2)
    for (const r of sceneState.routes) {
      const pts = r.pts.map((p) => renderer.project(p));
      drawPolyline2D(ctx, pts);
      if (r.state === 'blocked') {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#ef4444';
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 3.5;
      } else if (r.state === 'chosen') {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#4ade80';
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 5.5;
      } else if (r.state === 'dimmed') {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#94a3b8';
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 3.2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#e2e8f0';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 4;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 5. Corridoio onda verde percorso dall'ambulanza
    if (sceneState.corridorLine?.length) {
      const pts = sceneState.corridorLine.map((p) => renderer.project(p));
      drawPolyline2D(ctx, pts);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.30)';
      ctx.lineWidth = 15;
      ctx.stroke();
      drawPolyline2D(ctx, pts);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 6.5;
      ctx.stroke();
    }

    // 6. Semafori sugli incroci (non comandati -> telecamere -> comandati sopra)
    const isAxisScene = hasHighlightedAxis && !sceneState.ambPos;
    const controlledSemLabels = [];
    if (sceneState.showSemafori) {
      for (const sem of sceneState.sems) {
        if (sem.controlled) continue;
        const p = renderer.project(sem.pos);
        if (!p || p[0] < -20 || p[0] > renderer.width + 20 || p[1] < -20 || p[1] > renderer.height + 20) continue;
        ctx.globalAlpha = hasHighlightedAxis ? 0.32 : 1;
        drawCircle2D(ctx, p[0], p[1], 5.5, '#ffffff');
        drawCircle2D(ctx, p[0], p[1], 4, sem.state === 'verde' ? '#16a34a' : '#dc2626');
      }
      ctx.globalAlpha = 1;
    }

    // 6b. Telecamere dell'asse (L1)
    if (sceneState.cameras?.length > 0) {
      const camLabels = [];
      for (const cam of sceneState.cameras) {
        const p = renderer.project(cam.pos);
        if (!p || p[0] < -30 || p[0] > renderer.width + 30 || p[1] < -30 || p[1] > renderer.height + 30) continue;
        const angle = cam.angle ?? 0;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.arc(p[0], p[1], 28, angle - 0.42, angle + 0.42);
        ctx.closePath();
        ctx.fillStyle = cam.flashing ? 'rgba(245, 158, 11, 0.34)' : 'rgba(47, 107, 79, 0.22)';
        ctx.fill();

        if (cam.flashing) {
          drawCircle2D(ctx, p[0], p[1], 18, 'rgba(245, 158, 11, 0.28)');
          ctx.beginPath();
          ctx.arc(p[0], p[1], 13, 0, Math.PI * 2);
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = '#f59e0b';
          ctx.stroke();
        }

        drawCircle2D(ctx, p[0], p[1], 7, '#ffffff');
        drawCircle2D(ctx, p[0], p[1], 4.8, cam.flashing ? '#d97706' : '#0f172a');
        placedBoxes.push({ x: p[0] - 12, y: p[1] - 12, w: 24, h: 24 });
        if (cam.name) camLabels.push({ cam, p });
      }

      ctx.font = '600 9px Poppins, sans-serif';
      for (const { cam, p } of camLabels) {
        const w = ctx.measureText(cam.name).width + 10;
        const h = 16;
        const slots = [
          { x: p[0] - w / 2, y: p[1] + 20 },
          { x: p[0] - w / 2, y: p[1] - 34 },
          { x: p[0] - w - 18, y: p[1] - 8 },
          { x: p[0] + 18, y: p[1] - 8 },
          { x: p[0] - w / 2, y: p[1] + 40 },
          { x: p[0] - w / 2, y: p[1] - 54 }
        ];
        const chosen = slots.find((s) => !collidesBox({ x: s.x, y: s.y, w, h }, placedBoxes, 4)) || slots[0];
        const box = { x: chosen.x, y: chosen.y, w, h };
        placedBoxes.push(box);
        ctx.fillStyle = 'rgba(13, 25, 23, 0.9)';
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = cam.flashing ? '#fde68a' : '#e2e8f0';
        ctx.fillText(cam.name, box.x + 5, box.y + 11);
      }
    }

    // 6c. Semafori comandati dal Master (sempre ben visibili sopra il resto)
    if (sceneState.showSemafori) {
      for (const sem of sceneState.sems) {
        if (!sem.controlled) continue;
        const p = renderer.project(sem.pos);
        if (!p || p[0] < -20 || p[0] > renderer.width + 20 || p[1] < -20 || p[1] > renderer.height + 20) continue;
        if (isAxisScene) {
          drawCircle2D(ctx, p[0], p[1], 16, 'rgba(74, 222, 128, 0.22)');
          placedBoxes.push({ x: p[0] - 16, y: p[1] - 16, w: 32, h: 32 });
          const shortName = sem.name ? sem.name.split('·').pop().trim() : sem.id;
          controlledSemLabels.push({ p, text: `+20s · ${shortName}` });
        }
        ctx.beginPath();
        ctx.arc(p[0], p[1], 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#4ade80';
        ctx.stroke();
        drawCircle2D(ctx, p[0], p[1], 7.5, '#ffffff');
        drawCircle2D(ctx, p[0], p[1], 5.6, sem.state === 'verde' ? '#16a34a' : '#dc2626');
      }

      if (controlledSemLabels.length > 0) {
        ctx.font = '600 9.5px Poppins, sans-serif';
        for (const { p, text } of controlledSemLabels) {
          const w = ctx.measureText(text).width + 12;
          const h = 17;
          const slots = [
            { x: p[0] - w / 2, y: p[1] - 32 },
            { x: p[0] - w / 2, y: p[1] + 20 },
            { x: p[0] - w - 16, y: p[1] - 8 },
            { x: p[0] + 16, y: p[1] - 8 },
            { x: p[0] - w / 2, y: p[1] - 52 },
            { x: p[0] - w / 2, y: p[1] + 40 }
          ];
          const chosen = slots.find((s) => !collidesBox({ x: s.x, y: s.y, w, h }, placedBoxes, 4)) || slots[0];
          const box = { x: chosen.x, y: chosen.y, w, h };
          placedBoxes.push(box);
          ctx.fillStyle = 'rgba(13, 25, 23, 0.92)';
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, w, h, 999);
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = '#4ade80';
          ctx.stroke();
          ctx.fillStyle = '#86efac';
          ctx.fillText(text, box.x + 6, box.y + 11.5);
        }
      }
    }

    // 7. Punto di blocco ed endpoints
    if (sceneState.blockPoint) {
      const p = renderer.project(sceneState.blockPoint);
      if (p) {
        drawCircle2D(ctx, p[0], p[1], 13, 'rgba(239, 68, 68, 0.25)');
        drawCircle2D(ctx, p[0], p[1], 8, '#ffffff');
        drawCircle2D(ctx, p[0], p[1], 5.5, '#b42318');
      }
    }
    for (const ep of sceneState.endpoints) {
      const p = renderer.project(ep.pos);
      if (!p) continue;
      drawCircle2D(ctx, p[0], p[1], 8.5, '#ffffff');
      drawCircle2D(ctx, p[0], p[1], 6, ep.kind === 'from' ? '#b42318' : '#2f6b4f');
    }

    // 8. Mezzi TPL animati (treni, metro, funicolari, tram, bus, aerei)
    if (sceneState.mode !== 'none' && sceneState.enabled.size > 0) {
      const hasHighlight = sceneState.highlight.size > 0;
      const baseScale = sceneState.transitAlpha;
      for (const v of sim.vehicles) {
        if (v.active === false || !sceneState.enabled.has(v.lineId)) continue;
        const line = sim.lineMap.get(v.lineId);
        const air = line.kind === 'air';
        const bus = line.kind === 'bus';
        const isHi = sceneState.highlight.has(v.lineId);
        const dimMul = hasHighlight && !isHi ? 0.35 : 1;

        const world = sim.position(v);
        const p = renderer.project(world);
        if (!p || p[0] < -30 || p[0] > renderer.width + 30 || p[1] < -30 || p[1] > renderer.height + 30) continue;

        if (sceneState.showTrails && v.velocity > 0.4) {
          const trail = [];
          for (let i = 8; i >= 0; i--) {
            trail.push(renderer.project(sim.position(v, -v.direction * i * (air ? 170 : 14))));
          }
          drawPolyline2D(ctx, trail);
          ctx.strokeStyle = v.color;
          ctx.globalAlpha = (isHi ? 0.72 : air ? 0.45 : bus ? 0.24 : 0.35) * baseScale * dimMul;
          ctx.lineWidth = isHi ? 3.5 : air ? 2 : 2.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const next = renderer.project(sim.position(v, v.direction * (air ? 100 : 15)));
        const angle = next ? Math.atan2(next[1] - p[1], next[0] - p[0]) : 0;

        ctx.globalAlpha = baseScale * dimMul;
        drawCircle2D(ctx, p[0], p[1], isHi ? 15 : air ? 14 : bus ? 7.5 : 11, `${v.color}28`);

        if (air) {
          const shadow = renderer.project([world[0], 90, world[2]]);
          if (shadow) {
            drawPolyline2D(ctx, [shadow, p]);
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = v.color;
            ctx.globalAlpha = 0.28 * baseScale;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = baseScale * dimMul;
            drawCircle2D(ctx, shadow[0], shadow[1], 2, `${v.color}77`);
          }
        }

        if (sceneState.selectedVehicle === v.id || isHi) {
          ctx.strokeStyle = sceneState.selectedVehicle === v.id ? '#ffffff' : v.color;
          ctx.lineWidth = sceneState.selectedVehicle === v.id ? 1.5 : 1.1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], air ? 17 : isHi ? 13 : 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(p[0], p[1]);
        ctx.rotate(angle);
        if (air) {
          ctx.fillStyle = v.color;
          ctx.strokeStyle = '#10272a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(11, 0);
          ctx.lineTo(3, -2);
          ctx.lineTo(-3, -9);
          ctx.lineTo(-5.5, -9);
          ctx.lineTo(-3, -2);
          ctx.lineTo(-8.5, -2);
          ctx.lineTo(-11, -4.5);
          ctx.lineTo(-12, -3.5);
          ctx.lineTo(-10, 0);
          ctx.lineTo(-12, 3.5);
          ctx.lineTo(-11, 4.5);
          ctx.lineTo(-8.5, 2);
          ctx.lineTo(-3, 2);
          ctx.lineTo(-5.5, 9);
          ctx.lineTo(-3, 9);
          ctx.lineTo(3, 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          const w = bus && !isHi ? 9.5 : isHi ? 16 : 13.5;
          const h = bus && !isHi ? 6.5 : isHi ? 10 : 8.5;
          ctx.fillStyle = '#0d1917';
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, bus && !isHi ? 1.8 : 4);
          ctx.fill();
          ctx.strokeStyle = v.color;
          ctx.lineWidth = isHi ? 2.2 : bus ? 1.5 : 1.8;
          ctx.stroke();
          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.moveTo(w / 2 - 2, 0);
          ctx.lineTo(-2, -2);
          ctx.lineTo(-2, 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        hits.vehicles.push({ id: v.id, x: p[0], y: p[1], kind: line.kind });

        if (sceneState.selectedVehicle === v.id || (isHi && v.index < 2 && renderer.distance < 19000)) {
          const label = air ? v.callSign : isHi ? `${line.code} · ${v.index + 1}` : vehicleName(v);
          ctx.font = '600 9px Poppins, sans-serif';
          const width = ctx.measureText(label).width + 10;
          const height = 16;
          const slots = [
            { x: p[0] + 13, y: p[1] - 9 },
            { x: p[0] - width - 13, y: p[1] - 9 },
            { x: p[0] - width / 2, y: p[1] - 25 },
            { x: p[0] - width / 2, y: p[1] + 11 }
          ];
          let chosen = slots.find((s) => !collidesBox({ x: s.x, y: s.y, w: width, h: height }, placedBoxes, 3));
          if (!chosen && sceneState.selectedVehicle === v.id) chosen = slots[0];
          if (chosen) {
            const box = { x: chosen.x, y: chosen.y, w: width, h: height };
            placedBoxes.push(box);
            ctx.fillStyle = 'rgba(13, 25, 23, 0.9)';
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, width, height, 4);
            ctx.fill();
            ctx.fillStyle = v.color;
            ctx.fillText(label, box.x + 5, box.y + 11);
          }
        }
      }
    }

    // 8b. Callout zone di rischio attive (sopra corridoi e veicoli per massima leggibilità)
    if (deferredRiskLabels.length > 0) {
      ctx.font = '600 10px Poppins, sans-serif';
      for (const { cp, box, text, w, h, distFromAnchor } of deferredRiskLabels) {
        if (distFromAnchor > 10) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cp[0], cp[1]);
          ctx.lineTo(box.x + w / 2, box.y + h / 2);
          ctx.stroke();
          drawCircle2D(ctx, cp[0], cp[1], 3, '#fbbf24');
        }
        ctx.fillStyle = 'rgba(17, 24, 39, 0.92)';
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, w, h, 999);
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.fillText(text, box.x + 7, box.y + 13.5);
      }
    }

    // 9. Beacon ambulanza AMB-118 su canvas + proiezione dei pin DOM 3D
    if (sceneState.ambPos) {
      const p = renderer.project(sceneState.ambPos);
      if (p) {
        drawCircle2D(ctx, p[0], p[1], 16, 'rgba(22, 163, 74, 0.25)');
        drawCircle2D(ctx, p[0], p[1], 9, '#16a34a');
        drawCircle2D(ctx, p[0], p[1], 4.5, '#ffffff');
      }
    }

    for (const pin of sceneState.pins) {
      const p = renderer.project(pin.pos);
      const visible = p && p[0] > -60 && p[0] < renderer.width + 60 && p[1] > -40 && p[1] < renderer.height + 40;
      pin.node.hidden = !visible;
      if (visible) {
        pin.node.style.left = `${p[0].toFixed(1)}px`;
        pin.node.style.top = `${p[1].toFixed(1)}px`;
      }
    }
  }

  function applyWave(p, autoSems = true) {
    sceneState.waveP = p;
    const { line, point } = slicePath3D(ambAPts, p);
    sceneState.corridorLine = line;
    sceneState.ambPos = point;
    setPin('amb-118', point, 'AMB-118 · Codice Rosso', 'amb');
    if (autoSems) {
      const base = new Map(sems3dBase.map((s) => [s.id, s.state]));
      sceneState.sems.forEach((s) => {
        const f = semFraction.get(s.id);
        if (f == null) return;
        const open = p >= f - WAVE_AHEAD && p <= f + WAVE_BEHIND;
        s.controlled = open;
        s.state = open ? 'verde' : base.get(s.id);
      });
    }
    overlayDirty = true;
  }

  function renderFrame(now = performance.now()) {
    const wasDirty = renderer.dirty || Boolean(renderer.cameraAnim) || Boolean(renderer.dimAnim);
    renderer.draw(now);
    if (wasDirty || overlayDirty) {
      drawOverlay();
      overlayDirty = false;
    }
    if (engineRef?.state?.playing && now - lastHudTime > 220) {
      lastHudTime = now;
      updateKpis();
      if (sceneState.selectedVehicle || sceneState.selectedStation) updateSelectionCard();
    }
  }

  let lastSimulationFrame = null;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDelta = lastSimulationFrame === null ? 0 : Math.min((now - lastSimulationFrame) / 1000, 0.1);
    lastSimulationFrame = now;
    if (sceneState.follow && sceneState.selectedVehicle) {
      const v = sim.vehicles.find((x) => x.id === sceneState.selectedVehicle);
      if (v) {
        renderer.follow(sim.position(v));
        overlayDirty = true;
      }
    }
    const isPlaying = Boolean(engineRef?.state?.playing);
    if (isPlaying && sceneState.wave) {
      const w = sceneState.wave;
      const k = Math.max(0, Math.min(1, (engineRef.state.t - w.t0) / w.ms));
      applyWave(w.from + (w.to - w.from) * k, true);
      if (k >= 1) sceneState.wave = null;
    }
    if (isPlaying) {
      sim.seekTo((engineRef.state.t / 1000) * 5);
      overlayDirty = true;
    } else if (engineRef?.state?.ended) {
      // Keep the city alive after the scripted presentation, but respect manual pauses.
      sim.seekTo(sim.time + frameDelta * 5);
      overlayDirty = true;
      if (now - lastHudTime > 220) {
        lastHudTime = now;
        updateKpis();
        if (sceneState.selectedVehicle || sceneState.selectedStation) updateSelectionCard();
      }
    }
    renderFrame(now);
  }

  function renderCallouts(list) {
    if (!list || !list.length) {
      mapCallouts.hidden = true;
      mapCallouts.replaceChildren();
      return;
    }
    mapCallouts.replaceChildren();
    list.forEach((item) => {
      const box = el('div', `map-callout${item.chosen ? ' is-chosen' : ''}${item.blocked ? ' is-blocked' : ''}`);
      box.append(el('span', 'mc-name', item.label), el('span', 'mc-eta', item.eta));
      mapCallouts.appendChild(box);
    });
    mapCallouts.hidden = false;
  }

  function renderEvents(items) {
    eventsList.replaceChildren();
    items.forEach((ev) => {
      const btn = el(
        'button',
        `nos-event-item${ev.level === 'red' ? ' is-critical' : ev.level === 'active' ? ' is-active' : ''}`
      );
      btn.type = 'button';
      const top = el('div', 'ev-top');
      top.append(el('span', 'ev-badge', ev.badge), el('span', 'ev-time', ev.time));
      btn.append(top, el('h2', 'ev-title', ev.title), el('p', 'ev-detail', ev.detail));
      if (ev.center) {
        btn.addEventListener('click', () => {
          renderer.flyToCamera({ center: ev.center, distance: 4800, el: 0.72, ms: 900 }, true);
          overlayDirty = true;
        });
      }
      eventsList.appendChild(btn);
    });
    eventsCount.textContent = `${items.length} ${items.length === 1 ? 'attivo' : 'attivi'}`;
    statusEvents.textContent = `${items.length} eventi aperti`;
  }

  function renderAgents(activeList = []) {
    const byName = new Map(activeList.map((a) => [a.name, a]));
    agentsGrid.replaceChildren();
    ALL_AGENTS.forEach((name) => {
      const info = byName.get(name);
      const row = el('div', `agent-row${info ? ' is-busy' : ''}`);
      row.append(
        el('span', 'ag-dot'),
        el('span', 'ag-name', name),
        el('span', 'ag-state', info ? `${info.status} · ${info.task}` : 'in ascolto')
      );
      agentsGrid.appendChild(row);
    });
    // Moduli aggiunti (es. Illuminazione, Igiene urbana): un mestiere nuovo è un agente in più
    activeList.filter((a) => !ALL_AGENTS.includes(a.name)).forEach((info) => {
      const row = el('div', 'agent-row is-busy is-module');
      row.append(
        el('span', 'ag-dot'),
        el('span', 'ag-name', info.name),
        el('span', 'ag-state', `${info.status} · ${info.task}`)
      );
      agentsGrid.appendChild(row);
    });
  }

  btnRevoca.addEventListener('click', () => {
    if (engineRef?.signal('click:revoca')) return;
    decisionCard.classList.add('is-revoked');
    decStatus.textContent = 'Revoca richiesta dall’operatore';
    btnRevoca.disabled = true;
  });

  // Destinatario 'mappa' per il motore a timeline
  const mappa = {
    begin({
      view = 'center',
      target,
      center,
      distance,
      zoom,
      az,
      bearing,
      el: pitchEl,
      pitch,
      transitMode = 'mixed',
      transitAlpha = 0.85,
      highlightLines = [],
      dormant = false,
      showAssi = true,
      showSemafori = true
    } = {}) {
      clearPins();
      clearSelection();
      sim.seekTo(0);
      sceneState.assi = clone(assi3dBase);
      sceneState.sems = clone(sems3dBase);
      sceneState.routes = [];
      sceneState.corridorLine = null;
      sceneState.wave = null;
      sceneState.waveP = 0;
      sceneState.endpoints = [];
      sceneState.blockPoint = null;
      sceneState.ambPos = null;
      sceneState.riskOpacity = 0;
      sceneState.activeRiskIds = new Set();
      sceneState.rischio = clone(rischio3dBase);
      sceneState.illuminatedCorridor = false;
      sceneState.cameras = [];
      sceneState.axisBadge = null;
      sceneState.showAssi = showAssi;
      sceneState.showSemafori = showSemafori;

      applyTransitConfig({ mode: transitMode, highlightLines, transitAlpha });
      renderer.setDormant(dormant, { animate: false });

      if (target || center || distance != null || zoom != null || az != null || bearing != null || pitchEl != null || pitch != null) {
        renderer.flyToCamera({ target, center, distance, zoom, az, bearing, el: pitchEl, pitch, ms: 0 }, false);
        viewButtons.forEach((b) => b.classList.remove('is-active'));
      } else {
        renderer.setView(view, false);
        viewButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
      }

      statusCorridor.hidden = true;
      visionFlash.hidden = true;
      openingOverlay.hidden = true;
      openingOverlay.replaceChildren();
      renderCallouts([]);
      overlayDirty = true;
      renderFrame(performance.now());
    },

    flyTo({ view, target, center, distance, zoom, az, bearing, el: pitchEl, pitch, ms = 1600 } = {}, ctx) {
      const animate = Boolean(ctx?.engine?.state?.playing);
      if (view) {
        viewButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
      } else {
        viewButtons.forEach((b) => b.classList.remove('is-active'));
      }
      renderer.flyToCamera({ view, target, center, distance, zoom, az, bearing, el: pitchEl, pitch, ms }, animate);
      overlayDirty = true;
      renderFrame(performance.now());
    },

    setTransit({ mode, transitAlpha, highlightLines, dormant, showAssi, showSemafori, ms = 1200 } = {}, ctx) {
      const animate = Boolean(ctx?.engine?.state?.playing);
      if (dormant !== undefined) renderer.setDormant(dormant, { animate, ms });
      if (showAssi !== undefined) sceneState.showAssi = showAssi;
      if (showSemafori !== undefined) sceneState.showSemafori = showSemafori;
      applyTransitConfig({
        mode: mode ?? sceneState.mode,
        highlightLines: highlightLines !== undefined ? highlightLines : null,
        transitAlpha: transitAlpha ?? sceneState.transitAlpha
      });
      renderFrame(performance.now());
    },

    setAxis({
      reset = false,
      view,
      target,
      center,
      distance,
      zoom,
      az,
      bearing,
      el: pitchEl,
      pitch,
      ms = 0,
      id = 'via-marina',
      status = 'rosso',
      highlight = true,
      controlledSems = null,
      semState = 'verde',
      flashCameras = null,
      cameras = null,
      axisBadge = undefined,
      flashTag = undefined,
      flashTitle = undefined,
      flashSub = undefined,
      corridorText = null,
      callouts = null
    } = {}, ctx) {
      if (reset) {
        mappa.begin({
          view,
          target,
          center,
          distance,
          zoom,
          az,
          bearing,
          el: pitchEl,
          pitch,
          transitMode: 'mixed',
          transitAlpha: 0.22,
          highlightLines: ['TRAM_412'],
          showAssi: true,
          showSemafori: true
        });
      } else if (
        view !== undefined ||
        target !== undefined ||
        center !== undefined ||
        distance != null ||
        zoom != null ||
        az != null ||
        bearing != null ||
        pitchEl != null ||
        pitch != null
      ) {
        mappa.flyTo({ view, target, center, distance, zoom, az, bearing, el: pitchEl, pitch, ms }, ctx);
      }

      sceneState.assi.forEach((a) => {
        if (a.id === id) {
          a.status = status;
          a.highlight = Boolean(highlight);
        }
      });

      if (Array.isArray(controlledSems)) {
        const controlledSet = new Set(controlledSems);
        sceneState.sems.forEach((s) => {
          if (controlledSet.has(s.id)) {
            s.controlled = true;
            if (semState) s.state = semState;
          } else {
            s.controlled = false;
          }
        });
      }

      if (flashCameras !== null || Array.isArray(cameras)) {
        const defaultCameras = [
          { id: 'cam-marina-1', name: 'CAM-M1 · Porta di Massa', lonLat: [14.25836, 40.84348], angle: 0.42 },
          { id: 'cam-marina-2', name: 'CAM-M2 · Incrocio Duomo', lonLat: [14.26321, 40.84576], angle: 0.18 }
        ];
        const sourceCameras = Array.isArray(cameras) ? cameras : defaultCameras;
        sceneState.cameras = sourceCameras.map((cam) => ({
          id: cam.id,
          name: cam.name,
          angle: cam.angle ?? 0,
          flashing: cam.flashing !== undefined ? Boolean(cam.flashing) : Boolean(flashCameras),
          pos: renderer.lonLatToWorld(cam.lonLat[0], cam.lonLat[1], 15)
        }));
      }

      if (axisBadge !== undefined) {
        sceneState.axisBadge = axisBadge;
      }

      if (flashTitle !== undefined) {
        if (flashTitle) {
          visionFlash.replaceChildren(
            el('span', 'vf-tag', flashTag || ''),
            el('strong', 'vf-title', flashTitle),
            el('span', 'vf-sub', flashSub || '')
          );
          visionFlash.hidden = false;
        } else {
          visionFlash.hidden = true;
        }
      }

      if (corridorText !== null) {
        if (corridorText) {
          statusCorridorText.textContent = corridorText;
          statusCorridor.hidden = false;
        } else {
          statusCorridor.hidden = true;
        }
      }

      if (callouts !== null) {
        renderCallouts(callouts);
      }

      overlayDirty = true;
      renderFrame(performance.now());
    },

    openingCard({
      hidden = false,
      captions = [],
      activeIndex = -1,
      kicker = '',
      headline = '',
      subline = '',
      showBrands = false
    } = {}) {
      if (hidden) {
        openingOverlay.hidden = true;
        openingOverlay.replaceChildren();
        return;
      }
      openingOverlay.replaceChildren();
      if (captions.length) {
        const capWrap = el('div', 'op-captions');
        captions.forEach((txt, idx) => {
          capWrap.appendChild(el('span', `op-caption${idx === activeIndex ? ' is-current' : ''}`, txt));
        });
        openingOverlay.appendChild(capWrap);
      }
      if (headline || subline || showBrands) {
        const hero = el('div', 'op-hero');
        if (kicker) hero.appendChild(el('span', 'op-kicker', kicker));
        if (headline) hero.appendChild(el('h2', 'op-title', headline));
        if (subline) hero.appendChild(el('p', 'op-sub', subline));
        if (showBrands) {
          const brands = el('div', 'op-brands');
          const b1 = el('div', 'op-brand-pill is-primary');
          b1.append(el('strong', null, 'NapoliOS'), el('span', null, 'Per chi governa la città · Sala Operativa'));
          const b2 = el('div', 'op-brand-pill');
          b2.append(el('strong', null, 'Fatt’ APPosta'), el('span', null, 'Per chi la vive · Assistente cittadino'));
          brands.append(b1, b2);
          hero.appendChild(brands);
        }
        openingOverlay.appendChild(hero);
      }
      openingOverlay.hidden = false;
    },

    showMission({ from, to, fromLabel = 'Centro Storico', toLabel = 'Osp. Cardarelli' }) {
      const fromPos = renderer.lonLatToWorld(from[0], from[1], 14);
      const toPos = renderer.lonLatToWorld(to[0], to[1], 14);
      sceneState.endpoints = [
        { kind: 'from', pos: fromPos },
        { kind: 'to', pos: toPos }
      ];
      clearPins();
      setPin('ep-from', fromPos, fromLabel, 'red');
      setPin('ep-to', toPos, toLabel, 'accent');
      overlayDirty = true;
      renderFrame(performance.now());
    },

    showRoutes({ ids = ['amb-a', 'amb-b', 'amb-c'], chosen = null, callouts = [] }) {
      const wanted = new Set(ids);
      sceneState.routes = clone(percorsi3dBase)
        .filter((r) => wanted.has(r.id))
        .map((r) => ({ ...r, state: chosen === r.id ? 'chosen' : 'candidate' }));
      renderCallouts(callouts);
      overlayDirty = true;
      renderFrame(performance.now());
    },

    blockRoute({ id = 'amb-b', point, label = 'Blocco su Via Foria', callouts = [] }) {
      sceneState.routes = clone(percorsi3dBase).map((r) => ({
        ...r,
        state: r.id === id ? 'blocked' : r.id === 'amb-a' ? 'chosen' : 'dimmed'
      }));
      if (point) {
        const pt3 = renderer.lonLatToWorld(point[0], point[1], 14);
        sceneState.blockPoint = pt3;
        setPin('block', pt3, label, 'red');
      }
      if (callouts.length) renderCallouts(callouts);
      overlayDirty = true;
      renderFrame(performance.now());
    },

    // Onda verde. Con { to, ms } l'ambulanza avanza in modo continuo sul tempo di scena e i semafori
    // del corridoio si aprono da soli davanti al mezzo e tornano al ciclo normale dopo il passaggio.
    greenWave({ progress, from, to, ms = 0, activeSems: onIds = null, passedSems = null, etaText = '' } = {}, ctx) {
      const playing = Boolean(ctx?.engine?.state?.playing);
      if (etaText) {
        statusCorridorText.textContent = etaText;
        statusCorridor.hidden = false;
      }
      if (to == null && progress == null && !onIds && !passedSems) {
        // Solo il testo della barra: un'onda in corso prosegue
      } else if (to != null && ms > 0 && playing) {
        sceneState.wave = { from: from ?? sceneState.waveP ?? 0, to, t0: ctx.t, ms };
        applyWave(sceneState.wave.from, true);
      } else {
        sceneState.wave = null;
        if (to != null || progress != null) applyWave(to ?? progress, !(onIds || passedSems));
        if (onIds || passedSems) {
          const onSet = new Set(onIds ?? []);
          const passSet = new Set(passedSems ?? []);
          sceneState.sems.forEach((s) => {
            if (onSet.has(s.id)) { s.state = 'verde'; s.controlled = true; }
            else if (passSet.has(s.id)) { s.state = 'verde'; s.controlled = false; }
          });
        }
      }
      overlayDirty = true;
      renderFrame(performance.now());
    },

    finishMission({ etaText = 'AMB-118 al Cardarelli · 6 min 40 s (-4 min 20 s)' } = {}) {
      sceneState.wave = null;
      sceneState.waveP = 1;
      sceneState.sems = clone(sems3dBase);
      const { line, point } = slicePath3D(ambAPts, 1);
      sceneState.corridorLine = line;
      sceneState.ambPos = point;
      setPin('amb-118', point, 'AMB-118 · Arrivata ✓', 'amb');
      statusCorridorText.textContent = etaText;
      statusCorridor.hidden = false;
      overlayDirty = true;
      renderFrame(performance.now());
    },

    riskHeatmap({
      opacity = 0.45,
      flashTag = '',
      flashTitle = '',
      flashSub = '',
      activeIds = [],
      highlightLines = null,
      illuminatedCorridor = false,
      transitAlpha
    } = {}) {
      sceneState.riskOpacity = opacity;
      sceneState.activeRiskIds = new Set(activeIds);
      sceneState.illuminatedCorridor = Boolean(illuminatedCorridor);
      if (highlightLines !== null || transitAlpha !== undefined) {
        applyTransitConfig({
          mode: sceneState.mode,
          highlightLines: highlightLines !== null ? highlightLines : undefined,
          transitAlpha: transitAlpha ?? sceneState.transitAlpha
        });
      }
      if (flashTitle) {
        visionFlash.replaceChildren(
          el('span', 'vf-tag', flashTag),
          el('strong', 'vf-title', flashTitle),
          el('span', 'vf-sub', flashSub)
        );
        visionFlash.hidden = false;
      } else {
        visionFlash.hidden = true;
      }
      overlayDirty = true;
      renderFrame(performance.now());
    },

    reset() {
      mappa.begin();
    }
  };

  let currentEvents = clone(BASE_EVENTS);
  const orchestratore = {
    reset() {
      currentEvents = clone(BASE_EVENTS);
      renderEvents(currentEvents);
      renderAgents([]);
      decisionCard.hidden = true;
      decisionCard.classList.remove('is-revoked');
      btnRevoca.disabled = false;
      btnRevoca.textContent = 'Revoca';
      orchStream.replaceChildren();
    },
    addEvent({ id, badge, title, detail, level = 'red', center }, ctx) {
      currentEvents = [
        { id, badge, time: ctx.clock, title, detail, level, center },
        ...currentEvents.filter((e) => e.id !== id)
      ];
      renderEvents(currentEvents);
    },
    agents({ active = [] }) {
      renderAgents(active);
    },
    say({ from = 'Master', text, sublines = [] }, ctx) {
      const card = el('article', 'orch-msg');
      const head = el('div', 'om-head');
      head.append(el('span', 'om-from', from), el('span', 'om-time', ctx.clock));
      card.append(head, el('p', 'om-text', text));
      if (sublines.length) {
        const subs = el('div', 'om-subs');
        sublines.forEach((s) => {
          const line = el('p', 'om-sub');
          line.append(el('strong', null, `${s.agent}: `), document.createTextNode(s.text));
          subs.appendChild(line);
        });
        card.appendChild(subs);
      }
      orchStream.appendChild(card);
      orchStream.scrollTop = orchStream.scrollHeight;
    },
    decide({ level = 'A3 Priorità', status = 'In esecuzione immediata', title, effect, cost, rule, revocable = true, revokeLabel = 'Revoca' }) {
      decLevel.textContent = level;
      decStatus.textContent = status;
      decTitle.textContent = title;
      decEffect.textContent = effect;
      decCost.textContent = cost;
      decRule.textContent = rule;
      decisionCard.classList.remove('is-revoked');
      btnRevoca.hidden = !revocable;
      const note = decisionCard.querySelector('.dec-note');
      if (note) note.textContent = revocable ? 'Regolatori deterministici sugli incroci' : 'Nessuna esecuzione automatica: firma di una persona';
      btnRevoca.disabled = false;
      btnRevoca.textContent = revokeLabel;
      decisionCard.hidden = false;
    },
    decisionStatus({ status, revoked = false, revokeLabel }) {
      decStatus.textContent = status;
      decisionCard.classList.toggle('is-revoked', revoked);
      if (revokeLabel !== undefined) btnRevoca.textContent = revokeLabel;
    }
  };

  const registro = {
    reset() {
      registryBody.replaceChildren();
      const tr = el('tr', 'reg-empty');
      const td = el('td', null, 'In attesa di decisioni dell’orchestratore…');
      td.colSpan = 6;
      tr.appendChild(td);
      registryBody.appendChild(tr);
    },
    log({ level, action, rule, cost, outcome }, ctx) {
      const emptyRow = registryBody.querySelector('.reg-empty');
      if (emptyRow) emptyRow.remove();
      const tr = document.createElement('tr');
      const tdLvl = document.createElement('td');
      tdLvl.appendChild(el('span', 'reg-lvl', level));
      const tdOut = el('td', 'reg-outcome', outcome);
      tr.append(
        el('td', null, ctx.clockFull),
        tdLvl,
        el('td', null, action),
        el('td', null, rule),
        el('td', null, cost),
        tdOut
      );
      registryBody.prepend(tr);
    }
  };

  const bus = {
    reset() {},
    send({ type = 'advisory.push', target = '', summary = '' }, ctx) {
      const card = el('article', 'orch-msg is-bus');
      const head = el('div', 'om-head');
      head.append(el('span', 'om-from', `Bus · ${type}`), el('span', 'om-time', ctx.clock));
      card.append(head, el('p', 'om-text', target ? `${target}: ${summary}` : summary));
      orchStream.appendChild(card);
      orchStream.scrollTop = orchStream.scrollHeight;
    }
  };

  orchestratore.reset();
  registro.reset();
  applyTransitConfig({ mode: 'mixed', highlightLines: [], transitAlpha: 0.85 });

  // A direct visit should open an animated demo, not an empty/paused timeline.
  const demoUrl = new URL(window.location.href);
  if (!demoUrl.searchParams.has('scena')) {
    demoUrl.searchParams.set('scena', 'apertura');
    if (!demoUrl.searchParams.has('autoplay')) demoUrl.searchParams.set('autoplay', '1');
    window.history.replaceState(null, '', demoUrl);
  }

  const engine = await startRegia({
    showHud: false,
    targets: { mappa, orchestratore, registro, bus },
    scenes: SCENES,
    onLoad(script) {
      if (script.clock) statusClock.textContent = script.clock;
    }
  });
  engineRef = engine;

  engine.onState((s) => {
    statusClock.textContent = s.clock;
    if (!s.playing) {
      sim.seekTo((s.t / 1000) * 5);
      updateKpis();
      if (sceneState.selectedVehicle || sceneState.selectedStation) updateSelectionCard();
      overlayDirty = true;
      renderFrame(performance.now());
    }
  });

  window.__napolios = {
    renderer,
    sim,
    state: sceneState,
    engine,
    getKpis: () => ({
      vehicles: Number(kpiVehicles.textContent),
      lines: Number(kpiLines.textContent),
      moving: Number(kpiMoving.textContent),
      meshes: renderer.meshes.map((m) => m.name)
    })
  };

  requestAnimationFrame(frame);
}

init().catch((err) => {
  console.error('[NapoliOS]', err);
  const mapLoading = document.getElementById('map-loading');
  if (mapLoading) {
    mapLoading.hidden = false;
    mapLoading.textContent = `Errore caricamento 3D: ${err.message}`;
  }
});
