# CLAIM CARD — deccan_zeolite  (v257, seed 42, 200 steps)

**Anchor:** Deccan Traps zeolite vesicle (Stage III, ~21-58 Ma post-eruption). Nashik 'bloody apophyllite' is the type expression. Per Ottens et al. 2019.
**Deposit:** Patient zeolite-stage paragenesis in cooled basalt vesicles. Stage I silica veneer + Stage II zeolite blades + Stage III alkaline K-Ca-Si-F pulse builds pseudo-cubic apophyllite around hematite-needle phantoms.
**Initial:** 250 °C, 0.05 kbar, wall=spherical
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** d9e8c5581258dc87d9209b367f65065795f997cda0814e0197b80bc5b7ad3c22

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (8):** hematite, chalcedony, quartz, scolecite, mesolite, stilbite, heulandite, apophyllite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (2):** thomsonite — A genuine but rare regional Deccan zeolite, excluded from this specific Ottens/Sukheswala Savda–Nashik paragenetic archetype rather than asserted absent from the province.; chabazite — A documented regional Deccan zeolite, excluded from this specific Ottens/Sukheswala Savda–Nashik paragenetic archetype because the chosen cavity sequence does not place it.

**Cited sources:**
  - Sukheswala, Avasia & Gangopadhyay 1974, Mineralogical Magazine 39:658–671 — Western Deccan cavity sequence: scolecite+mesolite first among zeolites, followed by heulandite+stilbite, with apophyllite among the last volatile-bearing phases
  - Ottens et al. 2019, Minerals 9:351, doi:10.3390/min9060351 — Savda multistage model and late Stage-III apophyllite timing (21–58 Ma)
  - Pinch & Wilson 1977 — Nashik 'bloody apophyllite' phantom inclusions

## Paragenetic order as grown (14 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | chalcedony | 21 | 4 | 0 | nucleation |
| 2 | hematite | 35 | 1 | 0 | nucleation |
| 3 | quartz | 55 | 3 | 0 | nucleation |
| 4 | albite | 70 | 2 | 0 | nucleation |
| 5 | calcite | 70 | 1 | 0 | nucleation |
| 6 | pectolite | 70 | 4 | 0 | nucleation |
| 7 | scolecite | 70 | 1 | 0 | nucleation |
| 8 | mesolite | 87 | 1 | 0 | nucleation |
| 9 | heulandite | 90 | 4 | 0 | nucleation |
| 10 | stilbite | 90 | 4 | 0 | nucleation |
| 11 | apophyllite | 110 | 1 | 0 | nucleation |
| 12 | feldspar | 110 | 1 | 0 | nucleation |
| 13 | prehnite | 110 | 1 | 0 | nucleation |
| 14 | goethite | 160 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite, calcite, pectolite, feldspar, prehnite, goethite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 249.65217887093968 → 67.68840124993606 °C  [67.68840124993606, 249.65217887093968] (raw_simulation_state)
  - pH: 8.2 → 8   [8, 8.8] (raw_simulation_state)
  - Eh: 290.4365036222725 → 220 mV  [201.69700377572994, 290.4365036222725] (raw_simulation_state)
  - salinity: 2 → 2 psu  [2, 2] (raw_simulation_state)
  - O2: 1.5 → 1 mg/L  [0.9, 1.5] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -8 → 1.066  [-8, 2.016]
  - SI_aragonite: -8 → 0.945  [-8, 1.89]
  - SI_dolomite: -8 → 0.756  [-8, 2.709]
  - SI_HMC: -8 → 0.945  [-8, 1.89]
  - SI_siderite: -8 → 3.402  [-8, 4.535]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.541 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.1700192; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.170 relative to 1 bar at the same temperature.
    - siderite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - rhodochrosite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - anhydrite: active; active=true; ΔlogK=0.07483716; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.075 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.07135259; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.071 relative to 1 bar at the same temperature.
    - celestine: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 249.65217887093968 → 67.68840124993606 °C [67.68840124993606, 249.65217887093968], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.539328347357973,"secure_aragonite":false}, last={"boundary_kbar":2.7170389176700853,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> The selected Savda–Nashik archetype follows observed cavity relationships rather than pretending every regional Deccan zeolite belongs to one vug: a silica lining is followed by scolecite+mesolite, then heulandite+stilbite, then the late apophyllite-bearing hydrothermal stage. Sukheswala et al. 1974 documents the fibrous-before-sheet pairwise order; Ottens et al. 2019 documents the late Stage-III apophyllite pulse. Thomsonite and chabazite remain globally available but are excluded from this specific authored cavity.

> Compared to the metamorphic / hydrothermal scenarios, this is gentle: no acid pulses, no dramatic T excursions. The story is patient crystallization in alkaline groundwater over geologic time.

> v184 thermal honesty (T-rollout close-out) — THREE coupled changes, dark-observed together (tools/t-story-observe.mjs, 3 seeds): (1) thermal_pulses:false — the note above says 'no dramatic T excursions' and the ambient mechanic was firing 5-8 of them per run; (2) cooling_rate 0.3 — with pulses gone, the default 1.5°C/step crashed the vesicle to the floor between the stage events (a cooling flow stack declines gently over ~37 My, the scenario's own 'patient' thesis); (3) the movements block below — a sustained fluid.SiO2 setpoint (950) through the Stage III window. The dark observation EXPOSED a structural noise-dependence: apophyllite's gate needs SiO2 ≥ 800 and the random pulses' +50-300 SiO2 riders were the scenario's de-facto silica budget (the stage_iii event's one-shot +600 — already bumped from 300 once for exactly this reason — gets eaten by background quartz depletion). Ottens calls Stage III 'the long-lasting late stage' (21-58 Ma): a SUSTAINED groundwater regime is the honest model, and on vesicle timescales the percolating aquifer is an infinite reservoir — so the movement PINS SiO2 at 950 for the window rather than shooting it once. Result: all three expects at all seeds (apophyllite was LOST under flag-only variants), fill IMPROVES 0.07-0.18 → 0.28-0.30, and the noise-fed extras (rhodochrosite = pulse-Mn, wollastonite = a skarn mineral that never belonged in an amygdale) drop out.

> Audit gap-fill (Apr 2026): Sr=2 — Deccan zeolites (heulandite, stilbite, mesolite) carry Sr substituting for Ca, sometimes 100s of ppm in the mineral. Sim-scale 2 ppm in the parent fluid documents the source. Brief-required non-zero Mg already covered by Mg=8.
