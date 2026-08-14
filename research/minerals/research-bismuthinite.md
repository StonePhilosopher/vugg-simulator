# Research: Bismuthinite (Bi₂S₃) — Vugg Simulator

## Species: Bismuthinite

### Identity
- **Formula:** Bi₂S₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2
- **Specific gravity:** 6.8–7.2
- **Cleavage:** [010] perfect
- **Fracture:** Uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Lead-gray to tin-white, yellowish or iridescent tarnish
- **Color causes:** Metallic Bi-S bonding; tarnish from surface oxidation
- **Transparency:** Opaque
- **Streak:** Lead gray
- **Notable visual features:** Iridescent tarnish on exposed surfaces; slender needle-like crystals

### Crystal Habits
- **Primary habit:** Slender prismatic to acicular (needle-like)
- **Common forms/faces:** Elongated along c-axis, striated prisms
- **Twin laws:** Rare
- **Varieties:** Massive lamellar forms common
- **Special morphologies:** Hair-like aggregates, radiating clusters

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** 200–500°C (high-temp hydrothermal)
- **Optimal growth temperature:** 300–450°C
- **Decomposition temperature:** ~685°C (melting point of Bi₂S₃)
- **Temperature-dependent habits:** Higher temp → coarser prismatic; lower → acicular

#### Chemistry Required
- **Required elements:** Bi (50–500 ppm), S (abundant in reducing fluids)
- **Optional/enhancing elements:** Cu, Pb (form aikinite series substitutions), Se (substitutes for S)
- **Inhibiting elements:** High O₂ (oxidizes to bismite/bismutite)
- **Required pH range:** Neutral to slightly acidic (4–7)
- **Required Eh range:** Strongly reducing
- **Required O₂ range:** Very low (anaerobic)

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Removes Bi and S from fluid
- **Byproducts of dissolution:** Releases Bi³⁺ and S²⁻; oxidation releases Bi³⁺ + SO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Moderate (similar to stibnite)
- **Maximum crystal size:** Up to several cm (Bolivian specimens)
- **Typical crystal size in vugs:** 5–30 mm needles
- **Does growth rate change with temperature?** Faster at higher temperatures
- **Competes with:** Galena (PbS — can form aikinite intermediate), native bismuth (if S is low)

#### Stability
- **Breaks down in heat?** Melts at ~685°C
- **Breaks down in light?** No
- **Dissolves in water?** Negligible
- **Dissolves in acid?** Slowly in HNO₃
- **Oxidizes?** Yes — to bismite (Bi₂O₃) and bismutite (Bi₂(CO₃)O₂) in supergene zone
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Early quartz, arsenopyrite
- **Forms BEFORE:** Native bismuth (if S depleted), bismite/bismutite (oxidation products), clinobisvanite (if V present in oxidation zone)
- **Commonly associated minerals:** Native bismuth, arsenopyrite, chalcopyrite, galena, pyrite, cassiterite, wolframite, quartz, tourmaline
- **Zone:** Primary/hypogene (high-temperature hydrothermal veins, greisen, pegmatite)
- **Geological environment:** Hydrothermal veins (especially Sn-W associations), granite-related veins, volcanic exhalation deposits

### Famous Localities
- **Classic locality 1:** Potosí, Bolivia — world's best bismuthinite crystals, slender steel-gray needles in quartz matrix
- **Classic locality 2:** Schlaggenwald (Horní Slavkov), Czech Republic — historic European locality
- **Classic locality 3:** Kingsgate, New South Wales, Australia — with molybdenite and bismuth
- **Notable specimens:** Bolivian acicular groups to 10+ cm

### Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)

### Flavor Text

> Bismuthinite grows like frozen lightning — steel-gray needles that bolt through quartz veins at three hundred degrees, when bismuth and sulfur meet in the deep reducing dark. It's the high-temperature cousin of stibnite, sharing the same needle habit and orthorhombic skeleton, but heavier by far (specific gravity 7) and rarer. In the oxidation zone it doesn't last: air and water convert it to powdery bismite and bismutite, the fossil shadow of what was once a blade. When sulfur runs out before bismuth does, the excess metal crystallizes as native bismuth — that iridescent, stair-stepped element everyone photographs but nobody finds in the wild without bismuthinite nearby first.

### Simulator Implementation Notes
- **New parameters needed:** trace_Bi (already in 30-element trace list)
- **New events needed:** None beyond standard sulfide nucleation
- **Nucleation rule pseudocode:**
```
IF temp < 500 AND temp > 200 AND trace_Bi > 50 AND S abundant AND Eh < -0.2 → nucleate bismuthinite
```
- **Growth rule pseudocode:**
```
IF σ_bismuthinite > 1.0 AND temp 200-500 → grow at rate 4
Habit: IF temp > 350 → prismatic; ELSE → acicular
```
- **Habit selection logic:** Temperature-driven: high temp = stout prisms, low temp = hair-like needles
- **Decomposition products:** Oxidation → bismite (Bi₂O₃) + sulfuric acid. Thermal decomposition at 685°C → Bi melt + S vapor.

### Variants for Game
- **Variant 1:** Aikinite-bearing bismuthinite — Cu+Pb substitution, slightly different habit, indicates mixed Cu-Pb-Bi fluid
- **Variant 2:** Acicular "steel wool" habit — low temperature growth, dense radiating mats
- **Variant 3:** Tarnished/iridescent — surface oxidation in near-supergene conditions, cosmetic only
