# HANDOFF — Caldbeck V-suite + carbonate Ksp(T) analytic (2026-06-12 evening, SIM 192→194)

The LEDGER lives elsewhere — BACKLOG's 🔴 and ⚗️ banners and the
v193/v194 blocks in js/15 (commits `d935b99`, `81b7016`, both
Pages-verified). This doc is the thinking: what these two arcs taught,
in the order it'll save the next builder time. It extends
HANDOFF-PKT-AND-FIX-SWEEP-2026-06-12.md — read that first; this is the
same evening's second shift, and two of its lessons grew sequels here.

## 1. A twice-reverted variable is an ATTRIBUTION, not a fact

The repo carried "V is a TWICE-CONFIRMED touchy axis — treat as
read-only" through three handoffs and a memory note. The censuses
proved the attribution wrong: both reverts (v109, v180) had bumped
INITIAL-broth V, which re-rolls the shared RNG under the steps-0-25
primary suite. The identical change placed at the step-70 oxidation
event was inert to the primaries and delivered the target. The failure
was real; the recorded CAUSE was wrong — the variable took the blame
for its timing.

Generalization: revert history records symptoms. When a lesson says
"don't touch X," ask what was actually varied — usually X changed in
only ONE way (one magnitude, one phase, one site). Census WHERE in the
run the intervention lands before accepting the variable is forbidden.
(Memory: feedback_timing_not_variable. Sibling of the richer-claim
move — both are "the obvious read of a failure misidentifies what
failed.")

## 2. Cloned engines inherit the parent's GATE OMISSIONS — and the omission hides for years

Vanadinite (Pb5(VO4)3Cl, a V⁵⁺ vanadate) had NO redox gate since v17 —
its σ formula was cloned from pyromorphite (PO4: P is always +5, no
gate needed) and the vanadate redox requirement never came along. Its
descloizite-group siblings all carry O2_min 0.5. Result: vanadinite
nucleated in reducing fluid for ~175 sim-versions, unnoticed because
its tenants are oxidizing scenarios where the missing gate rarely
mattered — until roughten_gill's reducing-then-oxidizing trajectory
exposed it (6 crystals at O2 0.20).

This is the token-wart family at the chemistry layer (pyritohedral AND
octahedral_REE both hex-prismed; v92's As-state split was the same
shape for arsenates). When you find one cloned-formula omission, GREP
FOR SIBLINGS: candidate sweep = every supersaturation_* whose formula
class implies a redox-sensitive species (vanadates, arsenates,
uranyl-phases, Fe³⁺/Mn³⁺/Ce⁴⁺ phases) but whose gate list has no
redox check. Nobody has done that sweep systematically — it's a cheap
census tool away.

## 3. "Match the other term's clamp" is only right when both fits are VALID there

The v194 plan said: clamp the analytic Ksp to [0,250] °C "matching the
pK side so IAP and Ksp share a T-domain" — a direct application of the
previous handoff's mixed-fidelity-seam lesson. It was WRONG, and the
first rebake said so loudly: the PB82 calcite/aragonite -analytical
are ~90 °C SOLUBILITY FITS, and extrapolating their curvature to 250 °C
piled +3.4 SI onto gates calibrated against the old flat curve —
sunnyside calcite doubled, mvt lost its silver suite, and the hot
aragonite v192 correctly retired came back from the dead.

The refined principle: a shared domain closes a seam only where BOTH
terms are valid. Two fits with different validity ranges each get
clamped to their OWN range; the seam between 90 and 250 °C isn't
closable by extrapolation, only by better data (llnl/SUPCRT high-T
coefficients) plus gate re-calibration. Lesson 2 of the previous
handoff has this twin now — cite both together.

## 4. The runaway rebake was the MEASUREMENT, not the mistake

Nothing about the [0,250] attempt was wasted: the dark-observe
predicted the shift magnitudes, but only the rebake LOCATED the
boundary (which gates break, which species reanimate, which scenarios
double). Doing the wrong-clamp rebake first, reading it as an
experiment, restoring, and re-shipping at clamp-90 took ~20 minutes
and produced the exact sentence the BACKLOG sliver needed ("hot-band
promotion requires gate re-calibration + aragonite metastability
hardening"). Budget for one throwaway rebake in any correction whose
consumers are gate-calibrated; it's the cheapest way to scope the
follow-up arc.

## 5. Bump SIM_VERSION BEFORE gen-baseline (a footgun that bit tonight)

gen-js-baseline.mjs names its output from the CURRENT SIM_VERSION. I
ran it with the v194 engine built but SIM_VERSION still 193 — it
silently OVERWROTE the real seed42_v193.json with analytic output.
Caught immediately (baseline-diff exploded), restored via
`git checkout HEAD -- tests-js/baselines/seed42_v193.json` (the
restore ladder, rung 1, second use tonight). Order is: bump version →
build → gen-baseline → diff. TOOL IDEA for some session: gen-js-baseline
could refuse to overwrite an existing baseline whose file already
exists unless --force — one `fs.existsSync` guard would have made this
mistake impossible.

## 6. The pK instrument pattern is now a proven TEMPLATE — third use is free

pk-t-observe.mjs (v192) → roughten-gill-mottramite-probe.mjs (v193) →
ksp-t-observe.mjs (v194): same skeleton three times — a --table mode
that pins the science against literature/database anchors, a
--fleet/--census mode that shadows the correction against the live
engine before anything flips. Each took minutes to write because the
previous one existed. Next corrections (dolomite/siderite ΔH, the
hot-band promotion, any engine-constant fix) should clone the skeleton
without deliberation. The instrument IS the method now.

## 7. What's actually next, ranked

1. **Hot-band carbonate Ksp(T) promotion** (the v194 sliver): activate
   the analytic >90 °C. Needs (a) high-T Ksp coefficients (llnl.dat /
   SUPCRT — do NOT extrapolate PB82), (b) calcite + aragonite gate
   re-calibration against the new hot SI scale, (c) aragonite
   metastability HARDENING (a hard T-gate so raw SI can't reanimate
   the hot polymorph), (d) THEN restore the cooling directional
   retrograde pin in carbonate-week5-validation. The throwaway-rebake
   diff (in this session's transcript + the v194 version block) is the
   scoping document: sunnyside/mvt/jeffrey/marble/pulse are the gates
   that break first.
2. **Redox-gate omission sweep** (lesson 2): census every σ engine
   whose species class implies redox sensitivity but whose gates carry
   no redox check. Cheap tool, possibly several real catches.
3. **Quartz arc** — unchanged from the morphology handoff; hiatus
   census first.
4. **Weathering-epilogue mechanic** — erythrite (wittichen) is the
   first client; roughten_gill's post-mining dump minerals would be a
   second.
5. **Boss verification lane** (eyes + ears, all live on Pages now):
   the mvt phantom core, wittichen barite, dendrite trees, ⚒ Slams by
   ear — PLUS new from tonight: roughten_gill mottramite (dark
   brown-buff rice-grain microcrystals appearing in the supergene
   window, step ~70+) and the Tsumeb mottramite. Hard-refresh first.

One closing observation, same shape as the last handoff's but sharper:
both of tonight's arcs corrected the RECORD as much as the code. The
"touchy V axis" was a wrong cause attribution that survived three
handoffs; the "vanadinite wrong for Caldbeck" note was half-wrong
(Kingsbury & Hartley 1956 document it in the district); the
"match-the-clamp" plan came straight from the previous handoff's own
lesson applied one domain too far. The cathedral's documents are
load-bearing, which means their ERRORS are load-bearing too. The
gate-census discipline — measure before believing, even when the
belief is in our own handwriting — is what keeps the archive honest.
