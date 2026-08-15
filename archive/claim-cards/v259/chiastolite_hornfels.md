# CLAIM CARD — chiastolite_hornfels  (v259, seed 42, 120 steps)

**Anchor:** Bimbowrie / Mount Howden, Olary district, South Australia — classic chiastolite (the 'cross stone') in contact-metamorphic hornfels; the Zhoukoudian aureole (Beijing) of Mason et al. 2010 is the peer-reviewed analogue.
**Deposit:** Low-pressure CONTACT-METAMORPHIC hornfels — a graphitic aluminous metapelite baked in the aureole of a shallow intrusion. Andalusite (Al₂SiO₅) porphyroblasts grow with quartz; because the metapelite carries reduced organic carbon, the andalusite grows as CHIASTOLITE — carbonaceous matter swept into the corner growth sectors → the dark cross.
**Initial:** 600 °C, 2.5 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|cation-sinks:accepted-shell-return-only+schneeberg-zero-Zn-all-step-finite-voxel-receipt+pharmacolite-dissolved-molar-cation-proxy+48-field-consumer-audit-v2|koettigite:Ciesielczuk20-pH<3+dissolved-molar-Zn-majority-proxy+Co-solid-solution+Hill79-Ni<=5molpct+Bowell14-Tsumeb-third-zone-only-v3|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 4af4c17ea9991b5d736b1706aa1ccdc465296a3e2f8b195dcfd0a41632838f37

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** andalusite, feldspar
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Mason, Burton, Yuan & She 2010 (Gondwana Research 18(1):222-229) — Chiastolite: quartz+graphite co-precipitation into andalusite growth sectors, graphite-buffered H₂O–CO₂ fluid (Zhoukoudian aureole)
  - Dowty 1976 (American Mineralogist 61:460-469) — Crystal structure and crystal growth II: sector zoning in minerals (the protosite model)
  - Holdaway 1971 (American Journal of Science 271:97-131) — Stability of andalusite and the aluminum silicate phase diagram (the Al₂SiO₅ triple point)

## Paragenetic order as grown (3 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 1 | 0 | nucleation |
| 2 | andalusite | 1 | 5 | 0 | nucleation |
| 3 | feldspar | 1 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 598.2608943547071 → 421.07062416407626 °C  [421.07062416407626, 598.2608943547071] (raw_simulation_state)
  - pH: 6.5 → 6.5   [6.5, 6.5] (raw_simulation_state)
  - Eh: -150.10299956639813 → -150.10299956639813 mV  [-150.10299956639813, -150.10299956639813] (raw_simulation_state)
  - salinity: 1 → 1 psu  [1, 1] (raw_simulation_state)
  - O2: 0.05 → 0.05 mg/L  [0.05, 0.05] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -3.969 → -3.969  [-3.969, -3.969]
  - SI_aragonite: -4.094 → -4.094  [-4.094, -4.094]
  - SI_dolomite: -6.677 → -6.677  [-6.677, -6.677]
  - SI_HMC: -3.717 → -3.78  [-3.78, -3.717]
  - SI_siderite: -1.071 → -1.071  [-1.071, -1.071]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 2.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: 2.5 kbar — rock/confining pressure used by metamorphic phase fields
  - Calcite/aragonite boundary: 6.673 kbar; secure aragonite=false
  - Al2SiO5: andalusite (nominal andalusite) — Ky-Sil line; uncertainty propagates Pattison triple-point T and P bounds.
  - Gypsum/anhydrite pure-water boundary: 94.75 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
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
  - Fluid pressure: 2.5 → 2.5 kbar [2.5, 2.5], n=120
  - Rock/confining pressure: 2.5 → 2.5 kbar [2.5, 2.5], n=120
  - Temperature: 598.2608943547071 → 421.07062416407626 °C [421.07062416407626, 598.2608943547071], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":6.637960672127128,"secure_aragonite":false}, last={"boundary_kbar":3.82574617349712,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":102,"uncertain":18}; first=andalusite, last=uncertain
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: chiastolite is the variety of andalusite with a sector-zoned carbonaceous cross. South Australian (Bimbowrie/Mt Howden) hornfels is the classic collector locality; Mason, Burton, Yuan & She (2010, Gondwana Research 18(1):222-229) is the peer-reviewed mechanism study (Zhoukoudian aureole, Beijing): quartz + graphite inclusions co-precipitate into the andalusite growth sectors from an internally graphite-buffered H₂O–CO₂ fluid.

> Chemistry signature: PERALUMINOUS and SILICA-SATURATED (the opposite of marble_contact's SiO2-undersaturated corundum field). Al high + SiO2 high → Al₂SiO₅ (andalusite), NOT corundum. Alkalis (Na, K) and B are kept LOW — in a pegmatite Al would be locked into feldspar/tourmaline/mica, so andalusite is diagnostic of an alkali-poor metasediment. That alkali/B gate is also what keeps andalusite out of every other scenario.

> wall.graphitic:true — the host is a carbonaceous metapelite. grow_andalusite + classifySectorZoning read this flag to render the CHIASTOLITE carbon cross (a transverse 4-corner sector mask, js/99i _makeChiastolitePrism). Without it, andalusite renders as a plain square prism.

> Thermal regime: contact-metamorphic peak ~600°C cooling gently through the andalusite stability window (400-700°C, below the Holdaway 1971 Al₂SiO₅ triple point ~500°C/0.4 GPa at low P). thermal_pulses:false — one intrusive episode, no magmatic fracture-valve reheats (PEGMATITE-SHAPE, the marble_contact idiom).

> Wall composition 'pegmatite' is the inert aluminous-silicate proxy (the sim branches dissolution only on limestone/dolomite); a true metapelite host is not modeled, this is the closest aluminous silicate flavor.

> O2 low / pH near-neutral — graphite-buffered reducing fluid (Mason et al. 2010).
