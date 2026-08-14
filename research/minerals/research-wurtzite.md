# Wurtzite — Vugg Simulator Research

## Species: Wurtzite

### Identity
- **Formula:** (Zn,Fe)S
- **Crystal system:** Hexagonal
- **Mineral group:** Sulfide (wurtzite group)
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 4.09–4.10
- **Cleavage:** {1120} and {0001}, distinct
- **Fracture:** Uneven, irregular
- **Luster:** Resinous, brilliant submetallic on crystal faces

### Color & Appearance
- **Typical color:** Brownish black, orange brown, reddish brown, black
- **Color causes:** Iron substitution (up to 8% Fe), minor cadmium inclusions can produce yellow-orange tones
- **Transparency:** Translucent (in thin sections)
- **Streak:** Light brown
- **Notable visual features:** Resinous to submetallic luster shift between faces; often forms radial clusters that catch light differently from each blade

### Crystal Habits
- **Primary habit:** Radial clusters and colloform crusts/masses
- **Common forms/faces:** Tabular hexagonal crystals, prismatic {1010}, pyramidal {1011}
- **Twin laws:** Not commonly twinned (unlike sphalerite's spinel twins)
- **Varieties:** None formally named; Fe-rich material grades toward "marmatite" chemistry but in hexagonal structure
- **Special morphologies:** Fibrous, botryoidal crusts, colloform banding (alternating with sphalerite layers)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 100–300°C (hydrothermal); also forms at very low T in sedimentary concretions
- **Optimal growth temperature:** 150–250°C
- **Decomposition temperature:** ~1020°C (inverts to sphalerite; thermodynamically, sphalerite is the stable polymorph below ~1020°C at atmospheric pressure, but wurtzite persists metastably at low T)
- **Temperature-dependent habits:** Higher T favors more well-formed hexagonal prisms; low T produces colloform/botryoidal crusts

#### Chemistry Required
- **Required elements in broth:** Zn (high, >50 ppm), S (high, as S²⁻)
- **Optional/enhancing elements:** Fe (promotes wurtzite over sphalerite structure at lower T), Cd (can substitute for Zn)
- **Inhibiting elements:** High O₂ (oxidizes S²⁻); sphalerite is thermodynamically favored at most conditions — wurtzite needs kinetic factors or specific stacking fault conditions
- **Required pH range:** Near-neutral to mildly acidic (5–7)
- **Required Eh range:** Reducing (negative Eh, S²⁻ stable)
- **Required O₂ range:** Very low to absent

#### Secondary Chemistry Release
- **Byproducts of nucleation:** None significant
- **Byproducts of dissolution/decomposition:** Releases Zn²⁺ and S²⁻ (which oxidizes to SO₄²⁻ in presence of O₂)
- **Transformation:** Metastably converts to sphalerite over geological time; no chemical change, just structural rearrangement (ABAB → ABCABC stacking)

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast (similar to sphalerite)
- **Maximum crystal size:** Rarely >1 cm individual crystals; radial clusters to several cm
- **Typical crystal size in vugs:** 1–5 mm radial aggregates
- **Does growth rate change with temperature?** Faster at higher T; low-T growth is colloform/microcrystalline
- **Competes with:** Sphalerite (dominant competitor for same chemistry), pyrite, marcasite

#### Stability
- **Breaks down in heat?** Inverts to sphalerite above ~1020°C at 1 atm
- **Breaks down in light?** No
- **Dissolves in water?** Very slightly soluble
- **Dissolves in acid?** Yes — HCl dissolves with H₂S release
- **Oxidizes?** Yes — Zn²⁺ released, S²⁻ → SO₄²⁻, forming secondary Zn minerals (smithsonite, hemimorphite)
- **Dehydrates?** N/A (anhydrous)
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Initial sphalerite deposition (often as overgrowth or replacement rims on sphalerite)
- **Forms BEFORE:** Secondary Zn oxidation minerals (smithsonite, hemimorphite, aurichalcite)
- **Commonly associated minerals:** Sphalerite (always), pyrite, chalcopyrite, galena, barite, marcasite
- **Zone:** Primary/hypogene (low-T hydrothermal), also supergene in sedimentary concretions
- **Geological environment:** Low-temperature hydrothermal veins, clay-ironstone concretions, shrinkage fractures in sedimentary rocks

### Famous Localities
- **Classic locality 1:** San José Mine, Oruro, Bolivia (type locality, tin-silver veins)
- **Classic locality 2:** Příbram, Czech Republic (hydrothermal Pb-Zn-Ag veins)
- **Classic locality 3:** Liskeard, Cornwall, England
- **Notable specimens:** Llallagua, Bolivia produces the best-formed crystals; Mont Saint-Hilaire, Quebec yields hexagonal prisms in alkalic pegmatites

### Fluorescence
- **Fluorescent under UV?** Generally no (unlike some sphalerite which can fluoresce)
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text

> Wurtzite is sphalerite's shadow twin — the same chemistry, rearranged. Where sphalerite stacks its zinc and sulfur atoms in an ABCABC pattern, wurtzite prefers ABABAB, a subtle shift that produces hexagonal symmetry instead of cubic. It's the mineralogical equivalent of a left-handed version of a right-handed world. Thermodynamically, it shouldn't exist at low temperatures — sphalerite is always the more stable form. But kinetics don't care about thermodynamics. Wurtzite crystallizes in the rush of cooling hydrothermal fluids, in the squeeze of shrinking sedimentary concretions, anywhere the atoms don't have time to find their most stable arrangement. It's a snapshot of urgency preserved in stone. Given enough geological time, it will quietly rearrange itself into sphalerite. But "enough time" is the key phrase — some wurtzite has waited 400 million years and still hasn't bothered.

### Simulator Implementation Notes
- **New parameters needed:** None (uses existing Zn, S, Fe broth variables)
- **New events needed:** Stacking fault event — chance during rapid cooling that sphalerite nucleation produces wurtzite instead
- **Nucleation rule pseudocode:**
```
IF trace_Zn > 50 AND trace_S > 50 AND Eh < 0 (reducing)
AND temperature < 300 AND temperature > 80
AND (rapid_cooling_rate OR stacking_fault_chance > 0.1)
AND sphalerite saturation > 1.0
→ nucleate wurtzite with probability 0.2 * (cooling_rate / max_cooling_rate)
ELSE IF trace_Fe / trace_Zn > 0.05 → slight bonus to wurtzite over sphalerite
```
- **Growth rule pseudocode:**
```
IF reducing AND trace_Zn > 0 AND trace_S > 0
AND temperature 100-300°C
→ grow at rate 4 (slightly slower than sphalerite rate 5)
IF temperature > 300 → convert to sphalerite (thermodynamic correction)
```
- **Habit selection logic:**
```
IF temperature > 200 → tabular hexagonal prisms
IF temperature < 200 → radial/botryoidal clusters
IF very_low_T (<100) AND sedimentary → colloform crusts
```
- **Decomposition products:** Oxidizes → releases Zn²⁺ + S⁶⁺ (feeds smithsonite, hemimorphite formation)

### Variants for Game
- **Variant 1: Classic wurtzite** — Radial clusters, reddish-brown, resinous luster. Requires rapid cooling through 200-300°C window.
- **Variant 2: Iron-rich wurtzite** — Darker, nearly black, higher Fe content. Fe/Zn ratio > 0.05 shifts nucleation toward wurtzite over sphalerite.
- **Variant 3: Colloform wurtzite** — Botryoidal crusts alternating with sphalerite layers. Low-temperature sedimentary formation. Appears as banded crusts on vug walls.
