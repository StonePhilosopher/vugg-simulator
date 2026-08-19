# CLAIM CARD — reactivated_fluorite_vein  (v254, seed 42, 160 steps)

**Anchor:** North Pennine Orefield style (Weardale district, England) — a fluorite-galena-barite vein on a reactivated fault (Dunham 1990, BGS Economic Memoir).
**Deposit:** A crack-seal reactivated vug. An ascending brine grows a first generation (fluorite + galena + barite, with sphalerite + calcite gangue) while its feeder fractures are OPEN; a late cement then seals the conduit shut and the cavity goes quiet; a later tectonic pulse breaches the fracture open again, and a cooler fresh fluid grows a second-generation fluorite + calcite. The demonstrator for the fluid-spots SEAL → BREACH lifecycle: the deposition-clustering halo follows the open feeders, so each generation concentrates at the vents and the sealed interval shows no clustering.
**Initial:** 180 °C, 0.3 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 306744468d5177ec42186b8aa7d14790ab16ef80e6ea8fa15038aafb0fb5273a

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
  - Godinho, Piazolo & Evins (2012) — Effect of surface orientation on dissolution rates and topography of CaF2, Geochimica et Cosmochimica Acta 86, 392-403, doi:10.1016/j.gca.2012.02.032.
  - Cama, Ayora & Lasaga (2010) — The deviation-from-equilibrium effect on dissolution rate and on apparent variations in activation energy, Geochimica et Cosmochimica Acta 74, 4298-4311, doi:10.1016/j.gca.2010.04.067.
  - Dell'Angelo et al. (2025) — Unravelling the cleavage-rate relationship from both the experimental and theoretical standpoint: The instance of fluorite dissolution, Journal of Colloid and Interface Science 684, 844-855, doi:10.1016/j.jcis.2024.12.242.

## Paragenetic order as grown (12 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | rhodochrosite | 1 | 1 | 0 | nucleation |
| 3 | siderite | 1 | 1 | 0 | nucleation |
| 4 | acanthite | 20 | 4 | 0 | nucleation |
| 5 | fluorite | 20 | 1 | 0 | nucleation |
| 6 | galena | 20 | 4 | 0 | nucleation |
| 7 | pyrite | 20 | 1 | 0 | nucleation |
| 8 | sphalerite | 20 | 1 | 0 | nucleation |
| 9 | barite | 21 | 28 | 0 | nucleation |
| 10 | greenockite | 22 | 5 | 0 | nucleation |
| 11 | celestine | 23 | 5 | 0 | nucleation |
| 12 | chalcedony | 61 | 3 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** rhodochrosite, siderite, acanthite, pyrite, greenockite, celestine, chalcedony
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 179.53623849458992 → 72.76878843065354 °C  [25, 179.53623849458992] (raw_simulation_state)
  - pH: 7.2 → 6.5200000000000005   [4.44, 7.2] (raw_simulation_state)
  - Eh: 24.4850021680094 → 24.4850021680094 mV  [24.4850021680094, 703.0899869919435] (raw_simulation_state)
  - salinity: 15 → 15 psu  [2.9, 15] (raw_simulation_state)
  - O2: 0.25 → 0.25 mg/L  [0.25, 8] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.378 → 0  [-6.74, 0.819]
  - SI_aragonite: 0.315 → -0.126  [-6.866, 0.693]
  - SI_dolomite: -0.063 → -0.819  [-8, 0.378]
  - SI_HMC: -1.323 → -1.512  [-8, -0.882]
  - SI_siderite: 1.575 → -8  [-8, 2.205]
  - SI_selenite: -8 → -8  [-8, -0.882]
  - SI_anhydrite: -8 → -8  [-8, -1.008]
  - SI_barite: -8 → -8  [-8, 1.512]
  - SI_celestine: -8 → -8  [-8, -0.63]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.420 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 62.41 °C; initial a_w=0.991 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.6131692409999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.613 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.310786303; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.311 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.296897945; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.297 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.254547565; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.255 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.241655511; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.242 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.251729373; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.252 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.3 → 0.001 kbar [0.001, 0.3], n=160
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=160
  - Temperature: 179.53623849458992 → 72.76878843065354 °C [25, 179.53623849458992], n=160
  - Secure aragonite assessment: 0/160 executed steps; first={"boundary_kbar":2.419589812250558,"secure_aragonite":false}, last={"boundary_kbar":2.6905100124450456,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":160}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> DEMONSTRATOR, honestly framed: this scenario exercises the crack-seal SEAL→BREACH mechanic on a North-Pennine-style fluorite-galena-barite vein. The chemistry is DESIGNED (reverse-from-engines) on an mvt-analog NaCl-CaCl2 basinal brine, not lifted from a specific mine's fluid-inclusion dataset — so the broth is a faithful archetype, not a measured locality record. North Pennine veins are textbook reactivated-fault systems with repeated fluid pulses (Dunham 1990); the crack-seal reopening mechanism is Ramsay 1980 (Nature).

> Two generations plus a bounded dissolution analogue: STAGE 1 (feeders open, steps 0-78) — the ascending brine fires fluorite + galena + barite (+ sphalerite, calcite) at the open vents. SEAL (step 78) — carbonate/silica cement chokes the feeder, flow stalls, and the clustering halo switches off. ACIDIC BREACH WASH (step 118) — reopening admits a 21°C, pH 3.6, I≈0.05 molal NaCl ionic-strength analogue of Godinho et al. (2012)'s {100} fluorite experiment. The game uses a fixed-pH closed return path, unlike the source experiment's NaClO4 bath renewed every 48 h, so the transferred rate carries unquantified systematic uncertainty. MINERALIZING RECHARGE (step 119) — a distinct F-Ca-carbonate brine grows gen-2 fluorite + calcite and progressively heals the dissolution relief.

> Why limestone wall: North Pennine fluorite veins cut Carboniferous limestone (the Great Limestone and equivalents); the reactive carbonate wall supplies background Ca + CO3, consistent with the calcite gangue in both stages. Architecture 'tabular' = fracture-controlled / vein-bounded, the right cavity archetype for a vein (vs the karst 'irregular' of mvt).

> Calibration note: stage-1 F=4 ppm plus the step-20 mixing pulse opens the fluorite gate while keeping seed-42 gen-1 fluorite in the smooth cubic surface-state envelope required by the dissolution analogue. Stepped/hopper cubes are rejected because a common {100} normal does not reproduce Godinho's cleaned nominal-(001) step-site state. Deposition clustering shifts spatial competition, so exact counts differ from generic MVT.
