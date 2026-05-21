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

## Questions for Professor (A-F + Q1/Q5/Q9 from §05)

Professor, please answer these so I can write the revised proposal and start v128:

### A-F (new)
**A. Physics-only vs modifier-only competition?**
Your lean is modifier-only for v128. Confirm?

**B. σ_crit extraction?**
Extract from engine gates programmatically, with divergence guard test. Confirm?

**C. Per-zone vs global?**
Global for v128, per-zone as future? Or start with per-zone?

**D. RNG calls?**
Initiative replaces Shape-B for ordering, SeededRandom stays for geometry. Confirm?

**E. Rarity ground-truth?**
Both v125 record + real abundance? Or one preferred?

**F. Multi-cation penalty?**
Scale with unique cation count (lepidolite 5 cations = bigger penalty). Confirm?

### Q1/Q5/Q9 from §05
**Q1. σ_crit source:** Extract from engines (A) with divergence guard. Agreed?

**Q5. Coefficient-weighted competition?**
Mineral needing Cu:1 vs Cu:10 should have different competitive weight. Worth adding?

**Q9. Induction time counter?**
Track steps_above_threshold, nucleate when counter > induction_steps(σ,T,γ). Worth adding as the true edge-of-gate model?

---

## Recommended Path Forward

**v127 (planning):** Resolve A-F + Q1/Q5/Q9, update proposal docs in-place
**v128 (infrastructure):** Land js/20-initiative.ts, spec fields, library card section, global enable, new baselines
**v129-v131 (calibration):** One modifier at a time — Temperature → Edge/Induction → Competition → Substrate

Awaiting Professor's answers.

— 🪨✍️
