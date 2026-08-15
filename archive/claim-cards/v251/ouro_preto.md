# CLAIM CARD — ouro_preto  (v251, seed 42, 260 steps)

**Anchor:** Ouro Preto Imperial Topaz veins, Minas Gerais, Brazil (Variant B per Morteani et al. 2002).
**Deposit:** Hydrothermal topaz vein in Precambrian phyllite + quartzite. Single clean cooling curve from 360°C to 50°C — the 'anti-flash-quench' of the gem-pegmatite scenarios. F-pulse gates topaz nucleation; Cr leach commits the imperial color.
**Initial:** 360 °C, 3.5 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** fce77488d63ccb9a163d2c41e90299273aae1d590bbbe5b99d8404ed055d5acd

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** topaz, quartz
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Morteani et al. 2002 — fluid inclusion microthermometry of Ouro Preto Imperial Topaz veins

## Paragenetic order as grown (7 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 2 | 0 | nucleation |
| 2 | feldspar | 1 | 2 | 0 | nucleation |
| 3 | topaz | 35 | 6 | 0 | nucleation |
| 4 | quartz | 83 | 6 | 0 | nucleation |
| 5 | goethite | 200 | 1 | 0 | nucleation |
| 6 | opal | 200 | 9 | 0 | nucleation |
| 7 | lepidocrocite | 240 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite, feldspar, goethite, opal, lepidocrocite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 357.283 → 144.685 °C  [38.386, 377.953]
  - pH: 6.504 → 6.504   [5.567, 6.614]
  - Eh: 44.094 → 303.543 mV  [44.094, 303.937]
  - salinity: 3.15 → 3.15 psu  [3.15, 3.15]
  - O2: 0.315 → 1.614 mg/L  [0.315, 1.614]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.78 → -2.016  [-5.039, -1.575]
  - SI_aragonite: -3.906 → -2.142  [-5.102, -1.701]
  - SI_dolomite: -6.866 → -4.031  [-8, -3.591]
  - SI_HMC: -5.48 → -3.717  [-6.677, -3.213]
  - SI_siderite: -1.512 → 0.945  [-2.394, 0.945]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 3.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.206 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 109.45 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 3.5 → 3.5 kbar [3.5, 3.5], n=260
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=260
  - Temperature: 358.2608943547122 → 144.15206551165323 °C [39.00987336887047, 378.5709302670788], n=260
  - Secure aragonite assessment: 33/260 executed steps; first={"boundary_kbar":3.190667169160946,"secure_aragonite":false}, last={"boundary_kbar":2.448756303262089,"secure_aragonite":true}
  - Al2SiO5 executed phase counts: {"unconstrained":260}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Hydrothermal veins cutting Precambrian phyllite and quartzite in the Ouro Preto district. Fluid inclusion data (Morteani et al. 2002) puts crystallization at ~360°C, 3.5 kbar from metamorphic brines derived from devolatilization of phyllite.

> Single clean cooling curve — 360°C → 50°C — the anti-flash-quench of the gem-pegmatite scenarios. No thermal events, no pressure spikes. One exhalation from the granite cooling below.

> The gate: topaz can't nucleate until fluorine accumulates past a saturation threshold. Early quartz grows alone. A mid-scenario metamorphic dehydration event (step 35) pumps F from the phyllite micas into the fluid, and the vein transitions to imperial topaz territory. The imperial color — golden-orange to pink — depends on Cr3+ dissolved out of nearby ultramafic bodies; without chromium the topaz is colorless or pale blue.

> Audit gap-fills (Apr 2026): Na=60, K=40 (phyllite muscovite/albite breakdown per Morteani 2002). Mg=15 (phyllite chlorite/biotite, brief-required non-zero baseline; conservative since host is quartzite + phyllite, not mafic).
