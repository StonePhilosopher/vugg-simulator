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
// Tutorial state machine (slice 3 of TUTORIAL-SYSTEM — engine v2)
// ============================================================
// Walks the `tutorial.steps` array attached to a scenario spec in
// data/scenarios.json5. Engine v2 (2026-07-04, the Grand Tour rework)
// supports THREE trigger types per step — sim-step (legacy `step: N`,
// fires as fortressSim.step advances), action (`action: {event,
// selector, checked?}` — waits for the player to do a thing), and
// continue (neither field — Continue button / Enter / Space). Full
// schema documentation lives at the top of 70a-tutorial-overlay.ts.
//
// Control-locking: when active, body has `.tutorial-active` class.
// CSS dims + inerts all .action-btn except those marked
// `.tutorial-allow`; steps unlock controls progressively via their
// `unlock` arrays (tutorial-level `unlock` defaults to ['#f-advance']
// for the legacy sim-step tutorials).

let _tutorialState = null; // { steps: [...], stepIdx, renderedIdx, pausedAt, mode } | null (engine v2/v3.1 — see 70a)

// ENGINE v3 — the narrative playback position for legends-mode
// tutorials. Legends runs the whole sim synchronously up front, then
// displayLines paces the story; `step: N` tutorial triggers in legends
// mode fire against THIS counter (written from displayLines' per-step
// header sync + completion), not against the sim's final step count.
let _legendsPlaybackStep = 0;

window.startTutorial = startTutorial;
window.endTutorial = endTutorial;

// W-F O5 FIRST CONTENT (2026-07-08) — the Elmwood barite snowball. Elmwood is
// famous for barite on honey sphalerite (boss), and the scenario already
// nucleates barite on the sphalerite base — but at seed 42 its barite σ peaks
// at 0.97 and never clears the 1.0 growth floor, so the barite sat as
// subcritical dust. This handler is the documented "purple fluorite + barite"
// stage: a Ba-rich brine pulse that lifts barite σ above the O5 masking barrier
// σ*(φ), so the seeded barite grows one GENERATION through whatever clay/Fe-
// oxide film currently coats it — leaving a masked_horizon (js/85 gate). Between
// pulses σ decays (the waning system cools, Ba is consumed) below the next
// film's σ*, the crystal stalls, and the film sits until the next pulse: the
// stall→pulse→break cycle IS the snowball's concentric banding. Ba-only + a flow
// bump — it touches NO Ca/CO3, so the late golden-scalenohedral calcite showcase
// (the CO3 pulse train, steps 80+) is untouched. Mass balance debits Ba back as
// the barite grows, so the pulse doesn't run away.
function event_elmwood_barite_stage(conditions) {
  // A Ba FLOOR (set, not add) refreshed each stage as barite consumes it down —
  // NOT a stacking pulse. The first cut added +22/stage; the excess Ba stacked to
  // σ_barite≈3.2 (capped), and against elmwood's high CO3 (180, the calcite
  // showcase's supply) it spawned WITHERITE (BaCO3) — a species outside elmwood's
  // documented paragenesis — and nudged the golden calcite. A modest floor keeps
  // barite just above its growth threshold (σ≈1.3–1.5) so it grows a generation
  // without over-delivering Ba into the carbonate system: witherite stays
  // subcritical and the calcite crown jewel is untouched.
  conditions.fluid.Ba = Math.max(conditions.fluid.Ba || 0, 28);
  return `A barium-rich brine pulse floods the Knox breccia — barite grows a generation on the honey sphalerite (Ba ${conditions.fluid.Ba.toFixed(0)} ppm).`;
}

// A pure film-coat beat: the settling clay / iron-oxide film is carried by the
// event's `film:` directive (js/85d applyFilmDusting), so the handler itself
// touches NO chemistry — it exists only so the film-coat events have a valid
// registry type. Between the barite pulses, barite σ decays on its own (cooling
// + Ba consumption) below the fresh film's σ*(φ), so the blade STALLS behind the
// coat until the next pulse breaks through: the stall is what makes the horizon
// a real internal band rather than an instantly-overgrown light film.
function event_film_coat(conditions) {
  return 'A fine film settles over the growing blades, masking their faces.';
}

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
  elmwood_barite_stage: event_elmwood_barite_stage,
  film_coat: event_film_coat,
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
  marble_tectonic_strain: event_marble_tectonic_strain,
  gsp_flood: event_gsp_flood,
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
  // 2026-06-22 — Great Salt Plains (Oklahoma) hourglass-selenite showcase.
  // See js/70k-evaporite.ts for the 3 wet/dry handlers.
  gsp_wet: event_gsp_wet,
  gsp_dry: event_gsp_dry,
  gsp_crust_seal: event_gsp_crust_seal,
  // Round 9e mechanic-coverage scenarios (May 2026):
  schneeberg_pegmatite_crystallization: event_schneeberg_pegmatite_crystallization,
  schneeberg_cooling: event_schneeberg_cooling,
  schneeberg_cu_p_phase: event_schneeberg_cu_p_phase,
  schneeberg_cu_as_pulse: event_schneeberg_cu_as_pulse,
  schneeberg_cu_depletion: event_schneeberg_cu_depletion,
  schneeberg_vadose_exhumation: event_schneeberg_vadose_exhumation,
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
  // PROPOSAL-GEOLOGICAL-ACCURACY Phase 3b (May 2026):
  // CO₂ degas + charge events. See js/70l-co2-events.ts. Scenario
  // `tutorial_travertine` exercises the degas cascade.
  co2_degas: event_co2_degas,
  co2_degas_with_reheat: event_co2_degas_with_reheat,
  co2_charge: event_co2_charge,
  // 2026-05-18 — Sulphur Bank Mine (Lake County, CA). Pleistocene
  // hot-spring sulfur deposit; the canonical native_sulfur locality
  // that matches the engine's acid-sulfate gates. See
  // js/70m-sulphur-bank.ts for the three handlers.
  sulphur_bank_h2s_recharge: event_sulphur_bank_h2s_recharge,
  sulphur_bank_surface_oxidation: event_sulphur_bank_surface_oxidation,
  sulphur_bank_cooling: event_sulphur_bank_cooling,
  // 2026-05-18 — Sicilian Solfifera Series (Cianciana / Caltanissetta,
  // Sicily). Messinian sedimentary BSR-near-surface native-sulfur
  // deposit; the OTHER canonical native_sulfur locality (the
  // alkaline-buffered mode the v80 engine broadening admits). See
  // js/70n-sicily.ts for the four handlers.
  sicily_gypsum_dissolution: event_sicily_gypsum_dissolution,
  sicily_meteoric_o2_pulse: event_sicily_meteoric_o2_pulse,
  sicily_carbonate_buffer: event_sicily_carbonate_buffer,
  sicily_late_synproportionation: event_sicily_late_synproportionation,
  // 2026-05-19 — Sunnyside Mine / American Tunnel (Silverton caldera,
  // San Juan County, Colorado). Intermediate-sulfidation polymetallic
  // epithermal vein deposit; the canonical Silverton-district locality
  // for octahedral REE-fluorite + pale-pink rhodochrosite + manganocalcite
  // (Casadevall & Ohmoto 1977 six-stage paragenesis, compressed to
  // four in the scenario). See js/70p-sunnyside.ts for the handlers.
  sunnyside_cooling_transition: event_sunnyside_cooling_transition,
  sunnyside_stage_v_mn_carbonate: event_sunnyside_stage_v_mn_carbonate,
  sunnyside_stage_vi_fluoride_pulse: event_sunnyside_stage_vi_fluoride_pulse,
  sunnyside_stage_vi_manganocalcite_cap: event_sunnyside_stage_vi_manganocalcite_cap,
  // 2026-05-20 — Roughten Gill Mine (Caldbeck Fells, Cumbria, England).
  // Polymetallic Pb-Cu vein in Borrowdale Volcanic Group; type locality
  // for plumbogummite. The Pb-Cu sulfate trio (linarite + caledonite +
  // leadhillite, v100) fires in their type district. See
  // js/70q-roughten-gill.ts for the five stage-transition handlers.
  roughten_gill_primary_lockup: event_roughten_gill_primary_lockup,
  roughten_gill_pyrite_oxidation: event_roughten_gill_pyrite_oxidation,
  roughten_gill_linarite_stage: event_roughten_gill_linarite_stage,
  roughten_gill_caledonite_transition: event_roughten_gill_caledonite_transition,
  roughten_gill_leadhillite_cap: event_roughten_gill_leadhillite_cap,
  // v115 (2026-05-20): Jeffrey Mine (Val-des-Sources, Quebec) — the
  // rodingite metasomatic assemblage. Five stage-transition handlers
  // walk the broth through serpentinization onset → mafic dike
  // alteration → mid-rodingite (vesuvianite-cyprine) → late Ca-
  // silicates (pectolite + wollastonite + prehnite) → terminal
  // datolite. See js/70r-jeffrey-mine.ts for the per-handler logic +
  // Bernardini 1981 references.
  jeffrey_mine_serpentinization_onset: event_jeffrey_mine_serpentinization_onset,
  jeffrey_mine_dike_alteration: event_jeffrey_mine_dike_alteration,
  jeffrey_mine_mid_rodingite: event_jeffrey_mine_mid_rodingite,
  jeffrey_mine_late_ca_silicates: event_jeffrey_mine_late_ca_silicates,
  jeffrey_mine_terminal_datolite: event_jeffrey_mine_terminal_datolite,
  // 2026-05-21 — TN457 forcing-function test for PROPOSAL-EVENT-DRIVEN-
  // PRECIPITATION (Rock Bot + Professor, 2026-05-20). Single handler
  // fired 50× across steps 5-103 by tn457_barite_pulses; each firing
  // is a Ba + Mn fluid pulse with rng-driven Mn variation. See
  // js/70s-tn457.ts for the per-pulse chemistry.
  tn457_mn_ba_pulse: event_tn457_mn_ba_pulse,
  // 2026-06-08 — reactivated_fluorite_vein: the fluid-spots SEAL → BREACH
  // (Phase 2d) demonstrator. Two handlers do the chemistry of each transition;
  // the feeder open/close itself is the event's `spots: 'seal'|'breach'`
  // directive (handled centrally in apply_events). See js/70t-reactivated-vein.ts.
  reactivated_vein_seal: event_reactivated_vein_seal,
  reactivated_vein_breach: event_reactivated_vein_breach,
  // 2026-06-12 — wittichen five-element vein (v189): the reduction-shock
  // dendrite showcase. The redox shock itself is a DECLARED fluid.Eh
  // movement (event-subsumption discipline — handlers carry only the
  // non-redox late-stage beats + one narrative-only shock marker). See
  // js/70u-wittichen.ts for the paragenesis header.
  wittichen_hydrocarbon_influx: event_wittichen_hydrocarbon_influx,
  wittichen_meteoric_sulfate: event_wittichen_meteoric_sulfate,
  wittichen_carbonate_gangue: event_wittichen_carbonate_gangue,
  // 2026-06-15 — Tormiq Valley alpine-cleft epidote (Gilgit-Baltistan,
  // Pakistan), the v197 anchor for epidote. See js/70v-tormiq.ts (6 handlers).
  tormiq_quartz_lining: event_tormiq_quartz_lining,
  tormiq_oxide_stage: event_tormiq_oxide_stage,
  tormiq_epidote_main: event_tormiq_epidote_main,
  tormiq_byssolite: event_tormiq_byssolite,
  tormiq_adularia: event_tormiq_adularia,
  tormiq_late_calcite: event_tormiq_late_calcite,
  tormiq_late_shear: event_tormiq_late_shear,
  // 2026-06-19 — Grimsel / Aar-massif alpine cleft (the quartz-morphology
  // content home). T is a declared movement; these are the crack-seal SiO₂
  // sawtooth + Fe/CO₃ chemistry beats. See js/70u-grimsel.ts.
  grimsel_cleft_open: event_grimsel_cleft_open,
  grimsel_seal_1: event_grimsel_seal_1,
  grimsel_breach_1: event_grimsel_breach_1,
  grimsel_oxide_roses: event_grimsel_oxide_roses,
  grimsel_seal_2: event_grimsel_seal_2,
  grimsel_breach_2: event_grimsel_breach_2,
  grimsel_late_carbonate: event_grimsel_late_carbonate,
  // 2026-07-05 — Shigar Valley aquamarine pegmatite (Gilgit-Baltistan,
  // Pakistan): the beryl-family's anchor scenario + Tutorial 4's stage.
  // Seven pocket-story beats; the hf_etch is the Shigar signature.
  // See js/70w-shigar.ts.
  shigar_outer_shell: event_shigar_outer_shell,
  shigar_first_schorl: event_shigar_first_schorl,
  shigar_cleavelandite: event_shigar_cleavelandite,
  shigar_aqua_saturation: event_shigar_aqua_saturation,
  shigar_topaz_window: event_shigar_topaz_window,
  shigar_hf_etch: event_shigar_hf_etch,
  shigar_final_cooling: event_shigar_final_cooling,
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

// W-K V1c (2026-07-07): cavity GENESIS per scenario → the Three.js renderer's wall relief family
// (js/99a _wallReliefFamily). Research-verified (3 locality-genesis passes, cross-checked citations
// — Keller 1983 Ouro Preto = vein; García-Ruiz 2007 Naica = dissolution-cavity; torbernite/zeunerite
// = Schneeberg supergene; jeffrey_mine = open-cavity druse). Central here (not 38 scenarios.json5
// edits) so the whole assignment is reviewable + tweakable in one place; a scenario's own
// wall.genesis in json5 still wins. Values map to families: dissolution→scallops(flow-scaled),
// vein→comb, pocket→druse, supergene→boxwork, botryoidal→botryoidal, vesicle/metamorphic→smooth,
// cleft→cleft, evaporite→basin.
const _WALL_GENESIS_BY_SCENARIO: { [id: string]: string } = {
  // dissolution — karst / cave / acid-etched carbonate + MVT collapse-breccia + Naica hypogene cavity
  reactive_wall: 'dissolution', porphyry: 'dissolution', mvt: 'dissolution', elmwood: 'dissolution',
  naica_geothermal: 'dissolution', stalactite_demo: 'dissolution', zoned_dripstone_cave: 'dissolution',
  cooling: 'dissolution', pulse: 'dissolution', tutorial_first_crystal: 'dissolution',
  tutorial_mn_calcite: 'dissolution',
  // vein — hydrothermal open-space fracture fill (comb/palisade)
  tn457_barite_pulses: 'vein', reactivated_fluorite_vein: 'vein', sunnyside_american_tunnel: 'vein',
  ouro_preto: 'vein', wittichen: 'vein', epithermal_telluride: 'vein', jeffrey_mine: 'vein',
  // pocket — pegmatite miarolitic (blocky euhedral druse)
  gem_pegmatite: 'pocket', shigar_pegmatite: 'pocket', radioactive_pegmatite: 'pocket',
  // supergene — gossan boxwork after leached sulphide
  bisbee: 'supergene', supergene_oxidation: 'supergene', roughten_gill: 'supergene', schneeberg: 'supergene',
  // botryoidal — mammillary chrysoprase / hot-spring sinter / travertine crust
  ultramafic_supergene: 'botryoidal', sulphur_bank: 'botryoidal', tutorial_travertine: 'botryoidal',
  // vesicle — basalt gas bubble (smooth glassy)
  deccan_zeolite: 'vesicle',
  // metamorphic / no-open-void (smooth): skarn/porphyroblast + roll-front pore-cement
  marble_contact_metamorphism: 'metamorphic', chiastolite_hornfels: 'metamorphic', colorado_plateau: 'metamorphic',
  // cleft / evaporite — already architecture-driven, declared here for explicitness
  grimsel_alpine_cleft: 'cleft', tormiq_alpine_cleft: 'cleft',
  searles_lake: 'evaporite', sabkha_dolomitization: 'evaporite', great_salt_plains: 'evaporite',
  sicily_solfifera: 'evaporite',
};

function _buildScenarioFromSpec(scenarioId, spec) {
  const initial = spec.initial || {};
  const temperature = Number(initial.temperature_C ?? 350);
  const pressure = Number(initial.pressure_kbar ?? 1.0);
  const fluidKwargs = { ...(initial.fluid || {}) };
  const wallKwargs = { ...(initial.wall || {}) };
  // W-K V1c: stamp the research-verified cavity genesis (render-only; a scenario's own
  // wall.genesis in json5 wins). Drives the wall relief family in the Three.js renderer.
  if (wallKwargs.genesis == null && _WALL_GENESIS_BY_SCENARIO[scenarioId]) {
    wallKwargs.genesis = _WALL_GENESIS_BY_SCENARIO[scenarioId];
  }
  const duration = Math.floor(spec.duration_steps ?? 100);
  const eventSpecs = (spec.events || []).slice();
  for (const ev of eventSpecs) {
    if (!EVENT_REGISTRY[ev.type]) {
      throw new Error(`scenarios.json5 scenario '${scenarioId}' references unknown event type '${ev.type}' — register it in EVENT_REGISTRY (index.html) + the Python mirror (vugg.py).`);
    }
  }
  const scenarioCallable = function scenarioCallable(overrides: any = {}) {
    // Per-run overrides let the UI inject a user-supplied shape_seed
    // (cavity-geometry RNG) without touching the scenario's authored
    // chemistry / events. Boss directive 2026-05-11: cavity shape and
    // crystal growth are independently seeded — locking one and
    // varying the other is part of the play loop. overrides.wall is
    // shallow-merged on top of the scenario's authored wallKwargs so
    // an explicit shape_seed wins, but every other wall field
    // (architecture, primary_bubbles, etc.) stays as the scenario
    // declared it.
    const wallOverride = overrides && overrides.wall ? overrides.wall : null;
    const mergedWall = wallOverride ? { ...wallKwargs, ...wallOverride } : wallKwargs;
    const conditions = new VugConditions({
      temperature, pressure,
      fluid: new FluidChemistry(fluidKwargs),
      wall: new VugWall(mergedWall),
    });
    // PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 4b — attach the
    // scenario's open-system flags to conditions so the simulator's
    // _applyOpenAtmosphereEquilibration (in 85c) can resolve them
    // per-step without needing a separate scenario reference.
    // Polymorphic per the resolvers in 20d (scalar | fn | per-region
    // map). Absent fields default to closed cavity / modern
    // atmospheric pCO2 at the resolver site, so spec-side opt-in is
    // the only thing that flips behavior.
    conditions._scenario = {
      open_to_atmosphere: spec.open_to_atmosphere,
      atmospheric_pCO2_bar: spec.atmospheric_pCO2_bar,
      wall_rock_thermal_buffer_C: spec.wall_rock_thermal_buffer_C,
      host_rock_composition: spec.host_rock_composition,
      // Geological MOVEMENTS (js/85j) — persistent master-variable drift.
      // Absent in every scenario today (Phase 0 dark scaffold) → the run_step
      // movement hook stays a no-op and seed-42 is byte-identical. Phase 1
      // adds a `movements: [...]` array to one scenario's JSON5 spec.
      movements: spec.movements,
      // FLUID-SOURCE SPOTS (js/85k, PROPOSAL §10) — optional per-scenario spot
      // config {count|minCount|maxCount|kinds}. Spots are SEEDED off the cavity
      // seed regardless; this only pins/biases the seeded distribution. Absent →
      // the default small distribution. Phase 2a is dark (spots stored, unread).
      fluid_spots: spec.fluid_spots,
    };
    // JS events are plain objects (no Event class on the JS side; the
    // global DOM Event would shadow it). Match the {step,name,description,
    // apply_fn} shape used by the legacy in-code scenarios.
    const events = eventSpecs.map(ev => ({
      step: Math.floor(ev.step),
      name: ev.name || ev.type || '',
      description: ev.description || '',
      apply_fn: EVENT_REGISTRY[ev.type],
      // FLUID-SOURCE SPOTS Phase 2d — optional spot-lifecycle directive. A
      // string ('seal' | 'breach') or {action, kind} closes/opens the cavity's
      // feeders when this event fires (apply_events handles it centrally, after
      // apply_fn). Absent → no spot toggle → byte-identical. Lets a scenario
      // declare "this fracture-seal event shuts the plumbing" without touching
      // the shared event handler.
      spots: ev.spots,
      // POST-GROWTH DEFORMATION (deformation/shear arc 2026-06-20) — optional
      // directive {style,magnitude,minerals}. apply_events records it onto
      // sim._deformationEvents with the step it fired; classifyDeformation (js/45)
      // bends/twins crystals that already grew. Absent → no overprint → byte-
      // identical. Mechanical + post-growth, so it does NOT mutate the fluid.
      deformation: ev.deformation,
      // POST-GROWTH ETCH (crystal-face-realism arc §2, 2026-06-22) — optional directive
      // {amount,minerals,style}. apply_events records it onto sim._etchEvents with the
      // step it fired; classifyEtch (js/45) rounds/frosts crystals that already grew.
      // Absent → no overprint → byte-identical. Chemical corrosion is post-growth, so it
      // does NOT mutate the fluid.
      etch: ev.etch,
      // FILM DUSTING (W-F O5 perturbed regrowth) — optional directive
      // {mineral, prism, term, minerals?}. apply_events (js/85d) sets `_film` on
      // the active target crystals via applyFilmDusting (js/44b): a foreign film
      // (chlorite, clay) settles on their growth fronts. UNLIKE deformation/etch
      // this is not post-growth-inert — it masks FUTURE growth via the σ*(φ)
      // gate — but in O5a nothing reads `_film` (gate behind O5_MASKING_ENABLED),
      // so a scenario carrying this directive stays byte-identical until O5b. No
      // fleet scenario uses it yet (Sweetwater, O5b's first content, is unbuilt).
      film: ev.film,
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
      MENU_LAYOUT = doc.menu_layout || null;
      _scenariosJson5Ready = true;
      console.info(`[scenarios] loaded ${entries.length} from ${p}`);
      // §10.5 tranche 1: the legends quick-play dropdown derives from
      // SCENARIOS — populate it now that the map is complete (the
      // static <select> ships empty; see _populateScenarioDropdowns
      // in 94-ui-menu.ts).
      if (typeof _populateScenarioDropdowns === 'function') _populateScenarioDropdowns();
      // §10.5 tranches 2-3 (Door 3, 2026-07-10): the Scenarios picker
      // panel, the Zen-mode dropdown, and the Begin tutorial buttons
      // generate from MENU_LAYOUT (the menu_layout block above). Their
      // former hardcoded HTML now ships as empty containers. See the
      // populators in 94-ui-menu.ts. Ordered/labelled verbatim from the
      // old static menus — a byte-identical migration.
      if (typeof _populateScenariosPanel === 'function') _populateScenariosPanel();
      if (typeof _populateIdleScenarioDropdown === 'function') _populateIdleScenarioDropdown();
      if (typeof _populateBeginTutorials === 'function') _populateBeginTutorials();
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

// The menu_layout block from data/scenarios.json5 (Door 3 / §10.5 t2-3):
// the Scenarios picker panel, Zen dropdown, and Begin tutorial buttons as
// data. Populated by _loadScenariosJSON5 above; consumed by the js/94
// populators. `null` until the fetch completes (offline boot leaves the
// static empty containers, same failure mode as the JSON5-only scenarios).
let MENU_LAYOUT: any = null;

// Kick off the JSON5 fetch. Failure logs a warning (Phase 1 scenarios won't
// be available this session) but doesn't break the rest of the runtime.
_loadScenariosJSON5().catch(err => {
  console.error(`[scenarios] load failed: ${err && err.message}`);
});
