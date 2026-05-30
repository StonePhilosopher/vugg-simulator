// Quick perf probe to verify v159 diffusion is fast enough.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'voxel_diffuse_timing',
});
for (const name of ['mvt', 'sabkha_dolomitization', 'sunnyside_american_tunnel']) {
  setSeed(42);
  const scn = SCENARIOS[name];
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 200;
  const t0 = Date.now();
  for (let i = 0; i < total; i++) sim.run_step();
  const dt = Date.now() - t0;
  console.log(`${name.padEnd(30)} ${total} steps: ${dt} ms (${(dt/total).toFixed(1)} ms/step)`);
}
