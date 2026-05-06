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
//   v33 — Phase 4b arsenate class COMPLETE (May 2026): adamite,
//        annabergite, erythrite, mimetite, olivenite, scorodite.
//        12 sites across 6 supersat methods, all standard
//        oxidized-side via arsenateRedoxAvailable + arsenateRedoxFactor
//        — same shape as sulfate/hydroxide. All six are arsenate As(V)
//        minerals; Phase 4c will bind to a new As couple
//        (HAsO₄²⁻/H₃AsO₃, E° ≈ +560 mV at pH 7) added to
//        REDOX_COUPLES. With EH_DYNAMIC_ENABLED still false,
//        byte-identical to v32 (verified via diff).
//   v34 — Phase 4b carbonate class COMPLETE (May 2026): malachite,
//        smithsonite, azurite, rosasite, aurichalcite (oxidized-side,
//        8 sites) + siderite, rhodochrosite (reduced-side, 4 sites).
//        Calcite, dolomite, aragonite, cerussite have no fluid.O2
//        reference — no migration needed. New helpers:
//        carbonateRedoxAvailable + carbonateRedoxFactor (oxidized,
//        same shape as sulfate), carbonateRedoxAnoxic (reduced-side
//        hard gate, same shape as oxide's anoxic), and
//        carbonateRedoxPenalty (parametrized soft-penalty multiplier
//        capturing siderite's smooth join at O2=0.3 and
//        rhodochrosite's step discontinuity at O2=0.8).
//        Phase 4c will bind oxidized-side carbonates to Eh; siderite
//        binds to (1 - redoxFraction(fluid, 'Fe')) and rhodochrosite
//        to (1 - redoxFraction(fluid, 'Mn')) — both Fe(II) and
//        Mn(II) carbonates need their cation in the reduced state.
//        With EH_DYNAMIC_ENABLED still false, byte-identical to v33
//        (verified via diff).
//   v35 — Phase 4b sulfide class COMPLETE — Phase 4b in full (May 2026).
//        20 minerals, 34 sites — the largest class, all reduced-side.
//        Three new helpers in 20c-chemistry-redox.ts:
//        • sulfideRedoxAnoxic — hard reverse-gate (18 sites). Legacy
//          `if (O2 > X) return 0`.
//        • sulfideRedoxLinearFactor(intercept, slope=1, floor=-∞) —
//          unified multiplier covering three legacy shapes (15 sites):
//          (1.5 - O2) no-clamp / (intercept - O2) clamped / (1.0 -
//          slope·O2) clamped.
//        • sulfideRedoxTent — for covellite's
//          `max(0.3, 1.3 - abs(O2 - 0.8))` shape (1 site).
//        All flag-OFF passthrough; byte-identical to v34.
//
//        Phase 4b RUNNING TOTAL: 92 fluid.O2 sites migrated across 6
//        supersat classes (sulfate/hydroxide/oxide/arsenate/carbonate/
//        sulfide). Discovered additional classes during the sulfide
//        sweep that the handoff doc undercounted: molybdate (8),
//        native (12), phosphate (13), silicate (2) — 35 sites
//        remaining across 4 more classes. Phase 4b continues. With
//        the flag still false, all migrated classes passthrough to
//        fluid.O2 — seed-42 output unchanged from v26 across all
//        scenarios.
//   v36 — Phase 4b molybdate + phosphate + silicate classes COMPLETE
//        (May 2026): 23 sites across 3 oxidized-side classes.
//        molybdate: wulfenite, ferrimolybdite, raspite, stolzite (8
//        sites). phosphate: descloizite, mottramite, clinobisvanite
//        + 6 uranyl phosphates/arsenates/vanadates (13 sites).
//        silicate: chrysocolla (2 sites — only Cu silicate; quartz,
//        beryl, feldspar etc. have no fluid.O2 reference). New
//        helpers molybdateRedox*, phosphateRedox*, silicateRedox* —
//        textually identical bodies to the sulfate/arsenate
//        oxidized-side helpers, named per-class for Phase 4c tuning
//        independence (one Eh threshold per class).
//        Flag still off; byte-identical to v35.
//   v37 — Phase 4b native class COMPLETE — Phase 4b in FULL (May 2026).
//        12 sites across 6 minerals (native_tellurium, native_sulfur,
//        native_arsenic, native_silver, native_bismuth, native_copper;
//        native_gold has no fluid.O2 reference). Four new helpers in
//        20c-chemistry-redox.ts: nativeRedoxAnoxic (5 sites),
//        nativeRedoxLinearFactor (5 sites — same shape as
//        sulfideRedoxLinearFactor with intercept=1.0), nativeRedoxWindow
//        (1 site, native_sulfur), nativeRedoxTent (1 site,
//        native_sulfur synproportionation Eh peak at O2=0.4).
//
//        ============================================================
//        PHASE 4b: COMPLETE
//        ============================================================
//        TOTAL: 127 fluid.O2 sites migrated across 10 supersat classes
//        (sulfate 22, hydroxide 4, oxide 8, arsenate 12, carbonate 12,
//        sulfide 34, molybdate 8, phosphate 13, silicate 2, native 12).
//        With EH_DYNAMIC_ENABLED=false throughout, all helpers
//        passthrough to fluid.O2 — seed-42 output unchanged from v26
//        across all 20 scenarios (verified via baseline diff at every
//        version bump v27→v37).
//
//        Phase 4c (next sub-phase) is now unblocked: flip the flag,
//        regen baseline, tune per-class Eh thresholds where the
//        Eh-equivalent mapping shifts crystal counts beyond ±5%.
//   v38 — Phase 1e infrastructure (May 2026). Adds MINERAL_DISSOLUTION_RATES
//        table to 19-mineral-stoichiometry.ts and extends applyMassBalance
//        to credit fluid for negative-thickness zones when the mineral has
//        an entry in the table. Table is empty in this commit — every
//        dissolution call short-circuits via the missing-entry check, so
//        seed-42 stays byte-identical to v37. Phase 1d's growth-path-only
//        wrapper guard is now lifted; the comment block in applyMassBalance
//        explains the per-mineral migration pattern. Subsequent commits
//        populate the table class-by-class and remove the matching inline
//        `fluid.X += dissolved_um * RATE` blocks from engines, mirroring
//        the precipitation-side cleanup that landed across Phase 1c/d.
//   v39 — Phase 1e migration batch 1: halide + borate + hydroxide
//        (May 2026). 8 inline `fluid.X += dissolved_um * RATE`
//        credits removed across 5 minerals (fluorite, halite, borax,
//        goethite, lepidocrocite); matching entries added to
//        MINERAL_DISSOLUTION_RATES with the exact same per-µm rates.
//        applyMassBalance now credits the fluid uniformly the way it
//        debits during precipitation. Verified byte-identical to v38
//        via per-scenario JSON comparison across all 20 scenarios
//        (the file-level diff shows CRLF/LF churn from Windows git
//        autocrlf — substance is bit-equal). 63/63 tests green.
//   v40 — Phase 1e migration batch 2: molybdate + native + oxide
//        (May 2026). 13 inline credits removed across 11 minerals
//        (wulfenite, ferrimolybdite, hematite, uraninite, magnetite,
//        cuprite, native_tellurium, native_sulfur, native_arsenic,
//        native_bismuth, native_copper). All single-mode dissolution
//        with consistent per-µm rates; native_silver and native_gold
//        have no dissolution credit at all and stay absent from the
//        table. Batch verified byte-identical to v39 via per-scenario
//        JSON comparison; 21/127 sites total now table-mediated.
//   v41 — Phase 1e migration batch 3: sulfate class (May 2026).
//        22 inline credits removed across 9 minerals (anhydrite,
//        brochantite, antlerite, jarosite, alunite, mirabilite,
//        thenardite, selenite, anglesite). barite, celestine,
//        chalcanthite have no inline dissolution credit at all and
//        stay absent from the table. anglesite has two engine
//        triggers (acid + carbonate-overwhelm) but identical
//        per-µm rates, so a single table entry covers both. Verified
//        byte-identical to v40 via per-scenario JSON comparison;
//        43/~185 sites total now table-mediated.
//   v42 — Phase 1e migration batch 4: arsenate (single-mode subset)
//        + phosphate class (May 2026). 33 inline credits removed
//        across 12 minerals. Arsenate's erythrite + annabergite have
//        multi-mode dissolution (thermal dehydration + acid attack
//        at different effective rates) and stay inline pending
//        per-mode dispatch. Phosphate is fully single-mode — every
//        engine has exactly one dissolution event with rate-scaled
//        credits. descloizite + mottramite have no inline
//        dissolution credit at all and stay absent from the table.
//        76/~185 sites total now table-mediated.
//   v43 — Phase 1e migration batch 5: silicate (single-mode subset)
//        (May 2026). 17 inline credits removed across 10 minerals
//        (quartz, feldspar, albite, topaz, apophyllite, beryl,
//        emerald, aquamarine, morganite, heliodor). The five
//        beryl-family variants share a `_beryl_family_dissolution`
//        helper; each variant gets its own table entry with the same
//        rates so the wrapper dispatches correctly via crystal.mineral.
//        Apophyllite's legacy form used constants with thickness=-2.0;
//        table rates = constant/2.0 produce identical credits.
//        chrysocolla has multi-mode dissolution and stays inline.
//        93/~185 sites total now table-mediated.
//   v44 — Phase 1e migration batch 6: carbonate (single-mode subset)
//        (May 2026). 19 credits removed across 8 minerals (calcite
//        major species, dolomite, siderite, malachite, smithsonite,
//        rosasite, aurichalcite, cerussite). Calcite's trace Mn + Fe
//        credits stay inline — they're zone-data-driven (avg over
//        last 3 zones), not rate-scaled. Siderite has two engine
//        triggers (oxidative + acid) with identical rates so a single
//        table entry covers both. aragonite (polymorph constants vs
//        acid rate-scaled), rhodochrosite (acid vs O2 at different
//        rates), azurite (low-CO3 vs acid at different CO3 rates) are
//        multi-mode and stay inline pending per-mode dispatch.
//        112/~185 sites table-mediated.
//   v45 — Phase 1e migration batch 7: sulfide (single-mode subset)
//        (May 2026). 32 credits removed across 14 sulfide minerals
//        (chalcopyrite, molybdenite, nickeline, millerite, stibnite,
//        bismuthinite, bornite, chalcocite, covellite, tetrahedrite,
//        tennantite, arsenopyrite, acanthite, cobaltite). For
//        arsenopyrite, the standard Fe+As+S rate-scaled credits move
//        to the table; the Au-trap (zone-data-driven trace) and pH
//        adjustment stay inline. For acanthite + cobaltite, the
//        positive cation credits move to the table; the negative S
//        consumption (Math.max-clamped subtraction) stays inline
//        pending the table's negative-rate design extension.
//        144/~185 sites table-mediated. Remaining ~41 sites are all
//        multi-mode/special: pyrite + marcasite multi-mode (12),
//        wurtzite constants (2), aragonite + rhodochrosite + azurite
//        carbonate multi-mode (12), erythrite + annabergite arsenate
//        multi-mode (8), chrysocolla silicate multi-mode (4),
//        arsenopyrite Au-trap + calcite trace (3 — never tablifiable
//        as currently designed).
//   v46 — Phase 1e completion infrastructure (May 2026): table type
//        extended to support multi-mode entries. Two entry shapes
//        now allowed:
//          (1) single-mode rates (legacy):    { Ca: 0.4, F: 0.6 }
//          (2) multi-mode dispatch:           { __modes: {
//                acid:      { rates: { Ca: 0.5, CO3: 0.3 } },
//                polymorph: { constants: { Ca: 2.0, CO3: 1.5 } },
//              }}
//        Each multi-mode mode is either { rates } (multiplied by
//        dissolved_um) or { constants } (added once, regardless of
//        |thickness_um|). The constants flavor preserves byte-identicality
//        for engines that emit fixed thicknesses like -1.2 where
//        IEEE-754 won't round-trip `k * (1.2 * (k/1.2)) === k`. The
//        wrapper also gains a per-species `Math.max(0, …)` clamp,
//        applied only when the species' rate is negative. Positive
//        rates take the legacy `fluid += delta` path verbatim, which
//        preserves bit-for-bit accumulation with v45 — empirically a
//        universal clamp drifted bisbee (the +=/clamp ordering changed
//        downstream nucleation gates by ~ulp on a few crystals).
//        Negative rates unlock the consumption pattern (acanthite/cobaltite
//        S sinks, native_silver tarnish) in upcoming batches. No engine
//        changes in this commit; no entries change shape; v46
//        byte-identical to v45 across all 20 seed-42 scenarios.
//   v47 — Phase 1e batch 8: pyrite + marcasite multi-mode (May 2026).
//        12 inline credit lines removed across two engines via the
//        new __modes dispatch (5 sites total — pyrite oxidative + acid;
//        marcasite inversion + oxidative + acid).
//          pyrite.oxidative   rates     {Fe:1.0, S:0.5}    O2>1.0, low-σ
//          pyrite.acid        constants {Fe:2.0, S:1.5}    pH<3.0,  -2.0µm
//          marcasite.inversion constants {Fe:1.5, S:1.2}   pH>=5 or T>240, -1.5µm
//          marcasite.oxidative rates     {Fe:1.0, S:0.5}   O2>0.8, low-σ
//          marcasite.acid     constants {Fe:2.0, S:1.5}    pH<1.5,  -2.0µm
//        Engines now emit `dissolutionMode: 'oxidative' | 'acid' | 'inversion'`
//        on the GrowthZone for the wrapper to dispatch on. The constants
//        modes use the {constants} flavor to bypass the 1.5×0.8=1.2 IEEE
//        round-trip trap (marcasite inversion stores {Fe:1.5, S:1.2}
//        directly rather than {rates: {Fe:1.0, S:0.8}} × 1.5µm).
//        156/~185 sites table-mediated.
//   v48 — Phase 1e batch 9: aragonite multi-mode (May 2026).
//        2 inline credit sites removed in grow_aragonite via __modes.
//          aragonite.polymorph constants {Ca:2.0, CO3:1.5}  T>100 + sigma<0.8 -> calcite, dT=-2.0
//          aragonite.acid      rates     {Ca:0.5, CO3:0.3}  pH<5.5
//        158/~185 sites table-mediated.
//   v49 — Phase 1e batch 10: rhodochrosite + azurite multi-mode (May 2026).
//        8 inline credit lines removed in grow_rhodochrosite + grow_azurite
//        across 4 dissolution sites:
//          rhodochrosite.oxidative rates {Mn:0.4, CO3:0.4}  sigma<1, O2>1.0
//          rhodochrosite.acid      rates {Mn:0.5, CO3:0.4}  sigma<1, pH<5.5
//          azurite.acid            rates {Cu:0.5, CO3:0.4}  sigma<1, pH<5.0
//          azurite.low_co3         rates {Cu:0.5, CO3:0.3}  sigma<1, CO3<80 (-> malachite pseudomorph)
//        All four modes are rate-scaled, no constants needed. The
//        diagnostic carbonate-suite paragenesis (rhodochrosite oxidative
//        Mn-staining, azurite -> malachite pseudomorph) is now
//        table-mediated instead of inline-duplicated.
//
//        Also bundles a GrowthZone constructor fix: the dataclass
//        constructor only copied explicitly-named fields, so
//        `dissolutionMode` was silently dropped — the wrapper always
//        fell through to the FIRST declared mode. v47/v48 baselines
//        were byte-identical only because the affected non-first modes
//        (pyrite acid pH<3, marcasite acid pH<1.5, marcasite oxidative
//        when first-mode-was-inversion, aragonite acid pH<5.5 with
//        sigma<1) didn't fire in seed-42. Confirmed by regenerating v48
//        under the fixed constructor — produces byte-identical baseline
//        to the committed v48. Rhodochrosite acid mode DID fire in
//        reactive_wall (Mn rate 0.4 vs 0.5 ppm/µm) and exposed the bug.
//        162/~185 sites table-mediated.
//   v50 — Phase 1e batch 11: erythrite + annabergite multi-mode (May 2026).
//        8 inline credit lines removed across 4 dissolution sites:
//          erythrite.thermal   constants {Co:0.4, As:0.3}  T>200, dT=-1.0
//          erythrite.acid      constants {Co:0.6, As:0.4}  pH<4.5, dT=-1.2
//          annabergite.thermal constants {Ni:0.4, As:0.3}  T>200, dT=-1.0
//          annabergite.acid    constants {Ni:0.6, As:0.4}  pH<4.5, dT=-1.2
//        All four modes use {constants} flavor — the acid mode at
//        thickness=-1.2 hits the IEEE-754 round-trip trap (As=0.4/1.2
//        is irrational in binary, 1.2 * (0.4/1.2) ≠ 0.4 exactly), so
//        rate-equivalent storage would drift from the engine's hand-coded
//        credit. Storing the literal credits via {constants} preserves
//        byte-identicality across both modes.
//        170/~185 sites table-mediated.
//   v51 — Phase 1e batch 12: chrysocolla multi-mode (May 2026).
//        4 inline credit lines removed in grow_chrysocolla via __modes:
//          chrysocolla.acid        rates {Cu:0.4, SiO2:0.4}  sigma<1, pH<4.5
//          chrysocolla.dehydration rates {Cu:0.3, SiO2:0.3}  sigma<1, T>120°C
//        Both rate-scaled, no constants needed. The two paths reflect
//        different mechanisms: acid attack releases free Cu²⁺ + silicic
//        acid (higher rates); thermal dehydration is a strict-low-T-phase
//        breakdown that releases less of each (the gel structure traps
//        some — chrysocolla's signature soft fluffy texture).
//        174/~185 sites table-mediated.
//   v52 — Phase 1e batch 13: wurtzite single-mode constants (May 2026).
//        2 inline credit lines removed in grow_wurtzite via __modes:
//          wurtzite.inversion constants {Zn:1.5, S:1.2}  T<=95°C -> sphalerite, dT=-1.5
//        Single-mode entry but uses the __modes wrapper for uniformity
//        with the rest of the polymorph family (pyrite/marcasite/aragonite).
//        The constants flavor stores literal credits {1.5, 1.2} rather
//        than back-deriving rates 1.0/0.8 — defensive against future
//        thickness changes drifting via IEEE-754.
//        176/~185 sites table-mediated.
//   v53 — Phase 1e batch 14 (closer): negative-rate consumption
//        (May 2026). 6 inline `Math.max(fluid - x, 0)` consumption sites
//        removed across 3 engines via the wrapper's per-species
//        rate<0 -> Math.max(0, fluid+delta) clamp:
//          acanthite     S=-0.1 (oxidative)
//          cobaltite     S=-0.1 (oxidative)
//          native_silver Ag=-0.3, S=-0.4 (tarnish to acanthite)
//        For acanthite + cobaltite, the existing entries are extended with
//        the negative S rate (alongside the positive cation rates already
//        there since v45). For native_silver, this is its first entry —
//        previously absent because both species were consumed (no positive
//        credits to migrate at v40).
//        Also fixes the native_silver narration: legacy code said
//        "S returned to fluid" but the arithmetic SUBTRACTED S — Ag₂S
//        tarnish pulls both Ag and S INTO the solid surface. Note now
//        reads "Ag + S consumed", matching the chemistry. Narration text
//        differs but baseline JSON (counts/max_um) byte-identical.
//        182/~185 sites table-mediated. Remaining 3 sites are zone-data
//        traces (calcite Mn/Fe trace from zone history; arsenopyrite
//        Au-trap from zone trace_Au sum) — these are zone-dependent
//        not rate-scaled and stay inline forever as designed.
//   v54 — Paragenesis Q1a infrastructure (May 2026, per
//        PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS).
//        Adds js/26-mineral-paragenesis.ts with table-type scaffolding:
//          SUBSTRATE_NUCLEATION_DISCOUNT — host -> nucleating ->
//             σ-discount factor [0..1] for heterogeneous nucleation
//          EPITAXY_PAIRS — Set of strict-epitaxy 'nucleating>host'
//             pairs (low lattice misfit, real orientation relationship)
//          PSEUDOMORPH_ROUTES — list of {parent, child, trigger,
//             shape_preserved} CDR routes (Putnis 2002, 2009)
//        All three start empty in Q1a (no behavior change, byte-
//        identical to v53). Plus VugSimulator._pickSubstrate(mineral)
//        — a paragenesis-aware substrate-pick helper that returns
//        {host, discount} for documented hosts or null when the table
//        has no entry. Currently always returns null (table empty).
//        Q1b populates the table from documented MVT/supergene pairs
//        and migrates inline ad-hoc 'if (rng() < 0.7) pos = ...'
//        rules to this helper. Q1c wires the σ discount into the
//        nucleation threshold check (where the calibration drift
//        will land). v54 byte-identical to v53 across all 20 seed-42
//        scenarios.
//   v55 — Paragenesis Q1b: substrate-affinity table populated (May 2026).
//        ~50 documented pairs across 12 hosts span sulfides (pyrite/
//        marcasite/sphalerite/galena/chalcopyrite + Co-Ni
//        sulfarsenides), oxides/hydroxides (cuprite/hematite/magnetite/
//        goethite), carbonates (fluorite/calcite/azurite/malachite),
//        native elements (copper/silver), and silicates (quartz/
//        topaz). Two tiers per boss directive 2026-05-06:
//          0.5× — low-misfit lattice (sphalerite-on-pyrite ~0.2%,
//             marcasite-on-pyrite shared S-S) OR strong CDR route
//             (azurite -> malachite, sphalerite -> smithsonite,
//             galena -> cerussite/anglesite, cuprite + CO3 ->
//             malachite, native_silver -> acanthite tarnish, etc.)
//          0.7× — moderate misfit / facet-selective (galena-on-pyrite
//             ~9% misfit, calcite-on-fluorite Cave-in-Rock stack)
//             or general substrate stickiness
//        EPITAXY_PAIRS populated with 6 strict-epitaxy pairs (the
//        sphalerite/marcasite/pyrite triangle) but unused in this
//        commit — orientation-independent rendering for v1, per
//        boss; renderer support is a Q3 follow-up. Citations:
//        Ramdohr 1980 for sulfides, Putnis 2002/2009 for CDR,
//        Sangster 1983/1990 for MVT, Heyl 1968 for UMV/Cave-in-Rock.
//        Q1c wires SUBSTRATE_NUCLEATION_DISCOUNT into nucleation
//        thresholds (where the calibration drift will land).
//        v55 byte-identical to v54 across all 20 seed-42 scenarios —
//        the table is data-only, no caller reads it yet.
//   v56 — Paragenesis Q1c: wire σ-discount into 4 nucleation engines
//        (smithsonite, malachite, azurite, chrysocolla) (May 2026).
//
//        Each engine now picks substrate FIRST (preserving narrative
//        qualifiers like "(oxidized)", "weathering ...", "pseudomorph
//        after ..."), then runs the σ-check with a discount factor
//        from MINERAL_PARAGENESIS based on the chosen position. The
//        discount factor is paragenesisDiscount(host_mineral,
//        nucleating_mineral) → 0.5 for strong CDR/epitaxy, 0.7 for
//        moderate, 1.0 for undocumented (= bare wall).
//
//        Effect: when the inline substrate-pick rules already chose
//        a documented host (e.g. malachite -> chalcopyrite via
//        Putnis-CDR oxidation), the σ-threshold for nucleation is
//        lowered, so MORE such overgrowths fire when σ is in the
//        (threshold * discount, threshold) window. Bare-wall
//        nucleations are unaffected. The substrate-pick distribution
//        itself is unchanged; only the σ-check threshold shifts.
//
//        Engines migrated this batch:
//          smithsonite (sphalerite host, supergene_oxidation)
//          malachite   (chalcopyrite + hematite hosts, bisbee)
//          azurite     (cuprite + native_copper hosts, bisbee)
//          chrysocolla (azurite + cuprite + native_copper hosts, bisbee)
//        Other engines (~6) keep their inline rules; can be migrated
//        in later commits if calibration shows opportunity.
//
//        Calibration drift expected on bisbee + supergene_oxidation
//        (Cu cascade scenarios where the discount fires). MVT /
//        pegmatite / cooling scenarios should drift less since their
//        nucleation candidates are mostly outside this 4-engine set.
//        Drift documented per-scenario in commit message.
const SIM_VERSION = 56;

