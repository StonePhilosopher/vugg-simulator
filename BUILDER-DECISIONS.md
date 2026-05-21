# Builder Decision Log — Initiative Proposal v128

**Date:** 2026-05-21 13:47 EDT
**Decision authority:** Professor (Colin)
**Communicated by:** Rockbot

---

## Builder Questions (G, H, B-revised, I, J, F-revised)

### G. Sharing Math — Power-Law k=2
**Decision: YES**

Power-law with k=2 over linear. Calibrated against v125 cascade record. More aggressive dominance for small initiative gaps, closer to real nucleation-rate ratios.

### H. fullAllocation Semantics — Cation-Level Rationing (Option C)
**Decision: YES**

Cation-level rationing only. After all minerals compute desired thickness_um, sum desired debit per cation. If desired_C > fluid[C], ration that cation across competitors weighted by initiative. Only triggers when broth is genuinely limiting. Non-competing minerals unaffected. Preserves stoichiometric integrity. Matches Liebig's law of the minimum.

### B-revised. Engine Gates as Exported Constants
**Decision: YES**

Refactor 25 engine files to export `SUPERSAT_GATES_mineralName` constants. One-time migration cost. `data/sigma-crit-generated.json` built from these constants. Guard test fails if registered engine lacks gates. Pays off for library cards, σ_crit single source of truth, and future engine work.

### I. competitionMode Scenario Parameter — Defer to v129
**Decision: YES**

Ship v128 with one global 'auto' mode. Add scenario overrides in v129 if specific scenarios need them. Don't add complexity before the base system works.

### J. Library Card Mockup
**Decision: YES**

Builder drafts mockup for "Competitiveness profile" card: σ_crit + T sweet-spot + competition group + base initiative formula. Also "Rarity tier" derived from base initiative under typical conditions. Include "Why is this rare?" narrator-style explanation linking initiative + competition + edge-of-gate.

### F-revised. cascadeRipplePenalty (Additive)
**Decision: YES**

Rename multi-cation penalty to `cascadeRipplePenalty` or `stoichiometricComplexity`. Captures cascade ripple potential — 5-cation mineral perturbs more σ-gates than 2-cation. Applied ADDITIVELY to per-cation competition penalty.

Example: lepidolite in radioactive_pegmatite:
- −2 cascadeRipple (5 cations)
- −2 per-cation competition (K, Li, Al, SiO2, F overlap)
- Total: −4 (matches v126 empirical: 11 breaks)

---

## Additional Decisions (from Professor's earlier answers, confirmed)

### A. Modifier-Only Competition (v128)
**Decision: YES**

Compute σ once per step, use competitionModifier as proxy. Physics-only (recalc σ between minerals) as future option. Modifier-only is faster, more legible, less cascade-prone for initial landing.

### C. Global Initiative (v128)
**Decision: YES**

Global for v128, per-zone as v132+ future. Per-zone requires per-cell fluid tracking that doesn't exist yet.

### D. RNG Coexistence
**Decision: YES**

Initiative replaces Shape-B for ordering. SeededRandom stays for crystal geometry/placement. Both systems coexist — initiative handles when, SeededRandom handles how.

### E. Rarity Ground-Truth
**Decision: BOTH**

v125 cascade record for short-term calibration, real-world abundance for long-term validation. Proustite (rare) should have low-initiative profile. If it doesn't, modifiers are wrong.

### Q1. σ_crit Extraction from Engines
**Decision: YES**

Extract programmatically from engine gates (not manual spec fields). Add divergence guard test. Single source of truth.

### Q5. Coefficient-Weighted Competition
**Decision: DEFER**

Cu:1 vs Cu:10 different weight is geochemically correct but adds complexity. Defer to v130+ calibration arc if needed.

### Q9. Induction Counter
**Decision: DEFER**

True edge-of-gate model = track steps_above_threshold, nucleate when counter > induction_steps(σ,T,γ). Defer to v131+. v128's perturbation-sensitivity flag is sufficient proxy.

---

## Revised Sequencing

**v127 (planning):** Builder confirms G/H/I/J/B-revised/F-revised + science fixes in canonical docs. Engine gates refactor scoped.
**v128 (infrastructure):** Engine gates exported as constants. js/20-initiative.ts lands with base initiative + linear modifiers + sort/log. Library card section drafted. NO graduated allocation yet. Old baselines deleted; new v128 baselines committed as ground truth.
**v129 (graduated allocation):** Power-law sharing (k=2) + cation-level rationing lands. Five calibration assertions become test pins. All baselines replaced.
**v130:** Substrate/epitaxy modifier. TN457 barite-on-sphalerite + calcite-after-fluorite perimorph.
**v131+:** Induction counter, per-zone initiative, stochastic mode.

---

## Five Calibration Assertions for v129

1. **dioptase in schneeberg:** grows, but pharmacolite should NOT drop to zero
2. **koettigite in supergene_oxidation:** grows as smaller fraction; alunite stays
3. **lepidolite in radioactive_pegmatite:** 11 v126 breaks collapse to ~3-5 max_um drifts
4. **cassiterite in radioactive_pegmatite:** 2-of-3 near-miss converts to clean 3-of-3
5. **uranophane in schneeberg:** grows as small share alongside uranyl suite

All five must pass for v129 to ship.

---

## Builder Authorization

All decisions above are approved. Builder may proceed with v128 infrastructure.

— Professor (via Rockbot)
