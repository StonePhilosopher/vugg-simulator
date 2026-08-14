# Research: Wulfenite — PbMoO₄

## Species: Wulfenite

### Identity
- **Formula:** PbMoO₄
- **Crystal system:** Tetragonal
- **Mineral group:** Molybdate
- **Hardness (Mohs):** 2.75–3
- **Specific gravity:** 6.5–7.0 (very heavy for a non-sulfide — Pb content)
- **Cleavage:** Distinct on {011}; indistinct on {001}, {013}
- **Fracture:** Irregular to sub-conchoidal
- **Luster:** Adamantine to resinous — one of the brightest non-metallic lusters

### Color & Appearance
- **Typical color:** Orange-yellow, honey-yellow, reddish-orange. Rarely colorless, grey, brown, olive-green, black.
- **Color causes:** Charge transfer in MoO₄²⁻ group. Chromium impurities can deepen red color. Pb-Mo charge transfer bands.
- **Transparency:** Transparent to opaque (thin crystals transparent, thick ones translucent-opaque)
- **Streak:** White
- **Notable visual features:** Exceptional adamantine luster (like diamond). Thin tabular crystals are sometimes so thin they're nearly 2D — like stained glass windows made of amber. Refractive index extremely high (nω = 2.405). Some specimens piezoelectric.

### Crystal Habits
- **Primary habit:** Thin tabular {001} — the classic "wulfenite square"
- **Common forms/faces:** Tetragonal dipyramids, {001} pinacoid dominant. Also stubby pyramidal at some localities.
- **Twin laws:** {001} contact twins, common
- **Varieties:** 
  - "Yellow lead ore" (yellow form, historical name)
  - Thin tabular (Red Cloud Mine type) vs thick tabular (Los Lamentos type) — locality-driven habit differences
- **Special morphologies:** Rarely earthy or granular masses. Usually distinct crystals.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** <80°C (supergene/oxidation zone)
- **Optimal growth temperature:** 20–60°C
- **Decomposition temperature:** ~1065°C (melts incongruently)
- **Temperature-dependent habits:** Lower temps → thinner tabular; higher temps (still <80°C) → thicker, more pyramidal

#### Chemistry Required
- **Required elements in broth:** Pb²⁺ (from galena oxidation), MoO₄²⁻ (from molybdenite oxidation)
- **Optional/enhancing elements:** Cr (deepens red color), W (substitutes for Mo — forms wulfenite-stolzite series)
- **Inhibiting elements:** High Cl⁻ (favors pyromorphite/mimetite over wulfenite), high PO₄³⁻ (favors pyromorphite), high AsO₄³⁻ (favors mimetite), high VO₄³⁻ (favors vanadinite). Wulfenite LOSES the competition for Pb in phosphate/arsenate/vanadate-rich fluids.
- **Required pH range:** Near-neutral to slightly alkaline (6–9)
- **Required Eh range:** Oxidizing (high Eh)
- **Required O₂ range:** High — requires fully oxidized Pb²⁺ and Mo⁶⁺

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Removes Pb²⁺ and MoO₄²⁻ from solution
- **Byproducts of dissolution:** Very low solubility — stable in oxidation zone. Dissolves slowly in strong acids.

#### Growth Characteristics
- **Relative growth rate:** Slow to moderate
- **Maximum crystal size:** Up to 30 cm across (Los Lamentos) — among the largest single crystals of any secondary mineral
- **Typical crystal size in vugs:** 0.5–5 cm tabular crystals
- **Does growth rate change with temperature?** Moderate — grows faster in warm supergene conditions
- **Competes with:** Pyromorphite (Pb + PO₄), mimetite (Pb + AsO₄), vanadinite (Pb + VO₄), cerussite (Pb + CO₃), anglesite (Pb + SO₄). Wulfenite needs the MoO₄²⁻/Pb ratio to be favorable.

#### Stability
- **Breaks down in heat?** Melts ~1065°C
- **Breaks down in light?** No
- **Dissolves in water?** Practically insoluble (Ksp ~10⁻³⁰)
- **Dissolves in acid?** Slowly in HNO₃ and HCl
- **Oxidizes?** Already fully oxidized — terminal species in the Mo oxidation sequence
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Molybdenite (must oxidize first to provide MoO₄²⁻), Galena (must oxidize first to provide Pb²⁺)
- **Forms BEFORE:** May be partially replaced by pyromorphite if phosphate-rich fluids arrive later
- **Commonly associated minerals:** Cerussite, anglesite, pyromorphite, mimetite, vanadinite, descloizite, plattnerite, hemimorphite, smithsonite, iron/manganese oxides
- **Zone:** Supergene/oxidation zone — near-surface weathering of lead deposits
- **Geological environment:** Oxidized zones of hydrothermal Pb-Mo deposits, lead deposits with Mo-bearing intrusions nearby

### Famous Localities
- **Red Cloud Mine, La Paz County, Arizona** — deep red-orange, thin tabular, world-class. Arizona state mineral (2017).
- **Los Lamentos, Chihuahua, Mexico** — thick tabular orange crystals, some largest known
- **Bleiberg (Bad Bleiberg), Carinthia, Austria** — type locality (1845)
- **Mount Peca, Slovenia** — yellow crystals with well-developed bipyramids, depicted on Slovenian postage stamp (1997)
- **Tsumeb, Namibia** — rare olive-green and black crystals (Cr/V substitution?)
- **Notable specimens:** 30+ cm crystals from Los Lamentos; Red Cloud crystals considered among most beautiful minerals on Earth

### Fluorescence
- **Fluorescent under UV?** Generally no
- **Activator:** N/A — the high Pb content typically quenches any fluorescence

### Flavor Text

> Wulfenite is what happens when two primary sulfides — galena and molybdenite — meet their end in the same oxidizing groundwater. The lead from one and the molybdenum from the other combine into paper-thin amber windows with a luster that rivals diamond. Red Cloud Mine crystals are collector holy grails: orange squares so vivid they look like someone pressed stained glass into rock. It's a mineral that demands two parents and won't compromise on aesthetics.

### Simulator Implementation Notes
- **New parameters needed:** None (trace_Mo and trace_Pb already exist; MoO₄²⁻ tracked via oxidation state)
- **Nucleation rule pseudocode:**
```
IF temp < 80 AND Pb_available AND MoO4_available AND Eh > oxidizing_threshold AND Cl < threshold → nucleate wulfenite
MAX 4 nuclei per vug
```
- **Growth rule pseudocode:**
```
IF Pb_available AND MoO4_available AND temp < 80 → grow at rate 2 (slow)
Compete with pyromorphite/mimetite/vanadinite for Pb — if PO₄/AsO₄/VO₄ present, those win
```
- **Habit selection logic:** If MoO₄ >> Pb → thin tabular (classic squares). If Pb >> MoO₄ → thicker, more pyramidal.
- **Decomposition products:** Stable. Very low solubility.

### Variants for Game
- **Variant 1: Red Cloud type** — thin tabular, deep red-orange, adamantine luster. Requires Mo-rich, moderate Pb.
- **Variant 2: Los Lamentos type** — thick tabular, bright orange-yellow. Requires sustained Mo+Pb supply over long period.
- **Variant 3: Tsumeb type** — olive-green to black. Requires Cr or V impurities in MoO₄ site.

---

## Paragenetic Note
Wulfenite is the crown jewel of the molybdenum oxidation sequence. It requires BOTH molybdenite AND galena to oxidize — a two-source mineral that only appears when the chemistry of two different primary ore bodies converges in the groundwater. This makes it rare in nature and should be difficult (but rewarding) to form in the simulator.
