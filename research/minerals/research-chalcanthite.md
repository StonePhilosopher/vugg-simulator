# Research: Chalcanthite — Vugg Simulator

## Species: Chalcanthite

### Identity
- **Formula:** CuSO₄·5H₂O
- **Crystal system:** Triclinic (pinacoidal, space group P1̄)
- **Mineral group:** Sulfate (hydrated copper sulfate)
- **Hardness (Mohs):** 2.5
- **Specific gravity:** 2.12–2.3
- **Cleavage:** Perfect on {110}; imperfect on {1̄10}
- **Fracture:** Conchoidal
- **Luster:** Vitreous

### Color & Appearance
- **Typical color:** Sky blue to Berlin blue (Prussian blue) to greenish blue
- **Color causes:** Cu²⁺ chromophore — the intense blue of hydrated copper ion [Cu(H₂O)₅]²⁺
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Water-soluble (turns water blue); sweet metallic taste (POISONOUS); rare cruciform twins

### Crystal Habits
- **Primary habit:** Stalactitic, encrusted, reniform, massive. Natural crystals are RARE.
- **Common forms/faces:** Short prismatic to tabular when crystallized
- **Twin laws:** Rare cruciform (cross-shaped) twins
- **Special morphologies:** Stalactitic drip formations on mine walls, efflorescent crusts, fibrous masses

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Ambient (10–40°C); forms at Earth surface temperatures
- **Optimal growth temperature:** 20–30°C
- **Decomposition temperature:** Loses water progressively: ~30°C (loose water), ~110°C (2 H₂O), ~150°C (→ basaicite CuSO₄·H₂O), ~250°C (→ anhydrous CuSO₄)
- **Temperature-dependent habits:** Lower temps favor larger crystals; warm/dry → efflorescent crusts

#### Chemistry Required
- **Required elements:** Cu²⁺ (very high, concentrated solutions), SO₄²⁻ (high)
- **Optional/enhancing elements:** Fe²⁺ (melanterite solid solution), Mg²⁺ (pentahydrite), Mn²⁺ (jokokuite) — members of chalcanthite group
- **Inhibiting elements:** OH⁻ (high pH → brochantite/antlerite instead), CO₃²⁻ (→ malachite/azurite)
- **Required pH range:** <3 (very acidic). The most acid-loving of the copper sulfates.
- **Required Eh range:** Strongly oxidizing
- **Required O₂ range:** High (product of full oxidation)

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺ + SO₄²⁻; locks up 5 H₂O per formula unit
- **Byproducts of dissolution:** Releases Cu²⁺ + SO₄²⁺ (turns water blue) — readily soluble at ~20.7 g/100mL at 20°C

#### Growth Characteristics
- **Relative growth rate:** Fast when conditions are right (highly soluble, precipitates quickly from evaporating solutions)
- **Maximum crystal size:** To ~15 cm stalactitic masses; individual crystals to ~3 cm (very rare)
- **Typical crystal size in vugs:** Crusts and stalactitic forms dominate; discrete crystals <1 cm
- **Competes with:** Brochantite (higher pH), antlerite (higher pH), melanterite (if Fe-rich)

#### Stability
- **Breaks down in heat:** Progressive dehydration → basaicite → anhydrous CuSO₄ (chalcocyanite)
- **Breaks down in light:** Stable
- **Dissolves in water:** VERY soluble (20.7 g/100 mL at 20°C) — the defining property
- **Dissolves in acid:** Freely soluble
- **Oxidizes:** Already fully oxidized
- **Dehydrates:** Yes — effloresces in dry air, weeps in humid air. Specimens self-destruct without climate control.
- **Radiation sensitivity:** None

### Paragenesis
- **Forms AFTER:** Brochantite/antlerite (latest stage of oxidation); also forms directly from acid mine drainage
- **Forms BEFORE:** Nothing — it's the end of the copper sulfate line. Redissolves and washes away.
- **Commonly associated minerals:** Brochantite, malachite, chalcopyrite, melanterite, limonite, calcite, aragonite
- **Zone:** Late-stage supergene oxidation / mine drainage environment
- **Geological environment:** Arid oxidized copper deposits; mine walls (post-mining formation very common); volcanic fumaroles

### Famous Localities
- **Chuquicamata, Chile:** Stalactitic blue formations in mine workings
- **Rio Tinto, Spain:** Acid mine drainage deposits
- **Arizona copper districts:** Mine wall efflorescences
- **Notable:** Natural crystals extremely rare; most "specimens" on market are laboratory-grown fakes. A genuine natural crystal is a collector's prize.

### Fluorescence
- **Fluorescent under UV?** No

### Flavor Text

> Chalcanthite is copper's last gasp made beautiful. When every other mineral has had its turn — sulfides oxidized, carbonates precipitated, basic sulfates crystallized — what's left is the purest copper sulfate, dissolved in acid water, concentrating under an desert sun into sky-blue tears. The name means "copper flower" in Greek, and it blooms where nothing else can grow: mine walls dripping with acid, volcanic fumaroles, the driest oxidized zones on Earth. It dissolves in rain. It dehydrates in dry air. Every specimen is a temporary victory over entropy. The mineral dealers know this — most "natural" chalcanthite is grown in a lab. The real thing is rare and doomed and gorgeous.

### Simulator Implementation Notes
- **New parameters needed:** Humidity/aridity tracking (needed for water-soluble mineral persistence)
- **Nucleation rule:**
```
IF temp < 40°C AND pH < 3 AND trace_Cu very high AND SO₄²⁻ very high AND arid (low water flux) AND OH⁻ very low → nucleate chalcanthite
```
- **Growth rule:**
```
IF pH < 3 AND Cu + SO₄ concentrated AND evaporation > precipitation → grow fast
IF water influx increases → dissolve (unique mechanic: reversible on humidity cycle)
```
- **Habit selection logic:** High evaporation → stalactitic/crust; slow evaporation in vug → rare prismatic crystals
- **Decomposition products:** Progressive dehydration with temperature → basaicite → chalcocyanite
- **Special mechanic:** Water solubility — chalcanthite can DISSOLVE if broth becomes more dilute. Only persists in arid/concentrated conditions. Cyclic growth/dissolution possible.

### Variants for Game
- **Variant 1:** Blue stalactite — hanging drip formations, sky blue (classic mine wall, high evaporation)
- **Variant 2:** Crystalline crust — rare tabular blue crystals (slow evaporation in sheltered vug)
- **Variant 3:** Efflorescent bloom — powdery blue coating, powdery (very rapid evaporation, arid surface)

### Paragenetic Sequence Note
Chalcanthite is the **terminal member** of the copper sulfate oxidation sequence. Sulfides oxidize → Cu²⁺ + SO₄²⁻ + H⁺ released → pH drops → brochantite (pH 4-7) → antlerite (pH <4) → chalcanthite (pH <3, concentrated, dry). It's the last mineral standing before everything washes away. Its water solubility makes it ephemeral — a mineral that can grow, dissolve, and regrow with the seasons.
