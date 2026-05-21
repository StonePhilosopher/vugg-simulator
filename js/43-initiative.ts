// ============================================================
// js/43-initiative.ts — initiative scaffold (read-only in v127)
// ============================================================
// v127 lands the infrastructure for the initiative variable proposed in
// proposals/PROPOSAL-INITIATIVE-VARIABLE.md (rev 2). This module:
//
//   - Computes per-mineral initiative scores every step (base + modifiers).
//   - Sorts minerals by final initiative for trace / debug.
//   - DOES NOT apply ordering to growth — fixed-order growth loop is
//     unchanged. Baselines are therefore byte-identical to v126/v127a-d.
//
// v128 will replace the fixed-order growth loop with the graduated-
// competition algorithm specified in §3.1 of the proposal. This scaffold
// exists now so v128 can iterate on calibration without also having to
// land the score formulas.
//
// Load order: must come AFTER js/42-mineral-gates-registry.ts (reads
// MINERAL_GATES_REGISTRY) and AFTER js/19-mineral-stoichiometry.ts (reads
// MINERAL_STOICHIOMETRY). Prefix 43 satisfies both.
//
// Public surface (script-mode globals after concat):
//   - InitiativeModifier interface
//   - InitiativeResult interface
//   - INITIATIVE_TRACE_ENABLED flag (default false; flip in browser DevTools
//     via `window.INITIATIVE_TRACE_ENABLED = true` to see per-step output)
//   - baseInitiative(sigma)
//   - temperatureInitiativeModifier(mineral, fluid)
//   - edgeOfGateInitiativeModifier(mineral, sigma)
//   - surfaceEnergyInitiativeModifier(mineral)
//   - competitionInitiativeModifier(mineral, activeMinerals)
//   - cascadeRippleInitiativeModifier(mineral)
//   - computeInitiative(mineral, sigma, fluid, activeMinerals)
//   - rankInitiative(sigmaByMineral, fluid)
//
// Conventions:
//   - All modifier functions return a number (positive = bonus, negative
//     = penalty). Range conventions follow proposal §3.2; values are
//     placeholders for the v129 calibration pass.
//   - Modifier value of 0 means "no effect" — common case for minerals
//     with no temperature gate or no shared-cation competitors.
//   - Functions are pure: same inputs → same output. No state stored
//     in this module. The optional trace logger (§Trace below) lives in
//     a closure-scoped buffer; consumers read it via getInitiativeTrace().

// ---- Types ----

interface InitiativeModifier {
  source: string;   // 'temperature' | 'edge-of-gate' | 'surface-energy' | 'competition' | 'cascade-ripple' | 'substrate' | 'base'
  value: number;
  reason: string;
}

interface InitiativeResult {
  mineral: string;
  baseInitiative: number;
  modifiers: InitiativeModifier[];
  finalInitiative: number;
  sigma: number;
}

// ---- Trace infrastructure ----
//
// Per-step trace buffer. v127 keeps this read-only; v128 will consume it
// during graduated-competition rationing. The buffer is intentionally a
// `let`-rebindable global so tests can clear it between runs.

let INITIATIVE_TRACE_ENABLED = false;
let _initiativeTrace: InitiativeResult[][] = [];  // [step][result]

function clearInitiativeTrace(): void {
  _initiativeTrace = [];
}

function getInitiativeTrace(): InitiativeResult[][] {
  return _initiativeTrace;
}

function recordInitiativeStep(results: InitiativeResult[]): void {
  if (!INITIATIVE_TRACE_ENABLED) return;
  _initiativeTrace.push(results);
}

// ---- Base initiative ----
//
// Log-scaled on σ per proposal §3.3. σ=0.5 → ~8, σ=1.0 → ~10, σ=2.0 → ~15.
// The log scale captures the sharp threshold behavior near σ_crit: small
// differences at low σ become large differences at high σ. v129 may
// re-tune the scaling constants once calibration data is in.

function baseInitiative(sigma: number): number {
  if (sigma <= 0) return 0;
  return Math.log10(sigma * 100 + 1) * 10;
}

// ---- Modifier: temperature sweet-spot ----
//
// Per proposal §3.2. Each MINERAL_GATES_<mineral> may declare T_min /
// T_max / T_optimal. If absent, returns 0 (no effect).
//
//   Outside [T_min, T_max]: -3 (mineral is gated out chemistry-wise
//     anyway; this just makes the trace explicit)
//   Within 20% of T_optimal: +2 (sweet spot)
//   Within 50% of T_optimal: +1 (comfortable)
//   Otherwise within range: 0

function temperatureInitiativeModifier(mineral: string, fluid: any): InitiativeModifier {
  const reg = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, MineralGates> | undefined;
  const g = reg?.[mineral];
  if (!g) return { source: 'temperature', value: 0, reason: `no gates for ${mineral}` };
  const T = fluid?.temperature;
  if (typeof T !== 'number') return { source: 'temperature', value: 0, reason: 'no fluid temperature' };
  const Tmin = g.T_min, Tmax = g.T_max, Topt = g.T_optimal;
  if (Tmin !== undefined && T < Tmin) return { source: 'temperature', value: -3, reason: `T=${T} < T_min=${Tmin}` };
  if (Tmax !== undefined && T > Tmax) return { source: 'temperature', value: -3, reason: `T=${T} > T_max=${Tmax}` };
  if (Topt === undefined) return { source: 'temperature', value: 0, reason: 'no T_optimal' };
  const span = (Tmax !== undefined && Tmin !== undefined) ? (Tmax - Tmin) : 50;
  const dist = Math.abs(T - Topt) / Math.max(span, 1);
  if (dist < 0.2) return { source: 'temperature', value: +2, reason: `T=${T} in sweet spot near ${Topt}` };
  if (dist < 0.5) return { source: 'temperature', value: +1, reason: `T=${T} comfortable near ${Topt}` };
  return { source: 'temperature', value: 0, reason: `T=${T} viable near ${Topt}` };
}

// ---- Modifier: edge-of-gate fragility ----
//
// Per proposal §3.2 + the v125-v126 cascade record. A mineral at σ just
// above σ_crit is fragile — small perturbations push it below threshold
// and it drops out. The penalty makes the trace honest about that.
//
//   σ / σ_crit < 0.5: -1 (nowhere near, barely viable — not really
//     competing for shared cations)
//   σ / σ_crit in [0.5, 1.1): -2 (fragile — near or just above threshold)
//   σ / σ_crit in [1.1, 1.3): -1 (edgy but workable)
//   σ / σ_crit > 2.0: +1 (robust)
//   else: 0

function edgeOfGateInitiativeModifier(mineral: string, sigma: number): InitiativeModifier {
  const reg = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, MineralGates> | undefined;
  const g = reg?.[mineral];
  if (!g || !Number.isFinite(g.sigma_crit) || g.sigma_crit <= 0) {
    return { source: 'edge-of-gate', value: 0, reason: `no finite sigma_crit for ${mineral}` };
  }
  const ratio = sigma / g.sigma_crit;
  if (ratio < 0.5) return { source: 'edge-of-gate', value: -1, reason: `σ/σ_crit=${ratio.toFixed(2)} far below` };
  if (ratio < 1.1) return { source: 'edge-of-gate', value: -2, reason: `σ/σ_crit=${ratio.toFixed(2)} fragile` };
  if (ratio < 1.3) return { source: 'edge-of-gate', value: -1, reason: `σ/σ_crit=${ratio.toFixed(2)} edgy` };
  if (ratio > 2.0) return { source: 'edge-of-gate', value: +1, reason: `σ/σ_crit=${ratio.toFixed(2)} robust` };
  return { source: 'edge-of-gate', value: 0, reason: `σ/σ_crit=${ratio.toFixed(2)} comfortable` };
}

// ---- Modifier: surface energy ----
//
// Per proposal §3.2. Lower γ → lower nucleation barrier → higher base
// initiative. Categories from the MineralGates surface_energy field.

function surfaceEnergyInitiativeModifier(mineral: string): InitiativeModifier {
  const reg = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, MineralGates> | undefined;
  const g = reg?.[mineral];
  if (!g) return { source: 'surface-energy', value: 0, reason: `no gates for ${mineral}` };
  switch (g.surface_energy) {
    case 'very_low': return { source: 'surface-energy', value: +2, reason: 'γ very low (opal-class)' };
    case 'low':      return { source: 'surface-energy', value: +1, reason: 'γ low (gypsum-class)' };
    case 'medium':   return { source: 'surface-energy', value:  0, reason: 'γ medium (default)' };
    case 'high':     return { source: 'surface-energy', value: -1, reason: 'γ high (quartz-class)' };
    case 'very_high':return { source: 'surface-energy', value: -2, reason: 'γ very high (diamond-class)' };
  }
  return { source: 'surface-energy', value: 0, reason: 'unknown γ class' };
}

// ---- Modifier: shared-cation competition ----
//
// Per proposal §3.2. Counts distinct other minerals currently firing
// that share at least one cation with `mineral`. Reads from
// MINERAL_STOICHIOMETRY for cation sets.
//
//   0 competitors: 0
//   1 competitor:  -1
//   2+ competitors: -2 (dense-suite penalty)

function competitionInitiativeModifier(mineral: string, activeMinerals: string[]): InitiativeModifier {
  const stoich = (globalThis as any).MINERAL_STOICHIOMETRY as Record<string, Record<string, number>> | undefined;
  if (!stoich) return { source: 'competition', value: 0, reason: 'no stoichiometry table' };
  const mine = stoich[mineral];
  if (!mine) return { source: 'competition', value: 0, reason: `no stoichiometry for ${mineral}` };
  const myCations = Object.keys(mine);
  const competitors = new Set<string>();
  for (const other of activeMinerals) {
    if (other === mineral) continue;
    const otherStoich = stoich[other];
    if (!otherStoich) continue;
    for (const c of myCations) {
      if (otherStoich[c] !== undefined) {
        competitors.add(other);
        break;
      }
    }
  }
  if (competitors.size === 0) return { source: 'competition', value: 0, reason: 'no shared-cation competitors' };
  if (competitors.size === 1) return { source: 'competition', value: -1, reason: `1 competitor (${[...competitors][0]})` };
  return { source: 'competition', value: -2, reason: `${competitors.size} competitors (dense suite)` };
}

// ---- Modifier: cascade ripple ----
//
// Per proposal §3.2 (NEW in rev 2). Distinct from competition penalty —
// this is about how many σ gates the mineral's debit can perturb when
// it grows, not who else is firing now. Cap at -2.

function cascadeRippleInitiativeModifier(mineral: string): InitiativeModifier {
  const stoich = (globalThis as any).MINERAL_STOICHIOMETRY as Record<string, Record<string, number>> | undefined;
  if (!stoich) return { source: 'cascade-ripple', value: 0, reason: 'no stoichiometry table' };
  const mine = stoich[mineral];
  if (!mine) return { source: 'cascade-ripple', value: 0, reason: `no stoichiometry for ${mineral}` };
  const n = Object.keys(mine).length;
  if (n <= 1) return { source: 'cascade-ripple', value: 0, reason: '1-cation: no ripple' };
  const penalty = Math.min(n - 1, 2);
  return { source: 'cascade-ripple', value: -penalty, reason: `${n} cations: -${penalty} ripple` };
}

// ---- Composition ----
//
// Sums base + all modifiers for one mineral. Returns the full
// InitiativeResult including the modifier breakdown so the trace /
// library card can show the "why".

function computeInitiative(
  mineral: string,
  sigma: number,
  fluid: any,
  activeMinerals: string[],
): InitiativeResult {
  const base = baseInitiative(sigma);
  const mods: InitiativeModifier[] = [
    temperatureInitiativeModifier(mineral, fluid),
    edgeOfGateInitiativeModifier(mineral, sigma),
    surfaceEnergyInitiativeModifier(mineral),
    competitionInitiativeModifier(mineral, activeMinerals),
    cascadeRippleInitiativeModifier(mineral),
  ];
  const modSum = mods.reduce((s, m) => s + m.value, 0);
  return {
    mineral,
    baseInitiative: base,
    modifiers: mods,
    finalInitiative: base + modSum,
    sigma,
  };
}

// ---- Step-level ranking ----
//
// Given a map of mineral → σ for one step, returns the per-mineral
// InitiativeResult list sorted highest finalInitiative first. v127 logs
// this; v128 will consume it to drive growth ordering.
//
// Tiebreaking (per proposal §3.1): higher base σ wins, then alphabetical
// (deterministic).

function rankInitiative(
  sigmaByMineral: Record<string, number>,
  fluid: any,
): InitiativeResult[] {
  const active = Object.keys(sigmaByMineral).filter(m => sigmaByMineral[m] > 0);
  const results: InitiativeResult[] = [];
  for (const m of active) {
    results.push(computeInitiative(m, sigmaByMineral[m], fluid, active));
  }
  results.sort((a, b) => {
    if (b.finalInitiative !== a.finalInitiative) return b.finalInitiative - a.finalInitiative;
    if (b.sigma !== a.sigma) return b.sigma - a.sigma;
    return a.mineral.localeCompare(b.mineral);
  });
  recordInitiativeStep(results);
  return results;
}
