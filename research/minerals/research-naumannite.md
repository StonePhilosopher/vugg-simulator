# Species: Naumannite

## Identity
- **Formula:** Ag₂Se
- **Crystal system:** Orthorhombic (low-T, <133°C); cubic (high-T, >133°C)
- **Mineral group:** Selenide (sulfide subclass)
- **Hardness (Mohs):** 2.5
- **Specific gravity:** 8.0–8.2 (heavy — silver-rich)
- **Cleavage:** Perfect on three planes {100}, {010}, {001} — cubic-like cleavage despite orthorhombic symmetry
- **Fracture:** Sectile
- **Luster:** Metallic

## Color & Appearance
- **Typical color:** Grayish black, iron-black
- **Color causes:** Intrinsic metallic bonding; silver-selenium electronic structure
- **Transparency:** Opaque
- **Streak:** Black
- **Notable visual features:** Massive habit dominates; rarely shows euhedral crystals. Looks almost identical to acanthite (Ag₂S) in hand specimen. Distinguished by microprobe or XRD.

## Crystal Habits
- **Primary habit:** Massive, granular, compact crystalline masses
- **Common forms/faces:** Rarely euhedral; disseminated grains
- **Twin laws:** Not commonly reported
- **Varieties:** None named; complete solid solution not with hessite (different structure) but compositional overlap exists
- **Special morphologies:** Granular aggregates in ore matrix

## Formation Conditions (SIMULATOR PARAMETERS)

### Temperature
- **Nucleation temperature range:** 80–300°C (epithermal)
- **Optimal growth temperature:** 100–200°C
- **Decomposition temperature:** ~897°C (melting)
- **Temperature-dependent habits:** >133°C: cubic phase (high ionic conductivity — 2 S/cm!); <133°C: orthorhombic. The 133°C transition is well-characterized.

### Chemistry Required
- **Required elements in broth:** Ag⁺, Se²⁻
- **Optional/enhancing elements:** Te (partial substitution Se↔Te, grading toward hessite), Au (epithermal gold association), Pb (clausthalite co-precipitation)
- **Inhibiting elements:** High S²⁻ (sulfur outcompetes selenium; acanthite Ag₂S forms preferentially). High S is the main reason naumannite is rare — sulfur usually dominates.
- **Required pH range:** Near-neutral to slightly alkaline (5–8)
- **Required Eh range:** Reducing — selenium reduced from SeO₃²⁻ to Se²⁻
- **Required O₂ range:** Low — hypogene conditions

### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ag and Se from fluid
- **Byproducts of dissolution:** Ag⁺ and SeO₃²⁻ (selenite) released to oxidizing fluids

### Growth Characteristics
- **Relative growth rate:** Slow — selenium is a trace element, even rarer than tellurium in most fluids
- **Maximum crystal size:** Rarely >1 cm; usually microscopic
- **Typical crystal size in vugs:** 0.01–2 mm disseminated grains
- **Does growth rate change with temperature?** Rate limited by Se availability, not temperature
- **Competes with:** Acanthite (Ag₂S — dominant if S present), hessite (Ag₂Te — if Te > Se), clausthalite (PbSe — if Pb >> Ag)

### Stability
- **Breaks down in heat?** Phase transition at 133°C (orthorhombic↔cubic); melts ~897°C
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Dissolves in nitric acid; selenium liberated as selenous acid
- **Oxidizes?** Slowly — Ag⁺ leached, Se oxidizes to selenite/selenate
- **Dehydrates?** N/A
- **Radiation sensitivity:** No

## Paragenesis
- **Forms AFTER:** Primary sulfides, late in paragenetic sequence
- **Forms BEFORE:** Oxidation-zone minerals
- **Commonly associated minerals:** Clausthalite (PbSe), tiemannite (HgSe), umangite (Cu₃Se₂), berzelianite (Cu₂Se), hessite (Ag₂Te), acanthite, native silver, native gold, uraninite, quartz
- **Zone:** Primary/hypogene — low-sulfur hydrothermal deposits, selenide-bearing veins
- **Geological environment:** Low-sulfidation epithermal veins (especially Se-enriched systems), selenide-type deposits, some uranium deposits (selenium associated with U mineralization)

## Famous Localities
- **Classic locality 1:** Harz Mountains, Germany — Clausthalite-naumannite type region; selenide assemblage in low-sulfur hydrothermal veins
- **Classic locality 2:** De Lamar Mine, Owyhee County, Idaho, USA — important silver selenide ores; naumannite as primary silver mineral
- **Classic locality 3:** EarthVPenta, Kamchatka, Russia — epithermal Au-Ag deposit with hessite + naumannite assemblage
- **Notable specimens:** Bukov Mine, Příbram, Czech Republic — well-studied selenide assemblage; Pacajake, Bolivia

## Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)

## Flavor Text

> Naumannite is what happens when silver meets selenium in a world starved of sulfur. It's the rare cousin of acanthite — same silver, same chemistry, but with selenium swapped in. You need a very specific broth: hot enough to mobilize silver, reducing enough to keep selenium as selenide, and critically, *low in sulfur*. Because given a choice, silver will always take sulfur first. Naumannite only crystallizes when sulfur isn't an option. It's the mineral of second chances — beautiful in its scarcity, heavy with unspent silver, waiting in the dark for a fluid that forgot to bring sulfur.

## Simulator Implementation Notes
- **New parameters needed:** trace_Se (already in species list as planned element)
- **New events needed:** `event_selenium_pulse` — rare late-stage enrichment of Se
- **Nucleation rule pseudocode:**
```
IF temp < 300 AND temp > 80 AND trace_Ag > threshold AND trace_Se > threshold AND trace_S < (trace_Se * 3) → nucleate naumannite
```
- **Growth rule pseudocode:**
```
IF trace_Ag > 0 AND trace_Se > 0 AND trace_S < (trace_Se * 3) → grow at rate * min(trace_Ag, trace_Se) * 1.5
RATE = slow (Se-limited)
```
- **Habit selection logic:**
```
IF temp > 133 → cubic habit
IF temp < 133 → orthorhombic habit
Always massive/granular morphology
```
- **Decomposition products:** Ag⁺ to fluid, Se²⁻ oxidizes to SeO₃²⁻ (selenite)

## Variants for Game
- **Variant 1:** Cubic naumannite — formed above 133°C. High ionic conductivity (fun physics detail). Rare.
- **Variant 2:** Orthorhombic naumannite — standard form. Most common.
- **Variant 3:** Te-bearing naumannite — partial Se↔Te substitution. Boundary condition between naumannite and hessite compositions.

## Paragenetic Sequence Note
See research-hessite.md for full sequence description. Naumannite is the selenium analog of hessite's tellurium. Both form in low-sulfur, late-stage hydrothermal fluids. The S:Se:Te ratio of the fluid determines which mineral dominates:
- High S → acanthite (Ag₂S) dominates
- High Te, low S → hessite (Ag₂Te) dominates
- High Se, low S → naumannite (Ag₂Se) dominates
- High Pb + Se → clausthalite (PbSe) dominates
