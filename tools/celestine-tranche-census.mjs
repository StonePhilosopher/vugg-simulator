// tools/celestine-tranche-census.mjs — the S2 celestine tranche's instrument
// (2026-07-25, research/scenarios/elmwood/research-celestine-elmwood-2026-07-24.md §5).
//
// For each commissioned celestine tenant, walk seed 42 and report the CURRENT
// production supersaturation, the explicit sulfate share of dissolved sulfur,
// Sr/Ba range, and the exact production habit classifier. This tool used to
// present combined-S as today's engine and a sulfate-aware path as a proposed
// migration. That became scientifically false when SIM 268 promoted
// sulfateAvailablePpm into production; a census must describe executed science,
// not preserve a historical counterfactual as if it were still authoritative.
//
// PASSIVE instrument — prints, never gates, exit 0 always.
//
// Usage: node tools/celestine-tranche-census.mjs

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed, sulfateAvailablePpm, classifyCelestineHabit } =
  await h.loadSimBundle({ toolName: 'celestine-census', extraExports: ['sulfateAvailablePpm', 'classifyCelestineHabit'] });
if (typeof sulfateAvailablePpm !== 'function') {
  console.error('[celestine-census] sulfateAvailablePpm not exported from the bundle — aborting (a raw-S fallback would silently report sulfate fraction 1.00 and fake the whole table).');
  process.exit(0); // passive instrument — never a red gate, but never a lying table either
}

const TENANTS = ['elmwood', 'great_salt_plains', 'mvt', 'naica_geothermal',
  'reactivated_fluorite_vein', 'reactive_wall', 'searles_lake', 'sicily_solfifera'];

for (const name of TENANTS) {
  if (!SCENARIOS[name]) { console.log(`${name}: scenario missing, skipped`); continue; }
  setSeed(42);
  const scen = SCENARIOS[name]();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  const c = sim.conditions;

  const branches = {};
  let peak = 0, liveSteps = 0, fracSum = 0, fracN = 0;
  let srMin = 1e9, srMax = -1e9, baMax = 0;

  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = c.fluid;
    const sigma = c.supersaturation_celestine();
    if (sigma <= 0) continue;
    const sAvail = sulfateAvailablePpm(f, c.temperature);
    const dissolvedSulfur = Math.max(0, Number(f.S_sulfide) || 0)
      + Math.max(0, Number(f.S_sulfate) || 0);
    const frac = dissolvedSulfur > 0 ? sAvail / dissolvedSulfur : 0;
    fracSum += frac; fracN++;
    srMin = Math.min(srMin, f.Sr); srMax = Math.max(srMax, f.Sr);
    const baRatio = f.Sr > 0 ? f.Ba / Math.max(f.Sr, 0.1) : 0;
    baMax = Math.max(baMax, baRatio);
    peak = Math.max(peak, sigma);
    if (sigma >= 1.0) {
      liveSteps++;
      const br = classifyCelestineHabit(c, sigma).habit;
      branches[br] = (branches[br] || 0) + 1;
    }
  }

  const fracAvg = fracN ? (fracSum / fracN) : 0;
  console.log(`\n=== ${name} (${steps} steps) ===`);
  console.log(`  sulfate fraction avg ${fracAvg.toFixed(2)} · Sr ${srMin === 1e9 ? '-' : srMin}${srMax > srMin ? '→' + srMax : ''} · ba_ratio max ${baMax.toFixed(2)}`);
  console.log(`  CURRENT sulfate-authority engine: live ${String(liveSteps).padStart(3)} steps, peak σ ${peak.toFixed(2)}`);
  if (liveSteps) console.log(`  production habit branches at live steps: ${JSON.stringify(branches)}`);
}

console.log('\n[celestine-census] passive instrument — no gate, exit 0.');
