"""FluidChemistry — hydrothermal-fluid composition dataclass.

Extracted verbatim from vugg/__init__.py during PROPOSAL-MODULAR-REFACTOR
Phase A3. The class is re-exported from vugg/__init__.py so existing
`from vugg import FluidChemistry` imports keep working unchanged.

Conceptually a leaf — depends only on `dataclass`. Every other engine
class (VugConditions, WallState, Crystal, …) builds on this one.
"""

from dataclasses import dataclass


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
    Au: float = 0.0            # ppm — gold (native gold; Bingham/Bisbee porphyry-Cu-Au; eventually calaverite/sylvanite when Te-Au coupling lands)
    O2: float = 0.0            # relative oxygen fugacity (0=reducing, 1=neutral, 2=oxidizing)
    pH: float = 6.5
    salinity: float = 5.0      # wt% NaCl equivalent
    # v27 evaporative concentration multiplier. 1.0 = unchanged
    # scenario chemistry. > 1.0 = water has evaporated, leaving solutes
    # behind at higher effective concentration. Per-ring (each
    # ring_fluids[k] has its own value); boosted at wet → vadose
    # transition (× EVAPORATIVE_CONCENTRATION_FACTOR) and also
    # gradually as a porosity-draining ring stays vadose. Read by
    # evaporite supersaturation methods (halite, selenite-evaporite
    # mode) to determine when bathtub-ring deposits precipitate.
    concentration: float = 1.0

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
