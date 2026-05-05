"""Supersaturation methods for hydroxide minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (2):
  lepidocrocite, goethite
"""

import math
from typing import Optional


class HydroxideSupersatMixin:
    def supersaturation_lepidocrocite(self) -> float:
        """Lepidocrocite (γ-FeOOH) supersaturation. Fe + rapid oxidation.

        Kinetically favored over goethite when Fe²⁺ oxidizes FAST —
        e.g. pyrite weathering in situ. If oxidation is slow, goethite
        wins. We approximate this with higher O₂ and higher growth rate
        preference.
        """
        if self.fluid.Fe < 15 or self.fluid.O2 < 0.8:
            return 0
        fe_f = min(self.fluid.Fe / 50.0, 2.0)
        o_f = min(self.fluid.O2 / 1.5, 1.5)
        sigma = fe_f * o_f
        # Low-T preference — strictly supergene/weathering
        if self.temperature > 50:
            sigma *= math.exp(-0.02 * (self.temperature - 50))
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.4
        # pH 5-7 is the sweet spot; outside penalty
        if self.fluid.pH > 7.5:
            sigma *= max(0.5, 1.0 - (self.fluid.pH - 7.5) * 0.3)
        return max(sigma, 0)

    def supersaturation_goethite(self) -> float:
        """Goethite (FeO(OH)) supersaturation. Needs Fe + oxidizing + moderate pH.

        The most common iron oxyhydroxide. Rust's crystal name.
        Botryoidal blackish-brown masses, velvety surfaces.
        The pseudomorph mineral — replaces pyrite, marcasite, siderite.
        Egyptian "Prophecy Stones" = goethite after marcasite.
        Low temperature, oxidation zone. Dissolves in acid.
        """
        if self.fluid.Fe < 15 or self.fluid.O2 < 0.4:
            return 0
        sigma = (self.fluid.Fe / 60.0) * (self.fluid.O2 / 1.0)
        # Low temperature preferred
        if self.temperature > 150:
            sigma *= math.exp(-0.015 * (self.temperature - 150))
        # Dissolves in acid
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.5
        return max(sigma, 0)

