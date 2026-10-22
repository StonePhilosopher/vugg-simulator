#!/usr/bin/env node
// tools/sulfide-nucleation-eh-census.mjs — at what Eh does every SULFIDE
// actually nucleate across the fleet (seed 42)? The rung-4b instrument
// (hostile-review fix ladder): a tightened PRIMARY-sulfide stability ceiling
// must stay ABOVE the highest-Eh LEGIT primary sulfide (else it kills an
// expects_species) but BELOW the supergene-zone spurious sulfides (+130..+290,
// the "ceiling leaks"). This finds the window and, crucially, shows the fleet
// splits into two classes: primary base-metal sulfides that top out reducing,
// and the secondary/enrichment Cu-sulfides (chalcocite/covellite/bornite) that
// LEGITIMATELY nucleate at moderate Eh — so the ceiling is PER-CLASS, not one
// knob (see js/20c PRIMARY_SULFIDE_CEILING_O2 + PROPOSAL-RUNG-4-REDOX §6 Lever B).
//
// Usage: node tools/sulfide-nucleation-eh-census.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed } = await h.loadSimBundle({ toolName: 'sulf-eh' });
const SULFIDES = new Set(['galena','sphalerite','wurtzite','pyrite','marcasite','chalcopyrite','bornite','chalcocite','covellite','greenockite','hawleyite','acanthite','argentite','molybdenite','stibnite','bismuthinite','cinnabar','realgar','orpiment','pararealgar','arsenopyrite','tetrahedrite','tennantite','enargite','millerite','nickeline','cobaltite','skutterudite','safflorite','proustite','pyrargyrite','pentlandite','cubanite']);

const perSpecies = {};   // species -> {min,max,n}
const highEh = [];       // sulfide nucleations above +100 mV (the risk zone)
for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  // ehEnd[k] is the fluid at the end of step k + 1; a birth in step n reads
  // the end of its own step, ehEnd[n − 1]. This census used to read ehEnd[n],
  // the end of the NEXT step, which put porphyry's step-84 stibnite (born at
  // +44 mV) at +322 across step 85's oxidation event. See the same fix and its
  // fleet measurement in tools/nucleation-eh-census.mjs (recipe review M12).
  const ehEnd = [];
  for (let i = 0; i < steps; i++) { sim.run_step(); ehEnd.push(sim.conditions.fluid.Eh); }
  for (const c of sim.crystals) {
    if (!SULFIDES.has(c.mineral)) continue;
    const E = ehEnd[Math.max(0, Math.min((c.nucleation_step ?? 1) - 1, ehEnd.length - 1))];
    const ps = perSpecies[c.mineral] || (perSpecies[c.mineral] = { min: Infinity, max: -Infinity, n: 0 });
    ps.min = Math.min(ps.min, E); ps.max = Math.max(ps.max, E); ps.n++;
    if (E > 100) highEh.push({ name, m: c.mineral, step: c.nucleation_step, E });
  }
}
console.log('SULFIDE nucleation Eh range per species (seed 42):');
console.log('  species          |  min   |  max   | n');
console.log('  -----------------|--------|--------|---');
for (const [m, p] of Object.entries(perSpecies).sort((a,b)=>b[1].max-a[1].max))
  console.log(`  ${m.padEnd(16)} | ${p.min.toFixed(0).padStart(6)} | ${p.max.toFixed(0).padStart(6)} | ${p.n}`);
console.log(`\nSulfide nucleations ABOVE +100 mV (the ceiling-leak risk zone — would a ceiling ~+100 kill them?):`);
for (const r of highEh.sort((a,b)=>b.E-a.E)) console.log(`  ${r.name.padEnd(24)} ${r.m.padEnd(14)} step ${String(r.step).padStart(3)}  Eh ${r.E.toFixed(0)}`);
console.log(`\n${highEh.length} sulfide nucleations above +100 mV`);
