# Mineral Species Template — Vugg Simulator

## Species: Barite

### Identity
- **Formula:** BaSO₄
- **Crystal system:** Orthorhombic (dipyramidal, space group Pnma)
- **Mineral group:** Sulfate (barite group: barite, celestine, anglesite, anhydrite)
- **Hardness (Mohs):** 3–3.5
- **Specific gravity:** 4.3–5.0 (notably heavy for a non-metallic mineral — name from Greek βαρύς "heavy")
- **Cleavage:** Perfect on {001}, perfect on {210}, imperfect on {010}
- **Fracture:** Uneven/irregular
- **Luster:** Vitreous, pearly on cleavage surfaces

### Color & Appearance
- **Typical color:** Colorless, white, pale blue, yellow, brown, grey
- **Color causes:** Trace impurities — yellow from iron, blue from color centers or inclusions, brown from organic matter
- **Transparency:** Transparent to opaque
- **Streak:** White
- **Notable visual features:** Extreme density is the dead giveaway — feels twice as heavy as quartz of the same size. "Desert rose" rosettes (tabular crystals intergrown in radial clusters with included sand)

### Crystal Habits
- **Primary habit:** Tabular to platy crystals parallel to {001} base
- **Common forms/faces:** {001}, {210}, {101}, {011}
- **Twin laws:** Rare; contact twins on {210}
- **Varieties:** "Desert rose" (sand-included rosettes from arid environments), "Bologna Stone" (radiating fibrous masses that phosphoresce after calcination — historic alchemical curiosity)
- **Special morphologies:** Fibrous, nodular, massive, stalactitic, crested (cockscomb aggregates of thin plates)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 50–400°C (wide range — forms from low-T sedimentary to high-T hydrothermal)
- **Optimal growth temperature:** 100–250°C (hydrothermal veins)
- **Decomposition temperature:** ~1580°C (melting), but decomposes to BaO + SO₃ above ~1200°C
- **Temperature-dependent habits:** Higher T → more equant/prismatic; lower T → thinner tabular plates

#### Chemistry Required
- **Required elements in broth:** Ba²⁺ (>1 ppm), SO₄²⁻ (sulfate — requires oxidizing conditions)
- **Optional/enhancing elements:** Sr²⁺ (forms solid solution toward celestine), Ca²⁺, Pb²⁺
- **Inhibiting elements:** High NaCl salinity can inhibit precipitation in some conditions
- **Required pH range:** Neutral to alkaline (6.5–9)
- **Required Eh range:** Oxidizing (sulfate must be stable — not reducing/H₂S conditions)
- **Required O₂ range:** Moderate to high — sulfate must be present, not sulfide

#### Secondary Chemistry Release
- **Byproducts of nucleation:** None significant — straightforward precipitation
- **Byproducts of dissolution:** Releases Ba²⁺ and SO₄²⁻ back to fluid. Extremely low solubility (~2 mg/L at 25°C)

#### Growth Characteristics
- **Relative growth rate:** Slow — very low solubility limits mass transfer
- **Maximum crystal size:** Up to 1+ meters (massive vein material); crystals to 30+ cm known
- **Typical crystal size in vugs:** 1–10 cm tabular plates
- **Does growth rate change with temperature?** Slightly — solubility increases modestly with temperature, but nothing dramatic
- **Competes with:** Celestine (Sr competes for same SO₄²⁻), anglesite (Pb²⁺), anhydrite (Ca²⁺ at high T), gypsum (Ca²⁺ at low T)

#### Stability
- **Breaks down in heat?** Decomposes >1200°C to BaO + SO₃
- **Breaks down in light?** No
- **Dissolves in water?** Extremely low solubility (~2 mg/L) — one of the most insoluble common minerals
- **Dissolves in acid?** Slowly in concentrated H₂SO₄; generally resistant
- **Oxidizes?** Already fully oxidized sulfate — extremely stable at surface conditions
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Some specimens show radiation-induced color centers (blue barite)

### Paragenesis
- **Forms AFTER:** Sulfide oxidation provides SO₄²⁻; barium released from feldspar/weathering of granitic rocks
- **Forms BEFORE:** Often a late-stage mineral in veins, capping earlier sulfide mineralization
- **Commonly associated minerals:** Galena, sphalerite, fluorite, calcite, quartz, celestine, anglesite, hematite
- **Zone:** Hydrothermal veins (primary), sedimentary/evaporite (diagenetic), supergene oxidation zones
- **Geological environment:** Lead-zinc veins in limestone, hot spring deposits, Mississippi Valley-type deposits, sedimentary beds

### Famous Localities
- **Classic locality 1:** Cumberland/Cumbria, England — sharp tabular crystals with dolomite
- **Classic locality 2:** Cerro Warihuyn, Peru — aesthetic blue-bladed crystals
- **Classic locality 3:** Frizington, Cumberland — classic cockscomb aggregates
- **Notable specimens:** "Desert rose" clusters from Tunisia/Algeria/Oklahoma; giant crystals from Blue Bell Mine, California

### Fluorescence
- **Fluorescent under UV?** Sometimes — not all specimens
- **SW (255nm) color:** Yellow-white, bluish white
- **MW (310nm) color:** Weak white/yellow
- **LW (365nm) color:** Yellow-white, cream
- **Phosphorescent?** The "Bologna Stone" variant phosphoresces strongly after heating
- **Activator:** Rare earth elements (Eu²⁺, Ce³⁺), sometimes organic inclusions
- **Quenched by:** Iron

### Flavor Text
> Barite is the mineral that geologists hand to students and say "feel how heavy that is." At 4.5 g/cm³ it's nearly twice as dense as quartz — all that barium locked in a lattice so stable it barely dissolves in anything. In the field it's the quiet sentinel of hydrothermal systems: where barite crystallizes, the fluid has cooled and sulfide deposition is winding down. The sulfates are having their turn. Desert rose barite — tabular crystals blooming outward with sand frozen between the petals — is what happens when this heavy, patient mineral grows in the thin soil of arid lands, incorporating the desert itself.

### Simulator Implementation Notes
- **New parameters needed:** trace_Ba already in broth; Sr available for solid solution
- **New events needed:** None — straightforward precipitation
- **Nucleation rule pseudocode:**
```
IF trace_Ba > threshold AND SO4_available AND Eh > oxidizing_threshold AND T < 400 → nucleate barite
IF trace_Sr > trace_Ba → nucleate celestine instead (solid solution competition)
```
- **Growth rule pseudocode:**
```
IF supersaturation(BaSO4) > 1.0 → grow at rate proportional to σ
rate = base_rate * σ (slow growth — low solubility limit)
```
- **Habit selection logic:**
  - T > 250°C → more equant/prismatic
  - T < 150°C → thin tabular plates
  - Sand/sediment present → desert rose rosette habit
- **Decomposition products:** None at game-relevant temperatures

### Variants for Game
- **Variant 1:** Blue barite — radiation-induced color centers, slightly more visually distinctive
- **Variant 2:** Desert rose — tabular rosettes with included sand matrix, arid environment indicator
- **Variant 3:** Bologna Stone — radiating fibrous habit; phosphorescent after thermal event (special collector's variant)

---

## Paragenetic Link
Barite-celestine (SrSO₄) form a complete solid solution series (Ba,Sr)SO₄. In-game: if broth has both Ba²⁺ and Sr²⁺ competing for SO₄²⁻, the dominant cation determines which endmember crystallizes. Intermediate compositions are possible but rare in nature. Both are orthorhombic, same space group, isostructural. See `memory/research-celestine.md`.

Completed: 2026-04-23
