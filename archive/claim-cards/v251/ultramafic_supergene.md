# CLAIM CARD — ultramafic_supergene  (v251, seed 42, 200 steps)

**Anchor:** Marlborough chrysoprase deposits, Queensland, Australia — Ni-laterite weathering of Late-Devonian Marlborough Block ophiolitic peridotite. Type aesthetic: apple-green chrysoprase nodules + magnesite veinlets in saprolite over serpentinized harzburgite.
**Deposit:** Tropical-to-temperate Ni-laterite weathering of ultramafic protolith. Olivine + pyroxene break down to serpentine, releasing Ni + Mg + SiO2 to slow alkaline groundwater that percolates through fractures and crystallizes chrysoprase (Ni-bearing chalcedony) as fracture-fill, with magnesite + calcite + chalcedony as the cogenetic gangue suite. The signature green color comes from nano-inclusions of Ni-phyllosilicate (pimelite/willemseite/kerolite) trapped within the chalcedony fabric — a composite color, not a lattice color.
**Initial:** 30 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
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

## Paragenetic order as grown (6 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | dolomite | 1 | 9 | 0 | nucleation |
| 2 | opal | 1 | 5 | 0 | nucleation |
| 3 | chrysoprase | 34 | 3 | 0 | nucleation |
| 4 | goethite | 130 | 2 | 0 | nucleation |
| 5 | calcite | 175 | 4 | 0 | nucleation |
| 6 | HMC | 175 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** dolomite, opal, goethite, HMC
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** quartz
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 29.528 → 23.622 °C  [23.622, 29.528]
  - pH: 8.488 → 9.976   [7.992, 9.976]
  - Eh: 289.764 → 303.937 mV  [289.764, 322.835]
  - salinity: 0.787 → 0.787 psu  [0.787, 0.787]
  - O2: 1.496 → 1.614 mg/L  [1.496, 1.772]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: 0.063 → 1.323  [-0.504, 1.323]
  - SI_aragonite: -0.063 → 1.197  [-0.63, 1.197]
  - SI_dolomite: 1.449 → 4.031  [0.378, 4.031]
  - SI_HMC: -0.819 → 0.441  [-1.386, 0.441]
  - SI_siderite: 2.016 → 3.78  [1.953, 3.78]
  - SI_selenite: -3.15 → -3.276  [-3.591, -3.15]
  - SI_anhydrite: -3.339 → -3.465  [-3.843, -3.339]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.953 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 28.260894354712217 → 25 °C [25, 28.260894354712217], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.965038602582306,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Marlborough chrysoprase deposits (Queensland) — modern world reference for gem-grade chrysoprase. Late Devonian (380-360 Ma) Marlborough Block serpentinite + dunite is the protolith; Cenozoic weathering produced the saprolite + Ni-laterite + chrysoprase chemistry (Sachanbiński et al. 2001 documents the nano-inclusion structure).

> Mechanic: olivine weathering releases Ni²⁺ + Mg²⁺ + Si(OH)₄ to seasonal groundwater. As the wet season ends, evaporation concentrates the brine and silica deposits as fibrous chalcedony in fractures, with Ni nano-inclusions trapped during deposition. The classic Marlborough green chrysoprase hosts ~0.4-4 wt% NiO bulk; the actual Ni is in pimelite/willemseite/kerolite nano-clay particles inside the SiO2 fabric.

> Why Ni=200, Mg=300: ultramafic regolith ground waters carry tens to hundreds of ppm Ni and hundreds of ppm Mg in active weathering profiles (Garnier et al. 2008 Goro Ni-laterite hydrology; Cluzel & Vigier 2008 New Caledonia). 200 / 300 sim-ppm puts both well above chrysoprase's Ni≥50 + Mg≥50 thresholds while staying realistic. SiO2=200 keeps it above chrysoprase's SiO2≥100 gate without forcing macroscopic quartz nucleation.
