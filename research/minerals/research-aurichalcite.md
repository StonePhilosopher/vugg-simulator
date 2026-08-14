# Mineral Species — Aurichalcite

## Species: Aurichalcite

### Identity
- **Formula:** (Zn,Cu)₅(CO₃)₂(OH)₆ — Zn:Cu ratio ~5:4
- **Crystal system:** Monoclinic (2/m)
- **Mineral group:** Carbonate
- **Hardness (Mohs):** 2
- **Specific gravity:** 3.96
- **Cleavage:** Perfect on {010} and {100}
- **Fracture:** Uneven
- **Luster:** Pearly to silky

### Color & Appearance
- **Typical color:** Pale green, greenish blue, light blue; colorless to pale blue/green in transmitted light
- **Color causes:** Cu²⁺ chromophore in lower concentration than rosasite (Zn-dominant); the high Zn content mutes the blue toward pale green
- **Transparency:** Transparent to translucent
- **Streak:** Light blue
- **Notable visual features:** Delicate tufted divergent sprays — the mineral looks like tiny frozen fireworks or sea anemones. High birefringence (0.089) gives strong interference colors under cross-polarized light.

### Crystal Habits
- **Primary habit:** Tufted divergent sprays and radiating acicular aggregates
- **Common forms/faces:** Spherical aggregates, thick crusts; rarely columnar, laminated, or granular
- **Twin laws:** Observed in X-ray patterns (not macroscopically visible)
- **Varieties:** None formally recognized
- **Special morphologies:** Sprays, crusts, encrustations on matrix

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 10–40°C (ambient, supergene)
- **Optimal growth temperature:** 15–30°C
- **Decomposition temperature:** ~150–200°C (dehydrates)
- **Temperature-dependent habits:** Cooler → more delicate sprays; warmer → thicker crusts

#### Chemistry Required
- **Required elements in broth:** Zn²⁺ (high — Zn-dominant), Cu²⁺ (moderate), CO₃²⁻ (high — needs 2 carbonate per formula unit)
- **Optional/enhancing elements:** None significant
- **Inhibiting elements:** High Cu (pushes system toward rosasite instead)
- **Required pH range:** 7–9 (alkaline preferred — needs carbonate stability)
- **Required Eh range:** Oxidizing (+0.2 to +0.6 V)
- **Required O₂ range:** High — supergene mineral

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes 5 cations + 2 CO₃ per formula unit — significant drain on fluid chemistry
- **Byproducts of nucleation:** Minor H⁺ release
- **Byproducts of dissolution/decomposition:** Dissolves in acids, releasing CO₂

#### Growth Characteristics
- **Relative growth rate:** Moderate — similar to rosasite
- **Maximum crystal size:** Individual sprays to ~1 cm; crusts to several cm
- **Typical crystal size in vugs:** Sprays 2–10 mm
- **Does growth rate change with temperature?** Slightly
- **Competes with:** Rosasite (Cu/Zn ratio determines which forms — high Zn favors aurichalcite, high Cu favors rosasite), smithsonite (competes for Zn + CO₃), hydrozincite (competes for Zn + CO₃ without Cu)

#### Stability
- **Breaks down in heat?** ~150–200°C, dehydrates
- **Breaks down in light?** Stable
- **Dissolves in water?** Very slightly
- **Dissolves in acid?** Yes, with effervescence
- **Oxidizes?** Already fully oxidized
- **Dehydrates?** At elevated temperature
- **Radiation sensitivity:** Not documented

### Paragenesis
- **Forms AFTER:** Primary sulfides (sphalerite, chalcopyrite) oxidize → releases Zn²⁺ and Cu²⁺
- **Forms BEFORE:** May be replaced by smithsonite as Cu is depleted
- **Commonly associated minerals:** Rosasite (intimate associate — they're chemical cousins), smithsonite, hemimorphite, hydrozincite, malachite, azurite, limonite/goethite, cerussite
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized zones of Cu-Zn deposits; also mine walls and adits (post-mine formation)

### Famous Localities
- **Classic locality 1:** Loktevskoye Mine, Rudny Altai, Western Siberia, Russia (type locality, 1839)
- **Classic locality 2:** Mapimi, Durango, Mexico — exquisite sprays with rosasite
- **Classic locality 3:** Laurion, Greece — historic ancient slag minerals
- **Notable specimens:** Delicate pale blue sprays from Mapimi on limonite are the most sought-after

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None reported
- **MW (310nm) color:** None reported
- **LW (365nm) color:** None reported
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text
> Aurichalcite is named for orichalcum — Plato's mythical lost metal of Atlantis, the gold-alloy that gleamed on the walls of a sunken civilization. The real mineral is quieter than its namesake: pale blue-green sprays so delicate they look like they'd dissolve if you breathed on them, growing on mine walls where sphalerite once slept. It's the zinc-rich cousin of rosasite — when the broth has more zinc than copper, you get these feathery tufts instead of velvety balls. The two minerals are always found together, two precipitation paths from the same weathering soup, divided only by a ratio. Hardness 2 — you can scratch it with your fingernail. Atlantis was always more fragile than the stories say.

### Simulator Implementation Notes
- **New parameters needed:** None — uses existing Zn, Cu, CO₃, O₂
- **New events needed:** None
- **Nucleation rule pseudocode:**
```
IF temp < 40 AND temp > 10
  AND trace_Zn > high AND trace_Cu > moderate
  AND CO3 > high AND pH > 7 AND O2 > high
  AND Zn:Cu ratio > 1 (Zn-dominant fluid)
  → nucleate aurichalcite (max 2 nuclei)
```
- **Growth rule pseudocode:**
```
IF σ_aurichalcite > 1.0 AND vug_fill < 1.0
  → grow at moderate rate
  habit = "tufted_spray" (default) | "crust" (if T > 25°C)
```
- **Habit selection logic:** Default tufted divergent spray. High temperature → thicker crusts. High Zn → paler color. High Cu → bluer.
- **Decomposition products:** Dissolves → releases Zn²⁺ + Cu²⁺ + CO₃²⁻ back to fluid

### Variants for Game
- **Variant 1:** Standard aurichalcite — pale blue-green sprays (Zn:Cu ~5:4)
- **Variant 2:** Zincian aurichalcite — very pale green, almost white sprays (Zn:Cu >> 5:4)
- **Variant 3:** Cuprian aurichalcite — deeper blue sprays (Cu approaching Zn content; transitional toward rosasite)
