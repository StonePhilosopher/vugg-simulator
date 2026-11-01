# PROPOSAL — Overnight Inverse Crystal-Growth Pilot

**Authors:** Professor + Rock Bot
**Date:** 2026-10-31
**Status:** Proposed experiment; no production-physics changes authorized
**First target:** large, surviving, smooth cubic halite in the Searles Lake model
**Purpose:** test whether a differentiable surrogate can work backward from a desired crystal phenotype to promising simulated growth conditions

---

## Executive decision

Run one bounded, unattended overnight experiment with three equal-budget search
methods:

1. **Sobol search** — a strong space-filling random baseline;
2. **differential evolution** — a derivative-free black-box optimizer;
3. **surrogate backpropagation** — train an ensemble neural surrogate on Vugg
   runs, then backpropagate a target loss into bounded recipe inputs.

Every proposed recipe is judged by the original Vugg Simulator across multiple
growth seeds. The surrogate is never allowed to certify its own answer.

The first target is deliberately simple and physically legible: **halite cubes**.
Halite is already a first-class morphology tenant in Vugg, the Searles scenario
already supplies repeated wet/dry growth and dissolution, and a later kitchen-
scale comparison is possible without lead, arsenic, uranium, or fluoride.

This is an **inverse-Vugg test**, not yet a laboratory recipe generator. A
successful result means “the optimizer learned a reproducible implication of
the current simulator.” Nature does not enter the training loop until measured
laboratory results are added later.

---

## Research question

Given a bounded family of Searles-like starting fluids and schedules, can a
differentiable surrogate identify recipes that produce a better held-out
distribution of large, live, smooth cubic halite than:

- space-filling random search, and
- a competent derivative-free optimizer with the same evaluation budget?

“Better” is preregistered below. It cannot be redefined after the run.

### Hypotheses

- **H0:** surrogate-backprop candidates do not outperform the best control arm
  on unseen growth seeds.
- **H1:** surrogate-backprop candidates improve the preregistered held-out
  score, while remaining inside the declared physical bounds and retaining
  performance across unseen seeds.
- **Useful negative result:** if differential evolution wins, or no method
  clears random search, Vugg can still support black-box inverse design; the
  gradient layer simply has not earned its place.

---

## Why direct backpropagation through Vugg is not the first test

The current simulator includes hard nucleation thresholds, integer event
steps, discrete births and deaths, branching histories, and seeded random
draws. Literal end-to-end gradients would be zero, undefined, or misleading
at many important boundaries.

Instead:

```text
bounded recipe
    -> seeded Vugg runs
    -> measured phenotype distribution
    -> differentiable surrogate ensemble
    -> backpropagated candidate recipes
    -> held-out Vugg verification
```

The stone stays the judge; the neural model is only a map.

---

## Pilot target: “clean cabinet halite”

The desired simulated phenotype is:

- halite is present and survives to the final step;
- most surviving halite growth lies in the `spiral_smooth` morphology regime;
- crystals are large rather than a cloud of dust nuclei;
- the final assemblage is halite-selective rather than crowded by competing
  phases;
- the result repeats across growth seeds;
- no recipe depends on an out-of-range or obviously pathological input.

The pilot fixes the Searles cavity geometry at its authored shape seed. Geometry
is not optimized. Growth randomness is treated as uncertainty and sampled with
multiple growth seeds.

---

## Search space

The experiment creates a copy of `searles_lake` per evaluation and changes only
the following **experimental wrapper inputs**. It does not edit
`data/scenarios.json5` or production mineral physics.

| Input | Bounds | Meaning |
|---|---:|---|
| Initial salinity | 120–240 g/L | starting brine strength |
| Initial concentration multiplier | 0.80–1.60 | degree of pre-concentration |
| Initial temperature | 8–30 °C | cool-to-warm playa starting state |
| Initial pH | 7.5–10.0 | neutral-alkaline lake brine range |
| Competing-solute scale | 0.25–1.50× | jointly scales Ca, S, B, Mg, Sr; Na and Cl are not scaled |
| Final dry-hold duration | 20–100 steps | time after the authored final seasonal event |

All six variables are continuous in the surrogate. The dry-hold duration is
rounded to an integer only when passed to Vugg. Values are clamped before every
simulation, and out-of-bounds proposals are rejected rather than silently
corrected.

### Fixed controls

- Scenario: `searles_lake`
- Cavity geometry/shape seed: authored value (`1862`)
- Seasonal event order and handlers: unchanged
- Engine flags and mineral constants: unchanged
- Primary growth-seed set: fixed before optimization
- Held-out growth seeds: generated and sealed before optimization, never shown
  to any search method

The bounds are broad enough to expose the halite morphology ladder but narrow
enough to remain recognizable as the same evaporitic system. If the pilot
cannot move the target meaningfully within these bounds, widen them only in a
new versioned experiment.

---

## Phenotype extraction

The evaluator records compact summaries only; it does not retain the full wall
history or strip dataset for every run.

For each seed it records:

- live and dissolved crystal counts by mineral;
- live halite count;
- maximum, median, and total live-halide dimensions/volume;
- halite volume share of all live crystals;
- fraction of positive halite growth-zone thickness in each morphology regime;
- final halite survival fraction;
- total competing-species count and volume;
- final fill and any invariant/NaN/error flags;
- exact recipe, seed, simulator commit, data hashes, and runtime.

Approximate crystal volume uses the engine’s existing crystal dimensions. The
scoring path must not infer quality from rendered pixels.

### Per-seed component scores

Each component is clipped to `[0, 1]` before aggregation:

| Component | Definition | Weight |
|---|---|---:|
| Survival | at least one live halite at the end, softened by survival fraction | 0.20 |
| Smoothness | thickness-weighted share of live halite zones tagged `spiral_smooth` | 0.25 |
| Size | `log1p(max_live_halite_mm) / log1p(25 mm)`, capped at 1 | 0.30 |
| Selectivity | live halite volume / total live crystal volume | 0.15 |
| Simplicity | `1 / (1 + non-halite live species count)` | 0.10 |

Hard penalties:

- no live halite: final score for that seed is `0`;
- NaN, exception, invariant failure, or invalid fluid state: `0` plus an error
  record;
- any recipe outside the declared bounds: not evaluated;
- morphology determined from final label alone: invalid evaluator. The score
  must use thickness-weighted zone history so a smooth skin cannot hide a
  hopper body.

### Recipe score

For a recipe evaluated on several seeds:

```text
recipe_score = median(seed_scores) - 0.25 * IQR(seed_scores)
```

The IQR penalty rewards broad growth windows rather than lottery tickets.
All raw components remain in the result so a scalar score cannot hide a bad
tradeoff.

---

## Experimental design

### Phase 0 — provenance and deterministic canary

Before spending the night:

1. require a clean, named git commit;
2. run `npm run typecheck` and `npm run build:check`;
3. run the existing agent-interface determinism test;
4. run one recipe twice with the same seed and byte-compare its compact summary;
5. record the commit, `SIM_VERSION`, Node/Python versions, CPU count, and hashes
   of `data/*.json*` plus the built bundle;
6. refuse to continue if the canary differs.

### Phase 1 — shared foundation set

- Generate **256 Sobol recipes** over the six-dimensional bounds.
- Evaluate every recipe on **four fixed training seeds**.
- This shared set is visible to differential evolution and the surrogate.
- Hold back a separate control set of recipes and all final validation seeds.

### Phase 2 — equal-budget search arms

Each arm may request **256 additional recipes**, each initially evaluated on the
same four training seeds.

#### Arm A: Sobol continuation

Continue the Sobol sequence for 256 recipes. This is the random/coverage
baseline and guards against comparing a sophisticated method to weak sampling.

#### Arm B: differential evolution

Use SciPy’s differential evolution implementation with bounded inputs and a
fixed optimizer seed. The objective is the recipe score above. Candidate
deduplication occurs after quantizing each normalized input to `1e-5`.

#### Arm C: surrogate backpropagation

Run four active-learning rounds of 64 new recipes:

1. train a five-member small MLP ensemble on all surrogate-arm evidence so far;
2. predict the five phenotype components plus seed variability;
3. optimize bounded normalized inputs with Adam from at least 128 random starts;
4. score candidates as predicted objective minus an ensemble-disagreement
   penalty;
5. cluster/deduplicate the candidates and select 64 diverse recipes;
6. evaluate them in Vugg, add the truth to the training set, and repeat.

The train/validation split is grouped by recipe so different seeds from one
recipe cannot leak across the split. Network architecture, learning rate,
epoch ceiling, early stopping, and uncertainty penalty are written to the
manifest before the first model is trained.

### Phase 3 — blind held-out verification

For each arm:

- select its top eight distinct recipes without seeing held-out seeds;
- evaluate each on **32 unseen growth seeds**;
- report median, IQR, 10th percentile, failure rate, and every component;
- bootstrap the paired difference between the best arm candidates and the
  best Sobol candidate;
- render only the final short-list after numerical analysis is complete.

Shared-foundation candidates may appear in more than one arm’s top set; exact
duplicates are evaluated once and attributed honestly.

### Total budget

Nominal maximum before deduplication:

```text
shared foundation       256 recipes x 4 seeds  = 1,024 runs
three search arms     3 x 256 recipes x 4 seeds = 3,072 runs
held-out finalists   3 x   8 recipes x 32 seeds =   768 runs
                                                   --------
                                                    4,864 runs
```

On the current four-core host, one 300-step Searles run measured **4.11 s** and
about **331 MB peak RSS** on 2026-10-31. At an effective 1.5–1.6 CPU cores,
the simulation portion should fit in roughly 3.5–4.5 hours, leaving margin for
model fitting, checkpoints, and report generation under a six-hour hard limit.

---

## Overnight execution design

This should be a **one-shot armed run**, not a permanent nightly cron. Professor
chooses a night; the runner completes once and does not repeat.

### Operator surface

Proposed commands:

```bash
npm run inverse:prepare -- --preset halite-cubes-v1
npm run inverse:overnight -- --preset halite-cubes-v1 --start-at 03:30
npm run inverse:status -- --preset halite-cubes-v1
npm run inverse:resume -- --preset halite-cubes-v1
npm run inverse:report -- --preset halite-cubes-v1
```

`prepare` performs the canary and prints the exact budget and estimated finish
time. `overnight` arms one run. `resume` reads the checkpoint and never repeats
a completed recipe/seed pair.

### Resource envelope

Run under a transient user systemd service (or equivalent wrapper) with:

- two persistent Node simulation workers maximum;
- `nice -n 15` and idle I/O priority;
- `CPUQuota=160%` so the desktop retains headroom;
- `MemoryMax=1500M`;
- six-hour runtime ceiling;
- no network requirement after start;
- worker recycle after 250 recipes to limit retained heap;
- checkpoint after every completed recipe;
- stop proposing new work if available memory drops below 1.0 GiB;
- stop cleanly at the runtime ceiling and leave a resumable checkpoint.

The host’s login session currently reports only a lingering user, so
`loginctl IdleHint` is not trustworthy enough to decide whether Professor is
using the computer. The honest v1 mechanism is therefore explicit arming plus
low-priority resource controls. A later desktop-idle detector may pause between
recipe batches, but it must first be proven against real input activity.

The default suggested start is 03:30 local time, after the 02:15 catalog backup
and the 03:00 research invitation. Because DST changes on the night this
proposal was written, the launcher must let systemd resolve local civil time
rather than manually converting it to UTC.

### Failure behavior

- A single simulation failure is recorded and scored zero; the batch continues.
- Three consecutive infrastructure failures stop the run.
- A determinism failure, provenance mismatch, NaN flood, or checkpoint write
  failure stops immediately.
- The original checkpoint is never rewritten in place: write temporary, fsync,
  rename.
- Morning notification contains only status, elapsed time, completed/total,
  and the report path. It does not claim scientific success before held-out
  validation completes.

---

## Artifacts

One versioned directory per run:

```text
experiments/inverse-design/halite-cubes-v1/<run-id>/
  manifest.json
  recipes.jsonl
  evaluations.jsonl
  checkpoint.json
  models/
  finalists.json
  report.md
  plots/
  logs/
```

`manifest.json` is immutable after launch except for a final completion block.
Large model files and raw run output remain experiment artifacts, not source
control. The proposal, evaluator, schemas, compact finalist data, and final
report may be committed after review.

The morning report must include:

- exact provenance and completeness;
- wall-clock and resource use;
- method-by-method held-out table;
- score component breakdown, not only the scalar rank;
- robustness distributions across unseen seeds;
- surrogate calibration/error and ensemble disagreement;
- best recipes plus nearest sampled neighbors;
- boundary-hugging and exploit checks;
- a plain-language verdict: **supports surrogate backprop**, **black-box only**,
  **inconclusive**, or **pipeline failure**.

---

## Success gates

The pilot supports continuing to a second target only if all are true:

1. provenance and deterministic canaries pass;
2. at least 99% of scheduled evaluations complete normally;
3. the surrogate predicts held-out phenotype components materially better than
   a mean-only baseline;
4. its best candidate’s held-out recipe score exceeds the best Sobol candidate
   by at least 10%, with a bootstrap 95% interval for the difference above 0;
5. the candidate does not win solely by sitting on an input bound;
6. its 10th-percentile seed outcome still contains live halite;
7. visual inspection agrees with the numerical morphology summary.

If differential evolution wins but clears the same robustness gates, the
verdict is **black-box inverse design works; backpropagation has not yet earned
deployment**.

If no optimizer beats Sobol, preserve the full negative result. Do not tune the
score after seeing it.

---

## Exploit checks

Before treating a candidate as meaningful:

- perturb every input by ±2% and verify performance does not collapse;
- compare it to its nearest real evaluated neighbors;
- inspect saturation and morphology histories, not only final crystals;
- rerun with a second fixed cavity shape seed as an out-of-distribution check;
- reject recipes whose advantage comes from an exception, empty assemblage,
  impossible fluid value, scoring bug, or renderer/serialization mismatch;
- list which input bounds were touched;
- rerun the top recipe after a fresh process restart.

The optimizer is expected to find cracks in our model. Finding one is useful,
but it is a simulator bug report, not a crystal recipe.

---

## Implementation boundary

The first implementation may add:

- an experiment-only recipe adapter;
- compact phenotype extraction;
- an NDJSON persistent Node worker around the existing headless harness;
- a Python coordinator using installed NumPy/SciPy/scikit-learn/PyTorch;
- tests, schemas, checkpoint/resume, and report generation;
- a one-shot low-priority launcher.

It may **not**:

- retune mineral constants or scenario chemistry to improve the result;
- change production scenario output;
- add an automatic recurring cron;
- interpret simulator units as a direct lab protocol;
- introduce hazardous lab targets;
- publish or merge results without review.

---

## Follow-on ladder

Only after the halite pilot:

1. repeat with a second morphology target, likely calcite form/habit;
2. test transfer to a nearby scenario or cavity seed;
3. add laboratory-measurable inputs and explicit uncertainty;
4. run a small real halite growth experiment;
5. use measured outcomes to calibrate the simulator/surrogate loop;
6. only then call the output a candidate physical growth recipe.

The long-term system is not “AI tells us how crystals grow.” It is a closed
loop in which simulation proposes, experiment answers, and the model becomes
less wrong one night at a time.
