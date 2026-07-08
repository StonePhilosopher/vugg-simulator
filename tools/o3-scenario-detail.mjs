// tools/o3-scenario-detail.mjs — diagnostic: for a scenario+seed, is a mineral's
// count drop under O3b selection DIRECT burial (the mineral's own crystals got
// buried) or a SECOND-ORDER ripple (selection buried OTHER crystals → less fill
// → fewer of this mineral NUCLEATED)? Per-mineral {nucleated, active, buried}
// with selection OFF vs ON tells them apart.
//
// Usage: node tools/o3-scenario-detail.mjs <scenario> [seed]

import { loadSimBundle } from './_harness.mjs';

const scenario = process.argv[2] || 'sulphur_bank';
const seed = process.argv[3] ? (parseInt(process.argv[3], 10) | 0) : 1;

const { SCENARIOS, VugSimulator, setSeed, setGeometricSelectionEnabled } =
  await loadSimBundle({ toolName: 'o3-scenario-detail', extraExports: ['setGeometricSelectionEnabled'] });

function run(on) {
  setGeometricSelectionEnabled(on);
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[scenario]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  const by = {};
  for (const c of sim.crystals) {
    if (!c) continue;
    const m = c.mineral;
    by[m] = by[m] || { nucleated: 0, active: 0, buried: 0, dissolved: 0 };
    by[m].nucleated++;
    if (c._buried) by[m].buried++;
    if (c.dissolved) by[m].dissolved++;
    else if (c.active) by[m].active++;
  }
  return by;
}

const off = run(false);
const on = run(true);
setGeometricSelectionEnabled(true);

const minerals = [...new Set([...Object.keys(off), ...Object.keys(on)])].sort();
console.log(`# ${scenario} seed ${seed} — selection OFF → ON`);
console.log('mineral                nucleated   active    buried   (Δnucleated  Δactive)');
for (const m of minerals) {
  const o = off[m] || { nucleated: 0, active: 0, buried: 0 };
  const n = on[m] || { nucleated: 0, active: 0, buried: 0 };
  const dNuc = n.nucleated - o.nucleated, dAct = n.active - o.active;
  const flag = dNuc !== 0 ? '  ← RIPPLE (nucleation moved)' : (n.buried > 0 ? '  ← DIRECT (own crystals buried)' : '');
  console.log(
    `${m.padEnd(20)}  ${String(o.nucleated).padStart(3)}→${String(n.nucleated).padStart(3)}    ` +
    `${String(o.active).padStart(3)}→${String(n.active).padStart(3)}    ` +
    `${String(n.buried).padStart(3)}     (${dNuc >= 0 ? '+' : ''}${dNuc}       ${dAct >= 0 ? '+' : ''}${dAct})${flag}`,
  );
}
