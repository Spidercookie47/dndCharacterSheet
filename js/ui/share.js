/* Share a character as a read-only link (Hearthscribe 2.1.0).
   The link holds a compressed snapshot of the sheet, so it needs no account, server or Google sign-in.
   Whoever opens the link sees a read-only sheet; nothing they do can change the original, and nothing is uploaded anywhere.
   The snapshot is frozen when the link is made: to show later changes, make a new link.
   Spell and feature descriptions are not inside the link (that would make it far too long): the viewer's own rules data supplies them.
   Load AFTER sync.js and before main.js (it must be the last thing that wraps draw()).
   Opening: Share button (action row, or the link row on the phone Play tab) -> side panel. A link starting with #s= opens the viewer. */

/* ---------- link encoding (no page needed, so it can be tested alone) ---------- */
const b64u = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (t) => {
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const s = atob(t),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
};
async function shStream(u8, C) {
  const cs = new C('deflate-raw'),
    w = cs.writable.getWriter();
  w.write(u8);
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function shPack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  return typeof CompressionStream === 'function' ? 'z' + b64u(await shStream(raw, CompressionStream)) : 'j' + b64u(raw);
}
async function shUnpack(t) {
  const u = unb64u(t.slice(1)),
    raw = t[0] === 'z' ? await shStream(u, DecompressionStream) : u;
  if (raw.length > 400000) throw new Error('That link is too large.');
  return JSON.parse(new TextDecoder().decode(raw));
}

/* ---------- the read-only sheet (built only from the snapshot; every value is escaped) ---------- */
function shView(s) {
  const e = (x) => esc(String(x == null ? '' : x)),
    n = (x) => (Number.isFinite(+x) ? +x : 0),
    L = (x) => (Array.isArray(x) ? x.slice(0, 300) : []),
    fm = (x) => (n(x) >= 0 ? '+' : '−') + Math.abs(n(x)),
    ord = (k) => k + (['st', 'nd', 'rd'][k - 1] || 'th'),
    when = new Date(n(s.t)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    img = typeof s.img === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.img) ? s.img : '',
    name = String(s.n || 'Unnamed hero'),
    ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const safe = (f) => {
    try {
      return f();
    } catch (x) {
      return null;
    }
  };
  const I = safe(() => idx()) || {};
  const card = (h, body) => `<section class="sv-c">${h ? `<h3>${h}</h3>` : ''}${body}</section>`;
  let h = '';

  h += `<div class="sv-bar"><span><b>Read only.</b> Snapshot of ${e(name)} taken ${e(when)}. Changes made later do not show here.</span><span class="sv-bt"><button class="lnk" data-a="themeopen">Theme</button><a class="btn alt" href="${e(location.pathname)}">Open Hearthscribe</a></span></div>`;
  h += '<div class="sv-cols">';

  h += card('', `<div class="sv-who">${img ? `<img src="${img}" alt="">` : `<span class="sv-face">${e(ini)}</span>`}<span><b>${e(name)}</b><small>${e(s.sub)}</small></span>${s.insp ? '<span class="sv-chip">★ Inspiration</span>' : ''}</div>`);

  if (Array.isArray(s.hp)) {
    const now = n(s.hp[0]), max = Math.max(1, n(s.hp[1])), temp = n(s.hp[2]), pct = Math.max(0, Math.min(100, Math.round((now / max) * 100)));
    const chips = L(s.cond).map((c) => `<span class="sv-chip">${e(c)}</span>`).join('') + (n(s.exh) ? `<span class="sv-chip">Exhaustion ${n(s.exh)}</span>` : '') + (s.conc ? `<span class="sv-chip">Concentrating: ${e(s.conc)}</span>` : '');
    h += card('Hit points', `<div class="sv-hp"><b>${now}</b><span> / ${max}</span>${temp ? `<small>+${temp} temporary</small>` : now === 0 ? '<small>Down at 0 hit points</small>' : ''}</div><div class="sv-bar2"><i class="${pct <= 25 ? 'c' : pct <= 50 ? 'l' : ''}" style="width:${pct}%"></i></div>${chips ? `<div class="sv-chips">${chips}</div>` : ''}`);
  }

  const st = s.st || {};
  h += card('', `<div class="sv-tiles">${[['AC', n(st.ac)], ['Init', fm(st.init)], ['Speed', n(st.speed) + ' ft'], ['Prof', fm(st.pb)]].map(([k, v]) => `<div class="sv-t"><small>${k}</small><b>${v}</b></div>`).join('')}</div>` +
    `<div class="sv-tiles a">${L(s.ab).map((a) => `<div class="sv-t"><small>${e(String(a[0]).slice(0, 3).toUpperCase())}</small><b>${fm(a[2])}</b><em>${n(a[1])}</em></div>`).join('')}</div><p class="sv-h">Passive Perception ${n(st.pp)}</p>`);

  const sl = L(s.slots), rs = L(s.res);
  if (sl.length || rs.length)
    h += card('Resources', (sl.length ? `<div class="sv-sl">${sl.map((x) => `<div class="sv-t"><small>${e(x[0])}</small><b>${n(x[1])}/${n(x[2])}</b></div>`).join('')}</div>${s.dc ? `<p class="sv-h">Spell save DC ${n(s.dc)} · Spell attack ${fm(s.atk)}</p>` : ''}` : '') +
      rs.map((x) => {
        const left = n(x[1]), max = n(x[2]);
        return `<div class="sv-r"><span>${e(x[0])} <small>${x[3] === 'S' ? 'short rest' : 'long rest'}</small></span><span>${max < 0 ? '∞' : max <= 12 ? '●'.repeat(Math.max(0, left)) + '○'.repeat(Math.max(0, max - left)) : left + ' / ' + max}</span></div>`;
      }).join(''));

  const wp = L(s.wpn);
  if (wp.length) h += card('Attacks', wp.map((w) => `<div class="sv-r"><span>${e(w[0])}</span><span>${fm(w[1])}${w[2] ? ' · ' + e(w[2]) : ''}</span></div>`).join(''));

  const sp = L(s.spells);
  if (sp.length) {
    const by = {};
    sp.forEach((x) => (by[n(x[2])] = by[n(x[2])] || []).push(x));
    h += card('Spells', Object.keys(by).map(Number).sort((a, b) => a - b).map((lv) =>
      `<div class="sv-g">${lv ? ord(lv) + ' level' : 'Cantrips'}</div>` + by[lv].map((x) => {
        const loc = I[x[0]], body = loc && typeof spellCard === 'function' ? safe(() => spellCard(loc)) : null;
        return `<details class="sv-d"><summary><span>${e(x[1])}</span><small>${x[4] ? 'Conc. · ' : ''}${e(x[3])}</small></summary>${body || '<p class="sv-h">Description not available: this spell is not in your rules data.</p>'}</details>`;
      }).join('')).join(''));
  }

  const fe = L(s.feats);
  if (fe.length) {
    const by = {};
    fe.forEach((x) => (by[x[2] || 'Other'] = by[x[2] || 'Other'] || []).push(x));
    h += card('Features', Object.keys(by).map((g) => `<div class="sv-g">${e(g)}</div>` + by[g].map((x) => {
      const loc = I[x[0]], body = loc ? safe(() => (typeof INFO !== 'undefined' && INFO[loc.id] && INFO[loc.id][0] === '<' ? clean(INFO[loc.id]) : '<p>' + esc(loc.desc || '') + '</p>')) : null;
      return `<details class="sv-d"><summary><span>${e(x[1])}</span></summary>${body || '<p class="sv-h">Description not available here.</p>'}</details>`;
    }).join('')).join(''));
  }

  h += card('Saving throws', L(s.sv).map((x) => `<div class="sv-r${n(x[2]) ? ' p' : ''}"><span>${n(x[2]) ? '● ' : ''}${e(x[0])}</span><b>${fm(x[1])}</b></div>`).join('')) +
    card('Skills', L(s.sk).map((x) => `<div class="sv-r${n(x[2]) ? ' p' : ''}"><span>${n(x[2]) === 2 ? '◆ ' : n(x[2]) ? '● ' : ''}${e(x[0])}</span><b>${fm(x[1])}</b></div>`).join('') + '<p class="sv-h">● proficient · ◆ expertise</p>');

  const inv = L(s.inv), co = s.coins || {};
  if (inv.length || Object.keys(co).length)
    h += card('Gear', inv.map((x) => `<div class="sv-r"><span>${x[3] ? '◆ ' : ''}${e(x[0])}${n(x[1]) > 1 ? ' ×' + n(x[1]) : ''}</span><small>${x[2] ? 'equipped' : ''}${x[3] ? ' attuned' : ''}</small></div>`).join('') +
      (Object.keys(co).length ? `<p class="sv-h">${['pp', 'gp', 'ep', 'sp', 'cp'].filter((k) => n(co[k])).map((k) => n(co[k]) + ' ' + k).join(' · ')}</p>` : ''));

  const no = s.notes || {};
  const nt = [['traits', 'Personality'], ['ideal', 'Ideal'], ['bond', 'Bond'], ['flaw', 'Flaw'], ['story', 'Backstory'], ['n1', 'Notes'], ['n2', 'Notes']].filter(([k]) => no[k]);
  if (nt.length) h += card('Story and notes', nt.map(([k, t]) => `<div class="sv-g">${t}</div><p class="sv-p">${e(String(no[k]).slice(0, 4000))}</p>`).join(''));

  return h + '</div><p class="sv-h" style="text-align:center;margin:8px 0 0">Read-only snapshot made with Hearthscribe. Nothing you do here changes the original sheet.</p>';
}
window.HSShare = { pack: shPack, unpack: shUnpack, view: shView };
if (typeof document === 'undefined') {
  /* loaded outside a page (tests): stop here */
} else {
  (() => {
    /* ---------- what goes into the link ---------- */
    const KEY = 'hs-share';
    const DEF = { hp: true, sp: true, feat: true, gear: false, notes: false, img: false };
    const opts = () => {
      try {
        return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
      } catch (x) {
        return { ...DEF };
      }
    };
    const setOpt = (k, v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...opts(), [k]: v }));
      } catch (x) {}
    };

    function snapshot(o) {
      const r = resolve(ch), c = calc(ch, r), I = idx(), h = hpInfo(c), R = resources(r, c), ci = casterInfo(r, c),
        lc = classLevels(ch),
        cn = Object.entries(lc).map(([k, v]) => ((I[k] || {}).name || '') + (Object.keys(lc).length > 1 ? ' ' + v : '')).join(' / '),
        rc = r.els.find((x) => x.type === 'Race'), sr = r.els.find((x) => x.type === 'Sub Race');
      const s = {
        v: 1, t: Date.now(), n: ch.name || 'Unnamed hero',
        sub: 'Level ' + ch.level + ' · ' + ((sr || rc || {}).name || '') + ' ' + cn,
        st: { ac: c.ac, init: c.init, speed: exhSpeed(c.speed), pb: c.pb, pp: c.pp },
        ab: AB.map((a) => [AN[a], c.sc[a], mod(c.sc[a])]),
        sv: AB.map((a) => [AN[a], c.sv[a].v, c.sv[a].p ? 1 : 0]),
        sk: Object.entries(c.sk).map(([nm, x]) => [nm, x.v, x.x ? 2 : x.p ? 1 : 0]),
      };
      if (ch.insp) s.insp = 1;
      if (o.hp) {
        s.hp = [h.now, h.max, h.temp];
        s.cond = (ch.cond || []).filter((k) => k !== 'concentrating').map((k) => (CONDS.find((x) => x[0] === k) || [k, k])[1]);
        if (ch.exh) s.exh = ch.exh;
        const cc = concNow();
        if (cc) s.conc = cc.name;
      }
      if (o.sp) {
        s.slots = R.filter((x) => isSlotKey(x.k)).map((x) => [x.k === 'pact' ? 'Pact' : 'L' + x.k.slice(4), slotLeft(R, x.k), x.max]);
        if (ci) {
          s.dc = ci.dc;
          s.atk = ci.atk;
        }
        s.spells = playSpells(r).map(({ s: p }) => [p.id, p.name, p.lvl, p.school || '', isConc(p) ? 1 : 0]);
      }
      s.res = R.filter((x) => !isSlotKey(x.k)).map((x) => {
        const inf = x.max === Infinity;
        return [x.n, inf ? -1 : x.max - Math.min((ch.used || {})[x.k] || 0, x.max), inf ? -1 : x.max, x.rest];
      });
      if (o.feat) {
        s.feats = r.els.filter((x) => /Trait|Feature|Style|^Feat$/.test(x.type)).map((f) => [f.id, f.name, /Racial|Race/.test(f.type) ? 'Race' : /Background/.test(f.type) ? 'Background' : /^Class Feature$/.test(f.type) ? 'Class' : f.type]);
      }
      if (o.gear) {
        s.wpn = [];
        s.inv = [];
        (ch.inv || []).forEach((i) => {
          const e = ent(i);
          if (!e) return;
          s.inv.push([e.name, i.q || 1, i.eq ? 1 : 0, i.att ? 1 : 0]);
          if (i.eq && (e.type === 'Weapon' || i.tp === 'Weapon')) {
            const cu = !I[i.id], d = e.desc || '',
              rng = cu ? i.wk === 'ranged' : /Ammunition/.test(d),
              fin = cu ? i.wk === 'finesse' : /Finesse/.test(d),
              m = mod(c.sc[rng ? 'dex' : fin && c.sc.dex > c.sc.str ? 'dex' : 'str']),
              mw = magicB(ch).wpn,
              dm = cu ? [0, i.dice || '', i.dt || ''] : d.match(/Damage (\d+d\d+) (\w+)/) || [];
            s.wpn.push([e.name, m + (cu || profW(r, e) ? c.pb : 0) + mw, dm[1] ? dm[1] + (m + mw ? (m + mw > 0 ? '+' : '') + (m + mw) : '') + (dm[2] ? ' ' + dm[2] : '') : '']);
          }
        });
        const co = {};
        ['cp', 'sp', 'ep', 'gp', 'pp'].forEach((k) => ch.coins && ch.coins[k] && (co[k] = ch.coins[k]));
        s.coins = co;
      }
      if (o.notes) {
        const d = ch.d || {}, no = {};
        ['traits', 'ideal', 'bond', 'flaw', 'story', 'n1', 'n2'].forEach((k) => d[k] && (no[k] = d[k]));
        s.notes = no;
      }
      if (o.img && imgSrc(ch.img)) s.img = imgSrc(ch.img);
      return s;
    }
    let lastLink = '';
    const makeLink = async () => (lastLink = location.origin + location.pathname + '#s=' + (await shPack(snapshot(opts()))));

    /* ---------- the Share panel (drawer) ---------- */
    window.shareHtml = () => {
      const o = opts(),
        cb = (k, t, sm) => `<label class="opt"><input type="checkbox" data-shopt="${k}"${o[k] ? ' checked' : ''}><span>${t}<small>${sm}</small></span></label>`;
      return (
        '<p class="hint">Make a link that shows a read-only copy of this character. Send it to your DM or party. Nothing is uploaded: the sheet is inside the link, so anyone you give it to can open it.</p>' +
        '<div class="ph"><span>What to include</span></div>' +
        cb('hp', 'Hit points and conditions', 'Current and temporary hit points, status effects, exhaustion.') +
        cb('sp', 'Spells and slots', 'Spells you can cast, slots, save DC and attack bonus.') +
        cb('feat', 'Features', 'Race, class, background and feat names.') +
        cb('gear', 'Weapons, items and coins', 'Equipped weapons with attack and damage, your inventory and coins.') +
        cb('notes', 'Backstory and notes', 'Personality, backstory and your note boxes.') +
        cb('img', 'Portrait', 'Makes the link much longer.') +
        '<label>Link<textarea id="shlink" rows="4" readonly>Making the link…</textarea></label><p class="hint" id="shinfo"></p>' +
        `<div class="bar"><button data-a="shcopy">Copy link</button>${navigator.share ? '<button class="alt" data-a="shsend">Share…</button>' : ''}<button class="alt" data-a="shview">Preview</button></div>` +
        '<p class="hint">This is a snapshot. It shows the character as it is now; to show later changes, make a new link. Spell and feature descriptions come from the viewer’s own rules data.</p>'
      );
    };
    let tok = 0;
    async function fillShare() {
      const t = ++tok, ta = document.getElementById('shlink'), inf = document.getElementById('shinfo');
      if (!ta) return;
      try {
        const link = await makeLink();
        if (t !== tok) return;
        ta.value = link;
        if (inf) inf.textContent = link.length + ' characters.' + (link.length > 1900 ? ' This is long: some chat apps cut links over about 2,000 characters. Turn off a few options to shorten it.' : '');
      } catch (x) {
        if (ta) ta.value = '';
        if (inf) inf.textContent = 'Could not make the link: ' + ((x && x.message) || x);
      }
    }
    const baseDrawer = drawer;
    drawer = function () {
      baseDrawer();
      if (panel === 'share') fillShare();
    };
    on('share', () => openPanel('share'));
    on('shcopy', () => {
      const ta = document.getElementById('shlink');
      if (!lastLink) return false;
      (navigator.clipboard ? navigator.clipboard.writeText(lastLink) : Promise.reject()).then(
        () => note('Link copied.'),
        () => {
          if (ta) {
            ta.select();
            document.execCommand('copy');
            note('Link copied.');
          }
        },
      );
      return false;
    });
    on('shsend', () => {
      if (lastLink && navigator.share) navigator.share({ title: (ch.name || 'Character') + ' · Hearthscribe', url: lastLink }).catch(() => {});
      return false;
    });
    on('shview', () => {
      if (lastLink) window.open(lastLink, '_blank');
      return false;
    });
    document.addEventListener('change', (e) => {
      const k = e.target.dataset && e.target.dataset.shopt;
      if (!k) return;
      setOpt(k, e.target.checked);
      fillShare();
    });

    /* ---------- the viewer: a link starting with #s= opens the read-only sheet instead of the app ---------- */
    const hit = location.hash.match(/^#s=([zj][A-Za-z0-9_-]+)$/);
    const css = document.createElement('style');
    css.textContent =
      'body.sv-on #top,body.sv-on #nav,body.sv-on #sub,body.sv-on #status,body.sv-on #bb{display:none!important}' +
      '.sv{max-width:1240px;margin:0 auto;padding:4px 4px 24px}.sv-cols{column-width:290px;column-gap:12px}' +
      '.sv-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;margin:0 0 12px;padding:10px 14px;border:1px solid var(--acc);border-radius:16px;background:var(--sel)}' +
      '.sv-bt{display:flex;gap:8px;align-items:center}.sv-bt a{text-decoration:none;color:var(--ink)}' +
      '.sv-c{break-inside:avoid;margin:0 0 12px;padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}' +
      '.sv-c h3{margin:0 0 8px;font:700 1.05rem Fraunces,Georgia,serif;text-transform:none;border-bottom:1px solid var(--line);padding-bottom:5px}' +
      '.sv-who{display:flex;align-items:center;gap:12px}.sv-who b{display:block;font:700 1.3rem Fraunces,Georgia,serif;line-height:1.15}.sv-who small{color:var(--mut)}.sv-who img,.sv-face{width:56px;height:56px;border-radius:14px;border:2px solid var(--acc);object-fit:cover;flex:0 0 auto}' +
      '.sv-face{display:flex;align-items:center;justify-content:center;background:var(--sel);font:700 1.2rem Fraunces,Georgia,serif}' +
      '.sv-chip{display:inline-block;margin:3px 4px 0 0;padding:2px 11px;border-radius:999px;background:var(--sel);box-shadow:inset 0 0 0 1px var(--acc);font-size:.85rem}.sv-who .sv-chip{margin-left:auto}' +
      '.sv-hp{text-align:center;font:700 3rem/1.1 Fraunces,Georgia,serif}.sv-hp span{font-size:1.2rem;font-weight:500;color:var(--mut)}.sv-hp small{display:block;font:500 .85rem Figtree,system-ui,sans-serif;color:var(--ok)}' +
      '.sv-bar2{height:10px;border-radius:5px;background:var(--line);overflow:hidden;margin-top:8px}.sv-bar2 i{display:block;height:100%;background:var(--ok)}.sv-bar2 i.l{background:var(--acc)}.sv-bar2 i.c{background:var(--btn)}.sv-chips{margin-top:8px}' +
      '.sv-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}.sv-tiles.a{grid-template-columns:repeat(3,1fr)}.sv-sl{display:flex;gap:6px;flex-wrap:wrap}.sv-sl .sv-t{min-width:52px;flex:1}' +
      '.sv-t{border:1px solid var(--line);border-radius:12px;padding:6px 2px;text-align:center;background:var(--panel)}.sv-t small{display:block;color:var(--mut);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}.sv-t b{display:block;font:600 1.4rem Fraunces,Georgia,serif}.sv-t em{display:block;font-style:normal;color:var(--mut);font-size:.8rem}' +
      '.sv-r{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dotted var(--line)}.sv-r small{color:var(--mut)}.sv-r.p{color:var(--acc)}' +
      '.sv-g{margin:10px 0 4px;color:var(--mut);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase}' +
      '.sv-d{border:1px solid var(--line);border-radius:12px;margin:5px 0;background:var(--panel)}.sv-d summary{display:flex;justify-content:space-between;gap:10px;padding:7px 12px;font-weight:600}.sv-d summary small{color:var(--mut);font-weight:400}.sv-d>:not(summary){margin-left:12px;margin-right:12px}.sv-d>:last-child{margin-bottom:10px}' +
      '.sv-h{color:var(--mut);font-size:.85rem;margin:8px 0 0}.sv-p{margin:0 0 6px;white-space:pre-wrap}';
    document.head.appendChild(css);

    if (hit) {
      let view = null,
        fail = '';
      window.hsViewing = true;
      const paint = () => {
        const b = document.body;
        b.classList.remove('hm-on', 'bb-on', 'pl-on', 'sp-on', 'ge-on');
        b.classList.add('sv-on');
        document.title = (view && view.n ? view.n + ' · ' : '') + 'Hearthscribe (read only)';
        const m = document.getElementById('main');
        if (!m) return;
        m.className = 'main one';
        m.innerHTML = '<div class="left sv">' + (view ? shView(view) : `<p class="hint" style="padding:20px">${fail ? esc(fail) : 'Opening the shared sheet…'}</p>`) + '</div>';
        if (typeof themeApply === 'function') themeApply();
      };
      draw = function () {
        paint();
      };
      document.body.classList.add('sv-on');
      shUnpack(hit[1]).then(
        (s) => {
          if (!s || s.v !== 1) fail = 'That link is not a Hearthscribe sheet.';
          else view = s;
          paint();
        },
        () => {
          fail = 'This link could not be opened. It may have been cut off when it was sent: ask for a new one.';
          paint();
        },
      );
      addEventListener('hashchange', () => location.reload());
    }
  })();
}
