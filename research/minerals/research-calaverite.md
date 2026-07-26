# Mineral Species Template — Vugg Simulator

## Species: Calaverite

### Identity
- **Formula:** AuTe₂ (with ~3% Ag substituting for Au)
- **Crystal system:** Monoclinic
- **Mineral group:** Telluride
- **Hardness (Mohs):** 2.5–3
- **Specific gravity:** 9.1–9.35 (extremely dense — gold-heavy)
- **Cleavage:** None
- **Fracture:** Uneven to subconchoidal
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Brass yellow to silver-white
- **Color causes:** Metallic gold-tellurium bonding; silver content lightens color toward white
- **Transparency:** Opaque
- **Streak:** Green to yellow-grey
- **Notable visual features:** Incommensurately modulated crystal structure — defied Haüy's Law of Rational Indices for decades. The crystal faces couldn't be indexed with simple lattice parameters. This is genuinely weird physics: the Te atoms are displaced in a wave pattern that doesn't repeat at a rational fraction of the unit cell.

### Crystal Habits
- **Primary habit:** Bladed, slender striated prisms
- **Common forms/faces:** Elongated along b-axis, striated longitudinally. 92 crystal forms documented by Goldschmidt.
- **Twin laws:** Common on {110}
- **Varieties:** Ag-bearing calaverite grades toward sylvanite composition as Ag increases
- **Special morphologies:** Massive granular, rarely well-crystallized

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 150–400°C
- **Optimal growth temperature:** 200–350°C (epithermal to mesothermal)
- **Decomposition temperature:** ~450°C (breaks down to native gold + tellurium)
- **Temperature-dependent habits:** Higher T favors bladed crystals; lower T favors granular/massive

#### Chemistry Required
- **Required elements in broth:** Au (ppm-level), Te (ppm-level)
- **Optional/enhancing elements:** Ag (substitutes for Au, up to ~3%), S (associated sulfides)
- **Inhibiting elements:** Excess S can preferentially form sulfides over tellurides
- **Required pH range:** Near-neutral to slightly acidic (4–7)
- **Required Eh range:** Reducing to mildly oxidizing — tellurium must be available as Te²⁻
- **Required O₂ range:** Low — epithermal reducing conditions

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No significant release
- **Byproducts of dissolution/decomposition:** Native gold + tellurium species; in hot H₂SO₄ → spongy gold mass + red Te solution

#### Growth Characteristics
- **Relative growth rate:** Slow — rare mineral requiring precise Te availability
- **Maximum crystal size:** Up to ~1 cm blades
- **Typical crystal size in vugs:** mm-scale blades
- **Does growth rate change with temperature?** Moderate; faster at optimal 250–350°C
- **Competes with:** Sylvanite (if Ag abundant), krennerite (orthorhombic AuTe₂ polymorph), native gold, hessite (Ag₂Te), native tellurium

#### Stability
- **Breaks down in heat?** ~450°C → native gold + tellurium vapor/species
- **Breaks down in light?** No (unlike sylvanite)
- **Dissolves in water?** No
- **Dissolves in acid?** Hot concentrated H₂SO₄ — dissolves leaving spongy gold
- **Oxidizes?** Slowly — can develop surface tarnish; full oxidation → native gold liberation + tellurite/tellurate
- **Dehydrates?** No
- **Radiation sensitivity:** None documented

### Paragenesis
- **Forms AFTER:** Quartz, pyrite, fluorite (early vein minerals)
- **Forms BEFORE:** Native gold (liberated on oxidation), tellurium oxides
- **Commonly associated minerals:** Sylvanite, krennerite, hessite, native gold, native tellurium, quartz, fluorite, pyrite, rhodochrosite, acanthite, nagyágite, coloradoite (HgTe)
- **Zone:** Primary/hypogene — hydrothermal vein telluride stage
- **Geological environment:** Epithermal to mesothermal gold-telluride veins in alkaline volcanic settings; also magmatic-hydrothermal systems

### Famous Localities
- **Classic locality 1:** Cripple Creek, Colorado — the world's premier gold telluride district
- **Classic locality 2:** Kalgoorlie, Western Australia — triggered the 1890s gold rush
- **Classic locality 3:** Kirkland Lake, Ontario, Canada
- **Notable specimens:** Cresson Mine, Cripple Creek — crystals to 9 mm; Sacarîmb (Nagyág), Romania

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Calaverite is the mineral that broke crystallography. For decades its faces refused to index — the laws of rational indices simply didn't apply. The reason: an incommensurate modulation wave rippling through the tellurium positions, driven by gold atoms fluctuating between Au⁺ and Au³⁺. The crystal is arguing with itself about what charge gold should be, and the result is a structure that never quite repeats. It's also, incidentally, one of the most important gold ores on Earth. Cripple Creek was built on calaverite. The gold is hiding in the tellurium — invisible to the naked eye, locked in a crystal that can't make up its mind.

### Simulator Implementation Notes
- **New parameters needed:** trace_Au (gold), trace_Te already exists (native tellurium research). Need Au in broth.
- **New events needed:** `event_gold_telluride_pulse` — Te + Au concentrated by magmatic-hydrothermal phase
- **Nucleation rule pseudocode:**
```
IF trace_Au > 0.1 ppm AND trace_Te > 1 ppm AND T < 400°C AND T > 150°C → nucleate calaverite
IF trace_Ag > trace_Au * 0.3 → prefer sylvanite instead
```
- **Growth rule pseudocode:**
```
IF trace_Au > 0.05 AND trace_Te > 0.5 AND 200°C < T < 350°C → grow at rate 2 (slow)
```
- **Habit selection logic:** T > 300°C → bladed prisms; T < 250°C → granular/massive
- **Decomposition products:** T > 450°C → native gold + Te release; oxidation → native gold liberation

### Variants for Game
- **Variant 1:** Silver-rich calaverite — higher Ag content, lighter silver-white color, transitional toward sylvanite
- **Variant 2:** Massive calaverite — granular aggregates, no visible crystal form, common at Cripple Creek
- **Variant 3:** Bladed calaverite — striated elongated prisms, the classic crystal habit

### Paragenetic Sequence Note
Calaverite is part of the **gold telluride paragenesis** with sylvanite (Au,Ag)Te₂, krennerite (orthorhombic AuTe₂), hessite (Ag₂Te), petzite (Ag₃AuTe₂), and native tellurium. All form in the same epithermal telluride stage. The Au:Ag ratio and temperature determine which dominates:
- **High Au, low Ag, higher T** → calaverite
- **Moderate Au + Ag, moderate T** → sylvanite  
- **High Ag** → hessite, petzite
- **Excess Te** → native tellurium
- **Orthorhombic structural variant** → krennerite (less common)
