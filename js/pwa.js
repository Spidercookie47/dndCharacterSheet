/* Install as an app + offline updates. Load last in index.html (after events.js, so on() exists).
   Needs sw.js and manifest.json at the site root, and https (or localhost). */
(() => {
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const hidden = () => {
    try { return localStorage.getItem('hs-install-hide') === '1'; } catch (e) { return false; }
  };
  const redraw = () => {
    const a = document.activeElement;
    if (a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName)) return; // never interrupt typing
    if (typeof draw === 'function' && tab === 'start') draw();
  };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__hsBIP = e; redraw(); });
  addEventListener('appinstalled', () => { window.__hsBIP = null; redraw(); });

  /* The card on the Home screen (start.js calls this). */
  window.hsInstallCard = () => {
    if (standalone() || hidden()) return '';
    const x = '<button class="lnk" data-a="pwahide">Not now</button>';
    if (window.__hsBIP)
      return `<div class="hscard"><div><b>Install Hearthscribe</b><small>Opens full screen like an app and works offline.</small></div><span class="bar"><button data-a="pwainstall">Install</button>${x}</span></div>`;
    if (typeof HS_IOS !== 'undefined' && HS_IOS)
      return `<div class="hscard"><div><b>Install on iPhone or iPad</b><small>In Safari tap Share, then Add to Home Screen. Characters saved in the browser do not carry over, so save a file or turn on Drive sync first.</small></div><span class="bar">${x}</span></div>`;
    return '';
  };
  on('pwainstall', () => {
    const e = window.__hsBIP;
    if (!e) return false;
    window.__hsBIP = null;
    e.prompt();
    e.userChoice.then(redraw, redraw);
    return false;
  });
  on('pwahide', () => {
    try { localStorage.setItem('hs-install-hide', '1'); } catch (e) {}
  });

  /* Service worker: offline use, and a notice when a new version has been installed. */
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let reloading = false;
  const had = !!navigator.serviceWorker.controller; // true = this is an update, not a first install
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || reloading) return;
    if (typeof Loader !== 'undefined' && Loader.notice)
      Loader.notice('sw', 'Hearthscribe was updated.', 'Reload', async () => { reloading = true; location.reload(); });
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 3600000);
    })
    .catch(() => {});
})();
