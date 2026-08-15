# CLAIM CARD — marble_contact_metamorphism  (v254, seed 42, 180 steps)

**Anchor:** Mogok Stone Tract, Mandalay Region, Burma — type locality for marble-hosted ruby + 2000+-year source of 'pigeon's blood' rubies
**Deposit:** Marble-hosted contact metamorphic vug — Al-rich, SiO2-undersaturated skarn fluid drives corundum-family (ruby/sapphire) paragenesis.
**Initial:** 500 °C, 3 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 6760433d44fe528ba3fa583418f7b3b8d10d6df705c0c3022aa242ca69439a11

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** calcite, ruby
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Ferrill D.A. et al. 2004 (J. Struct. Geol. 26:1521) — calcite twin morphology Type I-IV geothermometer
  - Burkhard M. 1993 (J. Struct. Geol. 15:351) — calcite twins as strain/T gauge; Turner 1953 (Am. J. Sci. 251:276)
  - Garnier et al. 2008 (Ore Geology Reviews 34:169-191) — Marble-hosted ruby deposits from Central and Southeast Asia
  - Peretti et al. 2018 (Gems & Gemology special issue) — Update on corundum and its gem varieties
  - Searle et al. 2007 (Journal of Geology 115:1-23) — Tectonic evolution of the Mogok metamorphic belt, Burma (Myanmar)

## Paragenetic order as grown (2 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | ruby | 20 | 1 | 0 | nucleation |
| 2 | calcite | 150 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 498.2608943547122 → 302.91959656914685 °C  [302.91959656914685, 698.5688353108242] (raw_simulation_state)
  - pH: 8 → 8.3   [8, 8.3] (raw_simulation_state)
  - Eh: 44.280313679915594 → 44.280313679915594 mV  [44.280313679915594, 44.280313679915594] (raw_simulation_state)
  - salinity: 2 → 2 psu  [2, 2] (raw_simulation_state)
  - O2: 0.3 → 0.3 mg/L  [0.3, 0.3] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.126 → 0.504  [0.126, 0.504]
  - SI_aragonite: 0 → 0.378  [0, 0.378]
  - SI_dolomite: 0.567 → 1.323  [0.567, 1.323]
  - SI_HMC: -1.575 → -1.197  [-1.575, -1.197]
  - SI_siderite: 1.26 → 1.638  [1.26, 1.638]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 4.892 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 102.10 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-250 C promoted Ksp(T) envelope; no extrapolation.
    - siderite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - rhodochrosite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - anhydrite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-300 C promoted Ksp(T) envelope; no extrapolation.
    - barite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-300 C promoted Ksp(T) envelope; no extrapolation.
    - celestine: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Stress/overprint step 165: marble_tectonic_strain — authored visual deformation overprint

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 3 → 3 kbar [3, 3], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 498.2608943547122 → 302.91959656914685 °C [302.91959656914685, 698.5688353108242], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":4.865588379224611,"secure_aragonite":false}, last={"boundary_kbar":2.788029798255387,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":125,"unconstrained":55}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchored to the Mogok Stone Tract: dolomitic marble of the Mogok Metamorphic Belt was regionally metamorphosed during the Himalayan orogeny (~30 Ma) to amphibolite-to-granulite grade, then intruded by leucogranite dykes at 17-22 Ma that drove contact metamorphic ruby/sapphire/spinel crystallization in skarn envelopes.

> Chemistry signature: SiO2 undersaturation (the defining corundum-family constraint). Al and Ca are high, SiO2 is low — opposite of every other scenario in the sim. When SiO2 is scarce, Al3+ cannot form feldspar/mica/Al2SiO5 polymorphs and instead crystallizes as pure corundum; with Cr trace from adjacent ultramafic country rock, ruby forms; with Fe+Ti, blue sapphire; with Fe alone, yellow sapphire.

> Thermal regime: 500 → 700 → 500 → 350°C over 180 steps. Phase 1 (initial warmup): contact metamorphic pulse approaches; marble starts to fluid-saturate. Phase 2 (700°C peak, step 20): corundum family nucleates; Cr partitions to ruby, Fe+Ti to blue sapphire. Phase 3 (retrograde cooling, step 60, 700→500°C): main growth window; fluid migrates along skarn bleaching front. Phase 4 (fracture seal, step 150): system closes.

> v184 thermal_pulses:false (PEGMATITE-SHAPE, T-rollout close-out): the events anchor the single-intrusion arc (700@20, 500@60) and the default ambient drift correctly carries the 500→350 retrograde slope — but the random ambient pulses had no geological home here (the scenario models ONE leucogranite contact episode; designed reheats belong in events) and their Fe riders (+2-15 ppm) poison the chromophore budget this scenario exists to control (Cr→ruby vs Fe/Ti→blue vs Fe-alone→yellow partitioning at a wall with deliberately Fe-poor 200 ppm). Dark-observed clean at 3 seeds (tools/t-story-observe.mjs): expects (calcite, ruby) intact, retrograde end honest (403→303).

> Wall composition is 'limestone' as a proxy for dolomitic marble — sim currently models limestone + pegmatite + basalt; marble is the metamorphosed limestone end-member, closest fit available.
