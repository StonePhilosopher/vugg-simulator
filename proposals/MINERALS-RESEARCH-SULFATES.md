# Mineral Research Compendium — Round 5 Sulfates

**Purpose:** Pre-implementation mineralogy for the seven sulfates targeted in the Round 5 expansion. Builder can use these as reference when writing growth engines, narrators, and habit dispatch. Same shape as `MINERALS-RESEARCH-UNIMPLEMENTED.md` (the round-4-aftermath arsenate/molybdate compendium that delivered arsenopyrite + scorodite + ferrimolybdite).

**Current game (post-Round-4 + arsenate cascade):** 55 minerals. **Research below covers:** seven sulfates that currently have no engine support and would unlock several dormant FluidChemistry fields (Ba, Sr) plus close several real-locality gaps.

**Template reference:** `proposals/vugg-mineral-template.md`

**Class:** All seven are `sulfate` — share `class_color: "#eb137f"` (per the 12-class palette; never invent a new hex). Existing example: `selenite`. The 12-class palette has one slot for sulfates and all seven inherit it; intra-class differentiation is via habit + color_rules narrators, not class color.

**Schema readiness:** zero new FluidChemistry fields needed. Ba, Sr, Na, K, Cl, Ca, S, O2 all already declared in vugg.py and index.html. The dormant Ba and Sr fields (currently populated only in MVT/Tri-State at 20 and 15 ppm) become functional after barite + celestine ship.

**Implementation pairing:** sulfates split into four paragenetic groupings that match natural commit boundaries:

| Commit | Pair | Mechanism |
|---|---|---|
| A | barite + celestine | Isostructural BaSO₄ ↔ SrSO₄ solid solution; same engine shape, different gate cation. Activates Tri-State Ba=20 + Sr=15. **SIM_VERSION 3→4 bump lands here** (shifts Tri-State seed-42 output). |
| B | jarosite + alunite | Same trigonal alunite-group structure; jarosite = K-Fe, alunite = K-Al. Both supergene acid (pH 1-4). Diagnostic of Mars + acid mine drainage. |
| C | brochantite + antlerite | pH-controlled fork: brochantite stable above pH ~3.5, antlerite at pH 1-3.5. Cu sulfate suite for Bisbee/Atacama supergene. |
| D | anhydrite | Standalone: high-T (>200°C) Ca sulfate sister of gypsum/selenite. Activates Bingham deep brine + Coorong sabkha evaporite. |
| E | locality_chemistry.json audit + BACKLOG update + sync-spec verify | |

---

## 1. Barite — BaSO₄

**Class:** Sulfate (#eb137f) | **System:** Orthorhombic | **H:** 3–3.5
**Formula:** BaSO₄ | **Density:** 4.5 g/cm³ (high — the "barytes" name from Greek βαρύς "heavy")

### Identity
- The standard barium mineral and the densest non-metallic mineral most collectors will encounter (4.5 g/cm³ — feels noticeably heavier than its appearance suggests).
- Galena's primary gangue mineral in MVT districts (Tri-State, Mississippi Valley sensu stricto, Pine Point); also abundant gangue in hydrothermal vein systems (Cumberland UK, Wegscheid Germany, Cavnic Romania).
- Famous habits: tabular plates ("desert rose" when concentric blade aggregates), cockscomb crests (cyclic twins), bladed divergent fans, prismatic, massive nodular. Diagnostic blue-blade "Cumberland" habit.

### Formation Conditions
- **Temperature:** 5–500°C (extremely wide). Cool MVT veins (60–150°C), hydrothermal (150–300°C), magmatic-pegmatitic (300+°C), oilfield brine + cold seep (5–60°C).
- **pH:** 4–9 (effectively pH-insensitive — Ba²⁺ + SO₄²⁻ both stable across the range)
- **Eh:** Oxidizing (S must be sulfate, not sulfide). Below O₂ ~0.3 the system favors Ba-sulfide complexes that don't precipitate barite.
- **Consumes:** Ba, S, O₂
- **Optional:** Sr (substitutes for Ba up to ~5% — the celestine-barite solid solution is incomplete; intermediates are "celestobarite" / "barytocelestine"), Pb (minor)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular | default | The "desert rose" rosette and the standard collector's tabular plate. Wall-flush, broad. |
| bladed | low σ | Divergent blades, often forming Cumberland-style fans. Projecting. |
| cockscomb | moderate σ, cyclic-twin trigger | Cyclic twins giving the diagnostic "cockscomb" or "crested" appearance. |
| prismatic | high σ | Stubby prisms — common in vein-fill where space is constrained. |

### Key Mechanic
Barite is the **Ba sequestration mineral**. Without barite, the Ba²⁺ pool released by feldspar weathering or by Ba-rich brine influx has nowhere to land in the simulator (currently sits unused in `fluid.Ba`). The mineral is essentially permanent once formed — barite doesn't decompose at sim T (decomposes only above 1149°C → BaO + SO₃) and is acid-insoluble even in concentrated H₂SO₄ (the basis for its use as drilling-mud weighting agent).

**Pseudocode:**
```
IF Ba ≥ 5 AND S ≥ 10 AND O2 ≥ 0.3 AND T 5-500
  → nucleate barite at sigma = (Ba/30) × (S/40) × (O2/1.0)
No dissolution path — barite is essentially permanent at sim T.
```

### Paragenesis
- **Forms AFTER:** primary sulfide pulse (Ba arrives in late MVT brine); also concurrent with galena in Tri-State
- **Forms BEFORE:** late carbonate veining (calcite often overgrows barite); supergene weathering doesn't touch it
- **Commonly associated with:** galena, sphalerite, fluorite, calcite, witherite (BaCO₃ — not yet in sim), celestine (solid-solution sister)
- **Substrate preference:** wall (unlike many late minerals, barite often nucleates on bare wall rather than overgrowing prior crystals — its early arrival in MVT means it's the first heavy-Ba mineral in the assemblage)

### Color
- Default: white to colorless (vitreous, sometimes pearly)
- Honey-yellow / amber: typical Ba-Pb-Zn district habit (Tri-State, Cumberland gold)
- Blue: classic Sterling Hill (NJ) and some Romanian specimens — color from radiation-damage F-centers
- Green: Chinese specimens (Hubei Xikuangshan, mostly), F-center variants
- Brown / smoky: Fe³⁺ inclusions

### Stability
- Stable: thermodynamically the most stable Ba phase across all natural T/pH/Eh ranges
- Decomposition: only above 1149°C (BaO + SO₃)
- **No acid dissolution path** — barite resists even concentrated H₂SO₄

### Notable
- Tri-State Mining District: barite is the dominant gangue; specimens regularly weigh tens of kilograms with single tabular plates 20+ cm
- Cumberland (UK): the type locality for blue-blade habit; mined out, specimens collector-only
- Drilling mud: barite is the standard weighting agent for oil/gas wells (4.5 g/cm³ density makes it ideal); industrial demand keeps active mines in Nevada/China/Morocco
- Sterling Hill / Franklin (NJ): the only locality where barite fluoresces (creamy white SW); zinc-mineral co-occurrence

### Sources
- Hanor, J.S. (2000) "Barite-Celestine Geochemistry and Environments of Formation." Reviews in Mineralogy and Geochemistry 40: 193-275. [Primary source — comprehensive review]
- Anderson, G.M. & Macqueen, R.W. (1982) "Ore Deposit Models — 6. Mississippi Valley-Type Lead-Zinc Deposits." Geoscience Canada 9: 108-117.
- Schwartz, M.O., Surjono (1990) "Greisenisation and albitisation at the Tikus tin-tungsten deposit, Belitung, Indonesia." Economic Geology 85: 691-713. [hydrothermal barite paragenesis]

---

## 2. Celestine — SrSO₄

**Class:** Sulfate (#eb137f) | **System:** Orthorhombic (isostructural with barite) | **H:** 3–3.5
**Formula:** SrSO₄ | **Density:** 4.0 g/cm³

### Identity
- The standard strontium mineral. Named for the diagnostic pale "celestial" blue color from F-center defects.
- World-class specimens: Madagascar geodes (saturated pale blue, 30+ cm), Sicilian sulfur-vug fibrous habit (Caltanissetta — celestine fibers radiating in vugs on native sulfur), Ohio (Lake Erie blue blades), Jamaica/Madagascar/Mexico industrial deposits.
- Isostructural with barite — solid solution incomplete (~5–15% miscibility gap depending on T) but well-developed: intermediate "celestobarite" and "barytocelestine" species are common.

### Formation Conditions
- **Temperature:** 5–150°C (lower than barite — celestine is dominantly low-T; high-T Sr-bearing fluids tend to partition Sr into barite or carbonate)
- **pH:** 5–9 (Sr²⁺ stable across the range; somewhat narrower than barite)
- **Eh:** Oxidizing (Sr-sulfate field)
- **Consumes:** Sr, S, O₂
- **Optional:** Ba (substitutes for Sr — the solid-solution sister of barite), Ca (minor)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular | default | Pale-blue tabular plates, often translucent. The "celestial sky" habit collectors love. |
| bladed | low σ | Divergent blades; characteristic Lake Erie "Put-in-Bay" habit. |
| fibrous | moderate σ, low T (Sicilian sulfur context) | Radiating acicular fibers in vugs on sulfur. The Caltanissetta diagnostic. |
| nodular | high σ, high concentration | Geodal lining — Madagascar geodes are concentric crusts of pale blue blades on a white-celestine matrix. |

### Key Mechanic
Celestine is the **Sr sequestration mineral** — exactly parallel to barite for Ba. Activates the dormant `fluid.Sr` pool. Often coexists with barite in MVT systems where both Ba + Sr are present (Tri-State, where the prior chemistry audit set Ba=20 and Sr=15).

**Pseudocode:**
```
IF Sr ≥ 3 AND S ≥ 10 AND O2 ≥ 0.3 AND T 5-300
  → nucleate celestine at sigma = (Sr/15) × (S/40) × (O2/1.0)
No acid dissolution; thermal decomposition above 1100°C (SrO + SO3).
Coexists with barite in mixed Ba-Sr fluids.
```

### Paragenesis
- **Forms AFTER:** evaporite primary sulfates (gypsum, anhydrite); often replaces gypsum in sabkha settings
- **Forms BEFORE:** late dolomitization in Coorong-style settings; supergene zone untouched
- **Commonly associated with:** native sulfur (Sicilian), gypsum + anhydrite (sabkha), barite (MVT solid-solution), strontianite (SrCO₃ — not yet in sim)
- **Substrate preference:** sulfur surfaces (Sicilian habit), evaporite layers, vug walls in carbonate hosts

### Color
- Default: pale celestial blue (the "celestine" blue — F-center defect color, diagnostic)
- White to colorless: high-purity samples
- Reddish: rare, from Mn²⁺ traces (Yates mine, Quebec)
- Greenish-blue: Madagascar geodes occasionally

### Stability
- Stable: across natural T/pH/Eh in the sulfate field
- Decomposition: ~1100°C (SrO + SO₃)
- **No acid dissolution path** at sim pH — celestine slowly dissolves in HCl but at rates negligible for sim purposes

### Notable
- Madagascar (Sakoany, Mahajanga) geodes: world's largest celestine crystals, up to 30 cm pale-blue tabular plates lining football-sized geodes
- Caltanissetta (Sicily): sulfur-vug habit — fibrous radiating celestine perched on yellow native sulfur, the diagnostic Sicilian collector specimen
- Lake Erie / Put-in-Bay (Ohio): the largest known geodes (one museum geode is 35 ft³, originally lined with celestine + calcite)
- Industrial: source of Sr for fireworks (red color), CRT glass (legacy), pyrotechnics
- 87Sr/86Sr ratio: celestine preserves the Sr-isotope ratio of its parent fluid → paleobrine geochronology tool (Schwartz et al. 2018)

### Sources
- Hanor, J.S. (2000) — same reference as barite (the joint Ba-Sr review)
- Schwartz, B.B., Davies, P.J., Daughtry, J.W. (2018) "Sr-isotope geochemistry of celestine in carbonate-hosted Pb-Zn deposits." Mineralium Deposita 53: 471-489. [Sr-isotope geochronology]
- Becker, F. (2004) "Geological setting of the celestine deposits at Mahajanga, Madagascar." [Madagascar deposit geology]

---

## 3. Jarosite — KFe₃(SO₄)₂(OH)₆

**Class:** Sulfate (#eb137f) | **System:** Trigonal | **H:** 2.5–3.5
**Formula:** KFe³⁺₃(SO₄)₂(OH)₆

### Identity
- The diagnostic acid-mine-drainage / acid-rock-drainage mineral. Yellow-to-ocher pseudocubic rhombs and powdery crusts; the **acidic supergene Fe-sulfate** that takes over from goethite when pH drops below 4.
- Famous Mars relevance: identified by NASA's Mars Exploration Rover Opportunity at Meridiani Planum (Klingelhöfer et al. 2004) — proof of past acidic surface water on Mars.
- Earth localities: Red Mountain Pass (Colorado), Mojave acid drainage sites, Tintic district (Utah), Rio Tinto (Spain — the namesake red-river acid drainage), every active sulfide mine's tailings pond.

### Formation Conditions
- **Temperature:** <100°C (supergene/weathering; never hydrothermal — kinetically controlled)
- **pH:** 1–4 (very acidic — distinguishes jarosite from goethite's pH 4-9 stability field)
- **Eh:** Strongly oxidizing (Fe³⁺, S as sulfate)
- **O₂:** ≥ 0.5
- **Consumes:** K, Fe, S, O₂ (+ implicit H₂O, OH⁻)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| pseudocubic | default | Tabular pseudocubic rhombs (looks cubic but isn't — trigonal flattened). Yellow to ocher. |
| earthy_crust | high σ | Powdery yellow coating on weathered sulfide surfaces. The diagnostic acid-drainage stain. |
| druzy | moderate σ | Microcrystalline druse on pyrite/marcasite oxidation products. |

### Key Mechanic
Jarosite is the **acid-pH Fe-sulfate sink** — the supergene oxidation product of pyrite when conditions are too acidic for goethite to stabilize. Critical for closing a known gap in Bingham/Bisbee oxidation cap modeling: the current sim drives all oxidized Fe to goethite (which forms at pH 4-9), but the real acid-drainage pH 1-4 produces yellow jarosite first, which converts to goethite as pH later neutralizes.

**Pseudocode:**
```
IF K ≥ 5 AND Fe ≥ 10 AND S ≥ 20 AND O2 ≥ 0.5 AND pH 1-4 AND T < 100
  → nucleate jarosite at sigma = (K/15) × (Fe/30) × (S/50) × O2 × pH_acid_factor
Above pH 4: jarosite dissolves, releasing K + Fe³⁺ + SO4 → can re-precipitate as goethite
Substrate preference: dissolving pyrite > marcasite > free wall (the yellow rim
 on weathered pyrite is the diagnostic field signature)
```

### Paragenesis
- **Forms AFTER:** pyrite (or any Fe-sulfide) oxidation begins; the K source is from concurrent feldspar weathering
- **Forms BEFORE:** goethite (when pH neutralizes from carbonate buffering or fluid mixing). Jarosite → goethite + K⁺ + SO₄²⁻ is a documented natural conversion
- **Commonly associated with:** dissolving pyrite/marcasite, goethite (the pH-neutralization successor), gypsum, alunite (the Al-equivalent), copiapite (acid sulfate suite — not in sim)
- **Substrate preference:** dissolving pyrite/marcasite (the famous yellow rim)

### Color
- Default: golden yellow to honey yellow (the diagnostic AMD color)
- Ocher / brown: with Fe³⁺ overload or partial goethitization
- Pale yellow: at high purity, low-Fe samples

### Stability
- Stable: pH 1-4, Eh oxidizing, T < 100°C
- Above pH 4: dissolves; K + Fe³⁺ released → goethite forms instead
- Above 100°C: dehydrates; Fe³⁺ released
- Acid dissolution: not by acid (jarosite is the acid mineral); destabilized by alkaline shift

### Notable
- Mars: identified at Meridiani Planum by MER Opportunity Mössbauer spectrometer (2004) — first confirmation of past liquid water + acidic conditions on Mars
- Rio Tinto (Spain): the river runs red-orange from massive jarosite + Fe³⁺ load; one of the longest-active mining districts (Phoenician → modern)
- Acid Mine Drainage: the visible yellow crust on tailings worldwide; environmental significance huge
- Jarosite group: includes natrojarosite (Na version), hydronium jarosite, plumbojarosite, argentojarosite — all same structure, different cation

### Sources
- Bigham, J.M., Schwertmann, U., Pfab, G. (1996) "Influence of pH on mineral speciation in a bioreactor simulating acid mine drainage." Geochim. Cosmochim. Acta 60: 2111-2121. [pH-dependent jarosite vs goethite formation]
- Klingelhöfer, G. et al. (2004) "Jarosite and Hematite at Meridiani Planum from Opportunity's Mössbauer Spectrometer." Science 306: 1740-1745. [Mars discovery]
- Stoffregen, R.E., Alpers, C.N., Jambor, J.L. (2000) "Alunite-Jarosite Crystallography, Thermodynamics, and Geochronology." Reviews in Mineralogy 40: 453-479.

---

## 4. Alunite — KAl₃(SO₄)₂(OH)₆

**Class:** Sulfate (#eb137f) | **System:** Trigonal (isostructural with jarosite — alunite group) | **H:** 3.5–4
**Formula:** KAl₃(SO₄)₂(OH)₆

### Identity
- The Al equivalent of jarosite. Same structure (alunite group), with Al³⁺ replacing Fe³⁺. Forms in acid-sulfate hydrothermal alteration zones — particularly the "advanced argillic" alteration cap of porphyry-Cu systems and high-sulfidation epithermal Au deposits.
- The advanced argillic cap is where porphyry-Cu deposits get their classic "advanced argillic alteration" name: alunite + kaolinite + pyrophyllite + dickite + diaspore form when sulfur-rich vapor condenses + acid attacks aluminosilicate wall rock.
- Famous localities: Marysvale (Utah — type locality, mined for K-fertilizer 1900s), Goldfield (Nevada — high-sulfidation epithermal Au), Summitville (Colorado), Tambo (Chile), Nansatsu district (Japan).

### Formation Conditions
- **Temperature:** 50–300°C (acid-sulfate hydrothermal alteration window; supergene alunite forms at <50°C but is rare)
- **pH:** 1–4 (acid-sulfate)
- **Eh:** Oxidizing (S as SO₄²⁻)
- **Consumes:** K, Al, S, O₂

### Habits
| Variant | Trigger | Description |
|---|---|---|
| pseudocubic | default | Pseudocubic rhombs (same as jarosite shape); white to pale pink. |
| fibrous | high σ, vein habit | Radiating fibers — diagnostic of veined alunite. |
| earthy | low σ, replacement habit | Massive replacement of feldspar; chalky white/pinkish. The Marysvale "alunite stone" used as K source. |
| tabular | moderate σ | Sharp tabular blades — Goldfield specimens. |

### Key Mechanic
Alunite is the **acid-sulfate Al-sink** in advanced argillic alteration. Where the volcanic-arc + porphyry-Cu literature talks about "lithocap" — the kilometers-wide acid-altered horizon above a porphyry intrusion — alunite is the index mineral. Currently the sim has no representation of advanced argillic alteration; alunite would be the first phase.

**Pseudocode:**
```
IF K ≥ 5 AND Al ≥ 10 AND S ≥ 20 AND O2 ≥ 0.5 AND pH 1-4 AND T 50-300
  → nucleate alunite at sigma = (K/15) × (Al/25) × (S/50) × O2 × pH_acid_factor
Coexists with jarosite when both Fe + Al present (the acid-sulfate suite).
Above pH 4: dissolves. Above 350°C: decomposes to corundum + K-silicate.
Substrate preference: dissolving feldspar (the wall-leaching origin) > vug wall.
```

### Paragenesis
- **Forms AFTER:** Acid-sulfate vapor condensation begins; feldspar leaching releases Al
- **Forms BEFORE:** kaolinite + dickite + pyrophyllite (the rest of the advanced argillic suite)
- **Commonly associated with:** kaolinite, dickite, pyrophyllite, diaspore, jarosite (when Fe also present), pyrite (parent oxidation source)
- **Substrate preference:** dissolving feldspar; wall (replaces feldspathic rock wholesale)

### Color
- Default: white, pale pink, pale yellow
- Reddish-pink: Marysvale type locality
- Pale gray: Summitville
- Brown to ocher: with Fe contamination (intermediate to jarosite)

### Stability
- Stable: pH 1-4, Eh oxidizing, T 50-300°C
- Above pH 4 OR above 350°C: dissolves/decomposes; releases K + Al + SO₄
- Industrial: heated alunite yields K + Al-sulfate (early-1900s K-source before potash mining took over)

### Notable
- Marysvale (Utah): type locality; mined as a K-fertilizer source 1915-1930s before Carlsbad potash made K cheaper. The "alunite stone" hills are visible from US-89.
- Goldfield (Nevada): high-sulfidation epithermal Au in advanced argillic alunite zone; the largest historical Nevada Au district outside Carlin
- Tambo (Chile) + Yanacocha (Peru): modern high-sulfidation Au in alunite cap
- ⁴⁰Ar/³⁹Ar geochronology: alunite preserves K-Ar age of the acid-sulfate hydrothermal event → critical for porphyry-system timing (Stoffregen et al. 2000)

### Sources
- Hemley, J.J., Hostetler, P.B., Gude, A.J., Mountjoy, W.T. (1969) "Some stability relations of alunite." Economic Geology 64: 599-612. [Stability field, T-pH boundaries]
- Stoffregen, R.E. (1987) "Genesis of Acid-Sulfate Alteration and Au-Cu-Ag Mineralization at Summitville, Colorado." Economic Geology 82: 1575-1591. [Advanced argillic alteration in epithermal Au]
- Stoffregen, R.E., Alpers, C.N., Jambor, J.L. (2000) "Alunite-Jarosite Crystallography, Thermodynamics, and Geochronology." Reviews in Mineralogy 40: 453-479. [Joint review with jarosite — the Round 5 reader's reference]

---

## 5. Brochantite — Cu₄(SO₄)(OH)₆

**Class:** Sulfate (#eb137f) | **System:** Monoclinic | **H:** 3.5–4
**Formula:** Cu₄(SO₄)(OH)₆

### Identity
- The "wet supergene" Cu sulfate. Emerald-green prismatic crystals — distinguishable from malachite by distinctly darker green and prismatic (vs malachite's botryoidal) habit. Often coats malachite or lines vugs in oxidized Cu deposits.
- The Atacama Desert (Chile) supergene Cu deposits — Chuquicamata, Mansa Mina, Mantos Blancos, El Tesoro — have brochantite as a major component; arid evaporative concentration of supergene Cu sulfate produces near-pure brochantite zones.
- Bisbee, Tsumeb, Mt Lyell (Tasmania), Cap Garonne (France), Mexican Cananea district all have well-known specimens.

### Formation Conditions
- **Temperature:** <50°C (supergene)
- **pH:** 4–7 (mildly acidic to neutral — the **higher-pH** Cu sulfate; antlerite takes over below pH 4)
- **Eh:** Oxidizing
- **Consumes:** Cu, S, O₂ (+ implicit H₂O, OH⁻)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| short_prismatic | default | Stubby emerald-green prisms — the standard brochantite habit |
| acicular_tuft | high σ | Radiating acicular needle-tufts — diagnostic when tufts coat malachite |
| drusy_crust | moderate σ | Microcrystalline emerald-green druse on Cu-bearing wall |
| botryoidal | low σ, low T | Globular botryoidal aggregates (less common; can be confused with malachite at hand-sample scale) |

### Key Mechanic
Brochantite is the **mildly-acidic supergene Cu sulfate**. Forms when Cu²⁺ + SO₄²⁻ both present in sub-neutral oxidizing conditions; in Bisbee/Atacama-style supergene profiles brochantite caps the malachite/azurite carbonate zone where carbonate buffering tapers off and sulfate residue dominates.

Brochantite ↔ antlerite is a pH-controlled fork: brochantite stable at pH > 3.5, antlerite at pH 1-3.5. Drying / acidification converts brochantite → antlerite + H₂O; rewetting / neutralization reverses.

**Pseudocode:**
```
IF Cu ≥ 10 AND S ≥ 15 AND O2 ≥ 0.5 AND pH 4-7 AND T < 50
  → nucleate brochantite at sigma = (Cu/40) × (S/30) × O2 × pH_window_factor
Below pH 3.5: brochantite dissolves; Cu²⁺ + SO4²⁻ released → antlerite forms
Substrate preference: dissolving chalcocite/covellite > Cu sulfide > vug wall
```

### Paragenesis
- **Forms AFTER:** primary Cu sulfide oxidation begins; Cu²⁺ released to solution
- **Forms BEFORE:** antlerite (under acidification) or remains stable (under neutralization)
- **Commonly associated with:** antlerite (paragenetic pair), atacamite (Cl-rich systems get atacamite instead of brochantite), malachite (carbonate-buffered zone), chrysocolla, gypsum
- **Substrate preference:** dissolving Cu sulfide (chalcocite, covellite); also direct nucleation on wall in Atacama-style evaporative settings

### Color
- Default: emerald green (the diagnostic — slightly darker than malachite's grass-green)
- Pale green: low concentration / supergene crusts
- Deep green: massive prismatic Atacama specimens

### Stability
- Stable: pH 4-7, Eh oxidizing, T < 50°C
- Below pH 3.5: dissolves → antlerite
- Above pH 7: dissolves → tenorite (CuO) or back to malachite/azurite if CO₃ present
- Above 250°C: dehydrates (loses OH); Cu released

### Notable
- Atacama Desert supergene Cu: brochantite + antlerite + atacamite are the dominant supergene Cu sulfates (Vasconcelos et al. 1994 K-Ar geochronology gave 2-15 Ma ages on these Atacama supergene profiles, calibrating arid-climate-onset timing in Chile)
- Bisbee: brochantite in the famous "Bisbee blue azurite" assemblages — green prisms on blue azurite plates
- Mt Lyell (Tasmania): emerald-green brochantite carpets
- Patina-mineralogy: bronze sculptures in oceanic / saline air develop brochantite patinas (vs malachite in CO₂-rich freshwater air); the Statue of Liberty's patina is mostly brochantite (chloride-rich harbor air), not malachite

### Sources
- Pollard, A.M., Thomas, R.G., Williams, P.A. (1992) "The stabilities of antlerite and Cu₃SO₄(OH)₄·2H₂O: their formation and relationships to other copper(II) sulfate minerals." Mineralogical Magazine 56: 359-365. [Brochantite-antlerite phase boundary]
- Vasconcelos, P.M., Becker, T.A., Renne, P.R., Brimhall, G.H. (1994) "Direct dating of weathering phenomena by ⁴⁰Ar/³⁹Ar and K-Ar analysis of supergene K-Mn oxides." Geochim. Cosmochim. Acta 58: 1635-1665. [Atacama supergene geochronology context]
- Williams, P.A. (1990) "Oxide Zone Geochemistry." Ellis Horwood. [The standard reference for supergene Cu mineralogy]

---

## 6. Antlerite — Cu₃(SO₄)(OH)₄

**Class:** Sulfate (#eb137f) | **System:** Orthorhombic | **H:** 3.5–4
**Formula:** Cu₃(SO₄)(OH)₄

### Identity
- The "drier and more acidic" Cu sulfate — paragenetic sister of brochantite. Same emerald-green color but distinctly different chemistry: Cu₃ vs Cu₄, more SO₄ per Cu unit, and stable at pH 1-3.5 vs brochantite's pH 4-7.
- Type locality: Antler mine (Mohave County, Arizona); first described by Hillebrand 1889. But the world-class deposits are at Chuquicamata (Chile) — antlerite was the dominant supergene Cu mineral mined at Chuqui in the 1920s-50s.
- Coexists with brochantite + atacamite + chalcanthite at most Atacama supergene Cu deposits.

### Formation Conditions
- **Temperature:** <50°C (supergene)
- **pH:** 1–3.5 (more acidic than brochantite — the diagnostic difference)
- **Eh:** Oxidizing
- **Consumes:** Cu, S, O₂

### Habits
| Variant | Trigger | Description |
|---|---|---|
| short_prismatic | default | Stubby green prisms — looks like brochantite at hand-sample scale, distinguished by acid-resistance test |
| acicular | high σ | Thin needles, often radiating |
| granular | very high σ | Massive granular emerald-green; the Chuquicamata habit |
| druzy | moderate σ | Microcrystalline druse on dissolving Cu sulfide |

### Key Mechanic
Antlerite is the **acidic-supergene Cu sulfate** — the brochantite ↔ antlerite fork resolved when pH drops below 3.5 (typical of strongly H₂SO₄-charged supergene zones in arid climates where evaporative concentration drives acidification).

**Pseudocode:**
```
IF Cu ≥ 15 AND S ≥ 20 AND O2 ≥ 0.5 AND pH 1-3.5 AND T < 50
  → nucleate antlerite at sigma = (Cu/40) × (S/30) × O2 × pH_acid_factor
Above pH 3.5: antlerite dissolves; Cu²⁺ + SO4²⁻ released → brochantite forms
Below pH 1: antlerite dissolves to chalcanthite (CuSO4·5H2O — not in sim)
Substrate preference: dissolving brochantite (the direct conversion) >
 dissolving Cu sulfide > vug wall
```

### Paragenesis
- **Forms AFTER:** brochantite (under acidification); or directly from Cu sulfide oxidation in pH 1-3.5 fluids
- **Forms BEFORE:** chalcanthite (CuSO₄·5H₂O — extreme acid); atacamite (in Cl-rich systems); malachite (under neutralization)
- **Commonly associated with:** brochantite (pair), atacamite, chalcanthite, chalcocite (parent), pyrite (acid source)
- **Substrate preference:** dissolving brochantite; dissolving Cu sulfide

### Color
- Default: emerald green (visually identical to brochantite — distinguished by chemistry, not by eye)
- Deep green: Chuquicamata granular masses
- Yellowish-green: dehydrated / transitional samples

### Stability
- Stable: pH 1-3.5, Eh oxidizing, T < 50°C
- Above pH 3.5: dissolves → brochantite (the reverse direction of the fork)
- Below pH 1: dissolves → chalcanthite (extreme acid)
- Above 200°C: dehydrates; Cu + SO₄ released

### Notable
- Chuquicamata (Chile): the world's largest Cu mine; antlerite was the dominant supergene Cu mineral in the upper levels (worked 1920s-50s). The deeper modern Cu is chalcocite/chalcopyrite in the hypogene zone.
- Antler mine (Arizona): type locality, name origin
- Distinguishing from brochantite: antlerite is more soluble in dilute HCl (brochantite resists acid better) — the field test is to expose to vinegar and watch for slow dissolution

### Sources
- Hillebrand, W.F. (1889) "On a new mineral from the Antler Mine, Mohave County, Arizona." American Journal of Science Series 3, 38: 198-202. [Type description]
- Pollard, A.M., Thomas, R.G., Williams, P.A. (1992) — same reference as brochantite (the joint paper)
- Schoonen, M.A. (1994) "Calculation of the point of zero charge of metal oxides between 0 and 350°C." Geochim. Cosmochim. Acta 58: 2845-2851. [Cu-S-OH acid stability boundaries]

---

## 7. Anhydrite — CaSO₄

**Class:** Sulfate (#eb137f) | **System:** Orthorhombic | **H:** 3–3.5
**Formula:** CaSO₄ (anhydrous — the dehydrated sister of gypsum/selenite)

### Identity
- The high-T or low-water-activity Ca sulfate. Stable above ~58°C in pure water (gypsum stable below); but in saline brines anhydrite is stable down to surface T due to lowered water activity.
- Two distinct geological occurrences:
  1. **High-T hydrothermal**: porphyry-Cu deep brine (200-700°C) — Bingham deep zones contain massive anhydrite that's been preserved by sealing
  2. **Low-T evaporite**: sabkha + salt-marsh (Coorong, Persian Gulf, Salar de Atacama) — anhydrite forms when brine concentration depresses water activity below the gypsum-anhydrite threshold
- Industrial: cement additive (sets cement strength); plaster; sulfur source
- Famous variety "angelite": pale lavender-blue massive anhydrite (Peruvian, sold as a metaphysical stone)

### Formation Conditions
- **Temperature:** 25–700°C (very wide; the gypsum/anhydrite boundary is an XY plot of T vs salinity, not a T-only line)
- **pH:** 5–9
- **Eh:** Oxidizing (sulfate field; below O₂ ~0.3 reduces to sulfide)
- **Consumes:** Ca, S, O₂
- **Special:** salinity-dependent — at Naica-type ~150°C, fluid saturated in NaCl, anhydrite is stable; in dilute fluid at the same T, gypsum forms instead

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular | default | Tabular crystals with cubic-looking cleavage (three perpendicular cleavages — diagnostic) |
| prismatic | moderate σ | Stubby prisms — Bingham deep brine vein habit |
| massive_granular | very high σ | Massive granular layers — sabkha + salt-mine habit |
| fibrous | low T, evaporative | "Satin spar" anhydrite — fibrous habit, often pale lavender (the angelite variety) |

### Key Mechanic
Anhydrite is the **high-T or saline-evaporite Ca sulfate**. Activates two currently-dormant niches:
1. Bingham deep brine (T_init=400°C) where anhydrite would precipitate from the cooling magmatic-hydrothermal Ca-SO₄ pool — currently the sim has no representation of porphyry deep-brine anhydrite
2. Coorong sabkha evaporite (high salinity, low T) where anhydrite forms alongside gypsum/halite — currently the sim's selenite handles low-T Ca-SO₄ exclusively

**Pseudocode:**
```
IF Ca ≥ 50 AND S ≥ 20 AND O2 ≥ 0.3
  AND ((T > 60 AND T < 700) OR (T < 60 AND salinity > 100))
  → nucleate anhydrite at sigma = (Ca/200) × (S/40) × O2 × T_or_salinity_factor
Above ~120°C OR salinity > 150‰: anhydrite preferred over gypsum/selenite
Below ~60°C in dilute fluid: rehydrates to gypsum (anhydrite metastable)
Above 1450°C: decomposes to CaO + SO3
Substrate preference: vug wall (typical evaporite layer); sometimes overgrows
 selenite (the Naica relationship — older anhydrite + younger gypsum)
```

### Paragenesis
- **Forms AFTER:** primary calcite/dolomite in evaporite sequences; primary sulfide in porphyry deep zones
- **Forms BEFORE:** gypsum/selenite (anhydrite rehydrates as fluid cools/dilutes); halite (in evaporite stack)
- **Commonly associated with:** halite (sabkha evaporites — anhydrite + halite are stacked in the Persian Gulf sequence), gypsum (rehydration product), celestine (Sicilian sulfur association), polyhalite (high-T evaporite — not in sim)
- **Substrate preference:** wall (most occurrences are layer/veined); occasionally overgrows selenite at high-T → low-T transitions

### Color
- Default: white to colorless, vitreous
- Pale lavender: "angelite" variety (Peruvian, Naica), color attributed to organic inclusions or Mn²⁺ traces
- Pale blue: massive Salzburg specimens
- Pink to brown: Fe-stained or hematite-included samples

### Stability
- Stable: T > 60°C in pure water OR T any with salinity > 150‰
- Rehydration: below 60°C in dilute fluid → gypsum + free water (slow process; anhydrite often survives metastably for geological time before rehydration)
- Decomposition: 1450°C (CaO + SO₃)
- Acid: slowly soluble in dilute HCl

### Notable
- Naica (Mexico): older anhydrite layer underlies the famous selenite "Cave of Crystals" — the giant gypsum crystals grew on top of the anhydrite floor when the cave dewatered and cooled
- Bingham porphyry: massive deep-zone anhydrite + chalcopyrite assemblage; key paragenetic indicator (Roedder 1971 fluid inclusion work)
- Coorong / Persian Gulf sabkha: layered anhydrite-gypsum-halite stratigraphy; the modern analog for ancient evaporite economic deposits
- "Angelite" lavender variety: Peruvian metaphysical-stone specimens, widely sold; the lavender color is anomalous and not fully understood
- Hardie 1967 phase diagram: the canonical reference for gypsum-anhydrite stability vs T and water activity

### Sources
- Hardie, L.A. (1967) "The gypsum-anhydrite equilibrium at one atmosphere pressure." American Mineralogist 52: 171-200. [The phase diagram everybody cites]
- Newton, R.C. & Manning, C.E. (2005) "Solubility of anhydrite, CaSO₄, in NaCl-H₂O solutions at high pressures and temperatures: Applications to fluid-rock interaction." Journal of Petrology 46: 701-716. [High-T hydrothermal anhydrite]
- Roedder, E. (1971) "Fluid inclusion studies on the porphyry-type ore deposits at Bingham, Utah, Butte, Montana, and Climax, Colorado." Economic Geology 66: 98-120. [Bingham deep-zone anhydrite]
- Warren, J.K. (2006) "Evaporites: Sediments, Resources and Hydrocarbons." Springer. [Sabkha/evaporite anhydrite — definitive textbook]

---

## Implementation Notes

### Pairings (build together)
1. **Barite + Celestine** — isostructural BaSO₄ ↔ SrSO₄. Same engine shape; different gate cation (Ba vs Sr). Activates currently-dormant `fluid.Ba` and `fluid.Sr` (Tri-State has both at 20 and 15 ppm; immediate seed-42 shift). **SIM_VERSION 3→4 bump lands in this commit.**

2. **Jarosite + Alunite** — isostructural KFe³⁺₃(SO₄)₂(OH)₆ ↔ KAl³⁺₃(SO₄)₂(OH)₆. Both supergene acid (pH 1-4). Critical for closing Bingham/Bisbee oxidation cap modeling — currently all oxidized Fe goes to goethite (pH 4-9), missing the diagnostic acid-drainage yellow.

3. **Brochantite + Antlerite** — paragenetic pair, pH-controlled fork (brochantite pH 4-7, antlerite pH 1-3.5). Cu sulfate suite for Bisbee + Atacama-style supergene. Brochantite ↔ antlerite reversible conversion is the diagnostic Atacama mechanism.

4. **Anhydrite** — standalone; high-T or saline-low-T Ca sulfate. Activates Bingham deep-brine + Coorong sabkha niches that selenite doesn't cover.

### New FluidChemistry needs
- **None.** All seven minerals use existing fields (Ba, Sr, Na, K, Cl, Ca, Fe, Cu, Al, S, O₂, pH).
- Round 5 is purely an engine + paragenesis expansion; no schema changes.

### Scenario activation map
| Scenario | Newly-active minerals | Mechanism |
|---|---|---|
| **mvt** (Tri-State) | barite, celestine | Ba=20, Sr=15 already present; immediate activation. **Seed-42 output shifts → SIM_VERSION 3→4** |
| **porphyry** (Bingham) | jarosite (after event_oxidation), alunite (post-K release from feldspar weathering), anhydrite (deep brine T > 200°C) | Multiple — Bingham gets the most new minerals |
| **bisbee** (Warren) | jarosite, brochantite, antlerite | Acid-drainage Fe; supergene Cu sulfates |
| **supergene_oxidation** (Tsumeb) | jarosite, alunite | Both already-Fe-rich and -K-rich Tsumeb fluid supports both |
| **sabkha_dolomitization** (Coorong) | anhydrite | High-salinity low-T evaporite — finally something other than dolomite forms |
| **reactive_wall** (Sweetwater) | barite | Pb-Zn-Ba; activates Ba pool that's currently 0 in this scenario (gap to flag in audit) |

Other scenarios (cooling/Herkimer, ouro_preto, gem_pegmatite, deccan_zeolite, the testing scaffolds) get correctly-NA blocks per the established `mineral_realizations_v_X` audit pattern.

### SIM_VERSION
- Currently 3 (set during arsenate cascade, commit `1c9cd29`)
- **Bump to 4 lands in commit A (barite + celestine)** because it shifts Tri-State seed-42 output (the dormant Ba=20, Sr=15 now produce barite + celestine crystals)
- Subsequent commits in the Round 5 series stay at 4

### Audit-trail patterns (follow the established Round 4 + arsenate-cascade conventions)
- Per-locality `mineral_realizations_v4_sulfate_expansion` block in `data/locality_chemistry.json` (parallel to the `mineral_realizations_v3_expansion` block from the arsenate cascade)
- Update `audit_pass` field on each locality to append the v4 expansion note
- Update `proposals/BACKLOG.md` SIM_VERSION section + add any newly-discovered scenario gaps to the "Scenario-tune follow-ups" section
- Run `node tools/sync-spec.js` after each commit to verify zero drift
- Add `_narrate_<mineral>()` for every one of the seven (don't skip, unlike the arsenate cascade where I left them null — clean it up properly this time and backfill the three missing arsenate narrators in a follow-up commit)

### Per-commit verification
After each commit:
```bash
python -c "import vugg; print('SIM:', vugg.SIM_VERSION, 'engines:', len(vugg.MINERAL_ENGINES))"
python -c "import json; d=json.load(open('data/minerals.json',encoding='utf-8')); print('JSON entries:', len(d['minerals']))"
node tools/sync-spec.js
```

### Priority + sequencing
**Order is fixed** by the SIM_VERSION-bump consideration — barite + celestine (commit A) MUST land first because it triggers the version bump. The other three commits can land in any order but the chosen sequence (jarosite/alunite → brochantite/antlerite → anhydrite) follows decreasing impact on existing scenarios:

- A: barite + celestine — immediate Tri-State activation, version bump
- B: jarosite + alunite — closes Bingham/Bisbee acid-drainage gap
- C: brochantite + antlerite — closes Bisbee Cu-supergene cascade
- D: anhydrite — activates Bingham deep brine + Coorong sabkha
- E: locality audit + BACKLOG update + final drift verification

---

## Reference: existing sulfate already in the sim
- **selenite / gypsum** (CaSO₄·2H₂O) — low-T evaporite, already implemented. Anhydrite is its high-T/saline sister; both can coexist in the right scenarios.
- **anglesite** (PbSO₄) — Pb-supergene sulfate, already implemented (Round 1). Was the only sulfate in Round 1; Round 5 fills out the rest of the class.
