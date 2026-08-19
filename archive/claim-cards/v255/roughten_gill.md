# CLAIM CARD — roughten_gill  (v255, seed 42, 200 steps)

**Anchor:** Roughten Gill Mine, Caldbeck Fells, Lake District, Cumbria, England. Polymetallic Pb-Cu fissure-vein deposit in Eycott Volcanic Group + Carrock Fell Intrusive Complex (granophyre footwall + gabbro hangingwall). Worked 1700s-1894 for lead + minor copper, dumps reworked for barite post-1894; classic specimen-collector locality. TYPE LOCALITY for plumbogummite (Hartley 1882; Förtsch 1967 corrected type material to plumbogummite-hinsdalite-hidalgoite mix-crystal). Per Cooper & Stanley (1990) 'Minerals of the English Lake District: Caldbeck Fells' + the Russell Society multi-part review (Bridges et al. 2011 Part 3).
**Deposit:** Pb-Cu fissure-vein in Eycott Volcanic Group volcanics + Carrock Fell Intrusive Complex granophyre/gabbro walls, weathered through an exhaustively-documented supergene oxidation sequence: primary galena+chalcopyrite+sphalerite+pyrite+tetrahedrite/tennantite (T 110-130°C, high-salinity Na-Ca-Cl basinal brine, H2S-buffered) → cooling lockup → pyrite-oxidation AMD acid pulse → linarite stage (Pb+Cu+SO4 with CO3:SO4 << 0.3 producing the iconic Roughten Gill azure-blue cabinet specimens) → caledonite + brochantite transition as CO3 rises → leadhillite cap when CO3:SO4 > 1.5 and Cu depletes. The v100 Pb-Cu sulfate trio (linarite + caledonite + leadhillite) fires in their type-district here — Cooper & Stanley + the Russell Society three-part review document each mineral per-mine in Caldbeck Fells. TYPE LOCALITY for plumbogummite PbAl3(PO4)2(OH)5·H2O (Hartley 1882 from Roughten Gill); plumbogummite is NOT yet wired in the simulator and is flagged as the imminent v108 add-mineral commit to complete the type-locality story. The headline cabinet aesthetic is plumbogummite-after-pyromorphite pseudomorphs — cobalt-blue botryoidal crusts draping green pyromorphite hexagonal prisms — which will only complete once plumbogummite engine ships.
**Initial:** 130 °C, 0.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 9aa83b17961beff1755619dec6919551a9982c9a114748356884214503371471

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (13):** galena, sphalerite, pyrite, tetrahedrite, tennantite, cerussite, anglesite, linarite, caledonite, leadhillite, brochantite, pyromorphite, mottramite
**Statistical (0):** (none)
**Aspirational (4):** chalcopyrite — Documented primary ore but absent from the release seed audit; the current Cu-S allocation preferentially feeds other sulfides.; calcite — Documented gangue but absent from the release seed audit in this silicate-hosted, carbonate-poor path.; mimetite — Documented campylite-stage arsenate but absent from the release seed audit; requires a better Pb-As-Cl allocation window.; native_silver — Documented at the locality but absent from the release seed audit; current silver is retained in or routed to other Ag phases.
**Locality exclusions (0):** (none)

**Cited sources:**
  - Cooper M.P. & Stanley C.J. (1990) — Minerals of the English Lake District: Caldbeck Fells. Natural History Museum, London. ISBN 0-565-01102-2. THE canonical multi-volume monograph with per-mine paragenetic detail for every Caldbeck locality.
  - Bridges T.F., Green D.I., Rumsey M.S. & Leppington C.M. (2011) — A review of the mineralisation at the Roughton Gill Mines, Caldbeck Fells, Cumbria: Part 3 - Roughton Gill Mine. Journal of the Russell Society 14: 3-23. The modern definitive paper on Roughten Gill specifically.
  - Green D.I., Bridges T.F., Rumsey M.S., Leppington C.M. & Tindle A.G. (2008) — A review of the mineralogy of the Roughton Gill Mines, Caldbeck Fells, Cumbria: Part 2 - The Roughton Gill South Vein on Balliway Rigg. Journal of the Russell Society 11: 3-28.
  - Rumsey M.S. et al. (2008) — A review of the mineralization at Red Gill Mine, Caldbeck Fells, Cumbria, England. Journal of the Russell Society 11: 29-47. Companion paper covering the adjacent Red Gill (carbonate-deficient supergene chemistry is identified there and applies to Roughten Gill similarly).
  - Symes R.F. & Young B.R. (2008) — Minerals of Northern England. British Geological Survey / National Museums Scotland. ISBN 978-1-905267-01-9. Regional context for Caldbeck within the broader Northern English mining heritage.
  - Förtsch E.B. (1967) — Plumbogummite from Roughten Gill, Cumberland. Mineralogical Magazine 36 (280): 530-538. DOI 10.1180/minmag.1967.036.280.07. Critical re-examination of Hartley's 1882 type material — demonstrated it is a plumbogummite-hinsdalite-hidalgoite mix-crystal by X-ray + IR + optical methods.
  - Hartley J. (1882) — On plumbogummite from Roughten Gill, Cumberland. Mineralogical Magazine 5: 21-23. Original type description of plumbogummite from the type locality.
  - Russell A. (1925) — On the occurrence of plumbogummite at Roughten Gill, Cumberland. Mineralogical Magazine 20: 257-264. Russell's Caldbeck mineralogy work.
  - Russell A. (1986) — A review of the mineralization of the English Lake District. Mineralogical Magazine 50: 587-600.
  - Pluth J.J., Steele I.M., Kampf A.R. & Green D.I. (2005) — Redgillite, Cu6(OH)10(SO4).H2O, a new mineral from Caldbeck Fells, Cumbria, England: description and crystal structure. Mineralogical Magazine 69: 973-980. Redgillite is a Caldbeck type-locality species (Red Gill, adjacent); flagged for future add-mineral.
  - Stanley C.J., Symes R.F. & Jones G.C. (1991) — Nickeloan mottramite and a chemical and structural study of the descloizite group of minerals. Mineralogical Magazine 55: 121-126. Caldbeck mottramite chemistry.
  - Goldring D. (1991) — Cumbria's Underground Heritage. Historical mining context for the Caldbeck Fells district + Roughten Gill working history.
  - British Geological Survey Earthwise — Mineralization in the Lake District. Fluid-inclusion T 110-130°C, K-Ar wallrock alteration ages 360-330 Ma, sulfur partly from Carboniferous evaporites, Ag-in-galena ~838 ppm.
  - Research dossier 2026-05-20 — internal research-agent compilation anchoring the scenario broth on Cooper & Stanley 1990 + Russell Society three-part review + BGS Earthwise.

## Paragenetic order as grown (27 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | chalcocite | 1 | 1 | 0 | nucleation |
| 2 | galena | 1 | 4 | 0 | nucleation |
| 3 | orpiment | 1 | 1 | 0 | nucleation |
| 4 | proustite | 1 | 2 | 0 | nucleation |
| 5 | pyrite | 1 | 1 | 0 | nucleation |
| 6 | realgar | 1 | 6 | 0 | nucleation |
| 7 | sphalerite | 1 | 1 | 0 | nucleation |
| 8 | tennantite | 1 | 1 | 0 | nucleation |
| 9 | tetrahedrite | 1 | 1 | 0 | nucleation |
| 10 | acanthite | 8 | 4 | 0 | nucleation |
| 11 | chalcedony | 25 | 4 | 0 | nucleation |
| 12 | pararealgar | 60 | 0 | 6 | realgar -> pararealgar |
| 13 | anglesite | 70 | 4 | 0 | nucleation |
| 14 | caledonite | 70 | 2 | 0 | nucleation |
| 15 | chrysocolla | 70 | 5 | 0 | nucleation |
| 16 | covellite | 70 | 4 | 0 | nucleation |
| 17 | linarite | 70 | 2 | 0 | nucleation |
| 18 | plumbogummite | 70 | 3 | 0 | nucleation |
| 19 | pyromorphite | 70 | 6 | 0 | nucleation |
| 20 | vanadinite | 70 | 6 | 0 | nucleation |
| 21 | brochantite | 72 | 5 | 0 | nucleation |
| 22 | mottramite | 75 | 4 | 0 | nucleation |
| 23 | turquoise | 91 | 4 | 0 | nucleation |
| 24 | cerussite | 145 | 4 | 0 | nucleation |
| 25 | aurichalcite | 152 | 4 | 0 | nucleation |
| 26 | leadhillite | 175 | 2 | 0 | nucleation |
| 27 | descloizite | 176 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** chalcocite, orpiment, proustite, realgar, acanthite, chalcedony, pararealgar, chrysocolla, covellite, plumbogummite, vanadinite, turquoise, aurichalcite, descloizite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** chalcopyrite, calcite, mimetite, native_silver
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 128.2608943547122 → 25 °C  [25, 128.2608943547122] (raw_simulation_state)
  - pH: 5.1 → 7   [5.1, 7] (raw_simulation_state)
  - Eh: -150.10299956639813 → 201.6970037757299 mV  [-150.10299956639813, 251.67249841904993] (raw_simulation_state)
  - salinity: 8 → 4 psu  [4, 8] (raw_simulation_state)
  - O2: 0.05 → 0.8999999999999999 mg/L  [0.05, 1.2] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -4.346 → -1.386  [-4.724, -1.386]
  - SI_aragonite: -4.409 → -1.512  [-4.85, -1.512]
  - SI_dolomite: -8 → -3.213  [-8, -3.213]
  - SI_HMC: -4.346 → -1.008  [-4.346, -1.008]
  - SI_siderite: -2.646 → -0.189  [-3.465, 0.126]
  - SI_selenite: -1.575 → -1.449  [-1.827, -1.257]
  - SI_anhydrite: -1.827 → -2.079  [-2.457, -1.764]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.477 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.995 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.89288431; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.893 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.45130703; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.451 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.42689177; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.427 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.36352698; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.364 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.347842324; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.348 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.36033788; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.360 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 128.2608943547122 → 25 °C [25, 128.2608943547122], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.4814108954849248,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Transformation step 60: realgar → pararealgar (paramorph)
  - Transformation step 62: realgar → pararealgar (paramorph)
  - Transformation step 65: realgar → pararealgar (paramorph)
  - Transformation step 70: realgar → pararealgar (paramorph)
  - Transformation step 72: realgar → pararealgar (paramorph)
  - Transformation step 73: realgar → pararealgar (paramorph)
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Roughten Gill Mine, Caldbeck Fells, Cumbria. The Caldbeck Fells district occupies the northern Skiddaw inlier; Roughten Gill itself sits on the southern flank of Balliway Rigg (NY 304 344). Host is the Ordovician Eycott Volcanic Group (basaltic-andesitic to rhyolitic lavas + tuffs — NOT Borrowdale Volcanic Group, a common error in derivative literature). The South Vein cuts a NE-SW normal fault juxtaposing the Carrock Fell Intrusive Complex's Iron Crag Microgranite (Carrock Granophyre, U-Pb zircon 452.4 ± 3.1 Ma) against gabbro of the same complex. Caldbeck Fells district hosts ~175 valid mineral species — the greatest mineralogical diversity per unit area in the British Isles per Bridges et al. 2011 + Cooper & Stanley 1990.

> Type locality for plumbogummite PbAl3(PO4)2(OH)5·H2O (Hartley J. 1882 'On plumbogummite from Roughten Gill, Cumberland' MinMag 5:21). Förtsch E.B. (1967) MinMag 36:530 re-examined Hartley's type material by X-ray + IR + optical methods and showed it to be a plumbogummite-hinsdalite-hidalgoite mix-crystal — the bluish-grey crust contains all three alunite-supergroup endmembers. Plumbogummite is currently NOT in the simulator's mineral catalog (128 live minerals as of v104). Imminent add-mineral commit (v108) will wire plumbogummite as a Pb-Al-PO4 supergene-late phase; the scenario will pick it up automatically once the engine wires, completing the headline cabinet aesthetic (plumbogummite-after-pyromorphite pseudomorphs).

> Engine fit: this scenario fires the v100 Pb-Cu sulfate trio (linarite + caledonite + leadhillite) in their type-district. v100 listed Leadhills (Scotland) + Tsumeb (Namibia) as canonical references; Caldbeck Fells is the third type-locality district and is now represented. The trio's CO3:SO4 ratio fork is the load-bearing discriminator: linarite needs CO3:SO4 < 0.3 (early supergene, before atmospheric CO2 has had time to accumulate); caledonite needs 0.1-2.0 (sweet spot 0.3-1.0); leadhillite needs > 1.5 (terminal stage, Cu mostly consumed). The five-stage event sequence walks the broth through this CO3:SO4 evolution naturally.

> Eycott Volcanic Group + Carrock Fell granophyre/gabbro host = SILICATE not carbonate. Wall composition 'basalt' as closest silicate proxy in the sim (no granophyre/gabbro composition supported). reactivity=0.0 keeps the wall inert — Caldbeck supergene chemistry is NOT carbonate-buffered (unlike Tsumeb where limestone wallrock buffers CO3 high). At Caldbeck, CO3 comes from atmospheric CO2 dissolution in meteoric water + minor vein-calcite during the supergene window. This is the geological reason linarite is so common at Roughten Gill (early-stage low-CO3 conditions persist; the deposit is 'deficient in carbonates' per Rumsey et al. 2008 Red Gill paper, applies to Roughten Gill similarly) and leadhillite is rarer (only fires once meteoric CO3 builds up). Same trio engine as Tsumeb, but different broth trajectory.

> Fluid chemistry per BGS Earthwise Lake District + Russell Society Caldbeck papers: T 110-130°C primary (cooler than Pennine-Yorkshire 150-250°C bracket; calibrated to the Lake District lower bound); salinity 15-30 wt% NaCl-eq basinal brine (scenario broth at 8 wt% as scaled simulator value); Ag-in-galena ~838 ppm (the 'lattice silver' reservoir liberated during supergene oxidation produces the native_silver flakes documented at Roughten Gill); native antimony + Sb-sulphosalt inclusions in galena are diagnostic. Sulfur partly sourced from Carboniferous evaporites per BGS sulfur-isotope work.

> Specimen aesthetic per Cooper & Stanley + Russell Society multi-part review (Bridges 2011, Green 2008, Rumsey 2008): thumbnail-to-small-cabinet scale (Caldbeck specimens are characteristically small — vug size_class). Linarite forms deep azure-blue elongate-tabular crystals (the headline Roughten Gill aesthetic, prized by UK collectors as some of the world's best linarites). Caledonite blue-green prismatic to acicular crystals up to 5 mm. Leadhillite pearly-white mica-like tablets. Brochantite emerald-green tufts. Pyromorphite world-class — vivid green hexagonal prisms in multiple colour variants (khaki, brown, lime green, pink, yellow per Cooper & Stanley palette). Mimetite as 'campylite' red barrel-shaped overgrowths on pyromorphite (the upper Roughten Gill / Mexico mine occurrence) + lemon-yellow overgrowths at Barstow's Trench. Mottramite as dark-brown to buff rice-grain microcrystals (Brae Fell Mine satellite within the Roughten Gill complex; minute < 0.1 mm). Native silver as < 0.3 mm plates in quartz-calcite microcavities; tarnishes to acanthite as post-collection growth.

> MINERALS NOT YET IN CATALOG (future add-mineral candidates beyond plumbogummite): hinsdalite + hidalgoite (alunite-supergroup endmembers in the type-mix), beudantite + corkite (Fe analogs), redgillite Cu6(OH)10(SO4)·H2O (Caldbeck type-mineral from Red Gill, Pluth et al. 2005 MinMag 69:973), mattheddleite Pb20(SiO4)6(SO4)6Cl4(OH)8 (Caldbeck-not-uncommon in caledonite-linarite cavities), scotlandite PbSO3 (the sulfite — Caldbeck-significant), tsumebite + arsentsumebite Pb2Cu(PO4)(SO4)(OH) family. A future 'alunite-supergroup family' add-mineral commit would benefit Roughten Gill, Tsumeb, and many global supergene localities simultaneously.

> v107 candidate calibration notes per vugg-tune-scenario: pyromorphite needs P > 2 + Cl > 5 (broth carries P=4 + Cl=25, should fire). Mimetite needs As(V) > 3 + Cl > 2 (broth As=12 with pyrite_oxidation pulse pushing higher). Mottramite needs Cu > 50 + V > 10 + Pb > 40 (broth carries V=12 + event-pulse Cu to 60 — geologically Brae Fell satellite, may fire marginally at seed 42). Native silver requires Ag mobilization (broth Ag=12 representing the 838-ppm-Ag-in-galena reservoir; relies on Ag liberation during pyrite_oxidation pulse). If any miss at seed 42, vugg-tune-scenario follow-up commit is the right pattern.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-27 — 'Roughton Gill Mine, Roughton Gill, Caldbeck, Allerdale, Cumbria, England, UK', mine-grain per the boss's methodology; 68 valid + 1 erroneous (Parahopeite); full transcription incl. mindat's '?' uncertain markers in research/scenarios/roughten_gill/citations-mindat-roughten-gill-2026-07-27.md; commodities Lead + Silver; rock types Gabbro + Gossan). WHAT THE LIST VOTES ON (vs seed-42 v236 sim output, 27 species): (a) LICENSED 21/27 — acanthite, anglesite, aurichalcite, brochantite, caledonite, cerussite, chalcocite, chrysocolla, covellite, galena (+ Ag-bearing var.!), leadhillite, linarite, mottramite, plumbogummite (TL!), pyrite, pyromorphite, rosasite, selenite (Gypsum valid — cross-mine selenite tally 6-YES/2-NO), sphalerite, tennantite ('Tennantite-Tetrahedrite Series' carries mindat's ? marker), tetrahedrite. The SILVER species are legit here (Native Silver + Acanthite + Ag-bearing galena all valid, commodity Silver) — the counter-case to Tri-State's Ag-poor fingerprint; the discrete-Ag over-fire pattern does NOT apply to this locality's acanthite. (b) NOT ON THE LIST — census flags: VANADINITE (×6, 5.4 mm — the BIG one; the v109 tune note already says 'vanadinite wrong for Caldbeck, route V to mottramite' and halved V 12→6, but the suppression under-delivers: vanadinite still outgrows mottramite 5380 vs 615 µm; the sheet corroborates the in-repo intent — a tune/gate follow-up candidate), PARAREALGAR ×6 + ORPIMENT (As at Caldbeck is ARSENATE — mimetite/campylite, olivenite?, carminite? — not sulfide; matches the v228 note's compositional complaint, As-should-ride-the-sulfosalt-sink, rung-4 territory), PROUSTITE ×2 (the 4th instance of the cross-mine discrete-Ag-species pattern — the documented Ag here is native silver + acanthite + lattice Ag, not Ag-sulfosalts), TURQUOISE ×4 (unlisted; the legit P-sink is plumbogummite/pyromorphite), DESCLOIZITE ×4 0-µm dust (the 4d re-deal called it 'the real Caldbeck Cu/Zn fork' — this mine's sheet lists only mottramite; dust-level, watch not act). (c) EXPECTS NO-SHOWS CORROBORATED: chalcopyrite, calcite, mimetite (+ var. Campylite — the barrel-shaped classic), native_silver are all VALID on the sheet — the promises are right, the delivery is the gap (tuning targets, not de-confabulations). (d) documented-unfired depth: azurite, malachite, smithsonite, hemimorphite, cuprite, cinnabar, erythrite, wulfenite, langite, serpierite, susannite?, scotlandite + the alunite-supergroup tail already noted as add-mineral candidates; aragonite + dolomite + baryte gangue. (e) mindat's '?' markers recorded verbatim in the transcription — uncertain entries vote weakly in either direction.
