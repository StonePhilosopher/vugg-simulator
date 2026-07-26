# Mineral Species Template — Vugg Simulator

## Species: Malachite

### Identity
- **Formula:** Cu₂(CO₃)(OH)₂
- **Crystal system:** Monoclinic
- **Mineral group:** Carbonate (basic copper carbonate)
- **Hardness (Mohs):** 3.5–4
- **Specific gravity:** 3.6–4.0
- **Cleavage:** Perfect on {201}, fair on {010}
- **Fracture:** Subconchoidal to uneven
- **Luster:** Adamantine to vitreous; silky if fibrous; dull to earthy if massive

### Color & Appearance
- **Typical color:** Bright green to dark green, blackish-green; commonly banded in masses
- **Color causes:** Cu²⁺ (d⁹ d-d transitions)
- **Transparency:** Translucent to opaque
- **Streak:** Light green
- **Notable visual features:** Botryoidal banding (concentric rings of light/dark green), silky fibrous varieties

### Crystal Habits
- **Primary habit:** Botryoidal, massive
- **Common forms/faces:** Individual crystals rare — slender to acicular prismatic when they occur
- **Twin laws:** Common contact or penetration twins on {100} and {201}; polysynthetic twinning
- **Varieties:** Fibrous malachite (silky luster), botryoidal (banded), stalactitic
- **Special morphologies:** Pseudomorphs after azurite (retaining tabular/blocky azurite shape in green)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Near-surface to ~50°C (supergene)
- **Optimal growth temperature:** Ambient to ~40°C
- **Decomposition temperature:** ~200°C (decomposes to CuO + CO₂ + H₂O)
- **Temperature-dependent habits:** Lower T → finer banding; higher T (rare) → coarser crystalline

#### Chemistry Required
- **Required elements in broth:** Cu (from sulfide oxidation), CO₃²⁻ (from limestone/CO₂ dissolution), OH⁻
- **Optional/enhancing elements:** Ca (limestone host = more CO₃ → more malachite), Zn (rosasite/aurichalcite competition)
- **Inhibiting elements:** High S²⁻ (reducing conditions prevent carbonate formation)
- **Required pH range:** 6–9 (near-neutral to mildly alkaline)
- **Required Eh range:** Oxidizing (Eh > +0.3V)
- **Required O₂ range:** High — requires oxidized Cu²⁺

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes CO₂ from solution (carbonate sink)
- **Byproducts of dissolution/decomposition:** Releases Cu²⁺, CO₃²⁻, H⁺ on dissolution

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast (common mineral, forms readily)
- **Maximum crystal size:** Individual crystals to ~5mm; botryoidal masses to meters
- **Typical crystal size in vugs:** Crusts and botryoidal coatings, cm-scale
- **Does growth rate change with temperature?** Faster at slightly warmer temps (more CO₂ dissolution)
- **Competes with:** Azurite (same elements, different CO₂/H₂O ratio), chrysocolla, brochantite

#### Stability
- **Breaks down in heat?** ~200°C → tenorite (CuO) + CO₂ + H₂O
- **Breaks down in light?** Stable
- **Dissolves in water?** Very slightly soluble; dissolves readily in acids (effervesces in HCl)
- **Dissolves in acid?** HCl → vigorous effervescence (diagnostic)
- **Oxidizes?** Already fully oxidized Cu²⁺ — stable end product
- **Radiation sensitivity:** None significant

### Paragenesis
- **Forms AFTER:** Chalcopyrite → chalcocite → cuprite (primary sulfides oxidize first)
- **Forms BEFORE:** Stable end product in oxidation zone
- **Commonly associated minerals:** Azurite, cuprite, native copper, goethite, calcite, chrysocolla, brochantite
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized portions of copper sulfide deposits, especially near limestone

### Famous Localities
- **Classic locality 1:** Shaba (Katanga), DR Congo — massive banded malachite, some of finest ever
- **Classic locality 2:** Ural Mountains, Russia — enormous ornamental masses (now largely mined out)
- **Classic locality 3:** Bisbee, Arizona — crystalline specimens with azurite
- **Notable specimens:** Tsumeb, Namibia — pseudomorphs after azurite; Chessy, France

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None
- **LW (365nm) color:** None (or very weak green in some specimens)
- **Phosphorescent?** No
- **Activator:** None significant
- **Quenched by:** N/A

### Flavor Text
> Malachite is what copper becomes when it meets air, water, and time. The green bands record pulses of oxidation — each layer a breath of CO₂ drawn from limestone or atmosphere. Pseudomorphs after azurite are fossil-blue crystals turned green, a mineral remembering a different shape it once wore. Every banded sphere is a geological diary: wet season, dry season, wet again, over millennia. The Congolese miners who carved it into elephants and bookends were reading the same layers, choosing where the dark rings would become the trunk.

### Simulator Implementation Notes
- **New parameters needed:** CO₃²⁻ concentration in fluid (needed for all carbonates); dissolved CO₂ partial pressure
- **New events needed:** `event_limestone_contact` (if vug intersects carbonate host rock → boosts CO₃²⁻)
- **Nucleation rule pseudocode:**
```
IF trace_Cu > threshold AND CO3 > threshold AND pH > 6 AND Eh > 0.3 AND T < 80°C → nucleate malachite
```
- **Growth rule pseudocode:**
```
IF σ_malachite > 1 AND T < 80°C → grow at rate 4 (moderate)
σ_malachite = (Cu²⁺ × CO₃²⁻ × OH⁻) / Ksp_malachite
```
- **Habit selection logic:**
  - High growth rate + limited space → botryoidal
  - Very high CO₃ + steady conditions → banded botryoidal
  - Slow growth + open space → acicular/prismatic crystals (rare)
  - Azurite present + low pCO₂ → pseudomorph replacement (azurite→malachite conversion)
- **Decomposition products:** T > 200°C → tenorite (CuO) + CO₂ (released to fluid) + H₂O

### Variants for Game
- **Variant 1: Banded malachite** — concentric green rings, botryoidal. Condition: steady-state growth with periodic CO₃ pulses. Most common.
- **Variant 2: Fibrous malachite** — silky, chatoyant green fibers. Condition: rapid growth in tight fractures.
- **Variant 3: Azurite pseudomorph** — green mineral in blue crystal shape. Condition: azurite formed first, then CO₂ dropped → replacement. Rare and collectible.

### Paragenetic Sequence Note
Malachite is part of the **copper oxidation zone sequence**: chalcopyrite/chalcocite (primary sulfides) → cuprite (Cu₂O, first oxide) → native copper (reduced) / malachite + azurite (carbonates, in presence of CO₃²⁻). Malachite is the thermodynamically stable end product at surface conditions with low pCO₂; azurite is the high-pCO₂ precursor that converts to malachite over time.
