"""Supersaturation methods for arsenate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (6):
  erythrite, annabergite, adamite, mimetite, scorodite, olivenite
"""

import math
from typing import Optional


class ArsenateSupersatMixin:
    def supersaturation_erythrite(self) -> float:
        """Erythrite (Co₃(AsO₄)₂·8H₂O) — the cobalt bloom.

        Low-T (5-50°C, optimum 10-30°C) supergene arsenate from oxidizing
        Co-arsenides (cobaltite, skutterudite). Paired with annabergite
        (Ni equivalent) — same vivianite-group structure, Co vs Ni changes
        the color from crimson-pink to apple-green. Dehydrates > 200°C.
        """
        if self.fluid.Co < 2 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        product = (self.fluid.Co / 20.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        T_factor = 1.2 if 10 <= self.temperature <= 30 else 0.7
        return product * T_factor

    def supersaturation_annabergite(self) -> float:
        """Annabergite (Ni₃(AsO₄)₂·8H₂O) — the nickel bloom.

        Ni equivalent of erythrite. Same vivianite-group structure, same
        gating conditions, same habit families — only the metal and color
        change. Apple-green to pale green; Mg substitution (cabrerite) pales
        toward white, Co substitution shifts toward pink.
        """
        if self.fluid.Ni < 2 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        product = (self.fluid.Ni / 20.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        T_factor = 1.2 if 10 <= self.temperature <= 30 else 0.7
        return product * T_factor

    def supersaturation_adamite(self) -> float:
        """Adamite (Zn₂(AsO₄)(OH)) supersaturation. Needs Zn + As + oxidizing + low T.

        Secondary mineral forming in oxidation zones of zinc-arsenic deposits.
        Bright green fluorescence under UV (activated by Cu²⁺ substitution).
        Non-fluorescent crystals coexist with fluorescent ones — the contradiction.
        Prismatic to tabular crystals, often on limonite.
        Forms at low temperature (<100°C) in near-surface oxidation zones.

        Adamite-vs-olivenite is a Cu:Zn broth-ratio competition (Hawthorne
        1976 + Burns 1995 + Chukanov 2008 — zincolivenite (Cu,Zn)(AsO4)(OH)
        is the IMA-approved intermediate). Round 9c retrofit (Apr 2026)
        upgrades the Round 8d strict-comparison dispatch to the
        rosasite/aurichalcite 50%-gate + sweet-spot pattern. See
        research/research-broth-ratio-adamite-olivenite.md.
        """
        # Trace Cu floor — the Cu²⁺ activator gives the famous green
        # fluorescence; pure-Zn adamite without any Cu is rare in nature.
        # Recessive-side floor also makes the Cu:Zn ratio meaningful.
        if self.fluid.Zn < 10 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.fluid.Cu < 0.5:
            return 0
        # Broth-ratio gate — adamite is Zn-dominant. Olivenite returns 0
        # when Zn>Cu and adamite returns 0 when Cu>Zn — same parent fluid,
        # opposite outcome.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total  # safe — Zn≥10 above
        if zn_fraction < 0.5:
            return 0
        sigma = (self.fluid.Zn / 80.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        # Sweet-spot bonus — Zn-dominant but Cu-trace present (the
        # fluorescent variety) is the most aesthetic adamite. Pure-Zn
        # adamite (>0.95 Zn fraction) gets damped because hemimorphite
        # and smithsonite take that territory.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5
        # Low temperature mineral — suppressed above 100°C
        if self.temperature > 100:
            sigma *= math.exp(-0.02 * (self.temperature - 100))
        # pH preference: slightly acidic to neutral (4.5-7.5)
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.4
        elif self.fluid.pH > 8.0:
            sigma *= 0.5
        return max(sigma, 0)

    def supersaturation_mimetite(self) -> float:
        """Mimetite (Pb₅(AsO₄)₃Cl) supersaturation. Needs Pb + As + Cl + oxidizing.
        
        Secondary lead arsenate chloride. Isostructural with pyromorphite and vanadinite
        (the apatite supergroup). Bright yellow-orange barrel-shaped hexagonal prisms.
        "Campylite" variety has barrel-curved faces (Fe substitution).
        Forms in oxidation zones of lead deposits alongside wulfenite, cerussite.
        My foundation stone (TN422) — wulfenite on mimetite, Sonora Mexico.
        """
        if self.fluid.Pb < 5 or self.fluid.As < 3 or self.fluid.Cl < 2 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Pb / 60.0) * (self.fluid.As / 25.0) * (self.fluid.Cl / 30.0) * (self.fluid.O2 / 1.0)
        # Low temperature mineral — suppressed above 150°C
        if self.temperature > 150:
            sigma *= math.exp(-0.015 * (self.temperature - 150))
        # Acid penalty — dissolves in strong acid
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.5
        return max(sigma, 0)

    def supersaturation_scorodite(self) -> float:
        """Scorodite (FeAsO₄·2H₂O) — the arsenic sequestration mineral.

        Most common supergene arsenate; pseudo-octahedral pale blue-green
        dipyramids (looks cubic but isn't — orthorhombic). Forms when
        arsenopyrite (or any As-bearing primary sulfide) oxidizes in
        acidic oxidizing conditions: Fe³⁺ + AsO₄³⁻ both required. The
        acidic-end of the arsenate stability field; at pH > 5 scorodite
        dissolves and releases AsO₄³⁻ — which then feeds the rest of
        the arsenate suite (erythrite, annabergite, mimetite, adamite,
        pharmacosiderite at higher pH).

        Type locality Freiberg, Saxony, Germany. World-class deep
        blue-green crystals at Tsumeb (Gröbner & Becker 1973).

        Stability: pH 2-5 (acidic), T < 160°C (above dehydrates to
        anhydrous FeAsO₄), O₂ ≥ 0.3 (Fe must be Fe³⁺).
        """
        if self.fluid.Fe < 5 or self.fluid.As < 3 or self.fluid.O2 < 0.3:
            return 0
        if self.fluid.pH > 6:
            return 0  # dissolves at pH > 5; nucleation gate at 6 for hysteresis
        sigma = (self.fluid.Fe / 30.0) * (self.fluid.As / 15.0) * (self.fluid.O2 / 1.0)
        # Strongly low-temperature — supergene zone only
        if self.temperature > 80:
            sigma *= math.exp(-0.025 * (self.temperature - 80))
        # pH peak around 3-4; fall off above 5
        if self.fluid.pH > 5:
            sigma *= max(0.3, 1.0 - 0.5 * (self.fluid.pH - 5))
        elif self.fluid.pH < 2:
            sigma *= max(0.4, 1.0 - 0.3 * (2 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_olivenite(self) -> float:
        """Olivenite (Cu₂AsO₄(OH)) — the Cu arsenate.

        Olive-green to grayish-green, the diagnostic Cu chromophore.
        Forms in Cu-rich supergene oxidation zones — the type at Cornwall,
        Tsumeb, Bisbee.

        Adamite-vs-olivenite is a Cu:Zn broth-ratio competition (see
        research/research-broth-ratio-adamite-olivenite.md). Round 9c
        retrofit upgrades the Round 8d strict-comparison dispatch to the
        rosasite/aurichalcite 50%-gate + sweet-spot pattern.

        Source: research/research-olivenite.md (boss commit f2939da).
        """
        if self.fluid.Cu < 50 or self.fluid.As < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Trace Zn floor on the recessive side — makes the Cu:Zn ratio
        # meaningful. Real olivenite always has at least trace Zn
        # (zincolivenite-leaning compositions).
        if self.fluid.Zn < 0.5:
            return 0
        # Broth-ratio gate — olivenite is Cu-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total
        if cu_fraction < 0.5:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        as_f = min(self.fluid.As / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = cu_f * as_f * ox_f
        # Sweet-spot bonus — Cu-dominant with Zn trace is the
        # zincolivenite-leaning olivenite, the most-collected form.
        # Pure-Cu olivenite gets damped since malachite/brochantite
        # take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5
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

