# Research packet: silica phase identity and sulfur reservoirs

Date: 2026-08-06
Scope: hostile-review blockers after SIM 242
Rule: follow the science; when the present state cannot support a claim, expose the boundary rather than relabel the output.

## Verdict

Two model-identity defects were load-bearing:

1. A quartz object could nucleate from a low-temperature broth and later receive an opal or chalcedony display label. That collapses distinct structures, water contents, kinetics, and growth records into cosmetics.
2. One scalar `fluid.S` acted as sulfide, sulfate, and elemental sulfur. Multiple mineral families could therefore spend the same sulfur, while scenario events could turn H2S into native sulfur and acidity without a balanced reaction.

SIM 243 corrected the first identity layer before retuning output. SIM 246
supersedes its temporary generic-chalcedony boundary with a first-class phase;
the sulfur conclusions below are unchanged.

## SIM 243 silica decision (historical; superseded by SIM 246 below)

### Evidence boundary

- USGS publishes the strong temperature dependence of amorphous-silica solubility in water and identifies the plotted source as Marshall (1980): <https://www.usgs.gov/media/images/plot-showing-solubility-amorphous-silica-water-a-function-temperature>
- Rimstidt & Barnes (1980), *Geochimica et Cosmochimica Acta* 44, 1683-1699, is the kinetic/equilibrium basis already cited by the quartz model; bibliographic record: <https://www.osti.gov/etdeweb/biblio/6852525>
- The simulator already has a first-class opal phase and a separate empirical opal gate. It does not yet have a generic first-class chalcedony phase with an independently calibrated solubility/kinetic model.

### Implemented rule

| Candidate | Admitted field | Additional gates | Meaning |
|---|---:|---|---|
| opal | 5 ≤ T < 100 °C | SiO2 ≥ 200 ppm; pH 6.5-10 | first-class hydrated/amorphous silica mineraloid |
| quartz | 100 ≤ T ≤ 700 °C | SiO2 ≥ 50 ppm | first-class crystalline SiO2 |
| generic chalcedony | not selected in SIM 243 | temporary boundary, superseded by the SIM 246 model below | never a cosmetic quartz label |

This is a kinetic phase selector, not a claim that quartz is thermodynamically impossible below 100 °C. Existing quartz below the kinetic admission floor is allowed to persist. It dissolves only when the independently evaluated quartz equilibrium ratio is below one; otherwise growth pauses.

The 100 °C boundary is a bounded game-model division between the already implemented engines, not a universal natural discontinuity. Future work can replace it with time-dependent nucleation and amorphous-to-microcrystalline transformation kinetics without changing phase identity.

## SIM 246 silica correction

### Sources and equations

- USGS OFR 82-308 publishes the chalcedony geothermometer inversion used here:
  `T = 1032 / (4.69 - log10 SiO2) - 273.15`:
  <https://pubs.usgs.gov/of/1982/0308/report.pdf>.
- USGS OFR 84-690 documents the chalcedony solubility relation over 0-250 °C
  and the amorphous-silica relation used by the opal route:
  <https://pubs.usgs.gov/of/1984/0690/report.pdf>.
- Reed & Mariner (2007) discuss the chalcedony-to-quartz transition near 200 °C:
  <https://pubs.usgs.gov/publication/70033407>.
- Heaney & Davis (1995) observed alternating defective chalcedony and coarser
  quartz in agate, supporting a recorded aggregate fabric rather than a quartz
  display alias: <https://pure.psu.edu/en/publications/observation-and-origin-of-self-organized-textures-in-agates/>.

### Production rule

| Candidate | Admitted field | Additional gates | Meaning in SIM 246 |
|---|---:|---|---|
| opal | 5-100 °C | amorphous-silica equilibrium exceeded; pH 6.5-10 | first-class hydrated/amorphous silica mineraloid |
| chalcedony | 0-200 °C | chalcedony equilibrium exceeded after opal is undersaturated; pH 3-10 | first-class fibrous aggregate with accepted shell/fabric records |
| quartz | 100-700 °C | quartz equilibrium exceeded after chalcedony is undersaturated, or above the chalcedony field | first-class crystalline SiO2 |

In the overlap, the more soluble phase gets the fresh-nucleation lead only while
its own equilibrium is exceeded (Ostwald stepping). Established chalcedony can
persist beside inward-growing macroquartz; it is not erased merely because the
fluid enters the quartz-only nucleation window.

Phase maturation is solution-mediated and mass-auditable: a dissolving opal or
chalcedony shell returns its exact booked SiO2 before the selected successor
spends it. Structural water remains diagnostic-only because the simulator has no
conserved H2O state. This limitation is displayed rather than hidden.

`banded_agate` now requires all three recorded properties: at least seven
accepted chalcedony layers, a silica-saturation contrast of at least 0.18, and
at least one direction reversal among changes of 0.03 or more. Basalt identity
alone grants nothing. Deccan therefore carries an executed Stage-I drawdown
followed by an Fe-Si replenishment; Ametista carries an executed dissolved-SiO2
pulse. A quartz-dominated filled cavity is never renamed agate by the renderer
or seal log.

### Carbonate-water competition

USGS distinguishes Yellowstone's silica-bearing alkaline-chloride waters from
Mammoth's relatively cool, limestone-reacted Ca-Mg-HCO3-SO4 water. USGS Bulletin
1444 reports about 54 mg/L SiO2 for Mammoth, versus roughly 420 mg/L in the
silica-depositing Norris endmember:
<https://pubs.usgs.gov/bul/1444/report.pdf>. SIM 246 blocks fresh generic silica
precipitation only when all measured chemistry conditions are present: shallow
(<=0.1 kbar), cool (<=100 °C), reactive silica below 75 ppm, and geometric-mean
carbonate load `sqrt(Ca * CO3)` at least 100 ppm and at least twice reactive
silica. Host-rock naming alone grants no suppression. The Creative hover panel
reports the actual measured competition. `tutorial_travertine` also disables
the generic sealed-fracture thermal pulse, which had been injecting 50-300 ppm
unadvertised SiO2 into an open surface spring.

### SIM 246 acceptance

- Mammoth/travertine seed 42 grows no quartz, chalcedony, or opal, and its hover
  explanation names carbonate-water competition.
- Low-temperature silica-rich fluid nucleates real opal; chalcedony-saturated
  fluid nucleates real chalcedony; depletion into the quartz-only window
  nucleates quartz without relabelling either precursor.
- Deccan and Ametista do Sul produce actual chalcedony before inward quartz;
  Ametista's agate label requires recorded banded-chalcedony fabric.
- High-temperature solution-mediated replacement returns exact booked SiO2.
- Neither the renderer nor the seal log calls a quartz-dominated cavity agate.

### Reactive versus particulate silica

The fluid state retains analytical `SiO2` and adds an explicit
`reactiveSilicaFraction`. Generic silica saturation, every Si-bearing formula
budget, shared-reagent competition, dissolution returns, and the hover
diagnostic spend only `SiO2 * reactiveSilicaFraction`. This prevents suspended
silt or ash from becoming aqueous silicic acid while preserving the reported
analytical load. Great Salt Plains and Searles Lake explicitly describe their
SiO2 as sediment/ash and therefore set the fraction to zero. Colorado Plateau
is deliberately reactive because its uranophane branch requires aqueous silica;
its free opal is a competing consequence of that choice. Fresh dissolved-Si
events set/add reactive silica through
the shared helper. Creative Mode exposes the fraction in setup, live editing,
search, evidence, and causal-probe surfaces.

### Pressure and deep quartz

The commissioned pressure packet is now load-bearing for quartz between
300-450 °C. The engine evaluates Manning (1994)
`log m = A(T) + B(T) log rho_H2O` using bilinear interpolation on the packet's
IAPWS density grid (300/450 °C; 0.5/1.8/3.1/4.4 kbar). It reproduces the
packet anchors 727/1199 ppm at 300 °C and 931/4945 ppm at 450 °C for
0.5/4.4 kbar. It does not extrapolate beyond the measured temperature
rectangle; outside it, the established low-temperature relation remains in
force. The hover panel reports fluid pressure, interpolated water density,
equilibrium ppm, and validity note. This makes pressure a mineral-specific
solubility control, not a universal growth multiplier.

### Substrate parity

Quartz-on-chalcedony maturation uses one executable-substrate registry shared
by production and hover diagnosis. The route records the exposed chalcedony as
the spatial host but has discount 1.0: no invented threshold reduction and no
growth-rate multiplier. The previous position-string `25x` quartz acceleration
has been removed. Thus the UI cannot advertise a catalytic advantage that the
engine does not execute, and the scenario cannot secretly buy growth by naming
a substrate.

### Seed-42 silica locality reconciliation

Comparison is against the SIM-245 baseline; only generic opal/chalcedony/quartz
changes are listed.

| Scenario group | SIM-246 verdict |
|---|---|
| Ametista do Sul, Deccan | Intended correction: first-class chalcedony precedes quartz; the agate label is licensed by recorded reversals. |
| Bisbee, Sulphur Bank | Retained: scenarios explicitly inject dissolved silica and the locality stories include silica/chrysocolla or hot-spring sinter. |
| Sweetwater (`reactive_wall`) | Removed after full forcing reconciliation: Bonneterre dolostone now supplies formula-balanced Ca-Mg-carbonate, Rowan & Leach's 105-125 °C advective brine replaces the generic cooling/reheat path, and no silica phase nucleates. Minor district quartz remains locality-licensed but is not fabricated by this acid-pulse specimen. |
| Elmwood | Retained: the locality record explicitly lists Quartz and "Silica"; cooling MVT brine crosses the chalcedony field. |
| Reactivated North-Pennine vein | Retained: its authored seal is carbonate/silica cement and the cooler reopened brine crosses the chalcedony field. |
| Roughten Gill | Retained: documented quartz gangue plus the authored 130->22 °C supergene transition supplies a low-temperature fibrous-silica path. |
| Naica | Retained but bounded: measured water carries about 25-30 ppm dissolved Si and the locality record licenses quartz/opal; the marginal post-drainage/reflood phase resolves as microcrystalline silica rather than high-T macroquartz. |
| Searles Lake | Removed: its 40-ppm field is explicitly playa silt/rhyolitic ash, not dissolved H4SiO4. Documented basin opal is not evidence that this seasonal broth may spend suspended ash. |
| Colorado Plateau | Retained after adversarial correction: the scenario's licensed uranophane branch requires dissolved silica, so declaring the whole pool particulate would falsely kill a Ca-uranyl silicate. Free opal remains an honest competing sink until a sourced complexation/speciation model can distinguish those aqueous routes. |
| Great Salt Plains | Removed and regression-locked: all analytical SiO2 is hourglass-inclusion sediment. |
| TN457 | Removed and regression-locked: its controlled Ba-Mn pulse experiment now grows barite without the old unauthored quartz/opal from stochastic thermal injections. |
| Tutorial First Crystal, radioactive pegmatite | Corrected forward succession: exposed stable quartz prevents a later cooling path from nucleating fresh metastable chalcedony/opal. |

### Sweetwater host and thermal reconciliation

Rowan (USGS OFR 87-675) records the ore in Bonneterre Dolomite, hydrothermal
vug-lining saddle/baroque dolomite, and Sweetwater among the sampled southern
mines where that cement is especially abundant. Rowan & Leach (1989,
*Economic Geology* 84:1948-1963, DOI 10.2113/gsecongeo.84.7.1948) report warm
about 105-125 °C saline inclusions, regional advective heat transport, and no
recognizable district-scale cooling signal capable of making silica a primary
precipitation driver. SIM 246 therefore uses a dolostone wall whose acid
dissolution releases one Ca, one Mg, and two carbonate formula units; slow
cooling while the feeder is open; and ordinary conductive cooling only after
the step-90 seal. The post-pulse pH rebound is modest and crosses the executable
dolomite barrier without an alkaline spike. Habit selection compares omega
relative to that barrier, restoring the documented saddle/baroque form instead
of the old raw-omega `massive` artifact.

### Remaining silica uncertainty

The equilibrium formulas and phase identity are explicit, but rates, the 200 °C
kinetic ceiling, and the measured-chemistry carbonate discriminator are
calibrated game-model parameters rather than a full reactive-transport
solution. The removed 25x substrate multiplier is not part of the current
model. The model does not resolve moganite
fraction, fibre handedness, water speciation, or quantitative agate
self-organization. Named chalcedony-class minerals such as chrysoprase remain
independent species-specific engines.

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

## SIM 243 remaining uncertainty (historical; the generic-chalcedony item is closed above)

- Closed in SIM 246: generic chalcedony/agate now has its own nucleation, aggregation, shell ledger, and solution-mediated transformation path. The current limitations are recorded in the SIM 246 section above.
- Sulfur isotope fractionation, aqueous polysulfides, thiosulfate, organic intermediates, and microbial energy yields remain outside the state vector.
- The legacy bulk-S proxy remains for old scenarios and saves. New mixed-valence scenarios must opt into explicit reservoirs.
