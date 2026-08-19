# CLAIM CARD — bisbee  (v256, seed 42, 340 steps)

**Anchor:** Bisbee, Arizona — Warren Mining District, Cochise County. Laramide quartz-monzonite porphyry intruding Paleozoic Escabrosa Limestone + Abrigo Formation. Major Cu-Ag-Au district (~8 Mt Cu, ~25 Moz Ag, ~3 Moz Au historically).
**Deposit:** Classic copper porphyry with world-class oxidation zone. Complete Cu paragenesis from primary sulfides through supergene enrichment to the cyan-blue chrysocolla finale. Centerpiece mechanic: azurite ↔ malachite ↔ chrysocolla cascade tracking pCO2 evolution.
**Initial:** 400 °C, 1 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 5e725d79305df3d921fced7f9913191263f2b2fda9a80a04d0410f346d081cd8

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (5):** chalcopyrite, malachite, azurite, chrysocolla, brochantite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Graeme, Graeme & Graeme 2019 — modern Bisbee monograph
  - Bryant 1968 — Warren District geology
  - Crane 1911 — early Bisbee geology
  - Vink 1986 — azurite ↔ malachite pCO2 thermodynamics
  - Mote et al. 2001 — supergene chrysocolla geochemistry

## Paragenetic order as grown (39 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 2 | 0 | nucleation |
| 2 | argentite | 1 | 4 | 0 | nucleation |
| 3 | chalcopyrite | 1 | 1 | 0 | nucleation |
| 4 | feldspar | 1 | 2 | 0 | nucleation |
| 5 | pyrite | 1 | 1 | 0 | nucleation |
| 6 | tennantite | 1 | 1 | 0 | nucleation |
| 7 | tetrahedrite | 1 | 1 | 0 | nucleation |
| 8 | arsenopyrite | 4 | 4 | 0 | nucleation |
| 9 | millerite | 4 | 4 | 0 | nucleation |
| 10 | amosite | 39 | 1 | 0 | nucleation |
| 11 | acanthite | 65 | 1 | 4 | nucleation; argentite -> acanthite |
| 12 | chalcedony | 65 | 4 | 0 | nucleation |
| 13 | chalcocite | 65 | 5 | 0 | nucleation |
| 14 | covellite | 65 | 4 | 0 | nucleation |
| 15 | galena | 65 | 1 | 0 | nucleation |
| 16 | marcasite | 65 | 1 | 0 | nucleation |
| 17 | realgar | 65 | 1 | 0 | nucleation |
| 18 | siderite | 67 | 2 | 0 | nucleation |
| 19 | chrysocolla | 72 | 5 | 0 | nucleation |
| 20 | malachite | 72 | 1 | 0 | nucleation |
| 21 | goethite | 73 | 1 | 0 | nucleation |
| 22 | cuprite | 74 | 1 | 0 | nucleation |
| 23 | hematite | 75 | 1 | 0 | nucleation |
| 24 | opal | 78 | 21 | 0 | nucleation |
| 25 | atacamite | 84 | 4 | 0 | nucleation |
| 26 | brochantite | 84 | 9 | 0 | nucleation |
| 27 | turquoise | 91 | 4 | 0 | nucleation |
| 28 | bornite | 95 | 3 | 0 | nucleation |
| 29 | native_gold | 120 | 5 | 0 | nucleation |
| 30 | pararealgar | 124 | 0 | 1 | realgar -> pararealgar |
| 31 | native_copper | 129 | 1 | 0 | nucleation |
| 32 | native_silver | 132 | 2 | 0 | nucleation |
| 33 | lepidocrocite | 156 | 34 | 0 | nucleation |
| 34 | erythrite | 166 | 30 | 0 | nucleation |
| 35 | azurite | 180 | 4 | 0 | nucleation |
| 36 | annabergite | 189 | 39 | 0 | nucleation |
| 37 | mimetite | 240 | 3 | 0 | nucleation |
| 38 | dioptase | 265 | 5 | 0 | nucleation |
| 39 | halite | 327 | 2 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite, argentite, feldspar, pyrite, tennantite, tetrahedrite, arsenopyrite, millerite, amosite, acanthite, chalcedony, chalcocite, covellite, galena, marcasite, realgar, siderite, goethite, cuprite, hematite, opal, atacamite, turquoise, bornite, native_gold, pararealgar, native_copper, native_silver, lepidocrocite, erythrite, annabergite, mimetite, dioptase, halite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 398.26089435470675 → 20 °C  [20, 398.26089435470675] (raw_simulation_state)
  - pH: 5.3 → 6.5   [4.779999999999999, 7.4] (raw_simulation_state)
  - Eh: -149.99678210951578 → 322.1090020413224 mV  [-185.27596281341636, 322.1090020413224] (raw_simulation_state)
  - salinity: 30 → 150 psu  [30, 150] (raw_simulation_state)
  - O2: 0.05012020879677884 → 1.8 mg/L  [0.022245407814205295, 1.8] (raw_simulation_state)
  - concentration: 1 → 3 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -6.11 → -3.47  [-6.11, -1.197]
  - SI_aragonite: -6.173 → -3.591  [-6.173, -1.32]
  - SI_dolomite: -8 → -6.808  [-8, -2.205]
  - SI_HMC: -5.921 → -2.583  [-5.921, -0.315]
  - SI_siderite: -2.457 → -0.819  [-3.087, 1.512]
  - SI_selenite: -8 → -2.394  [-8, -1.134]
  - SI_anhydrite: -8 → -3.402  [-8, -2.079]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.592 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 72.70 °C; initial a_w=0.983 ±0.020 (temperature-extrapolation)
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
  - Fluid pressure: 1 → 1 kbar [1, 1], n=340
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=340
  - Temperature: 398.26089435470675 → 20 °C [20, 398.26089435470675], n=340
  - Secure aragonite assessment: 0/340 executed steps; first={"boundary_kbar":3.5732160863219367,"secure_aragonite":false}, last={"boundary_kbar":3.0264545399999996,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":340}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Transformation step 65: argentite → acanthite (paramorph)
  - Transformation step 65: argentite → acanthite (paramorph)
  - Transformation step 65: argentite → acanthite (paramorph)
  - Transformation step 65: argentite → acanthite (paramorph)
  - Transformation step 124: realgar → pararealgar (paramorph)
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Bisbee, Arizona — Warren Mining District, Cochise County. Host: combo Laramide quartz-monzonite porphyry intruded into Paleozoic Escabrosa Limestone + Abrigo Formation. In the sim this is represented as a limestone wall (the pH buffer, the CO3 source for azurite) with scenario events that inject dissolved SiO2 from the surrounding silicate matrix weathering — the supply path for late chrysocolla.

> Centerpiece mechanic: the azurite → malachite → chrysocolla cascade. Azurite dominates at high pCO2 (event 6, CO3 >= 120 ppm). A pCO2-drop event (event 7) dissolves azurite and fires malachite. A silica-seep event (event 8) dissolves malachite-without-silica and fires chrysocolla pseudomorphs on the remaining azurite crystals. Three carbonate/silicate phases recording three different groundwater chemistries, each one freezing a different step of the Cochise County monsoon.

> Chemistry-audit gap-fill pass (Apr 2026): Ag=40 (Bisbee was a major Ag producer ~25 Moz; argentiferous galena + tetrahedrite + argentite + minor native Ag per Graeme et al. 2019). Mg=50 (Escabrosa Limestone host dolomitic in places; brief-required non-zero baseline). P=5 (enables pyromorphite given Pb+Cl already populated). Sb=5 (tetrahedrite trace; completes the Sb-As-Bi greisen triplet). Au=3 (Bisbee ~3 Moz historically — Cu-Au porphyry; native gold + auriferous chalcocite per Graeme 2019).

> Round 8c-1 additions (Apr 2026): Co=80, Ni=70 — Bisbee's deep primary sulfide assemblage includes minor Co/Ni-bearing sulfarsenide phases (cobaltite + nickeline + safflorite) per Graeme et al. 2019, citing Bryant 1968. Activates dormant Co/Ni pools for the new sulfarsenide engines and feeds the existing erythrite + annabergite supergene arsenates further down the cascade.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — COPPER QUEEN MINE, Bisbee; 56 valid, 2 TL: Chalcoalumite + Paramelaconite. NB the first capture attempt hit the WARREN TOWNSITE page — 6 species, no copper — the trap is recorded in the bridge: the sub-locality must be the ORE BODY, not the townsite): Alabandite, Allophane, Anglesite, Antigorite, Antlerite, Aragonite, Aurichalcite, Azurite, Bornite, Brochantite, Brucite, Calcite, Carbonatecyanotrichite, Chalcanthite, Chalcoalumite (TL), Chalcocite, Chalcopyrite, 'Chlorite Gp', Chrysocolla, 'Clinochrysotile', Connellite, Copiapite, Coquimbite, Cuprite (var. Chalcotrichite), Cyanotrichite, Delafossite, Felsőbányaite, Gibbsite, Goethite, Gypsum (var. SELENITE), Halloysite, Hoganite, Hydrobasaluminite, Kaolinite, Kornelite, 'Limonite', Magnetite, Malachite, Meionite, Muscovite (var. Sericite), Native Copper, Native Silver, Paramelaconite (TL), Paratacamite, Pyrite, Quartz, Rhomboclase, Rosasite, Römerite, Rozenite, Siderite, Spangolite, Sphalerite, Stevensite, Tenorite, Tremolite, Uraninite, Voltaite, Wollastonite. THE DESIGN QUESTION THIS LIST RAISES — SPATIAL GRAIN: the scenario anchors to the DISTRICT (Warren Mining District, Graeme et al. 2019 defenses in the notes above) but this list is ONE MINE. Several sim species unlisted at CQ are licensed elsewhere in the district or by Graeme — flags below mean 'not at Copper Queen', and the BOSS ADJUDICATES whether the scenario is CQ-grained or district-grained before anything dies. Verdicts vs seed-42 v236 (30 sim species): LICENSED ✓ 13: azurite, bornite, brochantite, chalcocite, chalcopyrite, chrysocolla, cuprite, goethite, malachite, native_copper, native_silver, pyrite, selenite (Gypsum var. — the selenite census's FIFTH yes/no: elmwood NO / picher YES / sweetwater NO / tsumeb YES / copper queen YES). FLAGS (unlisted at CQ): ATACAMITE ×4 @34 mm — CQ lists PARAtacamite, the polymorph twist (adjudicate: swap species or district-license?); COVELLITE ×4 (enrichment-blanket species; CQ is the oxide-zone-famous mine — plausibly licensed at other shafts); ACANTHITE ×4 (Native Silver listed, acanthite not — the discrete-Ag-species pattern's THIRD appearance after mvt-v195 + sweetwater); DIOPTASE ×4; MIMETITE ×2; ERYTHRITE ×3 + ANNABERGITE ×1 (the bloom pair AGAIN — Graeme-defended via Bryant 1968 in the note above, so literature-vs-list, not clean confabulation); TURQUOISE ×4 — famous 'Bisbee Blue' is LAVENDER PIT material, not CQ (the sharpest spatial-grain example on the sheet); NATIVE_GOLD ×4 (commodity list says Gold, species list lacks it — commodity ≠ species entry); HALITE ×4 (the rung-5 final_drying mechanic; no Bisbee halite record); OPAL ×5; albite/feldspar (host-rock, unlisted); arsenopyrite, marcasite, tennantite/tetrahedrite (0-growth dust). LICENSED-BUT-UNFIRED candidates: PARAMELACONITE (TL here — Cu oxide the sim lacks), chalcoalumite (TL) + the Al-sulfate suite (cyanotrichite/hydrobasaluminite), the post-mining Fe-sulfate efflorescence suite (copiapite/coquimbite/römerite/rozenite/voltaite/rhomboclase), spangolite, connellite, rosasite, aurichalcite, anglesite, tenorite, delafossite, SIDERITE (listed here + sim doesn't grow it at bisbee — the inverse of the MVT-family siderite flag: the Fe-carbonate story is per-locality, not a global over-fire), hoganite (natural Cu ACETATE — post-mining organics, a curiosity), uraninite.
