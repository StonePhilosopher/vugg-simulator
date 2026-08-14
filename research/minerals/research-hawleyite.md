# Research: Hawleyite (CdS, cubic)

## Species: Hawleyite

### Identity
- **Formula:** CdS
- **Crystal system:** Cubic (isometric)
- **Mineral group:** Sulfide — sphalerite group
- **Hardness (Mohs):** 2.5–3.0
- **Specific gravity:** 4.87
- **Cleavage:** {011} perfect (like sphalerite — same structure)
- **Fracture:** Conchoidal to uneven
- **Luster:** Metallic to adamantine (crystals rare; massive material appears earthy)

### Color & Appearance
- **Typical color:** Bright cadmium yellow (the archetypal "cadmium yellow" pigment color)
- **Color causes:** Same Cd-S charge transfer as greenockite — identical chemistry, different crystal structure. The cubic symmetry doesn't shift the color significantly.
- **Transparency:** Translucent to opaque (almost never seen as discrete crystals — typically powdery)
- **Streak:** Light yellow
- **Notable visual features:** Indistinguishable from powdery greenockite by sight. Requires XRD to differentiate. The "cadmium ochre" of old mineralogy textbooks.

### Crystal Habits
- **Primary habit:** Powdery massive — bright yellow earthy coatings
- **Common forms/faces:** Crystallized material essentially unknown; always microcrystalline to amorphous
- **Twin laws:** None documented (crystals too small)
- **Varieties:** None named. Zn-bearing material would be intermediate in the CdS-ZnS series (toward sphalerite).
- **Special morphologies:** Only known as powdery coatings and crusts on sphalerite, siderite, and other supergene minerals.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <100°C (supergene, near-surface)
- **Optimal growth temperature:** 10–50°C (ambient to mildly heated ground water)
- **Decomposition temperature:** Same as greenockite — oxidizes >600°C, melts ~980°C
- **Temperature-dependent habits:** Always powdery regardless of temperature. The cubic dimorph is thermodynamically metastable relative to hexagonal greenockite, but forms kinetically at low T.

#### Chemistry Required
- **Required elements in broth:** Cd²⁺, S²⁻
- **Optional/enhancing elements:** Zn²⁺ (promotes sphalerite-structure nucleation)
- **Inhibiting elements:** Same as greenockite
- **Required pH range:** Neutral to slightly acidic (5–7)
- **Required Eh range:** Reducing to mildly oxidizing — supergene conditions where sphalerite is breaking down
- **Required O₂ range:** Low — needs residual sulfide to precipitate as CdS rather than oxidizing fully

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Same as greenockite — consumes Cd²⁺ and S²⁻
- **Byproducts of nucleation:** None
- **Byproducts of dissolution/decomposition:** Cd²⁺ (toxic) + SO₄²⁻ on oxidation

#### Growth Characteristics
- **Relative growth rate:** Fast (same Ksp as greenockite — identical chemistry)
- **Maximum crystal size:** Powdery — effectively no macro crystals known
- **Typical crystal size in vugs:** Sub-microscopic to microcrystalline powder
- **Does growth rate change with temperature?** Not meaningfully — always forms as powder
- **Competes with:** Greenockite (hexagonal dimorph — competes for same Cd + S), sphalerite (for S²⁻)

#### Stability
- **Breaks down in heat?** Yes — same as greenockite
- **Breaks down in light?** Darkens with UV exposure (same photoreactivity as greenockite)
- **Dissolves in water?** Essentially insoluble (Ksp ~10⁻²⁸)
- **Dissolves in acid?** Strong mineral acids; same as greenockite
- **Oxidizes?** Yes — CdS → Cd²⁺ + SO₄²⁻ in oxidizing conditions
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Same as greenockite

### Paragenesis
- **Forms AFTER:** Sphalerite (Cd source), galena
- **Forms BEFORE:** Otavite (CdCO₃), cadmium oxides
- **Commonly associated minerals:** Sphalerite, galena, siderite, smithsonite, greenockite, cerussite
- **Zone:** Supergene/oxidation — the lowest-temperature Cd sulfide
- **Geological environment:** Oxidation zones of Cd-bearing Zn-Pb deposits, deposited by meteoric water in vugs

### Famous Localities
- **Classic locality 1:** Hector-Calumet mine, Keno-Galena Hill, Yukon Territory, Canada (type locality — 1955)
- **Classic locality 2:** Příbram, Czech Republic
- **Classic locality 3:** Broken Hill, New South Wales, Australia
- **Notable specimens:** Type material from Yukon — bright yellow powder on sphalerite/siderite. No significant crystal specimens exist.

### Fluorescence
- **Fluorescent under UV?** Yes — bright yellow under UV
- **SW (255nm) color:** Yellow
- **MW (310nm) color:** Yellow
- **LW (365nm) color:** Bright yellow (confirmed from mineral dealer specimens)
- **Phosphorescent?** Not documented
- **Activator:** Likely same Zn substitution mechanism as greenockite, or intrinsic CdS semiconductor bandgap
- **Quenched by:** Fe, as with greenockite

### Flavor Text

> Hawleyite is greenockite's shadow — the same chemistry wearing a different hat. Where greenockite builds hexagonal barrels, hawleyite settles for a powdery yellow anonymity, crystallizing in the sphalerite structure because that's what low temperatures and meteoric water favor. It was found in 1955 in a Canadian lead mine and named for a mineralogist from Queen's University. You will never see a hawleyite crystal. Nobody has. It exists as a bright yellow dust on sphalerite, a coating so fine it was confused with greenockite for a century until X-rays could tell them apart. Most "greenockite" in collections is probably hawleyite. Most collectors don't care — the yellow is the same either way. But the structure knows. The cubic symmetry remembers that it formed in cold groundwater, a meteoric precipitation, cadmium squeezed out of decaying sphalerite by rain and time.

### Simulator Implementation Notes
- **New parameters needed:** None beyond trace_Cd (shared with greenockite)
- **New events needed:** Same sphalerite oxidation event releases Cd
- **Nucleation rule pseudocode:**
```
IF trace_Cd > 0.1 ppm AND S_total > 1 ppm AND T < 100°C AND Eh < 0.4V → nucleate hawleyite
(cubic dimorph preferred at low T; hexagonal greenockite at higher T)
```
- **Growth rule pseudocode:**
```
σ = (Cd × S) / Ksp  [same Ksp as greenockite, ~10⁻²⁸]
IF σ > 1 → grow as powdery coating
Habit: always powdery/massive (no crystal habit logic needed)
```
- **Habit selection logic:** No habit variation — always powdery yellow coating. If T > 200°C, switch to greenockite instead.
- **Decomposition products:** Same as greenockite → Cd²⁺ + SO₄²⁻ (oxidation), or otavite (CdCO₃)

### Variants for Game
- **Variant 1: Hawleyite coating** — The only variant. Bright yellow powder on sphalerite/siderite. Low T, supergene. Fluorescent yellow under UV.

### Dimorph Note
Hawleyite (cubic CdS) is the low-temperature dimorph of greenockite (hexagonal CdS). In the simulator, the temperature threshold (~200°C) determines which polymorph nucleates. Hawleyite is always powdery; greenockite can form crystals at higher T. See `memory/research-greenockite.md`.

### Implementation Strategy (Both Dimorphs)
Rather than implementing as two fully separate minerals, consider a single "CdS" species with a polymorph flag:
- T < 100°C, supergene → hawleyite (cubic, powdery, bright yellow)
- T > 100°C, hydrothermal → greenockite (hexagonal, crystallized possible, honey yellow)
- Both share: Cd + S chemistry, same Ksp, same fluorescence, same toxicity
- Differentiate in display: hawleyite always shows as coating; greenockite can show as micro crystals

This mirrors the existing sphalerite/wurtzite polymorphism already in the game.
