# HANDOFF — the keystone (per-mineral nucleation seeds) + the held-gate finding (2026-06-16)

One arc, two outcomes: **shipped** the keystone (per-(mineral,step) derived
nucleation seeds, SIM 198), and **discovered by measurement** that it does NOT
unblock the held sphalerite/wurtzite redox gate — the gate's blocker was
misdiagnosed. The keystone is correct, valuable infra; the gate stays held for a
corrected reason.

HEAD at handoff: `68edacd` (SIM 198), pushed, Pages built.

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

## NEXT (the real unblocker — a separate arc)

**Discriminator RUN 2026-06-16 — competition is RULED OUT.** Re-ran the gated-vs-
ungated mottramite A/B (N=40) with `setGraduatedCompetitionEnabled` ON vs OFF
(toggle verified to actually change the sim: n/Σµm differ per seed). The drop is
IDENTICAL both ways — **98%→45%, −53 pts, regardless of competition**. So the
cascade is NOT per-cell rationing. With fluid + fill endpoints already identical,
the only remaining cross-crystal coupling is the **shared growth-jitter RNG**
(`rng.uniform` in the grow engines; its stream phase shifts when the nuclei count
changes).

**This is good news for the gate** — it's the SAME RNG-isolation problem the
keystone already solved, one layer down (nucleation → growth), not an inherent
competition cost. So:

1. **Extend the keystone to growth**: wrap each crystal's growth-engine call in a
   per-`(crystal_id, step)` derived stream (mirror `_runNuc`). Both paths need it:
   the graduated path calls the engine in `_computeGraduatedZones` pass 1, the
   non-graduated in `_runEngineForCrystal`. This is the larger surgery but the
   technique is proven.
2. **Self-testing**: rebuild, re-run this exact A/B — if growth-jitter was the
   coupling, mottramite holds ungated≈gated, and the ZnS gate ships clean.
3. Only if it does NOT hold (residual coupling) does accept-and-tune come back on
   the table. Current evidence says it will hold.

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
