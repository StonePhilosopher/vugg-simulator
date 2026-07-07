#!/usr/bin/env node
/**
 * tools/v1c-genesis-census.mjs — W-K V1c cavity-genesis census.
 *
 * V1 paints dissolution scallops on ALL pocket/spherical/irregular/tabular walls, but only
 * the walls that actually dissolved (paleo_flow non-null) are dissolution cavities. To gate the
 * scallop texture on real genesis and give the rest their own textures, we need every scenario's
 * cavity GENESIS. This dumps the sim facts that bear on it — architecture, composition, matrix,
 * whether it dissolved (paleo_flow), reactivity — so the genesis taxonomy can be assigned from
 * geology (see the accompanying proposal). Grouped by current relief family.
 *
 *   node tools/v1c-genesis-census.mjs
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'v1c-genesis-census' });

function run(name) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  const ws = sim.wall_state || {};
  const w0 = conditions.wall || {};
  return {
    name,
    arch: ws.architecture || 'pocket',
    comp: w0.composition || ws.composition || '?',
    matrix: (w0.matrix ?? ws.matrix) || '',
    reactivity: w0.reactivity ?? 1.0,
    dissolved: (typeof ws.paleo_flow === 'number') ? ws.paleo_flow : null,
  };
}

const rows = Object.keys(SCENARIOS).sort().map(run);
const SCALLOPS = new Set(['pocket', 'spherical', 'irregular', 'tabular']);

console.log('scenario                              arch         composition   matrix         react  dissolved(paleo_flow)');
console.log('─'.repeat(110));
for (const r of rows) {
  const fam = r.arch === 'cleft' ? 'CLEFT' : r.arch === 'basin' ? 'BASIN' : (SCALLOPS.has(r.arch) ? 'scallop?' : r.arch);
  const dz = r.dissolved == null ? '   no   ' : `YES ${r.dissolved.toFixed(2)}`;
  console.log(`  ${r.name.padEnd(34)} ${r.arch.padEnd(11)} ${String(r.comp).padEnd(13)} ${String(r.matrix).padEnd(14)} ${String(r.reactivity).padStart(4)}   ${dz}   [${fam}]`);
}
console.log('─'.repeat(110));

// Group by (dissolved? , architecture, composition) to reveal the natural genesis clusters.
const byComp = {};
for (const r of rows) {
  if (r.dissolved != null || r.arch === 'cleft' || r.arch === 'basin') continue; // already has a genesis-right family
  const k = String(r.comp);
  (byComp[k] ||= []).push(r.name);
}
console.log('\nNON-dissolution, NON-cleft, NON-basin scenarios (the 29 that currently get scallops WRONGLY), grouped by composition:');
for (const k of Object.keys(byComp).sort()) {
  console.log(`  ${k.padEnd(14)} (${byComp[k].length}): ${byComp[k].join(', ')}`);
}
