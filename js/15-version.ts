// ============================================================
// js/15-version.ts — SIM_VERSION + per-bump engine-drift history
// ============================================================
// JS counterpart of vugg/version.py — currently sits at v17 while Python has progressed past v30. Drift documented in BACKLOG; future "JS catch-up" rounds land here.
//
// Phase B4 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

// ============================================================
// SIM VERSION
// ============================================================
// Monotonic version tag bumped by any change that could shift seed-42
// output for any scenario. Mirrors SIM_VERSION in vugg.py.
//   v1 — pre-audit: generic FluidChemistry defaults, Mg=0 in most scenarios
//   v2 — scenario-chemistry audit (Apr 2026): every scenario anchored to a
//        named locality with cited fluid values; locality_chemistry.json
//        is the data-source-of-truth.
//   v3 — supergene/arsenate expansion (Apr 2026): ferrimolybdite
//        (Pb-absent Mo-oxidation fork), arsenopyrite (Au-trapping
//        primary sulfide), and scorodite (arsenate supergene with
//        pH-gated dissolution) engines added. Shifts Mo distribution
//        wherever O₂/Fe are available (porphyry, bisbee, supergene),
//        and shifts Au distribution in reducing-As scenarios
//        (arsenopyrite now traps a fraction of Au as invisible-gold
//        trace before native_gold can nucleate).
//   v4 — sulfate expansion round 5 (Apr 2026): seven sulfates added
//        — barite + celestine + jarosite + alunite + brochantite +
//        antlerite + anhydrite. Coorong sabkha celestine + anhydrite
//        immediate; Bingham/Bisbee jarosite/alunite/anhydrite
//        post-event; Bisbee brochantite/antlerite supergene Cu suite.
//        Engine count 55 → 62.
//   v5 — gap-fill follow-ups (Apr 2026): Tri-State + Sweetwater O2
//        bumped 0.0 → 0.25 (mildly reducing, matching real MVT brine
//        at the SO₄/H₂S boundary where sulfate persists alongside
//        H₂S — barite + galena coexist as the diagnostic MVT
//        assemblage). Activates dormant Ba=20/25 + Sr=15/12. Plus
//        barite + celestine supersaturation O2 saturation tuned from
//        O2/1.0 to O2/0.4 (saturates at SO₄/H₂S boundary, not at
//        fully oxidized — geochemically correct). Plus (Tsumeb
//        commit, separate): early ev_supergene_acidification at
//        step 5 + Al 3→15 to unlock scorodite + jarosite + alunite
//        in their early acid window.
//   v8 — Round 8 mineral expansion (Apr 2026, COMPLETE): 15 new species
//        across 5 sub-rounds, engine count 69 → 84, tests 842 → 1037.
//
//        Silver suite (8a, 3 species):
//        • acanthite (Ag₂S, monoclinic) — first Ag mineral.
//        • argentite (Ag₂S, cubic) + 173°C PARAMORPH MECHANIC. First
//          non-destructive polymorph in the sim — cools to acanthite
//          while preserving habit + zones. PARAMORPH_TRANSITIONS dict
//          + applyParamorphTransitions hook in run_step. Bisbee shows
//          5 argentite + 2 acanthite-after-argentite paramorphs;
//          porphyry stays >173°C with 8 pure argentite.
//        • native_silver (Ag) — S-DEPLETION GATE engine, the first
//          inverse-supersaturation engine in the sim.
//
//        Native element trio (8b, 3 species):
//        • native_arsenic (As) — S+Fe overflow gates.
//        • native_sulfur (S) — synproportionation Eh window (0.1<O2<0.7).
//        • native_tellurium (Te) — Au+Ag overflow gates.
//
//        Ni-Co sulfarsenide cascade (8c, 3 species + Bisbee Co=80/Ni=70):
//        • nickeline (NiAs), millerite (NiS, mutual-exclusion gate with
//          nickeline), cobaltite (CoAsS, THREE-ELEMENT GATE — first in sim).
//        • Erythrite + annabergite narrators surface cobaltite/nickeline
//          as paragenetic parents.
//
//        VTA suite (8d, 5 species + Tsumeb W=20):
//        • descloizite/mottramite Cu/Zn-RATIO FORK dispatcher.
//        • raspite/stolzite KINETIC-PREFERENCE dispatcher (~90% stolzite).
//        • olivenite/adamite Cu/Zn fork (existing adamite retrofitted).
//        • Pb thresholds tuned 100→40 for real supergene fluid concentrations.
//
//        Chalcanthite (8e, 1 species + WATER-SOLUBILITY MECHANIC):
//        • chalcanthite (CuSO₄·5H₂O) — terminal Cu-sulfate phase.
//        • Per-step run_step hook re-dissolves crystals when
//          fluid.salinity<4 OR fluid.pH>5. First re-dissolvable mineral.
//
//        Engine count 69 → 84 (+15). Tests 842 → 1037 (+195).
//   v9 — Round 9 supergene-suite mineral expansion (Apr 2026), in sub-rounds:
//        • 9a: rosasite + aurichalcite + the **broth-ratio branching**
//          mechanic. First pair where the *ratio* of fluid elements (Cu
//          vs Zn) gates nucleation, not presence/absence.
//        • 9b: torbernite + zeunerite + the **anion-competition** mechanic.
//          The 3-branch generalization of 9a's 2-branch ratio gate, with
//          three uranyl minerals competing for the same U⁶⁺ cation,
//          differentiated by anion (PO₄³⁻/AsO₄³⁻/VO₄³⁻). 9b shipped the
//          P + As branches.
//        • 9c: carnotite + completion of the anion-competition trio.
//          V-branch (canary-yellow Colorado Plateau crusts, K-cation
//          instead of Cu, monoclinic instead of tetragonal). Also
//          widens torbernite + zeunerite supersat denominators from
//          P+As to P+As+V so V-rich fluid properly routes to carnotite.
//        Engine count 84 → 89 (+5 across 9a + 9b + 9c). No new
//        FluidChemistry fields. First commits to populate test_cases
//        on data/minerals.json (per TASK-BRIEF-DATA-AS-TRUTH.md item 6).
//   v10 — Twin bug fix (Apr 2026, Round 9 closeout patch). Pre-fix,
//        each grow_*() function rolled twinning probability per growth
//        step, so a crystal with 30 zones at p=0.1 had ~92% cumulative
//        twinning rate instead of declared per-roll 10%. Post-fix,
//        the roll happens once at nucleation per declared twin_law in
//        data/minerals.json (VugSimulator._rollSpontaneousTwin).
//        Quartz Dauphiné (thermal-shock + β→α inversion) and the
//        fortress-mode tectonic-event twin trigger remain in place
//        as event-conditional logic. Cuprite spinel-twin habit branch
//        was removed; spinel-twinned cuprite now carries octahedral
//        habit + twinned flag. Verified by tools/twin_rate_check.py.
//   v12 — Uraninite gatekeeper (May 2026, per research-uraninite.md
//        canonical): oxidative dissolution wired into grow_uraninite
//        (mirrors molybdenite). Sigma<1 + O2>0.3 + grown>3µm → uraninite
//        dissolves, releases UO₂²⁺ back to broth — feedstock for
//        secondary uranium minerals (torbernite/zeunerite/carnotite).
//        Habit dispatch tiered (T>500 octahedral, else pitchblende_massive).
//        supersaturation_uraninite reconciled — pre-v12 JS had drift from
//        Python (T-only formula, no O2 gate); now both runtimes identical.
//        Factual fixes: fluorescence flipped to non-fluorescent; T_range
//        tightened 200-800 → 150-600.
//   v13 — Supersat drift audit (May 2026, tools/supersat_drift_audit.py).
//        Two real physics bugs fixed:
//        • galena (this file + agent-api): added O2>1.5 gate + (1.5-O2)
//          factor — pre-v13 PbS could form under oxidizing conditions.
//        • molybdenite (this file): same class — added O2>1.2 gate
//          (agent-api was already correct).
//        Plus chalcopyrite Python ported to JS's 4-tier T window
//        (Seo 2012 porphyry sweet spot 300-500°C, was flat 1.2/0.6).
//        Remaining divergences filed in BACKLOG.md.
//   v14 — Round 9d: autunite + cation fork on the P-branch (May 2026).
//        New mineral autunite Ca(UO₂)₂(PO₄)₂·11H₂O — Ca-cation analog
//        of torbernite. supersaturation_torbernite now gates on
//        Cu/(Cu+Ca)>0.5; autunite mirrors with Ca/(Cu+Ca)>0.5. The
//        cation fork's narrative payoff: Ca²⁺ doesn't quench uranyl
//        emission like Cu²⁺ does, so autunite glows intense apple-green
//        under LW UV while torbernite stays dark. Engine count 89→90.
//   v15 — Round 9e: tyuyamunite + uranospinite (May 2026), completing
//        the cation+anion fork on all three anion branches:
//        P-branch torbernite/autunite (9d), As-branch zeunerite/
//        uranospinite (9e), V-branch carnotite/tyuyamunite (9e).
//        zeunerite gains Cu/(Cu+Ca) > 0.5 cation gate; carnotite gains
//        K/(K+Ca) > 0.5. Both Ca-cation new species are autunite-group
//        Ca-uranyl arsenate/vanadate; uranospinite is strongly
//        fluorescent yellow-green LW (like autunite) and tyuyamunite
//        is weakly fluorescent (vanadate matrix dampens). Engine 90→92.
//   v16 — Round 9e mechanic-coverage scenarios (May 2026): two new
//        shipped scenarios that finally exercise the autunite-group
//        cation+anion fork end-to-end. schneeberg (Erzgebirge type
//        locality, 6 events) fires torbernite + zeunerite (Cu phase)
//        then autunite + uranospinite (Ca phase). colorado_plateau
//        (Uravan Mineral Belt, 5 events) fires carnotite + tyuyamunite
//        on the V-branch. All 6 secondary U species shipped in
//        Rounds 9b-9e now have scenarios that fire them.
//   v17 — Supersat reconciliation v2 (May 2026, post-v13 audit follow-up).
//        Reconciled the 5 remaining design-divergent supersats per
//        research: feldspar (K-only structure, JS Na fork removed —
//        albite has its own engine), fluorite (5-tier T + fluoro-complex
//        penalty merge), selenite (60°C decay matches gypsum-anhydrite
//        phase boundary, JS 80°C cap was too lenient), smithsonite
//        (hard T<100 cap + alkaline boost), wulfenite (Python T+pH +
//        JS Pb/Mo thresholds hybrid). Plus ported effective_temperature
//        + silica_equilibrium from JS to Python — pre-v17 only the
//        browser sim had Mo-flux thermal modulation for porphyry sulfides.
//   v18 — Carbonate Liebig saturation bugfix (May 2026,
//        PROPOSAL-GEOLOGICAL-ACCURACY Phase 2). Replaced the
//        min(cation, anion) Liebig pattern in calcite, siderite,
//        rhodochrosite, and aragonite with √(cation × anion); replaced
//        dolomite's mixed min(√(Ca·Mg), 2·CO3) with the properly
//        stoichiometric (Ca·Mg·CO3²)^¼. Real saturation is the
//        ion-activity product Q = a(M)·a(X), not the limiting
//        reagent — when Ca and CO3 differ in abundance, the geometric
//        mean correctly counts both species. Net: carbonates nucleate
//        slightly earlier in scenarios with asymmetric Ca:CO3, slightly
//        later in dolomite scenarios where CO3 was previously
//        overweighted by the doubling-then-min hack. Five edits in
//        js/32-supersat-carbonate.ts; no other supersat formulas
//        affected (the 90+ Math.min hits across other classes are
//        saturation caps, not Liebig patterns).
//   v19 — Fluid mass balance flipped on (May 2026,
//        PROPOSAL-GEOLOGICAL-ACCURACY Phase 1c). Every precipitation
//        zone now debits the per-ring fluid by stoichiometric
//        coefficient × MASS_BALANCE_SCALE; every dissolution zone
//        credits it. The infrastructure landed flag-OFF in Phase 1a
//        (commit 08140d1) and is calibrated here at scale=0.01
//        (down from prototyped 0.05) to balance the wrapper's new
//        universal credits against the engine-internal hand-coded
//        credits in ~12 minerals. Sweep across 19 baselines at
//        seed 42: RMS delta 11.2%, 11 of 19 scenarios within ±5%,
//        16 within ±20%; max delta -23% (porphyry, finite Fe/S
//        depleted by sulfide cascade — geologically correct).
//        Outliers in absolute terms are small (≤11 crystals).
//        Scenarios where dissolution recycles solute (naica, mvt,
//        searles_lake) gain 2-4 crystals; depletion-prone scenarios
//        (porphyry, schneeberg, pulse) lose 1-11 crystals.
//   v20 — Davies activity correction flipped on (May 2026,
//        PROPOSAL-GEOLOGICAL-ACCURACY Phase 2c). Every supersat
//        method now multiplies σ by activityCorrectionFactor —
//        the geometric-mean Davies γ̄ for the mineral's stoichiometry.
//        Infrastructure landed flag-OFF in Phase 2a (b63e426); 97/97
//        minerals migrated in Phase 2b (eff8ec1). Calibrated here at
//        ACTIVITY_DAMPING = 0.25 (a quarter of full Davies) — full
//        correction (damping=1.0) shifted scenarios by RMS 33% and
//        broke tutorials (-60% on tutorial_mn_calcite). The damping
//        smoothly interpolates between full Davies (research mode)
//        and identity (no correction). Calibration sweep at seed 42
//        vs v19 baselines: RMS 19.1%, 5/19 within ±5%, 12/19 within
//        ±20%; max delta -33% (mvt, geologically defensible — MVT
//        brines are saline-enough that activity correction matters).
//        Brine scenarios (bisbee, mvt, schneeberg) trend down per
//        γ < 1 suppression; halite-saturated brines hit the I=1.7
//        Davies clamp and are unaffected. Pulse scenarios with
//        stochastic small-N counts show ±33% noise floor.
//   v21 — Phase 1d cleanup: end engine-internal growth-path debit
//        double-counting (May 2026). Removed 7 manual
//        `conditions.fluid.X -= rate * coef` blocks (15 lines, in
//        adamite, mimetite, malachite, smithsonite, wulfenite,
//        uraninite, feldspar) that previously double-debited fluid
//        on growth alongside the wrapper from Phase 1a. Wrapper
//        narrowed to precipitation-only — engine-internal dissolution
//        credits (~120 lines, ~50× larger per-mineral rates than
//        the wrapper's MASS_BALANCE_SCALE) keep their existing
//        recycling stories. Phase 1e (future) would migrate those
//        into per-mineral dissolution scales for full unification.
//        Calibration sweep at seed 42 vs v20: RMS 7.58%, 15 of 19
//        scenarios within ±5%, 18 of 19 within ±20%. Max delta
//        -25.5% (schneeberg, U-secondary minerals less aggressive
//        once uraninite stops over-debiting U). Most scenarios
//        unchanged (those 7 minerals weren't dominant).
//   v22 — Phase 1d cleanup pass 2 (May 2026). Earlier pass missed the
//        sulfate (60) and sulfide (61) engine files because their
//        debit pattern used the inline form
//        `conditions.fluid.X = Math.max(conditions.fluid.X - rate * Y, 0)`
//        (one line) rather than the two-line `-= rate * Y;` + Math.max
//        cleanup that the earlier grep matched. This pass removes
//        ~36 additional growth-path bulk-formula debits across
//        barite/celestine/chalcanthite/anhydrite/anglesite/jarosite/
//        alunite/brochantite/antlerite/mirabilite/thenardite/molybdenite/
//        galena/arsenopyrite/acanthite/argentite/nickeline/millerite/
//        cobaltite. Special cases preserved: arsenopyrite Au-trap
//        (Au not in stoichiometry), oxidative-breakdown S debits in
//        dissolution paths (use `dissolved_um` not `rate`).
//        With double-debit fully gone across all 12 engine classes,
//        MASS_BALANCE_SCALE rises 0.01 → 0.02. Plus depletion
//        narration: applyMassBalance now reports species crossing
//        below MASS_BALANCE_DEPLETION_THRESHOLD (1 ppm) and
//        _runEngineForCrystal emits ⛔ log lines. Calibration sweep
//        at seed 42 vs v21: RMS 13.0%, 9 of 19 within ±5%, 18 of 19
//        within ±20%. Outliers: gem_pegmatite +50% (small N: +7
//        crystals), searles_lake -12% (Na-S evaporite finds new
//        depletion-cycle equilibrium). 67 depletion ⛔ narratives
//        across the sweep (mostly searles_lake + reactive_wall).
//   v23 — Phase 3b carbonate speciation infrastructure (May 2026).
//        Three pieces:
//        (a) Migrated all 11 carbonate supersat methods to use
//            effectiveCO3(this.fluid, this.temperature) instead of
//            this.fluid.CO3 directly. With CARBONATE_SPECIATION_ACTIVE
//            flag OFF (default), behavior is identical (effectiveCO3
//            returns fluid.CO3 = DIC). With flag ON (Phase 3c
//            calibration target), it returns the Bjerrum-derived
//            CO₃²⁻ activity at current pH and T.
//        (b) Added co2_degas / co2_degas_with_reheat / co2_charge
//            event handlers. Each manipulates fluid.CO3 + fluid.pH
//            to keep the carbonate system roughly in Bjerrum
//            equilibrium. The reheat variant resets temperature too,
//            modeling continuous hot-fluid recharge at active hot
//            springs.
//        (c) Strengthened calcite alkaline-boost factor: old
//            (1 + (pH - 7.5) × 0.15) → new 3^(pH - 7.5). Old factor
//            was 7.5% per pH unit; real Bjerrum CO₃²⁻ activity grows
//            ~10× per pH unit. New factor: 1.0 at pH 7.5, 1.73 at
//            pH 8.0, 3.0 at pH 8.5. Lets CO₂-degas cascades work
//            without the flag flip.
//        New scenario: tutorial_travertine demonstrates the cascade
//        — three CO₂-degas-with-reheat pulses raise pH 6.5 → 8.0;
//        calcite nucleates at step 41 once σ crosses the 1.3 gate.
//        Calibration sweep at seed 42 vs v22: RMS 9.73%, 17 of 19
//        scenarios within ±20%, max -31% (deccan_zeolite — alkaline
//        scenario where the stronger pH boost amplifies competing
//        carbonates). 14 of 19 scenarios completely unchanged.
//   v24 — Phase 3c: CARBONATE_SPECIATION_ACTIVE flipped on
//        (May 2026). effectiveCO3 now routes through proper Bjerrum
//        partition with normalization at BJERRUM_REFERENCE_PH (7.5):
//        the existing per-mineral eq calibrations stay valid at
//        neutral pH, while pH deviations produce the genuine ~10×
//        per-pH-unit CO₃²⁻ amplification of real aqueous chemistry.
//        BJERRUM_DAMPING = 0.5 — full Bjerrum (factor √10 = 3.16 at
//        pH 8) was 2× stronger than the empirical 3^(pH-7.5) v23 was
//        already applying, so half-amplitude blending keeps scenarios
//        in their calibration band. The manual 3^(pH-7.5) factor in
//        calcite supersat is now flag-conditional (only fires when
//        the new flag is OFF), so the two paths don't double-count.
//        Net: all 11 carbonate supersat methods now have proper
//        pH-dependent CO₃²⁻ activity, not just calcite.
//        Calibration sweep at seed 42 vs v23: RMS 13.4%, 17/20
//        within ±20%, max -25% (tutorial_first_crystal,
//        tutorial_mn_calcite — small-N tutorials sensitive to any
//        carbonate shift). tutorial_travertine: bumped initial Ca
//        200 → 350 ppm to keep the cascade firing under the new
//        damping; calcite nucleates at step 42 (σ=1.46). Real Mammoth
//        Hot Springs water sits at 400-500 ppm Ca per Friedman 1970.
//   v25 — engine determinism fix (May 2026). Replaced 16 stray
//        Math.random() calls in engines + transitions with the
//        seeded rng.random() so seed-42 output is now reproducible
//        across runs within a session. Surfaced by the new JS
//        test harness (tests-js/) — the determinism test failed on
//        porphyry crystal-by-crystal totals because Math.random()
//        in the arsenate / borate / carbonate / halide / phosphate /
//        sulfate growth-rate jitter and the dehydration-transition
//        80%-chance gate read from wall-clock entropy, not the
//        seeded stream. With the fix applied, two back-to-back
//        runs of any scenario produce byte-identical crystals.
//        Calibration sweep is therefore expected to drift from v24
//        baselines on every scenario that involves those classes;
//        baselines need to be regenerated from the JS side and
//        committed in tests-js/baselines/. UI-side Math.random
//        calls (seed-input default, random scenario picker, zen
//        scenarioKey) are intentional wall-clock entropy and
//        unchanged.
//   v26 — Phase 4a aqueous-redox infrastructure (May 2026).
//        Three pieces, all flag-OFF:
//        (a) New `fluid.Eh` field (mV, default +200 — mildly
//            oxidizing). Per-ring like every other FluidChemistry
//            field, threaded through diffusion automatically.
//        (b) New module 20c-chemistry-redox.ts encoding the three
//            Nernst couples (Fe³⁺/Fe²⁺ E°=770 mV, MnO₂/Mn²⁺
//            E°=1230 mV pH-strongly-coupled at -118 mV/pH,
//            SO₄²⁻/HS⁻ E°=250 mV pH-coupled at -66.6 mV/pH) plus
//            nernstOxidizedFraction + redoxFraction helpers and
//            backward-compat ehFromO2 / o2FromEh derivations.
//        (c) EH_DYNAMIC_ENABLED = false flag — engines still gate
//            on fluid.O2 > X across all 96 sites until Phase 4b
//            migrates them one supersat class at a time. Until
//            then the new field rides alongside as derived state;
//            seed-42 output is byte-identical to v25.
//        No calibration shift expected at this version (flag-OFF
//        infrastructure only); first sweep deltas land at v27 when
//        4b starts migrating engines.
//   v27 — Phase 4b helpers landed (May 2026). Two new helpers in
//        20c-chemistry-redox.ts: sulfateRedoxAvailable(fluid, X) and
//        sulfateRedoxFactor(fluid, scale, cap=Infinity). With
//        EH_DYNAMIC_ENABLED=false (still) they passthrough to the
//        legacy fluid.O2 form, giving byte-identical seed-42 output
//        — this version is the "infrastructure callable but unused"
//        checkpoint. Subsequent v28+ commits walk the 22 sulfate
//        engine sites in batches; the seed42_v27.json baseline
//        therefore must equal seed42_v26.json content (only filename
//        differs). If any scenario summary drifts at v27, the
//        helpers don't actually preserve legacy behavior — back out.
//   v28 — Phase 4b sulfate sites batch 1 (May 2026): barite,
//        celestine, anhydrite, selenite migrated to the helper form.
//        4 engines × 2 sites each = 8 site migrations. With
//        EH_DYNAMIC_ENABLED=false the helpers passthrough to the
//        legacy fluid.O2 form, so seed-42 output is byte-identical
//        to v27 (verified via baseline diff). Per-site rationale
//        comments preserved unchanged. Calibration delta target:
//        zero crystal shift across all 20 scenarios.
//   v29 — Phase 4b sulfate sites batch 2 (May 2026): brochantite,
//        antlerite, jarosite, alunite migrated to the helper form.
//        4 engines × 2 sites each = 8 site migrations. The Cu/Fe/Al
//        supergene-acid suite — all four gate on O2 ≥ 0.5 and use
//        the standard /1.0 cap 1.5 factor. With EH_DYNAMIC_ENABLED
//        still false, byte-identical to v28 (verified via diff).
//        14 sites + 8 supersat methods → 6 sites + 4 supersat methods
//        remaining in the sulfate class.
//   v30 — Phase 4b sulfate sites batch 3 + sulfate-class COMPLETE
//        (May 2026): chalcanthite, mirabilite, thenardite, anglesite
//        migrated to the helper form. 6 sites across 4 supersat
//        methods. With this commit, all 22 sites in
//        js/40-supersat-sulfate.ts are migrated; `grep "fluid.O2"
//        js/40-supersat-sulfate.ts` returns nothing. The sulfate
//        class is the proof-of-pattern for Phase 4b — the 5 remaining
//        classes (arsenate / carbonate / hydroxide / oxide / sulfide)
//        follow the same per-class-helper template once their own
//        redox semantics are nailed down.
//        With EH_DYNAMIC_ENABLED still false, byte-identical to v29
//        (verified via baseline diff). Phase 4c (flag flip + per-site
//        Eh-threshold tuning) is the natural next sub-phase once
//        4b's other classes ship.
//   v31 — Phase 4b hydroxide class COMPLETE (May 2026): goethite +
//        lepidocrocite. 4 sites across 2 supersat methods. New helpers
//        hydroxideRedoxAvailable + hydroxideRedoxFactor in
//        20c-chemistry-redox.ts — same flag-OFF passthrough shape as
//        sulfate's helpers, named separately so Phase 4c can bind
//        hydroxide to the Fe³⁺/Fe²⁺ Nernst couple (E°=770 mV) while
//        sulfate stays on the SO₄²⁻/HS⁻ couple. Both Fe(III)
//        hydroxides only form under solidly oxic conditions, so the
//        legacy O2 thresholds 0.4/0.8 map cleanly to Eh well above
//        the Fe couple midpoint. With EH_DYNAMIC_ENABLED still false,
//        byte-identical to v30 (verified via diff).
//   v32 — Phase 4b oxide class COMPLETE (May 2026): hematite,
//        uraninite, magnetite, cuprite. 8 sites across 4 supersat
//        methods (corundum/ruby/sapphire delegate to
//        _corundum_base_sigma which doesn't reference fluid.O2 — no
//        migration needed). Oxide is the first class with mixed
//        redox semantics:
//        • hematite (Fe(III)): standard oxidized-side via
//          oxideRedoxAvailable + oxideRedoxFactor.
//        • uraninite (U(IV)): REDUCED-side via oxideRedoxAnoxic +
//          oxideRedoxAnoxicFactor — the first reverse-gate helpers.
//          Phase 4c will add a U couple to REDOX_COUPLES so this
//          binds against `1 - redoxFraction(fluid, 'U')`.
//        • magnetite + cuprite (intermediate Fe-mixed-valence and
//          Cu(I)): WINDOWED via oxideRedoxWindow +
//          oxideRedoxTent — Eh-band-with-tent peak, neither solidly
//          oxic nor anoxic.
//        With EH_DYNAMIC_ENABLED still false, byte-identical to v31
//        (verified via diff).
const SIM_VERSION = 32;

