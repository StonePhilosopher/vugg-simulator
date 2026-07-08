#!/usr/bin/env node
/**
 * tools/v1c-family-verify.mjs — confirm every scenario now carries a genesis and resolves to the
 * intended wall relief family (the V1c gate). Mirrors js/99a _wallReliefFamily.
 *   node tools/v1c-family-verify.mjs
 */
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'v1c-family-verify' });

const GEN2FAM = { dissolution: 'scallops', vein: 'comb', pocket: 'druse', supergene: 'boxwork',
  botryoidal: 'botryoidal', vesicle: 'smooth', metamorphic: 'smooth', cleft: 'cleft', evaporite: 'basin' };
const ARCH2FAM = { pocket: 'scallops', spherical: 'scallops', irregular: 'scallops', tabular: 'scallops', cleft: 'cleft', basin: 'basin' };
const family = (genesis, arch) => (genesis && GEN2FAM[genesis]) || ARCH2FAM[arch] || 'scallops';

function run(name) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  const ws = sim.wall_state || {};
  return { name, genesis: ws.genesis || null, arch: ws.architecture || 'pocket', fam: family(ws.genesis, ws.architecture) };
}

const rows = Object.keys(SCENARIOS).sort().map(run);
const byFam = {}, missing = [];
console.log('scenario                              genesis        → family');
console.log('─'.repeat(70));
for (const r of rows) {
  (byFam[r.fam] ||= []).push(r.name);
  if (!r.genesis) missing.push(r.name);
  console.log(`  ${r.name.padEnd(34)} ${String(r.genesis || '(none)').padEnd(13)} → ${r.fam}`);
}
console.log('─'.repeat(70));
for (const f of Object.keys(byFam).sort()) console.log(`  ${f.padEnd(12)} ${byFam[f].length}: ${byFam[f].join(', ')}`);
console.log(`\n${rows.length} scenarios · ${missing.length} WITHOUT genesis${missing.length ? ': ' + missing.join(', ') : ' (all assigned ✓)'}`);
const scallops = byFam.scallops || [];
console.log(`scallops now fire for ${scallops.length} scenarios (was 33 in V1 — the over-application) : ${scallops.join(', ')}`);
