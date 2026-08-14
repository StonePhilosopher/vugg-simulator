# Mineral Species Research — Scorodite

## Species: Scorodite

### Identity
- **Formula:** FeAsO₄·2H₂O
- **Crystal system:** Orthorhombic (space group Pcab)
- **Mineral group:** Arsenate (hydrated)
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 3.27–3.30
- **Cleavage:** Poor/indistinct
- **Fracture:** Subconchoidal
- **Luster:** Sub-adamantine to vitreous, sometimes resinous

### Color & Appearance
- **Typical color:** Green, blue-green, grayish-green; also blue, yellow-brown, nearly colorless, violet
- **Color causes:** Fe³⁺ in tetrahedral coordination; color varies with degree of hydration and trace impurities. Violet/blue from slightly different Fe³⁺ site geometry.
- **Transparency:** Translucent
- **Streak:** Greenish-white
- **Notable visual features:** Sub-adamantine luster gives bright, almost gemmy appearance in good crystals. Strong dispersion. Color zoning common — blue cores with green rims or vice versa.

### Crystal Habits
- **Primary habit:** Dipyramidal (pseudo-octahedral), tabular
- **Common forms/faces:** Dipyramids {111}, {112}; sometimes pseudo-cubic from combination of forms
- **Twin laws:** Not common
- **Varieties:** Color variants (blue scorodite, green scorodite) based on hydration state and impurities
- **Special morphologies:** Botryoidal, encrustations, earthy masses, druzy coatings on gossan

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 20–100°C (supergene/low-T hydrothermal)
- **Optimal growth temperature:** 40–80°C
- **Decomposition temperature:** ~160°C dehydrates to anhydrous FeAsO₄ (then to hematite + As₂O₅ at higher T)
- **Temperature-dependent habits:** Lower T → botryoidal/earthy; higher T → well-formed dipyramidal crystals

#### Chemistry Required
- **Required elements in broth:** Fe³⁺, As(V) as arsenate, H₂O
- **Optional/enhancing elements:** P (can substitute for As in small amounts, toward strengite FePO₄·2H₂O series)
- **Inhibiting elements:** High S²⁻ (reducing conditions dissolve scorodite back to sulfides)
- **Required pH range:** Acidic to neutral (pH 1.5–5); optimally pH 2–4
- **Required Eh range:** Oxidizing (positive Eh) — requires As to be oxidized from As³⁻ to As⁵⁺
- **Required O₂ range:** High — supergene oxidation zone mineral

#### Secondary Chemistry Release
- **When forming:** Consumes Fe³⁺ and AsO₄³⁻ from solution. Slightly acid-consuming (buffers pH upward).
- **When dissolving:** Releases Fe³⁺ and arsenic acid (H₃AsO₄) — environmental hazard. Scorodite is the most stable arsenic-bearing phase under oxidizing acidic conditions, so it actually *sequesters* arsenic.
- **Byproducts of decomposition (heat):** Loses water → anhydrous FeAsO₄ → hematite + As₂O₅

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast (supergene minerals grow faster than hypogene)
- **Maximum crystal size:** To ~5 cm dipyramids (rare); typically 0.5–3 cm
- **Typical crystal size in vugs:** 1–10 mm druzy coatings
- **Does growth rate change with temperature?** Faster at moderate temperatures (40-80°C)
- **Competes with:** Pharmacosiderite (K,Fe arsenate), arseniosiderite (Ca-Fe arsenate), jarosite (if K available), limonite (amorphous Fe-oxyhydroxide). Scorodite wins under acidic, low-K, low-Ca conditions.

#### Stability
- **Breaks down in heat?** Yes — dehydrates ~160°C, decomposes fully >300°C
- **Breaks down in light?** No
- **Dissolves in water?** Slowly — relatively stable under acidic oxidizing conditions (Ksp ~10⁻²⁰). Dissolves faster in alkaline conditions.
- **Dissolves in acid?** Stable in dilute acid; dissolves in HCl/HNO₃
- **Oxidizes?** Already fully oxidized — this IS the oxidation product. Further weathering → limonite (FeOOH) + dissolved arsenate.
- **Dehydrates?** Yes — to amorphous FeAsO₄ on heating or prolonged arid conditions
- **Radiation sensitivity:** Not significant

### Paragenesis
- **Forms AFTER:** Arsenopyrite (primary source), arsenical pyrite, loellingite
- **Forms BEFORE:** Limonite, jarosite (later-stage oxidation); pharmacosiderite (if K available)
- **Commonly associated minerals:** Arsenopyrite (parent), limonite, quartz, jarosite, pharmacosiderite, arseniosiderite, cerussite, anglesite, cerargyrite
- **Zone:** Supergene oxidation zone (gossan)
- **Geological environment:** Oxidized portions of arsenic-bearing sulfide deposits, gossans, mine tailings, hydrothermal oxidation zones

### Famous Localities
- **Classic locality 1:** Schwarzenberg, Saxony, Germany — type locality
- **Classic locality 2:** Tsumeb, Namibia — superb blue-green dipyramidal crystals
- **Classic locality 3:** Bou Azzer, Morocco — associated with erythrite, cobalt minerals
- **Notable specimens:** Mapimi, Durango, Mexico (blue crystals); Gold Hill, Utah

### Fluorescence
- **Fluorescent under UV?** Not typically fluorescent

### Flavor Text

> Scorodite is what happens when arsenopyrite meets the air. The sharp silver soldier dissolves into something softer — dipyramidal crystals in green and blue, translucent, almost gemmy. The Greeks named it *skorodion*, "garlicky," because it still carries the ghost of arsenic's smell when heated. In gossans it forms druzy crusts over rusted pyrite, a coat of green-blue armor sealing arsenic away from the water table. It's an environmental hero in mineral form: the most stable way to lock arsenic underground. But give it alkaline water and it lets go, releasing the poison back into solution. Scorodite is a promise kept only under the right conditions — much like most promises.

### Simulator Implementation Notes
- **New parameters needed:** None — uses existing Fe, As, O₂, H₂O
- **New events needed:** `event_arsenopyrite_oxidation` — when Eh goes positive and T < 100°C, convert arsenopyrite → scorodite + H₂SO₄
- **Nucleation rule pseudocode:**
```
IF temp < 100 AND oxidizing (Eh > 0) AND pH < 5 AND trace_Fe > threshold AND trace_As > threshold AND σ_scorodite > 1 → nucleate scorodite
BONUS: IF arsenopyrite crystals present in vug → auto-generate σ from oxidation
```
- **Growth rule pseudocode:**
```
IF oxidizing AND temp < 100 AND σ_scorodite > 1 → grow at moderate rate
IF temp > 80 → dipyramidal habit
IF temp < 40 → botryoidal/earthy habit
```
- **Habit selection logic:** Temperature: >60°C → well-formed dipyramidal crystals; <40°C → botryoidal/crustiform. As concentration → color: high As → deeper blue-green.
- **Decomposition products:** Heat → anhydrous FeAsO₄ → hematite + As₂O₅. Alkaline dissolution → dissolved arsenate + Fe(OH)₃.

### Variants for Game
- **Variant 1: Blue scorodite** — Higher Fe³⁺/lower hydration. "The gossan sapphire." Sub-adamantine, gemmy blue dipyramids.
- **Variant 2: Green scorodite** — Standard, more hydrated. Duller green crusts and druzy.
- **Variant 3: Crystallized scorodite on arsenopyrite** — Oxidation zone pair. Scorodite perched on weathered arsenopyrite matrix. The before-and-after in one specimen.

---

## Paragenetic Link

Scorodite is the direct **oxidation product** of arsenopyrite. In the simulator, this should be implemented as a conversion event:

**Arsenopyrite + O₂ + H₂O → Scorodite + H₂SO₄** (at T < 100°C, pH < 5, oxidizing Eh)

This makes scorodite an important marker of the oxidation front in the vug — it can only form when primary arsenopyrite is exposed to oxygenated waters. The released H₂SO₄ acidifies the fluid, potentially driving further sulfide dissolution.

See also: `memory/research-arsenopyrite.md` for the parent mineral.
