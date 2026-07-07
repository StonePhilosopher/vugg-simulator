// tools/v1-wall-census.mjs — V1 (wall microtexture) scoping census. Commits nothing.
// Q: (1) does the render-visible wall carry `archetype` (the double-whitelist trap
// the matrix-skin work hit), and (2) how are the 6 archetypes distributed across the
// 38 scenarios — so V1 ships the RELIEF types that actually appear, not all four.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'v1-wall-census' });

// find the wall object the renderer would see (topoRenderThree(sim, wall))
function wallOf(sim) {
  return (sim.conditions && sim.conditions.wall) || sim.wall || (sim.state && sim.state.wall) || null;
}
const byArch = new Map();
const rows = [];
let sawArchetype = 0, total = 0;
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(42);
  let cfg; try { cfg = SCENARIOS[scen](); } catch { continue; }
  const sim = new VugSimulator(cfg.conditions, cfg.events);
  sim.run_step(); // one step so wall is fully initialised
  const w = wallOf(sim);
  total++;
  if (!w) { rows.push([scen, '(no wall found)', '', '']); continue; }
  const arch = w.architecture ?? '(null→pocket)';
  const litho = String(w.matrix || w.composition || 'limestone');
  const flow = w.flow_velocity ?? w.flow ?? w.velocity ?? '';
  if (w.architecture !== undefined) sawArchetype++;
  byArch.set(arch, (byArch.get(arch) || 0) + 1);
  rows.push([scen, arch, litho, flow === '' ? '' : `flow=${flow}`]);
}
console.log(`\n=== V1 WALL CENSUS (seed 42, ${total} scenarios) ===`);
console.log(`render-visible wall carries .archetype: ${sawArchetype}/${total}  ${sawArchetype === total ? '✓ no whitelist gap' : '✗ WHITELIST GAP — archetype not mirrored to render wall'}`);
console.log('\narchetype distribution:');
for (const [a, n] of [...byArch.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${String(a).padEnd(12)} ${n}`);
console.log('\nscenario                       archetype    lithology        flow');
console.log('------------------------------ ------------ ---------------- --------');
for (const r of rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || a[0].localeCompare(b[0]))) {
  console.log(`${r[0].slice(0, 30).padEnd(30)} ${String(r[1]).slice(0, 12).padEnd(12)} ${r[2].slice(0, 16).padEnd(16)} ${r[3]}`);
}
console.log('\n=> V1 relief types to ship = the archetypes that actually appear. cleft→fracture steps,');
console.log('   pocket/spherical/irregular→dissolution scallops, basin→sediment rind, tabular→?.\n');
