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

// Per-purpose salt for the THERMAL stream (ASCII "HEAT") — the ambient
// drift + thermal-pulse mechanic subsumed off the shared rng (T-reconciliation,
// 2026-06-10). Distinct from the movement salt so a scenario's declared
// movement specs never displace the ambient thermal cascade and vice versa.
const _THERMAL_SALT = 0x48454154;

// The dedicated thermal stream for ambient_cooling (85d). Two deliberate
// contrasts with _makeMovementRng above:
//
//   1. SEEDED FROM THE RUN, NOT THE CAVITY. Declared movements are GEOLOGY —
//      same cavity, same trajectory (shape_seed). Ambient cooling is WEATHER —
//      the default thermal noise a vug happens to experience, which should
//      vary play-to-play like every other ambient draw. So it derives from
//      `rng.state` captured at sim construction: a pure function of the run
//      seed (reproducible — baselines + crystal-cipher safe), zero shared
//      draws consumed, different per run seed.
//   2. SCRAMBLED, NOT BARE-XOR. Nearby run seeds XOR a constant give nearby
//      mulberry32 states whose early outputs correlate — measured in
//      tools/t-reconciliation-probe.mjs as collapsed cross-seed variance
//      (tutorial pulse count ±0.00, cooling meanT σ 10.8→2.7). One throwaway
//      draw avalanches the states apart (σ recovers to live levels).
function _makeThermalRng(sharedState: number): SeededRandom {
  const scramble = new SeededRandom((((sharedState | 0) ^ _THERMAL_SALT) >>> 0));
  return new SeededRandom(Math.floor(scramble.next() * 4294967296) >>> 0);
}

// ----------------------------------------------------------------
// THE KEYSTONE — per-(mineral, step) derived nucleation streams.
// PROPOSAL-PER-MINERAL-NUC-SEEDS.md, 2026-06-16. Closes LEDGER §A #12,
// unblocks #11 (held sphalerite/wurtzite redox gate).
// ----------------------------------------------------------------
// Per-purpose salt for the NUCLEATION streams (ASCII "NUC" + 0x01). Distinct
// from the movement + thermal salts so the three never alias.
const _NUC_SALT = 0x4e554301;

// THE FLAG. ON (default) is the keystone: each mineral nucleates from its OWN
// derived stream, so gating/adding one mineral can no longer displace another's
// nucleation cascade (the mottramite 96→47% class of bug). OFF reverts to the
// legacy single shared-`rng` cascade — kept ONLY for the dark-observe A/B probe
// (tools/nuc-seed-isolation-probe.mjs) and reversibility, NOT a player option.
let NUC_DERIVED_SEEDS = true;

// A fresh deterministic PRNG for ONE (mineral, step) pair. Mirrors
// _makeThermalRng's two deliberate choices (see its header), extended with the
// mineral identity + the step:
//
//   1. RUN-SEED LINEAGE, not the cavity. Nucleation realization is WEATHER —
//      it should vary play-to-play (the 200-seed canary sweep wants 200 distinct
//      realizations), so the base is `sharedState` = rng.state captured at sim
//      construction (a pure function of the run seed, zero shared draws).
//   2. SCRAMBLED, not bare-XOR (the 15th catch). The FNV-1a fold of the mineral
//      key + step already avalanches far more than the thermal bare-XOR did, but
//      adjacent steps of one mineral still differ by a single int — so we keep
//      the same one-throwaway-draw scramble _makeThermalRng uses, belt-and-braces.
//
// The KEY is the nucleation function's own name ("_nuc_<mineral>") — stable,
// unique per nucleation function, and free of 140 hand-typed mineral strings.
// The seed need only be unique+deterministic per nuc-function; it does NOT have
// to match the minerals.json key, so fn.name is the ideal handle.
function _makeNucRng(sharedState: number, mineralKey: string, step: number): SeededRandom {
  let h = (((sharedState | 0) ^ _NUC_SALT) >>> 0);
  for (let i = 0; i < mineralKey.length; i++) {
    h = (Math.imul(h ^ mineralKey.charCodeAt(i), 0x01000193)) >>> 0;   // FNV-1a fold
  }
  h = (Math.imul(h ^ (step | 0), 0x01000193)) >>> 0;
  const scramble = new SeededRandom(h >>> 0);                          // scramble — avalanche
  return new SeededRandom(Math.floor(scramble.next() * 4294967296) >>> 0);
}

// The dispatch wrapper the 14 _nucleateClass_* iterators route every
// _nuc_<mineral> call through. Swaps the shared global `rng` to that mineral's
// private (mineral, step) stream for the WHOLE call — capturing both the
// substrate-pick draws in the _nuc_ body AND the cell/ring/twin/fill-dampener
// draws inside sim.nucleate() — then restores. Restoring means nucleation no
// longer advances the shared stream at all (the growth loop's rng.uniform jitter
// then reads a position independent of nucleation count — a free extra decoupling).
//
// fn.name is "_nuc_<mineral>"; the build is a non-minifying concat (148 modules)
// and tsc/vitest preserve names, so the key is stable across runtimes.
const _NUCLEATION_PROBE_REGISTRY: Record<string, (sim: any) => void> = {};
let _REGISTER_NUCLEATORS_ONLY = false;

const _NUCLEATION_PROBE_ALIASES: Record<string, string[]> = {
  // These dispatchers intentionally evaluate several siblings in one
  // production function so priority and shared-pool competition stay atomic.
  _nuc_spodumene: [
    'spodumene', 'emerald', 'morganite', 'heliodor', 'aquamarine', 'beryl',
    'ruby', 'sapphire', 'corundum',
  ],
  _nuc_stolzite: ['stolzite', 'raspite'],
};

function _registerNucleatorForProbe(fn: (sim: any) => void, aliases: string[] | null = null): void {
  if (typeof fn !== 'function') return;
  const inferred = fn.name.startsWith('_nuc_') ? fn.name.slice(5) : '';
  const names = aliases || _NUCLEATION_PROBE_ALIASES[fn.name] || (inferred ? [inferred] : []);
  for (const name of names) _NUCLEATION_PROBE_REGISTRY[name] = fn;
}

interface ProductionNucleationDecisionProbe {
  available: boolean;
  deterministicEligible: boolean;
  stochastic: boolean;
  randomDraws: number;
  source: string | null;
  attempts: Array<{ mineral: string; position: string; sigma: number }>;
  competingBirth: string | null;
  error?: string;
}

interface ProductionNucleationDecisionAssessment {
  available: boolean;
  eligible: boolean;
  stochasticBirth: boolean;
  effectiveDrawProbability: number | null;
  randomDraws: number;
  source: string | null;
  competingBirth: string | null;
  blockers: string[];
}

function _scenarioSpeciesExclusion(sim: any, name: string): string | null {
  const reason = sim?.conditions?._scenario?.excluded_species?.[name];
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

function _scenarioPositiveLicenseBlock(sim: any, name: string): string | null {
  const scenarioId = sim?.conditions?._scenario?.id;
  if (!scenarioId) return null; // Creative/custom broth: every engine remains available.
  const spec = (typeof MINERAL_SPEC !== 'undefined') ? MINERAL_SPEC?.[name] : null;
  if (!spec?._requires_scenario_license) return null;
  const licensed = Array.isArray(spec.scenarios) ? spec.scenarios : [];
  if (licensed.includes(scenarioId)) return null;
  return `no locality license for ${name} in ${scenarioId}; chemistry alone does not prove occurrence (Creative mode remains unrestricted)`;
}

function _scenarioNucleationWindowBlock(sim: any, name: string): string | null {
  const window = sim?.conditions?._scenario?.nucleation_windows?.[name];
  if (!window || typeof window !== 'object') return null;
  // VugSimulator increments `step` before applying events and nucleating, so
  // its live step number already matches the authored event declarations.
  // Do not add one here: that would open a window one cycle before its pulse.
  const authoredStep = Number(sim?.step) || 0;
  const start = Number(window.start_step);
  const end = Number(window.end_step);
  if (Number.isFinite(start) && authoredStep < start) {
    return `authored paragenesis opens at step ${start} (current step ${authoredStep})`;
  }
  if (Number.isFinite(end) && authoredStep > end) {
    return `authored paragenesis closed after step ${end} (current step ${authoredStep})`;
  }
  return null;
}

// Read-only best-case execution of the actual production nucleator. Every RNG
// draw returns zero, which passes the codebase's Bernoulli gates while leaving
// all deterministic sigma, active/total, cap, host, and priority predicates
// untouched. No live RNG, crystal, fluid, log, or counter state is mutated.
// This makes the hover panel answer whether production CAN call nucleate() now,
// then separately disclose that the real path still contains stochastic draws.
function productionNucleationDecisionProbe(
  name: string,
  sim: any,
  options: { randomValue?: number; targetSigma?: number; crystalMode?: 'current' | 'inactive-target' | 'remove-target' } = {},
): ProductionNucleationDecisionProbe {
  const fn = _NUCLEATION_PROBE_REGISTRY[name];
  const unavailable: ProductionNucleationDecisionProbe = {
    available: false,
    deterministicEligible: false,
    stochastic: false,
    randomDraws: 0,
    source: fn?.name || null,
    attempts: [],
    competingBirth: null,
  };
  if (!fn || !sim || !Array.isArray(sim.crystals) || !sim.conditions
      || typeof sim._atNucleationCap !== 'function') return unavailable;

  const attempts: Array<{ mineral: string; position: string; sigma: number }> = [];
  const probe = Object.assign(Object.create(Object.getPrototypeOf(sim)), sim);
  const crystalMode = options.crystalMode || 'current';
  probe.crystals = sim.crystals
    .filter((cr: any) => crystalMode !== 'remove-target' || cr.mineral !== name)
    .map((cr: any) => ({
    ...cr,
    ...(crystalMode === 'inactive-target' && cr.mineral === name ? { active: false } : {}),
    zones: Array.isArray(cr.zones) ? cr.zones.map((zone: any) => ({ ...zone })) : [],
    phase_transition_history: Array.isArray(cr.phase_transition_history)
      ? cr.phase_transition_history.map((row: any) => ({ ...row })) : [],
  }));
  probe.conditions = Object.assign(Object.create(Object.getPrototypeOf(sim.conditions)), sim.conditions);
  probe.conditions.fluid = sim.conditions.fluid;
  if (Number.isFinite(options.targetSigma)) {
    probe.conditions[`supersaturation_${name}`] = () => Number(options.targetSigma);
  }
  probe.log = [];
  probe.crystal_counter = Number(sim.crystal_counter) || probe.crystals.length;
  const mineralBeforeProbe = probe.crystals.map((cr: any) => cr?.mineral);
  probe.nucleate = (mineral: string, position = 'vug wall', sigma = 1) => {
    const birth = { mineral, position, sigma: Number(sigma), crystal_id: ++probe.crystal_counter };
    attempts.push({ mineral, position, sigma: Number(sigma) });
    const fake: any = {
      ...birth,
      active: true,
      dissolved: false,
      enclosed_by: null,
      zones: [],
      total_growth_um: 0,
      habit: 'probe',
      dominant_forms: [],
    };
    probe.crystals.push(fake);
    return fake;
  };

  const saved = rng;
  let randomDraws = 0;
  const probeRng = new SeededRandom(0);
  const randomValue = Math.max(0, Math.min(0.999999999, Number(options.randomValue) || 0));
  const fixed = () => { randomDraws++; return randomValue; };
  probeRng.random = fixed;
  probeRng.next = fixed;
  probeRng.uniform = (lo: number, hi: number) => { randomDraws++; return lo + randomValue * (hi - lo); };
  rng = probeRng;
  try {
    fn(probe);
  } catch (error) {
    return {
      ...unavailable,
      available: true,
      randomDraws,
      source: fn.name,
      attempts,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    rng = saved;
  }
  const deterministicEligible = attempts.some(attempt => attempt.mineral === name)
    || probe.crystals.some((cr: any, index: number) => cr?.mineral === name
      && mineralBeforeProbe[index] != null && mineralBeforeProbe[index] !== name);
  const competing = attempts.find(attempt => attempt.mineral !== name)?.mineral || null;
  return {
    available: true,
    deterministicEligible,
    stochastic: deterministicEligible && randomDraws > 0,
    randomDraws,
    source: fn.name,
    attempts,
    competingBirth: deterministicEligible ? null : competing,
  };
}

// Explain the deterministic and stochastic parts of the production decision
// by counterfactually rerunning that same nucleator against cloned state. This
// avoids maintaining a second handwritten table of quartz-style repeat gates.
function assessProductionNucleationDecision(
  name: string,
  sim: any,
  sigma: number,
  sigmaCrit: number,
): ProductionNucleationDecisionAssessment {
  const localityExclusion = _scenarioSpeciesExclusion(sim, name);
  if (localityExclusion) {
    return {
      available: true,
      eligible: false,
      stochasticBirth: false,
      effectiveDrawProbability: null,
      randomDraws: 0,
      source: 'scenario-locality exclusion',
      competingBirth: null,
      blockers: [`locality evidence excludes this phase: ${localityExclusion}`],
    };
  }
  const licenseBlock = _scenarioPositiveLicenseBlock(sim, name);
  if (licenseBlock) {
    return {
      available: true,
      eligible: false,
      stochasticBirth: false,
      effectiveDrawProbability: null,
      randomDraws: 0,
      source: 'scenario locality license',
      competingBirth: null,
      blockers: [licenseBlock],
    };
  }
  const scenarioWindowBlock = _scenarioNucleationWindowBlock(sim, name);
  if (scenarioWindowBlock) {
    return {
      available: true,
      eligible: false,
      stochasticBirth: false,
      effectiveDrawProbability: null,
      randomDraws: 0,
      source: 'scenario paragenetic window',
      competingBirth: null,
      blockers: [scenarioWindowBlock],
    };
  }
  const requiredSubstrate = (typeof MINERAL_GATES_REGISTRY !== 'undefined')
    ? MINERAL_GATES_REGISTRY?.[name]?.required_substrate : null;
  if (requiredSubstrate) {
    const candidates = typeof executableSubstrateCandidates === 'function'
      ? executableSubstrateCandidates(name, sim.crystals || []) : [];
    if (!candidates.some((candidate: any) => candidate.host?.mineral === requiredSubstrate)) {
      return {
        available: true,
        eligible: false,
        stochasticBirth: false,
        effectiveDrawProbability: null,
        randomDraws: 0,
        source: 'required transformation precursor',
        competingBirth: null,
        blockers: [`requires an active exposed ${requiredSubstrate} precursor; fluid supersaturation alone cannot create ${name}`],
      };
    }
  }
  const best = productionNucleationDecisionProbe(name, sim, { randomValue: 0 });
  const result: ProductionNucleationDecisionAssessment = {
    available: best.available,
    eligible: best.deterministicEligible,
    stochasticBirth: false,
    effectiveDrawProbability: null,
    randomDraws: best.randomDraws,
    source: best.source,
    competingBirth: best.competingBirth,
    blockers: [],
  };
  if (!best.available) return result;

  if (best.deterministicEligible) {
    const worst = productionNucleationDecisionProbe(name, sim, { randomValue: 0.999999999 });
    result.stochasticBirth = !worst.deterministicEligible;
    if (result.stochasticBirth) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const trial = productionNucleationDecisionProbe(name, sim, { randomValue: mid });
        if (trial.deterministicEligible) lo = mid;
        else hi = mid;
      }
      result.effectiveDrawProbability = Math.round(lo * 1000) / 1000;
    }
    return result;
  }

  const active = sim.crystals.filter((cr: any) => cr?.mineral === name && cr.active && !cr.dissolved).length;
  const total = sim.crystals.filter((cr: any) => cr?.mineral === name).length;
  const inactiveTarget = productionNucleationDecisionProbe(name, sim, {
    randomValue: 0,
    crystalMode: 'inactive-target',
  });
  const removedTarget = productionNucleationDecisionProbe(name, sim, {
    randomValue: 0,
    crystalMode: 'remove-target',
  });
  if (inactiveTarget.deterministicEligible) {
    result.blockers.push(`active-crystal rule blocks at ${active} active (${total} total)`);
  } else if (removedTarget.deterministicEligible) {
    result.blockers.push(`total/history rule blocks at ${total} recorded crystal${total === 1 ? '' : 's'}`);
  }

  const high = Math.max(Number(sigma) + 32, Number(sigmaCrit) + 32, 32);
  const highProbe = productionNucleationDecisionProbe(name, sim, { randomValue: 0, targetSigma: high });
  if (sigma > sigmaCrit && highProbe.deterministicEligible) {
    let lo = Math.max(Number(sigma) || 0, Number(sigmaCrit) || 0), hi = high;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const trial = productionNucleationDecisionProbe(name, sim, { randomValue: 0, targetSigma: mid });
      if (trial.deterministicEligible) hi = mid;
      else lo = mid;
    }
    result.blockers.push(`repeat/secondary saturation rule requires σ > ${hi.toFixed(3)}`);
  }
  if (best.competingBirth) {
    result.blockers.push(`${best.competingBirth} takes the shared family-priority slot first`);
  }
  if (!result.blockers.length) {
    result.blockers.push('another deterministic production predicate blocks this nucleator');
  }
  return result;
}

function _runNuc(sim: any, fn: (sim: any) => void): void {
  _registerNucleatorForProbe(fn);
  if (_REGISTER_NUCLEATORS_ONLY) return;
  const inferred = fn.name.startsWith('_nuc_') ? fn.name.slice(5) : '';
  if (inferred && _scenarioSpeciesExclusion(sim, inferred)) return;
  if (inferred && _scenarioPositiveLicenseBlock(sim, inferred)) return;
  if (inferred && _scenarioNucleationWindowBlock(sim, inferred)) return;
  if (!NUC_DERIVED_SEEDS) { fn(sim); return; }
  const saved = rng;
  rng = _makeNucRng(sim._nucSharedState | 0, fn.name, sim.step | 0);
  try { fn(sim); } finally { rng = saved; }
}

// Setter so the dark-observe A/B probe (tools/nuc-seed-isolation-probe.mjs) and
// the permanent isolation regression test can flip the keystone at runtime —
// mirrors the harness's setSeed pattern for the bundle-scoped `rng`. Not a
// player control. Returns the previous value so callers can restore it.
function _setNucDerivedSeeds(on: boolean): boolean {
  const prev = NUC_DERIVED_SEEDS;
  NUC_DERIVED_SEEDS = !!on;
  return prev;
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
  if (o != null) {
    o[parts[parts.length - 1]] = path === 'pressure'
      ? clampFluidPressureKbar(value)
      : value;
  }
}

// The controller holds the parsed movements + the dedicated rng + per-movement
// state (captured base + the OU texture value). An EMPTY controller is a total
// no-op: applyStep returns before touching `conditions` or drawing any random
// number — this is what keeps the dark scaffold byte-identical.
class MovementController {
  movements: MovementSpec[];
  rng: () => number;
  _state: { base: number; ou: number; started: boolean; originCell: number }[];

  constructor(movements: MovementSpec[] | undefined, vuggSeed: number) {
    // Own the list. Creative mode can append a trajectory while older ones are
    // already active; sharing the scenario array would make a push happen
    // twice when the controller is updated explicitly.
    this.movements = Array.isArray(movements) ? movements.slice() : [];
    this.rng = _makeMovementRng(vuggSeed);
    // originCell -1 = unresolved; resolved once at first window activation for
    // origin:'cell' movements (Phase 2c), then pinned (stable across steps).
    this._state = this.movements.map(() => ({ base: 0, ou: 0, started: false, originCell: -1 }));
  }

  get isEmpty(): boolean { return this.movements.length === 0; }

  // Append without rebuilding the controller. Rebuilding would restart the
  // dedicated RNG stream and discard captured baselines / OU texture for every
  // trajectory that was already under way.
  addMovement(movement: MovementSpec): void {
    this.movements.push(movement);
    this._state.push({ base: 0, ou: 0, started: false, originCell: -1 });
  }

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
  //
  // `sim` (Phase 2c) is the optional simulator handle, used ONLY by
  // origin:'cell' movements to reach the mesh + the seeded fluid-spot set.
  // When absent (the legacy 2-arg call from unit tests), every movement uses
  // the global path — so origin:'cell' degrades safely to origin:'global'.
  applyStep(conditions: any, step: number, sim?: any): void {
    if (!this.movements.length) return;              // <-- the sim-neutral fast path
    for (let i = 0; i < this.movements.length; i++) {
      const m = this.movements[i];
      const st = this._state[i];
      if (step < m.startStep || step >= m.endStep) continue;
      // Capture the baseline the first time this window is active.
      if (!st.started) {
        st.base = (typeof m.base === 'number') ? m.base : _movementGetField(conditions, m.field);
        st.started = true;
        // SPATIAL origin (Phase 2c): resolve + pin the injection cell ONCE,
        // here at first activation, so it's stable and the (single) movement-
        // stream draw lands in a predictable place. Only for origin:'cell'
        // movements with a sim handle — global movements never draw here.
        if (m.origin === 'cell' && sim) st.originCell = this._resolveOriginCell(i, sim);
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

      if (conditions?._carbonateBoundaryState
          && (m.field === 'fluid.CO3' || m.field === 'fluid.pH')) {
        conditions._pending_carbonate_boundary_violation = {
          kind: 'movement_boundary_violation',
          attemptedKind: 'movement',
          field: m.field,
          step,
          error: m.field === 'fluid.CO3'
            ? 'movement_DIC_requires_explicit_recharge'
            : 'movement_pH_requires_explicit_alkalinity_capacity',
        };
        continue;
      }

      // SPATIAL origin (Phase 2c): instead of SETTING the bulk field (global),
      // pin ONE seeded origin cell's per-vertex fluid to `value` — a fixed-
      // composition feeder — and let the step-end _diffuseRingState carry it
      // outward across mesh cells (a near→far gradient = one-sided growth, the
      // Punjab hematite-on-one-side specimen). NB per 85c:152-168 the per-cell
      // mesh fluids are DECOUPLED from ring_fluids/conditions.fluid, so this
      // injection is seen by the strip + the per-vertex nucleation sampler
      // (which read mesh.cells), NOT the legacy ring-fluid nucleation gate —
      // crystal CLUSTERING near a feeder is the separate deposition bias (2c.2).
      // The caller's _propagateGlobalDelta is a no-op for this movement because
      // we never touched `conditions` here. Falls back to the global set if the
      // mesh isn't resolvable (headless edge) so the movement still does work.
      if (m.origin === 'cell' && sim && this._injectCellField(sim, st.originCell, m.field, value)) {
        continue;
      }
      _movementSetField(conditions, m.field, value);
    }
  }

  // Resolve the origin (injection) cell for movement i. Preference order:
  //   explicit m.originCell  →  the most EQUATORIAL open fluid-spot  →  the naive
  //   _pickOriginCell (any wall cell). A fluid-spot IS the geological home of a
  //   feeder (js/85k), so an origin:'cell' movement enters where the plumbing
  //   connects. Among open feeders we pick the one with the highest ring area
  //   weight (sin φ — most equatorial): it delivers fluid to the most cavity wall
  //   AND is where crystals actually form (polar rings are area-starved), so the
  //   injected halo COINCIDES with the deposition cluster (2c.2b) instead of
  //   landing at a near-polar feeder with no crystals. Deterministic given the
  //   seeded spot set — no draw from the movement stream (the geometry decides).
  _resolveOriginCell(i: number, sim: any): number {
    const m = this.movements[i];
    if (typeof m.originCell === 'number') return m.originCell | 0;
    const field = sim && sim._fluidSpots;
    const open = field && !field.isEmpty ? field.openSpots() : [];
    if (open && open.length) {
      const ws = sim && sim.wall_state;
      const N = (ws && ws.cells_per_ring) | 0;
      const areaW = (cell: number) =>
        (ws && typeof ws.ringAreaWeight === 'function' && N > 0) ? ws.ringAreaWeight((cell / N) | 0) : 1;
      let best = open[0], bestW = areaW(open[0].cell);
      for (let k = 1; k < open.length; k++) {
        const w = areaW(open[k].cell);
        if (w > bestW + 1e-9) { best = open[k]; bestW = w; }
      }
      return best.cell | 0;
    }
    const mesh = sim && sim.wall_state && sim.wall_state.meshFor ? sim.wall_state.meshFor(sim) : null;
    const n = mesh && mesh.cells ? mesh.cells.length : 1;
    return _pickOriginCell(this.rng, n);
  }

  // Pin a single mesh cell's per-vertex fluid field to `value` (the feeder
  // source composition). Returns false (→ caller uses the global path) when the
  // mesh / cell / field can't be resolved. Sets the LEAF of a dotted field
  // ('fluid.pH' → 'pH'); the per-cell fluid is a flat FluidChemistry.
  _injectCellField(sim: any, idx: number, field: string, value: number): boolean {
    if (!(idx >= 0)) return false;
    const mesh = sim && sim.wall_state && sim.wall_state.meshFor ? sim.wall_state.meshFor(sim) : null;
    if (!mesh || !mesh.cells || idx >= mesh.cells.length) return false;
    const cell = mesh.cells[idx];
    const fluid = cell ? cell.fluid : null;
    if (!fluid) return false;
    const dot = field.lastIndexOf('.');
    const leaf = dot >= 0 ? field.slice(dot + 1) : field;
    if (typeof fluid[leaf] !== 'number') return false;
    fluid[leaf] = value;
    return true;
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
