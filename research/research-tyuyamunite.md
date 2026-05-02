# Tyuyamunite — Vugg Simulator Research

**Date:** 2026-05-01
**Status:** Implementation-grade draft (NOT yet boss-canonical). Pending review at StonePhilosopher. Synthesized from Wikipedia + Britannica + American Mineralogist (Stern et al. 1956 meta-tyuyamunite paper) + sim-architecture parity with carnotite/autunite.

## Species: Tyuyamunite

### Identity
- **Formula:** Ca(UO₂)₂(VO₄)₂·5–8H₂O (water content variable; meta-form ·3-5H₂O at low humidity)
- **Crystal system:** Orthorhombic dipyramidal (vs carnotite's monoclinic — the cation-substitution shifts symmetry)
- **Mineral group:** Carnotite group (Ca-uranyl vanadate)
- **Hardness (Mohs):** 1.5–2 (soft, like carnotite)
- **Specific gravity:** 3.6–3.9
- **Cleavage:** Perfect {001}, micaceous
- **Luster:** Adamantine to waxy, silky; earthy in massive form

### Color & Appearance
- **Typical color:** Canary yellow, lemon-yellow; greenish-yellow upon prolonged sunlight exposure
- **Color causes:** Uranyl (UO₂)²⁺ charge-transfer absorption; vanadate matrix tints toward green
- **Transparency:** Semitransparent to translucent
- **Streak:** Yellow
- **Notable visual features:** Often indistinguishable from carnotite in the field — same earthy yellow, same sandstone-staining habit. The two are commonly intergrown in Colorado Plateau and Tyuya-Muyun deposits.

### Crystal Habits
- **Primary habit:** Powdery to earthy crusts, microcrystalline aggregates
- **Common forms/faces:** Rarely crystalline; tabular {001} plates when found (Tyuya-Muyun produced the best material historically)
- **Twin laws:** None commonly reported
- **Varieties:**
  - Metatyuyamunite — partially dehydrated form (·3-5H₂O), forms in arid storage even at room T
- **Special morphologies:** Concentrations around petrified wood (organic-reduced precipitation), sandstone staining, vug coatings

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** 5–50°C (supergene/ambient)
- **Optimal growth temperature:** 15–35°C (arid environments, like carnotite)
- **Decomposition temperature:** Loses 3-5 H₂O at room T under dry storage to form metatyuyamunite; full structural collapse around 100°C
- **Temperature-dependent habits:** Same as carnotite — almost no habit variation; rarely crystalline

#### Chemistry Required
- **Required elements:** Ca, U, V — all mobile in oxidizing groundwater
- **Optional/enhancing:** K (drives toward carnotite analogue if dominant), Mg, Sr (substitute for Ca)
- **Inhibiting elements:** Strongly reducing fluid (keeps U⁴⁺ insoluble as uraninite); P or As dominance routes uranyl elsewhere
- **Required pH range:** 5.0–8.0 (V is mobile as vanadate above pH 5; below pH 5, VO₂⁺ takes over and the mineral is unstable)
- **Required Eh range:** Strongly oxidizing — U must be U⁶⁺, V must be V⁵⁺
- **Required O₂ range:** O₂ ≥ 0.8 in sim units (oxidizing supergene)

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ca²⁺, (UO₂)²⁺, VO₄³⁻
- **Byproducts of dissolution:** Releases uranyl, vanadate, calcium back to fluid (acid attack)

#### Growth Characteristics
- **Relative growth rate:** Moderate; tends to form crusts rather than discrete crystals
- **Maximum size:** Tyuya-Muyun specimens up to 2-3 mm tabular plates; usually sub-mm
- **Competes with:** Carnotite (K-cation analogue, geologically interconvertible by cation exchange — Britannica notes this is reversible)

#### Stability
- **Breaks down in heat?** Yes (irreversible structural collapse ~100°C)
- **Dissolves in acid?** Yes — pH < 5 destabilizes the uranyl vanadate framework
- **Dissolves in water?** Slightly — like carnotite, soluble in cold dilute acids; insoluble in cold water
- **Radiation sensitivity:** Strongly radioactive (U); meta-form is partly disordered from cation reordering

### Paragenesis
- **Forms AFTER:** Uraninite weathering — secondary mineral. Comes from oxidizing meteoric water meeting U-bearing primary minerals + V-bearing groundwater + Ca-bearing groundwater.
- **Forms BEFORE:** Long-term arid storage produces metatyuyamunite via partial dehydration; no further mineral conversion.
- **Commonly associated minerals:** Carnotite (constant companion in mixed K+Ca fluids), uraninite (parent), gypsum, calcite, opal, organic-derived carbon (petrified wood is the classic concentrator on Colorado Plateau)
- **Zone:** Supergene oxidation
- **Geological environments:**
  1. Sandstone-hosted roll-front deposits (Colorado Plateau type) — paragenetically with carnotite where fluid Ca/K varies
  2. Uranium-vanadium sedimentary deposits (Tyuya-Muyun, Fergana Valley)
  3. Vein deposits secondarily oxidized (less common)

### Famous Localities
- **Tyuya-Muyun, Fergana Valley, Kyrgyzstan** — TYPE LOCALITY (Nenadkevich, 1912). Sufficient quantity to constitute U+V ore.
- **Colorado Plateau, USA** — ubiquitous in CP sandstone uranium districts (Uravan, Moab, Grants), commonly intergrown with carnotite
- **Carrizo Mountains, Arizona/New Mexico** — ore-grade tyuyamunite
- **Mounana, Gabon** — secondary mineralization

### Fluorescence
- **Fluorescent under UV?** Yes, weakly to moderately
- **LW (365nm) color:** Yellow-green
- **SW (255nm) color:** Yellow, weaker than LW
- **Note:** Weaker than autunite because the vanadate matrix partially quenches uranyl emission (same effect that makes carnotite weakly fluorescent). Ca²⁺ vs K⁺ doesn't materially shift the fluorescence intensity for V-anion species — both are weak relative to autunite/uranospinite.

### Flavor Text

> Carnotite's quiet sister. The sandstone-staining yellow that prospectors followed across mesas, sometimes seen alongside carnotite, sometimes alone where the local groundwater carried more Ca than K. Most tyuyamunite is metamorphosed already — the room-temperature dehydration to metatyuyamunite is so easy that any specimen older than a year of dry storage is half-converted. The Tyuya-Muyun mine in 1912 was one of the first economic uranium deposits ever exploited; the mineral's name predates the discovery of the cation-fork reasoning that we now know connects it to carnotite as a single chemistry with two cations.

### Simulator Implementation Notes

- **No new FluidChemistry fields needed** — Ca, U, V all already declared
- **Cation fork (Round 9e):** Ca/(K+Ca) > 0.5 vs carnotite's K/(K+Ca) > 0.5
- **Anion fork:** V/(P+As+V) > 0.5 (mirror carnotite)
- **T optimum:** 15–35°C
- **pH window:** 5.0–8.0
- **Habit dispatch:** mirror carnotite — high-σ tabular_plates (rare), default earthy_crust, low-σ powdery_disseminated
- **Paragenetic preference:** weathering uraninite (canonical chain) or roll-front position via Fe>5 + low-T proxy
- **Carnotite update:** add K/(K+Ca) > 0.5 cation gate to its existing supersat (without this, carnotite would still fire in Ca-dominant fluids that should route to tyuyamunite)
