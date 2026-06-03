// ============================================================
// js/85k-fluid-spots.ts — FLUID-SOURCE SPOTS engine (Phase 2a scaffold, DARK)
// ============================================================
// Real cavities are NOT bathed uniformly — they connect to their plumbing at a
// few discrete points (fractures, feeder channels, vents), so fresh fluid +
// chemistry enter FOCUSED. A "spot" is the physical home of the spatial-origin
// mechanic (PROPOSAL-EVENTS-AS-GEOLOGICAL-MOVEMENTS §10 / §9c): a named,
// persistent, SEEDED wall point where fluid enters. Geology: a fracture is both
// the fluid delivery path AND where dissolution concentrates → cavities grow
// along their feeders, and the best crystals cluster near the feeder. The
// motivating specimen is one-sided mineralization (hematite mostly on ONE side
// of a Punjab calcite) — uniform application can never make that asymmetry.
//
// PHASE 2 PLAN (each sub-step its own sim-affecting change + verify pass):
//   2a (THIS) — seed the spot set off the cavity seed; DARK (nothing reads it
//               yet → SIM-NEUTRAL, seed-42 byte-identical, NO SIM_VERSION bump).
//   2b        — wall-decay bonus: open-spot cells erode faster (erodeCells) →
//               lopsided cavity deepening. First coupling; baseline regen.
//   2c        — origin:'cell' movements ride OPEN spots (supersede the naive
//               _pickOriginCell pick) + local deposition/nucleation bias.
//   2d        — open/close via events (spatialize the seal/breach handlers).
//
// SEEDED & REPRODUCIBLE, exactly like the geometry sub-streams in
// 22-geometry-wall.ts (_mulberry32(shape_seed ^ MASK)) and the movement stream
// in 85j (_MOVEMENT_SALT). A DEDICATED stream means seeding spots never displaces
// the shared `rng` nucleation cascade → the dark scaffold stays byte-identical.
// Same cavity (shape_seed) → same spots: geology drives the outcome, spatially.

// Per-purpose salt for the spot stream (ASCII "SPOT"), XORed into the cavity
// seed — distinct from polar (0x700AA517), twist (0xBEEFFACE), movement
// (0x4d4f5645) so the spot draws are independent of every other sub-stream.
const _SPOTS_SALT = 0x53504f54;

// Phase 2b coupling gate. When ON (default — the shipped feature), open-spot
// cells erode preferentially in dissolve_wall/erodeCells → lopsided cavity
// deepening toward feeders. The OBSERVER toggles this OFF to recover the
// no-spot baseline for an A/B look; tests use it for the neutral/active
// positive control. Mirrors the EH_DYNAMIC_ENABLED pattern (20c). The exported
// global is a load-time snapshot; read the LIVE value via fluidSpotsDecayEnabled().
let _FLUID_SPOTS_DECAY_ENABLED = true;
function setFluidSpotsDecayEnabled(enabled: boolean): void { _FLUID_SPOTS_DECAY_ENABLED = !!enabled; }
function fluidSpotsDecayEnabled(): boolean { return _FLUID_SPOTS_DECAY_ENABLED; }

// Phase 2c.2b coupling — DEPOSITION CLUSTERING is PER-SCENARIO OPT-IN, not global.
// When active for a sim, nucleation PLACEMENT clusters toward open supply-feeders
// (geysers 1.8 / hotspots 1.4; cracks 1.0 = none — flow-through, not precipitators)
// via the per-cell proximityField halo (below), used in BOTH placement samplers.
// This is the model that actually CLUSTERS — the original 2c.2 column-only bias
// (superseded, kept as columnSupplyWeights) reshuffled placement without a visible
// signal (gem_pegmatite feeder columns captured 0 crystals). Measured (K12/λ2.5):
// crystals within 2 cells of a feeder rise from ~0-2% to ~11-18% (a clear lobe),
// assemblage PRESERVED (the ring — growth chemistry — is assigned separately; sizes
// move only via spatial competition).
//
// WHY OPT-IN (not global like 2b): global-on perturbed a VALIDATED-chemistry scenario
// (reactive_wall's marginal PWP precipitation contract shifted when its calcite
// clustered) — clustering shouldn't silently rewrite scenarios built to test other
// physics. A scenario enables it with `fluid_spots: { deposition: true }`; the sim
// reads that into `this._fluidSpotsDeposition`. The validated fleet stays byte-identical.
//
// The flag here is a TRI-STATE master OVERRIDE for the observer + tests:
//   null  (default) → honor the per-scenario opt-in
//   true / false    → force clustering on / off for EVERY sim (A/B harness, controls)
// Restore to null after a forced run. Read the resolved per-sim value via
// fluidSpotsDepositionFor(sim).
let _FLUID_SPOTS_DEPOSITION_OVERRIDE: boolean | null = null;
function setFluidSpotsDepositionEnabled(enabled: boolean | null): void {
  _FLUID_SPOTS_DEPOSITION_OVERRIDE = (enabled === null || enabled === undefined) ? null : !!enabled;
}
function fluidSpotsDepositionOverride(): boolean | null { return _FLUID_SPOTS_DEPOSITION_OVERRIDE; }
// Resolve whether deposition clustering is active for a given sim: the master
// override wins when set, else the sim's per-scenario opt-in (default false).
function fluidSpotsDepositionFor(sim: any): boolean {
  if (_FLUID_SPOTS_DEPOSITION_OVERRIDE !== null) return _FLUID_SPOTS_DEPOSITION_OVERRIDE;
  return !!(sim && sim._fluidSpotsDeposition);
}

// Phase 2c.2b — the per-cell PROXIMITY-DECAY clustering parameters (the model
// that ACTUALLY clusters, superseding the 2c.2 column-bias that didn't — see the
// flag comment above). A cell's deposition boost is
//     1 + max_over_open_supply_feeders[ (supply - 1) * PEAK_K * exp(-dist/LAMBDA) ]
// where dist is the lat-long graph distance (|Δring| + wrapped |Δcol|) to the
// feeder cell. PEAK_K turns the modest per-kind supply (geyser 1.8 / hotspot 1.4)
// into a VISIBLE peak (hotspot center ≈ 1+0.4·K, geyser ≈ 1+0.8·K); LAMBDA is the
// decay length in hops (a tight halo). Module-mutable so the observer can sweep
// strengths and the boss can calibrate before baking — setDepositionClustering()
// resets them (each sim builds a fresh FluidSpotField, so a new run picks them up).
let _DEPOSITION_PEAK_K = 12;
let _DEPOSITION_LAMBDA = 2.5;
function setDepositionClustering(peakK: number, lambda: number): void {
  if (typeof peakK === 'number' && peakK >= 0) _DEPOSITION_PEAK_K = peakK;
  if (typeof lambda === 'number' && lambda > 0) _DEPOSITION_LAMBDA = lambda;
}
function depositionClustering(): { peakK: number; lambda: number } {
  return { peakK: _DEPOSITION_PEAK_K, lambda: _DEPOSITION_LAMBDA };
}

type FluidSpotKind = 'crack' | 'geyser' | 'hotspot';

// A single fluid-entry point on the cavity wall.
//   cell        index into mesh.cells[] (the wall location).
//   kind        crack | geyser | hotspot (flavor; tunes future couplings).
//   open        event-toggleable (Phase 2d). Seeded open.
//   supply      local deposition / supersaturation bias strength (Phase 2c).
//   decayBonus  local wall-erosion multiplier > 1 (Phase 2b).
interface FluidSpot {
  cell: number;
  kind: FluidSpotKind;
  open: boolean;
  supply: number;
  decayBonus: number;
}

// A dedicated deterministic PRNG for the spot set, derived from the cavity seed.
// Reuses _mulberry32 (22-geometry-wall.ts) — resume-safe, independent of `rng`.
function _makeSpotRng(vuggSeed: number, salt: number = _SPOTS_SALT): () => number {
  return _mulberry32((((vuggSeed | 0) ^ salt) >>> 0));
}

const _SPOT_KINDS: FluidSpotKind[] = ['crack', 'geyser', 'hotspot'];

// Default per-kind coupling strengths (consumed in 2b/2c, inert in 2a). Cracks
// are erosion-dominant (the feeder deepens); geysers are supply-dominant
// (episodic chemistry delivery); hotspots are balanced + warm.
const _KIND_DEFAULTS: Record<FluidSpotKind, { supply: number; decayBonus: number }> = {
  crack:   { supply: 1.0, decayBonus: 1.6 },
  geyser:  { supply: 1.8, decayBonus: 1.2 },
  hotspot: { supply: 1.4, decayBonus: 1.3 },
};

// Seed the spot SET deterministically from the cavity seed + cell count.
// Count comes from a small distribution (CAN be 0 — some cavities are bathed,
// not fed at a point), unless a scenario pins it via opts. Cells are distinct,
// drawn uniformly over the wall (orientation-biasing is a later refinement).
// Pure given (shapeSeed, cellCount, opts) → fully reproducible.
//
//   opts (from a scenario's `fluid_spots` block, all optional):
//     count               fixed spot count (overrides the distribution)
//     minCount, maxCount  clamp the seeded distribution
//     kinds               restrict to a subset of kinds
function _seedFluidSpots(shapeSeed: number, cellCount: number, opts: any = {}): FluidSpot[] {
  const n = Math.max(0, cellCount | 0);
  if (n === 0) return [];
  const rng = _makeSpotRng(shapeSeed);

  // Count: a fixed override, else a small seeded distribution (mode 1-2, can
  // be 0). Clamped to [minCount, maxCount] then to the available cell count.
  let count: number;
  if (typeof opts.count === 'number') {
    count = Math.max(0, opts.count | 0);
  } else {
    const r = rng();
    count = r < 0.15 ? 0 : r < 0.50 ? 1 : r < 0.80 ? 2 : r < 0.95 ? 3 : 4;
  }
  if (typeof opts.minCount === 'number') count = Math.max(opts.minCount | 0, count);
  if (typeof opts.maxCount === 'number') count = Math.min(opts.maxCount | 0, count);
  count = Math.min(count, n);
  if (count === 0) return [];

  const kinds: FluidSpotKind[] = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds.filter((k: any) => _SPOT_KINDS.includes(k))
    : _SPOT_KINDS;
  if (!kinds.length) kinds.push('crack');

  // Distinct cells: rejection-sample over the stream (count << n, so cheap).
  const used = new Set<number>();
  const spots: FluidSpot[] = [];
  let guard = 0;
  while (spots.length < count && guard++ < count * 50) {
    const cell = Math.min(n - 1, Math.floor(rng() * n));
    if (used.has(cell)) continue;
    used.add(cell);
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(rng() * kinds.length))];
    const d = _KIND_DEFAULTS[kind];
    spots.push({ cell, kind, open: true, supply: d.supply, decayBonus: d.decayBonus });
  }
  return spots;
}

// A lightweight holder for a sim's spot set + the queries the future couplings
// (2b-2d) will use. An EMPTY set is a total no-op — every accessor returns the
// neutral value, so a cavity with zero spots behaves exactly as today.
class FluidSpotField {
  spots: FluidSpot[];
  private _byCell: Map<number, FluidSpot>;
  private _proxCache: Float64Array | null;   // 2c.2b proximityField memo
  private _proxSig: string;

  constructor(spots: FluidSpot[] | undefined) {
    this.spots = Array.isArray(spots) ? spots : [];
    this._byCell = new Map();
    for (const s of this.spots) this._byCell.set(s.cell, s);
    this._proxCache = null;
    this._proxSig = '';
  }

  get isEmpty(): boolean { return this.spots.length === 0; }

  // The open spots — the live fluid sources this step (Phase 2c/2d). All seeded
  // open in 2a; 2d toggles `open` via events.
  openSpots(): FluidSpot[] {
    return this.spots.filter(s => s.open);
  }

  // Wall-decay multiplier at a cell (Phase 2b). 1.0 (neutral) unless an OPEN
  // spot sits on the cell. Safe for any cell index when the set is empty.
  decayMultiplierAt(cell: number): number {
    const s = this._byCell.get(cell);
    return (s && s.open) ? s.decayBonus : 1.0;
  }

  // Local deposition / supersaturation bias at a cell (Phase 2c). 1.0 neutral.
  supplyAt(cell: number): number {
    const s = this._byCell.get(cell);
    return (s && s.open) ? s.supply : 1.0;
  }

  // Phase 2b — per-COLUMN erosion weights for erodeCells, which operates on the
  // equatorial ring (ring0) per slice/column. A spot's mesh cell index maps to a
  // column via (cell % cellsPerRing); the column's weight is the MAX decayBonus
  // among OPEN spots on it (>1 = erode faster there). Returns a length-cellsPerRing
  // array of multipliers (1.0 where no open spot). erodeCells redistributes the
  // FIXED dissolution budget by these weights → lopsided deepening toward feeders,
  // mass-conserving (the Ca/CO3 release is computed upstream, so this is purely
  // geometric). Returns null when there's nothing to bias (caller stays on the
  // uniform path → byte-identical).
  columnWeights(cellsPerRing: number): number[] | null {
    const N = cellsPerRing | 0;
    if (N <= 0 || this.isEmpty) return null;
    let any = false;
    const w = new Array(N).fill(1.0);
    for (const s of this.spots) {
      if (!s.open || !(s.decayBonus > 1)) continue;
      const col = ((s.cell % N) + N) % N;
      if (s.decayBonus > w[col]) { w[col] = s.decayBonus; any = true; }
    }
    return any ? w : null;
  }

  // Phase 2c.2 — per-COLUMN DEPOSITION weights, the placement analog of
  // columnWeights. Weight = MAX supply among OPEN spots on the column (>1).
  // Crucially uses `supply` NOT decayBonus: a 'crack' (supply 1.0) deepens its
  // column (2b) without seeding crystals; geysers/hotspots are vent precipitators.
  // SUPERSEDED for placement by proximityField (2c.2b) — the column-only bias
  // didn't visibly cluster (see the deposition-flag comment). Kept as the sibling
  // query to columnWeights. Returns a length-cellsPerRing array or null.
  columnSupplyWeights(cellsPerRing: number): number[] | null {
    const N = cellsPerRing | 0;
    if (N <= 0 || this.isEmpty) return null;
    let any = false;
    const w = new Array(N).fill(1.0);
    for (const s of this.spots) {
      if (!s.open || !(s.supply > 1)) continue;
      const col = ((s.cell % N) + N) % N;
      if (s.supply > w[col]) { w[col] = s.supply; any = true; }
    }
    return any ? w : null;
  }

  // Phase 2c.2b — per-CELL deposition PROXIMITY field over the full ring×col
  // mesh: a decaying halo of nucleation boost around each open SUPPLY-feeder.
  // This is the model that actually CLUSTERS crystals (the 2c.2 column-only bias
  // didn't — a feeder is a 2-D patch on the wall, not a thin vertical stripe).
  //   boost(r,c) = 1 + max_f[ (supply_f - 1)·PEAK_K·exp(-dist_f / LAMBDA) ]
  // dist = lat-long graph distance |Δring| + wrapped |Δcol| (the metric diffusion
  // relaxes along). Used as a multiplicative weight in BOTH placement samplers
  // (the per-vertex σ-weighted one and the geometry-only feeder sampler), so a
  // crystal is far likelier to nucleate near a vent. Returns a Float64Array of
  // length ringCount·N (row-major idx = r·N + c), or NULL when there are no open
  // supply-feeders (caller falls through → byte-identical). Cached per
  // (N, ringCount, PEAK_K, LAMBDA); spots are static within a run (2d will toggle).
  proximityField(cellsPerRing: number, ringCount: number): Float64Array | null {
    const N = cellsPerRing | 0;
    const R = ringCount | 0;
    if (N <= 0 || R <= 0 || this.isEmpty) return null;
    const feeders = this.spots.filter(s => s.open && s.supply > 1);
    if (!feeders.length) return null;
    const sig = `${N}|${R}|${_DEPOSITION_PEAK_K}|${_DEPOSITION_LAMBDA}`;
    if (this._proxCache && this._proxSig === sig) return this._proxCache;
    const w = new Float64Array(N * R);
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < N; c++) {
        let boost = 0;
        for (const f of feeders) {
          const fr = (f.cell / N) | 0, fc = f.cell % N;
          const dCol = Math.abs(c - fc);
          const dist = Math.abs(r - fr) + Math.min(dCol, N - dCol);
          const b = (f.supply - 1) * _DEPOSITION_PEAK_K * Math.exp(-dist / _DEPOSITION_LAMBDA);
          if (b > boost) boost = b;
        }
        w[r * N + c] = 1 + boost;
      }
    }
    this._proxCache = w;
    this._proxSig = sig;
    return w;
  }

  // Phase 2d — open/close spots over a vug's life, driven by events (a fracture
  // seals → its feeder shuts; tectonic uplift / aquifer recharge breaches a vent
  // back open). Because every coupling (2b erosion columnWeights, 2c.1 origin
  // openSpots, 2c.2b proximityField) filters on `s.open`, flipping the flag
  // propagates everywhere for free — the couplings re-read it live. `pred`
  // selects which spots: undefined = all, a kind string ('crack'), or a
  // predicate fn. Returns the spots actually toggled (for the event log).
  // CACHE NOTE: proximityField memoizes by (N,R,K,λ) and does NOT key on the
  // open-set, so a toggle MUST invalidate it or a sealed feeder would keep
  // clustering from the stale cache. _byCell/openSpots/columnWeights read `open`
  // live, so only the proximity memo needs busting.
  private _matchSpots(pred: any, wantOpen: boolean): FluidSpot[] {
    return this.spots.filter(s => s.open === wantOpen && (
      pred == null ? true :
      typeof pred === 'string' ? s.kind === pred :
      typeof pred === 'function' ? !!pred(s) : true));
  }
  sealSpots(pred?: any): FluidSpot[] {
    const hit = this._matchSpots(pred, true);
    for (const s of hit) s.open = false;
    if (hit.length) this._proxCache = null;   // bust the clustering memo
    return hit;
  }
  breachSpots(pred?: any): FluidSpot[] {
    const hit = this._matchSpots(pred, false);
    for (const s of hit) s.open = true;
    if (hit.length) this._proxCache = null;
    return hit;
  }
}

// Factory: build a sim's spot field. Seeds off the cavity's shape_seed (geology
// drives outcome) using mesh.numInterior cells; falls back to the run seed if no
// shape_seed. Reads an optional scenario `fluid_spots` config. Phase 2a: the
// field is built + stored but NOTHING reads it → sim-neutral.
function _createFluidSpotField(sim: any): FluidSpotField {
  // The BUILT + cached mesh and the cavity shape_seed both live on `wall_state`
  // (the runtime WallState), NOT on `conditions.wall` (the VugWall config) — the
  // constructor builds the mesh via `this.wall_state.meshFor(this)`. Read both
  // from wall_state; fall back to the config wall's shape_seed / the run seed.
  const ws = sim ? sim.wall_state : null;
  const confWall = sim && sim.conditions ? sim.conditions.wall : null;
  const shapeSeed = (ws && typeof ws.shape_seed === 'number') ? ws.shape_seed
    : (confWall && typeof confWall.shape_seed === 'number') ? confWall.shape_seed
    : (sim && sim._seed) || 0;
  const vuggSeed = shapeSeed | 0;
  const mesh = ws && ws.meshFor ? ws.meshFor(sim) : null;
  const cellCount = (mesh && typeof mesh.numInterior === 'number' && mesh.numInterior > 0)
    ? mesh.numInterior
    : (mesh && mesh.cells ? mesh.cells.length : 0);
  const opts = (sim && sim.conditions && sim.conditions._scenario)
    ? (sim.conditions._scenario.fluid_spots || {}) : {};
  return new FluidSpotField(_seedFluidSpots(vuggSeed, cellCount, opts));
}
