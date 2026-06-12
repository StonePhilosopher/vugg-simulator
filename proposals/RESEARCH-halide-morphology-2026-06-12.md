# Halite + sylvite morphology — survey & band placement (2026-06-12)

Second tenant of the morphology registry (js/45-morphology.ts; the
generalization arc's first new mineral after the calcite hoist). Method
follows the calcite arc: fleet σ survey in SIM units → band edges placed
against locality ground truth → literature as scaffolding, locality as
authority (proposals/TUNING-CALCITE-MORPHOLOGY.md §6 principle).

## §1 The survey (tools/morph-sigma-observe.mjs, seed 42)

New GENERIC instrument — replaces per-mineral sigma-observe clones; takes
`--minerals a,b,c`, samples POST-step σ (the classifier basis, 18th
catch) AND in-step σ side by side, reports thickness-weighted
percentiles per (scenario, mineral) + fleet-pooled.

| scenario | mineral | crystals | POSTσ p50 / p90 / max | size p50/max µm |
|---|---|---|---|---|
| searles_lake | halite | 9 | 42.6 / 385 / 385 | 18,605 / 54,073 |
| searles_lake | sylvite | 4 | 2.22 / 20.0 / 20.0 | 559 / 1,457 |
| bisbee | halite | 4 | 8.28 / 8.28 / 8.28 | 3,324 / 8,583 |
| bisbee | sylvite | 3 | 1.72 (flat) | 272 / 802 |
| tutorial_travertine | halite | 12 | 1.15 (flat) | 86 / 301 |
| sicily_solfifera | halite | 2 | 4.55 (flat) | 406 / 1,007 |
| tn457_barite_pulses | halite | 12 | 3.84 (flat) | 2,530 / 7,817 |

Two structural findings:

1. **In-step ≈ post-step for halides** (identical to 3 figures). Halite
   σ = (Na/100)(Cl/500)·c² is CONCENTRATION-driven; one step's growth
   barely dents the Na/Cl pool, so there is no thin-film basis gap
   (calcite's 18th-catch discontinuity does not recur here). The legacy
   in-step thresholds weren't wrong-basis — just unbanded and
   memory-less. We still classify post-step (one basis for the whole
   registry).
2. **σ history is quantized into plateaus** (searles: 42.6 baseline ↔
   385 spike) — the evaporite concentration driver (v161 `concentration`
   field, resets on reflood) produces clean two-level σ. Zone tags will
   stratify by pulse phase: the crystal IS the pan's wet/dry log.

## §2 Band edges (SIM units, post-step σ, Sunagawa order)

### halite
```
SPIRAL_MAX:     10    smooth {100} cube
STEP_MILD_MAX:  60    growth-banded cube (chevron/fluid-inclusion banding)
STEP_MACRO_MAX: 150   coarse macrostepped cube
HOPPER_MAX:     800   hopper/skeletal (cavernous faces, raft halite)
≥800            dendritic (efflorescence crusts — UNOCCUPIED in fleet, like calcite's)
```
Resulting claims (the hand-verification table):
- **searles_lake**: hopper during concentration spikes (385), banded
  cube at baseline (42.6) → zoned crystals, hopper episodes recorded.
  Ground truth: Searles/Death-Valley-style salt pans are THE textbook
  hopper + chevron locality (Lowenstein & Hardie 1985, Sedimentology 32
  — chevron halite = competitive bottom growth with inclusion banding;
  hopper rafts nucleate at the air-brine interface during desiccation).
- **bisbee** (8.28): smooth cube — arid supergene halite crust. ✓
- **sicily_solfifera** (4.55): smooth cube. (Messinian halite is famous
  for chevrons, but this scenario's halite is a 1 mm bit player —
  revisit only if the scenario ever grows a real halite stage.)
- **tn457_barite_pulses** (3.84), **tutorial_travertine** (1.15): smooth. ✓

### sylvite
```
SPIRAL_MAX:     3     smooth cube
STEP_MILD_MAX:  8     banded cube
STEP_MACRO_MAX: 16    macrostepped
HOPPER_MAX:     60    hopper (stepped hopper faces — the old engine's own term)
```
Claims: searles sylvite hoppers on spikes (20.0), smooth at base (2.22);
bisbee smooth (1.72). Legacy in-step flip was >4.0 → hopper_cube, which
on the (identical) post-step basis would have called searles BASELINE
zones hopper — the banded ladder is strictly more honest.

## §3 The damping deviation (the physics decision)

**No boundary-layer damping for halides**: SIZE_HALF_UM = Infinity
(morphSurfaceSigma's effSize/∞ → 0 → surfσ = bulk σ at any size).

Calcite's damping models diffusion-limited growth in still vug fluid
(Wolthers 2022 fixed-δ boundary layer). Evaporite brines at the growth
front are NOT still: halite growth drives density currents (the brine
above a growing crystal lightens as NaCl precipitates → convective
overturn), and hopper morphology itself is the Berg effect — corners and
edges sit in FRESHER brine than face centers precisely because supply is
advective. Empirically: the biggest halite (rafts, cm-scale chevron
beds) is the MOST hoppered/banded, the exact inverse of the damped-giant
prediction. A size-damped halite would smooth searles' 54 mm crystals
into glass — against ground truth. (If a future still-brine scenario
needs damping, it's one knob, per-mineral by construction.)

Calibration note: with damping off, band edges are read straight off the
survey's bulk-σ plateaus — that's why halite's edges (10/60/150/800) sit
higher than calcite's (2/8/50/200); same ladder, the mineral's own σ
units (registry contract: never compare edges across minerals).

## §4 What ships with the entry (Task 37 checklist)

- grow_halite/grow_sylvite lose their in-step habit flips (the
  last-writer-wins memory hole); habit reads crystal._morphology with
  the one-step lag, Phase-2-style. Chemistry untouched (rate computed
  before habit; Na/Cl debits unchanged).
- Aspect preservation: stepped_cube / hopper_cube / dendritic_cube carry
  the parent cube's _habitAspectRatio → renames stay chemistry-invisible.
- Render: hopper funnel on the cube envelope (Phase-3 machinery, square
  cross-section); banded cube = fine terrace treads on {100}.
- Strip chips: halite_morph + sylvite_morph (severity ordinal, shared
  MORPH_REGIMES scale) — will co-pulse with the concentration chip.
- Judge: searles-hopper-observe (or extend elmwood-judge pattern) — 8
  seeds, claims table above is the contract.
- Display flavor: 'smooth cube', 'banded cube (chevron)', 'macrostepped
  cube', 'hopper/raft', 'dendritic crust'.
