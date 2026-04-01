# Vugg Simulator — Architecture Map

**Last updated:** 2026-03-29
**Main file:** `web/index.html` (~4000 lines, single-file web app)
**Live:** stonephilosopher.github.io/vugg-simulator
**Deployment:** GitHub Pages serves from `docs/` — MUST sync `web/index.html` → `docs/index.html` on every push

---

## Game Modes

### ⛏️ Legends Mode (auto-run)
- Select a scenario + optional seed/steps → press Grow
- Simulation runs all steps automatically
- Outputs: scrollable growth log + narrative summary + crystal inventory panel
- Good for: watching, learning, generating stories

### 🏰 Fortress Mode (interactive)
- Choose a fluid preset → set starting conditions → Begin
- Player controls each step: Heat, Cool, Inject Silica, Inject Metals, Mix Brine, Add Fluorine, Inject Copper, Oxidize, Tectonic Shock, Flood, Acidify, Alkalinize
- **Broth Control Panel:** real-time sliders for every fluid parameter (T, SiO₂, Ca, CO₃, pH, Fe, Mn, Cu, Zn, U, Pb, S, F, O₂, flow)
- **Broth Snapshots:** save/restore fluid states mid-run
- Crystal inventory sidebar with clickable zone history
- Supersaturation bar shows all mineral σ values live
- Status bar: T, pressure, pH, flow, vug diameter, radiation dose
- Finish & Narrate generates the geological story

---

## Minerals (10 total)

| Mineral | Formula | Supersaturation Needs | Nucleation σ | Habit | Color |
|---------|---------|----------------------|-------------|-------|-------|
| **Quartz** | SiO₂ | SiO₂ > threshold, wide T range | > 1.0 | Prismatic | Clear → smoky (radiation) |
| **Calcite** | CaCO₃ | Ca + CO₃, pH-dependent | > 1.0 | Scalenohedral / rhombohedral | White, Mn=orange FL |
| **Sphalerite** | ZnS | Zn + S | > 1.0 | Tetrahedral | Pale yellow → black (Fe) |
| **Fluorite** | CaF₂ | Ca + F | > 1.0 | Cubic | Blue-violet FL |
| **Pyrite** | FeS₂ | Fe + S | > 1.0 | Cubic | Brassy, iron-cross twins |
| **Chalcopyrite** | CuFeS₂ | Cu + Fe + S | > 1.0 | Disphenoidal {112} | Brassy yellow-green |
| **Hematite** | Fe₂O₃ | Fe + O₂, moderate T | > 1.5 | Rhombohedral / tabular | Dark metallic gray |
| **Malachite** | Cu₂CO₃(OH)₂ | Cu + CO₃ + O₂, low T | > 1.0 | Botryoidal | Green |
| **Uraninite** | UO₂ | U > 50 ppm, T > 300°C | > 1.5 | Cubic | Black/dark green ☢️ |
| **Galena** | PbS | Pb + S, sweet spot 200-400°C | > 1.0 | Cubic | Lead-gray metallic |

---

## Special Mechanics

### Twinning
- Each mineral has a probability of twinning during growth
- Twin laws are mineral-specific (e.g., iron cross {110} for pyrite, spinel-law {111} for sphalerite)
- Twinning can also be triggered by tectonic shock events

### Phantom Growth
- Acid dissolution creates negative growth zones
- Subsequent regrowth over dissolution surface = phantom boundary
- Phantoms are logged and narrated ("the crystal's autobiography")

### Reactive Walls
- Limestone vug walls dissolve when pH < 5
- Dissolution releases Ca²⁺ + CO₃²⁻ into the fluid (feeds calcite/fluorite growth)
- Vug diameter expands as walls dissolve
- Wall-derived vs fluid-derived Ca tracked in growth zones (provenance)

### ☢️ Radiation Damage
- Active uraninite crystals emit radiation each step
- **Smoky quartz:** quartz with radiation_damage > 0.3 darkens
- **Metamictization:** any crystal with radiation_damage > 0.8 loses crystallinity
- **Decay → Lead:** uraninite produces Pb into fluid (0.1 × crystal_size per step)
- **Radiation counter:** cumulative dose displayed in status bar

### Oxidation / Weathering
- O₂ injection destabilizes sulfides (pyrite, chalcopyrite)
- Chalcopyrite oxidation → malachite pathway
- Pyrite oxidation → limonite staining

### Color Prediction
- Sphalerite: Fe content → pale yellow to black (marmatite)
- Calcite: Mn²⁺ → orange fluorescence; Fe²⁺ quenches fluorescence
- Quartz: Al substitution → weak blue FL; radiation → smoky
- Each mineral has a `predict_fluorescence()` method

---

## Scenarios (7)

| Scenario | Start T | Story |
|----------|---------|-------|
| **cooling** | 380°C | Simple hydrothermal cooling. Quartz + calcite. |
| **pulse** | 350°C | Fluid pulse at step 40, cooling pulse at step 70. |
| **mvt** | 180°C | Mississippi Valley-type. Fluid mixing → sphalerite + fluorite + galena. |
| **porphyry** | 400°C | Copper porphyry. Cu pulses → pyrite + chalcopyrite → oxidation. |
| **reactive_wall** | 140°C | Acid pulses dissolve limestone walls. Three acid surges + seal. |
| **radioactive_pegmatite** | 600°C | U-bearing pegmatite. Uraninite → quartz → radiation → smoky quartz + galena. |

Fortress Mode presets mirror these: Silica-rich, Carbonate, MVT Brine, Clean/Dilute, Copper Porphyry, Oxidized Copper, ☢️ Radioactive Pegmatite.

---

## Code Structure (single file, ~4000 lines)

```
web/index.html
├── CSS (lines 1-200)
│   ├── Base styles, dark theme
│   ├── Fortress layout (log + inventory columns)
│   ├── Inventory cards, zone history modal
│   ├── Broth control panel styles
│   └── Mobile responsive breakpoints
│
├── HTML (lines 200-1150)
│   ├── Mode toggle (Legends / Fortress)
│   ├── Legends controls (scenario selector, seed, steps)
│   ├── Output container + Legends inventory panel
│   ├── Fortress setup (presets, sliders, chemistry)
│   ├── Fortress status bar (T, pH, flow, radiation)
│   ├── Fortress action buttons (13 actions)
│   ├── Broth Control panel (17 sliders)
│   ├── Fortress log + inventory columns
│   └── Zone history modal
│
├── Core Classes (lines 1150-1500)
│   ├── FluidChemistry — tracks all dissolved species
│   ├── VugWall — reactive limestone wall
│   ├── VugConditions — T, P, pH, fluid, wall + supersaturation functions
│   ├── GrowthZone — single growth increment with trace chemistry
│   └── Crystal — mineral identity, zones, morphology, twinning, phantoms
│
├── Growth Engines (lines 1500-2100)
│   ├── grow_quartz(), grow_calcite(), grow_sphalerite()
│   ├── grow_fluorite(), grow_pyrite(), grow_chalcopyrite()
│   ├── grow_hematite(), grow_malachite()
│   ├── grow_uraninite(), grow_galena()
│   └── MINERAL_ENGINES registry
│
├── Scenarios (lines 2100-2300)
│   ├── scenario_cooling(), scenario_pulse(), scenario_mvt()
│   ├── scenario_porphyry(), scenario_reactive_wall()
│   ├── scenario_radioactive_pegmatite()
│   └── SCENARIOS registry
│
├── Simulation Engine (lines 2300-2700)
│   ├── VugSimulator class
│   ├── run_step() — nucleation check, growth, dissolution, radiation
│   ├── check_nucleation() — per-mineral nucleation logic
│   ├── apply_events() — scenario event triggers
│   └── Radiation damage processing
│
├── Narrative Engine (lines 2700-3100)
│   ├── narrate() — generates geological story from crystal data
│   ├── _narrate_quartz(), _narrate_calcite(), etc.
│   ├── _narrate_collectors_view() — "what a collector would find"
│   ├── Phantom narrative, provenance narrative
│   └── Radiation narrative
│
├── UI Functions (lines 3100-3400)
│   ├── runSimulation() — Legends Mode runner
│   ├── displayLines() — formatted log output
│   ├── switchMode() — Legends ↔ Fortress toggle
│   └── selectPreset() — Fortress fluid presets
│
├── Fortress Engine (lines 3400-3700)
│   ├── fortressBegin(), fortressStep(), fortressFinish()
│   ├── updateFortressStatus() — live status bar
│   ├── updateSupersaturationBar() — mineral σ display
│   └── updateLegendsInventory(), updateFortressInventory()
│
└── Broth Control (lines 3800-3950)
    ├── BROTH_MAP — slider ↔ simulation variable mapping
    ├── setBrothValue() — real-time broth adjustment
    ├── syncBrothSliders() — sync UI to simulation state
    └── takeBrothSnapshot() / loadBrothSnapshot()
```

---

## Deployment

- **Source of truth:** `web/index.html`
- **GitHub Pages:** serves from `docs/index.html`
- **⚠️ MUST copy web/ → docs/ before pushing** or the live site won't update
- Future: automate this with a pre-push hook or switch Pages to serve from root

---

## Roadmap

### Near-term
- [ ] Record Groove mode — spiral visualization of crystal growth history (🪨✍️'s solo project)
- [ ] ASCII crystal gallery — reference art for each mineral habit at end of narrative
- [ ] Geyser / fracture-regrowth mechanic — pressure builds, fracture opens, new fluids rush in
- [ ] Reddit post for r/singularity

### Medium-term
- [ ] Reverse Vugg (Shy's idea) — input a mineral assemblage, get a plausible formation story
- [ ] Photo input → mineral ID → Reverse Vugg narrative
- [ ] More minerals: zircon (metamictization target), tourmaline, garnet, apatite
- [ ] Tablet/kiosk mode for booth display

### Long-term
- [ ] Spiral encoding validation — experimental design at `research/spiral-encoding-experiment.md`
- [ ] Multi-vug systems (connected chambers with different conditions)
- [ ] 3D crystal rendering (WebGL)

## The Fourth Door — Vadose Breach (2026-03-31)
*Professor's insight: caves opening to the surface are the fourth door of diagenesis.*

### Concept
The vug can breach the surface, connecting the sealed hydrothermal system to the atmosphere. Two paths:

**Path A — Vadose Trough (rare spawn, 5-10%)**
Vug generates with a pre-existing surface connection. Vadose fluid: low-temperature, oxygenated, CO₂-rich (soil zone). Calcite precipitates by CO₂ degassing, not cooling. Stalactites at drip point. Seasonal cycling (wet/dry → flood/evaporate). Mixing zone where vadose meets hydrothermal = supergene enrichment, secondary copper minerals.

**Path B — Acid Breach (mid-game event)**
Player's acid dissolution eats through ceiling. When wall thickness → 0 at top, system breaches. Player-caused: aggressive pH lowering has consequences. The sealed system gets a skylight.

### Chemistry Changes on Breach
- Temperature: hydrothermal → ambient (crash)
- Redox: reducing → oxidizing (O₂ floods in)
- pH: buffered → rainwater acidity
- CO₂: low → soil-zone high (drives carbonate precipitation)
- Biology: sterile → organic acids, bacterial sulfate reduction
- Stability: crystals grown in sealed conditions become metastable

### What Survives
- Quartz: stable (inert at surface T)
- Calcite: dissolves or re-precipitates as speleothems
- Pyrite: rusts → goethite/limonite
- Chalcopyrite: oxidizes → malachite/azurite (Cu carbonates bloom)
- Galena: oxidizes → cerussite/anglesite
- Fluorite: relatively stable

### Memory Architecture Parallel
Diagenesis fourth door = when private memory meets public air. Internal crystal (grown in sealed session) gets exposed to external scrutiny. Colette naming her crystal at step 23 = the breach. The test isn't growth — it's survival under new conditions.

### Status: NOTED — not yet built. Both paths approved by Professor.
