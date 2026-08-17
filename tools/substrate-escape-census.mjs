/**
 * Does a species actually NEED the crystal its gate names, or does it merely
 * prefer it?
 *
 * The flow chart drew both as one kind of arrow, which inflates every
 * dependency claim built on top: roots, depth, reach. Static reading of the
 * engines could not tell them apart reliably (a filter bound on one line and
 * tested three lines later defeats a regex), so this measures the finished
 * behaviour instead of parsing the intent.
 *
 * Every scenario is run at the canonical seed and every nucleation's POSITION
 * string is read. `sim.nucleate(mineral, pos, sigma)` records exactly where the
 * crystal was placed, and the engines default that string to the bare wall:
 *
 *     let pos = 'vug wall';
 *     if (existing_hem.length && rng.random() < 0.4) pos = `on hematite #3`;
 *
 * So a species observed on the bare wall has an ESCAPE ROUTE: its substrate
 * arrows are preferences, and it is not truly downstream of anything.
 *
 *   node tools/substrate-escape-census.mjs [--seeds 42,7,99] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'substrate-escape-census' });

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const SEEDS = arg('--seeds', '42').split(',').map(Number);
const OUT = arg('--json', null);

/** A position naming another crystal looks like "on hematite #3" / "with grossular #1". */
const NAMES_CRYSTAL = /#\d+/;

const species = new Map();
const note = (mineral, key) => {
  if (!species.has(mineral)) {
    species.set(mineral, { mineral, total: 0, bare: 0, onCrystal: 0, hosts: {}, scenarios: new Set() });
  }
  return species.get(mineral)[key];
};

const scenarioNames = Object.keys(SCENARIOS).sort();
let ran = 0;
for (const name of scenarioNames) {
  for (const seed of SEEDS) {
    let sim;
    try {
      setSeed(seed);
      const { conditions, events, defaultSteps } = SCENARIOS[name]();
      sim = new VugSimulator(conditions, events);
      for (let i = 0; i < defaultSteps; i++) sim.run_step();
    } catch (error) {
      console.error(`[escape-census] SKIP ${name} seed ${seed}: ${error.message}`);
      continue;
    }
    ran++;
    for (const crystal of sim.crystals) {
      note(crystal.mineral, 'total');
      const rec = species.get(crystal.mineral);
      rec.total++;
      rec.scenarios.add(name);
      const pos = String(crystal.position || '');
      if (NAMES_CRYSTAL.test(pos)) {
        rec.onCrystal++;
        const host = pos.match(/\b([a-z_]+)\s+#\d+/);
        if (host) rec.hosts[host[1]] = (rec.hosts[host[1]] || 0) + 1;
      } else {
        rec.bare++;
      }
    }
  }
  process.stderr.write('.');
}
process.stderr.write('\n');

const rows = [...species.values()].map(r => ({
  mineral: r.mineral,
  observed: r.total,
  bare: r.bare,
  onCrystal: r.onCrystal,
  escapes: r.bare > 0,
  hosts: Object.fromEntries(Object.entries(r.hosts).sort((a, b) => b[1] - a[1])),
  scenarios: [...r.scenarios].sort(),
})).sort((a, b) => b.observed - a.observed);

const escaping = rows.filter(r => r.escapes);
const bound = rows.filter(r => !r.escapes && r.onCrystal > 0);
console.error(`[escape-census] ${ran} runs over ${scenarioNames.length} scenarios, seeds ${SEEDS.join(',')}`);
console.error(`[escape-census] ${rows.length} species observed; `
  + `${escaping.length} nucleate on the bare wall at least once (ESCAPE ROUTE), `
  + `${bound.length} were only ever seen on another crystal`);
console.error('[escape-census] only-ever-on-a-crystal:');
for (const r of bound) {
  console.error(`    ${r.mineral.padEnd(22)} ${String(r.observed).padStart(3)} obs  hosts: ${Object.keys(r.hosts).join(', ')}`);
}

if (OUT) {
  fs.writeFileSync(path.resolve(ROOT, OUT), `${JSON.stringify({
    seeds: SEEDS, runs: ran, scenarios: scenarioNames.length,
    counts: { observed: rows.length, escaping: escaping.length, bound: bound.length },
    species: rows,
  }, null, 2)}\n`);
  console.error(`[escape-census] wrote ${OUT}`);
}
