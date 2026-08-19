# Bug: SIM 237 `supergene_oxidation` calibration mismatch blocks green CI

**Status:** Root-cause class established with differential evidence (2026-08-15,
see Evidence Update below): a Node/V8-runtime-dependent numeric path. The
baseline is correct for the runtime that generated it; the exact first divergent
calculation/threshold is not yet traced. Immediate work is the Node 24 CI pin and
provenance stamping in the adapted PR #4; threshold hardening remains separate
long-term science work.

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
`sulfateAvailablePpm`. That commit reported a fully green suite, yet the commit
fails against its own baseline in a clean Node 22.23.2 worktree. The remaining
leading possibilities are:

1. a baseline generated from a different built bundle or source state;
2. a Node/runtime-dependent numeric or iteration-order path that crosses
   nucleation thresholds;
3. a mismatch between the baseline-generation environment and the vitest
   harness environment.

These are hypotheses, not conclusions.

## Required investigation

1. Reproduce on the original builder's Node version and on GitHub's intended
   Node 22 runner.
2. Generate the live seed-42 summary into a temporary file; do **not** overwrite
   the committed baseline.
3. Compare the first divergent step/σ evaluation between the SAME commit run
   under the two Node runtimes (24.15.0 vs 22.23.2), focusing on duftite and
   erythrite nucleation. [Corrected 2026-08-15 — the original step compared
   commits, but the 8d4b664 worktree experiment plus the Evidence Update
   below establish the divergence axis is the runtime, not the commit.]
4. Audit the baseline-generation procedure and exact build state used for
   `8d4b664`; later-commit bisection is unnecessary unless another environment
   can first make `8d4b664` pass against its own baseline.
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

To compare a freshly generated baseline safely — corrected 2026-08-15. The
original snippet regenerated IN PLACE in the working checkout (contradicting
investigation rule 2 above): a crash between the overwrite and the
`git restore` left a silently dirty tree carrying a wrong-for-this-runtime
baseline, and restoring after the diff destroyed the regenerated evidence
artifact. Run the regeneration in a scratch worktree instead, keep BOTH
artifacts, and remove the worktree when done:

```bash
git worktree add /tmp/vugg-basegen HEAD
cd /tmp/vugg-basegen
npm ci && npm run build
node tools/gen-js-baseline.mjs
node --version > /tmp/seed42_v237.regen.node-version
cp tests-js/baselines/seed42_v237.json /tmp/seed42_v237.regen.json
cd - && git worktree remove --force /tmp/vugg-basegen
diff -u tests-js/baselines/seed42_v237.json /tmp/seed42_v237.regen.json
```

The committed baseline is never touched; the regenerated file plus the Node
version that produced it survive in /tmp as the experiment record. (On the
Windows canonical machine run this from Git Bash, or substitute a real temp
directory for /tmp; PowerShell has no /tmp.)

## Acceptance criteria

- The reason for the mismatch is identified with a reproducible experiment.
- The fix preserves intended SIM 237 sulfate/selenite behavior.
- Count changes are explained, not dismissed as floating-point jitter.
- `npm run ci` passes from a clean checkout under the Node version pinned by
  the GitHub Actions workflow.
- Only then should PR #4 be merged.

## Evidence Update — 2026-08-15 (canonical Windows machine, the baseline's birthplace)

The missing half of the differential, recorded from the machine that
generated `seed42_v237.json`:

- **Node v24.15.0, Windows 11** (this repo's primary dev machine, where every
  baseline in the v169→v237 lineage was baked).
- `8d4b664` (the v237 commit itself) ran the FULL suite green here on
  2026-07-27: cold-CI stamp `GREEN — 8d4b664 verified 2026-07-27T22:24:08.127Z
  (468s, sim v237)`.
- 2026-08-15, at `ed2dd72` (identical engine — only docs commits since
  8d4b664): `npx vitest run tests-js/calibration.test.ts -t supergene_oxidation`
  → **1 passed, 5.95 s**. The doc's `-t` repro filter works as written.
- The reporting environment (Node v22.23.2, clean worktree at the same
  commit) fails the same test deterministically with the duftite 8→9 /
  erythrite 5→4 flip.

Same commit + same baseline + green-on-24 / red-on-22 scores the hypotheses:

1. ~~Baseline generated from a different built bundle or source state~~ —
   **refuted**: the baseline agrees byte-for-byte with the runtime that
   generated it; a stale-build baseline would disagree with both runtimes.
2. **Node/runtime-dependent numeric path — confirmed by differential.**
   V8's Math.* low-bit behavior differs across majors (Node 22 = V8 12.x,
   Node 24 = V8 13.x); a σ sitting within float-noise of a nucleation gate
   flips once, and the competition cascade re-deals the rest (one extra
   duftite consumes Cu/As → one fewer erythrite; sizes ripple through the
   shared broth). The count changes ARE floating-point in origin but not
   "jitter" — one deterministic threshold flip per runtime, then determinism
   within each runtime, exactly as both machines observe.
3. Baseline-gen vs vitest harness mismatch — moot: `tools/gen-js-baseline.mjs`
   deliberately mirrors `tests-js/setup.ts` (jsdom + bundle eval), same
   runtime both sides.

**Resolution path:** pin PR #4's GitHub Actions to the baseline lineage's
runtime — Node 24 (record the exact version the workflow resolves; 24.15.0
here today). Add a runtime-provenance line (node version + platform) to the
baseline generator's output header and to `.ci-stamp.json` so the next
cross-runtime flip identifies itself in one read instead of one
investigation. Regenerating the baseline under Node 22 instead would merely
move the red X to the machine every baseline was born on. A longer-term
option — quantizing σ-vs-gate comparisons so sub-1e-12 margins can't flip —
is an engine change with fleet-wide blast radius and belongs to its own
proposal if wanted.

**Adapted-PR-#4 status — 2026-08-19.** The Node 24 pin landed as
`.github/workflows/ci.yml` (receipt audits + the `supergene_oxidation`
sentinel against the current `seed42_v271.json`; no bake step exists in the
workflow), and `.ci-stamp.json` now records `platform` alongside the `node`
version it already carried. The baseline-generator header line is **deferred
to the next `SIM_VERSION` bump**: `tools/gen-js-baseline.mjs` is the
digest-pinned `seed42-baseline` producer (`PRODUCER_ENTRIES` in
`tools/evidence-runtime.mjs`), so editing it outside a bake would stale the
just-baked receipts and force the full rebake this integration pass is
contractually barred from. The next bump rebakes anyway; add the header
there for free.
