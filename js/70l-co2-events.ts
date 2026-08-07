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
function event_co2_degas(c) {
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
function event_co2_degas_with_reheat(c) {
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
function event_co2_charge(c) {
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
