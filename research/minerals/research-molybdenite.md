# Research: Molybdenite — MoS₂

## Species: Molybdenite

### Identity
- **Formula:** MoS₂
- **Crystal system:** Hexagonal (2H polytype, most common) / Trigonal (3R polytype)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 1–1.5
- **Specific gravity:** 4.73
- **Cleavage:** Perfect basal {0001} — the defining feature, like graphite
- **Fracture:** Not applicable (flexible lamellae)
- **Luster:** Metallic, lead-silver

### Color & Appearance
- **Typical color:** Black, lead-silvery gray
- **Color causes:** Metallic bonding in layered Mo-S structure
- **Transparency:** Nearly opaque; translucent on thin flakes
- **Streak:** Bluish gray — feels greasy, marks paper and fingers
- **Notable visual features:** Extreme softness (H=1), greasy feel, hexagonal platy crystals. Can be confused with graphite but is denser (SG 4.7 vs 2.2) and streaks bluish instead of black.

### Crystal Habits
- **Primary habit:** Thin platy hexagonal crystals, tabular on {0001}
- **Common forms/faces:** Hexagonal prisms terminated by pinacoids, tapering six-sided pyramids
- **Twin laws:** Not a major twinning mineral
- **Varieties:** 2H polytype (hexagonal, most common) vs 3R polytype (trigonal, rarer). 3R associated with higher Re content.
- **Special morphologies:** Massive, lamellar, fine disseminated flakes in porphyry ore

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 350–600°C (porphyry/hydrothermal window)
- **Optimal growth temperature:** 400–550°C
- **Decomposition temperature:** 1185°C (in inert atmosphere)
- **Temperature-dependent habits:** Higher temps favor larger, more euhedral crystals; lower temps produce disseminated flakes

#### Chemistry Required
- **Required elements in broth:** Mo (ppm levels sufficient — Mo is highly chalcophile), S²⁻
- **Optional/enhancing elements:** Re (substitutes for Mo up to 1–2%), Cu (co-deposits in porphyry systems)
- **Inhibiting elements:** High O₂ — molybdenite is a primary sulfide, requires reducing conditions
- **Required pH range:** Near-neutral to slightly acidic
- **Required Eh range:** Reducing (low Eh)
- **Required O₂ range:** Very low — decomposes under oxidizing conditions

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Mo + S²⁻ from fluid
- **Byproducts of dissolution/oxidation:** MoO₄²⁻ (molybdate ion) + H⁺ (acidifies fluid). This is the key reaction — molybdenite oxidation feeds wulfenite and ferrimolybdite formation.

#### Growth Characteristics
- **Relative growth rate:** Moderate
- **Maximum crystal size:** Up to 15+ cm hexagonal plates (rare); typical vug crystals 1–10 mm
- **Typical crystal size in vugs:** 1–5 mm disseminated flakes, occasionally 1–3 cm plates
- **Does growth rate change with temperature?** Faster at higher T within hydrothermal window
- **Competes with:** Pyrite (competes for S²⁻), chalcopyrite (competes for S²⁻ in Cu-Mo systems)

#### Stability
- **Breaks down in heat?** Decomposes at 1185°C
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Resistant to most acids; oxidizes in aqua regia or HNO₃
- **Oxidizes?** YES — key reaction. MoS₂ + O₂ → MoO₄²⁻ + H⁺ (in presence of water). Produces soluble molybdate that migrates to oxidation zone.
- **Radiation sensitivity:** None notable, but Re-187 undergoes β decay (t½ = 4.12 × 10¹⁰ yr) — radiogenic Os-187 signature used in Re-Os dating

### Paragenesis
- **Forms AFTER:** Quartz (early gangue), K-feldspar alteration
- **Forms BEFORE:** Wulfenite, ferrimolybdite, powellite (all require Mo from molybdenite oxidation)
- **Commonly associated minerals:** Pyrite, chalcopyrite, quartz, fluorite, scheelite, cassiterite, topaz, K-feldspar
- **Zone:** Primary/hypogene — forms deep in hydrothermal/porphyry systems
- **Geological environment:** Porphyry Mo deposits (Climax-type), porphyry Cu-Mo deposits, greisens, high-T veins, skarns

### Famous Localities
- **Climax Mine, Colorado** — world's largest Mo producer, massive molybdenite
- **Henderson Mine, Colorado** — major porphyry Mo deposit
- **Questa, New Mexico** — disseminated molybdenite in porphyry
- **Molly Hill Mine, Quebec** — exceptional euhedral hexagonal crystals on quartz
- **Notable specimens:** 15+ cm hexagonal plates from Quebec

### Fluorescence
- **Fluorescent under UV?** No
- **Activator:** N/A

### Flavor Text

> Molybdenite is the mineral that confuses everyone who first meets it — soft as a fingernail, greasy as graphite, and six-sided like it was drawn by a crystallographer. But it's the gateway mineral for an entire paragenetic sequence. When oxygen finally reaches it, molybdenite doesn't just weather — it dissolves its identity into the groundwater, carrying molybdate ions upward to paint the oxidation zone in wulfenite's impossible orange. Every blade-thin hexagonal plate is a future sunset waiting to happen.

### Simulator Implementation Notes
- **New parameters needed:** trace_Mo (already added per TODO entry)
- **New events needed:** Molybdenum pulse event (already implemented)
- **Nucleation rule pseudocode:**
```
IF temp > 350 AND temp < 600 AND Mo_available AND S_available AND Eh < reducing_threshold → nucleate molybdenite
MAX 3 nuclei per vug
```
- **Growth rule pseudocode:**
```
IF Eh < reducing AND S_available AND Mo_available → grow at rate 3 (moderate, slower than pyrite)
```
- **Habit selection logic:** If temp > 450 → hexagonal plates (larger, more euhedral); else → disseminated flakes (smaller, massive)
- **Decomposition products:** On oxidation → releases MoO₄²⁻ + H⁺ into fluid. This is the feedstock for wulfenite and ferrimolybdite.

### Variants for Game
- **Variant 1: Standard molybdenite** — hexagonal plates, disseminated flakes, primary sulfide
- **Variant 2: Re-enriched molybdenite** — 3R polytype, higher rhenium content, denser, slightly different crystal habit (rare, marks evolved hydrothermal fluids)

---

## Paragenetic Sequence: Molybdenum Pathway

**Primary:** Molybdenite (MoS₂) — reducing conditions, 350–600°C
**Oxidation branch 1:** Wulfenite (PbMoO₄) — needs Pb from galena oxidation + Mo from molybdenite oxidation
**Oxidation branch 2:** Ferrimolybdite (Fe₂(MoO₄)₃·8H₂O) — needs Fe³⁺ + Mo from molybdenite, no Pb required
**Key insight:** Wulfenite requires BOTH molybdenite AND galena to oxidize — it's a two-source mineral. Ferrimolybdite only needs molybdenite + iron (more common but less spectacular).
