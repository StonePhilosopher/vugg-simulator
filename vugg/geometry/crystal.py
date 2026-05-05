"""GrowthZone + Crystal — per-zone history record + the growing crystal.

Extracted verbatim from vugg/__init__.py during PROPOSAL-MODULAR-REFACTOR
Phase A4. Both dataclasses live here together because Crystal stores a
List[GrowthZone] and the two are always touched as a unit.

Dependencies pulled in from sibling modules:
  * FluidChemistry — vugg/chemistry/fluid.py (used by Crystal helper
    methods that read trace-element fluid composition)

WallState is referenced only inside Crystal docstring/comments — no
runtime import needed. DEHYDRATION_TRANSITIONS is also referenced only
in a comment.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from ..chemistry.fluid import FluidChemistry  # noqa: F401  (kept for type-hint resolution if anything later uses get_type_hints)


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
    trace_Au: float = 0.0       # Au — invisible-gold trace (arsenopyrite
                                # structurally traps up to 1500 ppm Au);
                                # released to fluid on supergene oxidation,
                                # feeding native_gold re-precipitation in
                                # the oxidation zone.
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
    # Anchor cell on the wall where this crystal nucleated. Combined
    # with `wall_ring_index` (below) it identifies the (ring, cell)
    # the crystal sits on. WallState.paint_crystal() grows outward
    # from here by wall_spread × total_growth.
    wall_center_cell: Optional[int] = None
    # Phase C v1: which ring the crystal nucleated on (0 = south pole
    # / floor, ring_count-1 = north pole / ceiling). None means legacy
    # ring-0 placement (loaded from a pre-Phase-C-v1 save). New
    # nucleations always set this. Growth reads the ring's fluid +
    # temperature for chemistry; paint targets this ring's cells.
    wall_ring_index: Optional[int] = None
    # Environment at nucleation time. 'fluid' (the dominant case — vug
    # cavity is fluid-filled, geometric-selection orientation along the
    # substrate normal) or 'air' (drained / cave-style cavity, gravity-
    # driven orientation: stalactite c-axis points world-down regardless
    # of substrate normal). Stored on the crystal because orientation is
    # set at growth time and persists even if the cavity later re-floods
    # — older air-grown crystals keep their gravity-aligned habit; later
    # fluid-grown crystals on top of them are substrate-aligned. Default
    # 'fluid' is correct for every existing scenario; 'air' is plumbed
    # but won't trigger until a scenario explicitly drains the cavity.
    growth_environment: str = "fluid"

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

    # Paramorph tracking — set by apply_paramorph_transitions when the crystal
    # crosses a phase-transition T threshold (first instance: argentite → acanthite
    # at 173°C, Round 8a-2). Stores the *original* (pre-transition) mineral name
    # so library + narrator can flag the cubic-acanthite-after-argentite case.
    paramorph_origin: Optional[str] = None
    paramorph_step: Optional[int] = None      # step on which the paramorph fired
    # v28 dehydration tracking — counts steps spent in a dry
    # environment (vadose ring with elevated concentration). Read by
    # apply_dehydration_transitions to decide when borax should
    # pseudomorph to tincalconite. Only relevant for crystals listed
    # in DEHYDRATION_TRANSITIONS; safely ignored otherwise.
    dry_exposure_steps: int = 0

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
        elif self.mineral in ("pyrite", "marcasite", "chalcopyrite", "galena", "molybdenite", "tetrahedrite", "tennantite"):
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
