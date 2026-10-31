# Experiment brief — do Vugg seeds behave like geological neighbors?

**Status:** proposed — diagnostic only; no simulator changes authorized

**Date:** 2026-10-30

**Requested builder:** Flint

**Starting head:** `e86ba58a` (`Syntaxswine/main`)

**Primary scenario:** `deccan_zeolite`

## 1. The observation that produced the question

Four seller-associated calcite/zeolite specimens from Madhya Pradesh appear to
form two sibling pairs inside one broader geological neighborhood:

- two raspberry/salmon calcites on greener altered basalt/zeolite matrices;
- two honey calcites on pale heulandite-rich druse;
- a closely repeated probable iron signature across all four;
- probable mesolite on one honey specimen but not its apparent sibling.

The useful model is not “four independent random outcomes.” It is one shared
regional history with bounded local divergence: common host, alteration,
fracturing, fluid pulses, oxidation and cooling, followed by small differences
in connectivity, sealing, nucleation, permeability or residence time.

That raises a precise simulator question:

> Do nearby Vugg seeds currently produce nearby geological lives?

## 2. What the current code already tells us

The present run seed initializes `SeededRandom`, a 32-bit Mulberry32 stream
(`js/10-seeded-random.ts`). Several purpose-specific streams deliberately
scramble or avalanche their derived seed state. The comments around
`_makeThermalRng` and `_makeNucRng` in `js/85j-movements.ts` explicitly reject
correlation between nearby integer seeds for those streams.

Accordingly, numeric adjacency is **not presently a geological contract**.
Seed 100 and seed 101 are expected to be reproducible alternatives, not
siblings. The experiment must measure the result rather than assume it.

## 3. Questions and hypotheses

### D0 — current-system diagnostic

1. Are adjacent integer seeds `(s, s+1)` more phenotypically similar than
   randomly paired seeds under one fixed scenario?
2. Does any accidental locality survive in a particular output layer even
   though the derived streams avalanche?
3. Which output features are stable neighborhood traits and which are
   salt-and-pepper stochastic realizations?

**Null hypothesis H0:** adjacent seed pairs are no more similar than matched
random pairs.

**Alternative H1:** adjacent pairs retain measurable similarity in at least one
predeclared phenotype layer.

H0 is not a failure. It would establish that the current seed is an identifier
for a deterministic realization, not a coordinate in geological space.

### D1 — future architecture question (not authorized in this brief)

If D0 finds no meaningful locality, what minimum hierarchical seed contract
could generate related vugs from one shared history without changing existing
single-vug behavior?

Candidate shape only:

```text
neighborhood_seed
  -> shared parent history
     -> vug coordinate or child id
        -> bounded local branch streams
```

D1 is a report section, not an implementation request.

## 4. Experiment boundary

Build one read-only probe, tentatively:

```text
tools/seed-neighborhood-probe.mjs
```

It must run the existing simulator without changing simulation code, scenario
data, RNG behavior, baselines, `SIM_VERSION`, or generated product artifacts.
No new production dependency is allowed.

Use `deccan_zeolite` first because it directly expresses the specimen-derived
question: hematite/iron history, calcite, heulandite, mesolite and other staged
zeolites already exist in one declared paragenesis.

## 5. Cohort and controls

Default cohort:

- seeds `0..4095` inclusive;
- fixed scenario: `deccan_zeolite`;
- fixed step count: the scenario's declared/default run length;
- fixed code head and data files;
- no UI, wall-clock time, `Math.random()` or `Date.now()` inputs.

If 4,096 full runs are impractical, the probe may expose `--start`, `--count`
and `--stride`, but the committed receipt must cover at least 1,024 consecutive
seeds and state why the full cohort was not run.

Pair sets:

1. **Numeric neighbors:** `(0,1), (1,2), ...` within the observed cohort.
2. **Matched random controls:** the same number of deterministic, non-self
   pairs sampled from the cohort using a separate fixed analysis seed. Do not
   reuse the simulator RNG.
3. **One-bit controls:** pairs whose 32-bit seed values differ by exactly one
   bit, sampled deterministically. This distinguishes numerical adjacency from
   small Hamming distance.
4. **Repeat controls:** rerun at least 100 selected seeds and require identical
   canonical phenotype hashes.

The analysis seed, pairing algorithm and pair list must be written to the
machine-readable receipt.

## 6. Canonical phenotype

Define a versioned, deterministic phenotype record that excludes the seed
number itself and excludes renderer-only noise. Include, where already exposed
by the headless harness:

### Assemblage layer

- mineral presence/absence;
- crystal count per mineral;
- active/dissolved/replaced status counts where available;
- total crystal and generation counts.

### Scale layer

- per-mineral total volume or mass if authoritative;
- otherwise per-mineral radius/size summary: count, min, median, max and sum;
- specimen group counts if the existing specimen builder is available without
  introducing another simulation path.

### Timeline layer

- declared event identity and step;
- observed first nucleation step per mineral;
- observed first visible/nonzero-growth step per mineral if available;
- terminal survival or removal state.

### Deccan sentinel layer

- hematite presence and first nucleation;
- calcite, heulandite and mesolite presence/count/first nucleation;
- apophyllite presence and any existing hematite-phantom indicator;
- final temperature, pH, redox/O2 and relevant Na/Ca/Al/Si/Fe fields when
  already authoritative and serializable.

Do not invent missing authority. Emit `null` plus a reason for a desired field
that the current simulator cannot honestly expose.

Canonicalize object keys and array ordering before hashing. Publish the
phenotype schema/version in the output.

## 7. Similarity measures

Predeclare separate measures rather than collapsing everything into one opaque
score:

1. **Assemblage Jaccard similarity** over mineral presence.
2. **Count similarity** using Bray-Curtis similarity over the per-mineral count
   vector.
3. **Timeline similarity** from normalized absolute differences in shared
   first-nucleation steps, with an explicit penalty when a mineral exists in
   only one member.
4. **Deccan sentinel agreement** as a transparent vector of exact agreements
   and normalized differences.

An optional composite may be reported only alongside all components and with
its weights stated in the receipt. The conclusion must not depend solely on a
tuned composite.

## 8. Analysis and output

Required machine-readable outputs under an ignored or temporary artifact
directory:

- one JSONL row per seed containing the canonical phenotype and hash;
- one JSON summary containing cohort metadata, pair lists, component metrics,
  distributions and determinism results;
- one CSV with seed-level sentinel fields for quick human inspection.

Required human-readable report:

- exact head, `SIM_VERSION`, command and runtime environment;
- cohort actually completed;
- adjacent, one-bit and random-control distributions for every metric;
- median difference and a bootstrap 95% interval or deterministic permutation
  interval for adjacent-minus-random similarity;
- effect size, not just a p-value;
- notable accidental sibling pairs, including phenotypic nearest neighbors
  that are far apart numerically;
- an explicit verdict: `LOCALITY DETECTED`, `NO LOCALITY DETECTED`, or
  `INCONCLUSIVE`, with the threshold stated before inspecting results.

Suggested visualization, if dependency-free and cheap:

- a 64x64 row-major atlas for seeds 0..4095 colored by a few **separate**
  sentinel fields (mesolite presence, heulandite count, calcite count, total
  assemblage class);
- a neighbor-edge heatmap showing phenotype distance between `s` and `s+1`.

The row-major atlas is explicitly a diagnostic projection, not evidence that
the integer plane is geological space.

## 9. Acceptance gates

The experiment is complete when all are true:

1. One documented command reproduces the probe from a clean checkout.
2. Repeat controls produce identical canonical phenotype hashes.
3. Adjacent, one-bit and random pair lists are machine-readable and auditable.
4. Every reported metric is independently recomputable from committed code and
   emitted phenotypes.
5. The probe changes no simulator/scenario source and no production baseline.
6. The report states limitations, including RNG avalanching and any fields the
   headless harness cannot expose.
7. `git diff --check`, typecheck and the smallest relevant existing test pass.
   Full fleet tests are not required for a read-only tool unless shared runtime
   code is touched; touching shared runtime code violates this brief and must
   return for review.

## 10. Future neighborhood acceptance target

Do not implement this target in D0. Preserve it as the physical reason for the
experiment.

A future neighborhood generator should be capable of producing a small family
where:

- all child vugs inherit one neighborhood-scale iron event;
- two child subsets inherit different matrix regimes;
- one close sibling receives or nucleates a late mesolite phase while another
  does not;
- every shared event and local divergence is visible in provenance, rather
  than inferred from coincidental output resemblance.

The goal is not merely correlated output. It is **shared causal history with
bounded, attributable divergence**.

## 11. Questions for Flint before implementation

1. Which existing headless harness exposes the required phenotype with the
   least risk of creating a third runtime path?
2. Is 4,096 `deccan_zeolite` runs practical on the current box, and if not,
   what cohort size preserves useful power?
3. Which state fields are currently authoritative enough to serialize without
   laundering renderer or derived-display values into scientific evidence?
4. Can the probe remain entirely outside the bundle and avoid a `SIM_VERSION`
   change?
5. What is the smallest honest Stage D0 you would run first before investing in
   the atlas?

Please answer those questions in the PR before expanding scope. If the boundary
holds, implementing the probe and attaching a pinned receipt is authorized.

---

**Provenance note:** Professor derived this experiment from four neighboring
Madhya Pradesh calcite/zeolite specimens on 2026-10-30. The rocks supplied the
architecture: siblings share most of a life, and one local interval makes each
one itself.
