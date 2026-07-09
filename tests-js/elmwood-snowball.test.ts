// tests-js/elmwood-snowball.test.ts — W-F O5 FIRST CONTENT (SIM 223): the
// Elmwood barite snowball.
//
// Elmwood is famous for barite on honey sphalerite (boss), and the scenario
// nucleated barite on the sphalerite base all along — but its barite σ peaked at
// 0.97 and never cleared the 1.0 growth floor, so the barite sat as subcritical
// DUST. O5's first content is the documented "purple fluorite + barite" stage:
// elmwood_barite_stage Ba pulses lift barite over its threshold, and clay /
// iron-oxide `film:` dustings between the pulses stall it — the stall→pulse→break
// cycle leaves masked_horizons buried in the blade = the snowball's concentric
// banding.
//
// THE SACRED CONSTRAINT (boss: elmwood is his favorite locality "because of the
// variety of cool stuff it makes"): the barite comes to life WITHOUT denting the
// variety — the golden scalenohedral calcite, the fluorite, the aragonite, the
// sphalerite base all come through, and no runaway new species (witherite) takes
// over. These pins guard exactly that.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runElmwood() {
  setSeed(42);
  const scen = SCENARIOS['elmwood']();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

function bySpecies(sim: any, mineral: string) {
  return sim.crystals.filter((c: any) => c && c.mineral === mineral && !c.dissolved);
}
function maxUm(sim: any, mineral: string) {
  const cs = bySpecies(sim, mineral);
  return cs.length ? Math.max(...cs.map((c: any) => c.total_growth_um)) : 0;
}

describe('W-F O5 — the Elmwood barite snowball (SIM 223)', () => {
  it('barite finally GROWS (was subcritical dust) — the snowball on sphalerite', () => {
    const sim = runElmwood();
    const grown = bySpecies(sim, 'barite').filter((c: any) => c.total_growth_um > 100);
    expect(grown.length, 'barite must grow past dust').toBeGreaterThanOrEqual(4);
  });

  it('each grown barite carries masked_horizons — the concentric snowball banding', () => {
    const sim = runElmwood();
    const grown = bySpecies(sim, 'barite').filter((c: any) => c.total_growth_um > 100);
    let withHorizons = 0, totalHorizons = 0;
    for (const c of grown) {
      const hz = c.zones.filter((z: any) => z.masked_horizon);
      if (hz.length) withHorizons++;
      totalHorizons += hz.length;
      // Every masked horizon is a positive-growth phantom (the O5b invariant).
      for (const z of hz) {
        expect(z.thickness_um).toBeGreaterThan(0);
        expect(!!z.is_phantom).toBe(false);
        expect(['clay', 'iron oxide']).toContain(z.film_mineral);
      }
    }
    expect(withHorizons, 'grown barite should show snowball horizons').toBeGreaterThanOrEqual(4);
    expect(totalHorizons, 'multiple bands fleet-wide').toBeGreaterThanOrEqual(8);
  });

  it('the outermost clay rind stays UNCLEARED on the finished blades (the dusty snowball skin)', () => {
    const sim = runElmwood();
    const grown = bySpecies(sim, 'barite').filter((c: any) => c.total_growth_um > 100);
    // The final clay rind (step 78) lands after the last Ba pulse, as σ wanes —
    // it never breaks through, so a finished blade ends still filmed.
    const stillFilmed = grown.filter((c: any) => c._film && c._film.mineral === 'clay');
    expect(stillFilmed.length, 'the dusty outer rind persists').toBeGreaterThanOrEqual(4);
  });

  it('THE VARIETY GUARD — the golden calcite + fluorite + aragonite + sphalerite base all survive', () => {
    const sim = runElmwood();
    // The crown jewel: the giant golden scalenohedral calcite, ~19 mm, must hold.
    expect(maxUm(sim, 'calcite') / 1000, 'golden calcite intact').toBeGreaterThan(17);
    // The other headliners of the "variety of cool stuff": all present + sized.
    expect(maxUm(sim, 'fluorite') / 1000, 'purple fluorite intact').toBeGreaterThan(18);
    expect(maxUm(sim, 'aragonite') / 1000, 'aragonite intact').toBeGreaterThan(40);
    expect(maxUm(sim, 'sphalerite') / 1000, 'honey sphalerite base intact').toBeGreaterThan(0.8);
    for (const m of ['smithsonite', 'selenite', 'galena', 'siderite']) {
      expect(bySpecies(sim, m).length, `${m} still in the assemblage`).toBeGreaterThan(0);
    }
  });

  it('no runaway new species — witherite (BaCO3) does not take over the beloved assemblage', () => {
    const sim = runElmwood();
    // The Ba stage is tuned (floor 28) to stay below witherite's growth threshold
    // against elmwood's high CO3, so barium goes into barite, not barium carbonate.
    const witheriteGrown = bySpecies(sim, 'witherite').filter((c: any) => c.total_growth_um > 100);
    expect(witheriteGrown.length, 'witherite must not grow into the assemblage').toBe(0);
  });
});
