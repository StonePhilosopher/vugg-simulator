# HANDOFF: Phase 4b sulfate-class engine migration

**Author:** Claude (Opus 4.7), end of 2026-05-05 session
**Audience:** the next session that picks this up cold
**Status:** ready to start; baselines + helpers + flag in place

---

## TL;DR

Migrate the sulfate supersat engines (`js/40-supersat-sulfate.ts`, 22
`fluid.O2` gate sites) from the legacy `fluid.O2 > X` form to the new
`redoxFraction(fluid, 'S')` form added in Phase 4a (commit
[2b7a6e7](https://github.com/Syntaxswine/vugg-simulator/commit/2b7a6e7)).
Keep `EH_DYNAMIC_ENABLED = false` so this class becomes the proof-of-
pattern; once the playbook is documented, the other 5 classes (74
remaining sites) follow in 4–5 more focused commits. The
`tests-js/baselines/seed42_v26.json` calibration sweep catches any
silent drift; commit only when the sweep stays green.

---

## Why this class, why now

* Sulfates are the cleanest geological case: every site means "needs
  oxidized sulfur" (sulfate as opposed to sulfide), so the couple is
  unambiguously `'S'` and the threshold maps cleanly. Compare to
  carbonate (mixes `'Fe'` and `'S'` reasoning) or sulfide (the
  REDUCTION direction, opposite gate sense).
* Sulfate has 22 sites — non-trivial but bounded; one focused session
  ships it.
* Phase 4a infrastructure landed at v26; the calibration baseline
  exists; helpers (`redoxFraction`, `nernstOxidizedFraction`,
  `ehFromO2`, `o2FromEh`) are unit-tested. Everything 4b needs is in
  place.
* The pattern this commit establishes (per-site threshold mapping +
  calibration check) is what every subsequent migration commit reuses.

---

## What's already in place (do not redo)

| Artifact | Path | Notes |
|---|---|---|
| Eh field on FluidChemistry | `js/20-chemistry-fluid.ts:62` | `this.Eh = opts.Eh ?? 200.0` (mV) |
| Nernst couples + helpers | `js/20c-chemistry-redox.ts` | `REDOX_COUPLES.Fe / .Mn / .S`, `nernstOxidizedFraction`, `redoxFraction`, `ehFromO2`, `o2FromEh` |
| Master flag | `js/20c-chemistry-redox.ts:43` | `EH_DYNAMIC_ENABLED = false` — DO NOT FLIP YET |
| JS test harness | `tests-js/setup.ts` + `vitest.config.ts` | jsdom + fetch mock + bundle eval; `npm test` |
| Calibration baseline | `tests-js/baselines/seed42_v26.json` | 20 scenarios, 423 crystals, per-mineral counts |
| Calibration sweep test | `tests-js/calibration.test.ts` | one assert per scenario; auto-loads baseline matching `SIM_VERSION` |
| Baseline regen tool | `tools/gen-js-baseline.mjs` | `node tools/gen-js-baseline.mjs` after any seed-42-shifting change |
| Determinism test | `tests-js/determinism.test.ts` | catches Math.random() leaks |
| Redox unit tests | `tests-js/redox.test.ts` | locks in Nernst formula + asymptotes |

`npm test` should be 42/42 green at the start of the session. If it
isn't, something else broke; debug that before touching engines.

---

## The migration playbook (apply per site)

For each `fluid.O2` reference in `js/40-supersat-sulfate.ts`:

**Hard gate sites** (current form: `if (this.fluid.O2 < X) return 0;`):
```js
// BEFORE
if (this.fluid.Ba < 5 || this.fluid.S < 10 || this.fluid.O2 < 0.1) return 0;

// AFTER
if (this.fluid.Ba < 5 || this.fluid.S < 10 ||
    !sulfateRedoxAvailable(this.fluid, 0.1)) return 0;
```

**Multiplier sites** (current form: `const o2_f = Math.min(this.fluid.O2 / X, Y);`):
```js
// BEFORE
const o2_f = Math.min(this.fluid.O2 / 0.4, 1.5);

// AFTER
const o2_f = sulfateRedoxFactor(this.fluid, 0.4, 1.5);
```

The two new helpers go in `js/20c-chemistry-redox.ts` next to the
existing infrastructure. Suggested implementations:

```ts
// Returns true if the sulfate redox state passes the legacy O2
// threshold. With EH_DYNAMIC_ENABLED off, reads fluid.O2 directly so
// behavior is identical to the inline check. With it on, gates on
// redoxFraction(fluid, 'S') against an Eh-equivalent threshold.
function sulfateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) return fluid.O2 >= o2Threshold;
  // Phase 4c calibration: equivalent thresholds to be tuned.
  // For now a placeholder mapping anchored on ehFromO2.
  const EhFromO2 = ehFromO2(o2Threshold);
  return fluid.Eh >= EhFromO2;
}

// Same idea for the multiplier form. ratio = O2 / scaleAtFull, capped.
function sulfateRedoxFactor(fluid: any, scaleAtFull: number, cap: number): number {
  if (!EH_DYNAMIC_ENABLED) return Math.min(fluid.O2 / scaleAtFull, cap);
  // Phase 4c: tune the Eh-side equivalent.
  const ratio = (fluid.Eh - 0) / (ehFromO2(scaleAtFull) - 0);
  return Math.min(Math.max(ratio, 0), cap);
}
```

**Critical**: with `EH_DYNAMIC_ENABLED = false`, the new helpers MUST
return identical values to the legacy inline expressions. This is the
"flag-OFF infrastructure" guarantee — if calibration shifts at all in
v27 with the flag still off, the helpers are wrong; back out before
moving on.

After every 5–6 sites: rebuild, run `npm test`, confirm calibration
sweep still green. Don't wait until the end of the file.

---

## First-commit target for the next session

Land **only the helpers** (no site migrations yet) as the first commit:

1. Add `sulfateRedoxAvailable` + `sulfateRedoxFactor` to
   `js/20c-chemistry-redox.ts`.
2. Add unit tests in `tests-js/redox.test.ts`: with the flag off,
   helpers must return equal values to `fluid.O2 >= X` /
   `Math.min(fluid.O2 / X, Y)` for representative inputs.
3. Bump `SIM_VERSION` to 27 with a "Phase 4b infrastructure" note.
4. `npm test` — 44 green (42 + 2 new redox unit tests).
5. `node tools/gen-js-baseline.mjs` — should write `seed42_v27.json`
   identical-content to v26 (helpers callable but unused). Diff
   `seed42_v26.json` and `seed42_v27.json`; the only difference should
   be the version filename. If any scenario summary differs, the
   helpers don't actually preserve legacy behavior — back out.
6. Commit + push.

Then a series of follow-up commits, ~5 sites each:

* `Phase 4b sulfate sites 1-5: barite + celestine + anhydrite`
* `Phase 4b sulfate sites 6-12: brochantite + antlerite + jarosite + alunite`
* `Phase 4b sulfate sites 13-22: chalcanthite + mirabilite + thenardite + tail`

Each commit ends with: `npm run build && node tools/gen-js-baseline.mjs &&
git diff tests-js/baselines/`. Calibration delta must be ≤ 1 crystal
per scenario across all 20. Anything bigger means the helper
threshold mapping is wrong — debug before continuing.

---

## What NOT to do in 4b

* Do not flip `EH_DYNAMIC_ENABLED` to true — that's Phase 4c, after
  ALL six classes have migrated.
* Do not touch `fluid.Eh` defaults or scenario-side Eh values.
* Do not migrate other classes (`30-arsenate`, `32-carbonate`,
  `34-hydroxide`, `37-oxide`, `41-sulfide`) until 4b sulfate is fully
  shipped and the playbook is documented in the commit history.
* Do not regen the baseline pre-emptively before code changes — only
  regen as part of a SIM_VERSION-bump commit.

---

## Alternatives if circumstances have shifted

If when picking this up the situation looks different — e.g. user
asked for a visual session, or 4b feels too risky on revisit — these
are the other live threads:

* **Phase 4d (pH dynamics infrastructure)** — parallel to 4b, same
  flag-OFF pattern as 4a. Per-mineral proton-balance coefficients in
  `js/19-mineral-stoichiometry.ts`, new `applyAlkalinityChange`
  helper, hooked from `_runEngineForCrystal` after `applyMassBalance`.
  Doesn't touch engine source files — lower-risk infrastructure
  commit.
* **Phase E5 (per-habit Three.js geometries)** — replace E3's unit
  primitives (cone / box / octahedron) with hand-rolled extruded
  geometries. ~10 habits, each ~50 lines of vertex generation. Zero
  calibration risk; concrete visual payoff. See E3 commit
  ([c8dd274](https://github.com/Syntaxswine/vugg-simulator/commit/c8dd274))
  for the hookup in `js/99i-renderer-three.ts:_buildHabitGeom`.
* **Phase 1e (dissolution-credit unification)** — refactoring; ~120
  inline `fluid.X += rate * Y` blocks across engine files into a
  per-mineral `DISSOLUTION_RATES` table. Mirror of the Phase 1a/d
  precipitation-side cleanup. Catches the second half of the mass-
  balance double-debit issue.

---

## Files to read first (in order)

1. `proposals/PROPOSAL-GEOLOGICAL-ACCURACY.md` lines 472–531 — the
   Phase 4 spec.
2. `js/15-version.ts` — recent SIM_VERSION history; ground state for
   what's shipped.
3. `js/20c-chemistry-redox.ts` — the Nernst infrastructure; pay
   attention to `EH_DYNAMIC_ENABLED` flag + helper signatures.
4. `js/40-supersat-sulfate.ts` — the migration target.
5. `tests-js/baselines/seed42_v26.json` — the safety net.
6. `tests-js/redox.test.ts` — pattern for new helper unit tests.

---

## Open questions to surface to user (if non-obvious)

* The `ehFromO2(threshold)` mapping is anchor-based linear-in-log; at
  Eh=200 mV with default fluid, `redoxFraction(fluid, 'S')` is ~1.0,
  meaning even very weak `fluid.O2 > 0.1` legacy gates pass trivially
  in the Eh-flag-on regime. Is the right Phase 4c semantics
  "redoxFraction > 0.5" universally, or per-site tuned? Worth
  confirming before 4c.
* `fluid.S` in the bundle is total dissolved sulfur, NOT speciated.
  Phase 3 split DIC into Bjerrum fractions for carbonate; the same
  treatment for sulfate vs sulfide is a Phase 4d-or-later refinement.
  For 4b/c we just gate on `redoxFraction('S')` and trust the Phase 1
  stoichiometry table; the speciation comes later.

---

*This handoff captures one focused next-session entry point. Future-me
should feel free to redirect if the broader context has changed since
2026-05-05; the proposal is a recommendation, not a commitment.*
