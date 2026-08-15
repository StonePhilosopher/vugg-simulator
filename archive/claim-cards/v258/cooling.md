# CLAIM CARD — cooling  (v258, seed 42, 100 steps)

**Anchor:** Herkimer 'diamond' pocket — Middleville, NY (Little Falls Formation, Cambrian dolostone)
**Deposit:** Doubly-terminated clear quartz from a Cambrian dolostone vug at peak Alleghenian burial. Slow-grown, low-σ ordered crystallization — the textbook 'cooling' archetype.
**Initial:** 180 °C, 1 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** a570f57e12063cf5f9df30c6f8b453afb210efd88adf9a6f75da7925dbc3a7f1

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** quartz
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Selleck 1978 — Mohawk Valley stratigraphy + Little Falls Formation host
  - Harris et al. 1978 USGS PP 1197 — Alleghenian thermal maturity
  - Friedman & Sanders 1982 Geology 10 — Appalachian burial diagenesis
  - Rimstidt 1997 — quartz solubility at 180°C
  - Hanor 1994 — Appalachian-basin brine compendium (Mg/Ca, Na/K, salinity)
  - Wark & Watson 2006 — TitaniQ thermometer Ti-in-quartz

## Paragenetic order as grown (1 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | quartz | 13 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 179.99404 → 158.26685435471157 °C  [158.26685435471157, 179.99404] (raw_simulation_state)
  - pH: 6.8 → 6.8   [6.8, 6.8] (raw_simulation_state)
  - Eh: -74.99999999999999 → -74.99999999999999 mV  [-74.99999999999999, -74.99999999999999] (raw_simulation_state)
  - salinity: 18 → 18 psu  [18, 18] (raw_simulation_state)
  - O2: 0.1 → 0.1 mg/L  [0.1, 0.1] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -1.512 → -1.26  [-1.512, -1.26]
  - SI_aragonite: -1.638 → -1.323  [-1.638, -1.323]
  - SI_dolomite: -4.346 → -3.843  [-4.346, -3.843]
  - SI_HMC: -1.449 → -1.197  [-1.449, -1.197]
  - SI_siderite: -0.819 → -0.63  [-0.819, -0.63]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.420 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 72.70 °C; initial a_w=0.990 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=1.85863584; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +1.859 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.939984232; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.940 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.89651731; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.897 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.764478512; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.764 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.7211260079999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.721 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.752527384; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.753 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1 → 1 kbar [1, 1], n=100
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=100
  - Temperature: 179.99404 → 158.26685435471157 °C [158.26685435471157, 179.99404], n=100
  - Secure aragonite assessment: 0/100 executed steps; first={"boundary_kbar":2.4196062595405183,"secure_aragonite":false}, last={"boundary_kbar":2.4299166463968858,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":100}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Herkimer-type double-terminated quartz crystals occur in isolated vugs of the Little Falls Formation, an Upper Cambrian dolostone in the Mohawk Valley.

> (The audit brief drafted 'Lockport Dolostone' — that is Silurian and hosts different mineralization; Herkimer's host is the Little Falls Formation, confirmed by Selleck 1978 and multiple state geological summaries.)

> The quartz itself crystallized much later, during Alleghenian burial diagenesis in the Carboniferous (~340-300 Ma), when the section reached >3 km depth and ~140-200°C.

> Silica was liberated by pressure solution and hydrocarbon cracking in adjacent shales, then precipitated free-floating crystals in silica-overpressured pockets that were also saturated with petroleum and saline basinal brine — hence the two-phase enhydro + anthraxolite inclusions diagnostic of Herkimer specimens.

> All fluid values cite locality_chemistry.json#localities.herkimer_middleville. The sim uses abstracted sim-scale ppm, not raw brine concentrations.

> Signature: clear, doubly-terminated quartz. Minimal carbonate competition (most Ca/CO3 has sequestered as dolomite cement in the host rock).

> Data gaps: no widely-indexed modern microthermometry study publishes Th and Tm_ice specifically for Herkimer pocket quartz; the 140-200°C window is inferred from regional Alleghenian thermal maturity (Harris et al. 1978; Friedman & Sanders 1982). LA-ICP-MS of Herkimer fluid inclusions has not appeared in open literature; ratios are imported from Hanor 1994 Appalachian-basin averages.

> v184 BURIAL THERMAL STORY (NAICA-SHAPE — the only events:[] scenario in the T-rollout): the movement below holds peak Alleghenian burial (180°C, smoothstep −20 across the run → ends ~158) instead of the old ambient regime, where the drift fell out of the 140-200°C window and 2-3 random pulses happened to balance it back in (band occupancy 65-86% by ACCIDENT — noise as load-bearing thermal budget, the deccan lesson at a different scenario). With the declared plateau: window occupancy 100%, pulses 0 — and crystal count drops 3→1 at every observed seed. One large doubly-terminated crystal IS the Herkimer signature (sustained low σ → no fresh nucleation → the García-Ruiz fewer-nuclei mechanism, same as naica v182): a 3km-deep Cambrian dolostone in burial diagenesis has no magmatic heat source, hence thermal_pulses:false alongside (the flag matters only past endStep; the movement owns every in-run step).
