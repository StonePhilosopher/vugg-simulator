# HANDOFF — pK(T) correction + fix-backlog sweep (2026-06-12, SIM 190→192)

The LEDGER lives elsewhere — BACKLOG's ⚗️ and 🔧 banners (commits,
numbers, per-item stories) and the v191/v192 blocks in js/15. This doc
is the part the boss asked for directly: **thoughts, ideas, and advice
for the next builder.** Eight things tonight taught or re-taught, in
the order they'll save you time.

## 1. Predict blast radius by consumer STRUCTURE, not constant size

The pK slopes were 5–10× wrong and the fleet barely moved — because
the biggest consumer (effectiveCO3, all 13 carbonate σ-gates) is a
RATIO of the same quantity at two pH values at the SAME temperature.
K₂ cancels in the mid-pH regime. The damage hid in the consumers that
DON'T cancel: the undamped SI engines (carbonateIonPpm) and the
hot+alkaline corner where the ratio's cancellation breaks (jeffrey,
×131 worst). Before correcting any constant, census its consumers and
sort them into "self-normalizing" vs "raw" — the dark-observe columns
write themselves from that sort, and the rebake prediction stops being
a guess. tools/pk-t-observe.mjs is the reusable template: a --table
mode that pins the science against literature, a --fleet mode that
shadows the correction against the live engine before anything flips.

## 2. Mixed-fidelity seams: when you sharpen one term, audit its partner

SI = log IAP − log Ksp. Tonight made IAP's speciation exact while
Ksp(T) stayed constant-ΔH van't Hoff (~1.3 log too flat at 158 °C vs
PHREEQC's analytic). Result: the cooling scenario's SI drift flipped
SIGN — each term defensible, the seam between them wrong. The lesson
is NOT "don't ship half a correction" (waiting for both sides is how
debt calcifies). It's: when a correction lands on one side of a
balance, measure the seam, pin it honestly (bounded-drift, with the
mechanism in the test comment), and log the partner as the next arc.
The **carbonate Ksp(T) analytic upgrade** is that arc — it should
clone the pk-t-observe pattern, and when it lands, restore the
retrograde-direction pin in carbonate-week5-validation.

## 3. Re-pins are verdicts, not concessions — one each

Four test failures, four DIFFERENT verdicts: marble aragonite =
RETIREMENT (pin inverted to assert absence — the correction removed an
artifact); elmwood = RECALIBRATION (the pulse train was authored in
the old constants' units; the locality claim is the fixed point, so
the knobs move); sunnyside pyrite = TOLERANCE (0.4% cascade sliver;
"Navajún glass" is dominance, not purity); cooling SI = BOUNDED SEAM
(see §2). The blanket move — "regenerate baselines, update pins" —
would have been faster and would have buried the Ksp discovery and the
phantom find (§4). Per-pin verdicts with the reasoning in the test
comment ARE the product; the green suite is a side effect.

## 4. When a correction perturbs a verified claim, look for the RICHER claim before reverting

The corrected early-σ trajectory put a small stepped CORE inside mvt's
boss-verified glassy dogtooth. First instinct: regression, retune it
away. Geology said otherwise: a stepped core under glassy faces is the
PHANTOM — and phantom calcite is a Tri-State collector signature more
specific than "glassy spar." The correction didn't break the claim, it
upgraded it. New pin: relief ≤15%, early-confined, smooth finish
mandatory. Generalization: when corrected physics disturbs a verified
locality claim, check whether the disturbance matches a sharper fact
about the same locality before tuning it back out. (Boss's eye should
still verify the phantom read — it's on the claims-table now.)

## 5. Corrections that REMOVE things are usually the most right

"Species lost: 6, gained: 0" looks like damage in a diff. It was the
best news in the rebake: hot-scenario aragonite (150–700 °C!) was
always a speciation-flattening artifact, and fleet coverage IMPROVED
(135 live / 34 dead). Don't let loss-aversion in the diff reviewer
override the geology. Corollary from the same sweep: most of the other
"losses" were 1-crystal marginals re-rolling — baseline-diff's species
columns separate the two kinds at a glance.

## 6. Judges rot at the GATE, not just the work

elmwood's judge said "stepped headline 0/8" — on a feature the boss
accepted. The gate demanded share >0.4 while the SHIPPED claim was
~18% rim; the gate had never matched its own contract. When a judge
contradicts something you believe works, suspect the gate with the
same energy you suspect the work (13th-catch family: the checkers that
ignored paramorph lineages). A judge's gate is a claim too — keep it
pinned to the recorded claim, not to round numbers.

## 7. The restore ladder (the night's confession, now memory)

A PS 5.1 `Get-Content -Raw` round-trip double-encoded scenarios.json5
(757-line diff for a 5-line edit — diff INFLATION is the detector).
Restore, never hand-repair: `git checkout HEAD -- <file>` →
parent-sha → `git checkout origin/main -- <file>` (GitHub is the
off-machine backup; in an auto-push repo it's never stale). Data files
get dedicated tools or Node scripts only — no PowerShell round-trips,
ever. (Memory: feedback_file_corruption_recovery.)

## 8. What's actually next, ranked

1. **roughten_gill mottramite gate-census** (task open, queued
   deliberately AFTER this arc so it tunes on stable chemistry).
   Probe the Zn≥0.5 / redox·T blockers first; V clears at 12 and is
   TWICE-confirmed touchy — treat V as read-only until the census
   says otherwise. Fresh session recommended; the gate-census pattern
   from the linarite arc (and wittichen-sulfate-probe) is the
   template.
2. **Carbonate Ksp(T) analytic upgrade** (§2) — thermo-carbonates.json
   + 20c, clone pk-t-observe, restore the retrograde pin. Composes
   with the open dolomite/siderite ΔH items in the thermo memory.
3. **Quartz arc** — unchanged from the morphology handoff; hiatus
   census first.
4. **Boss verification additions** from tonight: the mvt phantom-core
   read (§4), wittichen barite gangue, the dendrite trees, ⚒ Slams by
   ear.

One closing thought. Tonight's two arcs were the same arc at different
scales: the fix-backlog sweep closed six debts the morphology arc had
named, and the pK(T) correction closed a debt the June-9 review had
named — and each closure NAMED ITS SUCCESSOR (weathering-epilogue
mechanic, Ksp(T) analytic). That's the system working: every arc ends
by writing the next builder's first paragraph. Keep doing that, and no
session ever starts cold.
