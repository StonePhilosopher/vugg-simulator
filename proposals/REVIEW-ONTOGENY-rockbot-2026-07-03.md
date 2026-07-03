# REVIEW — PROPOSAL-ONTOGENY-2026-07-03.md
**Reviewer:** 🪨✍️ (rockbot)
**Date:** 2026-07-03
**Status:** APPROVED with comments — strong work, ship as-is, address in first rung design doc

---

## Bottom Line

This is rigorous, honest, and cheaper than the "big ask" sounds because the census found existing infrastructure (per-face Wulff kernel, invisible engulfment, hard-coded selection). The science is verified where claimed, flagged where not. The 8 points below are interface/integration questions, not fundamental flaws.

---

## Detailed Comments

### 1. O1–C1 State Interface Needs Sketch (MEDIUM)

The proposal says O1's modifiers start with "exposure geometry now, C1 depletion field later." This is the right sequencing, but the upgrade path should be explicit:

- **What state does O1 write?** Per-face modifier values (exposure, neighbor shadow, coverage)
- **What state does C1 write?** Per-cell σ history, per-direction depletion
- **How does C1 feed O1?** Does C1 write into the same modifier slots? Does it replace or augment geometric modifiers?
- **Interface proposal:** O1 modifiers are a sum or product: `h_i_effective = h_i_base × f(exposure_geometry) × g(C1_depletion)`. C1 adds a multiplicative term; O1 ships with `g()` identity.

This matters for testability. If O1 tests only geometric modifiers, C1 integration shouldn't break them.

### 2. O2 "Render-Only" Claim Needs Scrutiny (MEDIUM)

The table says O2 is "render-only candidate (derived from existing positions/sizes)" but the science says weights = "the two crystals' integrated growth, NOT the midplane."

**Tension:** Integrated growth is history, not visible state. Approximating it from current sizes + species rates is possible but needs error budget.

**Options:**
- A) Approximate from current sizes (render-only, approximate weights)
- B) Store integrated growth per crystal (SIM bump, exact weights)
- C) Hybrid: approximate first, instrument against exact when B lands

**Recommendation:** Pick A or C and flag the approximation explicitly. The proposal's rigor on the verified-vs-synthesized line (risk #4) should apply here too.

### 3. "No Third Mechanism" Is Too Absolute (LOW)

> "Interpenetration has no third mechanism: it is either competitive contact (induction) or lattice-controlled (epitaxy, misfit ≲8%)."

This is a useful scope boundary, but nature has edge cases:
- **Syn-epitaxy:** Two phases nucleate simultaneously and interpenetrate without clear substrate relationship
- **Dissolution-recrystallization overgrowth:** Foreign substrate partially dissolved, new phase recrystallizes — not true epitaxy

**Fix:** Acknowledge these as "out of scope for the current sim" rather than "nonexistent." This protects against future "but what about..." when a specimen contradicts the binary.

### 4. O3 RNG Discipline Needs Seed Derivation Sketch (MEDIUM)

The proposal warns that O3's orientation draw "touches the nucleation RNG cascade" and says "per-mineral seeds isolate the draw" but doesn't specify how.

**Question:** Is the orientation branch derived as `seed ^ mineral_id ^ nucleation_index ^ ORIENTATION_BRANCH`? Or something else?

**Why it matters:** The existing seed-42 baselines depend on deterministic redox/mineral/position branching. Adding orientation without changing other branches preserves baselines. Changing the seed derivation breaks them.

**Recommendation:** Sketch the branch constant and assert in tests that non-orientation properties remain identical when orientation is enabled/disabled.

### 5. W-A/W-F Cross-Reference Missing (MEDIUM)

Section 4 lists new ontogeny-specific metrics (contact fraction, asymmetry index, survivor density, intergrowth count) but these don't appear in the ROADMAP's W-A A3 table.

**Options:**
- Extend A3 to include these metrics (A3 becomes "L" from "M")
- Add an A3.5 or A6 rung for ontogeny metrics
- Clarify that these are post-hoc analysis tools, not bench-gated acceptance metrics

**Recommendation:** The proposal should reference W-A explicitly: "See W-A §X for the bench integration of these metrics." The ROADMAP should list them in A3 or a successor.

### 6. Frenzel & Woodcock Needs Verification (LOW)

Flagged as "[from-memory, verify at build]" — but this is a load-bearing citation for O8 (cockade). The whole point of the 15-agent adversarial verification was to catch these.

**Recommendation:** Verify now, or downgrade O8's cockade to "placeholder pending verification" and note that the classifier (O8's first half) doesn't depend on it.

### 7. O8 Classifier Is Undersized (LOW)

Sized as "S+M" but "post-hoc aggregate labeler" is a machine learning problem disguised as a simple rule engine. Features, training data, and validation aren't specified.

**Recommendation:** Either:
- Size as "L" with a research phase, OR
- Scope down to manual scenario-tagging (human labels the output, classifier = documentation), OR
- Defer to a future workstream (W-H: texture classification)

The first half (Dong et al. vocabulary) is just labels. The second half (automatic assignment) is hard.

### 8. Add Fidelity Budget Per Tier (NEW — HIGH VALUE)

The ROADMAP defines T0→T4 but doesn't say how close is close enough. Add an explicit **fidelity budget:**

| Tier | Claim | Error Budget | How Measured |
|---|---|---|---|
| T0 | Genre identification | Human expert consensus (>2 agree) | Blind survey |
| T1 | Locality identification | Same field guide page | Image-corpus method |
| T2 | Metric matching | Bench measurement uncertainty | A4 harness, within error bars |
| T3 | Inverse-fit fluid history | Geological plausibility bounds (T, pH, fO₂) | PHREEQC cross-check + literature ranges |
| T4 | Forward prediction | Parameter uncertainty envelope | Ensemble runs, 95% CI |

This lets you allocate effort: don't spend T4 precision on T0 phenomena.

**Stop condition for T4:** "Adding a new specimen doesn't require a new fitted parameter — existing physics-constrained ensemble predicts it within bench error bars." This is the ML concept of generalization, applied to geological simulation.

---

## Positive Observations Worth Preserving

1. **The census finding is genuinely valuable.** Discovering that the Wulff kernel already stores per-face {n,d} and that engulfment exists but is invisible — these are not trivial. They make the arc cheaper and more credible.

2. **The verified-vs-synthesized line is the right rigor.** Flagging Apollonius closed form and hopper-recovery as modeling syntheses (risk #4) — this is how science should work.

3. **The Steno pin is the right discipline.** "Never tilt a normal to fake asymmetry" — this prevents the classic beginner error and keeps the physics honest.

4. **The negative results are as valuable as the positive ones.** Gravity not being an independent face-rate law, equal-weight Voronoi being wrong — these prevent future wrong turns.

5. **The ROADMAP's data-availability map directly answers the boss's stated worry.** Only face-specific step kinetics is truly paywalled; the catalog substitutes. Everything else is free and verified.

---

## What to Do With These Comments

**Option A (recommended):** Ship the proposal as-is. Address each point in the first rung's design doc (O0/O1) and in the ROADMAP's next revision. None of these are blockers.

**Option B:** If any of these feel like they change the proposal's structure, do a quick revision before shipping. My ranked list of "might actually matter":
- #1 (O1-C1 interface) — affects implementation order
- #8 (fidelity budget) — affects project framing
- #2 (O2 render-only) — affects scope claim
- #4 (O3 RNG) — affects test discipline

The rest are polish.

---

## One Addition for the Builder

Consider a **workstream W-G: atomistic parameterization** (future, research). The face-specific rate laws (C2) get their parameters from atomistic models (BCF theory, Kossel model) — but those parameters are the paywalled data. The bench substitutes for now, but if someone publishes open kinetics tables (or if you get interlibrary loan access), this is where they'd plug in. Naming it now keeps the door open.

---

*Reviewed with the patience of stone and the weight of geological time. The sediment is good; a few more layers and it'll be ready to carve.*
