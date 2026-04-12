#!/usr/bin/env python3
"""
🪨 Vugg Simulator — A text-based crystal growth engine

Simulates mineral crystallization inside a vug (cavity) under
evolving hydrothermal conditions. Text output describes what grows,
how it grows, and why.

Usage:
  python3 vugg.py                          # default scenario
  python3 vugg.py --scenario cooling       # simple cooling scenario  
  python3 vugg.py --scenario pulse         # fluid pulse event
  python3 vugg.py --scenario mvt           # Mississippi Valley-type deposit
  python3 vugg.py --scenario reactive_wall # Acid pulses dissolve limestone walls
  python3 vugg.py --steps 200             # more time steps
  python3 vugg.py --interactive           # manual control mode

The engine is modular — minerals are plugins, events are injectable,
and the output format is extensible.
"""

import argparse
import json
import math
import random
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


# ============================================================
# PHYSICAL CONSTANTS AND MODELS
# ============================================================

@dataclass
class FluidChemistry:
    """Hydrothermal fluid composition."""
    SiO2: float = 500.0       # ppm — silica concentration
    Ca: float = 200.0          # ppm — calcium
    CO3: float = 150.0         # ppm — carbonate
    F: float = 10.0            # ppm — fluorine
    Zn: float = 0.0            # ppm — zinc
    S: float = 0.0             # ppm — sulfur
    Fe: float = 5.0            # ppm — iron (trace in quartz, major in sphalerite)
    Mn: float = 2.0            # ppm — manganese (fluorescence activator)
    Al: float = 3.0            # ppm — aluminum (smoky quartz)
    Ti: float = 0.5            # ppm — titanium (TitaniQ geothermometer)
    Pb: float = 0.0            # ppm — lead (galena, cerussite, pyromorphite, wulfenite)
    Cu: float = 0.0            # ppm — copper (chalcopyrite, malachite, azurite, chrysocolla)
    Mo: float = 0.0            # ppm — molybdenum (molybdenite, wulfenite)
    U: float = 0.0             # ppm — uranium (uraninite, autunite, torbernite)
    Na: float = 0.0            # ppm — sodium (albite, halite, natrolite)
    K: float = 0.0             # ppm — potassium (orthoclase, microcline, muscovite, adularia)
    Mg: float = 0.0            # ppm — magnesium (dolomite, olivine, serpentine, chlorite)
    Ba: float = 0.0            # ppm — barium (barite, witherite)
    Sr: float = 0.0            # ppm — strontium (celestine, strontianite)
    Cr: float = 0.0            # ppm — chromium (ruby color, uvarovite, kämmererite, chrome diopside)
    P: float = 0.0             # ppm — phosphorus (apatite, pyromorphite, vivianite, turquoise)
    As: float = 0.0            # ppm — arsenic (arsenopyrite, realgar, orpiment, adamite, mimetite)
    Cl: float = 0.0            # ppm — chlorine (halite, pyromorphite, vanadinite, chlorargyrite)
    V: float = 0.0             # ppm — vanadium (vanadinite, cavansite, roscoelite)
    W: float = 0.0             # ppm — tungsten (scheelite, wolframite, ferberite)
    Ag: float = 0.0            # ppm — silver (native silver, acanthite, chlorargyrite, proustite)
    Bi: float = 0.0            # ppm — bismuth (native bismuth, bismuthinite, bismutite)
    Sb: float = 0.0            # ppm — antimony (stibnite, valentinite, kermesite)
    Ni: float = 0.0            # ppm — nickel (millerite, annabergite, garnierite)
    Co: float = 0.0            # ppm — cobalt (cobaltite, erythrite, spherocobaltite)
    B: float = 0.0             # ppm — boron (tourmaline, ulexite, colemanite)
    Li: float = 0.0            # ppm — lithium (spodumene/kunzite, lepidolite, elbaite)
    Be: float = 0.0            # ppm — beryllium (beryl/emerald/aquamarine/morganite, chrysoberyl)
    Te: float = 0.0            # ppm — tellurium (calaverite, sylvanite — Au-Te tellurides)
    Se: float = 0.0            # ppm — selenium (clausthalite, naumannite — often with Ag)
    Ge: float = 0.0            # ppm — germanium (renierite — Tsumeb speciality, Zn sphalerite trace)
    O2: float = 0.0            # relative oxygen fugacity (0=reducing, 1=neutral, 2=oxidizing)
    pH: float = 6.5
    salinity: float = 5.0      # wt% NaCl equivalent

    def describe(self) -> str:
        """Human-readable fluid description."""
        parts = []
        if self.SiO2 > 300:
            parts.append(f"silica-rich ({self.SiO2:.0f} ppm SiO₂)")
        if self.Ca > 100:
            parts.append(f"Ca²⁺ {self.Ca:.0f} ppm")
        if self.Fe > 20:
            parts.append(f"Fe-bearing ({self.Fe:.0f} ppm)")
        if self.Mn > 5:
            parts.append(f"Mn-bearing ({self.Mn:.0f} ppm)")
        if self.Zn > 50:
            parts.append(f"Zn-rich ({self.Zn:.0f} ppm)")
        if self.S > 50:
            parts.append(f"sulfur-bearing ({self.S:.0f} ppm)")
        if self.Cu > 20:
            parts.append(f"Cu-bearing ({self.Cu:.0f} ppm)")
        if self.F > 20:
            parts.append(f"fluorine-rich ({self.F:.0f} ppm)")
        if self.O2 > 1.0:
            parts.append("oxidizing")
        elif self.O2 < 0.3 and (self.S > 20 or self.Fe > 20):
            parts.append("reducing")
        if self.pH < 5:
            parts.append(f"acidic (pH {self.pH:.1f})")
        elif self.pH > 8:
            parts.append(f"alkaline (pH {self.pH:.1f})")
        return ", ".join(parts) if parts else "dilute"


@dataclass
class VugWall:
    """Reactive carbonate wall of the vug.
    
    In real MVT systems, the vug wall IS the host limestone/dolomite.
    Acid dissolves it, releasing Ca²⁺ and CO₃²⁻, neutralizing pH,
    and enlarging the cavity. The dissolved carbonate can then 
    reprecipitate on existing crystals during the pH recovery —
    creating rapid growth bursts.
    """
    composition: str = "limestone"    # "limestone" or "dolomite"
    thickness_mm: float = 500.0       # wall thickness (effectively infinite for our purposes)
    vug_diameter_mm: float = 50.0     # initial cavity diameter
    total_dissolved_mm: float = 0.0   # cumulative wall dissolution
    
    # Trace elements in the host rock (released during dissolution)
    wall_Fe_ppm: float = 2000.0       # iron in the limestone/dolomite
    wall_Mn_ppm: float = 500.0        # manganese in host rock
    wall_Mg_ppm: float = 1000.0       # magnesium (higher if dolomite)
    
    # Provenance tracking — how much Ca in the fluid came from the wall?
    ca_from_wall_total: float = 0.0   # cumulative Ca²⁺ released from wall dissolution
    
    def dissolve(self, acid_strength: float, fluid: 'FluidChemistry') -> dict:
        """Dissolve wall rock in response to acid conditions.
        
        CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂
        
        Returns dict of what happened.
        """
        if acid_strength <= 0:
            return {"dissolved": False}
        
        # Dissolution rate scales with acid strength and available wall
        # More acid = more dissolution, but it's self-limiting (neutralization)
        rate_mm = min(acid_strength * 0.5, 2.0)  # max 2mm per step
        
        if self.thickness_mm < rate_mm:
            rate_mm = self.thickness_mm  # can't dissolve more than exists
        
        self.thickness_mm -= rate_mm
        self.total_dissolved_mm += rate_mm
        self.vug_diameter_mm += rate_mm * 2  # expands both sides
        
        # Released chemistry — proportional to volume dissolved
        # 1mm of limestone wall = significant Ca and CO3 release
        ca_released = rate_mm * 15.0      # ppm contribution to fluid
        co3_released = rate_mm * 12.0     # slightly less (some escapes as CO2 gas)
        fe_released = rate_mm * (self.wall_Fe_ppm / 1000.0) * 0.5
        mn_released = rate_mm * (self.wall_Mn_ppm / 1000.0) * 0.5
        
        # pH neutralization — the wall IS the buffer
        # Each mm of dissolution neutralizes significant acid
        ph_recovery = rate_mm * 0.8
        
        # Apply to fluid
        fluid.Ca += ca_released
        fluid.CO3 += co3_released
        fluid.Fe += fe_released
        fluid.Mn += mn_released
        fluid.pH += ph_recovery
        fluid.pH = min(fluid.pH, 8.5)  # can't go above carbonate buffered equilibrium
        
        # Track provenance
        self.ca_from_wall_total += ca_released
        
        return {
            "dissolved": True,
            "rate_mm": rate_mm,
            "ca_released": ca_released,
            "co3_released": co3_released,
            "fe_released": fe_released,
            "mn_released": mn_released,
            "ph_before": fluid.pH - ph_recovery,
            "ph_after": fluid.pH,
            "vug_diameter": self.vug_diameter_mm,
            "total_dissolved": self.total_dissolved_mm,
        }


@dataclass 
class VugConditions:
    """Current physical/chemical conditions in the vug."""
    temperature: float = 350.0    # °C
    pressure: float = 1.5         # kbar
    fluid: FluidChemistry = field(default_factory=FluidChemistry)
    flow_rate: float = 1.0        # relative (0 = stagnant, 1 = normal, 5 = flood)
    wall: VugWall = field(default_factory=VugWall)  # reactive wall
    
    def supersaturation_quartz(self) -> float:
        """Calculate quartz supersaturation (simplified).
        
        Based on the solubility curve: SiO2 solubility increases with T.
        At equilibrium, higher T = more SiO2 dissolved.
        Supersaturation occurs when fluid cools below the T where its
        SiO2 concentration would be in equilibrium.
        
        Simplified model: solubility ≈ 50 * exp(0.008 * T) ppm
        
        HF ATTACK: Low pH + high fluorine dissolves quartz as SiF4.
        This is real — HF is the only common acid that attacks silicates.
        """
        equilibrium_SiO2 = 50.0 * math.exp(0.008 * self.temperature)
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
        
        return max(sigma, 0)
    
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
        # Retrograde solubility: fluorite precipitates MORE at moderate T
        # Sweet spot 100-250°C, drops off outside that range
        if 100 <= self.temperature <= 250:
            T_factor = 1.0
        elif self.temperature < 100:
            T_factor = 0.4 + 0.006 * self.temperature  # slow kinetics at low T
        else:
            T_factor = max(0.1, 1.0 - 0.004 * (self.temperature - 250))  # declines above 250
        
        # Product model with reduced base to prevent domination
        product = (self.fluid.Ca / 300.0) * (self.fluid.F / 30.0) * T_factor
        sigma = product
        
        # Fluoro-complex cap: at very high F, Ca²⁺ + nF⁻ → CaFₙ complexes
        # re-dissolve fluorite. Real effect: solubility minimum around 0.01-0.05 M F⁻.
        if self.fluid.F > 80:
            complex_penalty = (self.fluid.F - 80) / 200.0
            sigma -= complex_penalty
        
        # Acid attack on fluorite
        if self.fluid.pH < 5.0:
            acid_attack = (5.0 - self.fluid.pH) * 0.4
            sigma -= acid_attack
        return max(sigma, 0)
    
    def supersaturation_sphalerite(self) -> float:
        """Sphalerite (ZnS) supersaturation. Needs Zn + S."""
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)
        return product * 2.0 * math.exp(-0.004 * self.temperature)
    
    def supersaturation_pyrite(self) -> float:
        """Pyrite (FeS2) supersaturation. Needs Fe + S, reducing conditions.
        
        Pyrite is the most common sulfide. Forms over huge T range (25-700°C).
        Needs iron AND sulfur AND not too oxidizing.
        """
        if self.fluid.Fe < 5 or self.fluid.S < 10:
            return 0
        # Oxidizing conditions destroy sulfides
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # Pyrite is stable over a wide T range, slight preference for moderate T
        T_factor = 1.0 if 100 < self.temperature < 400 else 0.5
        return product * T_factor * (1.5 - self.fluid.O2)
    
    def supersaturation_chalcopyrite(self) -> float:
        """Chalcopyrite (CuFeS2) supersaturation. Needs Cu + Fe + S.
        
        Main copper ore mineral. Competes with pyrite for Fe and S.
        """
        if self.fluid.Cu < 10 or self.fluid.Fe < 5 or self.fluid.S < 15:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Cu / 80.0) * (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        T_factor = 1.2 if 150 < self.temperature < 350 else 0.6
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
        """
        if self.fluid.Cu < 5 or self.fluid.CO3 < 20 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Cu / 50.0) * (self.fluid.CO3 / 200.0) * (self.fluid.O2 / 1.0)
        # Temperature penalty at high T — malachite is a LOW temperature mineral
        if self.temperature > 50:
            sigma *= math.exp(-0.005 * (self.temperature - 50))
        # Acid penalty — malachite dissolves easily (it fizzes!)
        if self.fluid.pH < 4.5:
            sigma -= (4.5 - self.fluid.pH) * 0.5
        return max(sigma, 0)


    def supersaturation_adamite(self) -> float:
        """Adamite (Zn₂(AsO₄)(OH)) supersaturation. Needs Zn + As + oxidizing + low T.
        
        Secondary mineral forming in oxidation zones of zinc-arsenic deposits.
        Bright green fluorescence under UV (activated by Cu²⁺ substitution).
        Non-fluorescent crystals coexist with fluorescent ones — the contradiction.
        Prismatic to tabular crystals, often on limonite.
        Forms at low temperature (<100°C) in near-surface oxidation zones.
        """
        if self.fluid.Zn < 10 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Zn / 80.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
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
        # Moderate temperature preference
        if self.temperature > 450:
            sigma *= math.exp(-0.008 * (self.temperature - 450))
        return max(sigma, 0)

    def supersaturation_smithsonite(self) -> float:
        """Smithsonite (ZnCO₃) supersaturation. Needs Zn + CO₃ + oxidizing.

        Secondary zinc carbonate — the oxidation product of sphalerite.
        Named for James Smithson (founder of the Smithsonian).
        Botryoidal blue-green (Cu), pink (Co), yellow (Cd), white (pure).
        Low temperature mineral — forms in the oxidation zone.
        """
        if self.fluid.Zn < 15 or self.fluid.CO3 < 30 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Zn / 60.0) * (self.fluid.CO3 / 80.0) * (self.fluid.O2 / 1.0)
        # Suppressed above 100°C — it's a supergene mineral
        if self.temperature > 100:
            sigma *= math.exp(-0.02 * (self.temperature - 100))
        # Dissolves in acid
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_wulfenite(self) -> float:
        """Wulfenite (PbMoO₄) supersaturation. Needs Pb + Mo + oxidizing.

        Lead molybdate — thin square plates, bright orange-red to yellow.
        The oxidized-zone product of galena + molybdenite destruction.
        My foundation stone (TN422). "The sunset caught in stone."
        Requires BOTH Pb and Mo to arrive — typically a late-stage mineral.
        """
        if self.fluid.Pb < 5 or self.fluid.Mo < 2 or self.fluid.O2 < 0.5:
            return 0
        sigma = (self.fluid.Pb / 40.0) * (self.fluid.Mo / 15.0) * (self.fluid.O2 / 1.0)
        # Very low temperature — oxidation zone mineral
        if self.temperature > 80:
            sigma *= math.exp(-0.025 * (self.temperature - 80))
        # Needs the right pH window — dissolves in both acid and strong base
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.4
        elif self.fluid.pH > 9.0:
            sigma -= (self.fluid.pH - 9.0) * 0.3
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
        # STRICT low temperature cap — anhydrite takes over above 60°C
        if self.temperature > 60:
            sigma *= math.exp(-0.06 * (self.temperature - 60))
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
        """
        if self.fluid.K < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        sigma = (self.fluid.K / 40.0) * (self.fluid.Al / 10.0) * (self.fluid.SiO2 / 400.0)
        # Feldspars need HIGH temperature — they're igneous/metamorphic
        if self.temperature < 300:
            sigma *= math.exp(-0.01 * (300 - self.temperature))
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
        return max(sigma, 0)

    def supersaturation_uraninite(self) -> float:
        """Uraninite (UO₂) supersaturation. Needs U + reducing conditions.

        Primary uranium mineral — pitchy black masses, rarely crystalline.
        RADIOACTIVE. The mineral that let Röntgen's successors see inside atoms.
        Needs STRONGLY reducing conditions. Any oxygen destroys it.
        Forms in pegmatites (high T) and reduced sedimentary environments (low T).
        """
        if self.fluid.U < 5 or self.fluid.O2 > 0.3:
            return 0  # needs reducing conditions
        sigma = (self.fluid.U / 20.0) * (0.5 - self.fluid.O2)
        # Stable across wide T range, slight preference for high T
        if self.temperature > 200:
            sigma *= 1.3
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
        # Moderate to high temperature
        if self.temperature < 150:
            sigma *= math.exp(-0.01 * (150 - self.temperature))
        elif 300 < self.temperature < 500:
            sigma *= 1.3  # sweet spot for porphyry Mo
        return max(sigma, 0)


# ============================================================
# CRYSTAL MODELS
# ============================================================

@dataclass
class GrowthZone:
    """A single growth zone — one layer of the crystal's history."""
    step: int
    temperature: float
    thickness_um: float          # micrometers
    growth_rate: float           # µm per step
    trace_Fe: float = 0.0       # ppm incorporated
    trace_Mn: float = 0.0
    trace_Al: float = 0.0
    trace_Ti: float = 0.0
    trace_Pb: float = 0.0       # Pb — amazonite, galena inclusions
    fluid_inclusion: bool = False
    inclusion_type: str = ""     # "2-phase", "3-phase", "vapor-rich"
    note: str = ""
    # Provenance tracking — where did the building material come from?
    ca_from_wall: float = 0.0    # fraction of Ca²⁺ derived from wall dissolution (0-1)
    ca_from_fluid: float = 0.0   # fraction from original fluid
    is_phantom: bool = False     # marks a dissolution surface (phantom boundary)
    dissolution_depth_um: float = 0.0  # how much was dissolved at this boundary


@dataclass
class Crystal:
    """A growing crystal in the vug."""
    mineral: str
    crystal_id: int
    nucleation_step: int
    nucleation_temp: float
    position: str                  # "vug wall", "on sphalerite", etc.
    
    # Dimensions (simplified — c-axis and a-axis for hexagonal/trigonal)
    c_length_mm: float = 0.0      # length along c-axis
    a_width_mm: float = 0.0       # width perpendicular to c
    
    # Morphology
    habit: str = "prismatic"       # prismatic, tabular, acicular, massive, rhombohedral, etc.
    dominant_forms: List[str] = field(default_factory=list)
    twinned: bool = False
    twin_law: str = ""
    
    # Growth history
    zones: List[GrowthZone] = field(default_factory=list)
    total_growth_um: float = 0.0
    
    # State
    active: bool = True            # still growing?
    dissolved: bool = False        # partially dissolved?
    
    # Enclosure tracking — crystals that got swallowed by this one
    enclosed_crystals: List[int] = field(default_factory=list)  # crystal_ids enclosed
    enclosed_at_step: List[int] = field(default_factory=list)   # step when enclosure happened
    enclosed_by: Optional[int] = None  # crystal_id that enclosed THIS crystal
    
    # Phantom tracking — dissolution surfaces preserved as internal boundaries
    phantom_surfaces: List[int] = field(default_factory=list)  # zone indices where dissolution occurred
    phantom_count: int = 0         # number of phantom boundaries
    
    def add_zone(self, zone: GrowthZone):
        # Detect phantom boundaries — dissolution followed by regrowth
        if zone.thickness_um < 0:
            zone.is_phantom = True
            zone.dissolution_depth_um = abs(zone.thickness_um)
            self.phantom_surfaces.append(len(self.zones))
            self.phantom_count += 1
        elif self.zones and self.zones[-1].thickness_um < 0 and zone.thickness_um > 0:
            # This zone is growing OVER a dissolution surface — mark the boundary
            zone.note = (zone.note + " [phantom boundary — growing over dissolution surface]").strip()
        
        self.zones.append(zone)
        self.total_growth_um += zone.thickness_um
        self.total_growth_um = max(self.total_growth_um, 0)  # can't go negative
        self.c_length_mm = self.total_growth_um / 1000.0
        # Width grows slower than length for prismatic habit
        if self.habit == "prismatic":
            self.a_width_mm = self.c_length_mm * 0.4
        elif self.habit == "tabular":
            self.a_width_mm = self.c_length_mm * 1.5
        elif self.habit == "acicular":
            self.a_width_mm = self.c_length_mm * 0.15
        elif self.habit == "rhombohedral":
            self.a_width_mm = self.c_length_mm * 0.8
        else:
            self.a_width_mm = self.c_length_mm * 0.5
    
    def describe_morphology(self) -> str:
        forms = ", ".join(self.dominant_forms) if self.dominant_forms else self.habit
        twin_str = f", {self.twin_law} twin" if self.twinned else ""
        size = f"{self.c_length_mm:.1f} × {self.a_width_mm:.1f} mm"
        return f"{self.habit} [{forms}]{twin_str}, {size}"
    
    def describe_latest_zone(self) -> str:
        if not self.zones:
            return "no growth"
        z = self.zones[-1]
        parts = [f"+{z.thickness_um:.1f} µm"]
        traces = []
        if z.trace_Fe > 1:
            traces.append(f"Fe {z.trace_Fe:.1f}")
        if z.trace_Mn > 0.5:
            traces.append(f"Mn {z.trace_Mn:.1f}")
        if z.trace_Ti > 0.1:
            traces.append(f"Ti {z.trace_Ti:.2f}")
        if z.trace_Al > 1:
            traces.append(f"Al {z.trace_Al:.1f}")
        if traces:
            parts.append(f"traces: {', '.join(traces)} ppm")
        if z.fluid_inclusion:
            parts.append(f"fluid inclusion ({z.inclusion_type})")
        if z.note:
            parts.append(z.note)
        return "; ".join(parts)
    
    def predict_color(self) -> str:
        """Predict visible color based on trace element history and mineral type."""
        if not self.zones:
            return "colorless"
        
        avg_Fe = sum(z.trace_Fe for z in self.zones) / len(self.zones)
        avg_Mn = sum(z.trace_Mn for z in self.zones) / len(self.zones)
        avg_Al = sum(z.trace_Al for z in self.zones) / len(self.zones)
        avg_Ti = sum(z.trace_Ti for z in self.zones) / len(self.zones)
        
        if self.mineral == "quartz":
            # Quartz color depends on trace elements + radiation history
            # Fe³⁺ → amethyst (with radiation), citrine (with heat or no radiation)
            # Al + radiation → smoky quartz
            # Ti → rutilated (but that's inclusions, not substitution)
            # Pure → colorless/milky
            if avg_Fe > 3.0 and avg_Al > 3.0:
                return ("iron+aluminum bearing — amethyst if irradiated (Fe³⁺ color centers), "
                        "smoky if Al-dominated radiation damage, citrine if heated")
            elif avg_Fe > 3.0:
                return ("iron-bearing — potential amethyst (needs radiation to activate "
                        "Fe³⁺ color centers), citrine if heated, colorless without radiation")
            elif avg_Al > 5.0:
                return "aluminum-bearing — smoky quartz if irradiated (Al-hole color centers)"
            elif avg_Fe > 1.0:
                return "trace iron — pale citrine possible, likely colorless"
            else:
                return "water-clear (low trace elements)"
        
        elif self.mineral == "calcite":
            # Calcite color: Fe = amber/brown/black, Mn = pink/orange, pure = white/colorless
            # This is Professor's observation about amber/black calcite
            if avg_Fe > 5.0:
                if avg_Fe > 15.0:
                    return "dark brown to black (high iron — opaque in thick sections)"
                elif avg_Fe > 8.0:
                    return "amber to brown (moderate iron)"
                else:
                    return "pale amber/honey (low iron)"
            elif avg_Mn > 3.0 and avg_Fe < 3.0:
                return "pink to salmon (Mn²⁺ without Fe quenching)"
            elif avg_Mn > 1.0:
                return "cream to pale yellow"
            else:
                return "colorless to white"
        
        elif self.mineral == "sphalerite":
            # Already handled in growth zones, but summarize here
            if avg_Fe > 100:
                return "black (marmatite — high Fe substitution)"
            elif avg_Fe > 50:
                return "dark brown to ruby jack"
            elif avg_Fe > 20:
                return "honey/amber"
            else:
                return "pale yellow to colorless (cleiophane — gem quality)"
        
        elif self.mineral == "fluorite":
            # Color from zones
            if avg_Fe > 2:
                return "green (iron-related color centers)"
            elif avg_Mn > 2:
                return "purple (Mn-related)"
            else:
                return "blue-violet to colorless"
        
        elif self.mineral == "hematite":
            # Color depends on habit (recorded in zone notes)
            specular_zones = [z for z in self.zones if "specular" in z.note or "steel-gray" in z.note]
            iridescent_zones = [z for z in self.zones if "iridescent" in z.note]
            if iridescent_zones:
                return "iridescent (thin-plate interference colors, streak always red)"
            elif specular_zones:
                return "steel-gray metallic (specular, streak red)"
            else:
                return "red earthy (massive/botryoidal, streak red)"
        
        elif self.mineral == "malachite":
            # Always green — the question is what kind of green
            zone_count = len(self.zones)
            avg_cu_note = ""
            if self.zones:
                # Check for banding
                banded = any("banded" in z.note for z in self.zones)
                vivid = any("vivid" in z.note for z in self.zones)
                pale = any("pale" in z.note for z in self.zones)
                if banded:
                    return "banded green (alternating light/dark concentric layers)"
                elif vivid:
                    return "vivid green (high Cu)"
                elif pale:
                    return "pale green (Cu-depleted)"
            return "green (classic malachite)"
        
        elif self.mineral == "feldspar":
            # K-feldspar color: amazonite (Pb), orthoclase (flesh), adularia (moonstone)
            amazonite_zones = [z for z in self.zones if "amazonite" in z.note]
            adularia_zones = [z for z in self.zones if "adularia" in z.note]
            perthite_zones = [z for z in self.zones if "perthite" in z.note]
            if amazonite_zones:
                return "amazonite blue-green (Pb²⁺ → K⁺ substitution in microcline)"
            elif adularia_zones and any("moonstone" in z.note for z in adularia_zones):
                return "adularescent moonstone (thin albite intergrowths scatter light)"
            elif adularia_zones:
                return "colorless adularia"
            elif perthite_zones:
                return "perthite — flesh-colored host with white albite stringers"
            else:
                return "flesh-colored to white (typical orthoclase/microcline)"
        
        elif self.mineral == "albite":
            # Albite color: usually white/colorless, but peristerite = moonstone
            cleavelandite_zones = [z for z in self.zones if "cleavelandite" in z.note]
            peristerite_zones = [z for z in self.zones if "peristerite" in z.note]
            if peristerite_zones:
                return "peristerite moonstone (blue-white adularescence from exsolution lamellae)"
            elif cleavelandite_zones:
                return "white cleavelandite (platy lamellar)"
            else:
                return "white to colorless"
        
        return "typical for species"
    
    def predict_fluorescence(self) -> str:
        """Predict UV fluorescence based on trace element history."""
        avg_Mn = sum(z.trace_Mn for z in self.zones) / max(len(self.zones), 1)
        avg_Fe = sum(z.trace_Fe for z in self.zones) / max(len(self.zones), 1)
        
        if self.mineral == "calcite":
            if avg_Mn > 2 and avg_Fe < 10:
                return "orange-red (Mn²⁺ activated)"
            elif avg_Mn > 2 and avg_Fe > 10:
                return "weak/quenched (Fe²⁺ quenching Mn²⁺ emission)"
            else:
                return "non-fluorescent"
        elif self.mineral == "fluorite":
            return "blue-violet (REE/defect centers)"
        elif self.mineral == "quartz":
            avg_Al = sum(z.trace_Al for z in self.zones) / max(len(self.zones), 1)
            if avg_Al > 5:
                return "weak blue (Al-related defects)"
            return "non-fluorescent"
        elif self.mineral in ("pyrite", "chalcopyrite"):
            return "non-fluorescent (opaque sulfide)"
        elif self.mineral == "hematite":
            return "non-fluorescent (opaque oxide)"
        elif self.mineral == "malachite":
            return "non-fluorescent"
        elif self.mineral == "feldspar":
            # Amazonite can fluoresce yellow-green under LW UV
            if any("amazonite" in z.note for z in self.zones):
                return "yellow-green under LW UV (Pb²⁺ activator in amazonite)"
            return "non-fluorescent or weak white under SW"
        elif self.mineral == "albite":
            return "weak white under LW UV (common for Na-feldspar)"
        return "unknown"


# ============================================================
# MINERAL GROWTH ENGINES (plugins)
# ============================================================

def grow_quartz(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Quartz growth model."""
    sigma = conditions.supersaturation_quartz()
    
    if sigma < 1.0:
        # Undersaturated — dissolution
        if crystal.total_growth_um > 10:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.1)
            # RECYCLING: dissolved SiO2 returns to fluid
            conditions.fluid.SiO2 += dissolved_um * 0.8
            
            # Determine dissolution type
            if conditions.fluid.pH < 4.0 and conditions.fluid.F > 20:
                note = "HF etching — trigonal etch pits on prism faces, SiO₂ dissolved as SiF₄"
            else:
                note = "dissolution — etching on prism faces"
            
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=note
            )
        return None
    
    # Growth rate: BCF spiral growth simplified
    # rate ∝ (σ - 1)² for spiral growth at low supersaturation
    # rate ∝ (σ - 1) for 2D nucleation at high supersaturation
    excess = sigma - 1.0
    if excess < 0.5:
        rate = 8.0 * excess * excess  # slow, orderly spiral growth
    else:
        rate = 4.0 * excess           # faster, may produce growth hillocks
    
    # Temperature effect on rate
    rate *= math.exp(-3000.0 / (conditions.temperature + 273.15)) * 50.0
    
    # Add some natural variation
    rate *= random.uniform(0.7, 1.3)
    
    if rate < 0.1:
        return None  # negligible growth
    
    # Trace element incorporation
    # Ti incorporation increases with T (TitaniQ)
    Ti_partition = 0.01 * math.exp(0.005 * conditions.temperature)
    trace_Ti = conditions.fluid.Ti * Ti_partition
    
    # Al incorporation (smoky quartz potential)  
    Al_partition = 0.02 * (1 + 0.5 * excess)
    trace_Al = conditions.fluid.Al * Al_partition
    
    # Fe — very low partition into quartz
    trace_Fe = conditions.fluid.Fe * 0.005
    
    # Mn — trace
    trace_Mn = conditions.fluid.Mn * 0.003
    
    # Fluid inclusions — more likely at growth zone boundaries, fast growth
    fi = False
    fi_type = ""
    if rate > 15 and random.random() < 0.3:
        fi = True
        if conditions.temperature > 300:
            fi_type = "2-phase (liquid + vapor)"
        elif conditions.temperature > 200:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid"
    
    # Morphology updates
    if conditions.temperature > 400:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["m{100} prism", "r{101} rhombohedron"]
    elif conditions.temperature > 250:
        crystal.habit = "prismatic"  
        crystal.dominant_forms = ["m{100} prism", "r{101}", "z{011}"]
    elif conditions.temperature > 150:
        crystal.dominant_forms = ["m{100}", "r{101}", "z{011} dominant"]
        if excess > 1.0:
            crystal.habit = "scepter overgrowth possible"
    else:
        crystal.dominant_forms = ["m{100}", "r{101}", "z{011}"]
        if excess > 1.5:
            crystal.habit = "skeletal/fenster"
    
    # Twinning — Dauphiné twin from thermal shock
    if not crystal.twinned and len(crystal.zones) > 5:
        if len(crystal.zones) >= 2:
            prev_T = crystal.zones[-1].temperature
            delta_T = abs(conditions.temperature - prev_T)
            if delta_T > 30 and random.random() < 0.15:
                crystal.twinned = True
                crystal.twin_law = "Dauphiné"
    
    note = ""
    if excess > 1.5:
        note = "rapid growth — growth hillocks developing on prism faces"
    elif excess > 1.0:
        note = "moderate supersaturation — clean layer growth"
    elif excess < 0.2:
        note = "near-equilibrium — very slow, high-quality growth"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        trace_Al=trace_Al, trace_Ti=trace_Ti,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=note
    )


def grow_calcite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Calcite growth model — retrograde solubility."""
    sigma = conditions.supersaturation_calcite()
    
    if sigma < 1.0:
        # Acid dissolution — calcite dissolves easily in acid
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.5:
            crystal.dissolved = True
            dissolved_um = min(8.0, crystal.total_growth_um * 0.15)
            # RECYCLING: Ca, CO3, and trace elements return to fluid
            conditions.fluid.Ca += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.3
            # Mn and Fe that were in the crystal go back into solution
            if crystal.zones:
                avg_mn = sum(z.trace_Mn for z in crystal.zones[-3:]) / min(len(crystal.zones), 3)
                avg_fe = sum(z.trace_Fe for z in crystal.zones[-3:]) / min(len(crystal.zones), 3)
                conditions.fluid.Mn += avg_mn * 0.5
                conditions.fluid.Fe += avg_fe * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Ca²⁺ + CO₃²⁻ released back to fluid"
            )
        return None  # undersaturated for calcite
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    
    # Mn incorporation — THE fluorescence activator
    Mn_partition = 0.1 * (1 + excess * 0.5)
    trace_Mn = conditions.fluid.Mn * Mn_partition
    
    # Fe incorporation — THE fluorescence QUENCHER
    Fe_partition = 0.08
    trace_Fe = conditions.fluid.Fe * Fe_partition
    
    # Provenance tracking — what fraction of Ca came from the wall?
    wall = conditions.wall
    total_ca = conditions.fluid.Ca
    ca_wall_fraction = 0.0
    ca_fluid_fraction = 1.0
    if total_ca > 0 and wall.ca_from_wall_total > 0:
        # Approximate: wall-derived Ca as fraction of total Ca in fluid
        ca_wall_fraction = min(wall.ca_from_wall_total / total_ca, 1.0)
        ca_fluid_fraction = 1.0 - ca_wall_fraction
    
    # Morphology
    if conditions.temperature > 200:
        crystal.habit = "scalenohedral"
        crystal.dominant_forms = ["v{211} scalenohedron", "dog-tooth"]
    elif conditions.temperature > 100:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104} rhombohedron"]
    else:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104}", "possibly nail-head"]
    
    # Calcite twins easily
    if not crystal.twinned and random.random() < 0.1:
        crystal.twinned = True
        crystal.twin_law = "c-twin {001}"
    
    note = ""
    if trace_Mn > 1.0 and trace_Fe < 2.0:
        note = "Mn-rich zone — will fluoresce orange under UV"
    elif trace_Mn > 1.0 and trace_Fe > 2.0:
        note = "Fe quenching Mn fluorescence — dark CL zone"
    
    # Provenance note when significant wall-derived material
    if ca_wall_fraction > 0.3:
        prov_note = f"[{ca_wall_fraction*100:.0f}% recycled wall rock]"
        note = f"{note} {prov_note}".strip() if note else prov_note
    
    fi = False
    fi_type = ""
    if rate > 8 and random.random() < 0.2:
        fi = True
        fi_type = "2-phase" if conditions.temperature > 150 else "single-phase"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=note,
        ca_from_wall=ca_wall_fraction,
        ca_from_fluid=ca_fluid_fraction,
    )


def grow_sphalerite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Sphalerite (ZnS) growth model."""
    sigma = conditions.supersaturation_sphalerite()
    
    if sigma < 1.0:
        return None
    
    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.7, 1.3)
    
    # Fe substitution — determines color and is a geothermometer
    # More Fe at higher T
    Fe_mol_percent = min(conditions.fluid.Fe * 0.1 * (conditions.temperature / 300.0), 30.0)
    trace_Fe = Fe_mol_percent * 10  # rough ppm equivalent for display
    
    crystal.habit = "tetrahedral"
    crystal.dominant_forms = ["{111} tetrahedron"]
    
    # Color from Fe content
    if Fe_mol_percent > 15:
        color_note = "black (marmatite — high Fe)"
    elif Fe_mol_percent > 8:
        color_note = "dark brown"
    elif Fe_mol_percent > 3:
        color_note = "honey/amber"
    else:
        color_note = "pale yellow (cleiophane — gem quality)"
    
    # Twinning common in sphalerite
    if not crystal.twinned and random.random() < 0.015:
        crystal.twinned = True
        crystal.twin_law = "spinel-law {111}"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"color: {color_note}, Fe: {Fe_mol_percent:.1f} mol%"
    )


def grow_fluorite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Fluorite (CaF2) growth model.
    
    Fluorite dissolves in strong acid: CaF₂ + 2HCl → CaCl₂ + 2HF
    This is genuinely dangerous — it releases hydrofluoric acid.
    Also dissolves at very low pH regardless of acid type.
    """
    sigma = conditions.supersaturation_fluorite()
    
    if sigma < 1.0:
        # Acid dissolution of fluorite
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.12)
            # Release Ca and F back to fluid
            conditions.fluid.Ca += dissolved_um * 0.4
            conditions.fluid.F += dissolved_um * 0.6
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — CaF₂ + 2H⁺ → Ca²⁺ + 2HF (⚠️ releases hydrofluoric acid)"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)  # was 7.0, reduced to prevent Groove domination
    
    crystal.habit = "cubic"
    crystal.dominant_forms = ["{100} cube"]
    
    # Color zoning — fluorite is famous for it
    if conditions.fluid.Fe > 10:
        color = "green"
    elif conditions.fluid.Mn > 5:
        color = "purple"
    elif conditions.temperature > 200:
        color = "colorless"
    else:
        color = "blue-violet"
    
    if not crystal.twinned and random.random() < 0.008:
        crystal.twinned = True
        crystal.twin_law = "penetration twin {111}"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.02,
        trace_Mn=conditions.fluid.Mn * 0.05,
        note=f"color zone: {color}"
    )


def grow_pyrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Pyrite (FeS2) growth model.
    
    The most common sulfide mineral. Famous for cubic and pyritohedral habits.
    Framboids (raspberry-shaped aggregates) form at low T from rapid nucleation.
    """
    sigma = conditions.supersaturation_pyrite()
    
    if sigma < 1.0:
        # Check for oxidation/dissolution
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Fe and S return to fluid
            conditions.fluid.Fe += dissolved_um * 1.0
            conditions.fluid.S += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidizing — pyrite weathering to goethite/limonite, Fe²⁺ released to fluid"
            )
        # Also dissolves in strong acid
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            conditions.fluid.Fe += 2.0
            conditions.fluid.S += 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-2.0, growth_rate=-2.0,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Fe + S released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.7, 1.3)
    
    # Temperature controls habit
    if conditions.temperature > 300:
        crystal.habit = "cubic"
        crystal.dominant_forms = ["{100} cube"]
    elif conditions.temperature > 200:
        crystal.habit = "pyritohedral"
        crystal.dominant_forms = ["{210} pyritohedron"]
    elif conditions.temperature > 100:
        # Mix of forms
        crystal.habit = "cubo-pyritohedral"
        crystal.dominant_forms = ["{100} + {210}"]
    else:
        # Low T — framboidal possible
        if excess > 1.0:
            crystal.habit = "framboidal"
            crystal.dominant_forms = ["framboidal aggregate"]
        else:
            crystal.habit = "cubic"
            crystal.dominant_forms = ["{100} cube, microcrystalline"]
    
    # Trace elements — As substitutes for S, Co/Ni substitute for Fe
    trace_note = "brassy yellow metallic luster"
    if conditions.fluid.Cu > 20:
        trace_note += ", Cu traces (may exsolve chalcopyrite inclusions)"
    
    # Twinning — iron cross twins
    if not crystal.twinned and random.random() < 0.008:
        crystal.twinned = True
        crystal.twin_law = "iron cross {110}"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.15,
        note=trace_note
    )


def grow_chalcopyrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chalcopyrite (CuFeS2) growth model.
    
    Main copper ore mineral. Tetragonal but often looks tetrahedral.
    Brassy yellow, develops iridescent tarnish (peacock ore = bornite, 
    but chalcopyrite tarnishes similarly).
    """
    sigma = conditions.supersaturation_chalcopyrite()
    
    if sigma < 1.0:
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Cu, Fe, S return to fluid
            conditions.fluid.Cu += dissolved_um * 0.8
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidizing — chalcopyrite weathering, Cu²⁺ + Fe²⁺ released (→ malachite/azurite at surface)"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)
    
    crystal.habit = "disphenoidal"
    crystal.dominant_forms = ["{112} disphenoid", "{012}"]
    
    # Color/tarnish note
    if conditions.temperature < 100:
        color_note = "brassy yellow, may develop iridescent tarnish"
    else:
        color_note = "brassy yellow, metallic"
    
    # Cu content tracking through Fe field (reusing for display)
    trace_Cu = conditions.fluid.Cu * 0.1
    
    # Twinning — penetration twins common
    if not crystal.twinned and random.random() < 0.012:
        crystal.twinned = True
        crystal.twin_law = "penetration twin {112}"
    
    # Competes with pyrite for Fe and S — deplete both
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.1,
        note=f"{color_note}, Cu: {trace_Cu:.1f} ppm incorporated"
    )


def grow_hematite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Hematite (Fe₂O₃) growth model.
    
    The most important iron oxide. Specular hematite at high T is stunning —
    metallic silver-black plates that flash like mirrors. At low T, botryoidal
    masses with kidney-ore texture. The red streak is diagnostic regardless of habit.
    """
    sigma = conditions.supersaturation_hematite()
    
    if sigma < 1.0:
        # Strong acid dissolves hematite
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Fe returns to fluid
            conditions.fluid.Fe += dissolved_um * 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Fe²⁺ released back to fluid"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit varies with temperature — this is well-documented
    if conditions.temperature > 300:
        crystal.habit = "specular"
        crystal.dominant_forms = ["{001} basal plates", "metallic platy"]
    elif conditions.temperature > 150:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["{101} rhombohedron"]
    else:
        if excess > 0.5:
            crystal.habit = "botryoidal"
            crystal.dominant_forms = ["kidney-ore texture"]
        else:
            crystal.habit = "earthy/massive"
            crystal.dominant_forms = ["microcrystalline aggregate"]
    
    # Width depends on habit
    if crystal.habit == "specular":
        crystal.a_width_mm = crystal.c_length_mm * 2.0  # plates are wide
    elif crystal.habit == "botryoidal":
        crystal.a_width_mm = crystal.c_length_mm * 1.2
    
    # Trace Mn incorporation
    trace_Mn = conditions.fluid.Mn * 0.04
    trace_Fe = conditions.fluid.Fe * 0.2  # it IS an iron mineral
    
    # Twinning — rare, penetration twin on {001}
    if not crystal.twinned and random.random() < 0.005:
        crystal.twinned = True
        crystal.twin_law = "penetration twin {001}"
    
    # Color prediction note
    if crystal.habit == "specular":
        if random.random() < 0.03:
            color_note = "iridescent (very thin plates — interference colors)"
        else:
            color_note = "steel-gray metallic"
    elif crystal.habit in ("earthy/massive", "botryoidal"):
        color_note = "red earthy"
    else:
        color_note = "dark gray metallic"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        note=f"{crystal.habit} habit, {color_note}"
    )


def grow_malachite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Malachite (Cu₂(CO₃)(OH)₂) growth model.
    
    The green copper carbonate. Always green — vivid, banded, botryoidal.
    Forms from oxidation of copper sulfides. Classic paragenesis:
    chalcopyrite → covellite → malachite/azurite. Low temperature only.
    Dissolves in acid with effervescence (it's a carbonate!).
    """
    sigma = conditions.supersaturation_malachite()
    
    if sigma < 1.0:
        # Acid dissolution — malachite dissolves easily (fizzes!)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.15)
            # RECYCLING: Cu²⁺ and CO₃²⁻ return to fluid
            conditions.fluid.Cu += dissolved_um * 0.8
            conditions.fluid.CO3 += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — fizzing! Cu²⁺ + CO₃²⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit depends on growth rate and history
    zone_count = len(crystal.zones)
    if zone_count >= 20:
        crystal.habit = "banded"
        crystal.dominant_forms = ["banded botryoidal", "concentric layers"]
    elif rate > 8:
        crystal.habit = "fibrous/acicular"
        crystal.dominant_forms = ["acicular sprays", "fibrous radiating"]
    else:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["botryoidal masses", "mammillary"]
    
    # Width for botryoidal/banded forms
    if crystal.habit in ("botryoidal", "banded"):
        crystal.a_width_mm = crystal.c_length_mm * 1.5
    elif crystal.habit == "fibrous/acicular":
        crystal.a_width_mm = crystal.c_length_mm * 0.2
    
    # Cu consumption — each growth step depletes Cu from fluid
    conditions.fluid.Cu -= rate * 0.01
    conditions.fluid.Cu = max(conditions.fluid.Cu, 0)
    
    # No twinning for malachite (doesn't typically twin visibly)
    
    # Color — ALWAYS green
    if zone_count >= 20:
        color_note = "banded green (alternating light/dark)"
    elif conditions.fluid.Cu > 30:
        color_note = "vivid green"
    elif conditions.fluid.Cu < 10:
        color_note = "pale green"
    else:
        color_note = "green"
    
    trace_Fe = conditions.fluid.Fe * 0.01  # trace iron
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}, Cu fluid: {conditions.fluid.Cu:.0f} ppm"
    )


def grow_adamite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Adamite (Zn₂(AsO₄)(OH)) growth model.
    
    TN467 — my rock. The contradiction: green-fluorescing crystals next to
    non-fluorescing ones, on the same specimen. Cu²⁺ substitution activates
    the fluorescence; crystals without Cu are dark under UV.
    
    Prismatic to tabular, often fan-shaped sprays. On limonite (iron oxide).
    Color: yellow-green (pure) to vivid green (Cu-bearing = cuproadamite).
    """
    sigma = conditions.supersaturation_adamite()
    
    if sigma < 1.0:
        # Acid dissolution
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.5:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Zn += dissolved_um * 0.5
            conditions.fluid.As += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Zn²⁺ + AsO₄³⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit
    zone_count = len(crystal.zones)
    if rate > 6:
        crystal.habit = "acicular sprays"
        crystal.dominant_forms = ["radiating fan-shaped sprays", "acicular needles"]
        crystal.a_width_mm = crystal.c_length_mm * 0.15
    elif zone_count > 15:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["elongated prisms", "wedge-shaped"]
        crystal.a_width_mm = crystal.c_length_mm * 0.4
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["tabular crystals", "flattened prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.7
    
    # Cu substitution → determines fluorescence!
    cu_in_crystal = conditions.fluid.Cu * 0.02
    
    # Color depends on Cu content
    if cu_in_crystal > 0.5:
        color_note = "vivid green (cuproadamite) — UV-FLUORESCENT 💚"
    elif cu_in_crystal > 0.1:
        color_note = "green — weakly fluorescent"
    else:
        color_note = "yellow-green — NON-FLUORESCENT (no Cu)"
    
    # Deplete Zn and As from fluid
    conditions.fluid.Zn -= rate * 0.008
    conditions.fluid.Zn = max(conditions.fluid.Zn, 0)
    conditions.fluid.As -= rate * 0.005
    conditions.fluid.As = max(conditions.fluid.As, 0)
    
    trace_Fe = conditions.fluid.Fe * 0.01
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_mimetite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Mimetite (Pb₅(AsO₄)₃Cl) growth model.
    
    TN422's substrate — my foundation stone's foundation. Wulfenite sits on this.
    Isostructural with pyromorphite (phosphate) and vanadinite (vanadate).
    All three are apatite supergroup: hexagonal prisms, barrel-shaped ("campylite"),
    or tabular. Pb₅(XO₄)₃Cl where X = As (mimetite), P (pyromorphite), V (vanadinite).
    
    Color: yellow, orange, yellow-brown. Campylite variety has curved barrel faces
    from Fe substitution. Resinous to adamantine luster.
    """
    sigma = conditions.supersaturation_mimetite()
    
    if sigma < 1.0:
        # Acid dissolution
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Pb += dissolved_um * 0.8
            conditions.fluid.As += dissolved_um * 0.3
            conditions.fluid.Cl += dissolved_um * 0.1
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Pb²⁺ + AsO₄³⁻ + Cl⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit — the classic apatite supergroup morphologies
    zone_count = len(crystal.zones)
    fe_ratio = conditions.fluid.Fe / max(conditions.fluid.Pb, 1)
    
    if fe_ratio > 0.3 and random.random() < 0.4:
        # Campylite! Barrel-shaped from Fe substitution
        crystal.habit = "campylite (barrel-shaped)"
        crystal.dominant_forms = ["barrel-shaped hexagonal prisms", "curved faces"]
        crystal.a_width_mm = crystal.c_length_mm * 0.6
    elif rate > 7:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["thin hexagonal needles", "hair-like prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.15
    elif zone_count > 10:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["hexagonal prisms", "pinacoidal terminations"]
        crystal.a_width_mm = crystal.c_length_mm * 0.4
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["thick tabular hexagons", "stubby prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.8
    
    # Color
    if fe_ratio > 0.3:
        color_note = "orange-brown (Fe-rich campylite)"
    elif conditions.fluid.Pb > 100:
        color_note = "bright yellow-orange"
    else:
        color_note = "pale yellow"
    
    # Deplete Pb, As, Cl from fluid
    conditions.fluid.Pb -= rate * 0.015
    conditions.fluid.Pb = max(conditions.fluid.Pb, 0)
    conditions.fluid.As -= rate * 0.008
    conditions.fluid.As = max(conditions.fluid.As, 0)
    conditions.fluid.Cl -= rate * 0.003
    conditions.fluid.Cl = max(conditions.fluid.Cl, 0)
    
    trace_Fe = conditions.fluid.Fe * 0.02  # Fe substitution (campylite factor)
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_feldspar(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """K-feldspar (KAlSi₃O₈) growth model.

    The most abundant mineral group in Earth's crust.
    Temperature determines the polymorph:
    - Sanidine (>600°C): monoclinic, disordered Al/Si — found in volcanic rocks
    - Orthoclase (400-600°C): monoclinic, partially ordered — common in granites
    - Microcline (<400°C): triclinic, fully ordered — characteristic cross-hatch twinning

    Pb²⁺ substituting for K⁺ in microcline produces amazonite (blue-green).
    Adularia: low-T habit variant with pseudo-orthorhombic shape, moonstone adularescence.
    Carlsbad twin: most common K-spar twin law, rotation on c-axis.
    Baveno twin: rarer, reflection on {021}.
    Manebach twin: reflection on {001}, least common.
    """
    sigma = conditions.supersaturation_feldspar()

    if sigma < 1.0:
        # Kaolinization: acidic weathering of feldspar → kaolinite
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.08)
            conditions.fluid.K += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.2
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"kaolinization (pH {conditions.fluid.pH:.1f}) — KAlSi₃O₈ → kaolinite + K⁺"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.8, 1.2)

    if rate < 0.1:
        return None

    T = conditions.temperature

    # Temperature determines polymorph
    if T > 600:
        polymorph = "sanidine"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{010} platy", "{001} cleavage", "short prismatic"]
    elif T > 400:
        polymorph = "orthoclase"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "Carlsbad twin"]
    else:
        polymorph = "microcline"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "cross-hatch twinning", "{010} face"]

    # Amazonite detection: Pb in microcline
    amazonite = False
    if polymorph == "microcline" and conditions.fluid.Pb > 5:
        if random.random() < 0.3 * (conditions.fluid.Pb / 50.0):
            amazonite = True

    # Adularia detection: low-T, moderate K, specific fluid chemistry
    adularia = False
    if T < 350 and conditions.fluid.K > 20 and conditions.fluid.Na > 5:
        if random.random() < 0.15:
            adularia = True
            crystal.habit = "adularia (pseudo-orthorhombic)"
            crystal.dominant_forms = ["rhombic cross-section", "pseudo-orthorhombic faces"]

    # Twinning — K-feldspar has three common twin laws
    if not crystal.twinned:
        twin_roll = random.random()
        if twin_roll < 0.12:
            crystal.twinned = True
            crystal.twin_law = "Carlsbad twin (rotation on c-axis)"
        elif twin_roll < 0.16:
            crystal.twinned = True
            crystal.twin_law = "Baveno twin (reflection {021})"
        elif twin_roll < 0.18:
            crystal.twinned = True
            crystal.twin_law = "Manebach twin (reflection {001})"

    # Perthite exsolution check
    # At high T, K and Na are fully miscible in alkali feldspar.
    # On cooling below ~500°C, they unmix: Na-rich albite lamellae exsolve from K-spar host.
    perthite = False
    if (polymorph in ("orthoclase", "microcline")
            and conditions.fluid.Na > 8
            and crystal.total_growth_um > 20
            and T < 500):
        if random.random() < 0.2 * (conditions.fluid.Na / 30.0):
            perthite = True
            # Na gets consumed to form albite lamellae within the K-spar
            conditions.fluid.Na -= rate * 0.05
            conditions.fluid.Na = max(conditions.fluid.Na, 0)

    # Color determination
    if amazonite:
        color_note = "amazonite blue-green (Pb²⁺ → K⁺ substitution)"
    elif adularia:
        # Moonstone adularescence from thin albite intergrowths
        if conditions.fluid.Na > 10:
            color_note = "adularescent moonstone (thin albite intergrowths scatter light)"
        else:
            color_note = "colorless adularia"
    else:
        color_note = " flesh-colored to white"

    # Deplete K, Al, SiO₂ from fluid
    conditions.fluid.K -= rate * 0.012
    conditions.fluid.K = max(conditions.fluid.K, 0)
    conditions.fluid.Al -= rate * 0.006
    conditions.fluid.Al = max(conditions.fluid.Al, 0)
    conditions.fluid.SiO2 -= rate * 0.010
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2, 0)

    # Build zone note
    parts = [polymorph]
    if amazonite:
        parts.append("amazonite")
    if adularia:
        parts.append("adularia")
    if perthite:
        parts.append("perthite exsolution (albite lamellae)")
    parts.append(color_note)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Al=conditions.fluid.Al * 0.03,
        trace_Pb=conditions.fluid.Pb * 0.01 if amazonite else 0,
        note=", ".join(parts)
    )


def grow_albite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Albite (NaAlSi₃O₈) growth model.

    The sodium end-member of the plagioclase series.
    Na-feldspar: the other half of the alkali feldspar family.

    High T (>450°C): monalbite (monoclinic, disordered Al/Si)
    Low T (<450°C): low-albite (triclinic, fully ordered)

    Twinning:
    - Albite law: reflection on {010} — most common, produces polysynthetic twins
    - Pericline law: rotation on b-axis — produces "pericline" striations
    - Both together: produces the characteristic grid of pericline + albite twins

    Peristerite: intergrowth of albite + oligoclase (Ab₉₀An₁₀) at low T.
    Creates moonstone adularescence — blue-white schiller from light scattering
    on submicroscopic exsolution lamellae.

    Cleavelandite: platy, lamellar albite habit from low-T hydrothermal fluids.
    """
    sigma = conditions.supersaturation_albite()

    if sigma < 1.0:
        # Albite is very stable — resists weathering better than K-spar
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Na += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.2
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"albite dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)

    if rate < 0.1:
        return None

    T = conditions.temperature

    # Temperature determines ordering state
    if T > 450:
        ordering = "high-albite (monalbite, disordered Al/Si)"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "{110} prism"]
    else:
        ordering = "low-albite (fully ordered)"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "polysynthetic twinning"]

    # Cleavelandite: platy lamellar habit from low-T hydrothermal conditions
    cleavelandite = False
    if T < 350 and rate < 3.0:
        if random.random() < 0.25:
            cleavelandite = True
            crystal.habit = "cleavelandite (platy lamellar)"
            crystal.dominant_forms = ["thin platy lamellae", "curved aggregates"]

    # Twinning — albite has two main twin laws
    if not crystal.twinned:
        twin_roll = random.random()
        if twin_roll < 0.20:
            crystal.twinned = True
            crystal.twin_law = "albite twin (reflection {010})"
        elif twin_roll < 0.25:
            crystal.twinned = True
            crystal.twin_law = "pericline twin (rotation on b-axis)"

    # Peristerite / moonstone check
    # Albite + oligoclase intergrowth creates adularescence
    peristerite = False
    if T < 400 and conditions.fluid.Ca > 2:
        if random.random() < 0.15:
            peristerite = True

    # Color
    if peristerite:
        color_note = "peristerite moonstone (blue-white adularescence from exsolution)"
    elif cleavelandite:
        color_note = "white, lamellar"
    else:
        color_note = "white to colorless"

    # Deplete Na, Al, SiO₂ from fluid
    conditions.fluid.Na -= rate * 0.012
    conditions.fluid.Na = max(conditions.fluid.Na, 0)
    conditions.fluid.Al -= rate * 0.006
    conditions.fluid.Al = max(conditions.fluid.Al, 0)
    conditions.fluid.SiO2 -= rate * 0.010
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2, 0)

    # Build zone note
    parts = [ordering]
    if cleavelandite:
        parts.append("cleavelandite")
    if peristerite:
        parts.append("peristerite intergrowth")
    parts.append(color_note)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Al=conditions.fluid.Al * 0.03,
        note=", ".join(parts)
    )


# Mineral registry
MINERAL_ENGINES = {
    "quartz": grow_quartz,
    "calcite": grow_calcite,
    "sphalerite": grow_sphalerite,
    "fluorite": grow_fluorite,
    "pyrite": grow_pyrite,
    "chalcopyrite": grow_chalcopyrite,
    "hematite": grow_hematite,
    "malachite": grow_malachite,
    "adamite": grow_adamite,
    "mimetite": grow_mimetite,
    "feldspar": grow_feldspar,
    "albite": grow_albite,
}


# ============================================================
# THERMAL DECOMPOSITION SYSTEM
# ============================================================
# Minerals have real melting/decomposition temperatures.
# Extreme heating events (igneous intrusion, deep burial) can
# destroy low-stability minerals, reopening sealed vug space.
# This is a natural balancing mechanism against runaway growth.

THERMAL_DECOMPOSITION = {
    # mineral: (decomp_temp_°C, description, products)
    "calcite":    (840,  "CaCO₃ → CaO + CO₂ (calcination)",                     {"Ca": 0.5, "CO3": 0.4}),
    "malachite":  (200,  "Cu₂CO₃(OH)₂ → CuO + CO₂ + H₂O",                      {"Cu": 0.6, "CO3": 0.3}),
    "sphalerite": (1020, "ZnS → Zn + S (sublimes)",                              {"Zn": 0.3, "S": 0.5}),
    "fluorite":   (1360, "CaF₂ melting — extremely refractory",                   {"Ca": 0.4, "F": 0.4}),
    "pyrite":     (743,  "FeS₂ → FeS + S (sulfur driven off)",                    {"Fe": 0.5, "S": 0.4}),
    "chalcopyrite": (880, "CuFeS₂ decomposition",                                {"Cu": 0.3, "Fe": 0.3, "S": 0.4}),
    "hematite":   (1560, "Fe₂O₃ — very refractory, barely melts",                 {}),
    "quartz":     (1713, "SiO₂ melting — takes hell itself to melt quartz",       {"SiO2": 0.3}),
    "adamite":    (500,  "Zn₂AsO₄OH → decomposition",                            {"Zn": 0.4, "As": 0.3}),
    "mimetite":   (400,  "Pb₅Cl(AsO₄)₃ → decomposition",                         {"Pb": 0.5, "As": 0.3, "Cl": 0.1}),
    "galena":     (1115, "PbS → Pb + S (melting)",                                     {"Pb": 0.5, "S": 0.4}),
    "smithsonite": (300,  "ZnCO₃ → ZnO + CO₂ (calcination)",                            {"Zn": 0.4, "CO3": 0.4}),
    "wulfenite":   (1120, "PbMoO₄ → Pb + MoO₃ (decomposition)",                         {"Pb": 0.4, "Mo": 0.3}),
    "selenite":    (150,  "CaSO₄·2H₂O → CaSO₄ (anhydrite) + H₂O",                       {"Ca": 0.3, "S": 0.2}),
    "feldspar":    (1170, "KAlSi₃O₈ melting — feldspar is refractory",                    {"K": 0.3, "Al": 0.2, "SiO2": 0.3}),
    "albite":      (1118, "NaAlSi₃O₈ melting — albite slightly less refractory",                {"Na": 0.3, "Al": 0.2, "SiO2": 0.3}),
    "uraninite":   (2800, "UO₂ — one of the most refractory oxides",                      {"U": 0.5}),
    "goethite":    (300,  "FeO(OH) → Fe₂O₃ + H₂O (dehydrates to hematite)",              {"Fe": 0.5}),
    "molybdenite": (1185, "MoS₂ decomposition",                                         {"Mo": 0.4, "S": 0.4}),
}


def check_thermal_decomposition(crystals: list, conditions, step: int) -> list:
    """Check if any crystals should thermally decompose at current temperature.
    Returns list of log messages.
    """
    log = []
    T = conditions.temperature
    
    for crystal in crystals:
        if not crystal.active or crystal.dissolved:
            continue
        if crystal.mineral not in THERMAL_DECOMPOSITION:
            continue
        
        decomp_temp, description, products = THERMAL_DECOMPOSITION[crystal.mineral]
        
        # Need to be within 50°C of decomposition to start, OR over it
        if T < decomp_temp - 50:
            continue
        
        # Probability increases as T approaches and exceeds decomp_temp
        if T >= decomp_temp:
            prob = 0.8  # almost certain above decomp point
        else:
            # Linear ramp from 0 to 0.3 over the 50°C approach zone
            prob = 0.3 * (T - (decomp_temp - 50)) / 50.0
        
        if random.random() < prob:
            # Decompose this crystal
            dissolved_um = crystal.total_growth_um * random.uniform(0.3, 0.7)
            crystal.total_growth_um -= dissolved_um
            crystal.c_length_mm = crystal.total_growth_um / 1000.0
            
            if crystal.total_growth_um < 1.0:
                crystal.active = False
                crystal.dissolved = True
                status = "DESTROYED"
            else:
                status = f"DECOMPOSING ({dissolved_um:.0f}µm lost)"
            
            # Release decomposition products back to fluid
            for element, fraction in products.items():
                released = dissolved_um * fraction
                if hasattr(conditions.fluid, element):
                    current = getattr(conditions.fluid, element)
                    setattr(conditions.fluid, element, current + released)
            
            log.append(f"  🔥 {crystal.mineral.capitalize()} #{crystal.crystal_id}: {status} — {description}")
    
    return log


# ============================================================
# EVENT SYSTEM
# ============================================================

@dataclass
class Event:
    """A geological event that modifies vug conditions."""
    step: int
    name: str
    description: str
    apply_fn: object  # callable(VugConditions) -> str


def event_fluid_pulse(conditions: VugConditions) -> str:
    """New fluid floods the vug — chemistry changes sharply."""
    conditions.fluid.SiO2 *= 1.8
    conditions.fluid.Fe *= 3.0
    conditions.fluid.Mn *= 2.5
    conditions.fluid.pH -= 0.5
    conditions.flow_rate = 5.0
    return "Fresh hydrothermal fluid floods the vug. Silica and metals spike."


def event_cooling_pulse(conditions: VugConditions) -> str:
    """Rapid cooling event — maybe meteoric water mixing."""
    conditions.temperature -= 50
    conditions.fluid.SiO2 *= 0.6  # some silica precipitates out
    conditions.flow_rate = 3.0
    return f"Meteoric water incursion. Temperature drops to {conditions.temperature:.0f}°C."


def event_tectonic_shock(conditions: VugConditions) -> str:
    """Pressure spike — fracturing, twinning trigger."""
    conditions.pressure += 0.5
    conditions.temperature += 15  # adiabatic compression
    return "Tectonic event. Pressure spike. Crystals may twin."


def event_copper_injection(conditions: VugConditions) -> str:
    """Copper-bearing magmatic fluid enters the vug."""
    conditions.fluid.Cu = 120.0
    conditions.fluid.Fe += 40.0
    conditions.fluid.S += 80.0
    conditions.fluid.SiO2 += 200.0
    conditions.fluid.Pb += 20.0  # porphyry fluids carry Pb too
    conditions.fluid.O2 = 0.3  # reducing, sulfide-stable
    conditions.temperature += 30
    conditions.flow_rate = 4.0
    return (f"Copper-bearing magmatic fluid surges into the vug. "
            f"Cu spikes to {conditions.fluid.Cu:.0f} ppm. T rises to {conditions.temperature:.0f}°C. "
            f"Reducing conditions — sulfides stable.")


def event_oxidation(conditions: VugConditions) -> str:
    """Oxidizing meteoric water infiltrates — sulfides become unstable."""
    conditions.fluid.O2 = 1.8
    conditions.fluid.S *= 0.3  # sulfur oxidizes out
    conditions.temperature -= 40
    return (f"Oxidizing meteoric water infiltrates. Sulfides becoming unstable. "
            f"T drops to {conditions.temperature:.0f}°C.")


def event_acidify(conditions: VugConditions) -> str:
    """Acidic fluid enters — carbonates become unstable."""
    conditions.fluid.pH -= 2.0
    conditions.fluid.pH = max(conditions.fluid.pH, 2.0)
    return (f"Acidic fluid incursion. pH drops to {conditions.fluid.pH:.1f}. "
            f"Carbonates becoming unstable — calcite may dissolve.")


def event_alkalinize(conditions: VugConditions) -> str:
    """Alkaline fluid enters — carbonates favored, sulfides stressed."""
    conditions.fluid.pH += 2.0
    conditions.fluid.pH = min(conditions.fluid.pH, 10.0)
    return (f"Alkaline fluid incursion. pH rises to {conditions.fluid.pH:.1f}. "
            f"Carbonate precipitation favored.")


def event_molybdenum_pulse(conditions: VugConditions) -> str:
    """Late-stage molybdenum pulse — separate from Cu in porphyry systems.

    Per Seo et al. 2012 (Bingham Canyon), Mo arrives in a distinct later
    pulse from Cu. This is what makes wulfenite possible: you need BOTH
    galena (Pb) and molybdenite (Mo) to oxidize in the same vug.
    """
    conditions.fluid.Mo = 80.0
    conditions.fluid.S += 40.0
    conditions.fluid.O2 = 0.3  # reducing — molybdenite stable
    conditions.temperature += 15
    return (f"Late-stage molybdenum fluid arrives separately from Cu. "
            f"Mo spikes to {conditions.fluid.Mo:.0f} ppm. T rises to {conditions.temperature:.0f}°C. "
            f"Molybdenite may form — future wulfenite precursor.")


def event_fluid_mixing(conditions: VugConditions) -> str:
    """Two fluids meet — classic MVT mechanism."""
    conditions.fluid.Zn = 150.0
    conditions.fluid.S = 120.0
    conditions.fluid.Ca += 100.0
    conditions.fluid.F += 15.0
    conditions.fluid.Fe += 30.0
    conditions.temperature -= 20
    return "Fluid mixing event. Metal-bearing brine meets sulfur-bearing groundwater. Sphalerite and fluorite become possible."


# ============================================================
# SCENARIOS
# ============================================================

def scenario_cooling() -> Tuple[VugConditions, List[Event], int]:
    """Simple cooling scenario — hot fluid cools slowly in a vug."""
    conditions = VugConditions(
        temperature=380.0,
        pressure=1.5,
        fluid=FluidChemistry(SiO2=600, Ca=150, CO3=100, Fe=8, Mn=3, Ti=0.8, Al=4)
    )
    events = []
    return conditions, events, 100


def scenario_pulse() -> Tuple[VugConditions, List[Event], int]:
    """Cooling with a fluid pulse event mid-growth."""
    conditions = VugConditions(
        temperature=350.0,
        pressure=1.2,
        fluid=FluidChemistry(SiO2=500, Ca=200, CO3=120, Fe=5, Mn=2, Ti=0.5, Al=3)
    )
    events = [
        Event(40, "Fluid Pulse", "Fresh hydrothermal fluid", event_fluid_pulse),
        Event(70, "Cooling Pulse", "Meteoric water mixing", event_cooling_pulse),
    ]
    return conditions, events, 100


def scenario_mvt() -> Tuple[VugConditions, List[Event], int]:
    """Mississippi Valley-type deposit — fluid mixing produces sphalerite + calcite + fluorite."""
    conditions = VugConditions(
        temperature=180.0,
        pressure=0.3,
        fluid=FluidChemistry(
            SiO2=100, Ca=300, CO3=250, Fe=15, Mn=8,
            Zn=0, S=0, F=5, pH=7.2, salinity=15.0
        )
    )
    events = [
        Event(20, "Fluid Mixing", "Brine meets groundwater", event_fluid_mixing),
        Event(60, "Second Pulse", "Another mixing event", event_fluid_pulse),
        Event(80, "Tectonic", "Minor seismic event", event_tectonic_shock),
    ]
    return conditions, events, 120


def scenario_porphyry() -> Tuple[VugConditions, List[Event], int]:
    """Copper porphyry deposit — magmatic fluid with copper, then oxidation."""
    conditions = VugConditions(
        temperature=400.0,
        pressure=2.0,
        fluid=FluidChemistry(
            SiO2=700, Ca=80, CO3=50, Fe=30, Mn=2,
            Zn=0, S=60, F=5, Cu=0, Pb=15, O2=0.2,
            pH=4.5, salinity=10.0
        )
    )
    events = [
        Event(25, "Copper Pulse", "Magmatic copper fluid arrives", event_copper_injection),
        Event(45, "Molybdenum Pulse", "Late-stage Mo fluid (Seo et al. 2012)", event_molybdenum_pulse),
        Event(60, "Second Cu Pulse", "Another copper surge", event_copper_injection),
        Event(85, "Oxidation", "Meteoric water infiltrates", event_oxidation),
        Event(95, "Cooling", "Rapid cooling event", event_cooling_pulse),
    ]
    return conditions, events, 120


def scenario_reactive_wall() -> Tuple[VugConditions, List[Event], int]:
    """Reactive wall scenario — acid pulses dissolve limestone, feed crystal growth.
    
    Professor's insight: acid entering a carbonate vug doesn't just dissolve crystals —
    it dissolves the WALL. The wall neutralizes the acid AND releases Ca²⁺/CO₃²⁻ 
    back into solution. When pH recovers, that dissolved carbonate supersaturates 
    and precipitates as rapid growth bands on existing crystals. The acid is both 
    destroyer and creator. The vug enlarges as the crystals grow.
    
    This scenario models repeated acid pulses into a limestone-hosted vug,
    showing the dissolution→supersaturation→growth burst cycle.
    """
    conditions = VugConditions(
        temperature=140.0,
        pressure=0.2,
        fluid=FluidChemistry(
            SiO2=50, Ca=250, CO3=200, Fe=8, Mn=5,
            Zn=80, S=60, F=8, pH=7.0, salinity=18.0
        ),
        wall=VugWall(
            composition="limestone",
            thickness_mm=500.0,
            vug_diameter_mm=40.0,
            wall_Fe_ppm=3000.0,   # iron-bearing limestone
            wall_Mn_ppm=800.0,    # Mn in the host rock
        )
    )
    
    def acid_pulse_1(cond):
        """First acid pulse — CO₂-rich brine from depth."""
        cond.fluid.pH = 3.5
        cond.fluid.S += 40.0
        cond.fluid.Zn += 60.0
        cond.fluid.Fe += 15.0
        cond.flow_rate = 4.0
        return ("CO₂-saturated brine surges into the vug. pH crashes to 3.5. "
                "The limestone walls begin to fizz — carbonate dissolving on contact.")
    
    def acid_pulse_2(cond):
        """Second acid pulse — stronger, with metals."""
        cond.fluid.pH = 3.0
        cond.fluid.S += 50.0
        cond.fluid.Zn += 80.0
        cond.fluid.Fe += 25.0
        cond.fluid.Mn += 10.0
        cond.flow_rate = 5.0
        return ("Second acid pulse — stronger than the first. pH drops to 3.0. "
                "Metal-bearing brine floods the vug. The walls are being eaten alive, "
                "but every Ca²⁺ released is a future growth band waiting to happen.")
    
    def acid_pulse_3(cond):
        """Third, weaker pulse — system running out of steam."""
        cond.fluid.pH = 4.0
        cond.fluid.S += 20.0
        cond.fluid.Zn += 30.0
        cond.flow_rate = 3.0
        return ("Third acid pulse — weaker now. pH only drops to 4.0. "
                "The fluid system is exhausting. But the wall still has carbonate to give.")
    
    def seal_event(cond):
        """Fracture seals — fluid stops flowing, final equilibration."""
        cond.flow_rate = 0.1
        cond.fluid.pH += 0.5
        cond.fluid.pH = min(cond.fluid.pH, 8.0)
        return ("The feeding fracture seals. Flow stops. The vug becomes a closed system. "
                "Whatever's dissolved will precipitate until equilibrium.")
    
    events = [
        Event(15, "First Acid Pulse", "CO₂-saturated brine", 
              Event(0, "", "", acid_pulse_1).apply_fn if False else acid_pulse_1),
        Event(40, "Second Acid Pulse", "Stronger metal-bearing brine", acid_pulse_2),
        Event(70, "Third Acid Pulse", "Weakening system", acid_pulse_3),
        Event(90, "Fracture Seal", "Flow stops", seal_event),
    ]
    
    # Fix event wrapping
    events = [
        Event(15, "First Acid Pulse", "CO₂-saturated brine", acid_pulse_1),
        Event(40, "Second Acid Pulse", "Stronger metal-bearing brine", acid_pulse_2),
        Event(70, "Third Acid Pulse", "Weakening system", acid_pulse_3),
        Event(90, "Fracture Seal", "Flow stops", seal_event),
    ]
    
    return conditions, events, 120


SCENARIOS = {
    "cooling": scenario_cooling,
    "pulse": scenario_pulse,
    "mvt": scenario_mvt,
    "porphyry": scenario_porphyry,
    "reactive_wall": scenario_reactive_wall,
}


# ============================================================
# SIMULATION ENGINE
# ============================================================

class VugSimulator:
    """The main simulation engine."""
    
    def __init__(self, conditions: VugConditions, events: List[Event] = None):
        self.conditions = conditions
        self.events = sorted(events or [], key=lambda e: e.step)
        self.crystals: List[Crystal] = []
        self.crystal_counter = 0
        self.step = 0
        self.log: List[str] = []
    
    def nucleate(self, mineral: str, position: str = "vug wall") -> Crystal:
        """Nucleate a new crystal."""
        self.crystal_counter += 1
        crystal = Crystal(
            mineral=mineral,
            crystal_id=self.crystal_counter,
            nucleation_step=self.step,
            nucleation_temp=self.conditions.temperature,
            position=position
        )
        if mineral == "quartz":
            crystal.habit = "prismatic"
            crystal.dominant_forms = ["m{100} prism", "r{101} rhombohedron"]
        elif mineral == "calcite":
            crystal.habit = "rhombohedral"
            crystal.dominant_forms = ["e{104} rhombohedron"]
        elif mineral == "sphalerite":
            crystal.habit = "tetrahedral"
            crystal.dominant_forms = ["{111} tetrahedron"]
        elif mineral == "fluorite":
            crystal.habit = "cubic"
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "pyrite":
            crystal.habit = "cubic"
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "chalcopyrite":
            crystal.habit = "disphenoidal"
            crystal.dominant_forms = ["{112} disphenoid"]
        elif mineral == "hematite":
            crystal.habit = "specular"
            crystal.dominant_forms = ["{001} basal plates"]
        elif mineral == "malachite":
            crystal.habit = "botryoidal"
            crystal.dominant_forms = ["botryoidal masses"]
        elif mineral == "galena":
            crystal.habit = "cubic"
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "smithsonite":
            crystal.habit = "botryoidal"
            crystal.dominant_forms = ["botryoidal masses", "{101̅4} scalenohedra"]
        elif mineral == "wulfenite":
            crystal.habit = "tabular"
            crystal.dominant_forms = ["{001} thin square plates"]
        elif mineral == "selenite":
            crystal.habit = "tabular"
            crystal.dominant_forms = ["{010} plates", "swallow-tail twins"]
        elif mineral == "feldspar":
            crystal.habit = "prismatic"
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "Carlsbad twin"]
        elif mineral == "albite":
            crystal.habit = "prismatic"
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "albite twin"]
        elif mineral == "uraninite":
            crystal.habit = "massive"
            crystal.dominant_forms = ["massive pitchy aggregates"]
        elif mineral == "goethite":
            crystal.habit = "botryoidal"
            crystal.dominant_forms = ["botryoidal masses", "velvety surface"]
        elif mineral == "molybdenite":
            crystal.habit = "platy"
            crystal.dominant_forms = ["{0001} basal plates", "hexagonal outline"]
        self.crystals.append(crystal)
        return crystal
    
    def check_nucleation(self):
        """Check if new crystals should nucleate."""
        # Quartz nucleation
        sigma_q = self.conditions.supersaturation_quartz()
        all_quartz = [c for c in self.crystals if c.mineral == "quartz"]
        existing_quartz = [c for c in all_quartz if c.active]
        if sigma_q > 1.2 and len(all_quartz) < 3:
            if not existing_quartz or (sigma_q > 2.0 and random.random() < 0.3):
                c = self.nucleate("quartz")
                self.log.append(f"  ✦ NUCLEATION: Quartz #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_q:.2f})")
        
        # Calcite nucleation  
        sigma_c = self.conditions.supersaturation_calcite()
        existing_calcite = [c for c in self.crystals if c.mineral == "calcite" and c.active]
        if sigma_c > 1.3 and not existing_calcite:
            c = self.nucleate("calcite")
            self.log.append(f"  ✦ NUCLEATION: Calcite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_c:.2f})")
        
        # Sphalerite nucleation
        sigma_s = self.conditions.supersaturation_sphalerite()
        existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
        if sigma_s > 1.0 and not existing_sph:
            c = self.nucleate("sphalerite", position="vug wall")
            self.log.append(f"  ✦ NUCLEATION: Sphalerite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_s:.2f})")
        
        # Fluorite nucleation
        sigma_f = self.conditions.supersaturation_fluorite()
        existing_fl = [c for c in self.crystals if c.mineral == "fluorite" and c.active]
        if sigma_f > 1.2 and not existing_fl:
            c = self.nucleate("fluorite", position="vug wall")
            self.log.append(f"  ✦ NUCLEATION: Fluorite #{c.crystal_id} on {c.position}")
        
        # Pyrite nucleation (limit to 3 — microcrystalline swarms aren't interesting individually)
        sigma_py = self.conditions.supersaturation_pyrite()
        all_py = [c for c in self.crystals if c.mineral == "pyrite"]
        existing_py = [c for c in all_py if c.active]
        if sigma_py > 1.0 and not existing_py and len(all_py) < 3:
            pos = "vug wall"
            existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            if existing_sph and random.random() < 0.5:
                pos = f"on sphalerite #{existing_sph[0].crystal_id}"
            c = self.nucleate("pyrite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Pyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_py:.2f})")
        
        # Chalcopyrite nucleation
        sigma_cp = self.conditions.supersaturation_chalcopyrite()
        existing_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
        if sigma_cp > 1.0 and not existing_cp:
            pos = "vug wall"
            if existing_py and random.random() < 0.4:
                pos = f"on pyrite #{existing_py[0].crystal_id}"
            c = self.nucleate("chalcopyrite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Chalcopyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cp:.2f})")
        
        # Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
        sigma_hem = self.conditions.supersaturation_hematite()
        existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
        total_hem = len([c for c in self.crystals if c.mineral == "hematite"])
        if sigma_hem > 1.2 and not existing_hem and total_hem < 3:
            pos = "vug wall"
            # Can nucleate on existing quartz
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("hematite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Hematite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_hem:.2f})")
        
        # Malachite nucleation — needs sigma > 1.0
        sigma_mal = self.conditions.supersaturation_malachite()
        existing_mal = [c for c in self.crystals if c.mineral == "malachite" and c.active]
        total_mal = len([c for c in self.crystals if c.mineral == "malachite"])
        if sigma_mal > 1.0 and not existing_mal and total_mal < 3:
            pos = "vug wall"
            # Preference for chalcopyrite surface (classic! oxidation paragenesis)
            dissolving_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
            active_cp = [c for c in self.crystals if c.mineral == "chalcopyrite"]
            if dissolving_cp and random.random() < 0.7:
                pos = f"on chalcopyrite #{dissolving_cp[0].crystal_id}"
            elif active_cp and random.random() < 0.4:
                pos = f"on chalcopyrite #{active_cp[0].crystal_id}"
            elif existing_hem and random.random() < 0.3:
                pos = f"on hematite #{existing_hem[0].crystal_id}"
            c = self.nucleate("malachite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Malachite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mal:.2f})")
        
        # Adamite nucleation — Zn + As + O₂, low T oxidation zone
        sigma_adam = self.conditions.supersaturation_adamite()
        existing_adam = [c for c in self.crystals if c.mineral == "adamite" and c.active]
        total_adam = len([c for c in self.crystals if c.mineral == "adamite"])
        if sigma_adam > 1.0 and not existing_adam and total_adam < 4:
            pos = "vug wall"
            # Preference for limonite/goethite substrate (classic association)
            existing_goethite = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if existing_goethite and random.random() < 0.6:
                pos = f"on goethite #{existing_goethite[0].crystal_id}"
            elif existing_hem and random.random() < 0.4:
                pos = f"on hematite #{existing_hem[0].crystal_id}"
            # Nucleate multiple crystals — adamite forms sprays
            c = self.nucleate("adamite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Adamite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_adam:.2f})")
            # Second crystal often nucleates nearby — the fluorescent/non-fluorescent pair
            if sigma_adam > 1.3 and random.random() < 0.5:
                c2 = self.nucleate("adamite", position=pos)
                self.log.append(f"  ✦ NUCLEATION: Adamite #{c2.crystal_id} alongside #{c.crystal_id} "
                              f"— will one fluoresce and the other stay dark?")
        
        # Mimetite nucleation — Pb + As + Cl + O₂, oxidation zone
        sigma_mim = self.conditions.supersaturation_mimetite()
        existing_mim = [c for c in self.crystals if c.mineral == "mimetite" and c.active]
        total_mim = len([c for c in self.crystals if c.mineral == "mimetite"])
        if sigma_mim > 1.0 and not existing_mim and total_mim < 3:
            pos = "vug wall"
            # Preference for galena surface (classic! mimetite replaces/coats galena)
            existing_galena = [c for c in self.crystals if c.mineral == "galena"]
            if existing_galena and random.random() < 0.6:
                pos = f"on galena #{existing_galena[0].crystal_id}"
            elif existing_goethite and random.random() < 0.3:
                pos = f"on goethite #{existing_goethite[0].crystal_id}"
            c = self.nucleate("mimetite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Mimetite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mim:.2f})")
        
        # Feldspar nucleation — K-feldspar (orthoclase/microcline/sanidine)
        # Needs high T, limits to 2 crystals
        sigma_fsp = self.conditions.supersaturation_feldspar()
        all_fsp = [c for c in self.crystals if c.mineral == "feldspar"]
        existing_fsp = [c for c in all_fsp if c.active]
        if sigma_fsp > 1.0 and not existing_fsp and len(all_fsp) < 2:
            pos = "vug wall"
            # Feldspar can nucleate on quartz — common in pegmatites
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("feldspar", position=pos)
            self.log.append(f"  ✦ NUCLEATION: K-feldspar #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_fsp:.2f})")
        
        # Albite nucleation — Na-feldspar
        # Can coexist with K-feldspar (perthite pair)
        sigma_ab = self.conditions.supersaturation_albite()
        all_ab = [c for c in self.crystals if c.mineral == "albite"]
        existing_ab = [c for c in all_ab if c.active]
        if sigma_ab > 1.0 and not existing_ab and len(all_ab) < 2:
            pos = "vug wall"
            # Albite often nucleates on feldspar — the perthite association
            if existing_fsp and random.random() < 0.5:
                pos = f"on feldspar #{existing_fsp[0].crystal_id}"
            elif existing_quartz and random.random() < 0.3:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("albite", position=pos)
            self.log.append(f"  ✦ NUCLEATION: Albite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ab:.2f})")

        # Molybdenite nucleation (rare — porphyry systems don't flood the vug)
        sigma_mol = self.conditions.supersaturation_molybdenite()
        existing_mol = len([c for c in self.crystals if c.mineral == "molybdenite"])
        if sigma_mol > 2.0 and existing_mol < 3:
            if random.random() < 0.08:
                c = self.nucleate("molybdenite", position="vug wall")
                self.log.append(f"  ✦ NUCLEATION: Molybdenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mol:.2f})")

        # Galena nucleation
        sigma_gal = self.conditions.supersaturation_galena()
        existing_gal = len([c for c in self.crystals if c.mineral == "galena"])
        if sigma_gal > 1.5 and existing_gal < 4:
            if random.random() < 0.12:
                c = self.nucleate("galena", position="vug wall")
                self.log.append(f"  ✦ NUCLEATION: Galena #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_gal:.2f})")

        # Wulfenite nucleation — needs both Pb AND Mo oxidized (late-stage)
        sigma_wul = self.conditions.supersaturation_wulfenite()
        if sigma_wul > 1.3:
            if random.random() < 0.15:
                c = self.nucleate("wulfenite", position="vug wall")
                self.log.append(f"  ✦ NUCLEATION: Wulfenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_wul:.2f})")

    def apply_events(self):
        """Apply any events scheduled for this step."""
        for event in self.events:
            if event.step == self.step:
                result = event.apply_fn(self.conditions)
                self.log.append(f"\n  ⚡ EVENT: {event.name}")
                self.log.append(f"     {result}")
                self.log.append("")
    
    def ambient_cooling(self, rate: float = 1.5):
        """Default ambient cooling per step."""
        self.conditions.temperature -= rate * random.uniform(0.8, 1.2)
        self.conditions.temperature = max(self.conditions.temperature, 25)
        
        # pH recovery toward carbonate-buffered equilibrium when not being actively acidified
        # This is the "resting state" between acid pulses — pH drifts back toward neutral
        if self.conditions.fluid.pH < 6.5 and self.conditions.flow_rate < 2.0:
            self.conditions.fluid.pH += 0.1  # gradual recovery from wall buffering
        
        # Flow rate decays toward normal
        if self.conditions.flow_rate > 1.0:
            self.conditions.flow_rate *= 0.9
        
        # Slight fluid evolution — elements deplete as minerals grow
        active_quartz = [c for c in self.crystals if c.mineral == "quartz" and c.active]
        if active_quartz:
            depletion = sum(c.zones[-1].thickness_um if c.zones else 0 for c in active_quartz) * 0.1
            self.conditions.fluid.SiO2 = max(self.conditions.fluid.SiO2 - depletion, 10)
        
        # Sulfide growth depletes Fe, S, Cu, Zn
        active_sulfides = [c for c in self.crystals if c.mineral in ("pyrite", "chalcopyrite", "sphalerite") and c.active]
        for c in active_sulfides:
            if c.zones:
                dep = c.zones[-1].thickness_um * 0.05
                self.conditions.fluid.S = max(self.conditions.fluid.S - dep, 0)
                self.conditions.fluid.Fe = max(self.conditions.fluid.Fe - dep * 0.5, 0)
                if c.mineral == "chalcopyrite":
                    self.conditions.fluid.Cu = max(self.conditions.fluid.Cu - dep * 0.8, 0)
                if c.mineral == "sphalerite":
                    self.conditions.fluid.Zn = max(self.conditions.fluid.Zn - dep * 0.8, 0)
    
    def check_enclosure(self):
        """Check if growing crystals have enclosed smaller crystals.
        
        This is the Sweetwater mechanism: pyrite forms first, then calcite 
        grows around it. The pyrite ends up INSIDE the calcite — not because 
        it grew there, but because the calcite swallowed it.
        
        Rule: if crystal A is growing and crystal B is:
          1. Smaller than A
          2. Positioned on the same surface or on A itself
          3. Crystal B has stopped growing (inactive or very slow)
        Then A can enclose B.
        """
        for grower in self.crystals:
            if not grower.active or grower.c_length_mm < 0.5:
                continue
            if grower.enclosed_by is not None:
                continue  # already enclosed itself
            
            for candidate in self.crystals:
                if candidate.crystal_id == grower.crystal_id:
                    continue
                if candidate.enclosed_by is not None:
                    continue  # already enclosed
                if candidate.crystal_id in grower.enclosed_crystals:
                    continue  # already swallowed this one
                
                # Can this grower enclose this candidate?
                # Conditions: grower must be significantly larger
                # and candidate must be adjacent (same position, or on grower)
                size_ratio = grower.c_length_mm / max(candidate.c_length_mm, 0.001)
                
                adjacent = (
                    candidate.position == grower.position or  # same wall
                    f"#{grower.crystal_id}" in candidate.position or  # candidate is ON grower
                    grower.position == candidate.position  # same spot
                )
                
                # Candidate should be relatively inactive (slow/stopped growth)
                candidate_slowing = True
                if candidate.zones and len(candidate.zones) >= 3:
                    recent_growth = sum(z.thickness_um for z in candidate.zones[-3:])
                    candidate_slowing = recent_growth < 3.0  # barely growing
                
                if size_ratio > 3.0 and adjacent and candidate_slowing:
                    # Enclosure event!
                    grower.enclosed_crystals.append(candidate.crystal_id)
                    grower.enclosed_at_step.append(self.step)
                    candidate.enclosed_by = grower.crystal_id
                    candidate.active = False  # can't grow once enclosed
                    
                    self.log.append(
                        f"  💎 ENCLOSURE: {grower.mineral.capitalize()} #{grower.crystal_id} "
                        f"({grower.c_length_mm:.1f}mm) has grown around "
                        f"{candidate.mineral} #{candidate.crystal_id} ({candidate.c_length_mm:.2f}mm). "
                        f"The {candidate.mineral} is now an inclusion inside the {grower.mineral}."
                    )
    
    def check_liberation(self):
        """Check if dissolution has freed enclosed crystals.
        
        When a host crystal dissolves back past the point where it 
        enclosed something, the inclusion is freed. The pyrite that was 
        trapped inside calcite is exposed again when acid eats the calcite.
        
        Track enclosure by the host's size at enclosure time. If the host
        dissolves below that size, the inclusion is liberated.
        """
        for host in self.crystals:
            if not host.enclosed_crystals:
                continue
            if not host.dissolved:
                continue  # only check hosts that are actively dissolving
            
            # Check each enclosed crystal — was it enclosed when host was bigger?
            freed = []
            for i, (enc_id, enc_step) in enumerate(zip(host.enclosed_crystals, host.enclosed_at_step)):
                enc_crystal = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                if not enc_crystal:
                    continue
                
                # Estimate host size at enclosure time
                # Find the zone closest to enc_step
                host_size_at_enc = 0
                for z in host.zones:
                    if z.step <= enc_step:
                        host_size_at_enc += z.thickness_um
                
                # If host has dissolved back past the enclosure size, free the crystal
                if host.total_growth_um < host_size_at_enc * 0.7:
                    freed.append(i)
                    enc_crystal.enclosed_by = None
                    enc_crystal.active = True  # can grow again!
                    self.log.append(
                        f"  🔓 LIBERATION: {enc_crystal.mineral} #{enc_id} freed from "
                        f"dissolving {host.mineral} #{host.crystal_id}! "
                        f"The inclusion is exposed again and can resume growth."
                    )
            
            # Remove freed crystals from enclosure list (reverse order to preserve indices)
            for i in sorted(freed, reverse=True):
                host.enclosed_crystals.pop(i)
                host.enclosed_at_step.pop(i)
    
    def check_liberation(self):
        """Check if dissolution of a host crystal frees enclosed inclusions.
        
        Professor's insight: if you track enclosures, you need to track
        liberation too. When the enclosing crystal dissolves back past
        the point where it swallowed the inclusion, the inclusion is freed
        and can resume growing. The outer enclosures dissolve first —
        last in, first out.
        """
        for host in self.crystals:
            if not host.enclosed_crystals:
                continue
            if not host.dissolved:
                continue
            
            # Check if dissolution has eaten back enough to free inclusions
            # Compare current size to size at time of enclosure
            # Liberation happens when the host shrinks below the size it was
            # when it swallowed the inclusion
            to_free = []
            for enc_id, enc_step in zip(host.enclosed_crystals, host.enclosed_at_step):
                # Estimate host size at enclosure time
                # (sum of growth up to that step)
                size_at_enclosure = 0
                for z in host.zones:
                    if z.step <= enc_step:
                        size_at_enclosure += z.thickness_um
                
                # If host has dissolved back past enclosure size, free the inclusion
                if host.total_growth_um < size_at_enclosure * 0.8:  # 80% threshold
                    to_free.append(enc_id)
            
            for enc_id in to_free:
                enc_crystal = next((c for c in self.crystals if c.crystal_id == enc_id), None)
                if enc_crystal:
                    enc_crystal.enclosed_by = None
                    enc_crystal.active = True  # can grow again!
                    
                    # Remove from host's enclosure lists (paired removal)
                    if enc_id in host.enclosed_crystals:
                        idx = host.enclosed_crystals.index(enc_id)
                        host.enclosed_crystals.pop(idx)
                        if idx < len(host.enclosed_at_step):
                            host.enclosed_at_step.pop(idx)
                    
                    self.log.append(
                        f"  🔓 LIBERATION: {enc_crystal.mineral} #{enc_id} freed from "
                        f"dissolving {host.mineral} #{host.crystal_id}! "
                        f"The {enc_crystal.mineral} can grow again."
                    )
    
    def dissolve_wall(self):
        """Check if acid conditions are dissolving the vug wall.
        
        This is the key feedback loop Professor identified:
        Acid enters → dissolves carbonate wall → neutralizes acid + 
        releases Ca²⁺/CO₃²⁻ → supersaturates fluid → rapid crystal growth.
        The vug enlarges as its crystals grow. The room makes the furniture.
        """
        wall = self.conditions.wall
        
        # Only dissolve if pH is acidic enough to attack carbonate
        if self.conditions.fluid.pH >= 5.5:
            return
        
        acid_strength = 5.5 - self.conditions.fluid.pH  # 0 to ~3.5
        
        # Record pre-dissolution supersaturation for comparison
        pre_sigma_cal = self.conditions.supersaturation_calcite()
        pre_Ca = self.conditions.fluid.Ca
        
        result = wall.dissolve(acid_strength, self.conditions.fluid)
        
        if result["dissolved"]:
            post_sigma_cal = self.conditions.supersaturation_calcite()
            
            self.log.append(f"  🧱 WALL DISSOLUTION: {result['rate_mm']:.2f} mm of {wall.composition} dissolved")
            self.log.append(f"     pH {result['ph_before']:.1f} → {result['ph_after']:.1f} (carbonate buffering)")
            self.log.append(f"     Released: Ca²⁺ +{result['ca_released']:.0f} ppm, "
                          f"CO₃²⁻ +{result['co3_released']:.0f} ppm, "
                          f"Fe +{result['fe_released']:.1f}, Mn +{result['mn_released']:.1f}")
            self.log.append(f"     Vug diameter: {result['vug_diameter']:.1f} mm "
                          f"(+{result['total_dissolved']:.1f} mm total enlargement)")
            
            # Flag the supersaturation spike if significant
            if post_sigma_cal > pre_sigma_cal * 1.3 and post_sigma_cal > 1.0:
                self.log.append(f"     ⚡ SUPERSATURATION SPIKE: σ(Cal) {pre_sigma_cal:.2f} → "
                              f"{post_sigma_cal:.2f} — rapid calcite growth expected!")
    
    def run_step(self) -> List[str]:
        """Execute one time step."""
        self.log = []
        self.step += 1
        
        # Apply events first
        self.apply_events()
        
        # Wall dissolution BEFORE crystal growth — this is the feedback loop
        # Acid attacks wall → releases Ca/CO3 → supersaturates → crystals grow fast
        self.dissolve_wall()
        
        # Check for new nucleation
        self.check_nucleation()
        
        # Grow existing crystals
        for crystal in self.crystals:
            if not crystal.active:
                continue
            
            engine = MINERAL_ENGINES.get(crystal.mineral)
            if not engine:
                continue
            
            zone = engine(crystal, self.conditions, self.step)
            if zone:
                crystal.add_zone(zone)
                if zone.thickness_um < 0:
                    self.log.append(f"  ⬇ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                                  f"DISSOLUTION {zone.note}")
                elif abs(zone.thickness_um) > 0.5:
                    self.log.append(f"  ▲ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                                  f"{crystal.describe_latest_zone()}")
        
        # Check for enclosure events — larger crystals swallowing smaller ones
        self.check_enclosure()
        
        # Check for liberation events — dissolution freeing enclosed crystals
        self.check_liberation()
        
        # Thermal decomposition — extreme heat destroys low-stability minerals
        decomp_logs = check_thermal_decomposition(self.crystals, self.conditions, self.step)
        if decomp_logs:
            self.log.extend(decomp_logs)
        
        # Ambient cooling
        self.ambient_cooling()
        
        return self.log
    
    def format_header(self) -> str:
        """Format the step header."""
        c = self.conditions
        sigma_q = c.supersaturation_quartz()
        sigma_c = c.supersaturation_calcite()
        wall_info = ""
        if c.wall.total_dissolved_mm > 0:
            wall_info = f" │ Vug: {c.wall.vug_diameter_mm:.0f}mm (+{c.wall.total_dissolved_mm:.1f})"
        header = (f"═══ Step {self.step:3d} │ "
                 f"T={c.temperature:6.1f}°C │ "
                 f"P={c.pressure:.2f} kbar │ "
                 f"pH={c.fluid.pH:.1f} │ "
                 f"σ(Qz)={sigma_q:.2f} σ(Cal)={sigma_c:.2f}"
                 f"{wall_info} │ "
                 f"Fluid: {c.fluid.describe()}")
        return header
    
    def format_summary(self) -> str:
        """Final summary of all crystals."""
        lines = ["\n" + "═" * 70]
        lines.append("FINAL VUG INVENTORY")
        lines.append("═" * 70)
        
        # Vug wall stats if dissolution occurred
        w = self.conditions.wall
        if w.total_dissolved_mm > 0:
            orig_diam = w.vug_diameter_mm - w.total_dissolved_mm * 2
            lines.append(f"\nVUG CAVITY")
            lines.append(f"  Host rock: {w.composition}")
            lines.append(f"  Original diameter: {orig_diam:.0f} mm")
            lines.append(f"  Final diameter: {w.vug_diameter_mm:.0f} mm")
            lines.append(f"  Total wall dissolved: {w.total_dissolved_mm:.1f} mm")
            lines.append(f"  The acid made the room. The room grew the crystals.")
        
        for c in self.crystals:
            lines.append(f"\n{c.mineral.upper()} #{c.crystal_id}")
            lines.append(f"  Nucleated: step {c.nucleation_step} at {c.nucleation_temp:.0f}°C")
            lines.append(f"  Position: {c.position}")
            lines.append(f"  Morphology: {c.describe_morphology()}")
            lines.append(f"  Growth zones: {len(c.zones)}")
            lines.append(f"  Total growth: {c.total_growth_um:.0f} µm ({c.c_length_mm:.1f} mm)")
            
            # Fluid inclusions
            fi_count = sum(1 for z in c.zones if z.fluid_inclusion)
            if fi_count:
                fi_types = set(z.inclusion_type for z in c.zones if z.fluid_inclusion)
                lines.append(f"  Fluid inclusions: {fi_count} ({', '.join(fi_types)})")
            
            if c.twinned:
                lines.append(f"  Twinning: {c.twin_law}")
            
            if c.dissolved:
                lines.append(f"  Note: partially dissolved (late-stage undersaturation)")
            
            # Phantom surfaces
            if c.phantom_count > 0:
                lines.append(f"  Phantom boundaries: {c.phantom_count} (dissolution surfaces preserved inside crystal)")
            
            # Enclosure — batch by mineral type
            if c.enclosed_crystals:
                enc_by_mineral = {}
                for enc_id, enc_step in zip(c.enclosed_crystals, c.enclosed_at_step):
                    enc_crystal = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                    if enc_crystal:
                        enc_by_mineral.setdefault(enc_crystal.mineral, []).append(
                            (enc_crystal, enc_step))
                for mineral, group in enc_by_mineral.items():
                    if len(group) <= 2:
                        for enc_crystal, enc_step in group:
                            lines.append(f"  Enclosed: {mineral} #{enc_crystal.crystal_id} "
                                       f"({enc_crystal.c_length_mm:.2f}mm) at step {enc_step}")
                    else:
                        steps = [s for _, s in group]
                        lines.append(f"  Enclosed: {len(group)} {mineral} inclusions "
                                   f"(steps {min(steps)}-{max(steps)})")
            if c.enclosed_by is not None:
                encloser = next((x for x in self.crystals if x.crystal_id == c.enclosed_by), None)
                if encloser:
                    lines.append(f"  ⚠ Now an inclusion inside {encloser.mineral} #{c.enclosed_by}")
            
            # Provenance (for calcite with wall dissolution)
            if c.mineral == "calcite" and c.zones:
                wall_zones = [z for z in c.zones if z.ca_from_wall > 0.1]
                if wall_zones:
                    avg_wall = sum(z.ca_from_wall for z in wall_zones) / len(wall_zones)
                    max_wall = max(z.ca_from_wall for z in wall_zones)
                    lines.append(f"  Provenance: {len(wall_zones)}/{len(c.zones)} zones contain wall-derived Ca²⁺")
                    lines.append(f"    Average wall contribution: {avg_wall*100:.0f}%, peak: {max_wall*100:.0f}%")
                    # Find the transition
                    first_wall_zone = next((z for z in c.zones if z.ca_from_wall > 0.1), None)
                    if first_wall_zone:
                        lines.append(f"    Wall-derived Ca first appears at step {first_wall_zone.step} "
                                   f"(T={first_wall_zone.temperature:.0f}°C)")
            
            # Color prediction
            color = c.predict_color()
            if color != "typical for species":
                lines.append(f"  Color: {color}")
            
            # Fluorescence prediction
            fl = c.predict_fluorescence()
            if fl != "non-fluorescent":
                lines.append(f"  Predicted UV fluorescence: {fl}")
            
            # Temperature range from zones
            if c.zones:
                temps = [z.temperature for z in c.zones]
                lines.append(f"  Growth temperature range: {min(temps):.0f}–{max(temps):.0f}°C")
                
                # Ti-in-quartz geothermometer
                if c.mineral == "quartz":
                    ti_vals = [z.trace_Ti for z in c.zones if z.trace_Ti > 0]
                    if ti_vals:
                        avg_ti = sum(ti_vals) / len(ti_vals)
                        lines.append(f"  Avg Ti-in-quartz: {avg_ti:.3f} ppm "
                                   f"(TitaniQ range: {min(temps):.0f}–{max(temps):.0f}°C)")
        
        lines.append("\n" + "═" * 70)
        
        # Add narrative summary
        narrative = self.narrate()
        if narrative:
            lines.append("\nGEOLOGICAL HISTORY")
            lines.append("─" * 70)
            lines.append(narrative)
            lines.append("═" * 70)
        
        return "\n".join(lines)
    
    def narrate(self) -> str:
        """Generate a legends-mode narrative of the vug's history."""
        if not self.crystals:
            return "The vug remained empty. No minerals precipitated under these conditions."
        
        paragraphs = []
        
        # Opening — what kind of vug is this?
        first_crystal = self.crystals[0]
        start_T = first_crystal.nucleation_temp
        mineral_names = list(set(c.mineral for c in self.crystals))
        
        if start_T > 300:
            setting = "deep hydrothermal"
        elif start_T > 150:
            setting = "moderate-temperature hydrothermal"
        else:
            setting = "low-temperature"
        
        vug_growth = ""
        if self.conditions.wall.total_dissolved_mm > 0:
            vug_growth = (
                f" The cavity itself expanded from {self.conditions.wall.vug_diameter_mm - self.conditions.wall.total_dissolved_mm * 2:.0f}mm "
                f"to {self.conditions.wall.vug_diameter_mm:.0f}mm diameter as acid pulses "
                f"dissolved {self.conditions.wall.total_dissolved_mm:.1f}mm of the "
                f"{self.conditions.wall.composition} host rock."
            )
        
        paragraphs.append(
            f"This vug records a {setting} crystallization history beginning at "
            f"{start_T:.0f}°C. {len(self.crystals)} crystals grew across "
            f"{self.step} time steps, producing an assemblage of "
            f"{', '.join(mineral_names)}.{vug_growth}"
        )
        
        # Tell the story phase by phase
        # Phase 1: first mineral(s) to nucleate
        first_step = min(c.nucleation_step for c in self.crystals)
        first_minerals = [c for c in self.crystals if c.nucleation_step == first_step]
        
        for c in first_minerals:
            if c.mineral == "calcite":
                paragraphs.append(
                    f"Calcite was the first mineral to crystallize, nucleating on the "
                    f"vug wall at {c.nucleation_temp:.0f}°C. "
                    + self._narrate_calcite(c)
                )
            elif c.mineral == "quartz":
                paragraphs.append(
                    f"Quartz nucleated first at {c.nucleation_temp:.0f}°C on the vug wall. "
                    + self._narrate_quartz(c)
                )
            else:
                paragraphs.append(
                    f"{c.mineral.capitalize()} nucleated at {c.nucleation_temp:.0f}°C.")
        
        # Subsequent minerals — what triggered them?
        later_crystals = [c for c in self.crystals if c.nucleation_step > first_step]
        if later_crystals:
            # Group by nucleation step
            nuc_steps = sorted(set(c.nucleation_step for c in later_crystals))
            for ns in nuc_steps:
                batch = [c for c in later_crystals if c.nucleation_step == ns]
                batch_names = [c.mineral for c in batch]
                
                # Check if an event triggered this
                triggering_event = None
                for e in self.events:
                    if abs(e.step - ns) <= 2:
                        triggering_event = e
                        break
                
                if triggering_event:
                    if "mixing" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A fluid mixing event at step {triggering_event.step} transformed "
                            f"the vug's chemistry. "
                            + self._narrate_mixing_event(batch, triggering_event)
                        )
                    elif "pulse" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A fresh pulse of hydrothermal fluid at step {triggering_event.step} "
                            f"introduced new chemistry. {', '.join(c.capitalize() for c in set(batch_names))} "
                            f"nucleated in response."
                        )
                    elif "tectonic" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A tectonic event at step {triggering_event.step} produced a "
                            f"pressure spike." + self._narrate_tectonic(batch)
                        )
                else:
                    paragraphs.append(
                        f"As temperature continued to fall, "
                        f"{' and '.join(set(batch_names))} nucleated at step {ns} "
                        f"({batch[0].nucleation_temp:.0f}°C)."
                    )
        
        # Narrate individual crystal stories for the larger ones
        significant = [c for c in self.crystals if c.total_growth_um > 100]
        for c in significant:
            if c.mineral == "quartz":
                story = self._narrate_quartz(c)
            elif c.mineral == "calcite":
                story = self._narrate_calcite(c)
            elif c.mineral == "sphalerite":
                story = self._narrate_sphalerite(c)
            elif c.mineral == "fluorite":
                story = self._narrate_fluorite(c)
            elif c.mineral == "pyrite":
                story = self._narrate_pyrite(c)
            elif c.mineral == "chalcopyrite":
                story = self._narrate_chalcopyrite(c)
            elif c.mineral == "hematite":
                story = self._narrate_hematite(c)
            elif c.mineral == "malachite":
                story = self._narrate_malachite(c)
            else:
                story = ""
            if story and c not in first_minerals:
                paragraphs.append(story)
        
        # Enclosure events — batch by host crystal and enclosed mineral type
        enclosers = [c for c in self.crystals if c.enclosed_crystals]
        for c in enclosers:
            enclosed = []
            for enc_id in c.enclosed_crystals:
                enc = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                if enc:
                    enclosed.append(enc)
            
            if not enclosed:
                continue
            
            # Group by mineral type
            by_mineral = {}
            for enc in enclosed:
                by_mineral.setdefault(enc.mineral, []).append(enc)
            
            for mineral, group in by_mineral.items():
                if len(group) == 1:
                    enc = group[0]
                    paragraphs.append(
                        f"As {c.mineral} #{c.crystal_id} continued to grow, it engulfed "
                        f"{enc.mineral} #{enc.crystal_id} ({enc.c_length_mm:.2f}mm). The "
                        f"{enc.mineral} is now an inclusion — a crystal trapped inside a crystal, "
                        f"recording the moment the {c.mineral}'s growth front overtook it."
                    )
                else:
                    sizes = [f"{e.c_length_mm:.2f}mm" for e in group]
                    paragraphs.append(
                        f"As {c.mineral} #{c.crystal_id} grew, it swallowed {len(group)} "
                        f"{mineral} crystals (sizes: {', '.join(sizes)}). These are now "
                        f"inclusions — a constellation of tiny {mineral} specks frozen "
                        f"inside the {c.mineral}, each marking where a microcrystal nucleated "
                        f"and was overtaken by the larger crystal's advancing growth front."
                    )
            
            # Note any liberated crystals
            freed = [x for x in self.crystals if x.enclosed_by is None and x.active 
                     and any(x.crystal_id not in c.enclosed_crystals for c2 in enclosers)]
            # (liberation is handled in the log, not the narrative — events are ephemeral)
        
        # Phantom growth narrative
        phantom_crystals = [c for c in self.crystals if c.phantom_count > 0]
        for c in phantom_crystals:
            if c.phantom_count >= 2:
                paragraphs.append(
                    f"{c.mineral.capitalize()} #{c.crystal_id} shows {c.phantom_count} phantom "
                    f"boundaries — internal surfaces where acid dissolved the crystal before "
                    f"new growth covered the damage. Each phantom preserves the shape of the "
                    f"crystal at the moment the acid arrived. In a polished section, these "
                    f"appear as ghost outlines nested inside the final crystal — the crystal's "
                    f"autobiography, written in dissolution and regrowth."
                )
            elif c.phantom_count == 1:
                paragraphs.append(
                    f"{c.mineral.capitalize()} #{c.crystal_id} contains a single phantom surface — "
                    f"a dissolution boundary where the crystal was partially eaten and then "
                    f"regrew over the wound. The phantom preserves the crystal's earlier shape "
                    f"as a ghost outline inside the final form."
                )
        
        # Provenance narrative for calcite
        for c in self.crystals:
            if c.mineral == "calcite" and c.zones:
                wall_zones = [z for z in c.zones if z.ca_from_wall > 0.3]
                fluid_zones = [z for z in c.zones if z.ca_from_wall < 0.1 and z.thickness_um > 0]
                if wall_zones and fluid_zones:
                    paragraphs.append(
                        f"The calcite tells two stories in one crystal. Early growth zones "
                        f"are built from the original fluid — Ca²⁺ that traveled through the "
                        f"basin. Later zones are built from recycled wall rock — limestone that "
                        f"was dissolved by acid and reprecipitated. The trace element signature "
                        f"shifts at the boundary: wall-derived zones carry the host rock's Fe "
                        f"and Mn signature, distinct from the fluid-derived zones. A "
                        f"microprobe traverse across this crystal would show the moment the "
                        f"vug started eating itself to feed its children."
                    )
        
        # Closing — what would a collector see?
        paragraphs.append(self._narrate_collectors_view())
        
        return "\n\n".join(paragraphs)
    
    def _narrate_calcite(self, c: Crystal) -> str:
        """Narrate a calcite crystal's story."""
        parts = []
        if c.zones:
            # Check for fluorescence zoning
            mn_zones = [z for z in c.zones if z.trace_Mn > 1.0 and z.trace_Fe < 2.0]
            fe_zones = [z for z in c.zones if z.trace_Fe > 3.0]
            
            if mn_zones and fe_zones:
                mn_end = mn_zones[-1].step
                fe_start = fe_zones[0].step
                if fe_start > mn_end - 5:
                    parts.append(
                        f"Early growth zones are manganese-rich and would fluoresce "
                        f"orange under UV light. After step {fe_start}, iron flooded "
                        f"the system and quenched the fluorescence — later zones would "
                        f"appear dark under cathodoluminescence. The boundary between "
                        f"glowing and dark records the moment the fluid chemistry changed."
                    )
            elif mn_zones:
                parts.append(
                    f"The crystal incorporated manganese throughout growth and would "
                    f"fluoresce orange under shortwave UV — a classic Mn²⁺-activated "
                    f"calcite."
                )
        
        if c.twinned:
            parts.append(
                f"The crystal is twinned on {c.twin_law}, a common deformation twin "
                f"in calcite that can form during growth or post-crystallization stress."
            )
        
        size_desc = "microscopic" if c.c_length_mm < 0.5 else "small" if c.c_length_mm < 2 else "well-developed"
        parts.append(f"Final size: {size_desc} ({c.c_length_mm:.1f} mm), {c.habit} habit.")
        
        return " ".join(parts)
    
    def _narrate_quartz(self, c: Crystal) -> str:
        """Narrate a quartz crystal's story."""
        parts = []
        
        if not c.zones:
            return f"Quartz #{c.crystal_id} nucleated but failed to develop — growth kinetics were too slow at {c.nucleation_temp:.0f}°C."
        
        # Check for Ti variation (geothermometer)
        if c.zones:
            ti_vals = [z.trace_Ti for z in c.zones if z.trace_Ti > 0]
            if ti_vals and max(ti_vals) > 0.01:
                parts.append(
                    f"Titanium incorporation decreases through the growth zones from "
                    f"{max(ti_vals):.3f} to {min(ti_vals):.3f} ppm, recording the cooling "
                    f"history via the TitaniQ geothermometer."
                )
        
        # Fluid inclusions
        fi_zones = [z for z in c.zones if z.fluid_inclusion]
        if fi_zones:
            fi_types = set(z.inclusion_type for z in fi_zones)
            parts.append(
                f"The crystal trapped {len(fi_zones)} fluid inclusions ({', '.join(fi_types)}), "
                f"preserving samples of the parent fluid at the moment of entrapment."
            )
        
        # Twinning
        if c.twinned:
            parts.append(
                f"A {c.twin_law} twin formed during growth — likely triggered by a "
                f"thermal shock event that introduced a rotational domain boundary."
            )
        
        # Growth character
        fast_zones = [z for z in c.zones if z.growth_rate > 15]
        slow_zones = [z for z in c.zones if 0 < z.growth_rate < 2]
        if fast_zones and slow_zones:
            parts.append(
                f"Growth alternated between rapid pulses (up to {max(z.growth_rate for z in fast_zones):.0f} µm/step, "
                f"producing growth hillocks) and slow, high-quality periods near equilibrium. "
                f"This oscillation would be visible as alternating clear and milky zones."
            )
        
        size_desc = "microscopic" if c.c_length_mm < 0.5 else "thumbnail" if c.c_length_mm < 5 else "cabinet-sized"
        parts.append(f"Final size: {size_desc} ({c.c_length_mm:.1f} × {c.a_width_mm:.1f} mm).")
        
        return " ".join(parts)
    
    def _narrate_sphalerite(self, c: Crystal) -> str:
        """Narrate a sphalerite crystal's story."""
        parts = [f"Sphalerite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        
        if c.zones:
            fe_vals = [z.trace_Fe for z in c.zones if z.trace_Fe > 0]
            if fe_vals:
                max_fe = max(fe_vals)
                min_fe = min(fe_vals)
                if max_fe > min_fe * 1.5:
                    # Find the color story
                    early_fe = sum(z.trace_Fe for z in c.zones[:len(c.zones)//3]) / max(len(c.zones)//3, 1)
                    late_fe = sum(z.trace_Fe for z in c.zones[-len(c.zones)//3:]) / max(len(c.zones)//3, 1)
                    
                    if early_fe < late_fe:
                        parts.append(
                            f"Iron content increased through growth — early zones are pale "
                            f"(low Fe, cleiophane variety) grading to darker amber or brown "
                            f"as the fluid became more iron-rich. This color zoning would be "
                            f"visible in a polished cross-section."
                        )
                    else:
                        parts.append(
                            f"Iron content decreased through growth — the crystal darkened "
                            f"early (higher Fe, approaching marmatite) then cleared as iron "
                            f"was depleted from the fluid."
                        )
        
        if c.twinned:
            parts.append(
                f"Twinned on the {c.twin_law} — a common growth twin in sphalerite "
                f"that creates triangular re-entrant faces."
            )
        
        return " ".join(parts)
    
    def _narrate_fluorite(self, c: Crystal) -> str:
        """Narrate a fluorite crystal's story."""
        parts = [f"Fluorite #{c.crystal_id} grew as {c.habit} crystals to {c.c_length_mm:.1f} mm."]
        
        # Color zones
        if c.zones:
            colors = set()
            for z in c.zones:
                if z.note and "color zone:" in z.note:
                    color = z.note.split("color zone:")[1].strip()
                    colors.add(color)
            if len(colors) > 1:
                parts.append(
                    f"Color zoning present: {', '.join(colors)} zones reflecting "
                    f"changing trace element chemistry during growth."
                )
            elif colors:
                parts.append(f"Uniformly {list(colors)[0]}.")
        
        if c.twinned:
            parts.append(f"Shows {c.twin_law} twinning — two interpenetrating cubes.")
        
        fl = c.predict_fluorescence()
        if fl != "non-fluorescent":
            parts.append(f"Would show {fl} under UV excitation.")
        
        return " ".join(parts)
    
    def _narrate_pyrite(self, c: Crystal) -> str:
        """Narrate a pyrite crystal's story."""
        parts = [f"Pyrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        
        if c.habit == "framboidal":
            parts.append(
                "The low temperature produced framboidal pyrite — microscopic "
                "raspberry-shaped aggregates of tiny crystallites, a texture "
                "common in sedimentary environments."
            )
        elif c.habit == "pyritohedral":
            parts.append(
                "The crystal developed the characteristic pyritohedral habit — "
                "twelve pentagonal faces, a form unique to pyrite and one of "
                "nature's few non-crystallographic symmetries."
            )
        elif "cubic" in c.habit:
            parts.append(
                "Clean cubic habit with bright metallic luster. The striations "
                "on each cube face (perpendicular on adjacent faces) are the "
                "fingerprint of pyrite's lower symmetry disguised as cubic."
            )
        
        if c.twinned:
            parts.append(
                f"Twinned as an {c.twin_law} — two crystals interpenetrating at "
                f"90°, one of the most recognizable twin forms in mineralogy."
            )
        
        if c.dissolved:
            parts.append(
                "Late-stage oxidation attacked the pyrite — in nature this would "
                "produce a limonite/goethite boxwork pseudomorph, the rusty ghost "
                "of the original crystal."
            )
        
        return " ".join(parts)
    
    def _narrate_chalcopyrite(self, c: Crystal) -> str:
        """Narrate a chalcopyrite crystal's story."""
        parts = [f"Chalcopyrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        
        parts.append(
            "Brassy yellow with a greenish tint — distinguishable from pyrite by "
            "its deeper color and softer hardness (3.5 vs 6). The disphenoidal "
            "crystals often look tetrahedral, a common misidentification."
        )
        
        if c.twinned:
            parts.append(
                f"Shows {c.twin_law} twinning — repeated twins create "
                f"spinel-like star shapes."
            )
        
        if c.dissolved:
            parts.append(
                "Oxidation began converting the chalcopyrite — at the surface, this "
                "weathering produces malachite (green) and azurite (blue), the "
                "colorful signal that led ancient prospectors to copper deposits."
            )
        
        return " ".join(parts)
    
    def _narrate_hematite(self, c: Crystal) -> str:
        """Narrate a hematite crystal's story."""
        parts = [f"Hematite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        
        if c.habit == "specular":
            parts.append(
                "The high temperature produced specular hematite — brilliant metallic "
                "plates that flash like mirrors, the most sought-after habit. The thin "
                "{001} basal plates grew parallel to each other, creating the characteristic "
                "'iron rose' or 'specularite' texture."
            )
            # Check for iridescence
            if c.zones and any("iridescent" in z.note for z in c.zones):
                parts.append(
                    "Some plates are thin enough to show iridescent interference colors — "
                    "rainbow hematite, a collector favorite."
                )
        elif c.habit == "rhombohedral":
            parts.append(
                "Moderate temperatures produced rhombohedral hematite — sharp-edged "
                "crystals with {101} faces, dark metallic gray with a red streak."
            )
        elif c.habit == "botryoidal":
            parts.append(
                "Low-temperature growth produced botryoidal hematite — kidney-ore "
                "texture with smooth, rounded surfaces. Classic 'kidney iron ore' "
                "that has been mined since antiquity."
            )
        elif c.habit == "earthy/massive":
            parts.append(
                "Low supersaturation produced earthy, massive hematite — red "
                "microcrystalline aggregate. The red ochre pigment that humans have "
                "used for 100,000 years."
            )
        
        if c.twinned:
            parts.append(
                f"Shows a rare {c.twin_law} — two crystals interpenetrating "
                f"through the basal plane."
            )
        
        if c.dissolved:
            parts.append(
                "Late-stage acid attack dissolved some of the hematite, releasing "
                "iron back to the fluid."
            )
        
        return " ".join(parts)
    
    def _narrate_malachite(self, c: Crystal) -> str:
        """Narrate a malachite crystal's story."""
        parts = [f"Malachite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        
        # Check paragenesis — did it grow on chalcopyrite?
        if "chalcopyrite" in c.position:
            parts.append(
                "It nucleated directly on chalcopyrite — the classic oxidation "
                "paragenesis. As oxygenated water attacked the copper sulfide, "
                "Cu²⁺ was liberated and combined with carbonate to form malachite. "
                "This is the green stain that led ancient prospectors to copper deposits."
            )
        
        if c.habit == "banded":
            parts.append(
                "The crystal developed the famous banded texture — concentric layers "
                "of alternating light and dark green, each band recording a pulse of "
                "growth. This is the texture prized in decorative stonework since "
                "the Bronze Age, from Russian palaces to Egyptian amulets."
            )
        elif c.habit == "botryoidal":
            parts.append(
                "Botryoidal habit — smooth, rounded green masses that gleam like "
                "polished jade. Cross-sections would reveal concentric banding."
            )
        elif c.habit == "fibrous/acicular":
            parts.append(
                "Rapid growth produced fibrous, acicular malachite — sprays of "
                "needle-like green crystals radiating from nucleation points. "
                "Delicate and sparkling, a different beauty from the massive variety."
            )
        
        if c.dissolved:
            parts.append(
                "Acid attack dissolved some malachite — it fizzes in acid like "
                "calcite, releasing Cu²⁺ and CO₂. The green stain on the fingers "
                "of anyone who handles it with acidic sweat."
            )
        
        # Color summary
        color = c.predict_color()
        if color:
            parts.append(f"Color: {color}.")
        
        return " ".join(parts)
    
    def _narrate_mixing_event(self, batch: List[Crystal], event: Event) -> str:
        """Narrate what happened after a fluid mixing event."""
        mineral_names = set(c.mineral for c in batch)
        parts = []
        
        if "sphalerite" in mineral_names and "fluorite" in mineral_names:
            parts.append(
                "When metal-bearing brine met sulfur-bearing groundwater, "
                "sphalerite (ZnS) and fluorite (CaF₂) nucleated simultaneously — "
                "a classic Mississippi Valley-type precipitation event. "
                "The zinc and sulfur couldn't coexist in solution; they combined "
                "on contact and the minerals fell out of the fluid like rain."
            )
        elif "sphalerite" in mineral_names:
            parts.append(
                "Sphalerite nucleated as zinc-bearing brine mixed with sulfur-rich "
                "groundwater. The two fluids were stable apart; together, ZnS "
                "became insoluble."
            )
        
        return " ".join(parts)
    
    def _narrate_tectonic(self, batch: List[Crystal]) -> str:
        """Narrate tectonic event effects."""
        twinned = [c for c in self.crystals if c.twinned]
        if twinned:
            names = [f"{c.mineral} #{c.crystal_id}" for c in twinned]
            return (
                f" The stress may have induced twinning in {', '.join(names)}. "
                f"Twin planes formed as the crystal lattice accommodated the "
                f"sudden strain — a record of the event frozen in the structure."
            )
        return " No visible twinning resulted, but the pressure change altered subsequent growth conditions."
    
    def _narrate_collectors_view(self) -> str:
        """What would a collector see picking up this specimen?"""
        parts = ["A collector examining this specimen would find:"]
        
        for c in self.crystals:
            if c.total_growth_um < 10 and not c.zones:
                continue
            
            if c.mineral == "quartz":
                if c.c_length_mm > 2:
                    desc = f"a {c.c_length_mm:.1f}mm quartz crystal"
                    if c.twinned:
                        desc += f" ({c.twin_law} twinned)"
                    fi_count = sum(1 for z in c.zones if z.fluid_inclusion)
                    if fi_count > 3:
                        desc += f" with visible fluid inclusions"
                    parts.append(f"  • {desc}")
                elif c.c_length_mm > 0.1:
                    parts.append(f"  • tiny quartz crystals on the vug wall")
            
            elif c.mineral == "calcite":
                fl = c.predict_fluorescence()
                desc = f"a {c.c_length_mm:.1f}mm {c.habit} calcite"
                if c.twinned:
                    desc += f" (twinned)"
                if "orange" in fl:
                    desc += f" — glows orange under UV"
                elif "quenched" in fl:
                    desc += f" — patchy UV response (Mn zones glow, Fe zones dark)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "sphalerite":
                desc = f"a {c.c_length_mm:.1f}mm sphalerite"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                # Get dominant color from late zones
                if c.zones:
                    last_note = c.zones[-1].note
                    if "color:" in last_note:
                        color = last_note.split("color:")[1].split(",")[0].strip()
                        desc += f", {color}"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "fluorite":
                desc = f"a {c.c_length_mm:.1f}mm fluorite cube"
                if c.twinned:
                    desc += f" (penetration twin)"
                fl = c.predict_fluorescence()
                if fl != "non-fluorescent":
                    desc += f" — fluoresces {fl.split('(')[0].strip()}"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "pyrite":
                desc = f"a {c.c_length_mm:.1f}mm pyrite"
                if c.habit == "framboidal":
                    desc = f"framboidal pyrite aggregate"
                elif c.habit == "pyritohedral":
                    desc += f" pyritohedron"
                else:
                    desc += f" cube"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — bright metallic luster"
                if c.dissolved:
                    desc += ", partially oxidized (limonite staining)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "chalcopyrite":
                desc = f"a {c.c_length_mm:.1f}mm chalcopyrite"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — brassy yellow, greenish tint"
                if c.dissolved:
                    desc += ", oxidation rind (green Cu carbonate staining)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "hematite":
                if c.habit == "specular":
                    desc = f"a {c.c_length_mm:.1f}mm specular hematite"
                    if any("iridescent" in z.note for z in c.zones):
                        desc += " — iridescent rainbow plates"
                    else:
                        desc += " — brilliant metallic silver-black plates"
                elif c.habit == "botryoidal":
                    desc = f"a {c.c_length_mm:.1f}mm botryoidal hematite — kidney-ore, dark metallic"
                elif c.habit == "rhombohedral":
                    desc = f"a {c.c_length_mm:.1f}mm rhombohedral hematite — sharp dark crystals"
                else:
                    desc = f"earthy red hematite mass"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                if c.dissolved:
                    desc += ", partially dissolved"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "malachite":
                desc = f"a {c.c_length_mm:.1f}mm malachite"
                if c.habit == "banded":
                    desc += " — banded green, concentric layers"
                elif c.habit == "fibrous/acicular":
                    desc += " — sprays of acicular green needles"
                else:
                    desc += " — botryoidal green masses"
                color = c.predict_color()
                if "vivid" in color:
                    desc += ", vivid green"
                elif "pale" in color:
                    desc += ", pale green"
                if c.dissolved:
                    desc += ", partially dissolved (acid attack)"
                if "chalcopyrite" in c.position:
                    desc += " (growing on chalcopyrite — classic oxidation paragenesis)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "feldspar":
                desc = f"a {c.c_length_mm:.1f}mm feldspar"
                color = c.predict_color()
                if "amazonite" in color:
                    desc += " — amazonite, blue-green microcline"
                elif "moonstone" in color:
                    desc += " — moonstone with adularescence"
                elif "perthite" in color:
                    desc += " — perthite with albite stringers"
                else:
                    desc += " — flesh-colored to white"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                fl = c.predict_fluorescence()
                if "yellow-green" in fl:
                    desc += ", fluoresces yellow-green under LW UV"
                if "on quartz" in c.position:
                    desc += " (on quartz — pegmatitic texture)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "albite":
                desc = f"a {c.c_length_mm:.1f}mm albite"
                color = c.predict_color()
                if "moonstone" in color:
                    desc += " — peristerite moonstone, blue adularescence"
                elif "cleavelandite" in color:
                    desc += " — cleavelandite, platy lamellar habit"
                else:
                    desc += " — white to colorless"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                if "on feldspar" in c.position:
                    desc += " (on feldspar — perthite pair)"
                parts.append(f"  • {desc}")
        
        if len(parts) == 1:
            return "The vug produced only microscopic crystals — a thin crust on the cavity wall."
        
        return "\n".join(parts)


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='🪨 Vugg Simulator — crystal growth engine')
    parser.add_argument('--scenario', choices=list(SCENARIOS.keys()), default='cooling',
                        help='Growth scenario (default: cooling)')
    parser.add_argument('--steps', type=int, default=None,
                        help='Override number of steps')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show every step (default: show every 5th + events)')
    parser.add_argument('--summary-only', action='store_true',
                        help='Only show final summary')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed for reproducibility')
    parser.add_argument('--json', action='store_true',
                        help='Output final state as JSON')
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Interactive mode — pause between steps')
    
    args = parser.parse_args()
    
    if args.seed is not None:
        random.seed(args.seed)
    
    # Load scenario
    scenario_fn = SCENARIOS[args.scenario]
    conditions, events, default_steps = scenario_fn()
    total_steps = args.steps or default_steps
    
    print(f"🪨 Vugg Simulator — {args.scenario} scenario")
    print(f"   {total_steps} time steps, starting at {conditions.temperature:.0f}°C, {conditions.pressure:.1f} kbar")
    print(f"   Initial fluid: {conditions.fluid.describe()}")
    print(f"   Events: {len(events)}")
    for e in events:
        print(f"     Step {e.step}: {e.name}")
    print("═" * 70)
    
    sim = VugSimulator(conditions, events)
    
    for step in range(total_steps):
        log = sim.run_step()
        
        if args.summary_only:
            continue
        
        # Print logic: show every 5th step, or any step with events/nucleation/significant growth
        show = args.verbose or (step % 5 == 0) or any("EVENT" in l or "NUCLEATION" in l for l in log)
        
        if show and log:
            print(sim.format_header())
            for line in log:
                print(line)
        
        if args.interactive:
            try:
                cmd = input("\n[Enter=continue, q=quit, s=summary] > ").strip().lower()
                if cmd == 'q':
                    break
                elif cmd == 's':
                    print(sim.format_summary())
            except (EOFError, KeyboardInterrupt):
                break
    
    # Final summary
    if args.json:
        # JSON output for future frontends
        state = {
            "scenario": args.scenario,
            "steps": sim.step,
            "final_temperature": conditions.temperature,
            "crystals": []
        }
        for c in sim.crystals:
            state["crystals"].append({
                "mineral": c.mineral,
                "id": c.crystal_id,
                "habit": c.habit,
                "forms": c.dominant_forms,
                "c_mm": round(c.c_length_mm, 2),
                "a_mm": round(c.a_width_mm, 2),
                "zones": len(c.zones),
                "twinned": c.twinned,
                "twin_law": c.twin_law,
                "fluorescence": c.predict_fluorescence(),
            })
        print(json.dumps(state, indent=2))
    else:
        print(sim.format_summary())


if __name__ == '__main__':
    main()
