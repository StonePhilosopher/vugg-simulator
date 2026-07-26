# Autunite — Vugg Simulator Research

## Species: Autunite

### Identity
- **Formula:** Ca(UO₂)₂(PO₄)₂·10–12H₂O (variable hydration; commonly 11H₂O)
- **Crystal system:** Orthorhombic (pseudotetragonal — appears square but true symmetry is lower)
- **Mineral group:** Autunite group (uranyl phosphate) — the namesake species
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 3.05–3.2 (measured), 3.14 (calculated)
- **Cleavage:** {001} perfect, {100} and {010} poor — micaceous, can be flaked like mica
- **Fracture:** Uneven to micaceous
- **Luster:** Vitreous to pearly on cleavage surfaces; waxy to resinous in aggregates

### Color & Appearance
- **Typical color:** Lemon-yellow to sulfur-yellow, greenish-yellow, pale green; rarely dark green to greenish-black
- **Color causes:** Uranyl (UO₂)²⁺ chromophore — the same (UO₂)²⁺ absorption that colors all autunite-group minerals. No Cu means yellow instead of green (contrast with torbernite's emerald green from Cu²⁺)
- **Transparency:** Transparent to translucent
- **Streak:** Pale yellow
- **Notable visual features:** Strong bright yellow-green fluorescence under UV — one of the most fluorescent minerals known. Tabular square crystals that look like tiny yellow windows. Radioactive (48.27% U by weight).

### Crystal Habits
- **Primary habit:** Thin to thick tabular crystals flattened on {001}, rectangular or octagonal outline
- **Common forms/faces:** {001} dominant (the flat face), {010}, {100}, sometimes {110} giving octagonal cross-sections
- **Twin laws:** Rare interpenetrant twinning on {110}
- **Varieties:** 
  - Meta-autunite I (Ca(UO₂)₂(PO₄)₂·6–8H₂O) — partially dehydrated, most "autunite" in collections is actually this
  - Meta-autunite II — further dehydrated by heating, very rare in nature
- **Special morphologies:** Foliated/scaly aggregates, fan-like masses, crusts with crystals standing on edge (serrated appearance), subparallel growths

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/ambient conditions)
- **Optimal growth temperature:** 15–40°C
- **Decomposition temperature:** Dehydrates to meta-autunite above ~75°C; full structural collapse >200°C
- **Temperature-dependent habits:** No habit change with temperature, but dehydration rate increases dramatically above 40°C

#### Chemistry Required
- **Required elements in broth:** 
  - U (as mobile U⁶⁺ uranyl ion) — from oxidation of uraninite or other primary U minerals
  - Ca — from host rock dissolution (granite, apatite, calcite)
  - P (as PO₄³⁻) — from apatite breakdown, phosphatic host rocks, or groundwater
  - O₂ — oxidizing conditions essential (U⁴⁺ must be oxidized to U⁶⁺ to become mobile)
- **Optional/enhancing elements:** 
  - Ba (can form uranocircite Ba(UO₂)₂(PO₄)₂·12H₂O instead)
  - Mg (can form saleeite Mg(UO₂)₂(PO₄)₂·10H₂O instead)
  - Cu (if Cu > Ca, forms torbernite instead)
  - Al (sabugalite AlH(UO₂)₄(PO₄)₄·16H₂O)
- **Inhibiting elements:** 
  - Reducing agents (S²⁻, organic matter, Fe²⁺) keep U as insoluble U⁴⁺
  - Excess Cu can outcompete Ca for the autunite structure → torbernite forms instead
- **Required pH range:** 4–7 (acidic to neutral; dissolution of primary U minerals is faster at low pH, but phosphate availability is best near neutral)
- **Required Eh range:** Strongly oxidizing (Eh > +0.4V) — U⁶⁺ must be stable
- **Required O₂ range:** High — oxidation zone mineral

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes U⁶⁺, Ca²⁺, and PO₄³⁻ from solution; precipitates water into crystal structure
- **Byproducts of nucleation:** None directly — it's a sink for dissolved species
- **Byproducts of dissolution/decomposition:** Releases U⁶⁺, Ca²⁺, PO₄³⁻ back to solution; dehydration releases structural H₂O to atmosphere

#### Growth Characteristics
- **Relative growth rate:** Fast — autunite is one of the first secondary uranium minerals to form in oxidation zones, often within years of exposure
- **Maximum crystal size:** Up to ~3 cm plates (rare); typically mm-scale
- **Typical crystal size in vugs:** 1–10 mm tabular plates
- **Does growth rate change with temperature?** Faster at higher temps within the stability range, but dehydration risk increases above 40°C
- **Competes with:** Torbernite (if Cu available), saleeite (if Mg dominant), uranocircite (if Ba present), uranophane (if Si available instead of P), carnotite (if V available instead of P)

#### Stability
- **Breaks down in heat?** Yes — dehydrates to meta-autunite I above ~75°C, meta-autunite II with further heating. Most museum specimens are already meta-autunite. Museums seal specimens with lacquer to slow dehydration.
- **Breaks down in light?** No specific photosensitivity, but UV from display lighting can accelerate dehydration slightly
- **Dissolves in water?** Slightly soluble — more soluble than torbernite. Dissolves slowly in groundwater, releasing U⁶⁺
- **Dissolves in acid?** Yes, soluble in acids (HCl, HNO₃) — dissolves readily
- **Oxidizes?** Already fully oxidized (U⁶⁺) — does not oxidize further. Can be reduced back to U⁴⁺ minerals under reducing conditions
- **Dehydrates?** YES — major concern. Loses interlayer water in dry air. Autunite → meta-autunite I → meta-autunite II. Crystal structure partially collapses, loses transparency, becomes opaque/dull. Essentially irreversible in nature.
- **Radiation sensitivity:** Contains its own radiation source (U decay). Over geological time, metamictization can damage crystal structure, but hydration state is more immediately destructive.

### Paragenesis
- **Forms AFTER:** Uraninite (UO₂), apatite (phosphate source), any primary U-bearing mineral. Requires oxidation of U⁴⁺ → U⁶⁺ by groundwater.
- **Forms BEFORE:** Uranophane (if Si enters system), meta-autunite (dehydration product), clinoclase/other late-stage Cu minerals
- **Commonly associated minerals:** Torbernite (Cu analogue), meta-autunite, phosphuranylite, saleeite, uranophane, sabugalite, uraninite (parent), apatite (P source), quartz, limonite
- **Zone:** Supergene oxidation zone — always a secondary mineral
- **Geological environment:** Oxidation zones of uranium deposits, granite pegmatites (where apatite provides P), hydrothermal veins with U mineralization

### Famous Localities
- **Classic locality 1:** Autun, Saône-et-Loire, France — type locality, discovered 1852, named by Brooke & Miller 1854
- **Classic locality 2:** Daybreak Mine, Mount Spokane, Spokane Co., Washington, USA — produced 90,000 lbs U₃O₈; exceptional tabular crystal groups in granitic vugs. Apatite in host rock provided phosphate.
- **Classic locality 3:** Margnac mine, Haute-Vienne, France — Limousin uranium district
- **Other notable:** Bergen, Vogtland, Germany (large crystals); Cornwall, England; Sabugal, Portugal; Mount Painter, South Australia (large crystals); Malacacheta, Minas Gerais, Brazil

### Fluorescence
- **Fluorescent under UV?** YES — famously so. One of the strongest fluorescent minerals.
- **SW (255nm) color:** Bright yellow-green to lime-green — intense
- **MW (310nm) color:** Yellow-green — strong
- **LW (365nm) color:** Yellow-green — strong but slightly less intense than SW
- **Phosphorescent?** Weakly phosphorescent in some specimens
- **Activator:** Uranyl ion (UO₂)²⁺ — intrinsic fluorescence, not trace-element activated. The uranyl ion itself is the chromophore and fluorophore.
- **Quenched by:** Fe²⁺ and Fe³⁺ can suppress fluorescence; dehydration (meta-autunite) weakens but does not eliminate fluorescence

### Flavor Text
> Autunite is what uranium dreams of becoming when it sees the sky. Born deep in the dark as uraninite — compact, black, reduced — it waits for water and oxygen to find it. When they do, U⁴⁺ surrenders an electron, becomes mobile U⁶⁺, and migrates upward through fractures until it meets phosphate in the oxidation zone. There it crystallizes as thin yellow squares that glow an impossible green under UV — the uranyl ion's own light, not a trace impurity but the mineral itself fluorescing. Most specimens in museums have already lost their water, quietly becoming meta-autunite on the shelf. Like remembering a dream hours after waking: the structure collapses, the colors fade, but the radioactivity endures. At 48% uranium by weight, autunite carries its own clock. Every gram ticks with decay. The calcium in the formula is almost an afterthought — if copper had arrived instead, you'd have torbernite, emerald-green and equally radioactive. The autunite group is a family of minerals united by one thing: a uranyl ion that found a partner and lit up.

### Simulator Implementation Notes
- **New parameters needed:** None beyond existing trace_Ca, trace_U, trace_P, oxidation state, temperature, humidity
- **New events needed:** 
  - Dehydration event: if humidity < threshold or T > 75°C, convert autunite → meta-autunite (visual change: transparent → opaque, fluorescence dims)
- **Nucleation rule pseudocode:**
```
IF trace_Ca > 0 AND trace_U > 0 AND trace_P > 0 
   AND Eh > 0.4 (oxidizing)
   AND T < 50°C
   AND trace_Ca > trace_Cu  // Ca dominates over Cu, else torbernite
   → nucleate autunite
```
- **Growth rule pseudocode:**
```
IF σ_autunite > 1 
   AND T < 50°C
   AND Eh > 0.4
   → grow at rate FAST (autunite forms readily)
   Growth rate ∝ [U⁶⁺] × [Ca²⁺] × [PO₄³⁻]
```
- **Habit selection logic:** 
  - Always tabular {001} — no significant habit variation
  - Thin plates at low supersaturation, thicker plates at higher σ
  - Scaly/crustose aggregates when nucleation rate is very high
- **Decomposition products:** 
  - Dehydration: autunite → meta-autunite I → meta-autunite II (loses water, structure collapses partially)
  - Dissolution: releases U⁶⁺ + Ca²⁺ + PO₄³⁻ back to fluid
  - Reduction (if Eh drops): U⁶⁺ → U⁴⁺, potentially re-forming uraninite or other reduced U minerals

### Variants for Game
- **Variant 1: Meta-autunite** — dehydration product, opaque/dull yellow, weaker fluorescence. Triggers when humidity drops or specimen stored too long. The "ghost" of autunite.
- **Variant 2: Ca-dominant autunite** (normal) vs **Cu-contaminated autunite** — slight greenish tint if Cu is present but Ca dominates; transitional toward torbernite
- **Variant 3: Crustose autunite** — rapid nucleation produces scaly crusts rather than distinct crystals; lower aesthetic value but faster formation

### Paragenetic Sequence: Autunite Group in Oxidation Zone
Autunite is part of the **autunite group** — a family of uranyl phosphates that form in the same oxidation-zone environment, differentiated by which cation accompanies the uranyl phosphate:
- **Autunite** Ca(UO₂)₂(PO₄)₂·11H₂O — Ca-dominant (this mineral)
- **Torbernite** Cu(UO₂)₂(PO₄)₂·12H₂O — Cu-dominant (already in game)
- **Saleeite** Mg(UO₂)₂(PO₄)₂·10H₂O — Mg-dominant
- **Uranocircite** Ba(UO₂)₂(PO₄)₂·12H₂O — Ba-dominant
- **Sabugalite** AlH(UO₂)₄(PO₄)₄·16H₂O — Al-dominant

All require: oxidizing conditions, U⁶⁺ from uraninite oxidation, PO₄ from apatite/rock dissolution. The cation ratio determines which species forms. This is a **direct substitution series** — the simulator should pick the species based on which cation (Ca, Cu, Mg, Ba) has the highest concentration relative to the others.
