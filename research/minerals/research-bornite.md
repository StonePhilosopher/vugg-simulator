# Mineral Species Research — Bornite

## Species: Bornite

### Identity
- **Formula:** Cu₅FeS₄
- **Crystal system:** Orthorhombic (pseudo-cubic; isometric above 228°C)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 3–3.25
- **Specific gravity:** 5.06–5.08
- **Cleavage:** Poor on {111}
- **Fracture:** Uneven to subconchoidal
- **Luster:** Metallic (fresh); iridescent tarnish

### Color & Appearance
- **Typical color:** Copper-red to bronze-brown on fresh surfaces; tarnishes to spectacular iridescent blue, purple, green, gold
- **Color causes:** Fresh = inherent Cu-Fe-S metallic color. Iridescence = thin-film interference from surface oxidation layers of varying thickness
- **Transparency:** Opaque
- **Streak:** Grayish black
- **Notable visual features:** The "peacock ore" — most iridescent of common sulfides. Fresh surfaces look like copper metal, but exposure rapidly creates the rainbow tarnish that makes it iconic

### Crystal Habits
- **Primary habit:** Massive, granular, disseminated
- **Common forms/faces:** Rare crystals are pseudo-cubic, dodecahedral, or octahedral
- **Twin laws:** Penetration twins on {111}
- **Varieties:** "Peacock ore" (tarnished bornite, sometimes also applied to tarnished chalcopyrite)
- **Special morphologies:** Hackly fracture surfaces show fresh copper-red; exsolution blebs/lamellae of chalcopyrite, digenite, chalcocite common within bornite grains

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 200–500°C (hypogene); also forms at low T in supergene zone
- **Optimal growth temperature:** 250–400°C
- **Decomposition temperature:** 228°C — order-disorder transition (isometric ↔ orthorhombic). Above 228°C, Cu and Fe randomly occupy tetrahedral sites; below, they order, reducing symmetry
- **Temperature-dependent habits:** Above 228°C: pseudo-cubic crystals. Below: orthorhombic, usually massive

#### Chemistry Required
- **Required elements in broth:** Cu (high, ≥200 ppm), Fe (moderate), S (≥200 ppm)
- **Optional/enhancing elements:** Ag (substitutes for Cu), solid solution toward chalcopyrite and digenite
- **Inhibiting elements:** High oxygen — oxidizes rapidly
- **Required pH range:** Near-neutral to slightly acidic (4–7)
- **Required Eh range:** Reducing (sulfide stability)
- **Required O₂ range:** Very low

#### Secondary Chemistry Release
- **When forming:** Consumes Cu + Fe + S at higher Cu:Fe ratio than chalcopyrite
- **Byproducts of dissolution/oxidation:** Releases Cu²⁺ + Fe²⁺ + SO₄²⁻. In supergene zone, releases Cu to form chalcocite enrichment

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Rare crystals to ~5 cm; usually massive
- **Typical crystal size in vugs:** Rarely crystallizes in vugs — usually 1–5 mm disseminations or massive aggregates
- **Growth rate vs temperature:** Moderate across range
- **Competes with:** Chalcopyrite (same elements, different Cu:Fe ratio), chalcocite (in supergene zone)

#### Stability
- **Breaks down in heat?** 228°C order-disorder transition. Melts at ~950°C
- **Breaks down in light?** No
- **Dissolves in water?** No
- **Dissolves in acid?** Soluble in HNO₃
- **Oxidizes?** YES — famously. Surface tarnish within hours to days. Full oxidation → Cu oxides, carbonates, sulfates
- **Dehydrates?** No
- **Radiation sensitivity:** No

### Paragenesis
- **Forms AFTER:** Early pyrite, chalcopyrite (bornite can be slightly later in hypogene sequence)
- **Forms BEFORE:** Chalcocite, covellite (supergene enrichment replaces bornite)
- **Commonly associated minerals:** Chalcopyrite, chalcocite, covellite, digenite, pyrite, quartz
- **Zone:** Hypogene (primary porphyry Cu, skarns) AND supergene enrichment (just below water table)
- **Geological environment:** Porphyry copper, skarns, pegmatites, mafic igneous rocks, sedimentary cupriferous shales, VMS

### Famous Localities
- **Classic locality 1:** Butte, Montana — enormous bornite masses in supergene enrichment
- **Classic locality 2:** Bristol, Connecticut — rare well-formed crystals
- **Classic locality 3:** Frossnitz Alps, Austria — large crystal groups
- **Notable specimens:** Cornwall, England (Carn Brea mine); Zacatecas, Mexico (with silver)

### Fluorescence
- **Fluorescent under UV?** No
- **Phosphorescent?** No
- **Activator:** N/A

### Flavor Text

> Bornite is the mineral that shows off. Fresh from the rock it's a humble bronze — but give it air and it transforms, cycling through every color in a peacock's tail as oxide layers of different thicknesses stack on its surface. Thin-film interference, the same physics behind soap bubbles, turns a copper ore into a rainbow. Those colors aren't bornite anymore — they're its ghost, the mineral performing its own oxidation in real time.

### Simulator Implementation Notes
- **New parameters needed:** Cu:Fe ratio in broth (bornite needs higher Cu:Fe than chalcopyrite — 5:1 vs 1:1)
- **New events needed:** Bornite supersaturation; order-disorder transition at 228°C
- **Nucleation rule pseudocode:**
```
IF T in [200, 500] AND trace_Cu > 200 AND trace_Fe > 50 AND trace_S > 200
AND Cu:Fe_ratio > 3:1
AND Eh < 0
AND vug has room
→ nucleate bornite (max 2 crystals)
```
- **Growth rule pseudocode:**
```
IF T in [250, 400] AND σ_bornite > 1
→ grow at rate 5
IF T > 228 → pseudo-cubic habit
IF T < 228 → orthorhombic/massive habit
```
- **Habit selection logic:** T > 228°C → pseudo-cubic/dodecahedral; T < 228°C → massive/granular. Crystals rare regardless.
- **Decomposition products:** Oxidation → Cu²⁺ + Fe²⁺ + SO₄²⁻ (feeds chalcocite in supergene, or cuprite/malachite/azurite in oxidation zone)

### Variants for Game
- **Variant 1:** Fresh bornite — copper-red/bronze, metallic, no tarnish yet
- **Variant 2:** Peacock ore — iridescent blue/purple/green/gold surface (formed near oxidation boundary)
- **Variant 3:** Exsolution bornite — contains lamellae of chalcopyrite or chalcocite within (cooling product)

---

## Linked Sequence: Copper Sulfide Paragenesis
- **Chalcopyrite** (CuFeS₂) → `memory/research-chalcopyrite.md`
- **Bornite** (Cu₅FeS₄) → this file
- **Chalcocite** (Cu₂S) → `memory/research-chalcocite.md`
- **Covellite** (CuS) → `memory/research-covellite.md`
