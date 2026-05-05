// ============================================================
// js/97-ui-fortress.ts — UI — Fortress (Creative) mode
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// FORTRESS MODE
// ============================================================

// FLUID_PRESETS: starting-fluid recipes shown in the Creative-mode setup
// preset bar AND under "Starter Fluids" in the Scenarios picker. Two
// flavors:
//   * Generic test recipes (silica, carbonate, clean, oxidized_cu) — not
//     anchored to any locality; tuned by feel as broad mineral-class
//     starting points. Edit freely.
//   * Synced-to-scenario recipes (mvt, porphyry, radioactive) — these
//     pull their fluid from the corresponding scenario_* function via
//     getter so they cannot drift. Edit the scenario, the preset
//     follows.
//
// Every preset must declare every FluidChemistry field the scenario
// would set, so the Creative-mode setup sliders see them and can
// over-ride. (Sliders that are blank for a preset's missing field still
// inherit the FluidChemistry constructor default, which is 0 for most
// trace elements — that's the "starter-fluid hidden chemistry" issue
// flagged for the Creative-mode rework backlog.)
function _scenarioFluidParams(scenarioName) {
  const f = SCENARIOS[scenarioName]().conditions.fluid;
  // Spread own enumerable properties of the FluidChemistry instance
  // into a plain object that fortressBegin's Object.assign() can copy.
  return Object.assign({}, f);
}

const FLUID_PRESETS = {
  silica: {
    label: 'Silica-rich',
    desc: 'Test recipe — high silica (600 ppm SiO₂), moderate Ca, low metals. Quartz-dominant growth. Generic; not anchored to a locality.',
    fluid: { SiO2: 600, Ca: 150, CO3: 100, Fe: 8, Mn: 3, Ti: 0.8, Al: 4, F: 10, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 6.5, salinity: 5.0 }
  },
  carbonate: {
    label: 'Carbonate',
    desc: 'Test recipe — Ca-CO₃ rich fluid (Ca 300, CO₃ 250 ppm), moderate Mn. Calcite-dominant. Generic; not anchored to a locality.',
    fluid: { SiO2: 80, Ca: 300, CO3: 250, Fe: 10, Mn: 8, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 8.0 }
  },
  mvt: {
    label: 'MVT Brine (synced to scenario_mvt)',
    desc: 'Mirrors scenario_mvt. Edit the scenario in vugg.py / index.html to change this preset.',
    get fluid() { return _scenarioFluidParams('mvt'); }
  },
  clean: {
    label: 'Clean/Dilute',
    desc: 'Test recipe — low-concentration fluid. Slow growth, high-purity crystals. Near-equilibrium conditions. Generic; not anchored to a locality.',
    fluid: { SiO2: 200, Ca: 80, CO3: 60, Fe: 2, Mn: 1, Ti: 0.1, Al: 1, F: 3, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 2.0 }
  },
  porphyry: {
    label: 'Copper Porphyry (synced to scenario_porphyry)',
    desc: 'Mirrors scenario_porphyry. Edit the scenario to change this preset.',
    get fluid() { return _scenarioFluidParams('porphyry'); }
  },
  oxidized_cu: {
    label: 'Oxidized Copper',
    desc: 'Test recipe — Cu-bearing oxidized fluid (Cu 60, Fe 40, O₂ 1.5), CO₃-rich. Malachite + hematite potential. Low temperature favored. Generic; not anchored to a locality.',
    fluid: { SiO2: 100, Ca: 150, CO3: 200, Fe: 40, Mn: 3, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 5, Cu: 60, O2: 1.5, pH: 6.0, salinity: 5.0 }
  },
  radioactive: {
    label: 'Radioactive Pegmatite (synced to scenario_radioactive_pegmatite)',
    desc: 'Mirrors scenario_radioactive_pegmatite. Edit the scenario to change this preset. ☢️',
    get fluid() { return _scenarioFluidParams('radioactive_pegmatite'); }
  }
};

// =====================================================================
// Creative mode (internal name: "fortress")
// =====================================================================
// User-visible label is "Creative" everywhere (title card, panel heading,
// menu button, post-game source field). The `fortress*` token is a
// pre-rename internal name that's still spread across ~199 sites — CSS
// classes (.fortress-log, .fortress-main, .fortress-setup), DOM IDs
// (#fortress-panel, #fortress-status), function names (fortressBegin,
// fortressStep, fortressFinish), and this global. Token kept stable
// because renaming all 199 occurrences for no UX gain isn't worth the
// churn. If you grep here looking for "fortress" — that's why. The user-
// facing rename happened in commit 467e8c4. See proposals/BACKLOG.md
// "Internal token cleanup" for the deferred thorough rename.
let fortressSim = null;
let fortressActive = false;
let fortressLogLines = [];
let selectedPreset = 'silica';

function selectPreset(preset) {
  selectedPreset = preset;
  document.querySelectorAll('#preset-grid .preset-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.preset === preset);
  });
  document.getElementById('preset-desc').textContent = FLUID_PRESETS[preset].desc;
  // Sync ALL element sliders to preset values
  const f = FLUID_PRESETS[preset].fluid;
  const allElements = [
    'Fe','Mn','Cu','S','U','Pb','Mo','Zn','Mg','Na','K','Ba','Sr','Cr',
    'P','As','Cl','V','W','Ag','Bi','Sb','Ni','Co','B','Li','Be','Te','Se','Ge'
  ];
  const idMap = {
    Fe:'f-fe',Mn:'f-mn',Cu:'f-cu',S:'f-s',U:'f-u',Pb:'f-pb',Mo:'f-mo',
    Zn:'f-zn',Mg:'f-mg',Na:'f-na',K:'f-k',Ba:'f-ba',Sr:'f-sr',Cr:'f-cr',
    P:'f-p',As:'f-as',Cl:'f-cl',V:'f-v',W:'f-w',Ag:'f-ag',Bi:'f-bi',
    Sb:'f-sb',Ni:'f-ni',Co:'f-co',B:'f-b',Li:'f-li',Be:'f-be',
    Te:'f-te',Se:'f-se',Ge:'f-ge'
  };
  for (const el of allElements) {
    const val = f[el] || 0;
    const id = idMap[el];
    const slider = document.getElementById(id);
    if (slider) {
      slider.value = val;
      document.getElementById(id + '-val').textContent = val + ' ppm';
    }
  }
  document.getElementById('f-ph').value = Math.round(f.pH * 10);
  document.getElementById('f-ph-val').textContent = f.pH.toFixed(1);
}

function fortressBegin() {
  const temp = parseFloat(document.getElementById('f-temp').value);
  const pressure = parseFloat(document.getElementById('f-pressure').value) / 10;
  const presetData = FLUID_PRESETS[selectedPreset];
  const fluidParams = Object.assign({}, presetData.fluid);
  // Override with slider values
  // Read all setup sliders — hooked and unhooked alike
  const setupSliders = {
    Fe:'f-fe', Mn:'f-mn', Cu:'f-cu', S:'f-s', U:'f-u', Pb:'f-pb', Mo:'f-mo',
    Zn:'f-zn', Mg:'f-mg', Na:'f-na', K:'f-k', Ba:'f-ba', Sr:'f-sr', Cr:'f-cr',
    P:'f-p', As:'f-as', Cl:'f-cl', V:'f-v', W:'f-w', Ag:'f-ag', Bi:'f-bi',
    Sb:'f-sb', Ni:'f-ni', Co:'f-co', B:'f-b', Li:'f-li', Be:'f-be',
    Te:'f-te', Se:'f-se', Ge:'f-ge'
  };
  for (const [prop, id] of Object.entries(setupSliders)) {
    const el = document.getElementById(id);
    if (el) fluidParams[prop] = parseFloat(el.value);
  }
  fluidParams.pH = parseFloat(document.getElementById('f-ph').value) / 10;
  const fluid = new FluidChemistry(fluidParams);

  // Initialize wall based on preset
  let wallOpts: any = { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50, wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000 };
  if (selectedPreset === 'mvt') {
    wallOpts = { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 40, wall_Fe_ppm: 3000, wall_Mn_ppm: 800, wall_Mg_ppm: 1000 };
  } else if (selectedPreset === 'carbonate') {
    wallOpts = { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 30, wall_Fe_ppm: 1500, wall_Mn_ppm: 600, wall_Mg_ppm: 800 };
  }
  // Read the wall-reactivity slider (Creative-mode only). Range 0-20
  // in slider units → 0.0-2.0× multiplier on dissolution rate.
  // See VugWall.dissolve and VugWall constructor for the full table.
  const wallReactivityEl = document.getElementById('f-wall-reactivity');
  if (wallReactivityEl) {
    wallOpts.reactivity = parseFloat(wallReactivityEl.value) / 10;
  }
  const wall = new VugWall(wallOpts);
  const conditions = new VugConditions({ temperature: temp, pressure, fluid, wall });

  rng = new SeededRandom(Date.now());
  fortressSim = new VugSimulator(conditions, []);
  fortressActive = true;
  fortressLogLines = [];

  // Show active panels, hide setup
  document.getElementById('fortress-setup').style.display = 'none';
  document.getElementById('fortress-status').style.display = 'block';
  document.getElementById('fortress-actions').style.display = 'block';
  const main = document.getElementById('fortress-main');
  main.style.display = 'flex';

  // Initial log
  const logEl = document.getElementById('fortress-log');
  logEl.innerHTML = '';
  const initLines = [
    `🏰 Creative Mode — Your Vug Awaits`,
    `   Temperature: ${temp.toFixed(0)}°C | Pressure: ${pressure.toFixed(1)} kbar`,
    `   Fluid: ${presetData.label} — ${fluid.describe()}`,
    `═`.repeat(60),
    ``,
    `Choose an action to advance one step at a time.`,
  ];
  initLines.forEach(line => {
    fortressLogLines.push(line);
    appendFortressLine(logEl, line);
  });

  updateFortressStatus();
  updateFortressInventory();
  syncBrothSliders();
}

function fortressStep(action) {
  if (!fortressSim || !fortressActive) return;

  const c = fortressSim.conditions;
  let actionDesc = '';

  // Apply action modifications BEFORE running the step
  // Apply current broth slider values to sim state before processing
  // (sliders are live-bound, so this is already done via oninput,
  //  but ensure any manual slider changes are captured)
  if (fortressSim) {
    for (const [key, m] of Object.entries(BROTH_MAP)) {
      const slider = document.getElementById('broth-' + key);
      if (slider) m.set(m.parse(slider.value));
    }
  }

  switch (action) {
    case 'wait':
      actionDesc = '⏳ Waiting — ambient cooling';
      break;
    case 'heat':
      c.temperature += 25;
      c.temperature = Math.min(c.temperature, 600);
      actionDesc = '🔥 Heat +25°C → ' + c.temperature.toFixed(0) + '°C';
      break;
    case 'cool':
      c.temperature -= 25;
      c.temperature = Math.max(c.temperature, 25);
      actionDesc = '❄️ Cool −25°C → ' + c.temperature.toFixed(0) + '°C';
      break;
    case 'silica':
      c.fluid.SiO2 += 400;
      c.fluid.Al += 2;
      c.fluid.Ti += 0.3;
      actionDesc = '🔮 Silica injected — SiO₂ +400 ppm (now ' + c.fluid.SiO2.toFixed(0) + ')';
      break;
    case 'metals':
      c.fluid.Fe += 40;
      c.fluid.Mn += 15;
      actionDesc = '⚙️ Metals injected — Fe +40, Mn +15 ppm';
      break;
    case 'brine':
      c.fluid.Zn += 150;
      c.fluid.S += 120;
      c.temperature -= 10;
      actionDesc = '⚗️ Brine mixed — Zn +150, S +120 ppm, T −10°C (mixing)';
      break;
    case 'fluorine':
      c.fluid.F += 25;
      c.fluid.Ca += 80;
      actionDesc = '💎 Fluorine added — F +25, Ca +80 ppm';
      break;
    case 'copper':
      c.fluid.Cu = 120.0;
      c.fluid.Fe += 40;
      c.fluid.S += 80;
      c.fluid.SiO2 += 200;
      c.fluid.O2 = 0.3;
      c.temperature += 30;
      c.temperature = Math.min(c.temperature, 600);
      c.flow_rate = 4.0;
      actionDesc = `🟠 Copper injection — Cu ${c.fluid.Cu.toFixed(0)} ppm, Fe +40, S +80, reducing. T → ${c.temperature.toFixed(0)}°C`;
      break;
    case 'oxidize':
      c.fluid.O2 = 1.8;
      c.fluid.S *= 0.3;
      c.temperature -= 40;
      c.temperature = Math.max(c.temperature, 25);
      actionDesc = `🟡 Oxidation — O₂ → ${c.fluid.O2.toFixed(1)}, sulfur depleted. T → ${c.temperature.toFixed(0)}°C. Sulfides unstable!`;
      break;
    case 'tectonic':
      c.pressure += 0.5;
      c.temperature += 15;
      // Force twinning check on existing crystals
      for (const crystal of fortressSim.crystals) {
        if (!crystal.twinned && crystal.zones.length > 2 && rng.random() < 0.15) {
          crystal.twinned = true;
          if (crystal.mineral === 'quartz') crystal.twin_law = 'Dauphiné';
          else if (crystal.mineral === 'calcite') crystal.twin_law = 'c-twin {001}';
          else if (crystal.mineral === 'sphalerite') crystal.twin_law = 'spinel-law {111}';
          else if (crystal.mineral === 'fluorite') crystal.twin_law = 'penetration twin {111}';
          else if (crystal.mineral === 'pyrite') crystal.twin_law = 'iron cross {110}';
          else if (crystal.mineral === 'chalcopyrite') crystal.twin_law = 'penetration twin {112}';
          else if (crystal.mineral === 'hematite') crystal.twin_law = 'penetration twin {001}';
          // malachite doesn't twin visibly
        }
      }
      actionDesc = '🌋 Tectonic shock — P +0.5 kbar, T +15°C. Crystals stressed!';
      break;
    case 'flood':
      c.flow_rate = 5.0;
      c.fluid.SiO2 *= 0.6;
      c.fluid.Ca *= 1.3;
      c.fluid.CO3 *= 1.2;
      c.fluid.pH += 0.3;
      actionDesc = '🌊 Flood — fresh fluid pulse, silica diluted, carbonates refreshed';
      break;
    case 'acidify':
      actionDesc = '🧪 ' + event_acidify(c);
      break;
    case 'alkalinize':
      actionDesc = '⚗️ ' + event_alkalinize(c);
      break;
  }

  const logEl = document.getElementById('fortress-log');
  const lines = [];

  if (action === 'wait') {
    // ONLY Wait advances time — all other buttons just modify conditions
    const log = fortressSim.run_step();
    lines.push('');
    lines.push(`── ⏳ Step ${fortressSim.step}`);
    lines.push(fortressSim.format_header());
    if (log.length) {
      for (const l of log) lines.push(l);
    } else {
      lines.push('  (no growth or events this step)');
    }
    updateFortressInventory();
  } else {
    // Non-wait actions: modify conditions but DON'T advance time
    // Log what changed so the player can stack multiple changes
    lines.push(`  ⚙️ ${actionDesc}`);
  }

  lines.forEach(line => {
    fortressLogLines.push(line);
    appendFortressLine(logEl, line);
  });

  logEl.scrollTop = logEl.scrollHeight;
  updateFortressStatus();
  syncBrothSliders();
  if (typeof topoRender === 'function') topoRender();
  // Drive the tutorial state machine after each action. Reads
  // fortressSim.step internally — no-op when no tutorial is active.
  if (typeof _maybeAdvanceTutorial === 'function') _maybeAdvanceTutorial();
}

function appendFortressLine(container, line) {
  const span = document.createElement('div');
  span.textContent = line;
  if (line.includes('🧱')) span.className = 'line-wall';
  else if (line.includes('⚡')) span.className = 'line-event';
  else if (line.includes('✦')) span.className = 'line-nucleation';
  else if (line.includes('═══ Step') || (line.startsWith('═') && line.length > 5)) span.className = 'line-header';
  else if (line.includes('⬇') || line.includes('DISSOLUTION')) span.className = 'line-dissolution';
  container.appendChild(span);
}

function updateFortressStatus() {
  if (!fortressSim) return;
  const c = fortressSim.conditions;

  document.getElementById('f-step-num').textContent = fortressSim.step;
  document.getElementById('f-stat-temp').textContent = c.temperature.toFixed(1) + '°C';
  document.getElementById('f-stat-press').textContent = c.pressure.toFixed(2) + ' kbar';
  document.getElementById('f-stat-ph').textContent = c.fluid.pH.toFixed(1);
  document.getElementById('f-stat-flow').textContent = c.flow_rate.toFixed(1);

  // Show vug diameter when dissolution has occurred
  const vugContainer = document.getElementById('f-stat-vug-container');
  if (c.wall.total_dissolved_mm > 0) {
    vugContainer.style.display = '';
    document.getElementById('f-stat-vug').textContent = `${c.wall.vug_diameter_mm.toFixed(0)}mm (+${c.wall.total_dissolved_mm.toFixed(1)})`;
  } else {
    vugContainer.style.display = 'none';
  }

  // Show radiation dose when uraninite present
  const radContainer = document.getElementById('f-stat-radiation-container');
  if (fortressSim.radiation_dose > 0) {
    radContainer.style.display = '';
    document.getElementById('f-stat-radiation').textContent = `☢️ ${fortressSim.radiation_dose.toFixed(2)}`;
  } else {
    radContainer.style.display = 'none';
  }

  // What each mineral needs to thrive
  function mineralNeeds(name, c) {
    const T = c.temperature, f = c.fluid;
    const clean = n => n.replace(/^[^\w]*/, ''); // strip emoji
    switch (clean(name).toLowerCase()) {
      case 'quartz':
        if (f.SiO2 < 200) return 'more SiO₂';
        if (T > 573) return 'lower temperature (<573°C)';
        return 'higher SiO₂ concentration';
      case 'calcite':
        if (f.Ca < 50) return 'more Ca';
        if (f.CO3 < 30) return 'more CO₃';
        if (f.pH < 5.5) return 'higher pH (less acidic)';
        return 'more Ca + CO₃';
      case 'fluorite':
        if (f.Ca < 30) return 'more Ca';
        if (f.F < 5) return 'more F (fluorine)';
        return 'more Ca + F';
      case 'sphalerite':
        if (f.Zn < 20) return 'more Zn';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Zn + S';
      case 'pyrite':
        if (f.Fe < 5) return 'more Fe';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Fe + S';
      case 'chalcopyrite':
        if (f.Cu < 5) return 'more Cu';
        if (f.Fe < 5) return 'more Fe';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Cu + Fe + S';
      case 'hematite':
        if (f.Fe < 10) return 'more Fe';
        if (f.O2 < 0.3) return 'more O₂ (oxidizing conditions)';
        return 'more Fe + O₂';
      case 'malachite':
        if (f.Cu < 10) return 'more Cu';
        if (f.CO3 < 20) return 'more CO₃';
        if (f.O2 < 0.2) return 'more O₂ (oxidizing conditions)';
        return 'Cu + CO₃ + O₂';
      case 'uraninite':
        if (f.U < 20) return 'more U (uranium)';
        if (T < 200) return 'higher temperature';
        return 'more U';
      case 'galena':
        if (f.Pb < 10) return 'more Pb (lead)';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Pb + S';
      case 'smithsonite':
        if (f.Zn < 10) return 'more Zn';
        if (f.CO3 < 20) return 'more CO₃';
        if (f.O2 < 0.2) return 'O₂ (oxidized Zn environment)';
        return 'Zn + CO₃ + O₂';
      case 'wulfenite':
        if (f.Pb < 10) return 'more Pb (lead)';
        if (f.Mo < 5) return 'more Mo (molybdenum)';
        if (f.O2 < 0.2) return 'more O₂ (oxidizing conditions)';
        if (T > 250) return 'lower temperature (<250°C)';
        return 'Pb + Mo + O₂';
      case 'selenite':
        if (f.Ca < 20) return 'more Ca';
        if (f.S < 10) return 'more S (sulfate)';
        if (f.O2 < 0.3) return 'more O₂ (to convert S²⁻ to SO₄²⁻)';
        if (T > 80) return 'lower temperature (<80°C)';
        return 'Ca + SO₄ + low temperature';
      case 'feldspar':
        if (f.K < 15 && f.Na < 15) return 'more K or Na (alkalis)';
        if (f.Al < 5) return 'more Al (aluminum)';
        if (f.SiO2 < 100) return 'more SiO₂';
        if (T < 150) return 'higher temperature (>150°C)';
        if (T > 800) return 'lower temperature (<800°C)';
        return 'K/Na + Al + SiO₂';
      default:
        return 'different conditions';
    }
  }

  // Supersaturation indicators — auto-derived from MINERAL_SPEC and
  // grouped by mineral class. Every mineral with a
  // `supersaturation_<name>` method on conditions appears under its
  // class's collapsible <details>; classes whose max σ ≥ 1 open
  // automatically so the player sees active supersaturation without
  // clicking. Supersedes the hand-coded 28-mineral list (May 2026):
  // adding a new mineral now auto-populates the panel.
  _renderFortressSigmaGroups(c, document.getElementById('f-sat-bar'));
}

// Display-name overrides preserve the emoji decorations the legacy
// hardcoded list used. Anything not in the map gets `name[0].upper()
// + rest`.
const _SAT_DISPLAY_NAMES = {
  uraninite: '☢️ Uraninite',
  wulfenite: '🟠 Wulfenite',
  selenite: '💎 Selenite',
  feldspar: '🏔️ Feldspar',
  adamite: '💚 Adamite',
  mimetite: '🟡 Mimetite',
};

// Cap the "max σ" badge so the meta line doesn't read as
// "σ max 12345.67". Big σ values are real (Mo can hit double digits
// in Bingham porphyry brines) but past 99 the user just needs to
// know "very super-saturated".
const _SAT_DISPLAY_MAX = 99.99;


function fortressFinish() {
  if (!fortressSim) return;

  const logEl = document.getElementById('fortress-log');
  const summaryLines = fortressSim.format_summary();

  fortressLogLines.push('');
  const sep = document.createElement('div');
  sep.innerHTML = '<br>';
  logEl.appendChild(sep);

  // Render summary with narrative box
  let inNarrative = false;
  let narrativeEl = null;

  for (const line of summaryLines) {
    fortressLogLines.push(line);

    if (line === 'GEOLOGICAL HISTORY') {
      const box = document.createElement('div');
      box.className = 'narrative-box';
      const title = document.createElement('div');
      title.className = 'narrative-title';
      title.textContent = 'GEOLOGICAL HISTORY';
      box.appendChild(title);
      narrativeEl = document.createElement('div');
      box.appendChild(narrativeEl);
      logEl.appendChild(box);
      inNarrative = true;
      continue;
    }

    if (inNarrative && line.startsWith('═'.repeat(10))) {
      inNarrative = false;
      appendFortressLine(logEl, line);
      continue;
    }

    if (inNarrative && line.startsWith('─'.repeat(10))) continue;

    if (inNarrative) {
      const span = document.createElement('div');
      span.textContent = line;
      span.style.marginBottom = line === '' ? '0.5em' : '0';
      narrativeEl.appendChild(span);
      continue;
    }

    appendFortressLine(logEl, line);
  }

  logEl.scrollTop = logEl.scrollHeight;

  // Disable action buttons
  fortressActive = false;
  document.querySelectorAll('.action-grid .action-btn').forEach(btn => btn.disabled = true);
}

function fortressReset() {
  fortressSim = null;
  fortressActive = false;
  fortressLogLines = [];
  brothSnapshots = [];

  // Reset broth panel
  const brothToggle = document.getElementById('broth-toggle');
  const brothBody = document.getElementById('broth-body');
  if (brothToggle) brothToggle.classList.remove('open');
  if (brothBody) brothBody.classList.remove('open');
  // Clear snapshot buttons (keep the 📸 button)
  const snapRow = document.getElementById('broth-snapshots');
  if (snapRow) {
    const firstBtn = snapRow.querySelector('.broth-snapshot-btn');
    snapRow.innerHTML = '';
    if (firstBtn) snapRow.appendChild(firstBtn);
  }

  // Reset UI
  document.getElementById('fortress-setup').style.display = 'block';
  document.getElementById('fortress-status').style.display = 'none';
  document.getElementById('fortress-actions').style.display = 'none';
  document.getElementById('fortress-main').style.display = 'none';
  document.getElementById('fortress-log').innerHTML = '';
  document.getElementById('fortress-inventory').innerHTML = '<h4>💎 Crystal Inventory</h4><div class="inv-empty">No crystals yet. Begin and take actions to grow your vug.</div>';

  // Re-enable action buttons
  document.querySelectorAll('.action-grid .action-btn').forEach(btn => btn.disabled = false);

  // Reset sliders
  document.getElementById('f-temp').value = 300;
  document.getElementById('f-temp-val').textContent = '300°C';
  document.getElementById('f-pressure').value = 15;
  document.getElementById('f-pressure-val').textContent = '1.5 kbar';
  document.getElementById('f-ph').value = 65;
  document.getElementById('f-ph-val').textContent = '6.5';
  selectPreset('silica');
}

function copyFortressLog() {
  const text = fortressLogLines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btns = document.querySelectorAll('.end-btns .btn-copy');
    if (btns.length) {
      const btn = btns[0];
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

