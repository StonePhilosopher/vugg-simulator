# Mineral Species — Native Silver (Ag)

## Species: Native Silver

### Identity
- **Formula:** Ag
- **Crystal system:** Cubic (isometric), space group Fm3̄m
- **Mineral group:** Native element
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 10.1–11.1 (very high — one of the heaviest native metals)
- **Cleavage:** None
- **Fracture:** Hackly (jagged, characteristic of ductile metals)
- **Luster:** Metallic, bright silver-white when fresh

### Color & Appearance
- **Typical color:** Silver-white, bright metallic; tarnishes to gray-black (acanthite coating)
- **Color causes:** Inherent metallic silver; tarnish = surface acanthite (Ag₂S) from atmospheric H₂S
- **Transparency:** Opaque
- **Streak:** Silver-white, shining
- **Notable visual features:** Incredible range of habits — wires, dendrites, sheets, herringbone patterns, massive nuggets. Fresh surfaces are the brightest metallic luster in the mineral kingdom. Tarnish is diagnostic (acanthite rind).

### Crystal Habits
- **Primary habit:** Wires, arborescent/dendritic, massive
- **Common forms/faces:** Cubes {100}, octahedra {111} — rare as distinct crystals
- **Twin laws:** Penetration twins on {111}
- **Varieties:** Wire silver (most prized), dendritic (fern-like), hackly masses, nuggets
- **Special morphologies:** Wires can reach 30+ cm (Kongsberg). Herringbone twinning. Dendritic plates. Amalgam (with Hg).

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Forms at virtually any T where Ag⁺ is reduced; most common 50–300°C
- **Optimal growth temperature:** 100–200°C (epithermal wire silver)
- **Decomposition temperature:** 962°C (melting point)
- **Temperature-dependent habits:** Wires favor lower T (epithermal); cubic crystals favor higher T

#### Chemistry Required
- **Required elements in broth:** Ag (high concentration required — native silver needs supersaturation relative to sulfide complexes)
- **Optional/enhancing elements:** Hg (forms amalgam), As, Sb (associated sulfosalts)
- **Inhibiting elements:** Excess S²⁻ (diverts Ag into acanthite instead), Cl⁻ (diverts into cerargyrite AgCl)
- **Required pH range:** Neutral to slightly acidic
- **Required Eh range:** STRONGLY REDUCING — native silver requires conditions where Ag⁺ is reduced to Ag⁰. Below the sulfide stability field, or in zones where sulfide has been depleted
- **Required O₂ range:** Variable — can form in supergene zones where Ag⁺ is reduced by organic matter or Fe²⁺

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes Ag⁺ from solution; may release electrons to reducing agents
- **Byproducts of nucleation:** None (reduction reaction)
- **Byproducts of dissolution:** Ag⁺ ions (oxidizing conditions), acanthite coating (if S²⁻ present)

#### Growth Characteristics
- **Relative growth rate:** Fast in supersaturated conditions — silver wires can grow rapidly
- **Maximum crystal size:** Wires to 30+ cm (Kongsberg); masses to hundreds of kg
- **Typical crystal size in vugs:** Wire clusters 1–20 cm; crystals rare, to ~2 cm
- **Does growth rate change with temperature?** Moderate effect — wire growth favors cooler, open-space conditions
- **Competes with:** Acanthite/argentite (if S²⁻ available), cerargyrite (if Cl⁻ available), silver sulfosalts

#### Stability
- **Breaks down in heat?** Melts at 962°C
- **Breaks down in light?** No (but tarnishes from atmospheric sulfur compounds)
- **Dissolves in water?** No
- **Dissolves in acid?** Dissolves in nitric acid (HNO₃) and cyanide solutions
- **Oxidizes?** Tarnishes — reacts with H₂S to form acanthite surface coating. Does NOT oxidize to oxide in air
- **Dehydrates?** N/A
- **Radiation sensitivity:** None

### Paragenesis
- **Forms AFTER:** Argentite/acanthite (sulfide depletion), galena (Ag-rich), tetrahedrite
- **Forms BEFORE:** Cerargyrite (if Cl⁻ encountered), acanthite coating (on exposure to S)
- **Commonly associated minerals:** Acanthite, calcite, quartz, native copper, niccolite, cobaltite, skutterudite, dyscrasite, proustite, pyrargyrite, galena, sphalerite
- **Zone:** Hypogene (primary, in reducing zones where S is depleted) and supergene (secondary, enrichment zone where descending Ag⁺ meets reducing conditions)
- **Geological environment:** Epithermal veins, mesothermal veins (Kongsberg-type), basalt amygdaloidal fillings (Keweenaw), cobalt-nickel-silver veins (Cobalt, Ontario), supergene enrichment zones

### Famous Localities
- **Classic locality 1:** Kongsberg, Norway — world's finest wire silver specimens, calcite-hosted veins in Precambrian basement. Wires to 30+ cm.
- **Classic locality 2:** Keweenaw Peninsula, Michigan, USA — native silver in basalt amygdaloidal fillings, associated with native copper. Historic mining district.
- **Classic locality 3:** Cobalt, Ontario, Canada — silver veins in cobalt-nickel-arsenide deposits. Massive and dendritic silver.
- **Notable specimens:** Kongsberg wires in Natural History Museum (Oslo) — some over 30 cm long, considered the finest native element specimens in the world

### Fluorescence
- **Fluorescent under UV?** No
- **All wavelengths:** None

### Flavor Text
> Native silver is a mineral that defies its own chemistry. Silver shouldn't exist as a native metal — it's too reactive, too eager to bond with sulfur or chlorine. But in the deep reducing zones of hydrothermal veins, where every sulfur atom has already been claimed, silver has nothing left to react with and simply precipitates as itself. The result is breathtaking: wire silver, crystallizing as delicate metallic threads that curl through open vugs like frozen lightning. Kongsberg, Norway produced wires over 30 cm long — cathedral spires of pure metal growing in calcite veins a kilometer underground. The Keweenaw Peninsula's basalt flows hosted silver alongside native copper, two impossible metals coexisting in volcanic rock. Tarnish is inevitable; every native silver specimen eventually develops a dark acanthite rind from atmospheric sulfur. But freshly broken surfaces still flash with the brightest metallic luster known to mineralogy. It's the only native element that can make you rich just by looking at it wrong.

### Simulator Implementation Notes
- **New parameters needed:** None — uses trace_Ag
- **New events needed:** Sulfide depletion event → triggers native silver instead of acanthite
- **Nucleation rule pseudocode:**
```
IF trace_Ag > high_threshold AND S²⁻ ≈ 0 (depleted) AND Eh = strongly reducing → nucleate native silver
// OR: supergene enrichment — Ag⁺ from oxidized acanthite meets reducing zone
IF trace_Ag > threshold AND Eh very low AND Cl⁻ low → native silver over acanthite
```
- **Growth rule pseudocode:**
```
IF trace_Ag available AND S²⁻ remains low → grow as wire/dendritic at fast rate
IF S²⁻ increases → stop growth, begin acanthite coating
```
- **Habit selection logic:** Low T + open space → wire. Higher T + confined → massive/dendritic. Rare conditions → cubic crystals
- **Decomposition products:** Tarnish → acanthite surface coating. Full oxidation → Ag⁺ in solution

### Variants for Game
- **Variant 1:** Wire silver — epithermal, open vug, low S²⁻, moderate T. The collector's prize.
- **Variant 2:** Dendritic silver — fern-like plates, moderate T, confined space. Cobalt-type.
- **Variant 3:** Massive silver — nugget/hackly mass, high Ag concentration, any T. Keweenaw-type.

### Special Game Mechanic: The Tarnish Clock
Native silver specimens in the collection should develop an acanthite coating over time if exposed to trace sulfur. This is geologically accurate and adds a unique preservation mechanic — the brightest specimens are the freshest.
