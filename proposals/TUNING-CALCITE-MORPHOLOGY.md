# TUNING NOTE — calcite morphology, for future builders

*2026-06-11, written at arc close. The system is SHIPPED and calibrated
(see HANDOFF-CALCITE-MORPHOLOGY-2026-06-11.md, SHIPPED footer), but the
calibration is sim-observation + literature — the final authority is
hand specimens. This note is (a) the knob map for whoever adjusts it
next, and (b) the verification worksheet for comparing each scenario's
claim against real material from its locality.*

---

## 1. The mental model (60 seconds)

Every step, after growth and diffusion settle (`classifyCalciteMorphologyStep`,
js/52 — the POST-step basis, 18th catch: in-step σ is not interface σ):

```
bulk σ ──(boundary-layer damping)──► surface σ ──(Mg bunching ×)──► REGIME band
            1 + (σ−1)/(1 + min(size, CAP)/HALF)        ×(1 + 0.4·min(Mg:Ca, 1))

REGIME (Sunagawa order — never reorder, 17th catch):
  spiral_smooth < 2 | stepped_mild < 8 | stepped_macro < 50 | hopper < 200 | dendritic ≥ 200

FORM (independent axis): scalenohedral if Mg:Ca > 0.15 OR T > 200, else rhombohedral
```

The regime is stamped on the growth zone (`zone.morph_regime`); the zone
stack then drives **everything downstream from one record**: the habit
string (next step's `grow_calcite` dispatch), the visible terraces
(`calciteTerraceBands` → the 99i ziggurat geometry, replay-truncating so
terraces accumulate as you scrub), the `calcite_morph` strip chip, the
zone modal lines, and the narrator's terraced/hopper paragraphs. Adjust
the classifier and the whole stack follows — there is exactly one place
where morphology is decided.

## 2. The knobs

All in `CALCITE_MORPH_TH` (js/52-engines-carbonate.ts), **mirrored in
tools/calcite-morphology-map.mjs — keep the two in lockstep**; the
`--engine` mode exists to catch drift (agreement must read 100.0%).

| Knob | Value | What it does | Move it when… |
|---|---|---|---|
| `SPIRAL_MAX` | 2.0 | smooth ↔ mild edge | smooth localities show steps (raise) or mild localities read glassy (lower) |
| `STEP_MILD_MAX` | 8.0 | mild ↔ macro edge | terraces too bold/too subtle as a class |
| `STEP_MACRO_MAX` | 50.0 | macro ↔ hopper edge | crystals hollow that shouldn't (raise) |
| `HOPPER_MAX` | 200.0 | hopper ↔ dendrite edge | dendrites appear/stay absent wrongly |
| `SIZE_HALF_UM` | 80 | damping strength (small crystals) | µm-crust scenarios misband as a group |
| `SIZE_DAMP_CAP_UM` | 2000 | where damping SATURATES (the giants) | cabinet-scale crystals misband as a group — this is THE giant-crystal knob (Wolthers's δ is fixed, not size-proportional; the linear proxy was the pre-Phase-5 bug) |
| `MG_SCALENO` | 0.15 | Mg:Ca form flip (dogtooth) | Mg localities grow the wrong form. ⚠ CHEMISTRY-COUPLED — see §4 |
| `MG_BUNCH` | 0.4 | Mg step-edge pinning (bunching sharpener) | Mg localities step too much/little at same σ (calibrated by the k∈{0,0.4,0.8} sweep, research doc §4) |

Render-side (99i, cosmetic only — change freely, no rebake ever):
- `_makeTerracedCalciteGeom` tread pitches: mild `0.022`, macro `0.04`
  (unit-height per ledge; smaller = more, finer treads), hopper apex
  funnel depth `0.14`.
- `calciteTerraceBands` (js/52): relief floor **5%** (below it a crystal
  renders smooth — a stepped CORE sliver shouldn't texture a smooth
  crystal), sliver merge **1.5%**.

## 3. The adjustment workflow (always this, in this order)

1. Edit the knob in **js/52** AND **tools/calcite-morphology-map.mjs**.
2. `npm run build`
3. `node tools/calcite-morphology-map.mjs --engine` — read two things:
   the fleet table (did only the intended scenarios move?) and the
   agreement line (must be 100.0%; less means the mirrors drifted).
4. `npx vitest run tests-js/calcite-morphology.test.ts` — the band
   boundaries and fleet picture are pinned; update the pins WITH the
   change, deliberately, in the same commit.
5. `npx vitest run tests-js/calibration.test.ts` — should pass UNCHANGED
   for any regime/threshold move (see §4 for the exception).
6. Full suite, dense commit, update the research doc §3/§4 if a
   threshold was re-derived (boss directive: research stays verifiable).

## 4. What is chemistry-coupled and what is free

**Free (no SIM bump, no rebake):** every regime threshold, both size-
damping knobs, MG_BUNCH, all render pitches, the relief floor. This is
Phase 2's aspect-preserving design doing its job: σ-regime habit strings
(`stepped_rhombohedral` etc.) carry their PARENT form's exact
`_habitAspectRatio` (rhomb family 0.8, scaleno family 0.5), so a regime
rename never moves volume → fill → chemistry. **Do not break this**: if
you add a new habit string, give it the parent form's ratio in
js/27-geometry-crystal.ts or you'll cascade the whole fleet.

**Chemistry-coupled (SIM bump + rebake + baseline diff):** anything that
flips the FORM — `MG_SCALENO`, the T>200 rule, or new form triggers —
because scaleno (0.5) vs rhomb (0.8) IS an aspect change. Measure first
(the Phase-4 pattern: probe sweep → predicted movers → diff confirms).

## 5. Per-scenario tuning beats global tuning

If ONE locality reads wrong, reach for its **chemistry**, not the global
thresholds: broth values, movement pulse amplitudes/widths/centers
(elmwood's CO3+pH fault-valve train is the template), duration. The
global knobs are for when a whole CLASS of localities is wrong. For a
new stepped showcase, copy the elmwood pattern: coupled CO3+pH pulses
(one geological slip, two signatures), deterministic (no OU texture —
it re-rolls marginals), judged by a dedicated multi-seed observer
(tools/elmwood-stepped-observe.mjs is the model).

New-scenario checklist that bit us this arc: scenarios.json5 entry +
the THREE menu surfaces in index.html's body (Creative picker button,
`#scenario` dropdown, Zen `#idle-scenario` dropdown — the
scenario-menu-coverage guard test will catch you) + minerals.json
scenarios lists + baseline regen (same SIM version is fine if the diff
shows only the new scenario).

## 6. ✋ HAND-VERIFICATION WORKSHEET (the boss's last step)

What the sim CLAIMS per locality at seed 42 (v187 + elmwood), and what
to compare on real material. Columns: dominant regime per the map tool;
form; whether terraces actually RENDER (relief ≥ 5%); what to look for
in hand specimen; the first knob if reality disagrees.

| Scenario | Sim claims (dominant / form) | Terraces render? | Check on the real specimen | If wrong, first knob |
|---|---|---|---|---|
| **elmwood** | smooth core 81% + mild rim 18%, ends `stepped_scalenohedral`, ~12.4 mm golden dogtooth | YES (19% relief, ~4 bands) | Elmwood/Gordonsville calcite: golden scalenohedron, FINE mm-scale step terraces on the faces, massive interior, phantom banding. Steps should read as trains, not one cliff | pulse amps/widths in the scenario; render pitch 0.022 for tread fineness |
| **mvt** (Tri-State) | smooth-spar 98%, rhombohedral | no (2% core sliver, below floor) | Joplin/Picher spar: glassy rhombs — should show NO terracing | if real Tri-State shows steps: `SPIRAL_MAX` down or its broth σ up |
| **deccan_zeolite** | stepped(mild) 69% / smooth 24%, rhomb | yes | Indian basalt-pocket calcite spans glassy → poker-chip/pagoda; a mild-stepped dominant with smooth stretches should feel right. If your Deccan material is mostly glassy → `SIZE_DAMP_CAP_UM` up (more giant smoothing) | `SIZE_DAMP_CAP_UM` |
| **jeffrey_mine** | STEPPED 45% / mild 31% / smooth 21%, scaleno | yes | Jeffrey calcite is often glassy lilac — this is the remap's BOLDEST claim (its σ spikes to 213 were always instability-grade). If your specimens are smooth: this is the first place to spend `SIZE_DAMP_CAP_UM` skepticism, or tune jeffrey's broth | `SIZE_DAMP_CAP_UM` / jeffrey broth |
| **marble_contact** | stepped(mild) 97%, scaleno | yes | Skarn-pocket vug calcite near contacts: vigorous-growth gentle steps vs glass-smooth — judgement call. Pre-Phase-5 it read all-smooth purely because of the unbounded damping | `SIZE_DAMP_CAP_UM` |
| **sabkha** | hopper 100%, scaleno (Mg:Ca 3.3) | yes + apex funnel | Evaporitic high-Mg calcite crusts: hollow/skeletal habits — the apex-funnel read | `STEP_MACRO_MAX` / `MG_BUNCH` |
| **zoned_dripstone** | hopper 64% / dendritic 36% rims, scaleno | yes + funnel | Fast-drip speleothem rims — dendrite stays TRANSIENT (zero stable dendrites is the reviewer-confirmed headline; if it ever goes dendrite-DOMINANT a knob has drifted) | `HOPPER_MAX` |
| **stalactite_demo** | STEPPED 74%, rhomb | n/a — air-mode renders dripstone icicle (correct cave form) | the stepped record lives in zone tags/strip, not the silhouette | — |
| **ultramafic** | STEPPED 100%, scaleno (Mg:Ca 10) | µm crusts (render floor) | high-Mg weathering-crust textures | `MG_BUNCH` |
| **searles** | stepped(mild) 100%, scaleno (Mg:Ca 1.6) | small crystals | evaporite-lake calcite, gentle stepping | `MG_BUNCH` |
| travertine / mn_calcite / pulse / fluorite_vein | smooth-spar dominant | no | should read clean/glassy | `SPIRAL_MAX` |

**Disagreement playbook:** one locality wrong → §5 (its chemistry).
A whole band wrong → the band edge (§2). All the BIG crystals wrong →
`SIZE_DAMP_CAP_UM`. The Mg localities wrong → `MG_SCALENO` (careful, §4)
or `MG_BUNCH`. Whatever you change: re-run the map, re-pin the tests,
note the re-derivation in the research doc — and if a hand specimen
overrules a calibrated threshold, that is the system working as
designed. The locality is the authority; the literature was scaffolding.

## 7. Traps (each cost something once)

- **Sunagawa order is load-bearing** — smooth → stepped → hopper →
  dendritic, never reordered (17th catch; the ordering test pins it).
- **Post-step basis is load-bearing** — classify after growth+diffusion,
  never from the in-step σ (18th catch; the recompute test pins it).
- **Engine and map tool are mirrors** — every classifier change lands in
  both, and `--engine` agreement is the cheap proof.
- **Aspect preservation is the chemistry firewall** (§4).
- **jsdom can't see the terraces** — geometry contracts are headless
  (band derivation), but the LOOK needs a human eye or a preview
  screenshot. The replay scrubber is the fastest way to judge a change.
