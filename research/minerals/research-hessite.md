# Species: Hessite

## Identity
- **Formula:** Ag₂Te
- **Crystal system:** Monoclinic (low-T, <155°C); cubic (high-T, >155°C)
- **Mineral group:** Telluride (sulfide subclass)
- **Hardness (Mohs):** 2–3
- **Specific gravity:** 8.24–8.45 (very heavy — silver-rich)
- **Cleavage:** Indistinct on {100}
- **Fracture:** Sectile (can be cut with a knife)
- **Luster:** Metallic

## Color & Appearance
- **Typical color:** Lead-gray, steel-gray
- **Color causes:** Intrinsic metallic bonding; silver-tellurium electronic structure
- **Transparency:** Opaque
- **Streak:** Black
- **Notable visual features:** Pseudocubic crystals (appear cubic from high-T phase), often distorted and irregularly developed. Phase transformation lamellae visible under microscope — relics of the cubic→monoclinic transition at 155°C. Massive and fine-grained habits more common than euhedral crystals.

## Crystal Habits
- **Primary habit:** Massive, compact, fine-grained aggregates
- **Common forms/faces:** Pseudocubic, highly modified and irregular crystals to 1.7 cm
- **Twin laws:** Not commonly twinned
- **Varieties:** None named; solid solution with stützite (Ag₇Te₄) and empressite (AgTe) at boundaries
- **Special morphologies:** Granular masses, compact disseminations in ore

## Formation Conditions (SIMULATOR PARAMETERS)

### Temperature
- **Nucleation temperature range:** 100–350°C (epithermal to mesothermal)
- **Optimal growth temperature:** 150–250°C (low-sulfidation epithermal sweet spot)
- **Decomposition temperature:** ~960°C (melting)
- **Temperature-dependent habits:** >155°C: cubic crystals; <155°C: monoclinic with phase-transformation lamellae. The cubic→monoclinic transition is a game-readable texture indicator.

### Chemistry Required
- **Required elements in broth:** Ag⁺, Te²⁻ (both needed simultaneously)
- **Optional/enhancing elements:** Au (associated gold-telluride deposits), Pb (altaite co-precipitation), Cu (petzite CuAg₃Te₂), Se (partial substitution Te↔Se, hessite-naumannite boundary)
- **Inhibiting elements:** High S²⁻ (sulfur outcompetes tellurium; acanthite Ag₂S forms preferentially over hessite if both S and Te available)
- **Required pH range:** Near-neutral to slightly alkaline (5–8)
- **Required Eh range:** Low to moderately reducing (tellurium is chalcophile, not oxyphile)
- **Required O₂ range:** Low — hypogene/reducing conditions

### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ag and Te from fluid; may locally deplete fluid in precious metals
- **Byproducts of dissolution:** Ag⁺ and TeO₃²⁻ (tellurite) released to oxidizing fluids; Te can form tellurium oxides

### Growth Characteristics
- **Relative growth rate:** Slow — tellurium is a trace element, limited supply
- **Maximum crystal size:** ~1.7 cm (rare)
- **Typical crystal size in vugs:** 0.1–5 mm disseminated grains
- **Does growth rate change with temperature?** Minimal dependence; rate limited by Te availability
- **Competes with:** Acanthite (Ag₂S — wins if S>>Te), native silver (if Te depleted), stützite (Ag₇Te₄ — at different Ag:Te ratios), petzite (if Cu present)

### Stability
- **Breaks down in heat?** Phase transition at 155°C (cubic↔monoclinic); melts ~960°C
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Dissolves in nitric acid; HNO₃ liberates tellurium
- **Oxidizes?** Slowly in surface conditions — Ag⁺ leached, Te oxidizes to tellurite/tellurate
- **Dehydrates?** N/A (no water)
- **Radiation sensitivity:** No significant effect

## Paragenesis
- **Forms AFTER:** Primary sulfides (pyrite, galena, sphalerite) — tellurides are typically late-stage
- **Forms BEFORE:** Native gold/tellurium remobilization during oxidation
- **Commonly associated minerals:** Native gold, petzite (CuAg₃Te₂), altaite (PbTe), calaverite (AuTe₂), sylvanite (AuAgTe₄), native tellurium, acanthite, naumannite (in Se-bearing systems), pyrite, quartz, fluorite, adularia
- **Zone:** Primary/hypogene — late-stage hydrothermal, epithermal veins
- **Geological environment:** Low-sulfidation epithermal veins (adularia-sericite type), high-sulfidation veins, some mesothermal gold deposits, volcanic-hosted precious metal deposits

## Famous Localities
- **Classic locality 1:** Cripple Creek, Colorado, USA — type area for telluride gold deposits; hessite with calaverite and native gold
- **Classic locality 2:** Sacarîmb (Nagyág), Romania — classic telluride deposit, hessite with sylvanite and nagyágite
- **Classic locality 3:** Kalgoorlie, Western Australia — Golden Mile telluride-gold ores
- **Notable specimens:** Zod (Vayk-Sisian deposit), Armenia — well-crystallized hessite; Kochbulak, Uzbekistan — hessite with unusual crystal forms; Evevpenta, Kamchatka — hessite + naumannite assemblage

## Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A (metallic mineral, opaque)

## Flavor Text

> Hessite is the quiet rich one — silver and tellurium holding hands where the vein goes cold. It hides in the late fluids, after the pyrite party, after the quartz has mostly crystallized, when the broth is down to trace elements and stubbornness. At 155°C it snaps from cubic to monoclinic, a phase transition that writes itself into the crystal as fine lamellae — a ghost of the hotter world it came from. Most miners never see it. It's small, gray, and looks like galena's boring cousin. But crack the right vein and hessite means you're in the tellurium zone, and the tellurium zone means gold.

## Simulator Implementation Notes
- **New parameters needed:** trace_Te (already planned in species list), trace_Se (already planned)
- **New events needed:** `event_tellurium_pulse` — late-stage enrichment event for Te-bearing fluids
- **Nucleation rule pseudocode:**
```
IF temp < 350 AND temp > 80 AND trace_Ag > threshold AND trace_Te > threshold AND trace_S < (trace_Te * 5) → nucleate hessite
```
- **Growth rule pseudocode:**
```
IF trace_Ag > 0 AND trace_Te > 0 AND temp < 350 → grow at rate * min(trace_Ag, trace_Te) * 2
RATE = slow (Te-limited, factor 2)
```
- **Habit selection logic:**
```
IF temp > 155 → cubic habit (pseudo-isometric)
IF temp < 155 → monoclinic habit + phase lamellae texture flag
```
- **Decomposition products:** Ag⁺ to fluid, Te²⁻ oxidizes to TeO₃²⁻ (tellurite)

## Variants for Game
- **Variant 1:** High-T cubic hessite — formed above 155°C, shows cubic symmetry. Rare in-game because epithermal sweet spot is often below 155°C. Collector's specimen.
- **Variant 2:** Lamellar hessite — cooled through 155°C, retains transformation twins. Most common form. Texture flag: "phase transformation lamellae visible."
- **Variant 3:** Se-bearing hessite — partial Te↔Se substitution, transitional toward naumannite composition. Occurs when both Te and Se present.

## Paragenetic Sequence Note
Hessite forms in the **telluride-selenide zone** alongside:
- **Naumannite** (Ag₂Se) — same structure, Se instead of Te; forms in identical conditions when Se > Te
- **Clausthalite** (PbSe) — Pb analog, co-precipitates from Pb + Se enriched fluids
- **Native tellurium** — appears when Te exceeds metal supply
- **Altaite** (PbTe) — if Pb also available (not yet in species list)

All share: low-T hydrothermal, reducing conditions, late-stage fluids, precious metal association. In the simulator, they should nucleate from the same cooling pulse, with the Te/Se ratio determining which dominates.
