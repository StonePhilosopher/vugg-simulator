# Mineral Species Template — Vugg Simulator

## Species: Sylvanite

### Identity
- **Formula:** (Ag,Au)Te₂ — Au:Ag ratio typically 1:1 to 3:1
- **Crystal system:** Monoclinic (2/m)
- **Mineral group:** Telluride
- **Hardness (Mohs):** 1.5–2 (very soft)
- **Specific gravity:** 8.0–8.2
- **Cleavage:** Perfect on {010}
- **Fracture:** Uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Silver-grey to silver-white, steel grey
- **Color causes:** Metallic Ag-Au-Te bonding; silver content produces the lighter color
- **Transparency:** Opaque
- **Streak:** Steel grey
- **Notable visual features:** Photosensitive — darkens/tarnishes on exposure to bright light. The most common gold telluride.

### Crystal Habits
- **Primary habit:** Bladed, prismatic to bladed crystals; often massive to granular
- **Common forms/faces:** Elongated prismatic, often striated
- **Twin laws:** Common, cyclic twins
- **Varieties:** Ag-rich sylvanite grades toward hessite composition
- **Special morphologies:** Massive granular, rarely well-crystallized; bladed aggregates

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 100–350°C
- **Optimal growth temperature:** 150–300°C (low-to-moderate temperature epithermal)
- **Decomposition temperature:** ~350–400°C (lower than calaverite)
- **Temperature-dependent habits:** Higher T → bladed crystals; lower T → granular

#### Chemistry Required
- **Required elements in broth:** Au (ppm-level), Ag (significant — comparable to Au), Te (ppm-level)
- **Optional/enhancing elements:** S (associated sulfides)
- **Inhibiting elements:** Very high Au with very low Ag → calaverite instead
- **Required pH range:** Near-neutral to slightly acidic (4–7)
- **Required Eh range:** Reducing to mildly oxidizing
- **Required O₂ range:** Low

#### Secondary Chemistry Release
- **Does it release any chemicals when forming?** No significant release
- **Byproducts of dissolution/decomposition:** Native gold + silver tellurides

#### Growth Characteristics
- **Relative growth rate:** Slow — rarer than calaverite in most deposits
- **Maximum crystal size:** Rarely exceeds 1 cm
- **Typical crystal size in vugs:** Sub-mm to few mm
- **Does growth rate change with temperature?** Moderate effect
- **Competes with:** Calaverite (lower Ag), krennerite, hessite, petzite, native gold, native tellurium

#### Stability
- **Breaks down in heat?** ~350–400°C → native gold + Ag-telluride species
- **Breaks down in light?** YES — photosensitive, darkens with prolonged light exposure. Tarnish accumulates.
- **Dissolves in water?** No
- **Dissolves in acid?** Hot concentrated H₂SO₄ — similar to calaverite
- **Oxidizes?** Yes, slowly — develops dark tarnish; full oxidation → native gold liberation
- **Dehydrates?** No
- **Radiation sensitivity:** Light sensitivity is the notable one (not ionizing radiation per se)

### Paragenesis
- **Forms AFTER:** Quartz, pyrite, fluorite (early vein); often same stage as calaverite
- **Forms BEFORE:** Native gold (liberated on oxidation)
- **Commonly associated minerals:** Calaverite, krennerite, native gold, native tellurium, quartz, fluorite, pyrite, rhodochrosite, acanthite, nagyágite, coloradoite
- **Zone:** Primary/hypogene — low-T hydrothermal vein telluride stage
- **Geological environment:** Low-temperature epithermal gold-telluride veins in volcanic/alkaline settings

### Famous Localities
- **Classic locality 1:** Sacarîmb (Nagyág), Transylvania, Romania — type locality, namesake (sylvanite ≠ sylvite!)
- **Classic locality 2:** Cripple Creek, Colorado
- **Classic locality 3:** Kalgoorlie (Eastern Goldfields), Western Australia
- **Notable specimens:** Baia de Aries, Romania; Kirkland Lake, Ontario; Emperor mine, Vatukoula, Fiji

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Sylvanite is the most common gold telluride, and also the one that can't sit in the sun. It's photosensitive — leave a specimen on the windowsill and it darkens, tarnishing from silver-white to a sullen black. The gold is still in there, locked in the crystal lattice, but the surface surrenders. Named not for sylvite (KCl) but for Transylvania, where it was first identified at the legendary Nagyág mining district. Miners called it "graphic tellurium" for the intergrown bladed crystals that looked like cuneiform scratched into the rock. The Au:Ag ratio varies from 1:1 to 3:1 — it can't decide if it's a gold mineral or a silver mineral. In Cripple Creek, it was one of the ores that built fortunes from stone that looked worthless to the naked eye.

### Simulator Implementation Notes
- **New parameters needed:** trace_Au (shared with calaverite). trace_Ag already exists.
- **New events needed:** Same `event_gold_telluride_pulse` as calaverite
- **Nucleation rule pseudocode:**
```
IF trace_Au > 0.1 AND trace_Ag > trace_Au * 0.3 AND trace_Te > 1 AND T < 350°C AND T > 100°C → nucleate sylvanite
IF trace_Ag < trace_Au * 0.15 → prefer calaverite instead
```
- **Growth rule pseudocode:**
```
IF trace_Au > 0.05 AND trace_Ag > 0.02 AND trace_Te > 0.5 AND 150°C < T < 300°C → grow at rate 2 (slow)
```
- **Habit selection logic:** T > 250°C → bladed; T < 200°C → granular/massive
- **Decomposition products:** T > 350°C → native gold + hessite (Ag₂Te) + Te release; oxidation → native gold

### Variants for Game
- **Variant 1:** Gold-rich sylvanite — Au:Ag ~3:1, lighter brass-yellow tint, transitional toward calaverite
- **Variant 2:** Silver-rich sylvanite — Au:Ag ~1:1, distinctly silver-white, transitional toward petzite/hessite
- **Variant 3:** Tarnished sylvanite — darkened surface from light exposure (photosensitive degradation mechanic)

### Paragenetic Sequence Note
Sylvanite is part of the **gold telluride paragenesis** — see calaverite research file for the full sequence map. Key distinction: sylvanite requires significant Ag (Au:Ag ratio 1:1 to 3:1) and forms at slightly lower temperatures than calaverite. In a cooling hydrothermal system, calaverite crystallizes first (higher T, Au-dominant), then sylvanite (lower T, Ag-bearing), then hessite/petzite (Ag-dominant), and finally native tellurium as Te exceeds the available precious metals.

### ⚠️ Naming Note
Sylvanite ≠ Sylvite. Sylvanite is (Ag,Au)Te₂ (telluride); sylvite is KCl (halide). Do not confuse them. The names share a Latin root (*silva*, forest — sylvanite via Transylvania, sylvite via "salt of the forest"). In the game, this is a potential confusion to guard against.
