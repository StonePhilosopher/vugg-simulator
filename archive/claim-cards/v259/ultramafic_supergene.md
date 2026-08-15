# CLAIM CARD — ultramafic_supergene  (v259, seed 42, 200 steps)

**Anchor:** Marlborough chrysoprase deposits, Queensland, Australia — Ni-laterite weathering of Late-Devonian Marlborough Block ophiolitic peridotite. Type aesthetic: apple-green chrysoprase nodules + magnesite veinlets in saprolite over serpentinized harzburgite.
**Deposit:** Tropical-to-temperate Ni-laterite weathering of ultramafic protolith. Olivine + pyroxene break down to serpentine, releasing Ni + Mg + SiO2 to slow alkaline groundwater that percolates through fractures and crystallizes chrysoprase (Ni-bearing chalcedony) as fracture-fill, with magnesite + calcite + chalcedony as the cogenetic gangue suite. The signature green color comes from nano-inclusions of Ni-phyllosilicate (pimelite/willemseite/kerolite) trapped within the chalcedony fabric — a composite color, not a lattice color.
**Initial:** 30 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|cation-sinks:accepted-shell-return-only+schneeberg-zero-Zn-all-step-finite-voxel-receipt+pharmacolite-dissolved-molar-cation-proxy+48-field-consumer-audit-v2|koettigite:Ciesielczuk20-pH<3+dissolved-molar-Zn-majority-proxy+Co-solid-solution+Hill79-Ni<=5molpct+Bowell14-Tsumeb-third-zone-only-v3|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 483aac8bc86c6136c9df323f2b7b136aaebc771fef44e042183b26bbf856a96f

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** chrysoprase, calcite
**Statistical (0):** (none)
**Aspirational (1):** quartz — The authored silica inventory is intentionally sufficient for chalcedony-family chrysoprase but does not guarantee macroscopic quartz nucleation.
**Locality exclusions (0):** (none)

**Cited sources:**
  - Sachanbiński et al. 2001 — chrysoprase nano-inclusion structure (Ni-clay in chalcedony)
  - Witkowski 2007 — chrysoprase color-cause confirmation
  - Garnier et al. 2008 — Goro Ni-laterite hydrology + supergene Ni mobility
  - Cluzel & Vigier 2008 — New Caledonia ultramafic weathering geochemistry
  - Marlborough Mine Queensland production records — modern Ni-rich chrysoprase reference

## Paragenetic order as grown (5 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | dolomite | 1 | 9 | 0 | nucleation |
| 2 | opal | 1 | 5 | 0 | nucleation |
| 3 | chrysoprase | 34 | 3 | 0 | nucleation |
| 4 | goethite | 130 | 1 | 0 | nucleation |
| 5 | calcite | 175 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** dolomite, opal, goethite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** quartz
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 28.26089435471217 → 24.999999999999932 °C  [24.999999999999932, 28.26089435471217] (raw_simulation_state)
  - pH: 8.5 → 10   [8, 10] (raw_simulation_state)
  - Eh: 290.4365036222725 → 322.1090020413224 mV  [290.4365036222725, 322.1090020413224] (raw_simulation_state)
  - salinity: 1 → 1 psu  [1, 1] (raw_simulation_state)
  - O2: 1.5 → 1.8 mg/L  [1.5, 1.8] (raw_simulation_state)
  - concentration: 1 → 3 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0 → 1.323  [-0.567, 1.323]
  - SI_aragonite: -0.126 → 1.134  [-0.693, 1.134]
  - SI_dolomite: 1.386 → 3.969  [0.252, 3.969]
  - SI_HMC: 0.126 → 1.449  [-0.441, 1.449]
  - SI_siderite: 2.016 → 3.717  [1.89, 3.717]
  - SI_selenite: -3.15 → -3.15  [-3.15, -3.15]
  - SI_anhydrite: -3.402 → -3.402  [-3.402, -3.402]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.953 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.051663568; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.052 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.049352445999999994; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.049 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.09844805400000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.098 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.049006784000000005; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.049 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.046064535999999996; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.046 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.042969956; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.043 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.043324124; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.043 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.042665438; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.043 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 28.26089435471217 → 24.999999999999932 °C [24.999999999999932, 28.26089435471217], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.965038602582306,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000008,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Marlborough chrysoprase deposits (Queensland) — modern world reference for gem-grade chrysoprase. Late Devonian (380-360 Ma) Marlborough Block serpentinite + dunite is the protolith; Cenozoic weathering produced the saprolite + Ni-laterite + chrysoprase chemistry (Sachanbiński et al. 2001 documents the nano-inclusion structure).

> Mechanic: olivine weathering releases Ni²⁺ + Mg²⁺ + Si(OH)₄ to seasonal groundwater. As the wet season ends, evaporation concentrates the brine and silica deposits as fibrous chalcedony in fractures, with Ni nano-inclusions trapped during deposition. The classic Marlborough green chrysoprase hosts ~0.4-4 wt% NiO bulk; the actual Ni is in pimelite/willemseite/kerolite nano-clay particles inside the SiO2 fabric.

> Why Ni=200, Mg=300: ultramafic regolith ground waters carry tens to hundreds of ppm Ni and hundreds of ppm Mg in active weathering profiles (Garnier et al. 2008 Goro Ni-laterite hydrology; Cluzel & Vigier 2008 New Caledonia). 200 / 300 sim-ppm puts both well above chrysoprase's Ni≥50 + Mg≥50 thresholds while staying realistic. SiO2=200 keeps it above chrysoprase's SiO2≥100 gate without forcing macroscopic quartz nucleation.
