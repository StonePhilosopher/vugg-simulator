# Local pyrite acidity / finite calcite pilot

This is an **isolated mechanism experiment**, based on main
`2f81c230cd17e0b9307401da441a30151ba080c3`. It does not connect to either
shipped runtime, change a scenario, replace the fully mixed carbonate boundary,
or introduce UV kinetics. Production integration remains withheld.

The existing game has carbonate accounting. Its missing coupling is local
reaction/transport/speciation, not an absent global carbonate ledger. This
experiment transports component amounts and acid-base equivalents and then
derives local pH. It never transports, averages, or directly decrements pH.

## Executable contract

| Quantity | Units and owner | Meaning |
| --- | --- | --- |
| `waterKg` | kg solvent, cell inventory | Finite water used to convert amounts into mol/kg water. Net water consumed by the declared oxidation pathways is debited. |
| `aqueous.Ca`, `C`, `FeII`, `sulfate`, `Na`, `Cl` | mol, cell ledger | Total dissolved calcium, inorganic C(IV), Fe(II), S(VI), sodium and chloride. These are analytical totals, not individual free-ion concentrations. |
| `aqueous.O2` | mol O2 molecules, cell ledger | Finite molecular oxidant. PHREEQC's O(0) input uses **twice** this amount in mol oxygen atoms. No atmospheric oxygen refill is implied. |
| `aqueous.alkalinity` | eq, cell ledger | Acid-base component on the declared Ca/Fe(II)/Na/Cl/sulfate reference. For this restricted system it equals `2 Ca + 2 FeII + Na - Cl - 2 sulfate`. It can be negative. |
| `solid.pyrite`, `calcite`, `ferricHydroxide` | mol formula units, cell ledger | Finite FeS2 and CaCO3 stocks and prescribed Fe(OH)3 product. No display geometry, mass-volume conversion or phase selection is inferred. |
| `ledger.acidProduced` | eq, accepted reactions | `2 pyriteOxidized + 2 ferrousOxidized`. This is generated acidity, not free H+ remaining after buffering. |
| `ledger.O2Consumed`, `waterConsumed` | mol O2 / mol H2O, accepted reactions | Oxidant use and net pathway water demand. |
| `ledger.carbonFromGas` | signed mol C, external boundary | Positive for net CO2 entry, negative for net loss. Zero for closed carbon. |
| pH, saturation indices, aqueous speciation | PHREEQC observations | Reconstructed from the declared composition; never authoritative conserved inputs. `pH 7 charge` is an initial numerical guess followed by charge-balance solution, not a pH reset. |

`ledger.mjs` owns accepted extents and conservative transfers. Each operation
returns a new cell; input cells remain unchanged. `phreeqc.mjs` supplies local
speciation and finite-calcite closure. `experiment.mjs` declares the fixture and
reaction schedule. `commission.mjs` commissions and checks actual external runs.

The two iron steps are explicitly distinct:

```
FeS2 + 3.5 O2 + H2O -> Fe2+ + 2 SO4(2-) + 2 H+
Fe2+ + 0.25 O2 + 2.5 H2O -> Fe(OH)3(s) + 2 H+
```

Each accepted extent is capped separately by its reactant, O2 and positive
water inventories. Four equivalents per pyrite require completion of **both**
steps. Transport changes available oxygen, so equal requested pyrite pulses
need not produce equal accepted extents across cases. Oxygen-limited Fe(II)
persists in the record; a requested hydroxide endpoint is not permission to
grant the missing protons or pretend all iron precipitated.

One cycle applies oxidation, local finite calcite dissolution, conservative
exchange, then local finite calcite dissolution/speciation after arrival. A
reported frame therefore does not show an unbuffered numerical pulse waiting
for the next split interval. Calcite reacts to saturation if sufficient stock
exists, or dissolves completely if exhausted. Precipitation is excluded. This
is a **local equilibrium approximation**, not a carbonate dissolution rate law.

Exchange swaps the same mass of water both ways, using donor molalities, and
transfers all aqueous component amounts and alkalinity. Solids stay in their
cells. The exchange fraction is authored, bounded in [0, 0.5], and works for
unequal finite water masses. It is not a measured diffusion coefficient,
electrodiffusion calculation, flow speed, halo radius, or elapsed time.

All speciation calls are at 25 C and 1 atm. Initial-solution calculations
specify Fe(II), S(VI), C(IV), and O(0) separately: they intentionally do not
force redox equilibrium between dissolved oxygen and Fe(II). The prescribed
reaction operators own oxidation, rather than letting an equilibrium solver
silently perform another kinetic reaction. The returned fixed components,
valence states, solvent mass, charge and alkalinity are checked before use.

Closed carbon preserves aqueous plus calcite carbon. Fixed-pCO2 sets
`CO2(g) = -3.5` independently in each cell, with an explicit signed carbon flux.
Carbon conservation subtracts that flux. CO2 transfer changes DIC, not total
alkalinity. These are different experiments, not interchangeable descriptions
of one transient pore.

## Evidence and limits

The receipt binds the pilot sources/inputs and runtime contract, exact Node runtime, USGS
executable, database, original example and compressed transcript by SHA-256.
`reference-transcript.json.gz` contains **every executed PHREEQC input and
selected output**. Full solver logs and individual calls remain under ignored
`.local-evidence/acid-buffer-pilot/`. No third-party binary is committed.

The commissioned fixture uses two 1 kg water cells, finite pyrite in A and
finite calcite in B, four requested oxidation pulses, and 16 exchange cycles.
These amounts (including 3 mmol starting O2) are declared experimental inputs,
not a measured natural-vug oxygen concentration or a calibrated rate. The
initial carbonate equilibration is completed and inventoried before the
no-transport control snapshot is taken.

| Case | Final pH A / B | Calcite consumed in B after initialization |
| --- | --- | --- |
| Closed C, Fe(II), no transport | 2.86808 / 9.91181 | **0**; every chemical amount in B remains unchanged |
| Closed C, Fe(II), exchange | 6.75238 / 6.75398 | 0.970799 mmol |
| Closed C, hydroxide pathway, exchange | 3.67438 / 3.67625 | 0.970799 mmol |
| Fixed-pCO2, hydroxide pathway, exchange | 3.67670 / 3.67842 | 0.596795 mmol |

The transported Fe(II) control sends iron and sulfate into B and releases Ca
and inorganic carbon as calcite is lost. The hydroxide pathway demonstrates
buffer exhaustion and acid breakthrough. Fe, S, Ca, C (including external gas
flux), Na, Cl, consumed-plus-remaining O2, net pathway water and the acid-base
ledger close at every recorded checkpoint. The maximum observed residual is
below `2e-18` in the quantity's units; acceptance is absolute `2e-11` mol,
eq, or kg as appropriate for these bounded fixtures. This is **not** a claim
to full elemental H/O closure of all aqueous species and solvent redistribution.
Individual reaction atom/charge balances are tested independently.

Calcite bisection requires |SI| <= `1e-9` within 64 iterations or fails visibly.
The same tolerance prevents repeated tiny dissolution of an already closed
endpoint. Insufficient stock is a separate, explicitly recorded endpoint.
pH outside [0, 14], nonfinite outputs, unsupported boundaries, missing external
observations, or uncommissioned dependencies fail; there is no guessed-pH
fallback. The gas check allows `2e-6` in log pressure, including PHREEQC's
~`7.6e-7` fugacity correction at these conditions.

Two Fe-free controls compare this initial-solution/bisection route with native
PHREEQC `EQUILIBRIUM_PHASES`. On a **common kg-water basis**, pH differs by at
most `2.97e-8`, Ca by `7.49e-11` mol/kgw and C by `1.46e-10` mol/kgw
(limits: `2e-6`, `2e-10`, `2e-10`). Native batch equilibrium additionally
redistributes solvent H/O. Its water differs by `2.68e-7` kg (closed) and
`6.99e-6` kg (open); absolute dissolved-calcite amounts differ by up to
`3.45e-9` mol. These differences remain in the receipt. No inventory is
rescaled to hide them. The pilot tracks net oxidation-pathway water, not that
complete solvent redistribution; production use needs its own water/H/O contract.

Three equilibrium reference runs are deliberately separate from the transient
experiment: the **untouched** distribution `examples/ex5`, an instrumented
version with identical reaction/phase inputs, and a variant removing only
the fixed CO2 phase. Their equilibrium phases include pyrite, calcite,
goethite and possible gypsum. The pilot instead prescribes Fe(OH)3 and does
not allow gypsum; their final pH values are not expected to coincide.

The older [USGS Example 5 guide](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-67.htm)
reports 9.55 mmol gypsum at 50 mmol added O2. The pinned 3.8.6 distribution and
database produce **8.97555 mmol**, including when the original example is
executed untouched. The instrumented run agrees with that original output
to its printed precision. The receipt records the 0.57445 mmol guide discrepancy;
its cause has not been isolated. This is qualitative agreement with the older
guide and exact-version numerical evidence, **not** reproduction of 9.55 mmol.
Nothing is tuned to erase the difference.

The general local oxidation/buffering mechanism is supported by
[Battistel et al.](https://doi.org/10.1016/j.apgeochem.2018.10.026),
[Wang et al.](https://doi.org/10.1144/geochem2022-021), and
[Haas et al.](https://doi.org/10.1039/D3VA00399J). These do not supply a universal
vug halo geometry or a UV photochemical rate law.

## Reproduce

Use commissioned Windows x64 / Node **24.15.0**. Download the official
[USGS batch package](https://water.usgs.gov/water-resources/software/PHREEQC/).
The pinned MSI SHA-256 is
`6e5f6697fa727f919eb4e7c1c2bc20e8c2717378aaf77731efd831ef66578243`.
For a private administrative extraction (no system-wide installation), from
the repo root in PowerShell:

```powershell
$taskDep = Join-Path (Get-Location) '.local-evidence/acid-buffer-pilot/dependency'
New-Item -ItemType Directory -Force $taskDep | Out-Null
$taskMsi = Join-Path $taskDep 'phreeqc-3.8.6-17100-x64.msi'
Invoke-WebRequest 'https://water.usgs.gov/water-resources/software/PHREEQC/phreeqc-3.8.6-17100-x64.msi' -OutFile $taskMsi
if ((Get-FileHash -Algorithm SHA256 $taskMsi).Hash.ToLowerInvariant() -ne '6e5f6697fa727f919eb4e7c1c2bc20e8c2717378aaf77731efd831ef66578243') { throw 'MSI hash mismatch' }
$taskImage = Join-Path $taskDep 'extracted'
$taskArgs = @('/a', ('"' + $taskMsi + '"'), '/qn', ('TARGETDIR="' + $taskImage + '"'))
$taskExtract = Start-Process msiexec.exe -ArgumentList $taskArgs -WindowStyle Hidden -Wait -PassThru
if ($taskExtract.ExitCode -ne 0) { throw "Extraction failed: $($taskExtract.ExitCode)" }
$taskPhreeqcRoot = Join-Path $taskImage 'phreeqc-3.8.6-17100-x64'
node pilots/local-acid-buffer/commission.mjs --check --phreeqc-root $taskPhreeqcRoot
```

The check executes the solver again and compares results with the committed
receipt. `--write` is the separate commissioning operation after intentional
semantic/input changes; review the new results and regenerate both receipt
and transcript together. No automatic download, installation, rebake, server
or background service runs when importing or testing the pilot.

```text
npm test -- --file tests-js/local-acid-buffer.test.ts
npm run typecheck
npm run build:check
```

The focused test command is durable in Windows CI. It runs unit tests and
**offline replay of previously executed external outputs** through the current
operators, with source/hash checks. CI does not install PHREEQC and does not
claim a new live solver run. The local `--check` supplies that separate witness.

Legacy gameplay fluids are not imported or assigned invented alkalinity from
their pH. No production cell format or save migration is introduced. Physical
time/transport, competing redox/mineral pathways, full water/H/O coupling and
gameplay integration remain outside this pilot's demonstrated boundary.
Any UV acceleration remains a separate evidence-bearing rate-law decision.
