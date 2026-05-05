// ============================================================
// js/70k-evaporite.ts — events for evaporite
// ============================================================
// Extracted from 70-events.ts. 9 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- sabkha_dolomitization (Coorong/Persian Gulf cycling brine, Kim 2023 mechanism) ---
// flood + evap each fire 12× via the supergene_acidification handler-reuse
// precedent. Cycle number is preserved via the event `name` field.
function event_sabkha_flood(c) {
  c.fluid.Mg = 800;
  c.fluid.Ca = 250;
  c.fluid.CO3 = 50;
  c.fluid.Sr = 12;
  c.fluid.pH = 8.0;
  c.flow_rate = 1.5;
  return 'Flood pulse: low-alkalinity tidal seawater enters the lagoon. CO₃ crashes from sabkha brine levels back to ~50 ppm. Dolomite supersaturation drops below 1 — the disordered Ca/Mg surface layer detaches preferentially (Kim 2023 etch).';
}

function event_sabkha_evap(c) {
  c.fluid.Mg = 2000;
  c.fluid.Ca = 600;
  c.fluid.CO3 = 800;
  c.fluid.Sr = 30;
  c.fluid.pH = 8.4;
  c.flow_rate = 0.1;
  c.temperature = 28;
  return 'Evaporation pulse: sun bakes the lagoon. Brine reconcentrates to sabkha state — Mg=2000, Ca=600, CO₃=800. Dolomite saturation climbs back well above 1; growth resumes on the ordered template the previous etch left behind. Cycle complete; ordering ratchets up.';
}

function event_sabkha_final_seal(c) {
  c.flow_rate = 0.05;
  c.temperature = 22;
  return "Sabkha matures, then seals. The crust hardens and groundwater stops cycling. What remains is the result of twelve dissolution-precipitation cycles — ordered dolomite where the cycling did its work, disordered HMC where it didn't. The Coorong recipe for ambient-T ordered dolomite, the natural laboratory that Kim 2023 finally explained at the atomic scale.";
}

// v29 evaporite-locality scenarios — Naica + Searles Lake events.
// Mirror of event_naica_* + event_searles_* in vugg.py.

function event_naica_slow_cooling(c) {
  if (c.temperature > 51) c.temperature -= 0.7;
  c.fluid.Ca = Math.max(c.fluid.Ca, 280);
  c.fluid.S = Math.max(c.fluid.S, 380);
  c.fluid.O2 = 1.5;
  c.fluid.pH = 7.2;
  c.flow_rate = 0.3;
  return `Geothermal pulse: anhydrite at depth dissolves slightly, resupplying Ca + SO₄ to the rising hot brine. T drifts down to ${c.temperature.toFixed(1)}°C — still above the 54°C Naica equilibrium. Selenite cathedral blades grow another notch. Garcia-Ruiz: "hundredths of a degree per year" maintained for half a million years.`;
}

function event_naica_mining_drainage(c) {
  c.fluid_surface_ring = 0.0;
  c.flow_rate = 0.05;
  c.temperature = 35;
  return "1985 — mining at Naica deepens to 290m. Industrial pumps lower the water table below the Cueva de los Cristales. The 12-metre selenite blades stop growing the moment their bath drains; what's left in the cave is the freshest snapshot of the last half-million years of growth, frozen.";
}

function event_naica_mining_recharge(c) {
  c.fluid_surface_ring = 1.0e6;
  c.flow_rate = 0.5;
  c.temperature = 30;
  return "2017 — Naica's mining stops. The pumps shut down and the cave refloods over a few months. Decades-old vadose rinds dissolve in the fresh groundwater; selenite resumes slow growth in the cooler 30°C bath. The cave is no longer accessible — sealed away from researchers, safe from tourists, growing again.";
}

function event_searles_winter_freeze(c) {
  c.temperature = 8;
  c.fluid.Na = Math.max(c.fluid.Na, 1500);
  c.fluid.S = Math.max(c.fluid.S, 250);
  c.fluid.B = Math.max(c.fluid.B, 100);
  c.fluid.Cl = Math.max(c.fluid.Cl, 1200);
  c.fluid.pH = 9.5;
  c.fluid.O2 = 1.6;
  c.flow_rate = 0.2;
  c.fluid_surface_ring = 4.0;
  return `Searles Lake winter night. T=${c.temperature.toFixed(0)}°C; cold-air sublimation drops the playa surface to ring ${c.fluid_surface_ring.toFixed(0)}. The brine is below the 32°C mirabilite-thenardite eutectic. Glauber salt crystallizes in fibrous beds, halite hopper cubes form, and borax fires from the deep alkaline pH.`;
}

function event_searles_summer_bake(c) {
  c.temperature = 55;
  c.flow_rate = 0.1;
  c.fluid.O2 = 1.8;
  c.fluid_surface_ring = 0.0;
  return `Searles Lake summer afternoon. T=${c.temperature.toFixed(0)}°C; playa surface drops to ring ${c.fluid_surface_ring.toFixed(0)}. Cold-evaporite minerals don't survive this heat — mirabilite loses its 10 water molecules and becomes thenardite where it stands; borax effloresces to tincalconite. By evening, what was a clear Glauber blade is a powdery pseudomorph.`;
}

function event_searles_fresh_pulse(c) {
  c.fluid_surface_ring = 1.0e6;
  c.flow_rate = 1.5;
  c.temperature = 20;
  return "Sierra snowmelt pulse — fresh meteoric water arrives at Searles Lake. The brine dilutes, salt crusts begin to redissolve, and the basin briefly resembles a real lake. Within weeks the heat returns and the cycle starts over.";
}
