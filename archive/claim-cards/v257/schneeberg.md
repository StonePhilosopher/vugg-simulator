# CLAIM CARD — schneeberg  (v257, seed 42, 160 steps)

**Anchor:** Schneeberg, Erzgebirgskreis (Saxony Ore Mountains), Germany — type locality for torbernite (1772), zeunerite (1872), uranospinite (1873), and ten more uranyl arsenate-phosphate species. Walpurgis Flacher vein, Weisser Hirsch Mine.
**Deposit:** Schneeberg / Erzgebirge oxidized uranium-pegmatite vein system (Walpurgis Flacher vein, Weisser Hirsch Mine, Saxony — type locality for torbernite, zeunerite, and uranospinite). A U-bearing pegmatite + chalcopyrite + arsenopyrite primary assemblage weathers under meteoric oxidation; the resulting uranyl + Cu + As fluid plates the autunite-group secondaries in two cation phases — Cu-rich first (torbernite emerald greens then zeunerite as As-pulse arrives), then Ca-dominant after Cu is consumed (autunite + uranospinite, the bright LW-UV fluorescent yellows).
**Initial:** 450 °C, 1.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** eef3a58e24fbd1c521b86551910cc1bebbdf70a97cde24757549adab92d98451

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (13):** uraninite, torbernite, zeunerite, autunite, uranospinite, native_bismuth, native_arsenic, erythrite, annabergite, cobaltite, nickeline, cassiterite, pharmacolite
**Statistical (0):** (none)
**Aspirational (1):** haidingerite — A possible pharmacolite dehydration product, but no executed conversion appeared in the release seed audit for Schneeberg.
**Locality exclusions (0):** (none)

**Cited sources:**
  - Pinch & Wilson 1977 — canonical Schneeberg/Erzgebirge monograph
  - Weisbach 1872 — zeunerite type description (Walpurgis Flacher vein)
  - Weisbach 1873 — uranospinite type description (Weisser Hirsch Mine)
  - Klaproth 1789 — uranium discovery in Schneeberg pitchblende
  - research/minerals/research-uranospinite.md (May 2026) — cation-fork mechanic + paragenesis

## Paragenetic order as grown (35 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | argentite | 1 | 4 | 0 | nucleation |
| 2 | feldspar | 1 | 2 | 0 | nucleation |
| 3 | morganite | 1 | 1 | 0 | nucleation |
| 4 | quartz | 1 | 3 | 0 | nucleation |
| 5 | spodumene | 1 | 1 | 0 | nucleation |
| 6 | uraninite | 1 | 3 | 0 | nucleation |
| 7 | arsenopyrite | 4 | 4 | 0 | nucleation |
| 8 | cobaltite | 4 | 4 | 0 | nucleation |
| 9 | nickeline | 4 | 4 | 0 | nucleation |
| 10 | cassiterite | 6 | 4 | 0 | nucleation |
| 11 | topaz | 7 | 2 | 0 | nucleation |
| 12 | proustite | 20 | 2 | 0 | nucleation |
| 13 | tennantite | 20 | 1 | 0 | nucleation |
| 14 | native_arsenic | 37 | 3 | 0 | nucleation |
| 15 | native_bismuth | 70 | 1 | 0 | nucleation |
| 16 | naumannite | 70 | 2 | 0 | nucleation |
| 17 | native_silver | 71 | 3 | 0 | nucleation |
| 18 | acanthite | 75 | 0 | 4 | argentite -> acanthite |
| 19 | chrysocolla | 88 | 5 | 0 | nucleation |
| 20 | opal | 89 | 5 | 0 | nucleation |
| 21 | brochantite | 90 | 3 | 0 | nucleation |
| 22 | cuprite | 90 | 1 | 0 | nucleation |
| 23 | dioptase | 91 | 4 | 0 | nucleation |
| 24 | turquoise | 91 | 2 | 0 | nucleation |
| 25 | torbernite | 94 | 1 | 0 | nucleation |
| 26 | annabergite | 105 | 1 | 0 | nucleation |
| 27 | erythrite | 105 | 1 | 0 | nucleation |
| 28 | uranophane | 105 | 3 | 0 | nucleation |
| 29 | goethite | 110 | 2 | 0 | nucleation |
| 30 | zeunerite | 110 | 4 | 0 | nucleation |
| 31 | autunite | 131 | 4 | 0 | nucleation |
| 32 | pharmacolite | 145 | 5 | 0 | nucleation |
| 33 | uranospinite | 145 | 4 | 0 | nucleation |
| 34 | metatorbernite | 149 | 0 | 1 | torbernite -> metatorbernite |
| 35 | metazeunerite | 149 | 0 | 4 | zeunerite -> metazeunerite |

**Surprises (present but absent from all authored expectation tiers):** argentite, feldspar, morganite, quartz, spodumene, arsenopyrite, topaz, proustite, tennantite, naumannite, native_silver, acanthite, chrysocolla, opal, brochantite, cuprite, dioptase, turquoise, uranophane, goethite, metatorbernite, metazeunerite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** haidingerite
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 448.26089435470954 → 18 °C  [18, 448.26089435470954] (raw_simulation_state)
  - pH: 6.5 → 6.51585   [6.15, 6.51585] (raw_simulation_state)
  - Eh: -200 → 322.1090020413224 mV  [-200, 322.1090020413224] (raw_simulation_state)
  - salinity: 6 → 6 psu  [6, 6] (raw_simulation_state)
  - O2: 0.015848931924611134 → 1.8 mg/L  [0.015848931924611134, 1.8] (raw_simulation_state)
  - concentration: 1 → 3 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -3.906 → -3.717  [-4.535, -2.268]
  - SI_aragonite: -4.031 → -3.78  [-4.659, -2.394]
  - SI_dolomite: -7.496 → -8  [-8, -7.181]
  - SI_HMC: -3.78 → -2.457  [-3.843, -2.268]
  - SI_siderite: -0.882 → -1.764  [-2.142, -0.882]
  - SI_selenite: -8 → -1.89  [-8, -1.89]
  - SI_anhydrite: -8 → -3.339  [-8, -3.339]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 4.182 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 80.05 °C; initial a_w=0.996 ±0.020 (temperature-extrapolation)
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
  - Fluid pressure: 1.5 → 1.5 kbar [1.5, 1.5], n=160
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=160
  - Temperature: 448.26089435470954 → 18 °C [18, 448.26089435470954], n=160
  - Secure aragonite assessment: 0/160 executed steps; first={"boundary_kbar":4.159402232773269,"secure_aragonite":false}, last={"boundary_kbar":3.04181614,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":19,"unconstrained":141}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Transformation step 75: argentite → acanthite (paramorph)
  - Transformation step 75: argentite → acanthite (paramorph)
  - Transformation step 75: argentite → acanthite (paramorph)
  - Transformation step 75: argentite → acanthite (paramorph)
  - Transformation step 149: torbernite → metatorbernite (dry-exposure)
  - Transformation step 149: zeunerite → metazeunerite (dry-exposure)
  - Transformation step 152: zeunerite → metazeunerite (dry-exposure)
  - Transformation step 153: zeunerite → metazeunerite (dry-exposure)
  - Transformation step 154: zeunerite → metazeunerite (dry-exposure)
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> The mineralogically richest single ore district in Europe — the Erzgebirge had been mined for silver since the 1100s, then bismuth from the 1500s (the very name 'Bismutum' was coined here), then uranium from the 1800s onward. Most autunite-group species were first described from Schneeberg or its sister deposits (Jáchymov, Annaberg). Pinch & Wilson 1977 monographs are the canonical reference.

> Mechanic: 6-event lifecycle walking through cation×anion combinatorics. Pegmatite crystallization (step 20): hot reducing fluid grows uraninite + chalcopyrite + arsenopyrite primaries. Cooling (step 70): T drops to ambient. Cu+P phase (step 85): O2 floods, primaries weather, P>As, Cu>Ca → torbernite plates. Cu+As pulse (step 105): As replenishes from arsenopyrite weathering, Cu still high → zeunerite plates. Cu depletion (step 125): Cu consumed by both Cu-cation secondaries; Ca rises from carbonate dissolution → autunite plates. As pulse late (step 145): As replenishes again, Ca dominant → uranospinite plates.

> First scenario to fire all 4 P/As-branch uranyl species (torbernite, autunite, zeunerite, uranospinite) in a single run. The cation+anion fork mechanic introduced by Rounds 9b-9e is finally exercised end-to-end. Uraninite weathers as the v12 gatekeeper feedstock event.

> Bismuthinite status (SIM 241 audit): geologically licensed but not an expected species. It occurred in the v240 seed-42 run and in none of five sampled SIM 241 seeds. This disappearance is recorded as an unretuned consequence of the corrected growth-budget/competition model; native_bismuth remains the expected Bi phase. Do not restore bismuthinite through scoreboard tuning.
