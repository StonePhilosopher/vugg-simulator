// ============================================================
// js/70c-reactive-wall.ts — events for reactive wall
// ============================================================
// Extracted from 70-events.ts. 4 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- reactive_wall ---
function event_reactive_wall_acid_pulse_1(c) {
  c.fluid.pH = 3.5;
  c.fluid.S += 40.0;
  c.fluid.Zn += 60.0;
  c.fluid.Fe += 15.0;
  c.flow_rate = 4.0;
  return 'CO₂-saturated brine surges into the vug. pH crashes to 3.5. The limestone walls begin to fizz — carbonate dissolving on contact.';
}

function event_reactive_wall_acid_pulse_2(c) {
  c.fluid.pH = 3.0;
  c.fluid.S += 50.0;
  c.fluid.Zn += 80.0;
  c.fluid.Fe += 25.0;
  c.fluid.Mn += 10.0;
  c.flow_rate = 5.0;
  return 'Second acid pulse — stronger than the first. pH drops to 3.0. Metal-bearing brine floods the vug. The walls are being eaten alive, but every Ca²⁺ released is a future growth band waiting to happen.';
}

function event_reactive_wall_acid_pulse_3(c) {
  c.fluid.pH = 4.0;
  c.fluid.S += 20.0;
  c.fluid.Zn += 30.0;
  c.flow_rate = 3.0;
  return 'Third acid pulse — weaker now. pH only drops to 4.0. The fluid system is exhausting. But the wall still has carbonate to give.';
}

function event_reactive_wall_seal(c) {
  c.flow_rate = 0.1;
  c.fluid.pH += 0.5;
  c.fluid.pH = Math.min(c.fluid.pH, 8.0);
  return 'The feeding fracture seals. Flow stops. The vug becomes a closed system. Whatever\'s dissolved will precipitate until equilibrium.';
}
