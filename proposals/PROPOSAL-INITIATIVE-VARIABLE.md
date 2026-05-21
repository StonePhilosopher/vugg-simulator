# PROPOSAL: Initiative Variable for Competitive Mineral Growth

**Status:** Revision 2 — builder review complete, ready for v127 infrastructure
**Authors:** Professor (concept), Rockbot (initial research & spec), Builder + boss (rev 2 refinements)
**Date:** 2026-05-21 (rev 1 → rev 2 same day)
**Related:** PROPOSAL-SPECIMEN-OBJECT.md §Q7, HANDOFF-FIELD-NOTES-V117-V124.md, v126 batch-probe arc
**SIM_VERSION target:** v127 (infrastructure) → v128 (graduated competition) → v129 (calibration) → v130 (substrate/epitaxy)

**Revision 2 changes (2026-05-21):**
- **Graduated competition model** (user proposal): not winner-takes-all; proportional allocation when initiative gaps are small, winner-takes-most when gaps are large.
- **Power-law k=2 sharing math** for the proportional regime — more physical than linear share.
- **Cation-level rationing** instead of per-mineral share — only triggers when broth is genuinely limiting (Liebig's-law-of-the-minimum style).
- **Cascade ripple penalty** distinguished from per-cation competition penalty (renames the multi-cation modifier).
- **Engine-exported gates** instead of source parsing for σ_crit.
- **Induction time deferred to v131+** with explicit acknowledgment that graduated growth doesn't capture pre-nucleation delay.
- **5 concrete calibration assertions** anchor v128 validation against the v125-v126 cascade record.
- **Science corrections** to research/INITIATIVE-VARIABLE/01-geochemical-grounding.md: BCF regime inversion, quartz/opal ΔH° values, quartz σ_crit homogeneous-vs-heterogeneous distinction, γ_sl vs γ_sv clarification.

---

## 1. The Problem

The current sim processes minerals in a **fixed order** each step. Every mineral gets a turn. Supersaturation σ is calculated from fluid composition. If σ > threshold, the mineral nucleates/grows.

This is **simultaneous initiative** — everyone acts, but the ones with higher σ get more growth. The problem: **order doesn't matter**. Barite and sphalerite both grow from the same sulfur budget, but barite always goes first (fixed loop order), so sphalerite gets the leftovers. In reality, the faster nucleator wins the draw.

The v125 cascade findings confirmed this empirically: adding stoichiometry for a mineral that fires *once* (dioptase in schneeberg) displaced 12+ other minerals' nucleation orders. The cascade wasn't caused by budget exhaustion — it was caused by **iterator displacement** when σ recalc shifted edge-of-gate minerals across their thresholds.

**An initiative variable makes the cascade explicit, predictable, and controllable.**

---

## 2. The Science

### 2.1 Nucleation Rate = f(σ, T)

Nucleation rate J follows an Arrhenius-like form:

**J = A · exp(-ΔG* / kT)**

where ΔG* is the activation barrier for forming a stable critical nucleus. This means:
- Higher temperature → lower barrier → faster nucleation
- Higher supersaturation → lower barrier → faster nucleation
- Both terms interact: the barrier itself depends on temperature through surface energy and solubility

### 2.2 Critical Supersaturation

For every mineral at every temperature, there's a **critical supersaturation σ_crit**:
- Below σ_crit: induction time → ∞, effectively zero nucleation
- Above σ_crit: nucleation becomes rapid

The transition is **sharp**, not gradual. A mineral at σ = 0.95·σ_crit is **fragile** — any perturbation pushes it across. A mineral at σ = 2·σ_crit is **robust**.

### 2.3 Temperature as Conditional Modifier

Solubility products are temperature-dependent: **ln(Ksp) = -ΔG° / RT**

| Mineral | Temperature Effect | Initiative Modifier |
|---------|-------------------|---------------------|
| Calcite | Inverse solubility (more soluble at low T) | +initiative at high T |
| Quartz | Normal solubility (more soluble at high T) | -initiative at high T (but faster diffusion may compensate) |
| Barite | Sulfate stability window, moderate T | +initiative at moderate T |
| Sphalerite | Sulfide stability, moderate-high T | +initiative at moderate-high T |
| Opal | Amorphous SiO₂ precipitates cold | +initiative at low T |
| Gypsum | Hydrated sulfate, low-moderate T | +initiative at low-moderate T |

### 2.4 Surface Energy

The nucleation barrier **ΔG* = (16πγ³V_m²) / (3(RT ln S)²)** where γ = surface energy.

Lower γ → lower barrier → higher base initiative:
- Opal (amorphous, very low γ) precipitates before quartz
- Gypsum precipitates before anhydrite
- Aragonite wins over calcite when Mg²⁺ poisons calcite surface

### 2.5 BCF Theory: Regime Dependence

Burton-Cabrera-Frank theory gives growth rate regimes:
- **Low σ**: v ∝ σ² (surface diffusion limited, spiral growth)
- **High σ**: v ∝ σ (direct integration, abundant kink sites)

A mineral's initiative changes its scaling with σ depending on regime.

---

## 3. The Proposal

### 3.1 Core Mechanic: Initiative Roll + Graduated Competition

Each step, before growth:

```typescript
interface InitiativeResult {
  mineral: string;
  baseInitiative: number;      // from σ
  modifiers: InitiativeModifier[];
  finalInitiative: number;
  share: number;               // 0-1, fraction of contested cation each mineral wins
  rollReason: string;           // for debug/trace
}

interface InitiativeModifier {
  source: string;              // "temperature", "edge-of-gate", "surface-energy", "competition", "cascade-ripple", "substrate"
  value: number;               // can be positive or negative
  reason: string;
}
```

**Algorithm (rev 2 — graduated competition):**
1. For each mineral with σ > 0, calculate **base initiative** = f(σ)
2. Apply **conditional modifiers** (see §3.2)
3. Calculate **desired growth** (engine.compute(σ, conditions) → desired_thickness_um) for each mineral
4. For each cation C:
   - Sum desired debit across all minerals using C: `desired[C] = Σ stoich[C] × desired_thickness × SCALE`
   - If `desired[C] ≤ fluid[C]`: no rationing, all minerals get their full desired growth on this cation
   - If `desired[C] > fluid[C]`: ration — each competing mineral gets `share[C] × fluid[C]` where:
     - **Initiative-gap small (gap ≤ 3)**: power-law share, `share_i = initiative_i^2 / Σ initiative_j^2`
     - **Initiative-gap large (gap > 3)**: winner-takes-most, top-initiative mineral gets 80%, rest split the remaining 20%
5. Each mineral's actual `thickness_um` = `desired_thickness_um × min(over all its cations of share[C] / desired_share[C])`
   - This is Liebig's law of the minimum: the most constrained cation limits growth
6. Apply mass balance with the rationed thickness_um values
7. If any mineral's resulting σ drops below threshold after rationing, log "edge-of-gate skip" (the mineral nucleated this step but at zero size — effectively didn't nucleate)

**Why this matters:** The v125-v126 cascade record showed that small debits flip edge-of-gate minerals. Under winner-takes-all, an edge-of-gate mineral that loses initiative gets zero growth → drops out → cascade. Under graduated competition, it gets a small share → grows slowly → stays in the paragenesis as a smaller crystal. **The cascade still exists, but it's no longer all-or-nothing.**

**Tiebreaking when initiatives are exactly equal:** base σ wins (higher growth potential goes first). If still tied, fixed registry order (deterministic, reproducible).

### 3.1.1 Why Power-Law k=2 (Not Linear, Not Softmax)

Linear sharing (`share_i = initiative_i / Σ`) gives almost 50/50 splits even when initiatives differ by 10% (A=12, B=11 → 52/48). That's too soft — it under-dominates.

Softmax sharing (`share_i = exp(initiative_i / T) / Σ`) is more physical (Boltzmann statistics) but requires a temperature parameter T that needs calibration.

Power-law k=2 (`share_i = initiative_i² / Σ`) is the middle ground:
- A=12, B=11: 56% / 44% — modest dominance for the higher
- A=15, B=10: 69% / 31% — strong dominance at larger gap
- A=15, B=8: 78% / 22% — at the gap-threshold of 3 (calibrated), winner-takes-most kicks in

Power-law is simpler to reason about than softmax and gives the right qualitative behavior. k=2 chosen by initial estimate; calibration in v129 may adjust.

### 3.2 Modifier System

#### Temperature Sweet-Spot (±3 initiative)

Each mineral declares a `preferredTempRange: [min, max, optimal]` in its spec.

```typescript
function temperatureModifier(mineral: Mineral, fluid: Fluid): number {
  const range = mineral.spec.preferredTempRange;
  if (!range) return 0;
  
  const T = fluid.temperature;
  const [min, max, optimal] = range;
  
  if (T < min || T > max) return -3;           // outside viable range
  const dist = Math.abs(T - optimal) / (max - min);
  if (dist < 0.2) return +2;                     // sweet spot
  if (dist < 0.5) return +1;                     // comfortable
  return 0;                                      // viable but not ideal
}
```

#### Edge-of-Gate Penalty (-2 initiative)

A mineral's σ_crit is derived from its spec (or empirically calibrated).

```typescript
function edgeOfGateModifier(mineral: Mineral, σ: number): number {
  const σ_crit = mineral.spec.criticalSupersaturation || 0.5; // default
  const ratio = σ / σ_crit;
  
  if (ratio < 0.5) return -1;                    // nowhere near, barely viable
  if (ratio < 1.1) return -2;                    // fragile — near threshold
  if (ratio < 1.3) return -1;                    // edgy but workable
  if (ratio > 2.0) return +1;                    // robust — well above threshold
  return 0;
}
```

**Why this matters:** The v125 cascade happened because dioptase's σ was near its threshold in schneeberg. Adding stoichiometry shifted other minerals' σ across their thresholds, changing nucleation order. With edge-of-gate penalties, the system becomes **self-aware about fragility**.

#### Surface Energy Bonus (+1 initiative)

```typescript
function surfaceEnergyModifier(mineral: Mineral): number {
  const gamma = mineral.spec.surfaceEnergy || 'medium';
  switch (gamma) {
    case 'very_low': return +2;   // opal, gel minerals
    case 'low': return +1;        // gypsum, aragonite (in Mg-fluid)
    case 'medium': return 0;      // most minerals
    case 'high': return -1;       // quartz, corundum
    case 'very_high': return -2;  // diamond (if ever added)
  }
}
```

#### Shared-Cation Competition Penalty (-1 to -2 initiative)

```typescript
function competitionModifier(mineral: Mineral, activeMinerals: Mineral[]): number {
  const myCations = mineral.stoichiometryKeys(); // ['Cu', 'Zn', 'S'] etc.

  // Count distinct competing minerals across all my cations.
  // A mineral that overlaps with me on multiple cations only counts once.
  const competitors = new Set<string>();
  for (const cation of myCations) {
    for (const m of activeMinerals) {
      if (m === mineral) continue;
      if (m.stoichiometryKeys().includes(cation)) competitors.add(m.name);
    }
  }

  if (competitors.size === 0) return 0;
  if (competitors.size === 1) return -1;
  return -2; // 2+ competitors = dense suite penalty
}
```

**Dense suite penalty** explains why supergene_oxidation and schneeberg are cascade-prone: many minerals share Cu, Zn, Pb, As. Adding any new stoichiometry entry for a shared cation displaces multiple competitors.

#### Cascade Ripple Penalty (NEW rev 2 — multi-cation stoichiometry)

```typescript
function cascadeRippleModifier(mineral: Mineral): number {
  // A mineral that needs many distinct cations has more ways to perturb
  // other minerals' σ gates when it grows. This is distinct from
  // competition (which is about other minerals firing now); cascade
  // ripple is about how many σ gates this mineral's debit can flip.
  const uniqueCations = new Set(mineral.stoichiometryKeys()).size;
  return -Math.min(uniqueCations - 1, 2);  // cap at -2
}
```

**Examples:**
- opal {SiO2}: 1 cation → 0 ripple penalty (safe; v125 empirical confirmation)
- calcite {Ca, CO3}: 2 cations → -1 ripple penalty
- dioptase {Cu, SiO2}: 2 cations → -1 ripple penalty (v125 cascaded — the per-cation competition is what really hurt)
- conichalcite {Ca, Cu, As}: 3 cations → -2 ripple penalty
- lepidolite {K, Li, Al, SiO2, F}: 5 cations → -2 ripple penalty (v126 had the largest break count of any probe)

**Why this is separate from competition penalty:** Competition asks "what else is firing that wants the same cations as me?" Cascade ripple asks "how many distinct σ gates can my growth perturb?" A 5-cation mineral in a sparse scenario (few other firings) gets cascade-ripple penalty but no competition penalty — and that pattern matches the v126 lepidolite cascade in gem_pegmatite (which has fewer competitors than radioactive_pegmatite but still cascaded).

#### Substrate Epitaxy Modifier (context-dependent)

If mineral B nucleates on mineral A:
- **Competition mode** (default): A gets -1 initiative (B is draining the same fluid)
- **Catalysis mode** (if A's surface lowers B's γ): B gets +1 initiative, A unchanged
- **Encapsulation mode** (if B fully covers A): A gets -3 initiative (no fluid access)

The mode is determined by checking if A's surface_energy is marked as `catalytic_for: [B]` in its spec.

### 3.3 Base Initiative Function

```typescript
function baseInitiative(σ: number): number {
  // Log-scaled: small differences at low σ, large differences at high σ
  // This captures the sharp threshold behavior near σ_crit
  if (σ <= 0) return 0;
  return Math.log10(σ * 100 + 1) * 10;  // σ=0.5 → ~8, σ=1.0 → ~10, σ=2.0 → ~15
}
```

### 3.4 Determinism vs Stochasticity

**Option A: Pure deterministic (recommended for v126)**
- Same input → same output every time
- No random component
- Easy to test, easy to calibrate
- Captures the *structural* effect of initiative without noise

**Option B: Small random (for v130+)**
- Roll = base + modifiers + d3-2 (range: -1 to +1)
- Captures nucleation stochasticity
- Same seed → reproducible
- Makes calibration harder but behavior more naturalistic

**Option C: Full stochastic (future)**
- Per-nucleation-event roll, not per-step
- Each new crystal rolls independently
- Most realistic, hardest to test
- Would require Monte Carlo baselines

**Recommendation:** Start with Option A. The structural effect of initiative order is the big win. Add Option B only after we have empirical data that deterministic initiative underpredicts natural variability.

---

## 4. Implementation Plan (rev 2)

User greenlight: test churn is OK; old baselines will all be regenerated. This unlocks a faster rollout than the original flag-gated gradual plan.

### Phase 1: Infrastructure (v127)

1. **Refactor engine gates to exported constants** (touches ~25 `js/3X-supersat-*.ts` files)
   - Each engine exports `MINERAL_GATES_<mineral>` with `sigma_crit`, `T_min`, `T_max`, `pH_min`, `pH_max`, etc.
   - One-time refactor; no behavior change (gates still compute the same way internally)
   - Test pin: each `MINERAL_GATES_X` matches the engine's first-gate threshold
   - Removes need to parse source files; library card display reads from these constants

2. **Add initiative calculation module** (`js/20-initiative.ts`)
   - Base initiative function (log-scaled on σ)
   - Modifier registry: temperature, edge-of-gate, surface-energy, competition, cascade-ripple
   - Sort + log infrastructure (NOT yet graduated competition — that's v128)
   - Calculation runs every step; ordering produced but NOT yet applied to growth (run alongside legacy fixed-order behavior with side-by-side log)

3. **Add spec fields to minerals via the gates constants** (NOT `data/minerals.json`)
   - `preferredTempRange: [min, max, optimal]` lives in `MINERAL_GATES_<mineral>` next to T-gates
   - `surfaceEnergy: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'` lives there too
   - σ_crit comes from the gates' sigma_crit field — no duplication

4. **Library card display** (`js/9X-ui-library.ts`)
   - New "Competitiveness profile" section on each mineral card
   - Shows: σ_crit, temperature sweet-spot, competition group (which cations it shares), base initiative formula, cascade ripple count
   - Reads from `MINERAL_GATES_<mineral>` — no duplication

5. **No baseline changes in v127.** Initiative is computed and logged but not applied to growth. Old paragenesis preserved.

### Phase 2: Graduated Competition Lands (v128)

1. **Replace fixed-order growth loop with graduated allocation**
   - Algorithm per §3.1 rev 2 above
   - Cation-level rationing only when desired > available
   - Power-law k=2 sharing in proportional regime
   - Winner-takes-most (80/20) when initiative gap > 3

2. **Regenerate all 30 baselines** as `seed42_v128.json`
   - Old baselines deleted (per user greenlight on test churn)
   - Calibration test suite revised to compare v128 internal-consistency, not v127 byte-identicality

3. **Validate against the 5 calibration assertions** (see §4.1)

### Phase 3: Modifier Calibration (v129)

1. **Tune temperature ranges** for top 50 minerals from corrected ΔH° table
2. **Tune competition + cascade-ripple weights** until calibration assertions hit
3. **Tune power-law exponent k** and winner-takes-most threshold (currently k=2 and gap=3; may shift)
4. **Per-scenario competition mode** if any scenario needs special handling

### Phase 4: Substrate / Epitaxy (v130)

1. **Add substrate modifier**
   - Catalytic surfaces (e.g., calcite seeding aragonite via γ_sl reduction)
   - Competition surfaces (e.g., barite vs sphalerite on same substrate)
   - Encapsulation detection

2. **Add overgrowth mechanics**
   - When B nucleates on A, A can continue growing if not fully covered
   - Coverage fraction determines fluid access penalty
   - Pseudomorph case: A → B replacement (CDR) inherits position

### Phase 5: Future (v131+)

1. **Induction counter** — track `steps_above_threshold` per mineral; nucleate only when counter > induction_time(σ, T, γ)
2. **Per-zone initiative** — different cavity zones with different fluid → different initiative orders
3. **Stochastic mode** — small random component on initiative roll, Monte Carlo baselines

### 4.1 The Five Calibration Assertions (v128 validation target)

These are the v125-v126 cascade events translated into "expected behavior under graduated competition." If v128 passes all five, the model is calibrated for shipping.

1. **dioptase in schneeberg**: dioptase grows (σ > σ_crit), pharmacolite remains in paragenesis at reduced max_um (but does NOT drop out). Under v125 winner-takes-all, pharmacolite dropped entirely; under graduated, it should stay small.

2. **koettigite in supergene_oxidation**: koettigite grows, alunite remains at its v124 count (the v126 probe saw alunite DROPPED — graduated should preserve it).

3. **lepidolite in radioactive_pegmatite**: lepidolite grows under cascade-ripple penalty -2 + per-cation competition -2 = -4 final modifier. The 11 v126 count breaks collapse to ~3-5 max_um drifts with **no count changes**.

4. **cassiterite in radioactive_pegmatite**: the v125 2-of-3 near-miss becomes a clean 3-of-3 because the radioactive_pegmatite cascade items (anglesite, goethite, topaz) lose σ as cassiterite competes for shared cations rather than displacing them via iterator order.

5. **uranophane in schneeberg**: the v126 1-of-2 near-miss becomes clean 2-of-2. uranophane grows as a small share of the U budget; pharmacolite + uranospinite + haidingerite all remain at their v126 counts.

If any of these fail, modifier values need adjustment in v129. The probe tool (`tools/probe-stoichiometry.mjs`) extends to `tools/probe-initiative-modifier.mjs` for that loop.

---

## 5. Open Questions for the Builder

1. **Should σ_crit be derived from engine gate thresholds or explicitly specified?**
   - Pro: explicit spec fields are clearer
   - Con: adds maintenance burden, may drift from engine reality

2. **How do we handle minerals with no preferredTempRange?**
   - Option: default to "always comfortable" (no modifier)
   - Option: default to "moderate" (0 modifier, no bonus or penalty)

3. **Should competition penalty consider stoichiometric coefficients?**
   - A mineral needing Cu:1 vs Cu:10 should have different competitive weight
   - Or keep it simple: any overlap = penalty

4. **Should initiative affect growth rate or only nucleation order?**
   - Option A: only order (simpler)
   - Option B: order + growth rate multiplier (more realistic, more complex)

5. **How do we test this without losing all baselines?**
   - Suggestion: flag-gated gradual rollout
   - Baseline comparison shows "expected drift" vs "regression"
   - Accept expected drift in dense suites

---

## 6. Files to Create/Modify

### v127 Infrastructure phase

**New files:**
- `js/20-initiative.ts` — initiative calculation (base + modifiers + log infra)
- `tests-js/initiative.test.ts` — unit tests for modifier functions
- `tests-js/engine-gates-exports.test.ts` — guard that all engines export `MINERAL_GATES_X`

**Modified files (~25 engine files):**
- `js/30-supersat-*.ts` through `js/45-supersat-*.ts` — refactor first-gate σ_crit + ancillary gates into exported `MINERAL_GATES_<mineral>` constants
- `js/9X-ui-library.ts` — read MINERAL_GATES for library card "Competitiveness" section
- `js/15-version.ts` — v127 version block

### v128 Graduated competition phase

**New files:**
- `tests-js/initiative-graduated.test.ts` — graduated allocation unit tests
- `tests-js/initiative-paragenesis.test.ts` — the 5 calibration assertions

**Modified files:**
- `js/20-initiative.ts` — add graduated allocation algorithm + cation-level rationing
- `js/99-legacy-bundle.ts` / `js/97-vug-simulator.ts` — wire graduated growth into run_step
- `tests-js/calibration.test.ts` — all 30 baselines regenerated as v128
- `tests-js/baselines/seed42_v128.json` — new ground-truth
- (delete) old baselines except canonical reference copies

### Stable research artifacts:
- `proposals/PROPOSAL-INITIATIVE-VARIABLE.md` (this doc)
- `research/INITIATIVE-VARIABLE/01-geochemical-grounding.md` (corrections rev 2)
- `research/INITIATIVE-VARIABLE/02-v125-cascade-analysis.md`
- `research/INITIATIVE-VARIABLE/03-modifier-calibration.md` (rev 2)
- `research/INITIATIVE-VARIABLE/04-implementation-notes.md` (rev 2)
- `research/INITIATIVE-VARIABLE/05-open-questions.md` (G-J resolutions added)
- `research/INITIATIVE-VARIABLE/06-engine-gates-refactor.md` (NEW rev 2)
- `research/INITIATIVE-VARIABLE/07-graduated-competition.md` (NEW rev 2)

---

## 7. Research Notes

See `research/INITIATIVE-VARIABLE/` subfolder for:
- `01-geochemical-grounding.md` — literature review (Arrhenius, Ksp(T), BCF theory)
- `02-v125-cascade-analysis.md` — empirical findings from cascade probes
- `03-modifier-calibration.md` — proposed temperature ranges and σ_crit values
- `04-implementation-notes.md` — builder-facing technical details
- `05-open-questions.md` — discussion threads

---

## 8. Bottom Line (rev 2)

The initiative variable is the architectural fix for the cascade problem v124-v126 surfaced. **It doesn't prevent cascades — it makes them legible and graduated.** Edge-of-gate minerals get a small share instead of being dropped. Shared-cation competition becomes explicit. Multi-cation minerals carry a cascade-ripple penalty. Temperature sweet-spots emerge naturally from corrected Ksp data.

The graduated competition model (user-proposed, rev 2) is the key refinement: real boundary-layer + bulk-diffusion physics in vug fluids is continuous, not winner-takes-all. A crystal at σ just above σ_crit doesn't vanish when a faster competitor grows — it stays small. That matches what real vugs look like: dominant minerals + accessory minerals + trace minerals, all coexisting at different abundances.

**Initiative as a player-facing concept:** Each mineral's library card shows base initiative under typical conditions. The narrator log explains why one crystal grew instead of another. The "competitiveness profile" becomes how a player learns geochemistry — why opal wins over quartz in cold fluids, why proustite is rare (low base + competition + edge-of-gate stacking), why TN457 fires barite-after-sphalerite (substrate epitaxy + initiative order).

The fixed-order loop served well through 126 versions. Graduated competition is what the next stretch needs.

— Professor + 🪨✍️ + builder (rev 2)
