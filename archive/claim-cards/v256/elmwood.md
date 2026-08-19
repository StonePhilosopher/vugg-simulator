# CLAIM CARD — elmwood  (v256, seed 42, 200 steps)

**Anchor:** Elmwood-Gordonsville mines (Carthage, Smith County, TN) — Central Tennessee MVT district; the world-reference stepped golden calcite scalenohedra, on honey sphalerite with purple fluorite + barite, in Knox Group paleokarst breccia
**Deposit:** The stepped-calcite showcase (calcite-morphology arc Phase 5). A waning MVT system: NaCl-CaCl2-MgCl2 basinal brine drops honey sphalerite, then fluorite + barite, and as the system cools, episodic brine expulsions (seismic pumping) drive an oscillating carbonate supply — the sigma curve crosses the stepped band again and again, and the late golden scalenohedral calcite records every pulse as a macrostep terrace. Watch them build.
**Initial:** 120 °C, 0.2 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 6ef9b2550639c2f1d208d8656ec5d1d6860c61a841566a21b3326c8da262ef46

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (4):** sphalerite, fluorite, barite, calcite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Gratz & Misra 1987 (Econ. Geol. 82) — Elmwood-Gordonsville fluid-inclusion microthermometry
  - Misra & Lu 1992 — Central Tennessee zinc district paragenesis
  - Kyle 1976 / district literature — Knox unconformity paleokarst breccia ore control
  - RESEARCH-calcite-morphology-2026-06-11.md §2 — oscillatory sigma -> step bunching (Movements as the driver)
  - Sibson 1992 fault-valve mechanics — episodic brine expulsion (the pulse-train shape)

## Paragenetic order as grown (9 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | fluorite | 15 | 1 | 0 | nucleation |
| 3 | galena | 15 | 1 | 0 | nucleation |
| 4 | pyrite | 15 | 1 | 0 | nucleation |
| 5 | siderite | 15 | 1 | 0 | nucleation |
| 6 | sphalerite | 15 | 2 | 0 | nucleation |
| 7 | barite | 16 | 12 | 0 | nucleation |
| 8 | celestine | 86 | 6 | 0 | nucleation |
| 9 | chalcedony | 126 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** galena, pyrite, siderite, celestine, chalcedony
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 119.99514125 → 53.26575310471258 °C  [53.26575310471258, 119.99514125] (raw_simulation_state)
  - pH: 7.1 → 8.224301335386027   [7.1, 8.407418576202472] (raw_simulation_state)
  - Eh: 24.4850021680094 → 24.4850021680094 mV  [24.4850021680094, 24.4850021680094] (raw_simulation_state)
  - salinity: 21 → 21 psu  [21, 21] (raw_simulation_state)
  - O2: 0.25 → 0.25 mg/L  [0.25, 0.25] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.693 → 1.827  [0.693, 2.583]
  - SI_aragonite: 0.567 → 1.764  [0.567, 2.457]
  - SI_dolomite: 0.567 → 3.276  [0.496, 4.157]
  - SI_HMC: 0.63 → 1.953  [0.63, 2.52]
  - SI_siderite: 1.323 → 3.15  [1.323, 3.654]
  - SI_selenite: -8 → -0.882  [-8, -0.819]
  - SI_anhydrite: -8 → -1.197  [-8, -0.945]
  - SI_barite: -8 → 2.205  [-8, 2.205]
  - SI_celestine: -8 → -0.441  [-8, -0.315]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.503 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 60.94 °C; initial a_w=0.988 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.3598611525; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.360 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.18191145999999997; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.182 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.171840952; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.172 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.14664092950000002; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.147 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.140978401; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.141 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.1456838835; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.146 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Stress/overprint step 70: tectonic_shock — resolved-shear threshold pulse; fluid pressure unchanged; no creep law

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.2 → 0.2 kbar [0.2, 0.2], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 119.99514125 → 53.26575310471258 °C [53.26575310471258, 119.99514125], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.503188304433579,"secure_aragonite":false}, last={"boundary_kbar":2.7991023476133186,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress step 70: σdiff=50 MPa; affected crystal IDs=[]; outcomes={"below_crss":1}
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Elmwood-Gordonsville (Central Tennessee zinc district). Fluid inclusions per Gratz & Misra 1987 (Econ. Geol. 82): sphalerite Th ~90-150°C, NaCl-CaCl2-MgCl2 brines ~20-23 wt% NaCl-eq. Ore in paleokarst/collapse breccias of the upper Knox Group beneath the post-Knox unconformity.

> Paragenesis (Misra & Lu 1992; district consensus): replacement dolomite -> honey-amber sphalerite (main ore) -> purple fluorite + barite (galena minor in Central TN, unlike Tri-State) -> GIANT GOLDEN CALCITE LAST, scalenohedral, stepped faces + phantoms, often perched on sphalerite; bitumen/oil inclusions give the golden body color (the district carries live hydrocarbons).

> Mg:Ca ~0.2 — a dolostone-buffered MgCl2-bearing brine (the host IS dolostone; Gratz & Misra report Mg-rich inclusions). Above the 0.15 elongation threshold (GCA 2015 / Phase 4): the form axis makes the late calcite SCALENOHEDRAL at low T, which is exactly what Elmwood grows. Mn kept at 4 (below the manganocalcite branch's >5 gate) with Fe 8 — Elmwood calcite is golden dogtooth, not botryoidal manganocalcite.

> The movements are the showcase: a naica-shape cooling trend (120 -> 55°C, the waning system) + a fluid.CO3 PULSE TRAIN in the late half (five gaussian brine-expulsion pulses, the MVT seismic-pumping mechanism — Sibson-style fault-valve episodicity). Each pulse pushes calcite sigma up through the stepped band and relaxes back: the oscillation IS the step-bunching driver (research doc §2 — the steps are the chemistry curve made solid).

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshot, 2026-07-25 — the region's full mineral list incl. sub-localities, 11 valid): Baryte (+ var. Strontium-bearing Baryte), Calcite, Celestine (+ var. Barium-bearing Celestine), Dolomite, Fluorite, Galena, Marcasite, 'Petroleum var. Bitumen', Pyrite, Quartz, 'Silica', Sphalerite, Vaterite. This is the TERMINAL-VERIFICATION list for this scenario (the specimen-record test): (a) NO gypsum-family mineral — corroborates the boss's selenite ruling ('selenite disappearing is good'), the S2-selenite migration's elmwood death is record-licensed; (b) SIDERITE is NOT on the list but the elmwood-snowball variety guard currently requires it — census flag for a future pass (same de-confabulation family as aragonite v228?); (c) unfired-but-documented at elmwood: marcasite, pyrite, quartz, vaterite, bitumen (the golden-calcite color note already cites the hydrocarbons) — candidates if the scenario ever deepens; (d) Sr-bearing baryte variety on the list supports the S1 sulfate story; Ba-bearing celestine supports the S2 blanket. Boss action noted in the bridge: capture the same mindat list for the other mine scenarios.
