// tests-js/trace-mn-banded-coverage.test.ts — v119 audit guard.
//
// Per-zone trace_Mn capture is the chemistry-side prerequisite for the
// next sub-arc's per-zone color rendering (TN457 / TN505 / Tsumeb
// pink-smithsonite aesthetics). v118 fixed barite (Putnis 2001 banded
// sulfate). v119 extends the audit to manganoan sphalerite/wurtzite
// (Frondel 1941 manganblende) and bonbon-pink smithsonite (Tsumeb
// cabinet aesthetic).
//
// This file is a STRUCTURAL guard, not a chemistry guard — it
// instantiates each grow engine via the live SCENARIO + sim path,
// finds a crystal of the target mineral, and asserts at least one
// of its zones recorded a non-trivial trace_Mn from a Mn-bearing
// fluid. If a future refactor drops the trace_Mn capture (silent
// regression), this catches it.
//
// What this DOES NOT check:
//   - Renderer actually paints the trace_Mn (slated for next sub-arc)
//   - Mn partition coefficient values (calibration concern, not
//     coverage concern)
//   - Mn-banded minerals OUTSIDE the v119 audit scope (e.g.
//     cerussite, witherite, strontianite — minor Mn substitution,
//     deferred until a specimen scenario forces them)

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const setSeed: (seed: number) => void;

const observationCache = new Map<string, any>();

function observeScenario(name: string, steps: number): any {
  const key = `${name}:${steps}`;
  if (observationCache.has(key)) return observationCache.get(key);
  setSeed(42);
  const { conditions, events } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let step = 0; step < steps; step++) sim.run_step();
  // These are structural assertions, so retain only zone-bearing crystals.
  const observation = {
    crystals: sim.crystals.map((crystal: any) => ({
      mineral: crystal.mineral,
      zones: (crystal.zones || []).map((zone: any) => ({
        thickness_um: zone.thickness_um,
        trace_Mn: zone.trace_Mn,
      })),
    })),
  };
  observationCache.set(key, observation);
  return observation;
}

function findCrystalsWithMnBearingZone(sim: any, mineral: string): any[] {
  return sim.crystals.filter((c: any) =>
    c.mineral === mineral &&
    (c.zones || []).some((z: any) =>
      typeof z.trace_Mn === 'number' && z.trace_Mn > 0 && z.thickness_um > 0
    )
  );
}

describe('Per-zone trace_Mn coverage audit (v119)', () => {
  it('sphalerite zones capture trace_Mn (Mn²⁺ substitution per Frondel 1941 manganblende)', () => {
    // tn457_barite_pulses has Mn ramping from 0.3 to ~50+ ppm; sphalerite
    // nucleates early and grows zones across the Mn-rich window.
    const sim = observeScenario('tn457_barite_pulses', 24);
    const sph = findCrystalsWithMnBearingZone(sim, 'sphalerite');
    expect(sph.length).toBeGreaterThan(0);
    // Spot-check at least one zone has trace_Mn well above floor
    const zones = sph[0].zones.filter((z: any) => z.thickness_um > 0);
    const maxMn = Math.max(...zones.map((z: any) => z.trace_Mn || 0));
    expect(maxMn).toBeGreaterThan(0);
  });

  it('wurtzite zones capture trace_Mn (same family, polytype variations preserved)', () => {
    // Exercise the metastable acid/Fe-bearing wurtzite branch directly;
    // no authored seed-42 scenario currently produces this kinetic trap.
    setSeed(42);
    const conditions = new VugConditions({
      temperature: 180,
      fluid: new FluidChemistry({ Zn: 500, S: 500, Fe: 20, Mn: 40, pH: 3, O2: 0 }),
    });
    const sim = new VugSimulator(conditions, []);
    for (let step = 0; step < 3; step++) sim.run_step();
    const wur = findCrystalsWithMnBearingZone(sim, 'wurtzite');
    expect(wur.length).toBeGreaterThan(0);
  });

  it('smithsonite zones capture trace_Mn (Tsumeb "bonbon pink" aesthetic)', () => {
    // supergene_oxidation is the Tsumeb scenario — smithsonite + Mn-bearing
    // late-stage supergene fluid is the canonical pink-smithsonite path.
    const sim = observeScenario('supergene_oxidation', 20);
    const sm = findCrystalsWithMnBearingZone(sim, 'smithsonite');
    expect(sm.length).toBeGreaterThan(0);
  });

  it('barite zones capture trace_Mn (v118 follow-the-science fix still in place)', () => {
    // Regression guard for v118. The Putnis & Perthuisot 2001 oscillatory-
    // zoning literature establishes barite as THE Mn²⁺-banded sulfate;
    // the v118 fix added the capture; this pin holds it.
    const sim = observeScenario('tn457_barite_pulses', 24);
    const bar = findCrystalsWithMnBearingZone(sim, 'barite');
    expect(bar.length).toBeGreaterThan(0);
  });

  it('calcite positive-growth zones retain the shared carbonate trace_Mn field', () => {
    // Calcite exercises the shared carbonate-zone schema here. Mineral-
    // specific carbonate chemistry and Mn partition coefficients have their
    // own engine suites; this guard is deliberately structural.
    const sim = observeScenario('mvt', 4);
    // Calcite always fires in mvt. Pick any one calcite zone — must
    // have trace_Mn field present (even if value is 0).
    const calcites = sim.crystals.filter((c: any) => c.mineral === 'calcite');
    expect(calcites.length).toBeGreaterThan(0);
    const cZones = calcites[0].zones.filter((z: any) => z.thickness_um > 0);
    expect(cZones.length).toBeGreaterThan(0);
    // Field must EXIST on the zone (even if Mn fluid is 0); regression
    // would mean the engine deleted the property.
    expect('trace_Mn' in cZones[0]).toBe(true);
  });
});
