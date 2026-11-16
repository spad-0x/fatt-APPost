document.querySelector('#load-video')?.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/p-d13dCQQIo?autoplay=1&rel=0';
  frame.title = 'Video di presentazione fatt APPost';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allowFullscreen = true;
  document.querySelector('#video-shell').replaceChildren(frame);
  frame.focus();
});

// Duplicate only the visual ticker: assistive technology reads each phrase once.
const ticker = document.querySelector('.ticker-track');
const tickerGroup = ticker?.querySelector('.ticker-group');
if (tickerGroup) {
  const duplicate = tickerGroup.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  ticker.appendChild(duplicate);
}

const mascot = document.querySelector('.hero-art .mascot');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let gazeFrame = null;
let pointer = null;

function resetGaze() {
  if (gazeFrame !== null) cancelAnimationFrame(gazeFrame);
  gazeFrame = null;
  pointer = null;
  mascot?.style.removeProperty('--gaze-x');
  mascot?.style.removeProperty('--gaze-y');
}

function updateGaze() {
  gazeFrame = null;
  if (!mascot || !pointer || reducedMotion.matches) return;
  const bounds = mascot.getBoundingClientRect();
  const dx = pointer.x - (bounds.left + bounds.width / 2);
  const dy = pointer.y - (bounds.top + bounds.height / 2);
  const distance = Math.hypot(dx, dy);
  // Follow the pointer gently; keep the triangular eyes inside the face.
  const amount = Math.min(distance / 180, 1) * 10;
  const angle = Math.atan2(dy, dx) + 8 * Math.PI / 180;
  mascot.style.setProperty('--gaze-x', `${(Math.cos(angle) * amount).toFixed(2)}px`);
  mascot.style.setProperty('--gaze-y', `${(Math.sin(angle) * amount).toFixed(2)}px`);
}

if (mascot) {
  window.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (gazeFrame === null) gazeFrame = requestAnimationFrame(updateGaze);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetGaze);
  window.addEventListener('blur', resetGaze);
  window.addEventListener('scroll', () => {
    if (pointer && gazeFrame === null) gazeFrame = requestAnimationFrame(updateGaze);
  }, { passive: true });
  reducedMotion.addEventListener('change', resetGaze);
}
