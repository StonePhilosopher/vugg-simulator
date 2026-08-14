# Mineral Species — Argentite (High-T Ag₂S)

## Species: Argentite

### Identity
- **Formula:** Ag₂S (high-temperature polymorph)
- **Crystal system:** Cubic (isometric) — body-centered
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 7.2–7.4
- **Cleavage:** Poor
- **Fracture:** Sub-conchoidal to uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Lead-gray to black, tarnishes dark
- **Color causes:** Inherent metallic silver sulfide
- **Transparency:** Opaque
- **Streak:** Shiny metallic gray
- **Notable visual features:** Sharp cubic/isometric crystal forms (cubes, octahedra, dodecahedra) that are actually pseudomorphs of acanthite after argentite at surface temperature

### Crystal Habits
- **Primary habit:** Cubic, octahedral crystals when well-formed
- **Common forms/faces:** Cube {100}, octahedron {111}, dodecahedron {110}
- **Twin laws:** Penetration twins on {111} (spinel law)
- **Varieties:** All "argentite" specimens at surface conditions are acanthite pseudomorphs
- **Special morphologies:** Arborescent/dendritic aggregates, massive

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** >173°C (stable only above this)
- **Optimal growth temperature:** 200–400°C
- **Decomposition temperature:** ~825°C (melting point of Ag₂S)
- **Temperature-dependent habits:** ONLY exists as argentite above 173°C; below → converts to acanthite (monoclinic)

#### Chemistry Required
- **Required elements in broth:** Ag (high concentration), S
- **Optional/enhancing elements:** Se (selenian argentite)
- **Inhibiting elements:** High Cu pushes Ag into sulfosalts instead
- **Required pH range:** Neutral to mildly acidic
- **Required Eh range:** Moderately reducing
- **Required O₂ range:** Low — sulfide stability

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Same as acanthite
- **Byproducts of dissolution:** Ag⁺ in solution on oxidation

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast at high temperature
- **Maximum crystal size:** To several cm cubes
- **Typical crystal size in vugs:** 2–30 mm cubes
- **Competes with:** Same as acanthite — native silver, silver sulfosalts

#### Stability
- **Breaks down in heat?** Melts at ~825°C. Phase transition to acanthite below 173°C (irreversible structural change)
- **Oxidizes?** Yes — same behavior as acanthite post-conversion
- **Other stability notes:** CRITICAL — argentite is NOT stable at surface temperature. All museum specimens are acanthite preserving argentite's crystal shape

### Paragenesis
- **Forms AFTER:** Primary silver-bearing sulfides precipitate first at higher temps
- **Forms BEFORE:** Acanthite (on cooling), native silver (on reduction)
- **Commonly associated minerals:** Same as acanthite — galena, sphalerite, native silver, tetrahedrite, polybasite, calcite, quartz
- **Zone:** Hypogene (primary, high-temperature hydrothermal)
- **Geological environment:** Epithermal veins (high-T zone), mesothermal veins

### Famous Localities
- **Classic locality 1:** Comstock Lode, Nevada, USA
- **Classic locality 2:** Freiberg, Saxony, Germany
- **Classic locality 3:** Pachuca-Real del Monte, Mexico
- **Notable specimens:** Sharp cubic crystals from Guanajuato and Freiberg

### Fluorescence
- **Fluorescent under UV?** No
- **All wavelengths:** None

### Flavor Text
> Argentite is a ghost — a mineral that doesn't exist at room temperature. Every "argentite" in every museum drawer is actually acanthite wearing argentite's cubic crystal habit like a hand-me-down coat. Above 173°C, silver sulfide crystallizes in the isometric system: clean cubes, octahedra, dodecahedra. But the moment the hydrothermal fluid cools below that threshold, the lattice quietly shifts from cubic to monoclinic while the crystal's outward form stays frozen. The Comstock Lode's fabulous silver bonanzas were born as argentite at depth, then rose through the transition temperature wearing the same geometry but living a different crystallographic life. It's the mineral equivalent of a caterpillar becoming a butterfly while somehow keeping the caterpillar's shape.

### Simulator Implementation Notes
- **New parameters needed:** None beyond trace_Ag (shared with acanthite)
- **New events needed:** Phase transition event at 173°C
- **Nucleation rule pseudocode:**
```
IF temp > 173°C AND trace_Ag > threshold AND S²⁻ available AND Eh = reducing → nucleate argentite (cubic)
```
- **Growth rule pseudocode:**
```
IF temp > 173°C AND argentite exists → grow at moderate rate
IF temp drops below 173°C AND argentite exists → convert to acanthite (keep crystal shape, change display properties)
```
- **Habit selection logic:** Cubic/octahedral/dodecahedral based on growth rate ratios
- **Decomposition products:** Below 173°C → acanthite. Oxidation → Ag⁺ in solution

### Variants for Game
- **Variant 1:** Cubic argentite — sharp cubes, classic high-T form
- **Variant 2:** Octahedral argentite — rarer habit, higher growth rate on {111}
- **Variant 3:** Arborescent argentite — dendritic/wire-like aggregates in vein settings

### Important Note for Implementation
Argentite and acanthite are the SAME COMPOUND (Ag₂S) at different temperatures. In the simulator, they should share nucleation logic with a temperature-dependent polymorph switch. Argentite should display with cubic crystal visuals; when the system cools below 173°C, the visual should remain (pseudomorph) but the mineral ID should update to acanthite. This is a unique mechanic — a mineral that transforms in-place.
