# CLAIM CARD — gem_pegmatite  (v254, seed 42, 230 steps)

**Anchor:** Cruzeiro mine, São José da Safira, Doce Valley, Minas Gerais (Variant A — Brasiliano-age miarolitic gem pegmatite, 700-450 Ma).
**Deposit:** Miarolitic cavity in a complex zoned pegmatite. The residual pocket where incompatible elements (Be, B, Li, F) accumulate beyond belief, then cross saturation in cascade — schorl → beryl → spodumene + elbaite → late topaz, with kaolinization of the microcline walls at the end.
**Initial:** 650 °C, 3 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** b114712f212637f29d7bf9aaf3a29cc83dbcbe02ffb8267ba094813f30af8eac

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (6):** tourmaline, spodumene, feldspar, albite, lepidolite, cassiterite
**Statistical (0):** (none)
**Aspirational (1):** topaz — A documented late pegmatite phase, but absent from the release seed audit; retained as a future F-Al pocket-stage tuning target rather than a deterministic promise.
**Locality exclusions (0):** (none)

**Cited sources:**
  - Morteani et al. 2002 — fluid chemistry of Brazilian gem pegmatites
  - Cassedanne 1991 — Cruzeiro mine paragenesis
  - Proctor 1985 — Cruzeiro tourmaline + beryl mineralogy
  - London 2008 — pegmatite fluid Al partition (~150 ppm upper bound)

## Paragenetic order as grown (8 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 2 | 0 | nucleation |
| 2 | emerald | 1 | 2 | 0 | nucleation |
| 3 | feldspar | 1 | 2 | 0 | nucleation |
| 4 | lepidolite | 1 | 3 | 0 | nucleation |
| 5 | quartz | 1 | 3 | 0 | nucleation |
| 6 | spodumene | 1 | 1 | 0 | nucleation |
| 7 | tourmaline | 1 | 2 | 0 | nucleation |
| 8 | cassiterite | 6 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** emerald, quartz
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** topaz
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 648.2608943547123 → 276.1096062884666 °C  [276.1096062884666, 648.2608943547123] (raw_simulation_state)
  - pH: 6.8 → 4.409999999999996   [3.53, 7] (raw_simulation_state)
  - Eh: -74.99999999999999 → -74.99999999999999 mV  [-74.99999999999999, -74.99999999999999] (raw_simulation_state)
  - salinity: 6 → 6 psu  [6, 6] (raw_simulation_state)
  - O2: 0.1 → 0.1 mg/L  [0.1, 0.1] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -3.78 → -8  [-8, -3.402]
  - SI_aragonite: -3.906 → -8  [-8, -3.528]
  - SI_dolomite: -7.181 → -8  [-8, -6.488]
  - SI_HMC: -5.48 → -8  [-8, -5.102]
  - SI_siderite: -0.441 → -5.417  [-7.181, -0.063]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 7.743 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 102.10 °C; initial a_w=0.996 ±0.020 (temperature-extrapolation)
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
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 3 → 3 kbar [3, 3], n=230
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=230
  - Temperature: 648.2608943547123 → 276.1096062884666 °C [276.1096062884666, 648.2608943547123], n=230
  - Secure aragonite assessment: 0/230 executed steps; first={"boundary_kbar":7.7041468185785416,"secure_aragonite":false}, last={"boundary_kbar":2.6458322675189927,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":135,"unconstrained":95}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Cruzeiro is the type-locality for fine schorl-elbaite tourmaline + smoky quartz pockets, with documented beryl, spodumene, lepidolite, and accessory apatite. Brasiliano-age (Neoproterozoic) pegmatite field cutting Macaúbas Group meta-sediments. Morteani et al. 2002 covers fluid chemistry; Cassedanne (1991) and Proctor (1985) cover the Cruzeiro-specific paragenesis.

> Thermal regime: 650 → 300°C over ~230 steps in three phases. Phase 1 (650-550°C): wall-zone crystallization (microcline, quartz, early schorl). Phase 2 (550-400°C): main pocket growth — beryl finally nucleates when Be crosses threshold; spodumene when Li crosses; schorl transitions to elbaite as Fe depletes and Li accumulates. Phase 3 (400-300°C): late hydrothermal — topaz if F survives, then kaolinization of microcline walls.

> Saturation cascade mechanic: there is no explicit 'nucleate beryl now' command. Each mineral's supersaturation formula reads the current fluid, and the nucleation gates fire in order naturally as chemistry evolves — microcline first (K-feldspar = feldspar here), then the Be/Li/B gates cross as incompatible elements build up.

> v183 thermal_pulses:false — the PEGMATITE-SHAPE T story (contrast naica's v182 movement): all eight events SET temperature (620→560→500→450→420→360→320→300), so the three-phase curve is already fully event-anchored and a declared movement would clobber it. The fix is silencing the ambient noise around it: a sealed miarolitic pocket has no fracture-valve hot injections (the pocket IS the isolated residual chamber), the pulses' Fe riders (+2-15 ppm) directly fight the li_phase event's documented Fe depletion (Fe→5 is what turns schorl into elbaite), and a late pulse was re-warming the ended system to ~476°C against the design's 300°C floor (dark-observed, tools/t-story-observe.mjs: end T 476→276 with the flag; assemblage and crystal counts IDENTICAL at 3 seeds — the v181 dedicated thermal stream means a thermal-regime change no longer re-rolls the nucleation cascade). Topaz remains aspirational at seed 42 (absent in BASE too — its tuning is a separate vugg-tune-scenario arc; the honest T floor can only help it).

> Audit gap-fills (Apr 2026): P=8 (pegmatite residual P; enables Cruzeiro accessory apatite per Cassedanne 1991). Mg=5 (brief-required non-zero baseline; pegmatite pocket fluids are Mg-poor since Mg partitions strongly into outer-shell biotite/chlorite during pegmatite differentiation).
