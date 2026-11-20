/* Hearthscribe service worker. Bump VERSION on every deploy (and the ?v= strings in index.html). */
const VERSION = '2.0.23';
const CACHE = 'hs-' + VERSION; // app files, replaced on every version
const RT = 'hs-runtime'; // SRD data, sheet PDF, fonts: kept and refreshed in the background
const SHELL = [
 "./",
 "index.html",
 "manifest.json",
 "css/tokens.css?v=2.0.23",
 "css/layout.css?v=2.0.23",
 "css/components.css?v=2.0.23",
 "css/hp.css?v=2.0.23",
 "css/coc/coc.css?v=2.0.23",
 "css/mobile.css?v=2.0.23",
 "css/play.css?v=2.0.23",
 "css/bottombar.css?v=2.0.23",
 "css/home.css?v=2.0.23",
 "css/levelwiz.css?v=2.0.23",
 "css/homephone.css?v=2.0.23",
 "css/desksheet.css?v=2.0.23",
 "css/inventory.css?v=2.0.23",
 "vendor/pdf-lib.min.js",
 "vendor/pdf.min.js",
 "vendor/pdf.worker.min.js",
 "js/core/util.js?v=2.0.23",
 "js/core/sanitize.js?v=2.0.23",
 "js/core/registry.js?v=2.0.23",
 "js/core/state.js?v=2.0.23",
 "js/core/5e/engine.js?v=2.0.23",
 "js/core/5e/leveling.js?v=2.0.23",
 "js/core/5e/inventory.js?v=2.0.23",
 "js/core/5e/casting.js?v=2.0.23",
 "js/core/5e/resources.js?v=2.0.23",
 "js/data/cache.js?v=2.0.23",
 "js/data/loader.js?v=2.0.23",
 "js/pdf/5e/fields.js?v=2.0.23",
 "js/pdf/5e/export.js?v=2.0.23",
 "js/pdf/5e/cards.js?v=2.0.23",
 "js/pdf/5e/custom.js?v=2.0.23",
 "js/ui/constants.js?v=2.0.23",
 "js/ui/state.js?v=2.0.23",
 "js/ui/5e/rich.js?v=2.0.23",
 "js/ui/5e/build.js?v=2.0.23",
 "js/ui/5e/asi.js?v=2.0.23",
 "js/ui/5e/start.js?v=2.0.23",
 "js/ui/sources.js?v=2.0.23",
 "js/ui/5e/manage.js?v=2.0.23",
 "js/ui/5e/magic.js?v=2.0.23",
 "js/ui/5e/equipment.js?v=2.0.23",
 "js/ui/5e/sheet.js?v=2.0.23",
 "js/ui/5e/drawers.js?v=2.0.23",
 "js/ui/shell.js?v=2.0.23",
 "js/ui/events.js?v=2.0.23",
 "js/ui/play.js?v=2.0.23",
 "js/ui/listtools.js?v=2.0.23",
 "js/ui/5e/monster.js?v=2.0.23",
 "js/ui/encounter.js?v=2.0.23",
 "js/ui/coc/coc.js?v=2.0.23",
 "js/ui/theme.js?v=2.0.23",
 "js/ui/mobile.js?v=2.0.23",
 "js/ui/bottombar.js?v=2.0.23",
 "js/ui/homephone.js?v=2.0.23",
 "js/ui/levelwiz.js?v=2.0.23",
 "js/ui/desksheet.js?v=2.0.23",
 "js/ui/customsheet.js?v=2.0.23",
 "js/ui/5e/invdesk.js?v=2.0.23",
 "js/core/sync.js?v=2.0.23",
 "js/main.js?v=2.0.23",
 "js/pwa.js?v=2.0.23",
 "assets/icon-192.png",
 "assets/icon-512.png",
 "assets/apple-touch-icon.png",
 "assets/icon-maskable-512.png",
 "assets/5E_CharacterSheet_Fillable.pdf"
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE && k !== RT) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

const INDEX = () => new URL('index.html', self.registration.scope).href;
async function swr(req, name) {
  const c = await caches.open(name),
    hit = await c.match(req),
    net = fetch(req)
      .then((r) => {
        if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
        return r;
      })
      .catch(() => null);
  return hit || (await net) || Response.error();
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE),
    hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) c.put(req, r.clone());
  return r;
}
async function page(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000)),
    ]);
    if (r && r.ok) c.put(INDEX(), r.clone());
    return r;
  } catch (e) {
    return (await c.match(INDEX())) || (await c.match(req, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request,
    u = new URL(req.url);
  if (req.method !== 'GET' || req.headers.has('range')) return;
  if (u.origin !== location.origin) {
    if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) e.respondWith(swr(req, RT));
    return; // pack links, Google Drive and everything else go straight to the network
  }
  if (/\/(version|sw)\.js(on)?$/.test(u.pathname)) return; // always fresh: update checks
  if (req.mode === 'navigate') return e.respondWith(page(req));
  if (u.searchParams.has('v') || SHELL.includes(u.pathname.split('/').pop())) return e.respondWith(cacheFirst(req));
  e.respondWith(swr(req, RT));
});
