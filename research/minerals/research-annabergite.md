# Mineral Species: Annabergite — Vugg Simulator

### Identity
- **Formula:** Ni₃(AsO₄)₂·8H₂O
- **Crystal system:** Monoclinic
- **Mineral group:** Arsenate (vivianite group)
- **Hardness (Mohs):** 1.5–2.5
- **Specific gravity:** 3.07
- **Cleavage:** Perfect on {010}; indistinct on {100} and {102}
- **Fracture:** Sectile
- **Luster:** Subadamantine, pearly on cleavages; may be dull or earthy

### Color & Appearance
- **Typical color:** Apple-green, pale green; may be pale rose/pink if Co-bearing; white, gray
- **Color causes:** Ni²⁺ (nickel chromophore — gives green); Co substitution shifts toward pink/rose
- **Transparency:** Transparent to translucent
- **Streak:** Pale green to white
- **Notable visual features:** "Nickel bloom" — green encrustations on weathered nickel arsenide ore. Pearly luster on cleavage surfaces. May be zoned (green to pink if Co varies during growth).

### Crystal Habits
- **Primary habit:** Fibrous veinlets, crystalline crusts, earthy masses
- **Common forms/faces:** Rare well-formed crystals are capillary (hair-like) to bladed; usually microcrystalline
- **Twin laws:** None notable
- **Varieties:** Cabrerite (Mg-bearing); Dudgeonite (Ca-bearing, from Creetown, Scotland)
- **Special morphologies:** Radiating fibrous aggregates, earthy coatings, botryoidal crusts. Well-developed crystals extremely rare and minute.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/weathering zone)
- **Optimal growth temperature:** 10–30°C (ambient surface conditions)
- **Decomposition temperature:** ~200°C (dehydrates to anhydrous phase)
- **Temperature-dependent habits:** No significant variation — always low-T supergene

#### Chemistry Required
- **Required elements in broth:** Ni (nickel) — primary; As (arsenic) — from oxidation of primary arsenides
- **Optional/enhancing elements:** Co (substitutes for Ni → erythrite solid solution); Mg (→ hörnesite/cabrerite); Zn (→ köttigite); Ca (→ dudgeonite variety)
- **Inhibiting elements:** High Co²⁺ favors erythrite over annabergite; high Fe²⁺ favors parasymplesite
- **Required pH range:** 5–8 (neutral to slightly acidic)
- **Required Eh range:** Oxidizing — As³⁻ must be oxidized to AsO₄³⁻
- **Required O₂ range:** High — supergene oxidation zone requires atmospheric O₂

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Formation consumes Ni²⁺ and AsO₄³⁻; no release
- **Byproducts of nucleation:** None notable
- **Byproducts of dissolution/decomposition:** Releases Ni²⁺ and arsenate into solution

#### Growth Characteristics
- **Relative growth rate:** Fast — forms readily as secondary coating
- **Maximum crystal size:** Crystals rarely exceed 1 cm; usually sub-mm
- **Typical crystal size in vugs:** Microcrystalline crusts, fibrous aggregates to 1–2 mm
- **Does growth rate change with temperature?** Minimal — always low-T
- **Competes with:** Erythrite (Co equivalent), scorodite (Fe arsenate), retgersite (NiSO₄·6H₂O), morenosite (NiSO₄·7H₂O)

#### Stability
- **Breaks down in heat?** Yes — dehydrates ~200°C
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble
- **Dissolves in acid?** Yes — dissolves readily in acids
- **Oxidizes?** Already fully oxidized (supergene)
- **Dehydrates?** Yes — to anhydrous Ni₃(AsO₄)₂ at elevated temperature
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Primary Ni-arsenide minerals (nickeline NiAs, gersdorffite NiAsS, rammelsbergite NiAs₂)
- **Forms BEFORE:** May alter further to nickel oxides/hydroxides (nickel bloom → garnierite in tropical weathering)
- **Commonly associated minerals:** Nickeline, gersdorffite, erythrite, scorodite, retgersite, morenosite, pharmacosiderite
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized zones of Ni-Co-As bearing vein deposits; nickel laterite profiles

### Famous Localities
- **Annaberg-Buchholz, Saxony, Germany** — type locality (named 1852)
- **Lavrion (Laurium), Greece** — famous for green annabergite on siderite matrix
- **Bou Azzer, Morocco** — produces both erythrite and annabergite; world-class Co-Ni arsenide district
- **Cobalt, Ontario, Canada** — Ni-Co-Ag veins with both erythrite and annabergite
- **Notable specimens:** Lavrion specimens show vivid apple-green microcrystals on matrix; highly sought by collectors

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None reported
- **MW (310nm) color:** None reported
- **LW (365nm) color:** None reported
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text

> Annabergite is the green shadow of nickel arsenide ore — a soft, apple-green crust that blooms where nickeline and gersdorffite meet rain and air. It's the nickel twin of erythrite's crimson rose, and the two often share the same vein, one pink and one green, painting the oxidation zone in pastel warning signs. The color shifts are a chemical thermometer: pure nickel gives green, cobalt intrusion turns it rose, and the intermediates read like a gradient of ore composition. Collectors prize the Lavrion specimens — tiny green fibers perched on dark siderite, like moss on iron. Soft enough to scratch with a fingernail, annabergite is a mineral that doesn't survive handling. It's a surface phenomenon, a whisper of what lies below.

### Simulator Implementation Notes
- **New parameters needed:** trace_Ni (nickel) — already in trace elements list. Same As³⁻ → AsO₄³⁻ oxidation as erythrite.
- **New events needed:** Shared with erythrite — `event_arsenide_oxidation`. If primary mineral is nickeline/gersdorffite → annabergite. If cobaltite/skutterudite → erythrite. If both → intermediate.
- **Nucleation rule pseudocode:**
```
IF trace_Ni > threshold AND arsenate_available AND temperature < 50°C AND Eh > oxidizing_threshold
  → nucleate annabergite
```
- **Growth rule pseudocode:**
```
IF annabergite_present AND trace_Ni > 0 AND arsenate_available
  → grow at rate proportional to [Ni²⁺][AsO₄³⁻]
  IF trace_Co also present → mix color toward pink (solid solution with erythrite)
```
- **Habit selection logic:** Ni-dominant → annabergite (green). Co-dominant → erythrite (pink). Mixed → color interpolation. If Mg present → cabrerite variant.
- **Decomposition products:** Dehydration → anhydrous Ni₃(AsO₄)₂ at ~200°C. Dissolution → releases Ni²⁺ and AsO₄³⁻.

### Variants for Game
- **Variant 1: Nickel Bloom** — classic apple-green earthy crust. Most common form. Low supersaturation.
- **Variant 2: Crystallized Annabergite** — rare capillary/fibrous crystals. Higher supersaturation + slow growth.
- **Variant 3: Cabrerite** — Mg-bearing intermediate. Pale green to white. Requires trace_Mg.
- **Variant 4: Co-bearing Annabergite** — pinkish-green to mauve intermediate with erythrite. Requires trace_Co.

---

## Implementation Note: Erythrite-Annabergite Solid Solution

These two minerals should share a single `supersaturation_vivianite_group()` function with a Co/Ni ratio parameter:

```
σ_erythrite = f(trace_Co, arsenate, temperature)
σ_annabergite = f(trace_Ni, arsenate, temperature)
```

The mineral that nucleates is whichever has higher σ (Co-rich → erythrite, Ni-rich → annabergite). Crystal color interpolates between pink (Co) and green (Ni) based on the ratio. This is a rare case where two mineral species should be implemented as a single code path with compositional branching.

Other vivianite group members (köttigite Zn, hörnesite Mg, parasymplesite Fe) can be added later as the same function expands.
