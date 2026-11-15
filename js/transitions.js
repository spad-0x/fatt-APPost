// Transizioni tra le viste: Web Animations API, 150–250ms, nessuna dipendenza.

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

function run(el, keyframes, duration, easing = EASE_OUT) {
  if (!el) return Promise.resolve();
  const anim = el.animate(keyframes, { duration: reduce() ? 1 : duration, easing, fill: 'both' });
  return anim.finished.then(() => anim.cancel()).catch(() => {});
}

export function createTransitions({ mascot }) {
  const app = document.getElementById('app');
  const onboarding = document.getElementById('view-onboarding');
  const chat = document.getElementById('view-chat');
  const layer = document.getElementById('auth-layer');
  const sheet = document.getElementById('auth-sheet');
  const scrim = document.getElementById('auth-scrim');
  const mascotWrap = document.getElementById('mascot-wrap');
  const startBtn = document.getElementById('btn-start');

  let busy = false;
  let lastFocus = null;

  // Porta la mascotte nello spazio libero sopra il foglio
  function fitMascotAboveSheet() {
    const appH = app.clientHeight;
    const free = appH - sheet.offsetHeight;
    const baseH = mascotWrap.offsetHeight;
    // offsetTop ignora i transform: posizione di riposo della mascotte nella vista
    const baseCenter = mascotWrap.offsetTop + baseH / 2;
    const targetH = Math.min(baseH, Math.max(48, free - 56));
    const scale = targetH / baseH;
    const targetCenter = free / 2 + 6;
    mascotWrap.style.setProperty('--stage-scale', scale.toFixed(3));
    mascotWrap.style.setProperty('--stage-shift', `${Math.round(targetCenter - baseCenter)}px`);
  }
  function resetMascotStage() {
    mascotWrap.style.removeProperty('--stage-shift');
    mascotWrap.style.removeProperty('--stage-scale');
  }

  async function openAuth() {
    if (busy) return;
    busy = true;
    lastFocus = document.activeElement;
    layer.hidden = false;
    app.classList.add('auth-open');
    onboarding.inert = true;
    mascot.setTracking(false);
    mascot.setState('happy');
    fitMascotAboveSheet();
    await Promise.all([
      run(scrim, [{ opacity: 0 }, { opacity: 1 }], 200),
      run(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 240)
    ]);
    mascot.setState('idle');
    const selected = sheet.querySelector('[role="tab"][aria-selected="true"]');
    selected?.focus();
    busy = false;
  }

  async function closeAuth({ toChat = false } = {}) {
    if (busy) return;
    busy = true;
    if (!toChat) {
      app.classList.remove('auth-open');
      resetMascotStage();
    }
    await Promise.all([
      run(scrim, [{ opacity: 1 }, { opacity: 0 }], 180, EASE_IN),
      run(sheet, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], 200, EASE_IN)
    ]);
    layer.hidden = true;
    onboarding.inert = false;
    busy = false;
    if (!toChat) {
      mascot.setTracking(true);
      mascot.setState('idle');
      (lastFocus && document.contains(lastFocus) ? lastFocus : startBtn).focus();
    }
  }

  async function authToChat() {
    if (busy) return;
    const closing = closeAuth({ toChat: true });
    await run(onboarding, [{ opacity: 1 }, { opacity: 0 }], 160, EASE_IN);
    await closing;
    busy = true;
    onboarding.hidden = true;
    onboarding.classList.remove('is-active');
    app.classList.remove('auth-open');
    resetMascotStage();
    chat.hidden = false;
    chat.classList.add('is-active');
    await run(chat, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 240);
    document.getElementById('chat-title').focus({ preventScroll: true });
    busy = false;
  }

  // Sessione già presente all'avvio: si entra direttamente nella chat, senza animazioni
  function showChat() {
    onboarding.hidden = true;
    onboarding.classList.remove('is-active');
    mascot.setTracking(false);
    chat.hidden = false;
    chat.classList.add('is-active');
  }

  async function chatToOnboarding() {
    if (busy) return;
    busy = true;
    await run(chat, [{ opacity: 1 }, { opacity: 0 }], 160, EASE_IN);
    chat.hidden = true;
    chat.classList.remove('is-active');
    onboarding.hidden = false;
    onboarding.classList.add('is-active');
    mascot.setTracking(true);
    mascot.setState('idle');
    await run(onboarding, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], 220);
    startBtn.focus();
    busy = false;
  }

  // Trappola del focus ed ESC nel foglio
  layer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAuth();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [...sheet.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && !el.closest('[inert]') && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  scrim.addEventListener('click', () => closeAuth());

  // Il foglio cambia altezza (campo Nome, errori): la mascotte si riposiziona
  if ('ResizeObserver' in window) {
    let last = 0;
    new ResizeObserver(() => {
      const h = sheet.offsetHeight;
      if (layer.hidden || !app.classList.contains('auth-open') || Math.abs(h - last) < 2) return;
      last = h;
      fitMascotAboveSheet();
    }).observe(sheet);
  }

  window.addEventListener('resize', () => {
    if (!layer.hidden && app.classList.contains('auth-open')) {
      resetMascotStage();
      requestAnimationFrame(fitMascotAboveSheet);
    }
  });

  return { openAuth, closeAuth, authToChat, chatToOnboarding, showChat, refit: fitMascotAboveSheet };
}
