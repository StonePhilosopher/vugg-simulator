"""Supersaturation methods for borate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (2):
  tincalconite, borax
"""

import math
from typing import Optional


class BorateSupersatMixin:
    def supersaturation_tincalconite(self) -> float:
        """Tincalconite (Na₂B₄O₇·5H₂O) is the dehydration paramorph
        product of borax — it appears in the simulator only via
        apply_dehydration_transitions, never via nucleation from
        solution. Returns 0 unconditionally so the engine framework
        sees it as "always sub-saturated" and the nucleation gate
        never fires for tincalconite directly."""
        return 0

    def supersaturation_borax(self) -> float:
        """Borax (Na₂[B₄O₅(OH)₄]·8H₂O) — sodium-tetraborate decahydrate.
        Closed-basin evaporite from alkaline brines (Hill & Forti
        1997; Smith 1979 *Subsurface Stratigraphy of Searles Lake*).
        Requires Na, B, alkaline pH, and evaporative concentration —
        a mineral that explicitly doesn't belong in hot reducing
        hydrothermal vugs. Like halite, σ scales quadratically with
        the ring's evaporative concentration multiplier so borax stays
        dormant at baseline and fires only after surface-drop drying
        has spiked the local concentration.

        Decomposes to anhydrous Na₂B₄O₇ above ~320°C; effloresces to
        tincalconite (Na₂B₄O₇·5H₂O) at low humidity. The latter is the
        v28 dehydration paramorph mechanic — separate from the
        supersaturation gate; this method just decides whether new
        borax can crystallize.
        """
        if self.fluid.Na < 50 or self.fluid.B < 5:
            return 0
        # Above 60°C borax dehydrates in place (handled by the
        # dehydration paramorph) — and growth via supersaturation
        # also stops since the decahydrate isn't stable here.
        if self.temperature > 60:
            return 0
        # Borax wants alkaline brine. pH < 8 sharply attenuates.
        if self.fluid.pH < 7.0:
            return 0
        c = self.fluid.concentration
        # Hard concentration gate. Borax is strictly an active-
        # evaporation mineral — it doesn't crystallize from a fluid
        # that isn't currently concentrating. Submerged rings stay at
        # concentration=1.0; only meniscus + vadose rings (post-
        # transition boost ≥ 3.0, or scenario-set evaporative event)
        # cross this threshold. Without this gate, an unusually high
        # Na+B fluid would precipitate borax even in fully-flooded
        # cavities — wrong for the playa-lake / sabkha-only mineral.
        if c < 1.5:
            return 0
        sigma = (self.fluid.Na / 500.0) * (self.fluid.B / 100.0) * c * c
        # Alkalinity bonus — sweet spot pH 8.5-10.5.
        if 8.5 <= self.fluid.pH <= 10.5:
            sigma *= 1.4
        elif self.fluid.pH > 10.5:
            sigma *= 1.1
        # Ca²⁺ steals borate as colemanite/inyoite — large Ca sharply
        # suppresses borax. (Research file: "Ca²⁺ sequesters borate as
        # colemanite/inyoite — COMPETES for B".)
        if self.fluid.Ca > 50:
            ca_penalty = min(1.0, self.fluid.Ca / 150.0)
            sigma *= (1.0 - 0.7 * ca_penalty)
        return max(sigma, 0)

