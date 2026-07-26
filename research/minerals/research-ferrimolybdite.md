# Research: Ferrimolybdite — Fe₂(MoO₄)₃·8H₂O

## Species: Ferrimolybdite

### Identity
- **Formula:** Fe³⁺₂(MoO₄)₃·nH₂O (n ≈ 8, variable)
- **Crystal system:** Orthorhombic
- **Mineral group:** Hydrous molybdate
- **Hardness (Mohs):** 1–2 (very soft)
- **Specific gravity:** 2.99 (light — hydrated, no Pb)
- **Cleavage:** Distinct on {001}
- **Fracture:** Uneven
- **Luster:** Adamantine, silky, earthy — varies by habit

### Color & Appearance
- **Typical color:** Canary-yellow, straw-yellow, greenish yellow
- **Color causes:** Fe³⁺-MoO₄ charge transfer; the canary yellow is diagnostic
- **Transparency:** Transparent to translucent (individual needles)
- **Streak:** Light yellow
- **Notable visual features:** Forms radiating acicular tufts and powdery crusts — looks like yellow fuzz growing on molybdenite. The silky luster of fibrous aggregates is distinctive.

### Crystal Habits
- **Primary habit:** Acicular (needle-like) in tufted to radial aggregates
- **Common forms/faces:** Too fine to see individual crystals typically
- **Twin laws:** Not notable
- **Varieties:** None formally recognized
- **Special morphologies:** Powdery earthy coatings, radiating sprays, velvet-like crusts on molybdenite surfaces

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <60°C (supergene/weathering zone, near-surface)
- **Optimal growth temperature:** 15–40°C
- **Decomposition temperature:** Loses water ~100–200°C; decomposes to iron oxides + MoO₃ at higher T
- **Temperature-dependent habits:** None significant

#### Chemistry Required
- **Required elements in broth:** Fe³⁺ (from pyrite or other Fe-sulfide oxidation), MoO₄²⁻ (from molybdenite oxidation), water (hydrated mineral)
- **Optional/enhancing elements:** None significant
- **Inhibiting elements:** Pb²⁺ (if Pb present, wulfenite forms instead — ferrimolybdite is the "Pb-absent" pathway)
- **Required pH range:** Acidic to near-neutral (2–6) — forms in acidic oxidation environments where iron is soluble as Fe³⁺
- **Required Eh range:** Strongly oxidizing (Fe must be Fe³⁺, Mo must be Mo⁶⁺)
- **Required O₂ range:** High

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Fe³⁺ and MoO₄²⁻, locks them into stable mineral
- **Byproducts of dissolution:** Releases MoO₄²⁻ and Fe³⁺ back into solution if conditions change

#### Growth Characteristics
- **Relative growth rate:** Fast (forms quickly once conditions are met — common as recent weathering product)
- **Maximum crystal size:** Individual needles <1 mm; aggregates up to several cm
- **Typical crystal size in vugs:** Crusts and tufts 1–20 mm across
- **Does growth rate change with temperature?** Faster in warmer conditions (weathering rate)
- **Competes with:** Wulfenite (if Pb present, wulfenite wins). Also competes with iron oxides/hydroxides (goethite, limonite) for Fe.

#### Stability
- **Breaks down in heat?** Loses water ~100–200°C; irreversible dehydration
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble
- **Dissolves in acid?** Soluble in strong acids
- **Oxidizes?** Already fully oxidized
- **Dehydrates?** YES — will dehydrate to anhydrous iron molybdate or amorphous material over time
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Molybdenite (must oxidize first), pyrite or other Fe-sulfides (must oxidize to provide Fe³⁺)
- **Forms BEFORE:** May dehydrate or be replaced by iron oxides with continued weathering
- **Commonly associated minerals:** Molybdenite (grows directly on it), limonite/goethite, jarosite, wulfenite (in Pb-bearing systems), various supergene minerals
- **Zone:** Supergene/weathering zone — immediate oxidation zone, often directly coating primary molybdenite
- **Geological environment:** Oxidized outcrops of Mo-bearing deposits, mine tailings, weathered porphyry systems

### Famous Localities
- **Alekseevskii Mine, Kazakhstan** — type locality (1914)
- **Kingman District, Mohave County, Arizona** — well-crystallized specimens
- **Climax, Colorado** — common as yellow crusts on molybdenite
- **Various porphyry Cu-Mo deposits** — widespread but rarely collected; considered a "dirty" mineral by collectors who prize wulfenite instead

### Fluorescence
- **Fluorescent under UV?** Not typically reported
- **Activator:** N/A

### Flavor Text

> Ferrimolybdite is molybdenite's yellow warning sign — the canary-colored crust that tells you oxygen has arrived and the primary sulfides are dying. Where wulfenite is the glamorous result of Pb and Mo meeting in the oxidation zone, ferrimolybdite is what happens when there's no lead around: iron steps in instead, and you get fuzzy yellow needles instead of amber windows. It's the commoner's molybdate — less collected, less photographed, but geologically more common. Every yellow fuzz on a weathered molybdenite surface is a miniature ecosystem of element exchange.

### Simulator Implementation Notes
- **New parameters needed:** None (trace_Mo, trace_Fe already exist; MoO₄²⁻ via oxidation)
- **Nucleation rule pseudocode:**
```
IF temp < 60 AND Fe3_available AND MoO4_available AND Pb_absent AND Eh > oxidizing → nucleate ferrimolybdite
No hard limit on nuclei — forms as crusts/coatings
```
- **Growth rule pseudocode:**
```
IF Fe3_available AND MoO4_available AND temp < 60 AND Pb_absent → grow at rate 4 (fast, opportunistic)
```
- **Habit selection logic:** Always acicular/radiating — no significant habit variation
- **Decomposition products:** Dehydration to amorphous Fe-Mo oxide at >100°C. Dissolution releases MoO₄²⁻ back to fluid.

### Variants for Game
- **Variant 1: Crust coating** — powdery earthy coating on molybdenite surfaces. Most common.
- **Variant 2: Acicular tuft** — radiating sprays of yellow needles, more aesthetic. Requires sustained slow growth.

---

## Paragenetic Note
Ferrimolybdite is the "no-lead" branch of the molybdenum oxidation pathway. It's simpler to form than wulfenite (only needs Mo + Fe, no Pb required) and appears earlier in the oxidation sequence. In Pb-bearing systems, wulfenite dominates; in Pb-poor systems, ferrimolybdite takes all the Mo. This creates a clear either/or in the simulator.
