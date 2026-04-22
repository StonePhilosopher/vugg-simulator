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
import os
import random
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


# ============================================================
# MINERAL SPEC — single source of truth
# ============================================================
# Loaded from data/minerals.json. Every mineral declares every
# template field (max_size_cm, thermal_decomp_C, fluorescence,
# twin_laws, acid_dissolution, …). Runtime code reads from here
# so that vugg.py / web/index.html / agent-api stay consistent.

_SPEC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "data", "minerals.json")
with open(_SPEC_PATH, "r", encoding="utf-8") as _f:
    _SPEC_DOC = json.load(_f)
MINERAL_SPEC: Dict[str, dict] = _SPEC_DOC["minerals"]


def spec_for(mineral: str) -> dict:
    """Return spec row for a mineral. Raises KeyError if not declared."""
    return MINERAL_SPEC[mineral]


def max_size_cm(mineral: str) -> float:
    """Hard cap on crystal size (2x world record). The fix for the 321,248% bug."""
    return MINERAL_SPEC[mineral]["max_size_cm"]


def select_habit_variant(mineral: str, sigma: float, temperature: float,
                         space_constrained: bool = False) -> Optional[dict]:
    """Pick a habit variant for a nucleating crystal based on current conditions.

    Reads habit_variants from data/minerals.json. Scores each variant by:
      - trigger keywords ("low σ" / "moderate σ" / "high σ" / "very high σ",
        and likewise for T) against the actual σ and T;
      - vector preference vs. available wall space (projecting habits
        penalized when the vug is crowded; coating habits favored).

    The top-scoring variant wins, with a tie-breaking weighted random so
    two habits that both look plausible don't always produce the same
    outcome. Returns the variant dict, or None if the mineral has no
    variants declared.
    """
    variants = MINERAL_SPEC.get(mineral, {}).get("habit_variants", [])
    variants = [v for v in variants if isinstance(v, dict)]
    if not variants:
        return None

    def score(v: dict) -> float:
        trig = (v.get("trigger") or "").lower()
        s = 1.0
        # Supersaturation bands. The spec uses "σ" so we match on unicode.
        if "very high σ" in trig:
            s += 2.0 if sigma > 4.0 else -1.5
        elif "high σ" in trig:
            s += 1.5 if sigma > 3.0 else -1.0
        elif "moderate-high σ" in trig or "moderate σ" in trig:
            s += 1.5 if 1.5 <= sigma <= 3.5 else -0.5
        elif "low-moderate σ" in trig:
            s += 1.2 if 1.0 <= sigma <= 2.2 else -0.4
        elif "low σ" in trig:
            s += 1.2 if sigma < 2.0 else -0.8

        # Temperature bands.
        if "high T" in trig:
            s += 1.0 if temperature > 300 else -0.6
        elif "moderate T" in trig:
            s += 1.0 if 150 <= temperature <= 300 else -0.4
        elif "low T" in trig:
            s += 1.0 if temperature < 150 else -0.6

        # Space-vs-vector preference. When the vug is crowded, projecting
        # habits have nowhere to go; coating habits read as wall deposits.
        vec = (v.get("vector") or "").lower()
        if space_constrained:
            if vec == "projecting":
                s -= 0.8
            elif vec == "coating":
                s += 0.6
            elif vec == "tabular":
                s += 0.3  # tabulars lay flat against the wall

        # "default" triggers are the baseline for the mineral — pick them
        # when nothing else matches well.
        if trig.startswith("default"):
            s += 0.3

        return max(s, 0.05)  # avoid hard-zero so weighted draw always works

    scored = [(v, score(v)) for v in variants]
    # Weighted random over score^2 to favor strong matches but keep variety.
    weights = [w * w for _, w in scored]
    total = sum(weights)
    if total <= 0:
        return variants[0]
    r = random.random() * total
    acc = 0.0
    for (v, _), w in zip(scored, weights):
        acc += w
        if r <= acc:
            return v
    return scored[-1][0]


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

    # Phase-1 naturalistic void shape (visual only — growth engines still
    # read mean_diameter_mm). Two-stage bubble-merge model:
    #   Stage 1 — primary void: a few large bubbles (radii 40–70% of
    #     vug_diameter_mm) forming the main cavity. Guaranteed to
    #     contain the sampling origin.
    #   Stage 2 — secondary dissolution: smaller bubbles (radii 10–30%
    #     of vug_diameter_mm) spawned ON the outer edge of the primary
    #     union — models percolating fluids eating satellite alcoves
    #     from the cavity wall.
    # See WallState._build_profile() for the geometry.
    #   primary_bubbles: number of stage-1 bubbles (>= 1; 2–5 typical).
    #   secondary_bubbles: number of stage-2 bubbles (>= 0; 3–10 typical).
    #   shape_seed: deterministic seed for bubble positions / radii.
    primary_bubbles: int = 3
    secondary_bubbles: int = 6
    shape_seed: int = 0
    
    def dissolve(self, acid_strength: float, fluid: 'FluidChemistry') -> dict:
        """Dissolve wall rock in response to acid conditions.

        CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂

        Only reactive carbonate walls (limestone, dolomite) buffer acid
        this way. Silicate host rocks (pegmatite, granite, gneiss,
        quartzite, phyllite) are effectively inert on sim timescales —
        they don't dissolve in mildly acidic hydrothermal fluids, don't
        release cations at a useful rate, and don't buffer pH. Return
        {"dissolved": False} for those so pH can actually drop and
        mineral kaolinization can proceed on the pocket's crystals.

        Returns dict of what happened.
        """
        if acid_strength <= 0:
            return {"dissolved": False}

        # Gate by composition — only carbonate walls are acid-reactive.
        if self.composition not in ("limestone", "dolomite"):
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
class WallCell:
    """One cell of the topo-map wall state. Every (ring, cell) pair has
    one — the topo renderer walks the cells in order and draws a line
    whose color and thickness come from the crystal occupying that cell.

    `base_radius_mm` is the pre-run irregular-profile baseline (Phase 1
    naturalistic void shape). Dissolution `wall_depth` then adds on top
    of it, so a cell's current outer radius is `base_radius_mm + wall_depth`.
    Backward-compatible: when left at 0, the renderer substitutes the
    parent WallState's `initial_radius_mm` — old snapshots stay round."""
    wall_depth: float = 0.0            # dissolution depth, mm (negative = eroded)
    crystal_id: Optional[int] = None   # id of the crystal occupying this cell
    mineral: Optional[str] = None      # mineral name for class_color lookup
    thickness_um: float = 0.0          # crystal thickness at this cell, µm
    base_radius_mm: float = 0.0        # Phase-1 Fourier profile baseline, mm


@dataclass
class WallState:
    """Topographic map of the vug interior, rendered as an irregular
    circle viewed from above.

    The data model is 2D: rings × cells. v1 only populates ring[0] (the
    wall surface); the `ring_count` dimension stays for a future
    depth-slice view. Each cell is a wedge of angular arc, with its own
    `wall_depth` — how much acid has pushed that chunk of wall outward.

    Dissolution is per-cell: cells covered by an acid-resistant crystal
    shield their wall slice, so dissolution pushes unblocked cells
    outward more aggressively (total acid budget conserved) and the
    wall ends up shaped like the deposit history rather than a perfect
    circle.

    Phase 1 adds a naturalistic void shape on top: a two-stage
    bubble-merge profile built deterministically from `primary_bubbles`
    + `secondary_bubbles` + `shape_seed` bakes a per-cell
    `base_radius_mm` at init. Stage 1 is the main cavity (few large
    bubbles); stage 2 is satellite alcoves dug from the cavity's outer
    surface. Crystal growth mechanics still read `mean_diameter_mm`
    (visual-only change for Phase 1).
    """
    cells_per_ring: int = 120
    ring_count: int = 1
    vug_diameter_mm: float = 50.0
    initial_radius_mm: float = 25.0
    ring_spacing_mm: float = 1.0
    # Monotonic scale reference for the renderer. Seeded generously
    # (2× initial radius) so moderate dissolution doesn't shrink the
    # rendered view, and only grows — never snaps back.
    max_seen_radius_mm: float = 0.0
    rings: List[List[WallCell]] = field(default_factory=list)

    # Phase-1 two-stage bubble-merge parameters (see VugWall docstring).
    primary_bubbles: int = 3
    secondary_bubbles: int = 6
    shape_seed: int = 0
    # Populated by _build_profile() — the list of (cx, cy, r) circles
    # in mm whose union is the void, primaries followed by secondaries.
    # Exposed so the renderer (and a future Phase-2 3D slice view) can
    # reconstruct the analytic shape without re-seeding RNG. Already
    # rescaled to match the nominal mean radius.
    bubbles: List[Tuple[float, float, float]] = field(default_factory=list)

    def __post_init__(self):
        if self.initial_radius_mm <= 0:
            self.initial_radius_mm = self.vug_diameter_mm / 2.0
        if not self.rings:
            self.rings = [
                [WallCell() for _ in range(self.cells_per_ring)]
                for _ in range(self.ring_count)
            ]
        # Compute per-cell base_radius_mm deterministically from the
        # shape params. Must run before max_seen_radius_mm is seeded so
        # it can include the largest bulge.
        self._build_profile()
        if self.max_seen_radius_mm <= 0:
            max_base = self.initial_radius_mm
            for ring in self.rings:
                for c in ring:
                    if c.base_radius_mm > max_base:
                        max_base = c.base_radius_mm
            self.max_seen_radius_mm = max_base * 2.0

    # --- Phase 1: two-stage bubble-merge profile --------------------------
    # Bubble size ranges as fractions of vug_diameter_mm. Chosen to
    # match the two-stage dissolution brief: primaries are big enough
    # that a couple of them fill the main cavity, secondaries small
    # enough to read as satellite alcoves on the cavity wall.
    _PRIMARY_SIZE_RANGE = (0.4, 0.7)
    _SECONDARY_SIZE_RANGE = (0.1, 0.3)
    # Primary cluster tightness — secondary bubble centres beyond
    # bubble 0 are placed within this fraction of R of the origin so
    # primaries consistently overlap into one cohesive cavity.
    _PRIMARY_SPREAD = 0.3

    @staticmethod
    def _raycast_union(bubbles: List[Tuple[float, float, float]],
                       theta: float) -> float:
        """Return the outer wall distance from origin at angle `theta`
        through the bubble-union, honouring origin-connectivity.

        Ray-circle intersection per bubble → [(t_enter, t_exit), …]
        clipped to t ≥ 0; sort by t_enter; merge overlapping intervals
        starting from the first; return the endpoint of the first
        merged segment (disconnected-from-origin segments don't count).
        """
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        intervals: List[Tuple[float, float]] = []
        for (cx, cy, r) in bubbles:
            b = cx * cos_t + cy * sin_t
            c = cx * cx + cy * cy - r * r
            disc = b * b - c
            if disc < 0:
                continue
            rt = math.sqrt(disc)
            t_exit = b + rt
            if t_exit <= 0.0:
                continue
            intervals.append((max(0.0, b - rt), t_exit))
        if not intervals:
            return 0.0
        intervals.sort(key=lambda iv: iv[0])
        wall = intervals[0][1]
        for (start, end) in intervals[1:]:
            if start <= wall:
                if end > wall:
                    wall = end
            else:
                break
        return wall

    def _build_profile(self) -> None:
        """Compute per-cell base_radius_mm via two-stage bubble merging.

        Stage 1 — primary void: a few large bubbles (radii 40–70% of
        vug_diameter_mm) clustered near origin, forming the main cavity.
        Bubble 0 is anchored at origin so every ray starts inside the
        union regardless of the random seeds.

        Stage 2 — secondary dissolution: smaller bubbles (radii 10–30%
        of vug_diameter_mm) spawned on the primary union's outer edge
        at random angles. Half of each secondary extends beyond the
        primary boundary (the alcove), the inner half overlaps
        harmlessly back into the primary.

        After both stages, the per-cell profile is sampled by raycasting
        the full union at each of cells_per_ring angles, then rescaled
        so the mean wall radius equals initial_radius_mm. That keeps
        mean_diameter_mm correct for the growth engines.

        Backward compatible: primary_bubbles=1, secondary_bubbles=0
        rescales to a perfect circle.
        """
        import random as _random
        rng = _random.Random(int(self.shape_seed) & 0xFFFFFFFF)

        R = float(self.initial_radius_mm)
        D = 2.0 * R  # vug_diameter_mm, the canonical unit the brief uses
        p_lo, p_hi = self._PRIMARY_SIZE_RANGE
        s_lo, s_hi = self._SECONDARY_SIZE_RANGE

        # ---- Stage 1: primary void -------------------------------------
        # Primary 0 always at origin, mid-size. Anchors the main cavity
        # and guarantees origin coverage no matter what seed lands.
        r0 = D * (p_lo + p_hi) * 0.5
        primaries: List[Tuple[float, float, float]] = [(0.0, 0.0, r0)]
        for _ in range(max(0, int(self.primary_bubbles) - 1)):
            # Clustered near origin — primaries need to overlap each
            # other to read as one cavity, not multiple.
            d = self._PRIMARY_SPREAD * R * rng.random()
            phi = rng.random() * 2.0 * math.pi
            cx = d * math.cos(phi)
            cy = d * math.sin(phi)
            r = D * rng.uniform(p_lo, p_hi)
            primaries.append((cx, cy, r))

        # ---- Stage 2: secondary dissolution ----------------------------
        # Each secondary spawns ON the primary union's outer edge at a
        # random angle. The raycast returns the radial wall distance
        # through the primary union at that angle; the secondary centre
        # is placed at that point so half of the bubble extends into the
        # wall (the alcove) and half overlaps back into the primary.
        secondaries: List[Tuple[float, float, float]] = []
        for _ in range(max(0, int(self.secondary_bubbles))):
            theta = rng.random() * 2.0 * math.pi
            r_prim = self._raycast_union(primaries, theta)
            if r_prim <= 0:
                continue   # primary raycast failed at this angle — skip
            cx = r_prim * math.cos(theta)
            cy = r_prim * math.sin(theta)
            r = D * rng.uniform(s_lo, s_hi)
            secondaries.append((cx, cy, r))

        bubbles = primaries + secondaries

        # ---- Sample the full union at cell angles ----------------------
        N = self.cells_per_ring
        raw_radii: List[float] = [
            self._raycast_union(bubbles, 2.0 * math.pi * i / N) or R
            for i in range(N)
        ]

        # ---- Rescale to nominal mean -----------------------------------
        mean_raw = sum(raw_radii) / max(len(raw_radii), 1)
        scale = R / mean_raw if mean_raw > 1e-6 else 1.0
        self.bubbles = [(cx * scale, cy * scale, r * scale) for (cx, cy, r) in bubbles]
        for ring in self.rings:
            for j, cell in enumerate(ring):
                cell.base_radius_mm = raw_radii[j] * scale

    # ----------------------------------------------------------------------

    @property
    def cell_arc_mm(self) -> float:
        """Wall arc length represented by one cell, in millimeters.
        Uses mean current radius (including per-cell base + depth) so
        the arc metric tracks both the irregular profile and dissolution."""
        ring0 = self.rings[0] if self.rings else []
        if ring0:
            mean_r = sum(c.base_radius_mm + c.wall_depth for c in ring0) / len(ring0)
        else:
            mean_r = self.initial_radius_mm
        return 2.0 * math.pi * mean_r / max(self.cells_per_ring, 1)

    def cell_radius_mm(self, cell_idx: int) -> float:
        """Outer radius of a specific ring-0 cell, including dissolution."""
        cell = self.rings[0][cell_idx % self.cells_per_ring]
        return cell.base_radius_mm + cell.wall_depth

    def mean_diameter_mm(self) -> float:
        """Effective vug diameter, averaged across all cells."""
        ring0 = self.rings[0]
        if not ring0:
            return self.vug_diameter_mm
        mean_r = sum(c.base_radius_mm + c.wall_depth for c in ring0) / len(ring0)
        return 2.0 * mean_r

    def update_diameter(self, new_diameter_mm: float) -> None:
        """Keep the nominal diameter in sync with the host sim's global
        measure. Per-cell `wall_depth` is the authoritative shape."""
        self.vug_diameter_mm = new_diameter_mm

    def erode_cells(self, rate_mm: float, blocked: set) -> int:
        """Distribute a radial dissolution amount across unblocked cells.

        `rate_mm` is the average radial depth dissolved (what
        VugWall.dissolve() reports). Blocked cells contribute zero, so
        the acid budget concentrates on unblocked cells — physically,
        the fluid still attacks the same total wall area, just focused
        where nothing's in the way.

        Returns the number of cells eroded (useful for logging)."""
        if rate_mm <= 0:
            return 0
        ring0 = self.rings[0]
        N = len(ring0)
        unblocked = [i for i in range(N) if i not in blocked]
        if not unblocked:
            return 0
        # Conservation: total acid attack is rate_mm × N, spread over
        # unblocked cells only.
        per_cell = rate_mm * N / len(unblocked)
        for i in unblocked:
            ring0[i].wall_depth += per_cell
        # Bump the monotonic render scale if any cell just passed the
        # running max. Uses per-cell base_radius_mm so bulges in the
        # Fourier profile contribute correctly.
        for c in ring0:
            r = c.base_radius_mm + c.wall_depth
            if r > self.max_seen_radius_mm:
                self.max_seen_radius_mm = r
        return len(unblocked)

    def clear(self) -> None:
        """Reset per-step occupancy before repainting all crystals.
        Wall depth is cumulative — don't reset it."""
        for ring in self.rings:
            for cell in ring:
                cell.crystal_id = None
                cell.mineral = None
                cell.thickness_um = 0.0

    def paint_crystal(self, crystal: 'Crystal') -> None:
        """Mark the cells this crystal occupies with its id / mineral /
        thickness. Called after growth each step. Only ring[0] is painted
        in v1; when multi-ring rendering arrives, void_reach will extend
        the paint deeper.

        Footprint math: wall_spread × total_growth gives the raw arc,
        but the spec's spread values (0.2–0.9) describe the fraction of
        the crystal's base that hugs the wall, so the actual arc a
        coating habit sweeps needs a multiplier. FOOTPRINT_SCALE = 4.0
        puts a 5mm coating (0.8) at ~16mm of arc and a 5mm prismatic
        (0.2) at ~4mm. Anchor cells are painted even at zero thickness
        so fresh nucleations shield their slice of wall immediately.
        """
        if crystal.wall_center_cell is None:
            return
        FOOTPRINT_SCALE = 4.0
        arc_mm = ((crystal.total_growth_um / 1000.0)
                  * max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE)
        half_cells = max(1, int(round(arc_mm / self.cell_arc_mm / 2.0)))
        thickness = max(crystal.total_growth_um, 1.0)  # nucleated = visible
        ring0 = self.rings[0]
        N = self.cells_per_ring
        for offset in range(-half_cells, half_cells + 1):
            idx = (crystal.wall_center_cell + offset) % N
            cell = ring0[idx]
            if cell.thickness_um < thickness:
                cell.crystal_id = crystal.crystal_id
                cell.mineral = crystal.mineral
                cell.thickness_um = thickness


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
        """Wurtzite ((Zn,Fe)S) — hexagonal dimorph of sphalerite, high-T.

        Same (Zn,Fe)S composition as sphalerite, different crystal structure.
        Above 95°C, (Zn,Fe)S favors the hexagonal wurtzite form; below 95°C,
        cubic sphalerite is stable. On cooling, wurtzite can convert to
        sphalerite but sphalerite rarely inverts back — asymmetric dimorphism.

        Hard gate at T≤95 returns zero; between 100–300°C the σ rises.
        """
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        if self.temperature <= 95:
            return 0
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)
        # Peak in the 150–250°C window; falls off either side
        if self.temperature < 150:
            T_factor = (self.temperature - 95) / 55.0  # 0 → 1 across 95-150
        elif self.temperature <= 300:
            T_factor = 1.4  # broad peak
        else:
            T_factor = 1.4 * math.exp(-0.005 * (self.temperature - 300))
        return product * T_factor
    
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
        # Pyrite is stable over a wide T range, slight preference for moderate T
        T_factor = 1.0 if 100 < self.temperature < 400 else 0.5
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

        Denominators reference realistic supergene weathering fluid
        (Cu ~25 ppm, CO₃ ~100 ppm from dissolved meteoric CO₂). The older
        50/200 values were tuned for Cu-saturated porphyry fluids and
        starved supergene vugs of their flagship copper mineral.
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

        Acidic fluids destabilize feldspar irreversibly: KAlSi₃O₈ + H⁺ →
        kaolinite + K⁺ + SiO₂. The sim doesn't model kaolinite as a
        mineral (it's an implicit sink), so below pH 4 we drive sigma
        hard negative — this keeps released K+Al+SiO₂ from re-feeding
        feldspar growth and matches the real-world one-way conversion.
        """
        if self.fluid.K < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
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

    def supersaturation_beryl(self) -> float:
        """Beryl (Be₃Al₂Si₆O₁₈) supersaturation. Needs Be + Al + SiO₂.

        Beryllium is the most incompatible common element in magmatic
        systems — no rock-forming mineral takes it, so it concentrates in
        residual pegmatite fluid until finally, at a high threshold
        (nucleation_sigma 1.8), beryl nucleates. That accumulation delay
        is why beryl crystals can be enormous: by the time it forms there's
        a lot of Be waiting. T window 300–650°C with optimum 350–550°C.
        """
        if self.fluid.Be < 10 or self.fluid.Al < 6 or self.fluid.SiO2 < 50:
            return 0
        # Cap each factor — see supersaturation_tourmaline for rationale.
        be_f = min(self.fluid.Be / 15.0, 2.5)   # Be is the gate; allow
                                                # slightly higher cap so the
                                                # high σ nucleation_sigma=1.8
                                                # threshold is reachable.
        al_f = min(self.fluid.Al / 12.0, 1.5)
        si_f = min(self.fluid.SiO2 / 350.0, 1.5)
        sigma = be_f * al_f * si_f
        # Temperature window
        T = self.temperature
        if 350 <= T <= 550:
            T_factor = 1.0
        elif 300 <= T < 350:
            T_factor = 0.6 + 0.008 * (T - 300)  # 0.6 → 1.0
        elif 550 < T <= 650:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 550))
        elif T > 650:
            T_factor = 0.2
        else:
            T_factor = max(0.1, 0.6 - 0.006 * (300 - T))
        sigma *= T_factor
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
    radiation_damage: float = 0.0  # cumulative α-dose (arbitrary units). Quartz
                                   # zones irradiated by nearby uraninite accrue
                                   # damage step-by-step; ≥0.3 averaged across
                                   # zones starts to read as smoky.
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
    # Growth-vector footprint (chosen from data/minerals.json habit_variants
    # at nucleation time based on σ / T / available space). Drives the topo
    # map: wall_spread governs lateral coverage along the wall, void_reach
    # governs projection into the vug interior. `vector` is the categorical
    # style (projecting / coating / tabular / equant / dendritic).
    wall_spread: float = 0.5
    void_reach: float = 0.5
    vector: str = "equant"
    # Anchor cell on the wall (ring 0) where this crystal nucleated.
    # WallState.paint_crystal() grows outward from here by wall_spread ×
    # total_growth. None for crystals that nucleated on another crystal
    # rather than the wall — those follow their host's cell.
    wall_center_cell: Optional[int] = None
    
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
        avg_rad = sum(z.radiation_damage for z in self.zones) / len(self.zones)

        if self.mineral == "quartz":
            # Quartz color depends on trace elements + actual radiation dose
            # integrated across growth zones. Thresholds match the color_rules
            # block in data/minerals.json — pegmatite-grade dose + trace Al
            # produces smoky quartz even when Al is sub-ppm.
            if avg_rad > 0.6:
                if avg_Fe > 3.0 and avg_Al > 1.0:
                    return "dark smoky amethyst — heavy α-dose, Al + Fe color centers"
                if avg_Al > 0.3:
                    return "dark smoky to morion — heavy α-damage in Al-bearing lattice"
                return "faintly smoky — heavy α-dose but Al-starved lattice"
            if avg_rad > 0.3:
                if avg_Fe > 3.0 and avg_Al > 1.0:
                    return "smoky amethyst — α-damage plus Fe³⁺ color centers (zoned)"
                if avg_Al > 0.3:
                    return "smoky — α-damage activated Al-hole color centers"
                if avg_Fe > 3.0:
                    return "amethyst — Fe³⁺ color centers activated by radiation"
                return "pale smoky tint — moderate α-dose, Al-poor lattice"
            if avg_rad > 0.1:
                return "pale smoky tint — modest α-dose"
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
        elif self.mineral in ("pyrite", "marcasite", "chalcopyrite", "galena", "molybdenite"):
            return "non-fluorescent (opaque sulfide)"
        elif self.mineral in ("sphalerite", "wurtzite"):
            # Mn²⁺ activates, Fe quenches — same as calcite
            if avg_Mn > 5 and avg_Fe < 10:
                return "orange or blue (Mn²⁺-activated; color varies by site)"
            elif avg_Mn > 5 and avg_Fe > 10:
                return "quenched (Fe²⁺ masks Mn²⁺ emission)"
            return "non-fluorescent"
        elif self.mineral == "hematite":
            return "non-fluorescent (opaque oxide)"
        elif self.mineral == "goethite":
            return "non-fluorescent (opaque hydroxide)"
        elif self.mineral == "malachite":
            return "non-fluorescent"
        elif self.mineral == "uraninite":
            # Uraninite itself is weakly fluorescent; daughter uranyl minerals are brilliant
            return "weak green-yellow (U) — daughter autunite/torbernite would glow brightly"
        elif self.mineral == "smithsonite":
            if avg_Mn > 2:
                return "pink under LW UV (Mn²⁺-activated)"
            return "non-fluorescent"
        elif self.mineral == "wulfenite":
            return "non-fluorescent (typical)"
        elif self.mineral == "selenite":
            return "non-fluorescent (typical gypsum)"
        elif self.mineral == "adamite":
            # Cu trace: low Cu → strong SW fluorescence; heavy Cu quenches
            avg_Cu = sum(getattr(z, "trace_Cu", 0.0) for z in self.zones) / max(len(self.zones), 1)
            if avg_Cu > 10:
                return "quenched (heavy Cu turns off SW emission)"
            if avg_Cu > 0.5:
                return "bright apple-green under SW UV (cuproadamite)"
            return "green-yellow under SW UV (intrinsic adamite)"
        elif self.mineral == "mimetite":
            return "orange under SW UV (intrinsic emission)"
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


def grow_wurtzite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Wurtzite ((Zn,Fe)S) growth model — hexagonal dimorph of sphalerite.

    The high-T polymorph. On cooling below 95°C, wurtzite can convert to
    cubic sphalerite — handled here as a dissolution event with Zn+S
    recycled to the fluid (letting a new sphalerite seed nucleate).
    Hemimorphic habit: one end pointed, one end flat — diagnostic of
    the lack of an inversion center in the hexagonal P6₃mc space group.
    """
    # Polymorphic inversion on cooling below 95°C
    if crystal.total_growth_um > 10 and conditions.temperature <= 95:
        crystal.dissolved = True
        conditions.fluid.Zn += 1.5
        conditions.fluid.S += 1.2
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.5, growth_rate=-1.5,
            note="polymorphic inversion — T dropped below 95°C, hexagonal (Zn,Fe)S converting to cubic sphalerite"
        )

    sigma = conditions.supersaturation_wurtzite()

    if sigma < 1.0:
        return None

    excess = sigma - 1.0
    rate = 5.5 * excess * random.uniform(0.7, 1.3)

    # Fe substitution — same as sphalerite but at higher T
    Fe_mol_percent = min(conditions.fluid.Fe * 0.12 * (conditions.temperature / 300.0), 35.0)
    trace_Fe = Fe_mol_percent * 10

    # Habit selection — σ + T control the form
    if excess > 1.5:
        crystal.habit = "fibrous_coating"
        crystal.dominant_forms = ["fibrous crust", "{0001} parallel columns"]
    elif excess > 0.8:
        crystal.habit = "radiating_columnar"
        crystal.dominant_forms = ["radiating hexagonal columns", "stellate aggregates"]
    elif excess > 0.3:
        crystal.habit = "hemimorphic_crystal"
        crystal.dominant_forms = ["hemimorphic hexagonal pyramid", "{0001} + {101̄1}"]
    else:
        crystal.habit = "platy_massive"
        crystal.dominant_forms = ["{0001} tabular plate", "micaceous"]

    # Color from Fe content — darker than sphalerite at same Fe
    if Fe_mol_percent > 15:
        color_note = "black metallic (Fe-rich wurtzite)"
    elif Fe_mol_percent > 5:
        color_note = "brownish-black"
    else:
        color_note = "yellowish-brown to dark brown"

    # Wurtzite rarely twins the same way sphalerite does — different space group
    if crystal.habit == "hemimorphic_crystal" and not crystal.twinned and random.random() < 0.008:
        crystal.twinned = True
        crystal.twin_law = "basal {0001} contact"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"hemimorphic hexagonal (Zn,Fe)S — {color_note}, Fe: {Fe_mol_percent:.1f} mol%"
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


def grow_marcasite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Marcasite (FeS2) growth model — orthorhombic dimorph of pyrite.

    Same composition as pyrite; pH<5 and T<240°C are the switches. Habits are
    the diagnostic — cockscomb crests, spearhead tips, radiating blades. The
    classic museum-specimen rot: left in humidity, marcasite decomposes to
    sulfuric acid + iron sulfate. Metastable to pyrite on heating above 240°C.
    """
    # Metastable conversion to pyrite — if pH rises or T exceeds 240, the
    # orthorhombic structure collapses to the cubic form. Treat as dissolution
    # with Fe/S released, letting a new pyrite seed nucleate in its place.
    if crystal.total_growth_um > 10 and (conditions.fluid.pH >= 5.0 or conditions.temperature > 240):
        crystal.dissolved = True
        conditions.fluid.Fe += 1.5
        conditions.fluid.S += 1.2
        trigger = "pH rose above 5" if conditions.fluid.pH >= 5.0 else "T exceeded 240°C"
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.5, growth_rate=-1.5,
            note=f"metastable inversion — {trigger}, orthorhombic FeS2 converting to pyrite"
        )

    sigma = conditions.supersaturation_marcasite()

    if sigma < 1.0:
        # Oxidative dissolution — marcasite decomposes faster than pyrite
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Fe += dissolved_um * 1.0
            conditions.fluid.S += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidative breakdown — FeS2 + O2 + H2O → FeSO4 + H2SO4 (the museum rot)"
            )
        # Acid-stable down to pH 1.5 — but extreme acid still dissolves
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 1.5:
            crystal.dissolved = True
            conditions.fluid.Fe += 2.0
            conditions.fluid.S += 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-2.0, growth_rate=-2.0,
                note=f"extreme-acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)

    # Habit selection — sigma + T control the form
    if excess > 1.5 and conditions.temperature < 100:
        crystal.habit = "radiating_blade"
        crystal.dominant_forms = ["radiating blades", "fibrous stellate clusters"]
    elif excess > 0.8:
        crystal.habit = "cockscomb"
        crystal.dominant_forms = ["cockscomb aggregate", "crested tabular {010}"]
    elif excess > 0.3:
        crystal.habit = "spearhead"
        crystal.dominant_forms = ["spearhead twins", "pyramidal terminations"]
    else:
        crystal.habit = "tabular_plate"
        crystal.dominant_forms = ["{010} tabular plate"]

    trace_note = "pale brass-yellow metallic, tarnishing iridescent"
    if conditions.fluid.pH < 3.5:
        trace_note += " (strong acid — extra-rapid cockscomb growth)"

    # Twinning — marcasite forms characteristic spearhead (swallowtail) twins
    if crystal.habit == "spearhead" and not crystal.twinned and random.random() < 0.05:
        crystal.twinned = True
        crystal.twin_law = "spearhead {101}"

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
        # Kaolinization: acidic weathering of feldspar → kaolinite.
        # Balanced reaction: 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite +
        # 2 K⁺ + 4 SiO₂. All Al stays in the new kaolinite phase; only
        # K and SiO₂ go back to the fluid (and a little Al from crystal-
        # edge effects and pore fluid, ~5% partition).
        # The sim doesn't track kaolinite as a distinct mineral — it's
        # an implicit Al sink. This partition is the honest chemistry.
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.08)
            conditions.fluid.K += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.05   # most Al stays in kaolinite
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"kaolinization (pH {conditions.fluid.pH:.1f}) — KAlSi₃O₈ → kaolinite + K⁺ + SiO₂; Al conserved in kaolinite"
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
        # Albite kaolinization: 2 NaAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite +
        # 2 Na⁺ + 4 SiO₂. Al stays in the kaolinite phase (Al sink);
        # only Na and SiO₂ go back to the fluid. Albite is more
        # acid-resistant than K-feldspar (pH threshold 3 vs 4).
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Na += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.05   # most Al stays in kaolinite
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"albite kaolinization (pH {conditions.fluid.pH:.1f}) — Na⁺ + SiO₂ released, Al conserved in kaolinite"
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


def grow_topaz(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Topaz (Al₂SiO₄(F,OH)₂) growth model.

    Orthorhombic nesosilicate, prismatic with steep pyramidal terminations and
    perfect basal {001} cleavage. F-gated supersaturation: the crystal won't
    nucleate or grow until fluorine passes a saturation threshold.

    Imperial color: trace Cr³⁺ (sourced from ultramafic country rock, NOT
    from the main pegmatite fluid) substitutes for Al³⁺ in the structure.
    - Cr < 3 ppm → colorless to pale blue (F-rich) or pale yellow
    - Cr 3–8 ppm → imperial golden-orange (the Ouro Preto signature)
    - Cr > 8 ppm → pink imperial (rarest, can be intensified by radiation)

    Fluid inclusions at growth-zone boundaries are the main geothermometer —
    the homogenization temperature of a 2-phase inclusion captures the T at
    which that zone grew.
    """
    sigma = conditions.supersaturation_topaz()

    if sigma < 1.0:
        # Very stable — only strong acid (pH < 2) dissolves topaz.
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.04)
            conditions.fluid.Al += dissolved_um * 0.3
            conditions.fluid.SiO2 += dissolved_um * 0.2
            conditions.fluid.F += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"strong-acid dissolution (pH {conditions.fluid.pH:.1f}) — Al³⁺, SiO₂, F⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    T = conditions.temperature

    # Habit cues from the variant selector are set at nucleation. Here we
    # refine dominant_forms based on thermal regime — higher T favors
    # stubbier equant forms, lower T gives steep pyramidal terminations.
    if T > 450:
        crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "c{001} pinacoid", "stubby"]
    elif T > 380:
        crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "{021} pyramid"]
    else:
        crystal.dominant_forms = ["m{110} prism", "steep {021}+{041} pyramids", "c{001} basal cleavage"]

    # Imperial color flag from trace Cr. Real imperial topaz takes up Cr³⁺
    # as a direct substitute for Al³⁺; the Ouro Preto threshold is sub-ppm
    # in the crystal but needs ~few ppm in the fluid to deposit enough.
    Cr_fluid = conditions.fluid.Cr
    F_fluid = conditions.fluid.F
    if Cr_fluid > 8.0:
        color_note = f"pink imperial (Cr³⁺ {Cr_fluid:.1f} ppm — rare, Cr⁴⁺ oxidation-state coloring)"
        crystal.habit = "prismatic_imperial_pink"
    elif Cr_fluid > 3.0:
        color_note = f"imperial golden-orange (Cr³⁺ {Cr_fluid:.1f} ppm — the Ouro Preto signature)"
        crystal.habit = "prismatic_imperial"
    elif F_fluid > 40 and conditions.fluid.Fe < 5 and Cr_fluid < 0.5:
        color_note = "pale blue (F-rich fluid, no Cr chromophore)"
    elif conditions.fluid.Fe > 15:
        color_note = "pale yellow to brown (Fe³⁺ substitution)"
    else:
        color_note = "colorless to water-clear"

    # Trace element incorporation (rough partition coefficients)
    trace_Fe = conditions.fluid.Fe * 0.008
    trace_Al = conditions.fluid.Al * 0.02  # mostly structural, recorded as trace
    trace_Ti = conditions.fluid.Ti * 0.015  # rutile microinclusions, "sagenite" look

    # Fluid inclusions — topaz is famous for well-preserved 2-phase inclusions.
    # Primary inclusions trap growth fluid; homogenization T is the
    # geothermometer that pinned Ouro Preto at 360°C (Morteani 2002).
    fi = False
    fi_type = ""
    if rate > 4 and random.random() < 0.25:
        fi = True
        if T > 350:
            fi_type = "2-phase (liquid + vapor) — geothermometer primary"
        elif T > 150:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid (late, low-T)"

    # Deplete fluid. Stoichiometry is approximate — we're tracking
    # incompatible-element drawdown, not mass balance.
    conditions.fluid.Al = max(conditions.fluid.Al - rate * 0.015, 0)
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2 - rate * 0.012, 0)
    conditions.fluid.F = max(conditions.fluid.F - rate * 0.018, 0)

    note_parts = [color_note]
    if excess > 1.0:
        note_parts.append("rapid growth — potential growth hillocks on prism faces")
    elif excess < 0.2:
        note_parts.append("near-equilibrium — clean layer growth, gem-quality potential")
    if crystal.twinned:
        note_parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al, trace_Ti=trace_Ti,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(note_parts),
    )


def grow_tourmaline(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Tourmaline growth model (schorl → elbaite series).

    Cyclosilicate, trigonal, elongated prisms with deep vertical
    striations and a slightly rounded triangular cross-section {101̄0}.
    The schorl→elbaite transition records the pegmatite fluid's
    evolution: schorl (Fe²⁺-dominant black) early, elbaite (Li-dominant
    colored) late as Fe depletes and Li accumulates.

    Color is a fluid composition snapshot, chosen per growth zone:
    - Fe²⁺ dominant → schorl (black)
    - Li-rich + Mn²⁺ → rubellite (pink)
    - Li-rich + Cr³⁺/V³⁺ → verdelite (green)
    - Li-rich + Fe²⁺ + Ti → indicolite (blue)
    - Cu²⁺ trace → Paraíba (neon blue, rare)
    - Otherwise → achroite (colorless)

    Extremely resistant to weathering — no dissolution path in this
    simplified model.
    """
    sigma = conditions.supersaturation_tourmaline()
    if sigma < 1.0:
        return None  # tourmaline is basically immortal once grown

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Color variant from current fluid composition. Log-order checks: most
    # distinctive flags win. Track via zone notes so _narrate_tourmaline
    # can read them; also set crystal.habit on the first colored zone so
    # the library UI picks up the species name.
    f = conditions.fluid
    is_li_rich = f.Li > 10.0
    color_note = ""
    variety = "schorl"  # default — the early Fe²⁺ end-member
    if f.Cu > 1.0:
        variety = "paraiba"
        color_note = f"neon Paraíba blue (Cu²⁺ {f.Cu:.2f} ppm — extreme rarity)"
    elif is_li_rich and f.Mn > 0.3 and f.Fe < 15:
        variety = "rubellite"
        color_note = f"pink rubellite (Mn²⁺ {f.Mn:.1f} + Li {f.Li:.0f} ppm)"
    elif is_li_rich and (f.Cr > 0.5 or f.V > 1.0):
        variety = "verdelite"
        color_note = f"green verdelite ({'Cr³⁺' if f.Cr > 0.5 else 'V³⁺'} + Li {f.Li:.0f} ppm)"
    elif is_li_rich and f.Fe > 5 and f.Ti > 0.3:
        variety = "indicolite"
        color_note = f"blue indicolite (Fe²⁺+Ti with Li {f.Li:.0f} ppm)"
    elif f.Fe > 15 and f.Li < 5:
        variety = "schorl"
        color_note = f"black schorl (Fe²⁺ {f.Fe:.0f} ppm dominant, Li-depleted)"
    elif is_li_rich:
        variety = "elbaite"
        color_note = f"colorless achroite (Li-bearing elbaite, trace elements muted)"
    else:
        color_note = "dark olive-brown (mixed Fe/Mg character)"

    # Stamp the variety onto the crystal. A crystal can span schorl→elbaite
    # zones during a single life — the habit reflects whatever the latest
    # zone says, which is how color-zoned tourmaline records time evolution.
    crystal.habit = variety

    if conditions.temperature > 500:
        crystal.dominant_forms = ["m{10̄10} prism", "r{101̄1} + o{022̄1} terminations", "deep striations"]
    else:
        crystal.dominant_forms = ["m{10̄10} prism", "slight rounded triangular cross-section", "deep striations"]

    # Trace incorporation — Mn, Fe, Cr, Li all captured in notes, but we
    # stash Fe/Mn on the zone so predict_fluorescence and color averaging
    # across zones work.
    trace_Fe = f.Fe * 0.04   # tourmaline is a decent Fe sink
    trace_Mn = f.Mn * 0.02
    trace_Al = f.Al * 0.03
    trace_Ti = f.Ti * 0.01

    # Deplete the fluid — this is how the schorl→elbaite transition drives
    # itself: Fe goes down, Li builds up relative to Fe, and later zones
    # start reading as elbaite varieties.
    f.B = max(f.B - rate * 0.025, 0)
    f.Na = max(f.Na - rate * 0.008, 0)
    f.Al = max(f.Al - rate * 0.015, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.020, 0)
    if variety == "schorl" or variety == "indicolite":
        f.Fe = max(f.Fe - rate * 0.012, 0)
    if is_li_rich or variety in ("rubellite", "verdelite", "indicolite", "elbaite"):
        f.Li = max(f.Li - rate * 0.010, 0)
    if variety == "rubellite":
        f.Mn = max(f.Mn - rate * 0.008, 0)
    if variety == "verdelite":
        if f.Cr > 0.5:
            f.Cr = max(f.Cr - rate * 0.005, 0)
        else:
            f.V = max(f.V - rate * 0.006, 0)
    if variety == "paraiba":
        f.Cu = max(f.Cu - rate * 0.015, 0)

    parts = [color_note]
    # Striated growth is ubiquitous — every zone gets the record.
    parts.append("vertical striations deepen — every growth pulse leaves a ridge")
    if excess > 1.5:
        parts.append("rapid growth — radial sprays possible")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean prismatic growth")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        trace_Al=trace_Al, trace_Ti=trace_Ti,
        note=", ".join(parts),
    )


def grow_beryl(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Beryl (Be₃Al₂Si₆O₁₈) growth model.

    Hexagonal cyclosilicate. The growth-rate_mult of 0.25 is slow, but
    beryl rides it for a long time because Be accumulates for ages
    before crossing the nucleation threshold — by the time the first
    crystal fires, the fluid is Be-saturated enough to sustain growth
    for many steps. That's the real-world mechanism behind meter-long
    beryl crystals.

    Color variants (set per zone):
    - Pure / no significant trace → goshenite (colorless)
    - Fe²⁺ + oxidizing → heliodor (yellow)
    - Fe²⁺ + reducing → aquamarine (blue)
    - Cr³⁺ or V³⁺ → emerald (green) — the emerald paradox, needs
      ultramafic country-rock contact
    - Mn²⁺ → morganite (pink)
    """
    sigma = conditions.supersaturation_beryl()
    if sigma < 1.0:
        # Resistant to most acids; dissolution only in HF (pH < 3 + F > 30).
        if crystal.total_growth_um > 20 and conditions.fluid.pH < 3.0 and conditions.fluid.F > 30:
            crystal.dissolved = True
            dissolved_um = min(1.5, crystal.total_growth_um * 0.03)
            conditions.fluid.Be += dissolved_um * 0.2
            conditions.fluid.Al += dissolved_um * 0.2
            conditions.fluid.SiO2 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"HF-assisted dissolution (pH {conditions.fluid.pH:.1f}, F {conditions.fluid.F:.0f}) — Be²⁺, Al³⁺, SiO₂ released"
            )
        return None

    excess = sigma - 1.0
    # Slow engine (spec growth_rate_mult 0.25) — multiplier already baked
    # into the rate constant here.
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Variety selection. Cr/V beats Mn beats Fe — the emerald paradox is
    # the rarest, so it gets the highest priority if the chemistry is
    # there. Fe+oxidizing splits heliodor (yellow) from aquamarine (blue).
    if f.Cr > 0.5 or f.V > 1.0:
        variety = "emerald"
        color_note = f"emerald green ({'Cr³⁺' if f.Cr > 0.5 else 'V³⁺'} — the ultramafic-pegmatite paradox met)"
    elif f.Mn > 2.0:
        variety = "morganite"
        color_note = f"morganite pink (Mn²⁺ {f.Mn:.1f} ppm)"
    elif f.Fe > 15 and f.O2 > 0.5:
        variety = "heliodor"
        color_note = f"heliodor yellow (Fe³⁺ {f.Fe:.0f} ppm, oxidized)"
    elif f.Fe > 8:
        variety = "aquamarine"
        color_note = f"aquamarine blue (Fe²⁺ {f.Fe:.0f} ppm, reducing)"
    else:
        variety = "goshenite"
        color_note = "goshenite colorless (pure beryl — no chromophore)"

    # Color variants all share the hexagonal habit — zone note records
    # the variety, allowing a single crystal to be zoned (aquamarine core
    # with heliodor rim if Fe oxidation state flipped mid-growth).
    crystal.habit = variety

    T = conditions.temperature
    if T > 500:
        crystal.dominant_forms = ["m{10̄10} hex prism", "c{0001} basal pinacoid", "elongated"]
    elif T > 380:
        crystal.dominant_forms = ["m{10̄10} hex prism", "c{0001} flat pinacoid", "classic hexagonal"]
    else:
        crystal.dominant_forms = ["m{10̄10} hex prism", "c{0001} pinacoid", "stubby tabular"]

    # Trace incorporation — Fe, Mn, Al structural; Cr/V through emerald
    # substitution (not tracked in zones, but consumed from fluid).
    trace_Fe = f.Fe * 0.015
    trace_Mn = f.Mn * 0.02
    trace_Al = f.Al * 0.025

    # Fluid inclusion frequency — beryl famously traps inclusions at
    # zone boundaries (Colombian emerald trapiche pattern, aquamarine's
    # stepped growth voids).
    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.22:
        fi = True
        if T > 350:
            fi_type = "2-phase (liquid + vapor) — beryl geothermometer"
        elif T > 150:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid (late)"

    # Deplete fluid. Be is the big one — beryl is a Be sink.
    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)
    if variety == "emerald":
        if f.Cr > 0.5:
            f.Cr = max(f.Cr - rate * 0.004, 0)
        else:
            f.V = max(f.V - rate * 0.005, 0)
    elif variety == "morganite":
        f.Mn = max(f.Mn - rate * 0.006, 0)
    elif variety in ("aquamarine", "heliodor"):
        f.Fe = max(f.Fe - rate * 0.008, 0)

    parts = [color_note]
    if excess > 1.0:
        parts.append("rapid growth — wider growth ring, thermal history recorder")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


def grow_spodumene(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Spodumene (LiAlSi₂O₆) growth model.

    Monoclinic pyroxene — the "book shape" flattened tabular prism.
    Two cleavage directions at ~87° produce the characteristic parting
    planes; when the crystal survives dissolution events, parting
    fragments litter the pocket floor.

    Varieties:
    - Pure/Fe-trace → triphane (yellow-green, the default)
    - Mn²⁺ → kunzite (pink-lilac, strong SW fluorescence)
    - Cr³⁺ → hiddenite (green, rarer than kunzite)

    No practical acid dissolution. Can span triphane→kunzite zones
    if Mn rises mid-growth.
    """
    sigma = conditions.supersaturation_spodumene()
    if sigma < 1.0:
        return None  # resistant to acids; no dissolution path

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid

    # Variety selection. Cr → hiddenite; Mn → kunzite; nothing → triphane
    if f.Cr > 0.5:
        variety = "hiddenite"
        color_note = f"hiddenite green (Cr³⁺ {f.Cr:.2f} ppm)"
    elif f.Mn > 2.0:
        variety = "kunzite"
        color_note = f"kunzite pink-lilac (Mn²⁺ {f.Mn:.1f} ppm — strong SW fluorescence)"
    elif f.Fe > 10:
        variety = "triphane_yellow"
        color_note = f"yellow-green triphane (Fe {f.Fe:.0f} ppm, pale tint)"
    else:
        variety = "triphane"
        color_note = "colorless to pale yellow triphane (pure)"

    crystal.habit = variety

    # Dominant forms — monoclinic pyroxene, flattened tabular habit is
    # the signature. Two cleavages at ~87° always written into the form
    # list so narrators can pick it up.
    T = conditions.temperature
    if T > 550:
        crystal.dominant_forms = ["m{110} prism", "a{100} pinacoid", "{110}∧{1̄10} ≈87° prismatic cleavages", "blade"]
    else:
        crystal.dominant_forms = ["m{110} prism", "a{100} + b{010} pinacoids", "{110}∧{1̄10} ≈87° cleavages", "flattened tabular 'book'"]

    trace_Fe = f.Fe * 0.008
    trace_Mn = f.Mn * 0.025   # Mn is a strong spodumene partitioner (kunzite)
    trace_Al = f.Al * 0.020

    # Deplete fluid — Li is the gate element.
    f.Li = max(f.Li - rate * 0.020, 0)
    f.Al = max(f.Al - rate * 0.008, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.020, 0)
    if variety == "kunzite":
        f.Mn = max(f.Mn - rate * 0.010, 0)
    elif variety == "hiddenite":
        f.Cr = max(f.Cr - rate * 0.004, 0)

    parts = [color_note]
    parts.append("~87° pyroxene cleavage direction established")
    if excess > 1.0:
        parts.append("rapid growth — more color-causing impurity trapped")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn, trace_Al=trace_Al,
        note=", ".join(parts),
    )


def grow_magnetite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Magnetite (Fe₃O₄) growth — octahedral at the HM redox buffer."""
    sigma = conditions.supersaturation_magnetite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and (conditions.fluid.pH < 2.5 or conditions.fluid.O2 > 1.4):
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Fe += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dissolution (pH {conditions.fluid.pH:.1f}, O₂ {conditions.fluid.O2:.1f}) — martite conversion if oxidizing"
            )
        return None
    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.5:
        crystal.habit = "granular_massive"
        crystal.dominant_forms = ["granular massive aggregate"]
        color_note = "black massive magnetite"
    elif conditions.temperature > 400 and 0.5 < excess < 1.2:
        crystal.habit = "rhombic_dodecahedral"
        crystal.dominant_forms = ["{110} rhombic dodecahedron", "with mineralizer"]
        color_note = "black rhombic dodecahedral (high-T, mineralizer-assisted)"
    else:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "metallic black"]
        color_note = "black octahedral — strongly magnetic (lodestone)"
    f.Fe = max(f.Fe - rate * 0.025, 0)
    f.O2 = max(f.O2 - rate * 0.003, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=f.Fe * 0.03, note=color_note,
    )


def grow_lepidocrocite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Lepidocrocite (γ-FeOOH) growth — ruby-red platy dimorph of goethite."""
    sigma = conditions.supersaturation_lepidocrocite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.06)
            conditions.fluid.Fe += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "fibrous_micaceous"
        crystal.dominant_forms = ["fibrous micaceous aggregate", "rapid-oxidation signature"]
        color_note = "rust-brown fibrous (fast Fe²⁺ oxidation, coarser particles)"
    elif excess > 0.4:
        crystal.habit = "plumose_rosette"
        crystal.dominant_forms = ["plumose rosette", "radiating platy"]
        color_note = "ruby-red plumose rosette"
    else:
        crystal.habit = "platy_scales"
        crystal.dominant_forms = ["{010} platy scales", "perfect basal cleavage (mica-like)"]
        color_note = "pink-mauve to ruby-red platy (nanoscale 'lithium quartz' pigment scale)"
    f.Fe = max(f.Fe - rate * 0.020, 0)
    f.O2 = max(f.O2 - rate * 0.002, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=f.Fe * 0.02, note=color_note,
    )


def grow_stibnite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Stibnite (Sb₂S₃) growth — sword-blade sulfide."""
    sigma = conditions.supersaturation_stibnite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Sb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.2:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular aggregate"]
        color_note = "lead-gray massive granular stibnite"
    elif excess > 0.5:
        crystal.habit = "radiating_spray"
        crystal.dominant_forms = ["radiating bladed spray", "sword-blade aggregate"]
        color_note = "radiating spray of steel-gray blades"
    else:
        crystal.habit = "elongated_prism_blade"
        crystal.dominant_forms = ["elongated {110} prism", "sword-blade terminations", "brilliant metallic luster"]
        color_note = "elongated sword-blade — the Ichinokawa habit (lead-gray metallic)"
    f.Sb = max(f.Sb - rate * 0.025, 0)
    f.S = max(f.S - rate * 0.018, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_bismuthinite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Bismuthinite (Bi₂S₃) growth — stibnite's Bi cousin."""
    sigma = conditions.supersaturation_bismuthinite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Bi += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    T = conditions.temperature
    if T > 350:
        crystal.habit = "stout_prismatic"
        crystal.dominant_forms = ["stout {110} prism", "tin-white metallic"]
        color_note = f"stout prismatic bismuthinite (high-T form, T={T:.0f}°C)"
    elif excess > 1.0:
        crystal.habit = "radiating_cluster"
        crystal.dominant_forms = ["radiating cluster", "needle bundle"]
        color_note = "radiating cluster of fine bismuthinite needles"
    else:
        crystal.habit = "acicular_needle"
        crystal.dominant_forms = ["acicular {110} needles", "lead-gray with iridescent tarnish"]
        color_note = f"acicular needles (low-T form, T={T:.0f}°C) — iridescent tarnish develops"
    f.Bi = max(f.Bi - rate * 0.030, 0)
    f.S = max(f.S - rate * 0.018, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_native_bismuth(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native bismuth (Bi) growth — the lowest-melting native metal."""
    sigma = conditions.supersaturation_native_bismuth()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Bi += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidation (O₂ {conditions.fluid.O2:.1f}) — bismite/bismutite surface forms"
            )
        return None
    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular silver-white"]
        color_note = "massive granular native bismuth"
    elif excess > 0.25 and random.random() < 0.1:
        crystal.habit = "rhombohedral_crystal"
        crystal.dominant_forms = ["{0001} basal pinacoid", "rhombohedral trigonal"]
        color_note = "rhombohedral crystal (rare — well-formed in open vug)"
    else:
        crystal.habit = "arborescent_dendritic"
        crystal.dominant_forms = ["arborescent branching", "dendritic fracture fill"]
        color_note = "arborescent native bismuth — silver-white tree-like growth, iridescent tarnish expected"
    f.Bi = max(f.Bi - rate * 0.035, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_clinobisvanite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Clinobisvanite (BiVO₄) growth — microscopic yellow Bi-vanadate."""
    sigma = conditions.supersaturation_clinobisvanite()
    if sigma < 1.0:
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(0.5, crystal.total_growth_um * 0.05)
            conditions.fluid.Bi += d * 0.4
            conditions.fluid.V += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)   # microscopic, slow
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "powdery_aggregate"
        crystal.dominant_forms = ["powdery yellow-orange aggregate", "micro-crystalline"]
        color_note = "powdery orange-yellow clinobisvanite (rapid growth, thicker crust)"
    else:
        crystal.habit = "micro_plates_yellow"
        crystal.dominant_forms = ["{010} micro plates", "yellow monoclinic"]
        color_note = "bright yellow micro-platy clinobisvanite (photocatalyst for water splitting)"
    f.Bi = max(f.Bi - rate * 0.025, 0)
    f.V = max(f.V - rate * 0.012, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_cuprite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Cuprite (Cu₂O) growth — the Eh-boundary mineral.

    Four habit variants depending on σ and space:
    - octahedral: slow growth, open vug
    - chalcotrichite (plush/hair): very fast directional, high σ
    - massive earthy ("tile ore"): rapid, space-constrained
    - spinel-law twin: rare, moderate σ
    """
    sigma = conditions.supersaturation_cuprite()
    if sigma < 1.0:
        # Strong acid or pushed past the Eh window → dissolves
        if crystal.total_growth_um > 5 and (conditions.fluid.pH < 3.5 or conditions.fluid.O2 > 1.5):
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.07)
            conditions.fluid.Cu += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dissolution — Eh window exceeded (pH {conditions.fluid.pH:.1f}, O₂ {conditions.fluid.O2:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if excess > 1.5:
        crystal.habit = "chalcotrichite"
        crystal.dominant_forms = ["hair-like {100} whiskers", "plush velvet texture"]
        color_note = f"chalcotrichite — hair-like Cu₂O whiskers (σ {sigma:.2f}, rapid directional growth)"
    elif excess > 0.8:
        crystal.habit = "massive_earthy"
        crystal.dominant_forms = ["massive earthy 'tile ore'", "dark red-brown"]
        color_note = "massive earthy — 'tile ore' in dark red-brown (rapid growth in tight space)"
    elif not crystal.twinned and 0.3 < excess < 0.8 and random.random() < 0.05:
        crystal.twinned = True
        crystal.twin_law = "spinel law {111}"
        crystal.habit = "spinel_twin"
        crystal.dominant_forms = ["{111} octahedron (spinel-law twinned)", "reentrant angles"]
        color_note = "dark red octahedron with spinel-law penetration twin"
    else:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "dark red to black with ruby internal reflection"]
        color_note = "dark red octahedral (ruby-red internal reflection in thin crystals)"

    f.Cu = max(f.Cu - rate * 0.035, 0)
    # Cuprite growth slightly consumes O2 (Cu metal + oxygen → Cu oxide)
    f.O2 = max(f.O2 - rate * 0.002, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_azurite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Azurite (Cu₃(CO₃)₂(OH)₂) growth — deep blue copper carbonate.

    Azurite → malachite conversion mechanic: if CO₃ drops below a
    threshold during azurite's lifetime, the crystal is marked dissolved
    and its chemistry is released to fluid — the pseudomorph would then
    form when malachite nucleates on the same wall cell.
    """
    sigma = conditions.supersaturation_azurite()
    if sigma < 1.0:
        # Acid dissolution (carbonate fizzes)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.CO3 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"carbonate dissolution (pH {conditions.fluid.pH:.1f}) — fizzes, Cu²⁺ + CO₃²⁻ released"
            )
        # Azurite → malachite conversion: CO3 dropped below high-pCO2 threshold
        if crystal.total_growth_um > 5 and conditions.fluid.CO3 < 80:
            crystal.dissolved = True
            d = min(2.5, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.CO3 += d * 0.3   # less than full dissolve — some CO2 escapes
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"azurite → malachite conversion (CO₃ {conditions.fluid.CO3:.0f} ppm drops below pseudomorph threshold)"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.0:
        crystal.habit = "azurite_sun"
        crystal.dominant_forms = ["radiating flat disc", "azurite-sun in fracture"]
        color_note = "deep blue azurite-sun — radiating disc habit in narrow fracture"
    elif excess > 0.4:
        crystal.habit = "rosette_bladed"
        crystal.dominant_forms = ["radiating bladed crystals", "rosette"]
        color_note = "deep blue rosette of radiating blades"
    else:
        crystal.habit = "deep_blue_prismatic"
        crystal.dominant_forms = ["monoclinic prismatic", "deep azure/midnight blue"]
        color_note = "deep azure-blue monoclinic prism"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.025, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_chrysocolla(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) growth — cryptocrystalline cyan-blue
    copper silicate. Grows as botryoidal enamel crusts, grape-cluster
    reniform globules, pseudomorphs after azurite, or thin films over
    earlier cuprite.

    Dissolves in strong acid (pH < 4.5) — releases Cu + SiO₂. Unlike
    azurite/malachite it does NOT pseudomorph further — it's the
    terminal member of the copper oxidation sequence in the sim.
    """
    sigma = conditions.supersaturation_chrysocolla()
    if sigma < 1.0:
        # Acid dissolution — Cu²⁺ + silicic acid released
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            d = min(2.5, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.SiO2 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Cu²⁺ + silicic acid released"
            )
        # Thermal decomposition — dehydrates toward plancheite/shattuckite
        # above ~100 °C. Modeled as quiet removal so the Cu is returned
        # to the fluid pool without a growth zone.
        if crystal.total_growth_um > 5 and conditions.temperature > 120:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.05)
            conditions.fluid.Cu += d * 0.3
            conditions.fluid.SiO2 += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dehydration at {conditions.temperature:.0f} °C — chrysocolla is a strict low-T phase"
            )
        return None

    excess = sigma - 1.0
    # Cryptocrystalline / slow — growth_rate_mult 0.45 from spec
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — based on substrate and σ
    on_cuprite = "cuprite" in (crystal.position or "")
    on_azurite = "azurite" in (crystal.position or "") or "pseudomorph after azurite" in (crystal.position or "")
    on_native_cu = "native_copper" in (crystal.position or "")
    if on_azurite:
        crystal.habit = "pseudomorph_after_azurite"
        crystal.dominant_forms = ["azurite prism outline preserved", "chrysocolla fill"]
        color_note = "cyan chrysocolla pseudomorph — azurite's monoclinic prisms outline preserved in copper silicate"
    elif on_cuprite:
        crystal.habit = "enamel_on_cuprite"
        crystal.dominant_forms = ["thin conformal film"]
        color_note = "sky-blue enamel over the earlier cuprite — Bisbee signature"
    elif on_native_cu:
        crystal.habit = "botryoidal_crust"
        crystal.dominant_forms = ["grape-cluster lobes"]
        color_note = "cyan botryoidal crust coating the native copper sheets"
    elif excess > 1.2:
        crystal.habit = "reniform_globules"
        crystal.dominant_forms = ["reniform globule cluster", "glassy conchoidal fracture"]
        color_note = "thick reniform chrysocolla globules — grape-cluster cyan"
    elif excess > 0.3:
        crystal.habit = "botryoidal_crust"
        crystal.dominant_forms = ["botryoidal crust", "enamel-like"]
        color_note = "cyan-blue botryoidal crust — hydrous copper silicate enamel"
    else:
        crystal.habit = "silica_gel_hemisphere"
        crystal.dominant_forms = ["gel hemisphere"]
        color_note = "pale cyan silica-gel hemisphere — low σ, rounded drop"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.020, 0)
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2 - rate * 0.035, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_native_copper(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native copper (Cu) growth — the elemental metal."""
    sigma = conditions.supersaturation_native_copper()
    if sigma < 1.0:
        # Oxidative dissolution if conditions shift — native Cu becomes
        # cuprite surface film, eventually malachite coating
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.7:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Cu += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidation (O₂ {conditions.fluid.O2:.1f}) — forms cuprite surface film, then malachite if CO₃ is present"
            )
        return None

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)   # slow
    if rate < 0.1:
        return None

    # Habit selection: narrow channel = wire, open space + fast = sheet,
    # moderate = arborescent, rare slow = cubic/dodecahedral
    crowded = any(c.active and c.crystal_id != crystal.crystal_id for c in []) if False else False
    # Simplified — just use excess value as proxy. Real-world native Cu
    # habits depend on pore geometry which the sim doesn't model.
    if excess > 1.5:
        crystal.habit = "massive_sheet"
        crystal.dominant_forms = ["massive sheet copper", "fills large void"]
        color_note = "massive sheet copper (rapid precipitation in open void)"
    elif excess > 0.6:
        crystal.habit = "arborescent_dendritic"
        crystal.dominant_forms = ["arborescent branching growth", "dendritic {100}"]
        color_note = "arborescent dendritic — tree-like branching copper"
    elif excess > 0.25:
        crystal.habit = "wire_copper"
        crystal.dominant_forms = ["wire growth along narrow channel", "filamentary Cu"]
        color_note = "wire copper — filamentary growth in narrow channel"
    else:
        crystal.habit = "cubic_dodecahedral"
        crystal.dominant_forms = ["{100} cube", "{110} rhombic dodecahedron", "rare well-formed crystal"]
        color_note = "cubic/dodecahedral well-formed native copper (rare)"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.04, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_bornite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Bornite (Cu₅FeS₄) growth — peacock ore.

    228°C order-disorder transition flag in dominant_forms. Iridescent
    tarnish on oxidizing surfaces is a cosmetic flag (recorded in
    zone note). Competes with chalcopyrite for Cu+Fe+S.
    """
    sigma = conditions.supersaturation_bornite()
    if sigma < 1.0:
        # Oxidative dissolution — sulfides go to Cu²⁺ + Fe³⁺ at O2 > 1
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.3:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.Fe += d * 0.2
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — releases Cu²⁺, Fe³⁺, S"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    T = conditions.temperature
    if T > 228:
        crystal.habit = "pseudo_cubic"
        crystal.dominant_forms = ["pseudo-cubic {100}", "disordered high-T form"]
        color_note = f"bronze fresh (high-T disordered Cu/Fe, T={T:.0f}°C)"
    elif T > 80:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular", "low-T orthorhombic, ordered Cu/Fe"]
        color_note = f"bronze fresh (ordered low-T form, T={T:.0f}°C)"
    else:
        crystal.habit = "peacock_iridescent"
        crystal.dominant_forms = ["peacock tarnish on ordered bornite", "thin-film iridescence"]
        color_note = f"peacock iridescent tarnish (Cu²⁺ surface products, T={T:.0f}°C)"

    trace_Fe = f.Fe * 0.02
    f.Cu = max(f.Cu - rate * 0.03, 0)
    f.Fe = max(f.Fe - rate * 0.008, 0)
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=color_note,
    )


def grow_chalcocite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chalcocite (Cu₂S) growth — the supergene Cu enrichment mineral.

    Pseudo-hexagonal cyclic sixling twins fire at moderate σ. The
    'pseudomorph thief' habit is flagged when the crystal grows on
    chalcopyrite or bornite (via position string from nucleate()).
    """
    sigma = conditions.supersaturation_chalcocite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — Cu²⁺, S released"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Cyclic sixling twin at moderate σ (chalcocite's iconic collector form)
    if not crystal.twinned and 0.4 < excess < 1.5 and random.random() < 0.15:
        crystal.twinned = True
        crystal.twin_law = "cyclic sixling {110}"

    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        crystal.habit = "stellate_sixling"
        crystal.dominant_forms = ["pseudo-hexagonal sixling twin", "dark gray metallic"]
        color_note = "pseudo-hexagonal sixling twin — the collector habit"
    elif "chalcopyrite" in (crystal.position or "") or "bornite" in (crystal.position or ""):
        crystal.habit = "pseudomorph"
        crystal.dominant_forms = ["pseudomorph after host — inherits outline", "Cu-enriched replacement"]
        color_note = "pseudomorphic — replaced host atom-by-atom (Cu enrichment blanket)"
    elif excess > 1.2:
        crystal.habit = "sooty_massive"
        crystal.dominant_forms = ["sooty microcrystalline aggregate", "supergene enrichment blanket"]
        color_note = "sooty microcrystalline black (rapid enrichment precipitation)"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{110} prism", "tabular habit"]
        color_note = "dark gray metallic tabular"

    f.Cu = max(f.Cu - rate * 0.04, 0)   # chalcocite is a Cu sink
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_covellite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Covellite (CuS) growth — the only common naturally blue mineral.

    Hexagonal platy habit. Iridescent tarnish on fresh cleavage is
    flagged when the crystal is near an oxidation boundary (O₂ mid-
    range 0.5–1.2).
    """
    sigma = conditions.supersaturation_covellite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.2:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.S += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — Cu²⁺ + S released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "rosette_radiating"
        crystal.dominant_forms = ["radiating hexagonal plates", "rosette"]
        color_note = "indigo-blue radiating rosette"
    elif 0.5 < f.O2 < 1.2:
        crystal.habit = "iridescent_coating"
        crystal.dominant_forms = ["iridescent cleavage {0001}", "purple-green thin-film interference"]
        color_note = f"indigo-blue with iridescent purple-green tarnish (near oxidation boundary, O₂ {f.O2:.1f})"
    else:
        crystal.habit = "hex_plate"
        crystal.dominant_forms = ["{0001} hexagonal basal plate", "perfect basal cleavage — peels like mica"]
        color_note = "indigo-blue hexagonal plate — the only common blue mineral"

    f.Cu = max(f.Cu - rate * 0.03, 0)
    f.S = max(f.S - rate * 0.03, 0)   # covellite has 2× S of chalcocite

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_anglesite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Anglesite (PbSO₄) growth — orthorhombic lead sulfate.

    Intermediate in the lead oxidation sequence. Tends to pseudomorph
    galena (inherits cube shape) when it nucleates on a dissolving
    galena crystal. Adamantine luster — one of the most visually
    brilliant non-metallic minerals.
    """
    sigma = conditions.supersaturation_anglesite()
    if sigma < 1.0:
        # Slow acid dissolution
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        # Carbonate replacement — when CO3 is high, anglesite recrystallizes
        # to cerussite. The sim doesn't "transform" crystals, but we can
        # mark anglesite for dissolution when carbonate is overwhelming.
        if crystal.total_growth_um > 5 and conditions.fluid.CO3 > 150:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.04)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"anglesite → cerussite (CO₃ {conditions.fluid.CO3:.0f} ppm overwhelms)"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.Fe > 3.0:
        color_note = f"yellow-amber tint (Fe {f.Fe:.0f} ppm)"
    elif f.Cu > 2.0:
        color_note = f"pale blue-green tint (Cu {f.Cu:.1f} ppm)"
    else:
        color_note = "colorless to white, adamantine luster"

    crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "o{011} orthorhombic dome"]

    trace_Fe = f.Fe * 0.015
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.02, 0)
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_cerussite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Cerussite (PbCO₃) growth — orthorhombic lead carbonate.

    Stellate cyclic twin on {110} is the diagnostic habit: three
    individuals intergrown at 120° producing a perfect six-ray star.
    Twin probability is high at moderate σ (spec: 0.4).
    """
    sigma = conditions.supersaturation_cerussite()
    if sigma < 1.0:
        # Carbonate — fizzes in acid (pH < 4)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.1)
            conditions.fluid.Pb += d * 0.5
            conditions.fluid.CO3 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"carbonate dissolution (pH {conditions.fluid.pH:.1f}) — PbCO₃ + 2H⁺ → Pb²⁺ + H₂O + CO₂, fizzes"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Cyclic sixling twin — the diagnostic habit of cerussite. High
    # probability at moderate σ.
    if not crystal.twinned and 0.3 < excess < 1.5 and random.random() < 0.4:
        crystal.twinned = True
        crystal.twin_law = "cyclic sixling {110}"

    if f.Cu > 5.0:
        color_note = f"blue-green tint (Cu {f.Cu:.1f} ppm)"
    else:
        color_note = "colorless to white, adamantine, extreme birefringence"
    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        color_note += " — six-ray stellate twin"

    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        crystal.habit = "stellate_sixling"
        crystal.dominant_forms = ["cyclic {110} sixling twin", "pseudo-hexagonal outline"]
    elif excess > 1.2:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["fine {110} needles", "radiating sprays"]
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism"]

    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.02, 0)
    f.CO3 = max(f.CO3 - rate * 0.015, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_pyromorphite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Pyromorphite (Pb₅(PO₄)₃Cl) growth — hexagonal apatite-group phosphate.

    Barrel-shaped hexagonal prisms. Olive-green to yellow. Classic
    supergene mineral — P and Cl in meteoric water meet residual Pb
    from an oxidizing Pb-bearing horizon. Can pseudomorph cerussite
    and galena.
    """
    sigma = conditions.supersaturation_pyromorphite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.P += d * 0.2
            conditions.fluid.Cl += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.Fe > 5.0:
        color_note = f"brown to olive-brown (Fe {f.Fe:.0f} ppm)"
        crystal.habit = "brown_hex_barrel"
    elif f.Ca > 80.0:
        color_note = f"pale yellow-orange (phosphoapatite-adjacent, Ca {f.Ca:.0f} ppm)"
        crystal.habit = "yellow_hex_barrel"
    else:
        color_note = "classic olive-green hexagonal barrel"
        crystal.habit = "olive_hex_barrel"

    # Hoppered habit at high σ — edges grow faster than faces
    if excess > 1.5:
        crystal.dominant_forms = ["hoppered {10̄10} hexagonal prism", "step-faced edges"]
    else:
        crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} flat pinacoid", "barrel profile"]

    trace_Fe = f.Fe * 0.015
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.025, 0)
    f.P = max(f.P - rate * 0.008, 0)
    f.Cl = max(f.Cl - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_vanadinite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Vanadinite (Pb₅(VO₄)₃Cl) growth — hexagonal apatite-group vanadate.

    Bright red-orange hexagonal prisms. Classic desert supergene
    mineral — V from oxidizing red-bed ironstones, Pb from galena.
    Color mechanism: V⁵⁺ in the crystal field produces the red-orange;
    trace As substitutes to give endlichite (yellow).
    """
    sigma = conditions.supersaturation_vanadinite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.V += d * 0.2
            conditions.fluid.Cl += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.As > 2.0:
        color_note = f"yellow endlichite (As {f.As:.1f} + V {f.V:.1f} mix)"
        crystal.habit = "endlichite_yellow"
    elif f.Fe > 5.0:
        color_note = f"brown-orange (Fe {f.Fe:.0f} ppm)"
        crystal.habit = "brown_hex_prism"
    else:
        color_note = f"bright red-orange (V⁵⁺ {f.V:.1f} ppm — the signature)"
        crystal.habit = "red_hex_prism"

    crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "flat basal termination"]

    trace_Fe = f.Fe * 0.010
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.025, 0)
    f.V = max(f.V - rate * 0.008, 0)
    f.Cl = max(f.Cl - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_galena(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Galena (PbS) growth. Cubic lead sulfide, bright metallic luster, very dense."""
    sigma = conditions.supersaturation_galena()

    if sigma < 1.0:
        # Oxidative dissolution under O2 — the dominant pathway (path to cerussite/anglesite/wulfenite)
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Pb += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidation — galena dissolving, releasing Pb²⁺ (path to cerussite/anglesite)"
            )
        # Strong-acid dissolution (per spec acid_dissolution.pH_threshold = 2.0).
        # PbS + 2H⁺ → Pb²⁺ + H₂S — slow, non-oxidative, classic lab reaction.
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.05)  # slower than oxidative
            conditions.fluid.Pb += dissolved_um * 0.3
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"strong-acid dissolution (pH {conditions.fluid.pH:.1f}) — PbS + 2H⁺ → Pb²⁺ + H₂S"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    if 200 <= conditions.temperature <= 400:
        rate *= 1.2
    if rate < 0.1:
        return None

    crystal.habit = "cubic"
    crystal.dominant_forms = ["{100} cube", "{111} octahedron"]

    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    if not crystal.twinned and random.random() < 0.008:
        crystal.twinned = True
        crystal.twin_law = "spinel-law {111}"

    color_note = "lead-gray, bright metallic luster"
    if conditions.fluid.Ag > 5:
        color_note += ", argentiferous (Ag inclusions)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        trace_Pb=conditions.fluid.Pb * 0.01,
        note=color_note
    )


def grow_uraninite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Uraninite (UO₂) growth. Pitch-black primary uranium mineral. Emits radiation."""
    sigma = conditions.supersaturation_uraninite()
    if sigma < 1.0:
        return None

    rate = 4.0 * sigma * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    crystal.habit = "cubic"
    crystal.dominant_forms = ["{100} cube", "{111} octahedron"]

    conditions.fluid.U = max(conditions.fluid.U - rate * 0.005, 0)

    color_note = "pitch-black, submetallic luster" if conditions.temperature > 450 else "black to dark green, submetallic luster"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.01,
        note=f"{color_note} — radioactive"
    )


def grow_molybdenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Molybdenite (MoS₂) growth. Soft hexagonal platy, bluish-gray metallic."""
    sigma = conditions.supersaturation_molybdenite()

    if sigma < 1.0:
        # Oxidation releases Mo back to fluid — essential for wulfenite
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 0.3:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.15)
            conditions.fluid.Mo += dissolved_um * 0.8
            conditions.fluid.S += dissolved_um * 0.2
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidation — molybdenite dissolves, releasing MoO₄²⁻ (Mo fluid: {conditions.fluid.Mo:.0f} ppm)"
            )
        return None

    rate = 4.0 * sigma * random.uniform(0.8, 1.2)
    if 300 <= conditions.temperature <= 500:
        rate *= 1.3
    if rate < 0.1:
        return None

    crystal.habit = "hexagonal platy"
    crystal.dominant_forms = ["{0001} basal pinacoid", "{10-10} prism"]

    conditions.fluid.Mo = max(conditions.fluid.Mo - rate * 0.004, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.002,
        note="bluish-gray metallic, platy habit, sectile"
    )


def grow_goethite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Goethite (FeO(OH)) growth — the ghost mineral made real.

    FeO(OH) — rust with a crystal name. Low-temperature oxidation product of
    Fe-sulfides and Fe²⁺ fluids. Botryoidal, mammillary, fibrous. Often
    pseudomorphs pyrite/marcasite (Egyptian Prophecy Stones = goethite after
    marcasite). Dehydrates to hematite above 300°C — hence the thermal cap.
    """
    sigma = conditions.supersaturation_goethite()

    if sigma < 1.0:
        # Acid dissolution (FeO(OH) + 3H⁺ → Fe³⁺ + 2H₂O)
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Fe += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — goethite releases Fe³⁺"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.7, 1.3)
    if rate < 0.1:
        return None

    # Habit evolves with zone count — botryoidal aggregates build up
    zone_count = len(crystal.zones)
    if zone_count >= 20:
        crystal.habit = "botryoidal/stalactitic"
        crystal.dominant_forms = ["botryoidal masses", "velvety surfaces"]
    elif zone_count >= 8:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["grape-like clusters", "reniform masses"]
    elif "pseudomorph after" in crystal.position:
        crystal.habit = "pseudomorph_after_sulfide"
        crystal.dominant_forms = ["replaces sulfide cube", "preserves parent habit"]
    else:
        crystal.habit = "fibrous_acicular"
        crystal.dominant_forms = ["radiating needles", "velvet crust"]

    # Botryoidal aggregates expand laterally too
    if "botryoidal" in crystal.habit:
        crystal.a_width_mm = crystal.c_length_mm * 1.6

    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.008, 0)
    # Goethite incorporation of oxygen — decrement O2 slightly
    conditions.fluid.O2 = max(conditions.fluid.O2 - rate * 0.001, 0)

    # Color note
    if "pseudomorph" in crystal.habit:
        color_note = "yellow-brown pseudomorph after pyrite — the boxwork ghost"
    elif "botryoidal" in crystal.habit:
        color_note = "black lustrous botryoidal surfaces, velvety sheen"
    else:
        color_note = "yellow-brown earthy to ochre"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.02,
        note=color_note
    )


def grow_smithsonite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Smithsonite (ZnCO₃) growth. Botryoidal supergene carbonate — sphalerite's oxidation heir."""
    sigma = conditions.supersaturation_smithsonite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Zn += dissolved_um * 0.6
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — smithsonite fizzes, releasing Zn²⁺"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    zone_count = len(crystal.zones)
    if zone_count >= 15:
        crystal.habit = "botryoidal/stalactitic"
        crystal.dominant_forms = ["botryoidal crusts", "stalactitic masses"]
    elif rate > 6:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["{10-11} rhombohedron", "curved faces"]
    else:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["grape-like clusters", "reniform masses"]

    if "botryoidal" in crystal.habit:
        crystal.a_width_mm = crystal.c_length_mm * 1.8

    conditions.fluid.Zn = max(conditions.fluid.Zn - rate * 0.008, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.005, 0)

    if not crystal.twinned and random.random() < 0.01:
        crystal.twinned = True
        crystal.twin_law = "cyclic {01-12}"

    if conditions.fluid.Cu > 15:
        color_note = "apple-green (Cu impurity)"
    elif conditions.fluid.Fe > 20:
        color_note = "yellow-brown (Fe impurity)"
    elif conditions.fluid.Mn > 10:
        color_note = "pink (Mn impurity)"
    else:
        color_note = "blue-green" if random.random() < 0.4 else "white to pale blue"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.01,
        trace_Mn=conditions.fluid.Mn * 0.03,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_wulfenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Wulfenite (PbMoO₄) growth. Thin tabular plates, orange-yellow. The sunset mineral."""
    sigma = conditions.supersaturation_wulfenite()

    if sigma < 1.0:
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.5:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Pb += dissolved_um * 0.5
            conditions.fluid.Mo += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="acid dissolution — wulfenite releases Pb²⁺ and MoO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    crystal.habit = "tabular"
    crystal.dominant_forms = ["{001} tabular plates", "square outline"]
    # Very flat plates
    crystal.a_width_mm = crystal.c_length_mm * 3.0

    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.006, 0)
    conditions.fluid.Mo = max(conditions.fluid.Mo - rate * 0.004, 0)

    if not crystal.twinned and random.random() < 0.03:
        crystal.twinned = True
        crystal.twin_law = "penetration twin {001}/{100}"

    if conditions.fluid.Cr > 5:
        color_note = "red-orange (Cr impurity)"
    elif rate > 5:
        color_note = "honey-yellow, translucent"
    else:
        color_note = "orange tabular plates" if random.random() < 0.5 else "honey-orange, vitreous luster"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        trace_Pb=conditions.fluid.Pb * 0.01,
        note=color_note
    )


def grow_selenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Selenite / Gypsum (CaSO₄·2H₂O) growth. Low-T evaporite, Naica's giant crystals."""
    sigma = conditions.supersaturation_selenite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.4
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — selenite dissolves slowly"
            )
        return None

    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.8, 1.2)
    # Naica sweet spot — exceptionally stable 58°C grows monster crystals
    if 55 <= conditions.temperature <= 58:
        rate *= 1.4
    if rate < 0.1:
        return None

    zone_count = len(crystal.zones)
    if zone_count >= 30:
        crystal.habit = "cathedral_blade"
        crystal.dominant_forms = ["{010} blade", "{110} prism", "swallowtail tip"]
    elif rate > 8:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{010} tabular", "{120} lateral pinacoid"]
    else:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{110} prism", "{011} dome"]

    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.008, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.005, 0)

    if not crystal.twinned and random.random() < 0.08:
        crystal.twinned = True
        crystal.twin_law = "swallowtail {100}"

    if conditions.temperature < 30:
        color_note = "colorless, glassy, transparent"
    elif conditions.fluid.Fe > 20:
        color_note = "pale amber (Fe stain)"
    else:
        color_note = "water-clear selenite"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.004,
        note=color_note
    )


# Mineral registry — every spec'd mineral has a growth engine.
# See data/minerals.json for the source-of-truth field declarations.
MINERAL_ENGINES = {
    "quartz": grow_quartz,
    "calcite": grow_calcite,
    "sphalerite": grow_sphalerite,
    "wurtzite": grow_wurtzite,
    "fluorite": grow_fluorite,
    "pyrite": grow_pyrite,
    "marcasite": grow_marcasite,
    "chalcopyrite": grow_chalcopyrite,
    "hematite": grow_hematite,
    "malachite": grow_malachite,
    "adamite": grow_adamite,
    "mimetite": grow_mimetite,
    "feldspar": grow_feldspar,
    "albite": grow_albite,
    "galena": grow_galena,
    "uraninite": grow_uraninite,
    "molybdenite": grow_molybdenite,
    "goethite": grow_goethite,
    "smithsonite": grow_smithsonite,
    "wulfenite": grow_wulfenite,
    "selenite": grow_selenite,
    "topaz": grow_topaz,
    "tourmaline": grow_tourmaline,
    "beryl": grow_beryl,
    "spodumene": grow_spodumene,
    "anglesite": grow_anglesite,
    "cerussite": grow_cerussite,
    "pyromorphite": grow_pyromorphite,
    "vanadinite": grow_vanadinite,
    "bornite": grow_bornite,
    "chalcocite": grow_chalcocite,
    "covellite": grow_covellite,
    "cuprite": grow_cuprite,
    "azurite": grow_azurite,
    "chrysocolla": grow_chrysocolla,
    "native_copper": grow_native_copper,
    "magnetite": grow_magnetite,
    "lepidocrocite": grow_lepidocrocite,
    "stibnite": grow_stibnite,
    "bismuthinite": grow_bismuthinite,
    "native_bismuth": grow_native_bismuth,
    "clinobisvanite": grow_clinobisvanite,
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
    "wurtzite":   (1020, "hexagonal ZnS → sublimation (shares sphalerite decomposition)", {"Zn": 0.3, "S": 0.5}),
    "fluorite":   (1360, "CaF₂ melting — extremely refractory",                   {"Ca": 0.4, "F": 0.4}),
    "pyrite":     (743,  "FeS₂ → FeS + S (sulfur driven off)",                    {"Fe": 0.5, "S": 0.4}),
    "marcasite":  (240,  "orthorhombic FeS₂ → cubic FeS₂ (pyrite) — metastable inversion", {"Fe": 0.4, "S": 0.3}),
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
    """Two fluids meet — classic MVT mechanism.

    Note on F: real MVT brines from Mississippi Valley / Cave-in-Rock carry
    tens of ppm F. Bumping from 15 → 40 so fluorite actually crosses σ=1.2
    in the MVT scenario (Task 3 audit finding, phase 2).
    """
    conditions.fluid.Zn = 150.0
    conditions.fluid.S = 120.0
    conditions.fluid.Ca += 100.0
    conditions.fluid.F += 40.0
    conditions.fluid.Pb += 25.0   # MVT fluids carry Pb too — enables galena
    conditions.fluid.Fe += 30.0
    conditions.temperature -= 20
    return "Fluid mixing event. Metal-bearing brine meets sulfur-bearing groundwater. Sphalerite, fluorite, and galena become possible."


# ============================================================
# SCENARIOS
# ============================================================

def scenario_cooling() -> Tuple[VugConditions, List[Event], int]:
    """Simple cooling scenario — hot fluid cools slowly in a vug."""
    conditions = VugConditions(
        temperature=380.0,
        pressure=1.5,
        fluid=FluidChemistry(SiO2=600, Ca=150, CO3=100, Fe=8, Mn=3, Ti=0.8, Al=4),
        # Phase-1 void shape: gas-bubble cavity — few primaries, minimal
        # satellite dissolution.
        wall=VugWall(primary_bubbles=2, secondary_bubbles=3, shape_seed=1),
    )
    events = []
    return conditions, events, 100


def scenario_pulse() -> Tuple[VugConditions, List[Event], int]:
    """Cooling with a fluid pulse event mid-growth."""
    conditions = VugConditions(
        temperature=350.0,
        pressure=1.2,
        fluid=FluidChemistry(SiO2=500, Ca=200, CO3=120, Fe=5, Mn=2, Ti=0.5, Al=3),
        wall=VugWall(primary_bubbles=2, secondary_bubbles=3, shape_seed=2),
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
        ),
        # MVT — dissolution cavity in limestone. Cohesive primary void
        # plus heavy secondary alcoves: the classic merged-cavity feel.
        wall=VugWall(primary_bubbles=3, secondary_bubbles=8, shape_seed=3),
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
            Zn=0, S=60, F=5, Cu=0, Pb=15,
            # Sb + Bi traces — porphyries carry a greisen signature
            # when the late hydrothermal phase taps tin-tungsten-
            # arsenic-bearing granites. 25 ppm Sb and 30 ppm Bi are in
            # the published range for Sb-Bi-bearing porphyry fluids
            # (see Heinrich 2007 greisen fluid chemistry).
            Sb=25, Bi=30,
            O2=0.2, pH=4.5, salinity=10.0
        ),
        # Porphyry stockwork — primary void plus a moderate set of
        # secondary alcoves where vein intersections widen the pocket.
        wall=VugWall(primary_bubbles=3, secondary_bubbles=6, shape_seed=4),
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
            # Polymetallic limestone brine — real Zn-bearing carbonate-
            # hosted vugs almost always carry Pb too (galena travels
            # with sphalerite), and Ba is classic (barite is a common
            # late-stage phase).
            Zn=80, Pb=30, Ba=25, S=60, F=8,
            pH=7.0, salinity=18.0
        ),
        wall=VugWall(
            composition="limestone",
            thickness_mm=500.0,
            vug_diameter_mm=40.0,
            wall_Fe_ppm=3000.0,   # iron-bearing limestone
            wall_Mn_ppm=800.0,    # Mn in the host rock
            # Aggressive acid dissolution — 3 primary + 10 secondary
            # bubbles give the deeply lobed cavity of a reactive front.
            primary_bubbles=3,
            secondary_bubbles=10,
            shape_seed=5,
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


def scenario_radioactive_pegmatite() -> Tuple[VugConditions, List[Event], int]:
    """Radioactive pegmatite — high-T alkali granite pocket.

    Pegmatitic fluids are silica-saturated melts with abundant K+Na+Al+U.
    Grows uraninite, smoky quartz (from radiation), feldspar/albite,
    and late-stage galena from radiogenic Pb. Already declared in web/;
    ported to vugg.py so uraninite / feldspar / albite actually nucleate.
    """
    conditions = VugConditions(
        temperature=600.0,
        pressure=2.0,
        fluid=FluidChemistry(
            SiO2=12000, Ca=50, CO3=20, Fe=60, Mn=8,
            S=40, F=25, U=150, Pb=30,
            K=80, Na=50, Al=30,
            # Classic pegmatite-defining trace indicators — no current
            # mineral consumes them, but the narrator reads them as
            # beryl/spodumene/tourmaline/apatite country.
            Be=20, Li=40, B=25, P=8,
            O2=0.0, pH=6.5, salinity=8.0,
        ),
        # Pegmatite pocket — 4 primaries form a fracture-controlled
        # cavity, 5 secondaries add modest alcoves.
        wall=VugWall(primary_bubbles=4, secondary_bubbles=5, shape_seed=6),
    )

    def ev_pegmatite_crystallization(cond):
        cond.temperature = 450
        cond.fluid.SiO2 += 3000
        return ("The pegmatite melt differentiates. Volatile-rich residual "
                "fluid floods the pocket. Quartz begins to grow in earnest. "
                "Uraninite cubes nucleate where uranium is concentrated.")

    def ev_deep_time(cond):
        cond.temperature = 300
        return ("Deep time passes. The uraninite sits in its cradle of "
                "cooling rock, silently emitting alpha particles. Each decay "
                "transmutes one atom of uranium into lead. The quartz "
                "growing nearby doesn't know it yet, but it's darkening.")

    def ev_oxidizing(cond):
        cond.fluid.O2 += 0.8
        cond.temperature = 120
        cond.flow_rate = 1.5
        return ("Oxidizing meteoric fluids seep through fractures. "
                "The reducing environment shifts. Sulfides become unstable. "
                "The uraninite endures — it has been enduring for millions of years.")

    def ev_final_cooling(cond):
        cond.temperature = 50
        cond.flow_rate = 0.1
        return ("The system cools to near-ambient. What remains is a "
                "pegmatite pocket: black uraninite cubes, smoky quartz "
                "darkened by radiation, galena crystallized from the lead "
                "that uranium became. Time wrote this assemblage.")

    events = [
        Event(20, "Pegmatite Crystallization", "Main crystallization pulse", ev_pegmatite_crystallization),
        Event(50, "Deep Time", "Eons pass — radiation accumulates", ev_deep_time),
        Event(80, "Oxidizing Fluids", "Late-stage meteoric water", ev_oxidizing),
        Event(100, "Final Cooling", "System approaches ambient", ev_final_cooling),
    ]
    return conditions, events, 120


def scenario_supergene_oxidation() -> Tuple[VugConditions, List[Event], int]:
    """Supergene oxidation — low-T, oxidizing water-table zone.

    The cold, oxygenated domain where primary sulfides weather into secondary
    minerals. Pb+Mo → wulfenite. Zn+CO₃ → smithsonite. Zn+As → adamite.
    Pb+As+Cl → mimetite. Fe → goethite. Ca+SO₄ → selenite. Cu+CO₃ → malachite.
    Fills the gap flagged in TASK-BRIEF-2: wulfenite etc. can't reach their
    <80°C stability window in the hydrothermal scenarios.
    """
    conditions = VugConditions(
        temperature=35.0,          # shallow water-table zone
        pressure=0.05,             # near-surface
        fluid=FluidChemistry(
            # CO3 80 → 110 so azurite's high-pCO2 gate (CO3 ≥ 120 after
            # meteoric flush adds 30) can be reached in a limestone-
            # hosted supergene vug. Real azurite localities (Bisbee,
            # Chessy, Tsumeb) all have limestone or dolomite wall rock.
            SiO2=30, Ca=120, CO3=110, Fe=40, Mn=6, Mg=5,
            Zn=90, S=50, F=3,
            # Cu 25 → 55: enough to feed chalcocite/bornite at supergene
            # enrichment zones (real supergene fluids run 50–200 ppm Cu²⁺
            # above the enrichment blanket). Pb bumped 35 → 60 for
            # anglesite/cerussite/pyromorphite saturation.
            Cu=55, Pb=60, Mo=15,
            As=12, Cl=20,
            # Vanadium trace — roll-front / red-bed signature. Low
            # starting value; bumped later by ev_v_bearing_seep.
            V=1.5,
            # Phosphorus trace — meteoric water typically carries <1 ppm P;
            # pyromorphite's gate is P>2, so it waits for a phosphate
            # event later in the scenario.
            P=0.5,
            O2=1.8, pH=6.8, salinity=2.0,
        ),
        # Supergene oxidation front — 3 primary + 7 secondary bubbles
        # model complex meteoric dissolution cavity formation.
        wall=VugWall(primary_bubbles=3, secondary_bubbles=7, shape_seed=7),
    )

    def ev_meteoric_flush(cond):
        """Rain-fed oxygenated water recharges the aquifer."""
        cond.fluid.O2 = 2.2
        cond.fluid.CO3 += 30
        cond.fluid.pH = 6.2
        cond.flow_rate = 1.5
        return ("Rain infiltrates the soil zone and percolates down, picking "
                "up CO₂ and oxygen. Fresh supergene brine — cold, oxygen-rich, "
                "slightly acidic. Any remaining primary sulfides are on borrowed time.")

    def ev_pb_mo_pulse(cond):
        """A fracture opens to a primary galena/molybdenite source — Pb and Mo surge."""
        cond.fluid.Pb += 40
        cond.fluid.Mo += 25
        cond.fluid.O2 = 2.0
        cond.flow_rate = 2.0
        return ("A weathering rind breaches: Pb²⁺ and MoO₄²⁻ released "
                "simultaneously from an oxidizing galena+molybdenite lens. "
                "The Seo et al. (2012) condition for wulfenite formation — "
                "both parents dying at once — is met.")

    def ev_dry_spell(cond):
        """Evaporation concentrates sulfate → selenite potential."""
        cond.fluid.Ca += 40
        cond.fluid.S += 30
        cond.fluid.O2 = 1.5
        cond.temperature = 50  # slight warming, still well below 60°C anhydrite line
        cond.flow_rate = 0.3
        return ("Dry season. Flow slows, evaporation concentrates the brine. "
                "Ca²⁺ and SO₄²⁻ climb toward selenite's window — the desert-rose "
                "chemistry, the Naica chemistry.")

    def ev_as_rich_seep(cond):
        """Arsenic-bearing seep — feeds adamite + mimetite."""
        cond.fluid.As += 8
        cond.fluid.Cl += 10
        cond.fluid.Zn += 20
        cond.fluid.pH = 6.0
        return ("An arsenic-bearing seep arrives from a weathering "
                "arsenopyrite body upslope. Zn²⁺ + AsO₄³⁻ begins to saturate "
                "for adamite; Pb²⁺ + AsO₄³⁻ + Cl⁻ for mimetite.")

    def ev_cu_enrichment(cond):
        """Primary chalcopyrite weathers upslope — Cu²⁺ descends.
        Representative of the supergene enrichment zone's feed: Cu
        released from an oxidizing chalcopyrite lens travels with the
        water table, accumulates above reducing substrates below, and
        precipitates as bornite/chalcocite/covellite.

        Drops fluid O2 to 0.6 for a window — the sim's 1D O2 can't
        directly model the Eh gradient between the oxidized cap and
        reduced substrate, so we brute-force simulate 'Cu-rich fluid
        hit the reducing layer' by briefly pulling fluid O2 down.
        Ambient cooling will re-oxidize it within ~10 steps."""
        cond.fluid.Cu += 50.0
        cond.fluid.S += 30.0   # chalcopyrite is 35% S — significant release
        cond.fluid.Fe += 10.0
        cond.fluid.O2 = 0.6   # local reducing pulse at the enrichment zone
        return ("A primary chalcopyrite lens upslope finishes oxidizing. "
                "Cu²⁺ descends with the water table and hits the reducing "
                "layer below — the supergene enrichment blanket, where "
                "mineable copper ore gets made. Bornite precipitates on "
                "the upgradient edge, chalcocite in the core, covellite "
                "where S activity is highest. Real orebodies are often "
                "5–10× richer here than in the primary sulfide below.")

    def ev_phosphate_seep(cond):
        """Phosphate-bearing groundwater — enables pyromorphite."""
        cond.fluid.P += 6.0
        cond.fluid.Cl += 5.0
        cond.fluid.pH = 6.4
        return ("A phosphate-bearing groundwater seeps in from the soil "
                "zone — organic decay, weathered apatite bedrock, bat guano "
                "from above. P jumps past pyromorphite's saturation "
                "threshold, and any Pb still in solution has a new home.")

    def ev_v_bearing_seep(cond):
        """V-bearing fluid from red-bed sediments — enables vanadinite."""
        cond.fluid.V += 6.0
        cond.fluid.Cl += 8.0
        cond.temperature = 45   # late dry phase, slight warming
        return ("A vanadium-bearing seep arrives from a weathering red-bed "
                "ironstone upslope. V⁵⁺ leaches from oxidizing roll-front "
                "vanadates, and at Pb + V + Cl saturation the bright "
                "red-orange vanadinite nucleates — the classic "
                "'vanadinite on goethite' habit of the Morocco / Arizona "
                "desert deposits.")

    def ev_fracture_seal(cond):
        """System seals — final equilibration."""
        cond.flow_rate = 0.05
        cond.fluid.O2 = 1.0
        return ("The feeding fractures seal. The vug becomes a closed cold "
                "oxidizing system. Whatever is supersaturated will precipitate; "
                "whatever is undersaturated will quietly corrode.")

    events = [
        Event(20,  "Meteoric Flush",  "Oxygenated rainwater recharges",          ev_meteoric_flush),
        Event(40,  "Pb+Mo Pulse",     "Galena+molybdenite weathering",           ev_pb_mo_pulse),
        Event(55,  "Cu Enrichment",   "Primary chalcopyrite upslope weathers",   ev_cu_enrichment),
        Event(70,  "Dry Spell",       "Evaporation concentrates sulfate",        ev_dry_spell),
        Event(95,  "Arsenic Seep",    "Zn/Pb arsenate saturation",               ev_as_rich_seep),
        Event(115, "Phosphate Seep",  "Soil-zone PO₄ enables pyromorphite",      ev_phosphate_seep),
        Event(130, "V-bearing Seep",  "Red-bed V leaches in, vanadinite fires",  ev_v_bearing_seep),
        Event(160, "Fracture Seal",   "System closes",                            ev_fracture_seal),
    ]
    return conditions, events, 200


def scenario_gem_pegmatite() -> Tuple[VugConditions, List[Event], int]:
    """Minas Gerais Gem Pegmatite Pocket — Variant A.

    A miarolitic cavity in a complex zoned pegmatite at the São Francisco
    craton margin. Brasiliano orogeny, 700–450 Ma. The outer pegmatite
    shell (microcline + quartz + muscovite + schorl) has already
    crystallized; this vug is the residual pocket where incompatible
    elements (Be, B, Li, F) accumulate beyond belief before crossing
    saturation and nucleating their exotic species.

    Thermal regime: 650 → 300°C over ~220 steps in three phases.
    Phase 1 (650–550°C): wall-zone crystallization (microcline, quartz,
    early schorl).
    Phase 2 (550–400°C): main pocket growth. Beryl finally nucleates
    when Be crosses threshold; spodumene when Li crosses; schorl
    transitions to elbaite as Fe depletes and Li accumulates.
    Phase 3 (400–300°C): late hydrothermal — topaz if F survives,
    goethite if any Fe-sulfides weathered.

    Saturation cascade mechanic: there is no explicit "nucleate beryl
    now" command. Each mineral's supersaturation formula reads the
    current fluid, and the nucleation gates fire in order naturally
    as chemistry evolves — microcline first (K-feldspar = feldspar here),
    then the Be/Li/B gates cross as incompatible elements build up.
    """
    conditions = VugConditions(
        temperature=650.0,
        pressure=3.0,
        # Pegmatite country rock — silicate host (the granite shell around
        # the miarolitic cavity). Not acid-reactive on sim timescales, so
        # when the pocket fluid turns mildly acidic in phase 3 the pH
        # actually stays low instead of getting buffered by carbonate
        # dissolution. That's what lets grow_feldspar's kaolinization
        # branch fire on the microcline crystal.
        wall=VugWall(
            composition="pegmatite",
            thickness_mm=500.0,
            vug_diameter_mm=50.0,
            # Miarolitic gem pocket — 4 primary + 5 secondary bubbles,
            # same shape family as the radioactive pegmatite.
            primary_bubbles=4,
            secondary_bubbles=5,
            shape_seed=8,
        ),
        fluid=FluidChemistry(
            # Pegmatite-level silica saturation — far above the quartz
            # equilibrium at any T, so quartz is supersaturated throughout.
            SiO2=8000,
            # Al starts high enough that six competing silicate engines
            # (feldspar, albite, quartz, tourmaline, beryl, spodumene)
            # can all draw on it for the full scenario AND leave enough
            # residual for topaz to nucleate in phase 3. 150 ppm is on
            # the upper end of realistic pegmatite pocket fluid Al but
            # within published ranges (London 2008, pegmatite fluid
            # chemistry).
            Ca=30, CO3=15, Fe=50, Mn=8, Al=150,
            # Alkali feldspar chemistry — microcline first, then
            # ev_albitization flips K → Na.
            K=80, Na=40,
            # Incompatible elements — these are the point of the scenario.
            # All start above their respective mineral's minimum required
            # threshold but below the nucleation σ threshold; they build
            # (unused early) and then the cascade fires.
            Be=25,     # beryl nucleation σ 1.8 — waits longest
            B=35,      # tourmaline σ 1.3 — fires earliest once hot
            Li=35,     # spodumene σ 1.5, also feeds elbaite
            F=25,      # topaz σ 1.4 — fires late when T drops into window
            # Color-element traces. Cr from the hinted ultramafic contact;
            # Mn for morganite/kunzite/rubellite; Cu for the Paraíba long-
            # shot (1 in 20 scenarios lands it given seed variance).
            Cr=2.5, Cu=0.3, V=2.0, Ti=0.8,
            O2=0.1, pH=6.8, salinity=6.0,
        )
    )

    def ev_outer_shell(cond):
        """Phase 1: outer shell continues crystallizing, wall zone fills in."""
        cond.temperature = 620
        cond.flow_rate = 1.0
        return ("The outer pegmatite shell is already cooling. Microcline "
                "and quartz dominate the wall zone, growing inward into "
                "the void. The pocket fluid inside is enriched in the "
                "elements nothing else wanted: beryllium, boron, lithium, "
                "fluorine. They haven't crossed any saturation thresholds "
                "yet — they are simply accumulating.")

    def ev_first_schorl(cond):
        """Phase 1→2: Fe + B supersaturation crosses, schorl begins.
        Schorl takes B and Fe — the first incompatible-element mineral
        to fire in the cascade."""
        cond.temperature = 560
        cond.flow_rate = 0.9
        return ("The pocket has cooled enough that tourmaline can form. "
                "Boron has been accumulating in the fluid for thousands of "
                "years; with Fe²⁺ still abundant, the schorl variety "
                "nucleates. Deep black prisms begin projecting from the "
                "wall. Each new zone records a fluid pulse — the "
                "striations are the pocket's diary.")

    def ev_albitization(cond):
        """Phase 2: the albitization event. As quartz + K-feldspar
        crystallize, the residual fluid's K/Na ratio inverts. Na now
        dominates, and albite begins replacing microcline. Microcline
        dissolution releases K back to the fluid (a second muscovite-
        style pulse is implied). Textbook pegmatite replacement."""
        cond.fluid.K = max(cond.fluid.K - 30, 10)     # K is consumed by microcline
        cond.fluid.Na += 40                            # Na surges
        cond.fluid.Al += 10                            # from feldspar breakdown
        cond.fluid.pH += 0.2
        cond.temperature = 500
        return ("Albitization event. The pocket's K has depleted faster than "
                "its Na — microcline starts dissolving and albite begins "
                "precipitating in its place. K²⁺ returns to the fluid, "
                "enabling a second generation of mica-like phases. This "
                "replacement cascade is the most Minas Gerais thing about "
                "a Minas Gerais pegmatite: the pocket is rearranging itself.")

    def ev_be_saturation(cond):
        """Phase 2: Be finally crosses beryl's nucleation threshold.
        The dramatic moment the scenario builds toward."""
        cond.temperature = 450
        cond.flow_rate = 0.8
        return ("Beryllium has been accumulating for a dozen thousand "
                "years. Every earlier mineral refused it. Now σ crosses "
                "1.8 and the first beryl crystal nucleates. Because Be "
                "had so long to build, the crystal has a lot of material "
                "waiting — this is how meter-long beryls form. What "
                "color depends on who else is in the fluid. Morganite if "
                "Mn won the lottery; aquamarine if Fe did; emerald if "
                "Cr leached in from an ultramafic contact somewhere.")

    def ev_li_phase(cond):
        """Phase 2→3: temperature drops into the Li-bearing mineral
        sweet spot. Spodumene and elbaite tourmaline compete for Li."""
        cond.temperature = 420
        cond.fluid.Fe = max(cond.fluid.Fe - 20, 5)   # Fe depleting — elbaite territory
        return ("Temperature drops into the 400s. Lithium, which has been "
                "accumulating since the beginning, is now abundant enough "
                "to nucleate Li-bearing minerals. Spodumene will take "
                "most of it — the Li pyroxene wants its own crystals. "
                "Any remaining Li goes into elbaite overgrowths on the "
                "schorl cores: the crystals become color-zoned as iron "
                "depletes and lithium takes its place.")

    def ev_late_hydrothermal(cond):
        """Phase 3: below ~400°C, topaz window opens. Enough residual Al
        survives in the pocket fluid (scenario started at 150 ppm, a
        pegmatite-realistic level) for topaz to cross its σ threshold
        once T drops into the optimum window."""
        cond.temperature = 360
        cond.fluid.pH = 5.5
        cond.flow_rate = 0.5
        return ("Late hydrothermal phase. Temperature drops into topaz's "
                "optimum window (340–400°C). Fluorine has been sitting "
                "unused — nothing else in this pocket consumed it — and "
                "enough Al remains in the residual pocket fluid after "
                "the main silicate crop has taken its share. Topaz "
                "nucleates, projecting from the quartz lining.")

    def ev_clay_softening(cond):
        """Phase 3: the kaolinization event. pH drops past microcline's
        stability threshold (pH < 4); the grow_feldspar engine
        dissolution branch fires, breaking the K-feldspar crystal down
        into kaolinite + K⁺ + SiO₂. Al is conserved in the new
        kaolinite phase (the sim doesn't track kaolinite as a distinct
        mineral — it's an implicit Al sink), so this event liberates K
        and SiO₂ back to the fluid but NOT Al. Albite is more
        acid-resistant (pH threshold 3) and survives at pH 3.5,
        matching the field observation.

        The narrative consequence: the pocket walls soften mechanically
        as microcline → kaolinite, but the fluid's Al inventory stays
        roughly the same. Late topaz already got its Al earlier when
        the residual pocket fluid carried it."""
        cond.temperature = 320
        cond.fluid.pH = 3.5   # crosses microcline kaolinization threshold
                              # (feldspar engine dissolves at pH < 4.0)
        cond.flow_rate = 0.3
        return ("pH drops into the kaolinization window. Microcline in "
                "the pocket walls starts breaking down into kaolinite — "
                "the signature 'clay gloop' that coats every Minas "
                "Gerais gem pocket by the time garimpeiros crack it "
                "open. The reaction 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite "
                "+ 2 K⁺ + 4 SiO₂ releases potassium and silica to the "
                "fluid, but the aluminum stays locked in the new "
                "kaolinite. Albite is more acid-resistant and survives "
                "intact — a field observation preserved in the sim.")

    def ev_final(cond):
        """Phase 3 end: system cools to 300°C and then ambient over
        deep time. No more growth, no more events."""
        cond.temperature = 300
        cond.flow_rate = 0.1
        return ("The system cools to 300°C, below spodumene's window and "
                "approaching topaz's lower edge. Growth slows to near-"
                "zero. Deep time will do the rest: this pocket will wait "
                "half a billion years before human hands crack it open, "
                "and the garimpeiros will sort the crystals by color in "
                "the order the fluid deposited them.")

    events = [
        Event(5,   "Outer Shell",      "Wall-zone microcline + quartz",           ev_outer_shell),
        Event(30,  "Schorl Arrives",   "B + Fe²⁺ supersaturation — first tourmaline", ev_first_schorl),
        Event(60,  "Albitization",     "K-feldspar → albite replacement cascade", ev_albitization),
        Event(90,  "Be Saturation",    "Beryl finally nucleates — enormous crystals incoming", ev_be_saturation),
        Event(130, "Li Phase",         "Spodumene + elbaite territory",           ev_li_phase),
        Event(160, "Late Hydrothermal", "Topaz window opens — F survivors fire",   ev_late_hydrothermal),
        Event(190, "Clay Softening",   "Kaolinite replaces pocket walls",         ev_clay_softening),
        Event(215, "Final Cooling",    "System approaches 300°C floor",           ev_final),
    ]
    return conditions, events, 230


def scenario_ouro_preto() -> Tuple[VugConditions, List[Event], int]:
    """Ouro Preto Imperial Topaz Veins — Minas Gerais, Brazil (Variant B).

    Hydrothermal veins cutting Precambrian phyllite and quartzite in the
    Ouro Preto district. Fluid inclusion data (Morteani et al. 2002) puts
    crystallization at ~360°C, 3.5 kbar from metamorphic brines derived
    from devolatilization of phyllite.

    Single clean cooling curve — 360°C → 50°C — the "anti-flash-quench"
    of the gem-pegmatite scenarios. No thermal events, no pressure spikes.
    One exhalation from the granite cooling below.

    The gate: topaz can't nucleate until fluorine accumulates past a
    saturation threshold. Early quartz grows alone. A mid-scenario
    metamorphic dehydration event pumps F from the phyllite micas into
    the fluid, and the vein transitions to imperial topaz territory. The
    imperial color — golden-orange to pink — depends on Cr³⁺ dissolved
    out of nearby ultramafic bodies; without chromium the topaz is
    colorless or pale blue.
    """
    conditions = VugConditions(
        temperature=360.0,
        pressure=3.5,
        fluid=FluidChemistry(
            # Quartz-saturated metamorphic brine from devolatilizing phyllite.
            # SiO2 1200 ppm is enough to supersaturate quartz at 360°C
            # (silica_equilibrium at 360°C ≈ 1050 ppm) — quartz lines the
            # vein walls first, as per real Ouro Preto paragenesis.
            SiO2=1200, Ca=40, CO3=20, Fe=6, Mn=2, Al=15,
            # Starts below F-threshold (20 ppm) — topaz waits for the pulse.
            F=12,
            # Trace Cr from nearby ultramafic contact. Starts sub-threshold;
            # ev_cr_leach bumps it into the imperial-color window (3–8 ppm).
            # Random seeds can push it past 8 (pink imperial) if the Cr leach
            # lands on an already-elevated baseline.
            Cr=0.5,
            Ti=0.6,
            O2=0.3, pH=6.5, salinity=3.0,
        ),
        # Ouro Preto topaz vein — 2 primary + 4 secondary bubbles;
        # hydrothermal vein in quartzite reads as a small cohesive pocket.
        wall=VugWall(primary_bubbles=2, secondary_bubbles=4, shape_seed=9),
    )

    def ev_vein_opening(cond):
        """First fracture propagation — fresh hot fluid floods a narrow slot."""
        cond.fluid.SiO2 += 150   # fresh silica supply
        cond.temperature = 380
        cond.flow_rate = 1.5
        return ("The fracture opens. Fluid pressure exceeded lithostatic "
                "pressure and the vein propagated upward — narrow, barely "
                "wider than your hand. Fresh hot brine floods in at 380°C "
                "and quartz starts lining the walls. The fluorine in the "
                "fluid is still below saturation; topaz holds its breath.")

    def ev_f_pulse(cond):
        """Metamorphic dehydration of phyllite micas releases fluorine.
        This is the gate-opener: F jumps past the topaz saturation threshold."""
        cond.fluid.F += 30.0
        cond.fluid.Al += 8.0
        cond.temperature = 365
        cond.flow_rate = 1.2
        return ("A deeper wall of phyllite reaches the dehydration point. "
                "Fluorine-bearing micas break down and release F⁻ into the "
                f"vein fluid — F jumps to {cond.fluid.F:.0f} ppm, past the "
                "topaz saturation threshold. The chemistry has just tipped. "
                "Imperial topaz is now thermodynamically inevitable.")

    def ev_cr_leach(cond):
        """Fluid pathway crosses an ultramafic dike — Cr leaches in."""
        cond.fluid.Cr += 4.0
        cond.temperature = 340
        return ("The vein system intersects an ultramafic dike on its way "
                f"up. Chromium leaches into the fluid — Cr now {cond.fluid.Cr:.1f} ppm, "
                "above the imperial-color window. Any topaz growing from "
                "this pulse forward will catch Cr³⁺ in its structure. "
                "Golden-orange is committed to the crystal.")

    def ev_steady_cooling(cond):
        """Main growth phase — slow steady cooling through the topaz window."""
        cond.temperature = 320
        cond.flow_rate = 1.0
        return ("The main topaz growth phase. The vein cools steadily — "
                "320°C now — and topaz is happily projecting from the "
                "quartz-lined walls. Slow, clean layer-by-layer growth. "
                "The crystals are recording the thermal history in their "
                "growth zones and fluid inclusions; a microprobe traverse "
                "across one of these crystals would read like a barometer.")

    def ev_late_hydrothermal(cond):
        """Dilute late fluid — F drops, kaolinite begins to form from feldspar."""
        cond.temperature = 220
        cond.fluid.pH = 5.5
        cond.flow_rate = 0.6
        return ("Late-stage dilute hydrothermal fluid — pH falling, F "
                "depleted by topaz growth. Kaolinite begins replacing any "
                "remaining feldspar in the wall rock; the vein walls soften. "
                "Topaz's perfect basal cleavage means any shift in the "
                "wall can snap a crystal off its base. Cleavage fragments "
                "will accumulate on the pocket floor.")

    def ev_oxidation_stain(cond):
        """System opens to oxidizing surface water — goethite staining."""
        cond.temperature = 90
        cond.fluid.O2 = 1.6
        cond.fluid.Fe += 20
        cond.flow_rate = 0.3
        return ("Surface water finds the vein. The system oxidizes — "
                "meteoric O₂ reaches the pocket, iron precipitates as "
                "goethite, and the final topaz generation sits in a "
                "limonite-stained matrix. The assemblage that garimpeiros "
                "will find in 400 Ma is now fully set.")

    def ev_final_cooling(cond):
        """System reaches near-ambient temperature — story ends."""
        cond.temperature = 50
        cond.flow_rate = 0.05
        return ("The vein cools to near-ambient. What remains is the "
                "assemblage: milky quartz lining the walls, imperial topaz "
                "prisms projecting inward, fluid inclusion planes across "
                "every crystal, iron-stained fractures. The exhalation has "
                "finished. The vug now waits for time.")

    events = [
        Event(5,   "Vein Opening",       "Fracture propagates, fresh brine", ev_vein_opening),
        Event(35,  "F-Pulse",             "Phyllite dehydration — F crosses saturation", ev_f_pulse),
        Event(55,  "Cr Leach",            "Ultramafic dike contributes chromium", ev_cr_leach),
        Event(90,  "Steady Cooling",      "Main topaz growth phase", ev_steady_cooling),
        Event(150, "Late Hydrothermal",   "Kaolinite softening, F depleted", ev_late_hydrothermal),
        Event(200, "Oxidation Stain",     "Goethite staining, surface water", ev_oxidation_stain),
        Event(240, "Final Cooling",       "System approaches ambient", ev_final_cooling),
    ]
    return conditions, events, 260


def scenario_bisbee() -> Tuple[VugConditions, List[Event], int]:
    """Bisbee, Arizona — Warren Mining District, Cochise County.

    The classic copper porphyry with a world-class oxidation zone. The
    complete Cu paragenesis from primary sulfides through supergene
    enrichment to the cyan-blue chrysocolla of the oxidation finale.

    Host rock: a combo — Laramide quartz-monzonite porphyry intruded
    into Paleozoic Escabrosa Limestone + Abrigo Formation. In the sim
    this is represented as a limestone wall (the pH buffer, the CO₃
    source for azurite) with scenario events that inject dissolved
    SiO₂ from the surrounding silicate matrix weathering — the supply
    path for late chrysocolla.

    Centerpiece mechanic: the azurite ↔ malachite ↔ chrysocolla
    cascade. Azurite dominates at high pCO₂ (event 4, CO₃ ≥ 120 ppm).
    A pCO₂-drop event (event 6) dissolves azurite and fires
    malachite. A silica-seep event (event 7) dissolves malachite-
    without-silica and fires chrysocolla pseudomorphs on the
    remaining azurite crystals. Three carbonate/silicate phases
    recording three different groundwater chemistries, each one
    freezing a different step of the Cochise County monsoon.

    References:
      * Graeme, Graeme & Graeme (2019) — the modern Bisbee monograph
      * Bryant (1968), Crane (1911) — district geology
      * Vink (1986) — azurite ↔ malachite pCO₂ thermodynamics
      * Mote et al. (2001) — supergene chrysocolla geochemistry
    """
    conditions = VugConditions(
        # Primary porphyry stage — hot magmatic-hydrothermal brine.
        # Graeme et al. 2019 fluid inclusion data: 320–450 °C,
        # 0.5–1.5 kbar, hypersaline (35–55 wt% NaCl eq).
        temperature=400.0,
        pressure=1.0,
        fluid=FluidChemistry(
            # Cu 400 ppm — upper end of primary porphyry; the whole
            # district budget. Concentrated in the sim relative to
            # nature because we don't model the open-system leaching
            # that strips Cu from 10 km³ of rock into a small pocket.
            SiO2=500, Ca=60, CO3=30, Fe=200, Mn=4,
            Cu=400, S=150, F=6, Cl=400, Pb=15,
            K=80, Na=120, Al=20,
            # Trace — arsenic from arsenopyrite, bismuth greisen
            # signature (Bisbee has documented bismuth enrichment).
            As=8, Bi=2,
            # Very reducing primary — chalcopyrite/bornite-stable.
            O2=0.05, pH=5.0, salinity=30.0
        ),
        wall=VugWall(
            composition="limestone",
            thickness_mm=500.0,
            vug_diameter_mm=50.0,
            wall_Fe_ppm=2500.0,
            wall_Mn_ppm=400.0,
            # Primary cavity dug by magmatic-hydrothermal replacement
            # of limestone. Secondary alcoves from the supergene
            # overprint. 3+7 matches the supergene_oxidation profile.
            primary_bubbles=3,
            secondary_bubbles=7,
            shape_seed=13,
        )
    )

    def ev_primary_cooling(cond):
        """First cooling step — chalcopyrite and bornite crystallize,
        pyrite + magnetite pin down the Fe budget. Still reducing."""
        cond.temperature = 320
        cond.fluid.SiO2 += 100     # late-stage silica injection
        cond.fluid.Cu -= 50        # some Cu locked into early sulfides
        cond.fluid.O2 = 0.08
        cond.flow_rate = 1.2
        return ("The Sacramento Hill porphyry finishes its main crystallization "
                "pulse. Chalcopyrite and bornite precipitate in the vein selvages "
                "of the Escabrosa mantos — Cu:Fe:S in the magmatic ratio. Pyrite "
                "frames the assemblage, locked in at 300+ °C. The ore body is set. "
                "For 180 million years, nothing will happen.")

    def ev_uplift_weathering(cond):
        """Uplift exposes the ore to meteoric water. Pyrite oxidizes,
        releasing H⁺ and SO₄. pH drops — the supergene engine starts."""
        cond.temperature = 35
        cond.fluid.pH = 4.0         # acidic from pyrite oxidation
        cond.fluid.O2 = 0.8         # oxygenated meteoric water
        cond.fluid.S += 80          # sulfate released from pyrite
        cond.fluid.Cu += 100        # Cu²⁺ leached from primary chalcopyrite
        cond.fluid.Fe += 50
        cond.flow_rate = 1.8
        return ("Mesozoic–Cenozoic uplift tips the Warren basin and strips the "
                "Cretaceous cover. Meteoric water percolates down through "
                "fractures, hitting pyrite; sulfuric acid is the first product. "
                "The pH crashes to 4, and Cu²⁺ starts descending with the water "
                "table. This is the enrichment pulse — primary ore above is "
                "dissolving, concentrating its copper at the redox interface "
                "below.")

    def ev_enrichment_blanket(cond):
        """Descending Cu²⁺ hits the reducing front beneath the water table.
        Chalcocite and covellite mantle the remaining primary sulfides —
        the high-grade supergene enrichment zone."""
        cond.temperature = 30
        cond.fluid.Cu += 80         # still descending from above
        cond.fluid.S += 40
        cond.fluid.O2 = 0.6         # right at the redox front
        cond.fluid.pH = 4.5
        cond.flow_rate = 1.3
        return ("The descending Cu²⁺-bearing fluid reaches the reducing layer "
                "just below the water table. Chalcocite replaces chalcopyrite "
                "atom-for-atom — the Bisbee enrichment blanket, 5–10× the "
                "primary grade. Covellite forms where S activity is highest. "
                "This is the mineable ore. For two generations of miners, this "
                "is what Bisbee MEANS.")

    def ev_reducing_pulse(cond):
        """Brief reducing pulse — a barren deep fluid displaces the
        sulfate-rich enrichment brine. Eh drops below cuprite stability
        for a short window and native copper precipitates as arborescent
        sheets in fracture fillings. Accounts for the isolated native-Cu
        pockets that occur throughout the Bisbee oxidation zone.

        Needs strong chemistry: native-Cu's supersaturation floor
        demands very low O₂ (the floor clause in red_f kicks in above
        0.3), S below sulfide threshold, and Cu well above 80 ppm.
        """
        cond.fluid.O2 = 0.05         # strongly reducing
        cond.fluid.S = 15             # sulfate almost entirely flushed
        cond.fluid.Cu += 150          # Cu²⁺ surges from above
        cond.fluid.pH = 6.0
        cond.temperature = 28
        cond.flow_rate = 1.1
        return ("A barren reducing fluid pulses up from depth — lower than "
                "any water table. For a few thousand years the pocket's Eh "
                "is below cuprite stability. Native copper precipitates in "
                "the fracture selvages as arborescent sheets and wire. The "
                "Bisbee native-copper specimens — the Cornish-style copper "
                "trees — are products of exactly these brief windows.")

    def ev_oxidation_zone(cond):
        """Water table drops further; the whole system oxidizes. Cuprite
        mantles the native copper sheets — the narrow Eh band between
        sulfide-stable and fully-oxidized."""
        cond.temperature = 25
        cond.fluid.O2 = 1.0          # oxidizing but not fully
        cond.fluid.pH = 6.2          # limestone buffer kicks in
        cond.fluid.S = max(cond.fluid.S - 60, 20)  # sulfate flushed
        cond.fluid.Cu += 40
        cond.fluid.Fe -= 30          # goethite locks up Fe
        cond.fluid.CO3 += 30         # limestone dissolution starts
        cond.flow_rate = 1.0
        return ("The water table drops another 50 meters. The enrichment "
                "blanket is now in the unsaturated zone — oxygen reaches it "
                "directly. Cuprite forms where the Eh is still low; native "
                "copper sheets grow in the fractures where reducing pockets "
                "survive. The limestone walls are finally participating — "
                "pH climbs toward neutral, and CO₃ rises with it.")

    def ev_azurite_peak(cond):
        """High pCO₂ groundwater surges through — azurite forms in the
        limestone-hosted chambers. This is the Bisbee blue."""
        cond.fluid.CO3 += 80          # pCO₂ peak, limestone actively dissolving
        cond.fluid.Cu += 30
        cond.fluid.O2 = 1.3
        cond.fluid.pH = 7.0
        cond.flow_rate = 0.9
        return ("A monsoon season — the first in many. CO₂-charged rainwater "
                "infiltrates fast, dissolves limestone aggressively, and hits "
                "the copper pocket at pH 7 with CO₃ at 110+ ppm. Azurite — "
                "deep midnight-blue monoclinic prisms and radiating rosettes "
                "— nucleates from the supersaturated brine. This phase "
                "produces the showpiece 'Bisbee Blue' specimens.")

    def ev_co2_drop(cond):
        """pCO₂ drops as the monsoon seasonal pattern shifts. Azurite
        becomes thermodynamically unstable; existing crystals begin
        converting to malachite (pseudomorphs). Fresh malachite nucleates
        from the released Cu + CO₃."""
        cond.fluid.CO3 = max(cond.fluid.CO3 - 120, 50)  # crash below azurite threshold
        cond.fluid.O2 = 1.4
        cond.fluid.pH = 6.8
        cond.flow_rate = 0.7
        return ("The climate dries. Without CO₂-charged infiltration the "
                "pocket's pCO₂ falls below azurite's stability — every "
                "azurite crystal in the vug starts converting. The color "
                "shift creeps crystal-by-crystal: deep blue → green rind → "
                "green core. Vink (1986) put the crossover at log(pCO₂) ≈ "
                "−3.5 at 25 °C, right where we are. Malachite pseudomorphs "
                "after azurite are the diagnostic Bisbee specimen — frozen "
                "mid-transition.")

    def ev_silica_seep(cond):
        """Percolating groundwater now carries dissolved SiO₂ leached from
        the quartz-monzonite porphyry upslope. Chrysocolla starts forming
        wherever Cu²⁺ meets SiO₂ — crusts over cuprite/native copper,
        pseudomorphs surviving azurite."""
        cond.fluid.SiO2 += 90        # porphyry weathering delivers silica
        cond.fluid.Cu += 20
        cond.fluid.CO3 = max(cond.fluid.CO3 - 30, 20)   # CO₂ still trending down
        cond.fluid.pH = 6.5
        cond.fluid.O2 = 1.3
        cond.flow_rate = 0.8
        return ("A new seep arrives — from weathering of the Sacramento Hill "
                "quartz-monzonite porphyry uphill, not the limestone. It "
                "brings dissolved SiO₂ at 100+ ppm. Where this fluid meets "
                "the Cu²⁺ still in solution the cyan enamel of chrysocolla "
                "precipitates: thin films over cuprite, botryoidal crusts "
                "on native copper, and — the Bisbee centerpiece — "
                "pseudomorphs replacing the last azurite blues.")

    def ev_final_drying(cond):
        """Flow stops. The system seals. The assemblage the miners will
        find a million years from now is committed."""
        cond.temperature = 20
        cond.flow_rate = 0.1
        cond.fluid.O2 = 1.0
        return ("The fractures seal with calcite cement. Groundwater stops. "
                "The pocket is a closed system again, this time with the "
                "full oxidation assemblage frozen in place: chalcopyrite "
                "cores wrapped in chalcocite, those wrapped in cuprite, "
                "those overgrown by native copper, those overgrown by "
                "azurite, those converted to malachite, those pseudomorphed "
                "by chrysocolla. A million years from now, when a mining "
                "shaft intersects this pocket, an assayer will photograph "
                "the specimen and write 'Bisbee, Cochise County' on the "
                "label.")

    events = [
        Event(25,  "Primary Cooling",      "Chalcopyrite + bornite lock in",    ev_primary_cooling),
        Event(65,  "Uplift + Weathering",  "Meteoric acid strips primary ore",  ev_uplift_weathering),
        Event(95,  "Enrichment Blanket",   "Chalcocite replaces chalcopyrite",  ev_enrichment_blanket),
        Event(120, "Reducing Pulse",       "Native copper fracture fillings",   ev_reducing_pulse),
        Event(145, "Oxidation Zone",       "Cuprite mantles native copper",     ev_oxidation_zone),
        Event(180, "Azurite Peak",         "High-pCO₂ monsoon — Bisbee Blue",   ev_azurite_peak),
        Event(225, "pCO₂ Drop",            "Azurite → malachite conversion",    ev_co2_drop),
        Event(265, "Silica Seep",          "Chrysocolla crusts + pseudomorphs", ev_silica_seep),
        Event(305, "Final Drying",         "Fractures seal, system locks",      ev_final_drying),
    ]
    return conditions, events, 340


def scenario_random() -> Tuple[VugConditions, List[Event], int]:
    """Procedurally-generated vugg — each run a different discovery.

    Picks a random geological archetype, then generates realistic but
    randomized fluid chemistry within it. The narrative layer treats the
    resulting specimen like a collector's tag: where it likely came from,
    what the dominant paragenesis is, what trace elements hint at.

    Archetypes:
      hydrothermal   — moderate-T vein, mixed metal sulfides
      pegmatite      — high-T granite pocket, K/Na/Al/SiO₂ + rare elements
      supergene      — low-T oxidation zone, Pb/Zn/Cu secondaries
      mvt            — Mississippi Valley-type carbonate-hosted brine
      porphyry       — magmatic-hydrothermal Cu-Fe-Mo sulfides
      evaporite      — cool Ca-SO₄-rich water-table crust
      mixed          — two generations of fluid, overprinted
    """
    archetypes = ["hydrothermal", "pegmatite", "supergene", "mvt",
                  "porphyry", "evaporite", "mixed"]
    archetype = random.choice(archetypes)

    # Trace garnish — elements the engine tracks but no mineral currently
    # consumes. Sprinkled into most archetypes so the narrator has hints
    # about "what the fluid almost did." Each is optional, per-archetype.
    def sprinkle_traces(fluid, pool):
        for elem, prob, rng in pool:
            if random.random() < prob:
                setattr(fluid, elem, random.uniform(*rng))

    if archetype == "hydrothermal":
        T = random.uniform(220, 380)
        fluid = FluidChemistry(
            SiO2=random.uniform(350, 850),
            Ca=random.uniform(60, 240),
            CO3=random.uniform(40, 180),
            Fe=random.uniform(8, 45),
            Mn=random.uniform(1, 10),
            Al=random.uniform(2, 6),
            Ti=random.uniform(0.3, 1.2),
            Zn=random.uniform(0, 80) if random.random() < 0.5 else 0.0,
            S=random.uniform(30, 90) if random.random() < 0.6 else 0.0,
            Cu=random.uniform(0, 50) if random.random() < 0.4 else 0.0,
            Pb=random.uniform(0, 35) if random.random() < 0.4 else 0.0,
            F=random.uniform(4, 20),
            pH=random.uniform(5.5, 7.2),
            O2=random.uniform(0, 0.6),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.30, (5, 40)),     # barite-hint
            ("Sr", 0.25, (3, 25)),     # celestine-hint
            ("Ag", 0.20, (0.5, 8)),    # argentiferous hint
            ("Sb", 0.15, (1, 10)),
        ])
        events = [Event(random.randint(40, 60), "Fluid Pulse", "Fresh hydrothermal fluid", event_fluid_pulse)]
        steps = random.randint(100, 140)

    elif archetype == "pegmatite":
        T = random.uniform(520, 780)
        fluid = FluidChemistry(
            SiO2=random.uniform(4000, 14000),
            Ca=random.uniform(20, 100),
            CO3=random.uniform(5, 40),
            K=random.uniform(50, 130),
            Na=random.uniform(35, 90),
            Al=random.uniform(20, 50),
            Fe=random.uniform(20, 80),
            Mn=random.uniform(3, 15),
            F=random.uniform(10, 40),
            Pb=random.uniform(5, 35) if random.random() < 0.4 else 0.0,
            U=random.uniform(30, 180) if random.random() < 0.35 else 0.0,
            pH=random.uniform(6.0, 7.5),
            O2=random.uniform(0, 0.2),
        )
        sprinkle_traces(fluid, [
            ("Be", 0.40, (5, 40)),     # beryl country
            ("Li", 0.40, (10, 80)),    # spodumene/lepidolite
            ("B",  0.35, (5, 50)),     # tourmaline-hint
            ("Cs", 0.10, (1, 10)),     # pollucite? not tracked, but could be
            ("P",  0.20, (2, 15)),
        ])
        events = [
            Event(random.randint(25, 40), "Crystallization", "Melt differentiates",
                  lambda c: (setattr(c, "temperature", max(c.temperature - 120, 350)),
                             setattr(c.fluid, "SiO2", c.fluid.SiO2 + 2500))[0] or
                             "Pegmatite melt differentiates; volatile-rich residual fluid floods the pocket."),
        ]
        steps = random.randint(120, 180)

    elif archetype == "supergene":
        T = random.uniform(18, 55)
        fluid = FluidChemistry(
            SiO2=random.uniform(20, 80),
            Ca=random.uniform(80, 200),
            CO3=random.uniform(60, 200),
            Fe=random.uniform(20, 60),
            Mn=random.uniform(2, 12),
            Zn=random.uniform(40, 140) if random.random() < 0.7 else 0.0,
            S=random.uniform(20, 70),
            Cu=random.uniform(10, 60) if random.random() < 0.6 else 0.0,
            Pb=random.uniform(15, 60) if random.random() < 0.6 else 0.0,
            Mo=random.uniform(5, 25) if random.random() < 0.4 else 0.0,
            As=random.uniform(3, 18) if random.random() < 0.5 else 0.0,
            Cl=random.uniform(5, 30),
            F=random.uniform(1, 8),
            O2=random.uniform(1.5, 2.3),
            pH=random.uniform(5.8, 7.2),
        )
        sprinkle_traces(fluid, [
            ("V",  0.20, (1, 10)),     # vanadinite country
            ("Cr", 0.15, (0.5, 6)),    # redgo wulfenite color
            ("Co", 0.15, (0.5, 5)),    # pink smithsonite
            ("Cd", 0.10, (0.2, 3)),    # yellow sphalerite/smithsonite
        ])
        events = []
        steps = random.randint(140, 200)

    elif archetype == "mvt":
        T = random.uniform(90, 170)
        fluid = FluidChemistry(
            SiO2=random.uniform(60, 180),
            Ca=random.uniform(250, 450),
            CO3=random.uniform(150, 280),
            Fe=random.uniform(15, 45),
            Mn=random.uniform(4, 12),
            Zn=random.uniform(100, 200),
            S=random.uniform(80, 150),
            Pb=random.uniform(20, 60),
            F=random.uniform(25, 55),
            pH=random.uniform(5.5, 7.0),
            O2=random.uniform(0, 0.4),
            salinity=random.uniform(15, 22),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.45, (15, 60)),    # barite in MVT is classic
            ("Ag", 0.25, (1, 8)),      # argentiferous galena
            ("Cd", 0.30, (0.5, 4)),    # honey sphalerite
        ])
        events = [Event(random.randint(20, 35), "Fluid Mixing", "Brine meets groundwater", event_fluid_mixing)]
        steps = random.randint(100, 150)

    elif archetype == "porphyry":
        T = random.uniform(350, 520)
        fluid = FluidChemistry(
            SiO2=random.uniform(500, 900),
            Ca=random.uniform(50, 150),
            CO3=random.uniform(30, 80),
            Fe=random.uniform(30, 80),
            Mn=random.uniform(1, 6),
            S=random.uniform(50, 120),
            Cu=random.uniform(60, 180),
            Mo=random.uniform(10, 60) if random.random() < 0.7 else 0.0,
            Pb=random.uniform(10, 40),
            F=random.uniform(2, 12),
            O2=random.uniform(0, 0.3),
            pH=random.uniform(4.5, 6.2),
        )
        sprinkle_traces(fluid, [
            ("Ag", 0.30, (1, 8)),
            ("Au", 0.15, (0.1, 2)),    # gold in porphyry — rare but classic
            ("Bi", 0.20, (0.5, 5)),
            ("W",  0.15, (0.5, 6)),    # scheelite-adjacent
        ])
        events = [Event(random.randint(40, 70), "Late Cu Pulse", "Magmatic copper surge", event_copper_injection)]
        steps = random.randint(120, 160)

    elif archetype == "evaporite":
        T = random.uniform(25, 58)  # below gypsum → anhydrite transition
        fluid = FluidChemistry(
            SiO2=random.uniform(15, 60),
            Ca=random.uniform(180, 350),
            CO3=random.uniform(40, 120),
            Fe=random.uniform(2, 20),
            Mn=random.uniform(0.5, 4),
            S=random.uniform(90, 180),
            O2=random.uniform(0.8, 1.8),
            pH=random.uniform(6.8, 7.8),
            salinity=random.uniform(5, 14),
        )
        sprinkle_traces(fluid, [
            ("Sr", 0.45, (10, 50)),    # celestine in evaporites
            ("Mg", 0.50, (20, 80)),    # dolomite/epsomite hint
            ("Cl", 0.55, (15, 60)),    # halite-adjacent
        ])
        events = []
        steps = random.randint(160, 220)

    else:  # mixed — two-generation vugg
        T = random.uniform(280, 420)
        fluid = FluidChemistry(
            SiO2=random.uniform(400, 700),
            Ca=random.uniform(100, 250),
            CO3=random.uniform(50, 180),
            Fe=random.uniform(20, 60),
            Mn=random.uniform(3, 12),
            Zn=random.uniform(40, 120),
            S=random.uniform(50, 120),
            Cu=random.uniform(20, 80) if random.random() < 0.5 else 0.0,
            Pb=random.uniform(15, 50),
            F=random.uniform(8, 25),
            pH=random.uniform(5.5, 7.0),
            O2=random.uniform(0, 0.4),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.30, (5, 40)),
            ("Sr", 0.20, (3, 20)),
            ("As", 0.30, (3, 15)),
            ("Ag", 0.20, (0.5, 5)),
        ])
        # Two-stage: primary sulfides, then late oxidation pulse.
        events = [
            Event(random.randint(30, 50), "Primary Pulse", "Metal-bearing fluid",
                  event_fluid_pulse),
            Event(random.randint(80, 110), "Oxidizing Overprint", "Meteoric water incursion",
                  event_oxidation),
        ]
        steps = random.randint(160, 220)

    # Phase-1 void shape: map the archetype to two-stage bubble counts.
    # Shape seed is a fresh random so each run of "random" looks
    # different. Fewer secondaries = more cohesive cavity; more
    # secondaries = more satellite alcoves.
    _archetype_shape = {
        # archetype:     (primary_bubbles, secondary_bubbles)
        "hydrothermal": (3, 6),
        "pegmatite":    (4, 5),
        "supergene":    (3, 7),
        "mvt":          (3, 8),
        "porphyry":     (3, 6),
        "evaporite":    (2, 3),
        "mixed":        (3, 6),
    }
    _pb, _sb = _archetype_shape.get(archetype, (3, 6))
    _rand_wall = VugWall(
        primary_bubbles=_pb,
        secondary_bubbles=_sb,
        shape_seed=random.randint(1, 2 ** 30),
    )
    conditions = VugConditions(
        temperature=T,
        pressure=random.uniform(0.3, 2.0),
        fluid=fluid,
        wall=_rand_wall,
    )
    # Side-channel for the narrator to read after simulation.
    conditions._random_archetype = archetype
    return conditions, events, steps


SCENARIOS = {
    "cooling": scenario_cooling,
    "pulse": scenario_pulse,
    "mvt": scenario_mvt,
    "porphyry": scenario_porphyry,
    "reactive_wall": scenario_reactive_wall,
    "radioactive_pegmatite": scenario_radioactive_pegmatite,
    "supergene_oxidation": scenario_supergene_oxidation,
    "ouro_preto": scenario_ouro_preto,
    "gem_pegmatite": scenario_gem_pegmatite,
    "bisbee": scenario_bisbee,
    "random": scenario_random,
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
        # Unwrapped topo-map state. v1 uses ring[0] only; the multi-ring
        # structure is there so the future 3D view can slice depth without
        # reshaping the storage. `initial_radius_mm` freezes the pre-run
        # starting point so later per-cell wall_depth readings are
        # interpretable as "how much this slice of wall has retreated."
        self.wall_state = WallState(
            vug_diameter_mm=conditions.wall.vug_diameter_mm,
            initial_radius_mm=conditions.wall.vug_diameter_mm / 2.0,
            # Phase-1 two-stage bubble-merge void shape. Scenarios set
            # these on VugWall; defaults (3 primary, 6 secondary) give
            # a cohesive main cavity with satellite alcoves so scenarios
            # that don't opt in still get an organic dissolution profile.
            primary_bubbles=conditions.wall.primary_bubbles,
            secondary_bubbles=conditions.wall.secondary_bubbles,
            shape_seed=conditions.wall.shape_seed,
        )
    
    def nucleate(self, mineral: str, position: str = "vug wall",
                 sigma: float = 1.0) -> Crystal:
        """Nucleate a new crystal. `sigma` (current supersaturation for this
        mineral) is used to pick a habit variant from data/minerals.json."""
        self.crystal_counter += 1
        crystal = Crystal(
            mineral=mineral,
            crystal_id=self.crystal_counter,
            nucleation_step=self.step,
            nucleation_temp=self.conditions.temperature,
            position=position
        )

        # Pick a growth-vector variant from the spec. The variant's name
        # overrides the legacy per-mineral habit string below when present,
        # and its wall_spread/void_reach/vector populate the topo-map
        # footprint. Falls back to legacy defaults if the spec lacks
        # variants for this mineral.
        variant = select_habit_variant(
            mineral, sigma, self.conditions.temperature,
            space_constrained=self._space_is_crowded(),
        )
        if variant:
            crystal.habit = variant.get("name", crystal.habit)
            crystal.wall_spread = float(variant.get("wall_spread", 0.5))
            crystal.void_reach = float(variant.get("void_reach", 0.5))
            crystal.vector = variant.get("vector", "equant")

        # Anchor on the wall. Crystals that nucleated on another crystal
        # (position string like "on pyrite #3") inherit the host's cell so
        # they paint over/next to it. Everything else gets a fresh random
        # cell on ring 0.
        crystal.wall_center_cell = self._assign_wall_cell(position)

        # Dominant-form strings are still per-mineral — they describe
        # crystallographic faces, not the habit variant, so the growth-vector
        # selector leaves them alone. The fallback `habit` (when the spec
        # has no variants) is the first value in each arm.
        if mineral == "quartz":
            crystal.dominant_forms = ["m{100} prism", "r{101} rhombohedron"]
        elif mineral == "calcite":
            crystal.dominant_forms = ["e{104} rhombohedron"]
        elif mineral == "sphalerite":
            crystal.dominant_forms = ["{111} tetrahedron"]
        elif mineral == "wurtzite":
            crystal.dominant_forms = ["hemimorphic hexagonal pyramid", "{0001} + {101̄1}"]
        elif mineral == "fluorite":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "pyrite":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "marcasite":
            crystal.dominant_forms = ["cockscomb aggregate", "{010} tabular crests"]
        elif mineral == "chalcopyrite":
            crystal.dominant_forms = ["{112} disphenoid"]
        elif mineral == "hematite":
            crystal.dominant_forms = ["{001} basal plates"]
        elif mineral == "malachite":
            crystal.dominant_forms = ["botryoidal masses"]
        elif mineral == "galena":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "smithsonite":
            crystal.dominant_forms = ["botryoidal masses", "{101̅4} scalenohedra"]
        elif mineral == "wulfenite":
            crystal.dominant_forms = ["{001} thin square plates"]
        elif mineral == "selenite":
            crystal.dominant_forms = ["{010} plates", "swallow-tail twins"]
        elif mineral == "feldspar":
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "Carlsbad twin"]
        elif mineral == "albite":
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "albite twin"]
        elif mineral == "uraninite":
            crystal.dominant_forms = ["massive pitchy aggregates"]
        elif mineral == "goethite":
            crystal.dominant_forms = ["botryoidal masses", "velvety surface"]
        elif mineral == "molybdenite":
            crystal.dominant_forms = ["{0001} basal plates", "hexagonal outline"]
        elif mineral == "topaz":
            crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "c{001} basal cleavage"]
        elif mineral == "tourmaline":
            crystal.dominant_forms = ["m{10̄10} trigonal prism", "striated faces", "slightly rounded triangular cross-section"]
        elif mineral == "beryl":
            crystal.dominant_forms = ["m{10̄10} hex prism", "c{0001} flat basal pinacoid"]
        elif mineral == "spodumene":
            crystal.dominant_forms = ["m{110} prism", "a{100} + b{010} pinacoids", "~87° pyroxene cleavages"]
        elif mineral == "anglesite":
            crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "o{011} orthorhombic dome"]
        elif mineral == "cerussite":
            crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "pseudo-hexagonal if twinned"]
        elif mineral == "pyromorphite":
            crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "barrel profile"]
        elif mineral == "vanadinite":
            crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "flat basal termination"]
        elif mineral == "bornite":
            crystal.dominant_forms = ["massive granular", "iridescent tarnish"]
        elif mineral == "chalcocite":
            crystal.dominant_forms = ["{110} prism", "pseudo-hexagonal if twinned"]
        elif mineral == "covellite":
            crystal.dominant_forms = ["{0001} basal plate", "perfect basal cleavage"]
        elif mineral == "cuprite":
            crystal.dominant_forms = ["{111} octahedron", "dark red with ruby internal reflections"]
        elif mineral == "azurite":
            crystal.dominant_forms = ["monoclinic prism", "deep azure-blue"]
        elif mineral == "chrysocolla":
            crystal.dominant_forms = ["botryoidal crust", "cyan-blue cryptocrystalline enamel"]
        elif mineral == "native_copper":
            crystal.dominant_forms = ["arborescent branching", "copper-red metallic"]
        elif mineral == "magnetite":
            crystal.dominant_forms = ["{111} octahedron", "black metallic, strongly magnetic"]
        elif mineral == "lepidocrocite":
            crystal.dominant_forms = ["{010} platy scales", "ruby-red micaceous"]
        elif mineral == "stibnite":
            crystal.dominant_forms = ["elongated {110} prism", "lead-gray sword-blade"]
        elif mineral == "bismuthinite":
            crystal.dominant_forms = ["acicular {110} needle", "lead-gray metallic"]
        elif mineral == "native_bismuth":
            crystal.dominant_forms = ["arborescent silver-white", "iridescent oxide tarnish"]
        elif mineral == "clinobisvanite":
            crystal.dominant_forms = ["micro-platy {010}", "bright yellow"]
        self.crystals.append(crystal)
        return crystal

    def _space_is_crowded(self) -> bool:
        """Fraction of ring-0 cells already claimed by another crystal.
        Habit selection uses this to penalize projecting habits when the
        vug is filling up and to reward coating habits."""
        ring0 = self.wall_state.rings[0]
        if not ring0:
            return False
        occupied = sum(1 for c in ring0 if c.crystal_id is not None)
        return (occupied / len(ring0)) >= 0.5

    def _assign_wall_cell(self, position: str) -> int:
        """Pick a ring-0 cell for a nucleating crystal.

        Host-substrate crystals (position 'on <mineral> #<id>') inherit
        the host's cell so pseudomorphs / overgrowths paint in the same
        place. Everything else gets a random empty cell if one exists,
        otherwise a random cell (overlaps are fine — paint_crystal picks
        the larger occupant)."""
        host_id = None
        if " #" in position:
            try:
                host_id = int(position.rsplit("#", 1)[1].split()[0])
            except ValueError:
                host_id = None
        if host_id is not None:
            host = next((c for c in self.crystals if c.crystal_id == host_id), None)
            if host and host.wall_center_cell is not None:
                return host.wall_center_cell
        N = self.wall_state.cells_per_ring
        ring0 = self.wall_state.rings[0]
        empty = [i for i, cell in enumerate(ring0) if cell.crystal_id is None]
        return random.choice(empty) if empty else random.randrange(N)

    def _repaint_wall_state(self) -> None:
        """Rebuild ring-0 occupancy from the current crystal list. Runs
        once per step, after growth. Larger crystals overwrite smaller
        ones at the same cell (`paint_crystal` guards on thickness)."""
        self.wall_state.update_diameter(self.conditions.wall.vug_diameter_mm)
        self.wall_state.clear()
        # Paint smallest-first so the biggest crystals win ties — they're
        # what the viewer would actually see from outside.
        for crystal in sorted(self.crystals, key=lambda c: c.total_growth_um):
            if crystal.dissolved:
                continue
            self.wall_state.paint_crystal(crystal)

    def _wall_cells_blocked_by_crystals(self) -> set:
        """Which ring-0 cells are shielded from wall dissolution.

        A cell is shielded when it's occupied by a non-dissolved crystal
        that is stable at the current pH — either the mineral has no
        acid_dissolution rule in the spec (permanently acid-stable, e.g.
        uraninite / molybdenite) or the current pH is above its
        threshold.
        """
        ph = self.conditions.fluid.pH
        by_id = {c.crystal_id: c for c in self.crystals}
        blocked = set()
        for i, cell in enumerate(self.wall_state.rings[0]):
            if cell.crystal_id is None:
                continue
            crystal = by_id.get(cell.crystal_id)
            if not crystal or crystal.dissolved:
                continue
            acid = MINERAL_SPEC.get(crystal.mineral, {}).get('acid_dissolution')
            if acid is None:
                blocked.add(i)
                continue
            threshold = acid.get('pH_threshold')
            if threshold is None or ph >= threshold:
                blocked.add(i)
        return blocked

    def _apply_radiation_dose(self) -> None:
        """Accumulate α-damage on every quartz growth zone while any uraninite
        is still active in the vug. The damage is stored per-zone so it persists
        after the uraninite later dissolves; the crystal's final color depends
        on integrated dose across all zones (see Crystal.predict_color)."""
        # Enclosed uraninite still emits — active=False via enclosure doesn't
        # stop alpha decay. Only dissolution removes the crystal as a source
        # (the uranium went back into solution).
        uraninite_sources = [c for c in self.crystals if c.mineral == "uraninite" and not c.dissolved]
        if not uraninite_sources:
            return
        # Dose scales with number of uraninite sources present. 0.02 per source
        # per step puts ~15-25 steps of single-source exposure at the smoky
        # threshold (0.3 avg), matching the spec color_rules in minerals.json.
        dose = 0.02 * len(uraninite_sources)
        for crystal in self.crystals:
            if crystal.mineral != "quartz":
                continue
            for zone in crystal.zones:
                if zone.thickness_um > 0:
                    zone.radiation_damage += dose

    def _at_nucleation_cap(self, mineral: str) -> bool:
        """True if the mineral has reached its spec max_nucleation_count
        for crystals *still exposed on the wall* — enclosed and
        dissolved crystals don't count toward the cap because the
        surface they held is effectively gone (buried by the host, or
        etched away).

        This is what lets a classic MVT calcite accumulate dense
        chalcopyrite inclusion trails: the sulfide nucleates, grows a
        little, gets enveloped, and fresh bare wall from the host's
        advancing front becomes available for another sulfide to
        nucleate. Real specimens can carry hundreds of inclusions."""
        cap = MINERAL_SPEC.get(mineral, {}).get("max_nucleation_count")
        if cap is None:
            return False
        n = 0
        for c in self.crystals:
            if c.mineral != mineral:
                continue
            if c.enclosed_by is not None or c.dissolved:
                continue
            n += 1
            if n >= cap:
                return True
        return False

    def check_nucleation(self):
        """Check if new crystals should nucleate."""
        # Quartz nucleation
        sigma_q = self.conditions.supersaturation_quartz()
        existing_quartz = [c for c in self.crystals if c.mineral == "quartz" and c.active]
        if sigma_q > 1.2 and not self._at_nucleation_cap("quartz"):
            if not existing_quartz or (sigma_q > 2.0 and random.random() < 0.3):
                c = self.nucleate("quartz", sigma=sigma_q)
                self.log.append(f"  ✦ NUCLEATION: Quartz #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_q:.2f})")
        
        # Calcite nucleation
        sigma_c = self.conditions.supersaturation_calcite()
        existing_calcite = [c for c in self.crystals if c.mineral == "calcite" and c.active]
        if sigma_c > 1.3 and not existing_calcite and not self._at_nucleation_cap("calcite"):
            c = self.nucleate("calcite", sigma=sigma_c)
            self.log.append(f"  ✦ NUCLEATION: Calcite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_c:.2f})")
        
        # Sphalerite nucleation
        sigma_s = self.conditions.supersaturation_sphalerite()
        existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
        if sigma_s > 1.0 and not existing_sph and not self._at_nucleation_cap("sphalerite"):
            c = self.nucleate("sphalerite", position="vug wall", sigma=sigma_s)
            self.log.append(f"  ✦ NUCLEATION: Sphalerite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_s:.2f})")

        # Wurtzite nucleation — T>95°C hexagonal ZnS dimorph
        sigma_wz = self.conditions.supersaturation_wurtzite()
        existing_wz = [c for c in self.crystals if c.mineral == "wurtzite" and c.active]
        if sigma_wz > 1.0 and not existing_wz and not self._at_nucleation_cap("wurtzite"):
            c = self.nucleate("wurtzite", position="vug wall", sigma=sigma_wz)
            self.log.append(f"  ✦ NUCLEATION: Wurtzite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_wz:.2f})")
        
        # Fluorite nucleation
        sigma_f = self.conditions.supersaturation_fluorite()
        existing_fl = [c for c in self.crystals if c.mineral == "fluorite" and c.active]
        if sigma_f > 1.2 and not existing_fl and not self._at_nucleation_cap("fluorite"):
            c = self.nucleate("fluorite", position="vug wall", sigma=sigma_f)
            self.log.append(f"  ✦ NUCLEATION: Fluorite #{c.crystal_id} on {c.position}")
        
        # Pyrite nucleation — microcrystalline swarms aren't interesting individually
        # (cap comes from spec).
        sigma_py = self.conditions.supersaturation_pyrite()
        existing_py = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
        if sigma_py > 1.0 and not existing_py and not self._at_nucleation_cap("pyrite"):
            pos = "vug wall"
            existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            if existing_sph and random.random() < 0.5:
                pos = f"on sphalerite #{existing_sph[0].crystal_id}"
            c = self.nucleate("pyrite", position=pos, sigma=sigma_py)
            self.log.append(f"  ✦ NUCLEATION: Pyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_py:.2f})")

        # Marcasite nucleation — pH<5, T<240. The acidic dimorph.
        sigma_mc = self.conditions.supersaturation_marcasite()
        existing_mc = [c for c in self.crystals if c.mineral == "marcasite" and c.active]
        if sigma_mc > 1.0 and not existing_mc and not self._at_nucleation_cap("marcasite"):
            pos = "vug wall"
            # Prefer existing sphalerite or galena substrate — classic MVT association
            existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            existing_gal = [c for c in self.crystals if c.mineral == "galena" and c.active]
            if existing_sph and random.random() < 0.5:
                pos = f"on sphalerite #{existing_sph[0].crystal_id}"
            elif existing_gal and random.random() < 0.4:
                pos = f"on galena #{existing_gal[0].crystal_id}"
            c = self.nucleate("marcasite", position=pos, sigma=sigma_mc)
            self.log.append(f"  ✦ NUCLEATION: Marcasite #{c.crystal_id} on {c.position} "
                          f"(pH={self.conditions.fluid.pH:.1f}, σ={sigma_mc:.2f})")

        # Chalcopyrite nucleation
        sigma_cp = self.conditions.supersaturation_chalcopyrite()
        existing_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
        if sigma_cp > 1.0 and not existing_cp and not self._at_nucleation_cap("chalcopyrite"):
            pos = "vug wall"
            if existing_py and random.random() < 0.4:
                pos = f"on pyrite #{existing_py[0].crystal_id}"
            c = self.nucleate("chalcopyrite", position=pos, sigma=sigma_cp)
            self.log.append(f"  ✦ NUCLEATION: Chalcopyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cp:.2f})")
        
        # Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
        sigma_hem = self.conditions.supersaturation_hematite()
        existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
        if sigma_hem > 1.2 and not existing_hem and not self._at_nucleation_cap("hematite"):
            pos = "vug wall"
            # Can nucleate on existing quartz
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("hematite", position=pos, sigma=sigma_hem)
            self.log.append(f"  ✦ NUCLEATION: Hematite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_hem:.2f})")
        
        # Malachite nucleation — needs sigma > 1.0
        sigma_mal = self.conditions.supersaturation_malachite()
        existing_mal = [c for c in self.crystals if c.mineral == "malachite" and c.active]
        if sigma_mal > 1.0 and not existing_mal and not self._at_nucleation_cap("malachite"):
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
            c = self.nucleate("malachite", position=pos, sigma=sigma_mal)
            self.log.append(f"  ✦ NUCLEATION: Malachite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mal:.2f})")
        
        # Adamite nucleation — Zn + As + O₂, low T oxidation zone
        sigma_adam = self.conditions.supersaturation_adamite()
        existing_adam = [c for c in self.crystals if c.mineral == "adamite" and c.active]
        if sigma_adam > 1.0 and not existing_adam and not self._at_nucleation_cap("adamite"):
            pos = "vug wall"
            # Preference for limonite/goethite substrate (classic association)
            existing_goethite = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if existing_goethite and random.random() < 0.6:
                pos = f"on goethite #{existing_goethite[0].crystal_id}"
            elif existing_hem and random.random() < 0.4:
                pos = f"on hematite #{existing_hem[0].crystal_id}"
            # Nucleate multiple crystals — adamite forms sprays
            c = self.nucleate("adamite", position=pos, sigma=sigma_adam)
            self.log.append(f"  ✦ NUCLEATION: Adamite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_adam:.2f})")
            # Second crystal often nucleates nearby — the fluorescent/non-fluorescent pair
            if sigma_adam > 1.3 and random.random() < 0.5 and not self._at_nucleation_cap("adamite"):
                c2 = self.nucleate("adamite", position=pos, sigma=sigma_adam)
                self.log.append(f"  ✦ NUCLEATION: Adamite #{c2.crystal_id} alongside #{c.crystal_id} "
                              f"— will one fluoresce and the other stay dark?")
        
        # Mimetite nucleation — Pb + As + Cl + O₂, oxidation zone
        sigma_mim = self.conditions.supersaturation_mimetite()
        existing_mim = [c for c in self.crystals if c.mineral == "mimetite" and c.active]
        if sigma_mim > 1.0 and not existing_mim and not self._at_nucleation_cap("mimetite"):
            pos = "vug wall"
            # Preference for galena surface (classic! mimetite replaces/coats galena)
            existing_galena = [c for c in self.crystals if c.mineral == "galena"]
            existing_goethite_mim = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            if existing_galena and random.random() < 0.6:
                pos = f"on galena #{existing_galena[0].crystal_id}"
            elif existing_goethite_mim and random.random() < 0.3:
                pos = f"on goethite #{existing_goethite_mim[0].crystal_id}"
            c = self.nucleate("mimetite", position=pos, sigma=sigma_mim)
            self.log.append(f"  ✦ NUCLEATION: Mimetite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mim:.2f})")
        
        # Feldspar nucleation — K-feldspar (orthoclase/microcline/sanidine)
        sigma_fsp = self.conditions.supersaturation_feldspar()
        existing_fsp = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
        if sigma_fsp > 1.0 and not existing_fsp and not self._at_nucleation_cap("feldspar"):
            pos = "vug wall"
            # Feldspar can nucleate on quartz — common in pegmatites
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("feldspar", position=pos, sigma=sigma_fsp)
            self.log.append(f"  ✦ NUCLEATION: K-feldspar #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_fsp:.2f})")
        
        # Albite nucleation — Na-feldspar
        # Can coexist with K-feldspar (perthite pair).
        sigma_ab = self.conditions.supersaturation_albite()
        existing_ab = [c for c in self.crystals if c.mineral == "albite" and c.active]
        if sigma_ab > 1.0 and not existing_ab and not self._at_nucleation_cap("albite"):
            pos = "vug wall"
            # Albite often nucleates on feldspar — the perthite association
            if existing_fsp and random.random() < 0.5:
                pos = f"on feldspar #{existing_fsp[0].crystal_id}"
            elif existing_quartz and random.random() < 0.3:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("albite", position=pos, sigma=sigma_ab)
            self.log.append(f"  ✦ NUCLEATION: Albite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ab:.2f})")

        # Molybdenite nucleation (rare — porphyry systems don't flood the vug)
        sigma_mol = self.conditions.supersaturation_molybdenite()
        if sigma_mol > 2.0 and not self._at_nucleation_cap("molybdenite"):
            if random.random() < 0.08:
                c = self.nucleate("molybdenite", position="vug wall", sigma=sigma_mol)
                self.log.append(f"  ✦ NUCLEATION: Molybdenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mol:.2f})")

        # Galena nucleation
        sigma_gal = self.conditions.supersaturation_galena()
        if sigma_gal > 1.5 and not self._at_nucleation_cap("galena"):
            if random.random() < 0.12:
                c = self.nucleate("galena", position="vug wall", sigma=sigma_gal)
                self.log.append(f"  ✦ NUCLEATION: Galena #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_gal:.2f})")

        # Wulfenite nucleation — needs both Pb AND Mo oxidized (late-stage)
        sigma_wul = self.conditions.supersaturation_wulfenite()
        if sigma_wul > 1.3 and not self._at_nucleation_cap("wulfenite"):
            if random.random() < 0.15:
                c = self.nucleate("wulfenite", position="vug wall", sigma=sigma_wul)
                self.log.append(f"  ✦ NUCLEATION: Wulfenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_wul:.2f})")

        # Uraninite nucleation — strongly reducing, U-bearing. Emits radiation each step.
        sigma_ur = self.conditions.supersaturation_uraninite()
        if sigma_ur > 1.5 and not self._at_nucleation_cap("uraninite") and random.random() < 0.08:
            c = self.nucleate("uraninite", position="vug wall", sigma=sigma_ur)
            self.log.append(f"  ✦ NUCLEATION: Uraninite #{c.crystal_id} on {c.position} "
                          f"☢️  (T={self.conditions.temperature:.0f}°C, σ={sigma_ur:.2f})")

        # Goethite nucleation — the ghost mineral, now real.
        # Classic pseudomorph after pyrite/marcasite; also forms on hematite, or free on walls.
        sigma_goe = self.conditions.supersaturation_goethite()
        existing_goe = [c for c in self.crystals if c.mineral == "goethite" and c.active]
        if sigma_goe > 1.0 and not existing_goe and not self._at_nucleation_cap("goethite"):
            pos = "vug wall"
            dissolving_py = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
            dissolving_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
            active_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if dissolving_py and random.random() < 0.7:
                pos = f"pseudomorph after pyrite #{dissolving_py[0].crystal_id}"
            elif dissolving_cp and random.random() < 0.5:
                pos = f"pseudomorph after chalcopyrite #{dissolving_cp[0].crystal_id}"
            elif active_hem and random.random() < 0.3:
                pos = f"on hematite #{active_hem[0].crystal_id}"
            c = self.nucleate("goethite", position=pos, sigma=sigma_goe)
            self.log.append(f"  ✦ NUCLEATION: Goethite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_goe:.2f})")

        # Smithsonite nucleation — supergene ZnCO₃ from sphalerite oxidation
        sigma_sm = self.conditions.supersaturation_smithsonite()
        existing_sm = [c for c in self.crystals if c.mineral == "smithsonite" and c.active]
        if sigma_sm > 1.0 and not existing_sm and not self._at_nucleation_cap("smithsonite"):
            pos = "vug wall"
            dissolving_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.dissolved]
            if dissolving_sph and random.random() < 0.6:
                pos = f"on sphalerite #{dissolving_sph[0].crystal_id}"
            c = self.nucleate("smithsonite", position=pos, sigma=sigma_sm)
            self.log.append(f"  ✦ NUCLEATION: Smithsonite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_sm:.2f})")

        # Selenite nucleation — low-T evaporite, needs oxidized Ca-SO4 fluid
        sigma_sel = self.conditions.supersaturation_selenite()
        if sigma_sel > 1.0 and not self._at_nucleation_cap("selenite") and random.random() < 0.12:
            c = self.nucleate("selenite", position="vug wall", sigma=sigma_sel)
            self.log.append(f"  ✦ NUCLEATION: Selenite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_sel:.2f})")

        # Spodumene nucleation — Li + Al + SiO₂ (Li-gated).
        # Lithium is mildly incompatible — accumulates late in pegmatite
        # crystallization. Spodumene competes with elbaite tourmaline for
        # Li; whichever threshold fires first depending on which other
        # ingredients are available (B for tourmaline, SiO₂ window for
        # spodumene). max_nucleation_count=4 keeps it realistic.
        sigma_spd = self.conditions.supersaturation_spodumene()
        existing_spd = [c for c in self.crystals if c.mineral == "spodumene" and c.active]
        if sigma_spd > 1.5 and not self._at_nucleation_cap("spodumene"):
            if not existing_spd or (sigma_spd > 2.5 and random.random() < 0.15):
                pos = "vug wall"
                existing_feldspar_spd = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if existing_quartz and random.random() < 0.35:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                elif existing_feldspar_spd and random.random() < 0.35:
                    pos = f"on feldspar #{existing_feldspar_spd[0].crystal_id}"
                c = self.nucleate("spodumene", position=pos, sigma=sigma_spd)
                f = self.conditions.fluid
                if f.Cr > 0.5: tag = "hiddenite"
                elif f.Mn > 2.0: tag = "kunzite"
                elif f.Fe > 10: tag = "triphane-yellow"
                else: tag = "triphane"
                self.log.append(f"  ✦ NUCLEATION: Spodumene #{c.crystal_id} ({tag}) on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_spd:.2f}, "
                              f"Li={f.Li:.0f} ppm, Mn={f.Mn:.1f}, Cr={f.Cr:.2f})")

        # Beryl nucleation — Be + Al + SiO₂ (Be-gated, high σ threshold).
        # Beryllium is the most incompatible common element: no other
        # mineral consumes it, so it accumulates freely in pegmatite
        # fluids until σ finally crosses 1.8. The delay is part of the
        # point — when beryl does nucleate, there's a LOT of Be waiting,
        # which is why crystals can reach meters. max_nucleation_count=4
        # keeps the count realistic (pegmatite pockets usually have a
        # handful of large beryls, not dozens of small ones).
        sigma_ber = self.conditions.supersaturation_beryl()
        existing_ber = [c for c in self.crystals if c.mineral == "beryl" and c.active]
        if sigma_ber > 1.8 and not self._at_nucleation_cap("beryl"):
            if not existing_ber or (sigma_ber > 2.5 and random.random() < 0.15):
                pos = "vug wall"
                existing_feldspar_ber = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if existing_quartz and random.random() < 0.4:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                elif existing_feldspar_ber and random.random() < 0.4:
                    pos = f"on feldspar #{existing_feldspar_ber[0].crystal_id}"
                c = self.nucleate("beryl", position=pos, sigma=sigma_ber)
                f = self.conditions.fluid
                if f.Cr > 0.5 or f.V > 1.0: tag = "emerald"
                elif f.Mn > 2.0: tag = "morganite"
                elif f.Fe > 15 and f.O2 > 0.5: tag = "heliodor"
                elif f.Fe > 8: tag = "aquamarine"
                else: tag = "goshenite"
                self.log.append(f"  ✦ NUCLEATION: Beryl #{c.crystal_id} ({tag}) on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ber:.2f}, "
                              f"Be={f.Be:.0f} ppm, Cr={f.Cr:.2f}, Fe={f.Fe:.0f})")

        # Magnetite nucleation — Fe + moderate O2 (HM buffer).
        sigma_mag = self.conditions.supersaturation_magnetite()
        existing_mag = [c for c in self.crystals if c.mineral == "magnetite" and c.active]
        if sigma_mag > 1.0 and not self._at_nucleation_cap("magnetite"):
            if not existing_mag or (sigma_mag > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                active_hem_mag = [c for c in self.crystals if c.mineral == "hematite" and c.active]
                if active_hem_mag and random.random() < 0.3:
                    pos = f"on hematite #{active_hem_mag[0].crystal_id}"
                c = self.nucleate("magnetite", position=pos, sigma=sigma_mag)
                self.log.append(f"  ✦ NUCLEATION: Magnetite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mag:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f}, O₂={self.conditions.fluid.O2:.2f})")

        # Lepidocrocite nucleation — Fe + rapid oxidation at low T.
        sigma_lep = self.conditions.supersaturation_lepidocrocite()
        existing_lep = [c for c in self.crystals if c.mineral == "lepidocrocite" and c.active]
        if sigma_lep > 1.1 and not self._at_nucleation_cap("lepidocrocite"):
            if not existing_lep or (sigma_lep > 1.7 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_py_lep = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
                active_qtz_lep = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                if dissolving_py_lep and random.random() < 0.6:
                    pos = f"on pyrite #{dissolving_py_lep[0].crystal_id}"
                elif active_qtz_lep and random.random() < 0.3:
                    pos = f"on quartz #{active_qtz_lep[0].crystal_id}"
                c = self.nucleate("lepidocrocite", position=pos, sigma=sigma_lep)
                self.log.append(f"  ✦ NUCLEATION: Lepidocrocite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_lep:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f})")

        # Stibnite nucleation — Sb + S + moderate T + reducing.
        sigma_stb = self.conditions.supersaturation_stibnite()
        existing_stb = [c for c in self.crystals if c.mineral == "stibnite" and c.active]
        if sigma_stb > 1.2 and not self._at_nucleation_cap("stibnite"):
            if not existing_stb or (sigma_stb > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_qtz_stb = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                if active_qtz_stb and random.random() < 0.4:
                    pos = f"on quartz #{active_qtz_stb[0].crystal_id}"
                c = self.nucleate("stibnite", position=pos, sigma=sigma_stb)
                self.log.append(f"  ✦ NUCLEATION: Stibnite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_stb:.2f}, "
                              f"Sb={self.conditions.fluid.Sb:.0f}, S={self.conditions.fluid.S:.0f})")

        # Bismuthinite nucleation — Bi + S + high T + reducing.
        sigma_bmt = self.conditions.supersaturation_bismuthinite()
        existing_bmt = [c for c in self.crystals if c.mineral == "bismuthinite" and c.active]
        if sigma_bmt > 1.3 and not self._at_nucleation_cap("bismuthinite"):
            if not existing_bmt or (sigma_bmt > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_qtz_bmt = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                active_cp_bmt = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_qtz_bmt and random.random() < 0.3:
                    pos = f"on quartz #{active_qtz_bmt[0].crystal_id}"
                elif active_cp_bmt and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_bmt[0].crystal_id}"
                c = self.nucleate("bismuthinite", position=pos, sigma=sigma_bmt)
                self.log.append(f"  ✦ NUCLEATION: Bismuthinite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_bmt:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.0f}, S={self.conditions.fluid.S:.0f})")

        # Native bismuth nucleation — Bi + very low S + reducing.
        sigma_nbi = self.conditions.supersaturation_native_bismuth()
        existing_nbi = [c for c in self.crystals if c.mineral == "native_bismuth" and c.active]
        if sigma_nbi > 1.4 and not self._at_nucleation_cap("native_bismuth"):
            if not existing_nbi or (sigma_nbi > 2.0 and random.random() < 0.15):
                pos = "vug wall"
                dissolving_bmt = [c for c in self.crystals if c.mineral == "bismuthinite" and c.dissolved]
                if dissolving_bmt and random.random() < 0.5:
                    pos = f"on bismuthinite #{dissolving_bmt[0].crystal_id}"
                c = self.nucleate("native_bismuth", position=pos, sigma=sigma_nbi)
                self.log.append(f"  ✦ NUCLEATION: Native bismuth #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nbi:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.0f}, S={self.conditions.fluid.S:.0f})")

        # Clinobisvanite nucleation — Bi + V + oxidizing + low T.
        sigma_cbv = self.conditions.supersaturation_clinobisvanite()
        existing_cbv = [c for c in self.crystals if c.mineral == "clinobisvanite" and c.active]
        if sigma_cbv > 1.5 and not self._at_nucleation_cap("clinobisvanite"):
            if not existing_cbv or (sigma_cbv > 2.0 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_nbi = [c for c in self.crystals if c.mineral == "native_bismuth" and c.dissolved]
                dissolving_bmt_cbv = [c for c in self.crystals if c.mineral == "bismuthinite" and c.dissolved]
                if dissolving_nbi and random.random() < 0.5:
                    pos = f"on native_bismuth #{dissolving_nbi[0].crystal_id}"
                elif dissolving_bmt_cbv and random.random() < 0.4:
                    pos = f"on bismuthinite #{dissolving_bmt_cbv[0].crystal_id}"
                c = self.nucleate("clinobisvanite", position=pos, sigma=sigma_cbv)
                self.log.append(f"  ✦ NUCLEATION: Clinobisvanite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cbv:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.1f}, V={self.conditions.fluid.V:.1f})")

        # Cuprite nucleation — Cu + narrow O₂ window.
        # Prefers native copper substrate (next step in the oxidation
        # sequence) or chalcocite.
        sigma_cpr = self.conditions.supersaturation_cuprite()
        existing_cpr = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
        if sigma_cpr > 1.2 and not self._at_nucleation_cap("cuprite"):
            if not existing_cpr or (sigma_cpr > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_nc = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                active_chc_cpr = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                if active_nc and random.random() < 0.6:
                    pos = f"on native_copper #{active_nc[0].crystal_id}"
                elif active_chc_cpr and random.random() < 0.3:
                    pos = f"on chalcocite #{active_chc_cpr[0].crystal_id}"
                c = self.nucleate("cuprite", position=pos, sigma=sigma_cpr)
                self.log.append(f"  ✦ NUCLEATION: Cuprite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cpr:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, O₂={self.conditions.fluid.O2:.1f})")

        # Azurite nucleation — Cu + high CO₃ + O₂.
        # Grows on cuprite or free on wall.
        sigma_azr = self.conditions.supersaturation_azurite()
        existing_azr = [c for c in self.crystals if c.mineral == "azurite" and c.active]
        if sigma_azr > 1.4 and not self._at_nucleation_cap("azurite"):
            if not existing_azr or (sigma_azr > 2.0 and random.random() < 0.25):
                pos = "vug wall"
                active_cpr_azr = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
                active_nc_azr = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                if active_cpr_azr and random.random() < 0.4:
                    pos = f"on cuprite #{active_cpr_azr[0].crystal_id}"
                elif active_nc_azr and random.random() < 0.3:
                    pos = f"on native_copper #{active_nc_azr[0].crystal_id}"
                c = self.nucleate("azurite", position=pos, sigma=sigma_azr)
                self.log.append(f"  ✦ NUCLEATION: Azurite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_azr:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, CO₃={self.conditions.fluid.CO3:.0f})")

        # Chrysocolla nucleation — Cu²⁺ + SiO₂ at low-T oxidation, the
        # cyan finale of the copper paragenesis. Wins over azurite/
        # malachite when CO₃ has dropped and SiO₂ has risen (see
        # supersaturation_chrysocolla's CO₃/SiO₂ gate). Prefers to
        # crust over cuprite or native copper and to pseudomorph
        # azurite once the pCO₂ drop arrives — the Bisbee story.
        sigma_chry = self.conditions.supersaturation_chrysocolla()
        existing_chry = [c for c in self.crystals if c.mineral == "chrysocolla" and c.active]
        if sigma_chry > 1.2 and not self._at_nucleation_cap("chrysocolla"):
            if not existing_chry or (sigma_chry > 1.8 and random.random() < 0.25):
                pos = "vug wall"
                active_azr_chry = [c for c in self.crystals if c.mineral == "azurite" and c.active]
                dissolving_azr_chry = [c for c in self.crystals if c.mineral == "azurite" and c.dissolved]
                active_cpr_chry = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
                active_nc_chry = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                # Pseudomorph-after-azurite preferred when azurite has
                # just dissolved (pCO₂ drop) AND silica is available.
                if dissolving_azr_chry and random.random() < 0.6:
                    pos = f"pseudomorph after azurite #{dissolving_azr_chry[0].crystal_id}"
                elif active_azr_chry and random.random() < 0.3:
                    pos = f"on azurite #{active_azr_chry[0].crystal_id}"
                elif active_cpr_chry and random.random() < 0.5:
                    pos = f"on cuprite #{active_cpr_chry[0].crystal_id}"
                elif active_nc_chry and random.random() < 0.4:
                    pos = f"on native_copper #{active_nc_chry[0].crystal_id}"
                c = self.nucleate("chrysocolla", position=pos, sigma=sigma_chry)
                self.log.append(f"  ✦ NUCLEATION: Chrysocolla #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_chry:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, SiO₂={self.conditions.fluid.SiO2:.0f}, "
                              f"CO₃={self.conditions.fluid.CO3:.0f})")

        # Native copper nucleation — Cu + strongly reducing + low S.
        # Grows on chalcocite/bornite or free on wall when the fluid is
        # very reducing.
        sigma_nc = self.conditions.supersaturation_native_copper()
        existing_nc_nuc = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
        if sigma_nc > 1.6 and not self._at_nucleation_cap("native_copper"):
            if not existing_nc_nuc or (sigma_nc > 2.2 and random.random() < 0.15):
                pos = "vug wall"
                active_chc_nc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                active_brn_nc = [c for c in self.crystals if c.mineral == "bornite" and c.active]
                if active_chc_nc and random.random() < 0.4:
                    pos = f"on chalcocite #{active_chc_nc[0].crystal_id}"
                elif active_brn_nc and random.random() < 0.3:
                    pos = f"on bornite #{active_brn_nc[0].crystal_id}"
                c = self.nucleate("native_copper", position=pos, sigma=sigma_nc)
                self.log.append(f"  ✦ NUCLEATION: Native copper #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nc:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, O₂={self.conditions.fluid.O2:.2f})")

        # Bornite nucleation — Cu + Fe + S, Cu:Fe > 2:1 (competes with
        # chalcopyrite for the same elements).
        sigma_brn = self.conditions.supersaturation_bornite()
        existing_brn = [c for c in self.crystals if c.mineral == "bornite" and c.active]
        if sigma_brn > 1.0 and not self._at_nucleation_cap("bornite"):
            if not existing_brn or (sigma_brn > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                dissolving_cp_brn = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
                active_cp_brn = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if dissolving_cp_brn and random.random() < 0.5:
                    pos = f"on chalcopyrite #{dissolving_cp_brn[0].crystal_id}"
                elif active_cp_brn and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_brn[0].crystal_id}"
                c = self.nucleate("bornite", position=pos, sigma=sigma_brn)
                self.log.append(f"  ✦ NUCLEATION: Bornite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_brn:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, Fe={self.conditions.fluid.Fe:.0f})")

        # Chalcocite nucleation — Cu-rich + S + low T + reducing.
        # The pseudomorph thief: prefers chalcopyrite or bornite hosts
        # to replace them atom-by-atom (the supergene enrichment story).
        sigma_chc = self.conditions.supersaturation_chalcocite()
        existing_chc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
        if sigma_chc > 1.1 and not self._at_nucleation_cap("chalcocite"):
            if not existing_chc or (sigma_chc > 1.7 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_cp_chc = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
                active_cp_chc = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                dissolving_brn = [c for c in self.crystals if c.mineral == "bornite" and c.dissolved]
                active_brn = [c for c in self.crystals if c.mineral == "bornite" and c.active]
                if dissolving_cp_chc and random.random() < 0.6:
                    pos = f"on chalcopyrite #{dissolving_cp_chc[0].crystal_id}"
                elif active_cp_chc and random.random() < 0.4:
                    pos = f"on chalcopyrite #{active_cp_chc[0].crystal_id}"
                elif dissolving_brn and random.random() < 0.6:
                    pos = f"on bornite #{dissolving_brn[0].crystal_id}"
                elif active_brn and random.random() < 0.4:
                    pos = f"on bornite #{active_brn[0].crystal_id}"
                c = self.nucleate("chalcocite", position=pos, sigma=sigma_chc)
                self.log.append(f"  ✦ NUCLEATION: Chalcocite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_chc:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f})")

        # Covellite nucleation — Cu + S-rich + low T (transition zone).
        # Often nucleates on chalcocite at the S-Cu stoichiometry break.
        sigma_cov = self.conditions.supersaturation_covellite()
        existing_cov = [c for c in self.crystals if c.mineral == "covellite" and c.active]
        if sigma_cov > 1.2 and not self._at_nucleation_cap("covellite"):
            if not existing_cov or (sigma_cov > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                active_chc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                active_cp_cov = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_chc and random.random() < 0.5:
                    pos = f"on chalcocite #{active_chc[0].crystal_id}"
                elif active_cp_cov and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_cov[0].crystal_id}"
                c = self.nucleate("covellite", position=pos, sigma=sigma_cov)
                self.log.append(f"  ✦ NUCLEATION: Covellite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cov:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f})")

        # Anglesite nucleation — Pb + oxidized S + O₂ (supergene).
        # Strongly paragenetic — prefers dissolving/oxidizing galena.
        sigma_ang = self.conditions.supersaturation_anglesite()
        existing_ang = [c for c in self.crystals if c.mineral == "anglesite" and c.active]
        if sigma_ang > 1.1 and not self._at_nucleation_cap("anglesite"):
            if not existing_ang or (sigma_ang > 1.8 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_gal = [c for c in self.crystals if c.mineral == "galena" and (c.dissolved or random.random() < 0.6)]
                active_gal = [c for c in self.crystals if c.mineral == "galena" and c.active]
                if dissolving_gal and random.random() < 0.6:
                    pos = f"on galena #{dissolving_gal[0].crystal_id}"
                elif active_gal and random.random() < 0.4:
                    pos = f"on galena #{active_gal[0].crystal_id}"
                c = self.nucleate("anglesite", position=pos, sigma=sigma_ang)
                self.log.append(f"  ✦ NUCLEATION: Anglesite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ang:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, S={self.conditions.fluid.S:.0f})")

        # Cerussite nucleation — Pb + CO₃ (supergene).
        # Final stable Pb phase in carbonate groundwater. Prefers
        # anglesite or galena hosts (replacement pseudomorph).
        sigma_cer = self.conditions.supersaturation_cerussite()
        existing_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.active]
        if sigma_cer > 1.0 and not self._at_nucleation_cap("cerussite"):
            if not existing_cer or (sigma_cer > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_ang = [c for c in self.crystals if c.mineral == "anglesite" and c.dissolved]
                dissolving_gal_c = [c for c in self.crystals if c.mineral == "galena" and c.dissolved]
                active_gal_c = [c for c in self.crystals if c.mineral == "galena" and c.active]
                if dissolving_ang and random.random() < 0.7:
                    pos = f"on anglesite #{dissolving_ang[0].crystal_id}"
                elif dissolving_gal_c and random.random() < 0.5:
                    pos = f"on galena #{dissolving_gal_c[0].crystal_id}"
                elif active_gal_c and random.random() < 0.3:
                    pos = f"on galena #{active_gal_c[0].crystal_id}"
                c = self.nucleate("cerussite", position=pos, sigma=sigma_cer)
                self.log.append(f"  ✦ NUCLEATION: Cerussite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cer:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, CO3={self.conditions.fluid.CO3:.0f})")

        # Pyromorphite nucleation — Pb + P + Cl (supergene, P-gated).
        # Can replace existing cerussite or galena when P-bearing water
        # arrives. max_nucleation_count=6 — these often form in groups.
        sigma_pyr = self.conditions.supersaturation_pyromorphite()
        existing_pyr = [c for c in self.crystals if c.mineral == "pyromorphite" and c.active]
        if sigma_pyr > 1.2 and not self._at_nucleation_cap("pyromorphite"):
            if not existing_pyr or (sigma_pyr > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.dissolved]
                active_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.active]
                existing_goe_pyr = [c for c in self.crystals if c.mineral == "goethite" and c.active]
                if dissolving_cer and random.random() < 0.6:
                    pos = f"on cerussite #{dissolving_cer[0].crystal_id}"
                elif active_cer and random.random() < 0.3:
                    pos = f"on cerussite #{active_cer[0].crystal_id}"
                elif existing_goe_pyr and random.random() < 0.3:
                    pos = f"on goethite #{existing_goe_pyr[0].crystal_id}"
                c = self.nucleate("pyromorphite", position=pos, sigma=sigma_pyr)
                self.log.append(f"  ✦ NUCLEATION: Pyromorphite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_pyr:.2f}, "
                              f"P={self.conditions.fluid.P:.1f}, Cl={self.conditions.fluid.Cl:.0f})")

        # Vanadinite nucleation — Pb + V + Cl (supergene, V-gated).
        # Classic iron-oxide-on-goethite habit. Grows on goethite or
        # free on wall.
        sigma_vnd = self.conditions.supersaturation_vanadinite()
        existing_vnd = [c for c in self.crystals if c.mineral == "vanadinite" and c.active]
        if sigma_vnd > 1.3 and not self._at_nucleation_cap("vanadinite"):
            if not existing_vnd or (sigma_vnd > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                existing_goe_vnd = [c for c in self.crystals if c.mineral == "goethite" and c.active]
                dissolving_cer_v = [c for c in self.crystals if c.mineral == "cerussite" and c.dissolved]
                if existing_goe_vnd and random.random() < 0.7:
                    pos = f"on goethite #{existing_goe_vnd[0].crystal_id}"
                elif dissolving_cer_v and random.random() < 0.4:
                    pos = f"on cerussite #{dissolving_cer_v[0].crystal_id}"
                c = self.nucleate("vanadinite", position=pos, sigma=sigma_vnd)
                self.log.append(f"  ✦ NUCLEATION: Vanadinite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_vnd:.2f}, "
                              f"V={self.conditions.fluid.V:.1f}, Pb={self.conditions.fluid.Pb:.0f})")

        # Tourmaline nucleation — Na + B + Al + SiO₂ (B-gated).
        # Threshold nucleation_sigma=1.3 is the pegmatite gate: needs
        # boron accumulated past saturation, which no other current
        # mineral consumes, so B builds freely in the pegmatite fluid.
        # Schorl (Fe²⁺-dominant black) nucleates first when Fe is high;
        # later zones transition to elbaite varieties as Fe depletes
        # and Li accumulates in residual pocket fluid.
        sigma_tml = self.conditions.supersaturation_tourmaline()
        existing_tml = [c for c in self.crystals if c.mineral == "tourmaline" and c.active]
        if sigma_tml > 1.3 and not self._at_nucleation_cap("tourmaline"):
            if not existing_tml or (sigma_tml > 2.0 and random.random() < 0.25):
                pos = "vug wall"
                # Can nucleate on quartz or feldspar substrate in pegmatites
                existing_feldspar = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if existing_quartz and random.random() < 0.4:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                elif existing_feldspar and random.random() < 0.4:
                    pos = f"on feldspar #{existing_feldspar[0].crystal_id}"
                c = self.nucleate("tourmaline", position=pos, sigma=sigma_tml)
                # Preview variety label from current fluid
                f = self.conditions.fluid
                if f.Cu > 1.0: tag = "Paraíba"
                elif f.Li > 10 and f.Mn > 0.3: tag = "rubellite"
                elif f.Li > 10 and (f.Cr > 0.5 or f.V > 1.0): tag = "verdelite"
                elif f.Fe > 15 and f.Li < 5: tag = "schorl"
                elif f.Li > 10: tag = "elbaite"
                else: tag = "mixed"
                self.log.append(f"  ✦ NUCLEATION: Tourmaline #{c.crystal_id} ({tag}) on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tml:.2f}, "
                              f"B={f.B:.0f} ppm, Fe={f.Fe:.0f}, Li={f.Li:.0f})")

        # Topaz nucleation — Al + SiO₂ + F (F-gated).
        # Threshold nucleation_sigma=1.4 is the Ouro Preto gate — early
        # quartz grows alone while fluorine accumulates; only when F
        # crosses saturation does topaz appear. Can nucleate on quartz
        # (vein-lining paragenesis — quartz first, topaz grows on the
        # quartz surface after F-rich fluid arrives).
        sigma_tpz = self.conditions.supersaturation_topaz()
        existing_tpz = [c for c in self.crystals if c.mineral == "topaz" and c.active]
        if sigma_tpz > 1.4 and not self._at_nucleation_cap("topaz"):
            if not existing_tpz or (sigma_tpz > 2.0 and random.random() < 0.3):
                pos = "vug wall"
                if existing_quartz and random.random() < 0.5:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                c = self.nucleate("topaz", position=pos, sigma=sigma_tpz)
                imperial = (self.conditions.fluid.Cr > 3.0)
                flag = " ✨ imperial color window open" if imperial else ""
                self.log.append(f"  ✦ NUCLEATION: Topaz #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tpz:.2f}, "
                              f"F={self.conditions.fluid.F:.0f} ppm, "
                              f"Cr={self.conditions.fluid.Cr:.1f} ppm){flag}")

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

        # pH recovery toward equilibrium — scaled by flow rate.
        # Fresh fluid flushing through the vug dilutes acid and restores
        # pH; a sealed pocket can't exchange fluid, so acidity persists
        # until mineral reactions buffer it. Recovery rate 0.1/step at
        # flow_rate=1.0, scaling down to near-zero at flow_rate~0.1
        # (sealed pocket). This preserves realistic kaolinization
        # windows in pegmatite pockets without breaking scenarios that
        # have quick acid pulses at normal flow.
        if self.conditions.fluid.pH < 6.5:
            recovery = 0.1 * min(self.conditions.flow_rate / 1.0, 2.0)
            self.conditions.fluid.pH += recovery
        
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
                
                # Require the candidate to have actually lived a bit
                # before it can be swallowed. Without this, a just-
                # nucleated crystal with zero zones qualifies on step 1
                # and gets enveloped before it grows a single face — a
                # loop of nucleate-then-instantly-enclose piles up
                # hundreds of inclusions in a handful of steps. Real
                # Sweetwater-style pyrite needs time to exhaust its
                # chemistry and stop growing before the calcite takes
                # it.
                if not candidate.zones or len(candidate.zones) < 3:
                    continue
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
            # Distribute the radial dissolution across unblocked wall cells.
            # Cells shielded by acid-resistant crystal growth don't erode,
            # concentrating the acid attack on the exposed slices — the
            # vug becomes lopsided as the deposit history accrues.
            blocked = self._wall_cells_blocked_by_crystals()
            self.wall_state.erode_cells(result['rate_mm'], blocked)

            post_sigma_cal = self.conditions.supersaturation_calcite()

            self.log.append(f"  🧱 WALL DISSOLUTION: {result['rate_mm']:.2f} mm of {wall.composition} dissolved")
            if blocked:
                self.log.append(f"     {len(blocked)} cell{'s' if len(blocked) != 1 else ''} shielded by acid-resistant crystal growth")
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

            # Universal max-size cap — 2x world record per data/minerals.json.
            # Closes the 321,248% runaway growth bug: crystals that hit the cap
            # retire from growth but remain in the inventory.
            cap_cm = MINERAL_SPEC.get(crystal.mineral, {}).get("max_size_cm")
            if cap_cm is not None and crystal.c_length_mm / 10.0 >= cap_cm:
                crystal.active = False
                self.log.append(
                    f"  ⛔ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                    f"reached size cap ({cap_cm:g} cm = 2× world record) — growth halts"
                )
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
        
        # Alpha-damage any quartz present while uraninite exists in the vug.
        # Each existing zone accumulates dose per step — damage is permanent,
        # persisting even after the uraninite later dissolves away.
        self._apply_radiation_dose()

        # Refresh the topo-map wall state from the current crystal list.
        # Cheap (~120 cells × ~20 crystals/step) and keeps per-cell
        # occupancy consistent with dissolution / enclosure changes below.
        self._repaint_wall_state()

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
            def _triggering_event(step: int):
                for e in self.events:
                    if abs(e.step - step) <= 2:
                        return e
                return None

            # Event-triggered batches come out step-by-step (their language
            # references the specific event). Untriggered nucleations are
            # deferred and then consolidated per-mineral below so a mineral
            # that re-nucleates 30× in a stable brine reads as one sentence
            # instead of 30 repeating lines.
            nuc_steps = sorted(set(c.nucleation_step for c in later_crystals))
            untriggered_by_mineral: Dict[str, List[Crystal]] = {}
            for ns in nuc_steps:
                batch = [c for c in later_crystals if c.nucleation_step == ns]
                batch_names = [c.mineral for c in batch]
                triggering_event = _triggering_event(ns)

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
                        for c in batch:
                            untriggered_by_mineral.setdefault(c.mineral, []).append(c)
                else:
                    for c in batch:
                        untriggered_by_mineral.setdefault(c.mineral, []).append(c)

            # Reference temp for "stable vs. falling" language: the starting
            # temperature of the first mineral to nucleate.
            ref_T = first_minerals[0].nucleation_temp if first_minerals else None

            for mineral, crystals in untriggered_by_mineral.items():
                crystals.sort(key=lambda c: c.nucleation_step)
                temps = [c.nucleation_temp for c in crystals]
                t_min, t_max = min(temps), max(temps)
                s_min = crystals[0].nucleation_step
                s_max = crystals[-1].nucleation_step
                mineral_cap = mineral.capitalize()

                if len(crystals) == 1:
                    c = crystals[0]
                    # Describe the thermal context of this single event.
                    if ref_T is not None and abs(c.nucleation_temp - ref_T) <= 2:
                        paragraphs.append(
                            f"At {c.nucleation_temp:.0f}°C, {mineral} nucleated at step "
                            f"{c.nucleation_step} — the brine had held its window long "
                            f"enough for saturation to tip over."
                        )
                    elif ref_T is not None and c.nucleation_temp < ref_T - 2:
                        paragraphs.append(
                            f"As temperature continued to fall, {mineral} nucleated at step "
                            f"{c.nucleation_step} ({c.nucleation_temp:.0f}°C)."
                        )
                    else:
                        paragraphs.append(
                            f"{mineral_cap} nucleated at step {c.nucleation_step} "
                            f"({c.nucleation_temp:.0f}°C)."
                        )
                    continue

                # Multiple nucleations of the same mineral with no event
                # attached — consolidate into one sentence.
                if t_max - t_min <= 4:
                    paragraphs.append(
                        f"Between step {s_min} and step {s_max}, {mineral} nucleated "
                        f"{len(crystals)} times as conditions held steady around "
                        f"{t_min:.0f}°C — the window stayed open."
                    )
                else:
                    direction = "cooled" if crystals[0].nucleation_temp > crystals[-1].nucleation_temp else "warmed"
                    paragraphs.append(
                        f"{mineral_cap} nucleated {len(crystals)} times between step "
                        f"{s_min} ({crystals[0].nucleation_temp:.0f}°C) and step "
                        f"{s_max} ({crystals[-1].nucleation_temp:.0f}°C) as the fluid "
                        f"{direction} through its window."
                    )
        
        # Narrate individual crystal stories for the larger ones.
        # Dispatch via _narrate_<mineral> — spec says every mineral must have one.
        significant = [c for c in self.crystals if c.total_growth_um > 100]
        for c in significant:
            fn = getattr(self, f"_narrate_{c.mineral}", None)
            story = fn(c) if fn else ""
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

        # Random scenarios earn a procedural "discovery" paragraph.
        archetype = getattr(self.conditions, "_random_archetype", None)
        if archetype:
            disc = self._narrate_discovery(archetype)
            if disc:
                paragraphs.append(disc)

        return "\n\n".join(paragraphs)

    def _render_fluid_table(self) -> str:
        """Render the pre-growth fluid as a markdown-style stats block:
        header line (T/P/pH) + element ppm table (descending) + absence callout
        for the marquee elements that are missing.
        """
        fluid = self.conditions.fluid
        T, P, pH = self.conditions.temperature, self.conditions.pressure, fluid.pH

        # Which elements we bother to report (ppm-scale species only)
        candidates = [
            'SiO2', 'Ca', 'CO3', 'Fe', 'Mn', 'Mg', 'Al', 'Ti', 'F', 'S', 'Cl',
            'Zn', 'Cu', 'Pb', 'Mo', 'U', 'Na', 'K', 'Ba', 'Sr', 'Cr', 'P', 'As',
            'V', 'W', 'Ag', 'Au', 'Bi', 'Sb', 'Ni', 'Co', 'B', 'Li', 'Be',
            'Te', 'Se', 'Ge',
        ]
        present, absent = [], []
        # Elements whose *absence* is narratively interesting to call out
        marquee = {'Zn', 'Mo', 'Cu', 'Pb', 'W', 'U', 'Au', 'Ag', 'F', 'S', 'As'}
        for c in candidates:
            val = getattr(fluid, c, 0) or 0
            if val > 0.1:
                present.append((c, val))
            elif c in marquee:
                absent.append(c)
        present.sort(key=lambda kv: -kv[1])

        rows = ["| Element | ppm |", "|---------|-----|"]
        for elem, val in present:
            rows.append(f"| {elem:<7s} | {val:>5.0f} |")
        table = "\n".join(rows)

        abs_line = ""
        if absent:
            abs_line = "\n\n" + ". ".join(f"No {a}" for a in absent) + ". The absence is data too. 🪨"

        header = f"🌡️ {T:.0f}°C at {P:.1f} kbar | pH {pH:.1f}"
        return header + "\n\n" + table + abs_line

    def narrate_preamble(self, archetype: str) -> str:
        """Text-adventure preamble for a random vugg. Second-person, present
        tense, scene-setting. Called *before* the simulation runs so the
        reader enters the cavity as it is: bare walls, fluid at supersaturation,
        nothing yet crystallized. Ends with a chemistry stats table and a
        callout of marquee elements that are absent.
        """
        fluid = self.conditions.fluid
        T, P, pH = self.conditions.temperature, self.conditions.pressure, fluid.pH
        depth_km = max(P * 1.0, 0.1)  # rough: 1 kbar ≈ 1 km crustal overburden

        def have(elem, thresh=0.5):
            return (getattr(fluid, elem, 0) or 0) > thresh

        def ppm(elem):
            return getattr(fluid, elem, 0) or 0

        paragraphs = []

        if archetype == "pegmatite":
            paragraphs.append(
                f"You stand at the mouth of a cavity in cooling granite, deep underground. "
                f"The rock around you bears the weight of {depth_km:.1f} kilometers of crust. "
                f"The air here isn't air — it's supercritical fluid, {T:.0f} degrees, thick with dissolved metal."
            )
            dom_line = []
            if have('Fe', 10):
                dom_line.append(f"The walls gleam wet. Not with water — with iron-rich brine, {ppm('Fe'):.0f} parts per million, the color of old blood if you could see it through the heat shimmer.")
            if have('Cu', 5) and have('U', 10):
                dom_line.append(f"Copper threads through it at {ppm('Cu'):.0f} ppm, and uranium glows invisibly at {ppm('U'):.0f}.")
            elif have('U', 10):
                dom_line.append(f"Uranium glows invisibly at {ppm('U'):.0f} ppm — the cavity is faintly radioactive even before anything precipitates.")
            elif have('Cu', 5):
                dom_line.append(f"Copper threads through it at {ppm('Cu'):.0f} ppm, a warm-blooded metal in a hotter fluid.")
            dom_line.append("The rock itself is warm to the touch. Hot, actually. Everything is hot.")
            paragraphs.append(" ".join(dom_line))
            paragraphs.append(
                "This pocket formed when the granite cracked as it cooled. Magma doesn't shrink quietly — "
                "it fractures, and the last gasp of mineral-rich fluid fills every void. That's where you are now: "
                "inside that last gasp."
            )
            rare = []
            if have('Li', 5): rare.append(f"lithium at {ppm('Li'):.0f} ppm")
            if have('Be', 3): rare.append(f"beryllium at {ppm('Be'):.0f}")
            if have('B',  5): rare.append(f"boron at {ppm('B'):.0f}")
            if have('P',  2): rare.append(f"phosphorus at {ppm('P'):.0f}")
            if rare:
                paragraphs.append(
                    "The broth carries the signature of a rare-element pegmatite: "
                    + ", ".join(rare) + ". These elements ride the same fluid path and rarely end up here by accident."
                )
            paragraphs.append(
                "Nothing has crystallized yet. The walls are bare granite, still dissolving at their margins, "
                "feeding K and Al and SiO₂ back into the mix. The fluid is oversaturated with possibility but "
                "nothing has tipped over the edge."
            )
            paragraphs.append(
                "The temperature is falling. Slowly, imperceptibly, but falling. And when it crosses the right "
                "threshold — when supersaturation finally exceeds nucleation energy — the first crystal will spark "
                "into existence on these bare walls."
            )

        elif archetype == "hydrothermal":
            paragraphs.append(
                f"You stand inside a vein cavity split open in foliated country rock, roughly {depth_km:.1f} kilometers "
                f"below daylight. The walls are dark — slate and quartzite shot through with older, gray-white quartz "
                f"ribbons from earlier fluid pulses. The fluid filling this space is {T:.0f} degrees; hot enough to "
                f"sting, not quite to scald."
            )
            metal = []
            if have('Fe', 5): metal.append(f"Iron rides at {ppm('Fe'):.0f} ppm")
            if have('Mn', 2): metal.append(f"manganese at {ppm('Mn'):.0f}")
            if have('Zn', 5): metal.append(f"zinc at {ppm('Zn'):.0f}")
            if have('Cu', 5): metal.append(f"copper at {ppm('Cu'):.0f}")
            if have('Pb', 5): metal.append(f"lead at {ppm('Pb'):.0f}")
            if metal:
                paragraphs.append(
                    ", ".join(metal)
                    + f". Silica saturates the fluid at roughly {ppm('SiO2'):.0f} ppm — enough that a degree of cooling "
                      "will start to crack out quartz."
                )
            paragraphs.append(
                "This cavity opened when tectonic stress bent the host rock and a fracture propagated through. "
                "Fluid rose from deeper still, following the path of least resistance, and this particular pocket is "
                "where the flow eddied long enough to begin depositing. You're standing in a pause in the plumbing."
            )
            paragraphs.append(
                "The walls are not idle. Hot fluid at pH "
                f"{pH:.1f} is slowly stripping Ca and CO₃ from carbonate seams in the country rock and feeding them "
                "into the broth. The vug is eating its way larger, one millimeter per millennium."
            )
            paragraphs.append(
                "Somewhere upstream, the heat source is dying. This fluid has a finite window. When the broth cools "
                "below quartz's solubility curve, or pH climbs past calcite's, the cavity will begin to fill."
            )

        elif archetype == "supergene":
            paragraphs.append(
                f"You stand inside a cavity maybe ten meters below the ground surface, in the oxidized zone above the "
                f"water table. The air is cool — {T:.0f} degrees, barely warmer than the bedrock. Oxygen-rich rainwater "
                f"has been percolating through for a long time, finding its way down through soil and fractures."
            )
            paragraphs.append(
                "The walls are stained. Rust-orange where iron oxidized, patchy green where copper lingered, "
                "dark where sulfides are still rotting quietly. Everything here has already been something else — the "
                "primary ore that made this zone interesting is being rewritten. "
                f"The fluid carries those rewrites in solution: Zn {ppm('Zn'):.0f}, Pb {ppm('Pb'):.0f}, "
                f"Cu {ppm('Cu'):.0f}, O₂ {fluid.O2:.1f}."
            )
            paragraphs.append(
                "This cavity is a negative-space museum. Oxygen-bearing groundwater attacked the softest parts of the "
                "primary ore, and the walls retreated. What remains is the argument that the ore is making with the "
                "atmosphere."
            )
            secondary = []
            if have('As', 3): secondary.append(f"arsenic at {ppm('As'):.0f} ppm (from arsenopyrite dying somewhere upslope)")
            if have('Mo', 2): secondary.append(f"molybdenum at {ppm('Mo'):.0f} (galena + molybdenite both oxidizing — wulfenite weather)")
            if have('Cl', 5): secondary.append(f"chloride at {ppm('Cl'):.0f} (rain carrying salt air, or an evaporite signature)")
            if secondary:
                paragraphs.append("Trace hints: " + "; ".join(secondary) + ".")
            paragraphs.append(
                "The fluid does not have to cool to precipitate here. It only has to change: shift its pH, lose its "
                "dissolved oxygen, or meet a fresh surface that will let secondary minerals nucleate. Any of those "
                "triggers will do."
            )

        elif archetype == "mvt":
            paragraphs.append(
                f"You stand inside a limestone dissolution cavity — karst, the geologist's word for rock with holes. "
                f"The air is dark and faintly briny. {T:.0f} degrees. The walls are pale Paleozoic limestone, still "
                f"retreating wherever the brine touches them."
            )
            paragraphs.append(
                f"The fluid here is a dense saline brine, roughly {fluid.salinity:.0f}% NaCl, mineralized with base metals. "
                f"Zinc at {ppm('Zn'):.0f} ppm, lead at {ppm('Pb'):.0f}, sulfur at {ppm('S'):.0f} — which in this "
                f"environment means H₂S, the smell of rotten eggs if the brine weren't in the way."
            )
            paragraphs.append(
                "This cavity was dissolved into limestone by an earlier, lower-pH brine. Then a second fluid arrived — "
                "the one you're standing in — bearing metals from a basin possibly hundreds of kilometers away. Two "
                "fluids met; this cavity is where they're still mixing."
            )
            mvt_hints = []
            if have('F', 10): mvt_hints.append(f"fluorite is already saturating ({ppm('F'):.0f} ppm F)")
            if have('Ba', 10): mvt_hints.append(f"barium at {ppm('Ba'):.0f} ppm is a barite near-miss")
            if have('Ag', 1):  mvt_hints.append(f"silver at {ppm('Ag'):.0f} hints at argentiferous galena to come")
            if mvt_hints:
                paragraphs.append("; ".join(h[0].upper() + h[1:] for h in mvt_hints) + ".")
            paragraphs.append(
                "The limestone doesn't fight back. It dissolves peacefully, releasing Ca²⁺ and CO₃²⁻ into the broth. "
                "The vug grows slowly larger, and every Ca²⁺ released is a future growth band waiting to happen."
            )

        elif archetype == "porphyry":
            paragraphs.append(
                f"You stand inside a vug at the top of an intrusive porphyry stock — a shallow magma body that "
                f"crystallized into a cupola of ore-bearing granite. Two kilometers of rock above you, daylight; "
                f"immediately below, the still-magma continues to exhale metal-laden fluid. {T:.0f} degrees here, "
                f"{P:.2f} kbar, on the borderline between supercritical and boiling."
            )
            paragraphs.append(
                f"The fluid is metal-rich soup. Copper at {ppm('Cu'):.0f} ppm, iron at {ppm('Fe'):.0f}, sulfur at "
                f"{ppm('S'):.0f}. The walls weep with it. Everything looks brassy and wet, and the whole pocket smells "
                f"metallic even through the hiss of pressure."
            )
            paragraphs.append(
                "This pocket is one of many. Porphyry systems are lacework: fractures, veins, stockwork cavities all "
                "feeding off the same cooling intrusion. Each vug is a local eddy where the flow paused long enough to "
                "deposit. You're in one of those eddies."
            )
            porp_hints = []
            if have('Mo', 5): porp_hints.append(f"Molybdenum at {ppm('Mo'):.0f} ppm — the Mo pulse has already arrived; molybdenite is likely")
            if have('Au', 0.1): porp_hints.append(f"gold at {ppm('Au'):.1f} (invisible in pyrite, traditionally)")
            if have('W', 0.3): porp_hints.append(f"tungsten at {ppm('W'):.1f} (scheelite-adjacent)")
            if have('Bi', 0.3): porp_hints.append(f"bismuth at {ppm('Bi'):.1f}")
            if porp_hints:
                paragraphs.append(". ".join(p[0].upper() + p[1:] for p in porp_hints) + ".")
            paragraphs.append(
                "The walls are quartz-feldspar porphyry, potassically altered — the intrusion has already stained them "
                "pink with K-feldspar metasomatism. That alteration is older than the fluid you're standing in."
            )
            paragraphs.append(
                "The first sulfides will form within a few degrees of cooling. Pyrite nucleates fastest, then "
                "chalcopyrite settles onto it, then — if the late Mo pulse keeps delivering — molybdenite platelets."
            )

        elif archetype == "evaporite":
            paragraphs.append(
                f"You stand inside a crust that hasn't been buried deep. Barely below the surface. {T:.0f} degrees — "
                f"the sun warmed the ground this morning; by night it will cool again. The air is dry and still."
            )
            paragraphs.append(
                f"The fluid is a brine so concentrated it feels like syrup. Calcium at {ppm('Ca'):.0f} ppm, sulfate "
                f"(as S) at {ppm('S'):.0f}, with a pH of {pH:.1f} — the chemistry of drying out. The walls are pale "
                f"Ca-SO₄ with streaks of iron where earlier water rusted through."
            )
            paragraphs.append(
                "A shallow pond sat here once. Inflow slowed, or stopped; evaporation didn't. The water retreated, "
                "concentrating its dissolved ions, until the first crystals formed on the sediment surface and the "
                "whole thing went from pond to crust. You're inside the crust."
            )
            evap_hints = []
            if have('Mg', 20): evap_hints.append(f"magnesium at {ppm('Mg'):.0f} ppm hints at dolomite-adjacent chemistry, or epsomite if the brine dries further")
            if have('Sr', 10): evap_hints.append(f"strontium at {ppm('Sr'):.0f} is a celestine near-miss — the missing SrSO₄ is the ghost sulfate")
            if have('Cl', 15): evap_hints.append(f"chloride at {ppm('Cl'):.0f} is halite-adjacent; one more round of drying and NaCl will crust out alongside the gypsum")
            if evap_hints:
                paragraphs.append(". ".join(h[0].upper() + h[1:] for h in evap_hints) + ".")
            paragraphs.append(
                "There are no walls to dissolve here. The cavity IS the fluid, and the fluid is shrinking. The only "
                "question is how slowly it shrinks, and whether the temperature holds below 60°C long enough for "
                "selenite to finish what anhydrite might otherwise interrupt."
            )

        else:  # mixed
            paragraphs.append(
                f"You stand inside a pocket that has seen two fluids. The older one left behind mineral coatings on "
                f"the walls — dull sulfides, margins slightly oxidized. The new fluid is different: cooler, more "
                f"oxidizing. {T:.0f} degrees, and the mix is unsettled."
            )
            paragraphs.append(
                f"Metal is in solution: {ppm('Zn'):.0f} ppm Zn, {ppm('Pb'):.0f} ppm Pb, {ppm('Fe'):.0f} ppm Fe. "
                f"O₂ is {fluid.O2:.1f} — enough to attack the old sulfide coatings where it touches them."
            )
            paragraphs.append(
                "This is an overprint. A pocket that once equilibrated with reducing brine is being re-visited by "
                "something newer. Two timescales meet here: the older paragenesis frozen in the walls, and the new "
                "one about to begin on top of it."
            )
            paragraphs.append(
                "The walls are dissolving where the new fluid is undersaturated, and re-precipitating where it's "
                "saturated. You can watch both processes happen at once, on different parts of the same crystal — if "
                "you have patience measured in centuries."
            )
            paragraphs.append(
                "What grows next will tell you which fluid won. Secondary minerals on primary — that's the signature "
                "of overprint. The vug is writing its second chapter."
            )

        # Append chemistry stats block
        return "\n\n".join(paragraphs) + "\n\n" + self._render_fluid_table()

    def _narrate_discovery(self, archetype: str) -> str:
        """Procedural discovery flavor for the random scenario.

        Reads the resulting assemblage + archetype + trace-element fluid
        and assembles a collector's-tag paragraph: where it probably came
        from, what the dominant paragenesis is, what trace elements hint
        at even if no mineral consumed them, and which classic locality
        the assemblage recalls.
        """
        from collections import Counter
        by_mineral = Counter(c.mineral for c in self.crystals if c.total_growth_um > 0)
        if not by_mineral:
            return ("*Discovery tag —* The cavity was opened, and nothing had grown. "
                    "Sometimes that is the whole story: a chamber where the fluid "
                    "arrived, lingered, and left without leaving a signature.")

        fluid = self.conditions.fluid

        setting = {
            "hydrothermal": "a fracture-fed solution cavity in altered country rock",
            "pegmatite":    "the cooled core of a granite pegmatite pocket",
            "supergene":    "a shallow oxidation-zone pocket just below the water table",
            "mvt":          "a karst dissolution cavity in Paleozoic limestone",
            "porphyry":     "a late-stage vug in a porphyry copper stockwork",
            "evaporite":    "a desiccated Ca-SO₄ crust near an ancient playa margin",
            "mixed":        "an overprinted pocket with two generations of fluid",
        }.get(archetype, "an unnamed cavity")

        # Sort minerals by biggest crystal for each
        mineral_sizes = {}
        for c in self.crystals:
            s = c.c_length_mm
            if s > mineral_sizes.get(c.mineral, 0):
                mineral_sizes[c.mineral] = s
        by_size = sorted(mineral_sizes.items(), key=lambda kv: -kv[1])

        parts = [f"*Discovery tag —* This specimen was recovered from {setting}."]

        # Primary + subordinates
        if by_size:
            primary, psize = by_size[0]
            if len(by_size) == 1:
                parts.append(f"The pocket is a single-mineral chamber: {primary} reached {psize:.1f} mm and claimed the whole vug.")
            else:
                subs = ", ".join(f"{m}" for m, _ in by_size[1:4])
                parts.append(f"The dominant mineral is {primary} ({psize:.1f} mm), with subordinate {subs}.")

        assemblage = set(by_mineral)

        # Paragenetic call-outs
        if "goethite" in assemblage and any(c.mineral == "goethite" and "pseudomorph" in c.position for c in self.crystals):
            parts.append("Goethite boxwork pseudomorphs after pyrite record a weathering front that moved through the vug long after the primary sulfides formed.")
        if "wulfenite" in assemblage:
            parts.append("The wulfenite is the prize — bright tablets that only formed because both galena and molybdenite oxidized together (Seo et al. 2012).")
        if {"malachite", "chalcopyrite"} <= assemblage:
            parts.append("A malachite-after-chalcopyrite pathway is evident: the copper walked out of the sulfide and met carbonate on its way to the wall.")
        if "uraninite" in assemblage and "quartz" in assemblage:
            parts.append("The quartz near the uraninite carries alpha-damage; if this specimen sat in its cradle long enough, the clear crystals darkened into smoky.")
        if "selenite" in assemblage and archetype == "evaporite":
            parts.append("The selenite blades are the clock: they grew slowly at a steady sub-60°C, the Naica chemistry in miniature.")
        if "adamite" in assemblage and "mimetite" in assemblage:
            parts.append("Adamite and mimetite together place this pocket near an arsenopyrite weathering body — Zn and Pb fighting over the same arsenate.")

        # Trace-element hints — lets untapped fields speak
        trace_lines = []
        if getattr(fluid, "Ba", 0) > 15:
            trace_lines.append("The fluid carried enough Ba that barite was a near miss — look in the matrix for the missing sulfate")
        if getattr(fluid, "Sr", 0) > 15:
            trace_lines.append("Strontium above typical MVT values suggests a celestine-bearing parent brine somewhere upstream")
        if getattr(fluid, "Li", 0) > 20 or getattr(fluid, "B", 0) > 20 or getattr(fluid, "Be", 0) > 15:
            trace_lines.append("Trace Li/B/Be hints that the pegmatite parent fluid ran toward the rare-element side of the LCT family")
        if getattr(fluid, "Au", 0) > 0.5:
            trace_lines.append("Invisible gold in the pyrite is likely — the fluid ran Au-enriched even if no native gold crystallized here")
        if getattr(fluid, "Ag", 0) > 3:
            trace_lines.append("The galena is argentiferous; thin-section microprobe traces would light up with silver")
        if getattr(fluid, "Cr", 0) > 3:
            trace_lines.append("Chromium in the fluid would have shifted wulfenite toward the classic blood-orange Red Cloud hue")
        if getattr(fluid, "Co", 0) > 1:
            trace_lines.append("Cobalt traces would pink up any smithsonite that grew here")
        if getattr(fluid, "Mg", 0) > 30 and archetype == "evaporite":
            trace_lines.append("High Mg suggests dolomite-adjacent chemistry; epsomite could bloom if the crust evaporated a bit further")

        if trace_lines:
            parts.append(trace_lines[0] + ".")
            if len(trace_lines) > 1:
                parts.append("Secondary traces: " + "; ".join(trace_lines[1:3]) + ".")

        # Locality hint
        locality = None
        if {"adamite", "goethite"} <= assemblage or ({"mimetite", "goethite"} <= assemblage):
            locality = "Ojuela Mine at Mapimí, Durango — the classic oxidation-zone type locality"
        elif "wulfenite" in assemblage and "hematite" in assemblage:
            locality = "Los Lamentos or Red Cloud Mine — the wulfenite capitals"
        elif {"sphalerite", "galena", "fluorite"} <= assemblage:
            locality = "Cave-in-Rock, Illinois — MVT paragenesis at its textbook best"
        elif {"chalcopyrite", "pyrite", "quartz"} <= assemblage and archetype == "porphyry":
            locality = "Bingham Canyon or Butte — porphyry copper's ground truth"
        elif "uraninite" in assemblage and "feldspar" in assemblage:
            locality = "the Bancroft district, Ontario — uraninite-bearing pegmatites"
        elif {"calcite", "sphalerite", "galena"} <= assemblage:
            locality = "the Tri-State district (Joplin, MO)"
        if locality:
            parts.append(f"The assemblage recalls {locality}.")

        # Closing
        closing_options = [
            "What the rock held, the rock now reveals.",
            "The fluid is long gone; only the crystals remember.",
            "Every face was drawn in slow ink, one layer at a time.",
            "This is what the dark grew when no one was watching.",
            "The cavity is a museum and a letter.",
        ]
        parts.append(random.choice(closing_options))

        return " ".join(parts)
    
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

        # Alpha-damage history from nearby uraninite.
        rad_zones = [z for z in c.zones if z.radiation_damage > 0]
        if rad_zones:
            avg_rad = sum(z.radiation_damage for z in c.zones) / len(c.zones)
            avg_Al = sum(z.trace_Al for z in c.zones) / len(c.zones)
            avg_Fe = sum(z.trace_Fe for z in c.zones) / len(c.zones)
            dosed_fraction = len(rad_zones) / len(c.zones)
            if avg_rad > 0.6 and avg_Al > 0.3:
                parts.append(
                    f"Sustained α-bombardment from a uraninite neighbor darkened the "
                    f"lattice to dark smoky — morion in the deepest zones. {len(rad_zones)} "
                    f"of {len(c.zones)} growth zones record the irradiation."
                )
            elif avg_rad > 0.3 and avg_Al > 0.3:
                parts.append(
                    f"Alpha-damage from nearby uraninite activated Al-hole color centers "
                    f"in {dosed_fraction*100:.0f}% of the growth zones — this crystal reads "
                    f"as smoky quartz."
                )
            elif avg_rad > 0.3 and avg_Fe > 3.0:
                parts.append(
                    f"Radiation from adjacent uraninite activated Fe³⁺ color centers — "
                    f"the crystal carries an amethyst tint where dose overlapped Fe-rich zones."
                )
            elif avg_rad > 0.1:
                parts.append(
                    f"A modest α-dose ({avg_rad:.2f}) crossed the growth history — the "
                    f"crystal carries a faint smoky tint in the irradiated zones."
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

    def _narrate_wurtzite(self, c: Crystal) -> str:
        """Narrate a wurtzite crystal's story — the high-T hexagonal ZnS dimorph."""
        parts = [f"Wurtzite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "hemimorphic_crystal":
            parts.append(
                "Hemimorphic hexagonal pyramid — one end pointed, the other flat. "
                "The P6₃mc space group has no inversion center, so the c-axis is "
                "polar and the two terminations are crystallographically distinct. "
                "This is the diagnostic wurtzite shape, absent from cubic sphalerite."
            )
        elif c.habit == "radiating_columnar":
            parts.append(
                "Radiating hexagonal columns forming stellate clusters — a classic "
                "high-supersaturation wurtzite texture. Hot metal-rich fluids eating "
                "into an acid-etched fracture."
            )
        elif c.habit == "fibrous_coating":
            parts.append(
                "Fibrous crust on the wall — fast growth along {0001} producing "
                "parallel columnar fibers. Wurtzite's polarity lets each fiber "
                "terminate differently at base vs. tip."
            )
        else:
            parts.append(
                "Tabular {0001} plates with a slight micaceous layering — slow-growth "
                "wurtzite aggregates that sometimes get mistaken for molybdenite until "
                "the color and chemistry rule it out."
            )

        if c.zones:
            fe_vals = [z.trace_Fe for z in c.zones if z.trace_Fe > 0]
            if fe_vals:
                max_fe_pct = max(fe_vals) / 10.0  # reverse the *10 ppm scaling
                if max_fe_pct > 10:
                    parts.append(
                        f"Fe content up to {max_fe_pct:.0f} mol% — wurtzite happily "
                        f"hosts iron, like its cubic cousin, darkening toward black."
                    )

        if c.twinned:
            parts.append(
                f"Shows the {c.twin_law} twin — less common than sphalerite's spinel "
                f"twinning because the hexagonal space group forbids the {{111}} operation."
            )

        if c.dissolved:
            parts.append(
                "Polymorphic inversion destroyed the crystal — cooling below 95°C "
                "pushed (Zn,Fe)S into the cubic sphalerite field. Over geologic time "
                "wurtzite usually converts down to sphalerite; sphalerite rarely goes back."
            )
        else:
            parts.append(
                "As long as the fluid stays above 95°C, the crystal is stable in "
                "the wurtzite structure; cooling through that threshold would trigger "
                "conversion to sphalerite."
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

    def _narrate_marcasite(self, c: Crystal) -> str:
        """Narrate a marcasite crystal's story — the acid-loving iron sulfide."""
        parts = [f"Marcasite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "cockscomb":
            parts.append(
                "The crystal developed the classic cockscomb habit — aggregated tabular "
                "plates on {010}, edges ridged like a rooster's comb. This shape is the "
                "diagnostic fingerprint: pyrite never crests like this."
            )
        elif c.habit == "spearhead":
            parts.append(
                "Spearhead twins — paired tabular crystals tapered to pyramidal tips. "
                "The {101} twin law produces a swallowtail shape unique to marcasite."
            )
        elif c.habit == "radiating_blade":
            parts.append(
                "Radiating blades sprayed outward from a common center — low-temperature, "
                "high-supersaturation growth in acid fluids, the same style that gives "
                "sedimentary marcasite nodules their stellate fracture patterns."
            )
        else:
            parts.append(
                "Flat tabular {010} plates — the slow-growth marcasite form, pale brass "
                "already starting to iridesce as surface sulfur oxidizes."
            )

        if c.twinned:
            parts.append(
                f"Shows the {c.twin_law} swallowtail twin, diagnostic of marcasite "
                f"and absent from its cubic cousin pyrite."
            )

        if c.dissolved:
            parts.append(
                "Metastable inversion or oxidative breakdown destroyed the crystal — "
                "marcasite is the unstable FeS₂ dimorph. Over geologic time it converts "
                "to pyrite; on museum shelves it rots to sulfuric acid and iron sulfate."
            )
        else:
            parts.append(
                "The pH/T regime kept it in the orthorhombic field; given geologic time "
                "or a temperature excursion above 240°C, this crystal would invert to pyrite."
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

    def _narrate_goethite(self, c: Crystal) -> str:
        """Narrate a goethite crystal's story — the ghost mineral, now real."""
        parts = [f"Goethite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if "pseudomorph after pyrite" in c.position:
            parts.append(
                "It replaced pyrite atom-for-atom — the classic boxwork pseudomorph. "
                "What looks like a rusty pyrite cube is actually goethite that has "
                "inherited the sulfide's habit while the Fe-S lattice was dissolved "
                "and Fe-O-OH precipitated in its place. These are the Egyptian "
                "Prophecy Stones' cousin — the rusty ghost of a crystal that was."
            )
        elif "pseudomorph after chalcopyrite" in c.position:
            parts.append(
                "Chalcopyrite oxidized and goethite took its place — a copper sulfide's "
                "iron heir. The copper went to malachite; the iron stayed here."
            )
        elif "hematite" in c.position:
            parts.append(
                "Nucleated on hematite — the hydrated/anhydrous iron oxide pair coexist "
                "in oxidation zones, separated only by how much water the fluid carried."
            )

        if c.habit == "botryoidal/stalactitic":
            parts.append(
                "Built up into stalactitic, botryoidal masses — the velvety black "
                "surfaces that collectors call 'black goethite.' Each layer a separate "
                "pulse of Fe-saturated water, together the signature of persistent "
                "slow oxidation."
            )
        elif c.habit == "fibrous_acicular":
            parts.append(
                "Radiating needle habit — the fibrous goethite that grows as "
                "velvet crusts on cavity walls when Fe³⁺-rich fluid seeps slowly."
            )

        if c.dissolved:
            parts.append(
                "Acid attack released Fe³⁺ back to the fluid. Goethite survives "
                "oxidation but not strong acid — the rusty armor has a pH floor."
            )

        return " ".join(parts)

    def _narrate_uraninite(self, c: Crystal) -> str:
        """Narrate a uraninite crystal's story — the radioactive heart of the vug."""
        parts = [f"Uraninite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm ☢️."]

        parts.append(
            "UO₂ — pitch-black, submetallic, one of Earth's densest oxides. It "
            "formed under strongly reducing conditions: any oxygen would have "
            "converted it to yellow secondary uranium minerals. While it grew, "
            "it emitted alpha particles into the surrounding crystal lattice, "
            "radiation-damaging any nearby quartz toward smoky coloration."
        )

        if c.nucleation_temp > 400:
            parts.append(
                "Nucleated at high temperature — a pegmatite-scale uraninite, "
                "possibly with Th substituting for U and radiogenic Pb already "
                "accumulating in the crystal structure."
            )
        else:
            parts.append(
                "Low-T uraninite — the sedimentary / roll-front style, precipitated "
                "where reducing organic matter met U-bearing groundwater."
            )

        if c.dissolved:
            parts.append(
                "Partial dissolution as O₂ invaded the system — uranium went back "
                "into solution as uranyl (UO₂²⁺) and may re-precipitate as autunite "
                "or torbernite elsewhere."
            )

        return " ".join(parts)

    def _narrate_galena(self, c: Crystal) -> str:
        """Narrate a galena crystal's story — the heavy one."""
        parts = [f"Galena #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "PbS — the densest common sulfide (SG 7.6), perfect cubic cleavage, "
            "bright lead-gray metallic luster. Pick up a piece and it's "
            "surprisingly heavy; tap it and it cleaves into perfect little cubes."
        )

        if c.twinned:
            parts.append(
                f"Twinned on the {c.twin_law} — spinel-law twins create striking "
                f"interpenetrating cubes in galena, rare but diagnostic."
            )

        avg_Ag = sum(getattr(z, "trace_Ag", 0.0) for z in c.zones) / max(len(c.zones), 1)
        if avg_Ag > 0 or any("Ag inclusions" in z.note for z in c.zones):
            parts.append(
                "The fluid carried silver — argentiferous galena, the historic "
                "source of most of the world's silver (Potosí, Leadville, Broken Hill)."
            )

        if c.dissolved:
            parts.append(
                "Oxidation attacked the galena — Pb²⁺ went into solution and can "
                "reprecipitate as cerussite (PbCO₃), anglesite (PbSO₄), or — if "
                "Mo is present — wulfenite (PbMoO₄)."
            )

        return " ".join(parts)

    def _narrate_molybdenite(self, c: Crystal) -> str:
        """Narrate a molybdenite crystal's story — the wulfenite precursor."""
        parts = [f"Molybdenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "MoS₂ — soft hexagonal platy crystals, bluish-gray metallic, "
            "greasy to the touch. Softest metallic mineral on Mohs (1–1.5); "
            "leaves a mark on paper like graphite."
        )

        if 300 <= c.nucleation_temp <= 500:
            parts.append(
                "Nucleated in the porphyry sweet spot — Mo arrived in a separate "
                "pulse from Cu (Seo et al. 2012, Bingham Canyon), a late magmatic "
                "fluid delivering molybdenum on its own timeline."
            )

        if c.dissolved:
            parts.append(
                "Oxidation dissolved the molybdenite, releasing MoO₄²⁻ into solution. "
                "If Pb is also present in the oxidation zone, the combination "
                "becomes wulfenite — the sunset mineral."
            )

        return " ".join(parts)

    def _narrate_smithsonite(self, c: Crystal) -> str:
        """Narrate a smithsonite crystal's story — sphalerite's carbonate heir."""
        parts = [f"Smithsonite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "ZnCO₃ — the supergene zinc carbonate, the oxidation product of "
            "sphalerite. Named for James Smithson, who left his fortune to "
            "found the Smithsonian."
        )

        if "sphalerite" in c.position:
            parts.append(
                "It grew directly on dissolving sphalerite — the classic "
                "oxidation-zone replacement. Zn²⁺ from the sulfide met CO₃²⁻ "
                "from percolating carbonated water."
            )

        if "botryoidal" in c.habit:
            parts.append(
                "Built up in grape-like botryoidal masses — the habit that makes "
                "smithsonite a collector's mineral. Turquoise-blue (Cu-bearing) "
                "or apple-green varieties are the most prized."
            )

        if c.dissolved:
            parts.append(
                "Acid attack dissolved smithsonite — like calcite, it fizzes "
                "as a carbonate and releases Zn²⁺ back to the fluid."
            )

        return " ".join(parts)

    def _narrate_wulfenite(self, c: Crystal) -> str:
        """Narrate a wulfenite crystal's story — the sunset caught in stone."""
        parts = [f"Wulfenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "PbMoO₄ — thin tabular plates, square outline, orange to honey-yellow. "
            "Bright vitreous luster, adamantine in the best crystals. The mineral "
            "that requires BOTH galena AND molybdenite to have oxidized in the "
            "same vug (Seo et al. 2012) — a paragenesis puzzle."
        )

        if c.twinned:
            parts.append(
                f"Twinned on {c.twin_law} — penetration twins in wulfenite "
                "create stacked or cross-shaped tablets."
            )

        if c.dissolved:
            parts.append(
                "Acid dissolution — wulfenite's pH window is narrow (dissolves "
                "below 3.5 and above 9), and a late acid pulse closed the door."
            )

        return " ".join(parts)

    def _narrate_selenite(self, c: Crystal) -> str:
        """Narrate a selenite crystal's story — the cool-water cathedral blade."""
        parts = [f"Selenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "CaSO₄·2H₂O — the dihydrate form of gypsum, water-clear, glassy. "
            "Selenite grows only below ~60°C; above that, anhydrite wins. "
            "This is the crystal of Naica, where 58°C brine held steady for "
            "half a million years and produced the largest natural crystals "
            "on Earth."
        )

        if c.habit == "cathedral_blade":
            parts.append(
                "Built up into a cathedral blade — the Naica habit. Sustained "
                "supersaturation at a metastable temperature just below the "
                "anhydrite transition, uninterrupted for millennia."
            )

        if c.twinned and "swallowtail" in c.twin_law:
            parts.append(
                "Swallowtail twin — the diagnostic growth twin of selenite, "
                "two crystals joined at the base with tails flaring outward."
            )

        if c.dissolved:
            parts.append(
                "Acid or warmer water attacked the selenite — gypsum is one of "
                "the more soluble common minerals, surviving only where water "
                "is scarce or chemistry is right."
            )

        return " ".join(parts)

    def _narrate_adamite(self, c: Crystal) -> str:
        """Narrate an adamite crystal's story — the fluorescent zinc arsenate."""
        parts = [f"Adamite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        avg_Cu = sum(getattr(z, "trace_Cu", 0.0) for z in c.zones) / max(len(c.zones), 1)
        if avg_Cu > 0.5 or "cuproadamite" in " ".join(z.note for z in c.zones):
            parts.append(
                "Copper incorporated as trace — cuproadamite, the bright green "
                "fluorescent variety. Under short-wave UV it glows apple-green."
            )
        else:
            parts.append(
                "Yellow-green adamite — the classic habit of Ojuela Mine, Mexico. "
                "Under short-wave UV the low-Cu zones fluoresce intensely; "
                "heavy Cu zones stay dark."
            )

        if "goethite" in c.position:
            parts.append(
                "Nucleated on goethite — the limonite/adamite pairing that every "
                "Ojuela specimen carries."
            )

        if c.dissolved:
            parts.append(
                "Acid dissolved the adamite — released Zn²⁺ and arsenate back "
                "to the fluid, potentially feeding later mimetite or olivenite growth."
            )

        return " ".join(parts)

    def _narrate_mimetite(self, c: Crystal) -> str:
        """Narrate a mimetite crystal's story — the mimic of pyromorphite."""
        parts = [f"Mimetite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "Pb₅(AsO₄)₃Cl — a lead arsenate chloride, named 'mimic' because it "
            "looks so similar to pyromorphite (Pb phosphate). Hexagonal prisms, "
            "yellow to orange; the barrel-shaped campylite variety is a Cumbrian "
            "classic."
        )

        if "galena" in c.position:
            parts.append(
                "It nucleated directly on galena — the classic paragenesis. "
                "Oxidizing arsenic-bearing groundwater attacked the lead sulfide, "
                "and the released Pb²⁺ combined with arsenate + chloride."
            )

        if c.dissolved:
            parts.append(
                "Acid dissolution released Pb²⁺ and arsenate back to the fluid — "
                "mimetite is stable only in a narrow oxidizing, near-neutral window."
            )

        return " ".join(parts)

    def _narrate_feldspar(self, c: Crystal) -> str:
        """Narrate a K-feldspar crystal's story — the polymorph clock."""
        parts = [f"K-feldspar #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        # Polymorph inference from nucleation T
        if c.nucleation_temp > 500:
            polymorph = "sanidine (high-T monoclinic)"
        elif c.nucleation_temp > 300:
            polymorph = "orthoclase (moderate-T monoclinic)"
        else:
            polymorph = "microcline (low-T triclinic, cross-hatched)"

        parts.append(
            f"It formed as {polymorph}. Temperature is feldspar's clock — the "
            f"polymorph you see records the thermal history of the fluid that "
            f"grew it."
        )

        amazonite = any("amazonite" in z.note for z in c.zones)
        if amazonite:
            parts.append(
                "Pb²⁺ substituted for K⁺ in trace amounts — amazonite, the "
                "blue-green K-feldspar colored by lead. Under LW UV the "
                "Pb-rich zones fluoresce yellow-green."
            )

        if c.twinned:
            parts.append(
                f"Twinned on the {c.twin_law} — a diagnostic twin of the "
                f"feldspar family."
            )

        if c.dissolved:
            parts.append(
                "Acid weathering attacked the feldspar — kaolinization released "
                "K⁺, Al³⁺, and SiO₂ into the fluid. The slow-motion breakdown "
                "that makes clay."
            )

        return " ".join(parts)

    def _narrate_albite(self, c: Crystal) -> str:
        """Narrate an albite crystal's story — the sodium end-member."""
        parts = [f"Albite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "NaAlSi₃O₈ — the sodium plagioclase end-member. At T < 450°C, albite "
            "orders to 'low-albite' (fully ordered Al/Si). Platy 'cleavelandite' "
            "habit is the pegmatite signature."
        )

        peristerite = any("peristerite" in z.note for z in c.zones)
        if peristerite:
            parts.append(
                "Ca²⁺ intergrowth produced peristerite — fine albite/oligoclase "
                "exsolution lamellae that scatter light into blue-white "
                "adularescence. The moonstone shimmer."
            )

        if c.twinned:
            parts.append(
                f"Twinned on the {c.twin_law} — polysynthetic albite twinning "
                "creates the characteristic striped appearance of plagioclase "
                "in thin section."
            )

        if c.dissolved:
            parts.append(
                "Acid released Na⁺, Al³⁺, and SiO₂ — albite is slightly more "
                "resistant than K-feldspar but still weathers to kaolinite "
                "under persistent acid attack."
            )

        return " ".join(parts)

    def _narrate_topaz(self, c: Crystal) -> str:
        """Narrate a topaz crystal's story — the fluorine-bearing nesosilicate."""
        parts = [f"Topaz #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "Al₂SiO₄(F,OH)₂ — orthorhombic, prismatic with steep pyramidal "
            "terminations and perfect basal {001} cleavage. Fluorine sits in "
            "every other anion site of the structure; the crystal cannot "
            "nucleate until dissolved F crosses a saturation threshold. "
            "Ouro Preto imperial topaz crystallized at ~360°C, 3.5 kbar from "
            "metamorphic hydrothermal fluids (Morteani et al. 2002)."
        )

        imperial_pink = any("pink imperial" in z.note for z in c.zones)
        imperial_gold = any("imperial golden-orange" in z.note for z in c.zones)
        pale_blue = any("pale blue" in z.note for z in c.zones)
        pale_yellow = any("pale yellow" in z.note for z in c.zones)

        if imperial_pink:
            parts.append(
                "Pink imperial — the rarest topaz coloration. Cr³⁺ substituted "
                "for Al³⁺ in deep concentration, and the fluid's oxidation "
                "state tipped some chromium into the pink-producing Cr⁴⁺ state. "
                "A handful of specimens per year reach gem-grade at this depth."
            )
        elif imperial_gold:
            parts.append(
                "Imperial golden-orange — Cr³⁺ substituting for Al³⁺ in the "
                "topaz structure. The chromium came not from the main fluid "
                "but from nearby ultramafic country rock dissolving in trace. "
                "This is the signature of Ouro Preto / Capão do Lana — the "
                "only place on Earth where it's a commercial color."
            )
        elif pale_blue:
            parts.append(
                "Pale blue, F-rich and Cr-starved. In nature, this coloration "
                "is often enhanced by subsequent radiation exposure producing "
                "the sky-blue topaz flooded onto the market after Iapetos-age "
                "pegmatites started being deliberately irradiated."
            )
        elif pale_yellow:
            parts.append(
                "Pale yellow from Fe³⁺ in the Al site — the common 'imperial' "
                "knockoff. Without the Cr chromophore, this color is merely "
                "pretty, not legendary."
            )
        else:
            parts.append(
                "Colorless — the default for topaz grown in a Cr-poor, Fe-poor "
                "fluid. Gem-quality nonetheless; topaz is always hard (Mohs 8) "
                "and always transparent."
            )

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            geothermometer = any("geothermometer" in z.inclusion_type for z in inclusion_zones)
            if geothermometer:
                avg_T = sum(z.temperature for z in inclusion_zones) / len(inclusion_zones)
                parts.append(
                    f"{len(inclusion_zones)} fluid inclusion horizons preserved in "
                    f"the growth zones — primary 2-phase inclusions at "
                    f"~{avg_T:.0f}°C. Microthermometry would read them as "
                    "the thermometer that pinned Ouro Preto at 360°C."
                )
            else:
                parts.append(
                    f"{len(inclusion_zones)} fluid inclusion horizons preserved — "
                    "the topaz kept a record of every pulse of growth fluid."
                )

        avg_Ti = sum(z.trace_Ti for z in c.zones) / max(len(c.zones), 1)
        if avg_Ti > 0.05:
            parts.append(
                "Trace Ti hints at microscopic rutile needles — protogenetic "
                "inclusions formed before the topaz grew, then enveloped as "
                "the crystal advanced. Diagnostic for Ouro Preto topaz under "
                "Raman spectroscopy (Serrinha pegmatite, 2016)."
            )

        if c.phantom_count >= 1:
            parts.append(
                "Perfect basal {001} cleavage means partial dissolution along "
                "that plane can produce ghost surfaces inside the crystal. "
                f"{c.phantom_count} phantom boundary{'ies' if c.phantom_count > 1 else ''} "
                "preserved — the crystal's autobiography written in growth "
                "and regrowth."
            )

        if c.dissolved:
            parts.append(
                "Strong acid attack etched the surface — topaz is very "
                "resistant, but pH below 2 with long exposure releases Al³⁺, "
                "SiO₂, and F⁻ slowly back into the fluid."
            )

        return " ".join(parts)

    def _narrate_tourmaline(self, c: Crystal) -> str:
        """Narrate a tourmaline crystal — schorl→elbaite color diary."""
        parts = [f"Tourmaline #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "Complex cyclosilicate, trigonal — elongated prisms with deep "
            "vertical striations and a slightly rounded triangular "
            "cross-section {10̄10}. Each striation is a growth pulse. Color "
            "is a fluid composition snapshot: boron found a home, and which "
            "cations came with it wrote the hue."
        )

        # Identify what varieties appeared across the crystal's life by
        # scanning zone notes. A single crystal can span schorl→elbaite
        # zoning if Fe depleted and Li accumulated between zones — which
        # is exactly how Minas Gerais rubellite grows over schorl cores.
        zone_notes = [z.note or "" for z in c.zones]
        varieties = set()
        for n in zone_notes:
            if "schorl" in n: varieties.add("schorl")
            if "rubellite" in n: varieties.add("rubellite")
            if "verdelite" in n: varieties.add("verdelite")
            if "indicolite" in n: varieties.add("indicolite")
            if "Paraíba" in n or "paraiba" in n: varieties.add("paraiba")
            if "achroite" in n: varieties.add("achroite")

        if {"schorl"} < varieties:
            other = sorted(varieties - {"schorl"})
            parts.append(
                f"Color-zoned: started as schorl (Fe²⁺-dominant black core) "
                f"and transitioned to {', '.join(other)} as the pegmatite "
                f"fluid depleted iron and built up lithium. The crystal is a "
                f"diary of incompatible-element accumulation."
            )
        elif "paraiba" in varieties:
            parts.append(
                "Paraíba blue — the Cu²⁺-activated glow discovered in "
                "northeastern Brazil in 1989 and fetching tens of thousands "
                "of dollars per carat at auction. Copper is the rarest "
                "chromophore in tourmaline; this zone documents a fluid "
                "that briefly carried Cu²⁺ among its trace metals."
            )
        elif "rubellite" in varieties:
            parts.append(
                "Rubellite — Li-rich elbaite with Mn²⁺ giving pink color. "
                "The Jonas mine in Minas Gerais was perhaps the world's "
                "greatest rubellite producer. This composition marks the "
                "late pocket-growth phase, after iron had been scavenged by "
                "earlier schorl."
            )
        elif "verdelite" in varieties:
            parts.append(
                "Verdelite — green elbaite. Cr³⁺ or V³⁺ substitution into "
                "the Al site drives the color; both trace elements come "
                "from ultramafic country rock contact. Emerald's cousin by "
                "chromophore."
            )
        elif "indicolite" in varieties:
            parts.append(
                "Indicolite — blue elbaite. Fe²⁺→Ti⁴⁺ charge transfer "
                "produces the color, requiring both cations plus Li to have "
                "coexisted in the growth fluid. A tricky composition to "
                "hit, which is why good indicolite is collector-priced."
            )
        elif "schorl" in varieties:
            parts.append(
                "Schorl — the black Fe²⁺-dominant end-member that dominates "
                "the early phases of pegmatite crystallization. Opaque in "
                "thick section, dark green-black by transmitted light. The "
                "most common tourmaline species globally."
            )
        elif "achroite" in varieties:
            parts.append(
                "Achroite — colorless elbaite. All trace elements muted or "
                "absent; the pure lithium-aluminum end-member looking "
                "through. Rare in the field, beautiful under UV sometimes "
                "from structural defects."
            )

        parts.append(
            "The cross-section, if you sliced this crystal perpendicular to "
            "its c-axis, would read like a tree ring record — concentric "
            "zones of color marking each fluid event the vug witnessed."
        )

        return " ".join(parts)

    def _narrate_beryl(self, c: Crystal) -> str:
        """Narrate a beryl crystal — the incompatible-element crown jewel."""
        parts = [f"Beryl #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "Be₃Al₂Si₆O₁₈ — hexagonal cyclosilicate. Beryllium is the most "
            "incompatible common element in magmatic systems: no rock-forming "
            "mineral will take it, so Be accumulates in residual pegmatite "
            "fluid until beryl finally nucleates at high threshold. That's "
            "why beryl crystals can be enormous — by the time the first "
            "crystal fires, there's a lot of beryllium waiting."
        )

        # Identify variety/varieties present across zones
        zone_notes = [z.note or "" for z in c.zones]
        varieties = set()
        for n in zone_notes:
            if "emerald" in n: varieties.add("emerald")
            if "morganite" in n: varieties.add("morganite")
            if "heliodor" in n: varieties.add("heliodor")
            if "aquamarine" in n: varieties.add("aquamarine")
            if "goshenite" in n: varieties.add("goshenite")

        if "emerald" in varieties:
            parts.append(
                "Emerald — the chromium variety. The Cr³⁺ (or V³⁺) in this "
                "crystal came from ultramafic country rock dissolving in "
                "trace, meeting Be that could only come from the pegmatite "
                "fluid. Two different rock types had to intersect in space "
                "for this one crystal to form. That's the emerald paradox, "
                "and it's why emerald is the rarest major gemstone."
            )
        elif "morganite" in varieties:
            parts.append(
                "Morganite — the Mn²⁺ variety, pink to peach. Named for "
                "J.P. Morgan by George Kunz of Tiffany & Co., who named "
                "half the gem-grade pegmatite minerals after the men who "
                "could afford them. Minas Gerais produces the world's best."
            )
        elif "heliodor" in varieties and "aquamarine" in varieties:
            parts.append(
                "Color-zoned between heliodor (Fe³⁺, oxidizing) and "
                "aquamarine (Fe²⁺, reducing) — the crystal recorded a redox "
                "shift in the pocket fluid. Iron stayed in solution, but "
                "its oxidation state flipped partway through growth, and "
                "the color zoning captures that moment."
            )
        elif "heliodor" in varieties:
            parts.append(
                "Heliodor — the yellow Fe³⁺ variety. Oxidizing conditions "
                "during growth locked iron in the Fe³⁺ state rather than "
                "Fe²⁺. A late-stage pocket characteristic."
            )
        elif "aquamarine" in varieties:
            parts.append(
                "Aquamarine — the Fe²⁺ variety, sky blue. The pegmatite "
                "fluid stayed reducing throughout growth. Aquamarine is the "
                "classic Minas Gerais beryl — Governador Valadares and "
                "Araçuaí alone have produced more aquamarine than the rest "
                "of the world combined."
            )
        elif "goshenite" in varieties:
            parts.append(
                "Goshenite — pure colorless beryl. No chromophore found the "
                "crystal's Al site. Rare because trace elements are almost "
                "always present somewhere in the fluid; when the pocket "
                "stayed truly clean, goshenite is what grew."
            )

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(
                f"{len(inclusion_zones)} fluid inclusion horizons preserved "
                "at growth-zone boundaries — beryl is notorious for these, "
                "including the stepped 'growth tubes' that make aquamarine "
                "cat's-eyes possible."
            )

        parts.append(
            "If you sliced this beryl perpendicular to the c-axis, the "
            "growth rings would map the thermal history. Wider bands mark "
            "warmer, faster growth; tight bands mark slow cool periods."
        )

        if c.dissolved:
            parts.append(
                "HF-assisted dissolution etched the surface — beryl is very "
                "resistant, but fluoride-rich acid fluids will eventually "
                "eat it, releasing Be²⁺ and SiO₂ back to the pocket."
            )

        return " ".join(parts)

    def _narrate_spodumene(self, c: Crystal) -> str:
        """Narrate a spodumene crystal — the lithium pyroxene book."""
        parts = [f"Spodumene #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        parts.append(
            "LiAlSi₂O₆ — monoclinic pyroxene. Two cleavage directions "
            "intersect at ~87°, and that's the diagnostic feature: when "
            "spodumene survives dissolution events, parting fragments from "
            "those cleavage planes litter the pocket floor. The 'book "
            "shape' flattened tabular habit is the signature. Can reach 14 "
            "meters in real pegmatites (Etta mine, South Dakota) — among "
            "the longest single crystals on Earth."
        )

        # Variety detection
        zone_notes = [z.note or "" for z in c.zones]
        varieties = set()
        for n in zone_notes:
            if "kunzite" in n: varieties.add("kunzite")
            if "hiddenite" in n: varieties.add("hiddenite")
            if "triphane" in n: varieties.add("triphane")

        if "kunzite" in varieties:
            parts.append(
                "Kunzite — the pink-lilac Mn²⁺ variety, named for George "
                "Kunz, Tiffany & Co.'s mineralogist who bought Minas Gerais "
                "specimens by the crate in the early 1900s. Kunzite "
                "fluoresces strongly pink-orange under SW UV, a diagnostic "
                "test no other pink gem material passes. Color depth "
                "correlates with growth rate — faster growth traps more "
                "color-causing impurity."
            )
        elif "hiddenite" in varieties:
            parts.append(
                "Hiddenite — the green Cr³⁺ variety, named for William Earl "
                "Hidden, who discovered the North Carolina locality in 1879. "
                "Much rarer than kunzite because Cr³⁺ needs to diffuse from "
                "country rock into the pegmatite fluid at just the right "
                "moment. Minas Gerais produces the world's best hiddenite."
            )
        elif "triphane" in varieties:
            parts.append(
                "Triphane — pale yellow-green or colorless, the iron-trace "
                "end-member. The name means 'three-appearing' (Greek), for "
                "the dichroism that shifts the hue depending on viewing "
                "angle. The default spodumene species when no strong "
                "chromophore is present."
            )

        parts.append(
            "A cross-section of this crystal perpendicular to the c-axis "
            "would show the pyroxene chain silicate structure: SiO₄ "
            "tetrahedra linked into single chains along c, with Li and Al "
            "occupying the M1 and M2 octahedral sites between them."
        )

        return " ".join(parts)

    def _narrate_anglesite(self, c: Crystal) -> str:
        """Narrate an anglesite crystal — the transient lead sulfate."""
        parts = [f"Anglesite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "PbSO₄ — orthorhombic lead sulfate, brilliant adamantine luster. "
            "Intermediate step in the galena → anglesite → cerussite "
            "oxidation sequence. Named for Anglesey, the Welsh island "
            "where the type specimens were found in the 1830s."
        )
        if "galena" in (c.position or ""):
            parts.append(
                "This crystal grew directly on a dissolving galena — "
                "the classic pseudomorphic relationship. The cubic outline "
                "of galena is gradually replaced from the outside in as "
                "Pb²⁺ and SO₄²⁻ recrystallize into the orthorhombic "
                "anglesite structure."
            )
        if any("→ cerussite" in (z.note or "") for z in c.zones):
            parts.append(
                "Converting to cerussite. Carbonate-bearing groundwater "
                "destabilizes anglesite in favor of the lead carbonate — "
                "Pb²⁺ + CO₃²⁻ is more stable than Pb²⁺ + SO₄²⁻ at low T. "
                "Anglesite is a 'letter written in passing' in the lead "
                "oxidation story."
            )
        if c.dissolved:
            parts.append(
                "The crystal has dissolved. If the pocket's chemistry "
                "continues to evolve the released Pb²⁺ will find a new "
                "home — cerussite if carbonate is present, pyromorphite "
                "if phosphate arrives."
            )
        return " ".join(parts)

    def _narrate_cerussite(self, c: Crystal) -> str:
        """Narrate a cerussite crystal — the star-twin lead carbonate."""
        parts = [f"Cerussite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "PbCO₃ — orthorhombic lead carbonate. Water-clear with "
            "adamantine luster and extreme birefringence — a thin "
            "slice doubles every image behind it. Final stable product "
            "of the lead oxidation sequence in carbonate-rich water. "
            "The Latin name 'cerussa' means 'white lead', a pigment "
            "used since antiquity (and poisonous — painters' death)."
        )
        if c.twinned and "sixling" in (c.twin_law or ""):
            parts.append(
                "Six-ray stellate cyclic twin — three individuals "
                "intergrown at 120° on {110}. Among mineralogy's most "
                "iconic forms; a sharp cerussite star commands four-"
                "figure prices at a show. This twin happened because "
                "growth ran at moderate supersaturation for a sustained "
                "window — fast enough to initiate the twin, slow enough "
                "to let it develop cleanly."
            )
        if "galena" in (c.position or ""):
            parts.append(
                "Pseudomorphs after galena — the cube outline survives "
                "as cerussite precipitates into it. Occasionally "
                "galena relics persist inside, slowly oxidizing."
            )
        if c.dissolved:
            parts.append(
                "Acid dissolution — cerussite is a carbonate and fizzes "
                "in acid just like calcite: PbCO₃ + 2H⁺ → Pb²⁺ + H₂O "
                "+ CO₂. Any released Pb may find pyromorphite or "
                "vanadinite if P or V is available."
            )
        return " ".join(parts)

    def _narrate_pyromorphite(self, c: Crystal) -> str:
        """Narrate a pyromorphite crystal — the phosphate lead apatite."""
        parts = [f"Pyromorphite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Pb₅(PO₄)₃Cl — hexagonal apatite-group phosphate. "
            "Barrel-shaped hexagonal prisms in olive-green, yellow, "
            "orange, or brown. Forms in supergene oxidation zones when "
            "phosphate-bearing meteoric water encounters a Pb-bearing "
            "horizon. The name is Greek 'pyros morphos' — 'fire form' "
            "— because the crystals re-form into a spherical droplet "
            "when melted."
        )
        if "olive" in (c.habit or ""):
            parts.append(
                "Classic olive-green barrel crystals. Found at the "
                "type locality of Leadhills (Scotland), at Dognacska "
                "(Romania), and — best of all — at Les Farges (France) "
                "where millimeter-sharp brilliant-green crystals set "
                "the world standard."
            )
        elif "yellow" in (c.habit or "") or "brown" in (c.habit or ""):
            parts.append(
                "Non-canonical color — the pocket fluid substituted "
                "Ca for some Pb (pale yellow-orange, phosphoapatite-"
                "adjacent) or carried Fe trace (brown-olive)."
            )
        parts.append(
            "Pyromorphite is used in environmental remediation: dump "
            "phosphate fertilizer onto lead-contaminated soil and the "
            "toxic Pb precipitates as pyromorphite — stable, insoluble, "
            "and harmless. Mineralogy as a cleanup tool."
        )
        return " ".join(parts)

    def _narrate_vanadinite(self, c: Crystal) -> str:
        """Narrate a vanadinite crystal — the red desert lead vanadate."""
        parts = [f"Vanadinite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Pb₅(VO₄)₃Cl — hexagonal apatite-group vanadate. Bright "
            "red-orange prisms with flat basal terminations, sitting "
            "atop goethite-stained matrix. Vanadium-end-member of the "
            "pyromorphite–mimetite–vanadinite series, arguably "
            "mineralogy's most complete solid-solution triangle."
        )
        if "endlichite" in (c.habit or ""):
            parts.append(
                "Endlichite — intermediate vanadinite-mimetite composition "
                "with significant As⁵⁺ substituting for V⁵⁺. The color "
                "shifts toward yellow as As dominates. The compositional "
                "series is continuous."
            )
        elif "red" in (c.habit or ""):
            parts.append(
                "The signature red-orange. This is the chromophore "
                "pegged to V⁵⁺ in the crystal structure — no other "
                "common mineral produces this particular red. The "
                "Moroccan Mibladen and Touissit deposits have produced "
                "the world's finest specimens, growing on goethite "
                "crust in near-surface oxidation pockets."
            )
        parts.append(
            "Classic desert mineral. V comes from oxidation of "
            "V-bearing red-bed sediments (roll-front uranium deposits, "
            "ironstones) — an arid-climate signature. The rock-shop "
            "cliché 'vanadinite on goethite' is geologically accurate."
        )
        return " ".join(parts)

    def _narrate_bornite(self, c: Crystal) -> str:
        """Narrate a bornite crystal — the 228°C order-disorder mineral."""
        parts = [f"Bornite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu₅FeS₄ — bronze-colored fresh, famous for the iridescent "
            "'peacock ore' tarnish from thin-film interference on surface "
            "oxidation products. The 228°C order-disorder transition is "
            "one of mineralogy's cleanest structural changes: above, Cu "
            "and Fe randomly occupy the cation sites (pseudo-cubic); "
            "below, they order into the orthorhombic arrangement."
        )
        if "pseudo_cubic" in (c.habit or ""):
            parts.append(
                "Grew at T > 228°C — crystal has the disordered "
                "pseudo-cubic structure preserved. If this specimen is "
                "cooled slowly below 228°C without being reheated, the "
                "Cu and Fe will gradually order into orthorhombic "
                "domains, sometimes visible as texture under reflected "
                "light."
            )
        elif "peacock" in (c.habit or ""):
            parts.append(
                "Peacock iridescent — thin-film interference on an "
                "oxidation crust. Fresh bornite bronze under the film. "
                "Strike it with a steel hammer and the fresh surface "
                "shows through; leave it in air for a week and the "
                "rainbow comes back. This is why bornite tumbled in "
                "rock-shop displays is often enhanced with heat or "
                "acid."
            )
        if c.dissolved:
            parts.append(
                "Oxidative dissolution — Cu²⁺ and Fe³⁺ went back to "
                "the fluid, probably to find malachite/azurite "
                "(for Cu) or goethite (for Fe). The S²⁻ oxidized too "
                "and may reappear as sulfate in anglesite or selenite."
            )
        return " ".join(parts)

    def _narrate_chalcocite(self, c: Crystal) -> str:
        """Narrate a chalcocite crystal — the pseudomorph thief."""
        parts = [f"Chalcocite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu₂S — 79.8% Cu by weight, one of the richest copper ores "
            "ever mined. Forms in the supergene enrichment blanket, "
            "where descending Cu²⁺-rich meteoric fluids meet reducing "
            "conditions at the water table. This is where mineable "
            "copper ore gets made: weathering concentrates Cu into a "
            "layer ten times richer than the primary sulfide above it."
        )
        if c.twinned and "sixling" in (c.twin_law or ""):
            parts.append(
                "Pseudo-hexagonal cyclic sixling twin — chalcocite's "
                "collector habit. Three orthorhombic individuals "
                "intergrown at ~60° approximate a hexagonal symmetry "
                "the mineral doesn't actually have. Butte, Cornwall, "
                "and Bristol Cliff produced sharp sixlings; most "
                "specimens at rock shows came from one of those three."
            )
        if "pseudomorph" in (c.habit or ""):
            parts.append(
                "Pseudomorph — this chalcocite replaced a primary sulfide "
                "(chalcopyrite or bornite) atom-by-atom while preserving "
                "the host's external form. Copper diffused in, iron and "
                "excess sulfur diffused out, leaving a ghost outline "
                "in dark gray Cu₂S. The cube is galena's; the disphenoid "
                "is chalcopyrite's; here the identity has been overwritten."
            )
        if "sooty" in (c.habit or ""):
            parts.append(
                "Sooty microcrystalline texture — rapid precipitation "
                "at the oxidation/reduction interface. Individual "
                "crystals too small to see; the aggregate looks like "
                "black soot smeared on the host rock."
            )
        return " ".join(parts)

    def _narrate_covellite(self, c: Crystal) -> str:
        """Narrate a covellite crystal — the only common blue mineral."""
        parts = [f"Covellite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "CuS — indigo-blue, the only common naturally blue mineral "
            "(azurite aside). Named for Niccolo Covelli, who first "
            "described the Vesuvius fumarole specimens in 1833. "
            "Hexagonal, with perfect basal cleavage — the fresh plates "
            "peel like mica, and the cleavage surfaces flash purple-"
            "green iridescence from thin-film interference."
        )
        if "iridescent" in (c.habit or ""):
            parts.append(
                "Iridescent coating — this covellite grew at the "
                "boundary between the oxidation and reduction zones. "
                "The fluid oscillated across the Eh boundary just "
                "enough to produce Cu²⁺ surface products on the "
                "forming crystal. Summerville (Italy), Butte, and "
                "the Sardinia localities show this habit best."
            )
        elif "rosette" in (c.habit or ""):
            parts.append(
                "Radiating rosette — plates nucleating outward from a "
                "common center. High supersaturation triggered multiple "
                "nucleation sites on the substrate at once, and the "
                "crystals grew into each other until the void was "
                "paved blue."
            )
        parts.append(
            "S:Cu ratio = 1:1, twice that of chalcocite. Covellite "
            "forms where sulfur activity is high enough to push past "
            "chalcocite's stoichiometry — typically the transition "
            "layer between oxidized caprock and reduced primary "
            "sulfides below."
        )
        if c.dissolved:
            parts.append(
                "Oxidative dissolution — the Cu²⁺ will find malachite "
                "or azurite; the S oxidized to sulfate."
            )
        return " ".join(parts)

    def _narrate_cuprite(self, c: Crystal) -> str:
        """Narrate a cuprite crystal — the Eh-boundary oxide."""
        parts = [f"Cuprite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu₂O — 88.8% Cu by weight, dark red with ruby-red internal "
            "reflections in thin slices. Forms at the Eh boundary between "
            "more-reducing native copper and more-oxidizing malachite/"
            "tenorite. The window is narrow, which is why cuprite tends to "
            "appear as thin layers between native Cu and green malachite "
            "coats — each zone captures a different depth in the Eh profile."
        )
        if c.habit == "chalcotrichite":
            parts.append(
                "Chalcotrichite — hair-like plush texture. Rapid "
                "directional growth in open fracture space produced "
                "whisker crystals instead of octahedra. The Morenci "
                "(Arizona) and Chessy (France) localities produced the "
                "best specimens — bright red velvet on matrix."
            )
        elif "massive" in (c.habit or ""):
            parts.append(
                "Massive 'tile ore' — dark red-brown rapidly-precipitated "
                "cuprite filling tight pore space. Less photogenic than "
                "octahedra, but this is how most cuprite actually occurs "
                "in the field."
            )
        elif c.twinned and "spinel" in (c.twin_law or ""):
            parts.append(
                "Spinel-law penetration twin — two octahedra intergrown "
                "with a {111} reentrant angle between them. Rare."
            )
        else:
            parts.append(
                "Classic octahedral habit, dark red with glassy-to-"
                "adamantine luster. Tsumeb (Namibia) and the Mashamba "
                "West mine (Congo) have produced gem-grade octahedra "
                "to 15+ cm."
            )
        if c.dissolved:
            parts.append(
                "Crystal dissolved — the Eh window shifted out from "
                "under it. If the fluid tilted reducing, Cu probably "
                "went to native copper; if oxidizing and carbonated, to "
                "malachite."
            )
        return " ".join(parts)

    def _narrate_azurite(self, c: Crystal) -> str:
        """Narrate an azurite crystal — the deep-blue carbonate."""
        parts = [f"Azurite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu₃(CO₃)₂(OH)₂ — the deepest blue in the common mineral "
            "kingdom. Requires high pCO₂ groundwater — typically a "
            "limestone-hosted supergene system where CO₂ stays elevated "
            "under the impermeable carbonate cap. Chessy-les-Mines "
            "(France) gave us 'chessylite', an old synonym; Tsumeb and "
            "Bisbee (Arizona) produced the showpiece blue prisms."
        )
        if c.habit == "azurite_sun":
            parts.append(
                "Azurite-sun — radiating flat disc, grown in a narrow "
                "fracture where crystallographic c-axis was forced "
                "perpendicular to the fracture plane. The Malbunka "
                "(Australia) azurite-suns in siltstone are the classic."
            )
        elif c.habit == "rosette_bladed":
            parts.append(
                "Radiating rosette — multiple blades nucleating at a "
                "common center. Each blade preserves its own growth "
                "zoning, visible as color intensity gradients under "
                "strong light."
            )
        else:
            parts.append(
                "Monoclinic prismatic — the flagship azurite habit. "
                "Deep blue trending to midnight-blue in thick crystals; "
                "transparent thin slices are a deep indigo."
            )
        has_conversion = any("→ malachite" in (z.note or "") for z in c.zones)
        if has_conversion:
            parts.append(
                "Azurite → malachite conversion — CO₂ has been escaping "
                "from the pocket fluid and the CO₃ inventory dropped "
                "below azurite's stability. The crystal shape will "
                "persist (pseudomorph after azurite) but fill with the "
                "green lower-carbonate mineral. Most Chessy and Morenci "
                "azurite sits frozen mid-conversion — half blue, half "
                "green — the geochemist's equivalent of a butterfly "
                "emerging."
            )
        if c.dissolved and not has_conversion:
            parts.append(
                "Acid dissolution — fizzes like calcite because it's a "
                "carbonate. Cu²⁺ and CO₃²⁻ released to fluid."
            )
        return " ".join(parts)

    def _narrate_chrysocolla(self, c: Crystal) -> str:
        """Narrate a chrysocolla crystal — the cyan copper silicate."""
        parts = [f"Chrysocolla #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu₂H₂Si₂O₅(OH)₄ — the cryptocrystalline copper silicate. "
            "X-ray amorphous in most samples (a 'mineraloid' by strict "
            "definition; sanctioned as a mineral since 1803). Forms "
            "only at meteoric temperatures, where Cu²⁺ from weathering "
            "sulfides meets dissolved SiO₂ from silicate wall rock in "
            "a narrow pH window. At Bisbee the quartz-monzonite "
            "porphyry supplies the silica and the Paleozoic limestones "
            "buffer the pH — the union gives the district's signature "
            "sky-blue enamel over cuprite and native copper."
        )
        if c.habit == "pseudomorph_after_azurite":
            parts.append(
                "Pseudomorph after azurite — the pCO₂ in the pocket "
                "fluid dropped below azurite's stability, and incoming "
                "silica-bearing water replaced the monoclinic prisms "
                "atom-by-atom. Outline preserved, interior converted. "
                "These specimens are the Bisbee centerpiece."
            )
        elif c.habit == "enamel_on_cuprite":
            parts.append(
                "Enamel over cuprite — a thin conformal film coating "
                "the earlier red Cu₂O. Where both are exposed on one "
                "specimen the colors pop: cochineal red under sky-blue. "
                "The textbook Bisbee pairing."
            )
        elif c.habit == "botryoidal_crust":
            parts.append(
                "Botryoidal crust — grape-cluster lobes, enamel-like "
                "luster, conchoidal fracture. Hardness varies with "
                "water content; the more hydrated the softer."
            )
        elif c.habit == "reniform_globules":
            parts.append(
                "Reniform globules — kidney-shaped lobes nucleating "
                "on earlier crystals. The glassy fracture means the "
                "material is closer to an amorphous silica gel than a "
                "true mineral lattice."
            )
        else:
            parts.append(
                "Silica-gel hemisphere — low supersaturation regime, "
                "rounded drop-like habit. Freshly precipitated "
                "chrysocolla is genuinely gel-like before it sets."
            )
        if c.dissolved:
            parts.append(
                "Dissolution — acid or high-T exposure has released "
                "the Cu²⁺ and SiO₂ back to fluid. Above ~100 °C it "
                "would dehydrate to plancheite or shattuckite instead."
            )
        return " ".join(parts)

    def _narrate_native_copper(self, c: Crystal) -> str:
        """Narrate a native copper crystal — the elemental metal."""
        parts = [f"Native copper #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Cu — elemental copper. Only forms when the fluid is "
            "strongly reducing AND low in sulfur (otherwise it would "
            "precipitate as sulfide). The Michigan Keweenaw peninsula "
            "basalt vesicles produced 500-ton masses — the Ontonagon "
            "boulder, now at the Smithsonian, is 1.7 tons. Copper-red "
            "fresh, tarnishes brown (cuprite surface film), eventually "
            "green (malachite patina)."
        )
        if c.habit == "massive_sheet":
            parts.append(
                "Massive sheet copper — the Lake Superior basin signature. "
                "Rapid precipitation in open basalt vesicles produced "
                "sheets tens of centimeters thick. This is where "
                "industrial copper mining began in the Western hemisphere, "
                "~5000 BC with Lake Superior Old Copper Culture tool-"
                "making."
            )
        elif c.habit == "arborescent_dendritic":
            parts.append(
                "Arborescent dendritic — tree-like branching, the "
                "collector's ideal. Each branch is a single crystal "
                "oriented along {100}; the aggregate approximates "
                "isotropic growth only macroscopically. Bisbee and "
                "Chino (New Mexico) produced the best."
            )
        elif c.habit == "wire_copper":
            parts.append(
                "Wire copper — filamentary growth in narrow channels. "
                "The Ray mine (Arizona) and the Chino stockwork produced "
                "the delicate wires that rock shops sell individually."
            )
        else:
            parts.append(
                "Cubic/dodecahedral well-formed crystal — rare for "
                "native copper, which usually grows as dendrites. "
                "Tsumeb produced the best sharp cubes."
            )
        parts.append(
            "The Statue of Liberty's iconic green patina is malachite "
            "growing on native copper — the mineralogical fate of most "
            "surface copper, given enough time and rain."
        )
        return " ".join(parts)

    def _narrate_magnetite(self, c: Crystal) -> str:
        parts = [f"Magnetite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Fe₃O₄ — the mixed-valence Fe²⁺Fe³⁺₂O₄ spinel oxide. Black, "
            "strongly magnetic (lodestone is natural permanent-magnet "
            "magnetite — the first compass). Sits at the HM (hematite-"
            "magnetite) redox buffer: cross that buffer and entire "
            "mineral assemblages shift. Streak is black, not red like "
            "hematite's — the field test."
        )
        if c.habit == "octahedral":
            parts.append(
                "Octahedral {111} — the classic magnetite habit, still "
                "sharp on matrix from Cerro Huanaquino (Bolivia) and "
                "Binn Valley (Switzerland)."
            )
        elif c.habit == "rhombic_dodecahedral":
            parts.append(
                "Rhombic dodecahedral {110} — the high-T, mineralizer-"
                "assisted habit. Cl-bearing fluids promote this form "
                "over simple octahedra."
            )
        else:
            parts.append(
                "Granular massive — rapid precipitation, aggregate of "
                "tiny individual crystals."
            )
        if c.dissolved:
            parts.append(
                "Dissolving to hematite (martite pseudomorph) as O₂ "
                "climbed past the HM buffer — one of the clearest "
                "paragenetic signals a collector can read."
            )
        return " ".join(parts)

    def _narrate_lepidocrocite(self, c: Crystal) -> str:
        parts = [f"Lepidocrocite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "γ-FeOOH — the ruby-red platy dimorph of goethite. Same "
            "formula, different crystal structure: goethite is a 3D "
            "framework (yellow-brown needles), lepidocrocite is "
            "layered (ruby-red platy, peels like mica). Kinetically "
            "favored when Fe²⁺ oxidizes FAST — e.g. pyrite weathering "
            "in situ; slow oxidation produces goethite instead."
        )
        if c.habit == "platy_scales":
            parts.append(
                "Platy scales — the default habit. 'Lithium quartz' "
                "sold in rock shops is quartz with nanoscale "
                "lepidocrocite inclusions that scatter pink-mauve "
                "through the clear host."
            )
        elif c.habit == "plumose_rosette":
            parts.append(
                "Plumose rosette — radiating platy blades. Best at "
                "Cornwall and the Siegerland (Germany)."
            )
        else:
            parts.append(
                "Fibrous micaceous — very rapid growth, coarser particle "
                "size, rust-brown color."
            )
        parts.append(
            "Given geological time, lepidocrocite converts to goethite "
            "(the thermodynamically stable dimorph). This crystal is "
            "a freeze-frame of the moment oxidation caught Fe²⁺."
        )
        return " ".join(parts)

    def _narrate_stibnite(self, c: Crystal) -> str:
        parts = [f"Stibnite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Sb₂S₃ — orthorhombic antimony sulfide, same structure as "
            "bismuthinite. Lead-gray to steel-gray, brilliant metallic "
            "luster on fresh cleavage. Ichinokawa (Japan) produced "
            "swords over 60 cm long — perhaps the most visually striking "
            "sulfide specimens ever collected. Low-melting (550°C), so "
            "any metamorphism destroys it."
        )
        if c.habit == "elongated_prism_blade":
            parts.append(
                "Elongated sword-blade — the signature habit that makes "
                "stibnite museum-worthy. Slow growth at moderate "
                "supersaturation lets the crystal extend along c-axis "
                "without branching."
            )
        elif c.habit == "radiating_spray":
            parts.append(
                "Radiating spray — multiple nucleation centers fanning "
                "outward. Herja (Romania) and Sierra Mojada (Mexico) "
                "produce the best sprays."
            )
        else:
            parts.append(
                "Massive granular — the bread-and-butter form. Most "
                "mineable Sb ore."
            )
        return " ".join(parts)

    def _narrate_bismuthinite(self, c: Crystal) -> str:
        parts = [f"Bismuthinite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Bi₂S₃ — orthorhombic bismuth sulfide, same structure as "
            "stibnite (Sb and Bi are geochemical cousins). Lead-gray "
            "to tin-white with yellowish/iridescent tarnish. Classic "
            "companion of arsenopyrite, cassiterite, and wolframite "
            "in tin-tungsten greisen deposits (Cornwall, Erzgebirge, "
            "Bolivian tin belt)."
        )
        if "stout" in (c.habit or ""):
            parts.append(
                "Stout prismatic — the high-T habit (T > 350°C). "
                "Characteristic of primary greisen growth."
            )
        elif "radiating" in (c.habit or ""):
            parts.append(
                "Radiating cluster of needles — multiple nucleation, "
                "moderate supersaturation burst."
            )
        else:
            parts.append(
                "Acicular needles — the low-T habit. Long, thin, "
                "easily mistaken for stibnite until the tin-white "
                "color and higher density give it away."
            )
        return " ".join(parts)

    def _narrate_native_bismuth(self, c: Crystal) -> str:
        parts = [f"Native bismuth #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "Bi — elemental bismuth. Silver-white on fresh fracture, "
            "iridescent rainbow tarnish within hours. Melts at an "
            "unusually low 271.5°C — the lowest melting point of any "
            "native metal. Only forms when sulfur runs out before "
            "bismuth does (otherwise it makes bismuthinite). The "
            "square hoppered rainbow Bi crystals sold in rock shops "
            "are LAB-GROWN — natural native bismuth is typically "
            "arborescent or massive."
        )
        if c.habit == "arborescent_dendritic":
            parts.append(
                "Arborescent dendritic — tree-like branches filling a "
                "fracture. Cobalt (Germany), the Kingsgate mine "
                "(Australia), and Schneeberg (Saxony) produced the "
                "best historically."
            )
        elif c.habit == "rhombohedral_crystal":
            parts.append(
                "Rhombohedral crystal — RARE. Bismuth crystallizes in "
                "trigonal symmetry with {0001} basal pinacoid; well-"
                "formed natural crystals are among the rarest native-"
                "element specimens collectors seek."
            )
        else:
            parts.append(
                "Massive granular — silver-white metallic blob, "
                "iridescent within days of exposure to air."
            )
        return " ".join(parts)

    def _narrate_clinobisvanite(self, c: Crystal) -> str:
        parts = [f"Clinobisvanite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(
            "BiVO₄ — bright yellow to orange-yellow monoclinic "
            "Bi-vanadate. End of the bismuth oxidation sequence: "
            "bismuthinite → native bismuth → bismite/bismutite → "
            "clinobisvanite (if V is available). Microscopic — the "
            "crystals are individually sub-millimeter, so "
            "clinobisvanite appears as a powdery yellow coating on "
            "matrix."
        )
        parts.append(
            "And: BiVO₄ is a photocatalyst for solar-driven water "
            "splitting. The same mineral that forms as a supergene "
            "afterthought is being engineered to make hydrogen fuel "
            "from sunlight. Nature had it first."
        )
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

            elif c.mineral == "wurtzite":
                desc = f"a {c.c_length_mm:.1f}mm wurtzite"
                if c.habit == "hemimorphic_crystal":
                    desc += " hexagonal pyramid"
                elif c.habit == "radiating_columnar":
                    desc = f"radiating wurtzite columns, {c.c_length_mm:.1f}mm across"
                elif c.habit == "fibrous_coating":
                    desc = f"fibrous wurtzite crust, {c.c_length_mm:.1f}mm thick"
                else:
                    desc += " tabular plate"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — hexagonal (Zn,Fe)S, darker than cubic sphalerite"
                if c.dissolved:
                    desc += ", inverted to sphalerite on cooling"
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

            elif c.mineral == "marcasite":
                desc = f"a {c.c_length_mm:.1f}mm marcasite"
                if c.habit == "cockscomb":
                    desc += " cockscomb"
                elif c.habit == "spearhead":
                    desc += " spearhead"
                elif c.habit == "radiating_blade":
                    desc = f"radiating marcasite blades, {c.c_length_mm:.1f}mm across"
                else:
                    desc += " tabular plate"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — pale brass, iridescent tarnish"
                if c.dissolved:
                    desc += ", partially replaced by pyrite (metastable inversion)"
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

    # Text-adventure preamble for random scenarios: scene-setting BEFORE sim.
    archetype = getattr(conditions, "_random_archetype", None)
    if archetype:
        print()
        print("┈┈┈┈┈ PREAMBLE ┈┈┈┈┈")
        print()
        print(sim.narrate_preamble(archetype))
        print()
        print("═" * 70)
        print()
    
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
