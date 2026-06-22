#!/usr/bin/env node
// tools/etwin-probe.mjs — verify the calcite mechanical e-twin overprint (crystal-face-
// realism arc, deformation §5.3 tenant). A scenario `deformation` directive with
// style:'etwin' records onto sim._deformationEvents; classifyDeformation (js/45) tags
// surviving crystals that grew before the strain step with _deformation.kind='etwin';
// js/99i renders the parallel {01-12} twin lamellae. This sweeps the fleet at seed 42 and
// reports e-twin-tagged crystals (mineral, habit, size, atStep) so the render target is
// verified to exist + the habit/token is known. SIM-neutral read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'etwin-probe' });
const SEED = 42;

function run(scen) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (e) { return null; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps || 120;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

console.log('=== calcite e-twin overprint sweep (seed 42) ===');
let total = 0;
for (const scen of Object.keys(SCENARIOS)) {
  const s = run(scen);
  if (!s) continue;
  const tw = s.crystals.filter(c => c._deformation && c._deformation.kind === 'etwin' && !c.dissolved);
  if (!tw.length) continue;
  total += tw.length;
  const byMin = {};
  for (const c of tw) byMin[c.mineral] = (byMin[c.mineral] || 0) + 1;
  const amt = tw.map(c => c._deformation.amount);
  const atSteps = [...new Set(tw.map(c => c._deformation.atStep))];
  console.log(`  ${scen}: ${tw.length} e-twinned (${Object.entries(byMin).map(([m, n]) => `${m}×${n}`).join(', ')})` +
    ` amount ${Math.min(...amt).toFixed(2)}–${Math.max(...amt).toFixed(2)}, atStep ${atSteps.join('/')}`);
  console.log(`      habits: ${tw.map(c => `${c.mineral}=${c.habit}(${(c.total_growth_um || 0).toFixed(0)}µm)`).join(', ')}`);
}
console.log(total ? `\n✓ ${total} e-twinned crystals fleet-wide` : '\n(no e-twinned crystals — check the scenario deformation directive)');
