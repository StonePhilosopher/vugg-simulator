# Mineral Species Template — Vugg Simulator

## Species: Powellite

### Identity
- **Formula:** CaMoO₄
- **Crystal system:** Tetragonal (dipyramidal, 4/m)
- **Mineral group:** Molybdate (scheelite group)
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 4.25 (lighter than scheelite due to Mo < W)
- **Cleavage:** Indistinct on {011}, {112}, {001}
- **Fracture:** Conchoidal
- **Luster:** Adamantine

### Color & Appearance
- **Typical color:** Straw-yellow, greenish yellow, yellow-brown, brown, colorless. May show blue to black zones.
- **Color causes:** Mo⁶⁺ chromophore. Blue/black zones from partial reduction of Mo. Compositional zoning from W-Mo solid solution.
- **Transparency:** Transparent
- **Streak:** Light yellow
- **Notable visual features:** Adamantine luster. Pleochroic: O = blue, E = green. Often paper-thin tabular crystals. Shows compositional zoning with scheelite (blue zones = W-rich, yellow = Mo-rich).

### Crystal Habits
- **Primary habit:** Flat tabular crystals, often paper-thin on {001}
- **Common forms/faces:** {001} dominant, thin plates
- **Twin laws:** Same as scheelite — penetration and contact twins
- **Varieties:** Solid solution with scheelite — intermediate compositions are the norm, not the exception
- **Special morphologies:** Crusty to pulverulent coatings (oxidation zone habit), massive. Well-formed dipyramids rare in powellite end-member.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <200°C (supergene/oxidation zone)
- **Optimal growth temperature:** Near-surface ambient to ~100°C
- **Decomposition temperature:** Stable to high T (same structure as scheelite)
- **Temperature-dependent habits:** Low T → thin tabular plates and crusts. High T → more equant (but rarely forms at high T in nature).

#### Chemistry Required
- **Required elements in broth:** Ca (from host rock), Mo (from molybdenite oxidation)
- **Optional/enhancing elements:** W (forms scheelite component in solid solution)
- **Inhibiting elements:** Same as scheelite — F and P scavenge Ca
- **Required pH range:** Near-neutral to alkaline (oxidizing conditions)
- **Required Eh range:** Oxidizing — Mo must be Mo⁶⁺ (molybdate). This is the key distinction from scheelite: powellite forms in the OXIDATION zone where molybdenite has broken down.
- **Required O₂ range:** High — requires oxidizing conditions to convert MoS₂ → MoO₄²⁻

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes Ca and MoO₄²⁻ from oxidizing fluids
- **Byproducts of nucleation:** Removes molybdate from solution
- **Byproducts of dissolution/decomposition:** Releases Ca²⁺ and MoO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Typically small — mm to ~2 cm plates
- **Typical crystal size in vugs:** 1–10 mm thin plates or crusts
- **Does growth rate change with temperature?** Minimal variation in its natural temperature range
- **Competes with:** Ferrimolybdite (Fe₂(MoO₄)₃·8H₂O — amorphous yellow crust that often forms instead of powellite when Fe is abundant), wulfenite (PbMoO₄ — forms when Pb is available instead of Ca)

#### Stability
- **Breaks down in heat?** No
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble
- **Dissolves in acid?** Moderate solubility in acids
- **Oxidizes?** Already fully oxidized
- **Dehydrates?** N/A (anhydrous)
- **Radiation sensitivity:** Not well documented (generally low)

### Paragenesis
- **Forms AFTER:** Molybdenite (MoS₂ — primary source, must oxidize first), scheelite (W-rich precursor in primary zone)
- **Forms BEFORE:** Ferrimolybdite (if Fe available and conditions more acidic)
- **Commonly associated minerals:** Molybdenite, ferrimolybdite, stilbite, laumontite, apophyllite, wulfenite, scheelite
- **Zone:** Supergene/oxidation zone — the weathering product of molybdenite
- **Geological environment:** Oxidized portions of molybdenum-bearing hydrothermal deposits, porphyry Mo deposits, basalt cavities (rare)

### Famous Localities
- **Classic locality 1:** Peacock Mine, Adams County, Idaho (type locality)
- **Classic locality 2:** Nasik, Maharashtra, India — in basalt cavities with apophyllite and stilbite
- **Classic locality 3:** Bingham Canyon, Utah — in the oxidation zone of the porphyry Cu-Mo deposit
- **Notable specimens:** Indian specimens show bright yellow adamantine crystals on zeolite matrix

### Fluorescence
- **Fluorescent under UV?** YES
- **SW (255nm) color:** Bright yellow (diagnostic — distinguishes from scheelite's blue)
- **MW (310nm) color:** Yellow-white
- **LW (365nm) color:** Dimmer yellow
- **Phosphorescent?** Weak
- **Activator:** Self-activated (CaMoO₄ lattice, same mechanism as scheelite)
- **Quenched by:** Fe²⁺

### Flavor Text
> Powellite is what molybdenite becomes when it meets the sky. Deep underground, molybdenite sits in its primary veins — soft, lead-gray, smelling of sulfur. But when erosion lifts those veins into the oxygen zone, the chemistry flips. MoS₂ becomes MoO₄²⁻, calcium steps in, and powellite crystallizes as thin yellow plates with adamantine fire. Under UV it answers scheelite's blue with its own bright yellow — same crystal structure, same lattice mechanism, different song. The two minerals are twins separated at birth: scheelite stays deep, powellite climbs toward the light.

### Simulator Implementation Notes
- **New parameters needed:** None new — reuses scheelite system with mo_fraction ≈ 1.0
- **New events needed:** Molybdenite oxidation event releases MoO₄²⁻ into fluid
- **Nucleation rule pseudocode:**
```
IF temp < 200 AND Eh > oxidizing_threshold
  AND Ca > threshold AND MoO4 > threshold
  AND molybdenite has been oxidized (Mo released)
  → nucleate powellite (mo_fraction near 1.0)
```
- **Growth rule pseudocode:**
```
IF σ_powellite > 1.0 → grow at rate proportional to σ
  W content tracked as solid-solution fraction (scheelite component)
  Lower T and higher Eh favor powellite end-member
```
- **Habit selection logic:**
  - Oxidation zone, limited space → thin tabular plates
  - More open cavity → small dipyramids (scheelite-like but smaller)
  - Very limited space → crusty/pulverulent coating
- **Decomposition products:** None stable. Dissolves in acid.

### Variants for Game
- **Variant 1: Classic powellite** — bright yellow tabular plates on matrix. High mo_fraction, oxidation zone.
- **Variant 2: W-bearing powellite** — intermediate solid solution, fluorescence shifts from yellow toward blue-white. Found where scheelite and molybdenite both present in primary zone.
- **Variant 3: Powellite on zeolite** — basalt cavity specimen with stilbite/apophyllite associates. Different geological setting from the typical porphyry oxidation.
