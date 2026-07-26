# Research: Galena (PbS) — Lead Oxidation Zone Sequence, Mineral 1/3

## Species: Galena

### Identity
- **Formula:** PbS
- **Crystal system:** Cubic (isometric)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2.5–2.75
- **Specific gravity:** 7.2–7.6 (very heavy — immediately noticeable)
- **Cleavage:** Perfect cubic {001}, parting on {111}
- **Fracture:** Subconchoidal
- **Luster:** Metallic, brilliant on fresh cleavage planes

### Color & Appearance
- **Typical color:** Lead gray, silvery
- **Color causes:** Inherent to PbS composition; metallic luster from free electron behavior
- **Transparency:** Opaque
- **Streak:** Lead gray
- **Notable visual features:** Bright metallic cleavage surfaces that can look like mirrors; cubic crystal shapes are distinctive. Silver-bearing varieties may show subtle tarnish.

### Crystal Habits
- **Primary habit:** Cubes, cubo-octahedra
- **Common forms/faces:** Cube {100} dominant, octahedral {111} truncations, dodecahedral {110} rare
- **Twin laws:** Contact twins on {111}, penetration twins, lamellar twinning — all Spinel Law
- **Varieties:** Argentiferous galena (Ag-bearing, up to 0.5% Ag in solid solution or as included acanthite)
- **Special morphologies:** Skeletal/hopper crystals, massive granular, dendritic (rare), cleavable masses

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 50–500°C (very wide stability field)
- **Optimal growth temperature:** 100–350°C (hydrothermal sweet spot)
- **Decomposition temperature:** ~1115°C (melting point)
- **Temperature-dependent habits:** Higher T → simpler cubic forms; lower T → more complex forms with octahedral modifications. Skeletal/hopper crystals at rapid growth (high supersaturation).

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ and S²⁻ (both needed; Pb arrives via hydrothermal fluid, S from H₂S or bisulfide complexes)
- **Optional/enhancing elements:** Ag (substitutes for Pb, up to 0.5%), Bi, Sb, Se (substitutes for S), Cu (forms chalcopyrite association)
- **Inhibiting elements:** High O₂ suppresses (oxidizes to anglesite/cerussite)
- **Required pH range:** Neutral to mildly acidic (pH 4–7); dissolves in strong acids
- **Required Eh range:** Reducing (low Eh). Sulfide stability requires <0 mV at neutral pH
- **Required O₂ range:** Very low — galena is a primary (hypogene) mineral, unstable in oxidizing conditions

#### Secondary Chemistry Release
- **When oxidizing:** PbS + 2O₂ → PbSO₄ (anglesite), releasing H⁺ if water involved
- **Further oxidation to cerussite:** PbSO₄ + CO₂ + H₂O → PbCO₃ + H₂SO₄
- **Acid mine drainage contribution:** Galena oxidation contributes H₂SO₄ to drainage (less than pyrite, but significant)

#### Growth Characteristics
- **Relative growth rate:** Fast — galena nucleates readily when Pb and S coexist
- **Maximum crystal size:** Cubes up to 25+ cm (Great Laxey Mine, Isle of Man); massive beds of many meters
- **Typical crystal size in vugs:** 1–10 cm cubes common; exceptional vugs produce 5–15 cm
- **Growth rate vs temperature:** Faster at moderate T; rate limited by Pb²⁺ supply, not kinetics
- **Competes with:** Sphalerite (ZnS — same fluid, different metal), pyrite (FeS₂ — lower Pb needed)

#### Stability
- **Breaks down in heat?** Melts at ~1115°C
- **Breaks down in light?** No
- **Dissolves in water?** Practically insoluble (Ksp ≈ 3 × 10⁻²⁸, extremely insoluble)
- **Dissolves in acid?** Yes — dissolves in HNO₃ and HCl with H₂S release
- **Oxidizes?** YES — the key transformation. PbS → PbSO₄ (anglesite) → PbCO₃ (cerussite) in the supergene zone. This is the lead oxidation sequence.
- **Radiation sensitivity:** Darkens slightly with prolonged exposure but structurally stable

### Paragenesis
- **Forms AFTER:** Quartz, barite (earlier gangue); sometimes pyrite
- **Forms BEFORE:** Sphalerite (often contemporaneous), chalcopyrite (slightly later), anglesite/cerussite (oxidation products)
- **Commonly associated minerals:** Sphalerite (almost always together in Pb-Zn veins), calcite, fluorite, barite, pyrite, chalcopyrite, marcasite, dolomite, quartz
- **Zone:** Primary/hypogene (forms at depth from reducing hydrothermal fluids)
- **Geological environment:** Mississippi Valley Type (MVT) deposits, hydrothermal veins, SEDEX deposits, skarns, pegmatites (minor)

### Famous Localities
- **Classic locality 1:** Tri-State District (Missouri/Kansas/Oklahoma) — enormous MVT cubes
- **Classic locality 2:** Broken Hill, NSW, Australia — argentiferous galena, major producer
- **Classic locality 3:** Freiberg, Saxony, Germany — historic silver-bearing galena
- **Notable specimens:** Great Laxey Mine, Isle of Man — largest documented cubes (25+ cm); Madan, Bulgaria — brilliant mirror-cleavage cubes on quartz; Brushy Creek, Missouri — large cubic crystals in dolomite vugs

### Fluorescence
- **Fluorescent under UV?** No
- **All wavelengths:** Non-fluorescent (opaque metallic minerals don't fluoresce)

### Flavor Text

> Galena is the weight in your hand that tells you everything. Seven times denser than water, it pulls at your wrist — a mineral that announces itself by gravity before you even see the silver-bright cubes. It has been smelted in campfires since the Bronze Age, a threshold so low it borders on embarrassing. But that ease came at a cost: lead poisoning shaped civilizations, and the oxidation zone above every galena deposit becomes a pharmacy of secondary minerals — anglesite, cerussite, pyromorphite — each one a letter from the空气 rewriting lead's mineralogy. In a vug, galena cubes sit like dice thrown by the earth, their perfect {100} faces still bright while everything around them has shifted.

### Simulator Implementation Notes
- **New parameters needed:** trace_Pb already exists (used for amazonite/wulfenite); S²⁻ already tracked
- **New events needed:** None — galena uses standard sulfide nucleation
- **Nucleation rule pseudocode:**
```
IF trace_Pb > threshold AND S²⁻ > threshold AND Eh < 0 AND T < 500
  AND num_crystals("galena") < 4 → nucleate galena
```
- **Growth rule pseudocode:**
```
IF trace_Pb > 0 AND S²⁻ > 0 AND Eh < 0 → grow at rate 6 (fast)
  consume Pb and S proportionally
```
- **Habit selection logic:**
  - High supersaturation → skeletal/hopper cubes
  - Moderate σ → clean cubes with possible octahedral truncations
  - Low σ → simple cubes, larger and more euhedral
- **Decomposition products:** Oxidation at Eh > 0 converts galena → anglesite (PbSO₄) if sulfate available, then → cerussite (PbCO₃) if carbonate available. Rate depends on O₂ exposure.

### Variants for Game
- **Variant 1: Argentiferous galena** — trace_Ag > threshold → silver-bearing, slightly different luster (more brilliant), releases Ag on oxidation (enables native silver/acanthite formation)
- **Variant 2: Skeletal galena** — high supersaturation + rapid cooling → hoppered cubes with stepped faces, lower visual quality but faster growth
- **Variant 3: Massive galena** — very high nucleation rate → granular masses instead of cubes, fills vug space quickly but less visually interesting

---

## Linked Minerals in Lead Oxidation Sequence
1. **Galena** (PbS) — primary sulfide ← THIS FILE
2. **Anglesite** (PbSO₄) — first oxidation product → `memory/research-anglesite.md`
3. **Cerussite** (PbCO₃) — second oxidation product (replaces anglesite in carbonate-rich environments) → `memory/research-cerussite.md`

### Sequence Chemistry
```
PbS → [O₂ + H₂O] → PbSO₄ (anglesite) → [CO₃²⁻] → PbCO₃ (cerussite) + SO₄²⁻
```
All three share Pb as the cation. The anion transforms: S²⁻ → SO₄²⁻ → CO₃²⁻. In the simulator, galena oxidation should chain: first to anglesite, then anglesite dissolves and reprecipitates as cerussite if CO₃ is available.
