# HANDOFF: Path C cascade-gate audit (4 arcs + harness extraction, geology-as-debugger)

> **Authored:** 2026-05-18 by Claude (Sonnet 4.5)
> **State at authoring:** HEAD = `0a15f9c`, SIM_VERSION 73, 238/238 tests green.
> **Continues:** `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` (terminus `72243d2`). That doc was the high-fill physics + size-class cascade arc; the open backlog item at the top of its §5 ("Path C cascade-gate audit, ~half day") is what this doc covered.
> **Status:** terminal — the next-thread items (Proposals B + D + habit-stability) were completed in the same-day session that followed. **Read `HANDOFF-HIGH-FILL-ARC-COMPLETE.md` next** for the three commits that closed the high-fill physics arc completely (`f4dae0d` + `f9456bb` + `b3cc095`, current HEAD).
> **Audience:** historical reference for the Path C cascade-gate audit. For current open backlog, see `HANDOFF-HIGH-FILL-ARC-COMPLETE.md` §5.

---

## 1. TL;DR

Four arcs + a mechanical refactor closing the Path C cascade-gate audit identified in `HANDOFF-CALIBRATION-AND-COVERAGE.md` §12. Half-day estimate landed in ~3-4 hours of work across two compact-spaced sessions.

| sha | arc | tests | live/dead |
|-----|-----|-------|-----------|
| `e9248c5` | **Arc 1** — Activity-correction copy-paste fix (4 minerals) | 226 → 226 | 89 / 27 |
| `1d66c4a` | **Arc 2** — Soft-cation-suppressor for native_arsenic + native_bismuth | 226 → 238 | 91 / 25 |
| `688bdc7` | **Geology audit** — Schneeberg broth gap-fill (Co + Ni + Ag, the missing 3 of 5 elements) | 238 → 238 | 91 / 23 |
| `0d8fab0` | **Arc 3** — 6 next-iteration targets (native_silver, native_copper structural; cobaltite, nickeline, naumannite, stibnite calibration) | 238 → 238 | 95 / 21 |
| `0a15f9c` | **Harness extraction** — `tools/_harness.mjs`, -272 lines of duplicated setup across 6 probes | 238 → 238 | 95 / 21 |

Cumulative coverage: **89 → 95 live (+6), 27 → 21 dead (-6).** SIM_VERSION 69 → 73.

The arcs were not pre-planned as a unit. The audit was framed as "soften the hard cation gates." Arc 1 emerged from a cross-check probe that surfaced an unrelated copy-paste regression. The geology audit emerged from boss-prompted "double-check the science" review of Arc 2's σ overshoot — and **resolved the overshoot WITHOUT engine retuning** by adding three elements that had been silently missing from the broth.

The session's defining moment: every time I reached for an engine knob, the boss-principle "follow nature" pointed at a chemistry-data fix instead, and the chemistry-data fix worked. Arc 3 extended this — the cobaltite + nickeline + naumannite tier was framed as "scaling denominators tuned for bulk fluid measurements, but real precipitation happens in cells 3-5× more enriched." Path C philosophy applied to scaling, not just to gates.

---

## 2. Tool chain — six probes now

The harness-extraction threshold (§7 of the prior handoff said "if a 6th tool lands, extract first") is now crossed:

| tool | signal | runtime |
|------|--------|---------|
| `tools/gen-js-baseline.mjs` | per-scenario crystal counts + sizes at seed 42 | ~30s |
| `tools/twin_rate_check.mjs` | observed twin frequency vs authored per-roll probability | ~15s |
| `tools/mineral_coverage_check.mjs` | live / stale / dead mineral classification | ~10s |
| `tools/stale_mineral_probe.mjs` | per-step σ + chemistry for stale (mineral, scenario) pairs | ~5s |
| `tools/high_fill_probe.mjs` | vugFill trajectory + growth-rate bins across all scenarios | ~5s |
| `tools/geology_check.mjs` **(NEW)** | 10-seed scenario sweep vs expected paragenesis (configurable scenario + tracked-mineral list) | ~10s |

**Each new tool was the right shape for one audit category.** `mineral_coverage_check` finds dead minerals globally. `stale_mineral_probe` traces σ per-step for a specific (mineral, scenario). `geology_check` compares a scenario's whole assemblage to the deposit class's defining paragenesis. None of them substitute for the others — the geology audit fix would not have been visible to `mineral_coverage_check` because erythrite + annabergite were technically not stale (no scenario referenced them in `expects_species`), they were just absent from the deposit class they historically defined.

**Harness extraction landed** in `0a15f9c` — `tools/_harness.mjs` exports a single `loadSimBundle()` function. Each probe opens with:

```js
import { loadSimBundle } from './_harness.mjs';
const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'my_tool' });
```

Net: each tool dropped 75-90 lines of duplicated setup (-272 lines from probes + 167 lines for harness = -105 net). Logic-to-boilerplate ratio improved substantially (`geology_check.mjs` went from 56% boilerplate to ~0%). Tool #7 just imports `loadSimBundle` — no setup required.

---

## 3. What landed, in detail

### 3.1 Arc 1 — Activity-correction copy-paste fix (`e9248c5`)

**Pattern:** four `supersaturation_X()` methods carried extra `activityCorrectionFactor(this.fluid, 'Y')` calls where Y was unrelated to X. Each extra call multiplied σ by an ≤1 factor based on the FOREIGN mineral's stoichiometry — silent ~½× suppression.

**Discovery via cross-check probe:**

```bash
# Inside Python or any AST-aware grep:
# For each `supersaturation_X() { ... activityCorrectionFactor(this.fluid, 'Y') ... }`
# block, flag any case where Y != X.
```

Four hits across 116 minerals:

| mineral | spurious extras | why it's wrong |
|---|---|---|
| `adamite` | `erythrite`, `annabergite` | Zn arsenate suppressed by Co + Ni arsenate factors |
| `borax` | `tincalconite` | paramorph — identical numerical factor → γ²·m² double-count |
| `galena` | `pyrite`, `marcasite`, `sphalerite`, `wurtzite`, `chalcopyrite` | PbS suppressed by SIX foreign sulfide factors |
| `stibnite` | `tetrahedrite`, `tennantite` | Sb₂S₃ suppressed by Cu-As/Sb sulfosalt factors |

**Origin:** the Phase 2b activity-coefficient sweep (`eff8ec1`, 2026-05-05). A mechanical sweep adding `activityCorrectionFactor` to every `supersaturation_X` method picked up unrelated mineral names from neighboring code blocks. Reviewer didn't catch the cross-naming.

**Highest-impact line of the audit:** galena. Pre-fix galena fired at seed 42 in 2 of 24 scenarios (porphyry, supergene_oxidation). **It did not fire in `mvt`** — the canonical Pb-Zn MVT scenario, named after Mississippi Valley Type lead-zinc deposits. The 6× activity stack was suppressing the canonical Pb sulfide out of its canonical scenario. Post-fix: galena fires in 6 of 24 scenarios (mvt + radioactive_pegmatite + reactive_wall + schneeberg added), total crystal count 2 → 13.

**Calibration drift:** 7 of 24 scenarios shifted; 17 byte-identical. All shifts in expected direction (less suppression → more nucleation of the affected minerals + carbonate-supergene products losing substrate to the now-firing primary sulfides). Proposal A's `vugFill ≥ 1.0` hard floor caps any overshoot.

### 3.2 Arc 2 — Soft-cation-suppressor for native_arsenic + native_bismuth (`1d66c4a`)

**Pattern (extending the native_tellurium fix from `HANDOFF-CALIBRATION-AND-COVERAGE.md` §12):** hard upper-cation gates like `if (this.fluid.S > 10) return 0` are structurally unreachable under bulk-view chemistry. Locally, S is depleted by sulfides; in the σ engine's view (`conditions.fluid` = equator-ring fluid), S stays at the seeded value through the whole run.

**Two engines fit the pattern after Arc 1 didn't lift their σ enough:**

```ts
// 36-supersat-native.ts (pre-Arc 2):
supersaturation_native_arsenic() {
  if (this.fluid.As < 5) return 0;
  if (this.fluid.S > 10.0) return 0;   // ← structurally unreachable: schneeberg S=30
  if (this.fluid.Fe > 50.0) return 0;  // ← same
  // ...
}
supersaturation_native_bismuth() {
  if (this.fluid.Bi < 15 || this.fluid.S > 12 || ...) return 0;
  // ← Bi<15 is geologically too strict (bismuthinite passes at Bi≥5)
  // ← S>12 is the structural problem
}
```

**Three-part fix:**

1. **Engine softening** (`36-supersat-native.ts`):
   - Drop hard `S > N` upper gates, replace with `s_suppr = max(0, 1 - S/Sdenom)`. Denominators tuned so schneeberg S=30 yields meaningful but non-zero suppression while porphyry S=60 stays gated out.
   - Drop hard `Fe > 50` for native_arsenic, replace with `fe_suppr = max(0, 1 - Fe/200)`.
   - Lower native_bismuth's `Bi < 15` lower gate to `Bi < 5` (matches bismuthinite's lower gate — native bismuth is bismuthinite's paragenetic step-down).
   - Tighten `as_f` / `bi_f` scaling denominators (30/25 → 15/15) and caps (3.0/2.0 → 4.0/3.0) so realistic Schneeberg-tier broths drive σ > 1.0.

2. **Nucleation threshold matching** (`86-nucleation-native.ts`):
   - native_bismuth threshold 1.4 → 1.0 (every other native_X used 1.0 or 1.2; the 1.4 was an arbitrary outlier).

3. **Scenario seed correction** (`scenarios.json5`):
   - `schneeberg.As: 15 → 60` (Förster 1992 fluid inclusions report 100-1000 ppm in arsenide phases)
   - `schneeberg.Bi: 10 → 40` (same paper: 50-500 ppm in native-bismuth-bearing phases)

**Verification — schneeberg σ probe (3 seeds × 160 steps = 480 samples):**

| metric | native_arsenic | native_bismuth |
|---|---|---|
| pre-Arc-2 σ_max | 0.000 | 0.000 |
| post-Arc-2 σ_max | 1.561 | 1.353 |
| pre-Arc-2 σ>1 count | 0/480 | 0/480 |
| post-Arc-2 σ>1 count | 57/480 | 26/480 |
| ever_nucleated post | YES | YES |

**Coverage delta:** 89 → 91 live, 27 → 25 dead.

**The σ overshoot that prompted the geology audit:** native_arsenic post-Arc-2 reached σ_max = 1.56 vs 1.0 threshold. Looked like ~30% over-tuning. Resolved by the geology audit (§3.3) — the overshoot was NOT a tuning error; it was missing competitor minerals.

### 3.3 Geology audit — Schneeberg five-element broth gap-fill (`688bdc7`)

**Trigger:** boss prompt — "double-check the science. when you follow nature everything should just fall into place unless there is a variable we have missed."

**Tool created:** `tools/geology_check.mjs`. 10-seed schneeberg sweep tracking the canonical "Fünfelementformation" assemblage:

```
mineral             seeds-firing (pre-fix)
-------------------------------------------
erythrite             0/10    ← cobalt bloom, ubiquitous
annabergite           0/10    ← Annaberg = TYPE LOCALITY
acanthite             0/10    ← Ag2S, Schneeberg's silver-era mineral
cobaltite             0/10    ← Co arsenide-sulfide
nickeline             0/10    ← Ni arsenide
naumannite            0/10    ← Ag2Se, Erzgebirge selenide-vein classic
```

**Root cause: `schneeberg.fluid` had ZERO Co, ZERO Ni, ZERO Ag.**

Schneeberg-Annaberg-Jáchymov is the type locality for the **Bi-Co-Ni-Ag-As + U "five-element formation" deposit class**. The simulator's schneeberg was running it as a one-element show — uraninite + uranyl secondaries only. The Bi era (1500s–1800s, mineral name origin "Bismutum" coined here) was partially represented after Arc 2 added native_bismuth + bismuthinite. The Ag era (1100s–1500s, Europe's primary silver source) and the Co/Ni mining era (1600s–1800s, source of the kobold/cobalt etymology) had no chemistry expression at all.

**Fix (data-only, no engine changes):**

```json5
"Co": 30,  // Burkhardt 2001 Erzgebirge fluid inclusions, Co 5-50 ppm
"Ni": 20,  // same: Ni 5-30 ppm
"Ag": 8,   // five-element-vein fluid Ag; pre-bismuth-era silver mining
```

Plus `expects_species` extended with native_bismuth + native_arsenic + erythrite + annabergite + cobaltite + nickeline (the coverage tool now flags any that go dormant in regression — diagnostic improvement).

**Post-fix 10-seed schneeberg sweep:**

| mineral | pre | post |
|---|---|---|
| erythrite | 0/10 | **10/10**, 14 crystals @ 224µm |
| annabergite | 0/10 | **10/10**, 13 crystals @ 71µm |
| acanthite | 0/10 | **10/10**, 44 crystals @ 814µm |
| autunite | 5/10, 14 | 7/10, 16 |
| zeunerite | 7/10, 12 | 7/10, 21 |
| torbernite | 5/10, 10 | 9/10, 22 |
| native_arsenic | 6/10, **18 @ 53µm** | 5/10, **7 @ 17µm** ← self-correction |
| native_bismuth | 8/10, 8 | 7/10, 7 |
| bismuthinite | 10/10, 11 | 10/10, 11 |
| uraninite | 10/10, 30 | 10/10, 30 |
| arsenopyrite | 10/10, 40 | 10/10, 40 |

**Two findings of note (both validate "follow nature"):**

1. **Arc-2 σ overshoot self-corrected.** native_arsenic crystal count + average size dropped to a "minor accessory" level matching Förster & Tischendorf 1989's paragenetic description. Why: cobaltite + nickeline + safflorite + skutterudite engines now compete for the As budget. The σ_max=1.56 reached its full nucleation rate at peak but exhausted the available As budget faster, shifting the kinetics to "occasional small crystals" — exactly the real Schneeberg paragenesis.

2. **Autunite/zeunerite "regression at seed 42" reversed itself.** Adding chemistry diversified slot competition in autunite's favor, not against it. Both went UP in firing frequency.

**Pattern observed:** when in doubt between (a) tuning engine knobs vs (b) auditing chemistry data against literature, prefer (b) first. Two consecutive cases this session where the chemistry-data fix beat what would have been the engine-knob fix.

### 3.4 Arc 3 — Next-iteration cascade-gate targets (`0d8fab0`)

The §5 next-iteration target list closed in one commit. Two tracks:

**Track A — Structural softening** (same pattern as Arc 2):

| mineral | gate dropped | new soft factor |
|---|---|---|
| `native_silver` | `S > 2.0` | `s_f = max(0, 1 - S/50)`, ag_f cap 3.0 → 4.0, nuc threshold 1.2 → 1.0 |
| `native_copper` | `S > 30` | `s_f = max(0, 1 - S/60)`, floor 0.3 → 0.0 |

**Track B — Calibration tier** (bulk-view-as-proxy-for-local):

The scaling denominators in σ formulas were calibrated against fluid-inclusion bulk concentrations — but the precipitating cell is typically 3-5× more enriched in the defining cations. Same Path C philosophy as Arc 2's gate softening, applied to scaling denominators. **Divide by 3.**

| mineral | gates | scaling |
|---|---|---|
| `cobaltite` | Co<50/As<100/S<50 → Co<20/As<30/S<20 | Co/80×As/120×S/80 → Co/25×As/35×S/25, cap 2.5→3.0 |
| `nickeline` | Ni<40/As<40 → Ni<15/As<30 | Ni/60×As/80 → Ni/15×As/30, cap 2.5→3.0 |
| `naumannite` | Ag<5/Se<1 unchanged | Ag/30×Se/5 → Ag/6×Se/1.5 |
| `stibnite` | unchanged | nuc threshold 1.2 → 1.0 (matches sibling sulfides) |

**Verification — 10-seed schneeberg sweep:**

| mineral | pre-Arc-3 | post-Arc-3 |
|---|---|---|
| native_silver | 7/10 | 6/10 (slot competition shift) |
| cobaltite | 0/10 | **10/10**, 40 crystals @ 861µm |
| nickeline | 0/10 | **10/10**, 40 crystals @ 1392µm |
| naumannite | 0/10 | **6/10**, 7 crystals @ 39µm |
| stibnite (porphyry) | NO | **YES** |
| native_arsenic | 6/10, 7 @ 17µm | 3/10, 6 @ 7µm (further self-correction) |

Coverage: **91 → 95 live, 23 → 21 dead, 2 → 0 stale** (cobaltite + nickeline cleared their v72 stale flag).

Baseline drift across 5 scenarios (bisbee, epithermal_telluride, mvt, porphyry, schneeberg), all in geologically-correct direction. mvt regained cerussite + hawleyite + selenite that Arc 1's galena-overdrive at v70 had displaced — the system found a richer equilibrium once more competitors became available. Other 19 scenarios byte-identical.

### 3.5 Harness extraction (`0a15f9c`)

Mechanical refactor — `tools/_harness.mjs` exports `loadSimBundle()`, each of the six probe tools opens with two lines instead of ~80. -272 lines across the probes + 167 lines for the harness = -105 net. No behavioral change; all six tools produce identical output post-refactor (verified via `gen-js-baseline` writes byte-identical baseline JSON, coverage check shows same 95/21, geology check shows same schneeberg sweep numbers).

---

## 4. State files

### Engine (Path C audit deliverables)

| file | purpose |
|------|---------|
| `js/30-supersat-arsenate.ts` | adamite: removed `erythrite` + `annabergite` activity-correction calls (Arc 1) |
| `js/31-supersat-borate.ts` | borax: removed `tincalconite` activity-correction call (Arc 1) |
| `js/41-supersat-sulfide.ts` | galena: removed 5 foreign activity-correction calls; stibnite: removed 2 (Arc 1); cobaltite/nickeline/naumannite: tightened scaling 3× (Arc 3) |
| `js/36-supersat-native.ts` | native_arsenic + native_bismuth: hard S/Fe upper gates softened (Arc 2); native_silver + native_copper: hard S gates softened (Arc 3) |
| `js/86-nucleation-native.ts` | native_bismuth nuc threshold 1.4 → 1.0 (Arc 2); native_silver 1.2 → 1.0 (Arc 3) |
| `js/91-nucleation-sulfide.ts` | stibnite nuc threshold 1.2 → 1.0 (Arc 3) |
| `js/15-version.ts` | SIM_VERSION 69 → 73; v70/v71/v72/v73 history notes |
| `data/scenarios.json5` | schneeberg: As 15→60, Bi 10→40 (Arc 2); +Co 30, +Ni 20, +Ag 8 (geology audit); expects_species extended with six minerals |

### Tests

| file | purpose |
|------|---------|
| `tests-js/cascade-gate-audit.test.ts` (NEW, 12 cases) | Arc 1 + Arc 2 source-inspection + nucleation pins. Hardest assertion: galena fires in ≥4 of 6 canonical Pb scenarios at seed 42 |
| `tests-js/baselines/seed42_v70.json` | Arc 1 baseline |
| `tests-js/baselines/seed42_v71.json` | Arc 2 baseline |
| `tests-js/baselines/seed42_v72.json` | Geology audit baseline |
| `tests-js/baselines/seed42_v73.json` | Arc 3 baseline (current) |

### Tools

| file | purpose |
|------|---------|
| `tools/_harness.mjs` (NEW, `0a15f9c`) | Shared `loadSimBundle()` for all six probes. Eliminates ~80 lines of duplicated jsdom + fetch-mock + DOM-stub + dist-walk setup per probe |
| `tools/geology_check.mjs` (NEW) | 10-seed scenario sweep vs expected paragenesis. Configurable scenario + tracked-mineral list. Catches deposit-class-missing-N-of-M-defining-elements gaps |
| `tools/stale_mineral_probe.mjs` | Updated PROBES array: Backlog-K-era entries commented out as Round-1 reference; six new (mineral, scenario) pairs for the cascade-gate audit (Round 2) |
| All six probe tools | Refactored in `0a15f9c` to use `loadSimBundle` from the new harness — -272 lines duplicated setup across the probes |

### Docs

| file | purpose |
|------|---------|
| `proposals/HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` | Prior handoff. §5 backlog item "Path C cascade-gate audit" now struck through with this commit chain referenced. §2 tool count 5 → 6 |

---

## 5. Open backlog

### Next-iteration cascade-gate targets

**All six named cascade-gate targets closed in Arc 3 (`0d8fab0`):**

| mineral | category | status |
|---|---|---|
| ~~native_silver~~ | structural | ✓ Arc 3: soft `s_f = max(0, 1 - S/50)`, threshold 1.2 → 1.0 |
| ~~native_copper~~ | structural | ✓ Arc 3: soft `s_f = max(0, 1 - S/60)`, floor 0.3 → 0.0 |
| ~~cobaltite~~ | calibration | ✓ Arc 3: gates lowered + scaling tightened 3×, fires 10/10 schneeberg |
| ~~nickeline~~ | calibration | ✓ Arc 3: same pattern, fires 10/10 schneeberg |
| ~~naumannite~~ | calibration | ✓ Arc 3: σ scaling Ag/6 × Se/1.5, fires 6/10 schneeberg |
| ~~stibnite~~ | calibration | ✓ Arc 3: nuc threshold 1.2 → 1.0, fires in porphyry |

**Deferred:**

| mineral | category | reason |
|---|---|---|
| `native_sulfur` | non-Path-C-pattern | Hard gates are `pH > 5` and `metal_sum > 100`, neither a depleting species in the bulk view. The engine may be roughly correct — the real gap is "no canonical scenario fires native sulfur" (fumaroles + sulfide-weathering rinds aren't represented). Wait for a fumarole / Sulphur Bank Mine / Whakaari-type scenario to land. |

### Other open items (Path C cascade-gate audit ends here — these are next-thread)

- **Proposal B** (habit transitions on fill × σ) — ~3 hours, fastest visual win from the high-fill thread, see `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` §6
- **Proposal D** (interlocking textures past vugFill ≥ 1.0) — ~1 day, fixes sabkha 2.5× / gem_pegmatite 1.5× single-step overshoots
- **Proposal E** (per-cell local fill) — ~3 days, deferred until A+B+C+D land
- **Cave-size resize** of naica/dripstones — wait for Proposal D
- **Architecture audit follow-ups** from `1541f70`
- **Harness extraction landed** in `0a15f9c` (this audit's tail commit) — no longer open

---

## 6. Verification harness

```bash
npm run ci                                  # typecheck + build:check + 238 tests
npm test                                    # vitest only
node tools/gen-js-baseline.mjs              # regen calibration baseline (after any chemistry change)
node tools/twin_rate_check.mjs              # twin frequency report
node tools/mineral_coverage_check.mjs       # live / stale / dead classification
node tools/stale_mineral_probe.mjs          # per-step σ for stale (mineral, scenario) pairs
node tools/high_fill_probe.mjs [seed]       # vugFill trajectory + growth-rate bins
node tools/geology_check.mjs                # 10-seed schneeberg-vs-five-element-paragenesis sweep
```

`geology_check.mjs` defaults to schneeberg + the five-element tracked-mineral list. Edit the `scenario` and `tracked` constants at the top of the file for other audits — e.g. bisbee + Bisbee blue+green Cu carbonate suite, or epithermal_telluride + Cripple Creek bonanza-pocket paragenesis.

Boot order if you're starting cold: `npm run build` first (the tools eval the bundle from `dist/`). Bundle takes ~5s to compile.

---

## 7. Principles refreshed

The §7 principles from the prior handoff still hold. **One new one earned this session:**

### Audit chemistry data before engine knobs

When σ for a mineral is wrong (too low, too high, doesn't fire when it geologically should), the instinct is to reach for the engine — tighten a denominator, lower a threshold, soften a gate. This session showed two cases where the right fix was DATA, not engine:

1. **Arc 1 (galena in mvt)**: σ was being suppressed by 6× activity corrections from unrelated minerals. The fix wasn't to change galena's σ formula; it was to remove the bogus extra multipliers.

2. **Geology audit (native_arsenic overshoot)**: σ peak was 1.56 vs 1.0 threshold — looked like a 30% over-tune. The fix wasn't to dial back the engine; it was to add Co + Ni to the broth so the competitor arsenide engines could consume their share of the As budget. The σ overshoot self-corrected once the competition was present.

**The rule:** before tuning an engine to make a mineral fire or stop firing, check (a) is the mineral's σ formula being multiplied by something unrelated? (b) is the deposit class's defining chemistry actually present in the broth? If either is "yes," fix that first. Engine tuning is the last resort.

**Boss principle, captured verbatim:** "when you follow nature everything should just fall into place unless there is a variable we have missed."

This composes with the **defer-to-geology** principle from the user-memory file: real-world chemistry is load-bearing in vugg-simulator design tradeoffs. The cascade-gate audit's four arcs each ended with the geologically-correct answer being the simpler answer. Don't out-engineer geology.

---

## 8. What this session was

Half-day estimated, ~3-4 hours actual across two compact-spaced sessions, five commits, 238/238 tests green throughout. The audit was framed as "soften hard cation gates" and ended up touching three categories of fix plus a refactor:

- **Structural** (Arc 1 copy-paste + Arc 2 / Arc 3 hard S/Fe gates): the engines literally couldn't reach their fire conditions under bulk-view chemistry. Surgical fixes.
- **Calibration** (Arc 3 scaling tier): denominators tuned for fluid-inclusion bulk measurements while the precipitating cell is 3-5× more enriched. Same Path C philosophy applied to scaling instead of gates.
- **Chemistry data** (geology audit): the broth was missing variables that a literature review would have caught instantly.
- **Infrastructure** (`0a15f9c` harness extraction): mechanical refactor closing a long-standing TODO.

The chemistry-data fix (geology audit) was the prettiest because it required ZERO engine changes — just three numbers in `scenarios.json5` — and it cleaned up multiple downstream concerns at once (native_arsenic overshoot, autunite seed-42 regression, erythrite + annabergite + acanthite all firing).

The boss intervention at the right moment (post-Arc-2, before I started "dial back native_arsenic") shifted the framing from "verify my Arc 2 was right" to "verify the science" — and that reframe was load-bearing. A self-review without that nudge would have led to engine knob-twisting and missed the broth gap entirely.

Cumulative deliverable from `72243d2 → 0a15f9c`:

  | metric | before | after | delta |
  |---|---|---|---|
  | SIM_VERSION | 69 | 73 | +4 |
  | tests | 226 | 238 | +12 |
  | live minerals | 89 | 95 | +6 |
  | dead minerals | 27 | 21 | -6 |
  | stale minerals | 0 | 0 | 0 |
  | probe tools | 5 | 6 + harness | +1 + extract |

Good seat to compact from.

---

## 9. Closing — what's NOT in this handoff

Things deliberately omitted because the prior handoffs cover them:

- The Backlog K vugFill cap discovery + fix → `HANDOFF-CALIBRATION-AND-COVERAGE.md` §5
- The four original stale-mineral retunes (adamite / chrysoprase / ruby / native_tellurium) → `HANDOFF-CALIBRATION-AND-COVERAGE.md` §12
- Proposals A/B/C/D/E for high-fill physics → `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` §3 and `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md`
- Size-class cascade (vug / pocket / cave) → `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` §3
- The compose-cleanly architecture + size-class-orthogonal-to-architecture + text-mode-bulk-edits principles → `HANDOFF-HIGH-FILL-AND-SIZE-CLASS.md` §7

Read all three handoffs together for the complete picture from 2026-05-12 through 2026-05-18 — calibration + coverage (HANDOFF-CALIBRATION-AND-COVERAGE), then high-fill + size-class (HANDOFF-HIGH-FILL-AND-SIZE-CLASS), then this one (cascade-gate audit + geology-as-debugger).
