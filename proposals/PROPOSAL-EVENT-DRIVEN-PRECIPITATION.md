# PROPOSAL: Event-Driven Precipitation — Fluid Pulses, Oscillatory Zoning, and Rapid Growth Episodes

**Author:** Rock Bot + Professor
**Date:** 2026-05-20
**Status:** Research proposal — calling for implementation design
**Companion to:** `PROPOSAL-BOTRYOIDAL-GROWTH.md`, `PROPOSAL-VOLATILE-GASES.md`, `PROPOSAL-EVAPORITE-WATER-LEVELS.md`
**Motivating specimen:** TN457 — pink barite on sphalerite, England (probable Cumbria). Thousands of tabular barite crystals stacked in coin-like columns, 5+ growth stages, mild blue/white UV fluorescence (hydrozincite).

---

## Overview

The Vugg Simulator currently grows crystals through gradual, quasi-equilibrium processes — species accumulate in the broth, saturation states rise, and minerals precipitate when thresholds are crossed. This produces realistic results for slow-growth scenarios, but it misses a major category of natural mineral formation: **event-driven precipitation**.

In nature, many spectacular mineral specimens form not from slow equilibrium, but from **sudden, episodic events** — fluid pulses, mixing events, temperature quenches, pH shocks, redox swings, or degassing episodes. Each event triggers a burst of nucleation and growth that may last minutes to days, followed by quiescence until the next event. The result is:

- **Oscillatory zoning** — compositional bands within single crystals
- **Columnar/stacked growth** — epitaxial overgrowths recording repeated pulses
- **Botryoidal crusts** — thousands of microcrystals nucleating simultaneously
- **Paragenetic sequences** — minerals A, B, C, D precipitating in discrete episodes, not simultaneously

The TN457 barite specimen demonstrates this perfectly: thousands of tabular barite crystals, each a stack of ~50 individual growth episodes, nucleated on sphalerite crystal terminations and recording rapid fluid chemistry oscillations. The "coin stack" morphology is the mineralogical signature of event-driven precipitation.

This proposal calls for research into implementing event-driven precipitation mechanics in the Vugg Simulator.

---

## What Event-Driven Precipitation Actually Is

### The Science

**Oscillatory zoning** in minerals (first documented in plagioclase, now known in barite, calcite, quartz, and many others) forms when crystal growth alternates between fast and slow, or between different compositional regimes. The leading mechanisms include:

1. **Episodic fluid flow** — hydrothermal fluid pulses enter the vug, mix with resident fluid, trigger supersaturation, then the system equilibrates until the next pulse (Putnis & Perthuisot 2001, Jamtveit et al. 2000)
2. **Self-organization** — growth itself changes the boundary layer chemistry, creating feedback loops that oscillate without external forcing (L'Heureux 1993, Wang & Merino 1992)
3. **Fluid mixing** — two chemically contrasting fluids meet at an interface; mixing induces precipitation along a moving reaction front (Zhang et al. 2021)
4. **Oscillating flow** — periodic flow reversals sustain and amplify mixing-induced precipitation by preventing the formation of a self-limiting precipitate layer (Yang & Balhoff 2023)

**Key insight from the literature:** Oscillatory zoning requires fluid flow to be episodic, with periods of reduced growth between individual pulses of channelized hydrothermal fluid flow. The mineral records the pulse history as compositional bands.

### The TN457 Case Study

The English barite specimen shows:
- **Sphalerite base** — earliest phase, cubic crystal terminations providing heterogeneous nucleation sites
- **Pink barite stacks** — thousands of tabular crystals, each composed of ~50 individual growth layers, nucleated preferentially on sphalerite points (high-energy surfaces)
- **White druzy overgrowth** — late-stage quartz or hydrozincite coating
- **Hydrozincite fluorescence** — blue-white under UV, indicating Zn-rich late fluid
- **Rapid growth signature** — the coin-stack morphology only forms when deposition is fast enough that individual crystal faces don't have time to develop fully before the next growth pulse arrives

The pink color (Mn²⁺-activated) distributed across all stacks suggests Mn was present throughout the fluid history, but its concentration varied per pulse — some tabs are pinker than others, recording Mn availability at that moment.

---

## Why This Matters for the Vugg Simulator

### Current Limitations

The simulator's growth model assumes:
- Continuous fluid chemistry (no pulses)
- Single saturation state per mineral at any moment
- Gradual growth rates determined by equilibrium chemistry
- No memory of past events in the current growth conditions

This produces beautiful euhedral crystals but cannot generate:
- Zoned crystals with compositional bands
- Epitaxial columnar stacks
- Botryoidal crusts from mass nucleation events
- Realistic paragenetic sequences where mineral A forms, then stops, then mineral B forms

### What Event-Driven Precipitation Would Add

1. **Fluid pulse system** — discrete events that inject new chemistry, change temperature, or alter pH/Eh
2. **Nucleation memory** — crystals remember where they nucleated and continue growing epitaxially in subsequent pulses
3. **Growth rate dependence** — fast growth produces different habits than slow growth (stacked tabs vs. euhedral prisms)
4. **Compositional recording** — each growth pulse records the fluid chemistry at that moment as a compositional band
5. **Event sequencing** — minerals form in order determined by the sequence of fluid events, not just by equilibrium chemistry

---

## Proposed Research Questions

This proposal calls for research and design work to answer the following questions:

### 1. Event Trigger Mechanisms
What should trigger precipitation events in the simulator?
- **External triggers:** Random fluid pulses, temperature quenches, evaporation episodes, gas injection (CO₂, H₂S)
- **Internal triggers:** Self-organized oscillations from growth feedback, supersaturation threshold crossings
- **Mixed triggers:** External events create conditions where internal feedback takes over

How should event frequency and magnitude be parameterized? Should they be:
- Purely random (Poisson process)?
- Seasonally/periodically driven?
- Correlated with other vug conditions (e.g., more events at higher temperature)?

### 2. Nucleation vs. Growth Epitaxy
When a fluid pulse arrives, should it:
- Always create new nuclei (mass nucleation → botryoidal crusts)?
- Preferentially grow existing crystals (epitaxy → columnar stacks)?
- Some probabilistic mix depending on supersaturation degree and substrate availability?

The TN457 barite suggests that on a favorable substrate (sphalerite points), new barite nucleates heterogeneously. But once a barite crystal exists, subsequent pulses grow epitaxially on it rather than nucleating new crystals. The result is columnar stacks, not scattered individual crystals.

How does the simulator represent "favorable substrate" for heterogeneous nucleation?

### 3. Growth Rate and Habit
How does growth rate affect crystal habit in the simulator?
- **Slow growth** (near-equilibrium): euhedral crystals with well-developed faces
- **Fast growth** (high supersaturation): skeletal crystals, hopper faces, or tabular/stacked habits
- **Very fast growth** (quench conditions): dendritic or spherulitic forms

The TN457 barite "coin stacks" suggest an intermediate rate: fast enough that individual tabs are thin and numerous, but not so fast that crystals become skeletal or dendritic.

Can the simulator model a continuous spectrum from euhedral → stacked → skeletal → dendritic based on supersaturation and growth rate?

### 4. Compositional Zoning
How should compositional variation be represented?
- **Option A:** Each growth pulse is a discrete "layer" with fixed composition. Visualized as bands.
- **Option B:** Continuous compositional variation within a single crystal, driven by boundary layer chemistry.
- **Option C:** Hybrid — continuous background variation with discrete event bands superimposed.

For the TN457 barite, Option A seems most appropriate: each tab is a growth pulse with slightly different Mn²⁺ concentration, producing visible color variation across the stack.

### 5. Episodic Fluid Chemistry
How should fluid chemistry vary between events?
- **Pristine pulses:** Each event injects fresh fluid with chemistry independent of the resident fluid
- **Mixed pulses:** New fluid mixes with resident fluid, creating intermediate compositions
- **Evolutionary sequence:** Early events have one chemistry, later events evolve (e.g., cooling magma → evolved fluids)

The barite specimen's uniform pink color across all stacks suggests the Mn²⁺ was present throughout the fluid history, but the hydrozincite overgrowth (Zn-rich, late-stage) suggests a later fluid pulse with different chemistry.

---

## Connection to Existing Proposals

This proposal complements and extends several existing simulator features:

- **PROPOSAL-BOTRYOIDAL-GROWTH.md** — Mass nucleation events are one type of precipitation event; botryoidal growth is the morphological outcome when nucleation dominates over epitaxy
- **PROPOSAL-VOLATILE-GASES.md** — Gas injection (CO₂ degassing, H₂S release) is a natural event trigger that changes pH and redox, driving precipitation
- **PROPOSAL-EVAPORITE-WATER-LEVELS.md** — Evaporation events concentrate dissolved species, creating supersaturation spikes that trigger precipitation
- **PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md** — Event sequencing is the mechanistic driver of paragenetic sequences; mineral A forms in Event 1, mineral B in Event 2, etc.
- **PROPOSAL-THERMAL-REGIMES.md** (referenced in MEMORY.md but not yet detailed) — Temperature quenches as event triggers

---

## Implementation Sketch (Preliminary)

### New Data Structures

```python
class FluidEvent:
    """A discrete fluid pulse that changes vug conditions and may trigger precipitation."""
    event_type: str  # 'pulse', 'quench', 'mixing', 'degas', 'evap', 'redox_shift'
    timestamp: float  # simulation time when event occurs
    magnitude: float  # intensity of the event (affects supersaturation spike)
    duration: float  # how long the event lasts (seconds to days)
    fluid_composition: dict  # ion concentrations injected by this event
    temperature_delta: float  # temperature change caused by event
    pH_shift: float  # pH change
    Eh_shift: float  # redox change

class GrowthEpisode:
    """A single growth pulse recorded in a crystal's history."""
    episode_id: int
    start_time: float
    end_time: float
    growth_rate: float  # fast vs. slow
    fluid_composition: dict  # chemistry during this episode
    crystal_habit: str  # 'euhedral', 'tabular', 'skeletal', 'dendritic'
    color_factors: dict  # trace element concentrations affecting color

class Crystal:
    """Extended to include growth history."""
    # ... existing fields ...
    growth_episodes: list[GrowthEpisode]  # chronological record
    nucleation_event: FluidEvent  # which event created this crystal
    nucleation_substrate: str  # what it nucleated on ('matrix', 'mineral_A', 'vesicle_wall')
```

### Event Loop Extension

```python
def process_events(vug, current_time):
    """Check for pending events and apply them."""
    for event in vug.pending_events:
        if event.timestamp <= current_time:
            apply_event(vug, event)
            
def apply_event(vug, event):
    """Apply a fluid event to the vug conditions."""
    # Mix event fluid with resident fluid
    vug.fluid = mix_fluids(vug.fluid, event.fluid_composition, event.magnitude)
    vug.temperature += event.temperature_delta
    vug.pH += event.pH_shift
    vug.Eh += event.Eh_shift
    
    # Calculate supersaturation spike
    for mineral in vug.minerals:
        saturation = calculate_supersaturation(mineral, vug.conditions)
        if saturation > mineral.nucleation_threshold:
            if event.magnitude > mineral.epitaxy_threshold and has_favorable_substrate(mineral, vug):
                # Epitaxial growth on existing crystals
                grow_epitaxially(mineral, vug, event)
            else:
                # Mass nucleation
                nucleate_massively(mineral, vug, event)
```

### Visualization Ideas

- **Growth rings:** Crystals show concentric bands or stacked layers when examined in detail view
- **Event timeline:** A "vug history" panel showing the sequence of fluid events and what each one produced
- **Paragenetic diagram:** Visual flowchart showing mineral A → mineral B → mineral C as events unfold
- **Coin-stack morphology:** For fast-grown tabular minerals, render as stacked discs rather than single prisms

---

## Call for Research

This proposal identifies the need but does not yet specify the full implementation. The following research tasks are needed:

1. **Literature review:** Survey oscillatory zoning mechanisms across mineral types (barite, calcite, quartz, plagioclase, etc.) to identify common principles vs. mineral-specific behaviors
2. **Mathematical modeling:** Define the relationship between event magnitude, supersaturation, growth rate, and crystal habit. What equation governs the transition from euhedral → tabular → skeletal?
3. **Substrate modeling:** How does the simulator represent heterogeneous nucleation sites? What makes a surface "favorable" for epitaxy?
4. **Event scheduling:** Design the event generation system — random, periodic, correlated, or user-triggered?
5. **Performance considerations:** Storing growth episode history for every crystal could be memory-intensive. What's the right granularity?
6. **Validation:** How do we test that event-driven precipitation produces realistic results? What natural specimens should we compare against?

---

## Specimens for Validation

If implemented, the following real specimens could validate the event-driven precipitation model:

| Specimen | Mineral | Feature | What It Tests |
|----------|---------|---------|---------------|
| **TN457** | Barite on sphalerite | Coin-stack epitaxy | Epitaxial growth on favorable substrate, rapid pulses |
| **Mexican amethyst flat** | Amethyst + calcite | Cherry-red MW calcite fluorescence | Sequential mineral formation (quartz first, calcite second), iron depletion |
| **TN505** | Manganoan calcite | Mn²⁺ banding | Oscillatory chemistry within single mineral type |
| **TN510** | Chalcedony pseudomorph | Zeolite → silica replacement | Dissolution event followed by precipitation event |
| **Thompsonites** | Mesolite/thomsonite | Scolecite epitaxy on thompsonite | Mineral A creates substrate for mineral B |

---

## Summary

Event-driven precipitation is not an edge case in mineralogy — it is the dominant formation mechanism for many of the most visually spectacular and scientifically informative specimens. The TN457 barite, with its thousands of stacked growth episodes recording fluid pulse after fluid pulse, is a textbook example of what the Vugg Simulator should be able to model.

This proposal calls for research into:
- How fluid events trigger precipitation
- How crystals record events as compositional and morphological signatures
- How the simulator can represent the full spectrum from equilibrium growth to episodic quench growth

The stone remembers the river. The simulator should remember the fluid.

---

## References (Selected)

- Jamtveit, B., Wogelius, R.A., & Fraser, D.G. (2000). *Noise and oscillatory zoning of minerals*. Geochimica et Cosmochimica Acta.
- L'Heureux, I. (1993). *Oscillatory zoning in crystal growth: a constitutional undercooling mechanism*. Physical Review E.
- Putnis, A. & Perthuisot, J-P. (2001). *A model of oscillatory zoning in solid solutions grown from aqueous solutions: Applications to the (Ba,Sr)SO₄ system*. Geochimica et Cosmochimica Acta.
- Wang, Y. & Merino, E. (1992). *Self-organizing origin of oscillatory zoning in crystals*. American Journal of Science.
- Yang, W. & Balhoff, M. (2023). *Oscillating Flow Leads to Sustained and Enhanced Mixing-Induced Mineral Precipitation in Porous Media*. InterPore.
- Zhang, Y., et al. (2021). *Precipitation Reaction Mechanisms of Mineral Deposits Simulated with a Fluid Mixing Model*. Advances in Materials Science and Engineering.
- Reich, M., et al. (2023). *Formation of giant iron oxide-copper-gold deposits by superimposed episodic hydrothermal pulses*. Scientific Reports.

---

*"The spring that never yields is the one that eventually snaps." — Colette, 2026*
*"Each coin-stack is a growth episode recording the fluid's pulse." — Professor, 2026*
