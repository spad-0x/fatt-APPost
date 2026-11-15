// Accedi / Registrati / Guest. Sessione dimostrativa in localStorage (nessun backend).
import { COPY } from './i18n.js';

const USERS_KEY = 'fattoapposta_users';
const SESSION_KEY = 'fattoapposta_session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAuth({ mascot, onAuthenticated }) {
  let mode = 'login';

  const seg = document.querySelector('.seg');
  const tabs = [...document.querySelectorAll('.seg-tab')];
  const form = document.getElementById('auth-form');
  const nameCollapse = document.getElementById('name-collapse');
  const nameInput = document.getElementById('auth-name');
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const eyeBtn = document.getElementById('btn-eye');
  const submitBtn = document.getElementById('btn-auth-submit');
  const errorEl = document.getElementById('auth-error');
  const guestBtn = document.getElementById('btn-guest');

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const getUsers = () => readJSON(USERS_KEY, []);
  const getSession = () => readJSON(SESSION_KEY, null);
  const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));

  const fieldError = new Map([
    [emailInput, document.getElementById('err-email')],
    [passInput, document.getElementById('err-password')]
  ]);
  fieldError.forEach((err, input) => { err.id && input.setAttribute('aria-describedby', err.id); });

  function clearErrors() {
    errorEl.textContent = '';
    fieldError.forEach((err, input) => { err.textContent = ''; input.removeAttribute('aria-invalid'); });
  }

  // L'errore compare sotto il campo che lo riguarda; il testo nascosto lo annuncia ai lettori di schermo
  function showError(input, message) {
    fieldError.get(input).textContent = message;
    errorEl.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }

  // Demo locale: la password non viene mai salvata in chiaro
  async function digest(text) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return 'sha256:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv:' + h.toString(16);
  }

  function setMode(next, { focus = false } = {}) {
    mode = next;
    const isReg = mode === 'register';
    seg.dataset.mode = mode;
    tabs.forEach((t) => {
      const on = t.dataset.mode === mode;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    form.setAttribute('aria-labelledby', isReg ? 'tab-register' : 'tab-login');
    nameCollapse.classList.toggle('is-open', isReg);
    nameCollapse.inert = !isReg;
    passInput.autocomplete = isReg ? 'new-password' : 'current-password';
    submitBtn.textContent = isReg ? COPY.submitRegister : COPY.submitLogin;
    clearErrors();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
    tab.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 'login' : e.key === 'End' ? 'register' : (mode === 'login' ? 'register' : 'login');
        setMode(next, { focus: true });
      }
    });
  });

  // La mascotte guarda il campo attivo e si copre gli occhi sulla password nascosta
  const fields = [nameInput, emailInput, passInput];
  fields.forEach((input, idx) => {
    input.addEventListener('focus', () => {
      if (input === passInput && passInput.type === 'password') {
        mascot.setState('shy');
      } else {
        mascot.setState('curious');
        mascot.lookAt(-0.2 + idx * 0.2, 1);
      }
    });
    input.addEventListener('blur', () => {
      mascot.setState('idle');
      mascot.lookAt(0, 0);
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid')) {
        input.removeAttribute('aria-invalid');
        fieldError.get(input).textContent = '';
        errorEl.textContent = '';
      }
      if (input !== passInput) mascot.lookAt(-0.3 + Math.min(input.value.length, 30) / 50, 1);
    });
  });

  eyeBtn.addEventListener('click', () => {
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    eyeBtn.setAttribute('aria-pressed', String(show));
    eyeBtn.setAttribute('aria-label', show ? COPY.hidePassword : COPY.showPassword);
    eyeBtn.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    if (document.activeElement === passInput || document.activeElement === eyeBtn) {
      mascot.setState(show ? 'curious' : 'shy');
      if (show) mascot.lookAt(0.2, 1);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value;
    const name = nameInput.value.trim() || email.split('@')[0];

    if (!EMAIL_RE.test(email)) return showError(emailInput, COPY.errEmail);
    if (password.length < 6) return showError(passInput, COPY.errPassword);

    const users = getUsers();
    const found = users.find((u) => u.email === email);
    const hash = await digest(password);

    if (mode === 'register') {
      if (found) { Object.assign(found, { name, hash }); delete found.password; }
      else users.push({ name, email, hash });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      const session = { name, email, isGuest: false };
      saveSession(session);
      mascot.setState('happy');
      return onAuthenticated(session);
    }

    // Accesso dimostrativo: un'email nuova entra senza registrazione, una nota deve combaciare
    const matches = !found || found.hash === hash || (found.password != null && found.password === password);
    if (!matches) return showError(passInput, COPY.errCredentials);

    const session = { name: found?.name || email.split('@')[0], email, isGuest: false };
    saveSession(session);
    mascot.setState('happy');
    onAuthenticated(session);
  });

  guestBtn.addEventListener('click', () => {
    const session = { name: COPY.guest, email: null, isGuest: true };
    saveSession(session);
    mascot.setState('happy');
    onAuthenticated(session);
  });

  // Uscita: la sessione sparisce, il modulo torna pulito
  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    form.reset();
    if (passInput.type !== 'password') eyeBtn.click();
    setMode('login');
  }

  setMode('login');

  return { getSession, setMode, signOut };
}
