#!/usr/bin/env node
// tools/nucleation-eh-census.mjs — the ALL-SPECIES nucleation-Eh census
// (rung-4d instrument, hostile-review fix ladder). Generalizes
// sulfide-nucleation-eh-census.mjs to every mineral: for each species that
// nucleates at seed 42 across the fleet, record its nucleation-step Eh range
// with scenario@step provenance, then flag the two leak shapes this arc hunts:
//   (a) OXIDIZED-ZONE species nucleating BELOW +100 mV — the cerussite/
//       smithsonite pattern (a supergene mineral minting in a reducing brine:
//       missing gate or too-low floor), and
//   (b) REDUCED/hypogene species nucleating ABOVE +100 mV — the rung-4b
//       ceiling-leak pattern (fresh sulfide minting in the oxidized zone).
// +100 mV = ehFromO2(0.5), the SO₄/HS boundary measured by rungs 4b/4c
// (js/20c PRIMARY_SULFIDE_CEILING_O2 rationale block). An empty (a)+(b) is the
// rung-4 no-offender state; entries here are LEADS, not verdicts — cross-check
// against expects_species and the deposit's real geology before calling one a
// leak (bisbee's Cu-enrichment sulfides at +345..+375 are DEFENDED, not leaks).
//
// Attribution quirk: paramorphs are reported under the FINAL species at the
// ORIGINAL nucleation step's Eh (pararealgar carries its parent realgar's
// birth Eh; argentite→acanthite likewise). Species with zero seed-42
// nucleations are unobserved, not verified-clean.
//
// Usage: node tools/nucleation-eh-census.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed } = await h.loadSimBundle({ toolName: 'all-eh' });

// Oxidized-zone species: geologically REQUIRE oxidizing fluid to nucleate.
const OXIDIZED = new Set([
  'pyromorphite','mimetite','vanadinite','descloizite','mottramite','wulfenite',
  'powellite','ferrimolybdite','raspite','stolzite','clinobisvanite',
  'cerussite','malachite','azurite','smithsonite','rosasite','aurichalcite','hydrozincite',
  'anglesite','linarite','caledonite','leadhillite','brochantite','antlerite',
  'chalcanthite','jarosite','alunite',
  'adamite','olivenite','scorodite','erythrite','annabergite','conichalcite','pharmacolite',
  'willemite','hemimorphite','uranophane','dioptase','shattuckite','chrysoprase','tigers_eye',
  'atacamite','turquoise','plumbogummite',
  'goethite','lepidocrocite','hematite','pyrolusite',
  'torbernite','autunite','zeunerite','uranospinite','carnotite','tyuyamunite',
]);
// Reduced/hypogene species: geologically REQUIRE reducing fluid to nucleate.
// (Secondary Cu-enrichment sulfides bornite/chalcocite/covellite are absent on
// purpose — their moderate-Eh nucleation is the DEFENDED enrichment blanket.)
const REDUCED = new Set([
  'galena','sphalerite','wurtzite','pyrite','marcasite','chalcopyrite','molybdenite',
  'tetrahedrite','tennantite','enargite','proustite','pyrargyrite','stibnite','bismuthinite',
  'arsenopyrite','cobaltite','nickeline','millerite','skutterudite','safflorite',
  'rammelsbergite','loellingite','acanthite','argentite','greenockite','hawleyite',
  'realgar','orpiment','pararealgar','cinnabar','metacinnabar',
  'calaverite','sylvanite','hessite','naumannite','clausthalite',
  'uraninite','coffinite','siderite','chromite','wolframite',
  'native_silver','native_bismuth','native_arsenic','native_copper','native_tellurium','awaruite',
]);

const perSpecies = {}; // species -> {min,max,n, minLoc, maxLoc}
for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  const eh = [];
  for (let i = 0; i < steps; i++) { sim.run_step(); eh.push(sim.conditions.fluid.Eh); }
  for (const c of sim.crystals) {
    const st = Math.min(c.nucleation_step ?? 0, eh.length - 1);
    const E = eh[st];
    const ps = perSpecies[c.mineral] || (perSpecies[c.mineral] = { min: Infinity, max: -Infinity, n: 0, minLoc: '', maxLoc: '' });
    if (E < ps.min) { ps.min = E; ps.minLoc = `${name}@${st}`; }
    if (E > ps.max) { ps.max = E; ps.maxLoc = `${name}@${st}`; }
    ps.n++;
  }
}

let aCount = 0, bCount = 0;
console.log('\n=== (a) OXIDIZED-ZONE species nucleating BELOW +100 mV (cerussite-pattern leak?) ===');
for (const [m, p] of Object.entries(perSpecies).sort((a, b) => a[1].min - b[1].min)) {
  if (OXIDIZED.has(m) && p.min < 100) {
    aCount++;
    console.log(`  ${m.padEnd(16)} minEh ${p.min.toFixed(0).padStart(5)} (${p.minLoc})  maxEh ${p.max.toFixed(0).padStart(5)}  n=${p.n}`);
  }
}
if (!aCount) console.log('  (none)');
console.log('\n=== (b) REDUCED/hypogene species nucleating ABOVE +100 mV (ceiling leak?) ===');
for (const [m, p] of Object.entries(perSpecies).sort((a, b) => b[1].max - a[1].max)) {
  if (REDUCED.has(m) && p.max > 100) {
    bCount++;
    console.log(`  ${m.padEnd(16)} maxEh ${p.max.toFixed(0).padStart(5)} (${p.maxLoc})  minEh ${p.min.toFixed(0).padStart(5)}  n=${p.n}`);
  }
}
if (!bCount) console.log('  (none)');
console.log(`\nflagged: ${aCount} oxidized-below-boundary, ${bCount} reduced-above-boundary`);
console.log('\n=== full census (species, minEh, maxEh, n) ===');
for (const [m, p] of Object.entries(perSpecies).sort())
  console.log(`  ${m.padEnd(20)} ${p.min.toFixed(0).padStart(6)} ${p.max.toFixed(0).padStart(6)}  n=${p.n}  min@${p.minLoc}  max@${p.maxLoc}`);
