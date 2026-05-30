// tools/dolomite_cap_probe.mjs — verify the dolomite max_nucleation_count
// bypass reported in HANDOFF-CARBONATE-PHASE-1-COMPLETE.md.
//
// Per handoff: ultramafic_supergene shows ~27 active dolomites despite a
// spec cap of 4. Probe runs the scenario at seed 42 and dumps:
//   * total dolomite count, active, dissolved, enclosed
//   * per-step nucleation timeline (which step each dolomite spawned at)
//   * the (mineral, paramorph_origin) for each, so we can tell if the
//     paramorph branch is double-counting
//   * the air_mode_default flag for the scenario's wall (if a per-vertex
//     or air-mode path is the bypass, this is the diagnostic)
//
// Also probes sabkha_dolomitization + zoned_dripstone_cave + jeffrey_mine
// for cross-reference (other dolomite-firing scenarios).
//
// Usage: node tools/dolomite_cap_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'dolomite_cap_probe',
});

const TARGETS = [
  'ultramafic_supergene',
  'sabkha_dolomitization',
  'jeffrey_mine',
  'zoned_dripstone_cave',
];

function summarize(scenarioName) {
  const scn = SCENARIOS && SCENARIOS[scenarioName];
  if (!scn) {
    console.log(`(scenario ${scenarioName} not found)`);
    return;
  }
  setSeed(42);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 100;
  for (let i = 0; i < total; i++) sim.run_step();

  const dolomites = sim.crystals.filter(
    c => c.mineral === 'dolomite' || c.paramorph_origin === 'dolomite',
  );
  const active = dolomites.filter(c => c.enclosed_by == null && !c.dissolved);
  const dissolved = dolomites.filter(c => c.dissolved);
  const enclosed = dolomites.filter(c => c.enclosed_by != null && !c.dissolved);
  const activeFlag = dolomites.filter(c => c.active);
  const airMode = !!(conditions.wall && conditions.wall.air_mode_default);
  const perVertex = !!(conditions.wall && conditions.wall.per_vertex_nucleation);

  console.log(`\n=== ${scenarioName} ===`);
  console.log(`  wall.air_mode_default     = ${airMode}`);
  console.log(`  wall.per_vertex_nucleation = ${perVertex}`);
  console.log(`  steps                     = ${total}`);
  console.log(`  total dolomites           = ${dolomites.length}`);
  console.log(`  active (!enc && !dis)     = ${active.length}   <-- _atNucleationCap counts these`);
  console.log(`  .active === true          = ${activeFlag.length}`);
  console.log(`  dissolved                 = ${dissolved.length}`);
  console.log(`  enclosed                  = ${enclosed.length}`);

  if (dolomites.length > 0) {
    console.log(`  nucleation timeline (step, id, active, encl, diss, paramorph_origin):`);
    for (const c of dolomites.slice(0, 30)) {
      console.log(
        `    step=${String(c.nucleation_step).padStart(3)}  ` +
        `id=${String(c.crystal_id).padStart(3)}  ` +
        `act=${c.active ? 'T' : 'F'}  ` +
        `enc=${c.enclosed_by ?? '-'}  ` +
        `dis=${c.dissolved ? 'T' : 'F'}  ` +
        `paramorph_origin=${c.paramorph_origin ?? '-'}`,
      );
    }
    if (dolomites.length > 30) {
      console.log(`    ... ${dolomites.length - 30} more`);
    }
  }
}

for (const name of TARGETS) summarize(name);

// Follow-up: identify the enclosing host in ultramafic_supergene
console.log(`\n=== ultramafic_supergene: enclosing host identity ===`);
setSeed(42);
{
  const scn = SCENARIOS['ultramafic_supergene'];
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();

  const allDol = sim.crystals.filter(c => c.mineral === 'dolomite');
  const hostIdSet = new Set(allDol.map(c => c.enclosed_by).filter(x => x != null));
  console.log(`  unique host IDs enclosing dolomites: ${[...hostIdSet].join(', ')}`);
  for (const hid of hostIdSet) {
    const host = sim.crystals.find(c => c.crystal_id === hid);
    if (host) {
      console.log(`    crystal #${hid} = ${host.mineral}, active=${host.active}, ` +
                  `nucleation_step=${host.nucleation_step}, ` +
                  `zones=${(host.zones?.length ?? 0)}, ` +
                  `size_um=${(host.zones ?? []).reduce((s, z) => s + (z.thickness_um || 0), 0).toFixed(0)}`);
    }
  }

  // Mineral-by-mineral summary so we can see what won the chemistry budget
  const tally = {};
  for (const c of sim.crystals) {
    const k = c.mineral;
    if (!tally[k]) tally[k] = { total: 0, active: 0, enclosed: 0, dissolved: 0 };
    tally[k].total++;
    if (c.dissolved) tally[k].dissolved++;
    else if (c.enclosed_by != null) tally[k].enclosed++;
    else tally[k].active++;
  }
  console.log(`\n  mineral roster:`);
  for (const [m, t] of Object.entries(tally).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`    ${m.padEnd(22)} total=${String(t.total).padStart(3)}  active=${String(t.active).padStart(3)}  enclosed=${String(t.enclosed).padStart(3)}  dissolved=${String(t.dissolved).padStart(3)}`);
  }

  // Fluid budget end-of-run (bulk-view as a quick proxy)
  console.log(`\n  end-of-run fluid (ring-0):`);
  const f = sim.ring_fluids[0];
  for (const k of ['Ca', 'Mg', 'CO3', 'HCO3', 'SO4', 'pH']) {
    if (k in f) console.log(`    ${k.padEnd(6)} = ${f[k].toFixed(2)}`);
  }
}
