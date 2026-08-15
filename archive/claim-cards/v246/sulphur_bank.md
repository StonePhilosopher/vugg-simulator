# CLAIM CARD — sulphur_bank  (v246, seed 42, 200 steps)

**Anchor:** Sulphur Bank Mine, south shore of Clear Lake, Lake County, California — Pleistocene hot-spring mercury-sulfur deposit. Active hot-spring system since ~150,000 years ago; mined for mercury 1865-1957 (one of California's largest Hg producers). Now EPA Superfund site CAD980893275. The textbook hot-spring quicksilver-sulfur deposit per White & Roberson 1962 (USGS PP 432-A).
**Deposit:** Hot-spring mercury-sulfur deposit at the surface mixing zone where rising H₂S-rich fluid meets atmospheric O₂. Headline minerals: native sulfur (from partial oxidation 2 H₂S + O₂ → 2 S° + 2 H₂O) and cinnabar (HgS, the deposit's mining commodity — Sulphur Bank yielded ~450 tons of mercury 1865-1957). The elemental-sulfur reaction itself produces no acid; the measured pH 2-4 belongs to the source acid-sulfate fluid and to more-complete sulfur oxidation outside this modeled branch. Accessory As-sulfides realgar (orange-red AsS) and orpiment (golden-yellow As₂S₃) deposit in the mixing zone. Supporting silica is modeled as opal when its own low-temperature, pH, and concentration gates are met—not cosmetically relabeled quartz.
**Initial:** 75 °C, 0.001 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-pressure+booked-transition+chemistry-competition-v4|surface-growth:mass-booked-area+lining+crust+asbestos+druse-representatives-v1|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 983e0f505a5390c6b2711620994eac13438b7430d0834cde117a035823427a41

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (7):** native_sulfur, cinnabar, realgar, orpiment, pararealgar, pyrite, marcasite

**Cited sources:**
  - White D.E. and Roberson C.E. (1962) — Sulphur Bank, California, a major hot-spring quicksilver deposit. USGS Professional Paper 432-A.
  - White D.E. (1981) — Active geothermal systems and hydrothermal ore deposits. Economic Geology 75th Anniversary Volume.
  - Donnelly-Nolan J.M., Burns M.G., Goff F.E., Peters E.K., Thompson J.M. (1993) — The Geysers - Clear Lake area, California: thermal waters, mineralization, volcanism, and geothermal potential. Economic Geology 88: 301-316.
  - EPA Superfund site CAD980893275 — Sulphur Bank Mercury Mine. Site monitoring records 1990-present document continuous hot-spring activity at the vent zone.

## Paragenetic order as grown (9 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | cinnabar | 0 | 6 |
| 2 | marcasite | 0 | 1 |
| 3 | metacinnabar | 0 | 3 |
| 4 | orpiment | 0 | 6 |
| 5 | realgar | 0 | 6 |
| 6 | native_sulfur | 27 | 6 |
| 7 | chalcedony | 31 | 4 |
| 8 | pyrite | 31 | 1 |
| 9 | opal | 92 | 13 |

**Surprises (grown but NOT in expects_species):** metacinnabar, chalcedony, opal
**No-shows (expected but never nucleated):** pararealgar

## Environment trajectory (first → last, [min,max])
  - T: 73.819 → 44.291 °C  [23.622, 76.772]
  - pH: 1.874 → 6.504   [1.709, 6.559]
  - Eh: 77.165 → 77.165 mV  [77.165, 77.165]
  - salinity: 3.937 → 3.937 psu  [3.937, 3.937]
  - O2: 0.394 → 0.394 mg/L  [0.394, 0.394]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -8 → -2.583  [-8, -2.268]
  - SI_aragonite: -8 → -2.709  [-8, -2.331]
  - SI_dolomite: -8 → -5.228  [-8, -4.661]
  - SI_HMC: -8 → -3.78  [-8, -3.654]
  - SI_siderite: -8 → 0  [-8, 0.189]
  - SI_selenite: -8 → -7.433  [-8, -7.417]
  - SI_anhydrite: -8 → -7.507  [-8, -7.467]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.001 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.679 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.01 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.001 → 0.001 kbar [0.001, 0.001], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 73.26089435471222 → 45.677745719812826 °C [25, 77.47047671591864], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.688006134388484,"secure_aragonite":false}, last={"boundary_kbar":2.846285761475845,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Sulphur Bank Mine, the canonical hot-spring native-sulfur deposit. White & Roberson 1962 (USGS PP 432-A) is the foundational monograph; White 1981 placed it in the broader active-geothermal-ore-deposit framework. The deposit was the type case for the 'hot-spring mercury-sulfur' class. Active hot springs still vent today (60-90°C; the EPA Superfund record documents continuous monitoring 1990s-present).

> Engine fit (SIM 243): H₂S recharge adds only to S_sulfide. Each open-air mixing event imports and consumes the exact O₂ mass required by H₂S + ½O₂ → S° + H₂O, transfers sulfur into S_elemental with zero sulfur loss, and records zero proton production for that reaction. Native-sulfur growth can debit only S_elemental; coexisting sulfides debit S_sulfide and cannot spend the same sulfur twice.

> Habit dispatcher: the engine's three habits are sublimation_crust (T > 60 + excess > 1.5; fumarole vent zone), prismatic_beta (T ≥ 95; rare high-T monoclinic), and bipyramidal_alpha (the iconic Sicilian {111} dipyramid habit, < 60°C). The scenario starts at 75°C — sublimation_crust at high σ, bipyramidal_alpha after cooling pulses. Both habits real for Sulphur Bank.

> Mercury: the namesake commodity (cinnabar, HgS) isn't in MINERAL_SPEC yet — a follow-up commit can add it for the full Sulphur Bank assemblage. For now the scenario carries trace Fe + As to fire pyrite + marcasite alongside the headline native_sulfur.

> ARSENOPYRITE WITHDRAWN from expects_species (v228, hostile-review rung 2 — the tormiq/mvt de-confabulation precedent): White & Roberson 1962's own ore list is cinnabar, marcasite, pyrite, dolomite, calcite, quartz, zeolite, ± metacinnabar, stibnite — no arsenopyrite; the USGS stable-isotope mineral set for the mine likewise lacks it, and FeAsS is a ≥200°C mineral (Kretschmar & Scott calibration; Carlin fluids 180-240°C) that a 50-77°C spring cannot grow. Pre-v228 it fired here only because the declared T_min 200 was unenforced. The promise was the confabulation; the As stays in the broth and reports through the documented low-T As phases.

> ⚠ VERIFY (rung-2 research pass, 2026-07-14): the earlier note claiming White & Roberson list realgar + orpiment as accessory species could NOT be re-verified this pass (the monograph's ore list above omits them; mindat loc-3491 was unreachable). They are geologically consistent with an As-bearing acid-sulfate spring and STAY in expects_species for now — but check the mindat species table when reachable, and if they are absent there too, they owe the same withdrawal arsenopyrite got.
