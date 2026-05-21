# Field notes from the v117–v124 session

**Author:** builder (Claude Opus 4.7, 1M context)
**Date:** 2026-05-21
**Status:** Reflective handoff — for fresh-context builders landing cold

This document is the leftover wisdom from an 8-commit session that took vugg-simulator from v116 → v124. It captures patterns that bit me, recoveries that worked, and the shape of the surface area as I came to understand it. Not a replacement for the skills (`vugg-add-mineral`, `vugg-add-scenario`, `vugg-tune-scenario`, `vugg-add-broth`) — those are still where the canonical procedural knowledge lives. This is the **meta-knowledge** that didn't quite fit anywhere else.

---

## What this session shipped

| v | Commit | What |
|---|---|---|
| v117 | `483526c` | Agent-friendly URL interface (`?scenario`, `?seed`, `?dump=specimen`, `window.vugg`, keyboard shortcuts) |
| v118 | `4115d60` | TN457 barite-pulses scenario + barite trace_Mn capture fix |
| v119 | `0ddc20f` | trace_Mn audit (sphalerite, wurtzite, smithsonite) |
| v120 | `bf28497` | MINERAL_STOICHIOMETRY backfill — 22 inactive entries + HANDOFF doc + DEFERRED_TUNE_REQUIRED list |
| v121 | `d15d723` | Per-zone Mn color dispatch (4 minerals — barite + ZnS dimorphs + smithsonite) |
| v122 | `467a1ae` | Carbonate-family color (aragonite/dolomite/siderite/rhodochrosite) + PROPOSAL-SPECIMEN-OBJECT.md planning MD |
| v123 | `34a3e1a` | Jeffrey P1 stoichiometry tune (11 of 12 minerals + event-chemistry retune) |
| v124 | `372e568` | Cumbria P2 stoichiometry — PARTIAL (1 of 4); 3 deferred per Shape-B cascade |

Net: 954 tests passing, 62 files. DEFERRED_TUNE_REQUIRED reduced 28 → 16.

---

## The ten heuristics that bit me

### 1. Stale header comments cost half-days

`js/19-mineral-stoichiometry.ts` opened with "Default flag OFF — these values do not affect any scenario until the calibration pass flips the flag." That comment was years old; `js/18-constants.ts:39` had `MASS_BALANCE_ENABLED = true` for ages. The file header was lying about the actual default. **I trusted the header and shipped a v120 attempt that broke 16 scenarios.**

**Fix (this commit):** updated the header to flag itself as stale and point at the actual constant.

**Heuristic:** when a file's header explains DEFAULT BEHAVIOR for a flag, GREP the flag's actual value before believing the header. Five seconds; saves hours.

### 2. Adding a stoichiometry entry IS engine drift

Because `MASS_BALANCE_ENABLED = true`, every MINERAL_STOICHIOMETRY entry that fires in a baseline scenario immediately debits fluid for that mineral's growth. That cascades through subsequent supersaturation calculations. Even ONE new entry can drift 16 scenarios (the abandoned v120 big-bang attempt; see commit history for the rollback).

**The v109 antipattern memory the boss has** (`feedback_*.md` in user memory) names this directly. I burned a half-day re-discovering it. Don't.

**Heuristic:** before adding a `MINERAL_STOICHIOMETRY` entry for a mineral that fires anywhere, ask: which scenarios does it fire in? Run `grep "no stoichiometry for" $(npm run build 2>&1)` against `gen-baseline` output. Each scenario that flags it is a potential cascade ripple.

### 3. The "double-debit pattern" diagnostic

Event handlers in `js/70*-*.ts` files often have `Math.max(floor, fluid.X - decrement)` lines that HAND-MODEL consumption. These were written BEFORE mass balance was on (per #1's stale comment). With mass balance on AND a new stoichiometry entry for a mineral that grows in that scenario, you DOUBLE-DEBIT — the engine debits via stoichiometry AND the event hand-decrement runs.

Symptom: minerals that should fire drop out even though sigma gates clear.

**Fix pattern:** flip consumption-pattern lines to RELEASE-pattern lines. `Math.max(floor, X - dec)` → `Math.min(ceiling, X + add)`. Bump release magnitudes generously to counter the now-active stoichiometry debits across inter-event intervals.

**Worked example:** `js/70r-jeffrey-mine.ts` v123 commit — every event was reworked from consumption-to-release. The diff is the canonical reference.

### 4. Shape-B RNG-cascade displacement (the structural wall)

Two layers of nucleation gating:
- **σ-gate**: chemistry-based threshold for supersaturation
- **Nucleation-iterator order**: per-step, the per-mineral-class iterator order determines who-grabs-fluid-first

When mass balance is on, even a single new mineral's stoichiometry shifts WHICH mineral grabs WHICH fluid first per step. The σ-gate may still clear for caledonite, but pyromorphite + Ag-sulfosalts fire FIRST and grab the Pb. **Caledonite never nucleates.**

This is the "Shape-B" issue that `js/70q-roughten-gill.ts:103-113` already documents at the file level for linarite. The boss's "competition for solutes" / "initiative variable" framing in `PROPOSAL-SPECIMEN-OBJECT.md` Q7 is the architectural fix.

**Heuristic:** if a paragenesis pin breaks after a stoichiometry addition AND raising the relevant cation generously doesn't restore it, you're hitting Shape-B. **Don't try to tune past it.** Defer the entry; surface the case in HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md.

### 5. gen-baseline overwrites the current baseline file

`node tools/gen-js-baseline.mjs` writes `seed42_v${SIM_VERSION}.json`. If you run gen-baseline DURING a probe (before bumping SIM_VERSION), it overwrites the just-committed v123 baseline with your in-progress changes. Later you compare and see "16 scenarios drifted" when actually nothing drifted on the committed baseline.

**Recovery:** `git checkout HEAD -- tests-js/baselines/seed42_v${OLD_VERSION}.json` to restore.

**Heuristic:** bump SIM_VERSION FIRST, then run gen-baseline. Or run gen-baseline against `C:/Users/baals/AppData/Local/Temp/` and diff manually.

### 6. Test pins should use `>=`, not `===`, when version-sensitive

I wrote `expect(SIM_VERSION).toBe(117)` in the v117 agent-interface test. At v118 the test failed. Replaced with `expect(SIM_VERSION).toBeGreaterThanOrEqual(117)` — durable.

**Heuristic:** when a test pins a version because "this feature shipped at vX," use `>= X`. Tests that need exact-version match are rare and should be intentional.

### 7. Boss-favorite recovery move: roll back, surface, defer

When my v120 big-bang attempt broke 16 scenarios and 4 test pins, my instinct was "tune harder." The boss memory `feedback_*.md` rules + their v109 dogfood explicitly warn against this. I rolled back, surfaced the issue cleanly, and the boss approved the disciplined Option-1 (22 inactive entries only) — which became a clean v120 ship.

**Heuristic:** if a single commit needs >2 tune iterations to be green, you've outgrown one commit. Roll back, surface, defer. The disciplined retreat ALWAYS wins over the "just one more iteration" tendency.

### 8. The agent-api is the third runtime

`agent-api/vugg-agent.js` exists as a Node.js JSON-over-stdio CLI for AI agents. It's the third runtime alongside the browser bundle (`index.html`) and the `tests-js/` harness. **DELIBERATELY simpler than the main sim** — lags on features per its header comment ("deliberate lag, not drift"). If you find yourself building "headless agent run" infrastructure, check what's already in `agent-api/` first.

This also affected the v117 agent-friendly URL design — the `?dump=specimen` JSON schema mirrors `agent-api/vugg-agent.js`'s `finish` response shape so any tool built against one parses the other unchanged.

### 9. Engine globals are LEXICAL, not on `window`

`SCENARIOS`, `MINERAL_ENGINES`, `rng`, `SeededRandom` — all declared at top level of `js/*.ts` files. The script-mode TS bundle concatenates them into one big IIFE. Inside the bundle: lexical refs work (`rng = new SeededRandom(seed)`). On `window`: they're not exposed.

The test harness's `setup.ts` reassigns to `globalThis` AFTER eval, so tests see them as globals. But the BROWSER doesn't, so `(globalThis as any).rng = ...` in a browser-bundled file DOES NOT mutate the bundle's `rng`. It creates a separate `globalThis.rng`.

I burned ~30 minutes on this during v117. The determinism guard test caught it. **Fix:** use direct lexical references everywhere inside the bundle (`rng = new SeededRandom(seed)`). Pattern: `js/91-ui-legends.ts:87` is the canonical example.

`v117 commit message` has the full architectural note.

### 10. Per-scenario tune > per-mineral tune

When you have 12 minerals all firing in `jeffrey_mine` (v123 P1), the right unit of commit is "scenario tune" — add all 12 stoichiometries + retune the scenario's events in one commit. NOT one mineral at a time. Why: each mineral addition cascades; retuning incrementally just chases drift.

But when you have 4 minerals firing across `roughten_gill + schneeberg + sunnyside_american_tunnel` (v124 P2), the right unit is "isolate the safe one" — only one mineral (`pharmacolite`) fires in a scenario without cascade pressure. Ship that; defer the others.

**Heuristic:** if your target minerals all share ONE scenario, ship them together. If they cross multiple scenarios with cascade pressure, isolate to the safest subset and defer the rest with explicit documentation.

---

## State of the world at v124

### What's done
- Agent-friendly URL interface (v117) — `?seed=`, `?dump=specimen`, `window.vugg`, keyboard shortcuts. Use to dogfood scenarios.
- TN457 scenario (v118) — Cumbria barite-on-sphalerite forcing-function test; 50 fluid pulses.
- Per-zone Mn color rendering (v121-v122) — 9 minerals (barite + sphalerite + wurtzite + smithsonite + calcite + aragonite + dolomite + siderite + rhodochrosite) paint per-zone trace_Mn.
- v120 inactive-subset stoichiometry — 22 minerals registered with stoichiometry but never fire; zero cascade.
- Jeffrey P1 stoichiometry tune (v123) — 11 minerals + event retune.
- Cumbria P2 partial (v124) — pharmacolite only.

### What's pending (16 minerals in DEFERRED_TUNE_REQUIRED)
- **P1 holdout:** pectolite (one mineral; needs Na-window tune in jeffrey late_ca_silicates event)
- **P2 cascade-stuck:** caledonite, plumbogummite, proustite — Shape-B; needs Q7 architectural work
- **P3 Tsumeb:** dioptase, willemite, conichalcite, duftite, koettigite, metacinnabar — UNTESTED; might be tunable like P1 since supergene_oxidation has more cation-budget room
- **P4:** uranophane — Schneeberg/Colorado Plateau
- **P5 secondary:** cassiterite, lepidolite, opal, pyrolusite, tigers_eye

### What's blocking
- **Specimen as first-class object** (PROPOSAL-SPECIMEN-OBJECT.md) — has 7 open questions (Q1-Q7) awaiting boss answers. When answered, Phase A is ~150-200 lines + tests.
- **Q7 initiative-variable** — the architectural question that would unblock P2 cascade-stuck stoichiometries. Big arc, not a tune.
- **Per-zone color in the main 3D renderer** — chemistry is captured (v118-v122) but the 3D ellipsoid renderer still uses crystalColor-averaged. The zone-bar viz DOES show banding correctly. Rock Bot needs to visual-diff TN457 to confirm whether the 3D renderer change is necessary.

### Untouched (deliberately)
- `js/93-ui-collection.ts` (save schema)
- `js/95-ui-library.ts` (library card layout)
- `js/98-ui-groove.ts` (Record Player canvas)
- Main 3D crystal renderer (`js/99i-renderer-three.ts`)

These are the boss's flagged fragility zones — no automated coverage, canvas-drawn, save-format-affecting. **Don't touch without explicit greenlight and a working visual-diff plan.**

---

## Reading order if you land cold

Cold-context reading priority (top is most important):

1. **`CLAUDE.md` + memory files** — boss memory + project rules + working agreements
2. **`js/README.md`** — module layout, where everything lives
3. **`proposals/PROPOSAL-SPECIMEN-OBJECT.md`** — the architectural arc in flight; 7 open questions
4. **`proposals/HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md`** — the deferred-list source of truth
5. **`proposals/HANDOFF-FIELD-NOTES-V117-V124.md`** — this doc
6. **`js/15-version.ts`** — change history at version-block granularity; the canonical "what changed when" reference
7. **`js/26-mineral-paragenesis.ts`** — substrate affinity + EPITAXY_PAIRS + PSEUDOMORPH_ROUTES tables. The "follow the science" framework.
8. **`js/19-mineral-stoichiometry.ts`** — mass balance table; with v124 commit, the header flag warning is now honest
9. **`agent-api/vugg-agent.js`** — third runtime; read if you're working on agent-facing features
10. **Active skills:** `vugg-add-mineral`, `vugg-add-scenario`, `vugg-tune-scenario`, `vugg-add-broth`

If you're picking up a specific arc:
- **Specimen-MVP:** read PROPOSAL-SPECIMEN-OBJECT.md fully; answer Q1-Q6 with boss; build Phase A
- **Stoichiometry continuation:** read HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md; pick P3 Tsumeb as the next safe candidate
- **Per-zone color in 3D renderer:** read `js/99i-renderer-three.ts` from the top; look for `crystalColor()` call sites; design per-vertex coloring scheme

---

## Architectural questions awaiting decisions

All seven Q-blocks in `proposals/PROPOSAL-SPECIMEN-OBJECT.md`:

| Q | Topic | Builder rec | Boss status |
|---|---|---|---|
| Q1 | Adjacency-union vs strict host-chain | Wall-adjacency union, radius 3-5 cells | [pending] |
| Q2 | Dissolved member label | Perimorph-aware via existing `perimorph_eligible` | [pending] |
| Q3 | Sibling vs chained label form | `+` for siblings, "on" for chain | [pending] |
| Q4 | 3D model in library | Re-runnable URL (composes with v117) | [pending] |
| Q5 | Snowball habit refactor | Keep as-is; treat as cluster_type='mass_nuc' | [pending] |
| Q6 | Inventory drill-down depth | Both stacked (sheet + crystal list) | [pending] |
| Q7 | Initiative variable / competition for solutes | Out of scope for Specimen MVP; dedicated arc | [pending] |

Q7 is the one that would unblock the P2 cascade-stuck minerals.

---

## A note on temperament

The boss values:
- **Disciplined retreat over heroic tune iteration** — v109 antipattern memory, "Refactor vs content sequencing" rule
- **Honest commit messages** — dense, with verification numbers, citations, the why
- **Volunteer curiosity** — surface adjacent angles, name your gaps, don't just answer the literal question
- **Defer to actual geology** — when chemistry vs visuals vs design-convenience conflict, the rock wins
- **Build tools to verify** — match the agent-api + gen-baseline + calibration-sweep pattern. The tool is part of the deliverable.
- **Anticipatory proposals** — when boss is mentally chewing on something, do real research and synthesis, not hand-waving
- **Diagenesis credit** — when summarizing what shipped, name the prior infrastructure that made the velocity possible

The boss memory file in user memory (`MEMORY.md`) is the canonical reference for working agreements. Read it on first landing.

**One specific tone note from this session:** the boss said "the whole project is grounded in 'follow the science.' the fact that its already in there is testament to that." That framing came up TWICE during my session — once for the agent-api blind spot and once for the event-driven-precipitation blind spot. Both times the proposal had asked for capabilities the engine already had because the science had led both proposer and builder to the same answer. **Trust the literature; the engine already does.**

---

## Words for the next builder

You're walking into a codebase where the science is load-bearing and the engineering is careful. The temptation will be to push for big-bang fixes when small-bang fixes feel inelegant. Resist that.

The boss's memory says it best: *"Sequencing beats per-task leverage ranking."* When you have to pick between (a) shipping a beautiful refactor that touches 10 files or (b) shipping a clean increment that touches 1 file and surfaces what's deferred, **pick (b).** The HANDOFF docs are not failures — they're the right shape of artifact for an in-flight architectural arc.

Read the v109 antipattern memory before you do anything with `MINERAL_STOICHIOMETRY`. Then read it again. Then think about what cascades when you change one thing. The boss will not be impressed by speed; they WILL be impressed by you catching a Shape-B before shipping it.

The proposals folder is full of work-in-flight. When in doubt, write a PLANNING DRAFT with `[ pending boss answer ]` blocks instead of guessing. The boss answers thoughtfully; the questions ARE the value.

When you find a real geological gap (like v118 barite-trace_Mn — the textbook Mn-banded sulfate not capturing trace_Mn), **fix it inline**. That's not scope creep; that's "fix bugs when seen" from the boss memory.

The unit of work is roughly a Jeffrey arc (30-60 minutes of probe-diagnose-adjust-verify per scenario). When something is taking longer, it's probably a 2-arc thing and you should split.

Show genuine curiosity in commit messages. Cite the literature. Name the prior commits whose infrastructure you're standing on. The boss reads commit messages like papers — give them the dense version. (`feedback_commit_messages_dense.md` in user memory.)

And if you find yourself fighting the engine, the engine is probably right. The science already led there. Sit with it for a few minutes before pushing back.

---

*"The science was already there. I need to do better reconnaissance before I write." — boss reflection, 2026-05-21*
*"The fact that its already in there is testament to that." — boss, same conversation*

The codebase is a record of someone who deeply loves rocks and wrote them into runnable form. Honor that.

— builder (Claude Opus 4.7), 2026-05-21
