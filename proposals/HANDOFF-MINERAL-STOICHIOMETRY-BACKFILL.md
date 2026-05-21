# HANDOFF: MINERAL_STOICHIOMETRY backfill — active-firing subset

**Author:** builder
**Date:** 2026-05-21
**Status:** Deferred follow-up (post-v120)
**Predecessor:** v120 inactive-subset commit (22 minerals, zero baseline drift)
**Related:** PROPOSAL-EVENT-DRIVEN-PRECIPITATION.md, v109 RNG-cascade antipattern (boss memory rule)

---

## TL;DR

**v123 UPDATE (2026-05-21):** Priority 1 (Jeffrey rodingite arc) COMPLETED. 11 of 12 P1 minerals shipped with event-chemistry tune in `js/70r-jeffrey-mine.ts`. Pectolite remains deferred.

**v124 UPDATE (2026-05-21):** Priority 2 (Cumbria) PARTIAL — pharmacolite only. Caledonite + plumbogummite + proustite stoichiometry additions ALL trigger Shape-B RNG-cascade displacement in roughten_gill that breaks the brochantite/caledonite/plumbogummite paragenesis pins. Even adding proustite alone (Ag+As+S mass balance) ripples through the cascade. Confirmed by direct probe: shipped just pharmacolite (schneeberg-only mineral, no roughten_gill interaction). 16 minerals still on the DEFERRED list.

**v125 UPDATE (2026-05-21):** Cascade-probe arc across P3 Tsumeb + P5 secondary. **Two shipped (metacinnabar + opal); six probed and reverted with empirical cascade-mechanism findings.** 14 minerals still on the DEFERRED list.

The key refinement to the cascade-mechanism understanding:

> **It's not magnitude, it's edge-of-gate displacement.** A debit's effect on the rng cascade is determined by whether the σ recalc after the debit shifts any edge-of-gate mineral across its nucleation threshold. Minerals with unique cations (or cations already saturated by other firing minerals' debits) are safe — the rng draws don't change. Minerals competing for cations with multiple already-firing minerals cascade — even at sub-percent magnitude.

Empirical evidence from the v125 arc:
- **metacinnabar PASS**: Hg in sulphur_bank already debited by cinnabar; new debit just tightens budget. 29 of 30 scenarios byte-identical.
- **opal PASS**: SiO2-only across 6 scenarios with SiO2 broths 200-8000 ppm. Debit <0.01% of budget. **All 6 firing scenarios byte-identical to v124.**
- **dioptase CASCADE**: 1 crystal × 85 µm Cu+SiO2 debit in schneeberg dropped pharmacolite (v124-shipped!) and added haidingerite. 12+ mineral count shifts.
- **pyrolusite CASCADE**: Mn debit in bisbee (Mn=4 initial vs ~14 ppm pyrolusite debit) dropped turquoise + added 5 new species.
- **tigers_eye CASCADE**: SiO2-only OK; SiO2+Fe-trace NOT — Fe coeff 0.5 cascaded deccan_zeolite.
- **cassiterite CASCADE**: clean in gem_pegmatite + schneeberg, cascaded in radioactive_pegmatite (anglesite + goethite dropped, topaz 4→2). 2-of-3 near-miss.
- **koettigite CASCADE**: dense supergene_oxidation As-arsenate suite — 19 count breaks including dropping pharmacolite (v124-shipped!) and adding raspite.

(Original v120 framing) 28 mineral engines that fire in current baseline scenarios lack a `MINERAL_STOICHIOMETRY` entry. Adding them — the obvious fix — would immediately start debiting the fluid for those minerals' growth, which cascades through 16 of 30 scenarios and breaks pre-existing paragenesis-pin tests. Each mineral's addition needs scenario tune calibration to keep canonical paragenesis intact.

This document maps every deferred mineral to the scenarios it fires in, the canonical paragenesis-pin tests it affects, and the tune priority. Use it as the menu for per-scenario tune commits (v121+).

---

## How this happened

`js/19-mineral-stoichiometry.ts` header says "Default flag OFF — these values do not affect any scenario until the calibration pass flips the flag." That comment is stale. `js/18-constants.ts:39` has `const MASS_BALANCE_ENABLED = true;` and has had it true for a long time. So minerals that LACK stoichiometry ship as silent free-energy gifts: their growth doesn't debit the fluid, so supersaturation never depletes from their own consumption.

The v118 (TN457) commit's gen-baseline log surfaced the warnings (`[mass-balance] no stoichiometry for X — growth will not debit fluid composition`) but those warnings were treated as cosmetic for years. v120's first attempt (`83758fb` in pre-revert WIP, never committed) added all 45 missing entries in one commit, which immediately fluid-debited engines like chrysotile, diopside, grossular for the first time and shifted the rng cascade across 16 scenarios. Rolled back same day; the v120 commit that landed only covers the 22 inactive-in-baselines entries.

---

## The 27 deferred minerals, grouped by tune-priority

### Priority 1 — Jeffrey rodingite arc (v110–v115) — **COMPLETED v123**

✅ **11 of 12 minerals shipped in v123.** chrysotile, brucite, awaruite, diopside, grossular, vesuvianite, wollastonite, prehnite, datolite, tremolite, actinolite all added to MINERAL_STOICHIOMETRY with event-chemistry tune in `js/70r-jeffrey-mine.ts`. Paragenesis pins all pass.

**Tune approach taken:** the original Jeffrey events used `Math.max(floor, fluid.X - decrement)` patterns that HAND-MODELED consumption (because stoichiometry was missing). With v123's stoichiometry on, those decrement lines were double-debiting. Fix: flip all consumption-pattern lines to RELEASE-pattern lines, bump release magnitudes across 35-step inter-event intervals, lift caps where mass balance creates more headroom-pressure. Net: 3 scenarios drifted (jeffrey_mine, deccan_zeolite, marble_contact_metamorphism); test pins all pass.

**Pectolite STILL DEFERRED** — fires intermittently across v118-v122 transitions, sensitive to the late_ca_silicates Na/Ca window. Needs a targeted tune that bumps Na release while keeping the existing Na cap pectolite-permissive. Should be doable as a follow-up commit.

| Mineral | Formula | Stoichiometry | Status |
|---|---|---|---|
| chrysotile | Mg3Si2O5(OH)4 | `{ Mg: 3, SiO2: 2 }` | ✅ v123 |
| brucite | Mg(OH)2 | `{ Mg: 1 }` | ✅ v123 |
| awaruite | Ni2-3Fe (intermetallic) | `{ Ni: 2.5, Fe: 1 }` | ✅ v123 |
| diopside | CaMgSi2O6 | `{ Ca: 1, Mg: 1, SiO2: 2 }` | ✅ v123 |
| grossular | Ca3Al2(SiO4)3 | `{ Ca: 3, Al: 2, SiO2: 3 }` | ✅ v123 |
| vesuvianite | Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4 | `{ Ca: 10, Mg: 1, Fe: 1, Al: 4, SiO2: 9 }` | ✅ v123 |
| wollastonite | CaSiO3 | `{ Ca: 1, SiO2: 1 }` | ✅ v123 |
| prehnite | Ca2Al2Si3O10(OH)2 | `{ Ca: 2, Al: 2, SiO2: 3 }` | ✅ v123 |
| **pectolite** | NaCa2Si3O8(OH) | `{ Na: 1, Ca: 2, SiO2: 3 }` | ⚠️ DEFERRED — needs Na-window tune |
| datolite | CaB(SiO4)(OH) | `{ Ca: 1, B: 1, SiO2: 1 }` | ✅ v123 |
| tremolite | Ca2Mg5Si8O22(OH)2 | `{ Ca: 2, Mg: 5, SiO2: 8 }` | ✅ v123 |
| actinolite | Ca2(Mg,Fe)5Si8O22(OH)2 | `{ Ca: 2, Mg: 4, Fe: 1, SiO2: 8 }` | ✅ v123 |

**Drift accepted in v123:** marble_contact_metamorphism lost tremolite; deccan_zeolite lost prehnite. No test pin broke. Could be restored with per-scenario follow-up tunes if needed.

### Priority 2 — Cumbria Pb-Zn-Ba-F supergene — **PARTIAL v124 (1 of 4)**

✅ **Pharmacolite shipped v124** — fires in schneeberg only, doesn't touch roughten_gill cascade.

⚠️ **3 of 4 STILL DEFERRED** — caledonite, plumbogummite, proustite all trigger Shape-B RNG-cascade displacement in roughten_gill when their stoichiometry is added. Confirmed via direct probe:
- Adding all 4 → brochantite/caledonite/plumbogummite drop from roughten_gill paragenesis
- Adding just proustite → same drop (Ag+As+S mass balance ripples globally)
- Generous Pb releases (initial 70 + event boosts to ~340 ppm total) didn't restore them
- This is the same structural displacement the `js/70q-roughten-gill.ts` file-level comment already documents for linarite

**Path forward for the 3 deferred:** needs dedicated nucleation-cap or class-iterator-order changes. Per the v122 Q7 initiative-variable framing in PROPOSAL-SPECIMEN-OBJECT.md, this is exactly the "competition for solutes" architectural question — these scenarios depend on per-step rng-cascade ordering that mass balance subtly perturbs. Out of scope for tune-only commits.

| Mineral | Formula | Stoichiometry | Status |
|---|---|---|---|
| pharmacolite | CaHAsO4·2H2O | `{ Ca: 1, As: 1 }` | ✅ v124 |
| caledonite | Pb5Cu2(CO3)(SO4)3(OH)6 | `{ Pb: 5, Cu: 2, CO3: 1, S: 3 }` | ⚠️ DEFERRED — rng cascade |
| plumbogummite | PbAl3(PO4)2(OH)5·H2O | `{ Pb: 1, Al: 3, P: 2 }` | ⚠️ DEFERRED — rng cascade |
| proustite | Ag3AsS3 | `{ Ag: 3, As: 1, S: 3 }` | ⚠️ DEFERRED — Ag+As+S debit ripples |

### Priority 3 — Tsumeb supergene + adjacent — **PARTIAL v125 (1 of 6)**

✅ **Metacinnabar shipped v125** — fires in sulphur_bank only; cinnabar already debits Hg from the same fluid so the new debit just tightens an existing budget.

⚠️ **5 of 6 STILL DEFERRED** — dioptase + koettigite proven to cascade via direct probe (see v125 commentary above); willemite, conichalcite, duftite extrapolated to cascade via the same edge-of-gate displacement pattern (multi-cation stoichiometry into already-competed-for cation budgets).

| Mineral | Formula | Stoichiometry | Status |
|---|---|---|---|
| dioptase | CuSiO3·H2O | `{ Cu: 1, SiO2: 1 }` | ⚠️ DEFERRED — schneeberg cascade (v125 probe) |
| willemite | Zn2SiO4 | `{ Zn: 2, SiO2: 1 }` | ⚠️ DEFERRED — roughten_gill cascade extrapolated |
| conichalcite | CaCu(AsO4)(OH) | `{ Ca: 1, Cu: 1, As: 1 }` | ⚠️ DEFERRED — supergene_oxidation cascade extrapolated |
| duftite | PbCu(AsO4)(OH) | `{ Pb: 1, Cu: 1, As: 1 }` | ⚠️ DEFERRED — supergene+schneeberg cascade |
| koettigite | Zn3(AsO4)2·8H2O | `{ Zn: 3, As: 2 }` | ⚠️ DEFERRED — supergene_oxidation cascade (v125 probe) |
| metacinnabar | HgS | `{ Hg: 1, S: 1 }` | ✅ v125 |

### Priority 4 — Schneeberg + Colorado Plateau uranyl

| Mineral | Formula | Stoichiometry candidate | Affected scenarios |
|---|---|---|---|
| uranophane | Ca(UO2)2(SiO3)2(OH)2·5H2O | `{ Ca: 1, U: 2, SiO2: 2 }` | schneeberg, colorado_plateau |

### Priority 5 — Naica, gem pegmatite, secondary firings — **PARTIAL v125 (1 of 5)**

✅ **Opal shipped v125** — SiO2-only debit across 6 scenarios (deccan_zeolite, naica_geothermal, ouro_preto, radioactive_pegmatite, schneeberg, ultramafic_supergene). SiO2 broths 200-8000 ppm vs opal max_um 5-36 µm = debit <0.01% of budget. All 6 firing scenarios byte-identical to v124.

⚠️ **4 of 5 STILL DEFERRED** — cassiterite (radioactive_pegmatite cascade, 2-of-3 near-miss), pyrolusite (bisbee cascade, Mn-budget exhaustion), tigers_eye (deccan_zeolite cascade — Fe trace is the differentiator from clean opal). lepidolite untested; expected to cascade given 5-cation stoichiometry into pegmatite scenarios that already cascaded for cassiterite.

| Mineral | Formula | Stoichiometry | Status |
|---|---|---|---|
| cassiterite | SnO2 | `{ Sn: 1 }` | ⚠️ DEFERRED — radioactive_pegmatite cascade (v125 probe) |
| lepidolite | K(Li,Al)3(Al,Si)4O10(F,OH)2 | `{ K: 1, Li: 2, Al: 2, SiO2: 3, F: 1.5 }` | ⚠️ DEFERRED — 5-cation, pegmatite cascade extrapolated |
| opal | SiO2·nH2O | `{ SiO2: 1 }` | ✅ v125 |
| pyrolusite | MnO2 | `{ Mn: 1 }` | ⚠️ DEFERRED — bisbee Mn-budget cascade (v125 probe) |
| tigers_eye | SiO2 (after crocidolite) | `{ SiO2: 1, Fe: 0.5 }` | ⚠️ DEFERRED — Fe-trace cascade (v125 probe) |

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
