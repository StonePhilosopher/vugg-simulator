# Mineral Species Research — Strontianite

## Species: Strontianite

### Identity
- **Formula:** SrCO₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Carbonate (aragonite group)
- **Hardness (Mohs):** 3.5
- **Specific gravity:** 3.74–3.78
- **Cleavage:** {110} nearly perfect, {021} poor, {010} traces
- **Fracture:** Subconchoidal to uneven
- **Luster:** Vitreous, resinous on breaks, greasy

### Color & Appearance
- **Typical color:** Colorless, white, gray, light yellow, green, or brown
- **Color causes:** Trace impurities; colorless in transmitted light when pure
- **Transparency:** Transparent to translucent
- **Streak:** White
- **Notable visual features:** High birefringence (δ = 0.15) gives strong doubling of facets. Pseudohexagonal twins. Acicular to fibrous crystal aggregates.

### Crystal Habits
- **Primary habit:** Short to long prismatic, often acicular
- **Common forms/faces:** Elongated along [001]; pseudohexagonal from twinning
- **Twin laws:** Very common — contact twins (usual), rarely penetration twins; also repeated polysynthetic twinning
- **Varieties:** None formally named; Ca-rich varieties approach aragonite composition
- **Special morphologies:** Acicular, columnar-fibrous, granular, powdery, massive. Can form radiating sprays.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Low-temperature hydrothermal, ~50–200°C
- **Optimal growth temperature:** ~80–150°C
- **Decomposition temperature:** ~1,094°C (decomposes to SrO + CO₂)
- **Temperature-dependent habits:** Lower temps favor acicular/fibrous; higher temps favor stout prismatic

#### Chemistry Required
- **Required elements in broth:** Sr²⁺, CO₃²⁻ (or dissolved CO₂ + alkaline conditions)
- **Optional/enhancing elements:** Ca (substitutes up to 27% of Sr), Ba (substitutes up to 3.3%), Pb
- **Inhibiting elements:** High sulfate favors celestine (SrSO₄) over strontianite
- **Required pH range:** Alkaline (pH >7)
- **Required Eh range:** Not strongly redox-sensitive
- **Required O₂ range:** Not critical

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Sr²⁺ and CO₃²⁻ from solution
- **Byproducts of dissolution/decomposition:** Dissolves in acids releasing CO₂; thermal decomposition releases CO₂

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** To ~8 cm
- **Typical crystal size in vugs:** 1–5 cm prismatic crystals; acicular sprays smaller
- **Does growth rate change with temperature?** Standard behavior — higher T slightly faster nucleation
- **Competes with:** Celestine (SrSO₄) — the main competitor for Sr. Celestine is far more common in nature because sulfate is usually more available than carbonate in Sr-bearing fluids

#### Stability
- **Breaks down in heat?** Yes, ~1,094°C → SrO + CO₂
- **Breaks down in light?** No
- **Dissolves in water?** Very slightly (Ksp ~5.6 × 10⁻¹⁰ at 25°C)
- **Dissolves in acid?** Yes, readily in dilute HCl with effervescence
- **Oxidizes?** No
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Not notable
- **Alters to:** Celestine (SrSO₄) when exposed to sulfate-bearing fluids

### Paragenesis
- **Forms AFTER:** Celestine (can replace it when CO₂-rich fluids arrive)
- **Forms BEFORE:** Can alter to celestine if sulfate increases
- **Commonly associated minerals:** Celestine, barite, calcite, fluorite, galena, sphalerite, witherite
- **Zone:** Low-temperature hydrothermal veins, sedimentary carbonates, vugs in limestone
- **Geological environment:** Hydrothermal veins in limestone, carbonatite-associated deposits, vugs in carbonate host rocks. The type locality is Strontian, Scotland — strontium was discovered there in 1790, the element named for the town, the mineral named for the element.

### Famous Localities
- **Strontian, Argyllshire, Scotland** — type locality, where strontium was discovered
- **Münsterland, North Rhine-Westphalia, Germany** — fine acicular sprays
- **Meckley's Quarry, Pennsylvania, USA** — fluorescent specimens
- **Hammam Zriba, Tunisia** — yellow to green crystals
- **Austria (Styria)** — classic European locality

### Fluorescence
- **Fluorescent under UV?** Yes — almost always fluorescent
- **SW (255nm) color:** Bright yellowish white (some report white with slight blue tint)
- **MW (310nm) color:** Yellowish white
- **LW (365nm) color:** Yellowish white
- **Phosphorescent?** Yes — most specimens phosphoresce
- **Activator:** Likely intrinsic SrCO₃ lattice or trace rare earth elements
- **Quenched by:** Not well documented; Fe may quench

### Flavor Text
> Strontianite is the mineral that gave the world an element — not the other way around. Found in a Scottish lead mine in 1790, it was the first strontium mineral ever identified, and the element took its name from the town of Strontian. The mineral itself is an aragonite-group carbonate, always twinned, usually acicular, and almost always fluorescent: a warm yellowish white under every UV wavelength that persists after the lamp goes dark. It's rarer than celestine because the ocean prefers to precipitate strontium as sulfate, not carbonate. But in CO₂-rich hydrothermal veins — in the dark, where the vugs are — strontianite wins that particular race, building its slender prisms from orthorhombic repetition. Every crystal a palindrome. Every locality a reminder that the periodic table was built one mineral at a time.

### Simulator Implementation Notes
- **New parameters needed:** None — Sr and CO₃ already tracked
- **New events needed:** Possible celestine→strontianite replacement event (CO₂-rich fluid pulse)
- **Nucleation rule pseudocode:**
```
IF trace_Sr > threshold AND dissolved_CO3 > threshold AND sulfate_low THEN nucleate
```
- **Growth rule pseudocode:**
```
IF trace_Sr > 0 AND dissolved_CO3 > 0 AND SO4/Sr_ratio < 1.0 THEN grow
rate proportional to min(trace_Sr, dissolved_CO3) * (1 - SO4_ratio)
```
- **Habit selection logic:** T < 100°C → acicular/fibrous sprays; T > 100°C → stout prismatic/pseudohexagonal twins
- **Decomposition products:** SrO + CO₂ (gas) at ~1,094°C
- **Competition:** If SO₄²⁻ is high, nucleate celestine instead. Strontianite/celestine ratio = f(CO₃/SO₄)
- **Solid solution:** Ca substitution can be tracked — high Ca content = approach aragonite properties

### Variants for Game
- **Variant 1:** *Acicular strontianite* — low temperature, radiating sprays of needle-like crystals. German-style.
- **Variant 2:** *Prismatic strontianite* — higher temperature, stout pseudohexagonal prisms. Scottish type material.
- **Variant 3:** *Calcian strontianite* — Ca-rich variety, approaching aragonite. Lower SG (~3.5), reduced fluorescence.

---

## Shared Mechanic: The Carbonate-Sulfate Switch

Both witherite and strontianite implement the same geological control: the CO₃/SO₄ ratio in the fluid determines which mineral wins.

- **High SO₄:** Barite (BaSO₄) and celestine (SrSO₄) precipitate instead
- **High CO₃:** Witherite (BaCO₃) and strontianite (SrCO₃) precipitate instead
- **Shift from SO₄→CO₃:** Replacement event — barite→witherite, celestine→strontianite
- **Shift from CO₃→SO₄:** Reverse replacement — less common but documented

This is the same mechanic as the oxidation zone copper minerals (cuprite→malachite→azurite controlled by CO₂/Eh), but for alkaline earth elements controlled by the carbonate/sulfate balance.

In the simulator, a single fluid chemistry parameter shift (CO₂ pulse, sulfate depletion) can trigger the switch — a dramatic event that transforms existing crystals.

---

*Completed: 2026-05-02 by Vugg game expansion cron*
