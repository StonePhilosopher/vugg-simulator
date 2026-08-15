# CLAIM CARD — tutorial_first_crystal  (v241, seed 42, 30 steps)

**Anchor:** (tutorial scaffold — generic silica-rich broth)
**Deposit:** Tutorial 1: The Grand Tour + First Crystal. A guided top-down walk of the whole interface, then grow a quartz and watch what happens when conditions drift out of its growth window.
**Initial:** 180 °C, 1 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:mmol-formula-to-mgkg+proportional-poolcap+trace-ledger-v5|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:physical-timescale+mass-weighted-budget-v2|diagnosis:production-nucleator+causal-supersat+route-capacity-v3|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 7be55ede493c3e4b1f9fa14bf7d7619e66ffd33468fc6e430808c91f4c8f374f

**expects_species (1):** quartz

**Cited sources:**
  - (tutorial scaffold — no published source)

## Paragenetic order as grown (2 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | quartz | 0 | 3 |
| 2 | opal | 8 | 5 |

**Surprises (grown but NOT in expects_species):** opal
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 177.165 → 85.63 °C  [76.772, 177.165]
  - pH: 6.504 → 6.559   [6.228, 6.559]
  - Eh: -201.575 → -201.575 mV  [-201.575, -201.575]
  - salinity: 4.724 → 4.724 psu  [4.724, 4.724]
  - O2: 0 → 0 mg/L  [0, 0]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -1.197 → -0.315  [-1.197, -0.252]
  - SI_aragonite: -1.323 → -0.441  [-1.323, -0.378]
  - SI_dolomite: -2.961 → -1.89  [-2.961, -1.827]
  - SI_HMC: -2.961 → -2.016  [-2.961, -2.016]
  - SI_siderite: 0.315 → 1.008  [0.315, 1.071]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.420 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 72.70 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1 → 1 kbar [1, 1], n=30
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=30
  - Temperature: 178.2608943547122 → 86.47533014202487 °C [77.06000078618524, 178.2608943547122], n=30
  - Secure aragonite assessment: 0/30 executed steps; first={"boundary_kbar":2.4195970419362336,"secure_aragonite":false}, last={"boundary_kbar":2.6251169085117416,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":30}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Tutorial scenario. Designed for the guided first-time-player experience. REWORKED 2026-07-04 (the Grand Tour): the overlay script now opens with a top-down tour of the screen (title, quick-nav, Wall Profile viewers ending on the helicoid manifold, the σ nucleating/dormant readout, action panel, log, inventory) before handing off to the original arc — simple silica-rich broth, quartz nucleates within a few steps at 180°C, then a scripted temperature drop at step 8 pulls T well out of quartz's growth window. The intended player learning is: (1) what every part of the screen is, (2) clicking Advance moves time, (3) crystals need conditions in the right range, (4) when the conditions drift, growth stops.

> Surfaced in the New Game Menu under Tutorials. Not anchored to a real locality — it's a teaching scaffold. Sandbox-testable as a normal scenario (the overlay only engages via startTutorial).

> Broth shape mirrors FLUID_PRESETS.silica (the existing 'Silica-rich' starter fluid) so the lesson generalizes to that picker entry.
