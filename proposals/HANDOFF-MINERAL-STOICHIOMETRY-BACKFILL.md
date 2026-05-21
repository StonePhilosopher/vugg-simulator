# HANDOFF: MINERAL_STOICHIOMETRY backfill — active-firing subset

**Author:** builder
**Date:** 2026-05-21
**Status:** Deferred follow-up (post-v120)
**Predecessor:** v120 inactive-subset commit (22 minerals, zero baseline drift)
**Related:** PROPOSAL-EVENT-DRIVEN-PRECIPITATION.md, v109 RNG-cascade antipattern (boss memory rule)

---

## TL;DR

28 mineral engines that fire in current baseline scenarios lack a `MINERAL_STOICHIOMETRY` entry. Adding them — the obvious fix — would immediately start debiting the fluid for those minerals' growth, which cascades through 16 of 30 scenarios and breaks 4 pre-existing paragenesis-pin tests. Each mineral's addition needs scenario tune calibration to keep canonical paragenesis intact.

This document maps every deferred mineral to the scenarios it fires in, the canonical paragenesis-pin tests it affects, and the tune priority. Use it as the menu for per-scenario tune commits (v121+).

---

## How this happened

`js/19-mineral-stoichiometry.ts` header says "Default flag OFF — these values do not affect any scenario until the calibration pass flips the flag." That comment is stale. `js/18-constants.ts:39` has `const MASS_BALANCE_ENABLED = true;` and has had it true for a long time. So minerals that LACK stoichiometry ship as silent free-energy gifts: their growth doesn't debit the fluid, so supersaturation never depletes from their own consumption.

The v118 (TN457) commit's gen-baseline log surfaced the warnings (`[mass-balance] no stoichiometry for X — growth will not debit fluid composition`) but those warnings were treated as cosmetic for years. v120's first attempt (`83758fb` in pre-revert WIP, never committed) added all 45 missing entries in one commit, which immediately fluid-debited engines like chrysotile, diopside, grossular for the first time and shifted the rng cascade across 16 scenarios. Rolled back same day; the v120 commit that landed only covers the 22 inactive-in-baselines entries.

---

## The 27 deferred minerals, grouped by tune-priority

### Priority 1 — Jeffrey rodingite arc (v110–v115)

These fire in `jeffrey_mine` and are canonical to the rodingite paragenesis the Bernardini 1981 paper documents. The jeffrey-mine.test.ts pins them.

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| chrysotile | Mg3Si2O5(OH)4 | `{ Mg: 3, SiO2: 2 }` | jeffrey_mine, ultramafic_supergene |
| brucite | Mg(OH)2 | `{ Mg: 1 }` | jeffrey_mine |
| awaruite | Ni2-3Fe (intermetallic) | `{ Ni: 2.5, Fe: 1 }` | jeffrey_mine |
| diopside | CaMgSi2O6 | `{ Ca: 1, Mg: 1, SiO2: 2 }` | jeffrey_mine, marble_contact_metamorphism |
| grossular | Ca3Al2(SiO4)3 | `{ Ca: 3, Al: 2, SiO2: 3 }` | jeffrey_mine, marble_contact_metamorphism |
| vesuvianite | Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4 | `{ Ca: 10, Mg: 1, Fe: 1, Al: 4, SiO2: 9 }` | jeffrey_mine, marble_contact_metamorphism |
| wollastonite | CaSiO3 | `{ Ca: 1, SiO2: 1 }` | jeffrey_mine, marble_contact_metamorphism |
| prehnite | Ca2Al2Si3O10(OH)2 | `{ Ca: 2, Al: 2, SiO2: 3 }` | jeffrey_mine |
| pectolite | NaCa2Si3O8(OH) | `{ Na: 1, Ca: 2, SiO2: 3 }` | jeffrey_mine |
| datolite | CaB(SiO4)(OH) | `{ Ca: 1, B: 1, SiO2: 1 }` | jeffrey_mine |
| tremolite | Ca2Mg5Si8O22(OH)2 | `{ Ca: 2, Mg: 5, SiO2: 8 }` | jeffrey_mine |
| actinolite | Ca2(Mg,Fe)5Si8O22(OH)2 | `{ Ca: 2, Mg: 4, Fe: 1, SiO2: 8 }` | jeffrey_mine |

**Tune note (Jeffrey):** the per-stage events already release Mg/Ca/Si/Al at specific steps. Mass-balanced growth will consume those releases faster than the current free-energy model. Likely tune: bump per-event chemistry deltas ~30–50% to compensate, or tune the `defaultSteps` per stage.

### Priority 2 — Cumbria Pb-Zn-Ba-F supergene (Roughten Gill + Force Crag style)

These fire in `roughten_gill` and tn457_barite_pulses' cascade extras. The roughten-gill.test.ts paragenesis pins are the most-tested in the project.

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| caledonite | Pb5Cu2(CO3)(SO4)3(OH)6 | `{ Pb: 5, Cu: 2, CO3: 1, S: 3 }` | roughten_gill |
| plumbogummite | PbAl3(PO4)2(OH)5·H2O | `{ Pb: 1, Al: 3, P: 2 }` | roughten_gill |
| pharmacolite | CaHAsO4·2H2O | `{ Ca: 1, As: 1 }` | schneeberg |
| proustite | Ag3AsS3 | `{ Ag: 3, As: 1, S: 3 }` | roughten_gill, schneeberg, sunnyside_american_tunnel |

**Tune note (Roughten Gill):** the existing v107 broth was already cation-budget-stressed (v109 antipattern dogfood). Adding stoichiometry will hit it hard. Probably needs Pb/Cu/As bumps in the initial broth.

### Priority 3 — Tsumeb supergene + adjacent

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| dioptase | CuSiO3·H2O | `{ Cu: 1, SiO2: 1 }` | supergene_oxidation |
| willemite | Zn2SiO4 | `{ Zn: 2, SiO2: 1 }` | supergene_oxidation, tn457_barite_pulses |
| conichalcite | CaCu(AsO4)(OH) | `{ Ca: 1, Cu: 1, As: 1 }` | supergene_oxidation, bisbee, schneeberg |
| duftite | PbCu(AsO4)(OH) | `{ Pb: 1, Cu: 1, As: 1 }` | supergene_oxidation, schneeberg |
| koettigite | Zn3(AsO4)2·8H2O | `{ Zn: 3, As: 2 }` | supergene_oxidation |
| metacinnabar | HgS | `{ Hg: 1, S: 1 }` | sulphur_bank |

### Priority 4 — Schneeberg + Colorado Plateau uranyl

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| uranophane | Ca(UO2)2(SiO3)2(OH)2·5H2O | `{ Ca: 1, U: 2, SiO2: 2 }` | schneeberg, colorado_plateau |

### Priority 5 — Naica, gem pegmatite, secondary firings

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| cassiterite | SnO2 | `{ Sn: 1 }` | gem_pegmatite, ouro_preto |
| lepidolite | K(Li,Al)3(Al,Si)4O10(F,OH)2 | `{ K: 1, Li: 2, Al: 2, SiO2: 3, F: 1.5 }` | gem_pegmatite |
| opal | SiO2·nH2O | `{ SiO2: 1 }` | many (silica gel pseudomorph paths) |
| pyrolusite | MnO2 | `{ Mn: 1 }` | supergene_oxidation, naica_geothermal, sulphur_bank |
| tigers_eye | SiO2 (after crocidolite) | `{ SiO2: 1, Fe: 0.5 }` | (none in baseline; supergene-style scenarios) |

---

## Recommended sequencing

1. **One-scenario-at-a-time tune commits.** Start with Jeffrey (highest narrative value + best-tested). Add the 12 Priority 1 minerals + tune `jeffrey_mine` events until paragenesis pins pass + species counts match the v115 baseline within ±10%. Commit. Move to Roughten Gill. Repeat.
2. **Each tune commit is Jeffrey-sized** — 30–60 minutes of probe-diagnose-adjust per scenario.
3. **DO NOT batch.** v109 + abandoned v120 prove that multiple-stoichiometry additions in one commit cascade unpredictably. One mineral or one scenario per commit.
4. **The DEFERRED_TUNE_REQUIRED list** in `tests-js/mineral-stoichiometry-coverage.test.ts` enforces this: any addition to MINERAL_STOICHIOMETRY for a mineral on the list MUST be accompanied by removing the mineral from the deferred list AND updating the per-scenario paragenesis pins.

---

## Why this isn't blocking

The current free-energy gift is genuinely a chemistry violation, but it's been the actual behavior since the mass-balance machinery shipped. No scenario currently relies on the violation; they were all calibrated under it. Fixing it is correctness improvement, not bug repair. The disciplined increments per `feedback_refactor_vs_content_sequencing.md` apply: ship content on stable infra first.

The agent-friendly interface (v117), TN457 scenario (v118), trace_Mn audit (v119), and inactive-subset stoichiometry (v120) are all stable. Per-zone color rendering (Rock Bot's visual-diff sub-arc) is the higher-narrative-value next move. This backfill can wait.

---

## See also

- `js/15-version.ts` v120 block — predecessor commit doc
- `js/18-constants.ts:39` — `MASS_BALANCE_ENABLED = true`
- `js/19-mineral-stoichiometry.ts` header — file convention rules
- `tests-js/mineral-stoichiometry-coverage.test.ts` — DEFERRED_TUNE_REQUIRED list enforcement
- boss memory: `feedback_complementary_blindness.md`, `feedback_keep_going_pattern.md`,
  `feedback_refactor_vs_content_sequencing.md`
