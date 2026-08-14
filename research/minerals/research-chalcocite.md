# Mineral Species Research — Chalcocite

## Species: Chalcocite

### Identity
- **Formula:** Cu₂S (copper(I) sulfide)
- **Crystal system:** Monoclinic (pseudo-orthorhombic; high-T hexagonal polymorph above ~103°C)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 5.5–5.8
- **Cleavage:** Indistinct on {110}
- **Fracture:** Conchoidal
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Dark gray to black
- **Color causes:** Inherent metallic lead-gray to black from Cu-S bonding
- **Transparency:** Opaque
- **Streak:** Shiny black to lead gray
- **Notable visual features:** Pseudohexagonal stellate twin groups (sixling star patterns). Frequently forms pseudomorphs after other minerals (bornite, covellite, chalcopyrite, pyrite, galena, sphalerite) — replaces the original crystal atom by atom while preserving its shape

### Crystal Habits
- **Primary habit:** Tabular to prismatic crystals; also massive to granular
- **Common forms/faces:** Pseudo-orthorhombic prismatic, tabular
- **Twin laws:** Common on {110}, yielding pseudohexagonal stellate forms (star-shaped sixlings)
- **Varieties:** No named varieties. Known historically as "redruthite," "vitreous copper," "copper-glance"
- **Special morphologies:** Pseudomorphs (replaces other minerals while keeping their crystal shape — ghost crystals). Stellate twin groups. Sectile (can be cut with a knife)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <150°C (supergene); can form up to ~400°C in hydrothermal veins (primary)
- **Optimal growth temperature:** 25–100°C (supergene enrichment zone)
- **Decomposition temperature:** ~103°C polymorphic transition (low djurleite ↔ high chalcocite)
- **Temperature-dependent habits:** Low T → tabular/prismatic; high T → massive

#### Chemistry Required
- **Required elements in broth:** Cu (very high, ≥300 ppm), S (≥100 ppm)
- **Optional/enhancing elements:** Fe (as impurity), Ag (common trace)
- **Inhibiting elements:** High oxygen — converts to oxides/carbonates
- **Required pH range:** Near-neutral to slightly acidic (5–7)
- **Required Eh range:** Mildly reducing to neutral (sulfide stability in supergene zone, just below water table)
- **Required O₂ range:** Low — but can tolerate slightly more O₂ than primary sulfides since it forms in the supergene enrichment zone (below the oxidation zone but above the primary zone)

#### Secondary Chemistry Release
- **When forming:** Consumes Cu²⁺ (leached from oxidation zone above) + H₂S/S²⁻ (from primary sulfides below). Key reaction: Cu²⁺ (descending) + CuFeS₂ (chalcopyrite, in place) → Cu₂S (chalcocite) + Fe²⁺ + S
- **Byproducts of dissolution/oxidation:** Releases Cu²⁺ (very high Cu content, 79.8% by weight) → feeds cuprite, malachite, azurite above

#### Growth Characteristics
- **Relative growth rate:** Fast (supergene enrichment is relatively rapid, geologically speaking)
- **Maximum crystal size:** Crystals to ~15 cm; typically cm-scale in vugs
- **Typical crystal size in vugs:** 5–30 mm prismatic/tabular crystals, stellate groups
- **Growth rate vs temperature:** Faster at higher temperatures but primarily a low-T mineral
- **Competes with:** Covellite (same zone, same elements, different Cu:S ratio)

#### Stability
- **Breaks down in heat?** ~103°C phase transition. Melts at ~1130°C
- **Breaks down in light?** No
- **Dissolves in water?** No
- **Dissolves in acid?** Soluble in HNO₃
- **Oxidizes?** Yes — converts to cuprite, tenorite, malachite, azurite in oxidation zone
- **Dehydrates?** No
- **Radiation sensitivity:** No

### Paragenesis
- **Forms AFTER:** Chalcopyrite, bornite (chalcocite replaces these in supergene enrichment)
- **Forms BEFORE:** Covellite (often intergrown), cuprite + malachite + azurite (if chalcocite itself oxidizes)
- **Commonly associated minerals:** Chalcopyrite, bornite, covellite, digenite, native copper, cuprite, malachite, azurite
- **Zone:** Primarily supergene enrichment (below water table, above primary sulfides). Rarely primary in hydrothermal veins
- **Geological environment:** Supergene enrichment blankets over porphyry copper deposits, VMS, sedimentary copper

### Famous Localities
- **Classic locality 1:** Cornwall, England (Redruth — hence "redruthite") — historic stellate crystal groups
- **Classic locality 2:** Butte, Montana — enormous supergene enrichment zone
- **Classic locality 3:** Chuquicamata, Chile — world-class supergene chalcocite blanket
- **Notable specimens:** Mount Isa, Queensland, Australia — well-formed prismatic crystals to several cm

### Fluorescence
- **Fluorescent under UV?** No
- **Phosphorescent?** No

### Flavor Text

> Chalcocite is a thief that wears its victim's face. In the supergene enrichment zone — that shadowy band between the oxygen-rich world above and the sulfide-dark depths below — copper leached from oxidizing ore descends and reacts with primary chalcopyrite, stealing its iron and sulfur to make something richer. Nearly 80% copper by weight, it's one of the richest ores that exists. And sometimes it performs a mineralogical heist: replacing another crystal atom by atom while keeping the original shape perfectly intact. A chalcopyrite-shaped ghost, now made of purer copper than the original ever was.

### Simulator Implementation Notes
- **New parameters needed:** Supergene enrichment flag (zone below oxidation, above primary); descending Cu²⁺ from leaching above
- **New events needed:** Supergene enrichment reaction (descending Cu²⁺ + primary CuFeS₂ → Cu₂S + Fe²⁺)
- **Nucleation rule pseudocode:**
```
IF T < 150 AND trace_Cu > 300 AND trace_S > 100
AND supergene_zone == true (below water table, above primary)
AND Eh is mildly reducing
→ nucleate chalcocite (max 3 crystals)
```
- **Growth rule pseudocode:**
```
IF T in [25, 100] AND σ_chalcocite > 1
→ grow at rate 7 (fast — supergene enrichment is geologically rapid)
```
- **Habit selection logic:** Common twin on {110} → stellate pseudohexagonal groups. Can pseudomorph after chalcopyrite (tetrahedral shape) or bornite (cubic shape)
- **Decomposition products:** Oxidation → Cu²⁺ + SO₄²⁻ (feeds cuprite, malachite, azurite)

### Variants for Game
- **Variant 1:** Prismatic/tabular — dark gray metallic crystals, fresh
- **Variant 2:** Stellate sixling — pseudohexagonal star twin group (most collector-valuable habit)
- **Variant 3:** Pseudomorph — preserves shape of replaced mineral (chalcopyrite tetrahedra, bornite cubes, pyrite cubes)

---

## Linked Sequence: Copper Sulfide Paragenesis
- **Chalcopyrite** (CuFeS₂) → `memory/research-chalcopyrite.md`
- **Bornite** (Cu₅FeS₄) → `memory/research-bornite.md`
- **Chalcocite** (Cu₂S) → this file
- **Covellite** (CuS) → `memory/research-covellite.md`
