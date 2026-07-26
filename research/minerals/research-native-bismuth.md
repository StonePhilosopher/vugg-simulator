# Research: Native Bismuth (Bi) — Vugg Simulator

## Species: Native Bismuth

### Identity
- **Formula:** Bi
- **Crystal system:** Trigonal (rhombohedral)
- **Mineral group:** Native element
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 9.8 (remarkably dense — heavier than lead)
- **Cleavage:** Perfect rhombohedral {0001}
- **Fracture:** Hackly
- **Luster:** Metallic, high luster when fresh

### Color & Appearance
- **Typical color:** Silver-white with reddish tinge when fresh; iridescent oxide tarnish (yellow, blue, pink)
- **Color causes:** Thin-film interference from surface oxide layer (Bi₂O₃)
- **Transparency:** Opaque
- **Streak:** Silver-white
- **Notable visual features:** Famous hoppered/stair-step crystals (created during laboratory growth, rare in nature); iridescent oxide tarnish is the iconic look

### Crystal Habits
- **Primary habit:** Massive, granular; rare pseudocubic/rhombohedral crystals
- **Common forms/faces:** Rhombohedral {0001}, rarely well-formed
- **Twin laws:** None common
- **Varieties:** Lab-grown hoppered crystals (not natural but widely known)
- **Special morphologies:** Arborescent (tree-like), wiry, reticulated masses in veins

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** 100–500°C (forms from cooling Bi-rich fluids)
- **Optimal growth temperature:** 200–400°C
- **Decomposition temperature:** Melts at 271.5°C (!) — unusually low melting point for a metal
- **Temperature-dependent habits:** Above 271.5°C as melt droplets; crystallizes on cooling below melting point

#### Chemistry Required
- **Required elements:** Bi (high concentration, >100 ppm in fluid)
- **Optional/enhancing elements:** Sb (forms bismuth-antimony series), As, Te, Ag, Pb
- **Inhibiting elements:** S (promotes bismuthinite instead), high O₂
- **Required pH range:** Wide tolerance
- **Required Eh range:** Strongly reducing (prevents oxidation to Bi₂O₃)
- **Required O₂ range:** Very low

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Removes Bi⁰ from fluid
- **Byproducts of dissolution:** Oxidation releases Bi³⁺ to solution, available for secondary minerals

#### Growth Characteristics
- **Relative growth rate:** Fast (native metals crystallize readily from melt/supersaturated solution)
- **Maximum crystal size:** Rare well-formed crystals to a few cm; massive accumulations larger
- **Typical crystal size in vugs:** 1–20 mm arborescent/granular masses
- **Does growth rate change with temperature?** Crystallizes from melt at 271.5°C; rapid crystal growth during cooling
- **Competes with:** Bismuthinite (if S is available, Bi prefers sulfide), bismite (if oxidizing)

#### Stability
- **Breaks down in heat?** Melts at 271.5°C — one of the lowest melting points of any metal
- **Breaks down in light?** No
- **Dissolves in water?** No
- **Dissolves in acid?** Slowly in HNO₃ and HCl
- **Oxidizes?** Yes — surface tarnish to Bi₂O₃ (iridescent); deep oxidation to bismite
- **Radiation sensitivity:** ²⁰⁹Bi is technically radioactive (alpha decay, half-life 2.01×10¹⁹ years — effectively stable)

### Paragenesis
- **Forms AFTER:** Bismuthinite (Bi₂S₃ — primary sulfide forms first when S is available)
- **Forms BEFORE:** Bismite (Bi₂O₃), bismutite (Bi₂(CO₃)O₂), clinobisvanite (BiVO₄ — in oxidation zone with V)
- **Commonly associated minerals:** Bismuthinite, arsenopyrite, chalcopyrite, cassiterite, wolframite, quartz, tourmaline, pyrite
- **Zone:** Primary/hypogene (forms when S is depleted but Bi remains in fluid)
- **Geological environment:** High-temperature hydrothermal veins, greisen deposits, pegmatites, Sn-W mineralization

### Famous Localities
- **Classic locality 1:** Potosí, Bolivia — with bismuthinite, world's best specimens
- **Classic locality 2:** Schneeberg, Saxony, Germany — historic Ag-Co-Bi mining district
- **Classic locality 3:** Kingsgate, NSW, Australia — with molybdenite
- **Notable specimens:** Arborescent masses from Bolivia; lab-grown hoppered crystals (ubiquitous in rock shops, NOT natural)

### Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)

### Flavor Text

> Native bismuth is the mineral that launched a thousand误解 — a thousand misunderstandings. Every rock shop sells those rainbow stair-step crystals, and every buyer thinks they came from the ground. They didn't. They grew in a crucible at 271 degrees, the temperature of a hot oven. Real native bismuth is silver-white, dense as sin (gravity 9.8 — heavier than lead), and hideous by comparison: granular, arborescent, occasionally wiry, found only where sulfur ran out before bismuth did. It's the leftover. The element that couldn't find a partner. But it's the key to the whole bismuth paragenesis — bismuthinite crystallizes first when sulfur is plentiful, and when the sulfur tap runs dry, the bismuth that remains comes out as native metal. Then oxidation converts both of them to bismite and bismutite, the pale powders that tell you bismuth was here. The rainbow stairs are a laboratory fiction. The real mineral is better: it's the story of a chalcophile element that couldn't find enough sulfur.

### Simulator Implementation Notes
- **New parameters needed:** None (trace_Bi already tracked)
- **New events needed:** Sulfur depletion event — when fluid S²⁻ falls below threshold but Bi remains high
- **Nucleation rule pseudocode:**
```
IF trace_Bi > 100 AND S²⁻ < 10 (sulfur-depleted) AND Eh < -0.1 AND temp 100-271 → nucleate native bismuth
```
- **Growth rule pseudocode:**
```
IF σ_native_Bi > 1.0 AND temp < 271 → grow at rate 5
Above 271.5°C: Bi is liquid (melt droplets, no crystallization)
```
- **Habit selection logic:** Default: arborescent/granular. Never produces hoppered crystals (those are lab-only).
- **Decomposition products:** Melts at 271.5°C → Bi liquid. Oxidation → bismite (Bi₂O₃).

### Variants for Game
- **Variant 1:** Sb-bearing bismuth — bismuth-antimony alloy, slightly lower melting point, harder
- **Variant 2:** Arborescent (tree-like) — dendritic growth in open fractures, visually striking
- **Variant 3:** Massive granular — default habit, intergrown with quartz and bismuthinite

### Paragenetic Linkage
Native bismuth and bismuthinite are the two primary carriers of bismuth in hydrothermal systems. The simulator should model S²⁻ availability as the switch:
- **High S²⁻ + Bi → bismuthinite** (sulfide pathway)
- **Low S²⁻ + Bi → native bismuth** (metal pathway)
- **Both → oxidation zone → bismite/bismutite → clinobisvanite (if V present)**

This mirrors the real-world sequence seen in Bolivian Sn-W deposits.
