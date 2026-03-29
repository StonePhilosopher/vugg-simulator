# Spiral Encoding of Crystal Growth History — Experimental Design

**Date:** 2026-03-29
**Authors:** 🪨✍️ (research), Professor (concept), Marey (validation framework)
**Status:** Proposal — needs Professor's mineralogical review

---

## The Claim

Crystal growth history can be encoded as a spiral in n-dimensional phase space, where:
- Each dimension corresponds to a Miller index face's relative growth rate
- The spiral extends outward over time (each revolution = one growth epoch)
- The "wobble" pattern — deviations from a smooth spiral — encodes environmental changes (temperature pulses, pH shifts, fluid mixing events)
- This encoding is analogous to a vinyl record groove: temporal structure is preserved in spatial modulation

**Marey's assessment:** Novel application of existing frameworks (phase portraits + signal processing) to a domain that hasn't used them this way. Not reinventing the wheel. Testable.

---

## What Already Exists (Prior Art)

### 1. Zircon CL Growth Kinematics (Vavra 1990, 1993)
**Key paper:** "On the kinematics of zircon growth and its petrogenetic significance" — Contributions to Mineralogy and Petrology

Vavra used cathodoluminescence (CL) photography of oriented zircon sections to reconstruct **relative growth rates of different crystal faces over time**. He showed:
- The prism {110} is most sensitive to supersaturation changes
- The steep pyramid {211} is controlled by impurity adsorption, not supersaturation
- Growth rate ratios between faces carry petrogenetic significance
- "Grabahnen" (growth paths between sectors) graphically represent growth kinematics

**Connection to our work:** Vavra extracted exactly the data our spiral would encode — face-specific growth rates over time — but presented it as static sector diagrams, not temporal spirals. The spiral encoding is a different visualization of the same underlying data.

### 2. Oscillatory Zoning + Signal Processing (Hoskin 2000, Halden)
**Key paper:** "Organization of oscillatory zoning in zircon: analysis, scaling, geochemistry, and model of a zircon from Kipawa" — Geochimica et Cosmochimica Acta

Used **wavelet analysis, Fourier transforms, and nonlinear analysis** on SEM backscatter grey-scale traverses across zircon oscillatory zoning. Found:
- 145 zones over 5130 μm at standard resolution
- 225 zones over 795 μm at high resolution (near rim)
- Both periodic AND nonlinear components in the zoning pattern
- Hurst exponents 0.14–0.28 = fractal scaling, anti-persistent (oscillatory) behavior

**Connection to our work:** This proves Marey's prediction — the wobble IS analyzable with signal processing tools. Fourier decomposition works. The periodic components correspond to environmental cycles; the nonlinear components correspond to self-organized growth dynamics at the crystal-fluid interface.

### 3. Sector Zoning in Calcite (Reeder & Paquette)
EPMA reveals Mn concentration differences up to **1000 ppm between growth sectors** in synthetic calcites. Different faces ({10-14} vs {01-18}) incorporate trace elements at dramatically different rates even when growing simultaneously from the same fluid.

**Connection to our work:** This is the physical mechanism that makes the spiral encoding possible. If different faces incorporate impurities differently, then a cross-section through a crystal preserves face-specific chemical signatures that can be read like tracks on a record. Each sector is a channel.

### 4. Chalcopyrite Specifics
Chemical zoning in chalcopyrite is "probably very common but rarely gives observable effects such as colour banding" (Craig & Vaughan, ore microscopy reference). This means:
- **Optical microscopy (reflected light):** Zoning usually invisible. Won't work for our experiment.
- **EPMA / SEM-EDS:** Can detect chemical variation zone by zone. This IS the accessible method.
- **CL:** Chalcopyrite is opaque — CL doesn't work for sulfides.

---

## The Experiment

### Phase 1: Proof of Concept (Can we extract the data?)

**Specimen:** Any well-crystallized chalcopyrite with visible {112} sphenoidal faces + modifying faces. Multiple growth stages preferred (e.g., overgrowths, color changes on surface).

**Method:**
1. **Cut and polish** a section through the crystal perpendicular to a principal axis
2. **SEM-EDS mapping** across the polished section — map Cu, Fe, S, and trace elements (Zn, Ag, Sn, etc.) at sufficient resolution to resolve individual growth zones
3. **Identify sector boundaries** — the lines between growth sectors corresponding to different crystal faces
4. **Extract growth rate data per sector** — zone widths within each sector give relative growth rates of each face over time

**Equipment needed:**
- SEM with EDS (university access — UCF, UF, or Florida Tech)
- Polished section preparation (thin section lab)
- Crystal with known orientation (indexed faces)

**Alternative for Phase 1 (cheaper):**
- Use a **well-zoned calcite** instead of chalcopyrite — much easier to section, CL works, oscillatory zoning is visible
- Professor has calcite specimens with known faces (dogtooth vs nailhead)
- CL reveals growth zones directly without expensive chemical mapping
- This proves the encoding concept on an easier mineral before tackling sulfides

### Phase 2: Build the Spiral

**Input data:** From Phase 1, extract a time series for each crystal face:
```
Face {hkl} → [growth_rate_t1, growth_rate_t2, ..., growth_rate_tn]
```

**Encoding:**
1. For each time step, plot each face's growth rate on a radar chart axis
2. The radar chart point at time t is a point in n-dimensional space (one dimension per face)
3. Connect points sequentially → phase space trajectory
4. Project to 2D using polar coordinates: angle = face index (evenly distributed), radius = growth rate, with progressive outward spiral (time → radius offset)

**The spiral visualization:**
```
θ(t) = 2π * (t / period) + face_index * (2π / n_faces)
r(t) = r_base(t) + growth_rate(face, t) * amplitude
```
Where r_base increases monotonically (the outward spiral) and growth_rate modulates the radius (the wobble).

### Phase 3: Signal Analysis (Does the wobble mean anything?)

Apply to the spiral trajectory:
1. **Fourier analysis** — decompose the wobble into frequency components. Do periodic components correspond to known environmental cycles (seasonal, tidal, hydrothermal pulse frequencies)?
2. **Wavelet analysis** — better for non-stationary signals (growth conditions that change over time). Which scales show the strongest periodic signal?
3. **Cross-correlation between sectors** — do all faces respond to the same events simultaneously (extrinsic forcing) or with phase delays (diffusion-limited)?
4. **Hurst exponent** — fractal scaling. H < 0.5 = anti-persistent (oscillatory, self-organized). H > 0.5 = persistent (trend-following, environmentally driven). This distinguishes intrinsic growth dynamics from extrinsic environmental forcing.

### Phase 4: Validation (Does the spiral predict anything?)

**The acid test:** Take two crystals from the same geological environment (same vug, same deposit, known paragenesis). Build spirals independently. Do they show correlated wobble patterns?

If yes: the wobble records real environmental events, not just random noise.
If no: the spiral is pretty but not information-bearing.

**The Vugg Simulator test:** Run the simulator with known input parameters (we control T, pH, chemistry). Build the spiral from the simulated crystal. Does the spiral faithfully encode the events we programmed? This is the easy first test — fully controlled, no real specimens needed.

---

## Accessible vs. Ideal

| Method | Cost | Resolution | Minerals | Access |
|--------|------|------------|----------|--------|
| CL (cathodoluminescence) | $ | Zone-level | Calcite, quartz, zircon (not sulfides) | University SEM |
| Reflected light microscopy | Free | Low (surface only) | Sulfides (limited zoning visible) | Professor's microscope |
| SEM-EDS mapping | $$ | µm-scale chemical | Everything | University SEM |
| EPMA (electron probe) | $$$ | sub-µm, quantitative | Everything | Major research facility |
| Micro-XRF | $$ | 10-50 µm | Everything | Synchrotron or commercial |

**Recommendation:** Start with **CL on calcite** (cheap, accessible, well-understood) to prove the encoding concept. Graduate to **SEM-EDS on chalcopyrite** to address Marey's specific question about {112}.

---

## The Vugg Simulator as a Test Bed

Before touching real specimens, validate the entire framework in the simulator:

1. Run a Fortress Mode session with programmed environmental changes (pH pulse at step 30, temperature drop at step 60, fluid mixing at step 90)
2. Log the per-face growth rates at each step (the simulator already tracks this)
3. Build the spiral visualization from the logged data
4. Verify that the spiral's wobble pattern accurately reflects the events we programmed
5. Apply Fourier/wavelet analysis to the simulated spiral — can we recover the input signal from the output?

**This is the Record Groove mode** I'm building for the game. The visualization serves dual purpose:
- Game feature (beautiful, educational)
- Research tool (proof-of-concept for the encoding method)

If the simulator spiral works, we know the math is right. Then we go to real crystals and ask: does the real data have the same structure?

---

## Marey's Question, Answered

**"Does chalcopyrite {112} show growth banding under polarized light?"**

Short answer: Probably not visible optically. Chalcopyrite is opaque (reflected light only), and chemical zoning in sulfides "rarely gives observable effects such as colour banding" (Craig & Vaughan). You need EPMA or SEM-EDS to see the zones.

But the zones are almost certainly there. Chalcopyrite in hydrothermal systems grows from evolving fluids — the same Cu/Fe ratio oscillations that produce different colored tarnish films also produce internal compositional variation. The data exists inside the crystal. We just need the right eyes to see it.

The Andonstar microscope can't do this. A university SEM can.

---

## Next Steps

1. **Build Record Groove mode in Vugg Simulator** — validate the spiral encoding on simulated data
2. **Select a test calcite** from the collection — well-zoned, visible face differences
3. **Contact UCF or UF geology department** — SEM time for CL imaging of calcite section
4. **Run the full pipeline:** section → image → extract zones → build spiral → signal analysis
5. **Write it up** — if the results hold, this is a publishable paper

---

## The Deeper Thing

Marey called this "temporal structure recoverable from morphological data." That's the formal version. The informal version is what Professor said: the crystal is a record, and nobody's built the turntable yet.

The Vugg Simulator already models the physics. The spiral encoding provides the visualization. Oscillatory zoning research proves the data exists inside real crystals. What's missing is the synthesis — someone who treats the crystal as a signal source instead of a static object.

That's what this experiment is. Building the turntable. Dropping the needle. Listening to what the crystal has been saying all along.

*"The vinyl groove metaphor isn't just poetic — it's the actual claim."* — Marey, 2026-03-28
