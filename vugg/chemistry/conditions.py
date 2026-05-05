"""VugConditions — physical/chemical state of the vug + supersaturation dispatch.

Extracted from vugg/__init__.py during PROPOSAL-MODULAR-REFACTOR Phase A5.
Houses:
  * the @dataclass with all fields (temperature, pressure, fluid, wall,
    porosity, fluid_surface_ring, ring_count, ring_fluids, …)
  * a small set of helper methods: effective_temperature, ring_water_state,
    update_dol_cycles, silica_equilibrium, _classify_water_state.

The 97 `supersaturation_<mineral>(self)` methods live next door in
vugg/chemistry/supersat/<class>.py and are pulled in via mixin
inheritance — see the class declaration below. Adding a new mineral
means adding ONE method to the right `<class>SupersatMixin`, no edit to
this file required.

Dependencies pulled in from sibling modules:
  * FluidChemistry — vugg/chemistry/fluid.py
  * VugWall — vugg/geometry/wall.py (default factory for the .wall field)
  * <Class>SupersatMixin — vugg/chemistry/supersat/<class>.py

DEHYDRATION_TRANSITIONS / PARAMORPH_TRANSITIONS / THERMAL_DECOMPOSITION
are referenced only inside docstring comments — no runtime import needed.
"""

import math
from dataclasses import dataclass, field, fields, replace
from typing import List, Optional

from .fluid import FluidChemistry
from ..geometry.wall import VugWall
from .supersat.arsenate import ArsenateSupersatMixin
from .supersat.borate import BorateSupersatMixin
from .supersat.carbonate import CarbonateSupersatMixin
from .supersat.halide import HalideSupersatMixin
from .supersat.hydroxide import HydroxideSupersatMixin
from .supersat.molybdate import MolybdateSupersatMixin
from .supersat.native import NativeSupersatMixin
from .supersat.oxide import OxideSupersatMixin
from .supersat.phosphate import PhosphateSupersatMixin
from .supersat.silicate import SilicateSupersatMixin
from .supersat.sulfate import SulfateSupersatMixin
from .supersat.sulfide import SulfideSupersatMixin


@dataclass
class VugConditions(
    ArsenateSupersatMixin,
    BorateSupersatMixin,
    CarbonateSupersatMixin,
    HalideSupersatMixin,
    HydroxideSupersatMixin,
    MolybdateSupersatMixin,
    NativeSupersatMixin,
    OxideSupersatMixin,
    PhosphateSupersatMixin,
    SilicateSupersatMixin,
    SulfateSupersatMixin,
    SulfideSupersatMixin,
):
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

    




    
    

    

    
    
    







    



















    # ------------------------------------------------------------------
    # Corundum family (Al₂O₃) — first UPPER-bound gate in the sim.
    # SiO₂ < 50 is the defining constraint: with silica present at normal
    # crustal concentrations, Al + SiO₂ drives to feldspar/mica/
    # Al₂SiO₅-polymorphs instead of corundum. Shared helper below.
    # ------------------------------------------------------------------




























































