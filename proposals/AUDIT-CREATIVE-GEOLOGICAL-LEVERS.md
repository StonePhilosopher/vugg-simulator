# Creative geological-lever coverage audit

Date: 2026-08-05
Rule: **follow the science** — expose causes the Earth can vary, derive dependent state, observe outcomes, and keep renderer/calibration switches out of the geological control surface.

## Implementation status — 2026-08-05

The audited correctness defects and control-surface gaps are now repaired in the working tree. The executable audit currently reports:

- all 44 accepted authored fluid fields available in both setup and live controls;
- zero silently discarded authored fluid fields and zero authored values clipped by UI ranges;
- 18/18 live environmental paths and 23/23 setup boundary controls present;
- 10/10 advanced geological-history surfaces present;
- all authored wall fields classified with 15 direct controls, 5 setup controls, 3 scientifically derived controls, 11 presentation-only fields, and no missing geological lever;
- every chemistry lever declares model provenance, coupling, real consumers, and an executable endpoint perturbation against a canonical gameplay primitive;
- the three runtime-only fluid fields are derived/internal state with explicit upstream sources and consumers, not tolerated missing sliders;
- the causal contract passes across 39 scenarios, 274 events, and 17 persistent movements in 12 scenarios.

Regression coverage now proves that untouched UI state cannot overwrite authored scenario chemistry, unknown fluid keys are rejected, setup/live mappings remain complete, preset geometry remains intact, active timeline state survives appended trajectories, feeder and spatial-zone edits reach the mesh, tail-end live edits survive save/replay, and the responsive control surface has no horizontal overflow at a 390×844 viewport.

The returned pressure packet has now been implemented where its evidence is sufficient: setup/live fluid pressure across 0.01–4.4 kbar, decompression, pressure-bearing mineral phase fields, the apophyllite correction, and a separate differential-stress action. Unsupported universal multipliers, boiling without conserved volatile pools, and reaction corrections without complete Δκ data remain deliberately deferred; see `proposals/IMPLEMENTATION-PRESSURE-SCIENCE-2026-08-05.md`.

The findings below are retained as the **pre-implementation baseline and rationale** for these changes.

## Historical baseline verdict (before the 2026-08-05 implementation)

The counts and defects below are retained as an audit trail. They do not
describe the current working tree; the implementation status above and the
executable audit are authoritative.

Creative is already a useful chemistry sandbox, but it is not yet the unrestricted expert geological lab described by the design goal. Chemistry coverage is broad; boundary conditions, host rock, hydrology, spatial plumbing, and time-dependent processes are not.

The most urgent finding is not a missing slider. Current live-slider ranges can alter authored scenario chemistry before the first step. That data-integrity defect should be fixed before adding new controls.

| Audited surface | Fleet / runtime inventory | Current Creative coverage |
|---|---:|---:|
| Authored scenarios | 39 | all inventoried |
| Scripted events | 274 | state outcomes can often be approximated manually; event processes/directives cannot |
| Persistent movements | 15 across 12 scenarios | no trajectory editor |
| Authored initial-fluid fields | 45 | 44 accepted by runtime; 1 silently discarded |
| Accepted authored fluid fields | 44 | 37 live controls (84%); 31 setup controls (70%) |
| Authored wall fields | 33 | 3 direct, 1 partial, 1 derived, 17 missing, 11 presentation-only |
| Event directives | 3 feeder toggles, 2 deformation, 1 etch, 5 film | no parameterized Creative equivalents |

At the time of this historical baseline, the executable audit reported only a classification pass. The current audit is stricter: it fails missing representations, metadata, consumers, and non-responsive causal probes.

## P0 — correctness defects

### 1. Live controls can overwrite scenario truth with clipped values

`syncBrothSliders()` clamps the simulation value to each HTML range. Before every Creative action, `fortressStep()` then writes **every** slider value back into the simulation, including controls the player never touched. An out-of-range authored value is therefore replaced by the UI limit on the first action.

The audit found **33 authored initial values clipped across 17 scenarios and 14 fields**: Al, As, Ca, CO3, Cl, Cu, K, Mg, Na, Ni, O2, S, SiO2, and pH.

High-impact examples:

| Scenario | Field | Authored | Current live maximum | First-action result |
|---|---:|---:|---:|---:|
| `sabkha_dolomitization` | Na | 10,500 ppm | 200 ppm | 200 ppm |
| `sabkha_dolomitization` | Cl | 18,000 ppm | 500 ppm | 500 ppm |
| `radioactive_pegmatite` | SiO2 | 12,000 ppm | 2,000 ppm | 2,000 ppm |
| `gem_pegmatite` | SiO2 | 8,000 ppm | 2,000 ppm | 2,000 ppm |
| `stalactite_demo` | Ca | 2,500 ppm | 1,000 ppm | 1,000 ppm |
| `stalactite_demo` | CO3 | 2,500 ppm | 500 ppm | 500 ppm |
| `sulphur_bank` | pH | 1.8 | 2.0 minimum | 2.0 |

Required correction:

1. Dirty-track live controls and write back only controls the player actually changes.
2. Never use a view-range clamp as a simulation-state clamp.
3. Give each control a scientifically valid domain or an adaptive/logarithmic range capable of representing every authored value.
4. Add a test that starts every scenario, performs an untouched action, and proves all non-process state remains equal immediately before the step runs.

### 2. `SO4` is authored but silently discarded

`stalactite_demo` and `zoned_dripstone_cave` declare `SO4: 5`, but `FluidChemistry` has no `SO4` field. The constructor drops it. The current chemistry model uses `S` plus redox/speciation state as its canonical sulfur pool.

Required correction: migrate these declarations to the canonical sulfur representation and add a schema test that rejects unknown fluid keys. Do not add an independent sulfate slider unless the model first gains mass-balanced sulfate and sulfide pools; otherwise it would create two conflicting sources of sulfur truth.

### 3. Seven accepted, engine-relevant fluid fields have no live control

The missing fields are:

- Au, Cd, Hg, Sn, Ti, and Y
- salinity

These are not speculative placeholders. They are authored in shipping scenarios and/or consumed by active mineral engines. Salinity is especially important because it participates in activity/evaporite behavior, not merely color.

Add these to the same canonical control registry used by setup, live editing, snapshots, saves, and tests. Do not create another hand-maintained mapping.

### 4. Setup and live chemistry describe different fluids

Setup exposes 31 of the 44 accepted authored fields. It omits Al, Au, Ca, Cd, CO3, F, Hg, O2, SiO2, Sn, Ti, Y, and salinity. Six of those can be changed after Begin; seven cannot be changed at all.

This is more than an organization issue. The initial recipe captured for **Replenish** is taken at Begin, so changing a live-only field after Begin does not redefine the replenishing source fluid. The apparent custom broth and the actual source recipe can diverge.

Required correction: the start-state editor and live editor must be two views of the same complete fluid schema. “Replenishing source composition” should be an explicit editable boundary recipe, distinct from the current cavity fluid.

## P1 — missing geological levers

### Boundary conditions and host rock

Seventeen authored wall fields have no direct Creative equivalent:

- fluid/thermal system: `cooling_rate`, `open_system`, `inter_ring_diffusion_rate`
- host: `composition`, `thickness_mm`, `wall_Fe_ppm`, `wall_Mn_ppm`, `wall_Mg_ppm`, `graphitic`, `gamma_host`
- cavity/plumbing: `architecture`, `primary_bubbles`, `secondary_bubbles`, `shape_seed`, `zone_chemistry`
- geological context proxies: `air_mode_default`, `alpine_cleft`

`vug_diameter_mm` is only partially covered: the player can choose a size class midpoint, not a specific physical diameter.

The next boundary controls should be:

1. host composition and reactive wall inventory;
2. system openness, atmospheric connection, and atmospheric pCO2;
3. cooling rate / heat-source behavior;
4. exact cavity diameter, architecture, and host thickness;
5. spatial zone chemistry and diffusion rate;
6. radiation background and graphitic/carbonaceous host state.

`air_mode_default` should normally be derived from the initial water table and cavity state, not exposed as a mysterious engine flag. `alpine_cleft` should become a geological environment/structure choice or derive from cleft architecture and strain history.

### Hydrology

Creative has Seep, Flood, Drain, and Evaporate actions, plus a flow-rate slider. It does not have:

- an initial or exact live water-table control;
- host porosity/permeability controlling continuous drainage;
- a source/sink location editor;
- a separate replenishing-fluid composition and delivery rate;
- atmospheric/open-system gas exchange controls.

`VugConditions.porosity` and the water-surface state already exist. The scenario loader does not currently accept them as initial scenario fields, while events can set the water surface later. This is a schema and Creative coverage gap.

### Time-dependent geology

The movement engine already provides the right scientific primitive: a field, start/end steps, baseline, trend/pulse/step operators, bounds, optional mean-reverting texture, and optional spatial origin. Shipping scenarios use it for temperature, pH, Eh, SiO2, CO3, and B.

Creative has no movement/trajectory editor. Add one generic timeline builder rather than copying 274 named scenario events into 274 buttons. A player should be able to author, for example:

- slow cooling followed by a short reheating pulse;
- progressive oxidation or a reducing-fluid front;
- pH buffering, acid ingress, or CO2 degassing;
- a localized solute pulse from a feeder;
- cyclic wet/dry or flood/evaporation histories.

Named scenario events can then be reusable science-backed recipes made from those primitives.

### Spatial fluid plumbing

The fluid-spot engine supports seeded cracks, geysers, and hotspots, with supply and wall-decay effects. Creative constructs the simulator without a scenario configuration, so a default seeded spot field can still influence erosion while its locations, kinds, count, and state are invisible and uncontrollable. Creative also cannot enable deposition clustering or seal/breach feeders.

Add a feeder-network editor and overlay:

- count and kind;
- location or reproducible seed;
- supply and erosion strength;
- open/sealed state;
- deposition coupling;
- spatial origin for movement pulses.

This belongs beside the “why did this mineral form?” explanation because an invisible feeder is a causal geological input.

### Post-growth processes

Shipping events use parameterized deformation, etching, foreign-film dusting, and feeder seal/breach directives. Creative’s Tap/Shock pair only partially overlaps deformation and is not equivalent to specifying style, magnitude, timing, and affected minerals.

Add advanced process actions for:

- deformation style, magnitude, and target assemblage;
- physical chemical-etch episode, direct duration, and targets; morphology is a
  face/solution/rate-model output rather than a cosmetic style override;
- mineral/clay film deposition and coverage;
- fracture sealing and breaching.

These should create recorded timeline events so the specimen history and explanations can attribute the result to the process.

## Derived state and non-controls

Not every runtime field should become a slider.

- `Eh` and O2 are coupled in the current redox model. Creative should expose one canonical redox control with the other shown as a derived readout, plus an advanced disequilibrium/source mode where scientifically justified.
- `concentration` is a result of evaporation/rewetting. Keep it observable and process-driven unless a “set initial concentration factor” control has a clear physical meaning.
- `per_vertex_nucleation` is a model-resolution switch. Enable it automatically when spatial chemistry is active rather than asking the player to understand an implementation flag.
- `matrix`, `cavity_render`, directional-step/occlusion flags, and the six Wulff render opt-ins are currently presentation-only. Derive appearance from host/mineral/process state or place debugging overrides in view/developer settings, not ordinary geology controls.

Two dormant boundary fixtures—`wall_rock_thermal_buffer_C` and `host_rock_composition`—are attached to scenario state and have resolver plumbing, but no shipping scenario authors them and no active consumer currently uses the resolver output. Complete the physics before presenting them as working levers.

## Model-depth warning: pressure

Pressure is visible in setup and changed by Tap/Shock, but the current supersaturation code has only one direct pressure gate, for apophyllite above 0.5 kbar. It is not yet a general pressure-dependent thermodynamic system.

Creative still needs an exact live pressure/decompression control for completeness, but the UI should not imply broad pressure science until pressure is propagated into the relevant equilibria, phase stability, boiling/volatile behavior, deformation, and solubility models.

The live panel section currently labeled “Temperature & Pressure” contains only a temperature slider; that label should be corrected when the live pressure control is added.

## Recommended implementation order

1. **Protect authored truth:** dirty tracking, non-destructive slider sync, range/domain repair, and unknown-fluid-key rejection.
2. **Complete the fluid schema:** add Au/Cd/Hg/Sn/Ti/Y/salinity; unify setup/live/source-recipe controls; model sulfur source/speciation explicitly.
3. **Add exact environmental state:** live pressure, water table, porosity/permeability, exact cavity diameter, and clear derived readouts.
4. **Add boundary/host controls:** host composition/inventory, openness/pCO2, cooling rate, architecture, radiation, graphitic host.
5. **Add spatial controls:** zone chemistry/diffusion and visible, editable feeder networks.
6. **Add the timeline builder:** movements plus reusable pulse/mix/flood/oxidation recipes.
7. **Add post-growth processes:** deformation, etch, film, seal/breach with history attribution.
8. **Derive or quarantine renderer switches:** keep the geological UI about causes, not rendering implementation.

## Repeatable audit

Run:

```text
npm run audit:creative
```

The audit inventories the built scenario fleet, probes every event handler for state writes, parses the live-control setters and HTML domains, compares runtime/setup/live schemas, validates every derived-state declaration, and executes endpoint causal probes for all 44 chemistry controls. Missing provenance, coupling, consumers, representation, or downstream response fails `npm run ci`.
