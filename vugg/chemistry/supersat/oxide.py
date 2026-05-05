"""Supersaturation methods for oxide minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (7):
  hematite, corundum, ruby, sapphire, uraninite, magnetite, cuprite
"""

import math
from typing import Optional


class OxideSupersatMixin:
    def supersaturation_hematite(self) -> float:
        """Hematite (Fe₂O₃) supersaturation. Needs Fe + oxidizing conditions.
        
        Hematite is the quintessential iron oxide — steel-gray specular plates
        at high T, botryoidal masses at low T, red earthy powder in between.
        Needs OXIDIZING conditions. Won't form under reducing (pyrite wins instead).
        """
        if self.fluid.Fe < 20 or self.fluid.O2 < 0.5:
            return 0
        sigma = (self.fluid.Fe / 100.0) * (self.fluid.O2 / 1.0) * math.exp(-0.002 * self.temperature)
        # Acid penalty — hematite dissolves in strong acid
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_corundum(self) -> float:
        """Corundum (Al₂O₃, colorless/generic) supersaturation.

        Post-R7: fires only when no chromophore variety's gate is met —
        ruby takes Cr ≥ 2, sapphire takes Fe ≥ 5. Below those, colorless
        corundum fires. Priority chain: ruby > sapphire > corundum.
        """
        f = self.fluid
        if f.Cr >= 2.0:
            return 0  # ruby priority
        if f.Fe >= 5:
            return 0  # sapphire priority (any Fe ≥ 5 — blue/yellow/pink color dispatch in grow)
        return self._corundum_base_sigma()

    def supersaturation_ruby(self) -> float:
        """Ruby (Al₂O₃ + Cr³⁺) supersaturation — the red chromium variety.

        Top priority in corundum-family dispatch. Cr ≥ 2 ppm is the ruby
        gate (below that, pink-sapphire or colorless corundum). Cr
        enhancement factor: linear up to cap (prevents runaway at
        ultramafic-contact Cr concentrations).
        """
        if self.fluid.Cr < 2.0:
            return 0
        base = self._corundum_base_sigma()
        if base <= 0:
            return 0
        cr_f = min(self.fluid.Cr / 5.0, 2.0)
        return base * cr_f

    def supersaturation_sapphire(self) -> float:
        """Sapphire (Al₂O₃ + Fe + optional Ti/V-trace) — non-red corundum.

        Fe is the universal sapphire chromophore; Ti adds the blue IVCT
        partner when present (Fe+Ti blue); without Ti, high Fe yields
        yellow sapphire. Spec required_ingredients: {Al, Fe}. V-only
        violet-sapphire path is deferred (Tanzania rarity; adding it
        would break the necessity-of-Fe gate test — revisit when we
        split violet into its own species).

        Priority sub-dispatch (engine-internal):
        - Cr >= 2 → ruby (exclusion; ruby has its own engine)
        - Fe ≥ 5 AND Ti ≥ 0.5 → blue sapphire (Fe-Ti IVCT)
        - Fe ≥ 20, Ti < 0.5 → yellow sapphire (Fe³⁺)
        - Fe ≥ 5, low-Cr sub-threshold → pink/padparadscha/green variants
        - Otherwise: base conditions not met
        """
        f = self.fluid
        if f.Cr >= 2.0:
            return 0  # ruby takes priority
        if f.Fe < 5:
            return 0  # Fe is the universal sapphire chromophore threshold
        base = self._corundum_base_sigma()
        if base <= 0:
            return 0
        # Chromophore factor — blue (Fe+Ti) > yellow (Fe alone) > other
        chrom_f = min(f.Fe / 15.0, 1.5)
        if f.Ti >= 0.5:
            chrom_f *= min(f.Ti / 1.5, 1.3)  # blue IVCT boost
        return base * chrom_f

    def supersaturation_uraninite(self) -> float:
        """Uraninite (UO₂) supersaturation. Needs U + reducing conditions.

        Primary uranium mineral — pitchy black masses, rarely crystalline.
        RADIOACTIVE. Gatekeeper for the entire secondary U family
        (torbernite/zeunerite/carnotite). Needs STRONGLY reducing conditions
        — any oxygen converts U⁴⁺ → mobile UO₂²⁺ uranyl ion. Forms in
        pegmatites (high T, octahedral crystals), hydrothermal veins
        (200-400°C botryoidal pitchblende), and reduced sedimentary
        roll-fronts (low T, cryptocrystalline).
        """
        if self.fluid.U < 5 or self.fluid.O2 > 0.3:
            return 0  # needs reducing conditions
        sigma = (self.fluid.U / 20.0) * (0.5 - self.fluid.O2)
        # Stable across wide T range (research: 150-600°C). Slight preference
        # for higher T (pegmatitic > hydrothermal > sedimentary).
        if self.temperature > 200:
            sigma *= 1.3
        return max(sigma, 0)

    def supersaturation_magnetite(self) -> float:
        """Magnetite (Fe₃O₄) supersaturation. Fe + moderate O₂ (HM buffer).

        Mixed-valence Fe²⁺Fe³⁺₂O₄. Forms at the hematite-magnetite (HM)
        redox buffer — too reducing and Fe stays as Fe²⁺ (siderite/
        pyrite); too oxidizing and it goes to hematite/goethite.
        Wide T stability (100–800°C) but prefers moderate/high T.
        """
        if self.fluid.Fe < 25 or self.fluid.O2 < 0.1 or self.fluid.O2 > 1.0:
            return 0
        fe_f = min(self.fluid.Fe / 60.0, 2.0)
        # HM buffer peak around O2=0.4, falls off on both sides
        o_f = max(0.4, 1.0 - abs(self.fluid.O2 - 0.4) * 1.5)
        sigma = fe_f * o_f
        T = self.temperature
        if 300 <= T <= 600:
            T_factor = 1.0
        elif 100 <= T < 300:
            T_factor = 0.5 + 0.0025 * (T - 100)
        elif 600 < T <= 800:
            T_factor = max(0.4, 1.0 - 0.003 * (T - 600))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_cuprite(self) -> float:
        """Cuprite (Cu₂O) supersaturation. Cu + narrow O₂ window.

        The Eh-boundary mineral. Too reducing → native copper; too
        oxidizing → malachite/tenorite. Cuprite exists in the narrow
        band between. Low T (<100°C). The O₂ sweet spot is 0.3–1.2 —
        on either side, the thermodynamics push elsewhere.
        """
        if self.fluid.Cu < 20 or self.fluid.O2 < 0.3 or self.fluid.O2 > 1.2:
            return 0
        cu_f = min(self.fluid.Cu / 50.0, 2.0)
        # Eh window: peak at O2 ≈ 0.7, falling on both sides
        o_f = max(0.3, 1.0 - abs(self.fluid.O2 - 0.7) * 1.4)
        sigma = cu_f * o_f
        if self.temperature > 100:
            sigma *= math.exp(-0.03 * (self.temperature - 100))
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

