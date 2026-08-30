
## 2026-05-30 — Post-merge test failures (ΔH corrections f67c75d)

After merging syntaxswine/main (95 commits, SIM_VERSION 166), two test files
need builder attention:

### 1. strip-digest.test.ts — stale v166 baseline

**Problem**: The committed `strip_digest_v166.json` was generated at e8ce476
(before the ΔH corrections in f67c75d). The ΔH sign-flips for
cerussite/witherite/strontianite shift temperature-dependent Ksp calculations,
which changes chemistry trajectories in scenarios with non-25°C ranges.

**Failures**: All 10 strip-digest scenarios fail against the stale baseline.

**Fix**: Run `node tools/gen-strip-digest.mjs` to regenerate.
Expected shift: SI values move 0.003–0.15 (e.g., SI_calcite wall -0.126→-0.129,
SI_selenite wall -4.472→-4.535 in naica_geothermal).

**Root cause**: Commit f67c75d message claimed "byte-identical" but only
checked crystal-count baseline (seed42_v166.json), not strip digest.

---

### 2. strip-contracts.test.ts — tolerances too tight for corrected physics

**Problem**: Two contracts pin observed values from pre-correction runs.

**Failures**:
- naica_geothermal line 405: `Ca variation < 1` — corrected thermo gives 2.2
- sulphur_bank line 471: `pH peak > 6` — corrected thermo gives 5.9

**Fix**: Builder to review and decide:
  a) Regenerate contracts with updated observed values, OR
  b) Relax tolerances with explicit justification (e.g., Ca < 3, pH > 5.7)

**Physical basis**: The ΔH corrections are 3-way verified (wateq4f, minteq,
first-principles from each entry's own ΔHf). The shifts are small but real.

---

### 3. calibration.test.ts — seed42 baselines need full regeneration

**Problem**: `seed42_v166.json` does not exist. Calibration test loads
`seed42_v<SIM_VERSION>.json` which fails at SIM_VERSION 166.

**Fix**: Run `node tools/gen-js-baseline.mjs` to generate v166 baseline.
Note: This takes significant time (full scenario runs for all 30 scenarios).

---

All three are consequences of f67c75d (ΔH corrections) propagating through
temperature-dependent calculations. The --internal self-consistency check
(2ead023) now guards against future ΔH drift.
