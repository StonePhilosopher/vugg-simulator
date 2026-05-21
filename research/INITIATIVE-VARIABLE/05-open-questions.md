# 05: Open Questions — Resolutions (Rev 2)

**Date:** 2026-05-21 (rev 2 same day)
**Status:** Q1-Q12 resolved by boss; Q-A through Q-J resolved by builder + boss collaboration
**Channel:** Resolved via direct dialog 2026-05-21

---

## Q1: Should σ_crit be derived from engine gates or explicitly specified?

**Option A: Derive from engine gates**
- Each mineral's engine has a threshold where σ transitions from "no nucleation" to "possible"
- Extract this value programmatically
- Pro: Always accurate, never drifts from engine reality
- Con: Complex to extract, may vary between engine implementations

**Option B: Explicit spec field**
- Add `criticalSupersaturation` to `data/minerals.json`
- Pro: Simple, clear, documented
- Con: May drift from engine thresholds if not maintained

**Option C: Both**
- Spec field exists as override
- If absent, derive from engine
- If present but diverges from engine, warn in tests

**Professor's preference?**

---

## Q2: How do we handle tiebreaking?

When two minerals have equal final initiative:

**Option A: Base σ wins**
- Higher base σ = higher growth potential
- Pro: Deterministic, geochemically meaningful
- Con: May not capture stochasticity of real nucleation

**Option B: Surface energy wins**
- Lower γ = faster nucleation kinetics
- Pro: More physically accurate
- Con: More complex, requires γ data for all minerals

**Option C: Fixed fallback order**
- Use current fixed order as tiebreaker
- Pro: Backward compatible, predictable
- Con: Defeats purpose of initiative

**Option D: Random (stochastic mode only)**
- d3-2 roll as tiebreaker
- Pro: Captures natural variability
- Con: Breaks determinism, harder to test

**Professor's preference?**

---

## Q3: Should initiative affect growth rate or only nucleation order?

**Option A: Order only (simpler)**
- Initiative determines which mineral nucleates first
- Growth rate is unchanged from current system
- Pro: Simpler, less cascade risk
- Con: Doesn't capture "fast grower wins" effect

**Option B: Order + growth rate multiplier**
- High initiative → faster growth rate
- Low initiative → slower growth rate
- Pro: More realistic (high σ minerals grow faster)
- Con: More cascade-prone, harder to balance

**Professor's preference?**

---

## Q4: How deterministic should the system be?

**Option A: Pure deterministic (default)**
- Same input → same output every time
- No random component
- Pro: Easy to test, easy to calibrate
- Con: Doesn't capture nucleation stochasticity

**Option B: Small random (future stochastic mode)**
- Roll = base + modifiers + d3-2
- Pro: Captures some natural variability
- Con: Same seed → same output (if seed controls initiative roll)

**Option C: Full stochastic (distant future)**
- Per-nucleation-event roll
- Pro: Most realistic
- Con: Requires Monte Carlo baselines (100+ runs)

**Recommendation:** Start with A. Add B only after we have empirical data.

---

## Q5: Should competition penalty consider stoichiometric coefficients?

**Option A: Simple (any overlap = penalty)**
- Two minerals sharing Cu → both get -1
- Doesn't matter if one needs Cu:1 and the other Cu:10
- Pro: Simple, predictable
- Con: May over-penalize minerals with trace Cu needs

**Option B: Weighted by coefficient ratio**
- Penalty = -1 × (min coefficient / max coefficient)
- Cu:1 vs Cu:10 → penalty = -0.1 (small)
- Cu:5 vs Cu:5 → penalty = -1.0 (full)
- Pro: More accurate
- Con: More complex, requires coefficient data

**Option C: Weighted by total debit**
- Penalty proportional to estimated fluid debit
- Pro: Most accurate
- Con: Requires growth simulation to calculate debit before initiative

**Professor's preference?**

---

## Q6: Should substrate epitaxy give a bonus or penalty?

When mineral B nucleates on mineral A:

**Option A: Always penalty (competition)**
- B drains fluid that A needs
- A gets -1 initiative
- Pro: Simple, always applicable
- Con: Doesn't capture catalytic surfaces

**Option B: Context-dependent**
- If A's surface lowers B's γ → B gets +1, A unchanged
- If A and B compete for cations → both get -1
- Pro: More realistic
- Con: Requires surface-catalysis data

**Option C: User-configurable**
- Add `catalytic_for: ['B', 'C']` to mineral spec
- Pro: Flexible, extensible
- Con: Maintenance burden

**Professor's preference?**

---

## Q7: How do we test without losing all baselines?

**Option A: Flag-gated gradual rollout**
- v126: Initiative exists but default OFF
- v127: Enable in 5 select scenarios
- v128: Enable in 15 scenarios
- v129: Enable globally
- Pro: Controlled, manageable drift
- Con: Longer rollout

**Option B: Accept all drift at once**
- Enable globally in v126
- Regenerate all baselines
- Pro: Faster
- Con: May hide regressions in cascade of changes

**Option C: Dual baseline system**
- Keep old baselines for regression detection
- Add new baselines for initiative mode
- Pro: Best of both worlds
- Con: Double maintenance burden

**Professor's preference?**

---

## Q8: Should temperature modifier use scenario temperature or mineral preferred temperature?

**Option A: Scenario temperature (fluid.T)**
- Modifier = f(fluid.T - mineral.optimalT)
- Pro: Mineral adapts to its environment
- Con: A mineral with wide range may get penalized in extreme scenarios

**Option B: Mineral preferred temperature**
- Modifier = f(mineral.optimalT - scenario_avg_T)
- Pro: Fixed per mineral, easier to calibrate
- Con: Doesn't adapt to event-driven temperature changes

**Option C: Both**
- Base modifier from mineral spec
- Event adjustment from current fluid.T
- Pro: Most accurate
- Con: Most complex

---

## Q9: Should we model induction time?

Real nucleation has a delay: fluid reaches σ > σ_crit, but nucleation doesn't happen instantly. The delay depends on σ, T, and surface area.

**Option A: No induction time (current behavior)**
- If σ > threshold, nucleation happens this step
- Pro: Simple, deterministic
- Con: Unrealistic for slow-nucleating minerals (quartz)

**Option B: Simple induction counter**
- Each mineral tracks steps_above_threshold
- Nucleation only when counter > induction_steps
- induction_steps = f(σ, T, γ)
- Pro: More realistic
- Con: Adds state, harder to test

**Option C: Probabilistic induction**
- Each step, chance of nucleation = f(steps_above_threshold)
- Pro: Captures stochasticity
- Con: Non-deterministic

**Professor's preference?**

---

## Q10: Should initiative be visible in the UI?

**Option A: Debug panel only**
- Toggleable panel showing initiative order, modifiers
- Pro: Doesn't clutter main view
- Con: Hidden from most users

**Option B: Crystal tooltip**
- Hover over crystal shows "Initiative: 12 (base 10, temp +1, edge -1, competition +2)"
- Pro: Contextual, educational
- Con: Tooltip clutter

**Option C: Step log**
- Each step's log includes initiative order
- Pro: Persistent, reviewable
- Con: Verbose

**Option D: All of the above**
- Pro: Comprehensive
- Con: More code

---

## Q11: What about minerals with no preferredTempRange?

**Option A: "Always comfortable"**
- No range = no modifier ever
- Pro: Simple
- Con: Doesn't capture minerals that are genuinely T-insensitive

**Option B: Default "moderate" range**
- No range = default [0, 1000, 500]
- Pro: All minerals have some T preference
- Con: May be wrong for extreme minerals

**Option C: Mineral-family defaults**
- Carbonates default to calcite-like range
- Silicates default to quartz-like range
- Pro: Geochemically informed
- Con: Requires family taxonomy

---

## Q12: Should the initiative system replace or supplement stoichiometry?

**Option A: Supplement**
- Stoichiometry still controls fluid debit
- Initiative controls nucleation order
- Pro: Both systems work together
- Con: More complex

**Option B: Partial replacement**
- Stoichiometry still exists
- But initiative also considers "effective debit" (competition-adjusted)
- Pro: More accurate
- Con: Harder to reason about

**Option C: Keep separate**
- Stoichiometry = what happens after nucleation
- Initiative = what happens before nucleation
- Pro: Clear separation of concerns
- Con: May miss interactions

---

---

## RESOLUTIONS (Rev 2, 2026-05-21)

### Q1 — σ_crit source: **Option A (extract from engine gates)** via engine-exported constants
The boss called for build-time extraction. The builder refined: don't parse source files (fragile to refactors); have engines export `MINERAL_GATES_<mineral>` structured constants directly. The library card display reads from the same constants. One source of truth, no drift. See `06-engine-gates-refactor.md` for the migration scope.

### Q2 — Tiebreaking: **Option A (base σ wins), then fixed registry order**
Higher base σ goes first. If still tied, use the existing MINERAL_ENGINES iteration order as deterministic fallback. Stochastic tiebreaking deferred to v131+ stochastic-mode work.

### Q3 — Growth rate: **Option B (order + growth rate via cation-level rationing)**
Initiative determines both order AND who gets what share of the cation budget when broth is limiting. Implemented via graduated competition + Liebig's-law-of-the-minimum (see `07-graduated-competition.md`).

### Q4 — Determinism: **Option A (pure deterministic)** for v128
Stochastic mode (Option B) deferred to v131+. Same input → same output remains the working contract.

### Q5 — Competition penalty: **Option A (simple any-overlap = penalty)**
Stoichiometric coefficients don't factor into the modifier value (Option A); rationing IS already proportional to the coefficient via mass balance (a mineral needing Cu:10 debits 10x more Cu than Cu:1, so its share already reflects its demand). Adding coefficient-weighted modifiers on top would double-count.

### Q6 — Substrate epitaxy: **Option B (context-dependent)** in v130, not v128
Defer the substrate work. v128 lands without epitaxy modifier; v130 adds catalytic/competition/encapsulation modes. The proposal already noted this in §4 Phase 4.

### Q7 — Testing strategy: **Option B (accept all drift at v128)**
User greenlight to regenerate all 30 baselines as `seed42_v128.json`. No flag-gated gradual rollout. The 5 calibration assertions in PROPOSAL §4.1 are the new validation target.

### Q8 — Temperature modifier: **Option A (scenario temperature)**
Modifier = f(fluid.T, mineral.optimalT). Mineral adapts to its environment per-step. Event-driven T changes (e.g., schneeberg cooling event) affect modifier in real time.

### Q9 — Induction time: **DEFERRED to v131+**
Graduated growth does NOT capture induction-time physics — it affects post-nucleation rate, not pre-nucleation delay. Explicitly acknowledged in the proposal §3.1 rev 2. v131+ adds a proper induction counter (steps_above_threshold per mineral) if calibration shows we need it.

### Q10 — UI visibility: **Option D (all of the above)** — debug panel + library card + step log
The user specifically asked for visibility in the library. v127 adds the "Competitiveness profile" section to the mineral catalog card. v128 adds the step-log line per mineral ("dioptase: initiative=12, share=0.34, grew 28 µm"). Debug panel in v127.

### Q11 — Default for minerals with no preferredTempRange: **Option B (default "moderate" [0, 1000, 500])**
Until each mineral has a calibrated range, default to a wide-permissive range that gives no modifier. Calibration in v129 narrows ranges per literature.

### Q12 — Initiative vs stoichiometry relationship: **Option C (keep separate)**
Stoichiometry = what happens after growth (fluid debit). Initiative = what happens before/during growth (order + share). Clear separation of concerns. The cation-level rationing layer bridges them: initiative shares determine how the stoichiometric debit is allocated when broth is limiting.

---

### Q-A — Physics-only vs modifier-only competition: **modifier-only**
Avoids double-counting. Physics (σ recalc between minerals) deferred to future flag-gated option.

### Q-B — σ_crit source: **extract from engine-exported gates constants** (not source parsing)
See Q1 resolution and `06-engine-gates-refactor.md`.

### Q-C — Per-zone vs global initiative: **global for v128, per-zone v132+**

### Q-D — RNG calls: **SeededRandom stays for geometry/placement; initiative replaces Shape-B for ordering**
Both coexist. Initiative handles when, SeededRandom handles how.

### Q-E — Rarity ground-truth: **v125-v126 cascade record short-term, real-world abundance long-term**

### Q-F — Multi-cation penalty: **cascade ripple penalty**, separate from per-cation competition penalty
`-min(uniqueCationCount - 1, 2)` capped at -2. Applied ADDITIVELY to per-cation competition penalty. Lepidolite gets -2 ripple + -2 competition = -4 final.

### Q-G — Sharing math: **power-law k=2** in proportional regime, **80/20 winner-takes-most** beyond gap > 3
See `07-graduated-competition.md` for the full math.

### Q-H — fullAllocation semantics: **cation-level rationing**
Only triggers when desired total debit > available. Otherwise full growth. Liebig's law of the minimum determines actual thickness.

### Q-I — `competitionMode` scenario parameter: **defer to v129 calibration**
Ship v128 with one global behavior (gap=3 threshold, k=2 power-law). If specific scenarios need different modes, add per-scenario overrides in v129.

### Q-J — Library visibility concretely: **Competitiveness profile card section** in v127
Reads from `MINERAL_GATES_<mineral>` exports. Shows σ_crit, T sweet-spot, competition group, base initiative formula, cascade ripple count. Library card lives in `js/9X-ui-library.ts`.

---

## Bottom Line (Rev 2)

All open questions resolved. Implementation can proceed:
- v127: engine gates refactor + initiative infra + library card (no behavior change)
- v128: graduated competition lands, all baselines regenerated, 5 calibration assertions validate
- v129: modifier tune
- v130: substrate/epitaxy
- v131+: induction, per-zone, stochastic

— 🪨✍️ + builder + boss (rev 2)
