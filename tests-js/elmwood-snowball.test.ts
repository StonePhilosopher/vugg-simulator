// tests-js/elmwood-snowball.test.ts — W-F O5 FIRST CONTENT (SIM 223): the
// Elmwood cyclic masked-barite hypothesis.
//
// Elmwood is famous for barite on honey sphalerite (boss), and the scenario
// nucleated barite on the sphalerite base all along — but its barite σ peaked at
// 0.97 and never cleared the 1.0 growth floor, so the barite sat as subcritical
// DUST. O5's first content is the documented "purple fluorite + barite" stage:
// elmwood_barite_stage Ba pulses lift barite over its threshold, and clay /
// iron-oxide `film:` dustings between the pulses stall it — the stall→pulse→break
// cycle leaves masked_horizons buried in the blade. This is a disclosed general
// mineral-ontogeny experiment, not a claim that these exact films are documented
// in an Elmwood specimen.
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
declare const StripRecorder: any;

function runElmwood() {
  setSeed(42);
  const scen = SCENARIOS['elmwood']();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

function recordElmwood() {
  setSeed(42);
  const scen = SCENARIOS['elmwood']();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  const recorder = new StripRecorder(sim, { duration_steps: steps, notes: 'Elmwood evidence control' });
  sim._stripRecorder = recorder;
  for (let i = 0; i < steps; i++) sim.run_step();
  return { sim, dataset: recorder.finalize() };
}

function bySpecies(sim: any, mineral: string) {
  return sim.crystals.filter((c: any) => c && c.mineral === mineral && !c.dissolved);
}
function maxUm(sim: any, mineral: string) {
  const cs = bySpecies(sim, mineral);
  return cs.length ? Math.max(...cs.map((c: any) => c.total_growth_um)) : 0;
}

describe('W-F O5 — the Elmwood cyclic masked-layer hypothesis', () => {
  it('barite finally GROWS (was subcritical dust) on the sphalerite-bearing stage', () => {
    const sim = runElmwood();
    const grown = bySpecies(sim, 'barite').filter((c: any) => c.total_growth_um > 100);
    // S1 (SIM 235, the fluid.S sulfate/sulfide split): ≥4 → ≥2. Pre-split, barite
    // read the FULL fluid.S — an effective-sulfate over-count against which the σ
    // cap was originally calibrated. The split reads only the oxidized-sulfate pool
    // (sulfateAvailablePpm), and elmwood's MVT broth is mildly reducing, so most of
    // its S partitions to H₂S: the valence-correct run has 2 blades, not the old 10. This
    // is a calibration correction (the model got less fake), NOT a starvation bug —
    // the boss eye-checked v234-vs-v235 and confirmed the 2-blade render still reads
    // as a visible Elmwood barite stage (silhouette + locality signal intact). The
    // MECHANISM (stall→pulse→break-through banding on the sphalerite base) is what
    // these pins guard, not the pre-split blade lottery.
    expect(grown.length, 'barite must grow past dust').toBeGreaterThanOrEqual(2);
    const sulfurPulse = (sim._sulfurBoundaryTransactions || [])
      .find((tx: any) => tx.step === 28);
    expect(sulfurPulse, 'the sulfate-water import is ledgered').toMatchObject({
      closed: true,
      declarations: [{ kind: 'addition', pool: 'sulfate', amountPpmPerFluid: 81 }],
    });
    expect(sim._sulfurPropagationViolations || []).toEqual([]);
  });

  it('each grown barite carries causal masked horizons from the disclosed model experiment', () => {
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
      // SIM 274: the film itself must stall the blade. Breakthrough occurs at
      // the NEXT authored Ba pulse (50/68), never on the film steps (40/60).
      expect(hz.map((z: any) => z.step)).toEqual([50, 68]);
    }
    // S1 (SIM 235): ≥4 → ≥2. Both honest blades carry a masked horizon (the split
    // trims the blade COUNT, not the banding mechanism inside each surviving blade).
    expect(withHorizons, 'grown barite should show masked horizons').toBeGreaterThanOrEqual(2);
    // v228: ≥8 → ≥6. The v223 pin recorded the exact band count of that seed's
    // deal (4 blades × 2 breaks). The SIM 228 S-economy re-deal (stronger honey
    // sphalerite) left one blade with a single break. S1 (SIM 235): ≥6 → ≥2 — with
    // 2 honest blades × 1 break each, 2 is the mechanism floor (each grown blade
    // banded), not the pre-split lottery count.
    expect(totalHorizons, 'multiple bands fleet-wide').toBeGreaterThanOrEqual(2);
  });

  it('the hypothesized outermost clay rind stays UNCLEARED on the finished blades', () => {
    const sim = runElmwood();
    const grown = bySpecies(sim, 'barite').filter((c: any) => c.total_growth_um > 100);
    // The final clay rind (step 78) lands after the last Ba pulse, as σ wanes —
    // it never breaks through, so a finished blade ends still filmed.
    const stillFilmed = grown.filter((c: any) => c._film && c._film.mineral === 'clay');
    // S1 (SIM 235): ≥4 → ≥2. Both honest blades end filmed (the rind persists on
    // every finished blade; the split trimmed the count, not the skin behaviour).
    expect(stillFilmed.length, 'the dusty outer rind persists').toBeGreaterThanOrEqual(2);
    const baTransactions = (sim._fluidBoundaryTransactions || [])
      .filter((tx: any) => [28, 40, 50, 60, 68, 78].includes(tx.step));
    expect(baTransactions.map((tx: any) => tx.step)).toEqual([28, 40, 50, 60, 68, 78]);
    expect(baTransactions.every((tx: any) => tx.closed)).toBe(true);
  });

  it('records the boundary, source-film, breakthrough, and terminal-rind evidence needed by archives', () => {
    const { dataset } = recordElmwood();
    const baTransactions = (dataset.fluid_boundary_testimony || [])
      .filter((tx: any) => (tx.testimony || []).some((row: any) => row.field === 'Ba'));
    expect(baTransactions.map((tx: any) => tx.step)).toEqual([28, 40, 50, 60, 68, 78]);
    expect(baTransactions.every((tx: any) => tx.closed)).toBe(true);

    const horizons = (dataset.layer_growth_testimony || [])
      .filter((row: any) => row.mineral === 'barite' && row.masked_horizon);
    expect([...new Set(horizons.map((row: any) => row.step))]).toEqual([50, 68]);
    expect([...new Set(horizons.map((row: any) => row.originating_film_step))]).toEqual([40, 60]);
    expect(horizons.length).toBeGreaterThan(0);
    expect(horizons.every((row: any) => row.thickness_um > 0
      && ['clay', 'iron oxide'].includes(row.film_mineral))).toBe(true);

    const finalFilms = (dataset.habit_morphology_testimony || [])
      .filter((row: any) => row.mineral === 'barite' && row.surface_film);
    expect(finalFilms.length).toBeGreaterThan(0);
    expect(finalFilms.every((row: any) => row.surface_film.mineral === 'clay'
      && row.surface_film.step === 78)).toBe(true);
  });

  it('THE VARIETY GUARD — the golden calcite + fluorite + sphalerite base all survive', () => {
    const sim = runElmwood();
    // The crown jewel remains a centimetre-scale golden scalenohedron. SIM 271
    // replaces the unbounded positive-affinity continuation of the diagnostic
    // PWP expression with the disclosed series-resistance production closure;
    // the old ~19 mm / >17 mm pin therefore no longer represents the corrected
    // rate model (seed 42 now resolves 14.293 mm). Keep a conservative 12 mm
    // specimen-scale guard rather than retuning chemistry to recover old growth.
    expect(maxUm(sim, 'calcite') / 1000, 'golden calcite intact').toBeGreaterThan(12);
    // The other headliners of the "variety of cool stuff": all present + sized.
    // SIM 273 retired the uncited shared Cave-in-Rock mixing package. Elmwood's
    // own Gratz-Misra brine now supplies +22 ppm F and +70 ppm Ca instead of the
    // borrowed +40/+100 recipe, so seed 42 resolves a 10.3 mm fluorite rather
    // than the old 22.4 mm result. Guard a clearly specimen-scale purple cube;
    // do not restore an unrelated locality's inventory merely to preserve size.
    expect(maxUm(sim, 'fluorite') / 1000, 'purple fluorite intact').toBeGreaterThan(8);
    // v228 (hostile-review rung 2): the old `aragonite > 40mm` line guarded the
    // 121°C step-0 aragonite the review CONFIRMED as a hot-vein confabulation —
    // Elmwood's documented carbonate is calcite, no aragonite at all. The
    // spring-window favorability killed the hot firing (any residual aragonite
    // now nucleates late/cool and small); a confabulated crystal is not a
    // headliner to guard. Guard the DOCUMENTED variety only.
    // v228: 0.8 → 0.6. Sphalerite is per-step STRONGER post-SIM-228 (the ZnS
    // polymorph fix), but this seed's nucleation re-deal gives 2 crystals
    // (was 3) topping ~0.70 mm — the base is present and visible, which is
    // the claim; the canary's 200 chem-seeds are the fleet-level instrument
    // for the strengthening prediction.
    expect(maxUm(sim, 'sphalerite') / 1000, 'honey sphalerite base intact').toBeGreaterThan(0.6);
    // rung-4d (SIM 233): smithsonite REMOVED from this pin — it was the leak,
    // not the variety. The one elmwood smithsonite nucleated at step 88,
    // Eh +24, ONE step after sphalerite at the same +24: supergene Zn
    // carbonate minting in the reduced MVT ore brine (floor 0.2 ≈ 0 mV sat
    // below the SO₄/HS boundary). Elmwood's documented Zn is sphalerite —
    // smithsonite is not in its expects_species; the same guard's own v228
    // note applies: a confabulated crystal is not a headliner to guard.
    // Elmwood's locality record does not license gypsum/selenite. The old
    // positive pin was an artefact of the pre-v244 split CaSO4 pathways.
    expect(bySpecies(sim, 'selenite').length, 'no undocumented Elmwood gypsum').toBe(0);
    // SIM 268: galena and pyrite remain locality-licensed possibilities, but
    // the valence-correct three-seed fluid path does not promise them. The
    // former positive galena pin was sustained by combined-S admission.
    expect(bySpecies(sim, 'galena').length, 'no sulfate-fed Elmwood galena').toBe(0);
    expect(bySpecies(sim, 'pyrite').length, 'no sulfate-fed Elmwood pyrite').toBe(0);
    // SIM 261/268 locality reconciliation: neither siderite nor discrete
    // strontianite occurs in the audited Elmwood-Gordonsville inventory.
    expect(bySpecies(sim, 'siderite').length, 'no undocumented Elmwood siderite').toBe(0);
    expect(bySpecies(sim, 'strontianite').length, 'no undocumented Elmwood strontianite').toBe(0);
  });

  it('no runaway new species — witherite (BaCO3) does not take over the beloved assemblage', () => {
    const sim = runElmwood();
    // The Ba stage is tuned (floor 28) to stay below witherite's growth threshold
    // against elmwood's high CO3, so barium goes into barite, not barium carbonate.
    const witheriteGrown = bySpecies(sim, 'witherite').filter((c: any) => c.total_growth_um > 100);
    expect(witheriteGrown.length, 'witherite must not grow into the assemblage').toBe(0);
  });
});
