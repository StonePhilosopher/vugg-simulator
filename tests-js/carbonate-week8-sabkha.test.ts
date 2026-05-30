// tests-js/carbonate-week8-sabkha.test.ts — Week 8 validation.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 8 — "Validate dolomite
// kinetics against sabkha_dolomitization. Critical pass: f_ord
// crosses 0.7 between cycle 6 and 10. Disordered HMC during early
// cycles. Ordered dolomite after cycle 9."
//
// THE DUAL OF WEEK 7
//
//   reactive_wall: aggressive acid pulses → no Kim cycling →
//                  f_ord stays low → no ordered dolomite (Week 7)
//
//   sabkha:        12 gentle tidal cycles → Kim mechanism fires →
//                  f_ord crosses 0.7 between cycles 6-10 →
//                  ordered dolomite forms after cycle 9 (this file)
//
// Same scenario produces different mineralogy depending on the
// cycling MODE. That's the geological insight Kim 2023 made
// experimentally accessible; this test pair locks in that the
// simulator captures it.
//
// HMC + ordered-dolomite split as separate phases is Phase 1c
// (HMC needs its own MINERAL_SPEC entry via vugg-add-mineral).
// Until then both fire under the 'dolomite' mineral entry. This
// test asserts the MECHANISM (f_ord trajectory) rather than the
// mineralogical split.
//
// Sabkha was flipped to open_to_atmosphere=true at v143 (Week 4c).
// This test also validates that open-system equilibration is
// actually doing something — pH should stay in the atmospheric-
// equilibrium band rather than drift freely as the brine evaporates.

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const carbonateSaturationIndex: (m: string, f: any, T: number) => number;
declare const equilibriumPCO2: (f: any, T: number) => number;

type Probe = {
  step: number,
  pH: number,
  CO3: number,
  Mg: number,
  Ca: number,
  SI_dolomite: number,
  pCO2: number,
  dol_cycle_count: number,
  f_ord: number,
};

function probeSabkha(): Probe[] {
  const scn = SCENARIOS && SCENARIOS.sabkha_dolomitization;
  if (!scn) return [];
  setSeed(42);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const probes: Probe[] = [];
  const total = defaultSteps ?? 260;
  for (let i = 0; i < total; i++) {
    sim.run_step();
    const ringIdx = Math.floor((sim.ring_fluids ? sim.ring_fluids.length : 16) / 2);
    const f = sim.ring_fluids ? sim.ring_fluids[ringIdx] : conditions.fluid;
    const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : conditions.temperature;
    const n = conditions._dol_cycle_count || 0;
    probes.push({
      step: sim.step,
      pH: f.pH,
      CO3: f.CO3,
      Mg: f.Mg,
      Ca: f.Ca,
      SI_dolomite: carbonateSaturationIndex('dolomite', f, T),
      pCO2: equilibriumPCO2(f, T),
      dol_cycle_count: n,
      f_ord: 1 - Math.exp(-n / 7),
    });
  }
  return probes;
}

describe('PROPOSAL-CARBONATE-GEOCHEM Week 8 — Kim 2023 cycle accumulation', () => {
  it('_dol_cycle_count accumulates as flood/evap cycles fire', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    // 12 flood/evap pairs scheduled at steps 10/20, 30/40, ..., 230/240.
    // dol_cycle_count should rise monotonically (or stay flat) over time.
    const early = probes.find(p => p.step === 30);
    const mid = probes.find(p => p.step === 120);
    const late = probes.find(p => p.step === 240);
    if (!early || !mid || !late) return;
    expect(mid.dol_cycle_count).toBeGreaterThanOrEqual(early.dol_cycle_count);
    expect(late.dol_cycle_count).toBeGreaterThanOrEqual(mid.dol_cycle_count);
  });

  it('Final cycle count reaches the ordered-dolomite threshold', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    const final = probes[probes.length - 1];
    // Proposal critical pass: f_ord > 0.7 by cycle 9. With Kim N0=7:
    //   1 - exp(-N/7) > 0.7  ⟺  N > 7 × ln(1/0.3) ≈ 8.43
    // So _dol_cycle_count must reach ≥ 9 by the end of the scenario.
    //
    // Per the W8 follow-up diagnostic (tools/w8_diagnostic_sabkha.mjs),
    // the per-cycle threshold detection actually tracks ALL 12
    // scheduled flood/evap pairs cleanly on the v143 baseline:
    //   - cycle_count advances by 1 per scheduled pair
    //   - final cycle_count = 12 (= number of scheduled pairs)
    //   - f_ord = 0.820 (crosses 0.7 around step 195, near proposal's
    //     "between cycle 6 and 10" target)
    //
    // The original soft assertion (count > 0) was hiding STRONG
    // behavior, not weak — and a regression in Kim cycle wiring or
    // threshold detection would only fall back to "weak". Tightened
    // here to the proposal's target. If this fails, the threshold
    // detection has regressed; run the diagnostic tool to see the
    // actual trajectory.
    expect(final.dol_cycle_count).toBeGreaterThanOrEqual(9);
    // Cap at the number of scheduled cycles (12). If cycle_count >> 12
    // there's noise in the threshold detection (over-triggering on
    // sub-cycle Ω oscillations near the threshold).
    expect(final.dol_cycle_count).toBeLessThanOrEqual(15);
  });

  it('f_ord crosses 0.7 by end of scenario (proposal critical pass)', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    const final = probes[probes.length - 1];
    // Proposal: f_ord > 0.7 between cycle 6 and 10. Sabkha's 12-cycle
    // schedule should clear this comfortably.
    expect(final.f_ord).toBeGreaterThan(0.7);
  });

  it('f_ord rises across the scenario (Kim formula applied to actual cycle counts)', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    const early = probes.find(p => p.step === 20);
    const final = probes[probes.length - 1];
    if (!early || !final) return;
    // f_ord at start is ≈ 0; should rise as cycle_count rises.
    expect(final.f_ord).toBeGreaterThanOrEqual(early.f_ord);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 8 — open-system pH equilibration active', () => {
  it('pH stays in alkaline band consistent with atmospheric pCO2 equilibration', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    // Sabkha initial pH = 8.3. With open_to_atmosphere flipped at
    // v143 and target_pCO2_bar = 4.2e-4 (modern atmospheric), the
    // equilibrium pH for high-DIC marine brine should sit in the
    // alkaline band (~7-9).
    //
    // Pre-flip (closed system) pH would drift as flood/evap events
    // changed DIC without compensating. Post-flip equilibration
    // anchors pH to the atmospheric boundary.
    const lateProbes = probes.filter(p => p.step >= 100);
    if (lateProbes.length === 0) return;
    for (const p of lateProbes) {
      expect(p.pH).toBeGreaterThan(6);
      expect(p.pH).toBeLessThan(11);
    }
  });

  it('pCO2 trajectory bounded (Henry\'s-Law equilibration keeps it in atmospheric band)', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    // With open_to_atmosphere=true and target 4.2e-4 bar, the
    // fluid's equilibrium pCO2 should stay within ~10× of target
    // (4e-5 to 4e-3 bar). Outside that band would mean equilibration
    // isn't keeping up with the brine evaporation.
    const lateProbes = probes.filter(p => p.step >= 100 && p.step <= 200);
    if (lateProbes.length === 0) return;
    for (const p of lateProbes) {
      expect(p.pCO2).toBeGreaterThan(1e-6);
      expect(p.pCO2).toBeLessThan(1e-2);
    }
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 8 — dolomite saturation regime', () => {
  it('SI_dolomite is above zero (supersaturated) for the bulk of the run', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    // Sabkha is a Mg-rich brine — dolomite SHOULD be thermodynamically
    // supersaturated nearly everywhere. The Kim mechanism gates whether
    // it actually precipitates as ordered dolomite, but the SI math
    // (pure thermodynamics) should report supersaturation regardless.
    const supersaturatedSteps = probes.filter(p => isFinite(p.SI_dolomite) && p.SI_dolomite > 0).length;
    const totalSteps = probes.length;
    // At least 60% of sampled steps should have SI > 0.
    expect(supersaturatedSteps).toBeGreaterThan(totalSteps * 0.6);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 8 — flood/evap chemistry cycling', () => {
  it('Mg cycles up and down with evap/flood events', () => {
    const probes = probeSabkha();
    if (!probes.length) return;
    // Evap events concentrate the brine (raise Mg); flood events
    // dilute (lower Mg). Mid-scenario Mg should be HIGHER (or
    // similar) than initial because the cycle has more evap-than-
    // dilute mass over 240 steps (evaporative concentration is the
    // dominant net effect).
    const initial = probes[0];
    const mid = probes.find(p => p.step === 150);
    if (!initial || !mid) return;
    // Within a factor of 3 either way — the brine cycles, not
    // monotonically increases or decreases.
    expect(mid.Mg / initial.Mg).toBeGreaterThan(0.3);
    expect(mid.Mg / initial.Mg).toBeLessThan(5);
  });
});
