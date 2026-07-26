# Mineral Species Template — Vugg Simulator

## Species: Scheelite

### Identity
- **Formula:** CaWO₄
- **Crystal system:** Tetragonal (dipyramidal, 4/m)
- **Mineral group:** Tungstate
- **Hardness (Mohs):** 4.5–5
- **Specific gravity:** 5.9–6.1 (notably heavy)
- **Cleavage:** Distinct on {101}, interrupted on {112}, indistinct on {001}
- **Fracture:** Subconchoidal to uneven
- **Luster:** Vitreous to adamantine

### Color & Appearance
- **Typical color:** Colorless, white, golden yellow, brown, orange, pale green, reddish gray
- **Color causes:** Compositional zoning (Mo substitution → yellow-orange), trace REE, Fe staining. Dark brown/black zones from W reduction (W⁵⁺/W⁴⁺ from oxygen vacancies).
- **Transparency:** Transparent to opaque
- **Streak:** White
- **Notable visual features:** High dispersion (0.026) gives perceptible "fire" approaching diamond. Adamantine luster on crystal faces. Compositional color zoning common. Pleochroic (yellow to orange-brown).

### Crystal Habits
- **Primary habit:** Pseudo-octahedral dipyramids (the classic form)
- **Common forms/faces:** {101}, {112}, {001} — dipyramidal with occasional prism faces
- **Twin laws:** Common penetration and contact twins on {110} or {001}
- **Varieties:** "Blue scheelite" (misnomer — actually calcite+dolomite rock with scheelite traces)
- **Special morphologies:** Columnar, granular, tabular, massive. Drusy crusts rare (Cínovec, Czech Republic only notable locality). Crystal faces may be striated.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 200–500°C
- **Optimal growth temperature:** 300–450°C (skarn/greisen window)
- **Decomposition temperature:** Stable to very high T; melts at ~1580°C
- **Temperature-dependent habits:** Higher T → coarser, well-formed dipyramids. Lower T → granular/massive.

#### Chemistry Required
- **Required elements in broth:** Ca (from host rock alteration), W (from granitic fluid). Ca typically abundant; W is the limiting factor.
- **Optional/enhancing elements:** Mo (forms solid solution → powellite component, shifts fluorescence from blue to yellow). REE (substitute for Ca, incorporated during growth).
- **Inhibiting elements:** F and P-bearing fluids inhibit scheelite precipitation by forming competing Ca minerals (fluorite, apatite) — scavenging Ca before scheelite can nucleate.
- **Required pH range:** Near-neutral to mildly acidic (pH 4–7)
- **Required Eh range:** Moderate — not strongly reducing or oxidizing
- **Required O₂ range:** Low to moderate (reducing enough to keep W as W⁶⁺ in solution until precipitation)

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No — simple precipitation reaction
- **Byproducts of nucleation:** Removes Ca and W from fluid
- **Byproducts of dissolution/decomposition:** Releases Ca²⁺ and WO₄²⁻ back to fluid. Weathering can produce secondary tungstite (WO₃·H₂O) as yellow crust.

#### Growth Characteristics
- **Relative growth rate:** Slow to moderate
- **Maximum crystal size:** To ~30 cm (exceptional). Typically 1–10 cm in good specimens.
- **Typical crystal size in vugs:** 0.5–5 cm dipyramids
- **Does growth rate change with temperature?** Higher T → faster growth, coarser crystals
- **Competes with:** Fluorite (for Ca), apatite (for Ca), wolframite (for W — wolframite forms at higher T and more acidic conditions)

#### Stability
- **Breaks down in heat?** No (stable to very high temperatures)
- **Breaks down in light?** No
- **Dissolves in water?** Practically insoluble
- **Dissolves in acid?** Insoluble in most acids; soluble in alkalis
- **Oxidizes?** No (already fully oxidized W⁶⁺)
- **Dehydrates?** N/A (anhydrous)
- **Radiation sensitivity:** Darkens with radiation damage (REE content can produce metamict zones)

### Paragenesis
- **Forms AFTER:** Wolframite (retrograde — scheelite replaces wolframite at lower T), early skarn silicates (grossular, diopside, vesuvianite)
- **Forms BEFORE:** Powellite (oxidation product when Mo-bearing), secondary tungstite (weathering)
- **Commonly associated minerals:** Cassiterite, wolframite, topaz, fluorite, apatite, tourmaline, quartz, grossular-andradite garnet, diopside, vesuvianite, tremolite, molybdenite
- **Zone:** Primary/hypogene — skarn, greisen, high-T hydrothermal veins
- **Geological environment:** Contact metamorphic skarns (most important), high-T hydrothermal veins, greisen deposits, granite pegmatites (rare)

### Famous Localities
- **Classic locality 1:** Caldbeck Fells, Cumbria, England — historic specimens
- **Classic locality 2:** Cínovec (Zinnwald), Czech Republic — rare drusy crusts
- **Classic locality 3:** Dragoon Mountains, Arizona, USA
- **Notable specimens:** Kimpu-san, Japan (large crystals altered to wolframite pseudomorphs). Trumbull, Connecticut. Xuebaoding, Sichuan, China — gem-quality golden crystals on cassiterite. Taewha Mine, South Korea — large dipyramids.

### Fluorescence
- **Fluorescent under UV?** YES — famously so
- **SW (255nm) color:** Bright sky-blue (classic diagnostic)
- **MW (310nm) color:** Occasionally red
- **LW (365nm) color:** Dimmer blue-white to yellow
- **Phosphorescent?** Weakly, sometimes
- **Activator:** Intrinsic to the CaWO₄ lattice (self-activated). Mo substitution shifts color toward white/yellow (powellite-like). REE activators can produce other colors.
- **Quenched by:** Fe²⁺ suppresses fluorescence

### Flavor Text
> Scheelite is the mineral that glows its own name. Under shortwave UV it ignites into impossible sky-blue — not from impurities, but from its own crystal lattice ringing like a struck bell. Those dipyramidal pseudo-octahedra, heavy as sin in the hand, form in the skarn zone where granite meets limestone and the earth's chemistry rewires itself. Every tungsten atom in your phone's vibration motor once passed through scheelite on its way out of the ground. The old prospectors knew: find the blue glow, find the tungsten. Sometimes find the gold too.

### Simulator Implementation Notes
- **New parameters needed:** trace_W (tungsten in broth). Already have trace_Mo. Need solid-solution tracking between scheelite and powellite.
- **New events needed:** None beyond supersaturation function
- **Nucleation rule pseudocode:**
```
IF temp >= 200 AND temp <= 500
  AND Ca > threshold AND W > threshold
  AND (Ca not consumed by fluorite/apatite formation)
  → nucleate scheelite
```
- **Growth rule pseudocode:**
```
IF σ_scheelite > 1.0 → grow at rate proportional to σ
  Mo content tracked as solid-solution fraction (0-100%)
  Higher Mo fraction → fluorescence shifts blue→yellow
```
- **Habit selection logic:** 
  - T > 350°C AND space available → well-formed dipyramid
  - T 200-350°C → tabular to columnar
  - Limited space → granular/massive
- **Decomposition products:** None (stable). Weathering → tungstite (WO₃·H₂O)

### Variants for Game
- **Variant 1: Golden scheelite** — rich yellow color from Mo substitution, yellow-white fluorescence instead of blue. Conditions: high Mo/W ratio in fluid.
- **Variant 2: Blue-fluorescent scheelite** — classic sky-blue SW response, low Mo content. The "type specimen" experience.
- **Variant 3: Pseudomorph after wolframite** — scheelite has replaced wolframite but retains its habit. History encoded in shape. Conditions: wolframite deposited first, then fluid chemistry shifted.

---

## Scheelite-Powellite Solid Solution
Scheelite (CaWO₄) and powellite (CaMoO₄) form a complete solid solution series — identical crystal structure (I41/a), same dipyramidal habit, only the cation differs (W vs Mo). In practice, most natural scheelite contains some Mo, and most natural powellite contains some W. The fluorescence color is the field test: pure scheelite = blue, Mo-bearing = shifts toward yellow-white, pure powellite = bright yellow.

For the simulator: track a single `mo_fraction` parameter per crystal. At mo_fraction ≈ 0 → scheelite behavior (blue SW fluorescence, higher T formation, primary zone). At mo_fraction ≈ 1 → powellite behavior (yellow SW fluorescence, lower T/oxidation zone, supergene). In between → intermediate properties.
