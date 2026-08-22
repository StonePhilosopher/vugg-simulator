// ============================================================
// js/44-graduated-competition.ts — graduated competition allocation
// ============================================================
// v128 lands the algorithm. v128a (this commit) ships the math + tests
// with the flag GRADUATED_COMPETITION_ENABLED off (v127 byte-identical
// baselines preserved). v128b wires it into the run-step growth loop.
// v128c flips the flag and regenerates baselines.
//
// Per proposals/PROPOSAL-INITIATIVE-VARIABLE.md §3.1 rev 2:
//
//   1. For each mineral with σ > 0, calculate base initiative + modifiers
//      (js/43-initiative.ts handles this — we consume the result here)
//   2. Compute desired growth per crystal (engine dry-run; caller's job)
//   3. For each species (cation/anion C):
//      - Sum desired debit across all firing crystals using C
//      - If desired[C] ≤ fluid[C]: no rationing for C — every crystal
//        gets its full share on this species
//      - If desired[C] > fluid[C]: ration via initiative:
//        * gap = max(initiative) − min(initiative) among crystals wanting C
//        * Small gap (≤ GRADUATED_GAP_THRESHOLD): power-law sharing
//          share_i ∝ max(0, initiative_i)^k where k = GRADUATED_POWER_LAW_K
//        * Large gap (> GRADUATED_GAP_THRESHOLD): winner-takes-most
//          top initiative gets GRADUATED_WINNER_TAKES_FRAC; others split
//          the remaining (1 − that) proportional to their initiative^k
//   4. Per crystal: final scaling = min over its species of (allowed/desired)
//      This is Liebig's-law-of-the-minimum — the most constrained species
//      caps growth.
//
// Why power-law k=2 (not linear, not softmax): see proposal §3.1.1.
// Linear sharing under-dominates the higher initiative (50/50 at 12-vs-11);
// softmax requires calibrating a temperature parameter; power-law k=2
// gives ~56/44 at 12-vs-11 and ~78/22 at 15-vs-8 — physically intuitive
// and stable to recalibrate.
//
// Why a hard gap threshold for winner-takes-most: the v125-v126 cascade
// record shows that when initiative gaps are very large, the engine
// effectively HAS picked a winner anyway — the loser would have been
// at σ near σ_crit, fragile to displacement. The hard gap mirrors that
// reality: small differences smooth out, large differences resolve.
//
// Tiebreaking when initiatives are exactly equal: higher σ wins (more
// growth potential goes first); then registry order (deterministic).

// ---- Tuning constants ----
//
// All exposed as `let` so calibration sweeps in v129 can rebind them
// without rebuilding. Defaults are the proposal's initial estimates.

let GRADUATED_COMPETITION_ENABLED = true;      // v128c: ON. Per-cell rationing drives growth.
let GRADUATED_GAP_THRESHOLD       = 3;          // initiative units; above this, winner-takes-most
let GRADUATED_POWER_LAW_K         = 2;          // exponent for proportional regime
let GRADUATED_WINNER_TAKES_FRAC   = 0.8;        // top initiative's share when gap > threshold

// Setter functions — the bundle wraps top-level `let`/`const` in a
// closure, so external callers (tests, DevTools, calibration sweeps)
// cannot mutate the bindings directly. These setters keep the bundle's
// internal references in sync. Mirrors the setSeed epilogue in
// tests-js/setup.ts.

function setGraduatedCompetitionEnabled(v: boolean): void {
  GRADUATED_COMPETITION_ENABLED = !!v;
}
function setGraduatedGapThreshold(v: number): void {
  GRADUATED_GAP_THRESHOLD = +v;
}
function setGraduatedPowerLawK(v: number): void {
  GRADUATED_POWER_LAW_K = +v;
}
function setGraduatedWinnerTakesFrac(v: number): void {
  GRADUATED_WINNER_TAKES_FRAC = +v;
}

// ---- Types ----
//
// CrystalDryRun captures what one crystal's engine would have produced
// under unconstrained fluid. The caller computes these by snapshotting
// the cell's fluid and running engines without growth budget.

interface CrystalDryRun {
  crystal_id: number;
  mineral: string;
  sigma: number;
  initiative: number;          // from js/43-initiative.ts computeInitiative
  desired_thickness_um: number;
  debit_per_species: Record<string, number>;  // mg/kg demand for the requested physical zone
}

interface GraduatedAllocation {
  crystal_id: number;
  scaling: number;             // in [0, 1] — multiply desired_thickness_um by this
  limiting_species: string | null;  // which species capped growth (Liebig); null if no rationing
  requested_per_species: Record<string, number>;
  allocated_per_species: Record<string, number>;
  allocation_rounds: number;
  why: string;                 // human-readable trace line
}

// ---- Per-species share computation ----
//
// Given the list of CrystalDryRuns wanting a single species `sp`, and
// the available fluid amount for that species, returns a Map of
// crystal_id → share_fraction (0-1, summing to ≤ 1 across the group).

function _computeSpeciesShares(
  runs: CrystalDryRun[],
  sp: string,
  available: number,
): Map<number, number> {
  const shares = new Map<number, number>();
  if (!runs.length) return shares;

  // Total demand for this species.
  let totalDemand = 0;
  for (const r of runs) totalDemand += (r.debit_per_species[sp] || 0);
  if (totalDemand <= 0) {
    for (const r of runs) shares.set(r.crystal_id, 0);
    return shares;
  }

  // No rationing — every crystal gets its full debit on this species.
  // share_i = debit_i / totalDemand is what each crystal needs as a
  // fraction of the demanded pool; we hand back that fraction to the
  // caller (Liebig step divides allowed/desired so this matches up).
  if (available >= totalDemand) {
    for (const r of runs) {
      const d = r.debit_per_species[sp] || 0;
      shares.set(r.crystal_id, d / totalDemand);
    }
    return shares;
  }

  // Rationing required. Initiative-weighted shares.
  const ks = runs.map(r => Math.max(0, r.initiative));
  const maxI = Math.max(...ks);
  const minI = Math.min(...ks);
  const gap = maxI - minI;

  // Tiebreak: higher σ first if initiatives identical, then registry
  // order. Used only when picking the "winner" in large-gap mode.
  const ranked = runs.slice().sort((a, b) => {
    const ai = Math.max(0, a.initiative);
    const bi = Math.max(0, b.initiative);
    if (bi !== ai) return bi - ai;
    if (b.sigma !== a.sigma) return b.sigma - a.sigma;
    return a.crystal_id - b.crystal_id;
  });

  if (gap > GRADUATED_GAP_THRESHOLD && maxI > 0) {
    // Winner-takes-most. Top crystal gets WINNER_FRAC; remaining split
    // the rest power-law-weighted.
    const winner = ranked[0];
    shares.set(winner.crystal_id, GRADUATED_WINNER_TAKES_FRAC);

    const rest = ranked.slice(1);
    if (rest.length === 0) return shares;

    let restTotal = 0;
    const restWeights: number[] = [];
    for (const r of rest) {
      const w = Math.pow(Math.max(0, r.initiative), GRADUATED_POWER_LAW_K);
      restWeights.push(w);
      restTotal += w;
    }
    const remaining = 1.0 - GRADUATED_WINNER_TAKES_FRAC;
    if (restTotal > 0) {
      for (let i = 0; i < rest.length; i++) {
        shares.set(rest[i].crystal_id, (restWeights[i] / restTotal) * remaining);
      }
    } else {
      // All others have zero initiative — equal split of the remaining.
      const eq = remaining / rest.length;
      for (const r of rest) shares.set(r.crystal_id, eq);
    }
    return shares;
  }

  // Small-gap regime: pure power-law.
  let denom = 0;
  const weights: number[] = [];
  for (const r of ranked) {
    const w = Math.pow(Math.max(0, r.initiative), GRADUATED_POWER_LAW_K);
    weights.push(w);
    denom += w;
  }
  if (denom <= 0) {
    // Pathological: every initiative ≤ 0. Equal split — they all tried,
    // none has any advantage.
    const eq = 1.0 / ranked.length;
    for (const r of ranked) shares.set(r.crystal_id, eq);
    return shares;
  }
  for (let i = 0; i < ranked.length; i++) {
    shares.set(ranked[i].crystal_id, weights[i] / denom);
  }
  return shares;
}

// ---- Public API: computeGraduatedAllocations ----
//
// Top-level entry point. Returns a per-crystal scaling factor in [0, 1]
// that the caller multiplies by `desired_thickness_um` to get the actual
// growth this step under graduated competition.
//
// Inputs:
//   runs   — every crystal's dry-run output (only firing ones, σ > 0)
//   fluid  — the species pool the crystals are competing for (per-cell
//            fluid object; only the keys this batch of runs touches matter)
//
// Output:
//   Map<crystal_id, GraduatedAllocation>
//
// Determinism: this function is pure in its OUTPUT. Same inputs → same
// outputs. No RNG, no I/O. The only global it touches is _gradCompStats,
// an observer-only telemetry counter the engine never reads back.

// v177 observer-only telemetry — how often graduated rationing BINDS.
// Reset + read by tools/graduated-binding-probe.mjs; never read by the
// engine, no RNG draws, zero effect on sim output. Added alongside the
// v177 cell-key fix so "does rationing ever bind at seed 42?" is a
// measured fact instead of an assumption.
const _gradCompStats = {
  calls: 0,               // computeGraduatedAllocations invocations (= groups)
  multiCrystalGroups: 0,  // groups with 2+ crystals (contention possible)
  maxGroupSize: 0,
  allocations: 0,         // per-crystal allocation decisions
  bound: 0,               // allocations scaled below 0.999 (rationing bit)
  minScaling: 1.0,
  reset() {
    this.calls = 0; this.multiCrystalGroups = 0; this.maxGroupSize = 0;
    this.allocations = 0; this.bound = 0; this.minScaling = 1.0;
  },
};

function computeGraduatedAllocations(
  runs: CrystalDryRun[],
  fluid: Record<string, number>,
): Map<number, GraduatedAllocation> {
  const out = new Map<number, GraduatedAllocation>();
  _gradCompStats.calls++;
  if (runs.length > 1) _gradCompStats.multiCrystalGroups++;
  if (runs.length > _gradCompStats.maxGroupSize) _gradCompStats.maxGroupSize = runs.length;
  if (!runs.length) return out;

  const availablePool = (speciesName: string) => (
    speciesName === 'SiO2' && typeof (fluid as any).reactiveSilicaPpm === 'function'
      ? (fluid as any).reactiveSilicaPpm()
      : fluid[speciesName] ?? 0
  );

  // Collect species touched by any crystal.
  const species = new Set<string>();
  for (const r of runs) {
    for (const sp of Object.keys(r.debit_per_species)) {
      if ((r.debit_per_species[sp] || 0) > 0) species.add(sp);
    }
  }

  // Allocate in residual rounds. A one-pass Liebig minimum can strand a
  // shared reagent: if phase A receives Ca and P but P caps A, its unused Ca
  // allocation must be offered to phase B. Each round allocates only the
  // still-unfilled formula amount. Once any required cofactor is exhausted,
  // that phase leaves all other species contests, allowing the remaining
  // chemically viable phases to consume the residual pool.
  const EPS = 1e-12;
  const remainingPool: Record<string, number> = {};
  for (const sp of species) {
    const amount = Number(availablePool(sp));
    remainingPool[sp] = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }
  const scalingById = new Map<number, number>();
  const limitingById = new Map<number, string | null>();
  const roundsById = new Map<number, number>();
  const sourceById = new Map<number, CrystalDryRun>();
  for (const r of runs) {
    sourceById.set(r.crystal_id, r);
    scalingById.set(r.crystal_id, 0);
    limitingById.set(r.crystal_id, null);
    roundsById.set(r.crystal_id, 0);
  }

  const maxRounds = Math.min(256, Math.max(4, runs.length * Math.max(1, species.size) + 4));
  for (let round = 1; round <= maxRounds; round++) {
    const active: CrystalDryRun[] = [];
    for (const r of runs) {
      const done = scalingById.get(r.crystal_id) || 0;
      if (done >= 1 - EPS) continue;
      // Formula growth is impossible when even one required residual species
      // is exhausted. Excluding it here is the redistribution step.
      const blockedSpecies = Object.keys(r.debit_per_species).find(sp =>
        (r.debit_per_species[sp] || 0) * (1 - done) > EPS
        && (remainingPool[sp] || 0) <= EPS,
      );
      const cofactorBlocked = blockedSpecies !== undefined;
      if (cofactorBlocked && limitingById.get(r.crystal_id) === null) {
        limitingById.set(r.crystal_id, blockedSpecies || null);
      }
      if (!cofactorBlocked) active.push(r);
    }
    if (!active.length) break;

    const residualRuns: CrystalDryRun[] = active.map(r => {
      const remainingFraction = 1 - (scalingById.get(r.crystal_id) || 0);
      const residualDebit: Record<string, number> = {};
      const source = sourceById.get(r.crystal_id) || r;
      for (const [sp, debit] of Object.entries(source.debit_per_species)) {
        if (debit > 0) residualDebit[sp] = debit * remainingFraction;
      }
      return Object.assign({}, r, { debit_per_species: residualDebit });
    });

    const allowedBySpecies: Record<string, Map<number, number>> = {};
    for (const sp of species) {
      const wanting = residualRuns.filter(r => (r.debit_per_species[sp] || 0) > EPS);
      if (!wanting.length) continue;
      const available = remainingPool[sp] || 0;
      const demand = wanting.reduce((sum, r) => sum + (r.debit_per_species[sp] || 0), 0);
      const allowed = new Map<number, number>();
      if (available + EPS >= demand) {
        for (const r of wanting) allowed.set(r.crystal_id, r.debit_per_species[sp] || 0);
      } else {
        const shares = _computeSpeciesShares(wanting, sp, available);
        for (const r of wanting) {
          allowed.set(r.crystal_id, (shares.get(r.crystal_id) || 0) * available);
        }
      }
      allowedBySpecies[sp] = allowed;
    }

    let progress = 0;
    const incrementById = new Map<number, number>();
    for (const r of residualRuns) {
      let increment = 1;
      let limiting: string | null = null;
      for (const sp of Object.keys(r.debit_per_species)) {
        const demand = r.debit_per_species[sp] || 0;
        if (demand <= EPS) continue;
        const allowed = allowedBySpecies[sp]?.get(r.crystal_id) || 0;
        const ratio = Math.max(0, Math.min(1, allowed / demand));
        if (ratio < increment - EPS) {
          increment = ratio;
          limiting = sp;
        }
      }
      incrementById.set(r.crystal_id, increment);
      if (increment < 1 - EPS && limiting !== null) limitingById.set(r.crystal_id, limiting);
    }

    // Apply the simultaneous round only after every share was calculated.
    for (const r of residualRuns) {
      const before = scalingById.get(r.crystal_id) || 0;
      const residualFraction = 1 - before;
      const increment = incrementById.get(r.crystal_id) || 0;
      const formulaIncrement = residualFraction * increment;
      if (formulaIncrement <= EPS) continue;
      scalingById.set(r.crystal_id, Math.min(1, before + formulaIncrement));
      roundsById.set(r.crystal_id, round);
      progress += formulaIncrement;
      const source = sourceById.get(r.crystal_id) || r;
      for (const [sp, debit] of Object.entries(source.debit_per_species)) {
        if (debit <= 0) continue;
        remainingPool[sp] = Math.max(0, (remainingPool[sp] || 0) - debit * formulaIncrement);
      }
    }
    if (progress <= EPS) break;
  }

  for (const r of runs) {
    const scaling = Math.max(0, Math.min(1, scalingById.get(r.crystal_id) || 0));
    const limiting = scaling < 1 - EPS ? (limitingById.get(r.crystal_id) || null) : null;
    const requested: Record<string, number> = {};
    const allocated: Record<string, number> = {};
    for (const [sp, debit] of Object.entries(r.debit_per_species)) {
      if (debit <= 0) continue;
      requested[sp] = debit;
      allocated[sp] = debit * scaling;
    }
    _gradCompStats.allocations++;
    if (scaling < 0.999) {
      _gradCompStats.bound++;
      if (scaling < _gradCompStats.minScaling) _gradCompStats.minScaling = scaling;
    }
    let why: string;
    if (limiting === null) {
      why = 'no rationing — full growth';
    } else {
      why = `${limiting}-limited after residual redistribution (scaling ${(scaling * 100).toFixed(0)}%)`;
    }
    out.set(r.crystal_id, {
      crystal_id: r.crystal_id,
      scaling,
      limiting_species: limiting,
      requested_per_species: Object.freeze(requested),
      allocated_per_species: Object.freeze(allocated),
      allocation_rounds: roundsById.get(r.crystal_id) || 0,
      why,
    });
  }

  return out;
}

// ---- Convenience: build CrystalDryRun records ----
//
// Helper for the simulator wiring (v128b). Given a crystal + its
// computed sigma + zone.thickness_um + initiative score, materializes
// the CrystalDryRun record by converting formula mole ratios to mg/kg demand.
//
// Returns null if the crystal has no stoichiometry entry — in that
// case it should bypass graduated competition and grow at full rate
// (i.e., it pre-dates the v128 contract; eventually all firing minerals
// must have stoichiometry, enforced by tests-js/mineral-stoichiometry-
// coverage.test.ts).

function buildCrystalDryRun(
  crystal_id: number,
  mineral: string,
  sigma: number,
  initiative: number,
  desired_thickness_um: number,
  fluid?: any,
  formulaStoichiometry?: Record<string, number> | null,
): CrystalDryRun | null {
  // SCRIPT-mode bundle: MINERAL_STOICHIOMETRY (js/19) and
  // stoichiometricBudgetDebitPpmPerUm (js/19) is a top-level declaration that
  // wind up as closure-scoped identifiers after concatenation. Reading
  // them as free identifiers is the canonical pattern across the
  // bundle (engines do the same).
  //
  // EARLIER BUG (v128c diagnosis): this function originally read them
  // off globalThis. The tests-js/setup.ts harness exposed them; the
  // tools/_harness.mjs harness did not. Result: gen-js-baseline.mjs
  // produced v127-like baselines (rationing never fired because the
  // function returned null), while the test runtime produced v128
  // output. Calibration test failed against its own baseline because
  // they were generated from different code paths. Fixed by reading
  // the constants from their script-scoped declarations.
  if (typeof MINERAL_STOICHIOMETRY === 'undefined'
      || typeof stoichiometricBudgetDebitPpmPerUm === 'undefined') return null;
  // Solid solutions must compete using the composition of the actual layer
  // being added, not a registry-average endmember. HMC, for example, varies
  // its Ca/Mg formula continuously with the fluid chemistry.
  const mineStoich = formulaStoichiometry || MINERAL_STOICHIOMETRY[mineral];
  if (!mineStoich) return null;
  const debit_per_species: Record<string, number> = {};
  for (const sp of Object.keys(mineStoich)) {
    const reservoir = stoichiometricReservoirSpecies(mineral, sp, fluid);
    debit_per_species[reservoir] = (debit_per_species[reservoir] || 0)
      + desired_thickness_um * stoichiometricBudgetDebitPpmPerUm(sp, mineStoich[sp]);
  }
  return { crystal_id, mineral, sigma, initiative, desired_thickness_um, debit_per_species };
}
