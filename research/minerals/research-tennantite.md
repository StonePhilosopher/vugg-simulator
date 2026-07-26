# Tennantite — Vugg Simulator Research

## Species: Tennantite

### Identity
- **Formula:** Cu₁₂As₄S₁₃ (ideal); Cu₆[Cu₄(Fe,Zn)₂]As₄S₁₃ in practice
- **Crystal system:** Cubic (isometric), point group 4̄3m
- **Mineral group:** Sulfosalt
- **Hardness (Mohs):** 3–4.5
- **Specific gravity:** 4.45–4.65
- **Cleavage:** None
- **Fracture:** Subconchoidal to uneven
- **Luster:** Metallic, commonly splendent

### Color & Appearance
- **Typical color:** Flint-gray to iron-black; cherry-red in transmitted thin fragments
- **Color causes:** Inherent copper-arsenic sulfide; the cherry-red translucency in thin section is diagnostic (vs tetrahedrite which is more brownish)
- **Transparency:** Opaque (except very thin fragments show deep red)
- **Streak:** Reddish gray (distinguishes from tetrahedrite's darker streak)
- **Notable visual features:** Fresh surfaces have bright metallic luster; thin edges transmit cherry-red light

### Crystal Habits
- **Primary habit:** Massive (most common)
- **Common forms/faces:** Tetrahedron {111}, dodecahedron {110} — well-formed crystals less common than in tetrahedrite
- **Twin laws:** Contact and penetration twins on {111}
- **Varieties:** Zincian tennantite (Zn-rich), ferroan tennantite (Fe-rich)
- **Special morphologies:** Massive granular, coarse aggregates; distinct crystals rarer than tetrahedrite

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 150–400°C
- **Optimal growth temperature:** 200–350°C
- **Decomposition temperature:** ~500°C (similar to tetrahedrite)
- **Temperature-dependent habits:** Same as tetrahedrite — lower T favors massive, higher T favors tetrahedral

#### Chemistry Required
- **Required elements in broth:** Cu (high, >100 ppm), As (moderate, >10 ppm), S (high)
- **Optional/enhancing elements:** Fe (substitutes for Cu), Zn (substitutes for Cu), Ag (substitutes for Cu)
- **Inhibiting elements:** Sb (shifts composition toward tetrahedrite — not inhibition, but species change)
- **Required pH range:** Near-neutral to slightly acidic (5–7)
- **Required Eh range:** Moderately reducing (sulfide stability field)
- **Required O₂ range:** Low — sulfide stability

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu, As, S from fluid
- **Byproducts of dissolution/decomposition:** Releases Cu²⁺, As³⁺/As⁵⁺, SO₄²⁻ under oxidation. **Important:** Arsenic release is environmentally significant — tennantite oxidation is a major source of arsenate in mine drainage, feeding secondary arsenate minerals (erythrite, annabergite, scorodite, olivenite)

#### Growth Characteristics
- **Relative growth rate:** Moderate — comparable to tetrahedrite
- **Maximum crystal size:** Up to ~10 cm
- **Typical crystal size in vugs:** 0.5–3 cm (generally smaller than tetrahedrite crystals)
- **Does growth rate change with temperature?** Same as tetrahedrite
- **Competes with:** Enargite (Cu₃AsS₄) for Cu+As; tetrahedrite for Cu; arsenopyrite for As

#### Stability
- **Breaks down in heat?** ~500°C → copper sulfides + arsenic sulfides
- **Breaks down in light?** No
- **Dissolves in water?** Negligible
- **Dissolves in acid?** Slowly in HNO₃; decomposes in concentrated acids
- **Oxidizes?** Yes — importantly, oxidation releases arsenic into solution, forming:
  - Erythrite (Co₃(AsO₄)₂·8H₂O) if Co present
  - Annabergite (Ni₃(AsO₄)₂·8H₂O) if Ni present
  - Scorodite (FeAsO₄·2H₂O) if Fe present
  - Olivenite (Cu₂(AsO₄)(OH)) from direct Cu-As oxidation
  - Pharmacolite, conichalcite with Ca present
- **Dehydrates?** N/A (anhydrous)
- **Radiation sensitivity:** None documented

### Paragenesis
- **Forms AFTER:** Pyrite, early quartz
- **Forms BEFORE:** Late-stage carbonates; supergene arsenate minerals
- **Commonly associated minerals:** Tetrahedrite, chalcopyrite, sphalerite, galena, pyrite, enargite, arsenopyrite, quartz, calcite, barite, fluorite, siderite
- **Zone:** Primary/hypogene (hydrothermal veins, contact metamorphic)
- **Geological environment:** Hydrothermal veins (esp. As-rich systems), contact metamorphic deposits. Cornwall type.

### Famous Localities
- **Cornwall, England** — type locality, first described 1819
- **Tsumeb, Namibia** — exceptional crystals with diverse associations
- **Cortez Mine, Lander Co., Nevada, USA** — well-formed crystals
- **Notable specimens:** Tsumeb produced some of the finest tennantite crystals known, often associated with unusual secondary arsenates

### Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Tennantite is tetrahedrite's arsenic twin — same crystal structure, same tetrahedral habit, same hydrothermal veins, but swap antimony for arsenic and you get a mineral whose oxidation feeds an entire rainbow of secondary arsenates. It's the quiet one of the pair, named for Smithson Tennant, the chemist who proved diamonds are pure carbon (by burning one). Thin fragments glow cherry-red, a diagnostic window into a mineral otherwise indistinguishable from its Sb counterpart without analytical equipment. Bronze Age smelters learned the hard way that tennantite-bearing ore produces arsenical copper — harder than pure copper, toxic to work, and arguably the first step toward true metallurgy. The rocks were teaching chemistry before humans had a word for it.

### Simulator Implementation Notes
- **New parameters needed:** None — uses same trace_Sb and trace_As as tetrahedrite
- **New events needed:** None
- **Nucleation rule pseudocode:**
```
IF temp 150-400°C AND Cu > 80ppm AND As > Sb AND S > moderate AND reducing:
  nucleate tennantite (As-dominant end of tetrahedrite-tennantite series)
```
- **Growth rule pseudocode:**
```
IF temp 200-350°C AND Cu + As + S available:
  grow at moderate rate (slightly slower than tetrahedrite)
  Fe/Zn substitution based on trace ratios
```
- **Habit selection logic:** Same as tetrahedrite — tetrahedral vs massive based on space and growth rate
- **Decomposition products:** Same as tetrahedrite above 500°C. **Key oxidation pathway:** tennantite → scorodite/erythrite/annabergite/olivenite depending on available cations. This connects to existing arsenate minerals already in the game (erythrite, annabergite).

### Variants for Game
- **Variant 1: Zincian tennantite** — Zn-rich. Paler gray. Conditions: high trace_Zn.
- **Variant 2: Ferroan tennantite** — Fe-rich. Darker, slightly heavier. Conditions: high trace_Fe.
- **Variant 3: Argentian tennantite** — Ag-bearing. Same structure, silver content. Less common than freibergite (Ag-tetrahedrite).

---

## Linked Paragenetic Note: Oxidation Sequence
Tennantite is the **parent mineral** for the arsenate wing of the oxidation zone. Its breakdown products directly create:
- **Erythrite** (Co₃(AsO₄)₂·8H₂O) — already researched ✓
- **Annabergite** (Ni₃(AsO₄)₂·8H₂O) — already researched ✓
- **Scorodite** (FeAsO₄·2H₂O) — not yet researched
- **Olivenite** (Cu₂(AsO₄)(OH)) — not yet researched
- **Pharmacolite / Conichalcite** — need Ca, not yet researched

Adding tennantite to the simulator creates a **primary source** that feeds the existing secondary arsenate minerals, closing the paragenetic loop.
