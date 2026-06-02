#!/usr/bin/env node
/**
 * tools/broth-stability-probe.mjs — does the BROTH actually change over the
 * life of a vug, or is it ~flat between instantaneous events?
 *
 * The boss's question (2026-06-01): strip mode suggests most broth elements
 * are stable across a vug's lifetime; real crystals (Fe zoning he owns) show
 * elements pulse + wane. Is the current sim too static? This probe quantifies
 * it: run each scenario headless, record the BULK fluid (conditions.fluid.*)
 * + temperature each step, and report per-field temporal movement:
 *     CV   = std/|mean|           (coefficient of variation)
 *     span = (max-min)/(|mean|+ε)  (normalized peak-to-peak)
 * Flat   = CV < 0.05 (basically a constant line on the strip).
 * Tags redox/solubility-volatile species (Fe, Mn, Cu, S, O2, U, As, V, Pb).
 *
 * Usage: node tools/broth-stability-probe.mjs [scenario ...]
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'broth-stability-probe' });

// Redox- / solubility-volatile species — the ones the science says SHOULD
// pulse (Eh/pH-sensitive). If the sim is honest, these move the most.
const VOLATILE = new Set(['Fe', 'Mn', 'Cu', 'S', 'O2', 'U', 'As', 'V', 'Pb', 'Zn', 'Mo']);
const FLAT_CV = 0.05;

const pick = process.argv.slice(2);
const names = (pick.length ? pick : [
  'cooling', 'porphyry', 'bisbee', 'supergene_oxidation', 'sabkha_dolomitization', 'mvt',
]).filter((n) => SCENARIOS[n]);

if (!names.length) { console.error('no matching scenarios; available:', Object.keys(SCENARIOS).sort().join(', ')); process.exit(1); }

const stats = (arr) => {
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const varr = arr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n;
  const std = Math.sqrt(varr);
  let min = Infinity, max = -Infinity;
  for (const x of arr) { if (x < min) min = x; if (x > max) max = x; }
  const cv = Math.abs(mean) > 1e-9 ? std / Math.abs(mean) : 0;
  const span = (max - min) / (Math.abs(mean) + 1e-9);
  return { mean, std, min, max, cv, span };
};

const perScenarioFlatFrac = [];
for (const name of names) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  // Track every numeric bulk-fluid field + temperature over the run.
  const series = {};
  const rec = () => {
    const f = sim.conditions.fluid;
    for (const k of Object.keys(f)) {
      const v = f[k];
      if (typeof v === 'number' && isFinite(v)) (series[k] ??= []).push(v);
    }
    (series['temperature'] ??= []).push(sim.conditions.temperature);
  };
  rec();                          // initial state
  for (let s = 0; s < steps; s++) { sim.run_step(); rec(); }

  const rows = Object.keys(series).map((k) => ({ k, ...stats(series[k]) }))
    .filter((r) => isFinite(r.cv));
  rows.sort((a, b) => b.cv - a.cv);

  const tracked = rows.filter((r) => Math.abs(r.mean) > 1e-9 || r.max > 0);  // ignore always-zero fields
  const flat = tracked.filter((r) => r.cv < FLAT_CV);
  const flatFrac = tracked.length ? flat.length / tracked.length : 0;
  perScenarioFlatFrac.push({ name, flatFrac, tracked: tracked.length, flat: flat.length });

  console.log(`\n=== ${name}  (${steps} steps, ${tracked.length} non-zero fields, ${flat.length} flat [CV<${FLAT_CV}]) ===`);
  console.log('field         mean          CV      span(pk-pk/mean)  vol?  verdict');
  console.log('---------------------------------------------------------------------------');
  for (const r of tracked) {
    const vol = VOLATILE.has(r.k) ? ' ⚡' : '   ';
    const verdict = r.cv < FLAT_CV ? 'FLAT' : (r.cv < 0.25 ? 'drifts' : 'DYNAMIC');
    console.log(
      `${r.k.padEnd(12)} ${r.mean.toExponential(2).padStart(10)}  ${r.cv.toFixed(3).padStart(7)}  ${r.span.toFixed(2).padStart(14)}  ${vol}  ${verdict}`,
    );
  }
}

console.log('\n================ SUMMARY ================');
for (const s of perScenarioFlatFrac) {
  console.log(`${s.name.padEnd(24)} ${(s.flatFrac * 100).toFixed(0).padStart(3)}% of tracked fields are FLAT  (${s.flat}/${s.tracked})`);
}
const avg = perScenarioFlatFrac.reduce((a, s) => a + s.flatFrac, 0) / perScenarioFlatFrac.length;
console.log(`\nMean across scenarios: ${(avg * 100).toFixed(0)}% of broth fields are essentially flat (CV<${FLAT_CV}) over the vug's life.`);
