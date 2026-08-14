# Torbernite — Vugg Simulator Research

## Species: Torbernite

### Identity
- **Formula:** Cu(UO₂)₂(PO₄)₂·12H₂O
- **Crystal system:** Tetragonal
- **Mineral group:** Autunite group (uranyl phosphate)
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 3.22 (measured), 3.264 (calculated)
- **Cleavage:** [001] perfect, [100] distinct — micaceous
- **Fracture:** Brittle
- **Luster:** Vitreous to pearly

### Color & Appearance
- **Typical color:** Emerald green to apple green
- **Color causes:** Copper (Cu²⁺) chromophore + uranyl (UO₂)²⁺ absorption
- **Transparency:** Transparent to subtranslucent
- **Streak:** Pale green
- **Notable visual features:** Thin tabular plates that look like green mica; strong radioactivity

### Crystal Habits
- **Primary habit:** Tabular crystals flattened on {001}
- **Common forms/faces:** Square or octagonal outlines, thin plates
- **Twin laws:** Rare on {110}
- **Varieties:** Metatorbernite (Cu(UO₂)₂(PO₄)₂·8H₂O) — dehydration product with fewer water molecules
- **Special morphologies:** Foliated aggregates, earthy encrustations, micaceous books

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/ambient conditions)
- **Optimal growth temperature:** 15–40°C
- **Decomposition temperature:** Dehydrates to metatorbernite above ~75°C; loses structural water
- **Temperature-dependent habits:** Higher temps → faster dehydration → meta- form

#### Chemistry Required
- **Required elements:** Cu, U, P, O — U must be present as mobile U⁶⁺ (uranyl) in oxidizing groundwater
- **Optional/enhancing elements:** Ca (forms autunite instead if dominant)
- **Inhibiting elements:** Reducing agents (S²⁻, organic matter) keep U as insoluble U⁴⁺
- **Required pH range:** Slightly acidic to neutral (5–7)
- **Required Eh range:** Strongly oxidizing — U⁶⁺ must be mobile
- **Required O₂ range:** High — oxidation zone mineral

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺, (UO₂)²⁺, PO₄³⁻ from solution
- **Byproducts of dissolution:** Releases uranyl ions (mobile in oxidizing water), copper, phosphate

#### Growth Characteristics
- **Relative growth rate:** Moderate — limited by U⁶⁺ supply
- **Maximum crystal size:** Several cm across (tabular plates)
- **Typical crystal size in vugs:** 1–10 mm plates
- **Competes with:** Autunite (Ca analogue), zeunerite (As analogue), uranium phosphates

#### Stability
- **Breaks down in heat?** Yes — dehydrates to metatorbernite ~75°C
- **Breaks down in light?** No significant photodecomposition
- **Dissolves in water?** Slightly soluble; dehydration is more significant than dissolution
- **Dissolves in acid?** Yes, dissolves readily in mineral acids
- **Oxidizes?** Already fully oxidized (U⁶⁺)
- **Dehydrates?** Yes — torbernite ↔ metatorbernite is the defining transformation. Loses 4 H₂O
- **Radiation sensitivity:** Self-irradiation from U decay can metamictize structure over geologic time

### Paragenesis
- **Forms AFTER:** Uraninite (primary U ore), apatite (phosphate source), primary Cu sulfides
- **Forms BEFORE:** Later clay minerals, iron oxyhydroxides
- **Commonly associated minerals:** Metatorbernite, autunite, zeunerite, malachite, azurite, limonite, quartz
- **Zone:** Supergene oxidation zone of uranium deposits
- **Geological environment:** Granite pegmatites, hydrothermal U deposits, oxidized zones

### Famous Localities
- **Schneeberg/Schwarzenberg, Saxony, Germany** — type locality, Ore Mountains
- **Musonoi Mine, Katanga, DRC** — large emerald-green plates
- **Red Canyon, Colorado, USA** — Colorado Plateau uranium deposits
- **Notable specimens:** Large tabular plates from Mashamba West Mine, Kolwezi, DRC

### Fluorescence
- **Fluorescent under UV?** No — torbernite is notably non-fluorescent (Cu²⁺ quenches)
- **Activator:** N/A
- **Quenched by:** Cu²⁺ is a powerful fluorescence quencher

### Flavor Text

> Torbernite is the mineral that glows but doesn't fluoresce. Each emerald-green plate carries its own radioactivity — uranium decaying in the crystal lattice, slowly destroying the very structure that holds it. Found in the oxidized tops of uranium deposits where groundwater has mobilized U⁶⁺ and met copper and phosphate, it forms perfect square tablets that look like someone pressed green glass into geological stamps. The dehydration story is its most human quality: torbernite loses water and becomes metatorbernite, a leaner, harder version of itself. The transformation is irreversible. You can't go home again, but you crystallize into something that lasts.

### Simulator Implementation Notes
- **New parameters needed:** trace_U (already in game), trace_P (already in game)
- **New events needed:** Uranium oxidation pulse — when uraninite (UO₂) in vug encounters oxidizing conditions, releases U⁶⁺
- **Nucleation rule pseudocode:**
```
IF temp < 50 AND Eh > 0.4 AND trace_U > threshold AND trace_Cu > threshold AND trace_P > threshold AND pH 5-7 → nucleate torbernite
```
- **Growth rule pseudocode:**
```
IF torbernite exists AND trace_U available AND oxidizing conditions → grow tabular plate, rate proportional to U⁶⁺ supply
IF temp > 75 → convert torbernite → metatorbernite (dehydration event)
```
- **Habit selection logic:** Always tabular. Plate width:thickness ratio varies with growth rate (fast = thinner plates)
- **Decomposition products:** Metatorbernite (loss of 4 H₂O) at elevated temperature; dissolution releases uranyl, Cu, phosphate

### Variants for Game
- **Variant 1: Metatorbernite** — dehydrated form (8 H₂O), slightly denser, paler green. Forms when torbernite is heated or stored dry. Irreversible.
- **Variant 2: Crust habit** — earthy, powdery green coating on fracture surfaces. Low supersaturation.
- **Variant 3: Book habit** — stacked micaceous plates like mica. Multiple nucleation events on same substrate.

---

## Paragenetic Sequence: Uranium Oxidation Zone

This mineral belongs to the secondary uranium mineral family. All share the same formation pathway:

**Primary source:** Uraninite (UO₂) — U⁴⁺, insoluble, formed at high temperature
**Oxidation event:** Groundwater with dissolved O₂ converts U⁴⁺ → U⁶⁺ (uranyl, UO₂²⁺), which is highly mobile
**Supergene deposition:** Uranyl combines with available anions (PO₄³⁻, AsO₄³⁻, VO₄³⁻) and cations (Cu²⁺, Ca²⁺, K⁺)

| Mineral | Cation | Anion | Formula |
|---------|--------|-------|---------|
| Torbernite | Cu²⁺ | PO₄³⁻ | Cu(UO₂)₂(PO₄)₂·12H₂O |
| Zeunerite | Cu²⁺ | AsO₄³⁻ | Cu(UO₂)₂(AsO₄)₂·10-16H₂O |
| Carnotite | K⁺ | VO₄³⁻ | K₂(UO₂)₂(VO₄)₂·3H₂O |

All form at low temperature (<50°C), oxidizing conditions, in the supergene zone. The controlling factor is which anion (P, As, V) and which cation (Cu, K, Ca) dominate the local groundwater.
