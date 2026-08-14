# Research: Antlerite — Vugg Simulator

## Species: Antlerite

### Identity
- **Formula:** Cu₃(SO₄)(OH)₄
- **Crystal system:** Orthorhombic (mmm, space group Pnma)
- **Mineral group:** Sulfate (basic copper sulfate)
- **Hardness (Mohs):** 3.0–3.5
- **Specific gravity:** 3.9
- **Cleavage:** Perfect on {010}
- **Fracture:** Uneven
- **Luster:** Vitreous

### Color & Appearance
- **Typical color:** Bright green to dark green to blackish green
- **Color causes:** Cu²⁺ chromophore
- **Transparency:** Translucent
- **Streak:** Pale green
- **Notable visual features:** Pleochroic (yellow-green to blue-green in different orientations)

### Crystal Habits
- **Primary habit:** Tabular to acicular/fibrous
- **Common forms/faces:** Elongated tabular; also fibrous aggregates
- **Twin laws:** Not commonly twinned
- **Special morphologies:** Reniform, massive, granular, fibrous mats

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Ambient to ~80°C (supergene)
- **Optimal growth temperature:** 20–50°C
- **Decomposition temperature:** ~400°C
- **Temperature-dependent habits:** Tabular at moderate temps; fibrous at lower temps

#### Chemistry Required
- **Required elements:** Cu²⁺ (high), S (as sulfate from sulfide oxidation)
- **Optional/enhancing elements:** None significant
- **Inhibiting elements:** High CO₃²⁻ → malachite dominates; high pH → brochantite dominates
- **Required pH range:** <4 (acidic). This is the KEY distinction from brochantite — antlerite requires more acidic conditions.
- **Required Eh range:** Strongly oxidizing
- **Required O₂ range:** High

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺ + SO₄²⁻ + OH⁻
- **Byproducts of dissolution:** Releases Cu²⁺ + SO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Moderate to slow
- **Maximum crystal size:** To ~5 cm fibrous aggregates
- **Typical crystal size in vugs:** 1–10 mm tabular/fibrous crystals
- **Competes with:** Brochantite (at higher pH), malachite (if CO₃ available), chalcanthite (if very dry)

#### Stability
- **Breaks down in heat:** ~400°C → tenorite + CuSO₄
- **Dissolves in water:** Poorly soluble
- **Dissolves in acid:** Soluble in acids; no effervescence in HCl (distinguishes from malachite)
- **Oxidizes:** Already fully oxidized

### Paragenesis
- **Forms AFTER:** Primary copper sulfides oxidize; requires prolonged acidic conditions
- **Forms BEFORE:** Chalcanthite (if solution concentrates further)
- **Forms alongside:** Brochantite (pH boundary), atacamite (if Cl⁻ present), malachite
- **Zone:** Supergene oxidation zone, specifically acidic microenvironments
- **Geological environment:** Oxidized copper deposits; also sheltered areas on bronze corrosion (where acidity builds up in stagnant water films)

### Famous Localities
- **Chuquicamata, Chile:** Primary ore mineral in oxidized zone (more important than brochantite here)
- **Antler mine, Arizona:** Type locality, namesake
- **Broken Hill, New South Wales:** Fine green specimens

### Fluorescence
- **Fluorescent under UV?** No

### Flavor Text

> Antlerite was thought to be rare until someone looked closer at Chile's oxidized zones and realized it was the main copper ore, not brochantite. The difference? Acidity. Where copper sulfides oxidize in acid-rich microenvironments — sheltered pockets where rainwater can't flush the system — antlerite builds its bright green fibers instead of brochantite's chunky prisms. Same ingredients, different kitchen. On bronze statues, it's the corrosion that forms in the crevices and sheltered folds where acid concentrates. Brochantite gets the exposed surfaces. Antlerite gets the shadows.

### Simulator Implementation Notes
- **New parameters needed:** pH tracking (shared with brochantite)
- **Nucleation rule:**
```
IF temp < 80°C AND Eh > 0.4V AND pH < 4 AND trace_Cu > threshold AND SO₄²⁻ available AND CO₃²⁻ low → nucleate antlerite
```
- **Growth rule:**
```
IF pH < 4 AND Cu + SO₄ available → grow antlerite
IF pH rises above 4 → brochantite takes over
```
- **Habit selection logic:** High acidity + moderate Cu → fibrous; lower acidity boundary → tabular
- **Decomposition products:** tenorite (CuO) + copper sulfate at >400°C

### Variants for Game
- **Variant 1:** Fibrous green mat — bright green hair-like fibers (classic Chuquicamata, high acidity)
- **Variant 2:** Tabular crystals — flatter green tablets (pH near boundary ~3.5-4)
- **Variant 3:** Massive green — dense green aggregates, intergrown with brochantite at pH transition zone

### Paragenetic Sequence Note
Antlerite is the **acid-loving cousin** of brochantite. Same oxidation zone, same parent sulfides, but where brochantite prefers pH 4-7, antlerite dominates below pH 4. In the Vugg, pH could be tracked as a derived value from sulfide oxidation rate vs. carbonate buffering. The brochantite↔antlerite boundary is one of the most pH-sensitive mineral pairs in copper deposits.
