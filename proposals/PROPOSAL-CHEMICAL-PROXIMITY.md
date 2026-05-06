# PROPOSAL: Chemical Proximity — Why Crystals Grow on Their Relatives

**Author:** Rock Bot + Professor
**Date:** 2026-05-06
**Status:** Proposal for builder
**Companion to:** `PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md`

---

## Overview

The substrate-affinity table (Q1b) captures epitaxial lattice matching — similar crystal structures get a σ-discount on nucleation threshold. But there's a second, independent reason crystals prefer to nucleate on related minerals: **chemical proximity**.

An existing crystal is not just a structural template. It's also a local chemical reservoir. When the fluid changes (pH shifts, Eh rises, temperature drops), the crystal's own surface can release the exact elements a new mineral needs — right at the nucleation site.

## The Mechanism

Pyrite (FeS₂) sits in a vug. The fluid oxidizes (Eh rises). At the pyrite surface:

1. Pyrite oxidizes, releasing Fe²⁺ and sulfate into the immediately adjacent fluid
2. Goethite (FeO(OH)) needs iron — and iron is now concentrated at exactly the pyrite surface
3. Goethite nucleates on pyrite not just because the lattice is somewhat compatible (σ-discount), but because the local chemistry is already enriched in what goethite needs

The crystal is both substrate AND feedstock. The nucleation happens at the interface where the new mineral's required elements are most concentrated.

This is distinct from epitaxy. Two minerals with terrible lattice match but strong chemical overlap (e.g., malachite on azurite — different structure, same Cu-CO₃ chemistry) should still see an enhanced nucleation probability because the local Cu²⁺ and CO₃²⁻ concentrations near the azurite surface are higher than in the bulk fluid.

## What to Model

A second nucleation bonus (or threshold discount) applied on top of the existing σ-discount from the epitaxial affinity table. This bonus should be:

- **Stronger when the substrate and nucleating mineral share more formula elements**
- **Stronger when the substrate is actively dissolving** (supplying those elements to the local fluid)
- **Independent of lattice match** — chemical proximity and epitaxy are two separate reasons to nucleate on a relative

The existing σ-discount handles: "This surface has a similar crystal structure, so the energy barrier is lower."

Chemical proximity handles: "This surface is made of the same atoms I need, so my feedstock is already here."

## Real-World Examples

- **Goethite on pyrite** — pyrite oxidizes, goethite finds Fe at the surface
- **Malachite on azurite** — same Cu-CO₃ system, azurite dissolves → malachite grows
- **Smithsonite on sphalerite** — sphalerite oxidizes, Zn is right there
- **Cerussite on galena** — galena oxidizes, Pb is right there
- **Anglesite on galena** — same, but sulfate instead of carbonate
- **Erythrite on cobaltite** — Co released at the surface

Note: some of these are already in the substrate-affinity table as CDR (coupled dissolution-reprecipitation) routes. Chemical proximity is the underlying reason those CDR routes work — the replacement mineral nucleates where it does because the parent mineral is supplying its ingredients.

## Relationship to Existing Systems

- **Substrate-affinity table (Q1b):** handles epitaxial lattice-match discount. Chemical proximity is a separate column or modifier, not a replacement.
- **CDR pseudomorph routes (Q2a):** the pseudomorph route table already captures *which* replacements happen. Chemical proximity explains *why* they happen at the parent crystal's surface rather than randomly in the vug.
- **Mass balance (Phase 1e):** the local enrichment effect is a micro-scale version of what mass balance tracks at the vug scale. The parent crystal dissolving feeds the child crystal growing.

## Instructions for Builder

**Research the science first.** Before implementing any math:

1. Find the relevant literature on heterogeneous nucleation driven by chemical affinity (not just structural epitaxy). Look for papers on:
   - Local supersaturation enhancement near dissolving mineral surfaces
   - Coupled dissolution-reprecipitation (CDR) nucleation kinetics
   - Surface reaction-controlled vs transport-controlled nucleation
   - Putnis & Putnis 2007 (JMPS) on interface-coupled dissolution-reprecipitation is probably the key reference

2. Determine whether chemical proximity is best modeled as:
   - A σ-discount multiplier (reducing the nucleation threshold)
   - A local supersaturation bonus (increasing the effective concentration of shared species near the substrate surface)
   - A separate probability modifier
   - Or something else entirely based on what the science says

3. Design the formula based on what the research supports. The shared-element count is a reasonable proxy, but the actual implementation should reflect the physics, not just intuition.

4. Calibrate against the same seed-42 baselines. The chemical proximity bonus should produce realistic cascade effects (goethite-on-pyrite, malachite-on-azurite) without making everything nucleate on everything.

## Key Principle

The substrate-affinity table was calibrated from crystallographic misfit data (Ramdohr 1980, etc.). Chemical proximity should be calibrated the same way — from the geochemical literature, not from guessing. The science exists. Find it. Use it.

---

*Professor's insight: the precursor chemicals are already in the crystal. The crystal is its own best neighbor.*
