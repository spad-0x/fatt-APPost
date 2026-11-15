// Rete prima, cache come ripiego: in sviluppo non serve mai file vecchi, offline funziona ancora.
// In regia (?scena=…) la pagina non registra il service worker e toglie quello esistente.
const CACHE_NAME = 'fattoapposta-v12';
const APP_SHELL = [
  './',
  './index.html',
  './napolios.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/styles.css',
  './css/napolios.css',
  './js/app.js',
  './js/auth.js',
  './js/chat.js',
  './js/drawer.js',
  './js/store.js',
  './js/i18n.js',
  './js/mascot.js',
  './js/transitions.js',
  './js/engine.js',
  './js/regia.js',
  './js/napolios.js',
  './js/city/renderer.js',
  './js/city/simulation.js',
  './geo/assi.geojson',
  './geo/semafori.geojson',
  './geo/percorsi.geojson',
  './geo/rischio.geojson',
  './scenari/prova.json',
  './scenari/apertura.json',
  './scenari/l1.json',
  './scenari/s1.json',
  './scenari/s2.json',
  './scenari/s2-avviso.json',
  './scenari/visione.json',
  './scenari/dati.json',
  './scenari/notte.json',
  './scenari/q1.json',
  './scenari/q2.json',
  './scenari/q3.json',
  './assets/city/napoli.glb',
  './assets/city/transit.json',
  './assets/icons/icon.svg',
  './assets/fonts/poppins-latin-400-normal.woff2',
  './assets/fonts/poppins-latin-500-normal.woff2',
  './assets/fonts/poppins-latin-600-normal.woff2',
  './assets/fonts/poppins-latin-ext-400-normal.woff2',
  './assets/fonts/poppins-latin-ext-500-normal.woff2',
  './assets/fonts/poppins-latin-ext-600-normal.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
