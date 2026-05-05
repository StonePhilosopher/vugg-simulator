# PROPOSAL: Botryoidal Growth — Mass Nucleation and Competitive Spherulites

**Author:** Rock Bot + Professor
**Date:** 2026-05-05
**Status:** Proposal for builder
**Companion to:** `PROPOSAL-WIREFRAME-CRYSTALS.md`

---

## Overview

Botryoidal minerals (malachite, chalcedony, goethite, hematite "kidney ore") don't form as single crystals. They form as **radiating aggregates of thousands of microcrystallites** that nucleate simultaneously and compete for dissolved material. The grape-cluster shape emerges from this competition, not from individual crystal habit.

The current simulator treats every crystal as a single euhedral object with a wireframe primitive. Botryoidal forms need a fundamentally different nucleation and growth model: **mass nucleation → impingement → competitive surface evolution → emergent botryoidal shape**.

---

## What Botryoidal Growth Actually Is

### Phase 1: Mass nucleation event

A sudden supersaturation spike (rapid cooling, evaporation, pH shift, redox change) creates conditions where **dozens to hundreds of nuclei form simultaneously** on a substrate surface. The trigger is typically:
- Evaporation concentrating the fluid beyond threshold
- pH shift (e.g., CO₂ loss raising pH → carbonate precipitation)
- Redox shift (e.g., Fe²⁺ oxidizing to Fe³⁺ → goethite)
- Temperature drop reducing solubility

The nuclei are extremely small (micrometers) and densely packed. They're too close for any single one to grow a proper crystal face.

### Phase 2: Radiating growth + impingement

Each nucleus grows outward, roughly perpendicular to the substrate. Individual crystallites are typically **fibrous or acicular** (needle-like), even if the bulk mineral isn't normally fibrous — the confined space forces elongation in the growth direction.

As crystallites grow, they **impinge** on neighbors. The boundary between two competing crystallites becomes a compromise boundary — neither gets to express its full crystal symmetry. The result is a radiating fan of fibers with irregular internal boundaries.

### Phase 3: Competitive surface evolution

The growth front (outer surface of the aggregate) is initially flat or follows the substrate contour. But small perturbations amplify:
- A crystallite that sticks out slightly **gets more fluid access** → grows faster → sticks out more
- A crystallite that falls behind **gets starved** → grows slower → falls further behind
- This is **positive feedback** → bumps grow into domes → domes grow into hemispheres

The final shape is **botryoidal** (grape-like) because the dominant bumps achieve roughly hemispherical growth fronts. Between bumps, the starved crystallites form the valleys.

### Phase 4: Banding (optional)

If fluid chemistry oscillates (e.g., seasonal evaporation cycles, periodic CO₂ pulses), the growth front records **concentric bands** — each band is a growth episode with slightly different chemistry. This produces the beautiful banding seen in malachite, chrysocolla, and agate.

---

## Mineral-Specific Behavior

| Mineral | Trigger | Crystallite habit | Typical color | Banding |
|---------|---------|-------------------|---------------|---------|
| **Malachite** | Cu²⁺ + CO₃²⁺, pH rise, evaporation | Acicular fibers | Green (Cu²⁺) | Yes — concentric green bands |
| **Chrysocolla** | Cu²⁺ + SiO₂, low-T precipitation | Microcrystalline gel | Blue-green | Rare |
| **Goethite** | Fe²⁺ oxidation, pH >3 | Acicular needles | Yellow-brown to black | Sometimes |
| **Hematite "kidney ore"** | Fe³⁺ dehydration at high T | Microcrystalline plates | Steel gray to red | Rare |
| **Chalcedony** | Silica supersaturation, low-T | Micro-quartz fibers | Variable | Yes — agate banding |
| **Smithsonite** | Zn²⁺ + CO₃²⁺, pH rise | Micro-rhombohedral | Blue, green, yellow | Sometimes |
| **Rosasite** | Cu²⁺ + Zn²⁺ + CO₃²⁺, low-T | Acicular spherulites | Blue-green | No |

---

## Simulator Implementation

### New crystal mode: `growth_mode: 'botryoidal'`

Currently, all crystals are mode `'euhedral'` (single crystal with habit-determined faces). Botryoidal minerals use a different mode:

```typescript
interface Crystal {
  // EXISTING fields
  growth_mode: 'euhedral' | 'botryoidal';  // new field

  // BOTRYOIDAL-ONLY fields (undefined for euhedral)
  n_nuclei: number;          // how many micro-crystallites (5-50)
  bump_map: number[];        // per-nucleus height advantage (0.0-1.0)
  band_count: number;        // how many concentric bands formed
  dominant_bump: number;     // which nucleus "won" the competition
}
```

### Nucleation rules for botryoidal mode

When a mineral with `habit: 'botryoidal'` or `habit: 'reniform'` passes its saturation threshold:

1. **Check trigger conditions** — botryoidal nucleation requires a supersaturation *spike*, not just steady-state supersaturation. The supersaturation must exceed threshold by >50% in a single step (or within a few steps). Gradual approach doesn't trigger mass nucleation — it produces individual crystals instead.

2. **Generate nuclei cluster** — instead of one crystal, generate `n_nuclei` micro-crystallites on adjacent cells. `n_nuclei` = 5–50 depending on supersaturation intensity (higher spike = more nuclei). Each gets a random initial height advantage (`bump_map[i]`).

3. **Assign to a single Crystal object** — the cluster is tracked as one crystal with mode `'botryoidal'`, not 50 individual crystals. This avoids flooding the crystal registry.

### Growth rules for botryoidal mode

Each timestep:
1. Calculate total growth budget from supersaturation (same as euhedral)
2. **Distribute growth across bumps** — bumps with higher `bump_map` values get proportionally more growth (positive feedback)
3. **Starvation penalty** — bumps below the mean height get reduced growth (negative feedback for losers)
4. **Maximum curvature** — no bump can grow more than 2× the average (prevents unrealistic spikes)
5. **Band check** — if chemistry shifted since last growth step, increment `band_count`

### Rendering botryoidal crystals

The wireframe primitive `PRIM_BOTRYOIDAL` remains the visual representation — overlapping hemispheres. But the **number and size of bumps** should be driven by `n_nuclei` and `bump_map`:

- Low `n_nuclei` (5-10) → fewer, larger bumps → reniform (kidney-shaped)
- High `n_nuclei` (30-50) → many small bumps → smooth botryoidal (grape-cluster)
- `band_count` → render concentric ring lines on the bump surfaces (like agate banding)

### Dissolution of botryoidal crystals

Botryoidal minerals dissolve differently than euhedral ones:
- **Uniform dissolution** — the entire surface retreats at roughly the same rate (because all bumps are exposed equally)
- **No selective face dissolution** — there are no crystal faces to preferentially dissolve
- **Band preservation** — even after partial dissolution, the banding remains visible in cross-section

---

## Interaction with Existing Mechanics

### Water levels
- Botryoidal minerals at the **meniscus zone** get the highest supersaturation spikes (evaporation concentrates the fluid right at the water line). This is why bathtub-ring deposits are often botryoidal.
- Submerged botryoidal growth is slower (lower supersaturation) → fewer nuclei, larger bumps.
- Vadose botryoidal growth is thin-film deposition → very slow, produces mammillary (flowstone-like) forms.

### Evaporite chemistry
- Evaporation-driven supersaturation spikes are the classic botryoidal trigger
- Malachite botryoids often form during the evaporation phase of a vug's history
- Chalcedony botryoids (agate) form during silica-concentration events in evaporating basalt cavities

### Redox (future)
- Goethite botryoids require Fe²⁺ → Fe³⁺ oxidation at the growth front
- The redox boundary (where O₂ meets reducing fluid) is a prime botryoidal formation zone
- Hematite "kidney ore" forms at higher temperatures in oxidizing conditions

---

## Proposed Rendering Enhancement

Instead of a fixed wireframe primitive, botryoidal rendering could use a **procedural bump generation**:

```typescript
function renderBotryoidal(ctx, crystal, projection) {
  const { n_nuclei, bump_map } = crystal;
  const baseRadius = crystal.c_length_mm * mmToPx;

  for (let i = 0; i < n_nuclei; i++) {
    const bumpHeight = bump_map[i];
    const angle = (i / n_nuclei) * Math.PI * 2;
    const x = Math.cos(angle) * baseRadius * 0.6;
    const y = bumpHeight * baseRadius;

    // Draw hemisphere at (x, y) with radius proportional to bumpHeight
    ctx.beginPath();
    ctx.arc(projection.x + x, projection.y - y, bumpHeight * baseRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Overlay band lines if banded
  if (crystal.band_count > 0) {
    // Draw concentric arcs across the bumps
  }
}
```

This replaces the static `PRIM_BOTRYOIDAL` with a dynamic shape that reflects the actual nucleation history. A malachite that formed from a big spike (50 nuclei) looks different from one that formed slowly (8 nuclei).

---

## Test Cases

1. **Mass nucleation trigger**: supersaturation spike >150% of threshold → botryoidal mode. Gradual approach → single euhedral crystal.
2. **Bump competition**: initial random `bump_map` → after N growth steps, one bump should dominate (positive feedback).
3. **Banding**: chemistry oscillation (pH cycles) → band_count increments with each cycle.
4. **Evaporation trigger**: meniscus zone + concentration multiplier → botryoidal nucleation of malachite/chalcedony.
5. **Backward compatibility**: minerals without `growth_mode` field default to `'euhedral'`.

---

## The Key Insight

Botryoidal minerals aren't badly-formed crystals. They're **communities**. A single malachite "grape" is thousands of individual crystals that decided to grow together because the chemistry forced them into close quarters. The shape is emergent — nobody designed it. It's what happens when too many crystals compete for the same fluid.

The simulator currently treats every crystal as an individual. Botryoidal growth treats a crystal as a *population*. That's the conceptual shift.
