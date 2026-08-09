# Thermal-field localization — scientific and numerical contract

Date: 2026-08-08  
Implementation target: SIM 256

## Decision

Vugg Simulator now resolves one local-equilibrium temperature for each cavity
voxel. It transports that field with three separately disclosed terms:

1. symmetric three-dimensional conduction/thermal dispersion;
2. an authored directional upwind transport path representing advective fluid
   heat transport; and
3. explicit open temperature boundaries for a feeder or wall-rock buffer.

The model does **not** claim separately resolved rock and water temperatures.
It also does not report thermal diffusivity in m²/s, source power in watts, or
energy in joules. The current geometry has no calibrated voxel length and a
simulation step has no calibrated duration. Every exposed coefficient is
therefore named `fraction_per_step`. Source receipts report the change in a
normalized, geometry-weighted control-volume × temperature proxy and explicitly
say that this is neither energy nor a calibrated fluid volume.

This is the narrowest scientifically defensible model that makes local
temperature matter to mineral saturation, nucleation, growth, zoning, and the
helicoid without inventing an uncalibrated physical timescale.

## Evidence

- USGS PHREEQC transport documentation derives heat transport from heat
  conservation and describes the heat equation as analogous to
  advection-reaction-dispersion, with thermal dispersion combining advection
  and conduction. It also states the local uniform-temperature assumption for
  water and solid in a representative volume. This supports the implemented
  LTE transport structure, not its uncalibrated coefficients:
  https://wwwbrr.cr.usgs.gov/projects/GWC_coupled/phreeqc/html/final-23.html
- Kurylyk et al. show that groundwater flow advects heat and that departures
  from a conduction-dominated temperature field can diagnose water flux. This
  supports a directional heat-transport term aligned with authored flow:
  https://pubs.usgs.gov/publication/70194501 and
  https://doi.org/10.1002/hyp.11216
- The USGS St. Paul aquifer experiment reports that heat transport during
  heated-water injection is primarily advective and secondarily conductive,
  while conduction dominates after injection stops. This supports persistent
  source commands plus continued conductive relaxation after source removal:
  https://pubs.usgs.gov/pp/pp1530B/
- Fox, Koch, and Tester couple convective transport in geothermal fractures to
  conduction perpendicular to the fractures. This supports keeping source-flow
  transport distinct from symmetric conduction:
  https://doi.org/10.1002/2016WR018666
- Assael et al.'s NIST/IAPWS assessment covers measured water thermal
  conductivity over a wide temperature/pressure range. It establishes that a
  physical SI parameterization is possible only after the simulator supplies a
  length, duration, phase, density, and heat-capacity calibration. It does not
  license guessing those missing quantities:
  https://www.nist.gov/publications/experimental-data-viscosity-and-thermal-conductivity-water-and-steam
- An experimental forced-convection study documents both local-thermal-
  equilibrium and local-thermal-nonequilibrium porous-medium energy models.
  The simulator adopts LTE as a disclosed simplification; rapid transients or
  large rock/fluid temperature offsets remain outside its claim:
  https://doi.org/10.5194/npg-25-279-2018

## Equations and discrete interpretation

The conceptual LTE equation is

`∂T/∂t + u·∇T = α∇²T + q`,

where `α` is an effective conduction/dispersion term and `q` represents an
explicit boundary source or sink. SIM 256 implements only its dimensionless
graph analogue.

Each wall vertex receives a surface share from the exact tessellated cavity
triangles. That share is extended inward through four radial shells using the
shell factor `r_outer³ - r_inner³`; the resulting positive weights `wᵢ` are
normalized to sum to one. This captures the large outer-shell/small core-volume
difference and the smaller polar cells without pretending the grid is a set of
equal cubes.

For each undirected conductive face between voxels `i` and `j`:

`Qᵢⱼ = κ min(wᵢ, wⱼ)(Tⱼⁿ − Tᵢⁿ)`,

`Tᵢⁿ⁺¹ = Tᵢⁿ + Σⱼ Qᵢⱼ / wᵢ`.

The graph has at most six neighbours: cyclic azimuth, no-flux floor/ceiling,
and no-flux wall/centre radial ends. All neighbours use the same pre-step
snapshot. Therefore each internal edge contributes equal and opposite changes
to `wT` at its endpoints and the weighted thermal proxy is conserved. Using the
smaller adjacent control volume as the shared-face conductance proxy bounds
each neighbor contribution; `0 ≤ κ ≤ 1/6` keeps the explicit update stable at
degree six.

An open temperature boundary relaxes a source voxel toward authored
temperature `Tsrc`:

`TsrcVoxel ← TsrcVoxel + β(Tsrc − TsrcVoxel)`, `0 ≤ β ≤ 1`.

Directional transport uses a synchronous first-order upwind replacement along
the authored path:

`Tdown ← Tdown + a(Tup − Tdown)`, `0 ≤ a ≤ 1`.

Every source and downstream cell reads from the same post-conduction/post-rock
snapshot. Overlapping source terms are combined as a convex weighted update;
if their weights sum above one, all weights share one normalization. Source IDs
therefore affect receipts and display ordering only, never physics. This avoids
both write-order propagation and metadata-dependent results. It is a replacement-flow
representation. It is intentionally not
conservative inside the cavity control volume: hot/cold fluid and heat enter at
the boundary while displaced fluid exits. The full geometry-weighted control-
volume change is recorded against that source. Supported directions are wall→centre,
centre→wall, clockwise, counter-clockwise, ceilingward, floorward, and none.

## Engine and testimony contract

- `CavityVoxelGrid.voxels[].temperature` is canonical.
- Every wall saturation and growth transaction reads its adjacent depth-zero
  voxel.
- Whenever local wall chemistry or the canonical thermal field is active,
  production nucleation pre-gates use the maximum saturation from an exact scan
  of every boundary chemistry/temperature state rather than letting a cavity
  mean veto a viable cell. The bulk fluid is never admitted as an extra
  candidate: if every accessible wall cell is blocked, the envelope is zero
  even when the UI/event bulk view is supersaturated. Uniform-temperature and median-temperature cells are
  included because chemistry can make them uniquely viable. The area/saturation-
  weighted sampler admits only cells above the mineral-specific threshold.
- A proposed substrate is evaluated at its own anchor before its barrier
  discount or location can be used. A viable remote cell cannot lend saturation
  to an ineligible host.
- HMC composition is predicted from the selected cell's fluid and temperature;
  birnessite-to-todorokite exchange evaluates each precursor at its own cell and
  debits Mg from only the transformed precursor's local fluid.
- A crystal records the actual local temperature and saturation at its chosen
  nucleation anchor; saturation- and temperature-sensitive habit selection uses
  those birth-cell values after the anchor has been sampled. Its random draw is
  reserved at the legacy pre-anchor point, preserving seeded RNG ordering.
- Every accepted `GrowthZone` records the local temperature seen by its engine.
- Ring temperatures remain boundary means for compact legacy display.
- Helicoid and strip chip calculations read the local cell/depth temperature;
  replay snapshots retain boundary-cell temperatures.
- Post-growth morphology reads the crystal's exact boundary fluid/temperature,
  Wulff form chemistry accumulates from that same cell, and base/tip exposure
  reads separate endpoint temperatures. Vadose calcite
  applies a declared 0.10 dimensionless excess-saturation transfer factor at
  the drip-film interface; this local transport calibration preserves the
  observed stepped stalactite regime without reverting to a bulk-fluid proxy.
- Creative hover diagnosis reports the exact maximum cell, boundary saturation
  range, and that cell's limiting reagents, temperature, pH, redox and pressure;
  substrate rows separately report how many hosts are eligible at their own
  anchors, while a fixed-RNG clone of the actual production nucleator applies
  serial, cap, repeat, precursor and priority blockers in the same local context.
  The observer owns deep copies of nested zone inventory, bulk fluid, and every
  wall-cell fluid, so even a mass-booking phase-transition probe cannot debit or
  relabel the live specimen.
- Global scenario events and movements apply their temperature delta to every
  voxel, preserving existing spatial anomalies.
- Removing a boundary stops new forcing but does not erase stored heat;
  conduction continues because the field stays activated.

## Commands and reproducibility

Thermal sources are normalized plain JSON records, sorted by stable source ID
for testimony only,
and changed only through set/update, remove, or clear commands. They carry
location, boundary temperature, coupling fraction, advection fraction, flow
direction, optional active window, and provenance. The immutable simulation
command log replays those commands before advancing. State fingerprints include
the full voxel temperature and fluid fields, every dedicated RNG cursor,
complete crystal-zone mass/dissolution/partition ledgers, source list,
monotonic fallback-ID counter, transport configuration, wall-rock boundary,
and the movement controller's authored operators plus OU/origin state.
The immutable transport-
configuration command replays enable/pause, conduction, wall exchange and rock
temperature. The fingerprint records field activation separately from its
enabled switch. `enabled:false` freezes the field without deleting it or its
sources, so configuring then adding a source is state-equivalent to adding the
source then pausing. Thermal, orientation, and movement streams already
existed; the legacy mulberry callables now expose restorable cursor state and
all three cursors are explicitly fingerprinted rather than silently omitted.
The immutable shared seed used to derive future per-mineral/per-step nucleation
streams is also recorded explicitly; it is future-determining even though it is
not itself a mutable PRNG object.

The default run seed remains 42. Source positions are exact mesh cells in the
scenario's authored `shape_seed` geometry. A source-free scenario never enters
the thermal solver and retains its prior uniform field exactly.

Creative exposes an enable/pause control, the conduction fraction, wall-rock exchange fraction, optional
rock temperature boundary, source position and temperature, source/advection
fractions, flow direction, and optional start/end steps. Values are normalized
through the same runtime methods used by replay rather than remaining cosmetic
sliders.

## Explicit limitations and future calibration

The following are not yet licensed:

- converting a fraction-per-step coefficient to m²/s without voxel length and
  step duration;
- converting normalized control-volume receipts to joules without calibrated voxel volume, phase
  density, porosity, and effective heat capacity;
- boiling, condensation, supercritical phase flow, latent heat, or pressure-
  dependent fluid properties;
- separate rock/fluid temperatures or a local-thermal-nonequilibrium closure;
- buoyancy-derived flow direction, permeability feedback, or a solved velocity
  field.

A future physical calibration must add those quantities together and validate
them against a named system. Until then the current controls remain honest
dimensionless geological levers.
