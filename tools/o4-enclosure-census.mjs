// tools/o4-enclosure-census.mjs — W-F O4a instrument. Engulfment (the Sweetwater
// _check_enclosure mechanic) is fully shipped sim-side but was invisible in 3D;
// O4a renders the guest inside its host. Before eye-checking the render, this
// probe answers "which scenarios actually PRODUCE enclosures at seed 42, and how
// many host/guest pairs?" — so the preview eye-check points at a real one instead
// of guessing. Pure read of enclosed_by / enclosed_crystals; zero sim mutation.
//
// Usage: node tools/o4-enclosure-census.mjs [--seed N] [--steps N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const stepsArg = process.argv.indexOf('--steps');
const STEPS_OVERRIDE = stepsArg >= 0 ? parseInt(process.argv[stepsArg + 1], 10) : null;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({ toolName: 'o4-enclosure-census' });
const { SCENARIOS, VugSimulator, setSeed } = bundle;

const rows = [];
for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = STEPS_OVERRIDE ?? scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  let hosts = 0, guests = 0;
  const pairs = [];
  for (const c of sim.crystals) {
    if (!c) continue;
    if (c.enclosed_crystals && c.enclosed_crystals.length) {
      hosts++;
      for (const gid of c.enclosed_crystals) {
        const g = sim.crystals.find((x) => x && x.crystal_id === gid);
        pairs.push({
          host: c.mineral, hostId: c.crystal_id, hostMm: c.c_length_mm,
          guest: g ? g.mineral : '?', guestId: gid,
          guestMm: g ? g.c_length_mm : 0,
          hostDissolved: !!c.dissolved,
        });
      }
    }
    if (c.enclosed_by != null) guests++;
  }
  if (hosts || guests) {
    rows.push({ name, hosts, guests, pairs, total: sim.crystals.length });
  }
}

rows.sort((a, b) => b.guests - a.guests);
console.log(`\nO4 ENCLOSURE CENSUS — seed ${SEED}`);
console.log('='.repeat(64));
if (!rows.length) {
  console.log('No enclosures in any scenario at this seed.');
} else {
  console.log('scenario                        hosts  guests  crystals');
  console.log('-'.repeat(64));
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(30)}  ${String(r.hosts).padStart(4)}   ${String(r.guests).padStart(5)}   ${String(r.total).padStart(6)}`,
    );
  }
  const best = rows[0];
  console.log('\nRICHEST for preview eye-check: ' + best.name +
    `  (${best.guests} guest(s) inside ${best.hosts} host(s))`);
  if (VERBOSE) {
    for (const r of rows) {
      console.log(`\n[${r.name}]`);
      for (const p of r.pairs) {
        console.log(
          `  ${p.guest} #${p.guestId} (${p.guestMm.toFixed(2)}mm) inside ` +
          `${p.host} #${p.hostId} (${p.hostMm.toFixed(1)}mm)` +
          (p.hostDissolved ? '  [host dissolved]' : ''),
        );
      }
    }
  } else {
    console.log('\nfirst pairs in richest scenario:');
    for (const p of best.pairs.slice(0, 8)) {
      console.log(
        `  ${p.guest} #${p.guestId} (${p.guestMm.toFixed(2)}mm) inside ` +
        `${p.host} #${p.hostId} (${p.hostMm.toFixed(1)}mm)`,
      );
    }
  }
}
console.log('');
