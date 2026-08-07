# CLAIM CARD — porphyry  (v246, seed 42, 120 steps)

**Anchor:** Bingham Canyon Cu-Mo-Au, Oquirrh Mountains, UT (late-Eocene quartz-monzonite porphyry, ~38 Ma)
**Deposit:** Copper porphyry — high-T high-pressure brine with discrete Cu and Mo pulses. Quartz + chalcopyrite + bornite + molybdenite + pyrite + tetrahedrite/tennantite paragenesis.
**Initial:** 400 °C, 2 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-pressure+booked-transition+chemistry-competition-v4|surface-growth:mass-booked-area+lining+crust+asbestos+druse-representatives-v1|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 06bb7b5e56109fea53d953ccd521b90e0b0db6be3f410d4a72e7f79f0580a48a

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (3):** chalcopyrite, pyrite, molybdenite

**Cited sources:**
  - Landtwing et al. 2010 (Econ. Geol. 105) — Bingham fluid evolution + Au content
  - Seo et al. 2012 — Mo pulse timing in porphyry systems
  - Heinrich 2007 — porphyry fluid chemistry compendium
  - Kouzmanov & Pokrovski 2012 — As activity in epithermal Cu systems

## Paragenetic order as grown (18 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | argentite | 0 | 4 |
| 3 | bismuthinite | 0 | 4 |
| 4 | feldspar | 0 | 2 |
| 5 | native_gold | 0 | 1 |
| 6 | arsenopyrite | 3 | 4 |
| 7 | titanite | 17 | 3 |
| 8 | stibnite | 22 | 2 |
| 9 | chalcopyrite | 24 | 1 |
| 10 | galena | 24 | 4 |
| 11 | pyrite | 24 | 1 |
| 12 | tennantite | 24 | 1 |
| 13 | tetrahedrite | 24 | 1 |
| 14 | molybdenite | 44 | 3 |
| 15 | magnetite | 59 | 1 |
| 16 | epidote | 84 | 5 |
| 17 | quartz | 91 | 1 |
| 18 | malachite | 94 | 1 |

**Surprises (grown but NOT in expects_species):** albite, argentite, bismuthinite, feldspar, native_gold, arsenopyrite, titanite, stibnite, galena, tennantite, tetrahedrite, magnetite, epidote, quartz, malachite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 398.622 → 310.039 °C  [236.22, 398.622]
  - pH: 4.575 → 6.667   [4.575, 6.667]
  - Eh: 1.575 → 322.835 mV  [1.575, 322.835]
  - salinity: 10.236 → 10.236 psu  [10.236, 10.236]
  - O2: 0.197 → 1.811 mg/L  [0.197, 1.811]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -7.118 → -3.15  [-7.118, -2.961]
  - SI_aragonite: -7.181 → -3.218  [-7.181, -3.026]
  - SI_dolomite: -8 → -5.367  [-8, -5.055]
  - SI_HMC: -8 → -4.79  [-8, -4.601]
  - SI_siderite: -4.409 → 0.186  [-4.409, 0.252]
  - SI_selenite: -4.031 → -0.882  [-4.031, -0.882]
  - SI_anhydrite: -3.591 → -0.567  [-3.654, -0.504]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.592 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 87.40 °C; initial a_w=0.994 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 2 → 2 kbar [2, 2], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 398.2608943547122 → 311.2157097359189 °C [235.9267717086246, 398.2608943547122], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":3.5732160863219935,"secure_aragonite":false}, last={"boundary_kbar":2.8390214210555573,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":120}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Bingham Canyon Cu-Mo-Au deposit, Oquirrh Mountains, UT. Late-Eocene (~38 Ma) quartz-monzonite-porphyry intrusion with classic potassic-core / phyllic-shell / propylitic-rim alteration zoning.

> Fluid evolution from Landtwing et al. 2010 (Econ. Geol. 105) LA-ICP-MS study: deep central brine ~7 wt% NaCl-eq with subequal Na/K/Fe/Cu, upper brine endmember ~45 wt% NaCl-eq coexisting with a low-density vapor (~0.2 g/cm³). Mo arrives in a distinct later pulse from Cu (Seo et al. 2012; encoded in event_molybdenum_pulse).

> Chemistry-audit gap-fill pass (Apr 2026): added Na, K, Cl, Mg, Ag, Te to populate the brine-element baseline that was missing. Initial Cu and Mo remain zero by design — delivered by event_copper_injection (steps 25, 60) and event_molybdenum_pulse (step 45) respectively, modeling the discrete pulse pattern documented at Bingham.

> Existing values (SiO2, Ca, CO3, Fe, Mn, Pb, Sb, As, Bi, S, F, pH, salinity, O2) were intentional and were not retuned. This is a gap-fill audit, not a rewrite.

> v184 T-rollout verdict: ambient thermal pulses KEPT, deliberately (do not re-litigate without new geology). Porphyry systems are THE textbook episodic magmatic-hydrothermal deposit class — repeated dike/fluid injections over 10⁵-10⁶ yr (Sillitoe 2010) — so the ambient fracture-valve pulses are geologically NATIVE here, modeling the smaller unscripted injections between the big scripted Cu/Mo events. Measured anyway (tools/t-story-observe.mjs, 3 seeds): removal would be harmless to expects (all three intact) and lets late supergene Mo/Cu phases through as the system cools lower — but those belong to a future supergene-blanket arc, not to deleting the deposit class's defining behavior.
