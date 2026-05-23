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
function hideAllMenuAndModePanels() {
  const ids = [
    'title-screen', 'new-game-panel', 'scenarios-panel',
    'legends-controls', 'output-container',
    'fortress-panel', 'groove-panel', 'idle-panel',
    'library-panel', 'random-panel',
    'topo-panel',
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
}

function openScenariosPicker() {
  hideAllMenuAndModePanels();
  document.body.classList.add('title-on');
  const panel = document.getElementById('scenarios-panel');
  if (panel) panel.style.display = 'block';
  idleStop();
}

// Router for the New Game menu's non-scenario buttons.
function menuGo(modeName) { switchMode(modeName); }

// Take a SCENARIOS[name] entry and run it inside Creative/Fortress so the
// player steps through it interactively; events fire on their scheduled
// step numbers as the sim advances.
function startScenarioInCreative(scenarioName) {
  const make = SCENARIOS[scenarioName];
  if (!make) { alert('Unknown scenario: ' + scenarioName); return; }
  switchMode('fortress');
  fortressBeginFromScenario(scenarioName);
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
function fortressBeginFromStarterFluid(presetId) {
  const preset = FLUID_PRESETS[presetId];
  if (!preset) return;

  const fluid = new FluidChemistry(Object.assign({}, preset.fluid));
  // Generic mid-range conditions — see Creative-mode rework backlog item
  // for surfacing T/P/wall as starter-fluid-level controls.
  const wall = new VugWall({
    composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
    wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
    primary_bubbles: 3, secondary_bubbles: 5, shape_seed: Date.now() & 0xff
  });
  const conditions = new VugConditions({
    temperature: 200.0, pressure: 1.0, fluid, wall
  });

  rng = new SeededRandom(Date.now());
  fortressSim = new VugSimulator(conditions, []);
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
}

// Parallel to fortressBegin() but uses a scenario's conditions + events
// instead of the setup sliders. The sim is pre-wired with events so they
// fire automatically on Wait/Heat/Cool/etc. advances.
function fortressBeginFromScenario(scenarioName) {
  const make = SCENARIOS[scenarioName];
  if (!make) return;
  const { conditions, events, defaultSteps } = make();

  rng = new SeededRandom(Date.now());
  fortressSim = new VugSimulator(conditions, events);
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
  // Open the Library — that's where the collection lives.
  switchMode('library');
}

// The last "playable" mode the user was in. Used by the Current Game
// nav button so it can return the player to their in-progress vugg
// (or their just-finished narrated result) from Record Player /
// Library. Cleared when the user goes Home.
let currentGameMode = null;
const GAME_MODES = ['legends', 'fortress', 'idle', 'random'];

function switchMode(mode) {
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

  // Pause background activity before leaving it.
  if (mode !== 'idle' && idleRunning && !idlePaused && typeof idleTogglePause === 'function') {
    idleTogglePause();
  }
  if (mode !== 'groove' && groovePlaying && typeof grooveStop === 'function') {
    grooveStop();
  }
  // Switching out of fortress while a tutorial is running tears down
  // the overlay + restores controls. (Tutorials only live in fortress.)
  if (mode !== 'fortress' && typeof endTutorial === 'function') endTutorial();

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
  } else if (mode === 'random') {
    const rp = document.getElementById('random-panel');
    if (rp) rp.style.display = 'block';
    timeScale = 5.0;
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

