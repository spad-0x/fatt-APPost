// Regia: carica gli script di scena, comandi da tastiera, pannello di debug, modalità ripresa.
// Parametri d'indirizzo: ?scena=s1&autoplay=1&regia=0&velocita=1
//   scena     id dello script in scenari/<id>.json
//   autoplay  1 = parte da sola appena la pagina è pronta
//   regia     0 = modalità ripresa: nessun pannello, nessun cursore, dimensioni fisse, niente service worker
//   velocita  moltiplicatore del tempo di scena, solo per provare (le riprese si fanno a 1)
//
// Tasti (ignorati mentre si scrive in un campo): Spazio avvia/pausa · → o N passo successivo
// R ricomincia · 1–9 salta alla scena N dell'elenco · H mostra/nasconde il pannello

import { createEngine } from './engine.js';

export function readRegiaParams(search = location.search) {
  const p = new URLSearchParams(search);
  const scena = p.get('scena');
  return {
    scena,
    autoplay: p.get('autoplay') === '1',
    ripresa: Boolean(scena) && p.get('regia') === '0',
    velocita: Math.max(0.1, parseFloat(p.get('velocita')) || 1)
  };
}

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

async function fetchScript(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error(`id di scena non valido: "${id}"`);
  const res = await fetch(`./scenari/${id}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`scenari/${id}.json: HTTP ${res.status}`);
  return res.json();
}

function createHud() {
  const hud = document.createElement('div');
  hud.className = 'regia-hud';
  hud.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hud);
  return hud;
}

/**
 * @param {object} o
 * @param {Record<string, object>} o.targets  destinatari dei passi, es. { chat: chat.scene }
 * @param {string[]} o.scenes                 scene di questa pagina, nell'ordine dei tasti 1–9
 * @param {(script: object) => void} [o.onLoad] preparazione della pagina prima del primo passo
 */
export async function startRegia({ targets, scenes, onLoad }) {
  const params = readRegiaParams();
  const engine = createEngine();
  Object.entries(targets).forEach(([name, target]) => engine.register(name, target));
  engine.setSpeed(params.velocita);

  document.documentElement.classList.toggle('is-ripresa', params.ripresa);
  const hud = params.ripresa ? null : createHud();
  let loadErrors = [];
  let current = null;

  function paint(s = engine.state) {
    if (!hud) return;
    const state = loadErrors.length ? 'errore'
      : s.waiting ? `attende ${s.waiting}`
      : s.ended ? 'fine'
      : s.playing ? 'in riproduzione' : 'in pausa';
    hud.replaceChildren();
    const line = (text, cls) => { const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = text; hud.appendChild(p); };
    line(`${current ?? params.scena} · passo ${s.index}/${s.total} · ${s.clock}`);
    line(state, loadErrors.length || s.error ? 'is-error' : null);
    loadErrors.forEach((e) => line(e, 'is-error'));
    if (s.error) line(s.error, 'is-error');
    line('Spazio avvia/pausa · → passo · R da capo · 1–9 scena · H pannello', 'is-help');
  }
  engine.onState(paint);

  async function load(id, { autoplay = false } = {}) {
    current = id;
    loadErrors = [];
    try {
      const script = await fetchScript(id);
      const errors = engine.validate(script);
      if (errors.length) { loadErrors = errors; console.error('[regia]', id, errors); paint(); return false; }
      onLoad?.(script);
      engine.load(script);
      const url = new URL(location.href);
      url.searchParams.set('scena', id);
      history.replaceState(null, '', url);
      // Primo passo solo a font caricati e layout stabile: stesso primo fotogramma a ogni ripresa
      await document.fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      paint();
      if (autoplay) engine.play();
      return true;
    } catch (err) {
      loadErrors = [err.message];
      console.error('[regia]', err);
      paint();
      return false;
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') engine.toggle();
    else if (k === 'arrowright' || k === 'n') engine.next();
    else if (k === 'r') engine.restart({ play: true });
    else if (k === 'h') { if (hud) hud.hidden = !hud.hidden; }
    else if (/^[1-9]$/.test(k) && scenes[Number(k) - 1]) load(scenes[Number(k) - 1], { autoplay: true });
    else return;
    e.preventDefault();
  });

  await load(params.scena, { autoplay: params.autoplay });
  // Maniglia per la cattura automatica dei fotogrammi e per il debug da console
  window.__regia = engine;
  return engine;
}

// In regia il service worker non deve servire file vecchi: lo si toglie e si svuotano le sue cache
export async function disableServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('fattoapposta-')).map((k) => caches.delete(k)));
  }
}
