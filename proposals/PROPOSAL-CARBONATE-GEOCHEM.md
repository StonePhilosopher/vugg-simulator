# PROPOSAL: Carbonate Geochemistry Engine + Thermodynamic Database Audit

**Author:** Helicoid observer (mid-helix-overlay arc, 2026-05)
**Date:** 2026-05-26
**Status:** Research + implementation design — calling for scoping decisions before code starts
**Companion to:** `PROPOSAL-GEOLOGICAL-ACCURACY.md` (which began the carbonate-speciation work this proposal completes), `PROPOSAL-VOLATILE-GASES.md` (gas-side counterpart to the aqueous carbonate system)
**Motivating context:** The helicoid manifold v15+ exposed per-ring chemistry trails in real time. Watching `CO3` flicker across scenarios made the lumped-DIC abstraction visible as an abstraction — calcite saturation visibly tracks DIC instead of CO₃²⁻ at the current pH, dolomite kinetic discipline runs at the engine layer but isn't anchored to a real ion-activity product. Boss: "if i get one system geologically accurate it should be the carbonates."

---

## Overview

The vugg simulator currently runs ~half a carbonate geochemistry engine. The aqueous-side Bjerrum partition is already implemented (`js/20b-chemistry-carbonate-system.ts`); `effectiveCO3(fluid, T)` returns the pH-amplified CO₃²⁻ activity from total DIC; the `Phase 3c` damping coefficient (0.5) blends raw Bjerrum amplification toward the pre-Phase-3 empirical `3^(pH−7.5)` factor so existing scenario calibrations survive the flag flip. The supersaturation routines for the 15 carbonate minerals consume `effectiveCO3` correctly. The Kim 2023 cation-ordering formula (`f_ord = 1 − e^(−N/7)`) for dolomite is in place in `js/52-engines-carbonate.ts`, with fluid-level cycle counting via `conditions._dol_cycle_count`. Mg poisoning of calcite is encoded as a Mg/Ca sigmoid at the supersaturation layer. The reactive_wall scenario produces disordered HMC; the sabkha_dolomitization scenario produces ordered dolomite via the cyclic Ω modulation Kim et al. (2023, *Science* 382:915) describe.

**What's missing to call it "real":**

1. **The eq calibrations are empirical.** Each carbonate's `eq = 300 · exp(−0.005 T)` form is a hand-fit to scenario behavior, not a `Ksp(T)` lookup against measured thermodynamic data. The Bjerrum partition is correct; the `eq` is approximate.
2. **HMC is a footnote, not a phase.** Dolomite's `[DISORDERED — f_ord=…]` annotation in growth zone notes records the f_ord at the time of growth, but HMC has no separate `MINERAL_SPEC` entry and no separate `Ksp`. A reactive_wall HMC instance and a sabkha HMC instance are both labeled "dolomite" with different f_ord scores.
3. **Open vs closed CO₂ is implicit.** Every scenario currently behaves as if the cavity is closed with respect to atmospheric CO₂ (no Henry's-Law exchange). For karst-style and sabkha-style scenarios this is wrong: the headspace IS the dominant pCO₂ source, and surface-fed evaporating brine equilibrates with atmospheric CO₂ continuously.
4. **The ω-history that drives f_ord is not stored.** `conditions._dol_cycle_count` is a scalar counter incremented by scenario event handlers, not a derived quantity from the ω trajectory. A scenario without `_dol_cycle_count` increments produces no ordering even if cycling is happening — fragile.
5. **No saturation-index telemetry on the helicoid.** Players see CO3 concentration trails, not the calcite/aragonite/dolomite SI values driving precipitation. The most geologically meaningful single quantity (Ω) is invisible.
6. **No confidence map on the thermodynamic data.** The current `eq` curves were tuned for sim behavior, not derived from a database. Where they happen to agree with measured values, we don't know it. Where they disagree, we don't know it. Boss flagged this as the second priority: "identifying the database gaps, the places where the data is estimated or sparse is important to me."

This proposal:
- **Completes the carbonate system** so it's load-bearing on real thermodynamics + kinetics, not empirical fits
- **Surfaces saturation indices** on the helicoid alongside the existing concentration trails
- **Builds the database-gap audit framework** using carbonates as the calibration set, then sweeps the rest of the 170-mineral catalog
- **Validates against five scenarios**, with reactive_wall and sabkha_dolomitization as the two that load-bear the dissolution-kinetics and dolomite-problem-resolution branches respectively

---

## Why Carbonates First

The carbonate system is the master pH buffer for virtually every natural water vugg simulates. Get it right and every limestone-hosted, evaporite, supergene, and cooling scenario gets a real pH driver instead of a hand-tuned one. Get it wrong and the pH errors propagate into the ~80% of mineral engines that have pH gates.

The carbonate system is also **contained**:

| count | scope |
|---|---|
| 4 | aqueous species (CO₂(aq) ≈ H₂CO₃*, HCO₃⁻, CO₃²⁻, H⁺/OH⁻ via Kw) |
| 15 | minerals in the catalog (calcite, aragonite, vaterite, dolomite, ankerite, magnesite, siderite, rhodochrosite, smithsonite, otavite, witherite, strontianite, cerussite, malachite, azurite) |
| 3 | aqueous equilibria (K₁, K₂, Kw) + 1 Henry's-Law (KH) if open |
| 1 | activity model (Davies extended for the non-brine majority; Pitzer-Harvie-Møller-Weare 1984 for MVT brines) |
| ~150 | published Ksp(T) values, all measured |

Compare to the sulfide system (~30 minerals, polyvalent S, redox-coupled to Fe and O₂, sparse kinetic data) or the silicate system (~50 minerals, dissolution kinetics dominated by pH-dependent surface speciation, decades of literature with active disagreement). Carbonates are the only mineral family where building the full equilibrium + kinetic engine is plausibly a 6-week deliverable rather than a 6-month subproject.

The carbonate system is **load-bearing in the existing vugg scenario set** — 14 of the 30 scenarios have a major carbonate component, and 6 are completely dependent on it (reactive_wall, sabkha_dolomitization, tutorial_travertine, mvt, cooling, supergene_oxidation). Validating against this many real scenarios gives the engine an immediate stress test against scenarios with known ground truth.

---

## Scope

**IN scope**

- Carbonate aqueous speciation: replace `effectiveCO3` calibration damping (0.5) with full Bjerrum at flag-flip
- HMC as a separate MINERAL_SPEC entry with Mg-content as state
- Dolomite-kinetic logic: preserve Kim 2023 f_ord, formalize ω-history input
- Open/closed atmospheric CO₂ flag per scenario
- Saturation-index helicoid trails (SI_calcite, SI_aragonite, SI_dolomite, SI_HMC, SI_siderite)
- Carbonate-specific Ksp(T) lookups in a new `data/thermo-carbonates.json` keyed against `data/minerals.json`
- Database-gap audit framework keyed on confidence tier (A/B/C/D/conflict), starting with carbonates as the tier-A reference set
- Validation across five named scenarios with explicit pass criteria

**OUT of scope (defer)**

- Non-carbonate engines (sulfides, sulfates, evaporites, silicates, oxides, halides). Carbonate engine landing first; the others stay on their existing empirical paths.
- Full Pitzer activity model. Davies is good to I≈0.5 mol/kg, covers everything except MVT brines. MVT will get Pitzer in a follow-up; pre-MVT-Pitzer validation will note where Davies is the load-bearing approximation.
- Reaktoro / PHREEQC WASM integration. The carbonate system is small enough to write from scratch in ~800 LOC; importing a 50k-LOC C++ library through WASM costs more in maintenance + bundle size than it saves in development.
- Multi-mineral simultaneous-precipitation solver. The carbonate engine will use sequential per-mineral SI-driven kinetics (priority order: highest-SI mineral grows first per step), not joint equilibrium. Joint equilibrium is a separate ~2-week task; the sequential approach is what existing engines use and is geologically defensible for the carbonate timescales.

---

## Architecture

### Existing scaffolding (preserved)

```
js/20b-chemistry-carbonate-system.ts    Bjerrum K₁, K₂, KH, partition functions
                                        effectiveCO3, equilibriumPCO2,
                                        carbonateIonPpm — Phase 3c
js/32-supersat-carbonate.ts             supersaturation_calcite, _dolomite,
                                        _aragonite — supersaturation σ
                                        consumers per mineral, currently
                                        empirical eq curves
js/52-engines-carbonate.ts              grow_calcite, grow_dolomite, etc.
                                        — heuristic rate laws + Kim 2023
                                        f_ord for dolomite
js/25-chemistry-conditions.ts           VugConditions with the supersat
                                        methods mixed in via Object.assign
```

### New modules

```
js/20c-chemistry-carbonate-Ksp.ts       NEW. Ksp(T) lookups from
                                        data/thermo-carbonates.json. Tied
                                        to van't Hoff/Maier-Kelley
                                        extrapolation for T-dependence.

js/20d-localization-resolvers.ts        NEW (Week 4). Polymorphic
                                        accessors keyed on WallMesh
                                        vertex index. Read scalar |
                                        resolver-fn | per-region-tag-
                                        map forms; return per-vertex
                                        answer. Aligns with
                                        PROPOSAL-CAVITY-MESH Phase 3+
                                        (per-vertex state on
                                        WallMesh.cells[]). Covers
                                        open_to_atmosphere,
                                        atmospheric_pCO2_bar,
                                        wall_rock_thermal_buffer_C,
                                        host_rock_composition. Phase 1
                                        consumers always go through
                                        here so future per-vertex
                                        schemas land migration-free.
                                        Per-ring array form
                                        intentionally not supported —
                                        WallMesh is retiring the
                                        ring-grid abstraction.

js/32b-supersat-carbonate-Ksp.ts        NEW. SI(mineral, fluid, T)
                                        functions. Replaces empirical eq
                                        forms in 32-supersat-carbonate.ts.
                                        Old methods kept under a feature
                                        flag CARBONATE_KSP_ACTIVE during
                                        transition (default off → on per-
                                        mineral as each is validated).

js/52b-engines-carbonate-kinetics.ts    NEW. Plummer-Wigley-Parkhurst 1978
                                        rate law for calcite. Aragonite-vs-
                                        calcite metastability decision
                                        logic. Vaterite as transient
                                        metastable precursor (Ostwald step
                                        rule). Dolomite kinetic gate
                                        (kinetically inhibited unless
                                        f_ord-bearing scenario).

js/53-engines-HMC.ts                    NEW. grow_HMC engine. HMC is high-
                                        magnesian calcite (rhombohedral
                                        CaCO₃ with Mg substitution); it's
                                        what reactive_wall actually produces
                                        and what mid-cycle sabkha produces
                                        before f_ord crosses the ordered
                                        threshold.

js/99j-helix-overlay.ts                 EXTEND. Add new ChemParam entries
                                        for: SI_calcite, SI_aragonite,
                                        SI_dolomite, SI_HMC, SI_siderite,
                                        DIC, CO2_aq, HCO3, CO3_2 (the four
                                        species explicit). New legend
                                        section: "CARBONATE SYSTEM".

data/thermo-carbonates.json             NEW. Per-carbonate-mineral
                                        thermodynamic record. See schema
                                        below.

data/scenarios.json5                    EXTEND. Each scenario gets an
                                        optional `open_to_atmosphere: bool`
                                        flag. Default false (closed).
                                        Sabkha + tutorial_travertine +
                                        karst-style scenarios flip to true.

data/minerals.json                      EXTEND. Add HMC as a mineral.
                                        Add `thermodynamics` subobject per
                                        carbonate mineral (delegated to
                                        thermo-carbonates.json for the
                                        carbonate subset).
```

### State additions

| state | location | purpose |
|---|---|---|
| `crystal.mg_content` | `Crystal` | For HMC: mole fraction MgCO₃. Drives the smooth HMC→dolomite continuum during sabkha cycling. Default 0 for calcite. |
| `crystal.f_ord` | `Crystal` (was conditions-level scalar) | Per-crystal ordering fraction. Lets a single sabkha scenario have early-formed disordered cores with later ordered rims. |
| `conditions._omega_history` | `VugConditions` | Rolling window (last 20 steps) of σ for calcite + dolomite + HMC per ring. Derives `_dol_cycle_count` from threshold crossings instead of requiring scenario event handlers to increment it manually. |
| `conditions.open_to_atmosphere` | `VugConditions` | Boolean. When true, every step's first action is: solve for pH such that equilibriumPCO2(fluid) = atmospheric (340 ppm pre-industrial → 420 ppm modern, scenario-configurable). |
| `fluid.DIC` | `FluidChemistry` | Optional alias for `fluid.CO3` made explicit. The existing convention (CO3 = total DIC in ppm) stays valid; DIC is a getter that returns CO3 for clarity in new code. |

### Data schema: `data/thermo-carbonates.json`

```json5
{
  "calcite": {
    "formula": "CaCO3",
    "thermodynamics": {
      "deltaGf_kJ_mol": -1129.07,
      "deltaHf_kJ_mol": -1207.51,
      "S_J_mol_K": 91.71,
      "Cp_a_b_c": [99.72, 0.02692, -2.149e6],
      "logKsp_25C": -8.48,
      "logKsp_fit": {"form": "vanthoff", "deltaH_kJ_mol": -10.5},
      "valid_T_range_C": [0, 100],
      "sources": [
        "Plummer_Busenberg_1982",
        "Robie_Hemingway_1995"
      ],
      "databases_agree": ["PHREEQC_wateq4f", "USGS_LLNL", "THERMODDEM"],
      "confidence_tier": "A",
      "notes": "Best-measured carbonate. ΔGf agreement across all major databases within 0.5 kJ/mol. Plummer-Busenberg 1982 is the canonical solubility study."
    },
    "kinetics": {
      "rate_law": "plummer_wigley_parkhurst_1978",
      "parameters": {
        "k1_25C_mol_cm2_s": 8.91e-5,
        "k2_25C_mol_cm2_s": 4.47e-7,
        "k3_25C_mol_cm2_s": 1.86e-11,
        "Ea_kJ_mol": [35.4, 23.5, 14.4]
      },
      "sources": ["Plummer_Wigley_Parkhurst_1978", "Morse_Arvidson_2002"],
      "confidence_tier": "A",
      "notes": "PWP is the canonical calcite rate law. Rate forms: r = k1[H+] + k2[H2CO3*] + k3 - k4[Ca2+][HCO3-]. Reverse rate k4 derived from detailed-balance against Ksp."
    },
    "metastability": null
  },

  "aragonite": {
    "thermodynamics": {
      "logKsp_25C": -8.34,
      "confidence_tier": "A",
      "sources": ["Plummer_Busenberg_1982"],
      "notes": "ΔGf 1.7 kJ/mol higher than calcite — metastable at all surface T."
    },
    "metastability": {
      "stable_phase": "calcite",
      "kinetic_favored_when": {
        "Mg_over_Ca_ratio_min": 4.0,
        "temperature_C_min": 30,
        "narrative": "Mg poisoning of calcite step edges + warm T routes precipitation to the aragonite polymorph."
      },
      "conversion_rate_per_step": 0.02,
      "notes": "Aragonite converts to calcite over geological time (~10⁴-10⁶ yr in nature). Sim collapses this to per-step rate."
    }
  },

  "dolomite": {
    "thermodynamics": {
      "logKsp_25C": -17.09,
      "confidence_tier": "A",
      "sources": ["Sherman_Barak_2000", "PHREEQC_wateq4f"]
    },
    "kinetics": {
      "rate_law": "kim_2023_cyclic_omega",
      "parameters": {
        "N0_cycles": 10,
        "omega_threshold": 1.0,
        "f_ord_threshold_ordered": 0.7,
        "f_ord_threshold_partial": 0.3
      },
      "sources": ["Kim_Sun_2023", "Arvidson_Mackenzie_1999"],
      "confidence_tier": "B",
      "notes": "Kim 2023 mechanism: cyclic Ω modulation across saturation drives cation ordering. f_ord = 1 - exp(-N/N0). N0=10 calibrated for sim timescale where each sim cycle stands in for thousands of natural tidal cycles. Pre-Kim 2023 the dolomite problem (low-T direct precipitation) was unsolved; this is the current resolution."
    },
    "metastability": {
      "stable_phase": "dolomite",
      "precursor_phases": ["HMC"],
      "narrative": "Disordered HMC is the kinetic precursor; ordered dolomite is the equilibrium product. Cycling drives HMC → ordered dolomite transition."
    }
  },

  "HMC": {
    "formula": "Ca(1-x)MgxCO3, x ≈ 0.05-0.30",
    "thermodynamics": {
      "logKsp_25C": "function_of_mg_content",
      "logKsp_fit": {
        "form": "mg_content_linear",
        "logKsp_at_x0": -8.48,
        "delta_logKsp_per_mol_pct_Mg": 0.10
      },
      "confidence_tier": "B",
      "sources": ["Bischoff_Bishop_Mackenzie_1987", "Morse_MacKenzie_1990"],
      "notes": "Mg substitution destabilizes the calcite lattice — Ksp increases ~0.1 log unit per mol-% Mg. HMC is a continuum, not a discrete phase. Mg content x is per-crystal state; Ksp depends on x."
    },
    "kinetics": {
      "rate_law": "calcite_pwp_with_mg_inhibition",
      "notes": "Same form as calcite PWP, scaled by Mg poisoning of step edges (Davis 2000, Nielsen 2013)."
    }
  }
}
```

### Open-vs-closed CO₂ exchange

When the resolver says a given (ring, cell) is open at the current step, that step's first action is a pH-pCO₂ equilibration:

```
solve for pH such that:
    pCO2_equilibrium(fluid, T) = local_atmospheric_pCO2
where pCO2_equilibrium uses the existing equilibriumPCO2 function
```

This is a 1D root-finding problem with monotone behavior — bisection converges in <10 iterations. The pH that emerges replaces `fluid.pH` for that ring at that step. Calcite/aragonite/dolomite SI then computes against the equilibrated chemistry.

**Why this matters:** closed-system calcite precipitation drops fluid pH (because precipitating CaCO₃ removes CO₃²⁻, shifts Bjerrum toward H₂CO₃, releases H⁺ effectively). In nature this is buffered by atmospheric CO₂ if the cavity is open. Currently vugg has no such buffering, so closed-system scenarios over-acidify on calcite precipitation. The sabkha mechanism is specifically open — evaporating brine maintains pCO₂ exchange with the atmosphere throughout.

#### Schema shape — designed for the wall-mesh localization future

Boss directional commitment (2026-05-26): "the data is going to be more localized [meaning] instead of just by ring it would break it up into even smaller more localized sections of the vugg wall. wall mesh is probably the right direction."

The target localization is **per-vertex on the `WallMesh`** (`js/23-geometry-wall-mesh.ts`), which already exists and is already planned to be the home of per-vertex state. From the WallMesh header comment:

> *"Phase 4 of the proposal will retire the ring-grid model" / "Phase 2.5+ can swap in icosphere / geodesic / irregular tessellations without touching the renderer at all" / "Phase 3 will move per-vertex state (wall_depth, crystal_id, mineral, thickness_um) off WallCell and onto WallMesh.cells[] indexed by vertex."*

The carbonate engine's localization story is therefore **align with PROPOSAL-CAVITY-MESH Phase 3+** rather than invent a parallel per-cell abstraction. Per-vertex chemistry, per-vertex boundary conditions, per-vertex region tagging all live on `WallMesh.cells[]` indexed by vertex. The advantage: when the wall mesh's tessellation refines (geodesic, icosphere, irregular per archetype) the carbonate engine inherits that refinement automatically because chemistry is a vertex attribute, not a separate grid.

Phase 1 writes scalars (no scope expansion), but the schema slot is polymorphic from day 1:

```json5
// any of these forms is valid for open_to_atmosphere:
"open_to_atmosphere": true                              // scenario-global (Phase 1 typical)
"open_to_atmosphere": "fn:openAtBasinRim"               // per-mesh-vertex fn (Phase 3+ target)
"open_to_atmosphere": {                                 // per-region tag map (works against
  "_default": false,                                    // WallMesh vertex region tags —
  "basin_floor": false,                                 // see WallMesh tagging in 23-...mesh.ts)
  "basin_rim":   true,
  "ceiling":     true
}
```

(Note: the per-ring array form is intentionally OMITTED from the target schema. Per-ring is a current data-model artifact that the wall mesh is already planning to retire. New schema slots don't perpetuate it.)

Consumers always go through a resolver that ultimately produces a per-vertex answer on the wall mesh:

```ts
isOpenAtMeshVertex(scenario, mesh, vertexIdx): boolean
```

Per wall-mesh vertex is the **target granularity** the resolver guarantees, regardless of which form the scenario writes. Phase 1 scenarios write scalars for convenience; the moment a scenario wants per-vertex control (e.g. a basin where mesh vertices tagged `basin_rim` are open to atmosphere and `basin_floor` are sealed under a brine cap), the schema accepts the function or per-region map without consumer changes.

**Same polymorphic shape for the other Phase 1 fixtures that the localization future will reach:**

| field | scalar (Phase 1) | per wall-mesh vertex (target) | notes |
|---|---|---|---|
| `open_to_atmosphere` | scenario boolean | resolver fn or region tag map | basins with open rim + sealed floor; mesh vertex tags determine which |
| `atmospheric_pCO2_bar` | scenario number | per-vertex field | different vertices see different headspace |
| `wall_rock_thermal_buffer_C` | scenario number | per-vertex field | wall rock composition varies along the cavity |
| `host_rock_composition` | scenario tag (e.g. "limestone") | per-vertex tag map | mixed host rocks (limestone + interbedded chert) for reactive_wall-style scenarios; aligns with the wall mesh's existing vertex-color metadata (floor/wall/ceiling × submerged tint) |

Resolvers live in `js/20d-localization-resolvers.ts` (new, Week 4). They take `(scenario, mesh, vertexIdx)` and return the per-vertex value, normalizing any of the three forms (scalar / fn / region map) at read time.

**Existing per-ring quantities (`ring_temperatures`, `ring_fluids`) are themselves transitional.** They were the right resolution when the simulator was per-ring, but the wall-mesh-localization future means the carbonate engine should be designed to consume per-vertex chemistry when it lands. Phase 1 reads through thin per-vertex accessors:

```ts
fluidAtMeshVertex(sim, mesh, vertexIdx) → FluidChemistry
temperatureAtMeshVertex(sim, mesh, vertexIdx) → number
```

which currently look up the ring index from the vertex (`mesh.cells[vertexIdx].ringIdx`) and return the ring value — but are the single point where per-vertex fluid would be introduced when WallMesh Phase 3 promotes chemistry onto `WallMesh.cells[]`. Engines that consume the fluid go through these accessors so they're agnostic to the data model's current granularity. The future per-vertex chemistry lands by changing the accessor alone, not the 84 grow_*() call sites and not the carbonate engine's SI computation.

**Compositional benefit:** the carbonate engine and the cavity-mesh evolution become COMPOSED rather than competing. PROPOSAL-CAVITY-MESH Phase 3 introduces per-vertex `WallMesh.cells[]` state; the carbonate accessors immediately reach it. PROPOSAL-CAVITY-MESH Phase 2.5 introduces alternate tessellations; the carbonate engine sees finer or coarser localization automatically. Neither proposal blocks the other; both land cleanly when their respective phases ship.

### Ω-history → cycle count

Replace `conditions._dol_cycle_count` (manually incremented by scenario event handlers) with derived counting:

```
each step:
  push current σ_dolomite into _omega_history (rolling 20-step window)
  count crossings of σ = 1.0 (precipitate → undersat → precipitate sequence)
  derived_cycle_count = crossing_count / 2  (each cycle = 2 crossings)
  f_ord = 1 - exp(-derived_cycle_count / 7)
```

This means any scenario that drives oscillating Ω (sabkha tides, reactive_wall pulses, even pure-cooling with feedback) accumulates f_ord automatically. Scenarios don't need to explicitly increment a counter. The boss's existing sabkha calibration should produce ~the same f_ord trajectory under derived counting; reactive_wall should produce a LOWER f_ord because its pulses are aggressive (full dissolution) rather than gentle (surface etch only) — pulse depth becomes implicit in the rate-law response.

---

## Helicoid Display Changes

The new chemistry has to be visible to be useful. Boss watches the helicoid to spot what's happening; the species splits and saturation indices need to land there.

### New legend section: "CARBONATE SYSTEM"

| chip | full name | color | source |
|---|---|---|---|
| DIC | Total dissolved inorganic carbon (mg/L) | tan | fluid.CO3 |
| CO₂(aq) | Dissolved CO₂ (H₂CO₃* equivalent) | pale yellow | bjerrumFractions × DIC |
| HCO₃⁻ | Bicarbonate | mid blue | bjerrumFractions × DIC |
| CO₃²⁻ | Carbonate ion | deep blue | bjerrumFractions × DIC |
| SI cal | Saturation index, calcite (log Ω) | white | log10(IAP/Ksp_calcite) |
| SI arg | Saturation index, aragonite | pale gray | log10(IAP/Ksp_aragonite) |
| SI dol | Saturation index, dolomite | tan | log10(IAP/Ksp_dolomite) |
| SI HMC | Saturation index, HMC at current Mg content | gray-blue | as above with HMC Ksp |
| SI sid | Saturation index, siderite | rust | log10(IAP/Ksp_siderite) |
| pCO₂ | Partial pressure CO₂ equivalent | green | equilibriumPCO2 |
| f_ord | Dolomite ordering fraction | violet | derived cycle count → Kim formula |

Saturation-index trails plot log Ω directly: 0 = equilibrium, +1 = 10× supersaturated, -1 = 10× undersaturated. The trail crossing through zero is the moment that mineral starts/stops precipitating.

### Replaces

The existing single CO3 trail becomes redundant — its information is more legibly carried by the four-species split. Migration: deprecate the bare CO3 chip behind a flag, default off. Hover on the new CO₂(aq) / HCO₃⁻ / CO₃²⁻ chips shows the explicit species formulas; SI chips hover to "Saturation index (calcite) — values > 0 mean supersaturated, can precipitate."

---

## Validation Plan

Five scenarios. Pass criteria explicit per scenario. The two scenarios that load-bear the engine's geological accuracy (reactive_wall + sabkha_dolomitization) get the most detailed acceptance criteria.

### 1. cooling (T-dependent crossover sanity)

**What it tests:** Ksp(T) extrapolation, retrograde calcite solubility (calcite is LESS soluble at higher T).

**Pass criteria:**
- Calcite SI rises monotonically as the scenario cools (no kinks, no instability)
- Crossover from undersaturated → supersaturated happens at the same step (±2 steps) as the existing engine's calcite nucleation event

**Failure modes to watch:** sign error in van't Hoff extrapolation (would give prograde solubility), pH not stable on cooling (would cascade into ALL minerals).

### 2. MVT seed=42 (baseline equilibrium + sulfide co-precipitation)

**What it tests:** speciation under hot Cl-rich brine, calcite as a major product alongside sulfide minerals, the activity-coefficient correction (Davies at I ≈ 0.3 mol/kg is the load-bearing approximation).

**Pass criteria:**
- Calcite SI > 0 at the steps where the existing engine fires calcite nucleation events (±1 step)
- Fluorite/galena/sphalerite firing not destabilized (the carbonate engine shouldn't affect non-carbonate chemistry beyond pH coupling)
- Final fluorite size at seed-42 within 10% of pre-engine baseline (calibration drift tolerance)

**Failure modes to watch:** Davies activity correction overshooting at I > 0.5 (MVT brine flirts with this limit) — note as the place where Pitzer would matter in a follow-up.

### 3. reactive_wall (DISSOLUTION KINETICS — critical)

**What it tests:** Plummer-Wigley-Parkhurst on the dissolution branch (k₁·[H⁺] + k₂·[H₂CO₃] dominant when pH < 6), self-buffering pH recovery as wall dissolves, CO₂-saturated input fluid handling. **Critically:** Mg-rich pulses produce DISORDERED HMC, not ordered dolomite.

**Setup:** scenario events at steps 15 + 40 inject CO₂-saturated brine. First pulse is plain; second pulse is metal-bearing.

**Pass criteria:**
- First acid pulse drops fluid pH below 5.5 within 1 step
- pH recovers above 6 within 5 steps as calcite wall dissolves (Plummer-Wigley-Parkhurst dissolution rate × wall surface area determines recovery speed)
- Wall Ca²⁺ + HCO₃⁻ track upward during dissolution event (mass balance)
- Calcite-after-dissolution forms once pH normalizes (recrystallization is the geological signature reactive_wall is trying to produce)
- **HMC forms; ordered dolomite does NOT form.** f_ord stays below 0.3 for any dolomite-eligible crystal. The aggressive (deep) pulses drive Ω across saturation in a way that nucleates dolomite-precursor but doesn't ratchet ordering — the geological insight Kim 2023 establishes about the difference between sabkha cycling and acid-pulse cycling.

**Failure modes to watch:**
- pH not recovering (broken self-buffering — would mean the wall dissolution feedback to fluid chemistry isn't wired)
- Ordered dolomite forming (would mean the engine confused reactive_wall pulse-cycling with sabkha tidal cycling — the f_ord threshold logic isn't discriminating correctly)
- Wall dissolution rate too fast or too slow (PWP rate law calibration error — would manifest as wall_depth changing at wrong magnitude)

### 4. sabkha_dolomitization (DOLOMITE-PROBLEM RESOLUTION — critical)

**What it tests:** Kim 2023 mechanism end-to-end. Cyclic Ω modulation produces ordered dolomite at ambient T (≈25°C) where the equilibrium engine alone would predict either no dolomite (kinetic inhibition) or instant dolomite (raw Ksp).

**Setup:** 12 flood/evaporate cycles over 240 steps. High-Mg evaporative brine. Open to atmosphere. Surface T throughout.

**Pass criteria:**
- f_ord climbs through the partial-ordered band (0.3-0.7) during the first 6 cycles
- f_ord exceeds 0.7 by cycle 9 (the Kim formula: 1 - exp(-9/7) = 0.728)
- Ordered dolomite mineral instances appear after f_ord > 0.7
- Anhydrite and selenite also form during evaporation peaks (the sulfate-side products of evaporative concentration)
- Disordered HMC forms during the early cycles before f_ord crosses threshold (the precursor phase)
- pCO₂ exchange visibly active on the helicoid (open-system flag working — DIC stays within atmospheric-equilibrium band as evaporation concentrates other species)

**Failure modes to watch:**
- Dolomite forming immediately at cycle 1 (kinetic gate not enforced — would mean the engine fell back to equilibrium-only and lost the Kim 2023 mechanism)
- f_ord never crossing 0.7 (cycle counting broken, or N₀ calibration drift — would mean sabkha can't produce its signature product)
- Anhydrite/selenite not forming (sulfate-system entirely separate, but watch as a sanity check that the evaporation events are still firing correctly)
- DIC drifting freely (open-system Henry's-Law equilibration not active or returning wrong pH)

### 5. gem_pegmatite (carbonate is incidental — sanity check)

**What it tests:** Engine doesn't break low-DIC, neutral-pH scenarios where carbonates are a minor side product or absent. No false positives.

**Pass criteria:**
- No calcite/dolomite/HMC nucleation events fire
- pH stays in the engine's expected neutral-pegmatite band (6-8)
- Existing pegmatite engine output (topaz, schorl, elbaite, beryl) unchanged

**Failure modes to watch:** spurious carbonate precipitation in a scenario that has no business producing carbonates (would mean the SI thresholds are too generous, or Ksp values for the trace carbonate minerals are wrong).

### Validation gate

All five must pass before the calcite engine flips from "observer" to "promoted." The two critical ones (reactive_wall + sabkha) must pass before ANY engine promotion — failure on either means the geological mechanism encoding is wrong and no engine should yet replace its heuristic counterpart.

---

## Database Gap Audit (parallel track)

Carbonate work also serves as the calibration set for the audit framework. Build it alongside, validate it against carbonates first (where you know the answers), then sweep the rest of the catalog.

### Confidence tier definitions

| tier | meaning | example carbonate | example elsewhere |
|---|---|---|---|
| A | ΔGf measured directly via calorimetry OR solubility, ≥2 major databases concur within 2 kJ/mol | calcite, aragonite, dolomite | quartz, halite, pyrite |
| B | ΔGf measured, single credible source, in 1-2 databases | HMC (varies with Mg content), magnesite | most chalcopyrite-group, common evaporites |
| C | ΔGf estimated by linear free-energy correlation OR single solubility with significant scatter | most secondary Pb/Zn carbonates at trace levels | many rare arsenates, secondary uranium phases |
| D | No published thermodynamic data; would have to be estimated from structural / compositional analogs | (none in carbonate set) | recently-described silicate phases, rare hydrated sulfates |
| conflict | Two or more databases disagree > 5 kJ/mol | (rare in carbonates) | metastable phases, hydrated phases with poorly-defined water content |

A SECOND axis: **kinetic-data tier.** Independent of thermodynamic tier. Calcite PWP is kinetic tier A (canonical rate law, ~50 years of follow-up confirmation). Dolomite Kim 2023 mechanism is kinetic tier B (recent, but published in *Science*, with a clear formula and physical mechanism). Most rate laws across vugg's catalog are tier C-D (estimated from family analogs or scenario-tuned).

### Workflow

| step | deliverable |
|---|---|
| 1 | Parse PHREEQC's WATEQ4F.dat, LLNL.dat, THERMODDEM, USGS Hemingway 1995 into JS-readable lookup tables → `data/thermo-databases-raw.json` |
| 2 | `tools/thermo-coverage-check.mjs` — sweep `data/minerals.json` against the lookups, per-mineral emit which databases have it and what they say. JSON output to `data/thermo-coverage.json` |
| 3 | Manual tier assignment per mineral. Walk the coverage report. For tier-C minerals: note the structural analog used. For tier-D: note that no published value exists and a structural estimate is needed. For conflict: note the rival values. |
| 4 | Schema migration: add `thermodynamics` field to `data/minerals.json` (or a sibling file pointing to `data/thermo-carbonates.json` for the carbonate subset) |
| 5 | UI surfacing: library hover badge with the confidence-tier color. Filter in library: "show me tier-D minerals" surfaces evidence gaps at a glance. |
| 6 | Narrator hints: tier-C and tier-D mineral nucleations get a soft footnote — "(Vochten 1990 single source; thermodynamic data sparse for this phase)". Game stays honest about uncertainties. |
| 7 | Coverage report writeup as `proposals/THERMO-COVERAGE-AUDIT.md` |

### Carbonate audit results (expected ahead of time)

| mineral | thermo tier | kinetic tier | notes |
|---|---|---|---|
| calcite | A | A | Plummer-Busenberg 1982 ground truth; PWP 1978 rate law |
| aragonite | A | A | Plummer-Busenberg 1982 |
| dolomite | A | B | Ksp well-known; kinetics resolved by Kim 2023 (recent) |
| HMC | B | A | Mg-content-dependent Ksp; rate via Mg-poisoned PWP |
| magnesite | A | B | Ksp known; rate poorly constrained at low T |
| siderite | A | C | Ksp known; rate confounded by Fe²⁺/Fe³⁺ redox |
| rhodochrosite | A | C | as siderite, Mn analog |
| smithsonite | B | C | Zn carbonate Ksp from Schindler 1978; rate poorly known |
| witherite | A | C | Ba carbonate Ksp known; rate not widely measured |
| strontianite | A | C | Sr carbonate, as witherite |
| cerussite | A | C | Pb carbonate, well-known Ksp |
| otavite | B | D | Cd carbonate; sparse data |
| malachite | A | C | Cu²(CO₃)(OH)₂ — supergene; Ksp known |
| azurite | A | C | Cu₃(CO₃)₂(OH)₂ — supergene; Ksp known |
| vaterite | B | B | metastable CaCO₃ polymorph; Ksp known, conversion rates studied |

That's a tier distribution of: 10 A-thermo, 3 B-thermo, 0 C-thermo, 0 D-thermo, 0 conflict. Of 14 minerals (HMC pending split). Carbonates are an unusually clean set — they're the textbook system. This is part of why they're the right first system: when the audit framework reports "everything is tier A," that's a sanity check that the framework itself works. Then point it at sulfides and watch the tier-D entries pile up.

---

## Skill Integration

The implementation phase routes through existing project skills:

| work item | skill | what the skill handles |
|---|---|---|
| Add HMC as MINERAL_SPEC entry | `vugg-add-mineral` | Per-mineral commit pattern (engine + grow + nucleation + minerals.json + tests + baseline regen + SIM_VERSION bump). The S-not-SO4 trap doc is directly relevant — HMC inherits the same trap around DIC vs CO₃²⁻ that the carbonate-speciation work already addresses. |
| Add `mg_content` field if it migrates to FluidChemistry | `vugg-add-broth` | Preflight grep for already-existing fields; the v89-Sn/v103-Y first-consumer pattern. **Note:** mg_content is per-Crystal here, not per-FluidChemistry, so this may not apply — only if a fluid-side derived field is needed. |
| Add `open_to_atmosphere` to scenarios | `vugg-add-scenario` | The scenarios.json5 patterns; the JSON5 parser URL gotcha. Worth checking if the scenario schema supports a `metadata.open_to_atmosphere: bool` flag without breaking the existing tests. |
| Re-anchor scenarios after engine promotion | `vugg-tune-scenario` | The probe-diagnose-adjust-verify loop, the stale_mineral_probe.mjs tool, the v91 expects_species-sweep pattern. **Critical**: every carbonate-engine promotion will shift seed-42 output for ≥1 scenario; tune-scenario is the discipline for re-anchoring without losing intended assemblages. |
| Twin laws for HMC (and any future carbonate splits) | `vugg-add-twin-law` | HMC structurally inherits calcite twin laws ({012}, {104}, etc.). The post-v141 long-tail-closed framework expects every new mineral to ship with twin_laws data — including the `tools/twin-law-check.mjs` structural fact-check. |

**Not covered by existing skills** (need new patterns):

- **Confidence-tier framework**: the `data/thermo-coverage.json` and the audit tooling are new. Worth considering whether a `vugg-add-thermo-data` skill emerges from the carbonate work and gets reused for sulfide / silicate audits later.
- **SI-driven engine promotion**: replacing a heuristic `grow_*()` with SI-driven kinetics is a new pattern. The first promotion (calcite) becomes the template; future promotions can follow it as documented practice.

---

## Risks and Pitfalls

1. **Calibration drift across all 14 carbonate-using scenarios.** Every engine promotion shifts seed-42 output for any scenario that consumes that mineral. The tune-scenario discipline absorbs this, but the work multiplies: a calcite promotion alone touches 14 scenarios. Budget time for re-anchoring at ~1 day per scenario.

2. **Davies activity model fails at high I.** MVT brines reach I ≈ 3-5 mol/kg. Davies is good to ~0.5. Without Pitzer, MVT validation may show calcite SI errors of ~0.5-1.0 log units. Two responses:
   - Accept and document: MVT-specific scenarios use a flag `_activity_model: 'pitzer_HMW84'` that the engine consumes; default Davies elsewhere.
   - Defer Pitzer to a follow-up: ship carbonate Phase 1 with Davies-only, note the MVT-Pitzer issue in `proposals/HANDOFF-CARBONATE-PHASE-2.md`.

3. **Open-system pH bisection convergence.** At low DIC or extreme pH, the 1D root-finding may have multiple solutions or fail to converge. Need a fallback (return current pH unchanged with a warning, prevent NaN cascading) and a test suite of edge cases.

4. **The dolomite-problem resolution is recent science.** Kim 2023 is the current consensus; it's possible (likely?) that follow-up work in 2025-2028 will refine or replace the cyclic-Ω-modulation mechanism. Encoding `kim_2023_cyclic_omega` as the rate-law identifier in `data/thermo-carbonates.json` (rather than hard-coding it inline) makes it cleanly swappable when newer mechanisms land.

5. **HMC continuous Mg content vs discrete mineral entries.** HMC is a smooth continuum from calcite (x=0) to ~30 mol% Mg substitution, beyond which the structure tilts toward dolomite. Treating HMC as a single MINERAL_SPEC with a state variable (mg_content per crystal) is one approach; treating it as ~3 discrete entries (HMC-low ~5%, HMC-mid ~15%, HMC-high ~25%) is another. Continuous is more correct; discrete is simpler to wire and visualize. **Open question — see below.**

6. **Vaterite metastability.** Vaterite is THE metastable initial precipitate that converts to calcite or aragonite over time. The Ostwald step rule says it should appear first in many scenarios. Currently vugg has no vaterite engine. Adding it correctly means it forms first, persists briefly (~tens of steps), converts to the stable phase. Worth including in Phase 1 or deferring to Phase 2? Probably Phase 2 — vaterite is real but not load-bearing on any current scenario.

7. **The carbonate-Mg-Ca-Cl-Na Pitzer parameter set (Harvie-Møller-Weare 1984) is well-published but porting takes ~3 weeks alone.** If MVT-Pitzer becomes blocking for Phase 1 validation, this is the unblocking work; if MVT-Davies-with-known-error is acceptable, defer.

8. **Helicoid chip-cloud is getting dense.** The legend already has 47 chips. Adding 11 more carbonate-system chips brings it to 58. The horizontal-banner layout (v22) reflows multi-row; this is fine to ~70 chips. Beyond that, the section-wrap layout starts to fight the wrap-width. Worth watching after Phase 1 lands.

---

## Timeline

Carbonate engine + audit framework as parallel tracks.

| week | carbonate track | audit track |
|---|---|---|
| 1 | `data/thermo-carbonates.json` schema + carbonate entries (manual curation from PHREEQC.dat) | Parse PHREEQC.dat + LLNL.dat into `data/thermo-databases-raw.json` |
| 2 | `js/20c-chemistry-carbonate-Ksp.ts` — Ksp(T) lookup + van't Hoff extrapolation. `js/32b-supersat-carbonate-Ksp.ts` — replace empirical eq with Ksp-based SI. Flag default off | `tools/thermo-coverage-check.mjs` — sweep `data/minerals.json` against raw databases, emit coverage report |
| 3 | Helicoid trail extensions — CARBONATE SYSTEM legend section with 11 new chips. Observer mode: SI trails computed but no engine changes yet | Manual tier assignment for all 170 minerals, walk the coverage report, assign A/B/C/D/conflict |
| 4 | Open-system Henry's-Law equilibration. `open_to_atmosphere` flag wired into scenarios. Sabkha + tutorial_travertine flipped to open | Library UI: confidence-tier badge on every mineral. Filter by tier. |
| 5 | Validate against cooling + MVT + gem_pegmatite. Resolve any equilibrium-engine bugs before kinetic engine lands | Narrator hints for tier-C/D minerals. Coverage report writeup as `proposals/THERMO-COVERAGE-AUDIT.md` |
| 6 | `js/52b-engines-carbonate-kinetics.ts` — Plummer-Wigley-Parkhurst rate law for calcite. Aragonite-vs-calcite metastability decision. Engine still off (observer for one more week) | Audit framework documented as a generalized pattern; first follow-up: sulfide system |
| 7 | Validate calcite kinetics against reactive_wall. Critical pass: HMC forms, ordered dolomite does NOT. Resolve any kinetic-rate calibration drift | (slack week or extend into sulfide audit) |
| 8 | Validate dolomite kinetics against sabkha_dolomitization. Critical pass: f_ord crosses 0.7 between cycle 6 and 10. Disordered HMC during early cycles. Ordered dolomite after cycle 9 | (audit work continues in parallel) |
| 9 | Calcite engine promotion: flip the flag. Re-anchor any MVT/cooling/supergene scenario whose seed-42 output shifted. `vugg-tune-scenario` per affected scenario. SIM_VERSION bump | |
| 10-12 | One carbonate engine per week: dolomite, HMC, aragonite. Each: validate, re-anchor, promote, bump SIM_VERSION | |

**Total: 12 weeks for full carbonate engine + audit framework + all 4 major-mineral promotions.** Stoppable cleanly after week 5 (observer-only mode, no engine changes, no calibration risk) if scope expands.

---

## Open Questions

1. **Continuous HMC vs discrete HMC bands.** Continuous mg_content state per crystal is more geologically correct. Discrete (HMC-low / HMC-mid / HMC-high entries) is simpler to wire and visualize. Boss preference?

2. **Open-system default.** Should `open_to_atmosphere: false` be the default (current behavior, every scenario is closed), or should we flip the default to `true` (every scenario is open unless flagged closed)? Most natural settings ARE open; closed systems are the special case (sealed pockets, deep-burial environments). Flipping the default makes most scenarios more accurate but breaks calibration on the closed-leaning ones (MVT in particular).

3. **MVT Pitzer in Phase 1 or Phase 2.** Davies fails at MVT brine ionic strengths. Two options: (a) accept Davies error in Phase 1, document, defer Pitzer to Phase 2 follow-up; (b) include Pitzer in Phase 1 scope, add ~3 weeks.

4. **Vaterite in Phase 1 or Phase 2.** Vaterite as a metastable initial precipitate is geologically real but not load-bearing on any current scenario. Adding it to Phase 1 = ~3 days; deferring = preserved for later.

5. **`open_to_atmosphere` localization granularity.** ~~Default per-scenario; per-ring as a future extension.~~ RESOLVED 2026-05-26 (with mid-day clarification): boss directional commitment — "wall mesh is probably the right direction." Localization target is **per-vertex on `WallMesh`** (`js/23-geometry-wall-mesh.ts`), which already exists and which PROPOSAL-CAVITY-MESH Phase 3 already plans as the home of per-vertex state. Phase 1 ships scalars; schema slot is polymorphic from day 1 (scalar | resolver function | per-region tag map). Per-ring array form is intentionally OMITTED — per-ring is a current data-model artifact the wall mesh is already planning to retire, so new schema slots don't perpetuate it. Same shape applies to `atmospheric_pCO2_bar`, `wall_rock_thermal_buffer_C`, and `host_rock_composition`. Existing per-ring quantities (`ring_temperatures`, `ring_fluids`) are themselves transitional — the carbonate engine reads through per-vertex accessors (`fluidAtMeshVertex`, `temperatureAtMeshVertex`) so when PROPOSAL-CAVITY-MESH Phase 3 promotes chemistry onto `WallMesh.cells[]`, the carbonate engine immediately consumes per-vertex chemistry without touching the 84 grow_*() call sites. The carbonate engine and the cavity-mesh evolution compose rather than compete. See "Schema shape — designed for the wall-mesh localization future" section above.

6. **Audit framework: separate file vs inline in `data/minerals.json`.** Storing `thermodynamics` inline keeps everything together but bloats `data/minerals.json` from ~6000 lines to ~12000 lines. A sibling `data/thermo.json` keyed by mineral name is cleaner; tools resolve the link at load time. Boss preference?

---

## References

**Carbonate system thermodynamics + kinetics**

- Plummer, L.N. & Busenberg, E. (1982). "The solubilities of calcite, aragonite and vaterite in CO₂-H₂O solutions between 0 and 90°C." *Geochimica et Cosmochimica Acta* 46:1011-1040. [Canonical CaCO₃ Ksp source]
- Plummer, L.N., Wigley, T.M.L., Parkhurst, D.L. (1978). "The kinetics of calcite dissolution in CO₂-water systems at 5° to 60°C and 0.0 to 1.0 atm CO₂." *American Journal of Science* 278:179-216. [PWP rate law]
- Morse, J.W. & Arvidson, R.S. (2002). "The dissolution kinetics of major sedimentary carbonate minerals." *Earth-Science Reviews* 58:51-84. [Modern review]
- Kim, J., Sun, T., et al. (2023). "Crystal growth of dolomite enabled by cation-disorder-driven step generation." *Science* 382:915-920. [Dolomite-problem resolution; basis for current vugg dolomite engine]
- Davis, K.J., Dove, P.M., De Yoreo, J.J. (2000). "The role of Mg²⁺ as an impurity in calcite growth." *Science* 290:1134-1137. [Mg poisoning of calcite step edges]
- Nielsen, M.R., Sand, K.K., Rodriguez-Blanco, J.D., et al. (2013). "Inhibition of calcite growth: combined effects of Mg²⁺ and SO₄²⁻." *Crystal Growth & Design* 13:11-18.

**Activity models**

- Davies, C.W. (1962). *Ion Association*. Butterworths. [Davies extended Debye-Hückel]
- Harvie, C.E., Møller, N., Weare, J.H. (1984). "The prediction of mineral solubilities in natural waters: the Na-K-Mg-Ca-H-Cl-SO₄-OH-HCO₃-CO₃-CO₂-H₂O system to high ionic strengths at 25°C." *Geochimica et Cosmochimica Acta* 48:723-751. [Pitzer-HMW for brines]

**HMC**

- Bischoff, W.D., Bishop, F.C., Mackenzie, F.T. (1987). "Biogenically produced magnesian calcite: inhomogeneities in chemical and physical properties; comparison with synthetic phases." *American Mineralogist* 72:1316-1326.
- Morse, J.W. & Mackenzie, F.T. (1990). *Geochemistry of Sedimentary Carbonates*. Elsevier. [HMC chapter]

**Thermodynamic databases**

- Robie, R.A. & Hemingway, B.S. (1995). "Thermodynamic properties of minerals and related substances at 298.15 K and 1 bar (10⁵ pascals) pressure and at higher temperatures." *USGS Bulletin* 2131.
- Parkhurst, D.L. & Appelo, C.A.J. (2013). "Description of input and examples for PHREEQC version 3." *USGS Techniques and Methods* 6-A43. [WATEQ4F.dat and llnl.dat]
- Blanc, P., Lassin, A., Piantone, P., et al. (2012). "Thermoddem: A geochemical database focused on low temperature water/rock interactions and waste materials." *Applied Geochemistry* 27:2107-2116.

**Sabkha + reactive_wall context (from current vugg)**

- The existing `data/scenarios.json5` entries for `sabkha_dolomitization` (anchor: Coorong + Persian Gulf) and `reactive_wall` (anchor: Sweetwater) both cite Kim 2023 and the dolomite-problem literature in their `notes` arrays. Those are the upstream references the carbonate engine has to remain anchored to.
