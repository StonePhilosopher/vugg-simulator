// tests-js/engine-gates-coverage.test.ts — coverage invariant between
// MINERAL_ENGINES (js/65-mineral-engines.ts) and MINERAL_GATES_REGISTRY
// (js/42-mineral-gates-registry.ts).
//
// What this asserts:
//   1. Every mineral that the engine dispatcher knows how to grow has
//      a matching gates entry — the initiative module, library card,
//      and competitive sort all assume this. A new mineral that lands
//      an engine grow_<name> function without also exporting a
//      MINERAL_GATES_<name> constant + registry entry would silently
//      vanish from initiative ranking; this test makes that loud.
//   2. Every gates entry has at least the two required fields
//      (sigma_crit + surface_energy) populated with sane values.
//   3. No orphan gates entries (every gates entry is wired to a
//      MINERAL_ENGINES entry).
//
// Why this matters:
//   v127 introduced MINERAL_GATES_<mineral> constants in each of the
//   13 supersat files (~165 minerals) and consolidated them in
//   js/42-mineral-gates-registry.ts. The next milestone (v128 graduated
//   competition + initiative variable, per
//   proposals/PROPOSAL-INITIATIVE-VARIABLE.md) reads the registry to
//   rank competitive nucleation. Add-mineral discipline now requires
//   four file touches (data + supersat + engine + 65-engines dispatch)
//   plus a gates declaration + registry entry; this guard test enforces
//   the latter pair.

import { describe, expect, it } from 'vitest';

declare const MINERAL_ENGINES: Record<string, Function>;
declare const MINERAL_GATES_REGISTRY: Record<string, any>;

describe('engine-gates coverage invariant', () => {
  it('every MINERAL_ENGINES entry has a MINERAL_GATES_REGISTRY entry', () => {
    const engines = (globalThis as any).MINERAL_ENGINES as Record<string, Function>;
    const gates = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, any>;
    expect(engines, 'MINERAL_ENGINES should be on global scope').toBeDefined();
    expect(gates, 'MINERAL_GATES_REGISTRY should be on global scope').toBeDefined();

    const missing = Object.keys(engines).filter(name => !gates[name]);
    expect(
      missing,
      `${missing.length} mineral(s) have engines but no gates entry — add ` +
      `MINERAL_GATES_<name> in the matching js/3x-supersat-*.ts file and ` +
      `wire it in js/42-mineral-gates-registry.ts:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no orphan gates entries (every gates entry has an engine)', () => {
    const engines = (globalThis as any).MINERAL_ENGINES as Record<string, Function>;
    const gates = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, any>;

    const orphans = Object.keys(gates).filter(name => !engines[name]);
    expect(
      orphans,
      `${orphans.length} mineral(s) in gates registry but no engine — ` +
      `either remove the gates entry or add a grow_<name> + ` +
      `MINERAL_ENGINES entry:\n  ${orphans.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every gates entry has sigma_crit + surface_energy populated', () => {
    const gates = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, any>;
    const validSurfaceEnergies = new Set(['very_low', 'low', 'medium', 'high', 'very_high']);

    const bad: string[] = [];
    for (const [name, g] of Object.entries(gates)) {
      if (typeof g.sigma_crit !== 'number') bad.push(`${name}: sigma_crit not a number`);
      // sigma_crit = Infinity is the canonical no-fire marker (paramorph
      // stubs that only exist as transition products — tincalconite is
      // the v127 reference). Allow it.
      else if (!Number.isFinite(g.sigma_crit) && g.sigma_crit !== Infinity) bad.push(`${name}: sigma_crit=${g.sigma_crit} is non-finite and not Infinity (no-fire marker)`);
      else if (Number.isFinite(g.sigma_crit) && (g.sigma_crit < 0 || g.sigma_crit > 25)) bad.push(`${name}: sigma_crit=${g.sigma_crit} out of expected [0, 25] range (use Infinity for no-fire stubs)`);
      if (!validSurfaceEnergies.has(g.surface_energy)) bad.push(`${name}: surface_energy=${g.surface_energy} not in ${[...validSurfaceEnergies].join('/')}`);
    }
    expect(bad, `gates entries with missing/invalid required fields:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('registry size pin (sanity: not silently shrinking)', () => {
    // Pin tracks the v127 landing count. Bump when minerals are added.
    // If this fires unexpectedly, either you added a mineral (bump
    // expected) or a registry entry vanished (investigate).
    const gates = (globalThis as any).MINERAL_GATES_REGISTRY as Record<string, any>;
    const count = Object.keys(gates).length;
    expect(count, 'MINERAL_GATES_REGISTRY entry count').toBeGreaterThanOrEqual(165);
  });
});
