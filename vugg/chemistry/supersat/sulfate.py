"""Supersaturation methods for sulfate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (12):
  mirabilite, thenardite, selenite, anglesite, barite, anhydrite, brochantite, antlerite, jarosite, alunite, celestine, chalcanthite
"""

import math
from typing import Optional


class SulfateSupersatMixin:
    def supersaturation_mirabilite(self) -> float:
        """Mirabilite (Na₂SO₄·10H₂O) — Glauber salt. Cold-evaporite of
        the Na-sulfate system; only stable below the 32.4°C eutectic
        with thenardite. Above that the decahydrate dehydrates in
        place to thenardite — handled by DEHYDRATION_TRANSITIONS, not
        here. This method just guards the supersat gate so mirabilite
        only nucleates in cold playa / cave conditions.
        """
        if self.fluid.Na < 50 or self.fluid.S < 50 or self.fluid.O2 < 0.2:
            return 0
        # Above 32.4°C the decahydrate isn't stable — thenardite wins.
        if self.temperature > 32:
            return 0
        c = self.fluid.concentration
        # Hard concentration gate — same logic as borax/halite. Submerged
        # rings stay at c=1 and never fire mirabilite.
        if c < 1.5:
            return 0
        sigma = (self.fluid.Na / 300.0) * (self.fluid.S / 200.0) * c * c
        # Cold-T sweet spot — Antarctic dry-valley / winter-playa
        # chemistry where thenardite stays out of the picture.
        if self.temperature < 10:
            sigma *= 1.3
        # Acid penalty — sulfate stays in solution at pH > 5.
        if self.fluid.pH < 5.0:
            sigma *= 0.5
        return max(sigma, 0)

    def supersaturation_thenardite(self) -> float:
        """Thenardite (Na₂SO₄) — anhydrous Na-sulfate. Warm-evaporite
        half of the mirabilite-thenardite pair. Direct nucleation
        above the 32.4°C eutectic OR via dehydration paramorph from
        mirabilite (handled by DEHYDRATION_TRANSITIONS, not this
        method). Either way the geometry tells the story: dipyramidal
        thenardite primary, pseudomorphic thenardite from mirabilite
        (inherits the parent's habit).
        """
        if self.fluid.Na < 50 or self.fluid.S < 50 or self.fluid.O2 < 0.2:
            return 0
        # Below 25°C mirabilite is the stable phase — thenardite gate
        # closes. Between 25 and 32 there's a metastability window
        # but we keep it simple.
        if self.temperature < 25:
            return 0
        c = self.fluid.concentration
        if c < 1.5:
            return 0
        sigma = (self.fluid.Na / 300.0) * (self.fluid.S / 200.0) * c * c
        # Hot-T extra boost — playa-summer regime where thenardite
        # crusts the surface.
        if self.temperature > 50:
            sigma *= 1.2
        if self.fluid.pH < 5.0:
            sigma *= 0.5
        return max(sigma, 0)

    def supersaturation_selenite(self) -> float:
        """Selenite / Gypsum (CaSO₄·2H₂O) supersaturation. Needs Ca + S + O₂.

        The mineral of Marey's crystal. Evaporite — grows when water evaporates.
        Swallow-tail twins, desert rose, satin spar, cathedral blades.
        Forms at LOW temperatures (<60°C). Above that → anhydrite wins.
        Selenite = transparent; gypsum = massive variety. Same mineral.
        """
        if self.fluid.Ca < 20 or self.fluid.S < 15 or self.fluid.O2 < 0.2:
            return 0
        # Need oxidized sulfur (sulfate, not sulfide)
        sigma = (self.fluid.Ca / 60.0) * (self.fluid.S / 50.0) * (self.fluid.O2 / 0.5)
        # Phase boundary: gypsum-anhydrite transition is at ~55-60°C
        # (Naica 54.5°C, Pulpí 20°C, Van Driessche et al. 2016 +
        # MDPI Minerals 2024). Steep decay above 60°C.
        if self.temperature > 60:
            sigma *= math.exp(-0.06 * (self.temperature - 60))
        # v17: cool-T sweet-spot bonus (ported from JS canonical, May 2026).
        # Pulpí 20°C grew at this colder regime via anhydrite dissolution.
        if self.temperature < 40:
            sigma *= 1.5
        # Neutral to slightly alkaline pH preferred
        if self.fluid.pH < 5.0:
            sigma -= (5.0 - self.fluid.pH) * 0.2
        return max(sigma, 0)

    def supersaturation_anglesite(self) -> float:
        """Anglesite (PbSO₄) supersaturation. Needs Pb + oxidized S + O₂.

        Intermediate step in the lead-oxidation paragenesis. Galena
        oxidizes to Pb²⁺ + SO₄²⁻ → anglesite, which is transient in
        carbonate-bearing groundwater (dissolves and re-precipitates as
        cerussite). Strict low-T window (< 80°C) — anglesite is a
        supergene mineral only.
        """
        if (self.fluid.Pb < 15 or self.fluid.S < 15 or
                self.fluid.O2 < 0.8):
            return 0
        pb_f = min(self.fluid.Pb / 40.0, 2.0)
        s_f  = min(self.fluid.S / 40.0, 1.5)
        o_f  = min(self.fluid.O2 / 1.0, 1.5)
        sigma = pb_f * s_f * o_f
        # Low-T window — anglesite disappears fast above ~80°C
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Acid dissolution (pH < 2) — slow
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_barite(self) -> float:
        """Barite (BaSO₄) — the Ba sequestration mineral.

        The standard barium mineral and the densest non-metallic mineral
        most collectors will encounter (4.5 g/cm³). Galena's primary
        gangue mineral in MVT districts; also abundant in hydrothermal
        vein systems. Wide T window (5-500°C) — MVT brine, hydrothermal
        veins, and oilfield cold-seep barite all share the same engine.

        Eh requirement: O₂ ≥ 0.1 — sulfate stable. Below O₂=0.1 (strictly
        reducing), all S sits as sulfide and barite cannot form. Real MVT
        brine sits at mildly-reducing Eh where some SO₄²⁻ persists alongside
        H₂S, allowing barite + galena to coexist; current Tri-State scenario
        O2=0.0 is too reducing (gap flagged in audit).

        No acid dissolution — barite resists even concentrated H₂SO₄
        (which is why it's the standard drilling-mud weighting agent).
        Thermal decomposition only above 1149°C, well outside sim range.

        Source: Hanor 2000 (Reviews in Mineralogy 40); Anderson & Macqueen
        1982 (MVT mineralogy).
        """
        if self.fluid.Ba < 5 or self.fluid.S < 10 or self.fluid.O2 < 0.1:
            return 0
        # Factor caps to prevent evaporite-level S (thousands of ppm) from
        # producing runaway sigma. See vugg-mineral-template.md §5.
        ba_f = min(self.fluid.Ba / 30.0, 2.0)
        s_f = min(self.fluid.S / 40.0, 2.5)
        # O2 saturation kicks in around SO₄/H₂S Eh boundary (~O2=0.4 in
        # sim scale), not at fully oxidized (O2=1.0). At the boundary,
        # sulfate is at half-availability — barite + galena can coexist
        # there, the diagnostic MVT chemistry. Sabkha O2=1.5 still hits
        # the 1.5 cap.
        o2_f = min(self.fluid.O2 / 0.4, 1.5)
        sigma = ba_f * s_f * o2_f
        # Wide T window — peaks in MVT range (50-200°C)
        T = self.temperature
        if 50 <= T <= 200:
            sigma *= 1.2
        elif T < 5:
            sigma *= 0.3
        elif T > 500:
            sigma *= max(0.2, 1.0 - 0.003 * (T - 500))
        # pH window 4-9, gentle drop outside
        if self.fluid.pH < 4:
            sigma *= max(0.4, 1.0 - 0.2 * (4 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_anhydrite(self) -> float:
        """Anhydrite (CaSO₄) — the high-T or saline-low-T Ca sulfate sister of selenite.

        Two distinct stability regimes:
          1. High-T (>60°C): anhydrite stable; Bingham porphyry deep-brine
             zones contain massive anhydrite + chalcopyrite (Roedder 1971).
          2. Low-T (<60°C) with high salinity (>100‰ NaCl-eq): anhydrite
             stable due to lowered water activity; the Persian Gulf /
             Coorong sabkha and Salar de Atacama evaporite habitats.

        Below 60°C in dilute fluid (salinity < 100‰), anhydrite is
        metastable and rehydrates to gypsum (CaSO₄·2H₂O = selenite in
        the sim). Naica's giant selenite crystals grew on top of an
        older anhydrite floor that was the original evaporite layer.

        Source: Hardie 1967 (Am. Mineral. 52 — the canonical phase
        diagram); Newton & Manning 2005 (J. Petrol. 46 — high-T
        hydrothermal anhydrite); Warren 2006 (Evaporites textbook).
        """
        if (self.fluid.Ca < 50 or self.fluid.S < 20
                or self.fluid.O2 < 0.3):
            return 0
        ca_f = min(self.fluid.Ca / 200.0, 2.5)
        s_f = min(self.fluid.S / 40.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = ca_f * s_f * o2_f
        T = self.temperature
        salinity = self.fluid.salinity
        # Two-mode T — high-T branch OR low-T-saline branch
        if T > 60:
            if T < 200:
                T_factor = 0.5 + 0.005 * (T - 60)  # ramp 0.5 → 1.2
            elif T <= 700:
                T_factor = 1.2
            else:
                T_factor = max(0.3, 1.2 - 0.002 * (T - 700))
        else:
            # Low-T branch needs high salinity to suppress gypsum
            if salinity > 100:
                T_factor = min(1.0, 0.4 + salinity / 200.0)
            elif salinity > 50:
                # Marginal — partial activation
                T_factor = 0.3
            else:
                return 0  # dilute low-T → gypsum/selenite wins
        sigma *= T_factor
        # pH 5-9 stable
        if self.fluid.pH < 5:
            sigma *= max(0.4, 1.0 - 0.2 * (5 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_brochantite(self) -> float:
        """Brochantite (Cu₄(SO₄)(OH)₆) — the wet-supergene Cu sulfate.

        Emerald-green prismatic crystals; the higher-pH end of the
        brochantite ↔ antlerite pH-fork pair. Forms at pH 4-7 in
        oxidizing supergene conditions; takes over from malachite
        when carbonate buffering tapers off and sulfate residue
        dominates. Atacama Desert (Chile), Bisbee, Mt Lyell, Tsumeb.

        Forks with antlerite below pH 3.5 (acidification converts
        brochantite → antlerite + H₂O; reverse with neutralization).
        Above pH 7 dissolves to tenorite/malachite.

        Source: Pollard et al. 1992 (Mineralogical Magazine 56);
        Vasconcelos et al. 1994 (Atacama supergene Cu geochronology);
        Williams 1990 ("Oxide Zone Geochemistry" — standard reference).
        """
        if (self.fluid.Cu < 10 or self.fluid.S < 15
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH < 3 or self.fluid.pH > 7.5:
            return 0  # hard gates outside stability window
        cu_f = min(self.fluid.Cu / 40.0, 2.5)
        s_f = min(self.fluid.S / 30.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = cu_f * s_f * o2_f
        # Strongly low-T (supergene only)
        if self.temperature > 50:
            sigma *= math.exp(-0.05 * (self.temperature - 50))
        # pH peak 5-6, falls outside 4-7
        if self.fluid.pH < 4:
            sigma *= max(0.3, 1.0 - 0.5 * (4 - self.fluid.pH))
        elif self.fluid.pH > 6:
            sigma *= max(0.3, 1.0 - 0.4 * (self.fluid.pH - 6))
        return max(sigma, 0)

    def supersaturation_antlerite(self) -> float:
        """Antlerite (Cu₃(SO₄)(OH)₄) — the dry-acid-supergene Cu sulfate.

        Same emerald-green color as brochantite but pH 1-3.5 stability —
        the lower-pH end of the brochantite ↔ antlerite fork. Type locality
        Antler mine (Mohave County, AZ); world-class deposits at
        Chuquicamata (Chile) where antlerite was the dominant supergene Cu
        mineral mined 1920s-50s. Cu₃ vs brochantite's Cu₄ — more SO₄ per Cu.

        Forks with brochantite above pH 3.5 (neutralization converts
        antlerite → brochantite). Below pH 1 dissolves to chalcanthite
        (CuSO₄·5H₂O — not in sim).

        Source: Hillebrand 1889 (type description); Pollard et al. 1992
        (joint brochantite-antlerite stability paper).
        """
        if (self.fluid.Cu < 15 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 4 or self.fluid.pH < 0.5:
            return 0  # hard gates: needs strong acid, but not extreme
        cu_f = min(self.fluid.Cu / 40.0, 2.5)
        s_f = min(self.fluid.S / 30.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = cu_f * s_f * o2_f
        # Strongly low-T
        if self.temperature > 50:
            sigma *= math.exp(-0.05 * (self.temperature - 50))
        # pH peak 2-3, falls outside 1-3.5
        if self.fluid.pH > 3.5:
            sigma *= max(0.2, 1.0 - 0.5 * (self.fluid.pH - 3.5))
        elif self.fluid.pH < 1.5:
            sigma *= max(0.4, 1.0 - 0.3 * (1.5 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_jarosite(self) -> float:
        """Jarosite (KFe³⁺₃(SO₄)₂(OH)₆) — the diagnostic acid-mine-drainage mineral.

        Yellow-to-ocher pseudocubic rhombs and powdery crusts; the
        supergene Fe-sulfate that takes over from goethite when pH
        drops below 4. Confirmed on Mars at Meridiani Planum by MER
        Opportunity Mössbauer (Klingelhöfer et al. 2004) — proof of
        past acidic surface water on Mars. Earth localities: Rio Tinto,
        Red Mountain Pass (CO), every active sulfide-mine tailings pond.

        Stability gates: K ≥ 5 (from concurrent feldspar weathering),
        Fe ≥ 10, S ≥ 20, O2 ≥ 0.5 (strongly oxidizing), pH 1-4
        (above pH 4 jarosite dissolves and Fe goes to goethite),
        T < 100 °C (kinetically supergene only — never hydrothermal).

        Source: Bigham et al. 1996 (Geochim. Cosmochim. Acta 60);
        Stoffregen et al. 2000 (Reviews in Mineralogy 40).
        """
        if (self.fluid.K < 5 or self.fluid.Fe < 10 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 5:
            return 0  # hard gate; jarosite only stable in acid drainage
        # Factor caps
        k_f = min(self.fluid.K / 15.0, 2.0)
        fe_f = min(self.fluid.Fe / 30.0, 2.5)
        s_f = min(self.fluid.S / 50.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = k_f * fe_f * s_f * o2_f
        # Strongly low-T — supergene only
        if self.temperature > 50:
            sigma *= math.exp(-0.04 * (self.temperature - 50))
        # pH peak around 2-3, falls outside 1-4
        if self.fluid.pH > 4:
            sigma *= max(0.2, 1.0 - 0.6 * (self.fluid.pH - 4))
        elif self.fluid.pH < 1:
            sigma *= 0.4
        return max(sigma, 0)

    def supersaturation_alunite(self) -> float:
        """Alunite (KAl₃(SO₄)₂(OH)₆) — the Al sister of jarosite (alunite group).

        Same trigonal structure as jarosite, with Al³⁺ replacing Fe³⁺.
        The index mineral of "advanced argillic" alteration in
        porphyry-Cu lithocaps and high-sulfidation epithermal Au
        deposits (Marysvale UT type locality, Goldfield NV, Summitville,
        Yanacocha). Mined as a K source 1900s before potash mining
        took over.

        Stability gates: K ≥ 5, Al ≥ 10 (from feldspar leaching), S ≥ 20,
        O2 ≥ 0.5, pH 1-4. Wider T window than jarosite (50-300 °C
        — hydrothermal acid-sulfate alteration spans the porphyry
        epithermal range, not just supergene).

        Source: Hemley et al. 1969 (Econ. Geol. 64); Stoffregen 1987
        (Summitville Au-Cu-Ag); Stoffregen et al. 2000 (Rev. Mineral. 40).
        """
        if (self.fluid.K < 5 or self.fluid.Al < 10 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 5:
            return 0
        k_f = min(self.fluid.K / 15.0, 2.0)
        al_f = min(self.fluid.Al / 25.0, 2.5)
        s_f = min(self.fluid.S / 50.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = k_f * al_f * s_f * o2_f
        # Wider T window than jarosite — hydrothermal acid-sulfate
        T = self.temperature
        if 50 <= T <= 200:
            sigma *= 1.2
        elif T < 25:
            sigma *= 0.5
        elif T > 350:
            sigma *= max(0.2, 1.0 - 0.005 * (T - 350))
        # pH peak 2-3
        if self.fluid.pH > 4:
            sigma *= max(0.2, 1.0 - 0.6 * (self.fluid.pH - 4))
        elif self.fluid.pH < 1:
            sigma *= 0.4
        return max(sigma, 0)

    def supersaturation_celestine(self) -> float:
        """Celestine (SrSO₄) — the Sr sequestration mineral.

        Strontium sulfate; isostructural with barite. Pale celestial blue
        F-center color is the diagnostic. Forms primarily in low-T
        evaporite settings (Coorong + Persian Gulf sabkha) and as fibrous
        sulfur-vug overgrowths (Sicilian Caltanissetta). Also in MVT
        veins as the Sr-end of the barite-celestine solid solution.

        Eh requirement: O₂ ≥ 0.1 — sulfate stable. Same Eh constraint as
        barite. No acid dissolution; thermal decomposition only above
        1100°C.

        Source: Hanor 2000 (Reviews in Mineralogy 40); Schwartz et al.
        2018 (Sr-isotope geochronology of MVT-hosted celestine).
        """
        if self.fluid.Sr < 3 or self.fluid.S < 10 or self.fluid.O2 < 0.1:
            return 0
        # Factor caps — see barite for rationale (sabkha S=2700 would
        # otherwise produce sigma > 100). O2 saturation at SO₄/H₂S
        # boundary (O2≈0.4) — same MVT-coexistence rationale.
        sr_f = min(self.fluid.Sr / 15.0, 2.0)
        s_f = min(self.fluid.S / 40.0, 2.5)
        o2_f = min(self.fluid.O2 / 0.4, 1.5)
        sigma = sr_f * s_f * o2_f
        # Low-T preferred — supergene/evaporite/MVT
        T = self.temperature
        if T < 100:
            sigma *= 1.2
        elif 100 <= T <= 200:
            sigma *= 1.0
        elif T > 200:
            sigma *= max(0.3, 1.0 - 0.005 * (T - 200))
        # pH 5-9 stable, narrower than barite
        if self.fluid.pH < 5:
            sigma *= max(0.4, 1.0 - 0.2 * (5 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_chalcanthite(self) -> float:
        """Chalcanthite (CuSO₄·5H₂O) — the bright-blue water-soluble Cu sulfate.

        The terminal mineral of the Cu sulfate oxidation cascade
        (chalcopyrite → bornite → chalcocite → covellite → cuprite →
        brochantite → antlerite → chalcanthite). Lives only in arid,
        strongly oxidizing, very acidic, salt-concentrated drainage —
        Chuquicamata mine walls, Rio Tinto AMD seeps, Atacama desert
        evaporite crusts.

        Hard gates:
          • Cu < 30 or S < 50 → 0 (needs concentrated Cu²⁺ + SO₄²⁻)
          • pH > 4 → 0 (the most acid-loving of the Cu sulfates)
          • O₂ < 0.8 → 0 (must be fully oxidizing)
          • salinity < 6 → 0 (needs concentrated drainage to overcome
            the ~20 g/100mL solubility)

        The water-solubility metastability mechanic lives in
        VugSimulator.run_step (per-step hook): chalcanthite crystals
        re-dissolve when fluid.salinity < 4 OR fluid.pH > 5. First
        re-dissolvable mineral in the sim — distinct from
        THERMAL_DECOMPOSITION (which destroys + releases at high T)
        and PARAMORPH_TRANSITIONS (which converts in place). Geological
        truth: every chalcanthite specimen is a temporary victory over
        entropy.

        Source: research/research-chalcanthite.md (boss commit f2939da);
        Bandy 1938 (Am. Mineral. 23, on chalcanthite paragenesis).
        """
        if self.fluid.Cu < 30 or self.fluid.S < 50:
            return 0
        if self.fluid.pH > 4:
            return 0
        if self.fluid.O2 < 0.8:
            return 0
        # Salinity gate — needs concentrated drainage (>= 5 wt%, the
        # FluidChemistry default; arid AMD seeps and Bisbee primary
        # brine clear easily; supergene_oxidation at 2.0 stays below).
        if self.fluid.salinity < 5.0:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 3.0)
        s_f  = min(self.fluid.S  / 100.0, 3.0)
        ox_f = min(self.fluid.O2 / 1.5, 2.0)
        # Salinity factor — the more concentrated, the higher σ.
        sal_f = min(self.fluid.salinity / 30.0, 3.0)
        # Acidic preference — strongest at pH < 2.
        ph_f = max(0.5, 1.0 + (3.0 - self.fluid.pH) * 0.2)
        sigma = cu_f * s_f * ox_f * sal_f * ph_f
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.3
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.09 * (T - 10)
        elif T <= 50:
            T_factor = max(0.4, 1.3 - 0.06 * (T - 40))
        else:
            T_factor = 0.2
        sigma *= T_factor
        return max(sigma, 0)

