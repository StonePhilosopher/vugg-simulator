// ============================================================
// js/93-ui-collection.ts — UI — Crystal collection (localStorage records)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// CRYSTAL COLLECTION — per-crystal persistent records
// ============================================================
// Each entry is ONE individual crystal the user chose to collect
// (not a whole run). Stored as an array in localStorage under
// 'vugg-crystals-v1'. The Library shows each species' collection
// directly on its card; the title-screen Load Game button opens
// the Library.
const CRYSTAL_KEY = 'vugg-crystals-v1';

function loadCrystals() {
  try {
    const raw = localStorage.getItem(CRYSTAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('crystal collection parse failed:', e);
    return [];
  }
}
function persistCrystals(items) {
  try { localStorage.setItem(CRYSTAL_KEY, JSON.stringify(items)); return true; }
  catch (e) { console.error('crystal persist failed:', e); return false; }
}
function uniqueCollectedMinerals() {
  const seen = new Set();
  for (const c of loadCrystals()) seen.add(c.mineral);
  return seen;
}
function crystalsOfMineral(mineral) {
  return loadCrystals().filter(c => c.mineral === mineral);
}

// Turn a live Crystal + the run it came from into a persistent record.
// Stores the full zones array so the Record Player can spiral the
// crystal later — without this the Groove would have nothing to draw.
function buildCrystalRecord(crystal, meta) {
  const titleBase = meta.archetype
    ? `${meta.archetype.replace(/_/g, ' ')} vugg`
    : (meta.scenario ? `${meta.scenario} scenario` : meta.mode || 'unknown');
  const defaultName = `${capitalize(crystal.mineral)} from ${titleBase}`;
  const fl = typeof crystal.predict_fluorescence === 'function'
    ? crystal.predict_fluorescence() : null;

  // Serialize zones with the fields the Groove visualization reads.
  // Everything else on a GrowthZone is recomputable or decorative.
  const zones = (crystal.zones || []).map(z => ({
    step: z.step,
    temperature: z.temperature,
    thickness_um: z.thickness_um,
    growth_rate: z.growth_rate,
    trace_Fe: z.trace_Fe || 0,
    trace_Mn: z.trace_Mn || 0,
    trace_Al: z.trace_Al || 0,
    trace_Ti: z.trace_Ti || 0,
    trace_Pb: z.trace_Pb || 0,
    trace_Cu: z.trace_Cu || 0,
    fluid_inclusion: !!z.fluid_inclusion,
    inclusion_type: z.inclusion_type || '',
    note: z.note || '',
    is_phantom: !!z.is_phantom,
    // Calcite-morphology arc Phase 1: per-zone growth-regime tags ride
    // into the collection so a stepped calcite remembers its terraces.
    // Conditional spread keeps non-calcite records lean.
    ...(z.morph_regime ? {
      morph_regime: z.morph_regime,
      morph_form: z.morph_form || '',
      morph_surf_sigma: +(z.morph_surf_sigma || 0).toFixed(2),
    } : {}),
  }));

  return {
    id: `cry-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
    collected_at: new Date().toISOString(),
    name: meta.name || defaultName,
    mineral: crystal.mineral,
    source: {
      mode: meta.mode || 'unknown',
      scenario: meta.scenario || null,
      archetype: meta.archetype || null,
      seed: meta.seed ?? null,
      nucleation_step: crystal.nucleation_step,
      nucleation_temp: +crystal.nucleation_temp.toFixed(1),
    },
    mm: +crystal.c_length_mm.toFixed(3),
    a_mm: +((crystal.a_width_mm || 0).toFixed(3)),
    habit: crystal.habit || '',
    forms: (crystal.dominant_forms || []).slice(),
    twinned: !!crystal.twinned,
    twin_law: crystal.twin_law || null,
    position: crystal.position || '',
    fluorescence: fl,
    zones,
    zone_count: zones.length,
    total_growth_um: +(crystal.total_growth_um || 0).toFixed(1),
    radiation_damage: crystal.radiation_damage || 0,
  };
}

// Build a Crystal-shaped stand-in from a persisted record — enough for the
// Groove visualization and the zone-history modal to treat it like a live
// crystal. Does not connect to a VugSimulator; purely for display.
function reconstructCrystalFromRecord(rec): any {
  const zones = (rec.zones || []).map(z => Object.assign({}, z));
  const stand = {
    mineral: rec.mineral,
    crystal_id: `C${(rec.id || '').slice(-4)}`,
    nucleation_step: rec.source?.nucleation_step ?? 0,
    nucleation_temp: rec.source?.nucleation_temp ?? 0,
    position: rec.position || '',
    c_length_mm: rec.mm,
    a_width_mm: rec.a_mm || rec.mm,
    habit: rec.habit || '',
    dominant_forms: (rec.forms || []).slice(),
    twinned: !!rec.twinned,
    twin_law: rec.twin_law || '',
    zones,
    total_growth_um: rec.total_growth_um || 0,
    radiation_damage: rec.radiation_damage || 0,
    active: false,
    dissolved: false,
    enclosed_crystals: [],
    enclosed_at_step: [],
    phantom_surfaces: [],
    phantom_count: zones.filter(z => z.is_phantom).length,
    _fromCollectionRecord: rec,
    predict_fluorescence() {
      return rec.fluorescence || 'non-fluorescent';
    },
    predict_color() {
      return rec.habit && rec.habit.includes('smoky') ? 'smoky' : 'typical for species';
    },
    describe_morphology() {
      const parts = [this.habit || 'massive'];
      if (this.dominant_forms && this.dominant_forms.length) {
        parts.push(`[${this.dominant_forms.slice(0, 2).join(', ')}]`);
      }
      if (this.twinned) parts.push(`⟁ ${this.twin_law}`);
      parts.push(`${this.c_length_mm.toFixed(1)} × ${this.a_width_mm.toFixed(1)} mm`);
      return parts.join(' ');
    },
    describe_latest_zone() {
      const z = this.zones[this.zones.length - 1];
      if (!z) return '';
      return `step ${z.step}, T=${z.temperature.toFixed(1)}°C, +${z.thickness_um.toFixed(1)} µm`;
    },
  };
  return stand;
}

function collectCrystal(crystal, meta) {
  if (!crystal) return false;
  if ((crystal.total_growth_um || 0) < 0.1 && (crystal.zones || []).length === 0) {
    alert('This crystal has no growth zones yet — let it grow first.');
    return false;
  }
  const rec = buildCrystalRecord(crystal, meta);
  const defaultName = rec.name;
  const chosen = prompt(`Name this ${crystal.mineral}:`, defaultName);
  if (chosen === null) return false; // cancelled
  rec.name = chosen.trim() || defaultName;

  const already = uniqueCollectedMinerals();
  const items = loadCrystals();
  items.push(rec);
  if (!persistCrystals(items)) {
    alert('Could not save — localStorage is full or unavailable.');
    return false;
  }
  const isNewSpecies = !already.has(rec.mineral);
  // Update any open Library view and the title-screen Load button.
  if (typeof libraryRender === 'function' && document.getElementById('library-panel') &&
      document.getElementById('library-panel').style.display !== 'none') {
    libraryRender();
  }
  refreshTitleLoadButton();
  // Mark the crystal in the live inventory so the Collect button disables.
  crystal._collectedRecordId = rec.id;
  const newMsg = isNewSpecies ? `\n\n🆕 First ${rec.mineral} in your collection — a species unlocked.` : '';
  alert(`Collected "${rec.name}".${newMsg}`);
  return true;
}

function renameCollectedCrystal(id) {
  const items = loadCrystals();
  const rec = items.find(c => c.id === id);
  if (!rec) return;
  const next = prompt('Rename crystal:', rec.name);
  if (next === null) return;
  rec.name = next.trim() || rec.name;
  persistCrystals(items);
  if (typeof libraryRender === 'function') libraryRender();
}
function deleteCollectedCrystal(id) {
  if (!confirm('Delete this specimen from your collection?')) return;
  const items = loadCrystals().filter(c => c.id !== id);
  persistCrystals(items);
  if (typeof libraryRender === 'function') libraryRender();
  refreshTitleLoadButton();
}

function refreshTitleLoadButton() {
  const btn = document.getElementById('title-btn-load');
  if (!btn) return;
  try {
    const items = loadCrystals();
    const n = items.length;
    btn.disabled = n === 0;
    btn.title = n
      ? `Open Library (${n} collected crystal${n === 1 ? '' : 's'})`
      : 'No crystals collected yet — grow a vugg and tap Collect';
  } catch (e) { /* localStorage unavailable */ }
}

// Called by the per-crystal Collect button in each mode's inventory.
// The button stops propagation so the parent row's click (zone history
// modal) doesn't also fire.
function collectFromLegends(crystalIdx, ev) {
  if (ev) ev.stopPropagation();
  if (!legendsSim) return;
  const crystal = legendsSim.crystals[crystalIdx];
  const scenario = document.getElementById('scenario').value;
  const seedInput = document.getElementById('seed').value;
  if (collectCrystal(crystal, {
    mode: 'simulation',
    scenario,
    seed: seedInput ? parseInt(seedInput, 10) : null,
  })) {
    updateLegendsInventory(legendsSim);
  }
}
function collectFromFortress(crystalIdx, ev) {
  if (ev) ev.stopPropagation();
  if (!fortressSim) return;
  const crystal = fortressSim.crystals[crystalIdx];
  if (collectCrystal(crystal, { mode: 'creative' })) updateFortressInventory();
}
function collectFromRandom(crystalIdx, ev) {
  if (ev) ev.stopPropagation();
  if (!randomSim) return;
  const crystal = randomSim.crystals[crystalIdx];
  if (collectCrystal(crystal, {
    mode: 'random',
    archetype: randomSimArchetype,
    seed: randomSimSeed,
  })) {
    renderRandomInventory();
  }
}

// ============================================================
// Bulk "Collect all" (2026-05-23 — boss request after twin-laws arc)
// ============================================================
// One-shot batch version of collectCrystal: no per-crystal name prompt
// (uses the default name from buildCrystalRecord), one consolidated
// alert at the end summarizing the count + any new species. Skips
// already-collected and no-growth crystals using the same gates as
// the per-row Collect button (97c-ui-crystal-card.ts:153-154).
//
// The persist call only runs once after all records are appended, so
// localStorage gets touched a single time regardless of batch size —
// matches the established uniqueCollectedMinerals/loadCrystals pattern
// of "read once, mutate, write once."
//
// Returns the number actually collected (0 if nothing-to-do; 0 with
// alert if persist failed).
function collectAllCrystals(crystals, metaFn) {
  if (!Array.isArray(crystals)) return 0;
  const candidates = crystals.filter(c =>
    c
    && !c._collectedRecordId
    && ((c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0)
  );
  if (!candidates.length) return 0;

  const before = uniqueCollectedMinerals();
  const items = loadCrystals();
  const records: Array<{ crystal: any; rec: any }> = [];
  for (const crystal of candidates) {
    const meta = (typeof metaFn === 'function') ? metaFn(crystal) : (metaFn || {});
    const rec = buildCrystalRecord(crystal, meta);
    items.push(rec);
    records.push({ crystal, rec });
  }

  // Disambiguate duplicate default names within this batch (boss request,
  // 2026-05-23). buildCrystalRecord's default name is
  // `${capitalize(mineral)} from ${titleBase}`, so two galenas from the
  // same scenario/run would land with identical names. Append a #1/#2/#N
  // suffix only where there's a collision — singletons keep their
  // unsuffixed default, which reads cleaner in the Library row list.
  // items and records share rec object identity, so mutating rec.name
  // here is reflected in the persisted record.
  const nameCounts: Record<string, number> = {};
  for (const { rec } of records) {
    nameCounts[rec.name] = (nameCounts[rec.name] || 0) + 1;
  }
  const nameSeen: Record<string, number> = {};
  for (const { rec } of records) {
    if (nameCounts[rec.name] > 1) {
      nameSeen[rec.name] = (nameSeen[rec.name] || 0) + 1;
      rec.name = `${rec.name} #${nameSeen[rec.name]}`;
    }
  }

  if (!persistCrystals(items)) {
    alert('Could not save — localStorage is full or unavailable.');
    return 0;
  }
  for (const { crystal, rec } of records) {
    crystal._collectedRecordId = rec.id;
  }

  // New-species delta — preserves the same "🆕 first X" surprise from
  // the per-crystal flow, just bundled. Set semantics so each new
  // species shows once even if multiple specimens of it were collected
  // in the same batch.
  const newSpecies: string[] = [];
  const seen = new Set(before);
  for (const { rec } of records) {
    if (!seen.has(rec.mineral)) {
      newSpecies.push(rec.mineral);
      seen.add(rec.mineral);
    }
  }

  // Refresh dependent UI in the same order collectCrystal() does.
  if (typeof libraryRender === 'function'
      && document.getElementById('library-panel')
      && document.getElementById('library-panel').style.display !== 'none') {
    libraryRender();
  }
  refreshTitleLoadButton();

  const speciesNote = newSpecies.length
    ? `\n\n🆕 ${newSpecies.length} new species unlocked: ${newSpecies.join(', ')}.`
    : '';
  alert(`Collected ${records.length} crystal${records.length === 1 ? '' : 's'}.${speciesNote}`);
  return records.length;
}

// Per-mode wrappers — gather the right meta (matches each mode's
// existing per-crystal collectFromX helper) and refresh that mode's
// inventory after the batch lands.
function collectAllFromLegends() {
  if (!legendsSim) return;
  const scenario = (document.getElementById('scenario') as HTMLSelectElement | null)?.value;
  const seedInputEl = document.getElementById('seed') as HTMLInputElement | null;
  const seed = seedInputEl?.value ? parseInt(seedInputEl.value, 10) : null;
  const meta = { mode: 'simulation', scenario, seed };
  if (collectAllCrystals(legendsSim.crystals, () => meta) > 0) {
    updateLegendsInventory(legendsSim);
  }
}
function collectAllFromFortress() {
  if (!fortressSim) return;
  const meta = { mode: 'creative' };
  if (collectAllCrystals(fortressSim.crystals, () => meta) > 0) {
    updateFortressInventory();
  }
}
function collectAllFromRandom() {
  if (!randomSim) return;
  const meta = { mode: 'random', archetype: randomSimArchetype, seed: randomSimSeed };
  if (collectAllCrystals(randomSim.crystals, () => meta) > 0) {
    renderRandomInventory();
  }
}

// Zen mode (idle) bulk collect. Differs from the three above in that
// idle has no crystal-inventory panel to refresh — its crystals funnel
// to the Record Player at idleFinish time and the on-screen UI is the
// pie + chart + log, not per-crystal cards. So the only post-collect
// refresh needed is the idle-collect-all-btn state (count goes to 0)
// + the standard library/title-load surfaces handled by
// collectAllCrystals.
function collectAllFromIdle() {
  if (typeof idleSim === 'undefined' || !idleSim) return;
  const scenarioEl = document.getElementById('idle-scenario') as HTMLSelectElement | null;
  const scenario = scenarioEl ? scenarioEl.value : null;
  // 'random' is the idle-scenario picker's default value — keep that
  // distinction in the meta so the Library shows "Zen random" vs the
  // specific-scenario rollups separately.
  const meta = { mode: 'zen', scenario };
  if (collectAllCrystals(idleSim.crystals, () => meta) > 0) {
    if (typeof idleRefreshCollectAllBtn === 'function') idleRefreshCollectAllBtn();
  }
}

