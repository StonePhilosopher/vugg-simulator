// ============================================================
// js/98a-ui-zen.ts — UI — Zen / Idle mode (the slow groove)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// THE GROOVE — IDLE MODE
// ============================================================

const IDLE_MINERAL_COLORS = {
  quartz: '#e8e8e8', calcite: '#ffd699', fluorite: '#b088dd',
  pyrite: '#c8b830', chalcopyrite: '#c89830', galena: '#a0a0a0',
  hematite: '#b04040', malachite: '#2e8b57', sphalerite: '#cc8844',
  goethite: '#8b6914', uraninite: '#44dd44', smithsonite: '#88bbcc',
  wulfenite: '#ff8833', ferrimolybdite: '#f5dc14', arsenopyrite: '#c8c0b8', scorodite: '#5a9a8a', selenite: '#e8e0d8', barite: '#eb137f', celestine: '#a4c8e0', jarosite: '#dcb43c', alunite: '#f0e0d8', brochantite: '#3a7c4f', antlerite: '#2a6038', anhydrite: '#d8d0c8', feldspar: '#f0d0b0',
  emerald: '#2e8b57', aquamarine: '#7fb8d4', morganite: '#eb6b9e', heliodor: '#eed858',
  corundum: '#c8c8c8', ruby: '#c03030', sapphire: '#304068',
  acanthite: '#404040', argentite: '#303030', native_silver: '#d4d4d4',
  native_arsenic: '#888888', native_sulfur: '#f5d030', native_tellurium: '#b8b8c8',
  nickeline: '#d49080', millerite: '#c8b860', cobaltite: '#d8d4cc',
  descloizite: '#8a3020', mottramite: '#8a9a40',
  raspite: '#d4b840', stolzite: '#d49a30', olivenite: '#5a7030',
  chalcanthite: '#2a40c8',
  rosasite: '#5a8a8e', aurichalcite: '#9ec8c0',  // Round 9a
  torbernite: '#3a8e3a', zeunerite: '#5aa040',   // Round 9b
  carnotite: '#e8d040',                          // Round 9c
  autunite: '#f0e045',                           // Round 9d
  uranospinite: '#e8d850',                       // Round 9e — Ca-As, bright FL
  tyuyamunite: '#e0c838'                         // Round 9e — Ca-V, weak FL
};

const IDLE_SPEED_MAP = [0.5, 1, 2, 5, 10]; // steps per second

// =====================================================================
// Zen Mode (internal name: "idle")
// =====================================================================
// User-visible label is "Zen Mode" (title card + menu button + start
// log line). The `idle*` token is the pre-rename internal name that's
// still spread across DOM IDs (#idle-panel, #idle-chart, #idle-pie,
// #idle-log, #idle-step-counter, #idle-speed-slider), CSS classes
// (.idle-container, .idle-controls), function names (idleTogglePlay,
// idleStep, idleFinish, idleAppendLog, idlePickScenario), and this
// global. Mode switch is `switchMode('idle')` / `menuGo('idle')`. The
// post-game source field also uses 'Zen' (not 'Idle'). Token kept
// stable because the rename happened only at the user-visible surface
// — see commit 467e8c4 and proposals/BACKLOG.md "Internal token
// cleanup" for the deferred thorough rename.
let idleSim = null;
let idleRunning = false;
let idlePaused = false;
let idleAnimFrame = null;
let idleLastTick = 0;
let idleSpeed = 1; // index into IDLE_SPEED_MAP
let idleHistory = []; // array of { step, supersats: { mineral: value }, temp }
let idleMaxHistory = 200;
let idleDrift = { tempTarget: 0, tempRate: 0, driftTimer: 0 };
let idleEvents = []; // active temporary events

function idleInit() {
  // Build legend
  const legendEl = document.getElementById('idle-legend');
  if (legendEl && !legendEl.children.length) {
    for (const [mineral, color] of Object.entries(IDLE_MINERAL_COLORS)) {
      const item = document.createElement('div');
      item.className = 'idle-legend-item';
      item.innerHTML = `<span class="idle-legend-swatch" style="background:${color}"></span>${mineral}`;
      legendEl.appendChild(item);
    }
  }
}

function idleCreateSim(scenarioKey) {
  if (scenarioKey === 'random') {
    const keys = Object.keys(SCENARIOS);
    scenarioKey = keys[Math.floor(Math.random() * keys.length)];
  }
  const scenarioFn = SCENARIOS[scenarioKey];
  if (!scenarioFn) return null;

  // SCENARIOS values are functions — call to get {conditions, events, defaultSteps}
  const scenarioData = scenarioFn();

  rng = new SeededRandom(Date.now());
  // Clone the scenario's conditions for the idle simulation
  const srcCond = scenarioData.conditions;
  const conditions = new VugConditions({
    temperature: srcCond.temperature,
    pressure: srcCond.pressure || 1.0,
    fluid: new FluidChemistry(Object.assign({}, srcCond.fluid)),
    wall: srcCond.wall || new VugWall({ composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50, wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000 })
  });

  const sim = new VugSimulator(conditions, []); // no scripted events — drift handles everything
  idleDrift.tempTarget = srcCond.temperature;
  idleDrift.tempRate = 0;
  idleDrift.driftTimer = 0;
  idleHistory = [];
  idleEvents = [];
  return sim;
}

function idleApplyDrift() {
  if (!idleSim) return;
  const c = idleSim.conditions;

  // Temperature: Brownian walk with mean-reversion
  const meanRevStrength = 0.02;
  const noiseScale = 3.0;
  const noise = (rng.random() - 0.5) * noiseScale * 2;
  const revert = (idleDrift.tempTarget - c.temperature) * meanRevStrength;
  c.temperature += noise + revert;
  c.temperature = Math.max(25, Math.min(600, c.temperature));

  // Fluid chemistry: slow drift on major species
  const species = ['SiO2', 'Ca', 'CO3', 'Fe', 'Mn', 'F', 'Zn', 'S', 'Cu'];
  for (const sp of species) {
    if (c.fluid[sp] === undefined || c.fluid[sp] <= 0) continue;
    const drift = (rng.random() - 0.5) * c.fluid[sp] * 0.03;
    c.fluid[sp] = Math.max(0, c.fluid[sp] + drift);
  }

  // pH drift
  c.fluid.pH += (rng.random() - 0.5) * 0.05;
  c.fluid.pH = Math.max(3.0, Math.min(9.0, c.fluid.pH));

  // Random events (2% chance per step)
  if (rng.random() < 0.02) {
    idleFireRandomEvent();
  }

  // Process active temporary events
  for (let i = idleEvents.length - 1; i >= 0; i--) {
    const evt = idleEvents[i];
    evt.remaining--;
    if (evt.type === 'thermal_pulse') {
      c.temperature += evt.decayRate;
    }
    if (evt.remaining <= 0) idleEvents.splice(i, 1);
  }
}

function idleFireRandomEvent() {
  if (!idleSim) return;
  const c = idleSim.conditions;
  const roll = rng.random();
  const logEl = document.getElementById('idle-log');

  if (roll < 0.25) {
    // Thermal pulse
    const spike = 40 + rng.random() * 80;
    c.temperature += spike;
    c.temperature = Math.min(600, c.temperature);
    const duration = 5 + Math.floor(rng.random() * 10);
    idleEvents.push({ type: 'thermal_pulse', remaining: duration, decayRate: -spike / duration });
    idleAppendLog(logEl, `🔥 THERMAL PULSE — Temperature surges +${spike.toFixed(0)}°C to ${c.temperature.toFixed(0)}°C`, 'log-event');
  } else if (roll < 0.50) {
    // Fluid injection — random species spike
    const targets = ['SiO2', 'Ca', 'CO3', 'Fe', 'Mn', 'Cu', 'Zn', 'S', 'F'];
    const target = targets[Math.floor(rng.random() * targets.length)];
    const multiplier = 2 + rng.random() * 4;
    const oldVal = c.fluid[target] || 0;
    c.fluid[target] = Math.max(c.fluid[target] || 0, 10) * multiplier;
    idleAppendLog(logEl, `💧 FLUID INJECTION — ${target} surges ×${multiplier.toFixed(1)} (${oldVal.toFixed(0)} → ${c.fluid[target].toFixed(0)} ppm)`, 'log-event');
  } else if (roll < 0.70) {
    // Tectonic crack — pH shift + pressure change
    const pHShift = (rng.random() - 0.5) * 1.5;
    c.fluid.pH += pHShift;
    c.fluid.pH = Math.max(3.0, Math.min(9.0, c.fluid.pH));
    c.pressure += (rng.random() - 0.5) * 0.5;
    c.pressure = Math.max(0.1, Math.min(5.0, c.pressure));
    idleAppendLog(logEl, `⚡ TECTONIC CRACK — pH shifts to ${c.fluid.pH.toFixed(1)}, pressure ${c.pressure.toFixed(2)} kbar`, 'log-event');
  } else if (roll < 0.85) {
    // Cooling pulse — meteoric water incursion
    const drop = 30 + rng.random() * 50;
    c.temperature -= drop;
    c.temperature = Math.max(25, c.temperature);
    c.fluid.SiO2 *= 0.6;
    idleAppendLog(logEl, `❄️ METEORIC INCURSION — Temperature drops ${drop.toFixed(0)}°C to ${c.temperature.toFixed(0)}°C`, 'log-event');
  } else {
    // Quiet period — reduce drift for a while
    idleDrift.tempRate = 0;
    idleAppendLog(logEl, `🌙 QUIET PERIOD — system reaches temporary equilibrium`, 'log-event');
  }
}

function idleRecordHistory() {
  if (!idleSim) return;
  const c = idleSim.conditions;
  const supersats: Record<string, number> = {};
  if (typeof c.supersaturation_quartz === 'function') supersats.quartz = c.supersaturation_quartz();
  if (typeof c.supersaturation_calcite === 'function') supersats.calcite = c.supersaturation_calcite();
  if (typeof c.supersaturation_aragonite === 'function') supersats.aragonite = c.supersaturation_aragonite();
  if (typeof c.supersaturation_siderite === 'function') supersats.siderite = c.supersaturation_siderite();
  if (typeof c.supersaturation_rhodochrosite === 'function') supersats.rhodochrosite = c.supersaturation_rhodochrosite();
  if (typeof c.supersaturation_dolomite === 'function') supersats.dolomite = c.supersaturation_dolomite();
  if (typeof c.supersaturation_fluorite === 'function') supersats.fluorite = c.supersaturation_fluorite();
  if (typeof c.supersaturation_pyrite === 'function') supersats.pyrite = c.supersaturation_pyrite();
  if (typeof c.supersaturation_marcasite === 'function') supersats.marcasite = c.supersaturation_marcasite();
  if (typeof c.supersaturation_chalcopyrite === 'function') supersats.chalcopyrite = c.supersaturation_chalcopyrite();
  if (typeof c.supersaturation_hematite === 'function') supersats.hematite = c.supersaturation_hematite();
  if (typeof c.supersaturation_sphalerite === 'function') supersats.sphalerite = c.supersaturation_sphalerite();
  if (typeof c.supersaturation_wurtzite === 'function') supersats.wurtzite = c.supersaturation_wurtzite();
  if (typeof c.supersaturation_galena === 'function') supersats.galena = c.supersaturation_galena();
  // malachite, goethite, smithsonite, wulfenite — check if methods exist
  try { supersats.malachite = c.supersaturation_malachite(); } catch(e) {}
  try { supersats.goethite = c.supersaturation_goethite(); } catch(e) {}
  try { supersats.smithsonite = c.supersaturation_smithsonite(); } catch(e) {}
  try { supersats.wulfenite = c.supersaturation_wulfenite(); } catch(e) {}
  try { supersats.molybdenite = c.supersaturation_molybdenite(); } catch(e) {}
  try { supersats.selenite = c.supersaturation_selenite(); } catch(e) {}
  try { supersats.feldspar = c.supersaturation_feldspar(); } catch(e) {}
  try { supersats.adamite = c.supersaturation_adamite(); } catch(e) {}
  try { supersats.mimetite = c.supersaturation_mimetite(); } catch(e) {}
  try { supersats.erythrite = c.supersaturation_erythrite(); } catch(e) {}
  try { supersats.annabergite = c.supersaturation_annabergite(); } catch(e) {}
  try { supersats.tetrahedrite = c.supersaturation_tetrahedrite(); } catch(e) {}
  try { supersats.tennantite = c.supersaturation_tennantite(); } catch(e) {}
  try { supersats.apophyllite = c.supersaturation_apophyllite(); } catch(e) {}

  idleHistory.push({
    step: idleSim.step,
    supersats,
    temp: c.temperature,
    crystalCount: idleSim.crystals.filter(cr => cr.active).length
  });

  if (idleHistory.length > idleMaxHistory) {
    idleHistory.shift();
  }
}

