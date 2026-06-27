#!/usr/bin/env node
/**
 * tools/occlusion-coverage.mjs — Phase 2 substrate-occlusion FLEET CENSUS.
 *
 * Forces wall.occlusion ON for every scenario (seed 42) and reports, per
 * scenario, what the real classifier (js/45 classifyOcclusion, INCLUDING the
 * habit guard + air-mode skip) WOULD tag (root in matrix) vs. SKIP. This is:
 *   1. the evidence for a fleet-wide-default decision (how much of the fleet
 *      gains the singly-terminated drusy read, and at what cost);
 *   2. a guard sanity check — a clearly-discrete crystal wrongly skipped, or a
 *      clearly-aggregate one wrongly rooted, shows up in the per-scenario lines.
 *
 * It reads the classifier's actual decisions (eligible-but-untagged ⇒ guard-
 * skipped, since occlusion is forced on and occlusion_minerals is null), so it
 * never duplicates the OCCLUSION_SKIP_HABIT regex — it reports what SHIPS.
 *
 * Render-only census: forcing the flag on a throwaway sim never touches the
 * baseline (counts/sizes), and nothing is written. Usage:
 *   node tools/occlusion-coverage.mjs [--seed 42] [--scenario <name>]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'occlusion-coverage' });

const args = process.argv.slice(2);
const seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const only = args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : null;

const names = Object.keys(SCENARIOS).filter((n) => !only || n === only).sort();
let fleetTagged = 0, fleetEligible = 0;
const zeroScenarios = [];
const alreadyOptedIn = ['mvt', 'elmwood', 'gem_pegmatite'];   // wall.occlusion already true in scenarios.json5

for (const name of names) {
  setSeed(seed);
  let built;
  try { built = SCENARIOS[name](); } catch (e) { console.log(`${name.padEnd(30)} ERROR building: ${e.message}`); continue; }
  const { conditions, events, defaultSteps } = built;
  const sim = new VugSimulator(conditions, events);
  if (sim.conditions && sim.conditions.wall) sim.conditions.wall.occlusion = true;   // force ON for the census
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();

  // Eligible = a discrete-sized, non-air, live crystal — the population occlusion CAN root.
  const eligible = sim.crystals.filter((c) => c && !c.dissolved && (c.total_growth_um || 0) >= 50 && c.growth_environment !== 'air');
  const tagged = eligible.filter((c) => c._occlusion);
  const skipped = eligible.filter((c) => !c._occlusion);   // eligible but untagged ⇒ habit-guard skipped it
  fleetTagged += tagged.length; fleetEligible += eligible.length;
  if (eligible.length > 0 && tagged.length === 0) zeroScenarios.push(name);

  const tagMin = {}; for (const c of tagged) tagMin[c.mineral] = (tagMin[c.mineral] || 0) + 1;
  const skMin = {}; for (const c of skipped) { const k = `${c.mineral}(${c.habit})`; skMin[k] = (skMin[k] || 0) + 1; }
  const tagStr = Object.entries(tagMin).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}×${n}`).join(' ') || '—';
  const skStr = Object.entries(skMin).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}×${n}`).join(' ') || '—';
  const flag = alreadyOptedIn.includes(name) ? ' ✓shipped' : '';
  console.log(`${name.padEnd(30)} root ${String(tagged.length).padStart(3)}/${String(eligible.length).padStart(3)}${flag}   ${tagStr}`);
  if (skipped.length) console.log(`${' '.repeat(30)}   guard-skip: ${skStr}`);
}

console.log(`\nFLEET (seed ${seed}): ${fleetTagged}/${fleetEligible} eligible crystals would root across ${names.length} scenarios.`);
if (zeroScenarios.length) console.log(`Roots NOTHING (every eligible crystal guard-skipped — all-aggregate assemblage): ${zeroScenarios.join(', ')}`);
console.log('Review the guard-skip lines: a clearly-discrete crystal (prism/cube/scalenohedron) there = a guard false-positive to fix.');
