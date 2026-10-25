/* Start-up: load the content packs, then draw. */
(function () {
  const fail = (e) => {
    document.getElementById('main').innerHTML =
      '<div class="left"><h2>Could not load the rules data</h2><p>' +
      String((e && e.message) || e).replace(/</g, '&lt;') +
      '</p><p class="hint">If you opened index.html straight from a folder, serve the folder over http (for example <code>python -m http.server</code>) or open dist/hearthscribe.html instead.</p></div>';
  };
  try {
    if (window.__HS_BUNDLE__) {
      // standalone build: instant start, cached packs join a moment later
      Loader.loadPrefs();
      Loader.initBuiltin(Loader.readBundled());
      Loader.rebuild();
      draw();
      Loader.loadCached()
        .then(() => draw())
        .catch(() => {});
    } else {
      Loader.boot()
        .then(() => draw())
        .catch(fail);
    }
  } catch (e) {
    fail(e);
  }
})();
