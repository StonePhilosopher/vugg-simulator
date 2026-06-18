#!/usr/bin/env node
/**
 * tools/nuc-seed-isolation-probe.mjs — THE KEYSTONE A/B observation (commits
 * nothing). The safety gate for per-(mineral,step) derived nucleation seeds.
 *
 * PROPOSAL-PER-MINERAL-NUC-SEEDS.md. With NUC_DERIVED_SEEDS ON, each mineral
 * nucleates from its OWN derived stream, so gating/adding one mineral can't
 * displace another's cascade. This DELIBERATELY rebakes every baseline — there
 * is no byte-identical path — so validation is by ASSEMBLAGE PLAUSIBILITY, not
 * byte-identity (exactly how the v181 thermal-reconciliation was validated).
 *
 * The discipline (T-reconciliation lesson): before baking, confirm the
 * re-realization does NOT WIPE any scenario's headline assemblage. This runs
 * every scenario across N seeds with the keystone OFF (legacy single shared
 * stream) vs ON, and reports per scenario:
 *   - CONCERNING losses: a mineral present in ≥25% of OFF seeds but 0 ON seeds
 *     (a real disappearance, not marginal sampling noise on a rare phase).
 *   - expects_species frequency OFF% → ON% (loud if OFF>0 and ON==0).
 * Plus a tracked-frequency table (mottramite @ supergene_oxidation) so the
 * pre-gate baseline is captured for the later ZnS-gate verification.
 *
 * Usage:
 *   node tools/nuc-seed-isolation-probe.mjs            # all scenarios, N=24
 *   node tools/nuc-seed-isolation-probe.mjs 40         # all scenarios, N=40
 *   node tools/nuc-seed-isolation-probe.mjs 40 supergene_oxidation   # one scenario
 */
import { loadSimBundle } from './_harness.mjs';

const bundle = await loadSimBundle({
  toolName: 'nuc-seed-isolation-probe',
  extraExports: ['_setNucDerivedSeeds'],
});
const { SCENARIOS, VugSimulator, setSeed, _setNucDerivedSeeds } = bundle;

if (typeof _setNucDerivedSeeds !== 'function') {
  console.error('_setNucDerivedSeeds not exported from the bundle — check js/85j exports');
  process.exit(1);
}

const args = process.argv.slice(2);
const N = parseInt(args.find(a => /^\d+$/.test(a)) || '24', 10);
const argScen = args.find(a => !/^\d+$/.test(a));
const names = argScen ? [argScen] : Object.keys(SCENARIOS).sort();
if (argScen && !SCENARIOS[argScen]) { console.error('no scenario', argScen); process.exit(1); }

// Sweep one scenario across N seeds; return { mineral -> seeds-present count }.
function sweep(scen) {
  const seen = {};
  for (let s = 1; s <= N; s++) {
    setSeed(s);
    const spec = SCENARIOS[scen]();
    const sim = new VugSimulator(spec.conditions, spec.events);
    const steps = spec.defaultSteps ?? 200;
    for (let i = 0; i < steps; i++) sim.run_step();
    const present = new Set();
    for (const c of sim.crystals) {
      if (c.total_growth_um > 0) present.add(c.mineral);
    }
    for (const m of present) seen[m] = (seen[m] || 0) + 1;
  }
  return seen;
}

function run(scen) {
  _setNucDerivedSeeds(false);
  const OFF = sweep(scen);
  _setNucDerivedSeeds(true);
  const ON = sweep(scen);

  const offSet = new Set(Object.keys(OFF));
  const onSet = new Set(Object.keys(ON));
  const gained = [...onSet].filter(m => !offSet.has(m)).sort();
  const lost = [...offSet].filter(m => !onSet.has(m)).sort();
  // CONCERNING = a robustly-present OFF species (≥25% of seeds) gone entirely in ON.
  const thresh = Math.ceil(N * 0.25);
  const concerning = lost.filter(m => (OFF[m] || 0) >= thresh).sort();

  const spec = SCENARIOS[scen]._json5_spec || {};
  const expects = Array.isArray(spec.expects_species) ? spec.expects_species : [];
  const expectsLost = expects.filter(m => (OFF[m] || 0) > 0 && !(ON[m] > 0));

  return { OFF, ON, gained, lost, concerning, expects, expectsLost };
}

const TRACK = { supergene_oxidation: ['mottramite', 'descloizite', 'sphalerite', 'wurtzite'] };

let concerningAny = 0, expectsLostAny = 0;
console.log(`\n### KEYSTONE A/B (NUC_DERIVED_SEEDS OFF vs ON), N=${N} seeds — per-scenario roster check\n`);
for (const scen of names) {
  const r = run(scen);
  if (r.concerning.length) concerningAny++;
  if (r.expectsLost.length) expectsLostAny++;

  // expects_species frequency line (always shown — it's the headline criterion).
  const exTags = r.expects.map(m => {
    const off = Math.round(100 * (r.OFF[m] || 0) / N);
    const on = Math.round(100 * (r.ON[m] || 0) / N);
    const flag = (off > 0 && on === 0) ? ' ⚠' : '';
    return `${m} ${off}%→${on}%${flag}`;
  });

  const noisy = r.gained.length || r.lost.length || r.expectsLost.length || TRACK[scen];
  if (!noisy) continue;
  console.log(`  ${scen}`);
  if (r.expects.length) console.log(`      expects: ${exTags.join(' | ')}`);
  if (r.concerning.length) console.log(`      ⚠ CONCERNING loss (≥25% OFF → 0 ON): ${r.concerning.join(', ')}`);
  const marginalLost = r.lost.filter(m => !r.concerning.includes(m));
  if (marginalLost.length) console.log(`      marginal -roster (rare phases): ${marginalLost.join(', ')}`);
  if (r.gained.length) console.log(`      +roster: ${r.gained.join(', ')}`);
  if (TRACK[scen]) {
    const tline = TRACK[scen].map(m => `${m} ${Math.round(100 * (r.OFF[m] || 0) / N)}%→${Math.round(100 * (r.ON[m] || 0) / N)}%`);
    console.log(`      tracked: ${tline.join(' | ')}`);
  }
  console.log('');
}
console.log(`  SUMMARY: ${concerningAny}/${names.length} scenario(s) with a CONCERNING loss; ` +
  `${expectsLostAny} lost an expects_species ${expectsLostAny ? '⚠ — INVESTIGATE before baking' : '✓ — roster holds, safe to bake'}`);
console.log(`  (marginal roster churn on rare phases is EXPECTED — the keystone re-realizes the RNG.)`);
