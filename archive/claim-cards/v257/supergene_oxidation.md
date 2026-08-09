# CLAIM CARD — supergene_oxidation  (v257, seed 42, 200 steps)

**Anchor:** Tsumeb mine, Otavi Mountain Land, Namibia. 1st-stage gossan (uppermost supergene zone). One of the most mineralogically diverse deposits ever discovered (~280 species), type locality for germanium.
**Deposit:** Cold, oxygenated supergene weathering of a Pb-Zn-Cu sulfide pipe. Pb+Mo→wulfenite, Zn+CO3→smithsonite, Zn+As→adamite, Pb+As+Cl→mimetite, Fe→goethite, Ca+SO4→selenite, Cu+CO3→malachite. The 1st-stage gossan brings the high-Pb-As-Cl uppermost zone with mimetite, anglesite, cerussite, willemite, and Ge-bearing oxidation phases.
**Initial:** 35 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 75ec1282d927a4980296738a964fec2248fee0ce974ee98a59e7c8f6f57ddd5a

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (9):** wulfenite, smithsonite, adamite, mimetite, malachite, vanadinite, cerussite, selenite, conichalcite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (2):** pharmacolite — No Tsumeb occurrence was found in the live Mindat locality list or Harvard Tsumeb Mine Notebook search audited 2026-08-06; the Ca-arsenate engine remains available in documented five-element-vein localities and Creative mode.; haidingerite — No Tsumeb occurrence was found in the live Mindat locality list or Harvard Tsumeb Mine Notebook search audited 2026-08-06; a chemically possible pharmacolite dehydration product is not evidence of this locality occurrence.

**Cited sources:**
  - Pinch & Wilson 1977 — canonical Tsumeb monograph
  - Lombaard et al. 1986 — Tsumeb geology
  - Melcher 2003 — Tsumeb Ge geochemistry
  - Seo et al. 2012 — Pb+Mo simultaneous weathering for wulfenite formation
  - Hemley et al. 1969 — alunite stability + Al solubility under acid-sulfate conditions
  - Stoffregen et al. 2000 — alunite-jarosite paragenesis review
  - Strunz 1959 — Tsumeb deep oxidation zone scheelite + lead-tungstate suite (raspite + stolzite)
  - Bowell 2014, Rev. Mineral. Geochem. 79:589 — Tsumeb hydrogeochemistry + arsenate mineral stability (the acid-front movement)
  - Singer & Stumm 1970, Science 167:1121 — Fe(II)→Fe(III) as the rate-determining step of sulfide-oxidation acid generation
  - Skarpelis 2009, Resource Geology 59(1) — Lavrion Pb-Ag-Zn supergene oxidation profile (carbonate-hosted analogue)
  - Harvard Mineralogical & Geological Museum, Tsumeb Mine Notebook TSNB159 — gypsum is a confirmed, somewhat rare Tsumeb mineral from all three oxidation zones; well-formed crystals reach centimetre scale
  - Mindat locality record 2428, Tsumeb Mine mineral list — live species-list audit on 2026-08-06 found no pharmacolite or haidingerite entry
  - Harvard Mineralogical & Geological Museum, Tsumeb Mine Notebook searchable catalog — live audit on 2026-08-06 found no pharmacolite or haidingerite object entry

## Paragenetic order as grown (34 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | adamite | 1 | 1 | 0 | nucleation |
| 2 | anglesite | 1 | 4 | 0 | nucleation |
| 3 | cerussite | 1 | 4 | 0 | nucleation |
| 4 | duftite | 1 | 2 | 0 | nucleation |
| 5 | goethite | 1 | 1 | 0 | nucleation |
| 6 | malachite | 1 | 1 | 0 | nucleation |
| 7 | mimetite | 1 | 1 | 0 | nucleation |
| 8 | wulfenite | 1 | 1 | 0 | nucleation |
| 9 | conichalcite | 2 | 4 | 0 | nucleation |
| 10 | stolzite | 2 | 4 | 0 | nucleation |
| 11 | brochantite | 3 | 5 | 0 | nucleation |
| 12 | ferrimolybdite | 4 | 6 | 0 | nucleation |
| 13 | koettigite | 4 | 2 | 0 | nucleation |
| 14 | jarosite | 5 | 7 | 0 | nucleation |
| 15 | scorodite | 8 | 9 | 0 | nucleation |
| 16 | powellite | 13 | 4 | 0 | nucleation |
| 17 | smithsonite | 13 | 1 | 0 | nucleation |
| 18 | azurite | 18 | 4 | 0 | nucleation |
| 19 | lepidocrocite | 20 | 3 | 0 | nucleation |
| 20 | aurichalcite | 24 | 4 | 0 | nucleation |
| 21 | chalcocite | 55 | 4 | 0 | nucleation |
| 22 | covellite | 55 | 4 | 0 | nucleation |
| 23 | cuprite | 55 | 1 | 0 | nucleation |
| 24 | caledonite | 70 | 2 | 0 | nucleation |
| 25 | olivenite | 75 | 4 | 0 | nucleation |
| 26 | raspite | 84 | 4 | 0 | nucleation |
| 27 | annabergite | 95 | 1 | 0 | nucleation |
| 28 | erythrite | 95 | 1 | 0 | nucleation |
| 29 | plumbogummite | 115 | 3 | 0 | nucleation |
| 30 | pyromorphite | 115 | 6 | 0 | nucleation |
| 31 | vanadinite | 130 | 6 | 0 | nucleation |
| 32 | descloizite | 139 | 4 | 0 | nucleation |
| 33 | selenite | 173 | 1 | 0 | nucleation |
| 34 | rhodochrosite | 200 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** anglesite, duftite, goethite, stolzite, brochantite, ferrimolybdite, koettigite, jarosite, scorodite, powellite, azurite, lepidocrocite, aurichalcite, chalcocite, covellite, cuprite, caledonite, olivenite, raspite, annabergite, erythrite, plumbogummite, pyromorphite, descloizite, rhodochrosite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 33.26089435471183 → 24.999999999999847 °C  [24.999999999999847, 48.60449873260214] (raw_simulation_state)
  - pH: 6.8 → 5.13734169448535   [4.699999999999999, 6.873928397942787] (raw_simulation_state)
  - Eh: 322.1090020413224 → 220 mV  [131.26050015345746, 356.9690723288825] (raw_simulation_state)
  - salinity: 2 → 2 psu  [2, 2] (raw_simulation_state)
  - O2: 1.8 → 1 mg/L  [0.6, 2.2] (raw_simulation_state)
  - concentration: 1 → 3 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -0.945 → -2.142  [-4.535, -0.315]
  - SI_aragonite: -1.071 → -2.268  [-4.661, -0.441]
  - SI_dolomite: -2.835 → -4.409  [-8, -0.819]
  - SI_HMC: -1.008 → -2.142  [-4.598, -0.315]
  - SI_siderite: 0.945 → -0.945  [-2.709, 1.323]
  - SI_selenite: -1.449 → 0.126  [-1.449, 0.126]
  - SI_anhydrite: -1.638 → -0.126  [-1.701, -0.126]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.917 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.050955796; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.051 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.048685792; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.049 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.09720727800000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.097 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.048471978000000006; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.048 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.045546822; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.046 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.042060982; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.042 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.042262138; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.042 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.041801546; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.042 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 33.26089435471183 → 24.999999999999847 °C [24.999999999999847, 48.60449873260214], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.929457217227439,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000016,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Tsumeb mine (Otavi Mountain Land, Namibia). Pipe-shaped Pb-Zn-Cu sulfide body in Neoproterozoic dolomite, with three distinct supergene oxidation zones developed during Mesozoic-Cenozoic uplift. Argentiferous (native Ag, proustite, pyrargyrite, argentiferous galena). References: Pinch & Wilson 1977 (canonical Tsumeb monograph), Lombaard et al. 1986 (geology), Melcher 2003 (Ge geochemistry).

> Acid-window mechanic (steps 5-16): the supergene_acidification handler fires FOUR times (steps 5/8/12/16) to hold pH near 4 against the limestone wall's carbonate buffering. Without the repeated pulses, the buffer neutralizes pH back to 6+ within ~5 steps. The 15-step acid window is when scorodite + jarosite + alunite nucleate. ev_meteoric_flush at step 20 ends the acid phase.

> Chemistry-audit gap-fill pass (Apr 2026): added Ag (Tsumeb's silver suite), Ge (the type-locality element), Sb (proustite-pyrargyrite + tetrahedrite enabling), Na/K (minor groundwater cation traces), Au=0.3 (sub-threshold trace, no nucleation). v5 gap-fills: Al=25 (alunite enabling per Hemley 1969 + Stoffregen 2000), W=20 (Round 8d-1, Tsumeb deep-zone scheelite + raspite + stolzite per Strunz 1959). Existing 8-event sequence preserved untouched.

> LIVE LOCALITY RECONCILIATION (2026-08-06): the current Mindat Tsumeb Mine locality list and the Harvard Tsumeb Mine Notebook searchable catalog were checked directly. Neither pharmacolite nor haidingerite appears. Both are therefore excluded from this Tsumeb scenario rather than inferred from fluid chemistry; their global engines remain available where occurrence evidence exists. Gypsum/selenite remains licensed independently by Harvard Tsumeb Mine Notebook record TSNB159.
