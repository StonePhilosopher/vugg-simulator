"""Supersaturation methods for halide minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (2):
  fluorite, halite
"""

import math
from typing import Optional


class HalideSupersatMixin:
    def supersaturation_fluorite(self) -> float:
        """Fluorite (CaF2) supersaturation. Precipitates when Ca and F meet.
        
        Fluorite has RETROGRADE solubility — less soluble at higher T,
        so it precipitates preferentially as fluid cools from depth.
        Sweet spot: 100-250°C (real hydrothermal fluorite deposits).
        Too cold: slow kinetics. Too hot: limited by fluid composition.
        
        Fluorite dissolves in strong acid: CaF₂ + 2H⁺ → Ca²⁺ + 2HF
        At very high F concentrations, Ca forms fluoro-complexes
        (CaF₃⁻, CaF₄²⁻) which re-dissolve fluorite — this caps runaway growth.
        """
        if self.fluid.Ca < 10 or self.fluid.F < 5:
            return 0
        # v17 reconciliation (May 2026): 5-tier T window per Richardson &
        # Holland 1979 (hydrothermal fluorite solubility) + MVT deposit
        # studies showing 50-152°C formation range. Solubility increases
        # with T below 100°C (kinetically slow precipitation), passes
        # through max around 100-250°C (the MVT sweet spot), declines
        # above 350°C.
        T = self.temperature
        if T < 50:
            T_factor = T / 50.0  # kinetically slow below 50°C
        elif T < 100:
            T_factor = 0.8  # warming up
        elif T <= 250:
            T_factor = 1.2  # sweet spot — MVT range
        elif T <= 350:
            T_factor = 1.0  # still viable
        else:
            T_factor = max(0.1, 1.0 - (T - 350) / 200.0)  # fades above 350°C

        # Product model with JS scaling (Ca/200, F/20)
        product = (self.fluid.Ca / 200.0) * (self.fluid.F / 20.0)
        sigma = product * T_factor

        # Fluoro-complex penalty (Python canonical, kept): at very high F,
        # Ca²⁺ + nF⁻ → CaFₙ complexes re-dissolve fluorite. Real effect
        # documented in Manning 1979 — secondary at T<300°C but real.
        if self.fluid.F > 80:
            complex_penalty = (self.fluid.F - 80) / 200.0
            sigma -= complex_penalty
        
        # Acid attack on fluorite
        if self.fluid.pH < 5.0:
            acid_attack = (5.0 - self.fluid.pH) * 0.4
            sigma -= acid_attack
        return max(sigma, 0)

    def supersaturation_halite(self) -> float:
        """Halite (NaCl) — chloride evaporite. Real seawater needs ~10×
        evaporative concentration to reach halite saturation (after
        gypsum has already precipitated and depleted Ca / SO₄). Here
        we model that as a quadratic dependence on the per-ring
        evaporative concentration multiplier — halite stays dormant
        while the cavity is fluid-filled, then fires sharply as a ring
        transitions vadose and concentration jumps 3×.

        Crystal-system: cubic. Hopper (skeletal) growth at high
        supersaturation is the canonical "rapid evaporation" habit;
        well-formed cubes form at slower growth.

        Geological context: classic playa / sabkha / closed-basin
        evaporite. NOT a hydrothermal or hypogene mineral. Most
        existing scenarios won't fire halite — needs Na + Cl seeded
        at modest levels and a drained cavity. The bisbee_final_drying
        and supergene_dry_spell paths now produce vadose-ring
        concentrations that bring halite into reach in scenarios with
        adequate Na + Cl.
        """
        if self.fluid.Na < 5 or self.fluid.Cl < 50:
            return 0
        c = self.fluid.concentration
        # Quadratic in concentration — both Na and Cl get the boost
        # multiplicatively. Thresholds picked so a Na+Cl-rich scenario
        # stays sub-saturated at concentration=1 (most hydrothermal
        # broths shouldn't grow halite on their own) but fires sharply
        # when a vadose-transition concentration spike (× 3) brings
        # the product over unity.
        sigma = (self.fluid.Na / 100.0) * (self.fluid.Cl / 500.0) * c * c
        # Halite is highly soluble at any T but the evaporite-
        # crystallization pathway prefers low-to-moderate T (playa,
        # sabkha). Above 100°C halite still forms in salt-dome / brine
        # contexts but here we damp it slightly.
        if self.temperature > 100:
            sigma *= 0.7
        # Strong acid dissolves halite (forms H+ + NaCl ↔ HCl + Na+);
        # not realistic at typical pH but model the stability window.
        if self.fluid.pH < 4.0:
            sigma *= 0.5
        return max(sigma, 0)

