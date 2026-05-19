# HANDOFF: High-fill physics arc CLOSED + habit-stability fix

> **Authored:** 2026-05-18 by Claude (Sonnet 4.5)
> **State:** HEAD = `b3cc095` on `origin/main` (Syntaxswine). SIM_VERSION 76. **263/263 tests green.** Coverage tool: 0 stale, 95 live, 21 dead.
> **Continues:** `HANDOFF-CASCADE-GATE-AUDIT.md` (terminus `0a15f9c`). That doc covered the Path C cascade-gate audit through its harness extraction; this doc covers what came after: Proposals B, D, and the habit-stability fix that closed the residual gem_pegmatite + radioactive_pegmatite overshoots.
> **Status:** the **high-fill physics arc from `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` is now complete**. Proposals A, B, C, D landed; only E (per-cell local fill, ~3 days, the deferred marginal final 20%) remains. The simulator's cavity-fill bookkeeping is structurally honest: no scenario can report vugFill > 1.0.
> **Audience:** next agent picking up a fresh thread (size-class polish, Proposal E, the dead-list minerals, or anything else from the open backlog).

---

## 1. TL;DR

Three commits closing the high-fill physics thread, all in one session:

| sha | arc | tests | high-fill state |
|-----|-----|-------|-----------------|
| `f4dae0d` | **Proposal B** — habit transitions on fill × σ | 238 → 247 | (visual / texture layer) |
| `f9456bb` | **Proposal D** — interlocking textures + single-zone volume clamp | 247 → 253 | sabkha 2.52→1.00, residual gem_peg 5.75, radioactive_peg 4.07 |
| `b3cc095` | **Habit-stability fix** — zone-integrated volume | 253 → 263 | gem_peg 5.75→1.00, radioactive_peg 4.07→1.00 |

**Every scenario in the 24-scenario sweep now peaks at exactly vugFill = 1.000.** The simulator can no longer report fill > 1.0 because volume increments to `Crystal._volume_mm3` are bounded by the Proposal D clamp using the same volume coefficient that add_zone applies. Structurally enforced.

The session's defining insight: **after Proposal D shipped, gem_pegmatite still overshooting 5.75× was the smoking gun for a pre-existing bookkeeping bug.** `get_vug_fill` reinterpreted the WHOLE accumulated `total_growth_um` through whatever `crystal.habit` was set RIGHT NOW. Growth engines flip habit per step (tabular ↔ prismatic), so the same crystal mass swung by 14× in the volume calc. The fix was a refactor toward **zone-integrated volume** — each zone's contribution is locked in at deposition time at its own aspect ratio, never reinterpreted.

---

## 2. The high-fill physics arc, complete

From `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` §5:

| proposal | sha | what it encoded |
|---|---|---|
| A | `b440419` (prior) | Continuous sigmoid dampener replacing the 0.95 + 1.0 binary cliffs. σ-side encoding of boundary-layer diffusion at high fill. |
| B | `f4dae0d` (this session) | Habit transition triggers on fill × σ. New "high fill" / "drusy" / "post-seal" keywords in habit-variant triggers. NEW variants: calcite.druzy_crust, quartz.microcrystalline, aragonite.botryoidal_crust. |
| C | `4b20645` (prior) | Per-mineral `late_stage_propensity: 0-1` gradient. 20 minerals scored from literature. |
| D | `f9456bb` (this session) | Per-iteration dampener recomputation in growth loop + single-zone volume clamp. `late_interlocking` flag for granular renderer texture. |
| **habit-stability** | `b3cc095` (this session) | **Zone-integrated volume.** Each zone records its aspect ratio at deposition; `Crystal._volume_mm3` accumulates incrementally; `get_vug_fill` reads the field. No reinterpretation. |
| E | DEFERRED | Per-cell local fill (Tranche 7-style). Per RESEARCH-GROWTH-AT-HIGH-FILL.md §5: "marginal final 20% — A+B+C+D cover ~95% of the geological story." ~3 days. |

### Final overshoot inventory

From `tools/high_fill_probe.mjs` at HEAD `b3cc095`:

```
scenario              peak vugFill  sealed_step
----------------------------------------------
sabkha_dolomitization        1.000   1
naica_geothermal             1.000   29
searles_lake                 1.000   57
supergene_oxidation          1.000   135
gem_pegmatite                1.000   19
radioactive_pegmatite        1.000   103

all others                  < 0.45  (never approached seal)
```

**Every overshoot from the original research doc §2 inventory is now eliminated** — including the 7.46× gem_pegmatite peak that motivated the whole high-fill thread.

---

## 3. What landed, in detail

### 3.1 Proposal B — habit transitions on fill × σ (`f4dae0d`)

**Engine change** (`js/07-habit-variant.ts`): `selectHabitVariant()` gains a 5th `localFill` parameter. New trigger-keyword scoring:

```
"post-seal":            +2.0 if fill > 0.95, else -1.5
"high fill" / "drusy":  +1.5 if fill > 0.75, else -1.0
"low fill":             +0.6 if fill < 0.7,  else -0.4
```

Skipped entirely if `localFill === undefined` → backward compat for legacy callers (library preview, Three.js renderer).

**Wiring**: `js/85d-simulator-step.ts` stashes `this._currentVugFill = vugFill` in `check_nucleation()`; `js/85b-simulator-nucleate.ts` passes it through to `selectHabitVariant`.

**Three NEW habit variants** (all `vector: "coating"` for late-stage carpet):
- `calcite.druzy_crust` — Brazilian amethyst "skunk calcite" late euhedral overgrowths per Proust & Fontan 2007
- `quartz.microcrystalline` — chalcedony / agate carpet, boundary-layer-diffusion-limited
- `aragonite.botryoidal_crust` — speleothem "cave coral" botryoidal habit

**Four EXISTING variants** got their triggers extended with "high fill" keywords (no behavior change at low fill, higher probability at high fill): halite.hopper_growth + .fibrous_coating, sylvite.hopper_cube, borax.cottonball.

RNG-sequence preserved: variant selection always consumes exactly one `rng.random()` call regardless of which variant scores highest. Adding the fill scoring branch changes WEIGHTS but not the RNG call pattern → calibration baseline byte-identical between v73 and v74.

### 3.2 Proposal D — interlocking textures + single-zone volume clamp (`f9456bb`)

**Part 1 — per-iteration dampener** (`js/85-simulator.ts`): pre-D the growth loop used `this._fillDampener` (stashed once per step at step-start vugFill). That stash was correct for nucleation but wrong for growth: by mid-loop currentFill had risen, but every crystal still used the step-start dampener. Now: recompute `_fillDampenerFor(currentFill)` each iteration.

**Part 2 — single-zone volume clamp**: even with per-iteration dampening, the FIRST crystal of a step entering at currentFill=0 sees dampener=1.0 → unbounded growth → can push past seal in one zone (sabkha step 1's 2.5× case). The clamp pre-computes projected ellipsoid volume delta before `add_zone()` and limits `zone.thickness_um` so:

```
deltaV ≤ remainingVol = max(0, (1.0 - currentFill) × cavity_volume)
```

Math:
```
cMm_max = (cMm_now³ + remainingVol / kVol)^(1/3)
where kVol = (π/6) × aRatio²
```

**Late-interlocking tag** (`crystal.late_interlocking = true`) fires when the clamp engages OR when growth happens at `currentFill ≥ 0.85` with dampener < 1.0. Three.js renderer can use it for granular/massive texture (Tsumeb late-stage patina, Naica selenite cluster surfaces).

### 3.3 Habit-stability fix — zone-integrated volume (`b3cc095`)

**The bug**: `get_vug_fill` computed each crystal's ellipsoid volume from `(total_growth_um, crystal.habit)`. Growth engines override `crystal.habit` each step:

```
js/50-engines-arsenate.ts:233+237 (adamite, mimetite)
js/52-engines-carbonate.ts:650    (carbonate)
js/55-engines-molybdate.ts:33+117 (powellite, wulfenite)
js/53-engines-halide.ts:111       (emerald-striated)
+ ~12 more sites
```

A single crystal flipping between `habit='tabular'` (aRatio=1.5, vol coeff 1.178) and `habit='prismatic'` (aRatio=0.4, vol coeff 0.0838) swung `get_vug_fill` by 14× for that ONE crystal — same `total_growth_um`, different volume interpretation. The gem_pegmatite 5.75× and radioactive_pegmatite 4.07× residuals from Proposal D were entirely this.

**The fix — zone-integrated volume**:

```ts
// At zone deposition (Crystal.add_zone):
const zoneAspect = _habitAspectRatio(this.habit);  // habit AT THIS ZONE
zone.aspect_ratio = zoneAspect;
if (zone.thickness_um > 0) {
  const kVol = _habitVolCoeff(zoneAspect);
  this._volume_mm3 += kVol * (Math.pow(cNew, 3) - Math.pow(cOld, 3));
} else if (zone.thickness_um < 0) {
  this._volume_mm3 *= Math.pow(cNew / cOld, 3);  // ellipsoid shape-similarity
}

// In get_vug_fill:
for (const c of this.crystals) {
  if (!c.active) continue;
  if (typeof c._volume_mm3 === 'number') {
    crystalVol += c._volume_mm3;
    continue;
  }
  // ... legacy fallback for backward compat ...
}
```

Each zone's contribution is locked in at deposition time. `_volume_mm3` is a single source of truth that never gets reinterpreted.

**Bonus**: `a_width_mm` is now also stabilized — derived from `_volume_mm3` and `c_length_mm` via `a = sqrt(6V / (π × c))`. Renderer sees a width consistent with growth history, not flickering with habit oscillation.

**Code organization**: shared helpers `_habitAspectRatio(habit)` and `_habitVolCoeff(aRatio)` hoisted to top of `js/27-geometry-crystal.ts`. Both `Crystal.add_zone` AND the Proposal D growth-loop clamp (`js/85-simulator.ts`) use these single-source helpers. Previous duplicated aspect-ratio tables across 27-geometry, 85-simulator, and 85c-simulator-state are consolidated.

---

## 4. State files

| file | purpose |
|------|---------|
| `js/07-habit-variant.ts` | Proposal B: 5-arg signature with localFill; fill scoring branch |
| `js/27-geometry-crystal.ts` | Habit-stability: `_habitAspectRatio` + `_habitVolCoeff` helpers; `Crystal._volume_mm3` field + add_zone update; `a_width_mm` derived from `_volume_mm3` |
| `js/85-simulator.ts` | Proposal D: per-iteration dampener + single-zone volume clamp; uses shared helpers post-habit-stability |
| `js/85b-simulator-nucleate.ts` | Proposal B: passes `this._currentVugFill` to selectHabitVariant |
| `js/85c-simulator-state.ts` | Habit-stability: `get_vug_fill` reads `c._volume_mm3` (with backward-compat fallback) |
| `js/85d-simulator-step.ts` | Proposal B: stashes vugFill on `this._currentVugFill` each step |
| `data/minerals.json` | Proposal B: 3 NEW habit variants + 4 trigger extensions |
| `js/15-version.ts` | SIM_VERSION 73 → 76; v74/v75/v76 history notes |

| test file | purpose |
|---|---|
| `tests-js/habit-fill-transitions.test.ts` (NEW) | Proposal B — 9 cases |
| `tests-js/interlocking-textures.test.ts` (NEW) | Proposal D — 6 cases |
| `tests-js/habit-stability.test.ts` (NEW) | Habit-stability — 10 cases (6 macro overshoot pins + 4 micro pins on zone-integrated math) |
| `tests-js/baselines/seed42_v74.json` | Proposal B baseline (byte-identical to v73 — habits change names not counts) |
| `tests-js/baselines/seed42_v75.json` | Proposal D baseline |
| `tests-js/baselines/seed42_v76.json` | Habit-stability baseline (current) |
| `tests-js/setup.ts` | `selectHabitVariant` added to EXPORTS list (Proposal B test dependency) |

---

## 5. Open backlog

### High-fill thread (this arc closes most of it)

- ~~Proposal A (sigmoid dampener)~~ ✓ `b440419`
- ~~Proposal B (habit transitions)~~ ✓ `f4dae0d`
- ~~Proposal C (late_stage_propensity)~~ ✓ `4b20645`
- ~~Proposal D (interlocking textures)~~ ✓ `f9456bb`
- ~~Habit-stability fix~~ ✓ `b3cc095`
- ~~Proposal E (per-cell local fill)~~ ✓ `2e88355` (2026-05-18, v77). Scaffolding + opt-in flag `conditions.wall.per_cell_local_fill`. Default off → byte-identical to v76. When on: growth-loop dampener reads the crystal's anchor-cell local fill instead of global vugFill (`Crystal._volume_mm3` distributed across footprint cells by `WallState._paintCrystalVolume`). No scenarios opt in at landing; A/B on 6 high-fill scenarios shows per-cell tends to produce many smaller crystals at corners OR fewer bigger crystals at sealed edges. Per-scenario opt-in is a future calibration call. **The high-fill physics arc from RESEARCH-GROWTH-AT-HIGH-FILL.md is now STRUCTURALLY COMPLETE.**

### Other open items (from prior handoffs, unchanged)

- **Cave-size resize** of naica/dripstones — wait for Proposal E if pursued (cave-scale runs benefit more from local-fill modeling than the global cap)
- ~~**Architecture audit follow-ups** from `1541f70`~~ ✓ `c2c12ca` (2026-05-18, v78). All 6 scenarios reassigned to their geologically-correct archetype. Schneeberg gains zeunerite (the literal type locality mineral); porphyry shifts crystal anchors via walls_only bias. Coverage unchanged.
- **`native_sulfur` cascade-gate** — only remaining structural-pattern dead mineral from the audit, deferred per HANDOFF-CASCADE-GATE-AUDIT §5. Needs a fumarole / Sulphur Bank Mine / Whakaari-type scenario to land first (its `pH > 5` + `metal_sum > 100` gates aren't depleting-species gates like the others; the engine may be correct and the gap is "no canonical scenario fires it").
- **Engine cleanup**: ~17 sites that explicitly set `crystal.a_width_mm = c_length_mm × N` are now redundant — add_zone derives a_width_mm from `_volume_mm3`. Mechanical refactor; would remove the now-dead assignments. Low priority.

---

## 6. Verification harness

```bash
npm run ci                                  # typecheck + build + 263 tests
npm test                                    # vitest only
node tools/gen-js-baseline.mjs              # regen baseline after chemistry/geometry changes
node tools/twin_rate_check.mjs              # twin frequency report
node tools/mineral_coverage_check.mjs       # live / stale / dead classification
node tools/stale_mineral_probe.mjs          # per-step σ for stale (mineral, scenario) pairs
node tools/high_fill_probe.mjs [seed]       # vugFill trajectory + growth-rate bins
node tools/geology_check.mjs                # 10-seed scenario sweep vs expected paragenesis
```

All six probe tools use `tools/_harness.mjs` (shared `loadSimBundle()` — extracted in `0a15f9c`). Tool #7 onwards: just `import { loadSimBundle } from './_harness.mjs'`.

Boot order if starting cold: `npm run build` first.

---

## 7. Principles refreshed

The principles from the prior three handoffs are still load-bearing:
- HANDOFF-CALIBRATION-AND-COVERAGE: fill_exempt audit-trail pattern, stale-comment trap
- HANDOFF-HIGH-FILL-AND-SIZE-CLASS: compose-cleanly architecture, size-class orthogonal to architecture, text-mode bulk edits
- HANDOFF-CASCADE-GATE-AUDIT: **audit chemistry data before engine knobs** (the boss's "follow nature" principle, twice-validated)

**One new principle this session**:

### Bookkeeping should integrate, not reinterpret

The habit-stability bug surfaced a deep pattern. The bug was a function (`get_vug_fill`) reinterpreting cumulative state (`total_growth_um`) through current-frame metadata (`crystal.habit`). When the metadata oscillates, the same accumulated quantity yields wildly different answers.

The fix is structural: **let the cumulative state BE the answer**, not a derivation that depends on metadata that might change. `Crystal._volume_mm3` integrates contributions as they happen, at the metadata-of-the-moment, and stays stable forever after. `get_vug_fill` reads the field directly.

This pattern recurs throughout the simulator. Watch for it when you see:
- Per-step recalc from cumulative quantities × current-frame state
- Field values that swing dramatically when an upstream field flips

The fix is usually: incrementalize. Store the integrated answer, not the recipe for re-deriving it.

---

## 8. What this session was

Continuation of the Path C cascade-gate audit session — same day, no compact in between. The cascade-gate audit closed in commits `e9248c5 → 0a15f9c` (HANDOFF-CASCADE-GATE-AUDIT.md covers those). This handoff covers the high-fill physics arc that came next:

- **Proposal B** — quick win, ~1 hour. Built cleanly on Proposals A+C which had already shipped.
- **Proposal D** — bigger lift, ~2 hours. The single-zone volume clamp required matching the deltaV math exactly to what add_zone increments.
- **Habit-stability fix** — surfaced by Proposal D's residual overshoot diagnostic. The temp `_gem_pegmatite_trace.mjs` script (deleted post-investigation) made the habit-oscillation bug visible. The fix took ~1 hour with the right design (zone-integrated volume) — the harder part was recognizing the bug class.

Cumulative state across two sessions (`72243d2 → b3cc095`, 8 commits):

| metric | before | after |
|---|---|---|
| SIM_VERSION | 69 | 76 |
| tests | 226 | 263 (+37) |
| live minerals | 89 | 95 (+6) |
| dead minerals | 27 | 21 (-6) |
| stale minerals | 0 | 0 |
| probe tools | 5 | 6 + harness |
| peak vugFill (worst scenario) | 7.46 | 1.000 |

The two-session arc closes both the cascade-gate audit (HANDOFF-CASCADE-GATE-AUDIT.md) AND the high-fill physics thread (this doc).

---

## 9. Closing — what's NOT in this handoff

Things omitted because the prior handoffs cover them:

- The Backlog K vugFill cap discovery + fix → `HANDOFF-CALIBRATION-AND-COVERAGE.md` §5
- The four original stale-mineral retunes (adamite / chrysoprase / ruby / native_tellurium) → `HANDOFF-CALIBRATION-AND-COVERAGE.md` §12
- Proposals A and C details (sigmoid dampener spec, late_stage_propensity scoring table) → `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` §3
- Size-class cascade (vug / pocket / cave) → `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` §3
- The full Path C cascade-gate audit (Arc 1-3 + geology audit + harness extraction) → `HANDOFF-CASCADE-GATE-AUDIT.md` §3
- Earlier principles → the three prior handoffs' §7s

**Read all four handoffs together** for the complete picture from 2026-05-12 through 2026-05-18:
1. `HANDOFF-CALIBRATION-AND-COVERAGE.md` — Backlog K + four-stale sweep
2. `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` — Proposals A + C + size-class cascade
3. `HANDOFF-CASCADE-GATE-AUDIT.md` — Path C cascade-gate audit (4 arcs + harness extraction)
4. **This doc** — Proposals B + D + habit-stability fix (high-fill physics arc CLOSED)
