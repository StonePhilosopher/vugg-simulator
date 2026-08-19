// ============================================================
// js/70l-co2-events.ts — CO₂ degas + charge event handlers
// ============================================================
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 3b: scenario events that
// drive carbonate precipitation through the CO₂ → pH → calcite
// cascade. Hot-spring travertine, cave flowstone, and the slow
// expulsion of CO₂ from cooling veins are all the same mechanism:
// CO₂ leaves the fluid (as gas, via boiling, depressurization, or
// outgassing through a fracture), pH rises, the CO₃²⁻ fraction of
// DIC grows, and calcite (or any carbonate) supersaturates without
// any other change.
//
// Every handler requires the conserved DIC + reduced-alkalinity boundary.
// Missing state is a recorded configuration violation and leaves the fluid,
// temperature, and depositional mode untouched. There is no fixed-DIC or
// fixed-pH fallback.

function _refuseCO2EventWithoutConservedBoundary(c: any, attemptedKind: string, note: string): string {
  c._pending_carbonate_boundary_violation = {
    ok: false,
    kind: 'carbonate_boundary_required',
    attemptedKind,
    error: 'co2_event_requires_conserved_carbonate_boundary',
    note,
  };
  return `CO₂ ${attemptedKind} refused: conserved DIC, reduced alkalinity, and an explicit gas boundary are required; no chemistry was mutated.`;
}

// CO₂ degassing — fluid loses CO₂ as gas (boiling, depressurization,
// venting through a fracture). DIC drops; pH rises because each CO₂
// leaving takes its conjugate H⁺ along (CO₂ + H₂O ⇌ H⁺ + HCO₃⁻
// reverses).
//
// The event solves to its authored gas boundary. It never removes a fixed
// percentage or imposes a fixed pH increment.
function event_co2_degas(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (boundary) {
    if (boundary.blocked) return 'CO₂ vent paused: the spatial/transfer audit is unresolved.';
    const unresolved = recordUnresolvedCarbonateTransferState(
      boundary, dicPpmToMolKg(c.fluid.CO3), 'pre-vent DIC audit',
    );
    if (unresolved) return 'CO₂ vent paused: DIC changed without a declared boundary or simple-CaCO₃ transaction.';
    const target = Math.max(
      1e-12,
      Number(eventSpec.target_pCO2_bar) || Number(boundary.targetPCO2Bar) || 4.2e-4,
    );
    const tx = equilibrateOpenCarbonateBoundaryState(
      boundary,
      c.fluid,
      c.temperature,
      target,
      eventSpec.name || 'CO2 vent',
    );
    if (!tx?.ok) {
      return `CO₂ vent paused: the carbonate boundary solve failed (${tx?.error || 'unknown error'}); fluid state was not mutated.`;
    }
    const boundaryDelta = Number(tx.boundaryDeltaMolKg) || 0;
    const transferred = Math.abs(boundaryDelta) * 1000;
    const direction = boundaryDelta <= 0 ? 'exports' : 'imports';
    const process = boundaryDelta <= 0
      ? 'vents'
      : 'equilibrates in the reverse direction (CO₂ charging rather than venting)';
    return (
      `COâ‚‚ ${process} at an authored ${target.toExponential(2)} bar boundary. ` +
      `The solved carbonate system ${direction} ${transferred.toFixed(3)} mmol C/kg; ` +
      `pH becomes ${c.fluid.pH.toFixed(2)} and DIC becomes ` +
      `${(tx.after.dicMolKg * 1000).toFixed(3)} mmol C/kg. Reduced carbonate ` +
      `alkalinity is conserved; no fixed pH increment or boiling claim is used.`
    );
  }
  return _refuseCO2EventWithoutConservedBoundary(c, 'vent', eventSpec.name || 'CO2 vent');
}

// Tutorial variant — combines CO₂ degas with re-heating to model an
// active hot spring where new hot CO₂-rich fluid keeps arriving as
// each pulse degasses. Without the re-heat, ambient_cooling decays
// T toward 25 °C and calcite (retrograde solubility) loses the
// thermal assist that makes natural travertine work. Used by
// tutorial_travertine.
function event_co2_degas_with_reheat(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (boundary) {
    if (boundary.blocked) return 'Heated CO₂ vent paused: the spatial/transfer audit is unresolved.';
    const oldT = c.temperature;
    const reheatT = Number.isFinite(eventSpec.reheat_C)
      ? Number(eventSpec.reheat_C)
      : 70;
    const unresolved = recordUnresolvedCarbonateTransferState(
      boundary, dicPpmToMolKg(c.fluid.CO3), 'pre-vent DIC audit',
    );
    if (unresolved) return 'Heated CO₂ vent paused: DIC changed without a declared boundary or simple-CaCO₃ transaction.';
    const target = Math.max(
      1e-12,
      Number(eventSpec.target_pCO2_bar) || Number(boundary.targetPCO2Bar) || 4.2e-4,
    );
    const tx = equilibrateOpenCarbonateBoundaryState(
      boundary,
      c.fluid,
      reheatT,
      target,
      eventSpec.name || 'heated CO2 vent',
    );
    if (!tx?.ok) {
      return `Heated CO₂ vent paused: the carbonate boundary solve failed (${tx?.error || 'unknown error'}); fluid state was not mutated.`;
    }
    c.temperature = reheatT;
    const boundaryDelta = Number(tx.boundaryDeltaMolKg) || 0;
    if (boundaryDelta <= 0) c._calciteDepositionalMode = 'travertine';
    const transferred = Math.abs(boundaryDelta) * 1000;
    const direction = boundaryDelta <= 0 ? 'leaves' : 'enters';
    const process = boundaryDelta <= 0
      ? 'vents toward'
      : 'equilibrates in reverse toward';
    return (
      `Geothermal heat restores ${oldT.toFixed(1)} â†’ ${c.temperature.toFixed(1)}Â°C; ` +
      `the water then ${process} ${target.toExponential(2)} bar pCOâ‚‚. ` +
      `${transferred.toFixed(3)} mmol C/kg ${direction} the aqueous+headspace system; ` +
      `the conserved-alkalinity solve gives pH ${c.fluid.pH.toFixed(2)} and ` +
      `DIC ${(tx.after.dicMolKg * 1000).toFixed(3)} mmol C/kg. This is heat ` +
      `recharge, not an undeclared replacement-water or boiling shortcut.`
    );
  }
  return _refuseCO2EventWithoutConservedBoundary(
    c, 'heated_vent', eventSpec.name || 'heated CO2 vent',
  );
}

// CO₂ charge — fresh fluid pulse with elevated pCO₂ (deep magmatic
// source, organic decay seep, fresh meteoric water that picked up
// soil-zone CO₂). DIC rises; pH drops because new CO₂ adds H⁺ via
// CO₂ + H₂O → H⁺ + HCO₃⁻.
//
// The event adds an authored pure-CO₂ amount to the declared headspace and
// derives pH from DIC + alkalinity. It never adds fixed DIC or subtracts pH.
function event_co2_charge(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (boundary) {
    if (boundary.blocked) return 'CO₂ charge paused: the spatial/transfer audit is unresolved.';
    const unresolved = recordUnresolvedCarbonateTransferState(
      boundary, dicPpmToMolKg(c.fluid.CO3), 'pre-charge DIC audit',
    );
    if (unresolved) return 'CO₂ charge paused: DIC changed without a declared boundary or simple-CaCO₃ transaction.';
    const hasMolarCharge = Object.prototype.hasOwnProperty.call(eventSpec, 'carbon_mol_per_kg');
    const hasPpmCharge = Object.prototype.hasOwnProperty.call(eventSpec, 'dic_as_co3_ppm');
    const authoredCharge = hasMolarCharge
      ? Number(eventSpec.carbon_mol_per_kg)
      : hasPpmCharge
        ? dicPpmToMolKg(Number(eventSpec.dic_as_co3_ppm))
        : dicPpmToMolKg(100);
    if (!Number.isFinite(authoredCharge)) {
      return 'CO₂ charge refused: the authored carbon charge must be finite; no chemistry was mutated.';
    }
    const chargeMolKg = Math.max(0, authoredCharge);
    const oldPH = c.fluid.pH;
    const tx = chargeCarbonateBoundaryState(
      boundary,
      c.fluid,
      c.temperature,
      chargeMolKg,
      eventSpec.name || 'pure CO2 charge',
    );
    if (!tx?.ok) {
      return `CO₂ charge paused: the carbonate boundary solve failed (${tx?.error || 'unknown error'}); fluid state was not mutated.`;
    }
    return (
      `Pure COâ‚‚ charge imports ${(chargeMolKg * 1000).toFixed(3)} mmol C/kg ` +
      `into the declared headspace. Closed equilibration conserves carbon ` +
      `(residual ${(tx.carbonErrorMolKg * 1e9).toFixed(3)} nmol/kg) and leaves ` +
      `reduced carbonate alkalinity unchanged; solved pH ${oldPH.toFixed(2)} â†’ ` +
      `${c.fluid.pH.toFixed(2)}.`
    );
  }
  return _refuseCO2EventWithoutConservedBoundary(c, 'charge', eventSpec.name || 'pure CO2 charge');
}

// Replacement-water recharge. Both incoming DIC and reduced carbonate
// alkalinity are mandatory authored boundary conditions. This is deliberately
// separate from pure-CO2 charge: water carries acid/base capacity and exports
// the displaced aqueous carbon even when the net DIC change is zero.
function event_carbonate_recharge(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (!boundary) {
    return 'Carbonate recharge refused: conserved DIC, reduced alkalinity, and a gas boundary are required.';
  }
  if (boundary.blocked) return 'Carbonate recharge paused: the spatial/transfer audit is unresolved.';
  const fraction = Number(eventSpec.replace_fraction);
  const incomingPpm = Number(eventSpec.incoming_dic_as_co3_ppm);
  const incomingAlkalinity = Number(eventSpec.incoming_reduced_alkalinity_eq_per_kg);
  if (!Number.isFinite(fraction) || !Number.isFinite(incomingPpm) || !Number.isFinite(incomingAlkalinity)) {
    return 'Carbonate recharge refused: replace_fraction, incoming_dic_as_co3_ppm, and incoming_reduced_alkalinity_eq_per_kg are all required.';
  }
  const unresolved = recordUnresolvedCarbonateTransferState(
    boundary, dicPpmToMolKg(c.fluid.CO3), 'pre-recharge DIC audit',
  );
  if (unresolved) return 'Carbonate recharge paused: DIC changed without a declared boundary or simple-CaCO3 transaction.';
  const tx = rechargeCarbonateBoundaryState(
    boundary,
    c.fluid,
    c.temperature,
    fraction,
    dicPpmToMolKg(incomingPpm),
    incomingAlkalinity,
    eventSpec.name || 'replacement-water recharge',
  );
  if (!tx?.ok) {
    return `Carbonate recharge paused: the carbonate boundary solve failed (${tx?.error || 'unknown error'}); fluid state was not mutated.`;
  }
  return (
    `Replacement water exchanges ${(fraction * 100).toFixed(1)}% of the aqueous control volume. ` +
    `The ledger separately exports ${(tx.boundaryExportMolKg * 1000).toFixed(3)} and imports ` +
    `${(tx.boundaryImportMolKg * 1000).toFixed(3)} mmol C/kg; incoming reduced alkalinity was ` +
    `${incomingAlkalinity.toExponential(3)} eq/kg. Closed re-equilibration gives pH ` +
    `${c.fluid.pH.toFixed(2)} with carbon residual ${(tx.carbonErrorMolKg * 1e9).toFixed(3)} nmol/kg.`
  );
}
