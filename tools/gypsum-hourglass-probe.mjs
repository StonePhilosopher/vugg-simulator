#!/usr/bin/env node
// tools/gypsum-hourglass-probe.mjs — where does the VISIBLE hourglass selenite fire?
// Sweeps the fleet, runs each scenario at seed 42, and reports selenite crystals the
// js/45 classifier tagged _sectorZoned.kind==='gypsum_hourglass' (intensity / flooded).
// Confirms the SIM-neutral classifier works end-to-end and names a scenario to preview.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'gypsum-hourglass-probe' });
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

console.log('=== gypsum hourglass fleet sweep (seed 42) ===');
let total = 0;
for (const scen of Object.keys(SCENARIOS)) {
  const s = run(scen);
  if (!s) continue;
  const sel = s.crystals.filter(c => c.mineral === 'selenite' && !c.dissolved);
  const hg = sel.filter(c => c._sectorZoned && c._sectorZoned.kind === 'gypsum_hourglass');
  if (!sel.length) continue;
  if (hg.length) {
    total += hg.length;
    const inten = hg.map(c => c._sectorZoned.intensity);
    const flooded = hg.filter(c => c._sectorZoned.flooded).length;
    const steps = hg.map(c => c._sectorZoned.steps);
    console.log(`  ${scen}: ${sel.length} selenite, ${hg.length} HOURGLASS` +
      ` (intensity ${Math.min(...inten).toFixed(2)}–${Math.max(...inten).toFixed(2)}, flooded ${flooded}, steps ${steps.join('/')})` +
      ` | sizes ${hg.map(c => c.total_growth_um.toFixed(0)).join(',')}µm`);
  } else {
    console.log(`  ${scen}: ${sel.length} selenite, 0 hourglass (all water-clear)`);
  }
}
console.log(total ? `\n✓ ${total} hourglass selenite across the fleet` : '\n(no hourglass selenite fired — check engine inclusion conditions)');
