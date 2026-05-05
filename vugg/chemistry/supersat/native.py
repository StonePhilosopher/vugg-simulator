"""Supersaturation methods for native minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (7):
  native_bismuth, native_gold, native_copper, native_tellurium, native_sulfur, native_arsenic, native_silver
"""

import math
from typing import Optional


class NativeSupersatMixin:
    def supersaturation_native_bismuth(self) -> float:
        """Native bismuth (Bi) supersaturation. Bi + very low S + reducing.

        Forms when sulfur runs out before bismuth does — bismuthinite
        scavenged the available S and residual Bi crystallizes native.
        Melts at unusually low 271.5°C; beyond that, the crystal is
        liquid metal.
        """
        if (self.fluid.Bi < 15 or self.fluid.S > 12 or
                self.fluid.O2 > 0.6):
            return 0
        bi_f = min(self.fluid.Bi / 25.0, 2.0)
        # Low-S preference — any S pulls Bi into bismuthinite instead
        s_mask = max(0.4, 1.0 - self.fluid.S / 20.0)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = bi_f * s_mask * red_f
        T = self.temperature
        if 100 <= T <= 250:
            T_factor = 1.0
        elif T < 100:
            T_factor = 0.6
        elif T <= 270:
            T_factor = max(0.3, 1.0 - 0.05 * (T - 250))   # sharply approaches melting
        else:
            T_factor = 0.1   # melted
        sigma *= T_factor
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_native_gold(self) -> float:
        """Native gold (Au) supersaturation.

        Au has extreme affinity for the native form across most natural
        conditions — equilibrium Au activity in any aqueous fluid is
        sub-ppb, so even fractional ppm Au in the broth is hugely
        supersaturated against equilibrium. The threshold here (Au ≥
        0.5 ppm) is the practical sim minimum; below that level the
        gold stays partitioned in solution as Au-Cl or Au-HS complexes
        without nucleating distinct crystals.

        Two precipitation pathways the model collapses into one σ:
          1. High-T magmatic-hydrothermal — Au-Cl complex destabilizes
             at boiling / decompression / cooling. The Bingham
             vapor-plume Au mechanism (Landtwing et al. 2010).
          2. Low-T supergene — Au-Cl reduces to Au0 at the redox
             interface, often coupled with chalcocite enrichment. The
             Bisbee oxidation-cap mechanism (Graeme et al. 2019).

        Unlike native_copper, gold tolerates BOTH oxidizing AND
        reducing fluids because the two transport complexes (Au-Cl
        oxidizing vs Au-HS reducing) cover both regimes — there's no
        Eh window where gold can't deposit if Au activity is high.

        Sulfur suppression is the main competing factor: above
        ~100 ppm S, Au stays in Au-HS solution and/or partitions into
        coexisting Au-Te species (when Te is also present) instead of
        nucleating native gold.
        """
        if self.fluid.Au < 0.5:
            return 0
        # Au activity factor — even small Au is hugely supersaturated.
        # Cap at 4× to keep extreme Au from blowing out the dispatcher.
        au_f = min(self.fluid.Au / 1.0, 4.0)
        # Sulfur suppression — high S keeps Au in Au(HS)2- complex.
        # Above ~100 ppm S the suppression dominates.
        s_f = max(0.2, 1.0 - self.fluid.S / 200.0)
        sigma = au_f * s_f
        # Wide T tolerance — gold deposits span 25-700°C (porphyry to
        # placer to epithermal). Mild dropoff above 400°C and below
        # 20°C.
        T = self.temperature
        if 20 <= T <= 400:
            T_factor = 1.0
        elif T < 20:
            T_factor = 0.5
        elif T <= 700:
            T_factor = max(0.5, 1.0 - 0.001 * (T - 400))
        else:
            T_factor = 0.3
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_native_copper(self) -> float:
        """Native copper (Cu) supersaturation. Very high Cu + strongly reducing.

        Only forms when S²⁻ is low enough not to make sulfides AND Eh
        is strongly reducing (O₂ < 0.4 in our scale). Wide T stability
        (up to 300°C). High σ threshold (1.6) because the specific
        chemistry window is narrow.
        """
        if (self.fluid.Cu < 50 or self.fluid.O2 > 0.4 or
                self.fluid.S > 30):
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        # Reducing preference — stronger than bornite/chalcocite
        red_f = max(0.4, 1.0 - self.fluid.O2 * 2.0)
        # Sulfide-suppression — any S lowers yield
        s_f = max(0.3, 1.0 - self.fluid.S / 40.0)
        sigma = cu_f * red_f * s_f
        T = self.temperature
        if 20 <= T <= 150:
            T_factor = 1.0
        elif T < 20:
            T_factor = 0.7
        elif T <= 300:
            T_factor = max(0.4, 1.0 - 0.004 * (T - 150))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_native_tellurium(self) -> float:
        """Native tellurium (Te⁰) — the metal-telluride-overflow native element.

        The rarest of the native-element overflow trio. Te is rarer
        than platinum in Earth's crust — when it does appear in
        epithermal gold systems, every metal in the broth covets it
        desperately: Au makes calaverite (AuTe₂) and sylvanite, Ag
        makes hessite (Ag₂Te), Pb makes altaite (PbTe), Bi makes
        tetradymite (Bi₂Te₂S), Hg makes coloradoite (HgTe). Native
        Te only crystallizes when every telluride-forming metal has
        had its fill and there's still Te left over.

        Hard gates:
          • Au > 1.0 → 0 (Au consumes Te as calaverite/sylvanite)
          • Ag > 5.0 → 0 (Ag consumes Te as hessite)
          • Hg > 0.5 → 0 (Hg consumes Te as coloradoite)
          • O₂ > 0.5 → 0 (oxidizing fluid takes Te to tellurite/tellurate)
        Soft preferences: T 150-300°C optimum (epithermal range), pH 4-7.

        Geological motifs (research file):
          • Cripple Creek epithermal Au-Te veins
          • Kalgoorlie golden-mile (richest Au-Te ore on Earth)
          • Emperor Mine Vatukoula Fiji

        Source: research/research-native-tellurium.md (boss commit
        f2939da); Spry & Thieben 1996 (Mineralium Deposita 31).
        """
        if self.fluid.Te < 0.5:
            return 0
        # Telluride-forming metal gates — hard zeros.
        if self.fluid.Au > 1.0:
            return 0
        if self.fluid.Ag > 5.0:
            return 0
        # Hg not currently tracked in FluidChemistry; coloradoite (HgTe)
        # gate would go here when Hg is plumbed in a future round.
        # Reducing requirement.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factor — Te is so rare that even sub-ppm levels are
        # supersaturated against equilibrium.
        te_f = min(self.fluid.Te / 2.0, 3.5)
        # Soft Pb/Bi suppression — these also form tellurides but the
        # dispatcher gives native Te a chance at lower base-metal levels.
        pb_suppr = max(0.5, 1.0 - self.fluid.Pb / 200.0)
        bi_suppr = max(0.5, 1.0 - self.fluid.Bi / 60.0)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.8)
        sigma = te_f * pb_suppr * bi_suppr * red_f
        # T window — peak 150-300°C epithermal optimum.
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 150:
            T_factor = 0.3 + 0.018 * (T - 100)
        elif T <= 400:
            T_factor = max(0.4, 1.2 - 0.008 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_native_sulfur(self) -> float:
        """Native sulfur (S₈) — the synproportionation native element.

        The Eh-window mineral. Native sulfur lives on the H₂S/SO₄²⁻
        boundary: where the fluid is partially oxidized (sulfide and
        sulfate co-exist), the synproportionation reaction
        H₂S + SO₄²⁻ → 2S⁰ + H₂O drops elemental S out of solution.
        Below the boundary (fully reducing) → all S is sulfide bonded
        into pyrite/galena/sphalerite. Above the boundary (fully
        oxidizing) → all S is sulfate, joining barite/celestine/
        anhydrite/jarosite.

        Hard gates:
          • O₂ < 0.1 → 0 (fully reducing — sulfides take everything)
          • O₂ > 0.7 → 0 (fully oxidizing — sulfates take everything)
          • pH > 5  → 0 (high pH stabilizes HS⁻/SO₄²⁻; native S
            requires acidic conditions where H₂S dominates)
          • Sum(Fe+Cu+Pb+Zn) > 100 → 0 (base metals capture S first)
        Soft preference: T < 100°C (β-S above 95.5°C is unstable;
        most native S is α-S below the boundary).

        Geological motifs (research file):
          • Volcanic fumarole sublimation (high σ at vents)
          • Sedimentary biogenic via Desulfovibrio bacteria
            (caprock of salt domes, Tarnobrzeg)
          • Hydrothermal late-stage low-T (Sicilian dipyramids)

        Source: research/research-native-sulfur.md (boss commit
        f2939da); Holland 1965 (Econ. Geol. 60, on H₂S/SO₄ boundary
        thermodynamics).
        """
        if self.fluid.S < 100:
            return 0
        # Synproportionation Eh window — narrow.
        if self.fluid.O2 < 0.1 or self.fluid.O2 > 0.7:
            return 0
        # Acidic only — H₂S dominant in pH < 5.
        if self.fluid.pH > 5:
            return 0
        # Base-metal sulfide capture — Fe+Cu+Pb+Zn together gate the
        # native S window. Each metal preferentially binds S into a
        # sulfide before the synproportionation reaction can fire.
        metal_sum = self.fluid.Fe + self.fluid.Cu + self.fluid.Pb + self.fluid.Zn
        if metal_sum > 100:
            return 0
        # Activity factor — at S=2700 (Coorong sabkha) σ would be huge
        # without a cap. Cap at S/200 to keep within reasonable range.
        s_f = min(self.fluid.S / 200.0, 4.0)
        # Eh-boundary preference — peak in the middle (O2 ≈ 0.4).
        eh_dist = abs(self.fluid.O2 - 0.4)
        eh_f = max(0.4, 1.0 - 2.0 * eh_dist)  # peak at 0.4, half-life 0.3
        # Acidic preference — stronger at lower pH.
        ph_f = max(0.4, 1.0 - 0.15 * self.fluid.pH)
        sigma = s_f * eh_f * ph_f
        # T preference — α-S sweet spot 20-95°C, drops sharply above.
        T = self.temperature
        if 20 <= T <= 95:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.6
        elif T <= 119:
            T_factor = max(0.5, 1.2 - 0.025 * (T - 95))
        elif T < 200:
            T_factor = max(0.3, 0.5 - 0.005 * (T - 119))  # fumarole tail
        else:
            T_factor = 0.0  # melts above 115; no growth
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_native_arsenic(self) -> float:
        """Native arsenic (As⁰) — the residual-overflow native element.

        The "leftovers" mineral: native As only forms when As is in
        the fluid AND every other element that wants As (Fe → arsenopyrite,
        Ni → nickeline, Co → safflorite, S → realgar/orpiment) has
        already had its share. Same depletion-overflow logic as
        native_silver, but the gates are reversed: instead of needing
        S to be absent, we need *all the As consumers* to be absent.

        Hard gates:
          • S > 10 → 0 (As goes into realgar/orpiment/arsenopyrite)
          • Fe > 50 → 0 (As goes into arsenopyrite preferentially)
          • O₂ > 0.5 → 0 (oxidizing fluid takes As to scorodite/AsO₄)
        Soft preference: pH 4-7, T 150-300°C optimum.

        Geologically: every famous native-As locality (Freiberg
        Saxony, Sainte-Marie-aux-Mines Alsace, Příbram Czech) is a
        Co-Ni-Ag vein deposit where Co/Ni/Ag captured the metals first
        and S was already locked into other arsenides — so the residual
        As had nothing to bond with except itself.

        Source: research/research-native-arsenic.md (boss commit
        f2939da); Petruk 1971 (Cobalt-Ag paragenesis).
        """
        if self.fluid.As < 5:
            return 0
        # S overflow gate — As goes to realgar/orpiment/arsenopyrite first.
        if self.fluid.S > 10.0:
            return 0
        # Fe overflow gate — As goes to arsenopyrite preferentially.
        if self.fluid.Fe > 50.0:
            return 0
        # Strongly reducing — oxidizing fluid takes As to arsenate.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factor — high As required to overcome the kinetic
        # barrier to native-metalloid nucleation.
        as_f = min(self.fluid.As / 30.0, 3.0)
        # Reducing preference.
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.8)
        # Soft S suppression — even sub-threshold S lowers yield.
        s_suppr = max(0.4, 1.0 - self.fluid.S / 12.0)
        sigma = as_f * red_f * s_suppr
        # T window — peak 150-300°C.
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 150:
            T_factor = 0.3 + 0.018 * (T - 100)
        elif T <= 350:
            T_factor = max(0.5, 1.2 - 0.014 * (T - 300))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference 4-7.
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_native_silver(self) -> float:
        """Native silver (Ag⁰) — the Kongsberg wire-silver mineral.

        The S-depletion mineral: native silver only forms where every
        sulfur atom is already claimed (the Ag-HS complex equilibrium
        breaks down) AND the fluid is strongly reducing (Ag⁺ → Ag⁰).
        Geologically authentic — every famous wire-silver locality
        sits in a sulfide-depleted reducing pocket: Kongsberg's
        calcite-vein basement (no nearby sulfide source), Cobalt
        Ontario's cobalt-nickel-arsenide veins (Co/Ni/As consume S
        before Ag arrives), Keweenaw's basalt amygdules (no S in
        the host).

        This is the *inverse* of the priority chains in the
        beryl/corundum families. There the high-priority variant
        fires when its chromophore is present; here native_silver
        fires when its competitor's reagent (S²⁻) is *absent*. First
        depletion-gate engine in the sim.

        Source: research/research-native-silver.md (boss commit
        f2939da); Boyle 1968 (GSA Bulletin 79); Kissin & Mango 2014
        (CIM Special Volume 54, on Cobalt-Ag deposits).
        """
        # Hard threshold — Ag must be supersaturated enough to overcome
        # the kinetic barrier to native-metal nucleation.
        if self.fluid.Ag < 1.0:
            return 0
        # S-depletion gate — the chemistry novelty. Above 2 ppm S, all
        # available Ag goes into acanthite first (preferred sulfide
        # stability). Hard zero, no soft rolloff.
        if self.fluid.S > 2.0:
            return 0
        # Strongly reducing — Ag⁺ → Ag⁰ requires a low-Eh fluid. Above
        # 0.3 the Ag stays in solution as Ag⁺ (or as Ag-Cl complexes).
        if self.fluid.O2 > 0.3:
            return 0
        # Ag activity factor — even fractional ppm is hugely
        # supersaturated against native-metal equilibrium.
        ag_f = min(self.fluid.Ag / 2.0, 3.0)
        # Reducing preference — stronger than acanthite, mirrors
        # native_copper.
        red_f = max(0.3, 1.0 - self.fluid.O2 * 2.5)
        # Sulfide suppression — any residual S lowers yield.
        s_f = max(0.2, 1.0 - self.fluid.S / 4.0)
        sigma = ag_f * red_f * s_f
        # T window — peak 100-200°C (epithermal wire-silver), tapers above.
        T = self.temperature
        if 100 <= T <= 200:
            T_factor = 1.2
        elif T < 50:
            T_factor = 0.4
        elif T < 100:
            T_factor = 0.4 + 0.016 * (T - 50)  # 50→0.4 ramps to 100→1.2
        elif T <= 300:
            T_factor = max(0.4, 1.2 - 0.008 * (T - 200))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference — neutral 5-7 sweet spot, narrower than acanthite
        # because native metals tend to be acid-sensitive.
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.6
        return max(sigma, 0)

