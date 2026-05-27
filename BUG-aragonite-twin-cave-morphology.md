# Bug Report: Twinned Cave Aragonite Renders as Smooth Pseudo-Hex Column (Wrong)

**Date:** 2026-05-27
**Reported by:** Boss (called out scoping decision as model-vs-science gap during v156 commit review)
**Severity:** Model accuracy — current behavior is geologically incorrect for one mineral × growth-environment combination

---

## Description

Twinned air-mode aragonite (`mineral='aragonite'` + `twinned=true` + `growth_environment='air'`) currently renders as the smooth `aragonite_pseudohex_twin` column primitive in both the Three.js (`99i`) and wireframe (`99d`) renderers. This is **correct for fluid-mode aragonite** (metamorphic, sea-floor cement, hydrothermal vent settings) where smooth pseudo-hex column morphology dominates.

It is **incorrect for CAVE aragonite**. Per Hill & Forti 1997 *Cave Minerals of the World* (§5.3.4, §10), cave aragonite — even when bearing the cyclic-sextet twin law structurally — manifests visually as **radiating acicular sprays / frostwork**, not as smooth pseudo-hex columns. Real-world examples: Frasassi Cave (Italy), Carlsbad Caverns (NM), Wind Cave (SD), Lechuguilla, and dozens of other cave systems globally.

The structural twin operation is still present at the crystallographic level — it just doesn't manifest as a smooth column at typical cave growth conditions (low T, low supersaturation, vapor-deposition driven). The 6-fold pseudo-hex symmetry shows up as a 6-fold radiating frostwork *cluster of needles*, not as a 6-faceted column.

## Why this slipped past v156

v156 ("aragonite frostwork primitive") added the dedicated `aragonite_frostwork` geometry and routed **non-twinned** air-mode aragonite through it. The override was scoped to `!twinned` specifically to avoid touching:

- `js/99d-renderer-wireframe.ts` — `_lookupCrystalPrimitive` has the parallel twin-override hierarchy
- `js/99c-renderer-primitives.ts` — would need a new `PRIM_ARAGONITE_FROSTWORK` 2D primitive
- `tests-js/aragonite-pseudohex-twin.test.ts` — wireframe-side test that asserts twin beats dripstone

The scoping decision was framed at the time as "scope control" — it preserved existing tests and limited the patch surface. But the boss correctly called out that the framing was wrong: the model still produces a geologically incorrect output for twinned cave aragonite, and "scope control" doesn't excuse that. The right framing is "model gap with deferred fix."

## Files involved

**Three.js renderer (current behavior):**
- `js/99i-renderer-three.ts` — `_resolveCrystalGeomToken` lines ~637-680. The aragonite air-mode override fires only for `!twinned`. To fix: remove the `!twinned` condition (or hoist the aragonite air-mode check ABOVE the twin-override branches entirely).
- `js/99i-renderer-three.ts` — `_buildHabitGeom` already has `case 'aragonite_frostwork'`; no change needed there.

**Wireframe renderer (parallel work needed):**
- `js/99d-renderer-wireframe.ts` — `_lookupCrystalPrimitive` ~lines 18-87. Needs a parallel air-mode aragonite branch routing to a new `PRIM_ARAGONITE_FROSTWORK` constant.
- `js/99c-renderer-primitives.ts` — define `PRIM_ARAGONITE_FROSTWORK` as a 2D primitive (the wireframe equivalent of the Three.js frostwork geometry — radiating spray pattern projected to the canvas).

**Tests:**
- `tests-js/aragonite-pseudohex-twin-three.test.ts` — line ~138 asserts `twinned aragonite in air-mode cavity → twin token (beats dripstone)`. This test currently encodes the WRONG behavior and will need updating when the fix lands. The test should read: twinned aragonite in air mode → `aragonite_frostwork`; twinned aragonite in fluid mode → `aragonite_pseudohex_twin`.
- `tests-js/aragonite-pseudohex-twin.test.ts` — line ~168 has the wireframe-side counterpart of the same incorrect assertion. Same fix needed when wireframe parity ships.
- `tests-js/habit-bias.test.ts` — `stalactite_demo` test currently has a conditional branch (`if (!c.twinned) ... else ...`). When the bug is fixed, both branches collapse to `expect(resolved).toBe('aragonite_frostwork')`.

## Proper fix (when scheduled)

1. **In `js/99i-renderer-three.ts`:** change the air-mode aragonite override from `!crystal.twinned` to unconditional. Move the check above the twin-override branches so it fires regardless of twin state in air mode.

2. **In `js/99c-renderer-primitives.ts`:** define `PRIM_ARAGONITE_FROSTWORK` as a 2D vector primitive — a radiating spray pattern (5 thin lines from a common origin, central spike vertical, four tilted ~30° in cardinal directions, matching the Three.js geometry in projection).

3. **In `js/99d-renderer-wireframe.ts`:** add the parallel air-mode aragonite check at the top of `_lookupCrystalPrimitive`. Return `PRIM_ARAGONITE_FROSTWORK` for any air-mode aragonite (twinned or not).

4. **Update tests:**
   - `aragonite-pseudohex-twin-three.test.ts` line 138: change expected token to `'aragonite_frostwork'`. Add a fluid-mode positive case asserting `'aragonite_pseudohex_twin'` is still the right answer there.
   - `aragonite-pseudohex-twin.test.ts` line 168: same change on the wireframe side.
   - `habit-bias.test.ts` `stalactite_demo` test: collapse the conditional branch — both twinned and non-twinned air-mode aragonite should route to `'aragonite_frostwork'`.

5. **Bump SIM_VERSION** — renderer-only change; baseline byte-identical.

6. **Add `tools/check-aragonite-frostwork-parity.mjs`** (optional but good): a smoke test that runs `stalactite_demo` + `zoned_dripstone_cave` + any other air-mode-aragonite-firing scenario and asserts the rendered token matches the geological expectation. Catches regression where someone reintroduces the `!twinned` scope.

## References

- Hill, C. A., & Forti, P. (1997). *Cave Minerals of the World* (2nd ed.). National Speleological Society. §5.3.4 (Aragonite), §10 (Cave-Mineral Morphology).
- Frisia, S., Borsato, A., Fairchild, I. J., & McDermott, F. (2000). Calcite fabrics, growth mechanisms, and environments of formation in speleothems from the Italian Alps and southwestern Ireland. *Journal of Sedimentary Research*, 70(5), 1183-1196. (Documents acicular aragonite cave growth in Italian alpine caves.)
- Frisia, S., Borsato, A., Fairchild, I. J., McDermott, F., & Selmo, E. M. (2002). Aragonite-calcite relationships in speleothems (Grotte de Clamouse, France): Environment, fabrics, and carbonate geochemistry. *Journal of Sedimentary Research*, 72(5), 687-699. (Pseudo-hex twin in cave aragonite — clarifies that structurally-twinned cave aragonite manifests as fibrous bundles, not smooth column form.)

**Citation hygiene flag:** Hill & Forti 1997 verified as real (NSS publication, 2nd edition Hill + Forti as editors); §5.3.4 / §10 section references are confident from past field-guide reading but not freshly re-verified for this bug write-up. Frisia et al. 2000 + 2002 are real publications on cave aragonite mechanism — verify volume/page numbers before citing in production code commit per the v141+ pastiche discipline.
