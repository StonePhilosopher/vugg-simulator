// tools/v160_gate_ab_probe.mjs — is the strangulation gate ELIMINATING
// real paragenesis members, or were they already gone under diffusion
// alone? Compares gate-ON vs gate-OFF (monkeypatch _wallStrangledFor to
// always-false) mineral rosters for the strangulation scenarios. Also
// dumps the sunnyside rhodochrosite enclosure/dissolution breakdown +
// what enclosed it (a diffusion effect — sunnyside doesn't strangle).
//
// Usage: node tools/v160_gate_ab_probe.mjs

import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'v160_gate_ab_probe',
});

const proto = VugSimulator.prototype;
const realGate = proto._wallStrangledFor;

function roster(name, minerals) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
  const out = {};
  for (const m of minerals) {
    const all = sim.crystals.filter(c => c.mineral === m);
    out[m] = {
      total: all.length,
      exposed: all.filter(c => c.enclosed_by == null && !c.dissolved).length,
      enclosed: all.filter(c => c.enclosed_by != null && !c.dissolved).length,
      dissolved: all.filter(c => c.dissolved).length,
    };
  }
  return out;
}

const STR = {
  naica_geothermal: ['pyrolusite'],
  radioactive_pegmatite: ['galena', 'plumbogummite'],
  schneeberg: ['anglesite', 'plumbogummite', 'duftite', 'galena'],
  supergene_oxidation: ['duftite'],
};

console.log('===== Gate ON vs OFF: strangled-mineral rosters (seed 42) =====');
for (const [name, minerals] of Object.entries(STR)) {
  proto._wallStrangledFor = realGate;     // ON
  const on = roster(name, minerals);
  proto._wallStrangledFor = function () { return false; };  // OFF
  const off = roster(name, minerals);
  console.log(`\n  ${name}:`);
  for (const m of minerals) {
    const o = on[m], f = off[m];
    console.log(`    ${m.padEnd(14)} OFF total=${f.total} (exp${f.exposed}/enc${f.enclosed}/dis${f.dissolved})  ->  ON total=${o.total} (exp${o.exposed}/enc${o.enclosed}/dis${o.dissolved})`);
  }
}
proto._wallStrangledFor = realGate;

// ---- sunnyside rhodochrosite: who enclosed it? (diffusion effect) ----
console.log('\n===== sunnyside rhodochrosite fate (seed 42, gate ON) =====');
setSeed(42);
{
  const { conditions, events, defaultSteps } = SCENARIOS['sunnyside_american_tunnel']();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
  const rh = sim.crystals.filter(c => c.mineral === 'rhodochrosite');
  console.log(`  rhodochrosite total=${rh.length}`);
  for (const r of rh) {
    const sz = (r.zones ?? []).reduce((s, z) => s + (z.thickness_um || 0), 0);
    let encMin = '-';
    if (r.enclosed_by != null) {
      const host = sim.crystals.find(c => c.crystal_id === r.enclosed_by);
      encMin = host ? `${host.mineral}#${r.enclosed_by}` : `#${r.enclosed_by}`;
    }
    console.log(`    #${r.crystal_id} nuc@${r.nucleation_step} size=${sz.toFixed(0)}um active=${r.active} enc_by=${encMin} diss=${r.dissolved}`);
  }
  // also compare gate OFF
  proto._wallStrangledFor = function () { return false; };
  setSeed(42);
  const { conditions: c2, events: e2, defaultSteps: d2 } = SCENARIOS['sunnyside_american_tunnel']();
  const sim2 = new VugSimulator(c2, e2);
  for (let i = 0; i < (d2 ?? 200); i++) sim2.run_step();
  const rh2 = sim2.crystals.filter(c => c.mineral === 'rhodochrosite');
  const exp2 = rh2.filter(c => c.enclosed_by == null && !c.dissolved).length;
  console.log(`  [gate OFF] rhodochrosite total=${rh2.length} exposed=${exp2}`);
  proto._wallStrangledFor = realGate;
}
