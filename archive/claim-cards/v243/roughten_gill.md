# CLAIM CARD — roughten_gill  (v243, seed 42, 200 steps)

**Anchor:** Roughten Gill Mine, Caldbeck Fells, Lake District, Cumbria, England. Polymetallic Pb-Cu fissure-vein deposit in Eycott Volcanic Group + Carrock Fell Intrusive Complex (granophyre footwall + gabbro hangingwall). Worked 1700s-1894 for lead + minor copper, dumps reworked for barite post-1894; classic specimen-collector locality. TYPE LOCALITY for plumbogummite (Hartley 1882; Förtsch 1967 corrected type material to plumbogummite-hinsdalite-hidalgoite mix-crystal). Per Cooper & Stanley (1990) 'Minerals of the English Lake District: Caldbeck Fells' + the Russell Society multi-part review (Bridges et al. 2011 Part 3).
**Deposit:** Pb-Cu fissure-vein in Eycott Volcanic Group volcanics + Carrock Fell Intrusive Complex granophyre/gabbro walls, weathered through an exhaustively-documented supergene oxidation sequence: primary galena+chalcopyrite+sphalerite+pyrite+tetrahedrite/tennantite (T 110-130°C, high-salinity Na-Ca-Cl basinal brine, H2S-buffered) → cooling lockup → pyrite-oxidation AMD acid pulse → linarite stage (Pb+Cu+SO4 with CO3:SO4 << 0.3 producing the iconic Roughten Gill azure-blue cabinet specimens) → caledonite + brochantite transition as CO3 rises → leadhillite cap when CO3:SO4 > 1.5 and Cu depletes. The v100 Pb-Cu sulfate trio (linarite + caledonite + leadhillite) fires in their type-district here — Cooper & Stanley + the Russell Society three-part review document each mineral per-mine in Caldbeck Fells. TYPE LOCALITY for plumbogummite PbAl3(PO4)2(OH)5·H2O (Hartley 1882 from Roughten Gill); plumbogummite is NOT yet wired in the simulator and is flagged as the imminent v108 add-mineral commit to complete the type-locality story. The headline cabinet aesthetic is plumbogummite-after-pyromorphite pseudomorphs — cobalt-blue botryoidal crusts draping green pyromorphite hexagonal prisms — which will only complete once plumbogummite engine ships.
**Initial:** 130 °C, 0.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:opal5..100C+quartz100..700C-no-cosmetic-relabel-v1|sulfur-ledger:sulfide+sulfate+elemental-independent+pathway-gated-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 97034ca14122bb781ec8738f48288cdea9f0ff130073ebab546709aa7f0e4de2

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (17):** galena, sphalerite, chalcopyrite, pyrite, tetrahedrite, tennantite, calcite, cerussite, anglesite, linarite, caledonite, leadhillite, brochantite, pyromorphite, mimetite, mottramite, native_silver

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

## Paragenetic order as grown (26 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | chalcocite | 0 | 1 |
| 2 | galena | 0 | 4 |
| 3 | orpiment | 0 | 1 |
| 4 | proustite | 0 | 2 |
| 5 | pyrite | 0 | 1 |
| 6 | realgar | 0 | 6 |
| 7 | sphalerite | 0 | 1 |
| 8 | tennantite | 0 | 1 |
| 9 | tetrahedrite | 0 | 1 |
| 10 | acanthite | 7 | 4 |
| 11 | anglesite | 69 | 4 |
| 12 | caledonite | 69 | 2 |
| 13 | chrysocolla | 69 | 5 |
| 14 | covellite | 69 | 4 |
| 15 | linarite | 69 | 2 |
| 16 | plumbogummite | 69 | 3 |
| 17 | pyromorphite | 69 | 6 |
| 18 | selenite | 69 | 2 |
| 19 | vanadinite | 69 | 6 |
| 20 | brochantite | 71 | 5 |
| 21 | mottramite | 74 | 4 |
| 22 | turquoise | 90 | 4 |
| 23 | cerussite | 144 | 4 |
| 24 | aurichalcite | 151 | 4 |
| 25 | leadhillite | 174 | 2 |
| 26 | descloizite | 175 | 4 |

**Surprises (grown but NOT in expects_species):** chalcocite, orpiment, proustite, realgar, acanthite, chrysocolla, covellite, plumbogummite, selenite, vanadinite, turquoise, aurichalcite, descloizite
**No-shows (expected but never nucleated):** chalcopyrite, calcite, mimetite, native_silver

## Environment trajectory (first → last, [min,max])
  - T: 126.969 → 23.622 °C  [23.622, 126.969]
  - pH: 5.126 → 7   [5.126, 7]
  - Eh: -149.606 → 200 mV  [-149.606, 251.969]
  - salinity: 7.874 → 3.937 psu  [3.937, 7.874]
  - O2: 0.039 → 0.906 mg/L  [0.039, 1.181]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -4.346 → -0.882  [-4.346, -0.882]
  - SI_aragonite: -4.409 → -1.008  [-4.409, -1.008]
  - SI_dolomite: -8 → -2.268  [-8, -2.268]
  - SI_HMC: -6.047 → -1.953  [-6.047, -1.953]
  - SI_siderite: -2.205 → 0.315  [-3.021, 0.567]
  - SI_selenite: -1.008 → -1.26  [-1.449, -1.008]
  - SI_anhydrite: -0.882 → -1.457  [-1.701, -0.882]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.477 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.995 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 128.2608943547122 → 25 °C [25, 128.2608943547122], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.4814108954849248,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

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
