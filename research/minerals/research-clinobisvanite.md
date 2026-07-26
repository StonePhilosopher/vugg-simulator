# Research: Clinobisvanite (BiVO₄) — Vugg Simulator

## Species: Clinobisvanite

### Identity
- **Formula:** BiVO₄
- **Crystal system:** Monoclinic (scheelite-type, I2/b)
- **Mineral group:** Vanadate
- **Hardness (Mohs):** ~4–5
- **Specific gravity:** ~6.5–7.0
- **Cleavage:** Good on {010}, poor on {100}
- **Fracture:** Uneven to conchoidal
- **Luster:** Adamantine to vitreous

### Color & Appearance
- **Typical color:** Yellow to orange-yellow, sometimes brownish-yellow
- **Color causes:** Bi³⁺ charge transfer with VO₄³⁻; band gap ~2.4 eV (absorbs blue/violet, transmits yellow)
- **Transparency:** Translucent to transparent
- **Streak:** Yellow
- **Notable visual features:** Bright yellow color is distinctive; pseudo-tetragonal crystals may mimic scheelite

### Crystal Habits
- **Primary habit:** Tabular to prismatic pseudo-tetragonal crystals
- **Common forms/faces:** Pseudo-octahedral, {001} tabular
- **Twin laws:** Not commonly reported
- **Varieties:** Polymorphs: pucherite (orthorhombic), dreyerite (tetragonal zircon-type), clinobisvanite (monoclinic scheelite-type — most common)
- **Special morphologies:** Powdery aggregates, crusts, micro-crystalline plates to 0.1 mm

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** Low temperature, supergene (<80°C, likely ambient to ~50°C)
- **Optimal growth temperature:** 20–50°C (surface/oxidation zone temperatures)
- **Decomposition temperature:** Stable up to ~400°C (transforms to tetragonal polymorph above this)
- **Temperature-dependent habits:** Monoclinic at low T; tetragonal polymorph (dreyerite) at high T

#### Chemistry Required
- **Required elements:** Bi³⁺ (from oxidation of bismuthinite or native bismuth), V⁵⁺ (from vanadium-bearing fluids or vanadinite/pyromorphite decomposition)
- **Optional/enhancing elements:** Pb (commonly co-occurs in oxidation zone), P, As (may compete for V or Bi)
- **Inhibiting elements:** Reducing agents (sulfides — clinobisvanite requires oxidation zone)
- **Required pH range:** Slightly acidic to neutral (5–7)
- **Required Eh range:** Oxidizing (>+0.3V)
- **Required O₂ range:** High — requires oxidizing supergene conditions

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Removes Bi³⁺ and V⁵⁺ from solution
- **Byproducts of dissolution:** Releases Bi³⁺ and VO₄³⁻

#### Growth Characteristics
- **Relative growth rate:** Slow (secondary supergene mineral, crystallizes from dilute solutions)
- **Maximum crystal size:** Very small — plates to 0.1 mm typical; powdery aggregates more common
- **Typical crystal size in vugs:** 0.01–0.1 mm (microscopic to barely visible)
- **Does growth rate change with temperature?** Not significantly in its formation range
- **Competes with:** Vanadinite (Pb₅(VO₄)₃Cl — Pb grabs V if present), bismutoferrite, bismutite

#### Stability
- **Breaks down in heat?** Phase transition to tetragonal above ~400°C; decomposition at higher T
- **Breaks down in light?** Notably — BiVO₄ is a photocatalyst! UV light can drive surface reactions
- **Dissolves in water?** Very low solubility
- **Dissolves in acid?** Soluble in strong acids (HCl, HNO₃)
- **Oxidizes?** Already fully oxidized (Bi³⁺, V⁵⁺)
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Bismuthinite (Bi₂S₃ → oxidizes → Bi³⁺) and/or native bismuth (Bi⁰ → oxidizes → Bi³⁺); vanadinite or other V-bearing primary minerals (release V⁵⁺ on oxidation)
- **Forms BEFORE:** Nothing — it's the end of the bismuth oxidation sequence
- **Commonly associated minerals:** Bismutite, bismutoferrite, pucherite (orthorhombic BiVO₄ polymorph), vanadinite, mimetite, quartz, garnet (in pegmatite contexts)
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized portions of Bi-bearing pegmatites, oxidation zones of Bi-bearing hydrothermal veins, arid-climate gossans

### Famous Localities
- **Classic locality 1:** Yinnietharra, Western Australia — type locality, in beryl-bearing spessartine pegmatite with bismutite
- **Classic locality 2:** Londonderry, Wodgina, Menzies, Westonia, Corinthia — additional W.A. localities
- **Classic locality 3:** Linka Mine, Spencer Hot Springs, Lander County, Nevada, USA
- **Notable specimens:** Rarely forms crystals large enough for display; mostly micromount material

### Fluorescence
- **Fluorescent under UV?** No documented fluorescence
- **SW color:** —
- **LW color:** —
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text

> Clinobisvanite is where the bismuth story ends — at the surface, in the sun, where air and water have had their way with the deep minerals. It's the yellow powder you find coating cracked bismuthinite in an abandoned vein, a monoclinic scheelite mimic so small you need a microscope to see its crystals. It's BiVO₄, and it's famous for a reason its discoverers never intended: it's one of the best photocatalysts for splitting water with sunlight. The same crystal that forms as a supergene afterthought in Australian pegmatites is being studied in labs worldwide as a potential solar fuel source. A 0.1 mm yellow plate that might help power civilization. Not bad for an oxidation zone residue. In the simulator, its appearance means the bismuth cycle is complete: primary sulfide → native metal → oxidation → yellow vanadate. The rock remembers what it used to be.

### Simulator Implementation Notes
- **New parameters needed:** None (trace_Bi, trace_V already in system)
- **New events needed:** Late-stage oxidation event that converts Bi-bearing primary minerals
- **Nucleation rule pseudocode:**
```
IF temp < 80 AND Eh > 0.3 AND trace_Bi > 5 AND trace_V > 5 AND O₂ high → nucleate clinobisvanite
Priority: Bi³⁺ prefers clinobisvanite if Pb is low (Pb grabs V for vanadinite first)
```
- **Growth rule pseudocode:**
```
IF σ_clinobisvanite > 1.0 AND temp < 80 AND Eh > 0.3 → grow at rate 2 (slow)
```
- **Habit selection logic:** Always powdery/micro-crystalline in simulator (natural crystals too small for variation)
- **Decomposition products:** Phase transition to tetragonal above 400°C

### Variants for Game
- **Variant 1:** Pucherite (orthorhombic BiVO₄) — rarer polymorph, same composition, slightly different conditions
- **Variant 2:** Dreyerite (tetragonal BiVO₄) — high-temperature polymorph, would need volcanic/fumarole scenario
- **Variant 3:** Bismutite (Bi₂(CO₃)O₂) — not BiVO₄ but the more common oxidation product when V is absent; white/cream powder instead of yellow

### Paragenetic Linkage — Full Bismuth Sequence

This completes the bismuth paragenetic chain for the simulator:

```
PRIMARY ZONE (reducing, >200°C):
  Bismuthinite (Bi₂S₃) — when S²⁻ is available
  Native Bismuth (Bi) — when S²⁻ is depleted but Bi remains

OXIDATION ZONE (oxidizing, <80°C):
  Bismite (Bi₂O₃) — direct oxidation product
  Bismutite (Bi₂(CO₃)O₂) — with CO₃ available
  Clinobisvanite (BiVO₄) — with V⁵⁺ available (requires V source)
```

The switch from bismuthinite to native bismuth is sulfur-controlled. The switch from primary to supergene is Eh-controlled. The switch from bismutite to clinobisvanite is vanadium-controlled.
