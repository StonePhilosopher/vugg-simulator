# Mineral Species Research — Arsenopyrite

## Species: Arsenopyrite

### Identity
- **Formula:** FeAsS
- **Crystal system:** Monoclinic (space group P2₁/c)
- **Mineral group:** Sulfide (arsenide-sulfide)
- **Hardness (Mohs):** 5.5–6
- **Specific gravity:** 5.9–6.2
- **Cleavage:** {110} distinct
- **Fracture:** Subconchoidal to rough
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Steel grey to silver white
- **Color causes:** Inherent metallic luster from Fe-As-S bonding
- **Transparency:** Opaque
- **Streak:** Black
- **Notable visual features:** Strong anisotropism (red-violet under crossed polars). Striations on prism faces. Weathered surfaces develop greenish tinge from secondary arsenates. Emits garlic odor when struck (arsenic volatilization).

### Crystal Habits
- **Primary habit:** Prismatic (off-square prisms), acicular needles
- **Common forms/faces:** Striated prisms, stubby to elongated along c-axis
- **Twin laws:** Common on {100} and {001}; contact/penetration twinning on {101}
- **Varieties:** Co-bearing arsenopyrite (up to 9 wt% Co transitions to glaucodot); gold-bearing ("refractory gold" locked in crystal structure)
- **Special morphologies:** Compact massive, granular, columnar aggregates

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 300–500°C (hydrothermal)
- **Optimal growth temperature:** 350–450°C
- **Decomposition temperature:** ~700°C (releases S + As vapor)
- **Temperature-dependent habits:** Higher T → acicular/needle-like; lower T → stubby prisms. Gold-rich zones preferentially form at 400–500°C.

#### Chemistry Required
- **Required elements in broth:** Fe, As, S — all must be present. As can substitute partially for S (arsenian pyrite series).
- **Optional/enhancing elements:** Co (substitutes for Fe, up to 9 wt%), Ni (minor), Au (trace, "invisible gold" in lattice), Sb (toward gudmundite).
- **Inhibiting elements:** High O₂ suppresses formation (arsenopyrite is reducing)
- **Required pH range:** Neutral to slightly acidic (pH 3–7)
- **Required Eh range:** Reducing (negative Eh)
- **Required O₂ range:** Very low — strict anaerobic/reducing conditions

#### Secondary Chemistry Release
- **When forming:** Consumes Fe, As, S from solution
- **When oxidizing:** FeAsS + O₂ + H₂O → FeAsO₄·2H₂O (scorodite) + H₂SO₄ — releases sulfuric acid, forms iron arsenates. Also can produce limonite + arsenic acid.
- **Byproducts of dissolution:** In nitric acid, releases elemental sulfur. In air oxidation, releases As into groundwater (environmental hazard).

#### Growth Characteristics
- **Relative growth rate:** Moderate — slower than pyrite, faster than galena
- **Maximum crystal size:** To ~15 cm prismatic crystals; exceptional aggregates to 30+ cm
- **Typical crystal size in vugs:** 1–8 cm
- **Does growth rate change with temperature?** Faster at higher T; needle habit at high T suggests rapid elongation
- **Competes with:** Pyrite (FeS₂, same Fe+S source), loellingite (FeAs₂, As-dominant end member), marcasite

#### Stability
- **Breaks down in heat?** Yes, ~700°C releases sulfur and arsenic vapor
- **Breaks down in light?** No
- **Dissolves in water?** Very slow in neutral water; accelerates in acidic conditions
- **Dissolves in acid?** Nitric acid readily; sulfuric acid slowly
- **Oxidizes?** Yes — weathering converts to scorodite, limonite, pharmacosiderite, arseniosiderite. Green staining on wall rocks is diagnostic.
- **Radiation sensitivity:** Not significant

### Paragenesis
- **Forms AFTER:** Early pyrite, pyrrhotite (arsenopyrite is typically mid-stage hydrothermal)
- **Forms BEFORE:** Chalcopyrite, galena, sphalerite (later-stage sulfides deposit on/after arsenopyrite); scorodite (oxidation product)
- **Commonly associated minerals:** Pyrite, pyrrhotite, chalcopyrite, galena, sphalerite, quartz, calcite, siderite, gold (invisible and free-milling), cobaltite, stannite
- **Zone:** Primary/hypogene (mesothermal to high-temperature hydrothermal)
- **Geological environment:** Hydrothermal veins, pegmatites, contact metamorphic zones, mesothermal gold deposits, skarns

### Famous Localities
- **Classic locality 1:** Yaogangxian Mine, Hunan, China — superb prismatic crystals to 15 cm
- **Classic locality 2:** Panasqueira, Portugal — large striated prisms with cassiterite, chalcopyrite
- **Classic locality 3:** Freiberg, Saxony, Germany — historic type locality area
- **Notable specimens:** Gold Hill, Utah (gold-bearing); Bou Azzer, Morocco (Co-rich); Bendigo, Australia (gold indicator)

### Fluorescence
- **Fluorescent under UV?** No (metallic/opaque minerals do not fluoresce)

### Flavor Text

> Arsenopyrite carries a secret: it smells like garlic when you break it. That's arsenic escaping — a warning from the deep. This is the mineral that traps gold in its crystal lattice, invisible to the eye, refusing to give it up without a fight. In hydrothermal veins it stands like silver soldiers, striated and sharp, marking the zone where the fluid cooled enough for iron and arsenic to lock arms. When air finally reaches it, it greens — scorodite and limonite blooming on its surface like moss on a tombstone. The gold miners called it "mispickel" and cursed it. But in a vug, those striated prisms are something to admire — even if they'd rather not be disturbed.

### Simulator Implementation Notes
- **New parameters needed:** trace_As already tracked. Need to ensure Fe+S+As co-availability check.
- **New events needed:** None special — standard nucleation
- **Nucleation rule pseudocode:**
```
IF temp >= 300 AND temp <= 500 AND reducing AND trace_Fe > threshold AND trace_As > threshold AND trace_S > threshold → nucleate arsenopyrite
```
- **Growth rule pseudocode:**
```
IF temp >= 300 AND reducing AND σ_arsenopyrite > 1 → grow at rate proportional to σ
IF temp > 450 → acicular habit preference
IF temp < 350 → stubby habit preference
```
- **Habit selection logic:** Temperature-driven: >450°C → acicular/needle; 300-450°C → prismatic/stubby. Co content → slight color shift.
- **Decomposition products:** Oxidation → scorodite (FeAsO₄·2H₂O) + sulfuric acid. Heating → sulfur + arsenic vapor.

### Variants for Game
- **Variant 1: Gold-bearing arsenopyrite** — trace Au > threshold. Striker text: "This one holds gold you can't see." Higher specific gravity.
- **Variant 2: Cobaltian arsenopyrite** — Co substitutes for Fe (up to 9%). Slightly pinkish metallic tint. Precursor to erythrite if oxidized.
- **Variant 3: Acicular arsenopyrite** — High-temperature habit (>450°C). Needle-like clusters, striated. "Silver needles in the dark."

---

## Paragenetic Sequence: Arsenopyrite → Scorodite

Arsenopyrite is the **primary hypogene sulfide** that forms in reducing hydrothermal conditions (300-500°C). When exposed to oxygenated water at the surface or in oxidation zones, it breaks down to form **scorodite** (FeAsO₄·2H₂O), a hydrated iron arsenate. This is one of the most important arsenic sequestration minerals in gossans and mine tailings.

The full oxidation sequence: **Arsenopyrite → Scorodite → (pharmacosiderite, arseniosiderite) → Limonite**

In the simulator, arsenopyrite should be the primary Fe-As sulfide. When conditions shift to oxidizing (positive Eh, low T), any arsenopyrite present should gradually convert to scorodite, releasing sulfuric acid into the fluid.

See also: `memory/research-scorodite.md` for the oxidation product.
