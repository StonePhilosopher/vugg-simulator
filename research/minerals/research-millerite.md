# Mineral Species Research — Millerite

## Species: Millerite

### Identity
- **Formula:** NiS
- **Crystal system:** Trigonal
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 3–3.5
- **Specific gravity:** 5.3–5.5
- **Cleavage:** Perfect on {10Ī1} and {01Ī2} (obscured by acicular habit)
- **Fracture:** Uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Pale brass-yellow to bronze-yellow, tarnishes to iridescent
- **Color causes:** Intrinsic nickel; tarnish from surface oxidation
- **Transparency:** Opaque
- **Streak:** Greenish black
- **Notable visual features:** Acicular (needle-like) crystals forming radiating sprays, furry aggregates, capillary tufts. One of the most distinctive crystal habits in the mineral kingdom.

### Crystal Habits
- **Primary habit:** Acicular — needle-like, often in radial sprays up to several cm
- **Common forms/faces:** {2ĪĪ1}, {100}, {101}
- **Twin laws:** Not common
- **Varieties:** "Hair pyrites" (old synonym)
- **Special morphologies:** Capillary (hair-thin), massive, radiating fibrous tufts, furry coatings on vug walls

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Low to moderate — 100–400°C (metamorphic/hydrothermal)
- **Optimal growth temperature:** 200–350°C
- **Decomposition temperature:** Converts to polydymite Ni₃S₄ or violarite above ~350°C with excess S; stable at low T
- **Temperature-dependent habits:** Always acicular regardless of temperature

#### Chemistry Required
- **Required elements in broth:** Ni (>50 ppm), S (>30 ppm)
- **Optional/enhancing elements:** Co (substitutes for Ni), Fe (trace, in solid solution)
- **Inhibiting elements:** Excess S promotes pentlandite/pyrrhotite instead; Cu diverts Ni into pentlandite
- **Required pH range:** Near-neutral to slightly alkaline
- **Required Eh range:** Reducing (sulfide-stable conditions)
- **Required O₂ range:** Very low — sulfide stability field

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No significant release
- **Byproducts of nucleation:** None notable
- **Byproducts of dissolution/decomposition:** Sulfide oxidation releases H⁺ (acid) and SO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Moderate — needle habit suggests fast elongation along c-axis
- **Maximum crystal size:** Needles up to ~5 cm in exceptional geodes
- **Typical crystal size in vugs:** 1–30 mm needles
- **Does growth rate change with temperature?** Not significantly (no retrograde solubility known)
- **Competes with:** Pentlandite (Fe,Ni)₉S₈ (higher S), heazlewoodite Ni₃S₂ (lower S), pyrrhotite Fe₁₋ₓS

#### Stability
- **Breaks down in heat?** Converts to polydymite/violarite above ~350°C with sulfur; becomes magnetic on heating
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Slowly in HNO₃; resistant to HCl
- **Oxidizes?** Yes — surface tarnish to iridescence; prolonged oxidation → gaspéite/garnierite (Ni carbonates/silicates) + sulfuric acid
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Pentlandite breakdown during metamorphism; olivine serpentinization releases Ni
- **Forms BEFORE:** Heazlewoodite (Ni₃S₂) at even lower sulfur fugacity; annabergite/gaspéite in oxidation zone
- **Commonly associated minerals:** Heazlewoodite, pentlandite (parent), pyrrhotite, nickeline, calcite, quartz, dolomite
- **Zone:** Primary/hypogene (metamorphic replacement) and hydrothermal veins
- **Geological environment:** Serpentinite ultramafics, carbonate-hosted hydrothermal veins, coal measures, limestone/dolomite geodes

### Famous Localities
- **Keokuk, Iowa / St. Louis, Missouri:** Classic geode locality with stunning radial sprays
- **Siegerland, Germany:** Type locality (historical mining district)
- **Thompson Mine, Manitoba, Canada:** Major Ni district, millerite as alteration product
- **Notable specimens:** Keokuk geodes with centimeter-long golden needle sprays on quartz are iconic

### Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Millerite grows like hair on stone — pale brass needles radiating from a single point, each one a crystal that refused to grow fat and chose instead to grow long. It forms when pentlandite loses its sulfur during metamorphism, the nickel left behind concentrating into these impossibly fine filaments. In Keokuk geodes, golden sprays erupt from quartz walls like mineral sparks frozen mid-flight. The old miners called it "hair pyrites," which misses the point entirely. It's not pyrite trying to be hairy. It's nickel distilled to its most expressive form — a mineral that chose tension over mass.

### Simulator Implementation Notes
- **New parameters needed:** trace_Ni already in broth (from species list)
- **New events needed:** None unique — forms when Ni + S available under reducing conditions
- **Nucleation rule pseudocode:**
```
IF trace_Ni > 50 AND trace_S > 30 AND Eh < -0.2 AND T < 400 AND vug has space
  → nucleate millerite (max 3 crystals)
```
- **Growth rule pseudocode:**
```
IF σ_millerite > 1.0 → grow along c-axis preferentially (acicular habit)
  rate = moderate, proportional to Ni availability
```
- **Habit selection logic:** Always acicular. No habit variants needed.
- **Decomposition products:** Oxidation → annabergite Ni₃(AsO₄)₂·8H₂O (if As present) or garnierite/gaspéite

### Variants for Game
- **Variant 1: Radial spray** — classic, needles radiate from central point. Default.
- **Variant 2: Capillary mat** — dense furry coating on vug walls. Forms when many nucleation points compete.
- **Variant 3: Massive bronze** — rarely, forms massive aggregates instead of needles. Higher temperature.

### Paragenetic Sequence: Nickel Minerals
Millerite belongs to the **nickel sulfide metamorphic sequence**:
- Olivine (magmatic, Ni in lattice) → serpentinization → millerite (low S) or heazlewoodite (very low S)
- In Ni-As systems: nickeline (NiAs) + millerite (NiS) co-occur in hydrothermal veins
- Oxidation: millerite → annabergite (Ni arsenate, if As) or gaspéite (Ni carbonate)
- See also: `memory/research-nickeline.md`
