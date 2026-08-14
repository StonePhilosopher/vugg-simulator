# Mineral Species Research — Vugg Simulator

## Species: Native Arsenic

### Identity
- **Formula:** As (elemental arsenic; arsenolamprite is a Bi-rich variety)
- **Crystal system:** Trigonal (rhombohedral; space group R3m)
- **Mineral group:** Native element (metalloid)
- **Hardness (Mohs):** 3–4
- **Specific gravity:** 5.63–5.78
- **Cleavage:** Perfect on {0001} (basal)
- **Fracture:** Uneven
- **Luster:** Metallic (tarnishes to dull)

### Color & Appearance
- **Typical color:** Tin-white to steel-gray on fresh surfaces; darkens to bronze-gray or black with tarnish
- **Color causes:** Inherent metallic bonding; tarnish from surface oxidation to arsenolite (As₂O₃)
- **Transparency:** Opaque
- **Streak:** Grayish black
- **Notable visual features:** Fresh surfaces show bright metallic luster; rapidly tarnishes. Often has a garlic-like odor when struck or heated (arsine gas). Rare hexagonal platy or barrel-shaped crystals.

### Crystal Habits
- **Primary habit:** Massive, granular, reniform (kidney-shaped crusts)
- **Common forms/faces:** Rare crystals show rhombohedral {1011} and basal {0001} forms
- **Twin laws:** Rare
- **Varieties:** Arsenolamprite (Bi-rich variety, up to 12% Bi, orthorhombic — possibly distinct species)
- **Special morphologies:** Botryoidal crusts, concentric layers, stalactitic, concentrically banded masses

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 100–350°C (hydrothermal)
- **Optimal growth temperature:** 150–300°C
- **Decomposition temperature:** Sublimes at 615°C (at 1 atm); melts at 817°C (under pressure)
- **Temperature-dependent habits:** Massive at most temperatures; rare well-formed rhombohedral crystals at higher T (250–350°C)

#### Chemistry Required
- **Required elements in broth:** As (high concentration, >100 ppm)
- **Optional/enhancing elements:** Sb (forms solid solution As-Sb; up to ~3% Sb common), Bi (arsenolamprite variety)
- **Inhibiting elements:** S²⁻ (sulfide — HIGHEST PRIORITY inhibitor; sulfur captures As as realgar As₄S₄, orpiment As₂S₃, arsenopyrite FeAsS. Native As only forms when S is depleted); Fe (forms arsenopyrite)
- **Required pH range:** Near-neutral to slightly acidic (pH 4–7)
- **Required Eh range:** Reducing (Eh -200 to +50 mV) — native As requires strongly reducing conditions
- **Required O₂ range:** Very low — arsenic oxidizes readily to arsenolite

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Removes As from fluid, decreasing total dissolved arsenic
- **Byproducts of dissolution/decomposition:** Oxidizes to As₂O₃ (arsenolite — highly soluble, toxic); dissolves in oxidizing fluids as arsenite (AsO₃³⁻) or arsenate (AsO₄³⁻)

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Crystals rare, typically <5 cm; massive forms can be extensive
- **Typical crystal size in vugs:** 1–20 mm (crystals); massive crusts to several cm
- **Does growth rate change with temperature?** Moderate increase with temperature
- **Competes with:** Arsenopyrite (FeAsS — dominant sink for As when Fe and S present), realgar (As₄S₄), orpiment (As₂S₃), nickeline (NiAs), safflorite (CoAs₂), rammelsbergite (NiAs₂). Native As is the RESIDUAL phase — forms only when metals and sulfur are consumed.

#### Stability
- **Breaks down in heat?** Sublimes at 615°C without melting at 1 atm
- **Breaks down in light?** No significant photodegradation (unlike realgar/orpiment)
- **Dissolves in water?** Insoluble in water
- **Dissolves in acid?** Soluble in HNO₃ (forms arsenic acid); dissolves in hot concentrated H₂SO₄; insoluble in HCl
- **Oxidizes?** YES — rapidly in air. Surface tarnishes to arsenolite (As₂O₃) crust. In oxidizing fluids, converts to arsenates (scorodite, pharmacolite, etc.). This is a key supergene process.
- **Dehydrates?** N/A
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Arsenopyrite, realgar, orpiment, nickeline, cobaltite (all As-bearing sulfides/arsenides consume As first; native As is the overflow)
- **Forms BEFORE:** Arsenolite (As₂O₃), scorodite (FeAsO₄·2H₂O), pharmacolite, erythrite, annabergite (supergene arsenates)
- **Commonly associated minerals:** Arsenopyrite, nickeline, safflorite, rammelsbergite, native bismuth, silver, calcite, barite, galena, sphalerite
- **Zone:** Primary/hypogene (reducing hydrothermal veins); can persist into supergene zone if conditions remain reducing
- **Geological environment:** Hydrothermal veins (especially Co-Ni-Ag vein deposits), pegmatites (rare), metamorphic deposits

### Famous Localities
- **Classic locality 1:** Freiberg, Saxony, Germany — historic Co-Ni-Ag vein district, fine crusts and rare crystals
- **Classic locality 2:** Sainte-Marie-aux-Mines, Alsace, France — Co-Ni-Ag veins with native As
- **Classic locality 3:** Příbram, Czech Republic — hydrothermal vein deposit
- **Notable specimens:** Akatani Mine, Japan for reniform crusts; Vlado B. collection specimens from Harz Mountains

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Arsenic is the pariah of the periodic table that somehow keeps getting invited everywhere. It shows up in hydrothermal fluids by the thousands of ppm, eager to bond with anything — iron makes arsenopyrite, nickel makes nickeline, cobalt makes safflorite, sulfur makes realgar and orpiment. Native arsenic only crystallizes when the fluid has been picked clean of every other willing partner and there's still arsenic left, a lonely过剩. What emerges are tin-white metallic masses with perfect basal cleavage that split like dark mica, exfoliating into papery sheets. Leave them in air and they tarnish almost immediately, the surface blooming with a crust of arsenolite crystals — white, powdery, and dramatically more toxic than the metal beneath. The Michael vein in Germany revealed that native arsenic acts as a geological trap for uranium during later weathering, forming rare uranium-arsenate minerals where oxidation meets the reducing arsenic mass. A mineral that exists because nothing else wanted it, and then becomes a magnet for things that shouldn't be there.

### Simulator Implementation Notes
- **New parameters needed:** trace_As already tracked; need sulfide saturation check (S²⁻ must be low for native As to form)
- **New events needed:** None specifically — native As forms as a residual phase in standard hydrothermal scenarios
- **Nucleation rule pseudocode:**
```
IF trace_As > 100 AND trace_S (sulfide) < 10 AND trace_Fe < 50 AND Eh < +50 → nucleate native_arsenic
// Key: S must be depleted — arsenopyrite/realgar/orpiment form first
```
- **Growth rule pseudocode:**
```
IF trace_As > 50 AND Eh < +50 → grow at rate proportional to [As] remaining after sulfide/arsenide allocation
habit: if T > 250 AND growing slowly → rhombohedral crystal; else → massive/botryoidal crust
```
- **Habit selection logic:** Low supersaturation + high T → rhombohedral crystals. High supersaturation → botryoidal/reniform crusts. Typical = massive.
- **Decomposition products:** Oxidizes → As₂O₃ (arsenolite, if conditions dry) or AsO₄³⁻ (arsenate ions to fluid, if aqueous). Supergene arsenate cascade: AsO₄³⁻ + Fe → scorodite; + Pb → mimetite; + Cu → olivenite; + Co → erythrite; + Ni → annabergite.

### Variants for Game
- **Variant 1: Massive arsenic** — Botryoidal/reniform crusts with concentric banding. Most common form. Tin-white to bronze-gray tarnish.
- **Variant 2: Crystalline arsenic** — Rare rhombohedral barrel-shaped crystals. Higher T, slow growth. Metallic luster.
- **Variant 3: Arsenolamprite** — Bi-rich variety (up to 12% Bi). Possibly orthorhombic. Requires trace_Bi enrichment. Rare.
