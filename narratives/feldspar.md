---
mineral: feldspar
variants:
  - id: blurb
    condition: always
  - id: sanidine
    condition: mineral_display is sanidine
  - id: orthoclase
    condition: mineral_display is orthoclase
  - id: microcline
    condition: mineral_display is microcline
  - id: adularia
    condition: mineral_display is adularia
  - id: amazonite
    condition: amazonite in zone notes
  - id: perthite
    condition: perthite in zone notes
  - id: carlsbad_twin
    condition: twin_law includes Carlsbad
  - id: baveno_twin
    condition: twin_law includes Baveno
  - id: cross_hatch_twin
    condition: twin_law includes cross-hatched
  - id: albite_twin
    condition: twin_law includes albite
  - id: generic_twin
    condition: twinned, no specific twin law matched
  - id: dissolved
    condition: crystal dissolved
  - id: closing
    condition: always
---

## blurb

{polymorph} #{crystal_id} — the most abundant mineral on Earth, and a thermometer frozen in crystal form.

## variant: sanidine

High-temperature, disordered — aluminum and silicon are randomly distributed across the framework. This crystal formed hot and cooled fast, locking in the chaos. Sanidine is the snapshot of a volcanic moment.

## variant: orthoclase

Partially ordered — aluminum is beginning to sort itself into preferred sites, but the crystal cooled before the ordering could complete. Orthoclase is the interrupted conversation between order and disorder.

## variant: microcline

Fully ordered — every aluminum atom found its preferred site. This takes time. Microcline is patience crystallized, the reward for slow cooling in deep rock.

## variant: adularia

Low-temperature hydrothermal form with a distinctive pseudo-orthorhombic habit. Found in alpine clefts alongside quartz and chlorite — the classic Swiss mineral assemblage. The mountains' own crystal.

## variant: amazonite

Green from lead — Pb²⁺ substituting for K⁺ in the crystal lattice. The lead that colored this crystal may have come from dissolved galena. One mineral's death becomes another mineral's identity.

## variant: perthite

Perthite texture — as the crystal cooled through the solvus (~660°C), the solid solution of K and Na feldspar became unstable. The two compositions unmixed into alternating lamellae, like oil separating from water. If the lamellae are thin enough, they scatter light: moonstone.

## variant: carlsbad_twin

Carlsbad twinned — two individuals growing in opposite directions along the c-axis. The most common feldspar twin, recognized since the 18th century in the granite of Karlovy Vary.

## variant: baveno_twin

Baveno twinned — a mirror twin that creates a distinctive heart-shaped cross-section. Named for the granite quarries of Baveno on the shores of Lago Maggiore.

## variant: cross_hatch_twin

Cross-hatched twinning — the diagnostic feature of microcline. Albite and pericline twin laws operating simultaneously create a tartan-plaid pattern visible under crossed polars. No other mineral does this.

## variant: albite_twin

Albite polysynthetic twinning — fine parallel lamellae that create subtle striations on cleavage surfaces. Each stripe is a twin boundary where the crystal structure mirrors itself.

## variant: generic_twin

Twinned ({twin_law}).

## variant: dissolved

Acid weathering attacked the feldspar — kaolinization released K⁺, Al³⁺, and SiO₂ into the fluid. The slow-motion breakdown that makes clay.

## closing

The feldspar polymorph records the temperature at which it formed. Read the feldspar and you read the vug's thermal history.
