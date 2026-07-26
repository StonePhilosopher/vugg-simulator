# Mineral Species: Erythrite — Vugg Simulator

### Identity
- **Formula:** Co₃(AsO₄)₂·8H₂O
- **Crystal system:** Monoclinic
- **Mineral group:** Arsenate (vivianite group)
- **Hardness (Mohs):** 1.5–2.5
- **Specific gravity:** 3.06
- **Cleavage:** Perfect on {010}; poor on {100} and {102}
- **Fracture:** Sectile
- **Luster:** Subadamantine, pearly on cleavages

### Color & Appearance
- **Typical color:** Crimson to peach-red, pale rose, pink; may be zoned
- **Color causes:** Co²⁺ (cobalt chromophore — d-d transitions give pink/red)
- **Transparency:** Transparent to translucent
- **Streak:** Pale red to pink
- **Notable visual features:** Pleochroic (pale pinkish → deep red). "Cobalt bloom" — vivid pink crusts that prospectors used as a guide to Co-Ag ore.

### Crystal Habits
- **Primary habit:** Acicular to bladed prismatic crystals; commonly fibrous, drusy, powdery massive
- **Common forms/faces:** Striated prisms, radiating aggregates, stellate clusters
- **Twin laws:** None notable
- **Varieties:** Cabrerite (Mg-bearing intermediate with annabergite series)
- **Special morphologies:** Botryoidal crusts, earthy coatings, reniform aggregates. Well-formed crystals rare — usually microcrystalline encrustations.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/weathering zone)
- **Optimal growth temperature:** 10–30°C (ambient surface conditions)
- **Decomposition temperature:** ~200°C (loses water, dehydrates to anhydrous phase)
- **Temperature-dependent habits:** No significant habit variation; always low-T supergene

#### Chemistry Required
- **Required elements in broth:** Co (cobalt) — primary; As (arsenic) — from oxidation of primary arsenides
- **Optional/enhancing elements:** Ni (substitutes for Co → annabergite solid solution); Zn (→ köttigite); Mg (→ hörnesite); Fe (→ parasymplesite)
- **Inhibiting elements:** High Fe²⁺ favors parasymplesite over erythrite
- **Required pH range:** 5–8 (neutral to slightly acidic, typical of oxidizing arsenide deposits)
- **Required Eh range:** Oxidizing — As³⁻ must be oxidized to AsO₄³⁻
- **Required O₂ range:** High — supergene oxidation zone requires atmospheric O₂

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Formation consumes Co²⁺ and AsO₄³⁻ from solution; no release
- **Byproducts of nucleation:** None notable
- **Byproducts of dissolution/decomposition:** Releases Co²⁺ and arsenate into solution; dehydration products at elevated T

#### Growth Characteristics
- **Relative growth rate:** Fast — forms readily as secondary coating
- **Maximum crystal size:** Rare crystals to ~5 cm; typically mm-scale crusts
- **Typical crystal size in vugs:** Microcrystalline crusts to 1–2 mm fibrous aggregates
- **Does growth rate change with temperature?** Minimal — always low-T
- **Competes with:** Annabergite (Ni equivalent), scorodite (Fe arsenate), pharmacosiderite, adamite

#### Stability
- **Breaks down in heat?** Yes — dehydrates ~200°C
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble
- **Dissolves in acid?** Yes — dissolves readily in HCl, HNO₃
- **Oxidizes?** Already fully oxidized (supergene)
- **Dehydrates?** Yes — to anhydrous Co₃(AsO₄)₂ at elevated temperature
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Primary Co-arsenide minerals (cobaltite CoAsS, skutterudite CoAs₃, safflorite CoAs₂)
- **Forms BEFORE:** May alter further to cobalt oxides/hydroxides (asbolane)
- **Commonly associated minerals:** Cobaltite, skutterudite, scorodite, pharmacosiderite, adamite, annabergite, roselite, malachite
- **Zone:** Supergene/oxidation zone (weathering of primary arsenide deposits)
- **Geological environment:** Oxidized zones of Co-Ni-Ag arsenide vein deposits

### Famous Localities
- **Bou Azzer, Morocco** — world's best erythrite specimens; brilliant pink crystals to several cm on quartz/calcite matrix
- **Schneeberg, Saxony, Germany** — type locality; historic Co-Ag mining district
- **Cobalt, Ontario, Canada** — Co-Ag veins with spectacular erythrite blooms
- **Jáchymov (Joachimsthal), Czech Republic** — historic locality
- **Notable specimens:** Bou Azzer produces the finest crystallized erythrite known — vivid crimson blades to 5+ cm

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None reported
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text

> Erythrite is the prospector's rose — a vivid pink bloom that leaks from weathered cobalt arsenide veins like blood from stone. It needs no geology degree to spot: if the rock bleeds crimson dust, follow it to silver. Soft as a fingernail and rarely crystallized, it's a mineral of surfaces and whispers, a supergene ghost of whatever dark arsenide once lived below. Its color is pure cobalt — the same chromophore that turns glass blue and pottery pigment. In the vivianite group's family tree, erythrite is the pink branch; its nickel twin annabergite is the green. Between them, every shade of mauve.

### Simulator Implementation Notes
- **New parameters needed:** trace_Co (cobalt) — may already exist as Co in trace elements list. Need As³⁻ → AsO₄³⁻ oxidation tracking.
- **New events needed:** `event_arsenide_oxidation` — when primary arsenides (cobaltite, skutterudite) weather in oxidizing conditions, release Co²⁺ and AsO₄³⁻
- **Nucleation rule pseudocode:**
```
IF trace_Co > threshold AND arsenate_available AND temperature < 50°C AND Eh > oxidizing_threshold
  → nucleate erythrite
```
- **Growth rule pseudocode:**
```
IF erythrite_present AND trace_Co > 0 AND arsenate_available
  → grow at rate proportional to [Co²⁺][AsO₄³⁻]
```
- **Habit selection logic:** If Co is dominant with some Ni → erythrite with pink color. If Ni approaches or exceeds Co → annabergite instead. Zoning possible (pink core, green rim if Ni increases during growth).
- **Decomposition products:** Dehydration → anhydrous Co₃(AsO₄)₂ at ~200°C. Dissolution → releases Co²⁺ and AsO₄³⁻ back to solution.

### Variants for Game
- **Variant 1: Cobalt Bloom** — classic pink earthy crust, powdery. Most common form. Low supersaturation.
- **Variant 2: Crystallized Erythrite** — rare bladed prismatic crystals. Requires higher supersaturation + slow growth + nucleation sites (quartz/calcite substrate).
- **Variant 3: Cabrerite** — Mg-bearing intermediate. Pinkish-green. Requires trace_Mg in addition to Co.

---

## Linked Paragenetic Sequence: Co-Ni Arsenate Supergene Zone

Primary arsenides (cobaltite, skutterudite, nickeline) → weathering in oxidizing conditions → releases Co²⁺, Ni²⁺, AsO₄³⁻ into solution → precipitates as:
- **Erythrite** (Co-dominant) — pink to crimson
- **Annabergite** (Ni-dominant) — apple-green
- **Köttigite** (Zn-dominant) — colorless to pale blue
- **Hörnesite** (Mg-dominant) — white to pale pink
- **Parasymplesite** (Fe-dominant) — dark blue-green

These form a complete solid solution series. Intermediate compositions are common. See `memory/research-annabergite.md` for the Ni end-member.
