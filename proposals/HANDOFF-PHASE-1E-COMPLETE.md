# HANDOFF: Phase 1e COMPLETE — dissolution credit unification

**Author:** Claude (Opus 4.7), 2026-05-06
**Audience:** future sessions opening this work cold
**Status:** structurally complete; 182/~185 inline credit sites migrated to MINERAL_DISSOLUTION_RATES; remaining 3 are zone-trace credits that don't fit the table by design

---

## TL;DR

Phase 1e (May 2026) moved per-mineral dissolution credits out of the
twelve engine files and into a single declarative table:
`MINERAL_DISSOLUTION_RATES` in `js/19-mineral-stoichiometry.ts`. The
wrapper `applyMassBalance` now credits fluid for negative-thickness
zones the same way it debits for positive-thickness zones — uniformly,
data-driven, no inline duplication.

The campaign ran v37 → v53 across 16 commits. Each commit byte-identical
to its predecessor (per-scenario JSON.stringify across all 20 seed-42
scenarios; `npm test` 63/63 green at every step).

```
v37 (start)          inline credits across 12 engine files (~185 lines)
v38                  MINERAL_DISSOLUTION_RATES infra, empty
v39 batch 1          fluorite, halite, borax, goethite, lepidocrocite (8)
v40 batch 2          oxides + native elements (16)
v41 batch 3          sulfates (16)
v42 batch 4          arsenates + phosphates/vanadates (24)
v43 batch 5          silicates single-mode (24)
v44 batch 6          carbonates single-mode (16)
v45 batch 7          sulfides single-mode (32)
v46 batch 8 infra    extends table type for __modes + per-species clamp
v47 batch 8          pyrite + marcasite multi-mode (12)
v48 batch 9          aragonite multi-mode (4)
v49 batch 10         rhodochrosite + azurite + GrowthZone ctor fix (8)
v50 batch 11         erythrite + annabergite (8)
v51 batch 12         chrysocolla (4)
v52 batch 13         wurtzite single-mode constants (2)
v53 batch 14 closer  acanthite + cobaltite + native_silver (-rates) (6)
```

---

## Final state

### Table shape

```ts
type DissolutionRates = Record<string, number>;
type DissolutionMode = { rates: DissolutionRates } | { constants: DissolutionRates };
type DissolutionEntry = DissolutionRates | { __modes: Record<string, DissolutionMode> };
```

Two top-level shapes:
- **Single-mode rates (legacy):** `fluorite: { Ca: 0.4, F: 0.6 }`. Wrapper
  multiplies each rate by `dissolved_um`.
- **Multi-mode dispatch:** `pyrite: { __modes: { oxidative: {...}, acid: {...} } }`.
  Engine emits `dissolutionMode: '<name>'` on the GrowthZone; wrapper
  resolves the mode and applies its credits.

Within multi-mode, each mode is either:
- `{ rates: {...} }` — multiplied by `dissolved_um` (rate-scaled).
- `{ constants: {...} }` — added once, regardless of `|thickness_um|`.
  Used where the engine emits a fixed thickness like -1.2 that doesn't
  round-trip through IEEE-754 division (e.g. `1.2 * (0.4/1.2) ≠ 0.4`).

### Wrapper logic

```ts
if (zone.thickness_um < 0) {
  const entry = MINERAL_DISSOLUTION_RATES[crystal.mineral];
  if (!entry) return null;
  const dissolved_um = -zone.thickness_um;
  let credits, isConstant;
  if (entry.__modes) {
    const modes = entry.__modes;
    const mode = zone.dissolutionMode
      ? modes[zone.dissolutionMode]
      : modes[Object.keys(modes)[0]];
    if (!mode) return null;
    if (mode.constants) { credits = mode.constants; isConstant = true; }
    else                { credits = mode.rates;     isConstant = false; }
  } else {
    credits = entry; isConstant = false;
  }
  for (const species in credits) {
    if (typeof fluid[species] !== 'number') continue;
    const rate = credits[species];
    const delta = isConstant ? rate : dissolved_um * rate;
    if (rate < 0) fluid[species] = Math.max(0, fluid[species] + delta);
    else          fluid[species] += delta;  // legacy `+=` path verbatim
  }
  return null;
}
```

Per-species `if (rate < 0)` clamp: positive rates take the legacy
`fluid += delta` path bit-for-bit (preserves accumulation order with
v45-and-earlier baselines); negative rates get
`fluid = Math.max(0, fluid + delta)` matching the legacy
`fluid = Math.max(fluid - x, 0)` inline pattern.

A universal clamp drifted bisbee at v46 — the legacy code permitted
ulp-level negatives in fluid state (via subtraction rounding) that
clamping at the dissolution credit site shifted downstream nucleation
gates. The conditional clamp avoids this.

### GrowthZone constructor

`js/27-geometry-crystal.ts` had a dataclass-style constructor that only
copied explicitly-named fields. `dissolutionMode` was silently dropped.
Fixed at v49:

```ts
if (opts.dissolutionMode) this.dissolutionMode = opts.dissolutionMode;
```

The bug was masked at v47/v48 because the affected non-default modes
(pyrite acid, marcasite acid, marcasite oxidative when first-mode-was-
inversion, aragonite acid) didn't fire in any seed-42 scenario.
Rhodochrosite acid did fire in `reactive_wall` and exposed it
(Mn rate 0.4 vs the correct 0.5 ppm/µm shifted max_um from 1739.6 to
1710 µm). Confirmed by regenerating the v48 baseline under the fixed
constructor — produces byte-identical output to the committed v48.

---

## What remains inline (and why it should stay there)

3 sites total. All zone-data traces, not rate-scaled.

### Calcite Mn + Fe trace credits (`js/52-engines-carbonate.ts:42-43`)

```ts
conditions.fluid.Mn += last_3_zones.average(z => z.trace_Mn) * 0.05;
conditions.fluid.Fe += last_3_zones.average(z => z.trace_Fe) * 0.05;
```

The credit isn't `dissolved_um × rate` — it's a function of the crystal's
zone history (averaging the trace_Mn/trace_Fe across the last few zones).
The table format can't represent zone-history-dependent credits without
a callback machinery, which isn't worth the abstraction for two species.

### Arsenopyrite Au-trap (`js/61-engines-sulfide.ts:360`)

```ts
conditions.fluid.Au += zone_trace_Au_sum * AU_RECOVERY_FACTOR;
```

Releases the invisible-gold trace that arsenopyrite trapped during
growth (per-zone trace_Au summed across the crystal's history). Same
zone-data-dependence as calcite; not rate-scaled.

### pH adjustments

A handful of engines adjust `conditions.fluid.pH` at dissolution time
(e.g. acid attack on carbonate releases H⁺ that's already accounted
for elsewhere). Not in scope of the dissolution credit table — pH is
an activity not a mole reservoir, handled separately by the planned
Phase 4d pH dynamics infrastructure.

---

## Verification methodology

Per batch:

1. Edit table + engine; bump SIM_VERSION; rebuild (`npm run build`).
2. `node tools/gen-js-baseline.mjs` → writes `tests-js/baselines/seed42_v<N>.json`.
3. Per-scenario JSON.stringify diff via inline Node script:

   ```sh
   node -e "
   const fs = require('fs');
   const a = JSON.parse(fs.readFileSync('tests-js/baselines/seed42_v<prev>.json'));
   const b = JSON.parse(fs.readFileSync('tests-js/baselines/seed42_v<N>.json'));
   for (const s of Object.keys(a)) {
     if (JSON.stringify(a[s]) !== JSON.stringify(b[s])) console.log('MISMATCH:', s);
   }
   "
   ```

   Expected output: nothing (silent pass) → `ALL 20 BYTE-IDENTICAL`.

4. `npm test` → expected 63/63 green.

**Why per-scenario JSON, not file-level diff:** Windows `git autocrlf`
flips CRLF/LF on the committed v45 baseline, so `diff seed42_v45.json
seed42_v46.json` shows ~1KB of churn even when content is identical.
Per-scenario `JSON.stringify` is line-ending-agnostic.

---

## Followups queued

These are real but out of Phase 1e scope. Each has its own handoff or
slot in the project todo list.

- **Phase 4c** — flag flip dynamic-Eh + tune EH_DAMPING per class
  (`HANDOFF-PHASE-4C-FLAG-FLIP.md`).
- **Phase 4d** — pH dynamics infrastructure (consumes the inline pH
  adjustments noted above).
- **Phase 3 follow-up** — per-mineral carbonate equilibrium retuning.
- **Tutorial rework** — pending its own work package.
- **Renderer**: per-crystal random rotation around c-axis ("rotated
  cubes") — currently fluorite/halite cubes all face camera in lockstep.

---

## Files of record

| File | Phase 1e changes |
|---|---|
| `js/19-mineral-stoichiometry.ts` | MINERAL_DISSOLUTION_RATES table (~80 entries), applyMassBalance dispatch logic |
| `js/27-geometry-crystal.ts` | GrowthZone constructor: preserve `dissolutionMode` |
| `js/15-version.ts` | SIM_VERSION 37 → 53 with full per-bump changelog |
| 12 engine files | inline credits removed, GrowthZones tagged with `dissolutionMode` |
| `tests-js/baselines/seed42_v{38..53}.json` | one per SIM_VERSION bump, all byte-identical |

---

*Phase 1e is the longest single refactor campaign in the project so far,
spanning 16 commits and ~700 lines of net diff. The bedrock holds.* 🪨
