# CLAIM CARD — wittichen  (v242, seed 42, 160 steps)

**Anchor:** Kloster Wittichen, Schwarzwald (Black Forest), Baden-Württemberg, Germany — the classic Bi-Co-Ni-Ag-As-(Ba) five-element vein district; cobalt-pigment + silver mining boom 1730s–40s around the convent. Sophia and Johann-Georg veins.
**Deposit:** A five-element vein in granite basement: hot, saline, SULFUR-STARVED brine carries Bi + Co + Ni + Ag + As. S ~3 ppm is load-bearing — bismuthinite and acanthite never gate open, so the metals stay NATIVE and arsenides are the metal sinks. Hot stage grows skutterudite + nickeline rosettes (320–420°C); cooling brings the fluid into bismuth's window; then the deposit-defining REDUCING SHOCK (hydrocarbon influx along the fault — the declared fluid.Eh pulse) slams native-metal σ to its structural ceiling and bismuth precipitates as ARBORESCENT DENDRITES, safflorite riming the fresh branches (its T window overlaps the shock). Late meteoric water brings oxidized sulfate (barite stage) and carbonate gangue seals the dendrites into the vein — the cross-section hand specimen of the class.
**Initial:** 340 °C, 0.9 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 9e8801be38edae5a68b9dcd3f6595287b87c7a064a9f50bd90542a858a6c9d31

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (10):** skutterudite, nickeline, safflorite, native_bismuth, native_arsenic, native_silver, proustite, acanthite, calcite, barite

**Cited sources:**
  - Kissin S.A. 1992, Canadian Mineralogist 30 — Five-element (Ni-Co-As-Ag-Bi) veins: the deposit-class review
  - Burisch M., Walter B.F., Gerdes A., Lanz M., Markl G. 2017, Geology 45 — Methane and the origin of five-element veins (the hydrocarbon reduction trigger)
  - Scharrer M., Kreissl S., Markl G. 2019, Ore Geology Reviews — The mineralogical variability of hydrothermal native element-arsenide associations
  - Staude S., Bons P.D., Markl G. 2012, Mineralium Deposita 47 — Schwarzwald hydrothermal veins: fluid inclusion record, 20-26 wt% NaCl basement brines
  - Markl G. et al. 2016 — Cobalt (Ontario) arsenide zoning, X_As 0.96-0.99 (the skutterudite engine's anchor citation)
  - Kloster Wittichen district history — cobalt-blue pigment + silver boom, 1730s-1740s (shape_seed 1736)

## Paragenetic order as grown (11 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | skutterudite | 0 | 2 |
| 2 | nickeline | 3 | 4 |
| 3 | native_arsenic | 4 | 4 |
| 4 | safflorite | 32 | 2 |
| 5 | native_silver | 70 | 4 |
| 6 | native_bismuth | 73 | 3 |
| 7 | proustite | 133 | 2 |
| 8 | realgar | 133 | 1 |
| 9 | acanthite | 140 | 4 |
| 10 | barite | 140 | 3 |
| 11 | calcite | 141 | 1 |

**Surprises (grown but NOT in expects_species):** realgar
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 339.567 → 147.638 °C  [147.638, 339.567]
  - pH: 6.283 → 7.386   [6.283, 7.386]
  - Eh: -22.047 → 77.165 mV  [-281.89, 77.165]
  - salinity: 23.622 → 23.622 psu  [23.622, 23.622]
  - O2: 0.157 → 0.394 mg/L  [0, 0.394]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.339 → 0.756  [-3.339, 0.756]
  - SI_aragonite: -3.402 → 0.63  [-3.402, 0.63]
  - SI_dolomite: -6.551 → 0.693  [-6.551, 0.693]
  - SI_HMC: -5.039 → -1.008  [-5.039, -1.008]
  - SI_siderite: -1.575 → 1.764  [-1.575, 1.764]
  - SI_selenite: -2.268 → -1.134  [-2.268, -1.134]
  - SI_anhydrite: -1.827 → -0.945  [-2.079, -0.945]
  - SI_barite: -0.315 → 1.638  [-0.315, 1.638]
  - SI_celestine: -1.953 → -1.197  [-2.079, -1.134]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.9 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.042 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 71.23 °C; initial a_w=0.987 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.9 → 0.9 kbar [0.9, 0.9], n=160
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=160
  - Temperature: 339.9778271484375 → 148.28306720627472 °C [148.28306720627472, 339.9778271484375], n=160
  - Secure aragonite assessment: 0/160 executed steps; first={"boundary_kbar":3.0413872177406542,"secure_aragonite":false}, last={"boundary_kbar":2.4422526325923366,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":160}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor + mechanism: Kissin 1992 (Canadian Mineralogist 30) defines the five-element class; Burisch et al. 2017 (Geology 45) ties the native-metal stage to methane/hydrocarbon influx — fluid inclusions in Schwarzwald five-element veins carry CH4 exactly at the dendrite stage, and the reduction is fast (hours-to-days), which is WHY the metals dendrite. Scharrer, Kreissl & Markl 2019 (Ore Geology Reviews) survey the assemblage diversity; Staude et al. 2012 (Mineralium Deposita 47) give the Schwarzwald basement-brine fluid-inclusion record (20–26 wt% NaCl, 150–340°C) this broth is anchored on.

> The redox shock is a DECLARED fluid.Eh movement (event-subsumption discipline, v185/v186): base −20 mV (mildly reducing basement brine), ONE deep pulse (amp −320) at u=0.58 (the CH4 influx; width ~8 steps; measured floor ~−253 mV at seed 42), and a late oxidizing trend (+95 ease — meteoric tail, tuned DOWN from +140 which dissolved the arsenide suite; a stronger late-oxidation finger was tried and reverted for the same reason — barite/erythrite are the documented aspirational casualties of arsenide survival). The wittichen_hydrocarbon_influx event at the pulse center is NARRATIVE-ONLY (no fluid writes).

> Engine fit: this is the morphology registry's dendrite-band tenant (MORPH_TH.native_bismuth, SIM 188 — RESEARCH-bismuth-morphology-2026-06-12.md). At the shock, Bi σ ≈ bi_f 3.0 × s_mask 0.96 × red_f 1.5 × T_f 1.0 ≈ 4.3 — the dendritic band (≥3.8) of a scale structurally capped at ~4.5. Pre-shock cooling-stage Bi sits in the feathery bands; post-shock regrowth heals feathery over the dendrites, so the zone stack RECORDS the shock (the narrator's healed-over paragraph + the bismuth_morph strip chip slamming 0→4 on the pulse). Skutterudite + safflorite get their FIRST scenario home here (both were expects-orphans fleet-wide).

> Wallrock: 'pegmatite' composition as the granite proxy (inert silicate — Wittichen veins cut Triberg granite; the carbonate gangue arrives in the FLUID via the late CO3 event, not from wall dissolution). Architecture tabular (vein-bounded), pocket size class, shape_seed 1736 (the cobalt-boom decade).

> Calibration target: the hand specimen is silver-white dendritic Bi embedded in white carbonate with gray arsenide rims, read in cross-section. MEASURED at seeds 42-45 (calibration session, 2026-06-12): native_bismuth 3-5 alive with 45-49% DENDRITIC zone mass (the shock recorded); skutterudite 2 + safflorite 2 + nickeline 4 + native_arsenic 4 all ALIVE; native_silver grows then sulfidizes to acanthite 4 at the meteoric-sulfate stage (the tarnish story — hand-specimen Wittichen silver is acanthite-coated); proustite 2 (ruby silver); calcite + aragonite gangue. Bi band edges re-pinned against this trajectory (js/45 — the activity correction at salinity 24 compresses the structural ~4.5 ceiling to ~2.4 measured).

> BARITE DELIVERED (v191, gate-census tune): the v189 'aspirational barite' diagnosis was WRONG about the mechanism — the gate census (tools/wittichen-sulfate-probe.mjs) measured every gate component PASSING from step ~133 (Ba✓ S✓ redox✓ pH✓ T✓) with σ plateaued at 0.60: barite never needed more OXIDATION, it needed more BARIUM (ba_f 24/30 × s_f 30/40 × the salinity-24 activity penalty ≈ 0.59 pinned σ under 1 forever). The locality is the authority: Wittichen's veins are literally Barytgänge — barite-gangue veins, the district's defining gangue — so Ba 24 was unjustifiably shy. Ba 75 (still modest for a heavy-spar district) puts the barite stage at σ 1.47–1.55 from the meteoric beat on: barite 2/6/3 crystals at seeds 42/43/44, NO witherite (the BaCO3 competitor never gates), and the living suite intact at all probed seeds. No Eh change — the reverted +100 oxidation finger stays reverted.

> ERYTHRITE DEMOTED from expects (v191, measured): the cobalt bloom's gate needs T ≤ 50°C (MINERAL_GATES_erythrite — weathering-zone physics) and this scenario's T trajectory ends at ~150°C, so erythrite is STRUCTURALLY out-of-window in a sealed-vein story, not tuning-shy. The real Wittichen erythrite the 1730s miners followed formed during post-Variscan exhumation weathering, long after the vein sealed; modeling it honestly needs a vadose/weathering EPILOGUE (drain + cool to ~20°C + spatially-partial oxidation), which contradicts this scenario's closing beat (carbonate seals the vug at ~150°C). If a weathering-epilogue mechanic ever lands (the schneeberg step-110 vadose pattern, made spatially partial), erythrite is its first client — logged in BACKLOG, not in expects.

> ARAGONITE DEMOTED from expects (v228, hostile-review rung 2 — the erythrite precedent, exactly): Wittichen aragonite is REAL but it is the SUPERGENE phase — mindat's cobalt-bearing aragonite (Co²⁺-in-CaCO3) is recorded from Wittichen as a secondary phase over oxidizing Co-arsenides (Staude et al. 2012 describe the supergene alteration suite), not a 156°C vein gangue. Pre-v228 the aragonite favorability's open-ended T-term grew it at step 141 / ~156°C — precisely the hot low-Mg vein confabulation the v228 spring-window ceiling (~90°C, Casella 2017 inversion kinetics) retires; at Mg/Ca 0.04 and a T floor of ~150°C the phase is structurally out-of-window for this sealed-vein story. The vein's primary CaCO3 gangue is CALCITE (kept). Same weathering-epilogue mechanic that owes erythrite its home owes the cobaltoan pink aragonite — second client, logged in BACKLOG.
