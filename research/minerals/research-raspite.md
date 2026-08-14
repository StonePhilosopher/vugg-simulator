# Species: Raspite

### Identity
- **Formula:** PbWO₄
- **Crystal system:** Monoclinic
- **Mineral group:** Tungstate (oxide classification per IMA — Strunz 4.DG.20)
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 8.46
- **Cleavage:** Perfect on {100}
- **Fracture:** Not well documented (brittle)
- **Luster:** Adamantine

### Color & Appearance
- **Typical color:** Light yellow, yellowish brown, gray-yellow
- **Color causes:** Lead-tungstate charge transfer; generally paler than stolzite
- **Transparency:** Translucent
- **Streak:** Yellow-white
- **Notable visual features:** Very high refractive indices (α=2.27, β=2.27, γ=2.30) — adamantine luster. Biaxial (+). The {100} cleavage distinguishes it from stolzite (which lacks good cleavage).

### Crystal Habits
- **Primary habit:** Tabular to elongate, often striated
- **Common forms/faces:** {100}, {010}, {001}, {011}, {101}, {110}, {122} — tabular on {100} is dominant
- **Twin laws:** Not commonly twinned
- **Varieties:** No named varieties — raspite is itself the rare dimorph
- **Special morphologies:** Elongated tabular crystals, often small (<1 cm). Striations parallel to elongation.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Low temperature — supergene oxidation zone (<80°C, likely <50°C)
- **Optimal growth temperature:** Ambient to ~50°C
- **Decomposition temperature:** Transforms irreversibly to stolzite at 395(5)°C
- **Temperature-dependent habits:** Raspite is the LOW-temperature dimorph. It only forms at conditions well below the 395°C inversion. In nature, both raspite and stolzite form in the same supergene zone, suggesting kinetic factors (not just temperature) control which polymorph nucleates.

#### Chemistry Required
- **Required elements in broth:** Pb²⁺, W (as tungstate WO₄²⁻) — identical to stolzite
- **Optional/enhancing elements:** None specifically favoring raspite over stolzite
- **Inhibiting elements:** Same as stolzite — S²⁻ (reducing conditions prevent formation)
- **Required pH range:** Neutral to slightly acidic
- **Required Eh range:** Oxidizing (supergene zone)
- **Required O₂ range:** High

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No — same as stolzite
- **Byproducts of nucleation:** None
- **Byproducts of dissolution:** Dissolves in HCl, releasing Pb²⁺ and WO₄²⁻

#### Growth Characteristics
- **Relative growth rate:** Very slow — much rarer than stolzite
- **Maximum crystal size:** Typically <1 cm; rarely exceeds 2 cm
- **Typical crystal size in vugs:** 1–5 mm
- **Does growth rate change with temperature?** Limited data; formation at ambient temperatures
- **Competes with:** Stolzite (direct dimorph competitor for same chemistry), wulfenite, cerussite, anglesite

#### Stability
- **Breaks down in heat?** YES — irreversible transformation to stolzite at 395°C
- **Breaks down in light?** No known photodegradation
- **Dissolves in water?** Very low solubility (same as stolzite)
- **Dissolves in acid?** Decomposes in HCl
- **Oxidizes?** Already fully oxidized
- **Radiation sensitivity:** No data; likely similar radiation hardness to stolzite (PbWO₄)

### Paragenesis
- **Forms AFTER:** Primary sulfide + tungsten mineralization must be oxidizing (same as stolzite)
- **Forms BEFORE:** May be overgrown by or replaced by stolzite, cerussite, or anglesite
- **Commonly associated minerals:** Stolzite (dimorph — both can occur together), wulfenite, cerussite, anglesite, pyromorphite, mimetite, galena (relict), hubnerite/ferberite (relict primary W minerals)
- **Zone:** Supergene/oxidation zone — the rarest expression of the Pb-W oxidation assemblage
- **Geological environment:** Oxidized zones of tungsten-bearing hydrothermal base metal deposits

### Famous Localities
- **Broken Hill, New South Wales, Australia** — Type locality (1897). Named for Charles Rasp, the prospector who discovered the Broken Hill deposit. The most famous raspite specimens.
- **Cordillera Mine, New South Wales, Australia** — Renowned for stolzite-raspite associations
- **Clara Mine, Black Forest, Germany** — Raspite as a mineralogical curiosity alongside stolzite

Note: Raspite is genuinely rare. Broken Hill is THE locality. Few other sites produce identifiable specimens.

### Fluorescence
- **Fluorescent under UV?** Not reported as fluorescent
- **SW (255nm) color:** Not reported
- **MW (310nm) color:** Not reported
- **LW (365nm) color:** Not reported
- **Phosphorescent?** No
- **Activator:** None known
- **Quenched by:** N/A

### Flavor Text

> Same atoms as stolzite, same formula written on the page, but raspite chose a different path. Where stolzite builds tetragonal symmetry — clean, four-fold, orderly — raspite leans monoclinic, its lattice tilted like a building that settled into its foundations at an angle. Named for Charles Rasp, a German-born prospector who pegged the claim at Broken Hill and uncovered one of the richest ore bodies on Earth. He never got rich from it. The crystal that carries his name is the rarer dimorph, the one that only forms under conditions we still don't fully understand. Both use the same ingredients, both grow in the same oxidizing zone, but something — maybe a subtle difference in growth rate, maybe trace impurities, maybe just the roll of the dice at nucleation — tips the symmetry one way or the other. Heat raspite to 395°C and it converts to stolzite, irreversibly. The tilted building straightens up and never leans again.

### Simulator Implementation Notes
- **New parameters needed:** None beyond stolzite requirements
- **New events needed:** None specifically — raspite nucleation is a probabilistic branch of the same Pb+WO₄ event
- **Nucleation rule pseudocode:**
```
IF temp < 50 AND Eh > 0.3 AND Pb²⁺ > threshold AND WO₄²⁻ > threshold
  → nucleate stolzite with P=0.85, raspite with P=0.15
  (raspite favored at lower temperatures and slower growth rates)
```
- **Growth rule pseudocode:**
```
IF σ > 1 → grow at rate 1 (slower than stolzite)
  Habit: tabular elongate (monoclinic)
  Cleavage: perfect {100}
```
- **Habit selection logic:**
  - Default: elongated tabular on {100}
  - Striations parallel to elongation at higher σ
- **Decomposition products:** At T > 395°C → irreversible conversion to stolzite (not dissolution — a solid-state polymorphic transition)

### Variants for Game
- **Variant 1: Classic raspite** — Yellow-brown tabular elongate crystals, pure PbWO₄, monoclinic
- **Variant 2: Stolzite-raspite intergrowth** — Both dimorphs nucleating in the same vug, a mineralogical curiosity. The Cordillera Mine special.
- **Variant 3: Heated raspite** — If vug temperature exceeds 395°C (volcanic event?), raspite converts to stolzite permanently. A one-way door mechanic.

---

## Paragenetic Sequence Notes: Stolzite-Raspite Tungstate Pair

Both minerals are **supergene oxidation zone** products of tungsten-bearing hydrothermal lead deposits. The full sequence:

1. **Primary mineralization (hypogene):** Galena (PbS) + wolframite/hübnerite ((Fe,Mn)WO₄) or scheelite (CaWO₄) form at 200-500°C
2. **Oxidation begins:** Groundwater oxygen attacks primary sulfides. Galena → Pb²⁺ in solution. Wolframite/scheelite break down → WO₄²⁻ in solution.
3. **Supergene zone (<100°C, oxidizing):** Pb²⁺ + WO₄²⁻ → stolzite (common) or raspite (rare). If Mo is present, wulfenite forms instead (or as a solid solution with stolzite).
4. **Competing minerals:** Cerussite (PbCO₃) if CO₃²⁻ available, anglesite (PbSO₄) if SO₄²⁻ available, pyromorphite (Pb₅(PO₄)₃Cl) if phosphate and chloride present.
5. **Polymorphic control:** The 395°C raspite→stolzite transition is one-way. In the supergene zone (well below this), kinetic factors determine which dimorph nucleates. Stolzite is far more common — raspite is the exception that makes the rule interesting.

This pairs with the existing wulfenite research — same geochemical niche but Mo vs W in the tetrahedral site.
