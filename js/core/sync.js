/* Google Drive sync. Characters are stored as one JSON file each in the hidden appDataFolder
   (scope drive.appdata), so they never show up in the user's normal Drive.
   Needs: events.js (on), state.js (store, ch, persist, fresh), shell.js (draw), leveling.js (ensureLv).
   Load it AFTER events.js. Paste your OAuth Client ID below. */
const GDRIVE_CLIENT_ID = '1070316252846-j5dmg5mlepi85idurbgv41m10qe52cls.apps.googleusercontent.com';

const Sync = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata',
    API = 'https://www.googleapis.com/drive/v3/',
    UP = 'https://www.googleapis.com/upload/drive/v3/files',
    FLAG = 'hs-gdrive';
  let state = 'off',
    errMsg = '',
    tc = null,
    gisP = null,
    tokVal = '',
    tokExp = 0,
    tokP = null,
    pend = null,
    timer = null,
    running = false,
    again = false,
    uiDirty = false,
    deferred = false;
  const stamped = {};

  const S = () => {
    const s = (store.sync = store.sync || { acct: '', email: '', known: {}, pendingDel: [], last: 0 });
    s.deleted = s.deleted || {};
    return s;
  };
  const saveStore = () => {
    try {
      localStorage.setItem('aw-store', JSON.stringify(store));
    } catch (e) {}
  };
  const linked = () => {
    try {
      return localStorage.getItem(FLAG) === '1';
    } catch (e) {
      return false;
    }
  };

  const isEmpty = (v) =>
    v === undefined ||
    v === '' ||
    (v && typeof v === 'object' && (Array.isArray(v) ? v.length === 0 : Object.keys(v).every((k) => isEmpty(v[k]))));
  function canon(v, top) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    if (Array.isArray(v)) return '[' + v.map((x) => canon(x)).join(',') + ']';
    return (
      '{' +
      Object.keys(v)
        .filter((k) => !(top && k === 'updated') && !isEmpty(v[k]))
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canon(v[k]))
        .join(',') +
      '}'
    );
  }
  function cyrb53(str) {
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const hashOf = (c) => {
    if (typeof DB !== 'undefined' && DB.length) {
      try {
        ensureLv(c);
      } catch (e) {}
    }
    return cyrb53(canon(c, true));
  };

  function loadGis() {
    return (gisP =
      gisP ||
      new Promise((res, rej) => {
        if (window.google && google.accounts && google.accounts.oauth2) return res();
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = res;
        s.onerror = () => rej(new Error('Could not load Google sign-in.'));
        document.head.appendChild(s);
      }));
  }
  function getToken(prompt) {
    if (tokP) return tokP;
    tokP = new Promise((res, rej) => {
      if (!tc)
        tc = google.accounts.oauth2.initTokenClient({
          client_id: GDRIVE_CLIENT_ID,
          scope: SCOPE,
          callback: (r) => {
            const p = pend;
            pend = null;
            if (!p) return;
            if (r.error) p.rej(Object.assign(new Error(r.error), { reauth: true }));
            else {
              tokVal = r.access_token;
              tokExp = Date.now() + ((+r.expires_in || 3600) - 120) * 1000;
              p.res(tokVal);
            }
          },
          error_callback: (e) => {
            const p = pend;
            pend = null;
            const msg = (e && e.type) === 'popup_failed_to_open'
              ? 'Allow pop-ups for this site, then click Reconnect Drive.'
              : ((e && e.type) || 'Sign-in failed');
            if (p) p.rej(Object.assign(new Error(msg), { reauth: true }));
          },
        });
      pend = { res, rej };
      const o = { prompt };
      if (S().email) o.hint = S().email;
      tc.requestAccessToken(o);
    });
    tokP.then(
      () => (tokP = null),
      () => (tokP = null),
    );
    return tokP;
  }
  async function token() {
    if (tokVal && Date.now() < tokExp) return tokVal;
    throw Object.assign(new Error('Sign in to Google Drive'), { reauth: true }); // only connect() may open a popup
  }

  async function api(method, path, opt = {}) {
    const t = await token(),
      url = opt.upload ? path : API + path,
      headers = { Authorization: 'Bearer ' + t };
    if (opt.ct) headers['Content-Type'] = opt.ct;
    const r = await fetch(url, { method, headers, body: opt.body });
    if (r.status === 401) {
      tokVal = '';
      tokExp = 0;
      throw Object.assign(new Error('Google Drive session expired'), { reauth: true });
    }
    if (!r.ok) throw Object.assign(new Error('Google Drive returned ' + r.status), { status: r.status });
    return r.status === 204 ? null : r.json();
  }
  function multipart(meta, body) {
    const b = 'hs' + Math.random().toString(36).slice(2);
    return {
      ct: 'multipart/related; boundary=' + b,
      body:
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
    };
  }
  async function listRemote() {
    const out = new Map();
    let pt = '';
    do {
      const j = await api(
        'GET',
        'files?spaces=appDataFolder&pageSize=1000&q=' +
          encodeURIComponent('trashed=false') +
          '&fields=' +
          encodeURIComponent('nextPageToken,files(id,name,modifiedTime,appProperties)') +
          (pt ? '&pageToken=' + encodeURIComponent(pt) : ''),
      );
      (j.files || []).forEach((f) => {
        if (!f.name.endsWith('.json')) return;
        const id = f.name.slice(0, -5),
          u = +((f.appProperties || {}).u || 0) || Date.parse(f.modifiedTime) || 0,
          old = out.get(id);
        if (!old || u > old.u) out.set(id, { id, fileId: f.id, u });
      });
      pt = j.nextPageToken || '';
    } while (pt);
    return out;
  }

  const typing = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /text|number|search/.test(a.type)));
  };
  function norm(c) {
    const b = fresh(!!c.dm),
      n = { ...b, ...c, ab: { ...b.ab, ...c.ab }, picks: c.picks || {}, d: c.d || {} };
    ensureLv(n);
    return n;
  }
  function redraw() {
    if (typeof DB !== 'undefined' && DB.length) draw();
    else setTimeout(redraw, 500);
  }
  async function download(rm) {
    const j = await api('GET', `files/${rm.fileId}?alt=media`),
      raw = j && (j.character || j);
    if (!raw || typeof raw !== 'object') return null;
    const c = norm({ ...raw, id: rm.id });
    c.updated = rm.u;
    return c;
  }
  function apply(c, rm) {
    const s = S(),
      i = store.chars.findIndex((x) => x.id === c.id);
    i < 0 ? store.chars.push(c) : (store.chars[i] = c);
    if (ch.id === c.id) ch = c;
    const h = hashOf(c);
    s.known[c.id] = { fileId: rm.fileId, hash: h, u: rm.u };
    stamped[c.id] = h;
    uiDirty = true;
  }
  function removeLocal(id) {
    store.chars = store.chars.filter((c) => c.id !== id);
    delete S().known[id];
    if (ch.id === id) {
      ch = fresh(mode === 'dm');
      store.cur = null;
    }
    uiDirty = true;
  }

  async function push(c) {
    const s = S(),
      h = hashOf(c),
      k = s.known[c.id];
    if (!c.updated || (k && c.updated <= k.u)) c.updated = Date.now(); // safety net: force a fresh timestamp
    const u = c.updated;
    const body = JSON.stringify({ format: 'hearthscribe-character', version: 1, character: c });
    let fileId = '';
    if (k && k.fileId) {
      try {
        const m = multipart({ appProperties: { u: String(u) } }, body);
        await api('PATCH', `${UP}/${k.fileId}?uploadType=multipart&fields=id`, { upload: true, ...m });
        fileId = k.fileId;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
    if (!fileId) {
      const m = multipart({ name: c.id + '.json', parents: ['appDataFolder'], appProperties: { u: String(u) } }, body),
        r = await api('POST', `${UP}?uploadType=multipart&fields=id`, { upload: true, ...m });
      fileId = r.id;
    }
    if (!store.chars.some((x) => x.id === c.id)) {
      s.pendingDel.push(fileId);
      delete s.known[c.id];
      again = true;
      return;
    }
    s.known[c.id] = { fileId, hash: h, u };
    stamped[c.id] = h;
  }
  async function pull(rm) {
    if (ch.id === rm.id && typing()) {
      deferred = true;
      return;
    }
    const c = await download(rm);
    if (S().deleted[rm.id]) {
      again = true;
      return;
    }
    if (c) apply(c, rm);
  }
  async function conflict(local, rm) {
    const s = S(),
      rc = await download(rm);
    if (!rc) return push(local);
    if (hashOf(rc) === hashOf(local)) {
      s.known[local.id] = { fileId: rm.fileId, hash: hashOf(local), u: rm.u };
      return;
    }
    const remoteWins = rm.u > (local.updated || 0);
    if (remoteWins && ch.id === local.id && typing()) {
      deferred = true;
      return;
    }
    const loser = JSON.parse(JSON.stringify(remoteWins ? local : rc));
    loser.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    loser.name = (loser.name || 'Unnamed hero') + ' (conflict copy)';
    loser.updated = Date.now();
    delete s.known[loser.id];
    store.chars.push(loser);
    uiDirty = true;
    if (remoteWins) apply(rc, rm);
    else await push(local);
  }
  async function syncAll() {
    const s = S();
    for (const fid of [...s.pendingDel]) {
      try {
        await api('DELETE', 'files/' + fid);
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      s.pendingDel = s.pendingDel.filter((x) => x !== fid);
    }
    const remote = await listRemote(),
      suspicious = remote.size === 0 && Object.keys(s.known).length > 1;
    for (const [id, rm] of remote) {
      const local = store.chars.find((c) => c.id === id),
        k = s.known[id];
      if (!local) {
        if (s.deleted[id] || s.pendingDel.includes(rm.fileId)) {
          try {
            await api('DELETE', 'files/' + rm.fileId);
          } catch (e) {
            if (e.status !== 404) throw e;
          }
          s.pendingDel = s.pendingDel.filter((x) => x !== rm.fileId);
          continue;
        }
        await pull(rm);
        continue;
      }
      const dirty = !k || hashOf(local) !== k.hash,
        rch = !k || rm.u !== k.u || rm.fileId !== k.fileId;
      if (rch && dirty) await conflict(local, rm);
      else if (rch) await pull(rm);
      else if (dirty) await push(local);
    }
    for (const c of [...store.chars]) {
      if (remote.has(c.id)) continue;
      const k = s.known[c.id];
      if (k && !suspicious && hashOf(c) === k.hash) removeLocal(c.id);
      else {
        delete s.known[c.id];
        await push(c);
      }
    }
    for (const id of Object.keys(s.deleted))
      if (!remote.has(id) && Date.now() - s.deleted[id] > 120000) delete s.deleted[id];
  }
  async function runSync() {
    if (!linked() || !GDRIVE_CLIENT_ID) return;
    if (typeof DB === 'undefined' || !DB.length) {
      setTimeout(runSync, 500);
      return;
    }
    migrate();
    if (running) {
      again = true;
      return;
    }
    running = true;
    state = 'busy';
    paint();
    try {
      do {
        again = false;
        uiDirty = false;
        await syncAll();
        S().last = Date.now();
        saveStore();
        if (uiDirty) redraw();
      } while (again);
      state = 'ok';
      errMsg = '';
      if (deferred) {
        deferred = false;
        setTimeout(runSync, 4000);
      }
    } catch (e) {
      errMsg = (e && e.message) || String(e);
      state = e && e.reauth ? 'reauth' : !navigator.onLine || e instanceof TypeError ? 'offline' : 'error';
    } finally {
      running = false;
      saveStore();
      paint();
    }
  }
  function migrate() {
    const s = S();
    if (s.hv === 3) return;
    Object.entries(s.known).forEach(([id, k]) => {
      const c = store.chars.find((x) => x.id === id);
      if (c) k.hash = hashOf(c);
    });
    s.hv = 3;
    saveStore();
  }
  const schedule = () => {
    if (!linked() || state === 'reauth') return;
    clearTimeout(timer);
    timer = setTimeout(runSync, 2000);
  };

  async function connect() {
    try {
      state = 'busy';
      paint();
      await loadGis();
      await getToken('');
      const me = (await api('GET', 'about?fields=user(emailAddress,permissionId)')).user || {},
        s = S(),
        acct = me.permissionId || me.emailAddress || '';
      if (s.acct && s.acct !== acct) {
        s.known = {};
        s.pendingDel = [];
        s.deleted = {};
      }
      s.acct = acct;
      s.email = me.emailAddress || '';
      try {
        localStorage.setItem(FLAG, '1');
      } catch (e) {}
      await runSync();
    } catch (e) {
      errMsg = (e && e.message) || String(e);
      state = e && e.reauth ? 'reauth' : 'error';
      paint();
    }
  }
  function disconnect() {
    try {
      if (tokVal && window.google) google.accounts.oauth2.revoke(tokVal, () => {});
      localStorage.removeItem(FLAG);
    } catch (e) {}
    tokVal = '';
    tokExp = 0;
    pend = null;
    tokP = null;
    const s = S();
    s.known = {};
    s.pendingDel = [];
    s.deleted = {};
    s.acct = '';
    s.email = '';
    saveStore();
    state = 'off';
    paint();
  }

  const ICON =
    '<svg viewBox="0 0 87.3 78" width="17" height="15" style="vertical-align:-2px;margin-right:7px" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>';
  function html(cls) {
    cls = cls || 'lnk';
    const wrap = (inner) => `<span class="syncst" data-cls="${cls}" style="display:inline-flex;gap:6px;align-items:center">${inner}</span>`;
    if (!GDRIVE_CLIENT_ID) return wrap(`<span class="src">${ICON}Add your Client ID in sync.js</span>`);
    const t = (S().last && new Date(S().last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) || '';
    const label =
        {
          off: 'Connect Google Drive',
          busy: 'Syncing…',
          ok: 'Synced ' + t,
          offline: 'Offline · will retry',
          error: 'Sync problem · retry',
          reauth: 'Reconnect Drive',
        }[state] || 'Google Drive',
      dis = linked() && state !== 'reauth' ? `<button class="lnk" data-a="gout">Disconnect</button>` : '';
    return wrap(`<button class="${cls}" data-a="gsync" title="${esc(errMsg)}">${ICON}${label}</button>${dis}`);
  }
  function paint() {
    document.querySelectorAll('.syncst').forEach((el) => {
      el.outerHTML = html(el.dataset.cls);
    });
  }

  on('gsync', () => {
    if (!linked() || state === 'reauth' || state === 'off') connect();
    else if (tokVal && Date.now() < tokExp) runSync();
    else connect(); // token expired and no click to refresh silently → ask user to click again
    return false;
  });
  on('gout', () => {
    if (confirm('Disconnect Google Drive? Your characters stay in this browser and in Drive.')) disconnect();
    return false;
  });

  function init() {
    if (!GDRIVE_CLIENT_ID) return;
    state = linked() ? 'reauth' : 'off';
    paint();
    ['click', 'input', 'change', 'keydown'].forEach((t) =>
      document.addEventListener(
        t,
        () => {
          try {
            if (ch && ch.id && stamped[ch.id] === undefined) stamped[ch.id] = hashOf(ch);
          } catch (e) {}
        },
        true,
      ),
    );
    setInterval(() => {
      if (!linked() || document.hidden || !navigator.onLine) return;
      if (state === 'reauth' || state === 'off') return;
      if (!tokVal || Date.now() >= tokExp) return;
      runSync();
    }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && linked() && state !== 'reauth' && tokVal && Date.now() < tokExp) runSync();
    });
    window.addEventListener('online', () => {
      if (linked() && state !== 'reauth' && tokVal && Date.now() < tokExp) runSync();
    });
  }

  return {
    html,
    init,
    touch(c) {
      const h = hashOf(c),
        k = S().known[c.id],
        seen = stamped[c.id];
      if (k && k.hash === h) {
        stamped[c.id] = h;
        return;
      }
      if (seen === h) return;
      stamped[c.id] = h;
      c.updated = Date.now(); // always bump on a real content change
      if (S().deleted[c.id]) delete S().deleted[c.id];
      schedule();
    },
    onDelete(id) {
      const s = S(),
        k = s.known[id];
      s.deleted[id] = Date.now();
      if (k && k.fileId) s.pendingDel.push(k.fileId);
      delete s.known[id];
      delete stamped[id];
      saveStore();
      schedule();
    },
  };
})();
Sync.init();