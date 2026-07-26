# Mineral Species Research — Vugg Simulator

## Species: Native Tellurium

### Identity
- **Formula:** Te (elemental tellurium)
- **Crystal system:** Trigonal (hexagonal axes; space group P3₁21)
- **Mineral group:** Native element (metalloid)
- **Hardness (Mohs):** 2–2.5
- **Specific gravity:** 6.1–6.3
- **Cleavage:** Perfect on {1010} (prismatic)
- **Fracture:** Uneven
- **Luster:** Metallic

### Color & Appearance
- **Typical color:** Tin-white to steel-gray; tarnishes to dull gray with brownish iridescence
- **Color causes:** Inherent metallic bonding; tarnish from surface oxidation to TeO₂
- **Transparency:** Opaque
- **Streak:** Grayish white to tin-white
- **Notable visual features:** Bright metallic luster on fresh surfaces; rapid tarnish. Rare hexagonal prismatic crystals with striations parallel to c-axis.

### Crystal Habits
- **Primary habit:** Prismatic (hexagonal prisms, often striated)
- **Common forms/faces:** {1010} prism, {1011} rhombohedron
- **Twin laws:** Rare
- **Varieties:** None established
- **Special morphologies:** Massive, granular, filamentous/reticulated; rare well-formed crystals

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 100–400°C (hydrothermal)
- **Optimal growth temperature:** 150–300°C
- **Decomposition temperature:** Melts at 449.5°C; boils at 988°C
- **Temperature-dependent habits:** Higher T → coarser crystals; lower T → filamentous/reticulated

#### Chemistry Required
- **Required elements in broth:** Te (high concentration, >10 ppm — very rare)
- **Optional/enhancing elements:** Au, Ag, Bi, Se (telluride-forming metals; when these are depleted, excess Te may crystallize as native)
- **Inhibiting elements:** Au, Ag, Cu, Pb, Bi, Hg (these preferentially form tellurides — calaverite AuTe₂, sylvanite (Au,Ag)Te₂, altaite PbTe, tetradymite Bi₂Te₂S, hessite Ag₂Te, coloradoite HgTe — all of these consume Te before native Te can form)
- **Required pH range:** Near-neutral to slightly acidic (pH 4–7)
- **Required Eh range:** Reducing to mildly reducing (Eh -200 to +50 mV)
- **Required O₂ range:** Low — tellurium oxidizes easily

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes dissolved Te species (HTe⁻, Te²⁻)
- **Byproducts of dissolution/decomposition:** Te oxidizes to tellurite (TeO₃²⁻) and tellurate (TeO₄²⁻) in oxidizing fluids

#### Growth Characteristics
- **Relative growth rate:** Slow
- **Maximum crystal size:** Several cm (rare); typically mm-scale
- **Typical crystal size in vugs:** 1–10 mm
- **Does growth rate change with temperature?** Moderate increase with temperature
- **Competes with:** All telluride minerals (calaverite, sylvanite, hessite, altaite, tetradymite, coloradoite) — these form preferentially when metals are available

#### Stability
- **Breaks down in heat?** Melts at 449.5°C
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Soluble in hot concentrated HNO₃ and H₂SO₄; dissolves in oxidizing acids; insoluble in HCl
- **Oxidizes?** Yes — tarnishes rapidly in air; surface oxidizes to tellurite (TeO₂) crust
- **Dehydrates?** N/A
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Telluride minerals (native Te is the RESIDUE — it forms when Te supply exceeds the capacity of metals to form tellurides)
- **Forms BEFORE:** Oxidation-zone tellurites/tellurates
- **Commonly associated minerals:** Calaverite (AuTe₂), sylvanite, hessite (Ag₂Te), altaite (PbTe), tetradymite (Bi₂Te₂S), native gold, pyrite, quartz, fluorite
- **Zone:** Primary/hypogene (low-T hydrothermal, epithermal)
- **Geological environment:** Epithermal gold-telluride veins, low-temperature hydrothermal systems, alkaline igneous complexes

### Famous Localities
- **Classic locality 1:** Kalgoorlie, Western Australia — golden mile telluride deposits, some of the richest Au-Te ore on Earth
- **Classic locality 2:** Cripple Creek, Colorado, USA — epithermal telluride-gold veins
- **Classic locality 3:** Emperor Mine, Vatukoula, Fiji — epithermal Au-Te system
- **Notable specimens:** Crystals from Kalgoorlie and Cripple Creek are museum standards; Zod Mine, Armenia for well-formed prisms

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Tellurium is the element that arrived too late for the party. It's rarer than platinum in Earth's crust — a cosmic abundance that got stripped from the planet during formation by volatile hydrides escaping to space. When it does show up, it arrives in epithermal gold veins, dissolved in low-temperature hydrothermal fluids alongside the metals that covet it desperately. Gold forms calaverite (AuTe₂) and sylvanite; silver makes hessite (Ag₂Te); lead builds altaite. Native tellurium only crystallizes when every metal has had its fill and there's still tellurium left over — a rare extravagance. The resulting tin-white hexagonal prisms tarnish almost immediately in air, their metallic gleam fogging to a dull gray. It's one of the few minerals defined by what failed to happen: it exists because the metals couldn't consume all of it. A relic of excess, striated and fleeting.

### Simulator Implementation Notes
- **New parameters needed:** trace_Te needed in broth (currently in the 30-trace-element list as Te — check if tracked); need telluride formation check
- **New events needed:** `event_tellurium_pulse` (Te-enriched fluid injection, very rare, associated with epithermal gold events)
- **Nucleation rule pseudocode:**
```
IF trace_Te > 10 AND all telluride-forming metals (Au, Ag, Pb, Bi, Hg) are depleted OR already bound in tellurides → nucleate native_tellurium
rate = slow
T must be 100–400°C
Eh < +50 mV
```
- **Growth rule pseudocode:**
```
IF trace_Te > 5 AND T in (100, 400) → grow at rate proportional to [Te] remaining after telluride allocation
habit: if T > 250 → prismatic; if T < 200 → reticulated/filiform
```
- **Habit selection logic:** Higher T = well-formed hexagonal prisms; lower T = filamentous/reticulated massive
- **Decomposition products:** Melts at 449.5°C → liquid Te. Oxidizes → TeO₃²⁻ (tellurite ions to fluid).

### Variants for Game
- **Variant 1: Prismatic tellurium** — Well-formed hexagonal prisms, striated. Higher T (>250°C). Metallic tin-white.
- **Variant 2: Reticulated tellurium** — Interconnected wire-like masses, filiform habit. Lower T (100–200°C).
- **Variant 3: Tarnished tellurium** — Surface oxidized to TeO₂ crust. Cosmetic variant; occurs when O₂ briefly spikes after formation.
