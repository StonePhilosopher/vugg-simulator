# CLAIM CARD — schneeberg  (v242, seed 42, 160 steps)

**Anchor:** Schneeberg, Erzgebirgskreis (Saxony Ore Mountains), Germany — type locality for torbernite (1772), zeunerite (1872), uranospinite (1873), and ten more uranyl arsenate-phosphate species. Walpurgis Flacher vein, Weisser Hirsch Mine.
**Deposit:** Schneeberg / Erzgebirge oxidized uranium-pegmatite vein system (Walpurgis Flacher vein, Weisser Hirsch Mine, Saxony — type locality for torbernite, zeunerite, and uranospinite). A U-bearing pegmatite + chalcopyrite + arsenopyrite primary assemblage weathers under meteoric oxidation; the resulting uranyl + Cu + As fluid plates the autunite-group secondaries in two cation phases — Cu-rich first (torbernite emerald greens then zeunerite as As-pulse arrives), then Ca-dominant after Cu is consumed (autunite + uranospinite, the bright LW-UV fluorescent yellows).
**Initial:** 450 °C, 1.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** ac171138c7ba11af821db17d250120e2ea45937f292928e761dd68a1b979d801

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (14):** uraninite, torbernite, zeunerite, autunite, uranospinite, native_bismuth, native_arsenic, erythrite, annabergite, cobaltite, nickeline, cassiterite, pharmacolite, haidingerite

**Cited sources:**
  - Pinch & Wilson 1977 — canonical Schneeberg/Erzgebirge monograph
  - Weisbach 1872 — zeunerite type description (Walpurgis Flacher vein)
  - Weisbach 1873 — uranospinite type description (Weisser Hirsch Mine)
  - Klaproth 1789 — uranium discovery in Schneeberg pitchblende
  - research/minerals/research-uranospinite.md (May 2026) — cation-fork mechanic + paragenesis

## Paragenetic order as grown (33 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | argentite | 0 | 4 |
| 2 | feldspar | 0 | 2 |
| 3 | morganite | 0 | 1 |
| 4 | quartz | 0 | 3 |
| 5 | spodumene | 0 | 1 |
| 6 | uraninite | 0 | 3 |
| 7 | arsenopyrite | 3 | 4 |
| 8 | cobaltite | 3 | 4 |
| 9 | nickeline | 3 | 4 |
| 10 | cassiterite | 5 | 4 |
| 11 | topaz | 6 | 2 |
| 12 | proustite | 19 | 2 |
| 13 | tennantite | 19 | 1 |
| 14 | native_arsenic | 36 | 3 |
| 15 | native_bismuth | 69 | 1 |
| 16 | naumannite | 69 | 2 |
| 17 | native_silver | 70 | 3 |
| 18 | chrysocolla | 87 | 5 |
| 19 | opal | 88 | 5 |
| 20 | brochantite | 89 | 3 |
| 21 | cuprite | 89 | 1 |
| 22 | dioptase | 90 | 4 |
| 23 | turquoise | 90 | 2 |
| 24 | selenite | 91 | 1 |
| 25 | torbernite | 93 | 1 |
| 26 | annabergite | 104 | 1 |
| 27 | erythrite | 104 | 1 |
| 28 | uranophane | 104 | 3 |
| 29 | goethite | 109 | 3 |
| 30 | zeunerite | 109 | 4 |
| 31 | autunite | 130 | 4 |
| 32 | pharmacolite | 144 | 5 |
| 33 | uranospinite | 144 | 4 |

**Surprises (grown but NOT in expects_species):** argentite, feldspar, morganite, quartz, spodumene, arsenopyrite, topaz, proustite, tennantite, naumannite, native_silver, chrysocolla, opal, brochantite, cuprite, dioptase, turquoise, selenite, uranophane, goethite
**No-shows (expected but never nucleated):** haidingerite

## Environment trajectory (first → last, [min,max])
  - T: 448.819 → 23.622 °C  [23.622, 448.819]
  - pH: 6.504 → 6.504   [6.173, 6.504]
  - Eh: -201.575 → 303.937 mV  [-201.575, 322.835]
  - salinity: 6.299 → 6.299 psu  [6.299, 6.299]
  - O2: 0 → 1.614 mg/L  [0, 1.772]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: -3.906 → -2.205  [-3.906, -2.205]
  - SI_aragonite: -4.031 → -2.331  [-4.031, -2.331]
  - SI_dolomite: -7.496 → -5.11  [-7.496, -4.787]
  - SI_HMC: -5.606 → -3.276  [-5.606, -3.276]
  - SI_siderite: -0.882 → -0.315  [-0.882, 0.315]
  - SI_selenite: -1.89 → -1.764  [-2.52, -1.764]
  - SI_anhydrite: -1.386 → -1.953  [-2.709, -1.386]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 4.182 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 80.05 °C; initial a_w=0.996 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1.5 → 1.5 kbar [1.5, 1.5], n=160
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=160
  - Temperature: 448.2608943547122 → 25 °C [25, 448.2608943547122], n=160
  - Secure aragonite assessment: 0/160 executed steps; first={"boundary_kbar":4.159402232773303,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":19,"unconstrained":141}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> The mineralogically richest single ore district in Europe — the Erzgebirge had been mined for silver since the 1100s, then bismuth from the 1500s (the very name 'Bismutum' was coined here), then uranium from the 1800s onward. Most autunite-group species were first described from Schneeberg or its sister deposits (Jáchymov, Annaberg). Pinch & Wilson 1977 monographs are the canonical reference.

> Mechanic: 6-event lifecycle walking through cation×anion combinatorics. Pegmatite crystallization (step 20): hot reducing fluid grows uraninite + chalcopyrite + arsenopyrite primaries. Cooling (step 70): T drops to ambient. Cu+P phase (step 85): O2 floods, primaries weather, P>As, Cu>Ca → torbernite plates. Cu+As pulse (step 105): As replenishes from arsenopyrite weathering, Cu still high → zeunerite plates. Cu depletion (step 125): Cu consumed by both Cu-cation secondaries; Ca rises from carbonate dissolution → autunite plates. As pulse late (step 145): As replenishes again, Ca dominant → uranospinite plates.

> First scenario to fire all 4 P/As-branch uranyl species (torbernite, autunite, zeunerite, uranospinite) in a single run. The cation+anion fork mechanic introduced by Rounds 9b-9e is finally exercised end-to-end. Uraninite weathers as the v12 gatekeeper feedstock event.

> Bismuthinite status (SIM 241 audit): geologically licensed but not an expected species. It occurred in the v240 seed-42 run and in none of five sampled SIM 241 seeds. This disappearance is recorded as an unretuned consequence of the corrected growth-budget/competition model; native_bismuth remains the expected Bi phase. Do not restore bismuthinite through scoreboard tuning.
