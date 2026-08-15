# CLAIM CARD — elmwood  (v243, seed 42, 200 steps)

**Anchor:** Elmwood-Gordonsville mines (Carthage, Smith County, TN) — Central Tennessee MVT district; the world-reference stepped golden calcite scalenohedra, on honey sphalerite with purple fluorite + barite, in Knox Group paleokarst breccia
**Deposit:** The stepped-calcite showcase (calcite-morphology arc Phase 5). A waning MVT system: NaCl-CaCl2-MgCl2 basinal brine drops honey sphalerite, then fluorite + barite, and as the system cools, episodic brine expulsions (seismic pumping) drive an oscillating carbonate supply — the sigma curve crosses the stepped band again and again, and the late golden scalenohedral calcite records every pulse as a macrostep terrace. Watch them build.
**Initial:** 120 °C, 0.2 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:opal5..100C+quartz100..700C-no-cosmetic-relabel-v1|sulfur-ledger:sulfide+sulfate+elemental-independent+pathway-gated-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 8fbd5e9bcf65dc3521347136a50ebf872629fc16ad0772840e73974d845cfe23

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (4):** sphalerite, fluorite, barite, calcite

**Cited sources:**
  - Gratz & Misra 1987 (Econ. Geol. 82) — Elmwood-Gordonsville fluid-inclusion microthermometry
  - Misra & Lu 1992 — Central Tennessee zinc district paragenesis
  - Kyle 1976 / district literature — Knox unconformity paleokarst breccia ore control
  - RESEARCH-calcite-morphology-2026-06-11.md §2 — oscillatory sigma -> step bunching (Movements as the driver)
  - Sibson 1992 fault-valve mechanics — episodic brine expulsion (the pulse-train shape)

## Paragenetic order as grown (10 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | calcite | 0 | 1 |
| 2 | fluorite | 14 | 1 |
| 3 | galena | 14 | 1 |
| 4 | pyrite | 14 | 1 |
| 5 | siderite | 14 | 1 |
| 6 | sphalerite | 14 | 2 |
| 7 | barite | 15 | 12 |
| 8 | aragonite | 80 | 1 |
| 9 | celestine | 85 | 6 |
| 10 | selenite | 115 | 2 |

**Surprises (grown but NOT in expects_species):** galena, pyrite, siderite, aragonite, celestine, selenite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 121.063 → 53.15 °C  [53.15, 121.063]
  - pH: 7.11 → 8.213   [7.11, 8.433]
  - Eh: 25.197 → 25.197 mV  [25.197, 25.197]
  - salinity: 21.26 → 21.26 psu  [21.26, 21.26]
  - O2: 0.236 → 0.236 mg/L  [0.236, 0.236]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.693 → 2.016  [0.693, 2.583]
  - SI_aragonite: 0.567 → 1.89  [0.567, 2.52]
  - SI_dolomite: 0.945 → 3.591  [0.819, 4.472]
  - SI_HMC: -1.008 → 0.756  [-1.008, 1.071]
  - SI_siderite: 1.512 → 3.339  [1.512, 3.843]
  - SI_selenite: -8 → -0.567  [-8, -0.504]
  - SI_anhydrite: -8 → -0.693  [-8, -0.441]
  - SI_barite: -8 → 2.688  [-8, 2.688]
  - SI_celestine: -8 → 0  [-8, 0.189]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.503 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 60.94 °C; initial a_w=0.988 ±0.020 (temperature-extrapolation)
  - Stress/overprint step 70: tectonic_shock — resolved-shear threshold pulse; fluid pressure unchanged; no creep law

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.2 → 0.2 kbar [0.2, 0.2], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 119.99514125 → 53.26575310471222 °C [53.26575310471222, 119.99514125], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.503188304433579,"secure_aragonite":false}, last={"boundary_kbar":2.7991023476133208,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress step 70: σdiff=50 MPa; affected crystal IDs=[]; outcomes={"below_crss":1}

## Scenario notes (author's own rationale)
> Anchor: Elmwood-Gordonsville (Central Tennessee zinc district). Fluid inclusions per Gratz & Misra 1987 (Econ. Geol. 82): sphalerite Th ~90-150°C, NaCl-CaCl2-MgCl2 brines ~20-23 wt% NaCl-eq. Ore in paleokarst/collapse breccias of the upper Knox Group beneath the post-Knox unconformity.

> Paragenesis (Misra & Lu 1992; district consensus): replacement dolomite -> honey-amber sphalerite (main ore) -> purple fluorite + barite (galena minor in Central TN, unlike Tri-State) -> GIANT GOLDEN CALCITE LAST, scalenohedral, stepped faces + phantoms, often perched on sphalerite; bitumen/oil inclusions give the golden body color (the district carries live hydrocarbons).

> Mg:Ca ~0.2 — a dolostone-buffered MgCl2-bearing brine (the host IS dolostone; Gratz & Misra report Mg-rich inclusions). Above the 0.15 elongation threshold (GCA 2015 / Phase 4): the form axis makes the late calcite SCALENOHEDRAL at low T, which is exactly what Elmwood grows. Mn kept at 4 (below the manganocalcite branch's >5 gate) with Fe 8 — Elmwood calcite is golden dogtooth, not botryoidal manganocalcite.

> The movements are the showcase: a naica-shape cooling trend (120 -> 55°C, the waning system) + a fluid.CO3 PULSE TRAIN in the late half (five gaussian brine-expulsion pulses, the MVT seismic-pumping mechanism — Sibson-style fault-valve episodicity). Each pulse pushes calcite sigma up through the stepped band and relaxes back: the oscillation IS the step-bunching driver (research doc §2 — the steps are the chemistry curve made solid).

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshot, 2026-07-25 — the region's full mineral list incl. sub-localities, 11 valid): Baryte (+ var. Strontium-bearing Baryte), Calcite, Celestine (+ var. Barium-bearing Celestine), Dolomite, Fluorite, Galena, Marcasite, 'Petroleum var. Bitumen', Pyrite, Quartz, 'Silica', Sphalerite, Vaterite. This is the TERMINAL-VERIFICATION list for this scenario (the specimen-record test): (a) NO gypsum-family mineral — corroborates the boss's selenite ruling ('selenite disappearing is good'), the S2-selenite migration's elmwood death is record-licensed; (b) SIDERITE is NOT on the list but the elmwood-snowball variety guard currently requires it — census flag for a future pass (same de-confabulation family as aragonite v228?); (c) unfired-but-documented at elmwood: marcasite, pyrite, quartz, vaterite, bitumen (the golden-calcite color note already cites the hydrocarbons) — candidates if the scenario ever deepens; (d) Sr-bearing baryte variety on the list supports the S1 sulfate story; Ba-bearing celestine supports the S2 blanket. Boss action noted in the bridge: capture the same mindat list for the other mine scenarios.
