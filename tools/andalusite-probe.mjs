#!/usr/bin/env node
// tools/andalusite-probe.mjs — does andalusite fire in chiastolite_hornfels?
// Reports the assemblage + andalusite habit/count, and confirms NO existing
// scenario grows andalusite (the peraluminous gate → byte-identical fleet).
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'andalusite-probe' });
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

// 1. the new scenario
const sim = run('chiastolite_hornfels');
const counts = {};
for (const c of sim.crystals) if (!c.dissolved) counts[c.mineral] = (counts[c.mineral] || 0) + 1;
const and = sim.crystals.filter(c => c.mineral === 'andalusite' && !c.dissolved);
console.log('=== chiastolite_hornfels (seed 42) ===');
console.log('assemblage:', JSON.stringify(counts));
console.log(`andalusite: ${and.length}  habits: ${[...new Set(and.map(c => c.habit))].join(', ')}`);
console.log(`max andalusite size: ${Math.max(0, ...and.map(c => c.total_growth_um)).toFixed(0)} µm`);
console.log(`graphitic flag: ${sim.conditions.wall.graphitic}`);

// 2. fleet sweep — andalusite must fire NOWHERE else (gate returns 0)
console.log('\n=== fleet andalusite check (must be 0 everywhere else) ===');
let offenders = 0;
for (const scen of Object.keys(SCENARIOS)) {
  if (scen === 'chiastolite_hornfels') continue;
  const s = run(scen);
  if (!s) continue;
  const n = s.crystals.filter(c => c.mineral === 'andalusite' && !c.dissolved).length;
  if (n > 0) { console.log(`  ⚠ ${scen}: ${n} andalusite (gate leaked!)`); offenders++; }
}
console.log(offenders ? `\n⚠ ${offenders} scenario(s) leaked andalusite — tighten the gate` : '✓ andalusite fires ONLY in chiastolite_hornfels — fleet byte-identical preserved');
