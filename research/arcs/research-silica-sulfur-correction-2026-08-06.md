# Research packet: silica phase identity and sulfur reservoirs

Date: 2026-08-06
Scope: hostile-review blockers after SIM 242
Rule: follow the science; when the present state cannot support a claim, expose the boundary rather than relabel the output.

## Verdict

Two model-identity defects were load-bearing:

1. A quartz object could nucleate from a low-temperature broth and later receive an opal or chalcedony display label. That collapses distinct structures, water contents, kinetics, and growth records into cosmetics.
2. One scalar `fluid.S` acted as sulfide, sulfate, and elemental sulfur. Multiple mineral families could therefore spend the same sulfur, while scenario events could turn H2S into native sulfur and acidity without a balanced reaction.

SIM 243 corrects the identity layer before retuning output.

## Silica decision

### Evidence boundary

- USGS publishes the strong temperature dependence of amorphous-silica solubility in water and identifies the plotted source as Marshall (1980): <https://www.usgs.gov/media/images/plot-showing-solubility-amorphous-silica-water-a-function-temperature>
- Rimstidt & Barnes (1980), *Geochimica et Cosmochimica Acta* 44, 1683-1699, is the kinetic/equilibrium basis already cited by the quartz model; bibliographic record: <https://www.osti.gov/etdeweb/biblio/6852525>
- The simulator already has a first-class opal phase and a separate empirical opal gate. It does not yet have a generic first-class chalcedony phase with an independently calibrated solubility/kinetic model.

### Implemented rule

| Candidate | Admitted field | Additional gates | Meaning |
|---|---:|---|---|
| opal | 5 ≤ T < 100 °C | SiO2 ≥ 200 ppm; pH 6.5-10 | first-class hydrated/amorphous silica mineraloid |
| quartz | 100 ≤ T ≤ 700 °C | SiO2 ≥ 50 ppm | first-class crystalline SiO2 |
| generic chalcedony | not selected | awaiting its own model | never a cosmetic quartz label |

This is a kinetic phase selector, not a claim that quartz is thermodynamically impossible below 100 °C. Existing quartz below the kinetic admission floor is allowed to persist. It dissolves only when the independently evaluated quartz equilibrium ratio is below one; otherwise growth pauses.

The 100 °C boundary is a bounded game-model division between the already implemented engines, not a universal natural discontinuity. Future work can replace it with time-dependent nucleation and amorphous-to-microcrystalline transformation kinetics without changing phase identity.

## Sulfur decision

### Conserved state

The explicit model carries:

- `S_sulfide`: reduced dissolved S(-II), available to sulfides;
- `S_sulfate`: oxidized dissolved S(VI), available to sulfate minerals;
- `S_elemental`: S° precursor, available only to native sulfur;
- `S = S_sulfide + S_sulfate`: backwards-compatible dissolved-total observer, never including elemental sulfur.

Every sulfur-bearing mineral maps its formula-S demand to exactly one reservoir. Dissolution returns sulfur to the same reservoir recorded in the accepted shell inventory.

### Sulphur Bank pathway

The modeled interface reaction is:

`H2S + 1/2 O2 -> S0 + H2O`

The reaction transfers one mole of sulfur from `S_sulfide` to `S_elemental`, consumes one-half mole O2 per mole S, and produces no H+. Atmospheric O2 added to sustain the interface is recorded as a boundary flux before consumption. Any acid-sulfate alteration would require a separate oxidation route to sulfate plus proton production; SIM 243 does not invent it inside this reaction.

### Sicily pathway

Ziegenbalg et al. (2010) link Sicilian native sulfur, carbonate, and Messinian gypsum to microbial sulfate reduction; repository record: <https://iris.unipa.it/handle/10447/54008>. Rouwendaal et al. (2025) report anaerobic native-sulfur formation at Monte Palco, supporting a pathway that does not require molecular oxygen: <https://onlinelibrary.wiley.com/doi/10.1111/gbi.70015>.

The scenario therefore remains anoxic. In-run BSR transfers an explicit sulfate increment to reduced sulfur and adds carbonate-equivalent alkalinity. Mineable elemental sulfur is a separately declared inherited microbial reservoir/recharge. This does not claim that the present game resolves the full microbial disproportionation network.

## Creative-mode consequence

Because Creative Mode is the fine-control laboratory, the new reservoirs cannot remain hidden scenario metadata. Setup and live editing expose dissolved-total S, S(-II), S(VI), S°, explicit-ledger mode, and native-sulfur pathway. Editing an oxidation-state pool enables explicit accounting. Selecting a native-S pathway changes eligibility only; it never creates elemental sulfur.

## Acceptance tests

- Mammoth/travertine seed 42 grows no low-temperature quartz.
- A low-temperature silica-rich eligible fluid nucleates real `opal` objects.
- A crystalline-window fluid nucleates `quartz` and never a cosmetic chalcedony label.
- Quartz equilibrium and kinetic admission are tested independently.
- Sulphur Bank oxidation closes sulfur and oxygen and produces zero protons.
- Dissolved sulfide alone cannot nucleate native sulfur.
- Sicily BSR closes sulfur while transferring sulfate to reduced sulfur.
- Sulfide, sulfate, and native-sulfur formula ledgers debit independent pools.
- Every new numeric reservoir is reachable through both Creative setup and live controls.

## Remaining uncertainty

- A proper generic chalcedony/agate engine needs its own nucleation, aggregation, aging, and transformation model. Existing named chalcedony-class minerals such as chrysoprase remain independent species-specific engines.
- Sulfur isotope fractionation, aqueous polysulfides, thiosulfate, organic intermediates, and microbial energy yields remain outside the state vector.
- The legacy bulk-S proxy remains for old scenarios and saves. New mixed-valence scenarios must opt into explicit reservoirs.
