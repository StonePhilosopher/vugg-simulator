# Mineral Species Research — Covellite

## Species: Covellite

### Identity
- **Formula:** CuS (copper monosulfide)
- **Crystal system:** Hexagonal (6/mmm)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 1.5–2
- **Specific gravity:** 4.6–4.8
- **Cleavage:** Perfect on {0001} (basal — micaceous, can be peeled into flexible sheets)
- **Fracture:** Sectile/flexible
- **Luster:** Submetallic, inclining to resinous or dull

### Color & Appearance
- **Typical color:** Indigo-blue to dark blue-black; commonly highly iridescent with brass-yellow to deep red flashes
- **Color causes:** Inherent indigo-blue from Cu-S electronic structure (metallic conductor with unusual Cu⁺/S⁻/S₂²⁻ bonding). Iridescence from thin surface alteration films
- **Transparency:** Opaque
- **Streak:** Lead gray
- **Notable visual features:** The only common mineral that is naturally deep indigo-blue. Micaceous — can be split into flexible sheets like mica. Iridescent flashes of gold, red, purple on crystal surfaces

### Crystal Habits
- **Primary habit:** Thin platy hexagonal crystals and rosettes; also massive to granular
- **Common forms/faces:** Hexagonal plates on {0001}, thin tabular
- **Twin laws:** Not commonly twinned
- **Varieties:** No named varieties
- **Special morphologies:** Rosette aggregates of thin plates. Pseudomorphic replacements of other sulfides (chalcopyrite, bornite, enargite, pyrite). Coatings on other sulfides. The perfect basal cleavage allows peeling into flexible metallic-blue sheets — unique among sulfides

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <100°C (supergene); up to ~200°C (rare hydrothermal)
- **Optimal growth temperature:** 25–80°C (supergene enrichment/oxidation boundary)
- **Decomposition temperature:** ~507°C (decomposes to chalcocite + sulfur vapor)
- **Temperature-dependent habits:** Always platy/tabular regardless of temperature

#### Chemistry Required
- **Required elements in broth:** Cu (moderate-high), S (high — CuS needs 1:1 ratio, higher S than chalcocite's 2:1 Cu:S)
- **Optional/enhancing elements:** Se (substitutes for S), Fe (impurity from replaced minerals)
- **Inhibiting elements:** Excess Cu (favors chalcocite instead)
- **Required pH range:** Slightly acidic to neutral (4–7)
- **Required Eh range:** Mildly oxidizing to mildly reducing — covellite forms at the boundary between oxidation and reduction zones (a transition mineral)
- **Required O₂ range:** Low to moderate — can tolerate more oxygen than primary sulfides but less than true oxidation-zone minerals

#### Secondary Chemistry Release
- **When forming:** Key reaction in supergene: Cu²⁺ (from oxidation) + CuFeS₂ → CuS + Fe²⁺ + S. Also forms from partial oxidation of chalcocite: Cu₂S + S → 2CuS (adding sulfur)
- **Byproducts of dissolution/oxidation:** Releases Cu²⁺ + SO₄²⁻ (feeds cuprite, malachite, azurite, brochantite above)

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Crystals to ~10 cm plates (rare); typically mm-scale
- **Typical crystal size in vugs:** 1–10 mm hexagonal plates, rosette aggregates
- **Growth rate vs temperature:** Relatively constant across low-T range
- **Competes with:** Chalcocite (same zone, different Cu:S ratio — more sulfur favors covellite)

#### Stability
- **Breaks down in heat?** ~507°C → decomposes to Cu₂S + S (lose sulfur, gain chalcocite). This is important — covellite is a sulfur-rich sulfide that breaks down at moderate temperatures
- **Breaks down in light?** No
- **Dissolves in water?** No
- **Dissolves in acid?** Soluble in HNO₃
- **Oxidizes?** Yes — converts to cuprite, malachite, azurite, brochantite in full oxidation zone
- **Dehydrates?** No
- **Radiation sensitivity:** No

### Paragenesis
- **Forms AFTER:** Chalcopyrite, bornite (covellite replaces these); also forms from chalcocite + sulfur
- **Forms BEFORE:** Cuprite, malachite, azurite (covellite oxidizes to these); brochantite, antlerite (Cu sulfates)
- **Commonly associated minerals:** Chalcocite, chalcopyrite, bornite, digenite, pyrite, enargite, native sulfur
- **Zone:** Supergene — at the boundary between enrichment zone and oxidation zone. The "transition zone" mineral
- **Geological environment:** Supergene zones of copper sulfide deposits worldwide. Also found at fumaroles (Mt. Vesuvius — type locality)

### Famous Localities
- **Classic locality 1:** Mount Vesuvius, Italy — type locality, fumarolic covellite
- **Classic locality 2:** Butte, Montana — abundant in supergene zone
- **Classic locality 3:** Leonard Mine, Butte — classic covellite specimens with chalcocite
- **Notable specimens:** Sardinia, Italy; Serbia (Bor); Chile (Chuquicamata)

### Fluorescence
- **Fluorescent under UV?** No
- **Phosphorescent?** No

### Flavor Text

> Covellite is the blue heart of the copper deposit — the only common mineral that's naturally indigo. Where chalcocite hoards copper and covellite shares it with sulfur in equal measure, the result is a mineral so soft you can peel it into flexible sheets like dark blue mica. It forms at the knife-edge boundary where descending copper-rich waters meet sulfur-rich primary ore — not quite oxidized, not quite reduced. A transitional species, born in the tension between two chemical worlds, wearing a color that belongs to neither.

### Simulator Implementation Notes
- **New parameters needed:** Sulfur excess (covellite needs higher S relative to Cu than chalcocite)
- **New events needed:** Covellite nucleation from chalcocite + sulfur; covellite as partial replacement of chalcopyrite/bornite
- **Nucleation rule pseudocode:**
```
IF T < 100 AND trace_Cu > 100 AND trace_S > 200
AND S:Cu_ratio > 0.8 (sulfur-rich relative to chalcocite)
AND supergene_zone == true
AND Eh is mildly oxidizing to mildly reducing (transition zone)
→ nucleate covellite (max 2 crystals)
```
- **Growth rule pseudocode:**
```
IF T in [25, 80] AND σ_covellite > 1
→ grow at rate 5 (moderate)
→ habit: thin hexagonal plate / rosette
```
- **Habit selection logic:** Always platy hexagonal. Can form rosette aggregates. Often coats other sulfides
- **Decomposition products:** Heat > 507°C → Cu₂S (chalcocite) + S. Oxidation → Cu²⁺ + SO₄²⁻ → cuprite, malachite, azurite, brochantite

### Variants for Game
- **Variant 1:** Hexagonal plate — thin, dark indigo-blue, submetallic
- **Variant 2:** Rosette — aggregate of radiating thin plates, flower-like
- **Variant 3:** Iridescent coating — brass-yellow, red, purple flash on blue substrate (near oxidation boundary)
- **Variant 4:** Pseudomorph after chalcopyrite — tetrahedral shape preserved in indigo-blue covellite

---

## Linked Sequence: Copper Sulfide Paragenesis
- **Chalcopyrite** (CuFeS₂) → `memory/research-chalcopyrite.md`
- **Bornite** (Cu₅FeS₄) → `memory/research-bornite.md`
- **Chalcocite** (Cu₂S) → `memory/research-chalcocite.md`
- **Covellite** (CuS) → this file

### The Full Copper Paragenetic Sequence (already researched)
Primary zone → Supergene enrichment → Oxidation zone:
1. Chalcopyrite + Bornite (primary, 300–500°C, reducing)
2. Bornite (transitional, can be primary or supergene)
3. Chalcocite (supergene enrichment, <150°C, Cu-rich)
4. Covellite (supergene transition, <100°C, S-rich)
5. Cuprite + Native Copper (oxidation, near-surface) → `memory/research-cuprite.md`, `memory/research-native-copper.md`
6. Malachite + Azurite (oxidation + carbonation) → `memory/research-malachite.md`, `memory/research-azurite.md`
7. Brochantite + Antlerite (oxidation + sulfation, arid climates)
