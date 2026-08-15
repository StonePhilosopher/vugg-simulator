# CLAIM CARD — tutorial_mn_calcite  (v251, seed 42, 30 steps)

**Anchor:** (tutorial scaffold — generic carbonate broth)
**Deposit:** Tutorial 2: A Mn-Doped Calcite. Grow a calcite, then mix in manganese and watch the next zones glow orange-red under UV. Iron quenches; the boundary records the broth-history.
**Initial:** 100 °C, 0.5 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 4d907c8a28feb90ea854da4ae7aee2819e6e5aefd320e889f517a190d9583ac6

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** calcite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - (tutorial scaffold — no published source)
  - Franklin / Sterling Hill (NJ) — type locality for Mn-activated calcite fluorescence

## Paragenetic order as grown (4 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | quartz | 1 | 1 | 0 | nucleation |
| 3 | rhodochrosite | 1 | 1 | 0 | nucleation |
| 4 | siderite | 1 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** quartz, rhodochrosite, siderite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 97.441 → 73.819 °C  [73.819, 97.441]
  - pH: 7 → 6.559   [6.559, 7]
  - Eh: -201.575 → -201.575 mV  [-201.575, -201.575]
  - salinity: 7.874 → 7.874 psu  [7.874, 7.874]
  - O2: 0 → 0 mg/L  [0, 0]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.819 → 0.063  [0.063, 0.819]
  - SI_aragonite: 0.693 → -0.063  [-0.063, 0.756]
  - SI_dolomite: 0.252 → -1.071  [-1.071, 0.252]
  - SI_HMC: -0.945 → -1.449  [-1.512, -0.882]
  - SI_siderite: 2.457 → 1.008  [1.008, 2.457]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.569 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.995 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=30
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=30
  - Temperature: 98.26089435471222 → 74.0820430744905 °C [74.0820430744905, 98.26089435471222], n=30
  - Secure aragonite assessment: 0/30 executed steps; first={"boundary_kbar":2.5760992076141394,"secure_aragonite":false}, last={"boundary_kbar":2.683853938815694,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":30}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Tutorial scenario. Teaches how additives change a growing crystal's properties: Mn²⁺ activates orange fluorescence in calcite (threshold 2 ppm) and Fe²⁺ quenches it. The carbonate broth ships with Fe:10 already at the quencher range and Mn:8 just past the activator threshold — early calcite zones incorporate Mn but stay dim under UV. The Mn pulse at step 8 pushes Mn well past the activator threshold; the Fe drop at step 16 clears the quencher. The boundary between dim early zones and bright late zones records the moment the broth changed.

> REWORKED 2026-07-07 (tutorial-parity pass): legacy 7-beat sim-step script rebuilt in the Grand Tour's engine-v2 vocabulary — continue-step framing, a Begin ⏎ handoff with progressive unlock, and an action-step payoff: the player taps their calcite card and reads the dim-vs-bright stratigraphy off the zone modal's 'Under UV' fluorescence bar instead of being told about it. Broth + events byte-identical to the original.

> Surfaced in the New Game Menu under Tutorials. Not anchored to a real locality — it's a teaching scaffold. The Franklin/Sterling Hill (NJ) Mn-activated calcite glow is the real-world reference for the lesson.

> Broth shape mirrors FLUID_PRESETS.carbonate so the lesson generalizes to that picker entry.
