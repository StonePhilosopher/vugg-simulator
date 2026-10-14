# Test Quarry: build-orchestration chip coverage

Base: Syntaxswine/main `526383d92f0331ed0bbc4626896a5355b1446809`, the reviewed
PR #14 merge. The earlier chip-selection tranche is on main; its Pages deployment
and post-merge GitHub CI passed.

## Audited dependency boundary

The authored map now covers `tools/build-all-lib.mjs`, its CLI entry point
`tools/build-all.mjs`, and `tests-js/build-all.test.ts`. Changes to any of those
paths select the build tests plus the selector's independent mapping guards.
The plan scope is now `audited-development-tooling`; its JSON schema and
partial-result semantics are unchanged.

The library orders a narrative audit/generation step, removes stale `dist`, runs
TypeScript, then invokes the bundle splicer. Its only production caller is the
CLI entry point. The science verification/rebake wrapper invokes that entry
point as a command. This makes phase ordering, failure propagation, and check-mode
forwarding a bounded contract that can be tested without changing generated data.

The chip does not certify what those subprocesses produce. The narrative
generator, bundle splicer, compiler configuration, package manifests, shared
fixtures, runtime source/data, and unknown helpers continue to require a full
check. No directory-wide allow rule was added. No build implementation or
scientific producer changed in this tranche.

## Test witnesses

The build tests now cover all three subprocess launch failures, null/signal exit
results, nonzero bundle-check status, exact phase ordering, the selected working
directory/runtime, dist cleanup, and generation/check-mode forwarding. The CLI
test executes a copy of the actual entry-point source against an injected library,
checking both zero and nonzero exits and preservation of `--check`. It creates no
real compiler process, browser, or generated bundle.

The selector independently pins all three mapped paths to the build test file,
checks missing/deleted paths, and refuses mixed orchestration/implementation
changes. Every selected witness remains registered in the full suite.

Seven deliberately seeded defects made the actual chip command fail on test
assertions:

1. Bypass a failed narrative audit.
2. Bypass a failed TypeScript compilation.
3. Lose narrative `--check` forwarding.
4. Retain stale dist instead of removing it.
5. Return success despite a failed bundle check.
6. Discard the library verdict at the CLI entry point.
7. Remove the build witness from its authored map entry.

Each original file was restored byte-for-byte before the next probe. These are
specific detection witnesses, not a claim of full-suite equivalence for arbitrary
future defects. Scope expansion still needs a dependency audit and its own seeded
defect checks.

## Use and limits

```text
node tools/test-chip-check.mjs --base origin/main
npm test -- --chip-base origin/main
```

The first command previews; the second prepares the bundle and runs the selected
files under the existing RSS/identity guards. No resume, batching, checkpoint, or
full-suite PASS policy changed. This remains a partial tooling check.

The initial and final clean runs passed 94 tests across four files on Windows
x64 / Node 24.15.0. Typecheck, exact build verification, and the science, evidence,
and release audits also passed. No full multi-hour suite or performance benchmark is claimed. Scientific
model, baselines, receipts, and generated runtime are unchanged; no rebake.

## Next unfinished work

Keep expanding only where complete dependency and defect witnesses can be
authored. The old foreman reconciliation, splitting heavy test files, and broader
formation-tier equivalence remain unfinished. Do not fold narrative generation or
bundle correctness into this map merely because their commands are orchestrated
by a covered file.
