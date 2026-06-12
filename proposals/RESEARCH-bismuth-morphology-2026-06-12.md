# Native bismuth morphology — survey, corrected ladder, and the missing scenario (2026-06-12)

Third tenant of the morphology registry (js/45). The survey overturned
the arc's working assumption, so this note leads with the finding.

## §1 The survey finding: bismuth is (correctly) almost dead in the fleet

`tools/morph-sigma-observe.mjs --minerals native_bismuth`: **zero
surviving crystals fleet-wide at seed 42.** Schneeberg (its only real
home): exactly 1 crystal per seed (42–45), which then DISSOLVES; σ ≥ 1
on only 15/160 steps, **max 1.32**.

This is not a bug — it is the scenario telling the truth. Schneeberg
(the vugg scenario) models the URANIUM-WEATHERING stage of the
Erzgebirge story: the v185 declared Eh movement runs a reducing plateau
(−200 mV) → meteoric flood → +290 mV swing. Primary Bi grows quietly on
the plateau and is then destroyed by oxidation (bismite/bismutite —
grow_native_bismuth's O₂>0.8 dissolution branch). Reducing→oxidizing is
the WEATHERING direction.

**The dendrite shock needs the OPPOSITE sign**: an oxidized,
metal-charged brine hit by a sudden REDUCING pulse (the five-element
vein trigger — hydrocarbon/methane influx, Burisch et al. 2017; the
native-metal dendrites record minutes-to-days precipitation from
extreme disequilibrium, Kissin 1992; Scharrer, Kreissl & Markl 2019).
No scenario in the fleet does this for Bi. The session memory that
"schneeberg v185 IS the driver" was wrong — corrected.

## §2 The σ structure: a hard cap at ~4.5

supersaturation_native_bismuth (js/36) = bi_f × s_mask × red_f × T_f
with **bi_f capped at 3.0** and red_f ∈ [0.4, 1.5] → σ ≤ ~4.5 even at
Bi-saturated, strongly-reduced, in-window-T conditions. The registry
contract ("σ scales are NOT comparable across minerals") at its
sharpest: calcite's ladder spans 1–664, halite's 1–385, bismuth's
whole morphological life fits in **[1, 4.5]**.

## §3 The corrected ladder (texture vs morphology untangled)

Current dispatch (js/56) conflates aggregate TEXTURE with interface
MORPHOLOGY and runs anti-Sunagawa:
  excess>1.0 → massive_granular   (top σ = massive??)
  excess>0.25 + 10% dice → rhombohedral_crystal (well-formed at MID σ??)
  else → arborescent_dendritic    (dendrite at the BOTTOM??)

Corrected (Sunagawa order, registry bands — provisional edges in Bi's
own σ units, to be calibrated when the scenario lands):
```
SPIRAL_MAX:     1.5   smooth band: massive/foliated Bi (the mass-
                      dominant natural texture) with the RETAINED rare
                      dice-roll for a well-formed pseudocubic
                      rhombohedral crystal in an open vug
STEP_MILD_MAX:  2.2   feathery/laths — growth-banded foliated Bi
STEP_MACRO_MAX: 3.0   coarsely skeletal ("feather bismuth")
HOPPER_MAX:     3.8   skeletal/hopper frames (lab Bi territory —
                      natural occupancy expected ~0)
≥3.8                  arborescent dendritic — THE five-element texture
```
- massive_granular is a NUCLEATION-DENSITY texture, not a σ band — it
  becomes the smooth-band default rather than the top rung. (Gold's
  nugget-at-top has the same conflation; deferred to the copper/gold
  item per scope.)
- Damping: NONE (SIZE_HALF_UM = Infinity). Vein-shoot Bi precipitation
  during a redox shock is advection/reaction-controlled, not
  still-fluid diffusion-limited; and the natural dendrites are the
  BIGGEST masses (Schneeberg kg-scale Wismut sheets), same inverse
  argument as halite.
- Melt-hopper honesty: the rainbow funnel is melt growth (271°C mp) —
  hydrothermal vugg makes dendrites/skeletons, never the funnel.
  HOPPER band kept for ladder completeness, expected unoccupied.

**RNG-cascade consequence**: the current dice-roll consumes
rng.random() only when 0.25<excess≤1.0; any regime-driven rewrite
shifts consumption → seed-42 cascade moves in schneeberg → **the
engine commit is a SIM-bump + schneeberg-rebake commit** (per the
add-mineral skill's calibration-aware pattern). Not sim-neutral, unlike
the halide wave.

## §4 The missing scenario: a five-element vein (working name `wittichen`)

Survey of scenario references: **skutterudite and safflorite are
ORPHANS** — engines exist (js/61; skutterudite even grows
"cubo-octahedral core on native Bi-Ag seed", the rim half of the
diagnostic texture), but NO scenario lists them. The scenario that
gives the dendrite band its tenant also de-orphans both arsenides and
completes the texture the codebase started building:

- Anchor: Wittichen, Schwarzwald (classic Bi-Co-Ni-Ag-As-Ba five-element
  veins; Markl-group home turf — the engine's own Markl citation) or
  Cobalt, Ontario (the dendritic Ag-Bi sheets). Wittichen preferred:
  barite gangue is already strong in vugg (tn457 infrastructure).
- The driver: a declared fluid.Eh movement of the BISBEE shape but
  inverted purpose — oxidized brine baseline, then a sharp reducing
  pulse (hydrocarbon influx, −350..−400 mV, ~5–10 step width) at the
  Bi-rich stage; σ slams from <1 to near the 4.5 cap → dendritic zones;
  pulse decays → feathery → massive. The crystal records the shock.
- Paragenesis: dendritic native Bi cores (the shock) → skutterudite/
  safflorite rims nucleating ON the Bi (engine half-built) → late
  barite + calcite gangue. expects: native_bismuth, skutterudite,
  safflorite, nickeline, native_silver?, barite, calcite.
- Chemistry sketch: Bi 40–50 (bi_f near cap), Co/Ni for the arsenides,
  As high, S LOW (s_mask passthrough needs S<10 at shock time), Ba+SO4
  for barite stage, T 130–180°C (in Bi's T window), NaCl brine salinity
  high (five-element veins are basement brines).

## §5 What ships when

1. **Engine commit (SIM bump + schneeberg rebake)**: MORPH_TH.native_bismuth
   + corrected grow_native_bismuth dispatch + aspect entries + chip +
   narrator (92f) + tests. Fleet consequence: schneeberg's brief Bi life
   is smooth-band massive (its natural truth) until it weathers away.
2. **Scenario commit (`wittichen`)**: the five-element vein above —
   dendrite tenant + arsenide de-orphaning + the showcase. Judge tool +
   multi-seed gate, elmwood pattern.
3. Calibration pass: re-pin band edges against the scenario's measured
   σ trajectory (provisional edges above WILL move; that's the system
   working as designed).
