// ============================================================
// js/99j-helix-overlay.ts — Helicoid Manifold for multidimensional space
// ============================================================
// Working title: "helix overlay" (kept in symbols + commit messages
// for git history continuity). Boss-named v22: "its not just a
// helicoid, its a helicoid manifold for multidimensional space."
// User-facing strings (legend title, toolbar tooltip) use the full
// name; internal identifiers stay `_helix*` so existing breadcrumbs
// + git blame don't shift.
//
// === HELIX-OVERLAY-FORK ADDITION (entire file, v0–v17) ===========
// This module does not exist in vugg-simulator. The whole 1.2k-line
// file is fork-only. When merging this fork back into vugg-simulator,
// the merge strategy is: this file moves over wholesale, plus the
// four small additions in 99i-renderer-three.ts (one render hook,
// two crystal-userData stamps) and 85c-simulator-state.ts (per-ring
// chemistry snap fields), plus the index.html scaffolding (helix
// toggle button, legend div, .helix-legend* CSS). All five sites
// are bracketed with HELIX-OVERLAY-FORK ADDITION / END markers —
// grep `HELIX-OVERLAY-FORK` to find every one. The full breadcrumb
// lives in proposals/HELIX-OVERLAY-FORK-CHANGES.md.
//
// Boss model (final, post-v7 feedback):
//
//   "picture radar screens stacked up like a spiral staircase, all
//   slightly offset in their timing so they form a helicoid. each
//   one of those radar lines tells the story of everything that's
//   happening in that straight line. if in the moment of time that
//   it's illuminated the temperature is high there will be a
//   temperature line at the far end. the vugg wall depiction should
//   basically be invisible at this point. the way you see the vugg
//   wall is as the helicoid spins around and intersects with the
//   wall."
//
// So the overlay is N radar screens, one per vugg height (using the
// 16 simulator rings as the discrete Y levels for v8 — finer Y
// resolution later if needed). Each screen has its own current
// sweep angle: sweep_world(Y) = global_sweep + θ_offset(Y), where
// θ_offset(Y) maps Y back onto the helicoid spiral so the leading
// edges of the screens collectively trace the helicoid as they
// rotate. Each (parameter, ring) gets its own radar trail that
// fades over 1/4 turn behind its leading edge.
//
// What's plotted on each screen:
//   - One dot per chemistry parameter at (r=normalized-value, Y_ring,
//     world_angle = sweep + θ_offset(Y_ring)). High value = far end
//     (near outer edge); low value = near axis.
//   - A 1/4-turn trailing arc behind each dot, fading from full
//     opacity at the leading edge to zero at the fade boundary.
//
// What's NOT plotted any more:
//   - The wall-distance primary. Boss: "the vugg wall depiction
//     should basically be invisible at this point." The cavity wall
//     is already visible from the topo 3D cavity mesh; the helicoid
//     spinning around and intersecting the wall is the wall reading.
//
// Helicoid surface still rotates visibly at 40 RPM. The 6 parameter
// trails sit on the rotating surface at the leading edge and trail
// behind in world frame for 1/4 turn.

// MERGE-PREP (2026-05-28): default OFF. For the merge back into the main
// vugg repo the standard 3D vug model (cavity + crystals on
// #topo-canvas-three) is the DEFAULT view; the helicoid manifold is an
// opt-in mode reached via the toolbar ⌇ button (#helix-overlay-btn).
// Was `true` (helicoid-as-star, the fork's original identity). The
// toggle-off path in _topoHelixOverlayDraw already restores cavity +
// crystal visibility, and _helixSyncLegendVisibility already hides the
// legend when disabled — so flipping this one default is the whole
// behavior change. The ⌇ button is the persistent (minimized) entry point.
let _helixOverlayEnabled = false;
const _HELIX_N_TURNS = 1;   // one full revolution = bottom to top of cavity

// Per-param on/off — parallel to _HELIX_CHEM_PARAMS (lazily sized on
// first legend build). Click a legend row to flip the bool; the trail
// updater empties that param's draw range when off, so toggled-off
// params disappear without disturbing anyone else's verts.
let _helixParamEnabled: boolean[] = [];

// v16 focus modes. Each layers an alpha multiplier on top of the
// per-param explicit enable. _helixActiveOnlyMode hides params whose
// trail values are essentially zero (suppresses the ~30 trace ions
// that contribute nothing in most scenarios). _helixMoversMode dims
// flat params and brightens fast-changing ones using each param's
// own |Δr| as the weight. _helixHoveredParam isolates a single
// param when the cursor sits on its legend row.
let _helixActiveOnlyMode = false;
let _helixMoversMode = false;
let _helixHoveredParam: number | null = null;
let _helixParamMaxAbs: number[] = [];     // per-param: max |r| across rings this frame
let _helixParamMaxDelta: number[] = [];   // per-param: max |Δr| across rings this frame
const _HELIX_ACTIVE_MIN_R = 0.04;          // fraction of R below which "no signal"
const _HELIX_MOVER_MIN_DELTA = 0.02;       // fraction of R below which "totally flat"

// Pure-JS HSL → hex, no THREE dependency at module-load time. Used
// to spread the 41 ion trail colours evenly around the hue wheel.
function _hexFromHSL(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | b;
}

// First entry is the PRIMARY: wall distance per (ring, cell), white,
// plotted at literal world-mm (no normalization). v11: future-fade
// too — the wall is static during a scenario, so we can predict its
// position 1/4 turn ahead and render those segments with the same
// alpha ramp as the past. Boss: "its a known constant, so it makes
// sense that you could predict where it will be relatively."
//
// Then specials: temperature (from ring_temperatures), then pH / Eh
// / salinity / O2 (from ring_fluids).
//
// Then 41 ions covering the full simulator fluid vocabulary
// (_fluidFieldNames). Each ion's [min, max] range is set from
// observed typical concentrations grouped into majors (0-500 mg/L),
// commons (0-200), low (0-50), trace (0-10), ultra-trace (0-5).
// Colours auto-distributed via HSL hue spread so 41 lines stay
// distinguishable.
type ChemParam = {
  id: string,
  label: string,
  // v24: full human-readable name shown in the hover tooltip on
  // legend chips. The chip itself stays the symbol (Cu, CO3, etc.)
  // so the cloud reads as periodic-table chips; hover expands.
  // Boss flagged that "CO3" alone wasn't enough information when
  // they spotted flashes of carbonate — full name + ion form
  // disambiguates trace-vs-major and what's actually being plotted.
  fullName: string,
  min: number,
  max: number,
  color: number,
  primary?: boolean,
  // Post-v165 refactor: chips declare their classification + units at
  // the source. The recorder's _classifyChipSystem / _inferChipUnits in
  // 85g read these first, falling back to id-prefix patterns only for
  // back-compat with chips that forget to declare. Killing the silent-
  // miscategorization smell I introduced when SI_selenite landed in
  // v165 and got lumped under 'carbonate' until I added an explicit fork.
  //   system: which legend group this chip belongs to ('wall'|'special'|
  //           'carbonate'|'sulfate'|'ion'). Drives the strip-view selector
  //           and helicoid legend section.
  //   units:  display unit (e.g. '°C', 'log Ω', 'mg/L', 'ppm'). Read by
  //           strip-view tooltips + the dataset manifest's per-chip
  //           units field.
  system?: 'wall' | 'special' | 'carbonate' | 'sulfate' | 'ion',
  units?: string,
  read: (sim: any, wall: any, ringIdx: number, cellIdx: number) => number | null | undefined,
};

// v24: lookup for the human-readable name. Specials get unit hints;
// dissolved ions get either the element name or the ion form,
// whichever a geochem reader would expect. CO3, Cl, F are written as
// the ION ("Carbonate", "Chloride", "Fluoride") because that's how
// they show up in the simulator's fluid chemistry; bare metals get
// the element name (Cu = Copper, not Copper(II)) because the sim
// doesn't track oxidation state separately.
const _HELIX_FULL_NAMES: { [id: string]: string } = {
  wall:     'Wall distance (lateral, mm)',
  T:        'Temperature (°C)',
  pH:       'pH (acidity, 0–14)',
  Eh:       'Eh (redox potential, mV)',
  salinity: 'Salinity (TDS, ppt)',
  O2:       'Dissolved O₂ (mg/L)',
  concentration: 'Evaporative concentration (×, vadose-drying multiplier)',
  SiO2:     'Silica (dissolved SiO₂)',
  Ca:       'Calcium',
  CO3:      'Carbonate (CO₃²⁻)',
  Cl:       'Chloride',
  Na:       'Sodium',
  Mg:       'Magnesium',
  K:        'Potassium',
  S:        'Sulfur (total — sulfide + sulfate)',
  F:        'Fluoride',
  Fe:       'Iron',
  Mn:       'Manganese',
  Zn:       'Zinc',
  Pb:       'Lead',
  Cu:       'Copper',
  Ba:       'Barium',
  Sr:       'Strontium',
  Al:       'Aluminum',
  P:        'Phosphorus (as phosphate)',
  As:       'Arsenic',
  Ti:       'Titanium',
  U:        'Uranium',
  Mo:       'Molybdenum',
  Cr:       'Chromium',
  V:        'Vanadium',
  W:        'Tungsten',
  Ag:       'Silver',
  Bi:       'Bismuth',
  Sb:       'Antimony',
  Ni:       'Nickel',
  Co:       'Cobalt',
  B:        'Boron (as borate)',
  Li:       'Lithium',
  Cd:       'Cadmium',
  Y:        'Yttrium',
  Be:       'Beryllium',
  Te:       'Tellurium',
  Se:       'Selenium',
  Ge:       'Germanium',
  Au:       'Gold',
  Hg:       'Mercury',
  Sn:       'Tin',
  // === HELIX-OVERLAY-FORK ADDITION (Week 3 carbonate) ===============
  // PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 3 — Carbonate System
  // legend section. 11 chips consuming the Bjerrum partition (20b),
  // Ksp(T) (20c), and SI engine (32b) all shipped in Weeks 1-2 as
  // observer-only reads. The chip itself is the symbol; hover shows
  // the full name + unit per the v24 tooltip convention.
  DIC:           'Dissolved Inorganic Carbon (total, mg/L)',
  CO2aq:        'Dissolved CO₂ (H₂CO₃*, mg/L)',
  HCO3:         'Bicarbonate (HCO₃⁻, mg/L)',
  CO3_2:        'Carbonate ion (CO₃²⁻, mg/L)',
  SI_calcite:   'Saturation index — calcite (log Ω)',
  SI_aragonite: 'Saturation index — aragonite (log Ω)',
  SI_dolomite:  'Saturation index — dolomite (log Ω)',
  SI_HMC:       'Saturation index — high-Mg calcite (log Ω, x=0.10 default)',
  SI_siderite:  'Saturation index — siderite (log Ω)',
  pCO2:         'Equilibrium pCO₂ (bar)',
  f_ord:        'Dolomite ordering fraction (Kim 2023; 0=disordered, 1=ordered)',
  // === END HELIX-OVERLAY-FORK ADDITION ==============================
  // v165 — Sulfate System section (PHREEQC wateq4f Ksp via 20d + 40b).
  // Strip is no longer SI-blind on the sulfate/evaporite family
  // (naica, sicily_solfifera, sulphur_bank, sabkha, searles).
  SI_selenite:  'Saturation index — gypsum/selenite (CaSO₄·2H₂O, log Ω)',
  SI_anhydrite: 'Saturation index — anhydrite (CaSO₄, log Ω)',
  SI_barite:    'Saturation index — barite (BaSO₄, log Ω; barite is ENDOTHERMIC — K rises with T)',
  SI_celestine: 'Saturation index — celestine (SrSO₄, log Ω)',
};

// PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 3 — ambient radial-depth selector
// for chip reads. The strip recorder sets this (via _setStripChipReadDepth)
// before each radial-slice pass — depth 0 = wall, depth_count-1 = cavity
// center — so _chipFluid pulls from the CavityVoxelGrid's interior voxels
// instead of the d=0 wall cell, WITHOUT threading a depth param through
// every (non-uniform) chip read signature. Mirrors the conditions.fluid
// swap idiom in _runEngineForCrystal: set it, run the synchronous reads,
// reset to 0. Default 0 = wall = the live helicoid's behavior, which never
// touches this (so the live trail + replay paths are unaffected).
let _stripChipReadDepth = 0;
function _setStripChipReadDepth(d: number): void {
  _stripChipReadDepth = (typeof d === 'number' && d > 0) ? (d | 0) : 0;
}

const _HELIX_CHEM_PARAMS: ChemParam[] = (function() {
  const params: ChemParam[] = [];

  // ---- per-cell read helper (v157, 2026-05-27) -----------------------
  //
  // Chip read functions used to sample (s.ring_fluids || [])[i] for every
  // chemistry chip, which made them read from a NOW-VESTIGIAL backing
  // store. Post-Tranche-2+ of PROPOSAL-CAVITY-MESH the live chemistry
  // lives in mesh.cells[ri * cells_per_ring + c].fluid — per-vertex
  // clones that receive event chemistry + engine mass-balance + Laplacian
  // diffusion. ring_fluids[] still exists; events still write to
  // ring_fluids[equator] via the alias to conditions.fluid; but no other
  // ring receives any chemistry update.
  //
  // Visual fingerprint of the bug: every chemistry chip showed an
  // inverted-V spike centered on the equator height (ring 8 of 16) in
  // both the live helicoid trails AND the strip view recording — because
  // ring 8 had event-bumped chemistry while the other 15 rings sat
  // frozen at the initial broth. Per-chip normalization across the
  // dataset then mapped ring-8 highs to ~1.0 and edge lows to ~0,
  // producing identical pyramids across every time step.
  //
  // The fix is to prefer mesh.cells[ri*N+c].fluid (the live store) and
  // fall back to ring_fluids[ri] only when no mesh is reachable. The
  // fallback path lights up exclusively during replay rendering, where
  // _helixWallAtSnap returns a wall-shaped proxy that has no meshFor
  // method — so replay continues to read from the snap's frozen
  // ring_fluids array (correct historical behavior).
  //
  // Live + strip-recorder both flow through the mesh path: they pass
  // the real wall_state to chip reads, and wall_state.meshFor(sim)
  // returns the constructor-invariant mesh whose cell.fluid is the
  // canonical live chemistry handle. After this rewire, chemistry
  // chips that have uniform values across cells render as flat
  // horizontal lines (which is honest — chemistry IS uniform across
  // cells today, modulo near-vanishing diffusion gradients). Once
  // per-vertex spatial chemistry expansion lands, the same chip reads
  // will surface real height + angular gradients without any further
  // wiring change.
  //
  // Boss framing 2026-05-27: "mesh.cells is the way to go, i've wanted
  // to head that way for ages" — explicit architectural direction, not
  // just bug-fix scope.
  const _chipFluid = (s: any, w: any, ri: number, c: number): any => {
    // Phase 3 radial depth: when the recorder is sampling an interior
    // slice (_stripChipReadDepth > 0), pull the voxel grid's fluid object
    // at that depth. depth 0 falls through to the wall (d=0) path below —
    // identical to pre-Phase-3 behavior, since the d=0 voxel IS the wall
    // mesh cell via the [FIRM] B alias.
    if (_stripChipReadDepth > 0 && s && typeof s.fluidAtVoxel === 'function') {
      const vf = s.fluidAtVoxel(ri, c | 0, _stripChipReadDepth);
      if (vf) return vf;
    }
    if (w && typeof w.meshFor === 'function') {
      const mesh = w.meshFor(s);
      if (mesh && mesh.cells) {
        const N = (w.cells_per_ring | 0) || 120;
        const cell = mesh.cells[ri * N + (c | 0)];
        if (cell && cell.fluid) return cell.fluid;
      }
    }
    return (s.ring_fluids || [])[ri];
  };

  // Primary
  params.push({
    id: 'wall', label: 'wall distance', fullName: _HELIX_FULL_NAMES.wall,
    min: 0, max: 80, color: 0xffffff,
    primary: true,
    system: 'wall', units: 'mm',
    read: (sim, wall, i, c) => {
      if (!wall || !wall.rings) return null;
      const ring = wall.rings[i];
      if (!ring || !ring.length) return null;
      const cell = ring[c % ring.length];
      if (!cell) return null;
      // v17: lateral distance from the cavity's vertical axis to the
      // wall at this ring's Y height — NOT the distance from the
      // cavity center to the cell, which the previous code returned.
      // Bug surfaced: the helicoid sweeps around the vertical axis
      // at each ring's Y, so "wall distance" reading should be the
      // perpendicular-to-axis distance, which is radius·sin(phi).
      // Pre-v17 returned radius alone, so the trail plotted at full
      // equatorial radius for every ring including the polar caps —
      // visibly extending past the actual cavity shape and never
      // tapering at the top/bottom.
      const ringCount = wall.ring_count || (wall.rings ? wall.rings.length : 0);
      if (!ringCount) return null;
      const phi = Math.PI * (i + 0.5) / ringCount;
      const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
      const radius = ((cell.base_radius_mm || 0) + (cell.wall_depth || 0)) * polar;
      return radius * Math.sin(phi);
    },
  });

  // Specials
  params.push({ id: 'T',        label: 'temperature', fullName: _HELIX_FULL_NAMES.T,        min: 0,    max: 750,  color: 0xff5544,
    system: 'special', units: '°C',
    read: (s, w, i, c) => (s.ring_temperatures || [])[i] });
  params.push({ id: 'pH',       label: 'pH',          fullName: _HELIX_FULL_NAMES.pH,       min: 0,    max: 14,   color: 0x9966ee,
    system: 'special', units: '',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).pH });
  params.push({ id: 'Eh',       label: 'Eh',          fullName: _HELIX_FULL_NAMES.Eh,       min: -400, max: 800,  color: 0xddee44,
    system: 'special', units: 'mV',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).Eh });
  params.push({ id: 'salinity', label: 'salinity',    fullName: _HELIX_FULL_NAMES.salinity, min: 0,    max: 200,  color: 0x44ccdd,
    system: 'special', units: 'psu',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).salinity });
  params.push({ id: 'O2',       label: 'O2',          fullName: _HELIX_FULL_NAMES.O2,       min: 0,    max: 10,   color: 0xaaccff,
    system: 'special', units: 'mg/L',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).O2 });
  // v161 evaporite driver: the per-cell `concentration` multiplier (default
  // 1.0, ×EVAPORATIVE_CONCENTRATION_FACTOR per wet→vadose drying in
  // 85c _applyVadoseOxidationOverride). This is THE driver for the evaporite
  // family (searles/sabkha/naica) — borax/mirabilite/thenardite nucleation
  // gates key off it, not off the raw ions (which the seed sets once and the
  // events leave static). Before this chip the strip was blind to it, so
  // evaporite scenarios read as misleadingly "flat". Recording-only — reads
  // the same per-cell store as the other specials; no sim change.
  params.push({ id: 'concentration', label: 'evap conc', fullName: _HELIX_FULL_NAMES.concentration, min: 0, max: 10, color: 0xffbb33,
    system: 'special', units: '×',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).concentration });

  // === HELIX-OVERLAY-FORK ADDITION (Week 3 carbonate) ===============
  // PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 3 — Carbonate System chips.
  //
  // 11 observer-only readings that consume the Bjerrum partition (20b),
  // Ksp(T) (20c), and SI engine (32b) shipped in Weeks 1-2. No engine
  // promotion required — these chips just visualize what's already
  // computable from the per-ring fluid + temperature snap. CARBONATE_
  // KSP_ACTIVE stays false; the SI math runs as a pure observable
  // (carbonateSaturationIndex/carbonateOmega) regardless of flag state.
  //
  // SI ranges: [-3, +3] log Ω covers ~99% of natural-water conditions.
  // SI=0 is equilibrium; trail at 0.5R = equilibrium, above = super-
  // saturated, below = undersaturated.
  //
  // HMC SI uses a default mg_content=0.10 (typical biogenic HMC per
  // Bischoff 1987). Phase 1c will move mg_content to per-crystal
  // state; this chip will refine to use the dominant HMC crystal's
  // value at that point.
  //
  // f_ord = 1 - exp(-N/7) where N = _dol_cycle_count (single value
  // per simulator per Kim 2023 cycle-counting in 25-chemistry-
  // conditions.ts:88). Same value at every ring's height — the chip
  // shows the GLOBAL dolomite-ordering trajectory.

  const _HMC_DEFAULT_MG = 0.10;
  const _F_ORD_N0 = 7;

  // v166 — SI chip floor clamp. When carbonateSaturationIndex returns
  // NaN (any required cation = 0 → log of zero, mathematically undefined),
  // the chip would previously return null and the strip would show a gap.
  // Visually that read as "no data / broken chip" when the geological
  // story is "deeply undersaturated (cation is fully depleted)" — same
  // outcome the chip floor already represents for any value below −8.
  // Clamp non-finite SI to the chip's display floor instead of null;
  // strip becomes continuous, "very-undersat" reads correctly.
  //
  // The OUTER `if (!f) return null` stays — that's "no fluid sampled
  // at all" (voxel doesn't exist), a different absence we want to keep
  // legible as a gap.
  const _SI_CHIP_FLOOR = -8;
  const _readSI = (mineralId: string) => (s: any, w: any, i: number, c: number) => {
    const f = _chipFluid(s, w, i, c);
    if (!f) return null;
    const T = (s.ring_temperatures || [])[i];
    const T_use = (typeof T === 'number') ? T : 25;
    if (typeof carbonateSaturationIndex !== 'function') return null;
    const si = carbonateSaturationIndex(mineralId, f, T_use);
    return isFinite(si) ? si : _SI_CHIP_FLOOR;
  };

  params.push({
    id: 'DIC', label: 'DIC', fullName: _HELIX_FULL_NAMES.DIC,
    min: 0, max: 4500, color: 0xC9A875,
    system: 'carbonate', units: 'mg/L',
    read: (s, w, i, c) => (_chipFluid(s, w, i, c) || {}).CO3,
  });
  params.push({
    id: 'CO2aq', label: 'CO₂', fullName: _HELIX_FULL_NAMES.CO2aq,
    min: 0, max: 500, color: 0xF5E5A0,
    system: 'carbonate', units: 'mg/L',
    read: (s, w, i, c) => {
      const f = _chipFluid(s, w, i, c);
      if (!f || typeof f.CO3 !== 'number' || f.CO3 <= 0) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      if (typeof bjerrumFractions !== 'function') return null;
      const pH = (typeof f.pH === 'number') ? f.pH : 7.0;
      return f.CO3 * bjerrumFractions(pH, T_use).H2CO3;
    },
  });
  params.push({
    id: 'HCO3', label: 'HCO₃', fullName: _HELIX_FULL_NAMES.HCO3,
    min: 0, max: 4500, color: 0x6B96D9,
    system: 'carbonate', units: 'mg/L',
    read: (s, w, i, c) => {
      const f = _chipFluid(s, w, i, c);
      if (!f || typeof f.CO3 !== 'number' || f.CO3 <= 0) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      if (typeof bjerrumFractions !== 'function') return null;
      const pH = (typeof f.pH === 'number') ? f.pH : 7.0;
      return f.CO3 * bjerrumFractions(pH, T_use).HCO3;
    },
  });
  params.push({
    id: 'CO3_2', label: 'CO₃²⁻', fullName: _HELIX_FULL_NAMES.CO3_2,
    min: 0, max: 80, color: 0x4A7FE0,
    system: 'carbonate', units: 'mg/L',
    read: (s, w, i, c) => {
      const f = _chipFluid(s, w, i, c);
      if (!f) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      if (typeof carbonateIonPpm !== 'function') return null;
      return carbonateIonPpm(f, T_use);
    },
  });
  params.push({
    id: 'SI_calcite', label: 'SI cal', fullName: _HELIX_FULL_NAMES.SI_calcite,
    min: -8, max: 8, color: 0xF0F0FF,
    system: 'carbonate', units: 'log Ω',
    read: _readSI('calcite'),
  });
  params.push({
    id: 'SI_aragonite', label: 'SI arg', fullName: _HELIX_FULL_NAMES.SI_aragonite,
    min: -8, max: 8, color: 0xCCCCCC,
    system: 'carbonate', units: 'log Ω',
    read: _readSI('aragonite'),
  });
  params.push({
    id: 'SI_dolomite', label: 'SI dol', fullName: _HELIX_FULL_NAMES.SI_dolomite,
    min: -8, max: 8, color: 0xB87C40,
    system: 'carbonate', units: 'log Ω',
    read: _readSI('dolomite'),
  });
  params.push({
    id: 'SI_HMC', label: 'SI HMC', fullName: _HELIX_FULL_NAMES.SI_HMC,
    min: -8, max: 8, color: 0x9078A0,
    system: 'carbonate', units: 'log Ω',
    read: (s, w, i, c) => {
      const f = _chipFluid(s, w, i, c);
      if (!f) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      if (typeof carbonateSaturationIndex !== 'function') return null;
      const si = carbonateSaturationIndex('HMC', f, T_use, _HMC_DEFAULT_MG);
      return isFinite(si) ? si : _SI_CHIP_FLOOR;  // v166 floor-clamp; cf. _readSI
    },
  });
  params.push({
    id: 'SI_siderite', label: 'SI sid', fullName: _HELIX_FULL_NAMES.SI_siderite,
    min: -8, max: 8, color: 0xB85C2B,
    system: 'carbonate', units: 'log Ω',
    read: _readSI('siderite'),
  });
  params.push({
    id: 'pCO2', label: 'pCO₂', fullName: _HELIX_FULL_NAMES.pCO2,
    min: 0, max: 1, color: 0x4DBC5C,
    system: 'carbonate', units: 'atm',
    read: (s, w, i, c) => {
      const f = _chipFluid(s, w, i, c);
      if (!f) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      if (typeof equilibriumPCO2 !== 'function') return null;
      return equilibriumPCO2(f, T_use);
    },
  });
  params.push({
    id: 'f_ord', label: 'f_ord', fullName: _HELIX_FULL_NAMES.f_ord,
    min: 0, max: 1, color: 0xA060D0,
    system: 'carbonate', units: '',
    read: (s, w, i, c) => {
      // _dol_cycle_count lives on conditions. The live helicoid passes a
      // snap that mirrors it up to the top level (_helixSimAtSnap), so the
      // first branch hits there. The strip RECORDER passes the raw sim
      // (85g captureStep), where the counter sits at sim.conditions —
      // without this fallback the recorded f_ord trail was silently flat
      // zero (the Kim-mechanism ordering signal invisible in strip view).
      const n = (typeof s._dol_cycle_count === 'number')
        ? s._dol_cycle_count
        : (s && s.conditions && typeof s.conditions._dol_cycle_count === 'number')
          ? s.conditions._dol_cycle_count
          : 0;
      return 1 - Math.exp(-n / _F_ORD_N0);
    },
  });
  // === END HELIX-OVERLAY-FORK ADDITION ==============================

  // v165 — SULFATE SYSTEM SI chips. 4 chips consuming the Ksp engine
  // (20d) + SI dispatcher (40b) shipped in v164 as observer-only reads,
  // matching the carbonate-SI pattern above. Resolves the "carbonate-
  // SI-only" instrument gap the 2026-05-30 strip survey identified:
  // naica's selenite, sicily_solfifera's celestine, and the sulphur_bank
  // / sabkha / searles sulfate trajectories are now SI-legible. Range
  // [-8, 8] matches the carbonate SI chips for visual comparability.
  //
  // The chip itself stays the SI_<mineral> token; hover shows the formula
  // + the barite-endotherm warning per the v24 tooltip convention. The
  // 4 readers all delegate to the same sulfateSaturationIndex dispatch.
  if (typeof sulfateSaturationIndex === 'function') {
    // v166 — same floor-clamp pattern as the carbonate _readSI above.
    // When sulfateSaturationIndex is undefined (e.g. SI_celestine where
    // Sr = 0, SI_barite where Ba = 0), report the chip floor instead
    // of null so the strip stays continuous. The geological reading is
    // "deeply undersaturated — no possible precipitation" either way.
    const _readSulfateSI = (mineralId: string) => (s: any, w: any, i: number, c: number) => {
      const f = _chipFluid(s, w, i, c);
      if (!f) return null;
      const T = (s.ring_temperatures || [])[i];
      const T_use = (typeof T === 'number') ? T : 25;
      const si = sulfateSaturationIndex(mineralId, f, T_use);
      return isFinite(si) ? si : _SI_CHIP_FLOOR;
    };
    params.push({
      id: 'SI_selenite', label: 'SI sel', fullName: _HELIX_FULL_NAMES.SI_selenite,
      min: -8, max: 8, color: 0xE8DDB5,
      system: 'sulfate', units: 'log Ω',
      read: _readSulfateSI('selenite'),
    });
    params.push({
      id: 'SI_anhydrite', label: 'SI anh', fullName: _HELIX_FULL_NAMES.SI_anhydrite,
      min: -8, max: 8, color: 0xC9B98E,
      system: 'sulfate', units: 'log Ω',
      read: _readSulfateSI('anhydrite'),
    });
    params.push({
      id: 'SI_barite', label: 'SI bar', fullName: _HELIX_FULL_NAMES.SI_barite,
      min: -8, max: 8, color: 0xB8B0A8,
      system: 'sulfate', units: 'log Ω',
      read: _readSulfateSI('barite'),
    });
    params.push({
      id: 'SI_celestine', label: 'SI cel', fullName: _HELIX_FULL_NAMES.SI_celestine,
      min: -8, max: 8, color: 0x9EC5D9,
      system: 'sulfate', units: 'log Ω',
      read: _readSulfateSI('celestine'),
    });
  }

  // Ions — id, min, max. Ranges cover the value envelope each ion actually
  // reaches ACROSS all scenarios (measured by tools/strip-chip-envelope.mjs),
  // because vug fluids span dilute meteoric water to evaporite/hydrothermal
  // brine. Sized to observed-max + headroom; the prior MVT-seed-42-only ranges
  // clamped 42/58 chips (Cl to 36×, Na 53×, etc.) — "follow the science of
  // what vugs actually do."
  const ION_DEFS: Array<[string, number, number]> = [
    // Majors — brine-scale (evaporite / hydrothermal)
    ['SiO2', 0, 15000], ['Ca', 0, 4500], ['CO3', 0, 4500], ['Cl', 0, 20000],
    ['Na', 0, 12000],   ['Mg', 0, 4000], ['K', 0, 500],    ['S', 0, 3000], ['F', 0, 100],
    // Common metals
    ['Fe', 0, 400],   ['Mn', 0, 200], ['Zn', 0, 300],  ['Pb', 0, 200], ['Cu', 0, 400],
    // Common others
    ['Ba', 0, 200],   ['Sr', 0, 80],  ['Al', 0, 200],  ['P', 0, 50],   ['As', 0, 80],
    // Trace
    ['Ti', 0, 30],    ['U', 0, 200],  ['Mo', 0, 100],  ['Cr', 0, 20],  ['V', 0, 20],
    ['W', 0, 25],     ['Ag', 0, 50],  ['Bi', 0, 50],   ['Sb', 0, 30],  ['Ni', 0, 250],
    ['Co', 0, 100],   ['B', 0, 120],  ['Li', 0, 50],   ['Cd', 0, 10],  ['Y', 0, 10],
    // Ultra-trace
    ['Be', 0, 30],    ['Te', 0, 5],   ['Se', 0, 5],    ['Ge', 0, 10],  ['Au', 0, 5],
    ['Hg', 0, 20],    ['Sn', 0, 100],
  ];

  for (let i = 0; i < ION_DEFS.length; i++) {
    const [ionId, mn, mx] = ION_DEFS[i];
    const hue = i / ION_DEFS.length;          // even hue spread
    const color = _hexFromHSL(hue, 0.7, 0.55);
    // v24: fall back to the symbol if the lookup is missing — keeps
    // the legend from breaking if a future ion is added to ION_DEFS
    // but not to _HELIX_FULL_NAMES.
    const fullName = _HELIX_FULL_NAMES[ionId] || ionId;
    params.push({
      id: ionId, label: ionId, fullName, min: mn, max: mx, color,
      system: 'ion', units: 'ppm',
      read: (s: any, w: any, ri: number, c: number) =>
        (_chipFluid(s, w, ri, c) || {})[ionId],
    });
  }

  return params;
})();

const _HELIX_FADE_ANGLE = Math.PI / 2;   // 1/4 turn — boss spec
const _HELIX_SAMPLE_STEP = Math.PI / 90;  // sample every 2° of sweep

// =========== HISTORICAL READ (helix v15) ==============================
// Boss decision: helicoid sweep doubles as a scenario-time replay
// — one full revolution at 40 RPM (1.5 s) cycles the whole scenario
// from step 0 to last step. The per-ring chemistry + temperature
// snaps captured into wall_state_history (see 85c) feed the trail
// samples, so consecutive samples that span a snap boundary carry a
// real Δr. That signal is what the rate band needs to light up;
// without history, Δr stayed at 0 because the trail re-sampled the
// same frozen post-sim state every frame.

// Map current sweep angle → wall_state_history index. Wraps each
// revolution so the playback loops. Returns null when no history
// exists (creative mode mid-edit, or pre-sim), letting the live-sim
// fallback path keep working.
function _helixSnapAt(sim: any, sweep: number): any {
  const history = sim && sim.wall_state_history;
  if (!history || !history.length) return null;
  const TWO_PI = Math.PI * 2;
  const wrapped = ((sweep % TWO_PI) + TWO_PI) % TWO_PI;
  let idx = Math.floor((wrapped / TWO_PI) * history.length);
  if (idx < 0) idx = 0;
  if (idx >= history.length) idx = history.length - 1;
  return history[idx];
}

// Build a tiny sim-shaped proxy whose ring_fluids + ring_temperatures
// come from the snap. The existing param.read functions only touch
// these two arrays on sim, so a thin shim is enough — no need to
// rewrite every read.
function _helixSimAtSnap(sim: any, snap: any): any {
  if (!snap) return sim;
  if (!snap.ring_fluids && !snap.ring_temperatures) return sim;
  return {
    ring_fluids: snap.ring_fluids || sim.ring_fluids,
    ring_temperatures: snap.ring_temperatures || sim.ring_temperatures,
    // Week 3 — expose _dol_cycle_count so the f_ord chip can read
    // it from the snap (not the live conditions). Replay-correct.
    _dol_cycle_count: (snap._dol_cycle_count != null)
      ? snap._dol_cycle_count
      : (sim && sim.conditions ? sim.conditions._dol_cycle_count : 0),
  };
}

// Same idea for wall: the wall primary reads cell.base_radius_mm +
// cell.wall_depth, which the snap rings already carry (see 85c snap
// schema). Returns a thin proxy that keeps ring_count + cells_per_ring
// from the live wall (sim-invariant) but routes ring lookups through
// the snap, so the wall trail itself rewinds with scenario time.
function _helixWallAtSnap(wall: any, snap: any): any {
  if (!snap || !snap.rings) return wall;
  // ringTwistRadians and polarProfileFactor are WallState methods —
  // they read `this.twist_amplitudes`, `this.polar_amplitudes`, etc.
  // The plain-object proxy rebinds `this`, so without explicit
  // binding the methods throw on undefined .length. v15 included
  // these unbound (latent bug: nothing inside the helix called them
  // through the proxy at the time); v17's wall read now invokes
  // polarProfileFactor and surfaced it.
  return {
    rings: snap.rings,
    ring_count: wall && wall.ring_count,
    cells_per_ring: wall && wall.cells_per_ring,
    ringTwistRadians: wall && wall.ringTwistRadians ? wall.ringTwistRadians.bind(wall) : undefined,
    polarProfileFactor: wall && wall.polarProfileFactor ? wall.polarProfileFactor.bind(wall) : undefined,
    max_seen_radius_mm: wall && wall.max_seen_radius_mm,
    vug_diameter_mm: wall && wall.vug_diameter_mm,
  };
}

const _HELIX_RATE_BAND_RADIUS_FRACTION = 0.95;  // outer edge of band
const _HELIX_RATE_BAND_MIN_NORM = 0.04;          // below this, rate is hidden

// =========== LEGEND ====================================================
// Boss v12 ask: side legend, hover-to-identify, show-only-active, and
// highlight-movers — and the legend rows toggle individual params on
// and off. The toggle is the foundation; the focus modes (active /
// movers / hover) layer on top later. This block handles legend build
// + enable-array + click-toggle + bulk all/none.

let _helixLegendBuilt = false;

function _helixHexFromColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function _helixBuildLegend() {
  const panel = document.getElementById('helix-legend');
  if (!panel) return;
  if (_helixParamEnabled.length !== _HELIX_CHEM_PARAMS.length) {
    _helixParamEnabled = _HELIX_CHEM_PARAMS.map(() => true);
  }
  // Section boundaries inside _HELIX_CHEM_PARAMS (matches the IIFE
  // build order: 1 primary, 6 specials (v161 added `concentration`),
  // 11 carbonate-system (Week 3), 4 sulfate-system (v165), then 41
  // ions = 63 total).
  const sections: Array<{ title: string, start: number, end: number }> = [
    { title: 'Wall',            start: 0,  end: 1 },
    { title: 'Conditions',      start: 1,  end: 7 },
    { title: 'Carbonate System', start: 7,  end: 18 },
    { title: 'Sulfate System',  start: 18, end: 22 },
    { title: 'Ions',            start: 22, end: _HELIX_CHEM_PARAMS.length },
  ];

  // v22: banner layout. Header at top (title + bulk + focus pills in
  // one row), sections stacked below as horizontal chip-clouds with
  // the section label fixed on the left and the chips wrapping to
  // multiple rows as needed.
  const activeOn = _helixActiveOnlyMode ? ' is-on' : '';
  const moversOn = _helixMoversMode ? ' is-on' : '';
  const html: string[] = [];
  html.push('<div class="helix-legend-header">'
    + '<div class="helix-legend-header-title">'
    +   '<span class="helix-legend-title-main">Helicoid Manifold</span>'
    +   '<span class="helix-legend-title-sub">for multidimensional space</span>'
    + '</div>'
    + '<div class="helix-legend-header-actions">'
    +   `<button class="legend-mode${activeOn}" data-helix-mode="active" `
    +     `title="Hide params whose values stay near zero. Trace ions only appear when they have signal.">active only</button>`
    +   `<button class="legend-mode${moversOn}" data-helix-mode="movers" `
    +     `title="Dim flat params; brighten fast-changing ones. Layered on top of the value-trail.">movers</button>`
    +   '<button class="legend-bulk" data-helix-bulk="all"  title="Show all params">all</button>'
    +   '<button class="legend-bulk" data-helix-bulk="none" title="Hide all params">none</button>'
    + '</div></div>');
  for (const sec of sections) {
    html.push(`<div class="helix-legend-section-wrap">`);
    html.push(`<span class="helix-legend-section">${sec.title}</span>`);
    for (let i = sec.start; i < sec.end; i++) {
      const p = _HELIX_CHEM_PARAMS[i];
      const swatch = _helixHexFromColor(p.color);
      const off = _helixParamEnabled[i] ? '' : ' is-off';
      // v24: tooltip is the full chemical name (e.g. "Carbonate
      // (CO₃²⁻)") so hover expands the chip's abbreviation. Chip
      // text stays the symbol. Boss feedback: "it would be more
      // informative if you wrote out the full name of the Ion
      // instead of just having the abbreviation again in the hover."
      // HTML-attribute-escape the name in case any later addition
      // contains a quote.
      const tip = (p.fullName || p.label).replace(/"/g, '&quot;');
      html.push(
        `<div class="helix-legend-row${off}" data-helix-idx="${i}" title="${tip}">`
        + `<span class="helix-legend-swatch" style="background:${swatch}"></span>`
        + `<span class="helix-legend-label">${p.label}</span>`
        + '</div>'
      );
    }
    html.push(`</div>`);
  }
  panel.innerHTML = html.join('');

  panel.addEventListener('click', _helixLegendClickHandler);
  // v16 hover-to-identify: pointerover/out delegated on the panel.
  // pointer* fires for touch + mouse + pen; mouseover would miss
  // touch. The handler isolates one param's trails when the cursor
  // sits on its row, and clears on leave.
  panel.addEventListener('pointerover', _helixLegendPointerOver);
  panel.addEventListener('pointerout', _helixLegendPointerOut);
  _helixLegendBuilt = true;
}

function _helixLegendClickHandler(ev: Event) {
  const t = ev.target as HTMLElement | null;
  if (!t) return;
  // Bulk all/none buttons short-circuit before per-row handling.
  const bulkBtn = t.closest('[data-helix-bulk]') as HTMLElement | null;
  if (bulkBtn) {
    const mode = bulkBtn.getAttribute('data-helix-bulk');
    const val = mode === 'all';
    for (let i = 0; i < _helixParamEnabled.length; i++) _helixParamEnabled[i] = val;
    _helixRefreshLegendRows();
    return;
  }
  // v16 mode-toggle buttons.
  const modeBtn = t.closest('[data-helix-mode]') as HTMLElement | null;
  if (modeBtn) {
    const mode = modeBtn.getAttribute('data-helix-mode');
    if (mode === 'active') {
      _helixActiveOnlyMode = !_helixActiveOnlyMode;
      modeBtn.classList.toggle('is-on', _helixActiveOnlyMode);
    } else if (mode === 'movers') {
      _helixMoversMode = !_helixMoversMode;
      modeBtn.classList.toggle('is-on', _helixMoversMode);
    }
    return;
  }
  const row = t.closest('[data-helix-idx]') as HTMLElement | null;
  if (!row) return;
  const idx = parseInt(row.getAttribute('data-helix-idx') || '-1', 10);
  if (idx < 0 || idx >= _helixParamEnabled.length) return;
  _helixParamEnabled[idx] = !_helixParamEnabled[idx];
  row.classList.toggle('is-off', !_helixParamEnabled[idx]);
}

function _helixLegendPointerOver(ev: any) {
  const row = ev.target && ev.target.closest && ev.target.closest('[data-helix-idx]');
  if (!row) return;
  const idx = parseInt(row.getAttribute('data-helix-idx') || '-1', 10);
  if (idx < 0) return;
  _helixHoveredParam = idx;
  row.classList.add('is-hover');
}

function _helixLegendPointerOut(ev: any) {
  const row = ev.target && ev.target.closest && ev.target.closest('[data-helix-idx]');
  if (!row) return;
  // pointerout fires on entering a child element too; only clear when
  // the relatedTarget isn't still inside the row.
  if (ev.relatedTarget && row.contains(ev.relatedTarget)) return;
  const idx = parseInt(row.getAttribute('data-helix-idx') || '-1', 10);
  if (_helixHoveredParam === idx) _helixHoveredParam = null;
  row.classList.remove('is-hover');
}

function _helixRefreshLegendRows() {
  const panel = document.getElementById('helix-legend');
  if (!panel) return;
  const rows = panel.querySelectorAll('[data-helix-idx]');
  rows.forEach(r => {
    const idx = parseInt(r.getAttribute('data-helix-idx') || '-1', 10);
    if (idx < 0) return;
    (r as HTMLElement).classList.toggle('is-off', !_helixParamEnabled[idx]);
  });
}

function _helixSyncLegendVisibility() {
  const panel = document.getElementById('helix-legend');
  if (panel) panel.style.display = _helixOverlayEnabled ? 'block' : 'none';
  // Keep the toolbar button colour in sync — overlay defaults to
  // DISABLED on load (merge-prep: normal 3D model is the default view),
  // so the button starts uncoloured and the legend stays hidden until
  // the user opts into the helicoid via ⌇. Setting here covers both the
  // initial render and the toggle callback path.
  const btn = document.getElementById('helix-overlay-btn');
  if (btn) (btn as HTMLElement).style.color = _helixOverlayEnabled ? '#f0c050' : '';
}

function _helixDisposeGroup(g: any) {
  if (!g) return;
  g.traverse((obj: any) => {
    if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose && m.dispose());
      else if (obj.material.dispose) obj.material.dispose();
    }
  });
}

// Helicoid geometry derived from the cavity mesh. R = cavity equatorial
// wall radius (used for value normalization). yMin/yMax = actual
// vertical extent of the cavity from its mesh bounding box — NOT
// assumed from wallRadius, because scenarios with polar_collapse,
// elongation, asymmetric architecture, etc. can put the cavity's true
// top/bottom far inside ±wallRadius. The v8 bug: rings were stacked
// from -wallRadius to +wallRadius which floated trails clear off both
// ends of an oblate or collapsed cavity. ySpan is computed from
// yMax−yMin so the helicoid and the rings track the actual cavity.
function _helixGeometry(state: any, wall: any): {
  R: number, wallRadius: number, yMin: number, yMax: number, ySpan: number,
} {
  // R = the cavity's true equatorial radius. Used both as the helicoid
  // surface's equatorial extent AND as the normalization scale for
  // chemistry trails ([0, R] in lateral mm). For the two meshes (vugg
  // cavity + helicoid) to share scale — so the wall trail lands at
  // the cavity wall where the meshes intersect — R MUST be the cavity
  // radius, not larger.
  //
  // Pre-fix this read wall.max_seen_radius_mm directly, which is
  // deliberately 2× the actual largest cell base_radius_mm (see
  // 22-geometry-wall.ts line 612: "Starts generously (2× the largest
  // base radius...) so the view doesn't zoom in on enlargement").
  // That's a CAMERA-MARGIN value, not a cavity-radius value. Using
  // it made the helicoid 2× wider than the cavity it lived inside —
  // the surface and the chemistry trails extended out to ~2× the
  // wall, while the wall trail (always computed as radius·sin(phi)
  // from actual cell radii) stayed at the true wall position. Result:
  // the wall trail looked tiny + "twisted" inside a much-too-big
  // helicoid envelope. Boss flagged: "the mesh vugg and the layered
  // ring vugg should all be the same scale."
  //
  // Preferred source: the cavity mesh's per-ring max radii
  // (wall.maxRadiusByRing, populated by 23-geometry-wall-mesh.ts).
  // Take the maximum across rings to get the equatorial radius for
  // any cavity shape (sphere, ovate, basin, multi-bubble pocket).
  // Fallback: vug_diameter_mm / 2 if the mesh hasn't been built yet.
  let R: number;
  if (wall && wall.maxRadiusByRing && wall.maxRadiusByRing.length > 0) {
    R = 0;
    for (let i = 0; i < wall.maxRadiusByRing.length; i++) {
      const r = wall.maxRadiusByRing[i];
      if (r > R) R = r;
    }
    if (R <= 0) R = wall.vug_diameter_mm ? wall.vug_diameter_mm * 0.5 : 25;
  } else if (wall && wall.vug_diameter_mm) {
    R = wall.vug_diameter_mm * 0.5;
  } else {
    R = 25;
  }
  const wallRadius = R;

  // Pull actual Y extent from the cavity mesh's bounding box. Falls
  // back to centred ±R if the cavity geometry isn't built yet.
  let yMin = -R, yMax = R;
  const geom = state && state.cavity && state.cavity.geometry;
  if (geom) {
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb && isFinite(bb.min.y) && isFinite(bb.max.y) && bb.max.y > bb.min.y) {
      yMin = bb.min.y;
      yMax = bb.max.y;
    }
  }
  const ySpan = yMax - yMin;
  return { R, wallRadius, yMin, yMax, ySpan };
}

// Ring index → world Y, using the cavity's actual yMin/yMax (not
// assumed ±wallRadius). Mirrors the cavity mesh's spherical phi_cav
// distribution centred on the cavity's actual midpoint.
function _helixRingY(ringIndex: number, ringCount: number, yMin: number, yMax: number): number {
  const phiCav = Math.PI * (ringIndex + 0.5) / ringCount;
  const yCenter = (yMin + yMax) * 0.5;
  const yHalf = (yMax - yMin) * 0.5;
  return yCenter - yHalf * Math.cos(phiCav);
}

// Per-ring angular offset on the helicoid surface — the local θ
// where the spiral passes through that ring's Y. The spiral's
// parametric Y is yCenter + (u − 0.5) · ySpan with u = θ_local/(2π·N),
// so:
//
//   u = (y − yCenter) / ySpan + 0.5
//   θ_local = u · 2π · N
//
// Adding sweep_global to this gives the world angle of that ring's
// leading-edge dot at the current moment.
function _helixComputeRingOffsets(ringCount: number, yMin: number, yMax: number): number[] {
  const ySpan = yMax - yMin;
  const yCenter = (yMin + yMax) * 0.5;
  const out: number[] = [];
  for (let i = 0; i < ringCount; i++) {
    const y = _helixRingY(i, ringCount, yMin, yMax);
    const u = (y - yCenter) / ySpan + 0.5;
    const theta = u * 2 * Math.PI * _HELIX_N_TURNS;
    out.push(theta);
  }
  return out;
}

// ----- Main entry — called by _topoRenderThree once per frame -----

function _topoHelixOverlayDraw(state: any, sim: any, wall: any) {
  if (!state) return;
  if (!_helixLegendBuilt) _helixBuildLegend();
  _helixSyncLegendVisibility();
  if (!_helixOverlayEnabled) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
      state.helixGroup = null;
      state.helixSig = '';
    }
    if (_helixTrailGroup) {
      state.scene.remove(_helixTrailGroup);
      _helixDisposeGroup(_helixTrailGroup);
      _helixTrailGroup = null;
      _helixTrails = [];
      _helixTrailLines.length = 0;
    }
    if (_helixEventsLine) {
      state.scene.remove(_helixEventsLine);
      if (_helixEventsLine.geometry && _helixEventsLine.geometry.dispose) _helixEventsLine.geometry.dispose();
      if (_helixEventsLine.material && _helixEventsLine.material.dispose) _helixEventsLine.material.dispose();
      _helixEventsLine = null;
      _helixEvents = [];
      _helixEventsSig = '';
    }
    state.helixContext = null;
    // Restore the cavity + crystal meshes hidden while the overlay
    // was running — leaving them invisible after toggle-off would
    // leave the topo view empty.
    if (state.cavity) state.cavity.visible = true;
    if (state.crystals) state.crystals.visible = true;
    _helixRestoreCrystalOpacity(state);
    return;
  }
  if (!sim || !wall || !wall.ring_count) return;

  // Boss v10: "no visible 3d vug, the only indication of the vugg
  // shape is the reading at the wall of the vugg where it intersects
  // with the helicoid at that moment in time." Hide the cavity mesh
  // — the white primary wall-distance trail (per-cell, fading 1/4
  // turn behind the sweep) reveals the cavity shape from radar
  // returns alone.
  //
  // v13: crystals stay in the scene but the helix update writes their
  // material opacity from the sweep age (see
  // _helixUpdateCrystalVisibility). Replaces v10's blanket
  // crystals.visible=false. Boss: "crystals only spawn visually as
  // the sweep passes — materialize for ~1/4 turn after the sweep
  // passes and fade."
  if (state.cavity) state.cavity.visible = false;
  if (state.crystals) state.crystals.visible = true;

  const { R, wallRadius, yMin, yMax, ySpan } = _helixGeometry(state, wall);
  const ringCount = wall.ring_count;

  const sig = `${R.toFixed(2)}|${yMin.toFixed(2)}|${yMax.toFixed(2)}|${ringCount}`;
  const sigChanged = state.helixSig !== sig;
  // v20: new sim → reset sweep to 0 so playback begins from step 0.
  // Detect via sim reference (fresh Simulator on each runSimulation())
  // OR via cavity-geometry sig change (handles scenarios with same
  // sim object but rebuilt walls). Without the reset, the helicoid
  // would resume from wherever it was, mid-revolution, on a new
  // scenario — confusing because the "now cursor" wouldn't be at the
  // scenario start.
  const simChanged = !state.helixContext || state.helixContext.sim !== sim;
  if (sigChanged || simChanged) {
    _helixSweepAngle = 0;
    // v21: also reset playback time so a fresh sim starts at step 0.
    _helixCurrentTimeStep = 0;
    _helixDisplayedStep = 0;
  }

  if (sigChanged) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
    }
    const group = new THREE.Group();
    group.name = 'helix-record';
    _helixAddSurface(group, R, yMin, yMax, wall);
    state.scene.add(group);
    state.helixGroup = group;
    state.helixSig = sig;
    _helixClearTrails();
  }

  _helixEnsureTrailInfra(state.scene, ringCount, _HELIX_CHEM_PARAMS.length);

  const ringOffsets = _helixComputeRingOffsets(ringCount, yMin, yMax);
  state.helixContext = { sim, wall, R, wallRadius, yMin, yMax, ySpan, ringCount, ringOffsets };
  _helixStartSpin();
}

// ----- Sub-builders ------------------------------------------------

// Returns the cavity's lateral extent (perpendicular to the vertical
// axis) at world-y. The helicoid surface uses this so its lateral
// width tracks the actual cavity wall instead of being a constant
// cylinder. Two paths:
//
//   1. wall.maxRadiusByRing is populated (built by 23-geometry-wall-
//      mesh.ts during the cavity mesh build). Use it: interpolate by
//      mapping y → ring index via the cavity's polar-angle convention,
//      then take wall.maxRadiusByRing[ring] * sin(phi_cav). Handles
//      non-spherical archetypes (basin polar-collapse, multi-bubble
//      pocket lobes, tabular elongation) correctly.
//
//   2. Fallback: ellipsoid approximation. R * sqrt(1 - ((y-yC)/yH)²).
//      Correct for sphere; reasonable first-order for ovate cavities.
//      Used pre-mesh-build or when maxRadiusByRing isn't set.
//
// Pre-fix the helicoid surface was a CYLINDER (constant max radius R
// for every y), which didn't fit the cavity at the polar caps — the
// surface visibly stuck out past the actual cavity shape near top and
// bottom, and at oblique viewing angles read as a stretched/figure-8
// silhouette instead of matching the egg-shaped cavity. Boss flagged
// the wall-shape mismatch via screenshots showing the surface at 195%
// zoom didn't match the cavity outline at 100%.
function _helixLateralAtY(wall: any, y: number, yMin: number, yMax: number, R: number): number {
  const yCenter = (yMin + yMax) * 0.5;
  const yHalf = (yMax - yMin) * 0.5;
  if (yHalf <= 0) return R;

  // Path 1: use actual ring radii when available.
  if (wall && wall.maxRadiusByRing && wall.ring_count > 0) {
    const ringCount = wall.ring_count;
    // y = yCenter - yHalf * cos(phi_cav)  (see 23-geometry-wall-mesh.ts
    // line 538). Invert for phi_cav:
    const arg = Math.max(-1, Math.min(1, (yCenter - y) / yHalf));
    const phiCav = Math.acos(arg);
    // ring i: phi_cav_i = π * (i + 0.5) / ringCount  (see 22-geometry-
    // wall.ts line 724). Invert for i:
    const ringFrac = phiCav * ringCount / Math.PI - 0.5;
    const iLo = Math.max(0, Math.min(ringCount - 1, Math.floor(ringFrac)));
    const iHi = Math.max(0, Math.min(ringCount - 1, iLo + 1));
    const t = Math.max(0, Math.min(1, ringFrac - iLo));
    const sinPhi = Math.sin(phiCav);
    const rLo = wall.maxRadiusByRing[iLo] || R;
    const rHi = wall.maxRadiusByRing[iHi] || R;
    const rLocal = rLo * (1 - t) + rHi * t;
    return rLocal * sinPhi;
  }

  // Path 2: ellipsoid fallback.
  const yNorm = (y - yCenter) / yHalf;
  const cylindrical = 1 - yNorm * yNorm;
  return cylindrical > 0 ? R * Math.sqrt(cylindrical) : 0;
}

function _helixAddSurface(group: any, R: number, yMin: number, yMax: number, wall: any) {
  const NU = 16;
  const NV = Math.max(120, _HELIX_N_TURNS * 120);
  const ySpan = yMax - yMin;
  const yCenter = (yMin + yMax) * 0.5;
  const surfPositions = new Float32Array((NU + 1) * (NV + 1) * 3);
  const surfIndices: number[] = [];
  // Loops swapped from the pre-fix order: j (height) is outer so the
  // per-height lateral extent R_at_y can be computed once per height
  // rather than per (i, j) vertex.
  for (let j = 0; j <= NV; j++) {
    const u = j / NV;
    const phi = u * _HELIX_N_TURNS * Math.PI * 2;
    const y = yCenter + (u - 0.5) * ySpan;
    const R_at_y = _helixLateralAtY(wall, y, yMin, yMax, R);
    for (let i = 0; i <= NU; i++) {
      const ri = (i / NU) * R_at_y;
      const vIdx = (i * (NV + 1) + j) * 3;
      surfPositions[vIdx + 0] = ri * Math.cos(phi);
      surfPositions[vIdx + 1] = y;
      surfPositions[vIdx + 2] = ri * Math.sin(phi);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (NV + 1) + j;
      const d = c + 1;
      surfIndices.push(a, c, b, b, c, d);
    }
  }
  const surfGeom = new THREE.BufferGeometry();
  surfGeom.setAttribute('position', new THREE.BufferAttribute(surfPositions, 3));
  surfGeom.setIndex(surfIndices);
  surfGeom.computeVertexNormals();
  const surfMat = new THREE.MeshBasicMaterial({
    color: 0xf0d5a0,
    transparent: true,
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(surfGeom, surfMat));
}

// =========== TRAIL STATE (per-ring radar trails) ========================
// Nested [paramIdx][ringIdx] — each ring has its own trail per param.
// Each ring's leading-edge dot sits at world_angle = sweep + θ_offset[ring]
// so the 16 leading dots per parameter sit along the helicoid spiral.

let _helixTrails: Array<Array<Array<{ sweep: number, r: number }>>> = [];
let _helixTrailGroup: any = null;
const _helixTrailLines: any[] = [];

// 16 rings × ~45 past samples × 2 verts per segment = 1440 verts per
// secondary param. PRIMARY also renders 45 future segments: 16 × (45
// past + 45 future) × 2 = 2880 verts. v15 layers a dashed rate-band
// on secondaries: ~720 more verts. 6144 budget gives ~30% headroom on
// primary and ~20% on rate-bearing secondaries.
const _TRAIL_MAX_VERTS_PER_PARAM = 6144;

function _helixClearTrails() {
  for (let p = 0; p < _helixTrails.length; p++) {
    if (!_helixTrails[p]) continue;
    for (let i = 0; i < _helixTrails[p].length; i++) {
      _helixTrails[p][i] = [];
    }
  }
}

function _helixEnsureTrailInfra(scene: any, ringCount: number, nParams: number) {
  const sized = _helixTrailGroup
    && _helixTrails.length === nParams
    && _helixTrails[0] && _helixTrails[0].length === ringCount;
  if (sized) return;

  if (_helixTrailGroup) {
    scene.remove(_helixTrailGroup);
    _helixDisposeGroup(_helixTrailGroup);
  }
  _helixTrailGroup = new THREE.Group();
  _helixTrailGroup.name = 'helix-trails';
  scene.add(_helixTrailGroup);

  _helixTrails = [];
  _helixTrailLines.length = 0;

  for (let p = 0; p < nParams; p++) {
    _helixTrails[p] = [];
    for (let i = 0; i < ringCount; i++) _helixTrails[p][i] = [];

    const positions = new Float32Array(_TRAIL_MAX_VERTS_PER_PARAM * 3);
    const colors = new Float32Array(_TRAIL_MAX_VERTS_PER_PARAM * 4);
    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(colors, 4);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);
    geom.setAttribute('color', colAttr);
    geom.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geom, mat);
    _helixTrailGroup.add(lines);
    _helixTrailLines.push(lines);
  }
}

// Per-frame trail update. For each (param, ring), sample current
// chemistry, push a new {sweep, r} sample, prune old samples beyond
// the fade window, rewrite the LineSegments buffer with positions
// (computed as world_angle = sweep + ringOffset) and per-vertex alpha.
function _helixUpdateTrails(sim: any, wall: any, R: number, yMin: number, yMax: number, ringCount: number, ringOffsets: number[]) {
  if (!sim || !wall || !ringCount || !ringOffsets) return;
  const nParams = _HELIX_CHEM_PARAMS.length;
  if (!_helixTrailGroup || _helixTrails.length !== nParams) return;

  const sweep = _helixSweepAngle;
  const TWO_PI = Math.PI * 2;
  const sweepWrapped = ((sweep % TWO_PI) + TWO_PI) % TWO_PI;

  // v21: snap lookup now keyed on _helixDisplayedStep, not sweep
  // angle. Within one revolution, every sample sees the SAME snap
  // (one moment in time per rotation); the snap only changes when
  // time advances enough for the floor() to tick over. Pre-v21
  // used sweep angle directly, which spread one revolution across
  // many snaps and showed crystals at different growth stages
  // simultaneously around the helicoid — boss diagnosed this.
  const snap = _helixSnapAtStep(sim, _helixDisplayedStep);
  const histSim = _helixSimAtSnap(sim, snap);
  const histWall = _helixWallAtSnap(wall, snap);

  for (let p = 0; p < nParams; p++) {
    const param = _HELIX_CHEM_PARAMS[p];
    const lines = _helixTrailLines[p];
    if (!lines) continue;

    // Param toggled off in the legend — collapse its draw range and
    // skip sampling entirely. Trail history is preserved (re-enabling
    // resumes from existing samples on the next frame).
    if (!_helixParamEnabled[p]) {
      lines.geometry.setDrawRange(0, 0);
      continue;
    }

    const posArr = lines.geometry.attributes.position.array as Float32Array;
    const colArr = lines.geometry.attributes.color.array as Float32Array;
    const cr = ((param.color >> 16) & 0xff) / 255;
    const cg = ((param.color >> 8) & 0xff) / 255;
    const cb = (param.color & 0xff) / 255;

    // v16 PASS 1: sample values, update trail history, gather per-
    // param stats (max |r|, max |Δr|) used by the focus modes.
    // Per-ring context is stashed in ringCtx so pass 2 doesn't
    // re-read the snap or re-pick the cell.
    type RingCtx = { y: number, offset: number, N: number, ringArr: any } | null;
    const ringCtx: RingCtx[] = new Array(ringCount);
    let maxAbsP = 0;
    let maxDeltaP = 0;

    for (let i = 0; i < ringCount; i++) {
      const ringArr = (histWall.rings && histWall.rings[i]) || null;
      const N = ringArr && ringArr.length ? ringArr.length : 0;
      const cellIdx = N > 0 ? Math.floor(sweepWrapped / (TWO_PI / N)) % N : 0;

      const raw = param.read(histSim, histWall, i, cellIdx);
      if (typeof raw !== 'number' || isNaN(raw)) { ringCtx[i] = null; continue; }
      let r: number;
      if (param.primary) {
        r = raw;
      } else {
        const norm = Math.max(0, Math.min(1, (raw - param.min) / (param.max - param.min)));
        r = norm * R;
      }
      const trail = _helixTrails[p][i];
      const last = trail[trail.length - 1];
      if (!last || (sweep - last.sweep) > _HELIX_SAMPLE_STEP) {
        trail.push({ sweep, r });
      } else {
        last.r = r;
      }
      while (trail.length && (sweep - trail[0].sweep) > _HELIX_FADE_ANGLE) {
        trail.shift();
      }
      // Stats from the trail (handles the just-appended sample too).
      for (let k = 0; k < trail.length; k++) {
        const ar = Math.abs(trail[k].r);
        if (ar > maxAbsP) maxAbsP = ar;
        if (k > 0) {
          const dr = Math.abs(trail[k].r - trail[k - 1].r);
          if (dr > maxDeltaP) maxDeltaP = dr;
        }
      }
      ringCtx[i] = {
        y: _helixRingY(i, ringCount, yMin, yMax),
        offset: ringOffsets[i] || 0,
        N, ringArr,
      };
    }
    _helixParamMaxAbs[p] = maxAbsP;
    _helixParamMaxDelta[p] = maxDeltaP;

    // v16 focus-mode multiplier. Primary (wall) is always shown at
    // full alpha — it's the anchor that other readings hang on, and
    // hiding it would defeat the helicoid's shape-via-radar reading.
    let alphaMul = 1;
    if (!param.primary) {
      if (_helixActiveOnlyMode && maxAbsP < _HELIX_ACTIVE_MIN_R * R) {
        lines.geometry.setDrawRange(0, 0);
        continue;
      }
      if (_helixMoversMode) {
        const moverNorm = Math.max(0, Math.min(1, maxDeltaP / R));
        if (moverNorm < _HELIX_MOVER_MIN_DELTA) alphaMul = 0.15;
        else alphaMul = 0.30 + 0.70 * moverNorm;
      }
    }
    if (_helixHoveredParam != null && _helixHoveredParam !== p) {
      alphaMul *= 0.18;     // non-hovered fade
    }

    let v = 0;

    // v16 PASS 2: write past + rate + future verts using ringCtx.
    for (let i = 0; i < ringCount; i++) {
      const ctx = ringCtx[i];
      if (!ctx) continue;
      const { y, offset, N, ringArr } = ctx;
      const trail = _helixTrails[p][i];
      if (!trail || trail.length === 0) continue;
      const r = trail[trail.length - 1].r;

      // Build PAST segments for this ring's trail. Each segment
      // connects two consecutive samples in (world_angle = sweep +
      // offset, y) with per-vertex alpha = 1 − age/fade.
      for (let k = 0; k < trail.length - 1; k++) {
        if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
        const a = trail[k];
        const b = trail[k + 1];
        const ageA = (sweep - a.sweep) / _HELIX_FADE_ANGLE;
        const ageB = (sweep - b.sweep) / _HELIX_FADE_ANGLE;
        const aA = Math.max(0, 1 - ageA);
        const aB = Math.max(0, 1 - ageB);
        const angleA = a.sweep + offset;
        const angleB = b.sweep + offset;

        posArr[v * 3 + 0] = a.r * Math.cos(angleA);
        posArr[v * 3 + 1] = y;
        posArr[v * 3 + 2] = a.r * Math.sin(angleA);
        colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aA * alphaMul;
        v++;

        posArr[v * 3 + 0] = b.r * Math.cos(angleB);
        posArr[v * 3 + 1] = y;
        posArr[v * 3 + 2] = b.r * Math.sin(angleB);
        colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aB * alphaMul;
        v++;
      }

      // RATE BAND — v15. Secondary params only (wall is plotted at
      // literal mm and is the *primary* anchor; rate is layered on
      // top of the chemistry channels). For each pair of consecutive
      // trail samples that span a wall_state_history boundary, |Δr|
      // is non-zero — that's the signal. Plot at r = |Δr| in the
      // same normalized [0, R] space the main trail uses; render
      // every-other segment for a dashed look, 0.7× the main alpha
      // so it reads as a side channel.
      //
      // Use case: trace ions (U at 0-5 mg/L, Te at 0-5, Hg at 0-5)
      // have main trails hugging the axis even at a spike. A 1 mg/L
      // jump in U at scenario step k produces a band bump at
      // r = R·0.2 — visible far from the axis even though the
      // value-trail itself barely moves.
      if (!param.primary && trail.length >= 2) {
        const stride = 2;  // dashed: render pairs (0-1), (2-3), …
        const minR = _HELIX_RATE_BAND_MIN_NORM * R;
        for (let k = 0; k + 1 < trail.length; k += stride) {
          if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
          const a = trail[k];
          const b = trail[k + 1];
          const rateMag = Math.abs(b.r - a.r);
          if (rateMag < minR) continue;
          const rBand = Math.min(R * _HELIX_RATE_BAND_RADIUS_FRACTION, rateMag);

          const ageA = (sweep - a.sweep) / _HELIX_FADE_ANGLE;
          const ageB = (sweep - b.sweep) / _HELIX_FADE_ANGLE;
          const aA = Math.max(0, 1 - ageA) * 0.7;
          const aB = Math.max(0, 1 - ageB) * 0.7;
          const angleA = a.sweep + offset;
          const angleB = b.sweep + offset;

          posArr[v * 3 + 0] = rBand * Math.cos(angleA);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rBand * Math.sin(angleA);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aA * alphaMul;
          v++;

          posArr[v * 3 + 0] = rBand * Math.cos(angleB);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rBand * Math.sin(angleB);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aB * alphaMul;
          v++;
        }
      }

      // FUTURE segments — only for primary (wall). The wall is
      // static during a scenario, so we can sample it at angles ahead
      // of the current sweep and render them with the same alpha ramp
      // as the past. Boss v11: "the line that represents the vugg
      // wall distance should fade in both the past as well as the
      // future direction so it stands out a bit more visually. its a
      // known constant, so it makes sense that you could predict
      // where it will be relatively."
      if (param.primary && N > 0) {
        const futureSteps = Math.floor(_HELIX_FADE_ANGLE / _HELIX_SAMPLE_STEP);
        let rPrev = r;  // start from the current value at sweep
        for (let k = 0; k < futureSteps; k++) {
          if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
          const futureSweepA = sweep + k * _HELIX_SAMPLE_STEP;
          const futureSweepB = sweep + (k + 1) * _HELIX_SAMPLE_STEP;
          const angleA = futureSweepA + offset;
          const angleB = futureSweepB + offset;
          const futureAgeA = (k * _HELIX_SAMPLE_STEP) / _HELIX_FADE_ANGLE;
          const futureAgeB = ((k + 1) * _HELIX_SAMPLE_STEP) / _HELIX_FADE_ANGLE;
          const aFA = Math.max(0, 1 - futureAgeA);
          const aFB = Math.max(0, 1 - futureAgeB);

          // v21: future-fade samples the SAME snap as the present
          // (one moment per rotation). Pre-v21 sampled a future snap
          // to predict where the wall would be a quarter-turn from
          // now, but with time fixed during a rotation that's just
          // the current snap — and the wall reading at different
          // angles around the current snap. Effect: the future-fade
          // band still gradient-fades but plots the same wall geometry
          // the past band does, so the band is symmetric around the
          // leading edge for any given moment in time.
          const wrappedB = ((futureSweepB % TWO_PI) + TWO_PI) % TWO_PI;
          const cellB = Math.floor(wrappedB / (TWO_PI / N)) % N;
          const rawB = param.read(histSim, histWall, i, cellB);
          const rNext = (typeof rawB === 'number' && !isNaN(rawB)) ? rawB : rPrev;

          posArr[v * 3 + 0] = rPrev * Math.cos(angleA);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rPrev * Math.sin(angleA);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aFA * alphaMul;
          v++;

          posArr[v * 3 + 0] = rNext * Math.cos(angleB);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rNext * Math.sin(angleB);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aFB * alphaMul;
          v++;
          rPrev = rNext;
        }
      }
    }

    lines.geometry.setDrawRange(0, v);
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.attributes.color.needsUpdate = true;
  }
}

// =========== EVENT PINGS ==============================================
// Boss v12 ask: "Nucleation, growth-onset, dissolution, etc. fire
// bright radial flashes at the (ring, angle, ion) cell where they
// occurred. Trails decay; events are punctuation."
//
// Events are static markers at the cell where they happened — they
// peak in brightness when the leading edge passes their angle, fade
// to zero 1/4 turn behind, and stay invisible the rest of the
// revolution. Re-flash every revolution. Each event holds:
//   { ringIdx, cellIdx, kind, color }
// No time-of-occurrence is stored: events are positional markers
// the helicoid re-reads each turn, the same way the chemistry trails
// re-sample each turn.
//
// Event sources mined out of sim.crystals (where the engine code
// already records them):
//   nucleation   — one per crystal at crystal.wall_anchor
//   dissolution  — one per negative-thickness zone (engines push these
//                  with thickness_um < 0 at the step the dissolution
//                  fired; the cell is the crystal's own anchor)
// Growth-onset is intentionally NOT extracted here — every positive
// zone would fire one, which on a long sim drowns nucleation +
// dissolution in noise. Can be layered later behind a legend toggle
// if the boss wants it; current scope is the two unambiguous state-
// transitions.

type HelixEvent = {
  ringIdx: number,
  cellIdx: number,
  kind: 'nucleation' | 'dissolution',
  color: number,
};

const _HELIX_EVENT_RADIAL_HALF = 6;  // mm — half-length of the radial flash bar
let _helixEvents: HelixEvent[] = [];
let _helixEventsSig = '';
let _helixEventsLine: any = null;
const _HELIX_EVENTS_MAX_VERTS = 8192;  // 4096 events × 2 verts each — plenty

function _helixHarvestEvents(sim: any): HelixEvent[] {
  if (!sim || !sim.crystals) return [];
  const out: HelixEvent[] = [];
  for (const c of sim.crystals) {
    if (!c) continue;
    const anchor = c.wall_anchor;
    if (!anchor || anchor.ringIdx == null || anchor.cellIdx == null) continue;

    // Nucleation marker — one per crystal at its anchor.
    out.push({
      ringIdx: anchor.ringIdx,
      cellIdx: anchor.cellIdx,
      kind: 'nucleation',
      color: 0x55ff66,                   // green
    });

    // Dissolution markers — every negative-thickness zone is a
    // dissolution pulse the engine recorded. Different zones can
    // share the same cell; we keep all of them so the visual
    // intensity scales with how many dissolutions hit that cell.
    if (c.zones && c.zones.length) {
      for (const z of c.zones) {
        if (z && typeof z.thickness_um === 'number' && z.thickness_um < 0) {
          out.push({
            ringIdx: anchor.ringIdx,
            cellIdx: anchor.cellIdx,
            kind: 'dissolution',
            color: 0xff5566,               // red
          });
        }
      }
    }
  }
  return out;
}

function _helixEnsureEventsLine(scene: any) {
  if (_helixEventsLine) return;
  const positions = new Float32Array(_HELIX_EVENTS_MAX_VERTS * 3);
  const colors = new Float32Array(_HELIX_EVENTS_MAX_VERTS * 4);
  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 4);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', posAttr);
  geom.setAttribute('color', colAttr);
  geom.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    linewidth: 2,                     // honored on some platforms; cheap to set
  });
  _helixEventsLine = new THREE.LineSegments(geom, mat);
  _helixEventsLine.name = 'helix-events';
  _helixEventsLine.renderOrder = 2;    // draw above the chemistry trails
  scene.add(_helixEventsLine);
}

function _helixUpdateEvents(
  state: any, sim: any, wall: any, sweep: number,
  ringCount: number, ringOffsets: number[],
) {
  if (!state || !sim || !wall) return;
  _helixEnsureEventsLine(state.scene);

  // Re-harvest only when the sim's event-bearing state changed.
  // Cheap signature: crystal count + last crystal's zone count + last
  // crystal's id. Misses zero-crystal-count → zero-crystal-count
  // transitions but those don't produce events anyway.
  const nC = sim.crystals ? sim.crystals.length : 0;
  let sig = String(nC);
  if (nC > 0) {
    const last = sim.crystals[nC - 1];
    sig += '|' + (last && last.crystal_id || 0) + '|' + (last && last.zones ? last.zones.length : 0);
  }
  if (sig !== _helixEventsSig) {
    _helixEvents = _helixHarvestEvents(sim);
    _helixEventsSig = sig;
  }

  if (!_helixEvents.length) {
    _helixEventsLine.geometry.setDrawRange(0, 0);
    return;
  }

  const TWO_PI = Math.PI * 2;
  const posArr = _helixEventsLine.geometry.attributes.position.array as Float32Array;
  const colArr = _helixEventsLine.geometry.attributes.color.array as Float32Array;
  let v = 0;

  for (const ev of _helixEvents) {
    if (v + 2 > _HELIX_EVENTS_MAX_VERTS) break;
    const ringIdx = ev.ringIdx;
    if (ringIdx < 0 || ringIdx >= ringCount) continue;

    const ring = wall.rings && wall.rings[ringIdx];
    const N = ring && ring.length ? ring.length : 0;
    if (!N) continue;
    const cell = ring[ev.cellIdx % N];
    if (!cell) continue;

    const phi = Math.PI * (ringIdx + 0.5) / ringCount;
    const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0;
    const theta = (TWO_PI * ev.cellIdx) / N + twist;
    const offset = ringOffsets[ringIdx] || 0;

    let age = (sweep + offset - theta) % TWO_PI;
    if (age < 0) age += TWO_PI;
    if (age > _HELIX_FADE_ANGLE) continue;
    const alpha = 1 - age / _HELIX_FADE_ANGLE;

    const y = _helixRingY(ringIdx, ringCount, _topoThreeState ? _topoThreeState.helixContext.yMin : -25,
                          _topoThreeState ? _topoThreeState.helixContext.yMax : 25);
    const angleWorld = theta + offset;

    // Radial flash: short bar straddling the cell's lateral wall
    // distance (perpendicular from the cavity's vertical axis to
    // the wall). v17 fix: pre-v17 used radius-from-center, which on
    // a roughly spherical cavity made polar-ring events float past
    // the actual wall by a factor of (1 − sin(phi)). Now matches
    // _topoSyncCrystalMeshes' lateral placement (radius · sin(phi)).
    const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
    const radiusFromCenter = ((cell.base_radius_mm || 0) + (cell.wall_depth || 0)) * polar;
    const rWall = radiusFromCenter * Math.sin(phi);
    const rIn = Math.max(0, rWall - _HELIX_EVENT_RADIAL_HALF);
    const rOut = rWall + _HELIX_EVENT_RADIAL_HALF;

    const cr = ((ev.color >> 16) & 0xff) / 255;
    const cg = ((ev.color >> 8) & 0xff) / 255;
    const cb = (ev.color & 0xff) / 255;

    posArr[v * 3 + 0] = rIn * Math.cos(angleWorld);
    posArr[v * 3 + 1] = y;
    posArr[v * 3 + 2] = rIn * Math.sin(angleWorld);
    colArr[v * 4 + 0] = cr;
    colArr[v * 4 + 1] = cg;
    colArr[v * 4 + 2] = cb;
    colArr[v * 4 + 3] = alpha;
    v++;

    posArr[v * 3 + 0] = rOut * Math.cos(angleWorld);
    posArr[v * 3 + 1] = y;
    posArr[v * 3 + 2] = rOut * Math.sin(angleWorld);
    colArr[v * 4 + 0] = cr;
    colArr[v * 4 + 1] = cg;
    colArr[v * 4 + 2] = cb;
    colArr[v * 4 + 3] = alpha;
    v++;
  }

  _helixEventsLine.geometry.setDrawRange(0, v);
  _helixEventsLine.geometry.attributes.position.needsUpdate = true;
  _helixEventsLine.geometry.attributes.color.needsUpdate = true;
}

// =========== SWEEP-WRITES-CRYSTALS ====================================
// Boss v12 ask: crystals should "spawn visually as the sweep passes —
// crystal meshes are invisible except in the leading-edge slice;
// materialize for ~1/4 turn after the sweep passes and fade. The
// helicoid 'writes' them into view." Replaces v10's blanket
// state.crystals.visible = false. Boss v18: "the crystals should
// fade in and out like the vugg wall" — same symmetric ramp the
// wall trail uses (zero at −π/2 past, full at sweep moment, zero at
// +π/2 future).
//
// Per (parent) crystal mesh, we know its anchor (ringIdx, cellIdx)
// from mesh.userData. The world angle of the leading edge at that
// ring is sweep + ringOffsets[ringIdx]. The crystal's local theta is
// (2π·cellIdx / N) + ringTwist(phi). The "age" relative to sweep =
// (sweep + offset − theta), folded to (−π, π]: negative = future
// (sweep hasn't reached the crystal yet, fading in), positive = past
// (sweep has moved past, fading out). Visible window:
// |age| ≤ π/2 → opacity = naturalOpacity · (1 − |age|/(π/2)).
//
// Satellites share the parent's material reference, so iterating
// parents-only is enough: writing parent.material.opacity moves the
// satellites too. Iterating satellites separately would re-write the
// same material with a slightly different cellIdx-derived theta (the
// satellite's offset around the cluster), causing flicker.

function _helixUpdateCrystalVisibility(
  state: any, sweep: number, wall: any, ringCount: number, ringOffsets: number[],
) {
  if (!state || !state.crystals) return;
  // v19: per-fragment "helix skin" replaces the v18 per-mesh opacity
  // loop. The skin shader (see _applyCavityClip in
  // 99i-renderer-three.ts) computes age per fragment using the
  // fragment's own world-y → helicoid u-fraction → leading-edge
  // angle. So a tall crystal that spans several ring heights gets
  // revealed segment-by-segment as the spiral leading edge crosses
  // each Y at a different sweep moment, instead of the whole mesh
  // fading uniformly. Boss caught this watching v18: "the whole
  // crystal fades in and out at the same time instead of the fade
  // matching the sweep of the helicoid."
  //
  // The per-frame work here is now just three things:
  //   1. Push the current sweep into uHelixSweep.
  //   2. Ensure crystal materials are flagged transparent so the
  //      shader's alpha multiply has an effect (perimorphs already
  //      are; ordinary crystals are flipped here on first overlay
  //      render).
  //   3. Make sure the parent mesh is visible (the shader does its
  //      own per-fragment discard outside the fade window, so the
  //      mesh stays visible to the renderer and the shader decides
  //      what to keep).
  // The wall + ringOffsets arguments are kept for signature
  // compatibility with v18's caller but are no longer used here —
  // they live entirely in the shader's u-fraction math now.

  const clipU = state.clipUniforms;
  if (clipU) {
    clipU.uHelixEnabled.value = 1;
    clipU.uHelixSweep.value = sweep;
    // yCenter, ySpan, NTurns, Fade are pushed once at context init
    // (see _helixSyncSkinGeometry); refreshing here too is cheap and
    // keeps the shader in sync if the cavity geometry was rebuilt
    // mid-overlay (signature change in _topoHelixOverlayDraw).
    if (state.helixContext) {
      const ctx = state.helixContext;
      clipU.uHelixYCenter.value = (ctx.yMin + ctx.yMax) * 0.5;
      clipU.uHelixYSpan.value = (ctx.yMax - ctx.yMin) || 1;
      clipU.uHelixNTurns.value = _HELIX_N_TURNS;
      clipU.uHelixFade.value = _HELIX_FADE_ANGLE;
    }
  }

  const children = state.crystals.children;
  if (!children || !children.length) return;
  for (let i = 0; i < children.length; i++) {
    const mesh = children[i];
    const u = mesh && mesh.userData;
    if (!u || u.isSatellite) continue;          // parents drive shared material
    const natural = (typeof u.naturalOpacity === 'number') ? u.naturalOpacity : 1.0;
    const mat = mesh.material;
    if (mat) {
      mat.transparent = true;             // shader alpha multiply requires this
      mat.opacity = natural;              // skin shader scales this down
      mat.depthWrite = natural >= 1.0;    // perimorphs stay back-face-friendly
    }
    mesh.visible = true;
  }
}

// Restore crystal materials to their natural opacity. Called when the
// overlay is turned off so the user gets the usual solid-crystal view
// back without leftover transparency. v19: also disables the skin
// shader uniform so the per-fragment alpha multiply short-circuits.
function _helixRestoreCrystalOpacity(state: any) {
  if (!state) return;
  if (state.clipUniforms && state.clipUniforms.uHelixEnabled) {
    state.clipUniforms.uHelixEnabled.value = 0;
  }
  if (!state.crystals) return;
  const children = state.crystals.children;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const mesh = children[i];
    const u = mesh && mesh.userData;
    if (!u) continue;
    const natural = (typeof u.naturalOpacity === 'number') ? u.naturalOpacity : 1.0;
    const mat = mesh.material;
    if (mat) {
      mat.opacity = natural;
      mat.transparent = natural < 1;
      mat.depthWrite = true;
    }
    mesh.visible = true;
  }
}

// =========== SPINNING ==========================================

let _helixSpinRAF: number | null = null;
let _helixSpinPrevTime = 0;
let _helixSweepAngle = 0;
// v21: rotation rate is now LINKED to scenario time-step advancement.
// One revolution = _HELIX_STEPS_PER_REV scenario steps advance. Boss
// caught the v20 conflation: "each sweep of the helicoid through the
// vug should be capturing only what is happening at that exact
// moment in time, not what has come before it or after it." So a
// single revolution must show ONE moment (one fixed step), and time
// must advance between (or across multiple) revolutions.
//
// 60 RPM = 1 rev/sec. With 1 step per revolution, time advances at
// 1 step/sec. A 200-step scenario plays in ~3.3 minutes. To slow
// playback (more rotations per step = more time to study each
// moment), increase _HELIX_STEPS_PER_REV down toward 1/5 (= 5 revs
// per step). Boss's range: "1 rotation per unit of time through 5
// rotations per unit of time." Starting on the fast end.
const _HELIX_RPM = 60;
const _HELIX_STEPS_PER_REV = 1;

// v21: time-step state, advanced by the spin tick independently of
// the visual sweep. Within one revolution, _helixDisplayedStep stays
// constant (the floor of the continuous _helixCurrentTimeStep), so
// every sample taken inside that revolution sees the same scenario
// state. Loops back to 0 after the last step.
let _helixCurrentTimeStep = 0;
let _helixDisplayedStep = 0;

// v21: snap lookup keyed on scenario step (not sweep angle). Binary-
// searches the wall_state_history for the most recent snap whose
// .step ≤ requested step. v15's _helixSnapAt(sim, sweep) is kept as
// a thin wrapper for back-compat but routes through here using the
// currently-displayed step.
function _helixSnapAtStep(sim: any, step: number): any {
  const history = sim && sim.wall_state_history;
  if (!history || !history.length) return null;
  if (step <= history[0].step) return history[0];
  if (step >= history[history.length - 1].step) return history[history.length - 1];
  let lo = 0, hi = history.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (history[mid] && typeof history[mid].step === 'number' && history[mid].step <= step) lo = mid;
    else hi = mid - 1;
  }
  return history[lo];
}

// v20 helper kept for callers (e.g. the spin-tick line that passes
// step into _topoSyncCrystalMeshes). v21 makes it just return the
// pre-computed _helixDisplayedStep, which the spin tick updates each
// frame. Returns -1 when no history exists.
function _helixCurrentStep(sim: any, sweep: number): number {
  void sweep;  // sweep no longer drives step lookup
  const history = sim && sim.wall_state_history;
  if (!history || !history.length) return -1;
  return _helixDisplayedStep;
}

function _helixStartSpin() {
  if (_helixSpinRAF != null) return;
  _helixSpinPrevTime = performance.now();
  _helixSpinRAF = requestAnimationFrame(_helixSpinTick);
}

function _helixSpinTick(now: number) {
  const state = (typeof _topoThreeState !== 'undefined') ? _topoThreeState : null;
  if (!_helixOverlayEnabled || !state || !state.helixGroup) {
    _helixSpinRAF = null;
    return;
  }
  const c3 = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  const visible = c3 && c3.offsetParent != null && c3.style.display !== 'none';
  if (visible) {
    const dt = Math.max(0, Math.min(0.1, (now - _helixSpinPrevTime) / 1000));
    const omega = (_HELIX_RPM / 60) * 2 * Math.PI;
    _helixSweepAngle += dt * omega;
    // v23: negate the surface mesh's rotation so it spins the same
    // way the data does. Boss caught this at 60 RPM: "the helicoid
    // seems to spin counterclockwise and the data spins clockwise."
    // Diagnosis: THREE.rotation.y maps (1,0,0)→(cosθ, 0, −sinθ),
    // so positive rotation.y decreases atan2(z, x) for surface
    // vertices (math-clockwise from +Y top-down view). But trail +
    // crystal positions are computed at (r·cos(sweep+offset), y,
    // r·sin(sweep+offset)) — increasing sweep INCREASES atan2(z, x).
    // Same omega in code, opposite visual spin. Negating the
    // surface rotation matches the data convention. Trail + crystal
    // math is unchanged; only the (visual-only) helicoid surface
    // mesh's rotation gets flipped.
    state.helixGroup.rotation.y = -_helixSweepAngle;
    // v21: advance scenario time at (RPM/60) × STEPS_PER_REV steps
    // per second. Wrap at scenario end so playback loops.
    if (state.helixContext && state.helixContext.sim) {
      const history = state.helixContext.sim.wall_state_history;
      if (history && history.length) {
        const lastStep = history[history.length - 1].step || 0;
        _helixCurrentTimeStep += dt * (_HELIX_RPM / 60) * _HELIX_STEPS_PER_REV;
        if (_helixCurrentTimeStep > lastStep) _helixCurrentTimeStep = 0;
        _helixDisplayedStep = Math.floor(_helixCurrentTimeStep);
      }
    }
    if (state.helixContext) {
      const c = state.helixContext;
      // v20: rebuild crystal meshes at the current scenario step so
      // growth + nucleation play back as the helicoid spins. The
      // signature inside _topoSyncCrystalMeshes early-returns when
      // the step hasn't advanced — so this is one cheap signature
      // hash per frame plus one rebuild per step transition (~13/s
      // at 4 RPM on a 200-step scenario). Crystals that haven't
      // nucleated yet skip themselves (nucleation_step gate in
      // _topoHistoricalCrystalSize); already-nucleated crystals
      // render at their grown size at this step.
      const step = _helixCurrentStep(c.sim, _helixSweepAngle);
      if (step >= 0 && typeof _topoSyncCrystalMeshes === 'function') {
        _topoSyncCrystalMeshes(state, c.sim, c.wall, step);
      }
      _helixUpdateTrails(c.sim, c.wall, c.R, c.yMin, c.yMax, c.ringCount, c.ringOffsets);
      _helixUpdateCrystalVisibility(state, _helixSweepAngle, c.wall, c.ringCount, c.ringOffsets);
      _helixUpdateEvents(state, c.sim, c.wall, _helixSweepAngle, c.ringCount, c.ringOffsets);
    }
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  }
  _helixSpinPrevTime = now;
  _helixSpinRAF = requestAnimationFrame(_helixSpinTick);
}

function helixOverlayToggle() {
  _helixOverlayEnabled = !_helixOverlayEnabled;
  const btn = document.getElementById('helix-overlay-btn');
  if (btn) (btn as HTMLElement).style.color = _helixOverlayEnabled ? '#f0c050' : '';
  _helixSyncLegendVisibility();
  if (typeof topoRender === 'function') topoRender();
}
