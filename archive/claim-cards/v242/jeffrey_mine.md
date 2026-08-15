# CLAIM CARD — jeffrey_mine  (v242, seed 42, 200 steps)

**Anchor:** Jeffrey Mine, Val-des-Sources (formerly Asbestos), Quebec, Canada. Open-pit chrysotile-asbestos mine 1881-2011; produced ~40% of world chrysotile for most of the 20th century. Town renamed itself in 2020 from Asbestos to Val-des-Sources to step out from under the asbestos-health-crisis baggage. Among mineral collectors NOT famous for asbestos but for the rodingite metasomatic assemblage exposed by the open-pit excavation — Ca-Al-Mg silicate cabinet specimens 1880s through 2011. The world's premier locality for cabinet-grade CYPRINE vesuvianite (Cu-bearing sky-to-deep-blue Cu²⁺-O charge-transfer variety per Bernardini 1981 MR 12(5):277 figs 12-15). Geological context: Thetford Mines ophiolite complex, Quebec Appalachians, obducted ophiolite from the Taconian Orogeny ~470 Ma; host is serpentinized peridotite with cross-cutting mafic dikes that have been metasomatically altered to rodingite.
**Deposit:** Rodingite metasomatic assemblage in the Jeffrey Mine pit. The fluid evolution walks the broth through five stages: (1) Serpentinization onset — olivine + pyroxene hydration releases Mg + Si + Ni + Fe to a hyperalkaline (pH 10.5-11.2), strongly reducing (O2 < 0.1) fluid at T 380→340°C. Chrysotile + brucite + magnetite + awaruite fire as the serpentinization byproducts. (2) Mafic dike alteration begins — the alkaline serpentinizing fluid invades cross-cutting mafic dikes (basalt-to-gabbro composition), releasing Ca + Al + Si from dike plagioclase + clinopyroxene. Trace Cr from chromite enables chrome varieties. Grossular + diopside fire as the high-T garnet + clinopyroxene endmember pair. (3) Mid-rodingite — vesuvianite stage. Trace Cu (1-4 ppm) from background chalcopyrite enables CYPRINE — the world-reference Jeffrey aesthetic per Bernardini 1981. Sky-blue cyprine vesuvianite at 1-5 ppm Cu, deep-azure cyprine > 5 ppm. (4) Late Ca-silicates — Na rises (from late-stage albitization of dike feldspar); pectolite spray-radiating habit on grossular substrate fires. Wollastonite acicular sprays. Prehnite pale-green botryoidal (Fe³⁺ trace). (5) Terminal datolite — trace B (from late hydrothermal fluid concentration) drives datolite gemmy_vitreous_terminated on prehnite/wollastonite substrate. Final-stage cabinet aesthetic; colorless to pale-yellow gemmy datolite crystals. The KEY DISCRIMINATOR vs. all other scenarios is the hyperalkaline pH (10-12) — rodingite is the alkaline outlier in the simulator's catalog (most other scenarios run pH 4-8).
**Initial:** 380 °C, 1.5 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 2f00e1b698c1bcb201f873a7e0d8d0b8caed48a4667704b32bb46f23d14edccc

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (12):** chrysotile, brucite, magnetite, awaruite, grossular, diopside, vesuvianite, pectolite, wollastonite, prehnite, datolite, calcite

**Cited sources:**
  - Bernardini G.P. (1981) — The Jeffrey Mine, Asbestos, Quebec. Mineralogical Record 12(5): 277-291. THE canonical Jeffrey paper; per-mineral descriptions + habit + paragenesis + cyprine vesuvianite figs 12-15 world-reference material.
  - Hudson R.G.S. (1922) — The geology of the Chrysotile-bearing serpentine of southern Quebec. Geological Survey of Canada. Early reference for the Thetford Mines ophiolite framework.
  - Coleman R.G. (1977) — Ophiolites: Ancient Oceanic Lithosphere? Springer-Verlag. Global rodingite framework + serpentine mineralogy. The textbook for ophiolite-hosted rodingite paragenesis.
  - Wares R. (1987) — PhD thesis (Univ. Sherbrooke or McGill), detailed Thetford Mines complex geology. Field-mapped petrography of the host serpentinite + dike contacts.
  - Wicks F.J. & Plant A.G. (1979) — Electron-microprobe and transmission-electron-microscope study of serpentine textures. Canadian Mineralogist 17: 785-830. Serpentinite-host chemistry + chrysotile/lizardite/antigorite discrimination.
  - O'Hanley D.S. (1996) — Serpentinites: Records of Tectonic and Petrological History. Oxford University Press. Rodingite + serpentinization framework.
  - Manning C.E. & Bird D.K. (1990) — Hydrothermal clinopyroxenes from rodingites. Journal of Petrology 31: 1-37. Rodingite-clinopyroxene canonical for diopside + augite endmember stability.
  - Bird D.K. & Bassett W.A. (1980) — Fluid inclusion and thermodynamic study of an active geothermal system. Geochim. Cosmochim. Acta 44: 1659. Fe-Ni alloy stability in serpentinite — anchors awaruite gates.
  - Frost B.R. (1985) — On the stability of sulfides, oxides and native metals in serpentinite. Contributions to Mineralogy and Petrology 91: 139-153. Sulfur + oxygen fugacity controls — the framework for the awaruite low-S strict gate.
  - Hawthorne F.C., Burns P.C., Grice J.D. (1996) — The crystal chemistry of boron. Reviews in Mineralogy 33: 41-115. Boron-mineral chemistry framework — datolite + tourmaline lattice partitioning.
  - Allen F.M. & Burnham C.W. (1992) — Vesuvianite structure-model + symmetry variations. American Mineralogist 77: 268-285. Vesuvianite crystal chemistry.
  - Groat L.A., Hawthorne F.C., Ercit T.S. (1992) — The chemistry of vesuvianite. Canadian Mineralogist 30: 19-48.
  - Filipos P.J. & Frantz J.D. (1979) — Larimar: A blue pectolite from Hispaniola. Geological Magazine 116: 323. Cu-bearing pectolite color framework; applies to potential Jeffrey blue-pectolite micro-occurrences though canonical Jeffrey pectolite is white.
  - Liou J.G. (1971) — Synthesis and stability relations of prehnite. American Mineralogist 56: 507-531. DEFINITIVE prehnite stability + zeolite-facies parageneses.
  - Krenn K. & Hauzenberger C.A. (2007) — Tonga ophiolite Fe-Ni alloy thermometry. Awaruite stability framework.
  - Research dossier 2026-05-20 — internal Jeffrey research compilation anchoring scenario broth on Bernardini 1981 + Coleman 1977 + Wicks & Plant 1979 + Manning & Bird 1990.

## Paragenetic order as grown (17 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | awaruite | 0 | 3 |
| 2 | calcite | 0 | 1 |
| 3 | diopside | 0 | 4 |
| 4 | dolomite | 0 | 1 |
| 5 | vesuvianite | 0 | 4 |
| 6 | actinolite | 24 | 4 |
| 7 | brucite | 24 | 1 |
| 8 | chrysotile | 24 | 1 |
| 9 | grossular | 24 | 4 |
| 10 | prehnite | 40 | 4 |
| 11 | wollastonite | 49 | 1 |
| 12 | albite | 139 | 2 |
| 13 | siderite | 139 | 1 |
| 14 | pectolite | 143 | 1 |
| 15 | rhodochrosite | 163 | 1 |
| 16 | datolite | 169 | 3 |
| 17 | titanite | 169 | 1 |

**Surprises (grown but NOT in expects_species):** dolomite, actinolite, albite, siderite, rhodochrosite, titanite
**No-shows (expected but never nucleated):** magnetite

## Environment trajectory (first → last, [min,max])
  - T: 377.953 → 327.756 °C  [224.409, 377.953]
  - pH: 9.976 → 7.772   [7.772, 10.693]
  - Eh: -74.016 → -149.606 mV  [-149.606, -74.016]
  - salinity: 1.575 → 1.575 psu  [1.575, 1.575]
  - O2: 0.118 → 0.039 mg/L  [0.039, 0.118]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 1.008 → -1.58  [-1.583, 1.449]
  - SI_aragonite: 0.882 → -1.701  [-1.701, 1.383]
  - SI_dolomite: 2.961 → -2.084  [-2.087, 4.092]
  - SI_HMC: -0.63 → -3.213  [-3.215, -0.129]
  - SI_siderite: 3.276 → 1.008  [1.008, 3.843]
  - SI_selenite: -2.583 → -2.961  [-2.961, -2.583]
  - SI_anhydrite: -2.205 → -2.583  [-2.709, -2.205]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.389 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 80.05 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1.5 → 1.5 kbar [1.5, 1.5], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 378.2608943547122 → 328.5912570780607 °C [224.02898204182262, 378.2608943547122], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":3.37234162774147,"secure_aragonite":false}, last={"boundary_kbar":2.9565247276550037,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Jeffrey Mine, Val-des-Sources (45.7686°N 71.9347°W), Quebec, Canada. Open-pit chrysotile-asbestos mine 1881-2011. The pit-side ROAD CUT exposures are the canonical Jeffrey cabinet-specimen source — chrysotile-asbestos veins crisscrossed by mafic dikes, with rodingite-altered contact zones in the dike margins. The town renamed itself Val-des-Sources ('Valley of Springs') in 2020 from its original 'Asbestos' name. The 1949 Quebec Asbestos Strike is a labor-history flashpoint — a 4-month strike at Asbestos QC that was a watershed moment in modern Quebec political history. These cultural-historical facts are real but the scenario encodes the GEOLOGY — the rodingite assemblage is the cabinet-collector story.

> Type-quality CABINET CYPRINE: Jeffrey is the world's premier locality for cyprine vesuvianite (Cu-bearing sky-blue to deep-azure variety; Cu²⁺-O charge transfer at trace Cu levels 0.5-5 ppm). Bernardini 1981 MR 12(5):277 figs 12-15 document the cyprine aesthetic; the world-reference best material. Cyprine is technically type-Norway 1820 (Sjøåsen, Telemark) but Jeffrey is the cabinet standard. The scenario adds Cu to 4 ppm in the mid-rodingite stage event (stage 3) to drive cyprine dispatch in the vesuvianite grow engine.

> Engine fit: this scenario fires the COMPLETE rodingite assemblage shipped v110-v114 — chrysotile (v114 host matrix), brucite (v114), awaruite (v114, microscopic Ni-Fe alloy grains in serpentine matrix), grossular (v112) with chromian green via Cr trace, diopside (v112) with chrome-diopside via Cr trace, vesuvianite (v111) with CYPRINE via Cu trace, pectolite (v113, spray-radiating on grossular), wollastonite (v113), prehnite (v113, pale-green via Fe trace), datolite (v110, gemmy on prehnite/wollastonite substrate). Five-stage event sequence walks the chemistry through the prograde paragenesis. The forward-prepared substrate slots from v110-v112 (datolite-on-prehnite, vesuvianite-on-grossular, etc.) now activate as the minerals co-occur.

> New 'ultramafic' wall composition (v115): broader than 'serpentinite' specifically; covers serpentinite + peridotite + dunite + harzburgite hosts. Future scenarios at Cassiar BC + New Idria CA + Italian Alps Val Malenco can reuse. Wall is silicate-inert (no acid dissolution), tabular architecture (rodingite alteration contacts are tabular zones between dike and host), size_class pocket (cabinet-scale specimens). reactivity=0.0 keeps the wall inert. shape_seed 1881 (Jeffrey opening year).

> Initial broth at step 0: T 380°C (high-T rodingite metasomatism), pH 10.0 (hyperalkaline serpentinization), O2 0.1 (strongly reducing), salinity 1.5 (low-salinity metamorphic fluid per Manning & Bird 1990), pressure 1.5 kbar (mid-crustal ophiolite). Mg 220 (serpentinization-derived Mg-rich), SiO2 200 (silica framework), Ca 350 (rodingite Ca-rich), Al 30 (dike Al), Ni 120 (peridotite-derived), Fe 50 (peridotite + chromite), Cr 1.0 (trace chromite-derived), Cu 1.0 (trace dike-chalcopyrite-derived), B 0.5 (minimal initial; surges in stage 5), Na 5 (minimal initial; surges in stage 4), S 1 (very low — strict requirement for awaruite gate), CO3 5 (very low — strict requirement for brucite gate). The discriminator from all other scenarios is the COMBINATION of hyperalkaline pH + low S + low CO3 + high Mg+Si+Ca — rodingite chemistry is genuinely novel.

> Specimen aesthetic per Bernardini 1981 + Cabinet-grade Jeffrey collection records: cabinet-scale specimens (size_class pocket, 25-300mm), often matrix specimens with multiple species. Chrysotile fibers as silvery-white parallel-bundle veining (the asbestos host matrix). Cyprine vesuvianite as sky-blue to deep-azure tetragonal prismatic crystals — the world-reference Jeffrey aesthetic. Grossular as orange-pink hessonite or chromian green dodecahedra. Chrome-diopside as gem-grade emerald-green prismatic crystals. Pectolite as snow-white radiating sprays (the cabbage-petal aesthetic). Wollastonite as acicular white needle bundles. Prehnite as pale-green botryoidal aggregates. Datolite as colorless to pale-yellow gemmy monoclinic crystals — final-stage cabinet aesthetic.

> MINERALS NOT YET IN CATALOG that would extend the Jeffrey paragenesis: titanian-clinohumite (Ti-substituted humite-group sorosilicate; rare-but-documented at Jeffrey), perovskite (CaTiO3 — common in rodingite-syenite alteration), zoisite + epidote group (Ca-Al-Fe³⁺ sorosilicates, would benefit Jeffrey + many other rodingites globally), antigorite + lizardite (the other two serpentine polytypes besides chrysotile). Future add-mineral candidates beyond this arc.

> v116 candidate calibration notes per vugg-tune-scenario: this scenario is designed to fire the rodingite suite shipped v110-v114, but cation-budget routing may displace some firings or produce cascade extras. Expected possible misses: pectolite (Na may consume too fast or stay too low); datolite (B trace may concentrate too late in step sequence); awaruite (the STRICT O2<0.3 + S<5 + pH>=9 + Ni>=50 gate could fail to clear at seed 42). Expected possible cascade extras: tourmaline (B>=6 + Al>=8 + Na>=3 + SiO2>=60 at T 350-700 — overlaps with rodingite chemistry; if tourmaline fires in stage 5 when B + Na are both elevated, that's a geological surprise). vugg-tune-scenario v116 will run the probe-diagnose-adjust-verify loop on the actual seed-42 result.
