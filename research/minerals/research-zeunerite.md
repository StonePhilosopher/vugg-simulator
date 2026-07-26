# Zeunerite — Vugg Simulator Research

## Species: Zeunerite

### Identity
- **Formula:** Cu(UO₂)₂(AsO₄)₂·(10-16)H₂O
- **Crystal system:** Tetragonal
- **Mineral group:** Autunite group (uranyl arsenate)
- **Hardness (Mohs):** 2.5
- **Specific gravity:** 3.2–3.4
- **Cleavage:** {001} perfect, {100} distinct — micaceous
- **Fracture:** Uneven
- **Luster:** Vitreous

### Color & Appearance
- **Typical color:** Emerald-green to yellow-green
- **Color causes:** Cu²⁺ chromophore (green) + uranyl (UO₂)²⁺ absorption
- **Transparency:** Transparent, becoming translucent on dehydration
- **Streak:** Pale green
- **Notable visual features:** Thin square tablets identical in habit to torbernite but with a slightly more yellow-green cast; isostructural with torbernite (P↔As substitution)

### Crystal Habits
- **Primary habit:** Flat tabular crystals on {001}
- **Common forms/faces:** Square or rectangular plates, often subparallel
- **Twin laws:** Not commonly twinned
- **Varieties:** Metazeunerite — Cu(UO₂)₂(AsO₄)₂·8H₂O, dehydration product (fewer water molecules, denser)
- **Special morphologies:** Micaceous aggregates, scaly encrustations

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/ambient)
- **Optimal growth temperature:** 15–40°C
- **Decomposition temperature:** Dehydrates to metazeunerite above ~75°C
- **Temperature-dependent habits:** Dehydration is primary temperature effect; habit otherwise consistent

#### Chemistry Required
- **Required elements:** Cu, U, As — arsenic must be oxidized to AsO₄³⁻ (arsenate)
- **Optional/enhancing elements:** P (forms torbernite if phosphate available; complete solid solution possible)
- **Inhibiting elements:** Reducing agents; V (forms carnotite instead if vanadate dominates)
- **Required pH range:** Slightly acidic to neutral (5–7)
- **Required Eh range:** Strongly oxidizing — both U⁶⁺ and As⁵⁺ required
- **Required O₂ range:** High

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺, (UO₂)²⁺, AsO₄³⁻ from solution
- **Byproducts of dissolution:** Releases uranyl, copper, arsenate — all toxic in groundwater

#### Growth Characteristics
- **Relative growth rate:** Moderate — limited by arsenate supply
- **Maximum crystal size:** ~1 cm plates
- **Typical crystal size in vugs:** 1–5 mm tabular plates
- **Does growth rate change with temperature?** Not significantly within stability range
- **Competes with:** Torbernite (P analogue — if phosphate present, torbernite forms preferentially), olivenite, scorodite (other Cu-As or Fe-As secondary minerals)

#### Stability
- **Breaks down in heat?** Yes — dehydrates to metazeunerite irreversibly
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble
- **Dissolves in acid?** Yes, readily
- **Oxidizes?** Already fully oxidized (U⁶⁺, As⁵⁺)
- **Dehydrates?** Yes — zeunerite ↔ metazeunerite is the key transformation. Loses 2-8 H₂O
- **Radiation sensitivity:** Self-irradiation from U and As decay

### Paragenesis
- **Forms AFTER:** Uraninite (U source), arsenopyrite/tennantite (As source), primary Cu sulfides (Cu source)
- **Forms BEFORE:** Iron oxyhydroxides, clay minerals
- **Commonly associated minerals:** Torbernite, metazeunerite, olivenite, scorodite, azurite, malachite, barite, fluorite, brochantite
- **Zone:** Supergene oxidation zone of hydrothermal U-As deposits
- **Geological environment:** Oxidized zones of uranium-arsenic-bearing hydrothermal veins, granite pegmatites

### Famous Localities
- **Schneeberg District, Ore Mountains, Saxony, Germany** — type locality (1872)
- **Cínovec (Zinnwald), Czech Republic** — well-formed green plates on quartz
- **Musonoi Mine, Katanga, DRC** — large specimens from copper-uranium deposits
- **Majuba Hill, Nevada, USA** — association with other secondary uranium minerals
- **Notable specimens:** Thin emerald-green tablets on quartz matrix from Schneeberg

### Fluorescence
- **Fluorescent under UV?** No — Cu²⁺ quenches fluorescence (same as torbernite)
- **Activator:** N/A
- **Quenched by:** Cu²⁺ — powerful fluorescence quencher in the autunite group

### Flavor Text

> Zeunerite is torbernite's arsenic twin. The same square green plates, the same micaceous cleavage, the same slow suicide by radioactivity — but swap phosphorus for arsenic and you get a mineral that's toxic on two fronts. Found in the oxidized ruins of hydrothermal veins where arsenopyrite and uraninite once coexisted at depth, zeunerite crystallizes when groundwater carries both elements into the light. The arsenic is the giveaway: zeunerite localities are almost always former mining districts with a history of arsenic poisoning. The mineral is beautiful and it knows it. Emerald-green tablets, perfectly formed, each one a small monument to the chemistry of decay. Like torbernite, it dehydrates — zeunerite becomes metazeunerite, losing water and gaining hardness, another irreversible transformation in a mineral family that seems to specialize in them.

### Simulator Implementation Notes
- **New parameters needed:** None — trace_U, trace_Cu, trace_As all already in game
- **New events needed:** Arsenic oxidation — As must be mobilized as AsO₄³⁻ in oxidizing conditions
- **Nucleation rule pseudocode:**
```
IF temp < 50 AND Eh > 0.4 AND trace_U > threshold AND trace_Cu > threshold AND trace_As > threshold AND pH 5-7
  IF trace_P > trace_As → nucleate torbernite instead
  ELSE → nucleate zeunerite
```
- **Growth rule pseudocode:**
```
IF zeunerite exists AND trace_U, trace_Cu, trace_As available AND oxidizing → grow tabular plate
IF temp > 75 → convert zeunerite → metazeunerite
```
- **Habit selection logic:** Always tabular. Isostructural with torbernite, identical habit logic
- **Decomposition products:** Metazeunerite (dehydration); dissolution releases uranyl, Cu, arsenate

### Variants for Game
- **Variant 1: Metazeunerite** — dehydrated form, 8 H₂O, paler green, denser. Irreversible transformation.
- **Variant 2: P-Zeunerite (solid solution)** — partial P substitution, intermediate between torbernite and zeunerite. Color shifts toward bluer green.
- **Variant 3: Scaly encrustation** — thin overlapping plates coating fracture surfaces. Low supersaturation habit.

---

## Paragenetic Sequence: Uranium Oxidation Zone

See research-torbernite.md for full sequence table. Zeunerite represents the As-dominated branch, forming where arsenic (from oxidized arsenopyrite/tennantite) is the dominant oxyanion instead of phosphorus or vanadium.

**Key gameplay insight:** All three uranium minerals (torbernite, carnotite, zeunerite) share the same formation pathway and compete for the same uranyl ions. The controlling variable is which anion dominates the local groundwater:
- P-rich → Torbernite (green, tetragonal, micaceous)
- As-rich → Zeunerite (green, tetragonal, micaceous, As twin)
- V-rich + K-rich → Carnotite (yellow, monoclinic, crusts)

This makes them a natural branching sequence in the game — the same oxidation event produces different minerals depending on trace chemistry.
