# Local commissioning — 2026-10-26

Base: `2f81c230cd17e0b9307401da441a30151ba080c3`.
The delivery commit is identified by the PR head; `receipt.json` binds exact
producer/input bytes without a circular claim about its own commit hash.

Environment: Windows x64, Node 24.15.0, V8 13.6.233.17-node.48, ICU 78.2,
en-US; PHREEQC 3.8.6-17100, Release x64 executable and `phreeqc.dat` from the
hash-pinned USGS package. Dependency hashes are in [the receipt](receipt.json).
No npm dependency or production evidence was rebaked.

From the repository root, with the official package privately extracted:

```text
node pilots/local-acid-buffer/commission.mjs --write --phreeqc-root .local-evidence/acid-buffer-pilot/dependency/extracted/phreeqc-3.8.6-17100-x64
node pilots/local-acid-buffer/commission.mjs --check --phreeqc-root .local-evidence/acid-buffer-pilot/dependency/extracted/phreeqc-3.8.6-17100-x64
```

Both passed: **539 actual solver invocations each**, covering four two-cell
experiments, the untouched distribution example, two instrumented Example 5
variants, and two native carbonate controls. The second command recomputed
and matched the results without writing the committed receipt. It ran from
20:36:37.770Z to 20:36:58.120Z. Each case checked conservation at 81 boundaries;
the largest observed residual was `1.735e-18` in its quantity's units.

```text
npm test -- --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/redox.test.ts --file tests-js/mineral-stoichiometry-coverage.test.ts
```

Passed **106/106** tests: 25 pilot, 30 existing carbonate-boundary, 40 redox,
11 mineral-stoichiometry. Four sequential foreman batches, one worker each,
2,048 MB RSS ceiling; observed maximum 749 MB. After the final cache-validation
and missing-runtime guards, the 25 pilot tests passed again (222 MB peak).

```text
npm run typecheck
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --exit-code 2f81c230 -- js data index.html agent-api tools package.json package-lock.json
git diff --check
```

All passed. Exact compilation reproduced the 186-module shipped page.
The existing manifest covers 41 scenarios; the evidence audit authenticated
128 artifacts. This was an artifact/provenance check, **not a fresh 41-scenario
simulation census**. Both runtime source trees, data, generated page, existing
producer tools and dependencies have zero diff from the base.

The focused pilot command was added to Windows CI. Its reference replay is
offline and explicitly distinguished from the live local runs. Full configured
GitHub checks and their tested SHA are reported on the PR; this local record
does not claim they ran before publication. No new browser/deployment behavior
is exercised: this pilot is not imported by the shipped page or agent runtime.

Relevant failures and corrections during commissioning:

- The first native-control comparison used absolute dissolved moles despite
  different solvent masses. It failed for the open control by `3.44e-9` mol.
  The comparison now uses a common kg-water basis, retaining the absolute-mol
  and solvent discrepancies. No inventory was normalized or overwritten.
- The first focused run was 22 passed / 3 failed. One assertion required exact
  binary equality for `0.175`; one incorrectly compared requested rather than
  accepted oxidation extents across oxygen-limited cases; one assumed the old
  guide's 9.55 mmol gypsum. The corrected suite uses numerical tolerance,
  accepted reaction ledgers, and an independently executed untouched USGS
  example. The latter confirms 8.97555 mmol for the pinned distribution/database;
  the guide discrepancy is preserved, with its cause unresolved.
- The first private MSI extraction returned 1603 in the restricted account;
  administrative-image extraction with filesystem permission returned 0.
  An early private probe had an import-path error, and the initial gas check
  was stricter than PHREEQC's measured fugacity correction. Both failed visibly
  and were corrected before commissioning. These were not accepted chemistry
  results or production changes.
- Staged diff validation found a space-before-tab in the untouched upstream
  example's graph formatting. A path-specific attribute exempts only that
  whitespace class for the SHA-pinned original fixture; its bytes remain exact
  and authored code keeps the ordinary whitespace checks.

Raw solver calls, logs, probe sources and exact local check records remain in
ignored `.local-evidence/acid-buffer-pilot/`; the compressed input/output
transcript and source-bound receipt are committed. Solver children are hidden,
short lived and individually timeout-bound at 15 seconds. No server, watcher,
browser, or retained background helper is created by this pilot.

Unverified boundaries remain explicit in [the contract](README.md): no physical
cycle duration or diffusion calibration, no UV law, no competing-phase/redox
selection, no complete aqueous/solvent H/O closure, and no production migration.
