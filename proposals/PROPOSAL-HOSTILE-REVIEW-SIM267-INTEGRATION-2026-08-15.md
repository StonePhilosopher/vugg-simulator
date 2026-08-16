# HOSTILE REVIEW — the SIM 237→267 integration (2026-08-15)

**Subject:** `GTP\Vugg-Simulator` branch `aaa-roadmap-completion` @ `86444b5`
(42 commits, 2026-07-27 → 2026-08-15), merged onto canonical `origin/main`
@ `379180b`.

**Method:** adversarial audit of the *integration*, not of the science alone.
Every claim below was hand-verified in this tree — no finding is reported on the
strength of a commit message. Where a reading turned out to be my instrument
rather than their code, that is recorded too (§5).

**Third review in the line.** The July 2026-07-14 review and the 2026-08-05 WISE
review looked at scenario science. This one looks at whether the work can be
*inherited*: does it merge, does it build cold, does it prove what it says.

---

## 1. Verdict

**The science holds. The evidence plumbing did not.**

The branch tip was red at four of its own CI gates and one test file aborted the
suite before 212 of 232 files ever ran. Every failure was mechanical and
recoverable; none was calibration drift. After two corrective commits the merged
tree regenerates its receipts with the simulation output **byte-identical** —
which is the strongest possible statement that the SIM 267 science is what it
claimed to be.

---

## 2. The divergence was not what it looked like

`git rev-list --count origin/main...aaa-roadmap-completion` reports **1339 / 42**,
which reads like an unmergeable fork. It is an artefact: the 1339 is inflated by a
re-merged parallel history (`Merge remote-tracking branch 'origin/pr-5'`,
`'syntaxswine/main'`) that re-introduces the repo's early lineage.

Measured from the true merge-base `8d4b664` (SIM 237, 2026-07-27):

| Side | commits | source files touched |
|---|---|---|
| main | 1339 | **9** — the drift-audit instruments + 6 baseline regens |
| branch | 42 | **406** — `js/` +31,247 −3,601 |

Merge result: **6 conflicts, all markdown, zero source conflicts.**

*Lesson worth keeping:* on this repo, commit counts across a re-merged history are
meaningless. Diff the merge-base, not the graph.

---

## 3. Findings

### F1 — HIGH — four CI gates fail at the tip; three are structurally invisible
**Status: FIXED** (`fd8b3f0`)

`audit:release`, `audit:science`, `audit:localities`, `audit:evidence` all exit 1.
Reproduced three independent ways: pristine worktree of `86444b5` after a clean
`npm run build`; the merged tree; and the tip **with the GTP working tree's
uncommitted WIP applied** (the WIP does not fix them).

Single root cause: the SIM 267 evidence bake never completed. The committed
`release/content-pack-manifest.json` records byte-counts for `minerals.json`,
`scenarios.json5`, `structural.json`, both thermo files and `narratives/quartz.md`
that match **neither** the committed blobs nor the CRLF checkout — a third
version. The manifest was generated, then the data kept moving, and both were
committed together in `86444b5`.

Two structural aggravators:

- `npm run ci` chains with `&&` and `audit:release` is sixth of twelve, so a
  normal CI run stops there. The other three failures are never reached.
- **`audit:evidence` is in neither `ci` nor `pretest`.** Nothing invokes it. It
  enforces the rule `AGENTS.md` states as law — *"Evidence binds exact runtime
  bytes"* — and it was failing silently.

### F2 — HIGH — a shebang makes four test files unparseable cold
**Status: FIXED** (`ebe41bd`)

`npm test` aborted at file **20 of 232**. `tests-js/build-all.test.ts` could not
be parsed: Vite's SSR transform prepends its CJS-interop shim to line 1, and line
1 was `#!/usr/bin/env node` —

```
const fileURLToPath = __vite__cjsImport2_node_url["fileURLToPath"];#!/usr/bin/env node
                                                                   ^ Invalid Character `!`
```

Because the runner returns on the first failing batch, that abort **hid three
more**. Four tools carry a shebang *and* are imported by tests; run directly, all
four fail identically:

| Test file | imports | when it would have run |
|---|---|---|
| `tests-js/build-all.test.ts` | `tools/narrative-workflow.mjs` | batch 20/232 — aborted the suite |
| `tests-js/evidence-runtime.test.ts` | `tools/science-evidence-receipt.mjs` | never reached |
| `tests-js/locality-envelope-audit.test.ts` | `tools/locality-envelope-audit.mjs` | never reached |
| `tests-js/test-workflow.test.ts` | `tools/test-workflow.mjs` | never reached |

The runner's own tests were among the unreachable.

Fix: delete line 1. The shebangs are decorative — all four are mode `100644` (not
executable), no call site invokes `./tools/<x>.mjs`, and `package.json` always
spawns `node tools/<x>.mjs`. Verified `npm run audit:narratives` still exits 0.

### F3 — MEDIUM — sequencing trap: producer digests hash the producer
**Status: DOCUMENTED**

`tools/science-evidence-receipt.mjs` is the `science-receipt` entry in
`PRODUCER_ENTRIES` (`tools/evidence-runtime.mjs:122`), and `producerContractFiles`
hashes the entry's **local import closure** plus `package-lock.json`. So editing a
producer moves its digest.

Consequence: **the evidence rebake must run after source changes, never before.**
An earlier rebake I ran on the pristine tip was invalidated the moment F2 was
fixed. Anyone repairing this tree in the other order will produce receipts that
fail the gate they were generated to satisfy.

### F4 — LOW (latent) — default-leak in the tiger's-eye origin model
**Status: OPEN — one-line fix available**

`tigerEyeOriginModel()` returns `'surficial_alteration'` when a scenario does not
declare `tiger_eye_origin_model`. A future BIF scenario that forgets the key
silently inherits a *scientific interpretation* — the same shape as the rung-1
F-default leak and the WISE review's `radioactive_pegmatite`-defaults-limestone
finding.

Not live: both current BIF scenarios declare explicitly. Suggested hardening:
return `null` (nucleation already bails on `null`) so an undeclared scenario grows
no tiger's eye rather than quietly asserting a hypothesis.

### F5 — INFO — cost of the archive, measured rather than assumed
`archive/` grows 119.8 → 347.8 MB (tree 165.5 → 402.7 MB). My first instinct was
to call this a push blocker; measuring corrected me. The push payload is
**10.2 MB packed** — versioned JSON deltas compress hard. The real cost is
checkout/clone size, not transfer.

Second-order: `tools/test-workflow.mjs` re-hashes every file in the repo
(5,952 files) to verify project identity **after every batch** — measured at
1.007 s per hash × 233 = **~4 minutes** of a full run, scaling directly with the
archive. It also means **no file may be edited while the suite runs**, or the run
aborts with `project identity changed during the test run`.

---

## 4. Saves conceded

A hostile review that finds only faults is not reporting honestly. This branch
defeats a great deal:

- **Baselines are strictly additive** — 285 → 347 files, **zero deleted, zero
  modified**. `tools/baseline-diff.mjs`, the deliberately deaf measuring stick, is
  untouched, and main's drift-audit instruments survive the merge intact.
- **The citations are real.** Spot-verified: Heaney & Fisher 2003 *Geology*
  31(4):323–326 (the crack-seal model, correctly described as *rejecting*
  pseudomorphic replacement); Post 1999 *PNAS* 96:3447; Turner & Post 1988
  *Am. Min.* 73:1155–1161; Golden, Chen & Dixon 1986 *Science* 231:717; and
  Johnson, OGS Open-File Report **OF3-2019** on Great Salt Plains hourglass
  selenite — confirmed to exist, with matching content. A pointed contrast with
  the WISE review's fabricated "Volodarsk (Namibia)".
- **Tiger's eye obeys rung 3 exactly.** Crocidolite substrate required, no
  bare-wall fallback, BIF host gate — and it ships the Griqualand-West locality
  the rung-3 ruling anticipated, as a *deliberately paired hypothesis test*
  (antitaxial crack-seal vs surficial alteration, one scenario each).
- **New structural data is honest about its own uncertainty** — the birnessite
  entry volunteers that natural material is stacking-disordered and may be
  triclinic or hexagonal, and that the renderer treats it as an aggregate.
- **The test runner is honest about trust.** It refuses a zero-test PASS, refuses
  to publish a full-suite PASS on a resumed run, and labels its own record
  `local-uninterrupted-result-not-independent-attestation`.
- **Instruments stay passive by default.** `asbestos-hills-observe` reports
  unless `--check` is passed; only then does it set a non-zero exit.
- **The suite is not hollow** — 8,070 assertions, no test file without one, and
  the single `skip` is a platform guard that runs on Windows.
- **The strip-archive generator refuses to launder its own evidence**: *"There is
  deliberately no adoption escape hatch: only an execution by the exact bundle may
  mint its receipt."*

---

## 5. What I got wrong, and one thing I could not resolve

Recorded so the next reader does not repeat either.

- **I mis-measured twice with pipelines.** `node tool.mjs | tail; echo $?` reports
  `tail`'s status. It made a hard `process.exit(1)` look like a vacuous pass. Take
  the exit code before piping.
- **I suspected line endings first.** The manifest byte-deltas (485, 1268, 19, 68,
  2) looked like newline counts; the actual CR counts (19096, 5572, 997, 588, 117)
  refuted it. Measuring the blob, the checkout and the manifest as three separate
  numbers is what settled it.
- **My sparse-checkout exclusion silently did nothing** — `archive/` was present
  the whole time. Had it worked, three findings would have been artefacts of my
  own instrument. Verify the exclusion, not the intent.

**Unresolved:** `GTP\Vugg-Simulator\.local-evidence\test-workflow-last-pass-v2.json`
records a genuine `full_suite_pass: true` over 231 files **including**
`build-all.test.ts`, timestamped `10:36:53` — eight minutes *before* the tip commit
at `10:44:44`. Node 24.15.0, V8 13.6.233.17-node.48, win32/x64 and all 66 installed
packages are identical to this tree, and the failing file has not changed since
`5c09f47`. I reproduced the F2 failure cold four ways and **cannot account for that
pass**. By the tool's own contract the record does not attest the tip anyway (the
identity moved), but the discrepancy is logged rather than explained away — if a
warm local state can make four unparseable files pass, that is worth understanding
before trusting any future local PASS record.

---

## 6. Integration state

Branch `integrate/gtp-sim267` in the canonical tree, **not pushed**:

| Commit | What |
|---|---|
| `95f5d61` | the merge — 6 markdown conflicts resolved, zero source conflicts |
| `ebe41bd` | F2 — decorative shebangs removed |
| `fd8b3f0` | F1 — SIM 267 evidence bake completed; 4 receipt files, science byte-identical |

**Verified green at `fd8b3f0`** (2026-08-15 21:22 → 2026-08-16 00:54, 3 h 32 m):

```
CI_RC=0        12 gates: typecheck, build:check, tutorials, a11y, scenarios,
               release, creative, cations, bif, science, localities, test
               [test-workflow] UNINTERRUPTED PASS: 232 files under one
               unchanged project identity
EVIDENCE_RC=0  [science-evidence] PASS: 126 artifacts, exact execution + producers
```

(The two `[test-workflow] FAIL in batch 2/3` lines in that log are stderr from
`tests-js/test-workflow.test.ts` driving the runner's own stop-at-first-failure
path over `a.test.ts`/`b.test.ts` fixtures — not real failures.)

**Cost note for whoever moves next:** any change under `js/` now moves the
browser-bundle hash, which invalidates every receipt and obliges a full
`science:rebake` + `gen:release` + revalidation — a ~3.5 h cycle. Batch F4 and
any other engine edits into one tranche rather than paying that per commit.

Nothing in `GTP\` was modified: the branch was fetched read-only and reviewed in a
throwaway worktree, per the standing rule that the comparison artefact stays intact.

**Left for the boss:**

1. Whether to push to `Syntaxswine/main` (outward-facing — not done without an order).
2. F4's one-line hardening.
3. Wiring `audit:evidence` into `ci` — and considering whether `ci` should keep
   running past the first failure, since `&&` hid three of four gate failures here.
4. The GTP working tree still holds uncommitted work (9 modified, 2 untracked).
   Note that its `tools/build.mjs` imports the **untracked** `tools/file-bundle-assets.mjs`
   — a `git commit -a` there would ship a broken build.
