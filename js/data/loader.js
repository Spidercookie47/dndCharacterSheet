/* Content loader. A "pack" is a JSON file (or an index listing several JSON files) in the same
   format as data/srd/. The SRD is just the first pack. Homebrew packs are added by link (any CORS
   enabled URL, e.g. raw.githubusercontent.com), by file or by pasting JSON, and are cached in the
   browser so they work offline afterwards. */
const Loader = {
  packs: [], // [{id,name,short,url,builtin,enabled,fetchedAt,count,json,error}]
  prefs: { enabled: {} },
  warnings: [],

  /* ---------- reading JSON ---------- */
  async getJson(url) {
    if (window.__HS_BUNDLE__ && window.__HS_BUNDLE__[url]) return window.__HS_BUNDLE__[url];
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' returned ' + r.status);
    return r.json();
  },
  resolve(base, rel) {
    try {
      return new URL(rel, new URL(base, location.href)).href;
    } catch (e) {
      return rel;
    }
  },
  // An index with "files" is one pack split over several files (the SRD does this).
  async readSource(url, rel) {
    const root = await this.getJson(url);
    if (Array.isArray(root.files)) {
      const out = { source: root.source || {}, elements: [], info: {}, tables: {} };
      for (const f of root.files) {
        const j = await this.getJson(
          window.__HS_BUNDLE__ && url.indexOf('data/') === 0
            ? url.replace(/[^/]*$/, f)
            : this.resolve(url, f),
        );
        out.elements.push(...(j.elements || []));
        Object.assign(out.info, j.info || {});
        Object.assign(out.tables, j.tables || {});
      }
      return out;
    }
    return root;
  },

  /* ---------- validation ---------- */
  validate(j) {
    const errors = [],
      warnings = [];
    if (!j || typeof j !== 'object') return { errors: ['Not a JSON object.'], warnings };
    if (!Array.isArray(j.elements)) errors.push('Missing "elements" list.');
    const seen = new Set();
    (j.elements || []).forEach((e, i) => {
      if (!e || !e.id || !e.type || !e.name) {
        errors.push('Element ' + i + ' needs id, type and name.');
        return;
      }
      if (e.id !== e.type + ':' + e.name)
        warnings.push(e.id + ' does not follow the "Type:Name" id convention.');
      if (seen.has(e.id)) warnings.push('Duplicate id ' + e.id + ' in this pack.');
      seen.add(e.id);
    });
    return { errors, warnings };
  },

  /* ---------- pack management ---------- */
  slug(s) {
    return (
      String(s || 'pack')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'pack'
    );
  },
  loadPrefs() {
    try {
      this.prefs = JSON.parse(localStorage.getItem('hs-sources')) || { enabled: {} };
    } catch (e) {
      this.prefs = { enabled: {} };
    }
  },
  savePrefs() {
    try {
      localStorage.setItem('hs-sources', JSON.stringify(this.prefs));
    } catch (e) {}
  },
  isOn(p) {
    return this.prefs.enabled[p.id] !== false;
  },

  initBuiltin(srd) {
    const s = srd.source || { id: 'srd', name: 'System Reference Document 5.1', short: 'SRD' };
    this.packs = [
      {
        id: s.id || 'srd',
        name: s.name,
        short: s.short || 'SRD',
        builtin: true,
        json: srd,
        credit: s.credit,
        count: srd.elements.length,
      },
    ];
  },
  // The standalone build ships the SRD inside the page, so it can load synchronously.
  readBundled() {
    const b = window.__HS_BUNDLE__,
      root = b['data/srd/index.json'],
      out = { source: root.source, elements: [], info: {}, tables: {} };
    for (const f of root.files) {
      const j = b['data/srd/' + f];
      out.elements.push(...(j.elements || []));
      Object.assign(out.info, j.info || {});
      Object.assign(out.tables, j.tables || {});
    }
    return out;
  },
  async loadCached() {
    for (const c of await Cache.all()) {
      this.packs = this.packs.filter((p) => p.id !== c.id);
      this.packs.push(Object.assign({}, c, { count: (c.json.elements || []).length }));
    }
    this.rebuild();
  },
  async boot() {
    // folder version: SRD comes from data/srd/*.json
    this.loadPrefs();
    this.initBuiltin(await this.readSource('data/srd/index.json'));
    this.rebuild();
    await this.loadCached();
  },

  rebuild() {
    this.packs.forEach((p) => {
      p.enabled = this.isOn(p);
    });
    setRegistry(
      this.packs
        .filter((p) => p.enabled)
        .map((p) => Object.assign({}, p.json, { source: { short: p.short, name: p.name } })),
    );
    // report references that point at content that is not loaded
    const ids = idx(),
      miss = new Set();
    DB.forEach((e) =>
      (e.rules || []).forEach((r) => {
        if (r.grant && !/^(skill|save):/.test(r.grant) && !ids[r.grant]) miss.add(r.grant);
      }),
    );
    this.warnings = miss.size
      ? [
          'Some content refers to ' +
            miss.size +
            ' element(s) that are not loaded, for example ' +
            [...miss].slice(0, 3).join(', ') +
            '.',
        ]
      : [];
  },

  async install(json, meta) {
    const v = this.validate(json);
    if (v.errors.length) throw new Error(v.errors.slice(0, 3).join(' '));
    const src = json.source || {};
    const id = meta.id || src.id || this.slug(src.name || meta.name);
    const pack = {
      id,
      name: src.name || meta.name || id,
      short: src.short || src.name || meta.name || id,
      url: meta.url || '',
      fetchedAt: Date.now(),
      json,
      builtin: false,
    };
    await Cache.put(pack);
    this.packs = this.packs.filter((p) => p.id !== id);
    this.packs.push(Object.assign({}, pack, { count: json.elements.length }));
    this.prefs.enabled[id] = true;
    this.savePrefs();
    this.rebuild();
    return { pack, warnings: v.warnings };
  },

  async addUrl(url) {
    url = url.trim();
    if (!url) throw new Error('Paste a link to a pack or index JSON file.');
    const root = await this.getJson(url);
    if (Array.isArray(root.packs)) {
      // a catalog: add everything it lists
      const out = [];
      for (const p of root.packs) out.push(await this.addUrl(this.resolve(url, p.url || p)));
      return out.flat();
    }
    const json = Array.isArray(root.files) ? await this.readSource(url) : root;
    return [await this.install(json, { url })];
  },
  async addText(text, name) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That is not valid JSON.');
    }
    if (Array.isArray(j)) j = { elements: j }; // a bare list of elements also works
    return [await this.install(j, { name: name || 'Imported pack' })];
  },
  async refresh(id) {
    const p = this.packs.find((x) => x.id === id);
    if (!p || !p.url) throw new Error('This pack has no link to refresh from.');
    return this.addUrl(p.url);
  },
  async remove(id) {
    await Cache.del(id);
    this.packs = this.packs.filter((p) => p.id !== id);
    delete this.prefs.enabled[id];
    this.savePrefs();
    this.rebuild();
  },
  toggle(id) {
    const p = this.packs.find((x) => x.id === id);
    this.prefs.enabled[id] = !this.isOn(p);
    this.savePrefs();
    this.rebuild();
  },

  /* The official fillable character sheet PDF (bytes). */
  async sheetPdf() {
    if (window.__HS_PDF_B64__) return Uint8Array.from(atob(window.__HS_PDF_B64__), (c) => c.charCodeAt(0));
    const r = await fetch('assets/5E_CharacterSheet_Fillable.pdf');
    if (!r.ok)
      throw new Error(
        'Put the fillable character sheet PDF at assets/5E_CharacterSheet_Fillable.pdf (see README).',
      );
    return new Uint8Array(await r.arrayBuffer());
  },
};
