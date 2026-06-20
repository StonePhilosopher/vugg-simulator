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
