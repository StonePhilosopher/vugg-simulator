#!/usr/bin/env node
/**
 * tools/high_fill_probe.mjs — characterize crystal growth as vugs approach
 * complete filling. Companion to tools/stale_mineral_probe.mjs.
 *
 * For each scenario, samples per-step:
 *   * vugFill (the simulator's current geometric measure)
 *   * active crystal count
 *   * total growth zones added this step
 *   * mean / max zone thickness this step
 *   * how many distinct minerals grew zones this step
 *
 * Reports per scenario:
 *   * peak vugFill — did this scenario ever approach 1.0?
 *   * step at which vugFill first crossed 0.50, 0.75, 0.90, 0.95, 0.99
 *   * growth-rate trajectory across those bins (mean zone thickness)
 *   * "vug sealed" event occurrence
 *
 * Aggregate report:
 *   * which scenarios actually exercise the high-fill regime
 *   * does growth rate slow as fill rises? (with what curve shape?)
 *   * are habit transitions correlated with fill level?
 *
 * Reads everything from the live bundle. No code changes.
 *
 * Usage: `node tools/high_fill_probe.mjs [seed]`
 *   seed: integer, default 42
 */

import { loadSimBundle } from './_harness.mjs';

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'high_fill_probe' });

// --- Probe ---

const seed = parseInt(process.argv[2] ?? '42', 10);
const scenarioNames = Object.keys(SCENARIOS).sort();

console.log(`[high_fill_probe] SIM_VERSION ${SIM_VERSION}, seed ${seed}\n`);
console.log('Per-scenario trajectory of vugFill, growth activity, and seal-event:\n');

// Format:
// scenario_name    peak_fill   crossed_0.50  0.75  0.90  0.95  0.99   sealed?   nucleation_after_0.95
const ROW_FORMAT = '  %-36s  peak %5s  cross 50/75/90/95/99 = %s   sealed=%s   nuc>.95=%d';

const summary = [];

for (const name of scenarioNames) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 100;

  const trajectory = [];   // [{ step, vugFill, activeCount, zoneThicknesses, nucleations }]
  const sealStep = { step: null };
  const crossings = { 0.50: null, 0.75: null, 0.90: null, 0.95: null, 0.99: null };
  let lastCrystalCount = 0;
  let nucAfter95 = 0;

  for (let i = 0; i < steps; i++) {
    const preCount = sim.crystals.length;
    sim.run_step();
    const f = sim.get_vug_fill();
    const nucs = sim.crystals.length - preCount;
    if (i > 0 && f >= 0.95 && trajectory[trajectory.length - 1].vugFill < 0.95) {
      // First crossing of 0.95 — count nucleations from here onward
    }
    if (f >= 0.95) nucAfter95 += nucs;

    // Cross thresholds
    for (const t of [0.50, 0.75, 0.90, 0.95, 0.99]) {
      if (crossings[t] === null && f >= t) crossings[t] = i;
    }
    if (sealStep.step === null && sim._vug_sealed) sealStep.step = i;

    // Per-step zone thicknesses for active crystals (just the most recent zone)
    const zoneThicknesses = [];
    for (const c of sim.crystals) {
      if (!c.active || !c.zones || !c.zones.length) continue;
      const lastZone = c.zones[c.zones.length - 1];
      if (lastZone && typeof lastZone.thickness_um === 'number' && lastZone.thickness_um > 0) {
        // Only count zones added in the current step. zone.step matches sim.step.
        if (lastZone.step === sim.step) zoneThicknesses.push(lastZone.thickness_um);
      }
    }
    trajectory.push({
      step: i,
      vugFill: f,
      activeCount: sim.crystals.filter(c => c.active).length,
      zoneThicknesses,
      nucleations: nucs,
    });
  }

  const peak = Math.max(...trajectory.map(t => t.vugFill));
  summary.push({ name, peak, crossings, sealStep: sealStep.step, trajectory, nucAfter95 });

  // Print top line
  const c2s = (v) => v === null ? '--' : String(v).padStart(3);
  console.log(
    `  ${name.padEnd(36)} peak ${peak.toFixed(3)}  ` +
    `cross ${c2s(crossings[0.50])}/${c2s(crossings[0.75])}/${c2s(crossings[0.90])}/${c2s(crossings[0.95])}/${c2s(crossings[0.99])}  ` +
    `sealed=${sealStep.step ?? '--'}  nuc>.95=${nucAfter95}`
  );
}

// --- Aggregate analysis: growth rate vs fill ---

console.log(`\n${'='.repeat(98)}\nGrowth-rate trajectory: mean zone thickness (µm) binned by vugFill\n`);
const bins = [
  { name: '0.00–0.10', lo: 0.00, hi: 0.10 },
  { name: '0.10–0.25', lo: 0.10, hi: 0.25 },
  { name: '0.25–0.50', lo: 0.25, hi: 0.50 },
  { name: '0.50–0.75', lo: 0.50, hi: 0.75 },
  { name: '0.75–0.90', lo: 0.75, hi: 0.90 },
  { name: '0.90–0.95', lo: 0.90, hi: 0.95 },
  { name: '0.95–0.99', lo: 0.95, hi: 0.99 },
  { name: '0.99–1.00', lo: 0.99, hi: 1.001 },
];

for (const b of bins) {
  let sumThick = 0, countZones = 0, countSteps = 0, sumActive = 0, sumNucs = 0;
  for (const s of summary) {
    for (const t of s.trajectory) {
      if (t.vugFill >= b.lo && t.vugFill < b.hi) {
        countSteps++;
        sumActive += t.activeCount;
        sumNucs += t.nucleations;
        for (const z of t.zoneThicknesses) {
          sumThick += z;
          countZones++;
        }
      }
    }
  }
  const meanThick = countZones > 0 ? (sumThick / countZones) : 0;
  const meanActive = countSteps > 0 ? (sumActive / countSteps) : 0;
  const meanNucs = countSteps > 0 ? (sumNucs / countSteps) : 0;
  console.log(
    `  ${b.name.padEnd(11)}  ` +
    `n=${String(countSteps).padStart(4)} (seed-step pairs)  ` +
    `mean zone thickness=${meanThick.toFixed(1).padStart(8)} µm  ` +
    `mean active=${meanActive.toFixed(1).padStart(5)}  ` +
    `nuc/step=${meanNucs.toFixed(3).padStart(5)}  ` +
    `zones=${countZones}`
  );
}

console.log(`\n${'='.repeat(98)}`);
console.log('Scenarios that approach complete filling (peak vugFill > 0.90):\n');
const highFill = summary.filter(s => s.peak >= 0.90).sort((a, b) => b.peak - a.peak);
for (const s of highFill) {
  console.log(`  ${s.name.padEnd(36)}  peak=${s.peak.toFixed(3)}  sealed_step=${s.sealStep ?? 'not sealed'}`);
}

console.log(`\nScenarios with low peak vugFill (vugs stayed mostly open — < 0.50):\n`);
const lowFill = summary.filter(s => s.peak < 0.50).sort((a, b) => b.peak - a.peak);
for (const s of lowFill) {
  console.log(`  ${s.name.padEnd(36)}  peak=${s.peak.toFixed(3)}`);
}

console.log('\nDiagnosis notes:');
console.log('  * Steep growth-rate drop in 0.90→0.99 bin → simulator IS slowing growth (geometric clip on c_length / a_width)');
console.log('  * No drop in 0.90→0.99 bin → growth rate is constant up to seal — unrealistic vs DLA / Tsumeb succession');
console.log('  * nuc/step bumps post-0.95 → fill_exempt minerals firing (Backlog K working)');
