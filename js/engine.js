// Motore a timeline: riproduce uno script JSON e pilota le interfacce registrate come destinatari.
// Nessun Date.now() né Math.random() nei valori mostrati: l'unica sorgente di tempo è l'orologio di scena,
// che avanza solo in riproduzione.
//
// Passo: { at | after | on, to, do, args }
//   at    ms dall'inizio della scena (mai prima del passo precedente)
//   after ms dopo il passo precedente (default 0)
//   on    gesto atteso, es. "tap:paga": il passo scatta quando arriva signal("tap:paga")
//   to    destinatario registrato (chat, mappa, orchestratore, registro, bus)
//   do    verbo del destinatario
//
// Destinatario integrato "scena": { to: "scena", do: "clock", args: { to: "22:14:00" } } sposta l'orologio
// di scena a un'ora dichiarata (salto di montaggio); da lì riprende ad avanzare con il tempo di scena.
// { to: "scena", do: "hold" } è un passo vuoto: tiene la scena in riproduzione fino al suo istante.

const MAX_DT = 50; // ms: una scheda in background rallenta la scena invece di farla saltare

export function parseClock(hms = '00:00:00') {
  const [h = 0, m = 0, s = 0] = String(hms).split(':').map((n) => parseInt(n, 10) || 0);
  return h * 3600 + m * 60 + s;
}

const pad = (n) => String(n).padStart(2, '0');

export function formatClock(sec, withSeconds = false) {
  const d = ((Math.floor(sec) % 86400) + 86400) % 86400;
  const hm = `${pad(Math.floor(d / 3600))}:${pad(Math.floor((d % 3600) / 60))}`;
  return withSeconds ? `${hm}:${pad(d % 60)}` : hm;
}

// Errori di forma prima della ripresa, non durante: meglio uno script rifiutato che una scena a metà
export function validateScript(script, targets) {
  const errors = [];
  if (!script || typeof script !== 'object') return ['lo script non è un oggetto JSON'];
  if (!Array.isArray(script.steps) || script.steps.length === 0) errors.push('steps mancante o vuoto');
  if (script.clock != null && !/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(script.clock)) errors.push(`clock non valido: "${script.clock}" (HH:MM o HH:MM:SS)`);
  (script.steps ?? []).forEach((s, i) => {
    const where = `passo ${i}`;
    if (s.at != null && s.after != null) errors.push(`${where}: at e after si escludono (on può affiancare l'uno o l'altro)`);
    if (s.at != null && !(Number.isFinite(s.at) && s.at >= 0)) errors.push(`${where}: at non valido`);
    if (s.after != null && !(Number.isFinite(s.after) && s.after >= 0)) errors.push(`${where}: after non valido`);
    if (s.on != null && typeof s.on !== 'string') errors.push(`${where}: on deve essere una stringa`);
    const target = targets.get(s.to);
    if (!target) errors.push(`${where}: destinatario "${s.to}" non registrato`);
    else if (typeof target[s.do] !== 'function') errors.push(`${where}: "${s.to}" non conosce il verbo "${s.do}"`);
  });
  return errors;
}

export function createEngine() {
  const targets = new Map();
  const listeners = new Set();

  let script = null;
  let start = 0;        // secondi dell'orologio di scena a t = 0
  let t = 0;            // ms di scena trascorsi
  let index = 0;        // prossimo passo da eseguire
  let lastFire = 0;     // tempo di scena dell'ultimo passo eseguito
  let playing = false;
  let waiting = null;   // nome del gesto atteso
  let raf = 0;
  let prev = 0;
  let speed = 1;
  let lastError = null;

  const snapshot = () => ({
    id: script?.id ?? null,
    index,
    total: script?.steps.length ?? 0,
    t,
    clock: formatClock(start + t / 1000, true),
    playing,
    speed,
    waiting,
    ended: Boolean(script) && index >= script.steps.length,
    error: lastError
  });
  const emit = () => {
    if (typeof document !== 'undefined') document.documentElement.dataset.playing = String(playing);
    const s = snapshot();
    listeners.forEach((fn) => fn(s));
  };

  // Destinatario integrato: comandi sulla scena stessa, validi in ogni pagina
  targets.set('scena', {
    clock({ to } = {}) {
      if (!/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(to))) throw new Error(`clock non valido: "${to}"`);
      start = parseClock(to) - t / 1000;
    },
    // Tenuta: passo vuoto che tiene la scena in riproduzione fino all'istante indicato (coda per il montaggio)
    hold() {}
  });

  const ctx = () => ({ t, clock: formatClock(start + t / 1000), clockFull: formatClock(start + t / 1000, true), engine: api });

  // Istante in cui il passo i diventa dovuto; per un passo "on" è l'istante in cui comincia l'attesa
  function dueOf(step) {
    if (step.at != null) return Math.max(step.at, lastFire);
    return lastFire + (step.after ?? 0);
  }

  function fire(step, at) {
    t = Math.max(t, at);
    lastFire = at;
    index += 1;
    waiting = null;
    try {
      targets.get(step.to)[step.do](step.args ?? {}, ctx());
    } catch (err) {
      lastError = `passo ${index - 1} (${step.to}.${step.do}): ${err.message}`;
      console.error('[motore]', lastError, err);
    }
  }

  // Esegue tutti i passi già dovuti, nell'ordine dello script; si ferma su un gesto atteso
  function drain() {
    while (script && index < script.steps.length) {
      const step = script.steps[index];
      const due = dueOf(step);
      if (due > t) return;
      if (step.on) { waiting = step.on; return; }
      fire(step, due);
    }
    if (script && index >= script.steps.length && playing) {
      playing = false;
      cancelAnimationFrame(raf);
    }
  }

  function frame(now) {
    const dt = Math.min(MAX_DT, now - prev) * speed;
    prev = now;
    // Durante l'attesa di un gesto l'orologio di scena è fermo: la durata del gesto non entra nella scena
    if (!waiting) t += dt;
    drain();
    emit();
    if (playing) raf = requestAnimationFrame(frame);
  }

  const api = {
    register(name, target) {
      targets.set(name, target);
      return api;
    },
    validate(candidate) {
      return validateScript(candidate, targets);
    },
    load(next) {
      const errors = validateScript(next, targets);
      if (errors.length) throw Object.assign(new Error(`script "${next?.id ?? '?'}" non valido`), { errors });
      api.pause();
      script = next;
      start = parseClock(next.clock);
      api.restart({ play: false });
    },
    play() {
      if (!script || playing || index >= script.steps.length) return;
      playing = true;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
      emit();
    },
    pause() {
      playing = false;
      cancelAnimationFrame(raf);
      emit();
    },
    toggle() { (playing ? api.pause : api.play)(); },
    // Esegue subito il passo successivo; soddisfa anche un gesto atteso
    next() {
      if (!script || index >= script.steps.length) return;
      if (playing) {
        playing = false;
        cancelAnimationFrame(raf);
      }
      const step = script.steps[index];
      fire(step, Math.max(t, dueOf(step)));
      drain();
      emit();
    },
    restart({ play = playing } = {}) {
      if (!script) return;
      api.pause();
      t = 0; index = 0; lastFire = 0; waiting = null; lastError = null;
      start = parseClock(script.clock);
      targets.forEach((target) => target.reset?.());
      drain();
      emit();
      if (play) api.play();
    },
    // Gesti dell'interfaccia (tap:paga, click:revoca): fanno avanzare solo il passo che li attende
    signal(name) {
      if (!script || waiting !== name) return false;
      fire(script.steps[index], t);
      drain();
      emit();
      return true;
    },
    setSpeed(x) { speed = x > 0 ? x : 1; },
    get state() { return snapshot(); },
    onState(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };

  return api;
}
