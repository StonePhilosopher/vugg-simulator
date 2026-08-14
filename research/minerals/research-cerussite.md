# Research: Cerussite (PbCO₃) — Lead Oxidation Zone Sequence, Mineral 3/3

## Species: Cerussite

### Identity
- **Formula:** PbCO₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Carbonate (aragonite group — isomorphous with aragonite and witherite)
- **Hardness (Mohs):** 3.0–3.5
- **Specific gravity:** 6.53–6.57 (heavy — less than galena, more than anglesite)
- **Cleavage:** Good on {110} and {021}
- **Fracture:** Brittle conchoidal
- **Luster:** Adamantine, vitreous, resinous

### Color & Appearance
- **Typical color:** Colorless, white, gray, sometimes blue or green tinted
- **Color causes:** Usually pure and colorless; gray from galena inclusions, green/blue from Cu traces
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** Exceptional adamantine luster with very high dispersion (fire). Extreme birefringence (δ = 0.273 — one of the highest of any mineral). Cyclic twins create pseudo-hexagonal stellate groups — six-rayed stars that are among the most recognizable mineral forms. Effervesces in nitric acid.

### Crystal Habits
- **Primary habit:** Tabular to equant orthorhombic crystals; reticulate aggregates
- **Common forms/faces:** Prismatic, tabular {001}, {110} prism faces
- **Twin laws:** Contact twins on {110} — extremely common, producing:
  - Simple contact twins (heart-shaped or V-shaped pairs)
  - Cyclic twins (three individuals at ~60°, forming six-rayed star = pseudo-hexagonal)
  - Re-entrant angles characteristic
- **Varieties:** Iglesiasite (Zn-bearing variety with up to 7% ZnCO₃ substitution)
- **Special morphologies:** Acicular needles (Cornwall), massive granular, fibrous, stellate twin groups

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <80°C (supergene/weathering zone)
- **Optimal growth temperature:** 15–40°C (ambient groundwater temperatures)
- **Decomposition temperature:** ~315°C (decomposes to PbO + CO₂)
- **Temperature-dependent habits:** Not significant — always supergene low-T

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ (from galena/anglesite dissolution), CO₃²⁻ (from groundwater, limestone host rock, or atmospheric CO₂)
- **Optional/enhancing elements:** Zn (produces iglesiasite variety), Cu (causes blue/green tint)
- **Inhibiting elements:** None significant — cerussite is the stable Pb mineral in carbonate environments
- **Required pH range:** Slightly alkaline preferred (pH 7–9, carbonate-buffered groundwater)
- **Required Eh range:** Oxidizing (Eh > +300 mV) — requires oxidized Pb²⁺, not PbS
- **Required O₂ range:** High — oxidation must have already occurred (galena → anglesite step)

#### Secondary Chemistry Release
- **When forming:** PbSO₄ (anglesite) + CO₃²⁻ → PbCO₃ (cerussite) + SO₄²⁻ — releases sulfate
- **Or directly from galena:** PbS + CO₂ + H₂O + O₂ → PbCO₃ + H₂SO₄ (produces sulfuric acid)
- **When dissolving:** PbCO₃ + 2H⁺ → Pb²⁺ + CO₂ + H₂O (acid dissolution, effervesces)

#### Growth Characteristics
- **Relative growth rate:** Moderate — limited by dissolution of precursor (anglesite or galena)
- **Maximum crystal size:** Crystals to 20+ cm; twin groups to 30 cm
- **Typical crystal size in vugs:** 2–8 cm crystals; stellate twins 3–15 cm
- **Growth rate vs temperature:** Slightly faster in warmer conditions but always limited to near-surface
- **Competes with:** Anglesite (in low-CO₃ environments, anglesite persists instead; cerussite wins when CO₃ is abundant), pyromorphite (if PO₄ present, pyromorphite may form instead)

#### Stability
- **Breaks down in heat?** Yes — decomposes ~315°C to massicot/litharge (PbO) + CO₂
- **Breaks down in light?** No
- **Dissolves in water?** Very slightly (Ksp ≈ 1.5 × 10⁻¹³ — less soluble than anglesite, which is why it replaces anglesite)
- **Dissolves in acid?** Yes — effervesces vigorously in HNO₃ and HCl (diagnostic test)
- **Oxidizes?** No — Pb is already in +2 state, carbonate is stable
- **Radiation sensitivity:** None significant

### Paragenesis
- **Forms AFTER:** Galena (primary), anglesite (intermediate) — cerussite is the final stable product in carbonate environments
- **Forms BEFORE:** Pyromorphite (if phosphate introduced later), plattnerite (PbO₂, further oxidation — rare)
- **Commonly associated minerals:** Galena, anglesite, pyromorphite, limonite, smithsonite, cerargyrite, wulfenite, vanadinite, mimetite
- **Zone:** Supergene/oxidation zone — the deepest-reaching of the lead secondary minerals
- **Geological environment:** Oxidized zones of lead deposits, especially in carbonate (limestone/dolomite) host rocks. MVT deposits produce excellent cerussite.

### Famous Localities
- **Classic locality 1:** Broken Hill, NSW, Australia — world-class stellate twin groups
- **Classic locality 2:** Touissit District, Morocco — gemmy transparent crystals
- **Classic locality 3:** Phoenixville, Pennsylvania — historic locality, fine crystals
- **Notable specimens:** Broken Hill produces the iconic six-rayed stellate twins to 30+ cm; Touissit yields gem-quality colorless crystals. Mibladen, Morocco produces cerussite on galena matrix — beautiful contrast of metallic cubes and adamantine carbonate stars.

### Fluorescence
- **Fluorescent under UV?** Sometimes — weak
- **SW (255nm) color:** —
- **MW (310nm) color:** —
- **LW (365nm) color:** Sometimes weak yellow
- **Phosphorescent?** No
- **Activator:** Not well characterized; possibly trace organic inclusions
- **Quenched by:** N/A

### Flavor Text

> Cerussite is the final letter in lead's surface vocabulary. Galena cubes dissolve, anglesite forms and dissolves in turn, and what remains — in carbonate groundwaters, in limestone country rock, in the breath of the earth itself — is cerussite. Its twin crystals form six-rayed stars that look like frozen snowflakes made of lead carbonate, each arm intergrown at exactly 60°. The luster is adamantine, the dispersion rivals diamond, and a fine transparent cerussite crystal catching light is one of the mineral kingdom's greatest performances. But it's brittle — a heavy, fragile thing that must be handled like glass. In a vug, cerussite perched on a galena cube tells the whole story: here is where the sulfide met the air and was rewritten.

### Simulator Implementation Notes
- **New parameters needed:** CO₃²⁻ (may already exist as dissolved CO₂/carbonate system)
- **New events needed:** None new — forms from anglesite dissolution or direct galena oxidation
- **Nucleation rule pseudocode:**
```
IF (anglesite exists OR galena exists) AND CO₃²⁻ > threshold AND Eh > 300 AND T < 80
  AND num_crystals("cerussite") < 3 → nucleate cerussite
  Prefer nucleation on/near anglesite or galena surfaces
```
- **Growth rule pseudocode:**
```
IF trace_Pb > 0 AND CO₃²⁻ > 0 AND Eh > 300
  → grow at rate 3 (moderate)
  consume Pb and CO₃ proportionally
  IF anglesite nearby → dissolve anglesite (source of Pb), release SO₄²⁻
```
- **Habit selection logic:**
  - Low supersaturation → tabular single crystals
  - Moderate σ + twin tendency → cyclic six-rayed stellate twins (signature habit, ~70% chance)
  - High supersaturation → granular massive, acicular needles
- **Decomposition products:** T > 315°C → PbO (massicot/litharge) + CO₂ gas

### Variants for Game
- **Variant 1: Stellate twin cerussite** — cyclic contact twins forming six-rayed star. The iconic form. Most visually striking.
- **Variant 2: Acicular cerussite** — delicate needle-like crystals, found in Cornwall-type deposits. Fragile but beautiful druses.
- **Variant 3: Pseudomorph after galena** — rare but documented: cerussite replacing galena cubes directly (skipping anglesite step), preserving cubic shape in adamantine carbonate.

---

## Sequence Position
Cerussite is mineral 3/3 (final) in the lead oxidation sequence: galena → anglesite → **cerussite**
- See `memory/research-galena.md` for primary sulfide
- See `memory/research-anglesite.md` for intermediate sulfate

### Why This Sequence Matters for the Simulator
In the lead oxidation zone of a vug:
1. **Primary stage:** Galena cubes grow from Pb + S in reducing hydrothermal fluid
2. **Oxidation begins:** Fluid becomes oxygenated → galena dissolves at surface → anglesite crusts form
3. **Carbonate takeover:** Groundwater brings CO₃²⁻ → anglesite dissolves → cerussite stars crystallize
4. **Further evolution:** If PO₄, AsO₄, or VO₄ present → pyromorphite, mimetite, vanadinite can form from the Pb²⁺ released

The same Pb atom can be sequentially incorporated into four different minerals as the chemistry evolves. This is the supergene enrichment story for lead.
