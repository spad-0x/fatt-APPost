// Menu laterale (stile ChatGPT/Claude): nuova chat, ricerca, cronologia per data, impostazioni.
import { COPY } from './i18n.js';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const DAY = 86400000;
const CONFIRM_MS = 3000;

function run(el, keyframes, duration, easing = EASE_OUT) {
  const anim = el.animate(keyframes, { duration: reduce() ? 1 : duration, easing, fill: 'both' });
  return anim.finished.then(() => anim.cancel()).catch(() => {});
}

function groupOf(t, today0) {
  if (t >= today0) return 'today';
  if (t >= today0 - DAY) return 'yesterday';
  if (t >= today0 - 6 * DAY) return 'week';
  if (t >= today0 - 29 * DAY) return 'month';
  return 'older';
}

export function createDrawer({ store, chat, getSession, onLogout, showToast }) {
  const app = document.getElementById('app');
  const view = document.getElementById('view-chat');
  const layer = document.getElementById('drawer-layer');
  const scrim = document.getElementById('drawer-scrim');
  const drawer = document.getElementById('drawer');
  const main = document.getElementById('drawer-main');
  const settings = document.getElementById('drawer-settings');
  const menuBtn = document.getElementById('btn-menu');
  const closeBtn = document.getElementById('btn-drawer-close');
  const newBtn = document.getElementById('btn-drawer-new');
  const search = document.getElementById('drawer-search');
  const history = document.getElementById('history');
  const historyEmpty = document.getElementById('history-empty');
  const userBtn = document.getElementById('btn-settings');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userSub = document.getElementById('user-sub');
  const settingsBack = document.getElementById('btn-settings-back');
  const setName = document.getElementById('set-name');
  const setAccount = document.getElementById('set-account');
  const setCredits = document.getElementById('set-credits');
  const setChats = document.getElementById('set-chats');
  const clearBtn = document.getElementById('btn-clear-history');
  const clearLabel = document.getElementById('clear-history-label');
  const logoutBtn = document.getElementById('btn-logout');

  let open = false;
  let busy = false;

  /* ---------- Cronologia ---------- */
  function renderHistory() {
    const q = search.value.trim().toLowerCase();
    const match = (c) => !q
      || c.title.toLowerCase().includes(q)
      || c.messages.some((m) => m.text && m.text.toLowerCase().includes(q));
    const chats = store.list().filter(match);

    const d = new Date();
    const today0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const order = ['saved', 'today', 'yesterday', 'week', 'month', 'older'];
    const buckets = new Map(order.map((k) => [k, []]));
    chats.forEach((c) => buckets.get(c.bookmarked ? 'saved' : groupOf(c.updatedAt, today0)).push(c));

    const activeId = chat.activeId;
    const sections = [];
    for (const key of order) {
      const list = buckets.get(key);
      if (!list.length) continue;
      const section = document.createElement('section');
      section.className = 'h-group';
      const h = document.createElement('h3');
      h.className = 'h-label';
      h.id = `h-${key}`;
      h.textContent = COPY.groups[key];
      const ul = document.createElement('ul');
      ul.className = 'h-list';
      ul.setAttribute('aria-labelledby', h.id);
      list.forEach((c) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'h-item';
        b.dataset.id = c.id;
        b.textContent = c.title;
        if (c.id === activeId) b.setAttribute('aria-current', 'page');
        li.appendChild(b);
        ul.appendChild(li);
      });
      section.append(h, ul);
      sections.push(section);
    }
    history.replaceChildren(...sections);
    historyEmpty.hidden = sections.length > 0;
    historyEmpty.textContent = q ? COPY.historyNoMatch : COPY.historyEmpty;
  }

  history.addEventListener('click', (e) => {
    const item = e.target.closest('.h-item');
    if (!item) return;
    const id = item.dataset.id;
    close({ restoreFocus: false }).then(() => chat.openChat(id));
  });
  search.addEventListener('input', renderHistory);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; renderHistory(); }
  });

  /* ---------- Utente e impostazioni ---------- */
  function renderUser() {
    const s = getSession();
    const guest = !s || s.isGuest;
    const name = guest ? COPY.guest : s.name;
    userAvatar.textContent = name.charAt(0).toUpperCase();
    userName.textContent = name;
    userSub.textContent = guest ? COPY.accountGuest : s.email;
    setName.textContent = name;
    setAccount.textContent = guest ? COPY.accountGuest : s.email;
    setCredits.textContent = COPY.creditsLabel(chat.credits);
    setChats.textContent = COPY.chatsCount(store.size);
    clearBtn.disabled = store.size === 0;
  }

  let clearArmed = 0;
  function disarmClear() {
    clearTimeout(clearArmed);
    clearArmed = 0;
    clearBtn.classList.remove('is-armed');
    clearLabel.textContent = COPY.clearHistory;
  }
  clearBtn.addEventListener('click', () => {
    if (!clearArmed) {
      clearBtn.classList.add('is-armed');
      clearLabel.textContent = COPY.clearHistoryConfirm;
      clearArmed = setTimeout(disarmClear, CONFIRM_MS);
      return;
    }
    disarmClear();
    store.clear();
    renderUser();
    showToast(COPY.historyCleared);
    settingsBack.focus();
  });

  function showSettings() {
    renderUser();
    disarmClear();
    main.hidden = true;
    settings.hidden = false;
    run(settings, [{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }], 200);
    settingsBack.focus();
  }
  function showMain({ focus = true } = {}) {
    disarmClear();
    settings.hidden = true;
    main.hidden = false;
    if (focus) {
      run(main, [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], 200);
      userBtn.focus();
    }
  }
  userBtn.addEventListener('click', showSettings);
  settingsBack.addEventListener('click', () => showMain());

  logoutBtn.addEventListener('click', async () => {
    await close({ restoreFocus: false });
    onLogout();
  });

  /* ---------- Apertura e chiusura ---------- */
  async function openDrawer() {
    if (open || busy || view.hidden) return;
    busy = true;
    open = true;
    chat.interrupt();
    search.value = '';
    showMain({ focus: false });
    renderHistory();
    renderUser();
    layer.hidden = false;
    view.inert = true;
    menuBtn.setAttribute('aria-expanded', 'true');
    newBtn.focus({ preventScroll: true });
    await Promise.all([
      run(scrim, [{ opacity: 0 }, { opacity: 1 }], 200),
      run(drawer, [{ transform: 'translateX(-100%)' }, { transform: 'none' }], 240)
    ]);
    busy = false;
  }

  async function close({ restoreFocus = true } = {}) {
    if (!open || busy) return;
    busy = true;
    await Promise.all([
      run(scrim, [{ opacity: 1 }, { opacity: 0 }], 180, EASE_IN),
      run(drawer, [{ transform: 'none' }, { transform: 'translateX(-100%)' }], 200, EASE_IN)
    ]);
    layer.hidden = true;
    view.inert = false;
    open = false;
    busy = false;
    menuBtn.setAttribute('aria-expanded', 'false');
    disarmClear();
    if (restoreFocus) menuBtn.focus();
  }

  menuBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', () => close());
  scrim.addEventListener('click', () => close());
  newBtn.addEventListener('click', () => close({ restoreFocus: false }).then(() => chat.newChat()));

  // Trappola del focus; ESC torna indietro dalle impostazioni, altrimenti chiude
  layer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!settings.hidden) showMain();
      else close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [...drawer.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
      .filter((n) => !n.disabled && n.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Gesti: swipe dal bordo sinistro per aprire, verso sinistra per chiudere ---------- */
  let touch = null;
  app.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const x = t.clientX - app.getBoundingClientRect().left;
    if (!open && !view.hidden && x <= 24) touch = { x: t.clientX, y: t.clientY, mode: 'open' };
    else if (open && drawer.contains(e.target)) touch = { x: t.clientX, y: t.clientY, mode: 'close' };
    else touch = null;
  }, { passive: true });
  app.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = Math.abs(t.clientY - touch.y);
    if (dy < 48) {
      if (touch.mode === 'open' && dx > 56) openDrawer();
      if (touch.mode === 'close' && dx < -56) close();
    }
    touch = null;
  }, { passive: true });

  // La cronologia segue l'archivio e la chat attiva anche a menu aperto
  store.onChange(() => { if (open) { renderHistory(); renderUser(); } });
  chat.onActiveChange(() => { if (open) renderHistory(); });

  return { open: openDrawer, close, get isOpen() { return open; } };
}
