"""Supersaturation methods for carbonate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (11):
  calcite, dolomite, siderite, rhodochrosite, aragonite, malachite, smithsonite, azurite, cerussite, rosasite, aurichalcite
"""

import math
from typing import Optional


class CarbonateSupersatMixin:
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

