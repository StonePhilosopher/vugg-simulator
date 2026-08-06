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
  // Absolute tidal-water replacement, not a relative offset to preserve in
  // each already-depleted voxel.
  c._pending_fluid_replace_fields = [
    'Mg', 'Ca', 'CO3', 'Sr', 'Na', 'Cl', 'S_sulfide', 'S_sulfate',
    'S_elemental', 'salinity', 'concentration', 'pH',
  ];
  c.fluid.Mg = 800;
  c.fluid.Ca = 250;
  c.fluid.CO3 = 50;
  c.fluid.Sr = 12;
  c.fluid.Na = 10500;
  c.fluid.Cl = 19000;
  c.fluid.S_sulfide = 0;
  c.fluid.S_sulfate = 2700;
  c.fluid.S_elemental = 0;
  c.fluid.salinity = 35;
  c.fluid.concentration = 1;
  syncExplicitSulfurTotal(c.fluid);
  c.fluid.pH = 8.0;
  c.flow_rate = 1.5;
  return 'Flood pulse: low-alkalinity tidal seawater enters the lagoon. CO₃ crashes from sabkha brine levels back to ~50 ppm. Dolomite supersaturation drops below 1 — the disordered Ca/Mg surface layer detaches preferentially (Kim 2023 etch).';
}

function event_sabkha_evap(c) {
  // Absolute evaporative-brine regime replacement.
  c._pending_fluid_replace_fields = [
    'Mg', 'Ca', 'CO3', 'Sr', 'Na', 'Cl', 'S_sulfide', 'S_sulfate',
    'S_elemental', 'salinity', 'concentration', 'pH',
  ];
  c.fluid.Mg = 2000;
  c.fluid.Ca = 600;
  c.fluid.CO3 = 800;
  c.fluid.Sr = 30;
  c.fluid.Na = 65000;
  c.fluid.Cl = 110000;
  c.fluid.S_sulfide = 0;
  c.fluid.S_sulfate = 9000;
  c.fluid.S_elemental = 0;
  c.fluid.salinity = 250;
  c.fluid.concentration = 7.1;
  syncExplicitSulfurTotal(c.fluid);
  c.fluid.pH = 8.4;
  c.flow_rate = 0.1;
  c.temperature = 32;
  return 'Evaporation pulse: sun bakes the lagoon. Brine reconcentrates to 250‰ (a_w≈0.77) and 32°C: gypsum remains the required primary precursor, while the Hardie phase selector opens replacement by anhydrite. Dolomite saturation also climbs back above 1; ordering ratchets up.';
}

function event_sabkha_final_seal(c) {
  c.flow_rate = 0.05;
  c.temperature = 30;
  return "Sabkha matures, then seals. The crust hardens and groundwater stops cycling. What remains is the result of twelve dissolution-precipitation cycles — ordered dolomite where the cycling did its work, disordered HMC where it didn't. The Coorong recipe for ambient-T ordered dolomite, the natural laboratory that Kim 2023 finally explained at the atomic scale.";
}

// v29 evaporite-locality scenarios — Naica + Searles Lake events.
// Mirror of event_naica_* + event_searles_* in vugg.py.

function event_naica_slow_cooling(c) {
  if (c.temperature > 51) c.temperature -= 0.7;
  c.fluid.Ca = Math.max(c.fluid.Ca, 600);
  c.fluid.S = Math.max(c.fluid.S, 500);
  c.fluid.O2 = 1.5;
  c.fluid.pH = 7.2;
  c.flow_rate = 0.3;
  return `Geothermal reaction testimony: anhydrite at depth resupplies the measured Ca-SO₄ brine while T reaches ${c.temperature.toFixed(1)}°C. The authoritative CaSO₄ selector decides whether the near-equilibrium gypsum route remains open; no crystal outcome is asserted by the event.`;
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
  return "2017 — Naica's mining stops. The pumps shut down and the cave refloods over a few months. The cooler bath restores an aqueous Ca-SO₄ route; the authoritative saturation and kinetic gates decide whether selenite resumes growth.";
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
  // saturation (authoritative SI just below zero), so growth pauses. The hiatus leaves the step-gap that the js/45
  // segment counter reads as one stepped-growth terrace boundary.
  c.fluid.Ca = 400; c.fluid.S = 400;
  c.fluid.Mg = 150;
  c.fluid.Na = 10000; c.fluid.Cl = 15000;
  c.fluid.salinity = 35;
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
  c.fluid.Ca = 1800; c.fluid.S = 2600;
  c.fluid.Mg = 1000;
  c.fluid.Fe = Math.min(16, (c.fluid.Fe || 2) + 6);  // red-bed iron oxide concentrates with evaporation
  c.fluid.Na = Math.max(c.fluid.Na || 0, 70000); c.fluid.Cl = Math.max(c.fluid.Cl || 0, 110000);
  c.fluid.salinity = 200;
  c.fluid.SiO2 = Math.max(c.fluid.SiO2 || 0, 30);    // suspended clay / silt
  c.fluid.pH = 7.6; c.fluid.O2 = 1.6;
  c.temperature = 33;                                 // warm but < 45°C (hourglass gate)
  c.flow_rate = 0.1;
  c.fluid_surface_ring = 0.0;
  return `Dry-season reaction testimony: at ${c.temperature.toFixed(0)}°C the measured Ca-SO₄-NaCl source brine returns beneath the crust and evaporates. Positive gypsum SI opens a fast, sediment-bearing growth route; the authoritative selector and nucleation draw decide the crystal outcome.`;
}

function event_gsp_crust_seal(c) {
  c.flow_rate = 0.05; c.temperature = 25; c.fluid_surface_ring = 0.5;
  c.fluid.Ca = 1500; c.fluid.S = 2300;
  c.fluid.Mg = 1000;
  c.fluid.Na = 70000; c.fluid.Cl = 110000;
  c.fluid.salinity = 200;
  return 'The salt crust hardens and the cycling slows. What remains just beneath the crust is the harvest of a dozen wet-and-dry seasons: amber blades with an hourglass of trapped sediment inside, the iron-stained ones flooded to chocolate brown. The only place on Earth selenite grows this way.';
}

// RED-MUD FLOOD — the flooded-selenite variant (crystal-face realism, 2026-06-22). Years
// after the seasonal cycling sealed (step 245), an exceptional wet year breaches the crust
// and a sediment-choked, IRON-SATURATED red-bed slurry buries the blades: selenite resumes
// fast low-T growth but now sweeps in so much red iron oxide that the hourglass is OVERGROWN
// to solid chocolate brown (_seleniteHourglassParams intensity → 0.95 cap → flooded). This
// only WORKS because the salt plain is an OPEN system (wall.open_system) — the cavity never
// sealed, so the blades keep growing and the iron flood lands on live growth. PLACED at step
// 265, PAST duration_steps (250): the canonical seed-42 baseline run stops at the amber
// stepped hourglass and never reaches the flood, so the 250-step story stays amber; the
// flood fires only when the run CONTINUES (creative-mode Wait / extended viewing).
function event_gsp_flood(c) {
  c.fluid.Ca = 1800; c.fluid.S = 2600;
  c.fluid.Mg = 1000;
  c.fluid.Fe = 120;                                   // red-mud iron flood — buries the hourglass
  c.fluid.Na = Math.max(c.fluid.Na || 0, 70000); c.fluid.Cl = Math.max(c.fluid.Cl || 0, 110000);
  c.fluid.salinity = 200;
  c.fluid.SiO2 = Math.max(c.fluid.SiO2 || 0, 60);     // heavy suspended red silt
  c.fluid.pH = 7.6; c.fluid.O2 = 1.6;
  c.temperature = 30;                                 // < 45°C hourglass gate stays open
  c.flow_rate = 0.1;
  c.fluid_surface_ring = 0.0;
  return 'An exceptional flood year breaches the salt crust and a sediment-choked, iron-saturated red-bed slurry buries the Salt Plains. The selenite — still growing on the open flat — sweeps in so much red iron oxide that the hourglass drowns: the blades overgrow to solid chocolate brown, the flooded variant.';
}
