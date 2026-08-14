# Mineral Species Template — Vugg Simulator

## Species: Celestine

### Identity
- **Formula:** SrSO₄
- **Crystal system:** Orthorhombic (dipyramidal, space group Pnma)
- **Mineral group:** Sulfate (barite group: barite, celestine, anglesite, anhydrite)
- **Hardness (Mohs):** 3–3.5
- **Specific gravity:** 3.95–3.97 (lighter than barite — strontium is less massive than barium)
- **Cleavage:** Perfect on {001}, good on {210}, poor on {010}
- **Fracture:** Uneven
- **Luster:** Vitreous, pearly on cleavage surfaces

### Color & Appearance
- **Typical color:** Pale blue (celestial — named from caelestis), white, colorless, pink, pale green, yellowish, reddish
- **Color causes:** Blue from color centers or trace irradiation; other colors from trace impurities (Fe, organic matter)
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Delicate pale blue geode crystals are iconic. Often mistaken for barite — distinguished by lower density (4.0 vs 4.5) and flame test (crimson red Sr flame vs green Ba flame)

### Crystal Habits
- **Primary habit:** Tabular to equant crystals; also pyramidal terminations
- **Common forms/faces:** {001}, {210}, {101}, {011}
- **Twin laws:** Rare
- **Varieties:** No formal named varieties, but color variants are trade-named (blue celestine from Madagascar, orange from Yate/Bristol UK)
- **Special morphologies:** Fibrous, lamellar, earthy, massive granular. Geode linings of sharp blue blades are the most sought-after form.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 20–300°C (wide range like barite)
- **Optimal growth temperature:** 50–150°C (sedimentary/geode environments)
- **Decomposition temperature:** ~1600°C
- **Temperature-dependent habits:** Lower T in geode cavities → well-formed tabular crystals with sharp terminations

#### Chemistry Required
- **Required elements in broth:** Sr²⁺ (>0.5 ppm), SO₄²⁻
- **Optional/enhancing elements:** Ba²⁺ (solid solution), Ca²⁺ (substitution)
- **Inhibiting elements:** High Ba²⁺ favors barite over celestine
- **Required pH range:** Neutral to alkaline (7–9)
- **Required Eh range:** Oxidizing (sulfate stable)
- **Required O₂ range:** Moderate to high

#### Secondary Chemistry Release
- **Byproducts of nucleation:** None significant
- **Byproducts of dissolution:** Releases Sr²⁺ and SO₄²⁻. Low solubility (~11 mg/L at 25°C — higher than barite but still low)

#### Growth Characteristics
- **Relative growth rate:** Slow-moderate (slightly faster than barite due to higher solubility)
- **Maximum crystal size:** Up to 46 cm across (Crystal Cave, Ohio — world's largest geode)
- **Typical crystal size in vugs:** 2–15 cm tabular crystals in geodes
- **Does growth rate change with temperature?** Modest increase with T
- **Competes with:** Barite (Ba²⁺ vs Sr²⁺ for SO₄²⁻), strontianite (SrCO₃ — if CO₃²⁻ available), gypsum/anhydrite (Ca²⁺)

#### Stability
- **Breaks down in heat?** Decomposes >1200°C to SrO + SO₃
- **Breaks down in light?** No
- **Dissolves in water?** Low solubility (~11 mg/L) — about 5× more soluble than barite
- **Dissolves in acid?** Slowly in strong acids
- **Oxidizes?** Already fully oxidized — very stable
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Some blue coloration may be radiation-induced color centers

### Paragenesis
- **Forms AFTER:** Gypsum/anhydrite nodules (celestine geodes form by replacement of CaSO₄), or sulfide oxidation provides SO₄²⁻
- **Forms BEFORE:** Often a late-stage mineral
- **Commonly associated minerals:** Gypsum, anhydrite, halite, sulfur, calcite, dolomite, barite
- **Zone:** Sedimentary/evaporite (primary), hydrothermal veins, carbonate vugs, diagenetic replacement
- **Geological environment:** Evaporite basins, carbonate sedimentary cavities, sediment-hosted geodes, marine sediments (biogenic — Acantharia radiolaria skeletons are celestine!)

### Famous Localities
- **Classic locality 1:** Crystal Cave, South Bass Island, Ohio — world's largest geode, crystals to 46 cm
- **Classic locality 2:** Sakoany, Madagascar — iconic blue geode sections with sharp tabular crystals
- **Classic locality 3:** Yate, Bristol, UK — commercial mining until 1991; white and orange crystals
- **Notable specimens:** Machow Mine, Poland (large crystals); Sicily (with native sulfur inclusions)

### Fluorescence
- **Fluorescent under UV?** Yes, weakly to moderately
- **SW (255nm) color:** Yellow-white, bluish white
- **MW (310nm) color:** Weak
- **LW (365nm) color:** Yellow-white, blue-white
- **Phosphorescent?** Sometimes weakly
- **Activator:** Rare earth elements, trace impurities
- **Quenched by:** Iron

### Flavor Text
> Celestine is named for the sky — those pale blue geodes from Madagascar look like pieces of the atmosphere crystalized and cracked open. But the real surprise is that celestine is alive: the radiolarian protozoa called Acantharia build their skeletons from SrSO₄, biomineralizing celestine in the open ocean. The mineral you hold in a geode may have the same chemistry as the spine of a single-celled creature drifting in the deep. In Crystal Cave, Ohio, you can walk inside a geode where celestine blades the size of coffee tables grew in darkness for millions of years — an 11-meter cathedral of strontium sulfate, and every crystal pointing inward.

### Simulator Implementation Notes
- **New parameters needed:** trace_Sr (if not already present); needs Sr in trace element list
- **New events needed:** Geode replacement event — celestine can replace pre-existing gypsum/anhydrite nodules (dissolves CaSO₄, precipitates SrSO₄ in the cavity)
- **Nucleation rule pseudocode:**
```
IF trace_Sr > threshold AND SO4_available AND Eh > oxidizing_threshold → nucleate celestine
IF trace_Ba > trace_Sr → barite wins the competition (solid solution)
```
- **Growth rule pseudocode:**
```
IF supersaturation(SrSO4) > 1.0 → grow at rate proportional to σ
rate = base_rate * σ (slightly faster than barite due to higher solubility)
```
- **Habit selection logic:**
  - Open cavity/geode → well-formed tabular blades with pyramidal terminations
  - Massive/evaporite → granular to fibrous
  - Replacement of gypsum → geode lining habit (sharp inward-facing crystals)
- **Decomposition products:** None at game-relevant temperatures

### Variants for Game
- **Variant 1:** Blue celestine — classic Madagascar geode color, radiation-induced color centers
- **Variant 2:** Celestine geode — replacement of gypsum nodule; special formation event, produces cavity lined with inward-facing crystals
- **Variant 3:** Sulfur-included celestine — yellow/orange from native sulfur inclusions (Sicily type), indicates proximity to volcanic sulfur

---

## Paragenetic Link
Celestine-barite (BaSO₄) form a complete solid solution series. Sr²⁺ and Ba²⁺ compete for the same SO₄²⁻ in oxidizing conditions. Ba²⁺ wins at high concentrations (barite is less soluble), but Sr²⁺ dominates in evaporite/carbonate settings where Sr/Ba ratio in the fluid is high. Both orthorhombic, Pnma, isostructural. See `memory/research-barite.md`.

Biogenic note: Acantharia radiolaria precipitate celestine skeletons — the only common mineral with significant biogenic production besides calcite, aragonite, and silica. Consider a "biogenic nucleation" event in marine sediment scenarios.

Completed: 2026-04-23
