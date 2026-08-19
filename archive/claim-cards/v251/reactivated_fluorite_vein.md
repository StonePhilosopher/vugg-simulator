# CLAIM CARD — reactivated_fluorite_vein  (v251, seed 42, 160 steps)

**Anchor:** North Pennine Orefield style (Weardale district, England) — a fluorite-galena-barite vein on a reactivated fault (Dunham 1990, BGS Economic Memoir).
**Deposit:** A crack-seal reactivated vug. An ascending brine grows a first generation (fluorite + galena + barite, with sphalerite + calcite gangue) while its feeder fractures are OPEN; a late cement then seals the conduit shut and the cavity goes quiet; a later tectonic pulse breaches the fracture open again, and a cooler fresh fluid grows a second-generation fluorite + calcite. The demonstrator for the fluid-spots SEAL → BREACH lifecycle: the deposition-clustering halo follows the open feeders, so each generation concentrates at the vents and the sealed interval shows no clustering.
**Initial:** 180 °C, 0.3 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** a468d4e66b438f087168150c1283fa8757e51bce9bf2e0e38adaa83ac726d0a0

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (5):** fluorite, galena, barite, calcite, sphalerite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Dunham, K.C. (1990) — Geology of the Northern Pennine Orefield, Vol. 1 (2nd ed.), British Geological Survey Economic Memoir.
  - Ramsay, J.G. (1980) — The crack-seal mechanism of rock deformation, Nature 284.
  - Bons, Elburg & Gomez-Rivas (2012) — A review of the formation of tectonic veins and their microstructures, Journal of Structural Geology.

## Paragenetic order as grown (12 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | fluorite | 1 | 1 | 0 | nucleation |
| 3 | rhodochrosite | 1 | 1 | 0 | nucleation |
| 4 | siderite | 1 | 1 | 0 | nucleation |
| 5 | acanthite | 20 | 4 | 0 | nucleation |
| 6 | galena | 20 | 4 | 0 | nucleation |
| 7 | pyrite | 20 | 1 | 0 | nucleation |
| 8 | sphalerite | 20 | 1 | 0 | nucleation |
| 9 | barite | 21 | 36 | 0 | nucleation |
| 10 | greenockite | 22 | 5 | 0 | nucleation |
| 11 | celestine | 23 | 7 | 0 | nucleation |
| 12 | chalcedony | 61 | 6 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** rhodochrosite, siderite, acanthite, pyrite, greenockite, celestine, chalcedony
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 180.118 → 76.772 °C  [76.772, 180.118]
  - pH: 7.22 → 6.724   [6.724, 7.22]
  - Eh: 25.197 → 25.197 mV  [25.197, 25.197]
  - salinity: 14.961 → 14.961 psu  [14.961, 14.961]
  - O2: 0.236 → 0.236 mg/L  [0.236, 0.236]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.378 → 0.378  [0.126, 0.819]
  - SI_aragonite: 0.315 → 0.252  [0, 0.693]
  - SI_dolomite: 0.504 → -0.252  [-0.504, 0.945]
  - SI_HMC: -1.323 → -1.197  [-1.575, -0.882]
  - SI_siderite: 1.89 → 2.205  [1.89, 2.457]
  - SI_selenite: -8 → -0.882  [-8, -0.882]
  - SI_anhydrite: -8 → -0.945  [-8, -0.756]
  - SI_barite: -8 → 1.953  [-8, 1.953]
  - SI_celestine: -8 → -0.504  [-8, -0.441]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.420 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 62.41 °C; initial a_w=0.991 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.3 → 0.3 kbar [0.3, 0.3], n=160
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=160
  - Temperature: 179.53623849458992 → 76.48933207545434 °C [76.48933207545434, 179.53623849458992], n=160
  - Secure aragonite assessment: 0/160 executed steps; first={"boundary_kbar":2.419589812250558,"secure_aragonite":false}, last={"boundary_kbar":2.6718678374544154,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":160}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> DEMONSTRATOR, honestly framed: this scenario exercises the crack-seal SEAL→BREACH mechanic on a North-Pennine-style fluorite-galena-barite vein. The chemistry is DESIGNED (reverse-from-engines) on an mvt-analog NaCl-CaCl2 basinal brine, not lifted from a specific mine's fluid-inclusion dataset — so the broth is a faithful archetype, not a measured locality record. North Pennine veins are textbook reactivated-fault systems with repeated fluid pulses (Dunham 1990); the crack-seal reopening mechanism is Ramsay 1980 (Nature).

> Two generations: STAGE 1 (feeders open, steps 0-78) — the ascending brine fires fluorite + galena + barite (+ sphalerite, calcite) clustering at the open vents, reusing the proven generic fluid_mixing (step 20) + fluid_pulse (step 60) brine events. SEAL (step 78) — a carbonate/silica cement chokes the feeder (spots:'seal'); T drops to ~150°C, flow stalls, the clustering halo switches off. STAGE 2 (breach, step 118) — tectonic reactivation reopens the conduit (spots:'breach'); a cooler fresh pulse (F +16, CO3 +130) grows second-generation fluorite + late calcite at the reopened vents.

> Why limestone wall: North Pennine fluorite veins cut Carboniferous limestone (the Great Limestone and equivalents); the reactive carbonate wall supplies background Ca + CO3, consistent with the calcite gangue in both stages. Architecture 'tabular' = fracture-controlled / vein-bounded, the right cavity archetype for a vein (vs the karst 'irregular' of mvt).

> Calibration note: stage-1 assemblage tracks the mvt scenario (same brine + the same two generic brine events), so fluorite/galena/barite/sphalerite/calcite are expected to fire; deposition clustering shifts spatial competition so exact counts will differ from mvt. Any first-pass miss is aspirational — tune via vugg-tune-scenario, don't inflate the broth.
