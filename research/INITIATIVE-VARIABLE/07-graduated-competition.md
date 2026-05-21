# 07: Graduated Competition — Full Specification

**Date:** 2026-05-21
**Authors:** user (concept), boss (implementation sketch), builder (refinements)
**Status:** Spec for v128 lands
**Prerequisites:** PROPOSAL-INITIATIVE-VARIABLE.md rev 2 §3.1

---

## The Insight

> **Real solute partitioning between simultaneously growing crystals is continuous, not winner-takes-all.**

In a real vug, two crystals on the same wall both draw from the same fluid boundary layer. The faster-growing crystal (higher initiative) depletes its local depletion zone more, but bulk diffusion replenishes it. The slower crystal still grows — just slower. Only when the fast crystal's depletion zone is comparable to or larger than the diffusion length does the slow crystal starve.

The user proposed this. The boss refined the math. The builder pushed back on three issues (linear sharing is too soft, allocation semantics ambiguous, multi-cation case needs Liebig's law). What follows is the synthesized spec.

---

## The Algorithm

```
Inputs: list of (mineral, σ, initiative, desired_thickness) tuples
        plus current fluid composition

Step 1. Compute desired debit per cation
   For each cation C that appears in any mineral's stoichiometry:
     desired[C] = Σ over minerals using C:
                   stoich[mineral][C] × desired_thickness[mineral] × MASS_BALANCE_SCALE

Step 2. Determine which cations are constrained
   For each cation C:
     if desired[C] ≤ fluid[C]: this cation is unconstrained — every mineral gets full allocation on C
     else: this cation needs rationing

Step 3. For each constrained cation, compute initiative-weighted shares
   gather competitors_for_C = list of minerals using C
   compute initiative_gap = max(initiative) - min(initiative) over competitors_for_C
   if initiative_gap > GAP_THRESHOLD (default 3):
     -- Winner-takes-most mode --
     shares_C[top_initiative_mineral] = 0.80
     remaining 0.20 split among rest by power-law k=2
   else:
     -- Proportional mode --
     shares_C[mineral] = initiative[mineral]² / Σ initiative[m]²

Step 4. Compute cation-limited thickness per mineral
   For each mineral m:
     allowed_thickness[m] = desired_thickness[m]
     For each constrained cation C in m's stoichiometry:
       cation_allowed_C = shares_C[m] × fluid[C]
       thickness_limit_from_C = cation_allowed_C / (stoich[m][C] × MASS_BALANCE_SCALE)
       allowed_thickness[m] = min(allowed_thickness[m], thickness_limit_from_C)
     -- Liebig's law of the minimum: the tightest cation wins --

Step 5. Apply mass balance with allowed_thickness
   For each mineral, debit fluid via existing applyMassBalance(crystal, zone with allowed_thickness, conditions)

Step 6. Log + narrate
   For each mineral, record:
     - initiative + modifier breakdown
     - per-cation share (or "unconstrained")
     - allowed vs desired thickness ratio
     - if allowed << desired, identify which cation limited it
```

---

## Worked Example 1 — supergene_oxidation, step 50 (dense scenario)

**Fluid (illustrative):** T=30°C, pH=6.5, Zn=80 ppm, Cu=40, Pb=30, As=25, Fe=60, Mn=10, SiO2=200, CO3=15

**Six minerals pass σ-gate this step:**

| Mineral | Stoich | σ | Initiative (after mods) | Desired thickness (µm) |
|---------|--------|---|---|---|
| smithsonite | {Zn:1, CO3:1} | 2.1 | 8 | 12 |
| hemimorphite | {Zn:4, SiO2:2} | 1.8 | 6 | 6 |
| goethite | {Fe:1} | 2.5 | 9 | 18 |
| pyrolusite | {Mn:1} | 0.9 | -1 (below σ_crit, skip) | 0 |
| opal | {SiO2:1} | 1.5 | 12 | 8 |
| barite | {Ba:1, S:1} | 1.2 | 7 | 4 |

(pyrolusite drops out at σ-gate; not in subsequent steps.)

**Step 1: Desired debit per cation (using MASS_BALANCE_SCALE=0.02):**
- Zn: smithsonite (1×12×0.02) + hemimorphite (4×6×0.02) = 0.24 + 0.48 = 0.72 ppm. fluid.Zn=80 → unconstrained
- Fe: goethite (1×18×0.02) = 0.36 ppm. fluid.Fe=60 → unconstrained
- SiO2: hemimorphite (2×6×0.02) + opal (1×8×0.02) = 0.24 + 0.16 = 0.40 ppm. fluid.SiO2=200 → unconstrained
- CO3: smithsonite (1×12×0.02) = 0.24 ppm. fluid.CO3=15 → unconstrained
- Mn: pyrolusite skipped.
- Ba: barite (1×4×0.02) = 0.08 ppm. (Ba not listed in fluid — assume 0 or sourced from event.)
- S: barite (1×4×0.02) = 0.08 ppm. unconstrained.

**Step 2:** All cations unconstrained at this step. **No rationing needed.**

**Step 3-4:** Every mineral grows its full desired_thickness.

**Step 5:** Apply mass balance normally.

**Step 6 log:**
- "smithsonite: initiative 8, full allocation, 12 µm"
- "opal: initiative 12, full allocation, 8 µm (low T + low γ_sl bonus)"
- "barite: initiative 7, full allocation, 4 µm"
- etc.

**Outcome:** All six minerals grow at their σ-derived rates. Same as today's behavior because fluid wasn't constraining. The graduated machinery is dormant — exactly right.

---

## Worked Example 2 — schneeberg, step 90 (cascade-prone scenario)

**Fluid:** Cu=5 ppm (depleted late-stage), SiO2=2000, Ca=20, P=8, plus uranyl + arsenate trace

**Three Cu-debiting minerals pass σ-gate:**

| Mineral | Stoich | σ | Initiative | Desired thickness (µm) |
|---------|--------|---|---|---|
| dioptase | {Cu:1, SiO2:1} | 1.2 | 6 (edge-of-gate −2, Cu competition −1) | 18 |
| chrysocolla | {Cu:2, SiO2:2} | 1.5 | 7 (Cu competition −1, surface_energy +1) | 22 |
| brochantite | {Cu:4, S:1} | 1.4 | 7 (Cu competition −1) | 14 |

(Plus pharmacolite, uranospinite, etc. that don't compete for Cu.)

**Step 1: Desired Cu debit:**
- dioptase: 1 × 18 × 0.02 = 0.36 ppm
- chrysocolla: 2 × 22 × 0.02 = 0.88 ppm
- brochantite: 4 × 14 × 0.02 = 1.12 ppm
- **Total: 2.36 ppm**. fluid.Cu = 5 → unconstrained for Cu. Hmm, not constrained yet.

Let me redo with tighter Cu budget. **Assume late-stage Cu=1.5 ppm.**

Total desired Cu = 2.36 > 1.5. **CONSTRAINED.**

**Step 3: Compute shares for Cu**
- initiatives: dioptase=6, chrysocolla=7, brochantite=7
- gap = max − min = 7 − 6 = 1 → ≤ 3 → **proportional mode**
- shares: 6² / (6²+7²+7²) = 36/134 = 0.269 for dioptase
- shares: 49 / 134 = 0.366 each for chrysocolla, brochantite
- check sum: 0.269 + 0.366 + 0.366 = 1.001 ≈ 1.0 ✓

**Step 4: Cation-limited thickness from Cu**
- dioptase: Cu_allowed = 0.269 × 1.5 = 0.404 ppm. thickness_limit = 0.404 / (1 × 0.02) = 20.2 µm. (desired 18, so unlimited)
- chrysocolla: Cu_allowed = 0.366 × 1.5 = 0.549 ppm. thickness_limit = 0.549 / (2 × 0.02) = 13.7 µm. (desired 22, **limited to 13.7**)
- brochantite: Cu_allowed = 0.366 × 1.5 = 0.549 ppm. thickness_limit = 0.549 / (4 × 0.02) = 6.9 µm. (desired 14, **limited to 6.9**)

**Step 5: Apply mass balance**
- dioptase grows 18 µm (Cu unlimited; SiO2 unlimited)
- chrysocolla grows 13.7 µm (Cu-limited; lost 8 µm)
- brochantite grows 6.9 µm (Cu-limited; lost 7 µm)

**Step 6 log:**
- "dioptase: initiative 6, Cu unconstrained, 18 µm (full)"
- "chrysocolla: initiative 7, Cu-limited (share 0.37 of 1.5 ppm budget), 13.7 µm (desired 22)"
- "brochantite: initiative 7, Cu-limited (share 0.37), 6.9 µm (desired 14)"
- Narrator: "Late-stage Cu depletion limits brochantite + chrysocolla; dioptase grows full despite lower initiative because its Cu need is smaller (1:1 vs 2:2 vs 4:1)."

**Outcome under v125 (winner-takes-all): brochantite would have gotten all Cu first → chrysocolla and dioptase get zero → cascade drops them.**

**Outcome under graduated: All three grow, just at reduced rates for the higher-Cu-need minerals. The σ-gate stays cleared for all three, no cascade.**

This is the v125 dioptase cascade prevention: **dioptase stays in the paragenesis as a small crystal** instead of dropping out. The v124-shipped pharmacolite is NOT displaced because pharmacolite doesn't share Cu.

---

## Worked Example 3 — Winner-takes-most case

**Fluid:** highly limited Pb=0.5 ppm, dense supergene_oxidation Pb-suite

| Mineral | Stoich | Initiative | Desired thickness |
|---------|--------|---|---|
| galena (replacement) | {Pb:1, S:1} | 14 (high σ, no competition penalty bug) | 30 |
| anglesite | {Pb:1, S:1} | 9 | 8 |
| cerussite | {Pb:1, CO3:1} | 8 | 6 |
| pyromorphite | {Pb:5, P:3, Cl:1} | 8 | 4 |

**Pb desired:** 30×0.02 + 8×0.02 + 6×0.02 + 5×4×0.02 = 0.60 + 0.16 + 0.12 + 0.40 = 1.28 ppm. fluid.Pb=0.5 → **constrained**.

**Initiative gap = 14 − 8 = 6 > 3 → winner-takes-most mode**

Shares:
- galena: 0.80
- rest (anglesite=9, cerussite=8, pyromorphite=8) split 0.20:
  - anglesite: 0.20 × 9² / (9² + 8² + 8²) = 0.20 × 81/209 = 0.0775
  - cerussite: 0.20 × 64/209 = 0.0613
  - pyromorphite: 0.20 × 64/209 = 0.0613
  - sum check: 0.80 + 0.0775 + 0.0613 + 0.0613 = 1.0001 ✓

Cation-limited thickness from Pb:
- galena: 0.80 × 0.5 = 0.40 ppm → 0.40 / (1×0.02) = 20 µm (desired 30, limited to 20)
- anglesite: 0.0775 × 0.5 = 0.0388 → 1.9 µm (desired 8, limited)
- cerussite: 0.0613 × 0.5 = 0.0306 → 1.5 µm (desired 6, limited)
- pyromorphite: 0.0613 × 0.5 = 0.0306 → 0.306 µm (desired 4, severely limited)

Pyromorphite's 0.3 µm growth is below the typical detection threshold (~1 µm in baselines). It might effectively appear as "didn't grow this step" — an emergent slow-grower behavior. The "rare" mineral pattern emerges.

---

## Per-cation shares with mineral overlap

**Critical detail:** When a mineral has multiple cations, it can have a DIFFERENT share for each cation. Lepidolite {K, Li, Al, SiO2, F} might win 70% of K (few K competitors), 40% of Li (only one other Li mineral), 50% of Al, 30% of SiO2 (lots of SiO2 minerals), 90% of F (lepidolite is often the dominant F sink in pegmatites).

The actual thickness is then **min over all cations** of (share × fluid / coeff / SCALE). This is Liebig's law: the most constrained cation determines actual growth.

This means rare-cation minerals (like cassiterite with unique Sn) get full growth as long as Sn is enough, while multi-cation minerals (lepidolite) often get limited by their tightest cation budget.

---

## Why this matches reality

The graduated model emerges naturally from boundary-layer + bulk-diffusion physics:

- **No competition** (fluid abundant): every crystal grows at its σ-derived rate. Matches the experimental "free growth" regime.
- **Mild competition**: shares are proportional to nucleation rate (≈ initiative²). Matches the experimental "ostensible competition" regime where multiple crystals coexist at reduced rates.
- **Severe competition** (large initiative gap): dominant crystal takes most; minor crystals get crumbs. Matches experimental "Ostwald ripening / competitive growth" where one phase eventually wins.

The 3-unit gap threshold and 80/20 split are calibration values. They can be tuned in v129 against the 5 calibration assertions.

---

## Edge cases

### Mineral with zero initiative
A mineral whose initiative reaches zero (e.g., σ at exactly σ_crit + edge-of-gate −2 + competition −2 = 0) gets share = 0 / (0² + ...) = 0 in proportional mode, and 0% in winner-takes-most. **Effectively drops out of growth this step.** This is the formal "edge-of-gate fragile mineral loses contest" behavior — the v125 cascade is preserved but is now legible.

### Negative initiative
Negative final initiative (e.g., −3 from temp outside range + cascade ripple −2) gets clamped to zero. Mineral doesn't compete.

### Single competitor
If only one mineral wants cation C, no rationing — it gets 100% of fluid[C] up to its desired amount. The graduated machinery only activates with 2+ competitors per cation.

### Tie-breaking
Exact initiative ties: tiebroken by base σ (higher wins). Still tied: fixed registry order (deterministic). Same as Q2 resolution.

---

## Implementation in `js/20-initiative.ts`

```typescript
import { MINERAL_GATES_REGISTRY } from './3X-mineral-gates';
import { MINERAL_STOICHIOMETRY, MASS_BALANCE_SCALE } from './19-mineral-stoichiometry';

const GAP_THRESHOLD = 3;     // calibrated in v129
const POWER_LAW_K = 2;
const WINNER_TAKES_MOST = 0.80;

interface InitiativeResult {
  mineral: string;
  sigma: number;
  base: number;
  modifiers: { source: string; value: number; reason: string }[];
  final: number;
  desired_thickness: number;
  allowed_thickness: number;   // populated by rationing
  limiting_cation?: string;    // which cation set the limit
  shares: Record<string, number>;  // share by cation
}

function runInitiativeStep(conditions, minerals): InitiativeResult[] {
  // Phase 1: compute initiative + desired thickness for each mineral
  const results = minerals.map(m => computeInitiative(m, conditions));

  // Phase 2: cation-level rationing
  applyGraduatedAllocation(results, conditions.fluid);

  // Phase 3: apply mass balance with rationed thicknesses
  for (const result of sortByInitiativeDesc(results)) {
    if (result.allowed_thickness <= 0) continue;
    growCrystal(result.mineral, result.allowed_thickness, conditions);
  }

  return results;  // for narrator + debug
}

function applyGraduatedAllocation(results: InitiativeResult[], fluid: Fluid): void {
  // For each cation, decide if rationing is needed
  const cationsInPlay = new Set<string>();
  for (const r of results) {
    const stoich = MINERAL_STOICHIOMETRY[r.mineral] || {};
    for (const c of Object.keys(stoich)) cationsInPlay.add(c);
  }

  for (const cation of cationsInPlay) {
    rationCation(cation, results, fluid);
  }

  // After all cation rationing, apply Liebig's-law-of-the-minimum
  for (const r of results) {
    r.allowed_thickness = r.desired_thickness;
    const stoich = MINERAL_STOICHIOMETRY[r.mineral] || {};
    for (const cation of Object.keys(stoich)) {
      const share = r.shares[cation];
      if (share === undefined) continue;  // cation unconstrained
      const cation_limited = (share * fluid[cation]) / (stoich[cation] * MASS_BALANCE_SCALE);
      if (cation_limited < r.allowed_thickness) {
        r.allowed_thickness = cation_limited;
        r.limiting_cation = cation;
      }
    }
  }
}

function rationCation(cation: string, results: InitiativeResult[], fluid: Fluid): void {
  const competitors = results.filter(r => {
    const stoich = MINERAL_STOICHIOMETRY[r.mineral] || {};
    return stoich[cation] != null;
  });
  if (competitors.length === 0) return;
  if (competitors.length === 1) {
    competitors[0].shares[cation] = 1.0;
    return;
  }

  // Sum desired debit for this cation
  let total_desired = 0;
  for (const c of competitors) {
    const stoich = MINERAL_STOICHIOMETRY[c.mineral];
    total_desired += stoich[cation] * c.desired_thickness * MASS_BALANCE_SCALE;
  }

  if (total_desired <= fluid[cation]) {
    // Unconstrained — everyone gets full
    for (const c of competitors) c.shares[cation] = 1.0;
    return;
  }

  // Constrained — compute shares
  const initiatives = competitors.map(c => Math.max(0, c.final));
  const max_i = Math.max(...initiatives);
  const min_i = Math.min(...initiatives);
  const gap = max_i - min_i;

  if (gap > GAP_THRESHOLD) {
    // Winner-takes-most
    const top_idx = initiatives.indexOf(max_i);
    competitors[top_idx].shares[cation] = WINNER_TAKES_MOST;
    const rest = competitors.filter((_, i) => i !== top_idx);
    const rest_sum_sq = rest.reduce((s, c) => s + Math.max(0, c.final) ** POWER_LAW_K, 0);
    for (const c of rest) {
      const w = Math.max(0, c.final) ** POWER_LAW_K;
      c.shares[cation] = (1 - WINNER_TAKES_MOST) * (w / rest_sum_sq);
    }
  } else {
    // Power-law proportional
    const sum_sq = initiatives.reduce((s, i) => s + i ** POWER_LAW_K, 0);
    for (let i = 0; i < competitors.length; i++) {
      competitors[i].shares[cation] = (initiatives[i] ** POWER_LAW_K) / sum_sq;
    }
  }
}
```

---

## Validation

The 5 calibration assertions from PROPOSAL §4.1 are the unit-test acceptance criteria. Beyond that, a "rarity validation" suite:

- proustite (genuinely rare in nature) should have low base initiative under typical roughten_gill/sunnyside conditions
- cassiterite should be common in gem_pegmatite (high initiative, unique Sn) and progressively rarer as other minerals compete
- meta-autunite + uranospinite should split a U budget proportionally with the dominant going strongest
- opal should win first-nucleation slot in low-T scenarios (deccan_zeolite, ultramafic_supergene) — confirmed by current empirical behavior

---

## Status

Spec complete. Ready for v128 implementation. The probe tool from v126 (`tools/probe-stoichiometry.mjs`) extends to `tools/probe-initiative-modifier.mjs` for the v129 calibration loop.

— user concept, boss math, builder refinements
