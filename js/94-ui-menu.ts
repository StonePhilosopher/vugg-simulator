// ============================================================
// js/94-ui-menu.ts — UI — New Game menu + Scenarios picker
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// MENU PAGES — New Game menu + Scenarios picker
// ============================================================

// === HELIX-OVERLAY-FORK ADDITION (strip view v154+, 2026-05-26) =====
// Helper to attach a StripRecorder to any sim (Fortress lifecycle).
// Generous initial allocation (500 steps) since Fortress sessions
// can run long; the recorder _growCapacity() handles overflow if
// the player goes past that.
function _attachStripRecorderToSim(sim: any, scenarioId: string, notes: string): void {
  if (!sim || typeof StripRecorder !== 'function') return;
  try {
    sim._stripRecorder = new StripRecorder(sim, {
      duration_steps: 500,
      notes,
    });
    const m = sim._stripRecorder.getManifest();
    if (m) m.scenario_id = String(scenarioId || 'unknown');
  } catch (_e) { /* strip view is optional */ }
}

// Finalize + save a sim's recorder to IndexedDB. Called on mode-leave.
function _saveStripRecorderIfPresent(sim: any): void {
  if (!sim || !sim._stripRecorder) return;
  try {
    const dataset = sim._stripRecorder.finalize();
    sim._stripRecorder = null; // prevent double-save
    if (typeof stripStorageSave === 'function' && typeof stripStorageAvailable === 'function' && stripStorageAvailable()) {
      // Only save if at least one step was captured. Don't pollute the
      // dataset list with empty recordings (user clicked into Fortress
      // and immediately left without doing anything).
      if (dataset.manifest.duration_steps > 0) {
        stripStorageSave(dataset).catch(() => { /* silent */ });
      }
    }
  } catch (_e) { /* silent */ }
}
// === END HELIX-OVERLAY-FORK ADDITION ==================================

function hideAllMenuAndModePanels() {
  const ids = [
    'title-screen', 'new-game-panel', 'scenarios-panel',
    'legends-controls', 'output-container',
    'fortress-panel', 'groove-panel', 'idle-panel',
    'library-panel', 'random-panel', 'saves-panel',
    'topo-panel',
    // HELIX-OVERLAY-FORK ADDITION (v153): strip view mode panel.
    'strip-view-mode-panel',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  const modeToggle = document.getElementById('mode-toggle');
  if (modeToggle) modeToggle.style.display = 'none';
  // Stop any replay timer — the canvas is about to be hidden.
  // v67-scrub: route through topoReplayStop so the bar + overlay also
  // hide cleanly. Falls back to the legacy clearInterval path if the
  // function isn't yet defined (stub-bundle test environments).
  if (typeof topoReplayStop === 'function') {
    topoReplayStop();
  } else if (typeof _topoPlaybackTimer !== 'undefined' && _topoPlaybackTimer) {
    clearInterval(_topoPlaybackTimer);
    _topoPlaybackTimer = null;
    const btn = document.getElementById('topo-replay-btn');
    if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
  }
}

function openNewGameMenu() {
  hideAllMenuAndModePanels();
  document.body.classList.add('title-on');
  const panel = document.getElementById('new-game-panel');
  if (panel) panel.style.display = 'block';
  idleStop();
  refreshTitleLoadButton();
  // Still a title-family screen → title theme keeps playing (no restart:
  // 08-music only swaps src on a real track change).
  if (typeof musicSetContext === 'function') musicSetContext('title');
}

function openScenariosPicker() {
  hideAllMenuAndModePanels();
  document.body.classList.add('title-on');
  const panel = document.getElementById('scenarios-panel');
  if (panel) panel.style.display = 'block';
  idleStop();
  if (typeof musicSetContext === 'function') musicSetContext('title');
}

// Router for the New Game menu's non-scenario buttons.
function menuGo(modeName) { switchMode(modeName); }

// Take a SCENARIOS[name] entry and run it inside Creative/Fortress so the
// player steps through it interactively; events fire on their scheduled
// step numbers as the sim advances. Optional seed threads through to the
// seed-first begin (2026-07-08) — callers like the agent API get fully
// deterministic runs, wall geometry included.
function startScenarioInCreative(scenarioName, seedOverride?) {
  const make = SCENARIOS[scenarioName];
  if (!make) { alert('Unknown scenario: ' + scenarioName); return; }
  switchMode('fortress');
  fortressBeginFromScenario(scenarioName, seedOverride);
}

// Take a FLUID_PRESETS[id] starter fluid and run it inside Creative as a
// no-event sim. The starter fluid represents what would naturally leak
// from the host rock; the player perturbs it via in-game actions
// (Heat / Cool / Inject / Tectonic). No scripted events fire.
function startStarterFluidInCreative(presetId) {
  const preset = FLUID_PRESETS[presetId];
  if (!preset) { alert('Unknown starter fluid: ' + presetId); return; }
  switchMode('fortress');
  fortressBeginFromStarterFluid(presetId);
}

// Parallel to fortressBeginFromScenario but uses a FLUID_PRESETS entry
// rather than a full scenario. Defaults T/P/wall to mid-range generics
// since starter fluids don't carry that metadata. Player can intervene
// from step 1.
//
// seedOverride (save system, 93a): replaying a save re-enters here with
// the run's original seed. The rng is installed BEFORE construction and
// the wall's shape_seed derives from the same seed — one number now
// reproduces the whole run, geometry included (the seed-first order
// legends uses; 99z's startScenario comment documents why seeding after
// construction leaves wall geometry unreproducible).
function fortressBeginFromStarterFluid(presetId, seedOverride?) {
  const preset = FLUID_PRESETS[presetId];
  if (!preset) return;

  const seed = (seedOverride != null) ? (seedOverride >>> 0) : (Date.now() >>> 0);
  rng = new SeededRandom(seed);

  const fluid = new FluidChemistry(Object.assign({}, preset.fluid));
  // Generic mid-range conditions — see Creative-mode rework backlog item
  // for surfacing T/P/wall as starter-fluid-level controls.
  const wall = new VugWall({
    composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
    wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
    primary_bubbles: 3, secondary_bubbles: 5, shape_seed: seed & 0xff
  });
  const conditions = new VugConditions({
    temperature: 200.0, pressure: 1.0, fluid, wall
  });

  fortressSim = new VugSimulator(conditions, []);
  _attachStripRecorderToSim(fortressSim, `fortress_starter_${presetId}`, `Fortress — starter fluid: ${preset.label}`);
  fortressActive = true;
  fortressLogLines = [];

  document.getElementById('fortress-setup').style.display = 'none';
  document.getElementById('fortress-status').style.display = 'block';
  document.getElementById('fortress-actions').style.display = 'block';
  const main = document.getElementById('fortress-main');
  main.style.display = 'flex';

  const logEl = document.getElementById('fortress-log');
  logEl.innerHTML = '';
  const initLines = [
    `🏰 Creative Mode — Starter Fluid: ${preset.label}`,
    `   Temperature: 200°C | Pressure: 1.00 kbar | pH: ${conditions.fluid.pH.toFixed(1)}`,
    `   Fluid: ${conditions.fluid.describe()}`,
    `   ${preset.desc}`,
    `   No scripted events — only your actions + ambient drift will shape this vug.`,
    '═'.repeat(60), '',
    'Advance with Wait. Intervene with Heat/Cool/Inject/Tectonic/etc. at any time.'
  ];
  initLines.forEach(line => {
    fortressLogLines.push(line);
    appendFortressLine(logEl, line);
  });

  updateFortressStatus();
  updateFortressInventory();
  if (typeof syncBrothSliders === 'function') syncBrothSliders();
  // Autosave opens AFTER the slider sync (broth baseline = what the
  // first action will see). See 93a-ui-saves.ts.
  if (typeof _saveNoteBegin === 'function') {
    _saveNoteBegin({ type: 'starter', presetId, seed });
  }
}

// Parallel to fortressBegin() but uses a scenario's conditions + events
// instead of the setup sliders. The sim is pre-wired with events so they
// fire automatically on Wait/Heat/Cool/etc. advances.
//
// seedOverride (save system, 93a): replaying a save re-enters here with
// the run's original seed. The rng is seeded BEFORE make() — the same
// order legends' runSimulation uses (91:87→117), which the seed-42
// baselines prove reproduces a run from the seed alone. Seeding after
// make() (the pre-save-system order) left anything the factory drew
// unreproducible.
function fortressBeginFromScenario(scenarioName, seedOverride?) {
  const make = SCENARIOS[scenarioName];
  if (!make) return;

  const seed = (seedOverride != null) ? (seedOverride >>> 0) : (Date.now() >>> 0);
  rng = new SeededRandom(seed);
  const { conditions, events, defaultSteps } = make();

  fortressSim = new VugSimulator(conditions, events);
  _attachStripRecorderToSim(fortressSim, `fortress_${scenarioName}`, `Fortress — scenario: ${scenarioName}`);
  fortressActive = true;
  fortressLogLines = [];

  document.getElementById('fortress-setup').style.display = 'none';
  document.getElementById('fortress-status').style.display = 'block';
  document.getElementById('fortress-actions').style.display = 'block';
  const main = document.getElementById('fortress-main');
  main.style.display = 'flex';

  const prettyName = scenarioName.replace(/_/g, ' ');
  const logEl = document.getElementById('fortress-log');
  logEl.innerHTML = '';
  const initLines = [
    `🏰 Creative Mode — Scenario: ${prettyName}`,
    `   Temperature: ${conditions.temperature.toFixed(0)}°C | Pressure: ${conditions.pressure.toFixed(2)} kbar | pH: ${conditions.fluid.pH.toFixed(1)}`,
    `   Fluid: ${conditions.fluid.describe()}`,
  ];
  if (events && events.length) {
    initLines.push(`   Events scheduled (will fire as you advance steps):`);
    for (const ev of events) {
      initLines.push(`     Step ${ev.step}: ${ev.name}${ev.description ? ' — ' + ev.description : ''}`);
    }
  } else {
    initLines.push(`   No scripted events — only your actions + ambient drift will shape this vug.`);
  }
  initLines.push('═'.repeat(60), '', 'Advance with Wait. Intervene with Heat/Cool/Inject/Tectonic/etc. at any time.');
  initLines.forEach(line => {
    fortressLogLines.push(line);
    appendFortressLine(logEl, line);
  });

  updateFortressStatus();
  updateFortressInventory();
  if (typeof syncBrothSliders === 'function') syncBrothSliders();
  // Autosave opens AFTER the slider sync (broth baseline = what the
  // first action will see). See 93a-ui-saves.ts.
  if (typeof _saveNoteBegin === 'function') {
    _saveNoteBegin({ type: 'scenario', scenario: scenarioName, seed });
  }
}

// Title screen button handlers.
function titleNewGame() {
  // Opens the intermediate menu: Scenarios / Creative / Simulation /
  // Zen Mode / Home.
  openNewGameMenu();
}
function titleQuickPlay() {
  // Quick Play reroute (2026-05-23 — boss design decision): instead of
  // launching a Random Vugg in random mode, pick a random non-tutorial
  // scenario from the Simulation dropdown and auto-start it via the
  // standard runSimulation Grow flow. The user lands directly in
  // Simulation mode with a scenario already running, no menu detour.
  //
  // The dropdown is the canonical list of "what's playable in legends" —
  // pick from it rather than from SCENARIOS so any drift between the
  // dropdown and the SCENARIOS map (e.g. a scenario registered in
  // data/scenarios.json5 but not yet wired into the HTML <select>)
  // can't leave us pointing at an option the dropdown doesn't have.
  //
  // Random mode internals (runRandomVugg, randomSim, the random-panel
  // UI, collectFromRandom + collectAllFromRandom) are intentionally
  // kept in place — they still work for the agent API + any future
  // re-entry point. The menu UI just stops surfacing them.
  switchMode('legends');
  const scenarioEl = document.getElementById('scenario') as HTMLSelectElement | null;
  if (!scenarioEl) return; // fail open — user is in legends, can pick manually
  const options = Array.from(scenarioEl.options)
    .map(o => o.value)
    .filter(v => v && !v.startsWith('tutorial_'));
  if (!options.length) return;
  const pick = options[Math.floor(Math.random() * options.length)];
  scenarioEl.value = pick;
  // Clear any prior seed so runSimulation auto-generates a fresh one —
  // each Quick Play click should produce a different specimen.
  const seedEl = document.getElementById('seed') as HTMLInputElement | null;
  if (seedEl) seedEl.value = '';
  if (typeof runSimulation === 'function') {
    try { runSimulation(); }
    catch (e) { console.error('Quick Play failed to start simulation:', e); }
  }
}
function titleLoadGame() {
  // With the save system live (2026-07-08), Load Game means the Saves
  // menu whenever actual game saves exist. Falls back to the Library
  // (the collection) — the pre-save-system meaning — so a collector
  // with no saves still lands somewhere true.
  try {
    if (typeof loadSaves === 'function' && loadSaves().length > 0) {
      switchMode('saves');
      return;
    }
  } catch (_e) { /* localStorage unavailable */ }
  switchMode('library');
}

// §10.5 tranche 1 (2026-07-07): the legends quick-play dropdown
// AUTO-GENERATES from SCENARIOS at scenarios-load-complete (called
// from _loadScenariosJSON5 in 70-events.ts). The hand-maintained
// <option> list was already raw scenario ids in key order — the one
// §10.5 surface where auto-generation loses no curation. Rules:
// scenarios.json5 key order (so 'cooling' stays the default first
// entry), tutorial_-prefixed ids EXCLUDED (boss directive 2026-05-20:
// tutorials don't belong in quick play — guided versions live in the
// Begin menu, sandbox broths in the Scenarios picker). The picker
// panel, zen dropdown, and Begin tutorial buttons keep their CURATED
// hand-written labels — migrating those is tranches 2-3 (BACKLOG).
// The guard test asserts the static select stays EMPTY so a
// hand-added option can't silently fight this populator.
function _populateScenarioDropdowns() {
  const sel = document.getElementById('scenario') as HTMLSelectElement | null;
  if (!sel || typeof SCENARIOS === 'undefined') return;
  const prev = sel.value;
  sel.innerHTML = '';
  for (const id of Object.keys(SCENARIOS)) {
    if (id.startsWith('tutorial_')) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    sel.appendChild(opt);
  }
  // A re-run (hot reload, future re-fetch) keeps the user's selection.
  if (prev && SCENARIOS[prev] && !prev.startsWith('tutorial_')) sel.value = prev;
}

// §10.5 tranches 2-3 (Door 3, 2026-07-10): the three CURATED menu surfaces
// that tranche 1 left hand-written — the Scenarios picker panel, the
// Zen-mode dropdown, and the Begin tutorial buttons — now generate from
// data/scenarios.json5's `menu_layout` (exposed as MENU_LAYOUT by
// _loadScenariosJSON5 in 70-events.ts). The former static HTML ships as
// empty containers (#scenarios-panel-groups, #idle-scenario,
// #begin-tutorial-buttons). menu_layout was extracted VERBATIM from the
// old hardcoded menus, so text + order are byte-identical; the generators
// only move the source of truth from HTML into data. Adding a scenario now
// means one edit to menu_layout instead of three hand-synced HTML surfaces
// (the chronic-bug class that once hid 15 scenarios — see the v116 guard).
// Buttons keep inline onclick strings (matching the app-wide idiom + the
// old markup) so behaviour is identical to the hand-written buttons.
function _mkMenuButton(onclickCall: string, text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.setAttribute('onclick', onclickCall);
  b.textContent = text;
  return b;
}

// Surface (a): the full Scenarios picker — grouped buttons (real-locality,
// test, tutorial broths, starter fluids). Includes tutorials (the picker is
// the FULL list). Starter fluids route to startStarterFluidInCreative.
function _populateScenariosPanel() {
  const host = document.getElementById('scenarios-panel-groups');
  if (!host || typeof MENU_LAYOUT === 'undefined' || !MENU_LAYOUT || !MENU_LAYOUT.panel) return;
  host.innerHTML = '';
  for (const group of MENU_LAYOUT.panel) {
    const sub = document.createElement('div');
    sub.className = 'menu-subheading';
    sub.textContent = group.heading;
    host.appendChild(sub);
    const btns = document.createElement('div');
    btns.className = 'menu-buttons';
    if (group.fluids) {
      for (const f of group.fluids) {
        btns.appendChild(_mkMenuButton(`startStarterFluidInCreative('${f.preset}')`, f.text));
      }
    } else {
      for (const b of (group.buttons || [])) {
        btns.appendChild(_mkMenuButton(`startScenarioInCreative('${b.scenario}')`, b.text));
      }
    }
    host.appendChild(btns);
  }
}

// Surface (c): the Zen-mode dropdown — curated short labels in a bespoke
// (not alphabetical) order, EXCLUDING tutorials. The 'random' head option
// rides in the data as {value:'random'}. Mirrors _populateScenarioDropdowns'
// selection-preserving re-run behaviour.
function _populateIdleScenarioDropdown() {
  const sel = document.getElementById('idle-scenario') as HTMLSelectElement | null;
  if (!sel || typeof MENU_LAYOUT === 'undefined' || !MENU_LAYOUT || !MENU_LAYOUT.idle) return;
  const prev = sel.value;
  sel.innerHTML = '';
  for (const o of MENU_LAYOUT.idle) {
    const opt = document.createElement('option');
    opt.value = o.value || o.scenario;
    opt.textContent = o.text;
    sel.appendChild(opt);
  }
  if (prev && Array.from(sel.options).some(op => op.value === prev)) sel.value = prev;
}

// The Begin menu's guided-tutorial buttons (Tutorials 1–5). These route to
// startTutorial (the overlay-driven guided run), not the sandbox broths in
// the picker. Order + labels carry the tutorial numbering.
function _populateBeginTutorials() {
  const host = document.getElementById('begin-tutorial-buttons');
  if (!host || typeof MENU_LAYOUT === 'undefined' || !MENU_LAYOUT || !MENU_LAYOUT.begin_tutorials) return;
  host.innerHTML = '';
  for (const t of MENU_LAYOUT.begin_tutorials) {
    host.appendChild(_mkMenuButton(`startTutorial('${t.scenario}')`, t.text));
  }
}

// The last "playable" mode the user was in. Used by the Current Game
// nav button so it can return the player to their in-progress vugg
// (or their just-finished narrated result) from Record Player /
// Library. Cleared when the user goes Home.
let currentGameMode = null;
const GAME_MODES = ['legends', 'fortress', 'idle', 'random'];

function switchMode(mode) {
  // Music routing (js/08-music.ts): every mode is a BUILDING room
  // (salt-circuit.mp3 looping) EXCEPT Strip View, which is silent —
  // the sonifier owns that room. Moving between building modes does
  // not restart the song (08-music swaps src only on track change).
  if (typeof musicSetContext === 'function') {
    musicSetContext(mode === 'stripview' ? 'silent' : 'building');
  }
  const titleScreen = document.getElementById('title-screen');
  const modeToggle = document.getElementById('mode-toggle');
  const legendsControls = document.getElementById('legends-controls');
  const outputContainer = document.getElementById('output-container');
  const fortressPanel = document.getElementById('fortress-panel');
  const groovePanel = document.getElementById('groove-panel');
  const idlePanel = document.getElementById('idle-panel');
  const libraryPanel = document.getElementById('library-panel');
  const modeCurrent = document.getElementById('mode-current');
  const modeGroove = document.getElementById('mode-groove');
  const modeLibrary = document.getElementById('mode-library');
  const modeSaves = document.getElementById('mode-saves');
  // HELIX-OVERLAY-FORK ADDITION (v153): strip view as a proper mode.
  const modeStripView = document.getElementById('mode-stripview');
  const stripViewModePanel = document.getElementById('strip-view-mode-panel');

  // Pause background activity before leaving it.
  if (mode !== 'idle' && idleRunning && !idlePaused && typeof idleTogglePause === 'function') {
    idleTogglePause();
  }
  if (mode !== 'groove' && groovePlaying && typeof grooveStop === 'function') {
    grooveStop();
  }
  // Switching modes while a tutorial is running tears down the overlay
  // + restores controls — UNLESS the tutorial sanctions the switch
  // (engine v3: its home mode, or the current step's allowModes — how
  // the collecting tour walks Simulation → Library alive). With no
  // tutorial running this is the legacy no-op path.
  if (typeof _tutorialAllowsMode === 'function'
      ? !_tutorialAllowsMode(mode)
      : (mode !== 'fortress')) {
    if (typeof endTutorial === 'function') endTutorial();
  }
  // HELIX-OVERLAY-FORK ADDITION (strip view v154+): leaving Fortress
  // with an attached recorder → finalize + save the dataset. Fortress
  // sessions are interactive (no fixed run end), so this is the
  // natural save point. Idempotent: the helper nulls _stripRecorder
  // after save so re-leaves don't double-save.
  if (mode !== 'fortress' && typeof fortressSim !== 'undefined' && fortressSim) {
    _saveStripRecorderIfPresent(fortressSim);
  }
  // HELIX-OVERLAY-FORK ADDITION (strip view v155+): same pattern for
  // Zen mode (idleSim). Idempotent. Won't save empty recordings.
  if (mode !== 'idle' && typeof idleSim !== 'undefined' && idleSim) {
    _saveStripRecorderIfPresent(idleSim);
  }
  // Save system (93a): leaving Fortress writes the rolling autosave
  // through one more time (catches broth-only changes made since the
  // last action). No-op when nothing is recording.
  if (mode !== 'fortress' && typeof _savePersistActive === 'function') {
    _savePersistActive();
  }

  // Hide title screen, show mode toggle
  document.body.classList.remove('title-on');
  titleScreen.style.display = 'none';
  modeToggle.style.display = 'flex';

  legendsControls.style.display = 'none';
  outputContainer.style.display = 'none';
  fortressPanel.style.display = 'none';
  groovePanel.style.display = 'none';
  if (idlePanel) idlePanel.style.display = 'none';
  if (libraryPanel) libraryPanel.style.display = 'none';
  const randomPanel = document.getElementById('random-panel');
  if (randomPanel) randomPanel.style.display = 'none';
  const topoPanel = document.getElementById('topo-panel');
  if (topoPanel) topoPanel.style.display = 'none';
  // Stop any topo replay in flight — the canvas is about to be hidden.
  // v67-scrub: same routing change as the other call site above —
  // topoReplayStop tears down the bar + overlay too.
  if (typeof topoReplayStop === 'function') {
    topoReplayStop();
  } else if (_topoPlaybackTimer) {
    clearInterval(_topoPlaybackTimer);
    _topoPlaybackTimer = null;
    const replayBtn = document.getElementById('topo-replay-btn');
    if (replayBtn) { replayBtn.textContent = '▶'; replayBtn.classList.remove('playing'); }
  }
  const newGamePanel = document.getElementById('new-game-panel');
  if (newGamePanel) newGamePanel.style.display = 'none';
  const scenariosPanel = document.getElementById('scenarios-panel');
  if (scenariosPanel) scenariosPanel.style.display = 'none';
  if (modeCurrent) modeCurrent.classList.remove('active');
  if (modeGroove) modeGroove.classList.remove('active');
  if (modeLibrary) modeLibrary.classList.remove('active');
  if (modeSaves) modeSaves.classList.remove('active');
  if (modeStripView) modeStripView.classList.remove('active');
  if (stripViewModePanel) stripViewModePanel.style.display = 'none';
  const savesPanel = document.getElementById('saves-panel');
  if (savesPanel) savesPanel.style.display = 'none';

  if (mode === 'legends') {
    legendsControls.style.display = 'flex';
    outputContainer.style.display = 'block';
    timeScale = 5.0; // ~50,000 years per step
  } else if (mode === 'fortress') {
    fortressPanel.style.display = 'block';
    timeScale = 5.0; // ~50,000 years per step
  } else if (mode === 'groove') {
    groovePanel.style.display = 'block';
    if (modeGroove) modeGroove.classList.add('active');
    groovePopulateCrystals();
    timeScale = 1.0; // ~10,000 years per step (real-time geological pace)
  } else if (mode === 'idle') {
    if (idlePanel) idlePanel.style.display = 'block';
    timeScale = 1.0; // ~10,000 years per step
    idleInit();
  } else if (mode === 'library') {
    if (libraryPanel) libraryPanel.style.display = 'flex';
    if (modeLibrary) modeLibrary.classList.add('active');
    libraryInit();
  } else if (mode === 'saves') {
    // Save menu (93a-ui-saves.ts, 2026-07-08). A shelf like the
    // Library: manual saves + autosaves + the lifetime counters.
    if (savesPanel) savesPanel.style.display = 'flex';
    if (modeSaves) modeSaves.classList.add('active');
    if (typeof savesRender === 'function') savesRender();
  } else if (mode === 'random') {
    const rp = document.getElementById('random-panel');
    if (rp) rp.style.display = 'block';
    timeScale = 5.0;
  } else if (mode === 'stripview') {
    // HELIX-OVERLAY-FORK ADDITION (v153): Strip View mode. Mirrors
    // Record Player ('groove') — own full-page panel that's loaded
    // post-hoc. Doesn't bind to a sim; just paints the dataset list
    // and lets the user pick one to view.
    //
    // BUG FIX (boss-reported 2026-05-27): use display 'flex' not
    // 'block'. .strip-view-mode-panel CSS sets display: flex +
    // flex-direction: column + max-height: calc(100vh - 80px) so
    // the inner .strip-view-body (flex: 1; overflow: auto) gets a
    // constrained height and scrolls. Inline display:block overrode
    // the flex layout — body had no height bound, grew with content,
    // panel exceeded viewport and the scroll bar disappeared.
    if (stripViewModePanel) stripViewModePanel.style.display = 'flex';
    if (modeStripView) modeStripView.classList.add('active');
    if (typeof (window as any).stripViewModeShow === 'function') {
      (window as any).stripViewModeShow();
    }
  }

  // Remember the active game so the Current Game nav button can
  // return the player here from Record Player / Library.
  if (GAME_MODES.includes(mode)) {
    currentGameMode = mode;
    if (modeCurrent) modeCurrent.classList.add('active');
    if (topoPanel) {
      topoPanel.style.display = 'block';
      topoEnsureWired();
      // Draw whatever the active sim has now (may be empty if no run yet).
      if (typeof onSpecReady === 'function') {
        onSpecReady(() => topoRender());
      } else {
        topoRender();
      }
    }
  }

  // Leaving Groove (or opening any non-groove mode) drops any
  // library-loaded stand-in so live-sim crystals show up again
  // next time the user opens the Record Player.
  if (mode !== 'groove' && typeof clearGrooveCollection === 'function') {
    clearGrooveCollection();
  }
}

// Nav handler: return to the active game, or start a Quick Play
// (Random Vugg) if there isn't one.
function goToCurrentGame() {
  if (currentGameMode && GAME_MODES.includes(currentGameMode)) {
    switchMode(currentGameMode);
    return;
  }
  titleQuickPlay();
}

