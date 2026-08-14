# Research: Mimetite — Vugg Simulator

## Species: Mimetite

### Identity
- **Formula:** Pb₅(AsO₄)₃Cl
- **Crystal system:** Hexagonal (6/m, space group P6₃/m)
- **Mineral group:** Arsenate — Apatite group
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 7.1–7.24 (heavier than pyromorphite due to As)
- **Cleavage:** Imperfect on {10ī1}
- **Fracture:** Conchoidal, brittle
- **Luster:** Resinous to subadamantine

### Color & Appearance
- **Typical color:** Pale to bright yellow, yellowish-brown, yellow-orange, white, rarely colorless
- **Color causes:** Intrinsic to Pb₅(AsO₄)₃Cl — no strong chromophore needed for yellow hues; trace Cr can produce orange-red (discredited variety "bellite"); Fe contributes brown tones
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Botryoidal to globular aggregates with resinous luster and internal radiating fibrous structures. "Mimetite" from Greek "imitator" — so similar to pyromorphite they were confused for centuries as "green lead ore" vs "brown lead ore."

### Crystal Habits
- **Primary habit:** Short hexagonal prismatic crystals; botryoidal to globular aggregates
- **Common forms/faces:** {10ī0} prism, {0001} basal pinacoid
- **Twin laws:** Rare on {1122}
- **Varieties:** Campylite (barrel-shaped curved aggregates — shared name with pyromorphite habit); Bellite (discredited — Cr-bearing mimetite or mixture with crocoite, orange-red)
- **Special morphologies:** Botryoidal, reniform, globular with radiating internal structure, incrusting. Less commonly acicular than pyromorphite.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Near-ambient to ~80°C (supergene)
- **Optimal growth temperature:** 15–40°C
- **Decomposition temperature:** ~950°C (slightly lower than pyromorphite)
- **Temperature-dependent habits:** Similar to pyromorphite — lower T favors fine aggregates, moderate T → individual crystals

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ (>50 ppm), AsO₄³⁻ (>10 ppm), Cl⁻ (>5 ppm)
- **Optional/enhancing elements:** P (substitutes for As → pyromorphite series), V (substitutes for As → vanadinite series), Ca (substitutes for Pb), Cr (orange-red color)
- **Inhibiting elements:** High PO₄³⁻ (→ pyromorphite preferentially forms — P wins over As due to slightly lower solubility); high SO₄²⁻ (→ anglesite); high CO₃²⁻ (→ cerussite)
- **Required pH range:** 2–7 (wide tolerance, optimal 3–6)
- **Required Eh range:** Oxidizing (supergene zone)
- **Required O₂ range:** High — requires oxidation of primary As-bearing sulfides

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Pb²⁺, AsO₄³⁻, Cl⁻. Very low solubility.
- **Byproducts of dissolution:** Dissolves in HNO₃ releasing Pb²⁺, AsO₄³⁻, Cl⁻ (arsenic-rich solution — toxic!)

#### Growth Characteristics
- **Relative growth rate:** Moderate — similar to pyromorphite
- **Maximum crystal size:** To ~5 cm (individual crystals), botryoidal crusts can be larger
- **Typical crystal size in vugs:** 0.3–2 cm hexagonal prisms; botryoidal aggregates 1–5 cm
- **Competes with:** Pyromorphite (P vs As competition), cerussite, anglesite, wulfenite, scorodite (FeAsO₄·2H₂O — competes for As)

#### Stability
- **Breaks down in heat?** Melts ~950°C
- **Breaks down in light?** No — stable
- **Dissolves in water?** Very low solubility (Ksp ~10⁻⁷⁶)
- **Dissolves in acid?** Dissolves in HNO₃ (releases toxic arsenic)
- **Oxidizes?** No — fully oxidized
- **Dehydrates?** No — anhydrous

### Paragenesis
- **Forms AFTER:** Galena oxidation (Pb²⁺ release) + arsenopyrite/sulfarsenide oxidation (AsO₄³⁻ release)
- **Forms BEFORE:** Generally a late supergene product; may be overgrown by later carbonates
- **Commonly associated minerals:** Galena, arsenopyrite, pyromorphite, cerussite, anglesite, wulfenite, scorodite, smithsonite, hemimorphite, limonite, mottramite, willemite
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized zones of lead-arsenic deposits

### Famous Localities
- **Classic locality 1:** Tsumeb Mine, Namibia — spectacular yellow-orange hexagonal crystals and botryoidal forms
- **Classic locality 2:** Mapimí, Durango, Mexico — fine golden-yellow specimens
- **Classic locality 3:** Cumberland, England; Johanngeorgenstadt, Saxony, Germany — classic European localities
- **Notable specimens:** Tsumeb produced mimetite crystals to 3+ cm with exceptional resinous luster; golden botryoidal "cannonball" aggregates from Mexico

### Fluorescence
- **Fluorescent under UV?** Generally non-fluorescent to very weak
- **SW (255nm) color:** None reported
- **MW (310nm) color:** None reported
- **LW (365nm) color:** Very weak yellow (rare specimens)
- **Phosphorescent?** No
- **Activator:** If fluorescent, likely due to REE substitution
- **Quenched by:** Fe²⁺, and intrinsic heavy-metal absorption

### Flavor Text
> Mimetite is the arsenic answer to a question pyromorphite already answered. Same crystal structure, same hexagonal barrels, same lead-heavy Specific gravity — but swap phosphorus for arsenic and the color shifts from green to gold. The name means "imitator," because for centuries nobody could tell them apart. They were lumped together as "green lead ore" and "brown lead ore" by miners who correctly intuited that the distinction didn't matter for smelting. Mimetite requires arsenic in the oxidation broth, which means arsenopyrite had to rot first. Every golden mimetite crystal is a fossil of microbial decay — the fingerprint of an ecosystem that learned to eat arsenic and excrete beauty.

### Simulator Implementation Notes
- **New parameters needed:** trace_As (already in 30-element list)
- **Nucleation rule pseudocode:**
```
IF temperature < 80°C
AND Eh > 0.3 (oxidizing)
AND trace_Pb > 50 ppm
AND trace_As > 10 ppm
AND trace_Cl > 5 ppm
AND pH 2-7
AND As:P ratio favors mimetite (As > P, or no P available)
AND galena_present AND arsenopyrite_present
→ nucleate mimetite
```
- **Growth rule pseudocode:**
```
IF sigma_mimetite > 1.0
→ grow at rate 3
Habit: if Pb_high + slow_growth → hexagonal prism; if radiating_seed → botryoidal
```
- **Habit selection logic:**
  - Hexagonal prisms when well-spaced nucleation sites available
  - Botryoidal/globular when nucleation sites are crowded or substrate is irregular
  - Campylite (barrel aggregates) at intermediate conditions
- **Solid solution:** If P and As both present, intermediate pyromorphite-mimetite composition determined by P:As ratio

### Variants for Game
- **Variant 1: Golden Botryoid** — bright yellow-orange botryoidal aggregates. Conditions: high As, no P, botryoidal substrate
- **Variant 2: Yellow Hexagonal Prism** — short yellow hexagonal crystals. Conditions: moderate As, good space, low crowding
- **Variant 3: Campylite** — barrel-shaped crystals in curved hemispherical aggregates. Conditions: mixed P/As chemistry

---

*Research completed: 2026-04-19*
