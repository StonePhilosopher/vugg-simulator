#!/usr/bin/env node
/**
 * tools/v1b-flow-probe.mjs — W-K V1b flow-scaled scallops reachability probe.
 *
 * The D1b lesson: before trusting a field as a render driver, confirm it is POPULATED
 * and VARIES across the fleet. This runs every scenario at seed 42 and reports the wall's
 * dissolution-rate-weighted paleo_flow (WallState.paleo_flow, set in js/85d dissolve_wall)
 * plus the scallop tiling density it maps to (js/99a _wallReliefRepeat: Curl 1974, denser
 * scallops at higher flow). Scenarios that never dissolve report null → default sizing.
 *
 *   node tools/v1b-flow-probe.mjs
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'v1b-flow-probe' });

// Mirror js/99a _wallReliefRepeat (scallops branch) so the probe reports the ACTUAL density.
function scallopRepeat(flow) {
  if (typeof flow === 'number' && flow > 0) {
    const m = Math.max(0.6, Math.min(1.9, Math.pow(flow, 0.4)));
    return Math.max(2, Math.round(5 * m));
  }
  return 5; // base (null flow → default V1 tiling)
}
const SCALLOPS = new Set(['pocket', 'spherical', 'irregular', 'tabular']);

function run(name) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  const ws = sim.wall_state || {};
  const arch = ws.architecture || 'pocket';
  const pf = (typeof ws.paleo_flow === 'number') ? ws.paleo_flow : null;
  return { name, arch, fam: SCALLOPS.has(arch) ? 'scallops' : arch, paleo_flow: pf, repeat: scallopRepeat(pf) };
}

const names = Object.keys(SCENARIOS).sort();
const rows = names.map(run);

// Report
let dissolved = 0, scallopFleet = 0, moved = 0;
console.log('scenario                              arch        paleo_flow  scallop_repeat  Δ vs base(5)');
console.log('─'.repeat(92));
for (const r of rows) {
  const isScallop = r.fam === 'scallops';
  if (isScallop) scallopFleet++;
  if (r.paleo_flow != null) dissolved++;
  const moves = isScallop && r.paleo_flow != null && r.repeat !== 5;
  if (moves) moved++;
  const pf = r.paleo_flow == null ? '   —   ' : r.paleo_flow.toFixed(3).padStart(7);
  const rep = isScallop ? String(r.repeat).padStart(3) : ' · ';
  const delta = moves ? (r.repeat > 5 ? `+${r.repeat - 5} denser` : `${r.repeat - 5} coarser`) : '';
  console.log(`  ${r.name.padEnd(34)} ${r.arch.padEnd(11)} ${pf}       ${rep}          ${delta}`);
}
console.log('─'.repeat(92));
console.log(`fleet: ${names.length} scenarios · ${scallopFleet} scallop-family · ${dissolved} dissolved (non-null paleo_flow) · ${moved} scallop walls with a NON-DEFAULT density`);
const flows = rows.map(r => r.paleo_flow).filter(v => v != null).sort((a, b) => a - b);
if (flows.length) console.log(`paleo_flow spread (non-null): min ${flows[0].toFixed(3)} · median ${flows[Math.floor(flows.length / 2)].toFixed(3)} · max ${flows[flows.length - 1].toFixed(3)}`);
