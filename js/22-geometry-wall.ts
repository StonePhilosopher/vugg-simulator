// ============================================================
// js/22-geometry-wall.ts — VugWall + WallCell + WallState + helpers
// ============================================================
// Mirror of vugg/geometry/wall.py. Three classes:
//   * VugWall   — reactive carbonate wall (acid pulses, dissolution, refresh)
//   * WallCell  — one cell of the ring/cell topo grid
//   * WallState — full ring stack with paint_crystal + Fourier-profile init
//
// Plus the small support trio used by WallState's profile init:
//   * _mulberry32(seed)            seeded PRNG factory
//   * PRIMARY_SIZE_RANGE/etc.      bubble-merge sampling ranges
//   * _raycastUnion(bubbles,theta) primary-bubble outline ray-trace
//
// Phase B5 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level
// decls stay global so call sites in 99-legacy-bundle.ts keep working.

// Size-class cascade (2026-05, boss vision). Three tiers anchored to
// standard mineralogy / speleology literature, ordered by physical
// scale. Each tier maps to a default vug_diameter_mm range; if a
// scenario / caller declares size_class but NOT vug_diameter_mm, the
// constructor picks a deterministic value in the range (midpoint by
// default, or uniformly random when the caller passes _size_rng).
//
// Player-facing meaning:
//   "vug"    — small specimen-scale cavity. Most "thumbnails", MVT vug
//              fillings, supergene oxidation pockets, hydrothermal
//              cavity linings.
//   "pocket" — medium crystal-bearing cavity. Pegmatite pockets (Pala,
//              Himalaya, Tanco), alpine fissure pockets, large
//              speleothem-dropping cavities, Tsumeb-grade specimens.
//   "cave"   — large passable cavity. Karst chambers (Carlsbad,
//              Mammoth), Naica giant gypsum cavern, large evaporite
//              playas. Above this scale the per-vertex chemistry grid
//              starts losing per-cell resolution; 5m is the practical
//              cap before each cell spans more than a coarse crystal.
//
// Literature + imperial-anchor reconciliation:
//   * Vug:    "anything smaller than an inch"   →  5 – 25 mm
//             Specimen-grade mineralogy: thumbnail (<2cm) + small
//             miniature (2-2.5cm). Textbook vug definition spans
//             1mm-10cm; tightening to <25mm captures the
//             specimen-cabinet "vug" most collectors mean.
//   * Pocket: "inches to feet"                  →  25 – 300 mm
//             Foord 1981 on Pala pegmatites + Webber & Simmons 2007
//             on Tanco describe the typical pegmatite-pocket as
//             "10-50 cm" with bonanzas to >1m. Alpine fissure
//             pockets cluster in the same range. 25-300mm is the
//             bulk of the pocket literature.
//   * Cave:   "feet to meters"                  →  300 – 3000 mm
//             Speleology defines a cave by human passability
//             (typically >50cm in some dimension). The Naica giant
//             gypsum chamber is ~10m; the practical cap for the
//             simulator is 3m where the per-vertex grid still has
//             meaningful per-cell resolution. Above 3m a single
//             cell spans >2.5cm and a typical pocket-scale crystal
//             becomes sub-cell — Proposal E's per-cell local fill
//             would need a finer grid before pushing past 3m.
type SizeClass = 'vug' | 'pocket' | 'cave';
const SIZE_CLASS_RANGES: Record<SizeClass, [number, number]> = {
  vug:    [5,   25],     // ≤ 1 inch
  pocket: [25,  300],    // 1 inch  to 1 foot
  cave:   [300, 3000],   // 1 foot to multi-meter
};

// Helper for UI consumers that need to convert a player's size-class
// choice into a concrete vug_diameter_mm — Creative Mode (97-ui-fortress)
// and Simulation Mode's scenario override (91-ui-legends). Returns the
// range midpoint by default; pass a 0–1 rng draw to pick uniformly
// within the range (used by Random Mode in 96-ui-random).
function resolveSizeClassToMm(sizeClass: string, rngDraw?: number): number | null {
  if (!(sizeClass in SIZE_CLASS_RANGES)) return null;
  const [lo, hi] = SIZE_CLASS_RANGES[sizeClass as SizeClass];
  if (typeof rngDraw === 'number') return lo + rngDraw * (hi - lo);
  return (lo + hi) / 2;
}
function _resolveVugDiameter(opts: any): number {
  // Explicit override wins, preserves all current scenarios' behavior
  // and keeps byte-identical baselines.
  if (typeof opts.vug_diameter_mm === 'number') return opts.vug_diameter_mm;
  // size_class declared without an explicit diameter — draw from the
  // literature range. Default to midpoint for determinism; callers
  // that want random draws inside the range can pass _size_rng()
  // (used by Random Mode in 96-ui-random.ts).
  if (typeof opts.size_class === 'string' && opts.size_class in SIZE_CLASS_RANGES) {
    const [lo, hi] = SIZE_CLASS_RANGES[opts.size_class as SizeClass];
    if (typeof opts._size_rng === 'function') {
      return lo + opts._size_rng() * (hi - lo);
    }
    return (lo + hi) / 2;
  }
  // Legacy default — 50mm sits at the vug/pocket boundary, preserving
  // every current scenario's geometry.
  return 50.0;
}

class VugWall {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts: any = {}) {
    this.composition = opts.composition ?? 'limestone';
    this.thickness_mm = opts.thickness_mm ?? 500.0;
    // Size-class cascade: vug < pocket < cave. Each tier maps to a
    // literature-anchored vug_diameter_mm range. Explicit override
    // wins (every shipped scenario sets vug_diameter_mm directly, so
    // adding size_class to a scenario is informational metadata — the
    // resolved diameter doesn't change). For random / procedural
    // generation, size_class alone is the natural interface.
    this.size_class = (opts.size_class as SizeClass) ?? null;
    this.vug_diameter_mm = _resolveVugDiameter(opts);
    this.total_dissolved_mm = opts.total_dissolved_mm ?? 0.0;
    this.wall_Fe_ppm = opts.wall_Fe_ppm ?? 2000.0;
    this.wall_Mn_ppm = opts.wall_Mn_ppm ?? 500.0;
    this.wall_Mg_ppm = opts.wall_Mg_ppm ?? 1000.0;
    this.ca_from_wall_total = opts.ca_from_wall_total ?? 0.0;
    // Phase-1 naturalistic void shape (visual only — growth engines
    // still read meanDiameterMm). Two-stage bubble-merge model:
    //   Stage 1 — primary void: a few large bubbles (radii 40–70% of
    //     vug_diameter_mm) forming the main cavity. Guaranteed to
    //     contain the sampling origin.
    //   Stage 2 — secondary dissolution: smaller bubbles (radii 10–30%
    //     of vug_diameter_mm) spawned ON the outer edge of the primary
    //     union — models percolating fluids eating satellite alcoves
    //     from the cavity wall.
    // See WallState._buildProfile() for the geometry.
    //   primary_bubbles: stage-1 count (>= 1, 2–5 typical).
    //   secondary_bubbles: stage-2 count (>= 0, 3–10 typical).
    //   shape_seed: deterministic seed for bubble positions / radii.
    this.primary_bubbles = opts.primary_bubbles ?? 3;
    this.secondary_bubbles = opts.secondary_bubbles ?? 6;
    this.shape_seed = opts.shape_seed ?? 0;
    // PROPOSAL-HOST-ROCK Mechanic 5: cavity architecture passed through
    // to WallState at sim init. Scenarios opt in via wall.architecture
    // in scenarios.json5; default 'pocket' = legacy behavior.
    this.architecture = opts.architecture ?? null;
    // Player-tunable wall reactivity multiplier (Creative-mode slider).
    // 0=inert, 1=default limestone (current behavior), 2=fast-dissolving
    // fresh limestone with mild water-only dissolution. Only affects
    // carbonate walls; silicate composition stays inert regardless.
    // See vugg.py VugWall docstring for the full table.
    this.reactivity = opts.reactivity ?? 1.0;
    // PHASE-3-CAVITY-MESH (PROPOSAL-CAVITY-MESH §7): zone chemistry
    // overrides. When set, the simulator's ring_fluids init applies
    // these field-by-field overrides to every ring whose orientation
    // matches the zone key. Shape:
    //   { floor: { Ca: 500, pH: 6.8, ... }, wall: {...}, ceiling: {...} }
    // Any subset of zones / fields is honored; unspecified entries
    // fall through to the scenario's global initial.fluid. Default
    // null = byte-identical legacy behavior (every ring starts with a
    // clone of conditions.fluid).
    //
    // This is the foothold for stalactite/stalagmite paragenesis
    // (PROPOSAL-3D-SIMULATION Phase 3 hinted at this; cavity-mesh
    // Phase 3 ships the API). A scenario that wants persistent zones
    // pairs zone_chemistry with inter_ring_diffusion_rate: 0 below
    // so homogenization doesn't average the differences away.
    this.zone_chemistry = opts.zone_chemistry ?? null;
    // PHASE-3-CAVITY-MESH: scenario-tunable inter-ring diffusion rate.
    // Default null → VugSimulator falls through to
    // DEFAULT_INTER_RING_DIFFUSION_RATE (0.05). Zone scenarios that
    // want persistent floor/ceiling chemistry differences pass 0 to
    // disable homogenization. Slow-equilibrium scenarios can pass
    // values < 0.05 (e.g. 0.01 for a "weeping" cavity that diffuses
    // over ~100 steps instead of ~20).
    this.inter_ring_diffusion_rate = opts.inter_ring_diffusion_rate ?? null;
    // PROPOSAL-HABIT-BIAS Slice 2: when true, every crystal nucleates
    // in air-mode regardless of ring water-state. Default false
    // preserves legacy "stamp from water-state at nucleation" behavior
    // (vadose ring → 'air', otherwise 'fluid').
    //
    // Use case: cave-style scenarios that should be air-mode from
    // step 0 without faking a drainage event. A Carlsbad-style
    // limestone cave shipped with this flag produces stalactites
    // (ceiling cells) + stalagmites (floor cells) + wall-radial
    // crystals out of the gate. Naica-style scenarios that drain
    // mid-run keep the flag false and rely on the water-state
    // mechanism.
    this.air_mode_default = !!opts.air_mode_default;
    // Tier 1 C (post-v69): cavity material rendering style. The
    // 3D sphere-union geometry produces sharp dihedral creases where
    // primary, secondary, and tertiary bubbles intersect — geologically
    // realistic for brittle silicate hosts (chalcedony-lined agate vugs,
    // pegmatite miarolitic cavities) where the original dissolution
    // boundary is preserved without subsequent rounding. Other hosts
    // (limestone caves, basalt vesicles refilled with smooth secondary
    // calcite, weathered geodes) wear those edges into smooth curves.
    //   'smooth'  → MeshStandardMaterial.flatShading = false; vertex
    //               normals interpolated across faces (Phong-like).
    //   'sharp'   → flatShading = true; each face gets its own normal,
    //               surfacing the underlying sphere-union polyhedron.
    // Default 'smooth' preserves the pre-toggle visual appearance for
    // every existing scenario. Scenarios opt into 'sharp' explicitly.
    this.cavity_render = opts.cavity_render ?? 'smooth';
    // Tranche 6 of PROPOSAL-CAVITY-MESH §14 (post-v69): per-vertex
    // nucleation. Default OFF — nucleation engines fire based on
    // conditions.fluid (= ring_fluids[equator] alias), and the crystal
    // gets anchored to a cell picked by area+orientation+architecture
    // weights only. That works fine for unzoned scenarios because every
    // cell sees identical chemistry, but in zone_chemistry scenarios
    // (Tranche 3+) it means a stalactite-cave's ceiling-supersaturated
    // calcite has to wait for the equator's σ to cross threshold AND
    // happens to be placed wherever the area-weighted RNG drops it —
    // the spatial pattern doesn't track the chemistry pattern.
    //
    // When ON: _assignWallCell weights candidate (ring, cell) pairs by
    // per-cell σ for the firing mineral, so crystals nucleate where σ
    // is highest. The mesh.cells[i].fluid per-vertex storage shipped
    // in Tranche 4a is the substrate; this trance closes the loop.
    //
    // Cost: ~ring_count × cells_per_ring σ-evaluations per nucleation
    // event (e.g. 16 × 120 = 1920 at default resolution). Each σ call
    // is ~10-30 ops — total ≪ 100 μs even at 1920 cells, negligible
    // against the actual engine work in a step.
    //
    // Opt-in only — scenarios that don't declare this flag stay on the
    // legacy code path and produce byte-identical output.
    this.per_vertex_nucleation = !!opts.per_vertex_nucleation;
    // Proposal E (2026-05-18) — per-cell local fill opt-in. When true,
    // the growth-loop dampener + volume clamp read the crystal's
    // anchor-cell local fill (volume painted by _paintCrystalVolume)
    // instead of the global vugFill. Defaults false → byte-identical
    // to legacy. Forwarded to WallState in 85-simulator.ts.
    this.per_cell_local_fill = !!opts.per_cell_local_fill;
    // v84 (2026-05-19): is the cavity exposed to visible light?
    // Default TRUE — most surface vugs / hot-spring vents / museum
    // specimens are lit. Drives LIGHT_TRANSITIONS in 75-transitions.ts
    // (currently only realgar → pararealgar). Scenarios that model
    // sealed-rock cavities during formation (deep-burial pegmatite
    // pockets, sealed vein systems) can set is_lit: false to preserve
    // light-sensitive minerals like realgar through the run. Forwarded
    // to WallState so the simulator can check sim.wall_state.is_lit
    // without reaching back to conditions.wall.
    this.is_lit = (opts.is_lit !== undefined) ? !!opts.is_lit : true;
    // v162 (2026-05-28): does episodic hydrothermal "hot fluid injection"
    // (the ambient_cooling thermal-pulse mechanic, 85d) apply to this cavity?
    // Default TRUE — most scenarios are cooling hydrothermal systems where
    // fracture-fed hot pulses are real. SUPERGENE / near-surface weathering
    // scenarios (bisbee's oxidation cascade, roughten_gill's Pb-oxidation) set
    // thermal_pulses: false — a 25°C supergene pocket has no magmatic heat
    // source, and the ungated pulses were spuriously reheating those cold
    // cascades toward 350°C (surfaced by the strip T chip). Creative Mode
    // exposes this as a setup toggle (f-thermal-pulses). Read directly off
    // conditions.wall in ambient_cooling.
    this.thermal_pulses = (opts.thermal_pulses !== undefined) ? !!opts.thermal_pulses : true;
    // v179 (2026-06-09): per-scenario ambient cooling rate, °C/step (default
    // 1.5 — the historical hard-coded value in ambient_cooling, 85d). The
    // reactivated_fluorite_vein exposed the gap: it is the first HOT scenario
    // to set thermal_pulses:false, and without the pulses' incidental
    // reheating the default 1.5°C/step had its 180°C brine at ~44°C by the
    // seal (step 78) — but an OPEN feeder advects heat, so a vein system
    // holds near brine temperature until the conduit chokes. Slow cooling
    // while open is the geologically honest knob, not scripted reheats.
    // (Historical note: through v180 the knob was RNG-NEUTRAL on the SHARED
    // rng — the uniform draw happened regardless of rate, keeping unset
    // scenarios byte-identical. Since v181 the thermal draws live on the
    // dedicated thermal stream (85j _makeThermalRng), where the same
    // always-draw pattern keeps that stream's cursor rate-independent.)
    this.cooling_rate = (typeof opts.cooling_rate === 'number' && isFinite(opts.cooling_rate) && opts.cooling_rate >= 0)
      ? opts.cooling_rate : 1.5;
    // Alpine-cleft (Zerrkluft) flag — Grimsel/Aar Swiss tension fissures. Opts
    // in to the quartz GWINDEL habit (js/45 classifyQuartzGwindel; SIM 207) and
    // the Tessin/sceptre cleft idiom. Default false (no effect elsewhere).
    this.alpine_cleft = (opts.alpine_cleft !== undefined) ? !!opts.alpine_cleft : false;
  }

  dissolve(acid_strength, fluid) {
    // Gate by composition first — silicate walls are inert regardless
    // of reactivity (real silicate dissolution at sim T-P-time scales
    // is geologically negligible).
    if (this.composition !== 'limestone' && this.composition !== 'dolomite') {
      return { dissolved: false };
    }

    // Acid attack — scales with acid strength × reactivity.
    const acid_rate = Math.max(0.0, acid_strength) * 0.5 * this.reactivity;

    // Water-only baseline — fires regardless of pH but slow. Only
    // meaningful when reactivity > 1.0 (Creative-mode slider above
    // default). Models accelerated CO2-charged-groundwater dissolution.
    const water_rate = Math.max(0.0, this.reactivity - 1.0) * 0.05;

    let rate_mm = Math.min(acid_rate + water_rate, 2.0);
    if (rate_mm <= 0.0) return { dissolved: false };
    if (this.thickness_mm < rate_mm) rate_mm = this.thickness_mm;

    this.thickness_mm -= rate_mm;
    this.total_dissolved_mm += rate_mm;
    this.vug_diameter_mm += rate_mm * 2;

    const ca_released = rate_mm * 15.0;
    const co3_released = rate_mm * 12.0;
    const fe_released = rate_mm * (this.wall_Fe_ppm / 1000.0) * 0.5;
    const mn_released = rate_mm * (this.wall_Mn_ppm / 1000.0) * 0.5;
    const ph_recovery = rate_mm * 0.8;

    const ph_before = fluid.pH;
    fluid.Ca += ca_released;
    fluid.CO3 += co3_released;
    fluid.Fe += fe_released;
    fluid.Mn += mn_released;
    fluid.pH += ph_recovery;
    fluid.pH = Math.min(fluid.pH, 8.5);

    this.ca_from_wall_total += ca_released;

    return {
      dissolved: true,
      rate_mm,
      ca_released,
      co3_released,
      fe_released,
      mn_released,
      ph_before,
      ph_after: fluid.pH,
      vug_diameter: this.vug_diameter_mm,
      total_dissolved: this.total_dissolved_mm,
    };
  }
}

// One cell of the topo-map wall state. Every (ring, cell) pair has one —
// the renderer walks the cells in order and draws a line whose color and
// thickness come from the crystal occupying that cell.
class WallCell {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor() {
    this.wall_depth = 0;       // dissolution depth, mm (negative = eroded)
    this.crystal_id = null;    // id of the crystal occupying this cell
    this.mineral = null;       // mineral name for class_color lookup
    this.thickness_um = 0;     // crystal thickness at this cell, µm
    // Phase-1 Fourier profile baseline — the cell's pre-run outer
    // radius. Dissolution wall_depth stacks on top; current outer
    // radius is base_radius_mm + wall_depth. Default 0 means the
    // parent WallState's initial_radius_mm is used (backward-compat).
    this.base_radius_mm = 0;
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — chemistry lives on
    // the WallCell directly now. wall.rings[r][c] and mesh.cells[i]
    // reference the SAME WallCell object after fromWallState builds
    // the mesh (mesh.cells[i] is just a flat view of wall.rings).
    // Either accessor reads and writes the same storage; the dual
    // naming exists to support both the legacy ring-grid style and
    // the mesh-flat style without forcing every consumer to migrate
    // at once.
    //
    // fluid: independent FluidChemistry clone per cell (un-aliased
    // in Tranche 4a). null until bindRingChemistry runs.
    // temperature_ring: cached ring index for temperature lookups
    // (numbers can't be aliased like objects can, so temperature
    // stays per-ring for now; a future tranche can migrate it).
    this.fluid = null;
    this.temperature_ring = -1;
    // Proposal E (2026-05-18) — per-cell local fill bookkeeping.
    // Accumulates the volume contribution (in mm³) of every crystal
    // whose footprint covers this cell, painted each step by
    // WallState._paintCrystalVolume during _repaintWallState. The
    // local fill at this cell is _localCrystalVol_mm3 /
    // _cellCavityVolMm3(ringIdx). Reset to 0 by WallState.clear()
    // at the top of every _repaintWallState so the painter rebuilds
    // it from scratch.
    //
    // Behavior is gated by wall_state.per_cell_local_fill — when
    // false (default), this field stays at 0 throughout the run and
    // getCellLocalFill returns 0 (and callers fall back to global
    // vugFill). When true, the growth-loop dampener at the crystal's
    // anchor cell reads from here.
    //
    // Why opt-in: turning local-fill on changes every dampener input
    // for any scenario with vugFill > 0.7 (where the sigmoid kicks in),
    // so calibration baselines drift. Opt-in lets new scenarios use
    // local fill without disturbing existing baseline pins.
    this._localCrystalVol_mm3 = 0;
  }
}

// Topographic map of the vug interior, rendered as an irregular circle
// viewed from above. Each cell is a wedge of angular arc with its own
// wall_depth (how much acid has pushed that chunk of wall outward).
// Dissolution is per-cell: cells covered by acid-resistant crystals
// shield their slice, so unblocked cells erode faster — the wall ends
// up shaped like the deposit history rather than a perfect circle.
// Minimal mulberry32 PRNG — 32-bit seed in, [0,1) out. Same seed always
// produces the same stream. Used so JS + Python produce *different*
// concrete bubble placements (their RNGs don't share streams) but both
// are deterministic per their own shape_seed. For exact cross-runtime
// shape parity we'd mirror Python's Mersenne Twister; Phase 1 only
// requires reproducibility within a runtime.
function _mulberry32(seed) {
  let s = (seed | 0) >>> 0;
  return function() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bubble size ranges as fractions of vug_diameter_mm (the canonical
// unit the brief uses). Primary radii form the main cavity; secondary
// radii are small enough to read as satellite alcoves on the wall.
// Must match WallState._PRIMARY_SIZE_RANGE / _SECONDARY_SIZE_RANGE in
// vugg.py.
const PRIMARY_SIZE_RANGE = [0.4, 0.7];
const SECONDARY_SIZE_RANGE = [0.1, 0.3];
// Primary cluster tightness — secondary primaries' centres beyond
// bubble 0 are within this fraction of R of origin, so primaries
// overlap each other cohesively.
const PRIMARY_SPREAD = 0.3;

// PROPOSAL-HOST-ROCK Mechanic 5: per-archetype cavity geometry.
// Each archetype tunes the existing bubble-merge / Fourier knobs to
// produce a recognisable shape, plus a nucleation_bias that the
// nucleation engine consults to filter allowed rings (uniform =
// any ring; floor_only / walls_only / ceiling_only = constrain to
// orientation tag from WallState.ringOrientation).
//
// Slice A scope: spherical, irregular, pocket route through the
// existing _buildProfile / Fourier path with different parameters.
// tabular and basin are wired here but reuse pocket geometry pending
// dedicated builders (Slice B). Default archetype is 'pocket' with
// scales = 1.0 / bubbles = (3, 6) so legacy scenarios that don't set
// architecture produce byte-identical output.
type Archetype = 'spherical' | 'irregular' | 'tabular' | 'pocket' | 'basin';
type NucleationBias = 'uniform' | 'walls_only' | 'floor_only' | 'ceiling_only';
interface ArchetypeConfig {
  primary_bubbles: number;
  secondary_bubbles: number;
  polar_amp_scale: number;     // multiplier on _buildPolarProfile's ±0.18 base
  twist_amp_scale: number;     // multiplier on _buildTwistProfile's ±0.4 base
  // Slice B: anisotropic equator stretch. 0 = circular cross-section,
  // higher = more elongated along the +x axis. Per-cell radius is
  // multiplied by (1 + elongation × cos(2θ)). Capped at 0.85 in the
  // builder to avoid degenerate (zero-radius) directions.
  elongation: number;
  // Slice B: top-hemisphere collapse for basins. >0 enables the sigmoid
  // polar-collapse override in polarProfileFactor — ring radii at +y
  // (north) are pinched to ~5% of equator, the south half stays full.
  // 0 keeps the legacy Fourier-only polar profile.
  polar_collapse: number;
  nucleation_bias: NucleationBias;
}
const ARCHETYPE_DEFAULTS: Record<Archetype, ArchetypeConfig> = {
  // Basalt — degassed lava bubble. Smooth sphere, low irregularity.
  spherical: { primary_bubbles: 1, secondary_bubbles: 0, polar_amp_scale: 0.20, twist_amp_scale: 0.10, elongation: 0.0, polar_collapse: 0.0, nucleation_bias: 'uniform' },
  // Limestone — karst dissolution cave. High bubble count + strong polar
  // variance for the cathedral feel.
  irregular: { primary_bubbles: 4, secondary_bubbles: 12, polar_amp_scale: 1.40, twist_amp_scale: 1.20, elongation: 0.0, polar_collapse: 0.0, nucleation_bias: 'uniform' },
  // Granite — fracture pocket. Anisotropic stretch (3:1 long axis to
  // short axis) reads as a tabular fracture cross-section. walls_only
  // nucleation keeps crystals on the long flat faces.
  tabular:   { primary_bubbles: 2, secondary_bubbles: 4, polar_amp_scale: 0.80, twist_amp_scale: 0.50, elongation: 0.55, polar_collapse: 0.0, nucleation_bias: 'walls_only' },
  // Pegmatite — large crystallisation pocket. Identity transform on
  // legacy defaults so byte-equality holds when scenarios don't opt in.
  pocket:    { primary_bubbles: 3, secondary_bubbles: 6, polar_amp_scale: 1.00, twist_amp_scale: 1.00, elongation: 0.0, polar_collapse: 0.0, nucleation_bias: 'uniform' },
  // Evaporite playa — flat basin. Top hemisphere collapses to ~5% of
  // equator radius via a sigmoid override on polarProfileFactor; floor_only
  // nucleation puts crystals on the playa floor.
  basin:     { primary_bubbles: 1, secondary_bubbles: 0, polar_amp_scale: 0.10, twist_amp_scale: 0.05, elongation: 0.0, polar_collapse: 1.0, nucleation_bias: 'floor_only' },
};

// Raycast the bubble union at angle theta, honouring origin
// connectivity. Returns the outer wall distance from origin.
// LEGACY 2D — retained for the equatorial-only renderer code paths
// (99e canvas-vector 3D, 99b 2D-strip) that still want a single per-
// theta sample. Active cavity builder (_buildProfile3D) raycasts the
// 3D sphere union per (ring, cell).
function _raycastUnion(bubbles, theta) {
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const intervals = [];
  for (const [cx, cy, r] of bubbles) {
    const b = cx * cosT + cy * sinT;
    const c = cx * cx + cy * cy - r * r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const rt = Math.sqrt(disc);
    const tExit = b + rt;
    if (tExit <= 0) continue;
    intervals.push([Math.max(0, b - rt), tExit]);
  }
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  let wall = intervals[0][1];
  for (let j = 1; j < intervals.length; j++) {
    const [s, e] = intervals[j];
    if (s <= wall) { if (e > wall) wall = e; }
    else break;
  }
  return wall;
}

// 3D analogue of _raycastUnion — ray from origin along the unit vector
// (dx, dy, dz) hits the union of input spheres. Each sphere is
// [cx, cy, cz, r]. Returns the outer-wall distance from origin via the
// same "merge contiguous intervals from t=0" algorithm the 2D version
// uses; spheres disconnected from origin are skipped so a cavity stays
// one connected void rather than scattered chambers.
//
// Math: for a sphere with center C and radius r, the ray O + t·d hits
// the sphere at t = (d·C) ± sqrt((d·C)² − (|C|² − r²)). The − root is
// the entry, + root is the exit. (We assume |d| = 1 by construction —
// see _buildProfile3D where the direction is built from spherical
// coords.)
function _raycastUnion3D(spheres, dx, dy, dz) {
  const intervals = [];
  for (const [cx, cy, cz, r] of spheres) {
    const b = dx * cx + dy * cy + dz * cz;
    const cdotc = cx * cx + cy * cy + cz * cz;
    const disc = b * b - (cdotc - r * r);
    if (disc < 0) continue;
    const rt = Math.sqrt(disc);
    const tExit = b + rt;
    if (tExit <= 0) continue;
    intervals.push([Math.max(0, b - rt), tExit]);
  }
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  let wall = intervals[0][1];
  for (let j = 1; j < intervals.length; j++) {
    const [s, e] = intervals[j];
    if (s <= wall) { if (e > wall) wall = e; }
    else break;
  }
  return wall;
}

class WallState {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts: any = {}) {
    this.cells_per_ring = opts.cells_per_ring ?? 120;
    // Phase 1 of PROPOSAL-3D-SIMULATION: 16 vertically-stacked rings as
    // the new default. Engine still operates on ring[0] only — rings 1..15
    // hold pristine WallCell defaults so forward-simulation byte-equality
    // is preserved. Phase 2 (per-ring chemistry) is what makes them differ.
    this.ring_count = opts.ring_count ?? 16;
    this.vug_diameter_mm = opts.vug_diameter_mm ?? 50.0;
    this.initial_radius_mm = opts.initial_radius_mm ?? (this.vug_diameter_mm / 2);
    this.ring_spacing_mm = opts.ring_spacing_mm ?? 1.0;
    // PROPOSAL-HOST-ROCK Mechanic 5: archetype controls bubble counts,
    // polar/twist amplitude scaling, and nucleation_bias. Default
    // 'pocket' uses (3, 6) bubbles + 1.0× scaling, so scenarios that
    // don't set architecture get byte-identical legacy behavior.
    this.architecture = (opts.architecture as Archetype) ?? 'pocket';
    const arc = ARCHETYPE_DEFAULTS[this.architecture] ?? ARCHETYPE_DEFAULTS.pocket;
    this.nucleation_bias = arc.nucleation_bias;
    this.polar_amp_scale = arc.polar_amp_scale;
    this.twist_amp_scale = arc.twist_amp_scale;
    this.elongation = arc.elongation;
    this.polar_collapse = arc.polar_collapse;
    // Phase-1 two-stage bubble-merge parameters (see VugWall). Scenario
    // overrides take precedence over archetype defaults.
    this.primary_bubbles = opts.primary_bubbles ?? arc.primary_bubbles;
    this.secondary_bubbles = opts.secondary_bubbles ?? arc.secondary_bubbles;
    this.shape_seed = opts.shape_seed ?? 0;
    // Tier 1 C (post-v69): cavity material rendering style. Sourced
    // from VugWall.cavity_render at simulator construction; the
    // Three.js renderer reads wall.cavity_render to set
    // MeshStandardMaterial.flatShading on the cavity hull. Default
    // 'smooth' preserves pre-toggle appearance.
    this.cavity_render = opts.cavity_render ?? 'smooth';
    // Tranche 6 of PROPOSAL-CAVITY-MESH §14: per-vertex nucleation
    // opt-in. See VugWall constructor for the full rationale. Mirrored
    // onto WallState so _assignWallCell / _assignWallRing can read it
    // without reaching back to conditions.wall.
    this.per_vertex_nucleation = !!opts.per_vertex_nucleation;
    // Proposal E (2026-05-18) — per-cell local fill opt-in.
    // Default false → byte-identical behavior to global-fill mode.
    // When true: _repaintWallState calls _paintCrystalVolume on top
    // of paintCrystal, and the growth loop in 85-simulator.ts reads
    // the crystal's anchor-cell local fill instead of global vugFill
    // for the dampener and volume-clamp inputs. Sister flag to
    // per_vertex_nucleation — both encode the "corners stay open
    // while edges fill" Nature Comm 2022 confinement physics at
    // different layers of the simulator.
    this.per_cell_local_fill = !!opts.per_cell_local_fill;
    // v84 (2026-05-19) — is the cavity exposed to visible light?
    // Mirrored from VugWall.is_lit. Drives LIGHT_TRANSITIONS in
    // 75-transitions.ts (currently only realgar → pararealgar).
    // Default true preserves the "most vugs are eventually exposed
    // to light" assumption.
    this.is_lit = (opts.is_lit !== undefined) ? !!opts.is_lit : true;
    // Size-class cascade (2026-05): vug | pocket | cave, mirrored from
    // VugWall for UI consumers that read sim.wall_state directly.
    this.size_class = (opts.size_class as SizeClass) ?? null;
    // Populated by _buildProfile() — [[cx, cy, r], …] in mm after rescale.
    // Primaries come first, then secondaries.
    this.bubbles = [];

    // Cross-axis polar profile: per-latitude modulation factor,
    // computed lazily by _buildPolarProfile(). Renderer multiplies
    // ring radii by polarProfileFactor(φ) for vertical-axis
    // irregularity. Mirrors WallState.polar_amplitudes / phases in
    // vugg.py.
    this.polar_amplitudes = [];
    this.polar_phases = [];
    // Phase F: per-latitude θ twist. Renderer adds twist[φ] to each
    // cell's angle so adjacent rings rotate slightly and the
    // bubble-merge bumps spiral up the cavity wall. Mirrors
    // WallState.twist_amplitudes / phases in vugg.py.
    this.twist_amplitudes = [];
    this.twist_phases = [];

    this.rings = [];
    for (let r = 0; r < this.ring_count; r++) {
      const ring = [];
      for (let c = 0; c < this.cells_per_ring; c++) ring.push(new WallCell());
      this.rings.push(ring);
    }
    // Bake per-cell base_radius_mm from the 3D sphere-union profile.
    // Must happen before max_seen_radius_mm is seeded so promontories
    // contribute. _buildProfile3D writes a UNIQUE radius per (ring,
    // cell) because each cell raycasts a different 3D direction
    // through the union; the legacy 2D _buildProfile (still defined
    // below) duplicated one rawRadii[c] across every ring and viewed
    // from the pole-axis produced "all the expanded areas meet in one
    // central point" — the laundry-bag silhouette the boss spotted
    // 2026-05-11. _buildProfile3D fixes that by sampling per (ring,
    // cell), so secondary bumps live at random 3D points rather than
    // extruded vertical columns.
    this._buildProfile3D();
    this._buildPolarProfile();
    this._buildTwistProfile();
    // 3D builder already encodes the full per-cell variation in
    // base_radius_mm; the Fourier polar amplitudes + ring twist were
    // the workaround for the 2D-extruded geometry. Zero them out so
    // the renderer's polarProfileFactor(phi) returns 1.0 (no
    // modulation) and ringTwistRadians(phi) returns 0.0 (no spiral).
    // polar_collapse stays untouched — basin archetype's sigmoid top-
    // hemisphere pinch is a separate mechanic that still applies on
    // top of the 3D base profile.
    for (let n = 0; n < this.polar_amplitudes.length; n++) this.polar_amplitudes[n] = 0;
    for (let n = 0; n < this.twist_amplitudes.length; n++) this.twist_amplitudes[n] = 0;

    // Monotonic scale reference for the renderer. Starts generously
    // (2× the largest base radius — or 2× initial_radius_mm for a
    // default-round vug) so the view doesn't zoom in on enlargement,
    // and only grows — it never snaps back.
    let maxBase = this.initial_radius_mm;
    for (const ring of this.rings)
      for (const c of ring)
        if (c.base_radius_mm > maxBase) maxBase = c.base_radius_mm;
    this.max_seen_radius_mm = maxBase * 2;
  }

  // 2026-05-11 — true 3D sphere-union cavity geometry. Replaces the
  // legacy 2D bubble-merge (_buildProfile) for the production cavity
  // path. The 2D version is retained below for any renderer or test
  // that still wants per-theta-only samples.
  //
  // Geometry per boss spec (2026-05-11):
  //
  //   Stage 1 — Primary: one large central sphere at origin with
  //             radius = initial_radius_mm. Establishes the main cavity
  //             and guarantees origin coverage.
  //
  //   Stage 2 — Secondaries: `primary_bubbles` smaller spheres, each
  //             centered at a random point on the primary's outer
  //             surface (i.e., a random unit-vector direction × R).
  //             Radius uniform in [R/3, 2R/3] per the boss's "2/3 to
  //             1/3 the diameter of the original sphere" sizing. Each
  //             secondary's interior overlaps the primary (the half-
  //             sphere reaching INTO the primary harmlessly merges
  //             via the union; the half reaching OUT becomes a bump
  //             on the cavity wall).
  //
  //   Stage 3 — Tertiaries: `secondary_bubbles` very small spheres,
  //             each centered on the surface of a randomly-picked
  //             host (primary or any secondary, weighted by surface
  //             area). Radius uniform in [0.08R, 0.12R] — the
  //             "~1/10 the original sphere size" the boss specified.
  //             Adds the fine-grained dimpling on top of the
  //             coarse bumps.
  //
  // For each (ring, cell), raycast from origin along the spherical
  // direction (sin φ cos θ, −cos φ, sin φ sin θ) — matching WallMesh's
  // convention with south at −y, north at +y — into the sphere union.
  // The 3D version gives a TRULY per-vertex cavity profile; the 2D
  // version duplicated rawRadii[c] across every ring, so seen from the
  // pole-axis the lobes converged at the same theta on every latitude
  // (the "laundry bag" silhouette).
  //
  // Reproducibility: the entire sphere set is generated from
  // shape_seed via _mulberry32, so a given (scenario, shape_seed)
  // produces byte-identical sphere placements forever — the boss's
  // "all these random variations should be repeatable as unique
  // seeds" contract.
  _buildProfile3D() {
    const rng = _mulberry32(this.shape_seed | 0);
    const R = this.initial_radius_mm;
    const N = this.cells_per_ring;
    const M = this.ring_count;

    // ---- Helpers ----
    // Uniform random direction on the unit sphere. The (u, theta)
    // trick: u uniform in [-1, 1] gives uniform cos-latitude, theta
    // uniform in [0, 2π] gives uniform longitude → uniform on S².
    const randDir = () => {
      const u = 2 * rng() - 1;
      const t = 2 * Math.PI * rng();
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      return [s * Math.cos(t), u, s * Math.sin(t)];
    };

    // ---- Stage 1: primary sphere at origin ----
    const spheres: number[][] = [[0, 0, 0, R]];

    // ---- Stage 2: secondaries on primary surface ----
    // Each secondary is placed at a random surface point of the
    // primary (origin + randDir × R) and gets radius R × [1/3, 2/3].
    const secCount = Math.max(0, this.primary_bubbles | 0);
    for (let k = 0; k < secCount; k++) {
      const [dx, dy, dz] = randDir();
      const cx = dx * R;
      const cy = dy * R;
      const cz = dz * R;
      const r = R * (1.0 / 3.0 + (1.0 / 3.0) * rng());
      spheres.push([cx, cy, cz, r]);
    }

    // ---- Stage 3: tertiaries on any existing sphere's surface ----
    // Pick a host weighted by surface area (∝ r²) so larger bumps
    // attract more dimples — geologically motivated (more surface =
    // more nucleation sites for late-stage dissolution).
    const pickHost = (): number[] => {
      let total = 0;
      for (const sp of spheres) total += sp[3] * sp[3];
      let pick = rng() * total;
      for (const sp of spheres) {
        pick -= sp[3] * sp[3];
        if (pick <= 0) return sp;
      }
      return spheres[spheres.length - 1];
    };
    const tertCount = Math.max(0, this.secondary_bubbles | 0);
    for (let k = 0; k < tertCount; k++) {
      const host = pickHost();
      const [dx, dy, dz] = randDir();
      const cx = host[0] + dx * host[3];
      const cy = host[1] + dy * host[3];
      const cz = host[2] + dz * host[3];
      // Uniform in [0.08, 0.12] × R for the small-dimple band.
      const r = R * (0.08 + 0.04 * rng());
      spheres.push([cx, cy, cz, r]);
    }

    // ---- Per (ring, cell) raycast ----
    // The raw radius at each cell is the union-wall distance from
    // origin in the cell's spherical direction. Cells that miss the
    // union (shouldn't happen given the primary always covers origin)
    // fall back to R.
    const rawRadii = new Float32Array(M * N);
    let sumRaw = 0;
    for (let r = 0; r < M; r++) {
      const phi = Math.PI * (r + 0.5) / M;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let c = 0; c < N; c++) {
        const theta = 2 * Math.PI * c / N;
        const dx = sinPhi * Math.cos(theta);
        const dy = -cosPhi;
        const dz = sinPhi * Math.sin(theta);
        const w = _raycastUnion3D(spheres, dx, dy, dz);
        const radius = w > 0 ? w : R;
        rawRadii[r * N + c] = radius;
        sumRaw += radius;
      }
    }

    // ---- Anisotropic stretch (elongation, tabular archetype) ----
    // Same per-cell stretch the 2D builder applied, but here it acts
    // on the equatorial plane only (theta direction). Floor sphere
    // is still untouched in y — that's the right behavior for a
    // "tabular fracture pocket viewed end-on."
    const elong = Math.max(0, Math.min(0.85, this.elongation ?? 0));
    if (elong > 0) {
      sumRaw = 0;
      for (let r = 0; r < M; r++) {
        for (let c = 0; c < N; c++) {
          const theta = 2 * Math.PI * c / N;
          const stretched = rawRadii[r * N + c] * (1 + elong * Math.cos(2 * theta));
          rawRadii[r * N + c] = stretched;
          sumRaw += stretched;
        }
      }
    }

    // ---- Rescale to nominal mean radius == initial_radius_mm ----
    // The sphere union typically has mean radius > R (bumps stick
    // out), so we shrink uniformly so the user-specified vug_diameter
    // still describes the average cavity size. Same trick the 2D
    // builder uses.
    const totalCells = M * N;
    const meanRaw = totalCells > 0 ? sumRaw / totalCells : R;
    const scale = meanRaw > 1e-6 ? R / meanRaw : 1.0;

    // Store the rescaled sphere set so debugging / future renderer
    // modes (sharp-edge wireframe, sphere overlay) can inspect it.
    this.bubbles = spheres.map(([cx, cy, cz, r]) => [cx * scale, cy * scale, cz * scale, r * scale]);

    // Write the per-cell base_radius. With the 3D builder these are
    // GENUINELY DIFFERENT per (r, c) — that's the fix.
    for (let r = 0; r < M; r++) {
      const ring = this.rings[r];
      for (let c = 0; c < N; c++) {
        ring[c].base_radius_mm = rawRadii[r * N + c] * scale;
      }
    }
  }

  // Legacy 2D bubble-merge profile builder. Retained for reference and
  // for any future code path that wants a single per-theta sample
  // (e.g., the 2D-strip renderer 99b never needed per-(r,c) detail).
  // The active constructor calls _buildProfile3D — see above.
  //
  // Pre-2026-05-11 _buildProfile was the production cavity builder:
  // it generates 2D circles in the equatorial plane, samples the
  // union at each cell theta, and duplicates the same N-length
  // rawRadii[] across every ring. That extrusion-from-2D is the
  // "laundry bag" artifact: lobes at theta_k stack VERTICALLY because
  // every ring has rawRadii[k] at the same theta_k. Looking down the
  // pole axis (top-down view), all the bumps converge at the same
  // angular positions — pinching into a single central point at the
  // pole.
  _buildProfile() {
    const rng = _mulberry32(this.shape_seed | 0);
    const R = this.initial_radius_mm;
    const D = 2 * R;
    const [pLo, pHi] = PRIMARY_SIZE_RANGE;
    const [sLo, sHi] = SECONDARY_SIZE_RANGE;

    // ---- Stage 1: primary void ----
    // Primary 0 always at origin, mid-size. Anchors the main cavity
    // and guarantees origin coverage.
    const r0 = D * (pLo + pHi) * 0.5;
    const primaries = [[0, 0, r0]];
    for (let k = 0; k < Math.max(0, (this.primary_bubbles | 0) - 1); k++) {
      // Clustered near origin so primaries overlap into one cavity.
      const d = PRIMARY_SPREAD * R * rng();
      const phi = rng() * 2 * Math.PI;
      const cx = d * Math.cos(phi);
      const cy = d * Math.sin(phi);
      const r = D * (pLo + (pHi - pLo) * rng());
      primaries.push([cx, cy, r]);
    }

    // ---- Stage 2: secondary dissolution ----
    // Each secondary spawns ON the primary union's outer edge at a
    // random angle. Half the bubble extends past the primary (the
    // alcove), inner half overlaps harmlessly back into the primary.
    const secondaries = [];
    for (let k = 0; k < Math.max(0, this.secondary_bubbles | 0); k++) {
      const theta = rng() * 2 * Math.PI;
      const rPrim = _raycastUnion(primaries, theta);
      if (rPrim <= 0) continue;
      const cx = rPrim * Math.cos(theta);
      const cy = rPrim * Math.sin(theta);
      const r = D * (sLo + (sHi - sLo) * rng());
      secondaries.push([cx, cy, r]);
    }

    const bubbles = primaries.concat(secondaries);

    // ---- Sample the full union at cell angles ----
    const N = this.cells_per_ring;
    const rawRadii = new Array(N);
    for (let i = 0; i < N; i++) {
      const w = _raycastUnion(bubbles, 2 * Math.PI * i / N);
      rawRadii[i] = w > 0 ? w : R;
    }

    // Slice B: anisotropic stretch for tabular archetypes. Per-cell
    // radius gets multiplied by (1 + e × cos(2θ)) so theta=0,π expand
    // and theta=π/2,3π/2 contract — the cavity reads as a flat fracture
    // pocket viewed end-on. e capped at 0.85 to keep the short-axis
    // direction visible (factor stays ≥ 0.15). 0 = no stretch (legacy).
    const elong = Math.max(0, Math.min(0.85, this.elongation ?? 0));
    if (elong > 0) {
      for (let i = 0; i < N; i++) {
        const theta = 2 * Math.PI * i / N;
        rawRadii[i] *= (1 + elong * Math.cos(2 * theta));
      }
    }

    // ---- Rescale to nominal mean ----
    let meanRaw = 0;
    for (const v of rawRadii) meanRaw += v;
    meanRaw /= Math.max(rawRadii.length, 1);
    const scale = meanRaw > 1e-6 ? R / meanRaw : 1.0;
    this.bubbles = bubbles.map(([cx, cy, r]) => [cx * scale, cy * scale, r * scale]);
    for (const ring of this.rings) {
      for (let j = 0; j < ring.length; j++) {
        ring[j].base_radius_mm = rawRadii[j] * scale;
      }
    }
  }

  // Cross-axis (polar) Fourier profile. Three harmonics with random
  // amplitudes ±18% and random phases, keyed by a derived seed so the
  // polar profile is reproducible per scenario without polluting the
  // equatorial RNG sequence. Mirrors WallState._build_polar_profile in
  // vugg.py.
  _buildPolarProfile() {
    const seed = ((this.shape_seed | 0) ^ 0x700AA517) >>> 0;
    const rng = _mulberry32(seed);
    const HARMONICS = 3;
    const AMP_LO = -0.18, AMP_HI = 0.18;
    const scale = (this.polar_amp_scale ?? 1.0);
    this.polar_amplitudes = [];
    this.polar_phases = [];
    for (let n = 0; n < HARMONICS; n++) {
      this.polar_amplitudes.push((AMP_LO + (AMP_HI - AMP_LO) * rng()) * scale);
      this.polar_phases.push(rng() * 2 * Math.PI);
    }
  }

  // Per-latitude radial multiplier. φ ∈ [0, π], south pole at 0,
  // north at π. Floored at 0.5 so a strong pinch can't collapse a
  // ring to zero radius.
  //
  // Slice B: when polar_collapse > 0 (basin archetype), overlay a
  // sigmoid that pinches the north hemisphere — south pole stays
  // ~full radius, north pole drops to ~5%. The Fourier remains as
  // small jitter so the floor isn't a perfect disc. Strength
  // (polar_collapse ∈ [0, 1]) controls how aggressively the top
  // collapses; 1 = full basin pinch, 0 = legacy Fourier-only.
  polarProfileFactor(phi) {
    let fourier = 1.0;
    for (let n = 0; n < this.polar_amplitudes.length; n++) {
      fourier += this.polar_amplitudes[n] * Math.cos((n + 1) * phi + this.polar_phases[n]);
    }
    const collapse = this.polar_collapse ?? 0;
    if (collapse > 0) {
      // Sigmoid: 1.0 at south (phi=0), ~0.05 at north (phi=π),
      // transitioning around equator (phi=π/2). Sigma=0.25 sets the
      // transition width — softer than a step so basin walls don't
      // create a sharp ring at the meniscus.
      const FLOOR = 0.05;
      const sigma = 0.25;
      const s = 1.0 / (1.0 + Math.exp((phi - Math.PI / 2) / sigma));
      const sigmoid = FLOOR + (1.0 - FLOOR) * s;
      // Lerp Fourier toward sigmoid by collapse strength. Keep the
      // Fourier jitter on the south half (where it stays ~full radius)
      // so the floor has texture; the multiplication preserves that.
      const blended = fourier * sigmoid * collapse + fourier * (1 - collapse);
      return Math.max(FLOOR * 0.5, blended);
    }
    return Math.max(0.5, fourier);
  }

  // Phase F: per-latitude twist profile. Three harmonics with
  // amplitudes ~ ±0.4 rad. Mirrors WallState._build_twist_profile in
  // vugg.py. Different XOR mask from polar so the two profiles are
  // independent — a strong polar bulge doesn't force a strong twist.
  _buildTwistProfile() {
    const seed = ((this.shape_seed | 0) ^ 0xBEEFFACE) >>> 0;
    const rng = _mulberry32(seed);
    const HARMONICS = 3;
    const AMP_LO = -0.4, AMP_HI = 0.4;
    const scale = (this.twist_amp_scale ?? 1.0);
    this.twist_amplitudes = [];
    this.twist_phases = [];
    for (let n = 0; n < HARMONICS; n++) {
      this.twist_amplitudes.push((AMP_LO + (AMP_HI - AMP_LO) * rng()) * scale);
      this.twist_phases.push(rng() * 2 * Math.PI);
    }
  }

  // Per-latitude θ offset in radians. Renderer adds this to each cell's
  // angle on its ring; the equatorial bubble-merge bumps spiral up the
  // cavity wall rather than stacking in vertical columns.
  ringTwistRadians(phi) {
    let twist = 0.0;
    for (let n = 0; n < this.twist_amplitudes.length; n++) {
      twist += this.twist_amplitudes[n] * Math.cos((n + 1) * phi + this.twist_phases[n]);
    }
    return twist;
  }

  // Wall arc length for one cell — uses current mean radius (per-cell
  // base + wall_depth) so the metric tracks both the irregular profile
  // and dissolution.
  get cell_arc_mm() {
    const ring0 = this.rings[0] || [];
    if (!ring0.length) {
      return 2 * Math.PI * this.initial_radius_mm / Math.max(this.cells_per_ring, 1);
    }
    let sum = 0;
    for (const c of ring0) sum += c.base_radius_mm + c.wall_depth;
    const meanR = sum / ring0.length;
    return 2 * Math.PI * meanR / Math.max(this.cells_per_ring, 1);
  }

  // Outer radius of a specific ring-0 cell, including dissolution.
  cellRadiusMm(cellIdx) {
    const N = this.cells_per_ring;
    const cell = this.rings[0][((cellIdx % N) + N) % N];
    return cell.base_radius_mm + cell.wall_depth;
  }

  meanDiameterMm() {
    const ring0 = this.rings[0];
    if (!ring0 || !ring0.length) return this.vug_diameter_mm;
    let sum = 0;
    for (const c of ring0) sum += c.base_radius_mm + c.wall_depth;
    return 2 * sum / ring0.length;
  }

  updateDiameter(newDiameter) { this.vug_diameter_mm = newDiameter; }

  // PHASE-2-CAVITY-MESH (PROPOSAL-CAVITY-MESH §6): lazy accessor that
  // returns a WallMesh built from this WallState. First access pays the
  // factory cost (~ringCount × cells_per_ring vertex allocations);
  // subsequent accesses return the same instance after a cheap
  // signature check that re-bakes positions/colors when the cavity
  // shifts (dissolution, fluid-level change). Renderers prefer this
  // path; the legacy ring loop still works as a fallback for any
  // consumer that hasn't migrated yet.
  //
  // Why a getter (vs. a plain field): WallMesh.fromWallState() requires
  // the WallState to be fully built (rings, polar profile, twist
  // profile all populated), so we can't construct it in the WallState
  // constructor without ordering hazards. Lazy + cached side-steps the
  // bootstrap problem and matches the "pay only if a 3D renderer is
  // actually attached" cost model on headless tests.
  //
  // Signature optionally folds in the sim (for water-state coloring).
  // Callers that don't have a sim pass undefined; the colors fall
  // through to the dry palette and the cache still busts on
  // dissolution alone.
  meshFor(sim?) {
    // WallMesh lives in js/23-geometry-wall-mesh.ts; the bundle's
    // SCRIPT-mode concatenation in tools/build.mjs guarantees it's
    // declared by the time meshFor() is called at render time. The
    // lazy build keeps the cost off the WallState constructor for
    // headless test paths that never touch the renderer.
    if (!this._mesh) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const WM: any = (typeof WallMesh !== 'undefined') ? WallMesh : null;
      if (!WM) return null;
      this._mesh = WM.fromWallState(this, sim);
    } else {
      this._mesh.recomputeIfStale(this, sim);
    }
    return this._mesh;
  }

  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1 (v158) — lazy + cached
  // factory for the cavity interior voxel grid. Same pattern as
  // meshFor(): build on first call, cache for subsequent calls.
  //
  // Address scheme: (ringIdx, cellIdx, depthIdx) where depth 0 is the
  // wall (aliased to mesh cell fluid via [FIRM] B) and depth_count-1
  // is the cavity center. See PROPOSAL-CAVITY-INTERIOR-VOXELS.md for
  // the full design + decision rationale.
  //
  // The grid build requires the wall mesh to exist (the d=0 voxel
  // aliasing depends on mesh.cells[].fluid being populated). This
  // method forces the mesh first, then builds the voxel grid against
  // it. Returns null in headless test paths where CavityVoxelGrid
  // isn't loaded (the lazy guard mirrors meshFor's WallMesh guard).
  voxelGridFor(sim?) {
    if (!this._voxelGrid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const VG: any = (typeof CavityVoxelGrid !== 'undefined') ? CavityVoxelGrid : null;
      if (!VG) return null;
      // Force the mesh first — voxel grid aliases mesh cell fluids
      // at d=0, so the mesh must be live before allocation.
      this.meshFor(sim);
      this._voxelGrid = VG.fromWallState(this, sim);
    }
    return this._voxelGrid;
  }

  // PHASE-1-CAVITY-MESH (PROPOSAL-CAVITY-MESH §5): compute the
  // spherical-coordinate anchor for a (ringIdx, cellIdx) pair on the
  // current ring grid. phi ∈ [0, π] (south pole 0, north pole π),
  // matching the renderer's _topoBuildCavityGeometry and
  // _topoSyncCrystalMeshes math; theta ∈ [0, 2π) wraps around the
  // cavity equator. ringIdx and cellIdx are cached so consumers don't
  // re-derive them. cellIdx is wrapped into [0, cells_per_ring).
  //
  // Called by VugSimulator.nucleate immediately after the legacy
  // (wall_ring_index, wall_center_cell) assignment so wall_anchor and
  // the legacy fields are populated together. When the cavity mesh
  // retessellates (Phase 2), this function gets a sibling that takes
  // (phi, theta) → vertex index.
  _anchorFromRingCell(ringIdx, cellIdx) {
    const n = Math.max(1, this.ring_count);
    const N = Math.max(1, this.cells_per_ring);
    const r = ((ringIdx | 0) + n) % n;
    const c = ((cellIdx | 0) % N + N) % N;
    return {
      phi: Math.PI * (r + 0.5) / n,
      theta: 2 * Math.PI * c / N,
      ringIdx: r,
      cellIdx: c,
    };
  }

  // PHASE-4-CAVITY-MESH (PROPOSAL-CAVITY-MESH §13 Tranche 4b) —
  // resolve a crystal's anchor to a (ringIdx, cellIdx) pair. Phase 1
  // had legacy fallback to crystal.wall_ring_index / .wall_center_cell;
  // those fields retired in Tranche 4b, so wall_anchor is the sole
  // source of truth. Returns null when the crystal is unanchored
  // (rare — only mid-construction in tests).
  //
  // Phase 2.5 (irregular tessellations) will swap the body to a
  // kd-tree lookup over (phi, theta); ringIdx/cellIdx in wall_anchor
  // are caches refreshed on tessellation change. Call signature
  // stays the same.
  _resolveAnchor(crystal) {
    if (!crystal) return null;
    const a = crystal.wall_anchor;
    if (a && a.ringIdx != null && a.cellIdx != null) {
      return { ringIdx: a.ringIdx, cellIdx: a.cellIdx };
    }
    return null;
  }

  // Phase D: which third of the sphere this ring belongs to.
  // Floor / wall / ceiling tags derived from ring index — bottom
  // quarter is 'floor', top quarter is 'ceiling', middle 'wall'.
  // Mirrors WallState.ring_orientation in vugg.py.
  ringOrientation(ringIdx) {
    const n = this.ring_count;
    if (n <= 1) return 'wall';
    if (ringIdx < Math.floor(n / 4)) return 'floor';
    if (ringIdx >= Math.floor(3 * n / 4)) return 'ceiling';
    return 'wall';
  }

  // PHASE-3-CAVITY-MESH (PROPOSAL-CAVITY-MESH §7): which named zone
  // a crystal grew in. Reads the crystal's resolved anchor (Phase 1
  // helper) and asks ringOrientation for the orientation tag. Returns
  // 'floor' | 'wall' | 'ceiling' | null. Narrators can branch on this
  // without re-implementing the orientation math; future stalactite
  // habit code (PROPOSAL-3D-SIMULATION Phase D) reads the same source.
  zoneOf(crystal) {
    if (!crystal) return null;
    const anchor = this._resolveAnchor(crystal);
    if (!anchor) return null;
    return this.ringOrientation(anchor.ringIdx);
  }

  // Phase D: per-ring nucleation weight proportional to the ring's
  // circumference on the sphere. sin(latitude) at the half-step
  // offset the renderer uses, so visual area matches engine weight.
  ringAreaWeight(ringIdx) {
    const n = this.ring_count;
    if (n <= 1) return 1.0;
    const phi = Math.PI * (ringIdx + 0.5) / n;
    return Math.sin(phi);
  }

  // Map a vertical position (mm above the floor) to a ring index.
  // Floor (height=0) → ring 0; ceiling (height = ring_count *
  // ring_spacing_mm) → ring_count-1. Out-of-range heights clamp.
  // Used by Phase 2+ for per-ring chemistry / orientation tagging;
  // safe in Phase 1 (returns 0 for any height when ring_count <= 1).
  // Mirrors WallState.ring_index_for_height_mm in vugg.py.
  ringIndexForHeightMm(heightMm) {
    if (this.ring_count <= 1) return 0;
    const spacing = this.ring_spacing_mm > 0 ? this.ring_spacing_mm : 1.0;
    let idx = Math.floor(heightMm / spacing);
    if (idx < 0) return 0;
    if (idx >= this.ring_count) return this.ring_count - 1;
    return idx;
  }

  // Distribute a radial dissolution amount across unblocked cells.
  // Blocked cells (Set of cell indices) contribute zero — the acid
  // budget concentrates on exposed slices. Returns the number of
  // cells eroded.
  // colWeights (Phase 2b, optional): a length-N array of per-column erosion
  // multipliers from the fluid-source spots (FluidSpotField.columnWeights). The
  // FIXED dissolution budget (rateMm·N) is redistributed proportional to the
  // unblocked cells' weights → preferential deepening at feeder columns (lopsided
  // cavity growth). Mass-conserving (same total wall_depth added), so the Ca/CO3
  // release computed upstream in wall.dissolve() is untouched — this is purely
  // geometric. Absent/null → the legacy UNIFORM distribution (byte-identical).
  erodeCells(rateMm, blocked, colWeights) {
    if (!(rateMm > 0)) return 0;
    const ring0 = this.rings[0];
    const N = ring0.length;
    const unblocked = [];
    for (let i = 0; i < N; i++) if (!blocked.has(i)) unblocked.push(i);
    if (!unblocked.length) return 0;
    const total = rateMm * N;
    if (colWeights) {
      let wsum = 0;
      for (const i of unblocked) wsum += (colWeights[i] > 0 ? colWeights[i] : 1);
      if (wsum > 0) {
        for (const i of unblocked) {
          const wi = colWeights[i] > 0 ? colWeights[i] : 1;
          ring0[i].wall_depth += total * wi / wsum;
        }
      } else {
        const perCell = total / unblocked.length;
        for (const i of unblocked) ring0[i].wall_depth += perCell;
      }
    } else {
      const perCell = total / unblocked.length;
      for (const i of unblocked) ring0[i].wall_depth += perCell;
    }
    // Bump the monotonic render scale if any cell just passed the
    // current maximum. Uses per-cell base_radius_mm so Fourier-profile
    // bulges contribute correctly.
    for (const c of ring0) {
      const r = c.base_radius_mm + c.wall_depth;
      if (r > this.max_seen_radius_mm) this.max_seen_radius_mm = r;
    }
    return unblocked.length;
  }

  clear() {
    // Reset per-step occupancy but preserve wall_depth (cumulative).
    // Proposal E (2026-05-18): also reset per-cell local-fill volume
    // accumulator so _paintCrystalVolume rebuilds it from scratch each
    // step. wall_depth is the only field that stays cumulative — every
    // other per-step painted value is reset here.
    for (const ring of this.rings) {
      for (const cell of ring) {
        cell.crystal_id = null;
        cell.mineral = null;
        cell.thickness_um = 0;
        cell._localCrystalVol_mm3 = 0;
      }
    }
  }

  // Proposal E (2026-05-18) — per-cell cavity volume budget.
  //
  // Each cell represents a (ringIdx, cellIdx) slot of the cavity mesh.
  // Its share of the cavity volume is approximately:
  //   cellVol(r) = cavityVol × sin(phi_r) / (Σ_k sin(phi_k)) / cellsPerRing
  //
  // The polar-bias factor sin(phi) is the same `ringAreaWeight` the
  // engine already uses for nucleation weighting (the renderer's lat-
  // long tessellation has thinner rings at the poles, which would over-
  // count fill there without this correction). Sums to the spherical
  // cavity volume across all (r, c) pairs.
  //
  // Cached on the WallState since vug_diameter_mm and ring_count don't
  // change after construction (dissolution adjusts wall_depth not
  // diameter for cell-budget purposes — the cap-at-1.0 dampener handles
  // expansion via wall_depth elsewhere).
  _cellCavityVolMm3(ringIdx) {
    const n = this.ring_count;
    const N = this.cells_per_ring;
    if (n <= 0 || N <= 0) return 0;
    const R = (this.vug_diameter_mm || 50) / 2;
    if (!(R > 0)) return 0;
    // Cache ring-weight sum; invalidate if ring_count ever changes.
    if (this._cachedRingWeightSum == null || this._cachedRingWeightSum_n !== n) {
      let s = 0;
      for (let r = 0; r < n; r++) s += this.ringAreaWeight(r);
      // Fallback to n when weights are all zero (degenerate single ring).
      this._cachedRingWeightSum = s > 0 ? s : n;
      this._cachedRingWeightSum_n = n;
    }
    const cavityVol = (4 / 3) * Math.PI * R * R * R;
    const w = this.ringAreaWeight(ringIdx) / this._cachedRingWeightSum;
    return (cavityVol * w) / N;
  }

  // Proposal E (2026-05-18) — paint a crystal's _volume_mm3 contribution
  // across the cells covered by its footprint.
  //
  // Footprint geometry mirrors paintCrystal: span = 2 × halfCells + 1
  // cells along the ring, with halfCells derived from
  //   arcMm = total_growth_um/1000 × wall_spread × FOOTPRINT_SCALE
  //
  // Each covered cell accumulates crystal._volume_mm3 / span — the
  // crystal's volume contribution is divided uniformly over its
  // footprint. This is a deliberate simplification (a real crystal
  // doesn't have perfectly uniform vertical density across its
  // wall-touching face), but it captures the geological essential:
  // a wider footprint loads more cells, each at a fraction of the
  // crystal's total volume; a narrow prismatic stub concentrates its
  // volume into a few cells.
  //
  // _volume_mm3 is the zone-integrated volume from
  // Crystal.add_zone (post-2026-05-18 habit-stability fix) — the same
  // single source of truth that get_vug_fill sums for global fill.
  // So local + global fills are bookkeeping-consistent: sum of
  // (cell._localCrystalVol_mm3 across all cells with that crystal)
  // equals crystal._volume_mm3 exactly (up to the footprint cell
  // count rounding).
  //
  // No-op when per_cell_local_fill is off (caller already gates).
  _paintCrystalVolume(crystal) {
    if (!crystal) return;
    if (typeof crystal._volume_mm3 !== 'number' || !(crystal._volume_mm3 > 0)) return;
    const anchor = this._resolveAnchor(crystal);
    if (!anchor) return;
    let ringIdx = anchor.ringIdx;
    if (ringIdx == null || ringIdx < 0 || ringIdx >= this.ring_count) return;
    const centerCell = anchor.cellIdx;
    if (centerCell == null) return;
    const FOOTPRINT_SCALE = 4.0;
    const arcMm = (crystal.total_growth_um / 1000.0)
                  * Math.max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE;
    const halfCells = Math.max(1, Math.round(arcMm / this.cell_arc_mm / 2));
    const span = 2 * halfCells + 1;
    const volPerCell = crystal._volume_mm3 / span;
    const ring = this.rings[ringIdx];
    if (!ring) return;
    const N = this.cells_per_ring;
    for (let offset = -halfCells; offset <= halfCells; offset++) {
      const idx = ((centerCell + offset) % N + N) % N;
      const cell = ring[idx];
      if (!cell) continue;
      cell._localCrystalVol_mm3 = (cell._localCrystalVol_mm3 || 0) + volPerCell;
    }
  }

  // Proposal E (2026-05-18) — read the local fill at one cell.
  // Returns 0 when the cell has no crystal volume or per_cell_local_fill
  // is off (the painter never ran). Can exceed 1.0 in interlocking-
  // texture cases — the dampener's vugFill ≥ 1.0 → 0.0 branch caps
  // growth past full cell volume, mirroring the global-fill behavior.
  getCellLocalFill(ringIdx, cellIdx) {
    const ring = this.rings[ringIdx];
    if (!ring) return 0;
    const cell = ring[cellIdx];
    if (!cell) return 0;
    const v = cell._localCrystalVol_mm3 || 0;
    if (!(v > 0)) return 0;
    const cellVol = this._cellCavityVolMm3(ringIdx);
    if (!(cellVol > 0)) return 0;
    return v / cellVol;
  }

  // Proposal E (2026-05-18) — resolve a crystal's anchor cell and
  // return its local fill. Convenience wrapper for the growth loop in
  // 85-simulator.ts (which has a crystal, not a (ring, cell) pair).
  // Returns 0 for unanchored crystals — the growth loop falls back to
  // global vugFill in that case.
  getCellLocalFillForCrystal(crystal) {
    const anchor = this._resolveAnchor(crystal);
    if (!anchor) return 0;
    return this.getCellLocalFill(anchor.ringIdx, anchor.cellIdx);
  }

  // Mark the cells this crystal occupies with its id / mineral / thickness.
  // Only ring[0] in v1; multi-ring paint will follow void_reach later.
  //
  // Footprint math: wall_spread × total_growth gives the raw arc, but
  // the spec's spread values (0.2–0.9) describe the *fraction* of the
  // crystal's base that hugs the wall, so the actual arc a coating
  // habit sweeps needs a multiplier. FOOTPRINT_SCALE of 4 puts a 5mm
  // coating (0.8) at ~16mm of arc (a realistic coating footprint) and
  // a 5mm prismatic (0.2) at ~4mm (a realistic projecting stub).
  // Also paint the anchor cell *always* for nucleated crystals, even
  // before their first growth zone — otherwise a fresh crystal leaves
  // its slice of wall unshielded, the acid burns through, and the
  // crystal appears to vanish on the topo map.
  paintCrystal(crystal) {
    // PHASE-1-CAVITY-MESH: read anchor through _resolveAnchor so the
    // renderer stops reading wall_ring_index / wall_center_cell
    // directly. Behavior is unchanged when wall_anchor is set in step
    // with the legacy fields (current default at nucleation).
    const anchor = this._resolveAnchor(crystal);
    if (!anchor) return;
    let ringIdx = anchor.ringIdx;
    if (ringIdx == null || ringIdx < 0 || ringIdx >= this.ring_count) {
      ringIdx = 0;
    }
    const centerCell = anchor.cellIdx;
    const FOOTPRINT_SCALE = 4.0;
    const arcMm = (crystal.total_growth_um / 1000.0)
                  * Math.max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE;
    const halfCells = Math.max(1, Math.round(arcMm / this.cell_arc_mm / 2));
    const thickness = Math.max(crystal.total_growth_um, 1);  // nucleated = visible
    const ring = this.rings[ringIdx];
    const N = this.cells_per_ring;
    for (let offset = -halfCells; offset <= halfCells; offset++) {
      const idx = ((centerCell + offset) % N + N) % N;
      const cell = ring[idx];
      if (cell.thickness_um < thickness) {
        cell.crystal_id = crystal.crystal_id;
        cell.mineral = crystal.mineral;
        cell.thickness_um = thickness;
      }
    }
  }
}

