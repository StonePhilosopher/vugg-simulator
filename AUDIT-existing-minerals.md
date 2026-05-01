# Vugg Simulator — Existing Mineral Audit vs Template

**Date:** 2026-04-14
**Purpose:** Check all 18 current minerals against `proposals/vugg-mineral-template.md` to identify gaps before adding new species.

---

## Summary

| Category | Has It | Missing |
|----------|--------|---------|
| Growth engines | 18 minerals | goethite (in legend, no engine) |
| Nucleation checks | 18 minerals | — |
| Supersaturation functions | 18 minerals | goethite |
| Flavor text (individual) | 8 detailed + 3 short | 7 minerals need full treatment |
| Thermal decomposition | calcite only (500°C) | 9 minerals that should decompose |
| Max crystal size cap | NONE | ALL minerals |
| Habit variants | some (quartz polymorphs, feldspar) | most have single habit |
| Twin laws | some (quartz dauphiné, pyrite, feldspar) | most minerals |
| Secondary chemistry release | some (calcite CO₂, malachite Cu²⁺) | most minerals |
| Stability (acid/water/light) | calcite, malachite (acid) | most minerals |

---

## Per-Mineral Detail

### ✅ Quartz
- **Has:** Supersaturation, growth engine, polymorph system (opal→chalcedony→α-quartz→β-quartz→tridymite), dauphiné twinning at 573°C, detailed narration, radiation coloring (smoky/amethyst), phantom detection
- **Missing:** Max crystal size cap, thermal decomposition (quartz doesn't decompose but β→tridymite at 870°C isn't modeled)
- **Template gaps:** No explicit max_length_mm, no stability section

### ✅ Calcite
- **Has:** Supersaturation, growth engine, thermal decomposition (500°C → CaO + CO₂), acid dissolution, detailed narration, Mn²⁺ fluorescence trigger, phantom detection
- **Missing:** Max crystal size cap, twin laws (rare in calcite but exists), habyés variants (dogtooth, nailhead, scalenohedral)
- **Best-covered mineral in the game**

### ⚠️ Fluorite
- **Has:** Supersaturation, growth engine, retrograde solubility, color system (purple/green/yellow/blue from trace elements), phantom detection
- **Missing:** Max crystal size cap, twin laws (fluorite commonly twins on {111}), thermal decomposition (melts at 1360°C but decomposes in acid), no acid dissolution, no cleavage modeling (perfect octahedral cleavage is THE fluorite thing)
- **Template gaps:** No stability section, no max_length_mm, no twin law

### ⚠️ Sphalerite
- **Has:** Supersaturation, growth engine, Fe coloring system (honey→black based on Fe mol%), detailed narration
- **Missing:** Max crystal size cap, twin laws (sphalerite twins on {111}), no thermal decomposition, no acid dissolution note
- **Template gaps:** No max_length_mm, no twin law, no stability

### ⚠️ Pyrite
- **Has:** Supersaturation, growth engine, pyritohedral habit (12 pentagonal faces), penetration twinning, detailed narration
- **Missing:** Max crystal size cap, cubic habit variant (pyrite has both cubic and pyritohedral), no thermal decomposition (oxidizes to limonite/sulfuric acid at high T)
- **Template gaps:** No max_length_mm, no decomposition products

### ⚠️ Chalcopyrite
- **Has:** Supersaturation, growth engine, narrates gold-brassy color
- **Missing:** Max crystal size cap, twin laws (chalcopyrite twins commonly), no thermal decomposition, no oxidation to secondary Cu minerals
- **Template gaps:** No max_length_mm, no twin law, no stability

### ⚠️ Hematite
- **Has:** Supersaturation, growth engine, rhombohedral habit narration, earthy/massive variant narration
- **Missing:** Max crystal size cap, no twin law, no thermal decomposition (actually stable at high T — but doesn't decompose, converts to magnetite above certain conditions)
- **Template gaps:** No max_length_mm

### ⚠️ Malachite
- **Has:** Supersaturation, growth engine, acid dissolution (releases Cu²⁺ + CO₂), botryoidal and acicular habit narration
- **Missing:** Max crystal size cap, no twin law (rare but exists)
- **Template gaps:** No max_length_mm

### ⚠️ Uraninite
- **Has:** Supersaturation, growth engine, flavor text (one-liner), radiation hazard note
- **Missing:** Max crystal size cap, no detailed narration function, no thermal decomposition, no oxidation to secondary U minerals
- **Template gaps:** No max_length_mm, no detailed narration (uses inline string, not _narrate function)

### ⚠️ Galena
- **Has:** Supersaturation, growth engine, nucleation cap (max 4), flavor text (one-liner)
- **Missing:** Max crystal size cap, cubic habit not explicitly modeled, no thermal decomposition, no oxidation to anglesite/cerussite
- **Template gaps:** No max_length_mm, no detailed narration function

### ⚠️ Molybdenite
- **Has:** Supersaturation, growth engine, nucleation cap (max 3), flavor text (one-liner)
- **Missing:** Max crystal size cap, platy habit not modeled, no thermal decomposition, no oxidation to wulfenite (the oxidation is modeled in wulfenite's supersaturation but not as decomposition of molybdenite itself)
- **Template gaps:** No max_length_mm, no detailed narration

### ⚠️ Smithsonite
- **Has:** Supersaturation, growth engine, narration function, botryoidal/massive habit
- **Missing:** Max crystal size cap, no twin law, no thermal decomposition
- **Template gaps:** No max_length_mm

### ⚠️ Wulfenite
- **Has:** Supersaturation, growth engine, narration function, thin tabular habit
- **Missing:** Max crystal size cap, twin law (rare but exists), no thermal decomposition
- **NOTE:** Currently can't actually nucleate because porphyry scenario only cools to ~240°C and wulfenite needs <80°C (documented in builder tasks)

### ⚠️ Selenite (Gypsum)
- **Has:** Supersaturation, growth engine, narration function, swallow-tail twin, desert rose/massive/cathedral habits
- **Missing:** Max crystal size cap, no dehydration to anhydrite (gypsum → anhydrite above ~60°C in dry conditions)
- **Template gaps:** No max_length_mm, no dehydration

### ⚠️ Feldspar
- **Has:** Supersaturation, growth engine, narration function, temperature-dependent polymorphs (orthoclase/microcline/sanidine/adularia/albite), amazonite (Pb coloring), twin laws (Carlsbad/Baveno/Manebach/cross-hatched), perthite exsolution, moonstone/adularia sheen
- **Missing:** Max crystal size cap, no thermal decomposition
- **Second-best covered mineral after calcite**

### ⚠️ Adamite
- **Has:** Supersaturation, growth engine, narration function
- **Missing:** Max crystal size cap, no twin law, no UV fluorescence (adamite fluoresces bright green under LW!)
- **Template gaps:** No fluorescence section

### ⚠️ Mimetite
- **Has:** Supersaturation, growth engine, narration function
- **Missing:** Max crystal size cap, no twin law, no UV fluorescence (mimetite can fluoresce yellow-orange)
- **Template gaps:** No fluorescence section

### ❌ Goethite
- **In legend but has NO growth engine, NO supersaturation, NO nucleation check**
- **Exists only as a color in the legend and possibly as a decomposition product**
- **Should either be fully implemented or removed from the legend**

---

## Priority Fixes

### Critical (affects all minerals):
1. **Max crystal size cap** — Add `max_length_mm` to ALL 18 minerals. No exceptions.
2. **_vug_sealed reset** — Already documented in BUG-vug-fill-overflow.md

### High (missing from most minerals):
3. **Thermal decomposition** — Only calcite has it. Sphalerite, pyrite, chalcopyrite, galena, molybdenite, malachite, smithsonite, selenite all decompose/oxidize at high temperatures
4. **Fluorescence** — Only calcite (Mn²⁺) has it. Fluorite, adamite, mimetite, sphalerite, wulfenite, and selenite all fluoresce in real life
5. **Twin laws** — Only quartz, pyrite, feldspar have them. Fluorite, sphalerite, galena, chalcopyrite, calcite, selenite commonly twin

### Medium:
6. **Goethite** — Implement or remove from legend
7. **Detailed narration functions** — Uraninite, galena, molybdenite use inline strings instead of `_narrate_*` functions
8. **Habit variants** — Most minerals have only one habit; real minerals have 2-4 common habits
9. **Acid dissolution** — Only calcite and malachite model it; fluorite, galena, smithsonite also dissolve in acids
10. **Oxidation chains** — Galena → anglesite/cerussite, molybdenite → wulfenite, chalcopyrite → malachite/azurite — some are partially modeled but not as decomposition products

### Standardization Recommendations:
- **All flavor text** should use `_narrate_*` functions (not inline strings)
- **All minerals** should have: max_length_mm, decomp_temp (null if stable), fluorescence (null if none), twin_law (null if rare), acid_reaction (null if resistant)
- **Template fields** that are "null/not applicable" should still be explicitly declared so the builder knows they were considered

---

*"18 minerals walked into a vug. Only calcite came out fully dressed."*
