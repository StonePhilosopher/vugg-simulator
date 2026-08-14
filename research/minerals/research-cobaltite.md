# Research: Cobaltite (CoAsS) — Vugg Simulator

## Species: Cobaltite

### Identity
- **Formula:** CoAsS
- **Crystal system:** Orthorhombic (pseudo-isometric; structurally resembles pyrite)
- **Mineral group:** Sulfarsenide (cobaltite group)
- **Hardness (Mohs):** 5.5
- **Specific gravity:** 6.33
- **Cleavage:** Perfect on {001}
- **Fracture:** Uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Reddish silver-white, violet steel-gray to black
- **Color causes:** Cobalt content gives a subtle rose-pink to reddish-gray surface tint from oxidation; fresh surfaces are tin-white with a pinkish cast
- **Transparency:** Opaque
- **Streak:** Grayish-black
- **Notable visual features:** Tetartoid habit (dodecahedral with chiral tetrahedral symmetry); surface oxidation produces a diagnostic pinkish blush that distinguishes it from pyrite

### Crystal Habits
- **Primary habit:** Pseudocubic/pyritohedral crystals, granular massive
- **Common forms/faces:** Striated pseudocubes, pyritohedra {210}, rarely octahedral
- **Twin laws:** About [111] creating pseudo-cubic forms and striations
- **Varieties:** Ferrocobaltite (Fe-rich variety, up to 10% Fe replacing Co)
- **Special morphologies:** Massive granular, rarely as well-formed striated crystals

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 300–600°C (high-temperature hydrothermal / contact metamorphic)
- **Optimal growth temperature:** 400–500°C
- **Decomposition temperature:** ~800–900°C (breaks down to CoAs + sulfur)
- **Temperature-dependent habits:** Higher temperatures → coarser crystals; lower → granular massive

#### Chemistry Required
- **Required elements in broth:** Co (≥50 ppm), As (≥100 ppm), S (≥50 ppm) — all three must be present simultaneously
- **Optional/enhancing elements:** Fe (substitutes for Co up to ~10%), Ni (substitutes for Co, forming glaucodot series)
- **Inhibiting elements:** High O₂ (oxidizing conditions destabilize sulfarsenides)
- **Required pH range:** Near-neutral to slightly acidic (5–7)
- **Required Eh range:** Reducing to mildly reducing (sulfide stability field)
- **Required O₂ range:** Low — sulfarsenide requires reducing conditions

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Minor — ties up Co, As, and S from solution simultaneously
- **Byproducts of dissolution/decomposition:** On oxidation, releases Co²⁺, AsO₄³⁻ (arsenate), and SO₄²⁻
- **Oxidation reaction:** 4CoAsS + 13O₂ + 6H₂O → 4Co²⁺ + 4H₃AsO₄ + 4SO₄²⁻ → then Co²⁺ + 2H₃AsO₄ + 8H₂O → Co₃(AsO₄)₂·8H₂O (erythrite) + 6H⁺

#### Growth Characteristics
- **Relative growth rate:** Slow (Co is a trace element; requires all three components simultaneously)
- **Maximum crystal size:** Up to ~10 cm (rare; Cobalt, Ontario produced crystals to several cm)
- **Typical crystal size in vugs:** 1–20 mm
- **Does growth rate change with temperature?** Faster at higher temperatures (400–500°C range); slows dramatically below 300°C
- **Competes with:** Arsenopyrite (FeAsS — same structure, uses same As+S), pyrite (competes for S), skutterudite (CoAs₂₋₃, uses Co+As without S)

#### Stability
- **Breaks down in heat?** ~800–900°C, decomposes to CoAs + sulfur species
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Slowly in nitric acid; resistant to HCl
- **Oxidizes?** Yes — weathers to erythrite (Co₃(AsO₄)₂·8H₂O), the classic pink secondary coating
- **Dehydrates?** No
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Initial pyrite/arsenopyrite deposition (Co is later-stage, concentrated in residual hydrothermal fluids)
- **Forms BEFORE:** Erythrite (its supergene oxidation product)
- **Commonly associated minerals:** Arsenopyrite, pyrite, chalcopyrite, sphalerite, magnetite, skutterudite, calcite, quartz
- **Zone:** Primary/hypogene (high-temperature hydrothermal veins, contact metamorphic deposits)
- **Geological environment:** High-temperature hydrothermal veins, contact metamorphic skarns, metamorphosed Co-rich stratiform deposits

### Famous Localities
- **Classic locality 1:** Cobalt, Ontario, Canada — type area for "cobalt camp," world-class specimens
- **Classic locality 2:** Tunaberg, Södermanland, Sweden — historically important, well-formed crystals
- **Classic locality 3:** Skutterud, Modum, Norway — associated with skutterudite
- **Notable specimens:** Cobalt, Ontario produced pseudocubic crystals to several cm; Indian jewellers used it (as "sehta") to produce blue enamel on gold ornaments

### Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text
> Cobaltite is the kobold's ore — named for the goblin that medieval miners blamed when this rock refused to smelt properly, instead belching poisonous arsenic fumes. It hides in pyrite's clothing: pseudocubic metallic crystals that could fool anyone until you spot the faint rose blush of surface oxidation. The pink is a promise — a promise that this sulfarsenide will one day become erythrite, those impossible cotton-candy pink crusts that announce cobalt's presence from across the mine. Three elements locked in pyrite's architecture: cobalt, arsenic, sulfur. A mineral that was a nuisance for centuries before anyone realized cobalt was worth more than the silver they were actually mining.

### Simulator Implementation Notes
- **New parameters needed:** trace_Co (cobalt) — may already exist for erythrite; verify
- **New events needed:** Cobalt pulse event (late-stage Co-As-S rich fluid injection, distinct from main Cu-Pb-Zn mineralization)
- **Nucleation rule pseudocode:**
```
IF trace_Co > 50 AND trace_As > 100 AND trace_S > 50
   AND temperature 300-600°C
   AND Eh < -0.1 (reducing)
   AND existing_arsenopyrite OR existing_pyrite (paragenetic context)
→ nucleate cobaltite (max 2-3 crystals)
```
- **Growth rule pseudocode:**
```
IF sigma_cobaltite > 1.0 AND temperature > 300°C
→ grow at rate 2 (slow; Co is trace element)
→ rate *= (temperature / 400)^1.5  // temperature-dependent acceleration
```
- **Habit selection logic:**
```
IF temperature > 450°C → pseudocubic/pyritohedral (well-formed)
IF temperature 300-450°C → granular massive
IF Fe > threshold → ferrocobaltite variant
```
- **Decomposition products:** Oxidation → erythrite (Co₃(AsO₄)₂·8H₂O), requires near-neutral pH and O₂. Releases AsO₄³⁻ and SO₄²⁻ to fluid.

### Variants for Game
- **Variant 1: Ferrocobaltite** — Fe-rich (up to 10% Fe replacing Co), slightly darker, same conditions but with elevated Fe
- **Variant 2: Nickelian cobaltite** — Ni substitutes for Co, bridges toward glaucodot (Co,Fe)AsS. Slightly lighter color. Requires Ni in broth.
- **Variant 3: Kobold's Promise** — oxidizing cobaltite with erythrite rims forming in real-time. Visual: metallic core with pink crust growing outward. Requires temperature drop below ~50°C + O₂ exposure after initial crystallization.

### Paragenetic Sequence (Co-As-S System)
**Primary:** Cobaltite (CoAsS) → crystallizes at 300-600°C in reducing conditions
**Supergene:** Erythrite (Co₃(AsO₄)₂·8H₂O) → forms when cobaltite oxidizes at surface/near-surface conditions
**Link:** Cobaltite is the hypogene source; erythrite is the supergene weathering product. In the simulator, cooling + oxidation of a vug containing cobaltite should spawn erythrite crusts on cobaltite surfaces.

---

*Research completed: 2026-04-23*
*Linked to: memory/research-erythrite.md (supergene product)*
