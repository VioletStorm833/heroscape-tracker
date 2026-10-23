// Offline support for the installed app. Only the site's own files are kept here (never user data).
// Every request goes to the network first, so a new version of the site shows up as soon as it is
// online; the kept copy is used only when the network fails.
const CACHE = 'hs-site-v1';
const CORE = [
  './', 'index.html', 'css/style.css', 'js/data.js', 'js/app.js', 'js/pwa.js', 'site-edits.json',
  'vendor/d3.v7.min.js', 'manifest.webmanifest',
  'data/units.json', 'data/abilities.json', 'data/cards.json', 'data/products.json',
  'data/terrain.json', 'data/maps.json',
];

self.addEventListener('install', (e) => {
  // one missing file should not stop the rest from being kept
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    // whole responses only (audio and PDFs can come back in parts)
    if (res.status === 200 && !req.headers.has('range')) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
