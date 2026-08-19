# CLAIM CARD — tutorial_travertine  (v243, seed 42, 60 steps)

**Anchor:** Mammoth Hot Springs (Yellowstone) — travertine is the canonical CO₂-degas calcite
**Deposit:** Tutorial 3: How CO₂ Builds a Calcite Crust. CO₂-rich groundwater rises into a hot-spring pool, loses CO₂ as gas, and every pH step multiplies calcite's supersaturation until crust plates every available surface. The same mechanism that grows speleothems in caves and travertine terraces at hot springs.
**Initial:** 70 °C, 0.05 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:opal5..100C+quartz100..700C-no-cosmetic-relabel-v1|sulfur-ledger:sulfide+sulfate+elemental-independent+pathway-gated-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 456c278bbceeaf05c67dbaef8d512b8421f753bfdea16aa2ec5221a0f78e6621

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (1):** calcite

**Cited sources:**
  - Mammoth Hot Springs, Yellowstone NP — type locality for actively-forming travertine
  - Pentecost A. (2005), Travertine — comprehensive review of CO₂-degas calcite
  - Stumm & Morgan, Aquatic Chemistry (3rd ed.), Bjerrum partition + Henry's-Law CO₂

## Paragenetic order as grown (2 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | calcite | 0 | 1 |
| 2 | aragonite | 24 | 1 |

**Surprises (grown but NOT in expects_species):** aragonite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 67.913 → 64.961 °C  [47.244, 73.819]
  - pH: 6.504 → 7.331   [6.504, 7.992]
  - Eh: -201.575 → -201.575 mV  [-201.575, -201.575]
  - salinity: 6.299 → 6.299 psu  [6.299, 6.299]
  - O2: 0 → 0 mg/L  [0, 0]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.189 → 0.756  [0.063, 1.575]
  - SI_aragonite: 0.063 → 0.63  [-0.063, 1.449]
  - SI_dolomite: -0.441 → 0.693  [-0.693, 2.205]
  - SI_HMC: -1.26 → -0.693  [-1.26, 0.063]
  - SI_siderite: 0.693 → 1.764  [0.567, 2.016]
  - SI_selenite: -0.945 → -0.882  [-0.945, -0.882]
  - SI_anhydrite: -1.008 → -1.008  [-1.071, -0.945]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.705 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.996 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=60
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=60
  - Temperature: 68.26089435471222 → 63.648194680828595 °C [48.239491288270806, 73.69096292895264], n=60
  - Secure aragonite assessment: 0/60 executed steps; first={"boundary_kbar":2.713987519743353,"secure_aragonite":false}, last={"boundary_kbar":2.739020557213663,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":60}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Tutorial scenario for PROPOSAL-GEOLOGICAL-ACCURACY Phase 3. Showcases the CO₂-degas → pH rise → calcite supersaturates cascade. Player presses Advance through three degassing pulses (steps 10, 25, 40) and watches calcite go from a barely-viable trickle to massive precipitation purely via pH change — no temperature drop, no mineral mixing, no fluid pulse adds Ca.

> REWORKED 2026-07-07 (tutorial-parity pass): legacy 8-beat sim-step script rebuilt in the Grand Tour's engine-v2 vocabulary — continue-step framing on the σ forecast, Begin ⏎ handoff, sim-step beats riding the pulses, then the INVERSE EXPERIMENT: the 🧪 acid verbs unlock and the player runs the cascade backwards, watching σ(calcite) fall (the cave-dissolution lesson for free). Broth + events byte-identical. TEXT RE-TRUED against the observed run: the old script's claims ('Ca 200 ppm', 'calcite isn't growing yet', 'crossed the line at step 20') predate the Ca 200→350 recalibration — measured seed run shows σ(calcite) 1.61 at t0 (one crystal creeping from step ~2) and pulse 1 multiplying σ 1.34→5.04, so the lesson is narrated as barely-viable-trickle → multiplication, which is also the truer Mammoth story (vent water arrives near saturation; degassing drives the plating downstream).

> Initial fluid is high-DIC (CO3 = 500 ppm = ~10 mmol/kg DIC, typical of CO₂-charged hot-spring source water) at moderately acidic pH 6.5 (the pH at which most DIC sits as H₂CO₃* and HCO₃⁻; <0.1% is CO₃²⁻). At the current Ca = 350 ppm calibration, calcite starts MARGINAL (σ ≈ 1.6, a bare trickle of growth) rather than subsaturated — the pre-recalibration 'Ca = 200, stays subsaturated' description was stale; the pulses do the real work either way.

> Each `co2_degas` event removes 30% of the DIC (CO₂ leaves as gas) and raises pH by 0.5 units. The CO₃²⁻ fraction of DIC grows ~10× per pH unit (Bjerrum partition). After three degassing pulses, pH ~ 8 and calcite is wildly supersaturated; players see calcite nucleate and grow steadily through the back half of the run.

> Geological reference: Mammoth Hot Springs (Yellowstone, USA), Pamukkale (Turkey), Pancake Hot Springs (CA). All build travertine via this exact cascade. Cave flowstone uses the same chemistry but with cooler fluid and lower flow.
