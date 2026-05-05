"""Geometry — vug wall, ring/cell topo grid, dissolution + paint.

Extracted verbatim from vugg/__init__.py during PROPOSAL-MODULAR-REFACTOR
Phase A4. Three classes:
  * VugWall   — reactive carbonate wall (acid pulses, dissolution, refresh)
  * WallCell  — one cell of the ring/cell topo grid
  * WallState — full ring stack with paint_crystal + Fourier profile

Dependencies pulled in from sibling modules:
  * FluidChemistry — vugg/chemistry/fluid.py (used by VugWall.acidify and
    by WallState's per-ring fluid array)

Crystal is referenced ONLY as a string annotation in
WallState.paint_crystal — no runtime Crystal import is needed because
Python doesn't evaluate string annotations unless typing.get_type_hints
is called (it isn't, anywhere in the existing engine).
"""

import math
import random
from dataclasses import dataclass, field, fields, replace
from typing import List, Optional, Tuple

from ..chemistry.fluid import FluidChemistry


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

    # Player-tunable wall reactivity multiplier (Creative mode slider).
    # Scales the acid-driven dissolution rate and gates a small water-
    # only dissolution path:
    #   0.0  → totally inert (no dissolution even with strong acid)
    #   0.5  → sluggish, dolomite-like (acid takes ~2× longer to enlarge the cavity)
    #   1.0  → DEFAULT, current limestone behavior used by all scenarios
    #   1.5  → reactive limestone (fast acid attack + mild water dissolution)
    #   2.0  → fresh / high-surface-area limestone (max acid + meaningful water dissolution)
    # Only affects carbonate walls (limestone, dolomite); silicate
    # composition still returns {"dissolved": False} regardless of
    # reactivity, because real silicate dissolution at sim T-P-time
    # scales is geologically negligible.
    reactivity: float = 1.0

    def dissolve(self, acid_strength: float, fluid: 'FluidChemistry') -> dict:
        """Dissolve wall rock in response to acid AND (high-reactivity) water.

        CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂  (acid path)
        CaCO₃ + H₂CO₃ → Ca²⁺ + 2HCO₃⁻   (water path — slow, reactivity-gated)

        Only reactive carbonate walls (limestone, dolomite) buffer this
        way. Silicate host rocks (pegmatite, granite, gneiss, quartzite,
        phyllite) are effectively inert on sim timescales — they don't
        dissolve in mildly acidic hydrothermal fluids, don't release
        cations at a useful rate, and don't buffer pH. Return
        {"dissolved": False} for those so pH can actually drop and
        mineral kaolinization can proceed on the pocket's crystals.

        Two contributions to the per-step dissolution rate:
          • acid_rate = acid_strength × 0.5 × reactivity
          • water_rate = max(0, reactivity − 1.0) × 0.05
        Sum is capped at 2.0 mm/step.

        Returns dict of what happened.
        """
        # Gate by composition first — silicate walls are inert.
        if self.composition not in ("limestone", "dolomite"):
            return {"dissolved": False}

        # Acid attack — scales with how far below the carbonate-attack
        # threshold pH we are, multiplied by the wall's reactivity.
        acid_rate = max(0.0, acid_strength) * 0.5 * self.reactivity

        # Water-only baseline — fires regardless of pH but is slow.
        # Only meaningful when reactivity is set above default (real
        # carbonate dissolution by mildly aggressive groundwater happens
        # over Ma timescales; the slider lets Creative mode players
        # accelerate that to compressed sim-step time).
        water_rate = max(0.0, self.reactivity - 1.0) * 0.05

        rate_mm = min(acid_rate + water_rate, 2.0)
        if rate_mm <= 0.0:
            return {"dissolved": False}

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

    The data model is 2D: rings × cells. The wall surface is sliced
    vertically into `ring_count` parallel rings stacked along the cavity
    axis (Phase 1 of PROPOSAL-3D-SIMULATION). Each cell is a wedge of
    angular arc, with its own `wall_depth` — how much acid has pushed
    that chunk of wall outward.

    Phase 1 (data shape only): all rings share the same
    `base_radius_mm` profile, and engine writes (paint_crystal,
    erode_cells) still target ring[0]. Rings 1..N-1 hold pristine
    WallCell defaults at every step. Forward-simulation results are
    therefore identical to single-ring runs; only the data shape is
    new. Per-ring chemistry and orientation tags arrive in Phases 2-3.

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
    # Phase 1 of PROPOSAL-3D-SIMULATION: 16 vertically-stacked rings as
    # the new default. Engine still operates on ring[0] only — rings 1..15
    # hold pristine WallCell defaults so forward-simulation byte-equality
    # is preserved. Phase 2 (per-ring chemistry) is what makes them differ.
    ring_count: int = 16
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

    # Cross-axis (polar) irregularity profile. The equatorial bubble-
    # merge above defines the cavity outline as you sweep θ around the
    # rotation axis (slice the cavity horizontally). Slice it vertically
    # and — without this — you'd see a perfect sphere shrink-shape, since
    # all rings share the same θ profile scaled by sin(latitude).
    # `polar_amplitudes` + `polar_phases` add a Fourier-like 1D
    # modulation along the polar axis (ring index → latitude φ), so the
    # cavity bulges and pinches in the vertical direction too. Renderer-
    # only for now: engine math (mean_diameter_mm, paint_crystal, etc.)
    # still reads the equatorial profile via ring[0]'s base_radius_mm,
    # so the polar modulation is a visual layer on top — it doesn't
    # change crystal nucleation or growth. Phase F-prime work.
    polar_amplitudes: List[float] = field(default_factory=list)
    polar_phases: List[float] = field(default_factory=list)

    # Phase F: per-ring θ twist. Adjacent rings rotate slightly relative
    # to each other, so the equatorial bubble-merge bumps spiral up the
    # cavity wall instead of stacking in perfect vertical columns.
    # Computed as a 3-harmonic Fourier series in φ (smooth along the
    # polar axis), so adjacent rings have similar twist values — the
    # cavity reads as a continuously-twisted geode rather than a stack
    # of independently rotated discs.
    twist_amplitudes: List[float] = field(default_factory=list)
    twist_phases: List[float] = field(default_factory=list)

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
        self._build_polar_profile()
        self._build_twist_profile()
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

    # --- Cross-axis (polar) profile ---------------------------------------
    # Three-harmonic Fourier-style modulation in φ. Amplitudes drawn
    # from a separately-seeded RNG (shape_seed XOR a fixed offset) so
    # the polar profile is reproducible per scenario without polluting
    # the equatorial RNG sequence.
    _POLAR_HARMONICS = 3
    _POLAR_AMP_RANGE = (-0.18, 0.18)  # ~±18% radius modulation peaks

    def _build_polar_profile(self) -> None:
        """Seed polar_amplitudes + polar_phases from a derived RNG.
        polar_profile_factor(φ) returns 1 + Σ Aₙ·cos(n·φ + θₙ); the
        renderer multiplies each ring's radial extent by this factor
        to give the cavity vertical irregularity (bulges and pinches
        along the polar axis). Mean over φ ∈ [0, π] is exactly 1
        because each cosine harmonic integrates to zero over a full
        period."""
        import random as _random
        seed = int(self.shape_seed) ^ 0x70_0AA_517   # arbitrary fixed offset
        rng = _random.Random(seed & 0xFFFFFFFF)
        lo, hi = self._POLAR_AMP_RANGE
        self.polar_amplitudes = [rng.uniform(lo, hi)
                                  for _ in range(self._POLAR_HARMONICS)]
        self.polar_phases = [rng.uniform(0.0, 2.0 * math.pi)
                              for _ in range(self._POLAR_HARMONICS)]

    def polar_profile_factor(self, phi: float) -> float:
        """Per-latitude radial multiplier. φ in radians, with φ=0 at
        south pole and φ=π at north pole. Floored at 0.5 so a strong
        pinch can't collapse a ring to zero radius (which would
        invert the geometry on render)."""
        factor = 1.0
        for n, amp in enumerate(self.polar_amplitudes):
            factor += amp * math.cos((n + 1) * phi + self.polar_phases[n])
        return max(0.5, factor)

    # --- Phase F: per-latitude twist profile ------------------------------
    # Each ring gets a smoothly-varying θ rotation so the cavity reads
    # as a twisted geode. Three harmonics in φ; amplitudes ~ ±0.4 rad
    # peaks (the sum of three ±0.4 amplitudes peaks well past that, but
    # the cosine sum rarely hits the worst case). Total twist range
    # across the polar axis is roughly ±0.6 rad on average — visible
    # but not chaotic.
    _TWIST_HARMONICS = 3
    _TWIST_AMP_RANGE = (-0.4, 0.4)

    def _build_twist_profile(self) -> None:
        """Seed twist amplitudes + phases from a derived RNG. Uses a
        different XOR mask than the polar profile so the two profiles
        are independent — a seed that happens to give a strongly
        bulged polar profile won't also give a strongly twisted one."""
        import random as _random
        seed = int(self.shape_seed) ^ 0x_BEEF_FACE
        rng = _random.Random(seed & 0xFFFFFFFF)
        lo, hi = self._TWIST_AMP_RANGE
        self.twist_amplitudes = [rng.uniform(lo, hi)
                                  for _ in range(self._TWIST_HARMONICS)]
        self.twist_phases = [rng.uniform(0.0, 2.0 * math.pi)
                              for _ in range(self._TWIST_HARMONICS)]

    def ring_twist_radians(self, phi: float) -> float:
        """Per-latitude θ offset in radians. φ ∈ [0, π]. Renderer adds
        this to the angle of every cell on the latitude band; the
        equatorial bubble-merge bumps then appear to spiral up the
        cavity wall rather than stack in vertical columns."""
        twist = 0.0
        for n, amp in enumerate(self.twist_amplitudes):
            twist += amp * math.cos((n + 1) * phi + self.twist_phases[n])
        return twist

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

    def ring_orientation(self, ring_idx: int) -> str:
        """Phase D: which third of the sphere this ring belongs to.

        Floor rings (bottom quarter by latitude) → 'floor'; ceiling
        rings (top quarter) → 'ceiling'; everything in the middle
        → 'wall'. Used by Phase D nucleation weighting (more crystals
        on the wall — that's where most surface area lives) and Phase
        D v1's habit-orientation logic. For ring_count == 1 every
        ring is 'wall' (legacy single-ring sims have no vertical
        structure)."""
        n = self.ring_count
        if n <= 1:
            return 'wall'
        if ring_idx < n // 4:
            return 'floor'
        if ring_idx >= 3 * n // 4:
            return 'ceiling'
        return 'wall'

    def ring_area_weight(self, ring_idx: int) -> float:
        """Phase D: per-ring nucleation weight proportional to the
        ring's circumference on the sphere. A real geode's wall has
        roughly 6× more area per latitude band at the equator than
        at a polar cap, so the equator should host more crystal
        nucleations. Returns sin(latitude) using the same half-step
        offset the renderer uses (so visual area matches engine
        weight)."""
        n = self.ring_count
        if n <= 1:
            return 1.0
        phi = math.pi * (ring_idx + 0.5) / n
        return math.sin(phi)

    def ring_index_for_height_mm(self, height_mm: float) -> int:
        """Map a vertical position (mm above the floor) to a ring index.

        Floor (height = 0) → ring 0; ceiling (height = ring_count *
        ring_spacing_mm) → ring_count - 1. Out-of-range heights clamp
        to the nearest valid ring. Used by Phase 2+ for per-ring
        chemistry seeding and Phase 3 orientation tagging; safe to
        call in Phase 1 (just returns 0 for any height when
        ring_count == 1)."""
        if self.ring_count <= 1:
            return 0
        spacing = self.ring_spacing_mm if self.ring_spacing_mm > 0 else 1.0
        idx = int(height_mm / spacing)
        if idx < 0:
            return 0
        if idx >= self.ring_count:
            return self.ring_count - 1
        return idx

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
        thickness. Called after growth each step. Phase C v1: paints
        on the crystal's own ring (`crystal.wall_ring_index`) so
        crystals scatter across the sphere wall. Legacy crystals
        (None ring index) fall through to ring 0.

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
        ring_idx = crystal.wall_ring_index
        if ring_idx is None or ring_idx < 0 or ring_idx >= self.ring_count:
            ring_idx = 0
        FOOTPRINT_SCALE = 4.0
        arc_mm = ((crystal.total_growth_um / 1000.0)
                  * max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE)
        half_cells = max(1, int(round(arc_mm / self.cell_arc_mm / 2.0)))
        thickness = max(crystal.total_growth_um, 1.0)  # nucleated = visible
        ring = self.rings[ring_idx]
        N = self.cells_per_ring
        for offset in range(-half_cells, half_cells + 1):
            idx = (crystal.wall_center_cell + offset) % N
            cell = ring[idx]
            if cell.thickness_um < thickness:
                cell.crystal_id = crystal.crystal_id
                cell.mineral = crystal.mineral
                cell.thickness_um = thickness

