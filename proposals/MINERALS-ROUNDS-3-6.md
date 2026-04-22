# Mineral Expansion Rounds 3–6 — Builder Spec

**Template reference:** `proposals/vugg-mineral-template.md` — every mineral must declare every template field (null if N/A).
**Minerals.json is source of truth.** Sync `docs/data/minerals.json` after changes. Run `tools/sync-spec.js`.
**Round 2** (erythrite, annabergite, tetrahedrite, tennantite, apophyllite, marcasite, wurtzite) is spec'd separately in `proposals/MINERALS-ROUND-2.md`.

After Round 2 completes: **47 minerals**. These rounds add **22 more** → **69**.

**Available FluidChemistry fields:** SiO₂, Ca, CO₃, F, Zn, S, Fe, Mn, Al, Ti, Pb, Cu, Mo, U, Na, K, Mg, Ba, Sr, Cr, P, As, Cl, V, W, Ag, Sb, Bi, O₂ + Co, Ni (added in Round 2)

No new elements needed for these rounds. Everything listed below uses existing broth fields.

---

## Round 3: Carbonates (4 minerals)

Share CO₃ supersaturation mechanics. Natural paragenetic group — all form from carbonate-rich fluids.

### 3a. Aragonite — CaCO₃
**Class:** Carbonate (#eb7f13) | **System:** Orthorhombic | **Collection:** 11 specimens
- Polymorph of calcite. Nucleates at higher T or in presence of Sr/Ba/Pb (which inhibit calcite).
- **Temperature:** >60°C favors aragonite over calcite. Below ~60°C calcite wins.
- **pH:** 7–9
- **Consumes:** Ca, CO₃
- **Habits:** acicular_needle (high σ, fast), twinned_cyclic (moderate σ — "cyclic twinned aragonite" is iconic), columnar (default), flos_ferri (iron-rich, dendritic)
- **Key mechanic:** Aragonite ↔ calcite polymorph gate. If T < 60 AND no Sr/Ba/Pb → calcite nucleates instead. Over geological time, aragonite → calcite (pseudomorph).
- **Inclusions:** Can host hematite (acicular needles = "flos ferri" iron flower variety), lead minerals.
- **Notable:** Professor has aragonite with cerussite on gossan (TN496 — chondrodite on aragonite), aragonite pseudomorphs.

### 3b. Siderite — FeCO₃
**Class:** Carbonate (#eb7f13) | **System:** Trigonal (rhombohedral) | **Collection:** 3 specimens
- Iron carbonate. Forms in reducing conditions where Fe²⁺ is soluble.
- **Temperature:** 50–300°C (wide range, hydrothermal to sedimentary)
- **pH:** 5–8
- **Eh:** Reducing (low O₂ — Fe²⁺ must stay in solution)
- **Consumes:** Fe, CO₃
- **Habits:** rhombohedral (default — "curved rhombs" are diagnostic), scalenohedral (high σ), botryoidal (fast growth, colloidal), spherulitic (spherosiderite)
- **Key mechanic:** Oxidation instability. Siderite + O₂ → goethite/limonite (pseudomorph). In the simulator, rising Eh should dissolve siderite and release Fe + CO₃.
- **Competes with:** Calcite (Ca-rich fluids), rhodochrosite (Mn-rich fluids)
- **Color:** Tan to brown, yellowish-brown, gray-brown. Deeper brown with higher Fe.

### 3c. Rhodochrosite — MnCO₃
**Class:** Carbonate (#eb7f13) | **System:** Trigonal (rhombohedral) | **Collection:** 35 specimens (most collected mineral not yet in game!)
- Manganese carbonate. The pink/red mineral. Professor has 35 of these.
- **Temperature:** 50–250°C (epithermal to hydrothermal)
- **pH:** 5–8
- **Eh:** Moderate (Mn²⁺ stable in reducing-to-moderate conditions)
- **Consumes:** Mn, CO₃
- **Habits:** rhombohedral (default — curved "button" rhombs are iconic), scalenohedral (high σ), stalactitic (drip environments, like the famous Capillitas specimens), banding_agate (low σ, rhythmic precipitation)
- **Key mechanic:** Rhodochrosite ↔ calcite solid solution. Mn/Ca ratio determines which nucleates. Pure Mn → rhodochrosite (pink), pure Ca → calcite, mixed → kutnohorite (CaMn carbonate).
- **Color:** Pink to rose-red (Mn²⁺ chromophore). Banding common (alternating Mn/Ca layers).
- **Competes with:** Calcite, siderite, kutnohorite
- **Dissolution:** Oxidation → Mn oxide (pyrolusite/psilomelane). Rhodochrosite + O₂ → black Mn oxide staining.
- **Inclusions:** Can host pyrite, galena, sphalerite (common in epithermal veins)

### 3d. Dolomite — CaMg(CO₃)₂
**Class:** Carbonate (#eb7f13) | **System:** Trigonal | **Collection:** 7 specimens
- Calcium-magnesium carbonate. "Dolomite" = ordered Ca-Mg layers.
- **Temperature:** >50°C (dolomite rarely forms at surface temperature — most is diagenetic)
- **pH:** 7–10 (alkaline favors dolomite over calcite)
- **Consumes:** Ca, Mg, CO₃
- **Habits:** saddle_rhomb (default — curved rhombs with "saddle" shape, diagnostic), massive (low σ), coarse_rhomb (slow growth, high T)
- **Key mechanic:** Mg/Ca ratio gate. Mg must be present at ~1:1 with Ca. If Mg low → calcite instead. If Ca low → magnesite instead.
- **Competes with:** Calcite (low Mg), magnesite (low Ca)
- **Notable:** Professor has dolomite with sphalerite and calcite (MVT specimens). Dolomite is the host rock for MVT deposits.

---

## Round 4: Sulfates + Halide (4 minerals)

Share SO₄ and Cl chemistry. Common evaporite and hydrothermal gangue minerals.

### 4a. Barite — BaSO₄
**Class:** Sulfate (#eb137f) | **System:** Orthorhombic | **Collection:** 15+ specimens
- Barium sulfate. Very dense (SG 4.5). Classic "heavy spar."
- **Temperature:** 20–300°C (very wide range)
- **pH:** 3–9
- **Consumes:** Ba, S (as sulfate)
- **Habits:** tabular_blade (default — "desert rose" rosettes), prismatic (moderate σ), crested (cockscomb aggregates), fibrous (on fracture walls)
- **Key mechanic:** Barite is extremely insoluble. Once formed, it's nearly permanent. Good "seal" mineral that closes pore space.
- **Competes with:** Celestite (Sr replaces Ba in solid solution), anglesite (PbSO₄, same structure)
- **Inclusions:** Can trap fluid inclusions (used in real-world thermometry)
- **Notable:** Professor has barite roses, golden barite, barite on sphalerite, barite with vanadinite

### 4b. Celestite — SrSO₄
**Class:** Sulfate (#eb137f) | **System:** Orthorhombic | **Collection:** 16 specimens
- Strontium sulfate. Sky-blue crystals are iconic.
- **Temperature:** 20–250°C
- **pH:** 6–9
- **Consumes:** Sr, S (as sulfate)
- **Habits:** tabular_blade (default — like barite but often more elongated), prismatic (moderate σ), radiating_fibrous (fast growth), nodular (sedimentary/evaporite)
- **Key mechanic:** Sr/Ba competition. If Ba >> Sr → barite. If Sr >> Ba → celestite. Mixed → solid solution.
- **Color:** Pale blue (classic), also white, yellowish. Blue from trace Sr²⁺ color centers or colloidal gold inclusions.
- **Competes with:** Barite (Ba equivalent), strontianite (SrCO₃ — carbonate equivalent)
- **Notable:** Professor has 16 specimens including the famous Madagascar blue crystals

### 4c. Gypsum — CaSO₄·2H₂O
**Class:** Sulfate (#eb137f) | **System:** Monoclinic | **Collection:** 6 specimens (+ 20 selenite)
- Hydrated calcium sulfate. Selenite = transparent variety. Alabaster = massive.
- **Temperature:** <40°C (above ~40°C → anhydrite CaSO₄)
- **pH:** 6–9
- **Consumes:** Ca, S (as sulfate)
- **Habits:** selenite_blade (default — transparent cleavage plates), desert_rosette (sand-included, low σ), satin_spar (fibrous, fracture-fill), hourglass (sand-included with growth zone pattern), massive_alabaster (very fast growth)
- **Key mechanic:** Hydration gate. Below ~40°C → gypsum. Above → anhydrite (no water). In the simulator, temperature controls which Ca-sulfate forms. Gypsum dehydrates to anhydrite at high T; anhydrite hydrates to gypsum at low T.
- **Competes with:** Anhydrite (high-T polymorph), barite (if Ba present)
- **NOTE:** Selenite is already in the game as a separate mineral entry. Gypsum and selenite are the same species. The builder should MERGE gypsum habits into the existing `selenite` entry rather than creating a new mineral. Add the missing habits (satin_spar, hourglass, desert_rosette) to the existing selenite.

### 4d. Halite — NaCl
**Class:** Halide (#7f13eb) | **System:** Cubic (isometric) | **Collection:** 19 specimens
- Rock salt. Perfect cubic cleavage. Hopper crystals are iconic.
- **Temperature:** Forms at any temperature (evaporite, no T gate)
- **pH:** Irrelevant (neutral halide)
- **Consumes:** Na, Cl
- **Habits:** cubic (default — perfect cubes), hopper_cube (fast evaporation — stepped/terraced faces), fibrous_columnar (efflorescence), stalactitic (drip/cave environments)
- **Key mechanic:** Extreme solubility. Halite dissolves at the slightest hint of water. In the simulator, any freshwater event should dissolve halite rapidly. Only stable in evaporite/dry conditions.
- **Competes with:** Sylvite (KCl — if K >> Na)
- **Inclusions:** Can contain fluid inclusions (microscopic brine pockets — real-world thermometer), bacteria (yes really)
- **Fluorescence:** Some halite fluoresces under UV (typically red/orange from Mn²⁺ activator)

---

## Round 5: Oxides + Phosphate (4 minerals)

### 5a. Corundum — Al₂O₃
**Class:** Oxide (#eb1313) | **System:** Trigonal (hexagonal) | **Collection:** 5 specimens
- Aluminum oxide. Ruby (Cr³⁺ red) and sapphire (Fe²⁺+Ti⁴⁺ blue) are gem varieties.
- **Temperature:** >400°C (metamorphic/high-T hydrothermal only)
- **pH:** Wide range (very stable once formed)
- **Consumes:** Al
- **Habits:** hexagonal_barrel (default — tapering hexagonal prisms), bipyramidal (high σ), tabular (flat hex plates), stellate_twin (rare — star-shaped twins)
- **Key mechanic:** Al must be very high. Corundum requires extreme Al enrichment (bauxite-grade or desilicated pegmatite). If SiO₂ is high → Al silicates (feldspar/mica) instead. Corundum wins when SiO₂ is LOW and Al is HIGH.
- **Color variants:** Ruby (Cr present → red, fluoresces red under UV), Sapphire (Fe+Ti → blue), Padparadscha (Cr+Fe → pink-orange)
- **Competes with:** All Al-silicates (feldspar, mica, garnet). Corundum is the oxide that forms when silica runs out.
- **Notable:** Professor has ruby specimens, sapphire, and ruby in zoisite

### 5b. Rutile — TiO₂
**Class:** Oxide (#eb1313) | **System:** Tetragonal | **Collection:** 10 specimens
- Titanium oxide. The "needle" mineral. Classic inclusion in quartz (rutilated quartz).
- **Temperature:** >200°C (most rutile is high-grade metamorphic/hydrothermal)
- **pH:** Wide range
- **Consumes:** Ti
- **Habits:** acicular_needle (default — slender tetragonal prisms), stout_prismatic (moderate σ), twinned_elbow (geniculate "knee" twins — diagnostic), sixling_star (rare — cyclic twinned star, "reticulated rutile")
- **Key mechanic:** Ti is trace in most environments. Rutile only nucleates when Ti concentrates (fractional crystallization of magma, or high-T hydrothermal).
- **Inclusions:** Commonly INCLUDED in quartz (rutilated quartz), garnet, kyanite. Should use the inclusion system.
- **Competes with:** Anatase, brookite (TiO₂ polymorphs — anatase forms at lower T)
- **Notable:** Professor has 10 rutile specimens including sixling twins

### 5c. Franklinite — (Zn,Mn²⁺,Fe²⁺)(Fe³⁺,Mn³⁺)₂O₄
**Class:** Oxide (#eb1313) | **System:** Cubic (isometric, spinel group) | **Collection:** 3 specimens
- Zinc iron manganese oxide. Essentially only from Franklin/Sterling Hill NJ.
- **Temperature:** High-grade metamorphic (400–800°C)
- **Consumes:** Zn, Fe, Mn
- **Habits:** octahedral (default — black metallic octahedra), massive_granular (common), dodecahedral (rare)
- **Key mechanic:** Franklinite is the zinc sink at Franklin. All the Zn that didn't go into willemite goes here. Requires very high Zn + Fe + Mn together.
- **Competes with:** Spinel (MgAl₂O₄), magnetite (Fe₃O₄ — already in game)
- **Notable:** Professor has franklinite with calcite and willemite (TN432 = zincite+willemite, TN438 = franklinite). This is the Franklin suite.

### 5d. Apatite — Ca₅(PO₄)₃(F,Cl,OH)
**Class:** Phosphate (#13eb7f) | **System:** Hexagonal | **Collection:** 4 specimens
- Calcium phosphate. The most common phosphate mineral. Biological mineral (bones/teeth).
- **Temperature:** Wide range (20–600°C)
- **pH:** 5–8
- **Consumes:** Ca, P, (F or Cl)
- **Habits:** hexagonal_prism (default — long striated prisms with flat/pointed termination), stubby_barrel (moderate σ), tabular (high σ), botryoidal_crust (fast growth, colloidal phosphate)
- **Key mechanic:** P is the gating element. Phosphorus is usually trace. Apatite nucleates when P concentrates (late-stage pegmatite, phosphatic sediments, bat guano).
- **Color variants:** Fluorapatite (F-dominant, most common), chlorapatite (Cl-dominant), hydroxylapatite (OH-dominant). Color: green, blue, purple, yellow, brown — depends on trace REE and Mn.
- **Fluorescence:** Many apatites fluoresce (yellow under LW, blue/violet under SW — Mn²⁺ + REE activators)
- **Competes with:** Wavellite, variscite, turquoise (other phosphates — lower Ca)
- **Notable:** Professor has purple and pink apatite on cleavelandite

---

## Round 6: Silicates (10 minerals)

The big group. Subdivided by paragenetic environment.

### Pegmatite Silicates

#### 6a. Orthoclase / Microcline — KAlSi₃O₈
**Class:** Silicate (#1313eb) | **System:** Monoclinic (orthoclase) / Triclinic (microcline) | **Collection:** 10+ specimens
- Potassium feldspar. The most common crustal mineral group.
- **Temperature:** 300–800°C (magmatic to hydrothermal)
- **Consumes:** K, Al, SiO₂
- **Habits:** tabular_carlsbad (orthoclase — Carlsbad twin), blocky_prism (default), platy (sanidine high-T variety), amazonite_green (microcline — green from Pb²⁺ + H₂O color center)
- **Key mechanic:** K-feldspar is the K + Al + SiO₂ sink. If K and Al are present and SiO₂ is sufficient → feldspar. The MOST COMMON mineral-forming reaction.
- **Competes with:** Albite (Na-feldspar, already in game), quartz (if Al low), mica (if K high and Al high but less SiO₂)
- **Color variants:** Orthoclase = flesh-pink to white. Amazonite = bright green (trace Pb). Microcline = often salmon-pink. Sanidine = colorless to yellow (high T).
- **NOTE:** Feldspar is already in the game but as a generic entry. This should EXPAND the existing `feldspar` entry with orthoclase/microcline habits and K-gated chemistry rather than creating a separate mineral.

#### 6b. Garnet (Almandine/Grossular/Spessartine) — X₃Z₂(SiO₄)₃
**Class:** Silicate (#1313eb) | **System:** Cubic (isometric) | **Collection:** 22 specimens
- Nesosilicate group. Garnet chemistry maps to broth composition:
  - Almandine: Fe₃Al₂Si₃O₁₂ (Fe-dominant)
  - Grossular: Ca₃Al₂Si₃O₁₂ (Ca-dominant)
  - Spessartine: Mn₃Al₂Si₃O₁₂ (Mn-dominant)
  - Andradite: Ca₃Fe₂Si₃O₁₂ (Ca + Fe³⁺)
- **Temperature:** 300–800°C (metamorphic to pegmatitic)
- **Consumes:** SiO₂, Al + (Fe or Ca or Mn)
- **Habits:** dodecahedral (default — 12 rhombic faces, most common), trapezohedral (icositetrahedron — 24 trapezoid faces), massive_granular (high σ)
- **Key mechanic:** X-cation determines garnet species. Fe → almandine (red-brown), Ca+Al → grossular (green/hessonite orange), Mn → spessartine (orange), Ca+Fe³⁺ → andradite (green demantoid). A single `supersaturation_garnet()` function branches on composition.
- **Inclusions:** Garnet commonly traps rutile needles (included in the inclusion system)
- **Notable:** Professor has grossular, chrome-grossular, demantoid, spessartine, almandine, grossular on diopside

#### 6c. Staurolite — Fe₂Al₉Si₄O₂₂(OH)₂
**Class:** Silicate (#1313eb) | **System:** Monoclinic (pseudo-orthorhombic) | **Collection:** 10 specimens
- Iron aluminum nesosilicate. Famous for cruciform ("fairy cross") twins.
- **Temperature:** 400–700°C (medium-grade metamorphic only)
- **Consumes:** Fe, Al, SiO₂
- **Habits:** prismatic_cross (default — the iconic cruciform twin), prismatic_single (no twin), blocky (massive)
- **Key mechanic:** Staurolite is a metamorphic index mineral. It ONLY forms in a specific T/P window (garnet- to sillimanite-grade metamorphism). Too low T → no staurolite. Too high T → breaks down to sillimanite + garnet.
- **Twin laws:** 90° cross (most iconic), 60° cross. Twin frequency could be σ-dependent.
- **Competes with:** Kyanite, garnet, sillimanite (all share Al-rich chemistry)

### Hydrothermal Silicates

#### 6d. Diopside — CaMgSi₂O₆
**Class:** Silicate (#1313eb) | **System:** Monoclinic (pyroxene) | **Collection:** 6 specimens
- Calcium magnesium pyroxene. Common skarn mineral.
- **Temperature:** 200–800°C (contact metamorphic to hydrothermal)
- **Consumes:** Ca, Mg, SiO₂
- **Habits:** prismatic_blade (default — elongated prisms with ~87°/93° cleavage angles), acicular (fast growth), massive (high σ)
- **Key mechanic:** Ca + Mg + SiO₂ → diopside. If Al present → could become augite instead. Pure CaMg pyroxene = diopside.
- **Competes with:** Tremolite/actinolite (amphibole — same chemistry, different structure, lower T), dolomite (if CO₃ high)
- **Notable:** Professor has chrome-diopside (green from Cr³⁺), diopside with wulfenite, diopside on hessonite

#### 6e. Epidote — Ca₂(Al,Fe³⁺)₃(SiO₄)₃(OH)
**Class:** Silicate (#1313eb) | **System:** Monoclinic | **Collection:** 7 specimens
- Calcium aluminum iron sorosilicate. The "pistachio green" mineral.
- **Temperature:** 200–500°C (greenschist to amphibolite facies)
- **Consumes:** Ca, Al, Fe, SiO₂
- **Habits:** striated_prism (default — elongated prisms with deep striations, pistachio green), fibrous_radial (fast growth), massive (high σ)
- **Key mechanic:** Epidote = Ca + Al + Fe³⁺ + SiO₂ in oxidizing conditions. Fe must be Fe³⁺ (oxidized), not Fe²⁺. Requires moderate Eh.
- **Color:** Pistachio green (diagnostic), yellow-green, dark green. Fe³⁺ chromophore.
- **Competes with:** Zoisite/clinozoisite (Fe-free equivalent — if Fe low)

#### 6f. Titanite (Sphene) — CaTiSiO₅
**Class:** Silicate (#1313eb) | **System:** Monoclinic | **Collection:** 1 specimen
- Calcium titanium neosilicate. "Sphene" = wedge-shaped crystals.
- **Temperature:** 200–700°C
- **Consumes:** Ca, Ti, SiO₂
- **Habits:** wedge_shaped (default — flattened wedge/envelope shape, diagnostic), prismatic (moderate σ), massive (high σ)
- **Key mechanic:** Ti gates this mineral. Ti is trace in most fluids — titanite only forms when Ti concentrates (fractional crystallization or Ti-rich protolith).
- **Competes with:** Rutile (TiO₂ — if Ca low), ilmenite (FeTiO₃ — if Fe high)

#### 6g. Prehnite — Ca₂Al₂Si₃O₁₀(OH)₂
**Class:** Silicate (#1313eb) | **System:** Orthorhombic | **Collection:** 3 specimens
- Calcium aluminum sorosilicate. Botryoidal green crusts.
- **Temperature:** 200–400°C (low-grade metamorphic / hydrothermal)
- **pH:** 7–9
- **Consumes:** Ca, Al, SiO₂
- **Habits:** botryoidal_crust (default — rounded green mammillary aggregates, "grape bunches"), crystallized_blade (rare, higher σ), fan_aggregate (moderate σ)
- **Key mechanic:** Prehnite is a low-grade metamorphic indicator. Forms in the prehnite-pumpellyite facies. Ca + Al + SiO₂ at moderate T → prehnite.
- **Color:** Light green to yellow-green. Can be colorless.
- **Competes with:** Epidote (if Fe available), zeolites (lower T)

### Zeolite Suite

#### 6h. Stilbite — NaCa₄Al₉Si₂₇O₇₂·28H₂O
**Class:** Silicate (#1313eb) | **System:** Monoclinic | **Collection:** 2 specimens
- Zeolite group. "Wheat-sheaf" aggregates are iconic.
- **Temperature:** 50–250°C (zeolite facies)
- **pH:** 7–10 (alkaline)
- **Consumes:** Ca, Na, Al, SiO₂
- **Habits:** wheat_sheaf (default — bow-tie aggregates of thin plates), tabular_cross (moderate σ), fibrous (fast growth)
- **Key mechanic:** Zeolites form from alkaline fluids altering volcanic glass. Low-T, high-pH, Al+SiO₂ rich.
- **Competes with:** Heulandite (similar chemistry), apophyllite (if K > Na/Ca)

#### 6i. Heulandite — (Ca,Na)₂₋₃Al₃(Al,Si)₂Si₁₃O₃₆·12H₂O
**Class:** Silicate (#1313eb) | **System:** Monoclinic | **Collection:** 2 specimens
- Zeolite group. "Coffin-shaped" crystals.
- **Temperature:** 50–250°C
- **pH:** 7–10
- **Consumes:** Ca, Na, Al, SiO₂
- **Habits:** coffin_shaped (default — tabular with chisel termination), blocky_tabular (moderate σ)
- **Key mechanic:** Very similar to stilbite. Ca/Na ratio and slightly different Al/Si ratio controls which forms. Could share a `supersaturation_zeolite()` function with stilbite.

### Oxide Silicate Crossover

#### 6j. Willemite — Zn₂SiO₄
**Class:** Silicate (#1313eb) | **System:** Trigonal (hexagonal) | **Collection:** 3 specimens
- Zinc silicate. The Franklin fluorescence star.
- **Temperature:** 200–800°C (high-grade metamorphic, also smelter deposits)
- **Consumes:** Zn, SiO₂
- **Habits:** prismatic_hexagonal (default — long hexagonal prisms), granular_massive (common at Franklin), fibrous_radial (hydrothermal)
- **Key mechanic:** Willemite forms when Zn meets SiO₂ at high T. At Franklin, it's the dominant Zn mineral (not sphalerite, which is the sulfide — Franklin is a desulfidized deposit).
- **Fluorescence:** INTENSE green under SW UV (Mn²⁺ activator). This is the most fluorescent mineral at Franklin. Should show fluorescence in the simulator.
- **Competes with:** Sphalerite (if S present), smithsonite (if CO₃ present and low T)
- **Notable:** Professor has willemite with franklinite and zincite (TN432 = smelter specimen with spectacular 3-wavelength FL response)

---

## Implementation Notes

### Shared Functions (build once, branch by composition)
- `supersaturation_carbonate()` — calcite/aragonite/rhodochrosite/siderite/dolomite all branch on cation ratios
- `supersaturation_sulfate()` — barite/celestite branch on Ba vs Sr
- `supersaturation_zeolite()` — stilbite/heulandite branch on Ca/Na and Al/Si
- `supersaturation_garnet()` — branches on Fe/Ca/Mn to select garnet species

### Existing Mineral Updates (don't create new entries)
- **Gypsum** → merge habits into existing `selenite` entry
- **Orthoclase/Microcline** → expand existing `feldspar` entry with K-gated habits

### New FluidChemistry Fields Needed
None. All 22 minerals use existing broth elements.

### Priority by Collection Weight
1. Rhodochrosite (35 specimens — most unrepresented mineral in your collection)
2. Halite (19)
3. Celestite (16)
4. Barite (15)
5. Aragonite (11)
6. Rutile (10)
7. Garnet (22 — combined species)
8. Staurolite (10)
9. Orthoclase/Microcline (10+)
10. Everything else (1–8 specimens each)

### Checklist per Mineral
- [ ] `data/minerals.json` entry with ALL template fields
- [ ] `vugg.py`: `supersaturation_*`, `grow_*`, `MINERAL_ENGINES` registration, `check_nucleation` block
- [ ] `web/index.html`: mirror of all engine code
- [ ] `docs/data/minerals.json`: synced
- [ ] `docs/index.html`: synced
- [ ] `tools/sync-spec.js`: 0 drift
- [ ] Narrative text (`_narrate_*`) for each habit
- [ ] Scenario dropdown updated if adding to existing scenarios
