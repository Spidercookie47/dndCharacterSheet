/* Sanitize: makes sure fields that the app prints as numbers really are numbers.
   Load this BEFORE loader.js in index.html:  <script src="js/core/sanitize.js"></script>

   Why: esc() protects text fields, but numbers are inserted into HTML as-is
   (for example `${c.speed} ft`, `${e.hd}`, `${s.level}`). A pack that puts a string where a number
   belongs could therefore inject markup. This file removes such values from third-party (non built-in) packs.

   ---------------------------------------------------------------------------------------
   OTHER SMALL EDITS THAT GO WITH THIS FILE (do all of them)

   1) loader.js, Loader.rebuild(): replace the setRegistry(...) call with

        setRegistry(
          this.packs
            .filter((p) => p.enabled)
            .map((p) => {
              const j = Object.assign({}, p.json, { source: { short: p.short, name: p.name } });
              if (!p.builtin) {
                j.elements = (j.elements || []).map(Sanitize.el);
                j.tables = Sanitize.tables(j.tables);
              }
              return j;
            }),
        );

   2) loader.js, Loader.validate(): inside the elements loop, after the id/type/name check, add

        if (Sanitize.changed(e))
          warnings.push(e.id + ' has values that are not numbers where numbers are required. They will be ignored.');

   3) util.js: make esc() escape single quotes too

        esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

   4) util.js: make fmtP() refuse non-numbers

        const fmtP = (cp) =>
          (cp = Number.isFinite(cp) ? cp : 0)
            ? cp % 100 === 0 ? cp / 100 + ' gp' : cp % 10 === 0 ? cp / 10 + ' sp' : cp + ' cp'
            : '—';

   5) sheet.js, resHtml(): both data-k="${x.k}" become data-k="${esc(x.k)}"

   6) (round 2) Sanitize.char() cleans character files and Drive downloads, Sanitize.mon() cleans monster stat blocks.
      See events.js, sync.js, monster.js and start.js in the updated2 folder for where they are called.
   --------------------------------------------------------------------------------------- */
const Sanitize = (() => {
  const AB_ = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const dropBad = (o, keys) => {
    if (!isObj(o)) return;
    keys.forEach((k) => {
      if (k in o && !isNum(o[k])) delete o[k];
    });
  };
  const numMap = (o, allowed) => {
    // {key: number}: keep only numeric values (and, if given, only allowed keys)
    if (!isObj(o)) return;
    Object.keys(o).forEach((k) => {
      if (!isNum(o[k]) || (allowed && !allowed.includes(k))) delete o[k];
    });
  };
  const numArr = (a) => (Array.isArray(a) ? a.map((x) => (isNum(x) ? x : 0)) : a);

  function rule(r) {
    dropBad(r, ['level', 'expertise']);
    numMap(r.stat);
    if (isObj(r.select)) dropBad(r.select, ['n', 'lvl']);
    if (isObj(r.resource)) {
      dropBad(r.resource, ['min']);
      if (r.resource.id != null) r.resource.id = String(r.resource.id).replace(/[^\w:. \-]/g, '');
    }
    return r;
  }
  function effect(d) {
    if (!isObj(d)) return undefined;
    dropBad(d, ['ac', 'saves', 'wpn', 'spA', 'brac']);
    numMap(d.sa, AB_);
    numMap(d.set, AB_);
    if ('att' in d) d.att = !!d.att;
    return d;
  }
  function casting(c) {
    if (!isObj(c)) return;
    if (Array.isArray(c.rows)) c.rows = c.rows.map((r) => (Array.isArray(r) ? numArr(r) : []));
    ['known', 'prep'].forEach((k) => {
      if (k in c) c[k] = numArr(c[k]);
    });
    if (!AB_.includes(c.ability)) c.ability = 'int';
  }
  function start(s) {
    if (!isObj(s)) return;
    s.f = (Array.isArray(s.f) ? s.f : []).map((x) => [Array.isArray(x) ? x[0] : '', Array.isArray(x) && isNum(x[1]) ? x[1] : 1]);
    s.g = (Array.isArray(s.g) ? s.g : []).map((g) => {
      if (!isObj(g)) return { d: '', o: [] };
      g.o = (Array.isArray(g.o) ? g.o : []).map((opt) =>
        (Array.isArray(opt) ? opt : []).filter(isObj).map((p) => {
          dropBad(p, ['q', 'gp']);
          return p;
        }),
      );
      return g;
    });
  }

  /* Returns a cleaned COPY of one element. */
  function el(e) {
    const o = JSON.parse(JSON.stringify(e));
    dropBad(o, ['hd', 'cp', 'wt', 'ac', 'smin', 'lvl', 'bn']);
    if (Array.isArray(o.abilities)) o.abilities = o.abilities.filter((a) => AB_.includes(a));
    if ('rules' in o) o.rules = (Array.isArray(o.rules) ? o.rules : []).filter(isObj).map(rule);
    if ('effect' in o) {
      o.effect = effect(o.effect);
      if (o.effect === undefined) delete o.effect;
    }
    casting(o.casting);
    start(o.start);
    if (isObj(o.stat)) o.stat = mon(o.stat);
    return o;
  }

  /* Cleaned copy of a pack's tables. */
  function tables(t) {
    if (!isObj(t)) return {};
    const o = {};
    Object.keys(t).forEach((k) => {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      o[k] = JSON.parse(JSON.stringify(t[k]));
    });
    if (o.xp) o.xp = numArr(o.xp);
    return o;
  }


  /* ---------- round 2: monsters and characters ---------- */
  const safeKey = (k) => typeof k === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && k.length < 120;
  const Str = (v, max) => (typeof v === 'string' ? v : isNum(v) || typeof v === 'boolean' ? String(v) : '').slice(0, max || 2000);
  const strArr = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, n || 500).map((x) => x.slice(0, 200)) : []);
  const int = (v, lo, hi, d) => {
    v = Math.trunc(+v);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  const numObj = (o, keys, lo, hi, d) => {
    const r = {};
    if (!isObj(o)) return r;
    (keys || Object.keys(o)).forEach((k) => {
      if (safeKey(k) && k in o) r[k] = int(o[k], lo, hi, d);
    });
    return r;
  };
  const entries = (a) =>
    (Array.isArray(a) ? a : []).filter(isObj).slice(0, 100).map((e) => ({ n: Str(e.n, 200), d: Str(e.d, 8000) }));

  /* A monster stat block (pack "stat" or a .monster.json file): numbers become numbers, text stays text. */
  function mon(m) {
    if (!isObj(m)) return {};
    const o = {};
    ['name', 'size', 'type', 'tags', 'align', 'acNote', 'vuln', 'res', 'imm', 'cimm', 'langs', 'base'].forEach((k) => {
      if (k in m) o[k] = Str(m[k], 500);
    });
    if ('cr' in m) {
      const cr = String(m.cr);
      o.cr = /^(\d{1,2}|1\/[248])$/.test(cr) ? cr : '1';
    }
    ['hpAuto', 'hover'].forEach((k) => {
      if (k in m) o[k] = !!m[k];
    });
    if ('ac' in m) o.ac = int(m.ac, 0, 99, 10);
    if ('hp' in m) o.hp = int(m.hp, 1, 99999, 10);
    if ('hdn' in m) o.hdn = int(m.hdn, 1, 99, 2);
    if ('legN' in m) o.legN = int(m.legN, 1, 5, 3);
    if (isObj(m.ab)) o.ab = numObj(m.ab, AB_, 1, 30, 10);
    if (isObj(m.spd)) o.spd = numObj(m.spd, ['walk', 'burrow', 'climb', 'fly', 'swim'], 0, 9999, 0);
    if (isObj(m.sen)) o.sen = numObj(m.sen, ['darkvision', 'blindsight', 'tremorsense', 'truesight'], 0, 9999, 0);
    if (isObj(m.saves)) {
      o.saves = {};
      AB_.forEach((a) => {
        if (a in m.saves) o.saves[a] = !!m.saves[a];
      });
    }
    if (isObj(m.skills)) {
      o.skills = {};
      Object.keys(m.skills).forEach((k) => {
        if (safeKey(k) && k in SK_) o.skills[k] = int(m.skills[k], 0, 2, 0);
      });
    }
    ['traits', 'actions', 'bonus', 'reactions', 'leg'].forEach((k) => {
      if (k in m) o[k] = entries(m[k]);
    });
    return o;
  }
  const SK_ = {};
  ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'].forEach((n) => (SK_[n] = 1));

  /* A character coming from a file or from Drive. Returns a cleaned copy with only known fields.
     The caller still merges it over fresh() defaults. */
  function char(c) {
    if (!isObj(c)) return {};
    const o = {},
      id = Str(c.id, 64).replace(/[^\w\-]/g, '');
    if (id) o.id = id;
    ['name', 'race', 'cls', 'bg', 'method', 'boost', 'bgt', 'bga', 'bgb', 'armor'].forEach((k) => {
      if (k in c) o[k] = Str(c[k], 200);
    });
    ['dm', 'shield'].forEach((k) => {
      if (k in c) o[k] = !!c[k];
    });
    if ('level' in c) o.level = int(c.level, 1, 20, 1);
    if ('updated' in c) o.updated = int(c.updated, 0, 8.64e15, 0);
    if (isObj(c.ab)) o.ab = numObj(c.ab, AB_, 1, 30, 10);
    if (Array.isArray(c.lv))
      o.lv = c.lv.filter(isObj).slice(0, 20).map((e) => ({ c: Str(e.c, 200), v: int(e.v, 1, 20, 1) }));
    if (isObj(c.coins)) o.coins = numObj(c.coins, ['cp', 'sp', 'ep', 'gp', 'pp'], 0, 1e9, 0);
    if (isObj(c.used)) {
      o.used = {};
      Object.keys(c.used).forEach((k) => {
        if (safeKey(k)) o.used[k] = int(c.used[k], 0, 9999, 0);
      });
    }
    if (Array.isArray(c.inv))
      o.inv = c.inv
        .filter(isObj)
        .slice(0, 500)
        .map((i) => {
          const r = { id: Str(i.id, 200), q: int(i.q, 1, 99999, 1), eq: !!i.eq };
          ['att', 'ra', 'mg'].forEach((k) => {
            if (i[k]) r[k] = true;
          });
          ['name', 'tp', 'desc', 'res', 'dice', 'dt', 'wk'].forEach((k) => {
            if (k in i) r[k] = Str(i[k], k === 'desc' ? 4000 : 200);
          });
          if ('wt' in i) r.wt = isNum(+i.wt) && +i.wt >= 0 ? +i.wt : 0;
          if (isObj(i.fx)) {
            const f = effect(JSON.parse(JSON.stringify(i.fx)));
            if (f) r.fx = f;
          }
          return r;
        })
        .filter((r) => r.id);
    if (isObj(c.exp)) {
      o.exp = {};
      Object.keys(c.exp).forEach((k) => {
        if (safeKey(k)) o.exp[k] = strArr(c.exp[k]);
      });
    }
    if (isObj(c.asi)) {
      o.asi = {};
      Object.keys(c.asi).forEach((k) => {
        const v = c.asi[k];
        if (safeKey(k) && isObj(v)) {
          o.asi[k] = {};
          ['t', 'a', 'b', 'f'].forEach((f) => {
            if (f in v) o.asi[k][f] = Str(v[f], 200);
          });
        }
      });
    }
    if (isObj(c.sp)) {
      o.sp = {};
      Object.keys(c.sp).forEach((k) => {
        const v = c.sp[k];
        if (!safeKey(k)) return;
        if (Array.isArray(v)) o.sp[k] = strArr(v);
        else if (isObj(v)) o.sp[k] = { c: strArr(v.c), k: strArr(v.k), p: strArr(v.p) };
      });
    }
    if (isObj(c.picks)) {
      o.picks = {};
      Object.keys(c.picks).forEach((k) => {
        if (safeKey(k)) o.picks[k] = strArr(c.picks[k]);
      });
    }
    if (isObj(c.se)) {
      o.se = {};
      Object.keys(c.se).forEach((k) => {
        if (safeKey(k)) o.se[k] = isNum(c.se[k]) ? int(c.se[k], 0, 99, 0) : Str(c.se[k], 200);
      });
    }
    if (isObj(c.extra)) o.extra = { feats: strArr(c.extra.feats), langs: strArr(c.extra.langs), spells: strArr(c.extra.spells) };
    if (isObj(c.opt)) {
      o.opt = {};
      ['avg', 'feats', 'multi'].forEach((k) => {
        if (k in c.opt) o.opt[k] = !!c.opt[k];
      });
    }
    if (isObj(c.d)) {
      o.d = {};
      Object.keys(c.d).forEach((k) => {
        if (safeKey(k)) o.d[k] = Str(c.d[k], 20000);
      });
    }
    ['img', 'sym'].forEach((k) => {
      if (k in c) o[k] = typeof imgSrc === 'function' ? imgSrc(c[k]) : '';
    });
    return o;
  }

  const changed = (e) => JSON.stringify(el(e)) !== JSON.stringify(e);
  return { el, tables, changed, mon, char };
})();
