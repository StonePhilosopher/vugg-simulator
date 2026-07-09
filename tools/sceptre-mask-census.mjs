// tools/sceptre-mask-census.mjs — W-F O5 masking-sceptre PRE-REGISTRATION census.
//
// The masking sceptre generalizes classifyQuartzSceptre (js/45): today the
// classifier triggers on a RESORPTION boundary (a run of NEGATIVE zones —
// grimsel's SEAL); the generalization ALSO accepts a `masked_horizon` zone
// (O5b's positive-growth phantom) as the boundary. Before that code lands, the
// two-commit discipline needs the pre-registration answer:
//
//   Does any EXISTING quartz crystal carry a `masked_horizon` today?
//     • NO  → the classifier generalization is BYTE-IDENTICAL for the fleet
//             (only the new ametrine content can move a baseline). Clean.
//     • YES → those quartz become masking sceptres the moment the classifier
//             reads the boundary → their scenarios move → pre-register them
//             here and confine the baseline diff to exactly this list.
//
// It also reports, per masked quartz, whether it WOULD qualify (stem ≥200µm AND
// cap ≥200µm around the horizon — the same QZ_SCEPTRE_*_MIN gates), and the
// current corrosion-sceptre fleet (habit 'scepter_overgrowth') so the masking
// route can be told apart from what grimsel already earns.
//
// Pure read: runs each scenario to completion and inspects the final crystals.
// No RNG, no mutation — byte-identical to a plain run (it only observes).
//
// Usage: node tools/sceptre-mask-census.mjs [--seed N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const STEM_MIN = 200;   // µm — mirror QZ_SCEPTRE_STEM_MIN (js/45)
const CAP_MIN = 200;    // µm — mirror QZ_SCEPTRE_CAP_MIN

const bundle = await loadSimBundle({ toolName: 'sceptre-mask-census' });
const { SCENARIOS, VugSimulator, setSeed } = bundle;

// Given a crystal's zones and the index of the FIRST masked_horizon zone,
// compute stem (positive growth before) + cap (positive growth from the horizon
// onward, inclusive — the breakthrough zone is the base of the cap). Mirrors the
// classifier's own stem/cap accounting so the census verdict matches the code.
function stemCapAroundHorizon(zones, hIdx) {
  let stem = 0;
  for (let k = 0; k < hIdx; k++) { const t = zones[k].thickness_um || 0; if (t > 0) stem += t; }
  let cap = 0;
  for (let k = hIdx; k < zones.length; k++) { const t = zones[k].thickness_um || 0; if (t > 0) cap += t; }
  return { stem, cap };
}

const maskedByMineral = {};        // mineral -> count of crystals with a masked_horizon
const quartzMasked = [];           // per-quartz masked rows (the load-bearing list)
const corrosionSceptres = [];      // existing 'scepter_overgrowth' quartz
let fleetMasked = 0;

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  for (const c of sim.crystals) {
    if (!c || !Array.isArray(c.zones)) continue;
    const hIdx = c.zones.findIndex((z) => z && z.masked_horizon && (z.thickness_um || 0) > 0);
    if (hIdx >= 0) {
      fleetMasked++;
      maskedByMineral[c.mineral] = (maskedByMineral[c.mineral] || 0) + 1;
      if (c.mineral === 'quartz') {
        const { stem, cap } = stemCapAroundHorizon(c.zones, hIdx);
        const qualifies = stem >= STEM_MIN && cap >= CAP_MIN;
        quartzMasked.push({
          scenario: name, id: c.crystal_id,
          film: c.zones[hIdx].film_mineral || '?',
          stem: Math.round(stem), cap: Math.round(cap), qualifies,
          alreadySceptre: c.habit === 'scepter_overgrowth',
          zones: c.zones.length,
        });
      }
    }
    if (c.mineral === 'quartz' && c.habit === 'scepter_overgrowth') {
      corrosionSceptres.push({ scenario: name, id: c.crystal_id,
        capFrac: c._sceptre ? +(c._sceptre.capFrac || 0).toFixed(2) : null });
    }
  }
}

console.log(`\nMASKING-SCEPTRE CENSUS — seed ${SEED} (pre-registration for the classifier generalization)`);
console.log('='.repeat(82));

console.log('\nmasked_horizon carriers by mineral (O5b + elmwood snowball record):');
const mm = Object.entries(maskedByMineral).sort((a, b) => b[1] - a[1]);
if (!mm.length) console.log('  (none — no scenario records a masked_horizon at this seed)');
for (const [m, n] of mm) console.log(`  ${m.padEnd(18)} ${String(n).padStart(3)}`);
console.log(`  ${'TOTAL'.padEnd(18)} ${String(fleetMasked).padStart(3)}`);

console.log('\nQUARTZ with a masked_horizon (the classifier generalization\'s blast radius):');
console.log('-'.repeat(82));
if (!quartzMasked.length) {
  console.log('  NONE. → The classifier generalization is BYTE-IDENTICAL for the fleet;');
  console.log('  only the new ametrine content can move a baseline. (Clean staging.)');
} else {
  console.log('  scenario                    id   film         stem_um  cap_um  qualifies  was');
  for (const q of quartzMasked) {
    console.log(
      `  ${q.scenario.padEnd(26)} ${String(q.id).padStart(3)}  ${String(q.film).padEnd(11)}` +
      `  ${String(q.stem).padStart(6)}  ${String(q.cap).padStart(6)}  ${(q.qualifies ? 'YES' : 'no').padStart(9)}` +
      `  ${q.alreadySceptre ? 'sceptre' : '—'}`,
    );
  }
  const movers = [...new Set(quartzMasked.filter((q) => q.qualifies && !q.alreadySceptre).map((q) => q.scenario))];
  console.log('-'.repeat(82));
  console.log(`  PRE-REGISTERED MOVERS (newly qualify as masking sceptre): ${movers.length ? movers.join(', ') : 'none'}`);
}

console.log('\nExisting corrosion sceptres (grimsel route — the clean reference, untouched):');
if (!corrosionSceptres.length) console.log('  (none at this seed)');
for (const s of corrosionSceptres) console.log(`  ${s.scenario.padEnd(26)} #${s.id}  capFrac ${s.capFrac}`);

console.log('\nVERDICT: if the QUARTZ-masked list is empty, the classifier change ships byte-');
console.log('identical and the ametrine scenario is the sole, pre-registered mover.\n');
