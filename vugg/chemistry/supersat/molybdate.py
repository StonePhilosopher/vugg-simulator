"""Supersaturation methods for molybdate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (4):
  wulfenite, ferrimolybdite, raspite, stolzite
"""

import math
from typing import Optional


class MolybdateSupersatMixin:
    def supersaturation_wulfenite(self) -> float:
        """Wulfenite (PbMoO₄) supersaturation. Needs Pb + Mo + oxidizing.

        Lead molybdate — thin square plates, bright orange-red to yellow.
        The oxidized-zone product of galena + molybdenite destruction.
        My foundation stone (TN422). "The sunset caught in stone."
        Requires BOTH Pb and Mo to arrive — typically a late-stage mineral.
        """
        # v17 reconciliation (May 2026): per research-wulfenite.md a
        # "rare two-parent mineral that only appears when chemistry of
        # two different primary ore bodies converges." Pre-v17 Python
        # thresholds (Pb>=5, Mo>=2) let it form too easily; tightened
        # to Pb>=10, Mo>=5 to match the research framing. Python's
        # T cap (decay above 80°C, supergene-only) and graduated pH
        # penalties (3.5-9.0 window) preserved — they match the
        # research perfectly.
        if self.fluid.Pb < 10 or self.fluid.Mo < 5 or self.fluid.O2 < 0.5:
            return 0
        sigma = (self.fluid.Pb / 40.0) * (self.fluid.Mo / 15.0) * (self.fluid.O2 / 1.0)
        # Very low temperature — oxidation zone mineral. Decay above 80°C
        # matches research-wulfenite.md "T <80°C, optimum 20-60°C".
        if self.temperature > 80:
            sigma *= math.exp(-0.025 * (self.temperature - 80))
        # Graduated pH penalties — research says "near-neutral to slightly
        # alkaline (6-9)". Both acidic and alkaline edges have soft penalties.
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.4
        elif self.fluid.pH > 9.0:
            sigma -= (self.fluid.pH - 9.0) * 0.3
        return max(sigma, 0)

    def supersaturation_ferrimolybdite(self) -> float:
        """Ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) — the no-lead branch of Mo oxidation.

        Canary-yellow acicular tufts, the fast-growing powdery fork that
        takes MoO₄²⁻ when it oxidizes out of molybdenite and no Pb is
        around to make wulfenite. In the sim, both fork products can
        coexist — ferrimolybdite's lower σ threshold and higher growth
        rate let it win the early oxidation window; wulfenite catches up
        later if Pb is available.

        Paragenesis: molybdenite → MoO₄²⁻ + Fe³⁺ → ferrimolybdite
        Geology: Climax (Colorado), Kingman (Arizona), and porphyry
        Cu-Mo oxidation zones worldwide. Geologically MORE common than
        wulfenite but under-represented in collections (powdery yellow
        fuzz, not display material — collectors walk past it to get to
        the wulfenite plates).
        """
        if self.fluid.Mo < 2 or self.fluid.Fe < 3 or self.fluid.O2 < 0.5:
            return 0
        # Lower Mo threshold (2 vs wulfenite's 2; scaled /10 vs /15)
        # reflects the faster, less picky growth.
        sigma = (self.fluid.Mo / 10.0) * (self.fluid.Fe / 20.0) * (self.fluid.O2 / 1.0)
        # Strongly low-temperature — supergene/weathering zone only.
        # Cuts off above ~150°C via Arrhenius-shape decay.
        if self.temperature > 50:
            sigma *= math.exp(-0.02 * (self.temperature - 50))
        # pH window — mild acidic to neutral. Acid rock drainage
        # pH 3-6 is typical of sulfide-oxidation environments.
        if self.fluid.pH > 7:
            sigma *= max(0.2, 1.0 - 0.2 * (self.fluid.pH - 7))
        elif self.fluid.pH < 3:
            sigma *= max(0.3, 1.0 - 0.25 * (3 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_raspite(self) -> float:
        """Raspite (PbWO₄, monoclinic) — the rare PbWO₄ polymorph.

        Same composition as stolzite (PbWO₄) but a different
        crystal system. Stolzite is tetragonal (more common); raspite
        is monoclinic (rare). The kinetic preference dispatcher in
        check_nucleation favors stolzite ~90% of the time when both
        gates clear — same composition, two minerals separated by
        crystallographic preference.

        Source: research/research-raspite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.W < 5:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.0)
        w_f  = min(self.fluid.W  / 15.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * w_f * ox_f
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.08 * (T - 10)
        elif T <= 50:
            T_factor = max(0.4, 1.2 - 0.040 * (T - 40))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_stolzite(self) -> float:
        """Stolzite (PbWO₄, tetragonal) — the common PbWO₄ polymorph.

        Same composition as raspite (PbWO₄) but tetragonal — much more
        common in nature than raspite. Honey-yellow to orange-yellow,
        the lead analog of scheelite (CaWO₄). The kinetic preference
        dispatcher in check_nucleation favors stolzite ~90% over
        raspite when both gates clear.

        Source: research/research-stolzite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.W < 5:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        w_f  = min(self.fluid.W  / 15.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * w_f * ox_f
        T = self.temperature
        if 20 <= T <= 80:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.08 * (T - 10)
        elif T <= 100:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 80))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

