# Initiative Proposal — Revision Log

**Date:** 2026-05-21
**Status:** Post-review, awaiting Professor's answers to A-F

---

## Professor's Review — Summary of Issues

### Science Corrections (FIXED in commit ff22fc9)
1. ✅ BCF regime inverted — fixed, aligned with De Yoreo & Vekilov 2003
2. ✅ Quartz ΔH° wrong (+3.8 → +22) — fixed per Rimstidt & Barnes 1980
3. ✅ Opal ΔH° wrong (+2 → +14) — fixed per Iler 1979
4. ✅ Quartz σ_crit too low (2-3 → 6-20+ homogeneous) — fixed, added heterogeneous column
5. ✅ Surface energy γ_sl vs γ_sv confusion — clarified, values updated per Söhnel & Mullin 1982
6. ✅ Double-counting competition — eliminated, documented physics-only choice
7. ✅ Edge-of-gate permanent debuff — reframed as perturbation-sensitivity flag

### Design Issues (NEED PROFESSOR'S ANSWERS)

**A. Physics-only vs modifier-only competition?**
- Physics-only: recalc σ after each mineral, no explicit competitionModifier
- Modifier-only: compute σ once per step, use competitionModifier as proxy
- Professor: "I lean modifier-only for v128 with physics-only as a future option"
- Rockbot: Agrees — modifier-only is faster, more legible, less cascade-prone for initial landing

**B. σ_crit single source of truth?**
- Option: extract from engine gates (js/3X-*.ts) — lower risk, always accurate
- Option: migrate engine thresholds into data/minerals.json — cleaner long-term, invasive
- Professor's recommendation: "Extract from engines (Q1 Option A), or do Option C with a test that fails loud when spec diverges from engine. Don't ship Option B alone."
- Rockbot: Agrees — extract programmatically, add divergence guard test

**C. Per-zone vs global initiative?**
- Global: one initiative order per step (current proposal)
- Per-zone: different cavity zones get different initiative orders (more realistic, expensive)
- Professor: Not stated yet
- Rockbot: Recommend global for v128, per-zone as v132+ if performance permits

**D. What happens to existing RNG calls?**
- v109 "RNG-cascade ripple" + Shape-B nucleation displacement
- Initiative makes ordering deterministic, but sim still has SeededRandom per step
- Professor: Not stated yet
- Rockbot: Recommend initiative replaces Shape-B for ordering; SeededRandom stays for crystal placement/geometry

**E. Calibration ground-truth for rarity?**
- Use real-world abundance as target (proustite rare → low initiative)
- Or treat v125 cascade record as ground truth (cascades = low initiative)
- Professor: "Worth grounding in the proposal — gives us a calibration target"
- Rockbot: Recommend both — v125 record for short-term calibration, real abundance for long-term validation

**F. Multi-cation penalty (lepidolite case)?**
- Lepidolite: 5-cation stoichiometry, cascaded in v126
- Current system: one penalty per shared cation (-2 max)
- Alternative: penalty proportional to total cation count
- Professor: "One large penalty proportional to total cation count is closer to physics"
- Rockbot: Agrees — add `cation_count` to penalty function, scale with unique cation count

### Missing Pieces (NEED PROFESSOR'S DIRECTION)

**Library visibility:**
- Professor wants base initiative + competition group + temperature sweet-spot visible in mineral catalog modal (#mineral-info-modal, js/9X-ui-library.ts)
- Recommend "Competitiveness" section on each specimen card

**Rarity mechanism:**
- Professor wants explicit section: low-initiative + dense competition → loses contests → fewer crystals → rare
- Recommend adding "Rarity Tier" to proposal, ground-truthing against proustite, lepidolite, etc.

**Test strategy:**
- Professor says "it's OK to redo tests" — changes Q7 from gradual rollout to global enable + regenerate
- Recommend: v128 enable globally, regenerate all baselines as new ground truth
- Probe tool extends to initiative-modifier probes

---

## Builder Feedback (2026-05-21 13:43 EDT)

The builder reviewed all docs and provided substantive refinements on graduated competition:

### G. Sharing Math — Power-Law (k=2)
Linear sharing (myShare = myInitiative / totalInitiative) is too weak — a 9% initiative gap → only 4% allocation gap. **Power-law sharing with k=2** is the builder's recommendation: shares = initiative² / Σ(initiative_j²). More aggressive dominance for small gaps, calibrated against v125 cascade record.

### H. fullAllocation Semantics — Cation-Level Rationing (Option C)
The builder rejects per-mineral share (unphysical — non-competing minerals shouldn't slow each other). **Cation-level rationing** is correct: after all minerals compute desired thickness_um, sum desired debit per cation. If desired_C > fluid[C], ration that cation across competitors weighted by initiative. Only triggers when broth is genuinely limiting. Preserves stoichiometric integrity. Matches Liebig's law of the minimum.

### F Revised — cascadeRipplePenalty (additive, not replacement)
The multi-cation penalty is NOT competition. Competition is per-cation overlap. The 5-cation penalty captures **cascade ripple potential** — a 5-cation mineral perturbs more σ-gates downstream. Rename to `cascadeRipplePenalty` or `stoichiometricComplexity`. Applied ADDITIVELY to per-cation competition.

Example: lepidolite in radioactive_pegmatite:
- −2 from cascade ripple (5 cations)
- −2 from per-cation competition (K, Li, Al, SiO2, F all overlap)
- Total: −4 (matches v126 empirical severity: 11 breaks)

### B Revised — Engine Gates as Exported Constants
Don't parse engine source files. **Have each engine export its gates as a structured constant**:
```typescript
const SUPERSAT_GATES_sphalerite = {
  sigma_crit: 1.8,
  T_min: 80, T_max: 350,
  pH_min: 2, pH_max: 9,
  // ...
};
```
Then `data/sigma-crit-generated.json` is built from these constants. Guard test fails if registered engine lacks gates. Migration cost: 25 engine files, one-time refactor. Pays off for library-card display (T-range, pH-range, σ_crit shown directly).

### Induction Time Clarification
Graduated allocation affects **post-nucleation growth rate**, not **pre-nucleation delay**. Induction time (thermal fluctuation overcoming ΔG*) is a distinct mechanism. Defer formal induction to v131+. v128's graduated model doesn't fully capture induction kinetics — be explicit about this in the proposal.

### Five Calibration Assertions for v129
1. **dioptase in schneeberg:** grows, but pharmacolite should NOT drop to zero
2. **koettigite in supergene_oxidation:** grows as smaller fraction; alunite stays
3. **lepidolite in radioactive_pegmatite:** 11 v126 breaks collapse to ~3-5 max_um drifts
4. **cassiterite in radioactive_pegmatite:** 2-of-3 near-miss converts to clean 3-of-3
5. **uranophane in schneeberg:** grows as small share alongside uranyl suite

### I. competitionMode Scenario Parameter — Defer to v129
Ship v128 with one global mode (probably 'auto' with sensible defaults). Add scenario overrides in v129 if specific scenarios need them.

### J. Library Card Layout — Mockup Needed
Builder offers to draft mockup. Options:
- "Competitiveness profile": σ_crit + T sweet-spot + competition group + base initiative
- "Rarity tier": derived from base initiative under typical conditions
- "Why is this rare?": narrator-style explanation linking initiative + competition + edge-of-gate

---

## Professor's Decisions Needed (Updated 2026-05-21)

### G. Sharing Math — Power-Law k=2?
**Builder recommends power-law with k=2.** Calibrated against v125 cascade record. Confirm?

### H. fullAllocation — Cation-Level Rationing (Option C)?
**Builder recommends cation-level rationing.** Only triggers when broth limiting. Non-competing minerals unaffected. Confirm?

### I. competitionMode Scenario Parameter — Defer to v129?
Ship v128 with global 'auto' mode. Add scenario overrides later. Confirm?

### J. Library Card — Builder drafts mockup?
Builder offers to draft card layout. Should they proceed?

### B Revised — Engine Gates as Exported Constants?
Refactor 25 engine files to export gates constants. One-time cost, pays off long-term. Confirm?

### Revised Sequencing
**v127 (planning):** Confirm G/H/I/J/B-revised + science fixes in canonical docs
**v128 (infrastructure):** Engine gates exported. js/20-initiative.ts lands with base initiative + linear modifiers. Library card section drafted. NO graduated allocation yet.
**v129 (graduated allocation):** Power-law sharing + cation-level rationing lands. Five calibration assertions become test pins. All baselines replaced.
**v130:** Substrate/epitaxy modifier
**v131+:** Induction counter, per-zone initiative, stochastic mode

— 🪨✍️
