// tools/celestine-tranche-census.mjs — the S2 celestine tranche's instrument
// (2026-07-25, research/research-celestine-elmwood-2026-07-24.md §5).
//
// For every scenario that grows celestine at seed 42, walk the run per-step and
// record, at each step where celestine is live or near-live:
//   - the raw σ (current engine: s_f = min(fluid.S/40, 2.5))
//   - the MIGRATED σ (post-tranche: s_f = min(sulfateAvailablePpm/DIV, 2.5))
//     for a sweep of candidate divisors — the re-anchor is MEASURED, not chosen
//   - the sulfate fraction (sAvail/S), Sr, Ba, ba_ratio, and which grow_celestine
//     habit branch would fire (nodular / fibrous-Sicilian / Ba-fibrous / bladed /
//     tabular) so the Ba-fibrous gate's blast radius is known BEFORE the edit.
//
// σ under migration is recomputed exactly (σ is linear in s_f):
//   σ_new = σ_raw × s_f_new / s_f_old — cap handled on both sides.
//
// The verdict table answers: (a) which divisor keeps every CURRENT tenant's
// celestine alive without over-feeding the oxidizing tenants (searles/GSP have
// sulfate fraction ≈1.0 — a divisor tuned on elmwood's 0.44 boosts them ×2.2
// before the cap); (b) which tenants the ba_ratio>0.25 fibrous gate would touch.
//
// PASSIVE instrument — prints, never gates, exit 0 always.
//
// Usage: node tools/celestine-tranche-census.mjs

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed, sulfateAvailablePpm } =
  await h.loadSimBundle({ toolName: 'celestine-census', extraExports: ['sulfateAvailablePpm'] });
if (typeof sulfateAvailablePpm !== 'function') {
  console.error('[celestine-census] sulfateAvailablePpm not exported from the bundle — aborting (a raw-S fallback would silently report sulfate fraction 1.00 and fake the whole table).');
  process.exit(0); // passive instrument — never a red gate, but never a lying table either
}

const DIVISORS = [40, 25, 20, 18, 15];
const TENANTS = ['elmwood', 'great_salt_plains', 'mvt', 'naica_geothermal',
  'reactivated_fluorite_vein', 'reactive_wall', 'searles_lake', 'sicily_solfifera'];

function habitBranch(excess, S, baRatio) {
  if (excess > 1.5) return 'nodular';
  if (S > 200 && excess > 0.5) return 'fibrous(Sicily)';
  if (baRatio > 0.25) return 'Ba-fibrous(NEW)';
  if (excess > 0.3) return 'bladed';
  return 'tabular';
}

for (const name of TENANTS) {
  if (!SCENARIOS[name]) { console.log(`${name}: scenario missing, skipped`); continue; }
  setSeed(42);
  const scen = SCENARIOS[name]();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  const c = sim.conditions;

  // Per-divisor live-window accounting + peak σ; plus habit-branch tally at live steps.
  const acc = {};
  for (const d of DIVISORS) acc[d] = { liveSteps: 0, peak: 0 };
  const branches = {};
  let peakRaw = 0, liveRaw = 0, fracSum = 0, fracN = 0, srMin = 1e9, srMax = -1e9, baMax = 0;

  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = c.fluid;
    const sigRaw = c.supersaturation_celestine();
    if (sigRaw <= 0) continue;
    const sAvail = sulfateAvailablePpm(f, c.temperature);
    const frac = f.S > 0 ? sAvail / f.S : 0;
    fracSum += frac; fracN++;
    srMin = Math.min(srMin, f.Sr); srMax = Math.max(srMax, f.Sr);
    const baRatio = f.Sr > 0 ? f.Ba / Math.max(f.Sr, 0.1) : 0;
    baMax = Math.max(baMax, baRatio);
    const sfOld = Math.min(f.S / 40.0, 2.5);
    peakRaw = Math.max(peakRaw, sigRaw);
    if (sigRaw >= 1.0) {
      liveRaw++;
      const br = habitBranch(sigRaw - 1.0, f.S, baRatio);
      branches[br] = (branches[br] || 0) + 1;
    }
    for (const d of DIVISORS) {
      const sfNew = Math.min(sAvail / d, 2.5);
      const sigNew = sfOld > 0 ? sigRaw * (sfNew / sfOld) : 0;
      acc[d].peak = Math.max(acc[d].peak, sigNew);
      if (sigNew >= 1.0) acc[d].liveSteps++;
    }
  }

  const fracAvg = fracN ? (fracSum / fracN) : 0;
  console.log(`\n=== ${name} (${steps} steps) ===`);
  console.log(`  sulfate fraction avg ${fracAvg.toFixed(2)} · Sr ${srMin === 1e9 ? '-' : srMin}${srMax > srMin ? '→' + srMax : ''} · ba_ratio max ${baMax.toFixed(2)}`);
  console.log(`  RAW    : live ${String(liveRaw).padStart(3)} steps, peak σ ${peakRaw.toFixed(2)}  ← today's engine`);
  for (const d of DIVISORS) {
    const a = acc[d];
    const mark = d === 40 ? ' (migration only, no re-anchor)' : '';
    console.log(`  ÷${String(d).padEnd(3)}: live ${String(a.liveSteps).padStart(3)} steps, peak σ ${a.peak.toFixed(2)}${mark}`);
  }
  if (liveRaw) console.log(`  habit branches at live steps (post-tranche cascade): ${JSON.stringify(branches)}`);
}

console.log('\n[celestine-census] passive instrument — no gate, exit 0.');
