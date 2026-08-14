# Mineral Species — Rosasite

## Species: Rosasite

### Identity
- **Formula:** (Cu,Zn)₂(CO₃)(OH)₂ — Cu:Zn ratio ~3:2
- **Crystal system:** Monoclinic (2/m)
- **Mineral group:** Carbonate (Rosasite group)
- **Hardness (Mohs):** 4
- **Specific gravity:** 4.0–4.2
- **Cleavage:** Perfect on {100} and {010}
- **Fracture:** Splintery, fibrous
- **Luster:** Silky to vitreous, sometimes dull

### Color & Appearance
- **Typical color:** Blue, bluish green, green — the blue-green of oxidized copper-zinc deposits
- **Color causes:** Cu²⁺ chromophore dominates; Zn content dilutes the blue toward green
- **Transparency:** Translucent
- **Streak:** Light blue or green
- **Notable visual features:** Velvety botryoidal surfaces, radiating fibrous structure visible under magnification. Strong pleochroism (pale emerald green ↔ dark emerald green/blue).

### Crystal Habits
- **Primary habit:** Acicular (needle-like) crystals in radiating fibrous spherical aggregates
- **Common forms/faces:** Botryoidal, mammillary crusts lining cavities
- **Twin laws:** On {100}
- **Varieties:** Nickeloan rosasite (dark green, Ni substituting for Cu/Zn)
- **Special morphologies:** Globular aggregates, encrustations, rarely individual crystals

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 10–40°C (ambient to low hydrothermal)
- **Optimal growth temperature:** 15–30°C (near-surface oxidation zone temperatures)
- **Decomposition temperature:** ~200°C (dehydrates/decomposes; not stable at elevated T)
- **Temperature-dependent habits:** Higher T favors massive/botryoidal; lower T favors delicate acicular sprays

#### Chemistry Required
- **Required elements in broth:** Cu²⁺ (moderate-high), Zn²⁺ (moderate), CO₃²⁻ (moderate)
- **Optional/enhancing elements:** Ni²⁺ (produces nickeloan variety), Co²⁺ (traces)
- **Inhibiting elements:** Fe²⁺ (competes for carbonate, preferentially forms siderite)
- **Required pH range:** 6.5–8.5 (near-neutral to slightly alkaline)
- **Required Eh range:** Oxidizing (+0.2 to +0.6 V) — requires oxidized Cu²⁺
- **Required O₂ range:** High — supergene oxidation zone mineral

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes Cu²⁺, Zn²⁺, CO₃²⁻ from solution
- **Byproducts of nucleation:** Releases H⁺ (consumed by OH⁻ in mineral)
- **Byproducts of dissolution/decomposition:** Dissolves in dilute HCl with effervescence (CO₂ release)

#### Growth Characteristics
- **Relative growth rate:** Moderate — faster than azurite, slower than malachite
- **Maximum crystal size:** Individual needles ~1-2mm; botryoidal masses to several cm
- **Typical crystal size in vugs:** Spherical aggregates 0.5–3 cm
- **Does growth rate change with temperature?** Slightly faster at warmer temperatures (20-30°C)
- **Competes with:** Malachite (competes for Cu²⁺ + CO₃²⁻), aurichalcite (competes for Zn²⁺ + Cu²⁺ + CO₃²⁻), smithsonite (competes for Zn²⁺ + CO₃²⁻)

#### Stability
- **Breaks down in heat?** ~200°C, dehydrates
- **Breaks down in light?** Stable
- **Dissolves in water?** Very slightly soluble; dissolves readily in dilute acids with effervescence
- **Dissolves in acid?** Yes — cold dilute HCl, vigorous CO₂ effervescence
- **Oxidizes?** Already fully oxidized (supergene mineral). Stable in oxidizing conditions.
- **Dehydrates?** At elevated temperatures
- **Radiation sensitivity:** Not documented

### Paragenesis
- **Forms AFTER:** Primary sulfides (chalcopyrite, sphalerite) oxidize → liberates Cu²⁺ + Zn²⁺ into groundwater
- **Forms BEFORE:** May be replaced by malachite or smithsonite as Cu/Zn ratios shift
- **Commonly associated minerals:** Aurichalcite, malachite, azurite, smithsonite, hemimorphite, limonite/goethite, cerussite, galena (remnant primary)
- **Zone:** Supergene/oxidation zone
- **Geological environment:** Oxidized zones of Cu-Zn sulfide deposits; also post-mine formations (mine walls, adits)

### Famous Localities
- **Classic locality 1:** Rosas Mine, Narcao, Sardinia, Italy (type locality, 1908)
- **Classic locality 2:** Mapimi, Durango, Mexico — excellent blue-green botryoidal specimens
- **Classic locality 3:** Tsumeb, Namibia — world-class associations with aurichalcite
- **Notable specimens:** Sharp blue spherical aggregates on limonite matrix from Mapimi are among the most aesthetic

### Fluorescence
- **Fluorescent under UV?** Generally no
- **SW (255nm) color:** None reported
- **MW (310nm) color:** None reported
- **LW (365nm) color:** None reported (some specimens may show weak bluish response from inclusions)
- **Phosphorescent?** No
- **Activator:** None
- **Quenched by:** N/A

### Flavor Text
> Rosasite is the handshake between copper and zinc at the oxidized frontier. When chalcopyrite and sphalerite weather apart in the same rainstorm, their children meet in the zone above — Cu²⁺ and Zn²⁺ swimming through carbonate-rich groundwater, neither element willing to claim the precipitate alone. The result is a mineral that is neither malachite nor smithsonite but something in between: blue-green, fibrous, velvety, always botryoidal, as if the two metals agreed to grow in spheres rather than choose sides. The Rosas mine in Sardinia gave it a name; Mapimi in Mexico gave it its best looks — sky-blue balls on red limonite that look like planets in a rusted solar system. Nickel sneaks in sometimes, turning the green darker, a third voice in the alloy choir.

### Simulator Implementation Notes
- **New parameters needed:** None — uses existing Cu, Zn, CO₃, O₂
- **New events needed:** None
- **Nucleation rule pseudocode:**
```
IF temp < 40 AND temp > 10
  AND trace_Cu > moderate AND trace_Zn > moderate
  AND CO3 > moderate AND pH > 6.5 AND O2 > high
  AND Cu:Zn ratio ~ 3:2 (0.5–2.0 range acceptable)
  → nucleate rosasite (max 2 nuclei)
```
- **Growth rule pseudocode:**
```
IF σ_rosasite > 1.0 AND vug_fill < 1.0
  → grow at moderate rate
  habit = "botryoidal" (default) | "acicular" (if T < 15°C)
```
- **Habit selection logic:** Default botryoidal/mammillary. Low temperature → acicular sprays. High Zn → greener. High Cu → bluer.
- **Decomposition products:** Dissolves → releases Cu²⁺ + Zn²⁺ + CO₃²⁻ back to fluid

### Variants for Game
- **Variant 1:** Standard rosasite — blue-green botryoidal spheres (Cu:Zn ~3:2)
- **Variant 2:** Nickeloan rosasite — darker green (Ni > trace threshold in broth)
- **Variant 3:** Cuprian rosasite — sky blue (Cu:Zn >> 3:2, approaching malachite composition)
