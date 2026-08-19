# Mammoth travertine benchmark receipt — 2026-08-08

## Verdict

`tutorial_travertine` is a **reduced pedagogical analogue** of the documented
Mammoth Hot Springs CO₂-loss pathway. It is not calibrated as a sample-for-sample
reproduction of the USGS outlet-water analysis. The scenario may teach the causal
sequence—pressure release, CO₂ escape, carbonate repartitioning, and CaCO₃
precipitation—but it must preserve the differences below as disclosed model error.

Primary locality source: [USGS Bulletin 1444, section 2](https://npshistory.com/publications/geology/bul/1444/sec2.htm).
The source reports a composite Mammoth analysis, gas that is 98.48–99.70% CO₂,
and the observation that pressure greater than about 6 kg/cm² is needed to keep
the gas dissolved; pressure loss and CO₂ escape then precipitate travertine.

## Field-by-field comparison

| Quantity | USGS analysis | Authored initial state | Status |
|---|---:|---:|---|
| Temperature | 69 °C | 70 °C | Close analogue (+1 °C). |
| pH | 7.2 | 6.5 | Deliberately more CO₂-rich upstream start; not an analytical match. |
| Ca | 323 mg/L | 350 mg/kg | Close analogue; L/kg density conversion is omitted. |
| Mg | 67 mg/L | 30 mg/kg | Underrepresented by 37 mg per nominal kg/L comparison. |
| Na | 130 mg/L | 200 mg/kg | Overrepresented; retained as authored recipe, not measured truth. |
| K | 54 mg/L | not authored | Missing. |
| Li | 1.6 mg/L | not authored | Missing. |
| SiO₂ | 54 mg/L | 54 mg/kg | Numerically matched; density conversion is omitted. |
| HCO₃ | 755 mg/L = 12.37 mmol C/L | 500 mg/kg as CO₃-equivalent DIC = 8.332 mmol C/kg | About 33% lower on the nominal L≈kg comparison. The two mass labels are not interchangeable without this molar conversion. |
| SO₄ | 563 mg/L | 50 mg/kg legacy bulk `S` | Not comparable. The scenario does not reproduce measured sulfate or its acid/base contribution. |
| Cl | 163 mg/L | 300 mg/kg | Overrepresented. |
| F | 2.5 mg/L | 3 mg/kg | Close analogue. |
| B | 4.1 mg/L | not authored | Missing buffer; solver flags omitted full-alkalinity systems. |
| As | 0.9 mg/L | not authored | Missing. |
| H₂S | 2.4 mg/L | not authored | Missing gas/redox species. |

At 69 °C, liquid-water density is below 1 kg/L, so the mg/L observations and
mg/kg recipe are not exactly identical even where the numbers match. The current
v1 solver intentionally does not claim that conversion or a complete analytical
reconstruction.

## Executed seed-42 receipt

Run seed is 42; the scenario's authored `shape_seed` is 4. The executable
receipt is `node tools/carbonate-boundary-observe.mjs`.

| Boundary event | Target pCO₂ | Carbon exported | Solved pH | DIC after |
|---|---:|---:|---:|---:|
| Upper Vent, step 10 | 0.08 bar | 7.4627 mmol C/kg | 6.9617 | 6.1924 mmol C/kg |
| Terrace Run, step 25 | 0.02 bar | 2.9614 mmol C/kg | 7.5616 | 5.3340 mmol C/kg |
| Apron Vent, step 40 | 0.004 bar | 0.8589 mmol C/kg | 8.2497 | 5.0359 mmol C/kg |

Across 60 closed aqueous/headspace equilibration transactions, the maximum
carbon residual is `2.082e-17 mol/kg`. Cumulative export is 11.2830 mmol C/kg;
no failed or unresolved transfer is recorded. The reduced-alkalinity inventory
remains 0.005071945724 eq/kg through gas exchange. Calcite and aragonite are the
only accepted solid carbon sinks in this scenario.

## Claim boundary

The run supports: **open-system CO₂ loss can lower DIC while raising pH and
CaCO₃ saturation, producing a broad travertine coating.** It does not support a
claim of quantitative Mammoth-water calibration, sulfate/full-alkalinity
closure, kinetic gas-transfer rate, two-phase boiling, or measured headspace
volume. Those omissions remain surfaced as uncertainties rather than hidden in
narrative prose.
