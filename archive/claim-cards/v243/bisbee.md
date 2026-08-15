# CLAIM CARD — bisbee  (v243, seed 42, 340 steps)

**Anchor:** Bisbee, Arizona — Warren Mining District, Cochise County. Laramide quartz-monzonite porphyry intruding Paleozoic Escabrosa Limestone + Abrigo Formation. Major Cu-Ag-Au district (~8 Mt Cu, ~25 Moz Ag, ~3 Moz Au historically).
**Deposit:** Classic copper porphyry with world-class oxidation zone. Complete Cu paragenesis from primary sulfides through supergene enrichment to the cyan-blue chrysocolla finale. Centerpiece mechanic: azurite ↔ malachite ↔ chrysocolla cascade tracking pCO2 evolution.
**Initial:** 400 °C, 1 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:opal5..100C+quartz100..700C-no-cosmetic-relabel-v1|sulfur-ledger:sulfide+sulfate+elemental-independent+pathway-gated-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 5e725d79305df3d921fced7f9913191263f2b2fda9a80a04d0410f346d081cd8

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (5):** chalcopyrite, malachite, azurite, chrysocolla, brochantite

**Cited sources:**
  - Graeme, Graeme & Graeme 2019 — modern Bisbee monograph
  - Bryant 1968 — Warren District geology
  - Crane 1911 — early Bisbee geology
  - Vink 1986 — azurite ↔ malachite pCO2 thermodynamics
  - Mote et al. 2001 — supergene chrysocolla geochemistry

## Paragenetic order as grown (38 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | argentite | 0 | 4 |
| 3 | chalcopyrite | 0 | 1 |
| 4 | feldspar | 0 | 2 |
| 5 | pyrite | 0 | 1 |
| 6 | tennantite | 0 | 1 |
| 7 | tetrahedrite | 0 | 1 |
| 8 | arsenopyrite | 3 | 4 |
| 9 | millerite | 3 | 4 |
| 10 | amosite | 38 | 1 |
| 11 | acanthite | 64 | 1 |
| 12 | chalcocite | 64 | 5 |
| 13 | covellite | 64 | 4 |
| 14 | galena | 64 | 1 |
| 15 | marcasite | 64 | 1 |
| 16 | realgar | 64 | 1 |
| 17 | selenite | 69 | 2 |
| 18 | chrysocolla | 71 | 5 |
| 19 | malachite | 71 | 1 |
| 20 | goethite | 72 | 1 |
| 21 | cuprite | 73 | 1 |
| 22 | hematite | 74 | 1 |
| 23 | atacamite | 83 | 4 |
| 24 | brochantite | 83 | 6 |
| 25 | turquoise | 90 | 4 |
| 26 | bornite | 94 | 3 |
| 27 | siderite | 118 | 2 |
| 28 | native_gold | 119 | 5 |
| 29 | native_copper | 128 | 1 |
| 30 | native_silver | 131 | 2 |
| 31 | lepidocrocite | 155 | 27 |
| 32 | erythrite | 165 | 4 |
| 33 | azurite | 179 | 4 |
| 34 | opal | 179 | 5 |
| 35 | annabergite | 188 | 4 |
| 36 | mimetite | 235 | 3 |
| 37 | dioptase | 264 | 4 |
| 38 | halite | 326 | 2 |

**Surprises (grown but NOT in expects_species):** albite, argentite, feldspar, pyrite, tennantite, tetrahedrite, arsenopyrite, millerite, amosite, acanthite, chalcocite, covellite, galena, marcasite, realgar, selenite, goethite, cuprite, hematite, atacamite, turquoise, bornite, siderite, native_gold, native_copper, native_silver, lepidocrocite, erythrite, opal, annabergite, mimetite, dioptase, halite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 398.622 → 23.622 °C  [23.622, 398.622]
  - pH: 5.291 → 6.504   [4.795, 7.386]
  - Eh: -149.606 → 275.591 mV  [-187.402, 318.11]
  - salinity: 29.921 → 150.394 psu  [29.921, 150.394]
  - O2: 0.039 → 1.378 mg/L  [0.039, 1.772]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: -6.11 → -2.399  [-6.11, -0.252]
  - SI_aragonite: -6.236 → -2.583  [-6.236, -0.378]
  - SI_dolomite: -8 → -4.787  [-8, -0.386]
  - SI_HMC: -7.748 → -3.407  [-7.748, -1.26]
  - SI_siderite: -2.52 → 0.189  [-2.52, 2.394]
  - SI_selenite: -1.26 → -2.268  [-2.583, -0.885]
  - SI_anhydrite: -0.756 → -2.394  [-2.654, -0.756]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.592 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 72.70 °C; initial a_w=0.983 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1 → 1 kbar [1, 1], n=340
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=340
  - Temperature: 398.2608943547122 → 25 °C [25, 398.2608943547122], n=340
  - Secure aragonite assessment: 0/340 executed steps; first={"boundary_kbar":3.5732160863219935,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":340}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Bisbee, Arizona — Warren Mining District, Cochise County. Host: combo Laramide quartz-monzonite porphyry intruded into Paleozoic Escabrosa Limestone + Abrigo Formation. In the sim this is represented as a limestone wall (the pH buffer, the CO3 source for azurite) with scenario events that inject dissolved SiO2 from the surrounding silicate matrix weathering — the supply path for late chrysocolla.

> Centerpiece mechanic: the azurite → malachite → chrysocolla cascade. Azurite dominates at high pCO2 (event 6, CO3 >= 120 ppm). A pCO2-drop event (event 7) dissolves azurite and fires malachite. A silica-seep event (event 8) dissolves malachite-without-silica and fires chrysocolla pseudomorphs on the remaining azurite crystals. Three carbonate/silicate phases recording three different groundwater chemistries, each one freezing a different step of the Cochise County monsoon.

> Chemistry-audit gap-fill pass (Apr 2026): Ag=40 (Bisbee was a major Ag producer ~25 Moz; argentiferous galena + tetrahedrite + argentite + minor native Ag per Graeme et al. 2019). Mg=50 (Escabrosa Limestone host dolomitic in places; brief-required non-zero baseline). P=5 (enables pyromorphite given Pb+Cl already populated). Sb=5 (tetrahedrite trace; completes the Sb-As-Bi greisen triplet). Au=3 (Bisbee ~3 Moz historically — Cu-Au porphyry; native gold + auriferous chalcocite per Graeme 2019).

> Round 8c-1 additions (Apr 2026): Co=80, Ni=70 — Bisbee's deep primary sulfide assemblage includes minor Co/Ni-bearing sulfarsenide phases (cobaltite + nickeline + safflorite) per Graeme et al. 2019, citing Bryant 1968. Activates dormant Co/Ni pools for the new sulfarsenide engines and feeds the existing erythrite + annabergite supergene arsenates further down the cascade.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — COPPER QUEEN MINE, Bisbee; 56 valid, 2 TL: Chalcoalumite + Paramelaconite. NB the first capture attempt hit the WARREN TOWNSITE page — 6 species, no copper — the trap is recorded in the bridge: the sub-locality must be the ORE BODY, not the townsite): Alabandite, Allophane, Anglesite, Antigorite, Antlerite, Aragonite, Aurichalcite, Azurite, Bornite, Brochantite, Brucite, Calcite, Carbonatecyanotrichite, Chalcanthite, Chalcoalumite (TL), Chalcocite, Chalcopyrite, 'Chlorite Gp', Chrysocolla, 'Clinochrysotile', Connellite, Copiapite, Coquimbite, Cuprite (var. Chalcotrichite), Cyanotrichite, Delafossite, Felsőbányaite, Gibbsite, Goethite, Gypsum (var. SELENITE), Halloysite, Hoganite, Hydrobasaluminite, Kaolinite, Kornelite, 'Limonite', Magnetite, Malachite, Meionite, Muscovite (var. Sericite), Native Copper, Native Silver, Paramelaconite (TL), Paratacamite, Pyrite, Quartz, Rhomboclase, Rosasite, Römerite, Rozenite, Siderite, Spangolite, Sphalerite, Stevensite, Tenorite, Tremolite, Uraninite, Voltaite, Wollastonite. THE DESIGN QUESTION THIS LIST RAISES — SPATIAL GRAIN: the scenario anchors to the DISTRICT (Warren Mining District, Graeme et al. 2019 defenses in the notes above) but this list is ONE MINE. Several sim species unlisted at CQ are licensed elsewhere in the district or by Graeme — flags below mean 'not at Copper Queen', and the BOSS ADJUDICATES whether the scenario is CQ-grained or district-grained before anything dies. Verdicts vs seed-42 v236 (30 sim species): LICENSED ✓ 13: azurite, bornite, brochantite, chalcocite, chalcopyrite, chrysocolla, cuprite, goethite, malachite, native_copper, native_silver, pyrite, selenite (Gypsum var. — the selenite census's FIFTH yes/no: elmwood NO / picher YES / sweetwater NO / tsumeb YES / copper queen YES). FLAGS (unlisted at CQ): ATACAMITE ×4 @34 mm — CQ lists PARAtacamite, the polymorph twist (adjudicate: swap species or district-license?); COVELLITE ×4 (enrichment-blanket species; CQ is the oxide-zone-famous mine — plausibly licensed at other shafts); ACANTHITE ×4 (Native Silver listed, acanthite not — the discrete-Ag-species pattern's THIRD appearance after mvt-v195 + sweetwater); DIOPTASE ×4; MIMETITE ×2; ERYTHRITE ×3 + ANNABERGITE ×1 (the bloom pair AGAIN — Graeme-defended via Bryant 1968 in the note above, so literature-vs-list, not clean confabulation); TURQUOISE ×4 — famous 'Bisbee Blue' is LAVENDER PIT material, not CQ (the sharpest spatial-grain example on the sheet); NATIVE_GOLD ×4 (commodity list says Gold, species list lacks it — commodity ≠ species entry); HALITE ×4 (the rung-5 final_drying mechanic; no Bisbee halite record); OPAL ×5; albite/feldspar (host-rock, unlisted); arsenopyrite, marcasite, tennantite/tetrahedrite (0-growth dust). LICENSED-BUT-UNFIRED candidates: PARAMELACONITE (TL here — Cu oxide the sim lacks), chalcoalumite (TL) + the Al-sulfate suite (cyanotrichite/hydrobasaluminite), the post-mining Fe-sulfate efflorescence suite (copiapite/coquimbite/römerite/rozenite/voltaite/rhomboclase), spangolite, connellite, rosasite, aurichalcite, anglesite, tenorite, delafossite, SIDERITE (listed here + sim doesn't grow it at bisbee — the inverse of the MVT-family siderite flag: the Fe-carbonate story is per-locality, not a global over-fire), hoganite (natural Cu ACETATE — post-mining organics, a curiosity), uraninite.
