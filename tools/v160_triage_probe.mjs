// tools/v160_triage_probe.mjs — gather the numbers needed to judge the
// v160 (diffusion + strangulation-gate) assertion drifts:
//   A. carbonate-week7: reactive_wall equator pwp_net trajectory around
//      the step-90 fracture seal (confirm the recovery blip location
//      under asymmetric stepping).
//   B. sunnyside: rhodochrosite last-zone color note + local Ca/Mn.
//   C. strangulation scenarios: do the strangled minerals (galena,
//      anglesite, duftite, plumbogummite, pyrolusite) still FORM, or are
//      they eliminated? (defensible = reduced/delayed, not zeroed.)
//
// Usage: node tools/v160_triage_probe.mjs

import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed, pwpNetRate } = await loadSimBundle({
  toolName: 'v160_triage_probe',
  extraExports: ['pwpNetRate'],
});

// ---- A. reactive_wall pwp_net around the seal ----
console.log('\n===== A. reactive_wall pwp_net @ equator (seed 42, asymmetric) =====');
setSeed(42);
{
  const { conditions, events, defaultSteps } = SCENARIOS['reactive_wall']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  const probes = [];
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const eq = Math.floor(sim.ring_fluids.length / 2);
    const f = sim.ring_fluids[eq];
    const T = sim.ring_temperatures ? sim.ring_temperatures[eq] : sim.conditions.temperature;
    probes.push({ step: sim.step, net: pwpNetRate('calcite', f, T), pH: f.pH });
  }
  const ge = (n) => probes.filter(p => p.step >= n);
  for (const cut of [85, 88, 90, 95]) {
    const pos = ge(cut).filter(p => p.net > 0).length;
    console.log(`  window step>=${cut}: ${pos} positive samples`);
  }
  console.log('  steps 86-100:');
  for (const p of probes) if (p.step >= 86 && p.step <= 100) {
    console.log(`    step=${p.step} net=${p.net.toExponential(2)} pH=${p.pH.toFixed(2)}`);
  }
}

// ---- B. sunnyside rhodochrosite ----
console.log('\n===== B. sunnyside rhodochrosite last-zone note (seed 42) =====');
setSeed(42);
{
  const { conditions, events, defaultSteps } = SCENARIOS['sunnyside_american_tunnel']();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
  const rhodos = sim.crystals.filter(c => c.mineral === 'rhodochrosite' && c.active);
  console.log(`  active rhodochrosite: ${rhodos.length}`);
  for (const r of rhodos.slice(0, 4)) {
    const lz = (r.zones && r.zones.length) ? r.zones[r.zones.length - 1] : null;
    console.log(`    #${r.crystal_id} zones=${r.zones?.length ?? 0} lastNote="${lz ? lz.note : '(none)'}"`);
  }
}

// ---- C. strangulation scenarios: do strangled minerals still form? ----
console.log('\n===== C. strangled-mineral final rosters (seed 42) =====');
const STR = {
  naica_geothermal: ['pyrolusite'],
  radioactive_pegmatite: ['galena', 'plumbogummite'],
  schneeberg: ['anglesite', 'plumbogummite', 'duftite', 'galena'],
  supergene_oxidation: ['duftite'],
};
for (const [name, minerals] of Object.entries(STR)) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
  const parts = minerals.map(m => {
    const all = sim.crystals.filter(c => c.mineral === m);
    const exposed = all.filter(c => c.enclosed_by == null && !c.dissolved);
    return `${m}: total=${all.length} exposed=${exposed.length}`;
  });
  console.log(`  ${name.padEnd(24)} ${parts.join('  |  ')}`);
}
