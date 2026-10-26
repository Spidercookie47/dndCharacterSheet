/* Building the character data for the PDF, downloading it and previewing it. */
function model() {
  const r = resolve(ch),
    c = calc(ch, r),
    cl = r.cls,
    rc = r.els.find((e) => e.type === 'Race'),
    sr = r.els.find((e) => e.type === 'Sub Race'),
    bg = r.els.find((e) => e.type === 'Background'),
    d = ch.d,
    L = r.els.filter((e) => e.type === 'Language').map((e) => e.name);
  const SX = spellFill(r, c);

  /* ----- class line with subclass ----- */
  const I = idx(),
    lc = classLevels(ch),
    entries = Object.entries(lc);

  // collect every subclass ID from three sources
  const subIds = new Set();
  r.sels.forEach((s) => {
    if (s.kind === 'Subclass' || s.kind === 'Divine Domain') s.chosen.forEach((id) => subIds.add(id));
  });
  r.els.forEach((e) => {
    if (e.type === 'Subclass' || e.type === 'Divine Domain') subIds.add(e.id);
  });
  Object.values(ch.picks || {}).forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach((id) => subIds.add(id));
  });
  const subs = [...subIds].map((id) => I[id]).filter(Boolean);

  // match subclass → class by any of the linkage fields used across data packs
  const matchSub = (e, clsId, clsName) => {
    if (e.type !== 'Subclass' && e.type !== 'Divine Domain') return false;
    if (e.supports) {
      return (
        e.supports === clsId ||
        e.supports === clsName ||
        String(e.supports).endsWith(':' + clsName)
      );
    }
    const link = e.cls || e.class || e.parent || e.parentClass;
    return link ? String(link).toLowerCase().includes(clsName.toLowerCase()) : false;
  };

  const classLevel = entries
    .map(([k, n]) => {
      const clsName = (I[k] || {}).name || '';
      let sub = subs.find((e) => matchSub(e, k, clsName));
      // last resort: single class + single subclass → use it
      if (!sub && entries.length === 1 && subs.length === 1) sub = subs[0];
      return clsName + (sub ? ' (' + sub.name + ')' : '') + ' ' + n;
    })
    .join(' / ');

  return {
    xchecks: SX.ck,
    name: ch.name,
    classLevel,
    bg: bg ? bg.name : '',
    race: (sr || rc || {}).name || '',
    scores: c.sc,
    mods: Object.fromEntries(AB.map((a) => [a, mod(c.sc[a])])),
    pb: c.pb,
    ac: c.ac,
    init: c.init,
    speed: c.speed,
    hp: c.hp,
    hd: cl ? cl.hd : 0,
    hdt: cl
      ? Object.entries(classLevels(ch))
          .map(([k, n]) => n + 'd' + ((idx()[k] || {}).hd || 8))
          .join(' + ')
      : '',
    level: ch.level,
    pp: c.pp,
    saves: c.sv,
    skills: c.sk,
    features: r.els
      .filter((e) => /Trait|Feature|Style/.test(e.type))
      .map((f) => f.name + ': ' + f.desc)
      .join('\n'),
    equipment:
      (ch.inv || [])
        .map(
          (i) =>
            (i.name || (idx()[i.id] || {}).name || '') +
            (i.q > 1 ? ' ×' + i.q : '') +
            (i.eq ? ' (equipped)' : '') +
            (i.att ? ' (attuned)' : ''),
        )
        .join('\n') + (ch.d.trinket ? '\nTrinket: ' + ch.d.trinket : ''),
    prof: profText(r, L),
    images: { portrait: ch.img || '', symbol: ch.sym || '' },
    extra: {
      ...SX.tx,
      PlayerName: d.player,
      Alignment: d.align,
      XP: d.exp,
      Age: d.age,
      Height: d.height,
      Weight: d.weight,
      Eyes: d.eyes,
      Skin: d.skin,
      Hair: d.hair,
      'PersonalityTraits ': d.traits,
      Ideals: d.ideal,
      Bonds: d.bond,
      Flaws: d.flaw,
      Backstory: d.story,
      Allies: d.allies,
      FactionName: d.org,
      'Feat+Traits': d.addf,
      Treasure: d.treasure,
      AttacksSpellcasting: d.combat,
      'Wpn Name': d.a1n,
      'Wpn1 AtkBonus': d.a1b,
      'Wpn1 Damage': d.a1d,
      'Wpn Name 2': d.a2n,
      'Wpn2 AtkBonus ': d.a2b,
      'Wpn2 Damage ': d.a2d,
      'Wpn Name 3': d.a3n,
      'Wpn3 AtkBonus  ': d.a3b,
      'Wpn3 Damage ': d.a3d,
      CP: (ch.coins || {}).cp || '',
      SP: (ch.coins || {}).sp || '',
      EP: (ch.coins || {}).ep || '',
      GP: (ch.coins || {}).gp || '',
      PP: (ch.coins || {}).pp || '',
    },
    caster: casterInfo(r, c),
  };
}
const mk = async () => fillSheet(PDFLib, await Loader.sheetPdf(), buildFields(model()));
async function pdf() {
  try {
    const bytes = await mk();
    await dl(fname() + ' - D&D sheet.pdf', bytes, 'application/pdf');
  } catch (e) {
    note('Could not create the sheet: ' + ((e && e.message) || e));
  }
}
async function preview() {
  const ov = $('#ov');
  ov.hidden = false;
  ov.innerHTML =
    '<div class="ovb"><div class="bar"><button class="alt" data-a="pvx">Close</button><button data-a="pdf">Download PDF</button></div><p class="hint" id="pm">Preparing preview…</p><div id="pg"></div></div>';
  try {
    const bytes = await mk();
    if (!window.pdfjsLib) throw new Error('The PDF viewer could not load.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = window.HS_PDFJS_WORKER || 'vendor/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise,
      box = $('#pg');
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i),
        vp = p.getViewport({ scale: 1.5 }),
        cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      cv.style.cssText = 'width:100%;height:auto;background:#fff;margin:8px 0;display:block';
      box.appendChild(cv);
      await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
    $('#pm').remove();
  } catch (e) {
    $('#pm').textContent = 'Preview failed: ' + ((e && e.message) || e) + ' You can still download the PDF.';
  }
}