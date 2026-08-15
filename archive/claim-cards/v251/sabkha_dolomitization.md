# CLAIM CARD — sabkha_dolomitization  (v251, seed 42, 260 steps)

**Anchor:** Coorong lagoon system (South Australia) and Persian Gulf sabkhas. The classic natural laboratory for direct-from-solution dolomite formation per Kim, Sun et al. 2023 (Science 382:915).
**Deposit:** Cycling-brine sabkha producing ORDERED dolomite at ambient T via the Kim 2023 mechanism. Twelve flood/evap pulses over 240 steps drive Ω across the dolomite saturation boundary repeatedly — the cyclic Ω modulation that's needed to produce ordered dolomite at surface T.
**Initial:** 25 °C, 0.05 kbar, wall=basin
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** ad7bf2ea0d7b718e123f35d79bf73f0f65c31f41990f146798301f81b02a6ed7

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (3):** dolomite, anhydrite, selenite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Kim, Sun et al. 2023 (Science 382:915) — cyclic Ω modulation produces ordered dolomite at ambient T
  - Coorong lagoon (South Australia) + Persian Gulf sabkhas — natural laboratory anchors

## Paragenetic order as grown (7 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | aragonite | 1 | 1 | 0 | nucleation |
| 2 | calcite | 1 | 15 | 0 | nucleation |
| 3 | dolomite | 1 | 1 | 0 | nucleation |
| 4 | HMC | 1 | 37 | 0 | nucleation |
| 5 | selenite | 1 | 5 | 104 | nucleation; anhydrite -> selenite |
| 6 | celestine | 5 | 6 | 0 | nucleation |
| 7 | anhydrite | 20 | 5 | 114 | nucleation; selenite -> anhydrite |

**Surprises (present but absent from all authored expectation tiers):** aragonite, calcite, HMC, celestine
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 29.528]
  - pH: 8.874 → 9.26   [8.102, 9.26]
  - Eh: 289.764 → 289.764 mV  [289.764, 289.764]
  - salinity: 119.685 → 200 psu  [34.646, 200]
  - O2: 1.496 → 1.496 mg/L  [1.496, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 1.764 → 3.654  [0, 3.78]
  - SI_aragonite: 1.575 → 3.528  [-0.189, 3.654]
  - SI_dolomite: 4.346 → 8  [0.819, 8]
  - SI_HMC: 0.819 → 2.772  [-0.945, 2.835]
  - SI_siderite: 2.079 → 3.843  [0.567, 3.969]
  - SI_selenite: 0.504 → 1.953  [0.315, 1.953]
  - SI_anhydrite: 0.315 → 1.953  [0.126, 2.016]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: 0.945 → 2.583  [0.693, 2.646]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.989 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.919 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=260
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=260
  - Temperature: 25 → 25 °C [25, 30.79753743512556], n=260
  - Secure aragonite assessment: 0/260 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":260}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Transformation step 20: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 20: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 21: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 22: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 23: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 30: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 30: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 30: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 30: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 30: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 40: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 41: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 42: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 50: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 60: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 70: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 80: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 90: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 100: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 110: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 120: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 130: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 140: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 150: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 160: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 170: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 180: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 190: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 200: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 210: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 220: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 230: anhydrite → selenite (anhydrite-rehydration)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Transformation step 240: selenite → anhydrite (gypsum-to-anhydrite-replacement)
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Surface T (~25°C), high-Mg evaporative brine, seasonal flood-evaporate cycles. Per Kim, Sun et al. (2023, Science 382:915), exactly this kind of cyclic Ω modulation is what's needed to produce ordered dolomite at ambient T.

> The acid-pulse-and-relax style of reactive_wall produces only DISORDERED HMC because the dissolution events are too aggressive (full dissolution rather than gentle surface etch). Sabkha tidal pumping is the right kind of cycling — gentle, frequent, repeated.

> Twelve flood/evap pairs over 240 steps produce ~12 dissolution-precipitation cycles. With N0=10 in the f_ord formula, this reaches ORDERED (f_ord > 0.7) by mid-scenario. The result: true ordered dolomite, the geological prize the Kim 2023 paper made accessible.

> Schema note: the original Python/JS implementations used factory functions `make_flood(idx)` and `make_evap(idx)` to bake the cycle index into each handler's narrator string. Per the Phase 2 migration, we use one flood handler and one evap handler reused across all 12 cycles (the supergene_acidification precedent — same handler, multiple Event entries pointing to it). Cycle number is preserved via the event `name` field ('Tidal Flood #1', 'Evaporation #1', etc.) instead of an in-handler f-string.
