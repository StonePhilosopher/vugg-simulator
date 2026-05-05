"""Supersaturation methods for phosphate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (11):
  clinobisvanite, pyromorphite, vanadinite, descloizite, mottramite, torbernite, autunite, zeunerite, uranospinite, carnotite, tyuyamunite
"""

import math
from typing import Optional


class PhosphateSupersatMixin:
    def supersaturation_clinobisvanite(self) -> float:
        """Clinobisvanite (BiVO₄) supersaturation. Bi + V + oxidizing + low T.

        End of the Bi oxidation sequence: bismuthinite → native bismuth
        → bismite/bismutite → clinobisvanite (if V is available).
        Microscopic — growth_rate_mult 0.2 is slow.
        """
        if self.fluid.Bi < 2 or self.fluid.V < 2 or self.fluid.O2 < 1.0:
            return 0
        bi_f = min(self.fluid.Bi / 5.0, 2.0)
        v_f  = min(self.fluid.V / 5.0, 2.0)
        o_f  = min(self.fluid.O2 / 1.5, 1.3)
        sigma = bi_f * v_f * o_f
        if self.temperature > 40:
            sigma *= math.exp(-0.04 * (self.temperature - 40))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_pyromorphite(self) -> float:
        """Pyromorphite (Pb₅(PO₄)₃Cl) supersaturation. Needs Pb + P + Cl.

        Apatite-group phosphate, barrel-shaped hexagonal prisms.
        Phosphate is often rare in oxidation-zone fluids — the P
        threshold is the natural gate. When phosphate arrives via
        meteoric water meeting an oxidizing Pb mineral, pyromorphite
        replaces cerussite or coats galena pseudomorphically.
        """
        if self.fluid.Pb < 20 or self.fluid.P < 2 or self.fluid.Cl < 5:
            return 0
        pb_f = min(self.fluid.Pb / 30.0, 1.8)
        p_f  = min(self.fluid.P / 5.0, 2.0)      # P is the gate
        cl_f = min(self.fluid.Cl / 15.0, 1.3)
        sigma = pb_f * p_f * cl_f
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_vanadinite(self) -> float:
        """Vanadinite (Pb₅(VO₄)₃Cl) supersaturation. Needs Pb + V + Cl.

        Vanadate end-member of the apatite-group Pb-trio (pyromorphite
        P / mimetite As / vanadinite V). Vanadium comes from oxidation
        of V-bearing red-bed sediments — arid-climate signature. The V
        threshold is the gate; vanadate is otherwise rare in
        oxidation-zone fluids.
        """
        if self.fluid.Pb < 20 or self.fluid.V < 2 or self.fluid.Cl < 5:
            return 0
        pb_f = min(self.fluid.Pb / 30.0, 1.8)
        v_f  = min(self.fluid.V / 6.0, 2.0)      # V is the gate
        cl_f = min(self.fluid.Cl / 15.0, 1.3)
        sigma = pb_f * v_f * cl_f
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_descloizite(self) -> float:
        """Descloizite (Pb(Zn,Cu)VO₄(OH)) — the Zn end of the descloizite-
        mottramite complete solid solution series.

        Forms only in supergene oxidation zones where Pb-Zn sulfide ore
        (galena + sphalerite) has weathered and the V is delivered by
        groundwater (red-bed roll-front signature). Red-brown to
        orange-brown (no Cu chromophore — V⁵⁺ alone gives the color).

        Round 9c retrofit (Apr 2026): Cu/Zn broth-ratio competition with
        mottramite, upgrading the Round 8d strict-comparison dispatch to
        the rosasite/aurichalcite 50%-gate + sweet-spot pattern. The
        Schwartz 1942 + Oyman 2003 surveys established the complete solid
        solution; intermediate "cuprian descloizite" is common at Tsumeb
        and Berg Aukas. See research/research-broth-ratio-descloizite-
        mottramite.md.

        Source: research/research-descloizite.md (boss commit f2939da);
        Strunz 1959 (Tsumeb monograph).
        """
        if self.fluid.Pb < 40 or self.fluid.Zn < 50 or self.fluid.V < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Recessive-side trace floor — real descloizite always has at
        # least trace Cu (cuprian descloizite). Makes the Cu:Zn ratio
        # meaningful instead of degenerate at Cu=0.
        if self.fluid.Cu < 0.5:
            return 0
        # Broth-ratio gate — descloizite is Zn-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total
        if zn_fraction < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        zn_f = min(self.fluid.Zn / 80.0, 2.5)
        v_f  = min(self.fluid.V  / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * zn_f * v_f * ox_f
        # Sweet-spot bonus — Zn-dominant with Cu trace (cuprian descloizite)
        # is the most-collected form. Pure-Zn damped because willemite
        # and hemimorphite take that territory.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5
        T = self.temperature
        if 30 <= T <= 50:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.4
        elif T < 30:
            T_factor = 0.4 + 0.08 * (T - 20)
        elif T <= 80:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 50))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_mottramite(self) -> float:
        """Mottramite (Pb(Cu,Zn)VO₄(OH)) — the Cu end of the descloizite-
        mottramite complete solid solution series.

        Olive-green to yellowish-green to black (the Cu chromophore
        distinguishing it from the red-brown descloizite). Forms in the
        same supergene oxidation zones; Tsumeb produced the best
        examples of both species.

        Round 9c retrofit (Apr 2026): Cu/Zn broth-ratio competition with
        descloizite, upgrading the Round 8d strict-comparison dispatch to
        the rosasite/aurichalcite 50%-gate + sweet-spot pattern. See
        research/research-broth-ratio-descloizite-mottramite.md.

        Source: research/research-mottramite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.Cu < 50 or self.fluid.V < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Recessive-side trace floor — real mottramite always has at
        # least trace Zn (zincian mottramite).
        if self.fluid.Zn < 0.5:
            return 0
        # Broth-ratio gate — mottramite is Cu-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total
        if cu_fraction < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        v_f  = min(self.fluid.V  / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * cu_f * v_f * ox_f
        # Sweet-spot bonus — Cu-dominant with Zn trace (zincian mottramite)
        # is the most-collected form. Pure-Cu damped because vanadinite
        # and malachite take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5
        T = self.temperature
        if 30 <= T <= 50:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.4
        elif T < 30:
            T_factor = 0.4 + 0.08 * (T - 20)
        elif T <= 80:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 50))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_torbernite(self) -> float:
        """Torbernite (Cu(UO₂)₂(PO₄)₂·12H₂O) — Cu-branch of the autunite-group
        cation+anion fork (Round 9b shipped the anion fork P-vs-As;
        Round 9c widened to P-vs-As-vs-V; Round 9d added the Cu-vs-Ca
        cation fork that pairs torbernite against autunite).

        Two ratio gates now apply:
        - Anion: P/(P+As+V) > 0.5 — torbernite is the P-branch
        - Cation: Cu/(Cu+Ca) > 0.5 — torbernite is the Cu-branch
                 (autunite is the Ca-branch on the same anion side).

        Forms emerald-green tabular plates flattened on {001} — looks like
        green mica. Strongly radioactive (U⁶⁺ in lattice); notably
        non-fluorescent because Cu²⁺ quenches uranyl emission. Dehydrates
        irreversibly to metatorbernite above ~75°C (handled by
        THERMAL_DECOMPOSITION).

        Source: research/research-torbernite.md (boss commit 3bfdf4a);
        research/research-uraninite.md §164-178 (paragenetic chain);
        Schneeberg type locality (Saxony Ore Mountains).
        """
        # Required ingredients — all four
        if (self.fluid.Cu < 5 or self.fluid.U < 0.3
                or self.fluid.P < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene oxidation zone (above 50°C → metatorbernite
        # is favored; we don't grow that variant here, just block).
        if self.temperature < 10 or self.temperature > 50:
            return 0
        # pH gate — slightly acidic to neutral (5-7 per research)
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0
        # Anion competition — P must dominate over As + V (the 9b/9c
        # anion fork). Denominator is P+As+V so V-rich fluid routes to
        # carnotite, As-rich to zeunerite.
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        p_fraction = self.fluid.P / anion_total
        if p_fraction < 0.5:
            return 0
        # Cation competition — Cu must dominate over Ca (the 9d cation
        # fork). Denominator is Cu+Ca so Ca-dominant groundwater routes
        # to autunite. Pre-9d torbernite would have fired even in Ca-
        # saturated fluids if Cu>=5, which is geologically wrong (real
        # torbernite is rare; autunite is common).
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        cu_fraction = self.fluid.Cu / cation_total
        if cu_fraction < 0.5:
            return 0

        # Activity factors — U is trace, Cu and P are moderate
        u_f = min(self.fluid.U / 2.0, 2.0)
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        p_f = min(self.fluid.P / 10.0, 2.0)
        sigma = u_f * cu_f * p_f

        # P-fraction sweet spot — 0.55-0.85 mirrors 9a's tuning.
        if 0.55 <= p_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 15-40°C
        T = self.temperature
        if 15 <= T <= 40:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:  # 40 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_autunite(self) -> float:
        """Autunite (Ca(UO₂)₂(PO₄)₂·11H₂O) — Ca-branch of the autunite-group
        cation+anion fork (Round 9d, May 2026).

        The Ca-cation analog of torbernite. Same parent fluid (U + P +
        supergene-T + oxidizing), same anion competition (P-branch), but
        wins when Ca/(Cu+Ca) > 0.5 — which is the geological default,
        because Ca >>> Cu in groundwater. Real autunite is far more common
        than torbernite; mining-museum bias has it backwards.

        The defining feature: where torbernite's Cu²⁺ quenches the uranyl
        emission, autunite's Ca²⁺ does not. Under longwave UV (365nm),
        autunite glows intense apple-green — one of the brightest
        fluorescent species known. This is the cation fork's narrative
        payoff: same uranyl, opposite glow.

        Forms canary-yellow tabular plates flattened on {001}, mohs 2-2.5,
        dehydrates irreversibly to meta-autunite (8H₂O) above ~80°C.
        Type locality: Saint-Symphorien, Autun, France (Adrien Brongniart,
        1852).

        Source: research/research-uraninite.md §Variants for Game §4
        (boss canonical 626bb22, May 2026).
        """
        # Required ingredients — Ca floor at 15 (typical groundwater
        # baseline; for context Cu floor is 5 because Cu is naturally
        # rarer, so a Cu>=5 fluid is already enriched, while Ca>=15 is
        # only just above seawater background)
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.P < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene zone, slightly wider than torbernite because
        # autunite forms at colder spring/groundwater temps too
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH gate — broader than torbernite (Ca²⁺ doesn't form the same
        # acid-side complexes Cu does)
        if self.fluid.pH < 4.5 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — same as torbernite/zeunerite/carnotite
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        p_fraction = self.fluid.P / anion_total
        if p_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over Cu (the 9d gate, mirror of
        # torbernite's Cu>0.5)
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors — U is trace; Ca is abundant; P is moderate
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        p_f = min(self.fluid.P / 10.0, 2.0)
        sigma = u_f * ca_f * p_f

        # P-fraction sweet spot — mirrors torbernite shape
        if 0.55 <= p_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 10-35°C (slightly cooler than torbernite's 15-40,
        # reflecting the more groundwater/spring-temp character)
        T = self.temperature
        if 10 <= T <= 35:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.5 + 0.07 * (T - 5)  # 5→0.5, 10→1.2
        else:  # 35 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_zeunerite(self) -> float:
        """Zeunerite (Cu(UO₂)₂(AsO₄)₂·xH₂O) — As-branch / Cu-cation of the
        autunite-group cation+anion fork (Round 9b/9e).

        9b shipped the As/(P+As) anion gate; 9c widened the denominator
        to P+As+V; 9e added the Cu/(Cu+Ca) cation gate to fork against
        uranospinite (Ca-cation analog). Two ratio gates now apply:
        - Anion: As/(P+As+V) > 0.5
        - Cation: Cu/(Cu+Ca) > 0.5

        Mirror of torbernite (Cu-P branch). Same crystal system, same
        tabular habit; distinguishable from torbernite only by chemistry.
        The arsenic is the giveaway: zeunerite localities are former
        mining districts with arsenopyrite or tennantite as primary As ores.

        Sources: research/research-zeunerite.md (boss commit 3bfdf4a);
        research/research-uranospinite.md (Round 9e cation fork);
        Schneeberg type locality (1872).
        """
        # Required ingredients
        if (self.fluid.Cu < 5 or self.fluid.U < 0.3
                or self.fluid.As < 2.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 10 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0

        # Anion competition — As must dominate over P + V
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        as_fraction = self.fluid.As / anion_total
        if as_fraction < 0.5:
            return 0
        # Cation competition (Round 9e) — Cu must dominate over Ca.
        # Mirror of torbernite's Round 9d gate. Without this, zeunerite
        # would fire in Ca-saturated groundwater that should route to
        # uranospinite.
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        cu_fraction = self.fluid.Cu / cation_total
        if cu_fraction < 0.5:
            return 0

        # Activity factors
        u_f = min(self.fluid.U / 2.0, 2.0)
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        as_f = min(self.fluid.As / 15.0, 2.0)
        sigma = u_f * cu_f * as_f

        # As-fraction sweet spot
        if 0.55 <= as_fraction <= 0.85:
            sigma *= 1.3

        # T optimum
        T = self.temperature
        if 15 <= T <= 40:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_uranospinite(self) -> float:
        """Uranospinite (Ca(UO₂)₂(AsO₄)₂·10H₂O) — As-branch / Ca-cation of
        the autunite-group cation+anion fork (Round 9e, May 2026).

        Ca-cation analog of zeunerite. Same parent fluid (U + As +
        supergene-T + oxidizing) but wins when Ca/(Cu+Ca) > 0.5 — typically
        when Cu has been depleted from the local fluid but As is still
        around. Strongly fluorescent yellow-green LW UV — Ca²⁺ doesn't
        quench uranyl emission like Cu²⁺ does in zeunerite (mirroring the
        autunite-vs-torbernite story on the As-branch).

        Sources: research/research-uranospinite.md (implementation-grade
        draft, 2026-05-01); MSA Handbook of Mineralogy; Schneeberg
        Walpurgis Flacher vein type locality (Weisbach 1873).
        """
        # Required ingredients — Ca floor at 15 (typical groundwater)
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.As < 2.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH window broader than zeunerite — Ca²⁺ doesn't form acid-side
        # complexes the way Cu²⁺ does
        if self.fluid.pH < 4.5 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — As must dominate over P + V
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        as_fraction = self.fluid.As / anion_total
        if as_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over Cu (mirror of zeunerite)
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors — Ca activity referenced at 50 ppm (groundwater
        # baseline), mirror autunite
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        as_f = min(self.fluid.As / 15.0, 2.0)
        sigma = u_f * ca_f * as_f

        # As-fraction sweet spot
        if 0.55 <= as_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 10-35°C (mirror autunite)
        T = self.temperature
        if 10 <= T <= 35:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.5 + 0.07 * (T - 5)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_carnotite(self) -> float:
        """Carnotite (K₂(UO₂)₂(VO₄)₂·3H₂O) — V-branch of the autunite-group
        anion-competition trio (Round 9c).

        Singleton — completes the 3-branch generalization started in 9a's
        broth-ratio mechanic. Different cation (K instead of Cu),
        different crystal system (monoclinic vs tetragonal), different
        habit (canary-yellow earthy crusts vs emerald tabular plates),
        same anion-competition mechanic. Nucleates when V/(P+As+V) > 0.5.

        Forms where oxidizing groundwater carries U⁶⁺ + V⁵⁺ + K⁺ together
        at the supergene front. Colorado Plateau sandstone-hosted uranium
        deposits are the type environment — one percent of carnotite
        stains an entire outcrop the color of school buses, which is
        how those districts were prospected before instruments.

        Source: research/research-carnotite.md (boss commit 3bfdf4a);
        Roc Creek type locality (1899).
        """
        # Required ingredients — K, U, V
        if (self.fluid.K < 5 or self.fluid.U < 0.3
                or self.fluid.V < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene/ambient (above 50°C the structure dehydrates,
        # collapses around 100°C)
        if self.temperature < 10 or self.temperature > 50:
            return 0
        # pH gate — V is mobile as VO₄³⁻ above pH 6 (Brookins 1988 Eh-pH);
        # below pH 5 the chemistry breaks and acid dissolution kicks in.
        # 5.0-7.5 stability window.
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0
        # Anion competition — V must dominate over P + As (the carnotite
        # branch of the trio).
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        v_fraction = self.fluid.V / anion_total
        if v_fraction < 0.5:
            return 0
        # Cation competition (Round 9e) — K must dominate over Ca.
        # Mirror of the torbernite/zeunerite cation forks. Without this,
        # carnotite would fire in Ca-saturated groundwater that should
        # route to tyuyamunite.
        cation_total = self.fluid.K + self.fluid.Ca
        if cation_total <= 0:
            return 0
        k_fraction = self.fluid.K / cation_total
        if k_fraction < 0.5:
            return 0

        # Activity factors — U is trace; K is moderate; V is sparse-trace.
        u_f = min(self.fluid.U / 2.0, 2.0)
        k_f = min(self.fluid.K / 30.0, 2.0)
        v_f = min(self.fluid.V / 10.0, 2.0)
        sigma = u_f * k_f * v_f

        # V-fraction sweet spot — same shape as torbernite/zeunerite
        if 0.55 <= v_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 20-40°C (slightly warmer-leaning than tor/zeu since
        # Colorado Plateau roll-fronts sit in arid surface-T conditions)
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.5 + 0.07 * (T - 10)  # 10→0.5 ramps to 20→1.2
        else:  # 40 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_tyuyamunite(self) -> float:
        """Tyuyamunite (Ca(UO₂)₂(VO₄)₂·5-8H₂O) — V-branch / Ca-cation of
        the autunite-group cation+anion fork (Round 9e, May 2026).

        Ca-cation analog of carnotite. Same parent fluid (U + V +
        supergene-T + oxidizing) but wins when Ca/(K+Ca) > 0.5 — the
        geological default in sandstone groundwater where Ca dominates
        K. Tyuyamunite and carnotite are commonly intergrown in Colorado
        Plateau and Tyuya-Muyun deposits, with the cation ratio drawing
        the boundary between them; Britannica notes they are
        interconvertible by cation exchange.

        Weakly to moderately fluorescent yellow-green LW UV (vanadate
        matrix dampens uranyl emission via vibrational coupling, same
        effect as carnotite but slightly lifted by Ca²⁺ vs K⁺).

        Sources: research/research-tyuyamunite.md (implementation-grade
        draft, 2026-05-01); American Mineralogist v.41 (1956); Tyuya-
        Muyun, Fergana Valley type locality (Nenadkevich 1912).
        """
        # Required ingredients — Ca floor at 15
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.V < 1.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH window — same as carnotite (V mobile as VO₄³⁻ above pH 5;
        # but slightly broader upper bound since Ca-V is more tolerant
        # of slightly alkaline groundwater)
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — V must dominate over P + As
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        v_fraction = self.fluid.V / anion_total
        if v_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over K (mirror of carnotite)
        cation_total = self.fluid.K + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        v_f = min(self.fluid.V / 10.0, 2.0)
        sigma = u_f * ca_f * v_f

        # V-fraction sweet spot
        if 0.55 <= v_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 15-35°C (mirror tyuyamunite's research §formation T)
        T = self.temperature
        if 15 <= T <= 35:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.5 + 0.07 * (T - 5)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)

