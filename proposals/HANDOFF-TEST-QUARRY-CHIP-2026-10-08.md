# Test Quarry: bounded chip check

Base: Syntaxswine/main `f019063758e1b345024f14c9619f458c2ac30608`.
The monitor-outcomes tranche is merged; its GitHub post-merge CI passed.

## Delivered scope

This is the first bounded implementation of the older handoff's authored
changed-file-to-subsystem map. `tools/test-chip-map.json` names the runner,
ledger/packing, and selector paths, their test witnesses, and the reasons for
each mapping. The selector's tests independently pin those required witnesses.
Scientific source/data, calibration helpers, shared fixtures, build configuration,
new tests, and any other unmapped path require the full check. There is no broad
directory rule that silently classifies new files as safe.

Preview without executing tests:

```text
node tools/test-chip-check.mjs --base origin/main
```

Prepare the usual test bundle and execute the plan:

```text
npm test -- --chip-base origin/main
```

The base must resolve locally. Fetch the intended review base first. The plan
records its resolved base, HEAD, and merge-base commits. It unions the branch
diff with staged, unstaged, and nonignored untracked paths. Separate comparisons
retain committed or staged changes even when working edits undo them. Rename
detection is disabled so both names must be covered. Deleted mapped code or a
missing selected test refuses the selection.

The command refuses an incomplete map or a zero-test selection, with no chip
PASS. Exit 2 means selection was refused; it can also mean unavailable monitoring,
so read the diagnostic. A valid run uses the existing serial, one-file-per-child
RSS watchdog and whole-project identity guard. It cannot resume, clear, advance,
or publish a full-suite checkpoint/result. Passing batches still enter the
measurement-only cost ledger. The final message explicitly limits the PASS to
the selected tooling tests.

## Older branch reconciliation

`ci/test-quarry` at `63f7f51c` and this main have diverged (15 commits unique to
that branch, 136 unique to this main at inspection). Its foreman, host sampler,
profiling wrappers, and helper/setup changes are not all on main. This tranche
uses the current main runner and does not transplant those implementations.
The older timing observations do not establish a speedup on today's runtime.
Batching stays at one file per child; concurrency and memory limits are unchanged.

## Validation and its limits

Windows x64 / Node 24.15.0:

- The chip command selected three files and passed 66 tests, including real
  temporary Git repositories for committed/staged/unstaged/rename/delete/untracked
  cases, duplicate/unsafe map rejection, and outside-scope refusal.
- Four deliberately seeded defects each made the actual chip command fail with
  failed test assertions: dropping the runner witness, ignoring unmapped changes,
  returning PASS after monitor loss, and removing the shard-0 sentinel pin.
  Each modified file was restored byte-for-byte before the next probe.
- The witnesses are registered full-suite tests, so the chip exercises the same
  assertions rather than a weaker copy. This is a bounded detection witness,
  not proof of whole-suite equivalence for all future mutations or subsystems.
- A real unmapped-file probe returned exit 2 before any test child started;
  checkpoint, completion reports, and ledger were byte-for-byte unchanged.
- After restoring every mutation, the chip command again passed all 66 tests.
  Typecheck, exact build verification, and science/evidence/release audits passed.

The scientific model, baselines, receipts, and generated runtime are unchanged.
No rebake is needed. This tranche makes no measured full-suite performance claim.
It does not replace the release/science gates or claim the full multi-hour suite
was run.

## Next unfinished work

Expand the authored map one audited subsystem at a time, adding independently
seeded failure witnesses for each expansion. Reconcile and validate the older
foreman before adopting its concurrency or batching. Heavy-file splitting and
formation-tier equivalence remain separate work. Do not promote this bounded
tooling chip check into a general science acceptance gate.
