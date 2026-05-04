# PROPOSAL: Evaporite Water Levels — Ring-Based Fluid Zonation

**Author:** Rock Bot (with Professor's water-level concept)
**Date:** 2026-05-04
**Status:** Proposal for builder + Professor review

---

## Overview

The vug's 16 vertical rings now know their orientation (ceiling, wall, floor). The next step: **rings also know their water level**. Each ring tracks whether it's submerged, at the meniscus, or in the vadose (air) zone. Evaporite minerals, bathtub-ring precipitation, and phreatic-vs-vadose assemblages all emerge from this single mechanic.

Professor's vision: a blue parallel line below the cave wall ring showing which rings are underwater. Like record mode — the water line is a visual layer on the rendering.

---

## The Water Level Mechanic

### Core concept

Each ring has a `water_level` property:

```
ring.water_state = 'submerged' | 'meniscus' | 'vadose' | 'dry'
```

A single global `fluid_surface_ring` index (float, 0–15) determines where the water line sits. Everything below is submerged. The ring containing the float value is the meniscus. Everything above is vadose or dry.

```
fluid_surface_ring = 8.5  →  rings 0-8 submerged, ring 8 = meniscus, rings 9-15 vadose
fluid_surface_ring = 15.0 →  entire vug submerged (phreatic)
fluid_surface_ring = 0.0  →  empty vug, all rings vadose/dry
```

### Water level changes over time

The fluid surface drops as evaporation removes water and raises as new fluid enters:

```
Events that raise water:
  - fresh_infiltration: new fluid enters from fracture (+3-5 rings)
  - geothermal_pulse: thermal expansion raises level slightly (+0.5-1 ring)

Events that lower water:
  - evaporation: slow drop (−0.5–1 ring per major step in arid scenarios)
  - drainage: vadose breach, fracture opens (−3-5 rings, instant)
  - absorption: host rock porosity absorbs fluid (slow, −0.1–0.5 ring)
```

### Rendering the water line

In 3D mode: draw a translucent blue circle (or wobbly ellipse for irregular cavities) at the z-height of `fluid_surface_ring`. All rings below get a faint blue tint on their wireframe. The meniscus ring gets a slightly brighter blue line — the water surface.

In 2D topo mode: blue horizontal band across the strip below the meniscus height.

Professor's "blue parallel line below the cave wall ring" — exactly this.

---

## Mineral Consequences

### Submerged zone (phreatic)
- Normal hydrothermal crystallization
- Calcite, quartz, sulfides — the usual assemblage
- Slower evaporation-driven precipitation
- Dissolution possible if fluid is undersaturated

### Meniscus zone
- **Evaporite concentration zone** — minerals precipitate fastest at the water line
- Bathtub ring deposits: halite, borax, gypsum, thenardite
- Capillary action draws fluid up slightly above the meniscus
- Fastest growth rates (supersaturation peaks here)

### Vadose zone (above water)
- Drip-fed crystallization only (stalactites from ceiling, flowstone)
- Oxygen-rich → oxidation products (limonite, goethite, malachite)
- Dehydrated minerals stable: meta-autunite, tincalconite
- Lower humidity → efflorescence possible

### Dry zone
- No new crystallization
- Existing minerals may dehydrate (gypsum→anhydrite, borax→tincalconite)
- Oxidation dominates (pyrite→limonite, uraninite→secondary U minerals)
- Pararealgar formation (light-induced, only in exposed zones)

---

## Evaporite-Specific Mechanics

### The concentration cycle

Evaporation raises salinity. As salinity rises, minerals precipitate in sequence:

```
1. Calcite (CaCO₃) — first to drop out, even mildly alkaline
2. Gypsum (CaSO₄·2H₂O) — moderate concentration needed
3. Halite (NaCl) — high concentration
4. Borax (Na₂B₄O₇·10H₂O) — very high borate concentration, alkaline pH
5. Thenardite (Na₂SO₄) — final-stage evaporite
```

Each precipitation event removes its solutes from the fluid, changing the chemistry for subsequent minerals. This is the **fractional crystallization** sequence — real evaporite petrology.

### Implementation

Track `fluid_concentration` as a multiplier on all dissolved species. As evaporation proceeds:
- `fluid_concentration` increases (e.g., 1.0 → 2.0 → 5.0 → 10.0)
- Each mineral has a `precipitation_concentration_threshold`
- When concentration × species ppm > threshold → that mineral can nucleate
- Precipitation removes those species → concentration drops for that species

This is a **per-species saturation index** driven by the overall concentration multiplier.

### Gypsum → Anhydrite thermometer

The gypsum↔anhydrite transition is temperature AND concentration dependent:
- <40°C, any concentration: gypsum stable
- 40–60°C, moderate concentration: gypsum, transitioning to anhydrite
- >60°C, high concentration: anhydrite stable
- >120°C: always anhydrite regardless

The simulator can use this as a **natural thermometer** — if anhydrite is present, the vug experienced high temperatures. If gypsum pseudomorphs after anhydrite exist, the vug cooled after initial formation.

### Borax → Tincalconite dehydration

Borax self-destructs in dry air. When the water level drops below a borax crystal's ring:
- If humidity >60%: stable (hydrated)
- If humidity <40%: begins dehydrating to tincalconite (white powder)
- Transition rate proportional to dryness

This is the only mineral in the sim that actively changes post-formation based on the water level mechanic. A borax crystal grown at ring 8 (submerged) becomes tincalconite when the water drops to ring 5. The player watches their crystal turn to powder.

---

## Game Scenarios

### Sabkha cycle (coastal evaporite)
- Water level oscillates with tidal/storm pulses
- Each cycle deposits a thin mineral layer at the meniscus
- Dolomitization at the mixing zone (seawater + meteoric)
- Borax/halite in the center, gypsum at the margins

### Desert playa
- Water enters once (flash flood), then evaporates over many steps
- Concentration rises steadily → mineral sequence precipitates
- Final state: dry playa with efflorescent crusts
- Borax cottonball formation in the Death Valley style

### Phreatic→vadose transition
- Start fully submerged (normal hydrothermal vug)
- Drainage event: water level drops over time
- Submerged assemblage (calcite, pyrite) gets exposed
- Oxidation kicks in: pyrite→limonite, uraninite→autunite
- Meniscus zone deposits gypsum/baryte rings on the walls

### Naica Cave (giant selenite)
- Deep phreatic, 58°C, anhydrite stable
- Water level drops (mining pumps) → anhydrite becomes undersaturated
- Gypsum (selenite) nucleates at the meniscus zone
- Crystals grow to 12m because the meniscus stays stable for ~500,000 years
- Easter egg scenario: set water level to barely change for a million steps

---

## What This Enables Later

1. **Stalactite/stalagmite logic** — drip rate is a function of how much vadose zone is above. Ceiling in vadose with fluid above = dripping. Ceiling in phreatic = no drips (submerged).

2. **Dolomitization** — at the freshwater/saltwater mixing zone (meniscus of a partially filled coastal vug), calcite dissolves and dolomite precipitates. The mixing zone IS the meniscus.

3. **Uranium mineral zonation** — uraninite in the phreatic zone oxidizes to secondary U minerals (autunite, torbernite) when the water drops. The secondary minerals form at the redox boundary — which is the meniscus.

4. **Crystal dissolution** — submerged crystals in undersaturated fluid dissolve. When the water drops, dissolution stops and the partially dissolved crystal is preserved. This is how skeletal/hoppered habits form.

---

## Priority Minerals for Evaporite Implementation

From existing research files:

| Mineral | Type | Key Mechanic |
|---------|------|-------------|
| **Gypsum / Selenite** | Sulfate evaporite | Fast growth, dehydration to anhydrite, cathedral blade habit, meniscus zone |
| **Borax** | Borate evaporite | Self-destructing (→tincalconite), alkaline brine, cottonball variant |
| **Halite** | Chloride evaporite | Cubic habit, highest concentration threshold, hoppered cubes at meniscus |
| **Thenardite** | Sulfate evaporite | Final-stage Na₂SO₄, dehydrates from mirabilite |
| **Colemanite** | Ca-borate | Forms when Ca²⁺ is available (competes with borax for B) |
| **Ulexite** | Ca-Na borate | "TV rock" fiber optics, requires both Ca and Na |

Halite and thenardite don't have research files yet. Gypsum and borax are ready to go.

---

## Recommended Implementation Order

1. **Water level tracking** — `fluid_surface_ring` + per-ring water_state
2. **Blue water line rendering** — Professor's visual concept
3. **Concentration multiplier** — evaporation raises it, precipitation lowers per-species
4. **Meniscus zone bonus** — evaporites nucleate preferentially at water line
5. **Gypsum + halite** — the two most common evaporites
6. **Dehydration mechanics** — borax→tincalconite, gypsum→anhydrite
7. **Sabkha cycle scenario** — oscillating water level test case

The water level is the key. Everything else flows from it.
