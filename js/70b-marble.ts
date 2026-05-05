// ============================================================
// js/70b-marble.ts — events for marble
// ============================================================
// Extracted from 70-events.ts. 3 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// ============================================================
// PHASE 2 EVENT HANDLERS — promoted from inline closures
// ============================================================
// Mirror of the Python-side promoted handlers. Phase 2 of data-as-truth
// migrates inline `ev_X` closures from the legacy scenario_* functions
// to module-level so the parent scenario's initial state can move to
// data/scenarios.json5. Names are scenario-prefixed
// (event_<scenario>_<verb>) to stay unambiguous across migrations.

// --- marble_contact_metamorphism ---
function event_marble_peak_metamorphism(c) {
  c.temperature = 700.0;
  c.fluid.Al += 15;
  c.fluid.SiO2 += 8;
  c.fluid.Cr += 1.5;
  c.flow_rate = 2.5;
  return "Contact metamorphic peak: a leucogranite dyke 50 m away pumps 700°C fluid into the marble interface. Skarn alteration zones expand outward; corundum family crystals begin to nucleate in the most Si-undersaturated patches. Pigeon's blood ruby paragenesis underway.";
}

function event_marble_retrograde_cooling(c) {
  c.temperature = 500.0;
  c.fluid.Al = Math.max(c.fluid.Al * 0.9, 30);
  c.flow_rate = 1.2;
  return "Retrograde cooling begins. The leucogranite intrusion stalls; the fluid slowly retreats through the skarn envelope, depositing corundum at every fracture it finds. T drops from 700 to 500°C. This is the main ruby/sapphire growth window.";
}

function event_marble_fracture_seal(c) {
  c.temperature = 350.0;
  c.flow_rate = 0.1;
  c.fluid.pH = Math.min(c.fluid.pH + 0.3, 9.0);
  return "The feeding fracture seals. The Mogok pocket is now a closed system. Whatever corundum family crystals are still undersaturated will continue to consume the remaining Al pool until equilibrium. Everything else is frozen.";
}
