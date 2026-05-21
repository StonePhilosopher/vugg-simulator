# PROPOSAL: Initiative Variable for Competitive Mineral Growth

**Status:** Draft — ready for builder review  
**Authors:** Professor (concept), Rockbot (research & spec)  
**Date:** 2026-05-21  
**Related:** PROPOSAL-SPECIMEN-OBJECT.md §Q7, HANDOFF-FIELD-NOTES-V117-V124.md, v125 cascade findings  
**SIM_VERSION target:** v126+ (incremental) or v130+ (major arc)

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

### 3.1 Core Mechanic: Initiative Roll

Each step, before growth:

```typescript
interface InitiativeResult {
  mineral: string;
  baseInitiative: number;      // from σ
  modifiers: InitiativeModifier[];
  finalInitiative: number;
  rollReason: string;           // for debug/trace
}

interface InitiativeModifier {
  source: string;              // "temperature", "edge-of-gate", "surface-energy", "competition", "substrate"
  value: number;               // can be positive or negative
  reason: string;
}
```

**Algorithm:**
1. For each mineral with σ > 0, calculate **base initiative** = f(σ)
2. Apply **conditional modifiers** (see §3.2)
3. Sort minerals by **final initiative** (descending)
4. Process growth in that order
5. After each mineral grows, debit fluid → recalculate σ for remaining minerals
6. If σ drops below threshold for any remaining mineral, it skips this step

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
  const competitors = activeMinerals.filter(m => 
    m !== mineral && m.stoichiometryKeys().some(c => myCations.includes(c))
  );
  
  if (competitors.length === 0) return 0;
  if (competitors.length === 1) return -1;
  return -2; // 2+ competitors = dense suite penalty
}
```

**Dense suite penalty** explains why supergene_oxidation and schneeberg are cascade-prone: many minerals share Cu, Zn, Pb, As. Adding any new stoichiometry entry for a shared cation displaces multiple competitors.

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

## 4. Implementation Plan

### Phase 1: Infrastructure (v126)

1. **Add initiative calculation module** (`js/20-initiative.ts`)
   - Base initiative function
   - Modifier registry (temperature, edge-of-gate, surface-energy, competition)
   - Sorting algorithm
   - Debug logging

2. **Add spec fields** to `data/minerals.json`:
   - `preferredTempRange: [min, max, optimal]` (optional)
   - `criticalSupersaturation: number` (optional, default 0.5)
   - `surfaceEnergy: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'` (optional, default 'medium')

3. **Gate behind feature flag**
   - `SIM_VERSION < 126`: old behavior (fixed order)
   - `SIM_VERSION >= 126`: initiative sort
   - `?initiative=off` URL param to disable

4. **Add calibration test**
   - Seed 42 baseline comparison: old vs new
   - Expect drift in dense suites (supergene_oxidation, schneeberg)
   - Accept drift if it improves paragenesis realism

### Phase 2: Modifier Tuning (v127–v129)

1. **Calibrate temperature ranges** for top 20 minerals
   - Use literature Ksp(T) data
   - Adjust until seed-42 baselines are stable

2. **Calibrate σ_crit values**
   - Derive from engine gate thresholds
   - Edge-of-gate penalty should predict v125 cascade minerals

3. **Tune competition penalty**
   - Test dense suites: supergene_oxidation, schneeberg, roughten_gill
   - Penalty should reduce cascade severity without eliminating it

### Phase 3: Substrate/Epitaxy (v130)

1. **Add substrate modifier**
   - Catalytic surfaces (e.g., calcite seeding aragonite)
   - Competition surfaces (e.g., barite vs sphalerite on same substrate)
   - Encapsulation detection

2. **Add overgrowth mechanics**
   - When B nucleates on A, A can continue growing if not fully covered
   - Coverage fraction determines fluid access penalty

### Phase 4: Stochastic Option (v131+)

1. Add `?initiative=stochastic` mode
2. Generate Monte Carlo baselines (100 runs per scenario)
3. Compare variance to natural paragenesis data

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

### New files:
- `js/20-initiative.ts` — initiative calculation module
- `tests-js/initiative.test.ts` — unit tests for modifier functions
- `tests-js/initiative-paragenesis.test.ts` — integration tests comparing old vs new
- `research/INITIATIVE-VARIABLE/` — research notes (this proposal, literature sources, calibration data)

### Modified files:
- `js/15-version.ts` — add v126+ initiative arc documentation
- `js/19-mineral-stoichiometry.ts` — competition modifier needs stoichiometry keys
- `data/minerals.json` — add preferredTempRange, criticalSupersaturation, surfaceEnergy fields
- `js/99-legacy-bundle.ts` — wire initiative sort into run_step
- `tests-js/calibration.test.ts` — add initiative-gated baseline comparison
- `proposals/HANDOFF-FIELD-NOTES-V117-V124.md` — extend with v126+ arc

---

## 7. Research Notes

See `research/INITIATIVE-VARIABLE/` subfolder for:
- `01-geochemical-grounding.md` — literature review (Arrhenius, Ksp(T), BCF theory)
- `02-v125-cascade-analysis.md` — empirical findings from cascade probes
- `03-modifier-calibration.md` — proposed temperature ranges and σ_crit values
- `04-implementation-notes.md` — builder-facing technical details
- `05-open-questions.md` — discussion threads

---

## 8. Bottom Line

The initiative variable is the architectural fix for the cascade problem the builder discovered in v125. It doesn't prevent cascades — it makes them **legible**. Edge-of-gate minerals get flagged as fragile. Shared-cation competition becomes explicit. Temperature sweet-spots emerge naturally from Ksp data.

The fixed-order loop served us well through 125 versions. But the next 125 need the crystals to compete.

— Professor + 🪨✍️
