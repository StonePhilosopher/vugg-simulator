// ============================================================
// js/95-ui-library.ts — UI — Library mode (mineral reference browser)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// LIBRARY MODE — mineral reference browser (reads MINERAL_SPEC)
// ============================================================
let _libraryInitialized = false;

function libraryInit() {
  // Populate filter dropdowns from MINERAL_SPEC; wait for fetch if needed.
  onSpecReady(() => {
    if (!_libraryInitialized) {
      const classSet = new Set<string>();
      const elementSet = new Set<string>();
      const scenarioSet = new Set<string>();
      for (const m of Object.values(MINERAL_SPEC)) {
        if (m.class) classSet.add(m.class);
        if (m.required_ingredients) Object.keys(m.required_ingredients).forEach(e => elementSet.add(e));
        if (m.trace_ingredients) Object.keys(m.trace_ingredients).forEach(e => elementSet.add(e));
        if (Array.isArray(m.scenarios)) m.scenarios.forEach(s => scenarioSet.add(s));
      }
      const classSel = document.getElementById('lib-class');
      [...classSet].sort().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; classSel.appendChild(o); });
      const elSel = document.getElementById('lib-element');
      [...elementSet].sort().forEach(e => { const o = document.createElement('option'); o.value = e; o.textContent = e; elSel.appendChild(o); });
      const scSel = document.getElementById('lib-scenario');
      [...scenarioSet].sort().forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; scSel.appendChild(o); });
      _libraryInitialized = true;
    }
    libraryRender();
  });
}

function libraryResetFilters() {
  ['lib-class','lib-fluor','lib-collected','lib-temp','lib-element','lib-scenario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'all'; });
  const s = document.getElementById('lib-search'); if (s) s.value = '';
  libraryRender();
}

function libraryMatches(mineral, m, filters) {
  if (filters.cls !== 'all' && m.class !== filters.cls) return false;
  if (filters.fluor === 'yes' && !m.fluorescence) return false;
  if (filters.fluor === 'no'  && m.fluorescence) return false;
  if (filters.collected && filters.collected !== 'all') {
    const isCollected = filters.collectedSet && filters.collectedSet.has(mineral);
    if (filters.collected === 'yes' && !isCollected) return false;
    if (filters.collected === 'no'  && isCollected)  return false;
  }
  if (filters.temp !== 'all') {
    const range = m.T_range_C || [0, 1000];
    const opt = m.T_optimum_C || range;
    const mid = (opt[0] + opt[1]) / 2;
    if (filters.temp === 'low' && mid >= 100) return false;
    if (filters.temp === 'mid' && (mid < 100 || mid > 400)) return false;
    if (filters.temp === 'high' && mid <= 400) return false;
  }
  if (filters.element !== 'all') {
    const reqHas = m.required_ingredients && filters.element in m.required_ingredients;
    const trcHas = m.trace_ingredients && filters.element in m.trace_ingredients;
    if (!reqHas && !trcHas) return false;
  }
  if (filters.scenario !== 'all') {
    if (!Array.isArray(m.scenarios) || !m.scenarios.includes(filters.scenario)) return false;
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!mineral.toLowerCase().includes(q) && !(m.formula || '').toLowerCase().includes(q) && !(m.description || '').toLowerCase().includes(q)) return false;
  }
  return true;
}

function fluorescenceSummary(fl) {
  if (!fl) return null;
  // v12: explicitly-non-fluorescent species (e.g. uraninite) declare
  // {activator: null, color: null}. Treat as no fluorescence.
  if (!fl.activator && !fl.color) return null;
  const color = (fl.color || '').replace(/_/g, ' ');
  const activator = fl.activator || 'intrinsic';
  const q = fl.quencher && fl.quencher.species ? ` (quenched by ${fl.quencher.species})` : '';
  return `${color} — ${activator}${q}`;
}

function isFluorescent(fl) {
  // Helper for the FL badge — explicitly-null activator+color = not fluorescent
  return !!(fl && (fl.activator || fl.color));
}

function renderIngredientChips(obj) {
  if (!obj || !Object.keys(obj).length) return '—';
  return Object.entries(obj).map(([k,v]) => `<span class="mineral-card-badge">${k}${typeof v === 'number' ? ` ≥${v}` : ''}</span>`).join('');
}

function renderCollectedForMineral(name) {
  const items = crystalsOfMineral(name);
  if (!items.length) {
    return `<div class="card-collection empty">📦 Not yet collected — the next ${name} is yours to claim.</div>`;
  }
  const rows = items
    .slice()
    .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())
    .map(c => {
      const twin = c.twinned ? ` · ⟁ ${c.twin_law || ''}` : '';
      const src = c.source && (c.source.scenario || c.source.archetype || c.source.mode) || '';
      const seed = c.source && c.source.seed != null ? ` · seed ${c.source.seed}` : '';
      const safeName = (c.name || '').replace(/"/g, '&quot;');
      const zoneCount = Array.isArray(c.zones) ? c.zones.length : (c.zone_count || 0);
      const canPlay = zoneCount > 0;
      const playBtn = canPlay
        ? `<button onclick="playCollectedInGroove('${c.id}')" title="Open this crystal in the Record Player">▶ Play</button>`
        : `<button disabled title="No zone data saved — collect a fresh one">▶ Play</button>`;
      // Zone-viz Phase 1d: bar-graph thumbnail for each collected specimen.
      // crystalThumbHTML is duck-typed — it reads .mineral + .zones, which
      // the serialized record has. For records saved before zone data was
      // persisted (c.zones undefined), falls back to the generic mineral
      // photo/placeholder automatically.
      const thumbHTML = crystalThumbHTML(c, 40);
      return `<div class="collected-row" style="display:flex;gap:0.5rem;align-items:flex-start">
        ${thumbHTML}
        <div style="flex:1;min-width:0">
          <div class="collected-row-head">
            <span class="collected-name" title="${safeName}">${c.name}</span>
            <span class="collected-size">${c.mm.toFixed(2)} mm</span>
          </div>
          <div class="collected-row-meta">${c.habit}${twin} · ${src}${seed} · ${zoneCount} zones</div>
          <div class="collected-row-actions">
            ${playBtn}
            <button onclick="renameCollectedCrystal('${c.id}')">✎ Rename</button>
            <button onclick="deleteCollectedCrystal('${c.id}')" class="danger">🗑 Delete</button>
          </div>
        </div>
      </div>`;
    }).join('');
  return `<div class="card-collection">
    <div class="card-collection-head">📦 Your collection (${items.length})</div>
    ${rows}
  </div>`;
}

function libraryBuildCard(name, m) {
  const Tmin = m.T_range_C ? m.T_range_C[0] : '?';
  const Tmax = m.T_range_C ? m.T_range_C[1] : '?';
  const Topt = m.T_optimum_C ? `${m.T_optimum_C[0]}–${m.T_optimum_C[1]}` : '—';
  const fl = fluorescenceSummary(m.fluorescence);
  const badges = [];
  if (isFluorescent(m.fluorescence)) badges.push('<span class="mineral-card-badge FL">FL</span>');
  if (m.acid_dissolution) badges.push('<span class="mineral-card-badge acid">acid</span>');
  if (Array.isArray(m.twin_laws) && m.twin_laws.length) badges.push('<span class="mineral-card-badge twin">twins</span>');
  const scenarioChips = (m.scenarios || []).map(s => `<span class="scenario-chip">${s}</span>`).join('');
  const twinText = Array.isArray(m.twin_laws) && m.twin_laws.length
    ? m.twin_laws.map(t => t.name + (t.probability ? ` (${(t.probability*100).toFixed(1)}%)` : '')).join(', ')
    : '—';
  const acidText = (() => {
    // Collect pH thresholds from all three possible spec fields:
    //   - acid_dissolution.pH_threshold: the legacy "dissolves below" field
    //   - pH_dissolution_below: newer canonical name for below-threshold
    //   - pH_dissolution_above: inverse — dissolves ABOVE a pH (scorodite,
    //     jarosite, alunite, brochantite, antlerite, adamite, marcasite,
    //     wulfenite — 8 minerals today). The pre-fix card silently showed
    //     '—' for these, which read as "acid-resistant" and was wrong.
    const below = (m.acid_dissolution && m.acid_dissolution.pH_threshold != null)
      ? m.acid_dissolution.pH_threshold
      : (m.pH_dissolution_below != null ? m.pH_dissolution_below : null);
    const above = (m.pH_dissolution_above != null) ? m.pH_dissolution_above : null;
    const parts = [];
    if (below != null) parts.push(`pH &lt; ${below}`);
    if (above != null) parts.push(`pH &gt; ${above}`);
    if (parts.length) return parts.join(', ');
    // acid_dissolution dict exists but no numeric thresholds → HF-only or
    // rehydration-only (beryl/tourmaline/spodumene/anhydrite).
    if (m.acid_dissolution) return 'resistant';
    return '—';
  })();
  const decompText = m.thermal_decomp_C ? `${m.thermal_decomp_C}°C` : '—';
  const collectedCount = crystalsOfMineral(name).length;
  const collectedBadge = collectedCount
    ? `<span class="mineral-card-badge collected">📦 ${collectedCount}</span>`
    : '';

  return `
    <div class="mineral-card" data-mineral="${name}">
      <div class="mineral-card-header">
        <div>
          <div class="mineral-card-name">${name}</div>
          <div class="mineral-card-formula">${m.formula || ''}</div>
        </div>
        <div>${collectedBadge} ${badges.join(' ')} <span class="mineral-card-class">${m.class || '?'}</span></div>
      </div>
      <div class="mineral-card-desc">${m.description || '<em>No description.</em>'}</div>
      <div class="mineral-card-stats">
        <div class="stat-key">Habits</div>
        <div class="stat-val">${(() => {
          // habit_variants entries are objects like {name, wall_spread, ...};
          // plain .join(', ') stringifies them as "[object Object]". Map to
          // the .name field first so the Library shows readable variant names.
          const hv = m.habit_variants;
          if (Array.isArray(hv) && hv.length) {
            return hv.map(v => (v && v.name) || String(v)).join(', ');
          }
          return m.habit || '?';
        })()}</div>
        <div class="stat-key">T window</div>
        <div class="stat-val">${Tmin}–${Tmax}°C (optimum ${Topt})</div>
        <div class="stat-key">Requires</div>
        <div class="stat-val">${renderIngredientChips(m.required_ingredients)}</div>
        <div class="stat-key">Traces</div>
        <div class="stat-val">${renderIngredientChips(m.trace_ingredients)}</div>
        <div class="stat-key">Fluorescence</div>
        <div class="stat-val">${fl || 'non-fluorescent'}</div>
        <div class="stat-key">Twin laws</div>
        <div class="stat-val">${twinText}</div>
        <div class="stat-key">Acid dissolution</div>
        <div class="stat-val">${acidText}</div>
        <div class="stat-key">Thermal decomp</div>
        <div class="stat-val">${decompText}</div>
      </div>
      <div class="mineral-card-scenarios">Grows in: ${scenarioChips || '<em style="color:#5a4a30">no scenarios listed</em>'}</div>
      ${renderCollectedForMineral(name)}
    </div>
  `;
}

function libraryRender() {
  const grid = document.getElementById('library-grid');
  const count = document.getElementById('library-count');
  if (!grid) return;
  if (!MINERAL_SPEC_READY) {
    grid.innerHTML = '<div class="library-empty">Loading spec…</div>';
    return;
  }
  const filters = {
    cls:          document.getElementById('lib-class').value,
    fluor:        document.getElementById('lib-fluor').value,
    collected:    document.getElementById('lib-collected').value,
    temp:         document.getElementById('lib-temp').value,
    element:      document.getElementById('lib-element').value,
    scenario:     document.getElementById('lib-scenario').value,
    search:       document.getElementById('lib-search').value.trim(),
    // Precompute the collected set once per render so libraryMatches
    // doesn't thrash localStorage + JSON.parse for every mineral.
    collectedSet: uniqueCollectedMinerals(),
  };
  const entries = Object.entries(MINERAL_SPEC)
    .filter(([name, m]) => libraryMatches(name, m, filters))
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    grid.innerHTML = '<div class="library-empty">No minerals match these filters.</div>';
  } else {
    grid.innerHTML = entries.map(([n, m]) => libraryBuildCard(n, m)).join('');
  }
  count.textContent = `${entries.length} of ${Object.keys(MINERAL_SPEC).length} minerals`;
}

