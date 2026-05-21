// ============================================================
// js/70s-tn457.ts — event handler for tn457_barite_pulses
// ============================================================
// TN457: pink barite on sphalerite, England (probable Cumbria —
// Northern Pennines or Caldbeck Fells lineage). The scenario
// dogfoods PROPOSAL-EVENT-DRIVEN-PRECIPITATION (Rock Bot +
// Professor, 2026-05-20) as the forcing-function test: can the
// existing engine produce the TN457 coin-stack-barite signature
// from EVENT CHEMISTRY ALONE, or are the missing pieces all
// renderer-side?
//
// SPECIMEN CONTEXT
// ──────────────────────────────────────────────────────────────
// TN457 (boss collection, proxy designation) — thousands of pink
// tabular barite crystals stacked in coin-like columns on
// sphalerite substrate, 5+ macroscopically-visible growth stages,
// mild blue/white UV fluorescence (late hydrozincite). The
// pink color is Mn²⁺-activated. The coin-stack morphology is the
// mineralogical signature of episodic fluid pulse precipitation:
// thousands of thin barite tabs, each ~50 µm thick, recording
// individual growth pulses that didn't have time to develop
// fully euhedral faces before the next pulse arrived.
//
// CUMBRIA / NORTHERN PENNINES OREFIELD CONTEXT
// ──────────────────────────────────────────────────────────────
// Caldbeck Fells, North Pennines (Alston/Weardale + South
// Pennines), and the Lake District orefields share a common
// late-Variscan to post-Variscan MVT-style chemistry: hot
// brines (~100-150°C) circulating through Carboniferous
// limestone host, depositing Pb + Zn + Ba + F in a sequence
// that typically goes:
//
//   Stage 1   primary sulfides (galena + sphalerite) under
//             mildly reducing brine, pH ~5-6
//   Stage 2   gangue/late-stage barite + fluorite + calcite as
//             the fluid mildly oxidizes + cools; barite is the
//             diagnostic late phase, oscillating in Mn loading
//             pulse-by-pulse
//   Stage 3   supergene overgrowth (rare for closed pockets)
//
// Reference frame: Alderton & Bevins 1996 (J. Geol. Soc. Lond.
// — Cumbrian Pb-Zn fluid history); Bouch et al. 2006 (Mineral.
// Mag. — North Pennines barite-fluorite chemistry); Sherlock et
// al. 1999 (Geochim. Cosmochim. Acta — Lake District brines).
//
// EVENT MECHANICS
// ──────────────────────────────────────────────────────────────
// Single event handler, fired 50× across steps 5-103 by the
// tn457_barite_pulses scenario in data/scenarios.json5. Each
// firing represents one fluid pulse:
//
//   - Ba +15 ppm     enough to clear barite gate (Ba >= 5);
//                    accumulates pulse-on-pulse, MINERAL_STOICHIOMETRY
//                    debits Ba 1:1 with each crystal grown so the
//                    fluid doesn't runaway (was Rock Bot's stated
//                    concern; barite + sphalerite both in the table
//                    per js/19-mineral-stoichiometry.ts)
//   - Mn +rng(0.3,1.5) ppm
//                    PULSE-VARIATION via seeded rng. Each pulse adds
//                    a small, rng-driven Mn dose. The barite zone
//                    that records THIS step picks up THIS pulse's
//                    Mn loading via trace_Mn in add_zone. Across
//                    50 pulses the trace_Mn time-series IS the
//                    pink-color banding pattern. ?seed=N makes the
//                    sequence deterministic (v117 URL contract).
//   - pH -0.08       slight acidic pulse — dissolves prior growth
//                    front briefly (phantom-boundary candidate per
//                    Crystal.is_phantom). Floor 4.5 (well above
//                    barite's pH < 4 penalty).
//   - T -0.5°C       episodic cooling per pulse. 50 pulses = -25°C
//                    cumulative cooling across the run, walking T
//                    from 120°C → 95°C. Keeps barite in its
//                    optimal-T window (50-200°C) the whole time.
//   - O2 +0.005      tiny per-pulse oxidation. Each pulse brings
//                    fresher (more oxidized) fluid. Accumulated
//                    across 50 pulses = +0.25, pushes O2 from
//                    initial 0.15 → 0.40, which is exactly the
//                    sulfateRedoxFactor center (0.4) for barite's
//                    optimal redox window.
//   - flow_rate spike
//                    each pulse is fresh-fluid-arriving, so flow
//                    rate momentarily climbs (the renderer doesn't
//                    use this but it's diagnostic for narrators).
//
// DETERMINISM
// ──────────────────────────────────────────────────────────────
// The rng.random() draw inside the handler is the ONLY non-
// deterministic call in this scenario. With ?seed=42 the rng
// state is reproducible (per v117's _agentHeadlessRun pre-seed
// before VugSimulator construction), so the 50-pulse Mn time-
// series is byte-stable per (scenario, seed) pair. Two runs at
// ?seed=42 produce identical barite zone-Mn profiles. Different
// seeds produce different profiles — that's the shareable-URL
// property in action.
//
// FORCING-FUNCTION QUESTION
// ──────────────────────────────────────────────────────────────
// Per boss directive 2026-05-21 (greenlit (1) from sequencing):
// once this scenario runs, the gap between WHAT IT PRODUCES and
// WHAT TN457 LOOKS LIKE drives the next sub-arc:
//
//   if engine output matches TN457 specimen visual:
//     event-driven precipitation is COMPLETE; refactor
//     PROPOSAL-EVENT-DRIVEN-PRECIPITATION as
//     PROPOSAL-EVENT-DRIVEN-PRECIPITATION-RENDERED (done)
//   else:
//     identify gap. Likely candidates:
//       (a) coin-stack render primitive ('stacked_tablets'
//           habit-variant token in MINERAL_SPEC)
//       (b) per-zone color rendering (paint zone bands using
//           per-zone trace_Mn, not integrated average)
//       (c) mass-nucleation bypass at high sigma
//       (d) epitaxy-over-nucleation tilt during high-pulse-density
//           windows
//     dispatch sub-arc per gap.

function event_tn457_mn_ba_pulse(c) {
  // Ba pulse — primary driver. Barite supersaturation gate is
  // Ba >= 5; initial fluid Ba is 2 (below gate) so the FIRST
  // pulse is the trigger.
  c.fluid.Ba = Math.min(180, c.fluid.Ba + 15);

  // Mn variation per pulse — the pink-banding RNG draw.
  // Range 0.3-1.5 ppm; trace_Mn on the resulting zone captures
  // the value the fluid had when that zone grew.
  const mnAdd = 0.3 + (typeof rng !== 'undefined' && rng && rng.random ? rng.random() : Math.random()) * 1.2;
  c.fluid.Mn = Math.min(15, c.fluid.Mn + mnAdd);

  // Slight pH drop — acidic incoming fluid. Floor 4.5 keeps it
  // above barite's pH < 4 penalty window.
  c.fluid.pH = Math.max(c.fluid.pH - 0.08, 4.5);

  // Per-pulse cooling. -0.5°C × 50 pulses = -25°C cumulative.
  c.temperature = Math.max(c.temperature - 0.5, 70);

  // Per-pulse mild oxidation. +0.005 × 50 pulses = +0.25 cumulative.
  // From initial O2=0.15 to ~0.40 by run end. Walks barite
  // through sulfateRedoxFactor's optimal window (centered 0.4).
  c.fluid.O2 = Math.min(0.5, c.fluid.O2 + 0.005);

  // Flow rate spike per arriving pulse.
  c.flow_rate = Math.max(c.flow_rate, 2.0);

  return `TN457 pulse: Ba ${c.fluid.Ba.toFixed(0)}, Mn +${mnAdd.toFixed(2)} (now ${c.fluid.Mn.toFixed(2)}), pH ${c.fluid.pH.toFixed(2)}, T ${c.temperature.toFixed(0)}°C, O2 ${c.fluid.O2.toFixed(2)}.`;
}
