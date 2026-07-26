# Mineral Species — Mottramite

## Species: Mottramite

### Identity
- **Formula:** PbCu(VO₄)(OH)
- **Crystal system:** Orthorhombic (dipyramidal, space group Pnma)
- **Mineral group:** Vanadate (adelite-descloizite group)
- **Hardness (Mohs):** 3–3.5
- **Specific gravity:** 5.9
- **Cleavage:** None
- **Fracture:** Irregular, sub-conchoidal
- **Luster:** Greasy

### Color & Appearance
- **Typical color:** Grass-green, olive-green, yellow-green, siskin-green; rarely blackish brown
- **Color causes:** Cu²⁺ chromophore (d-d transitions produce green); V⁵⁺ charge transfer contributes to dark tones
- **Transparency:** Transparent to opaque
- **Streak:** Yellowish green
- **Notable visual features:** Very high refractive indices (2.170–2.320), strong birefringence (0.150), visible pleochroism (canary yellow → brownish yellow)

### Crystal Habits
- **Primary habit:** Encrustations, plume-like aggregates, radial crystal clusters
- **Common forms/faces:** Rarely shows distinct crystal faces; typically massive to microcrystalline
- **Twin laws:** Not commonly twinned
- **Varieties:**
  - **Duhamelite** — Ca-Bi-bearing variety, acicular habit
  - **Cuprodescloizite** — historical name for Cu-rich intermediates (now recognized as mottramite series)
  - **Psittacinite** — discredited historical name (Genth, 1868)
- **Special morphologies:** Botryoidal crusts, fibrous radiating aggregates, plumose sprays, earthy masses

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Near-ambient to ~80°C (supergene/oxidation zone)
- **Optimal growth temperature:** 20–50°C
- **Decomposition temperature:** ~500–600°C (decomposes to PbO + CuO + V₂O₅)
- **Temperature-dependent habits:** Higher T favors slightly more distinct crystals; most occurrences are cryptocrystalline

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ (>100 ppm), Cu²⁺ (>50 ppm), V⁵⁺ as VO₄³⁻ (>10 ppm)
- **Optional/enhancing elements:** Zn²⁺ (forms descloizite series intermediate), Bi³⁺ (duhamelite variety), Ca²⁺ (duhamelite variety)
- **Inhibiting elements:** Fe²⁺ (reduces V⁵⁺ to V⁴⁺, destabilizing vanadate), high carbonate (promotes cerussite competition)
- **Required pH range:** 5–8
- **Required Eh range:** Oxidizing (V⁵⁺ required; Cu²⁺ stable)
- **Required O₂ range:** High — strictly oxidizing supergene conditions

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Minor H⁺ release
- **Byproducts of dissolution:** Releases Pb²⁺, Cu²⁺, VO₄³⁻ — all toxic; readily acid-soluble

#### Growth Characteristics
- **Relative growth rate:** Moderate — similar to descloizite
- **Maximum crystal size:** Rarely forms distinct crystals >1 cm; usually microcrystalline crusts
- **Typical crystal size in vugs:** <5 mm crystals; crusts can cover large areas
- **Does growth rate change with temperature?** Minimal temperature dependence; primarily controlled by fluid chemistry
- **Competes with:** Descloizite (if Zn > Cu), olivenite (Cu₂(AsO₄)(OH) — if As present), cuprite (Cu₂O — if very reducing micro-environments), malachite/azurite (Cu carbonates — if CO₃ available), vanadinite (Pb₅(VO₄)₃Cl)

### Stability
- **Breaks down in heat?** Yes, ~500–600°C
- **Breaks down in light?** No
- **Dissolves in water?** Very low solubility
- **Dissolves in acid?** Readily soluble
- **Oxidizes?** Already fully oxidized; stable
- **Dehydrates?** No
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Primary Cu sulfides (chalcopyrite, bornite, chalcocite) and Pb sulfides (galena) oxidize; V mobilized from wall-rock
- **Forms BEFORE:** Carbonation (malachite replacement possible)
- **Commonly associated minerals:** Descloizite, vanadinite, wulfenite, cerussite, olivenite, cuprite, malachite, azurite, hemimorphite, limonite, calcite, barite
- **Zone:** Supergene oxidation zone (above water table, arid climates)
- **Geological environment:** Oxidized portions of Pb-Cu deposits in V-bearing country rock; notably at Tsumeb where mottramite dominates over descloizite

### Famous Localities
- **Tsumeb, Namibia** — mottramite is the dominant vanadate species (descloizite rare there); concentrated in upper oxidation zone
- **Mottram St. Andrew, Cheshire, England** — type locality (namesake)
- **Mapimí, Durango, Mexico** — olive-green crusts with adamite
- **Berg Aukas, Namibia** — co-occurs with descloizite
- **Tyrone, New Mexico, USA** — green crusts in oxidation zone
- **Notable specimens:** Tsumeb produced the finest crystalline material; most occurrences are massive/crustiform

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW/MW/LW color:** None standard
- **Phosphorescent?** No
- **Activator:** None; Cu²⁺ is a powerful fluorescence quencher
- **Quenched by:** Cu²⁺ self-quenches; Fe content also quenches

### Flavor Text
> Mottramite is the green shadow of descloizite — same crystal structure, same lead-vanadium scaffold, but copper where zinc should be. The color shift is total: cherry-red becomes olive-green, orange streak becomes yellow-green, and the mineral goes from forming distinct spear-point blades to preferring fibrous radiating crusts, as if the copper makes it more social, less interested in standing alone. At Tsumeb it dominated the upper oxidation zone while descloizite stayed rare, a geological preference for copper in that particular broth. The two never truly separate — almost every specimen carries both elements, blended in ratios that refuse to honor human classification boundaries. Mottramite is the reminder that mineral species are snapshots of chemistry, not hard walls.

### Simulator Implementation Notes
- **New parameters needed:** Same as descloizite (trace_V tracking); uses existing Cu and Pb
- **New events needed:** Same vanadium mobilization event
- **Nucleation rule pseudocode:**
```
IF oxidation_zone AND T < 80°C
  AND trace_Pb > 100 AND trace_Cu > 50 AND trace_V > 10
  AND pH 5-8 AND Eh > 0.4V
  AND trace_Cu > trace_Zn  ← key discriminator vs descloizite
  AND vug_fill < 1.0
  → nucleate mottramite (max 3 crystals)
```
- **Growth rule pseudocode:**
```
IF σ_mottramite > 1.0 AND T < 80°C
  → grow at rate 4 (moderate)
  → habit: IF growth_rate > threshold → fibrous crust
           ELSE → radial crystal clusters
```
- **Habit selection logic:**
  - Fast growth → fibrous/botryoidal crust (most common)
  - Slow growth + space → radial sprays of tiny crystals
  - Rarely produces distinct individual crystals
- **Decomposition products:** ~500°C → PbO + CuO + V₂O₅

### Variants for Game
- **Variant 1: Duhamelite** — Ca-Bi bearing, acicular habit, found when Bi and Ca present alongside Cu
- **Variant 2: Cuprodescloizite (intermediate)** — Zn/Cu ratio near 1:1, brown-green color, transitional between both end-members
- **Variant 3: Earthy mottramite** — Massive, fine-grained, yellowish-green powder coating on fracture surfaces

---

## Paragenetic Sequence Note: Descloizite-Mottramite Solid Solution

These two minerals form a **complete solid solution series**: Pb(Zn,Cu)(VO₄)(OH). The key discriminator for the simulator is the **Cu:Zn ratio** in the fluid:

| Cu:Zn Ratio | Mineral | Color |
|---|---|---|
| Zn >> Cu | Descloizite | Cherry-red, brown |
| Cu ≈ Zn | Cuprodescloizite | Brown-green, olive |
| Cu >> Zn | Mottramite | Grass-green, olive-green |

**Implementation suggestion:** Rather than implementing two entirely separate minerals, consider a single "descloizite-mottramite" species that color-blends based on Cu:Zn ratio, similar to how the game might handle other solid solutions. The habit could also shift (more tabular → more fibrous) with Cu content.

**Shared formation conditions:**
- Supergene oxidation zone only (above water table)
- Arid to semi-arid climate (preserves vanadate minerals)
- Requires mobilization of V from wall-rock silicates (weathering event)
- Forms alongside vanadinite, wulfenite, cerussite, olivenite
- Competes for Pb with vanadinite (5 Pb per formula unit vs 1 Pb)
