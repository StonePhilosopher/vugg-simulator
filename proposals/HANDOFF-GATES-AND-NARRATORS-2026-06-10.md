# HANDOFF — two gates, fifteen truths, and the fourteenth catch (2026-06-10, second session)

To the next builder: I started this day with a queue I had written myself the
night before, and the day's deepest lesson is that even your own queue
deserves re-verification. I cleared two infrastructure gates, corrected
fifteen things the game teaches, caught myself twice, collided once with a
sibling session, and discovered that the project I thought I was unblocking
had already shipped and been accepted by ear a week ago. The suite is green
(1787/1787, 114 files), SIM_VERSION is still 180 — every change today was
SIM-neutral, by measurement or by construction — and everything is deployed
to Pages at `0c65e4b`.

**Read first if cold:** `HANDOFF-REVIEW-REBAKE-MUSIC-2026-06-10.md` (the
prior session — review, rebake, soundtrack, Parts I+II), then this. For
Movements work, `HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md` is the master
doc and it is FAR more current than its filename suggests — see lesson 4.

## The commit ledger

| commit | what |
|---|---|
| `8040ff2` | fix(redox): ehFromO2/o2FromEh saturation slopes aligned (1000 mV/decade both ways) — the Movements oxidizing-gate, SIM-neutral, measured by the new `tools/redox-anchor-probe.mjs` |
| `1cd639a` | the ring_fluids retirement (review §1.4) — CONTENT is mine, TITLE is another session's ("crossfade + loudness normalization"); see lesson 5 |
| `4079dca` | annotation commit carrying `1cd639a`'s true field notes |
| `0c65e4b` | fix(narrators+spec): the §2.4 one-liner afternoon — 15 mineralogical corrections |

## What shipped, in substance

**1. The redox round-trip is exact (`8040ff2`).** Above the top anchor
(O2=5 ppm / Eh=+500 mV) the two halves of the bijection saturated at
different slopes — each author had picked "gentle" in their own output space
(100 mV/decade in Eh terms forward, 1000 in O2 terms back). An Eh-canonical
movement writing +800 mV snapped to +530 the step its window closed. Now
both saturate at 1000 mV/decade: exact inverses over the whole representable
domain (Eh ≥ −620 mV — the 1e-6 ppm log floor, documented not fixed; it's
beyond water stability at pH 7). 1000 won over 100 because the inverse keeps
synthetic O2 inside the physical dissolved-oxygen ceiling (+900 mV → 12.6
ppm) instead of handing uncapped ratio engine sites thousands of ppm.
SIM-neutral was MEASURED: fleet max O2 is exactly 5.000 (the dripstone caves
sit AT the anchor, never over). **Oxidizing movements (>+500 mV) are now
safe**; the shipped reducing mvt movement never touched the broken branch.

**2. ring_fluids is retired as a chemistry store (`1cd639a`).** The review's
§1.4 retire-or-restore decision, resolved per the boss's standing v157
direction ("mesh.cells is the way to go"). The non-equator slots froze at
the initial broth when v159 re-pointed event propagation at the voxel grid;
their one live consumer — the replay snapshot the helicoid replay chips read
— faithfully displayed day-zero chemistry on 15 of 16 rings for ~20
versions (the replay-mode sibling of the v157 pyramid artifact). Final
design: `_ringFluidMeans` (85c) computes the per-ring cell-mean projection
AT SNAPSHOT CAPTURE directly into `snap.ring_fluids`; the live store is
untouched, so the sim path is byte-identical BY CONSTRUCTION. The equator
alias (`ring_fluids[equator] === conditions.fluid` — load-bearing, the
Tranche-6 borax lesson) and `concentration` (vadose-owned) are deliberately
untouched, each pinned by its own test.

**3. Fifteen §2.4 corrections (`0c65e4b`).** Narrator md + js fallbacks
fixed in pairs, plus Library descriptions and spec strings. Highlights:
wurtzite's 95°C "phase boundary" replaced with the metastability truth
(equilibrium inversion ~1020°C; 95°C stays as the declared SIM GATE), flos
ferri de-ironed (pure aragonite named for the Eisenerz siderite MINES), the
Statue of Liberty patina re-assigned from malachite to brochantite +
antlerite, hiddenite returned to Alexander Co. NC, Volodarsk returned to
Ukraine, the pyritohedron made crystallographic again ({210}, class m3̄,
pseudo-fivefold), wulfenite freed from requiring discrete molybdenite (Red
Cloud and Mežica have none — Mo is a trace passenger in galena/wallrock),
selenite dehydration routed via bassanite, witherite's 811°C re-labeled as
the polymorphic transition (decarbonation ~1300°C), meta-autunite 8→6 H₂O,
aragonite dry inversion 520→450°C, naica internally consistent at ~58°C,
ACTIVITY_DAMPING comment drift trued (shipping value is 0.25).

**Deferred from §2.4, engine-coupled (do NOT fold into a text pass):**
- calcite's `flos-ferri_acicular` habit_variants ENTRY — `selectHabitVariant`
  (07) weighted-randoms from that list on the SHARED rng; removing the entry
  shifts every scenario's cascade (fleet rebake). The text is fixed
  everywhere; the entry waits for a calibration-aware arc.
- the aragonite-vs-calcite Mg/Ca gate (literature molar ~2 vs shipping
  ppm-mass 4) — changes polymorph selection by definition.

## The lessons (continuing the prior handoff's twelve)

**13 (carried, applied today).** Diagnoses rot with the architecture under
them — and so do COMMENTS. Three load-bearing comments lied today: 20c's
header claimed "exact inverses for O2 ∈ [0.05,5]" while the divergence was
live; 85c claimed a clamp "in 4c.2" that was never added;
`_propagateGlobalDelta`'s header promised a per-ring loop v159 deleted.
Every fix trued its comments in the same commit.

**14 — THE FOURTEENTH CATCH (CATCHES.md, two faces).** (a) A change can be
perfectly behavior-neutral and still break the suite: the first ring_fluids
cut synced the live store every step — probe-exact, seed-42-identical — and
timed out four 32-seed integration tests at 1.32 ms/call (~12% of a step)
under ~3× parallel-load inflation. **Time budgets are part of the contract;
an observer that costs 12% of a step is not an observer.** (b) The four reds
were mineral-firing tests and the obvious theory ("fallback readers saw
changed chemistry") was WRONG on two independent measurements: the census
probe found 0 engine-fallback hits in 8,966+ crystal-step reads, and the
failure text said `Test timed out`, not `AssertionError`. **Read the failure
text before theorizing the failure mode** — trusting the first theory would
have spawned a phantom calibration arc. Structural fix rode along:
roughten-gill + stale-retunes timeouts 90→150s (pharmacolite's v160
precedent; they pass in isolation with 34s headroom).

**15. Memory INDEX lines rot faster than memory bodies.** I spent the start
of an arc preparing to build "Movements Phase 1" because my MEMORY.md index
line said "Phase 0 dark scaffold shipped" — while the memory's own body
(and the master doc) recorded the mvt pilot SHIPPED at v169, accepted by
ear, supergene at v170, and Phase 2 complete through v174. The index is a
hook, not a summary; when a project moves fast, the hook fossilizes. Both
layers are now trued, and the index line itself now says "read the body,
not this line."

**16. Concurrent sessions are real and share your temp directory.** A
sibling session (sonifier renderer work) overwrote `$env:TEMP\commitmsg.tmp`
between my write and my `git commit -F` — `1cd639a` went out wearing their
title on my content, auto-pushed before the mismatch was visible. History
rewrite on pushed main is (correctly) gated, so the record was corrected by
annotation commit (`4079dca`) instead. Standing rules now in memory: unique
per-commit temp filenames + verify `git log -1 --format=%s` BEFORE pushing.
If you see a commit whose title doesn't match its diff, check for this
failure mode before assuming worse.

**17. "Each author picked gentle in their own output space" is a bug
pattern.** The ehFromO2/o2FromEh asymmetry existed because a forward map and
its inverse were written with independent intuitions about what "saturate
gently" means. When you write paired transforms, derive one from the other —
never write both from prose.

**18. Engine-coupled text is a category.** Fifteen §2.4 rows were safe
because `thermal_decomp_C`/`formula`/descriptions are display-only — but
`habit_variants` is an RNG-draw LIST, where even a deletion is a cascade
shift. Before editing any minerals.json field, grep for its consumers; the
fan-out agent verdict ("display-only vs engine-consumed") took minutes and
prevented an accidental fleet rebake.

## The state of the world (end of 2026-06-10)

- **SIM_VERSION 180**, suite 1787/1787 (114 files), Pages live at `0c65e4b`.
- Coverage: live 134 / stale 2 (both deliberate arcs: jeffrey magnetite =
  engine-level low-O2 design; roughten_gill mottramite = own gate-census arc,
  V axis twice-confirmed touchy) / dead 35.
- **Movements truth** (verify against the master doc, not memory hooks):
  temporal pH/Eh feature COMPLETE at its clean set (mvt v169 accepted by
  ear, supergene v170); Phase 2 fluid-spots COMPLETE 2a–2d (v171–174,
  gem_pegmatite showpiece); the oxidizing-Eh gate cleared TODAY.
- Standing instruments added today: `tools/redox-anchor-probe.mjs`
  (round-trip audit + --fleet ceiling sweep), `tools/ring-fluid-view-probe.mjs`
  (three-invariant contract: store FROZEN / projection LIVE / alias INTACT),
  `tools/cell-resolution-census.mjs` (does the engine fallback ever fire?).
- CATCHES.md holds FOURTEEN catches.

## Next steps, in order

1. **T-RECONCILIATION sub-project — the biggest lever in the game.**
   Subsume `ambient_cooling` (an ad-hoc every-step T movement on the SHARED
   rng: cooling drift + stochastic thermal-pulse re-warm) into declarative
   TREND+PULSE on the dedicated movement stream → unlocks ~8 T-blocked
   scenarios (cooling, naica, marble, both pegmatites, porphyry, epithermal,
   deccan). Pieces already in place: v179's `wall.cooling_rate` made the
   drift declarative + RNG-neutral; `wall.thermal_pulses:false` made pulses
   opt-out-able; the movement stream exists. This is a FULL-FLEET REBAKE
   (moving draws off the shared rng shifts every cascade) — give it a fresh
   session, probe-first (movement-dark-observe pattern), and remember the
   sensitive-dependence warning: OU-on-T diverged chaotically in the dark
   observation; reconcile the mechanic before adding texture.
2. **Event-subsumption** (bisbee/schneeberg redox events → movements) — the
   second Movements unlock; per-scenario refactors.
3. **Carbonate pK(T) slopes** (review §2.2) — calibration-coupled,
   ~5-10× too flat in 20b.
4. **Steam WP1** (review §3 T1): collection export/import + the 16
   prompt()/alert() sites — the wrapper blockers.
5. **Strip hygiene trio** (review §1.6): cells_per_ring manifest, IDB leak,
   pH clamp.
6. **The five unvouched twin-law citations** (review §2.5) — literature pass.
7. **Deferred engine-coupled pair from §2.4** (above) when a calibration arc
   is open anyway.
8. Re-survey roughten_gill's "baseline-debt" gating in the Movements
   coverage map — v180 grew linarite+leadhillite and the 13th catch fixed
   the accounting; the 2026-06-02 survey's "8 expects missing" is stale.

**The full backlog:** `proposals/BACKLOG.md` (banner-current through today)
+ the Movements master doc's Part II. Boss-lane items outstanding: 2c.2b
clustering strength/scope (boss's eye on Pages), supergene pH-front
listen-acceptance, Syntaxswine→StonePhilosopher promotion cadence.

## Operational notes

- Run `npm run ci` COLD at session start (10th catch) — and note the shell's
  working directory resets to the AI root after context compaction; the
  first "failure" today was npm running in the wrong folder.
- Pages stuck in "building" twice today; `gh api -X POST
  repos/Syntaxswine/vugg-simulator/pages/builds` un-sticks it. Treat as a
  known channel quirk: always verify status==built AND commit==HEAD.
- A sibling session may be active on this repo (sonifier renderer work was
  in flight today). Fetch before pushing; expect their commits on main.

## Diagenesis credit

The redox fix was one branch slope because 4c.1–4c.3a built the sync
architecture; the fleet ceiling was a 40-line measurement because
`_harness.mjs` exists; the ring_fluids decision was easy because v157's
vestigial-status note had already mapped the three options and the Tranche-6
borax catch had documented exactly which alias was load-bearing; the
narrator afternoon was transcription because the review had done the
research two days prior; and the 14th catch was caught in an hour because
the suite's time budgets and the 12th catch's measure-before-narrating
discipline were both already in the walls. I lived in rooms other builders
made, and the three probes I leave are doors into rooms I won't see used.

The truth is told in time. Build well.
