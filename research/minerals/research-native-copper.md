# Mineral Species Template — Vugg Simulator

## Species: Native Copper

### Identity
- **Formula:** Cu
- **Crystal system:** Cubic (isometric)
- **Mineral group:** Native element
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 8.95
- **Cleavage:** None
- **Fracture:** Hackly (jagged)
- **Luster:** Metallic
- **Tenacity:** Highly malleable and ductile

### Color & Appearance
- **Typical color:** Copper-red on fresh surfaces, tarnishes to dark brown/black, eventually green (malachite/verdigris coating)
- **Color causes:** Native Cu⁰ metallic bonding
- **Transparency:** Opaque
- **Streak:** Copper-red (metallic)
- **Notable visual features:** Metallic luster, hackly fracture, malleability (can be bent/deformed), arborescent (tree-like) and dendritic growth forms

### Crystal Habits
- **Primary habit:** Irregular masses, fracture fillings
- **Common forms/faces:** Cubes, dodecahedra, tetrahexahedra; rarely octahedra. Crystals to 10 cm at Keweenaw.
- **Twin laws:** On {111} — simple contact and penetration twins, cyclic groups
- **Varieties:** Crystalline (cubic/dodecahedral), arborescent (tree-like), dendritic (fern-like), filiform (wire), massive
- **Special morphologies:** Wires (elongated along [001]), dendrites (branching in fractures), sheets (flattened on {111})

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Very wide — from hydrothermal (>200°C) to supergene (<50°C)
- **Optimal growth temperature:** Variable; supergene native copper forms at ambient temps in reducing zones
- **Decomposition temperature:** Melts at 1085°C; oxidizes to cuprite/CuO above ~300°C in air
- **Temperature-dependent habits:** Higher T → larger crystalline masses; lower T → dendritic/arborescent

#### Chemistry Required
- **Required elements in broth:** Cu (high concentration)
- **Optional/enhancing elements:** Ag (forms halfbreed specimens), Bi (alloy)
- **Inhibiting elements:** High S²⁻ (forms sulfides instead), high O₂ (oxidizes to cuprite)
- **Required pH range:** 4–9 (wide tolerance)
- **Required Eh range:** Reducing (Eh < +0.2V for supergene; also forms in hydrothermal reducing conditions)
- **Required O₂ range:** LOW — native copper requires reducing conditions. It forms BELOW the water table in the supergene enrichment zone, where sulfide-reducing bacteria deplete oxygen.

#### Secondary Chemistry Release
- **Byproducts of nucleation:** None (pure metal precipitation)
- **Byproducts of dissolution:** Releases Cu²⁺ (oxidative dissolution)

#### Growth Characteristics
- **Relative growth rate:** Slow (requires specific reducing conditions and high Cu concentration)
- **Maximum crystal size:** Crystals to 10 cm; massive sheets to hundreds of kg (Keweenaw)
- **Typical crystal size in vugs:** Millimeters to centimeters; wires and dendrites common
- **Does growth rate change with temperature?** Higher T → faster, but supergene formation is inherently slow
- **Competes with:** Cuprite (if O₂ present), chalcocite/covellite (if S²⁻ present), malachite/azurite (if CO₃ present and oxidizing)

#### Stability
- **Breaks down in heat?** Melts at 1085°C; oxidizes above ~300°C in air → cuprite (Cu₂O) → tenorite (CuO)
- **Breaks down in light?** Stable (tarnishes in air over time, but not light-sensitive)
- **Dissolves in water?** No (practically insoluble in neutral water)
- **Dissolves in acid?** Nitric acid (vigorous); slow in HCl with O₂; resistant to sulfuric
- **Oxidizes?** Yes — tarnish layer of cuprite → malachite/azurite in long term. This is the GREEN patina on copper roofs.
- **Radiation sensitivity:** None

### Paragenesis
- **Forms AFTER:** Primary copper sulfides (chalcopyrite, bornite) dissolve and Cu²⁺ migrates downward
- **Forms BEFORE:** Cuprite, malachite, azurite (these are what native copper BECOMES when re-oxidized)
- **Commonly associated minerals:** Cuprite, malachite, azurite, chalcocite, covellite, silver (Lake Superior), calcite, quartz, epidote, prehnite
- **Zone:** Supergene enrichment zone (BELOW water table, reducing) AND hydrothermal veins (primary)
- **Geological environment:** Basalt cavities (Keweenaw — vesicle fillings), oxidized copper deposits (enrichment blanket), hydrothermal veins

### Famous Localities
- **Classic locality 1:** Keweenaw Peninsula, Michigan — world's largest native copper deposits, crystals in basalt vesicles, massive sheets
- **Classic locality 2:** Bisbee/Jerome, Arizona — supergene enrichment zone specimens
- **Classic locality 3:** Tsumeb, Namibia — crystalline copper with cuprite/malachite
- **Notable specimens:** Keweenaw: 500-ton masses; Ray Mine, Arizona — dendritic groups; Dzhezkazgan, Kazakhstan

### Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)
- **SW (255nm) color:** N/A
- **LW (365nm) color:** N/A
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text
> Native copper is the metal remembering it was once rock. In the Keweenaw Peninsula, copper filled basalt vesicles like water filling bubbles — no crystals, just pure metallic shapes pressed into volcanic memory. Some specimens are sheets the size of doors; others are delicate dendrites, copper trees growing in fractures, each branch a path that Cu²⁺ ions followed to find a reducing electron. The thing about native copper is that it's unstable at the surface. Give it air and time and it turns green — cuprite, then malachite. The patina on the Statue of Liberty is a mineral species. Every copper roof in the world is growing malachite, slowly, one rainstorm at a time.

### Simulator Implementation Notes
- **New parameters needed:** Eh (redox potential) — critical for native copper vs cuprite vs sulfides. Also needs reducing zone detection (below water table).
- **New events needed:** `event_water_table` — defines boundary between oxidizing zone (above) and reducing zone (below). Native copper forms below.
- **Nucleation rule pseudocode:**
```
IF trace_Cu > high_threshold AND Eh < 0.2 AND S < low_threshold AND T < 300°C → nucleate native copper
(supergene: Cu²⁺ reduced to Cu⁰ in enrichment blanket)
(hydrothermal: Cu precipitates from reducing hydrothermal fluid)
```
- **Growth rule pseudocode:**
```
IF σ_native_copper > 1 AND Eh < 0.2 → grow at rate 2 (slow)
Rate increases slightly with T
IF Eh rises above 0.3 → STOP growth, begin oxidation to cuprite
```
- **Habit selection logic:**
  - Growth in open vesicle → cubes/dodecahedra (rare, crystalline)
  - Growth in fracture → dendritic/arborescent (common)
  - Growth in narrow channel → wire copper (elongated [001])
  - Massive fill → irregular sheets
- **Decomposition products:** Oxidation → cuprite (Cu₂O) → tenorite (CuO) at high T. Long-term weathering → malachite/azurite (with CO₃).

### Variants for Game
- **Variant 1: Crystalline copper** — cubic/dodecahedral crystals. Condition: open vug space, slow growth, very low S. Keweenaw style.
- **Variant 2: Dendritic copper** — branching tree-like forms. Condition: fracture-fill growth, moderate Cu supply. Most photogenic.
- **Variant 3: Copper halfbreed** — native copper with native silver intergrown. Condition: trace Ag present in Cu-rich fluid. Lake Superior specialty.

### Paragenetic Sequence Note
Native copper sits at a critical junction in the copper paragenesis. In the **supergene model**: primary sulfides (chalcopyrite, bornite) oxidize near the surface → Cu²⁺ dissolves and migrates downward → at the water table (reducing zone), Cu²⁺ precipitates as native copper or secondary sulfides (chalcocite, covellite). If the water table drops and native copper is exposed to oxidizing conditions, it converts to cuprite, then malachite/azurite. In hydrothermal settings (Keweenaw), native copper precipitates directly from reducing Cu-bearing fluids in basalt vesicles — a primary, not supergene, occurrence.

### Simulator Redox Zone Model
```
Surface (oxidizing, Eh > 0.4)
  → malachite, azurite, cuprite, goethite

Water table (Eh transition ~0.2-0.4)
  → mixed zone

Enrichment blanket (reducing, Eh < 0.2)
  → native copper, chalcocite, covellite

Primary zone (below weathering)
  → chalcopyrite, bornite (original sulfides)
```
