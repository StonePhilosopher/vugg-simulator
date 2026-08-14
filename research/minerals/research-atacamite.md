# Species: Atacamite

### Identity
- **Formula:** Cu₂Cl(OH)₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Halide (copper chloride hydroxide)
- **Hardness (Mohs):** 3–3.5
- **Specific gravity:** 3.745–3.776
- **Cleavage:** Perfect on {010}, fair on {101}
- **Fracture:** Conchoidal
- **Luster:** Adamantine to vitreous

### Color & Appearance
- **Typical color:** Bright green, dark emerald-green, blackish green
- **Color causes:** Cu²⁺ chromophore — the same copper that makes malachite and azurite green/blue gives atacamite its intense emerald color
- **Transparency:** Transparent to translucent
- **Streak:** Apple green
- **Notable visual features:** Intense bright emerald green, one of the greenest minerals. Pleochroic: pale green → yellow-green → grass-green depending on orientation. Prismatic crystals can show striations.

### Crystal Habits
- **Primary habit:** Slender prismatic crystals, often elongated along [001]
- **Common forms/faces:** {110}, {010}, {021}, {101}
- **Twin laws:** Contact and penetration twinning with complex groupings
- **Varieties:** Prismatic crystal form; fibrous/acicular form; massive granular; botryoidal crusts
- **Special morphologies:** Fibrous aggregates, drusy coatings, earthy masses. Often forms as crusts or radiating crystal groups on matrix.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Ambient to ~100°C (supergene/weathering conditions)
- **Optimal growth temperature:** 15–40°C (arid climate weathering zone)
- **Decomposition temperature:** Decomposes above ~200°C, losing water and chlorine
- **Temperature-dependent habits:** Higher temperatures may favor more massive/botryoidal forms; cooler conditions favor prismatic crystals

#### Chemistry Required
- **Required elements in broth:** Cu (copper), Cl (chloride)
- **Optional/enhancing elements:** Na (provides saline conditions); S (source copper from sulfide oxidation)
- **Inhibiting elements:** Excessive carbonate (promotes malachite instead); excessive sulfate (promotes brochantite instead)
- **Required pH range:** Slightly acidic to neutral (5–7) — alkaline conditions favor malachite
- **Required Eh range:** Oxidizing (supergene zone — copper must be Cu²⁺)
- **Required O₂ range:** High — requires fully oxidizing conditions

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes H⁺ during formation from copper chloride solutions
- **Byproducts of nucleation:** Sulfide oxidation preceding atacamite formation releases H⁺ (acid mine drainage), but atacamite itself neutralizes some acidity by incorporating OH⁻
- **Byproducts of dissolution:** Cu²⁺, Cl⁻, OH⁻ — contributes to copper mobility in ground water

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Crystals to ~10 cm known; typically 1–30 mm prisms
- **Typical crystal size in vugs:** 2–15 mm prismatic crystals, often in radiating groups
- **Does growth rate change with temperature?** Warmer = faster growth; arid conditions promote formation by concentrating chloride solutions through evaporation
- **Competes with:** Malachite (carbonate wins over chloride in CO₂-rich environments), brochantite (sulfate wins in sulfate-rich environments), chrysocolla (silica-rich environments)

#### Stability
- **Breaks down in heat?** Yes, above ~200°C loses H₂O and Cl
- **Breaks down in light?** No — stable
- **Dissolves in water?** Slightly soluble; more soluble in acidic water
- **Dissolves in acid?** Dissolves in HCl and HNO₃ with effervescence
- **Oxidizes?** Already fully oxidized (Cu²⁺); can further alter to other secondary copper minerals
- **Dehydrates?** Not a hydrate (structural OH only)
- **Radiation sensitivity:** Not documented

### Paragenesis
- **Forms AFTER:** Primary copper sulfides (chalcopyrite, bornite, chalcocite) — these must oxidize first to release Cu²⁺
- **Forms BEFORE:** Malachite, azurite (if carbonate becomes available); can be replaced by brochantite in sulfate-dominated environments
- **Commonly associated minerals:** Cuprite, brochantite, linarite, caledonite, malachite, chrysocolla, libethenite, paratacamite, clinoatacamite
- **Zone:** Supergene oxidation zone — specifically in arid, chloride-rich environments
- **Geological environment:** Oxidation zones of copper deposits in arid climates (Atacama Desert type); also as volcanic sublimate; on oxidized bronze/copper artifacts; in black smoker sulfide alteration

### Famous Localities
- **Classic locality 1:** Atacama Desert, Chile (type locality) — named for the desert itself
- **Classic locality 2:** Mount Gunson, South Australia — fine prismatic crystals
- **Classic locality 3:** Moctezuma, Sonora, Mexico; also Bisbee, Arizona
- **Notable specimens:** Prismatic groups from Tierra Amarilla, Chile; specimens on the Statue of Liberty's patina; Antikythera mechanism bronze alteration. Fine emerald-green crystals from Burra Burra, South Australia.

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text
> Atacamite is what happens when copper meets chloride in a desert. Most of the world's copper oxidizes into green carbonates — malachite and azurite — because rain carries CO₂ from the atmosphere. But in the Atacama, where rain hasn't fallen in human memory, the chloride wins. The result is emerald so vivid it makes malachite look tired. The same mineral forms on sunken bronze statues at the bottom of the sea — copper, salt water, and time. The Antikythera mechanism, humanity's first analog computer, was sheathed in atacamite when they pulled it from the Aegean. Two thousand years of seawater turned bronze gears into green crystals. That's not corrosion. That's the ocean's way of cataloging.

### Simulator Implementation Notes
- **New parameters needed:** Chloride concentration in oxidation zone brines; aridity tracker
- **New events needed:** Arid climate oxidation event; bronze/copper artifact aging event
- **Nucleation rule pseudocode:**
```
IF Cu > threshold AND Cl > threshold AND pH < 7 AND Eh > oxidizing AND carbonate_low AND aridity > threshold → nucleate atacamite
```
- **Growth rule pseudocode:**
```
IF Cu²⁺ available AND Cl available AND oxidizing conditions AND aridity maintained → grow
IF CO₃ increases → convert to malachite
IF SO₄ increases → convert to brochantite
```
- **Habit selection logic:** Low Cl + slow growth → prismatic; high Cl + fast growth → fibrous/crustiform
- **Decomposition products:** Can convert to malachite (carbonate replaces chloride), brochantite (sulfate replaces chloride), or dissolve to release Cu²⁺

### Variants for Game
- **Variant 1:** Prismatic atacamite — well-formed elongated green crystals, moderate Cl, slow growth
- **Variant 2:** Fibrous atacamite — radiating fibrous green aggregates, high Cl, rapid growth in saline environments
- **Variant 3:** Botallackite/clinoatacamite (polymorphs) — same chemistry, different crystal structures forming at slightly different conditions (botallackite = lower T, more hydrous; paratacamite = rhombohedral, often Ni-bearing)

---

## Paragenetic Context: Copper Oxidation Zone
Atacamite occupies a specific niche in the copper oxidation sequence:
1. **Primary sulfides** (chalcopyrite, bornite, chalcocite) → oxidize to release Cu²⁺
2. **Cuprite** (Cu₂O) → forms first, moderate oxidation
3. **Atacamite** OR **brochantite** OR **malachite** → compete for Cu²⁺ depending on anion availability (Cl⁻ vs SO₄²⁻ vs CO₃²⁻)
4. **Chrysocolla** → late-stage, silica-rich

The key discriminator: **chloride-rich, arid conditions** favor atacamite over malachite. This makes it the signature mineral of desert copper deposits.

See also: `memory/research-cuprite.md`, `memory/research-malachite.md`, `memory/research-brochantite.md`
