# HANDOFF — O5-splitting complete; toward the HOSTILE REVIEW

**2026-07-14 · SIM_VERSION 226 · tree green at `d0017e4` (Pages-verified) · the O5
SPLITTING LADDER is COMPLETE.** This is the bridge doc: it wraps the vol-neutral arc
and lays the ground for the next task the boss named — a **hostile review** — to be
started in a FRESH context (post-/compact), big, and likely broken into segments.

Read the keystone lineage in `HANDOFF-FOUNDATIONS-2026-07-03.md` (fifteenth →
eighteenth hand + postscript) for the full narrative. This doc is the pointer.

---

## 1. What just shipped (so you don't re-audit it)

The O5-splitting ladder closed across four moves — **split → degree → cost**:

| tranche | commit | nature | what |
|---|---|---|---|
| S-a | `fbac070` | byte-identical | two-route `_split` index recorded-unread + census + noncollision certificate |
| S-b | `b6c0e5c` | render-only | `_split.rung` EARNS the habit (sheaf → fan, spherulite → botryoidal); per-route/per-mineral/structural calibration |
| S-c | `96a7d8d` | render-only | `_split.index` sets HOW FAR — continuous splay/curvature/completeness (17 fan buckets) |
| vol-neutral | `878b150`→`80149cf` | **SIM 226 bump** | splitting COSTS length at constant volume (a_width widens); measured blast radius 7 non-split ≤0.1% in 1 scenario |
| §9f magnitude | `1b8b590` | render-only, **zero drift** | the flat 0.7 → the real aspect collapse `(A₀/A_target)^(2/3)`; baseline-identical to v226 |
| replay fix | `5d8060e` | render-only | `_topoHistoricalCrystalSize` mirrors the live compaction (no more snap) |

Full record: `PROPOSAL-O5-SPLITTING-LADDER-2026-07-10.md` §9a–§9f. Instruments:
`tools/o5-split-census.mjs`, `tools/o5-split-render-probe.mjs`,
`tools/o5-volneutral-census.mjs`. The only remaining O5-splitting note is the small
**bent-BLADE generator** (so curved gypsum/selenite bow like their rhomb cousins —
the render's last corner). **One thing owed to the boss:** a live eye on the deploy
(WebGL screenshots time out here; the arc was verified headless + numeric).

---

## 2. THE DRIFT PHILOSOPHY — read this before the review

Boss, 2026-07-14 (now [[feedback_accuracy_over_determinism]]): **"Making it
accurate-to-life is more important than making sure it's always the same. The reason
to avoid drift is that it keeps the science honest by making it JUSTIFY the cost of
the change. I always suspected as the science got stronger there would be drift."**

The byte-identical / census-bounded / SIM-bump-two-commit rituals are a **forcing
function**, not a veto. A hostile review that finds the sim is wrong should FIX it
for accuracy — and the resulting baseline drift is legitimate, even expected. Measure
the cost (the census/blast-radius instruments), let the science justify it, pay the
regen, ship. Do not preserve a falsehood to keep the numbers still.

---

## 3. THE HOSTILE REVIEW — the next task (scope is the boss's to define)

My read, to be confirmed/reshaped with fresh context: an **adversarial audit of the
simulator's scientific accuracy** — deliberately hunting for where the vugg lies,
confabulates, or is unrealistic-to-life, using real mineralogy + the specimen bench
as the falsification standard (the adversarial form of "does a real rock agree?",
[[feedback_terminal_verification_specimens]]). It is big; expect to SEGMENT it (by
scenario, by mineral class, by mechanism rung, or by strip-version era).

**The primary evidence trail is the STRIP ARCHIVE** (`archive/strips/`, see its
README): one folder per SIM_VERSION (v194 → v226), one file per scenario — the full
per-step chemistry trajectory + nucleation bells of the canonical seed-42 vugg. It is
the sim's TESTIMONY, kept diachronically. Read it adversarially: would a geologist
believe this crystal's biography, this paragenetic order, these co-occurrences?

- Boss context: strips have been saved "as long as the helicoid manifold has been
  around." **The EARLIEST versions are largely NOISE** — they captured the era's BUGS
  (things not happening that should have; confabulations later removed). The README's
  canonical example: v194's mvt story carries acanthite + native-silver bells that
  v195 deleted as a confabulation (Tri-State is diagnostically silver-poor). Weight
  RECENT versions as the current science; mine the early ones for *what was fixed and
  why*, not as ground truth.
- Tool: `tools/strip-archive-diff.mjs <vOld> <vNew> <scenario>` overlays two versions
  (loudest chip Δ, bell gains/drops) — the de-confabulation made visible. `--all` for
  a fleet sweep.
- The boss may also have their OWN strip-mode saves (from the UI, older than v194);
  ask for them if the review reaches back before the automated archive.

**Suggested opening move** (a fresh session should confirm with the boss first): pick
a segment, pull the recent strip stories for it, and adversarially list every claim a
real mineralogist would challenge — then triage into (a) real inaccuracy → fix for
accuracy (drift welcome), (b) acceptable abstraction, (c) needs a specimen/literature
check. Use a workflow / subagents for breadth if the boss opts in.

---

## 4. Housekeeping for the fresh session

- Session-start ritual: `node tools/cold-ci.mjs --check` (stamp is being refreshed at
  `d0017e4`). Shell cwd resets after /compact — `Set-Location` to the repo first.
- Push target `origin` = Syntaxswine; push IS the deploy; verify `pages/builds/latest`
  == HEAD before "go look". Commit via `git commit -F <tempfile>` (BOM trap: don't use
  PS `Out-File -Encoding utf8`; use the Write tool or a BOM-less writer).
- A concurrent **freestone** session has been running vitest in a loop this whole
  session, stealing CPU — if cold-CI shows all-timeout failures, that's the contention
  ([[feedback_coldci_preview_contention]]), not a regression; re-run the timed-out
  files with `--testTimeout=300000`.
