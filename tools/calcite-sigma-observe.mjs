#!/usr/bin/env node
/**
 * tools/calcite-sigma-observe.mjs — CALCITE MORPHOLOGY calibration, step 0
 * (commits nothing, touches no engine code).
 *
 * The research (proposals/RESEARCH-calcite-morphology-2026-06-11.md) gives
 * the ORDERING of calcite forms with supersaturation — spiral-smooth →
 * macrostepped → dendrite → hopper — but its σ thresholds are in REDUCED
 * units (σ = ln(IAP/Ksp), crossover ~0.8). The sim's supersaturation_calcite()
 * returns a different, ratio-like number (<1 dissolves, >1 grows, rate ∝ σ−1).
 * The two are monotonic but NOT equal, so the regime cutoffs must be set from
 * the sim's OWN σ distribution, measured here — never transcribed from a paper.
 *
 * This tool runs every scenario, and on every step where calcite is actively
 * growing it records the bulk supersaturation_calcite(). Output: per-scenario
 * and fleet σ distribution during calcite growth (min / quartiles / max +
 * a coarse histogram), plus how MUCH the σ moves step-to-step (the bunching
 * signal — a flat σ trace = smooth spar; a fluctuating one = step bunching).
 *
 * Usage:  node tools/calcite-sigma-observe.mjs [--seed 42] [--scen a,b,c]
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'calcite-sigma-observe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const ONLY = args.includes('--scen') ? args[args.indexOf('--scen') + 1].split(',') : null;
const scenNames = (ONLY || Object.keys(SCENARIOS)).filter((s) => SCENARIOS[s]);

const quant = (arr, q) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))));
  return a[i];
};
const mean = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN;

// growth σ during ACTIVE calcite growth, per scenario
const perScen = {};
const fleetSigma = [];
const fleetJumps = [];

for (const scen of scenNames) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try {
    ({ conditions, events, defaultSteps } = SCENARIOS[scen]());
  } catch (e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  const sig = [];
  let prevSig = null;
  let everCalcite = false;
  for (let s = 0; s < steps; s++) {
    sim.run_step();
    const activeCalcite = sim.crystals.some((c) => c.mineral === 'calcite' && c.active && !c.dissolved);
    if (!activeCalcite) { prevSig = null; continue; }
    everCalcite = true;
    let sigma;
    try { sigma = sim.conditions.supersaturation_calcite(); } catch (e) { continue; }
    if (typeof sigma !== 'number' || !isFinite(sigma) || sigma < 1.0) { prevSig = sigma; continue; }
    sig.push(sigma);
    fleetSigma.push(sigma);
    if (prevSig !== null && prevSig >= 1.0) {
      const jump = Math.abs(sigma - prevSig);
      fleetJumps.push(jump);
    }
    prevSig = sigma;
  }
  if (everCalcite && sig.length) {
    perScen[scen] = {
      n: sig.length,
      min: Math.min(...sig), max: Math.max(...sig),
      mean: mean(sig), q25: quant(sig, 0.25), q50: quant(sig, 0.5), q75: quant(sig, 0.75), q95: quant(sig, 0.95),
      crystals: sim.crystals.filter((c) => c.mineral === 'calcite').length,
    };
  }
}

console.log(`\n### CALCITE σ DISTRIBUTION during active growth (seed ${SEED}, sim units; >1 = growth)`);
console.log('  scenario                     n   cryst   min    q25    q50    q75    q95    max');
console.log('  --------------------------------------------------------------------------------------');
for (const scen of Object.keys(perScen).sort((a, b) => perScen[b].q50 - perScen[a].q50)) {
  const p = perScen[scen];
  const f = (x) => x.toFixed(2).padStart(6);
  console.log(`  ${scen.padEnd(28)} ${String(p.n).padStart(4)} ${String(p.crystals).padStart(4)}   ${f(p.min)} ${f(p.q25)} ${f(p.q50)} ${f(p.q75)} ${f(p.q95)} ${f(p.max)}`);
}

console.log(`\n### FLEET σ distribution during calcite growth (n=${fleetSigma.length})`);
if (fleetSigma.length) {
  const f = (x) => x.toFixed(2);
  console.log(`  min ${f(Math.min(...fleetSigma))}  q25 ${f(quant(fleetSigma, 0.25))}  q50 ${f(quant(fleetSigma, 0.5))}  q75 ${f(quant(fleetSigma, 0.75))}  q90 ${f(quant(fleetSigma, 0.90))}  q95 ${f(quant(fleetSigma, 0.95))}  q99 ${f(quant(fleetSigma, 0.99))}  max ${f(Math.max(...fleetSigma))}`);
  // coarse histogram on a log-ish set of edges
  const edges = [1.0, 1.1, 1.25, 1.5, 2.0, 3.0, 5.0, 10.0, 25.0, 100.0, Infinity];
  const bins = new Array(edges.length - 1).fill(0);
  for (const v of fleetSigma) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && v < edges[i + 1]) { bins[i]++; break; }
    }
  }
  console.log('\n  σ band            count   bar');
  for (let i = 0; i < bins.length; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const label = `${lo.toFixed(2)}–${hi === Infinity ? '∞' : hi.toFixed(2)}`;
    const pct = bins[i] / fleetSigma.length;
    console.log(`  ${label.padEnd(16)} ${String(bins[i]).padStart(6)}   ${'█'.repeat(Math.round(pct * 50))}`);
  }
}

console.log(`\n### Step-to-step σ JUMP (the bunching signal; consecutive growth steps, n=${fleetJumps.length})`);
if (fleetJumps.length) {
  const f = (x) => x.toFixed(3);
  console.log(`  median |Δσ| ${f(quant(fleetJumps, 0.5))}   q75 ${f(quant(fleetJumps, 0.75))}   q90 ${f(quant(fleetJumps, 0.90))}   max ${f(Math.max(...fleetJumps))}`);
  console.log('  (large jumps = fluctuating σ history = step-bunching regime; flat = smooth spar)');
}
console.log('');
