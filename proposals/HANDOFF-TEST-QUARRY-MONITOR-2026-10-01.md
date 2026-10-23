# Test Quarry: monitoring outcomes

Base: Syntaxswine/main `e75bb4c655c09a86b26556dec3c24fede92a19c7`.
This completes the RSS-sampler false-RED item in section 6 of
`HANDOFF-TEST-QUARRY-AND-FOREMAN-2026-08-18.md` on `ci/test-quarry`.
That older branch contains broader foreman work; this delivery does not claim
that all of it is present on main.

## Delivered

Two consecutive sampler failures still stop the owned test child. The batch
now has the explicit outcome `monitor-unavailable`, with an INCONCLUSIVE console
diagnostic and nonzero exit 2. Even a child that exits zero during shutdown does
not become a monitored PASS. The batch does not advance the checkpoint, enter
the cost ledger, or allow subsequent batches to start.

Outcome precedence is termination-failed, rss-limit-exceeded,
monitor-unavailable, then pass/test-process-failed. A measured RSS breach remains
a failure if the sampler subsequently fails during shutdown. The batch result
retains the sampler error alongside that breach. Test-process exit codes remain
unchanged; use the outcome/diagnostic rather than treating exit 2 alone as a
unique diagnosis. Spawn errors still throw under the existing API.

An isolated sampler failure followed by recovery does not trigger termination.
The two-consecutive-failure threshold, memory ceiling, and termination mechanism
are unchanged. This does not fix OS permissions or certify complete peak-memory
coverage. It makes the failure to measure explicit and preserves fail-closed
execution.

## Validation

Node 24.15.0, Windows x64:

- Workflow and cost-ledger suites: 28 tests passed across two sequential files.
- Typecheck and exact generated-build check passed.
- Science, evidence, and release audits passed without rebaking or changing
  scientific artifacts.
- Regression cases cover monitor loss with signal/zero child exits, intermittent
  recovery, failure during over-limit termination, outcome precedence, and the
  refusal to record or continue an unmonitored batch.

The full multi-hour calibration suite was not rerun. This is a diagnostic and
test-harness change; it makes no speed or scientific-model claim.

## Next hand

The older handoff's chip-check subsystem map and its seeded-failure equivalence
proof remain separate work. Reconcile the broader `ci/test-quarry` branch with
current main before adopting its foreman, profiling, or batching implementation.
Do not interpret the measurement-only ledger now on main as that entire system.
