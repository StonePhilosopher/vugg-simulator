# Test Quarry: bounded process observation

Base: Syntaxswine `main` at `f7008099a5b042ba9f3dc45f54a39406e4bac936`.
PR #15 merged first as `b60172af`; PR #16 followed as `f7008099`. Both
post-merge CI runs and the final Pages deployment passed. This tranche follows
the cold-CI handoff's unfinished foreman reconciliation.

## Problem and resulting behavior

The older process census on `ci/test-quarry` (inspected at `63f7f51c`) filtered
out non-JavaScript processes before tracing ancestry. That discarded cmd and
PowerShell bridges between a runner and its workers. Missing process details
could also look clear, and PID-only ancestry could exempt a worker through a
recycled parent PID. The old foreman is not imported into current main.

`node tools/process-census.mjs --preflight` now takes one bounded Windows CIM
snapshot. It retains the full process list for ancestry analysis and preserves
all seven fractional digits of UTC creation timestamps. Each parent must have
a readable start time no later than its child before the chain can exempt a
known worker. Missing parents, cycles, missing timestamps, and parents created
after their children leave the ancestry unresolved.

The observation recognizes node/nodejs/bun/deno/esbuild commands containing
bounded vitest, vite, test-workflow, cold-ci, or build-all markers. These are
command-text heuristics, not workload or ownership proofs. Recognized work
outside a verified caller tree is **busy / exit 1**, including work in another
checkout or launched with relative paths. A checkout path is only an advisory
hint. An unavailable query, unsupported platform, unavailable caller identity,
or missing external runtime metadata produces **unknown / exit 2**. Positive
busy evidence retains precedence when other metadata is missing. Exit 0 means
only **no-observed-work** within this scope and snapshot.

The query is hidden and limited to 15 seconds and 16 MiB of output. Raw command
lines are used transiently for classification, then discarded before snapshots,
diagnostics, or reports leave the adapter. Query errors also discard raw
stdout/stderr. `--json` emits the same sanitized report saved under
`.local-evidence/process-preflight-v1.json`. A write failure cannot return
success; positive busy evidence still retains precedence.

This is one non-atomic host observation. It does not reserve the machine, gate
tests, certify host cleanliness, establish process ownership, or authorize
termination. Unrecognized workloads remain outside scope. The shared diagnostic
file is advisory, not a reusable clearance result. There is no age-based leak
classification, cleanup command, watcher, or retained helper. Non-Windows hosts
explicitly return unknown until their adapters are implemented.

No scientific model, baseline, receipt, generated runtime, checkpoint policy,
or cold-CI verdict change; no rebake.

## Witnesses and validation

The explicit tooling map covers the census module, CLI, and tests. Independent
selector assertions pin their witness and reject missing files. Adding the
foreman or host sampler still requires broader checks; census coverage does not
silently certify their scheduling or lifecycle behavior.

`npm test -- --chip-base origin/main` passes 215 tests across five files, with
one worker and the RSS guard. Sixty census tests cover acquisition failures,
timestamp precision, shell bridges, PID reuse, ambiguous ancestry, missing
metadata, cross-checkout work, sanitized persistence, and CLI exits. Tiny CLI
fixtures terminate and remove their temporary roots; fixture tests do not
query or manipulate unrelated host processes.

Eight seeded defects were caught by tests through the actual guarded chip:

1. Drop shell intermediates.
2. Ignore parent PID reuse.
3. Ignore an unavailable runtime command.
4. Ignore foreign-checkout or relative-path work.
5. Discard unknown metadata issues when choosing a verdict.
6. Retain raw command lines.
7. Drop the CLI exit code.
8. Substitute an unrelated test for the census map witness.

An additional empty-map probe was rejected by schema validation before running
tests. Every probe restored the original bytes, with restoration hashes checked.
Scripts, logs, and local probe results remain under `.local-evidence/`; they are
development diagnostics, not scientific evidence receipts.

A live Windows snapshot completed with a valid caller identity, exact creation
timestamps, and `no-observed-work`. That observation does not certify machine
idleness. Typecheck, exact build validation, and science/evidence/release audits
pass on Windows x64 / Node 24.15.0. No multi-hour full suite, fresh GREEN cold-CI
stamp, or performance improvement is claimed for this tranche.

## Next unfinished work

Reconcile the machine-wide foreman lease before wiring this observation into
admission. A live owner must not lose its lease solely because a heartbeat is
old; unavailable identity must remain unresolved. Reclaim and release need
race-tested token ownership so one contender cannot remove another's lease.

The current cold-CI wrapper remains synchronous. Heartbeat adoption needs an
asynchronous child lifecycle while retaining invocation-bound full-suite
verdicts, failure precedence, and stamp checks from PR #16. Host telemetry and
helper retirement must preserve exact process identity and explicit ownership;
a census result is never kill authority. Heavy-file splitting and broader
formation-tier equivalence also remain unfinished. Historical timings are not
current performance evidence.
