"""VugConditions — physical/chemical state of the vug + supersaturation dispatch.

Extracted verbatim from vugg/__init__.py during PROPOSAL-MODULAR-REFACTOR
Phase A5. Houses:
  * the @dataclass with all fields (temperature, pressure, fluid, wall,
    porosity, fluid_surface_ring, ring_count, ring_fluids, …)
  * 97 supersaturation_<mineral>(self) methods
  * helper methods: effective_temperature, ring_water_state, etc.

This file is intentionally large (~3900 lines). The next refactor pass
(out of scope for A5) splits the supersat methods into per-class mixins
under vugg/chemistry/supersat/<class>.py — see PROPOSAL-MODULAR-REFACTOR
"open question 1" (mixin vs registry) before doing that work.

Dependencies pulled in from sibling modules:
  * FluidChemistry — vugg/chemistry/fluid.py
  * VugWall — vugg/geometry/wall.py (default factory for the .wall field)

DEHYDRATION_TRANSITIONS / PARAMORPH_TRANSITIONS / THERMAL_DECOMPOSITION
are referenced only inside docstring comments — no runtime import needed.
"""

import math
from dataclasses import dataclass, field, fields, replace
from typing import List, Optional

from .fluid import FluidChemistry
from ..geometry.wall import VugWall


@dataclass
class VugConditions:
    """Current physical/chemical conditions in the vug."""
    temperature: float = 350.0    # °C
    pressure: float = 1.5         # kbar
    fluid: FluidChemistry = field(default_factory=FluidChemistry)
    flow_rate: float = 1.0        # relative (0 = stagnant, 1 = normal, 5 = flood)
    wall: VugWall = field(default_factory=VugWall)  # reactive wall

    # v24 water-level mechanic. Float in [0.0, ring_count] giving the
    # meniscus position along the polar axis: rings strictly below it
    # are submerged, the band containing it is the meniscus, rings
    # strictly above it are vadose (air). None = legacy "no water level
    # set" → treated as fully submerged so existing scenarios stay
    # byte-identical. A scenario that wants partial fill drops this to
    # e.g. 8.5; events can mutate it over time (drainage, refill).
    fluid_surface_ring: Optional[float] = None

    # v26 host-rock porosity. Sink term for the water-level mechanic:
    # each step the surface drifts down by `porosity *
    # WATER_LEVEL_DRAIN_RATE` rings, modeling slow drainage through a
    # porous host (sandstone, weathered limestone, vesicular basalt).
    # 0.0 = sealed cavity (no drainage; legacy default — surface stays
    # wherever scenarios / events put it). 1.0 = highly permeable host;
    # the cavity drains in roughly ring_count / DRAIN_RATE steps under
    # zero inflow. Filling stays event-driven (tectonic uplift,
    # aquifer recharge); porosity is asymmetric — it can only drain.
    porosity: float = 0.0

    # Fluid-level cycle tracking for the Kim 2023 dolomite mechanism.
    # Per-crystal tracking via phantom_count would work in principle but
    # dolomite seeds get enclosed by other carbonates faster than they
    # accumulate cycles. Tracking at the fluid level captures the
    # geological insight ("this environment has been cycling") and
    # propagates ordering credit to ALL active dolomites.
    _dol_cycle_count: int = 0
    _dol_prev_sigma: float = 0.0
    _dol_in_undersat: bool = False

    def update_dol_cycles(self) -> None:
        """Track dolomite saturation crossings — call once per step.

        Counts full undersaturation→supersaturation cycles. Each completed
        cycle ratchets up the f_ord ordering fraction used in grow_dolomite.
        """
        sigma = self.supersaturation_dolomite()
        prev = self._dol_prev_sigma
        if prev > 0.0:  # skip the first call where prev is unset
            if prev >= 1.0 and sigma < 1.0:
                self._dol_in_undersat = True
            elif prev < 1.0 and sigma >= 1.0 and self._dol_in_undersat:
                self._dol_cycle_count += 1
                self._dol_in_undersat = False
        self._dol_prev_sigma = sigma

    @staticmethod
    def _classify_water_state(surface, ring_idx: int, ring_count: int) -> str:
        """Pure classifier used by ring_water_state and by transition-
        detection logic that needs to compare against an arbitrary
        previous surface value (not just the current one). Behaviour
        matches ring_water_state — kept in one place so they can't
        drift apart."""
        if surface is None:
            return 'submerged'
        if ring_count <= 1:
            return 'submerged' if surface >= 1.0 else 'vadose'
        if ring_idx + 1 <= surface:
            return 'submerged'
        if ring_idx >= surface:
            return 'vadose'
        return 'meniscus'

    def ring_water_state(self, ring_idx: int, ring_count: int) -> str:
        """v24: classify a ring as 'submerged' / 'meniscus' / 'vadose'
        from the cavity's current `fluid_surface_ring`.

        `fluid_surface_ring is None` → fully submerged (legacy / default).
        Else: ring k is `submerged` iff k+1 ≤ surface, `vadose` iff
        k ≥ surface, and `meniscus` iff the surface lies in [k, k+1).
        Ring count guards single-ring sims (always 'submerged' under
        a None surface, never gains a meniscus).

        Used by nucleation to stamp `Crystal.growth_environment` and by
        the renderer to draw the blue water line.
        """
        return self._classify_water_state(self.fluid_surface_ring, ring_idx, ring_count)

    @property
    def effective_temperature(self) -> float:
        """Mo-flux thermal modifier. Ports JS's get effectiveTemperature() —
        v17 reconciliation (May 2026, per supersat drift audit).

        Mo flux effect: when Mo > 20 ppm, high-T minerals nucleate as if
        T were up to 15% higher. MoO₃ is a classic flux for growing
        corundum at lower temperatures; here it broadens what can grow
        in porphyry sulfide systems (chalcopyrite, galena, pyrite,
        molybdenite, quartz). Pre-v17 only the JS runtime had this
        effect — Python's same-fluid sigmas were lower in Mo-rich
        scenarios.
        """
        if self.fluid.Mo > 20:
            boost = 1.0 + 0.15 * min((self.fluid.Mo - 20) / 40, 1.0)
            return self.temperature * boost
        return self.temperature

    # SiO₂ solubility table (ppm) — Fournier & Potter 1982 / Rimstidt 1997.
    # Quartz solubility is PROGRADE: increases with T. Quartz precipitates
    # when silica-rich hot fluid cools.
    _SIO2_SOLUBILITY = [
        (25, 6), (50, 15), (75, 30), (100, 60), (125, 90), (150, 130),
        (175, 200), (200, 300), (225, 390), (250, 500), (275, 600),
        (300, 700), (325, 850), (350, 1000), (375, 1100), (400, 1200),
        (450, 1400), (500, 1500), (600, 1600),
    ]

    def silica_equilibrium(self, T: float) -> float:
        """SiO₂ solubility at given T, linearly interpolated from the
        Fournier & Potter 1982 table. v17 ports JS's silica_equilibrium —
        pre-v17 Python quartz used inline `50 * exp(0.008*T)` which
        overshoots the experimental data by ~3x at high T.
        """
        table = self._SIO2_SOLUBILITY
        if T <= table[0][0]:
            return table[0][1]
        if T >= table[-1][0]:
            return table[-1][1]
        for i in range(len(table) - 1):
            t0, s0 = table[i]
            t1, s1 = table[i + 1]
            if t0 <= T <= t1:
                return s0 + (s1 - s0) * (T - t0) / (t1 - t0)
        return table[-1][1]

    def supersaturation_quartz(self) -> float:
        """Calculate quartz supersaturation (simplified).
        
        Based on the solubility curve: SiO2 solubility increases with T.
        At equilibrium, higher T = more SiO2 dissolved.
        Supersaturation occurs when fluid cools below the T where its
        SiO2 concentration would be in equilibrium.

        v17 (May 2026): now uses Fournier & Potter 1982 / Rimstidt 1997
        tabulated solubility via silica_equilibrium(eT), where eT is
        Mo-flux-modified effective_temperature. Pre-v17 Python used
        `50 * exp(0.008*T)` which overshoots the experimental data
        ~3x at high T; JS already used the table-based approach.

        HF ATTACK: Low pH + high fluorine dissolves quartz as SiF4.
        This is real — HF is the only common acid that attacks silicates.
        """
        equilibrium_SiO2 = self.silica_equilibrium(self.effective_temperature)
        if equilibrium_SiO2 <= 0:
            return 0
        sigma = self.fluid.SiO2 / equilibrium_SiO2

        # HF attack on quartz: low pH + high F = dissolution
        if self.fluid.pH < 4.0 and self.fluid.F > 20:
            hf_attack = (4.0 - self.fluid.pH) * (self.fluid.F / 50.0) * 0.3
            sigma -= hf_attack

        return max(sigma, 0)
    
    def supersaturation_calcite(self) -> float:
        """Calcite supersaturation (simplified).

        Calcite has RETROGRADE solubility — less soluble at higher T.
        So heating causes precipitation (opposite of quartz).
        Simplified: solubility ≈ 300 * exp(-0.005 * T)

        pH EFFECT: Acid dissolves carbonates. Below pH ~5, calcite
        dissolves readily. This is how caves form — slightly acidic
        groundwater eats limestone.

        Mg POISONING: Mg²⁺ adsorbs onto calcite's {10ī4} growth steps
        and the dehydration penalty stalls step advancement (Davis et al.
        2000; Nielsen et al. 2013). When Mg/Ca > ~2, calcite nucleation
        gives way to aragonite, which excludes Mg structurally. The
        poisoning factor caps at 85% (some high-Mg calcite always forms
        in marine settings — Folk's HMC).
        """
        equilibrium_Ca = 300.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Ca <= 0:
            return 0
        ca_co3_product = min(self.fluid.Ca, self.fluid.CO3)
        sigma = ca_co3_product / equilibrium_Ca

        # Acid dissolution of carbonates
        if self.fluid.pH < 5.5:
            acid_attack = (5.5 - self.fluid.pH) * 0.5
            sigma -= acid_attack
        # Alkaline conditions favor carbonate precipitation
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.15

        # Mg poisoning of calcite growth steps — sigmoid centered on Mg/Ca=2
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        mg_inhibition = 1.0 / (1.0 + math.exp(-(mg_ratio - 2.0) / 0.5))
        sigma *= (1.0 - 0.85 * mg_inhibition)

        return max(sigma, 0)

    def supersaturation_dolomite(self) -> float:
        """Dolomite (CaMg(CO₃)₂) — the ordered Ca-Mg double carbonate.

        Trigonal carbonate (R3̄) with alternating Ca and Mg layers — distinct
        from calcite (R3̄c, all Ca). Forms at T > 50°C from fluids carrying
        substantial Mg alongside Ca; surface-T dolomite is rare ('dolomite
        problem' in geology — modern oceans should produce it but don't,
        for kinetic reasons that a vug simulator doesn't try to capture).

        Mg/Ca ratio gate: needs roughly 0.5 < Mg/Ca < 5 (Mg present in
        significant quantity but not so dominant it leaves no Ca). Outside
        that window, calcite (low Mg) or magnesite (no Ca) wins.
        """
        if self.fluid.Mg < 25 or self.fluid.Ca < 30 or self.fluid.CO3 < 20:
            return 0
        # Hard T floor lowered to 10°C (was 50°C) — Kim 2023 shows that
        # ambient-T ordered dolomite is achievable WITH cycling. The
        # f_ord gate in grow_dolomite enforces the kinetics: cool fluids
        # can nucleate but only grow well if they're cycling.
        if self.temperature < 10 or self.temperature > 400:
            return 0
        if self.fluid.pH < 6.5 or self.fluid.pH > 10.0:
            return 0

        # Mg/Ca window — dolomite needs both. Upper gate relaxed to 30
        # because modern sabkha porewaters can reach Mg/Ca 10–25 after
        # aragonite/gypsum precipitation strips Ca preferentially (Hardie
        # 1987; Patterson & Kinsman 1981). The ratio_factor below still
        # heavily penalizes off-1:1 ratios; the gate just permits the
        # high-Mg regime where dolomite still forms in nature.
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        if mg_ratio < 0.3 or mg_ratio > 30.0:
            return 0

        # Equilibrium product — both cations matter
        equilibrium = 200.0 * math.exp(-0.005 * self.temperature)
        if equilibrium <= 0:
            return 0
        # Geometric mean of Ca and Mg, capped by CO3 availability
        ca_mg = math.sqrt(self.fluid.Ca * self.fluid.Mg)
        co3_limit = self.fluid.CO3 * 2.0  # dolomite uses 2 CO3 per Ca+Mg
        product = min(ca_mg, co3_limit)
        sigma = product / equilibrium

        # Mg/Ca = 1 is the sweet spot — gentle sigmoid bonus near unity ratio.
        ratio_distance = abs(math.log10(mg_ratio))  # 0 at Mg/Ca=1
        ratio_factor = math.exp(-ratio_distance * 1.0)
        sigma *= ratio_factor

        # T-window now does NOT penalize low T (Kim 2023 — ambient T is
        # thermodynamically fine, the kinetic problem is solved by cycling
        # which f_ord captures separately). High-T penalty preserved.
        if self.temperature > 250:
            sigma *= max(0.3, 1.0 - (self.temperature - 250) / 200.0)

        # Acid dissolution
        if self.fluid.pH < 6.5:
            sigma -= (6.5 - self.fluid.pH) * 0.3

        return max(sigma, 0)

    def supersaturation_siderite(self) -> float:
        """Siderite (FeCO₃) — the iron carbonate, the brown rhomb.

        Trigonal carbonate, calcite-group structure (R3̄c) with Fe²⁺ in the
        Ca site. Forms only in REDUCING conditions — Fe must stay Fe²⁺ to
        be soluble and precipitate as carbonate. Above O₂ ~0.5, Fe oxidizes
        to Fe³⁺ and locks up as goethite/hematite instead.

        Habit signature: curved rhombohedral 'saddle' faces (the {104} faces
        bow, like rhodochrosite's button rhombs). Tan to dark brown with Fe
        content. Sedimentary spherosiderite forms spherulitic concretions in
        coal seams; hydrothermal siderite forms vein crystals.

        Oxidation breakdown is the textbook diagenetic story: siderite →
        goethite → hematite as the system progressively oxidizes. In the
        simulator, rising O₂ dissolves the siderite and releases Fe + CO₃
        for downstream Fe-oxide precipitation.
        """
        if self.fluid.Fe < 10 or self.fluid.CO3 < 20:
            return 0
        if self.temperature < 20 or self.temperature > 300:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 9.0:
            return 0
        # Hard reducing gate — Fe²⁺ must stay reduced
        if self.fluid.O2 > 0.8:
            return 0

        equilibrium_Fe = 80.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Fe <= 0:
            return 0
        fe_co3 = min(self.fluid.Fe, self.fluid.CO3)
        sigma = fe_co3 / equilibrium_Fe

        # Acid dissolution
        if self.fluid.pH < 5.5:
            sigma -= (5.5 - self.fluid.pH) * 0.5
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.1

        # Mild oxidation rolloff in 0.3-0.8 O2 window
        if self.fluid.O2 > 0.3:
            sigma *= max(0.2, 1.0 - (self.fluid.O2 - 0.3) * 1.5)

        return max(sigma, 0)

    def supersaturation_rhodochrosite(self) -> float:
        """Rhodochrosite (MnCO₃) — the manganese carbonate, the pink mineral.

        Trigonal carbonate, structurally identical to calcite (R3̄c) but with
        Mn²⁺ replacing Ca²⁺. Forms a continuous solid solution toward calcite
        through the kutnohorite (CaMn carbonate) intermediate, so high-Mn
        carbonates have characteristic banding.

        T range 20-250°C — epithermal vein settings (Capillitas, Sweet Home),
        sedimentary Mn deposits (N'Chwaning), and low-T carbonate replacement.
        Mn²⁺ is stable in moderate-to-reducing conditions; aggressive oxidation
        flips it to Mn³⁺/Mn⁴⁺ → black manganese oxide staining (pyrolusite,
        psilomelane).
        """
        if self.fluid.Mn < 5 or self.fluid.CO3 < 20:
            return 0
        if self.temperature < 20 or self.temperature > 250:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 9.0:
            return 0
        # Mn²⁺ stability — too oxidizing converts it to insoluble Mn oxides
        if self.fluid.O2 > 1.5:
            return 0
        # Same retrograde-style equilibrium as calcite
        equilibrium_Mn = 50.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Mn <= 0:
            return 0
        mn_co3 = min(self.fluid.Mn, self.fluid.CO3)
        sigma = mn_co3 / equilibrium_Mn

        # Acid dissolution
        if self.fluid.pH < 5.5:
            sigma -= (5.5 - self.fluid.pH) * 0.5
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.1

        # Mild oxidation penalty — Mn carbonate degrades faster than Ca carbonate
        if self.fluid.O2 > 0.8:
            sigma *= max(0.3, 1.5 - self.fluid.O2)

        return max(sigma, 0)

    def supersaturation_aragonite(self) -> float:
        """Aragonite (CaCO₃, orthorhombic) — the metastable polymorph.

        Same Ca + CO₃ ingredients as calcite, but a different crystal structure
        favored kinetically by four converging factors (Folk 1974; Morse et al.
        1997; Sun et al. 2015):

        1. Mg/Ca ratio (dominant ~70% of signal): Mg poisons calcite growth
           steps but is excluded from aragonite's orthorhombic structure.
           Threshold ~Mg/Ca > 2 molar.
        2. Temperature: aragonite kinetics favored above ~50°C in low-Mg
           waters; in Mg-rich fluid the threshold drops to ~25°C.
        3. Saturation state Ω (Ostwald step rule): high supersaturation
           favors metastable aragonite over thermodynamic calcite.
        4. Trace Sr/Pb/Ba: secondary — these cations match Ca²⁺ in 9-fold
           aragonite coordination but not 6-fold calcite.

        Pressure is the THERMODYNAMIC sorter (aragonite stable above
        ~0.4 GPa) but is irrelevant in vugs and hot springs at <0.5 kbar —
        every natural surface aragonite is metastable. Don't use P as a gate
        unless the scenario is genuinely deep-burial / blueschist.
        """
        if self.fluid.Ca < 30 or self.fluid.CO3 < 20:
            return 0
        if self.fluid.pH < 6.0 or self.fluid.pH > 9.0:
            return 0

        equilibrium_Ca = 300.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Ca <= 0:
            return 0
        ca_co3 = min(self.fluid.Ca, self.fluid.CO3)
        omega = ca_co3 / equilibrium_Ca

        # Factor 1 (~70%) — Mg/Ca, sigmoid centered Mg/Ca = 1.5
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        mg_factor = 1.0 / (1.0 + math.exp(-(mg_ratio - 1.5) / 0.3))

        # Factor 2 (~20%) — T, sigmoid centered 50°C
        T_factor = 1.0 / (1.0 + math.exp(-(self.temperature - 50.0) / 15.0))

        # Factor 3 (~10%) — Ostwald step rule, Ω > ~10 favors aragonite kinetically
        omega_factor = 1.0 / (1.0 + math.exp(-(math.log10(max(omega, 0.01)) - 1.0) / 0.3))

        # Factor 4 (small bonus) — Sr/Pb/Ba trace cation incorporation
        trace_sum = self.fluid.Sr + self.fluid.Pb + self.fluid.Ba
        trace_ratio = trace_sum / max(self.fluid.Ca, 0.01)
        trace_factor = 1.0 + 0.3 / (1.0 + math.exp(-(trace_ratio - 0.01) / 0.005))

        # Weighted SUM (not product) — Mg/Ca dominates; T and Ω each push
        # aragonite over the line in low-Mg regimes. Trace factor multiplies
        # the result. A pure-product would force ALL factors to align, which
        # is wrong: high Mg/Ca alone is enough in nature, regardless of Ω.
        favorability = (0.70 * mg_factor + 0.20 * T_factor + 0.10 * omega_factor) * trace_factor
        return omega * favorability
    
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
    
    def supersaturation_malachite(self) -> float:
        """Malachite (Cu₂(CO₃)(OH)₂) supersaturation. Needs Cu + CO₃ + oxidizing.

        The classic green copper carbonate — botryoidal, banded, gorgeous.
        Low-temperature mineral. Forms from oxidation of primary copper sulfides.
        Dissolves easily in acid (fizzes — it's a carbonate).

        Denominators reference realistic supergene weathering fluid
        (Cu ~25 ppm, CO₃ ~100 ppm from dissolved meteoric CO₂). The older
        50/200 values were tuned for Cu-saturated porphyry fluids and
        starved supergene vugs of their flagship copper mineral.

        Malachite-vs-azurite competition is encoded by carbonate-activity
        thresholds (Vink 1986, *Mineralogical Magazine* 50:43-47). Vink's
        univariant boundary sits at log(pCO2) ≈ -3.5 at 25°C: above that,
        azurite is stable; below, malachite wins. The sim's CO3 thresholds
        (malachite ≥20, azurite ≥120) are the sim-scale encoding of that
        boundary. Azurite drops back to malachite via a paramorph
        replacement triggered in grow_azurite when CO3 falls during a run
        (the Bisbee monsoon → drying transition, step 225 ev_co2_drop).
        See research/research-broth-ratio-malachite-azurite.md.
        """
        if self.fluid.Cu < 5 or self.fluid.CO3 < 20 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Cu / 25.0) * (self.fluid.CO3 / 100.0) * (self.fluid.O2 / 1.0)
        # Temperature penalty at high T — malachite is a LOW temperature mineral
        if self.temperature > 50:
            sigma *= math.exp(-0.005 * (self.temperature - 50))
        # Acid penalty — malachite dissolves easily (it fizzes!)
        if self.fluid.pH < 4.5:
            sigma -= (4.5 - self.fluid.pH) * 0.5
        return max(sigma, 0)


    def supersaturation_apophyllite(self) -> float:
        """Apophyllite (KCa₄Si₈O₂₀(F,OH)·8H₂O) — zeolite-facies basalt vesicle fill.

        Hydrothermal silicate of the zeolite group, T 50-250°C optimum 100-200°C.
        Requires K + Ca + lots of SiO₂ + F + alkaline fluid + low pressure
        (near-surface vesicle conditions). Stage III Deccan Traps mineral per
        Ottens et al. 2019. Hematite-included variety ('bloody apophyllite')
        from Nashik when Fe activity is significant.
        """
        if (self.fluid.K < 5 or self.fluid.Ca < 30
                or self.fluid.SiO2 < 800 or self.fluid.F < 2):
            return 0
        if self.temperature < 50 or self.temperature > 250:
            return 0
        if self.fluid.pH < 7.0 or self.fluid.pH > 10.0:
            return 0
        # Low-pressure mineral — vesicle filling, doesn't form at depth
        if self.pressure > 0.5:
            return 0
        product = ((self.fluid.K / 30.0) * (self.fluid.Ca / 100.0)
                   * (self.fluid.SiO2 / 1500.0) * (self.fluid.F / 8.0))
        # T peak 100-200°C
        if 100 <= self.temperature <= 200:
            T_factor = 1.4
        elif 80 <= self.temperature < 100 or 200 < self.temperature <= 230:
            T_factor = 1.0
        else:
            T_factor = 0.6
        # pH peak in 7.5-9 range — strong alkaline preference
        if 7.5 <= self.fluid.pH <= 9.0:
            pH_factor = 1.2
        else:
            pH_factor = 0.8
        return product * T_factor * pH_factor

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

    def supersaturation_smithsonite(self) -> float:
        """Smithsonite (ZnCO₃) supersaturation. Needs Zn + CO₃ + oxidizing.

        Secondary zinc carbonate — the oxidation product of sphalerite.
        Named for James Smithson (founder of the Smithsonian).
        Botryoidal blue-green (Cu), pink (Co), yellow (Cd), white (pure).
        Low temperature mineral — forms in the oxidation zone.
        """
        if self.fluid.Zn < 20 or self.fluid.CO3 < 50 or self.fluid.O2 < 0.2:
            return 0
        # v17 reconciliation (May 2026): supergene-only mineral per
        # research-smithsonite.md (T 10-50°C optimum, decomposes ~300°C
        # but never seen above ~80°C in nature). Pre-v17 both runtimes
        # were too lenient — Python's soft decay above 100°C let it
        # form at hydrothermal T; JS's hard cap at 200°C also too
        # generous. Now hard cap at 100°C with steep decay above 80°C.
        if self.temperature > 100:
            return 0
        # Hard pH window — research says 7.0-8.5 (acidic dissolves
        # carbonate). pH<5 hard cutoff matches.
        if self.fluid.pH < 5.0:
            return 0
        sigma = (self.fluid.Zn / 80.0) * (self.fluid.CO3 / 200.0) * (self.fluid.O2 / 1.0)
        # Steep decay above 80°C (approaching the supergene-T ceiling)
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Alkaline boost — carbonates precipitate better in alkaline
        # conditions (research: pH 7.0-8.5 optimum).
        if self.fluid.pH > 7:
            sigma *= 1.2
        return max(sigma, 0)

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

    def supersaturation_feldspar(self) -> float:
        """K-feldspar supersaturation. Needs K + Al + SiO₂.

        The most common minerals in Earth's crust.
        Temperature determines the polymorph:
        - High T (>600°C): sanidine (monoclinic)
        - Moderate T (400-600°C): orthoclase (monoclinic)
        - Low T (<400°C): microcline (triclinic, cross-hatched twinning)
        Pb + microcline = amazonite (green, from Pb²⁺ substituting for K⁺).

        Acidic fluids destabilize feldspar irreversibly: KAlSi₃O₈ + H⁺ →
        kaolinite + K⁺ + SiO₂. The sim doesn't model kaolinite as a
        mineral (it's an implicit sink), so below pH 4 we drive sigma
        hard negative — this keeps released K+Al+SiO₂ from re-feeding
        feldspar growth and matches the real-world one-way conversion.
        """
        if self.fluid.K < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        # v17: hard upper cap — feldspar melts above 800°C (sanidine→melt
        # boundary; ported from JS canonical, May 2026).
        if self.temperature > 800:
            return 0
        sigma = (self.fluid.K / 40.0) * (self.fluid.Al / 10.0) * (self.fluid.SiO2 / 400.0)
        # Feldspars need HIGH temperature — they're igneous/metamorphic
        if self.temperature < 300:
            sigma *= math.exp(-0.01 * (300 - self.temperature))
        # Acid destabilization — the kaolinization regime. Mirrors the
        # dissolution threshold in grow_feldspar (pH < 4).
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 2.0
        return max(sigma, 0)

    def supersaturation_albite(self) -> float:
        """Albite (NaAlSi₃O₈) supersaturation. Needs Na + Al + SiO₂.

        The sodium end-member of the plagioclase series.
        Forms at similar conditions to K-feldspar but prefers Na-rich fluids.
        At T < 450°C, albite orders to low-albite (fully ordered Al/Si).
        Peristerite intergrowth (albite + oligoclase) creates moonstone sheen.
        """
        if self.fluid.Na < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        sigma = (self.fluid.Na / 35.0) * (self.fluid.Al / 10.0) * (self.fluid.SiO2 / 400.0)
        # Same high-T preference as K-feldspar
        if self.temperature < 300:
            sigma *= math.exp(-0.01 * (300 - self.temperature))
        # Acid destabilization — albite kaolinizes at lower pH than
        # microcline (plagioclase is more acid-resistant, the field
        # observation). Mirrors grow_albite's pH < 3 dissolution gate.
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 2.0
        return max(sigma, 0)

    def supersaturation_spodumene(self) -> float:
        """Spodumene (LiAlSi₂O₆) supersaturation. Needs Li + Al + SiO₂.

        Monoclinic pyroxene. Lithium is mildly incompatible — builds up
        late in pegmatite crystallization because no early-stage mineral
        takes it (elbaite tourmaline takes some later, but that's
        approximately simultaneous with spodumene). Spodumene + elbaite
        compete for Li in the residual pocket fluid.

        T window 400–700°C with optimum 450–600°C (higher than beryl —
        spodumene takes a hotter pocket).
        """
        if self.fluid.Li < 8 or self.fluid.Al < 5 or self.fluid.SiO2 < 40:
            return 0
        li_f = min(self.fluid.Li / 20.0, 2.0)
        al_f = min(self.fluid.Al / 10.0, 1.5)
        si_f = min(self.fluid.SiO2 / 300.0, 1.5)
        sigma = li_f * al_f * si_f
        # Temperature window
        T = self.temperature
        if 450 <= T <= 600:
            T_factor = 1.0
        elif 400 <= T < 450:
            T_factor = 0.5 + 0.01 * (T - 400)   # 0.5 → 1.0
        elif 600 < T <= 700:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 600))
        elif T > 700:
            T_factor = 0.2
        else:
            T_factor = max(0.1, 0.5 - 0.008 * (400 - T))
        sigma *= T_factor
        return max(sigma, 0)

    def _beryl_base_sigma(self) -> float:
        """Shared Be + Al + SiO₂ supersaturation core for beryl family.

        Round 7 refactor: extracted from supersaturation_beryl so that the
        4 chromophore-variety engines (emerald, aquamarine, morganite,
        heliodor) + goshenite (beryl) all share the same base computation.
        Each variety adds its own chromophore factor and exclusion
        precedence on top.

        Returns 0 if beryl base chemistry (Be + Al + SiO2 + T window) not met.
        """
        if self.fluid.Be < 10 or self.fluid.Al < 6 or self.fluid.SiO2 < 50:
            return 0
        # Cap each factor — see supersaturation_tourmaline for rationale.
        be_f = min(self.fluid.Be / 15.0, 2.5)
        al_f = min(self.fluid.Al / 12.0, 1.5)
        si_f = min(self.fluid.SiO2 / 350.0, 1.5)
        sigma = be_f * al_f * si_f
        T = self.temperature
        if 350 <= T <= 550:
            T_factor = 1.0
        elif 300 <= T < 350:
            T_factor = 0.6 + 0.008 * (T - 300)
        elif 550 < T <= 650:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 550))
        elif T > 650:
            T_factor = 0.2
        else:
            T_factor = max(0.1, 0.6 - 0.006 * (300 - T))
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_beryl(self) -> float:
        """Beryl/goshenite (Be₃Al₂Si₆O₁₈ — colorless/generic) supersaturation.

        Post-Round-7 architecture: this is the **goshenite/generic** engine —
        fires only when NO chromophore trace is above its variety gate. The
        chromophore varieties (emerald/aquamarine/morganite/heliodor) are
        each first-class species with their own supersaturation + grow
        functions. Priority chain: emerald > morganite > heliodor > aquamarine
        > goshenite(beryl). Beryllium is the most incompatible common element
        in magmatic systems — no rock-forming mineral takes it, so it
        accumulates in residual pegmatite fluid until beryl finally nucleates
        at high threshold. That accumulation delay is why beryl crystals can
        be enormous: by the time it forms there's a lot of Be waiting.
        T window 300–650°C with optimum 350–550°C.
        """
        # Goshenite exclusion precedence: don't fire if a chromophore variety
        # would take this nucleation event. Order matches the priority chain
        # used in each variety engine.
        f = self.fluid
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald takes priority
        if f.Mn >= 2.0:
            return 0  # morganite takes priority
        if f.Fe >= 15 and f.O2 > 0.5:
            return 0  # heliodor takes priority
        if f.Fe >= 8:
            return 0  # aquamarine takes priority
        return self._beryl_base_sigma()

    def supersaturation_emerald(self) -> float:
        """Emerald (Be₃Al₂Si₆O₁₈ + Cr³⁺/V³⁺) supersaturation — the chromium
        variety of beryl. The 'emerald paradox': Cr/V is ultramafic, Be is
        pegmatitic, so emerald needs an ultramafic country-rock contact. Top
        priority in the beryl-family chromophore dispatch.
        """
        if self.fluid.Cr < 0.5 and self.fluid.V < 1.0:
            return 0
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        # Chromophore factor — Cr³⁺ is a potent chromophore even at low ppm.
        # Use whichever is higher (Cr OR V); both produce indistinguishable
        # green in the beryl structure.
        chrom_f = max(
            min(self.fluid.Cr / 1.5, 1.8),
            min(self.fluid.V / 3.0, 1.5),
        )
        return base * chrom_f

    def supersaturation_aquamarine(self) -> float:
        """Aquamarine (Be₃Al₂Si₆O₁₈ + Fe²⁺) supersaturation — the blue Fe²⁺
        variety of beryl. Most abundant gem beryl variety. Fires when Fe ≥ 8
        with no higher-priority chromophore and NOT in the heliodor band
        (Fe ≥ 15 + oxidizing).
        """
        f = self.fluid
        if f.Fe < 8:
            return 0
        # Exclusion precedence
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald
        if f.Mn >= 2.0:
            return 0  # morganite
        if f.Fe >= 15 and f.O2 > 0.5:
            return 0  # heliodor
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        fe_f = min(f.Fe / 12.0, 1.8)
        return base * fe_f

    def supersaturation_morganite(self) -> float:
        """Morganite (Be₃Al₂Si₆O₁₈ + Mn²⁺) supersaturation — the pink Mn
        variety of beryl. Late-stage pegmatite mineral. Fires when Mn ≥ 2
        with no emerald-priority chromophore (Cr/V) above threshold.
        """
        f = self.fluid
        if f.Mn < 2.0:
            return 0
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald takes priority
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        mn_f = min(f.Mn / 4.0, 1.8)
        return base * mn_f

    def supersaturation_heliodor(self) -> float:
        """Heliodor (Be₃Al₂Si₆O₁₈ + Fe³⁺) supersaturation — the yellow
        oxidized-Fe variety of beryl. Narrower window than aquamarine (needs
        BOTH high Fe ≥ 15 AND O2 > 0.5). Priority over aquamarine when the
        redox state flips oxidizing.
        """
        f = self.fluid
        if f.Fe < 15 or f.O2 <= 0.5:
            return 0
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald
        if f.Mn >= 2.0:
            return 0  # morganite
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        fe_f = min(f.Fe / 20.0, 1.6)
        o2_f = min(f.O2 / 1.0, 1.3)
        return base * fe_f * o2_f

    # ------------------------------------------------------------------
    # Corundum family (Al₂O₃) — first UPPER-bound gate in the sim.
    # SiO₂ < 50 is the defining constraint: with silica present at normal
    # crustal concentrations, Al + SiO₂ drives to feldspar/mica/
    # Al₂SiO₅-polymorphs instead of corundum. Shared helper below.
    # ------------------------------------------------------------------
    def _corundum_base_sigma(self) -> float:
        """Shared Al + SiO₂-undersaturation + T/pH window for corundum family.

        Returns 0 if:
          - Al < 15 (lower gate — needs alumina)
          - SiO₂ > 50 (UPPER gate — novel in sim; silica drives competition)
          - pH outside 6-10 (metamorphic fluid alkalinity)
          - T outside 400-1000°C

        Note: this is the first supersaturation function in the sim that
        gates on an UPPER bound of a fluid field. All previous gates are
        lower bounds (X ≥ threshold); corundum requires X ≤ threshold.
        Implementation care: tests/test_engine_gates.py::
        test_blocks_when_all_ingredients_zero sets all fields to 0, which
        satisfies the SiO2 upper gate trivially; the
        test_fires_with_favorable_fluid search provides enough pH/T
        candidates to pass the window gates without needing to override
        SiO2. If future tests specifically sweep high SiO2, corundum
        family should be expected to block.
        """
        if self.fluid.Al < 15:
            return 0
        if self.fluid.SiO2 > 50:
            return 0  # UPPER gate — defining corundum constraint
        if self.fluid.pH < 6 or self.fluid.pH > 10:
            return 0
        T = self.temperature
        if T < 400 or T > 1000:
            return 0
        # Al factor — capped; marble contact fluid can carry Al up to
        # 100+ ppm in skarn envelopes.
        al_f = min(self.fluid.Al / 25.0, 2.0)
        sigma = al_f
        # T window — 600-900°C optimum; falls off at edges
        if 600 <= T <= 900:
            T_factor = 1.0
        elif 400 <= T < 600:
            T_factor = 0.4 + 0.003 * (T - 400)  # 0.4 → 1.0
        elif 900 < T <= 1000:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 900))
        else:
            T_factor = 0.2
        sigma *= T_factor
        # pH window — sweet spot pH 7-9
        if 7 <= self.fluid.pH <= 9:
            pH_factor = 1.0
        else:
            pH_factor = 0.6
        sigma *= pH_factor
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

    def supersaturation_tourmaline(self) -> float:
        """Tourmaline (Na(Fe,Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄) supersaturation.

        Cyclosilicate — needs Na + B + Al + SiO₂. The B channel is what
        makes tourmaline rare outside pegmatites: boron is incompatible in
        common rock-forming minerals, so it accumulates in residual
        pegmatite fluid until tourmaline crosses saturation.

        Forms high-T (350–700°C, optimum 400–600°C). Extremely acid- and
        weathering-resistant — no dissolution in the sim. The schorl/elbaite
        distinction is a color/composition flag set in grow_tourmaline
        based on which cations the fluid carries when the zone deposits.
        """
        if (self.fluid.Na < 3 or self.fluid.B < 6 or
                self.fluid.Al < 8 or self.fluid.SiO2 < 60):
            return 0
        # Cap each factor — pegmatite fluids can have thousands of ppm SiO₂
        # and tens of ppm of the incompatible elements. The real limiter is
        # the boron channel and temperature window, not sheer abundance.
        na_f = min(self.fluid.Na / 20.0, 1.5)
        b_f  = min(self.fluid.B / 15.0, 2.0)   # B is the gate
        al_f = min(self.fluid.Al / 15.0, 1.5)
        si_f = min(self.fluid.SiO2 / 400.0, 1.5)
        sigma = na_f * b_f * al_f * si_f
        # Temperature window — stable up to ~700°C but nucleates best in
        # the 400–600°C band. Falls off outside.
        T = self.temperature
        if 400 <= T <= 600:
            T_factor = 1.0
        elif 350 <= T < 400:
            T_factor = 0.5 + 0.01 * (T - 350)  # 0.5 → 1.0
        elif 600 < T <= 700:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 600))
        elif 700 < T:
            T_factor = 0.2  # outside stability field
        else:
            T_factor = max(0.1, 0.5 - 0.008 * (350 - T))  # below 350 → starved
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_topaz(self) -> float:
        """Topaz (Al₂SiO₄(F,OH)₂) supersaturation. Needs Al + SiO₂ + F.

        Topaz is a nesosilicate whose structure demands fluorine (or OH) in
        every other anion site. The F channel is what gates nucleation —
        fluorine is incompatible early in hydrothermal evolution, so it
        accumulates in residual fluid until it crosses a saturation threshold.
        Morteani et al. 2002 put Ouro Preto imperial topaz at ~360°C, 3.5 kbar.
        T_optimum 340–400°C; falls off outside that window. Very stable —
        only strong acid (pH < 2) attacks it, and slowly.
        """
        # Hard F threshold: below this the structure simply can't form.
        # This is the mechanism that delays topaz in the ouro_preto scenario —
        # early quartz grows alone while F climbs past the gate.
        if self.fluid.F < 20 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        # Cap each factor so pegmatite-level Al/SiO₂ (thousands of ppm each)
        # doesn't explode sigma into runaway nucleation territory. Topaz
        # only needs its anion components above threshold, not bazillions
        # of them; the limiter is the F channel and temperature window.
        al_f = min(self.fluid.Al / 8.0, 2.0)
        si_f = min(self.fluid.SiO2 / 400.0, 1.5)
        f_f  = min(self.fluid.F / 25.0, 1.5)
        sigma = al_f * si_f * f_f
        # Temperature window — sweet spot 340-400°C, decays outside.
        T = self.temperature
        if 340 <= T <= 400:
            T_factor = 1.0
        elif 300 <= T < 340:
            T_factor = 0.6 + 0.01 * (T - 300)   # 0.6 → 1.0 across the lower ramp
        elif 400 < T <= 500:
            T_factor = max(0.2, 1.0 - 0.008 * (T - 400))
        elif 500 < T <= 600:
            T_factor = max(0.1, 0.4 - 0.003 * (T - 500))
        else:
            T_factor = 0.1  # outside published range — starved
        sigma *= T_factor
        # Strong-acid dissolution (pH < 2) eats topaz, slowly.
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.4
        return max(sigma, 0)

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

    def supersaturation_azurite(self) -> float:
        """Azurite (Cu₃(CO₃)₂(OH)₂) supersaturation. Cu + high CO₃ + O₂.

        Needs HIGHER carbonate than malachite — that's why high-pCO₂
        groundwater produces azurite in limestone-hosted copper vugs
        but malachite dominates otherwise. When CO₃ drops during the
        run, grow_azurite flags the crystal for malachite conversion.

        The Cu carbonate competition is encoded by carbonate activity,
        not by a Cu:Zn-style broth ratio (the rosasite/aurichalcite
        Round 9 idiom doesn't fit this pair — they share Cu, not two
        competing metals). Vink 1986 (*Mineralogical Magazine* 50:43-47)
        fixes the azurite/malachite univariant boundary at
        log(pCO2) ≈ -3.5 at 25°C. Above: azurite. Below: malachite.
        Azurite's higher CO3 requirement (≥120 vs malachite ≥20) is
        the sim-scale encoding. See
        research/research-broth-ratio-malachite-azurite.md.
        """
        if (self.fluid.Cu < 20 or self.fluid.CO3 < 120 or
                self.fluid.O2 < 1.0):
            return 0
        cu_f = min(self.fluid.Cu / 40.0, 2.0)
        co_f = min(self.fluid.CO3 / 150.0, 1.8)   # CO3 is the gate
        o_f  = min(self.fluid.O2 / 1.5, 1.3)
        sigma = cu_f * co_f * o_f
        if self.temperature > 50:
            sigma *= math.exp(-0.06 * (self.temperature - 50))
        if self.fluid.pH < 5.0:
            sigma -= (5.0 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_chrysocolla(self) -> float:
        """Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) supersaturation — hydrous copper
        silicate, the cyan enamel of Cu oxidation zones.

        Strictly low-T (<80 °C), strictly meteoric. Needs Cu²⁺ AND
        dissolved SiO₂ above the amorphous-silica floor simultaneously,
        in a near-neutral pH window (5.5–7.5) where both are soluble
        together. Silicate-hosted (or mixed-host) systems supply the Si;
        the limestone-only MVT-style scenarios lack SiO₂ in the fluid
        so chrysocolla stays ~0 there — correct geologically.

        Azurite ↔ malachite ↔ chrysocolla competition rule: when
        CO₃²⁻ > SiO₂ (molar — ppm is close enough in our fluid scale
        since both MW ≈ 60), the carbonates out-compete and
        chrysocolla's σ collapses. Chrysocolla only wins when pCO₂
        has dropped and SiO₂ has risen (the Bisbee late-oxidation
        sequence).
        """
        # Hard gates: the no-go conditions
        if (self.fluid.Cu < 5 or self.fluid.SiO2 < 20 or
                self.fluid.O2 < 0.3):
            return 0
        if self.temperature < 5 or self.temperature > 80:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        # Malachite / azurite win when CO₃ dominates — chrysocolla is
        # the late-stage "no more CO₂" mineral.
        if self.fluid.CO3 > self.fluid.SiO2:
            return 0

        cu_f = min(self.fluid.Cu / 30.0, 3.0)
        si_f = min(self.fluid.SiO2 / 60.0, 2.5)
        o_f = min(self.fluid.O2 / 1.0, 1.5)

        # Temperature factor — optimum 15–40 °C
        T = self.temperature
        if 15 <= T <= 40:
            t_f = 1.0
        elif T < 15:
            t_f = max(0.3, T / 15.0)
        else:
            t_f = max(0.3, 1.0 - (T - 40) / 40.0)

        # pH factor — optimum 6.0–7.5, roll off at edges
        pH = self.fluid.pH
        if 6.0 <= pH <= 7.5:
            ph_f = 1.0
        elif pH < 6.0:
            ph_f = max(0.4, 1.0 - (6.0 - pH) * 0.6)
        else:
            ph_f = max(0.4, 1.0 - (pH - 7.5) * 0.6)

        sigma = cu_f * si_f * o_f * t_f * ph_f
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

    def supersaturation_cerussite(self) -> float:
        """Cerussite (PbCO₃) supersaturation. Needs Pb + CO₃.

        Final stable product of the lead-oxidation sequence in
        carbonate-rich water. Outcompetes anglesite when CO₃ is
        abundant. Stellate cyclic twins on {110} are iconic — "six-ray
        stars" growing as three individuals rotated 120° apart.
        Low-T mineral; dissolves in acid (it's a carbonate, fizzes).
        """
        if self.fluid.Pb < 15 or self.fluid.CO3 < 30:
            return 0
        pb_f = min(self.fluid.Pb / 40.0, 2.0)
        co_f = min(self.fluid.CO3 / 80.0, 1.5)
        sigma = pb_f * co_f
        # Low-T preference — cerussite is strictly supergene
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Acid dissolution (pH < 4) — fizzes like calcite
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.4
        # Alkaline promotes cerussite precipitation (carbonate buffering)
        elif self.fluid.pH > 7.0:
            sigma *= 1.0 + (self.fluid.pH - 7.0) * 0.1
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

    def supersaturation_rosasite(self) -> float:
        """Rosasite ((Cu,Zn)₂(CO₃)(OH)₂) — Cu-dominant supergene carbonate.

        First mineral in the sim with the **broth-ratio branching** mechanic
        (Round 9a). Rosasite and aurichalcite consume the same elements
        (Cu + Zn + CO₃) but the Cu:Zn ratio in the fluid determines which
        species nucleates: rosasite when Cu/(Cu+Zn) > 0.5, aurichalcite
        when Zn/(Cu+Zn) > 0.5. Same parent fluid, different outcome —
        the first non-presence/absence chemistry gate in the simulator.

        Forms velvety blue-green botryoidal spheres on supergene oxidation
        zones where chalcopyrite + sphalerite weather together. Type
        locality: Rosas Mine, Sardinia (1908). Most aesthetic specimens
        come from Mapimi (Mexico) and Tsumeb (Namibia).

        Source: research/research-rosasite.md (boss commit 3bfdf4a);
        Pinch & Wilson 1977 (Tsumeb monograph).
        """
        # Required ingredients — Cu, Zn, CO3 all present
        if self.fluid.Cu < 5 or self.fluid.Zn < 3 or self.fluid.CO3 < 30:
            return 0
        # Hard T-gate — supergene/ambient only
        if self.temperature < 10 or self.temperature > 40:
            return 0
        # Oxidizing requirement (supergene zone)
        if self.fluid.O2 < 0.8:
            return 0
        # pH gate — near-neutral to mildly alkaline (carbonate stable)
        if self.fluid.pH < 6.5:
            return 0

        # Broth-ratio branching — Cu-dominant gives rosasite, Zn-dominant
        # gives aurichalcite. Hard zero on the wrong side; the dominant
        # element wins the ratio race.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total  # safe — Cu>=5 gate above
        if cu_fraction < 0.5:
            return 0

        # Activity factors — Cu and Zn are both moderate (not trace) here
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        zn_f = min(self.fluid.Zn / 25.0, 2.0)
        co3_f = min(self.fluid.CO3 / 100.0, 2.0)
        sigma = cu_f * zn_f * co3_f

        # Cu-fraction sweet spot — peak at 0.55-0.85 (Cu-rich but with real
        # Zn participation). Pure-Cu fluid (>0.95) gets damped because
        # malachite and azurite take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5

        # T optimum — 15-30°C
        T = self.temperature
        if 15 <= T <= 30:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)  # 10→0.6 ramps to 15→0.8
        else:  # 30 < T <= 40
            T_factor = max(0.5, 1.2 - 0.07 * (T - 30))
        sigma *= T_factor

        # Fe inhibitor — high Fe diverts to siderite
        if self.fluid.Fe > 60:
            sigma *= 0.6

        return max(sigma, 0)

    def supersaturation_aurichalcite(self) -> float:
        """Aurichalcite ((Zn,Cu)₅(CO₃)₂(OH)₆) — Zn-dominant supergene carbonate.

        Mirror of rosasite in the broth-ratio branching pair (Round 9a).
        Same parent fluid, opposite outcome: nucleates only when
        Zn/(Cu+Zn) > 0.5. Pale blue-green tufted divergent sprays with
        high birefringence; hardness 2 (scratches with a fingernail).

        Named for Plato's mythical orichalcum — the lost gold-alloy of
        Atlantis. Type locality: Loktevskoye Mine, Western Siberia (1839);
        the most aesthetic specimens come from Mapimi, Mexico (in
        intergrowth with rosasite).

        Source: research/research-aurichalcite.md (boss commit 3bfdf4a).
        """
        # Required ingredients — Zn-dominant
        if self.fluid.Zn < 5 or self.fluid.Cu < 3 or self.fluid.CO3 < 30:
            return 0
        # Hard T-gate — supergene/ambient
        if self.temperature < 10 or self.temperature > 40:
            return 0
        # Oxidizing requirement
        if self.fluid.O2 < 0.8:
            return 0
        # pH gate — slightly more alkaline-leaning than rosasite, but
        # still mildly acidic-tolerant. Research file gives 7-9 as the
        # idealized "stable" range, but real Tsumeb supergene fluids
        # active for aurichalcite have been measured at 5.5-7.5 (Pinch
        # & Wilson 1977; Brady & Walther 1989 on supergene assemblages).
        # 6.0 brings the canonical Tsumeb-anchored scenario both pre-acid
        # (pH=6.8) and post-meteoric-flush (pH=6.2) windows into range,
        # matching the empirical observation that aurichalcite is a
        # diagnostic Tsumeb mineral. Lower bound stops short of the
        # acid-dissolution threshold (5.0 in grow_aurichalcite).
        if self.fluid.pH < 6.0:
            return 0

        # Broth-ratio branching — Zn-dominant gives aurichalcite
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total
        if zn_fraction < 0.5:
            return 0

        # Activity factors
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        zn_f = min(self.fluid.Zn / 25.0, 2.0)
        co3_f = min(self.fluid.CO3 / 100.0, 2.0)
        sigma = cu_f * zn_f * co3_f

        # Zn-fraction sweet spot — peak at 0.55-0.85 (Zn-rich but with real
        # Cu participation). Pure-Zn fluid (>0.95) gets damped because
        # smithsonite and hydrozincite compete there.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5

        # T optimum — 15-28°C, slightly cooler-favoring than rosasite
        T = self.temperature
        if 15 <= T <= 28:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:  # 28 < T <= 40
            T_factor = max(0.5, 1.2 - 0.06 * (T - 28))
        sigma *= T_factor

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

