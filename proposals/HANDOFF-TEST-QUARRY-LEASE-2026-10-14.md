# Test Quarry: cooperative machine-wide lease

Base: Syntaxswine `main` at `162a8a8f374403e3f91c7734206b701b8b8b276d`.
PR #17 is merged; its exact reviewed tree, post-merge CI, and Pages deployment
were verified. This tranche implements the lease prerequisite identified by
the census handoff. Scientific source, baselines, receipts, generated runtime,
test verdicts, and calibration authority are unchanged.

## Problem and resulting behavior

The older `ci/test-quarry` foreman used heartbeat age to reclaim live owners.
Its read/rename/remove protocol could park a successor between token validation
and release, exposing the shared slot to another claimant. Restoring a parked
successor could itself race another acquisition. That protocol is not imported.

`createMachineLease()` in `tools/test-lease-lib.mjs` implements a cooperative
reservation with immutable generations. Windows defaults to the common
`%ProgramData%\VuggSimulator\test-lease-v1` directory, never per-checkout or
per-user TEMP. Unsupported platforms, missing configuration, denied access,
unsupported filesystem operations, and ambiguous/corrupt journal state return
unknown / exit 2. Clients need write access to the same trusted local directory;
the tool does not broaden ACLs or select a private fallback. This is a cooperative
protocol, not a security boundary against clients modifying the journal.

Each claim records a random UUID token, generation, predecessor token, run ID,
checkout, and exact owner PID + seven-fractional-digit Windows creation time.
Acquisition observes processes after reading the claim. Observation timestamps
must fall inside that call, so a cached census cannot authorize reclaim. Missing
owner start time remains unknown; a live matching lifetime is busy / exit 1
regardless of age. Only an absent PID or a different exact creation time proves
that owner lifetime ended. Raw process commands and errors are not persisted.

An acquiring client closes a proven-ended generation, then competes for the next
numbered claim. Release validates both its token and the calling process's exact
identity before closing only that handle's generation. Repeated release is
idempotent. A delayed releaser/reclaimer cannot rename or delete a successor.
No heartbeat grants authority to displace a live process, and no process is killed.

## Publication and race reasoning

The only authoritative writes append `claim-N.json` or `close-N.json`. A unique
private staging file is written completely, synced, and closed before a hard link
publishes it under the final name. Existing names are never replaced; EEXIST
losers re-read the journal. There is no read-then-unlink, directory parking,
overwrite, copy fallback, or authority-bearing partially written claim.

If interrupted before publication, only inert private staging residue can remain.
If interrupted after publication, the claim is held until explicit release or
proof its exact owner lifetime ended. Concurrent reclaimers can finish the same
old generation but only one can publish the next claim. A delayed actor still
addresses its old generation and collides with an existing immutable record.
Every predecessor needs a valid matching completion record before a successor
is accepted. Missing or malformed committed history fails closed.

The journal is intentionally retained, with bounded acquisition retries and a
10,000-generation capacity limit. There is no live compaction or automatic
cleanup: coordinate offline maintenance only after every potential client has
stopped. Filesystem/storage failures can require operator diagnosis; safety does
not imply automatic recovery from corruption or power loss. Windows local
hard-link behavior is exercised in the process contention tests; reference:
[CreateHardLinkW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw).

## Interface and boundaries

The asynchronous API offers `acquire({ runId, checkout })`, `inspect()`, and
`release(handle)`. Only an acquired result reserves the cooperating-client slot.
The same owner process must finish all owned work before release and inspect its
result. `node tools/test-lease.mjs [--status] [--json]` is deliberately read-only:
available/reclaimable / 0 is an observation, never an admission ticket. Short-lived
CLI acquisition would abandon a lease as soon as the command exited.

Existing npm test/cold-CI entry points are not yet gated. The older foreman does
not participate in this namespace. Reclaim says nothing about orphaned children,
unrecognized workloads, or host cleanliness. No ownership inference, process
termination, telemetry, helper cleanup, full-suite verdict, or performance claim
is introduced. There is no retained service or timer.

## Validation

`npm test -- --chip-base origin/main` passes **289 tests across six files**:
cold CI (54), census (60), selector (76), lease (67), ledger (7), and workflow
(25). The lease tests include actual competing Node clients in separate checkout
directories with an injected process-identity adapter. Those fixture clients are
hidden, use IPC shutdown and an eight-second automatic expiry, and their exits
are awaited. They do not query or manipulate unrelated processes. Deterministic
barriers also exercise delayed reclaim/release across successor publication.

Nine seeded defects were caught through the actual guarded chip:

1. Expire a live owner by age.
2. Compare only PID, ignoring creation time.
3. Reclaim when the owner's identity is unreadable.
4. Replace non-overwriting publication with an overwriting copy.
5. Permit a different process to release the open claim.
6. Accept a cached process observation.
7. Accept another token's completion record.
8. Drop the status CLI's exit code.
9. Substitute unrelated tests for the lease's authored map witnesses.

The overwrite defect produced three winners in both the deterministic and actual
process contention tests. Each probe restored the original bytes, with SHA-256
restoration checks. Local scripts, backups, logs, and results remain in
`.local-evidence/lease-mutations*`; these are development diagnostics, not science
receipts or independent attestation.

A live Windows probe at `2026-10-15T01:41:32.570Z` used the production ProgramData
namespace and CIM adapter: acquired, busy from a second process, released, then
available. Its exact owner was PID 30368, created `2026-10-15T01:41:32.5201270Z`.
That lifetime exited; a subsequent observation found the PID reused by a later
cmd process, which was left untouched. The closed generation remains as journal
history. `.local-evidence/lease-live.json` records the sanitized round trip.

Typecheck, exact generated-build validation, science/evidence/release audits,
and `git diff --check` pass on Windows x64 / Node 24.15.0. No full multi-hour
suite, fresh GREEN cold-CI stamp, rebake, or performance gain is claimed. The
authored chip includes the lease whenever its census adapter changes; selectors
still reject unmapped foreman/admission and host-sampler code.

## Next unfinished work

Integrate the lease with admission only after converting cold CI's synchronous
child lifecycle to awaited asynchronous work. Hold the parent lease through child
completion and verified quiescence; child adoption needs explicit identity and
token validation. Preserve PR #16's invocation-bound full-suite verdicts,
failure precedence, exact project/runtime identity, and stamp validity. Combine
lease admission with fresh census observation; a reclaimable lease alone cannot
rule out orphaned workers. An unavailable release must remain visible.

Host telemetry and helper retirement still need explicit ownership and exact
process identities. Heavy-file splitting and broader formation-tier equivalence
also remain unfinished; historical timings are not current performance evidence.
