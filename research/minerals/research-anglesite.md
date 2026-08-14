# Research: Anglesite (PbSO₄) — Lead Oxidation Zone Sequence, Mineral 2/3

## Species: Anglesite

### Identity
- **Formula:** PbSO₄
- **Crystal system:** Orthorhombic
- **Mineral group:** Sulfate (barite group — isomorphous with barite and celestine)
- **Hardness (Mohs):** 2.5–3.0
- **Specific gravity:** 6.3–6.4 (heavy, but lighter than galena)
- **Cleavage:** [001] good, [210] distinct (poorer than barite)
- **Fracture:** Conchoidal
- **Luster:** Adamantine on crystals, dull when massive

### Color & Appearance
- **Typical color:** Colorless, white, gray; commonly tinted yellow, orange, green, blue; rarely violet
- **Color causes:** Trace impurities — Fe (yellow/brown), Cu (blue/green); galena inclusions cause gray
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Brilliant adamantine luster (one of the most lustrous non-metallic minerals); high refractive indices (nα=1.878, nγ=1.895) give exceptional fire. Pseudomorphs after galena cubes preserve the original shape in a new mineral.

### Crystal Habits
- **Primary habit:** Prismatic orthorhombic crystals, tabular to equant
- **Common forms/faces:** Prismatic {110}, dome {011}, basal pinacoid {001}; nearly 200 distinct forms documented
- **Twin laws:** Rare
- **Varieties:** None formally named
- **Special morphologies:** Granular, banded, nodular, stalactitic; pseudomorphs after galena cubes (paramorphs preserving {100} galena shape)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <80°C (supergene/weathering zone, near-surface)
- **Optimal growth temperature:** 15–50°C (ambient to mildly warm)
- **Decomposition temperature:** ~1100°C (but irrelevant — never encounters this in nature)
- **Temperature-dependent habits:** Not significant — always low-T supergene

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ (from dissolving galena), SO₄²⁻ (from oxidation of S²⁻ in galena)
- **Optional/enhancing elements:** None significant
- **Inhibiting elements:** High CO₃²⁻ (promotes cerussite instead — anglesite is replaced by cerussite in carbonate environments)
- **Required pH range:** Slightly acidic to neutral (pH 4–7); anglesite dissolves in alkaline carbonate solutions
- **Required Eh range:** Oxidizing (Eh > +300 mV) — this is a supergene mineral
- **Required O₂ range:** High — requires oxygenated waters to form from galena

#### Secondary Chemistry Release
- **When forming:** PbS + 2O₂ → PbSO₄ (consumes O₂, no acid release if direct oxidation)
- **When dissolving to cerussite:** PbSO₄ + CO₃²⁻ → PbCO₃ + SO₄²⁻ (releases sulfate back to fluid)
- **Byproducts:** Sulfate ion released when replaced by cerussite

#### Growth Characteristics
- **Relative growth rate:** Moderate — limited by galena dissolution rate
- **Maximum crystal size:** Up to 15 cm (Monteponi, Sardinia)
- **Typical crystal size in vugs:** 1–5 cm; often encrusts galena as druses
- **Growth rate vs temperature:** Faster at warmer temperatures (kinetics), but always limited to near-surface conditions
- **Competes with:** Cerussite (in carbonate-rich environments, cerussite wins — anglesite is intermediate and often ephemeral)

#### Stability
- **Breaks down in heat?** Only at extreme temperatures
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble (Ksp ≈ 1.8 × 10⁻⁸ — more soluble than cerussite, which is why cerussite replaces it)
- **Dissolves in acid?** Moderately — dissolves in strong acids
- **Oxidizes?** No — already fully oxidized (sulfate is the highest oxidation state of S)
- **Radiation sensitivity:** None

### Paragenesis
- **Forms AFTER:** Galena (always — anglesite is a direct oxidation product)
- **Forms BEFORE:** Cerussite (anglesite → cerussite in carbonate environments); pyromorphite (if PO₄ present)
- **Commonly associated minerals:** Galena (always the parent), cerussite, pyromorphite, mimetite, limonite, cerargyrite (horn silver), smithsonite
- **Zone:** Supergene/oxidation zone — near-surface weathering of primary Pb deposits
- **Geological environment:** Oxidized portions of lead deposits, gossans, weathered hydrothermal veins

### Famous Localities
- **Classic locality 1:** Parys Mountain, Anglesey, Wales — type locality (discovered 1783 by William Withering)
- **Classic locality 2:** Monteponi, Sardinia — large transparent crystals, brilliant adamantine luster
- **Classic locality 3:** Touissit District, Morocco — gem-quality crystals
- **Notable specimens:** Monteponi produced crystals to 15 cm; Touissit produces gem-clear yellow and colorless crystals

### Fluorescence
- **Fluorescent under UV?** Generally no, rarely weak
- **SW (255nm) color:** —
- **LW (365nm) color:** Rarely weak yellow
- **Phosphorescent?** No
- **Activator:** None reliable
- **Quenched by:** N/A

### Flavor Text

> Anglesite is what happens when the earth breathes on galena. Oxygen and water seep into the sulfide, and the lead re-crystallizes as a sulfate — still heavy, still lead, but transformed from opaque metal into a mineral with adamantine fire. The best anglesite crystals from Monteponi look like cut diamonds, with refractive indices that shame most gemstones. But anglesite is a transitional state. In carbonate groundwaters it dissolves, releasing its sulfate and recrystallizing as cerussite. It is a letter written in passing — the intermediate oxidation product, the way-station between sulfide darkness and carbonate light. Pseudomorphs after galena cubes preserve the ghost of the original crystal in a new chemistry.

### Simulator Implementation Notes
- **New parameters needed:** None — uses existing trace_Pb and SO₄²⁻
- **New events needed:** Oxidation event converting galena → anglesite
- **Nucleation rule pseudocode:**
```
IF galena exists AND Eh > 300 AND O₂ > threshold AND T < 80
  AND CO₃²⁻ < threshold (otherwise cerussite wins)
  AND num_crystals("anglesite") < 3 → nucleate anglesite on galena surface
```
- **Growth rule pseudocode:**
```
IF trace_Pb > 0 AND SO₄²⁻ > 0 AND Eh > 300 AND CO₃²⁻ < threshold
  → grow at rate 3 (moderate, limited by galena dissolution kinetics)
  consume Pb from dissolving galena, consume SO₄
```
- **Habit selection logic:**
  - Grown directly on galena → pseudomorph (retains cube shape)
  - Free nucleation in vug → prismatic orthorhombic crystals
  - High supersaturation → granular/druse coating
- **Decomposition products:** Dissolves in carbonate-rich fluids → cerussite + SO₄²⁻. This is the cerussite formation pathway.

### Variants for Game
- **Variant 1: Pseudomorph after galena** — retains cubic shape of parent galena, but composition is PbSO₄. Visually: cube shape with adamantine luster instead of metallic.
- **Variant 2: Gem anglesite** — transparent, colorless to pale yellow, exceptional luster. Rare. Requires very clean conditions.
- **Variant 3: Banded anglesite** — concentric layers around dissolving galena core, alternating with cerussite bands

---

## Sequence Position
Anglesite is mineral 2/3 in the lead oxidation sequence: galena → **anglesite** → cerussite
- See `memory/research-galena.md` for primary sulfide
- See `memory/research-cerussite.md` for final carbonate product
