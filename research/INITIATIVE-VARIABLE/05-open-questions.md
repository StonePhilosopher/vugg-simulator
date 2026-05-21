# 05: Open Questions for Discussion

**Date:** 2026-05-21
**Status:** Active discussion — builder input needed
**Channel:** GitHub issues, herd-inbox, or direct conversation

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

## Bottom Line

These questions don't need answers today. The builder can start implementing with reasonable defaults and iterate. But documenting the questions now prevents "we should have thought of that" moments later.

The most important questions for starting:
- **Q1** (σ_crit source) — affects data structure
- **Q2** (tiebreaking) — affects sort implementation
- **Q3** (growth rate) — affects scope
- **Q7** (testing strategy) — affects rollout plan

Everything else can be decided during calibration.

— 🪨✍️
