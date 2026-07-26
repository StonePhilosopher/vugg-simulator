# Vugg Simulator — Mineral Accuracy Audit
**Started: 2026-03-30 by Professor and 🪨✍️**
**Status: In Progress**

This document compares the game's current mineral formation conditions against real geological data. Each mineral gets: real conditions, game conditions, discrepancies, and recommended fixes.

---

## Variable Reference

### Currently tracked
| Variable | Game Label | What It Actually Is |
|----------|-----------|-------------------|
| T | Temperature (°C) | Fluid temperature |
| P | Pressure (kbar) | Hydrostatic/lithostatic pressure |
| SiO₂ | Silica | Dissolved silica in fluid (ppm) |
| Ca | Calcium | Dissolved Ca²⁺ (ppm) |
| CO₃ | Carbonate | Dissolved carbonate (ppm) |
| F | Fluorine | Dissolved fluoride (ppm) |
| Zn | Zinc | Dissolved Zn²⁺ (ppm) |
| S | Sulfur | Dissolved reduced sulfur (H₂S/HS⁻) (ppm) |
| Fe | Iron | Dissolved Fe²⁺/Fe³⁺ (ppm) |
| Mn | Manganese | Dissolved Mn²⁺ (ppm) |
| Al | Aluminum | Dissolved Al³⁺ (ppm) |
| Ti | Titanium | Dissolved Ti⁴⁺ (ppm) |
| Pb | Lead | Dissolved Pb²⁺ (ppm) |
| U | Uranium | Dissolved U (ppm) |
| Cu | Copper | Dissolved Cu²⁺ (ppm) |
| Mo | Molybdenum | Dissolved Mo (ppm) — v1, needs revision |
| O₂ | Oxygen | Dissolved O₂ / redox state (proxy for fO₂) |
| pH | pH | Acidity/alkalinity |
| Salinity | Salinity | Total dissolved solids (wt% NaCl equiv.) |
| Flow | Flow Rate | Fluid throughput rate |

### Potentially missing
| Variable | Why It Matters |
|----------|---------------|
| fO₂ (oxygen fugacity) | Controls Fe²⁺/Fe³⁺ ratio, sulfide/sulfate boundary. More precise than dissolved O₂. |
| fS₂ (sulfur fugacity) | Controls which sulfides form. Pyrite vs pyrrhotite vs marcasite. |
| CO₂ (partial pressure) | Drives carbonate saturation. CO₂ degassing = calcite precipitation. Key mechanism. |
| Eh (redox potential) | Closely tied to fO₂ but more directly applicable to aqueous mineral stability. |
| Water:rock ratio | How much wall dissolves per unit fluid. Currently conflated with flow rate. |

---

## Mineral Audit

### 1. QUARTZ (SiO₂)

**Real conditions:**
- SiO₂ solubility in water is **strongly prograde** (increases with temperature)
- At 25°C: ~6 ppm SiO₂ dissolved. At 300°C: ~700 ppm. At 500°C: >1500 ppm.
- **Quartz precipitates when silica-rich hot fluid COOLS.** This is the fundamental mechanism.
- Hydrothermal quartz veins form at **150-600°C** typically. Most vug-lining quartz: 200-400°C.
- pH effect: neutral to slightly acidic favors quartz. Very low pH + F attacks quartz (HF dissolution).
- Growth rate: extremely slow. Natural crystals: ~0.1-1 mm per thousand years in some systems.
- Amethyst (purple quartz): Fe³⁺ from irradiation of Fe-bearing quartz, forms at 200-300°C.

**Game conditions (current):**
- `supersaturation_quartz()`: uses `exp(0.008 * T)` in denominator — higher T = LOWER supersaturation.
- This means the game precipitates quartz at LOW temperatures. **THIS IS BACKWARDS.**
- In reality, quartz dissolves at high T (more soluble) and precipitates on cooling.

**Discrepancy: MAJOR ❌**
The game has quartz forming at low temperatures. In reality, quartz needs hot fluid that's cooling. The supersaturation should INCREASE as temperature drops from a high starting point. The mechanism is: load SiO₂ into fluid at high T (where it's soluble), then cool the fluid → SiO₂ becomes supersaturated → quartz precipitates.

**Fix:** Quartz supersaturation should be based on the difference between current SiO₂ concentration and the equilibrium solubility at current temperature. Solubility curve: ~6 ppm at 25°C, ~100 ppm at 100°C, ~300 ppm at 200°C, ~700 ppm at 300°C. If fluid has 500 ppm SiO₂ and T drops to 200°C (where equilibrium is 300 ppm), the excess 200 ppm drives precipitation.

---

### 2. CALCITE (CaCO₃)

**Real conditions:**
- Calcite has **retrograde solubility** — it becomes LESS soluble as temperature INCREASES.
- Mechanism: CO₂ solubility decreases with rising temperature. Less CO₂ → higher pH → CaCO₃ precipitates.
- This is why hot springs deposit travertine — the water heats up and calcite falls out.
- In MVT deposits: calcite forms at **75-200°C** (fluid inclusion data).
- In hydrothermal veins: can form up to ~350°C but most commonly 50-200°C.
- pH is critical: acid dissolves calcite (fizzes in HCl!), alkaline favors precipitation.
- Can form at surface temperature (25°C) — limestone, shells, cave formations.
- CO₂ degassing is the #1 precipitation trigger in nature.

**Game conditions (current):**
- `supersaturation_calcite()`: uses `exp(-0.005 * T)` in denominator — higher T = HIGHER supersaturation.
- This means the game precipitates calcite at HIGH temperatures. **Correct direction!**
- Retrograde solubility is approximately captured.
- pH effects are modeled (acid dissolves, alkaline favors). ✓

**Discrepancy: MINOR ⚠️**
The temperature dependence direction is correct (retrograde), but the range may be off. The game allows calcite at very high T (>400°C) where in reality calcite decomposes to CaO + CO₂ above ~500°C. Should cap the high end.

**Fix:** Add a high-temperature cutoff around 500°C. Consider adding CO₂ degassing as a specific trigger mechanism.

---

### 3. FLUORITE (CaF₂)

**Real conditions:**
- Forms in MVT deposits at **85-185°C** (fluid inclusion data, multiple studies).
- Can form at higher T in hydrothermal veins (up to ~300°C).
- Needs Ca²⁺ and F⁻ in solution. Precipitation triggered by:
  - Fluid mixing (two different fluids meet)
  - Temperature decrease
  - pH change
- Fluorite has **retrograde solubility** (like calcite) — less soluble at higher T.
- Very common associate of sphalerite and galena in MVT deposits.
- Famous purple/green/blue colors from REE substitution and radiation damage.

**Game conditions (current):**
- `supersaturation_fluorite()`: uses `exp(-0.003 * T)` — higher T = higher supersaturation.
- This gives fluorite prograde behavior (forms at high T). **THIS IS BACKWARDS.**

**Discrepancy: MODERATE ❌**
Fluorite should have retrograde solubility like calcite. It should form more readily at lower temperatures (within its stability range of ~50-300°C).

**Fix:** Flip the temperature dependence. Fluorite should precipitate more readily at lower T. Sweet spot around 100-200°C for MVT settings.

---

### 4. PYRITE (FeS₂)

**Real conditions:**
- **Enormously wide temperature range**: from ambient (biogenic, ~25°C) to >600°C (magmatic-hydrothermal).
- In hydrothermal systems: commonly 100-500°C.
- In sedimentary environments: can form at surface T via microbial sulfate reduction.
- Requires: Fe²⁺ + reduced sulfur (H₂S). **Must be REDUCING conditions** — O₂ destroys pyrite.
- fS₂ (sulfur fugacity) controls whether you get pyrite vs pyrrhotite vs marcasite.
- In porphyry Cu deposits: pyrite forms throughout the hydrothermal sequence, 250-500°C.
- In MVT deposits: 80-200°C.
- Oxidation product: iron oxides (hematite/goethite) + sulfuric acid. "Acid mine drainage."

**Game conditions (current):**
- T window: 100-400°C (outside this range, T_factor drops to 0.5). Reasonable. ✓
- Requires Fe + S + reducing (O₂ < 1.5). ✓
- Oxidation kills it. ✓

**Discrepancy: MINOR ⚠️**
The temperature window could be broader (pyrite forms at much lower T in sedimentary settings, and higher T in magmatic settings). The T_factor using a hard window is simplistic but not wrong for the game's scope.

**Fix:** Widen T window slightly (50-500°C), or keep as-is for gameplay balance.

---

### 5. CHALCOPYRITE (CuFeS₂)

**Real conditions:**
- Primary copper ore mineral. Forms in porphyry Cu deposits at **200-600°C**.
- Most chalcopyrite in porphyry systems precipitates at **300-500°C** during K-silicate alteration.
- Recent research (2025): can form at low T in acidic, metal-rich sediments — but this is rare.
- Requires: Cu + Fe + S in reducing conditions.
- At Bingham Canyon: Cu precipitates at 450-600°C, with ~90% deposited before cooling to 400°C.
- Very sensitive to fO₂ — needs intermediate redox. Too reducing: chalcocite. Too oxidizing: Cu-oxide minerals.

**Game conditions (current):**
- T window: 150-350°C (T_factor drops to 0.6 outside). **Too narrow and too low.**
- Requires Cu + Fe + S + reducing (O₂ < 1.5). ✓

**Discrepancy: MODERATE ❌**
The game's sweet spot (150-350°C) misses the main porphyry window (300-500°C). Chalcopyrite should peak at higher temperatures than the game currently allows.

**Fix:** Shift sweet spot to 200-500°C. Peak around 350-450°C.

---

### 6. SPHALERITE (ZnS)

**Real conditions:**
- In MVT deposits: **60-200°C** (fluid inclusion data).
- In higher-T hydrothermal systems: up to ~350°C.
- Classic MVT sphalerite forms by mixing of metal-bearing brine with H₂S-bearing groundwater.
- Color: pure ZnS is white/clear. Fe substitution → yellow → brown → black ("marmatite" when Fe-rich).
- Often co-precipitates with fluorite and galena.

**Game conditions (current):**
- Uses `exp(-0.004 * T)` — slightly prograde behavior. At typical MVT temps (100-150°C), this gives moderate σ.
- No explicit T window cutoff.

**Discrepancy: MINOR ⚠️**
The T dependence is roughly okay for a vug-scale game. Could tighten the sweet spot to favor 80-200°C.

**Fix:** Consider adding a T window (sweet spot 80-250°C) or at least reducing σ above 300°C.

---

### 7. GALENA (PbS)

**Real conditions:**
- In MVT deposits: **75-200°C** (similar to sphalerite).
- In hydrothermal veins: can form up to 400°C+.
- Classic association: galena + sphalerite + fluorite + calcite in MVT.
- Often the last major sulfide to precipitate in MVT paragenesis (after sphalerite).
- Perfect cubic cleavage is diagnostic.

**Game conditions (current):**
- Sweet spot: 200-400°C (σ × 1.3), drops above 500°C.
- This is **too high for MVT**, but reasonable for high-T hydrothermal.

**Discrepancy: MINOR ⚠️**
For the MVT preset, galena should form at lower temps (100-200°C). Current sweet spot is biased toward high-T systems.

**Fix:** Broaden the sweet spot downward: 100-400°C peak, with good precipitation at MVT temperatures.

---

### 8. HEMATITE (Fe₂O₃)

**Real conditions:**
- Forms across enormous T range: surface weathering (25°C) to magmatic (>600°C).
- Key requirement: **oxidizing conditions**. Fe²⁺ → Fe³⁺ → hematite.
- In supergene zones: forms from weathering of pyrite/chalcopyrite.
- In hydrothermal: specular hematite at 200-400°C.
- Banded iron formations: low-T, aqueous precipitation.

**Game conditions (current):**
- Requires Fe + O₂. Uses `exp(-0.002 * T)` — slight prograde. ✓
- pH effect: low pH reduces σ. ✓

**Discrepancy: MINOR ⚠️**
Broadly correct. Could refine the T dependence, but for gameplay it works.

---

## Summary of Fixes Needed

| Mineral | Severity | Issue | Fix |
|---------|----------|-------|-----|
| **Quartz** | ❌ MAJOR | Forms at low T in game; should form on cooling from high T | Flip supersaturation to prograde (based on SiO₂ solubility curve) |
| **Calcite** | ⚠️ MINOR | Direction correct (retrograde), needs high-T cap | Add ~500°C decomposition cutoff |
| **Fluorite** | ❌ MODERATE | Has prograde behavior; should be retrograde | Flip T dependence, sweet spot 50-300°C |
| **Pyrite** | ⚠️ MINOR | T window could be wider | Widen to 50-500°C |
| **Chalcopyrite** | ❌ MODERATE | Sweet spot too low (150-350°C) | Shift to 200-500°C |
| **Sphalerite** | ⚠️ MINOR | Roughly okay | Optional: add T window 80-250°C |
| **Galena** | ⚠️ MINOR | Sweet spot biased high for MVT | Broaden downward to 100-400°C |
| **Hematite** | ⚠️ MINOR | Broadly correct | Minor tweaks optional |

## Key Insight: The Quartz-Calcite Inversion

Professor flagged this: in the game, quartz forms at low T and calcite at high T. In reality it's the opposite for the mechanism that matters:

- **Quartz**: silica is MORE soluble at high T. Hot fluid carries lots of SiO₂. Cooling → supersaturation → quartz grows. **Quartz precipitates on cooling.**
- **Calcite**: CaCO₃ is LESS soluble at high T (retrograde). Heating fluid → CO₂ degasses → calcite precipitates. **Calcite precipitates on heating (or CO₂ loss).**

This creates the beautiful real-world paragenesis: in a cooling hydrothermal system, early quartz gives way to late calcite. The game currently has this reversed.

---

## Next Steps
1. Fix quartz supersaturation (biggest impact on gameplay accuracy)
2. Fix fluorite T dependence
3. Shift chalcopyrite sweet spot upward
4. Add hover text descriptions for all sliders and buttons
5. Implement title screen with three mode descriptions
6. Add molybdenite as primary mineral (v2 Mo revision)
7. Build modular mineral config system for easy additions

---

*Sources: Fluid inclusion data from OSTI.GOV, ScienceDirect, GeoScienceWorld. Solubility data from USGS, Fournier & Potter 1982, Rimstidt 1997. Porphyry Cu data from Seo et al. 2012, Cernuschi et al. 2023.*

---

## Crystal Size Ranges & Relative Growth Rates

### Real-World Maximum Sizes

| Mineral | Typical Specimen Size | Record/Exceptional Size | What Limits Growth |
|---------|----------------------|------------------------|-------------------|
| **Quartz** | 1-30 cm | ~6 m (Brazil, Minas Gerais) | Time (grows slowly), sustained supersaturation |
| **Calcite** | 1-50 cm | ~10 m (Iceland spar, Helgustadir) | Available Ca/CO₃, space. Grows fast. |
| **Selenite (gypsum)** | 5-50 cm | **12 m** (Naica Cave, Mexico) — house-sized | Extremely stable T (58°C) for ~500,000 years |
| **Fluorite** | 1-15 cm | ~2 m (Asturias, Spain) | Available Ca/F, often limited by vug size |
| **Sphalerite** | 0.5-5 cm | ~40 cm (rare) | Competing nucleation, Fe incorporation causes strain |
| **Pyrite** | 0.5-5 cm | ~20 cm (Navajún, Spain — perfect cubes) | Crystal defects accumulate; twinning limits perfection |
| **Chalcopyrite** | 0.5-5 cm | ~15 cm (rare, usually massive) | Often grows as massive rather than crystals |
| **Galena** | 1-10 cm | ~30 cm (Joplin, MO) | Perfect cleavage = mechanically fragile at large sizes |
| **Hematite** | 0.5-10 cm | ~30 cm (specular plates, Brazil) | Depends on habit — botryoidal unlimited, specular limited |
| **Malachite** | 1-20 cm (botryoidal) | Massive: meters (Congo) | Botryoidal has no real limit; single crystals rare and small |
| **Smithsonite** | 0.5-5 cm (botryoidal) | ~30 cm crusts | Botryoidal = unlimited by individual crystal physics |
| **Wulfenite** | 0.5-3 cm | ~10 cm (Red Cloud Mine, AZ; Los Lamentos, MX) | Tabular habit = fragile, Mo supply usually exhausted |

### Key Observations

1. **Botryoidal minerals cheat.** Malachite, smithsonite, and hematite (when botryoidal) aren't limited by single-crystal physics — they're aggregates that can grow indefinitely. The "crystal" in the game should distinguish between single crystal size and aggregate crust size.

2. **Calcite is the giant-maker.** It grows fast, has retrograde solubility (self-sustaining precipitation on warming), and tolerates defects well. In a well-supplied vug, calcite should dominate volume.

3. **Quartz grows slowly but persistently.** Given enough time, it makes large crystals — but in a 200-step game, it should be moderate unless conditions are perfect. The game's time compression means quartz is disadvantaged relative to fast-growers.

4. **Sulfides are mid-range.** Sphalerite, pyrite, galena, chalcopyrite all top out around 5-30 cm in nature. In the game they should be similar to each other in maximum achievable size.

5. **Wulfenite is small but precious.** Max ~10 cm, usually 1-3 cm. Thin tabular habit means it looks larger than its mass. The game should cap wulfenite smaller than other minerals but give it visual/narrative weight.

### Proposed Relative Growth Rate Multipliers

Using calcite as the baseline (1.0x), since it's one of the fastest-growing common minerals:

| Mineral | Relative Rate | Notes |
|---------|--------------|-------|
| Calcite | 1.0x | Fast grower, benchmark |
| Malachite | 0.8x | Fast for a secondary mineral |
| Smithsonite | 0.7x | Similar to malachite (botryoidal carbonate) |
| Sphalerite | 0.6x | Moderate, limited by mixing zone width |
| Fluorite | 0.5x | Moderate, isometric habit means equant growth |
| Hematite | 0.5x | Varies enormously by habit |
| Galena | 0.5x | Moderate, limited by Pb supply |
| Quartz | 0.3x | Slow but steady. In 200 steps, should be smaller than calcite |
| Pyrite | 0.3x | Slow, perfect cubes need time |
| Chalcopyrite | 0.3x | Usually massive, rarely good single crystals |
| Wulfenite | 0.2x | Slow, tabular, Mo supply usually limiting |
| Uraninite | 0.1x | Very slow, small crystals typical |

### Current Game Growth Rates (base rate × excess σ)

These need to be compared against the proposed multipliers:
- Quartz: `0.01 * sigma * 1000` ≈ 10 × excess σ
- Calcite: not checked yet — TODO
- Sphalerite: not checked yet — TODO
- (Continue for all minerals)

**TODO:** Extract all current base rates from grow_* functions, normalize, and compare against proposed table. Adjust so relative sizes match reality.

### Growth Cap Rule (Professor, 2026-03-30)

**Hard cap: 2× the largest known natural specimen.**

The game allows players to exceed natural records through sustained ideal conditions, but caps at double the world record to prevent physics-breaking outliers.

| Mineral | Record Size | Game Max (2× record) |
|---------|------------|---------------------|
| Quartz | ~6 m | 12 m |
| Calcite | ~10 m | 20 m |
| Fluorite | ~2 m | 4 m |
| Sphalerite | ~40 cm | 80 cm |
| Pyrite | ~20 cm | 40 cm |
| Chalcopyrite | ~15 cm | 30 cm |
| Galena | ~30 cm | 60 cm |
| Hematite | ~30 cm | 60 cm |
| Malachite | meters (massive) | 2× largest crystalline specimen |
| Smithsonite | ~30 cm crust | 60 cm |
| Wulfenite | ~10 cm | 20 cm |
| Uraninite | ~5 cm | 10 cm |

**Narrative tiers based on % of world record:**
- <10%: "typical specimen"
- 10-50%: "well-developed"
- 50-100%: "exceptional — museum quality"
- 100-150%: "rivals the world's finest known examples"
- 150-200%: "geologically unprecedented — you sustained conditions Earth never sustained"
- 200%: hard cap, growth stops

**Note:** These caps are for the game's vug-scale simulation. The game doesn't model quarry-scale or cave-scale systems (no Naica simulation). Caps are based on individual crystal size in vug/pocket settings, not massive/botryoidal aggregate extent.
