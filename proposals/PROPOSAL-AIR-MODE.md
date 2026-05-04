# PROPOSAL: Air-mode end-to-end (cave / drained-vug paragenesis)

**Date drafted:** 2026-05-04
**Author:** Stone Philosopher (drafted with Claude)
**Status:** Future task — research complete, builder-ready
**Companion to:** `PROPOSAL-WIREFRAME-CRYSTALS.md`. Builds on Phase D v2 (orientation preferences, shipped at SIM_VERSION 23 — see `BACKLOG.md`).

---

## Overview

The renderer + engine already have `Crystal.growth_environment ∈ {'fluid', 'air'}` plumbed (commit `f7ce75f`, added at SIM_VERSION 22 — current head is at SIM_VERSION 23 after Phase D v2). The renderer's air-mode branch flips c-axis to gravity-down for ceilings (stalactite) and gravity-up for floors (stalagmite). But:

1. No scenario currently sets `'air'` on new crystals — the field is dormant.
2. Air-mode crystals reuse their habit primitive oriented straight down. Real stalactites are tapered dripstone columns, not single quartz prisms.
3. Air-cavity paragenesis brings in a whole class of evaporite minerals not in the current sim.

This proposal closes that loop: a drying-event scenario flips a flag, new nucleations go air-mode, and the renderer paints them as honest dripstone with a new `PRIM_STALACTITE` primitive. As a stretch, add a few characteristic evaporite minerals.

---

## Geological background

Sources: Hill & Forti 1997 *Cave Minerals of the World* (2nd ed.), Garcia-Ruiz et al. 2007 *Geology* 35 (Naica selenite), Hill 1996 *NMBMMR Bull. 117* (Lechuguilla), Sangster 1990 *Econ. Geol. Monograph 8* (MVT paragenesis).

### Chemistry shift on cavity drainage

When a vug drains, the system goes from closed-fluid-saturated to open-evaporative:

| Property | Fluid-filled vug | Drained / air cavity |
|---|---|---|
| CO₂ partial pressure | ~10⁻² atm dissolved | ~10⁻³·⁵ atm cave air |
| Calcite stability | At equilibrium with dissolved CO₂ | Supersaturates as drips degas |
| Evaporative concentration | None (closed system) | Strong (drips evaporate; soluble salts climb past saturation) |
| Soluble-salt threshold | Sulfates, chlorides stay dissolved | Mirabilite, epsomite, niter precipitate |
| Temperature | Hydrothermal (often 50–300 °C) | Cave ambient (10–25 °C; geothermal exceptions like Naica at ~58 °C) |
| Growth driver | Bulk-fluid supersaturation | Drip-rate × CO₂ degassing × evaporation |

### Stalactite-form mechanism (per mineral)

- **Calcite stalactites**: drip-rate-controlled. Slow drip (<1/min) + CO₂ degassing at the drip tip → soda-straw → stalactite. The PCO₂ contrast (cavity air vs source water) drives precipitation.
- **Aragonite stalactites / frostwork / anthodites**: high-Mg drip water (Mg/Ca > ~1) suppresses calcite nucleation. Aragonite branches form when *evaporation* exceeds drip rate (low humidity, airflow). Capillary force > gravity → helictites.
- **Gypsum stalactites**: SO₄-rich seepage with no degassing mechanism. Purely evaporative. Characteristic of dry caves like Lechuguilla.

### Air-cavity-only / strongly air-preferring minerals

Minerals that ONLY form (or strongly prefer) drained-vug / cave settings — not currently in the simulator:

1. **Mirabilite** (Na₂SO₄·10H₂O) — efflorescent, only stable <32 °C in evaporative settings; dehydrates instantly underwater
2. **Epsomite** (MgSO₄·7H₂O) — Mammoth-Cave-classic Mg-sulfate efflorescence
3. **Hexahydrite** (MgSO₄·6H₂O) — same family; lower-hydration variant
4. **Melanterite** (FeSO₄·7H₂O) — hydrated iron-sulfate from pyrite oxidation in dry settings
5. **Halotrichite** (FeAl₂(SO₄)₄·22H₂O) — efflorescent fibrous "hair salt"
6. **Niter** (KNO₃) — bat-guano-derived nitrate; strictly air-only
7. **Hydromagnesite** / **Huntite** — Mg-carbonate efflorescences from Mg-rich drip water
8. **Aragonite frostwork / anthodites** — capillary-fed, air-cavity-specific (already-existing aragonite mineral, but air-only habit)
9. **Helictites** — capillary force > gravity; impossible underwater. Could be encoded as a calcite/aragonite habit variant rather than a new mineral.
10. **Cave pearls** — agitated drip-pool calcite. Habit variant of calcite or aragonite.

### Characteristic published scenarios

Real cave systems map to scenario presets:

- **Naica, Mexico** — geothermal pool selenite (Ca-SO₄ saturated, ~58 °C, slow cooling 500 ky). Already partially covered by current `selenite` scenarios.
- **Lechuguilla / Carlsbad, NM** — sulfuric-acid speleogenesis. Gypsum + aragonite + native sulfur suite. Distinct chemistry: H₂SO₄-driven dissolution and re-precipitation.
- **Mammoth Cave, KY** — vadose evaporative. Epsomite + mirabilite + gypsum-flower efflorescences.
- **Wind Cave / Jewel Cave, SD** — boxwork + aragonite frostwork. Mg-rich vadose late-stage.
- **Optymistychna, Ukraine** — gypsum cave; helictites and selenite roses.

---

## Build plan (4–6 hours)

### Stage A: Stalactite primitive + render polish

1. Add `PRIM_STALACTITE`: tapered cone with vertical ridges, ~24 vertices arranged in 4 latitude rings × 6 longitude points, plus an apex tip. Aspect ratio long/narrow (c-length × 3–4 of a-width). Anchor at the *base* (ceiling-side) so when the renderer flips it to gravity-down, the wide base sits at the wall and the tip points at the floor.
2. Add `PRIM_STALAGMITE`: similar shape, but apex at the bottom widening upward (or just reuse `PRIM_STALACTITE` and let the renderer flip it via its existing fluid/air orientation logic).
3. Habit-resolution: when `crystal.growth_environment === 'air'` AND habit is one of `prismatic / acicular / botryoidal / scalenohedral / rhombohedral`, override the primitive to `PRIM_STALACTITE` (ceiling) or `PRIM_STALAGMITE` (floor). Keep cubic / octahedral / tetrahedral habits as their normal primitives even in air mode (cubic minerals don't form dripstone — they form cave-floor druze or wall encrustations).
4. The drusy clustering logic should still apply for finely-grained air-mode habits (efflorescences = many tiny crystals).

### Stage B: Air-mode trigger via scenario events

1. Add to `VugConditions` (Python and JS): `growth_environment: str = 'fluid'` — the *current* environment, distinct from per-crystal historical record.
2. Modify `event_supergene_dry_spell` and `event_bisbee_final_drying` to set `conditions.growth_environment = 'air'`.
3. Optionally add events that flip back to fluid (re-flooding) — for paragenesis variety.
4. Modify nucleation to read `conditions.growth_environment` when stamping `crystal.growth_environment`. The default is whatever the conditions say at the moment of nucleation; this naturally produces mixed paragenesis if the environment changes mid-run.
5. Tests:
   - Run `bisbee_final_drying` to step ≥305; assert all post-step-305 nucleations have `growth_environment === 'air'`.
   - Visual: 3D render shows distinct stalactites on ceiling cells AFTER the drying event.

### Stage C: Evaporite minerals (stretch)

Pick 3–5 of the air-cavity-only minerals from the list above and add them to `data/minerals.json` + `MINERAL_ENGINES`. Suggested starter trio:

1. **Epsomite** — easy: MgSO₄·7H₂O. Saturation = (Mg)·(S)·factor(humidity). Activate when `growth_environment == 'air'` and Mg, S both above thresholds. Habit: `acicular` (existing primitive) OR a new `efflorescence_tuft` cluster habit.
2. **Mirabilite** — same chemistry minus Mg, plus Na. Easier to wire if the existing fluid already tracks Na (check).
3. **Helictite** (calcite habit variant, NOT a new mineral) — when `growth_environment == 'air'` AND mineral == 'calcite' AND habit roll is favorable, set habit = 'helictite'. Renderer maps to a new `PRIM_HELICTITE` (a thin curved spiral — creative geometry).

Stage C bumps SIM_VERSION 23 → 24 (or higher if intervening engine work has bumped it further).

### Stage D: New scenario — "Naica-style geothermal pool"

Optional. A scenario that demonstrates the air-mode pipeline cleanly:
- Initial fluid-filled, hot, Ca-SO₄-saturated → grows fluid-mode selenite (already works)
- Mid-scenario "ventilation" event → drops PCO₂ and starts evaporation, growth_environment flips to 'air'
- Late-stage efflorescence growth on ceiling

---

## Files impacted

- `vugg.py`: VugConditions.growth_environment field, event handlers for the two drying events, nucleation reading the field. SIM_VERSION bump. Optional: 3–5 new mineral engines (Stage C).
- `index.html` JS mirror: same changes.
- `data/minerals.json`: optional new minerals (Stage C).
- `data/scenarios.json5`: optional new scenario (Stage D).
- `tests/`: new test for air-mode propagation.

Test baselines need regeneration on SIM_VERSION bump.

---

## Key uncertainties / open questions

1. **Should the conditions-level `growth_environment` flip ONLY through scenario events, or should it also auto-flip from chemistry?** (E.g. when humidity drops below a threshold.) Cleanest is "scenario-explicit only" — keeps the engine deterministic.
2. **Mixed paragenesis edge cases**: what if a fluid-mode crystal is mid-growth when the cavity drains? Does it stop growing, or shift to air-mode growth dynamics? Cleanest answer: the crystal's *recorded* growth_environment stays at its nucleation value, but ongoing growth happens under the *current* fluid/air physics. Keeps history honest while allowing realistic phase-transition.
3. **Scenario-specific habit priors** — when air-mode is on and mineral is calcite, should we automatically prefer dripstone-favoring habits over rhombohedral? (Probably yes, but introduces another bias table.)
4. **Helictite geometry** — the spiral capillary form is genuinely hard to render with a static vertex/edge primitive. May need a parametric primitive (vertices computed at render time from a curve).

---

## Recommendation

Stage A (stalactite primitive) + Stage B (event triggers) is the minimum viable air-mode and what the user originally asked for. Stages C and D are independent extensions; pick them up if appetite remains after A+B. The geology research in this document is sufficient context for a builder to execute Stages A+B without re-researching.
