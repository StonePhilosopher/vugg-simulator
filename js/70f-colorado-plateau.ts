// ============================================================
// js/70f-colorado-plateau.ts — events for colorado plateau
// ============================================================
// Extracted from 70-events.ts. 5 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- colorado_plateau (Round 9e companion scenario, May 2026) ---
function event_colorado_plateau_groundwater_pulse(c) {
  c.temperature = 22;
  c.fluid.O2 = 1.5;
  c.fluid.pH = 7.0;
  c.flow_rate = 1.2;
  c.fluid.U = Math.max(c.fluid.U, 18.0);
  c.fluid.V = Math.max(c.fluid.V, 14.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.K = Math.min(c.fluid.K, 20.0);
  return 'Oxidizing groundwater flushes through the Morrison Formation sandstones, picking up uranium from upstream uraninite weathering and vanadium from montroseite-bearing layers. The carbonate-buffered fluid carries Ca dominant over K. Where it meets a U+V trap — typically petrified wood or carbonaceous shale — bright canary-yellow tyuyamunite begins plating. The same yellow that prospectors followed across mesa tops decades before scintillometers existed.';
}

function event_colorado_plateau_roll_front_contact(c) {
  c.temperature = 18;
  c.fluid.Fe = Math.max(c.fluid.Fe, 12.0);
  c.fluid.O2 = 1.0;
  c.flow_rate = 0.6;
  return 'The fluid hits a roll-front — a buried zone of carbonaceous shale or petrified wood that has held its reducing capacity for millions of years. Iron rises as the organic carbon reduces dissolved Fe³⁺ to Fe²⁺ and pulls oxygen from the system. The uranyl-vanadate complex destabilizes at the redox boundary, dropping out as concentrated tyuyamunite crusts where the chemistry crosses. The Colorado Plateau ore-grade signature.';
}

function event_colorado_plateau_k_pulse(c) {
  c.temperature = 22;
  c.fluid.K = Math.max(c.fluid.K, 40.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 30.0);
  c.fluid.V = Math.max(c.fluid.V, 10.0);
  c.fluid.U = Math.max(c.fluid.U, 8.0);
  c.fluid.Fe = Math.max(c.fluid.Fe, 8.0);
  return 'A drier interval. Evaporation concentrates the alkaline ions; potassium pulls past calcium in the cation pool. K/(K+Ca) crosses 0.5 — the carnotite branch of the cation fork takes over. Carnotite plates beside the existing tyuyamunite. Same canary-yellow, same uranyl-vanadate, same chemistry stage; the cation ratio drew the boundary between them. Friedel and Cumenge described carnotite from Roc Creek in 1899 from exactly this kind of pore-fluid regime.';
}

function event_colorado_plateau_ca_recovery(c) {
  c.temperature = 20;
  c.fluid.Ca = Math.max(c.fluid.Ca, 95.0);
  c.fluid.K = Math.min(c.fluid.K, 15.0);
  c.fluid.V = Math.max(c.fluid.V, 9.0);
  c.fluid.U = Math.max(c.fluid.U, 6.0);
  return 'The dry interval ends; meteoric recharge brings carbonate back into solution. Ca recovers dominance. Tyuyamunite resumes plating in the new pore-fluid composition, this time alongside the carnotite that grew during the K-pulse. Colorado Plateau specimens preserve exactly this kind of intergrowth — the same hand specimen, the same emerald color, the cation chemistry the only honest test of which is which.';
}

function event_colorado_plateau_arid_stabilization(c) {
  c.temperature = 20;
  c.flow_rate = 0.1;
  return 'The system reaches its steady state. Carnotite and tyuyamunite cover the pore walls in roughly equal parts. Both fluoresce dimly under longwave UV — the vanadate matrix dampens their emission below autunite-group brilliance, but Ca²⁺ keeps tyuyamunite\'s emission slightly lifted above carnotite\'s. Time wrote this assemblage. Geochemistry just held the pen.';
}
