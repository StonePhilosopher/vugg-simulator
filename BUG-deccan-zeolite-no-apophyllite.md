# Bug Report: deccan_zeolite scenario doesn't fire apophyllite (its namesake mineral)

**Status:** ✅ RESOLVED and re-verified 2026-08-15 against SIM 266. Stage III
uses the +600 ppm SiO₂ pulse in `js/70h-deccan-zeolite.ts`; the scenario
contract expects apophyllite, and authenticated seed-42 evidence records its
first appearance at step 110.
Paths in this file were updated off pre-flatten / Python-only cites
during the 2026-08-15 canonical-main audit.

**Date:** 2026-05-02
**Surfaced by:** v18 scenario species-expectation work (commit `2d977fa`)
**Severity:** Scenario fails its design intent — anchor mineral never nucleates *(fixed)*

---

## 2026-08-15 audit (post-flatten paths)

| Check | Result |
|---|---|
| Stage III handler | `js/70h-deccan-zeolite.ts` `event_deccan_zeolite_apophyllite_stage_iii`: `c.fluid.SiO2 += 600` (comment notes bump from 300) |
| Generated bundle | `index.html` contains the same `SiO2 += 600` Stage III pulse |
| Scenario contract | `data/scenarios.json5` `deccan_zeolite.expects_species` includes `"apophyllite"` |
| Live verification | `npx vitest run tests-js/boss-edits-audit.test.ts tests-js/apophyllite-green.test.ts` — **22 passed**, including `deccan_zeolite scenario nucleates apophyllite at seed 42` and green-Poona apophyllite growth |

Historical Python `vugg.py` line cites in the body below are obsolete for the browser runtime; current event source is `js/70h-deccan-zeolite.ts`.

---

## Summary

The `deccan_zeolite` scenario is anchored to the Nashik "bloody apophyllite" type expression and explicitly named for apophyllite (`Deccan Apophyllite Vesicle`). Its `description` promises "pseudo-cubic apophyllite" and its event timeline includes a dedicated `apophyllite_stage_iii` event. But at seed-42 (and likely many other seeds), apophyllite **never nucleated** *(as of the 2026-05-02 report)*.

Then (v17, seed-42):
```
['albite', 'goethite', 'hematite', 'magnetite', 'quartz', 'siderite']
```

Should fire (and now does at seed-42 per tests):
```
[..., 'apophyllite']  ← the namesake of the entire scenario
```

## Root cause: SiO2 depleted below apophyllite gate before Stage III event

`supersaturation_apophyllite` requires `SiO2 >= 800` among its hard gates. The deccan_zeolite scenario starts with SiO2=900 and adds:
- Stage I (step 20): SiO2 += 400 → 1300
- Stage II (step 70): SiO2 += 200 → 1500 (cumulative)
- Stage III (step 110): SiO2 += 300 → expected 1800 *(old pulse; now +600)*

But background quartz growth (which uses the Fournier & Potter 1982 silica_equilibrium table since v17, much more accurate than the pre-v17 `50*exp(0.008*T)` formula) depletes SiO2 aggressively. Actual trajectory at seed-42 *(pre-fix)*:

```
step=  0   T=248  K=2   Ca=180  SiO2=900   F=1   σ_apo=0  (K, F below gates)
step= 20   T=197  K=2   Ca=180  SiO2=1266  F=1   σ_apo=0  (after silica veneer; K,F still below gates)
step= 70   T=128  K=12  Ca=260  SiO2=756   F=1   σ_apo=0  (after Stage II; F still below)
step=110   T=147  K=37  Ca=310  SiO2=472   F=5   σ_apo=0  (after Stage III; SiO2 BELOW 800 GATE)
step=199   T=25   K=37  Ca=310  SiO2=10    F=5   σ_apo=0  (final state — SiO2 fully depleted)
```

**The K + F + pH + T gates all pass after Stage III. But SiO2 has already been pulled down to 472 ppm by quartz, well below the 800 ppm apophyllite requires.** Stage III's old +300 SiO2 pulse only brought it to ~772 — still under the gate.

Pre-v17, Python's quartz supersat used `50 * exp(0.008*T)` which overestimated equilibrium SiO2 by ~3x at high T. Quartz didn't fire as aggressively, SiO2 stayed elevated, apophyllite could nucleate after Stage III. The v17 silica correction (Fournier & Potter 1982 / Rimstidt 1997 tabulated solubility) is geologically correct but exposed this scenario's quiet dependency on the wrong formula.

## Fix options

### Option A (cleanest): bump Stage III SiO2 pulse — ✅ LANDED

In `event_deccan_zeolite_apophyllite_stage_iii` (`js/70h-deccan-zeolite.ts`):
```javascript
c.fluid.SiO2 += 600;  // was 300
```
Bumping to +600 lands SiO2 with headroom above the 800 gate. Apophyllite gets time to nucleate before background quartz consumption pulls it back below the gate.

### Option B: bump initial SiO2 in scenario JSON — not used as the primary fix

`data/scenarios.json5` deccan_zeolite initial fluid — left alone for this resolution path.

### Option C: lower apophyllite's SiO2 gate — not recommended / not used

## Verification after fix

The Python commands below belonged to the retired pre-browser harness and are
kept only as historical root-cause context. Current verification is Node-only:

```bash
npm test -- --file tests-js/deccan-paragenesis.test.ts
npm test -- --file tests-js/scenario-expectation-contracts.test.ts
```

Then add `apophyllite` to `expects_species` in `data/scenarios.json5`:
```json5
"expects_species": ["hematite", "quartz", "magnetite", "apophyllite"],
```

The Node scenario-contract test and authenticated seed-42 evidence codify the
fix and prevent future regression.

`apophyllite` is already present in `expects_species` in
`data/scenarios.json5`; the snippet above records the shape of the fix.

## Related: the "bloody apophyllite" phantom inclusion mechanic

The scenario is also designed for hematite-needle phantoms inside apophyllite (the Nashik diagnostic). With apophyllite nucleating again, the phantom host exists; green Poona V⁴⁺ colour dispatch is separately pinned in `tests-js/apophyllite-green.test.ts`.

## Priority

~~Medium.~~ Resolved.

## Why this surfaced (historical)

Pre-v17, Python's silica_equilibrium overshoot kept SiO2 elevated, masking the fact that the Stage III pulse was undersized relative to the apophyllite gate. The v17 silica reconciliation made quartz consumption physically realistic, which exposed the gap.
