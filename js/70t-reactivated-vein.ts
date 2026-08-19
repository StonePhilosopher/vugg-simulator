// ============================================================
// js/70t-reactivated-vein.ts — a sealed vug, reopened
// ============================================================
// Event handlers for `reactivated_fluorite_vein` — the demonstrator for the
// fluid-spots SEAL → BREACH lifecycle (js/85k Phase 2d). The geological story
// is crack-seal fracture reactivation (Ramsay 1980, Nature): a hydrothermal vug
// grows from an ascending brine while its feeder fractures are OPEN, then a late
// cement chokes the plumbing SHUT, the cavity goes quiet — and a later tectonic
// pulse REOPENS (breaches) the fracture, admitting a cooler fresh fluid that
// grows a visibly distinct SECOND generation on top of the first. Telescoped /
// reactivated veins are textbook in the North Pennine Orefield (Weardale
// fluorite-galena-barite; Dunham 1990, BGS Economic Memoir), where repeated
// fluid pulses tracked reactivated faults.
//
// The mechanic this exercises: every fluid-spots coupling (2b lopsided erosion,
// 2c.1 origin halo, 2c.2b deposition clustering) filters on `spot.open`, so the
// `spots: 'seal'` / `spots: 'breach'` directives on these events (handled
// centrally in apply_events, js/85d) flip the open-set and the clustering halo
// follows for free: gen-1 crystals concentrate at the open feeders, the seal
// switches the halo OFF, the breach switches it back ON for gen-2.
//
// These two handlers do only the CHEMISTRY of each transition (the feeder
// open/close is the directive's job). Bounded Math.max/min transitions per the
// scenario-authoring convention. Stage 1 itself reuses the proven generic
// fluid_mixing/fluid_pulse events (the same brine chemistry the mvt scenario
// fires from), so this file owns only the seal + breach.

// SEAL — a late carbonate/silica cement chokes the feeder fracture. The vug
// cools and the flow stalls; CO3 is drawn down as the sealing cement forms.
// Paired in scenarios.json5 with `spots: 'seal'`, which shuts the feeders so
// the deposition-clustering halo switches off during the quiescent interval.
function event_reactivated_vein_seal(c: any) {
  // v179: non-heating floor. The plain Math.max(120, T-30) form HEATS the
  // vug on any seed where pre-seal T < 150 (pulse timing is random) — a
  // "cooling" event raising T. Min(T, …) keeps the floor without ever
  // heating: cool by 30, never below 120, never above where we started.
  c.temperature = Math.max(Math.min(c.temperature, 120), c.temperature - 30);  // cooling as the conduit closes
  c.flow_rate = 0.05;                                  // plumbing choked → near-stagnant
  c.fluid.CO3 = Math.max(60, c.fluid.CO3 - 40);        // carbonate consumed by the sealing cement
  c.fluid.F = Math.max(2, c.fluid.F - 4);              // residual F drawn down by gen-1 fluorite
  return `Feeder cementation seals the cavity — T ${c.temperature.toFixed(0)}°C, flow stalls; the vug goes quiet.`;
}

// BREACH WASH — tectonic reactivation first admits a cool acidic,
// fluorite-undersaturated ionic-strength analogue of the direct {100}
// measurements of Godinho et al. (2012). Fresh mineralizing brine follows one
// step later. The receipt discloses the NaCl/NaClO4 and closed/renewed-bath
// transfer rather than presenting this natural-fluid reconstruction as a
// matching laboratory experiment.
function event_reactivated_vein_breach(c: any) {
  c.temperature = 21;
  c.pressure = 0.001;
  // Replace the reactive solute inventory with the experimental-analogue
  // wash. The boundary-delta propagator then carries this authored fluid to
  // every local cell before the physical etch is evaluated.
  for (const key of Object.keys(c.fluid)) {
    if (typeof c.fluid[key] === 'number') c.fluid[key] = 0;
  }
  c.fluid.Ca = 8;
  c.fluid.F = 0.01;
  c.fluid.Na = 1138;
  c.fluid.Cl = 1755;
  c.fluid.pH = 3.6;
  c.fluid.salinity = 2.9;
  c.fluid.concentration = 1;
  c.fluid.O2 = 8;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  // Delta propagation preserves pre-existing spatial gradients. This event is
  // a pore-fluid replacement, so ask the post-propagation etch stage to replace
  // every local handle with this exact authored wash before rate evaluation.
  c._pending_exact_fluid_replacement = _cloneFluid(c.fluid);
  c.flow_rate = 0.8;
  return 'Tectonic reactivation breaches the feeder — a 21°C, pH 3.6, I≈0.05 molal NaCl ionic-strength analogue retreats eligible flat {100} fluorite. The rate transfer is a fixed-pH closed-return extrapolation from Godinho\'s 48-hour-renewed NaClO4 bath; its ΔG≤−7 far-field gate is a mineral-level transfer from Cama\'s {111}, pH 2 experiment, not that study\'s rate. Systematic uncertainty is unquantified.';
}

// RECHARGE — the mineralizing F–Ca–carbonate brine arrives after the wash.
// This sequencing removes the former contradiction where one fluid was
// described as both fluorine-recharging and fluorite-undersaturated.
function event_reactivated_vein_recharge(c: any) {
  c.temperature = 90;
  for (const key of Object.keys(c.fluid)) {
    if (typeof c.fluid[key] === 'number') c.fluid[key] = 0;
  }
  c.fluid.pH = 6.4;
  // Slightly above the existing-crystal growth threshold but below the new-
  // nucleus gate: the old face heals over several steps instead of erasing
  // the measured sub-micrometre relief in one frame.
  c.fluid.F = 18.01;
  c.fluid.Ca = 300;
  c.fluid.CO3 = 250;
  c.fluid.Mg = 30;
  c.fluid.Na = 80;
  c.fluid.Cl = 200;
  c.fluid.salinity = 15;
  c.fluid.concentration = 1;
  c.fluid.O2 = 0.25;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  c._pending_exact_fluid_replacement = _cloneFluid(c.fluid);
  c.flow_rate = 0.4;
  return `Fresh mineralizing brine replaces the wash — F 18.01, Ca 300, CO3 250 ppm at T ${c.temperature.toFixed(0)}°C; second-generation fluorite + calcite can overgrow and heal the pitted surface.`;
}
