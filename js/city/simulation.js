// Simulazione deterministica basata su regole per le 235 linee e 509 mezzi di Napoli.
// Adattata da city-viewer per sincronizzarsi con l'orologio di scena di js/engine.js.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function travelProfile(distance, maxSpeed, acceleration) {
  const peak = Math.min(maxSpeed, Math.sqrt(distance * acceleration));
  const ramp = peak / acceleration;
  const cruise = Math.max(0, (distance - (peak * peak) / acceleration) / peak);
  return { peak, ramp, cruise, duration: 2 * ramp + cruise };
}

function profileAt(t, p, a) {
  if (t < p.ramp) return { distance: 0.5 * a * t * t, speed: a * t };
  if (t < p.ramp + p.cruise) {
    return {
      distance: 0.5 * a * p.ramp * p.ramp + p.peak * (t - p.ramp),
      speed: p.peak
    };
  }
  const u = Math.min(p.ramp, t - p.ramp - p.cruise);
  return {
    distance: 0.5 * a * p.ramp * p.ramp + p.peak * p.cruise + p.peak * u - 0.5 * a * u * u,
    speed: Math.max(0, p.peak - a * u)
  };
}

function buildTimeline(line) {
  let clock = 0;
  const phases = [];
  const n = line.stations.length;
  const order = line.loop
    ? [...Array(n).keys()]
    : [...Array(n).keys(), ...Array.from({ length: n - 1 }, (_, i) => n - 2 - i)];
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i];
    const to = order[i + 1];
    const dir = to > from ? 1 : -1;
    const start = line.stations[from].distance;
    const end = line.stations[to].distance;
    const profile = travelProfile(Math.abs(end - start), line.maxSpeed, line.acceleration);
    phases.push({
      type: 'move',
      begin: clock,
      end: clock + profile.duration,
      from,
      to,
      dir,
      start,
      finish: end,
      profile
    });
    clock += profile.duration;
    const dwell = to === 0 || to === n - 1 ? line.terminalDwell : line.dwell;
    phases.push({ type: 'dwell', begin: clock, end: clock + dwell, at: to, dir });
    clock += dwell;
  }
  return { phases, duration: clock };
}

export class MobilitySimulation {
  constructor(data) {
    this.lines = data.lines;
    this.lineMap = new Map(this.lines.map((l) => [l.id, l]));
    this.events = [];
    this.reset();
  }

  reset() {
    this.time = 0;
    this.playing = true;
    this.speed = 5;
    this.scenario = false;
    this.scenarioUntil = 0;
    this.events = [];
    this.vehicles = [];
    this.byLine = new Map();

    for (const line of this.lines) {
      this.byLine.set(line.id, []);
      line.timeline = buildTimeline(line);
      for (let i = 0; i < line.fleet; i++) {
        const offset = (((i + 0.31) / line.fleet) * line.timeline.duration) % line.timeline.duration;
        const phase = line.timeline.phases.find((p) => offset >= p.begin && offset < p.end) || line.timeline.phases[0];
        const v = {
          id: `${line.id}-${String(i + 1).padStart(2, '0')}`,
          lineId: line.id,
          color: line.color,
          distance: 0,
          velocity: 0,
          direction: 1,
          targetIndex: 1,
          stationIndex: 0,
          dwellRemaining: 0,
          status: 'moving',
          occupancy: 37 + ((i * 13 + line.stations.length) % 42),
          stops: 0,
          hold: false,
          active: true,
          index: i
        };

        if (line.kind === 'air') {
          v.airOffset = (i * line.airPeriod) / line.fleet + (line.airRole === 'departure' ? 75 : 0);
          v.airCycle = -1;
          this.updateAir(v, line);
        } else if (phase.type === 'move') {
          const state = profileAt(offset - phase.begin, phase.profile, line.acceleration);
          Object.assign(v, {
            distance: phase.start + phase.dir * state.distance,
            velocity: state.speed,
            direction: phase.dir,
            targetIndex: phase.to,
            stationIndex: phase.from
          });
        } else {
          const at = phase.at;
          const dir = line.loop ? 1 : at === 0 ? 1 : at === line.stations.length - 1 ? -1 : phase.dir;
          Object.assign(v, {
            distance: line.stations[at].distance,
            direction: dir,
            targetIndex: line.loop && at === line.stations.length - 1 ? 1 : at + dir,
            stationIndex: at,
            dwellRemaining: phase.end - offset,
            status: 'dwell',
            resetAfterDwell: line.loop && at === line.stations.length - 1
          });
        }

        if (line.kind !== 'air') {
          v.active = !line.oneWayDisplay || v.direction > 0 || (v.stationIndex === line.stations.length - 1 && v.dwellRemaining > 0);
        }
        this.vehicles.push(v);
        this.byLine.get(line.id).push(v);
      }
    }
  }

  // Porta la simulazione esattamente all'istante targetSeconds in modo deterministico
  seekTo(targetSeconds) {
    const target = Math.max(0, targetSeconds);
    if (target < this.time - 1e-6) {
      const sp = this.speed;
      const pl = this.playing;
      this.reset();
      this.speed = sp;
      this.playing = pl;
    }
    const delta = target - this.time;
    if (delta > 1e-6) {
      this.step(delta);
    }
  }

  pushEvent(lineId, text, type = 'arrival') {
    this.events.unshift({ id: `${this.time}-${this.events.length}-${text}`, lineId, text, type, time: this.time });
    this.events = this.events.slice(0, 40);
  }

  advance(realSeconds) {
    if (!this.playing) return;
    this.step(clamp(realSeconds, 0, 2) * this.speed);
  }

  step(seconds) {
    let remaining = seconds;
    while (remaining > 1e-7) {
      const dt = Math.min(0.08, remaining);
      this.tick(dt);
      remaining -= dt;
    }
  }

  tick(dt) {
    this.time += dt;
    for (const v of this.vehicles) {
      const line = this.lineMap.get(v.lineId);
      if (line.kind === 'air') {
        this.updateAir(v, line);
        continue;
      }
      v.active = !line.oneWayDisplay || v.direction > 0 || (v.stationIndex === line.stations.length - 1 && v.dwellRemaining > 0);
      if (v.dwellRemaining > 0) {
        v.dwellRemaining = Math.max(0, v.dwellRemaining - dt);
        v.velocity = 0;
        v.status = 'dwell';
        if (v.dwellRemaining === 0) {
          v.status = 'moving';
          if (v.resetAfterDwell) {
            v.distance = 0;
            v.stationIndex = 0;
            v.targetIndex = 1;
            v.resetAfterDwell = false;
          }
        }
        continue;
      }

      const station = line.stations[v.targetIndex];
      const remaining = Math.max(0, (station.distance - v.distance) * v.direction);
      const limit = line.maxSpeed;
      let safeGap = Infinity;
      for (const other of this.byLine.get(v.lineId)) {
        if (other === v || other.lineId !== v.lineId || other.direction !== v.direction) continue;
        const gap = (other.distance - v.distance) * v.direction;
        if (gap > 0) safeGap = Math.min(safeGap, gap);
      }

      const safeDistance = Math.max(0, safeGap - 75);
      const targetSpeed = Math.min(limit, Math.sqrt(2 * line.acceleration * remaining), Math.sqrt(2 * 0.85 * safeDistance));
      const nextVelocity = clamp(targetSpeed, v.velocity - 0.85 * dt, v.velocity + line.acceleration * dt);
      const travel = Math.min((v.velocity + nextVelocity) * 0.5 * dt, remaining, Math.max(0, safeGap - 60));

      v.distance = clamp(v.distance + v.direction * travel, 0, line.length);
      v.velocity = nextVelocity;
      v.status = safeGap < 130 ? 'waiting' : 'moving';

      if (remaining - travel < 0.12) {
        v.distance = station.distance;
        v.velocity = 0;
        v.stationIndex = v.targetIndex;
        v.stops++;
        const terminal = v.stationIndex === 0 || v.stationIndex === line.stations.length - 1;
        v.dwellRemaining = terminal ? line.terminalDwell : line.dwell;
        if (line.loop && v.stationIndex === line.stations.length - 1) {
          v.direction = 1;
          v.targetIndex = 1;
          v.resetAfterDwell = true;
        } else {
          if (terminal) v.direction = v.stationIndex === 0 ? 1 : -1;
          v.targetIndex = v.stationIndex + v.direction;
        }
        v.status = 'dwell';
        v.occupancy = clamp(v.occupancy + ((v.stops * 7 + v.id.charCodeAt(v.id.length - 1)) % 19) - 9, 18, 91);
      }
    }
  }

  updateAir(v, line) {
    const age = this.time + v.airOffset;
    const cycle = Math.floor(age / line.airPeriod);
    const phase = age % line.airPeriod;
    const u = Math.min(1, phase / line.airDuration);
    const arrival = line.airRole === 'arrival';
    if (v.airCycle !== cycle) {
      v.airCycle = cycle;
      v.callSign = `DEMO-${arrival ? 'A' : 'D'}${201 + v.index + cycle * line.fleet}`;
    }
    v.active = phase < line.airDuration;
    v.distance = line.length * (arrival ? 1 - Math.pow(1 - u, 1.3) : Math.pow(u, 1.3));
    v.velocity = v.active ? (line.length / line.airDuration) * 1.3 * Math.pow(arrival ? 1 - u : u, 0.3) : 0;
    v.status = v.active ? (arrival ? 'approach' : 'climb') : 'ground';
    v.targetIndex = 1;
    v.direction = 1;
    v.dwellRemaining = 0;
  }

  position(v, offset = 0) {
    const line = this.lineMap.get(v.lineId);
    return this.positionAt(line, clamp(v.distance + offset, 0, line.length), v.direction);
  }

  positionAt(line, distance, direction = 1) {
    const path = line.path;
    let low = 0;
    let high = path.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (path[mid][0] <= distance) low = mid;
      else high = mid;
    }
    const a = path[low];
    const b = path[high];
    const t = clamp((distance - a[0]) / (b[0] - a[0] || 1), 0, 1);
    const dx = b[1] - a[1];
    const dz = b[3] - a[3];
    const len = Math.hypot(dx, dz) || 1;
    const lateral = line.kind === 'air' ? 0 : 6;
    const vertical = line.kind === 'air' ? 0 : 10;
    return [
      a[1] + (b[1] - a[1]) * t - (dz / len) * lateral * direction,
      a[2] + (b[2] - a[2]) * t + vertical,
      a[3] + (b[3] - a[3]) * t + (dx / len) * lateral * direction
    ];
  }

  next(v) {
    const l = this.lineMap.get(v.lineId);
    return l.stations[v.targetIndex];
  }

  destination(v) {
    const l = this.lineMap.get(v.lineId);
    return l.loop ? this.next(v).name : l.stations[v.direction > 0 ? l.stations.length - 1 : 0].name;
  }

  eta(v) {
    const line = this.lineMap.get(v.lineId);
    const remaining = Math.abs(this.next(v).distance - v.distance);
    if (line.kind === 'air') return Math.max(0, Math.ceil(line.airDuration - ((this.time + v.airOffset) % line.airPeriod)));
    const estimate = travelProfile(remaining, line.maxSpeed, line.acceleration).duration - (v.velocity / line.acceleration) * 0.45;
    return Math.ceil(Math.max(1, estimate) + v.dwellRemaining);
  }
}
