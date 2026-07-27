// tools/selenite-tranche-census.mjs — the S2 selenite migration's instrument
// (2026-07-27, HANDOFF-S2-CELESTINE-AND-THE-REVIEW-2026-07-25.md §NEXT).
//
// Selenite is the THIRD sulfate consumer to migrate off total `fluid.S`
// (barite S1, celestine S2-tranche-1). Same census-first discipline: for every
// scenario that grows selenite at seed 42, walk the run per-step and record,
// at each step where selenite σ is live:
//   - the raw σ (current engine: s_f = fluid.S/50 — UNCAPPED, unlike
//     celestine's min(S/40, 2.5); σ is linear in s_f so the migrated σ is an
//     exact ratio recompute, no cap bookkeeping on either side)
//   - the MIGRATED σ (s_f = sulfateAvailablePpm/DIV) for a sweep of candidate
//     divisors — the re-anchor is MEASURED, not chosen
//   - the sulfate fraction (sAvail/S), Ca range, T at live steps (selenite's
//     T_max 80 gate + >60 soft decay mean the live window is T-shaped too)
//
// Verdict table answers: (a) which divisor keeps every LEGIT tenant alive at
// the honest sulfate — naica's giants are the must-survive positive control
// (mindat-licensed), elmwood is the PRE-REGISTERED death (S0 casualty; boss
// ruling: "selenite disappearing is good, i havent seen any selenite from
// elmwood"); (b) which tenants are oxidizing (fraction ≈1.0, byte-identical
// candidates) vs boundary-straddling (the interesting rows).
//
// S0 pre-registration (sulfur-speciation-census, 2026-07-22): selenite@elmwood
// = bare-wall sulfate in reducing broth, unrescuable at any honest wCold.
// Mindat cross-mine tally (2026-07-27): selenite elmwood NO / sweetwater NO /
// picher, tsumeb, copper-queen, naica, searles YES.
//
// PASSIVE instrument — prints, never gates, exit 0 always.
//
// Usage: node tools/selenite-tranche-census.mjs

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed, sulfateAvailablePpm } =
  await h.loadSimBundle({ toolName: 'selenite-census', extraExports: ['sulfateAvailablePpm'] });
if (typeof sulfateAvailablePpm !== 'function') {
  console.error('[selenite-census] sulfateAvailablePpm not exported from the bundle — aborting (a raw-S fallback would silently report sulfate fraction 1.00 and fake the whole table).');
  process.exit(0); // passive instrument — never a red gate, but never a lying table either
}

const DIVISORS = [50, 35, 30, 25, 22, 18];
// The 13 seed-42 v236 selenite tenants (baseline census 2026-07-27).
const TENANTS = ['bisbee', 'elmwood', 'great_salt_plains', 'naica_geothermal',
  'radioactive_pegmatite', 'reactive_wall', 'roughten_gill',
  'sabkha_dolomitization', 'schneeberg', 'searles_lake', 'sicily_solfifera',
  'sulphur_bank', 'supergene_oxidation'];

for (const name of TENANTS) {
  if (!SCENARIOS[name]) { console.log(`${name}: scenario missing, skipped`); continue; }
  setSeed(42);
  const scen = SCENARIOS[name]();
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 200;
  const c = sim.conditions;

  const acc = {};
  for (const d of DIVISORS) acc[d] = { liveSteps: 0, peak: 0 };
  let peakRaw = 0, liveRaw = 0, fracSum = 0, fracN = 0;
  let caMin = 1e9, caMax = -1e9, tMin = 1e9, tMax = -1e9;

  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = c.fluid;
    const sigRaw = c.supersaturation_selenite();
    if (sigRaw <= 0) continue;
    const sAvail = sulfateAvailablePpm(f, c.temperature);
    const frac = f.S > 0 ? sAvail / f.S : 0;
    fracSum += frac; fracN++;
    caMin = Math.min(caMin, f.Ca); caMax = Math.max(caMax, f.Ca);
    tMin = Math.min(tMin, c.temperature); tMax = Math.max(tMax, c.temperature);
    const sfOld = f.S / 50.0;              // uncapped — the current engine term
    peakRaw = Math.max(peakRaw, sigRaw);
    if (sigRaw >= 1.0) liveRaw++;
    for (const d of DIVISORS) {
      const sfNew = sAvail / d;            // uncapped on the migrated side too
      const sigNew = sfOld > 0 ? sigRaw * (sfNew / sfOld) : 0;
      acc[d].peak = Math.max(acc[d].peak, sigNew);
      if (sigNew >= 1.0) acc[d].liveSteps++;
    }
  }

  const fracAvg = fracN ? (fracSum / fracN).toFixed(2) : '—';
  const div = DIVISORS.map(d => `÷${d}: ${acc[d].liveSteps} live (peak ${acc[d].peak.toFixed(2)})`).join('  ');
  console.log(`\n${name} (${steps} steps)`);
  console.log(`  raw(÷50 total-S): ${liveRaw} live steps, peak σ ${peakRaw.toFixed(2)}; sulfate fraction avg ${fracAvg}`);
  if (fracN) console.log(`  Ca ${caMin.toFixed(0)}–${caMax.toFixed(0)}, T ${tMin.toFixed(0)}–${tMax.toFixed(0)} °C at σ>0 steps`);
  console.log(`  ${div}`);
}
console.log('\n[selenite-census] passive — exit 0');
