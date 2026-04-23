# Mineral Research Compendium — Round 7 Gemstones

**Purpose:** Pre-implementation mineralogy for the seven gemstone species targeted in the Round 7 expansion: the beryl family split (emerald, aquamarine, morganite, heliodor; goshenite stays in the existing `beryl` slot) and the corundum family (corundum, ruby, sapphire). Builder references this when writing growth engines, narrators, habit dispatch, and the new `scenario_marble_contact_metamorphism`.

Shape mirrors `proposals/MINERALS-RESEARCH-SULFATES.md` — the compendium that delivered Round 5. Design proposal with architectural decisions lives in `proposals/MINERALS-PROPOSAL-GEMSTONES.md`; this doc is the chemistry-facts half.

**Current game (post-Round-5 + gap fixes):** 62 minerals, SIM_VERSION=5, 754 tests. **Research below covers:** seven new species. 4 beryl varieties + 3 corundum species = 7 net new. Goshenite keeps the `beryl` namespace (becomes the colorless/generic default); the 4 beryl siblings become their own first-class species per the Option A architecture decision.

**Template reference:** `proposals/vugg-mineral-template.md`

**Class:** All 4 beryl varieties are `silicate` — share `class_color: "#1313eb"` (same as existing beryl slot). All 3 corundum species are `oxide` — share `class_color: "#eb1313"` (existing: cuprite, tenorite, rutile). Intra-class differentiation is via habit + color_rules narrators, not class color.

**Schema readiness:** zero new FluidChemistry fields needed. Be, Al, SiO₂, Fe, Mn, Cr, V, Ti, Ca, O₂ all already declared. Cr is dormant today (populated at 0.3 ppm in Cruzeiro pegmatite — below the emerald gate of 0.5); the beryl-family scaffolding unlocks it.

**Scenario impact:**
- `scenario_gem_pegmatite` (Cruzeiro) — existing. Needs **small Cr bump** (0.3 → 0.8 ppm) to clear the emerald threshold. Justification: Cruzeiro pegmatites cut biotite-schist country rock; biotite is the Cr source. The ultramafic-pegmatite contact is what differentiates Cruzeiro's green-beryl occurrences from pegmatite-only goshenite/aquamarine deposits.
- `scenario_marble_contact_metamorphism` — **NEW**. Mogok Stone Tract anchored. Al-rich, SiO₂-undersaturated, Ca-rich dolomitic-marble fluid. Unlocks corundum family plus future Al₂SiO₅ polymorph family (kyanite/andalusite/sillimanite, deferred to D3 plumbing round).

**Implementation pairing:** round splits into four paragenetic groupings that match natural commit boundaries (per `MINERALS-PROPOSAL-GEMSTONES.md` §"Implementation plan"):

| Commit | Pair | Mechanism |
|---|---|---|
| 1 | This research doc | Capture all chemistry up front — same pattern as Round 5. |
| 2 | Beryl family split (4 new + beryl refactor) + Cruzeiro Cr bump | Option A full split. Emerald > morganite > heliodor > aquamarine > goshenite priority. Each species gets own σ gate; existing `grow_beryl` strips the inline variety logic and becomes pure goshenite. SIM_VERSION 5→6. |
| 3 | Corundum family (3 new) + SiO₂<50 upper-gate | Novel constraint — first mineral in sim gating on an *upper* bound of a fluid field. Shared Al-rich Si-undersaturated gate via helper; ruby adds Cr gate, sapphire adds Fe+Ti (or Fe alone). |
| 4 | `scenario_marble_contact_metamorphism` (Mogok) + locality realization blocks | T=700°C peak, Al=50, SiO₂=20, Ca=800, Cr=3, Fe=8, Ti=1, pH=8. Events: peak_metamorphism, retrograde_cooling, fracture_seal. SIM_VERSION 6→7. |
| 5 | Baseline regen + audit + BACKLOG cleanup | Round closeout. |

---

## 1. Emerald — Be₃Al₂Si₆O₁₈ + Cr³⁺ (or V³⁺)

**Class:** Silicate (#1313eb) | **System:** Hexagonal | **H:** 7.5–8
**Formula:** Be₃Al₂Si₆O₁₈ | **Density:** 2.7–2.78 g/cm³ (Cr trace adds trivial mass)

### Identity
- The chromium (or vanadium) variety of beryl. The green that defines "emerald green" is Cr³⁺ substituting for Al³⁺ at the 100–3000 ppm level in the beryl structure; V³⁺ does the same and is indistinguishable optically (most Colombian emeralds are V-colored, not Cr-colored).
- Rarer than diamond as top-grade gem material: the Muzo/Chivor Colombian paragenesis yields gem-clarity stones so infrequently that a single top specimen in the 1+ carat range sells for more per carat than any diamond.
- The "emerald paradox": Cr/V is ultramafic (Cr is a peridotite/komatiite element; V is a basalt element), Be is granitic-pegmatite (most-incompatible common element). These two chemistries almost never coexist in the same fluid. Emerald forms only where ultramafic country rock intersects a pegmatite-derived hydrothermal fluid.

### Formation Conditions
- **Temperature:** 300–650°C (inherited from beryl structure stability); gem-quality Colombian/Zambian emeralds at 300–400°C
- **pH:** 5–9 (beryl-structure silicate; not strongly acid/alkali sensitive)
- **Eh:** Any (Cr³⁺ stable across the sim Eh range; the chromophore state is Cr³⁺ regardless)
- **Consumes:** Be, Al, SiO₂, Cr (or V — take whichever is higher)
- **Optional:** Fe trace (present in all natural emeralds, not a chromophore at typical Fe levels)

### Four real formation paths
1. **Colombia-type (Muzo, Chivor)** — black-shale-hosted hydrothermal. Be from pegmatite source upstream; Cr/V from reduction of Cr-bearing organic/bitumen in shale. Unique deposit type; Phase 1 implementation does **not** model this.
2. **Schist-type (Zambia Kagem, Zimbabwe Sandawana)** — pegmatite intruding Cr-rich chromite schist. Be from pegmatite, Cr from country rock. Partially modeled by Cruzeiro Cr bump.
3. **Pegmatite-only (Urals Russia, Brazil Nova Era)** — pegmatite cutting Cr-bearing peridotite/amphibolite; Cr leaches from wall rock during pegmatite crystallization. **This is what Cruzeiro Cr bump models**.
4. **Skarn-type (Pakistan Swat, Afghanistan Panjshir)** — pegmatite-carbonate interaction. Deferred.

### Key Mechanic
Emerald is the **Cr sequestration variety within the beryl family**. In the split-engine architecture:
- Gate: Be ≥ 10, Al ≥ 6, SiO₂ ≥ 50, **Cr ≥ 0.5 OR V ≥ 1.0** (per the existing inline detector in `grow_beryl`)
- Precedence: emerald fires first if Cr/V are above threshold, suppressing morganite/heliodor/aquamarine in the same pocket (the geology says Cr wins the chromophore contest at typical concentrations)
- Lower nucleation probability than the other varieties (rarer in nature)

**Pseudocode:**
```
IF Be ≥ 10 AND Al ≥ 6 AND SiO2 ≥ 50 AND (Cr ≥ 0.5 OR V ≥ 1.0):
  → nucleate emerald at σ = (Be/15) × (Al/12) × (SiO2/350) × T_window
  deplete: Be, Al, SiO2 (inherited from beryl); Cr by 0.004/rate (or V by 0.005/rate)
  variety priority: emerald > morganite > heliodor > aquamarine > goshenite
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| prism (hex) | default | Short-to-long hexagonal prism, flat basal pinacoid. Cruzeiro/Muzo standard. |
| trapiche | rare high-σ with inclusion trigger | 6-spoke "wheel" pattern (Colombian Muzo specialty) — black inclusion sectors between six green sector crystals. Model as a high-σ + fluid-inclusion-frequency combo. |

### Paragenesis
- **Forms AFTER:** pegmatite early phases (feldspar, quartz); concurrent with schorl tourmaline in Be-B pegmatites
- **Forms BEFORE:** late-stage Mn-bearing phases (morganite, if the pocket chemistry flips to Mn-dominant later)
- **Commonly associated with:** quartz, albite, muscovite, schorl tourmaline, pyrite (especially Colombian type), calcite
- **Substrate preference:** active parent (nucleates on prior pegmatite phases) > wall

### Color
- Default: medium green to deep "emerald green" (Cr³⁺)
- Oil treatment note: natural emeralds are almost universally fracture-filled with cedar oil or polymer — a gemological fact, not a sim concern
- Bluish-green (Colombian): V³⁺-dominant
- Yellowish-green (Sandawana, Zambia): Fe + Cr combination

### Stability
- **Stable:** across beryl-structure T/pH range; no acid dissolution except HF
- **Decomposition:** beryl structure to phenakite + chrysoberyl + SiO₂ above ~900°C

### Notable
- Muzo (Colombia): world's source of top gem emerald for 500 years; paragenesis unique (shale-hosted)
- Kagem (Zambia): largest modern producer; schist-hosted, biotite-rich country rock
- Sandawana (Zimbabwe): small crystals, famously intense color due to high Cr
- Panjshir (Afghanistan): skarn emeralds, mineralogically similar to Colombian
- Nova Era / Itabira (Brazil): pegmatite-only type, the paragenetic analog of Cruzeiro

### Sources
- Giuliani, G. et al. (2019) "Emerald deposits — a review and enhanced classification." *Minerals* 9: 105. [Four-type classification reference]
- Groat, L.A. et al. (2008) "Emerald deposits and occurrences: a review." *Ore Geology Reviews* 34: 87–112.
- Ottaway, T.L. et al. (1994) "Formation of the Muzo hydrothermal emerald deposit in Colombia." *Nature* 369: 552–554. [Colombian paragenesis primary]

---

## 2. Aquamarine — Be₃Al₂Si₆O₁₈ + Fe²⁺

**Class:** Silicate (#1313eb) | **System:** Hexagonal | **H:** 7.5–8
**Formula:** Be₃Al₂Si₆O₁₈

### Identity
- The blue Fe²⁺ variety of beryl. Fe substitutes into both the channel sites and the Al octahedral site; the combination with reducing (or at least non-oxidizing) conditions produces the pale-to-medium blue.
- The most abundant beryl variety — every gem-producing pegmatite yields aquamarine, unlike emerald (Cr needed) or morganite (Mn needed) or heliodor (Fe³⁺ needed).
- Top localities: Minas Gerais Brazil (Cruzeiro, Padre Paraíso, Americana — all Cr-poor biotite-schist or pegmatite hosts), Pakistan Shigar (the "Santa Maria" deep-blue variety), Madagascar, Mozambique, Russia Urals.

### Formation Conditions
- **Temperature:** 300–650°C (beryl stability); optimum 350–550°C
- **pH:** 5–9
- **Eh:** any (Fe²⁺ stable across the sim range; but `grow_beryl` gates `Fe > 15 AND O2 > 0.5` as heliodor, so aquamarine takes the Fe > 8 AND (Fe ≤ 15 OR O2 ≤ 0.5) band)
- **Consumes:** Be, Al, SiO₂, Fe
- **Critical exclusion:** Cr < 0.5, V < 1.0 (else emerald takes priority); Mn < 2.0 (else morganite)

### Key Mechanic
Aquamarine is the **Fe²⁺-dominant variety**. Most of the "pretty" pegmatite output is aquamarine unless the country rock contributes Cr (emerald) or the pocket is late-stage enough to accumulate Mn (morganite).

**Pseudocode:**
```
IF Be ≥ 10 AND Al ≥ 6 AND SiO2 ≥ 50 AND Fe ≥ 8 AND Fe ≤ 15:
  (OR Fe ≥ 8 AND O2 ≤ 0.5, the reducing branch)
  AND Cr < 0.5 AND V < 1.0 AND Mn < 2.0   # priority precedence
  → nucleate aquamarine at σ = (Be/15) × (Al/12) × (SiO2/350) × T_window
  deplete: Be, Al, SiO2, Fe (by 0.008/rate)
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| prism (hex, long) | default, clear growth window | The Cruzeiro "cigarette" — long translucent hexagonal prism. |
| stubby tabular | late/cool stage, T < 380°C | Squat hexagonal, flat pinacoid dominant. |
| etched | late dissolution event | Hexagonal shape with dissolution pits from final acidic pulse. |

### Paragenesis
- Same as emerald but without the Cr source requirement — pure pegmatite hydrothermal history
- Commonly associated with: quartz (often smoky), schorl tourmaline, muscovite, microcline, cleavelandite albite, apatite

### Color
- Default: pale blue to medium blue-green
- Santa Maria: deeply-saturated blue from high Fe + reducing conditions (Pakistan, some Brazilian)
- Bicolor with heliodor: when Fe oxidation flipped mid-growth — the zoned aquamarine/heliodor bicolor crystals from Minas Gerais record this explicitly

### Stability
- Identical to beryl parent — HF-only dissolution (pH < 3 + F > 30)
- No thermal decomposition at sim T range

### Notable
- Cruzeiro mine (Minas Gerais): the canonical Cr-poor biotite-schist Brazilian pegmatite. Deep-blue aquamarine + morganite + schorl + quartz. Anchor locality for `scenario_gem_pegmatite`.
- Shigar Valley (Pakistan): highest-clarity Santa Maria Fe-rich aquamarine; pegmatite cutting biotite-granite
- Mawi Nuristan (Afghanistan): famous deep-blue aquamarine + morganite + tourmaline gem pocket

### Sources
- Černý, P. (2002) "Mineralogy of beryllium in granitic pegmatites." *Mineralogical Magazine* 66: 887–907. [Pegmatite beryl paragenesis]
- Viana, R.R. et al. (2002) "Infrared spectroscopic signatures of beryl varieties from Brazilian pegmatites." *Mineralogy and Petrology* 74: 65–79. [Fe site geometry]

---

## 3. Morganite — Be₃Al₂Si₆O₁₈ + Mn²⁺

**Class:** Silicate (#1313eb) | **System:** Hexagonal | **H:** 7.5–8

### Identity
- The pink-to-peach Mn²⁺ variety of beryl. Mn²⁺ sits in the Al octahedral site; irradiation during geologic history partially oxidizes it to Mn³⁺ which contributes the pink-red hue. Pure Mn²⁺ is the slightly-orange peach; Mn³⁺ pushes to rose-pink.
- Named by George F. Kunz of Tiffany & Co in 1911 after J.P. Morgan — Kunz was the mineralogist responsible for naming half the gem-pegmatite varieties after the men who could afford them (morganite, kunzite = spodumene for his own name, and he almost named tsavorite after Tiffany's current ownership).
- Top gem producers: Madagascar (the pinkest), Minas Gerais Brazil, California San Diego County (Pala District — Stewart Lithia, Himalaya mines), Afghanistan Nuristan.

### Formation Conditions
- **Temperature:** 300–650°C (same as beryl); gem morganite typically forms late in pegmatite cooling at 300–400°C when Mn has accumulated
- **pH:** 5–9
- **Eh:** any
- **Consumes:** Be, Al, SiO₂, Mn
- **Exclusion:** Cr < 0.5, V < 1.0 (else emerald)

### Key Mechanic
Mn accumulates late in pegmatite evolution (partition coefficient with feldspar keeps it in fluid). Morganite fires when Mn crosses 2 ppm — requires late-stage pocket concentrations.

**Pseudocode:**
```
IF Be ≥ 10 AND Al ≥ 6 AND SiO2 ≥ 50 AND Mn ≥ 2.0:
  AND Cr < 0.5 AND V < 1.0   # emerald precedence
  → nucleate morganite at σ = beryl_base × T_window
  deplete: Be, Al, SiO2, Mn (by 0.006/rate)
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular (flat hex) | default | Flat pinacoid-dominated habit — morganite is famous for wide flat plates unlike other beryl varieties. |
| prism (short hex) | moderate σ | Stubby prismatic, less common. |

### Paragenesis
- Late in pegmatite sequence — typically overgrows or intergrows with kunzite (Mn-bearing spodumene) at the last stage
- Commonly associated with: kunzite, cleavelandite albite, muscovite, quartz, lepidolite

### Color
- Default: peach (Mn²⁺ dominant)
- Pink: irradiated, Mn³⁺ contribution (most collector "pink morganite" is natural irradiation product)
- Salmon: intermediate Mn²⁺/Mn³⁺
- The pink fades on heating above 400°C — heat-treated morganite loses its pink and becomes goshenite-like

### Notable
- Pala District (CA): Stewart Lithia and Himalaya mines produced 1990s morganite + kunzite + tourmaline pockets
- Madagascar: the deepest-pink gem morganite
- Minas Gerais Urucum pocket (1995): yielded the largest gem morganite crystal (35+ kg, single cut stone 598 carats)

### Sources
- Hawthorne, F.C. et al. (2014) "Mineralogy of the Spessartite Pegmatite." *Canadian Mineralogist* 52: 467–482. [Mn site partitioning]
- Roda-Robles, E. et al. (2015) "Geochemistry of rare-element granitic pegmatites." *Ore Geology Reviews* 69: 71–93.

---

## 4. Heliodor — Be₃Al₂Si₆O₁₈ + Fe³⁺

**Class:** Silicate (#1313eb) | **System:** Hexagonal | **H:** 7.5–8

### Identity
- The yellow Fe³⁺ variety of beryl. Same Fe cation as aquamarine but in the oxidized 3+ state — oxidation state flip at the fluid level, not a different element.
- The aquamarine/heliodor split is the cleanest redox record in the gem world: a zoned crystal with aquamarine core and heliodor rim captures a fluid that went from reducing to oxidizing mid-growth. Minas Gerais specialty.
- Namibia Volodarsk pegmatite is the type locality for deep-yellow "Namibian heliodor." Urals Russia historically produced it; Madagascar minor source.

### Formation Conditions
- **Temperature:** 300–650°C
- **pH:** 5–9
- **Eh:** **oxidizing** — the distinguishing gate; Fe > 15 AND O₂ > 0.5 per `grow_beryl` current logic
- **Consumes:** Be, Al, SiO₂, Fe
- **Exclusion:** Cr < 0.5, V < 1.0 (else emerald); Mn < 2 (else morganite)

### Key Mechanic
Heliodor is the **oxidized-Fe variety** — splits from aquamarine on the O₂ axis. The same Fe can crystallize as either depending on redox state when the zone was deposited.

**Pseudocode:**
```
IF Be ≥ 10 AND Al ≥ 6 AND SiO2 ≥ 50 AND Fe ≥ 15 AND O2 > 0.5:
  AND Cr < 0.5 AND V < 1.0 AND Mn < 2.0   # priority precedence
  → nucleate heliodor at σ = beryl_base × T_window
  deplete: Be, Al, SiO2, Fe (by 0.008/rate)
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| prism (hex) | default | Medium-length hexagonal prism. |
| tabular | late stage | Flat pinacoid, rare. |

### Paragenesis
- Same as aquamarine; the only difference is whether the pocket fluid is oxidizing at the moment of deposition
- Commonly associated with: smoky quartz (also oxidation-driven), Fe-stained goethite, late hematite

### Color
- Default: greenish yellow to saturated golden yellow
- "Namibian heliodor": deep yellow-orange, Volodarsk-type
- Color is radiation-sensitive — irradiation deepens; heating to 400°C often destroys the color

### Notable
- Volodarsk (Namibia): type locality; pegmatite cross-cutting Fe-rich country rock delivers oxidized Fe
- Urals (Russia): historical source
- Co-occurs with aquamarine in zoned crystals throughout Minas Gerais

### Sources
- Adamo, I. et al. (2008) "Iron-containing beryl: the case of heliodor and yellow beryl." *Gems & Gemology* 44: 241–257. [Iron oxidation-state analysis]
- Taran, M.N. et al. (2018) "Color of beryl: the two-step oxidation pathway." *Physics and Chemistry of Minerals* 45: 881–893.

---

## 5. Corundum — Al₂O₃ (generic, colorless)

**Class:** Oxide (#eb1313) | **System:** Trigonal | **H:** 9 (the benchmark hardness after diamond)
**Formula:** Al₂O₃ | **Density:** 3.95–4.05 g/cm³

### Identity
- Pure aluminum oxide — the structural parent of ruby (Cr-bearing) and sapphire (Fe/Ti-bearing). Hexagonal (trigonal R-3c) close-packed oxygen with Al in 2/3 of the octahedral sites.
- The defining chemical constraint is **SiO₂ undersaturation**: corundum + quartz are mutually exclusive at normal crustal P/T. If silica is present at more than trace levels, the system drives Al + SiO₂ into feldspar, mica, or the Al₂SiO₅ polymorphs (kyanite/andalusite/sillimanite). Corundum requires **Si-poor** chemistry.
- Industrial abrasive (emery = Al₂O₃ + magnetite); gem varieties are ruby + sapphire + the corundum family.

### Formation Conditions
- **Temperature:** 400–1000°C — forms in amphibolite-to-granulite-facies metamorphism, especially where carbonate and aluminous protolith meet (marble contact zones)
- **pH:** 6–10 (metamorphic fluid alkalinity)
- **Pressure:** any (unlike diamond, corundum forms at crustal pressures; the Mogok paragenesis is at 3–5 kbar)
- **Eh:** any — Al³⁺ is Eh-independent
- **Consumes:** Al
- **CRITICAL ANTI-INGREDIENT:** SiO₂ must be below ~50 ppm (the novel upper-bound gate)

### Key Mechanic — the SiO₂ upper gate
This is the first mineral in the sim that gates on an *upper* bound of a fluid field. All existing gates are of the form "X ≥ threshold" (minimum); corundum needs **"SiO₂ < threshold"** (maximum). Implementation note: the gate tests in `tests/test_engine_gates.py` already zero all fields in `test_blocks_when_all_ingredients_zero`, which satisfies the upper gate trivially. The favorable-fluid search in `test_fires_with_favorable_fluid` iterates T/pH/O2/pressure candidates but doesn't set SiO₂ high — so the upper gate won't fire-block the test unless we specifically test for SiO₂-high blocking (optional add).

**Pseudocode:**
```
IF Al ≥ 15 AND SiO2 < 50 AND T 400-1000°C AND pH 6-10:
  → nucleate corundum at σ = (Al/50) × T_window × pH_window
  deplete: Al (by 0.015/rate)
  NO variety trace — pure corundum is colorless/white
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular | default | Flat hexagonal plate, basal pinacoid dominant — the standard contact-metamorphic habit. |
| barrel (dipyramidal) | high-T (>700°C) | Steep dipyramidal "barrel" — common in basalt-hosted sapphire, also Mozambique ruby. |
| prism | moderate | Short hexagonal prism. |
| rhombohedral | rare late | Skewed trigonal form. |

### Paragenesis (Mogok-type, marble-hosted)
- **Forms AFTER:** peak metamorphism; fluid-present annealing of marble
- **Forms BEFORE:** retrograde chlorite/mica
- **Commonly associated with:** calcite, dolomite, phlogopite, chondrodite, spinel, graphite (as inclusions); rutile needles (6-rayed asterism precursor)
- **Substrate preference:** wall (marble contact)

### Color
- Default: white to pale grey; colorless if pure
- Grey (Ti): pale grey from low Ti
- Brown (Fe): pale brown from low Fe
- Pink/red (Cr): the ruby variety (see §6)
- Blue/yellow/green (Fe+Ti, Fe alone, V): the sapphire family (see §7)

### Stability
- **Stable:** ~1500°C (below melting); thermodynamic most-stable form of Al₂O₃ at all crustal-to-mantle P
- **Decomposition:** above 1500°C melts; does not pressure-dissociate within vug range
- **Acid dissolution:** essentially none at any natural T/pH — corundum resists even hot concentrated H₂SO₄

### Notable
- Mogok Stone Tract (Burma): marble-hosted; world's ruby + sapphire + spinel source since 2000+ years ago
- Montepuez (Mozambique): basalt-hosted sapphire + ruby district, active mine
- Ilmen Mts (Russia): metamorphic corundum + sapphirine

### Sources
- Garnier, V. et al. (2008) "Marble-hosted ruby deposits from Central and Southeast Asia: Towards a new genetic model." *Ore Geology Reviews* 34: 169–191. [Mogok paragenesis primary]
- Peretti, A. et al. (2018) "Update on corundum and its gem varieties." *Gems & Gemology* special issue.
- Kerrick, D.M. (1990) "The Al₂SiO₅ Polymorphs." *Reviews in Mineralogy* 22. [Why SiO₂-rich systems produce Al₂SiO₅ polymorphs *instead* of corundum]

---

## 6. Ruby — Al₂O₃ + Cr³⁺

**Class:** Oxide (#eb1313) | **System:** Trigonal | **H:** 9
**Formula:** Al₂O₃ | **Density:** 4.0 g/cm³

### Identity
- The red Cr³⁺ variety of corundum. Cr substitutes for Al in the octahedral site at 100–5000 ppm; the Cr d-d transitions absorb blue-green, transmitting red, and fluoresce strongly red under UV (the "ruby laser" is the same physics).
- Top gem: "pigeon's blood" (Mogok Burma) — medium-dark red with blue undertone from trace Fe + strong Cr fluorescence "lighting from within."
- Pink-ruby / ruby boundary: historically contentious. Current gem industry calls any Cr-colored corundum with saturation above some arbitrary threshold "ruby"; below, "pink sapphire." Sim uses Cr ≥ 2 ppm as the gate (above that, enough Cr for "ruby"; below, pink-sapphire or colorless corundum).

### Formation Conditions
- Same as corundum + **Cr ≥ 2 ppm**
- T: 500–1000°C (slightly narrower than corundum; gem ruby at 600–900°C)
- pH: 6–10
- **Critical:** SiO₂ < 50 (shared corundum upper gate)

### Key Mechanic
Ruby is Cr-bearing corundum. Cr source is marble-adjacent ultramafic country rock, or Cr-bearing fluid infiltration during skarn formation. The Cr source is why Mogok (marble + peridotite protolith) is the world's top ruby locality while most other marbles produce only colorless corundum.

**Pseudocode:**
```
IF Al ≥ 15 AND SiO2 < 50 AND Cr ≥ 2.0 AND T 500-1000°C AND pH 6-10:
  → nucleate ruby at σ = (Al/50) × (Cr/5) × T_window × pH_window
  deplete: Al (by 0.015/rate), Cr (by 0.003/rate)
  priority: ruby > corundum when Cr ≥ 2
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tabular (flat hex) | default Mogok | Flat hexagonal plate. |
| barrel (dipyramidal) | Mozambique/Madagascar basalt-hosted | Steep dipyramid, "barrel" shape. |
| asterated (6-rayed star) | rutile-inclusion trigger | 6-rayed asterism from aligned rutile needles along basal; rare 12-rayed star-ruby. |

### Paragenesis
- Marble-hosted type (Mogok): forms with phlogopite, spinel, chondrodite at ruby grade; within dolomitic marble
- Basalt-hosted type (Mozambique/Vietnam): forms as xenocrysts in alkali basalt — the ruby crystallized in deep mafic rock, got entrained in erupting basalt; this path is similar to diamond-xenocryst-in-kimberlite but at crustal depth
- Common assoc: phlogopite, spinel, chondrodite, graphite (as inclusions), rutile (as needle inclusions for asterism), calcite

### Color
- Default: red (Cr³⁺)
- "Pigeon's blood" (Mogok): high-saturation red with blue undertone — Cr + trace Fe combo + strong red fluorescence
- "Cherry" (Burma classical): medium-saturation red, medium-dark tone
- "Pink ruby" (low Cr 2–5 ppm): light red; borderline with pink sapphire

### Fluorescence
- **Strong red under LW + SW UV** — diagnostic. Cr³⁺ emission at 694 nm. The reason Burma rubies look lit-from-within: natural daylight contains enough UV to excite the fluorescence.
- Mogok Burma rubies: strong fluorescence (low Fe, low quenching)
- Thai basalt-hosted rubies: weaker fluorescence (high Fe quenches Cr emission)

### Stability
- Same as corundum — effectively permanent in vug environments

### Notable
- Mogok Stone Tract (Burma): marble-hosted, 2000+ years of production
- Mong Hsu (Burma): 1990s-discovered marble-hosted ruby district
- Luc Yen (Vietnam): marble-hosted, similar paragenesis to Mogok
- Winza (Tanzania): metamorphic host, 2008-discovered
- Montepuez (Mozambique): basalt-hosted, world's largest active producer since 2012

### Sources
- Garnier et al. 2008 (primary, as above)
- Peretti et al. 2018 (update)
- Simonet, C. et al. (2008) "A classification of gem corundum deposits aimed towards gem exploration." *Ore Geology Reviews* 34: 127–133.

---

## 7. Sapphire — Al₂O₃ + (Fe + Ti) or Fe alone, etc.

**Class:** Oxide (#eb1313) | **System:** Trigonal | **H:** 9
**Formula:** Al₂O₃

### Identity
- The non-red corundum varieties. Sapphire is the catch-all name for any Cr-free (or low-Cr) corundum with a color: blue (Fe²⁺-Ti⁴⁺ intervalence charge transfer), yellow (Fe³⁺), green (Fe alone), violet (V), pink (low-Cr, subthreshold to ruby), padparadscha (Cr + trace Fe — pink-orange), and others.
- The dominant non-ruby gem corundum; volumetrically larger market than ruby.
- Blue is the most iconic color. "Kashmir cornflower blue" = the classic; "royal blue" (deeper Fe); "Ceylon blue" (lighter, Sri Lanka).

### Formation Conditions
- Same as corundum base + **(Fe ≥ 5 AND Ti ≥ 0.5)** for blue, OR **Fe ≥ 20 alone** for yellow, OR **V ≥ 2** for violet
- T: 500–1000°C
- pH: 6–10
- **Critical:** SiO₂ < 50

### Key Mechanic
Sapphire variety is a multi-gate color dispatch. Gate order:
1. `Cr ≥ 2` → ruby (handled separately)
2. `Fe ≥ 5 AND Ti ≥ 0.5` → blue sapphire (this is the charge-transfer mechanism)
3. `Fe ≥ 20 alone` → yellow sapphire (Fe³⁺)
4. `V ≥ 2` → violet sapphire (rare; Tanzania)
5. `Cr + Fe both low-moderate` → padparadscha (pink-orange; Sri Lanka, Mozambique)
6. `low Cr < 2` → pink sapphire
7. else → colorless corundum

**Pseudocode:**
```
IF Al ≥ 15 AND SiO2 < 50 AND Fe ≥ 5 AND Ti ≥ 0.5 AND T 500-1000°C AND pH 6-10:
  → nucleate blue sapphire at σ = (Al/50) × (Fe/15) × (Ti/2) × T_window × pH_window
  deplete: Al (by 0.015/rate), Fe (by 0.005/rate), Ti (by 0.002/rate)
IF Al ≥ 15 AND SiO2 < 50 AND Fe ≥ 20 (no Ti) AND T 500-1000 AND pH 6-10:
  → nucleate yellow sapphire
```

### Habits
| Variant | Trigger | Description |
|---|---|---|
| barrel (dipyramidal) | default basalt-hosted | Steep dipyramid — the Montana Yogo form. |
| tabular | marble-hosted | Flat hex plate. |
| prism | intermediate | Short hex prism. |
| asterated (6- or 12-rayed) | rutile-inclusion trigger | Star sapphire — rutile needles at basal produce the 6-rayed asterism; rare 12-rayed. |

### Color rules
- **Cornflower blue:** Fe + Ti, Kashmir — low Fe + perfect Ti balance gives the diagnostic "velvet" look (microscale silk inclusions scatter light)
- **Royal blue:** deeper Fe, Burma/Ceylon
- **Ceylon blue:** moderate Fe + Ti
- **Yellow:** Fe³⁺ alone — Sri Lanka, Montana
- **Green:** Fe alone, no Ti — Australia, Montana
- **Pink sapphire:** Cr < 2 ppm (below ruby gate)
- **Padparadscha:** Cr + trace Fe combination producing pink-orange; Sri Lanka + Madagascar + Mozambique
- **Violet:** V-rich; Tanzania + Tanzania
- **Color-change:** chromium + vanadium + iron combination producing blue-under-daylight, purple-under-incandescent; Umba Valley Tanzania

### Paragenesis
- Marble-hosted type (Kashmir historical, Mogok): same as ruby minus Cr, plus Fe/Ti
- Basalt-hosted type (Yogo Montana, Thailand, Cambodia, Australia): xenocrysts in alkali basalt
- Alluvial (Sri Lanka, Madagascar): eroded from primary host, concentrated in gem gravel
- Assoc: spinel, zircon, rutile, magnetite (inclusions giving silk + asterism)

### Fluorescence
- **Weak** compared to ruby; Fe quenches fluorescence
- Yellow sapphire: weak orange fluorescence (Fe³⁺)
- Padparadscha: weak pinkish-orange fluorescence (Cr)
- Blue sapphire: typically inert

### Stability
- Same as corundum — permanent

### Notable
- Kashmir (India): world's finest "cornflower blue" — mined out 1880s–1930s; specimens are million-dollar heirlooms now
- Yogo Gulch (Montana): basalt-hosted cornflower blue, intact deposit, small crystals
- Sri Lanka (Ratnapura): alluvial district; every color variety
- Madagascar (Ilakaka): largest modern producer of gem sapphire
- Thailand/Cambodia (Chanthaburi): basalt-hosted, heat-treated to enhance

### Sources
- Simonet et al. 2008 (basalt-hosted, primary)
- Peretti et al. 2018 (update)
- Emmett, J.L. et al. (2003) "Beryllium diffusion of ruby and sapphire." *Gems & Gemology* 39: 84–135. [Industry-relevant on treatment + color]

---

## Paragenetic groups

### Group A: Pegmatite gem family (beryl split)

Cruzeiro / Minas Gerais scenario. All four beryl varieties nucleate within `scenario_gem_pegmatite` given the small Cr bump. Competition order (engineered via supersat gate preconditions):

**Emerald > Morganite > Heliodor > Aquamarine > Goshenite**

Justification:
- Emerald first: Cr paradox + rarity; when Cr is present, it wins the chromophore race by orders of magnitude (Cr³⁺ is 100× more efficient chromophore than Fe²⁺ at equal ppm)
- Morganite second: Mn is the second-rarest-of-the-common chromophores in pegmatite fluid
- Heliodor: Fe + oxidizing — narrower window than aquamarine
- Aquamarine: the default Fe-dominant variety
- Goshenite: fallback when no chromophore is above threshold

Test: `test_scenario_seed42_matches_baseline[gem_pegmatite]` will capture the new variety-named output post-bump.

### Group B: Marble contact metamorphism (corundum split)

`scenario_marble_contact_metamorphism` (new in Commit 4). Mogok-anchored. Competition order:

**Ruby > Sapphire-blue > Sapphire-yellow > Sapphire-pink > Corundum (colorless)**

Justification:
- Ruby first if Cr ≥ 2
- Blue sapphire second if Fe ≥ 5 AND Ti ≥ 0.5 (the intervalence charge transfer is a well-characterized gem chromophore)
- Yellow sapphire if Fe ≥ 20 alone
- Pink sapphire (subthreshold Cr, 0.5–2 ppm) falls into the sapphire family via the color dispatch inside `grow_sapphire`
- Corundum (colorless) fires when none of the chromophore gates clear

All share the **SiO₂ < 50** upper gate and `T 500–1000°C, pH 6–10` base.

---

## Implementation notes

### Beryl refactor (Commit 2) — step-by-step

Current `grow_beryl` (vugg.py ~5030) does inline variety detection. After refactor:

1. Strip inline variety logic from `grow_beryl` — it becomes pure goshenite:
   ```python
   # goshenite — no chromophore above threshold
   crystal.habit = "goshenite"
   ```
2. Keep beryl's supersaturation function + add the exclusion preconditions:
   ```python
   # Only fire beryl/goshenite if no variety's chromophore is above gate
   if (f.Cr >= 0.5 or f.V >= 1.0 or f.Mn >= 2.0 or f.Fe >= 8.0):
       return 0  # let a variety engine handle this
   ```
3. Each new variety engine's supersaturation gate includes the exclusion preconditions for higher-priority siblings (see per-species pseudocode above).
4. Deplete logic per variety handles its specific chromophore (emerald→Cr, aquamarine→Fe, etc.).

### Corundum SiO₂ upper-gate (Commit 3) — critical novelty

**Add this as the FIRST check in all three supersaturation functions:**

```python
def supersaturation_corundum(self) -> float:
    """Corundum (Al₂O₃) — SiO₂-undersaturated Al-rich chemistry."""
    if self.fluid.Al < 15:
        return 0
    if self.fluid.SiO2 > 50:
        return 0  # corundum + quartz are mutually exclusive; SiO2+Al2O3 → feldspar/mica/sillimanite
    # ... rest of supersaturation
```

The upper-bound gate is the defining chemistry. `tests/test_engine_gates.py::test_blocks_when_all_ingredients_zero` sets all fields to zero (satisfies upper gate). `test_fires_with_favorable_fluid` iterates candidates — set `SiO2=10` in the sweep for corundum family so the upper gate doesn't trivially block the search. Check that the favorable_fluid search helper produces a viable candidate.

Consider adding a dedicated test: `test_corundum_family_blocks_at_high_SiO2` that asserts σ = 0 when `fluid.SiO2 > 50`. Future-proofs the novel gate.

### Marble contact metamorphism scenario (Commit 4)

Shape: function in vugg.py modeled on `scenario_gem_pegmatite`. Events:
- `ev_peak_metamorphism` at step 20 → T = 800°C for 5 steps, Al and trace metals increase as contact fluid concentrates
- `ev_retrograde_cooling` at step 60 → T drops to ~400°C, fluid migrates
- `ev_fracture_seal` at step 150 → closing the system

Initial fluid:
```python
fluid = FluidChemistry(
    Al=50, SiO2=20, Ca=800,  # SiO2 critically low (upper gate)
    Cr=3, Fe=8, Ti=1, V=0.5,
    pH=8.0, salinity=3,
    O2=0.5, temperature=700,
)
```

Wall: marble (if supported; otherwise limestone — check `data/locality_chemistry.json` + existing scenarios).

Locality chemistry file: add `mineral_realizations_v7_gemstones` block for:
- **Cruzeiro** (updated with Cr bump + beryl variety realizations)
- **Mogok** (new entry) anchoring `marble_contact_metamorphism`

### Test expectations after Round 7

- Mineral count: 62 → 69 (+7 net; goshenite reuses `beryl` slot)
- Parameterized tests: +7 species × 8 per-mineral tests = +56. Total: 754 → ~810
- Scenario baselines: 12 → 13 (add marble_contact_metamorphism)
- SIM_VERSION: 5 → 7 (Commit 2 bumps 5→6 for beryl split; Commit 3 bumps 6→7 for corundum + new scenario)
- Drift checks: still zero

---

## Sources (consolidated)

### Beryl family
- Černý, P. (2002) "Mineralogy of beryllium in granitic pegmatites." *Mineralogical Magazine* 66: 887–907.
- Giuliani, G. et al. (2019) "Emerald deposits — a review and enhanced classification." *Minerals* 9: 105.
- Groat, L.A. et al. (2008) "Emerald deposits and occurrences: a review." *Ore Geology Reviews* 34: 87–112.
- Viana, R.R. et al. (2002) "Infrared spectroscopic signatures of beryl varieties from Brazilian pegmatites." *Mineralogy and Petrology* 74: 65–79.
- Hawthorne, F.C. et al. (2014) "Mineralogy of the Spessartite Pegmatite." *Canadian Mineralogist* 52: 467–482.
- Adamo, I. et al. (2008) "Iron-containing beryl: the case of heliodor and yellow beryl." *Gems & Gemology* 44: 241–257.
- Ottaway, T.L. et al. (1994) "Formation of the Muzo hydrothermal emerald deposit in Colombia." *Nature* 369: 552–554.
- Roda-Robles, E. et al. (2015) "Geochemistry of rare-element granitic pegmatites." *Ore Geology Reviews* 69: 71–93.
- Taran, M.N. et al. (2018) "Color of beryl: the two-step oxidation pathway." *Physics and Chemistry of Minerals* 45: 881–893.

### Corundum family
- Garnier, V. et al. (2008) "Marble-hosted ruby deposits from Central and Southeast Asia: Towards a new genetic model." *Ore Geology Reviews* 34: 169–191.
- Peretti, A. et al. (2018) "Update on corundum and its gem varieties." *Gems & Gemology* special issue.
- Simonet, C. et al. (2008) "A classification of gem corundum deposits aimed towards gem exploration." *Ore Geology Reviews* 34: 127–133.
- Kerrick, D.M. (1990) "The Al₂SiO₅ Polymorphs." *Reviews in Mineralogy* 22.
- Emmett, J.L. et al. (2003) "Beryllium diffusion of ruby and sapphire." *Gems & Gemology* 39: 84–135.
