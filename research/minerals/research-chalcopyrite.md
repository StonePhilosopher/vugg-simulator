# Mineral Species Research — Chalcopyrite

## Species: Chalcopyrite

### Identity
- **Formula:** CuFeS₂
- **Crystal system:** Tetragonal (scalenohedral, 42m)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 4.1–4.3
- **Cleavage:** Indistinct on {011}
- **Fracture:** Irregular to uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Brass yellow, may have iridescent purplish tarnish
- **Color causes:** Inherent metallic brass-yellow from Cu-Fe-S bonding. Tarnish (purple, blue, green) from surface oxidation forming thin oxide/hydroxide/sulfate films
- **Transparency:** Opaque
- **Streak:** Greenish black (diagnostic)
- **Notable visual features:** Often confused with pyrite (harder) and gold (malleable, yellow streak). Greenish-black streak is the key distinguisher

### Crystal Habits
- **Primary habit:** Disphenoid (resembles tetrahedron)
- **Common forms/faces:** Tetrahedral disphenoids, sphenoidal faces
- **Twin laws:** Penetration twins (common)
- **Varieties:** No formal named varieties; sometimes called "yellow copper" historically
- **Special morphologies:** Massive (most common), botryoidal, granular disseminations

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 200–600°C (hydrothermal to magmatic)
- **Optimal growth temperature:** 300–500°C (porphyry copper window)
- **Decomposition temperature:** ~557°C (inverts to high-T polymorph; melts at ~880°C)
- **Temperature-dependent habits:** Higher temps favor well-formed disphenoid crystals; lower temps produce massive/granular habit

#### Chemistry Required
- **Required elements in broth:** Cu (≥100 ppm), Fe (≥100 ppm), S (≥200 ppm)
- **Optional/enhancing elements:** Ag, Au, Cd, Co, Ni, Zn (trace substitution for Cu/Fe); Se, Bi, Te, As (substitute for S)
- **Inhibiting elements:** High oxygen (oxidizing conditions convert to oxides/carbonates)
- **Required pH range:** Near-neutral to slightly acidic (4–7)
- **Required Eh range:** Reducing (sulfide-stable), Eh < 0 V
- **Required O₂ range:** Very low — sulfide stability requires anoxic/reducing conditions

#### Secondary Chemistry Release
- **When forming:** Consumes Cu²⁺, Fe²⁺, S²⁻ from fluid
- **Byproducts of dissolution/oxidation:** Releases Cu²⁺ + Fe²⁺ + SO₄²⁻ → feeds malachite, azurite, cuprite, iron oxides in oxidation zone

#### Growth Characteristics
- **Relative growth rate:** Moderate (faster than pyrite, slower than galena)
- **Maximum crystal size:** Crystals to ~15 cm; typically mm to cm in vugs
- **Typical crystal size in vugs:** 1–20 mm disphenoids
- **Growth rate vs temperature:** Faster at higher temperatures in hydrothermal systems
- **Competes with:** Pyrite (competes for Fe + S), bornite (competes for Cu + Fe + S), sphalerite (same structure, competes for S)

#### Stability
- **Breaks down in heat?** ~557°C polymorphic inversion; melts ~880°C
- **Breaks down in light?** No
- **Dissolves in water?** No (insoluble)
- **Dissolves in acid?** Soluble in HNO₃ (nitric acid)
- **Oxidizes?** Yes — surface tarnish rapidly. Full oxidation → malachite, azurite, cuprite, limonite, sulfuric acid
- **Dehydrates?** No
- **Radiation sensitivity:** No significant effect

### Paragenesis
- **Forms AFTER:** Early pyrite, magnetite (in porphyry systems)
- **Forms BEFORE:** Bornite (at lower T), chalcocite + covellite (supergene), malachite + azurite + cuprite (oxidation)
- **Commonly associated minerals:** Pyrite, bornite, sphalerite, galena, quartz, calcite, molybdenite
- **Zone:** Primary/hypogene (main). Also VMS deposits, sedimentary exhalative, komatiitic Ni-Cu
- **Geological environment:** Porphyry copper deposits, VMS, hydrothermal veins, skarns, mafic ignous disseminations

### Famous Localities
- **Classic locality 1:** Butte, Montana, USA — massive copper deposit, supergene enrichment
- **Classic locality 2:** Chuquicamata, Chile — world's largest copper mine
- **Classic locality 3:** Cornwall, England — historic hydrothermal veins
- **Notable specimens:** Well-formed disphenoid crystals from Bristol, Connecticut; large crystals from Dalnegorsk, Russia

### Fluorescence
- **Fluorescent under UV?** No
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> The workhorse of the copper world — chalcopyrite accounts for 70% of all copper ever mined. Its brass-yellow disphenoids fooled prospectors into thinking they'd found gold, but the greenish-black streak always told the truth. Deep underground, where oxygen never reaches, it crystallizes in patient tetrahedra — each one a locked vault of copper and iron waiting for water and air to set them free.

### Simulator Implementation Notes
- **New parameters needed:** None (Cu, Fe, S already tracked)
- **New events needed:** Chalcopyrite supersaturation function
- **Nucleation rule pseudocode:**
```
IF T in [200, 600] AND trace_Cu > 100 AND trace_Fe > 100 AND trace_S > 200
AND Eh < 0 (reducing conditions)
AND vug has room
→ nucleate chalcopyrite (max 3 crystals)
```
- **Growth rule pseudocode:**
```
IF T in [300, 500] AND σ_chalcopyrite > 1
→ grow at rate 6 (moderate)
ELSE IF σ > 0
→ grow at rate 3
```
- **Habit selection logic:** T > 400°C → disphenoid; T < 300°C → massive/granular
- **Decomposition products:** Oxidation → releases Cu²⁺ (→ cuprite/malachite/azurite) + Fe²⁺ (→ hematite/limonite) + SO₄²⁻

### Variants for Game
- **Variant 1:** Standard disphenoid — well-formed tetrahedral crystal, brass yellow
- **Variant 2:** Massive chalcopyrite — granular aggregate, no crystal faces, porphyry style
- **Variant 3:** Tarnished — iridescent purple/blue/gold surface film (forms near oxidation boundary)

---

## Linked Sequence: Copper Sulfide Paragenesis
This mineral is part of a paragenetic sequence. See also:
- **Bornite** (Cu₅FeS₄) → `memory/research-bornite.md`
- **Chalcocite** (Cu₂S) → `memory/research-chalcocite.md`
- **Covellite** (CuS) → `memory/research-covellite.md`

Sequence: Chalcopyrite (primary, 300–500°C) → Bornite (primary/transitional) → Chalcocite + Covellite (supergene enrichment, <100°C) → Cuprite + Malachite + Azurite (oxidation zone, near-surface)
