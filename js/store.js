// Archivio delle conversazioni in localStorage, separato per utente (email o Guest).
// Una conversazione entra nell'archivio solo al primo messaggio: niente chat vuote in cronologia.

const PREFIX = 'fattoapposta_chats:';

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

export function createStore() {
  let key = null;
  let chats = [];
  const listeners = new Set();

  const persist = () => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(chats)); } catch { /* quota piena: la sessione resta in memoria */ }
  };
  const emit = () => listeners.forEach((fn) => fn());

  return {
    use(userKey) {
      key = PREFIX + userKey;
      try { chats = JSON.parse(localStorage.getItem(key)) ?? []; } catch { chats = []; }
      if (!Array.isArray(chats)) chats = [];
      emit();
    },
    list() {
      return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    get(id) {
      return chats.find((c) => c.id === id) ?? null;
    },
    has(id) {
      return chats.some((c) => c.id === id);
    },
    // touch=false per modifiche che non devono riordinare la cronologia (es. segnalibro)
    save(chat, { touch = true } = {}) {
      if (touch) chat.updatedAt = Date.now();
      const i = chats.findIndex((c) => c.id === chat.id);
      if (i < 0) chats.push(chat); else chats[i] = chat;
      persist();
      emit();
    },
    remove(id) {
      chats = chats.filter((c) => c.id !== id);
      persist();
      emit();
    },
    clear() {
      chats = [];
      persist();
      emit();
    },
    get size() { return chats.length; },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
