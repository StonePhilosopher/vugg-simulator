# Mineral Species Research — Vugg Simulator

## Species: Native Sulfur

### Identity
- **Formula:** S (elemental sulfur, α-sulfur)
- **Crystal system:** Orthorhombic (α-S, stable below 95.5°C); Monoclinic (β-S, stable 95.5–119°C)
- **Mineral group:** Native element (non-metal)
- **Hardness (Mohs):** 1.5–2.5
- **Specific gravity:** 2.05–2.09
- **Cleavage:** Poor on {001}, {110}, {111}
- **Fracture:** Conchoidal
- **Luster:** Resinous to vitreous; earthy in massive forms

### Color & Appearance
- **Typical color:** Bright canary yellow to straw yellow; massive forms can be paler
- **Color causes:** Intrinsic to S₈ molecular rings — electronic transitions within the crown-shaped molecule
- **Transparency:** Transparent to translucent
- **Streak:** White to pale yellow
- **Notable visual features:** Unmistakable color — no other mineral matches. Crystals show steep and shallow dipyramid faces. Molten sulfur turns blood-red at 200°C due to polymerization.

### Crystal Habits
- **Primary habit:** Bipyramidal (two dipyramids, one steep, one shallow)
- **Common forms/faces:** {111}, {113}, {001} pinacoid, {110} prism
- **Twin laws:** Rare
- **Varieties:** α-sulfur (orthorhombic, room-temp stable), β-sulfur (monoclinic, above 95.5°C)
- **Special morphologies:** Massive, powdery, stalactitic, encrustations, crystalline crusts

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <119°C (β-S crystallization); converts to α-S below 95.5°C
- **Optimal growth temperature:** 20–95°C (α-S range); fumarole deposition 100–200°C
- **Decomposition temperature:** Melts at 115.2°C; boils at 444.6°C; burns at ~250°C (SO₂)
- **Temperature-dependent habits:** β-S forms needle-like monoclinic crystals above 95.5°C; α-S forms blocky bipyramids below. Rapid cooling from β→α produces internal strain and cracking.

#### Chemistry Required
- **Required elements in broth:** S (high concentration, >1000 ppm dissolved as H₂S or polysulfides)
- **Optional/enhancing elements:** None — purity is typical
- **Inhibiting elements:** Fe²⁺, Cu²⁺, Pb²⁺ (these preferentially bind S into sulfides before native S can form)
- **Required pH range:** Acidic (pH 0–5); native S stable in low-pH environments where H₂S is dominant
- **Required Eh range:** Near the sulfide/sulfate redox boundary (Eh ~0 to +200 mV). Forms by partial oxidation of H₂S or by synproportionation (H₂S + SO₄²⁻ → S⁰ + ...). NOT in fully oxidizing or fully reducing conditions.
- **Required O₂ range:** Low — requires partial oxidation. Too much O₂ → sulfate; too little → sulfide minerals

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes H₂S, releases H⁺ (acidifying)
- **Byproducts of dissolution/decomposition:** Melts → liquid S; burns → SO₂ (gas); oxidizes → H₂SO₄ in presence of water

#### Growth Characteristics
- **Relative growth rate:** Fast (volcanic sublimation can produce large crystals in days)
- **Maximum crystal size:** Decimeters (Sicilian crystals to 20+ cm)
- **Typical crystal size in vugs:** 1–50 mm
- **Does growth rate change with temperature?** Yes — sublimation deposition in fumaroles is extremely fast; sedimentary native S grows slowly via bacterial sulfate reduction
- **Competes with:** Pyrite, marcasite, galena, sphalerite (all sulfides that consume S before it can crystallize as native element)

#### Stability
- **Breaks down in heat?** Melts at 115.2°C. β→α transition at 95.5°C causes cracking.
- **Breaks down in light?** No significant photodegradation
- **Dissolves in water?** Essentially insoluble (0.5 mg/L at 25°C)
- **Dissolves in acid?** Slowly in hot concentrated HNO₃; soluble in CS₂ and toluene
- **Oxidizes?** Yes — slowly tarnishes in moist air; burns to SO₂ at ~250°C
- **Dehydrates?** N/A
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** H₂S degassing from magma or bacterial sulfate reduction
- **Forms BEFORE:** Sulfate minerals (barite, gypsum) if later oxidized
- **Commonly associated minerals:** Celestine, calcite, aragonite, gypsum, cinnabar, pyrite, galena
- **Zone:** Volcanic fumarole/sublimation; sedimentary (evaporite/biogenic); hydrothermal (low-T)
- **Geological environment:** Volcanic vents and fumaroles, sedimentary evaporite basins (biogenic via Desulfovibrio bacteria), salt dome cap rocks, hydrothermal veins (late stage)

### Famous Localities
- **Classic locality 1:** Agrigento, Sicily, Italy — world's finest bipyramidal crystals, up to 20+ cm
- **Classic locality 2:** Tarnobrzeg, Poland — sedimentary sulfur from caprock of salt domes
- **Classic locality 3:** El Desierto Mine, Potosí, Bolivia — volcanic fumarole sulfur
- **Notable specimens:** Sicilian bipyramids are among the most iconic mineral specimens; Poças de São João, Portugal for crystal groups

### Fluorescence
- **Fluorescent under UV?** No (elemental S does not fluoresce)
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Sulfur is the mineral that smells like a reputation. The crystals themselves are nearly odorless — that rotten-egg stink belongs to hydrogen sulfide gas, not to the bright yellow bipyramids that form in volcanic fumaroles and salt dome cap rocks. At room temperature it's orthorhombic α-sulfur, built from crown-shaped S₈ rings stacked like tiny molecular crowns. Heat it past 95°C and it transforms to needle-like monoclinic β-sulfur; push past 115°C and it melts into a yellow liquid that thickens and turns blood-red as the rings polymerize into chains. It is simultaneously one of the most common elements in a hydrothermal system and one of the hardest to catch as a native mineral — every metal in the broth wants to bind it into sulfides first. Native sulfur only crystallizes when sulfur supply overwhelms metal demand, or when biology steps in: sulfate-reducing bacteria in evaporite basins strip oxygen from sulfate and leave behind mountains of crystalline sulfur. The crystals are fragile, light (SG ~2.07), and so thermally sensitive that holding a cool specimen in a warm hand can crack it. A mineral that burns, melts, polymerizes, and exists because chemistry couldn't find anything else to react with.

### Simulator Implementation Notes
- **New parameters needed:** trace_S already tracked; need H₂S/SO₄²⁻ redox state tracking; need Eh/pH boundary flag
- **New events needed:** `event_volcanic_fumarole` (S-rich gas injection), `event_bacterial_sulfate_reduction` (biogenic S formation in low-T evaporite settings)
- **Nucleation rule pseudocode:**
```
IF trace_S > 500 AND Eh in range (0, 200) AND pH < 5 AND metal_ions_low (Fe+Cu+Pb+Zn < 100 ppm total) → nucleate native_sulfur
```
- **Growth rule pseudocode:**
```
IF T < 95.5 → grow α-sulfur (bipyramidal habit)
IF 95.5 < T < 119 → grow β-sulfur (needle habit), convert to α on cooling with 50% crack chance
IF T > 115.2 → melt (remove crystal, add liquid_S to fluid)
rate = moderate, proportional to dissolved H₂S concentration
```
- **Habit selection logic:** If T at nucleation < 95.5°C → bipyramidal; if 95.5–119 → prismatic/needle (converts to bipyramidal on cooling with strain)
- **Decomposition products:** Melts at 115.2°C → liquid S (re-crystallizes on cooling). Burns at 250°C → SO₂ gas (releases to atmosphere, decreases trace_S in broth). Slowly oxidizes in O₂-rich conditions → SO₄²⁻ (sulfate ions back to fluid).

### Variants for Game
- **Variant 1: α-Sulfur (orthorhombic)** — Standard bipyramidal yellow crystals. T < 95.5°C.
- **Variant 2: β-Sulfur (monoclinic)** — Needle-like prismatic crystals. 95.5–119°C. Unstable at room temperature — rare in collections.
- **Variant 3: Volcanic sublimation crust** — Massive/encrustation habit. Forms rapidly from gas phase at fumaroles. Powdery, bright yellow.
