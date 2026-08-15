# CLAIM CARD — wittichen  (v258, seed 42, 220 steps)

**Anchor:** Kloster Wittichen, Schwarzwald (Black Forest), Baden-Württemberg, Germany — the classic Bi-Co-Ni-Ag-As-(Ba) five-element vein district; cobalt-pigment + silver mining boom 1730s–40s around the convent. Sophia and Johann-Georg veins.
**Deposit:** A five-element vein in granite basement: hot, saline, SULFUR-STARVED brine carries Bi + Co + Ni + Ag + As. S ~3 ppm is load-bearing — bismuthinite and acanthite never gate open, so the metals stay NATIVE and arsenides are the metal sinks. Hot stage grows skutterudite + nickeline rosettes; the deposit-defining REDUCING SHOCK precipitates arborescent bismuth, then barite + calcite gangue seal the vein. A distinct post-vein epilogue exhumates and partly drains the cavity: only vadose wall voxels oxidize Co arsenides, returning booked Co + As for erythrite and ambient cobalt-bearing aragonite while the submerged floor preserves the hypogene suite.
**Initial:** 340 °C, 0.9 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 8eff370e850f3102820941b81e2f3ac36e37d5f27d9020a662ac891885503f5c

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (12):** skutterudite, nickeline, safflorite, native_bismuth, native_arsenic, native_silver, proustite, acanthite, calcite, barite, erythrite, aragonite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Kissin S.A. 1992, Canadian Mineralogist 30 — Five-element (Ni-Co-As-Ag-Bi) veins: the deposit-class review
  - Burisch M., Walter B.F., Gerdes A., Lanz M., Markl G. 2017, Geology 45 — Methane and the origin of five-element veins (the hydrocarbon reduction trigger)
  - Scharrer M., Kreissl S., Markl G. 2019, Ore Geology Reviews — The mineralogical variability of hydrothermal native element-arsenide associations
  - Staude S., Bons P.D., Markl G. 2012, Mineralium Deposita 47 — Schwarzwald hydrothermal veins: fluid inclusion record, 20-26 wt% NaCl basement brines
  - Barber D.M., Malone P.G., Larson R.J. 1975, Chemical Geology 16:239-241, DOI 10.1016/0009-2541(75)90032-7 — Co-induced aragonite at 25°C
  - González-López J. et al. 2018, Chemical Geology 482:91-100, DOI 10.1016/j.chemgeo.2018.02.003 — Co/Ca-controlled amorphous-to-aragonite pathway
  - Brazier J.-M. & Mavromatis V. 2022, Chemical Geology 600:120863, DOI 10.1016/j.chemgeo.2022.120863 — Co partitioning into aragonite at 25°C
  - Markl G. et al. 2016 — Cobalt (Ontario) arsenide zoning, X_As 0.96-0.99 (the skutterudite engine's anchor citation)
  - Kloster Wittichen district history — cobalt-blue pigment + silver boom, 1730s-1740s (shape_seed 1736)

## Paragenetic order as grown (17 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | skutterudite | 1 | 2 | 0 | nucleation |
| 2 | nickeline | 4 | 4 | 0 | nucleation |
| 3 | native_arsenic | 5 | 4 | 0 | nucleation |
| 4 | safflorite | 33 | 2 | 0 | nucleation |
| 5 | native_silver | 71 | 4 | 0 | nucleation |
| 6 | native_bismuth | 74 | 3 | 0 | nucleation |
| 7 | proustite | 134 | 2 | 0 | nucleation |
| 8 | realgar | 134 | 1 | 0 | nucleation |
| 9 | acanthite | 141 | 4 | 0 | nucleation |
| 10 | barite | 141 | 6 | 0 | nucleation |
| 11 | calcite | 142 | 1 | 0 | nucleation |
| 12 | annabergite | 170 | 1 | 0 | nucleation |
| 13 | chalcedony | 170 | 4 | 0 | nucleation |
| 14 | aragonite | 171 | 1 | 0 | nucleation |
| 15 | erythrite | 171 | 1 | 0 | nucleation |
| 16 | pharmacolite | 172 | 5 | 0 | nucleation |
| 17 | haidingerite | 201 | 0 | 3 | pharmacolite -> haidingerite |

**Surprises (present but absent from all authored expectation tiers):** realgar, annabergite, chalcedony, pharmacolite, haidingerite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 339.9778271484375 → 25 °C  [25, 339.9778271484375] (raw_simulation_state)
  - pH: 6.3 → 7.4   [6.3, 7.4] (raw_simulation_state)
  - Eh: -19.98891357421875 → 322.1090020413224 mV  [-280.92380224446623, 322.1090020413224] (raw_simulation_state)
  - salinity: 24 → 24 psu  [24, 24] (raw_simulation_state)
  - O2: 0.16597563761020587 → 1.8 mg/L  [0.0024590195274729384, 1.8] (raw_simulation_state)
  - concentration: 1 → 1.2 ×  [1, 1.2] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -3.339 → 0.189  [-3.339, 0.882]
  - SI_aragonite: -3.402 → 0.063  [-3.402, 0.756]
  - SI_dolomite: -6.551 → -0.567  [-7.622, -0.567]
  - SI_HMC: -3.213 → 0.063  [-3.213, 0.756]
  - SI_siderite: -1.575 → 0.882  [-1.575, 1.008]
  - SI_selenite: -5.669 → -1.134  [-8, -1.134]
  - SI_anhydrite: -5.291 → -1.323  [-8, -1.323]
  - SI_barite: -3.78 → 3.024  [-8, 3.024]
  - SI_celestine: -5.417 → -1.449  [-8, -1.449]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.9 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.042 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 71.23 °C; initial a_w=0.987 ±0.020 (temperature-extrapolation)
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
  - Fluid pressure: 0.9 → 0.001 kbar [0.001, 0.9], n=220
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=220
  - Temperature: 339.9778271484375 → 25 °C [25, 339.9778271484375], n=220
  - Secure aragonite assessment: 0/220 executed steps; first={"boundary_kbar":3.0413872177406542,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":220}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Transformation step 201: pharmacolite → haidingerite (dry-exposure)
  - Transformation step 207: pharmacolite → haidingerite (dry-exposure)
  - Transformation step 216: pharmacolite → haidingerite (dry-exposure)
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor + mechanism: Kissin 1992 (Canadian Mineralogist 30) defines the five-element class; Burisch et al. 2017 (Geology 45) ties the native-metal stage to methane/hydrocarbon influx — fluid inclusions in Schwarzwald five-element veins carry CH4 exactly at the dendrite stage, and the reduction is fast (hours-to-days), which is WHY the metals dendrite. Scharrer, Kreissl & Markl 2019 (Ore Geology Reviews) survey the assemblage diversity; Staude et al. 2012 (Mineralium Deposita 47) give the Schwarzwald basement-brine fluid-inclusion record (20–26 wt% NaCl, 150–340°C) this broth is anchored on.

> The redox shock is a DECLARED fluid.Eh movement (event-subsumption discipline, v185/v186): base −20 mV (mildly reducing basement brine), ONE deep pulse (amp −320) at u=0.58 (the CH4 influx; width ~8 steps; measured floor ~−253 mV at seed 42), and a late oxidizing trend (+95 ease — meteoric tail, tuned DOWN from +140 which dissolved the arsenide suite; a stronger late-oxidation finger was tried and reverted for the same reason — barite/erythrite are the documented aspirational casualties of arsenide survival). The wittichen_hydrocarbon_influx event at the pulse center is NARRATIVE-ONLY (no fluid writes).

> Engine fit: this is the morphology registry's dendrite-band tenant (MORPH_TH.native_bismuth, SIM 188 — RESEARCH-bismuth-morphology-2026-06-12.md). At the shock, Bi σ ≈ bi_f 3.0 × s_mask 0.96 × red_f 1.5 × T_f 1.0 ≈ 4.3 — the dendritic band (≥3.8) of a scale structurally capped at ~4.5. Pre-shock cooling-stage Bi sits in the feathery bands; post-shock regrowth heals feathery over the dendrites, so the zone stack RECORDS the shock (the narrator's healed-over paragraph + the bismuth_morph strip chip slamming 0→4 on the pulse). Skutterudite + safflorite get their FIRST scenario home here (both were expects-orphans fleet-wide).

> Wallrock: 'pegmatite' composition as the granite proxy (inert silicate — Wittichen veins cut Triberg granite; the carbonate gangue arrives in the FLUID via the late CO3 event, not from wall dissolution). Architecture tabular (vein-bounded), pocket size class, shape_seed 1736 (the cobalt-boom decade).

> Calibration target: the hand specimen is silver-white dendritic Bi embedded in white carbonate with gray arsenide rims, read in cross-section. MEASURED at seeds 42-45 (calibration session, 2026-06-12): native_bismuth 3-5 alive with 45-49% DENDRITIC zone mass (the shock recorded); skutterudite 2 + safflorite 2 + nickeline 4 + native_arsenic 4 all ALIVE; native_silver grows then sulfidizes to acanthite 4 at the meteoric-sulfate stage (the tarnish story — hand-specimen Wittichen silver is acanthite-coated); proustite 2 (ruby silver); calcite + aragonite gangue. Bi band edges re-pinned against this trajectory (js/45 — the activity correction at salinity 24 compresses the structural ~4.5 ceiling to ~2.4 measured).

> BARITE DELIVERED (v191, gate-census tune): the v189 'aspirational barite' diagnosis was WRONG about the mechanism — the gate census (tools/wittichen-sulfate-probe.mjs) measured every gate component PASSING from step ~133 (Ba✓ S✓ redox✓ pH✓ T✓) with σ plateaued at 0.60: barite never needed more OXIDATION, it needed more BARIUM (ba_f 24/30 × s_f 30/40 × the salinity-24 activity penalty ≈ 0.59 pinned σ under 1 forever). The locality is the authority: Wittichen's veins are literally Barytgänge — barite-gangue veins, the district's defining gangue — so Ba 24 was unjustifiably shy. Ba 75 (still modest for a heavy-spar district) puts the barite stage at σ 1.47–1.55 from the meteoric beat on: barite 2/6/3 crystals at seeds 42/43/44, NO witherite (the BaCO3 competitor never gates), and the living suite intact at all probed seeds. No Eh change — the reverted +100 oxidation finger stays reverted.

> WEATHERING EPILOGUE EXECUTED: step 170 is a new post-vein boundary, not a retuned hydrothermal tail. T falls to 25°C, pressure to 0.001 kbar, the water table to 2 mm, and the buried-stage thermal-pulse generator stops. The 3-D vadose boundary raises O2 only above that surface and preserves total dissolved sulfur. Erythrite cannot nucleate until a same-site Co arsenide has actually dissolved and returned both Co and As through the accepted-shell LIFO budget. Sophia Mine occurrence evidence supports the erythrite bloom; Staude et al. 2012 supports the district's final supergene arsenate/carbonate/sulfate stage but is not misquoted as naming erythrite.

> COBALT ARAGONITE EXECUTED WITH AN EVIDENCE DOMAIN: Barber et al. 1975 measured calcite poisoning from 5e-4 M Co at 25°C and mostly aragonite by 3e-3 M; González-López et al. 2018 constrains the Co/Ca pathway, and Brazier & Mavromatis 2022 supplies equilibrium DCo≈0.1 at 25°C. The selector is unavailable during the 150–340°C vein stage and above the 1e-2 M amorphous-only limit. Accepted pink aragonite shells debit their trace Co and attach only to a weathering Co-arsenide that has returned booked Co. Wittichen occurrence is locality evidence; no direct observed substrate texture is attributed to Staude et al.
