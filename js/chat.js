// Chat: conversazioni multiple con cronologia, testo, note vocali con waveform, allegati, crediti.
// Le risposte sono simulate lato client (nessun modello collegato).
// In regia il motore a timeline scrive nella chat attraverso l'oggetto `scene` (vedi in fondo):
// la conversazione di scena è effimera, non entra in cronologia e prende gli orari dall'orologio di scena.
import { COPY } from './i18n.js';
import { uid } from './store.js';

const CREDITS_KEY = 'fattoapposta_credits';
const CREDITS_BASE = 24;
const WAVE = [6, 10, 16, 9, 14, 22, 12, 7, 17, 24, 13, 9, 20, 15, 8, 18, 23, 11, 7, 16, 21, 10, 15, 22, 12, 8, 17, 13, 7, 10];
const NS = 'http://www.w3.org/2000/svg';
const CONFIRM_MS = 3000;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(pointer: fine)').matches;

function icon(id, cls = 'ico') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const clock = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Titolo dal primo messaggio: taglio sulla parola, massimo ~38 caratteri
function deriveTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 38) return clean.charAt(0).toUpperCase() + clean.slice(1);
  const cut = clean.slice(0, 38);
  const sp = cut.lastIndexOf(' ');
  const base = (sp > 20 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?-]+$/, '');
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}…`;
}

export function createChat({ showToast, store }) {
  const view = document.getElementById('view-chat');
  const stream = document.getElementById('stream');
  const empty = document.getElementById('empty');
  const emptyTitle = document.getElementById('empty-title');
  const chips = document.getElementById('chips');
  const titleEl = document.getElementById('chat-title');
  const titleText = document.getElementById('chat-title-text');
  const titleBtn = document.getElementById('btn-chat-title');
  const whoEl = document.getElementById('chat-who');
  const newBtn = document.getElementById('btn-new-chat');
  const menu = document.getElementById('chat-menu');
  const menuSave = document.getElementById('menu-save');
  const menuSaveLabel = document.getElementById('menu-save-label');
  const menuDelete = document.getElementById('menu-delete');
  const menuDeleteLabel = document.getElementById('menu-delete-label');
  const form = document.getElementById('composer');
  const input = document.getElementById('composer-input');
  const actionBtn = document.getElementById('btn-action');
  const actionIcon = document.getElementById('action-icon');
  const attachBtn = document.getElementById('btn-attach');
  const fileInput = document.getElementById('file-input');
  const attachChip = document.getElementById('attach-chip');
  const attachName = document.getElementById('attach-name');
  const attachRemove = document.getElementById('btn-attach-remove');
  const creditsEl = document.getElementById('credits');
  const creditsN = document.getElementById('credits-n');

  let credits = parseInt(localStorage.getItem(CREDITS_KEY) ?? String(CREDITS_BASE), 10);
  if (!Number.isFinite(credits) || credits <= 0) credits = CREDITS_BASE;
  let session = null;
  let active = null;            // conversazione aperta; null = nuova chat non ancora salvata
  let pendingFile = null;
  let stopActive = null;
  let rec = null;
  const pending = new Map();    // chatId -> { node } risposta in arrivo
  const audioUrls = new Map();  // msgId -> blob URL (solo per la sessione corrente)
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(active?.id ?? null));

  /* ---------- Crediti ---------- */
  function renderCredits(animate = false) {
    creditsN.textContent = String(credits);
    creditsEl.setAttribute('aria-label', COPY.creditsLabel(credits));
    if (animate && !reduce()) {
      creditsEl.classList.remove('is-tick');
      void creditsEl.offsetWidth;
      creditsEl.classList.add('is-tick');
    }
  }
  function spendCredit() {
    credits -= 1;
    if (credits <= 0) {
      credits = CREDITS_BASE;
      showToast(COPY.creditsRefilled);
    }
    localStorage.setItem(CREDITS_KEY, String(credits));
    renderCredits(true);
  }

  /* ---------- Composer ---------- */
  function syncAction() {
    if (rec) {
      actionIcon.setAttribute('href', '#i-stop');
      actionBtn.setAttribute('aria-label', COPY.actionStop);
      return;
    }
    const hasPayload = input.value.trim().length > 0 || Boolean(pendingFile);
    actionIcon.setAttribute('href', hasPayload ? '#i-send' : '#i-mic');
    actionBtn.setAttribute('aria-label', hasPayload ? COPY.actionSend : COPY.actionRecord);
  }
  input.addEventListener('input', syncAction);

  function clearAttachment() {
    pendingFile = null;
    fileInput.value = '';
    attachChip.hidden = true;
  }
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    pendingFile = file.name;
    attachName.textContent = file.name;
    attachChip.hidden = false;
    syncAction();
    input.focus();
  });
  attachRemove.addEventListener('click', () => {
    clearAttachment();
    syncAction();
    attachBtn.focus();
  });

  /* ---------- Nodi dei messaggi ---------- */
  function scrollEnd(instant = false) {
    stream.scrollTo({ top: stream.scrollHeight, behavior: instant || reduce() ? 'instant' : 'smooth' });
  }

  function enter(node) {
    stream.appendChild(node);
    if (!reduce()) {
      node.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    }
    scrollEnd();
    return node;
  }

  function userText(text, fileName) {
    const bubble = el('div', 'msg-user');
    if (fileName) {
      const tag = el('div', 'msg-file');
      tag.append(icon('i-file', 'ico ico--sm'), el('span', null, fileName));
      bubble.appendChild(tag);
    }
    if (text) bubble.appendChild(el('p', null, text));
    return bubble;
  }

  function aiMeta(time, mood = 'idle') {
    const meta = el('div', 'msg-ai-meta');
    const avatar = icon(mood === 'think' ? 'm-mini-think' : mood === 'listen' ? 'm-mini-listen' : 'm-mini', 'avatar');
    const who = el('div', 'msg-ai-who');
    who.append(el('span', 'msg-ai-time', time), el('span', 'msg-ai-name', COPY.assistantName));
    meta.append(avatar, who);
    return meta;
  }

  function aiText(text, time) {
    const wrap = el('div', 'msg-ai');
    wrap.append(aiMeta(time), el('p', 'msg-ai-text', text));
    return wrap;
  }

  function typingNode(time = clock(Date.now())) {
    const wrap = el('div', 'msg-ai');
    wrap.setAttribute('aria-label', 'FattoAPPosta sta scrivendo');
    const dots = el('div', 'typing');
    dots.append(el('span'), el('span'), el('span'));
    wrap.append(aiMeta(time, 'think'), dots);
    return wrap;
  }

  function voiceNode(duration, audioUrl = null) {
    const box = el('div', 'voice');
    const play = el('button', 'voice-play');
    play.type = 'button';
    play.setAttribute('aria-label', `${COPY.play}, ${fmt(duration)}`);
    play.appendChild(icon('i-play'));
    const playUse = play.querySelector('use');

    const wave = el('div', 'voice-wave');
    wave.setAttribute('aria-hidden', 'true');
    const bars = WAVE.map((h) => {
      const b = el('i');
      b.style.height = `${h}px`;
      wave.appendChild(b);
      return b;
    });
    const time = el('span', 'voice-time', fmt(duration));
    box.append(play, wave, time);

    const audio = audioUrl ? new Audio(audioUrl) : null;
    let raf = 0;
    let t0 = 0;
    let playing = false;

    const paint = (p) => {
      const lit = Math.round(p * bars.length);
      bars.forEach((b, i) => b.classList.toggle('is-on', i < lit));
      time.textContent = fmt(playing ? Math.max(0, Math.ceil(duration * (1 - p))) : duration);
    };

    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      if (audio) { audio.pause(); audio.currentTime = 0; }
      playUse.setAttribute('href', '#i-play');
      play.setAttribute('aria-label', `${COPY.play}, ${fmt(duration)}`);
      paint(0);
      if (stopActive === stop) stopActive = null;
    }

    function tick() {
      const p = audio && audio.duration && Number.isFinite(audio.duration)
        ? audio.currentTime / audio.duration
        : Math.min(1, (performance.now() - t0) / (duration * 1000));
      paint(p);
      if (p >= 1 || (audio && audio.ended)) return stop();
      raf = requestAnimationFrame(tick);
    }

    play.addEventListener('click', () => {
      if (playing) return stop();
      if (stopActive) stopActive();
      stopActive = stop;
      playing = true;
      t0 = performance.now();
      playUse.setAttribute('href', '#i-pause');
      play.setAttribute('aria-label', COPY.pause);
      audio?.play().catch(() => {});
      raf = requestAnimationFrame(tick);
    });

    return box;
  }

  function listeningNode() {
    const wrap = el('div', 'msg-ai');
    wrap.append(aiMeta(clock(Date.now()), 'listen'), el('p', 'listening', COPY.listening));
    return wrap;
  }

  function renderMessage(m) {
    if (m.role === 'ai') return aiText(m.text, m.time ?? clock(m.at));
    if (m.type === 'voice') return voiceNode(m.duration, audioUrls.get(m.id) ?? null);
    return userText(m.text, m.fileName);
  }

  /* ---------- Stato della vista ---------- */
  const isEmpty = () => !active || active.messages.length === 0;

  function renderHeader() {
    const blank = isEmpty();
    titleText.textContent = blank ? COPY.newChatTitle : active.title;
    titleBtn.disabled = blank;
    titleBtn.classList.toggle('has-menu', !blank);
    newBtn.hidden = blank;
    titleBtn.toggleAttribute('data-saved', Boolean(active?.bookmarked));
  }

  function renderState() {
    const blank = isEmpty();
    empty.hidden = !blank;
    stream.hidden = blank;
    chips.hidden = !blank;
    renderHeader();
  }

  function renderThread() {
    if (stopActive) stopActive();
    stream.replaceChildren(...(active?.messages ?? []).map(renderMessage));
    const p = active && pending.get(active.id);
    if (p) { p.node = typingNode(); stream.appendChild(p.node); }
    renderState();
    requestAnimationFrame(() => scrollEnd(true));
  }

  /* ---------- Conversazioni ---------- */
  function ensureChat(titleHint) {
    if (!active) {
      const t = Date.now();
      active = { id: uid(), title: titleHint, createdAt: t, updatedAt: t, bookmarked: false, messages: [] };
    }
    return active;
  }

  function push(chat, msg) {
    if (chat.ephemeral) {
      msg.id = msg.id ?? `scena-${chat.messages.length}`;
      msg.at = 0;
    } else {
      msg.id = msg.id ?? uid();
      msg.at = Date.now();
    }
    chat.messages.push(msg);
    if (!chat.ephemeral) store.save(chat);
    return msg;
  }

  /* ---------- Risposte simulate ---------- */
  function reply(text, fileName) {
    const q = (text || '').toLowerCase();
    if (fileName) return `Ho ricevuto "${fileName}". Vuoi un riassunto dei punti chiave o una lista di cose da fare?`;
    if (/cena|ricett|frigo|cucin/.test(q)) return 'Pasta al limone in 15 minuti: metti a bollire l’acqua, scalda burro e scorza di limone, manteca con parmigiano e un mestolo d’acqua di cottura. Ti scrivo le dosi per due?';
    if (/giornat|priorit|oggi|organizz/.test(q)) return 'Dividiamo la giornata in tre blocchi: una cosa importante al mattino, due commissioni brevi nel pomeriggio, dieci minuti la sera per preparare domani. Qual è la cosa importante?';
    if (/spesa|lista/.test(q)) return 'Per tre cene facili: uova, zucchine, pasta corta, pomodorini, mozzarella, pane, limoni, parmigiano, insalata. Vuoi le tre ricette abbinate?';
    if (/file|riassum|allega/.test(q)) return 'Tocca la graffetta a sinistra del messaggio, scegli il file e invialo: ti preparo un riassunto in punti.';
    const short = text.length > 48 ? `${text.slice(0, 48)}…` : text;
    return `Ricevuto: "${short}". Vuoi che te lo spieghi passo per passo?`;
  }

  // La risposta appartiene alla chat che l'ha richiesta, anche se nel frattempo l'utente ne apre un'altra
  function respond(chat, answer, delay = 850) {
    const entry = { node: active === chat ? enter(typingNode()) : null };
    pending.set(chat.id, entry);
    setTimeout(() => {
      entry.node?.remove();
      pending.delete(chat.id);
      if (!store.has(chat.id)) return; // eliminata nel frattempo
      const msg = push(chat, { role: 'ai', type: 'text', text: answer });
      if (active?.id === chat.id) enter(renderMessage(msg));
    }, reduce() ? 300 : delay);
  }

  function sendText(text, fileName = null, titleHint = null) {
    if (!text && !fileName) return;
    const chat = ensureChat(titleHint ?? (text ? deriveTitle(text) : fileName));
    spendCredit();
    const msg = push(chat, { role: 'user', type: 'text', text, fileName });
    renderState();
    enter(renderMessage(msg));
    respond(chat, reply(text, fileName));
    emit();
  }

  /* ---------- Registrazione vocale ---------- */
  async function startRecording() {
    if (stopActive) stopActive();
    let recorder = null;
    let media = null;
    const chunks = [];
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(media);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start();
    } catch {
      showToast(COPY.micDenied);
    }
    if (isEmpty()) { empty.hidden = true; stream.hidden = false; chips.hidden = true; }
    rec = { t0: Date.now(), recorder, media, chunks, timer: 0, row: enter(listeningNode()) };
    actionBtn.classList.add('is-recording');
    input.value = '';
    input.disabled = true;
    const update = () => { input.placeholder = `${COPY.recording} · ${fmt((Date.now() - rec.t0) / 1000)}`; };
    update();
    rec.timer = setInterval(update, 250);
    syncAction();
  }

  function releaseRecorder(current) {
    clearInterval(current.timer);
    current.row.remove();
    current.media?.getTracks().forEach((t) => t.stop());
    rec = null;
    actionBtn.classList.remove('is-recording');
    input.disabled = false;
    input.placeholder = COPY.composerPlaceholder;
    syncAction();
  }

  async function stopRecording() {
    const current = rec;
    const seconds = Math.max(1, Math.round((Date.now() - current.t0) / 1000));
    let url = null;
    if (current.recorder && current.recorder.state !== 'inactive') {
      url = await new Promise((resolve) => {
        current.recorder.onstop = () => resolve(URL.createObjectURL(new Blob(current.chunks, { type: current.recorder.mimeType || 'audio/webm' })));
        current.recorder.stop();
      });
    }
    releaseRecorder(current);
    actionBtn.focus();
    const chat = ensureChat(COPY.voiceTitle);
    spendCredit();
    const msg = { id: uid(), role: 'user', type: 'voice', duration: seconds };
    if (url) audioUrls.set(msg.id, url);
    push(chat, msg);
    renderState();
    enter(renderMessage(msg));
    respond(chat, `Nota vocale ricevuta (${fmt(seconds)}). Vuoi che la trasformi in una lista di cose da fare?`, 900);
    emit();
  }

  // Registrazione in corso abbandonata (cambio chat, menu, uscita): nessun messaggio, nessun credito
  function cancelRecording() {
    if (!rec) return;
    const current = rec;
    if (current.recorder && current.recorder.state !== 'inactive') {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    releaseRecorder(current);
    renderState();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (rec) return stopRecording();
    const text = input.value.trim();
    if (text || pendingFile) {
      const file = pendingFile;
      input.value = '';
      clearAttachment();
      syncAction();
      sendText(text, file);
    } else {
      startRecording();
    }
  });

  /* ---------- Suggerimenti (solo nella chat vuota) ---------- */
  COPY.prompts.forEach((p) => {
    const chip = el('button', 'chip', p.label);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      sendText(p.query, null, p.title);
      input.focus({ preventScroll: true });
    });
    chips.appendChild(chip);
  });

  /* ---------- Menu del titolo: salva / elimina ---------- */
  let deleteArmed = 0;
  const menuItems = () => [menuSave, menuDelete];

  function disarmDelete() {
    clearTimeout(deleteArmed);
    deleteArmed = 0;
    menuDelete.classList.remove('is-armed');
    menuDeleteLabel.textContent = COPY.deleteChat;
  }

  function openMenu() {
    if (isEmpty()) return;
    menuSaveLabel.textContent = active.bookmarked ? COPY.bookmarkRemove : COPY.bookmarkSave;
    menuSave.toggleAttribute('data-saved', active.bookmarked);
    disarmDelete();
    menu.hidden = false;
    titleBtn.setAttribute('aria-expanded', 'true');
    if (!reduce()) menu.animate([{ opacity: 0, transform: 'translate(-50%, -4px) scale(0.98)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: 160, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    menuSave.focus();
  }
  function closeMenu({ restore = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    disarmDelete();
    titleBtn.setAttribute('aria-expanded', 'false');
    if (restore && !titleBtn.disabled) titleBtn.focus();
  }

  titleBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  menu.addEventListener('keydown', (e) => {
    const items = menuItems();
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items.at(-1).focus(); }
    else if (e.key === 'Tab') closeMenu({ restore: false });
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !titleBtn.contains(e.target)) closeMenu({ restore: false });
  });

  menuSave.addEventListener('click', () => {
    if (active.ephemeral) return closeMenu();
    active.bookmarked = !active.bookmarked;
    store.save(active, { touch: false });
    renderHeader();
    closeMenu();
    showToast(active.bookmarked ? COPY.bookmarkSaved : COPY.bookmarkRemoved);
  });

  menuDelete.addEventListener('click', () => {
    if (active.ephemeral) return closeMenu();
    if (!deleteArmed) {
      menuDelete.classList.add('is-armed');
      menuDeleteLabel.textContent = COPY.deleteChatConfirm;
      deleteArmed = setTimeout(disarmDelete, CONFIRM_MS);
      return;
    }
    const id = active.id;
    closeMenu({ restore: false });
    pending.delete(id);
    store.remove(id);
    newChat();
    showToast(COPY.chatDeleted);
  });

  /* ---------- API ---------- */
  function resetComposer() {
    cancelRecording();
    if (stopActive) stopActive();
    input.value = '';
    clearAttachment();
    syncAction();
  }

  function focusEntry() {
    // Su desktop si scrive subito; su touch non si apre la tastiera senza un gesto dell'utente
    if (finePointer()) input.focus({ preventScroll: true });
    else titleEl.focus({ preventScroll: true });
  }

  function newChat({ focus = true } = {}) {
    closeMenu({ restore: false });
    resetComposer();
    active = null;
    renderThread();
    emit();
    if (focus) focusEntry();
  }

  function openChat(id) {
    const chat = store.get(id);
    if (!chat) return newChat();
    closeMenu({ restore: false });
    resetComposer();
    active = chat;
    renderThread();
    emit();
    focusEntry();
  }

  newBtn.addEventListener('click', () => newChat());

  // Ctrl/Cmd + Shift + O: nuova chat (stessa scorciatoia di ChatGPT)
  document.addEventListener('keydown', (e) => {
    if (view.hidden || view.inert) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      newChat();
    }
  });

  // Se l'archivio cambia da fuori (es. cronologia svuotata) e la chat aperta non esiste più
  store.onChange(() => {
    if (active && !active.ephemeral && active.messages.length && !store.has(active.id)) newChat({ focus: false });
  });

  /* ---------- Punto d'ingresso del motore a timeline ---------- */
  // Ogni verbo riceve (args, ctx): ctx.clock è l'ora di scena "HH:MM". Nessun Date.now() nei valori mostrati.
  let sceneTyping = null;
  const sceneState = {
    engine: null,
    unsub: null,
    autoTapTimer: 0,
    compose: null,
    keyboard: null,
    replyGroup: null,
    traceBox: null,
    eventsBox: null,
    routeBox: null,
    returnBox: null,
    ticketBox: null,
    advisoryStrip: null
  };

  function clearSceneWidgets() {
    clearTimeout(sceneState.autoTapTimer);
    sceneState.autoTapTimer = 0;
    cancelCompose();
    sceneState.advisoryStrip?.remove();
    sceneState.advisoryStrip = null;
    sceneState.replyGroup = null;
    sceneState.traceBox = null;
    sceneState.eventsBox = null;
    sceneState.routeBox = null;
    sceneState.returnBox = null;
    sceneState.ticketBox = null;
  }

  function attachEngine(eng) {
    if (!eng || sceneState.engine === eng) return;
    sceneState.unsub?.();
    sceneState.engine = eng;
    sceneState.unsub = eng.onState((s) => {
      composeTick(s);
      if (s.playing && s.waiting === 'tap:paga') {
        const payBtn = sceneState.ticketBox?.querySelector('.ticket-pay-btn');
        if (payBtn && !payBtn.disabled && !sceneState.autoTapTimer) {
          const delay = Math.max(80, Math.round(460 / (s.speed || 1)));
          sceneState.autoTapTimer = setTimeout(() => {
            sceneState.autoTapTimer = 0;
            if (!eng.state.playing || eng.state.waiting !== 'tap:paga') return;
            payBtn.classList.add('is-pressed');
            touchAt(payBtn);
            // Il tocco si vede prima che il biglietto cambi stato
            sceneState.autoTapTimer = setTimeout(() => {
              sceneState.autoTapTimer = 0;
              if (eng.state.playing && eng.state.waiting === 'tap:paga') payBtn.click();
            }, 240);
          }, delay);
        }
      } else if (sceneState.autoTapTimer) {
        clearTimeout(sceneState.autoTapTimer);
        sceneState.autoTapTimer = 0;
      }
    });
  }

  const sceneChat = (ctx) => {
    if (ctx?.engine) attachEngine(ctx.engine);
    // Un passo successivo chiude una digitazione ancora in corso (avanzamento manuale con →)
    if (sceneState.compose) finishCompose(ctx);
    if (!active?.ephemeral) scene.begin({}, ctx);
    return active;
  };

  function sceneEnter(node, ctx) {
    stream.appendChild(node);
    const animate = Boolean(ctx?.engine?.state?.playing ?? sceneState.engine?.state?.playing) && !reduce();
    if (animate) {
      node.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
    if (!animate) stream.scrollTop = stream.scrollHeight;
    else scrollEnd(false);
    return node;
  }

  function sceneAiMeta(time, badge = null) {
    const meta = aiMeta(time);
    if (badge) meta.appendChild(el('span', 'ai-badge', badge));
    return meta;
  }

  // QR Version 1-L deterministico in SVG puro (nessuna libreria esterna né casualità)
  function qrSvg(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text))).slice(0, 17);
    const bits = [];
    const pushBits = (v, len) => { for (let i = len - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    pushBits(0b0100, 4);
    pushBits(bytes.length, 8);
    bytes.forEach((b) => pushBits(b, 8));
    pushBits(0, Math.min(4, 152 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    }
    for (let pad = 0; data.length < 19; pad++) data.push(pad % 2 === 0 ? 0xEC : 0x11);

    const exp = new Uint8Array(512);
    const log = new Uint8Array(256);
    for (let x = 1, i = 0; i < 255; i++) {
      exp[i] = x;
      log[x] = i;
      x = (x << 1) ^ (x & 128 ? 0x11D : 0);
    }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    const mul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
    let gen = [1];
    for (let i = 0; i < 7; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= mul(gen[j], exp[i]);
      }
      gen = next;
    }
    const rem = [...data, ...new Array(7).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const coef = rem[i];
      if (coef) for (let j = 0; j < gen.length; j++) rem[i + j] ^= mul(gen[j], coef);
    }
    const codewords = [...data, ...rem.slice(data.length)];
    const bitStream = [];
    codewords.forEach((b) => { for (let i = 7; i >= 0; i--) bitStream.push((b >> i) & 1); });

    const N = 21;
    const grid = Array.from({ length: N }, () => Array(N).fill(0));
    const locked = Array.from({ length: N }, () => Array(N).fill(false));
    const put = (r, c, v) => {
      if (r >= 0 && r < N && c >= 0 && c < N) {
        grid[r][c] = v ? 1 : 0;
        locked[r][c] = true;
      }
    };
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const inBox = r >= 0 && r < 7 && c >= 0 && c < 7;
          const onEdge = r === 0 || r === 6 || c === 0 || c === 6;
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          put(r0 + r, c0 + c, inBox && (onEdge || inCore));
        }
      }
    };
    finder(0, 0);
    finder(0, 14);
    finder(14, 0);
    for (let i = 8; i <= 12; i++) {
      put(6, i, i % 2 === 0);
      put(i, 6, i % 2 === 0);
    }
    put(13, 8, 1);
    for (let i = 0; i < 9; i++) { locked[8][i] = true; locked[i][8] = true; }
    for (let i = 13; i < 21; i++) locked[8][i] = true;
    for (let i = 14; i < 21; i++) locked[i][8] = true;

    let idx = 0;
    let dir = -1;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let k = 0; k < N; k++) {
        const r = dir === -1 ? N - 1 - k : k;
        for (const cc of [c, c - 1]) {
          if (!locked[r][cc]) {
            const bit = idx < bitStream.length ? bitStream[idx++] : 0;
            grid[r][cc] = bit ^ ((r + cc) % 2 === 0 ? 1 : 0);
          }
        }
      }
      dir = -dir;
    }

    const fmt = 0b111011111000100; // EC L (01), mask 0 (000)
    for (let k = 0; k < 15; k++) {
      const bit = (fmt >> (14 - k)) & 1;
      if (k < 6) put(8, k, bit);
      else if (k === 6) put(8, 7, bit);
      else if (k === 7) put(8, 8, bit);
      else if (k === 8) put(7, 8, bit);
      else put(14 - k, 8, bit);

      if (k < 7) put(20 - k, 8, bit);
      else put(8, 13 + (k - 7), bit);
    }

    let d = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r][c]) d += `M${c + 2} ${r + 2}h1v1h-1z`;
      }
    }
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ticket-qr');
    svg.setAttribute('viewBox', '0 0 25 25');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Codice QR biglietto ${text}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', '25');
    bg.setAttribute('height', '25');
    bg.setAttribute('fill', '#ffffff');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#111827');
    svg.append(bg, path);
    return svg;
  }

  function routeMinimapSvg(mapLabels = ['Vanvitelli', 'Dante L1', 'S. Biagio'], mapNote = 'Auto 34 min · coda via Marina') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'route-minimap');
    svg.setAttribute('viewBox', '0 0 320 96');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs, txt) => {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
      if (txt != null) node.textContent = txt;
      svg.appendChild(node);
      return node;
    };
    add('rect', { width: 320, height: 96, rx: 10, fill: '#f4f5f7' });
    // Reticolo stradale stilizzato e costa
    add('path', { d: 'M0 78 Q155 88 320 74 L320 96 L0 96 Z', fill: '#e6e8ec' });
    add('path', { d: 'M24 22 H296 M24 52 H296 M84 8 V80 M174 8 V80 M246 8 V80', stroke: '#e1e4e8', 'stroke-width': 1, fill: 'none' });
    // Alternativa auto scartata via Marina
    add('path', { d: 'M42 30 C92 78, 194 78, 272 56', stroke: '#5f6672', 'stroke-width': 2, 'stroke-dasharray': '4 4', fill: 'none' });
    add('text', { x: 146, y: 86, 'font-size': 9.5, 'font-family': 'Poppins, sans-serif', fill: '#5f6672', 'text-anchor': 'middle' }, mapNote);
    // Percorso attivo Metro L1 + tratto a piedi
    add('path', { d: 'M42 28 C100 24, 148 44, 196 52', stroke: '#2f6b4f', 'stroke-width': 3.5, 'stroke-linecap': 'round', fill: 'none' });
    add('path', { d: 'M196 52 L270 42', stroke: '#2f6b4f', 'stroke-width': 2.5, 'stroke-dasharray': '2 4', 'stroke-linecap': 'round', fill: 'none' });
    // Nodi
    add('circle', { cx: 42, cy: 28, r: 4.5, fill: '#ffffff', stroke: '#2f6b4f', 'stroke-width': 2.5 });
    add('text', { x: 42, y: 17, 'font-size': 10, 'font-weight': 500, 'font-family': 'Poppins, sans-serif', fill: '#111827', 'text-anchor': 'middle' }, mapLabels[0] ?? 'Vanvitelli');
    add('circle', { cx: 196, cy: 52, r: 4.5, fill: '#ffffff', stroke: '#2f6b4f', 'stroke-width': 2.5 });
    add('text', { x: 196, y: 40, 'font-size': 10, 'font-weight': 500, 'font-family': 'Poppins, sans-serif', fill: '#111827', 'text-anchor': 'middle' }, mapLabels[1] ?? 'Dante L1');
    add('circle', { cx: 270, cy: 42, r: 8, fill: '#e3ede7' });
    add('circle', { cx: 270, cy: 42, r: 4.5, fill: '#2f6b4f' });
    add('text', { x: 270, y: 28, 'font-size': 10, 'font-weight': 600, 'font-family': 'Poppins, sans-serif', fill: '#111827', 'text-anchor': 'middle' }, mapLabels[2] ?? 'S. Biagio');
    return svg;
  }

  /* ---------- Regia: tocchi, tastiera a schermo, digitazione ---------- */
  // Tutto è funzione del tempo di scena (s.t): in pausa la digitazione si ferma, a ogni ripresa è identica.
  const sceneAnimating = (ctx) => Boolean(ctx?.engine?.state?.playing ?? sceneState.engine?.state?.playing) && !reduce();

  // Indicatore di tocco: un disco che si stringe e svanisce sul centro dell'elemento toccato
  function touchAt(node, delay = 0) {
    if (!node || !sceneAnimating()) return;
    // Il disco è figlio dell'elemento toccato: se la conversazione scorre, resta sul suo bersaglio
    node.classList.add('has-touch');
    const dot = el('span', 'touch-dot');
    dot.setAttribute('aria-hidden', 'true');
    node.appendChild(dot);
    const anim = dot.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.28 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(0.92)', offset: 0.6 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1.25)' }
      ],
      { duration: 560, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }
    );
    anim.onfinish = () => dot.remove();
  }

  const KBD_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back'],
    ['sym', 'space', 'enter']
  ];
  const KBD_LABELS = { shift: '⇧', back: '⌫', sym: '123', space: 'spazio', enter: 'invio' };

  function showKeyboard() {
    if (sceneState.keyboard) return sceneState.keyboard;
    const kbd = el('div', 'scene-kbd');
    kbd.setAttribute('aria-hidden', 'true');
    KBD_ROWS.forEach((keys, i) => {
      const row = el('div', `kbd-row kbd-row--${i + 1}`);
      keys.forEach((k) => {
        const key = el('span', `kbd-key${k.length > 1 ? ` kbd-key--${k}` : ''}`, KBD_LABELS[k] ?? k);
        key.dataset.k = k;
        row.appendChild(key);
      });
      kbd.appendChild(row);
    });
    view.appendChild(kbd);
    sceneState.keyboard = kbd;
    // Altezza applicata al fotogramma successivo: la transizione CSS fa salire la tastiera
    kbd.getBoundingClientRect();
    kbd.classList.add('is-open');
    return kbd;
  }

  function hideKeyboard() {
    sceneState.keyboard?.remove();
    sceneState.keyboard = null;
  }

  function keyFor(ch) {
    const kbd = sceneState.keyboard;
    if (!kbd) return null;
    const c = ch.toLowerCase();
    if (c === ' ') return kbd.querySelector('[data-k="space"]');
    if (/^[a-z]$/.test(c)) return kbd.querySelector(`[data-k="${c}"]`);
    return kbd.querySelector('[data-k="sym"]');
  }

  function setKeyDown(node) {
    sceneState.keyboard?.querySelectorAll('.kbd-key.is-down').forEach((k) => { if (k !== node) k.classList.remove('is-down'); });
    node?.classList.add('is-down');
  }

  function cancelCompose() {
    sceneState.compose = null;
    hideKeyboard();
    actionBtn.classList.remove('is-pressed');
  }

  function composeSubmit(job, ctx) {
    sceneState.compose = null;
    input.value = '';
    syncAction();
    actionBtn.classList.remove('is-pressed');
    hideKeyboard();
    if (job.send) scene.user({ text: job.text, who: job.who }, ctx);
  }

  // Chiude subito una digitazione in corso: testo completo, invio, bolla
  function finishCompose(ctx) {
    const job = sceneState.compose;
    if (!job) return;
    composeSubmit(job, ctx ?? { engine: sceneState.engine, clock: '' });
  }

  function composeTick(s) {
    const job = sceneState.compose;
    if (!job || job.busy) return;
    const dt = s.t - job.t0;
    const typed = dt - job.lead;
    const n = Math.max(0, Math.min(job.text.length, Math.floor(typed / job.msPerChar) + (typed >= 0 ? 1 : 0)));
    if (n !== job.shown) {
      job.shown = n;
      input.value = job.text.slice(0, n);
      syncAction();
      job.keyAt = n > 0 ? job.lead + (n - 1) * job.msPerChar : -1;
      if (n > 0) setKeyDown(keyFor(job.text[n - 1]));
    }
    if (job.keyAt >= 0 && dt - job.keyAt > Math.min(90, job.msPerChar * 0.8)) setKeyDown(null);
    const typedEnd = job.lead + job.text.length * job.msPerChar;
    if (!job.pressed && dt >= typedEnd + job.hold) {
      job.pressed = true;
      if (job.send) {
        setKeyDown(sceneState.keyboard?.querySelector('[data-k="enter"]') ?? null);
        actionBtn.classList.add('is-pressed');
        touchAt(actionBtn);
      }
    }
    if (dt >= typedEnd + job.hold + 180) {
      job.busy = true;
      composeSubmit(job, { engine: sceneState.engine, clock: s.clock.slice(0, 5) });
    }
  }

  function finishOpenTraces(doneTitle = null) {
    if (!sceneState.traceBox) return;
    sceneState.traceBox.querySelectorAll('.trace-row.is-running').forEach((row) => {
      row.classList.remove('is-running');
      row.classList.add('is-done');
      const status = row.querySelector('.trace-status');
      if (status) status.textContent = '✓';
      const txt = row.querySelector('.trace-text');
      if (txt && row.dataset.doneText) txt.textContent = row.dataset.doneText;
    });
    if (doneTitle) {
      sceneState.traceBox.classList.add('is-done');
      const titleNode = sceneState.traceBox.querySelector('.trace-title');
      if (titleNode) titleNode.textContent = doneTitle;
    }
  }

  const scene = {
    setEngine(eng) {
      attachEngine(eng);
    },
    // Apre una conversazione di scena vuota: stato iniziale identico a ogni ripresa
    begin({ title = null, who = 'Ospite · dati simulati', credits: shown = CREDITS_BASE } = {}, ctx) {
      if (ctx?.engine) attachEngine(ctx.engine);
      closeMenu({ restore: false });
      resetComposer();
      clearSceneWidgets();
      sceneTyping = null;
      active = { id: 'scena', title: title ?? COPY.newChatTitle, fixedTitle: Boolean(title), createdAt: 0, updatedAt: 0, bookmarked: false, messages: [], ephemeral: true };
      whoEl.textContent = who;
      creditsN.textContent = String(shown);
      creditsEl.setAttribute('aria-label', COPY.creditsLabel(shown));
      renderThread();
      emit();
    },
    user({ text, who = null }, ctx) {
      const chat = sceneChat(ctx);
      if (!chat.fixedTitle && chat.messages.length === 0) chat.title = deriveTitle(text);
      if (who) whoEl.textContent = who;
      const msg = push(chat, { role: 'user', type: 'text', text });
      renderState();
      sceneEnter(renderMessage(msg), ctx);
    },
    // Digitazione nel composer a cadenza fissa, poi pressione di invio: la bolla esce dal gesto, non dal nulla
    compose({ text, who = null, cps = 10.5, keyboard = true, send = true, hold = 320 }, ctx) {
      const chat = sceneChat(ctx);
      if (!chat.fixedTitle && chat.messages.length === 0) chat.title = deriveTitle(text);
      if (!sceneAnimating(ctx)) {
        // Avanzamento manuale: stato finale immediato
        if (send) scene.user({ text, who }, ctx);
        else { input.value = text; syncAction(); }
        return;
      }
      if (keyboard) showKeyboard();
      sceneState.compose = {
        text: String(text), who, send,
        t0: ctx.t, lead: keyboard ? 280 : 60, hold,
        msPerChar: 1000 / cps, shown: -1, keyAt: -1, pressed: false, busy: false
      };
    },
    typing(_args, ctx) {
      sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = sceneEnter(typingNode(ctx.clock), ctx);
    },
    say({ text, badge = null, profile = false }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      const badgeLabel = badge ?? (profile ? 'dal tuo profilo' : null);
      push(chat, { role: 'ai', type: 'text', text, time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.append(sceneAiMeta(ctx.clock, badgeLabel), el('p', 'msg-ai-text', text));
      sceneEnter(wrap, ctx);
    },
    ask({ text, badge = null, profile = false, replies = [] }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      const badgeLabel = badge ?? (profile ? 'dal tuo profilo' : null);
      push(chat, { role: 'ai', type: 'text', text, time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.append(sceneAiMeta(ctx.clock, badgeLabel), el('p', 'msg-ai-text', text));
      if (replies.length) {
        const group = el('div', 'quick-replies');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Risposte rapide');
        replies.forEach((r) => {
          const item = typeof r === 'string' ? { id: r, label: r } : r;
          const btn = el('button', 'qr-btn', item.label);
          btn.type = 'button';
          btn.dataset.id = item.id;
          group.appendChild(btn);
        });
        wrap.appendChild(group);
        sceneState.replyGroup = group;
      }
      sceneEnter(wrap, ctx);
    },
    choose({ ids = [], userText = null, who = null }, ctx) {
      const chat = sceneChat(ctx);
      if (sceneState.replyGroup) {
        const chosen = new Set(ids);
        let tapOrder = 0;
        sceneState.replyGroup.querySelectorAll('.qr-btn').forEach((btn) => {
          const hit = chosen.has(btn.dataset.id);
          if (hit) touchAt(btn, 240 * tapOrder++);
          btn.classList.toggle('is-chosen', hit);
          btn.classList.toggle('is-disabled', !hit);
          btn.setAttribute('aria-pressed', hit ? 'true' : 'false');
          btn.disabled = true;
        });
      }
      if (who) whoEl.textContent = who;
      if (userText) {
        if (!chat.fixedTitle && chat.messages.length === 0) chat.title = deriveTitle(userText);
        const msg = push(chat, { role: 'user', type: 'text', text: userText });
        renderState();
        sceneEnter(renderMessage(msg), ctx);
      }
    },
    trace({ title = 'Dialogo con NapoliOS · dati simulati', agent, protocol = '', text, detail = '', done = false, doneTitle = null }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      if (!sceneState.traceBox) {
        push(chat, { role: 'ai', type: 'trace' });
        renderState();
        const box = el('div', 'widget-trace');
        const head = el('div', 'trace-head');
        head.append(el('span', 'trace-dot'), el('span', 'trace-title', title));
        const list = el('div', 'trace-list');
        box.append(head, list);
        sceneState.traceBox = box;
        sceneEnter(box, ctx);
      }
      finishOpenTraces();
      if (agent) {
        const list = sceneState.traceBox.querySelector('.trace-list');
        const row = el('div', `trace-row ${done ? 'is-done' : 'is-running'}`);
        if (detail) row.dataset.doneText = detail;
        row.append(
          el('span', 'trace-status', done ? '✓' : '●'),
          el('span', 'trace-agent', agent),
          el('span', 'trace-text', done && detail ? detail : text),
          el('span', 'trace-proto', protocol)
        );
        list.appendChild(row);
      }
      if (done) finishOpenTraces(doneTitle ?? 'Comune consultato · Eventi, Meteo, Mobilità');
      const animate = Boolean(ctx?.engine?.state?.playing ?? sceneState.engine?.state?.playing) && !reduce();
      if (!animate) stream.scrollTop = stream.scrollHeight;
      else scrollEnd(false);
    },
    events({ items = [], note = null, traceTitle = 'Comune consultato · Eventi, Meteo, Mobilità' }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      finishOpenTraces(traceTitle);
      push(chat, { role: 'ai', type: 'events', time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai msg-ai--wide');
      wrap.appendChild(sceneAiMeta(ctx.clock));
      const rail = el('div', 'events-rail');
      items.forEach((ev) => {
        const rec = ev.status === 'consigliata';
        const card = el('article', `event-card${rec ? ' is-recommended' : ''}`);
        card.dataset.id = ev.id;
        const top = el('div', 'event-top');
        if (ev.badge || rec) top.appendChild(el('span', 'event-badge', ev.badge ?? 'Consigliata'));
        else top.appendChild(el('span', 'event-kind', ev.kind ?? 'Evento'));
        top.appendChild(el('span', 'event-time', ev.time));
        const meta = el('div', 'event-meta');
        [ev.price, ev.distance, ev.crowd].filter(Boolean).forEach((m) => meta.appendChild(el('span', null, m)));
        card.append(top, el('h3', 'event-title', ev.title), el('p', 'event-place', ev.place), meta, el('p', 'event-weather', ev.weather));
        rail.appendChild(card);
      });
      wrap.appendChild(rail);
      if (note) wrap.appendChild(el('p', 'msg-ai-text events-note', note));
      sceneState.eventsBox = rail;
      sceneEnter(wrap, ctx);
      // Centra in modo sincrono la scheda consigliata così i margini delle altre due restano visibili
      const recCard = rail.querySelector('.event-card.is-recommended');
      if (recCard) {
        rail.scrollLeft = Math.round(Math.max(0, recCard.offsetLeft - (rail.clientWidth - recCard.offsetWidth) / 2));
      }
    },
    selectEvent({ id, userText = null }, ctx) {
      const chat = sceneChat(ctx);
      if (sceneState.eventsBox) {
        sceneState.eventsBox.querySelectorAll('.event-card').forEach((card) => {
          const hit = card.dataset.id === id;
          card.classList.toggle('is-selected', hit);
          card.classList.toggle('is-dimmed', !hit);
          if (hit) {
            touchAt(card);
            const badge = card.querySelector('.event-badge');
            if (badge) badge.textContent = 'Selezionata ✓';
            sceneState.eventsBox.scrollLeft = Math.round(Math.max(0, card.offsetLeft - (sceneState.eventsBox.clientWidth - card.offsetWidth) / 2));
          }
        });
      }
      if (userText) {
        const msg = push(chat, { role: 'user', type: 'text', text: userText });
        renderState();
        sceneEnter(renderMessage(msg), ctx);
      }
    },
    route({ title, arrival, state = 'Attiva', legs = [], advisory = null, discarded = null, mapLabels, mapNote }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      push(chat, { role: 'ai', type: 'route', time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.appendChild(sceneAiMeta(ctx.clock));
      const card = el('div', 'widget-card widget-route');
      const head = el('div', 'widget-head');
      head.append(el('span', 'widget-title', title), el('span', 'route-state', state));
      const sub = el('p', 'route-arrival', arrival);
      const mapBox = el('div', 'route-minimap-wrap');
      mapBox.appendChild(routeMinimapSvg(mapLabels, mapNote));
      const legsBox = el('div', 'route-legs');
      legs.forEach((leg) => {
        const row = el('div', 'route-leg');
        row.append(el('span', 'leg-mode', leg.mode), el('span', 'leg-text', leg.text), el('span', 'leg-dur', leg.duration));
        legsBox.appendChild(row);
      });
      card.append(head, sub, mapBox, legsBox);
      if (advisory) card.appendChild(el('p', 'route-advisory', advisory));
      if (discarded) {
        const disc = el('p', 'route-discarded');
        disc.append(el('s', null, discarded));
        card.appendChild(disc);
      }
      wrap.appendChild(card);
      sceneState.routeBox = card;
      sceneEnter(wrap, ctx);
    },
    returnPlan({ title = 'Piano di rientro', badge = 'illuminato e frequentato', walk, lastRun, nightAlt, reminder = 'Promemoria rientro: 00:20' }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      push(chat, { role: 'ai', type: 'return', time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.appendChild(sceneAiMeta(ctx.clock));
      const card = el('div', 'widget-card widget-return');
      const head = el('div', 'widget-head');
      head.append(el('span', 'widget-title', title), el('span', 'ai-badge', badge));
      const rows = el('div', 'return-rows');
      [
        ['A piedi', walk],
        ['Ultima corsa', lastRun],
        ['Alternativa', nightAlt]
      ].filter(([, v]) => Boolean(v)).forEach(([k, v]) => {
        const r = el('div', 'return-row');
        r.append(el('span', 'return-k', k), el('span', 'return-v', v));
        rows.appendChild(r);
      });
      const remRow = el('div', 'return-reminder');
      remRow.append(el('span', 'return-rem-label', reminder), el('span', 'reminder-pill', 'Proposto'));
      card.append(head, rows, remRow);
      wrap.appendChild(card);
      sceneState.returnBox = card;
      sceneEnter(wrap, ctx);
    },
    ticket({ event, place, qty, total, buttonLabel = 'Paga (demo)', protocol = 'ticket.intent' }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      push(chat, { role: 'ai', type: 'ticket', time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.appendChild(sceneAiMeta(ctx.clock));
      const card = el('div', 'widget-card widget-ticket');
      const head = el('div', 'widget-head');
      head.append(el('span', 'widget-title', event), el('span', 'ticket-proto', protocol));
      const placeEl = el('p', 'ticket-place', place);
      const sum = el('div', 'ticket-summary');
      sum.append(el('span', 'ticket-qty', qty), el('span', 'ticket-total', total));
      const payBtn = el('button', 'ticket-pay-btn', buttonLabel);
      payBtn.type = 'button';
      payBtn.id = 'btn-ticket-pay';
      payBtn.addEventListener('click', () => {
        const eng = sceneState.engine ?? ctx?.engine;
        if (!eng) return;
        eng.signal('tap:paga');
      });
      const qrWrap = el('div', 'ticket-qr-wrap');
      qrWrap.hidden = true;
      card.append(head, placeEl, sum, payBtn, qrWrap);
      wrap.appendChild(card);
      sceneState.ticketBox = card;
      sceneEnter(wrap, ctx);
    },
    ticketPaid({ code = 'NAP-2140-QP2', protocol = 'ticket.issued', caption = '2 ingressi · Mostra all’ingresso · Dati simulati' }, ctx) {
      sceneChat(ctx);
      clearTimeout(sceneState.autoTapTimer);
      sceneState.autoTapTimer = 0;
      const card = sceneState.ticketBox;
      if (!card) return;
      card.classList.add('is-paid');
      const proto = card.querySelector('.ticket-proto');
      if (proto) proto.textContent = protocol;
      const payBtn = card.querySelector('.ticket-pay-btn');
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.classList.remove('is-pressed');
        payBtn.textContent = 'Pagato (demo) ✓';
      }
      const qrWrap = card.querySelector('.ticket-qr-wrap');
      if (qrWrap) {
        qrWrap.replaceChildren();
        qrWrap.appendChild(qrSvg(code));
        const qrMeta = el('div', 'ticket-qr-meta');
        qrMeta.append(el('span', 'ticket-qr-status', 'Biglietto emesso'), el('span', 'ticket-code', code), el('p', 'ticket-caption', caption));
        qrWrap.appendChild(qrMeta);
        qrWrap.hidden = false;
      }
      const animate = Boolean(ctx?.engine?.state?.playing ?? sceneState.engine?.state?.playing) && !reduce();
      if (!animate) stream.scrollTop = stream.scrollHeight;
      else scrollEnd(false);
    },
    reminder({ time = '00:20', text = 'Ti avviso alle 00:20 per il rientro.', banner = 'Rientro illuminato e frequentato' }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      if (sceneState.returnBox) {
        const pill = sceneState.returnBox.querySelector('.reminder-pill');
        if (pill) {
          pill.textContent = `Attivo · ${time} ✓`;
          pill.classList.add('is-active');
        }
      }
      push(chat, { role: 'ai', type: 'text', text, time: ctx.clock });
      renderState();
      const wrap = el('div', 'msg-ai');
      wrap.append(sceneAiMeta(ctx.clock), el('p', 'msg-ai-text', text));
      const b = el('div', 'reminder-banner');
      b.append(el('span', 'reminder-banner-k', `Promemoria attivo · ${time}`), el('span', 'reminder-banner-v', banner));
      wrap.appendChild(b);
      sceneEnter(wrap, ctx);
    },
    advisory({ title = 'Avviso dal Comune', zone = '', cause = '', advice = '', routeState = 'Aggiornata' }, ctx) {
      const chat = sceneChat(ctx);
      sceneTyping?.remove();
      sceneTyping = null;
      sceneState.advisoryStrip?.remove();
      const strip = el('div', 'advisory-strip');
      strip.setAttribute('role', 'status');
      const top = el('div', 'advisory-top');
      top.append(el('span', 'advisory-tag', title), el('span', 'advisory-zone', zone));
      strip.append(top, el('p', 'advisory-body', cause));
      stream.before(strip);
      sceneState.advisoryStrip = strip;

      if (sceneState.routeBox) {
        const st = sceneState.routeBox.querySelector('.route-state');
        if (st) {
          st.textContent = routeState;
          st.classList.add('is-updated');
        }
      }
      if (advice) {
        push(chat, { role: 'ai', type: 'text', text: advice, time: ctx.clock });
        renderState();
        const wrap = el('div', 'msg-ai');
        wrap.append(sceneAiMeta(ctx.clock, 'advisory.push'), el('p', 'msg-ai-text', advice));
        sceneEnter(wrap, ctx);
      }
    },
    reset() { scene.begin(); }
  };

  renderCredits();
  syncAction();
  renderThread();

  return {
    scene,
    setUser(next) {
      session = next;
      const name = !next || next.isGuest ? null : next.name;
      whoEl.textContent = name ?? COPY.guest;
      emptyTitle.textContent = COPY.emptyHello(name);
      active = null;
      pending.clear();
      renderThread();
    },
    newChat,
    openChat,
    interrupt() { closeMenu({ restore: false }); cancelRecording(); if (stopActive) stopActive(); },
    focusEntry,
    get activeId() { return active?.id ?? null; },
    get credits() { return credits; },
    onActiveChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
