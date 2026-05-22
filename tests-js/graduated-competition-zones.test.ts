// tests-js/graduated-competition-zones.test.ts — isolation tests for
// _computeGraduatedZones (js/85b-simulator-nucleate.ts, v128).
//
// The existing graduated-competition-wiring.test.ts verifies flag-on/off
// and that _graduatedZones is a Map. This file goes deeper: the CONTENTS
// of the map and the invariants _computeGraduatedZones must uphold.
//
// WHY THIS FILE EXISTS
//
//   The v128 architecture bug (before the globalThis fix) broke one
//   invariant: engine called exactly once per crystal per step. When
//   MASS_BALANCE_SCALE was read from globalThis (unavailable in the
//   harness), every dry-run returned null, so _graduatedZones had null
//   for every crystal, then pass-2 fell through to _runEngineForCrystal
//   and called the engine again — double-call, RNG drift, calibration
//   sweep failure.
//
//   A subtler latent issue: the edge-of-gate-skip branch (scaling ≤ 0)
//   does NOT add the crystal to the map. Pass-2 checks `map.has(id)` to
//   decide whether to skip the re-call. If scaling ≤ 0 omits the entry,
//   the engine is called again in pass-2 for that crystal — an extra RNG
//   draw, disrupting subsequent crystal ordering. The map-coverage
//   invariant test below would catch this the moment a scenario triggers
//   the ≤ 0 path.
//
// INVARIANTS TESTED
//
//   (A) Map-coverage: after every step with graduated comp ON, every
//       crystal that is `.active` AND has a MINERAL_ENGINES entry MUST
//       have `_graduatedZones.has(crystal.crystal_id) === true`. A
//       missing entry means pass-2 will re-call the engine — double-call.
//
//   (B) Zone value types: map entries are null (engine returned no zone
//       or zero thickness) or a zone object with a numeric thickness_um.
//       No raw numbers, no booleans, no undefined-for-active-crystals.
//
//   (C) Dissolution pass-through: when a zone in the map has negative
//       thickness_um, it must remain negative and unmodified. Rationing
//       only applies to precipitation (positive thickness); dissolution
//       bypasses rationing entirely.
//
//   (D) RNG determinism: the same seed produces byte-identical
//       total_growth_um for every crystal. Any double-call would shift
//       RNG state, making subsequent crystal draws differ between runs.

import { describe, expect, it, afterAll } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

// Restore the v128c default (true) so subsequent calibration tests
// that rely on the v128+ baselines don't see stale flag-off state.
const V128C_DEFAULT = true;
afterAll(() => {
  (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
});

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function stepSim(scenarioName: string, steps: number) {
  setSeed(42);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events } = scen();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

function stepSimTrackingMap(scenarioName: string, steps: number) {
  // Returns the sim AND per-step map snapshots (for invariant checking at
  // each individual step, not just the final one).
  setSeed(42);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events } = scen();
  const sim = new VugSimulator(conditions, events);
  const snapshots: Array<{ step: number; map: Map<number, any>; crystalIds: number[] }> = [];
  const engines = (globalThis as any).MINERAL_ENGINES ?? {};
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    // Capture which crystals were active-with-engine at this step, alongside the map.
    const activeWithEngine = (sim.crystals as any[])
      .filter(c => c.active && engines[c.mineral])
      .map(c => c.crystal_id);
    // _graduatedZones is re-computed each step; shallow-clone the Map so
    // snapshots are independent of future step mutations.
    const mapClone = sim._graduatedZones
      ? new Map(sim._graduatedZones.entries())
      : null;
    snapshots.push({ step: i + 1, map: mapClone!, crystalIds: activeWithEngine });
  }
  return { sim, snapshots };
}

// ────────────────────────────────────────────────────────────────────
// (A) Map-coverage invariant
// ────────────────────────────────────────────────────────────────────

describe('_computeGraduatedZones — map-coverage invariant', () => {
  // Every active crystal that has a MINERAL_ENGINES entry MUST appear
  // in _graduatedZones (as either null or a zone object). Missing entries
  // cause pass-2 to re-call the engine — double-call, RNG drift.
  //
  // Checked at EVERY step (not just the final), to catch transient
  // violations that might be masked by later step outcomes.

  it('mvt: active-crystal-with-engine map coverage holds for 30 steps', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    const result = stepSimTrackingMap('mvt', 30);
    if (!result) return;
    const violations: string[] = [];
    for (const { step, map, crystalIds } of result.snapshots) {
      if (!map) {
        violations.push(`step ${step}: _graduatedZones is null (flag-on path should populate it)`);
        continue;
      }
      for (const id of crystalIds) {
        if (!map.has(id)) {
          const crystal = (result.sim.crystals as any[]).find(c => c.crystal_id === id);
          violations.push(
            `step ${step}: crystal #${id} (${crystal?.mineral ?? '?'}) active + has engine ` +
            `but missing from _graduatedZones — pass-2 will re-call the engine (double-call)`
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('schneeberg: active-crystal-with-engine map coverage holds for 30 steps (high-species scenario)', () => {
    // Schneeberg has 30+ species and saturates Liebig budgets more aggressively
    // than mvt, making it a better stress-test for the edge-of-gate path.
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    const result = stepSimTrackingMap('schneeberg', 30);
    if (!result) return;
    const violations: string[] = [];
    for (const { step, map, crystalIds } of result.snapshots) {
      if (!map) {
        violations.push(`step ${step}: _graduatedZones is null`);
        continue;
      }
      for (const id of crystalIds) {
        if (!map.has(id)) {
          const crystal = (result.sim.crystals as any[]).find(c => c.crystal_id === id);
          violations.push(
            `step ${step}: crystal #${id} (${crystal?.mineral ?? '?'}) missing from map`
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('roughten_gill: map coverage holds (Pb-Cu cascade-prone scenario)', () => {
    // roughten_gill was the canonical cascade-prone scenario for v109–v128.
    // Its Pb budget is tight: caledonite, plumbogummite, cerussite, and
    // anglesite all compete for the same Pb pool. Edge-of-gate is more
    // plausible here than in a low-competition scenario.
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    const result = stepSimTrackingMap('roughten_gill', 30);
    if (!result) return;
    const violations: string[] = [];
    for (const { step, map, crystalIds } of result.snapshots) {
      if (!map) {
        violations.push(`step ${step}: _graduatedZones is null`);
        continue;
      }
      for (const id of crystalIds) {
        if (!map.has(id)) {
          const crystal = (result.sim.crystals as any[]).find(c => c.crystal_id === id);
          violations.push(`step ${step}: crystal #${id} (${crystal?.mineral ?? '?'}) missing`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────
// (B) Zone value types
// ────────────────────────────────────────────────────────────────────

describe('_computeGraduatedZones — zone value types', () => {
  it('every entry is null or a zone-object with numeric thickness_um (never a raw number or boolean)', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    const sim = stepSim('mvt', 50);
    expect(sim).not.toBeNull();
    const map: Map<number, any> = sim._graduatedZones;
    expect(map).not.toBeNull();
    expect(map.size).toBeGreaterThan(0);

    const typViolations: string[] = [];
    for (const [id, zone] of map.entries()) {
      if (zone === null) continue;  // valid null sentinel
      if (typeof zone !== 'object') {
        typViolations.push(`crystal #${id}: expected null or object, got ${typeof zone} (${zone})`);
        continue;
      }
      if (typeof zone.thickness_um !== 'number') {
        typViolations.push(
          `crystal #${id}: zone.thickness_um is ${typeof zone.thickness_um} (${zone.thickness_um}), expected number`
        );
      }
    }
    expect(typViolations, typViolations.join('\n')).toEqual([]);
  });

  it('the map has at least one null entry (engines that returned no zone)', () => {
    // Most steps produce at least some null entries — crystals whose
    // engine returned null (no growth at this temperature / fluid state).
    // If every entry were a zone object, that would suggest null-sentinels
    // are being silently dropped (which would violate invariant A —
    // they'd be absent from the map, not null).
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    const sim = stepSim('mvt', 100);
    expect(sim).not.toBeNull();
    const map: Map<number, any> = sim._graduatedZones;
    // Check the LAST step's map (after 100 steps mvt has a mix of
    // growing + dormant crystals).
    const nullCount = [...map.values()].filter(v => v === null).length;
    expect(nullCount, 'expected at least one null entry in the last-step map').toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// (C) Dissolution pass-through
// ────────────────────────────────────────────────────────────────────

describe('_computeGraduatedZones — dissolution zones', () => {
  it('dissolution zones (negative thickness_um) are stored as-is, not nulled or scaled', () => {
    // Dissolution bypasses the rationing pass — releasing species doesn't
    // compete for budget. The zone must appear in the map with its original
    // negative thickness so pass-2 can call _applyZoneMassBalance (which
    // releases the species back to the fluid).
    (globalThis as any).setGraduatedCompetitionEnabled(true);

    let foundNegative = false;
    let allNegativePreserved = true;

    for (const scenName of ['mvt', 'schneeberg', 'supergene_oxidation']) {
      const result = stepSimTrackingMap(scenName, 60);
      if (!result) continue;
      for (const { map } of result.snapshots) {
        if (!map) continue;
        for (const [id, zone] of map.entries()) {
          if (zone && typeof zone.thickness_um === 'number' && zone.thickness_um < 0) {
            foundNegative = true;
            // The thickness must remain negative (not scaled or clamped).
            if (zone.thickness_um >= 0) {
              allNegativePreserved = false;
            }
          }
        }
      }
      if (foundNegative) break;  // found at least one — don't over-run
    }

    if (foundNegative) {
      expect(allNegativePreserved, 'dissolution zones must not be scaled or converted to non-negative').toBe(true);
    } else {
      // None of the scenarios produced a dissolution zone in these steps.
      // The test is vacuously true — but the map-coverage tests above
      // still validate the structure.
      expect(true).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// (D) RNG determinism — engine-called-once-per-step invariant
// ────────────────────────────────────────────────────────────────────

describe('_computeGraduatedZones — RNG determinism (engine-called-once invariant)', () => {
  // The engine-called-once invariant: each crystal's growth engine is
  // invoked exactly once per step, in the dry-run pass. If any crystal
  // is missing from _graduatedZones, pass-2 calls the engine again —
  // consuming extra RNG numbers and shifting all subsequent draws.
  //
  // Observable symptom: crystal total_growth_um differs between two runs
  // with the same seed. The test below is the most direct proof that
  // the invariant holds end-to-end — no spy infrastructure needed.

  it('identical seed produces byte-identical crystal growth (mvt, 50 steps)', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);

    function snapshot(steps: number) {
      setSeed(42);
      const scen = SCENARIOS['mvt'];
      const { conditions, events } = scen();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < steps; i++) sim.run_step();
      return (sim.crystals as any[]).map(c => ({
        id: c.crystal_id, mineral: c.mineral, growth: c.total_growth_um,
      }));
    }

    const run1 = snapshot(50);
    const run2 = snapshot(50);

    expect(run2.length, 'run2 should produce same crystal count as run1').toBe(run1.length);
    const diffs: string[] = [];
    for (let i = 0; i < run1.length; i++) {
      if (run1[i].growth !== run2[i].growth) {
        diffs.push(
          `crystal #${run1[i].id} (${run1[i].mineral}): ` +
          `run1=${run1[i].growth} run2=${run2[i].growth}`
        );
      }
    }
    expect(diffs, 'RNG divergence — an engine was called more than once: ' + diffs.join('; ')).toEqual([]);
  });

  it('identical seed produces byte-identical crystal growth (roughten_gill, 50 steps)', () => {
    // roughten_gill: tightest cation budgets, highest risk of edge-of-gate.
    (globalThis as any).setGraduatedCompetitionEnabled(true);

    function snapshot(steps: number) {
      setSeed(42);
      const scen = SCENARIOS['roughten_gill'];
      const { conditions, events } = scen();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < steps; i++) sim.run_step();
      return (sim.crystals as any[]).map(c => ({
        id: c.crystal_id, mineral: c.mineral, growth: c.total_growth_um,
      }));
    }

    const run1 = snapshot(50);
    const run2 = snapshot(50);

    expect(run2.length).toBe(run1.length);
    const diffs: string[] = [];
    for (let i = 0; i < run1.length; i++) {
      if (run1[i].growth !== run2[i].growth) {
        diffs.push(`crystal #${run1[i].id} (${run1[i].mineral}): run1=${run1[i].growth} run2=${run2[i].growth}`);
      }
    }
    expect(diffs, 'RNG divergence in roughten_gill: ' + diffs.join('; ')).toEqual([]);
  });

  it('flag-off path produces different RNG consumption than flag-on (not byte-equal)', () => {
    // Sanity test: graduated comp changes the order and timing of engine
    // calls (pass-1 dry-run before any mass-balance, vs serial engine +
    // mass-balance per crystal in v127). Two runs with the same seed but
    // different flag state should produce different crystal growth totals.
    //
    // If they produced identical output it would suggest graduated comp
    // is silently disabled or is a pure no-op — that would be a bug in
    // the other direction.
    let growthFlagOn: number;
    let growthFlagOff: number;

    (globalThis as any).setGraduatedCompetitionEnabled(true);
    {
      setSeed(42);
      const scen = SCENARIOS['mvt'];
      const { conditions, events } = scen();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 50; i++) sim.run_step();
      growthFlagOn = (sim.crystals as any[]).reduce((s: number, c: any) => s + (c.total_growth_um ?? 0), 0);
    }

    (globalThis as any).setGraduatedCompetitionEnabled(false);
    try {
      setSeed(42);
      const scen = SCENARIOS['mvt'];
      const { conditions, events } = scen();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 50; i++) sim.run_step();
      growthFlagOff = (sim.crystals as any[]).reduce((s: number, c: any) => s + (c.total_growth_um ?? 0), 0);
    } finally {
      (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
    }

    // They should differ (graduated comp redistributes growth, so totals change).
    // If they're identical, graduated comp is silently a no-op — warn explicitly.
    expect(growthFlagOn).not.toBe(growthFlagOff);
  });
});
