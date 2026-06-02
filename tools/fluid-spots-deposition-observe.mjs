#!/usr/bin/env node
/**
 * tools/fluid-spots-deposition-observe.mjs — Phase 2c.2b A/B OBSERVATION (commits
 * nothing). The safety gate for deposition CLUSTERING.
 *
 * 2c.2b clusters nucleation PLACEMENT toward open supply-feeders (geysers 1.8 /
 * hotspots 1.4; cracks 1.0 = none) via a per-cell PROXIMITY-DECAY halo
 * (FluidSpotField.proximityField). The RING is assigned separately → growth
 * chemistry is unchanged, BUT clustering changes spatial competition (enclosure /
 * liberation / overgrowth), which shifts crystal sizes + a few active↔dissolved.
 * Clustering is PER-SCENARIO opt-in; this tool FORCES it on/off fleet-wide via the
 * tri-state master override (setFluidSpotsDepositionEnabled true/false) to A/B
 * EVERY scenario and confirm none loses a headline species before widening opt-in.
 *
 * The discipline (HANDOFF lesson #1): before baking, confirm the bias does NOT
 * WIPE any scenario's headline assemblage. This runs every scenario with
 * deposition OFF vs ON (same seed 42, same cavity → same spots) and reports, per
 * scenario: Δspecies (gained/lost), Δactive-count, and — loudest — any
 * expects_species that ON loses relative to OFF.
 *
 * Usage:
 *   node tools/fluid-spots-deposition-observe.mjs            # all scenarios
 *   node tools/fluid-spots-deposition-observe.mjs porphyry   # one scenario
 */
import { loadSimBundle } from './_harness.mjs';

const bundle = await loadSimBundle({
  toolName: 'fluid-spots-deposition-observe',
  extraExports: ['setFluidSpotsDepositionEnabled'],
});
const { SCENARIOS, VugSimulator, setSeed, setFluidSpotsDepositionEnabled } = bundle;

if (typeof setFluidSpotsDepositionEnabled !== 'function') {
  console.error('setFluidSpotsDepositionEnabled not exported from the bundle — check js/85k + setup exports');
  process.exit(1);
}

const [, , argScen] = process.argv;
const names = argScen ? [argScen] : Object.keys(SCENARIOS).sort();
if (argScen && !SCENARIOS[argScen]) { console.error('no scenario', argScen); process.exit(1); }

function assemblageFor(scen) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[scen]();
  const sim = new VugSimulator(conditions, events);
  const steps = SCENARIOS[scen]().defaultSteps ?? 120;
  for (let s = 0; s < steps; s++) sim.run_step();
  const counts = {};
  for (const c of sim.crystals) {
    const k = c.mineral;
    counts[k] = counts[k] || { active: 0, total: 0, max: 0 };
    counts[k].total++;
    if (c.active) counts[k].active++;
    if (c.total_growth_um > counts[k].max) counts[k].max = c.total_growth_um;
  }
  const spots = (sim._fluidSpots && sim._fluidSpots.openSpots) ? sim._fluidSpots.openSpots() : [];
  const supplyFeeders = spots.filter(s => s.supply > 1);
  return { counts, spots, supplyFeeders };
}

function run(scen) {
  setFluidSpotsDepositionEnabled(false);
  const OFF = assemblageFor(scen);
  setFluidSpotsDepositionEnabled(true);
  const ON = assemblageFor(scen);

  const offSet = new Set(Object.keys(OFF.counts));
  const onSet = new Set(Object.keys(ON.counts));
  const gained = [...onSet].filter(m => !offSet.has(m)).sort();
  const lost = [...offSet].filter(m => !onSet.has(m)).sort();

  const spec = SCENARIOS[scen]._json5_spec || {};
  const expects = Array.isArray(spec.expects_species) ? spec.expects_species : [];
  const expectsLost = expects.filter(m => OFF.counts[m] && !ON.counts[m]);

  // active-count deltas + max-size deltas for shared species
  const activeDelta = [], sizeDelta = [];
  for (const m of onSet) {
    if (!OFF.counts[m]) continue;
    const da = ON.counts[m].active - OFF.counts[m].active;
    if (da !== 0) activeDelta.push(`${m} ${OFF.counts[m].active}→${ON.counts[m].active}`);
    const ds = ON.counts[m].max - OFF.counts[m].max;
    if (Math.abs(ds) > 0.05) sizeDelta.push(`${m} ${Math.round(OFF.counts[m].max)}→${Math.round(ON.counts[m].max)}µm`);
  }
  return { OFF, ON, gained, lost, expects, expectsLost, activeDelta, sizeDelta };
}

let touched = 0, lostAny = 0;
console.log('\n### DEPOSITION-BIAS A/B (OFF vs ON), seed 42 — Δ assemblage per scenario\n');
for (const scen of names) {
  const r = run(scen);
  const feeders = r.ON.supplyFeeders;
  const fTag = feeders.length
    ? feeders.map(s => `${s.kind}(${s.supply})`).join(',')
    : (r.ON.spots.length ? `${r.ON.spots.length} spot(s), no supply-feeder` : 'no spots');
  const changed = r.gained.length || r.lost.length || r.activeDelta.length || r.sizeDelta.length;
  if (changed) touched++;
  if (r.expectsLost.length) lostAny++;
  if (!changed && !feeders.length) continue;   // skip the truly-inert majority for signal
  console.log(`  ${scen}  [${fTag}]`);
  if (r.gained.length) console.log(`      +species: ${r.gained.join(', ')}`);
  if (r.lost.length)   console.log(`      -species: ${r.lost.join(', ')}`);
  if (r.activeDelta.length) console.log(`      active Δ: ${r.activeDelta.join('; ')}`);
  if (r.sizeDelta.length)   console.log(`      size Δ:   ${r.sizeDelta.slice(0, 8).join('; ')}${r.sizeDelta.length > 8 ? ` …(+${r.sizeDelta.length - 8})` : ''}`);
  if (r.expectsLost.length) console.log(`      ⚠ EXPECTS_SPECIES LOST: ${r.expectsLost.join(', ')}`);
  console.log('');
}
console.log(`  summary: ${touched}/${names.length} scenario(s) changed by deposition bias; ` +
  `${lostAny} lost an expects_species ${lostAny ? '⚠' : '✓'}`);
