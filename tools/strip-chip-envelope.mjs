#!/usr/bin/env node
/**
 * tools/strip-chip-envelope.mjs — measure the RAW (unclamped) value envelope
 * each strip chip actually reaches across every scenario, and flag which chips
 * clamp against their current quantization range.
 *
 * "Follow the science of what vugs actually do": the strip's per-chip
 * quantization ranges (js/99j _HELIX_CHEM_PARAMS) should cover the real span a
 * vug fluid occupies. Ranges sized for one scenario (MVT-seed-42) clamp on
 * others (the high-Ca/Mg zoned_dripstone_cave brine). This tool reads the chip
 * read functions DIRECTLY (no quantization) so it sees the true values, then
 * reports observed [min,max] vs the declared range — CLAMP where observed
 * exceeds the range.
 *
 * Usage: node tools/strip-chip-envelope.mjs
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, _HELIX_CHEM_PARAMS } =
  await loadSimBundle({
    toolName: 'strip-chip-envelope',
    extraExports: ['_HELIX_CHEM_PARAMS'],
  });

const params = _HELIX_CHEM_PARAMS || [];
if (!params.length) {
  console.error('no _HELIX_CHEM_PARAMS captured — build first?');
  process.exit(1);
}

// observed[id] = { min, max, declMin, declMax, where }
const observed = {};
for (const p of params) {
  observed[p.id] = { min: Infinity, max: -Infinity, declMin: Number(p.min), declMax: Number(p.max), where: '' };
}

const names = Object.keys(SCENARIOS).sort();
for (const name of names) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  const wall = () => sim.wall_state || sim.conditions?.wall;
  for (let s = 0; s < steps; s++) {
    sim.run_step();
    const w = wall();
    const rc = Math.max(1, Number(w?.ring_count) || 16);
    for (let h = 0; h < rc; h++) {
      for (const p of params) {
        if (typeof p.read !== 'function') continue;
        let v;
        try { v = p.read(sim, w, h, 0); } catch { v = null; }
        if (v == null || typeof v !== 'number' || !isFinite(v)) continue;
        const o = observed[p.id];
        if (v < o.min) o.min = v;
        if (v > o.max) { o.max = v; o.where = `${name}@ring${h}`; }
      }
    }
  }
}

// Report — clampers first.
const rows = params.map((p) => {
  const o = observed[p.id];
  const clampHi = isFinite(o.max) && o.max > o.declMax + 1e-9;
  const clampLo = isFinite(o.min) && o.min < o.declMin - 1e-9;
  return { id: p.id, ...o, clampHi, clampLo, clamp: clampHi || clampLo };
});
rows.sort((a, b) => (b.clamp - a.clamp) || (b.max - a.max));

console.log('\nchip          observed[min, max]            range[min,max]      clamp?  (worst at)');
console.log('-----------------------------------------------------------------------------------------');
for (const r of rows) {
  if (!isFinite(r.min)) { console.log(`${r.id.padEnd(12)}  (never read)`); continue; }
  const obs = `[${r.min.toFixed(2)}, ${r.max.toFixed(2)}]`.padEnd(28);
  const rng = `[${r.declMin}, ${r.declMax}]`.padEnd(18);
  const flag = r.clampHi ? 'CLAMP-HI' : (r.clampLo ? 'CLAMP-LO' : '   ok   ');
  console.log(`${r.id.padEnd(12)}  ${obs}${rng}  ${flag}  ${r.clamp ? r.where : ''}`);
}
const clampers = rows.filter((r) => r.clamp).map((r) => r.id);
console.log(`\n${clampers.length} chip(s) clamp: ${clampers.join(', ') || '(none)'}`);
