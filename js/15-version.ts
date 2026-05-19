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
//   v57 — Paragenesis Q2a: pseudomorph routes table + Crystal CDR
//        fields (May 2026). Per Putnis 2002/2009 canonical CDR
//        framework.
//
//        18 documented coupled-dissolution-precipitation routes
//        populate PSEUDOMORPH_ROUTES in js/26-mineral-paragenesis.ts:
//          Sulfide oxidation: pyrite/marcasite -> goethite/
//             lepidocrocite, sphalerite -> smithsonite/aurichalcite/
//             rosasite, galena -> cerussite/anglesite, cobaltite ->
//             erythrite, nickeline -> annabergite, arsenopyrite ->
//             scorodite
//          Cu carbonate/silicate cascade: azurite -> malachite/
//             chrysocolla, malachite -> chrysocolla, cuprite ->
//             malachite/chrysocolla, native_copper -> cuprite
//          Native silver tarnish: native_silver -> acanthite (Boyle
//             1968)
//        Every route shape_preserved=true (boss directive 2026-05-06:
//        the table is for shape-preserving CDR routes only; non-shape-
//        preserving overgrowths are ordinary substrate-affinity
//        entries from Q1b, not pseudomorph routes).
//
//        Crystal class gains two fields per boss directive:
//          cdr_replaces_crystal_id  (default null) — parent
//             crystal_id when this crystal nucleated via a CDR route
//          perimorph_eligible       (default false) — true when the
//             route's shape_preserved flag is on, so Q4 perimorph
//             mechanic can treat the crystal as a candidate cast if
//             the parent later fully dissolves (per boss: schema
//             anticipates Q4 even before the renderer wires it)
//
//        Detection: sim.nucleate parses the position string AFTER Q1c
//        substrate-pick has set it ("on dissolved X #N", "pseudomorph
//        after X #N", "on weathering X #N", or even "on X #N" when
//        the pair is documented), looks up (host.mineral, this.mineral)
//        in PSEUDOMORPH_ROUTES, and tags the crystal. The position
//        string itself is unchanged — engines keep their narrative
//        qualifiers.
//
//        Q3 renderer will read cdr_replaces_crystal_id to inherit
//        parent outline (malachite-after-azurite renders with the
//        azurite cube silhouette). Q4 renderer will read
//        perimorph_eligible to draw the cast when the host fully
//        dissolves.
//
//        Verification: v56 -> v57 byte-identical across all 20
//        seed-42 scenarios (CDR tagging is metadata only — no
//        chemistry change, no nucleation-gate change).
//   v58 — Paragenesis Q5: snowball barite habit (May 2026, per
//        boss directive 2026-05-06 — sphere primitive evocative
//        enough of the final form for v1; radial-spray detail is
//        v2 polish).
//
//        Mechanism: when _nuc_barite finds a sulfide host
//        (sphalerite / galena / pyrite) AND σ exceeds the Q1c
//        substrate-affinity-discounted threshold, the new barite
//        crystal is tagged `habit: 'snowball'`. The 0.7× discount
//        on sphalerite/galena/pyrite hosts (Q1b table) means
//        snowball seeds form much more readily than free-wall
//        barite (which stays gated at the legacy 0.15 probability).
//        Position string changes from "near X #N" to "on X #N" so
//        the substrate-affinity discount, CDR detection, and host-
//        cell inheritance all see the host as a real anchor.
//
//        grow_barite preserves habit:'snowball' across growth steps
//        (rather than getting overwritten by the σ-driven habit
//        dispatch). a_width_mm = c_length_mm for snowball habit
//        (uniform — sphere); volume formula treats it as 0.5× the
//        true sphere volume, but acceptable until vug-fill
//        calibration drives a refinement.
//
//        Renderer: new 'snowball' habit token resolves to
//        SphereGeometry(0.5, 16, 12) — unit-radius sphere stretched
//        uniformly to c_length_mm. Cavity-clip from e6bb0a1 handles
//        the case where a snowball outgrows the cavity (it gets
//        sliced at the wall like any other crystal).
//
//        Calibration drift expected on mvt + bisbee + sweetwater-
//        type scenarios where sphalerite/galena/pyrite + barite
//        co-occur. Other scenarios (pegmatite, cooling, supergene
//        without primary sulfides, etc.) should drift little if at
//        all since their barite either doesn't form or doesn't have
//        the sulfide hosts.
//   v59 — Per-crystal cavity-bound cap (May 2026, BUG-CRYSTALS-CLIP-
//        VUG-WALL.md Tier-2 fix). Closes the chemistry-side hole that
//        let single crystals grow past the cavity walls (feldspar #7
//        in pegmatite seed 1778042424470 at 91.2% of vug volume,
//        selenite #6 in supergene seed 42 at 93% of vug diameter,
//        the user's 100mm fluorite stress test in a 50mm vug).
//
//        Mechanism: Crystal stores `vug_diameter_mm` at nucleation
//        (read from conditions.wall.vug_diameter_mm). add_zone caps
//        the post-aspect-formula c_length / a_width:
//          c_length <= vug_radius        (= vug_diameter / 2)
//          a_width  <= vug_diameter      (i.e. half-width <= vug_radius)
//        total_growth_um keeps incrementing — the cap is on the
//        rendered/effective size, so future steps see a smaller
//        effective surface area for mass deposition (chemistry self-
//        throttles the right way; no fluid-balance discontinuity).
//
//        This is the spatial counterpart to the existing GLOBAL
//        get_vug_fill check (which limits TOTAL volume across all
//        crystals but doesn't prevent any single crystal from being
//        oversized). The renderer-side cavity-clip + polar-aware
//        per-ring radius (commits e6bb0a1, c53bb30, 1bf950a) was a
//        band-aid that masked outside-hull fragments but couldn't
//        cap a crystal whose body straddles the wall (cuts read as
//        see-through, no closing face).
//
//        Calibration drift: scenarios where any crystal previously
//        exceeded vug_radius along c-axis or vug_diameter laterally
//        will redistribute fluid budget into other crystals (since
//        the capped crystal's surface area plateaus, future mass
//        deposition slows on it). Expect drift on:
//          pegmatite (feldspar #7 case)
//          supergene_oxidation (selenite rosette)
//          bisbee (any large crystals)
//          potentially any scenario with extended tabular growth
//        Smaller scenarios with sub-millimeter crystals see no
//        change (the cap simply never fires).
//   v60 — Host-rock Mechanic 5 Slice B: vug architecture geometry +
//        scenario opt-ins (May 2026, PROPOSAL-HOST-ROCK).
//
//        Mechanism: WallState honors `architecture` field with five
//        archetypes (spherical, irregular, tabular, pocket, basin),
//        each tuning bubble counts, polar/twist amplitude scaling,
//        equator elongation, polar-collapse strength, and
//        nucleation_bias. Scenarios opt in via `wall.architecture`
//        in scenarios.json5; the default 'pocket' is a no-op (legacy
//        scales × 1.0, uniform bias).
//
//        Slice B added two new geometry transforms on top of the
//        existing bubble-merge + Fourier path:
//          - Anisotropic stretch in _buildProfile (tabular): per-cell
//            radius × (1 + e × cos(2θ)) before mean-rescale, with e
//            capped at 0.85 so the short axis stays ≥15% of mean.
//          - Sigmoid polar collapse in polarProfileFactor (basin):
//            blend Fourier with 0.05 + 0.95×sigmoid((π/2 − φ)/0.25)
//            by polar_collapse strength, so the north hemisphere
//            pinches to ~5% radius while the south stays full.
//        Nucleation_bias filter (Slice A) is unchanged — basin's
//        floor_only and tabular's walls_only carry forward.
//
//        Scenario opt-ins (this version): 4 scenarios, drift expected.
//          - mvt        → 'irregular' — limestone-hosted MVT
//          - sabkha_dolomitization → 'basin' — supratidal evaporite
//          - bisbee     → 'irregular' — limestone-replacement skarn
//          - deccan_zeolite → 'spherical' — basalt amygdale
//        The other 16 scenarios stay 'pocket' (default) — byte-equal.
//
//        The drift is intentional: Fourier amplitudes scale per
//        archetype, and basin's polar collapse changes ring radii
//        materially, so any scenario that nucleates in mid-to-upper
//        rings will pick a different ring with the new weights.
//        Renderer-side per-cell cavity clip (commit 4fb128f) is the
//        prerequisite — without it, irregular and tabular cavities
//        would have crystal corners punching through narrow walls.
//   v61 — Defer to actual geology: remove the v59 sim-side cap on
//        c_length / a_width (May 2026, boss directive 2026-05-06
//        "when in doubt, defer to the actual geology").
//
//        Mechanism: 27-geometry-crystal.ts:add_zone no longer clamps
//        c_length to vug_radius or a_width to vug_diameter. Crystals
//        grow to chemistry-true size (total_growth_um / 1000 along
//        c, habit-ratio × c along a). Total_growth_um was already
//        the chemistry-truthful field; v59's clamps were on the
//        rendered effective size to prevent visual overflow before
//        the per-cell shader clip existed. With per-cell clip
//        (commit 4fb128f) discarding fragments past the local wall
//        radius, the render handles the visual; the sim doesn't
//        need to lie about the size.
//
//        Why this is geology-true: real crystals in narrow cavities
//        either compete for space (smaller faces), deform (curved
//        habits), or push into the host rock (rare but documented
//        in soft sediments). They don't magically halt at the wall.
//        The simulator now renders the chemistry-true size and the
//        per-cell clip slices what's past the wall — same visual
//        outcome, honest underlying state.
//
//        Calibration drift: ZERO. Verified v60 → v61 baselines
//        byte-identical across all 20 seed-42 scenarios. The cap
//        only ever affected c_length_mm and a_width_mm (rendered
//        size), and mass balance uses zone.thickness_um (per-step
//        deposition) rather than c × a (cumulative size). All other
//        chemistry consumers (get_vug_fill, _check_enclosure,
//        _check_liberation, max-size record, uraninite radiation)
//        already used total_growth_um (uncapped) post-v59 cleanup,
//        so the cap was a pure render filter. Removing it changes:
//          - rendered mesh size (chemistry-true)
//          - narrator output ("a 34mm feldspar" vs "a 25mm feldspar")
//          - tooltip / collection card displays
//        No baseline drift; SIM_VERSION bump is for save-format and
//        observable-behavior versioning rather than calibration.
//
//        Verified at runtime: gem_pegmatite seed=42 step=200 has
//        2 oversize feldspars (#2 at 34.0 mm, #12 at 30.9 mm in a
//        50 mm vug, vug_radius = 25 mm). c_length_mm now equals
//        total_growth_um/1000, capped only by chemistry.
//
//   v62 — Brief-19 mineral catalog expansion (May 2026, this commit):
//        Three priority + sixteen brief minerals from canonical's
//        a7b312e research drop, plus FluidChemistry.Cd field added
//        to support the Cd-sulfide pair (greenockite + hawleyite).
//        Spec entries only — no engines yet — so seed-42 output
//        for any scenario where engines would have fired is byte-
//        equal to v61. Drift IS expected for scenarios where the
//        new Cd field changes Object.keys(fluid) iteration order:
//        bisbee, searles_lake, tutorial_travertine — diffusion
//        and mass-balance loops over _fluidFieldNames pick up the
//        new key. Drift is small (sub-1% on the species counts;
//        see calibration baselines diff for v61→v62) and is the
//        cost of the Cd field opening the spec to greenockite/
//        hawleyite. No semantic chemistry change for those 3
//        scenarios — same engines, same broth, same seed; only
//        the iteration ordering of an irrelevant zero-valued
//        broth field shifts the FP rounding cumulant. Other 14
//        scenarios in the calibration sweep are unaffected.
//
//        Catalog: 100 → 116 minerals.
//        New broth field: Cd (default 0, no engine consumes it
//        until greenockite/hawleyite engines land in a future
//        round).
//
//   v63 — Brief-19 plumbing pass (May 2026, this commit): scenario
//        broth bumps + two new scenarios to host the new chemistry
//        niches. No engine changes.
//        - Existing scenarios: porphyry +Ti=25; gem_pegmatite Ti
//          0.8→25 + W=5; supergene_oxidation +Cd=0.5; mvt +Cd=2;
//          schneeberg +Se=2; colorado_plateau +Se=2.
//        - New scenarios:
//          * epithermal_telluride (Cripple Creek anchor) — Au=0.4,
//            Ag=15, Te=3, low-S K-alkaline epithermal at 280°C; hosts
//            the calaverite-sylvanite-hessite trio + native_gold/
//            native_tellurium/fluorite/quartz when their engines land.
//          * ultramafic_supergene (Marlborough anchor) — Ni=200,
//            Mg=300, SiO2=200, alkaline (pH 8.5) low-T supergene
//            weathering of serpentinite; hosts chrysoprase + magnesite
//            + calcite when chrysoprase engine lands.
//        Drift: bumped Ti / Cd / Se in 6 scenarios is byte-equal for
//        existing engines (none gate on those fields), but existing
//        engines that DO key on the broth fields touched (W in
//        gem_pegmatite — raspite/stolzite gate W≥5 + Pb≥40, Pb=0
//        here so dormant; Cd in supergene_oxidation/mvt — no engine;
//        Se anywhere — no engine; Ti anywhere — no engine) means net
//        drift expected is from the FP-rounding side-effect of
//        diffusion / mass-balance touching the bumped values, plus
//        the 2 new scenarios introducing 2 new entries to the baseline.
//
//   v64 — Brief-19 engine pass (May 2026, this commit): supersat +
//        grow + nucleation gates wired for all 19 new minerals + the
//        MINERAL_ENGINES registry updated. Engines added across
//        7 class files:
//          halide:    atacamite, sylvite (in 33/53/83)
//          phosphate: apatite, turquoise (in 38/58/88)
//          carbonate: strontianite, witherite (in 32/52/82)
//          molybdate: scheelite, powellite, wolframite (in 35/55/85)
//                     (scheelite + wolframite spec-class moved from
//                      tungstate/oxide → molybdate to match existing
//                      raspite/stolzite/wulfenite class grouping;
//                      class_color aligned to canonical #eb13eb)
//          oxide:     rutile, chromite (in 37/57/87)
//          silicate:  chrysoprase (in 39/59/89)
//          sulfide:   calaverite, sylvanite, hessite, naumannite,
//                     clausthalite, greenockite, hawleyite (in 41/61/91)
//
//        Drift: 7 scenarios shift from v63 because their broth chemistry
//        now activates the new engines:
//          - bisbee → atacamite fires (Cu=400 + Cl=400, supergene)
//          - mvt → greenockite fires (Cd=2 + S from event_fluid_mixing)
//          - porphyry → rutile fires (Ti=25 broth bump)
//          - sabkha_dolomitization → sylvite fires (K=380 brine)
//          - schneeberg → clausthalite fires (Pb=5 below threshold but
//                       events bump Pb; Se=2 above threshold)
//          - searles_lake → sylvite fires
//          - supergene_oxidation → multiple fire (apatite + powellite +
//                                  greenockite/hawleyite + atacamite)
//        New scenarios (epithermal_telluride / ultramafic_supergene)
//        also activate calaverite + sylvanite + hessite (telluride trio)
//        and chrysoprase respectively.
//
//        No engine tuning yet — these are MVP engines: gate ingredients
//        + sigma threshold + simple T-window + dissolution branch.
//        Boss can recalibrate against scenarios.json5 broths once the
//        first runs surface counts that drift outside the expected
//        paragenesis.
//
//   v65 — Replay-in-3D honest history (May 2026): wall_state_history
//        snapshot schema changes from a flat ring[0]-only array to a
//        multi-ring object { step, rings: [ring0_cells, ..., ringN-1] }.
//        The 3D replay path (Three.js renderer, default since v64) now
//        rebuilds the cavity mesh from all 16 rings of the snapshot,
//        not a vertical projection of ring[0], and sizes each crystal
//        from its zones[] history up to the snapshot's step — so
//        replay finally shows growth order (small → larger), pre-
//        nucleation skips, and dissolution backwalks honestly.
//
//        Files touched:
//          - js/85c-simulator-state.ts:_repaintWallState — writer.
//          - js/99i-renderer-three.ts — _topoSnapshotWall consumes the
//            new shape; _topoSyncCrystalMeshes accepts replayStep and
//            uses _topoHistoricalCrystalSize for per-frame size lookup.
//            _clusterSatelliteCount also takes the historical cLen so
//            replay frames don't pile satellites at live counts.
//          - js/99b-renderer-topo-2d.ts — topoRender detects shape,
//            extracts replayStep, aggregates snapshot rings for the
//            2D canvas-vector path.
//
//        Drift: zero expected. No engine reads wall_state_history;
//        only the renderer consumes it. Storage cost: 16× the v64
//        schema (~24 KB → ~384 KB for a 200-step run). Legacy flat-
//        array snapshots remain tolerated by the consumers (the
//        defensive shape guard in _topoSnapshotWall + topoRender is
//        the migration shim called for in HANDOFF-BRIEF-19); no save
//        path serializes wall_state_history so saved games are
//        unaffected by the schema bump.
//
//   v66 — Replay-in-3D, finishing the job (May 2026, boss directive
//        "as real as you can make it"). Picks up the caveats v65
//        deliberately deferred:
//
//        Snapshot extension. wall_state_history snapshots now also
//        carry a `conditions` block: { temperature, pressure, pH,
//        flow_rate, vug_diameter_mm, total_dissolved_mm,
//        fluid_surface_ring, fluid: <full FluidChemistry clone> } plus
//        radiation_dose. Storage adds ~1 KB per snapshot (~200 KB for
//        a 200-step run) — small relative to the 384 KB the rings
//        already carry.
//
//        Fortress-status replay-mode. updateFortressStatus reads from
//        _topoReplayActiveSnap (set per replay frame in
//        99g-renderer-replay.ts) when the topo replay timer is running.
//        It builds a prototype-rooted shim over conditions + wall so
//        the supersaturation_<mineral> methods inherited from
//        VugConditions are still callable, but the σ pills are
//        computed against the snapshot's fluid + temperature. Step,
//        T, pressure, pH, vug diameter, radiation dose all rewind
//        with the cavity geometry.
//
//        Paramorph mineral rewind in renderer. For crystals that flipped
//        mineral mid-life (argentite → acanthite at 173 °C in
//        Round-8a; borax → tincalconite + mirabilite → thenardite via
//        dehydration), _topoSyncCrystalMeshes now treats the crystal
//        as its paramorph_origin when replayStep < paramorph_step.
//        This reaches the material lookup (class_color, klass-driven
//        metalness/roughness), the crystal signature (so cache busts
//        when crossing the transition step), and the hit-test
//        userData (tooltip mineral name).
//
//        Replay-step overlay. New top-center label in the topo panel
//        ("▶ replay step 76 / 150 · 240 °C · pH 6.4") gives the user
//        a clock for the replay timeline. Visible only while the
//        replay timer is running. Empty when conditions aren't in
//        the snapshot (legacy / pre-v66 in-memory state).
//
//        Drift: zero. Snapshot extension is data the engine doesn't
//        read; renderer changes are display-only. seed42_v66.json
//        regenerated from gen-js-baseline.mjs is byte-identical to v65.
//
//   v67 — Brief-19 mass-balance back-fill (May 2026, boss-flagged from
//        the v66 σ-pill replay revealing already-broken chemistry).
//        Six v64-era growth engines (atacamite, sylvite, greenockite,
//        hawleyite, powellite, turquoise) had no entry in
//        MINERAL_STOICHIOMETRY — `applyMassBalance` skipped them, so
//        their growth did not debit fluid composition (warnings printed
//        every baseline regen since v62-Cd, ignored until now). v67
//        adds the entries; growth now debits Cu/Cl/K/Cd/S/Ca/Mo/Al/P
//        on those six per the formulas in data/minerals.json.
//
//        Plus eight zero-drift hygiene entries for v64-era engines
//        that don't currently fire in any baseline scenario but will
//        when scenarios shift: apatite, calaverite, sylvanite, hessite,
//        naumannite, clausthalite, scheelite, wolframite. Each is a
//        per-formula-unit stoichiometry that mirrors data/minerals.json.
//
//        Drift expected: bisbee (atacamite), mvt + supergene_oxidation
//        (greenockite/hawleyite/powellite/atacamite/turquoise), sabkha
//        + searles_lake (sylvite). Cu / Cd / Ca / Mo / K / Al / P
//        debits cascade into downstream growth — malachite/chrysocolla
//        in supergene, feldspar in evaporites, etc. The mass-balance
//        warnings stop firing on the baseline regen.
//
//   v68 — Cavity-mesh Path C Tranche 4a (PROPOSAL-CAVITY-MESH §13).
//        Per-vertex chemistry replaces per-ring chemistry. Each cell on
//        the cavity mesh now carries an independent FluidChemistry
//        instance (post-un-aliasing in mesh.bindRingChemistry) and
//        evolves locally under crystal growth, mesh-edge Laplacian
//        diffusion, propagated event deltas, and vadose oxidation.
//
//        Why now: PROPOSAL-CAVITY-MESH §13 documents the boss directive
//        to pursue Path C ("foundation based on the science") over Path A
//        (rename) or Path B (3 named zones). Real cavity walls have
//        continuous chemistry varying with local fluid flow, drip
//        points, vent proximity; per-ring storage forced co-ring
//        crystals to share one pool.
//
//        Drift: every scenario. Behavior shifts because crystals no
//        longer share local Ca/SiO2/etc pools with co-ring siblings.
//        seed42_v68.json regenerated from gen-js-baseline.mjs; the
//        per-mineral counts and max-size values shifted from v67
//        across all 23 scenarios. Direction of shift varies — some
//        scenarios produce slightly more crystals (each ring is less
//        depleted locally), others fewer (per-vertex saturation
//        windows are narrower).
//
//        Cross-tranche context: Tranches 1-3 of Phase 4 (commits
//        93fcc2d, 8ef6a40, 7a5bb75) were byte-identical refactors
//        that built the cells[] container, the mesh-edge Laplacian,
//        and the fluid_surface_height_mm canonical name without
//        changing engine behavior. Tranche 4a is the first behavior-
//        shifting commit in the Path C sequence; SIM_VERSION bumps
//        here rather than waiting for the snapshot schema bump in
//        Tranche 5 (which will become v69 when it lands).
//
//        v68 also carries TWO independent merges from canonical/main
//        (StonePhilosopher branch, commits 5ecbb42 + 5740371):
//
//        (a) Mo-flux removal. The historical 15% effectiveTemperature
//            boost when Mo > 20 ppm was a simulation artifact — Mo
//            does NOT thermodynamically lower sulfide nucleation
//            barriers in natural hydrothermal systems. The cited
//            "MoO₃ flux for corundum growth" precedent is a LAB
//            crystal-growth technique (Knipovich / Czochralski flux
//            melt at 1100°C), not natural petrology. In real porphyry
//            deposits (Climax, Bingham, El Teniente) Mo + Cu + Pb
//            sulfides coexist because each nucleates in its own T
//            window independently. effectiveTemperature() now returns
//            this.temperature directly. Stale "Mo flux widens T window"
//            comments at the four call sites in 41-supersat-sulfide.ts
//            are cleaned up. Drift expected on porphyry / Mo-rich
//            scenarios (mvt, supergene, ouro_preto).
//
//        (b) Deccan Stage III SiO₂ pulse +300 → +600. The apophyllite
//            supersaturation gate is SiO2 >= 800 (39-supersat-silicate
//            .ts:51); after the v17 silica_equilibrium fix, background
//            quartz draws SiO2 down toward the per-T equilibrium
//            (~100 ppm at 130°C), so the old +300 pulse couldn't clear
//            the gate. +600 gives headroom. Per Ottens et al. 2019
//            this is the canonical Stage III chemistry of Nashik-style
//            "bloody apophyllite" Deccan vesicles. expects_species for
//            deccan_zeolite now declares apophyllite alongside hematite
//            + quartz.
//
//        See tests-js/boss-edits-audit.test.ts for the regression
//        contracts that pin both (a) and (b) — Mo-independence of
//        sulfide T windows + apophyllite gate clearance.
//
//   v69 — True 3D sphere-union cavity geometry (2026-05-11 boss spec).
//        WallState._buildProfile3D replaces _buildProfile as the
//        active cavity builder. Stage 1 = one primary sphere at
//        origin (radius R). Stage 2 = primary_bubbles secondaries
//        placed at random 3D points on the primary's surface, radius
//        [R/3, 2R/3]. Stage 3 = secondary_bubbles tertiaries on any
//        existing sphere's surface (host weighted by surface area),
//        radius [0.08R, 0.12R]. Each (ring, cell) raycasts its own
//        spherical direction into the sphere union for a unique
//        per-vertex base_radius_mm.
//
//        Why: pre-v69 _buildProfile generated 2D circles in the
//        equatorial plane, sampled the union at N theta angles, and
//        duplicated the same rawRadii[c] across every ring. Looking
//        down the pole-axis, all the lobes converged at the same
//        angular positions, producing the "laundry-bag silhouette
//        with everything meeting at one central point" the boss
//        flagged. 3D sphere-union math lets secondary bumps live at
//        arbitrary 3D directions, eliminating the vertical-column
//        artifact.
//
//        Polar Fourier + ring twist amplitudes are zeroed out in
//        v69 because the 3D base geometry already encodes per-cell
//        irregularity. polar_collapse (basin archetype sigmoid)
//        still applies on top.
//
//        Drift: cavity profile in every scenario shifts (different
//        wall radii per cell). Crystal nucleation positions and
//        habit-bias evaluation depend on cavity geometry, so
//        per-mineral counts and max sizes shift across the
//        seed42_v69.json calibration baseline. shape_seed still
//        controls reproducibility — same (scenario, seed) → same
//        sphere placements forever.
//
//   v70 — Path C cascade-gate audit, Arc 1 (2026-05-18).
//        Activity-correction copy-paste regression repair. The Phase 2b
//        sweep (eff8ec1, 2026-05-05) accidentally landed extra
//        activityCorrectionFactor calls on four supersaturation methods,
//        each suppressing σ by ~½× via stacked log γᵢ products from
//        unrelated minerals' stoichiometry:
//
//          supersaturation_adamite    × erythrite × annabergite (Co+Ni
//                                       arsenate factors stacked on a
//                                       Zn arsenate)
//          supersaturation_borax      × tincalconite (paramorph; identical
//                                       stoichiometry, so γ²·m² double-count)
//          supersaturation_galena     × pyrite × marcasite × sphalerite ×
//                                       wurtzite × chalcopyrite (six
//                                       factors on a PbS mineral)
//          supersaturation_stibnite   × tetrahedrite × tennantite (Cu-As/Sb
//                                       sulfosalt factors stacked on Sb2S3)
//
//        Surfaced by the cascade-gate audit (HANDOFF-CALIBRATION-AND-COVERAGE
//        section 12) while probing why native_arsenic + native_bismuth +
//        stibnite stay in the dead-list across 240 (scenario × seed) sweeps.
//        Cross-check tool grep'd every supersaturation_X for foreign
//        activityCorrectionFactor targets — only these four matched.
//
//        Direction: σ rises for galena (most-exercised mineral in the sim,
//        every MVT + Pb-bearing scenario), borax (sabkha + searles_lake +
//        evaporite playas), adamite (supergene_oxidation), stibnite
//        (porphyry — best σ 0.87 → 1.16, +32%, still under the 1.2 nuc
//        threshold but no longer mathematically pinned down). Bulk drift
//        on calibration baseline expected on Pb-Zn-Cu-S sulfide scenarios.
//        Proposal A's vugFill≥1.0 hard floor caps any overshoot.
//
//   v71 — Path C cascade-gate audit, Arc 2 (2026-05-18).
//        Native_arsenic + native_bismuth soft-cation-suppressor retune.
//        Both engines were structurally unreachable under bulk-view fluid
//        chemistry: `if (S > 10) return 0` for native_arsenic and
//        `if (S > 12) return 0` for native_bismuth, even though the canonical
//        five-element-vein scenario (schneeberg, S=30) expects both. 480
//        probe samples saw σ = 0.0 across all (seed × step) pairs.
//
//        Fix (Proposal-C/Backlog-K style — same pattern the native_tellurium
//        retune established):
//          - Drop hard upper S gate, replace with continuous suppressor
//              s_suppr = max(0, 1 - S / Sdenom)
//            (Sdenom: native_arsenic=60, native_bismuth=80 — calibrated so
//             schneeberg's S=30 yields meaningful suppression without going
//             to zero, while porphyry's S=60 stays gated out as expected).
//          - native_arsenic also drops hard `Fe > 50` upper gate, replaces
//            with fe_suppr = max(0, 1 - Fe / 200).
//          - native_bismuth lowers the `Bi < 15` lower gate to `Bi < 5`
//            (matches bismuthinite's lower gate — native_bismuth is
//            bismuthinite's paragenetic step-down).
//          - Tightened as_f / bi_f scaling denominators (15 ppm "saturation
//            unit" for residual-overflow phases vs. the previous 25-30 ppm
//            typical-hydrothermal scaling).
//          - Bumped native_bismuth nuc threshold from 1.4 → 1.0 (the 1.4
//            was an arbitrary outlier — every other native_X uses 1.0 or
//            1.2). Secondary-nucleation tier at >2.0 unchanged.
//
//        Scenario seeds bumped to literature-anchored ranges:
//          schneeberg.As: 15 → 60  (Förster 1992 Schneeberg fluid-inclusion
//                                   data: As 100-1000 ppm in arsenide-rich
//                                   phases. 60 is the conservative anchor.)
//          schneeberg.Bi: 10 → 40  (same paper: Bi 50-500 ppm. 40 is the
//                                   conservative anchor for the historic
//                                   Schneeberg ore type, which was MINED
//                                   for bismuth before its uranium era.)
//
//        Verification: probe shows native_arsenic σ_max 0.0 → 1.56 + ever-
//        nucleated YES; native_bismuth 0.0 → 1.35 + ever-nucleated YES.
//        Coverage moves 89 → 91 live, 27 → 25 dead minerals — the two
//        retuned natives both transitioning to live status.
//
//        Path C cascade-gate audit completes here for the dead-list
//        natives. Remaining structurally-suspect engines (stibnite —
//        marginal lift in Arc 1; native_silver / native_copper / native_sulfur
//        — flaky / scenario-dependent; corundum SiO2>50 gate; chromite
//        T>1000 gate) documented as known calibration work, not structural.
//
//   v72 — Schneeberg five-element vein broth gap-fill (2026-05-18).
//        Discovered while geology-auditing the Arc 2 deliverable (boss
//        prompt: "double-check the science"): Schneeberg's seed broth was
//        missing Co, Ni, and Ag — three of the FIVE elements that define
//        the "Fünfelementformation" (five-element formation) deposit
//        class Schneeberg is the type locality for. 10-seed schneeberg
//        sweep at v71 showed:
//
//          erythrite      0/10 firings  (cobalt bloom — Annaberg, the town
//                                        next to Schneeberg, is annabergite's
//                                        type locality, and erythrite was
//                                        the source of the 16th-century
//                                        "Saxon blue" pigment trade)
//          annabergite    0/10 firings  (nickel bloom — same)
//          acanthite      0/10 firings  (silver sulfide — Schneeberg was
//                                        Europe's primary SILVER source
//                                        from the 1100s-1500s, before its
//                                        bismuth + uranium eras)
//
//        Root cause: schneeberg.fluid had no Co, no Ni, no Ag at all.
//
//        Fix (data-only, no engine changes):
//          schneeberg.Co: 0 → 30  (Burkhardt et al. 2001 Erzgebirge fluid
//                                  inclusions: Co 5-50 ppm; 30 mid-range)
//          schneeberg.Ni: 0 → 20  (same: Ni 5-30 ppm; 20 mid-range)
//          schneeberg.Ag: 0 → 8   (canonical five-element-vein fluid Ag
//                                  range; enables acanthite + acanthite's
//                                  Ag2S pathway to naumannite)
//          schneeberg.expects_species: extended with native_bismuth,
//                                       native_arsenic, erythrite,
//                                       annabergite, cobaltite, nickeline.
//
//        Verification — 10-seed schneeberg sweep:
//          erythrite     0/10 → 10/10  ✓
//          annabergite   0/10 → 10/10  ✓
//          acanthite     0/10 → 10/10  ✓ (44 crystals)
//          autunite      5/10 → 7/10   ✓ (slot-competition rebalance)
//          torbernite    5/10 → 9/10   ✓
//          zeunerite     7/10 → 7/10   (more crystals: 12→21)
//          native_arsenic ratio dropped 53→17 µm avg as Co-Ni arsenides
//          began consuming the As budget — exactly Förster & Tischendorf
//          1989's "native_arsenic is a minor accessory to Co-Ni arsenides"
//          paragenesis. The Arc-2 σ overshoot self-corrected.
//
//        Boss principle captured: "when you follow nature everything should
//        just fall into place unless there is a variable we have missed."
//        The "missed variable" was three elements absent from a deposit
//        class defined by FIVE elements.
//
//        Remaining schneeberg dormants documented as future work:
//          - native_silver: hard `S > 2` gate (same Path C structural
//            pattern as native_arsenic — next cascade-gate audit target)
//          - cobaltite: Co<50 lower gate (Schneeberg Co=30; geological
//            scaling honest)
//          - nickeline: Ni<40 lower gate (Schneeberg Ni=20; same)
//          - naumannite: σ formula too lax (Ag=8 Se=2 → σ≈0.13 vs 1.3
//            threshold; calibration, not structural)
//   v73 — Path C cascade-gate audit, Arc 3 (2026-05-18).
//        Closes the next-iteration cascade-gate target list from
//        HANDOFF-CASCADE-GATE-AUDIT.md §5. Two-track work in one commit:
//
//        Track A — structural softening (same Path C pattern as Arc 2):
//          native_silver: drop hard `S > 2` gate, soft s_f at /50, ag_f
//                         cap 3.0 → 4.0, nuc threshold 1.2 → 1.0
//          native_copper: drop hard `S > 30` gate, soft s_f at /60
//                         (floor 0.3 → 0.0)
//
//        Track B — calibration tier (bulk-view-as-proxy-for-local):
//        The σ scaling denominators were calibrated against fluid-inclusion
//        bulk measurements, but the precipitating cell is typically 3-5×
//        more enriched. Same Path C philosophy as Arc 2's gate softening,
//        applied to scaling denominators instead of gates. Divide by 3.
//          cobaltite:  lower gates Co<20/As<30/S<20 (was 50/100/50);
//                      tighten Co/25 × As/35 × S/25 (was /80 × /120 × /80)
//          nickeline:  lower gates Ni<15/As<30 (was 40/40);
//                      tighten Ni/15 × As/30 (was /60 × /80)
//          naumannite: tighten Ag/6 × Se/1.5 (was Ag/30 × Se/5);
//                      σ at Schneeberg Ag=8 Se=2 goes 0.13 → 1.78
//          stibnite:   nuc threshold 1.2 → 1.0 (matches sibling sulfides)
//
//        Verification — 10-seed schneeberg sweep (geology_check):
//          native_silver   7/10 → 6/10  (slot competition slight shift)
//          cobaltite       0/10 → 10/10  ✓ (40 crystals @ 861µm avg)
//          nickeline       0/10 → 10/10  ✓ (40 crystals @ 1392µm avg)
//          naumannite      0/10 → 6/10   ✓
//          native_arsenic  6/10 → 3/10   (further self-correction — now
//                                          even more "minor accessory"
//                                          per Förster & Tischendorf 1989
//                                          as Co-Ni arsenides take their
//                                          full share of the As budget)
//
//        Coverage: 91 → 95 live, 23 → 21 dead, 0 stale (cobaltite +
//        nickeline cleared their stale flag from v72).
//
//        Path C cascade-gate audit closes here for ALL of HANDOFF-CASCADE-
//        GATE-AUDIT.md §5's targets EXCEPT native_sulfur, which has a
//        non-standard pattern (pH and metal_sum upper gates, neither a
//        depleting species in bulk view; no canonical scenario fires it).
//        Deferred until a fumarole / sulfide-weathering-rind scenario
//        lands that has the right (high-S, low-metal, acidic) signature.
//   v74 — Proposal B: habit transitions on fill × σ (2026-05-18).
//        First proposal from the high-fill physics thread to land
//        AFTER the Path C cascade-gate audit closed. Companion to
//        Proposals A (sigmoid dampener, v69-or-earlier) and C
//        (late_stage_propensity gradient, v69).
//
//        selectHabitVariant() gains a 5th `localFill` parameter; habit
//        variant `trigger` strings now match against "high fill" /
//        "high-fill" / "drusy" / "post-seal" / "low fill" / "low-fill"
//        keywords. Score bonuses:
//          - "post-seal" trigger:  +2.0 if fill > 0.95, else -1.5
//          - "high fill" / "drusy": +1.5 if fill > 0.75, else -1.0
//          - "low fill":           +0.6 if fill < 0.7,  else -0.4
//
//        Three NEW habit variants added (all `vector: "coating"` for the
//        space-constrained late-stage carpet pattern):
//          calcite.druzy_crust
//            — Brazilian amethyst "skunk calcite" late euhedral overgrowths
//              per Proust & Fontan 2007
//          quartz.microcrystalline
//            — chalcedony / agate carpet, boundary-layer-diffusion-limited
//              microcrystalline SiO2 at late stage
//          aragonite.botryoidal_crust
//            — speleothem "cave coral" botryoidal habit
//
//        Three EXISTING variants got their triggers extended with "high
//        fill" keywords (no behavioral change at low fill, more probable
//        at high fill):
//          halite.hopper_growth   — Tanaka 2018 hopper geometry under DLA
//          sylvite.hopper_cube    — same mechanism
//          borax.cottonball       — Death Valley playa-surface texture
//        And halite.fibrous_coating gained "high fill" alongside its
//        existing "efflorescent" trigger.
//
//        Backward compat: legacy 4-arg callers (library preview, Three.js
//        renderer) pass undefined localFill — the new scoring branch is
//        skipped, picks identical to pre-Proposal-B behavior.
//
//        RNG sequence unchanged: the variant selection still consumes
//        exactly one rng.random() call regardless of which variant scores
//        highest. Calibration baseline seed42_v73.json byte-identical
//        to seed42_v74.json (no baseline regen needed) — habit names
//        shift at high fill but mineral counts + crystal sizes don't.
//
//        Wired by: js/85d-simulator-step.ts stashes vugFill on the sim
//        as this._currentVugFill; js/85b-simulator-nucleate.ts passes
//        it through to selectHabitVariant.
//
//        Refs: proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md §5 (Proposal B
//        spec), §6 (Recommended path: Tier 2). Boss principle composing
//        in: "follow nature" — high-fill texture transitions are the
//        observable downstream of the boundary-layer-diffusion regime
//        that Proposal A's sigmoid dampener encoded in the σ formula.
//   v75 — Proposal D: interlocking textures + single-zone volume clamp
//        (2026-05-18). Closes the high-fill physics arc; only Proposal E
//        (per-cell local fill) remains from the original A/B/C/D/E set.
//
//        Two fixes in the growth loop (js/85-simulator.ts):
//
//        Part 1 — per-iteration dampener recomputation. Pre-D the growth
//        loop used this._fillDampener (stashed once per step by
//        check_nucleation at step-start vugFill). That worked for
//        nucleation (single decision per step) but let the growth loop's
//        crystals each use a stale dampener: step-start vugFill=0 →
//        dampener=1.0 → all crystals grow at full rate within the step
//        even as currentFill rose toward seal. Replaced with
//        _fillDampenerFor(currentFill) computed per-iteration. Drops
//        gem_pegmatite multi-step peak ~5% (the rest of its overshoot
//        is a pre-existing habit-oscillation bug, see below).
//
//        Part 2 — single-zone volume clamp. Even with per-iteration
//        dampening, a single crystal entering the loop at currentFill=0
//        sees dampener=1.0 and can grow enough in one zone to push the
//        cavity past seal. Sabkha step 1 was this case: 14 crystals
//        nucleated, first crystal grew unbounded, step-end vugFill =
//        2.5×. The clamp computes the projected ellipsoid volume delta
//        before add_zone and limits zone.thickness_um so the delta can't
//        exceed (1.0 - currentFill) × cavity_volume. Tagging:
//        crystal.late_interlocking = true when the clamp engages.
//
//        Bookkeeping note: clamping zone.thickness_um reduces BOTH the
//        geometric extension AND the fluid-ion debit. This matches the
//        post-seal geological reality where fluid flux stops anyway
//        (pressure builds, host rock fractures, or cavity goes
//        impermeable). Pure "ions consumed but no geometry" — the
//        original Proposal D phrasing — would require splitting
//        total_growth_um into chemistry-counter + geometry-counter
//        fields. The single-field clamp captures 90% of the geological
//        story; future Proposal E (per-cell local fill) can revisit if
//        the texture-vs-chemistry decoupling matters for downstream
//        analysis.
//
//        Late-interlocking tag is also set when currentFill ≥ 0.85 AND
//        dampener < 1.0 (the boundary-layer-diffusion regime that
//        Proposal A's sigmoid encoded). Three.js renderer can use this
//        flag to apply granular / massive texture for Tsumeb late-stage
//        patina or Naica selenite cluster-surface effects.
//
//        Verification — high_fill_probe peak vugFill before/after:
//          scenario              pre-D     post-D
//          sabkha_dolomitization 2.517 →   1.000 ✓ (single-zone fix)
//          naica_geothermal      1.004 →   1.000 ✓
//          searles_lake          1.008 →   1.001 ✓
//          supergene_oxidation   1.000 →   1.000 (already clean)
//          gem_pegmatite         7.462 →   5.751 (residual = habit-
//                                                  oscillation bug)
//          radioactive_pegmatite 4.117 →   4.066 (residual = same bug)
//
//        Residual finding (pre-existing, NOT Proposal D scope):
//        get_vug_fill computes ellipsoid volume from crystal.habit's
//        aspect ratio. Growth engines (e.g. js/50-engines-arsenate.ts)
//        override crystal.habit each step based on σ. A single crystal
//        oscillating between habit='tabular' (aRatio=1.5, vol coeff
//        1.178) and habit='prismatic' (aRatio=0.4, vol coeff 0.0838)
//        swings get_vug_fill by 14× for that crystal. Same total_growth
//        _um, different volume interpretation. Documented as future
//        work for a habit-stability proposal.
//
//        Calibration baseline drift: 7 of 24 scenarios shift (sabkha,
//        naica, searles, supergene, gem_pegmatite, radioactive_pegmatite,
//        stalactite_demo — the ones that approach seal). Direction:
//        crystals get smaller at the seal threshold (correct — the
//        clamp prevents geometrically-impossible oversizing).
//   v76 — Habit-stability fix: zone-integrated volume (2026-05-18).
//        Closes the residual gem_pegmatite (5.75×) and radioactive_pegmatite
//        (4.07×) overshoots from Proposal D — both ARE now sealed at
//        exactly vugFill = 1.000. Every high-fill scenario across the
//        24-scenario sweep now seals cleanly.
//
//        The bug: get_vug_fill computed each crystal's ellipsoid volume
//        from (total_growth_um, current crystal.habit). Growth engines
//        (e.g. js/50-engines-arsenate.ts:233+237, js/52-engines-carbonate.ts:650,
//        js/55-engines-molybdate.ts:33+117) override crystal.habit each
//        step based on σ / zone count / rng. A single crystal flipping
//        between habit='tabular' (aRatio=1.5, vol coeff (π/6)×2.25=1.178)
//        and habit='prismatic' (aRatio=0.4, vol coeff (π/6)×0.16=0.0838)
//        swung get_vug_fill by 14× for that crystal — same total_growth_um,
//        different volume interpretation. Same mineral mass, wildly
//        different cavity-fill calc.
//
//        Fix (zone-integrated volume): each zone's contribution to the
//        crystal's volume is locked in at deposition time at the habit's
//        aRatio AS-OF-THAT-ZONE. Crystal._volume_mm3 accumulates these
//        shell contributions incrementally:
//
//          For a positive zone with habit aRatio r and shell c-range
//          [c_old, c_new]:
//            V_shell = (π/6) × r² × (c_new³ - c_old³)
//            crystal._volume_mm3 += V_shell
//
//          For a dissolution zone (c shrinks):
//            crystal._volume_mm3 *= (c_new / c_old)³
//
//        get_vug_fill simply sums crystal._volume_mm3 across active
//        crystals — no reinterpretation through current habit. The
//        single source of truth lives on the crystal, frozen as growth
//        deposits it. Geologically: this is what real zoned crystals
//        look like — each growth zone has its own habit shape, and the
//        total volume integrates over zones.
//
//        Shared helpers (js/27-geometry-crystal.ts):
//          _habitAspectRatio(habit) → number
//          _habitVolCoeff(aRatio) → number = (π/6) × aRatio²
//
//        Both add_zone (Crystal method) AND the Proposal D growth-loop
//        clamp (js/85-simulator.ts) now use these single-source helpers.
//        Previous duplicated tables across 27-geometry, 85-simulator,
//        and 85c-simulator-state are consolidated.
//
//        a_width_mm is also stabilized: derived from _volume_mm3 and
//        c_length_mm via a = sqrt(6V / (π × c)). Renderer sees a width
//        consistent with the crystal's growth history, not the latest
//        habit's flip. Legacy fallback when _volume_mm3 == 0.
//
//        Backward compat: get_vug_fill checks for `c._volume_mm3` and
//        falls back to the old ellipsoid calc for legacy crystals
//        (snapshots, tests) that predate this field.
//
//        Verification — tools/high_fill_probe.mjs peaks:
//          scenario              pre-v76    post-v76
//          gem_pegmatite         5.751   →  1.000  ✓
//          radioactive_pegmatite 4.066   →  1.000  ✓
//          sabkha_dolomitization 1.000   →  1.000  ✓
//          naica_geothermal      1.000   →  1.000  ✓
//          searles_lake          1.001   →  1.000  ✓
//          supergene_oxidation   1.000   →  1.000  ✓
//
//        Every scenario in the 24-scenario sweep now peaks at ≤ 1.000.
//        The simulator can no longer report fill > 1.0 — what was a
//        bookkeeping artifact is now structurally impossible.
//
//        Calibration baseline drift: 4 scenarios (gem_pegmatite,
//        radioactive_pegmatite, searles_lake, supergene_oxidation).
//        The other 20 scenarios are byte-identical because their fill
//        stays well below the regime where habit oscillation mattered.
//   v77 — Proposal E: per-cell local fill (2026-05-18). Closes the
//        high-fill physics arc completely (Proposals A + B + C + D
//        landed v74-v76; E is the deferred Tranche 7 from
//        RESEARCH-GROWTH-AT-HIGH-FILL.md §5 — "the marginal final 20%
//        that handles corners stay open while edges fill").
//
//        Geological motivation: Nature Communications 2022
//        ("Crystal growth in confinement") showed that confined-
//        geometry crystal growth has concentration gradients between
//        edges and centers — corners stay open while edges fill. The
//        pre-v77 simulator averaged over this heterogeneity via a
//        single get_vug_fill() reading; v77 restores per-cell locality
//        for the boundary-layer-diffusion dampener.
//
//        Mechanism — three pieces:
//
//          1. WallCell._localCrystalVol_mm3 — accumulates the volume
//             contribution (mm³) of every crystal whose footprint
//             covers this cell. Reset to 0 by WallState.clear() each
//             step, repainted by WallState._paintCrystalVolume.
//
//          2. WallState._cellCavityVolMm3(r) — polar-bias-weighted
//             per-cell cavity-volume budget. Sums to (4/3)πR³ across
//             all (r,c) pairs. sin(phi_r) weighting from the existing
//             ringAreaWeight matches the engine's nucleation weighting.
//
//          3. WallState.getCellLocalFillForCrystal(c) — resolves the
//             crystal's anchor cell and returns _localCrystalVol_mm3
//             / cellCavityVol at that cell. Used by the growth-loop
//             dampener in 85-simulator.ts when wall.per_cell_local_fill
//             is true (opt-in; default false → byte-identical to v76).
//
//        Opt-in design: scenarios opt in via
//        conditions.wall.per_cell_local_fill = true. When off:
//          * _paintCrystalVolume is never called → cells stay at
//            _localCrystalVol_mm3 = 0.
//          * Growth-loop dampener reads currentFill (global) as before.
//          * Every existing scenario produces byte-identical output.
//
//        When on:
//          * _paintCrystalVolume runs alongside paintCrystal in
//            _repaintWallState — same footprint geometry, distributes
//            crystal._volume_mm3 / span across (2 × halfCells + 1)
//            cells.
//          * Growth-loop dampener reads the crystal's anchor-cell
//            local fill. Falls back to currentFill when localFill = 0
//            (fresh nucleation, painter hasn't run yet) — the Proposal D
//            volume clamp is the safety net for that single-step
//            window.
//
//        A/B results (manual flag injection on 6 high-fill scenarios,
//        seed 42; throwaway probe deleted post-analysis):
//
//          scenario               A.global  B.local  B.crystals/A
//          ---------------------------------------------------------
//          sabkha                 1.000     1.000    same (10)
//          naica_geothermal       1.000     0.018    +21 → 43 (2×)
//          searles_lake           1.000     0.904    69 → 10 (~7×)
//          supergene_oxidation    1.000     0.049    60 → 77 (+28%)
//          gem_pegmatite          1.000     0.119    16 → 29 (+81%)
//          radioactive_pegmatite  1.000     0.071    32 → 36 (+12%)
//
//        Pattern: B (per-cell) tends to produce MORE, SMALLER crystals
//        at low global fill (corners stay open → more nucleation
//        seats), or FEWER, BIGGER crystals when the dampener's local
//        cap throttles the leading edge so chemistry concentrates on
//        the few crystals that already exist. Both directions are
//        geologically valid; the choice depends on the scenario.
//
//        Calibration baseline drift: NONE — no scenarios are opted in
//        at v77. The flag is dormant scaffolding; future commits opt
//        in specific scenarios with their own SIM_VERSION bump.
//
//        Tests: 263 → 284 (+21 new pins in tests-js/per-cell-local-fill
//        .test.ts):
//          * Opt-in flag defaults to false; WallCell._localCrystalVol_mm3
//            starts at 0; clear() resets it.
//          * _cellCavityVolMm3 sums to cavity volume across (r,c);
//            equator > pole; scales with diameter³.
//          * _paintCrystalVolume: mass conservation (sum of painted
//            volume = crystal._volume_mm3), peak at anchor cell, wider
//            footprint spreads thinner.
//          * getCellLocalFill: returns 0 for empty cells, out-of-range
//            indices return 0 without throw, anchor resolution.
//          * End-to-end: flag off preserves byte-identical sabkha seal
//            behavior; flag on completes without throw; painter is
//            actually called when on; "corners stay open" property
//            (cell-fill heterogeneity > 1.5× spread).
//   v78 — Architecture audit follow-ups (2026-05-18). Six scenarios
//        had wrong default cavity geometry, flagged in
//        HANDOFF-HIGH-FILL-ARC-COMPLETE.md §5 "Architecture audit
//        follow-ups from 1541f70". Each fix is one architecture field
//        in data/scenarios.json5; geology-correctness, not engine code:
//
//          scenario              before    after       why
//          ---------------------------------------------------
//          stalactite_demo       pocket    irregular   karst cave (Carlsbad/Lechuguilla/Mammoth)
//          zoned_dripstone_cave  pocket    irregular   composite karst (Frasassi/Carlsbad/Reed Flute)
//          supergene_oxidation   default*  irregular   Tsumeb 1st-stage gossan (deeply weathered)
//          colorado_plateau      default*  irregular   sandstone-hosted roll-front (Morrison Fm)
//          porphyry              default*  tabular     fracture-controlled veins (Bingham Canyon)
//          schneeberg            default*  tabular     five-element vein, Walpurgis Flacher
//
//        * Scenarios with no explicit `architecture` field used the
//          'pocket' default from VugWall constructor. Now explicit.
//
//        Behavior shift: the 4 irregular changes (stalactite_demo,
//        zoned_dripstone_cave, supergene_oxidation, colorado_plateau)
//        are byte-identical because:
//          * polar_amp_scale / twist_amp_scale get zeroed post-
//            _buildProfile3D (the 3D builder encodes per-cell variance
//            directly; polar amps were the 2D-extruded workaround).
//          * nucleation_bias stays 'uniform'.
//          * primary/secondary bubble counts left at scenario-tuned
//            overrides (3/7, 4/8, 2/4, 2/4) — irregular defaults to
//            4/12 but the overrides win.
//          → irregular vs pocket archetype is a NO-OP for these four.
//            The change is documentational — declaring intent so the
//            scenario reads correctly as "this is a karst cave / gossan
//            / roll-front, not a smooth pegmatite pocket."
//
//        The 2 tabular changes (porphyry, schneeberg) activate the
//        elongation field (0.0 → 0.55) and nucleation_bias change
//        (uniform → walls_only). This DOES shift output:
//
//          porphyry:   5 minerals shift by < 1% (max_um sub-permille
//                      noise). Same species, same counts. The tabular
//                      stretch + walls_only bias rebalances cell-anchor
//                      assignments but doesn't change crystal totals.
//          schneeberg: cleaner drift in the geologically-correct
//                      direction:
//                        + zeunerite (the SCHNEEBERG TYPE LOCALITY
//                          mineral — 1872 type) becomes active. The
//                          flat-tabular vein archetype puts crystals on
//                          the wall faces where uranyl arsenates
//                          actually grow IRL.
//                        - autunite, scorodite drop (both were marginal
//                          uranyl phosphate / Fe-arsenate hits that
//                          competed for the same site).
//                        + annabergite becomes active (Co-Ni arsenate,
//                          another Schneeberg signature).
//                        * smaller mean crystal sizes (tabular = less
//                          radial room than pocket; geologically right
//                          for a vein-hosted slot vs a pegmatite pocket).
//
//        Coverage: still 95 live / 21 dead — no minerals went stale.
//
//        Why this matters: cavity archetype is the geology-side
//        encoding of "what kind of opening does this fluid system
//        deposit into." Real Schneeberg veins look NOTHING like
//        pegmatite pockets — they're slot-like fissures with crystals
//        on the wall faces. Picking the right archetype propagates to
//        the renderer (tabular cavity geometry visible in the 3D
//        view), the engine (walls_only nucleation), and the player's
//        mental model.
//   v79 — Sulphur Bank Mine scenario (2026-05-18). The first scenario
//        that fires the native_sulfur engine to completion. The
//        engine has existed since v8 (Round 8b, "Native element
//        trio" — native_arsenic, native_sulfur, native_tellurium)
//        but native_sulfur had no canonical scenario — the gates
//        (S ≥ 100, O₂ ∈ [0.1, 0.7], pH ≤ 5, metal_sum ≤ 100, T 20-95°C)
//        match acid-sulfate hot-spring deposits, which the simulator
//        hadn't yet anchored. Sulphur Bank fixes that.
//
//        Anchor: Sulphur Bank Mine, Lake County, CA. Pleistocene
//        hot-spring mercury-sulfur deposit; mined 1865-1957; EPA
//        Superfund site CAD980893275. The canonical "hot-spring
//        quicksilver-sulfur" deposit per White & Roberson 1962
//        (USGS PP 432-A). Active hot springs still vent today.
//
//        Mechanism: 2 H₂S + O₂ → 2 S° + 2 H₂O (synproportionation)
//        in the acid mixing zone where rising H₂S-rich fluid meets
//        atmospheric O₂. Byproduct H₂SO₄ keeps pH at 1.8-4.0.
//
//        Engine fit:
//          initial: S=500, pH=1.8, O₂=0.40 (peak of nativeRedoxTent),
//                   T=75°C (mid-window), metal_sum=35 (well below cap).
//          wall:    composition='basalt' (silicate inert under acid —
//                   if this were limestone, dissolve() would buffer
//                   pH up and shut off the engine), architecture=
//                   'irregular' (acid-dissolution cavity in altered
//                   sediments).
//
//        13 events over 200 steps: alternating H₂S recharge (acidifies,
//        replenishes S) and surface_oxidation (locks O₂ at 0.40 peak,
//        further acidifies), bracketed by two cooling events that
//        push T below 60°C so the engine switches to the iconic
//        α-bipyramidal habit. The event frequency is calibrated so
//        the ambient_cooling pH-recovery clause (+0.01-0.03 pH/step
//        at low flow_rate) doesn't drift pH above the engine's gate
//        during the run.
//
//        Verified output (3 seeds × 200 steps):
//          peak σ_native_sulfur = 2.49-2.79
//          native_sulfur crystals = 4 active per run (all bipyramidal_alpha)
//          paragenesis: native_sulfur + pyrite + marcasite +
//                       arsenopyrite + quartz + selenite (the SO₄ from
//                       synproportionation reacts with trace Ca to
//                       form selenite — geologically defensible).
//
//        3 new event handlers in js/70m-sulphur-bank.ts:
//          event_sulphur_bank_h2s_recharge      — hot fluid pulse,
//                                                 S+150, pH-1.0, T+8.
//          event_sulphur_bank_surface_oxidation — O₂ pins to 0.40,
//                                                 pH-0.5.
//          event_sulphur_bank_cooling           — T-20, flow_rate=0.1.
//
//        Coverage: 95 live + native_sulfur (newly lit). The 95-live
//        count technically stays the same (native_sulfur was already
//        "live" via the mineral_coverage_check tool's broader
//        definition); it's just that THIS commit is the first to
//        actually nucleate it in a canonical scenario.
//
//        Followup: Sicily (Cianciana, Caltanissetta) is the OTHER
//        canonical native-sulfur deposit type — sedimentary BSR
//        sulfur from gypsum reduction in alkaline (pH 7-8) Messinian
//        evaporite brines. The engine's pH ≤ 5 gate blocks Sicily;
//        a future commit will broaden the engine to admit alkaline-
//        BSR sulfur as a second valid mode.
//   v80 — Sicily scenario + native_sulfur engine broadening
//        (2026-05-18, same day). Closes the v79 followup.
//
//        Engine change in js/36-supersat-native.ts
//        supersaturation_native_sulfur:
//          * pH gate: pH > 5 → return 0  broadened to  pH > 6.5 → return 0.
//          * ph_f factor: monotonic
//              ph_f = max(0.4, 1.0 - 0.15 × pH)
//            replaced with bimodal max:
//              ph_acid = max(0, 1.0 - 0.30 × |pH - 2.5|)
//              ph_bsr  = max(0, 1.0 - 0.50 × |pH - 6.0|)
//              ph_f    = max(ph_acid, ph_bsr)
//          * Floor dropped from 0.4 to 0.0 — the valley between modes
//            (pH ≈ 4) is geologically the WORST regime for S°
//            (too alkaline for acid synprop, too acid for BSR mode).
//
//        Backward compat: Sulphur Bank (pH 1.8) ph_f shifts 0.73 → 0.79
//        (slight σ boost). Calibration drift: sub-percentile shift in
//        sulphur_bank baseline; the 22 sulphur-bank pin tests still
//        pass without change.
//
//        New scenario sicily_solfifera. Anchor: Cianciana / Caltanissetta
//        district, Agrigento province. Solfifera Series (Messinian,
//        6-5.3 Ma). The world's primary sulfur production center
//        1860s-1950s; type for sedimentary BSR per Ziegenbalg et al.
//        2010 (Sedimentary Geology) + Manzi et al. 2009.
//
//        Mechanism: bacterial sulfate reduction of Messinian gypsum
//        at depth → H₂S + CaCO₃; Pleistocene meteoric O₂ infiltration
//        in upper meters → synproportionation H₂S + ½O₂ → S° + H₂O.
//        Co-products: calcite, residual selenite, celestine from
//        gypsum-derived Sr.
//
//        Initial fluid: T=30°C, pH=6.0 (BSR-peak), O₂=0.40 (synprop
//        peak), S=400, Ca=600, CO₃=80, Sr=30. wall.composition =
//        limestone (Sicily IS hosted in calcite/gypsum matrix;
//        reactivity 0.5 for gentle buffering to hold pH at 6.0).
//
//        4 new event handlers in js/70n-sicily.ts (gypsum dissolution,
//        meteoric O₂ infiltration, carbonate buffering, late
//        synproportionation). 10 events over 200 steps.
//
//        Verified output (3 seeds × 200 steps):
//          peak σ_native_sulfur = 3.48 (well above 1.0)
//          native_sulfur crystals = 1-3 active per seed
//          habit: bipyramidal_alpha (the iconic Sicilian {111}
//                 dipyramid form — geologically correct)
//          paragenesis: native_sulfur + selenite + celestine + halite
//                       + quartz + fluorite (Sicily documented for
//                       all of these)
//
//        Calibration: seed42_v80.json adds sicily_solfifera entry +
//        captures Sulphur Bank's slight σ boost. Other 24 scenarios
//        byte-identical to v79.
//
//        Coverage: native_sulfur now fires in TWO canonical scenarios
//        (Sulphur Bank acid-sulfate hot-spring; Sicily sedimentary
//        BSR-near-surface). The native_sulfur item from the v76 open
//        backlog is now FULLY CLOSED across both real-world deposit
//        types.
//
//        Geological note: Sicily IS the world's classic native-sulfur
//        deposit. Industrial sulfur production was DOMINATED by
//        Sicilian fields from 1860 to 1950, with Cianciana alone
//        producing ~2 Mt elemental sulfur. The simulator now models
//        the deposit type properly — not by tuning Sulphur-Bank-style
//        conditions to barely fit a hot-spring engine, but by
//        teaching the engine the OTHER mechanism (BSR-near-surface
//        synproportionation in alkaline-buffered porewater). The
//        boss's directive ("add the real science needed for Sicily")
//        cashed out: the broadened pH factor is the real chemistry
//        of two-mode native_sulfur deposition.
//   v81 — Cinnabar (HgS): the Sulphur Bank namesake commodity
//        (2026-05-18). The deposit at Lake County was MINED FOR
//        MERCURY 1865-1957 (~450 tons of Hg, ~13,000 flasks). The
//        v79 scenario fired native_sulfur but had no cinnabar engine
//        — the simulator was modeling Sulphur Bank's BYPRODUCT
//        without its main product. v81 fixes that.
//
//        New mineral: cinnabar (HgS), trigonal mercury sulfide. Deep
//        cochineal red, specific gravity 8.0-8.2 (the highest of
//        common ore minerals). Type locality Almadén (Spain, mined
//        for 2000+ years). Pigment 'vermillion' is synthetic
//        cinnabar.
//
//        Engine in js/41-supersat-sulfide.ts +
//        js/61-engines-sulfide.ts:
//          * Gates: Hg >= 1.0, S >= 50, O2 <= 1.0, pH <= 9.
//          * σ formula: hg_f × s_f × eh_f × T_factor × activity.
//            hg_f = min(Hg/5, 4.0); s_f = min(S/100, 3.0).
//          * Habit dispatcher:
//              excess > 1.5  → massive_red (vermillion aggregate)
//              T < 100°C     → rhombohedral_cochineal (deep red
//                              rhombs — the iconic Sulphur Bank /
//                              Almadén habit)
//              T >= 100°C    → rhombohedral_cochineal (high-T form)
//          * Dissolution branch: O2 > 1.3 fires oxidative sublimation
//            (HgS → Hg° vapor + SO₄²⁻). Acid-resistant under normal
//            vug pH (the reason cinnabar persists in oxidation zones
//            while other Hg minerals weather away).
//
//        Supporting work:
//          * FluidChemistry: new this.Hg field (default 0).
//          * MINERAL_STOICHIOMETRY.cinnabar = { Hg: 1, S: 1 } so
//            applyMassBalance debits per zone (per-cell at the
//            crystal's anchor footprint).
//          * MINERAL_DISSOLUTION_RATES.cinnabar for oxidative path.
//          * Nucleation handler _nuc_cinnabar with substrate
//            preference: native_sulfur (40%) > quartz (30%) > wall.
//            Models the real co-deposition pattern at Sulphur Bank.
//          * data/minerals.json entry with formula, habits,
//            T-range, color rules, literature anchor.
//
//        Sulphur Bank scenario update:
//          * initial fluid: Hg=15 ppm (White & Roberson 1962
//            measured-vent range 0.5-50 ppm).
//          * expects_species: + cinnabar.
//          * description updated to highlight cinnabar as headline.
//
//        Verified output (3 seeds × 200 steps at Sulphur Bank):
//          peak σ_cinnabar = 5.61 (well above 1.0 threshold)
//          cinnabar crystals = 6 active per seed
//          habit: massive_red (high σ at hot vent) + some
//                 rhombohedral_cochineal in cooler phases
//          substrate: cinnabar nucleates on native_sulfur and
//                     quartz substrates as expected (per-seed
//                     stochastic; the integration pin confirms
//                     the on-substrate placement across 3 seeds)
//
//        Tests 346 → 365 (+19 in tests-js/cinnabar.test.ts):
//          * FluidChemistry.Hg default + opts.
//          * supersaturation_cinnabar gates (Hg < 1 returns 0,
//            S < 50 returns 0, O2 > 1.0 returns 0).
//          * Sulphur-Bank-style fluid fires σ > 2.0.
//          * Sicily-style fluid (alkaline, cooler) ALSO fires
//            σ > 1.0 — proves cinnabar fits across both native_sulfur
//            deposit types (broad pH tolerance is what makes cinnabar
//            unusual among sulfides).
//          * Sulphur Bank integration: 3-seed firing pin, >= 4
//            active cinnabar crystals, canonical habit firing.
//          * Substrate-preference pin: cinnabar nucleates on
//            native_sulfur across 3 seeds.
//
//        Coverage: 96 live (+1 cinnabar) / 21 dead / 0 stale.
//        Calibration baseline: seed42_v81.json captures Sulphur Bank
//        with cinnabar fired; other 25 scenarios byte-identical to v80.
//
//        Future scenarios for cinnabar (out of scope for v81):
//          * Almadén (Spain, type locality, mined 2000+ years).
//            Different mechanism — hot acid Cretaceous vent on a
//            Hercynian shear zone.
//          * Idria (Slovenia). Hot-spring + pegmatite-related.
//          * New Almaden (CA). Pleistocene hot-spring analog of
//            Sulphur Bank; the simulator could reuse the Sulphur
//            Bank events with different fluid trace metals.
//   v82 — Realgar (AsS) + Orpiment (As₂S₃): the As-sulfide pair
//        (2026-05-19). White & Roberson 1962 documents both as
//        accessory species at Sulphur Bank; v81 had no engines for
//        either. Closes the As-sulfide gap with the classic
//        co-deposition pair.
//
//        Both minerals are LOW-T hot-spring + epithermal phases —
//        the same depositional environment as native_sulfur and
//        cinnabar. The σ engines fire in the same Sulphur Bank
//        chemistry, plus orpiment can also fire in Carlin-type
//        gold deposits (Getchell, Twin Creeks) and Allchar-type
//        Tl-As assemblages. Major modern producer of both is
//        Shimen / Hunan, China.
//
//        REALGAR (AsS) — α-realgar, monoclinic. Orange-red,
//        resinous luster. Engine in js/41-supersat-sulfide.ts +
//        js/61-engines-sulfide.ts:
//          Gates: As >= 5, S >= 30, pH <= 9 (alkali destabilizes),
//                 sulfide-redox-anoxic threshold 1.2 (more O₂-
//                 tolerant than arsenopyrite).
//          σ formula: as_f × s_f × eh_f × T_factor × activity.
//            as_f = min(As/15, 3.0); s_f = min(S/100, 3.0).
//          T optimum 50-180°C (matches Sulphur Bank vent regime).
//          Habit dispatcher:
//            T >= 100 + excess > 1.5  → sublimation_crust_red
//                                       (Yellowstone Norris habit)
//            excess > 1.2             → granular_orange (massive ore)
//            else                     → prismatic_red (Allchar /
//                                       Shimen iconic habit)
//          Photo-stable in the simulator (the slow UV pararealgar
//          conversion is documented in the mineral spec but not
//          run-time modeled — museum-curation problem, not vug
//          chemistry).
//
//        ORPIMENT (As₂S₃) — golden-yellow monoclinic. Engine
//        parameters parallel realgar's but slightly higher thresholds
//        (As₂S₃ formula needs more S per As than AsS):
//          Gates: As >= 8 (vs realgar's 5), S >= 50 (vs 30),
//                 pH <= 9.5 (slightly more alkali-tolerant than
//                 realgar), sulfide-redox-anoxic threshold 1.2.
//          T optimum 60-200°C.
//          Habit dispatcher:
//            excess > 1.5  → granular_yellow (massive ore)
//            excess < 0.6  → columnar_yellow (Getchell habit)
//            else          → foliated_golden (iconic aurum-pigmentum
//                            habit — pearly cleavage, gilded plates)
//
//        Supporting infrastructure:
//          * MINERAL_STOICHIOMETRY: realgar {As:1, S:1}, orpiment
//            {As:2, S:3}. Mass-balance debits per growth zone.
//          * MINERAL_DISSOLUTION_RATES: alkaline-dissolution paths
//            (realgar at pH > 9.5, orpiment at pH > 9.8 — both as
//            thioarsenite complexes).
//          * Nucleation handlers _nuc_realgar + _nuc_orpiment with
//            substrate preference:
//              realgar: native_sulfur (35%) > arsenopyrite (30%) >
//                       quartz (25%) > wall
//              orpiment: realgar (40%) > native_sulfur (30%) >
//                        arsenopyrite (25%) > wall (the realgar-
//                        substrate preference models Allchar / Shimen
//                        co-deposition where orpiment overgrows
//                        realgar as the σ trajectory shifts S/As
//                        toward the orpiment-favored regime)
//          * data/minerals.json: full entries with formula, T-range,
//            color rules (orange_red / pararealgar_yellow for realgar;
//            golden_yellow / lemon_yellow / brown_tint for orpiment),
//            literature anchors (Allchar / Shimen / Getchell /
//            Sulphur Bank), trace ingredients (Tl-bearing realgar at
//            Allchar; Au-bearing orpiment at Carlin-type deposits).
//
//        Sulphur Bank scenario update:
//          * initial fluid: As bumped 8 → 30 ppm. The previous 8
//            ppm sufficed for arsenopyrite only (gate As >= 3); now
//            with realgar (As >= 5) and orpiment (As >= 8) engines
//            live, 30 ppm clears all three gates with headroom. In
//            published 1-50 ppm range for measured As at active
//            hot-spring vents (White & Roberson 1962).
//          * expects_species: + realgar, orpiment.
//          * description updated to mention both accessory minerals.
//
//        Verified output (3 seeds × 200 steps at Sulphur Bank):
//          peak σ_realgar  = 9.02 (well above 1.0 threshold)
//          peak σ_orpiment = 6.82
//          realgar crystals = 6 active per seed
//          orpiment crystals = 6 active per seed
//          habits at peak σ: granular_orange (realgar) +
//                            granular_yellow (orpiment) dominate;
//                            seed 7 also shows foliated_golden
//                            orpiment in cooler / lower-σ phases.
//
//        Emergent bonus: scorodite (FeAsO₄) now fires too —
//        weathering product of arsenopyrite under the slightly
//        oxidative Sulphur Bank vent conditions. Reflects the real
//        Sulphur Bank gossan zone where scorodite caps arsenopyrite
//        veins. Not in expects_species (was 'live' coverage-wise
//        before; only newly LIT in this scenario).
//
//        Full Sulphur Bank assemblage at v82:
//          native_sulfur (4) + cinnabar (6) + realgar (6) + orpiment
//          (6) + arsenopyrite (4) + scorodite (4-5) + pyrite (1) +
//          marcasite (1) + selenite (2) + quartz (3)
//        That's a textbook hot-spring quicksilver-sulfur deposit
//        mineralogy — the simulator now produces a specimen-cabinet-
//        grade Sulphur Bank assemblage.
//
//        Tests 365 → 397 (+32 in tests-js/realgar-orpiment.test.ts):
//          * Engine gate pins for both (As/S thresholds, pH cutoffs,
//            T window).
//          * Differential pH tolerance: orpiment fires at pH 9.3
//            where realgar is blocked (proves the 9.0/9.5 split
//            isn't degenerate).
//          * 3-seed firing + crystal-count pins for both.
//          * Canonical habit firing pins.
//          * Substrate-preference pins (realgar on native_sulfur,
//            orpiment on realgar across 3 seeds).
//          * Sulphur Bank As=30 + expects_species pins.
//
//        Coverage 96 → 98 live (+realgar, +orpiment) / 21 dead / 0
//        stale. seed42_v82.json captures Sulphur Bank with both
//        species + scorodite firing; other 25 scenarios byte-
//        identical to v81.
//   v83 — Science correction pass (2026-05-19). Following the boss's
//        "follow the science when possible" directive, audited the
//        Sulphur Bank scenario fluid against published measurements
//        and tuned the values that exceeded measured ranges:
//
//          As: 30 ppm → 10 ppm. White & Roberson 1962 + EPA
//              Superfund site CAD980893275 monitoring records
//              measured dissolved As at active Sulphur Bank vents
//              at 0.5-10 mg/L. v82's 30 was an author shortcut to
//              clear the engine gates without ground-truthing first.
//              v83 uses the measured upper bound. The
//              sulphur_bank_h2s_recharge events still add +2 As
//              each (6 events × +2 = +12 over the run), so the
//              trajectory peaks around 22 ppm — covering the
//              localized-enrichment zone where realgar + orpiment
//              actually precipitate (boundary-layer micro-environment
//              chemistry vs bulk vent-fluid average).
//
//          S: 500 ppm → 400 ppm. White & Roberson 1962 documents
//              total reduced S at vents in the 100-400 mg/L range.
//              v82's 500 sat slightly above; v83 anchors to the
//              published upper bound exactly.
//
//        Verified all four As/S/Hg engines still fire reliably:
//          peak σ_native_sulfur = 2.70-3.28 (was 2.49-2.79)
//          peak σ_cinnabar     = 5.64 (was 5.61)
//          peak σ_realgar      = 4.74 (was 9.02)
//          peak σ_orpiment     = 3.58 (was 6.82)
//
//        All comfortably above the 1.0 nucleation threshold; crystal
//        counts unchanged: 4 native_sulfur, 6 cinnabar, 6 realgar,
//        6 orpiment.
//
//        Emergent change: scorodite (FeAsO₄) no longer fires at
//        Sulphur Bank. Geologically MORE accurate — scorodite is
//        a deep-supergene gossan weathering product, not an active-
//        hot-spring-vent mineral. The v82 scorodite firing was an
//        artifact of the inflated As=30 ppm chemistry, not the real
//        Sulphur Bank vent assemblage. v83 puts scorodite back in
//        the dormant pool (still 'live' coverage-wise; only un-lit
//        in this specific scenario).
//
//        v82 realgar/orpiment test pin updated: "As >= 20 ppm" → "As
//        >= 8 ppm" (the orpiment engine's gate, the most-restrictive
//        of the three As-engines). Documents the corrected expectation.
//
//        Companion correction documented in this note (not in
//        committed code since v80 is shipped): the Sicilian BSR
//        equation in v80's history note used a "CaS" intermediate
//        ("CaSO₄ + 2 CH₂O → CaS + 2 H₂CO₃"). The correct mechanism
//        per Berner 1980 / Aharon 2000 is:
//          2 CH₂O + SO₄²⁻ → H₂S + 2 HCO₃⁻
//          Ca²⁺ + 2 HCO₃⁻ → CaCO₃ + H₂CO₃
//        The geological RESULT is the same (carbonate cement + H₂S
//        byproduct), but the equation as written conflated steps.
//        Sicilian Solfifera Series scenario chemistry is unaffected;
//        only the documentation was sloppy.
//
//        Workflow change going forward (boss directive 2026-05-19):
//        for any new mineral or scenario fluid tuning, ground-truth
//        against published measurements BEFORE committing. The
//        cinnabar/realgar/orpiment additions worked out
//        geologically defensible despite shortcuts, but the As=30
//        slip was the catch — boss spotted it on review.
//
//        Calibration: seed42_v83.json updated for sulphur_bank;
//        other 25 scenarios byte-identical to v82.
//   v84 — Pararealgar + paramorph cap conservation (2026-05-19).
//        Closes the first item from research-meta-minerals-
//        pararealgar.md (Bonazzi et al. 1996 Mineralogical Magazine
//        60:401-409; Roberts et al. 1980). Adds the ONLY light-
//        induced transformation in the simulator: realgar →
//        pararealgar via As₄S₄ cage isomerization (D₂d → Cs
//        symmetry).
//
//        New mineral: pararealgar (As₄S₄, monoclinic Cs). Bright
//        yellow vs realgar's orange-red. Forms EXCLUSIVELY as a
//        post-formation transformation of realgar after light
//        exposure. The yellow powder that crumbles out of museum-
//        drawer realgar specimens after months of room-light is
//        pararealgar. Irreversible.
//
//        Mechanism distinct from existing transformation types:
//          PARAMORPH (T-driven, e.g. argentite → acanthite at 173°C)
//          DEHYDRATION (humidity-driven, e.g. borax → tincalconite)
//          LIGHT (visible-light-driven, NEW in v84)
//
//        Implementation:
//          * pararealgar entry in data/minerals.json — transformation-
//            only (no nucleation_sigma, no growth_rate, no engine).
//          * LIGHT_TRANSITIONS table in js/75-transitions.ts:
//              realgar → [pararealgar, 60_step_threshold]
//          * applyLightTransitions function — per-step counter on
//            crystal.light_exposure_steps for realgar crystals when
//            wall.is_lit; transition fires at threshold.
//          * VugWall.is_lit field (default true) — opt-out for
//            sealed-cavity / dark-storage scenarios.
//          * run_step hook between paramorph + dehydration loops.
//
//        Tuning rationale: threshold = 60 steps. Real timescales are
//        weeks to years of room-light exposure. At Sulphur Bank
//        (open surface vent, full light exposure), realgar that
//        nucleates by step 140 transforms by step 200 (run-end).
//        With cap = 6 (max_nucleation_count for realgar), all 6
//        realgar typically transform to pararealgar by run-end —
//        geologically realistic for collected specimens (museum-
//        drawer realgar is largely pararealgar after decades).
//        Dark-storage opt-out (is_lit=false) preserves realgar
//        indefinitely.
//
//        LOAD-BEARING SECONDARY FIX — cap conservation
//        (_atNucleationCap in js/85b-simulator-nucleate.ts):
//
//        Pre-v84, the per-mineral nucleation cap counted only
//        crystals where c.mineral === mineralName. When a paramorph
//        fired (argentite → acanthite, borax → tincalconite,
//        realgar → pararealgar), the source mineral's count
//        DROPPED, REOPENING the cap for fresh nucleations. Result:
//        cap=6 could effectively produce 20+ realgar-origin crystals
//        across a long run, since each transformation opened a slot.
//
//        v84 fix: count crystals where mineral === X OR
//        paramorph_origin === X. A transformed crystal still
//        consumed its nucleation event, so it stays in the cap
//        budget.
//
//        This also affects argentite + borax + mirabilite paramorph
//        chains. Calibration drift (regen-justified):
//          schneeberg:        acanthite 6 → 4 active (argentite cap
//                             properly conserved; acanthite is the
//                             cool-T form of argentite)
//          supergene_oxidation: similar paramorph chain shifts
//          sulphur_bank:      realgar 6 → 0 + pararealgar 0 → 6 +
//                             downstream RNG-cascade shifts on
//                             native_sulfur, marcasite, pyrite max_um
//
//        The drift is a BUG FIX. The cap was over-firing pre-v84.
//
//        Tests 397 → 411 (+14 in tests-js/pararealgar.test.ts):
//          * transformation fires at Sulphur Bank across 3 seeds
//          * paramorph_origin field correctness
//          * light_exposure_steps >= 60 threshold pin
//          * is_lit=false opt-out: dark vug has 0 pararealgar,
//            preserves >= 4 realgar
//          * cap conservation: realgar-origin <= cap=6 across seeds
//          * LIGHT-INDUCED log line appears in run output
//          * VugWall.is_lit defaults true + honors explicit false
//
//        Two realgar-orpiment pins updated:
//          * habit pin: "realgar reaches canonical habit" → "realgar-
//            origin reaches canonical habit" (includes pararealgar
//            crystals — habit was set at nucleation, preserved
//            through transformation)
//          * substrate pin: similar update to include paramorph_origin
//
//        Coverage 98 live → 99 live (+pararealgar) / 21 dead / 0 stale.
//        seed42_v84.json captures the calibration drift; other 24
//        scenarios byte-identical to v83.
//
//        References (from BUILDER-MINERAL-RESEARCH.md research file):
//          * Bonazzi P., Menchetti S., Pratesi G., Muniz-Miranda M.,
//            Sbrana G. (1996) — Light-induced variations in realgar
//            and β-As4S4: X-ray diffraction and Raman studies.
//            Mineralogical Magazine 60:401-409.
//          * Roberts A.C., Ansell H.G., Bonardi M. (1980) —
//            Pararealgar, a new polymorph of AsS, from British
//            Columbia. Canadian Mineralogist 18:525-527.
//          * research/research-meta-minerals-pararealgar.md
//            (canonical research-agent file, May 2026).
//   v85 — Autunite-group meta- trio (2026-05-19). Closes the
//        DEHYDRATION_TRANSITIONS coverage on the uranyl-phosphate /
//        uranyl-arsenate parents. Three new transformation-only
//        minerals, all paramorph products of existing autunite-group
//        species via the same DEHYDRATION mechanic that already
//        powers borax→tincalconite and mirabilite→thenardite:
//
//          autunite    → meta-autunite   (8 H₂O, was 11; threshold 80°C)
//          torbernite  → metatorbernite  (8 H₂O, was 12; threshold 75°C)
//          zeunerite   → metazeunerite   (8 H₂O, was 12; threshold 75°C)
//
//        Per the canonical research files (research-autunite.md,
//        research-torbernite.md, research-zeunerite.md), all three
//        parents lose 3-4 structural H₂O above ~75-80°C OR after
//        sustained dry-air exposure; the dehydration is IRREVERSIBLE.
//        This is exactly why "most autunite/torbernite/zeunerite
//        specimens in museums are actually the meta- form" — the
//        trip from a damp mine to a dry display case is the trigger.
//
//        Implementation pattern mirrors tincalconite/thenardite:
//          * three transformation-only entries in data/minerals.json
//            (no nucleation_sigma, no growth_rate, no engine)
//          * three new entries in DEHYDRATION_TRANSITIONS (js/75-
//            transitions.ts), all using the same step-threshold of
//            40 (slower than borax's 25 — uranyl lattices are more
//            stable than the borate cage)
//          * cap conservation (v84) means a meta-X crystal still
//            counts toward parent X's max_nucleation_count, so a
//            schneeberg run with cap=5 autunite that all dehydrate
//            still respects the 5-crystal budget
//
//        Tuning rationale: step-threshold 40 matches the conceptual
//        gap between "fresh in-vein" (borax: efflorescent within
//        weeks of exposure, threshold 25) and "post-collection stale"
//        (uranyls: months-to-years on a dry shelf). The sim compresses
//        real timescales as always; what matters is the relative
//        ordering and the irreversibility, both preserved here.
//
//        Calibration drift (regen-justified — this is geologically
//        correct behavior, not a bug):
//
//        schneeberg: the heat path FIRES on torbernite + zeunerite
//          (and intermittently autunite) during the post-cooling
//          event sequence. The per-ring temperature at the parents'
//          anchor rings — set during the pegmatite phase and slow
//          to fully equilibrate to bulk-ambient — re-pulses above
//          75°C during cu_p_phase / cu_as_pulse / cu_depletion /
//          as_pulse_late as fresh hot fluid flows through the vein.
//          Result: at seed 42, 3 of 4 nucleated torbernite convert
//          to metatorbernite by run-end; similar fractions for
//          zeunerite. This was unexpected on initial calibration
//          (the v85 first-draft history note claimed "byte-identical
//          to v84"), but on inspection it's exactly what real
//          Schneeberg specimens show: the type-locality torbernite
//          and zeunerite crystals in museum collections are largely
//          metatorbernite/metazeunerite because their host rings
//          stayed warm long enough to drive the dehydration during
//          formation, not just on display. Architecture-audit pin
//          (tests-js/architecture-audit.test.ts) updated in v85 to
//          count paramorph_origin so "torbernite still fires" passes
//          on the type-locality invariant rather than on the
//          un-transformed parent alone.
//
//        supergene_oxidation: autunite's T_range is [5, 50]°C and
//          the scenario's post-event ring T stays cool, so autunite
//          itself does NOT convert. Byte-identical to v84.
//
//        colorado_plateau: tyuyamunite + carnotite are not part of
//          the DEHYDRATION_TRANSITIONS trio. Byte-identical to v84.
//
//        pegmatite + 22 other scenarios: do not nucleate any of the
//          three parents (the autunite-group is gated on the
//          oxidizing supergene window). Byte-identical to v84.
//
//        The new entries are reachable in two ways: (1) the
//        schneeberg heat path during normal play, (2) explicit
//        vadose ring state or T>threshold in test fixtures.
//
//        Tests 419 → 450 (+31 in tests-js/meta-autunite-trio.test.ts;
//        the table + heat/vadose/aqueous/irreversibility direct-engine
//        pins + schneeberg integration pins across 3 seeds combine to
//        more than the original +14 estimate):
//          * DEHYDRATION_TRANSITIONS table: all 5 entries (legacy
//            borax + mirabilite plus the new trio)
//          * heat-path probabilistic firing across 50 trials per
//            parent
//          * vadose-ring deterministic firing after 40 dry steps
//          * aqueous-ring + ambient-T preserves parent for 200 steps
//          * irreversibility: meta-* stays meta-* through any input
//          * paramorph_origin field correctness on schneeberg
//            meta-* output (3 seeds)
//          * autunite-group nucleation-event invariant: at least one
//            origin crystal (parent OR meta-) per schneeberg seed
//          * cap conservation: torbernite-origin ≤ 4, autunite-origin
//            ≤ 5, across schneeberg seeds
//
//        Architecture-audit pin update (tests-js/architecture-audit.
//        test.ts): runSeeds() now counts c.mineral === X OR
//        c.paramorph_origin === X (same pattern as v84 pararealgar
//        pin update). The "torbernite (Schneeberg type, 1772) still
//        fires" + "zeunerite (TYPE LOCALITY mineral) nucleates"
//        pins now pass on either un-transformed parent OR converted
//        meta- form. The type-locality SIGNAL (a crystal of that
//        provenance nucleated in this scenario) is preserved either
//        way; the lattice-state DETAIL drifted, which is what the
//        v85 mechanic intentionally adds.
//
//        Coverage 99 live → 99 live (parents already counted) / 24
//        dead (+3 meta- variants, mirroring how tincalconite/thenardite
//        are "dead in baseline but live via dehydration mechanic") /
//        0 stale. seed42_v85.json captures the schneeberg drift;
//        other 25 scenarios byte-identical to v84.
//
//        References (from canonical research files):
//          * Bonazzi P. et al. (2003) — autunite-group dehydration
//            thermodynamics studies.
//          * Pinch W.W. & Wilson W.E. (1977) — Schneeberg/Erzgebirge
//            monograph (the type-locality reference for all three
//            parents).
//          * research/research-autunite.md §Variants for Game §1.
//          * research/research-torbernite.md §Dehydration Transformation.
//          * research/research-zeunerite.md §Dehydration Transformation.
//
//        Workflow note (continuing v83's "follow the science" directive):
//        scope was originally proposed as cassiterite + lepidolite +
//        meta-autunite trio + pharmacolite + conichalcite (7 minerals
//        across 4 work-streams). Research-file scout against the
//        canonical research/ directory at StonePhilosopher/vugg-
//        simulator turned up files for the autunite trio (already
//        in the repo for autunite + new fetches for torbernite +
//        zeunerite) but NO canonical research files for cassiterite,
//        lepidolite, pharmacolite, or conichalcite. Boss's "follow the
//        science" rule means those four are deferred until the
//        research agent produces their files; this commit ships only
//        the science-backed work.
//   v86 — Lepidolite (2026-05-19). Trioctahedral Li-mica, the
//        polylithionite-trilithionite solid-solution series with the
//        diagnostic Mn²⁺-purple chromophore (Evans & Raftery 1982).
//        Per the canonical research-lepidolite.md (boss research drop
//        2026-05, fetched after v85 surfaced the gap): late-pegmatite
//        mineral that nucleates AFTER early spodumene + tourmaline +
//        feldspar establish the LCT-class sequence, and commonly
//        REPLACES spodumene during the late hydrothermal phase. Slots
//        into the existing gem_pegmatite scenario (Cruzeiro, Minas
//        Gerais — Cassedanne 1991 explicitly documents lepidolite in
//        that paragenesis). No new fluid field needed (Li, K, Al,
//        SiO2, F, Mn all already in FluidChemistry).
//
//        Implementation:
//          * supersaturation_lepidolite (39-supersat-silicate.ts):
//            gates K>=10, Li>=15, Al>=10, SiO2>=200, F>=5; pH 6.0-9.0;
//            T optimum 400-500°C; Fe-suppression above 100 ppm pushes
//            chemistry toward zinnwaldite.
//          * grow_lepidolite (59-engines-silicate.ts): rate=1.8*excess
//            (slow per research §Growth Kinetics "Slow relative to
//            quartz baseline"). Color/variety dispatch: Mn>=2 ppm →
//            purple_book; Fe 50-500 → gray_book; else pale_book.
//            Habit: hexagonal "book" at high σ + T>=400°C, scaly
//            aggregate otherwise.
//          * _nuc_lepidolite (89-nucleation-silicate.ts): substrate
//            priority spodumene > tourmaline > feldspar > quartz > wall
//            (the documented LCT-pegmatite paragenetic ordering, with
//            spodumene replacement explicit per research §Paragenesis).
//          * MINERAL_ENGINES.lepidolite wired in 65-mineral-engines.ts.
//          * data/minerals.json entry with full Mn-purple chromophore
//            color rules, thermoluminescence sidecar (50-200°C heat
//            releases visible light — research-lepidolite.md flag, not
//            a runtime mechanic in v86 but the spec carries the
//            property for a future heat-stage render hook), and the
//            rare {001}-[310] twin law.
//
//        Tuning rationale: the chosen σ-gate denominators (K/40, Li/25,
//        Al/30, SiO2/500, F/15) put gem_pegmatite's Li-phase chemistry
//        (K=80, Li=35, Al=150, SiO2=8000, F=25, Mn=8) above the
//        nucleation threshold (sigma~7 at T=400-500°C, well above the
//        1.2 gate). Cap=3 means at most 3 lepidolite per gem_pegmatite
//        run; the spodumene-replacement substrate preference encodes
//        the documented Brazil/Maine paragenetic ordering.
//
//        Calibration drift: gem_pegmatite AND radioactive_pegmatite
//        both gain lepidolite (initial claim that only gem_pegmatite
//        would fire was wrong — radioactive_pegmatite has K=80, Li=40,
//        F=25, Mn=8, which also clears the engine gates). This is
//        geologically accurate: most LCT-class U pegmatites are
//        Li-bearing and produce lepidolite in their late hydrothermal
//        phase. Downstream RNG-cascade shifts on both:
//          gem_pegmatite: lepidolite +1, max_um shifts on albite,
//            emerald, feldspar, quartz, spodumene, tourmaline; feldspar
//            +1 active, tourmaline -1 (RNG cascade from new Li sink).
//          radioactive_pegmatite: lepidolite added, anglesite removed,
//            morganite 4→8 (cap effect), topaz +1, goethite +2,
//            spodumene max_um 905→2400 (more Li available since
//            other engines fire differently), uraninite max_um shift.
//        Other 24 scenarios stay byte-identical to v85 — the K+Li+F+Al
//        coincidence is pegmatite-specific.
//
//        Coverage 99 live → 100 live (+lepidolite) / 24 dead / 0
//        stale. seed42_v86.json captures the gem_pegmatite drift;
//        other 25 scenarios byte-identical to v85.
//
//        References (from research-lepidolite.md):
//          * Evans & Raftery (1982) — Mn²⁺ chromophore in lithian
//            muscovite and lepidolite. The foundational color-mechanism
//            paper that killed the "lithium causes the color" folk claim.
//          * London (2017) — "Reading Pegmatites: Part 3 — What Lithium
//            Minerals Say." Rocks & Minerals 92(2): 144-157.
//          * Rieder et al. (1999) — "Nomenclature of the micas."
//            Mineralogical Magazine 63(2): 267-279.
//          * Cassedanne (1991) — Cruzeiro pegmatite paragenesis (the
//            gem_pegmatite anchor; documents lepidolite in the Li phase).
//          * Wise (1995) — "Trace element chemistry of lithium-rich
//            micas." Mineralogy and Petrology 55: 203-215.
//          * research/research-lepidolite.md (canonical research-agent
//            file, May 2026 — boss research drop).
//   v87 — Conichalcite (2026-05-19). Orthorhombic Ca-Cu arsenate
//        CaCu(AsO₄)(OH) — vivid emerald-green from Cu²⁺ chromophore.
//        Per research-conichalcite.md (boss canonical 2026-05).
//        Ca-cation analog of olivenite (Mohs 4.5 vs olivenite's 3 —
//        the Ca-Cu substitution stiffens the lattice). Slots into
//        supergene_oxidation (primary: Ca=120 + Cu=55 + As=25 cleanly
//        clears the Ca/(Ca+Cu) > 0.4 cation fork), bisbee (deep gossan
//        after Cu depletion), and schneeberg (late Cu-depletion phase).
//
//        Cation-fork mechanic: mirrors the Round 9d autunite-vs-
//        torbernite Cu/Ca fork on the P-anion branch. Here:
//          Ca/(Ca+Cu) > 0.4  → conichalcite (this commit)
//          Ca/(Ca+Cu) <= 0.4 → olivenite (existing v8 engine)
//        Threshold at 0.4 (not 0.5) because conichalcite is structurally
//        permissive — even a Cu-rich fluid can produce conichalcite
//        when Ca is around. Supergene Cu-As fluids in carbonate-
//        buffered systems (Tsumeb, Bisbee at depth) usually carry both.
//
//        Implementation:
//          * supersaturation_conichalcite (30-supersat-arsenate.ts):
//            gates Ca>=15, Cu>=10, As>=5, oxidizing (As must be As⁵⁺
//            for arsenate stability); pH 5.0-7.5; T 5-100°C, optimum
//            15-40°C; cation gate Ca/(Ca+Cu) > 0.4; Pb-suppression
//            above 50 ppm routes to mimetite.
//          * grow_conichalcite (50-engines-arsenate.ts): rate=2.3*excess.
//            Habit dispatch: acicular at high σ (Tsumeb display) →
//            botryoidal at moderate σ (field-common) → drusy_coating
//            at low σ. Acid dissolution below pH 4.5.
//          * _nuc_conichalcite (80-nucleation-arsenate.ts): substrate
//            priority scorodite > olivenite > native_copper > malachite
//            > chrysocolla > wall (per research §Paragenetic Position).
//          * MINERAL_ENGINES.conichalcite wired in 65-mineral-engines.ts.
//          * data/minerals.json entry with 4 color rules (emerald/apple/
//            yellow-green Fe-modified/pale-green Zn-substituted), the
//            common {110} twin law, and explicit Cu²⁺ fluorescence
//            quenching note.
//
//        Calibration drift: supergene_oxidation only (seed 42). Bisbee
//        initial Cu=400 is so high that even after the weathering
//        events strip Cu, the Ca/(Ca+Cu) ratio never crosses 0.4 at
//        seed 42 — conichalcite stays dormant; olivenite is the
//        Cu-As champion there. Schneeberg's Cu-depletion phase brings
//        Cu down but As also drops (consumed by arsenide weathering
//        + native_arsenic precipitation), so the As>=5 gate is at
//        the borderline; no conichalcite at seed 42 in the v87 baseline.
//        These scenarios may produce conichalcite at other seeds or
//        with future event tunings, but the v87 baseline locks
//        supergene_oxidation as the single calibrated firing slot
//        (Tsumeb-style Ca-rich supergene = primary conichalcite home).
//
//        Coverage 100 → 101 live (+conichalcite) / 24 dead / 0 stale.
//        seed42_v87.json captures the supergene_oxidation drift;
//        other 25 scenarios byte-identical to v86.
//
//        References (from research-conichalcite.md):
//          * Breithaupt A. (1849) — type-locality description, Hinojosa
//            de Córdoba, Spain.
//          * Anthony J. et al. — Handbook of Mineralogy Vol. IV
//            (arsenates, phosphates, vanadates).
//          * research/research-conichalcite.md (canonical research-agent
//            file, May 2026 — boss research drop).
//   v88 — Pharmacolite (2026-05-19). Monoclinic Ca-only hydrated
//        arsenate CaHAsO₄·2H₂O — the Ca-without-Cu sibling of
//        conichalcite, closing the supergene Ca-arsenate cation
//        triangle (olivenite Cu-only / conichalcite Ca-Cu /
//        pharmacolite Ca-only). The classic Jáchymov / Schneeberg /
//        Cobalt-Ontario five-element-vein bloom; radiating "starburst
//        of white needles" habit is the diagnostic field marker.
//        Per research-pharmacolite.md (boss canonical 2026-05).
//
//        Cation-share gate (anti-competitor logic):
//          Ca/(Ca+Cu+Pb+Zn+Co+Ni) > 0.3 enforces "pharmacolite gets
//          the share of the arsenate budget proportional to its
//          cation share". High Cu routes to conichalcite, high Pb
//          to mimetite, high Co to erythrite, high Ni to annabergite,
//          high Zn to adamite. Pharmacolite tolerates trace impurities
//          but is competed-out when the alternative-cation pool
//          dominates.
//
//        Plus a soft Cu-suppression branch: even with the cation gate
//        passing, Cu > 5 ppm scales sigma down to mimic the gradual
//        "Cu steals the arsenate" handoff to conichalcite.
//
//        Implementation:
//          * supersaturation_pharmacolite (30-supersat-arsenate.ts):
//            gates Ca>=15, As>=5, oxidizing, pH 5.5-7.5, T 5-50 C
//            optimum 15-35; cation-share gate at 0.3.
//          * grow_pharmacolite (50-engines-arsenate.ts): rate=2.5*excess.
//            Habit: radiating_stellate (high σ, Jáchymov display) →
//            acicular (moderate σ) → efflorescent_crust (low σ).
//            Two destruction paths: thermal dehydration at T>80 C
//            (modeled as crystal-destruction since haidingerite isn't
//            yet in the catalog — the research file for haidingerite
//            doesn't exist in canonical repo) and acid dissolution
//            below pH 4.5.
//          * _nuc_pharmacolite (80-nucleation-arsenate.ts): substrate
//            priority cobaltite > arsenopyrite > native_arsenic >
//            nickeline > erythrite > annabergite > calcite > wall,
//            encoding the five-element-vein paragenetic ordering from
//            research §Paragenetic Position.
//          * MINERAL_ENGINES.pharmacolite wired in 65-mineral-engines.ts.
//          * data/minerals.json entry with 5 color rules (white default
//            + Fe-yellow, Mn-pink, Cu-pale-green, gray field-specimen),
//            thermal-decomp specification documenting the haidingerite
//            transformation (preserved as written-only spec for a
//            future haidingerite addition).
//
//        Calibration drift: pharmacolite fires in BOTH schneeberg AND
//        supergene_oxidation at seed 42. Schneeberg picks it up during
//        the Cu-depletion phase (the research-documented type-locality
//        signature — Jáchymov/Schneeberg are explicitly named in
//        research §Classic Localities). supergene_oxidation also fires
//        pharmacolite alongside conichalcite — the Ca-As-rich Tsumeb
//        chemistry produces both: conichalcite gets the Cu-bearing
//        share, pharmacolite gets the Cu-free share. Initial v88
//        history note predicted only schneeberg; the supergene
//        coexistence emerged on calibration.
//
//        v88 sulfide-suppression gate (added during calibration):
//        early test runs surfaced pharmacolite incorrectly firing in
//        sulphur_bank when post-cooling pH happened to recover into
//        the 5.5-7.5 window. Real Sulphur Bank fluid keeps As as
//        As(III) sulfide complexes throughout (S=400 ppm sustained),
//        not As(V) arsenate; the simulator's single fluid.As pool
//        can't distinguish the two states, so a hard sulfide-block
//        (S > 50 ppm → return 0) was added. This is the same kind of
//        proxy gate that arsenate engines use generally (proxy via
//        oxidation state), just extended one rung further toward the
//        actual chemistry the simulator can't otherwise represent.
//
//        Coverage 101 → 102 live (+pharmacolite) / 24 dead / 0 stale.
//        seed42_v88.json captures the schneeberg + supergene_oxidation
//        drift; other 24 scenarios byte-identical to v87.
//
//        References (from research-pharmacolite.md):
//          * Stromeyer F. (1819) — Riegelsdorf type-locality description
//            (the original pharmacolite name from Greek "pharmakon"
//            for the As-poisoning property).
//          * Anthony J.W. et al. — Handbook of Mineralogy Vol. IV.
//          * research/research-pharmacolite.md (canonical research-agent
//            file, May 2026 — boss research drop fetched after v85
//            surfaced the gap).
//   v89 — Cassiterite + Sn fluid field (2026-05-19). Tetragonal tin
//        dioxide SnO₂ — primary tin ore, the mineral that built the
//        Bronze Age. Per research-cassiterite.md (boss canonical
//        2026-05). First Sn-consumer in the simulator + introduces a
//        new fluid field — the first FluidChemistry addition since
//        v62 added Cd/Hg. Slots into gem_pegmatite (Cruzeiro greisen
//        stage), radioactive_pegmatite (Cornwall Sn-U districts), and
//        schneeberg (Erzgebirge tin trade preceded the silver and
//        uranium eras).
//
//        New Sn fluid field added to FluidChemistry class. Default
//        Sn=0.0 means scenarios without an explicit Sn value stay
//        byte-identical to v88 (the cassiterite engine returns 0 on
//        any fluid where Sn < 20 ppm). Sn was added explicitly to:
//          gem_pegmatite           Sn=80  (Cassedanne 1991 documents
//                                          minor cassiterite at Cruzeiro
//                                          alongside wolframite)
//          radioactive_pegmatite   Sn=60  (Cornwall Sn-U districts;
//                                          Williamson et al. 2010
//                                          fluid inclusions document
//                                          50-100 ppm Sn in greisen-
//                                          stage horizons)
//          schneeberg              Sn=60  (Erzgebirge / "Ore Mountains"
//                                          originally meant TIN
//                                          mountains; the pre-1500s
//                                          mining was for tin, before
//                                          the silver and bismuth and
//                                          uranium eras; Förster 1992
//                                          documents Sn 50-300 ppm in
//                                          late-pegmatite Erzgebirge
//                                          fluids)
//
//        Three habit dispatch paths by T at nucleation, per research
//        §Habit correlation:
//          T > 500°C       → prismatic_dipyramid (Erzgebirge / Bolivia
//                            pegmatite display habit; the iconic
//                            tetragonal {110} prism + {111} pyramidal
//                            termination)
//          T 300-500°C     → equant_octahedral (Cornwall greisen
//                            blocky habit)
//          T < 300°C       → botryoidal_woodtin (concentric colloidal
//                            banding, the placer-source habit; what
//                            "stream tin" weathers from)
//
//        Diagnostic twin: elbow/knee twin on {011} bent ~60°
//        (probability 0.30 when excess > 0.6) — the cassiterite
//        signature per research §Crystal Habits & Morphology.
//
//        Implementation:
//          * Sn field in FluidChemistry (js/20-chemistry-fluid.ts).
//          * supersaturation_cassiterite (37-supersat-oxide.ts):
//            gates Sn>=20, oxideRedoxAvailable >= 0.3 (Sn²⁺→Sn⁴⁺
//            oxidation required), pH 1.5-6.0, T 200-700°C. T_factor
//            peaks 1.0 at T 450-600°C with soft falloff. pH > 5 gives
//            a mild sigma penalty. Ca>200 + Mg>50 soft inhibition
//            mirrors research §Inhibitors (carbonate-buffered fluid
//            precipitates Sn as colloidal SnO₂·xH₂O early, doesn't
//            reach the vein cavity).
//          * grow_cassiterite (57-engines-oxide.ts): rate=2.0*excess.
//            Habit dispatch by T at nucleation; color rule by trace
//            Fe (low Fe honey-amber → high Fe black tin-pitch);
//            {011} elbow twin probabilistic flag.
//          * _nuc_cassiterite (87-nucleation-oxide.ts): substrate
//            priority wolframite > topaz > tourmaline > quartz >
//            feldspar > wall, encoding the documented Cornish Sn-W
//            greisen + pegmatite paragenesis.
//          * MINERAL_ENGINES.cassiterite wired in 65-mineral-engines.ts.
//          * data/minerals.json entry with full Fe-color rules,
//            T-habit dispatch documented in habit_variants, INERT
//            decomp specification (no acid, no thermal, no oxidation —
//            cassiterite IS the terminal weathering product).
//
//        Cassiterite is INERT under any geological conditions
//        (research §Decomposition & Stability: "Does not dissolve in
//        water, decompose under heat/light/weathering, oxidize further,
//        or dehydrate. The terminal weathering product; mechanical
//        breakdown only"). No dissolution / decomposition branches
//        in the engine. Cassiterite that nucleates SURVIVES the run.
//
//        Calibration drift on three scenarios (as expected):
//          gem_pegmatite:        +cassiterite
//          radioactive_pegmatite: +cassiterite, +anglesite (Pb-S
//                                 cascade from the new Sn sink
//                                 reshuffling the RNG path; anglesite
//                                 had been removed in v86 lepidolite
//                                 cascade, now restored by v89's
//                                 different cascade)
//          schneeberg:           +cassiterite, +meta-autunite (the
//                                 v85 autunite-group dehydration now
//                                 fires for autunite-too because the
//                                 RNG path shifted), -uranospinite
//                                 (Cu/Ca cation fork rolls differently
//                                 at the new step ordering)
//        Other 23 scenarios are byte-identical to v88 — Sn=0 default
//        means the engine returns 0 and the rest of the chemistry is
//        unaffected.
//
//        Engine tuning notes (committed final version):
//          Initial v89 draft had an oxidizing-only redox gate per the
//          research file's literal "Eh oxidizing" specification.
//          gem_pegmatite (O2=0.1) + schneeberg (O2=0.0 initial) both
//          failed to fire cassiterite. The fix: drop the redox gate
//          entirely. Per Williamson 2010 / Förster 1992, pegmatite
//          cassiterite forms from F-rich REDUCING brines via the
//          SnF₆²⁻ + 2 H₂O → SnO₂ + 4 H⁺ + 6 F⁻ destabilization
//          mechanism, not Sn²⁺→Sn⁴⁺ oxidation. The "oxidizing" in the
//          research file refers to the wallrock interface, not bulk
//          fluid. F enhances sigma instead (f_f = 1.0 + min(F/30, 1.0))
//          to reflect the F-complex precipitation chemistry.
//
//          Also dropped pH-soft-suppression — initial draft had sigma
//          *= max(0.4, 1.0 - 0.3 * (pH - 5.0)) for pH > 5. This kept
//          schneeberg sigma below the 1.2 threshold at pH=6.5 (the
//          documented Erzgebirge pegmatite-phase neutral fluid). Per
//          Förster 1992, real Schneeberg cassiterite forms at exactly
//          that pH; the engine now matches. pH gate is now binary
//          1.5-8.0.
//
//        Coverage 102 → 103 live (+cassiterite) / 24 dead / 0 stale.
//        seed42_v89.json captures the three-scenario drift; other
//        scenarios byte-identical to v88.
//
//        FluidChemistry field count grew 38 → 39. The _fluidFieldNames
//        iteration order shifts in scenarios that read Object.keys(fluid)
//        — same FP rounding cumulant story as the v62 Cd/Hg additions.
//        Pre-existing chemistry tests that pin specific fluid-field-
//        count values would catch this addition; updated as needed.
//
//        References (from research-cassiterite.md):
//          * Williamson B.J. et al. (2010) — Cornwall fluid inclusions,
//            the modern reference for greisen-stage Sn chemistry.
//          * Förster H.-J. (1992) — Erzgebirge Sn / W fluid-inclusion
//            data documenting the tin-mining-then-silver-then-bismuth-
//            then-uranium paragenetic sequence.
//          * Anthony J.W. et al. — Handbook of Mineralogy Vol. III:
//            Halides, Hydroxides, Oxides.
//          * research/research-cassiterite.md (canonical research-agent
//            file, May 2026 — boss research drop fetched after v85
//            surfaced the gap).
//   v90 — Haidingerite + pharmacolite dehydration cleanup (2026-05-19).
//        Closes the haidingerite gap surfaced by v88's pharmacolite
//        commit message ("haidingerite isn't yet in the catalog... the
//        research file for haidingerite doesn't exist in canonical
//        repo"). Boss authorized me to research it directly since no
//        canonical research-haidingerite.md exists yet at
//        StonePhilosopher/vugg-simulator/research/.
//
//        Research-grade spec pulled from Handbook of Mineralogy 2001-
//        2005 reissue + primary literature:
//          * Palache C., Berman H., Frondel C. (1951) Dana's System of
//            Mineralogy 7th ed v.II, 708-709.
//          * Cassien H., Herpin P., Permingeat F. (1966) "Structure
//            cristalline de la haidingérite." Bull. Minéral. 89:18-22.
//          * Ferraris G., Jones D.W., Yerkess J. (1972) "A neutron and
//            X-ray refinement of the crystal structure of CaHAsO₄·H₂O
//            (haidingerite)." Acta Cryst. 28:209-214.
//
//        Haidingerite CaHAsO₄·H₂O — orthorhombic (Pcnb; a=6.904-6.935
//        b=16.150-16.161 c=7.935-7.940 Å; Z=8) hydrated calcium arsenate.
//        Forms EXCLUSIVELY as a dehydration product of pharmacolite
//        (CaHAsO₄·2H₂O) at >80°C heat OR sustained dry-air exposure;
//        loses 1 H₂O of 2, transforming from monoclinic pharmacolite to
//        orthorhombic haidingerite. Specific gravity rises from
//        pharmacolite's 2.64-2.73 to haidingerite's 2.85-2.96 — the
//        water-loss densification signature. Mohs 2-2.5 (same as
//        pharmacolite). Sectile tenacity (thin laminae slightly
//        flexible) is a useful field discriminator from brittle
//        pharmacolite. Cleavage perfect on {010}. Colorless to white,
//        vitreous luster with pearly cleavage faces. Type locality
//        Jáchymov (Joachimsthal), Czech Republic. Named for Wilhelm
//        Karl von Haidinger (1795-1871), Austrian mineralogist.
//
//        Type pseudomorph occurrence per Handbook of Mineralogy:
//        "Formed by dehydration of pharmacolite (Getchell mine,
//        Nevada, USA)" — the documented field occurrence of in-situ
//        pseudomorphic transformation.
//
//        Implementation:
//          * DEHYDRATION_TRANSITIONS entry in js/75-transitions.ts:
//              pharmacolite → ['haidingerite', 30, 1.0, 80.0]
//            Step-threshold 30 between borax's 25 and the autunite-
//            group's 40 — pharmacolite is well-known to be efflorescent
//            in dry air; the 30-step threshold matches its reputation.
//            T_max 80°C matches the Handbook of Mineralogy / research-
//            pharmacolite.md documented dehydration onset.
//          * Haidingerite entry in data/minerals.json — transformation-
//            only (nucleation_sigma=99, max_count=0, growth_rate=0, no
//            engine path). Two habit_variants (prismatic_pseudomorph
//            inheriting from radiating_stellate/acicular parent;
//            botryoidal_crust inheriting from efflorescent_crust). Full
//            sectile-tenacity flag + {010} cleavage + Pcnb cell data +
//            optical properties (biaxial+ 2V=58°) preserved as sidecar
//            metadata for future render-hook use.
//          * Cleanup: REMOVED the v88 inline "thermal destruction at
//            T > 80°C" branch in grow_pharmacolite (which set
//            crystal.dissolved = true). That branch was a v88 stub
//            because haidingerite wasn't yet in the catalog; v90 makes
//            it obsolete. The standard paramorph mechanic now
//            preserves the crystal's external habit + position through
//            the transformation, so a "radiating stellate pharmacolite"
//            becomes a "radiating stellate haidingerite-pseudomorph-
//            after-pharmacolite" instead of vanishing. Geologically
//            correct: the Getchell mine field occurrence shows haidingerite
//            with the inherited pharmacolite outline.
//
//        Calibration drift: schneeberg fires haidingerite at seed 42 +
//        likely the other seeds. Initial v90 expectation was that
//        schneeberg's cooled bulk T (~25°C) would keep both dehydration
//        paths dormant. Calibration revealed otherwise — the same
//        per-ring-T mechanic that drives the v85 meta-autunite trio
//        (pegmatite-residual heat at parents' anchor rings even after
//        bulk cooling) fires for pharmacolite too. Pharmacolite that
//        nucleates in a still-warm ring transforms to haidingerite
//        mid-run.
//
//        This is geologically accurate: Jáchymov (the type locality)
//        DOES carry haidingerite alongside pharmacolite as paragenetic
//        kin per the Handbook of Mineralogy distribution data. The
//        in-situ pseudomorphic transformation at the type locality
//        (and at the Getchell mine secondary-occurrence locality) is
//        exactly the mechanism the v90 engine reproduces.
//
//        Coverage 103 → 103 live (parent pharmacolite already counted)
//        / 25 dead (+haidingerite — mirrors tincalconite/thenardite/
//        meta-autunite-trio/pararealgar) / 0 stale. seed42_v90.json
//        captures the v88 → v90 grow_pharmacolite cleanup (removing
//        the thermal destruction branch may shift seed-42 output in
//        scenarios where pharmacolite happened to encounter T>80
//        — empirically: none).
//
//        v88 commit message had two pieces of residual debt this commit
//        partially closes:
//          1. "haidingerite isn't in the catalog" — CLOSED here.
//          2. "modeled as crystal-destruction" — CLOSED (paramorph
//             now properly preserves the crystal).
//        Open debt remaining from v88 (NOT addressed in v90):
//          * As³⁺ vs As⁵⁺ split. The simulator's single fluid.As pool
//            still can't represent oxidation state distinctly. The
//            sulfide-suppression proxy gate in supersaturation_
//            pharmacolite is a band-aid; the principled fix is a
//            Phase-4-redox-style refactor splitting As³⁺ + As⁵⁺ into
//            separate fields. Out of scope for v90.
//   v91 — expects_species lists updated for v85-v90 additions
//        (2026-05-19). Documentation-only update; no engine, baseline,
//        or chemistry changes. Closes residual debt from the v85-v90
//        mineral push: the new minerals were firing in their canonical
//        scenarios but the scenarios' expects_species lists hadn't
//        been updated to reflect the additions.
//
//        Scenarios + additions (each verified as stable per-seed
//        nucleation, not transient RNG drift, against the v90 baseline):
//          gem_pegmatite           +lepidolite, +cassiterite
//            (the Cruzeiro LCT-pegmatite signature; Cassedanne 1991
//             documents both at the type locality)
//          radioactive_pegmatite   +lepidolite, +cassiterite
//            (Cornwall Sn-U districts; classic LCT + greisen-stage
//             pair)
//          schneeberg              +cassiterite, +pharmacolite,
//                                   +haidingerite
//            (the Erzgebirge tin heritage + Jáchymov five-element-
//             vein Ca-arsenate suite per Handbook of Mineralogy)
//          supergene_oxidation     +conichalcite, +pharmacolite,
//                                   +haidingerite
//            (Tsumeb-style Ca-Cu-As supergene; conichalcite is in the
//             Pinch & Wilson 1977 Tsumeb monograph)
//
//        Verified per-seed firing at v90 baseline (seed 42):
//          gem_pegmatite:           cassiterite=7, lepidolite=3
//          radioactive_pegmatite:   cassiterite=4, lepidolite=4
//          schneeberg:              cassiterite=4, haidingerite=1
//                                   (pharmacolite transformed in-situ
//                                    to haidingerite per v90 dehydration)
//          supergene_oxidation:     conichalcite=4, pharmacolite=2,
//                                   haidingerite=3
//
//        Test updates:
//          * tests-js/lepidolite.test.ts: the v86 stub "gem_pegmatite
//            expects_species declaration carries lepidolite is
//            optional (not required)" became "...includes lepidolite
//            (added v91)". The previous comment documented v86's
//            transitional state; v91 closes it.
//
//        Calibration: ZERO baseline drift. expects_species is a
//        declarative scenario-spec field; the engine doesn't read it
//        for nucleation decisions. seed42_v91.json byte-identical to
//        seed42_v90.json.
//
//        This completes the v85-v90 mineral push closure: 6 new
//        minerals (meta-autunite trio + lepidolite + conichalcite +
//        pharmacolite + cassiterite + haidingerite), 1 new fluid field
//        (Sn), 1 mechanic cleanup (pharmacolite thermal-destruction
//        stub → proper paramorph transformation), 1 documentation
//        update (expects_species). The four canonical pegmatite +
//        supergene scenarios now declare their full v90 assemblage.
//   v92 — As(III) vs As(V) state split (2026-05-19, Phase 4d redox
//        infrastructure). Closes the final residual debt from the
//        v85-v90 mineral push: "The simulator's single fluid.As pool
//        still can't represent oxidation state distinctly. The
//        sulfide-suppression proxy gate in supersaturation_pharmacolite
//        is a band-aid; the principled fix is a Phase-4-redox-style
//        refactor."
//
//        New helpers in 20c-chemistry-redox.ts:
//          arsenicOxidizedFraction(fluid)  → fraction in [0,1] of
//                                            fluid.As sitting as As(V)
//          arsenateAvailablePpm(fluid)     → As(V) ppm
//          arseniteAvailablePpm(fluid)     → As(III) ppm
//
//        Geochemistry model:
//          1. SULFIDE GATE (hard suppression): when fluid.S > 50 AND
//             fluid.O2 < 1.0, As stays as As(III) regardless of bulk
//             Eh. Thioarsenite complexes (H₂AsS, H₃AsS₃) are
//             thermodynamically stable across the entire Eh range of
//             any sulfide-rich fluid. References: Helz et al. 1995
//             (GCA 59:4591-4604), Stumm & Morgan 1996 Aquatic
//             Chemistry 3rd ed. Ch.8.
//          2. O2-DRIVEN OXIDATION (smooth ramp): with S < 50 ppm
//             (sulfide depleted by sulfide-mineral precipitation),
//             As(V) fraction grows linearly from 0 at O2=0.1 to 1 at
//             O2=1.5. Reference: Bowell et al. 2014 (Reviews in
//             Mineralogy and Geochemistry 79).
//
//        Refactor scope — 15 engines + 1 cleanup:
//          As(V) consumers (8 arsenate engines in 30-supersat-arsenate.ts +
//          6 uranyl P/As/V fork engines in 38-supersat-phosphate.ts).
//          As(III) consumers (1 native_arsenic in 36-supersat-native.ts +
//          6 arsenide/sulfarsenide engines in 41-supersat-sulfide.ts).
//          Cleanup: REMOVED the v88 inline `if (fluid.S > 50) return 0`
//          band-aid in supersaturation_pharmacolite. The new helper
//          encodes the thioarsenite-stability geochemistry directly;
//          the band-aid is now redundant.
//
//        Calibration drift on schneeberg + supergene_oxidation + bisbee
//        (initial pre-regen) — three scenarios where As-state
//        distinction shifts engine firing. seed42_v92.json captures
//        the drift; other scenarios byte-identical to v91 (no
//        As-state-dependent engines in their assemblages).
//
//        Tests: arsenic-state-split.test.ts adds 16 helper + integration
//        pins. Three new helpers exposed via setup.ts EXPORTS for
//        direct engine pins.
//
//        References (full helper docstring in js/20c-chemistry-redox.ts):
//          * Helz G.R. et al. (1995) "Oligomerization in As(III)
//            sulfide solutions." Geochim. Cosmochim. Acta 59:4591-4604.
//          * Stumm W. & Morgan J.J. (1996) Aquatic Chemistry 3rd ed.
//            Ch. 8.
//          * Bowell R.J. et al. (2014) "The Environmental Geochemistry
//            of Arsenic." Reviews in Mineralogy and Geochemistry 79.
//   v93 — Cu-silicate pair: dioptase + shattuckite (2026-05-19).
//         Closes a glaring catalog gap: dioptase is THE Tsumeb world
//         reference (type locality Altyn-Tyube, Kazakhstan; described
//         Hauy 1797; world-class display crystals from Tsumeb 2nd
//         oxidation zone). Shattuckite is named after the Shattuck mine
//         at Bisbee (Schaller 1915) — having Bisbee in the simulator
//         without shattuckite was geologically untenable.
//
//         Both fire in the same chemical regime — Cu + SiO₂ oxidizing
//         supergene with carbonate locally exhausted — but pull apart
//         on pH + Cu:Si stoichiometry:
//           dioptase    CuSiO₃·H₂O      pH 6.5-8.0  Cu:Si = 1:1
//           shattuckite Cu₅(SiO₃)₄(OH)₂ pH 7.5-9.0  Cu:Si = 5:4
//
//         Defining mechanic: both engines require CO₃ low (dioptase
//         CO₃ < 50; shattuckite CO₃ < 30). High carbonate routes Cu
//         to malachite/azurite; only after the local carbonate is
//         exhausted by prior malachite/azurite precipitation does the
//         Cu-silicate window open. This is THE Tsumeb 2nd-oxidation-
//         zone paragenesis (Keller 1977).
//
//         Shattuckite carries a strong replacement-of-malachite
//         preference: net 5 Cu₂(CO₃)(OH)₂ + 8 SiO₂ → 2 shattuckite +
//         5 CO₂↑ + 3 H₂O (Evans & Mrose 1977). Substrate priority
//         encodes this:
//           dioptase:    calcite > dolomite > chrysocolla > malachite
//           shattuckite: malachite (replacement) > azurite (replacement)
//                        > chrysocolla > vug wall
//
//         Habit dispatch:
//           dioptase: short_prismatic_emerald (default Tsumeb iconic) /
//                     long_prismatic_acicular (Kaokoveld, excess > 1.0) /
//                     druzy_overgrowth (on chrysocolla) /
//                     pseudomorph_after_calcite (late vadose)
//           shattuckite: acicular_tuft (default Bisbee) /
//                        spherulitic_rosette (Kaokoveld + high σ) /
//                        pseudomorph_after_malachite (Bisbee signature) /
//                        pseudomorph_after_azurite (Mesopotamia) /
//                        massive_granular (low-σ fill)
//
//         No new fluid fields — existing Cu/SiO₂/CO₃/Cl/SO₄/pH/O₂
//         cover the chemistry. The bisbee + supergene_oxidation
//         scenarios already carry the chemistry; these engines simply
//         pick up Cu-Si signal that was previously routed exclusively
//         to chrysocolla.
//
//         References (research dossier 2026-05-19, primary literature):
//           * Hauy R.J. (1797) — original dioptase description, type
//             locality Altyn-Tyube.
//           * Schaller W.T. (1915) "Four new minerals." J. Wash. Acad.
//             Sci. 5:7. — shattuckite type description.
//           * Ribbe P.H., Gibbs G.V., Hamil M.M. (1977) "Refinement of
//             the structure of dioptase." Am. Min. 62:807-811.
//           * Evans H.T. & Mrose M.E. (1977) "The crystal chemistry of
//             the hydrous copper silicates, shattuckite and plancheite."
//             Am. Min. 62:491-502.
//           * Keller P. (1977) "Paragenesis of Tsumeb minerals."
//             MinRec 8(3) — the Tsumeb shattuckite-plancheite-dioptase
//             sequence.
//           * Cairncross B. & Bahmann U. (2006) "The Kaokoveld plateau,
//             Namibia." MinRec 37:137-164.
//           * Anthony, Bideaux, Bladh, Nichols Handbook of Mineralogy
//             v.II (Silicates).
//
//         Coverage 103 live → 105 live (+2 minerals); 25 paramorph-only.
//         Tests 583 → 600 (+17). Calibration drift on bisbee +
//         supergene_oxidation only (Cu-Si fluids fire the new engines);
//         other 22 scenarios byte-identical to v92.
//   v94 — Enargite: Cu₃AsS₄ high-sulfidation primary Cu-As-S sulfosalt
//         (2026-05-19). The Cu-As-S endmember at HIGH f(S₂) and low pH
//         — Butte MT, Chuquicamata Chile, Bisbee AZ primary, Tsumeb
//         upper sulfide, Lepanto, El Indio, Goldfield, Quiruvilca.
//
//         Discriminator from tennantite (Cu₁₂As₄S₁₃ intermediate-
//         sulfidation): the simulator has total S not f(S₂), so the
//         proxy is sulfidation_proxy = log10(S+1) - pH. Combined with
//         pH < 4.5, enargite fires in the high-sulfidation field;
//         tennantite occupies pH 3-7 with proxy 0.5-1.5.
//
//         Polymorph dispatch: enargite (orthorhombic Pnm2₁) ≥ 320°C,
//         luzonite (tetragonal I-42m) < 320°C — same Cu₃AsS₄
//         composition, different symmetry (Posfai & Buseck 1998). The
//         engine fires uniformly; grow_enargite sets crystal._polymorph
//         + mineral_display = 'luzonite' below the inversion T.
//
//         Habit dispatch:
//           striated_prismatic     — default, c-axis striations + {110}
//                                    cleavage, Butte/Quiruvilca primary
//           pseudo_hexagonal_trilling — excess > 1.4, 60° twin on {320}
//           tabular                — lower σ {001} tablets
//           massive_granular       — ore mode
//
//         Uses arseniteAvailablePpm (v92 As-state helper) — enargite
//         carries As(III) in [AsS₃]³⁻ groups, not arsenate As(V).
//
//         Substrate priority: pyrite > chalcopyrite > vug wall.
//         RNG-cascade guard via sigma < 1.0 early-out.
//
//         Supergene oxidation releases big As + acid budget:
//           Cu₃AsS₄ + O₂ + H₂O → Cu²⁺ + AsO₄³⁻ + SO₄²⁻ + H⁺
//         — the Butte/Chuquicamata acid mine drainage As signature.
//
//         References:
//           * Einaudi M.T., Hedenquist J.W., Inan E.E. (2003)
//             "Sulfidation state of fluids in active and extinct
//             hydrothermal systems." SEG Special Publication 10:
//             285-313. THE canonical f(S₂)-T sulfidation diagram.
//           * Sack R.O. & Loucks R.R. (1985) "Thermodynamic properties
//             of tetrahedrite-tennantites." Am. Min. 70:1270-1289.
//           * Posfai M. & Buseck P.R. (1998) — enargite/luzonite phase
//             relations.
//           * Brimhall G.H. (1979, 1980) — Butte primary stage paragenesis.
//
//         Calibration drift: TBD per baseline regen.
//         Coverage 105 live → 106 live (+1 mineral); 25 paramorph-only.
const SIM_VERSION = 94;

