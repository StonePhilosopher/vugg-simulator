// tools/v160_diffusion_drift_probe.mjs — characterize the two test breaks
// from the v160 Phase 2b diffusion flip (_diffuseFull on).
//
//   1. lepidolite seed 1 in gem_pegmatite: 4 total vs cap=3. Is the 4th
//      crystal ENCLOSED (cap counts exposed → working as designed) or
//      EXPOSED (real cap bypass)?
//   2. reactive_wall seed 42: late-stretch pwp_net no longer goes
//      positive. Dump the equator pwp_net trajectory to see if it's a
//      marginal shift or a genuine loss of post-recovery precipitation.
//
// Usage: node tools/v160_diffusion_drift_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, MINERAL_SPEC, MINERAL_GATES_REGISTRY, pwpNetRate } =
  await loadSimBundle({
    toolName: 'v160_diffusion_drift_probe',
    extraExports: ['MINERAL_SPEC', 'MINERAL_GATES_REGISTRY', 'pwpNetRate'],
  });

// ---- 1. lepidolite cap ----------------------------------------------
console.log('\n========== gem_pegmatite lepidolite (seeds 42, 1, 7) ==========');
const cap = MINERAL_SPEC?.lepidolite?.max_nucleation_count;
console.log(`lepidolite spec max_nucleation_count = ${cap}`);
for (const seed of [42, 1, 7]) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['gem_pegmatite']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 230;
  for (let i = 0; i < steps; i++) sim.run_step();
  const lep = sim.crystals.filter(c => c.mineral === 'lepidolite');
  const exposed = lep.filter(c => c.enclosed_by == null && !c.dissolved);
  const enclosed = lep.filter(c => c.enclosed_by != null && !c.dissolved);
  const dissolved = lep.filter(c => c.dissolved);
  console.log(`\n  seed ${seed}: total=${lep.length}  exposed=${exposed.length}  enclosed=${enclosed.length}  dissolved=${dissolved.length}`);
  for (const c of lep) {
    const sizeUm = (c.zones ?? []).reduce((s, z) => s + (z.thickness_um || 0), 0);
    console.log(
      `    id=${String(c.crystal_id).padStart(3)} nuc@step=${String(c.nucleation_step).padStart(3)} ` +
      `exposed=${c.enclosed_by == null && !c.dissolved ? 'Y' : 'n'} ` +
      `enc_by=${c.enclosed_by ?? '-'} diss=${c.dissolved ? 'T' : 'F'} ` +
      `size=${sizeUm.toFixed(0)}um`,
    );
  }
}

// ---- 2. reactive_wall pwp_net trajectory ----------------------------
console.log('\n\n========== reactive_wall pwp_net @ equator (seed 42) ==========');
setSeed(42);
{
  const { conditions, events, defaultSteps } = SCENARIOS['reactive_wall']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  const probes = [];
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const eq = Math.floor(sim.ring_fluids.length / 2);
    const f = sim.ring_fluids[eq];
    const T = sim.ring_temperatures ? sim.ring_temperatures[eq] : sim.conditions.temperature;
    const net = pwpNetRate('calcite', f, T);
    probes.push({ step: sim.step, pwp_net: net, pH: f.pH, Ca: f.Ca, CO3: f.CO3, T });
  }
  // Late stretch = last 40% of steps (matches the test's intent).
  const lateStart = Math.floor(steps * 0.6);
  console.log(`  late stretch = steps ${lateStart}..${steps - 1}`);
  let posCount = 0, maxNet = -Infinity, maxStep = -1;
  for (const p of probes) {
    if (p.step >= lateStart) {
      if (p.pwp_net > 0) posCount++;
      if (p.pwp_net > maxNet) { maxNet = p.pwp_net; maxStep = p.step; }
    }
  }
  console.log(`  late-stretch positive pwp_net samples = ${posCount}`);
  console.log(`  late-stretch max pwp_net = ${maxNet.toExponential(3)} @ step ${maxStep}`);
  console.log(`\n  full trajectory (every 5 steps):`);
  for (const p of probes) {
    if (p.step % 5 === 0 || p.step >= lateStart) {
      console.log(
        `    step=${String(p.step).padStart(3)} pwp_net=${p.pwp_net.toExponential(2).padStart(11)} ` +
        `pH=${p.pH.toFixed(2)} Ca=${p.Ca.toFixed(0)} CO3=${p.CO3.toFixed(1)} T=${p.T.toFixed(0)}`,
      );
    }
  }
}
