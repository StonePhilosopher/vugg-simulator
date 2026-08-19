# CLAIM CARD — epithermal_telluride  (v253, seed 42, 180 steps)

**Anchor:** Cripple Creek mining district, Teller County, Colorado — alkalic-volcanic-hosted low-sulfidation epithermal Au-Te. Cresson Mine pocket, Carlton tunnel level. Type district for the world's gold-telluride mineralogy (calaverite, sylvanite, krennerite, hessite, petzite, native tellurium).
**Deposit:** Low-sulfidation alkalic-volcanic epithermal vein at the gold-telluride sweet spot. Late-stage K-alkaline fluid carries Au + Ag + Te through fractured phonolite and crystallizes the calaverite + sylvanite + hessite trio along quartz + fluorite + adularia gangue. Cooling from 280°C through the 150-200°C epithermal window over geologic time — the temperature trajectory crosses both the cubic↔monoclinic hessite transition (155°C) and the calaverite-sylvanite Au:Ag fork.
**Initial:** 280 °C, 0.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 8e518ef2a97a9664707d4113ad7e35a9e20df9695e07905aa16494e5b9ecc2ed

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (5):** calaverite, sylvanite, hessite, native_tellurium, quartz
**Statistical (0):** (none)
**Aspirational (2):** native_gold — Natural epithermal accessory, but absent from the release seed audit; not a deterministic outcome of the current telluride allocation.; fluorite — Plausible gangue in the deposit class, but absent from the release seed audit and not guaranteed by this authored fluid path.
**Locality exclusions (0):** (none)

**Cited sources:**
  - Saunders 1991, 2008 — Cripple Creek alkalic-igneous Au-Te paragenesis + fluid inclusion data
  - Kelley & Spry 2016 — alkalic gold-telluride deposits review (Econ. Geol.)
  - Pinch & Wilson 1977 — Cripple Creek + Sacarîmb (Romania) telluride mineralogy
  - Goldschmidt 1922 — calaverite morphology (92 forms catalogued; the 'incommensurate modulation' problem)

## Paragenetic order as grown (8 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 2 | 0 | nucleation |
| 2 | feldspar | 1 | 2 | 0 | nucleation |
| 3 | native_tellurium | 1 | 5 | 0 | nucleation |
| 4 | sylvanite | 1 | 2 | 0 | nucleation |
| 5 | calaverite | 5 | 2 | 0 | nucleation |
| 6 | hessite | 5 | 3 | 0 | nucleation |
| 7 | quartz | 21 | 3 | 0 | nucleation |
| 8 | native_silver | 28 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite, feldspar, native_silver
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** native_gold, fluorite
**Excluded-locality appearances (failing):** (none)

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
  - SI_dolomite: -6.866 → -8  [-8, -4.598]
  - SI_HMC: -5.165 → -5.795  [-6.425, -3.15]
  - SI_siderite: -1.134 → -0.504  [-1.197, 1.008]
  - SI_selenite: -8 → -8  [-8, -2.835]
  - SI_anhydrite: -8 → -8  [-8, -3.15]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.664 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-250 C promoted Ksp(T) envelope; no extrapolation.
    - siderite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - rhodochrosite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - anhydrite: active; active=true; ΔlogK=0.949237512; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.949 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.9071843239999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.907 relative to 1 bar at the same temperature.
    - celestine: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 278.2608943547122 → 266 °C [125.98446567552168, 278.2608943547122], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":2.655969334838852,"secure_aragonite":false}, last={"boundary_kbar":2.60116974,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":180}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Cripple Creek mining district — alkalic-igneous diatreme, late-Oligocene (~32-28 Ma), produces high-grade Au-Te ore from low-sulfidation epithermal veins through phonolite + lamprophyre dikes. The world's premier gold-telluride locality and the type area for calaverite (1861, type specimen from Calaveras County CA but the species grows everywhere here), sylvanite, krennerite, petzite, and nagyágite.

> Mechanic: gold telluride paragenesis cascades on temperature + Au:Ag ratio. At T > 250°C calaverite (Au-rich end-member) wins; as Ag rises and T drops into 150-250°C, sylvanite (1:1 Au:Ag) takes over; below 150°C hessite (pure Ag) crystallizes from residual fluid. Native gold liberates wherever local Te is depleted by earlier telluride growth. Fluorite + quartz + adularia gangue fills the spaces between.

> Why Au=0.4 and Te=3 here: Cripple Creek fluid inclusion data (Saunders et al. 2008) reports Au 1-10 ppm and Te 1-30 ppm in inclusions across the deposit, with peak Au-Te enrichment in the Cresson Vug bonanza (Au tens of ppm). Sim-scale 0.4 ppm Au keeps the broth above all telluride thresholds while staying below native_gold's 0.5 ppm gate at the start (native_gold fires later as Te depletes and Au accumulates locally). Ag=15 puts sylvanite in the cation-fork window (Ag/Au ~37 — sylvanite-favored).

> v184 T-rollout verdict: ambient thermal pulses KEPT, deliberately — they are LOAD-BEARING AND NATIVE here (do not re-litigate without new geology; measured in tools/t-story-observe.mjs, 3 seeds). Native: fault-valve boiling pulses (Sibson) ARE the low-sulfidation epithermal heat supply — Cripple Creek's system pulsed for ~My, and T excursions back and forth across the 155°C hessite transition are real epithermal behavior. Load-bearing: with pulses off the system crashes from the 150-250°C window to the 25°C floor by mid-run (meanT 226→121, fill 0.01→0.00) — the pulses hold this scenario inside the epithermal window its whole design lives in. Pre-existing aspirational misses logged while measuring: native_gold + fluorite absent at observed BASE seeds (expects-tune arc, separate).
