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

// Phase 2c.2 coupling gate — DEFAULT OFF (DARK). When ON, nucleation PLACEMENT
// is biased toward open supply-feeders (geysers 1.8 / hotspots 1.4; cracks 1.0 =
// none) by weighting the legacy ring0 COLUMN pick (columnSupplyWeights), a
// redistribution of the SAME rng draw (the ring — hence growth chemistry — is
// assigned separately, so the assemblage is preserved; only angular position
// shifts). It ships OFF after a verify-the-mechanism finding (tools/fluid-spots-
// deposition-observe.mjs + a direct column-membership probe): at 1.4-1.8× over a
// few columns of ~120 with sparse (~25-77) nucleation, the bias does NOT visibly
// CLUSTER crystals at feeders (gem_pegmatite feeders [107,114,78] capture 0
// crystals both OFF and ON) — it only RESHUFFLES placement, churning 11/30
// baselines (assemblage preserved, 0 expects_species lost) without the payoff.
// The visible-clustering path is a per-cell PROXIMITY-DECAY supply weight through
// the per-vertex sampler (HANDOFF-PER-VERTEX-PLACEMENT synergy) — a future
// increment + a visible aesthetic choice for the boss. The mechanism stays wired
// (+ tested via explicit ON) so that path can build on it. Mirrors the
// fluidSpotsDecayEnabled shape. Read the LIVE value via fluidSpotsDepositionEnabled().
let _FLUID_SPOTS_DEPOSITION_ENABLED = false;
function setFluidSpotsDepositionEnabled(enabled: boolean): void { _FLUID_SPOTS_DEPOSITION_ENABLED = !!enabled; }
function fluidSpotsDepositionEnabled(): boolean { return _FLUID_SPOTS_DEPOSITION_ENABLED; }

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

  constructor(spots: FluidSpot[] | undefined) {
    this.spots = Array.isArray(spots) ? spots : [];
    this._byCell = new Map();
    for (const s of this.spots) this._byCell.set(s.cell, s);
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
  // columnWeights. Nucleation's legacy cell pick chooses a ring0 column; this
  // biases that pick toward open SUPPLY-feeders so crystals cluster in the
  // feeder's column. Weight = MAX supply among OPEN spots on the column (>1 =
  // nucleate more there). Crucially uses `supply`, NOT decayBonus: by the kind
  // defaults a 'crack' has supply 1.0 (erosion-dominant flow-through, no extra
  // deposition) while geysers (1.8) / hotspots (1.4) are vent-fed precipitators
  // — so a crack deepens its column (2b) without seeding crystals there, exactly
  // the right physics. Returns a length-cellsPerRing array (1.0 where no feeder)
  // or null when nothing biases (caller stays on the EXACT legacy pick →
  // byte-identical). The ring is assigned separately, so this shifts angular
  // position only — the assemblage (minerals/sizes/counts) is unchanged.
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
