# CLAIM CARD — epithermal_telluride  (v239, seed 42, 180 steps)

**Anchor:** Cripple Creek mining district, Teller County, Colorado — alkalic-volcanic-hosted low-sulfidation epithermal Au-Te. Cresson Mine pocket, Carlton tunnel level. Type district for the world's gold-telluride mineralogy (calaverite, sylvanite, krennerite, hessite, petzite, native tellurium).
**Deposit:** Low-sulfidation alkalic-volcanic epithermal vein at the gold-telluride sweet spot. Late-stage K-alkaline fluid carries Au + Ag + Te through fractured phonolite and crystallizes the calaverite + sylvanite + hessite trio along quartz + fluorite + adularia gangue. Cooling from 280°C through the 150-200°C epithermal window over geologic time — the temperature trajectory crosses both the cubic↔monoclinic hessite transition (155°C) and the calaverite-sylvanite Au:Ag fork.
**Initial:** 280 °C, 0.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** 3e02800ad2de01f95fdcde292462a4da6770fe52a35eae31f67b29cf39d7709e

**expects_species (7):** calaverite, sylvanite, hessite, native_gold, native_tellurium, fluorite, quartz

**Cited sources:**
  - Saunders 1991, 2008 — Cripple Creek alkalic-igneous Au-Te paragenesis + fluid inclusion data
  - Kelley & Spry 2016 — alkalic gold-telluride deposits review (Econ. Geol.)
  - Pinch & Wilson 1977 — Cripple Creek + Sacarîmb (Romania) telluride mineralogy
  - Goldschmidt 1922 — calaverite morphology (92 forms catalogued; the 'incommensurate modulation' problem)

## Paragenetic order as grown (8 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 3 |
| 2 | feldspar | 0 | 2 |
| 3 | native_tellurium | 0 | 5 |
| 4 | sylvanite | 0 | 2 |
| 5 | calaverite | 4 | 2 |
| 6 | hessite | 4 | 3 |
| 7 | quartz | 20 | 3 |
| 8 | native_silver | 27 | 4 |

**Surprises (grown but NOT in expects_species):** albite, feldspar, native_silver
**No-shows (expected but never nucleated):** native_gold, fluorite

## Environment trajectory (first → last, [min,max])
  - T: 277.559 → 265.748 °C  [126.969, 277.559]
  - pH: 6.504 → 6.228   [5.898, 6.669]
  - Eh: -149.606 → -149.606 mV  [-149.606, -149.606]
  - salinity: 4.724 → 4.724 psu  [4.724, 4.724]
  - O2: 0.039 → 0.039 mg/L  [0.039, 0.039]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.402 → -4.031  [-4.661, -1.386]
  - SI_aragonite: -3.528 → -4.157  [-4.787, -1.512]
  - SI_dolomite: -6.866 → -8  [-8, -3.717]
  - SI_HMC: -5.165 → -5.795  [-6.425, -3.15]
  - SI_siderite: -1.134 → -0.504  [-1.197, 1.449]
  - SI_selenite: -2.142 → -2.205  [-2.205, -2.142]
  - SI_anhydrite: -1.827 → -1.89  [-2.142, -1.827]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.664 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 278.2608943547122 → 266 °C [125.98446567552168, 278.2608943547122], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":2.655969334838852,"secure_aragonite":false}, last={"boundary_kbar":2.60116974,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":180}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Cripple Creek mining district — alkalic-igneous diatreme, late-Oligocene (~32-28 Ma), produces high-grade Au-Te ore from low-sulfidation epithermal veins through phonolite + lamprophyre dikes. The world's premier gold-telluride locality and the type area for calaverite (1861, type specimen from Calaveras County CA but the species grows everywhere here), sylvanite, krennerite, petzite, and nagyágite.

> Mechanic: gold telluride paragenesis cascades on temperature + Au:Ag ratio. At T > 250°C calaverite (Au-rich end-member) wins; as Ag rises and T drops into 150-250°C, sylvanite (1:1 Au:Ag) takes over; below 150°C hessite (pure Ag) crystallizes from residual fluid. Native gold liberates wherever local Te is depleted by earlier telluride growth. Fluorite + quartz + adularia gangue fills the spaces between.

> Why Au=0.4 and Te=3 here: Cripple Creek fluid inclusion data (Saunders et al. 2008) reports Au 1-10 ppm and Te 1-30 ppm in inclusions across the deposit, with peak Au-Te enrichment in the Cresson Vug bonanza (Au tens of ppm). Sim-scale 0.4 ppm Au keeps the broth above all telluride thresholds while staying below native_gold's 0.5 ppm gate at the start (native_gold fires later as Te depletes and Au accumulates locally). Ag=15 puts sylvanite in the cation-fork window (Ag/Au ~37 — sylvanite-favored).

> v184 T-rollout verdict: ambient thermal pulses KEPT, deliberately — they are LOAD-BEARING AND NATIVE here (do not re-litigate without new geology; measured in tools/t-story-observe.mjs, 3 seeds). Native: fault-valve boiling pulses (Sibson) ARE the low-sulfidation epithermal heat supply — Cripple Creek's system pulsed for ~My, and T excursions back and forth across the 155°C hessite transition are real epithermal behavior. Load-bearing: with pulses off the system crashes from the 150-250°C window to the 25°C floor by mid-run (meanT 226→121, fill 0.01→0.00) — the pulses hold this scenario inside the epithermal window its whole design lives in. Pre-existing aspirational misses logged while measuring: native_gold + fluorite absent at observed BASE seeds (expects-tune arc, separate).
