# HANDOFF — fix-ladder rung 3: the tiger's-eye substrate gate (2026-07-14)

For the fresh context that picks up the hostile-review fix ladder. Rungs 1 (F leak,
SIM 227 `cd34387`) and 2 (T-gates, SIM 228 `892dbb8`) are SHIPPED, deployed, cold-CI
stamped clean-tree. You are rung 3 per the boss's order.

## Read first (in this order)

1. `proposals/PROPOSAL-HOSTILE-REVIEW-2026-07-14.md` — §5 (31 DEFENDED objections, do
   not re-raise), §6 (the ladder, rungs 1-2 marked ✅ with their full stories).
2. `proposals/BACKLOG.md` — the 🗿 rung-2 banner + **§T** (T-gate leftovers, the
   wrong-declared-values table, and the follow-on mechanics list rung 2 exposed).
3. This file's §Traps below — the expensive lessons, so you don't repay them.

## Rung 3 in one paragraph

Tiger's-eye is the most locality-specific mineral in the catalog — a chalcedony
pseudomorph after crocidolite (asbestiform riebeckite), a Precambrian BIF phenomenon
(Griqualand West / Hamersley; Heaney & Fisher 2003 Am. Min. 88:1, the sim's OWN cited
source). The nucleation substrate cascade in **`js/89-nucleation-silicate.ts`
`_nuc_tigers_eye`** (dissolving-crocidolite p=0.65 → hematite p=0.45 → magnetite
p=0.30) falls through to a **bare 'vug wall' fallback**, so it mints in basalt
amygdales, topaz veins, and pegmatite pockets from generic late silica+Fe+O2>0.4.
The fix the review specifies (and the boss approved): **require a real
dissolving-crocidolite (or BIF Fe-oxide) substrate; DELETE the bare-wall fallback.**
The growth engine reference is `js/59-engines-silicate.ts` ~:1476 (the 'TIGER IRON
BIF' fallback region the review verified by hand).

## Offenders at v228 (seed 42) — the expected blast radius

| scenario | v228 state | expects tiger's-eye? |
|---|---|---|
| ouro_preto | fires late supergene (steps ~199+) | NO — pure kill |
| deccan_zeolite | ×3 from step 69, routed via 'TIGER IRON BIF' on hematite | NO — pure kill |
| radioactive_pegmatite | ×5 during the oxidizing-meteoric event | NO — pure kill |
| bisbee | **NEW at v228** — the rung-2 re-deal minted one (baseline-diff `+tigers_eye`) | NO — pure kill |

No scenario expects tiger's-eye (its legit home — a BIF scenario — doesn't exist yet;
that's a missing-scenario note, not this rung's job). So rung 3 should be the
CLEANEST rung: pure de-confabulation, zero promise decisions, zero expects edits.
Which crocidolite hosts exist: crocidolite has a real engine (amphibole file,
gates [100,400] gates-read) — census whether ANY scenario grows-then-dissolves
crocidolite (if none, the p=0.65 branch is currently dead code and tiger's-eye goes
extinct at seed 42 until a BIF scenario ships — that is CORRECT and should be said
plainly in the commit).

## The ritual (unchanged from rungs 1-2)

Session start: `vugg-session-start` skill (cwd resets after /compact; cold-ci --check
before paying for a run). Census instrument first if the fix warrants one (rung 3 may
only need a small strip/fleet census — where does tigers_eye fire, what substrate did
each event actually use; consider extending the census to LOG the cascade branch
taken). Then: researched edit → `npm run build` (NEVER bare build.mjs) → blast radius
(scratchpad `t-blast-radius.mjs` pattern vs `seed42_v228.json`) → full vitest →
rebake (gen-js-baseline + gen-strip-digest + gen-strip-archive → v229 — bump
SIM_VERSION FIRST, the archive tool refuses to overwrite) + `tools/baseline-diff.mjs`
+ `tools/mineral_coverage_check.mjs` (stale gate: currently 1 = jeffrey magnetite,
pre-existing) → explicit staging (never `-A`) → commit -F tempfile → verify title →
push (= deploy; verify pages/builds/latest commit==HEAD) → cold-ci clean-tree stamp.

## Traps rung 2 paid for (don't pay twice)

- **Initiative is BEHAVIOR**: MINERAL_GATES metadata (T_min/T_max/T_optimal) feeds
  js/43→js/44 cation rationing. Any gates-entry edit moves baselines even without a
  σ-gate change. Tiger's-eye gates edits are behavior-live.
- **σ→0 outside an envelope reads as undersaturation** → out-of-window relics
  DISSOLVE rather than freeze (house convention; naica's early quartz does this).
  Substrate-gating tiger's-eye may dissolve existing crystals mid-run — decide
  whether that's the story you want before shipping.
- **`wall.composition` defaults to 'limestone'** (js/22:100) and `wall_Fe_ppm`
  defaults to 2000 — unset-means-something leaks; don't trust "the scenario didn't
  set it" to mean "absent".
- **Verify your own grep filters**: rung 2 briefly mis-read "elmwood barite
  unchanged" because the blast-radius output was filtered to rung-2 species. Diff
  tables are only as complete as the filter that printed them.
- **Measure rejected alternatives and record them**: the roughten SiO2 raise and the
  elmwood Ba-floor raise were both tried, measured, rejected, and their numbers
  recorded in comments — that record is what makes the shipped choice defensible.
- **Subagent citations get re-verified**: two literature citations in shipped
  metadata failed verification this rung (M&B 1986 wurtzite cite; the review's own
  Bessinger 2000). Every load-bearing citation gets a re-check before it lands.

## Morning-after checklist (the canary, next 04:00 sweep)

Pre-registered at `892dbb8`: expect alarms for vanished wurtzite (5 scenarios),
vanished cold quartz (~13), GSP anhydrite 8→0, porphyry calaverite/sylvanite/mimetite,
sulphur_bank arsenopyrite, hot-vein aragonite (elmwood/reactivated/wittichen/grimsel/
stalactite/tutorial_mn), and STRENGTHENED sphalerite + the sunnyside sphalerite /
ultramafic chrysoprase recoveries. All of those are the fix working. Anything ELSE
moving is worth a look. `npm run creep` in vugg-canary re-runs the sub-threshold
census when wanted.

## Still standing from BEFORE the review (double-checked at handoff time — don't lose these)

Carried from HANDOFF-TOWARD-THE-HOSTILE-REVIEW-2026-07-14.md and the O5-era banners;
none of them are rung work, all of them are still open:

- **Boss eye-check on the live deploy — OWED, now three bumps deep.** The O5 arc
  (SIM 226) was verified headless because WebGL screenshots time out here, and SIM
  227 + 228 shipped the same way. Suggested viewing when the boss looks: the deccan
  stilbite sheaves / aragonite sphere (the O5 ask), plus rung-2's visible changes —
  sunnyside's recovered sphalerite, ultramafic's chrysoprase, sicily without its
  bogus quartz forest, the elmwood snowball still banding.
- **The bent-BLADE generator** (curved gypsum/selenite bowing like their rhomb
  cousins) — the last corner of the O5 splitting render arc. Lives in the O5 banner
  in BACKLOG; unrelated to the fix ladder, still wanted.
- **vugg-canary owner action: `node src/schedule.mjs --install`** (in the vugg-canary
  repo) — arms StartWhenAvailable + battery settings on the 04:00 task. Staged in
  Part A of the review, deliberately never armed by the builder (persistent config =
  owner's hand). Until it runs, missed 4AM wakes stay possible.
- **Boss's own strip-mode saves (pre-v194, from the UI)** — offered during review
  prep; not needed for the fix ladder, but if a review ROUND 2 or the synergy hunt
  wants testimony older than the automated archive, ask for them.
- Historical-context note: the earliest archive versions (v194+) are bug-era noise —
  weight recent versions as current science, mine early ones for what-was-fixed.

## After rung 3

Rung 4 (redox/sulfide vetoes — the dominant mechanism, most coupled; §T's orphaned-Zn
finding is an input to its census) → rung 5 (halite/salinity, maybe its own proposal)
→ then regenerate the claim cards (`tools/review-claim-card.mjs --all`) and open the
synergy hunt the boss deliberately deferred.

*Twentieth hand's handoff, 2026-07-14. The keystone lineage entry for this stretch is
in HANDOFF-FOUNDATIONS-2026-07-03.md ("the unread envelope").*
