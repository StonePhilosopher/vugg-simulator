# Pressure science implementation ledger

Date: 2026-08-05
Source packet: `research/arcs/research-pressure-science-2026-08-05.md`
Decision rule: **follow the science** — ship supported mineral/process-specific causes; do not turn pressure into a universal tuning multiplier.

## Implemented now

- The existing `VugConditions.pressure` scalar is explicitly **fluid pressure**. Setup and live Creative controls cover the complete authored/model range, 0.01–4.40 kbar.
- Rock pressure is separately represented as `wall.confining_pressure_kbar`, exposed in Creative setup/live controls, recorded in strip provenance, varied by authored metamorphic unloading histories, and consumed by the Al₂SiO₅ phase selector. Fluid pressure never substitutes for it.
- Creative has exact live decompression actions and can schedule bounded fluid-pressure histories through the existing movement engine. Decompression is intentionally isothermal and does not invent volatile flashing.
- Tap/Shock no longer raise fluid pressure. They apply transient 25/50 MPa differential-stress pulses. Mechanical twinning uses deterministic grain orientation and measured CRSS thresholds for calcite (10 MPa) and dolomite (100 MPa); quartz is excluded. The calcite twin-density and morphology observations use their cited calibrations and are not generalized to dolomite.
- Authored `tectonic_shock` events now request the same 50 MPa transient stress response and leave fluid pressure unchanged.
- The unsupported apophyllite `P > 0.5 kbar` hard zero is removed. Its pressure effect is a clearly labeled soft occurrence-based inference: no penalty through 1.5 kbar, then a nonzero graded rarity weight.
- Andalusite now routes through the Pattison-anchored Al₂SiO₅ P–T field. Kyanite and sillimanite are reported as the stable alternatives but are not fabricated as nucleation engines.
- Deep/cold aragonite can use the sourced calcite/aragonite boundary at ≥3 kbar. The existing shallow, Mg-kinetic aragonite path remains separate.
- The gypsum/anhydrite pure-water boundary is available as a diagnostic observation. It does not replace the independent anhydrite kinetic floor, and the hover panel labels the salinity limitation.
- The mineral hover diagnosis shows pressure only where it is load-bearing or is a relevant phase-field observation. It does not show a generic pressure gate for every mineral.
- The ppm convention is now explicit in code: dissolved values are mass-basis mg/kg, numerically ppm for dilute fluid.

## Deliberately deferred

- **Carbonate/sulfate Ksp pressure corrections:** the packet supplies useful reaction-volume estimates but no complete per-reaction compressibility (`Δκ`) set. Its own error analysis says omitting that term produces about 38% error at 4.4 kbar. Shipping a constant-`ΔV` shortcut would violate the stated rule; the next research/data step is an internally consistent SUPCRTBL/SupPHREEQC grid with provenance and validity metadata.
- **Quartz pressure solubility:** Manning’s density formulation needs an implementation-grade IAPWS water-density grid and interpolation/validity tests. No hand-tuned pressure coefficient was substituted.
- **Boiling, CO₂/H₂S loss, pH jumps, and precipitation pulses:** these require conserved volatile pools and an open/closed headspace mass balance. The decompression action therefore reports that no flash is inferred.
- **Depth and valve-rupture fracture criteria:** confining pressure now exists and is load-bearing for metamorphic phase selection, but no universal depth conversion or hydraulic-fracture rule is inferred. Those require rock density, pore-pressure ratio, tensile strength, and a failure criterion.
- **α/β quartz pressure habit line:** retain for a focused habit/render pass with scenario calibration rather than coupling it incidentally to this state/control repair.

## Packet inconsistencies resolved transparently

1. The implementation uses the packet’s published And/Sil central slope of **−16 bar/°C** and explicitly propagates its ±3 bar/°C slope uncertainty together with the triple-point uncertainty. The `(2 kbar, 700°C)` point is nominally andalusite but lies inside that uncertainty band, so the public result is `uncertain`; no coefficient was retuned to force an acceptance label.
2. The supplied gypsum/anhydrite equation is `Ttr = 58 + 14.7·P(kbar)`. At 4.4 kbar it evaluates to **122.68°C**. The implementation follows the equation and locks the arithmetic with a regression test.

## Verification targets

- Pressure and stress invariants are unit-tested, including the six Al₂SiO₅ probes, aragonite window, apophyllite nonzero weighting, gypsum arithmetic, mineral-specific CRSS behavior, and unchanged fluid pressure during shock.
- Creative’s executable lever audit requires the setup/live pressure controls and the differential-stress editor, so these surfaces cannot silently disappear.
- The 390×844 browser check verifies the new controls remain usable without horizontal overflow.
