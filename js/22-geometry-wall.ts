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

class VugWall {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts = {}) {
    this.composition = opts.composition ?? 'limestone';
    this.thickness_mm = opts.thickness_mm ?? 500.0;
    this.vug_diameter_mm = opts.vug_diameter_mm ?? 50.0;
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
    // Player-tunable wall reactivity multiplier (Creative-mode slider).
    // 0=inert, 1=default limestone (current behavior), 2=fast-dissolving
    // fresh limestone with mild water-only dissolution. Only affects
    // carbonate walls; silicate composition stays inert regardless.
    // See vugg.py VugWall docstring for the full table.
    this.reactivity = opts.reactivity ?? 1.0;
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

// Raycast the bubble union at angle theta, honouring origin
// connectivity. Returns the outer wall distance from origin.
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

class WallState {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts = {}) {
    this.cells_per_ring = opts.cells_per_ring ?? 120;
    // Phase 1 of PROPOSAL-3D-SIMULATION: 16 vertically-stacked rings as
    // the new default. Engine still operates on ring[0] only — rings 1..15
    // hold pristine WallCell defaults so forward-simulation byte-equality
    // is preserved. Phase 2 (per-ring chemistry) is what makes them differ.
    this.ring_count = opts.ring_count ?? 16;
    this.vug_diameter_mm = opts.vug_diameter_mm ?? 50.0;
    this.initial_radius_mm = opts.initial_radius_mm ?? (this.vug_diameter_mm / 2);
    this.ring_spacing_mm = opts.ring_spacing_mm ?? 1.0;
    // Phase-1 two-stage bubble-merge parameters (see VugWall).
    this.primary_bubbles = opts.primary_bubbles ?? 3;
    this.secondary_bubbles = opts.secondary_bubbles ?? 6;
    this.shape_seed = opts.shape_seed ?? 0;
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
    // Bake per-cell base_radius_mm from the bubble-merge profile. Must
    // happen before max_seen_radius_mm is seeded so promontories
    // contribute.
    this._buildProfile();
    this._buildPolarProfile();
    this._buildTwistProfile();

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

  // Phase 1: compute per-cell base_radius_mm via two-stage bubble
  // merging. Stage 1 places a few large bubbles near origin forming
  // the main cavity; stage 2 places smaller bubbles on the primary
  // union's outer edge (satellite alcoves eaten from the wall by
  // percolating fluids). Sample the full union at each cell angle,
  // then rescale mean to nominal.
  //
  // Mirrors WallState._build_profile in vugg.py. Backward compatible:
  // primary_bubbles=1, secondary_bubbles=0 rescales to a perfect
  // circle.
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
    this.polar_amplitudes = [];
    this.polar_phases = [];
    for (let n = 0; n < HARMONICS; n++) {
      this.polar_amplitudes.push(AMP_LO + (AMP_HI - AMP_LO) * rng());
      this.polar_phases.push(rng() * 2 * Math.PI);
    }
  }

  // Per-latitude radial multiplier. φ ∈ [0, π], south pole at 0,
  // north at π. Floored at 0.5 so a strong pinch can't collapse a
  // ring to zero radius.
  polarProfileFactor(phi) {
    let factor = 1.0;
    for (let n = 0; n < this.polar_amplitudes.length; n++) {
      factor += this.polar_amplitudes[n] * Math.cos((n + 1) * phi + this.polar_phases[n]);
    }
    return Math.max(0.5, factor);
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
    this.twist_amplitudes = [];
    this.twist_phases = [];
    for (let n = 0; n < HARMONICS; n++) {
      this.twist_amplitudes.push(AMP_LO + (AMP_HI - AMP_LO) * rng());
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
  erodeCells(rateMm, blocked) {
    if (!(rateMm > 0)) return 0;
    const ring0 = this.rings[0];
    const N = ring0.length;
    const unblocked = [];
    for (let i = 0; i < N; i++) if (!blocked.has(i)) unblocked.push(i);
    if (!unblocked.length) return 0;
    const perCell = rateMm * N / unblocked.length;
    for (const i of unblocked) ring0[i].wall_depth += perCell;
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
    for (const ring of this.rings) {
      for (const cell of ring) {
        cell.crystal_id = null;
        cell.mineral = null;
        cell.thickness_um = 0;
      }
    }
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
    if (crystal.wall_center_cell == null) return;
    // Phase C v1: paint on the crystal's own ring so crystals scatter
    // across the sphere wall. Legacy crystals (null ring) fall back
    // to ring 0. Mirrors WallState.paint_crystal in vugg.py.
    let ringIdx = crystal.wall_ring_index;
    if (ringIdx == null || ringIdx < 0 || ringIdx >= this.ring_count) {
      ringIdx = 0;
    }
    const FOOTPRINT_SCALE = 4.0;
    const arcMm = (crystal.total_growth_um / 1000.0)
                  * Math.max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE;
    const halfCells = Math.max(1, Math.round(arcMm / this.cell_arc_mm / 2));
    const thickness = Math.max(crystal.total_growth_um, 1);  // nucleated = visible
    const ring = this.rings[ringIdx];
    const N = this.cells_per_ring;
    for (let offset = -halfCells; offset <= halfCells; offset++) {
      const idx = ((crystal.wall_center_cell + offset) % N + N) % N;
      const cell = ring[idx];
      if (cell.thickness_um < thickness) {
        cell.crystal_id = crystal.crystal_id;
        cell.mineral = crystal.mineral;
        cell.thickness_um = thickness;
      }
    }
  }
}

