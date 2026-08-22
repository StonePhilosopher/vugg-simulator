// tests-js/thermal-stream.test.ts — T-RECONCILIATION contracts (v181).
//
// ambient_cooling's drift + thermal-pulse draws moved off the shared rng
// onto a dedicated run-seed-derived stream (sim._thermalRng, seeded by 85j
// _makeThermalRng from rng.state at construction). These tests pin the
// four contracts that make the move safe and the unlock real:
//
//   1. NEUTRALITY — ambient_cooling consumes ZERO shared-rng draws (the
//      whole point: thermal history no longer displaces nucleation).
//   2. REPRODUCIBILITY — same seed → identical thermal trajectory
//      (baselines + crystal-cipher depend on it).
//   3. KNOBS — wall.cooling_rate scales the drift exactly;
//      wall.thermal_pulses:false suppresses pulses entirely.
//   4. STAND-DOWN (the T-unlock) — a scenario movement on `temperature`
//      owns T for its window: ambient drift + pulses yield (zero thermal
//      draws), and ambient resumes when the window closes.
//   5. BOUNDARY AUTHORITY — heat carries no universal solute recipe, and pH
//      has no universal 6.5 attractor. Both require authored contracts.
//
// Plus a regression pin on the seed SCRAMBLE: bare (state ^ SALT) left
// nearby run seeds with correlated early streams (probe measured tutorial
// pulse-count variance collapse to ±0.00) — _makeThermalRng must not
// degrade back to the bare-XOR stream.
//
// Statistical equivalence of the mechanic itself (meanT / pulse-count
// distributions vs the pre-v181 shared-stream engine) is the standing
// instrument's job: tools/t-reconciliation-probe.mjs.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const SeededRandom: any;
declare const _liveRng: any;          // live handle to the bundle's `let rng` (setup.ts epilogue)
declare const _makeThermalRng: any;   // 85j

function mkSim(seed = 42, scenario = 'cooling') {
  setSeed(seed);
  const { conditions, events } = SCENARIOS[scenario]();
  return new VugSimulator(conditions, events);
}

describe('thermal stream (v181 T-reconciliation)', () => {

  it('ambient_cooling consumes ZERO shared-rng draws and advances the dedicated stream', () => {
    const sim = mkSim(7);
    const shared = _liveRng();
    const sharedBefore = shared.state;
    const thermalBefore = sim._thermalRng.state;
    const T0 = sim.conditions.temperature;

    sim.ambient_cooling();

    expect(shared.state).toBe(sharedBefore);          // shared cascade untouched
    expect(sim._thermalRng.state).not.toBe(thermalBefore); // thermal stream advanced
    expect(sim.conditions.temperature).toBeLessThan(T0);   // drift still cools
  });

  it('same seed → identical thermal trajectory (reproducibility)', () => {
    const trace = () => {
      const sim = mkSim(42);
      const Ts: number[] = [];
      for (let i = 0; i < 40; i++) { sim.run_step(); Ts.push(sim.conditions.temperature); }
      return Ts;
    };
    expect(trace()).toEqual(trace());
  });

  it('wall.cooling_rate scales the drift exactly (same stream, same draws)', () => {
    // Pulses off isolates the drift; the chance draw still happens every
    // call (last-&&-operand discipline), so both sims consume the thermal
    // stream identically and the per-call uniform multipliers match —
    // doubling the rate must exactly double the total drop.
    const drop = (rate: number) => {
      const sim = mkSim(11);
      sim.conditions.wall.thermal_pulses = false;
      sim.conditions.wall.cooling_rate = rate;
      const T0 = sim.conditions.temperature;
      for (let i = 0; i < 20; i++) sim.ambient_cooling();
      return T0 - sim.conditions.temperature;
    };
    const d15 = drop(1.5);
    const d30 = drop(3.0);
    expect(d15).toBeGreaterThan(0);
    expect(d30 / d15).toBeCloseTo(2.0, 6);
  });

  it('wall.thermal_pulses:false → no pulse ever; true → pulses fire once cooled', () => {
    // Direct ambient_cooling calls accumulate sim.log (only run_step resets
    // it), so 300 calls is a cheap full-life pulse census. T0=180 cools to
    // the 25°C floor fast → pulse chance ~10%/call: with pulses on the
    // census must catch several; with the flag off, exactly zero.
    const pulses = (flag: boolean) => {
      const sim = mkSim(13);
      sim.conditions.wall.thermal_pulses = flag;
      for (let i = 0; i < 300; i++) sim.ambient_cooling();
      return sim.log.filter((l: string) => l.includes('THERMAL PULSE')).length;
    };
    expect(pulses(false)).toBe(0);
    expect(pulses(true)).toBeGreaterThan(0);
  });

  it('an un-authored thermal pulse carries heat only, not universal solutes, acid, or flow', () => {
    const sim = mkSim(13);
    sim.conditions.wall.thermal_pulses = true;
    sim.conditions.wall.thermal_pulse_fluid = null;
    const before = {
      SiO2: sim.conditions.fluid.SiO2,
      Fe: sim.conditions.fluid.Fe,
      Mn: sim.conditions.fluid.Mn,
      pH: sim.conditions.fluid.pH,
      flow: sim.conditions.flow_rate,
    };
    for (let i = 0; i < 300; i++) sim.ambient_cooling();
    expect(sim.log.some((line: string) => line.includes('Heat-only pulse'))).toBe(true);
    expect({
      SiO2: sim.conditions.fluid.SiO2,
      Fe: sim.conditions.fluid.Fe,
      Mn: sim.conditions.fluid.Mn,
      pH: sim.conditions.fluid.pH,
      flow: sim.conditions.flow_rate,
    }).toEqual(before);
  });

  it('applies only the explicitly authored fracture-fluid package', () => {
    const sim = mkSim(13);
    sim.conditions.wall.thermal_pulses = true;
    sim.conditions.wall.thermal_pulse_fluid = {
      authority: 'synthetic locality boundary test',
      components_ppm: { Fe: 2, Mn: 0 },
      pH_delta: -0.25,
      flow_rate: 1.75,
    };
    const beforeFe = sim.conditions.fluid.Fe;
    const beforeMn = sim.conditions.fluid.Mn;
    const beforeSi = sim.conditions.fluid.SiO2;
    const beforePH = sim.conditions.fluid.pH;
    for (let i = 0; i < 300; i++) {
      sim.ambient_cooling();
      if (sim.log.some((line: string) => line.includes('Authored fracture fluid'))) break;
    }
    expect(sim.conditions.fluid.Fe).toBeCloseTo(beforeFe + 2, 12);
    expect(sim.conditions.fluid.Mn).toBe(beforeMn);
    expect(sim.conditions.fluid.SiO2).toBe(beforeSi);
    expect(sim.conditions.fluid.pH).toBeCloseTo(beforePH - 0.25, 12);
    // The ordinary end-of-step hydraulic decay remains independent of the
    // boundary composition: 1.75 × 0.9 = 1.575.
    expect(sim.conditions.flow_rate).toBeCloseTo(1.575, 12);
  });

  it('moves pH only toward an authored boundary, in either direction', () => {
    const noBoundary = mkSim(17);
    noBoundary.conditions.wall.thermal_pulses = false;
    noBoundary.conditions.fluid.pH = 5;
    noBoundary.ambient_cooling();
    expect(noBoundary.conditions.fluid.pH).toBe(5);

    const alkaline = mkSim(17);
    alkaline.conditions.wall.thermal_pulses = false;
    alkaline.conditions.wall.pH_boundary = {
      target_pH: 7, rate_per_step: 0.1, authority: 'synthetic buffer test',
    };
    alkaline.conditions.fluid.pH = 5;
    alkaline.conditions.flow_rate = 1;
    alkaline.ambient_cooling();
    expect(alkaline.conditions.fluid.pH).toBeCloseTo(5.1, 12);

    const acidic = mkSim(17);
    acidic.conditions.wall.thermal_pulses = false;
    acidic.conditions.wall.pH_boundary = {
      target_pH: 4, rate_per_step: 0.2, authority: 'synthetic acid boundary test',
    };
    acidic.conditions.fluid.pH = 6;
    acidic.conditions.flow_rate = 0.5;
    acidic.ambient_cooling();
    expect(acidic.conditions.fluid.pH).toBeCloseTo(5.9, 12);
  });

  it('stand-down: a movement owning temperature suppresses drift + pulses', () => {
    const sim = mkSim(17);
    // Stub controller: claims temperature for every step (unit-level; the
    // real controller is exercised in the integration test below).
    sim._movements = { drivesFieldAt: (f: string) => f === 'temperature' };
    sim.conditions.fluid.pH = 5.0;
    sim.conditions.flow_rate = 1.0;
    const T0 = sim.conditions.temperature;
    const thermalBefore = sim._thermalRng.state;

    sim.ambient_cooling();

    expect(sim.conditions.temperature).toBe(T0);            // no ambient drift
    expect(sim._thermalRng.state).toBe(thermalBefore);      // zero thermal draws in the window
    expect(sim.conditions.fluid.pH).toBe(5.0);              // no unauthored pH drift
  });

  it('integration: a declared temperature movement OWNS T for its window, ambient resumes after', () => {
    // cooling scenario: events:[] and nothing else writes T, so during the
    // window the trajectory must equal the movement setpoint EXACTLY —
    // under the pre-v181 engine ambient drift kept subtracting after the
    // movement set the field, so this test discriminates the stand-down.
    const sim = mkSim(42);
    sim.conditions.wall.thermal_pulses = false;   // deterministic resume phase
    // Clone _scenario before injecting — it references the shared parsed
    // spec object, and a movements leak would contaminate every later
    // SCENARIOS.cooling() in this worker.
    sim.conditions._scenario = Object.assign({}, sim.conditions._scenario, {
      movements: [{
        field: 'temperature', startStep: 0, endStep: 50,
        base: 170, ops: [{ kind: 'trend', amp: -40, ease: false }],
      }],
    });
    for (let s = 1; s <= 10; s++) {
      sim.run_step();
      expect(sim.conditions.temperature).toBeCloseTo(170 - 40 * (s / 50), 9);
    }
    // Window closes at step 50 → ambient drift resumes (pulses off, default
    // rate 1.5, ±20% noise → each step drops 1.2..1.8°C).
    for (let s = 11; s <= 50; s++) sim.run_step();
    const atClose = sim.conditions.temperature;   // step 50 = first ambient step after the window
    sim.run_step();                               // step 51
    const drop = atClose - sim.conditions.temperature;
    expect(drop).toBeGreaterThanOrEqual(1.2 - 1e-9);
    expect(drop).toBeLessThanOrEqual(1.8 + 1e-9);
  });

  it('seed scramble regression: the thermal stream is NOT the bare-XOR mulberry stream', () => {
    // Bare (state ^ 'HEAT') left nearby seeds correlated (collapsed
    // cross-seed pulse variance in the probe). Pin the scramble: the
    // stream must differ from the unscrambled one, and first outputs
    // across nearby states must actually spread.
    const HEAT_SALT = 0x48454154;
    const bare = new SeededRandom(((12345 ^ HEAT_SALT) >>> 0));
    expect(_makeThermalRng(12345).next()).not.toBe(bare.next());

    const firsts: number[] = [];
    for (let s = 1000; s < 1010; s++) firsts.push(_makeThermalRng(s).next());
    expect(Math.max(...firsts) - Math.min(...firsts)).toBeGreaterThan(0.3);
  });
});
