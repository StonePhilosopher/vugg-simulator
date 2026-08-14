# Research: Brochantite — Vugg Simulator

## Species: Brochantite

### Identity
- **Formula:** Cu₄SO₄(OH)₆
- **Crystal system:** Monoclinic (2/m, space group P2₁/a)
- **Mineral group:** Sulfate (basic copper sulfate)
- **Hardness (Mohs):** 3.5–4.0
- **Specific gravity:** 3.97
- **Cleavage:** Perfect on {100}
- **Fracture:** Conchoidal
- **Luster:** Vitreous to pearly

### Color & Appearance
- **Typical color:** Emerald green, blackish green, blue-green
- **Color causes:** Cu²⁺ chromophore (d-d transitions)
- **Transparency:** Transparent to translucent
- **Streak:** Pale green
- **Notable visual features:** Can pseudomorph after malachite/azurite/chrysocolla

### Crystal Habits
- **Primary habit:** Prismatic to acicular (needle-like) crystals
- **Common forms/faces:** Elongated along [001]; also drusy coatings
- **Twin laws:** Not commonly twinned
- **Special morphologies:** Acicular sprays, velvety druses, massive

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Ambient to ~100°C (supergene)
- **Optimal growth temperature:** 20–60°C (near-surface oxidation)
- **Decomposition temperature:** ~450°C (breaks down to tenorite + CuSO₄)
- **Temperature-dependent habits:** Higher temps favor more massive forms; lower temps produce acicular sprays

#### Chemistry Required
- **Required elements:** Cu²⁺ (high, >1000 ppm), S (as sulfate, from sulfide oxidation)
- **Optional/enhancing elements:** None critical; Zn can substitute slightly
- **Inhibiting elements:** High carbonate activity (CO₃²⁻) → malachite wins instead
- **Required pH range:** 4–7 (moderately acidic to neutral). Lower pH → antlerite favored.
- **Required Eh range:** Strongly oxidizing (supergene conditions, O₂-rich)
- **Required O₂ range:** High — requires atmospheric oxygen for sulfide oxidation

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺ + SO₄²⁻ + OH⁻ (alkalinizes local fluid slightly)
- **Byproducts of dissolution:** Releases Cu²⁺ + SO₄²⁻ into solution

#### Growth Characteristics
- **Relative growth rate:** Moderate (faster than azurite, slower than chalcanthite)
- **Maximum crystal size:** To ~10 cm crystal sprays
- **Typical crystal size in vugs:** 1–20 mm acicular crystals, drusy coatings
- **Competes with:** Malachite (if CO₃ available), antlerite (if lower pH), chrysocolla (if silica-rich)

#### Stability
- **Breaks down in heat:** ~450°C → tenorite (CuO) + copper sulfate
- **Breaks down in light:** Stable
- **Dissolves in water:** Poorly soluble
- **Dissolves in acid:** Soluble in HCl (distinguishes from malachite by no effervescence), HNO₃
- **Oxidizes:** Already fully oxidized (supergene product)
- **Dehydrates:** No water in structure (hydroxyl only)

### Paragenesis
- **Forms AFTER:** Primary copper sulfides (chalcopyrite, bornite, chalcocite) oxidize to release Cu²⁺ + SO₄²⁻
- **Forms BEFORE:** Chalcanthite (if conditions become drier/more acidic); malachite may overgrow
- **Commonly associated minerals:** Malachite, azurite, chrysocolla, cuprite, native copper, antlerite, limonite
- **Zone:** Supergene oxidation zone
- **Geological environment:** Oxidized copper sulfide deposits, especially arid climates

### Famous Localities
- **Chuquicamata, Chile:** Mined as primary ore (1879–1912), massive brochantite veins
- **Bisbee, Arizona:** Emerald-green acicular sprays, highly prized
- **Serifos, Greece:** Fine green crystal groups
- **Notable specimens:** Bisbee material with intense emerald color and sharp acicular habit

### Fluorescence
- **Fluorescent under UV?** No

### Flavor Text

> Brochantite is the mineral that proves green has depth. Emerald needles erupting from matrix — not the soft green of malachite's carbonate calm, but something sharper, a green with sulfate teeth. It forms where copper sulfides meet their end: oxygen and water conspire to strip sulfur and rebuild it as something new. In Chile's Atacama, whole veins of brochantite were mined as copper ore, emerald seams in the driest desert on Earth. On bronze statues in polluted cities, it grows as a corrosion skin — the same chemistry, different cathedral.

### Simulator Implementation Notes
- **New parameters needed:** pH tracking in growth zone (needed for brochantite vs antlerite distinction)
- **Nucleation rule:**
```
IF temp < 100°C AND Eh > 0.4V AND pH 4-7 AND trace_Cu > threshold AND SO₄²⁻ available AND CO₃²⁻ low → nucleate brochantite
```
- **Growth rule:**
```
IF pH 4-7 AND Cu + SO₄ available → grow at moderate rate
IF pH < 4 → convert to antlerite
IF CO₃²⁻ high → malachite wins competition
```
- **Habit selection logic:** High Cu concentration → acicular; lower Cu + rapid nucleation → drusy/massive
- **Decomposition products:** tenorite (CuO) + copper sulfate vapor at >450°C

### Variants for Game
- **Variant 1:** Acicular spray — emerald green needles (classic Bisbee habit, high Cu flux)
- **Variant 2:** Velvety druse — fine-grained green coating on matrix (moderate Cu, rapid nucleation)
- **Variant 3:** Pseudomorph after azurite — retains azurite crystal shape in green (carbonate→sulfate replacement)

### Paragenetic Sequence Note
Brochantite belongs to the **copper sulfate oxidation zone sequence**: primary Cu sulfides → Cu²⁺ + SO₄²⁻ in solution → brochantite (pH 4-7) / antlerite (pH <4) / chalcanthite (dry, acidic, concentrated). The pH and humidity controls which copper sulfate dominates.
