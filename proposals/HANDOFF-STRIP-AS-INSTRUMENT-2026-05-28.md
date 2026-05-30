# HANDOFF — the strip recorder became a test instrument (+ the multidim merge)

**Date:** 2026-05-28
**Scope:** Folded the multidimensional fork back into vugg-simulator (canonical);
turned the strip-view recorder into a chemistry-contract test instrument; used
it to find + fix real bugs; widened the chip ranges to the real vug-fluid
envelope; closed a fresh-clone CI gap surfaced by an external review.

All work is on `main`, pushed to `Syntaxswine/vugg-simulator` origin.

---

## What shipped

**The merge (multidimensional → vugg-simulator, canonical):**
- `44d3b0f` — helicoid demoted to opt-in; the normal 3D vug model is the default view.
- `2465f84` — the merge. multidim (v144→v160) folded in via `git replace --graft`
  at the v142 fork point (the two repos had UNRELATED histories — multidim was a
  fresh `git init`, not a branch). Version collision (both repos used "v143")
  resolved: multidim's v143→v160 line is canonical; vugg's twin-law v143 content
  was folded into the data layer (see `js/15-version.ts` merge note).
- `947a9a1` — regenerated `seed42_v160` for the twin-law cascade (corundum/ruby/
  sapphire restructure → RNG shift, confined to `marble_contact_metamorphism`;
  30/31 scenarios byte-identical) + chrysoprase parallel-load timeout.
- `3dc858c` — `js/README.md` + the in-repo `vugg-add-twin-law` skill reconciled
  to the merged tree (renderer index, voxel grid, strip infra, AXIS verdict).

**The strip-as-instrument arc:**
- `c57130c` — `tools/strip-probe.mjs` (headless chemistry-trajectory inspector)
  + the **f_ord recorder bug** it surfaced (the Kim-ordering signal recorded
  flat-zero in every strip dataset since v149 — the recorder passes the raw sim,
  but the f_ord chip read expected `_dol_cycle_count` at the top level, where only
  the live-helicoid snap mirrors it; fixed with a `conditions` fallback).
- `7361ad9` — `tests-js/strip-helpers.ts` (`recordScenario` / `chipSeries` +
  reducers) + 5 chemistry contracts (sabkha Kim Ω-cycling, f_ord→0.82,
  wall→center depletion gradient; reactive_wall PWP pulses).
- `8e6ae2b` — the trajectory **tripwire**: `tools/strip-digest-shape.mjs` (shared)
  + `gen-strip-digest.mjs` + `strip_digest_v160.json` + `strip-digest.test.ts`.
  Guards the per-cell chemistry PATH (what the calibration baseline throws away).
- `4fc012d` — contracts for tutorial_travertine (degassing cascade), cooling
  (retrograde solubility), mvt (hot carbonate-supersaturated start).
- `fbb7860` — **science-grounded chip ranges.** The strip was clamping 42/58 chips
  (Cl 36×, Na 53×, SiO2 27×, Ca/DIC/CO3 8×, T past 250°C). New
  `tools/strip-chip-envelope.mjs` measured the real cross-scenario envelope;
  widened to it (SI to a meaningful ±8, not the raw −24 tail); fixed the `wall`
  chip's degenerate `[0,0]` (the PRIMARY wall-distance chip was recording all-null).
- `22979c0` — `pretest` hook so `npm test` builds `dist/` first (fresh-clone CI fix).

State at handoff: **1618/1618 green**, bundle in sync, typecheck 0.

---

## What I learned

1. **Observe before you assert — the instrument is more honest than your priors.**
   Three times, recording + looking at the actual trajectory before writing a
   contract caught me about to bake in a falsehood:
   - *cooling*: I expected "SI rises on cooling = bug." It *dropped* — correct
     (calcite retrograde solubility; heat precipitates calcite, cooling dissolves
     it). The sim was right; I was wrong.
   - *zoned_dripstone_cave*: I flagged "flat chemistry = missing driver." Wrong —
     the zoning is *spatial* (height), intentionally time-static, already tested;
     I'd sampled the unzoned mid-wall.
   - *f_ord flat-zero*: this one WAS a real bug — found only because I looked at
     the trajectory instead of assuming it worked.
   A contract that *pins observed behavior* is honest; one that *claims to validate
   science* needs the research in hand. (Shy's "be mindful writing about data you
   read without the rest of the research" earned its keep — three times.)

2. **A visualization is a latent test instrument.** The strip recorder was built to
   *show* chemistry; pointing it at *verification* immediately surfaced two bugs
   invisible to everything else (f_ord, the chip clamping + the wall null), because
   nobody had systematically looked at the per-cell chemistry path. Anything that
   records state is a regression oracle waiting to be wired up.

3. **Know which store you're reading.** The strip reads `mesh.cells`/voxel
   (per-cell); the older bespoke probes read `ring_fluids[equator]` (bulk). They
   legitimately differ (bulk isn't mass-debited; the cells are). Contracts pin the
   *strip's* observed behavior and corroborate — never assume parity with — the
   bulk probes. The same sim-vs-`sim.conditions` distinction was behind the f_ord bug.

4. **"Follow the science" is an engineering input, not a slogan.** The chip-range
   fix is the clearest case: vug fluids are genuinely multi-scale (dilute cave drip
   to evaporite brine, ~1.5 orders of magnitude), so the geology *dictated* that no
   single fixed range can serve — the measured envelope set the ranges.

5. **Verify the cold path, not just the warm one.** My local `dist/` is always
   built, so I never hit the fresh-clone `npm test` failure. Blind spots live in the
   states you don't personally inhabit; the external review caught it.

6. **Confine and explain drift.** The merge's one baseline drift was predicted from
   the prior builder's v143 note, confined to one scenario, regenerated with the
   reasoning recorded. The digest tripwire extends that discipline from
   final-crystal-counts to the full chemistry trajectory.

---

## What I hope to achieve next

1. **Finish the chemistry-contract batch through the best-researched scenarios** —
   gem_pegmatite, the evaporites (naica giant-selenite, searles, sabkha brine now
   that ranges are unclamped), supergene/bisbee, marble. Best-data-first,
   observe→verify-science→pin, growing the digest each time. Expect both more bugs
   AND more "the science just made it work" — both are wins.
2. **Re-probe the high-concentration scenarios now the ranges are fixed.** The
   clamping was flat-lining real chemistry on the brine/high-T scenarios; the
   unclamped trajectories may show structure worth contracting — or new bugs.
3. **Test-parallelism hardening** (external review's concern #2). Reproduce the
   `--pool=forks` 30→2 with fresh `dist/`, then choose between pinning `pool:'forks'`
   and proper per-test seed isolation. My added tests are seed-isolated
   (`recordScenario` sets the seed); the fragility is in the shared-global harness.
4. **The global per-vertex placement flip** (deferred). Make "nucleate where σ is
   highest" the default. It desyncs every baseline (big rebake), but the radial
   sub-strips + the strip instrument now make it *verifiable against the geology
   before committing* — which is exactly why the instrument came first.
5. **A scenario enhancement, not a bug:** `zoned_dripstone_cave` is *spatially*
   zoned but time-static. Real speleothem banding is *temporal* (seasonal wet/dry →
   pCO2/Ω cycling). A seasonal-event driver would add genuine growth-band zoning.

---

## For the next builder — gotchas + load-bearing facts

- **`npm test` now builds first** (`pretest`). `dist/` is gitignored; the test
  harness (`setup.ts`) reads `dist/`, NOT the committed `index.html`.
- **The strip reads per-cell (`mesh.cells`/voxel), not ring bulk.** Never assume a
  strip trajectory equals a `ring_fluids` probe.
- **f_ord lives on `conditions._dol_cycle_count`**, not on the sim. Recorder-fed
  chip reads must fall back to `s.conditions`.
- **Chip ranges are sized to the cross-scenario envelope.** `tools/strip-chip-envelope.mjs`
  measures it (re-run if you add a scenario with extreme chemistry). SI chips use a
  meaningful ±8 window, not the raw −24 envelope.
- **The strip toolkit:** `strip-probe.mjs` (inspect one trajectory),
  `gen-strip-digest.mjs` (regen the tripwire baseline — run after any change that
  legitimately moves a trajectory; inspect the human-readable diff), and
  `strip-chip-envelope.mjs` (clamp audit). Contracts/helper live in `tests-js/strip-*`.
- **Contracts pin observed behavior + cross-reference validated probes** — they do
  NOT re-derive the science. Keep that framing honest.
- **The strip-probe workflow is wired into the skills** (`vugg-tune-scenario` §1
  Tool 4 + §4; `vugg-add-scenario` §12) — user-global, so reach for it when tuning
  or authoring a scenario's chemistry.
- **Merge housekeeping:** the boss still promotes Syntaxswine→StonePhilosopher; the
  `multidimensional-space-simulator` repo can retire (its work is fully here).
