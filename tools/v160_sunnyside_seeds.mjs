// Is sunnyside rhodochrosite-enclosed-by-galena a seed-42 fluke or
// robust? Check rhodochrosite exposed/enclosed/dissolved across seeds,
// for v160 (current dist) vs gate-OFF (to isolate diffusion effect).
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'sunnyside_seeds' });
const proto = VugSimulator.prototype;
const realGate = proto._wallStrangledFor;
const SEEDS = [42, 1, 7, 13, 99, 2024, 17, 3];
function run(seed) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sunnyside_american_tunnel']();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
  const rh = sim.crystals.filter(c => c.mineral === 'rhodochrosite');
  return {
    total: rh.length,
    exposed: rh.filter(c => c.enclosed_by == null && !c.dissolved).length,
    enclosed: rh.filter(c => c.enclosed_by != null && !c.dissolved).length,
    dissolved: rh.filter(c => c.dissolved).length,
  };
}
console.log('sunnyside rhodochrosite across seeds (v160 = diffusion + gate):');
for (const s of SEEDS) {
  const r = run(s);
  console.log(`  seed ${String(s).padStart(4)}: total=${r.total} exposed=${r.exposed} enclosed=${r.enclosed} dissolved=${r.dissolved}`);
}
