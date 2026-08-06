# Vugg Simulator: science-first path to an AAA-quality title

## North star

Build the most convincing playable model of a mineral cavity: a game in which every striking specimen is a readable record of temperature, pressure, fluid composition, wall-rock reaction, time, and chance.

“AAA” is a quality bar here, not a promise that a small project can instantly acquire a blockbuster budget. The bar means a polished first-run experience, stable and responsive controls, high-end audiovisual direction, deep but legible systems, accessible play on every supported device, robust saves, and a production pipeline that can ship content without weakening the science.

The golden rule for every design decision is **follow the science**. When evidence conflicts with spectacle, preserve the causal model and improve how the game communicates it. That makes new minerals, localities, events, and rendering layers additive instead of requiring rules to be rewritten.

## Scientific product contract

1. **One canonical state.** Temperature, pressure, pH, redox, salinity, dissolved species, wall composition, geometry, crystal population, and time each have one authoritative representation. UI, saves, narration, rendering, and agent APIs read that state rather than maintaining approximations.
2. **Conserve what should be conserved.** Growth, dissolution, replenishment, and wall reaction use explicit mass balance. Energy and pressure changes use declared event sources or boundary conditions. No resource appears solely because an animation needs it.
3. **Separate observation from mechanism.** Mineral colors, habits, zoning, and inclusions are outputs of chemistry and history. Rendering may exaggerate a signal for legibility, but it must label the exaggeration and never feed it back into the simulation.
4. **Carry provenance and uncertainty.** Every scenario, equilibrium constant, empirical range, and artistic reconstruction records its source, units, applicable range, confidence, and last review. Disputed values become visible ranges or model alternatives, not hidden guesses.
5. **Determinism is a feature.** A versioned model plus seeds and player actions must reproduce a specimen. Simulation scheduling, animation speed, device speed, and rendering backend must not change the result.
6. **No decorative chemistry controls.** Every visible Creative control writes to canonical fluid state. Its effect can legitimately be zero when saturation, temperature, redox, co-reactants, substrate, or competition are unfavorable; the game must explain that outcome instead of faking growth.

## Player-facing pillars

- **Living geology:** watch a cavity evolve through pulses, cooling, boiling, mixing, oxidation, dissolution, nucleation, competition, breakage, and healing.
- **Readable causality:** select any crystal or event to see “why this formed,” limiting reagents, competing phases, saturation history, and the evidence behind the rule.
- **Specimens as stories:** each saved vug is a replayable geological record with seeds, version, conditions, actions, uncertainty, and a shareable specimen card.
- **Discovery with mastery:** guided localities teach one concept at a time; Creative mode exposes the full laboratory; challenge expeditions ask players to infer a history from an unknown specimen.
- **A museum worth building:** collecting, comparison, classification, photography, curation, and community challenges turn simulations into a long-lived game loop.

## Creative chemistry policy

Creative mode should not collapse its chemistry into a token “basic” panel while leaving real controls inert. Keep every implemented elemental slider active and organize the same complete system in two views:

- **Essential controls** are curated recipes and process controls: locality/preset, temperature, pressure, pH, redox regime, salinity, wall rock, cavity scale, reactivity, and thermal pulses.
- **Advanced chemistry** exposes the full species inventory, grouped by geochemical role rather than periodic-table aesthetics: major components, ligands/complexing species, sulfide-formers, redox-sensitive metals, chromophores, pegmatitic incompatibles, and trace/toxic species.

Both views edit the same `FluidChemistry` object. Each control needs units, a useful logarithmic or linear range, a literature-backed default, an accessible numeric entry path, and a live explanation of downstream consequences. A registry—not duplicated hand-written lists—defines the field name, DOM control, units, display transform, bounds, evidence, and relevant mineral consumers. Automated contract tests must fail if a visible slider is absent from that registry or cannot round-trip through a save.

The next chemistry expansion should surface the already-modeled major species currently available only through presets or live broth controls (for example silica, calcium, carbonate, fluorine, aluminium, oxygen/redox, and salinity), then add new species only when their thermodynamics, kinetics, mass balance, and tests are ready.

### Creative geological-lever coverage

Creative mode is the unrestricted expert laboratory, not an easy mode. Its complexity should be made inspectable and internally consistent rather than reduced by hiding real Earth-system controls.

Build a generated coverage audit across scenario definitions, event directives, movement fields, `FluidChemistry`, `VugConditions`, and wall/cavity state. Every scientifically meaningful input used by a shipped scenario must resolve to one of these outcomes:

1. **Direct state control:** set a canonical quantity such as temperature, pressure, pH, Eh, salinity, dissolved species, water level, or wall reactivity, with units and a numeric entry path.
2. **Boundary/source control:** configure fluid composition, flow, recharge, gas exchange, heat source, wall-rock reservoir, feeder location, or system openness.
3. **Process/action control:** apply a geologically named change through time—cooling, heating, boiling, mixing, oxidation, reduction, evaporation, drainage, dissolution, deformation, fracture reopening, sealing, or fluid pulsing—without bypassing the underlying physics.
4. **Derived observation:** expose the value in diagnostics but do not let the player set it directly because it is calculated from more fundamental variables (for example saturation, carbonate speciation, initiative, or fill fraction).
5. **Documented non-control:** keep internal numerical calibration, renderer-only parameters, and implementation scheduling out of the geological UI, with a machine-readable reason.

The audit must fail CI when a scenario/event gains a new geological input that has no Creative-mode representation or documented classification. Each exposed lever needs a physically meaningful range, units, provenance, coupling notes, save/replay support, and at least one automated test demonstrating an expected downstream response. Organize controls by geological system (fluid source, thermal/pressure history, acid-base/carbonate, redox, ligands/salinity, wall rock, hydrology, deformation, and time), while retaining search/filter for expert use.

### Implementation ledger — 2026-08-05

Implemented in the current working tranche:

- every setup and live chemistry range has a paired exact numeric entry; the canonical registry owns unit, bounds, step, scaling, label, geochemical group, provenance, coupling, consumers, and an executable causal probe;
- Creative setup/live chemistry search and group filtering preserve the complete expert laboratory without pretending that Earth chemistry is simple;
- the mineral formation hover reports final engine saturation, limiting reagents, temperature, pH, redox, relevant pressure/phase fields, substrate, competition/initiative, history, space, and transport;
- Creative's geological-lever audit covers pressure histories, confining pressure, stress, hydrology, wall/geometry state, all fluid species, and authored scenario/event inputs;
- fluid pressure, rock/confining pressure, and differential stress have separate meanings and controls; save/strip/agent/claim artifacts carry a semantic model digest;
- Germanium partition into sphalerite and sabkha replacement events conserve/propagate canonical chemical state under targeted tests;
- gypsum water activity and mixed Cu-Zn carbonate observations carry applicability and uncertainty into the hover rather than hiding science debt.

### Current acceptance boundary: v238 corrective tranche

This hostile-review loop decides only whether the current v238 science/Creative/mobile corrective tranche is internally correct, reproducible, honestly bounded, and safe to continue building on. It is **not** an AAA release gate and must not be described as completion of the production roadmap below.

The tranche can pass only with a clean build, full deterministic suite, strict strip/card identity, complete Creative causal audit, same-seed/conservation tests for changed mechanisms, and automated 320/360/390/430 px browser evidence with reachable hover/focus/tap and exact-number alternatives. Known model boundaries may pass only when no shipped scenario or explanation claims the missing mechanism and the limitation is visible at the point of interpretation.

### Long-term AAA release gates — still open

These block the future phase or AAA-release claim named below, but are outside the v238 corrective-tranche acceptance decision:

- real-device/browser viewport, touch, keyboard, and accessibility evidence across the stated mobile matrix;
- full worker-compatible immutable command/snapshot separation and long-run performance budgets;
- usability tests showing that players can explain formation causality;
- mass-conserving physical etch/dissolution for scenarios that need it (current authored etch/deformation/film directives are explicitly visual reconstructions);
- volatile-conserving boiling/phase separation, pressure-dependent aqueous speciation, and validated mixed-carbonate solid-solution thermodynamics;
- final independent professional mineralogist/geochemist sign-off. The internal “Dr. Wise” hostile loop is adversarial QA, not a substitute for that external sign-off.

No efficacy claim is made from automated causality-panel tests: whether new players can correctly explain a specimen remains a Phase-2 human-usability gate. Likewise, authored etch/deformation/film are labelled visual reconstructions and are excluded from mass-conservation testimony; volatile phase separation is absent rather than simulated by an unsupported pressure shortcut.

## Production roadmap

### Phase 0 — stabilize the playable foundation

Ship the current corrective tranche:

- repair title/menu markup and eliminate narrow-screen horizontal overflow;
- make navigation cancel hidden narrative input capture and allow long simulations to yield to the browser;
- give symbol-only controls accessible names and use mode-neutral empty-state language;
- replace the false “unimplemented sliders” message with the actual chemistry contract;
- consolidate every visible Creative chemistry slider behind one registry and test the DOM-to-fluid mapping;
- make asynchronous mineral data tests wait for the canonical dataset rather than inspecting the fallback snapshot;
- add mobile viewport, lifecycle, deterministic-seed, save round-trip, and chemistry-control checks to CI.

Exit gate: no critical/high user-facing defects, no unintended horizontal scroll at 320/360/390/430 px, no main-thread task over 100 ms during normal UI playback (individual engine steps are profiled separately), keyboard navigation does not activate hidden screens, and supported scenarios reproduce their baselines.

### Phase 1 — vertical slice

Bring three geologically distinct expeditions to final quality: an oxidized copper cavity (Bisbee), a giant-crystal hydrothermal system (Naica), and a pegmatitic/radioactive system. Each gets authored onboarding, locality context, scenario-specific objectives, a causality inspector, final specimen presentation, music/soundscape, and a scientifically reviewed narrative.

Move numerical simulation to a worker-compatible core with immutable commands and versioned snapshots. The renderer consumes snapshots; it never owns chemistry. Add progressive computation and cancellation so a 1,000-step run remains responsive. Establish budgets on representative low-end mobile, integrated laptop graphics, and desktop targets.

Exit gate: 30 fps minimum on supported mobile and 60 fps target on desktop during interaction, input response under 100 ms, deterministic results across worker/main-thread reference runs, autosave recovery, WCAG 2.2 AA interaction paths, and sign-off by an external mineralogist/geochemist on the slice.

### Phase 2 — legibility and progression

Add the scientific debugger as a player tool: saturation/affinity histories, limiting reagents, initiative/competition, wall contribution, phase stability windows, and “what changed?” comparisons. Teach these layers through field notebooks and specimen objectives rather than a separate textbook.

Build progression around capability and knowledge, not stat inflation: instruments unlock observations; better sampling reduces uncertainty; new sites introduce processes; Creative mode remains unrestricted. Version saves and scenario data, and provide migration plus an explicit legacy-model replay mode.

Exit gate: players can correctly explain the cause of a target mineral in usability tests, all outcomes exposed in narration trace back to canonical state, and content designers can author a reviewed scenario without modifying engine code.

### Phase 3 — AAA audiovisual layer

Adopt a physically based material pipeline for crystal habits, zoning, inclusions, translucency, fracture, wet surfaces, and wall rock. Use level-of-detail, instancing, temporal stability, and a 2D fallback. Procedural forms must remain constrained by mineral system and growth history; art direction can heighten readability without inventing species or impossible habits.

Add process-driven audio: fluid movement, cracking, precipitation, boiling, and ambience respond to state/events. Provide reduced motion, reduced flashes, color-vision-safe palettes, subtitle/caption equivalents for sonic cues, scalable text, remapping, touch target and controller support, and adjustable narration tempo.

Exit gate: consistent frame pacing and memory budgets across the device matrix, no scientific-state differences between render tiers, complete accessibility audit, and blind comparison tests showing that key geological events remain readable with audio off and color filters enabled.

### Phase 4 — content factory and game breadth

Create schema-validated, source-cited locality packs with automated unit/range checks, mass-balance tests, expected phase envelopes, seeded golden specimens, narrative linting, and review status. Expand into campaign expeditions, inference puzzles, time/energy/resource-constrained field missions, museum commissions, and weekly seeded challenges.

Exit gate: every shipped locality passes scientific review, deterministic golden tests, performance soak, localization layout, accessibility, save/replay compatibility, and a “no orphan chemistry” audit proving every authored input has a modeled consumer or a documented scientifically valid no-effect path.

### Phase 5 — release and stewardship

Run telemetry only with consent and collect performance/failure signals rather than private specimen contents. Maintain public model notes, citations, known limitations, and change logs. Model changes require an impact report, new baselines, save/replay handling, and scientific review. Community-created scenarios run through the same schema and evidence pipeline, with clear separation between reviewed, experimental, and fictional content.

## Engineering architecture

Use a small number of enforceable boundaries:

`Evidence-backed data → versioned simulation core → immutable snapshots/events → narration + renderers + UI → save/replay/share`

- The simulation core has no DOM or frame-timing dependency.
- Commands are serializable (`start`, `advance`, `inject`, `cool`, `replenish`, `finish`) and generate an event log.
- Snapshot schemas are versioned and compact enough for mobile replay.
- A chemistry-control registry generates setup UI, broth UI, save serialization, value formatting, tooltips, and contract tests.
- Scenario and mineral schemas validate units and ranges at build time.
- Fixed seeds, fixed action scripts, mass-balance invariants, metamorphic/property tests, and reviewed golden specimens form the scientific test pyramid.
- Browser automation covers real 320–430 px viewports, touch, keyboard, screen-reader names, slow devices, hidden-tab/resume, cancellation, offline load, and corrupted saves.

## Decision protocol: “follow the science”

For every proposed feature or balance change:

1. State the player problem and the geochemical claim separately.
2. Identify primary literature, accepted datasets, or an expert judgment; record applicability and uncertainty.
3. Express the mechanism in canonical variables with units and conservation constraints.
4. Predict observable outcomes and edge cases before tuning.
5. Implement the smallest general rule that produces those outcomes across multiple scenarios.
6. Validate against independent examples and deterministic tests.
7. Tune presentation, pacing, and objectives around the validated model—never the reverse.
8. Publish limitations and version the change when old specimens would replay differently.

This protocol future-proofs the game because additions compose with shared mechanisms. A new mineral should mostly contribute data, tests, and presentation; a new locality should mostly contribute initial/boundary conditions and events. If either requires special-case cheats in unrelated systems, the design has not yet found the right scientific abstraction.
