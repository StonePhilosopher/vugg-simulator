# Bug: SIM 237 `supergene_oxidation` calibration mismatch blocks green CI

**Status:** Open — root cause class established as Node/V8 runtime dependence;
the first divergent numerical branch is not yet traced.

**Discovered:** 2026-08-14 while reviewing PR #4 (GitHub Actions CI).

## Summary

Current `main` passes 39 of 40 seed-42 calibration scenarios, but
`supergene_oxidation` does not match
`tests-js/baselines/seed42_v237.json`. This is not merely rounding noise:
the live run differs in many `max_um` values and in discrete crystal counts.

Observed count changes include:

```text
duftite    expected active/total 8/8   got 9/9
erythrite  expected active/total 5/5   got 4/4
```

Representative size changes include:

```text
anglesite      expected 2903.0 µm   got 2871.5 µm
brochantite    expected 7616.7 µm   got 7575.2 µm
covellite      expected 1595.1 µm   got 1682.0 µm
selenite     expected 147061.4 µm got 147907.8 µm
```

Two isolated runs on Node `v22.23.2` produced the same scientific diff;
only timestamps and elapsed time differed. Treat the mismatch as deterministic
until shown otherwise.

A clean detached worktree at the original v237 commit `8d4b664` also produced
the **same** failure against the baseline committed in that very commit. This
rules out later repository changes as the immediate cause. The fault boundary
is now the v237 baseline-generation/build/runtime environment itself.

Independent runtime comparison narrowed it further:

```text
Node 20.20.2  FAIL (same supergene_oxidation diff)
Node 22.23.2  FAIL (same supergene_oxidation diff)
Node 23       FAIL (same supergene_oxidation diff)
Node 24.19.0  PASS (exact match to committed v237 baseline)
```

No simulator, data, helper, or `seed42_v237.json` content changed between the
authoring commit and current `main`. The likely mechanism is a small V8-level
floating-point/transcendental difference crossing a chemistry or nucleation
threshold, after which the shared RNG sequence amplifies the branch into count
and size differences. The exact first divergence still needs instrumentation.

## Reproduction

From the repository root:

```bash
npm ci
npm run build:check
npx vitest run tests-js/calibration.test.ts -t supergene_oxidation
```

Run the complete calibration sweep with:

```bash
npx vitest run tests-js/calibration.test.ts
```

Current result: 39 passed, 1 failed.

## Why this matters

PR #4 adds GitHub Actions running `npm run ci`. Merging it before this issue is
resolved would make the new required measuring instrument red on its first run.
Do not teach maintainers to ignore that signal, and do not exclude the scenario
merely to obtain a green badge.

The v237 baseline landed with commit `8d4b664`, the selenite migration to
`sulfateAvailablePpm`. Node 24 reproduces that committed baseline; Node 20/22/23
do not. Ordinary nondeterminism and later source drift are ruled out. What
remains unknown is the exact calculation/branch where the engine families
first diverge.

## Required investigation

1. Preserve the Node 20/22/24 comparison as a regression fixture or diagnostic.
2. Generate the live seed-42 summary into a temporary file; do **not** overwrite
   the committed baseline.
3. Compare the first divergent step/RNG draw between the committed v237 state
   and current `main`, focusing on duftite and erythrite nucleation.
4. Trace Node 22 and Node 24 side by side to the first divergent step, chemistry
   value, comparison, and RNG consumption point.
5. Record Node version, platform, built-bundle hash, and source commit with every
   result.

Useful commands:

```bash
git worktree add /tmp/vugg-cal-8d4b664 8d4b664
cd /tmp/vugg-cal-8d4b664
npm ci
npm run build
npx vitest run tests-js/calibration.test.ts -t supergene_oxidation
```

To compare a freshly generated baseline safely:

```bash
cp tests-js/baselines/seed42_v237.json /tmp/seed42_v237.committed.json
node tools/gen-js-baseline.mjs
diff -u /tmp/seed42_v237.committed.json tests-js/baselines/seed42_v237.json
git restore tests-js/baselines/seed42_v237.json
```

Do not run the final `git restore` if unrelated user edits touch that baseline;
use a clean temporary worktree instead.

## Acceptance criteria

- The reason for the mismatch is identified with a reproducible experiment.
- The fix preserves intended SIM 237 sulfate/selenite behavior.
- Count changes are explained, not dismissed as floating-point jitter.
- `npm run ci` passes from a clean checkout under the Node version pinned by
  the GitHub Actions workflow.
- Only then should PR #4 be merged.

## CI decision

The safe immediate route is to change PR #4 to Node 24 and document Node 24 as
the current calibration authority. The stronger long-term fix is to harden or
quantize the first runtime-sensitive threshold, bump `SIM_VERSION`, and rebake
after scientific review.

Do **not** simply overwrite the v237 baseline under Node 22. That would hide the
cross-runtime instability and make the currently authoritative Node 24 result
fail instead.
