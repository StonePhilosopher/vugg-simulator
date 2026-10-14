# Test Quarry: cold-CI full-suite verdict boundary

Base: `codex/quarry-build-chip` at `050064956fd31c2600ce57fd38654f8f14e75a2f`
(Syntaxswine PR #15). That parent remains open with green GitHub CI. This is a
separate tranche built on its authored tooling map.

## Defect and resulting behavior

The runner deliberately returns success after completing a resumed suffix while
reporting `full_suite_pass: false`. The old cold-CI wrapper interpreted any zero
`npm run ci` exit as GREEN. It could therefore promote an explicitly partial
result into a reusable full-guard stamp. Its duration was only the resumed
invocation's duration, not the full suite's cost.

The wrapper now supplies a fresh UUID through `VUGG_TEST_INVOCATION_ID`. The
runner publishes that invocation's result under
`.local-evidence/test-workflow-invocations/`. The wrapper never consumes the
shared last-pass report to fill a missing result. It invalidates an earlier
stamp before launching CI and refuses to reuse an existing invocation id.

GREEN requires a successful CI command, a matching uninterrupted runner result,
exact discovered-file and batch coverage, matching project/runtime identity,
and a clean, unchanged HEAD. Resumed, selected, missing, foreign, malformed, or
stale results cannot earn it. A zero command exit without that proof becomes
INCONCLUSIVE / exit 2. An RSS-monitor outage is inconclusive only with an explicit
matching runner outcome. Test failures (including a test exit 2), measured RSS
breaches, and termination failures retain failure precedence and exit codes.

The stamp uses `vugg-cold-ci-stamp-v2` and embeds its local runner result.
`node tools/cold-ci.mjs --check` validates it without launching CI, including
current ignored build inputs, runtime, suite membership, HEAD, and dirty state.
Old unversioned stamps must be replaced by a new full-guard result. Durations
describe this invocation. Stamps remain local operator testimony, not independent
attestation or scientific evidence. A fabricated local JSON file is not made
trustworthy by a UUID.

The runner's checkpoint format, ordinary resume behavior, file order, one-worker
policy, RSS guard, and cost-ledger policy are unchanged. Invocation outcomes do
not advance a failed batch's checkpoint or ledger. No scientific model,
baseline, receipt, or generated runtime changes; no rebake.

## Dependency boundary and witnesses

`tools/cold-ci.mjs`, `tools/cold-ci-lib.mjs`, and their test file enter the
explicit chip map. Changes to the runner, ledger, or selector also select the
cold-CI consumer tests. Independent map assertions prevent silently dropping
those witnesses. CI gate implementations, package scripts, scientific inputs,
and new/unknown helpers remain outside this tooling scope.

The integration tests run the real `npm run ci -> npm test -> test-workflow`
boundary inside temporary roots. Tiny finite stand-ins replace the expensive
geological test bodies. They cover uninterrupted, resumed, selected, and failing
invocations, including a test process that exits 2. Real Git fixtures cover
clean/dirty state and untracked inputs. Fixtures and short-lived processes are
disposed when the tests finish; no retained server or background helper.

Eight seeded defects were detected by the actual guarded chip command:

1. Ignore the full-result requirements.
2. Accept another invocation's result.
3. Ignore project/runtime drift.
4. Discard a nonzero CI command exit.
5. Treat every exit 2 as monitor loss.
6. Omit the runner's invocation result.
7. Drop the CLI's exit status.
8. Drop the cold-CI witness from its map group.

Original implementation bytes were restored after every probe. Local probe
scripts, logs, and restoration hashes are under `.local-evidence/`; they are
diagnostics, not committed scientific receipts. These witnesses cover the
named defects, not arbitrary full-suite equivalence.

Validation: focused tooling checks, typecheck, exact build check, and the
science/evidence/release audits on Windows x64 / Node 24.15.0. The focused
command is `npm test -- --chip-base codex/quarry-build-chip`. No full multi-hour
suite, fresh GREEN cold-CI stamp, or performance benchmark is claimed for this
tranche.

## Next unfinished work

Reconcile the older machine-wide foreman lease/telemetry work without replacing
these verdict checks with the old wrapper. This wrapper is still synchronous;
an adopted heartbeat needs an asynchronous child lifecycle. Host cleanliness is
not certified here. Splitting heavy test files and broader formation-tier
equivalence also remain unfinished; historic SIM267 timings are not current
performance measurements.
