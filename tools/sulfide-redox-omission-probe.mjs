#!/usr/bin/env node
/**
 * tools/sulfide-redox-omission-probe.mjs — dark-observe whether adding the
 * missing sulfideRedoxAnoxic gate to sphalerite + wurtzite would BITE
 * anywhere (a real bug + rebake) or be INERT (a safe correctness fix).
 *
 * The redox-gate census (tools/redox-gate-census.mjs) flagged sphalerite and
 * wurtzite as the two HIGH structural omissions: ZnS sulfides with no redox
 * gate, where galena's was added at v13 ("a clear physics bug"). Before
 * editing the engine we measure: across the whole fleet at seed 42, does
 * sphalerite/wurtzite ever reach σ>0 in OXIDIZING fluid (O2 > the 1.5 anoxic
 * upper bound galena/pyrite use)? Each such cell-step is where the proposed
 * gate would change behavior.
 *
 * Wraps the prototype σ methods (no engine edit), runs every scenario, and
 * reports per scenario: fires, max O2 among fires, and how many fires sit
 * above O2=1.5 (would be blocked). All-zero "above" column → inert fix.
 */

import { loadSimBundle } from './_harness.mjs';

const THRESH = 1.5;  // galena/pyrite sulfideRedoxAnoxic upper bound

const { SCENARIOS, VugSimulator, setSeed, VugConditions } =
  await loadSimBundle({ toolName: 'sulfide-redox-omission-probe', extraExports: ['VugConditions'] });

const stats = {};  // scenario -> { sphalerite:{fires,maxO2,above,maxEh}, wurtzite:{...} }
let CUR = null;

function wrap(name) {
  const proto = VugConditions.prototype;
  const orig = proto[name];
  proto[name] = function () {
    const sigma = orig.apply(this, arguments);
    if (sigma > 0 && CUR) {
      const o2 = typeof this.fluid.O2 === 'number' ? this.fluid.O2 : 0;
      const eh = typeof this.fluid.Eh === 'number' ? this.fluid.Eh : 200;
      const s = stats[CUR][name];
      s.fires++;
      if (o2 > s.maxO2) s.maxO2 = o2;
      if (eh > s.maxEh) s.maxEh = eh;
      if (o2 > THRESH) s.above++;
    }
    return sigma;
  };
}
wrap('supersaturation_sphalerite');
wrap('supersaturation_wurtzite');

const names = Object.keys(SCENARIOS).sort();
for (const name of names) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  stats[name] = {
    supersaturation_sphalerite: { fires: 0, maxO2: -1, maxEh: -1, above: 0 },
    supersaturation_wurtzite: { fires: 0, maxO2: -1, maxEh: -1, above: 0 },
  };
  CUR = name;
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();
}
CUR = null;

const pad = (s, n) => String(s).padEnd(n);
let totAbove = 0, scenAbove = 0;
console.log(`\nsulfide-redox-omission dark-observe (gate would block σ>0 at O2 > ${THRESH})\n`);
console.log(`  ${pad('scenario', 28)} ${pad('sphal fires/maxO2/>1.5', 26)} wurtz fires/maxO2/>1.5`);
for (const name of names) {
  const sp = stats[name].supersaturation_sphalerite;
  const wz = stats[name].supersaturation_wurtzite;
  if (sp.fires === 0 && wz.fires === 0) continue;
  const fmt = (s) => s.fires ? `${s.fires}/${s.maxO2.toFixed(2)}/${s.above}` : '—';
  const hot = (sp.above + wz.above) > 0 ? '  ⚠' : '';
  totAbove += sp.above + wz.above;
  if (sp.above + wz.above > 0) scenAbove++;
  console.log(`  ${pad(name, 28)} ${pad(fmt(sp), 26)} ${fmt(wz)}${hot}`);
}
console.log(`\n  ${totAbove} total σ>0 cell-steps above O2=${THRESH}, in ${scenAbove} scenario(s).`);
console.log(totAbove === 0
  ? '  → INERT: the gate blocks nothing currently produced. Safe correctness fix.'
  : '  → BITES: review each ⚠ scenario — sphalerite/wurtzite in oxidizing fluid is the bug the gate fixes.');
