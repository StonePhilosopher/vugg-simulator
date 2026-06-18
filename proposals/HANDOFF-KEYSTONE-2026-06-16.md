# HANDOFF — the keystone (per-mineral nucleation seeds) + the held-gate finding (2026-06-16)

One arc, two outcomes: **shipped** the keystone (per-(mineral,step) derived
nucleation seeds, SIM 198), and **discovered by measurement** that it does NOT
unblock the held sphalerite/wurtzite redox gate — the gate's blocker was
misdiagnosed. The keystone is correct, valuable infra; the gate stays held for a
corrected reason.

HEAD at handoff: `68edacd` (SIM 198), pushed, Pages built.

> **✅ EPILOGUE — THE GATE SHIPPED, SIM 199 (`9887ddd`).** The "RESOLVED" section
> below ended with a fluid-pathway-trace recommendation. It was done, and it found
> a one-line BUG, not an intractable coupling: supersaturation_mottramite (js/38)
> had a spurious `if (Zn<0.5) return 0` — but mottramite is PbCu(VO4)(OH), the Cu
> ENDMEMBER (no Zn). Gating ZnS drained Zn→0 at ~half the seeds, tripping it
> (98→49). Removed the bug + shipped the ZnS redox gate together (v199): mottramite
> holds **98→84%**, clean 1/34 rebake (supergene only), coverage unchanged, CI
> 1916/1916. LEDGER §A #11 closed. The growth keystone stays reverted (it was a
> real but minor slice); the actual blocker was the chemistry bug, found by the
> trace.

---

## SHIPPED — the keystone (SIM 198, `68edacd`)

**The problem.** Every nucleation draw threaded through ONE continuous shared
`rng` for the whole run (never reset per step), so any change in a mineral's
draw-count re-phased every later (mineral, step) pair. The redox-gate census
attributed the mottramite 96→47% displacement (on adding the ZnS gate) to this.

**The fix.** Each `_nuc_<mineral>` now nucleates from its OWN derived stream:
`_makeNucRng(sharedState, fn.name, step)` (js/85j), routed through `_runNuc` at
all 156 call sites in the 13 `_nucleateClass_*` iterators. Run-seed lineage
(`this._nucSharedState = rng.state` at construction) + FNV-fold of mineral+step +
the 15th-catch scramble (one throwaway draw). Mirrors v181 `_makeThermalRng` one
level finer.

**Validation.** Deliberate full rebake (no byte-identical path); validated by
assemblage plausibility, not byte-identity:
- `tools/nuc-seed-isolation-probe.mjs` (OFF vs ON, N=40, all 34 scenarios): roster
  holds, no scenario loses an expects_species.
- `tests-js/nuc-seed-isolation.test.ts`: the keystone PROPERTY — with seeds ON,
  perturbing one mineral's draw-count changes NOTHING else; with seeds OFF it
  shifts the cascade (the test has teeth). Plus determinism + independence +
  scramble unit contracts.
- 5 seed-pinned tests re-pinned (each capability verified intact across seeds):
  mottramite cross-seed, lepidolite active-cap, fluid-spots aggregate clustering,
  halide banded-share floor, per-vertex aragonite direction. Full CI 1916 green.

## NOT SHIPPED — the ZnS redox gate (#11) stays HELD, for a CORRECTED reason

The whole premise (memory [[project_vugg_redox_census]]) was: the mottramite
displacement is nucleation-RNG, so the keystone unblocks the gate. **Measurement
after shipping refuted this.**

With the keystone live, I added the gate (`sulfideRedoxAnoxic(1.5)` to sphalerite
+ wurtzite, mirroring galena v13) and re-ran `tools/mottramite-frequency-sweep.mjs`
(now a valid A/B). Result: gating ZnS STILL drops mottramite **98%→49%** —
essentially unchanged from the pre-keystone 96→47.

**Diagnostic** (gated vs ungated, keystone ON, supergene seeds 1-5):

| seed | total (un→gated) | sphalerite | mottramite | final fluid Cu/V/Pb |
|------|------------------|-----------|-----------|---------------------|
| 1 | 122→125 | 1→1 | 4→4 | identical |
| 2 | 123→**109** | 1→1 | 2→**0** | identical |
| 3 | 135→**114** | 1→1 | 1→**0** | identical |
| 4 | 132→127 | 1→1 | 2→2 | identical |
| 5 | 120→125 | 1→2 | 4→4 | identical |

Final fluid is IDENTICAL (no chemistry coupling); sphalerite grown-count is
unchanged (the gate mostly blocks late-oxidizing sphalerite NUCLEI that barely
grow); yet at sensitive seeds the TOTAL crystal count cascades and mottramite
tracks it exactly.

**The real blocker: the growth/competition layer, not nucleation.**
`GRADUATED_COMPETITION_ENABLED = true` (js/44, v128c) rations growth per-cell —
inherently cross-crystal — AND the growth loop's `rng.uniform` rate jitter still
draws from the SHARED `rng`. Gating sphalerite changes how many nuclei populate
the crystal array, which (a) re-phases the shared growth-jitter stream and
(b) re-rations per-cell competition. The keystone (nucleation-RNG) cannot
decouple either; even per-crystal growth-RNG streams wouldn't remove the
competition rationing (cross-crystal coupling is the *point* of competition).

So the gate was reverted (`git checkout js/41`); HEAD stays at the clean v198.
Lifting it would halve a genuinely-abundant Tsumeb phase (mottramite, Boni 2007)
via a competition artifact — "follow the science → don't ship."

## RESOLVED — the gate is CHEMISTRY-bound, not RNG-bound (do NOT keep chasing RNG)

Three probes, in order, each refuting the last hypothesis:

1. **Competition RULED OUT** (2026-06-16). Gated-vs-ungated mottramite A/B (N=40)
   with `setGraduatedCompetitionEnabled` ON vs OFF (toggle verified live): drop
   IDENTICAL both ways (98→45). Not per-cell rationing.
2. **Growth-jitter is only a SLICE.** Built the growth keystone (per-`(crystal,
   step)` derived growth streams — `_makeGrowthRng`/`_runGrowth`/`_assignGrowthSeed`,
   wrapping the engine call in both `_runEngineForCrystal` + `_dryRunEngineForCrystal`,
   `_growthSeed` stamped at nucleation from the isolated nucleation stream so it's
   stable per-crystal). Self-test A/B: the drop shrank **60→43 pts** but mottramite
   did NOT hold. So growth-jitter RNG was real but minor.
3. **The dominant residual is CHEMISTRY.** With growth streams ON, gating drops
   mottramite *NUCLEATION* 52→22 (binary per-seed: 4→0 or 4→4), not just growth.
   Nucleation RNG is already isolated (v198), so a nucleation drop = **σ via the
   fluid trajectory**: gating oxidized-zone sphalerite shifts the supergene fluid
   enough to hold mottramite below saturation at ~half the seeds.

**The growth keystone was REVERTED** (HEAD stays clean v198): it's correct infra
but a full rebake that does NOT deliver the gate, and the real blocker is now known
to be chemistry — no amount of RNG isolation reaches it.

**The real next arc (if the gate is wanted):**
- It's likely a MODEL ARTIFACT: geologically, sphalerite (reduced primary) and
  mottramite (oxidized supergene) occupy DIFFERENT zones — removing oxidized-zone
  sphalerite shouldn't touch mottramite. Find the indirect fluid pathway in the sim
  by which gating ZnS lowers mottramite's σ (trace Pb/Cu/V — and the intermediates
  that route them — step-by-step, gated vs ungated, at a seed that flips like seed 1
  or 2). Fix that pathway, OR
- **accept-and-tune**: mottramite at ~50% may be defensible (it IS a rare-ish phase),
  ship the gate, re-pin the vanadate test. A design call for the boss.
- The growth keystone is recoverable from this handoff if wanted as standalone
  RNG-isolation infra (≈6 small edits), but it does not unblock this gate.

## SESSION LESSONS

- **Labels rot, including a memory's diagnosis.** The redox-census memory's "pure
  RNG-sequence displacement, keystone fixes it" was confidently wrong. The keystone
  was built correctly against that premise — and the premise failed on measurement.
  Build the instrument, then BELIEVE it. ([[feedback_verify_before_asserting_state]])
- **Isolate the right stream.** Nucleation-RNG and growth-jitter-RNG are different
  cascades; the displacement lived in the one the arc didn't target. The v181
  thermal precedent was the right shape (decouple a stream) but the wrong stream.
- **A full rebake re-pins seed-pinned tests** — re-pin to verified-intact
  capabilities (cross-seed / aggregate / corrected-semantics), never weaken to hide
  a loss; disclose each in the commit.
