# Mineral Species Template — Vugg Simulator

## Species: Azurite

### Identity
- **Formula:** Cu₃(CO₃)₂(OH)₂
- **Crystal system:** Monoclinic
- **Mineral group:** Carbonate (basic copper carbonate)
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 3.77–3.89
- **Cleavage:** Perfect on {011}, fair on {100}, poor on {110}
- **Fracture:** Conchoidal
- **Luster:** Vitreous

### Color & Appearance
- **Typical color:** Azure-blue to dark blue, rarely pale blue
- **Color causes:** Cu²⁺ d-d transitions (more intense than malachite due to different coordination geometry)
- **Transparency:** Transparent to translucent
- **Streak:** Light blue
- **Notable visual features:** Deep midnight blue crystals, vitreous luster, often forms rosettes/spherical aggregates; pleochroic (shades of blue)

### Crystal Habits
- **Primary habit:** Prismatic, tabular
- **Common forms/faces:** Elongated prismatic crystals, often striated; also drusy coatings
- **Twin laws:** Rare — twin planes {101}, {102}, {001}
- **Varieties:** Crystalline (prismatic), massive, stalactitic, drusy crusts
- **Special morphologies:** Rosettes (radiating crystal clusters), "suns" (spherical aggregates of bladed crystals)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Near-surface, ~10–40°C (supergene)
- **Optimal growth temperature:** ~20–30°C
- **Decomposition temperature:** ~320°C (loses CO₂, converts to tenorite)
- **Temperature-dependent habits:** Not strongly temperature-dependent; habit driven by CO₂ pressure

#### Chemistry Required
- **Required elements in broth:** Cu (high concentration, from sulfide oxidation), CO₃²⁻ (high pCO₂), OH⁻
- **Optional/enhancing elements:** Ca (limestone host increases CO₃)
- **Inhibiting elements:** Low pCO₂ (causes conversion to malachite), Fe³⁺ (goethite competition)
- **Required pH range:** 7–9 (alkaline favors azurite over malachite)
- **Required Eh range:** Oxidizing (Eh > +0.3V)
- **Required O₂ range:** High — requires Cu²⁺

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes 2 CO₃ per formula unit (more than malachite's 1)
- **Byproducts of dissolution:** Releases Cu²⁺, CO₃²⁻, H⁺
- **Conversion to malachite:** 2 Cu₃(CO₃)₂(OH)₂ + H₂O → 3 Cu₂(CO₃)(OH)₂ + CO₂ (driven by low pCO₂)

#### Growth Characteristics
- **Relative growth rate:** Slow to moderate (less common than malachite)
- **Maximum crystal size:** To 25 cm (Tsumeb giants)
- **Typical crystal size in vugs:** 1–5 cm crystals, rosettes to 5 cm
- **Does growth rate change with temperature?** Not significantly
- **Competes with:** Malachite (higher pCO₂ → azurite wins; lower → malachite wins), cuprite, chrysocolla

#### Stability
- **Breaks down in heat?** ~320°C → tenorite + CO₂ + H₂O
- **Breaks down in light?** Stable under normal storage, but prolonged humidity + low CO₂ → surface malachite
- **Dissolves in water?** Slightly; dissolves readily in acids (effervesces in HCl — diagnostic)
- **Dissolves in acid?** HCl → vigorous effervescence
- **Oxidizes?** Already fully oxidized; UNSTABLE at low pCO₂ → converts to malachite pseudomorph
- **Radiation sensitivity:** None significant

### Paragenesis
- **Forms AFTER:** Cuprite (intermediate), primary Cu sulfides
- **Forms BEFORE:** Malachite (azurite is the precursor; malachite replaces it at lower pCO₂)
- **Commonly associated minerals:** Malachite, cuprite, native copper, goethite, calcite, cerussite, chrysocolla, olivenite, barite, quartz
- **Zone:** Supergene/oxidation zone (upper part, high pCO₂)
- **Geological environment:** Oxidized copper deposits with limestone or carbonate country rock

### Famous Localities
- **Classic locality 1:** Tsumeb, Namibia — world's finest azurite crystals (to 25 cm), deep blue giants
- **Classic locality 2:** Bisbee, Arizona — "Bisbee Blue" rosettes and crystal clusters
- **Classic locality 3:** Chessy-les-Mines, Lyon, France — type locality, historic "chessylite"
- **Notable specimens:** Milpillas Mine, Sonora, Mexico — electric blue tabular crystals; Touissit, Morocco

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text
> Azurite is a promise that copper makes to carbon dioxide, kept only under pressure. When CO₂ is abundant and the chemistry is just right, copper builds itself into these impossible midnight-blue crystals — the deepest blue in the mineral kingdom. But the promise is fragile. Lower the CO₂, add a little water, and the blue turns green: azurite becomes malachite, every crystal a fossil of the shape it used to wear. The Tsumeb giants, 25 centimeters of solid darkness, survived because the ground held its breath long enough. Most azurite is born to become malachite. The blue ones are the ones that got away.

### Simulator Implementation Notes
- **New parameters needed:** pCO₂ (partial pressure of dissolved CO₂) — key control for azurite vs malachite
- **New events needed:** None specific, but `event_limestone_contact` favors azurite (high CO₃)
- **Nucleation rule pseudocode:**
```
IF trace_Cu > high_threshold AND CO3 > high_threshold AND pCO2 > threshold AND pH > 7 AND Eh > 0.3 AND T < 50°C → nucleate azurite
```
- **Growth rule pseudocode:**
```
IF σ_azurite > 1 AND pCO2 > threshold AND T < 50°C → grow at rate 3 (slower than malachite)
σ_azurite = (Cu²⁺ × CO₃²⁻² × OH⁻) / Ksp_azurite
```
- **Habit selection logic:**
  - High pCO₂ + open space → prismatic/tabular crystals
  - Moderate space → rosettes (radiating bladed aggregates)
  - Limited space → drusy crusts
  - **CRITICAL:** If pCO₂ drops below threshold during growth → convert to malachite pseudomorph
- **Decomposition products:** T > 320°C → tenorite (CuO) + CO₂ + H₂O

### Azurite → Malachite Conversion Mechanic
This is the key gameplay mechanic for the copper carbonate pair:
```
IF azurite exists AND pCO2 < threshold:
  prob = (threshold - pCO2) / threshold * time_factor
  IF random() < prob → replace azurite crystal with malachite pseudomorph
  (retain azurite's crystal shape, change color/identity to malachite)
```

### Variants for Game
- **Variant 1: Prismatic azurite** — deep blue elongated crystals. Condition: high pCO₂, open vug space. Classic Tsumeb style.
- **Variant 2: Azurite rosette** — spherical cluster of radiating bladed crystals. Condition: moderate space, nucleation on cavity wall. Bisbee style.
- **Variant 3: Azurite sun** — flat, disc-like radiating aggregate. Condition: growth between clay seams or thin fractures. Malbunka, Australia style.

### Paragenetic Sequence Note
Azurite and malachite are the carbonate end-members of the copper oxidation sequence. Azurite requires **higher pCO₂** than malachite — it forms first, then converts to malachite as CO₂ escapes. In the game, this means azurite is the early carbonate (if CO₃ is available) and malachite is the late-stage stable product. Pseudomorphs are the visible record of this transition. Both require prior oxidation of primary copper sulfides (chalcopyrite → chalcocite → cuprite → carbonates).
