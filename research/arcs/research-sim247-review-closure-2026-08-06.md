# SIM 247 hostile-review closure research

Date: 2026-08-06

## Tsumeb gypsum / selenite

Primary locality evidence used for the scenario correction:

- Harvard Mineralogical & Geological Museum, Tsumeb Mine Notebook, gypsum
  record TSNB159: <https://tmn.fas.harvard.edu/objects/TSNB159>
- The record describes gypsum as confirmed but somewhat rare at Tsumeb,
  occurring in all three oxidation zones, with well-formed crystals reaching
  centimetre scale. It cites Klein (1938), Pinch & Wilson (1977), and Lombaard
  et al. (1986).

Simulation decision: retain selenite as a deterministic Tsumeb promise and
make the step-70 dry-season event add an explicit oxidized-sulfate recharge to
the conserved `S_sulfate` reservoir. Adding only to legacy total `S` did not
change the authoritative sulfate pool and therefore could never cross gypsum
saturation. The corrected event also adds Ca from dolomite-bearing recharge.

## Transformation testimony

Pharmacolite-to-haidingerite and realgar-to-pararealgar are solid-state or
alteration products, not new nucleation events. The strip recorder therefore
archives them separately as `{from, to, step, crystal_id, mechanism}`. Claim
cards combine nucleation and transformation testimony when deciding whether a
phase was delivered, while retaining the distinct pathway in paragenetic order.

## Expectation semantics

- `expects_species`: deterministic release contract; every entry must appear in
  the canonical executed strip.
- `statistical_species`: explicitly stochastic target; absence is reported but
  is not a release failure.
- `aspirational_species`: geologically justified future target not delivered by
  the current authored path.
- `excluded_species`: mine-specific negative evidence; blocks that phase only in
  that scenario and is disclosed by Creative Mode's nucleation diagnosis.

Sweetwater's valid-species record supports calcite, dolomite, galena,
marcasite, pyrite, and sphalerite. The SIM 247 scenario keeps dissolved Ba/Sr
as brine tracers and trace Ag as possible lattice inventory, but explicitly
excludes unrecorded acanthite, barite, celestine, selenite, rhodochrosite, and
siderite. These exclusions do not disable their global engines or Creative
Mode controls.
