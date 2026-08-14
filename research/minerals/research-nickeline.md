# Mineral Species Research — Nickeline

## Species: Nickeline (Niccolite)

### Identity
- **Formula:** NiAs
- **Crystal system:** Hexagonal
- **Mineral group:** Arsenide
- **Hardness (Mohs):** 5–5.5
- **Specific gravity:** 7.8 (heavy!)
- **Cleavage:** Imperfect on {10Ī0} and {0001}
- **Fracture:** Conchoidal
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Pale copper-red, tarnishes to blackish
- **Color causes:** Intrinsic nickel-arsenide; blackish tarnish from surface oxidation
- **Transparency:** Opaque
- **Streak:** Brownish black
- **Notable visual features:** Strong garlic odor when struck or heated (arsenic volatilization). Distinctive copper-red metallic color unlike most minerals.

### Crystal Habits
- **Primary habit:** Massive columnar to reniform (botryoidal)
- **Common forms/faces:** Rarely as well-formed crystals; when present, {10Ī1}-terminated, horizontally striated, distorted hexagonal prisms
- **Twin laws:** On {10Ī1}, producing fourlings
- **Varieties:** Isomorphous series with breithauptite (NiSb) — antimony substitutes for arsenic
- **Special morphologies:** Massive, reniform, columnar, rarely dendritic

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 200–500°C (hydrothermal to medium-grade metamorphic)
- **Optimal growth temperature:** 300–450°C
- **Decomposition temperature:** Melting point ~967°C; stable up to high T
- **Temperature-dependent habits:** Massive at all temperatures; crystal formation rarer at low T

#### Chemistry Required
- **Required elements in broth:** Ni (>40 ppm), As (>40 ppm)
- **Optional/enhancing elements:** Sb (forms breithauptite substitution), Co (substitutes for Ni), Fe (trace), S (small amounts — complete solid solution with millerite not possible but S-bearing nickeline exists)
- **Inhibiting elements:** Excess S promotes millerite instead; Cu diverts Ni into sulfide assemblages
- **Required pH range:** Near-neutral to slightly acidic
- **Required Eh range:** Reducing (arsenide stability requires low oxygen)
- **Required O₂ range:** Very low — arsenide unstable under oxidizing conditions

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No significant release
- **Byproducts of nucleation:** None notable
- **Byproducts of dissolution/decomposition:** Arsenic release on oxidation (toxic!); forms annabergite Ni₃(AsO₄)₂·8H₂O

#### Growth Characteristics
- **Relative growth rate:** Moderate to slow
- **Maximum crystal size:** Rarely crystallizes well; massive aggregates up to meters in ore bodies
- **Typical crystal size in vugs:** Massive crusts, 1–50 mm
- **Does growth rate change with temperature?** No retrograde behavior known
- **Competes with:** Millerite (NiS, sulfur-rich systems), cobaltite (CoAsS, Co competition), skutterudite (Co,Ni)As₃

#### Stability
- **Breaks down in heat?** No — stable to melting at ~967°C. Emits garlic odor (arsenic vapor) when heated strongly.
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Slowly in HNO₃ (releases arsenic); resistant to HCl
- **Oxidizes?** Yes — tarnishes black quickly; prolonged oxidation → annabergite (pink Ni arsenate) + scorodite (Fe arsenate if Fe present). This is the arsenic source for secondary arsenate mineralization.
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** None known

### Paragenesis
- **Forms AFTER:** Primary Ni-Fe sulfides (pentlandite); olivine breakdown in ultramafics
- **Forms BEFORE:** Annabergite, erythrite (if Co present) in oxidation zone; breithauptite if Sb available
- **Commonly associated minerals:** Millerite, cobaltite, skutterudite, native silver, native bismuth, calcite, quartz, niccolite-breithauptite series
- **Zone:** Primary/hypogene (hydrothermal veins, metamorphic)
- **Geological environment:** Hydrothermal veins in ultramafic rocks, Ni-Co-Ag arsenide vein deposits (Cobalt, Ontario type), metamorphic serpentinites

### Famous Localities
- **Cobalt, Ontario, Canada:** World-class Ni-Ag arsenide vein district. Nickeline with native silver, skutterudite, cobaltite.
- **Freiberg, Saxony, Germany:** Ore Mountains, historical type concept locality
- **Jáchymov (Joachimsthal), Czech Republic:** Classic arsenide vein deposit
- **Notable specimens:** Cobalt district specimens show massive copper-red nickeline veined with native silver — among the most valuable ore specimens

### Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> The mineral that gave nickel its name. Medieval miners in the Ore Mountains found this copper-red ore, smelted it expecting copper, and got nothing but sickness and a garlic stench instead. They blamed Nickel — a mischievous sprite, a.k.a. Old Nick himself. "Kupfernickel": the copper that bewitches. In 1751, Cronstedt finally extracted the white metal hiding inside and named it after the sprite. So the element nickel is named after a goblin, which is named after the Devil, which is named after a mineral that smells like garlic when you hit it with a hammer. Geology's naming conventions have always been deeply unserious. In the oxidation zone, nickeline's arsenic feeds the rainbow — annabergite's pink, erythrite's crimson, all downstream of this unassuming copper-red stone.

### Simulator Implementation Notes
- **New parameters needed:** trace_Ni and trace_As already in species list; trace_Sb optional for breithauptite variant
- **New events needed:** Arsenic release event on nickeline oxidation (feeds annabergite/erythrite nucleation)
- **Nucleation rule pseudocode:**
```
IF trace_Ni > 40 AND trace_As > 40 AND Eh < -0.2 AND T < 500 AND trace_S < 60 (or millerite dominates)
  → nucleate nickeline (max 3)
```
- **Growth rule pseudocode:**
```
IF σ_nickeline > 1.0 → grow as massive crust
  rate = moderate, proportional to min(Ni, As)
```
- **Habit selection logic:** Always massive/reniform. Twinning produces fourlings rarely (easter egg for collectors).
- **Decomposition products:** Oxidation → annabergite Ni₃(AsO₄)₂·8H₂O (pink secondary) + arsenic acid in solution (feeds other arsenate minerals)

### Variants for Game
- **Variant 1: Massive copper-red** — default, reniform crusts on vug walls
- **Variant 2: Breithauptite zone** — if Sb present, edges grade into NiSb (antimonian nickeline), tin-white to copper-red color shift
- **Variant 3: Silver-bearing** — if Ag present, native silver inclusions in nickeline matrix (Cobalt-type assemblage)

### Paragenetic Sequence: Nickel-Arsenic Minerals
Nickeline anchors the **Ni-As hydrothermal/metamorphic sequence**:
- Primary: nickeline (NiAs) + millerite (NiS) form together in low-S ultramafic systems
- With Co: cobaltite (CoAsS) and skutterudite (Co,Ni)As₃ compete for As
- Oxidation zone: nickeline → annabergite Ni₃(AsO₄)₂·8H₂O (pink)
- With Sb: breithauptite (NiSb) solid solution
- The garlic odor (arsenic) is this mineral's signature — and its warning
- See also: `memory/research-millerite.md`
