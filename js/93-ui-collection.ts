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

