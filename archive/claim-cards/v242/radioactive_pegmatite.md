# CLAIM CARD — radioactive_pegmatite  (v242, seed 42, 120 steps)

**Anchor:** (generic high-T alkali-granite pocket — not anchored to a specific locality)
**Deposit:** High-T pegmatitic fluid + U + Pb. Grows uraninite, smoky quartz (darkened by radiation), feldspar/albite, and late-stage galena from radiogenic Pb.
**Initial:** 600 °C, 2 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 875a2f62999d5bbd7436c2d1295125882f5a09362a060a59b72176aeecaa5d65

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (6):** uraninite, autunite, quartz, feldspar, lepidolite, cassiterite

**Cited sources:**
  - (generic testing scenario — no published source)

## Paragenetic order as grown (13 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | feldspar | 0 | 2 |
| 3 | lepidolite | 0 | 3 |
| 4 | morganite | 0 | 4 |
| 5 | quartz | 0 | 3 |
| 6 | spodumene | 0 | 4 |
| 7 | tourmaline | 0 | 8 |
| 8 | uraninite | 0 | 3 |
| 9 | cassiterite | 5 | 4 |
| 10 | topaz | 19 | 2 |
| 11 | opal | 93 | 7 |
| 12 | plumbogummite | 106 | 2 |
| 13 | selenite | 108 | 1 |

**Surprises (grown but NOT in expects_species):** albite, morganite, spodumene, tourmaline, topaz, opal, plumbogummite, selenite
**No-shows (expected but never nucleated):** autunite

## Environment trajectory (first → last, [min,max])
  - T: 599.409 → 23.622 °C  [23.622, 599.409]
  - pH: 6.504 → 6.504   [6.504, 6.504]
  - Eh: -201.575 → 181.102 mV  [-201.575, 181.102]
  - salinity: 7.874 → 7.874 psu  [7.874, 7.874]
  - O2: 0 → 0.787 mg/L  [0, 0.787]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.906 → -2.52  [-3.906, -1.701]
  - SI_aragonite: -4.031 → -2.646  [-4.031, -1.827]
  - SI_dolomite: -7.685 → -5.732  [-7.685, -4.47]
  - SI_HMC: -5.669 → -3.591  [-5.669, -3.402]
  - SI_siderite: -0.693 → -0.189  [-0.693, 0.693]
  - SI_selenite: -1.764 → -1.827  [-1.827, -1.764]
  - SI_anhydrite: -1.197 → -2.016  [-2.016, -1.197]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 6.673 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 87.40 °C; initial a_w=0.995 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 2 → 2 kbar [2, 2], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 598.2608943547123 → 25 °C [25, 598.2608943547123], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":6.637960672127232,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":49,"unconstrained":71}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Generic testing scenario — not anchored to a real locality (per the user's clarification on the audit brief). Pegmatitic fluids are silica-saturated melts with abundant K + Na + Al + U.

> Mechanic: 4-event lifecycle. Crystallization pulse (step 20): main quartz + uraninite growth. Deep time (step 50): radiation slowly transmutes U → Pb, darkens nearby quartz. Oxidizing meteoric water (step 80): late-stage fracture flow brings O2; sulfides destabilize but uraninite endures. Final cooling (step 100): system approaches ambient, galena precipitates from the radiogenic Pb.

> v184 thermal_pulses:false (PEGMATITE-SHAPE, T-rollout close-out): same sealed-pocket logic as gem_pegmatite's v183 flag — the four events anchor the whole arc (450@20, 300@50, 120@80, 50@100) and a sealed granite pocket has no fracture-valve plumbing. The measured violation was worse here: a late ambient pulse re-warmed the 'approaches ambient' endgame to 541°C at one v180 seed — with autunite (a ≤50°C supergene mineral) in the expects list. Dark-observed at 3 seeds: the post-step-100 autunite window (50→25°C) now opens deterministically every run (under pulses it was destroyed whenever a late re-warm landed); pyrite/goethite drop out (they were pulse-Fe-rider artifacts, not expects); autunite itself remains a pre-existing aspirational miss at the observed seeds (absent in BASE too — chemistry-side, a separate tune arc; it fires elsewhere in the 10-seed coverage sweep).

> Audit gap-fill (Apr 2026): Mg=5 — brief-required non-zero Mg baseline. Pegmatite pocket fluids are Mg-poor (Mg partitions into outer-shell biotite/chlorite during pegmatite differentiation), matches the gem_pegmatite scenario's Mg=5 abstraction.
