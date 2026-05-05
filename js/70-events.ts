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

// ============================================================
// PHASE 2 EVENT HANDLERS — promoted from inline closures
// ============================================================
// Mirror of the Python-side promoted handlers. Phase 2 of data-as-truth
// migrates inline `ev_X` closures from the legacy scenario_* functions
// to module-level so the parent scenario's initial state can move to
// data/scenarios.json5. Names are scenario-prefixed
// (event_<scenario>_<verb>) to stay unambiguous across migrations.

// --- marble_contact_metamorphism ---
function event_marble_peak_metamorphism(c) {
  c.temperature = 700.0;
  c.fluid.Al += 15;
  c.fluid.SiO2 += 8;
  c.fluid.Cr += 1.5;
  c.flow_rate = 2.5;
  return "Contact metamorphic peak: a leucogranite dyke 50 m away pumps 700°C fluid into the marble interface. Skarn alteration zones expand outward; corundum family crystals begin to nucleate in the most Si-undersaturated patches. Pigeon's blood ruby paragenesis underway.";
}

function event_marble_retrograde_cooling(c) {
  c.temperature = 500.0;
  c.fluid.Al = Math.max(c.fluid.Al * 0.9, 30);
  c.flow_rate = 1.2;
  return "Retrograde cooling begins. The leucogranite intrusion stalls; the fluid slowly retreats through the skarn envelope, depositing corundum at every fracture it finds. T drops from 700 to 500°C. This is the main ruby/sapphire growth window.";
}

function event_marble_fracture_seal(c) {
  c.temperature = 350.0;
  c.flow_rate = 0.1;
  c.fluid.pH = Math.min(c.fluid.pH + 0.3, 9.0);
  return "The feeding fracture seals. The Mogok pocket is now a closed system. Whatever corundum family crystals are still undersaturated will continue to consume the remaining Al pool until equilibrium. Everything else is frozen.";
}

// --- reactive_wall ---
function event_reactive_wall_acid_pulse_1(c) {
  c.fluid.pH = 3.5;
  c.fluid.S += 40.0;
  c.fluid.Zn += 60.0;
  c.fluid.Fe += 15.0;
  c.flow_rate = 4.0;
  return 'CO₂-saturated brine surges into the vug. pH crashes to 3.5. The limestone walls begin to fizz — carbonate dissolving on contact.';
}

function event_reactive_wall_acid_pulse_2(c) {
  c.fluid.pH = 3.0;
  c.fluid.S += 50.0;
  c.fluid.Zn += 80.0;
  c.fluid.Fe += 25.0;
  c.fluid.Mn += 10.0;
  c.flow_rate = 5.0;
  return 'Second acid pulse — stronger than the first. pH drops to 3.0. Metal-bearing brine floods the vug. The walls are being eaten alive, but every Ca²⁺ released is a future growth band waiting to happen.';
}

function event_reactive_wall_acid_pulse_3(c) {
  c.fluid.pH = 4.0;
  c.fluid.S += 20.0;
  c.fluid.Zn += 30.0;
  c.flow_rate = 3.0;
  return 'Third acid pulse — weaker now. pH only drops to 4.0. The fluid system is exhausting. But the wall still has carbonate to give.';
}

function event_reactive_wall_seal(c) {
  c.flow_rate = 0.1;
  c.fluid.pH += 0.5;
  c.fluid.pH = Math.min(c.fluid.pH, 8.0);
  return 'The feeding fracture seals. Flow stops. The vug becomes a closed system. Whatever\'s dissolved will precipitate until equilibrium.';
}

// --- radioactive_pegmatite ---
function event_radioactive_pegmatite_crystallization(c) {
  c.temperature = 450;
  c.fluid.SiO2 += 3000; // late-stage silica release from melt
  return 'The pegmatite melt differentiates. Volatile-rich residual fluid floods the pocket. Quartz begins to grow in earnest — large, clear crystals claiming space. Uraninite cubes nucleate where uranium concentration is highest.';
}

function event_radioactive_pegmatite_deep_time(c) {
  c.temperature = 300;
  return 'Deep time passes. The uraninite sits in its cradle of cooling rock, silently emitting alpha particles. Each decay transmutes one atom of uranium into lead. The quartz growing nearby doesn\'t know it yet, but it\'s darkening.';
}

function event_radioactive_pegmatite_oxidizing(c) {
  c.fluid.O2 += 0.8;
  c.temperature = 120;
  c.flow_rate = 1.5;
  return 'Oxidizing meteoric fluids seep through fractures. The reducing environment shifts. Sulfides become unstable. The uraninite begins to weather — pitchy edges yellowing as U⁴⁺ goes back into solution as soluble uranyl ion.';
}

function event_radioactive_pegmatite_final_cooling(c) {
  c.temperature = 50;
  c.flow_rate = 0.1;
  return 'The system cools to near-ambient. What remains is a pegmatite pocket: black uraninite cubes, smoky quartz darkened by radiation, and galena crystallized from the lead that uranium became. Time wrote this assemblage. Chemistry just held the pen.';
}

// --- schneeberg (Round 9e mechanic-coverage scenario, May 2026) ---
function event_schneeberg_pegmatite_crystallization(c) {
  c.temperature = 350;
  c.fluid.O2 = 0.0;
  c.fluid.SiO2 = Math.max(c.fluid.SiO2, 6000);
  return 'The Schneeberg pegmatite differentiates. A reducing residual fluid floods the pocket with uranium, copper, iron, and arsenic. Uraninite grows as pitch-black masses; chalcopyrite plates as brassy disphenoids; arsenopyrite forms steel-gray rhombs. Bismuth is everywhere — Schneeberg\'s first ore was bismuth, three centuries before pitchblende became uranium.';
}

function event_schneeberg_cooling(c) {
  c.temperature = 30;
  c.flow_rate = 0.5;
  return 'The pegmatite system cools toward ambient. Primary crystallization closes. The vug holds black uraninite, brassy chalcopyrite, and steel-gray arsenopyrite — a characteristic Erzgebirge primary assemblage, not yet touched by oxidation.';
}

function event_schneeberg_cu_p_phase(c) {
  c.temperature = 25;
  c.fluid.O2 = 1.5;
  c.fluid.pH = 6.0;
  c.flow_rate = 1.5;
  c.fluid.P = Math.max(c.fluid.P, 18.0);
  c.fluid.As = Math.min(c.fluid.As, 4.0);
  c.fluid.Cu = Math.max(c.fluid.Cu, 70.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 35.0);
  return 'Meteoric water seeps through fractures and floods the system with oxygen. Uraninite begins weathering — its U⁴⁺ flips to soluble UO₂²⁺ uranyl. Chalcopyrite oxidizes; Cu²⁺ enters solution alongside the uranyl. Arsenopyrite weathering is delayed (steeper kinetic barrier), so phosphate dominates the anion pool. Emerald-green torbernite plates begin appearing on the dissolving uraninite — the diagnostic Schneeberg habit, the museum-classic.';
}

function event_schneeberg_cu_as_pulse(c) {
  c.temperature = 22;
  c.fluid.As = Math.max(c.fluid.As, 22.0);
  c.fluid.P = Math.min(c.fluid.P, 4.0);
  c.fluid.Cu = Math.max(c.fluid.Cu, 55.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 35.0);
  return 'The arsenopyrite has been steadily oxidizing in the background, and now it catches up. Arsenate floods the fluid — As pulls past P as the dominant anion. Cu is still in the pool, ahead of Ca. The same chemistry stage as torbernite but with arsenate instead of phosphate: zeunerite, the species Weisbach described from this very mine in 1872. Visually indistinguishable from torbernite; the chemistry is the only honest test.';
}

function event_schneeberg_cu_depletion(c) {
  c.temperature = 20;
  c.fluid.Cu = Math.min(c.fluid.Cu, 5.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.P = Math.max(c.fluid.P, 18.0);
  c.fluid.As = Math.min(c.fluid.As, 4.0);
  return 'Copper has been pulled out of the fluid by the green plates. The cation pool flips: calcium, sourced from the carbonate buffer in the pegmatite country rock, takes over. P replenishes from continuing apatite weathering. The same uranyl-phosphate chemistry that grew torbernite now grows autunite — bright canary yellow instead of emerald green, and crucially, fluorescent. Where Cu²⁺ killed the uranyl emission cold, Ca²⁺ leaves it lit.';
}

function event_schneeberg_as_pulse_late(c) {
  c.temperature = 18;
  c.fluid.As = Math.max(c.fluid.As, 22.0);
  c.fluid.P = Math.min(c.fluid.P, 4.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.Cu = Math.min(c.fluid.Cu, 5.0);
  c.flow_rate = 0.3;
  return 'The arsenate replenishes one final time as the last arsenopyrite grains weather. Ca is still dominant, As is now dominant: uranospinite, the calcium analog of zeunerite. Same mine, same vein, same uranyl ion — but where zeunerite was dead under UV, this one glows yellow-green. Weisbach described it in 1873, the year after he characterized zeunerite a hundred meters away. Four uranyl species in one vug, the cation+anion fork mechanic finally written into the rock.';
}

// --- colorado_plateau (Round 9e companion scenario, May 2026) ---
function event_colorado_plateau_groundwater_pulse(c) {
  c.temperature = 22;
  c.fluid.O2 = 1.5;
  c.fluid.pH = 7.0;
  c.flow_rate = 1.2;
  c.fluid.U = Math.max(c.fluid.U, 18.0);
  c.fluid.V = Math.max(c.fluid.V, 14.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.K = Math.min(c.fluid.K, 20.0);
  return 'Oxidizing groundwater flushes through the Morrison Formation sandstones, picking up uranium from upstream uraninite weathering and vanadium from montroseite-bearing layers. The carbonate-buffered fluid carries Ca dominant over K. Where it meets a U+V trap — typically petrified wood or carbonaceous shale — bright canary-yellow tyuyamunite begins plating. The same yellow that prospectors followed across mesa tops decades before scintillometers existed.';
}

function event_colorado_plateau_roll_front_contact(c) {
  c.temperature = 18;
  c.fluid.Fe = Math.max(c.fluid.Fe, 12.0);
  c.fluid.O2 = 1.0;
  c.flow_rate = 0.6;
  return 'The fluid hits a roll-front — a buried zone of carbonaceous shale or petrified wood that has held its reducing capacity for millions of years. Iron rises as the organic carbon reduces dissolved Fe³⁺ to Fe²⁺ and pulls oxygen from the system. The uranyl-vanadate complex destabilizes at the redox boundary, dropping out as concentrated tyuyamunite crusts where the chemistry crosses. The Colorado Plateau ore-grade signature.';
}

function event_colorado_plateau_k_pulse(c) {
  c.temperature = 22;
  c.fluid.K = Math.max(c.fluid.K, 40.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 30.0);
  c.fluid.V = Math.max(c.fluid.V, 10.0);
  c.fluid.U = Math.max(c.fluid.U, 8.0);
  c.fluid.Fe = Math.max(c.fluid.Fe, 8.0);
  return 'A drier interval. Evaporation concentrates the alkaline ions; potassium pulls past calcium in the cation pool. K/(K+Ca) crosses 0.5 — the carnotite branch of the cation fork takes over. Carnotite plates beside the existing tyuyamunite. Same canary-yellow, same uranyl-vanadate, same chemistry stage; the cation ratio drew the boundary between them. Friedel and Cumenge described carnotite from Roc Creek in 1899 from exactly this kind of pore-fluid regime.';
}

function event_colorado_plateau_ca_recovery(c) {
  c.temperature = 20;
  c.fluid.Ca = Math.max(c.fluid.Ca, 95.0);
  c.fluid.K = Math.min(c.fluid.K, 15.0);
  c.fluid.V = Math.max(c.fluid.V, 9.0);
  c.fluid.U = Math.max(c.fluid.U, 6.0);
  return 'The dry interval ends; meteoric recharge brings carbonate back into solution. Ca recovers dominance. Tyuyamunite resumes plating in the new pore-fluid composition, this time alongside the carnotite that grew during the K-pulse. Colorado Plateau specimens preserve exactly this kind of intergrowth — the same hand specimen, the same emerald color, the cation chemistry the only honest test of which is which.';
}

function event_colorado_plateau_arid_stabilization(c) {
  c.temperature = 20;
  c.flow_rate = 0.1;
  return 'The system reaches its steady state. Carnotite and tyuyamunite cover the pore walls in roughly equal parts. Both fluoresce dimly under longwave UV — the vanadate matrix dampens their emission below autunite-group brilliance, but Ca²⁺ keeps tyuyamunite\'s emission slightly lifted above carnotite\'s. Time wrote this assemblage. Geochemistry just held the pen.';
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

function showCallout(opts) {
  hideCallout();
  const { anchor, text, side, highlight } = Object.assign(
    { side: 'auto', highlight: true }, opts || {}
  );
  const anchorEl = (typeof anchor === 'string') ? document.querySelector(anchor) : anchor;
  if (!anchorEl) {
    console.warn('showCallout: anchor not found:', anchor);
    return;
  }
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'tutorial-callout';
  tooltipEl.textContent = text || '';
  document.body.appendChild(tooltipEl);
  const arrowEl = document.createElement('div');
  arrowEl.className = 'tutorial-callout-arrow';
  document.body.appendChild(arrowEl);
  if (highlight) anchorEl.classList.add('tutorial-callout-anchor-highlight');
  _calloutState = { tooltipEl, arrowEl, anchorEl: highlight ? anchorEl : null, side };
  _positionCallout(anchorEl, tooltipEl, arrowEl, side);
  window.addEventListener('resize', _onCalloutResize);
  window.addEventListener('scroll', _onCalloutResize, true);
}

function hideCallout() {
  if (_calloutState.tooltipEl) _calloutState.tooltipEl.remove();
  if (_calloutState.arrowEl) _calloutState.arrowEl.remove();
  if (_calloutState.anchorEl) {
    _calloutState.anchorEl.classList.remove('tutorial-callout-anchor-highlight');
  }
  _calloutState = { tooltipEl: null, arrowEl: null, anchorEl: null, side: 'auto' };
  window.removeEventListener('resize', _onCalloutResize);
  window.removeEventListener('scroll', _onCalloutResize, true);
}

function _onCalloutResize() {
  const s = _calloutState;
  // Use the element that matters for positioning: anchorEl if highlighting,
  // else look up via the tooltip's stored data (we only support resize on
  // anchored callouts — no anchor means no reposition needed).
  if (s.tooltipEl && s.anchorEl) {
    _positionCallout(s.anchorEl, s.tooltipEl, s.arrowEl, s.side);
  }
}

function _positionCallout(anchorEl, tooltipEl, arrowEl, side) {
  const ar = anchorEl.getBoundingClientRect();
  const cw = tooltipEl.offsetWidth;
  const ch = tooltipEl.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 14; // space between anchor and tooltip (room for arrow)

  if (side === 'auto') {
    const room = {
      top: ar.top,
      bottom: vh - ar.bottom,
      left: ar.left,
      right: vw - ar.right,
    };
    side = Object.entries(room).sort((a, b) => b[1] - a[1])[0][0];
  }

  let top, left, arrowTop, arrowLeft, arrowClass;
  switch (side) {
    case 'top':
      top = ar.top - ch - gap;
      left = ar.left + ar.width / 2 - cw / 2;
      arrowTop = ar.top - 11 - 1;
      arrowLeft = ar.left + ar.width / 2 - 9;
      arrowClass = 'from-bottom'; // arrow on bottom of tooltip points down to anchor
      break;
    case 'bottom':
      top = ar.bottom + gap;
      left = ar.left + ar.width / 2 - cw / 2;
      arrowTop = ar.bottom + 1;
      arrowLeft = ar.left + ar.width / 2 - 9;
      arrowClass = 'from-top';
      break;
    case 'left':
      top = ar.top + ar.height / 2 - ch / 2;
      left = ar.left - cw - gap;
      arrowTop = ar.top + ar.height / 2 - 9;
      arrowLeft = ar.left - 11 - 1;
      arrowClass = 'from-right';
      break;
    case 'right':
    default:
      top = ar.top + ar.height / 2 - ch / 2;
      left = ar.right + gap;
      arrowTop = ar.top + ar.height / 2 - 9;
      arrowLeft = ar.right + 1;
      arrowClass = 'from-left';
      break;
  }
  // Clamp tooltip to viewport (8px margin)
  left = Math.max(8, Math.min(left, vw - cw - 8));
  top = Math.max(8, Math.min(top, vh - ch - 8));

  tooltipEl.style.top = top + 'px';
  tooltipEl.style.left = left + 'px';
  arrowEl.style.top = arrowTop + 'px';
  arrowEl.style.left = arrowLeft + 'px';
  arrowEl.className = 'tutorial-callout-arrow ' + arrowClass;
}

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

function startTutorial(scenarioName) {
  // Boot the underlying scenario in Creative Mode first.
  if (typeof startScenarioInCreative !== 'function') {
    console.error('startTutorial: startScenarioInCreative not available');
    return;
  }
  startScenarioInCreative(scenarioName);

  const make = (typeof SCENARIOS !== 'undefined') ? SCENARIOS[scenarioName] : null;
  const spec = make && make._json5_spec;
  const tut = spec && spec.tutorial;
  if (!tut || !Array.isArray(tut.steps) || !tut.steps.length) {
    console.warn('startTutorial: scenario has no tutorial.steps:', scenarioName);
    return; // scenario still runs, just without overlay
  }
  _tutorialState = { steps: tut.steps.slice(), stepIdx: 0 };
  document.body.classList.add('tutorial-active');

  // Whitelist the Advance button so it survives the control-locking CSS.
  const adv = document.getElementById('f-advance');
  if (adv) adv.classList.add('tutorial-allow');

  // Fire any steps whose trigger is already satisfied (typically step:0).
  _maybeAdvanceTutorial();
}

function endTutorial() {
  _tutorialState = null;
  document.body.classList.remove('tutorial-active');
  document.querySelectorAll('.tutorial-allow').forEach(el => el.classList.remove('tutorial-allow'));
  hideCallout();
}

function _maybeAdvanceTutorial() {
  if (!_tutorialState) return;
  if (typeof fortressSim === 'undefined' || !fortressSim) return;
  const s = _tutorialState;
  const cur = fortressSim.step || 0;
  // Walk forward, firing every step whose trigger is satisfied.
  // showCallout replaces, so only the last one in the burst stays
  // visible — authors should put one callout per sim-step trigger.
  let lastFired = null;
  while (s.stepIdx < s.steps.length && (s.steps[s.stepIdx].step || 0) <= cur) {
    lastFired = s.steps[s.stepIdx];
    s.stepIdx++;
  }
  if (lastFired) {
    showCallout({
      anchor: lastFired.anchor || '#f-advance',
      text: lastFired.text || '',
      side: lastFired.side || 'auto',
    });
  }
}

window.startTutorial = startTutorial;
window.endTutorial = endTutorial;


function event_tutorial_temperature_drop(c) {
  // Knock T down by 80°C, never below ambient. From 180°C this lands
  // ~100°C — outside quartz's comfort window for sustained growth, but
  // not so cold the existing crystal immediately re-dissolves.
  c.temperature = Math.max(25.0, c.temperature - 80.0);
  return 'The vug cools quickly. Temperature drops out of quartz\'s growth window — the silica supply that was happily plating onto the crystal a moment ago no longer wants to leave the fluid. Growth slows, then stops. The crystal is still there, still beautiful, but nothing new is forming on its faces. Conditions matter; minerals only grow when the broth wants to give them up.';
}

function event_tutorial_mn_pulse(c) {
  // Push Mn well past calcite's 2 ppm activator threshold. From a
  // starting 8 ppm this lands at ~38 ppm — saturating Mn in the next
  // calcite zones, but well below the rhodochrosite supersaturation
  // requirement in this broth.
  c.fluid.Mn += 30.0;
  return 'A fresh fluid pulse brings extra manganese into the broth. The next zones of calcite to grow will incorporate Mn²⁺ as a trace dopant — the same activator that lights up the Franklin / Sterling Hill specimens under longwave UV. The iron in the broth still quenches most of it for now, but the chemistry is set: Mn²⁺ is being recorded into every growth ring from this moment forward.';
}

function event_tutorial_fe_drop(c) {
  // Crash Fe to ~5% of its current value (10 → 0.5). The quenching
  // threshold is in the low single digits; this lands clearly under it.
  c.fluid.Fe = Math.max(0.0, c.fluid.Fe * 0.05);
  return 'An iron-poor recharge flushes the system. Fe²⁺ — the quencher — falls below the suppression threshold. The Mn-doped zones that grow next will fluoresce at full brightness. The boundary between the dim early zones and the bright new ones records the exact moment the iron dropped out of the broth. The crystal is now a stratigraphic record of the chemistry you played with.';
}

// --- deccan_zeolite ---
function event_deccan_zeolite_silica_veneer(c) {
  c.fluid.SiO2 += 400;
  c.fluid.Fe += 50;
  c.fluid.O2 = 0.9;
  c.temperature = 200;
  return "Stage I — hot post-eruption hydrothermal fluid coats the vesicle wall with chalcedony. Silica activity peaks; iron stripped from the basalt groundmass deposits as hematite needles on the chalcedony rind. These needles will become the seeds for the 'bloody apophyllite' phantom inclusions in Stage III.";
}

function event_deccan_zeolite_hematite_pulse(c) {
  c.fluid.Fe += 80;
  c.fluid.O2 = 1.0;
  c.temperature = 175;
  return "An iron-bearing pulse threads through the vesicle. Hematite needles seed the surfaces of any growing apophyllite. When the apophyllite resumes crystallization, those needles get trapped in the next growth zone — the Nashik 'bloody apophyllite' phantom band.";
}

function event_deccan_zeolite_stage_ii(c) {
  c.fluid.Ca += 80;
  c.fluid.K += 10;
  c.fluid.SiO2 += 200;
  c.fluid.pH = 8.5;
  c.temperature = 130;
  return 'Stage II — zeolite blades begin to fill the vesicle. Stilbite, scolecite, heulandite (modeled here as the zeolite paragenesis pH/Si signature). Calcite forms as a late-stage carbonate. The vug is filling slowly.';
}

function event_deccan_zeolite_apophyllite_stage_iii(c) {
  c.fluid.K += 25;
  c.fluid.Ca += 50;
  c.fluid.SiO2 += 300;
  c.fluid.F += 4;
  c.fluid.pH = 8.8;
  c.temperature = 150;
  return "Stage III — the apophyllite-bearing pulse arrives, alkaline K-Ca-Si-F groundwater. Per Ottens et al. 2019 this is the long-lasting late stage, 21–58 Ma after the original eruption. The pseudo-cubic apophyllite tablets begin to crystallize on the wall, on the chalcedony, on the hematite needles already present — wherever a nucleation site offers itself.";
}

function event_deccan_zeolite_late_cooling(c) {
  c.temperature = 80;
  c.fluid.pH = 8.0;
  c.flow_rate = 0.1;
  return 'Late cooling. The vesicle fluid drops back toward ambient. Apophyllite growth slows but doesn\'t stop entirely; the remaining K-Ca-Si-F supersaturation keeps adding micron-thin growth zones on the existing crystals. Time, not chemistry, becomes the limiting reagent.';
}

// --- ouro_preto (Imperial Topaz veins, Minas Gerais BR) ---
function event_ouro_preto_vein_opening(c) {
  c.fluid.SiO2 += 150;
  c.temperature = 380;
  c.flow_rate = 1.5;
  return 'The fracture opens. Fluid pressure exceeded lithostatic pressure and the vein propagated upward — narrow, barely wider than your hand. Fresh hot brine floods in at 380°C and quartz starts lining the walls. The fluorine in the fluid is still below saturation; topaz holds its breath.';
}

function event_ouro_preto_f_pulse(c) {
  c.fluid.F += 30.0;
  c.fluid.Al += 8.0;
  c.temperature = 365;
  c.flow_rate = 1.2;
  return `A deeper wall of phyllite reaches the dehydration point. Fluorine-bearing micas break down and release F⁻ into the vein fluid — F jumps to ${c.fluid.F.toFixed(0)} ppm, past the topaz saturation threshold. The chemistry has just tipped. Imperial topaz is now thermodynamically inevitable.`;
}

function event_ouro_preto_cr_leach(c) {
  c.fluid.Cr += 4.0;
  c.temperature = 340;
  return `The vein system intersects an ultramafic dike on its way up. Chromium leaches into the fluid — Cr now ${c.fluid.Cr.toFixed(1)} ppm, above the imperial-color window. Any topaz growing from this pulse forward will catch Cr³⁺ in its structure. Golden-orange is committed to the crystal.`;
}

function event_ouro_preto_steady_cooling(c) {
  c.temperature = 320;
  c.flow_rate = 1.0;
  return 'The main topaz growth phase. The vein cools steadily — 320°C now — and topaz is happily projecting from the quartz-lined walls. Slow, clean layer-by-layer growth. The crystals are recording the thermal history in their growth zones and fluid inclusions; a microprobe traverse across one of these crystals would read like a barometer.';
}

function event_ouro_preto_late_hydrothermal(c) {
  c.temperature = 220;
  c.fluid.pH = 5.5;
  c.flow_rate = 0.6;
  return "Late-stage dilute hydrothermal fluid — pH falling, F depleted by topaz growth. Kaolinite begins replacing any remaining feldspar in the wall rock; the vein walls soften. Topaz's perfect basal cleavage means any shift in the wall can snap a crystal off its base. Cleavage fragments will accumulate on the pocket floor.";
}

function event_ouro_preto_oxidation_stain(c) {
  c.temperature = 90;
  c.fluid.O2 = 1.6;
  c.fluid.Fe += 20;
  c.flow_rate = 0.3;
  return 'Surface water finds the vein. The system oxidizes — meteoric O₂ reaches the pocket, iron precipitates as goethite, and the final topaz generation sits in a limonite-stained matrix. The assemblage that garimpeiros will find in 400 Ma is now fully set.';
}

function event_ouro_preto_final_cooling(c) {
  c.temperature = 50;
  c.flow_rate = 0.05;
  return 'The vein cools to near-ambient. What remains is the assemblage: milky quartz lining the walls, imperial topaz prisms projecting inward, fluid inclusion planes across every crystal, iron-stained fractures. The exhalation has finished. The vug now waits for time.';
}

// --- gem_pegmatite (Cruzeiro mine, Doce Valley MG) ---
function event_gem_pegmatite_outer_shell(c) {
  c.temperature = 620;
  c.flow_rate = 1.0;
  return "The outer pegmatite shell is already cooling. Microcline and quartz dominate the wall zone, growing inward into the void. The pocket fluid inside is enriched in the elements nothing else wanted: beryllium, boron, lithium, fluorine. They haven't crossed any saturation thresholds yet — they are simply accumulating.";
}

function event_gem_pegmatite_first_schorl(c) {
  c.temperature = 560;
  c.flow_rate = 0.9;
  return "The pocket has cooled enough that tourmaline can form. Boron has been accumulating in the fluid for thousands of years; with Fe²⁺ still abundant, the schorl variety nucleates. Deep black prisms begin projecting from the wall. Each new zone records a fluid pulse — the striations are the pocket's diary.";
}

function event_gem_pegmatite_albitization(c) {
  c.fluid.K = Math.max(c.fluid.K - 30, 10);
  c.fluid.Na += 40;
  c.fluid.Al += 10;
  c.fluid.pH += 0.2;
  c.temperature = 500;
  return "Albitization event. The pocket's K has depleted faster than its Na — microcline starts dissolving and albite begins precipitating in its place. K²⁺ returns to the fluid, enabling a second generation of mica-like phases. This replacement cascade is the most Minas Gerais thing about a Minas Gerais pegmatite: the pocket is rearranging itself.";
}

function event_gem_pegmatite_be_saturation(c) {
  c.temperature = 450;
  c.flow_rate = 0.8;
  return "Beryllium has been accumulating for a dozen thousand years. Every earlier mineral refused it. Now σ crosses 1.8 and the first beryl crystal nucleates. Because Be had so long to build, the crystal has a lot of material waiting — this is how meter-long beryls form. What color depends on who else is in the fluid. Morganite if Mn won the lottery; aquamarine if Fe did; emerald if Cr leached in from an ultramafic contact somewhere.";
}

function event_gem_pegmatite_li_phase(c) {
  c.temperature = 420;
  c.fluid.Fe = Math.max(c.fluid.Fe - 20, 5);
  return "Temperature drops into the 400s. Lithium, which has been accumulating since the beginning, is now abundant enough to nucleate Li-bearing minerals. Spodumene will take most of it — the Li pyroxene wants its own crystals. Any remaining Li goes into elbaite overgrowths on the schorl cores: the crystals become color-zoned as iron depletes and lithium takes its place.";
}

function event_gem_pegmatite_late_hydrothermal(c) {
  c.temperature = 360;
  c.fluid.pH = 5.5;
  c.flow_rate = 0.5;
  return "Late hydrothermal phase. Temperature drops into topaz's optimum window (340–400°C). Fluorine has been sitting unused — nothing else in this pocket consumed it — and enough Al remains in the residual pocket fluid after the main silicate crop has taken its share. Topaz nucleates, projecting from the quartz lining.";
}

function event_gem_pegmatite_clay_softening(c) {
  c.temperature = 320;
  c.fluid.pH = 3.5;
  c.flow_rate = 0.3;
  return "pH drops into the kaolinization window. Microcline in the pocket walls starts breaking down into kaolinite — the signature 'clay gloop' that coats every Minas Gerais gem pocket by the time garimpeiros crack it open. The reaction 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite + 2 K⁺ + 4 SiO₂ releases potassium and silica to the fluid, but the aluminum stays locked in the new kaolinite. Albite is more acid-resistant and survives intact — a field observation preserved in the sim.";
}

function event_gem_pegmatite_final(c) {
  c.temperature = 300;
  c.flow_rate = 0.1;
  return "The system cools to 300°C, below spodumene's window and approaching topaz's lower edge. Growth slows to near-zero. Deep time will do the rest: this pocket will wait half a billion years before human hands crack it open, and the garimpeiros will sort the crystals by color in the order the fluid deposited them.";
}

// --- supergene_oxidation (Tsumeb 1st-stage gossan) ---
// Note: event_supergene_acidification is referenced 4× in the JSON5 spec
// (steps 5/8/12/16) to hold pH near 4 against the limestone wall's
// carbonate buffering. One handler, four event entries.
function event_supergene_acidification(c) {
  c.fluid.pH = 4.0;
  c.fluid.O2 = 1.5;
  c.fluid.S += 20;
  return 'Early acidic supergene phase. Primary sulfides oxidize and release H₂SO₄ — pH drops to 4.0, opening the acid window for the arsenate + sulfate suite (scorodite, jarosite, alunite). Carbonate buffering will reverse this at the meteoric flush; the acid-stable phases form during this short ~15-step window.';
}

function event_supergene_meteoric_flush(c) {
  c.fluid.O2 = 2.2;
  c.fluid.CO3 += 30;
  c.fluid.pH = 6.2;
  c.flow_rate = 1.5;
  return 'Rain infiltrates the soil zone and percolates down, picking up CO₂ and oxygen. Fresh supergene brine — cold, oxygen-rich, slightly acidic. Any remaining primary sulfides are on borrowed time.';
}

function event_supergene_pb_mo_pulse(c) {
  c.fluid.Pb += 40;
  c.fluid.Mo += 25;
  c.fluid.O2 = 2.0;
  c.flow_rate = 2.0;
  return 'A weathering rind breaches: Pb²⁺ and MoO₄²⁻ released simultaneously from an oxidizing galena+molybdenite lens. The Seo et al. (2012) condition for wulfenite formation — both parents dying at once — is met.';
}

function event_supergene_cu_enrichment(c) {
  c.fluid.Cu += 50.0;
  c.fluid.S += 30.0;
  c.fluid.Fe += 10.0;
  c.fluid.O2 = 0.6;
  return 'A primary chalcopyrite lens upslope finishes oxidizing. Cu²⁺ descends with the water table and hits the reducing layer below — the supergene enrichment blanket, where mineable copper ore gets made. Bornite precipitates on the upgradient edge, chalcocite in the core, covellite where S activity is highest. Real orebodies are often 5–10× richer here than in the primary sulfide below.';
}

function event_supergene_dry_spell(c) {
  c.fluid.Ca += 40;
  c.fluid.S += 30;
  c.fluid.O2 = 1.5;
  c.temperature = 50;
  c.flow_rate = 0.3;
  // v25: water table drops to mid-cavity → upper rings go vadose.
  c.fluid_surface_ring = 8.0;
  return "Dry season. Flow slows, evaporation concentrates the brine. Water table drops to mid-cavity. Ca²⁺ and SO₄²⁻ climb toward selenite's window — the desert-rose chemistry, the Naica chemistry. Above the meniscus, the air-exposed walls start to oxidize.";
}

function event_supergene_as_rich_seep(c) {
  c.fluid.As += 8;
  c.fluid.Cl += 10;
  c.fluid.Zn += 20;
  c.fluid.Co += 20;
  c.fluid.Ni += 20;
  c.fluid.pH = 6.0;
  c.temperature = 25;
  return 'An arsenic-bearing seep arrives from a weathering arsenopyrite body upslope, carrying trace cobalt and nickel from parallel oxidizing arsenides. Zn²⁺ saturates adamite; Pb²⁺ saturates mimetite; Co²⁺ and Ni²⁺ begin to bloom as crimson erythrite and apple-green annabergite.';
}

function event_supergene_phosphate_seep(c) {
  c.fluid.P += 6.0;
  c.fluid.Cl += 5.0;
  c.fluid.pH = 6.4;
  return "A phosphate-bearing groundwater seeps in from the soil zone — organic decay, weathered apatite bedrock, bat guano from above. P jumps past pyromorphite's saturation threshold, and any Pb still in solution has a new home.";
}

function event_supergene_v_bearing_seep(c) {
  c.fluid.V += 6.0;
  c.fluid.Cl += 8.0;
  c.temperature = 45;
  return "A vanadium-bearing seep arrives from a weathering red-bed ironstone upslope. V⁵⁺ leaches from oxidizing roll-front vanadates, and at Pb + V + Cl saturation the bright red-orange vanadinite nucleates — the classic 'vanadinite on goethite' habit of the Morocco / Arizona desert deposits.";
}

function event_supergene_fracture_seal(c) {
  c.flow_rate = 0.05;
  c.fluid.O2 = 1.0;
  return 'The feeding fractures seal. The vug becomes a closed cold oxidizing system. Whatever is supersaturated will precipitate; whatever is undersaturated will quietly corrode.';
}

// --- bisbee (Warren Mining District, AZ — Cu porphyry + supergene + azurite/malachite/chrysocolla cascade) ---
function event_bisbee_primary_cooling(c) {
  c.temperature = 320;
  c.fluid.SiO2 += 100;
  c.fluid.Cu -= 50;
  c.fluid.O2 = 0.08;
  c.flow_rate = 1.2;
  return 'The Sacramento Hill porphyry finishes its main crystallization pulse. Chalcopyrite and bornite precipitate in the vein selvages of the Escabrosa mantos — Cu:Fe:S in the magmatic ratio. Pyrite frames the assemblage, locked in at 300+ °C. The ore body is set. For 180 million years, nothing will happen.';
}

function event_bisbee_uplift_weathering(c) {
  c.temperature = 35;
  c.fluid.pH = 4.0;
  c.fluid.O2 = 0.8;
  c.fluid.S += 80;
  c.fluid.Cu += 100;
  c.fluid.Fe += 50;
  c.flow_rate = 1.8;
  return 'Mesozoic–Cenozoic uplift tips the Warren basin and strips the Cretaceous cover. Meteoric water percolates down through fractures, hitting pyrite; sulfuric acid is the first product. The pH crashes to 4, and Cu²⁺ starts descending with the water table. This is the enrichment pulse — primary ore above is dissolving, concentrating its copper at the redox interface below.';
}

function event_bisbee_enrichment_blanket(c) {
  c.temperature = 30;
  c.fluid.Cu += 80;
  c.fluid.S += 40;
  c.fluid.O2 = 0.6;
  c.fluid.pH = 4.5;
  c.flow_rate = 1.3;
  return 'The descending Cu²⁺-bearing fluid reaches the reducing layer just below the water table. Chalcocite replaces chalcopyrite atom-for-atom — the Bisbee enrichment blanket, 5–10× the primary grade. Covellite forms where S activity is highest. This is the mineable ore. For two generations of miners, this is what Bisbee MEANS.';
}

function event_bisbee_reducing_pulse(c) {
  c.fluid.O2 = 0.05;
  c.fluid.S = 15;
  c.fluid.Cu += 150;
  c.fluid.pH = 6.0;
  c.temperature = 28;
  c.flow_rate = 1.1;
  return "A barren reducing fluid pulses up from depth — lower than any water table. For a few thousand years the pocket's Eh is below cuprite stability. Native copper precipitates in the fracture selvages as arborescent sheets and wire. The Bisbee native-copper specimens — the Cornish-style copper trees — are products of exactly these brief windows.";
}

function event_bisbee_oxidation_zone(c) {
  c.temperature = 25;
  c.fluid.O2 = 1.0;
  c.fluid.pH = 6.2;
  c.fluid.S = Math.max(c.fluid.S - 60, 20);
  c.fluid.Cu += 40;
  c.fluid.Fe -= 30;
  c.fluid.CO3 += 30;
  c.flow_rate = 1.0;
  return 'The water table drops another 50 meters. The enrichment blanket is now in the unsaturated zone — oxygen reaches it directly. Cuprite forms where the Eh is still low; native copper sheets grow in the fractures where reducing pockets survive. The limestone walls are finally participating — pH climbs toward neutral, and CO₃ rises with it.';
}

function event_bisbee_azurite_peak(c) {
  c.fluid.CO3 += 80;
  c.fluid.Cu += 30;
  c.fluid.O2 = 1.3;
  c.fluid.pH = 7.0;
  c.flow_rate = 0.9;
  return "A monsoon season — the first in many. CO₂-charged rainwater infiltrates fast, dissolves limestone aggressively, and hits the copper pocket at pH 7 with CO₃ at 110+ ppm. Azurite — deep midnight-blue monoclinic prisms and radiating rosettes — nucleates from the supersaturated brine. This phase produces the showpiece 'Bisbee Blue' specimens.";
}

function event_bisbee_co2_drop(c) {
  c.fluid.CO3 = Math.max(c.fluid.CO3 - 120, 50);
  c.fluid.O2 = 1.4;
  c.fluid.pH = 6.8;
  c.flow_rate = 0.7;
  return "The climate dries. Without CO₂-charged infiltration the pocket's pCO₂ falls below azurite's stability — every azurite crystal in the vug starts converting. The color shift creeps crystal-by-crystal: deep blue → green rind → green core. Vink (1986) put the crossover at log(pCO₂) ≈ −3.5 at 25 °C, right where we are. Malachite pseudomorphs after azurite are the diagnostic Bisbee specimen — frozen mid-transition.";
}

function event_bisbee_silica_seep(c) {
  c.fluid.SiO2 += 90;
  c.fluid.Cu += 20;
  c.fluid.CO3 = Math.max(c.fluid.CO3 - 30, 20);
  c.fluid.pH = 6.5;
  c.fluid.O2 = 1.3;
  c.flow_rate = 0.8;
  return 'A new seep arrives — from weathering of the Sacramento Hill quartz-monzonite porphyry uphill, not the limestone. It brings dissolved SiO₂ at 100+ ppm. Where this fluid meets the Cu²⁺ still in solution the cyan enamel of chrysocolla precipitates: thin films over cuprite, botryoidal crusts on native copper, and — the Bisbee centerpiece — pseudomorphs replacing the last azurite blues.';
}

function event_bisbee_final_drying(c) {
  c.temperature = 20;
  c.flow_rate = 0.1;
  c.fluid.O2 = 1.0;
  // v25: complete drain — every ring becomes vadose.
  c.fluid_surface_ring = 0.0;
  return "The fractures seal with calcite cement. Groundwater stops. The pocket is a closed system again, this time with the full oxidation assemblage frozen in place: chalcopyrite cores wrapped in chalcocite, those wrapped in cuprite, those overgrown by native copper, those overgrown by azurite, those converted to malachite, those pseudomorphed by chrysocolla. A million years from now, when a mining shaft intersects this pocket, an assayer will photograph the specimen and write 'Bisbee, Cochise County' on the label.";
}

// --- sabkha_dolomitization (Coorong/Persian Gulf cycling brine, Kim 2023 mechanism) ---
// flood + evap each fire 12× via the supergene_acidification handler-reuse
// precedent. Cycle number is preserved via the event `name` field.
function event_sabkha_flood(c) {
  c.fluid.Mg = 800;
  c.fluid.Ca = 250;
  c.fluid.CO3 = 50;
  c.fluid.Sr = 12;
  c.fluid.pH = 8.0;
  c.flow_rate = 1.5;
  return 'Flood pulse: low-alkalinity tidal seawater enters the lagoon. CO₃ crashes from sabkha brine levels back to ~50 ppm. Dolomite supersaturation drops below 1 — the disordered Ca/Mg surface layer detaches preferentially (Kim 2023 etch).';
}

function event_sabkha_evap(c) {
  c.fluid.Mg = 2000;
  c.fluid.Ca = 600;
  c.fluid.CO3 = 800;
  c.fluid.Sr = 30;
  c.fluid.pH = 8.4;
  c.flow_rate = 0.1;
  c.temperature = 28;
  return 'Evaporation pulse: sun bakes the lagoon. Brine reconcentrates to sabkha state — Mg=2000, Ca=600, CO₃=800. Dolomite saturation climbs back well above 1; growth resumes on the ordered template the previous etch left behind. Cycle complete; ordering ratchets up.';
}

function event_sabkha_final_seal(c) {
  c.flow_rate = 0.05;
  c.temperature = 22;
  return "Sabkha matures, then seals. The crust hardens and groundwater stops cycling. What remains is the result of twelve dissolution-precipitation cycles — ordered dolomite where the cycling did its work, disordered HMC where it didn't. The Coorong recipe for ambient-T ordered dolomite, the natural laboratory that Kim 2023 finally explained at the atomic scale.";
}

// v29 evaporite-locality scenarios — Naica + Searles Lake events.
// Mirror of event_naica_* + event_searles_* in vugg.py.

function event_naica_slow_cooling(c) {
  if (c.temperature > 51) c.temperature -= 0.7;
  c.fluid.Ca = Math.max(c.fluid.Ca, 280);
  c.fluid.S = Math.max(c.fluid.S, 380);
  c.fluid.O2 = 1.5;
  c.fluid.pH = 7.2;
  c.flow_rate = 0.3;
  return `Geothermal pulse: anhydrite at depth dissolves slightly, resupplying Ca + SO₄ to the rising hot brine. T drifts down to ${c.temperature.toFixed(1)}°C — still above the 54°C Naica equilibrium. Selenite cathedral blades grow another notch. Garcia-Ruiz: "hundredths of a degree per year" maintained for half a million years.`;
}

function event_naica_mining_drainage(c) {
  c.fluid_surface_ring = 0.0;
  c.flow_rate = 0.05;
  c.temperature = 35;
  return "1985 — mining at Naica deepens to 290m. Industrial pumps lower the water table below the Cueva de los Cristales. The 12-metre selenite blades stop growing the moment their bath drains; what's left in the cave is the freshest snapshot of the last half-million years of growth, frozen.";
}

function event_naica_mining_recharge(c) {
  c.fluid_surface_ring = 1.0e6;
  c.flow_rate = 0.5;
  c.temperature = 30;
  return "2017 — Naica's mining stops. The pumps shut down and the cave refloods over a few months. Decades-old vadose rinds dissolve in the fresh groundwater; selenite resumes slow growth in the cooler 30°C bath. The cave is no longer accessible — sealed away from researchers, safe from tourists, growing again.";
}

function event_searles_winter_freeze(c) {
  c.temperature = 8;
  c.fluid.Na = Math.max(c.fluid.Na, 1500);
  c.fluid.S = Math.max(c.fluid.S, 250);
  c.fluid.B = Math.max(c.fluid.B, 100);
  c.fluid.Cl = Math.max(c.fluid.Cl, 1200);
  c.fluid.pH = 9.5;
  c.fluid.O2 = 1.6;
  c.flow_rate = 0.2;
  c.fluid_surface_ring = 4.0;
  return `Searles Lake winter night. T=${c.temperature.toFixed(0)}°C; cold-air sublimation drops the playa surface to ring ${c.fluid_surface_ring.toFixed(0)}. The brine is below the 32°C mirabilite-thenardite eutectic. Glauber salt crystallizes in fibrous beds, halite hopper cubes form, and borax fires from the deep alkaline pH.`;
}

function event_searles_summer_bake(c) {
  c.temperature = 55;
  c.flow_rate = 0.1;
  c.fluid.O2 = 1.8;
  c.fluid_surface_ring = 0.0;
  return `Searles Lake summer afternoon. T=${c.temperature.toFixed(0)}°C; playa surface drops to ring ${c.fluid_surface_ring.toFixed(0)}. Cold-evaporite minerals don't survive this heat — mirabilite loses its 10 water molecules and becomes thenardite where it stands; borax effloresces to tincalconite. By evening, what was a clear Glauber blade is a powdery pseudomorph.`;
}

function event_searles_fresh_pulse(c) {
  c.fluid_surface_ring = 1.0e6;
  c.flow_rate = 1.5;
  c.temperature = 20;
  return "Sierra snowmelt pulse — fresh meteoric water arrives at Searles Lake. The brine dilutes, salt crusts begin to redissolve, and the basin briefly resembles a real lake. Within weeks the heat returns and the cycle starts over.";
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
