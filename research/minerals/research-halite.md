# Species: Halite

### Identity
- **Formula:** NaCl
- **Crystal system:** Cubic (isometric)
- **Mineral group:** Halide
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 2.17
- **Cleavage:** Perfect on {001} (three directions at 90°, cubic)
- **Fracture:** Conchoidal
- **Luster:** Vitreous to greasy

### Color & Appearance
- **Typical color:** Colorless, white, also pink, orange, red, blue, yellow, gray
- **Color causes:** Pink/orange from halobacteria (carotenoid pigments in brine); blue from lattice defects (F-centers) caused by natural irradiation or structural strain; yellow from iron impurities; red from hematite inclusions
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Hoppered crystals (stepped "staircase" faces) common in rapid growth; perfect cubic morphology; blue halite shows dramatic color zoning. Fluorescent under LW UV in some specimens.

### Crystal Habits
- **Primary habit:** Cubic crystals, often with hoppered (skeletal) faces
- **Common forms/faces:** {100} dominant; rarely {110} and {111}
- **Twin laws:** Spinel law twinning rare
- **Varieties:** Rock salt (massive), hoppers (skeletal cubes), blue halite (irradiated), pink halite (bacterial)
- **Special morphologies:** Massive granular, stalactitic, fibrous/columnar in cave deposits, crusts and efflorescences

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Precipitates from brine at <~50°C in natural settings; volcanic sublimates form at 450–550°C
- **Optimal growth temperature:** 20–40°C (ambient evaporation)
- **Decomposition temperature:** Melts at 801°C; boiling point 1413°C
- **Temperature-dependent habits:** Higher evaporation rates → hoppered/skeletal crystals; slow evaporation → well-formed cubes. Volcanic sublimate halite forms fine-grained crusts.

#### Chemistry Required
- **Required elements in broth:** Na (sodium), Cl (chloride)
- **Optional/enhancing elements:** K (promotes sylvite co-precipitation); Mg, Ca (form later-stage evaporites); Sr, Ba (trace in brines)
- **Inhibiting elements:** None significant — halite is the most tolerant evaporite
- **Required pH range:** Broad tolerance (4–10); brine chemistry dominates over pH
- **Required Eh range:** Not redox-sensitive
- **Required O₂ range:** Irrelevant

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No — simple precipitation from supersaturated brine
- **Byproducts of nucleation:** Concentrates remaining brine in K, Mg, Ca (setting up later evaporite stages)
- **Byproducts of dissolution:** Na⁺ and Cl⁻ ions; lowers freezing point of water (cryogenic effect)

#### Growth Characteristics
- **Relative growth rate:** Fast — among the first minerals to precipitate from evaporating brine
- **Maximum crystal size:** Meter-scale cubes from salt mines (e.g., Wieliczka, Poland)
- **Typical crystal size in vugs:** 1–20 cm cubes common in evaporite cavities
- **Does growth rate change with temperature?** Yes — warmer = faster evaporation = faster growth, more hoppers
- **Competes with:** Sylvite (KCl), gypsum, anhydrite, carnallite (all form from same evaporating brine at different concentration stages)

#### Stability
- **Breaks down in heat?** Melts at 801°C
- **Breaks down in light?** Blue halite may fade with prolonged light exposure (F-center bleaching)
- **Dissolves in water?** Extremely soluble — 360 g/L at 25°C. The most water-soluble common mineral.
- **Dissolves in acid?** Dissolves readily in water; acids provide no advantage
- **Oxidizes?** No
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Blue halite is CAUSED by radiation (natural F-centers). Irradiation creates color centers; annealing removes them.

### Paragenesis
- **Forms AFTER:** Calcite, gypsum (earlier evaporite stages)
- **Forms BEFORE:** Sylvite, carnallite, kieserite, bischofite (later, more concentrated brine stages)
- **Commonly associated minerals:** Sylvite, gypsum, anhydrite, carnallite, polyhalite, kieserite, dolomite
- **Zone:** Evaporite (sedimentary), also volcanic sublimate
- **Geological environment:** Saline lakes, marine evaporite basins, salt domes/diapirs, volcanic fumaroles, playas

### Famous Localities
- **Classic locality 1:** Wieliczka Salt Mine, Poland — massive halite deposits, cathedral carved in salt
- **Classic locality 2:** Searles Lake, Trona, California — pink hoppered halite from evaporation ponds
- **Classic locality 3:** Saltville, Virginia & Detroit Salt Mine — US bedded deposits
- **Notable specimens:** Meter-scale cubes from Wieliczka; brilliant blue halite from Stassfurt, Germany; pink hoppers from Searles Lake

### Fluorescence
- **Fluorescent under UV?** Variable — some specimens yes
- **SW (255nm) color:** None typically
- **MW (310nm) color:** None typically
- **LW (365nm) color:** Weak white, yellow, or orange-red in some specimens
- **Phosphorescent?** Rare
- **Activator:** Organic inclusions, lattice defects, Mn²⁺ (in some specimens)
- **Quenched by:** Not well documented

### Flavor Text
> Halite is the taste of a dried ocean. Every crystal is a tiny act of patience — water leaving, salt remaining, the cube emerging because that's what sodium chloride does when given time and space. The blue ones are haunted: natural radiation knocked electrons from their chloride ions, and the vacancies left behind trap light the way a vug traps minerals. You can dissolve a million years of crystallization in a rainstorm. That's not fragility. That's the evaporite wager: I will exist exactly as long as the water stays away.

### Simulator Implementation Notes
- **New parameters needed:** Brine concentration tracker (supersaturation level)
- **New events needed:** Brine evaporation event; volcanic sublimate event
- **Nucleation rule pseudocode:**
```
IF Na > threshold AND Cl > threshold AND brine_concentration > halite_supersaturation → nucleate halite
```
- **Growth rule pseudocode:**
```
IF brine_concentration > halite_saturation → grow at rate proportional to supersaturation
IF supersaturation > 2x → hoppered habit (skeletal cubes)
IF supersaturation < 1.5x → well-formed cubes
IF radiation_event → chance of blue color variant
```
- **Habit selection logic:** High supersaturation → hoppers; slow growth → perfect cubes; volcanic → fine crusts
- **Decomposition products:** Dissolves completely into Na⁺ + Cl⁻ (re-enters brine pool)

### Variants for Game
- **Variant 1:** Blue halite — requires radiation event after formation; striking blue color from F-centers; rare and valuable
- **Variant 2:** Pink hoppered halite — forms in organic-rich brine; staircase crystal faces; common but beautiful
- **Variant 3:** Fibrous/columnar halite — forms in cave salt deposits (speleothem analog); fast growth, unusual habit

---

## Paragenetic Sequence: Evaporite Halides
Halite is the first halide to crystallize from evaporating brine. As concentration increases:
1. **Halite** (NaCl) — precipitates first (~10× seawater concentration)
2. **Sylvite** (KCl) — precipitates later (~20–25× seawater concentration)
3. **Carnallite** (KMgCl₃·6H₂O) — even later, Mg-rich residual brine

See also: `memory/research-sylvite.md`
