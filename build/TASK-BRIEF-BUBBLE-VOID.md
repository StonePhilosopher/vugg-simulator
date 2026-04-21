# TASK-BRIEF: Improved Naturalistic Void Shape

**Priority:** Replace Fourier profile with bubble-merge algorithm for more realistic vug shape.
**Replaces:** The Fourier-harmonic approach from Phase 1.

---

## What to Change

Replace the current Fourier-based irregular profile with a **bubble-merge** algorithm that produces botryoidal dissolution cavities.

### Algorithm — Two-Stage Dissolution

**Stage 1: Primary void** (2–5 large circles)
1. Plot N random seed points (`primary_bubbles`, default 3, range 2–5) within a bounding circle of diameter `vug_diameter_mm`
2. Grow a circle around each seed point to a random radius (40–70% of vug diameter)
3. Union all primary circles — this is the main cavity

**Stage 2: Secondary dissolution** (several small bubbles on outer edges)
4. For each primary circle boundary, spawn M random satellite points (`secondary_bubbles`, default 6, range 3–10) on or near the outer edge of the primary surface
5. Grow a small circle around each satellite (10–30% of vug diameter)
6. Union secondary circles with primary surface

**Final step:** Sample the combined union boundary at `cells_per_ring` (120) evenly-spaced angles to produce per-cell wall distances.

The result: a lumpy void with a clear primary cavity and smaller satellite alcoves dissolved out from the edges — exactly how real vugs form when primary dissolution is followed by percolating fluids eating out the walls.

### Why This Works

- Real vugs form by dissolution — acidic fluids eat cavities that grow and merge
- The botryoidal shape has **alcoves** (where circles overlap from inside) and **promontories** (where circles meet from outside), creating natural micro-environments for crystal growth
- Crystal growth geometry still works — each cell just has a different distance to the wall, same as now
- The shape is **seed-locked** (same seed = same random points + radii = same void)
- Still purely visual in Phase 1 — engines keep reading `mean_diameter_mm`

### Parameters

Add to scenario definitions:

```python
"primary_bubbles": 3,              # 2-5 large circles forming main cavity
"secondary_bubbles": 6,           # 3-10 small satellite circles on edges
"primary_size_range": [0.4, 0.7], # min/max radius as fraction of vug diameter
"secondary_size_range": [0.1, 0.3], # smaller satellites
```

Suggested defaults by scenario:
- Cooling/pulse: primary=2, secondary=3, tight ranges (near-spherical gas bubble)
- MVT: primary=3, secondary=8, wide secondary range (limestone dissolution)
- Porphyry: primary=3, secondary=6, moderate ranges (stockwork veins)
- Pegmatite: primary=4, secondary=5, moderate ranges (fracture pocket)
- Reactive wall: primary=3, secondary=10, wide ranges (aggressive acid)
- Supergene: primary=3, secondary=7, wide secondary range (complex oxidation)
- Ouro Preto: primary=2, secondary=4, tight ranges (vein in quartzite)

### Implementation

**In `WallState` constructor:**
1. Generate N primary seed points (seed-locked) within bounding circle
2. Generate N primary radii (seed-locked)
3. Union all primary circles — this is the main cavity
4. For each primary circle, spawn M satellite points along its outer boundary (seed-locked), offset slightly outward
5. Generate M small secondary radii (seed-locked)
6. Union secondary circles with primary surface
7. For each of 120 cell angles θ:
   - Cast a ray from center at angle θ
   - Find the intersection with the combined union boundary
   - That intersection distance = wall distance for that cell
8. Store per-cell radius in `rings[0][cell_idx].depth_mm`

**Ray-circle intersection:** For each ray at angle θ, find the maximum distance where the ray exits any circle. The outermost boundary point is the wall. This is standard computational geometry.

### What NOT to Change

- Growth engines (visual-only change)
- `mean_diameter_mm` calculation (still used by engines)
- Any mineral data
- The multi-ring data model
- Scenario event sequences

---

## Files to Touch

- `vugg.py` — replace Fourier profile in `WallState.__init__()` with bubble-merge
- `web/index.html` — mirror the same change
- `docs/index.html` — sync
- Scenario definitions — add `bubble_count` and `bubble_size_range` parameters

## Verification

1. Any scenario — void should be lumpy, botryoidal, with visible alcoves and promontories
2. Same seed = same shape (reproducible)
3. Crystals still grow correctly on irregular wall
4. Topo map renders the new shape
5. `bubble_count=1, bubble_size_range=[0.5, 0.5]` → perfect circle (backward compatible)
6. All 10 scenarios produce visually distinct void shapes

---

Commit. Do NOT push — I'll review and merge.
