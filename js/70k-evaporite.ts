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

// --- great_salt_plains (Salt Plains NWR, Oklahoma — hourglass selenite showcase) ---
// Wet/dry seasonal cycling over salt-saturated red-bed sand. The DRY pulse wicks
// gypsum-saturated groundwater up under the salt crust and evaporates it fast, so
// selenite grows in a rapid burst that traps clay + sand + Permian iron oxide on its
// terminal growth sectors — the visible "hourglass selenite" (USFWS Salt Plains NWR;
// Oklahoma state crystal). The WET pulse (rain / rising water table) dilutes the brine
// below gypsum saturation so growth pauses — and the next dry burst steps the blade
// outward again, building the stepped-growth ziggurat while the internal hourglass
// holds its order. The repeated fast pulses are what the js/45 step-counter reads.
function event_gsp_wet(c) {
  // Spring rain / rising groundwater floods the flat — brine drops well below gypsum
  // saturation (σ_selenite < 1 even with the cool-T ×1.5 + redox bonuses), so growth
  // pauses without dissolving the blade. The hiatus leaves the step-gap that the js/45
  // segment counter reads as one stepped-growth terrace boundary.
  c.fluid.Ca = 15; c.fluid.S = 15;
  c.fluid.Fe = 2;
  c.fluid.pH = 7.6; c.fluid.O2 = 1.5;
  c.temperature = 22;
  c.flow_rate = 1.4;
  c.fluid_surface_ring = 1.0e6;
  return 'Rain on the Salt Plains — the water table rises and floods the flat. The brine dilutes below gypsum saturation; selenite growth pauses and the salt crust softens. The clay and red Permian silt stay suspended, waiting for the dry.';
}

function event_gsp_dry(c) {
  // Oklahoma sun bakes the flat — gypsum-saturated groundwater wicks up and evaporates
  // just under the salt crust. σ_selenite ≫ 1 → a fast growth burst that traps clay/
  // sand + iron oxide on the terminal sectors (the hourglass) and stains it brown.
  c.fluid.Ca = 150; c.fluid.S = 150;
  c.fluid.Fe = Math.min(16, (c.fluid.Fe || 2) + 6);  // red-bed iron oxide concentrates with evaporation
  c.fluid.Na = Math.max(c.fluid.Na || 0, 700); c.fluid.Cl = Math.max(c.fluid.Cl || 0, 700);
  c.fluid.SiO2 = Math.max(c.fluid.SiO2 || 0, 30);    // suspended clay / silt
  c.fluid.pH = 7.6; c.fluid.O2 = 1.6;
  c.temperature = 33;                                 // warm but < 45°C (hourglass gate)
  c.flow_rate = 0.1;
  c.fluid_surface_ring = 0.0;
  return `Summer sun bakes the Salt Plains. T=${c.temperature.toFixed(0)}°C; gypsum-saturated groundwater wicks up under the crust and evaporates fast. Selenite grows in a burst, sweeping clay, sand, and red iron oxide into its terminal sectors — the hourglass. Each dry season steps the blade out another notch.`;
}

function event_gsp_crust_seal(c) {
  c.flow_rate = 0.05; c.temperature = 25; c.fluid_surface_ring = 0.5;
  c.fluid.Ca = 90; c.fluid.S = 90;
  return 'The salt crust hardens and the cycling slows. What remains just beneath the crust is the harvest of a dozen wet-and-dry seasons: amber blades with an hourglass of trapped sediment inside, the iron-stained ones flooded to chocolate brown. The only place on Earth selenite grows this way.';
}
