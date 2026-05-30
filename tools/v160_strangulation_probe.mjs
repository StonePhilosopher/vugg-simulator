// tools/v160_strangulation_probe.mjs — does the v160 depletion-halo
// strangulation gate (_wallStrangledFor) ever fire? Wraps the prototype
// method, counts true-returns (strangulation blocks) per scenario across
// all registered scenarios at seed 42, broken down by mineral.
//
// Usage: node tools/v160_strangulation_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'v160_strangulation_probe',
});

// Wrap the prototype method to count true-returns per (scenario, mineral).
const proto = VugSimulator.prototype;
const orig = proto._wallStrangledFor;
let counter = null;  // set per-scenario
proto._wallStrangledFor = function (mineral) {
  const res = orig.call(this, mineral);
  if (res && counter) {
    counter.total++;
    counter.byMineral[mineral] = (counter.byMineral[mineral] || 0) + 1;
  }
  return res;
};

const names = Object.keys(SCENARIOS).sort();
console.log(`Probing ${names.length} scenarios for strangulation-gate firings (seed 42)...\n`);
let anyFired = false;
for (const name of names) {
  setSeed(42);
  let conditions, events, defaultSteps;
  try {
    ({ conditions, events, defaultSteps } = SCENARIOS[name]());
  } catch (e) {
    console.log(`  ${name.padEnd(30)} (scenario build error: ${e.message})`);
    continue;
  }
  const sim = new VugSimulator(conditions, events);
  counter = { total: 0, byMineral: {} };
  const total = defaultSteps ?? 200;
  for (let i = 0; i < total; i++) sim.run_step();
  if (counter.total > 0) {
    anyFired = true;
    const breakdown = Object.entries(counter.byMineral)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${m}:${n}`)
      .join(' ');
    console.log(`  ${name.padEnd(30)} STRANGLED ${counter.total}× — ${breakdown}`);
  }
}
counter = null;
if (!anyFired) {
  console.log('  (gate never fired in any scenario at seed 42 — dormant/byte-identical)');
}
