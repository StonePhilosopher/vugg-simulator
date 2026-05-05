"""Supersaturation methods for sulfide minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (20):
  sphalerite, wurtzite, pyrite, marcasite, chalcopyrite, tetrahedrite, tennantite, galena, stibnite, bismuthinite, bornite, chalcocite, covellite, molybdenite, arsenopyrite, acanthite, argentite, nickeline, millerite, cobaltite
"""

import math
from typing import Optional


class SulfideSupersatMixin:
    def supersaturation_sphalerite(self) -> float:
        """Sphalerite (ZnS) supersaturation. Needs Zn + S.

        Sphalerite is the low-T polymorph of ZnS. Above ~95°C, the hexagonal
        dimorph wurtzite is favored. The T factor below the 95°C transition
        favors sphalerite; above it, sigma decays faster so wurtzite wins.
        """
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)
        # Below 95°C: full sigma. Above: accelerated decay (wurtzite field).
        if self.temperature <= 95:
            T_factor = 2.0 * math.exp(-0.004 * self.temperature)
        else:
            T_factor = 2.0 * math.exp(-0.01 * self.temperature)
        return product * T_factor

    def supersaturation_wurtzite(self) -> float:
        """Wurtzite ((Zn,Fe)S) — hexagonal dimorph of sphalerite.

        Same (Zn,Fe)S composition as sphalerite, different crystal
        structure. Cubic ABCABC stacking → sphalerite; hexagonal ABABAB
        stacking → wurtzite. The two are end-members of a polytype series
        (the famous Aachen schalenblende banding alternates layers of both).

        Equilibrium phase boundary is 1020°C (Allen & Crenshaw 1912;
        Scott & Barnes 1972) — well above any hydrothermal range. By
        equilibrium thermodynamics alone, sphalerite always wins below
        ~1000°C. But wurtzite forms METASTABLY at lower T under specific
        conditions (Murowchick & Barnes 1986, *Am. Mineralogist*
        71:1196-1208):

        1. Acidic conditions (pH < 4) — H2S/HS- speciation favors
           hexagonal stacking kinetically.
        2. High Zn²⁺ activity — rapid precipitation under high σ
           kinetically traps the hexagonal form.
        3. Fe substitution (>1 mol%) — stabilizes wurtzite over
           sphalerite at low T (Aachen-style 'wurtzite-Fe').

        Round 9c retrofit (Apr 2026): two-branch model. Above 95°C the
        existing equilibrium peak (150-300°C); below 95°C a new
        metastable branch fires only when all three Murowchick & Barnes
        conditions are met. See research/research-broth-ratio-sphalerite-
        wurtzite.md.
        """
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        T = self.temperature
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)

        if T > 95:
            # Equilibrium high-T branch — peak 150-300°C, decay at extremes.
            if T < 150:
                T_factor = (T - 95) / 55.0  # 0 → 1 across 95-150
            elif T <= 300:
                T_factor = 1.4  # broad peak
            else:
                T_factor = 1.4 * math.exp(-0.005 * (T - 300))
            return product * T_factor

        # Low-T metastable branch (Murowchick & Barnes 1986).
        # All three conditions required — any one alone won't trap the
        # hexagonal form. pH<4 for the speciation; sigma_base>=1 for
        # genuine supersaturation; Fe>=5 for the stabilization.
        if self.fluid.pH >= 4.0:
            return 0
        if product < 1.0:
            return 0
        if self.fluid.Fe < 5:
            return 0
        # Damped relative to the high-T equilibrium peak — wurtzite is
        # the thermodynamically wrong answer here and only forms because
        # kinetics outrun equilibration. 0.4 keeps it less common than
        # sphalerite under the same low-T acidic conditions.
        return product * 0.4

    def supersaturation_pyrite(self) -> float:
        """Pyrite (FeS2) supersaturation. Needs Fe + S, reducing conditions.

        Pyrite is the most common sulfide. Forms over huge T range (25-700°C).
        Needs iron AND sulfur AND not too oxidizing.

        Below pH 5, the orthorhombic dimorph marcasite is favored over cubic
        pyrite — same formula, different crystal structure. pH rolloff here
        lets marcasite win that competition without breaking neutral scenarios.
        """
        if self.fluid.Fe < 5 or self.fluid.S < 10:
            return 0
        # Oxidizing conditions destroy sulfides
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # v17: use effective_temperature (Mo flux widens T window in
        # porphyry sulfide systems).
        eT = self.effective_temperature
        T_factor = 1.0 if 100 < eT < 400 else 0.5
        # pH rolloff below 5 — marcasite takes over
        pH_factor = 1.0
        if self.fluid.pH < 5.0:
            pH_factor = max(0.3, (self.fluid.pH - 3.5) / 1.5)
        return product * T_factor * pH_factor * (1.5 - self.fluid.O2)

    def supersaturation_marcasite(self) -> float:
        """Marcasite (FeS2) — orthorhombic dimorph of pyrite, acid-favored.

        Same composition as pyrite, different crystal structure. Acidic conditions
        (pH < 5) and low temperature (< 240°C) switch the structure from cubic to
        orthorhombic. Metastable — above 240°C, marcasite converts to pyrite.

        The switch is hard: pH ≥ 5 or T > 240°C returns zero. Pyrite handles
        those regimes. Below pH 5, marcasite sigma rises as acidity increases,
        giving it a clean win over pyrite in reactive_wall / supergene fluids.
        """
        if self.fluid.Fe < 5 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        # Hard gates: acid AND low-T regime only
        if self.fluid.pH >= 5.0:
            return 0
        if self.temperature > 240:
            return 0
        product = (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # Stronger in more acidic fluids — peaks at pH 3
        pH_factor = min(1.4, (5.0 - self.fluid.pH) / 1.2)
        # Low-T preference — marcasite is a surficial/near-surface crystal
        T_factor = 1.2 if self.temperature < 150 else 0.6
        return product * pH_factor * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_chalcopyrite(self) -> float:
        """Chalcopyrite (CuFeS2) supersaturation. Needs Cu + Fe + S.

        Main copper ore mineral. Competes with pyrite for Fe and S.

        v13 (May 2026): T window upgraded to 4-tier per Seo et al. 2012
        — main porphyry window 300-500°C, ~90% deposits before 400°C;
        viable but not peak 200-300°C; rare below 180°C; fades above
        500°C. Was previously a flat 1.2/0.6 binary at 150-350°C.
        Brought into line with index.html + agent-api/vugg-agent.js
        which already used this formulation. (Note: JS uses
        effectiveTemperature for Mo-flux modulation; Python uses plain
        temperature — effectiveTemperature is a JS-only feature, filed
        in BACKLOG.)
        """
        if self.fluid.Cu < 10 or self.fluid.Fe < 5 or self.fluid.S < 15:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Cu / 80.0) * (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # v17: use effective_temperature for Mo-flux porphyry boost
        T = self.effective_temperature
        if T < 180:
            T_factor = 0.2  # rare at low T
        elif T < 300:
            T_factor = 0.8  # viable, not peak
        elif T <= 500:
            T_factor = 1.3  # sweet spot — porphyry window
        else:
            T_factor = 0.5  # fades above 500°C
        return product * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_tetrahedrite(self) -> float:
        """Tetrahedrite (Cu₁₂Sb₄S₁₃) — the Sb-endmember fahlore sulfosalt.

        Hydrothermal Cu-Sb-S sulfosalt forming 100-400°C, optimum 200-300°C.
        Paired with tennantite (As endmember) — same cubic structure, continuous
        solid solution. Ag substitutes for Cu, making Ag-rich tetrahedrite
        ('freibergite') an important silver ore.
        """
        if self.fluid.Cu < 10 or self.fluid.Sb < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        if self.fluid.pH < 3.0 or self.fluid.pH > 7.0:
            return 0
        if self.temperature < 100 or self.temperature > 400:
            return 0
        product = (self.fluid.Cu / 40.0) * (self.fluid.Sb / 15.0) * (self.fluid.S / 40.0)
        # T-window centered on 200-300°C
        if 200 <= self.temperature <= 300:
            T_factor = 1.3
        elif 150 <= self.temperature < 200 or 300 < self.temperature <= 350:
            T_factor = 1.0
        else:
            T_factor = 0.6
        return product * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_tennantite(self) -> float:
        """Tennantite (Cu₁₂As₄S₁₃) — the As-endmember fahlore sulfosalt.

        As counterpart to tetrahedrite; same cubic structure, continuous solid
        solution. Optimum 150-300°C — slightly lower-T than tetrahedrite. Thin
        fragments transmit cherry-red light, the diagnostic. Oxidation releases
        AsO₄³⁻, feeding the secondary arsenate paragenesis (adamite, erythrite,
        annabergite, mimetite).
        """
        if self.fluid.Cu < 10 or self.fluid.As < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        if self.fluid.pH < 3.0 or self.fluid.pH > 7.0:
            return 0
        if self.temperature < 100 or self.temperature > 400:
            return 0
        product = (self.fluid.Cu / 40.0) * (self.fluid.As / 15.0) * (self.fluid.S / 40.0)
        if 150 <= self.temperature <= 300:
            T_factor = 1.3
        elif 100 <= self.temperature < 150 or 300 < self.temperature <= 350:
            T_factor = 1.0
        else:
            T_factor = 0.6
        return product * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_galena(self) -> float:
        """Galena (PbS) supersaturation. Needs Pb + S + reducing conditions.

        The most common lead mineral. Perfect cubic cleavage, metallic luster.
        Forms in hydrothermal veins at moderate temperatures (100-400°C).
        Extremely dense (SG 7.6) — "the heavy one" in every collection.
        """
        if self.fluid.Pb < 5 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0  # sulfides can't survive oxidation
        sigma = (self.fluid.Pb / 50.0) * (self.fluid.S / 80.0) * (1.5 - self.fluid.O2)
        # v17: use effective_temperature for Mo-flux widening.
        eT = self.effective_temperature
        # Moderate temperature preference, decay above 450°C
        if eT > 450:
            sigma *= math.exp(-0.008 * (eT - 450))
        # Sweet-spot bonus 200-400 (mirrors JS)
        if 200 <= eT <= 400:
            sigma *= 1.3
        return max(sigma, 0)

    def supersaturation_stibnite(self) -> float:
        """Stibnite (Sb₂S₃) supersaturation. Sb + S + moderate T + reducing.

        Hydrothermal antimony sulfide. Low-melting (550°C) so requires
        moderate temperatures — above 400°C it approaches melting;
        below 100°C the chemistry doesn't work.
        """
        if self.fluid.Sb < 10 or self.fluid.S < 15 or self.fluid.O2 > 1.0:
            return 0
        sb_f = min(self.fluid.Sb / 20.0, 2.0)
        s_f  = min(self.fluid.S / 40.0, 1.5)
        sigma = sb_f * s_f
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.0
        elif 100 <= T < 150:
            T_factor = 0.5 + 0.01 * (T - 100)
        elif 300 < T <= 400:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        sigma *= max(0.5, 1.3 - self.fluid.O2)
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_bismuthinite(self) -> float:
        """Bismuthinite (Bi₂S₃) supersaturation. Bi + S + high T + reducing.

        Same orthorhombic structure as stibnite. High-T hydrothermal —
        forms at 200–500°C with cassiterite, wolframite, arsenopyrite
        (greisen suite).
        """
        if self.fluid.Bi < 5 or self.fluid.S < 15 or self.fluid.O2 > 1.0:
            return 0
        bi_f = min(self.fluid.Bi / 20.0, 2.0)
        s_f  = min(self.fluid.S / 50.0, 1.5)
        sigma = bi_f * s_f
        T = self.temperature
        if 200 <= T <= 400:
            T_factor = 1.0
        elif 150 <= T < 200:
            T_factor = 0.5 + 0.01 * (T - 150)
        elif 400 < T <= 500:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 400))
        else:
            T_factor = 0.2
        sigma *= T_factor
        sigma *= max(0.5, 1.3 - self.fluid.O2)
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_bornite(self) -> float:
        """Bornite (Cu₅FeS₄) supersaturation. Cu + Fe + S + reducing.

        Wide T stability (20–500°C). Competes with chalcopyrite for
        Cu+Fe+S — bornite wins when Cu:Fe ratio > 3:1. The 228°C order-
        disorder transition (pseudo-cubic above, orthorhombic below)
        is recorded in `grow_bornite` via dominant_forms.
        """
        # Hard cap at very high O2 (bornite dissolves oxidatively above
        # this). Supergene enrichment of Cu²⁺ descending onto reduced
        # primary sulfides is conceptually a "local reducing" event at
        # an oxidizing level; the sim's 1D O2 can't represent the
        # gradient, so we allow up to 1.8 and rely on the Cu:Fe ratio
        # gate for specificity.
        if (self.fluid.Cu < 25 or self.fluid.Fe < 8 or self.fluid.S < 20 or
                self.fluid.O2 > 1.8):
            return 0
        # Needs Cu-rich relative to Fe (Cu/Fe > 2 for bornite structure)
        cu_fe_ratio = self.fluid.Cu / max(self.fluid.Fe, 1)
        if cu_fe_ratio < 2.0:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.0)
        fe_f = min(self.fluid.Fe / 30.0, 1.3)
        s_f  = min(self.fluid.S / 60.0, 1.5)
        sigma = cu_f * fe_f * s_f
        # Wide T stability — slight decline outside optimum
        T = self.temperature
        if 80 <= T <= 300:
            T_factor = 1.0
        elif T < 80:
            T_factor = 0.6 + 0.005 * T        # supergene still OK
        elif T <= 500:
            T_factor = max(0.5, 1.0 - 0.003 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        # Reducing preference, but retains 0.3 floor for supergene
        # enrichment which is nominally oxidizing
        sigma *= max(0.3, 1.5 - self.fluid.O2)
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_chalcocite(self) -> float:
        """Chalcocite (Cu₂S) supersaturation. Cu-rich + S + low T + reducing.

        Supergene enrichment mineral — forms where Cu²⁺-rich descending
        fluids meet reducing conditions and replace chalcopyrite/bornite
        atom-by-atom. 79.8% Cu by weight. Low-T window (< 150°C).
        """
        # O2 ≤ 2.0 — chalcocite forms at the supergene enrichment
        # boundary, which is nominally oxidizing in our 1D O2 model.
        # The mineral is actually stable only under locally reducing
        # conditions (at the interface with primary sulfides below);
        # the 1.9 cap + check_nucleation's preference for chalcopyrite/
        # bornite substrate approximates this.
        if self.fluid.Cu < 30 or self.fluid.S < 15 or self.fluid.O2 > 1.9:
            return 0
        cu_f = min(self.fluid.Cu / 60.0, 2.0)    # Cu-gate, tuned to
                                                 # chalcocite's supergene
                                                 # Cu-enrichment habit
        s_f  = min(self.fluid.S / 50.0, 1.5)
        sigma = cu_f * s_f
        # Strict low-T window
        T = self.temperature
        if T > 150:
            sigma *= math.exp(-0.03 * (T - 150))
        # Reducing preference, floored at 0.3 so supergene-zone
        # chemistry can still fire
        sigma *= max(0.3, 1.4 - self.fluid.O2)
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_covellite(self) -> float:
        """Covellite (CuS) supersaturation. Cu + S-rich + low T.

        Forms at the boundary between reduction and oxidation zones —
        higher S:Cu ratio than chalcocite (1:1 vs 1:2). Decomposes to
        chalcocite + S above 507°C.
        """
        # Transition-zone mineral between reduction and oxidation —
        # gate O2 ≤ 2.0 so it can nucleate on chalcocite/chalcopyrite
        # substrate in supergene zones.
        if self.fluid.Cu < 20 or self.fluid.S < 25 or self.fluid.O2 > 2.0:
            return 0
        cu_f = min(self.fluid.Cu / 50.0, 2.0)
        s_f  = min(self.fluid.S / 60.0, 1.8)    # S is the gate
                                                # (covellite has 2× S of chalcocite)
        sigma = cu_f * s_f
        T = self.temperature
        if T > 100:
            sigma *= math.exp(-0.03 * (T - 100))
        # Transition-zone mineral — likes moderate O2 (the Eh boundary
        # between chalcocite's reduced regime and full oxidation)
        sigma *= max(0.3, 1.3 - abs(self.fluid.O2 - 0.8))
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_molybdenite(self) -> float:
        """Molybdenite (MoS₂) supersaturation. Needs Mo + S + reducing.

        Lead-gray, hexagonal, greasy feel — the softest metallic mineral (H=1).
        Looks like graphite but has a different streak (greenish vs black).
        Primary molybdenum ore. Arrives in a SEPARATE pulse from Cu
        in porphyry systems (Seo et al. 2012, Bingham Canyon).
        Wulfenite requires destroying BOTH molybdenite AND galena.
        """
        if self.fluid.Mo < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.2:
            return 0  # sulfide, needs reducing
        sigma = (self.fluid.Mo / 15.0) * (self.fluid.S / 60.0) * (1.5 - self.fluid.O2)
        # v17: use effective_temperature for Mo-flux widening.
        # (Note: somewhat self-referential since molybdenite supplies Mo,
        #  but the porphyry-system co-occurrence is the geological logic.)
        eT = self.effective_temperature
        # Moderate to high temperature
        if eT < 150:
            sigma *= math.exp(-0.01 * (150 - eT))
        elif 300 < eT < 500:
            sigma *= 1.3  # sweet spot for porphyry Mo
        return max(sigma, 0)

    def supersaturation_arsenopyrite(self) -> float:
        """Arsenopyrite (FeAsS) — the arsenic gateway mineral.

        The most common arsenic-bearing mineral; a mesothermal primary
        sulfide that co-precipitates with pyrite in orogenic gold
        systems and arrives alongside chalcopyrite/molybdenite in the
        later-stage porphyry evolution. Striated prismatic crystals
        with diamond cross-section (pseudo-orthorhombic monoclinic),
        metallic silver-white; tarnishes yellowish. Garlic odor when
        struck — arsenic vapor, diagnostic.

        Gold association: arsenopyrite is the #1 gold-trapping mineral.
        Its crystal lattice accommodates Au atoms structurally as
        "invisible gold" up to ~1500 ppm (Reich et al. 2005; Cook &
        Chryssoulis 1990). In the sim, grow_arsenopyrite consumes some
        fluid.Au and records it as trace_Au on the growth zone; when
        the crystal later oxidizes (supergene regime), the trapped Au
        is released back to fluid — the mechanism of supergene Au
        enrichment in orogenic oxidation zones (Graeme et al. 2019).

        Oxidation pathway: arsenopyrite + O₂ + H₂O →
          Fe³⁺ + AsO₄³⁻ + H₂SO₄. The released Fe + As feed scorodite
        nucleation; the H₂SO₄ drop in pH further keeps scorodite in
        its stability window (pH < 5).
        """
        if self.fluid.Fe < 5 or self.fluid.As < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 0.8:
            return 0  # sulfide — needs reducing
        sigma = ((self.fluid.Fe / 30.0) * (self.fluid.As / 15.0) *
                 (self.fluid.S / 50.0) * (1.5 - self.fluid.O2))
        # Mesothermal sweet spot 300-500°C
        T = self.temperature
        if 300 <= T <= 500:
            sigma *= 1.4
        elif T < 200:
            sigma *= math.exp(-0.01 * (200 - T))
        elif T > 600:
            sigma *= math.exp(-0.015 * (T - 600))
        # pH window 3-6.5 (slightly broader than scorodite's 2-5)
        if self.fluid.pH < 3:
            sigma *= 0.5
        elif self.fluid.pH > 6.5:
            sigma *= max(0.2, 1.0 - 0.3 * (self.fluid.pH - 6.5))
        return max(sigma, 0)

    def supersaturation_acanthite(self) -> float:
        """Acanthite (Ag₂S, monoclinic) — the low-T silver sulfide.

        First Ag mineral in the sim. Activates the dormant Ag pool at
        Tri-State (5 ppm), Sweetwater Viburnum (3 ppm), Tsumeb (trace),
        and Bisbee (released by tetrahedrite oxidation). Acanthite is
        the cold-storage form of Ag₂S — above 173°C the same composition
        crystallizes as cubic argentite (handled by its own engine);
        below 173°C, only the monoclinic structure is stable.

        Hard-gated above 173°C: that regime belongs to argentite. Below
        that, σ rises with √(Ag·S) inside an 80–150°C optimum window
        (epithermal sweet spot). Reducing only — sulfide chemistry. Mild
        Fe + Cu inhibition reflects diversion of Ag into tetrahedrite /
        polybasite at higher base-metal loadings (Petruk et al. 1974).

        Source: Hayba & Bethke 1985 (Reviews in Economic Geology 2);
        boss research file research/research-acanthite.md.
        """
        if self.fluid.Ag < 0.5 or self.fluid.S < 5:
            return 0
        # Hard upper-T gate — argentite handles >173°C.
        if self.temperature > 173:
            return 0
        # Reducing requirement — oxidizing fluid puts Ag back in solution.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factors — Ag is a trace metal; even fractions of a ppm
        # are heavily supersaturated against equilibrium.
        ag_f = min(self.fluid.Ag / 2.5, 2.5)
        s_f = min(self.fluid.S / 25.0, 2.5)
        sigma = ag_f * s_f
        # T window — peak 80-150°C epithermal optimum, falls off either side.
        T = self.temperature
        if 80 <= T <= 150:
            T_factor = 1.2
        elif T < 80:
            T_factor = max(0.4, 1.0 - 0.012 * (80 - T))  # 50°C → ~0.64
        else:  # 150 < T ≤ 173
            T_factor = max(0.5, 1.0 - 0.020 * (T - 150))
        sigma *= T_factor
        # pH preference — neutral to mildly acidic (5-7 sweet spot).
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.5
        # Inhibitor — high Fe + high Cu divert Ag into tetrahedrite /
        # polybasite. Soft mid-range gate, not a hard zero.
        if self.fluid.Fe > 30 and self.fluid.Cu > 20:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_argentite(self) -> float:
        """Argentite (Ag₂S, cubic) — the high-T silver sulfide.

        Same composition as acanthite, different polymorph: above 173°C
        the body-centered cubic structure is stable; below 173°C the
        lattice inverts to monoclinic acanthite. The conversion
        preserves the external crystal form (paramorph) — handled
        elsewhere in apply_paramorph_transitions. This σ method gates
        only the high-T nucleation regime.

        Hard lower-T gate at 173°C (acanthite handles below). Optimum
        200-400°C — the epithermal/mesothermal hot zone of an Ag-bearing
        hydrothermal system. Reducing only — sulfide chemistry. Note
        that a primary argentite crystal in the sim is essentially
        always destined for paramorphic conversion: there is no scenario
        that ends above 173°C, so any argentite that nucleates here
        will display as acanthite by the end of the run, retaining its
        cubic habit. That's authentic — every "argentite" in every
        museum drawer is the same trick.

        Source: research/research-argentite.md (boss commit f2939da);
        Petruk et al. 1974.
        """
        if self.fluid.Ag < 0.5 or self.fluid.S < 5:
            return 0
        # Hard lower-T gate — acanthite handles ≤173°C.
        if self.temperature <= 173:
            return 0
        # Reducing requirement.
        if self.fluid.O2 > 0.5:
            return 0
        ag_f = min(self.fluid.Ag / 2.5, 2.5)
        s_f  = min(self.fluid.S  / 25.0, 2.5)
        sigma = ag_f * s_f
        # T window — peak 200-400°C, falls off above and at the cool edge.
        T = self.temperature
        if 200 <= T <= 400:
            T_factor = 1.3
        elif T <= 200:  # 173 < T < 200, narrow ramp-up
            T_factor = max(0.5, (T - 173) / 27.0 + 0.5)
        elif T <= 600:
            T_factor = max(0.4, 1.0 - 0.005 * (T - 400))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference — neutral to mildly acidic (5-7 sweet spot).
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.5
        # Inhibitor — high Cu pushes Ag into sulfosalts (polybasite).
        # Tighter than acanthite because high-T fluids run hotter
        # base-metal loadings.
        if self.fluid.Cu > 30:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_nickeline(self) -> float:
        """Nickeline (NiAs) — the high-T Ni-arsenide.

        Pale copper-red metallic, the diagnostic color of the Cobalt-
        Ontario veins. Hexagonal NiAs structure (the namesake), Mohs
        5-5.5. Forms in high-T hydrothermal veins where both Ni and As
        are available together; cooler T pushes the chemistry to
        millerite (NiS) instead. Hard pH/Eh window is reducing-only.

        Source: research/research-nickeline.md (boss commit f2939da);
        Petruk 1971 (Co-Ni-Ag paragenesis).
        """
        if self.fluid.Ni < 40 or self.fluid.As < 40:
            return 0
        if self.fluid.O2 > 0.6:
            return 0
        ni_f = min(self.fluid.Ni / 60.0, 2.5)
        as_f = min(self.fluid.As / 80.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = ni_f * as_f * red_f
        T = self.temperature
        if 300 <= T <= 450:
            T_factor = 1.3
        elif T < 200:
            T_factor = 0.3
        elif T < 300:
            T_factor = 0.3 + 0.010 * (T - 200)
        elif T <= 500:
            T_factor = max(0.5, 1.3 - 0.012 * (T - 450))
        else:
            T_factor = 0.4
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_millerite(self) -> float:
        """Millerite (NiS) — the capillary nickel sulfide.

        Brass-yellow to bronze-yellow capillary needles, the diagnostic
        habit forming radiating sprays in geode cavities. Trigonal NiS,
        Mohs 3-3.5. Forms in lower-T hydrothermal regimes than nickeline
        (NiAs) — when As is depleted, NiS takes the field. Mutual
        exclusion with nickeline: in As-rich fluid above 200°C, nickeline
        wins (NiAs more stable than NiS at high T + As-saturation).

        Source: research/research-millerite.md (boss commit f2939da);
        Bayliss 1969 (Geochim. Cosmochim. Acta 33, on NiS-NiAs
        equilibria).
        """
        if self.fluid.Ni < 50 or self.fluid.S < 30:
            return 0
        if self.fluid.O2 > 0.6:
            return 0
        # Mutual-exclusion gate — nickeline takes priority when As is
        # plentiful AND T is high (the NiAs stability field).
        if self.fluid.As > 30.0 and self.temperature > 200:
            return 0
        ni_f = min(self.fluid.Ni / 80.0, 2.5)
        s_f  = min(self.fluid.S  / 60.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = ni_f * s_f * red_f
        T = self.temperature
        if 200 <= T <= 350:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 200:
            T_factor = 0.3 + 0.009 * (T - 100)
        elif T <= 400:
            T_factor = max(0.4, 1.2 - 0.013 * (T - 350))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_cobaltite(self) -> float:
        """Cobaltite (CoAsS) — the three-element-gate sulfarsenide.

        Reddish-silver-white pseudocubic crystals (orthorhombic but
        very nearly cubic — pyritohedral habit), Mohs 5.5, the cobalt
        analog of arsenopyrite. The three-element gate is the chemistry
        novelty: Co + As + S must ALL be present simultaneously. Forms
        in high-T hydrothermal veins (Cobalt Ontario, Tunaberg Sweden,
        Skutterud Norway) and contact-metamorphic skarns. The classic
        primary phase that weathers to erythrite (Co arsenate).

        Source: research/research-cobaltite.md (boss commit f2939da);
        Bayliss 1968 (Mineral. Mag. 36, on cobaltite-arsenopyrite
        substitution).
        """
        if self.fluid.Co < 50 or self.fluid.As < 100 or self.fluid.S < 50:
            return 0
        if self.fluid.O2 > 0.5:
            return 0
        co_f = min(self.fluid.Co / 80.0, 2.5)
        as_f = min(self.fluid.As / 120.0, 2.5)
        s_f  = min(self.fluid.S  / 80.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = co_f * as_f * s_f * red_f
        T = self.temperature
        if 400 <= T <= 500:
            T_factor = 1.3
        elif T < 300:
            T_factor = 0.3
        elif T < 400:
            T_factor = 0.3 + 0.010 * (T - 300)
        elif T <= 600:
            T_factor = max(0.4, 1.3 - 0.012 * (T - 500))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

