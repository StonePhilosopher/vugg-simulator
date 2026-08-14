# Tetrahedrite — Vugg Simulator Research

## Species: Tetrahedrite

### Identity
- **Formula:** Cu₁₂Sb₄S₁₃ (ideal); (Cu,Fe,Zn,Ag)₁₂Sb₄S₁₃ in practice
- **Crystal system:** Cubic (isometric), point group 4̄3m
- **Mineral group:** Sulfosalt
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 4.6–5.2 (pure ~4.97)
- **Cleavage:** None
- **Fracture:** Uneven to subconchoidal
- **Luster:** Metallic, commonly splendent

### Color & Appearance
- **Typical color:** Steel gray to iron-gray, nearly black
- **Color causes:** Inherent metallic luster of copper-antimony sulfide
- **Transparency:** Opaque (except in very thin fragments)
- **Streak:** Black, brown to dark red
- **Notable visual features:** Brilliant metallic shine on fresh surfaces; tetrahedral crystal form is diagnostic

### Crystal Habits
- **Primary habit:** Tetrahedral crystals (the namesake form)
- **Common forms/faces:** Tetrahedron {111}, rarely dodecahedron {110}
- **Twin laws:** Contact and penetration twins on {111}
- **Varieties:** Annivite (Bi-bearing), freibergite (Ag-rich, up to 18% Ag — technically separate species)
- **Special morphologies:** Massive, coarse to fine granular aggregates more common than distinct crystals

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 150–400°C
- **Optimal growth temperature:** 200–350°C
- **Decomposition temperature:** ~500°C (breaks down to chalcopyrite + stibnite + other sulfides)
- **Temperature-dependent habits:** Lower T → finer crystals, more massive habit; higher T → better tetrahedral development

#### Chemistry Required
- **Required elements in broth:** Cu (high, >100 ppm), Sb (moderate, >10 ppm), S (high)
- **Optional/enhancing elements:** Fe (substitutes for Cu), Zn (substitutes for Cu), Ag (substitutes for Cu, creates freibergite), Bi (substitutes for Sb, creates annivite), Hg, Pb
- **Inhibiting elements:** As (shifts composition toward tennantite — not inhibition, but species change)
- **Required pH range:** Near-neutral to slightly acidic (5–7)
- **Required Eh range:** Moderately reducing (sulfide stability field)
- **Required O₂ range:** Low — sulfide stability requires reducing conditions

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu, Sb, S from fluid
- **Byproducts of dissolution/decomposition:** Releases Cu²⁺, Sb³⁺, SO₄²⁻ under oxidation

#### Growth Characteristics
- **Relative growth rate:** Moderate — faster than chalcopyrite, slower than pyrite
- **Maximum crystal size:** Up to 15 cm across (exceptional)
- **Typical crystal size in vugs:** 0.5–5 cm
- **Does growth rate change with temperature?** Moderate positive correlation — faster at higher T within stable range
- **Competes with:** Chalcopyrite (Cu-Fe-S), chalcocite (Cu₂S), bornite (Cu₅FeS₄) for Cu; stibnite for Sb

#### Stability
- **Breaks down in heat?** ~500°C → chalcopyrite + stibnite + copper sulfides
- **Breaks down in light?** No
- **Dissolves in water?** Negligible
- **Dissolves in acid?** Slowly in HNO₃; decomposes in concentrated acids
- **Oxidizes?** Yes — weathering produces antimony ochres, secondary Cu minerals (malachite, azurite), iron oxides
- **Dehydrates?** N/A (anhydrous)
- **Radiation sensitivity:** None documented

### Paragenesis
- **Forms AFTER:** Pyrite, early quartz
- **Forms BEFORE:** Late-stage carbonates (calcite), supergene minerals
- **Commonly associated minerals:** Chalcopyrite, sphalerite, galena, pyrite, quartz, calcite, siderite, barite, fluorite, tennantite
- **Zone:** Primary/hypogene (hydrothermal veins, contact metamorphic)
- **Geological environment:** Low to moderate temperature hydrothermal veins, contact metamorphic deposits, mesothermal-epithermal systems

### Famous Localities
- **Freiberg, Saxony, Germany** — type locality, historically important silver ore
- **Casapalca Mine, Peru** — large, sharp tetrahedral crystals with chalcopyrite and sphalerite
- **Tsumeb, Namibia** — world-class specimens, often with diverse associated minerals
- **Notable specimens:** Crystals to several inches from Casapalca; freibergite with up to 30% Ag from Freiberg

### Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Tetrahedrite is the mineral that couldn't decide if it wanted to be a sulfide or something stranger — so it became a sulfosalt, a whole category that sits between the neat binaries and the chaos of nature's actual chemistry. Named for its tetrahedral crystals, it's the antimony-rich end of a solid solution that slides all the way to arsenic-bearing tennantite without ever breaking. Silver hides in its lattice — sometimes enough to make it an ore in its own right. Roman miners called ores like this *fahlerz*, "gray ore," because the good stuff was always hidden inside the unremarkable. The deepest lesson: the most valuable crystals are the ones that don't announce themselves.

### Simulator Implementation Notes
- **New parameters needed:** trace_Sb (already in list), trace_As (already in list). Sb/As ratio determines position in tetrahedrite-tennantite series.
- **New events needed:** None beyond nucleation trigger
- **Nucleation rule pseudocode:**
```
IF temp 150-400°C AND Cu > 80ppm AND Sb > 10ppm AND S > moderate AND reducing conditions:
  nucleate tetrahedrite (Sb-dominant) OR tennantite (As-dominant) based on Sb/As ratio
  Fe/Zn/Ag substitution based on trace element ratios
```
- **Growth rule pseudocode:**
```
IF temp 200-350°C AND Cu + Sb + S available:
  grow at moderate rate
  Ag incorporation increases with Ag availability → freibergite variant if Ag > threshold
  Bi incorporation → annivite variant if Bi > threshold
```
- **Habit selection logic:** Tetrahedral if space allows + moderate growth; massive if rapid growth or confined space
- **Decomposition products:** Chalcopyrite + stibnite + copper sulfides above ~500°C; oxidation → antimony ochres + malachite/azurite

### Variants for Game
- **Variant 1: Freibergite** — Ag-rich (Ag > 20% of Cu site). Silver-bearing variety. Same tetrahedral habit but with economic silver content. Conditions: high trace_Ag.
- **Variant 2: Annivite** — Bi-bearing (Bi substitutes for Sb). Slightly different luster. Conditions: high trace_Bi + lower Sb.
- **Variant 3: Zincian tetrahedrite** — Zn substitutes significantly for Cu. Paler gray. Conditions: high trace_Zn.

---

## Paragenetic Link: Tetrahedrite-Tennantite Series
These two minerals form a complete solid solution: Cu₁₂Sb₄S₁₃ ↔ Cu₁₂As₄S₁₃. The Sb/As ratio in the fluid determines which name applies. Pure endmembers are almost never found in nature — most specimens are intermediate. In the simulator, the Sb:As ratio in the broth should determine the composition, with the name shifting accordingly. They share identical crystal structure (cubic, space group I4̄3m), formation temperatures, and paragenetic sequence.
