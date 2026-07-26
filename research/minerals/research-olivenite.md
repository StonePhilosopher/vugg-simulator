# Mineral Species Template — Vugg Simulator

## Species: Olivenite

### Identity
- **Formula:** Cu₂(AsO₄)(OH)
- **Crystal system:** Monoclinic (pseudo-orthorhombic, β ≈ 90°), space group P2₁/n
- **Mineral group:** Arsenate (olivenite group; adamite-olivenite series; libethenite-olivenite series)
- **Hardness (Mohs):** 3
- **Specific gravity:** 3.9–4.4
- **Cleavage:** {110} imperfect, {100} poor
- **Fracture:** Conchoidal to uneven
- **Luster:** Adamantine to vitreous, silky in fibrous varieties

### Color & Appearance
- **Typical color:** Olive-green to pistachio green, brownish green, yellowish, greyish-white, colourless
- **Color causes:** Copper (Cu²⁺) as chromophore; olive-green from Cu-As charge transfer
- **Transparency:** Translucent to opaque; thin crystals can be transparent
- **Streak:** Olive-green to brownish
- **Notable visual features:** Fibrous varieties show silky luster; small crystals can be adamantine. Pseudo-orthorhombic symmetry makes twinning common and angles deceptively close to 90°.

### Crystal Habits
- **Primary habit:** Prismatic to acicular crystals elongated along [001]
- **Common forms/faces:** {110}, {101}, {010}, {001}
- **Twin laws:** Common on {100}, producing pseudo-orthorhombic appearance
- **Varieties:**
  - Fibrous olivenite — silky mats and crusts
  - Massive olivenite — dense, granular
  - Zincolivenite — Zn-bearing intermediate between olivenite and adamite
- **Special morphologies:** Acicular sprays, radiating fibrous aggregates, botryoidal crusts, drusy coatings

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Forms at low temperatures in the supergene oxidation zone, typically <50°C, down to ambient
- **Optimal growth temperature:** Near-surface conditions, 10–40°C
- **Decomposition temperature:** ~200°C — undergoes monoclinic → orthorhombic phase transition; structurally unstable above this
- **Temperature-dependent habits:** Lower temps favour acicular/fibrous; warmer conditions may produce stouter prisms

#### Chemistry Required
- **Required elements in broth:** Cu (primary), As (from arsenide oxidation), O₂ (oxidizing conditions)
- **Optional/enhancing elements:** Zn (forms zincolivenite solid solution), P (competes with As for Cu)
- **Inhibiting elements:** High Fe³⁺ (competes for arsenate), high carbonate (Cu precipitates as malachite/azurite instead)
- **Required pH range:** Slightly acidic to neutral (pH 4–7); arsenic acid (H₃AsO₄) available
- **Required Eh range:** Oxidizing — supergene environment where primary arsenides (arsenopyrite, tennantite, enargite) have broken down
- **Required O₂ range:** High — requires fully oxidized arsenic (As⁵⁺ as arsenate)

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** Consumes H⁺ from acidic oxidation-zone solutions, slightly raising local pH
- **Byproducts of nucleation:** OH⁻ incorporated into structure
- **Byproducts of dissolution:** Releases Cu²⁺ and AsO₄³⁻ back to solution; can feed later mimetite if Pb is present

#### Growth Characteristics
- **Relative growth rate:** Moderate — faster than adamite (which needs Zn), slower than limonite/goethite masses
- **Maximum crystal size:** Crystals to ~5 cm known from Tsumeb; typically mm-scale
- **Typical crystal size in vugs:** 1–15 mm
- **Does growth rate change with temperature?** Minimal (low-T mineral)
- **Competes with:** Adamite (if Zn present), libethenite (if P >> As), clinoclase, malachite/azurite (if carbonate available), mimetite (if Pb present)

#### Stability
- **Breaks down in heat?** Yes — phase transition at ~200°C (monoclinic → orthorhombic, becomes isostructural with libethenite group)
- **Breaks down in light?** Not photosensitive
- **Dissolves in water?** Low solubility in neutral water; increases in acidic conditions
- **Dissolves in acid?** Yes — dissolves readily in HCl and HNO₃
- **Oxidizes?** Already fully oxidized (Cu²⁺, As⁵⁺) — end-member of the copper arsenide oxidation sequence
- **Dehydrates?** No (only one OH in formula)
- **Radiation sensitivity:** Not documented

### Paragenesis
- **Forms AFTER:** Arsenopyrite, tennantite, enargite, luzonite (primary arsenic-bearing sulfides must oxidize first to release As)
- **Forms BEFORE:** Mimetite (if Pb arrives later), cerussite, secondary carbonates
- **Commonly associated minerals:** Malachite, azurite, libethenite, clinoclase, adamite, agardite, limonite/goethite, cuprite, native copper, pharmacholite, scorodite
- **Zone:** Supergene oxidation zone — the arsenic-rich equivalent of where malachite forms in carbonate-rich systems
- **Geological environment:** Oxidized zones of hydrothermal copper-arsenic deposits

### Famous Localities
- **Tsumeb, Namibia** — world's finest olivenite crystals; sharp prismatic to acicular, vivid green, associated with adamite and agardite
- **Cornwall, England** (St Day, Redruth, Carn Brea) — classic locality, fibrous and massive forms in copper-arsenic vein deposits
- **Majuba Hill, Nevada, USA** — well-formed crystals
- **Tintic District, Utah, USA** — crystallized specimens
- **Cap Garonne, France** — olivenite with adamite, green to brown crystals
- **Lavrion, Greece** — prismatic crystals
- **Notable specimens:** Tsumeb produced crystals to several cm, some of the finest arsenate specimens known

### Fluorescence
- **Fluorescent under UV?** Generally non-fluorescent
- **SW (255nm) color:** None reported
- **MW (310nm) color:** None reported
- **LW (365nm) color:** None reported
- **Phosphorescent?** No
- **Activator:** None typical; Cu²⁺ quenches fluorescence
- **Quenched by:** Cu²⁺ is inherently non-fluorescent (d-electron transitions are non-radiative)

### Flavor Text

> Olivenite is what happens when arsenopyrite dreams of the surface. Deep in the primary zone, arsenic locked in sulfide matrices — patient, reduced, waiting. Then groundwater arrives with oxygen, and the slow combustion begins. Arsenic oxidizes to arsenate, copper mobilizes as Cu²⁺, and where they meet in the oxidation zone's acidic soup, olivenite crystallizes: olive-green, adamantine, the most common copper arsenate in the supergene. It forms the same way malachite does in carbonate systems — but here the anion is arsenate, not carbonate, and the color runs to pistachio instead of emerald. At Tsumeb, where the ore body held everything, olivenite grew as sharp prismatic spikes and fibrous radiating mats alongside its zinc cousin adamite, the two sometimes blending into zincolivenite where their chemistries overlapped. It's a terminal phase — fully oxidized, nowhere left to go. The oxidation zone's last word on copper and arsenic, spoken in green.

### Simulator Implementation Notes
- **New parameters needed:** None — uses existing Cu, As, O₂, pH, Eh; Zn for zincolivenite variant
- **New events needed:** None (forms through standard supersaturation)
- **Nucleation rule pseudocode:**
```
IF temp < 80°C AND Eh > 0.4 (oxidizing) AND pH 4-7
  AND sigma_olivenite > 1.0
  AND arsenide_oxidation_released_Cu AND arsenide_oxidation_released_As
→ nucleate olivenite (max 6 crystals)
```
- **Growth rule pseudocode:**
```
IF sigma_olivenite > 0
  AND Cu_available > 0 AND As_available > 0
  AND O2 > 0.3
→ grow at rate 4 (moderate)
  Zn_fraction > 0.3 → variant = zincolivenite
```
- **Habit selection logic:**
```
IF growth_rate > threshold → fibrous/acicular
IF Zn > 0 → zincolivenite coloring
ELSE → prismatic to massive
```
- **Decomposition products:** At >200°C → structural collapse, releases Cu²⁺ + AsO₄³⁻ back to fluid

### Variants for Game
- **Variant 1: Fibrous Olivenite** — silky radiating mats, forms when Cu supply is steady but low, common in Cornwall-type deposits
- **Variant 2: Zincolivenite** — Zn-bearing intermediate toward adamite; paler green to yellowish; requires both Cu and Zn in broth
- **Variant 3: Prismatic Olivenite** — sharp, stout crystals; Tsumeb-type; requires high supersaturation pulse
