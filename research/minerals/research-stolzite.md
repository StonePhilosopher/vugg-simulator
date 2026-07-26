# Species: Stolzite

### Identity
- **Formula:** PbWO₄
- **Crystal system:** Tetragonal
- **Mineral group:** Tungstate
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 8.34
- **Cleavage:** Imperfect on {001}, indistinct on {011}
- **Fracture:** Conchoidal to uneven
- **Luster:** Resinous to subadamantine

### Color & Appearance
- **Typical color:** Reddish brown, brown, yellowish gray, smoky gray, straw-yellow, lemon-yellow; occasionally green, orange, red
- **Color causes:** Primarily lead-tungstate charge transfer; color variations likely due to trace Mo (greenish hues replacing W) and Fe inclusions
- **Transparency:** Translucent to transparent
- **Streak:** White
- **Notable visual features:** High refractive indices (nω=2.270, nε=2.180–2.190) give a brilliant adamantine luster on fresh surfaces. Birefringence δ=0.090 is quite high.

### Crystal Habits
- **Primary habit:** Dipyramidal to tabular crystals
- **Common forms/faces:** {001}, {011}, {101} — the dipyramids dominate, giving an octahedron-like appearance
- **Twin laws:** Not commonly twinned
- **Varieties:** Forms a solid solution series with wulfenite (PbMoO₄) — intermediate compositions possible where W and Mo substitute freely
- **Special morphologies:** Can be massive or as small crystalline druses

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Forms at low temperatures in the supergene oxidation zone (<100°C)
- **Optimal growth temperature:** Ambient to ~80°C (weathering zone conditions)
- **Decomposition temperature:** Stable up to high temperatures; does not decompose, but raspite converts TO stolzite at 395°C
- **Temperature-dependent habits:** As the high-T dimorph, stolzite is the stable form above ~395°C. In nature it forms at low T as the common dimorph; raspite is the rarer low-T form.

#### Chemistry Required
- **Required elements in broth:** Pb²⁺, W (as tungstate WO₄²⁻)
- **Optional/enhancing elements:** Mo (forms wulfenite-stolzite solid solution), Ca (scheelite association)
- **Inhibiting elements:** S²⁻ in reducing conditions (would form galena + scheelite instead)
- **Required pH range:** Neutral to slightly acidic (oxidizing conditions dissolve primary sulfides)
- **Required Eh range:** Oxidizing — primary tungsten minerals (scheelite, wolframite, hubnerite) must break down and release WO₄²⁻
- **Required O₂ range:** High — supergene oxidation zone environment

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No significant release; Pb²⁺ and WO₄²⁻ combine directly
- **Byproducts of nucleation:** None significant
- **Byproducts of dissolution:** Dissolves in HCl releasing Pb²⁺ and WO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Slow — rare mineral, requires specific combination of Pb and W in oxidation zone
- **Maximum crystal size:** Crystals up to several cm known from Broken Hill
- **Typical crystal size in vugs:** 1–10 mm
- **Does growth rate change with temperature?** Limited data; supergene formation is generally slow
- **Competes with:** Wulfenite (if Mo present), cerussite (PbCO₃), anglesite (PbSO₄) — all compete for Pb²⁺ in the oxidation zone

#### Stability
- **Breaks down in heat?** No — stable at high T; stolzite IS the high-T form
- **Breaks down in light?** No known photodegradation
- **Dissolves in water?** Very low solubility
- **Dissolves in acid?** Decomposes in HCl
- **Oxidizes?** Already fully oxidized — both Pb and W are in highest common oxidation states
- **Radiation sensitivity:** PbWO₄ crystals are famously radiation-hard (used in CMS calorimeter at CERN)

### Paragenesis
- **Forms AFTER:** Primary sulfide mineralization (galena, sphalerite) + primary tungsten minerals (scheelite, wolframite, hubnerite) must be present and oxidizing
- **Forms BEFORE:** May be replaced by cerussite if CO₃²⁻ increases, or by anglesite if SO₄²⁻ increases
- **Commonly associated minerals:** Raspite (dimorph), wulfenite (Mo analog), cerussite, anglesite, pyromorphite, mimetite, galena (relict), scheelite (relict)
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized zones of tungsten-bearing hydrothermal lead deposits

### Famous Localities
- **Broken Hill, New South Wales, Australia** — Type locality for raspite; both dimorphs occur together. Classic stolzite crystals.
- **Clara Mine, Black Forest, Germany** — Well-crystallized stolzite specimens
- **Cordillera Mine, New South Wales, Australia** — Renowned for association of both dimorphs
- **Tuena Mine, New South Wales, Australia** — White stolzite crystals
- **Darwin District, Inyo County, California, USA** — Stolzite crystals to 2 cm
- **Ore Mountains (Erzgebirge), Bohemia, Czech Republic** — Original naming locality

### Fluorescence
- **Fluorescent under UV?** Not typically fluorescent
- **SW (255nm) color:** Not reported
- **MW (310nm) color:** Not reported
- **LW (365nm) color:** Not reported
- **Phosphorescent?** No
- **Activator:** None known
- **Quenched by:** N/A

Note: Synthetic PbWO₄ is used as a scintillator (emits blue light under ionizing radiation), but this is radioluminescence, not UV fluorescence.

### Flavor Text

> Stolzite is what happens when two heavy elements find each other in the wreckage of a broken vein — lead from oxidized galena, tungsten from weathered wolframite, both stripped of their primary partners and thrown together in the cold oxidizing zone. The result is a crystal of extraordinary density and brilliance, with refractive indices that rival diamond. Same formula as raspite, same elements in the same ratio, but stolzite chose tetragonal symmetry — the high-temperature form that, paradoxically, crystallizes in the cool supergene zone. It's the wulfenite of tungsten deposits: a thin, bright signal that the primary ore body below has been eating itself from the top down.

### Simulator Implementation Notes
- **New parameters needed:** trace_W (already tracked in species list), WO₄²⁻ concentration in fluid
- **New events needed:** Wolframite/scheelite oxidation event releasing WO₄²⁻ into supergene fluid
- **Nucleation rule pseudocode:**
```
IF temp < 100 AND Eh > 0.3 AND Pb²⁺ > threshold AND WO₄²⁻ > threshold AND O₂ > 0.1
  → nucleate stolzite (probability * (σ_stolzite - 1))
```
- **Growth rule pseudocode:**
```
IF σ_stolzite > 1 → grow at rate 2 (slow)
  Competes with wulfenite for Pb²⁺ (Mo vs W in fluid)
  Competes with cerussite for Pb²⁺ (CO₃²⁻ vs WO₄²⁻)
```
- **Habit selection logic:**
  - σ just above 1 → tabular habit
  - σ well above 1 → dipyramidal habit
  - Mo trace present → transitional wulfenite-stolzite composition (orange-green color)
- **Decomposition products:** Stable; does not decompose under normal game conditions

### Variants for Game
- **Variant 1: Classic stolzite** — Brown-yellow dipyramidal crystals, pure PbWO₄
- **Variant 2: Wulfenite-series stolzite** — Greenish to orange tint from Mo substitution, transitional composition
- **Variant 3: Stolzite-raspite intergrowth** — Both dimorphs nucleating simultaneously at the polymorphic boundary temperature, representing the 395°C inversion
