// Mascotte: sfera salvia opaca con occhi triangolari (reinterpretazione di screen1).
// SVG inline, nessuna dipendenza. Stati: idle, curious, shy, thinking, listening, happy.

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createMascot({ svg, button }) {
  const body = svg.querySelector('.m-body');
  const face = svg.querySelector('.m-face');

  let state = 'idle';
  let look = { x: 0, y: 0 };
  let tracking = true;
  let blinkTimer = null;
  let idleAnim = null;

  function applyFace() {
    // Gli occhi si spostano al massimo di 12 unità del viewBox
    let { x, y } = look;
    if (state === 'thinking') { x = -0.7; y = -0.8; }
    face.style.transform = `translate(${(x * 12).toFixed(1)}px, ${(y * 10).toFixed(1)}px)`;
  }

  function setState(next) {
    state = next;
    svg.dataset.state = next;
    applyFace();
  }

  function lookAt(x, y) {
    look = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    applyFace();
  }

  function blink() {
    if (state === 'shy') return;
    svg.dataset.blink = 'true';
    setTimeout(() => { svg.dataset.blink = 'false'; }, 130);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      blink();
      scheduleBlink();
    }, 2600 + Math.random() * 2600);
  }

  function startIdle() {
    if (reduceMotion() || idleAnim) return;
    idleAnim = body.animate(
      [{ transform: 'translateY(0) scale(1, 1)' }, { transform: 'translateY(-4px) scale(1.012, 0.992)' }, { transform: 'translateY(0) scale(1, 1)' }],
      { duration: 3200, iterations: Infinity, easing: 'ease-in-out' }
    );
  }

  function bounce() {
    if (reduceMotion()) return;
    body.animate(
      [
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1.08, 0.88)', offset: 0.25 },
        { transform: 'scale(0.95, 1.07) translateY(-10px)', offset: 0.55 },
        { transform: 'scale(1, 1)' }
      ],
      { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', composite: 'add' }
    );
  }

  function entrance() {
    if (reduceMotion()) return;
    // Unico momento coreografato: la sfera atterra e si assesta. Visibile fin dall'inizio.
    body.animate(
      [
        { transform: 'translateY(-18px) scale(0.96, 1.04)' },
        { transform: 'translateY(0) scale(1.06, 0.92)', offset: 0.55 },
        { transform: 'translateY(0) scale(1, 1)' }
      ],
      { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', composite: 'add' }
    );
  }

  // Gli occhi seguono il puntatore (solo dispositivi con puntatore fine)
  function onPointerMove(e) {
    if (!tracking || state === 'shy' || state === 'curious') return;
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    lookAt((e.clientX - cx) / (window.innerWidth / 2), (e.clientY - cy) / (window.innerHeight / 2));
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  scheduleBlink();
  startIdle();
  setState('idle');

  return {
    setState,
    lookAt,
    bounce,
    blink,
    entrance,
    get state() { return state; },
    setTracking(v) { tracking = v; if (!v) lookAt(0, 0); },
    button
  };
}
