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
// the cell's fluid and running engines without mass balance.

interface CrystalDryRun {
  crystal_id: number;
  mineral: string;
  sigma: number;
  initiative: number;          // from js/43-initiative.ts computeInitiative
  desired_thickness_um: number;
  debit_per_species: Record<string, number>;  // already × MASS_BALANCE_SCALE × stoich
}

interface GraduatedAllocation {
  crystal_id: number;
  scaling: number;             // in [0, 1] — multiply desired_thickness_um by this
  limiting_species: string | null;  // which species capped growth (Liebig); null if no rationing
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
// Determinism: this function is pure. Same inputs → same outputs.
// No RNG, no I/O, no global-state mutation.

function computeGraduatedAllocations(
  runs: CrystalDryRun[],
  fluid: Record<string, number>,
): Map<number, GraduatedAllocation> {
  const out = new Map<number, GraduatedAllocation>();
  if (!runs.length) return out;

  // Collect species touched by any crystal.
  const species = new Set<string>();
  for (const r of runs) {
    for (const sp of Object.keys(r.debit_per_species)) {
      if ((r.debit_per_species[sp] || 0) > 0) species.add(sp);
    }
  }

  // Per-species: total demand vs available, and per-crystal share of
  // the total demanded pool.
  const speciesShares: Record<string, Map<number, number>> = {};
  const speciesRationed: Record<string, boolean> = {};
  for (const sp of species) {
    const wanting = runs.filter(r => (r.debit_per_species[sp] || 0) > 0);
    const available = fluid[sp] ?? 0;
    let demand = 0;
    for (const r of wanting) demand += (r.debit_per_species[sp] || 0);
    speciesRationed[sp] = demand > available;
    speciesShares[sp] = _computeSpeciesShares(wanting, sp, available);
  }

  // Per-crystal Liebig step: final scaling = min over its species of
  // (allowed_share / demanded_share). For species that didn't ration
  // the demanded share is exactly the debit-fraction, so allowed/demanded
  // = (1.0 demand-fraction) / (debit_i / totalDemand) — but this works
  // out cleanly because when not rationed, share = debit_i / totalDemand
  // and the scaling is 1.0 for that species.
  for (const r of runs) {
    let scaling = 1.0;
    let limiting: string | null = null;
    let limitingShare = 1.0;
    for (const sp of Object.keys(r.debit_per_species)) {
      const debit = r.debit_per_species[sp] || 0;
      if (debit <= 0) continue;
      if (!speciesRationed[sp]) continue;  // free; doesn't cap

      // Rationed: crystal's share of fluid[sp] is the cap on its debit.
      const available = fluid[sp] ?? 0;
      const myShareFrac = speciesShares[sp].get(r.crystal_id) || 0;
      const allowedDebit = myShareFrac * available;
      const scaleForThisSp = debit > 0 ? Math.min(1.0, allowedDebit / debit) : 1.0;
      if (scaleForThisSp < scaling) {
        scaling = scaleForThisSp;
        limiting = sp;
        limitingShare = myShareFrac;
      }
    }
    let why: string;
    if (limiting === null) {
      why = 'no rationing — full growth';
    } else {
      const avail = fluid[limiting] ?? 0;
      why = `${limiting}-limited (share ${(limitingShare * 100).toFixed(0)}% of ${avail.toFixed(2)}, scaling ${(scaling * 100).toFixed(0)}%)`;
    }
    out.set(r.crystal_id, {
      crystal_id: r.crystal_id,
      scaling,
      limiting_species: limiting,
      why,
    });
  }

  return out;
}

// ---- Convenience: build CrystalDryRun records ----
//
// Helper for the simulator wiring (v128b). Given a crystal + its
// computed sigma + zone.thickness_um + initiative score, materializes
// the CrystalDryRun record by looking up MINERAL_STOICHIOMETRY +
// MASS_BALANCE_SCALE.
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
): CrystalDryRun | null {
  // SCRIPT-mode bundle: MINERAL_STOICHIOMETRY (js/19) and
  // MASS_BALANCE_SCALE (js/18) are top-level `const` declarations that
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
  if (typeof MINERAL_STOICHIOMETRY === 'undefined' || typeof MASS_BALANCE_SCALE === 'undefined') return null;
  const mineStoich = MINERAL_STOICHIOMETRY[mineral];
  if (!mineStoich) return null;
  const debit_per_species: Record<string, number> = {};
  for (const sp of Object.keys(mineStoich)) {
    debit_per_species[sp] = MASS_BALANCE_SCALE * desired_thickness_um * mineStoich[sp];
  }
  return { crystal_id, mineral, sigma, initiative, desired_thickness_um, debit_per_species };
}
