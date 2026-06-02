// ============================================================
// js/85j-movements.ts — geological MOVEMENTS engine (Phase 0 scaffold, DARK)
// ============================================================
// The broth is currently a STEP FUNCTION: ~64% of fluid fields are dead-flat
// over a vug's life and redox (Eh) is frozen, so elements only move when a
// discrete event shoves them (tools/broth-stability-probe.mjs, 2026-06-01).
// Real vug chemistry is a continuously-evolving CURVE. This engine drives a
// few MASTER VARIABLES (T, pH, redox, …) with persistent "movements"; the
// existing saturation/SI engines then translate those into CORRELATED element
// pulses (we never randomize elements directly). See:
//   proposals/HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md   (the plan)
//   proposals/PROPOSAL-EVENTS-AS-GEOLOGICAL-MOVEMENTS.md    (design §8/§9/§9b)
//   proposals/RESEARCH-vug-fluid-evolution-2026-06-01.md    (the science)
//
// DESIGN (agreed with boss, 2026-06-01):
//   * A PRIMITIVE ALPHABET, not a fixed menu of named cycles. Any master-
//     variable trajectory = a sum of composable operators: TREND, PULSE
//     (in trains), STEP, OSCILLATION (mean-reverting), MIXING. The named
//     archetypes (orogenic / pulse-train / meteoric-front / magmatic-
//     hydrothermal) are just presets; the seed samples the continuous space,
//     so most vugs are unnamed-but-real blends.
//   * SEEDED & REPRODUCIBLE. Movements draw from a DEDICATED sub-stream
//     derived from the VUGG (cavity) seed — mirrors the shape_seed-derived
//     geometry streams in 22-geometry-wall.ts (_mulberry32(shape_seed ^ salt)).
//     Linking to the cavity seed = "the geology of the vug drives its chemical
//     outcome." A dedicated stream (NOT the shared `rng`) means tuning a
//     movement never displaces the nucleation draw cascade. Reproducibility is
//     required: baseline tests depend on it AND the crystal-cipher sub-project
//     needs bit-exact regeneration. No Math.random / Date.now (resume-safe).
//   * STATISTICAL CHARACTER (research correction): fine zoning is ANTI-
//     persistent / mean-reverting (Holten 1997), NOT a persistent random walk.
//     So texture = Ornstein-Uhlenbeck (mean-reverting) around a slowly-moving
//     setpoint — the setpoint (coarse trend) carries the "long slow movement";
//     the texture wobbles and reverts, it does not wander off.
//
// PHASE 0 = DARK SCAFFOLD. This module is fully defined + unit-tested, but
// NO scenario opts in yet (none declare `movements` in scenarios.json5), so
// the run_step hook is a dead path → SIM-NEUTRAL, seed-42 + strip-digest
// byte-identical, NO SIM_VERSION bump. Phase 1 opts ONE scenario (a meteoric
// front) in, regens that one baseline, and we look + listen.

// Per-purpose salt for the movement stream (ASCII "MOVE"), XORed into the
// cavity seed exactly like the geometry sub-streams (22-geometry-wall.ts:884).
const _MOVEMENT_SALT = 0x4d4f5645;

// A dedicated deterministic PRNG for movements, derived from the vugg seed.
// Reuses _mulberry32 (defined in 22-geometry-wall.ts) — resume-safe, and
// independent of the shared `rng` cascade. Returns a () => [0,1) function.
function _makeMovementRng(vuggSeed: number, salt: number = _MOVEMENT_SALT): () => number {
  return _mulberry32((((vuggSeed | 0) ^ salt) >>> 0));
}

// SPATIAL origin (boss, 2026-06-01): a movement can originate at one
// semi-random CELL and flow outward via the diffusion that already runs each
// step (_diffuseRingState over mesh.cells[].fluid) — instead of applying
// evenly across the whole cavity. That makes the vug's 3-D-ness matter and
// reproduces one-sided growth (the hematite-on-one-side-of-calcite specimens).
// The pick is seeded from the movement stream → reproducible AND tied to the
// vugg/cavity seed (same cavity → same origin spots). Pure + deterministic
// given the rng. Returns a cell index in [0, cellCount).
function _pickOriginCell(rng: () => number, cellCount: number): number {
  const n = Math.max(1, cellCount | 0);
  return Math.min(n - 1, Math.floor(rng() * n));
}

// ----------------------------------------------------------------
// THE PRIMITIVE ALPHABET — pure shape functions of progress u ∈ [0,1].
// Each returns a unitless shape in roughly [0,1] (or [-1,1] for mixing),
// scaled by a per-op `amp` and applied to a master variable. Pure + testable;
// the stochastic texture (OSCILLATION) is applied statefully in the
// controller, since mean-reversion needs memory of the prior value.
// ----------------------------------------------------------------

// TREND — monotonic drift 0→1 across the window. `ease` smooths the ends
// (smoothstep) so a movement starts and finishes gently rather than with a
// kink. [orogenic cooling = one long trend]
function _mvTrend(u: number, ease: boolean = true): number {
  const x = Math.max(0, Math.min(1, u));
  return ease ? x * x * (3 - 2 * x) : x;   // smoothstep | linear
}

// PULSE — a smooth bump centred at `center` with half-width `width`
// (gaussian). A PULSE TRAIN is just several of these summed.
// [hydrothermal fault-valve injection]
function _mvPulse(u: number, center: number = 0.5, width: number = 0.12): number {
  const w = Math.max(1e-4, width);
  const z = (u - center) / w;
  return Math.exp(-0.5 * z * z);
}

// STEP — a regime jump: 0 before `at`, 1 after, with a short `soften` ramp
// so it isn't an infinitely-sharp discontinuity. [a stage transition]
function _mvStep(u: number, at: number = 0.5, soften: number = 0.04): number {
  const s = Math.max(1e-4, soften);
  return Math.max(0, Math.min(1, (u - at) / s + 0.5));
}

// MIXING — two end-members blended in a proportion that itself moves over the
// window (here: a monotonic ramp of the mixing fraction). Returns the mixing
// fraction f ∈ [0,1]; the caller lerps field = (1-f)·a + f·b. [meteoric ↔ deep
// brine]. Kept as a fraction (not a delta) so callers can lerp explicitly.
function _mvMixFraction(u: number, ease: boolean = true): number {
  return _mvTrend(u, ease);
}

type MovementOp =
  | { kind: 'trend'; amp: number; ease?: boolean }
  | { kind: 'pulse'; amp: number; center?: number; width?: number }
  | { kind: 'step'; amp: number; at?: number; soften?: number };

// Evaluate the deterministic (non-texture) operators at progress u → a delta
// added to the field's window-entry base. (MIXING is handled separately via
// `mix`, and OSCILLATION via the controller's stateful texture.)
function _evalMovementOps(ops: MovementOp[] | undefined, u: number): number {
  if (!ops || !ops.length) return 0;
  let d = 0;
  for (const op of ops) {
    if (op.kind === 'trend') d += op.amp * _mvTrend(u, op.ease !== false);
    else if (op.kind === 'pulse') d += op.amp * _mvPulse(u, op.center ?? 0.5, op.width ?? 0.12);
    else if (op.kind === 'step') d += op.amp * _mvStep(u, op.at ?? 0.5, op.soften ?? 0.04);
  }
  return d;
}

// ----------------------------------------------------------------
// A single movement spec (what a scenario will declare in Phase 1+):
//   field        dotted path on conditions, e.g. 'temperature', 'fluid.pH',
//                'fluid.Eh' — the master variable this movement drives.
//   startStep,
//   endStep      the window (inclusive start, exclusive end) in sim steps.
//   base         optional explicit baseline; if omitted, captured from the
//                field's value when the window first becomes active.
//   ops          the deterministic shape (sum of trend/pulse/step operators).
//   mix          optional {to, ease} — instead of (or with) ops, lerp the
//                field from its base toward `to` by _mvMixFraction(u).
//   texture      optional {theta, sigma} — mean-reverting (OU) wobble around
//                the setpoint. theta∈(0,1] = reversion strength, sigma = noise
//                scale (in field units). Off when absent (deterministic).
//   clampMin,
//   clampMax     optional bounds (physical floors/ceilings).
// ----------------------------------------------------------------
interface MovementSpec {
  field: string;
  startStep: number;
  endStep: number;
  base?: number;
  ops?: MovementOp[];
  mix?: { to: number; ease?: boolean };
  texture?: { theta: number; sigma: number };
  clampMin?: number;
  clampMax?: number;
  // SPATIAL origin. 'global' (default) = apply to conditions, propagated
  // evenly (current behavior). 'cell' = inject into ONE seeded origin cell's
  // mesh.cells[].fluid and let _diffuseRingState carry it out (one-sided
  // growth). `originCell` optionally pins the cell; otherwise it's drawn from
  // the movement stream via _pickOriginCell. NB: 'cell' injection is wired in
  // Phase 1-spatial (the controller needs the sim's mesh handle); Phase 0
  // carries the field + the picker but applyStep still does the global path.
  origin?: 'global' | 'cell';
  originCell?: number;
}

function _movementGetField(conditions: any, path: string): number {
  const parts = path.split('.');
  let o = conditions;
  for (let i = 0; i < parts.length - 1; i++) { if (o == null) return NaN; o = o[parts[i]]; }
  const v = o == null ? NaN : o[parts[parts.length - 1]];
  return typeof v === 'number' ? v : NaN;
}

function _movementSetField(conditions: any, path: string, value: number): void {
  const parts = path.split('.');
  let o = conditions;
  for (let i = 0; i < parts.length - 1; i++) { if (o == null) return; o = o[parts[i]]; }
  if (o != null) o[parts[parts.length - 1]] = value;
}

// The controller holds the parsed movements + the dedicated rng + per-movement
// state (captured base + the OU texture value). An EMPTY controller is a total
// no-op: applyStep returns before touching `conditions` or drawing any random
// number — this is what keeps the dark scaffold byte-identical.
class MovementController {
  movements: MovementSpec[];
  rng: () => number;
  _state: { base: number; ou: number; started: boolean }[];

  constructor(movements: MovementSpec[] | undefined, vuggSeed: number) {
    this.movements = Array.isArray(movements) ? movements : [];
    this.rng = _makeMovementRng(vuggSeed);
    this._state = this.movements.map(() => ({ base: 0, ou: 0, started: false }));
  }

  get isEmpty(): boolean { return this.movements.length === 0; }

  // Phase 4c.3a — is any movement driving `field` active at this step? Used by
  // the sim's _syncRedoxEh to flip the redox sync to Eh-CANONICAL (Eh→O2) for
  // steps where a movement owns fluid.Eh, so the movement's Eh isn't clobbered
  // by the default O2→Eh sync before the engines read it. Accepts the dotted
  // path ('fluid.Eh') or the bare leaf ('Eh') a spec might use.
  drivesFieldAt(field: string, step: number): boolean {
    for (let i = 0; i < this.movements.length; i++) {
      const m = this.movements[i];
      if ((m.field === field || m.field === 'fluid.' + field || 'fluid.' + m.field === field)
          && step >= m.startStep && step < m.endStep) return true;
    }
    return false;
  }

  // Apply every active movement for this step. No-op (and zero draws) when
  // empty. Mutates `conditions` in place; the caller propagates the global
  // delta to per-ring fluids exactly as it does for discrete events.
  applyStep(conditions: any, step: number): void {
    if (!this.movements.length) return;              // <-- the sim-neutral fast path
    for (let i = 0; i < this.movements.length; i++) {
      const m = this.movements[i];
      const st = this._state[i];
      if (step < m.startStep || step >= m.endStep) continue;
      // Capture the baseline the first time this window is active.
      if (!st.started) {
        st.base = (typeof m.base === 'number') ? m.base : _movementGetField(conditions, m.field);
        st.started = true;
      }
      if (!Number.isFinite(st.base)) continue;       // field absent → skip safely
      const span = Math.max(1, m.endStep - m.startStep);
      const u = Math.max(0, Math.min(1, (step - m.startStep) / span));

      // Setpoint = base + deterministic ops [+ mixing lerp toward `to`].
      let setpoint = st.base + _evalMovementOps(m.ops, u);
      if (m.mix) {
        const f = _mvMixFraction(u, m.mix.ease !== false);
        setpoint = (1 - f) * setpoint + f * m.mix.to;
      }

      // OSCILLATION texture: Ornstein-Uhlenbeck mean-reversion around 0
      // (deviation from the setpoint). Mean-reverting per Holten 1997 — it
      // wobbles and returns, it does not wander. Draws from the DEDICATED
      // stream only when a texture is declared (still zero draws when off).
      if (m.texture) {
        const theta = Math.max(0, Math.min(1, m.texture.theta));
        const noise = (this.rng() * 2 - 1) * m.texture.sigma;
        st.ou += -theta * st.ou + noise;
      }
      let value = setpoint + st.ou;
      if (typeof m.clampMin === 'number') value = Math.max(m.clampMin, value);
      if (typeof m.clampMax === 'number') value = Math.min(m.clampMax, value);
      _movementSetField(conditions, m.field, value);
    }
  }
}

// Factory: build a controller for a sim. Reads the scenario's declared
// movements (absent → empty → no-op) and seeds the stream off the VUGG seed —
// the cavity's shape_seed by preference (geology drives outcome), falling back
// to the run seed. Phase 0: every scenario yields an empty controller.
function _createMovementController(sim: any): MovementController {
  const spec = sim && sim.conditions && sim.conditions._scenario
    ? sim.conditions._scenario.movements : undefined;
  const wall = sim && sim.conditions ? sim.conditions.wall : null;
  const vuggSeed = (((wall && wall.shape_seed) || (sim && sim._seed) || 0) | 0);
  return new MovementController(spec, vuggSeed);
}
