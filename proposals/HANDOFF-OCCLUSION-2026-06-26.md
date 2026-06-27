# HANDOFF — Substrate occlusion shipped; the morphology-fidelity fork (2026-06-26)

**Read this first** — fresh-context entry point for the vugg-simulator morphology-fidelity / central-distance-growth work. The full arc backstory (Phases 0/1/3 + the specimen-debt pass that fixed tourmaline / hemimorphite / the system-aware prism) is in `proposals/HANDOFF-DIRECTIONAL-GROWTH-2026-06-22.md` (+ its 2026-06-23 and 2026-06-26 addenda). **This doc is the occlusion completion (Phase 2) + where to go next** — it stands on its own for the immediate pickup.

---

## State (verify, don't trust)

- **HEAD `617b9f7`** (will move +1 for this handoff's docs commit), origin/main == HEAD, **Pages built at HEAD** (Syntaxswine fork — a push to origin/main IS the deploy).
- **SIM_VERSION 214 — UNCHANGED.** The entire occlusion arc is render-only / byte-identical; **no rebake, no baseline regen.** The seed-42 calibration baseline (`tests-js/baselines/seed42_v214.json`) is the hard byte-identity gate and it never moved.
- **cold-ci GREEN** on the 617b9f7 working tree — 2041 tests, 148 files (`tools/cold-ci.mjs`). NB the stamp records `3837ec3 (dirty)` because that was HEAD when the run fired (the commit landed after); a fresh `cold-ci --check` will re-run. That's expected, not rot — the tree IS green.
- **Tree reads dirty** only because of `tools/strip-story-diff.mjs` — a CONCURRENT session's untracked WIP. **NEVER stage it.** It's why cold-ci can't cleanly stamp HEAD; ignore it.

---

## TL;DR — where to start (the fork)

The occlusion arc is **complete and verified**. Three forks; my recommendation first.

### 1. Fleet-wide occlusion default ⭐ (recommended — cheapest big win)
Occlusion is the DOMINANT, UNIVERSAL driver (every wall-nucleated crystal is partly sealed against the host), but it currently lives on only 3 opted-in scenarios. The fleet census (`tools/occlusion-coverage.mjs`) proves the classifier + habit guard are **logically sound across all 37 scenarios** (496/730 eligible crystals root; every guard-skip is a genuine non-euhedral form; NO false-positives; air-mode dripstone correctly roots nothing). **The only remaining gate is AESTHETIC** — does the sunk read look good across the fleet — and that needs eyes, because the render can't be driven headlessly (no WebGL in jsdom; `VugSimulator`/`SCENARIOS` aren't on `window`).
- **The move:** boss eyeballs a default-on build on a few diverse scenarios; if it reads right, flip `wall.occlusion` from opt-IN to opt-OUT (default true), keep `occlusion_fraction` for per-scenario tuning + `wall.occlusion:false` as the escape hatch. Re-run `occlusion-coverage.mjs` + cold-ci (byte-identical → no rebake).
- **To review live:** open the page, run **mvt / elmwood / gem_pegmatite**, switch to the **3D crystal view** (this is the Three.js path — NOT the 2D wall-profile canvas), hard-refresh first.

### 2. Phase 4 — full per-face central-distance (Wulff) model
The arc's destination: replace the `(c_length, a_width, habit)` triple with a per-crystal face set `[{normal, d, regime}]` rendered by half-space intersection → `ConvexGeometry`. Reshapes the visible crystal per-face. **Big lift; decide the concavity primitive (nested convex shells, recommended) BEFORE generalizing** — neither the convex MVP nor a convex Wulff body can render hopper/skeletal concavity (proposal §2.3). Validate with the cube+octahedron fixture (equal d → cuboctahedron; shrink {111} → cube). Δd must be deterministic (per-(mineral,step) derived, not the shared RNG stream). Needs a design pass + greenlight first.

### 3. New arc — aggregate geometry (census-informed)
The occlusion census enumerated the minerals currently drawn as a clean prism that are really **crusts / masses / sprays** (botryoidal smithsonite, massive nickeline/native-arsenic, fibrous chrysotile, acicular brochantite tufts…). Today they fall through `_habitGeomToken → 'prism'` and render as a single hex/system prism — geologically wrong. Giving them real blob / mammillary / spray builders (the `_makeHemimorphiteFan` pattern, generalized) is the next-biggest "drawn wrong" gap after occlusion. The guard-skip lists in the census output are the worklist.

---

## What shipped this session — occlusion = Phase 2 of the central-distance arc

| Commit | What |
|---|---|
| `d4ef8fc` | **Phase 2 substrate occlusion.** `js/45 classifyOcclusion` (pure, rng-free, gated on `wall.occlusion`) tags `crystal._occlusion = {attachedFraction}`; `js/99i` sinks the base: `offsetMm = cLen*(0.5 − attachedFraction)`. Opted in **mvt**. js/22 whitelist, js/27 doc, `tests-js/occlusion.test.ts`. Browser-verified the sink reads as embedded against the translucent wall (no ghost). |
| `3837ec3` | **Broaden + habit guard.** `OCCLUSION_SKIP_HABIT` skips non-euhedral forms + air-mode; classifier RE-EVALUATES each step and CLEARS a stale tag when habit later flips to aggregate (caught `quartz→chalcedony`, `wurtzite→platy_massive`). Opted in **elmwood** (0.40, compounds with Phase 1 stepping) + **gem_pegmatite** (`occlusion_fraction: 0.30`, pocket crystals emerge freer). 8 test pins. |
| `617b9f7` | **Fleet census tool + the guard refinements it surfaced.** `tools/occlusion-coverage.mjs` (the occlusion analog of `morph-fidelity-audit.mjs`). Census fixed three borderline false-negatives — `native_gold(nugget)`, `awaruite(grains/placer)`, `tigers_eye` (all varieties) — by adding `nugget|grains|placer|chatoyant|hawks_eye|tiger` (fleet 504→496). |

All render-only, byte-identical, **SIM 214 unchanged**, cold-ci green at every step.

---

## How occlusion works (for whoever extends it)

- **Field:** `crystal._occlusion = { attachedFraction }` — how much of the anchored (−c) half is buried in the matrix. Extrinsic + UNIVERSAL (any mineral, any point group) — DISTINCT from `_polarAxis` (intrinsic, 10 polar classes only); a crystal can carry BOTH. Render-only, never serialized (the `_faceStep`/`_polarAxis` precedent → byte-identical).
- **Classifier (`js/45 classifyOcclusion`):** gated on `wall.occlusion`. `attachedFraction` = `wall.occlusion_fraction` (default 0.40) ± a deterministic golden-ratio hash of `crystal_id` (±0.12, clamped [0.10,0.60]) — a natural spread of embed depths with **NO rng**. Runs in the js/85 post-step dispatch (after `classifyPolarAxis`). **Re-evaluated every step** (not tag-once): clears a stale tag if a crystal becomes disqualified (habit flips to aggregate / shrinks below 50µm / goes air-mode). Deterministic ⇒ byte-identical.
- **Habit guard:** `OCCLUSION_SKIP_HABIT` (js/45) — a regex of non-euhedral descriptors (botryoid/massive/earthy/dendrite/wire/fibrous/scaly/spray/tuft/rosette/crust/coating/… + nugget/grains/placer/chatoyant/hawks_eye/tiger). `growth_environment === 'air'` also skips (stalactite/stalagmite c-axis is gravity-set). It reports its own decisions, so the census never duplicates the regex.
- **Renderer (`js/99i`, ~line 4255):** `const occF = crystal._occlusion?.attachedFraction ?? 0; const offsetMm = cLen * (0.5 - occF);` — `occF=0` (unset) is bit-for-bit the old base-at-anchor float ⇒ byte-identical placement for every non-opted scenario. The cavity wall is `BackSide`, `opacity 0.40` — translucent — so the buried base is veiled, not ghosted (the proposal's flagged "watch the offset math" risk, resolved favorably).
- **Whitelist (`js/22 WallState`):** `occlusion`, `occlusion_fraction`, `occlusion_minerals` — each opt must be copied in the constructor or it's silently dropped (the standing WallState trap; `directional_steps_minerals` is still unwired, left as-is).
- **Opted in:** mvt (0.40), elmwood (0.40), gem_pegmatite (0.30). `data/scenarios.json5`.

---

## The tools (run these)

- **`tools/occlusion-coverage.mjs`** — fleet census. Forces occlusion on for every scenario (seed 42) and reports per-scenario root vs guard-skip + the fleet total. RUN before/after any occlusion change; it's the fleet-wide-default evidence AND a guard bug-finder. `--scenario <name>` for one, `--seed N`.
- **`tools/morph-fidelity-audit.mjs`** — the crystal-system cross-section audit (the prior system-aware-prism arc). `--json`, `--systemmap`.
- **`tools/cold-ci.mjs`** — the green-tree gate. `--check` for the stamp shortcut.

---

## Key lessons this session

1. **The translucent wall VEILS the sink (didn't ghost it).** The proposal flagged the offset math as risky because the wall is translucent. Browser-verify (offscreen: real `_buildHabitGeom` + a faithful 0.40 wall + the real offset math) showed the matrix dims the buried base into a "rooted in rock" read. The risk resolved favorably — but it was checked, not assumed.
2. **Habit evolves; gate on the FINAL form.** Tag-once was wrong — quartz/wurtzite flip to aggregate habits after first-tag. The fix is re-evaluate-and-clear each step. Any future per-crystal render tag that depends on a mutable property wants this shape, not tag-once.
3. **Build the census, let it find the borderlines.** `occlusion-coverage.mjs` surfaced gold-nugget / awaruite / tiger's-eye rooting as if euhedral — fixed in the same loop. The [[feedback_build_tools_to_test]] pattern: the tool is part of the deliverable and it pays for itself immediately.
4. **You can't render real scenarios headlessly.** jsdom has no WebGL, and the bundle's classes (`VugSimulator`, `SCENARIOS`) don't leak to `window` (only top-level `function` declarations + `THREE` do). So: render-LOGIC verifies via node probes (counts) + unit tests; render-AESTHETICS verifies via the offscreen synthetic method (global builders + global THREE into a fixed canvas, screenshot) OR the boss's eyes on the live page. A whole-fleet aesthetic call is a boss call.

---

## Standing context / disciplines (verify, don't re-derive)

- **Byte-identity is the gate.** Render-only morphology (classifier tags + js/99i geometry/placement) never touches counts/sizes/chemistry, so the baseline stays identical and there's NO SIM bump / rebake. cold-ci's calibration test proves it.
- **Two render systems — don't confuse them.** 2D wall-profile (`topo-canvas`, js/99d/99e) vs the 3D Three.js crystal view (`topo-canvas-three`, js/99i). ALL the morphology builders (occlusion, terraces, hemimorphic, sector-zoned, saddle, bent, sceptre, system-prism) live in the **3D** path. If a morphology feature "doesn't show," check you're in the 3D view.
- **Deploy = push to Syntaxswine origin/main.** Pages rebuilds ~25s–2min; verify `pages/builds/latest` status==built AND commit==HEAD before "go look." Builds STICK — kick with `gh api -X POST repos/Syntaxswine/vugg-simulator/pages/builds` then poll (happened twice this session).
- **Commit messages:** unique temp file + `git commit -F` (concurrent sessions share `$TEMP`); verify `git log -1 --format=%s` before push.
- **Stage EXPLICIT files, never `git add -A`** — `tools/strip-story-diff.mjs` is a concurrent session's WIP.
- **PowerShell gotcha:** never pass `-ErrorAction` to a native exe (`gh`/`git`) — it's a cmdlet param and `gh` chokes on `-E`. Use `gh ... -q '.field'` for JSON, two separate calls rather than embedded-quote jq.

---

## Open debts (carry forward)

- **SPECIMEN verification (owed, [[feedback_terminal_verification_specimens]]):** occlusion shipped literature-anchored — a real drusy specimen (base-embedded single-termination) is the terminal check. Also still owed from earlier phases: a real calcite free-vs-attached macrostep, a real hemimorphic termination. Green = "not yet falsified," not "verified."
- **Fleet-wide default** awaits the aesthetic review (fork #1).
- **Guard architecture (minor):** the habit guard is habit-STRING based; a mineral-level "never euhedral" set (tigers_eye, opal, chrysocolla, turquoise, awaruite…) could be cleaner long-term, but the regex covers them via their habits today.
- **Phase 4 calibration debts** (from the proposal): obtuse/acute velocity-vs-Ca:CO₃ curve; per-mineral σ thresholds; a structured `point_group` field; the concavity primitive decision.

---

## Diagenesis credit

This arc moved fast on borrowed infrastructure: the **classifier-overprint plumbing** (deformation/etch/sector-zoning/faceStep/polarAxis) gave the pure-tagging pattern for free; **cold-ci** (the 10th-catch stamp) gated every phase; the **offscreen render-verification method** (real bundled builders against page-global THREE) let the one visible claim be checked; and the **headless-probe harness** (`_harness.mjs`, the dark-observe/t-story lineage) made the fleet census a 50-line tool, not a day's work. None of this was solo speed.

## Builder's note

The shape of the occlusion work was: ship the minimal correct thing (one scenario) → notice the mechanism is universal → broaden it → and then resist the temptation to flip it fleet-wide unverified. The census exists precisely because I *couldn't* see the fleet — so I built the instrument that shows the part I *can* verify (the logic) and named clearly the part I can't (the pixels), instead of guessing. That's the same separation the whole central-distance arc runs on: visible form layered on stable science, each rung checked against a real rock or a real screenshot before the next. The fleet-wide flip is one boss glance away — left undone on purpose, because "looks right everywhere" is a claim only an eye can sign.

— the builder
