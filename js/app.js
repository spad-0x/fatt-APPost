import { COPY } from './i18n.js';
import { createMascot } from './mascot.js';
import { createTransitions } from './transitions.js';
import { createAuth } from './auth.js';
import { createStore } from './store.js';
import { createChat } from './chat.js';
import { createDrawer } from './drawer.js';
import { readRegiaParams, startRegia, disableServiceWorker } from './regia.js';

// Scene di questa pagina, nell'ordine dei tasti 1–9 della regia
const SCENES = ['prova', 's1', 's2-avviso', 'q1', 'q2', 'q3'];

function init() {
  const mascot = createMascot({
    svg: document.getElementById('mascot'),
    button: document.getElementById('mascot-btn')
  });
  const transitions = createTransitions({ mascot });

  const toast = document.getElementById('toast');
  let toastTimer = 0;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  const store = createStore();
  const chat = createChat({ showToast, store });

  // Ogni profilo ha la sua cronologia; il Guest condivide quella del dispositivo
  function startSession(session) {
    store.use(session && !session.isGuest && session.email ? session.email : 'guest');
    chat.setUser(session);
  }

  const auth = createAuth({
    mascot,
    onAuthenticated(session) {
      startSession(session);
      transitions.authToChat().then(() => chat.focusEntry());
    }
  });

  createDrawer({
    store,
    chat,
    showToast,
    getSession: () => auth.getSession(),
    onLogout() {
      chat.interrupt();
      auth.signOut();
      transitions.chatToOnboarding();
    }
  });

  // Tocco sulla mascotte: rimbalzo e saluto diverso
  const speech = document.getElementById('speech');
  let greet = 0;
  document.getElementById('mascot-btn').addEventListener('click', () => {
    greet = (greet + 1) % COPY.greetings.length;
    speech.textContent = COPY.greetings[greet];
    mascot.setState('happy');
    mascot.bounce();
    setTimeout(() => mascot.setState('idle'), 700);
  });

  document.getElementById('btn-start').addEventListener('click', () => transitions.openAuth());
  document.getElementById('btn-auth-close').addEventListener('click', () => transitions.closeAuth());

  const regia = readRegiaParams();
  if (regia.scena) {
    // Regia: niente onboarding né accesso, archivio separato, identità dichiarata dallo script
    store.use('scena');
    transitions.showChat();
    disableServiceWorker().catch(() => {});
    startRegia({
      showHud: false,
      targets: { chat: chat.scene },
      scenes: SCENES,
      onLoad(script) {
        chat.setUser(script.user ? { name: script.user, isGuest: false } : { name: COPY.guest, isGuest: true });
      }
    }).then((engine) => chat.scene.setEngine(engine));
    return;
  }

  const session = auth.getSession();
  if (session) {
    startSession(session);
    transitions.showChat();
    chat.focusEntry();
  } else {
    mascot.entrance();
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

init();
