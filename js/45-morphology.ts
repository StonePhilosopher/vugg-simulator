// ============================================================
// js/45-morphology.ts — mineral-agnostic interface-morphology registry
// ============================================================
// Registry hoist (morphology-generalization arc, 2026-06-12): the
// calcite-morphology arc (2026-06-11, proposals/HANDOFF-CALCITE-
// MORPHOLOGY-2026-06-11.md) built a classification pipeline whose
// PHYSICS is universal — Sunagawa's driving-force ladder applies to any
// layer-growth mineral:
//
//   polyhedral/spiral → stepped → hopper/skeletal (instability ONSET,
//   hollow faces still faceted) → dendritic (instability furthered)
//
// (17th catch — peer-review corrected; never regress this order.)
// What is mineral-SPECIFIC is only the calibration: band edges,
// boundary-layer damping scale, impurity hooks, the form rule. This
// file holds the shared machinery + one threshold table per registered
// mineral; engines keep their own physics helpers and the per-mineral
// display flavor.
//
// Registry contract (MORPH_TH.<mineral>):
//   SPIRAL_MAX < STEP_MILD_MAX < STEP_MACRO_MAX < HOPPER_MAX
//     — band edges in Sunagawa order, in the MINERAL'S OWN σ units.
//     σ scales are NOT comparable across minerals (calcite's omega-like
//     supersaturation_calcite() measured 1.05–664; halite's quadratic-
//     in-concentration scale is different beast entirely). Every entry
//     must be calibrated on its own fleet survey — never transcribe
//     another mineral's edges, never transcribe paper thresholds
//     (research doc §5).
//   SIZE_HALF_UM, SIZE_DAMP_CAP_UM — boundary-layer damping (below).
//   sigma(conditions)        → bulk σ (the mineral's supersat method).
//   effSigmaMult(conditions) → OPTIONAL impurity multiplier applied
//                              before the regime cut (calcite: Mg
//                              step-edge pinning).
//   form(conditions)         → OPTIONAL crystallographic form tag
//                              (calcite: Mg/T → scalenohedral).
//
// Basis rule (18th catch — the basis ports WITH the thresholds): the
// pass runs at the END of run_step, AFTER growth + mass balance +
// diffusion, so zones are classified from the POST-STEP σ. The first
// calcite draft classified inside grow_calcite from the IN-STEP
// (pre-growth) σ; the --engine agreement check exposed 0% agreement on
// stalactite_demo — thin-film scenarios inject a σ spike each step that
// the crystal itself consumes within the step. The crystal's interface
// never sees that transient (boundary-layer buffering, Wolthers 2022),
// so the depleted post-step σ is the physical proxy for interface σ.
// Any mineral whose grow_* makes in-step habit decisions from in-step σ
// (the pre-hoist halite/sylvite/bismuth pattern) must have its band
// edges RE-CALIBRATED on the post-step basis, not copied.
//
// The pass is PURE TAGGING: no rng, no fluid mutation — chemistry is
// byte-identical whether or not a mineral is registered.

// Regime list in Sunagawa order (index = severity ordinal — strip chips
// record this ordinal; shared by every registered mineral so ordinals
// stay comparable across chips).
const MORPH_REGIMES = ['spiral_smooth', 'stepped_mild', 'stepped_macro', 'hopper_skeletal', 'dendritic'];

// Player-facing display flavor per mineral (zone modal, strip-chip
// hovertext, library cards). The REGIME tokens are shared physics
// vocabulary; the display strings speak each mineral's field language
// ("smooth spar" vs "smooth cube"). Fallback = the raw token.
const MORPH_DISPLAY: Record<string, Record<string, string>> = {
  calcite: {
    spiral_smooth: 'smooth spar',
    stepped_mild: 'stepped (mild)',
    stepped_macro: 'stepped (macrostep)',
    hopper_skeletal: 'hopper/skeletal',
    dendritic: 'dendritic',
  },
  halite: {
    spiral_smooth: 'smooth cube',
    stepped_mild: 'banded cube (chevron)',
    stepped_macro: 'macrostepped cube',
    hopper_skeletal: 'hopper/raft',
    dendritic: 'dendritic crust',
  },
  sylvite: {
    spiral_smooth: 'smooth cube',
    stepped_mild: 'banded cube',
    stepped_macro: 'macrostepped cube',
    hopper_skeletal: 'hopper',
    dendritic: 'dendritic crust',
  },
  native_bismuth: {
    spiral_smooth: 'massive/foliated',
    stepped_mild: 'feathery laths',
    stepped_macro: 'feather bismuth (skeletal)',
    hopper_skeletal: 'skeletal frame',
    dendritic: 'arborescent dendrite',
  },
  fluorite: {
    spiral_smooth: 'glassy cube',
    stepped_mild: 'growth-banded cube',
    stepped_macro: 'composite/stepped cube',
    hopper_skeletal: 'hopper frame',
    dendritic: 'dendritic',
  },
  pyrite: {
    spiral_smooth: 'smooth euhedral (Navajún glass)',
    stepped_mild: 'finely striated',
    stepped_macro: 'coarsely striated/stepped',
    hopper_skeletal: 'skeletal',
    dendritic: 'dendritic crust',
  },
  native_copper: {
    spiral_smooth: 'crystalline (cube/dodecahedron)',
    stepped_mild: 'wire/filamentary',
    stepped_macro: 'arborescent onset',
    hopper_skeletal: 'skeletal branches',
    dendritic: 'dendritic trees',
  },
  native_gold: {
    spiral_smooth: 'octahedral (rare crystal)',
    stepped_mild: 'spongy',
    stepped_macro: 'dendritic/fishbone',
    hopper_skeletal: 'skeletal leaf',
    dendritic: 'wire/arborescent',
  },
};

function morphDisplayLabel(mineral: string, regime: string): string {
  return (MORPH_DISPLAY[mineral] && MORPH_DISPLAY[mineral][regime]) || regime;
}

const MORPH_TH: Record<string, any> = {};

// ---- calcite — first tenant (the arc that built this machinery) ----
// Surface σ lags bulk σ on big slow crystals (boundary-layer damping,
// Wolthers 2022): surfσ = 1 + (bulkσ−1)/(1 + size/SIZE_HALF_UM).
// σ here is the sim's omega-like supersaturation_calcite() (measured
// 1.05–664), NOT the papers' reduced σ — do not transcribe paper
// thresholds (research doc §5).
MORPH_TH.calcite = {
  SIZE_HALF_UM: 80,
  // Phase 5 (2026-06-11): the boundary layer is BOUNDED. The original
  // proxy let damping grow linearly with crystal size forever, which
  // divided a 19 mm crystal's σ-excess by ~240 — no geologically sane
  // chemistry could ever step a cabinet-scale crystal, yet stepped
  // GIANTS are exactly what Elmwood grows (the locality ground truth
  // that exposed the flaw). Wolthers 2022's own model parameterizes a
  // FIXED boundary-layer thickness — δ saturates at the hydrodynamic
  // scale (~mm in still fluid), it does not track crystal size without
  // limit. min(size, SIZE_DAMP_CAP_UM) is the faithful proxy: crystals
  // under 2 mm behave exactly as before; giants damp at the δ ceiling
  // (factor 26) instead of without bound. Fleet consequence (measured,
  // recorded in the research doc §1): the sustained-high-σ big-crystal
  // scenarios (marble, deccan, jeffrey) pick up gentle stepped_mild
  // shares — Sunagawa-consistent for sustained driving force — while
  // every dramatic band (macro/hopper/dendrite) and every smooth
  // low-σ scenario (mvt q75 6.4 → surf 1.2, Tri-State spar stays
  // glass) holds. Chemistry-invisible by Phase 2's aspect-preserving
  // design (regime renames carry the parent form's aspect ratio).
  SIZE_DAMP_CAP_UM: 2000,
  SPIRAL_MAX: 2.0,      // < this → smooth spiral spar (BCF lateral growth)
  STEP_MILD_MAX: 8.0,   // 2–8 → gentle macrosteps (onset 2D nucleation)
  STEP_MACRO_MAX: 50.0, // 8–50 → pronounced macrostepped (step bunching)
  HOPPER_MAX: 200.0,    // 50–200 → hopper/skeletal (faces hollow, faceted)
  // ≥ HOPPER_MAX → dendritic (the instability branches)
  MG_SCALENO: 0.15,     // Mg:Ca above this → scalenohedral elongation
  // Phase 4 (Mg axis, 2026-06-11): Mg²⁺ pins step edges (growth
  // inhibition, GCA 2015 / AFM literature) → the same σ bunches HARDER
  // in Mg-rich fluid. Encoded as an effective-σ multiplier
  // (1 + MG_BUNCH·min(Mg:Ca, 1)) applied before the regime cut.
  // k=0.4 calibrated by fleet observation (tools/_probe-mg-axis sweep,
  // recorded in the research doc §4): Jeffrey Mine (Mg:Ca 0.84,
  // serpentinite water) shifts toward stepped — the §6.3 hook — while
  // every scenario's DOMINANT regime stays the validated one; k=0.8
  // over-steepened the dripstone family toward dendrite, against
  // ground truth.
  MG_BUNCH: 0.4,
  // KEEP THE THRESHOLDS IN SYNC with tools/calcite-morphology-map.mjs
  // (the transparent bench — its --engine mode cross-checks this table).
  sigma(conditions: any): number { return conditions.supersaturation_calcite(); },
  effSigmaMult(conditions: any): number {
    const f = conditions.fluid;
    const mgRatio = (f.Mg || 0) / Math.max(1e-6, f.Ca || 0);
    return 1 + MORPH_TH.calcite.MG_BUNCH * Math.min(mgRatio, 1);
  },
  form(conditions: any): string {
    const f = conditions.fluid;
    const mgRatio = (f.Mg || 0) / Math.max(1e-6, f.Ca || 0);
    return calciteMorphForm(mgRatio, conditions.temperature); // physics in js/52 (hoisted bundle-wide)
  },
};

// ---- halite + sylvite — second tenant (the upgrade-in-place; bands
// from proposals/RESEARCH-halide-morphology-2026-06-12.md) ----
// Survey facts (tools/morph-sigma-observe.mjs, seed 42): post-step σ ==
// in-step σ to 3 figures (concentration-driven; growth barely dents the
// Na/Cl pool — calcite's 18th-catch thin-film gap does NOT recur), and
// σ history is QUANTIZED into plateaus by the evaporite concentration
// driver (searles halite: 42.6 baseline ↔ 385 spike) — so zone tags
// stratify by wet/dry pulse phase and the crystal records the pan log.
//
// NO boundary-layer damping (SIZE_HALF_UM = Infinity → surfσ = bulk σ):
// calcite's damping models DIFFUSION-limited growth in still vug fluid
// (Wolthers fixed-δ); evaporite brines convect at the growth front
// (NaCl removal lightens the boundary fluid → density currents), and
// hopper morphology IS the Berg effect — corners fed by fresher brine
// than face centers. Ground truth seals it: the biggest natural halite
// (rafts, chevron beds) is the MOST hoppered/banded — the inverse of
// the damped-giant prediction. Damping would smooth searles' 54 mm
// crystals into glass. Per-mineral knob by construction.
//
// Band edges in HALITE's own post-step sim units (registry contract:
// never compare across minerals), placed against locality ground truth:
// searles spikes (385) → hopper rafts, searles baseline (42.6) →
// chevron/fluid-inclusion-banded cube (Lowenstein & Hardie 1985,
// Sedimentology 32 — the salt-pan texture canon); bisbee (8.28) /
// sicily (4.55) / tn457 (3.84) / travertine (1.15) → smooth cubes.
// Dendrite band (efflorescence crusts) deliberately unoccupied in the
// fleet, like calcite's.
MORPH_TH.halite = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 10.0,      // < this → smooth {100} cube
  STEP_MILD_MAX: 60.0,   // 10–60 → growth-banded cube (chevron banding)
  STEP_MACRO_MAX: 150.0, // 60–150 → coarse macrostepped cube
  HOPPER_MAX: 800.0,     // 150–800 → hopper/skeletal (cavernous faces, rafts)
  // ≥ HOPPER_MAX → dendritic (efflorescence crust)
  sigma(conditions: any): number { return conditions.supersaturation_halite(); },
  form(_conditions: any): string { return 'cube'; },
};

// Sylvite: same physics, its own σ units (searles spikes 20.0 → hopper
// — the old engine's own 'hopper_cube' call, now banded + remembered;
// searles baseline 2.22 / bisbee 1.72 → smooth). Legacy in-step flip
// (>4.0) would have called searles BASELINE zones hopper; the ladder is
// strictly more honest.
MORPH_TH.sylvite = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 3.0,
  STEP_MILD_MAX: 8.0,
  STEP_MACRO_MAX: 16.0,
  HOPPER_MAX: 60.0,
  sigma(conditions: any): number { return conditions.supersaturation_sylvite(); },
  form(_conditions: any): string { return 'cube'; },
};

// ---- native bismuth — third tenant (the corrected ladder) ----
// Survey + design: proposals/RESEARCH-bismuth-morphology-2026-06-12.md.
// σ is STRUCTURALLY CAPPED at ~4.5 (js/36: bi_f≤3.0 × red_f≤1.5) — the
// whole ladder fits in [1, 4.5]; edges are PROVISIONAL until the
// five-element scenario (`wittichen`) gives the upper bands a tenant,
// then re-pin against its measured σ trajectory. Current fleet truth:
// schneeberg's brief primary Bi (σ ≤ 1.32) lives in the smooth band as
// massive/foliated veinlet Bi, then the v185 oxidation swing destroys
// it — both halves correct geology.
// No damping (Infinity): redox-shock precipitation in a vein shoot is
// advection/reaction-controlled, and the natural dendrites are the
// BIGGEST masses (kg-scale Wismut sheets) — the halite inverse-argument
// again. Hopper band kept for ladder completeness but expected empty:
// the rainbow funnel is MELT growth (271°C mp), not hydrothermal.
// Edges RE-PINNED 2026-06-12 against wittichen's measured seed-42
// trajectory (the §5 calibration pass, same session): the ~4.5
// structural cap is the DILUTE ceiling — at a real five-element
// basement brine (salinity 24, Staude 2012) the ACTIVITY CORRECTION
// compresses it to ~2.4 in practice. Measured: cooling-ramp Bi runs
// 1.6–2.0 (feathery), the CH4-shock plateau sits flat at 2.27 for ~8
// steps (the σ ceiling under brine activity = the dendrite moment),
// schneeberg's quiet plateau stays ≤1.32 (smooth — unchanged claim).
// Original provisional edges (1.5/2.2/3.0/3.8) were placed before any
// scenario could occupy the upper bands; these are the measured ones.
MORPH_TH.native_bismuth = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 1.4,       // < this → massive/foliated (+ rare crystal dice-roll); schneeberg ≤1.32 lives here
  STEP_MILD_MAX: 1.8,    // feathery laths (wittichen cooling ramp 1.6–1.8)
  STEP_MACRO_MAX: 2.1,   // feather bismuth (the ramp's driven top, 1.8–2.1)
  HOPPER_MAX: 2.25,      // skeletal sliver (transition into the shock)
  // ≥ 2.25 → arborescent dendritic — the CH4-shock plateau (2.27 measured)
  sigma(conditions: any): number { return conditions.supersaturation_native_bismuth(); },
  form(_conditions: any): string { return 'native'; },
};

// ---- fluorite — fourth tenant (the elmwood two-mineral showcase) ----
// Survey (tools/morph-sigma-observe.mjs, seed 42): six scenarios, σ
// range 1.25–7.16, in-step == post-step (stable like the halides).
// Plateaus → claims (defer-to-geology):
//   reactivated_fluorite_vein 7.15 → stepped_macro: COMPOSITE/stepped
//     cube faces — re-opened vein regrowing fast on old crystals
//   elmwood base 3.96 / fault-valve spikes 5.94 → smooth ↔ banded:
//     the SAME CO3/pH pulses that step the golden calcite zone the
//     purple cubes — the two-mineral showcase (real Elmwood fluorite
//     carries stepped/composite faces)
//   mvt 4.96 → smooth (just under the edge — Tri-State glassy cubes)
//   zoned_dripstone 2.21 / sunnyside 1.95 / jeffrey 1.3 → smooth
// No damping: fluorite's whole fleet range spans 1.2–7.2 — the edges
// separate the claims directly on bulk σ; a calcite-style size damp
// would glass every cabinet crystal (elmwood fluorite is 20 mm) with
// nothing for the band structure to gain.
// FORM: composes with the v103 REE rule — the registry form hook
// mirrors grow_fluorite's own Y>1 {111} flip (Bosze & Rakovan 2002).
// Regime HABIT renames apply to BOTH paths since 2026-06-12: the cube
// alphabet AND the REE octahedra (stepped_/hopper_/dendritic_
// octahedral_REE — fleet-inert today, sunnyside is flat at σ 1.95;
// fires when a driven Y-fluorite scenario lands).
MORPH_TH.fluorite = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 5.0,       // < this → smooth glassy cube (mvt 4.96 lives here)
  STEP_MILD_MAX: 6.5,    // growth-banded cube (elmwood pulse plateaus 5.94)
  STEP_MACRO_MAX: 7.5,   // composite/stepped cube (reactivated vein 7.15)
  HOPPER_MAX: 9.0,       // hopper frame (unoccupied in fleet)
  // ≥ 9.0 → dendritic (unoccupied — kept for ladder completeness)
  sigma(conditions: any): number { return conditions.supersaturation_fluorite(); },
  form(conditions: any): string { return (conditions.fluid.Y > 1.0) ? 'octahedron' : 'cube'; },
};

// ---- pyrite — fifth tenant (striations ARE step bunching) ----
// Survey: 6 scenarios, σ 1.2–3.84, CONTINUOUS within-scenario
// distributions (unlike the halide plateaus) → pyrite crystals are
// ZONED smooth↔striated as the fluid wanders. The striations on pyrite
// faces ({100} and {210} both) are oscillatory combination-growth step
// bunching — the literal physical phenomenon the stepped bands model
// (Murowchick & Barnes 1987: T + saturation control pyrite morphology).
// Claims: sunnyside/elmwood/reactive_wall (σ 1.2–1.5) smooth — small
// early euhedra; mvt (p50 1.59, max 3.27) MIXED smooth↔striated;
// reactivated vein (2.44–3.49) + sulphur_bank (2.47–3.84) striated→
// coarse — vein and hot-spring pyrite is striated, the glassy
// unstriated cube is the EXCEPTION in nature (Navajún's fame).
// FORM is T-driven in grow_pyrite (>300 cube / 200–300 pyritohedron /
// 100–200 combo / <100 framboidal-micro) — the form hook mirrors it;
// the regime overlays 'striated_' onto the euhedral forms only.
MORPH_TH.pyrite = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 1.6,       // < this → smooth euhedra (the Navajún glass)
  STEP_MILD_MAX: 2.4,    // fine striations
  STEP_MACRO_MAX: 3.2,   // coarse striations / stepped composite faces
  HOPPER_MAX: 4.2,       // skeletal pyrite (fleet max 3.84 — just unoccupied)
  // ≥ 4.2 → dendritic (marcasite-territory crusts; unoccupied)
  sigma(conditions: any): number { return conditions.supersaturation_pyrite(); },
  form(conditions: any): string {
    const T = conditions.temperature;
    if (T > 300) return 'cube';
    if (T > 200) return 'pyritohedron';
    if (T > 100) return 'cubo-pyritohedral';
    return 'framboidal';
  },
};

// ---- native copper + native gold — sixth/seventh tenants (the
// conflation sweep that closes the boss's list) ----
// Copper (bisbee, the only home): σ rides the v186 −400 mV pulse —
// measured ramp 1.0 → 2.09 (peak EXACTLY at the pulse center, step
// 133) → 0; the crystal then dissolves in the azurite-era oxidation
// (the Cornish trees survive as casts — grows-then-dies is the correct
// geology, like schneeberg's bismuth). Bands on the measured ramp: the
// σ ceiling IS the dendrite moment (the bismuth activity-ceiling
// lesson). The legacy dispatch was ALREADY Sunagawa-ascending
// (crystal → wire → arborescent) except massive_sheet at top — a
// fissure-fill aggregate TEXTURE (Keweenaw), not interface morphology,
// and dead code at current calibration (needs σ>2.5; fleet max 2.09).
MORPH_TH.native_copper = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 1.3,       // rare well-formed cube/dodecahedron
  STEP_MILD_MAX: 1.7,    // wire/filamentary growth
  STEP_MACRO_MAX: 1.95,  // arborescent onset
  HOPPER_MAX: 2.05,      // skeletal sliver
  // ≥ 2.05 → dendritic — the −400 pulse peak (the Cornish trees)
  sigma(conditions: any): number { return conditions.supersaturation_native_copper(); },
  form(_conditions: any): string { return 'native'; },
};

// Gold: bisbee plateau 2.77–2.89 (1309 zones), porphyry 1.35. The
// legacy dispatch had octahedral at the bottom (correct!) and nugget
// at the top — the same texture/morphology conflation as bismuth's
// massive and copper's sheet (nuggets are PLACER/accretion features;
// the sim never models transport). Bands → bisbee oxide-zone gold
// reads spongy DENDRITIC (which it is — the fishbone-and-leaf habit),
// porphyry stays the rare octahedral inclusion.
MORPH_TH.native_gold = {
  SIZE_HALF_UM: Infinity,
  SIZE_DAMP_CAP_UM: Infinity,
  SPIRAL_MAX: 1.8,
  STEP_MILD_MAX: 2.5,
  STEP_MACRO_MAX: 3.2,
  HOPPER_MAX: 4.5,
  sigma(conditions: any): number { return conditions.supersaturation_native_gold(); },
  form(_conditions: any): string { return 'native'; },
};

function morphSurfaceSigma(th: any, bulkSigma: number, sizeUm: number): number {
  const effSize = Math.min(Math.max(0, sizeUm), th.SIZE_DAMP_CAP_UM);
  return 1 + (bulkSigma - 1) / (1 + effSize / th.SIZE_HALF_UM);
}

function morphRegime(th: any, surfSigma: number): string {
  if (surfSigma < th.SPIRAL_MAX) return 'spiral_smooth';
  if (surfSigma < th.STEP_MILD_MAX) return 'stepped_mild';
  if (surfSigma < th.STEP_MACRO_MAX) return 'stepped_macro';
  if (surfSigma < th.HOPPER_MAX) return 'hopper_skeletal';
  return 'dendritic';
}

// Morphology classification pass — called at the END of run_step (js/85),
// after the redox sync, before strip capture. Iterates the registry;
// each registered mineral's crystals get this step's zone tagged
// (morph_regime / morph_form / morph_surf_sigma) plus the live
// crystal._morphology summary that habit dispatch reads next step.
// Terrace-band knot walk — the mineral-agnostic core of the zone-stack
// → render-geometry read (extracted from calciteTerraceBands in the
// halide render wave, 2026-06-12; the walk itself was always pure
// zone-tag arithmetic). Returns null when the crystal should render
// smooth (no tags, or relief share < 5% of grown mass — a smooth
// crystal with a stepped sliver of core stays visually smooth, matching
// hand specimens). Otherwise { knots: [{frac, regime}] (band END
// fractions of total grown size, ascending, last === 1.0), hopperTip }.
// Callers wrap it with the mineral's form token (js/52
// calciteTerraceBands → 'scalene'/'rhomb'; halideTerraceBands below →
// 'cube'). uptoStep = replay truncation: terraces ACCUMULATE as the
// scrubber advances.
function morphTerraceKnots(crystal: any, uptoStep: any) {
  if (!crystal || !crystal.zones || !crystal.zones.length) return null;
  const RELIEF: Record<string, boolean> = { stepped_mild: true, stepped_macro: true, hopper_skeletal: true };
  const bands: Array<{ regime: string, mass: number }> = [];
  let total = 0, reliefMass = 0;
  for (const z of crystal.zones) {
    if (uptoStep != null && z.step != null && z.step > uptoStep) break;
    const t = z.thickness_um || 0;
    if (t <= 0) continue;
    const regime = z.morph_regime || 'spiral_smooth';
    total += t;
    if (RELIEF[regime]) reliefMass += t;
    const last = bands[bands.length - 1];
    if (last && last.regime === regime) last.mass += t;
    else bands.push({ regime, mass: t });
  }
  if (total <= 0 || reliefMass / total < 0.05) return null;
  // Merge sub-1.5% slivers into their predecessor so the knot list stays
  // renderable (a 200-zone crystal collapses to a handful of bands).
  const merged: Array<{ regime: string, mass: number }> = [];
  for (const b of bands) {
    const prev = merged[merged.length - 1];
    if (prev && (b.mass / total < 0.015 || prev.regime === b.regime)) prev.mass += b.mass;
    else merged.push({ regime: b.regime, mass: b.mass });
  }
  let acc = 0;
  const knots = merged.map((b) => {
    acc += b.mass;
    return { frac: acc / total, regime: b.regime };
  });
  knots[knots.length - 1].frac = 1.0;  // close exactly despite float drift
  const lastBand = merged[merged.length - 1];
  return { knots, hopperTip: lastBand.regime === 'hopper_skeletal' };
}

// Halide wrapper: banded/hoppered cubes (halite + sylvite + fluorite's
// cube path — REE octahedra never reach the renderer's cube-token gate,
// so they can't arrive here mis-formed). The form token routes the
// renderer to the square-section ziggurat builder.
function halideTerraceBands(crystal: any, uptoStep: any) {
  if (!crystal || (crystal.mineral !== 'halite' && crystal.mineral !== 'sylvite'
      && crystal.mineral !== 'fluorite' && crystal.mineral !== 'pyrite')) return null;
  const walk = morphTerraceKnots(crystal, uptoStep);
  if (!walk) return null;
  return { form: 'cube', knots: walk.knots, hopperTip: walk.hopperTip };
}

// ---- Quartz sceptre — a CRYSTAL-LEVEL structural classifier ----
// A sceptre is gen-2 quartz overgrowing the RESORBED tip of gen-1: ONE
// continuous crystal with a corrosion surface (phantom boundary) between a
// real stem and a real, wider cap. grow_quartz DISSOLVES at σ<1 (it does not
// pause), so an alpine crack-seal SEAL corrodes the tip (negative zones) and
// the following BREACH regenerates the cap — corrosion-then-regeneration, the
// documented natural sceptre trigger (mindat; quartzpage.de). The cooler cap
// grows at a LOWER linear rate (Arrhenius) yet ends LARGER by extent, so the
// signature is cumulative growth on BOTH sides of the phantom boundary, NOT a
// rate spike — the §108 finding (the rate-ratio guess was the wrong instrument;
// tools/quartz-sceptre-scan.mjs is the right one, and this is it promoted into
// the engine). PURE tagging: no rng, no fluid mutation. Runs after the growth
// loop so it reads completed zones; recomputed each step so capFrac tracks the
// growing cap and the LAST pass (the saved state) carries the final geometry.
const QZ_SCEPTRE_STEM_MIN = 200;  // µm (timeScale-applied) — a real gen-1 stem
const QZ_SCEPTRE_CAP_MIN = 200;   // µm — a real gen-2 cap before we call it a sceptre
function classifyQuartzSceptre(sim: any) {
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'quartz' || !c.zones || c.zones.length < 4) continue;
    const zones = c.zones;
    let i = 0;
    while (i < zones.length) {
      if ((zones[i].thickness_um || 0) < 0) {
        const start = i;
        while (i < zones.length && (zones[i].thickness_um || 0) < 0) i++;
        const endIdx = i - 1;
        let stem = 0; for (let k = 0; k < start; k++) { const t = zones[k].thickness_um || 0; if (t > 0) stem += t; }
        let cap = 0; for (let k = endIdx + 1; k < zones.length; k++) { const t = zones[k].thickness_um || 0; if (t > 0) cap += t; }
        if (stem >= QZ_SCEPTRE_STEM_MIN && cap >= QZ_SCEPTRE_CAP_MIN) {
          const capFrac = cap / (stem + cap);   // gen-2 share of grown length — render widens the top capFrac
          c._sceptre = { boundaryStep: zones[endIdx].step, stemUm: stem, capUm: cap, capFrac };
          c.habit = 'scepter_overgrowth';
          for (let k = endIdx + 1; k < zones.length; k++) if ((zones[k].thickness_um || 0) > 0) zones[k].morph_sceptre = 'cap';
          break;   // first qualifying phantom boundary defines the sceptre
        }
      } else i++;
    }
  }
}

// ---- Quartz gwindel — the alpine-fissure-EXCLUSIVE twisted column ----
// A gwindel is a stack of subparallel quartz individuals progressively rotated
// about the a-axis — a flattened, twisted lamellar column, essentially exclusive
// to alpine-type tension fissures (the Swiss Central Alps / Grimsel / Furka are
// the world type region). KEY: a gwindel is NOT distinguished from an ordinary
// (or sceptre) cleft quartz by its FLUID history — all the crystals in one cleft
// share the same fluid, so they all record the same seals/breaches. The gwindel's
// distinction is CRYSTALLOGRAPHIC: a progressive a-axis TWIST that accumulates
// over prolonged growth under the cleft's syn-growth tectonic shear (the D2/D3
// rotating stress field). The sim has no shear FIELD, so — exactly as it treats
// twinning — we designate the gwindel as a habit variant: the LARGEST, longest-
// grown cleft showpiece (twist ∝ its growth duration), independent of and taking
// render precedence over its crack-seal sceptre record. PURE tagging; runs AFTER
// the sceptre pass. A Grimsel cleft thus shows a twisted gwindel showpiece beside
// smaller smoky sceptres — the real co-occurrence.
const QZ_GWINDEL_MIN_UM = 1000;   // µm (timeScale-applied) — a substantial showpiece column
function classifyQuartzGwindel(sim: any) {
  if (!sim.conditions.wall || !sim.conditions.wall.alpine_cleft) return;
  const qz = sim.crystals.filter((c: any) => c && c.mineral === 'quartz'
    && (c.total_growth_um || 0) >= QZ_GWINDEL_MIN_UM);
  // The pick can migrate as crystals grow; clear and re-pick each step so the
  // final-step largest is the stable gwindel (pure tagging — the saved state wins).
  for (const c of sim.crystals) if (c && c.mineral === 'quartz' && c._gwindel) c._gwindel = null;
  if (!qz.length) return;
  // Deterministic pick: the largest, tie-broken by lowest crystal_id (no RNG).
  qz.sort((a: any, b: any) => (b.total_growth_um - a.total_growth_um) || (a.crystal_id - b.crystal_id));
  const g = qz[0];
  let firstStep: any = null, lastStep: any = null;
  for (const z of g.zones) { const t = z.thickness_um || 0; if (t > 0) { if (firstStep == null) firstStep = z.step; lastStep = z.step; } }
  const span = (lastStep != null && firstStep != null) ? (lastStep - firstStep) : 0;
  g._gwindel = { twistDeg: Math.max(45, Math.min(120, span * 0.7)), lengthUm: g.total_growth_um, span };
  g.habit = 'gwindel';
}

// POST-GROWTH DEFORMATION OVERPRINT — the genuine "deformation" mechanic
// (deformation/shear arc, RESEARCH-deformation-shear-2026-06-20.md §5.3). This
// is the category the handoff §8 conflated: bent quartz / stibnite / mica kink
// bands + mechanical twins are NOT recorded as the crystal grows — they are
// imposed on a FINISHED lattice by a later tectonic event (post-growth crystal-
// plastic gliding; the literature is unambiguous, research §3–4). So this is an
// OVERPRINT, not a grow-integrate field: a scenario declares a `deformation`
// directive on a late event (apply_events records it onto sim._deformationEvents
// with the step it fired), and this pass — run post-growth like the gwindel/
// sceptre classifiers — tags crystals that had ALREADY GROWN by that step
// (firstZone.step < event.step) so the bend is stamped on a crystal that existed
// to be bent. PURE tagging (no rng, no fluid) → the render reads crystal._defor-
// mation; the engine baseline is untouched (gen-baseline serialises only counts/
// sizes). Tag-once (idempotent across the per-step calls). minerals=null → any.
const DEFORM_MIN_UM = 100;   // skip nucleation-only specks — need a body to bend
function classifyDeformation(sim: any) {
  const evs = sim._deformationEvents;
  if (!evs || !evs.length) return;
  for (const ev of evs) {
    const mins = (ev && ev.minerals) || null;
    const style = (ev && ev.style) || 'bend';
    const amount = (ev && typeof ev.amount === 'number') ? ev.amount
      : (ev && typeof ev.magnitude === 'number') ? ev.magnitude : 0.5;
    for (const c of sim.crystals) {
      if (!c || c.dissolved || c._deformation) continue;
      if (mins && mins.indexOf(c.mineral) < 0) continue;
      if ((c.total_growth_um || 0) < DEFORM_MIN_UM) continue;
      // must have existed (grown) BEFORE the shear fired
      let firstStep: any = null;
      for (const z of (c.zones || [])) { if ((z.thickness_um || 0) > 0) { firstStep = z.step; break; } }
      if (firstStep == null || firstStep >= ev.step) continue;
      c._deformation = { kind: style, amount, atStep: ev.step };
    }
  }
}

// POST-GROWTH ETCH overprint (crystal-face-realism arc §2, 2026-06-22) — the etched/
// dissolved habit (rounded edges + corners, frosted faces, in the limit a negative
// crystal; Sangwal 1987 Etching of Crystals) is imposed on a FINISHED crystal by a
// later UNDERSATURATED fluid — the same post-growth-overprint shape as deformation, not
// a grow-integrate field. WHY declarative and not a passive read of existing resorption:
// the etch-pit-probe census (tools/etch-pit-probe.mjs) found the engine's dissolution
// is BINARY — a crystal either survives ~intact (resorbed frac ~0.00) or fully
// dissolves and DROPS from the scene (js/99i: dissolved crystals aren't rendered) — so
// there is NO population of substantially-etched survivors to read. The etched look is
// therefore declared as an overprint: a scenario event carries an `etch` directive
// {amount,minerals,style}; apply_events (js/85d) records it on sim._etchEvents WITH the
// step it fired; this pass (post-growth, like classifyDeformation) tags surviving
// crystals that had ALREADY grown by that step. PURE tagging — crystal._etch is a RENDER
// tag; the engine baseline is untouched (gen-baseline serialises only counts/sizes), so
// this is byte-identical. Tag-once (idempotent). Geologically: reactivated veins corrode
// their early generation when a cooler fresh fluid reopens the conduit.
const ETCH_MIN_UM = 100;   // skip nucleation-only specks — need a body to round
function classifyEtch(sim: any) {
  const evs = sim._etchEvents;
  if (!evs || !evs.length) return;
  for (const ev of evs) {
    const mins = (ev && ev.minerals) || null;
    const style = (ev && ev.style) || 'rounded';
    const amount = (ev && typeof ev.amount === 'number') ? ev.amount : 0.5;
    for (const c of sim.crystals) {
      if (!c || c.dissolved || c._etch) continue;
      if (mins && mins.indexOf(c.mineral) < 0) continue;
      if ((c.total_growth_um || 0) < ETCH_MIN_UM) continue;
      // must have existed (grown) BEFORE the etching fluid returned
      let firstStep: any = null;
      for (const z of (c.zones || [])) { if ((z.thickness_um || 0) > 0) { firstStep = z.step; break; } }
      if (firstStep == null || firstStep >= ev.step) continue;
      c._etch = { kind: style, amount, atStep: ev.step };
    }
  }
}

// SECTOR (HOURGLASS) ZONING — different growth sectors (crystal faces) incorporate
// trace elements at different rates, so composition (and colour) partitions by
// GROWTH SECTOR rather than by concentric growth zone (Dowty 1976, Am.Min.
// 61:460–469 — the protosite model: each growing face exposes a different partial-
// coordination surface, so the same ion partitions differently per face, and
// lateral step growth metastably BURIES that face-characteristic composition). The
// visual signature is a SHARP, geometry-locked boundary between sectors — distinct
// from the gradational boundary of oscillatory/concentric zoning. Iconic cases:
// titanaugite hourglass (Ferguson 1973, Min.Mag. 39:321 — Al-for-Si + Ti enriches +
// darkens the PRISM sectors {100}/{110}/{010}; the {-111} hourglass-interior
// sectors are Ti-DEPLETED and PALE — Ferguson 1973 + Ubide et al. 2019, GCA
// 251:265; the common "Ti darkens the basal sectors" mnemonic is BACKWARDS),
// chiastolite andalusite (carbon to the corner sectors → the
// Maltese cross), elbaite/liddicoatite radial colour sectors.
//
// Tier A render-only abstraction (PROPOSALS-crystal-face-realism-2026-06-21 §1):
// this pass — run post-growth like the gwindel/sceptre/deformation classifiers —
// just TAGS the well-documented sector-zoned minerals so the renderer draws a per-
// sector tint (the termination sector ≠ the prism body sector, the augite hourglass
// read). PURE tagging (no rng, no fluid) → render reads crystal._sectorZoned; the
// engine baseline is untouched (gen-baseline serialises only counts/sizes), so this
// is SIM-NEUTRAL & byte-identical, the saddle-dolomite precedent. Tag-once
// (idempotent across the per-step calls). Tourmaline is the first tenant — the only
// sector-zoned mineral in the catalogue (elbaite/liddicoatite colour sectors are
// collector-iconic). Chiastolite (andalusite) — THE iconic sector-cross — needs
// andalusite added first, a future add-mineral tenant.
// Per-mineral sector-zoning config. `kind` selects the render: 'hourglass' (the
// termination-sector tint — the tourmaline bicolor-elbaite read) vs 'cross' (the
// transverse 4-corner carbon mask — chiastolite) vs 'apophyllite_green' (UNIFORM V⁴⁺
// green body + pearly basal-face luster — the Poona read). `requiresGraphitic`
// gates a tenant on a carbonaceous host: andalusite is sector-zoned-as-chiastolite
// ONLY in a graphitic metapelite (wall.graphitic); a non-graphitic andalusite is a
// plain square prism. `requiresGreen` gates apophyllite's green render on a crystal
// that actually grew V⁴⁺-green (grow_apophyllite sets c._apophylliteGreen when
// fluid.V > 0.5).
// SECTOR-ZONING NOTE: apophyllite IS a genuine growth-sector-zoned mineral — its
// anomalous birefringence (optic sign varies within one crystal) arises from per-
// sector differences in F/OH ratio + structural water + strain (Dowty-type growth-
// sector zoning, confirmed against optical-mineralogy sources). The prized Poona
// green is V⁴⁺ (Rossman 1974, Am.Min. 59(5-6):621-622) — DICHROIC. BUT that sector
// zoning is OPTICAL-only (anomalous birefringence, crossed-polars/thin-section). The
// VISIBLE green is a UNIFORM body colour: a provenance-locked image corpus of Pune
// specimens (2026-06-21) shows NO prism-vs-pyramid colour partition — only a
// transparency gradient (thin tips lighter) + faint concentric banding. So the render
// is UNIFORM green + a pearly {001} basal-face LUSTER (the one real visible face
// contrast), NOT a colour hourglass. (Correction trail: boss handoff said "Cu" →
// corrected to V; my "not real sector zoning" → corrected, the zoning is real but
// optical; the image corpus then corrected the visible-colour model to uniform.)
//
// GYPSUM HOURGLASS (selenite) — the arc's first GENUINELY VISIBLE sector tenant
// (2026-06-22). Where apophyllite's sector zoning is optical-only, selenite's is the
// classic VISIBLE "hourglass selenite" of the Great Salt Plains, Oklahoma (the state
// crystal; USFWS Salt Plains NWR): fine clay + sand particles, stained reddish-to-
// chocolate-brown by soil iron oxide, are mechanically trapped on the fast-growing
// terminal growth SECTORS, forming a bowtie/hourglass of inclusions inside an
// otherwise water-clear blade. It is a true growth-sector phenomenon (boss-confirmed
// firsthand; corpus = boss's own provenance-locked specimens 2026-06-22): the apex
// tracks the c-axis growth direction, so the internal hourglass stays self-similar
// even as the outer envelope changes (the stepped-growth specimen). `requiresInclusion`
// reads the engine's EXISTING hourglass-inclusion zones (grow_selenite already tags a
// growth zone inclusion_type='hourglass (sand inclusions)' when rate>5 + a 30% roll) —
// no new RNG, no chemistry: this is a pure render classification (SIM-neutral). The
// derived `intensity` (trapped-zone fraction × accumulated trace_Fe) drives the brown
// depth, and `flooded` (heavy inclusion load) collapses the contrast to a solid-brown
// overgrown crystal — the boss's clear↔flooded variant spectrum in one knob.
const SECTOR_ZONED_MINERALS: any = {
  tourmaline: { kind: 'hourglass' },
  andalusite: { kind: 'cross', requiresGraphitic: true },   // chiastolite — the carbon cross
  apophyllite: { kind: 'apophyllite_green', requiresGreen: true },  // Poona V⁴⁺ UNIFORM green body + pearly basal (sector zoning is optical-only — see note)
  selenite: { kind: 'gypsum_hourglass', requiresInclusion: true },  // Great Salt Plains clay/Fe sector hourglass — genuinely VISIBLE (see note)
};
const SECTOR_ZONED_MIN_UM = 50;   // need a real body + termination/sectors to partition
// Read-only scan of a selenite crystal's growth zones for the engine's trapped-
// sediment record. Returns null if no hourglass inclusions were trapped (a water-
// clear blade — most specimens), else the visible-render parameters. SIM-NEUTRAL:
// only reads zone fields the engine already wrote.
// Hourglass selenite is a COOL near-surface, sediment-laden phenomenon (wet soil /
// evaporite playa — Great Salt Plains). A hot, clean, slow geothermal pool (Naica,
// ~54°C) grows water-CLEAR blades and traps no soil sediment, so an inclusion zone
// only counts toward the visible hourglass if it grew below this temperature. This is
// the defer-to-geology gate that keeps Naica's iconic clear crystals clear.
const HOURGLASS_MAX_T = 45;
const HOURGLASS_HIATUS_STEPS = 4;   // a gap larger than this between recorded growth zones = a hiatus
function _seleniteHourglassParams(c: any): any {
  const zones = (c && c.zones) || [];
  let growth = 0, hgCount = 0, feLoad = 0, segments = 0, prevStep = -999;
  for (const z of zones) {
    const t = z.thickness_um || 0;
    if (t <= 0) continue;
    growth++;
    if (typeof z.inclusion_type === 'string' && z.inclusion_type.indexOf('hourglass') >= 0
        && (z.temperature == null || z.temperature < HOURGLASS_MAX_T)) hgCount++;
    feLoad += z.trace_Fe || 0;
    // Count distinct growth SEGMENTS — bursts of growth separated by hiatuses. A pulsed
    // evaporite setting (playa wet/dry, sabkha flood/evap) grows the blade only during the
    // dry/evap bursts; the wet pause records NO zone, leaving a step-gap. Each gap-separated
    // burst steps the outer envelope out another terrace while the internal hourglass holds
    // its order (the boss's stepped-growth specimen / quartz sceptre / calcite ziggurat).
    // SIM-neutral: reads the zone step numbers the engine already wrote.
    if (z.step - prevStep > HOURGLASS_HIATUS_STEPS) segments++;
    prevStep = z.step;
  }
  if (hgCount === 0 || growth === 0) return null;
  const hgFrac = hgCount / growth;                        // 0..1 — share of growth that trapped sediment
  const avgFe = feLoad / growth;                          // mean iron staining per growth increment
  // Brown DEPTH is iron-driven (USFWS: soil iron oxide gives the reddish-to-chocolate
  // colour) — an iron-rich red-bed setting stains deep brown even where the hourglass is
  // sharp; the trapped FRACTION adds a little. Capped below full saturation so there is
  // visible range across the fleet (light-amber low-Fe → chocolate red-bed).
  const intensity = Math.max(0.18, Math.min(0.95, 0.25 + avgFe * 16 + hgFrac * 0.25));
  // Flooded = solid-brown overgrown blade, hourglass lost: pervasive sediment trapping
  // OR a saturating iron coating (the boss's "totally brown" overgrown specimens).
  const flooded = hgFrac > 0.5 || intensity >= 0.92;
  const steps = segments >= 2 ? Math.min(5, segments) : 0;  // 0 = smooth chisel; ≥2 = stepped ziggurat (one terrace per burst)
  return { kind: 'gypsum_hourglass', intensity, flooded, hgFrac, steps };
}
function classifySectorZoning(sim: any) {
  const graphitic = !!(sim.conditions && sim.conditions.wall && sim.conditions.wall.graphitic);
  for (const c of sim.crystals) {
    if (!c || c.dissolved) continue;
    const cfg = SECTOR_ZONED_MINERALS[c.mineral];
    if (!cfg) continue;
    if (cfg.requiresInclusion) {
      // Selenite hourglass EVOLVES as the blade grows (intensity, flooded, and the
      // stepped-growth segment count all depend on the full zone stack), so RE-evaluate
      // every step rather than tagging once — otherwise it freezes at the early-growth
      // state (segments=1) before the wet/dry hiatuses that step the blade out have
      // happened. Refresh-in-place; render reads the final state. SIM-neutral.
      if ((c.total_growth_um || 0) < SECTOR_ZONED_MIN_UM) continue;
      const hg = _seleniteHourglassParams(c);
      if (hg) c._sectorZoned = hg;
      continue;
    }
    if (c._sectorZoned) continue;                              // others tag once (kind is fixed)
    if (cfg.requiresGraphitic && !graphitic) continue;
    if (cfg.requiresGreen && !c._apophylliteGreen) continue;   // V⁴⁺ green only (grow_apophyllite)
    if ((c.total_growth_um || 0) < SECTOR_ZONED_MIN_UM) continue;
    c._sectorZoned = { kind: cfg.kind };
  }
}

// DIRECTIONAL (ANISOTROPIC) STEPPED GROWTH — Phase 0 of the central-distance arc
// (2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md). The first
// per-face-AWARE tag: it marks a crystal whose macrostep relief should be carved
// onto ONE face-set (directional), not smeared symmetrically around the ring like
// the existing terrace ziggurat.
//
// THE SCIENCE. Calcite is CENTROSYMMETRIC (point group -3m, space group R-3c
// No.167 — has an inversion centre; confirmed Materials Project mp-3953), so its
// {104} directional stepping is NOT crystallographic polarity. It is the sum of
// (a) the INTRINSIC surface-step anisotropy of the rhomb face — the (104) surface
// has twofold site symmetry, lower than the crystal's threefold, so its monolayer
// steps split into two NON-equivalent counter-propagating families: an ACUTE
// (~78°) and an OBTUSE (~102°) step (the 78°/102° pair is the cleavage-rhomb
// diamond angle), which propagate at different velocities and whose anisotropy
// reverses with the Ca2+:CO3^2- activity ratio (Teng & Dove 1998/2000) — and
// (b) ENVIRONMENTAL drivers: a supersaturation/feed gradient across the cavity
// makes the up-gradient faces step-bunch while sheltered/attached faces stay
// smooth. Anchor for the {104} step framework: De Yoreo & Vekilov (2003),
// Rev. Mineral. Geochem. 54, 57-93. Visible relief = macrostep bunching, so we
// key off the SAME 'stepped_macro' zone regime the terrace render already uses.
//
// HONEST FIDELITY CAVEAT (Phase-4 debt). steppedFaceSet:'up' is a face-set
// SELECTOR, not a world-direction. The renderer applies a random per-crystal yaw
// (_crystalYaw, js/99i), so the chosen face-set is crystallographically arbitrary
// and will NOT correlate with any real σ/flow gradient — this yields directional-
// LOOKING relief without the directional CAUSE. Acceptable for the {104} aesthetic
// read; true world-frame-gradient → face coupling is deferred to Phase 4.
//
// PURE tagging (no rng, no fluid), gated on the wall.directional_steps OPT-IN that
// NO scenario sets yet (Phase 0) → no-op across all 37 scenarios → byte-identical,
// SIM-neutral, the saddle-dolomite / sector-zoning precedent. Phase 1 opts elmwood
// in and adds the one-sided render carve. Tag-once (idempotent). Mirrors
// classifyDeformation / classifyEtch.
const FACESTEP_MIN_UM = 100;   // skip nucleation-only specks — need a body to step
function classifyFaceStep(sim: any) {
  const wall = sim.conditions && sim.conditions.wall;
  if (!wall || !wall.directional_steps) return;   // opt-in gate — Phase 0: unset everywhere
  const mins = wall.directional_steps_minerals || ['calcite'];
  for (const c of sim.crystals) {
    if (!c || c.dissolved || c._faceStep) continue;
    if (mins.indexOf(c.mineral) < 0) continue;
    if ((c.total_growth_um || 0) < FACESTEP_MIN_UM) continue;
    // need visible macrostep relief in the zone stack (the same 'stepped_macro'
    // regime the terrace geometry keys on); a smooth (spiral) crystal doesn't step
    let stepped = false;
    for (const z of (c.zones || [])) { if (z.morph_regime === 'stepped_macro') { stepped = true; break; } }
    if (!stepped) continue;
    c._faceStep = { steppedFaceSet: 'up', atStep: c.nucleation_step };
  }
}

function classifyMorphologyStep(sim: any) {
  for (const mineral in MORPH_TH) {
    const th = MORPH_TH[mineral];
    let sigma;
    try { sigma = th.sigma(sim.conditions); } catch (_e) { continue; }
    if (!isFinite(sigma) || sigma < 1.0) continue;
    const mult = th.effSigmaMult ? th.effSigmaMult(sim.conditions) : 1;
    const form = th.form ? th.form(sim.conditions) : null;
    for (const c of sim.crystals) {
      if (!c || c.mineral !== mineral || c.dissolved) continue;
      const z = c.zones.length ? c.zones[c.zones.length - 1] : null;
      if (!z || z.step !== sim.step || z.thickness_um <= 0) continue;
      // Size BEFORE this zone — the map tool's sizeAcc semantics.
      const sizeBefore = Math.max(0, c.total_growth_um - z.thickness_um);
      const surf = morphSurfaceSigma(th, sigma, sizeBefore) * mult;
      const regime = morphRegime(th, surf);
      z.morph_regime = regime;
      if (form) z.morph_form = form;
      z.morph_surf_sigma = surf;
      c._morphology = { regime, form, surf_sigma: surf };
    }
  }
}
