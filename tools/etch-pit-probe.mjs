#!/usr/bin/env node
// tools/etch-pit-probe.mjs — census the ETCH-PIT target population before building the
// render (crystal-face-realism arc §2). The renderer DROPS fully-dissolved crystals from
// the scene (js/99i: `if (crystal.dissolved && !perimorph_eligible) continue`), so the
// only renderable "etched" crystal is a SURVIVOR (dissolved=false) that nonetheless carries
// resorption episodes in its zone history — it grew, a later undersaturated pulse partially
// dissolved/rounded it, and it lived. This sweeps the fleet at seed 42 and reports, per
// scenario, how many surviving crystals carry negative (dissolution) growth zones, how much
// they resorbed, and the dominant dissolution mode — so the classifier's trigger is placed
// on a population that actually exists, not an abstraction. SIM-neutral read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'etch-pit-probe' });
const SEED = 42;

function run(scen) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (e) { return null; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps || 120;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

// Scan one crystal's zone stack: grown µm, resorbed µm, count of dissolution zones, modes.
function resorption(c) {
  let grown = 0, resorbed = 0, nDiss = 0;
  const modes = {};
  for (const z of (c.zones || [])) {
    const t = z.thickness_um || 0;
    if (t > 0) grown += t;
    else if (t < 0) {
      resorbed += -t; nDiss++;
      const m = z.dissolutionMode || 'unknown';
      modes[m] = (modes[m] || 0) + 1;
    }
  }
  return { grown, resorbed, nDiss, modes, frac: grown > 0 ? resorbed / grown : 0 };
}

console.log('=== etch-pit population census (seed 42) ===');
console.log('survivors = rendered crystals (dissolved=false) carrying resorption zones\n');
let totalSurv = 0, totalGone = 0;
const hits = [];
for (const scen of Object.keys(SCENARIOS)) {
  const s = run(scen);
  if (!s) continue;
  let survEtched = 0, goneEtched = 0;
  const detail = [];
  for (const c of s.crystals) {
    const r = resorption(c);
    if (r.nDiss === 0) continue;          // never resorbed
    if (c.dissolved) { goneEtched++; continue; }   // fully gone — not renderable
    survEtched++;
    detail.push({ m: c.mineral, frac: r.frac, resorbed: r.resorbed, nDiss: r.nDiss,
      net: c.total_growth_um || 0, modes: Object.keys(r.modes).join('+') });
  }
  totalSurv += survEtched; totalGone += goneEtched;
  if (survEtched) {
    hits.push(scen);
    detail.sort((a, b) => b.frac - a.frac);
    console.log(`  ${scen}: ${survEtched} survivor-etched (${goneEtched} fully dissolved/gone)`);
    for (const d of detail.slice(0, 6)) {
      console.log(`      ${d.m.padEnd(14)} resorbed ${d.resorbed.toFixed(0)}µm / net ${d.net.toFixed(0)}µm` +
        ` (frac ${d.frac.toFixed(2)}, ${d.nDiss} diss-zones, ${d.modes})`);
    }
  } else if (goneEtched) {
    console.log(`  ${scen}: 0 survivor-etched (${goneEtched} fully dissolved/gone — not renderable)`);
  }
}
console.log(`\n  TOTAL: ${totalSurv} renderable survivor-etched crystals across ${hits.length} scenarios` +
  ` (${totalGone} fully dissolved/gone fleet-wide)`);
console.log(hits.length ? `  candidate showcase scenarios: ${hits.join(', ')}`
  : '  ⚠ no surviving etched crystals — etch-pit needs a resorption-then-survive driver first');

// --- DECLARED etch-overprint tags (the shipped mechanic) ----------------------------
// classifyEtch tags surviving crystals that grew before a scenario's `etch` directive.
// Report what got tagged so the render target is verified to exist.
console.log('\n=== declared etch-overprint tags (crystal._etch) ===');
let tagTotal = 0;
for (const scen of Object.keys(SCENARIOS)) {
  const s = run(scen);
  if (!s) continue;
  const tagged = s.crystals.filter(c => c._etch && !c.dissolved);
  if (!tagged.length) continue;
  tagTotal += tagged.length;
  const byMin = {};
  for (const c of tagged) byMin[c.mineral] = (byMin[c.mineral] || 0) + 1;
  const amt = tagged.map(c => c._etch.amount);
  const atSteps = [...new Set(tagged.map(c => c._etch.atStep))];
  console.log(`  ${scen}: ${tagged.length} etched (${Object.entries(byMin).map(([m, n]) => `${m}×${n}`).join(', ')})` +
    ` amount ${Math.min(...amt).toFixed(2)}–${Math.max(...amt).toFixed(2)}, atStep ${atSteps.join('/')}` +
    ` | sizes ${tagged.map(c => (c.total_growth_um || 0).toFixed(0)).join(',')}µm` +
    `\n      habits: ${tagged.map(c => `${c.mineral}=${c.habit}`).join(', ')}`);
}
console.log(tagTotal ? `\n✓ ${tagTotal} declared-etch crystals fleet-wide`
  : '\n(no declared-etch tags — no scenario carries an etch directive)');
