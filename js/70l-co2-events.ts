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
// Couples deliberately with PROPOSAL-VOLATILE-GASES (Rock Bot,
// 2026-05-04, on canonical) — when its volatiles dict lands, these
// handlers will additionally update volatiles['CO2'] (i.e. the
// gas-phase pCO₂). Until then, they manipulate only the aqueous
// side: drop DIC, raise pH (degas) or raise DIC, drop pH (charge).
// The pH shift is calibrated so the carbonate-system stays roughly
// in equilibrium per equilibriumPCO2 — Phase 3c can refine via
// proper Newton iteration on the Bjerrum equations if needed.

// CO₂ degassing — fluid loses CO₂ as gas (boiling, depressurization,
// venting through a fracture). DIC drops; pH rises because each CO₂
// leaving takes its conjugate H⁺ along (CO₂ + H₂O ⇌ H⁺ + HCO₃⁻
// reverses).
//
// Default: removes 30% of DIC, raises pH by 0.5 (clamped at 9.5).
// Scenarios can subclass via additional fields if/when needed; for
// now this is the single canonical degas event.
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
    const exported = Math.max(0, -tx.boundaryDeltaMolKg) * 1000;
    return (
      `COâ‚‚ vents to an authored ${target.toExponential(2)} bar boundary. ` +
      `The solved carbonate system exports ${exported.toFixed(3)} mmol C/kg; ` +
      `pH becomes ${c.fluid.pH.toFixed(2)} and DIC becomes ` +
      `${(tx.after.dicMolKg * 1000).toFixed(3)} mmol C/kg. Reduced carbonate ` +
      `alkalinity is conserved; no fixed pH increment or boiling claim is used.`
    );
  }
  const oldDIC = c.fluid.CO3;
  const oldPH = c.fluid.pH;
  const fraction = 0.3;
  c.fluid.CO3 = oldDIC * (1 - fraction);
  c.fluid.pH = Math.min(9.5, oldPH + 0.5);
  return (
    `CO₂ degasses — fluid loses ${(fraction * 100).toFixed(0)}% of its dissolved ` +
    `inorganic carbon as gas. pH rises ${oldPH.toFixed(2)} → ${c.fluid.pH.toFixed(2)}; ` +
    `DIC drops ${oldDIC.toFixed(0)} → ${c.fluid.CO3.toFixed(0)} ppm. ` +
    `Carbonate supersaturation jumps because the CO₃²⁻ fraction of DIC grows ` +
    `with pH (Bjerrum partition). The same mechanism that builds travertine ` +
    `at hot springs and flowstone in caves.`
  );
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
    c._calciteDepositionalMode = 'travertine';
    const exported = Math.max(0, -tx.boundaryDeltaMolKg) * 1000;
    return (
      `Geothermal heat restores ${oldT.toFixed(1)} â†’ ${c.temperature.toFixed(1)}Â°C; ` +
      `the water then vents toward ${target.toExponential(2)} bar pCOâ‚‚. ` +
      `${exported.toFixed(3)} mmol C/kg leaves the aqueous+headspace system; ` +
      `the conserved-alkalinity solve gives pH ${c.fluid.pH.toFixed(2)} and ` +
      `DIC ${(tx.after.dicMolKg * 1000).toFixed(3)} mmol C/kg. This is heat ` +
      `recharge, not an undeclared replacement-water or boiling shortcut.`
    );
  }
  const oldDIC = c.fluid.CO3;
  const oldPH = c.fluid.pH;
  const oldT = c.temperature;
  const fraction = 0.3;
  c.fluid.CO3 = oldDIC * (1 - fraction);
  c.fluid.pH = Math.min(9.5, oldPH + 0.5);
  c.temperature = 75;
  // This canonical event is an actively vented hot-spring recharge: repeated
  // CO2 loss plates a terrace crust. Store the executed depositional pathway
  // so calcite habit follows mechanism, not merely a Ca/DIC ratio that also
  // occurs in sabkhas and cave drip films.
  c._calciteDepositionalMode = 'travertine';
  return (
    `Fresh hot pulse degasses — new CO₂-rich water from depth replaces ` +
    `what cooled. T resets to ${c.temperature}°C; DIC drops ` +
    `${oldDIC.toFixed(0)} → ${c.fluid.CO3.toFixed(0)} ppm as CO₂ escapes; ` +
    `pH rises ${oldPH.toFixed(2)} → ${c.fluid.pH.toFixed(2)}. Each pulse ` +
    `nudges the carbonate system toward calcite saturation: lower DIC, ` +
    `higher pH means a much higher CO₃²⁻ fraction (Bjerrum cascade).`
  );
}

// CO₂ charge — fresh fluid pulse with elevated pCO₂ (deep magmatic
// source, organic decay seep, fresh meteoric water that picked up
// soil-zone CO₂). DIC rises; pH drops because new CO₂ adds H⁺ via
// CO₂ + H₂O → H⁺ + HCO₃⁻.
//
// Default: adds 100 ppm DIC, drops pH by 0.5 (clamped at 4.0).
// Carbonates already in the cavity become subsaturated — they may
// dissolve and free their cations back to the fluid, the
// well-known "CO₂ pulse erodes existing speleothems" mechanism.
function event_co2_charge(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (boundary) {
    if (boundary.blocked) return 'CO₂ charge paused: the spatial/transfer audit is unresolved.';
    const unresolved = recordUnresolvedCarbonateTransferState(
      boundary, dicPpmToMolKg(c.fluid.CO3), 'pre-charge DIC audit',
    );
    if (unresolved) return 'CO₂ charge paused: DIC changed without a declared boundary or simple-CaCO₃ transaction.';
    const chargeMolKg = Math.max(
      0,
      Number(eventSpec.carbon_mol_per_kg)
        || dicPpmToMolKg(Number(eventSpec.dic_as_co3_ppm) || 100),
    );
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
  const oldDIC = c.fluid.CO3;
  const oldPH = c.fluid.pH;
  const addDIC = 100;
  c.fluid.CO3 = oldDIC + addDIC;
  c.fluid.pH = Math.max(4.0, oldPH - 0.5);
  return (
    `Magmatic CO₂ pulse — fresh fluid carrying elevated pCO₂ enters the cavity. ` +
    `DIC rises ${oldDIC.toFixed(0)} → ${c.fluid.CO3.toFixed(0)} ppm; ` +
    `pH drops ${oldPH.toFixed(2)} → ${c.fluid.pH.toFixed(2)}. ` +
    `Existing carbonates may begin to corrode as σ drops below 1; the fluid ` +
    `is now more aggressive toward limestone walls and any pre-existing calcite.`
  );
}

// Replacement-water recharge. Both incoming DIC and reduced carbonate
// alkalinity are mandatory authored boundary conditions. This is deliberately
// separate from pure-CO2 charge: water carries acid/base capacity and exports
// the displaced aqueous carbon even when the net DIC change is zero.
function event_carbonate_recharge(c, eventSpec: any = {}) {
  const boundary = c._carbonateBoundaryState;
  if (!boundary) {
    return 'Carbonate recharge refused: this scenario uses the legacy fixed-DIC heuristic and has no conserved boundary.';
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
