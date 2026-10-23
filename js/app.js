(function () {
  const VIOLET = '#8b5cf6';
  const enc = (s) => encodeURIComponent(String(s));
  const where = (o) => Object.entries(o).map(([k, v]) => enc(k) + '=' + enc(v)).join('&');
  const fmt = (v) => (v === null || v === undefined || v === '') ? '' : String(v);
  const MODES = {
    printed: { mv: 'move_p', rg: 'range_p', ad: 'ad_p', tot: '_tot_p', atk: 'attack', def: 'defense', atk100: 'atk100_p', def100: 'def100_p', ad100: 'atkdef100_p', tot100: '_tot100_p' },
    specials: { mv: 'move_s', rg: 'range_s', ad: 'ad_s', tot: '_tot_s', atk: 'atk_s', def: 'def_s', atk100: 'atk100_s', def100: 'def100_s', ad100: 'atkdef100_s', tot100: '_tot100_s' },
    conditional: { mv: 'move_c', rg: 'range_c', ad: 'ad_c', tot: '_tot_c', atk: 'atk_c', def: 'def_c', atk100: 'atk100_c', def100: 'def100_c', ad100: 'atkdef100_c', tot100: '_tot100_c' }
  };
  const FILTERS = ['faction', 'ctype', 'cls', 'species', 'pers', 'size', 'bond'];
  const SIZE_ORDER = { Small: 1, Medium: 2, Large: 3, Huge: 4 };
  const parts = (v) => String(v || '').split(' & ').map((s) => s.trim()).filter(Boolean);


  const W0 = { a: 0.5, d: 0.33, l: 1 };
  const state = { w: { ...W0 }, view: 'per', mode: 'specials', q: '', min: 0, max: null, sort: { key: 'tot100', dir: -1 }, f: {}, own: '', cshow: '', era: 'now', errata: true };
  const defaults = () => { state.w = { ...W0 }; state.layout = 'table'; state.bw = null; state.bwdir = 'in'; state.view = 'per'; state.mode = 'specials'; state.q = ''; state.min = 0; state.max = null; state.sort = { key: 'tot100', dir: -1 }; state.f = {}; state.own = ''; };

  const root = document.querySelector('.hs');
  const thead = root.querySelector('thead tr');
  const tbody = root.querySelector('tbody');
  const countEl = root.querySelector('.hs-count');
  const qEl = root.querySelector('.hs-q');
  const minEl = root.querySelector('.hs-min');
  const maxEl = root.querySelector('.hs-max');
  const segBtns = root.querySelectorAll('.hs-seg [data-mode]');
  const viewBtns = root.querySelectorAll('.hs-seg [data-view]');
  const dlg = document.querySelector('dialog.hs-dlg:not(.hs-gdlg):not(.ab-newdlg)');
  // the site's own question box, used instead of the browser's prompt()/confirm(), which embedded pages and apps can block.
  // ask({ title, msg, value, ok }) resolves to the typed text (with value) or true (without), or null when cancelled.
  function ask(o) {
    const d = document.querySelector('dialog.ab-askdlg'), inp = d.querySelector('.ask-in');
    d.querySelector('#ask-t').textContent = o.title; d.querySelector('.ask-msg').textContent = o.msg || ''; d.querySelector('.ask-msg').hidden = !o.msg;
    d.querySelector('.ask-ok').textContent = o.ok || 'OK'; d.querySelector('.ask-cancel').hidden = !!o.alert;
    inp.hidden = o.value == null; inp.value = o.value == null ? '' : o.value;
    return new Promise((res) => {
      let done = false;
      const end = (v) => { if (done) return; done = true; d.close(); res(v); };
      d.querySelector('form').onsubmit = (e) => { e.preventDefault(); end(o.value == null ? true : inp.value); };
      d.querySelector('.ask-cancel').onclick = d.querySelector('.ask-x').onclick = () => end(null);
      d.oncancel = (e) => { e.preventDefault(); end(null); };
      d.showModal(); if (!inp.hidden) inp.select();
    });
  }

  // column spec: key = state key, field(mode) = data column, cls = visibility class
  const COLS = [
    { key: 'unit', label: 'Unit', field: () => 'unit', l: true, text: true },
    { key: 'points', label: 'Pts', field: () => 'points' },
    { key: 'figures', label: 'Figs', field: () => 'figures', c: 'c3' },
    { key: 'mv', label: 'Move', field: (m) => MODES[m].mv, c: 'c2' },
    { key: 'rg', label: 'Range', field: (m) => MODES[m].rg, c: 'c2' },
    { key: 'life', label: 'Life', field: () => 'life', c: 'c2' },
    { key: 'atk', label: 'Atk', field: (m) => MODES[m].atk, c: 'c2', aoe: true },
    { key: 'def', label: 'Def', field: (m) => MODES[m].def, c: 'c2' },
    { key: 'atk100', label: 'Atk/100', field: (m) => MODES[m].atk100, bar: true, c: 'c4', aoe: true },
    { key: 'def100', label: 'Def/100', field: (m) => MODES[m].def100, bar: true, c: 'c4' },
    { key: 'life100', label: 'Life/100', field: () => 'life100', bar: true, c: 'c4' },
    { key: 'ad100', label: 'Atk+Def/100', field: (m) => MODES[m].ad100, bar: true, c: 'c3' },
    { key: 'tot100', label: 'Total/100', field: (m) => MODES[m].tot100, bar: true, main: true },
    { key: 'abilities', label: 'Abilities', field: () => 'abilities', l: true, text: true, c: 'c3', ab: true },
    { key: 'bonding', label: 'Bonding', field: () => 'bonding', l: true, text: true, c: 'c2 dim' },
    { key: 'faction', label: 'Faction', field: () => 'faction', l: true, text: true, c: 'c3 dim' },
    { key: 'species', label: 'Species', field: () => 'species', l: true, text: true, c: 'c2 dim' },
    { key: 'ctype', label: 'Card type', field: () => 'ctype', l: true, text: true, c: 'c2 dim' },
    { key: 'cls', label: 'Class', field: () => 'cls', l: true, text: true, c: 'c2 dim' },
    { key: 'pers', label: 'Personality', field: () => 'pers', l: true, text: true, c: 'c2 dim' },
    { key: 'size', label: 'Size', field: () => 'size_full', l: true, text: true, c: 'c2 dim' }
  ];
  const COLS_PER = COLS.slice();
  const COLS_RAW = [
    ...COLS_PER.slice(0, 3),
    { key: 'mv', label: 'Move', field: (m) => MODES[m].mv, bar: true, c: 'c3' },
    { key: 'rg', label: 'Range', field: (m) => MODES[m].rg, bar: true, c: 'c3' },
    { key: 'life', label: 'Life', field: () => 'life', bar: true, c: 'c4' },
    { key: 'atk', label: 'Attack', field: (m) => MODES[m].atk, bar: true, aoe: true },
    { key: 'def', label: 'Defense', field: (m) => MODES[m].def, bar: true },
    { key: 'ad', label: 'Atk+Def', field: (m) => MODES[m].ad, bar: true, c: 'c3' },
    { key: 'tot', label: 'Total', field: (m) => MODES[m].tot, bar: true, main: true, c: 'c4' },
    ...COLS_PER.slice(COLS_PER.findIndex((c) => c.key === 'tot100') + 1)
  ];
  const SWAP = { per: { atk: 'atk100', def: 'def100', life: 'life100', ad: 'ad100', tot: 'tot100' }, raw: { atk100: 'atk', def100: 'def', life100: 'life', ad100: 'ad', tot100: 'tot' } };
  const useCols = () => { COLS.length = 0; COLS.push(...(state.view === 'raw' ? COLS_RAW : COLS_PER)); };

  function buildHead() {
    useCols();
    if (!COLS.some((c) => c.key === state.sort.key)) state.sort = { key: state.view === 'raw' ? 'tot' : 'tot100', dir: -1 };
    thead.replaceChildren();
    const ath = document.createElement('th'); ath.className = 'addc'; ath.textContent = 'Army'; thead.appendChild(ath);
    for (const col of COLS) {
      const th = document.createElement('th');
      if (!String(col.field(state.mode)).startsWith('_')) th.setAttribute('data-field', col.field(state.mode));
      th.className = [col.ab ? 'abc' : '', col.key === 'unit' ? 'unitc' : '', col.l ? 'l' : '', col.c ? col.c.replace('dim', '') : '', col.main ? 'metric' : ''].join(' ').trim();
      if (state.sort.key === col.key) th.setAttribute('aria-sort', state.sort.dir < 0 ? 'descending' : 'ascending');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = col.label;
      b.addEventListener('click', () => {
        if (state.sort.key === col.key) state.sort.dir *= -1;
        else state.sort = { key: col.key, dir: col.text ? 1 : -1 };
        draw();
      });
      th.appendChild(b);
      thead.appendChild(th);
    }
  }

  let UNITS = [], ALL_UNITS = [], ABIL = {}, SEARCH = {}; // UNITS: the cards the chosen era shows; ALL_UNITS: every card, for armies
  function index() {
    const u = dash.data('units'), a = dash.data('abilities');
    ALL_UNITS = u.status === 'ok' ? [...u.data, ...customRows()].map((r) => ({ ...r })) : [];
    errataPoints(ALL_UNITS);
    applyCardEdits(ALL_UNITS);
    addCustomAbilityNames(ALL_UNITS);
    const w = state.w;
    for (const r of ALL_UNITS) {
      for (const [m, k] of [['printed', 'p'], ['specials', 's'], ['conditional', 'c']]) {
        const F = MODES[m];
        const t100 = w.a * Number(r[F.atk100]) + w.d * Number(r[F.def100]) + w.l * Number(r.life100);
        const t = w.a * Number(r[F.atk]) + w.d * Number(r[F.def]) + w.l * Number(r.life);
        r['_tot100_' + k] = Math.round(t100 * 10) / 10;
        r['_tot_' + k] = Math.round(t * 100) / 100;
      }
    }
    ABIL = {};
    if (a.status === 'ok') for (const r of a.data) (ABIL[r.unit] = ABIL[r.unit] || []).push(r);
    for (const r of customAbilities()) (ABIL[r.unit] = ABIL[r.unit] || []).push(r);
    errataText(ALL_UNITS.filter((r) => !r.edited));
    for (const r of ALL_UNITS) if (r.edited) ABIL[r.unit] = editedAbilities(r.unit);
    UNITS = ALL_UNITS.filter((r) => r.custom || eraOk(r));
    SEARCH = {};
    for (const r of UNITS) {
      const t = [r.unit, r.bond === 'Yes' ? 'bonding' : '', r.faction, r.ctype, r.cls, r.species, r.pers, r.size, r.abilities, ...(ABIL[r.unit] || []).map((x) => x.text)].join(' ').toLowerCase();
      SEARCH[r.unit] = t;
    }
  }

  // ---------- bonds with ----------
  const RULECACHE = new Map();
  const rulesOf = (r) => { if (!r.bond_rules) return null; if (!RULECACHE.has(r.unit)) { try { RULECACHE.set(r.unit, JSON.parse(r.bond_rules)); } catch (e) { RULECACHE.set(r.unit, null); } } return RULECACHE.get(r.unit); };
  const has = (v, list) => parts(v).some((x) => list.includes(x));
  function condOk(c, t) {
    if (c.unit && !c.unit.includes(t.unit)) return false;
    if (c.species && !has(t.species, c.species)) return false;
    if (c.cls && !has(t.cls, c.cls)) return false;
    if (c.faction && !c.faction.includes(t.faction)) return false;
    if (c.pers && !c.pers.includes(t.pers)) return false;
    if (c.size && !c.size.includes(t.size)) return false;
    if (c.ctype && !c.ctype.includes(t.ctype)) return false;
    if (c.hero && !/Hero$/.test(t.ctype || '')) return false;
    if (c.squad && !/Squad$/.test(t.ctype || '')) return false;
    if (c.unique && !/^Unique/.test(t.ctype || '')) return false;
    return true;
  }
  const canBond = (a, b) => { const rl = rulesOf(a); return !!rl && a.unit !== b.unit && rl.some((c) => condOk(c, b)); };
  function bondRel(r) {
    if (!state.bw) return null;
    const x = UNITS.find((u) => u.unit === state.bw); if (!x || x.unit === r.unit) return null;
    const out = canBond(x, r), inn = canBond(r, x);
    return out || inn ? { out, inn } : null;
  }
  function matches(r, skip) {
    if (state.bw) { const b = bondRel(r); const d = state.bwdir || 'in'; if (!b || (d === 'in' && !b.inn) || (d === 'out' && !b.out)) return false; }
    if (state.min !== null && Number(r.points) < state.min) return false;
    if (state.max !== null && Number(r.points) > state.max) return false;
    // The Randomizer has no search box and uses its own collection boxes, so those two filters don't apply there
    const rnd = state.page === 'random';
    if (state.q && !rnd && !SEARCH[r.unit].includes(state.q.toLowerCase())) return false;
    if (state.own && !rnd && !ownMatch(r, state.own)) return false;
    for (const k of FILTERS) {
      if (k === skip || !state.f[k]) continue;
      if (k === 'cls' || k === 'species') { if (!parts(r[k]).includes(state.f[k])) return false; }
      else if (r[k] !== state.f[k]) return false;
    }
    return true;
  }

  function drawFilters() {
    const labels = { faction: 'All factions', ctype: 'All card types', cls: 'All classes', species: 'All species', pers: 'All personalities', size: 'All sizes', bond: 'Any' };
    for (const k of FILTERS) {
      const sel = root.querySelector(`select[data-f="${k}"]`);
      const counts = new Map();
      for (const r of UNITS) {
        if (!matches(r, k)) continue;
        const vals = (k === 'cls' || k === 'species') ? parts(r[k]) : [r[k]];
        for (const v of vals) if (v) counts.set(v, (counts.get(v) || 0) + 1);
      }
      if (state.f[k] && !counts.has(state.f[k])) counts.set(state.f[k], 0);
      let opts = [...counts.keys()];
      opts.sort(k === 'size' ? (a, b) => (SIZE_ORDER[a] || 9) - (SIZE_ORDER[b] || 9) : (a, b) => a.localeCompare(b));
      sel.replaceChildren(new Option(labels[k], ''), ...opts.map((v) => new Option(`${v} (${counts.get(v)})`, v)));
      sel.value = state.f[k] || '';
    }
  }

  function sortVal(r, col) {
    const v = r[col.field(state.mode)];
    if (col.key === 'size') return (SIZE_ORDER[r.size] || 9) * 100 + (Number(r.sizenum) || 0);
    if (col.text) return String(v || '').toLowerCase();
    return Number(v);
  }

  function draw() {
    index();
    buildHead();
    segBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    if (document.activeElement !== qEl) qEl.value = state.q;
    if (document.activeElement !== minEl) minEl.value = state.min === null ? '' : String(state.min);
    if (document.activeElement !== maxEl) maxEl.value = state.max === null ? '' : String(state.max);
    drawFilters();
    syncEra();
    const col = COLS.find((c) => c.key === state.sort.key);
    const rows = UNITS.filter((r) => matches(r));
    rows.sort((a, b) => {
      const x = sortVal(a, col), y = sortVal(b, col);
      if (x < y) return -1 * state.sort.dir;
      if (x > y) return 1 * state.sort.dir;
      return a.unit.localeCompare(b.unit);
    });
    const max = {};
    for (const c of COLS) if (c.bar) max[c.key] = d3.max(rows, (r) => Number(r[c.field(state.mode)])) || 1;
    countEl.textContent = UNITS.length ? `${rows.length} of ${UNITS.length} units` : '';
    tbody.replaceChildren();
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-key', r.unit);
      const atd = document.createElement('td'); atd.className = 'addc';
      atd.appendChild(addBtn(r)); tr.appendChild(atd);
      for (const c of COLS) {
        const td = document.createElement('td');
        const f = c.field(state.mode);
        const cl = [c.l ? 'l' : '', c.c || '', c.bar ? 'bar' : '', c.main ? 'main' : '', c.key === 'unit' ? 'unit' : ''];
        if (c.aoe && r.aoe === '*') cl.push('aoe');
        const TONE = { atk: 'tn-atk', atk100: 'tn-atk', def: 'tn-def', def100: 'tn-def', life: 'tn-life', life100: 'tn-life' };
        if (TONE[c.key]) cl.push(TONE[c.key]);
        if (c.ab) cl.push('ab');
        td.className = cl.join(' ').replace(/\s+/g, ' ').trim();
        if (c.ab) {
          const names = String(r.abilities || '').split('; ').filter(Boolean);
          const isGlyph = (n) => /Glyph\)$/.test(n);
          const main = names.filter((n) => !isGlyph(n)), glyphs = names.filter(isGlyph);
          main.forEach((n, i) => {
            if (i) td.appendChild(document.createTextNode('; '));
            const chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'hs-chip'; chip.textContent = n;
            chip.addEventListener('click', (e) => { e.stopPropagation(); openCard(r, n); });
            tipChip(chip, r.unit, [n]);
            td.appendChild(chip);
          });
          if (glyphs.length) {
            if (main.length) td.appendChild(document.createTextNode('; '));
            const chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'hs-chip hs-chip-g';
            chip.textContent = glyphs.length === 1 ? '+1 glyph' : `+${glyphs.length} glyphs`;
            tipChip(chip, r.unit, glyphs);
            chip.addEventListener('click', (e) => { e.stopPropagation(); openCard(r, glyphs[0]); });
            td.appendChild(chip);
          }
        } else {
          td.textContent = fmt(r[f]);
          if (c.bar) {
            const b = document.createElement('span');
            b.className = 'b';
            b.style.width = `calc((100% - 12px) * ${Math.max(0, Number(r[f]) / max[c.key])})`;
            td.appendChild(b);
          }
        }
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => openCard(r));
      tbody.appendChild(tr);
    }
    LAST_ROWS = rows;
    drawFormula();
    drawGallery(rows);
    if (typeof sizeTop === 'function') requestAnimationFrame(sizeTop);
    drawBw(rows);
    if (state.page === 'charts') { drawCharts(rows); drawDice(); }
    if (state.page === 'fight') { drawDice(); drawDuel(); }
    drawArmy();
    if (state.page === 'collection') drawCollection(rows);
    if (state.page === 'data') drawData();
    drawPages(rows);
    drawCollTab();
    persist();
  }

  // ---------- ability hover text ----------
  let abTip = null;
  function showAbTip(chip, unit, names) {
    if (!abTip) { abTip = document.createElement('div'); abTip.className = 'hs-abtip'; abTip.setAttribute('role', 'tooltip'); root.appendChild(abTip); }
    abTip.replaceChildren();
    for (const n of names) {
      const a = (ABIL[unit] || []).find((x) => x.ability === n);
      const t = document.createElement('div'); t.className = 't'; t.textContent = n; abTip.appendChild(t);
      const x = document.createElement('div'); x.className = 'x'; x.textContent = a && a.text ? a.text : (a && a.note ? a.note : 'Keyword ability.'); abTip.appendChild(x);
    }
    abTip.hidden = false;
    const rb = root.getBoundingClientRect(), cb = chip.getBoundingClientRect();
    const w = abTip.offsetWidth, h = abTip.offsetHeight;
    let left = cb.left - rb.left; left = Math.max(8, Math.min(left, root.clientWidth - w - 8));
    let topY = cb.top - rb.top - h - 6;
    if (cb.top - h - 6 < 0) topY = cb.bottom - rb.top + 6;
    abTip.style.left = left + 'px'; abTip.style.top = topY + 'px';
  }
  const hideAbTip = () => { if (abTip) abTip.hidden = true; };
  function tipChip(chip, unit, names) {
    chip.addEventListener('mouseenter', () => showAbTip(chip, unit, names));
    chip.addEventListener('focus', () => showAbTip(chip, unit, names));
    chip.addEventListener('mouseleave', hideAbTip);
    chip.addEventListener('blur', hideAbTip);
    chip.addEventListener('click', hideAbTip);
  }
  root.addEventListener('scroll', hideAbTip, true);

  function mk(tag, cls, text, mark) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    if (mark) { el.setAttribute('data-source', mark.src); el.setAttribute('data-field', mark.field); el.setAttribute('data-where', where(mark.where)); }
    return el;
  }

  // the full rules for keyword special powers, from the Master Game Guide (Special Power Keywords, page 11)
  const FLYING_RULES = [
    'A figure with the Flying Special Power never takes falling damage and may choose to fly at any point during a non-placement movement made by the figure’s controller or their teammate. When the figure chooses to fly, each figure it is engaged with may make a leaving engagement attack against it. While the figure is flying it ignores all elevations and is not considered to occupy any space that it passes over. This means that:',
    ['It is not adjacent to (or engaged with) any figures.',
      'It may pass over any figures, even figures that would normally disallow other figures from entering their space.',
      'It ignores all terrain effects, such as water and molten lava. It may pass over any space occupied by an obstacle, such as a tree or bush.',
      'It ignores effects of all Glyphs it passes over. That includes not having to stop in a space with a Power Glyph.',
      'It is not affected by any special powers that require adjacency or clear sight or line of sight. For example, a flying figure is not affected by Cyberclaw or Engagement Strike while it is flying (Cyberclaw still prevents a figure from beginning to fly). Figures that are flying can ascend overhangs, but not pass through the bottom of them.'],
    'When a flying figure ends its movement it must land on its current space. When doing so it enters that space and may trigger effects that occur when a figure enters a space, such as Girushia, Grove Keeper’s Wicked Thorns. It is also affected by the terrain it lands on, if that terrain has an effect on figures that enter its space. The figure is then considered to be on that space until it next starts to fly, and it may continue its movement.'
  ];
  const KEYWORD_RULES = {
    'Flying': FLYING_RULES,
    'Stealth Flying': ['A figure with the Stealth Flying Special Power has all of the same benefits as a figure with flying, except that it does not take any leaving engagement attacks when it starts to fly.', 'Flying:', ...FLYING_RULES]
  };
  // the card picture on a unit's page; if the list of pictures is still loading, it is filled in when it arrives
  function dlgPic() {
    const ibox = dlg.querySelector('.hs-cardimg-box'), r = DLG_UNIT;
    if (!r || ibox.querySelector('img')) return;
    const C = dash.data('cards');
    if (C.status !== 'ok') return;
    const row = C.data.find((x) => x.unit === r.unit);
    if (row && CARD_IMG.test(row.img)) {
      const im = document.createElement('img');
      im.className = 'hs-cardimg'; im.alt = r.unit + ' army card'; im.src = row.img;
      ibox.appendChild(im);
    }
  }
  function openCard(r, focusAbility) {
    if (dlg.open) dqUnitChange(); // place a drawing in progress on the unit it was drawn on
    DLG_UNIT = r;
    dlgPick.hidden = true;
    syncDlgAdd();
    notesBox.hidden = true; noteBtn.setAttribute('aria-expanded', 'false'); syncNotes();
    const w = { unit: r.unit };
    const um = (field) => ({ src: 'units', field, where: w });
    dlg.querySelector('#dlg-name').textContent = r.unit;
    const sub = dlg.querySelector('.hs-sub');
    sub.replaceChildren();
    for (const f of ['faction', 'ctype', 'cls', 'pers', 'species', 'size']) if (r[f]) sub.appendChild(mk('span', '', r[f], um(f)));
    if (r.bonding) sub.appendChild(mk('span', '', 'Bonding: ' + r.bonding));
    if (r.sizenum) sub.appendChild(mk('span', '', fmt(r.sizenum), um('sizenum')));

    dlg.querySelector('.hs-cardimg-box').replaceChildren();
    dlgPic();
    const basic = dlg.querySelector('.hs-basic');
    basic.replaceChildren();
    const box = (label, field) => { const d = mk('div', '', label); const b = mk('b', '', fmt(r[field]), um(field)); d.prepend(b); return d; };
    basic.append(box('points', 'points'), box('figures', 'figures'), box('life per figure', 'life'));
    if (r.card_points && Number(r.card_points) !== Number(r.points) && !r.errataPts) {
      const d = mk('div', 'hs-warn', 'printed on the card (rankings use the sheet’s ');
      d.prepend(mk('b', '', fmt(r.card_points), um('card_points')));
      d.appendChild(document.createTextNode(String(r.points) + ')'));
      basic.appendChild(d);
    }

    const st = dlg.querySelector('.hs-stats');
    st.replaceChildren(mk('div', 'h', ''), mk('div', 'h', 'Attack'), mk('div', 'h', 'Defense'), mk('div', 'h', 'Move'), mk('div', 'h', 'Range'), mk('div', 'h', 'Atk/100'), mk('div', 'h', 'Total/100'));
    for (const m of ['printed', 'specials', 'conditional']) {
      const F = MODES[m];
      st.appendChild(mk('div', 'rl', { printed: 'Printed', specials: 'With specials', conditional: 'With conditional' }[m]));
      const a = mk('div', 'v');
      a.appendChild(mk('span', '', fmt(r[F.atk]), um(F.atk)));
      if (r.aoe === '*') a.appendChild(mk('span', 'hs-star', '*', um('aoe')));
      st.appendChild(a);
      st.appendChild(mk('div', 'v', fmt(r[F.def]), um(F.def)));
      st.appendChild(mk('div', 'v', fmt(r[F.mv]), um(F.mv)));
      st.appendChild(mk('div', 'v', fmt(r[F.rg]), um(F.rg)));
      st.appendChild(mk('div', 'v', fmt(r[F.atk100]), um(F.atk100)));
      st.appendChild(mk('div', 'v', fmt(r[F.tot100]), um(F.tot100)));
    }

    const sp = dlg.querySelector('.hs-special');
    sp.replaceChildren();
    if (r.aoe === '*') sp.appendChild(mk('div', '', '', null)).append(mk('span', 'hs-star', '* '), document.createTextNode('Has an ability that hits several different figures; its dice are not added to attack.'));
    if (r.special) { const d = mk('div'); d.append(document.createTextNode('Counted in “with specials”: '), mk('span', '', r.special, um('special'))); sp.appendChild(d); }
    if (r.mr_note) { const d = mk('div'); d.style.marginTop = '4px'; d.append(document.createTextNode('Move/Range: '), mk('span', '', r.mr_note, um('mr_note'))); sp.appendChild(d); }
    if (r.cond) { const d = mk('div'); d.style.marginTop = '4px'; d.append(document.createTextNode('Added in “with conditional”: '), mk('span', '', r.cond, um('cond'))); sp.appendChild(d); }

    const abs = dlg.querySelector('.hs-abs');
    abs.replaceChildren();
    let target = null;
    for (const a of (ABIL[r.unit] || [])) {
      const aw = { unit: a.unit, ability: a.ability };
      const sec = mk('section', 'hs-ab' + (focusAbility === a.ability ? ' hl' : ''));
      const h = sec.appendChild(mk('h3', '', a.ability, { src: 'abilities', field: 'ability', where: aw }));
      if (a.custom) h.appendChild(mk('span', 'hs-tag', a.mine ? 'Edited' : 'Custom'));
      sec.appendChild(mk('p', '', a.text, { src: 'abilities', field: 'text', where: aw }));
      sec.appendChild(mk('div', 'n', a.note, { src: 'abilities', field: 'note', where: aw }));
      const kw = KEYWORD_RULES[a.ability];
      if (kw) {
        const box = mk('div', 'hs-kw');
        box.appendChild(mk('div', 'hs-kwh', 'Master rules: ' + a.ability));
        for (const part of kw) {
          if (Array.isArray(part)) { const ul = mk('ul'); for (const li of part) ul.appendChild(mk('li', '', li)); box.appendChild(ul); }
          else box.appendChild(mk('p', '', part));
        }
        sec.appendChild(box);
      }
      if (focusAbility === a.ability) target = sec;
      abs.appendChild(sec);
    }
    cardExtras(r);
    faqTab(r);
    if (!dlg.open) dlg.showModal();
    applyStickers();
    dlg.querySelector('.hs-dlg-in').scrollTop = 0;
    dlg.scrollTop = 0;
    if (target) target.scrollIntoView({ block: 'center' });
  }

  // the "FAQ & ERRATA" tab: only on units with a points update, card errata or their own FAQ entry (Card Clarifications);
  // it also lists other FAQ answers that name the unit or one of its abilities
  const dTabs = dlg.querySelector('.hs-dtabs'), dCard = dlg.querySelector('.hs-dcard'), dFaq = dlg.querySelector('.hs-dfaq');
  function dTab(t) {
    dTabs.querySelectorAll('.hs-dtab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === t)));
    dCard.hidden = t !== 'card'; dFaq.hidden = t !== 'faq';
  }
  dTabs.querySelectorAll('.hs-dtab').forEach((b) => b.addEventListener('click', () => dTab(b.dataset.t)));
  function faqTab(r) {
    const e = dash.data('errata'), d = e.status === 'ok' ? e.data : {};
    const of = (k) => (d[k] || []).filter((x) => x.unit === r.unit);
    const pts = of('points'), cards = of('cards'), clar = of('clar'), ment = of('mentions');
    dTab('card'); dFaq.replaceChildren();
    dTabs.hidden = !(pts.length || cards.length || clar.length);
    if (dTabs.hidden) return;
    const qaList = (items, from) => {
      const box = mk('div', 'hs-qas');
      for (const x of items) {
        const q = mk('div', 'hs-qa');
        if (from && x.from) q.appendChild(mk('div', 'hs-qafrom', x.from));
        q.append(mk('p', 'hs-q', 'Q: ' + x.q), mk('p', 'hs-a', 'A: ' + (x.a || '')));
        box.appendChild(q);
      }
      return box;
    };
    if (pts.length) {
      dFaq.appendChild(mk('h3', '', 'Points update'));
      for (const p of pts) dFaq.appendChild(mk('p', '', `${p.to > p.from ? 'Increased' : 'Decreased'} from ${p.from} to ${p.to} points.`));
    }
    if (cards.length) {
      dFaq.appendChild(mk('h3', '', 'Card errata'));
      for (const c of cards) {
        for (const a of c.abilities) { const sec = mk('section', 'hs-ab'); sec.append(mk('h3', '', a.ability), mk('p', '', a.text)); dFaq.appendChild(sec); }
        for (const n of c.notes) dFaq.appendChild(mk('p', '', n));
      }
    }
    if (clar.length) { dFaq.appendChild(mk('h3', '', 'FAQ')); for (const c of clar) dFaq.appendChild(qaList(c.qa)); }
    if (ment.length) { dFaq.appendChild(mk('h3', '', 'Also mentioned in the FAQ')); dFaq.appendChild(qaList(ment, true)); }
    if (d.source) dFaq.appendChild(mk('p', 'hs-note', 'From the ' + d.source.replace(/^Heroscape: /, '') + '.'));
  }

  dlg.querySelector('.hs-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });


  // ---------- pages ----------
  let LAST_ROWS = [], DLG_UNIT = null;
  state.page = 'home';
  const PAGES = ['home', 'rankings', 'charts', 'random', 'army', 'fight', 'collection', 'products', 'terrain', 'maps', 'tournament', 'record', 'player', 'rules', 'settings', 'data'];
  function showPage(id, push) {
    if (!PAGES.includes(id)) return;
    state.page = id;
    syncNav(id);
    root.querySelectorAll('.hs-page').forEach((sec) => { sec.hidden = sec.id !== id; });
    // the filter bar only on pages that use it; pages.css hides the parts a page doesn't use (#filters[data-on])
    const filt = document.getElementById('filters');
    filt.hidden = !['rankings', 'charts', 'collection', 'random', 'fight'].includes(id);
    filt.dataset.on = id;
    if (push) dash.setLink(id);
    draw();
  }

  // ---------- army ----------
  let FOLDERS = []; let ARMY_SORT = ''; // army folders (names, in order) and how armies are sorted in lists; each army may have .folder
  // each army has its own point total (limit; the saved default when unset) and legality (era: which cards it may use)
  let POINT_DEFAULT = 500;
  const ERA_SHORT = { now: 'Contemp.', classic: 'Old school', all: 'All time' };
  const armyLim = (a) => (a.limit != null ? a.limit : POINT_DEFAULT);
  const armyEra = (a) => (ERA_SHORT[a.era] ? a.era : 'all');
  function legalIn(x, e) { const u = (x && x.era) || 'now'; return e === 'all' || u === 'both' || u === e; }
  const ARMIES = [{ name: 'Army 1', map: new Map() }]; let CUR = 0; let ARMY = ARMIES[0].map; let CMP = [0, 0]; // map: unit -> qty
  const isUnique = (r) => String(r.ctype || '').startsWith('Unique');
  const byName = (n) => ALL_UNITS.find((u) => u.unit === n); // armies keep every card, whatever era the site shows
  function addUnit(r) {
    const q = ARMY.get(r.unit) || 0;
    if (isUnique(r) && q >= 1) return;
    ARMY.set(r.unit, q + 1);
    draw(); syncDlgAdd();
  }
  function setQty(n, q) { if (q <= 0) ARMY.delete(n); else ARMY.set(n, q); draw(); syncDlgAdd(); }
  function addBtn(r) {
    const q = ARMY.get(r.unit) || 0;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hs-add' + (q ? ' on' : '');
    b.textContent = q ? (isUnique(r) ? '✓' : '×' + q) : '+';
    b.setAttribute('aria-label', q ? `${r.unit} in army (${q}); click to ${isUnique(r) ? 'remove' : 'add another'}` : `Add ${r.unit} to army`);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (q && isUnique(r)) setQty(r.unit, 0); else addUnit(r);
    });
    return b;
  }
  const dlgAdd = dlg.querySelector('.hs-dlg-add'), dlgIn = dlg.querySelector('.hs-dlg-inarmy');
  // notes: a small side button on a unit's full page opens a note on the card and one on the army being edited
  const noteBtn = dlg.querySelector('.hs-notebtn'), notesBox = dlg.querySelector('.hs-notes');
  const cNote = dlg.querySelector('.dlg-cnote'), aNote = dlg.querySelector('.dlg-anote');
  function syncNotes() {
    if (!DLG_UNIT) return;
    const cn = (COLL.get(DLG_UNIT.unit) || {}).note || '', an = ARMIES[CUR].note || '';
    if (document.activeElement !== cNote) cNote.value = cn;
    notePicShow(DLG_UNIT.unit);
    const has = !!(cn || an || notePicOf(DLG_UNIT.unit));
    if (document.activeElement !== aNote) aNote.value = an;
    dlg.querySelector('.dlg-anote-l').textContent = 'Note on army: ' + ARMIES[CUR].name;
    noteBtn.classList.toggle('has', has);
    noteBtn.setAttribute('aria-label', 'Notes' + (has ? ' (has notes)' : ''));
  }
  noteBtn.addEventListener('click', () => {
    notesBox.hidden = !notesBox.hidden;
    noteBtn.setAttribute('aria-expanded', String(!notesBox.hidden));
    if (!notesBox.hidden) cNote.focus();
  });
  cNote.addEventListener('input', () => { setColl(DLG_UNIT.unit, { note: noteStr(cNote.value, 1000) }); persist(); syncNotes(); });
  aNote.addEventListener('input', () => { ARMIES[CUR].note = noteStr(aNote.value, 1000); persist(); syncNotes(); });
  // "Add to army…" on a unit's page asks which army: one button per army, plus a new one
  const dlgPick = dlg.querySelector('.hs-dlg-pick'), dlgArmies = dlg.querySelector('.hs-dlg-armies');
  function syncDlgAdd() {
    if (!DLG_UNIT) return;
    const u = DLG_UNIT.unit, inA = ARMIES.filter((a) => a.map.get(u));
    dlgIn.textContent = inA.length ? 'In ' + inA.map((a) => a.name + (a.map.get(u) > 1 ? ' (×' + a.map.get(u) + ')' : '')).join(', ') : '';
    dlgAdd.setAttribute('aria-expanded', String(!dlgPick.hidden));
    if (dlgPick.hidden) return;
    const out = [];
    for (const [f, list] of armyGroups()) for (const i of list) {
      const a = ARMIES[i], q = a.map.get(u) || 0, full = isUnique(DLG_UNIT) && q >= 1;
      const b = btn('', 'hs-sm hs-dlg-army' + (q ? ' on' : ''), () => {
        if (full) a.map.delete(u); else a.map.set(u, q + 1);
        persist(); draw(); syncDlgAdd();
      });
      b.append(mk('b', '', a.name), mk('span', 'hs-note', (f ? f + ' · ' : '') + armyPts(a) + ' / ' + armyLim(a) + ' pts · ' + ERA_SHORT[armyEra(a)] + (legalIn(DLG_UNIT, armyEra(a)) ? '' : ' (not legal there)') + (full ? ' · in it, tap to remove' : q ? ' · ×' + q + ', tap to add another' : '')));
      out.push(b);
    }
    out.push(btn('+ New army', 'hs-sm', () => newArmyDlg((i) => { ARMIES[i].map.set(u, 1); persist(); draw(); syncDlgAdd(); })));
    dlgArmies.replaceChildren(...out);
  }
  dlgAdd.addEventListener('click', () => { dlgPick.hidden = !dlgPick.hidden; syncDlgAdd(); });
  const pick = root.querySelector('.hs-pick'), limEl = root.querySelector('.hs-limit');
  pick.addEventListener('change', () => { const r = byName(pick.value); if (r) addUnit(r); pick.value = ''; });
  limEl.addEventListener('input', () => { ARMIES[CUR].limit = Math.max(0, Math.min(9999, Math.round(Number(limEl.value) || 0))); persist(); drawArmy(); drawFolders(); });
  const legalSel = root.querySelector('.ab-legal');
  legalSel.addEventListener('change', () => { ARMIES[CUR].era = legalSel.value; persist(); draw(); });
  root.querySelector('.hs-clear').addEventListener('click', () => { ARMY.clear(); draw(); syncDlgAdd(); });
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  function drawArmy() {
    const n = ARMY.size;
    root.querySelector('.hs-subtabs .na').textContent = n ? String([...ARMY.values()].reduce((a, b) => a + b, 0)) : '';
    // picker
    const cur = pick.value;
    const sorted = ALL_UNITS.filter((u) => (!pickOwned.checked || ownedOf(u.unit) > 0) && (u.custom || legalIn(u, armyEra(ARMIES[CUR])))).sort((a, b) => a.unit.localeCompare(b.unit));
    pick.replaceChildren(new Option(pickOwned.checked && !sorted.length ? 'You have no cards in your collection yet' : 'Choose a unit…', ''), ...sorted.map((u) => {
      const full = isUnique(u) && ARMY.has(u.unit);
      const o = new Option(`${u.unit} (${u.points})`, u.unit); o.disabled = full; return o;
    }));
    pick.value = cur && !pick.querySelector(`option[value="${CSS.escape(cur)}"]`)?.disabled ? cur : '';
    const items = [...ARMY.entries()].map(([nm, q]) => ({ r: byName(nm), q })).filter((x) => x.r);
    const pts = d3.sum(items, (x) => x.q * Number(x.r.points));
    const figs = d3.sum(items, (x) => x.q * Number(x.r.figures));
    const lim = armyLim(ARMIES[CUR]), legal = armyEra(ARMIES[CUR]);
    const set = (c, v) => { root.querySelector(c).textContent = v; };
    set('.a-pts', d3.format(',')(pts)); set('.a-figs', d3.format(',')(figs));
    set('.a-cards', d3.format(',')(d3.sum(items, (x) => x.q)));
    const left = lim - pts; set('.a-left', lim ? d3.format(',')(left) : '—');
    set('.ab-lim', lim ? d3.format(',')(lim) : '—');
    const bar = root.querySelector('.ab-editview .ab-bar'), pct = lim ? Math.min(100, (pts / lim) * 100) : 0;
    bar.firstElementChild.style.width = pct + '%'; bar.classList.toggle('over', lim && left < 0); bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    root.querySelector('.a-left').classList.toggle('over', lim && left < 0);
    root.querySelector('.a-pts').classList.toggle('over', lim && left < 0);
    const body = root.querySelector('.a-body');
    body.replaceChildren();
    if (!items.length) {
      body.appendChild(mk('div', 'hs-empty', 'No units yet. Use Add card, or the + buttons on the Rankings page.'));
    } else {
      // one row per card: small picture (once the pictures are loaded), name, type and faction, count, points
      const C = dash.peek('cards') === 'ok' ? dash.data('cards').data : null;
      const list = mk('div', 'ab-rows');
      items.sort((a, b) => b.r.points * b.q - a.r.points * a.q);
      for (const { r, q } of items) {
        const row = mk('div', 'ab-row');
        const img = C && C.find((x) => x.unit === r.unit);
        if (img) { const im = document.createElement('img'); im.className = 'ab-thumb'; im.alt = ''; im.loading = 'lazy'; im.src = img.img; row.appendChild(im); }
        const nm = mk('button', 'ab-unit'); nm.type = 'button';
        nm.append(mk('b', '', r.unit), mk('span', 'ab-sub', [r.ctype, r.faction].filter(Boolean).join(' · ')), mk('span', 'ab-sub', `${q * r.figures} figure${q * r.figures === 1 ? '' : 's'}`));
        if (!legalIn(r, legal)) nm.appendChild(mk('span', 'ab-illegal', 'Not legal in ' + ERAS[legal]));
        nm.addEventListener('click', () => openCard(r));
        const w = mk('span', 'hs-q2');
        const minus = mk('button', '', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'One fewer ' + r.unit); minus.addEventListener('click', () => setQty(r.unit, q - 1));
        const plus = mk('button', '', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'One more ' + r.unit); plus.disabled = isUnique(r); plus.addEventListener('click', () => addUnit(r));
        w.append(minus, mk('span', '', String(q)), plus);
        const side = mk('span', 'ab-side'); side.append(w, mk('span', 'ab-pts', d3.format(',')(q * r.points) + ' pts'));
        const x = mk('button', 'ab-icon ab-rm', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + r.unit); x.title = 'Remove'; x.addEventListener('click', () => setQty(r.unit, 0));
        row.append(nm, side, x); list.appendChild(row);
      }
      body.appendChild(list);
    }
    // per-100 table (points-weighted average of each unit's per-100 numbers)
    const per = root.querySelector('.a-per tbody'); per.replaceChildren();
    const raw = root.querySelector('.a-raw tbody'); raw.replaceChildren();
    const NAMES = { printed: 'Printed', specials: 'With specials', conditional: 'With conditional' };
    const L100 = 'life100';
    for (const m of ['printed', 'specials', 'conditional']) {
      const F = MODES[m];
      const w = (field) => pts ? d3.sum(items, (x) => x.q * Number(x.r.points) * Number(x.r[field])) / pts : NaN;
      const tr = per.insertRow();
      tr.appendChild(mk('td', 'l', NAMES[m]));
      for (const fld of [F.atk100, F.def100, L100, F.ad100, F.tot100]) tr.appendChild(mk('td', '', pts ? f1(w(fld)) : '—'));
      const tr2 = raw.insertRow();
      tr2.appendChild(mk('td', 'l', NAMES[m]));
      const tot = (field) => d3.sum(items, (x) => x.q * Number(x.r.points) * Number(x.r[field]) / 100);
      for (const fld of [F.atk100, F.def100, L100]) tr2.appendChild(mk('td', '', pts ? d3.format(',')(Math.round(tot(fld))) : '—'));
    }
    drawOwnWarn(items);
    drawCompare();
    drawArmyGallery();
  }



  // ---------- several armies ----------
  const armySel = root.querySelector('.hs-armysel'), armyName = root.querySelector('.hs-armyname');
  const cmpOn = root.querySelector('.hs-cmpon'), cmp1 = root.querySelector('.hs-cmp1'), cmp2 = root.querySelector('.hs-cmp2');
  const nextName = () => { let i = ARMIES.length + 1; while (ARMIES.some((a) => a.name === 'Army ' + i)) i++; return 'Army ' + i; };
  function setCur(i) { CUR = Math.max(0, Math.min(ARMIES.length - 1, i)); ARMY = ARMIES[CUR].map; draw(); syncDlgAdd(); }
  // the Army builder shows either the list of armies or the army being edited (not saved)
  let AB_VIEW = 'list';
  const abListEl = root.querySelector('.ab-listview'), abEditEl = root.querySelector('.ab-editview');
  function abShow(v) { AB_VIEW = v; draw(); if (v === 'edit') root.querySelector('#army-list').scrollIntoView({ block: 'start' }); }
  function openArmy(i) { AB_VIEW = 'edit'; setCur(i); root.querySelector('#army-list').scrollIntoView({ block: 'start' }); }
  root.querySelector('.ab-back').addEventListener('click', () => abShow('list'));
  // New army asks for a name, point total and legality first
  const abn = document.querySelector('dialog.ab-newdlg:not(.ab-askdlg)'), abnName = abn.querySelector('.abn-name'), abnPts = abn.querySelector('.abn-pts');
  let abnEra = 'now', abnAfter = null;
  const abnSeg = () => abn.querySelectorAll('.abn-era button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === abnEra)));
  abn.querySelectorAll('.abn-era button').forEach((b) => b.addEventListener('click', () => { abnEra = b.dataset.v; abnSeg(); }));
  function newArmyDlg(after) {
    abnAfter = after; abnName.value = nextName(); abnPts.value = String(POINT_DEFAULT); abnEra = state.era; abnSeg();
    abn.showModal(); abnName.select();
  }
  abn.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = abnName.value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) || nextName();
    const limit = Math.max(0, Math.min(9999, Math.round(Number(abnPts.value) || 0)));
    ARMIES.push({ name, map: new Map(), folder: AB_VIEW === 'edit' ? ARMIES[CUR].folder || '' : OPEN_FOLDER, limit, era: abnEra });
    abn.close(); persist();
    if (abnAfter) abnAfter(ARMIES.length - 1);
  });
  for (const c of ['.abn-x', '.abn-cancel']) abn.querySelector(c).addEventListener('click', () => abn.close());
  // a new army stays in the list (in the open folder, if any), marked as the current one; tap it to edit
  root.querySelector('.ab-new').addEventListener('click', () => newArmyDlg((i) => {
    AB_VIEW = 'list'; setCur(i);
    const t = foldList.querySelector('.ab-army.on'); if (t) { t.scrollIntoView({ block: 'nearest' }); t.classList.add('ab-fresh'); setTimeout(() => t.classList.remove('ab-fresh'), 1500); }
  }));
  const abQ = root.querySelector('.ab-q');
  abQ.addEventListener('input', () => drawFolders());
  // Add card and Settings open their own panel under the buttons
  for (const [b, p] of [['.ab-addbtn', '.ab-addpanel'], ['.ab-setbtn', '.ab-setpanel']]) {
    const btnEl = root.querySelector(b), panel = root.querySelector(p);
    btnEl.addEventListener('click', () => { panel.hidden = !panel.hidden; btnEl.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden && b === '.ab-addbtn') pick.focus(); });
  }
  function dupArmy(i) { const a = ARMIES[i]; ARMIES.push({ name: (a.name + ' copy').slice(0, 40), map: new Map(a.map), note: a.note || '', folder: a.folder || '', limit: a.limit, era: a.era }); }
  function delArmy(i) {
    if (ARMIES.length === 1) { ARMIES[0].map.clear(); setCur(0); return; }
    ARMIES.splice(i, 1);
    CMP = CMP.map((c) => Math.min(c === i ? 0 : c > i ? c - 1 : c, ARMIES.length - 1)); if (CMP[0] === CMP[1] && ARMIES.length > 1) CMP[1] = CMP[0] === 0 ? 1 : 0;
    setCur(Math.min(CUR > i ? CUR - 1 : CUR, ARMIES.length - 1));
  }
  armySel.addEventListener('change', () => setCur(Number(armySel.value)));
  armyName.addEventListener('input', () => { ARMIES[CUR].name = armyName.value.trim() || ('Army ' + (CUR + 1)); drawArmyMeta(); });
  armyName.addEventListener('blur', () => draw());
  root.querySelector('.hs-newarmy').addEventListener('click', () => newArmyDlg((i) => setCur(i)));
  root.querySelector('.hs-duparmy').addEventListener('click', () => { dupArmy(CUR); setCur(ARMIES.length - 1); });
  root.querySelector('.hs-delarmy').addEventListener('click', async () => { if (ARMIES.length > 1 && !await ask({ title: `Delete the army "${ARMIES[CUR].name}"?`, ok: 'Delete' })) return; delArmy(CUR); if (ARMIES.length) abShow('list'); });
  cmpOn.addEventListener('change', () => {
    if (cmpOn.checked && CMP[0] === CMP[1] && ARMIES.length > 1) CMP = [CUR, CUR === 0 ? 1 : 0];
    draw();
  });
  cmp1.addEventListener('change', () => { CMP[0] = Number(cmp1.value); draw(); });
  cmp2.addEventListener('change', () => { CMP[1] = Number(cmp2.value); draw(); });
  // ---------- army folders and sorting ----------
  const armyPts = (a) => d3.sum([...a.map].map(([n, q]) => q * (byName(n)?.points || 0)));
  const SORTS = { '': null, name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }), hi: (a, b) => armyPts(b) - armyPts(a), lo: (a, b) => armyPts(a) - armyPts(b) };
  // [folder name ('' = no folder), [army indexes]] in display order; empty folders are listed too
  function armyGroups() {
    const idx = ARMIES.map((a, i) => i);
    if (SORTS[ARMY_SORT]) idx.sort((i, j) => SORTS[ARMY_SORT](ARMIES[i], ARMIES[j]) || i - j);
    const g = [...FOLDERS.map((f) => [f, []]), ['', []]];
    for (const i of idx) { const f = FOLDERS.includes(ARMIES[i].folder) ? ARMIES[i].folder : ''; g.find((x) => x[0] === f)[1].push(i); }
    return g;
  }
  function fillSel(sel, val) {
    const opt = (i) => new Option(`${ARMIES[i].name} (${armyPts(ARMIES[i])} pts)`, String(i));
    const out = [];
    for (const [f, list] of armyGroups()) {
      if (!list.length) continue;
      if (!FOLDERS.length) { out.push(...list.map(opt)); continue; }
      const og = document.createElement('optgroup'); og.label = f || 'No folder'; og.append(...list.map(opt)); out.push(og);
    }
    sel.replaceChildren(...out);
    sel.value = String(val);
  }
  const folderSel = root.querySelector('.hs-armyfolder'), sortSel = root.querySelector('.hs-armysort'), foldList = root.querySelector('.hs-folders');
  let OPEN_FOLDER = ''; // the folder open in the army list ('' = the top level; not saved)
  const folderName = async (cur, msg) => {
    const t = ((await ask({ title: msg, value: cur || '', ok: cur ? 'Rename' : 'Create folder' })) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40);
    if (!t) return '';
    if (FOLDERS.includes(t) && t !== cur) { await ask({ title: 'There is already a folder called ' + t + '.', alert: true }); return ''; }
    return t;
  };
  async function newFolder(moveCur) {
    if (FOLDERS.length >= 100) return;
    const t = await folderName('', 'Name the new folder'); if (!t) { drawFolders(); return; }
    FOLDERS.push(t);
    if (moveCur) ARMIES[CUR].folder = t;
    persist(); draw();
  }
  async function renameFolder(f) {
    const t = await folderName(f, 'Rename the folder'); if (!t || t === f) return;
    FOLDERS[FOLDERS.indexOf(f)] = t;
    for (const a of ARMIES) if (a.folder === f) a.folder = t;
    if (OPEN_FOLDER === f) OPEN_FOLDER = t;
    persist(); draw();
  }
  async function deleteFolder(f) {
    const n = ARMIES.filter((a) => a.folder === f).length;
    if (!await ask({ title: `Delete the folder "${f}"?`, msg: n ? `Its ${n} ${n === 1 ? 'army moves' : 'armies move'} to No folder; no army is deleted.` : '', ok: 'Delete' })) return;
    FOLDERS = FOLDERS.filter((x) => x !== f);
    for (const a of ARMIES) if (a.folder === f) a.folder = '';
    persist(); draw();
  }
  function moveFolder(f, d) {
    const i = FOLDERS.indexOf(f), j = i + d; if (j < 0 || j >= FOLDERS.length) return;
    [FOLDERS[i], FOLDERS[j]] = [FOLDERS[j], FOLDERS[i]]; persist(); draw();
  }
  folderSel.addEventListener('change', () => {
    if (folderSel.value === '\u0001new') { newFolder(true); return; }
    ARMIES[CUR].folder = folderSel.value; persist(); draw();
  });
  sortSel.addEventListener('change', () => { ARMY_SORT = sortSel.value in SORTS ? sortSel.value : ''; persist(); draw(); });
  root.querySelector('.hs-newfolder').addEventListener('click', () => newFolder(false));
  // the army list: folder tiles first, then armies that are in no folder; opening a folder shows only its armies
  // (an army in a folder shows only there). Searching lists matching armies from every folder.
  // Drag an army onto a folder tile to move it in, or onto "All armies" to take it out.
  const dropArmy = (el, f) => {
    el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-army')) { e.preventDefault(); el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop');
      const i = Number(e.dataTransfer.getData('text/x-army')); if (!ARMIES[i]) return;
      ARMIES[i].folder = f; persist(); draw();
    });
  };
  const ib = (t, label, fn) => { const b = btn(t, 'ab-icon', fn); b.setAttribute('aria-label', label); b.title = label; return b; };
  function armyTile(i, showFolder) {
    const a = ARMIES[i], pts = armyPts(a), n = d3.sum([...a.map.values()]), lim = armyLim(a);
    const c = mk('div', 'ab-army' + (i === CUR ? ' on' : ''));
    c.draggable = true;
    c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-army', String(i)); e.dataTransfer.effectAllowed = 'move'; });
    const open = mk('button', 'ab-open'); open.type = 'button'; open.setAttribute('aria-label', 'Open ' + a.name);
    const meta = mk('span', 'ab-meta', `${showFolder && a.folder ? '📁 ' + a.folder + ' · ' : ''}${n} card${n === 1 ? '' : 's'} · ${d3.format(',')(pts)}${lim ? ' / ' + d3.format(',')(lim) : ''} pts `);
    meta.appendChild(mk('span', 'ab-badge', ERA_SHORT[armyEra(a)]));
    open.append(mk('b', 'ab-name', a.name), meta);
    const bar = mk('span', 'ab-bar' + (lim && pts > lim ? ' over' : '')); const fill = mk('span'); fill.style.width = (lim ? Math.min(100, (pts / lim) * 100) : 0) + '%'; bar.appendChild(fill); open.appendChild(bar);
    open.addEventListener('click', () => openArmy(i));
    const tools = mk('span', 'ab-tools');
    tools.append(ib('✎', 'Edit ' + a.name, () => openArmy(i)), ib('⧉', 'Duplicate ' + a.name, () => { dupArmy(i); persist(); draw(); }),
      ib('🗑', 'Delete ' + a.name, async () => { if (ARMIES.length > 1 && !await ask({ title: `Delete the army "${a.name}"?`, ok: 'Delete' })) return; delArmy(i); }));
    c.append(open, tools);
    return c;
  }
  function folderTile(f, list) {
    const c = mk('div', 'ab-army ab-foldtile');
    const open = mk('button', 'ab-open'); open.type = 'button'; open.setAttribute('aria-label', 'Open folder ' + f);
    open.append(mk('b', 'ab-name', '📁 ' + f), mk('span', 'ab-meta', list.length ? list.length + (list.length === 1 ? ' army' : ' armies') : 'Empty'));
    open.addEventListener('click', () => { OPEN_FOLDER = f; drawFolders(); foldList.scrollIntoView({ block: 'nearest' }); });
    const tools = mk('span', 'ab-tools');
    tools.append(ib('↑', 'Move folder ' + f + ' up', () => moveFolder(f, -1)), ib('↓', 'Move folder ' + f + ' down', () => moveFolder(f, 1)));
    c.append(open, tools); dropArmy(c, f);
    return c;
  }
  function drawFolders() {
    folderSel.replaceChildren(new Option('No folder', ''), ...FOLDERS.map((f) => new Option(f, f)), new Option('New folder…', '\u0001new'));
    folderSel.value = FOLDERS.includes(ARMIES[CUR].folder) ? ARMIES[CUR].folder : '';
    sortSel.value = ARMY_SORT;
    if (OPEN_FOLDER && !FOLDERS.includes(OPEN_FOLDER)) OPEN_FOLDER = '';
    const out = [], q = abQ.value.trim().toLowerCase(), groups = armyGroups(), grid = mk('div', 'ab-armies');
    if (q) {
      const hits = groups.flatMap(([, l]) => l).filter((i) => ARMIES[i].name.toLowerCase().includes(q));
      grid.append(...(hits.length ? hits.map((i) => armyTile(i, true)) : [mk('p', 'hs-note', 'No army matches.')]));
    } else if (OPEN_FOLDER) {
      const f = OPEN_FOLDER, list = groups.find((g) => g[0] === f)[1];
      const head = mk('div', 'ab-head ab-foldbar');
      const back = btn('← All armies', 'hs-sm', () => { OPEN_FOLDER = ''; drawFolders(); });
      back.title = 'Back to all armies (drop an army here to take it out of the folder)'; dropArmy(back, '');
      const tools = mk('span', 'hs-foldtools');
      const tb = (t, label, fn) => { const b = btn(t, 'hs-sm', fn); b.setAttribute('aria-label', label); return b; };
      tools.append(tb('Rename', 'Rename folder ' + f, () => renameFolder(f)), tb('Delete', 'Delete folder ' + f, () => deleteFolder(f)));
      head.append(back, mk('h4', 'ab-foldname', '📁 ' + f), tools);
      out.push(head);
      grid.append(...(list.length ? list.map((i) => armyTile(i)) : [mk('p', 'hs-note', 'Empty. Use + New army here, pick this folder in an army’s Settings, or drag an army onto the folder.')]));
    } else {
      grid.append(...groups.filter(([f]) => f).map(([f, list]) => folderTile(f, list)), ...groups.find(([f]) => !f)[1].map((i) => armyTile(i)));
    }
    out.push(grid);
    foldList.replaceChildren(...out);
  }
  function drawArmyMeta() {
    fillSel(armySel, CUR);
    drawFolders();
    if (document.activeElement !== armyName) armyName.value = ARMIES[CUR].name;
    root.querySelector('.a-title').textContent = ARMIES[CUR].name;
    root.querySelector('.a-title2').textContent = `${ARMIES[CUR].name} per 100 points`;
    root.querySelector('.hs-delarmy').hidden = ARMIES.length === 1; // Clear army does the same for a last army
    abListEl.hidden = AB_VIEW !== 'list'; abEditEl.hidden = AB_VIEW !== 'edit';
    if (document.activeElement !== limEl) limEl.value = String(armyLim(ARMIES[CUR]));
    legalSel.value = armyEra(ARMIES[CUR]);
    root.querySelector('.ab-era').textContent = ERA_SHORT[armyEra(ARMIES[CUR])];
    document.getElementById('army-stats').hidden = AB_VIEW !== 'edit';
  }
  function armyStats(map) {
    const items = [...map.entries()].map(([nm, q]) => ({ r: byName(nm), q })).filter((x) => x.r);
    const pts = d3.sum(items, (x) => x.q * Number(x.r.points));
    const o = { pts, figs: d3.sum(items, (x) => x.q * Number(x.r.figures)), cards: d3.sum(items, (x) => x.q), per: {}, tot: {} };
    for (const m of ['printed', 'specials', 'conditional']) {
      const F = MODES[m];
      const w = (f) => pts ? d3.sum(items, (x) => x.q * Number(x.r.points) * Number(x.r[f])) / pts : NaN;
      const t = (f) => d3.sum(items, (x) => x.q * Number(x.r.points) * Number(x.r[f]) / 100);
      o.per[m] = { atk: w(F.atk100), def: w(F.def100), life: w('life100'), ad: w(F.ad100), tot: w(F.tot100) };
      o.tot[m] = { atk: t(F.atk100), def: t(F.def100), life: t('life100') };
    }
    return o;
  }
  function drawCompare() {
    drawArmyMeta();
    const card = document.getElementById('army-compare');
    card.hidden = !cmpOn.checked;
    if (!cmpOn.checked) return;
    CMP = CMP.map((c) => Math.min(c, ARMIES.length - 1));
    fillSel(cmp1, CMP[0]); fillSel(cmp2, CMP[1]);
    card.querySelector('.c1').textContent = ARMIES[CMP[0]].name;
    card.querySelector('.c2').textContent = ARMIES[CMP[1]].name;
    card.querySelector('.c3').textContent = 'Difference';
    const A = armyStats(ARMIES[CMP[0]].map), B = armyStats(ARMIES[CMP[1]].map);
    const tb = root.querySelector('.a-cmp tbody'); tb.replaceChildren();
    const NAMES = { printed: 'printed', specials: 'with specials', conditional: 'with conditional' };
    const head = (t) => { const tr = tb.insertRow(); const td = mk('td', 'l', t); td.colSpan = 4; td.style.fontWeight = '600'; td.style.paddingTop = '10px'; tr.appendChild(td); };
    const row = (label, a, b, dp, higher) => {
      const tr = tb.insertRow(); tr.appendChild(mk('td', 'l', label));
      const f = (v) => Number.isFinite(v) ? (dp ? f1(v) : d3.format(',')(Math.round(v))) : '—';
      const ca = mk('td', '', f(a)), cb = mk('td', '', f(b));
      if (higher !== null && Number.isFinite(a) && Number.isFinite(b) && a !== b) ((higher ? a > b : a < b) ? ca : cb).style.fontWeight = '700';
      tr.append(ca, cb);
      const d = Number.isFinite(a) && Number.isFinite(b) ? b - a : NaN;
      tr.appendChild(mk('td', '', Number.isFinite(d) ? (d > 0 ? '+' : '') + (dp ? f1(d) : d3.format(',')(Math.round(d))) : '—'));
    };
    head('Size');
    row('Points', A.pts, B.pts, false, null); row('Figures', A.figs, B.figs, false, null); row('Army cards', A.cards, B.cards, false, null);
    for (const m of ['printed', 'specials', 'conditional']) {
      head(`Per 100 points, ${NAMES[m]}`);
      row('Attack', A.per[m].atk, B.per[m].atk, true, true); row('Defense', A.per[m].def, B.per[m].def, true, true);
      row('Life', A.per[m].life, B.per[m].life, true, true); row('Total', A.per[m].tot, B.per[m].tot, true, true);
    }
    for (const m of ['printed', 'specials', 'conditional']) {
      head(`Army totals, ${NAMES[m]}`);
      row('Attack dice', A.tot[m].atk, B.tot[m].atk, false, true); row('Defense dice', A.tot[m].def, B.tot[m].def, false, true); row('Life', A.tot[m].life, B.tot[m].life, false, true);
    }
  }

  // ---------- army export / import ----------
  const ioText = root.querySelector('.hs-iotext'), ioMsg = root.querySelector('.hs-io .msg');
  const say = (t, bad) => { ioMsg.textContent = t; ioMsg.classList.toggle('bad', !!bad); };
  function exportText() {
    const items = [...ARMY.entries()].map(([n, q]) => ({ r: byName(n), q })).filter((x) => x.r);
    const pts = d3.sum(items, (x) => x.q * x.r.points);
    const lines = items.sort((a, b) => a.r.unit.localeCompare(b.r.unit)).map((x) => `${x.q}x ${x.r.unit}`);
    return lines.length ? `# ${ARMIES[CUR].name}: ${pts} points\n` + lines.join('\n') : '';
  }
  root.querySelector('.hs-export').addEventListener('click', () => {
    const t = exportText();
    if (!t) { say('Your army is empty.', true); return; }
    ioText.value = t; ioText.focus(); ioText.select(); say('Exported. Copy the text to save it.');
  });
  root.querySelector('.hs-copy').addEventListener('click', async () => {
    if (!ioText.value) ioText.value = exportText();
    if (!ioText.value) { say('Nothing to copy.', true); return; }
    try { await navigator.clipboard.writeText(ioText.value); say('Copied to the clipboard.'); }
    catch (e) { ioText.focus(); ioText.select(); say('Text selected. Press Ctrl+C (or ⌘C, or long-press on a phone) to copy.'); }
  });
  const norm = (t) => String(t).toLowerCase().replace(/[“”"']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function parseArmy(text) {
    const idx = new Map(UNITS.map((u) => [norm(u.unit), u]));
    const out = new Map(), bad = [];
    for (let line of text.split(/\r?\n/)) {
      line = line.replace(/#.*$/, '').trim();
      if (!line) continue;
      let q = 1; const m = line.match(/^(\d+)\s*[x×*]?\s+(.+)$/i) || line.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
      let name = line;
      if (m) { if (/^\d+$/.test(m[1])) { q = +m[1]; name = m[2]; } else { name = m[1]; q = +m[2]; } }
      name = name.replace(/\s*\(\d+\s*(pts?|points)\)\s*$/i, '').trim();
      let u = idx.get(norm(name));
      if (!u) { const c = UNITS.filter((x) => norm(x.unit).startsWith(norm(name))); if (c.length === 1) u = c[0]; }
      if (!u && norm(name).length >= 4) { const c = UNITS.filter((x) => (' ' + norm(x.unit) + ' ').includes(' ' + norm(name) + ' ')); if (c.length === 1) u = c[0]; }
      if (!u || q < 1) { bad.push(line); continue; }
      out.set(u.unit, (out.get(u.unit) || 0) + q);
    }
    return { out, bad };
  }
  function doImport(replace) {
    if (!UNITS.length) { say('Units are still loading.', true); return; }
    const { out, bad } = parseArmy(ioText.value);
    if (!out.size) { say(bad.length ? `No units recognised. Check: ${bad.slice(0, 3).join(', ')}` : 'Paste an army list first.', true); return; }
    if (replace) ARMY.clear();
    let capped = 0;
    for (const [n, q] of out) {
      const r = byName(n); let nq = (ARMY.get(n) || 0) + q;
      if (isUnique(r) && nq > 1) { nq = 1; capped++; }
      ARMY.set(n, nq);
    }
    draw(); syncDlgAdd();
    const parts = [`Imported ${d3.sum([...out.values()])} card(s).`];
    if (capped) parts.push(`${capped} unique card(s) kept at 1.`);
    if (bad.length) parts.push(`Not recognised: ${bad.join(', ')}`);
    say(parts.join(' '), bad.length > 0);
  }
  root.querySelector('.hs-import').addEventListener('click', () => doImport(true));
  root.querySelector('.hs-import-add').addEventListener('click', () => doImport(false));


  // bonds-with control
  const bwEl = root.querySelector('.hs-bw'), bwInfo = root.querySelector('.hs-bwinfo');
  bwEl.addEventListener('change', () => { state.bw = bwEl.value || null; draw(); });
  const bwDirBtns = root.querySelectorAll('.hs-bwdir [data-bwdir]');
  bwDirBtns.forEach((b) => b.addEventListener('click', () => { state.bwdir = b.dataset.bwdir; draw(); }));
  function drawBw(rows) {
    const sorted = UNITS.slice().sort((a, b) => a.unit.localeCompare(b.unit));
    bwEl.replaceChildren(new Option('Any unit', ''), ...sorted.map((u) => new Option(u.unit, u.unit)));
    bwEl.value = state.bw || '';
    bwDirBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bwdir === (state.bwdir || 'in'))));
    if (!state.bw) { bwInfo.hidden = true; return; }
    const x = UNITS.find((u) => u.unit === state.bw);
    const outs = rows.filter((r) => bondRel(r)?.out).map((r) => r.unit), ins = rows.filter((r) => bondRel(r)?.inn).map((r) => r.unit);
    bwInfo.replaceChildren();
    const line = (label, list) => { const d = mk('div'); d.append(mk('b', '', label), document.createTextNode(list.length ? list.join(', ') : 'none with the current filters')); bwInfo.appendChild(d); };
    const d = state.bwdir || 'in';
    if (d !== 'out') line(`Can activate or move ${x.unit} (${ins.length}): `, ins);
    if (d !== 'in') line(x.bonding ? `${x.unit} can activate or move (${outs.length}): ` : `${x.unit} has no bonding ability. `, outs);
    bwInfo.hidden = false;
  }


  // ---------- horizontal scrolling ----------
  const scBox = root.querySelector('.hs-scroll'), top = root.querySelector('.hs-topscroll'), topIn = top.firstElementChild;
  let syncing = false;
  top.addEventListener('scroll', () => { if (syncing) { syncing = false; return; } syncing = true; scBox.scrollLeft = top.scrollLeft; });
  scBox.addEventListener('scroll', () => { if (syncing) { syncing = false; return; } syncing = true; top.scrollLeft = scBox.scrollLeft; });
  const sizeTop = () => { topIn.style.width = scBox.scrollWidth + 'px'; };
  root.querySelector('.hs-left').addEventListener('click', () => scBox.scrollBy({ left: -scBox.clientWidth * 0.7, behavior: 'smooth' }));
  root.querySelector('.hs-right').addEventListener('click', () => scBox.scrollBy({ left: scBox.clientWidth * 0.7, behavior: 'smooth' }));


  // ---------- card picture views ----------
  state.layout = 'table';
  const layoutBtns = root.querySelectorAll('.hs-layout [data-layout]');
  layoutBtns.forEach((b) => b.addEventListener('click', () => { state.layout = b.dataset.layout; draw(); }));
  const armyPics = root.querySelector('.hs-armypics');
  armyPics.addEventListener('change', () => draw());
  // a card picture is its own small file (data/cards/<name>.jpg, written by the build), or an embedded jpeg
  const CARD_IMG = /^(data:image\/jpeg;base64,|data\/cards\/[\w-]+\.jpg$)/;
  function imgFor(unit) {
    const C = dash.data('cards');
    if (C.status !== 'ok') return null;
    const row = C.data.find((x) => x.unit === unit);
    return row && CARD_IMG.test(row.img) ? row.img : null;
  }
  function gcard(r, opts) {
    const d = mk('div', 'hs-gcard'); d.setAttribute('data-key', r.unit); d.tabIndex = 0;
    const src = imgFor(r.unit);
    if (src) { const im = document.createElement('img'); im.loading = 'lazy'; im.alt = r.unit + ' army card'; im.src = src; d.appendChild(im); }
    else d.appendChild(mk('div', 'noimg', dash.data('cards').status === 'ok' ? 'No picture' : 'Loading picture…'));
    const cap = mk('div', 'cap');
    if (opts.rank) cap.appendChild(mk('span', 'rk', String(opts.rank)));
    cap.appendChild(mk('span', 'nm', r.unit));
    if (opts.val) { const v = mk('span', 'val'); v.append(document.createTextNode(opts.val[0] + ' '), mk('b', '', opts.val[1])); cap.appendChild(v); }
    if (opts.add) cap.appendChild(addBtn(r));
    d.appendChild(cap);
    if (opts.qty) d.appendChild(mk('span', 'qty', '×' + opts.qty));
    d.addEventListener('click', () => openCard(r));
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCard(r); });
    return d;
  }
  function drawGallery(rows) {
    const pics = state.layout === 'pics';
    layoutBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout)));
    const g = root.querySelector('#rankings .hs-gallery');
    g.hidden = !pics;
    root.querySelector('#rankings .hs-scroll').hidden = pics;
    root.querySelector('#rankings .hs-hbar').style.display = pics ? 'none' : '';
    if (!pics) { g.replaceChildren(); return; }
    const col = COLS.find((c) => c.key === state.sort.key);
    g.replaceChildren(...rows.map((r, i) => gcard(r, { rank: i + 1, add: true, val: col && !col.text ? [col.label, fmt(r[col.field(state.mode)])] : [String(r.points), 'pts'] })));
  }
  function drawArmyGallery() {
    const g = root.querySelector('.a-gallery');
    g.hidden = !armyPics.checked;
    if (!armyPics.checked) { g.replaceChildren(); return; }
    const items = [...ARMY.entries()].map(([n, q]) => ({ r: byName(n), q })).filter((x) => x.r);
    g.replaceChildren(...items.map((x) => gcard(x.r, { qty: x.q, val: [String(x.q * x.r.points), 'pts'] })));
  }


  // ---------- total formula ----------
  const wEls = root.querySelectorAll('.hs-w');
  const fmtW = (v) => String(Math.round(v * 1000) / 1000);
  wEls.forEach((el) => el.addEventListener('input', () => {
    const v = el.value.trim(); if (v === '') return;
    const n = Number(v); if (!Number.isFinite(n) || n < 0) return;
    state.w[el.dataset.w] = n; draw();
  }));
  wEls.forEach((el) => el.addEventListener('blur', () => draw()));
  root.querySelector('.hs-wreset').addEventListener('click', () => { state.w = { ...W0 }; draw(); });
  function formulaText() { return `${fmtW(state.w.a)} × attack + ${fmtW(state.w.d)} × defense + ${fmtW(state.w.l)} × life`; }
  function drawFormula() {
    wEls.forEach((el) => { if (document.activeElement !== el) el.value = fmtW(state.w[el.dataset.w]); });
    const take = document.getElementById('takeaway');
    if (!take) return;
    const pool = UNITS.filter((r) => Number(r.points) >= 50);
    const best = pool.length ? pool.reduce((a, b) => (b._tot100_s > a._tot100_s ? b : a)) : null;
    take.querySelector('.tk-u').textContent = best ? best.unit : '—';
    take.querySelector('.tk-v').textContent = best ? fmt(best._tot100_s) : '—';
    take.querySelector('.tk-f').textContent = formulaText();
    take.querySelectorAll('.dash-skeleton').forEach((m) => { if (best) m.classList.remove('dash-skeleton'); });
  }


  // ---------- dice odds ----------
  const binom = (n, p) => { const out = []; let c = 1; for (let k = 0; k <= n; k++) { if (k > 0) c = c * (n - k + 1) / k; out.push(c * Math.pow(p, k) * Math.pow(1 - p, n - k)); } return out; };
  const PS = 1 / 2, PD = 1 / 3;
  function woundDist(a, d) {
    const A = binom(a, PS), D = binom(d, PD), W = new Array(a + 1).fill(0);
    A.forEach((pa, k) => D.forEach((pd, j) => { W[Math.max(0, k - j)] += pa * pd; }));
    return W;
  }
  const pct = (v) => (v * 100 < 1 && v > 0 ? '<1' : Math.round(v * 100)) + '%';
  let VS_MODE = null;
  const dua = root.querySelector('.hs-dua'), dud = root.querySelector('.hs-dud'), daEl = root.querySelector('.hs-da'), ddEl = root.querySelector('.hs-dd');
  const clampDice = (v) => Math.max(0, Math.min(20, Math.round(Number(v) || 0)));
  daEl.addEventListener('input', () => { dua.value = ''; drawDice(); });
  ddEl.addEventListener('input', () => { dud.value = ''; drawDice(); });
  dua.addEventListener('change', () => { const r = UNITS.find((u) => u.unit === dua.value); if (r) daEl.value = clampDice(r[MODES[state.mode].atk]); drawDice(); });
  dud.addEventListener('change', () => { const r = UNITS.find((u) => u.unit === dud.value); if (r) ddEl.value = clampDice(r[MODES[state.mode].def]); drawDice(); });
  function diceBars(box, n, p, label) {
    box.replaceChildren();
    const W = Math.max(260, box.clientWidth), H = 260, m = { t: 14, r: 10, b: 36, l: 34 };
    const data = d3.range(1, n + 1).map((k) => ({ k, mean: k * p, sd: Math.sqrt(k * p * (1 - p)) }));
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleBand(data.map((d) => d.k), [m.l, W - m.r]).padding(0.25);
    const ys = d3.scaleLinear([0, d3.max(data, (d) => d.mean + d.sd)], [H - m.b, m.t]).nice();
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(xs).tickSize(0)).call(axisStyle);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(ys).ticks(5).tickSize(-(W - m.l - m.r))).call(axisStyle);
    svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(label);
    const g = svg.append('g').selectAll('g').data(data).join('g')
      .on('mousemove', (ev, d) => showTip(box, ev, `${d.k} ${d.k === 1 ? 'die' : 'dice'}`, [`Average ${f1(d.mean)}`, `Usually ${f1(Math.max(0, d.mean - d.sd))}–${f1(d.mean + d.sd)}`]))
      .on('mouseleave', () => hideTip(box));
    g.append('rect').attr('x', (d) => xs(d.k)).attr('width', xs.bandwidth()).attr('y', (d) => ys(d.mean)).attr('height', (d) => ys(0) - ys(d.mean)).attr('rx', 4).attr('fill', VIOLET);
    g.append('line').attr('x1', (d) => xs(d.k) + xs.bandwidth() / 2).attr('x2', (d) => xs(d.k) + xs.bandwidth() / 2).attr('y1', (d) => ys(Math.max(0, d.mean - d.sd))).attr('y2', (d) => ys(d.mean + d.sd)).attr('stroke', 'var(--color-fg)').attr('stroke-width', 1.5).attr('stroke-opacity', 0.6);
    g.append('text').attr('x', (d) => xs(d.k) + xs.bandwidth() / 2).attr('y', (d) => ys(d.mean + d.sd) - 4).attr('text-anchor', 'middle').attr('class', 'lbl').text((d) => f1(d.mean));
  }
  function drawDice() {
    const avgOn = root.querySelector('.hs-avgon').checked;
    root.querySelector('.hs-avggrid').hidden = !avgOn;
    if (state.page === 'charts') {
      if (avgOn) { diceBars(root.querySelector('#dice-atk .hs-chart'), 10, PS, 'Attack dice'); diceBars(root.querySelector('#dice-def .hs-chart'), 10, PD, 'Defense dice'); drawOdds(); }
      return;
    }
    if (state.page !== 'fight') return;
    // unit pickers
    for (const sel of [dua, dud]) {
      if (sel.options.length !== UNITS.length + 1) {
        const v = sel.value;
        sel.replaceChildren(new Option('— pick a unit —', ''), ...UNITS.slice().sort((a, b) => a.unit.localeCompare(b.unit)).map((u) => new Option(u.unit, u.unit)));
        sel.value = v;
      }
    }
    if (VS_MODE !== state.mode) {
      VS_MODE = state.mode;
      const ra = UNITS.find((u) => u.unit === dua.value), rd = UNITS.find((u) => u.unit === dud.value);
      if (ra) daEl.value = clampDice(ra[MODES[state.mode].atk]);
      if (rd) ddEl.value = clampDice(rd[MODES[state.mode].def]);
    }
    const a = clampDice(daEl.value), d = clampDice(ddEl.value);
    const W = woundDist(a, d), ew = d3.sum(W, (p, i) => p * i);
    const atLeast = (k) => d3.sum(W.slice(k));
    const tiles = root.querySelector('#dice-vs .hs-dstat');
    const tile = (big, small) => { const t = mk('div', 'hs-tile'); t.append(mk('b', '', big), document.createTextNode(small)); return t; };
    tiles.replaceChildren(tile(f1(ew), 'average wounds'), tile(pct(atLeast(1)), 'at least 1 wound'), tile(pct(atLeast(2)), 'at least 2 wounds'), tile(f1(a * PS) + ' vs ' + f1(d * PD), 'avg skulls vs shields'));
    // wound distribution chart
    const box = root.querySelector('.hs-dvchart'); box.replaceChildren();
    const data = W.map((p, k) => ({ k, p })).filter((x, i) => i <= Math.max(1, a));
    const Wd = Math.max(260, box.clientWidth), H = 220, m = { t: 16, r: 10, b: 34, l: 38 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${Wd} ${H}`);
    const xs = d3.scaleBand(data.map((x) => x.k), [m.l, Wd - m.r]).padding(0.2);
    const ys = d3.scaleLinear([0, Math.max(0.01, d3.max(data, (x) => x.p))], [H - m.b, m.t]).nice();
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(xs).tickSize(0)).call(axisStyle);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(ys).ticks(4).tickFormat(d3.format('.0%')).tickSize(-(Wd - m.l - m.r))).call(axisStyle);
    svg.append('text').attr('x', (m.l + Wd - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text('Wounds dealt');
    const g = svg.append('g').selectAll('g').data(data).join('g')
      .on('mousemove', (ev, x) => showTip(box, ev, `${x.k} wound${x.k === 1 ? '' : 's'}`, [pct(x.p) + ' chance'])).on('mouseleave', () => hideTip(box));
    g.append('rect').attr('x', (x) => xs(x.k)).attr('width', xs.bandwidth()).attr('y', (x) => ys(x.p)).attr('height', (x) => ys(0) - ys(x.p)).attr('rx', 4).attr('fill', (x) => x.k === 0 ? 'var(--cds-chart-muted)' : VIOLET);
    g.append('text').attr('class', 'lbl').attr('x', (x) => xs(x.k) + xs.bandwidth() / 2).attr('y', (x) => ys(x.p) - 4).attr('text-anchor', 'middle').text((x) => pct(x.p));
    // matrix
    const tb = root.querySelector('.hs-mx'); tb.replaceChildren();
    const hr = tb.createTHead().insertRow(); hr.appendChild(mk('th', '', 'Atk \\ Def'));
    for (let j = 1; j <= 10; j++) hr.appendChild(mk('th', '', String(j)));
    const body = tb.createTBody();
    for (let i = 1; i <= 10; i++) {
      const tr = body.insertRow(); tr.appendChild(mk('th', '', String(i)));
      for (let j = 1; j <= 10; j++) {
        const p = 1 - woundDist(i, j)[0];
        const td = mk('td', i === a && j === d ? 'sel' : '', pct(p));
        td.style.background = `color-mix(in srgb, ${VIOLET} ${Math.round(p * 85)}%, transparent)`;
        td.style.color = p > 0.6 ? '#fff' : '';
        td.style.cursor = 'pointer';
        td.title = `${i} attack vs ${j} defense: ${pct(p)} chance of at least 1 wound, ${f1(d3.sum(woundDist(i, j), (q, k) => q * k))} average wounds`;
        td.addEventListener('click', () => { daEl.value = i; ddEl.value = j; dua.value = ''; dud.value = ''; drawDice(); });
        tr.appendChild(td);
      }
    }
  }


  root.querySelector('.hs-avgon').addEventListener('change', () => drawDice());
  // ---------- fight to the finish ----------
  const sides = { A: root.querySelector('.hs-side[data-side="A"]'), B: root.querySelector('.hs-side[data-side="B"]') };
  let FIRST = 'A', DUEL_KEY = '', DUEL_RES = null, NF = 1000000, DUEL_MODE = null, SIM_TOKEN = 0;
  const nfBtns = root.querySelectorAll('.hs-nf [data-n]');
  nfBtns.forEach((b) => b.addEventListener('click', () => { NF = Number(b.dataset.n); drawDuel(true); }));
  const firstBtns = root.querySelectorAll('.hs-first [data-first]');
  firstBtns.forEach((b) => b.addEventListener('click', () => { FIRST = b.dataset.first; drawDuel(true); }));
  function fillSide(sd, r) {
    const F = MODES[state.mode], box = sides[sd];
    const set = (k, v) => { box.querySelector(`[data-k="${k}"]`).value = v; };
    set('atk', clampDice(r[F.atk])); set('def', clampDice(r[F.def])); set('life', Math.max(1, Number(r.life) || 1));
    set('figs', r.unit === 'Crimson Twins' ? 1 : Math.max(1, Number(r.figures) || 1));
  }
  for (const sd of ['A', 'B']) {
    sides[sd].querySelector('.hs-du').addEventListener('change', () => { sides[sd].querySelector('[data-k="copies"]').value = 1; });
    sides[sd].querySelector('.hs-bu').addEventListener('change', () => { sides[sd].querySelector('[data-b="copies"]').value = 1; });
    const sel = sides[sd].querySelector('.hs-du');
    sel.addEventListener('change', () => { const r = UNITS.find((u) => u.unit === sel.value); if (r) fillSide(sd, r); drawDuel(true); });
    sides[sd].querySelectorAll('input[data-k]').forEach((el) => el.addEventListener('input', () => { if (el.dataset.k !== 'copies') sel.value = ''; drawDuel(true); }));
    const bon = sides[sd].querySelector('.hs-bondon'), bu = sides[sd].querySelector('.hs-bu');
    bon.addEventListener('change', () => drawDuel(true));
    bu.addEventListener('change', () => { const r = UNITS.find((u) => u.unit === bu.value); if (r) fillBond(sd, r); drawDuel(true); });
    sides[sd].querySelectorAll('input[data-b]').forEach((el) => el.addEventListener('input', () => { if (el.dataset.b !== 'copies') bu.value = ''; drawDuel(true); }));
  }
  root.querySelector('.hs-rerun').addEventListener('click', () => drawDuel(true));
  root.querySelector('.hs-swapsides').addEventListener('click', () => {
    const snap = (sd) => ({ v: [...sides[sd].querySelectorAll('input[data-k], input[data-b]')].map((e) => e.value), du: sides[sd].querySelector('.hs-du').value, on: sides[sd].querySelector('.hs-bondon').checked, bu: sides[sd].querySelector('.hs-bu').value, opts: [...sides[sd].querySelector('.hs-bu').options].map((o) => [o.text, o.value]) });
    const put = (sd, x) => {
      [...sides[sd].querySelectorAll('input[data-k], input[data-b]')].forEach((e, i) => { e.value = x.v[i]; });
      sides[sd].querySelector('.hs-du').value = x.du; sides[sd].querySelector('.hs-bondon').checked = x.on;
      const bu = sides[sd].querySelector('.hs-bu'); bu.replaceChildren(...x.opts.map(([t, v]) => new Option(t, v))); bu.value = x.bu;
    };
    const a = snap('A'), b = snap('B'); put('A', b); put('B', a);
    if (typeof MODS !== 'undefined') {
      const t = MODS.A; MODS.A = MODS.B; MODS.B = t; MODS.height = MODS.height === 'A' ? 'B' : MODS.height === 'B' ? 'A' : '';
      const ms = (sd) => { const bx = mside(sd); return [bx.querySelector('.hs-msa').checked, bx.querySelector('.hs-mglyph').value, bx.querySelector('.hs-mxa').value, bx.querySelector('.hs-mxd').value]; };
      const mp = (sd, v) => { const bx = mside(sd); bx.querySelector('.hs-msa').checked = v[0]; bx.querySelector('.hs-mglyph').value = v[1]; bx.querySelector('.hs-mxa').value = v[2]; bx.querySelector('.hs-mxd').value = v[3]; };
      const va = ms('A'), vb = ms('B'); mp('A', vb); mp('B', va);
    }
    if (FIRST !== 'R') FIRST = FIRST === 'A' ? 'B' : 'A';
    drawDuel(true);
  });
  function readSide(sd) {
    const g = (k, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(sides[sd].querySelector(`[data-k="${k}"]`).value) || 0)));
    const cp = sides[sd].querySelector('[data-k="copies"]').closest('.hs-copies').hidden ? 1 : g('copies', 1, 8);
    return { atk: g('atk', 0, 20), def: g('def', 0, 20), life: g('life', 1, 20), figs: g('figs', 1, 12) * cp };
  }
  function readBond(sd) {
    if (!sides[sd].querySelector('.hs-bondon').checked) return null;
    const el = (k) => sides[sd].querySelector(`[data-b="${k}"]`);
    if (el('atk').value === '') return null;
    const g = (k, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(el(k).value) || 0)));
    const cp = el('copies').closest('.hs-copies').hidden ? 1 : g('copies', 1, 8);
    return { atk: g('atk', 0, 20), def: g('def', 0, 20), life: g('life', 1, 20), figs: g('figs', 1, 12) * cp };
  }
  const isCommon = (r) => !!r && String(r.ctype || '').startsWith('Common');
  function syncCopies(sd) {
    const box = sides[sd];
    const m = UNITS.find((u) => u.unit === box.querySelector('.hs-du').value), b = UNITS.find((u) => u.unit === box.querySelector('.hs-bu').value);
    const cm = box.querySelector('[data-k="copies"]').closest('.hs-copies'), cb = box.querySelector('[data-b="copies"]').closest('.hs-copies');
    cm.hidden = !isCommon(m); cb.hidden = !isCommon(b);
    cm.firstChild.textContent = m && /Hero$/.test(m.ctype) ? 'Cards in army' : 'Squads in army';
    cb.firstChild.textContent = b && /Hero$/.test(b.ctype) ? 'Cards in army' : 'Squads in army';
  }
  function fillBond(sd, r) {
    const F = MODES[state.mode], box = sides[sd];
    const set = (k, v) => { box.querySelector(`[data-b="${k}"]`).value = v; };
    set('atk', clampDice(r[F.atk])); set('def', clampDice(r[F.def])); set('life', Math.max(1, Number(r.life) || 1));
    set('figs', r.unit === 'Crimson Twins' ? 1 : Math.max(1, Number(r.figures) || 1));
  }
  function drawBondUI(sd) {
    const box = sides[sd], on = box.querySelector('.hs-bondon').checked, wrap = box.querySelector('.hs-bonded');
    wrap.hidden = !on;
    if (!on) return;
    const main = UNITS.find((u) => u.unit === box.querySelector('.hs-du').value);
    const bu = box.querySelector('.hs-bu'), note = box.querySelector('.hs-bnote');
    const list = main ? UNITS.filter((r) => canBond(main, r) || canBond(r, main)).sort((a, b) => a.unit.localeCompare(b.unit)) : UNITS.slice().sort((a, b) => a.unit.localeCompare(b.unit));
    const keep = bu.value;
    bu.replaceChildren(new Option(list.length ? '— pick a bonded unit —' : '— none —', ''), ...list.map((r) => new Option(`${r.unit} (${r.points})`, r.unit)));
    bu.value = list.some((r) => r.unit === keep) ? keep : '';
    if (keep && !bu.value) box.querySelectorAll('input[data-b]').forEach((e) => { e.value = ''; });
    if (!main) note.textContent = 'No unit picked above, so every unit is listed.';
    else if (!list.length) note.textContent = `No units bond with ${main.unit}. You can still type numbers in by hand.`;
    else {
      const r = UNITS.find((u) => u.unit === bu.value);
      note.textContent = r ? (canBond(main, r) && canBond(r, main) ? 'These two can activate or move each other.' : canBond(main, r) ? `${main.unit} can activate or move ${r.unit}.` : `${r.unit} can activate or move ${main.unit}.`) + ' Both attack every turn.' : `${list.length} units bond with ${main.unit}.`;
    }
  }
  const roll = (n, p) => { let c = 0; for (let i = 0; i < n; i++) if (Math.random() < p) c++; return c; };
  // fast dice: one random number per roll, using precomputed odds
  const CDF = { };
  const cdf = (n, p) => { const k = n + ':' + p; if (!CDF[k]) { const b = binom(n, p); let c = 0; CDF[k] = b.map((x) => (c += x)); } return CDF[k]; };
  const draw1 = (c) => { const u = Math.random(); let k = 0; while (k < c.length - 1 && u > c[k]) k++; return k; };
  function oneFight(A, B, first, R, M) {
    const mm = (sd) => (M && M[sd]) || { atk: 0, def: 0, edef: 0, reroll: false, skull: false, special: false, tox: false, shield: false };
    // Heroscape rounds: each side takes 3 turns; initiative (d20 roll) decides who goes first each round.
    // "Once per round" abilities (incl. revealing an X marker) refresh at the start of every round.
    const ST = { A: { tox: -1, sh: -1 }, B: { tox: -1, sh: -1 } };
    const h = M ? M.height : '';
    const mkSide = (groups, sd) => { const me = mm(sd), en = mm(sd === 'A' ? 'B' : 'A');
      return groups.map((g) => { const an = Math.max(0, g.atk + me.atk + (h === sd && !me.special ? 1 : 0)), dn = Math.max(0, g.def + me.def + (h === sd ? 1 : 0) - en.edef);
        return { an, atk: cdf(an, PS), def: cdf(dn, PD), life: g.life, alive: g.figs, cur: g.life, squad: !!g.squad }; }); };
    const S = { A: mkSide(A, 'A'), B: mkSide(B, 'B') };
    const alive = (side) => { for (const g of side) if (g.alive > 0) return true; return false; };
    let round = 0, done = false, turnsTaken = 0;
    while (!done && round < 70) {
      const lead = first === 'R' ? (Math.random() < 0.5 ? 'A' : 'B') : first;
      for (let t = 0; t < 6; t++) {
        const turn = t % 2 === 0 ? lead : (lead === 'A' ? 'B' : 'A'), other = turn === 'A' ? 'B' : 'A';
        const at = S[turn], df = S[other], me = mm(turn), them = mm(other), sMe = ST[turn], sThem = ST[other];
        let rerollLeft = me.reroll, skullLeft = me.skull;
        for (const g of at) {
          const n = g.alive; // only figures alive at the start of this turn attack
          for (let f = 0; f < n; f++) {
            let tg = null; for (const x of df) if (x.alive > 0) { tg = x; break; }
            if (!tg) break;
            let sk = draw1(g.atk);
            if (rerollLeft && g.squad && sk < g.an) { sk += draw1(cdf(g.an - sk, PS)); rerollLeft = false; }
            if (skullLeft) { sk += 1; skullLeft = false; }
            let shields = draw1(tg.def);
            if (them.shield && sk > 0 && sThem.sh !== round) { shields += 1; sThem.sh = round; }
            let w = sk - shields;
            if (w > 0 && me.tox && sMe.tox !== round) { w += 1; sMe.tox = round; }
            if (w > 0) { tg.cur -= w; if (tg.cur <= 0) { tg.alive--; tg.cur = tg.life; } }
          }
        }
        turnsTaken++;
        if (!alive(S.A) || !alive(S.B)) { done = true; break; }
      }
      round++;
    }
    const half = round * 6;
    const r = round;
    const left = (side) => side.reduce((t, g) => t + (g.alive > 0 ? (g.alive - 1) * g.life + g.cur : 0), 0);
    const figsLeft = (side) => side.reduce((t, g) => t + Math.max(0, g.alive), 0);
    const inc = (h, k) => { h[k] = (h[k] || 0) + 1; };
    if (alive(S.A) !== alive(S.B)) inc(R.hT, turnsTaken);
    if (!alive(S.B)) { R.winA++; inc(R.hRA, r); inc(R.hLA, left(S.A)); inc(R.hFA, figsLeft(S.A)); if (R.log) R.log.push(['a', r]); }
    else if (!alive(S.A)) { R.winB++; inc(R.hRB, r); inc(R.hLB, left(S.B)); inc(R.hFB, figsLeft(S.B)); if (R.log) R.log.push(['b', r]); }
    else { R.stall++; if (R.log) R.log.push(['s', r]); }
  }
  function runSim(A, B, first, N, onTick, onDone, M) {
    const token = ++SIM_TOKEN;
    const R = { N, done: 0, winA: 0, winB: 0, stall: 0, hRA: [], hRB: [], hLA: [], hLB: [], hFA: [], hFB: [], hT: [], log: N <= 100 ? [] : null, A, B };
    const step = () => {
      if (token !== SIM_TOKEN) return;
      const t0 = performance.now();
      while (R.done < N && performance.now() - t0 < 35) { for (let i = 0; i < 200 && R.done < N; i++) { oneFight(A, B, first, R, M); R.done++; } }
      if (R.done < N) { onTick(R); setTimeout(step, 0); } else onDone(R);
    };
    step();
  }
  const hSum = (h) => h.reduce((t, c) => t + (c || 0), 0);
  const hMean = (h) => { let n = 0, s = 0; h.forEach((c, k) => { if (c) { n += c; s += c * k; } }); return n ? s / n : NaN; };
  const hMax = (h) => { let m = 0; h.forEach((c, k) => { if (c) m = k; }); return m; };
  const hQuant = (h, q) => { const n = hSum(h); let c = 0; for (let k = 0; k < h.length; k++) { c += h[k] || 0; if (c >= q * n) return k; } return hMax(h); };
  function sideName(sd) {
    const cpOf = (sel) => { const el = sides[sd].querySelector(sel); return el.closest('.hs-copies').hidden ? 1 : Math.max(1, Math.round(Number(el.value) || 1)); };
    const c1 = cpOf('[data-k="copies"]'), m = (c1 > 1 ? c1 + '× ' : '') + (sides[sd].querySelector('.hs-du').value || 'Side ' + sd);
    if (!readBond(sd)) return m;
    const c2 = cpOf('[data-b="copies"]');
    return m + ' + ' + (c2 > 1 ? c2 + '× ' : '') + (sides[sd].querySelector('.hs-bu').value || 'bonded unit');
  }
  function drawDuel(force) {
    if (state.page !== 'fight') return;
    for (const sd of ['A', 'B']) {
      const sel = sides[sd].querySelector('.hs-du');
      if (sel.options.length !== UNITS.length + 1) {
        const v = sel.value;
        sel.replaceChildren(new Option('— pick a unit —', ''), ...UNITS.slice().sort((a, b) => a.unit.localeCompare(b.unit)).map((u) => new Option(`${u.unit} (${u.points})`, u.unit)));
        sel.value = v;
        if (!v && !sides[sd].querySelector('[data-k="atk"]').value) { const r = UNITS.find((u) => u.unit === (sd === 'A' ? 'Snake Eyes' : 'Zartan')) || UNITS[sd === 'A' ? 0 : 1]; if (r) { sel.value = r.unit; fillSide(sd, r); } }
      }
    }
    if (DUEL_MODE !== state.mode) {
      DUEL_MODE = state.mode;
      for (const sd of ['A', 'B']) {
        const r = UNITS.find((u) => u.unit === sides[sd].querySelector('.hs-du').value); if (r) fillSide(sd, r);
        const b = UNITS.find((u) => u.unit === sides[sd].querySelector('.hs-bu').value); if (b) fillBond(sd, b);
      }
    }
    firstBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.first === FIRST)));
    nfBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === NF)));
    root.querySelector('.hs-nfights').textContent = NF >= 1e6 ? '1,000,000' : d3.format(',')(NF);
    drawBondUI('A'); drawBondUI('B'); syncCopies('A'); syncCopies('B');
    const A = [readSide('A'), readBond('A')].filter(Boolean), B = [readSide('B'), readBond('B')].filter(Boolean);
    const sq = (sd, sel) => { const r = UNITS.find((u) => u.unit === sides[sd].querySelector(sel).value); return r ? /Squad$/.test(r.ctype) : false; };
    A[0].squad = sq('A', '.hs-du'); if (A[1]) A[1].squad = sq('A', '.hs-bu');
    B[0].squad = sq('B', '.hs-du'); if (B[1]) B[1].squad = sq('B', '.hs-bu');
    drawMods();
    const M = MODS.on ? { height: MODS.height, A: readMods('A'), B: readMods('B') } : null;
    const key = JSON.stringify([A, B, FIRST, NF, M]);
    if (force || key !== DUEL_KEY || !DUEL_RES) {
      DUEL_KEY = key;
      const prog = root.querySelector('.hs-progress');
      runSim(A, B, FIRST, NF, (R) => { prog.hidden = false; prog.textContent = `Running… ${Math.round(R.done / R.N * 100)}% of ${d3.format(',')(R.N)} fights`; renderDuel(R, true); },
        (R) => { prog.hidden = true; DUEL_RES = R; renderDuel(R, false); }, M);
      return;
    }
    renderDuel(DUEL_RES, false);
  }
  function renderDuel(R, partial) {
    const n = R.done || R.N, nA = sideName('A'), nB = sideName('B');
    const hR = []; for (let k = 0; k < Math.max(R.hRA.length, R.hRB.length); k++) hR[k] = (R.hRA[k] || 0) + (R.hRB[k] || 0);
    const tiles = root.querySelector('.hs-duel-tiles');
    const tile = (big, small, color, kind) => { const t = mk('div', 'hs-tile' + (kind && !partial ? ' click' : '')); const b = mk('b', '', big); if (color) b.style.color = color; t.append(b, document.createTextNode(small)); if (kind && !partial) { t.tabIndex = 0; t.setAttribute('role', 'button'); t.addEventListener('click', () => openGraph(kind)); t.addEventListener('keydown', (e) => { if (e.key === 'Enter') openGraph(kind); }); } return t; };
    tiles.replaceChildren(
      tile(pct(R.winA / n), `${nA} survives`, '#8b5cf6', 'leftA'),
      tile(pct(R.winB / n), `${nB} survives`, '#f59e0b', 'leftB'),
      tile(f1(hMean(hR)), 'average rounds', null, 'rounds'),
      tile(f1(hMean(R.hT)), 'average turns (both sides)', null, 'turns'),
      tile(R.winA ? f1(hMean(R.hRA)) : '—', `rounds when ${nA} wins`, null, R.winA ? 'roundsA' : null),
      tile(R.winB ? f1(hMean(R.hRB)) : '—', `rounds when ${nB} wins`, null, R.winB ? 'roundsB' : null),
      ...(R.stall / n > 0.0005 ? [tile(pct(R.stall / n), 'no winner after 70 rounds')] : []));
    root.querySelector('.hs-winbar .wa').style.width = (R.winA / n * 100) + '%';
    root.querySelector('.hs-winbar .wb').style.width = (R.winB / n * 100) + '%';
    const dots = root.querySelector('.hs-dots');
    dots.hidden = !R.log || partial;
    const note = dots.previousElementSibling && dots.previousElementSibling.classList.contains('hs-dotnote') ? dots.previousElementSibling : null;
    if (R.log && !partial) {
      dots.replaceChildren(...R.log.map(([w, r], i) => { const d = mk('span', w, String(r)); d.title = `Fight ${i + 1}: ${w === 'a' ? nA : w === 'b' ? nB : 'no'} wins in ${r} round${r === 1 ? '' : 's'}`; return d; }));
      const nn = note || mk('p', 'hs-dotnote', ''); if (!note) dots.before(nn);
      nn.textContent = `Each dot is one fight, colored by the winner, with the number of rounds it took. ${nA}: ${R.winA} wins, ${nB}: ${R.winB} wins.`; nn.hidden = false;
    } else if (note) note.hidden = true;
  }
  // ---------- graph pop-ups ----------
  const gdlg = document.querySelector('dialog.hs-gdlg');
  gdlg.querySelector('.hs-gx').addEventListener('click', () => gdlg.close());
  gdlg.addEventListener('click', (e) => { if (e.target === gdlg) gdlg.close(); });
  function histChart(box, series, xLabel, total, fmtK) {
    box.replaceChildren();
    const maxK = Math.max(...series.map((s) => hMax(s.h)));
    const cut = Math.max(series.reduce((m, s) => Math.max(m, hQuant(s.h, 0.995)), 0), Math.min(maxK, 10));
    const ks = d3.range(series[0].from ?? 1, cut + 1);
    const bins = ks.map((k) => ({ k, v: series.map((s) => (k === cut ? d3.sum(s.h.slice(k)) : (s.h[k] || 0)) / total) }));
    const W = Math.max(280, box.clientWidth), H = 260, m = { t: 12, r: 10, b: 36, l: 42 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleBand(ks, [m.l, W - m.r]).padding(0.15);
    const ys = d3.scaleLinear([0, d3.max(bins, (b) => d3.sum(b.v)) || 0.01], [H - m.b, m.t]).nice();
    const step = Math.ceil(ks.length / Math.max(4, Math.floor((W - m.l) / 32)));
    const lab = (k) => (k === cut && cut < maxK ? k + '+' : (fmtK ? fmtK(k) : k));
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(xs).tickSize(0).tickValues(ks.filter((k, i) => i % step === 0)).tickFormat(lab)).call(axisStyle);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(ys).ticks(4).tickFormat(d3.format('.0%')).tickSize(-(W - m.l - m.r))).call(axisStyle);
    svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(xLabel);
    const g = svg.append('g').selectAll('g').data(bins).join('g')
      .on('mousemove', (ev, b) => showTip(box, ev, `${xLabel.split(' (')[0]}: ${lab(b.k)}`, series.map((s, i) => `${s.name}: ${pct(b.v[i])}`)))
      .on('mouseleave', () => hideTip(box));
    series.forEach((s, i) => {
      g.append('rect').attr('x', (b) => xs(b.k)).attr('width', xs.bandwidth())
        .attr('y', (b) => ys(d3.sum(b.v.slice(0, i + 1)))).attr('height', (b) => ys(d3.sum(b.v.slice(0, i))) - ys(d3.sum(b.v.slice(0, i + 1))))
        .attr('fill', s.color);
    });
  }
  function openGraph(kind) {
    const R = DUEL_RES; if (!R) return;
    const nA = sideName('A'), nB = sideName('B'), n = R.N;
    const t = gdlg.querySelector('#gdlg-t'), note = gdlg.querySelector('.hs-gnote'), box = gdlg.querySelector('.hs-gchart');
    if (!gdlg.open) gdlg.showModal();
    const lifeTot = (G) => d3.sum(G, (g) => g.life * g.figs), figTot = (G) => d3.sum(G, (g) => g.figs);
    if (kind === 'leftA' || kind === 'leftB') {
      const sd = kind === 'leftA' ? 'A' : 'B', nm = sd === 'A' ? nA : nB, G = R[sd], wins = sd === 'A' ? R.winA : R.winB;
      const multi = figTot(G) > 1;
      t.textContent = `How much of ${nm} survives`;
      note.textContent = `${pct(wins / n)} of fights end with ${nm} still standing. ` + (multi ? `Bars show how many of its ${figTot(G)} figures are left when it wins.` : `Bars show how much of its ${lifeTot(G)} life is left when it wins.`) + ' Losses are not shown.';
      histChart(box, [{ name: nm, h: multi ? (sd === 'A' ? R.hFA : R.hFB) : (sd === 'A' ? R.hLA : R.hLB), color: sd === 'A' ? '#8b5cf6' : '#f59e0b' }], multi ? 'Figures left (share of all fights)' : 'Life left (share of all fights)', n);
    } else if (kind === 'turns') {
      t.textContent = 'How many turns fights last';
      note.textContent = 'Total turns taken by both sides together before one side is wiped out. A round has up to 6 turns (3 per side).';
      histChart(box, [{ name: 'All fights', h: R.hT, color: '#8b5cf6' }], 'Turns (both sides together)', n);
    } else if (kind === 'rounds') {
      t.textContent = 'How long fights last';
      note.textContent = 'Share of all fights that end in each round, split by winner. In each round both sides take 3 turns.';
      histChart(box, [{ name: nA + ' wins', h: R.hRA, color: '#8b5cf6' }, { name: nB + ' wins', h: R.hRB, color: '#f59e0b' }], 'Rounds (each side takes 3 turns per round)', n);
    } else {
      const sd = kind === 'roundsA' ? 'A' : 'B', nm = sd === 'A' ? nA : nB, h = sd === 'A' ? R.hRA : R.hRB, wins = sd === 'A' ? R.winA : R.winB;
      t.textContent = `How long it takes ${nm} to win`;
      note.textContent = `Only the ${d3.format(',')(wins)} fights ${nm} won. Bars show the share of those wins that took each number of rounds; average ${f1(hMean(h))}.`;
      histChart(box, [{ name: nm, h, color: sd === 'A' ? '#8b5cf6' : '#f59e0b' }], 'Rounds (each side takes 3 turns per round)', wins);
    }
  }


  // ---------- advanced modifiers ----------
  const AURAS = [
    { id: 'brutality', name: 'Brutality Aura', src: 'Loviatäk the Kyrie Warrior', txt: 'squad figures re-roll missed attack dice, once per turn (melee)', reroll: 1 },
    { id: 'onslaught', name: 'Onslaught Aura', src: 'Taelord the Kyrie Warrior (2.0)', txt: '+1 skull on one attack per turn (melee)', skull: 1 },
    { id: 'cruelty', name: 'Cruelty for Its Own Sake', src: 'Serpentor', txt: 'enemy −1 defense (adjacent)', edef: 1 },
    { id: 'terrifying', name: 'Terrifying Aura', src: 'Raelin the Kyrie Warrior (4.0)', txt: 'enemy −1 defense (within 4)', edef: 1 },
    { id: 'radioactive', name: 'Radioactive', src: 'Kaijaax', txt: 'enemy −1 defense (within 2)', edef: 1 },
    { id: 'dancing', name: 'Dancing Lights', src: 'Seelie Courtiers', txt: 'enemy −1 defense (adjacent)', edef: 1 },
    { id: 'intimidate', name: 'Intimidate', src: 'Bok-Bur-Na', txt: 'enemy −1 defense vs Captains/Pirates', edef: 1 },
    { id: 'meleeaura', name: 'Melee Attack Aura 1', src: 'Sir Gilbert', txt: '+1 attack (adjacent range-1 figures)', atk: 1 },
    { id: 'leadby', name: 'Lead By Example', src: 'Duke', txt: '+1 attack (G.I. JOE / Soldier within 2)', atk: 1 },
    { id: 'bleakewoode', name: 'Might of Bleakewoode', src: 'Concan the Kyrie Warrior (2.0)', txt: '+1 attack (Jandar)', atk: 1 },
    { id: 'piratecmd', name: 'Pirate Commander', src: 'Crimson Widow', txt: '+1 attack (Pirates vs adjacent)', atk: 1 },
    { id: 'bladedance', name: 'Blade Dance', src: 'Elites of Ullar', txt: '+1 attack die (Unique Ullar Kyrie)', atk: 1 },
    { id: 'nanotoxin', name: 'Nanotoxin Coating', src: 'Destro’s Tech Glyph', txt: '+1 wound after an attack that wounds, once per round', tox: 1 },
    { id: 'nanite', name: 'Nanite Shielding', src: 'Destro’s Tech Glyph', txt: '+1 automatic shield when the enemy rolls at least 1 skull, once per round', shield: 1 },
    { id: 'vigilance', name: 'Vigilance of Nastralund', src: 'Concan the Kyrie Warrior (2.0)', txt: '+1 defense (Utgar)', def: 1 },
    { id: 'tactical', name: 'Tactical Acumen', src: 'Flint', txt: '+1 defense with height advantage', def: 1 },
  ];
  const MODS = { on: false, height: '', A: { auras: [] }, B: { auras: [] } };
  const modOn = root.querySelector('.hs-modon'), modBox = root.querySelector('.hs-mods');
  const mside = (sd) => root.querySelector(`.hs-modside[data-side="${sd}"]`);
  modOn.addEventListener('change', () => { MODS.on = modOn.checked; modBox.hidden = !modOn.checked; drawDuel(); });
  root.querySelectorAll('.hs-mheight [data-h]').forEach((b) => b.addEventListener('click', () => { MODS.height = b.dataset.h; drawDuel(); }));
  for (const sd of ['A', 'B']) {
    const box = mside(sd), sel = box.querySelector('.hs-maura');
    sel.replaceChildren(new Option('— pick an aura to add —', ''), ...AURAS.map((a) => new Option(`${a.name} (${a.src}): ${a.txt}`, a.id)));
    sel.addEventListener('change', () => { if (sel.value && !MODS[sd].auras.includes(sel.value)) MODS[sd].auras.push(sel.value); sel.value = ''; drawDuel(); });
    box.querySelectorAll('input, select.hs-mglyph').forEach((el) => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => drawDuel()));
  }
  function readMods(sd) {
    const box = mside(sd), n = (c) => Math.max(-5, Math.min(10, Math.round(Number(box.querySelector(c).value) || 0)));
    const g = box.querySelector('.hs-mglyph').value, au = MODS[sd].auras.map((id) => AURAS.find((a) => a.id === id)).filter(Boolean);
    return {
      atk: n('.hs-mxa') + (g === 'astrid' ? 1 : 0) + d3.sum(au, (a) => a.atk || 0),
      def: n('.hs-mxd') + (g === 'gerda' ? 1 : 0) + d3.sum(au, (a) => a.def || 0),
      edef: d3.sum(au, (a) => a.edef || 0), reroll: au.some((a) => a.reroll), skull: au.some((a) => a.skull),
      tox: au.some((a) => a.tox), shield: au.some((a) => a.shield),
      special: box.querySelector('.hs-msa').checked,
    };
  }
  function drawMods() {
    root.querySelectorAll('.hs-mheight [data-h]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.h === MODS.height)));
    for (const sd of ['A', 'B']) {
      const chips = mside(sd).querySelector('.hs-mchips');
      chips.replaceChildren(...MODS[sd].auras.map((id) => {
        const a = AURAS.find((x) => x.id === id), c = mk('button', 'hs-mchip', `${a.name} ×`);
        c.type = 'button'; c.title = `${a.src}: ${a.txt}. Click to remove.`;
        c.addEventListener('click', () => { MODS[sd].auras = MODS[sd].auras.filter((x) => x !== id); drawDuel(); });
        return c;
      }));
    }
    const sum = root.querySelector('.hs-msum');
    if (!MODS.on) { sum.textContent = ''; return; }
    const part = (sd) => { const m = readMods(sd), o = [];
      const ha = MODS.height === sd, en = MODS.height && MODS.height !== sd;
      const a = m.atk + (ha && !m.special ? 1 : 0), d = m.def + (ha ? 1 : 0);
      if (a) o.push(`${a > 0 ? '+' : ''}${a} attack`); if (d) o.push(`${d > 0 ? '+' : ''}${d} defense`);
      if (m.edef) o.push(`enemy −${m.edef} defense`); if (m.reroll) o.push('squad re-roll once per turn'); if (m.skull) o.push('+1 skull once per turn');
      if (m.tox) o.push('Nanotoxin +1 wound once per round'); if (m.shield) o.push('Nanite +1 shield once per round');
      return `Side ${sd}: ${o.length ? o.join(', ') : 'no changes'}`; };
    sum.textContent = `${part('A')}. ${part('B')}. Auras apply to the whole side, so only add them when their condition (range, class, adjacency) would hold.`;
  }


  // ---------- odds tables ----------
  let ODDMODE = 'atleast';
  root.querySelectorAll('.hs-oddmode [data-om]').forEach((b) => b.addEventListener('click', () => { ODDMODE = b.dataset.om; drawOdds(); }));
  function drawOdds() {
    root.querySelectorAll('.hs-oddmode [data-om]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.om === ODDMODE)));
    for (const tb of root.querySelectorAll('.hs-oddtab')) {
      const isAtk = tb.dataset.p === 'atk', p = isAtk ? PS : PD, word = isAtk ? 'skull' : 'shield', dieWord = isAtk ? 'attack' : 'defense';
      tb.replaceChildren();
      const hr = tb.createTHead().insertRow(); hr.appendChild(mk('th', '', 'Dice'));
      for (let k = 0; k <= 10; k++) hr.appendChild(mk('th', '', (ODDMODE === 'atleast' ? '≥' : '') + k));
      const body = tb.createTBody();
      for (let n = 1; n <= 10; n++) {
        const tr = body.insertRow(); tr.appendChild(mk('th', '', String(n)));
        const b = binom(n, p);
        for (let k = 0; k <= 10; k++) {
          const v = k > n ? 0 : (ODDMODE === 'atleast' ? d3.sum(b.slice(k)) : b[k]);
          const td = mk('td', '', k > n ? '' : pct(v));
          if (k <= n) {
            td.style.background = `color-mix(in srgb, ${isAtk ? '#e5484d' : '#3b82f6'} ${Math.round(v * 85)}%, transparent)`;
            td.style.color = v > 0.6 ? '#fff' : '';
            td.title = `${n} ${dieWord} ${n === 1 ? 'die' : 'dice'}: ${pct(v)} chance of ${ODDMODE === 'atleast' ? 'at least' : 'exactly'} ${k} ${word}${k === 1 ? '' : 's'}`;
          }
          tr.appendChild(td);
        }
      }
    }
  }

  // ---------- charts ----------
  const tipOf = (box) => { let t = box.querySelector('.hs-tip'); if (!t) { t = mk('div', 'hs-tip'); t.hidden = true; box.appendChild(t); } return t; };
  function showTip(box, ev, title, lines) {
    const t = tipOf(box); t.replaceChildren(mk('div', 't', title), ...lines.map((l) => mk('div', '', l))); t.hidden = false;
    const b = box.getBoundingClientRect(); let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
    const w = t.offsetWidth, h = t.offsetHeight;
    if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
    if (y + h > b.height) y = Math.max(0, ev.clientY - b.top - h - 12);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  const hideTip = (box) => { const t = box.querySelector('.hs-tip'); if (t) t.hidden = true; };
  function fields() {
    const F = MODES[state.mode], raw = state.view === 'raw';
    return raw ? { x: F.atk, y: F.def, tot: F.tot, xl: 'Attack', yl: 'Defense', tl: 'Total (weighted)' }
               : { x: F.atk100, y: F.def100, tot: F.tot100, xl: 'Attack per 100 pts', yl: 'Defense per 100 pts', tl: 'Total per 100 points (weighted)' };
  }
  const MODE_NAME = () => ({ printed: 'printed', specials: 'with specials', conditional: 'with conditional' }[state.mode]);
  function axisStyle(g) { g.attr('font-size', null).attr('font-family', null); g.selectAll('.domain').attr('stroke', 'var(--cds-chart-axis)'); g.selectAll('.tick line').attr('stroke', 'var(--cds-chart-grid)'); }
  function scatter(box, rows, xf, yf, xl, yl, rf) {
    box.replaceChildren();
    const W = Math.max(280, box.clientWidth), H = 320, m = { t: 10, r: 14, b: 40, l: 44 };
    if (!rows.length) { box.appendChild(mk('div', 'hs-empty', 'No units match the filters.')); return; }
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleLinear([0, d3.max(rows, (r) => +r[xf]) * 1.05 || 1], [m.l, W - m.r]).nice();
    const ys = d3.scaleLinear([0, d3.max(rows, (r) => +r[yf]) * 1.05 || 1], [H - m.b, m.t]).nice();
    const rs = d3.scaleSqrt([0, d3.max(rows, (r) => +r[rf || 'points']) || 1], [2, 8]);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(xs).ticks(Math.max(3, Math.floor(W / 80))).tickSize(-(H - m.t - m.b))).call(axisStyle);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(ys).ticks(6).tickSize(-(W - m.l - m.r))).call(axisStyle);
    svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(xl);
    svg.append('text').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(yl);
    const ARMYRED = '#f59e0b';
    const inArmy = (r) => ARMY.has(r.unit), anyArmy = rows.some(inArmy);
    const ordered = rows.slice().sort((a, b) => inArmy(a) - inArmy(b)); // army dots drawn last = on top
    svg.append('g').selectAll('circle').data(ordered).join('circle')
      .attr('cx', (r) => xs(+r[xf])).attr('cy', (r) => ys(+r[yf])).attr('r', (r) => rs(+r[rf || 'points']) + (inArmy(r) ? 3 : 0))
      .attr('fill', (r) => inArmy(r) ? ARMYRED : VIOLET)
      .attr('fill-opacity', (r) => inArmy(r) ? 1 : 0.65)
      .attr('stroke', (r) => inArmy(r) ? 'var(--color-fg)' : 'var(--color-bg)').attr('stroke-width', (r) => inArmy(r) ? 2 : 1)
      .style('cursor', 'pointer')
      .on('mousemove', (ev, r) => showTip(box, ev, r.unit + (inArmy(r) ? ' (in your army)' : ''), [`${xl}: ${fmt(r[xf])}`, `${yl}: ${fmt(r[yf])}`, `${r.points} points`]))
      .on('mouseleave', () => hideTip(box)).on('click', (ev, r) => openCard(r));
  }
  function hbars(box, data, lab, val, fmtv, onClick) {
    box.replaceChildren();
    if (!data.length) { box.appendChild(mk('div', 'hs-empty', 'No units match the filters.')); return; }
    const W = Math.max(280, box.clientWidth), bh = 18, gap = 6, m = { t: 6, r: 44, b: 22 };
    const H = m.t + m.b + data.length * (bh + gap);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const probe = svg.append('text').attr('class', 'lbl');
    let lw = 0; for (const d of data) { probe.text(lab(d)); lw = Math.max(lw, probe.node().getComputedTextLength()); }
    probe.remove();
    const left = Math.min(lw + 10, W * 0.5);
    const xs = d3.scaleLinear([0, d3.max(data, val) || 1], [left, W - m.r]);
    const ys = d3.scaleBand(data.map(lab), [m.t, H - m.b]).paddingInner(gap / (bh + gap));
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(xs).ticks(Math.max(3, Math.floor((W - left) / 70))).tickSize(-(H - m.t - m.b))).call(axisStyle);
    const g = svg.append('g').selectAll('g').data(data).join('g').style('cursor', 'pointer')
      .on('mousemove', (ev, d) => showTip(box, ev, lab(d), [fmtv(val(d))])).on('mouseleave', () => hideTip(box)).on('click', (ev, d) => onClick && onClick(d));
    g.append('rect').attr('x', left).attr('y', (d) => ys(lab(d))).attr('height', ys.bandwidth()).attr('width', (d) => Math.max(1, xs(val(d)) - left)).attr('rx', 4)
      .attr('fill', (d) => d.unit && ARMY.has(d.unit) ? '#f59e0b' : VIOLET).attr('stroke', (d) => d.unit && ARMY.has(d.unit) ? 'var(--color-fg)' : 'none').attr('stroke-width', 1.5);
    g.append('text').attr('class', 'lbl').attr('x', left - 6).attr('y', (d) => ys(lab(d)) + ys.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .text((d) => { let t = lab(d); return t; }).each(function () { let t = this.textContent; while (this.getComputedTextLength() > left - 10 && t.length > 4) { t = t.slice(0, -2); this.textContent = t + '…'; } });
    g.append('text').attr('x', (d) => xs(val(d)) + 4).attr('y', (d) => ys(lab(d)) + ys.bandwidth() / 2).attr('dy', '0.35em').text((d) => fmtv(val(d)));
  }
  function drawCharts(rows) {
    const F = fields(), mn = MODE_NAME();
    const card = (id) => document.getElementById(id);
    card('chart-scatter').querySelector('.ct').textContent = `${F.xl.replace(' pts', ' points')} vs ${F.yl.toLowerCase().replace(' pts', ' points')} (${mn})`;
    scatter(card('chart-scatter').querySelector('.hs-chart'), rows, F.x, F.y, F.xl, F.yl);
    card('chart-top').querySelector('.ct').textContent = `Top 15: ${F.tl.toLowerCase()} (${mn})`;
    const top = rows.slice().sort((a, b) => b[F.tot] - a[F.tot]).slice(0, 15);
    hbars(card('chart-top').querySelector('.hs-chart'), top, (d) => d.unit, (d) => +d[F.tot], (v) => f1(v), (d) => openCard(d));
    card('chart-faction').querySelector('.ct').textContent = `Average ${F.tl.toLowerCase()} by faction (${mn})`;
    const fac = d3.rollups(rows, (v) => ({ v: d3.mean(v, (r) => +r[F.tot]), n: v.length }), (r) => r.faction).map(([k, o]) => ({ faction: k, v: o.v, n: o.n })).sort((a, b) => b.v - a.v);
    hbars(card('chart-faction').querySelector('.hs-chart'), fac, (d) => `${d.faction} (${d.n})`, (d) => d.v, (v) => f1(v), (d) => { state.f.faction = d.faction; showPage('rankings', true); });
    card('chart-points').querySelector('.ct').textContent = `Points cost vs ${F.tl.toLowerCase()} (${mn})`;
    scatter(card('chart-points').querySelector('.hs-chart'), rows, 'points', F.tot, 'Points', F.tl, 'figures');
  }

  segBtns.forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; draw(); }));
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    if (state.view === b.dataset.view) return;
    state.view = b.dataset.view;
    const k = SWAP[state.view][state.sort.key];
    if (k) state.sort.key = k;
    draw();
  }));
  qEl.addEventListener('input', () => { state.q = qEl.value.trim(); draw(); });
  const num = (el) => { const v = el.value.trim(); if (v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  minEl.addEventListener('input', () => { const n = num(minEl); if (n !== undefined) { state.min = n; draw(); } });
  maxEl.addEventListener('input', () => { const n = num(maxEl); if (n !== undefined) { state.max = n; draw(); } });
  [minEl, maxEl].forEach((el) => el.addEventListener('blur', () => draw()));
  for (const k of FILTERS) root.querySelector(`select[data-f="${k}"]`).addEventListener('change', (e) => { state.f[k] = e.target.value || null; draw(); });
  root.querySelector('.hs-reset').addEventListener('click', () => { defaults(); qEl.value = ''; draw(); });


  const advOn = root.querySelector('.hs-advon'), advBox = root.querySelector('.hs-adv');
  advOn.addEventListener('change', () => { advBox.hidden = !advOn.checked; });
  const aAdvOn = root.querySelector('.a-advon'), aAdvBox = root.querySelector('.a-adv');
  aAdvOn.addEventListener('change', () => { aAdvBox.hidden = !aAdvOn.checked; });
  root.style.setProperty('--hs-accent', VIOLET);
  // ---------- collection, saving and loading ----------
  // Everything here lives in the viewer's own browser (localStorage) and in backup files they
  // download themselves. Nothing is sent to any server.
  const STORE_KEY = 'heroscape-tracker:data:v1', PREF_KEY = 'heroscape-tracker:remember';
  const COLL = new Map(); // unit -> { owned, want, note }
  let LAST_BACKUP = null, LAST_SAVED = '';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } };
  let REMEMBER = lsGet(PREF_KEY) !== 'off';
  // Other features register their saved data here so it goes into backups and browser storage.
  // Each: { key, get() -> plain data, clean(raw) -> safe value or throws, apply(value|null, merge) }
  const SAVED = [];
  const registerSaved = (m) => { SAVED.push(m); };
  const ON_ERASE = []; // extra browser storage (like a kept rulebook) to clear on erase

  const ownedOf = (n) => (COLL.get(n) || {}).owned || 0;
  const wantOf = (n) => !!(COLL.get(n) || {}).want;
  function ownMatch(r, f) {
    if (f === 'owned') return ownedOf(r.unit) > 0;
    if (f === 'missing') return ownedOf(r.unit) === 0;
    if (f === 'want') return wantOf(r.unit);
    return true;
  }
  function setColl(n, patch) {
    const c = { owned: 0, want: false, note: '', ...(COLL.get(n) || {}), ...patch };
    c.owned = Math.max(0, Math.min(99, Math.round(Number(c.owned) || 0)));
    if (!c.owned && !c.want && !c.note) COLL.delete(n); else COLL.set(n, c);
  }

  // ---------- snapshot / restore ----------
  function snapshot() {
    return {
      app: 'heroscape-tracker', format: 1, saved: new Date().toISOString(),
      armies: ARMIES.map((a) => ({ name: a.name, units: Object.fromEntries(a.map), ...(a.note ? { note: a.note } : {}), ...(a.folder ? { folder: a.folder } : {}), ...(a.limit != null ? { limit: a.limit } : {}), ...(a.era ? { era: a.era } : {}) })),
      folders: FOLDERS.slice(), armySort: ARMY_SORT,
      current: CUR,
      pointLimit: POINT_DEFAULT,
      collection: Object.fromEntries([...COLL].map(([n, c]) => [n, { owned: c.owned, want: c.want, note: c.note }])),
      settings: { weights: { ...state.w }, mode: state.mode, view: state.view, lastBackup: LAST_BACKUP },
      ...Object.fromEntries(SAVED.map((m) => [m.key, m.get()]))
    };
  }
  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
  const noteStr = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').slice(0, max); // keeps line breaks
  const cnt = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  function clean(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('This is not a Heroscape Tracker backup.');
    if (o.app !== 'heroscape-tracker') throw new Error('This file was not made by Heroscape Tracker.');
    const armies = (Array.isArray(o.armies) ? o.armies : []).slice(0, 200).map((a, i) => {
      const map = new Map();
      if (a && a.units && typeof a.units === 'object') for (const [n, q] of Object.entries(a.units).slice(0, 500)) { const k = cnt(q, 99); if (k) map.set(str(n, 120), k); }
      return { name: str(a && a.name, 40).trim() || 'Army ' + (i + 1), map, note: noteStr(a && a.note, 1000).trim(), folder: str(a && a.folder, 40).trim(), limit: a && a.limit != null ? cnt(a.limit, 9999) : undefined, era: a && ['now', 'classic', 'all'].includes(a.era) ? a.era : undefined };
    });
    // folders: the saved list, plus any folder an army names that the list is missing
    const folders = [];
    for (const f of [...(Array.isArray(o.folders) ? o.folders : []), ...armies.map((a) => a.folder)]) { const t = str(f, 40).trim(); if (t && !folders.includes(t) && folders.length < 100) folders.push(t); }
    for (const a of armies) if (!folders.includes(a.folder)) a.folder = '';
    const coll = new Map();
    if (o.collection && typeof o.collection === 'object') for (const [n, c] of Object.entries(o.collection).slice(0, 2000)) {
      if (!c || typeof c !== 'object') continue;
      const v = { owned: cnt(c.owned, 99), want: !!c.want, note: noteStr(c.note, 1000) };
      if (v.owned || v.want || v.note) coll.set(str(n, 120), v);
    }
    const s = o.settings && typeof o.settings === 'object' ? o.settings : {};
    const w = s.weights && typeof s.weights === 'object' ? s.weights : null;
    const mods = {};
    for (const m of SAVED) if (o[m.key] !== undefined && o[m.key] !== null) { try { mods[m.key] = m.clean(o[m.key]); } catch (e) { /* skip a damaged section */ } }
    return {
      mods, armies, coll, folders, armySort: ['', 'name', 'hi', 'lo'].includes(o.armySort) ? o.armySort : '', current: cnt(o.current, 199), pointLimit: o.pointLimit == null ? null : cnt(o.pointLimit, 9999),
      weights: w && ['a', 'd', 'l'].every((k) => Number.isFinite(Number(w[k])) && Number(w[k]) >= 0) ? { a: +w.a, d: +w.d, l: +w.l } : null,
      mode: MODES[s.mode] ? s.mode : null, view: ['per', 'raw'].includes(s.view) ? s.view : null,
      lastBackup: typeof s.lastBackup === 'string' ? str(s.lastBackup, 40) : null
    };
  }
  function restore(c, merge) {
    if (!merge) {
      ARMIES.splice(0, ARMIES.length, ...(c.armies.length ? c.armies : [{ name: 'Army 1', map: new Map() }]));
      COLL.clear(); for (const [n, v] of c.coll) COLL.set(n, v);
      CUR = Math.min(c.current, ARMIES.length - 1);
      FOLDERS = (c.folders || []).slice(); ARMY_SORT = c.armySort || '';
      if (c.pointLimit !== null) POINT_DEFAULT = c.pointLimit;
      if (c.weights) state.w = c.weights;
      if (c.mode) state.mode = c.mode;
      if (c.view) state.view = c.view;
      if (c.lastBackup) LAST_BACKUP = c.lastBackup;
    } else {
      const onlyEmpty = ARMIES.length === 1 && !ARMIES[0].map.size;
      if (onlyEmpty && c.armies.length) ARMIES.length = 0;
      for (const a of c.armies) {
        let nm = a.name; while (ARMIES.some((x) => x.name === nm)) nm = (nm + ' (imported)').slice(0, 40);
        if (ARMIES.some((x) => x.name === nm)) nm = nextName();
        ARMIES.push({ name: nm, map: a.map, note: a.note, folder: a.folder, limit: a.limit, era: a.era });
      }
      for (const f of c.folders || []) if (!FOLDERS.includes(f) && FOLDERS.length < 100) FOLDERS.push(f);
      for (const [n, v] of c.coll) {
        const cur = COLL.get(n) || { owned: 0, want: false, note: '' };
        COLL.set(n, { owned: Math.max(cur.owned, v.owned), want: cur.want || v.want, note: cur.note || v.note });
      }
      CUR = Math.min(CUR, ARMIES.length - 1);
    }
    ARMY = ARMIES[CUR].map;
    CMP = [0, Math.min(1, ARMIES.length - 1)];
    for (const m of SAVED) { const v = (c.mods || {})[m.key]; if (v !== undefined) m.apply(v, merge); else if (!merge) m.apply(null, false); }
  }
  function persist() {
    if (typeof badgeCheckSoon === 'function') badgeCheckSoon(); // every change can earn an achievement
    if (!REMEMBER) return;
    const s = JSON.stringify({ ...snapshot(), saved: undefined });
    if (s === LAST_SAVED) return true;
    if (!lsSet(STORE_KEY, s)) return false;
    LAST_SAVED = s; return true;
  }

  // ---------- collection page ----------
  const pickOwned = root.querySelector('.hs-pickowned');
  pickOwned.addEventListener('change', () => drawArmy());
  const ownSel = root.querySelector('.hs-own');
  ownSel.addEventListener('change', () => { state.own = ownSel.value; draw(); });
  const cShowBtns = root.querySelectorAll('.c-show [data-cs]');
  cShowBtns.forEach((b) => b.addEventListener('click', () => { state.cshow = b.dataset.cs; draw(); }));
  const cConfirm = root.querySelector('.c-confirm');
  let C_ROWS = [];
  root.querySelector('.c-allown').addEventListener('click', () => {
    const todo = C_ROWS.filter((r) => !ownedOf(r.unit));
    if (!todo.length) { cConfirm.textContent = 'Every card shown is already marked as owned.'; cConfirm.hidden = false; return; }
    cConfirm.replaceChildren(document.createTextNode(`Mark ${todo.length} card${todo.length === 1 ? '' : 's'} as owned (1 copy each)? `));
    const yes = mk('button', 'hs-btn', 'Yes, mark them'); yes.type = 'button';
    const no = mk('button', 'hs-btn', 'Cancel'); no.type = 'button';
    yes.addEventListener('click', () => { for (const r of todo) setColl(r.unit, { owned: 1 }); cConfirm.hidden = true; draw(); });
    no.addEventListener('click', () => { cConfirm.hidden = true; });
    cConfirm.append(yes, document.createTextNode(' '), no); cConfirm.hidden = false;
  });
  function stepper(n, onChange) {
    const w = mk('span', 'hs-q2'); const q = ownedOf(n);
    const m = mk('button', '', '−'); m.type = 'button'; m.disabled = !q; m.setAttribute('aria-label', 'One fewer ' + n);
    const p = mk('button', '', '+'); p.type = 'button'; p.setAttribute('aria-label', 'One more ' + n);
    m.addEventListener('click', (e) => { e.stopPropagation(); setColl(n, { owned: q - 1 }); onChange(); });
    p.addEventListener('click', (e) => { e.stopPropagation(); setColl(n, { owned: q + 1 }); onChange(); });
    w.append(m, mk('span', 'own-n' + (q ? '' : ' zero'), String(q)), p);
    return w;
  }
  function starBtn(n, onChange) {
    const on = wantOf(n);
    const b = mk('button', 'hs-star-btn' + (on ? ' on' : ''), on ? '★' : '☆'); b.type = 'button';
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', (on ? 'Remove ' : 'Add ') + n + (on ? ' from' : ' to') + ' wishlist');
    b.addEventListener('click', (e) => { e.stopPropagation(); setColl(n, { want: !on }); onChange(); });
    return b;
  }
  function collStats(list) {
    const own = list.filter((r) => ownedOf(r.unit) > 0);
    return {
      cards: own.length,
      copies: d3.sum(own, (r) => ownedOf(r.unit)),
      figs: d3.sum(own, (r) => ownedOf(r.unit) * Number(r.figures)),
      pts: d3.sum(own, (r) => ownedOf(r.unit) * Number(r.points)),
      want: list.filter((r) => wantOf(r.unit)).length
    };
  }
  function drawCollTab() {
    const n = UNITS.filter((r) => ownedOf(r.unit) > 0).length;
    root.querySelector('.hs-subtabs .nc').textContent = n ? String(n) : '';
    if (document.activeElement !== ownSel) ownSel.value = state.own || '';
  }
  function drawCollection(rows) {
    const S = collStats(UNITS);
    const set = (c, v) => { root.querySelector(c).textContent = v; };
    set('.c-cards', String(S.cards)); set('.c-total', String(UNITS.length));
    set('.c-pct', UNITS.length ? Math.round(S.cards / UNITS.length * 100) + '%' : '—');
    set('.c-copies', d3.format(',')(S.copies)); set('.c-figs', d3.format(',')(S.figs));
    set('.c-pts', d3.format(',')(S.pts)); set('.c-want', String(S.want));
    // faction progress
    const fac = d3.rollups(UNITS, (v) => ({ n: v.length, own: v.filter((r) => ownedOf(r.unit) > 0).length }), (r) => r.faction)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const fbox = root.querySelector('.c-fac'); fbox.replaceChildren();
    for (const [f, o] of fac) {
      const row = mk('button', 'c-facrow'); row.type = 'button'; row.title = 'Show only ' + f;
      row.addEventListener('click', () => { state.f.faction = state.f.faction === f ? null : f; draw(); });
      if (state.f.faction === f) row.classList.add('on');
      const bar = mk('span', 'c-bar'); const fill = mk('span', 'c-fill'); fill.style.width = (o.own / o.n * 100) + '%'; bar.appendChild(fill);
      row.append(mk('span', 'c-fn', f), bar, mk('span', 'c-fv', `${o.own} / ${o.n}`));
      fbox.appendChild(row);
    }
    // table
    cShowBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cs === (state.cshow || ''))));
    const list = rows.filter((r) => ownMatch(r, state.cshow)).sort((a, b) => a.unit.localeCompare(b.unit));
    C_ROWS = list;
    root.querySelector('.c-count').textContent = `${list.length} of ${UNITS.length} cards`;
    const tb = root.querySelector('.c-table tbody'); tb.replaceChildren();
    if (!list.length) {
      const tr = tb.insertRow(); const td = mk('td', 'l hs-empty', UNITS.length ? (state.cshow === 'owned' ? 'No owned cards match. Use + on a card to count it.' : state.cshow === 'want' ? 'Your wishlist is empty. Tap ☆ on a card to add it.' : 'No cards match the filters above.') : 'Loading cards…');
      td.colSpan = 8; tr.appendChild(td); return;
    }
    const redraw = () => draw();
    for (const r of list) {
      const tr = tb.insertRow(); if (ownedOf(r.unit)) tr.className = 'owned';
      const nm = mk('td', 'l nm', r.unit); nm.addEventListener('click', () => openCard(r)); tr.appendChild(nm);
      tr.appendChild(mk('td', 'l', r.faction));
      tr.appendChild(mk('td', 'l c-hide', r.ctype));
      tr.appendChild(mk('td', '', String(r.points)));
      tr.appendChild(mk('td', '', String(r.figures)));
      const oc = mk('td'); oc.appendChild(stepper(r.unit, redraw)); tr.appendChild(oc);
      const wc = mk('td'); wc.appendChild(starBtn(r.unit, redraw)); tr.appendChild(wc);
      const ncell = mk('td', 'l c-hide');
      const ni = document.createElement('input'); ni.type = 'text'; ni.className = 'c-note'; ni.maxLength = 1000; ni.placeholder = 'Add a note';
      ni.value = (COLL.get(r.unit) || {}).note || ''; ni.setAttribute('aria-label', 'Note for ' + r.unit);
      ni.addEventListener('change', () => { setColl(r.unit, { note: ni.value.trim() }); persist(); drawData(); });
      ncell.appendChild(ni); tr.appendChild(ncell);
    }
  }
  function drawOwnWarn(items) {
    const el = root.querySelector('.hs-ownwarn');
    if (!COLL.size || !items.length) { el.hidden = true; return; }
    const short = items.filter((x) => x.q > ownedOf(x.r.unit)).map((x) => `${x.r.unit} (need ${x.q}, own ${ownedOf(x.r.unit)})`);
    el.hidden = !short.length;
    el.textContent = short.length ? `Not enough in your collection: ${short.join('; ')}.` : '';
  }
  // collection controls in the card dialog
  const dOwnN = dlg.querySelector('.dlg-own-n'), dWant = dlg.querySelector('.dlg-want');
  function syncDlgOwn() {
    if (!DLG_UNIT) return;
    const q = ownedOf(DLG_UNIT.unit), w = wantOf(DLG_UNIT.unit);
    dOwnN.textContent = String(q);
    dlg.querySelector('.dlg-own-m').disabled = !q;
    dWant.textContent = w ? '★ On my wishlist' : '☆ Add to wishlist';
    dWant.setAttribute('aria-pressed', String(w));
  }
  dlg.querySelector('.dlg-own-m').addEventListener('click', () => { setColl(DLG_UNIT.unit, { owned: ownedOf(DLG_UNIT.unit) - 1 }); syncDlgOwn(); draw(); });
  dlg.querySelector('.dlg-own-p').addEventListener('click', () => { setColl(DLG_UNIT.unit, { owned: ownedOf(DLG_UNIT.unit) + 1 }); syncDlgOwn(); draw(); });
  dWant.addEventListener('click', () => { setColl(DLG_UNIT.unit, { want: !wantOf(DLG_UNIT.unit) }); syncDlgOwn(); draw(); });
  new MutationObserver(syncDlgOwn).observe(dlg.querySelector('#dlg-name'), { childList: true, characterData: true, subtree: true });

  // ---------- save & load page ----------
  const remEl = root.querySelector('.d-remember'), dText = root.querySelector('.d-text');
  const msg = (cls, t, bad) => { const el = root.querySelector(cls); el.textContent = t; el.classList.toggle('bad', !!bad); };
  function drawData() {
    remEl.checked = REMEMBER;
    const pill = root.querySelector('.privacy-pill');
    pill.classList.toggle('off', !REMEMBER);
    pill.querySelector('.pp-t').textContent = REMEMBER ? 'Your data stays on this device' : 'Not remembered: save a backup';
    root.querySelector('.d-remember-note').textContent = REMEMBER
      ? 'On: your data is kept in this browser’s own storage on this device, so it is here next time. Clearing your browser data removes it.'
      : 'Off: nothing is kept after you close this page. Save a backup file before you leave.';
    if (state.page !== 'data') return;
    root.querySelector('.d-armies').textContent = String(ARMIES.filter((a) => a.map.size).length);
    root.querySelector('.d-owned').textContent = String([...COLL.values()].filter((c) => c.owned).length);
    root.querySelector('.d-want').textContent = String([...COLL.values()].filter((c) => c.want).length);
    root.querySelector('.d-saved').textContent = LAST_BACKUP ? new Date(LAST_BACKUP).toLocaleDateString() : 'never';
  }
  remEl.addEventListener('change', () => {
    REMEMBER = remEl.checked;
    lsSet(PREF_KEY, REMEMBER ? 'on' : 'off');
    if (REMEMBER) { LAST_SAVED = ''; persist(); } else { lsDel(STORE_KEY); LAST_SAVED = ''; }
    drawData();
  });
  const backupText = () => JSON.stringify(snapshot(), null, 1);
  root.querySelector('.d-save').addEventListener('click', () => {
    LAST_BACKUP = new Date().toISOString();
    const text = backupText();
    const name = `heroscape-tracker-backup-${LAST_BACKUP.slice(0, 10)}.json`;
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      msg('.d-savemsg', `Saved ${name}. If nothing downloaded, use “Show as text” and copy it.`);
    } catch (e) { dText.value = text; msg('.d-savemsg', 'Your browser blocked the download. The backup is in the box below; copy it somewhere safe.', true); }
    draw();
  });
  root.querySelector('.d-showtext').addEventListener('click', async () => {
    LAST_BACKUP = new Date().toISOString();
    dText.value = backupText(); dText.focus(); dText.select();
    try { await navigator.clipboard.writeText(dText.value); msg('.d-savemsg', 'Backup text copied. Paste it into a note or file to keep it.'); }
    catch (e) { msg('.d-savemsg', 'Backup text is selected below. Copy it and keep it somewhere safe.'); }
    draw();
  });
  root.querySelector('.d-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 2e6) { msg('.d-loadmsg', 'That file is too big to be a backup (over 2 MB).', true); return; }
    const rd = new FileReader();
    rd.onload = () => { dText.value = String(rd.result || ''); msg('.d-loadmsg', `Read ${f.name}. Choose replace or merge.`); };
    rd.onerror = () => msg('.d-loadmsg', 'Could not read that file.', true);
    rd.readAsText(f);
  });
  function loadBackup(merge) {
    const t = dText.value.trim();
    if (!t) { msg('.d-loadmsg', 'Pick a backup file or paste its text first.', true); return; }
    let c;
    try { c = clean(JSON.parse(t)); } catch (e) { msg('.d-loadmsg', e instanceof SyntaxError ? 'That text is not a valid backup. Make sure you copied all of it.' : e.message, true); return; }
    restore(c, merge);
    const known = new Set(UNITS.map((u) => u.unit));
    const unknown = UNITS.length ? [...new Set([...c.coll.keys(), ...c.armies.flatMap((a) => [...a.map.keys()])])].filter((n) => !known.has(n)) : [];
    draw(); syncDlgAdd();
    const extra = SAVED.filter((m) => c.mods[m.key] !== undefined && m.label).map((m) => m.label);
    msg('.d-loadmsg', `${merge ? 'Merged' : 'Loaded'} ${c.armies.length} arm${c.armies.length === 1 ? 'y' : 'ies'}, ${c.coll.size} card collection entr${c.coll.size === 1 ? 'y' : 'ies'}` + (extra.length ? `, and your ${extra.join(', ')}` : '') + '.' + (unknown.length ? ` Not recognised: ${unknown.slice(0, 5).join(', ')}.` : ''), unknown.length > 0);
  }
  root.querySelector('.d-load-replace').addEventListener('click', () => loadBackup(false));
  root.querySelector('.d-load-merge').addEventListener('click', () => loadBackup(true));
  const eraseBox = root.querySelector('.d-erase-confirm');
  root.querySelector('.d-erase').addEventListener('click', () => { eraseBox.hidden = false; });
  root.querySelector('.d-erase-no').addEventListener('click', () => { eraseBox.hidden = true; });
  root.querySelector('.d-erase-yes').addEventListener('click', () => {
    eraseBox.hidden = true;
    restore({ mods: {}, armies: [], coll: new Map(), current: 0, pointLimit: 500, weights: { ...W0 }, mode: 'specials', view: 'per', lastBackup: null }, false);
    LAST_BACKUP = null; lsDel(STORE_KEY); lsDel(PREF_KEY); REMEMBER = true;
    for (const fn of ON_ERASE) fn();
    LAST_SAVED = JSON.stringify({ ...snapshot(), saved: undefined }); // nothing is written again until you change something
    draw(); syncDlgAdd();
    msg('.d-erasemsg', 'Erased. This browser no longer holds any of your data.');
  });
  // links and buttons that jump to a page
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]'); if (!g) return;
    e.preventDefault(); if (dlg.open) dlg.close(); showPage(g.dataset.goto, true); window.scrollTo(0, 0);
  });

  // ---------- a drawing in a card's notes ----------
  // one picture per unit, drawn on the pad under "Note on this card"; kept in this browser and in the backup file
  let NOTEPICS = {}; // unit -> PNG data URL
  const PIC_OK = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  registerSaved({
    key: 'notepics', label: 'card note drawings',
    get: () => ({ ...NOTEPICS }),
    clean: (o) => {
      const out = {};
      if (o && typeof o === 'object') for (const [n, v] of Object.entries(o).slice(0, 400)) if (typeof v === 'string' && v.length < 600000 && PIC_OK.test(v)) out[str(n, 120)] = v;
      return out;
    },
    apply: (v, merge) => { NOTEPICS = merge ? { ...(v || {}), ...NOTEPICS } : { ...(v || {}) }; }
  });
  function notePicOf(n) { return NOTEPICS[n] || ''; }
  const picC = dlg.querySelector('.dlg-picc'), picG = picC.getContext('2d');
  const picCol = dlg.querySelector('.dlg-pic-col'), picSize = dlg.querySelector('.dlg-pic-size');
  const PIC = { unit: '', tool: 'pen', undo: [] };
  try { picCol.value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || picCol.value; } catch (e) { /* keep the default */ }
  function notePicShow(n) {
    if (PIC.unit === n) return;
    PIC.unit = n; PIC.undo = [];
    picG.clearRect(0, 0, picC.width, picC.height);
    const src = NOTEPICS[n];
    if (src) { const im = new Image(); im.onload = () => { if (PIC.unit === n) picG.drawImage(im, 0, 0); }; im.src = src; }
  }
  function notePicSave() {
    const px = picG.getImageData(0, 0, picC.width, picC.height).data;
    let blank = true;
    for (let i = 3; i < px.length; i += 4) if (px[i]) { blank = false; break; }
    if (blank) delete NOTEPICS[PIC.unit]; else NOTEPICS[PIC.unit] = picC.toDataURL('image/png');
    persist(); syncNotes();
  }
  const picAt = (e) => { const b = picC.getBoundingClientRect(); return [(e.clientX - b.left) * picC.width / b.width, (e.clientY - b.top) * picC.height / b.height]; };
  let picLast = null;
  picC.addEventListener('pointerdown', (e) => {
    if (!PIC.unit) return;
    e.preventDefault(); picC.setPointerCapture(e.pointerId);
    PIC.undo.push(picG.getImageData(0, 0, picC.width, picC.height)); if (PIC.undo.length > 20) PIC.undo.shift();
    picLast = picAt(e);
    picG.globalCompositeOperation = PIC.tool === 'eraser' ? 'destination-out' : 'source-over';
    picG.strokeStyle = picG.fillStyle = picCol.value; picG.lineWidth = Number(picSize.value) * (PIC.tool === 'eraser' ? 2 : 1);
    picG.lineCap = picG.lineJoin = 'round';
    picG.beginPath(); picG.arc(picLast[0], picLast[1], picG.lineWidth / 2, 0, Math.PI * 2); picG.fill();
  });
  picC.addEventListener('pointermove', (e) => {
    if (!picLast) return;
    const p = picAt(e);
    picG.beginPath(); picG.moveTo(picLast[0], picLast[1]); picG.lineTo(p[0], p[1]); picG.stroke();
    picLast = p;
  });
  const picEnd = () => { if (!picLast) return; picLast = null; picG.globalCompositeOperation = 'source-over'; notePicSave(); };
  picC.addEventListener('pointerup', picEnd); picC.addEventListener('pointercancel', picEnd);
  dlg.querySelectorAll('.dlg-pic-tool button').forEach((b) => b.addEventListener('click', () => {
    PIC.tool = b.dataset.v; dlg.querySelectorAll('.dlg-pic-tool button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  dlg.querySelector('.dlg-pic-undo').addEventListener('click', () => { const s = PIC.undo.pop(); if (s) { picG.putImageData(s, 0, 0); notePicSave(); } });
  dlg.querySelector('.dlg-pic-clear').addEventListener('click', async () => {
    if (!NOTEPICS[PIC.unit] || !await ask({ title: 'Clear this drawing?', ok: 'Clear' })) return;
    PIC.undo.push(picG.getImageData(0, 0, picC.width, picC.height));
    picG.clearRect(0, 0, picC.width, picC.height); notePicSave();
  });

  // ---------- navigation: home index, side menu, and sibling pages ----------
  const SECTIONS = [
    ['cards', 'Armies & cards', [
      ['rankings', 'Rankings'],
      ['charts', 'Charts'],
      ['army', 'Army builder'],
      ['fight', 'Fight simulator'],
      ['random', 'Randomizer']]],
    ['collection', 'My collection', [
      ['collection', 'Army cards'],
      ['products', 'Products'],
      ['terrain', 'Terrain']]],
    ['maps', 'Maps', [
      ['maps', 'Tournament maps']]],
    ['play', 'Play', [
      ['tournament', 'Swiss tournament'],
      ['record', 'My record'],
      ['player', 'Player card']]],
    ['rules', 'Rules', [
      ['rules', 'Master rules']]],
    ['settings', 'Settings', [
      ['settings', 'Colors & custom cards'],
      ['data', 'Save & load']]]
  ];
  const GROUP_OF = {};
  for (const [g, , pages] of SECTIONS) for (const [id] of pages) GROUP_OF[id] = g;
  // data-ek / data-eorder / data-eitem let edit mode retype these names and reorder them (see edit.js)
  const gotoLink = (id, text, cls) => { const a = mk('a', cls || '', text); a.href = '#' + id; a.dataset.goto = id; a.dataset.ek = 'page:' + id; a.dataset.eitem = id; return a; };
  const secHead = (tag, cls, g, name) => { const h = mk(tag, cls, name); h.dataset.ek = 'sec:' + g; return h; };
  // home page index
  const homeIdx = root.querySelector('.home-index');
  homeIdx.dataset.eorder = 'sections';
  for (const [g, name, pages] of SECTIONS) {
    const c = mk('div', 'hs-card home-sec'); c.dataset.eitem = g;
    c.appendChild(secHead('h3', '', g, name));
    const ul = mk('ul', 'home-links'); ul.dataset.eorder = 'pages:' + g;
    for (const [id, t] of pages) { const li = mk('li'); li.dataset.eitem = id; const a = gotoLink(id, t); delete a.dataset.eitem; li.appendChild(a); ul.appendChild(li); }
    c.appendChild(ul); homeIdx.appendChild(c);
  }
  // side menu with the same links, from any page
  // the Android app serves this same site from its own address; it has no use for the APK download link
  if (location.hostname === 'appassets.androidplatform.net') root.querySelectorAll('.apk-link').forEach((x) => { x.hidden = true; });
  const menuBtn = root.querySelector('.menu-btn'), side = root.querySelector('.side-menu'), scrim = root.querySelector('.side-scrim');
  const sideList = side.querySelector('.side-list');
  sideList.dataset.eorder = 'sections';
  const homeLink = gotoLink('home', 'Home', 'side-home'); delete homeLink.dataset.eitem;
  sideList.appendChild(homeLink);
  for (const [gid, name, pages] of SECTIONS) {
    const g = mk('div', 'side-grp'); g.dataset.eitem = gid; g.dataset.eorder = 'pages:' + gid;
    g.appendChild(secHead('div', 'side-h', gid, name));
    for (const [id, t] of pages) g.appendChild(gotoLink(id, t));
    sideList.appendChild(g);
  }
  const ext = mk('div', 'side-grp'); ext.appendChild(mk('div', 'side-h', 'Elsewhere'));
  for (const [t, h] of [['Buy Heroscape at Renegade ↗', 'https://heroscape.renegadegamestudios.com/'], ['Play online at heroscape.org ↗', 'https://heroscape.org/ohs'], ['Forums ↗', 'https://www.heroscapers.com/']]) { const a = mk('a', '', t); a.href = h; a.target = '_blank'; a.rel = 'noopener noreferrer'; ext.appendChild(a); }
  sideList.appendChild(ext);
  function setMenu(open) {
    side.hidden = scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) (side.querySelector('[aria-current="page"]') || side.querySelector('a')).focus();
  }
  menuBtn.addEventListener('click', () => setMenu(side.hidden));
  scrim.addEventListener('click', () => setMenu(false));
  side.querySelector('.side-close').addEventListener('click', () => { setMenu(false); menuBtn.focus(); });
  side.addEventListener('click', (e) => { if (e.target.closest('[data-goto]')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !side.hidden) { setMenu(false); menuBtn.focus(); } });
  function syncNav(id) {
    const g = GROUP_OF[id];
    side.querySelectorAll('[data-goto]').forEach((a) => { if (a.dataset.goto === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const sub = root.querySelector('.hs-subtabs');
    root.querySelectorAll('.hs-subtabs [data-page]').forEach((b) => {
      b.hidden = b.dataset.group !== g;
      b.setAttribute('aria-current', String(b.dataset.page === id));
    });
    sub.classList.toggle('single', !g || root.querySelectorAll(`.hs-subtabs [data-group="${g}"]`).length < 2);
  }
  root.querySelectorAll('.hs-subtabs [data-page]').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.page, true)));
  syncNav('home');

  // shared helpers for the pages below
  // products and terrain types follow the era picked on the home page (RAW: everything, for what a visitor owns)
  const RAW = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const DATA = (id) => {
    const d = dash.data(id); if (d.status !== 'ok') return null;
    if (id === 'products') return d.data.filter(eraOk);
    if (id === 'terrain') return { ...d.data, types: d.data.types.filter(eraOk) };
    return d.data;
  };
  const esc = (s) => String(s == null ? '' : s);
  const btn = (text, cls, onClick, label) => { const b = mk('button', 'hs-btn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); if (onClick) b.addEventListener('click', onClick); return b; };
  const link = (text, href, cls) => { const a = mk('a', cls || '', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const segSync = (sel, attr, val) => root.querySelectorAll(sel + ' [data-' + attr + ']').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset[attr] || '') === (val || ''))));
  const segBind = (sel, attr, set) => root.querySelectorAll(sel + ' [data-' + attr + ']').forEach((b) => b.addEventListener('click', () => { set(b.dataset[attr] || ''); draw(); }));
  const pctTxt = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  function stepperN(value, onSet, label, max) {
    const w = mk('span', 'hs-q2');
    const m = mk('button', '', '−'); m.type = 'button'; m.disabled = value <= 0; m.setAttribute('aria-label', 'One fewer ' + label);
    const p = mk('button', '', '+'); p.type = 'button'; p.disabled = value >= (max || 99); p.setAttribute('aria-label', 'One more ' + label);
    m.addEventListener('click', (e) => { e.stopPropagation(); onSet(value - 1); });
    p.addEventListener('click', (e) => { e.stopPropagation(); onSet(value + 1); });
    w.append(m, mk('span', 'own-n' + (value ? '' : ' zero'), String(value)), p);
    return w;
  }
  function drawPages(rows) {
    const P = state.page;
    if (P === 'products') drawProducts();
    if (P === 'terrain') drawTerrain();
    if (P === 'maps') drawMaps();
    if (P === 'tournament') drawTournament();
    if (P === 'record') drawRecord();
    if (P === 'player') drawPlayer();
    if (P === 'settings') drawSettings();
    if (P === 'rules') drawRules();
    if (P === 'random') drawRandom(rows);
    if (P === 'home') drawHome();
    drawEdits();
    const np = Object.values(PROD_OWN).filter((n) => n > 0).length;
    root.querySelector('.hs-subtabs .np').textContent = np ? String(np) : '';
  }
  // ---------- eras and errata ----------
  // Which cards the whole site shows: contemporary (Renegade, the default), old school (Hasbro / Wizards of the Coast)
  // or all time. Units, abilities, products and terrain types carry era 'classic' when they are old school only;
  // cards first printed in an old-school product and reprinted since carry 'both'. "Use FAQ errata" applies the
  // All Time Format FAQ's points updates and card text (data/errata.json, made by tools/make_classic.py).
  const ERAS = { now: 'Contemporary', classic: 'Old school', all: 'All time' };
  registerSaved({
    key: 'era', label: 'which cards to show and errata',
    get: () => ({ era: state.era, errata: state.errata }),
    clean: (o) => ({ era: ERAS[o && o.era] ? o.era : 'now', errata: !(o && o.errata === false) }),
    apply: (v) => { state.era = v ? v.era : 'now'; state.errata = v ? v.errata : true; }
  });
  function eraOk(x) { const e = (x && x.era) || 'now'; return state.era === 'all' || e === 'both' || e === state.era; }
  const isOld = (x) => x && (x.era === 'classic' || x.era === 'both');
  segBind('.hs-era', 'era', (v) => { state.era = v; });
  root.querySelectorAll('.hs-errata').forEach((c) => c.addEventListener('change', () => { state.errata = c.checked; draw(); }));
  function syncEra() {
    segSync('.hs-era', 'era', state.era);
    root.querySelectorAll('.hs-errata').forEach((c) => { c.checked = state.errata; });
  }
  // the FAQ's points updates: only where the card still shows the old value (reprints already print the new one)
  function errataPoints(rows) {
    const e = dash.data('errata'); if (e.status !== 'ok' || !state.errata) return;
    for (const p of e.data.points || []) {
      const r = rows.find((u) => u.unit === p.unit);
      if (!r || Number(r.points) !== p.from) continue;
      const k = p.from / p.to;
      for (const f of Object.keys(r)) if (/100/.test(f) && typeof r[f] === 'number') r[f] = Math.round(r[f] * k * 10) / 10;
      r.points = p.to; r.card_points = p.from; r.errataPts = true;
    }
  }
  // (function declarations, since index() can run before this part of the script)
  function abList(s) { return String(s || '').split(';').map((x) => x.trim()).filter(Boolean); }
  function abKey(n) { return String(n).toLowerCase().replace(/special attack/g, '').replace(/[^a-z]/g, ''); }
  function errataText(rows) {
    const ERRATA_NOTE = 'Errata from the All Time Format FAQ. Turn off “Use FAQ errata” under Advanced options to see the printed text.';
    const e = dash.data('errata'); if (e.status !== 'ok' || !state.errata) return;
    for (const c of e.data.cards || []) {
      const r = rows.find((u) => u.unit === c.unit); if (!r) continue;
      const list = (ABIL[c.unit] || []).slice();
      for (const a of c.abilities) {
        const y = abKey(a.ability);
        const i = list.findIndex((x) => { const k = abKey(x.ability); return k && y && (k === y || k.startsWith(y) || y.startsWith(k) || k.endsWith(y) || y.endsWith(k)); });
        const row = { unit: c.unit, ability: a.ability, text: a.text, note: ERRATA_NOTE, errata: true };
        if (i >= 0) { r.abilities = abList(r.abilities).map((n) => (n === list[i].ability ? a.ability : n)).join('; '); list[i] = row; }
        else { list.push(row); r.abilities = [r.abilities, a.ability].filter(Boolean).join('; '); }
      }
      for (const n of c.notes) {
        const m = /^Replace (.+) with (.+?)\.?$/i.exec(n); // e.g. "Replace FLYING with STEALTH FLYING."
        const i = m ? list.findIndex((x) => abKey(x.ability) === abKey(m[1])) : -1;
        if (i >= 0) {
          const nm = m[2].toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
          r.abilities = abList(r.abilities).map((x) => (x === list[i].ability ? nm : x)).join('; ');
          list[i] = { ...list[i], ability: nm, note: ERRATA_NOTE, errata: true };
        } else list.push({ unit: c.unit, ability: 'FAQ clarification', text: n, note: 'From the All Time Format FAQ.', errata: true });
      }
      ABIL[c.unit] = list;
    }
  }
  // the unit's "Book of" thread on Heroscapers (found by a title search, since thread addresses can't be worked out)
  const bookOfUrl = (r) => 'https://www.heroscapers.com/search/?q=' + encodeURIComponent('"Book of ' + r.unit.replace(/ \(\d\.0\)$/, '') + '"') + '&c[title_only]=1&o=relevance';
  // ---------- products ----------
  const PROD_OWN = {}; // product id -> count owned
  const PSTATE = { kind: '', own: '', q: '' };
  let PROD_AUTO = true;
  const STORE_SEARCH = 'https://heroscape.renegadegamestudios.com/search.php?search_query=';
  const prodKind = (p) => p.kind === 'Army expansion' ? 'army' : p.kind === 'Terrain' ? 'terrain' : p.kind === 'Promo' ? 'promo' : p.kind === 'Accessory' ? 'acc' : 'box';
  const prodById = (id) => (RAW('products') || []).find((p) => p.id === id);
  const productsOf = (unit) => (DATA('products') || []).filter((p) => (p.units || []).includes(unit));
  const buyUrl = (p) => p.url || STORE_SEARCH + encodeURIComponent(p.kind === 'Promo' ? p.units[0] : p.name);
  const monthTxt = (d) => { const [y, m] = String(d).split('-'); return m ? new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : y; };
  const upcoming = (p) => String(p.date) > today().slice(0, 7);
  function setProd(id, n) {
    const p = prodById(id); if (!p) return;
    n = Math.max(0, Math.min(99, n));
    const delta = n - (PROD_OWN[id] || 0);
    if (n) PROD_OWN[id] = n; else delete PROD_OWN[id];
    if (PROD_AUTO && delta) for (const u of p.units || []) setColl(u, { owned: ownedOf(u) + delta * (p.copies || 1) });
    draw();
  }
  registerSaved({
    key: 'products', label: 'products',
    get: () => ({ owned: { ...PROD_OWN }, autoCards: PROD_AUTO }),
    clean: (o) => {
      const owned = {};
      if (o && o.owned && typeof o.owned === 'object') for (const [k, v] of Object.entries(o.owned).slice(0, 500)) { const n = cnt(v, 99); if (n) owned[str(k, 40)] = n; }
      return { owned, autoCards: o && o.autoCards !== false };
    },
    apply: (v, merge) => {
      if (!merge) for (const k of Object.keys(PROD_OWN)) delete PROD_OWN[k];
      if (!v) { PROD_AUTO = true; return; }
      for (const [k, n] of Object.entries(v.owned)) PROD_OWN[k] = merge ? Math.max(PROD_OWN[k] || 0, n) : n;
      if (!merge) PROD_AUTO = v.autoCards;
    }
  });
  const pAuto = root.querySelector('.p-auto');
  pAuto.addEventListener('change', () => { PROD_AUTO = pAuto.checked; persist(); });
  segBind('.p-kind', 'k', (v) => { PSTATE.kind = v; });
  segBind('.p-own', 'o', (v) => { PSTATE.own = v; });
  const pQ = root.querySelector('.p-q');
  pQ.addEventListener('input', () => { PSTATE.q = pQ.value.trim().toLowerCase(); drawProducts(); });
  function terrainSummary(list) {
    const T = RAW('terrain'); if (!T) return '';
    const name = (id) => (T.types.find((t) => t.id === id) || { name: id }).name;
    const by = new Map();
    for (const x of list) { const k = name(x.t); by.set(k, (by.get(k) || []).concat(/^\d+$/.test(x.s) ? `${x.n}× ${x.s}-hex` : `${x.n}× ${x.s}`)); }
    return [...by].map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ');
  }
  const hexesOf = (list, mult) => d3.sum(list || [], (x) => /^\d+$/.test(x.s) ? Number(x.s) * x.n * mult : 0);
  function drawProducts() {
    const P = DATA('products'); if (!P) return;
    pAuto.checked = PROD_AUTO;
    segSync('.p-kind', 'k', PSTATE.kind); segSync('.p-own', 'o', PSTATE.own);
    const own = P.filter((p) => PROD_OWN[p.id]);
    const set = (c, v) => { root.querySelector(c).textContent = v; };
    set('.p-owned', String(own.length)); set('.p-army', String(own.filter((p) => prodKind(p) === 'army').length));
    set('.p-terr', String(own.filter((p) => prodKind(p) === 'terrain').length)); set('.p-promo', String(own.filter((p) => prodKind(p) === 'promo').length));
    set('.p-hexes', d3.format(',')(d3.sum(own, (p) => hexesOf(p.terrain, PROD_OWN[p.id]))));
    const list = P.filter((p) => (!PSTATE.kind || prodKind(p) === PSTATE.kind) && (!PSTATE.own || (PSTATE.own === 'owned') === !!PROD_OWN[p.id])
      && (!PSTATE.q || [p.name, p.wave, p.kind, ...(p.units || [])].join(' ').toLowerCase().includes(PSTATE.q)))
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
    const box = root.querySelector('.p-list'); box.replaceChildren();
    if (!list.length) { box.appendChild(mk('div', 'hs-card hs-empty', 'No products match.')); return; }
    const groups = d3.groups(list, (p) => p.wave || (p.kind === 'Promo' ? 'Promo figures' : monthTxt(p.date)));
    for (const [wave, items] of groups) {
      const card = mk('div', 'hs-card p-wave');
      const h = mk('h3', 'p-wh', wave); h.appendChild(mk('span', 'hs-note', ' ' + monthTxt(d3.min(items, (p) => p.date)) + (items.some(upcoming) ? ' · upcoming' : '')));
      card.appendChild(h);
      for (const p of items) {
        const row = mk('div', 'p-row' + (PROD_OWN[p.id] ? ' owned' : ''));
        const main = mk('div', 'p-main');
        const t = mk('div', 'p-name', p.name);
        t.appendChild(mk('span', 'hs-pill', p.kind));
        if (upcoming(p)) t.appendChild(mk('span', 'hs-pill warn', 'Coming ' + monthTxt(p.date)));
        main.appendChild(t);
        if ((p.units || []).length) {
          const u = mk('div', 'p-units');
          for (const n of p.units) {
            const r = UNITS.find((x) => x.unit === n);
            const c = mk('button', 'hs-chip' + (ownedOf(n) ? ' on' : ''), n); c.type = 'button';
            if (r) c.addEventListener('click', () => openCard(r));
            u.appendChild(c);
          }
          if (p.copies > 1) u.appendChild(mk('span', 'hs-note', ` ${p.copies} squads per box`));
          main.appendChild(u);
        }
        if ((p.terrain || []).length) main.appendChild(mk('div', 'p-terr hs-note', terrainSummary(p.terrain)));
        if (p.note) main.appendChild(mk('div', 'p-note hs-note', p.note));
        row.appendChild(main);
        const side = mk('div', 'p-side');
        side.appendChild(stepperN(PROD_OWN[p.id] || 0, (n) => setProd(p.id, n), p.name));
        side.appendChild(link(p.era === 'classic' ? 'Info ↗' : upcoming(p) ? 'Pre-order ↗' : 'Buy ↗', buyUrl(p), 'p-buy'));
        row.appendChild(side);
        card.appendChild(row);
      }
      box.appendChild(card);
    }
  }
  // product line in the card dialog
  function cardExtras(r) {
    const box = dlg.querySelector('.hs-dlg-prod'); box.replaceChildren();
    if (r.custom) { box.appendChild(mk('span', 'hs-tag', 'Custom card')); return; }
    const bk = mk('div', 'hs-bookof'); bk.appendChild(link('Book of ' + r.unit.replace(/ \(\d\.0\)$/, '') + ' on Heroscapers ↗', bookOfUrl(r))); box.appendChild(bk);
    if (r.errataPts) box.appendChild(mk('div', 'hs-note', `Printed at ${r.card_points} points; the FAQ points update makes it ${r.points}.`));
    const ps = productsOf(r.unit);
    if (!ps.length) return;
    box.appendChild(document.createTextNode(ps.length > 1 ? 'Comes in: ' : 'Comes in '));
    ps.forEach((p, i) => {
      if (i) box.appendChild(document.createTextNode(' · '));
      const b = mk('button', 'hs-linkbtn', p.name); b.type = 'button';
      b.addEventListener('click', () => { dlg.close(); PSTATE.q = p.name.toLowerCase(); pQ.value = p.name; PSTATE.kind = ''; PSTATE.own = ''; showPage('products', true); });
      box.appendChild(b);
      box.appendChild(document.createTextNode(` (${p.kind === 'Promo' && p.note ? p.note : monthTxt(p.date)}) `));
      box.appendChild(link(p.era === 'classic' ? 'info ↗' : upcoming(p) ? 'pre-order ↗' : 'buy ↗', buyUrl(p)));
    });
  }

  // ---------- terrain ----------
  const TERR_EXTRA = {}; // "type|size" -> extra loose pieces (can be negative to take away)
  const TERR_FX = {};    // type id -> your own effect text
  let TERR_ALL = false, TERR_EDIT = null;
  registerSaved({
    key: 'terrain', label: 'terrain',
    get: () => ({ extra: { ...TERR_EXTRA }, effects: { ...TERR_FX } }),
    clean: (o) => {
      const extra = {}, effects = {};
      if (o && o.extra && typeof o.extra === 'object') for (const [k, v] of Object.entries(o.extra).slice(0, 500)) { const n = Math.max(-999, Math.min(999, Math.round(Number(v) || 0))); if (n) extra[str(k, 80)] = n; }
      if (o && o.effects && typeof o.effects === 'object') for (const [k, v] of Object.entries(o.effects).slice(0, 100)) { const s = str(v, 400).trim(); if (s) effects[str(k, 40)] = s; }
      return { extra, effects };
    },
    apply: (v, merge) => {
      if (!merge) { for (const k of Object.keys(TERR_EXTRA)) delete TERR_EXTRA[k]; for (const k of Object.keys(TERR_FX)) delete TERR_FX[k]; }
      if (!v) return;
      for (const [k, n] of Object.entries(v.extra)) TERR_EXTRA[k] = merge ? Math.max(TERR_EXTRA[k] || 0, n) : n;
      for (const [k, s] of Object.entries(v.effects)) if (!merge || !TERR_FX[k]) TERR_FX[k] = s;
    }
  });
  // every piece you own: from products plus loose pieces
  function terrainOwned() {
    const P = RAW('products') || [], out = new Map();
    const add = (t, s, n) => { const k = t + '|' + s; out.set(k, (out.get(k) || 0) + n); };
    for (const p of P) { const q = PROD_OWN[p.id] || 0; if (q) for (const x of p.terrain || []) add(x.t, x.s, x.n * q); }
    for (const [k, n] of Object.entries(TERR_EXTRA)) { const [t, s] = k.split('|'); add(t, s, n); }
    for (const [k, n] of out) if (n <= 0) out.delete(k);
    return out;
  }
  const tAll = root.querySelector('.t-all');
  tAll.addEventListener('change', () => { TERR_ALL = tAll.checked; drawTerrain(); });
  function drawTerrain() {
    const T = RAW('terrain'), P = DATA('products'); if (!T || !P) return;
    tAll.checked = TERR_ALL;
    root.querySelector('.t-note').textContent = T.note;
    const own = terrainOwned();
    const sizesOf = (tid) => {
      const s = new Set(T.sizes.filter((z) => [...P.flatMap((p) => p.terrain || [])].some((x) => x.t === tid && x.s === z)));
      for (const k of own.keys()) { const [t, z] = k.split('|'); if (t === tid) s.add(z); }
      for (const k of Object.keys(TERR_EXTRA)) { const [t, z] = k.split('|'); if (t === tid) s.add(z); }
      const all = [...new Set([...P.flatMap((p) => p.terrain || []).filter((x) => x.t === tid).map((x) => x.s), ...s])];
      return all.sort((a, b) => (/^\d+$/.test(b) ? +b : -1) - (/^\d+$/.test(a) ? +a : -1) || a.localeCompare(b));
    };
    let hexes = 0, tiles = 0, objs = 0;
    for (const [k, n] of own) { const s = k.split('|')[1]; if (/^\d+$/.test(s)) { hexes += +s * n; tiles += n; } else objs += n; }
    root.querySelector('.t-hexes').textContent = d3.format(',')(hexes);
    root.querySelector('.t-tiles').textContent = d3.format(',')(tiles);
    root.querySelector('.t-objs').textContent = d3.format(',')(objs);
    root.querySelector('.t-types').textContent = String(new Set([...own.keys()].map((k) => k.split('|')[0])).size);
    const box = root.querySelector('.t-groups'); box.replaceChildren();
    // old-school types show in the old-school eras, or whenever you own some
    const ownsType = (t) => [...own.keys()].some((k) => k.startsWith(t.id + '|'));
    for (const [group, types] of d3.groups(T.types.filter((t) => eraOk(t) || ownsType(t)), (t) => t.group)) {
      const shown = types.filter((t) => TERR_ALL || [...own.keys()].some((k) => k.startsWith(t.id + '|')));
      if (!shown.length) continue;
      const card = mk('div', 'hs-card t-group');
      card.appendChild(mk('h3', '', group));
      const tiled = !/Trees|Outcrops/.test(group);
      const wrap = mk('div', 'hs-scroll'); const tb = mk('table', 'hs-a t-table'); wrap.appendChild(tb);
      const cols = tiled ? T.sizes : null;
      const hr = tb.createTHead().insertRow();
      hr.appendChild(mk('th', 'l', 'Terrain'));
      if (cols) for (const s of cols) hr.appendChild(mk('th', '', s + '-hex'));
      hr.appendChild(mk('th', '', tiled ? 'Hexes' : 'Pieces'));
      hr.appendChild(mk('th', 'l', 'What it does'));
      hr.appendChild(mk('th', '', ''));
      const body = tb.createTBody();
      for (const t of shown) {
        const tr = body.insertRow();
        tr.appendChild(mk('td', 'l nm', t.name));
        if (cols) {
          for (const s of cols) { const n = own.get(t.id + '|' + s) || 0; tr.appendChild(mk('td', n ? '' : 'zero', n ? String(n) : '·')); }
          tr.appendChild(mk('td', 'b', d3.format(',')(d3.sum(cols, (s) => (own.get(t.id + '|' + s) || 0) * +s))));
        } else {
          const items = sizesOf(t.id).map((s) => [s, own.get(t.id + '|' + s) || 0]).filter(([, n]) => n);
          const td = mk('td', 'b'); td.textContent = String(d3.sum(items, (x) => x[1]));
          if (items.length) td.title = items.map(([s, n]) => `${n}× ${s}`).join(', ');
          tr.appendChild(td);
        }
        const fx = mk('td', 'l t-fx', TERR_FX[t.id] || t.effect);
        if (!cols) { const items = sizesOf(t.id).map((s) => [s, own.get(t.id + '|' + s) || 0]).filter(([, n]) => n); if (items.length) fx.prepend(mk('div', 't-items', items.map(([s, n]) => `${n}× ${s}`).join(' · '))); }
        if (TERR_FX[t.id]) fx.appendChild(mk('span', 'hs-tag', 'Your text'));
        tr.appendChild(fx);
        const ed = mk('td'); ed.appendChild(btn(TERR_EDIT === t.id ? 'Close' : 'Edit', 'hs-sm', () => { TERR_EDIT = TERR_EDIT === t.id ? null : t.id; drawTerrain(); }, 'Edit ' + t.name)); tr.appendChild(ed);
        if (TERR_EDIT === t.id) {
          const er = body.insertRow(); const td = mk('td', 'l t-edit'); td.colSpan = (cols ? cols.length : 0) + 4; er.appendChild(td);
          td.appendChild(mk('div', 'hs-note', 'Loose pieces you own on top of your products (use a minus number for pieces you are missing):'));
          const row = mk('div', 'hs-armyadd');
          const sizes = cols || sizesOf(t.id);
          for (const s of sizes) {
            const k = t.id + '|' + s; const l = mk('label', 'hs-field', /^\d+$/.test(s) ? s + '-hex' : s);
            const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'hs-num'; inp.min = '-999'; inp.max = '999'; inp.value = String(TERR_EXTRA[k] || 0);
            inp.addEventListener('change', () => { const n = Math.round(Number(inp.value) || 0); if (n) TERR_EXTRA[k] = n; else delete TERR_EXTRA[k]; draw(); });
            l.appendChild(inp); row.appendChild(l);
          }
          if (!cols) {
            const l = mk('label', 'hs-field', 'Other piece'); const nm = document.createElement('input'); nm.type = 'text'; nm.maxLength = 40; nm.placeholder = 'e.g. 16H tree';
            const add = btn('Add piece', '', () => { const s = nm.value.trim(); if (!s) return; TERR_EXTRA[t.id + '|' + s] = (TERR_EXTRA[t.id + '|' + s] || 0) + 1; draw(); });
            l.appendChild(nm); row.append(l, add);
          }
          td.appendChild(row);
          const fl = mk('label', 'hs-field', 'What it does (your own words)'); const fi = document.createElement('textarea'); fi.rows = 2; fi.maxLength = 400; fi.value = TERR_FX[t.id] || t.effect;
          fi.addEventListener('change', () => { const v = fi.value.trim(); if (v && v !== t.effect) TERR_FX[t.id] = v; else delete TERR_FX[t.id]; draw(); });
          fl.appendChild(fi); td.appendChild(fl);
        }
      }
      card.appendChild(wrap);
      box.appendChild(card);
    }
    if (!box.children.length) box.appendChild(mk('div', 'hs-card hs-empty', 'No terrain yet. Count your boxes on the Products page, or tick “Show terrain types I don’t own” to add loose pieces.'));
  }

  // ---------- tournament maps ----------
  const MAP_REQ = {}; // map id -> your own list of products [{id: n}] for maps whose PDF has no readable list
  const MSTATE = { level: '', show: '', q: '', rand: null, edit: null, rlevel: '', sizeOnly: false, tab: '' };
  registerSaved({
    key: 'maps', label: 'map notes',
    get: () => ({ requirements: JSON.parse(JSON.stringify(MAP_REQ)), sizeOnly: MSTATE.sizeOnly }),
    clean: (o) => {
      const requirements = {};
      if (o && o.requirements && typeof o.requirements === 'object') for (const [k, v] of Object.entries(o.requirements).slice(0, 300)) {
        if (!v || typeof v !== 'object') continue; const r = {};
        for (const [p, n] of Object.entries(v).slice(0, 30)) { const q = cnt(n, 9); if (q) r[str(p, 40)] = q; }
        if (Object.keys(r).length) requirements[str(k, 20)] = r;
      }
      return { requirements, sizeOnly: !!(o && o.sizeOnly) };
    },
    apply: (v, merge) => {
      if (!merge) for (const k of Object.keys(MAP_REQ)) delete MAP_REQ[k];
      if (v) for (const [k, r] of Object.entries(v.requirements)) if (!merge || !MAP_REQ[k]) MAP_REQ[k] = r;
      if (v && !merge) MSTATE.sizeOnly = v.sizeOnly;
    }
  });
  const mapOptions = (m) => MAP_REQ[m.id] ? [MAP_REQ[m.id]] : m.options;
  const canBuildWith = (opt, have) => Object.entries(opt).every(([p, n]) => (have[p] || 0) >= n);
  const mapCan = (m, have) => mapOptions(m).some((o) => canBuildWith(o, have || PROD_OWN));
  const mapKnown = (m) => mapOptions(m).length > 0;
  // "Count hexes by size only": land and water hexes of any type count together by size (24, 7, 3, 2, 1 ...),
  // trees of any kind count together, and so do rock outcrops; walls and other objects still count by type.
  // A map with pieces read from its PDF (m.pieces) needs those; any other map needs every piece in its products.
  const TREES = new Set(['tree', 'evergreen', 'laurtree', 'underbrush', 'snowtree', 'swampbrush']);
  const pieceKey = (t, s) => (TREES.has(t) ? 'tree|' : /outcrop|lavarock/.test(t) ? 'outcrop|' + s : /^\d+$/.test(s) ? 'hex|' + s : t + '|' + s);
  function piecesOf(o, m) {
    const need = {};
    const add = (t, s, n) => { const k = pieceKey(t, s); need[k] = (need[k] || 0) + n; };
    if (m && m.pieces && !MAP_REQ[m.id]) for (const [k, n] of Object.entries(m.pieces)) { const [t, sz] = k.split('|'); add(t, sz, n); }
    else for (const [p, n] of Object.entries(o)) for (const x of (prodById(p) || {}).terrain || []) add(x.t, x.s, x.n * n);
    return need;
  }
  function piecePool() { const pool = {}; for (const [k, n] of terrainOwned()) { const [t, s] = k.split('|'); const q = pieceKey(t, s); pool[q] = (pool[q] || 0) + n; } return pool; }
  function bestBySize(maps) {
    const pool = piecePool();
    const cand = maps.filter((m) => mapKnown(m)).map((m) => ({ m, opts: mapOptions(m).map((o) => ({ o, need: piecesOf(o, m) })).filter((x) => canBuildWith(x.need, pool)) })).filter((c) => c.opts.length);
    cand.sort((a, b) => d3.sum(Object.values(a.opts[0].need)) - d3.sum(Object.values(b.opts[0].need)));
    let best = [], steps = 0;
    const left = { ...pool };
    (function go(i, chosen) {
      if (++steps > 200000) return;
      if (chosen.length > best.length) best = chosen.slice();
      if (i >= cand.length || chosen.length + (cand.length - i) <= best.length) return;
      for (const { o, need } of cand[i].opts) {
        if (!canBuildWith(need, left)) continue;
        for (const [k, n] of Object.entries(need)) left[k] -= n;
        chosen.push({ m: cand[i].m, o }); go(i + 1, chosen); chosen.pop();
        for (const [k, n] of Object.entries(need)) left[k] += n;
      }
      go(i + 1, chosen);
    })(0, []);
    return best;
  }
  // largest group of maps that can stand at the same time (each map picks one of its options)
  function bestSet(maps) {
    if (MSTATE.sizeOnly) return bestBySize(maps);
    const cand = maps.filter((m) => mapKnown(m) && mapCan(m));
    cand.sort((a, b) => d3.sum(Object.values(mapOptions(a)[0])) - d3.sum(Object.values(mapOptions(b)[0])));
    let best = [], steps = 0;
    const left = { ...PROD_OWN };
    (function go(i, chosen) {
      if (++steps > 200000) return;
      if (chosen.length > best.length) best = chosen.slice();
      if (i >= cand.length || chosen.length + (cand.length - i) <= best.length) return;
      const m = cand[i];
      for (const o of mapOptions(m)) {
        if (!canBuildWith(o, left)) continue;
        for (const [p, n] of Object.entries(o)) left[p] -= n;
        chosen.push({ m, o }); go(i + 1, chosen); chosen.pop();
        for (const [p, n] of Object.entries(o)) left[p] += n;
      }
      go(i + 1, chosen);
    })(0, []);
    return best;
  }
  const mSize = root.querySelector('.m-sizeonly');
  mSize.addEventListener('change', () => { MSTATE.sizeOnly = mSize.checked; persist(); drawMaps(); });
  segBind('.m-tab', 'tab', (v) => { MSTATE.tab = v; });
  segBind('.m-level', 'l', (v) => { MSTATE.level = v; });
  segBind('.m-show', 's', (v) => { MSTATE.show = v; });
  const mQ = root.querySelector('.m-q');
  mQ.addEventListener('input', () => { MSTATE.q = mQ.value.trim().toLowerCase(); drawMaps(); });
  root.querySelectorAll('.rm-level [data-l]').forEach((b) => b.addEventListener('click', () => { MSTATE.rlevel = b.dataset.l || ''; segSync('.rm-level', 'l', MSTATE.rlevel); }));
  root.querySelector('.m-rand').addEventListener('click', () => {
    const M = DATA('maps'); if (!M) return;
    const pool = M.filter((m) => (!MSTATE.rlevel || m.level === MSTATE.rlevel) && (!root.querySelector('.m-randown').checked || mapCan(m)));
    const out = root.querySelector('.m-randout');
    if (!pool.length) { MSTATE.rand = null; out.replaceChildren(mk('p', 'hs-note', 'You can’t build any of these maps yet. Count your boxes on the Products page.')); return; }
    let pick; do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && MSTATE.rand && pick.id === MSTATE.rand);
    MSTATE.rand = pick.id;
    out.replaceChildren(mapCard(pick, true));
  });
  function reqChips(opt) {
    const w = mk('span', 'm-req');
    for (const [p, n] of Object.entries(opt)) {
      const pr = prodById(p); const ok = (PROD_OWN[p] || 0) >= n;
      const c = mk('span', 'hs-chip ' + (ok ? 'ok' : 'miss'), (ok ? '✓ ' : '✗ ') + (n > 1 ? n + '× ' : '') + (pr ? pr.name : p));
      c.title = ok ? 'You own enough' : `You own ${PROD_OWN[p] || 0}`;
      w.appendChild(c);
    }
    return w;
  }
  const PIECE_NAMES = { tree: 'Jungle tree', evergreen: 'Evergreen tree', rockoutcrop: 'Rock outcrop' };
  const pieceName = (t) => PIECE_NAMES[t] || ((RAW('terrain') || { types: [] }).types.find((x) => x.id === t) || { name: t }).name;
  const sizeName = (s) => (/^\d+$/.test(s) ? s + '-hex' : s.replace(/^(\d+)H$/, 'height $1'));
  // a folded list of a map's pieces, grouped by terrain
  function piecesBox(pieces, title) {
    const d = mk('details', 'm-pieces');
    d.appendChild(mk('summary', '', `${title} (${d3.sum(Object.values(pieces))})`));
    const by = d3.groups(Object.entries(pieces), ([k]) => k.split('|')[0]);
    const ul = mk('ul', '');
    for (const [t, items] of by) ul.appendChild(mk('li', '', pieceName(t) + ': ' + items.sort((a, b) => (parseInt(b[0].split('|')[1]) || 0) - (parseInt(a[0].split('|')[1]) || 0)).map(([k, n]) => `${n}× ${sizeName(k.split('|')[1])}`).join(', ')));
    d.appendChild(ul);
    return d;
  }
  // map PDF viewer: every page drawn with pdf.js (the rulebook's reader), zoomable
  const PV = { doc: null, zoom: 1, url: null };
  const pdlg = document.querySelector('dialog.m-pdfdlg');
  const pq = (c) => pdlg.querySelector('.' + c);
  function closePdf() { if (PV.doc) { PV.doc.destroy(); PV.doc = null; } if (PV.url) { URL.revokeObjectURL(PV.url); PV.url = null; } pq('mpdf-pages').replaceChildren(); }
  pq('mpdf-x').addEventListener('click', () => pdlg.close());
  pdlg.addEventListener('click', (e) => { if (e.target === pdlg) pdlg.close(); });
  pdlg.addEventListener('close', closePdf);
  pq('mpdf-zin').addEventListener('click', () => { PV.zoom = Math.min(4, PV.zoom * 1.5); drawPdf(); });
  pq('mpdf-zout').addEventListener('click', () => { PV.zoom = Math.max(1, PV.zoom / 1.5); drawPdf(); });
  async function drawPdf() {
    const box = pq('mpdf-pages'); box.replaceChildren();
    if (!PV.doc) return;
    const w = Math.max(280, box.clientWidth || pdlg.clientWidth - 40) * PV.zoom, dpr = Math.min(2, window.devicePixelRatio || 1);
    for (let i = 1; i <= PV.doc.numPages; i++) {
      const page = await PV.doc.getPage(i); if (!PV.doc) return;
      const vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: (w / vp0.width) * dpr });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = (vp.width / dpr) + 'px';
      box.appendChild(cv);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  }
  // src: a file on the site, or the bytes of one of your own maps
  async function viewPdf(title, src) {
    closePdf();
    pdlg.querySelector('#mpdf-t').textContent = title;
    PV.zoom = 1;
    if (!pdlg.open) pdlg.showModal();
    pq('mpdf-msg').textContent = 'Opening…';
    try {
      const bytes = typeof src === 'string' ? new Uint8Array(await (await fetch(src)).arrayBuffer()) : src;
      PV.url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const dl = pq('mpdf-dl'); dl.href = PV.url; dl.download = title.replace(/[^\w .-]+/g, '') + '.pdf';
      const lib = await pdfLib();
      PV.doc = await lib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
      pq('mpdf-msg').textContent = '';
      await drawPdf();
    } catch (e) { pq('mpdf-msg').textContent = 'The map could not be opened (' + (e.message || e) + ').'; }
  }
  function mapCard(m, big) {
    const c = mk('div', 'm-card' + (big ? ' big' : ''));
    const head = mk('div', 'm-head');
    head.appendChild(mk('b', 'm-name', m.name));
    const known = mapKnown(m), can = known && mapCan(m);
    head.appendChild(mk('span', 'hs-pill ' + (!known ? 'warn' : can ? 'ok' : 'bad'), !known ? 'Terrain not listed' : can ? 'You can build it' : 'Missing products'));
    head.appendChild(mk('span', 'hs-pill', m.level));
    c.appendChild(head);
    c.appendChild(mk('div', 'hs-note', [m.designer ? 'By ' + m.designer : '', m.event, m.points ? m.points + ' points' : '', m.glyphs ? 'Glyphs: ' + m.glyphs : ''].filter(Boolean).join(' · ')));
    const opts = mapOptions(m);
    opts.forEach((o, i) => { const d = mk('div', 'm-opt'); if (opts.length > 1) d.appendChild(mk('span', 'hs-note', (i ? 'or ' : '') + 'Build ' + (i + 1) + ': ')); d.appendChild(reqChips(o)); c.appendChild(d); });
    if (MAP_REQ[m.id]) c.appendChild(mk('div', 'hs-note', 'Using the terrain you recorded.'));
    if (m.note && !MAP_REQ[m.id]) c.appendChild(mk('div', 'hs-note', m.note));
    if (m.pieces) c.appendChild(piecesBox(m.pieces, 'Pieces counted from the PDF'));
    const act = mk('div', 'm-act');
    if (m.file) act.appendChild(btn('View map', 'hs-sm hs-primary', () => viewPdf(m.name, m.file)));
    act.appendChild(link(m.file ? 'Renegade’s copy ↗' : 'Open map PDF ↗', m.pdf));
    act.appendChild(btn(MSTATE.edit === m.id ? 'Close' : 'Set terrain', 'hs-sm', () => { MSTATE.edit = MSTATE.edit === m.id ? null : m.id; drawMaps(); }));
    c.appendChild(act);
    if (MSTATE.edit === m.id) {
      const ed = mk('div', 'm-edit');
      ed.appendChild(mk('div', 'hs-note', 'Record the products this map needs, as printed on its PDF. This replaces the list above for you only.'));
      const cur = { ...(MAP_REQ[m.id] || (m.options[0] || {})) };
      const P = (DATA('products') || []).filter((p) => (p.terrain || []).length || p.id === 'tokit');
      const grid = mk('div', 'm-editgrid');
      for (const p of P) {
        const l = mk('label', 'hs-field', p.name); const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.max = '9'; i.className = 'hs-num'; i.value = String(cur[p.id] || 0);
        i.addEventListener('change', () => { const n = cnt(i.value, 9); if (n) cur[p.id] = n; else delete cur[p.id]; });
        l.appendChild(i); grid.appendChild(l);
      }
      ed.appendChild(grid);
      const row = mk('div', 'm-act');
      row.appendChild(btn('Save', 'hs-primary', () => { if (Object.keys(cur).length) MAP_REQ[m.id] = cur; else delete MAP_REQ[m.id]; MSTATE.edit = null; draw(); }));
      if (MAP_REQ[m.id]) row.appendChild(btn('Use the official list', '', () => { delete MAP_REQ[m.id]; MSTATE.edit = null; draw(); }));
      ed.appendChild(row);
      c.appendChild(ed);
    }
    return c;
  }
  function drawMaps() {
    const M = DATA('maps'); if (!M || !DATA('products')) return;
    segSync('.m-tab', 'tab', MSTATE.tab);
    root.querySelector('#maps .m-tour').hidden = MSTATE.tab === 'mine'; root.querySelector('#maps .m-mine').hidden = MSTATE.tab !== 'mine';
    if (MSTATE.tab === 'mine') { drawMine(); return; }
    segSync('.m-level', 'l', MSTATE.level); segSync('.m-show', 's', MSTATE.show);
    mSize.checked = MSTATE.sizeOnly; root.querySelector('.m-sizenote').hidden = !MSTATE.sizeOnly;
    const can = M.filter((m) => mapCan(m)), best = bestSet(M);
    root.querySelector('.m-can').textContent = String(can.length);
    root.querySelector('.m-total').textContent = String(M.length);
    root.querySelector('.m-max').textContent = String(best.length);
    root.querySelector('.m-unknown').textContent = String(M.filter((m) => !mapKnown(m)).length);
    const bb = root.querySelector('.m-best'); bb.replaceChildren();
    if (!best.length) bb.appendChild(mk('p', 'hs-empty', 'Count your boxes on the Products page to see which maps you can set up.'));
    else {
      const ul = mk('ol', 'm-bestlist');
      for (const { m, o } of best) { const li = mk('li', '', m.name + ' '); li.appendChild(mk('span', 'hs-note', '(' + Object.entries(o).map(([p, n]) => (n > 1 ? n + '× ' : '') + (prodById(p) || { name: p }).name).join(', ') + ')')); ul.appendChild(li); }
      bb.appendChild(ul);
    }
    // what to buy next: products that add the most buildable maps
    const nb = root.querySelector('.m-next'); nb.replaceChildren();
    const terrainProds = (DATA('products') || []).filter((p) => M.some((m) => mapOptions(m).some((o) => o[p.id])));
    const gains = terrainProds.map((p) => { const have = { ...PROD_OWN, [p.id]: (PROD_OWN[p.id] || 0) + 1 }; return { p, n: M.filter((m) => !mapCan(m) && mapCan(m, have)).length }; })
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
    if (!gains.length) nb.appendChild(mk('p', 'hs-empty', can.length ? 'No single product unlocks another listed map. Combinations may.' : 'Count your boxes on the Products page first.'));
    for (const g of gains) { const d = mk('div', 'm-gain'); d.append(mk('b', '', `+${g.n} map${g.n === 1 ? '' : 's'}`), document.createTextNode(` with ${PROD_OWN[g.p.id] ? 'another ' : ''}${g.p.name} `)); d.appendChild(link(g.p.era === 'classic' ? 'info ↗' : 'buy ↗', buyUrl(g.p))); nb.appendChild(d); }
    const list = M.filter((m) => (!MSTATE.level || m.level === MSTATE.level) && (!MSTATE.show || (MSTATE.show === 'can') === mapCan(m))
      && (!MSTATE.q || [m.name, m.designer, m.event].join(' ').toLowerCase().includes(MSTATE.q)));
    const box = root.querySelector('.m-list'); box.replaceChildren();
    if (!list.length) { box.appendChild(mk('div', 'hs-card hs-empty', 'No maps match.')); return; }
    const grid = mk('div', 'm-grid');
    for (const m of list) grid.appendChild(mapCard(m));
    box.appendChild(grid);
    if (MSTATE.rand) { const m = M.find((x) => x.id === MSTATE.rand); if (m) root.querySelector('.m-randout').replaceChildren(mapCard(m, true)); }
  }

  // ---------- my maps ----------
  // Maps you add yourself: name, designer, notes, the terrain kits and pieces they use, and a PDF.
  // The list goes in the backup file; each PDF is kept in this browser (IndexedDB) and goes in the
  // "Export my maps" file, which holds the maps with their PDFs.
  const MYMAPS = [];
  const cleanMyMap = (m) => {
    const kits = {}, pieces = {};
    if (m && m.kits && typeof m.kits === 'object') for (const [k, n] of Object.entries(m.kits).slice(0, 40)) { const q = cnt(n, 9); if (q) kits[str(k, 40)] = q; }
    if (m && m.pieces && typeof m.pieces === 'object') for (const [k, n] of Object.entries(m.pieces).slice(0, 200)) { const q = cnt(n, 999); if (q && /^[^|]{1,40}\|[^|]{1,40}$/.test(k)) pieces[k] = q; }
    return { id: /^[\w-]{1,30}$/.test(m && m.id) ? m.id : uid(), name: str(m && m.name, 60).trim() || 'My map', designer: str(m && m.designer, 40).trim(), note: noteStr(m && m.note, 1000).trim(), kits, pieces, pdf: str(m && m.pdf, 120) };
  };
  registerSaved({
    key: 'mymaps', label: 'your own maps',
    get: () => MYMAPS.map((m) => ({ ...m, kits: { ...m.kits }, pieces: { ...m.pieces } })),
    clean: (v) => (Array.isArray(v) ? v : []).slice(0, 300).map(cleanMyMap),
    apply: (v, merge) => {
      if (!merge) MYMAPS.length = 0;
      for (const m of v || []) { const i = MYMAPS.findIndex((x) => x.id === m.id); if (i < 0) MYMAPS.push(m); else if (!merge) MYMAPS[i] = m; }
    }
  });
  const pdfKey = (id) => 'mymap:' + id;
  ON_ERASE.push(() => { for (const m of MYMAPS) IDB.del(pdfKey(m.id)).catch(() => {}); });
  const mm = (c) => root.querySelector('#maps .' + c);
  const MM = { edit: null, kits: {}, pieces: {}, file: null, msg: '' };
  function mmReset() {
    MM.edit = null; MM.kits = {}; MM.pieces = {}; MM.file = null;
    mm('mm-form').reset(); mm('mm-cancel').hidden = true; mm('mm-title').textContent = 'Add a map'; mm('mm-pdfname').textContent = '';
  }
  const terrainProds = () => (DATA('products') || []).filter((p) => (p.terrain || []).length);
  function mmSizes(t) {
    const T = RAW('terrain'); const tt = T.types.find((x) => x.id === t);
    const from = [...new Set((RAW('products') || []).flatMap((p) => p.terrain || []).filter((x) => x.t === t).map((x) => x.s))];
    const tiled = tt && !/Trees|Outcrops/.test(tt.group) && from.some((x) => /^\d+$/.test(x));
    return [...new Set([...(tiled ? T.sizes : []), ...from])].sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0) || a.localeCompare(b));
  }
  function drawMmForm() {
    const T = RAW('terrain'); if (!T) return;
    const sel = mm('mm-ptype');
    if (!sel.options.length) {
      for (const t of T.types) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); }
      sel.addEventListener('change', fillSizes); fillSizes();
    }
    const grid = mm('mm-kits'); grid.replaceChildren();
    for (const p of terrainProds()) {
      const l = mk('label', 'hs-field', p.name); const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.max = '9'; i.className = 'hs-num'; i.value = String(MM.kits[p.id] || 0);
      i.addEventListener('change', () => { const n = cnt(i.value, 9); if (n) MM.kits[p.id] = n; else delete MM.kits[p.id]; });
      l.appendChild(i); grid.appendChild(l);
    }
    const box = mm('mm-pieces'); box.replaceChildren();
    const keys = Object.keys(MM.pieces);
    if (!keys.length) box.appendChild(mk('p', 'hs-note', 'No pieces yet.'));
    for (const k of keys) {
      const [t, s] = k.split('|'); const row = mk('div', 'mm-prow');
      const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.max = '999'; i.className = 'hs-num'; i.value = String(MM.pieces[k]); i.setAttribute('aria-label', pieceName(t) + ' ' + sizeName(s));
      i.addEventListener('change', () => { const n = cnt(i.value, 999); if (n) MM.pieces[k] = n; else { delete MM.pieces[k]; drawMmForm(); } });
      row.append(i, mk('span', '', `${pieceName(t)}, ${sizeName(s)}`), btn('Remove', 'hs-sm', () => { delete MM.pieces[k]; drawMmForm(); }));
      box.appendChild(row);
    }
  }
  function fillSizes() {
    const sz = mm('mm-psize'); sz.replaceChildren();
    for (const s of mmSizes(mm('mm-ptype').value)) { const o = document.createElement('option'); o.value = s; o.textContent = sizeName(s); sz.appendChild(o); }
  }
  mm('mm-padd').addEventListener('click', () => {
    const t = mm('mm-ptype').value, s = mm('mm-psize').value, n = cnt(mm('mm-pn').value, 999);
    if (!t || !s || !n) return;
    const k = t + '|' + s; MM.pieces[k] = Math.min(999, (MM.pieces[k] || 0) + n); drawMmForm();
  });
  mm('mm-pdf').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; MM.file = f || null; });
  mm('mm-cancel').addEventListener('click', () => { mmReset(); drawMine(); });
  mm('mm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const old = MM.edit ? MYMAPS.find((m) => m.id === MM.edit) : null;
    const m = cleanMyMap({ id: old ? old.id : uid(), name: mm('mm-name').value, designer: mm('mm-designer').value, note: mm('mm-note').value, kits: MM.kits, pieces: MM.pieces, pdf: old ? old.pdf : '' });
    if (MM.file) {
      try { await IDB.put(pdfKey(m.id), { name: MM.file.name, bytes: new Uint8Array(await MM.file.arrayBuffer()) }); m.pdf = str(MM.file.name, 120); }
      catch (err) { MM.msg = 'The PDF could not be kept in this browser.'; }
    }
    if (old) MYMAPS[MYMAPS.indexOf(old)] = m; else MYMAPS.push(m);
    MM.msg = (old ? 'Saved ' : 'Added ') + m.name + '.';
    mmReset(); persist(); drawMine();
  });
  function editMine(m) {
    mmReset(); MM.edit = m.id; MM.kits = { ...m.kits }; MM.pieces = { ...m.pieces };
    mm('mm-name').value = m.name; mm('mm-designer').value = m.designer; mm('mm-note').value = m.note;
    mm('mm-pdfname').textContent = m.pdf ? 'Kept: ' + m.pdf + ' (choose a file to replace it)' : '';
    mm('mm-title').textContent = 'Edit ' + m.name; mm('mm-cancel').hidden = false;
    drawMine(); mm('mm-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function viewMine(m) {
    const v = await IDB.get(pdfKey(m.id)).catch(() => null);
    if (v && v.bytes) viewPdf(m.name, v.bytes); else ask({ title: 'No PDF in this browser', msg: 'This map’s PDF isn’t kept in this browser. Edit the map to add it, or import an export file that has it.', alert: true });
  }
  function drawMine() {
    drawMmForm();
    mm('mm-msg').textContent = MM.msg; MM.msg = '';
    const box = mm('mm-list'); box.replaceChildren();
    if (!MYMAPS.length) { box.appendChild(mk('div', 'hs-card hs-empty', 'No maps of your own yet.')); return; }
    const grid = mk('div', 'm-grid');
    for (const m of MYMAPS) {
      const c = mk('div', 'm-card'), head = mk('div', 'm-head');
      head.appendChild(mk('b', 'm-name', m.name));
      if (Object.keys(m.kits).length) { const can = canBuildWith(m.kits, PROD_OWN); head.appendChild(mk('span', 'hs-pill ' + (can ? 'ok' : 'bad'), can ? 'You can build it' : 'Missing products')); }
      c.appendChild(head);
      if (m.designer) c.appendChild(mk('div', 'hs-note', 'By ' + m.designer));
      if (m.note) c.appendChild(mk('div', 'hs-note mm-note', m.note));
      if (Object.keys(m.kits).length) { const d = mk('div', 'm-opt'); d.appendChild(reqChips(m.kits)); c.appendChild(d); }
      if (Object.keys(m.pieces).length) c.appendChild(piecesBox(m.pieces, 'Pieces'));
      const act = mk('div', 'm-act');
      if (m.pdf) act.appendChild(btn('View map', 'hs-sm hs-primary', () => viewMine(m)));
      act.appendChild(btn('Edit', 'hs-sm', () => editMine(m)));
      act.appendChild(btn('Delete', 'hs-sm', async () => {
        if (!await ask({ title: 'Delete ' + m.name + '?', msg: 'This removes the map and its PDF from this browser.', ok: 'Delete' })) return;
        MYMAPS.splice(MYMAPS.indexOf(m), 1); IDB.del(pdfKey(m.id)).catch(() => {});
        if (MM.edit === m.id) mmReset();
        persist(); drawMine();
      }));
      c.appendChild(act);
      grid.appendChild(c);
    }
    box.appendChild(grid);
  }
  // export / import: the maps plus their PDFs (base64) in one file
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  mm('mm-export').addEventListener('click', async () => {
    if (!MYMAPS.length) { mm('mm-iomsg').textContent = 'You have no maps to export yet.'; return; }
    const maps = [];
    for (const m of MYMAPS) {
      const v = m.pdf ? await IDB.get(pdfKey(m.id)).catch(() => null) : null;
      maps.push({ ...m, ...(v && v.bytes ? { pdfData: b64(v.bytes) } : {}) });
    }
    const name = `heroscape-my-maps-${today()}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'heroscape-tracker-maps', format: 1, maps })], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    mm('mm-iomsg').textContent = 'Saved ' + name + '.';
  });
  mm('mm-import').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || o.app !== 'heroscape-tracker-maps' || !Array.isArray(o.maps)) throw new Error('This is not a maps file from Heroscape Tracker.');
      let n = 0;
      for (const raw of o.maps.slice(0, 300)) {
        const m = cleanMyMap(raw);
        if (MYMAPS.some((x) => x.id === m.id)) m.id = uid();
        if (typeof raw.pdfData === 'string' && raw.pdfData.length < 40e6) {
          try { await IDB.put(pdfKey(m.id), { name: m.pdf || m.name + '.pdf', bytes: unb64(raw.pdfData) }); m.pdf = m.pdf || m.name + '.pdf'; } catch (err) { m.pdf = ''; }
        } else m.pdf = '';
        MYMAPS.push(m); n++;
      }
      persist(); drawMine();
      mm('mm-iomsg').textContent = `Added ${n} map${n === 1 ? '' : 's'}.`;
    } catch (err) { mm('mm-iomsg').textContent = err.message || 'That file could not be read.'; }
  });
  // ---------- colors ----------
  const THEME = { mode: '', colors: {}, fiddles: 0, unlocked: false, pride: '', site: '' };
  // site themes made by the site owner in edit mode (edit.js fills these); a visitor's own colors still win
  let SITE_THEMES = [], SITE_PREVIEW = null, SITE_HOOK = null;
  // a theme can be locked until the visitor earns an achievement (BADGES and allStats live in play.js)
  function themeOpen(t) {
    if (!t.unlock) return true;
    try { const b = BADGES.find((x) => x[0] === t.unlock); return !b || !!b[4](allStats()); } catch (e) { return false; }
  }
  const siteTheme = () => {
    if (SITE_PREVIEW != null) return SITE_THEMES.find((t) => t.id === SITE_PREVIEW) || null;
    const t = SITE_THEMES.find((x) => x.id === THEME.site);
    return t && themeOpen(t) ? t : null;
  };
  const DEFAULT_ACCENT = '#6b3fa0';
  const PRESETS = [
    ['Violet', ''], ['Jandar blue', '#2b6cb0'], ['Utgar crimson', '#b83232'], ['Ullar forest', '#3f7d3a'],
    ['Vydar steel', '#5a6b7d'], ['Einar gold', '#b7791f'], ['Aquilla teal', '#1f8a8a'], ['Valhalla green', '#2f6b4f'], ['Volarak copper', '#b5652b']
  ];
  // unlocked by the hidden "True colors" achievement; the accent drifts slowly through each flag's stripes
  const FLAGS = {
    gay: ['Gay rights', ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004cff', '#732982']],
    lesbian: ['Lesbian rights', ['#d52d00', '#ff9a56', '#ffffff', '#d362a4', '#a30262']],
    trans: ['Trans rights', ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa']]
  };
  const EGG_AT = 10; // color changes before the hidden achievement unlocks
  const COLOR_KEYS = ['accent', 'color-bg', 'color-panel', 'color-fg', 'color-fg-muted', 'color-border-line'];
  const hex = (v) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : null;
  let prideTimer = null;
  function mixHex(a, b, f) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    return '#' + [16, 8, 0].map((k) => Math.round((x >> k & 255) * (1 - f) + (y >> k & 255) * f).toString(16).padStart(2, '0')).join('');
  }
  function prideRun() {
    clearInterval(prideTimer); prideTimer = null;
    if (!THEME.pride || !FLAGS[THEME.pride]) return;
    const cols = FLAGS[THEME.pride][1], de = document.documentElement, t0 = performance.now(), STEP = 3000;
    const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const t = (performance.now() - t0) / STEP, i = Math.floor(t) % cols.length;
      const c = mixHex(cols[i], cols[(i + 1) % cols.length], still ? 0 : t % 1);
      de.style.setProperty('--accent', c); de.style.setProperty('--accent-fg', contrastOn(c));
    };
    tick();
    prideTimer = setInterval(tick, still ? STEP : 100);
  }
  function applyTheme() {
    const de = document.documentElement;
    const st = siteTheme(), cols = { ...(st ? st.colors : {}), ...THEME.colors }, mode = THEME.mode || (st ? st.mode : '');
    if (mode) de.setAttribute('data-theme', mode); else de.removeAttribute('data-theme');
    for (const k of COLOR_KEYS) { if (cols[k]) de.style.setProperty('--' + k, cols[k]); else de.style.removeProperty('--' + k); }
    if (cols.accent) de.style.setProperty('--accent-fg', contrastOn(cols.accent)); else de.style.removeProperty('--accent-fg');
    prideRun();
    if (SITE_HOOK) SITE_HOOK();
  }
  function contrastOn(h) {
    const n = parseInt(h.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#ffffff';
  }
  function fiddle() {
    THEME.fiddles = Math.min(9999, THEME.fiddles + 1);
    if (!THEME.unlocked && THEME.fiddles >= EGG_AT) {
      THEME.unlocked = true;
      root.querySelector('.st-egg').textContent = 'Hidden achievement unlocked: True colors! Three new accent colors were added above.';
    }
  }
  registerSaved({
    key: 'theme', label: 'colors',
    get: () => ({ mode: THEME.mode, colors: { ...THEME.colors }, fiddles: THEME.fiddles, unlocked: THEME.unlocked, pride: THEME.pride, site: THEME.site }),
    clean: (o) => {
      const colors = {};
      if (o && o.colors && typeof o.colors === 'object') for (const k of COLOR_KEYS) { const h = hex(o.colors[k]); if (h) colors[k] = h; }
      const unlocked = !!(o && o.unlocked);
      return { mode: ['light', 'dark'].includes(o && o.mode) ? o.mode : '', colors, fiddles: cnt(o && o.fiddles, 9999), unlocked, pride: unlocked && FLAGS[o && o.pride] ? o.pride : '', site: str(o && o.site, 30) };
    },
    apply: (v, merge) => {
      if (merge && !v) return;
      if (merge) { THEME.unlocked = THEME.unlocked || v.unlocked; THEME.fiddles = Math.max(THEME.fiddles, v.fiddles); }
      if (merge && (THEME.mode || Object.keys(THEME.colors).length || THEME.pride)) { applyTheme(); return; }
      THEME.mode = v ? v.mode : ''; THEME.colors = v ? { ...v.colors } : {}; THEME.pride = v ? v.pride : ''; THEME.site = v ? v.site : '';
      if (!merge) { THEME.fiddles = v ? v.fiddles : 0; THEME.unlocked = v ? v.unlocked : false; }
      applyTheme();
    }
  });
  segBind('.st-mode', 'm', (v) => { THEME.mode = v; applyTheme(); });
  const presetBox = root.querySelector('.st-presets');
  function presetBtn(name, value, swatch, onPick) {
    const b = mk('button', 'st-preset'); b.type = 'button'; b.dataset.c = value;
    const sw = mk('span', 'sw'); sw.style.background = swatch;
    b.append(sw, document.createTextNode(name));
    b.addEventListener('click', () => { onPick(); fiddle(); applyTheme(); draw(); });
    return b;
  }
  function drawPresets() {
    presetBox.replaceChildren();
    for (const [name, c] of PRESETS) presetBox.appendChild(presetBtn(name, c, c || DEFAULT_ACCENT, () => { THEME.pride = ''; if (c) THEME.colors.accent = c; else delete THEME.colors.accent; }));
    if (!THEME.unlocked) return;
    for (const [id, [name, cols]] of Object.entries(FLAGS)) {
      const stripes = 'linear-gradient(180deg, ' + cols.map((c, i) => `${c} ${i / cols.length * 100}% ${(i + 1) / cols.length * 100}%`).join(', ') + ')';
      presetBox.appendChild(presetBtn(name, 'flag:' + id, stripes, () => { THEME.pride = id; delete THEME.colors.accent; }));
    }
  }
  // phone color pickers don't all fire "change", so a pause after typing/dragging a new value counts as one change
  let fiddleTimer = null;
  const fiddleSoon = () => { clearTimeout(fiddleTimer); fiddleTimer = setTimeout(() => { fiddle(); draw(); }, 600); };
  root.querySelectorAll('.st-custom input[type=color]').forEach((inp) => {
    inp.addEventListener('input', () => { if (inp.dataset.c === 'accent') THEME.pride = ''; THEME.colors[inp.dataset.c] = inp.value; applyTheme(); persist(); fiddleSoon(); });
    inp.addEventListener('change', fiddleSoon);
  });
  // randomize: new hue and saturation, same lightness as now, so text stays readable
  const hexToHsl = (h) => {
    const n = parseInt(h.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    return [0, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
  };
  const hslToHex = (h, s, l) => {
    const f = (k) => { const a = s * Math.min(l, 1 - l), m = (k + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(m - 3, 9 - m, 1)))).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  };
  const SAT = { accent: [0.45, 0.8], 'color-bg': [0.1, 0.35], 'color-panel': [0.08, 0.3], 'color-fg': [0.1, 0.3], 'color-fg-muted': [0.06, 0.2], 'color-border-line': [0.1, 0.3] };
  function randomColor(k, hue) {
    const cs = getComputedStyle(document.documentElement);
    const [, , l] = hexToHsl(THEME.colors[k] || toHex(cs.getPropertyValue('--' + k)));
    const [lo, hi] = SAT[k];
    return hslToHex(hue == null ? Math.random() * 360 : hue, lo + Math.random() * (hi - lo), Math.min(0.97, Math.max(0.06, l)));
  }
  function randomize(keys) {
    const hue = Math.random() * 360;
    for (const k of keys) THEME.colors[k] = randomColor(k, keys.length > 1 && k !== 'accent' ? hue : null);
    if (keys.includes('accent')) THEME.pride = '';
    fiddle(); applyTheme(); draw();
  }
  root.querySelectorAll('.st-custom input[type=color]').forEach((inp) => {
    const b = btn('Randomize', 'hs-sm st-rand', () => randomize([inp.dataset.c]));
    b.setAttribute('aria-label', 'Randomize ' + inp.parentElement.firstChild.textContent.trim().toLowerCase());
    inp.after(b);
  });
  root.querySelector('.st-randall').addEventListener('click', () => randomize(COLOR_KEYS));
  root.querySelector('.st-reset').addEventListener('click', () => { THEME.colors = {}; THEME.mode = ''; THEME.pride = ''; fiddle(); applyTheme(); draw(); });
  function drawSettings() {
    segSync('.st-mode', 'm', THEME.mode);
    // site themes to choose from
    const sw = root.querySelector('.st-sitewrap'), sb = root.querySelector('.st-site');
    sb.replaceChildren();
    root.querySelector('.st-mine').hidden = !SITE_THEMES.some((t) => t.mine);
    root.querySelector('.st-dq input').checked = DRAWSQ.on;
    const cur = siteTheme() ? siteTheme().id : '';
    // a theme behind a hidden achievement stays out of sight until it is earned
    const secretLock = (t) => { const bd = BADGES.find((x) => x[0] === t.unlock); return !!(bd && bd[5]) && !themeOpen(t); };
    for (const t of [{ id: '', name: 'Standard' }, ...SITE_THEMES.filter((t) => !secretLock(t))]) {
      const open = !t.id || themeOpen(t);
      const b = mk('button', open ? '' : 'locked', (open ? '' : '🔒 ') + t.name + (t.mine ? ' (mine)' : '')); b.type = 'button'; b.setAttribute('aria-pressed', String(cur === t.id));
      if (open) b.addEventListener('click', () => { THEME.site = t.id; applyTheme(); draw(); });
      else {
        const bd = BADGES.find((x) => x[0] === t.unlock);
        b.disabled = true; b.title = 'Unlocks with the achievement: ' + (bd ? bd[1] : t.unlock);
      }
      sb.appendChild(b);
    }
    const locked = SITE_THEMES.filter((t) => !themeOpen(t) && !secretLock(t));
    root.querySelector('.st-sitenote').textContent = locked.length ? 'Locked themes unlock when you earn their achievement on the Player card page.' : '';
    drawPresets();
    const on = THEME.pride ? 'flag:' + THEME.pride : (THEME.colors.accent || '');
    presetBox.querySelectorAll('.st-preset').forEach((b) => b.setAttribute('aria-pressed', String(on === b.dataset.c)));
    const cs = getComputedStyle(document.documentElement);
    root.querySelectorAll('.st-custom input[type=color]').forEach((inp) => { if (document.activeElement !== inp) inp.value = THEME.colors[inp.dataset.c] || toHex(cs.getPropertyValue('--' + inp.dataset.c)); });
    drawCustomLists();
  }
  function toHex(v) {
    v = String(v).trim(); if (hex(v)) return v.toLowerCase();
    const m = v.match(/\d+/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
  }

  // ---------- your own army cards and abilities ----------
  const CUSTOM_UNITS = [];      // { unit, faction, ctype, species, cls, pers, size, sizenum, points, figures, life, move, range, attack, defense, abilities: [{ability, text}] }
  const CUSTOM_ABILS = [];      // { unit, ability, text } added to existing cards
  const CTEXT = (v, n) => str(v, n).trim();
  const CNUM = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  function cleanUnit(u) {
    if (!u || typeof u !== 'object') return null;
    const unit = CTEXT(u.unit, 60); if (!unit) return null;
    return {
      unit, faction: CTEXT(u.faction, 30) || 'Custom', ctype: CTEXT(u.ctype, 30) || 'Unique Hero', species: CTEXT(u.species, 30), cls: CTEXT(u.cls, 30), pers: CTEXT(u.pers, 30),
      size: ['Small', 'Medium', 'Large', 'Huge'].includes(u.size) ? u.size : 'Medium', sizenum: CNUM(u.sizenum, 1, 20, 5),
      points: CNUM(u.points, 1, 999, 100), figures: CNUM(u.figures, 1, 12, 1), life: CNUM(u.life, 1, 20, 1), move: CNUM(u.move, 0, 20, 5), range: CNUM(u.range, 1, 20, 1),
      attack: CNUM(u.attack, 0, 20, 3), defense: CNUM(u.defense, 0, 20, 3),
      abilities: (Array.isArray(u.abilities) ? u.abilities : []).slice(0, 16).map((a) => ({ ability: CTEXT(a && a.ability, 60), text: CTEXT(a && a.text, 1500) })).filter((a) => a.ability)
    };
  }
  registerSaved({
    key: 'custom', label: 'custom cards',
    get: () => ({ units: CUSTOM_UNITS.map((u) => ({ ...u, abilities: u.abilities.map((a) => ({ ...a })) })), abilities: CUSTOM_ABILS.map((a) => ({ ...a })) }),
    clean: (o) => ({
      units: (Array.isArray(o && o.units) ? o.units : []).slice(0, 300).map(cleanUnit).filter(Boolean),
      abilities: (Array.isArray(o && o.abilities) ? o.abilities : []).slice(0, 500).map((a) => ({ unit: CTEXT(a && a.unit, 120), ability: CTEXT(a && a.ability, 60), text: CTEXT(a && a.text, 600) })).filter((a) => a.unit && a.ability)
    }),
    apply: (v, merge) => {
      if (!merge) { CUSTOM_UNITS.length = 0; CUSTOM_ABILS.length = 0; }
      if (!v) return;
      for (const u of v.units) { const i = CUSTOM_UNITS.findIndex((x) => x.unit === u.unit); if (i < 0) CUSTOM_UNITS.push(u); else if (!merge) CUSTOM_UNITS[i] = u; }
      for (const a of v.abilities) if (!CUSTOM_ABILS.some((x) => x.unit === a.unit && x.ability === a.ability)) CUSTOM_ABILS.push(a);
    }
  });
  // your edits to existing cards ("Edit any card", saved over the original): unit -> the whole card as you edited it
  const CARD_EDITS = {};
  registerSaved({
    key: 'cardedits', label: 'card edits',
    get: () => JSON.parse(JSON.stringify(CARD_EDITS)),
    clean: (o) => {
      const out = {};
      if (o && typeof o === 'object') for (const [n, e] of Object.entries(o).slice(0, 400)) {
        const u = cleanUnit({ ...e, unit: n }); if (!u) continue;
        u.unit = CTEXT(n, 120); u.errata = CTEXT(e && e.errata, 600); out[u.unit] = u;
      }
      return out;
    },
    apply: (v, merge) => {
      if (!merge) for (const k of Object.keys(CARD_EDITS)) delete CARD_EDITS[k];
      for (const [n, e] of Object.entries(v || {})) if (!merge || !CARD_EDITS[n]) CARD_EDITS[n] = e;
    }
  });
  // the card's stats in the same shape as the real card data (per-100 numbers worked out from the printed stats)
  function cardStats(u) {
    const k = (v) => Math.round(v * u.figures / u.points * 1000) / 10;
    const r = {
      points: u.points, card_points: u.points, figures: u.figures, life: u.life, attack: u.attack, defense: u.defense,
      faction: u.faction, species: u.species, ctype: u.ctype, cls: u.cls, pers: u.pers, size: u.size, sizenum: u.sizenum, size_full: u.size + ' ' + u.sizenum,
      abilities: u.abilities.map((a) => a.ability).join('; '), life100: k(u.life)
    };
    for (const s of ['p', 's', 'c']) {
      r['move_' + s] = u.move; r['range_' + s] = u.range;
      r['ad_' + s] = u.attack + u.defense; r['tot_' + s] = u.attack + u.defense + u.life;
      r['atk100_' + s] = k(u.attack); r['def100_' + s] = k(u.defense); r['atkdef100_' + s] = k(u.attack + u.defense); r['total100_' + s] = k(u.attack + u.defense + u.life);
    }
    r.atk_s = r.atk_c = u.attack; r.def_s = r.def_c = u.defense;
    return r;
  }
  // apply your edits to the card rows (after the FAQ points errata, so yours win)
  function applyCardEdits(rows) {
    for (const r of rows) {
      const e = CARD_EDITS[r.unit]; if (!e) continue;
      Object.assign(r, cardStats(e), { edited: true, errataPts: false, aoe: '', special: '', cond: '', mr_note: '' });
    }
  }
  const editedAbilities = (n) => {
    const e = CARD_EDITS[n]; if (!e) return null;
    const out = e.abilities.map((a) => ({ unit: n, ability: a.ability, text: a.text, note: 'Edited by you.', custom: true, mine: true }));
    if (e.errata) out.push({ unit: n, ability: 'Your errata', text: e.errata, note: '', custom: true, mine: true });
    return out;
  };
  // a custom card in the same shape as the real card data, so every page can use it
  function customRows() {
    return CUSTOM_UNITS.map((u) => {
      const k = (v) => Math.round(v * u.figures / u.points * 1000) / 10;
      const r = {
        unit: u.unit, custom: true, points: u.points, card_points: u.points, figures: u.figures, life: u.life, attack: u.attack, defense: u.defense, aoe: '',
        faction: u.faction, species: u.species, ctype: u.ctype, cls: u.cls, pers: u.pers, size: u.size, sizenum: u.sizenum, size_full: u.size + ' ' + u.sizenum,
        bond: 'No', bonding: '', bond_rules: '', special: '', cond: '', mr_note: '',
        abilities: u.abilities.map((a) => a.ability).join('; '), life100: k(u.life)
      };
      for (const s of ['p', 's', 'c']) {
        r['move_' + s] = u.move; r['range_' + s] = u.range;
        r['ad_' + s] = u.attack + u.defense; r['tot_' + s] = u.attack + u.defense + u.life;
        r['atk100_' + s] = k(u.attack); r['def100_' + s] = k(u.defense); r['atkdef100_' + s] = k(u.attack + u.defense); r['total100_' + s] = k(u.attack + u.defense + u.life);
      }
      r.atk_s = r.atk_c = u.attack; r.def_s = r.def_c = u.defense;
      return r;
    });
  }
  function customAbilities() {
    const out = [];
    for (const u of CUSTOM_UNITS) for (const a of u.abilities) out.push({ unit: u.unit, ability: a.ability, text: a.text, note: '', custom: true });
    for (const a of CUSTOM_ABILS) out.push({ unit: a.unit, ability: a.ability, text: a.text, note: 'Added by you.', custom: true });
    return out;
  }
  function addCustomAbilityNames(rows) {
    if (!CUSTOM_ABILS.length) return;
    const by = d3.group(CUSTOM_ABILS, (a) => a.unit);
    for (const r of rows) { const extra = by.get(r.unit); if (extra) r.abilities = [r.abilities, ...extra.map((a) => a.ability)].filter(Boolean).join('; '); }
  }
  // form: custom card
  const cuForm = root.querySelector('.cu-form'), cuAbs = root.querySelector('.cu-abs');
  let CU_EDIT = null;
  function abLine(a) {
    const row = mk('div', 'hs-armyadd cu-ab');
    const l1 = mk('label', 'hs-field', 'Ability name'); const n = document.createElement('input'); n.type = 'text'; n.maxLength = 60; n.className = 'cu-abn'; n.value = a ? a.ability : ''; l1.appendChild(n);
    const l2 = mk('label', 'hs-field cu-abt', 'Ability text'); const t = document.createElement('textarea'); t.rows = 2; t.maxLength = 1500; t.className = 'cu-abx'; t.value = a ? a.text : ''; l2.appendChild(t);
    row.append(l1, l2, btn('Remove', 'hs-sm', () => row.remove()));
    cuAbs.appendChild(row);
  }
  root.querySelector('.cu-addab').addEventListener('click', () => abLine());
  const cuMsg = (t, bad) => { const e = root.querySelector('.cu-msg'); e.textContent = t; e.classList.toggle('bad', !!bad); };
  function fillCuForm(u) {
    if (u) cuForm.querySelectorAll('.cu-f').forEach((el) => { el.value = String(u[el.dataset.k] == null ? '' : u[el.dataset.k]); });
    else cuForm.reset();
    if (!u || !CU_OF) {
      CU_OF = null; root.querySelector('.cu-editof').hidden = true; cuForm.querySelector('[data-k="unit"]').disabled = false;
      cuForm.closest('.hs-card').querySelector('h3').textContent = 'Your own army cards';
    }
    cuAbs.replaceChildren(); (u ? u.abilities : [null]).forEach(abLine);
    root.querySelector('.cu-cancel').hidden = !u;
    root.querySelector('.cu-save').textContent = u ? 'Save changes' : 'Save card';
  }
  root.querySelector('.cu-cancel').addEventListener('click', () => { CU_EDIT = null; CU_OF = null; fillCuForm(null); cuMsg(''); });
  cuForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const o = {}; cuForm.querySelectorAll('.cu-f').forEach((el) => { o[el.dataset.k] = el.value; });
    o.abilities = [...cuAbs.querySelectorAll('.cu-ab')].map((r) => ({ ability: r.querySelector('.cu-abn').value, text: r.querySelector('.cu-abx').value }));
    if (CU_OF && CU_SAVEAS === 'over') o.unit = CU_OF;
    const u = cleanUnit(o);
    if (!u) { cuMsg('Give the card a name.', true); return; }
    if (CU_OF && CU_SAVEAS === 'over') {
      u.unit = CU_OF; u.errata = CTEXT(root.querySelector('.cu-errnote').value, 600);
      CARD_EDITS[CU_OF] = u; cuMsg(`Saved your changes to ${CU_OF}.`);
      CU_OF = null; fillCuForm(null); draw(); return;
    }
    if (CU_OF) { const note = CTEXT(root.querySelector('.cu-errnote').value, 600); if (note) u.abilities.push({ ability: 'Errata', text: note }); }
    const clash = (dash.data('units').data || []).some((x) => x.unit === u.unit) || CUSTOM_UNITS.some((x) => x.unit === u.unit && x.unit !== CU_EDIT);
    if (clash) { cuMsg('A card with that name already exists. Pick another name.', true); return; }
    if (CU_EDIT) {
      const i = CUSTOM_UNITS.findIndex((x) => x.unit === CU_EDIT);
      if (CU_EDIT !== u.unit) renameEverywhere(CU_EDIT, u.unit);
      CUSTOM_UNITS[i] = u;
    } else CUSTOM_UNITS.push(u);
    cuMsg(CU_EDIT ? 'Saved.' : `Added ${u.unit}.`);
    CU_EDIT = null; CU_OF = null; fillCuForm(null); draw();
  });
  function renameEverywhere(from, to) {
    for (const a of ARMIES) if (a.map.has(from)) { a.map.set(to, a.map.get(from)); a.map.delete(from); }
    if (COLL.has(from)) { COLL.set(to, COLL.get(from)); COLL.delete(from); }
  }
  // "Edit any card": load a card into the card form below; save over the original or as a new unit
  const caUnit = root.querySelector('.ca-unit');
  let CU_OF = null, CU_SAVEAS = 'over'; // the existing card being edited, and how to save it
  const cuSaveSeg = () => root.querySelectorAll('.cu-saveas button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === CU_SAVEAS)));
  root.querySelectorAll('.cu-saveas button').forEach((b) => b.addEventListener('click', () => {
    CU_SAVEAS = b.dataset.v; cuSaveSeg();
    const nm = cuForm.querySelector('[data-k="unit"]');
    nm.disabled = CU_SAVEAS === 'over';
    if (CU_SAVEAS === 'over') nm.value = CU_OF; else if (nm.value === CU_OF) { nm.value = (CU_OF + ' (mine)').slice(0, 60); nm.select(); }
  }));
  function cardForm(n) {
    const r = ALL_UNITS.find((x) => x.unit === n); if (!r) return null;
    const e = CARD_EDITS[n];
    if (e) return { ...e };
    return {
      unit: n, faction: r.faction, ctype: r.ctype, species: r.species || '', cls: r.cls || '', pers: r.pers || '', size: r.size || 'Medium', sizenum: r.sizenum || 5,
      points: r.points, figures: r.figures, life: r.life, move: r.move_p, range: r.range_p, attack: r.attack, defense: r.defense,
      abilities: (ABIL[n] || []).filter((a) => a.ability !== 'Your errata').map((a) => ({ ability: a.ability, text: a.text })), errata: ''
    };
  }
  function editCard(n) {
    const f = cardForm(n); if (!f) return;
    CU_EDIT = null; CU_OF = n; CU_SAVEAS = 'over'; cuSaveSeg();
    fillCuForm(f);
    cuForm.querySelector('[data-k="unit"]').disabled = true;
    root.querySelector('.cu-errnote').value = f.errata || '';
    root.querySelector('.cu-editof').hidden = false;
    root.querySelector('.cu-cancel').hidden = false;
    root.querySelector('.cu-save').textContent = 'Save';
    cuForm.closest('.hs-card').querySelector('h3').textContent = 'Editing ' + n;
    cuForm.scrollIntoView({ block: 'start' });
  }
  root.querySelector('.ca-load').addEventListener('click', () => { if (caUnit.value) editCard(caUnit.value); else root.querySelector('.ca-msg').textContent = 'Choose a card first.'; });
  function drawCustomLists() {
    const names = UNITS.filter((u) => !u.custom).map((u) => u.unit).sort((a, b) => a.localeCompare(b));
    if (caUnit.options.length !== names.length + 1) { const v = caUnit.value; caUnit.replaceChildren(new Option('Choose a card…', ''), ...names.map((n) => new Option(n, n))); caUnit.value = v; }
    const dl = root.querySelector('#cu-facs'); dl.replaceChildren(...[...new Set(UNITS.map((u) => u.faction))].sort().map((f) => new Option(f)));
    const cl = root.querySelector('.ca-list'); cl.replaceChildren();
    const edited = Object.keys(CARD_EDITS).sort((a, b) => a.localeCompare(b));
    if (edited.length) cl.appendChild(mk('div', 'hs-note', 'Cards you edited:'));
    for (const n of edited) {
      const d = mk('div', 'cu-item'); d.append(mk('b', '', n), document.createTextNode(' '));
      d.append(btn('Edit', 'hs-sm', () => editCard(n), 'Edit ' + n), document.createTextNode(' '),
        btn('Undo my changes', 'hs-sm', async () => { if (!await ask({ title: `Go back to the original ${n}?`, ok: 'Undo changes' })) return; delete CARD_EDITS[n]; draw(); }, 'Undo changes to ' + n));
      cl.appendChild(d);
    }
    if (CUSTOM_ABILS.length) cl.appendChild(mk('div', 'hs-note', 'Abilities you added:'));
    for (const a of CUSTOM_ABILS) {
      const d = mk('div', 'cu-item'); d.append(mk('b', '', a.ability), document.createTextNode(' on ' + a.unit + ' '));
      d.appendChild(btn('Delete', 'hs-sm', () => { CUSTOM_ABILS.splice(CUSTOM_ABILS.indexOf(a), 1); draw(); }, 'Delete ' + a.ability));
      cl.appendChild(d);
    }
    const ul = root.querySelector('.cu-list'); ul.replaceChildren();
    if (!CUSTOM_UNITS.length) { ul.appendChild(mk('p', 'hs-empty', 'No custom cards yet.')); return; }
    const t = mk('table', 'hs-a'); const hr = t.createTHead().insertRow();
    for (const h of ['Card', 'Faction', 'Type', 'Pts', 'Life', 'Mv', 'Rg', 'Atk', 'Def', '']) hr.appendChild(mk('th', /Card|Faction|Type/.test(h) ? 'l' : '', h));
    const tb = t.createTBody();
    for (const u of CUSTOM_UNITS) {
      const tr = tb.insertRow();
      const nm = mk('td', 'l nm', u.unit); nm.addEventListener('click', () => { const r = UNITS.find((x) => x.unit === u.unit); if (r) openCard(r); }); tr.appendChild(nm);
      for (const v of [u.faction, u.ctype]) tr.appendChild(mk('td', 'l', v));
      for (const v of [u.points, u.life, u.move, u.range, u.attack, u.defense]) tr.appendChild(mk('td', '', String(v)));
      const act = mk('td');
      act.append(btn('Edit', 'hs-sm', () => { CU_EDIT = u.unit; fillCuForm(u); cuForm.scrollIntoView({ block: 'start' }); }), document.createTextNode(' '),
        btn('Delete', 'hs-sm', () => { CUSTOM_UNITS.splice(CUSTOM_UNITS.indexOf(u), 1); for (const a of ARMIES) a.map.delete(u.unit); draw(); }, 'Delete ' + u.unit));
      tr.appendChild(act);
    }
    const w = mk('div', 'hs-scroll'); w.appendChild(t); ul.appendChild(w);
  }
  fillCuForm(null);

  // ---------- random picks ----------
  const ruOwn = root.querySelector('.ru-own'), raOwn = root.querySelector('.ra-own'), raShare = root.querySelector('.ra-share');
  let RAND_ROWS = [];
  function drawRandom(rows) { RAND_ROWS = rows; }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function unitTile(r, extra, noPic) {
    const d = mk('div', 'ru-card');
    const src = noPic ? null : imgFor(r.unit);
    if (src) { const im = document.createElement('img'); im.src = src; im.alt = r.unit + ' army card'; im.loading = 'lazy'; d.appendChild(im); }
    const t = mk('div', 'ru-txt');
    t.appendChild(mk('b', '', r.unit));
    t.appendChild(mk('div', 'hs-note', `${r.faction} · ${r.ctype} · ${r.points} points · ${r.figures} figure${r.figures > 1 ? 's' : ''}`));
    if (extra) t.appendChild(extra);
    const row = mk('div', 'm-act'); row.append(btn('Open card', 'hs-sm', () => openCard(r)), btn('Add to army', 'hs-sm', () => addUnit(r)));
    t.appendChild(row); d.appendChild(t);
    return d;
  }
  // home page: one random army card picture (opens the card when clicked)
  let HOME_PICK = null;
  root.querySelector('.hu-next').addEventListener('click', () => {
    const pool = UNITS.filter((u) => !u.custom && u.unit !== HOME_PICK && imgFor(u.unit));
    if (pool.length) HOME_PICK = pool[Math.floor(Math.random() * pool.length)].unit;
    drawHome();
  });
  function drawHome() {
    const out = root.querySelector('.hu-out');
    const C = dash.data('cards');
    const real = UNITS.filter((u) => !u.custom);
    if (C.status !== 'ok' || !real.length) { out.replaceChildren(); return; }
    if (!HOME_PICK || !imgFor(HOME_PICK) || !real.some((u) => u.unit === HOME_PICK)) {
      const pool = real.filter((u) => imgFor(u.unit));
      if (!pool.length) { HOME_PICK = null; delete out.dataset.unit; out.replaceChildren(); return; }
      HOME_PICK = pool[Math.floor(Math.random() * pool.length)].unit;
    }
    if (out.dataset.unit === HOME_PICK) return;
    const r = UNITS.find((u) => u.unit === HOME_PICK);
    const im = document.createElement('img'); im.src = imgFor(r.unit); im.alt = r.unit + ' army card';
    im.tabIndex = 0; im.addEventListener('click', () => openCard(r)); im.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCard(r); });
    out.dataset.unit = HOME_PICK;
    // keep the old picture up until the new one is decoded, so the page doesn't blink or jump
    const swap = () => { if (out.dataset.unit === r.unit) out.replaceChildren(im); };
    if (out.firstChild && im.decode) im.decode().then(swap, swap); else swap();
  }
  root.querySelector('.ru-go').addEventListener('click', () => {
    const pool = RAND_ROWS.filter((r) => !ruOwn.checked || ownedOf(r.unit) > 0);
    const out = root.querySelector('.ru-out');
    if (!pool.length) { out.replaceChildren(mk('p', 'hs-empty', ruOwn.checked ? 'No cards in your collection match the filters.' : 'No cards match the filters.')); return; }
    out.replaceChildren(unitTile(pool[Math.floor(Math.random() * pool.length)]));
  });
  root.querySelector('.ra-go').addEventListener('click', () => {
    const pts = CNUM(root.querySelector('.ra-pts').value, 50, 3000, 500), n = CNUM(root.querySelector('.ra-n').value, 1, 12, 2), slack = CNUM(root.querySelector('.ra-slack').value, 0, 200, 30);
    const useOwn = raOwn.checked;
    const out = root.querySelector('.ra-out'); out.replaceChildren();
    const shared = new Map(UNITS.map((u) => [u.unit, ownedOf(u.unit)]));
    const armies = [];
    for (let k = 0; k < n; k++) {
      let best = null;
      for (let attempt = 0; attempt < 300; attempt++) {
        const left = useOwn ? new Map(raShare.checked ? shared : UNITS.map((u) => [u.unit, ownedOf(u.unit)])) : null;
        const army = new Map(); let total = 0;
        for (const r of shuffle(RAND_ROWS.slice())) {
          let tries = isUnique(r) ? 1 : 3;
          while (tries-- > 0) {
            if (total + r.points > pts) break;
            if (isUnique(r) && army.has(r.unit)) break;
            if (left && (left.get(r.unit) || 0) <= 0) break;
            if (!isUnique(r) && army.has(r.unit) && Math.random() < 0.6) break;
            army.set(r.unit, (army.get(r.unit) || 0) + 1); total += r.points; if (left) left.set(r.unit, left.get(r.unit) - 1);
          }
          if (pts - total <= slack * 0.2) break;
        }
        if (!best || total > best.total) best = { army, total };
        if (pts - total <= slack) break;
      }
      if (!best || !best.army.size) break;
      if (useOwn && raShare.checked) for (const [u, q] of best.army) shared.set(u, shared.get(u) - q);
      armies.push(best);
    }
    if (!armies.length) { out.appendChild(mk('p', 'hs-empty', useOwn ? 'Your collection has no cards that fit. Count your cards on the Army cards page.' : 'No cards fit those filters and points.')); return; }
    if (armies.length < n) out.appendChild(mk('p', 'hs-note', `Only ${armies.length} arm${armies.length === 1 ? 'y' : 'ies'} could be made from what is left.`));
    armies.forEach((a, i) => {
      const c = mk('div', 'ra-army');
      const h = mk('div', 'm-head'); h.append(mk('b', '', `Random army ${i + 1}`), mk('span', 'hs-pill' + (pts - a.total > slack ? ' warn' : ' ok'), `${a.total} / ${pts} points`));
      c.appendChild(h);
      const ul = mk('ul', 'ra-list');
      for (const [u, q] of [...a.army].sort((x, y) => byName(y[0]).points * y[1] - byName(x[0]).points * x[1])) {
        const r = byName(u); const li = mk('li');
        const b = mk('button', 'hs-linkbtn', u); b.type = 'button'; b.addEventListener('click', () => openCard(r));
        li.append(document.createTextNode(q > 1 ? q + '× ' : ''), b, mk('span', 'hs-note', ` ${r.points * q} pts`)); ul.appendChild(li);
      }
      c.appendChild(ul);
      c.appendChild(btn('Save as an army', 'hs-sm', (e) => {
        ARMIES.push({ name: nextName().replace('Army', 'Random army'), map: new Map(a.army) });
        e.target.textContent = 'Saved to Army builder'; e.target.disabled = true; draw();
      }));
      out.appendChild(c);
    });
  });
  // ---------- my record ----------
  const GAMES = [];  // { id, date, type, res, event, opp, army, fac, map, notes, src }
  const EVENTS = []; // { id, date, type, name, place, size, src }
  const GTYPES = { tournament: 'Tournaments', local: 'Local events', online: 'Online', casual: 'Casual' };
  const RES = { W: 'Win', L: 'Loss', D: 'Draw' };
  const cleanDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : today();
  registerSaved({
    key: 'record', label: 'game record',
    get: () => ({ games: GAMES.map((g) => ({ ...g })), events: EVENTS.map((e) => ({ ...e })) }),
    clean: (o) => ({
      games: (Array.isArray(o && o.games) ? o.games : []).slice(0, 5000).filter((g) => g && RES[g.res]).map((g) => ({
        id: str(g.id, 30) || uid(), date: cleanDate(g.date), type: GTYPES[g.type] ? g.type : 'casual', res: g.res,
        event: str(g.event, 60), opp: str(g.opp, 40), army: str(g.army, 60), fac: str(g.fac, 30), map: str(g.map, 60), notes: str(g.notes, 200), src: str(g.src, 80)
      })),
      events: (Array.isArray(o && o.events) ? o.events : []).slice(0, 2000).filter((e) => e && Number(e.place) >= 1).map((e) => ({
        id: str(e.id, 30) || uid(), date: cleanDate(e.date), type: ['tournament', 'local', 'online'].includes(e.type) ? e.type : 'tournament',
        name: str(e.name, 60) || 'Event', place: cnt(e.place, 999) || 1, size: cnt(e.size, 999), src: str(e.src, 80)
      }))
    }),
    apply: (v, merge) => {
      if (!merge) { GAMES.length = 0; EVENTS.length = 0; }
      if (!v) return;
      for (const g of v.games) if (!GAMES.some((x) => x.id === g.id)) GAMES.push(g);
      for (const e of v.events) if (!EVENTS.some((x) => x.id === e.id)) EVENTS.push(e);
    }
  });
  function recStats() {
    const s = { n: GAMES.length, W: 0, L: 0, D: 0, byType: {}, streak: 0, best: 0, winFacs: new Set() };
    let run = 0;
    for (const g of GAMES.slice().sort((a, b) => a.date.localeCompare(b.date))) {
      s[g.res]++;
      const t = s.byType[g.type] || (s.byType[g.type] = { n: 0, W: 0, L: 0, D: 0 }); t.n++; t[g.res]++;
      if (g.res === 'W') { run++; if (g.fac) s.winFacs.add(g.fac); } else run = 0;
      s.best = Math.max(s.best, run);
    }
    s.streak = run;
    s.rate = s.n ? (s.W + s.D / 2) / s.n : 0;
    const ev = (t) => EVENTS.filter((e) => e.type === t);
    s.tPlayed = ev('tournament').length; s.tWon = ev('tournament').filter((e) => e.place === 1).length;
    s.lPlayed = ev('local').length; s.lWon = ev('local').filter((e) => e.place === 1).length;
    s.podium = EVENTS.filter((e) => e.place <= 3).length;
    s.online = (s.byType.online || { n: 0 }).n;
    return s;
  }
  const rcForm = root.querySelector('.rc-form'), evForm = root.querySelector('.ev-form');
  root.querySelector('.rc-date').value = today(); root.querySelector('.ev-date').value = today();
  rcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (c) => root.querySelector(c).value;
    GAMES.push({ id: uid(), date: cleanDate(q('.rc-date')), type: q('.rc-type'), res: q('.rc-res'), event: str(q('.rc-event'), 60).trim(), opp: str(q('.rc-opp'), 40).trim(),
      army: q('.rc-army'), fac: q('.rc-fac'), map: q('.rc-map'), notes: str(q('.rc-notes'), 200).trim(), src: '' });
    root.querySelector('.rc-msg').textContent = 'Game added.';
    for (const c of ['.rc-opp', '.rc-notes']) root.querySelector(c).value = '';
    draw();
  });
  // picking an army fills in its main faction
  root.querySelector('.rc-army').addEventListener('change', (e) => {
    const a = ARMIES.find((x) => x.name === e.target.value); if (!a) return;
    const f = d3.rollups([...a.map], (v) => d3.sum(v, ([u, q]) => (byName(u)?.points || 0) * q), ([u]) => byName(u)?.faction).filter(([k]) => k).sort((x, y) => y[1] - x[1])[0];
    if (f) root.querySelector('.rc-fac').value = f[0];
  });
  evForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (c) => root.querySelector(c).value;
    EVENTS.push({ id: uid(), date: cleanDate(q('.ev-date')), type: q('.ev-type'), name: str(q('.ev-name'), 60).trim() || 'Event', place: cnt(q('.ev-place'), 999) || 1, size: cnt(q('.ev-size'), 999), src: '' });
    root.querySelector('.ev-msg').textContent = 'Event added.';
    root.querySelector('.ev-name').value = ''; root.querySelector('.ev-place').value = ''; root.querySelector('.ev-size').value = '';
    draw();
  });
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  function fillSelect(sel, opts, keep) { const v = sel.value; sel.replaceChildren(...opts.map(([val, txt]) => new Option(txt, val))); sel.value = keep !== undefined ? keep : v; if (sel.selectedIndex < 0) sel.selectedIndex = 0; }
  const FACTIONS = () => [...new Set(UNITS.map((u) => u.faction))].sort();
  function drawRecord() {
    fillSelect(root.querySelector('.rc-army'), [['', 'Not saved'], ...ARMIES.map((a) => [a.name, a.name])]);
    fillSelect(root.querySelector('.rc-fac'), [['', 'Not saved'], ...FACTIONS().map((f) => [f, f])]);
    fillSelect(root.querySelector('.rc-map'), [['', 'Not saved'], ...(DATA('maps') || []).map((m) => [m.name, m.name])]);
    const s = recStats();
    const tiles = root.querySelector('.rc-tiles'); tiles.replaceChildren();
    const tile = (big, small) => { const t = mk('div', 'hs-tile'); t.append(mk('b', '', big), document.createTextNode(small)); tiles.appendChild(t); };
    tile(pctTxt(s.W + s.D / 2, s.n), 'win rate'); tile(String(s.n), 'games'); tile(`${s.W}–${s.L}${s.D ? '–' + s.D : ''}`, 'wins, losses' + (s.D ? ', draws' : ''));
    tile(String(s.tPlayed), 'tournaments'); tile(String(s.tWon + s.lWon), 'events won'); tile(String(s.best), 'best win streak');
    const tb = root.querySelector('.rc-bytype tbody'); tb.replaceChildren();
    for (const [k, label] of Object.entries(GTYPES)) {
      const t = s.byType[k] || { n: 0, W: 0, L: 0, D: 0 }; const tr = tb.insertRow();
      tr.appendChild(mk('td', 'l', label)); for (const v of [t.n, t.W, t.L, t.D]) tr.appendChild(mk('td', '', String(v)));
      tr.appendChild(mk('td', 'b', pctTxt(t.W + t.D / 2, t.n)));
    }
    const facs = d3.rollups(GAMES.filter((g) => g.fac), (v) => ({ n: v.length, w: v.filter((g) => g.res === 'W').length + v.filter((g) => g.res === 'D').length / 2 }), (g) => g.fac).sort((a, b) => b[1].n - a[1].n);
    for (const [f, o] of facs) { const tr = tb.insertRow(); tr.className = 'sub'; tr.appendChild(mk('td', 'l', 'With ' + f)); tr.appendChild(mk('td', '', String(o.n))); tr.appendChild(mk('td', '', '')); tr.appendChild(mk('td', '', '')); tr.appendChild(mk('td', '', '')); tr.appendChild(mk('td', 'b', pctTxt(o.w, o.n))); }
    const el = root.querySelector('.ev-list'); el.replaceChildren();
    if (!EVENTS.length) el.appendChild(mk('p', 'hs-empty', 'No events yet.'));
    for (const e of EVENTS.slice().sort((a, b) => b.date.localeCompare(a.date))) {
      const d = mk('div', 'rc-item');
      d.append(mk('span', 'hs-pill' + (e.place === 1 ? ' ok' : ''), ord(e.place) + (e.size ? ' of ' + e.size : '')), mk('b', '', e.name), mk('span', 'hs-note', ` ${GTYPES[e.type] ? GTYPES[e.type].replace(/s$/, '') : e.type} · ${e.date}`));
      d.appendChild(btn('Delete', 'hs-sm', () => { EVENTS.splice(EVENTS.indexOf(e), 1); draw(); }, 'Delete ' + e.name));
      el.appendChild(d);
    }
    const gl = root.querySelector('.rc-list'); gl.replaceChildren();
    if (!GAMES.length) { gl.appendChild(mk('p', 'hs-empty', 'No games yet. Log your first one above.')); return; }
    const t = mk('table', 'hs-a'); const hr = t.createTHead().insertRow();
    for (const h of ['Date', 'Result', 'Where', 'Event', 'Opponent', 'Army', 'Map', '']) hr.appendChild(mk('th', 'l', h));
    const body = t.createTBody();
    for (const g of GAMES.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300)) {
      const tr = body.insertRow();
      tr.appendChild(mk('td', 'l', g.date));
      const rc = mk('td', 'l'); rc.appendChild(mk('span', 'hs-pill ' + (g.res === 'W' ? 'ok' : g.res === 'L' ? 'bad' : ''), RES[g.res])); tr.appendChild(rc);
      for (const v of [GTYPES[g.type].replace(/s$/, ''), g.event, g.opp, [g.army, g.fac].filter(Boolean).join(' · '), g.map]) tr.appendChild(mk('td', 'l', v));
      const x = mk('td'); x.appendChild(btn('Delete', 'hs-sm', () => { GAMES.splice(GAMES.indexOf(g), 1); draw(); }, 'Delete game on ' + g.date)); tr.appendChild(x);
    }
    const w = mk('div', 'hs-scroll'); w.appendChild(t); gl.appendChild(w);
    if (GAMES.length > 300) gl.appendChild(mk('p', 'hs-note', 'Showing your latest 300 games. All of them count in the totals.'));
  }

  // ---------- Swiss tournament ----------
  const TOURNEYS = []; // { id, name, date, kind, rounds, mins, me, players: [{id, name, drop}], pairings: [[{a, b, res, pa, pb}]], finished }
  let TCUR = null;
  registerSaved({
    key: 'tournaments', label: 'tournaments',
    get: () => ({ list: JSON.parse(JSON.stringify(TOURNEYS)), current: TCUR }),
    clean: (o) => ({
      current: str(o && o.current, 30),
      list: (Array.isArray(o && o.list) ? o.list : []).slice(0, 100).map((t) => {
        const players = (Array.isArray(t && t.players) ? t.players : []).slice(0, 256).map((p) => ({ id: str(p && p.id, 30), name: str(p && p.name, 40).trim(), drop: !!(p && p.drop) })).filter((p) => p.id && p.name);
        const ids = new Set(players.map((p) => p.id));
        const pairings = (Array.isArray(t && t.pairings) ? t.pairings : []).slice(0, 20).map((r) => (Array.isArray(r) ? r : []).slice(0, 128).map((m) => ({
          a: str(m && m.a, 30), b: m && m.b ? str(m.b, 30) : null, res: ['A', 'B', 'D'].includes(m && m.res) ? m.res : '', pa: cnt(m && m.pa, 9999), pb: cnt(m && m.pb, 9999)
        })).filter((m) => ids.has(m.a) && (m.b === null || ids.has(m.b))));
        return { id: str(t && t.id, 30) || uid(), name: str(t && t.name, 60) || 'Tournament', date: cleanDate(t && t.date), kind: ['tournament', 'local', 'online'].includes(t && t.kind) ? t.kind : 'tournament',
          rounds: cnt(t && t.rounds, 12) || 3, mins: cnt(t && t.mins, 240) || 75, me: str(t && t.me, 30), players, pairings, finished: !!(t && t.finished) };
      })
    }),
    apply: (v, merge) => {
      if (!merge) TOURNEYS.length = 0;
      if (!v) { TCUR = null; return; }
      for (const t of v.list) if (!TOURNEYS.some((x) => x.id === t.id)) TOURNEYS.push(t);
      if (!merge || !TCUR) TCUR = v.current;
    }
  });
  const curT = () => TOURNEYS.find((t) => t.id === TCUR) || TOURNEYS[TOURNEYS.length - 1] || null;
  const tMsg = (t, bad) => { const e = root.querySelector('.tn-msg'); e.textContent = t; e.classList.toggle('bad', !!bad); };
  function tStandings(T) {
    const S = new Map(T.players.map((p) => [p.id, { p, w: 0, l: 0, d: 0, score: 0, pts: 0, opps: [], bye: false }]));
    for (const round of T.pairings) for (const m of round) {
      const A = S.get(m.a), B = m.b ? S.get(m.b) : null;
      if (!B) { A.w++; A.score += 1; A.bye = true; continue; }
      A.opps.push(m.b); B.opps.push(m.a); A.pts += m.pa; B.pts += m.pb;
      if (m.res === 'A') { A.w++; A.score++; B.l++; } else if (m.res === 'B') { B.w++; B.score++; A.l++; } else if (m.res === 'D') { A.d++; B.d++; A.score += 0.5; B.score += 0.5; }
    }
    for (const s of S.values()) s.sos = d3.sum(s.opps, (o) => S.get(o).score);
    return [...S.values()].sort((a, b) => b.score - a.score || b.sos - a.sos || b.pts - a.pts || a.p.name.localeCompare(b.p.name));
  }
  function pairNext(T) {
    const st = tStandings(T).filter((s) => !s.p.drop);
    if (st.length < 2) return 'Add at least two players.';
    if (T.pairings.length && T.pairings[T.pairings.length - 1].some((m) => m.b && !m.res)) return 'Enter every result for this round first.';
    let order = T.pairings.length ? st : shuffle(st.slice());
    const round = [];
    if (order.length % 2) {
      const byeIdx = [...order.keys()].reverse().find((i) => !order[i].bye);
      const i = byeIdx === undefined ? order.length - 1 : byeIdx;
      round.push({ a: order[i].p.id, b: null, res: '', pa: 0, pb: 0 });
      order = order.filter((_, j) => j !== i);
    }
    const met = (x, y) => x.opps.includes(y.p.id);
    function solve(list, allowRematch) {
      if (!list.length) return [];
      const [first, ...rest] = list;
      for (let i = 0; i < rest.length; i++) {
        if (!allowRematch && met(first, rest[i])) continue;
        const sub = solve(rest.filter((_, j) => j !== i), allowRematch);
        if (sub) return [[first, rest[i]], ...sub];
      }
      return null;
    }
    const pairs = solve(order, false) || solve(order, true);
    round.unshift(...pairs.map(([x, y]) => ({ a: x.p.id, b: y.p.id, res: '', pa: 0, pb: 0 })));
    T.pairings.push(round);
    return '';
  }
  // results involving "me" go into My record
  function syncTourneyToRecord(T) {
    if (!T.me) return;
    T.pairings.forEach((round, ri) => round.forEach((m, ti) => {
      const src = `tn:${T.id}:${ri}:${ti}`;
      const i = GAMES.findIndex((g) => g.src === src);
      const mine = m.b && (m.a === T.me || m.b === T.me) && m.res;
      if (!mine) { if (i >= 0) GAMES.splice(i, 1); return; }
      const iAmA = m.a === T.me, opp = T.players.find((p) => p.id === (iAmA ? m.b : m.a));
      const res = m.res === 'D' ? 'D' : (m.res === 'A') === iAmA ? 'W' : 'L';
      const g = { id: i >= 0 ? GAMES[i].id : uid(), date: T.date, type: T.kind === 'online' ? 'online' : T.kind, res, event: T.name, opp: opp ? opp.name : '', army: i >= 0 ? GAMES[i].army : '', fac: i >= 0 ? GAMES[i].fac : '', map: i >= 0 ? GAMES[i].map : '', notes: `Round ${ri + 1}`, src };
      if (i >= 0) GAMES[i] = g; else GAMES.push(g);
    }));
  }
  root.querySelector('.tn-new').addEventListener('click', () => {
    const t = { id: uid(), name: 'Tournament ' + (TOURNEYS.length + 1), date: today(), kind: 'tournament', rounds: 3, mins: 75, me: '', players: [], pairings: [], finished: false };
    TOURNEYS.push(t); TCUR = t.id; timerReset(t); draw();
  });
  root.querySelector('.tn-sel').addEventListener('change', (e) => { TCUR = e.target.value; timerReset(curT()); draw(); });
  const delc = root.querySelector('.tn-delc');
  root.querySelector('.tn-del').addEventListener('click', () => { if (curT()) delc.hidden = false; });
  root.querySelector('.tn-deln').addEventListener('click', () => { delc.hidden = true; });
  root.querySelector('.tn-dely').addEventListener('click', () => { const T = curT(); delc.hidden = true; if (!T) return; TOURNEYS.splice(TOURNEYS.indexOf(T), 1); TCUR = null; draw(); });
  const bindT = (cls, key, conv) => root.querySelector(cls).addEventListener('change', (e) => { const T = curT(); if (!T) return; T[key] = conv ? conv(e.target.value) : e.target.value; if (key === 'mins' && !TIMER.running) timerReset(T); if (key === 'me' || key === 'date' || key === 'name' || key === 'kind') syncTourneyToRecord(T); draw(); });
  bindT('.tn-name', 'name', (v) => str(v, 60).trim() || 'Tournament'); bindT('.tn-date', 'date', cleanDate); bindT('.tn-kind', 'kind');
  bindT('.tn-rounds', 'rounds', (v) => cnt(v, 12) || 1); bindT('.tn-mins', 'mins', (v) => cnt(v, 240) || 75); bindT('.tn-me', 'me');
  root.querySelector('.tn-add').addEventListener('click', () => {
    const T = curT(); if (!T) return;
    const ta = root.querySelector('.tn-addtext');
    const names = ta.value.split(/\r?\n|,/).map((s) => str(s, 40).trim()).filter(Boolean);
    for (const n of names) if (!T.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) T.players.push({ id: uid(), name: n, drop: false });
    ta.value = ''; draw();
  });
  root.querySelector('.tn-pair').addEventListener('click', () => {
    const T = curT(); if (!T) return;
    if (T.pairings.length >= T.rounds) { tMsg(`All ${T.rounds} rounds are paired. Raise “Rounds” to add another, or finish the tournament.`, true); return; }
    const err = pairNext(T); tMsg(err || `Round ${T.pairings.length} paired. Good luck!`, !!err); timerReset(T); draw();
  });
  root.querySelector('.tn-unpair').addEventListener('click', () => {
    const T = curT(); if (!T || !T.pairings.length) return;
    T.pairings.pop(); T.finished = false; syncTourneyToRecord(T); tMsg('Last round removed.'); draw();
  });
  root.querySelector('.tn-finish').addEventListener('click', () => {
    const T = curT(); if (!T) return;
    if (!T.pairings.length || T.pairings.some((r) => r.some((m) => m.b && !m.res))) { tMsg('Enter every result before finishing.', true); return; }
    T.finished = true;
    const st = tStandings(T);
    if (T.me) {
      const place = st.findIndex((s) => s.p.id === T.me) + 1, src = 'tn:' + T.id;
      const e = { id: uid(), date: T.date, type: T.kind, name: T.name, place, size: T.players.length, src };
      const i = EVENTS.findIndex((x) => x.src === src); if (i >= 0) { e.id = EVENTS[i].id; EVENTS[i] = e; } else EVENTS.push(e);
    }
    tMsg(`Finished. ${st[0].p.name} wins!` + (T.me ? ' Your place is in My record.' : ''));
    draw();
  });
  function drawTournament() {
    const T = curT();
    if (T && TCUR !== T.id) TCUR = T.id;
    root.querySelector('.tn-empty').hidden = !!T;
    root.querySelectorAll('.tn-body').forEach((e) => { e.hidden = !T; });
    fillSelect(root.querySelector('.tn-sel'), TOURNEYS.map((t) => [t.id, `${t.name} (${t.date})`]), T ? T.id : '');
    root.querySelector('.tn-del').disabled = !T;
    if (!T) return;
    const setv = (c, v) => { const e = root.querySelector(c); if (document.activeElement !== e) e.value = v; };
    setv('.tn-name', T.name); setv('.tn-date', T.date); setv('.tn-kind', T.kind); setv('.tn-rounds', String(T.rounds)); setv('.tn-mins', String(T.mins));
    fillSelect(root.querySelector('.tn-me'), [['', 'Not playing'], ...T.players.map((p) => [p.id, p.name])], T.me);
    // players
    const pl = root.querySelector('.tn-plist'); pl.replaceChildren();
    if (!T.players.length) pl.appendChild(mk('p', 'hs-empty', 'No players yet.'));
    const played = new Set(T.pairings.flat().flatMap((m) => [m.a, m.b]));
    for (const p of T.players) {
      const d = mk('div', 'rc-item'); d.appendChild(mk('b', p.drop ? 'dropped' : '', p.name));
      if (p.id === T.me) d.appendChild(mk('span', 'hs-pill ok', 'Me'));
      if (p.drop) d.appendChild(mk('span', 'hs-pill', 'Dropped'));
      d.appendChild(btn(p.drop ? 'Return' : 'Drop', 'hs-sm', () => { p.drop = !p.drop; draw(); }, (p.drop ? 'Return ' : 'Drop ') + p.name));
      if (!played.has(p.id)) d.appendChild(btn('Remove', 'hs-sm', () => { T.players.splice(T.players.indexOf(p), 1); if (T.me === p.id) T.me = ''; draw(); }, 'Remove ' + p.name));
      pl.appendChild(d);
    }
    // rounds
    const name = (id) => (T.players.find((p) => p.id === id) || { name: '?' }).name;
    const out = root.querySelector('.tn-rounds-out'); out.replaceChildren();
    if (!T.pairings.length) out.appendChild(mk('p', 'hs-empty', `Add players, then press “Pair next round”. Round 1 is paired at random; later rounds pair players with the same record, avoiding rematches.`));
    T.pairings.forEach((round, ri) => {
      const card = mk('div', 'tn-round'); card.appendChild(mk('h4', '', `Round ${ri + 1}`));
      const t = mk('table', 'hs-a'); const hr = t.createTHead().insertRow();
      for (const h of ['Table', 'Player', 'Result', 'Player', 'Points destroyed']) hr.appendChild(mk('th', 'l', h));
      const tb = t.createTBody();
      round.forEach((m, ti) => {
        const tr = tb.insertRow(); tr.appendChild(mk('td', 'l', m.b ? String(ti + 1) : '—'));
        tr.appendChild(mk('td', 'l' + (m.res === 'A' ? ' win' : ''), name(m.a)));
        if (!m.b) { const td = mk('td', 'l', 'Bye (counts as a win)'); td.colSpan = 3; tr.appendChild(td); return; }
        const rc = mk('td', 'l'); const sel = document.createElement('select'); sel.setAttribute('aria-label', `Round ${ri + 1} table ${ti + 1} result`);
        for (const [v, txt] of [['', 'Not played'], ['A', '◀ wins'], ['B', 'wins ▶'], ['D', 'Draw']]) sel.appendChild(new Option(txt, v));
        sel.value = m.res; sel.addEventListener('change', () => { m.res = sel.value; syncTourneyToRecord(T); draw(); });
        rc.appendChild(sel); tr.appendChild(rc);
        tr.appendChild(mk('td', 'l' + (m.res === 'B' ? ' win' : ''), name(m.b)));
        const pc = mk('td', 'l tn-pts');
        for (const k of ['pa', 'pb']) { const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.max = '9999'; i.className = 'hs-num'; i.value = m[k] ? String(m[k]) : ''; i.placeholder = '0'; i.setAttribute('aria-label', 'Points destroyed by ' + name(k === 'pa' ? m.a : m.b)); i.addEventListener('change', () => { m[k] = cnt(i.value, 9999); draw(); }); pc.appendChild(i); }
        tr.appendChild(pc);
      });
      const w = mk('div', 'hs-scroll'); w.appendChild(t); card.appendChild(w);
      out.appendChild(card);
    });
    // standings
    const sb = root.querySelector('.tn-stand tbody'); sb.replaceChildren();
    tStandings(T).forEach((s, i) => {
      const tr = sb.insertRow(); tr.appendChild(mk('td', 'l', String(i + 1)));
      const n = mk('td', 'l nm', s.p.name); if (s.p.id === T.me) n.appendChild(mk('span', 'hs-pill ok', 'Me')); if (s.p.drop) n.appendChild(mk('span', 'hs-pill', 'Dropped')); tr.appendChild(n);
      for (const v of [s.w + (s.d ? ' ' : ''), s.l, s.d, s.sos, s.pts]) tr.appendChild(mk('td', '', String(v).trim()));
    });
    root.querySelector('.tn-pair').textContent = T.pairings.length ? `Pair round ${T.pairings.length + 1}` : 'Pair round 1';
    drawTimer();
  }
  // round timer
  const TIMER = { left: 75 * 60000, running: false, endAt: 0, rang: false };
  const clock = root.querySelector('.tn-clock');
  function timerReset(T) { TIMER.running = false; TIMER.left = (T ? T.mins : 75) * 60000; TIMER.rang = false; drawTimer(); }
  const timeLeft = () => TIMER.running ? TIMER.endAt - Date.now() : TIMER.left;
  function drawTimer() {
    const ms = timeLeft(), neg = ms < 0, s = Math.ceil(Math.abs(ms) / 1000);
    clock.textContent = (neg ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    clock.classList.toggle('over', neg); clock.classList.toggle('low', !neg && ms < 5 * 60000);
    root.querySelector('.tn-start').textContent = TIMER.running ? 'Pause' : 'Start';
    root.querySelector('.tn-tnote').textContent = neg ? 'Time is up. The clock counts the extra time.' : 'The timer keeps running if you switch pages.';
  }
  root.querySelector('.tn-start').addEventListener('click', () => {
    if (TIMER.running) { TIMER.left = TIMER.endAt - Date.now(); TIMER.running = false; } else { TIMER.endAt = Date.now() + TIMER.left; TIMER.running = true; unlockAudio(); }
    drawTimer();
  });
  root.querySelector('.tn-reset').addEventListener('click', () => timerReset(curT()));
  const bump = (d) => { if (TIMER.running) TIMER.endAt += d; else TIMER.left += d; if (timeLeft() > 0) TIMER.rang = false; drawTimer(); };
  root.querySelector('.tn-plus').addEventListener('click', () => bump(60000));
  root.querySelector('.tn-minus').addEventListener('click', () => bump(-60000));
  let AC = null;
  const unlockAudio = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } };
  function ring() {
    if (!AC || !root.querySelector('.tn-sound').checked) return;
    try {
      for (let i = 0; i < 3; i++) {
        const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + i * 0.45;
        o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.4);
      }
    } catch (e) { /* sound unavailable */ }
  }
  setInterval(() => {
    if (!TIMER.running) return;
    if (timeLeft() <= 0 && !TIMER.rang) { TIMER.rang = true; ring(); }
    if (state.page === 'tournament') drawTimer();
  }, 250);

  // ---------- player card and achievements ----------
  const PROFILE = { name: '', title: '', home: '', fac: '', unit: '', bio: '', color: '#6b3fa0', pic: '', show: { record: true, events: true, collection: true }, badges: [] };
  registerSaved({
    key: 'player', label: 'player card',
    get: () => JSON.parse(JSON.stringify(PROFILE)),
    clean: (o) => ({
      name: str(o && o.name, 40), title: str(o && o.title, 40), home: str(o && o.home, 60), fac: str(o && o.fac, 30), unit: str(o && o.unit, 120), bio: str(o && o.bio, 140),
      color: hex(o && o.color) || '#6b3fa0', pic: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(o && o.pic)) && String(o.pic).length < 200000 ? o.pic : '',
      show: { record: !(o && o.show && o.show.record === false), events: !(o && o.show && o.show.events === false), collection: !(o && o.show && o.show.collection === false) },
      badges: (Array.isArray(o && o.badges) ? o.badges : []).slice(0, 6).map((b) => str(b, 20))
    }),
    apply: (v, merge) => {
      if (merge && PROFILE.name) return;
      Object.assign(PROFILE, v || { name: '', title: '', home: '', fac: '', unit: '', bio: '', color: '#6b3fa0', pic: '', show: { record: true, events: true, collection: true }, badges: [] });
    }
  });
  const BADGES = [
    ['g1', 'First game', 'Log your first game', '1', (s) => s.n >= 1], ['g10', 'Seasoned', 'Play 10 games', '10', (s) => s.n >= 10],
    ['g50', 'Veteran', 'Play 50 games', '50', (s) => s.n >= 50], ['g100', 'Centurion', 'Play 100 games', 'C', (s) => s.n >= 100],
    ['w1', 'First victory', 'Win a game', '★', (s) => s.W >= 1], ['w10', 'Ten wins', 'Win 10 games', '★10', (s) => s.W >= 10],
    ['w25', 'Warlord', 'Win 25 games', '★25', (s) => s.W >= 25], ['w50', 'Conqueror', 'Win 50 games', '★50', (s) => s.W >= 50],
    ['s3', 'On a roll', 'Win 3 games in a row', '3×', (s) => s.best >= 3], ['s5', 'Unstoppable', 'Win 5 games in a row', '5×', (s) => s.best >= 5],
    ['t1', 'Tournament debut', 'Play in a tournament', 'T', (s) => s.tPlayed >= 1], ['t5', 'Circuit regular', 'Play in 5 tournaments', 'T5', (s) => s.tPlayed >= 5],
    ['t10', 'Tournament veteran', 'Play in 10 tournaments', 'T10', (s) => s.tPlayed >= 10], ['tw1', 'Champion', 'Win a tournament', '♛', (s) => s.tWon >= 1],
    ['tw3', 'Dynasty', 'Win 3 tournaments', '♛3', (s) => s.tWon >= 3], ['pod', 'Podium finish', 'Finish in the top 3 of an event', '3', (s) => s.podium >= 1],
    ['l1', 'Local hero', 'Play in a local event', 'L', (s) => s.lPlayed >= 1], ['l5', 'Store regular', 'Play in 5 local events', 'L5', (s) => s.lPlayed >= 5],
    ['lw1', 'Locals winner', 'Win a local event', '♜', (s) => s.lWon >= 1], ['lw5', 'Store legend', 'Win 5 local events', '♜5', (s) => s.lWon >= 5],
    ['o1', 'Online debut', 'Play a game online', '@', (s) => s.online >= 1], ['o25', 'Digital general', 'Play 25 games online', '@25', (s) => s.online >= 25],
    ['wr60', 'Sharp commander', 'Win rate of 60% or more over 20+ games', '60', (s) => s.n >= 20 && s.rate >= 0.6], ['wr75', 'Master tactician', 'Win rate of 75% or more over 30+ games', '75', (s) => s.n >= 30 && s.rate >= 0.75],
    ['f5', 'Faction explorer', 'Win with 5 different factions', '5F', (s) => s.winFacs.size >= 5],
    ['c25', 'Collector', 'Own 25% of the army cards', '¼', (s) => s.cPct >= 0.25], ['c50', 'Hoarder', 'Own half of the army cards', '½', (s) => s.cPct >= 0.5],
    ['c100', 'Completionist', 'Own every army card', '∞', (s) => s.cPct >= 1], ['terra', 'Terraformer', 'Own 5 terrain products', '⬢', (s) => s.terr >= 5],
    // old-school products (shown once the home page includes old-school cards, or once earned)
    ['oc25', 'Old-school collector', 'Own 25% of the old-school army cards', '¼', (s) => s.ocPct >= 0.25, false, '', 'classic'],
    ['oc50', 'Vault keeper', 'Own half of the old-school army cards', '½', (s) => s.ocPct >= 0.5, false, '', 'classic'],
    ['oc100', 'Old-school completionist', 'Own every old-school army card', '∞', (s) => s.ocPct >= 1, false, '', 'classic'],
    ['orotv', 'Where it began', 'Own the Rise of the Valkyrie Master Set', 'V', (s) => s.oprod.has('c-rotv'), false, '', 'classic'],
    ['owaves', 'Wave rider', 'Own all ten Hasbro waves', 'W', (s) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((i) => s.oprod.has('c-w' + i)), false, '', 'classic'],
    ['odnd', 'Dungeon delver', 'Own Battle for the Underdark and the three D&D waves', 'D', (s) => ['c-underdark', 'c-d1', 'c-d2', 'c-d3'].every((i) => s.oprod.has(i)), false, '', 'classic'],
    ['oterra', 'Classic terraformer', 'Own 3 old-school terrain products', '⬡', (s) => s.oterr >= 3, false, '', 'classic'],
    ['maps10', 'Map maker', 'Be able to build 10 tournament maps', 'M', (s) => s.maps >= 10], ['host', 'Tournament organizer', 'Finish a Swiss tournament in the tracker', 'TO', (s) => s.hosted >= 1],
    // hidden until earned: keep changing the colors on the Settings page
    ['colors', 'True colors', 'Played with the colors until something happened. New colors unlocked in Settings.', '✦', (s) => s.colorEgg, true]
  ];
  // day achievements: hidden ones the site owner adds in edit mode (site-edits.json "badges"); a visitor earns one
  // by opening the site on one of its days. What they earned is kept in their own backup.
  let DAY_EARNED = {}, DAY_LIST = [];
  registerSaved({
    key: 'days', label: 'day achievements',
    get: () => ({ ...DAY_EARNED }),
    clean: (o) => { const e = {}; for (const [k, v] of Object.entries(o || {}).slice(0, 100)) if (/^[\w-]{1,20}$/.test(k)) e[k] = str(v, 10); return e; },
    apply: (v, merge) => { DAY_EARNED = merge ? { ...v, ...DAY_EARNED } : { ...(v || {}) }; }
  });
  const pad2 = (n) => String(n).padStart(2, '0');
  const inDays = (md, a, b) => (a <= b ? md >= a && md <= b : md >= a || md <= b); // a range can wrap past New Year
  function setDayBadges(list) {
    DAY_LIST = list;
    for (let i = BADGES.length - 1; i >= 0; i--) if (BADGES[i][6] === 'day') BADGES.splice(i, 1);
    for (const d of list) BADGES.push([d.id, d.name, d.desc, d.icon || '✦', () => !!DAY_EARNED[d.id], true, 'day']);
  }
  // Easter Sunday (Western churches) for a year, as MM-DD: the anonymous Gregorian method
  function easterMD(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return pad2(mo) + '-' + pad2(da);
  }
  function checkDays() {
    const now = new Date(), md = pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    let got = false;
    for (const d of DAY_LIST) if (!DAY_EARNED[d.id] && (d.rule === 'easter' ? md === easterMD(now.getFullYear()) : inDays(md, d.from, d.to))) { DAY_EARNED[d.id] = now.getFullYear() + '-' + md; got = true; }
    if (got) { persist(); applyTheme(); }
    return got;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !EDIT_MODE && checkDays()) draw(); });
  // ---- "achievement unlocked" pop-ups ----
  // SEEN holds the achievements this visitor has already been shown (in their backup). A brand-new visitor starts with
  // none. Saved data or a backup without the list gives null: the next check then records what is already earned
  // without popping anything, so older backups stay quiet.
  let SEEN = [];
  registerSaved({
    key: 'seenbadges', label: 'achievements already shown',
    get: () => SEEN,
    clean: (o) => (Array.isArray(o) ? o.slice(0, 300).map((x) => str(x, 20)) : null),
    apply: (v, merge) => { SEEN = merge && SEEN ? [...new Set([...SEEN, ...(v || [])])] : v ? v.slice() : null; }
  });
  let lastSound = 0; // several achievements at once play the sound only once
  const BADGE_SOUND = 'assets/achievement.mp3'; // the pop-up's sound effect: a file path such as 'assets/achievement.mp3' (empty = no sound)
  const toastBox = mk('div', 'bd-toasts'); toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);
  let badgeT = null;
  const badgeCheckSoon = () => { clearTimeout(badgeT); badgeT = setTimeout(checkBadges, 50); };
  function checkBadges() {
    let s; try { s = allStats(); } catch (e) { return; }
    const earned = BADGES.filter((b) => b[4](s)).map((b) => b[0]);
    if (SEEN === null) { SEEN = earned; persist(); return; }
    const fresh = earned.filter((id) => !SEEN.includes(id));
    if (!fresh.length) return;
    SEEN = SEEN.concat(fresh);
    persist();
    fresh.forEach((id, i) => setTimeout(() => badgeToast(BADGES.find((b) => b[0] === id)), i * 400));
  }
  function badgeToast(b) {
    if (!b) return;
    const t = mk('button', 'bd-toast'); t.type = 'button';
    t.append(mk('span', 'bd-g', b[3]), mk('span', 'bd-tt'));
    t.lastChild.append(mk('span', 'hs-note', 'Achievement unlocked'), mk('b', '', b[1]));
    t.setAttribute('aria-label', 'Achievement unlocked: ' + b[1] + '. Open it.');
    const close = () => { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    const timer = setTimeout(close, 30000);
    t.addEventListener('click', () => {
      close();
      showPage('player', true);
      setTimeout(() => {
        const el = root.querySelector(`.bd-grid .bd[data-bd="${b[0]}"]`); if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2500);
      }, 100);
    });
    while (toastBox.children.length >= 3) toastBox.firstChild.remove(); // keep at most three on screen
    toastBox.appendChild(t);
    if (BADGE_SOUND && Date.now() - lastSound > 1500) { lastSound = Date.now(); try { const a = new Audio(BADGE_SOUND); a.volume = 0.6; a.play().catch(() => {}); } catch (e) { /* no audio */ } }
  }
  function allStats() {
    const s = recStats();
    // collection achievements count each era on its own, whatever the home page shows
    const allU = dash.data('units').data || [], allP = dash.data('products').data || [];
    const pct = (list) => (list.length ? list.filter((u) => ownedOf(u.unit) > 0).length / list.length : 0);
    s.cPct = pct(allU.filter((u) => u.era !== 'classic'));
    s.ocPct = pct(allU.filter(isOld));
    s.terr = allP.filter((p) => p.kind === 'Terrain' && p.era !== 'classic' && PROD_OWN[p.id]).length;
    s.oterr = allP.filter((p) => p.kind === 'Terrain' && p.era === 'classic' && PROD_OWN[p.id]).length;
    s.oprod = new Set(allP.filter((p) => p.era === 'classic' && PROD_OWN[p.id]).map((p) => p.id));
    s.maps = (DATA('maps') || []).filter((m) => mapCan(m)).length;
    s.hosted = TOURNEYS.filter((t) => t.finished).length;
    s.colorEgg = THEME.unlocked;
    return s;
  }
  function badgeEl(b, earned, small) {
    const d = mk('div', 'bd' + (earned ? ' on' : '') + (small ? ' sm' : '')); d.dataset.bd = b[0];
    const secret = b[5] && !earned;
    d.appendChild(mk('span', 'bd-g', secret ? '?' : b[3]));
    const name = secret ? 'Hidden achievement' : b[1], desc = secret ? 'Keep exploring to find it.' : b[2];
    if (!small) {
      const t = mk('div', 'bd-t'); t.append(mk('b', '', name), mk('span', 'hs-note', desc));
      const th = secret ? [] : SITE_THEMES.filter((x) => x.unlock === b[0]);
      if (th.length) t.appendChild(mk('span', 'bd-unlock', (earned ? 'Unlocked theme: ' : 'Unlocks theme: ') + th.map((x) => x.name).join(', ')));
      d.appendChild(t);
    }
    d.title = name + (desc ? ': ' + desc : '') + (earned ? ' (earned)' : '');
    return d;
  }
  const plBind = (cls, key, ev) => root.querySelector(cls).addEventListener(ev || 'input', (e) => { PROFILE[key] = str(e.target.value, 140); drawPlayerCard(); persist(); });
  plBind('.pl-name', 'name'); plBind('.pl-title', 'title'); plBind('.pl-home', 'home'); plBind('.pl-bio', 'bio');
  plBind('.pl-fac', 'fac', 'change'); plBind('.pl-unit', 'unit', 'change'); plBind('.pl-color', 'color');
  root.querySelectorAll('.pl-show input').forEach((c) => c.addEventListener('change', () => { PROFILE.show[c.dataset.s] = c.checked; drawPlayerCard(); persist(); }));
  root.querySelector('.pl-picx').addEventListener('click', () => { PROFILE.pic = ''; draw(); });
  root.querySelector('.pl-pic').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      const c = document.createElement('canvas'), S = 240; c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      PROFILE.pic = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url); e.target.value = ''; draw();
    };
    img.onerror = () => { root.querySelector('.pl-msg').textContent = 'That picture could not be read.'; URL.revokeObjectURL(url); };
    img.src = url;
  });
  function initials() { return (PROFILE.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'; }
  function cardLines(s) {
    const lines = [];
    if (PROFILE.show.record) lines.push(['Record', s.n ? `${s.W}–${s.L}${s.D ? '–' + s.D : ''} · ${pctTxt(s.W + s.D / 2, s.n)} wins` : 'No games yet']);
    if (PROFILE.show.events) lines.push(['Events', `${s.tPlayed} tournament${s.tPlayed === 1 ? '' : 's'}, ${s.lPlayed} local · ${s.tWon + s.lWon} won`]);
    if (PROFILE.show.collection) lines.push(['Collection', `${Math.round(s.cPct * 100)}% of army cards · ${Object.values(PROD_OWN).reduce((a, b) => a + b, 0)} products`]);
    if (PROFILE.fac) lines.push(['Faction', PROFILE.fac]);
    if (PROFILE.unit) lines.push(['Favorite', PROFILE.unit]);
    return lines;
  }
  function drawPlayerCard() {
    const s = allStats(), box = root.querySelector('.pl-card'); box.replaceChildren();
    box.style.setProperty('--pc', PROFILE.color);
    box.style.setProperty('--pc-fg', contrastOn(PROFILE.color));
    const top = mk('div', 'pc-top');
    const av = mk('div', 'pc-av'); if (PROFILE.pic) { const im = document.createElement('img'); im.src = PROFILE.pic; im.alt = ''; av.appendChild(im); } else av.textContent = initials();
    const nm = mk('div', 'pc-nm'); nm.append(mk('b', '', PROFILE.name || 'Your name'), mk('span', '', PROFILE.title || 'Heroscape player'));
    top.append(av, nm); box.appendChild(top);
    const body = mk('div', 'pc-body');
    if (PROFILE.home) body.appendChild(mk('div', 'pc-home', PROFILE.home));
    if (PROFILE.bio) body.appendChild(mk('p', 'pc-bio', PROFILE.bio));
    const dl = mk('dl', 'pc-stats');
    for (const [k, v] of cardLines(s)) dl.append(mk('dt', '', k), mk('dd', '', v));
    body.appendChild(dl);
    const shown = cardBadges(s);
    if (shown.length) { const r = mk('div', 'pc-badges'); for (const b of shown) r.appendChild(badgeEl(b, true, true)); body.appendChild(r); }
    box.appendChild(body);
  }
  // the player card shows up to six earned achievements, in the order they are listed
  const cardBadges = (s) => BADGES.filter((b) => b[4](s)).slice(0, 6);
  function drawPlayer() {
    const setv = (c, v) => { const e = root.querySelector(c); if (document.activeElement !== e) e.value = v; };
    setv('.pl-name', PROFILE.name); setv('.pl-title', PROFILE.title); setv('.pl-home', PROFILE.home); setv('.pl-bio', PROFILE.bio); setv('.pl-color', PROFILE.color);
    fillSelect(root.querySelector('.pl-fac'), [['', 'None'], ...FACTIONS().map((f) => [f, f])], PROFILE.fac);
    fillSelect(root.querySelector('.pl-unit'), [['', 'None'], ...UNITS.map((u) => u.unit).sort().map((u) => [u, u])], PROFILE.unit);
    root.querySelectorAll('.pl-show input').forEach((c) => { c.checked = PROFILE.show[c.dataset.s]; });
    root.querySelector('.pl-picx').hidden = !PROFILE.pic;
    drawPlayerCard();
    const s = allStats(), grid = root.querySelector('.bd-grid'); grid.replaceChildren();
    for (const b of BADGES) {
      const earned = b[4](s);
      if (b[7] === 'classic' && state.era === 'now' && !earned) continue;
      grid.appendChild(badgeEl(b, earned));
    }
  }
  // the card as a PNG, drawn on a canvas
  root.querySelector('.pl-dl').addEventListener('click', () => {
    const s = allStats(), W = 600, lines = cardLines(s);
    const shown = cardBadges(s);
    const H = 210 + lines.length * 34 + (PROFILE.bio ? 40 : 0) + (shown.length ? 80 : 0) + 30;
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d'); g.scale(2, 2);
    const cs = getComputedStyle(document.documentElement);
    const panel = toHex(cs.getPropertyValue('--color-panel')), fg = toHex(cs.getPropertyValue('--color-fg')), mut = toHex(cs.getPropertyValue('--color-fg-muted'));
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = panel; rr(0, 0, W, H, 18); g.fill();
    g.save(); rr(0, 0, W, H, 18); g.clip(); g.fillStyle = PROFILE.color; g.fillRect(0, 0, W, 130); g.restore();
    const serif = getComputedStyle(root).getPropertyValue('--font-anthropic-serif') || 'serif', sans = getComputedStyle(root).getPropertyValue('--font-anthropic-sans') || 'sans-serif';
    const finish = () => {
      g.fillStyle = contrastOn(PROFILE.color); g.font = `600 30px ${serif}`; g.fillText(PROFILE.name || 'Your name', 160, 62);
      g.font = `16px ${sans}`; g.fillText(PROFILE.title || 'Heroscape player', 160, 90);
      let y = 170; g.fillStyle = mut; g.font = `15px ${sans}`;
      if (PROFILE.home) { g.fillText(PROFILE.home, 160, 115 + 40); }
      if (PROFILE.bio) { g.fillStyle = fg; g.font = `italic 15px ${sans}`; g.fillText(PROFILE.bio.slice(0, 80), 30, y + 10); y += 40; }
      for (const [k, v] of lines) { g.fillStyle = mut; g.font = `13px ${sans}`; g.fillText(k.toUpperCase(), 30, y + 20); g.fillStyle = fg; g.font = `16px ${sans}`; g.fillText(v, 140, y + 20); y += 34; }
      let x = 30; y += 14;
      for (const b of shown) {
        g.fillStyle = PROFILE.color; g.beginPath(); g.arc(x + 20, y + 22, 20, 0, Math.PI * 2); g.fill();
        g.fillStyle = contrastOn(PROFILE.color); g.font = `600 13px ${sans}`; g.textAlign = 'center'; g.fillText(b[3], x + 20, y + 27); g.textAlign = 'left';
        x += 56;
      }
      g.fillStyle = mut; g.font = `12px ${sans}`; g.fillText('Heroscape Tracker', 30, H - 16);
      c.toBlob((blob) => {
        try {
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'heroscape-player-card.png'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          root.querySelector('.pl-msg').textContent = 'Saved heroscape-player-card.png.';
        } catch (e) { root.querySelector('.pl-msg').textContent = 'Your browser blocked the download. Take a screenshot of the card instead.'; }
      }, 'image/png');
    };
    // picture or initials
    g.fillStyle = panel; g.beginPath(); g.arc(85, 75, 52, 0, Math.PI * 2); g.fill();
    if (PROFILE.pic) {
      const im = new Image(); im.onload = () => { g.save(); g.beginPath(); g.arc(85, 75, 48, 0, Math.PI * 2); g.clip(); g.drawImage(im, 37, 27, 96, 96); g.restore(); finish(); }; im.onerror = finish; im.src = PROFILE.pic;
    } else { g.fillStyle = PROFILE.color; g.font = `600 34px ${serif}`; g.textAlign = 'center'; g.fillText(initials(), 85, 87); g.textAlign = 'left'; finish(); }
  });

  // ---------- master rules flipbook ----------
  // The site ships the master rulebook (assets/rulebook.pdf) and opens it by default, drawn with pdf.js.
  // A reader can open a different PDF from their device and keep it in this browser's IndexedDB;
  // only the bookmarks and last page go in the backup file.
  // The FAQ and errata document ships too, as a second book with its own page and bookmarks.
  const BOOKS = {
    rules: { src: 'assets/rulebook.pdf', name: 'Heroscape Master Game Rulebook' },
    faq: { src: 'assets/faq.pdf', name: 'All Time Format FAQ and Errata' }
  };
  // RULES.page and RULES.marks are those of the open book
  const RULES = {
    book: 'rules', bk: { rules: { page: 1, marks: [] }, faq: { page: 1, marks: [] } },
    get page() { return this.bk[this.book].page; }, set page(v) { this.bk[this.book].page = v; },
    get marks() { return this.bk[this.book].marks; }, set marks(v) { this.bk[this.book].marks = v; }
  };
  const cleanBook = (o) => ({
    page: Math.max(1, Math.min(999, Math.round(+(o && o.page)) || 1)),
    marks: (Array.isArray(o && o.marks) ? o.marks : []).slice(0, 100)
      .map((m) => ({ p: Math.max(1, Math.min(999, Math.round(+(m && m.p)) || 1)), t: str(m && m.t, 60) }))
  });
  registerSaved({
    key: 'rules', label: 'rulebook bookmarks',
    get: () => ({ page: RULES.bk.rules.page, marks: RULES.bk.rules.marks.slice(), faq: { page: RULES.bk.faq.page, marks: RULES.bk.faq.marks.slice() }, book: RULES.book }),
    clean: (o) => ({ ...cleanBook(o), faq: cleanBook(o && o.faq), book: o && o.book === 'faq' ? 'faq' : 'rules' }),
    apply: (v, merge) => {
      if (!v) { RULES.book = 'rules'; RULES.bk = { rules: { page: 1, marks: [] }, faq: { page: 1, marks: [] } }; return; }
      for (const [id, b] of [['rules', v], ['faq', v.faq]]) {
        const cur = RULES.bk[id];
        if (!merge) cur.page = b.page;
        const have = new Set(merge ? cur.marks.map((m) => m.p) : []);
        cur.marks = (merge ? cur.marks : []).concat(b.marks.filter((m) => !have.has(m.p))).sort((a, b2) => a.p - b2.p);
      }
      if (!merge) RULES.book = v.book;
    }
  });

  const rb = (c) => root.querySelector('#rules .' + c);
  const RB = { doc: null, zoom: 1, busy: false, lib: null, loading: null, stored: null, text: null, hits: [], hit: -1, q: '' };
  const IDB = {
    open() {
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('no IndexedDB'));
        const q = indexedDB.open('heroscape-tracker', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('files');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
    },
    async run(mode, fn) {
      const db = await IDB.open();
      return new Promise((res, rej) => {
        const t = db.transaction('files', mode);
        const r = fn(t.objectStore('files'));
        t.oncomplete = () => { db.close(); res(r && r.result); };
        t.onerror = () => { db.close(); rej(t.error); };
      });
    },
    get: (k) => IDB.run('readonly', (s) => s.get(k)),
    put: (k, v) => IDB.run('readwrite', (s) => s.put(v, k)),
    del: (k) => IDB.run('readwrite', (s) => s.delete(k))
  };
  const rbMsg = (t) => { rb('rb-msg').textContent = t; };

  function pdfLib() {
    if (RB.lib) return Promise.resolve(RB.lib);
    if (RB.loading) return RB.loading;
    RB.loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) return rej(new Error('pdf reader did not load'));
        lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        RB.lib = lib; res(lib);
      };
      s.onerror = () => { RB.loading = null; rej(new Error('pdf reader did not load')); };
      document.head.appendChild(s);
    });
    return RB.loading;
  }

  async function openPdf(bytes, name, fromStore) {
    rbMsg('Opening ' + name + '…');
    try {
      const lib = await pdfLib();
      if (RB.doc) { RB.doc.destroy(); RB.doc = null; }
      RB.doc = await lib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
      RB.name = name;
      RB.text = null; RB.hits = []; RB.hit = -1;
      if (rb('rb-find').value.trim()) runFind(true);
      RULES.page = Math.min(RULES.page, RB.doc.numPages);
      rbMsg(name + ' · ' + RB.doc.numPages + ' pages' + (fromStore ? ' · kept in this browser' : ''));
      rb('rb-viewer').hidden = false;
      fillMarks();
      showSpread(false);
    } catch (e) {
      rbMsg('That file could not be read as a PDF (' + (e.message || e) + ').');
    }
  }

  rb('rb-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (rb('rb-keep').checked) {
      try { await IDB.put('rulebook', { name: f.name, bytes }); RB.stored = f.name; } catch (err) { /* storage blocked: still open it */ }
    }
    RULES.book = 'rules'; syncBookSeg();
    RULES.page = 1;
    await openPdf(bytes, f.name, false);
    e.target.value = '';
    persist();
    drawRules();
  });
  rb('rb-forget').addEventListener('click', async () => {
    try { await IDB.del('rulebook'); } catch (e) { /* nothing stored */ }
    RB.stored = null;
    RULES.book = 'rules'; syncBookSeg();
    RULES.page = 1;
    persist();
    openSite();
    drawRules();
  });
  function openSite() {
    const B = BOOKS[RULES.book];
    rbMsg('Opening ' + B.name + '…');
    fetch(B.src).then((r) => { if (!r.ok) throw new Error('not found'); return r.arrayBuffer(); })
      .then((b) => openPdf(new Uint8Array(b), B.name, false))
      .catch(() => rbMsg('The ' + B.name + ' could not be loaded.' + (RULES.book === 'rules' ? ' You can open a rulebook PDF from your device.' : '')));
  }
  // switch between the rulebook (or the reader's own PDF) and the FAQ
  function openBook() {
    syncBookSeg();
    if (RULES.book === 'rules') {
      IDB.get('rulebook').catch(() => null).then((v) => { if (v && v.bytes) openPdf(v.bytes, v.name, true); else openSite(); });
    } else openSite();
  }
  function syncBookSeg() {
    root.querySelectorAll('#rules .rb-book-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.book === RULES.book)));
    rb('rb-own').hidden = RULES.book !== 'rules';
    rb('rb-findl').textContent = RULES.book === 'rules' ? 'Find in rulebook' : 'Find in FAQ';
  }
  root.querySelectorAll('#rules .rb-book-seg button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.book === RULES.book) return;
    RULES.book = b.dataset.book; persist(); openBook();
  }));

  // one page on narrow screens, two facing pages (cover alone) when there is room
  const twoUp = () => rb('rb-stage').clientWidth >= 720;
  function spreadOf(p) {
    if (!twoUp() || p === 1) return [p];
    const left = p % 2 === 0 ? p : p - 1;
    return left + 1 <= RB.doc.numPages ? [left, left + 1] : [left];
  }
  async function paint(canvas, n, w) {
    canvas._spot = null;
    if (!n) { canvas.hidden = true; return; }
    canvas.hidden = false;
    const page = await RB.doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = w / v1.width;
    const dpr = Math.min(window.devicePixelRatio || 1, RB.zoom > 1.5 ? 1.5 : 2);
    const v = page.getViewport({ scale: scale * dpr });
    const tmp = document.createElement('canvas');
    tmp.width = Math.floor(v.width); tmp.height = Math.floor(v.height);
    await page.render({ canvasContext: tmp.getContext('2d'), viewport: v }).promise;
    canvas.width = tmp.width; canvas.height = tmp.height;
    canvas.style.width = Math.floor(v1.width * scale) + 'px';
    const g = canvas.getContext('2d');
    g.drawImage(tmp, 0, 0);
    canvas._spot = await markHits(g, page, v, n, scale);
    canvas.setAttribute('aria-label', 'Page ' + n);
  }
  async function showSpread(dir) {
    if (!RB.doc) return;
    if (RB.busy) { RB.again = true; return RB.busy; } // redraw again once the current one is done
    let done;
    RB.busy = new Promise((r) => { done = r; });
    const pages = spreadOf(RULES.page);
    const stageW = rb('rb-stage').clientWidth - 8;
    const base = stageW * RB.zoom;
    const w = Math.max(200, Math.floor(base / pages.length));
    const book = rb('rb-book');
    if (dir) {
      const fl = rb('rb-flip');
      fl.className = 'rb-flip go-' + dir;
      setTimeout(() => { fl.className = 'rb-flip'; }, 450);
    }
    try {
      await paint(rb('rb-left'), pages[0], w);
      await paint(rb('rb-right'), pages[1], w);
    } catch (e) { rbMsg('A page could not be drawn (' + (e.message || e) + ').'); }
    book.classList.toggle('two', pages.length === 2);
    const n = RB.doc.numPages;
    rb('rb-pos').textContent = (pages.length === 2 ? 'Pages ' + pages[0] + '–' + pages[1] : 'Page ' + pages[0]) + ' of ' + n;
    rb('rb-page').max = n; rb('rb-page').value = pages[0];
    rb('rb-prev').disabled = pages[0] <= 1;
    rb('rb-next').disabled = pages[pages.length - 1] >= n;
    const marked = RULES.marks.some((m) => pages.includes(m.p));
    rb('rb-mark').textContent = marked ? 'Remove bookmark' : 'Bookmark this page';
    RB.busy = false;
    done();
    if (RB.again) { RB.again = false; return showSpread(false); }
    if (RB.seek) {
      RB.seek = false;
      const c = [rb('rb-left'), rb('rb-right')].find((x) => x._spot);
      if (c) {
        const st = rb('rb-stage'), s = c._spot, cr = c.getBoundingClientRect(), sr = st.getBoundingClientRect();
        st.scrollLeft += cr.left - sr.left + s.x - sr.width / 2;
        st.scrollTop += cr.top - sr.top + s.y - Math.min(sr.height, window.innerHeight) / 2;
        const top = cr.top + s.y;
        if (top < 60 || top > window.innerHeight - 60) window.scrollBy(0, top - window.innerHeight / 2);
      }
    }
  }

  // ---- find in the rulebook (text comes from pdf.js; matches are painted on the page) ----
  async function pageText(n) {
    RB.text = RB.text || [];
    if (!RB.text[n]) {
      const tc = await (await RB.doc.getPage(n)).getTextContent();
      let all = '';
      const items = [];
      for (const it of tc.items) {
        if (typeof it.str !== 'string') continue;
        items.push({ at: all.length, str: it.str, tr: it.transform, w: it.width });
        all += it.str + (it.hasEOL ? ' ' : '');
      }
      RB.text[n] = { all: all.toLowerCase(), items };
    }
    return RB.text[n];
  }
  const findRe = (q) => new RegExp(q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'g');
  async function runFind(keepPage) {
    const q = rb('rb-find').value.trim();
    RB.q = q; RB.hits = []; RB.hit = -1;
    if (!RB.doc || !q) { findStatus(); showSpread(false); return; }
    rb('rb-hits').textContent = 'Searching…';
    const re = findRe(q);
    for (let n = 1; n <= RB.doc.numPages; n++) {
      const t = await pageText(n);
      if (RB.q !== q) return; // a newer search started
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t.all))) { if (!m[0].length) { re.lastIndex++; continue; } RB.hits.push({ p: n, a: m.index, b: m.index + m[0].length }); }
    }
    if (!RB.hits.length) { findStatus(); showSpread(false); return; }
    const from = spreadOf(RULES.page)[0];
    const i = RB.hits.findIndex((h) => h.p >= from);
    showHit(keepPage ? -1 : (i < 0 ? 0 : i));
  }
  function showHit(i) {
    RB.hit = i;
    findStatus();
    if (i >= 0) { RULES.page = RB.hits[i].p; RB.seek = true; persist(); }
    showSpread(false);
  }
  function stepHit(d) {
    if (!RB.hits.length) return;
    showHit(((RB.hit < 0 ? (d > 0 ? -1 : 0) : RB.hit) + d + RB.hits.length) % RB.hits.length);
  }
  function findStatus() {
    const n = RB.hits.length;
    rb('rb-fprev').disabled = rb('rb-fnext').disabled = !n;
    rb('rb-hits').textContent = !RB.q ? '' : !n ? 'No matches' : (RB.hit >= 0 ? (RB.hit + 1) + ' of ' + n + ' · page ' + RB.hits[RB.hit].p : n + (n === 1 ? ' match' : ' matches'));
  }
  async function markHits(g, page, v, n, scale) {
    const hits = RB.hits.filter((h) => h.p === n);
    if (!hits.length) return null;
    const t = await pageText(n);
    const lib = RB.lib;
    let spot = null;
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (const h of hits) {
      const cur = RB.hits[RB.hit] === h;
      g.fillStyle = cur ? 'rgb(255 150 40 / .75)' : 'rgb(255 230 0 / .55)';
      for (const it of t.items) {
        const s = Math.max(h.a, it.at) - it.at, e = Math.min(h.b, it.at + it.str.length) - it.at;
        if (e <= s || !it.str.length) continue;
        const tx = lib.Util.transform(v.transform, it.tr);
        const fh = Math.hypot(tx[2], tx[3]);
        const fw = it.w * v.scale;
        const x = tx[4] + fw * (s / it.str.length), w = fw * ((e - s) / it.str.length);
        g.fillRect(x - 1, tx[5] - fh, w + 2, fh * 1.2);
        if (cur && !spot) { const k = v.width / parseFloat(g.canvas.style.width); spot = { x: x / k, y: (tx[5] - fh / 2) / k }; }
      }
    }
    g.restore();
    return spot;
  }
  let findT = 0;
  rb('rb-find').addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(() => runFind(false), 300); });
  rb('rb-find').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(findT);
      if (RB.q !== rb('rb-find').value.trim()) runFind(false); else stepHit(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'Escape' && rb('rb-find').value) { e.preventDefault(); e.stopPropagation(); rb('rb-find').value = ''; runFind(true); }
  });
  rb('rb-find').addEventListener('search', () => { if (!rb('rb-find').value) runFind(true); });
  rb('rb-fprev').addEventListener('click', () => stepHit(-1));
  rb('rb-fnext').addEventListener('click', () => stepHit(1));
  document.addEventListener('keydown', (e) => {
    if (state.page !== 'rules' || !RB.doc || !(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'f') return;
    e.preventDefault();
    const f = rb('rb-find');
    f.scrollIntoView({ block: 'nearest' });
    f.focus(); f.select();
  });

  // ---- zoom: scroll over the book to zoom toward the pointer, drag to pan ----
  // The canvases are stretched right away (a little soft), then redrawn sharp once zooming pauses.
  const ZMIN = 1, ZMAX = 4;
  let zoomT = 0;
  function zoomBy(k, cx, cy) {
    if (!RB.doc) return;
    const z = Math.max(ZMIN, Math.min(ZMAX, RB.zoom * k));
    if (Math.abs(z - RB.zoom) < 1e-3) return;
    const st = rb('rb-stage'), sr = st.getBoundingClientRect();
    if (cx == null) { cx = sr.width / 2; cy = Math.min(sr.height, window.innerHeight) / 2; }
    const r = z / RB.zoom;
    const before = rb('rb-book').getBoundingClientRect();
    RB.zoom = z;
    zoomUI();
    for (const c of [rb('rb-left'), rb('rb-right')]) if (!c.hidden && c.style.width) c.style.width = parseFloat(c.style.width) * r + 'px';
    // keep the point under the pointer still
    const after = rb('rb-book').getBoundingClientRect();
    const px = sr.left + cx - before.left, py = sr.top + cy - before.top;
    st.scrollLeft += after.left + px * r - (sr.left + cx);
    st.scrollTop += after.top + py * r - (sr.top + cy);
    clearTimeout(zoomT);
    zoomT = setTimeout(() => showSpread(false), 250);
  }
  function setZoom(z) { if (RB.doc) zoomBy(z / RB.zoom); }
  function zoomUI() {
    rb('rb-zfit').hidden = RB.zoom <= 1;
    rb('rb-stage').classList.toggle('wide', RB.zoom > 1);
  }
  rb('rb-zfit').addEventListener('click', () => setZoom(1));
  rb('rb-stage').addEventListener('wheel', (e) => {
    if (!RB.doc) return;
    if (e.deltaY > 0 && RB.zoom <= ZMIN) return; // fully zoomed out: let the page scroll
    e.preventDefault();
    const sr = rb('rb-stage').getBoundingClientRect();
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    zoomBy(Math.exp(-Math.max(-200, Math.min(200, d)) * 0.0015), e.clientX - sr.left, e.clientY - sr.top);
  }, { passive: false });
  rb('rb-stage').addEventListener('dblclick', (e) => { if (RB.zoom > 1) { e.preventDefault(); setZoom(1); } });
  let pan = null;
  rb('rb-stage').addEventListener('pointerdown', (e) => {
    if (RB.zoom <= 1 || e.pointerType === 'touch' || e.button !== 0) return;
    const st = rb('rb-stage');
    pan = { x: e.clientX, y: e.clientY, l: st.scrollLeft, t: st.scrollTop, id: e.pointerId };
    st.setPointerCapture(e.pointerId);
    st.classList.add('panning');
    e.preventDefault();
  });
  rb('rb-stage').addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    const st = rb('rb-stage');
    st.scrollLeft = pan.l - (e.clientX - pan.x);
    st.scrollTop = pan.t - (e.clientY - pan.y);
  });
  const panEnd = () => { pan = null; rb('rb-stage').classList.remove('panning'); };
  rb('rb-stage').addEventListener('pointerup', panEnd);
  rb('rb-stage').addEventListener('pointercancel', panEnd);
  let pinch = null;
  rb('rb-stage').addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (e.cancelable) e.preventDefault();
    if (pinch) {
      const sr = rb('rb-stage').getBoundingClientRect();
      zoomBy(d / pinch, (a.clientX + b.clientX) / 2 - sr.left, (a.clientY + b.clientY) / 2 - sr.top);
    }
    pinch = d;
  }, { passive: false });
  rb('rb-stage').addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });
  function turn(d) {
    if (!RB.doc) return;
    const pages = spreadOf(RULES.page);
    const next = d > 0 ? pages[pages.length - 1] + 1 : pages[0] - 1;
    if (next < 1 || next > RB.doc.numPages) return;
    RULES.page = next;
    persist();
    showSpread(d > 0 ? 'next' : 'prev');
  }
  function goTo(p) {
    if (!RB.doc) return;
    RULES.page = Math.max(1, Math.min(RB.doc.numPages, Math.round(p) || 1));
    persist();
    showSpread(false);
  }
  rb('rb-prev').addEventListener('click', () => turn(-1));
  rb('rb-next').addEventListener('click', () => turn(1));
  rb('rb-page').addEventListener('change', (e) => goTo(+e.target.value));
  rb('rb-book').addEventListener('click', (e) => {
    if (RB.zoom > 1) return; // zoomed in: clicks don't turn pages, so reading and scrolling stay put
    const r = rb('rb-book').getBoundingClientRect();
    turn(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });
  rb('rb-stage').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.25); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(0.8); }
    if (e.key === '0') { e.preventDefault(); setZoom(1); }
  });
  let touchX = null;
  rb('rb-stage').addEventListener('touchstart', (e) => { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  rb('rb-stage').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50 && RB.zoom <= 1) turn(dx < 0 ? 1 : -1);
  });
  rb('rb-mark').addEventListener('click', async () => {
    if (!RB.doc) return;
    const pages = spreadOf(RULES.page);
    const hit = RULES.marks.filter((m) => pages.includes(m.p));
    if (hit.length) RULES.marks = RULES.marks.filter((m) => !pages.includes(m.p));
    else {
      const t = ((await ask({ title: 'Name this bookmark', value: 'Page ' + pages[0], ok: 'Save' })) || '').trim();
      if (!t) return;
      RULES.marks = RULES.marks.concat({ p: pages[0], t: t.slice(0, 60) }).sort((a, b) => a.p - b.p);
    }
    persist();
    fillMarks();
    showSpread(false);
  });
  rb('rb-marks').addEventListener('change', (e) => { if (e.target.value) goTo(+e.target.value); e.target.value = ''; });
  function fillMarks() {
    const s = rb('rb-marks');
    s.replaceChildren(new Option(RULES.marks.length ? 'Bookmarks (' + RULES.marks.length + ')' : 'No bookmarks yet', ''));
    for (const m of RULES.marks) s.append(new Option('p. ' + m.p + ' · ' + m.t, String(m.p)));
  }
  let rbWidth = 0;
  window.addEventListener('resize', () => {
    if (state.page !== 'rules' || !RB.doc) return;
    const w = rb('rb-stage').clientWidth;
    if (Math.abs(w - rbWidth) > 40) { rbWidth = w; showSpread(false); }
  });

  ON_ERASE.push(() => { IDB.del('rulebook').catch(() => {}); RB.stored = null; if (RB.doc) { RB.doc.destroy(); RB.doc = null; } rb('rb-viewer').hidden = true; rbMsg(''); rbChecked = false; });

  let rbChecked = false;
  function drawRules() {
    fillMarks();
    if (!rbChecked) {
      rbChecked = true;
      IDB.get('rulebook').catch(() => null).then((v) => {
        syncBookSeg();
        if (v && v.bytes) { RB.stored = v.name; rb('rb-forget').hidden = false; if (!RB.doc && RULES.book === 'rules') openPdf(v.bytes, v.name, true); }
        if (!RB.doc && !(v && v.bytes && RULES.book === 'rules')) openSite();
      });
    }
    rb('rb-forget').hidden = !RB.stored;
    if (RB.doc) { rbWidth = rb('rb-stage').clientWidth; showSpread(false); }
  }

  // ---------- edit mode (for the site owner) ----------
  // Open the site with #edit (or ?edit). Tap text to retype it, drag blocks by their handle, drop images into
  // the image spots, then "Save site changes" downloads site-edits.json. Put that file next to index.html and
  // every visitor sees the changes. Nothing is sent anywhere; an unsaved draft is kept in this browser only.
  const ED_FILE = 'site-edits.json', ED_DRAFT = 'heroscape-tracker:edits-draft', ED_ON = 'heroscape-tracker:edit-on';
  const EMPTY_EDITS = () => ({ text: {}, order: {}, images: {}, pixel: [], stickers: [], themes: [], badges: [] });
  const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  let EDITS = EMPTY_EDITS(), PUBLISHED = EMPTY_EDITS(), ED_DIRTY = false, EDIT_THEME = '';
  // visitors' own themes: made with the same tools (MAKER is on), kept only in their browser and backup file
  let USER_THEMES = [], MAKER = false;
  const editTheme = () => (MAKER ? USER_THEMES : EDITS.themes).find((t) => t.id === EDIT_THEME) || null;
  const tgt = () => editTheme() || EDITS; // where new pictures go: the theme being edited, or the standard site
  const edActive = () => EDIT_MODE || MAKER;
  // pictures in use: the standard ones, with the chosen theme's own pictures on top
  function effImages() {
    const t = siteTheme(), ti = t ? t.images : {};
    return { images: { ...EDITS.images, ...ti }, pixel: [...EDITS.pixel.filter((k) => !(k in ti) && !(k === 'bgfill' && 'background' in ti)), ...(t ? t.pixel : [])] };
  }
  const ORIG = {};
  const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  const ASSET_RE = /^assets\/[\w .()-]{1,80}\.(png|jpe?g|gif|webp|svg)$/i; // files put in the site's assets folder by hand
  function cleanEdits(o) {
    const e = EMPTY_EDITS();
    if (!o || typeof o !== 'object') return e;
    for (const [k, v] of Object.entries(o.text || {})) if (/^[\w:-]{1,40}$/.test(k) && typeof v === 'string') e.text[k] = v.slice(0, 2000);
    for (const [k, v] of Object.entries(o.order || {})) if (/^[\w:-]{1,40}$/.test(k) && Array.isArray(v)) e.order[k] = v.slice(0, 50).map((x) => str(x, 40));
    for (const [k, v] of Object.entries(o.images || {})) if (/^[\w:-]{1,40}$/.test(k) && ((IMG_RE.test(String(v)) && v.length < 3000000) || ASSET_RE.test(String(v)))) e.images[k] = v;
    // 'bgfill' in the list means the background picture fills the screen instead of tiling
    e.pixel = (Array.isArray(o.pixel) ? o.pixel : []).filter((k) => k in e.images || (k === 'bgfill' && 'background' in e.images)).slice(0, 50);
    // free art: pictures placed anywhere. at = what it sticks to; x, y = its middle in % of that; w = width in % of it
    const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    e.stickers = (Array.isArray(o.stickers) ? o.stickers : []).filter((k) => k && !k.gone && ((IMG_RE.test(String(k.src)) && k.src.length < 3000000) || ASSET_RE.test(String(k.src)))).slice(0, 40).map((k) => ({
      id: /^[\w-]{1,30}$/.test(k.id) ? k.id : uid(), src: k.src, page: /^[\w-]{0,30}$/.test(k.page || '') || /^unit:[^\u0000-\u001f<>]{1,80}$/.test(k.page) ? k.page || '' : '',
      at: ['screen', 'header', 'page', 'block'].includes(k.at) ? k.at : 'page', block: Math.round(num(k.block, 0, 200, 0)),
      layer: k.layer === 'back' ? 'back' : 'front', px: !!k.px,
      // u 'px': drawings keep exact pixel spots (x from the page's middle, y from its top), so pieces never drift apart
      ...(k.u === 'px' && k.at === 'page'
        ? { u: 'px', x: num(k.x, -10000, 10000, 0), y: num(k.y, -2000, 400000, 0), w: num(k.w, 0.5, 6000, 100) }
        : { x: num(k.x, -20, 120, 50), y: num(k.y, -20, 120, 50), w: num(k.w, 1, 100, 30) })
    }));
    // themes: each has its own pictures and colors; visitors choose one in Settings
    e.themes = (Array.isArray(o.themes) ? o.themes : []).slice(0, 20).map((t) => {
      const x = cleanEdits({ images: t && t.images, pixel: t && t.pixel, stickers: t && t.stickers });
      const colors = {}; for (const k of COLOR_KEYS) { const h = hex(t && t.colors && t.colors[k]); if (h) colors[k] = h; }
      return { id: /^[\w-]{1,30}$/.test(t && t.id) ? t.id : uid(), name: str(t && t.name, 40).trim() || 'Theme', mode: ['light', 'dark'].includes(t && t.mode) ? t.mode : '', unlock: str(t && t.unlock, 20), colors, images: x.images, pixel: x.pixel, stickers: x.stickers };
    });
    // hidden day achievements: earned by opening the site on a day from "from" to "to" (MM-DD, every year)
    e.badges = (Array.isArray(o.badges) ? o.badges : []).slice(0, 50).map((b) => ({
      id: /^day-[\w-]{1,16}$/.test(b && b.id) ? b.id : 'day-' + uid().slice(0, 12), name: str(b && b.name, 40).trim() || 'Day achievement', desc: str(b && b.desc, 140),
      icon: str(b && b.icon, 4), rule: b && b.rule === 'easter' ? 'easter' : '', from: MD_RE.test(b && b.from) ? b.from : '01-01', to: MD_RE.test(b && b.to) ? b.to : (MD_RE.test(b && b.from) ? b.from : '01-01')
    }));
    return e;
  }
  const sameEdits = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // image spots: a logo spot in the header and a banner spot at the top of every page
  function addSlot(parent, key, cls, before) {
    const d = mk('div', 'ed-slot ' + cls); d.dataset.slot = key;
    if (before) parent.insertBefore(d, before); else parent.prepend(d);
    return d;
  }
  addSlot(root.querySelector('.site-head .brand'), 'logo', 'ed-logo', root.querySelector('.site-head .brand > div'));
  root.querySelectorAll('.hs-page').forEach((sec) => {
    const s = addSlot(sec, 'banner:' + sec.id, 'ed-banner');
    if (sec.id === 'home') s.dataset.eitem = 'banner';
  });

  // ---- applying edits ----
  function recordOriginals() { root.querySelectorAll('[data-ek]').forEach((el) => { if (!(el.dataset.ek in ORIG)) ORIG[el.dataset.ek] = el.textContent; }); }
  function applyText() {
    recordOriginals();
    root.querySelectorAll('[data-ek]').forEach((el) => {
      const k = el.dataset.ek, want = k in EDITS.text ? EDITS.text[k] : ORIG[k];
      if (want != null && el.textContent !== want && !el.contains(document.activeElement)) el.textContent = want;
    });
  }
  function applyOrder() {
    root.querySelectorAll('[data-eorder]').forEach((box) => {
      const items = [...box.children].filter((c) => c.dataset.eitem);
      const want = EDITS.order[box.dataset.eorder];
      const rank = (c) => { const i = want ? want.indexOf(c.dataset.eitem) : -1; return i < 0 ? 1e3 + (+c.dataset.ehome || 0) : i; };
      items.forEach((c, i) => { if (c.dataset.ehome == null) c.dataset.ehome = String(i); });
      const sorted = items.slice().sort((a, b) => rank(a) - rank(b) || a.dataset.ehome - b.dataset.ehome);
      // put the sorted items back into the places items held, so other children (like the menu's Home link) stay put
      const marks = items.map((c) => { const m = document.createComment('slot'); box.insertBefore(m, c); return m; });
      marks.forEach((m, i) => { box.insertBefore(sorted[i], m); m.remove(); });
    });
  }
  function applyImages() {
    const E = effImages();
    root.querySelectorAll('.ed-slot').forEach((s) => {
      const src = E.images[s.dataset.slot];
      let im = s.querySelector('img.ed-img');
      if (src) {
        if (!im) { im = document.createElement('img'); im.className = 'ed-img'; im.alt = ''; s.prepend(im); }
        if (im.getAttribute('src') !== src) im.setAttribute('src', src);
        im.classList.toggle('px', E.pixel.includes(s.dataset.slot));
      } else if (im) im.remove();
      s.classList.toggle('has', !!src);
    });
    // whole-site background picture: tiled, or filling the screen when the theme says so
    const bg = E.images.background;
    document.body.style.backgroundImage = bg ? `url("${bg}")` : '';
    document.body.classList.toggle('ed-bg', !!bg);
    document.body.classList.toggle('ed-bgpx', !!bg && E.pixel.includes('background'));
    document.body.classList.toggle('ed-bgfill', !!bg && E.pixel.includes('bgfill'));
    applyStickers();
  }
  function syncSite() {
    setDayBadges(EDITS.badges);
    if (!EDIT_MODE) checkDays();
    SITE_THEMES = [...EDITS.themes, ...USER_THEMES];
    SITE_PREVIEW = edActive() ? EDIT_THEME : null;
    applyTheme(); // also re-applies the pictures through SITE_HOOK
  }
  SITE_HOOK = applyImages;
  function applyEdits() { applyText(); applyOrder(); syncSite(); }
  registerSaved({
    key: 'mythemes', label: 'your own themes',
    get: () => USER_THEMES.map(({ mine, ...t }) => t),
    clean: (o) => cleanEdits({ themes: o }).themes.map((t) => ({ ...t, unlock: '' })),
    apply: (v, merge) => {
      const add = (v || []).map((t) => ({ ...t, mine: true }));
      USER_THEMES = merge ? USER_THEMES.concat(add.filter((t) => !USER_THEMES.some((u) => u.id === t.id))) : add;
      syncSite();
    }
  });

  // the published edits file, then (in edit mode) this browser's unsaved draft
  let EDIT_MODE = false;
  try { EDIT_MODE = sessionStorage.getItem(ED_ON) === '1'; } catch (e) { /* storage blocked */ }
  if (/(^|[?&])edit(=|&|$)/.test(location.search.slice(1)) || location.hash === '#edit') EDIT_MODE = true;
  fetch(ED_FILE, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
    PUBLISHED = cleanEdits(j);
    EDITS = JSON.parse(JSON.stringify(PUBLISHED));
    if (EDIT_MODE) {
      const d = lsGet(ED_DRAFT);
      if (d) { try { EDITS = cleanEdits(JSON.parse(d)); } catch (e) { /* bad draft */ } }
      ED_DIRTY = !sameEdits(EDITS, PUBLISHED);
    }
    applyEdits();
    if (EDIT_MODE) startEditing();
  });

  // ---- edit mode ----
  const bar = mk('div', 'ed-bar'); bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Edit mode');
  document.body.appendChild(bar);
  const pop = mk('div', 'ed-pop'); pop.hidden = true; document.body.appendChild(pop);
  let TEXT_ON = true, BAR_SMALL = false, DAYS_OPEN = false;
  function saveDraft() {
    if (MAKER) {
      // a visitor's theme goes into this browser's saved data and the backup file, never the site
      const ok = persist();
      drawBar();
      if (ok === false) edMsg('This browser is out of room. Use smaller pictures, or download a backup so you keep your theme.');
      return;
    }
    ED_DIRTY = !sameEdits(EDITS, PUBLISHED);
    if (ED_DIRTY) lsSet(ED_DRAFT, JSON.stringify(EDITS)); else lsDel(ED_DRAFT);
    drawBar();
  }
  function changeCount() { return Object.keys(EDITS.text).length + Object.keys(EDITS.order).length + Object.keys(EDITS.images).length + EDITS.stickers.length + EDITS.themes.length + EDITS.badges.length; }
  function drawBar() {
    bar.replaceChildren();
    if (MAKER) { drawMakerBar(); return; }
    const top = mk('div', 'ed-row');
    top.appendChild(mk('b', '', 'Edit mode'));
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Go to page');
    root.querySelectorAll('.hs-page').forEach((s) => { const n = root.querySelector(`[data-ek="page:${s.id}"]`); sel.append(new Option(s.id === 'home' ? 'Home' : (n ? n.textContent : s.id), s.id)); });
    sel.value = state.page;
    sel.addEventListener('change', () => showPage(sel.value, true));
    top.appendChild(sel);
    const tl = mk('label', 'hs-chk'); const tc = document.createElement('input'); tc.type = 'checkbox'; tc.checked = TEXT_ON;
    tc.addEventListener('change', () => { TEXT_ON = tc.checked; document.body.classList.toggle('ed-text', TEXT_ON); });
    tl.append(tc, document.createTextNode(' Tap text to edit'));
    top.appendChild(tl);
    top.appendChild(btn(BAR_SMALL ? 'Show tools' : 'Hide tools', 'hs-sm', () => { BAR_SMALL = !BAR_SMALL; drawBar(); }));
    bar.appendChild(top);
    if (BAR_SMALL) { padForBar(); return; }
    const act = mk('div', 'ed-row');
    act.append(
      btn('Save site changes', 'hs-primary', saveFile),
      btn('Open a changes file', '', () => fileIn.click()),
      btn('Undo unsaved', '', () => { EDITS = JSON.parse(JSON.stringify(PUBLISHED)); saveDraft(); applyEdits(); edMsg('Back to the published version.'); }),
      btn('Remove all changes', '', (e) => { if (!armed('clear', e.currentTarget, 'Tap again to remove all')) return; EDITS = EMPTY_EDITS(); saveDraft(); applyEdits(); edMsg('All changes removed. Save to make it final.'); }),
      btn('Exit', '', stopEditing)
    );
    bar.appendChild(act);
    // themes: pictures and colors made here go into the theme picked in this list
    const th = mk('div', 'ed-row ed-themes');
    const tsel = document.createElement('select'); tsel.setAttribute('aria-label', 'Theme you are editing');
    tsel.append(new Option('Standard site', ''), ...EDITS.themes.map((t) => new Option('Theme: ' + t.name, t.id)));
    tsel.value = EDIT_THEME;
    tsel.addEventListener('change', () => { EDIT_THEME = tsel.value; syncSite(); drawBar(); drawSlots(); });
    th.append(mk('span', 'hs-note', 'Editing:'), tsel, btn('New theme', 'hs-sm', () => {
      const t = { id: uid(), name: 'Theme ' + (EDITS.themes.length + 1), mode: '', unlock: '', colors: {}, images: {}, pixel: [], stickers: [] };
      EDITS.themes.push(t); EDIT_THEME = t.id; saveDraft(); syncSite(); drawSlots(); edMsg('New theme. Its pictures and colors start from the standard site; add your own.');
    }), btn('Import a theme', 'hs-sm', () => themeIn.click()));
    const T = editTheme();
    if (T) {
      const nm = document.createElement('input'); nm.type = 'text'; nm.value = T.name; nm.maxLength = 40; nm.className = 'ed-tname'; nm.setAttribute('aria-label', 'Theme name');
      nm.addEventListener('change', () => { T.name = nm.value.trim() || T.name; saveDraft(); syncSite(); });
      const md = document.createElement('select'); md.setAttribute('aria-label', 'Light or dark');
      md.append(new Option('Light or dark: visitor\'s choice', ''), new Option('Always light', 'light'), new Option('Always dark', 'dark'));
      md.value = T.mode; md.addEventListener('change', () => { T.mode = md.value; saveDraft(); syncSite(); });
      const ul = document.createElement('select'); ul.setAttribute('aria-label', 'Who can use this theme');
      ul.append(new Option('Open to everyone', ''), ...BADGES.filter((b) => !b[5]).map((b) => new Option('Unlocks with: ' + b[1], b[0])),
        ...BADGES.filter((b) => b[5] && b[6] !== 'day').map((b, i) => new Option('Unlocks with: hidden achievement ' + (i + 1), b[0])),
        ...BADGES.filter((b) => b[6] === 'day').map((b) => new Option('Unlocks with: ' + b[1] + ' (day)', b[0])));
      ul.value = T.unlock || ''; ul.addEventListener('change', () => { T.unlock = ul.value; saveDraft(); syncSite(); });
      th.appendChild(ul);
      th.append(nm, md, btn('Delete theme', 'hs-sm', (e) => { if (!armed('deltheme', e.currentTarget, 'Tap again to delete')) return; EDITS.themes = EDITS.themes.filter((x) => x !== T); EDIT_THEME = ''; saveDraft(); syncSite(); drawSlots(); }));
      bar.appendChild(th); bar.appendChild(colorRow(T));
    } else bar.appendChild(th);
    bar.appendChild(moreRow());
    bar.appendChild(stickerRow());
    if (DAYS_OPEN) bar.appendChild(daysPanel());
    const n = changeCount();
    bar.appendChild(mk('div', 'ed-msg', (n ? n + ' change' + (n > 1 ? 's' : '') : 'No changes') + (ED_DIRTY ? ' · not saved to a file yet' : ' · saved')));
    padForBar();
  }
  function colorRow(T) {
    const tc = mk('div', 'ed-row ed-tcolors'); tc.appendChild(mk('span', 'hs-note', 'Theme colors:'));
    const cs = getComputedStyle(document.documentElement);
    for (const [k, label] of [['accent', 'Accent'], ['color-bg', 'Background'], ['color-panel', 'Panels'], ['color-fg', 'Text'], ['color-fg-muted', 'Soft text'], ['color-border-line', 'Lines']]) {
      const l = mk('label', 'ed-tc'); const i = document.createElement('input'); i.type = 'color'; i.value = T.colors[k] || toHex(cs.getPropertyValue('--' + k));
      i.addEventListener('input', () => { T.colors[k] = i.value; syncSite(); });
      i.addEventListener('change', () => saveDraft());
      l.append(i, document.createTextNode(' ' + label)); tc.appendChild(l);
    }
    tc.appendChild(btn('Clear theme colors', 'hs-sm', () => { T.colors = {}; saveDraft(); syncSite(); drawBar(); }));
    return tc;
  }
  // site background and the pixel art tool
  function moreRow() {
    const more = mk('div', 'ed-row');
    more.append(btn('Art maker', '', () => openPixel()), btn('Draw on the page', '', () => openDraw()));
    if (!MAKER) more.appendChild(btn(DAYS_OPEN ? 'Hide day achievements' : 'Day achievements', '', () => { DAYS_OPEN = !DAYS_OPEN; drawBar(); }));
    const bgPick = document.createElement('input'); bgPick.type = 'file'; bgPick.accept = 'image/*'; bgPick.hidden = true;
    bgPick.addEventListener('change', () => { if (bgPick.files[0]) readImage(bgPick.files[0], 'background'); });
    more.append(bgPick, mk('span', 'hs-note', 'Background:'), btn(tgt().images.background ? 'Replace' : 'Choose a picture', 'hs-sm', () => bgPick.click()));
    if (tgt().images.background) {
      more.appendChild(btn('Remove', 'hs-sm', () => clearImage('background')));
      const fl = mk('label', 'hs-chk'); const fc = document.createElement('input'); fc.type = 'checkbox';
      fc.checked = tgt().pixel.includes('bgfill');
      fc.addEventListener('change', () => { const T = tgt(); T.pixel = T.pixel.filter((k) => k !== 'bgfill'); if (fc.checked) T.pixel.push('bgfill'); applyImages(); saveDraft(); });
      fl.append(fc, ' Fill the screen (no tiling)');
      more.appendChild(fl);
    }
    if (!MAKER) more.appendChild(assetField('background'));
    return more;
  }
  // hidden achievements earned by opening the site on certain days of the year
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function mdPick(val, label, set) {
    const w = mk('span', 'ed-md'); w.appendChild(mk('span', 'hs-note', label));
    const m = document.createElement('select'), d = document.createElement('select');
    m.setAttribute('aria-label', label + ' month'); d.setAttribute('aria-label', label + ' day');
    MONTHS.forEach((x, i) => m.append(new Option(x, String(i + 1).padStart(2, '0'))));
    for (let i = 1; i <= 31; i++) d.append(new Option(String(i), String(i).padStart(2, '0')));
    [m.value, d.value] = val.split('-');
    const ch = () => {
      const max = new Date(2024, +m.value, 0).getDate(); // 2024 is a leap year, so Feb 29 is allowed
      if (+d.value > max) d.value = String(max).padStart(2, '0');
      set(m.value + '-' + d.value);
    };
    m.addEventListener('change', ch); d.addEventListener('change', ch);
    w.append(m, d);
    return w;
  }
  function daysPanel() {
    const box = mk('div', 'ed-days');
    box.appendChild(mk('div', 'hs-note', 'Hidden achievements a visitor earns by opening the site on these days (their own device\'s date). Themes can unlock with them.'));
    EDITS.badges.forEach((b) => {
      const row = mk('div', 'ed-row');
      const txt = (v, max, w, label, key) => {
        const i = document.createElement('input'); i.type = 'text'; i.value = v; i.maxLength = max; i.style.width = w; i.setAttribute('aria-label', label); i.placeholder = label;
        i.addEventListener('change', () => { b[key] = i.value.trim() || (key === 'name' ? b.name : ''); saveDraft(); syncSite(); });
        return i;
      };
      const rule = document.createElement('select'); rule.setAttribute('aria-label', 'When');
      rule.append(new Option('On these dates', ''), new Option('Easter Sunday (moves each year)', 'easter'));
      rule.value = b.rule || ''; rule.addEventListener('change', () => { b.rule = rule.value; saveDraft(); syncSite(); drawBar(); });
      row.append(txt(b.icon, 4, '4em', 'Icon', 'icon'), txt(b.name, 40, '12em', 'Name', 'name'), txt(b.desc, 140, '16em', 'Description', 'desc'), rule);
      if (!b.rule) row.append(mdPick(b.from, 'From', (v) => { b.from = v; saveDraft(); syncSite(); }), mdPick(b.to, 'To', (v) => { b.to = v; saveDraft(); syncSite(); }));
      row.append(
        btn('Delete', 'hs-sm', (e) => { if (!armed('delday' + b.id, e.currentTarget, 'Tap again to delete')) return; EDITS.badges = EDITS.badges.filter((x) => x !== b); saveDraft(); syncSite(); }));
      box.appendChild(row);
    });
    box.appendChild(btn('New day achievement', 'hs-sm', () => {
      if (EDITS.badges.length >= 50) return;
      const t = new Date(), md = String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      EDITS.badges.push({ id: 'day-' + uid().slice(0, 12), name: 'Day achievement ' + (EDITS.badges.length + 1), desc: '', icon: '', rule: '', from: md, to: md });
      saveDraft(); syncSite();
    }));
    return box;
  }
  // the visitor's theme maker: themes, colors, pictures and pixel art, saved only for them
  function drawMakerBar() {
    const top = mk('div', 'ed-row');
    top.appendChild(mk('b', '', 'My themes'));
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Go to page');
    root.querySelectorAll('.hs-page').forEach((s) => { const n = root.querySelector(`[data-ek="page:${s.id}"]`); sel.append(new Option(s.id === 'home' ? 'Home' : (n ? n.textContent : s.id), s.id)); });
    sel.value = state.page;
    sel.addEventListener('change', () => showPage(sel.value, true));
    top.append(sel, btn(BAR_SMALL ? 'Show tools' : 'Hide tools', 'hs-sm', () => { BAR_SMALL = !BAR_SMALL; drawBar(); }), btn('Done', 'hs-primary', stopMaker));
    bar.appendChild(top);
    if (BAR_SMALL) { padForBar(); return; }
    const th = mk('div', 'ed-row ed-themes');
    const tsel = document.createElement('select'); tsel.setAttribute('aria-label', 'Theme you are editing');
    tsel.append(...USER_THEMES.map((t) => new Option(t.name, t.id)));
    tsel.value = EDIT_THEME;
    tsel.addEventListener('change', () => { EDIT_THEME = tsel.value; syncSite(); drawBar(); drawSlots(); });
    th.append(mk('span', 'hs-note', 'Editing:'), tsel, btn('New theme', 'hs-sm', newMine));
    const T = editTheme();
    const nm = document.createElement('input'); nm.type = 'text'; nm.value = T.name; nm.maxLength = 40; nm.className = 'ed-tname'; nm.setAttribute('aria-label', 'Theme name');
    nm.addEventListener('change', () => { T.name = nm.value.trim() || T.name; saveDraft(); syncSite(); });
    const md = document.createElement('select'); md.setAttribute('aria-label', 'Light or dark');
    md.append(new Option('Light or dark: my setting', ''), new Option('Always light', 'light'), new Option('Always dark', 'dark'));
    md.value = T.mode; md.addEventListener('change', () => { T.mode = md.value; saveDraft(); syncSite(); });
    th.append(nm, md, btn('Delete theme', 'hs-sm', (e) => {
      if (!armed('deltheme', e.currentTarget, 'Tap again to delete')) return;
      USER_THEMES = USER_THEMES.filter((x) => x !== T);
      if (THEME.site === T.id) THEME.site = '';
      if (!USER_THEMES.length) { stopMaker(); persist(); return; }
      EDIT_THEME = USER_THEMES[0].id; saveDraft(); syncSite(); drawSlots();
    }));
    th.append(btn('Export this theme', 'hs-sm', () => exportMine(T)), btn('Import a theme', 'hs-sm', () => themeIn.click()));
    bar.append(th, colorRow(T), moreRow(), stickerRow());
    bar.appendChild(mk('div', 'ed-msg', REMEMBER ? 'Saved in this browser and in your backup file. The site itself is not changed.' : 'This browser is set not to remember, so download a backup to keep your themes.'));
    padForBar();
  }
  // a single theme as its own file, to share with friends or move between browsers
  function exportMine(T) {
    const { mine, unlock, ...t } = T;
    const data = JSON.stringify({ app: 'heroscape-tracker-theme', format: 1, theme: t });
    try {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'theme-' + (T.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'mine') + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      edMsg('Downloaded ' + a.download + '.');
    } catch (e) { edMsg('Your browser blocked the download.'); }
  }
  const themeIn = document.createElement('input'); themeIn.className = 'ed-themein'; themeIn.type = 'file'; themeIn.accept = 'application/json,.json'; themeIn.hidden = true; document.body.appendChild(themeIn);
  themeIn.addEventListener('change', () => {
    const f = themeIn.files && themeIn.files[0]; themeIn.value = ''; if (!f) return;
    const say = (t) => { if (MAKER) edMsg(t); else { const n = root.querySelector('.st-sitenote'); if (n) n.textContent = t; } };
    if (f.size > 5000000) { say('That file is too big to be a theme.'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      let t;
      try { const j = JSON.parse(rd.result); if (j.app !== 'heroscape-tracker-theme' || !j.theme) throw 0; t = cleanEdits({ themes: [j.theme] }).themes[0]; } catch (e) { say('That file is not a theme file.'); return; }
      if (EDIT_MODE) {
        // the owner adds it to the site's themes, as a new theme next to the others
        if (EDITS.themes.length >= 20) { edMsg('The site can have up to 20 themes. Delete one first.'); return; }
        t = { ...t, id: uid(), unlock: '' };
        while (EDITS.themes.some((u) => u.name === t.name)) t.name = (t.name + ' (2)').slice(0, 40);
        EDITS.themes.push(t); EDIT_THEME = t.id; saveDraft(); syncSite(); drawSlots(); edMsg('Imported ' + t.name + ' as a new site theme. Save site changes to publish it.');
        return;
      }
      if (USER_THEMES.length >= 20) { say('You can have up to 20 themes. Delete one first.'); return; }
      // always a new theme of the visitor's own: a fresh id and never locked
      t = { ...t, id: uid(), unlock: '', mine: true };
      while (USER_THEMES.some((u) => u.name === t.name)) t.name = (t.name + ' (2)').slice(0, 40);
      USER_THEMES.push(t);
      if (!MAKER) { THEME.site = t.id; const ok = persist(); syncSite(); draw(); say(ok === false ? 'Imported ' + t.name + ', but this browser is out of room to keep it. Download a backup to keep it.' : 'Imported the theme ' + t.name + '.'); return; }
      EDIT_THEME = t.id; saveDraft(); syncSite(); drawSlots(); edMsg('Imported ' + t.name + '.');
    };
    rd.readAsText(f);
  });
  function newMine() {
    if (USER_THEMES.length >= 20) { edMsg('You can have up to 20 themes.'); return; }
    const t = { id: uid(), name: 'My theme ' + (USER_THEMES.length + 1), mode: '', unlock: '', colors: {}, images: {}, pixel: [], stickers: [], mine: true };
    USER_THEMES.push(t); EDIT_THEME = t.id; saveDraft(); syncSite(); drawSlots();
  }
  function startMaker(id) {
    if (EDIT_MODE) return;
    MAKER = true;
    document.body.classList.add('ed-on');
    bar.hidden = false; BAR_SMALL = false;
    // "Make a new theme" always starts a new one, so no theme is ever written over
    EDIT_THEME = id === 'new' ? '' : id && USER_THEMES.some((t) => t.id === id) ? id : (USER_THEMES[0] ? USER_THEMES[0].id : '');
    if (!EDIT_THEME) newMine(); else { syncSite(); drawBar(); drawSlots(); }
    syncDrawSquare();
  }
  function stopMaker() {
    const T = editTheme();
    MAKER = false;
    if (T) THEME.site = T.id; // keep using the theme just made
    document.body.classList.remove('ed-on');
    bar.hidden = true; closePixel(); padForBar();
    EDIT_THEME = '';
    if (DQ.open) closeDraw();
    persist(); syncSite(); drawSlots(); draw(); syncDrawSquare();
  }
  // keep the bottom of the page reachable above the bar
  function padForBar() { document.body.style.paddingBottom = bar.hidden ? '' : (bar.offsetHeight + 24) + 'px'; }
  let edMsgT = null;
  function edMsg(t) { drawBar(); const m = bar.querySelector('.ed-msg'); m.textContent = t; clearTimeout(edMsgT); edMsgT = setTimeout(drawBar, 4000); }
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'application/json,.json'; fileIn.hidden = true; document.body.appendChild(fileIn);
  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const j = JSON.parse(rd.result); if (j.app !== 'heroscape-tracker-edits') throw new Error('not a changes file'); EDITS = cleanEdits(j); saveDraft(); applyEdits(); edMsg('Opened ' + f.name + '.'); } catch (e) { edMsg('That file is not a site changes file.'); }
      fileIn.value = '';
    };
    rd.readAsText(f);
  });
  function saveFile() {
    const data = JSON.stringify({ app: 'heroscape-tracker-edits', format: 1, saved: new Date().toISOString(), ...cleanEdits(EDITS) }, null, 1);
    try {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = ED_FILE; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      PUBLISHED = JSON.parse(JSON.stringify(EDITS)); saveDraft();
      edMsg('Downloaded ' + ED_FILE + '. Put it in the site folder next to index.html, replacing the old one.');
    } catch (e) { edMsg('Your browser blocked the download.'); }
  }

  function startEditing() {
    EDIT_MODE = true;
    try { sessionStorage.setItem(ED_ON, '1'); } catch (e) { /* storage blocked */ }
    document.body.classList.add('ed-on');
    document.body.classList.toggle('ed-text', TEXT_ON);
    bar.hidden = false;
    root.querySelectorAll('[data-eorder="home"], [data-eorder="sections"], .home-links[data-eorder]').forEach((box) => {
      if (box.closest('.side-menu')) return;
      [...box.children].filter((c) => c.dataset.eitem).forEach(addHandle);
    });
    if (location.hash === '#edit') showPage(state.page, true);
    drawBar(); drawSlots(); syncDrawSquare();
  }
  // two taps instead of confirm(), which some embedded pages block
  let ARMED = null;
  function armed(id, b, ask) {
    if (ARMED === id) { ARMED = null; return true; }
    ARMED = id; b.textContent = ask; setTimeout(() => { if (ARMED === id) { ARMED = null; drawBar(); } }, 4000);
    return false;
  }
  function stopEditing(e) {
    if (ED_DIRTY && e && !armed('exit', e.currentTarget, 'Not saved to a file. Tap again to exit')) return;
    EDIT_MODE = false;
    try { sessionStorage.removeItem(ED_ON); } catch (e) { /* storage blocked */ }
    document.body.classList.remove('ed-on', 'ed-text');
    bar.hidden = true; closePop(); padForBar();
    root.querySelectorAll('.ed-handle').forEach((h) => h.remove());
    if (!ED_DIRTY) { EDITS = JSON.parse(JSON.stringify(PUBLISHED)); applyEdits(); }
    drawSlots(); if (DQ.open) closeDraw(); syncDrawSquare();
  }
  window.addEventListener('hashchange', () => { if (location.hash === '#edit' && !EDIT_MODE) startEditing(); });
  // another way in, for places where a link can't carry #edit: tap the site name 5 times within 3 seconds
  let titleTaps = [];
  root.querySelector('#title').addEventListener('click', () => {
    const now = Date.now(); titleTaps = titleTaps.filter((t) => now - t < 3000).concat(now);
    if (titleTaps.length >= 5 && !EDIT_MODE) { titleTaps = []; startEditing(); }
  });

  // ---- retyping text ----
  let POP_KEY = null;
  function closePop() { pop.hidden = true; POP_KEY = null; }
  function openPop(el) {
    const k = el.dataset.ek; POP_KEY = k;
    pop.replaceChildren();
    pop.appendChild(mk('b', '', 'Edit text'));
    const ta = document.createElement('textarea'); ta.rows = Math.min(8, Math.max(2, Math.ceil(el.textContent.length / 40))); ta.value = el.textContent; ta.maxLength = 2000;
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); } if (e.key === 'Escape') closePop(); });
    pop.appendChild(ta);
    const row = mk('div', 'ed-row');
    const done = () => {
      const v = ta.value;
      if (v === ORIG[k]) delete EDITS.text[k]; else EDITS.text[k] = v;
      applyText(); saveDraft(); closePop();
    };
    row.append(btn('Done', 'hs-primary', done), btn('Cancel', '', closePop));
    if (k in EDITS.text) row.appendChild(btn('Use the original', '', () => { delete EDITS.text[k]; applyText(); saveDraft(); closePop(); }));
    pop.appendChild(row);
    if (k in ORIG && ORIG[k] !== el.textContent) pop.appendChild(mk('div', 'hs-note', 'Original: ' + ORIG[k]));
    pop.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(420, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
    const below = r.bottom + 8, h = pop.offsetHeight;
    pop.style.top = (below + h < window.innerHeight - bar.offsetHeight ? below : Math.max(12, r.top - h - 8)) + 'px';
    ta.focus({ preventScroll: true }); ta.select();
  }
  // in edit mode a tap on text edits it instead of doing what it normally does
  document.addEventListener('click', (e) => {
    if (!EDIT_MODE || !TEXT_ON || STK_PICK || e.target.closest('.ed-bar, .ed-pop, .ed-handle, .ed-slot, .stk, .px-wrap')) return;
    // a tap between the lines of a paragraph still edits its text
    const only = e.target.querySelectorAll ? e.target.querySelectorAll(':scope > [data-ek]') : [];
    const el = e.target.closest('[data-ek]') || (only.length === 1 ? only[0] : null);
    if (!el) { if (!pop.hidden && !e.target.closest('.ed-pop')) closePop(); return; }
    e.preventDefault(); e.stopPropagation();
    openPop(el);
  }, true);

  // ---- dragging blocks into a new order ----
  function addHandle(item) {
    if (item.querySelector(':scope > .ed-handle')) return;
    const h = mk('button', 'ed-handle', '⠿ Drag'); h.type = 'button';
    h.setAttribute('aria-label', 'Move this block. Drag it, or use the arrow keys.');
    item.prepend(h);
    h.addEventListener('pointerdown', (e) => startDrag(e, item));
    h.addEventListener('keydown', (e) => {
      const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!d) return;
      e.preventDefault();
      const sibs = [...item.parentElement.children].filter((c) => c.dataset.eitem), i = sibs.indexOf(item), j = i + d;
      if (j < 0 || j >= sibs.length) return;
      if (d < 0) item.parentElement.insertBefore(item, sibs[j]); else sibs[j].after(item);
      saveOrder(item.parentElement); h.focus();
    });
  }
  function startDrag(e, item) {
    e.preventDefault();
    const box = item.parentElement, h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    item.classList.add('ed-dragging');
    let lastY = e.clientY, lastX = e.clientX, scrolling = true;
    // scroll the page when dragging near the top or bottom edge, so blocks can move past the screen
    const edge = () => {
      if (!scrolling) return;
      const bottom = window.innerHeight - (bar.hidden ? 0 : bar.offsetHeight);
      const d = lastY > bottom - 60 ? 12 : lastY < 60 ? -12 : 0;
      if (d) { window.scrollBy(0, d); reorderAt(lastX, lastY); }
      requestAnimationFrame(edge);
    };
    requestAnimationFrame(edge);
    const reorderAt = (x, y) => {
      const under = document.elementFromPoint(x, y);
      let t = under; while (t && t.parentElement !== box) t = t.parentElement; // the block in this list under the pointer
      if (!t || t === item || !t.dataset.eitem) return;
      const sibs = [...box.children];
      if (sibs.indexOf(t) > sibs.indexOf(item)) t.after(item); else box.insertBefore(item, t);
    };
    const move = (ev) => { lastX = ev.clientX; lastY = ev.clientY; reorderAt(lastX, lastY); };
    const up = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      scrolling = false;
      item.classList.remove('ed-dragging');
      saveOrder(box);
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }
  function saveOrder(box) {
    const key = box.dataset.eorder;
    EDITS.order[key] = [...box.children].filter((c) => c.dataset.eitem).map((c) => c.dataset.eitem);
    const def = [...box.children].filter((c) => c.dataset.eitem).sort((a, b) => a.dataset.ehome - b.dataset.ehome).map((c) => c.dataset.eitem);
    if (sameEdits(EDITS.order[key], def)) delete EDITS.order[key];
    applyOrder(); saveDraft();
  }

  // ---- images ----
  function setImage(slot, src, pixel) {
    const T = tgt();
    T.images[slot] = src;
    T.pixel = T.pixel.filter((k) => k !== slot); if (pixel) T.pixel.push(slot);
    applyImages(); saveDraft(); drawSlots();
  }
  function clearImage(slot) { const T = tgt(); delete T.images[slot]; T.pixel = T.pixel.filter((k) => k !== slot && !(slot === 'background' && k === 'bgfill')); applyImages(); saveDraft(); drawSlots(); }
  const slotNames = () => [['logo', 'Logo spot (header)'], ...[...root.querySelectorAll('.hs-page')].map((sec) => { const n = root.querySelector(`[data-ek="page:${sec.id}"]`); return ['banner:' + sec.id, 'Banner on ' + (sec.id === 'home' ? 'Home' : n ? n.textContent : sec.id)]; }), ['background', 'Site background (tiled)']];
  function readImage(file, slot) {
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) { edMsg('That file is not a picture.'); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      // a visitor's pictures live in their browser storage, which is small, so they are shrunk more
      const max = MAKER ? (slot === 'logo' ? 300 : 900) : slot === 'logo' ? 400 : 1600, k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((img.naturalWidth || max) * k)); c.height = Math.max(1, Math.round((img.naturalHeight || max) * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const keepAlpha = /png|gif|webp|svg/.test(file.type);
      let data = c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85);
      if (MAKER && data.length > 600000) data = c.toDataURL('image/jpeg', 0.8);
      if (data.length > (MAKER ? 600000 : 2900000)) { edMsg('That picture is too big even after shrinking. Try a smaller one.'); return; }
      if (slot === 'free') addSticker(data, false, c.width, c.height); else setImage(slot, data, false);
      drawBar();
    };
    img.onerror = () => { URL.revokeObjectURL(url); edMsg('That picture could not be read.'); };
    img.src = url;
  }
  // a file you copied into the site's assets folder yourself, by name
  function assetField(slot) {
    const w = mk('span', 'ed-asset');
    const i = document.createElement('input'); i.type = 'text'; i.placeholder = 'or assets/file-name.png'; i.setAttribute('aria-label', 'Picture file in the assets folder');
    const cur = tgt().images[slot]; if (cur && ASSET_RE.test(cur)) i.value = cur;
    const use = () => {
      const v = i.value.trim().replace(/^\.?\//, '');
      const full = /^assets\//i.test(v) ? v : 'assets/' + v;
      if (!ASSET_RE.test(full)) { edMsg('Use a file name like assets/my-banner.png (png, jpg, gif, webp or svg).'); return; }
      setImage(slot, full, /pixel|px/i.test(full));
      edMsg('Using ' + full + '. That file has to be in the assets folder next to index.html.');
    };
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') use(); });
    w.append(i, btn('Use file', 'hs-sm', use));
    return w;
  }
  function drawSlots() {
    root.querySelectorAll('.ed-slot').forEach((s) => {
      s.querySelectorAll('.ed-slotui').forEach((x) => x.remove());
      if (!edActive()) return;
      const ui = mk('div', 'ed-slotui');
      const has = !!tgt().images[s.dataset.slot];
      const pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true;
      pick.addEventListener('change', () => { if (pick.files[0]) readImage(pick.files[0], s.dataset.slot); });
      const std = !has && editTheme() && (EDITS.images[s.dataset.slot] || (MAKER && SITE_THEMES.some((t) => !t.mine && t.images[s.dataset.slot])));
      ui.append(pick, mk('span', 'hs-note', std ? 'Showing the standard picture. Add one for this theme:' : has ? '' : (s.dataset.slot === 'logo' ? 'Logo spot' : 'Image spot') + ': drop a picture here or'),
        btn(has ? 'Replace picture' : 'Choose a picture', 'hs-sm', () => pick.click()));
      if (has) ui.appendChild(btn('Remove picture', 'hs-sm', () => clearImage(s.dataset.slot)));
      if (!MAKER) ui.appendChild(assetField(s.dataset.slot));
      s.appendChild(ui);
    });
  }
  root.addEventListener('dragover', (e) => { const s = edActive() && e.target.closest('.ed-slot'); if (s) { e.preventDefault(); s.classList.add('over'); } });
  root.addEventListener('dragleave', (e) => { const s = e.target.closest('.ed-slot'); if (s) s.classList.remove('over'); });
  root.addEventListener('drop', (e) => {
    const s = edActive() && e.target.closest('.ed-slot'); if (!s) return;
    e.preventDefault(); s.classList.remove('over');
    const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readImage(f, s.dataset.slot);
  });

  // ---- free art: pictures placed anywhere, on a layer behind or in front of the content ----
  // Each one sticks to a part of the page (the site header, the whole page, or one block on it), so it scrolls with
  // that part, or to the screen, where it stays put. Back-layer art sits behind that part's content.
  let STK_SEL = '', STK_MOVE = false, STK_PICK = false, STK_SIG = '';
  const stkLayers = {};
  for (const l of ['back', 'front']) { const d = mk('div', 'stk-screen ' + l); d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); stkLayers[l] = d; }
  // a unit's own page (its card pop-up) keeps its own drawings, under the page name "unit:<name>"
  const unitPage = () => (dlg.open && DLG_UNIT ? 'unit:' + DLG_UNIT.unit : '');
  const drawPage = () => unitPage() || state.page;
  const isUnitPage = (p) => typeof p === 'string' && p.startsWith('unit:');
  function effStickers() {
    const t = siteTheme(), up = unitPage();
    return [...EDITS.stickers.filter((k) => !k.gone).map((k) => [k, EDITS]), ...(t ? (t.stickers || []).map((k) => [k, t]) : []).filter(([k]) => !k.gone), ...DOODLES.map((k) => [k, DOODLES])].filter(([k]) => !k.gone && (!k.page || k.page === state.page || (up && k.page === up)));
  }
  function stkHost(k) {
    if (k.at === 'screen') return stkLayers[k.layer];
    if (isUnitPage(k.page)) return dlg.querySelector('.hs-dlg-in');
    if (k.at === 'header') return root.querySelector('.site-head');
    const sec = root.querySelector('section.hs-page#' + (k.page || state.page)) || root.querySelector('section.hs-page#' + state.page);
    if (k.at === 'block' && sec) { const b = sec.querySelectorAll('.hs-card')[k.block]; if (b) return b; }
    return sec;
  }
  function applyStickers() {
    const list = effStickers(), owner = tgt();
    const sig = JSON.stringify([state.page, unitPage(), STK_SEL, STK_MOVE, edActive(), list.map(([k, o]) => [k.id, k.src.length, k.at, k.block, k.x, k.y, k.w, k.u, k.layer, k.px, o === owner])]);
    const placed = document.querySelectorAll('img.stk');
    if (sig === STK_SIG && [...placed].every((i) => i.isConnected && i.parentElement)) return;
    STK_SIG = sig;
    placed.forEach((i) => i.remove());
    document.querySelectorAll('.stk-host').forEach((h) => { if (!h.querySelector('img.stk')) h.classList.remove('stk-host'); });
    for (const [k, o] of list) {
      const host = stkHost(k); if (!host) continue;
      if (k.at !== 'screen') host.classList.add('stk-host');
      const im = document.createElement('img'); im.className = 'stk ' + k.layer + (k.px ? ' px' : ''); im.alt = ''; im.src = k.src; im.dataset.stk = k.id;
      if (k.u === 'px') { im.style.left = `calc(50% + ${k.x}px)`; im.style.top = k.y + 'px'; im.style.width = k.w + 'px'; }
      else { im.style.left = k.x + '%'; im.style.top = k.y + '%'; im.style.width = k.w + '%'; }
      if (o === DOODLES) im.classList.add('doodle');
      if (edActive() && o === owner) { im.classList.add('mine'); if (k.id === STK_SEL) im.classList.add('sel'); if (STK_MOVE) im.classList.add('moving'); }
      host.appendChild(im);
    }
  }
  const stkOf = (id) => (tgt().stickers || []).find((k) => k.id === id);
  function addSticker(src, px, w, h, place) {
    const T = tgt(); if (!T.stickers) T.stickers = [];
    if (T.stickers.length >= 40) { edMsg('There can be up to 40 pieces of free art.'); return; }
    // start in the middle of what is on screen now, about a quarter of the page wide (small art stays small)
    const sec = root.querySelector('section.hs-page#' + state.page), r = sec.getBoundingClientRect();
    const midY = Math.min(95, Math.max(5, ((window.innerHeight / 2 - r.top) / Math.max(1, r.height)) * 100));
    const wPct = Math.min(40, Math.max(5, ((w || 200) / Math.max(1, r.width)) * 100));
    const k = { id: uid(), src, page: state.page, at: 'page', block: 0, x: 50, y: Math.round(midY), w: Math.round(wPct), layer: 'front', px: !!px };
    if (place) placeAt(k, place);
    T.stickers.push(k); STK_SEL = k.id; STK_MOVE = !place;
    saveDraft(); applyStickers();
    return k.id;
  }
  function placeAt(k, place) {
    const r1 = (v) => Math.round(v * 10) / 10;
    if (place.u === 'px') { k.u = 'px'; k.at = 'page'; k.x = r1(place.x); k.y = r1(place.y); k.w = Math.max(0.5, r1(place.w)); }
    else { delete k.u; k.x = r1(place.x); k.y = r1(place.y); k.w = Math.max(1, Math.min(100, r1(place.w))); }
    if (place.page) k.page = place.page;
    if (place.layer) k.layer = place.layer;
  }
  // a visitor's own drawings from the drawing square: on top of whatever theme they use, saved only for them
  let DOODLES = [];
  registerSaved({
    key: 'doodles', label: 'your drawings',
    get: () => DOODLES.filter((k) => !k.gone),
    clean: (o) => cleanEdits({ stickers: o }).stickers,
    apply: (v, merge) => { DOODLES = merge ? DOODLES.concat((v || []).filter((k) => !DOODLES.some((d) => d.id === k.id))) : (v || []).slice(); STK_SIG = ''; }
  });
  function addDoodle(src, place) {
    if (DOODLES.length >= 60) DOODLES.shift(); // the oldest goes, so drawing never just stops working
    const k = { id: uid(), src, page: drawPage(), at: 'page', block: 0, x: 50, y: 50, w: 30, layer: 'front', px: false };
    placeAt(k, place);
    DOODLES.push(k);
    let ok = persist();
    while (ok === false && DOODLES.length > 1) { DOODLES.shift(); ok = persist(); } // browser storage is full: drop the oldest
    applyStickers();
    return k.id;
  }
  // drawings and free art by id, wherever they are kept. A drawing erased away completely is only hidden
  // (gone), so Undo can bring it back; hidden ones are dropped the next time the page loads.
  const drawnStores = () => [DOODLES, ...[EDITS, ...EDITS.themes, ...USER_THEMES].map((T) => T.stickers || [])];
  const findDrawn = (id) => { for (const L of drawnStores()) { const k = L.find((x) => x.id === id); if (k) return k; } return null; };
  function changedDrawn() { STK_SIG = ''; if (edActive()) saveDraft(); else persist(); applyStickers(); }
  function removeDrawn(id, keep) {
    if (keep) { const k = findDrawn(id); if (k) k.gone = true; changedDrawn(); return; }
    DOODLES = DOODLES.filter((k) => k.id !== id);
    for (const T of [EDITS, ...EDITS.themes, ...USER_THEMES]) if (T.stickers && T.stickers.some((k) => k.id === id)) T.stickers = T.stickers.filter((k) => k.id !== id);
    changedDrawn(); if (edActive()) drawBar();
  }
  function setDrawnSrc(id, src) { const k = findDrawn(id); if (!k) return; k.src = src; delete k.gone; changedDrawn(); }
  function clearDoodles(page) { DOODLES = DOODLES.filter((k) => k.page !== page); persist(); applyStickers(); }
  // the visitor's choice to show the drawing square (Settings; shown unless they turned it off; "set" marks a
  // choice they made, so saves from before it was on by default show it too)
  // and where they dragged it: which side of the screen, and how far down (% of the screen height)
  const DRAWSQ = { on: true, set: false, side: 'right', y: 50, layer: 'front' };
  registerSaved({
    key: 'drawsq', label: 'drawing square setting',
    get: () => ({ ...DRAWSQ }),
    clean: (o) => ({ on: o && o.set ? !!o.on : true, set: !!(o && o.set), side: o && o.side === 'left' ? 'left' : 'right', y: Math.min(95, Math.max(5, Number(o && o.y) || 50)), layer: o && o.layer === 'back' ? 'back' : 'front' }),
    apply: (v) => { Object.assign(DRAWSQ, { on: true, set: false, side: 'right', y: 50, layer: 'front' }, v || {}); if (typeof syncDrawSquare === 'function') syncDrawSquare(); }
  });
  function stickerRow() {
    const row = mk('div', 'ed-row ed-stk');
    const T = tgt(), mine = (T.stickers || []).filter((k) => !k.page || k.page === state.page);
    row.appendChild(mk('span', 'hs-note', 'Free art:'));
    const pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true;
    pick.addEventListener('change', () => { if (pick.files[0]) readImage(pick.files[0], 'free'); });
    row.append(pick, btn('Add a picture', 'hs-sm', () => pick.click()));
    if (!mine.length) { row.appendChild(mk('span', 'hs-note', 'none on this page yet; make some with the Art maker or add a picture')); return row; }
    if (!mine.some((k) => k.id === STK_SEL)) STK_SEL = mine[mine.length - 1].id;
    const k = stkOf(STK_SEL);
    stkToPct(k);
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Free art you are changing');
    mine.forEach((x, i) => sel.append(new Option('Art ' + (i + 1) + (x.page ? '' : ' (every page)'), x.id)));
    sel.value = STK_SEL; sel.addEventListener('change', () => { STK_SEL = sel.value; drawBar(); applyStickers(); });
    const mv = mk('label', 'hs-chk'); const mc = document.createElement('input'); mc.type = 'checkbox'; mc.checked = STK_MOVE;
    mc.addEventListener('change', () => { STK_MOVE = mc.checked; applyStickers(); }); mv.append(mc, document.createTextNode(' Drag to move'));
    const choose = (label, opts, val, set) => { const s = document.createElement('select'); s.setAttribute('aria-label', label); for (const [v, t] of opts) s.append(new Option(t, v)); s.value = val; s.addEventListener('change', () => set(s.value)); return s; };
    const change = () => { saveDraft(); applyStickers(); };
    const layer = choose('Layer', [['front', 'In front of the content'], ['back', 'Behind the content']], k.layer, (v) => { k.layer = v; change(); });
    const at = choose('Sticks to', [['page', 'Sticks to this page'], ['block', 'Sticks to a block'], ['header', 'Sticks to the site header'], ['screen', 'Stays put on the screen']], k.at, (v) => {
      k.at = v; k.x = 50; k.y = v === 'screen' ? 50 : v === 'header' ? 50 : k.y;
      if (v === 'block') { STK_PICK = true; edMsg('Now tap the block it should stick to.'); }
      if (v === 'header' || v === 'screen') k.page = k.page; // where it shows is set separately
      change(); drawBar();
    });
    const where = choose('Shows on', [['this', 'Only on this page'], ['all', 'On every page']], k.page ? 'this' : 'all', (v) => { k.page = v === 'all' ? '' : state.page; if (!k.page && k.at === 'block') k.at = 'page'; change(); drawBar(); });
    const size = mk('label', 'pt-range'); const si = document.createElement('input'); si.type = 'range'; si.min = 1; si.max = 100; si.value = k.w; si.setAttribute('aria-label', 'Size');
    si.addEventListener('input', () => { k.w = +si.value; applyStickers(); }); si.addEventListener('change', change);
    size.append(document.createTextNode('Size '), si);
    row.append(sel, mv, layer, at);
    if (k.at === 'block') row.appendChild(btn('Pick the block', 'hs-sm', () => { STK_PICK = true; edMsg('Tap the block it should stick to.'); }));
    row.append(where, size, btn('Delete art', 'hs-sm', (e) => { if (!armed('delstk', e.currentTarget, 'Tap again to delete')) return; T.stickers = T.stickers.filter((x) => x !== k); STK_SEL = ''; saveDraft(); applyStickers(); drawBar(); }));
    return row;
  }
  // a drawing placed in pixels becomes ordinary free art (percent of its page) once its settings are changed
  function stkToPct(k) {
    if (!k || k.u !== 'px') return;
    const sec = root.querySelector('section.hs-page#' + (k.page || state.page));
    const r = sec && sec.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    const r1 = (v) => Math.round(v * 1000) / 1000;
    k.x = r1(50 + (k.x / r.width) * 100); k.y = r1((k.y / r.height) * 100); k.w = r1(Math.max(0.1, (k.w / r.width) * 100));
    delete k.u;
  }
  // moving art by dragging it, and picking the block it sticks to
  document.addEventListener('pointerdown', (e) => {
    if (!edActive()) return;
    const im = e.target.closest && e.target.closest('img.stk.mine');
    if (!im || !STK_MOVE) return;
    const k = stkOf(im.dataset.stk); if (!k) return;
    stkToPct(k);
    e.preventDefault(); e.stopPropagation();
    if (STK_SEL !== k.id) { STK_SEL = k.id; drawBar(); }
    im.setPointerCapture(e.pointerId);
    const host = im.parentElement;
    const move = (ev) => {
      const r = k.at === 'screen' ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : host.getBoundingClientRect();
      k.x = Math.round(Math.min(120, Math.max(-20, ((ev.clientX - r.left) / r.width) * 100)) * 10) / 10;
      k.y = Math.round(Math.min(120, Math.max(-20, ((ev.clientY - r.top) / r.height) * 100)) * 10) / 10;
      im.style.left = k.x + '%'; im.style.top = k.y + '%';
    };
    const up = () => { im.removeEventListener('pointermove', move); im.removeEventListener('pointerup', up); im.removeEventListener('pointercancel', up); saveDraft(); applyStickers(); };
    im.addEventListener('pointermove', move); im.addEventListener('pointerup', up); im.addEventListener('pointercancel', up);
  }, true);
  document.addEventListener('click', (e) => {
    if (!STK_PICK || !edActive() || e.target.closest('.ed-bar, .px-wrap')) return;
    const card = e.target.closest('section.hs-page .hs-card'); if (!card) return;
    e.preventDefault(); e.stopPropagation();
    STK_PICK = false;
    const k = stkOf(STK_SEL); if (!k) return;
    const sec = card.closest('section.hs-page');
    k.at = 'block'; k.page = sec.id; k.block = [...sec.querySelectorAll('.hs-card')].indexOf(card); k.x = 50; k.y = 50;
    saveDraft(); applyStickers(); edMsg('Stuck to that block.');
  }, true);

  // keep text, order and images applied when pages redraw
  function drawEdits() { applyStickers(); if (edActive()) { const sel = bar.querySelector('select'); if (sel) sel.value = state.page; } applyText(); }
  root.querySelector('.st-themein').addEventListener('click', () => themeIn.click());
  root.querySelector('.st-mine').addEventListener('click', () => { const t = siteTheme(); startMaker(t && t.mine ? t.id : ''); });
  root.querySelector('.st-newmine').addEventListener('click', () => startMaker('new'));
  root.querySelector('.st-dq input').addEventListener('change', (e) => { DRAWSQ.on = e.target.checked; DRAWSQ.set = true; if (!DRAWSQ.on && DQ.open && !edActive()) closeDraw(); persist(); syncDrawSquare(); });

  // ---------- art maker: pixel art (edit mode and the theme maker) ----------
  // Draw on a small grid (or paint, see paint.js), then place the drawing in any image spot or as the site background, or download it.
  // The drawing in progress is kept in this browser so it survives a reload.
  const PX_DRAFT = 'heroscape-tracker:pixel-draft';
  const PX_PALETTE = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
  const PX_MODE = 'heroscape-tracker:art-mode';
  const PX = { n: 32, px: [], color: '#6b3fa0', tool: 'pen', grid: true, undo: [], redo: [], recent: [], mode: lsGet(PX_MODE) === 'paint' ? 'paint' : 'pixel', dest: 'free' };
  function pxBlank(n) { return new Array(n * n).fill(''); }
  function pxLoadDraft() {
    try {
      const d = JSON.parse(lsGet(PX_DRAFT) || 'null');
      if (d && [16, 24, 32, 48, 64].includes(d.n) && Array.isArray(d.px) && d.px.length === d.n * d.n) {
        PX.n = d.n; PX.px = d.px.map((c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '')); return;
      }
    } catch (e) { /* bad draft */ }
    PX.px = pxBlank(PX.n);
  }
  const pxSave = () => lsSet(PX_DRAFT, JSON.stringify({ n: PX.n, px: PX.px }));
  pxLoadDraft();

  const pxWrap = mk('div', 'px-wrap'); pxWrap.hidden = true; pxWrap.setAttribute('role', 'dialog'); pxWrap.setAttribute('aria-label', 'Pixel art');
  document.body.appendChild(pxWrap);
  let pxCanvas = null, pxCtx = null;

  function openPixel() { pxWrap.hidden = false; drawPixelUI(); }
  function closePixel() { pxWrap.hidden = true; }

  function drawPixelUI() {
    pxWrap.replaceChildren();
    const box = mk('div', 'px-box');
    const head = mk('div', 'ed-row');
    // two ways to draw: the pixel grid, or ordinary paint brushes (paint.js)
    const mode = mk('div', 'hs-seg'); mode.setAttribute('role', 'group'); mode.setAttribute('aria-label', 'Kind of art');
    for (const [id, t] of [['pixel', 'Pixel art'], ['paint', 'Paint']]) {
      const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(PX.mode === id));
      b.addEventListener('click', () => { PX.mode = id; lsSet(PX_MODE, id); drawPixelUI(); }); mode.appendChild(b);
    }
    head.append(mk('b', 'px-title', 'Art maker'), mode, btn('Close', 'hs-sm', closePixel));
    box.appendChild(head);
    const paint = PX.mode === 'paint';
    if (paint) drawPaintUI(box);
    else {
      // tools
      const tools = mk('div', 'ed-row');
      const seg = mk('div', 'hs-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Tool');
      for (const [id, t] of [['pen', 'Pen'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick color']]) {
        const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(PX.tool === id));
        b.addEventListener('click', () => { PX.tool = id; drawPixelUI(); }); seg.appendChild(b);
      }
      tools.appendChild(seg);
      const sz = document.createElement('select'); sz.setAttribute('aria-label', 'Grid size');
      for (const n of [16, 24, 32, 48, 64]) sz.append(new Option(n + ' × ' + n, String(n)));
      sz.value = String(PX.n);
      sz.addEventListener('change', () => { pxPush(); PX.n = +sz.value; PX.px = pxResize(PX.px, PX.undo[PX.undo.length - 1].n, PX.n); pxSave(); drawPixelUI(); });
      tools.appendChild(sz);
      const gl = mk('label', 'hs-chk'); const gc = document.createElement('input'); gc.type = 'checkbox'; gc.checked = PX.grid;
      gc.addEventListener('change', () => { PX.grid = gc.checked; pxPaint(); }); gl.append(gc, document.createTextNode(' Grid'));
      tools.appendChild(gl);
      tools.append(btn('Undo', 'hs-sm', pxUndo), btn('Redo', 'hs-sm', pxRedo), btn('Clear', 'hs-sm', () => { pxPush(); PX.px = pxBlank(PX.n); pxSave(); pxPaint(); }));
      tools.appendChild(artResizeRow(pxScaleArt));
      box.appendChild(tools);
      box.appendChild(pxColorRow());
      // canvas
      const stage = mk('div', 'px-stage');
      pxCanvas = document.createElement('canvas'); pxCanvas.className = 'px-canvas'; pxCanvas.setAttribute('aria-label', 'Drawing grid');
      const side = Math.min(512, window.innerWidth - 48, window.innerHeight - 300);
      const cell = Math.max(4, Math.floor(Math.max(160, side) / PX.n));
      pxCanvas.width = pxCanvas.height = cell * PX.n;
      pxCtx = pxCanvas.getContext('2d');
      stage.appendChild(pxCanvas); box.appendChild(stage);
      pxBind(cell);
      pxPaint();
    }
    // using it: in a picture spot, as free art placed anywhere, or as a download
    const out = mk('div', 'ed-row');
    const tgt = document.createElement('select'); tgt.setAttribute('aria-label', 'Where to put it');
    tgt.append(new Option('Free art (place it anywhere)', 'free'));
    for (const [k, t] of slotNames()) tgt.append(new Option(t, k));
    tgt.value = PX.dest && [...tgt.options].some((o) => o.value === PX.dest) ? PX.dest : 'free';
    tgt.addEventListener('change', () => { PX.dest = tgt.value; });
    const scale = document.createElement('select'); scale.setAttribute('aria-label', 'Pixel size');
    for (const n of [1, 2, 4, 8, 16]) scale.append(new Option(n === 1 ? 'Actual size' : n + '× bigger', String(n)));
    scale.value = '8';
    const place = () => {
      const free = tgt.value === 'free', limit = MAKER ? 600000 : 2900000;
      const c = paint ? ptCanvas(free) : pxRender(+scale.value);
      if (!c) { edMsg('Draw something first.'); return; }
      const data = paint ? artData(c, limit) : c.toDataURL('image/png');
      if (!data || data.length > limit) { edMsg('That picture is too big to keep. Try a smaller canvas.'); return; }
      if (free) addSticker(data, !paint, c.width, c.height); else setImage(tgt.value, data, !paint);
      drawBar(); edMsg(free ? 'Placed. Drag it where you want it, and pick its layer below.' : MAKER ? 'Placed in your theme.' : 'Placed. Save site changes to keep it.'); closePixel();
    };
    out.append(tgt);
    if (!paint) out.appendChild(scale);
    out.append(btn(MAKER ? 'Put it in my theme' : 'Put it on the site', 'hs-primary', place),
      btn('Download PNG', '', () => (paint ? artDownload(ptCanvas(false), 'painting.png') : pxDownload(+scale.value))), btn('Open a picture', '', () => pxOpen.click()));
    box.appendChild(out);
    box.appendChild(mk('div', 'hs-note', paint ? 'Opening a picture puts it on the canvas so you can paint over it.' : 'Opening a picture shrinks it to the grid so you can touch it up.'));
    pxWrap.appendChild(box);
  }
  // the color picker, recent colors and palette, shared by both kinds of art
  function pxColorRow(redraw = drawPixelUI) {
    const cols = mk('div', 'ed-row px-cols');
    const ci = document.createElement('input'); ci.type = 'color'; ci.value = PX.color; ci.setAttribute('aria-label', 'Color');
    ci.addEventListener('input', () => { PX.color = ci.value; });
    ci.addEventListener('change', () => { pxRecent(ci.value); redraw(); });
    cols.appendChild(ci);
    for (const c of [...PX.recent, ...PX_PALETTE.filter((x) => !PX.recent.includes(x))]) {
      const b = mk('button', 'px-sw' + (c === PX.color ? ' on' : '')); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Color ' + c);
      b.addEventListener('click', () => {
        PX.color = c;
        if (PX.tool === 'eraser' || PX.tool === 'pick') PX.tool = 'pen';
        if (PT.tool === 'eraser' || PT.tool === 'pick') PT.tool = 'brush';
        redraw();
      });
      cols.appendChild(b);
    }
    return cols;
  }
  const pxRecent = (c) => { PX.recent = [c, ...PX.recent.filter((x) => x !== c)].slice(0, 8); };
  function pxPush() { PX.undo.push({ n: PX.n, px: PX.px.slice() }); if (PX.undo.length > 100) PX.undo.shift(); PX.redo = []; }
  function pxUndo() { const s = PX.undo.pop(); if (!s) return; PX.redo.push({ n: PX.n, px: PX.px.slice() }); const resized = s.n !== PX.n; PX.n = s.n; PX.px = s.px; pxSave(); if (resized) drawPixelUI(); else pxPaint(); }
  function pxRedo() { const s = PX.redo.pop(); if (!s) return; PX.undo.push({ n: PX.n, px: PX.px.slice() }); const resized = s.n !== PX.n; PX.n = s.n; PX.px = s.px; pxSave(); if (resized) drawPixelUI(); else pxPaint(); }
  // "Resize art": a percent picker and button, shared by both kinds of art
  function artResizeRow(apply) {
    const w = mk('span', 'px-resize');
    const s = document.createElement('select'); s.setAttribute('aria-label', 'Resize the art by');
    for (const p of [25, 50, 75, 90, 110, 125, 150, 200, 300]) s.append(new Option(p + '%', String(p)));
    s.value = '50';
    w.append(s, btn('Resize art', 'hs-sm', () => apply(+s.value / 100)));
    return w;
  }
  // scales the drawing itself (not the grid) around its middle; anything pushed past the edge is cut off
  function pxScaleArt(k) {
    const n = PX.n;
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (PX.px[y * n + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) { edMsg('Draw something first.'); return; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
    const ox = Math.round(x0 + w / 2 - nw / 2), oy = Math.round(y0 + h / 2 - nh / 2);
    pxPush();
    const out = pxBlank(n);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const tx = ox + x, ty = oy + y;
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
      out[ty * n + tx] = PX.px[(y0 + Math.floor(y * h / nh)) * n + x0 + Math.floor(x * w / nw)] || '';
    }
    PX.px = out; pxSave(); pxPaint();
  }
  function pxResize(px, from, to) {
    const out = pxBlank(to);
    for (let y = 0; y < to; y++) for (let x = 0; x < to; x++) { const sx = Math.floor(x * from / to), sy = Math.floor(y * from / to); out[y * to + x] = px[sy * from + sx] || ''; }
    return out;
  }
  function pxPaint() {
    if (!pxCtx) return;
    const n = PX.n, c = pxCanvas.width / n, g = pxCtx;
    g.clearRect(0, 0, pxCanvas.width, pxCanvas.height);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = PX.px[y * n + x];
      g.fillStyle = v || ((x + y) % 2 ? '#e6e6e6' : '#f7f7f7'); // checkerboard shows see-through pixels
      g.fillRect(x * c, y * c, c, c);
    }
    if (PX.grid && c >= 6) {
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < n; i++) { g.moveTo(i * c + .5, 0); g.lineTo(i * c + .5, n * c); g.moveTo(0, i * c + .5); g.lineTo(n * c, i * c + .5); }
      g.stroke();
    }
  }
  function pxBind(cell) {
    let down = false, last = null;
    const at = (e) => { const r = pxCanvas.getBoundingClientRect(); const k = pxCanvas.width / r.width; return [Math.floor((e.clientX - r.left) * k / cell), Math.floor((e.clientY - r.top) * k / cell)]; };
    const set = (x, y) => { if (x < 0 || y < 0 || x >= PX.n || y >= PX.n) return; PX.px[y * PX.n + x] = PX.tool === 'eraser' ? '' : PX.color; };
    const line = (a, b) => { // every cell between two pointer positions, so fast strokes have no gaps
      let [x0, y0] = a; const [x1, y1] = b, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (;;) { set(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    pxCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); const [x, y] = at(e);
      if (x < 0 || y < 0 || x >= PX.n || y >= PX.n) return;
      if (PX.tool === 'pick') { const v = PX.px[y * PX.n + x]; if (v) { PX.color = v; pxRecent(v); } PX.tool = 'pen'; drawPixelUI(); return; }
      pxPush();
      if (PX.tool === 'fill') { pxFill(x, y); pxSave(); pxPaint(); return; }
      down = true; last = [x, y]; pxCanvas.setPointerCapture(e.pointerId); set(x, y); pxPaint();
      if (PX.tool === 'pen') pxRecent(PX.color);
    });
    pxCanvas.addEventListener('pointermove', (e) => { if (!down) return; const p = at(e); line(last, p); last = p; pxPaint(); });
    const end = () => { if (down) { down = false; pxSave(); } };
    pxCanvas.addEventListener('pointerup', end); pxCanvas.addEventListener('pointercancel', end);
  }
  function pxFill(x, y) {
    const n = PX.n, from = PX.px[y * n + x], to = PX.color;
    if (from === to) return;
    const st = [[x, y]];
    while (st.length) {
      const [cx, cy] = st.pop();
      if (cx < 0 || cy < 0 || cx >= n || cy >= n || PX.px[cy * n + cx] !== from) continue;
      PX.px[cy * n + cx] = to;
      st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function pxRender(scale) {
    const n = PX.n, c = document.createElement('canvas'); c.width = c.height = n * scale;
    const g = c.getContext('2d');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = PX.px[y * n + x]; if (v) { g.fillStyle = v; g.fillRect(x * scale, y * scale, scale, scale); } }
    return c;
  }
  const pxImage = (scale) => pxRender(scale).toDataURL('image/png');
  const pxDownload = (scale) => artDownload(pxRender(scale), 'pixel-art.png');
  function artDownload(c, name) {
    c.toBlob((b) => {
      try { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) { edMsg('Your browser blocked the download.'); }
    }, 'image/png');
  }
  const pxOpen = document.createElement('input'); pxOpen.type = 'file'; pxOpen.accept = 'image/*'; pxOpen.hidden = true; document.body.appendChild(pxOpen);
  pxOpen.addEventListener('change', () => {
    const f = pxOpen.files && pxOpen.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      if (PX.mode === 'paint') { ptOpenImage(img); URL.revokeObjectURL(url); pxOpen.value = ''; return; }
      const n = PX.n, c = document.createElement('canvas'); c.width = c.height = n;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const k = Math.min(n / img.naturalWidth, n / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      g.drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
      const d = g.getImageData(0, 0, n, n).data;
      pxPush();
      PX.px = pxBlank(n).map((_, i) => (d[i * 4 + 3] < 128 ? '' : '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')));
      URL.revokeObjectURL(url); pxOpen.value = ''; pxSave(); pxPaint();
    };
    img.onerror = () => { URL.revokeObjectURL(url); pxOpen.value = ''; };
    img.src = url;
  });
  document.addEventListener('keydown', (e) => {
    if (pxWrap.hidden) return;
    if (e.key === 'Escape') closePixel();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); const p = PX.mode === 'paint'; if (e.shiftKey) { if (p) ptRedo(ART); else pxRedo(); } else if (p) ptUndo(ART); else pxUndo(); }
  });

  // ---------- paint mode for the art maker, and drawing right on the page ----------
  // Ordinary brushes and tools on a full-color canvas (the pixel grid is the other mode, in pixel.js).
  // A "surface" is one painting: the art, the stroke being drawn, the canvas on screen and its undo steps.
  // The art maker's painting is kept in this browser so it survives a reload; a drawing on the page is not.
  const PT_DRAFT = 'heroscape-tracker:paint-draft';
  const PT_SIZES = [['512x512', 'Square 512'], ['1024x384', 'Wide 1024 × 384'], ['384x768', 'Tall 384 × 768'], ['256x256', 'Small 256']];
  const PT_TOOLS = [['brush', 'Brush'], ['pixel', 'Pixel pen'], ['pencil', 'Pencil'], ['marker', 'Marker'], ['spray', 'Spray'], ['eraser', 'Eraser'], ['line', 'Line'], ['rect', 'Box'], ['ellipse', 'Oval'], ['fill', 'Fill'], ['text', 'Text'], ['pick', 'Pick color']];
  const PT = { tool: 'brush', size: 12, alpha: 100, soft: false, filled: false, text: '', cell: 8, loaded: false };
  function surface(w, h, scale) {
    const S = { w, h, scale: scale || 1, art: document.createElement('canvas'), stroke: document.createElement('canvas'), view: null, undo: [], redo: [], save: () => {}, redraw: () => {} };
    for (const c of [S.art, S.stroke]) { c.width = w; c.height = h; }
    return S;
  }
  function ptResize(S, w, h) {
    S.w = w; S.h = h;
    for (const c of [S.art, S.stroke]) { c.width = w; c.height = h; }
  }
  const ART = surface(512, 512); // the art maker's painting
  ART.save = () => lsSet(PT_DRAFT, JSON.stringify({ w: ART.w, h: ART.h, img: ART.art.toDataURL('image/png') }));
  ART.redraw = () => drawPixelUI();
  function ptLoad() {
    if (PT.loaded) return;
    PT.loaded = true;
    try {
      const d = JSON.parse(lsGet(PT_DRAFT) || 'null');
      if (!d || !PT_SIZES.some(([s]) => s === d.w + 'x' + d.h) || !/^data:image\/png;base64,/.test(d.img)) return;
      ptResize(ART, d.w, d.h);
      const im = new Image();
      im.onload = () => { ART.art.getContext('2d').drawImage(im, 0, 0); ptShow(ART); };
      im.src = d.img;
    } catch (e) { /* bad draft */ }
  }

  function ptPush(S) {
    S.undo.push({ w: S.w, h: S.h, d: S.art.getContext('2d').getImageData(0, 0, S.w, S.h) });
    if (S.undo.length > 25) S.undo.shift();
    S.redo = [];
  }
  function ptSwap(S, from, to) {
    const s = from.pop(); if (!s) return;
    to.push({ w: S.w, h: S.h, d: S.art.getContext('2d').getImageData(0, 0, S.w, S.h) });
    const resized = s.w !== S.w || s.h !== S.h;
    if (resized) ptResize(S, s.w, s.h);
    S.art.getContext('2d').putImageData(s.d, 0, 0);
    S.save();
    if (resized) S.redraw(); else ptShow(S);
  }
  const ptUndo = (S) => ptSwap(S, S.undo, S.redo), ptRedo = (S) => ptSwap(S, S.redo, S.undo);
  function ptClear(S) { ptPush(S); S.art.getContext('2d').clearRect(0, 0, S.w, S.h); S.save(); ptShow(S); }

  // the visible canvas: a checkerboard for see-through parts (not on the page, where the page shows through),
  // the art, then the stroke being drawn
  let ptChecker = null;
  function ptShow(S) {
    if (!S.view) return;
    const g = S.view.getContext('2d');
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (S.see) g.clearRect(0, 0, S.w, S.h);
    else {
      if (!ptChecker) {
        const t = document.createElement('canvas'); t.width = t.height = 16;
        const tg = t.getContext('2d'); tg.fillStyle = '#f7f7f7'; tg.fillRect(0, 0, 16, 16); tg.fillStyle = '#e6e6e6'; tg.fillRect(0, 0, 8, 8); tg.fillRect(8, 8, 8, 8);
        ptChecker = g.createPattern(t, 'repeat');
      }
      g.fillStyle = ptChecker; g.fillRect(0, 0, S.w, S.h);
    }
    g.drawImage(S.art, 0, 0);
    g.globalAlpha = PT.alpha / 100; g.drawImage(S.stroke, 0, 0); g.globalAlpha = 1;
    if (S.onShow) S.onShow();
  }

  // the tool buttons and settings, shared by the art maker and drawing on the page
  function ptToolRows(S, redraw, small) {
    const out = [];
    const tools = mk('div', 'ed-row pt-tools');
    const seg = mk('div', 'hs-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Tool');
    for (const [id, t] of PT_TOOLS) {
      const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(PT.tool === id));
      b.addEventListener('click', () => { PT.tool = id; redraw(); }); seg.appendChild(b);
    }
    tools.appendChild(seg);
    out.push(tools);
    const opt = mk('div', 'ed-row');
    const range = (label, key, min, max) => {
      const l = mk('label', 'pt-range'); const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.value = PT[key];
      const v = mk('span', 'hs-note', String(PT[key]));
      i.addEventListener('input', () => { PT[key] = +i.value; v.textContent = i.value; });
      l.append(document.createTextNode(label + ' '), i, v); return l;
    };
    opt.append(range('Size', 'size', 1, 120), range('Opacity %', 'alpha', 5, 100));
    const check = (label, key) => { const l = mk('label', 'hs-chk'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = PT[key]; c.addEventListener('change', () => { PT[key] = c.checked; }); l.append(c, document.createTextNode(' ' + label)); return l; };
    if (PT.tool === 'brush') opt.appendChild(check('Soft edge', 'soft'));
    if (PT.tool === 'pixel') opt.appendChild(range('Pixel size', 'cell', 2, 32));
    if (PT.tool === 'rect' || PT.tool === 'ellipse') opt.appendChild(check('Filled', 'filled'));
    if (PT.tool === 'text') {
      const i = document.createElement('input'); i.type = 'text'; i.maxLength = 80; i.value = PT.text; i.placeholder = small ? 'Type, then tap' : 'Type, then tap the picture'; i.setAttribute('aria-label', 'Text to place');
      i.addEventListener('input', () => { PT.text = i.value; }); opt.appendChild(i);
    }
    out.push(opt);
    return { rows: out, opt };
  }

  function drawPaintUI(box) {
    ptLoad();
    const { rows, opt } = ptToolRows(ART, drawPixelUI, false);
    const sz = document.createElement('select'); sz.setAttribute('aria-label', 'Canvas size');
    for (const [k, t] of PT_SIZES) sz.append(new Option(t, k));
    sz.value = ART.w + 'x' + ART.h;
    sz.addEventListener('change', () => {
      ptPush(ART);
      const [w, h] = sz.value.split('x').map(Number), old = document.createElement('canvas'); old.width = ART.w; old.height = ART.h; old.getContext('2d').drawImage(ART.art, 0, 0);
      ptResize(ART, w, h); ART.art.getContext('2d').drawImage(old, 0, 0); ART.save(); drawPixelUI();
    });
    opt.append(sz, btn('Undo', 'hs-sm', () => ptUndo(ART)), btn('Redo', 'hs-sm', () => ptRedo(ART)), btn('Clear', 'hs-sm', () => ptClear(ART)), artResizeRow(ptScaleArt));
    box.append(...rows, pxColorRow());
    const stage = mk('div', 'px-stage');
    ART.view = document.createElement('canvas'); ART.view.className = 'px-canvas pt-canvas'; ART.view.width = ART.w; ART.view.height = ART.h; ART.view.setAttribute('aria-label', 'Painting');
    const maxW = Math.min(720, window.innerWidth - 48), maxH = window.innerHeight - 330;
    const k = Math.min(1.5, maxW / ART.w, Math.max(200, maxH) / ART.h);
    ART.view.style.width = Math.round(ART.w * k) + 'px';
    stage.appendChild(ART.view); box.appendChild(stage);
    ptBind(ART);
    ptShow(ART);
  }

  function ptBind(S) {
    const V = S.view;
    let down = false, start = null, last = null;
    const at = (e) => { const r = V.getBoundingClientRect(); return [(e.clientX - r.left) * S.w / r.width, (e.clientY - r.top) * S.h / r.height]; };
    const width = (e) => Math.max(1, PT.size * S.scale * (e.pointerType === 'pen' && e.pressure ? 0.3 + e.pressure : 1));
    const sg = S.stroke.getContext('2d');
    const style = (g, w) => {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = g.fillStyle = PX.color; g.lineWidth = w;
      g.shadowBlur = PT.tool === 'brush' && PT.soft ? w / 2 : 0; g.shadowColor = PX.color;
    };
    const seg = (a, b, w) => {
      if (PT.tool === 'eraser') {
        const g = S.art.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = PT.alpha / 100;
        g.lineCap = 'round'; g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.restore();
        if (S.onErase) S.onErase(a, b, w);
        return;
      }
      if (PT.tool === 'pixel') {
        // square cells on a grid, like the pixel art tool; "Pixel size" sets the cell
        const cs = Math.max(1, PT.cell * S.scale), dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs / 2)));
        sg.fillStyle = PX.color;
        for (let i = 0; i <= n; i++) { const x = a[0] + dx * i / n, y = a[1] + dy * i / n; sg.fillRect(Math.floor(x / cs) * cs, Math.floor(y / cs) * cs, cs, cs); }
        return;
      }
      if (PT.tool === 'spray') {
        sg.fillStyle = PX.color;
        const r = w * 1.5, n = Math.ceil(w * 1.2), dot = 1.5 * S.scale;
        for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; sg.fillRect(b[0] + Math.cos(t) * d, b[1] + Math.sin(t) * d, dot, dot); }
        return;
      }
      style(sg, PT.tool === 'pencil' ? Math.max(1, w / 4) : w);
      if (PT.tool === 'marker') sg.lineCap = 'square';
      sg.beginPath(); sg.moveTo(a[0], a[1]); sg.lineTo(b[0], b[1]); sg.stroke();
    };
    const shape = (a, b, w) => {
      sg.clearRect(0, 0, S.w, S.h); style(sg, w); sg.shadowBlur = 0; sg.beginPath();
      if (PT.tool === 'line') { sg.moveTo(a[0], a[1]); sg.lineTo(b[0], b[1]); sg.stroke(); return; }
      if (PT.tool === 'rect') sg.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else sg.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
      if (PT.filled) sg.fill(); else sg.stroke();
    };
    const commit = () => {
      const g = S.art.getContext('2d'); g.save(); g.globalAlpha = PT.alpha / 100; g.drawImage(S.stroke, 0, 0); g.restore();
      sg.clearRect(0, 0, S.w, S.h); S.save(); ptShow(S);
    };
    V.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = at(e);
      if (PT.tool === 'pick') {
        const d = S.art.getContext('2d').getImageData(Math.floor(p[0]), Math.floor(p[1]), 1, 1).data;
        if (d[3]) { PX.color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); pxRecent(PX.color); }
        PT.tool = 'brush'; S.redraw(); return;
      }
      ptPush(S);
      if (PT.tool === 'fill') { ptFill(S, Math.floor(p[0]), Math.floor(p[1])); S.save(); ptShow(S); return; }
      if (PT.tool === 'text') {
        if (!PT.text.trim()) { S.undo.pop(); return; }
        sg.font = `${Math.max(8, PT.size * 2 * S.scale)}px ${getComputedStyle(document.body).fontFamily}`; sg.fillStyle = PX.color; sg.textBaseline = 'middle';
        sg.fillText(PT.text, p[0], p[1]); commit(); return;
      }
      pxRecent(PX.color);
      down = true; start = last = p; V.setPointerCapture(e.pointerId);
      if (!['line', 'rect', 'ellipse'].includes(PT.tool)) { seg(p, [p[0] + 0.01, p[1]], width(e)); ptShow(S); }
    });
    V.addEventListener('pointermove', (e) => {
      if (!down) return;
      const p = at(e);
      if (['line', 'rect', 'ellipse'].includes(PT.tool)) shape(start, p, width(e)); else seg(last, p, width(e));
      last = p; ptShow(S);
    });
    const end = () => { if (!down) return; down = false; if (PT.tool === 'eraser') { S.save(); ptShow(S); if (S.onEraseEnd) S.onEraseEnd(); } else commit(); };
    V.addEventListener('pointerup', end); V.addEventListener('pointercancel', end);
  }
  // fill the area of similar color around a point (colors within a small tolerance count as the same)
  function ptFill(S, x, y) {
    const w = S.w, h = S.h, g = S.art.getContext('2d'), img = g.getImageData(0, 0, w, h), d = img.data;
    const i0 = (y * w + x) * 4, from = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const c = PX.color, to = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), Math.round(255 * PT.alpha / 100)];
    if (from.every((v, k) => v === to[k])) return;
    const same = (i) => Math.abs(d[i] - from[0]) + Math.abs(d[i + 1] - from[1]) + Math.abs(d[i + 2] - from[2]) + Math.abs(d[i + 3] - from[3]) <= 48;
    const seen = new Uint8Array(w * h), st = [x, y];
    while (st.length) {
      const cy = st.pop(), cx = st.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const p = cy * w + cx; if (seen[p]) continue; seen[p] = 1;
      if (!same(p * 4)) continue;
      d[p * 4] = to[0]; d[p * 4 + 1] = to[1]; d[p * 4 + 2] = to[2]; d[p * 4 + 3] = to[3];
      st.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
    g.putImageData(img, 0, 0);
  }
  // the drawn part of a painting (empty edges cut off) and where it was, or null when nothing is drawn
  function ptTrim(S) {
    const d = S.art.getContext('2d').getImageData(0, 0, S.w, S.h).data;
    let x0 = S.w, y0 = S.h, x1 = -1, y1 = -1;
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (d[(y * S.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext('2d').drawImage(S.art, -x0, -y0);
    return { c, x0, y0 };
  }
  // scales the painting itself (not the canvas) around its middle; anything pushed past the edge is cut off
  function ptScaleArt(k) {
    const t = ptTrim(ART);
    if (!t) { edMsg('Draw something first.'); return; }
    ptPush(ART);
    const w = t.c.width, h = t.c.height, g = ART.art.getContext('2d');
    g.clearRect(0, 0, ART.w, ART.h);
    g.imageSmoothingQuality = 'high';
    g.drawImage(t.c, t.x0 + w / 2 - w * k / 2, t.y0 + h / 2 - h * k / 2, w * k, h * k);
    ART.save(); ptShow(ART);
  }
  function ptCanvas(trim) { if (!trim) return ART.art; const t = ptTrim(ART); return t && t.c; }
  // the smaller of PNG and WebP (both keep see-through parts), shrunk until it fits the size limit
  function artData(c, limit) {
    for (let k = 1; k > 0.1; k *= 0.75) {
      let s = c;
      if (k < 1) { s = document.createElement('canvas'); s.width = Math.max(1, Math.round(c.width * k)); s.height = Math.max(1, Math.round(c.height * k)); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); }
      const png = s.toDataURL('image/png'), webp = s.toDataURL('image/webp', 0.9);
      const best = /^data:image\/webp/.test(webp) && webp.length < png.length ? webp : png;
      if (best.length <= limit) return best;
    }
    return null;
  }
  function ptOpenImage(img) {
    ptPush(ART);
    const k = Math.min(1, ART.w / img.naturalWidth, ART.h / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
    ART.art.getContext('2d').drawImage(img, (ART.w - w) / 2, (ART.h - h) / 2, w, h);
    ART.save(); ptShow(ART);
  }

  // ---- drawing right on the page: the drawing square ----
  // A small square on the side of the screen opens a pop-up with the brushes. "Draw" lays a see-through canvas
  // over the screen; "Browse" puts it away so the site works as normal. Whatever is drawn is placed where it was
  // drawn, stuck to that page, whenever you switch to Browse, scroll, change page or close the pop-up.
  // In edit mode or the theme maker it becomes free art there; otherwise it is the visitor's own drawing,
  // kept only in their browser and backup file.
  const DQ_ART = ''; // art for the square itself: a file path such as 'assets/draw-square.png' (empty = a text label)
  const DQ = { open: false, drawing: true, adv: false, done: [] };
  let DS = null;
  const dqBtn = mk('button', 'dq-btn'); dqBtn.type = 'button'; dqBtn.setAttribute('aria-label', 'Drawing tools'); dqBtn.hidden = true;
  if (DQ_ART) { const im = document.createElement('img'); im.src = DQ_ART; im.alt = ''; dqBtn.appendChild(im); } else dqBtn.textContent = 'Draw';
  const dqPop = mk('div', 'dq-pop'); dqPop.hidden = true; dqPop.setAttribute('role', 'dialog'); dqPop.setAttribute('aria-label', 'Drawing tools');
  const dqLayer = mk('div', 'pd-wrap'); dqLayer.hidden = true;
  const dqBack = mk('div', 'pd-backwrap'); // holds the strokes in progress when drawing behind the page
  document.body.append(dqBack, dqLayer, dqBtn, dqPop);
  // a tap opens the pop-up; dragging moves the square up and down, or across to the other side of the screen
  let dqDrag = null;
  dqBtn.addEventListener('pointerdown', (e) => { dqDrag = { x: e.clientX, y: e.clientY, moved: false }; dqBtn.setPointerCapture(e.pointerId); });
  dqBtn.addEventListener('pointermove', (e) => {
    if (!dqDrag) return;
    if (!dqDrag.moved && Math.hypot(e.clientX - dqDrag.x, e.clientY - dqDrag.y) < 6) return;
    dqDrag.moved = true;
    DRAWSQ.y = Math.min(95, Math.max(5, (e.clientY / window.innerHeight) * 100));
    DRAWSQ.side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    syncDrawSquare();
  });
  dqBtn.addEventListener('pointerup', () => { if (dqDrag && dqDrag.moved) persist(); });
  dqBtn.addEventListener('click', (e) => {
    const moved = dqDrag && dqDrag.moved; dqDrag = null;
    if (moved) { e.preventDefault(); return; }
    if (DQ.open) closeDraw(); else openDraw();
  });
  dqBtn.addEventListener('keydown', (e) => { // arrow keys move it too
    const d = { ArrowUp: -5, ArrowDown: 5 }[e.key];
    if (d) { e.preventDefault(); DRAWSQ.y = Math.min(95, Math.max(5, DRAWSQ.y + d)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); DRAWSQ.side = e.key === 'ArrowLeft' ? 'left' : 'right'; } else return;
    syncDrawSquare(); persist();
  });
  // the square shows when the visitor turned it on in Settings, and always in edit mode and the theme maker
  function syncDrawSquare() {
    dqBtn.hidden = !(DRAWSQ.on || edActive()); dqBtn.setAttribute('aria-expanded', String(DQ.open));
    dqBtn.setAttribute('aria-label', 'Drawing tools. Drag, or use the arrow keys, to move this square.');
    for (const el of [dqBtn, dqPop]) el.classList.toggle('left', DRAWSQ.side === 'left');
    dqBtn.style.top = DRAWSQ.y + '%';
    placePop();
  }
  // the pop-up sits beside the square, kept inside the screen
  function placePop() {
    if (dqPop.hidden) return;
    const h = dqPop.offsetHeight, mid = (DRAWSQ.y / 100) * window.innerHeight;
    dqPop.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, mid - h / 2)) + 'px';
  }

  function dqSurface() {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    DS = surface(Math.round(window.innerWidth * scale), Math.round(window.innerHeight * scale), scale);
    DS.see = true; DS.redraw = drawDrawUI; DS.anchor = null;
    DS.view = document.createElement('canvas'); DS.view.className = 'pd-canvas'; DS.view.width = DS.w; DS.view.height = DS.h; DS.view.setAttribute('aria-label', 'Drawing on the page');
    // remember where the page was when drawing started, so the art lands in the right place later
    DS.view.addEventListener('pointerdown', () => {
      if (DS.anchor) return;
      const page = drawPage(), el = isUnitPage(page) ? dlg.querySelector('.hs-dlg-in') : root.querySelector('section.hs-page#' + state.page);
      const r = el.getBoundingClientRect();
      DS.anchor = { page, left: r.left, top: r.top, width: r.width, height: r.height };
    }, true);
    DS.onErase = eraseDrawn; DS.onEraseEnd = eraseDrawnEnd;
    ptBind(DS);
    // a scroll wheel still scrolls: the drawing so far is placed first, then the page moves
    DS.view.addEventListener('wheel', (e) => { e.preventDefault(); commitDraw(); (dlg.open ? dlg : window).scrollBy(e.deltaX, e.deltaY); }, { passive: false });
    DS.y0 = window.scrollY;
    // drawing behind: the top canvas only catches the pen and stays see-through, and a copy behind the page shows the strokes
    DS.back = document.createElement('canvas'); DS.back.className = 'pd-back'; DS.back.width = DS.w; DS.back.height = DS.h; DS.back.setAttribute('aria-hidden', 'true');
    DS.onShow = () => {
      const behind = DRAWSQ.layer === 'back';
      DS.view.style.opacity = behind ? '0' : '';
      DS.back.hidden = !behind || dqLayer.hidden;
      if (!behind) return;
      const g = DS.back.getContext('2d'); g.clearRect(0, 0, DS.w, DS.h); g.drawImage(DS.view, 0, 0);
    };
    dqLayer.replaceChildren(DS.view);
    dqBack.replaceChildren(DS.back);
  }
  function openDraw() {
    closePixel();
    DQ.open = true; DQ.drawing = true;
    if (!DS) dqSurface();
    dqLayer.hidden = false; dqPop.hidden = false; ptShow(DS);
    drawDrawUI(); syncDrawSquare();
  }
  function closeDraw() {
    commitDraw();
    DQ.open = false; DS = null;
    dqLayer.hidden = true; dqLayer.replaceChildren(); dqBack.replaceChildren(); dqPop.hidden = true;
    syncDrawSquare();
  }
  function setDrawing(on) {
    if (!on) commitDraw();
    DQ.drawing = on; dqLayer.hidden = !on; if (DS) ptShow(DS); drawDrawUI();
  }
  // place what is on the canvas, then start a fresh one
  function commitDraw() {
    if (!DS || !DS.anchor) return;
    const t = ptTrim(DS), A = DS.anchor;
    if (t) {
      const data = artData(t.c, MAKER || !EDIT_MODE ? 600000 : 2900000);
      if (data) {
        // exact pixels from the page's middle and top, so a drawing made in pieces (scrolling between them) stays joined
        const cx = (t.x0 + t.c.width / 2) / DS.scale, cy = (t.y0 + t.c.height / 2) / DS.scale, w = t.c.width / DS.scale;
        const place = { u: 'px', x: cx - (A.left + A.width / 2), y: cy - A.top, w, page: A.page, layer: DRAWSQ.layer };
        const id = edActive() ? addSticker(data, false, 0, 0, place) : addDoodle(data, place);
        if (id) DQ.done.push({ id });
      }
    }
    DS.art.getContext('2d').clearRect(0, 0, DS.w, DS.h); DS.undo = []; DS.redo = []; DS.anchor = null; ptShow(DS);
  }
  // Undo: first the strokes not placed yet, then the drawings already placed, newest first
  function dqUndo() {
    if (DS && DS.undo.length) { ptUndo(DS); return; }
    const step = DQ.done.pop(); if (!step) return;
    if (step.src) setDrawnSrc(step.id, step.src); else removeDrawn(step.id);
  }
  // the Eraser also rubs out drawings placed earlier, even ones from another day: while erasing, each drawing
  // under the eraser is swapped for a canvas copy that the eraser works on, then saved back when the stroke ends
  const ERASING = new Map(); // drawing id -> { im, c, old }
  function eraseDrawn(a, b, w) {
    const sel = edActive() ? 'img.stk.mine' : 'img.stk.doodle';
    const x0 = a[0] / DS.scale, y0 = a[1] / DS.scale, x1 = b[0] / DS.scale, y1 = b[1] / DS.scale, rw = w / DS.scale;
    const box = { l: Math.min(x0, x1) - rw, r: Math.max(x0, x1) + rw, t: Math.min(y0, y1) - rw, b: Math.max(y0, y1) + rw };
    const hit = [...document.querySelectorAll(sel)].concat([...ERASING.values()].map((x) => x.c));
    for (const el of new Set(hit)) {
      const r = el.getBoundingClientRect();
      if (r.right < box.l || r.left > box.r || r.bottom < box.t || r.top > box.b) continue;
      const id = el.dataset.stk; let job = ERASING.get(id);
      if (!job) {
        if (!el.complete || !el.naturalWidth) continue;
        const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight;
        c.getContext('2d').drawImage(el, 0, 0);
        c.className = el.className; c.style.cssText = el.style.cssText; c.dataset.stk = id;
        el.after(c); el.hidden = true;
        job = { im: el, c, old: el.getAttribute('src') }; ERASING.set(id, job);
      }
      const k = job.c.width / r.width, g = job.c.getContext('2d');
      g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = PT.alpha / 100; g.lineCap = 'round'; g.lineWidth = rw * k;
      g.beginPath(); g.moveTo((x0 - r.left) * k, (y0 - r.top) * k); g.lineTo((x1 - r.left) * k, (y1 - r.top) * k); g.stroke(); g.restore();
    }
  }
  function eraseDrawnEnd() {
    if (ERASING.size && DS) DS.undo.pop(); // this stroke's Undo step is the one for the placed drawings below
    for (const [id, job] of ERASING) {
      const d = job.c.getContext('2d').getImageData(0, 0, job.c.width, job.c.height).data;
      let any = false; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { any = true; break; } // faint edge specks left by the eraser do not count
      job.c.remove(); job.im.hidden = false;
      if (!any) { DQ.done.push({ id, src: job.old, gone: true }); removeDrawn(id, true); continue; }
      const data = artData(job.c, MAKER || !EDIT_MODE ? 600000 : 2900000);
      if (data) { DQ.done.push({ id, src: job.old }); setDrawnSrc(id, data); }
    }
    ERASING.clear();
  }
  function drawDrawUI() {
    dqPop.replaceChildren();
    const head = mk('div', 'ed-row');
    const mode = mk('div', 'hs-seg'); mode.setAttribute('role', 'group'); mode.setAttribute('aria-label', 'Draw or browse');
    for (const [on, t] of [[true, 'Draw'], [false, 'Browse']]) {
      const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(DQ.drawing === on));
      b.addEventListener('click', () => setDrawing(on)); mode.appendChild(b);
    }
    head.append(mode, btn('Undo', 'hs-sm', dqUndo), btn('Close', 'hs-sm', closeDraw));
    dqPop.appendChild(head);
    // the everyday tools; the rest are under "Advanced tools"
    const basic = mk('div', 'hs-seg dq-basic'); basic.setAttribute('role', 'group'); basic.setAttribute('aria-label', 'Tool');
    for (const [id, t] of [['brush', 'Brush'], ['pixel', 'Pixel pen'], ['eraser', 'Eraser']]) {
      const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(PT.tool === id));
      b.addEventListener('click', () => { PT.tool = id; if (!DQ.drawing) setDrawing(true); else drawDrawUI(); }); basic.appendChild(b);
    }
    dqPop.appendChild(basic);
    const sz = mk('label', 'pt-range'); const si = document.createElement('input'); si.type = 'range'; si.min = 1; si.max = 120; si.value = PT.size; si.setAttribute('aria-label', 'Size');
    si.addEventListener('input', () => { PT.size = +si.value; }); sz.append(document.createTextNode('Size '), si);
    dqPop.appendChild(sz);
    // which layer new drawings go on: over the page, or behind the cards and text
    const lay = mk('div', 'hs-seg dq-layer'); lay.setAttribute('role', 'group'); lay.setAttribute('aria-label', 'Layer to draw on');
    for (const [id, t] of [['front', 'In front'], ['back', 'Behind']]) {
      const b = mk('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(DRAWSQ.layer === id));
      b.addEventListener('click', () => { if (DRAWSQ.layer !== id) { commitDraw(); DRAWSQ.layer = id; persist(); if (DS) ptShow(DS); } drawDrawUI(); }); lay.appendChild(b);
    }
    dqPop.append(mk('span', 'hs-note dq-laylabel', 'Layer'), lay);
    const cols = pxColorRow(drawDrawUI); cols.classList.add('dq-cols');
    dqPop.appendChild(cols);
    dqPop.appendChild(btn(DQ.adv ? 'Hide advanced tools' : 'Advanced tools', 'hs-sm', () => { DQ.adv = !DQ.adv; drawDrawUI(); }));
    if (DQ.adv) {
      const { rows } = ptToolRows(DS, drawDrawUI, true);
      const adv = mk('div', 'dq-adv'); adv.append(...rows);
      adv.appendChild(btn('Redo', 'hs-sm', () => DS && ptRedo(DS)));
      if (!edActive()) adv.appendChild(btn('Erase my drawings on this page', 'hs-sm', (e) => { if (!armed('dqclear', e.currentTarget, 'Tap again to erase them')) return; clearDoodles(drawPage()); drawDrawUI(); }));
      if (edActive()) adv.appendChild(btn('Open the art maker', 'hs-sm', () => { closeDraw(); openPixel(); }));
      dqPop.appendChild(adv);
    }
    if (!DQ.drawing) dqPop.appendChild(mk('div', 'hs-note', 'Browsing: the page works as normal. Pick Draw to keep drawing.'));
    ptShow(DS); placePop();
  }
  // keep the canvas lined up with the screen
  // the page scrolled some other way (scroll bar, keys): place what was drawn before the page moved
  window.addEventListener('scroll', () => { if (DS && DS.anchor && Math.abs(window.scrollY - DS.y0) > 1) commitDraw(); if (DS) DS.y0 = window.scrollY; }, { passive: true });
  window.addEventListener('resize', () => { if (DS) { commitDraw(); dqSurface(); if (!DQ.drawing) dqLayer.hidden = true; } });
  window.addEventListener('hashchange', () => { if (DS) commitDraw(); });
  // a unit's page is a pop-up on top of everything, so while it is open the drawing tools move into it;
  // what was drawn so far is placed first, on the page it was drawn on
  function dqUnitChange() { if (DS) commitDraw(); }
  function dqHome() {
    const host = dlg.open ? dlg : document.body;
    if (dqBtn.parentElement === host) return;
    if (DS) commitDraw();
    host.append(dqBack, dqLayer, dqBtn, dqPop);
    STK_SIG = ''; applyStickers(); placePop();
  }
  new MutationObserver(dqHome).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  dlg.addEventListener('close', dqHome);
  dlg.addEventListener('scroll', () => { if (DS && DS.anchor) commitDraw(); }, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => {
    if (!DQ.open || !DS) return;
    if (e.key === 'Escape') closeDraw();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ptRedo(DS); else dqUndo(); }
  });
  syncDrawSquare();
  // ---------- start-up: load what this browser remembered ----------
  if (REMEMBER) {
    const raw = lsGet(STORE_KEY);
    if (raw) { try { restore(clean(JSON.parse(raw)), false); LAST_SAVED = raw; } catch (e) { /* unreadable: start fresh */ } }
  }
  dash.onData(() => { if (dlg.open) dlgPic(); });
  dash.onData(() => {
    draw();
  });
  const named = location.hash.slice(1);
  if (PAGES.includes(named) && named !== 'home') showPage(named, false);
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PAGES.includes(h) && h !== state.page) showPage(h, false); });
})();
