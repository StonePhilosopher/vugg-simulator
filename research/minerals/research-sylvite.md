# Species: Sylvite

### Identity
- **Formula:** KCl
- **Crystal system:** Cubic (isometric)
- **Mineral group:** Halide
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 1.99 (lighter than halite)
- **Cleavage:** Perfect on {001} (three directions at 90°, cubic) — identical to halite
- **Fracture:** Uneven to conchoidal
- **Luster:** Vitreous

### Color & Appearance
- **Typical color:** Colorless to white, also pale yellow, reddish (from hematite inclusions), blue-gray
- **Color causes:** Yellow/red from iron oxide inclusions; blue-gray from radiation damage (F-centers, same mechanism as blue halite)
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Essentially indistinguishable from halite visually — bitter taste (vs. salty for halite) is the classic field test. Some specimens show oriented halite inclusions in parallel.

### Crystal Habits
- **Primary habit:** Cubic crystals (isomorphous with halite)
- **Common forms/faces:** {100} dominant
- **Twin laws:** Rare
- **Varieties:** Massive sylvite (most common); well-formed cubes less common than halite
- **Special morphologies:** Granular massive in bedded deposits; rarely stalactitic

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Precipitates from highly concentrated brine at ambient to moderate temperatures
- **Optimal growth temperature:** 20–50°C
- **Decomposition temperature:** Melts at 770°C (lower than halite's 801°C)
- **Temperature-dependent habits:** Similar to halite — faster evaporation favors skeletal forms

#### Chemistry Required
- **Required elements in broth:** K (potassium), Cl (chloride)
- **Optional/enhancing elements:** Na (halite co-precipitates first, setting the stage); Mg (carnallite forms after)
- **Inhibiting elements:** High Na concentrations (halite precipitates preferentially, consuming Cl before sylvite can form)
- **Required pH range:** Broad tolerance (not pH-sensitive)
- **Required Eh range:** Not redox-sensitive
- **Required O₂ range:** Irrelevant

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No
- **Byproducts of nucleation:** Further concentrates brine in Mg (setting up carnallite stage)
- **Byproducts of dissolution:** K⁺ and Cl⁻ ions

#### Growth Characteristics
- **Relative growth rate:** Moderate — slower than halite (requires more concentrated brine)
- **Maximum crystal size:** Decimeter-scale cubes rare; typically granular massive
- **Typical crystal size in vugs:** 1–10 cm cubes when well-formed
- **Does growth rate change with temperature?** Similar to halite
- **Competes with:** Halite (same Cl, but Na precipitates first), carnallite (competes for K in Mg-rich brine)

#### Stability
- **Breaks down in heat?** Melts at 770°C
- **Breaks down in light?** No
- **Dissolves in water?** Extremely soluble — 344 g/L at 25°C (even more soluble than halite). Deliquescent in humid air — absorbs moisture and dissolves itself.
- **Dissolves in acid?** Dissolves readily in water
- **Oxidizes?** No
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Can develop blue color centers like halite

### Paragenesis
- **Forms AFTER:** Halite (requires more concentrated brine than halite — typically 20–25× seawater)
- **Forms BEFORE:** Carnallite, kieserite, bischofite (late-stage Mg-rich evaporites)
- **Commonly associated minerals:** Halite, carnallite, kieserite, polyhalite, gypsum, anhydrite
- **Zone:** Evaporite (late-stage), also volcanic sublimate
- **Geological environment:** Marine evaporite basins (especially Zechstein-type deposits), salt domes, volcanic fumaroles, burning coal seams

### Famous Localities
- **Classic locality 1:** Stassfurt, Germany — type locality, Zechstein evaporite sequence
- **Classic locality 2:** Carlsbad, New Mexico — Permian basin potash deposits
- **Classic locality 3:** Solikamsk, Russia — Upper Kama potash deposits
- **Notable specimens:** Well-formed cubes from Stassfurt; large cleavage blocks from Carlsbad potash mines

### Fluorescence
- **Fluorescent under UV?** Yes, some specimens
- **SW (255nm) color:** Weak
- **MW (310nm) color:** Not well documented
- **LW (365nm) color:** Red-orange fluorescence reported in some specimens
- **Phosphorescent?** Reported
- **Activator:** Lattice defects, trace impurities; laser-induced luminescence studied by Gaft et al. (2018)
- **Quenched by:** Not well documented

### Flavor Text
> Sylvite is halite's younger sibling — same crystal structure, same cubic bones, but born from the dregs of a vanishing sea. By the time the brine is concentrated enough to precipitate potassium chloride, most of the sodium is already locked in halite cubes on the floor. What's left is the bitter residue: a mineral that tastes nothing like salt and everything like regret. It deliquesces in humid air, dissolving into its own tears. The most fragile thing in an evaporite sequence is the one that required the most patience to form.

### Simulator Implementation Notes
- **New parameters needed:** Brine K/Na ratio tracker
- **New events needed:** Late-stage brine concentration event
- **Nucleation rule pseudocode:**
```
IF K > threshold AND Cl > threshold AND brine_concentration > sylvite_supersaturation AND halite_already_depleted_Na → nucleate sylvite
```
- **Growth rule pseudocode:**
```
IF brine_concentration > sylvite_saturation AND Cl available (not consumed by halite) → grow
```
- **Habit selection logic:** Same cubic system as halite; habit differences driven by supersaturation level
- **Decomposition products:** Dissolves completely into K⁺ + Cl⁻ (re-enters brine pool)

### Variants for Game
- **Variant 1:** Blue sylvite — radiation-induced F-centers, rare
- **Variant 2:** Hematite-stained sylvite — red/pink from Fe₂O₃ inclusions, common in Stassfurt
- **Variant 3:** Carnallite intergrowth — sylvite with carnallite overgrowth, represents transitional brine chemistry

---

## Paragenetic Sequence: Evaporite Halides
See `memory/research-halite.md` for the full sequence description.
Sylvite precipitates after halite at ~20–25× seawater concentration. In the simulator, this means sylvite should only nucleate after significant halite has already removed Na from the brine.
