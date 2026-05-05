"""Supersaturation methods for silicate minerals.

PROPOSAL-MODULAR-REFACTOR Phase A5b — supersat methods extracted from
VugConditions and grouped by mineral class. Each method takes `self`
(a VugConditions instance) and returns the supersaturation index σ for
its specific mineral.

Mixed into VugConditions via inheritance — see vugg/chemistry/conditions.py.

Minerals covered (15):
  quartz, apophyllite, feldspar, albite, spodumene, beryl, emerald, aquamarine, morganite, heliodor, tourmaline, topaz, chrysocolla
"""

import math
from typing import Optional


class SilicateSupersatMixin:
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

