// ============================================================
// js/70g-tutorial-scenarios.ts — events for tutorial scenarios
// ============================================================
// Extracted from 70-events.ts. 3 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.



function event_tutorial_temperature_drop(c) {
  // Knock T down by 80°C, never below ambient. From 180°C this lands
  // ~100°C — outside quartz's comfort window for sustained growth, but
  // not so cold the existing crystal immediately re-dissolves.
  c.temperature = Math.max(25.0, c.temperature - 80.0);
  return 'The vug cools quickly. Temperature drops out of quartz\'s growth window — the silica supply that was happily plating onto the crystal a moment ago no longer wants to leave the fluid. Growth slows, then stops. The crystal is still there, still beautiful, but nothing new is forming on its faces. Conditions matter; minerals only grow when the broth wants to give them up.';
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
  // Crash Fe to ~5% of its current value (10 → 0.5). The quenching
  // threshold is in the low single digits; this lands clearly under it.
  c.fluid.Fe = Math.max(0.0, c.fluid.Fe * 0.05);
  return 'An iron-poor recharge flushes the system. Fe²⁺ — the quencher — falls below the suppression threshold. The Mn-doped zones that grow next will fluoresce at full brightness. The boundary between the dim early zones and the bright new ones records the exact moment the iron dropped out of the broth. The crystal is now a stratigraphic record of the chemistry you played with.';
}
