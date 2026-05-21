# 06: Engine Gates Refactor — Single Source of Truth for σ_crit

**Date:** 2026-05-21
**Author:** builder (planning), boss-approved
**Status:** Scoped for v127 infrastructure phase
**Prerequisites:** Q1 + Q-B resolutions from `05-open-questions.md`

---

## The Problem

`σ_crit` (the supersaturation threshold below which a mineral can't nucleate) currently lives implicitly in ~25 `js/3X-supersat-*.ts` engine files as the first early-out check inside each `supersaturation_<mineral>()` function:

```typescript
// js/41-supersat-sulfide.ts (illustrative)
function supersaturation_sphalerite(conditions) {
  const T = conditions.temperature;
  if (T < 80 || T > 350) return 0;     // T-gate
  const f = conditions.fluid;
  if (f.Zn < 1 || f.S < 1) return 0;   // composition gate
  // ...lots of factor calculations
  const sigma_total = /* ... */;
  if (sigma_total < 1.8) return 0;     // σ_crit gate — THIS is what we want to extract
  return sigma_total;
}
```

The σ_crit threshold for sphalerite (`1.8` in this example) is what the initiative system needs for the edge-of-gate modifier. The temperature range (`80, 350`) is what the temperature modifier needs. The composition gate is implicit in the σ value already.

**Right now these thresholds are scattered across 25+ files.** They can't be read programmatically without source parsing, and source parsing is fragile (refactors break it, comments confuse it, multi-line conditions break it).

---

## The Refactor

Each engine exports a structured `MINERAL_GATES_<mineral>` constant that names every gate by category:

```typescript
// js/41-supersat-sulfide.ts (after refactor)

const MINERAL_GATES_sphalerite = {
  // σ-gate
  sigma_crit: 1.8,

  // Temperature gate
  T_min: 80,
  T_max: 350,
  T_optimal: 200,        // for initiative temperature modifier sweet-spot

  // Composition gates (which fluid species must be present above what level)
  fluid_min: { Zn: 1, S: 1 },

  // pH gate (if any)
  pH_min: 2,
  pH_max: 9,

  // O2 redox gate (if any)
  O2_min: 0,
  O2_max: 1.5,

  // Surface energy category for initiative modifier
  surface_energy: 'medium',  // 'very_low' | 'low' | 'medium' | 'high' | 'very_high'

  // Notes / provenance
  _sources: ['Karthikeyan et al. 2002', 'sphalerite engine v17+'],
};

function supersaturation_sphalerite(conditions) {
  const gates = MINERAL_GATES_sphalerite;
  const T = conditions.temperature;
  if (T < gates.T_min || T > gates.T_max) return 0;
  const f = conditions.fluid;
  for (const [species, min_val] of Object.entries(gates.fluid_min)) {
    if (f[species] < min_val) return 0;
  }
  if (f.pH < gates.pH_min || f.pH > gates.pH_max) return 0;
  if (f.O2 < gates.O2_min || f.O2 > gates.O2_max) return 0;
  // ...factor calculations (unchanged)
  const sigma_total = /* ... */;
  if (sigma_total < gates.sigma_crit) return 0;
  return sigma_total;
}
```

Behavior is byte-identical to pre-refactor. The values are now READABLE from outside.

---

## Reader API

Initiative and library code import the gates registry:

```typescript
// js/20-initiative.ts
import { MINERAL_GATES_REGISTRY } from './3X-mineral-gates';

function edgeOfGateModifier(mineralName: string, sigma: number): number {
  const gates = MINERAL_GATES_REGISTRY[mineralName];
  if (!gates) return 0;
  const ratio = sigma / gates.sigma_crit;
  if (ratio < 1.0) return -2;
  if (ratio < 1.1) return -2;
  if (ratio < 1.3) return -1;
  if (ratio > 2.0) return +1;
  return 0;
}

function temperatureModifier(mineralName: string, fluid: Fluid): number {
  const gates = MINERAL_GATES_REGISTRY[mineralName];
  if (!gates || gates.T_optimal == null) return 0;
  const T = fluid.temperature;
  if (T < gates.T_min || T > gates.T_max) return -3;
  const range = gates.T_max - gates.T_min;
  const dist = Math.abs(T - gates.T_optimal) / range;
  if (dist < 0.2) return +2;
  if (dist < 0.5) return +1;
  return 0;
}
```

```typescript
// js/9X-ui-library.ts (Competitiveness profile section)
import { MINERAL_GATES_REGISTRY } from './3X-mineral-gates';

function renderCompetitivenessProfile(mineralName: string): HTMLElement {
  const gates = MINERAL_GATES_REGISTRY[mineralName];
  if (!gates) return /* "uncalibrated" placeholder */;

  return html`
    <section class="competitiveness-profile">
      <h3>Competitiveness Profile</h3>
      <dl>
        <dt>Critical supersaturation σ_crit</dt>
        <dd>${gates.sigma_crit.toFixed(2)}</dd>

        <dt>Temperature sweet-spot</dt>
        <dd>${gates.T_min}–${gates.T_max} °C (optimal ${gates.T_optimal})</dd>

        <dt>Surface energy</dt>
        <dd>${gates.surface_energy} γ_sl</dd>

        <dt>Competition group</dt>
        <dd>${Object.keys(gates.fluid_min).join(', ')}</dd>

        <dt>Cascade ripple potential</dt>
        <dd>${getStoichKeys(mineralName).length} cations</dd>
      </dl>
    </section>
  `;
}
```

---

## The Registry Module

A single `js/3X-mineral-gates.ts` (or similar) collects all the per-engine gates exports into a registry that initiative + library can import:

```typescript
// js/3X-mineral-gates.ts (or maybe better: auto-generated from engine exports)

const MINERAL_GATES_REGISTRY: Record<string, MineralGates> = {
  // Carbonates
  calcite: MINERAL_GATES_calcite,
  aragonite: MINERAL_GATES_aragonite,
  dolomite: MINERAL_GATES_dolomite,
  // ...
  // Sulfides
  sphalerite: MINERAL_GATES_sphalerite,
  // ...
  // (~145 entries total)
};

interface MineralGates {
  sigma_crit: number;
  T_min: number;
  T_max: number;
  T_optimal?: number;            // optional; defaults handled by modifier function
  fluid_min: Record<string, number>;
  pH_min?: number;
  pH_max?: number;
  O2_min?: number;
  O2_max?: number;
  surface_energy: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  _sources?: string[];
}
```

---

## Migration scope

**Files to touch (~25):**

```
js/30-supersat-arsenate.ts       (8 minerals: scorodite, adamite, ...)
js/31-supersat-arsenate-uranyl.ts
js/32-supersat-carbonate.ts      (10 minerals: calcite, aragonite, ...)
js/33-supersat-borate.ts
js/34-supersat-halide.ts
js/35-supersat-hydroxide.ts
js/36-supersat-native.ts
js/37-supersat-oxide.ts
js/38-supersat-phosphate.ts
js/39-supersat-silicate.ts       (12+ minerals: quartz, opal, ...)
js/40-supersat-sulfate.ts        (8 minerals: barite, gypsum, ...)
js/41-supersat-sulfide.ts        (15+ minerals: sphalerite, pyrite, ...)
js/42-supersat-tellurate.ts
js/43-supersat-vanadate.ts
js/44-supersat-molybdate.ts
js/45-supersat-tungstate.ts
```

(Counts approximate; the exact split depends on file structure.)

**Migration approach:**

1. **One file at a time**, smallest first. Each engine's σ_crit + T-range + composition gate get hoisted into the exported constant.
2. **Build + test after each file.** No baseline drift expected (this is internal refactor only).
3. **Add the gates registry** once all engines are migrated.
4. **Add guard test** in `tests-js/engine-gates-exports.test.ts`: every entry in `MINERAL_ENGINES` must have a corresponding entry in `MINERAL_GATES_REGISTRY`. Fail loud on missing.

---

## What this unlocks

1. **Initiative module reads σ_crit + T-range without parsing.**
2. **Library card displays T-range / σ_crit / competition group on every mineral card.**
3. **Future "calibration sweep" tool can vary σ_crit per mineral and check baseline drift** — useful for the v129 modifier tuning phase.
4. **Documentation in code**: anyone reading an engine file sees the gates upfront before getting lost in the σ calculation.
5. **Removes the source-parsing fragility** that the original proposal §03 Option A suggested.

---

## Risks

1. **~25 files to refactor.** Tedious but mechanical. ~half-day to full-day if focused.
2. **Some engines may not have a single first-gate σ_crit value** — they may compute σ_crit dynamically based on temperature or composition. Those need to either declare a representative σ_crit constant (e.g., σ_crit_25C) or expose the function. Most do have a literal threshold.
3. **Some engines have multiple σ-gates** (different precipitation regimes). Pick the LOWEST σ-gate as σ_crit for nucleation purposes; the higher gates are growth regime transitions, not nucleation thresholds.
4. **Stale comments / typos in existing engine files** may surface during the refactor pass. Fix them as encountered, document in commit.

---

## Status

Scoped, ready for v127 infrastructure phase. Estimate: 1 day of focused refactor work. Each engine touched gets a small commit; final commit adds the registry + library card.

— builder, 2026-05-21
