/* Mobile helpers. Load after events.js and shell.js, before main.js.
   1) On phones, the description panel (.right) of list screens opens as a bottom sheet when a row is tapped.
   2) The scrolling tab strips keep the active tab in view.
   Nothing here runs its logic on wide screens. */
(() => {
  const MQ = window.matchMedia('(max-width: 860px)');
  const body = document.body;
  // rows that preview something: build/magic/equipment lists, monster reference stat blocks and features
  const TRIG = '[data-a="pv"],[data-a="mrpick"],[data-a="mfpick"]';

  const bg = document.createElement('div');
  bg.id = 'sheetbg';
  body.appendChild(bg);

  /* ---- sheet open / close (state lives on <body>, so redraws do not lose it) ---- */
  const isOpen = () => body.classList.contains('sheet-open');
  function openSheet() {
    if (isOpen()) return;
    body.classList.add('sheet-open');
    try { history.pushState({ hsSheet: 1 }, ''); } catch (e) {} // Android back button closes the sheet
  }
  function closeSheet(fromPop) {
    if (!isOpen()) return;
    body.classList.remove('sheet-open');
    if (!fromPop) {
      try { if (history.state && history.state.hsSheet) history.back(); } catch (e) {}
    }
  }
  window.addEventListener('popstate', () => closeSheet(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  MQ.addEventListener('change', () => { if (!MQ.matches) closeSheet(); sync(); });

  // events.js has already handled and redrawn by the time this runs (it was registered first)
  document.addEventListener('click', (e) => {
    if (!MQ.matches) return;
    const t = e.target;
    if (t === bg || (t.closest && t.closest('[data-sheet-close]'))) return closeSheet();
    if (t.closest('.right')) {
      if (t.closest('[data-a]')) closeSheet(); // Select, Remove, Add, Buy... then show the result
      return;
    }
    if (t.closest(TRIG) && document.querySelector('#main.sheetable')) openSheet();
  });

  /* ---- keep markup in sync after every redraw ---- */
  let last = { nav: '', sub: '' }, savedSub = 0, queued = false;

  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('subtabs')) savedSub = t.scrollLeft;
  }, true);

  function centerActive(scroller, a) {
    const s = scroller.getBoundingClientRect(), r = a.getBoundingClientRect();
    scroller.scrollLeft += r.left - s.left - (s.width - r.width) / 2;
  }

  function sync() {
    queued = false;
    const m = document.getElementById('main');
    if (!m) return;

    // list + description screens get the sheet; screens with static explanation text stay stacked
    const left = m.querySelector(':scope > .left'), right = m.querySelector(':scope > .right');
    const ok = !!(left && right && left.querySelector(TRIG));
    m.classList.toggle('sheetable', ok);
    if (!ok) closeSheet();
    if (ok && !right.querySelector('.sheet-grab'))
      right.insertAdjacentHTML('afterbegin', '<div class="sheet-grab"><button class="lnk" data-sheet-close type="button">Close</button></div>');

    if (!MQ.matches) return;

    // main tab strip: the element is stable, so only scroll when the active tab changed
    const nav = document.getElementById('nav'), na = nav && nav.querySelector('.tab.on');
    if (na) {
      const k = na.dataset.a + ':' + na.dataset.v;
      if (k !== last.nav) { last.nav = k; centerActive(nav, na); }
    }
    // sub tab strip: shell.js rebuilds it on every redraw, so restore its scroll position
    const st = document.querySelector('#sub .subtabs'), sa = st && st.querySelector('.tab.on');
    if (st) {
      const k = sa ? sa.dataset.a + ':' + sa.dataset.v : '';
      if (sa && k !== last.sub) { last.sub = k; centerActive(st, sa); savedSub = st.scrollLeft; }
      else st.scrollLeft = savedSub;
    }
  }

  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
  new MutationObserver(schedule).observe(body, { childList: true, subtree: true });
  schedule();
})();
