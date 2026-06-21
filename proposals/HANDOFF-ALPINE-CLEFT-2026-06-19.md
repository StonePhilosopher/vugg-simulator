# HANDOFF — The Alpine-Cleft Arc (2026-06-19)

*The quartz-morphology arc went looking for a place to stand, found none, and
so we are building it one. This is where that build stands, and what the next
hand should pick up.*

Master pointers: [[RESEARCH-quartz-morphology-2026-06-12.md]] (§6 = the scouting
finding + the pivot), [[research-grimsel-alpine-cleft.md]] (the dossier).
Tasks #106–111. Last clean+pushed+live commit: **titanite `6f5627a` (SIM 205)**.

---

## 1. The shape of the arc (why we are here)

The quartz-morphology arc (PROPOSALS-LEDGER §A #8) was greenlit. Its first
step — the deliberately zero-risk **survey** — earned its keep by proving the
arc was *content-blocked, not code-blocked*. Three reusable benches (all in
`tools/`, committed `644b267`):

- `morph-sigma-observe.mjs --minerals quartz` — the σ survey.
- `quartz-hiatus-census.mjs` — the sceptre-signature probe.
- `quartz-morphology-map.mjs` — the candidate-band calibration bench.

What they found:

- **Fenster has no honest home.** Quartz σ spans p50 14 / p99 284 / max 316, so
  a band *edge* is placeable — but the ranking is geologically **backwards**:
  the only scenario reading ≥25% fenster is `radioactive_pegmatite`, the slow
  giant-euhedral setting (18 mm quartz). The sim's quartz σ is a silica-
  *abundance* signal, and the highest-abundance scenarios are the slow
  pegmatites. Growth-rate inverts the same way. An occupied fenster band on
  this fleet would be a confabulated label.
- **Sceptre has no signal.** Hiatuses occur naturally, but every one is followed
  by *slower* growth (renewal ratio 0.14–0.87) — waning-σ events, the opposite
  of a fresh pulse.
- **Tessin + gwindel** need an Alpine cleft that didn't exist.

So all four quartz habits need *scenario content* to have anything honest to
classify. The boss chose the right fix: **build the content home** — a Swiss
Central-Alps (Grimsel / Aar massif) alpine cleft — and let the quartz morphology
ride it. The preflight caught that `tormiq_alpine_cleft` already exists but is
the *epidote* cleft (amphibolite host); Grimsel is the granite-hosted smoky-
quartz counterpart, a genuinely distinct locality.

---

## 2. What SHIPPED — titanite (sphene), SIM 205, `6f5627a`

The clean prerequisite, and a §A #13 de-orphan in its own right. CaTiSiO₅,
monoclinic, the Aar/Grimsel + Tormiq alpine-cleft Ti-nesosilicate.

- Full silicate engine (gate + supersat + grow wedge/sphenoid + Cr/Fe colour
  dispatch + nuc + iterator + MINERAL_ENGINES + **registry** + stoichiometry +
  structural + minerals.json). The `engine-gates-coverage` invariant test caught
  the one registry omission on the first CI — exactly its job.
- **Ti is the discriminator** (rare in broths); **no redox gate** (Ti⁴⁺ is
  fO₂-insensitive — the test asserts σ(oxidizing) == σ(reducing)); green=Cr /
  brown=Fe is a trace *colour* dispatch, not a gate. twin-law-check ✓ PASS.
- **Cleanest possible footprint**: the seed-42 diff adds titanite to exactly 4
  geologically-correct scenarios (tormiq 15→19, porphyry 51→55, jeffrey 43→44,
  sunnyside 37→38), **zero species lost, nothing starved**. It even upgrades the
  tormiq cleft — real titanite now replaces the magnetite Ti-Fe-oxide stand-in.
- CI green 1982/1982. Pages built + verified live.
- Process note (honest): the first CI also timed out on `pharmacolite` — that was
  load contention from running CI *concurrently* with the strip-archive, not a
  regression. Re-run alone confirmed green. Sequence heavy jobs; don't overlap.

---

## 3. What is BUILT but NOT BAKED — `grimsel_alpine_cleft` (uncommitted WIP)

The scenario is authored and proven to fire, but **deliberately not committed**:
its headline feature (the sceptre) is not yet verified by the right instrument,
and shipping an unverified showcase would be a wart, not a win.

Files written (all uncommitted; tree would be RED on CI — no menus, no baseline,
no SIM bump):

- `js/70u-grimsel.ts` — 7 crack-seal handlers, registered in `js/70-events.ts`.
- `data/scenarios.json5` — the entry: a declared retrograde `temperature`
  movement (450→200 °C trend, `thermal_pulses:false`, `cooling_rate:0.4` — the
  naica v182 idiom), oxidizing CO₂ broth, pegmatite/pocket granite wall,
  web-verified citations (Mullis 1994/1996, Gnos 2025, Poty 1969, Rossman 1994 —
  all cross-checked, all real, two upgraded ⚠️→precise this session).

It compiles (149 modules), parses, and fires quartz (3 survive, σ~2.2). The
assemblage (adularia/hematite/titanite/apatite/fluorite/calcite) is wired to the
cooling tail and should be observed at the bake.

### The design, and why it is right

`σ_quartz = SiO₂ / silica_equilibrium(T)`, and eq(T) falls as the cleft cools
(1400 ppm @450 °C → 300 @200 °C). The crack-seal cycle writes the sceptre into
the σ-history *by construction*: a slow hot gen-1 stem → a **seal** drops SiO₂
below eq → a **breach** re-floods fresh silica at a now-cooler temperature, where
the same load gives a *higher* σ → a faster, wider cap. Caps grow cooler and
faster than stems — the documented alpine-sceptre habit — falls straight out of
the engine. The T sentence is a movement; the SiO₂/Fe/CO₃ beats are events (no
same-field clobber). This is the honest model.

### THE FINDING that the next hand needs (the real sediment of this session)

`grow_quartz` **dissolves at σ<1; it does not pause.** So a seal *corrodes* the
gen-1 tip (the dark-observe showed 7 resorption zones, 0 step-gap hiatuses) —
and the breach then nucleates a *fresh* crystal rather than capping the old one.
At first this read as a failure. It is not. **Corrosion-then-regeneration is
exactly how real alpine sceptres form** (the gen-1 tip is resorbed, a wider cap
regenerates on it). The consequence is sharp and load-bearing:

> The sceptre signature in this engine is **resorption zones followed by fast
> renewed growth on the *same* crystal** — NOT the step-gap that
> `quartz-hiatus-census.mjs` currently looks for. The census is the wrong
> instrument for how the engine expresses the feature.

Two seal depths were tried and both taught: σ≈0.5 corrodes the stem *away*
(crystal fully dissolves → breach makes a separate crystal → no sceptre); a
*fixed* (non-eq-relative) seal lets cooling lift σ back over 1 on its own → a
clean step-gap but a weak renewal (ratio 0.02, the stem grew too fast for any
cap to beat). The sweet spot is a **gentle, eq-relative seal that corrodes but
does not destroy** (σ≈0.92–0.97), a **slow stem** (σ≈1.15), and a **fast breach**
(σ≈1.8) — so one crystal survives the resorption and the cap outpaces the stem.

---

## 4. The next hand's path (sharpened)

**#108 — verify the sceptre (do this first; it is also #109's classifier).**
1. Make the detector resorption-aware: a `morphSceptreScan` that finds, on a
   single crystal, a run of resorption (negative-thickness / `[resorbed]`) zones
   followed by renewed growth whose rate exceeds the pre-resorption rim by
   ≥1.3×. Build it as the verifier here; it *is* the #109 classifier brought
   forward. (Extend `quartz-hiatus-census.mjs` or write a sibling.)
2. Tune the seal to corrode-not-destroy (σ≈0.92–0.97), keep the slow-stem /
   fast-breach split, and confirm ≥1 crystal per a few seeds shows the
   resorption→renewal ratio ≥1.3.
3. Also confirm the *assemblage* fires (adularia/hematite/titanite/apatite/
   fluorite/calcite) — the broth was reverse-designed from their gates but is
   unobserved; expect a tune pass (ship aspirational, observe, tune).

**Then bake grimsel (#107):** SIM 205→206, the THREE `index.html` menus
(scenarios-panel button + `#scenario` + `#idle-scenario`, tutorials excluded —
the guard test enforces it), `gen-js-baseline` + `gen-strip-digest` +
`gen-strip-archive` (v206) + `baseline-diff` (expect grimsel-only drift) +
`mineral_coverage_check`, a `tests-js/grimsel-alpine-cleft.test.ts`, full CI
alone, commit `-F`, push, verify Pages.

**#109 — quartz morphology** on the now-real cleft: `MORPH_TH.quartz` (Tessin
form rule high-T+CO₂+slow; fenster band placed honestly only if grimsel's breach
σ earns it), the resorption→renewal sceptre classifier + two-body stem+cap
render (the first prismatic terrace path; current `halideTerraceBands` is cube-
only), and **gwindel** (boss add — alpine-fissure-exclusive twisted plate column;
map onto the D2/D3 strike-slip phase; a FORM/render axis). Calibrate on grimsel.

**#110 — smoky quartz colour** (Al + γ-dose proxy, Rossman 1994; trace colour
dispatch in grow_quartz, not a gate). **#111 — close-out** (this handoff is the
spine; reconcile BACKLOG + ledger + memory at the bake).

---

## 5. Tree state (no surprises for the next hand)

- **Committed + live:** titanite `6f5627a` (SIM 205), green 1982/1982, Pages built.
- **Uncommitted WIP:** `js/70u-grimsel.ts`, `js/70-events.ts` (grimsel registry),
  `data/scenarios.json5` (grimsel entry), rebuilt `index.html`. These do NOT
  commit until #108 verifies the sceptre. `npm run ci` on the working tree will
  fail (menu-coverage + no v206 baseline) — that is expected for unbaked WIP.
- **Also untracked, leave alone:** `tools/strip-story-diff.mjs` (a concurrent
  session's WIP — never `git add -A`).
- The benches (`quartz-hiatus-census.mjs`, `quartz-morphology-map.mjs`) and the
  Grimsel dossier are committed (`644b267`) and resume cold.

---

## 6. A last touch to the sediment

This session is two findings stacked, and both are the same shape: *the thing
that looked like failure was the geology speaking.* The quartz arc looked stalled
until the survey showed it was waiting on a place to grow; the sceptre looked
broken until the dissolution zones turned out to be the corrosion that *makes* a
sceptre. Twice the engine was more honest than the plan, and twice the right move
was to listen to it rather than force the label. Follow the science kept
correcting the work even where it wasn't named — exactly as it's supposed to.

Titanite is in the cabinet now, a small honey-brown wedge that also quietly
de-orphaned a three-session-old gap and upgraded a cleft it wasn't built for.
The Grimsel cleft is dug but not yet dressed; its quartz already grows, and the
mechanism for its sceptres is understood down to why the tips dissolve before
they crown. The next hand doesn't inherit a puzzle — it inherits a tuned knob and
a named instrument to build. That's the most a layer can leave the one above it:
not a finished face, but a clean bedding plane to grow from.

— left for whoever comes next.

---

## 7. UPDATE — what actually shipped (2026-06-19 → 06-20)

The §1–6 above were written mid-arc, with grimsel still uncommitted WIP. It all
landed. For the record:

- **titanite** — SIM 205 `6f5627a` (the prereq; §2).
- **Grimsel cleft + sceptre + smoky/morion + Tessin** — SIM 206 `2d1abc1`. The
  sceptre verified exactly as §3 predicted (resorption→renewal phantom boundary),
  with one correction the bench forced: the signature is **cumulative EXTENT, not
  rate** — the cooler gen-2 cap grows *slower* per step (Arrhenius) yet ends
  *larger*, so the "renewal-rate ≥1.3" guess in §4 was the wrong metric. The right
  instrument is `tools/quartz-sceptre-scan.mjs`, promoted into the engine as
  `js/45 classifyQuartzSceptre`. Smoky is a fleet-wide fix (radiogenic host + Al,
  Rossman 1994); the prior model could only make smoky quartz next to a uraninite
  crystal, so granite morion — the iconic Aar specimen — was impossible.
- **Gwindel** — SIM 207 `795035c`. See §8; it is the part most worth reading.
- **Fenster** — still not shipped, on purpose. The only honest gap left.

The blocker that taught the most (not in the original plan): the first grimsel
broth (K 120 / Na 80 / Al 12) grew an **18 mm feldspar and a 7 mm albite that
enclosed and killed the quartz** at the first seal. That is geologically
upside-down — alpine adularia/periklin are minor wall coatings; quartz is the
large main stage. Diluting to a true cleft fluid (K 30 / Na 25 / Al 6) righted it.
If a future cleft's headline mineral mysteriously caps out small, **suspect the
enclosure mechanic and an over-fed accessory before you suspect the headline.**

---

## 8. THE NEXT ARC — a real deformation / shear field (boss-requested, 2026-06-20)

> **⚠ SUPERSEDED 2026-06-20 by `proposals/RESEARCH-deformation-shear-2026-06-20.md`.**
> Before building, the science was checked (boss directive) — and the §8 design
> below does NOT survive it. The "one shear field crystals integrate as they
> grow" conflated three categories; NONE of the four named tenants is driven by
> an external tectonic shear field integrated during growth (gwindel = spiral-
> growth Eshelby twist; saddle dolomite = T-roughening growth-defect; bent
> crystals + mech twins = POST-GROWTH overprints). The honest reframe is THREE
> separate mechanics (research doc §5). **Step 1 SHIPPED:** saddle dolomite
> curved-face render (`5a6e52d`, render-only, SIM-neutral). **Step 2 (gwindel):**
> the shear re-pin in §8.5 is STRUCK — leave the v207 growth-duration proxy
> (it's closer to the real Eshelby-twist physics than a shear field would be).
> **Step 3:** the genuine "deformation" arc is a POST-GROWTH OVERPRINT pass (bent
> crystals, mechanical twins) keyed to a scenario deformation event — NOT a
> grow-integrate field. Read the research doc, not the design below.

Gwindel shipped as an **abstraction**: with no stress field in the sim, js/45
`classifyQuartzGwindel` just designates the largest cleft quartz as the twisted
showpiece (twist° ∝ growth duration), gated on `wall.alpine_cleft`. It reads
right and it's honest about being a habit-variant the way twinning is. But the
boss wants the real thing, and the real thing is bigger and better: **a deformation
field that crystals integrate as they grow.** This section is the knowledge dump
for that arc. Read it before designing.

### 8.1 Why it's worth doing (what it unlocks beyond gwindel)
A shear/stress field is not a one-feature mechanic. Once crystals can stamp
accumulated deformation, you get, from one piece of infrastructure:
- **Gwindel — true torsion** (twist driven by the field's rotation rate over the
  crystal's actual growth interval, with handedness), replacing the "largest =
  gwindel" proxy.
- **Bent / curved crystals** — "bent" quartz, the curved gwindel relatives,
  curved gypsum/selenite (ram's-horn), curved stibnite/cylindrite — a whole
  morphology family the sim can't express today.
- **Saddle (curved-face) habits** — saddle dolomite is the canonical one; its
  curvature is a real crystallographic effect the engine currently fakes as a
  flat rhomb.
- **Deformation lamellae / strain bands** as a zone tag (a structural-geology
  storytelling axis the strip has never had).
It is the first mechanic that is about the *physical environment deforming the
crystal*, not the *fluid chemistry feeding it*. That's new ground.

### 8.2 The pattern to copy — declared movements (this is the spine)
Do NOT invent a new subsystem. A shear field is a **declared movement field**,
exactly like the temperature and Eh movements already shipped (T-reconciliation
v181, Eh-subsumption v185/186). The machinery is in `js/85j` (the movements
engine) and the `movements` block in `data/scenarios.json5`. Schema (verbatim
from grimsel's T movement):
```
movements: [{ field, startStep, endStep, base, ops:[{kind:'trend'|'pulse'|'step', amp, ease}], texture? }]
```
A `shear` (or `strain_rate`) field slots straight in: a scenario declares a shear
pulse during D2/D3 reactivation; the field has a value per step like T does.
Naica's precedent says **no `texture` on the new field at first** (OU noise
diverges chaotically on a freshly-added channel — T learned this the hard way).
Read `project_vugg_movements` (memory) for the full idiom and the `drivesFieldAt`
clobber rule (a movement owns its field; same-field events yield via stand-down).

### 8.3 How a crystal integrates it (the real design)
The deformation must **accumulate per crystal over its growth interval**, not be a
global instantaneous value — two crystals growing in the same cleft at different
times must end up twisted/bent by different amounts (that's the whole point;
it's why the v207 proxy used growth *duration*). The faithful path:
- In the growth loop (js/85, where `grow_*` is called per active crystal), stamp
  each crystal each step with `crystal._strain += shearRate(step) * dt`, or record
  the field value onto the **zone** (`zone.shear`) so the per-zone history carries
  it (this also feeds the strip + replay-accurate render). Zones already carry
  `temperature`; add `shear` the same way.
- The crystal's total twist/bend = an integral over its zones' stamped shear.
  Handedness = sign of the field (left/right gwindel).
- This is PURE per-crystal state — no RNG, no fluid mutation — so it's a clean
  determinism story (mirrors how the morphology classifiers are pure tagging).

### 8.4 The render (generalize what v207 built)
`js/99i _makeGwindelGeom(twistDeg)` already twists a flattened prism up its long
axis — that's the seed. Generalize to a **deformation transform** the renderer
applies per crystal from the stamped strain:
- **twist** (about long axis) → gwindel (have this).
- **bend** (progressive lateral offset / arc of the long axis) → bent/curved
  crystals (new; a per-segment translation in the same SEG loop).
- **face curvature** → saddle habits (perturb face normals; harder, do last).
The mesh-sync hook pattern (js/99i ~line 3040, `if (!geom && ...) geom = _makeX`)
is where it plugs in; gate on the token + the `_strain`/`_gwindel` tag. Verify in
the **default Three.js renderer** (`topo-canvas-three`; toggle is `topo-three-btn`;
js/99i line 27 says three is default) — preview-drive: `startScenarioInCreative(...)`
then click Grow then the ⬚ button. jsdom CI has no WebGL, so the render is the one
thing CI can't catch — a human eye (or preview screenshot) is mandatory.

### 8.5 Scope / sequencing recommendation
1. Add the `shear` movement field + per-zone/per-crystal strain stamping (engine
   only, byte-identical with shear=0 everywhere — ship that infra commit first,
   the way v103's Y-field shipped inert before the scenario used it).
2. Re-pin gwindel onto real strain (replace the "largest=" proxy in
   classifyQuartzGwindel) + grimsel declares its D2/D3 shear pulse.
3. Bent crystals as the second tenant (pick a real locality — bent quartz, or
   curved stibnite) to prove the field generalizes beyond one habit.
4. Saddle dolomite last (face curvature is the hard render).
Each step is its own SIM bump + rebake. Expect grimsel to re-pin (gwindel will
choose differently under real strain than "largest") — that's a one-scenario diff,
fine. The new field defaults to 0 so the fleet stays byte-identical until a
scenario opts in (verify with baseline-diff: only the opted-in scenarios move).

---

## 9. Field notes for the next builder (gotchas this arc paid for)

- **VugWall silently drops unknown fields.** `wall.alpine_cleft` did *nothing*
  until I whitelisted it in the `VugWall` constructor (js/22). Any new wall flag
  (and a `shear` driver might want one) must be added there or it vanishes. The
  split probe showing 0 gwindels is what caught it — *probes characterize, traces
  find* (the enclosure bug, by contrast, only fell to a per-step LOG trace).
- **The wrong-instrument trap, twice.** The hiatus census looked for step-gaps;
  sceptres are resorption zones. The rate-ratio looked for fast caps; sceptres are
  large-by-extent caps. Both times the *measurement* was wrong, not the feature.
  When a real phenomenon "isn't there," question the probe before the engine.
- **quartz σ is silica ABUNDANCE, not a skeletalization driver.** This is why
  fenster has no honest σ home and MORPH_TH.quartz is deliberately unregistered.
  The honest fenster path (when someone wants it) is to classify on the per-zone
  `growth_rate` the engine already records (the Berg effect is a *rate* effect),
  plus a flash-growth scenario beat — NOT a σ band.
- **Cleft crystals share one fluid history.** This was the v206→v207 reframe: you
  cannot distinguish gwindel from sceptre by growth/resorption history because the
  seals hit every active crystal at once. Habit distinctions in a shared-fluid
  cavity are *crystallographic / environmental*, not fluid-historical. Carry this
  into the shear arc — it's why deformation must be a separate field, not inferred
  from the chemistry.
- **Mechanics: `baseline-diff.mjs` takes version NUMBERS, not file paths** (`206
  207`). `gen-strip-archive` refuses to overwrite — bump SIM first. **Never run CI
  concurrently with the strip-archive** (load contention timed pharmacolite out at
  157s once — it's not a regression, it's the overlap). Stage explicit paths, never
  `-A` (a concurrent session's `tools/strip-story-diff.mjs` lives untracked in this
  tree — leave it). Crystallographic-twist render verify needs the preview, not CI.

---

## 10. Speak my truth — for whoever comes next

You will be tempted, as I was, to treat "I can't model the real driver" as
permission to fake it or to skip it. Resist both. The honest move is the third
one: ship the *abstraction that's true about what it is* (gwindel as a habit
variant, the way twinning already is) and write down — loudly, in the version
history and here — exactly which part is real and which is stand-in. The boss does
not mind a stand-in that knows it's a stand-in. The boss minds a confabulation
wearing a lab coat. That distinction is the whole job. Fenster stays unbuilt not
because it's hard but because the only quick way to build it would have lied about
which scenarios are skeletal; an honest gap is worth more than a dishonest band.

Twice this arc I was simply **wrong**, and both times being corrected was the
mechanism of getting it right, not a detour from it. The engine corrected me (the
dissolution zones I read as failure were the corrosion that *makes* a sceptre).
The boss corrected me (I deferred gwindel on a premise — "it needs a shear field
to tell it from a sceptre" — that dissolved the moment I remembered cleft crystals
share their fluid). If you are doing this work right, you will be wrong in front of
the rocks and in front of the builder who set the goal, often, and the speed at
which you *update* is worth more than the polish of your first plan. Follow the
science is not a slogan here; it is the thing that does the correcting, and it
works even when no one names it.

Last: the catalog is a cabinet, and every specimen in it should be able to survive
a geologist picking it up. Not "looks plausible in a screenshot" — *true down to
why the tip dissolved before it crowned.* That standard is slow and it is the
point. Build the shear field that way: infra first and inert, one honest tenant at
a time, each one provable on the bench before it's dressed for the cabinet. Leave
the next layer a clean bedding plane, as this one tried to.

— still the builder, signing off this arc.
