# PROPOSAL — per-mineral derived nucleation seeds (THE KEYSTONE)

**Status:** ✅ SHIPPED SIM 198 (`68edacd`, 2026-06-16). Closes PROPOSALS-LEDGER §A #12
(the keystone). **Memory:** [[project_vugg_redox_census]], [[project_vugg_movements]].

> **⚠️ POST-SHIP FINDING — the keystone did NOT unblock the ZnS redox gate (#11).**
> The keystone isolates NUCLEATION RNG (proven: tests-js/nuc-seed-isolation.test.ts).
> But measurement after shipping (tools/mottramite-frequency-sweep.mjs, a valid A/B
> once the gate's σ-methods exist) showed gating sphalerite/wurtzite STILL drops
> mottramite 98%→49% — unchanged from the pre-keystone 96→47. The displacement was
> never nucleation-RNG. Diagnostic: final fluid identical, sphalerite grown-count
> unchanged, but total crystal count cascades at sensitive seeds and the mottramite
> drop tracks it. The blocker is the GROWTH/COMPETITION layer — `GRADUATED_COMPETITION_
> ENABLED=true` (js/44, v128c) rations growth per-cell (inherently cross-crystal) and
> the growth loop's `rng.uniform` jitter still draws from the SHARED stream, so
> changing the nuclei count re-phases growth + re-rations competition. Per-mineral (or
> even per-crystal) RNG isolation can't remove competition coupling. The gate STAYS
> HELD; its real unblocker is a separate growth/competition arc (or accept-and-tune).
> The keystone remains valuable infra — it just wasn't this gate's blocker.

---

## The problem (one paragraph)

Every nucleation draw in a run flows through **one continuous `rng` stream**
(`SeededRandom`, Mulberry32, `js/13-runtime-state.ts`). The stream is *never reset
per step* — it threads through the whole run. So **any change in draw-count at any
point shifts every draw after it for the rest of the run.** `check_nucleation`
(`js/85d:238`) dispatches 14 `_nucleateClass_*` iterators in fixed order; each calls
its `_nuc_<mineral>(sim)` helpers in fixed order; each helper draws substrate-pick +
decision numbers, and `sim.nucleate()` draws cell/ring/twin/fill-dampener numbers —
all from the shared stream. Add or gate ONE mineral and you change how many numbers
it consumes, which **re-phases the stream for every later (mineral, step) pair, even
ones sharing no chemistry.**

This is why the redox-gate census (`b81cf7d`) had to HOLD the correct-physics
sphalerite/wurtzite ZnS redox gate: adding it demoted **mottramite 96% → 47% of
seeds** at `supergene_oxidation` (`tools/mottramite-frequency-sweep.mjs`). Mottramite
is a *phosphate-class vanadate* sharing no ion with ZnS — pure RNG-sequence
displacement, not chemistry. A chemistry lever (V-seep bump) raised mottramite's mean
count but NOT its frequency: **you cannot fix an RNG-displacement with chemistry.**

## The precedent (this is not new ground)

The **T-reconciliation arc (v181, the 15th catch)** already solved exactly this
class of bug for the *thermal* stream. Ambient cooling + thermal pulses used to draw
~2 numbers/step (+1..6 per pulse) from the shared `rng`, displacing the nucleation
cascade. v181 moved them onto a **dedicated `_thermalRng`** (`js/85j`), seeded once at
sim construction from `rng.state` (run-seed lineage) and **scrambled through one
throwaway draw** because bare-XOR of nearby seeds left correlated early streams
(`tools/t-reconciliation-probe.mjs` measured tutorial pulse-count variance collapse
to ±0.00 before the scramble fix). After v181: *"thermal noise and crystal outcomes
are decoupled streams at last."*

This proposal does the same thing **for nucleation itself**, one level finer: not one
dedicated stream per run, but **one derived stream per `(mineral, step)`**.

## The design

### `_makeNucRng(sharedState, mineralKey, step)` — `js/85j`

Mirror `_makeThermalRng` exactly, then fold in the mineral identity + the step:

```ts
const _NUC_SALT = 0x4e554301; // "NUC\x01"

function _makeNucRng(sharedState, mineralKey, step) {
  // run-seed lineage (like _makeThermalRng): per-run, reproducible, zero shared draws
  let h = (((sharedState | 0) ^ _NUC_SALT) >>> 0);
  // FNV-1a fold of the mineral key — decorrelates adjacent minerals
  for (let i = 0; i < mineralKey.length; i++) {
    h = (Math.imul(h ^ mineralKey.charCodeAt(i), 0x01000193)) >>> 0;
  }
  // fold the step — decorrelates adjacent steps of the same mineral
  h = (Math.imul(h ^ (step | 0), 0x01000193)) >>> 0;
  // SCRAMBLE (the 15th catch): one throwaway draw avalanches nearby seeds apart
  const scramble = new SeededRandom(h >>> 0);
  return new SeededRandom(Math.floor(scramble.next() * 4294967296) >>> 0);
}
```

The result: the numbers `_nuc_sphalerite` draws in step N come from
`_makeNucRng(base, "_nuc_sphalerite", N)` — a function of *nothing but* the run seed,
the mineral, and the step. **Independent of what any other mineral did, and of how
many numbers sphalerite itself drew in step N−1.** Gating sphalerite changes only
sphalerite's own (now-private) draws; mottramite's stream is untouched.

### `_runNuc(sim, fn)` — the dispatch wrapper — `js/85j`

```ts
let NUC_DERIVED_SEEDS = true;   // the keystone; OFF reverts to legacy single-stream (A/B only)

function _runNuc(sim, fn) {
  if (!NUC_DERIVED_SEEDS) { fn(sim); return; }
  const saved = rng;
  rng = _makeNucRng(sim._nucSharedState, fn.name, sim.step);   // fn.name = "_nuc_<mineral>"
  try { fn(sim); } finally { rng = saved; }
}
```

`fn.name` is the seed key — stable, unique per nucleation function, and requires **no
hand-typed mineral strings** (140 of them would each be a typo/mismatch risk). The
build is a non-minifying concat (148 modules → index.html), so `fn.name` survives;
tsc/vitest preserve it too.

Swapping for the *whole* `fn(sim)` call captures BOTH the substrate-pick draws in the
`_nuc_` body AND the `sim.nucleate()` draws (cell/ring/twin/fill-dampener) — full
per-mineral isolation. Restoring `rng = saved` means nucleation no longer advances the
shared stream at all; the growth loop's `rng.uniform` jitter reads the shared stream
at a position now independent of nucleation count (a further, free decoupling).

### Capture point — `js/85-simulator.ts:30`

```ts
this._thermalRng = _makeThermalRng(rng.state);
this._nucSharedState = rng.state;   // run-seed lineage for per-(mineral,step) nuc streams
```

Read-only capture — consumes no draw, same as `_thermalRng`.

### The 14 iterators — `js/8x-nucleation-*.ts`

Uniform mechanical transform, every call site:

```
_nuc_<mineral>(sim);   →   _runNuc(sim, _nuc_<mineral>);
```

~140 sites, all the clean line-start form (verified: the only other `_nuc_(sim)`
occurrences are the function *definitions*, which end in `{` not `;`). Done via a
one-shot regex migration over the `_nuc_*(sim);` lines (zero typo risk, preserves the
interspersed paragenesis comments), diff-reviewed, script discarded.

## Why per-mineral, not per-class

Per-*class* streams (14 swaps in `check_nucleation`) would fix the headline
mottramite bug — mottramite (phosphate) is a different class from sphalerite
(sulfide). But sphalerite is the **first** sulfide in its iterator, so gating it would
still displace galena/pyrite/chalcopyrite within the sulfide stream. The keystone's
whole point is that *no* gate change can displace *any* other mineral — that requires
per-mineral. (It also future-proofs: a later galena gate edit won't touch chalcopyrite.)

## This is a deliberate full rebake — not a regression

There is no byte-identical path. The moment `NUC_DERIVED_SEEDS` is on, *every*
nucleation draw comes from a new source, so **every scenario's seed-42 signature and
every baseline changes.** This is the "ripples once" cost: the transition re-realizes
the fleet once; afterward each mineral is permanently isolated. Validation is therefore
**by assemblage plausibility, not byte-identity** — exactly how v181 was validated.

## Validation strategy

1. **Dark-observe A/B probe** (`tools/nuc-seed-isolation-probe.mjs`): run all 34
   scenarios × N seeds with `NUC_DERIVED_SEEDS` OFF then ON; diff per-scenario
   assemblages. PASS = every scenario keeps its characteristic minerals (every
   `expects_species` still fires); the change is a re-realization, mineral *counts*
   move but the *roster* holds.
2. **Isolation assertion**: with seeds ON, add a no-op extra draw to one mineral's
   `_nuc_` and confirm a *different* mineral's per-step crystal set is byte-identical
   (the property the whole arc buys). This becomes a permanent regression test.
3. **Full-fleet rebake** + `tools/baseline-diff.mjs` review + canary overnight sweep.
4. **The payoff**: lift the ZnS redox gate, re-run `mottramite-frequency-sweep.mjs` —
   mottramite frequency must now hold (no cross-mineral displacement). Pair with the
   Tsumeb V-richness rider if the census still shows under-cooked V.

## Arc plan (tasks #60–#65)

1. #60 design (this doc) + probe.
2. #61 implement behind the flag.
3. #62 dark-observe; confirm fleet roster holds; capture mottramite baseline.
4. #63 flip ON, full rebake, SIM bump, CI green, baseline-diff review.
5. #64 lift sphalerite/wurtzite gate + Tsumeb V rider; verify mottramite holds.
6. #65 close out: ledger/BACKLOG/memory/handoff, push, Pages, canary.

## References

- `js/85j-movements.ts` `_makeThermalRng` / `_makeMovementRng` / `_makeSpotRng` — the
  derived-stream + salt + scramble precedents.
- `js/15-version.ts` v181 block — the 15th catch (seed-scramble requirement) in prose.
- `proposals/CATCHES.md` — the 15th catch lineage.
- `tools/mottramite-frequency-sweep.mjs`, `tools/sulfide-redox-omission-probe.mjs`,
  `tools/redox-gate-census.mjs` — the held-gate measurement chain.
