# Mineral Species — Acanthite (Low-T Ag₂S)

## Species: Acanthite

### Identity
- **Formula:** Ag₂S
- **Crystal system:** Monoclinic (pseudo-orthorhombic)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 7.2–7.4
- **Cleavage:** Poor on {110}, rarely observed
- **Fracture:** Sub-conchoidal to uneven
- **Luster:** Metallic, bright when fresh, dulls with tarnish

### Color & Appearance
- **Typical color:** Lead-gray to iron-black, tarnishes darker
- **Color causes:** Inherent metallic silver sulfide; surface oxidation darkens it
- **Transparency:** Opaque
- **Streak:** Shiny metallic gray
- **Notable visual features:** Thorn-like (ακανθα = thorn) crystal projections; pseudomorphs after cubic argentite retain isometric outlines despite monoclinic internal structure

### Crystal Habits
- **Primary habit:** Massive, granular vein fillings
- **Common forms/faces:** Elongated prismatic, distorted pseudo-cubic (after argentite)
- **Twin laws:** Not characteristic
- **Varieties:** Pseudomorph after argentite is the most commonly encountered form
- **Special morphologies:** Thorn-like aggregates, wiry/hackly masses, disseminations in gangue

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <173°C (stable as acanthite; above 173°C forms as argentite)
- **Optimal growth temperature:** 50–170°C (epithermal)
- **Decomposition temperature:** ~825°C (melting)
- **Temperature-dependent habits:** Above 173°C → argentite (cubic). On cooling through 173°C → acanthite (monoclinic) retaining cubic external form (paramorph/pseudomorph)

#### Chemistry Required
- **Required elements in broth:** Ag (high), S
- **Optional/enhancing elements:** Se (partial substitution for S), Te (trace)
- **Inhibiting elements:** Excess Fe, Cu can divert Ag into sulfosalts (tetrahedrite, polybasite)
- **Required pH range:** Neutral to mildly acidic
- **Required Eh range:** Moderately reducing (sulfide stability field)
- **Required O₂ range:** Low — oxidizing conditions dissolve acanthite, releasing Ag⁺

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes Ag⁺ and S²⁻ from fluid
- **Byproducts of nucleation:** Minor H⁺ if forming from bisulfide complexes
- **Byproducts of dissolution:** Ag⁺ ions into solution (supergene enrichment), sulfate if oxidized

#### Growth Characteristics
- **Relative growth rate:** Moderate — silver diffusion is fast but nucleation is rate-limiting
- **Maximum crystal size:** Crystals to ~5 cm; massive veins to meters
- **Typical crystal size in vugs:** 1–20 mm crystals, more often massive
- **Does growth rate change with temperature?** Yes — faster near 173°C transition
- **Competes with:** Native silver (more reduced), silver sulfosalts (polybasite, pyrargyrite), cerargyrite (AgCl in chloride-rich systems)

#### Stability
- **Breaks down in heat?** Transitions to argentite at 173°C (reversible on cooling)
- **Breaks down in light?** No
- **Dissolves in water?** Negligible
- **Dissolves in acid?** Dissolves in nitric acid (HNO₃)
- **Oxidizes?** Yes — surface tarnishes to darker sulfide; in strong oxidation, silver goes into solution
- **Dehydrates?** N/A
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Argentite (on cooling), primary silver-bearing sulfides (galena, tetrahedrite)
- **Forms BEFORE:** Native silver (if conditions become more reducing), cerargyrite (if Cl⁺ available)
- **Commonly associated minerals:** Native silver, galena, sphalerite, pyrite, tetrahedrite, polybasite, proustite, pyrargyrite, calcite, quartz
- **Zone:** Primary/hypogene (epithermal veins), supergene enrichment (secondary acanthite from oxidized silver minerals)
- **Geological environment:** Low-sulfidation epithermal veins, mesothermal veins, supergene enrichment zones, VMS deposits (minor)

### Famous Localities
- **Classic locality 1:** Guanajuato, Mexico — pseudomorphic cubic crystals
- **Classic locality 2:** Freiberg, Saxony, Germany — historic silver mining district
- **Classic locality 3:** Kongsberg, Norway — associated with spectacular native silver
- **Notable specimens:** Rayas Mine, Guanajuato produces sharp pseudo-cubic crystals to several cm

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text
> Acanthite is the cold-storage form of silver sulfide — what argentite becomes when the hydrothermal furnace cools below 173°C. The cubic crystal shapes it inherited from its hotter self don't change, even as the atomic lattice underneath quietly shifts from isometric to monoclinic. It's a mineral wearing its old clothes to a new job. At 87% silver by weight, it's the most important silver ore on Earth, yet most collectors know it as the dark tarnish on a native silver specimen. The thorn in its name is real: rare acanthite crystals sprout in spiky aggregates that look like mineral frost. Most of the world's historic silver — from Kongsberg's cathedral wires to Potosí's mountain of ore — passed through acanthite's lattice on its way to the smelter.

### Simulator Implementation Notes
- **New parameters needed:** trace_Ag (if not already tracked)
- **New events needed:** Argentite→Acanthite phase transition on cooling through 173°C
- **Nucleation rule pseudocode:**
```
IF temp < 173°C AND trace_Ag > threshold AND S²⁻ available AND Eh = reducing → nucleate acanthite
```
- **Growth rule pseudocode:**
```
IF temp < 173°C AND trace_Ag available AND S²⁻ available → grow at moderate rate
IF temp crosses 173°C downward AND argentite exists → convert to acanthite (pseudomorph)
```
- **Habit selection logic:** If formed from argentite → pseudo-cubic habit. If primary → thorn-like/massive
- **Decomposition products:** Above 173°C → argentite. Oxidation → Ag⁺ in solution (feeds native silver formation)

### Variants for Game
- **Variant 1:** Pseudo-cubic acanthite — formed by cooling argentite through 173°C transition, retains cubic morphology
- **Variant 2:** Thorn acanthite — primary low-temperature growth, spiky/prismatic habit
- **Variant 3:** Massive acanthite — granular vein filling, most common form, economic ore grade
