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

// BREACH — tectonic reactivation reopens the fracture and a cooler, fresh
// fluid pulse pours in: replenished F brings a second-generation fluorite, and
// the CO3 + Ca spike brings late calcite. Paired with `spots: 'breach'`, which
// reopens the feeders so the second generation clusters at the same vents.
function event_reactivated_vein_breach(c: any) {
  // v179: same non-heating floor as the seal (plain max heats below 100°C).
  c.temperature = Math.max(Math.min(c.temperature, 90), c.temperature - 10);  // the second pulse is cooler than the first
  c.fluid.F = Math.min(30, c.fluid.F + 16);            // fresh fluorine → gen-2 fluorite
  c.fluid.Ca = Math.min(420, c.fluid.Ca + 90);         // Ca for both fluorite + calcite
  c.fluid.CO3 = Math.min(320, c.fluid.CO3 + 130);      // carbonate spike → late calcite
  c.flow_rate = 0.4;                                   // plumbing reopened, flow resumes
  return `Tectonic reactivation breaches the feeder — a cooler fresh pulse (F +16, CO3 +130) at T ${c.temperature.toFixed(0)}°C; gen-2 fluorite + calcite.`;
}
