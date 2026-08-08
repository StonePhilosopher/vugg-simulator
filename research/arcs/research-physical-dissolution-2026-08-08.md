# Physical dissolution and etch reconstruction — 2026-08-08

## Question

How can the simulator turn an etch event into a defensible reaction path that
removes solid volume, returns the inventory that solid actually held, changes
solution saturation as dissolution proceeds, produces face-specific relief,
and can later be buried by regrowth?

## Evidence used by the executable tranche

- Godinho, Piazolo & Evins (2012), *Geochimica et Cosmochimica Acta* 86,
  392–403, DOI `10.1016/j.gca.2012.02.032`. CaF2 surfaces dissolved in
  0.05 M NaClO4/HClO4 at pH 3.6 and about 21 °C for up to 468 h. The
  10 mL solutions were renewed every 48 h and Ca was kept below 10 ppb. Their measured
  `{100}`-orientation rate over that interval was `(3.2 ± 0.2) × 10^-9`
  mol m^-2 s^-1. Near-`{100}` top surfaces remained comparatively flat;
  pre-existing pores on `{100}` evolved into cubic pits with 90° sidewalls.
  Rates and evolving topography were explicitly face dependent.
- Dell'Angelo et al. (2025), *Journal of Colloid and Interface Science* 684,
  844–855, DOI `10.1016/j.jcis.2024.12.242`. Independent experiments and
  simulations confirm face-dependent fluorite dissolution and substantial
  roughness/surface-area evolution. The ordering differs with conditions,
  reinforcing the decision not to transfer one experiment's numeric face
  multiplier into another solution.
- USGS PHREEQC `wateq4f.dat`, accessed 2026-08-08. The raw thermodynamic
  calculation uses the database reactions and constants for CaF2, HF, HF2-,
  CaF+, and MgF+. The CaF2 analytical log-K coefficients are
  `[66.348, 0, -4298.2, -25.271, 0]` for
  `logK = A1 + A2*T + A3/T + A4*log10(T) + A5/T^2` with T in kelvin.
- Cama, Ayora & Lasaga (2010), *Geochimica et Cosmochimica Acta* 74,
  4298–4311, DOI `10.1016/j.gca.2010.04.067`. Their fluorite experiments place
  the far-from-equilibrium rate plateau below ΔG = −7 kcal/mol. Only this
  mineral-level affinity boundary is transferred. Their `{111}` numeric rate
  and Temkin law are not applied to the `{100}` demonstrator.

## Executable decision

The first accepted physical model is deliberately narrow: a smooth cubic
fluorite proxy for a nominally flat `{100}` surface, 21 ± 0.5 °C, pH
3.60 ± 0.05, ionic strength 0.050 ± 0.005 molal, fluid pressure
0.001 ± 0.0003 kbar, no more than 19.5 days, and raw ΔG ≤ −7 kcal/mol.
At 21 °C that affinity boundary is Ω ≈ `6.2 × 10^-6`, not the unsupported
Ω = 0.1 used in an earlier draft. Stepped, hopper, dendritic, and `{111}`
fluorite surfaces fail closed because sharing a macroscopic `{100}` normal does
not reproduce the measured cleaned-surface step-site state.

The North-Pennine-style scenario is explicitly a **bounded extrapolation**, not
a matching direct experiment. It replaces the pore fluid with a 0.05 molal
NaCl ionic-strength analogue and follows a fixed-pH, closed dissolved-inventory
return path. Godinho used NaClO4/HClO4, renewed 10 mL every 48 h, and kept Ca
below 10 ppb; the scenario begins at 8 ppm Ca. The measured rate interval is
reported, but the electrolyte, surface-state, bath-protocol, and cross-face/pH
affinity-boundary transfers have
**unquantified systematic uncertainty**. These distinctions live in every
accepted receipt, the event copy, and the crystal-history panel.

This replaces the earlier draft's scientifically weak choice to apply a
`{111}` Cama rate to a `{100}` cube with an invented 0.5 face multiplier.
No portable multiplier is claimed.

## Raw saturation calculation

Gameplay `supersaturation_fluorite()` is a nucleation/growth score. It has
presence gates and empirical temperature/acid penalties, so it is not Ω and
must never enter a chemical-affinity law.

`fluoriteSaturationAssessment()` instead solves the analytical-fluoride mass
balance among free F-, HF, HF2-, CaF+, and MgF+. Davies coefficients are used
only at `I <= 0.5 molal`. Free Ca and Mg are reduced by their fluoride
complexes. The result reports free species, reconstructed analytical F,
`log(IAP)`, `log(Ksp)`, Ω, and ΔG. In the seed-42 wash, gameplay sigma is zero
while raw Ω is positive and about `4.55 × 10^-7`; the two quantities are
therefore auditable and visibly distinct.

## Coupled reaction path and mass closure

The exposure is divided into 512 deterministic substeps. At every substep:

1. the face-matched rate proposes a surface-normal retreat;
2. habit geometry converts retreat to an axial-equivalent negative zone;
3. `previewBookedDissolutionReturn()` reconstructs, without mutation, the
   exact chronological shell inventory that retreat would release;
4. the return is added to a virtual copy of the local fluid;
5. raw Ω is recomputed before the next substep.

The integrator stops at the authored duration, solid exhaustion, or the
ΔG = −7 kcal/mol far-field affinity boundary. One final negative zone is then
accepted through the normal stoichiometric budget path. The ordinary
5 µm display-resolution cleanup is deliberately bypassed: it cannot mint extra
dissolution beyond the integrated retreat. Actual return must equal preview to
`1 × 10^-12` ppm or execution throws; the receipt also records the residual.

For the seed-42 scenario, the 19.5-day experiment gives 0.132357888 µm
surface-normal retreat, 0.264715776 µm rendered axial loss, and exact booked
returns of roughly 0.000849 ppm Ca and 0.000805 ppm F. Ω rises as those ions
return, even though this very dilute experiment remains far from equilibrium.

## Geometry and visible morphology

The legacy growth ledger stores many cubic-system habits at `a/c = 0.5` as a
calibration firewall, while the renderer correctly displays a cube at 1:1:1.
Physical dissolution therefore uses a render-matched isometric equivalent:
parallel retreat `r` reduces the rendered span from `L` to `L - 2r`, and the
accepted solid volume follows the corresponding cubic ratio. It does not etch
the stale prolate ledger axes.

Godinho's cubic pits are evolved **pre-existing pores in a sintered pellet**;
they are not evidence that a pristine natural cube spontaneously acquires a
particular pore density. The renderer therefore declares an inspection aid:
two deterministic pre-existing pores per displayed face with 250× vertical
relief exaggeration. The receipt labels both the unmeasured defect assumption
and magnification. The mass-balanced crystal span and volume remain physical;
the schematic pore mesh does not debit extra solid. The crystal-history panel
shows the physical retreat beside the schematic warning.

Creative mode exposes direct duration in days, with the model-derived 19.5-day
maximum and default, but no cosmetic “etch style” selector. Positive growth
progressively buries the schematic relief; replay preserves sharp, etched,
partly healed, and fully buried stages while the physical negative zone remains
in crystal history.

## Explicit limits

- NaCl in the reduced fluid schema supplies the target ionic strength because
  perchlorate is not an available conservative-ion field. The receipt claims
  an ionic-strength analogue, not NaClO4 identity, and labels the transferred
  rate a bounded extrapolation with unquantified systematic uncertainty.
- Godinho's bath renewal is not reconstructed. Dissolved booked inventory
  remains in the simulated closed pore fluid and feeds back into Ω/ΔG. The
  source-versus-simulation protocol is player-visible.
- The fixed pH is the experimental bath boundary. The simulator does not yet
  carry a conserved hydrogen/alkalinity inventory for this non-carbonate
  reaction path.
- The accepted-shell budget is a calibrated ppm-per-axial-micrometre inventory
  proxy. This tranche closes return against what precipitation booked; it does
  not reinterpret the entire simulator as an extensive kilogram-scale cell.
- Surface area and volume use an equivalent isometric body, not a facet mesh
  that evolves its reactive area. The measured 468-hour average rate is not
  extrapolated beyond 468 hours.
- Carbonate, quartz, galena, stepped/hopper/non-cubic fluorite, and all other physical etches
  fail closed until their own face-, solution-, and inventory-compatible rate
  models exist.
