// ============================================================
// js/70g-tutorial-scenarios.ts — events for tutorial scenarios
// ============================================================
// Extracted from 70-events.ts. 3 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.



function event_tutorial_temperature_spike(c) {
  // Quartz solubility rises strongly with temperature. From the tutorial's
  // 220°C quartz-growth stage, a hot recharge to 420°C moves the unchanged
  // 600-ppm fluid below quartz equilibrium, so the accepted crystal record
  // changes from positive growth to real mass-balanced dissolution.
  c.temperature = 420.0;
  return 'A much hotter recharge enters the vug. At 420°C water can hold far more dissolved silica, so the fluid is now undersaturated with respect to quartz. Growth stops and the existing crystal begins returning its booked SiO2 to solution. Conditions control both growth and dissolution.';
}

function event_tutorial_mn_pulse(c) {
  // Push Mn well past calcite's 2 ppm activator threshold. From a
  // starting 8 ppm this lands at ~38 ppm — saturating Mn in the next
  // calcite zones, but well below the rhodochrosite supersaturation
  // requirement in this broth.
  c.fluid.Mn += 30.0;
  return 'A fresh fluid pulse brings extra manganese into the broth. The next zones of calcite to grow will incorporate Mn²⁺ as a trace dopant — the same activator that lights up the Franklin / Sterling Hill specimens under longwave UV. The iron in the broth still quenches most of it for now, but the chemistry is set: Mn²⁺ is being recorded into every growth ring from this moment forward.';
}

function event_tutorial_fe_drop(c) {
  // Crash Fe to ~5% of its current value (60 → 3 since the v225 broth
  // retune; zone image 0.24, clearly under the engine ladder's Fe < 0.4
  // brilliant gate — the taught "full brightness" is chemically true).
  c.fluid.Fe = Math.max(0.0, c.fluid.Fe * 0.05);
  return 'An iron-poor recharge flushes the system. Fe²⁺ — the quencher — falls below the suppression threshold. The Mn-doped zones that grow next will fluoresce at full brightness. The boundary between the dim early zones and the bright new ones records the exact moment the iron dropped out of the broth. The crystal is now a stratigraphic record of the chemistry you played with.';
}
