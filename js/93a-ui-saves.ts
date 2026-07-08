// ============================================================
// js/93a-ui-saves.ts — UI — Game saves (autosave + manual) + lifetime stats
// ============================================================
// SCRIPT-mode TS — top-level decls stay global so cross-file references
// resolve at runtime.
//
// Boss directive 2026-07-08: "saving the game should be automatic. the
// last button should be 'narrate, collect, and save' … a save button
// between library and home … a save menu that has manual saves in
// addition to the autosaves … total crystals collected across all runs
// is a good base stat."
//
// DESIGN — event-sourced saves (the house religion: deterministic replay).
// A save is NOT a snapshot of the sim (grid voxels + ring fluids + rng
// internals would be huge and version-brittle). It is the RECIPE to
// re-grow the run exactly:
//
//   origin   — which begin path (scenario / starter / custom), its
//              resolved params, and the rng seed installed BEFORE any
//              construction (mirrors legends' seed-first order, the
//              order the seed-42 baselines prove deterministic).
//   actions  — every fortressStep verb in order, each with the broth-
//              slider values that differed from the previous action
//              (fortressStep re-applies sliders→sim before dispatch,
//              so slider state at action time IS the complete broth
//              input; see 97-ui-fortress.ts).
//   collected— [crystalIndex, libraryRecordId] pairs so replayed
//              crystals remember they're already in the Library.
//
// Loading replays the actions through the REAL fortressStep path with
// the pacing player in instant mode. Same seed + same actions = the
// same pocket, zone for zone. A save made under an older SIM_VERSION
// still replays — under TODAY'S physics — and the load log says so
// honestly (the rock record shifted; the recipe is what was saved).
//
// The active run keeps ONE rolling autosave record, re-persisted after
// every action — "saving is automatic" means a browser crash costs
// nothing. Finish ("Narrate, Collect & Save") seals it as finished.
// Manual saves are frozen copies taken any time from the Saves menu.
//
// Lifetime stats ('vugg-stats-v1') are a separate tiny record: counters
// that only go UP (deleting a specimen from the Library doesn't un-find
// it). crystals_collected is the boss's named base stat for the future
// scoring system; runs_finished rides along for free.

const SAVES_KEY = 'vugg-saves-v1';
const STATS_KEY = 'vugg-stats-v1';
const SAVE_FORMAT = 1;
// Autosaves beyond this count prune oldest-first (manual saves never
// auto-prune — the player curated those).
const MAX_AUTOSAVES = 8;

// The rolling autosave for the active fortress run (object identity ==
// the persisted record; mutated in place + re-persisted each action).
let _saveActiveRecord = null;
// Last captured broth-slider state — per-action deltas diff against it.
let _saveLastBroth = null;
// True while loadSaveById is replaying a save's action log. Read by
// 97-ui-fortress (skip pacing, skip finish's collect/save/stats) and by
// the recording hooks below (a replay must not re-record itself).
let _fortressReplaying = false;

// Live accessors for bundle-internal bindings — the globalThis copies
// tests-js/setup.ts exports are load-time SNAPSHOTS that go stale the
// moment the bundle reassigns them (the _liveRng precedent). Tests and
// probes read through these instead.
function _liveFortressSim() { return (typeof fortressSim !== 'undefined') ? fortressSim : null; }
function _liveFortressActive() { return (typeof fortressActive !== 'undefined') ? !!fortressActive : false; }
function _liveSaveActiveRecord() { return _saveActiveRecord; }

// ---------- storage ----------

function loadSaves() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('saves parse failed:', e);
    return [];
  }
}
function persistSaves(items) {
  try { localStorage.setItem(SAVES_KEY, JSON.stringify(items)); return true; }
  catch (e) { console.error('saves persist failed:', e); return false; }
}

function loadLifetimeStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      crystals_collected: (parsed && Number.isFinite(parsed.crystals_collected)) ? parsed.crystals_collected : 0,
      runs_finished: (parsed && Number.isFinite(parsed.runs_finished)) ? parsed.runs_finished : 0,
    };
  } catch (e) {
    return { crystals_collected: 0, runs_finished: 0 };
  }
}
// Counters only go up. The Library is an inventory; this is a life list.
function bumpLifetimeStats(delta) {
  const s = loadLifetimeStats();
  if (delta && Number.isFinite(delta.crystals_collected)) s.crystals_collected += Math.max(0, delta.crystals_collected);
  if (delta && Number.isFinite(delta.runs_finished)) s.runs_finished += Math.max(0, delta.runs_finished);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  return s;
}

// ---------- capture helpers ----------

function _saveNewId() {
  return `save-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function _saveOriginLabel(origin) {
  if (!origin) return 'unknown vug';
  if (origin.type === 'scenario') return String(origin.scenario || 'scenario').replace(/_/g, ' ');
  if (origin.type === 'starter') {
    const p = (typeof FLUID_PRESETS !== 'undefined') ? FLUID_PRESETS[origin.presetId] : null;
    return p ? `starter: ${p.label}` : `starter: ${origin.presetId}`;
  }
  return 'custom vug';
}

// Read every broth slider's current string value. Sliders that don't
// exist (or parse non-finite — detached/stub DOM) are skipped: replay
// then skips them too, so both sides of the boundary agree.
function _saveCaptureBroth() {
  const out = {};
  if (typeof BROTH_MAP === 'undefined') return out;
  for (const [key, m] of Object.entries(BROTH_MAP)) {
    const slider = document.getElementById('broth-' + key) as HTMLInputElement | null;
    if (!slider) continue;
    const v = (m as any).parse(slider.value);
    if (Number.isFinite(v)) out[key] = String(slider.value);
  }
  return out;
}

function _saveBrothDelta(now, last) {
  const delta = {};
  for (const [k, v] of Object.entries(now)) {
    if (!last || last[k] !== v) delta[k] = v;
  }
  return delta;
}

// Apply recorded broth values to the SLIDERS ONLY. The sliders are
// transport, not physics: in live play a slider value reaches the sim
// exclusively through fortressStep's pre-action re-sync, and post-sync
// slider values are quantized ECHOES of sim state (toSlider rounds).
// Replay must keep that exact grammar — writing m.set() here would
// quantize state the live run never quantized (caught live: T 178.785
// became 179 when broth_final round-tripped through the temp slider).
function _saveApplyBroth(broth) {
  if (!broth || typeof BROTH_MAP === 'undefined') return;
  for (const [key, sv] of Object.entries(broth)) {
    if (!BROTH_MAP[key]) continue;
    const slider = document.getElementById('broth-' + key) as HTMLInputElement | null;
    if (slider) slider.value = sv as string;
  }
}

function _saveSummaryFromSim() {
  if (typeof fortressSim === 'undefined' || !fortressSim) return null;
  const crystals = fortressSim.crystals || [];
  let biggest = 0, biggestMineral = '';
  const minerals = new Set();
  for (const c of crystals) {
    minerals.add(c.mineral);
    if ((c.c_length_mm || 0) > biggest) { biggest = c.c_length_mm; biggestMineral = c.mineral; }
  }
  const cond = fortressSim.conditions;
  return {
    step: fortressSim.step || 0,
    crystals: crystals.length,
    minerals: Array.from(minerals),
    biggest_mm: +biggest.toFixed(2),
    biggest_mineral: biggestMineral,
    temperature: +(cond ? cond.temperature : 0).toFixed(0),
    pH: +(cond && cond.fluid ? cond.fluid.pH : 0).toFixed(1),
  };
}

function _saveCollectedPairs() {
  if (typeof fortressSim === 'undefined' || !fortressSim) return [];
  const out = [];
  (fortressSim.crystals || []).forEach((c, idx) => {
    if (c && c._collectedRecordId) out.push([idx, c._collectedRecordId]);
  });
  return out;
}

// ---------- recording hooks (called from 97/94 via typeof guards) ----------

// A fortress run just began. Create its rolling autosave.
function _saveNoteBegin(origin) {
  if (_fortressReplaying) return; // the replay driver adopts records itself
  _saveActiveRecord = {
    id: _saveNewId(),
    format: SAVE_FORMAT,
    sim_version: (typeof SIM_VERSION !== 'undefined') ? SIM_VERSION : null,
    kind: 'auto',
    status: 'in-progress',
    name: `Autosave — ${_saveOriginLabel(origin)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    origin,
    actions: [],
    broth_final: null,
    collected: [],
    summary: _saveSummaryFromSim(),
  };
  _saveLastBroth = _saveCaptureBroth();
  const items = loadSaves();
  items.push(_saveActiveRecord);
  persistSaves(_savePruneAutosaves(items));
}

// One fortressStep verb is about to dispatch. Record it + the broth
// sliders that changed since the last recorded action.
function _saveRecordAction(action, payload) {
  if (_fortressReplaying || !_saveActiveRecord || _saveActiveRecord.status === 'finished') return;
  const broth = _saveCaptureBroth();
  const delta = _saveBrothDelta(broth, _saveLastBroth);
  _saveLastBroth = broth;
  const entry: any = { a: action };
  if (payload !== undefined && payload !== null) entry.p = payload;
  if (Object.keys(delta).length) entry.b = delta;
  _saveActiveRecord.actions.push(entry);
  _savePersistActive();
}

// Re-snapshot the mutable fields + write through. Cheap enough to run
// per action; also the mode-leave hook (94-ui-menu switchMode).
function _savePersistActive() {
  if (_fortressReplaying || !_saveActiveRecord) return;
  _saveActiveRecord.updated_at = new Date().toISOString();
  _saveActiveRecord.summary = _saveSummaryFromSim() || _saveActiveRecord.summary;
  _saveActiveRecord.broth_final = _saveCaptureBroth();
  _saveActiveRecord.collected = _saveCollectedPairs();
  const items = loadSaves();
  const idx = items.findIndex(s => s.id === _saveActiveRecord.id);
  if (idx >= 0) items[idx] = _saveActiveRecord; else items.push(_saveActiveRecord);
  persistSaves(items);
}

// Narrate, Collect & Save sealed the run. Returns display info for the log.
function _saveMarkFinished() {
  if (_fortressReplaying || !_saveActiveRecord) return null;
  _saveActiveRecord.status = 'finished';
  _savePersistActive();
  const name = _saveActiveRecord.name;
  _saveActiveRecord = null; // run over — nothing more to record
  _saveLastBroth = null;
  persistSaves(_savePruneAutosaves(loadSaves()));
  return { name };
}

// Reset button / replay teardown — drop the recording state. The
// persisted autosave keeps whatever was last written (an abandoned
// in-progress run stays loadable — that's the point of autosave).
function _saveNoteReset() {
  _saveActiveRecord = null;
  _saveLastBroth = null;
}

// Keep the newest MAX_AUTOSAVES autosaves (by updated_at); the active
// record is always exempt. Manual saves pass through untouched.
function _savePruneAutosaves(items) {
  const autos = items.filter(s => s.kind === 'auto' && (!_saveActiveRecord || s.id !== _saveActiveRecord.id));
  if (autos.length <= MAX_AUTOSAVES) return items;
  autos.sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
  const drop = new Set(autos.slice(0, autos.length - MAX_AUTOSAVES).map(s => s.id));
  return items.filter(s => !drop.has(s.id));
}

// ---------- manual save ----------

function _saveManualNamed(name) {
  if (!_saveActiveRecord) return null;
  _savePersistActive(); // freshen summary/broth/collected first
  const copy = JSON.parse(JSON.stringify(_saveActiveRecord));
  copy.id = _saveNewId();
  copy.kind = 'manual';
  copy.name = name;
  copy.created_at = new Date().toISOString();
  copy.updated_at = copy.created_at;
  const items = loadSaves();
  items.push(copy);
  if (!persistSaves(items)) {
    alert('Could not save — localStorage is full or unavailable.');
    return null;
  }
  return copy;
}

function saveManualSave() {
  if (!_saveActiveRecord || typeof fortressSim === 'undefined' || !fortressSim) {
    alert('No active Creative run to save. Begin a run first — it autosaves as you play.');
    return;
  }
  const def = `${_saveOriginLabel(_saveActiveRecord.origin)} — step ${(fortressSim && fortressSim.step) || 0}`;
  const chosen = (typeof prompt === 'function') ? prompt('Name this save:', def) : def;
  if (chosen === null) return; // cancelled
  const rec = _saveManualNamed(String(chosen || '').trim() || def);
  if (rec && typeof savesRender === 'function') savesRender();
}

// ---------- load (deterministic replay) ----------

function _saveRebuildOrigin(origin) {
  if (!origin) throw new Error('save has no origin');
  if (origin.type === 'scenario') {
    if (typeof SCENARIOS === 'undefined' || !SCENARIOS[origin.scenario]) {
      throw new Error(`scenario "${origin.scenario}" is not registered in this build`);
    }
    fortressBeginFromScenario(origin.scenario, origin.seed);
  } else if (origin.type === 'starter') {
    if (typeof FLUID_PRESETS === 'undefined' || !FLUID_PRESETS[origin.presetId]) {
      throw new Error(`starter fluid "${origin.presetId}" is not registered in this build`);
    }
    fortressBeginFromStarterFluid(origin.presetId, origin.seed);
  } else if (origin.type === 'custom') {
    _fortressBeginCustomFromParams(origin.params, origin.seed);
  } else {
    throw new Error(`unknown save origin type "${origin.type}"`);
  }
}

function loadSaveById(id) {
  const rec = loadSaves().find(s => s.id === id);
  if (!rec) return false;
  if (rec.format !== SAVE_FORMAT) {
    alert(`This save uses format v${rec.format}; this build reads v${SAVE_FORMAT}. It can't be restored.`);
    return false;
  }
  // switchMode wires the topo canvases — harmless to skip when it
  // fails (headless drives have no canvas; the replay itself is pure
  // sim + log DOM).
  if (typeof switchMode === 'function') {
    try { switchMode('fortress'); } catch (e) { console.warn('saves: switchMode failed (headless?):', e); }
  }
  if (typeof fortressReset === 'function') fortressReset();

  const priorInstant = (typeof _fortressInstantLines !== 'undefined') ? _fortressInstantLines : false;
  _fortressReplaying = true;
  if (typeof setFortressInstantLines === 'function') setFortressInstantLines(true);
  let ok = false;
  try {
    _saveRebuildOrigin(rec.origin);
    for (const entry of (rec.actions || [])) {
      if (entry.b) _saveApplyBroth(entry.b);
      fortressStep(entry.a, (entry.p !== undefined) ? entry.p : undefined);
    }
    if (rec.broth_final) _saveApplyBroth(rec.broth_final);
    // Re-mark crystals already in the Library (crystal order is
    // deterministic under replay, so index pairing is stable).
    for (const pair of (rec.collected || [])) {
      const c = fortressSim && fortressSim.crystals && fortressSim.crystals[pair[0]];
      if (c) c._collectedRecordId = pair[1];
    }
    if (rec.status === 'finished' && typeof fortressFinish === 'function') {
      fortressFinish(); // re-narrates; collect/save/stats are replay-guarded
    }
    ok = true;
  } catch (e) {
    console.error('save restore failed:', e);
    alert(`Could not restore "${rec.name}" — ${e && (e as any).message ? (e as any).message : e}`);
    if (typeof fortressReset === 'function') fortressReset();
  } finally {
    _fortressReplaying = false;
    if (typeof setFortressInstantLines === 'function') setFortressInstantLines(priorInstant);
  }
  if (!ok) return false;

  // Adopt recording state so continued play keeps autosaving:
  //   in-progress AUTO save   → resume updating that very record.
  //   in-progress MANUAL save → fresh autosave seeded with its history
  //                             (the manual save stays frozen).
  //   finished save           → nothing left to record.
  if (rec.status === 'finished') {
    _saveActiveRecord = null;
    _saveLastBroth = null;
  } else if (rec.kind === 'auto') {
    _saveActiveRecord = rec;
    _saveLastBroth = _saveCaptureBroth();
  } else {
    const copy = JSON.parse(JSON.stringify(rec));
    copy.id = _saveNewId();
    copy.kind = 'auto';
    copy.name = `Autosave — ${_saveOriginLabel(rec.origin)}`;
    _saveActiveRecord = copy;
    _saveLastBroth = _saveCaptureBroth();
    const items = loadSaves();
    items.push(copy);
    persistSaves(_savePruneAutosaves(items));
  }

  // Post-restore housekeeping + an honest log line.
  const logEl = document.getElementById('fortress-log');
  const steps = (typeof fortressSim !== 'undefined' && fortressSim) ? fortressSim.step : 0;
  const lines = [`💾 Restored "${rec.name}" — ${(rec.actions || []).length} actions replayed to step ${steps}.`];
  const nowV = (typeof SIM_VERSION !== 'undefined') ? SIM_VERSION : null;
  if (rec.sim_version != null && nowV != null && rec.sim_version !== nowV) {
    lines.push(`   ⚠️ Saved under SIM v${rec.sim_version}; replayed under today's v${nowV} — the rock record has shifted since, so crystals may differ from what you left.`);
  }
  for (const line of lines) {
    fortressLogLines.push(line);
    if (logEl && typeof appendFortressLine === 'function') appendFortressLine(logEl, line);
  }
  if (typeof updateFortressStatus === 'function') updateFortressStatus();
  if (typeof updateFortressInventory === 'function') updateFortressInventory();
  if (typeof syncBrothSliders === 'function') syncBrothSliders();
  if (typeof topoRender === 'function') { try { topoRender(); } catch (_e) { /* canvas-less env */ } }
  return true;
}

// ---------- save menu panel ----------

function deleteSaveById(id) {
  const rec = loadSaves().find(s => s.id === id);
  if (!rec) return;
  if (typeof confirm === 'function' && !confirm(`Delete save "${rec.name}"?`)) return;
  persistSaves(loadSaves().filter(s => s.id !== id));
  if (_saveActiveRecord && _saveActiveRecord.id === id) _saveNoteReset();
  savesRender();
}

function renameSaveById(id) {
  const items = loadSaves();
  const rec = items.find(s => s.id === id);
  if (!rec) return;
  const next = (typeof prompt === 'function') ? prompt('Rename save:', rec.name) : null;
  if (next === null || next === undefined) return;
  rec.name = String(next).trim() || rec.name;
  persistSaves(items);
  if (_saveActiveRecord && _saveActiveRecord.id === id) _saveActiveRecord.name = rec.name;
  savesRender();
}

function _savesFmtDate(iso) {
  if (!iso) return '';
  // Compact field-note stamp: "2026-07-08 14:32"
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : String(iso);
}

function savesRender() {
  const stats = loadLifetimeStats();
  const statsEl = document.getElementById('saves-stats');
  if (statsEl) {
    statsEl.textContent =
      `💎 ${stats.crystals_collected} crystal${stats.crystals_collected === 1 ? '' : 's'} collected all-time · ` +
      `🏁 ${stats.runs_finished} run${stats.runs_finished === 1 ? '' : 's'} narrated`;
  }
  const manualBtn = document.getElementById('saves-manual-btn') as HTMLButtonElement | null;
  if (manualBtn) {
    const active = !!(_saveActiveRecord && typeof fortressSim !== 'undefined' && fortressSim);
    manualBtn.disabled = !active;
    manualBtn.title = active
      ? 'Freeze a named copy of the current Creative run'
      : 'No active Creative run — begin one; it autosaves as you play';
  }

  const listEl = document.getElementById('saves-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  const items = loadSaves().slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'saves-empty';
    empty.textContent = 'No saves yet — begin a Creative run; it autosaves as you play.';
    listEl.appendChild(empty);
    return;
  }
  for (const rec of items) {
    const row = document.createElement('div');
    row.className = 'save-row';

    const head = document.createElement('div');
    head.className = 'save-row-head';
    const badge = document.createElement('span');
    badge.className = 'save-badge ' + (rec.kind === 'manual' ? 'manual' : 'auto');
    badge.textContent = rec.kind === 'manual' ? 'MANUAL' : 'AUTO';
    const name = document.createElement('span');
    name.className = 'save-name';
    name.textContent = rec.name || '(unnamed)';
    const status = document.createElement('span');
    status.className = 'save-status ' + (rec.status === 'finished' ? 'finished' : 'progress');
    status.textContent = rec.status === 'finished' ? '📜 narrated' : '⏳ in progress';
    if (_saveActiveRecord && rec.id === _saveActiveRecord.id) status.textContent += ' · live';
    head.appendChild(badge);
    head.appendChild(name);
    head.appendChild(status);

    const meta = document.createElement('div');
    meta.className = 'save-row-meta';
    const s = rec.summary || {};
    const parts = [
      `step ${s.step ?? 0}`,
      `${s.crystals ?? 0} crystal${(s.crystals ?? 0) === 1 ? '' : 's'}`,
    ];
    if (s.biggest_mm) parts.push(`biggest ${s.biggest_mm} mm ${s.biggest_mineral || ''}`.trim());
    if (s.temperature != null) parts.push(`${s.temperature}°C`);
    if (s.pH != null) parts.push(`pH ${s.pH}`);
    if (rec.sim_version != null) parts.push(`SIM v${rec.sim_version}`);
    parts.push(_savesFmtDate(rec.updated_at));
    meta.textContent = parts.join(' · ');

    const actions = document.createElement('div');
    actions.className = 'save-row-actions';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.title = 'Re-grow this run from its recipe (seed + actions)';
    loadBtn.onclick = () => loadSaveById(rec.id);
    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => renameSaveById(rec.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteSaveById(rec.id);
    actions.appendChild(loadBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    row.appendChild(head);
    row.appendChild(meta);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
}
