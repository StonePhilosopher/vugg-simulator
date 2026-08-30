# Steer: 2c.3 Clustering Mechanism — Density Gradient, Not Pile

## The Call

2c.2 column-bias is correct to ship OFF. The builder's measurement stands: 1.4–1.8× over ~120 columns with sparse nucleation (~25–77 crystals) gives an expected feeder capture of ~0.3, which rounds to zero. Baseline churn for an invisible effect is not worth it.

The real path is a **per-cell proximity-decay supply weight** — feeder cell + decaying halo of neighbors. Here's the aesthetic direction:

## What Real Vugs Look Like

A feeder doesn't create a PILE of crystals at one point. It creates a **density gradient**:
- Highest density within ~2-3 cells of the feeder
- Tapering off to background rate by ~8-10 cells
- Some crystals still nucleate far from the feeder — the gradient is statistical, not a wall

The visual should read as "more crystals here" not "all crystals here." Think Poisson disk with variable density, not a stack.

## The Mechanism Sketch

Instead of weighting the column assignment (`_assignWallCell`), weight the **per-vertex placement probability** directly. The per-vertex sampler (85b-simulator-nucleate) already has the spatial heterogeneity that the per-vertex placement work said it needs.

The weight for a candidate cell should be:
```
placement_weight(cell) = base_rate * (1 + Σ_feeder boost * exp(-distance(cell, feeder) / decay_length))
```

Where:
- `boost` = feeder-specific multiplier (geyser: 3.0, hotspot: 2.0, crack: 1.0 — cracks are erosion-dominant, not deposition)
- `decay_length` = ~3-4 cells (tunable, but start here)
- Distance = graph-hop distance on the wall mesh (not Euclidean — the wall is a curved surface)

This routes through the **per-vertex sampler** (not the column assignment), which is where spatial heterogeneity belongs. The σ-starved sampler that per-vertex placement needed? This is it.

## The 2c.3 Demonstrator

Pick ONE science-grounded point-source scenario:
- **Punjab hematite** or similar: a distinct point-source fluid into an otherwise-static cavity
- NOT supergene's pervasive front (that's a global movement, not a point source)
- The `origin:'cell'` mechanism (2c.1) already models this geology correctly — acid pinned at d=0, recovering to bulk in ~8 hops

Scenario requirements:
- Has `origin:'cell'` movement configured
- Has at least one hotspot or geyser feeder (the supply > 1 kind)
- Visual payoff: you should SEE the clustering in the browser render
- Assemblage payoff: the feeder cell's column should capture >3 crystals (visible share)

## What "Visible" Means

For the render: the feeder area should look visibly denser than the opposite wall. Not 10× denser — maybe 2-3×. Enough that a human eye notices without a ruler.

For the assemblage: run the A/B observer. The ON case should show:
- The feeder column captures ≥3 crystals (vs. 0 for 2c.2)
- No expects_species lost (already true for 2c.2, should stay true)
- Size changes that make sense (clustered crystals compete → slightly smaller, not larger)

## My Bias

I lean toward **restraint over spectacle**. A real vug is irregular and messy. Cartoonish clustering looks like a video game power-up. What I want is the geological truth: fluids enter at a point, chemistry gradients form, crystals nucleate where conditions are right. The density follows the gradient. That's beautiful enough.

## Next Steps

1. Build the proximity-decay weight in js/85k (FluidSpotField) + js/85b (per-vertex sampler)
2. Keep the 2c.2 column-bias code — it's the fallback path and proves the plumbing works
3. Add a `proximityDecay` flag (default false until demonstrator proves it)
4. Pick the demonstrator scenario with the builder's input (I lean toward something MVT-related or a contact-metasomatic spot)
5. SIM bump + regen baselines when ready

The builder's instinct to verify-the-mechanism before baking is correct. Run the observer, measure, then commit.

— 🪨✍️
