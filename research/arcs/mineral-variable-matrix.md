# Mineral Variable Matrix — What the Engine Tracks

**Purpose:** Map every variable to every mineral so we can research accuracy systematically.
Build modularly — any new mineral just needs a row in this table.

## Fluid Variables (tracked per step)

| Variable | Unit | Range | What it does |
|----------|------|-------|-------------|
| **Temperature** | °C | 25-600 | Primary control on which minerals are stable |
| **Pressure** | kbar | 0.5-3 | Currently minimal effect, could be expanded |
| **pH** | - | 2-10 | Acid dissolves carbonates; alkaline favors them |
| **SiO₂** | ppm | 0-2000 | Silica saturation → quartz |
| **Ca** | ppm | 0-1000 | Calcium → calcite, fluorite |
| **CO₃** | ppm | 0-500 | Carbonate → calcite, smithsonite, malachite |
| **Fe** | ppm | 0-200 | Iron → pyrite, chalcopyrite, hematite. Colors sphalerite. Quenches calcite FL. |
| **Mn** | ppm | 0-50 | Activates calcite fluorescence. Colors smithsonite pink. |
| **Zn** | ppm | 0-200 | Zinc → sphalerite, smithsonite |
| **S** | ppm | 0-200 | Sulfur → all sulfides (pyrite, chalcopyrite, sphalerite, galena, molybdenite) |
| **Cu** | ppm | 0-200 | Copper → chalcopyrite, malachite |
| **Pb** | ppm | 0-200 | Lead → galena, wulfenite |
| **Mo** | ppm | 0-100 | Molybdenum → wulfenite (currently), should → molybdenite |
| **U** | ppm | 0-200 | Uranium → uraninite |
| **F** | ppm | 0-100 | Fluorine → fluorite. HF attacks quartz at low pH. |
| **O₂** | - | 0-3 | Oxidation state. High O₂ destabilizes sulfides, enables hematite/malachite/smithsonite/wulfenite |
| **Flow rate** | - | 0-10 | Fluid velocity. Affects how fast conditions change. |
| **Salinity** | wt% | 0-25 | Currently minimal effect, could affect solubility |

### Variables we might be MISSING:
- **Al** (tracked but unused for minerals — needed for clays, corundum, tourmaline)
- **Ti** (tracked but unused — needed for rutile, anatase)
- **Cr** (not tracked — needed for chromian varieties, ruby color)
- **Ba** (not tracked — needed for barite)
- **Sr** (not tracked — needed for strontianite, celestine)
- **P** (not tracked — needed for apatite, pyromorphite)
- **V** (not tracked — needed for vanadinite)
- **As** (not tracked — needed for mimetite, arsenopyrite)
- **Mg** (not tracked — needed for dolomite, magnesite)
- **Na/K** (not tracked — needed for feldspars, zeolites)
- **Eh/redox potential** (currently approximated by O₂, could be more nuanced)
- **CO₂ fugacity** (affects carbonate chemistry, currently implicit in CO₃)

---

## Mineral Matrix — What Each Mineral Needs

### Format: Mineral | Formula | Essential ingredients | T range | pH | Special conditions | NEEDS RESEARCH?

| Mineral | Formula | Ingredients | T range (°C) | pH | O₂ | Special | Status |
|---------|---------|-------------|-------------|-----|-----|---------|--------|
| **Quartz** | SiO₂ | SiO₂ | ⚠️ WRONG? | any | any | HF dissolves | 🔴 NEEDS RESEARCH |
| **Calcite** | CaCO₃ | Ca + CO₃ | ⚠️ WRONG? | >5.5 | any | Acid dissolves, Mn=FL, Fe=quench | 🔴 NEEDS RESEARCH |
| **Fluorite** | CaF₂ | Ca + F | ? | >5 | any | Classic MVT mineral | 🔴 NEEDS RESEARCH |
| **Sphalerite** | ZnS | Zn + S | ? | any | low | Fe darkens color | 🔴 NEEDS RESEARCH |
| **Pyrite** | FeS₂ | Fe + S | ? | any | low | O₂ destroys it | 🔴 NEEDS RESEARCH |
| **Chalcopyrite** | CuFeS₂ | Cu + Fe + S | ? | any | low | O₂ → malachite pathway | 🔴 NEEDS RESEARCH |
| **Hematite** | Fe₂O₃ | Fe + O₂ | ? | >3.5 | high | Oxidation product | 🔴 NEEDS RESEARCH |
| **Malachite** | Cu₂CO₃(OH)₂ | Cu + CO₃ + O₂ | low? | ? | high | Supergene, on chalcopyrite | 🔴 NEEDS RESEARCH |
| **Uraninite** | UO₂ | U | >300? | any | low | Radioactive, produces Pb | 🟡 PROBABLY OK |
| **Galena** | PbS | Pb + S | ? | any | low | Source of Pb for secondaries | 🔴 NEEDS RESEARCH |
| **Smithsonite** | ZnCO₃ | Zn + CO₃ + O₂ | <200 | >5 | high | From oxidized sphalerite | 🟡 v1 OK |
| **Wulfenite** | PbMoO₄ | Pb + Mo + O₂ | <250 | 4-7 | high | Needs Mo + Pb, rare | 🟡 v1 OK, v2 pending |

---

## Research Queue (one at a time)

Priority order for accuracy audit:
1. **Quartz** — Professor flagged T range is wrong. Quartz needs HIGHER temps to form than calcite.
2. **Calcite** — T range relative to quartz. When does it form vs dissolve?
3. **Pyrite** — Classic sulfide, need accurate T/pH/O₂ stability
4. **Chalcopyrite** — Cu-Fe sulfide, associated with pyrite, T range?
5. **Fluorite** — MVT mineral, T range and conditions
6. **Sphalerite** — ZnS, MVT mineral, T range
7. **Galena** — PbS, MVT, T range
8. **Hematite** — Iron oxide, when does it form vs goethite vs limonite?
9. **Malachite** — Supergene, T range, pH sensitivity
10. **Uraninite** — Probably OK, verify T threshold
11. **Molybdenite** — NEW: add as primary sulfide (v2)

---

## Design Principle: Modular Mineral Addition

To add any new mineral, you need:
1. **Supersaturation function** in VugConditions — what conditions make it stable?
2. **Growth engine** — how does it grow? What habit? What consumes from the fluid?
3. **Nucleation check** — when does it nucleate? What does it prefer to grow on?
4. **Narrative function** — what does it look like? What's its story?
5. **Color/fluorescence** — visual properties
6. **A row in this matrix** — the geological ground truth

The engine should be correct enough that if you set up real geological conditions, you get the real mineral assemblage. That's the test.
