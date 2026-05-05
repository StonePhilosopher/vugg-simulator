// ============================================================
// js/70-events.ts — Event system + EVENT_REGISTRY + scenario loader
// ============================================================
// Event base classes, named event handlers (event_fluid_pulse, event_acidify, …), the EVENT_REGISTRY string-id → handler dict, and the JSON5 scenario loader that reads data/scenarios.json5.
//
// Phase B9 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

// ============================================================
// EVENT SYSTEM
// ============================================================

function event_fluid_pulse(conditions) {
  conditions.fluid.SiO2 *= 1.8;
  conditions.fluid.Fe *= 3.0;
  conditions.fluid.Mn *= 2.5;
  conditions.fluid.pH -= 0.5;
  conditions.flow_rate = 5.0;
  return 'Fresh hydrothermal fluid floods the vug. Silica and metals spike.';
}

function event_cooling_pulse(conditions) {
  conditions.temperature -= 50;
  conditions.fluid.SiO2 *= 0.6;
  conditions.flow_rate = 3.0;
  return `Meteoric water incursion. Temperature drops to ${conditions.temperature.toFixed(0)}°C.`;
}

function event_tectonic_shock(conditions) {
  conditions.pressure += 0.5;
  conditions.temperature += 15;
  return 'Tectonic event. Pressure spike. Crystals may twin.';
}

function event_copper_injection(conditions) {
  conditions.fluid.Cu = 120.0;
  conditions.fluid.Fe += 40.0;
  conditions.fluid.S += 80.0;
  conditions.fluid.SiO2 += 200.0;
  // Drift-fix: Python event also bumps Pb +20 (porphyry fluids carry Pb).
  // Was missing from JS.
  conditions.fluid.Pb += 20.0;
  conditions.fluid.O2 = 0.3;
  conditions.temperature += 30;
  conditions.flow_rate = 4.0;
  return `Copper-bearing magmatic fluid surges into the vug. Cu spikes to ${conditions.fluid.Cu.toFixed(0)} ppm. T rises to ${conditions.temperature.toFixed(0)}°C. Reducing conditions — sulfides stable.`;
}

// Late-stage Mo pulse — separate from Cu in porphyry systems. Per Seo et
// al. 2012 (Bingham Canyon), Mo arrives in a distinct later pulse from Cu.
// This mirror was added to JS in the porphyry chemistry-audit pass — the
// Python equivalent has existed since carbonate round 3.
function event_molybdenum_pulse(conditions) {
  conditions.fluid.Mo = 80.0;
  conditions.fluid.S += 40.0;
  conditions.fluid.O2 = 0.3;
  conditions.temperature += 15;
  return `Late-stage molybdenum fluid arrives separately from Cu. Mo spikes to ${conditions.fluid.Mo.toFixed(0)} ppm. T rises to ${conditions.temperature.toFixed(0)}°C. Molybdenite may form — future wulfenite precursor.`;
}

function event_oxidation(conditions) {
  conditions.fluid.O2 = 1.8;
  // Oxidation converts sulfide (S²⁻) to sulfate (SO₄²⁻) — sulfur doesn't vanish,
  // it changes oxidation state. Some S is consumed by sulfide dissolution,
  // but most stays in solution as sulfate. This is what enables selenite.
  const sulfide_consumed = conditions.fluid.S * 0.3; // 30% consumed by sulfide mineral reactions
  conditions.fluid.S = conditions.fluid.S - sulfide_consumed + (sulfide_consumed * 0.7); // net: keep ~80% as sulfate
  conditions.temperature -= 40;
  return `Oxidizing meteoric water infiltrates. Sulfides becoming unstable — S²⁻ oxidizing to SO₄²⁻. T drops to ${conditions.temperature.toFixed(0)}°C. Sulfate available for gypsum/selenite.`;
}

// v26: tectonic uplift breaches the cavity, fluid drains completely.
function event_tectonic_uplift_drains(conditions) {
  conditions.fluid_surface_ring = 0.0;
  conditions.flow_rate = 0.05;
  return "Tectonic uplift fractures the host rock. The cavity drains completely — fluid pours out through new joints into the rocks below. What was a sealed pocket is now an open cave. Walls dry. Sulfides start to oxidize.";
}

// v26: aquifer recharge / heavy meteoric pulse floods the cavity.
// Sentinel 1e6 is clamped to ring_count by _applyWaterLevelDrift.
function event_aquifer_recharge_floods(conditions) {
  conditions.fluid_surface_ring = 1e6;
  conditions.flow_rate = 2.0;
  return "Heavy meteoric pulse. The cavity floods back to the ceiling. Fluid contact resumes on every wall — previously-oxidized rinds dissolve where they can; fresh sulfide growth starts wherever they can't.";
}

function event_acidify(conditions) {
  conditions.fluid.pH -= 2.0;
  conditions.fluid.pH = Math.max(conditions.fluid.pH, 2.0);
  return `Acidic fluid incursion. pH drops to ${conditions.fluid.pH.toFixed(1)}. Carbonates becoming unstable — calcite may dissolve.`;
}

function event_alkalinize(conditions) {
  conditions.fluid.pH += 2.0;
  conditions.fluid.pH = Math.min(conditions.fluid.pH, 10.0);
  return `Alkaline fluid incursion. pH rises to ${conditions.fluid.pH.toFixed(1)}. Carbonate precipitation favored.`;
}

function event_fluid_mixing(conditions) {
  // Phase-3: sync with vugg.py — F bumped 15→40 (Cave-in-Rock fluid-inclusion
  // data) so fluorite actually crosses σ=1.2. Pb added so galena nucleates.
  conditions.fluid.Zn = 150.0;
  conditions.fluid.S = 120.0;
  conditions.fluid.Ca += 100.0;
  conditions.fluid.F += 40.0;
  conditions.fluid.Pb += 25.0;
  conditions.fluid.Fe += 30.0;
  conditions.temperature -= 20;
  return 'Fluid mixing event. Metal-bearing brine meets sulfur-bearing groundwater. Sphalerite, fluorite, and galena become possible.';
}

// --- Tutorials (May 2026) ---
// See proposals/TUTORIAL-SYSTEM-BUILDER-REVIEW.md for design context.
// Slice 1 (commit 31adc8a): the scenarios + events below run as plain
// scenarios. Slice 2 (THIS commit): callout overlay primitive — generic
// anchored tooltip API surface (window.showCallout / window.hideCallout).
// Slice 3 (deferred): tutorial state machine that consumes a per-scenario
// `tutorial.steps` array and drives callouts + control-locking.

// Callout overlay primitive — generic, no tutorial state coupling.
// Usage from console or future state-machine:
//   showCallout({ anchor: '#btn-grow', text: 'Press to advance time.' });
//   showCallout({ anchor: el, text: '...', side: 'right', highlight: false });
//   hideCallout();
// `anchor` accepts a CSS selector string OR an HTMLElement.
// `side` is one of 'top' | 'bottom' | 'left' | 'right' | 'auto'
//   (default 'auto' picks the side with most viewport room).
// `highlight: true` (default) glows the anchor element while active.
// Only one callout is active at a time — a new showCallout replaces
// any previous. Resize is handled (callout repositions on window resize).
let _calloutState = { tooltipEl: null, arrowEl: null, anchorEl: null, side: 'auto' };

// Expose on window so the tutorial state-machine and dev-console
// testing can call it.
window.showCallout = showCallout;
window.hideCallout = hideCallout;

// ============================================================
// Tutorial state machine (slice 3 of TUTORIAL-SYSTEM)
// ============================================================
// Walks the `tutorial.steps` array attached to a scenario spec in
// data/scenarios.json5, firing the appropriate callout as the
// fortress-mode sim step counter advances. Source of truth for
// "current step" is fortressSim.step (only fortressStep('wait')
// advances it; modifier actions like Heat/Cool don't).
//
// Schema (per step in tutorial.steps):
//   step    — int. fortressSim.step value at which this callout fires
//             (any step whose .step <= fortressSim.step that hasn't
//             fired yet will fire on the next advance)
//   anchor  — CSS selector OR HTMLElement. Where the callout points.
//   text    — tooltip body
//   side    — 'top' | 'bottom' | 'left' | 'right' | 'auto' (optional)
//
// Control-locking: when active, body has `.tutorial-active` class.
// CSS hides all .action-btn except those marked `.tutorial-allow`
// (currently just the Advance button) and the broth panel.

let _tutorialState = null; // { steps: [...], stepIdx: 0 } | null

window.startTutorial = startTutorial;
window.endTutorial = endTutorial;

// ============================================================
// EVENT REGISTRY + SCENARIO LOADER (data/scenarios.json5)
// ============================================================
// Per proposals/TASK-BRIEF-DATA-AS-TRUTH.md item 1, Option A.
// Maps event-type strings used in data/scenarios.json5 to module-level
// event handler functions. Adding a new event type requires registering
// it here AND in vugg.py's EVENT_REGISTRY. tools/sync-spec.js extends
// to verify both registries cover every type referenced in the JSON5.

const EVENT_REGISTRY = {
  fluid_pulse: event_fluid_pulse,
  cooling_pulse: event_cooling_pulse,
  tectonic_shock: event_tectonic_shock,
  copper_injection: event_copper_injection,
  oxidation: event_oxidation,
  tectonic_uplift_drains: event_tectonic_uplift_drains,
  aquifer_recharge_floods: event_aquifer_recharge_floods,
  acidify: event_acidify,
  alkalinize: event_alkalinize,
  molybdenum_pulse: event_molybdenum_pulse,
  fluid_mixing: event_fluid_mixing,
  // Phase 2 — marble_contact_metamorphism
  marble_peak_metamorphism: event_marble_peak_metamorphism,
  marble_retrograde_cooling: event_marble_retrograde_cooling,
  marble_fracture_seal: event_marble_fracture_seal,
  // Phase 2 — reactive_wall
  reactive_wall_acid_pulse_1: event_reactive_wall_acid_pulse_1,
  reactive_wall_acid_pulse_2: event_reactive_wall_acid_pulse_2,
  reactive_wall_acid_pulse_3: event_reactive_wall_acid_pulse_3,
  reactive_wall_seal: event_reactive_wall_seal,
  // Phase 2 — radioactive_pegmatite
  radioactive_pegmatite_crystallization: event_radioactive_pegmatite_crystallization,
  radioactive_pegmatite_deep_time: event_radioactive_pegmatite_deep_time,
  radioactive_pegmatite_oxidizing: event_radioactive_pegmatite_oxidizing,
  radioactive_pegmatite_final_cooling: event_radioactive_pegmatite_final_cooling,
  // Phase 2 — deccan_zeolite
  deccan_zeolite_silica_veneer: event_deccan_zeolite_silica_veneer,
  deccan_zeolite_hematite_pulse: event_deccan_zeolite_hematite_pulse,
  deccan_zeolite_stage_ii: event_deccan_zeolite_stage_ii,
  deccan_zeolite_apophyllite_stage_iii: event_deccan_zeolite_apophyllite_stage_iii,
  deccan_zeolite_late_cooling: event_deccan_zeolite_late_cooling,
  // Phase 2 — ouro_preto
  ouro_preto_vein_opening: event_ouro_preto_vein_opening,
  ouro_preto_f_pulse: event_ouro_preto_f_pulse,
  ouro_preto_cr_leach: event_ouro_preto_cr_leach,
  ouro_preto_steady_cooling: event_ouro_preto_steady_cooling,
  ouro_preto_late_hydrothermal: event_ouro_preto_late_hydrothermal,
  ouro_preto_oxidation_stain: event_ouro_preto_oxidation_stain,
  ouro_preto_final_cooling: event_ouro_preto_final_cooling,
  // Phase 2 — gem_pegmatite
  gem_pegmatite_outer_shell: event_gem_pegmatite_outer_shell,
  gem_pegmatite_first_schorl: event_gem_pegmatite_first_schorl,
  gem_pegmatite_albitization: event_gem_pegmatite_albitization,
  gem_pegmatite_be_saturation: event_gem_pegmatite_be_saturation,
  gem_pegmatite_li_phase: event_gem_pegmatite_li_phase,
  gem_pegmatite_late_hydrothermal: event_gem_pegmatite_late_hydrothermal,
  gem_pegmatite_clay_softening: event_gem_pegmatite_clay_softening,
  gem_pegmatite_final: event_gem_pegmatite_final,
  // Phase 2 — supergene_oxidation. supergene_acidification fires 4× (steps 5/8/12/16).
  supergene_acidification: event_supergene_acidification,
  supergene_meteoric_flush: event_supergene_meteoric_flush,
  supergene_pb_mo_pulse: event_supergene_pb_mo_pulse,
  supergene_cu_enrichment: event_supergene_cu_enrichment,
  supergene_dry_spell: event_supergene_dry_spell,
  supergene_as_rich_seep: event_supergene_as_rich_seep,
  supergene_phosphate_seep: event_supergene_phosphate_seep,
  supergene_v_bearing_seep: event_supergene_v_bearing_seep,
  supergene_fracture_seal: event_supergene_fracture_seal,
  // Phase 2 — bisbee
  bisbee_primary_cooling: event_bisbee_primary_cooling,
  bisbee_uplift_weathering: event_bisbee_uplift_weathering,
  bisbee_enrichment_blanket: event_bisbee_enrichment_blanket,
  bisbee_reducing_pulse: event_bisbee_reducing_pulse,
  bisbee_oxidation_zone: event_bisbee_oxidation_zone,
  bisbee_azurite_peak: event_bisbee_azurite_peak,
  bisbee_co2_drop: event_bisbee_co2_drop,
  bisbee_silica_seep: event_bisbee_silica_seep,
  bisbee_final_drying: event_bisbee_final_drying,
  // Phase 2 — sabkha_dolomitization. flood + evap fire 12× each.
  sabkha_flood: event_sabkha_flood,
  sabkha_evap: event_sabkha_evap,
  sabkha_final_seal: event_sabkha_final_seal,
  // v29 evaporite-locality scenarios
  naica_slow_cooling: event_naica_slow_cooling,
  naica_mining_drainage: event_naica_mining_drainage,
  naica_mining_recharge: event_naica_mining_recharge,
  searles_winter_freeze: event_searles_winter_freeze,
  searles_summer_bake: event_searles_summer_bake,
  searles_fresh_pulse: event_searles_fresh_pulse,
  // Round 9e mechanic-coverage scenarios (May 2026):
  schneeberg_pegmatite_crystallization: event_schneeberg_pegmatite_crystallization,
  schneeberg_cooling: event_schneeberg_cooling,
  schneeberg_cu_p_phase: event_schneeberg_cu_p_phase,
  schneeberg_cu_as_pulse: event_schneeberg_cu_as_pulse,
  schneeberg_cu_depletion: event_schneeberg_cu_depletion,
  schneeberg_as_pulse_late: event_schneeberg_as_pulse_late,
  colorado_plateau_groundwater_pulse: event_colorado_plateau_groundwater_pulse,
  colorado_plateau_roll_front_contact: event_colorado_plateau_roll_front_contact,
  colorado_plateau_k_pulse: event_colorado_plateau_k_pulse,
  colorado_plateau_ca_recovery: event_colorado_plateau_ca_recovery,
  colorado_plateau_arid_stabilization: event_colorado_plateau_arid_stabilization,
  // Tutorials (May 2026) — see proposals/TUTORIAL-SYSTEM-BUILDER-REVIEW.md.
  // Surfaced in the New Game Menu under "Tutorials"; structurally these
  // are scenarios with simple, pedagogically-paced events.
  tutorial_temperature_drop: event_tutorial_temperature_drop,
  tutorial_mn_pulse: event_tutorial_mn_pulse,
  tutorial_fe_drop: event_tutorial_fe_drop,
};

// Minimal JSONC parser — strips // line + /* */ block comments and
// trailing commas, then JSON.parse. Sufficient for our spec files; not
// a full JSON5 parser (no unquoted keys, no single-quoted strings —
// those don't appear in the spec).
function _parseJSON5(text) {
  text = text.replace(/\/\/[^\n]*/g, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  text = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

function _buildScenarioFromSpec(scenarioId, spec) {
  const initial = spec.initial || {};
  const temperature = Number(initial.temperature_C ?? 350);
  const pressure = Number(initial.pressure_kbar ?? 1.0);
  const fluidKwargs = { ...(initial.fluid || {}) };
  const wallKwargs = { ...(initial.wall || {}) };
  const duration = Math.floor(spec.duration_steps ?? 100);
  const eventSpecs = (spec.events || []).slice();
  for (const ev of eventSpecs) {
    if (!EVENT_REGISTRY[ev.type]) {
      throw new Error(`scenarios.json5 scenario '${scenarioId}' references unknown event type '${ev.type}' — register it in EVENT_REGISTRY (index.html) + the Python mirror (vugg.py).`);
    }
  }
  const scenarioCallable = function scenarioCallable() {
    const conditions = new VugConditions({
      temperature, pressure,
      fluid: new FluidChemistry(fluidKwargs),
      wall: new VugWall(wallKwargs),
    });
    // JS events are plain objects (no Event class on the JS side; the
    // global DOM Event would shadow it). Match the {step,name,description,
    // apply_fn} shape used by the legacy in-code scenarios.
    const events = eventSpecs.map(ev => ({
      step: Math.floor(ev.step),
      name: ev.name || ev.type || '',
      description: ev.description || '',
      apply_fn: EVENT_REGISTRY[ev.type],
    }));
    return { conditions, events, defaultSteps: duration };
  };
  // Attach the raw spec so consumers (notably the tutorial state machine,
  // which reads `tutorial.steps`) can recover it. Function objects can hold
  // arbitrary properties; this mirrors how `_json5_spec` is read in
  // startTutorial.
  scenarioCallable._json5_spec = spec;
  return scenarioCallable;
}

let _scenariosJson5Ready = false;

async function _loadScenariosJSON5() {
  // Mirror MINERAL_SPEC's multi-path fetch. Fails silently on offline boot —
  // the four JSON5-only scenarios (cooling/pulse/mvt/porphyry) won't be
  // available, but the legacy in-code scenarios still work.
  const paths = ['./data/scenarios.json5', '../data/scenarios.json5', '/data/scenarios.json5'];
  for (const p of paths) {
    try {
      const r = await fetch(p, { cache: 'no-store' });
      if (!r.ok) continue;
      const text = await r.text();
      const doc = _parseJSON5(text);
      const entries = Object.entries(doc.scenarios || {});
      for (const [id, spec] of entries) {
        SCENARIOS[id] = _buildScenarioFromSpec(id, spec);
      }
      _scenariosJson5Ready = true;
      console.info(`[scenarios] loaded ${entries.length} from ${p}`);
      return;
    } catch (e) {
      /* try next */
    }
  }
  console.warn('[scenarios] all fetch paths failed; the JSON5-only scenarios (cooling/pulse/mvt/porphyry) will not be available this session.');
}

// ============================================================
// SCENARIOS
// ============================================================
// All declarative scenarios live in data/scenarios.json5 and are
// populated asynchronously by _loadScenariosJSON5() above. `let` so the
// loader can mutate the object in place. scenario_random is the only
// procedural scenario; it's wired into the title-screen Random Vugg
// button below rather than added here (pre-existing intentional drift
// from the Python side, where vugg.SCENARIOS["random"] = scenario_random).
let SCENARIOS = {};

// Kick off the JSON5 fetch. Failure logs a warning (Phase 1 scenarios won't
// be available this session) but doesn't break the rest of the runtime.
_loadScenariosJSON5().catch(err => {
  console.error(`[scenarios] load failed: ${err && err.message}`);
});
