#!/usr/bin/env node
/**
 * tools/strip-probe.mjs — record a scenario headlessly and print a chip's
 * chemistry trajectory from the strip-view recorder (helicoid-as-recorder).
 *
 * This is the scriptable version of inspecting the strip view in the UI: it
 * attaches a StripRecorder to a fresh sim, runs the scenario, and prints the
 * per-step trajectory of one chip at a chosen radial depth (wall → center) as
 * a sparkline + summary stats.
 *
 * IMPORTANT — WHAT THIS READS. The strip recorder samples chips through the
 * helicoid chip-read path, which reads mesh.cells (and, at depth>0, the
 * CavityVoxelGrid interior slices). This is the PER-CELL / per-voxel chemistry
 * store — NOT the ring-bulk `ring_fluids[equator]` that several bespoke
 * scenario probes (e.g. carbonate-week7-reactive-wall) sample. The two stores
 * can legitimately differ (the bulk view isn't debited by mass balance; the
 * mesh cells are). So read this tool's output as "what the per-cell recording
 * shows," and corroborate against the bulk probes rather than assuming they
 * match.
 *
 * Usage:
 *   node tools/strip-probe.mjs <scenario> [options]
 *
 *   --chip <id>        chip id (default: SI_calcite). Repeatable.
 *   --depth <sel>      wall | center | <int>   (default: wall)
 *   --height <sel>     mid | <int ring index>  (default: mid)
 *   --angle <sel>      avg | <int sub-strip>    (default: avg over angles)
 *   --seed <int>       (default: 42)
 *   --steps <int>      (default: scenario defaultSteps)
 *   --list-chips       print the recorded chip ids + ranges and exit
 *   --list-scenarios   print scenario names and exit
 *
 * Examples:
 *   node tools/strip-probe.mjs reactive_wall --chip SI_calcite --depth center
 *   node tools/strip-probe.mjs sabkha_dolomitization --chip f_ord --chip SI_dolomite
 *   node tools/strip-probe.mjs reactive_wall --chip SI_calcite --depth wall --depth center
 */

import { loadSimBundle } from './_harness.mjs';

// ---- arg parsing -----------------------------------------------------------

const argv = process.argv.slice(2);
const positionals = [];
const chips = [];
const depths = [];
const opts = { seed: 42, height: 'mid', angle: 'avg' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--chip') chips.push(argv[++i]);
  else if (a === '--depth') depths.push(argv[++i]);
  else if (a === '--height') opts.height = argv[++i];
  else if (a === '--angle') opts.angle = argv[++i];
  else if (a === '--seed') opts.seed = parseInt(argv[++i], 10);
  else if (a === '--steps') opts.steps = parseInt(argv[++i], 10);
  else if (a === '--list-chips') opts.listChips = true;
  else if (a === '--list-scenarios') opts.listScenarios = true;
  else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(1); }
  else positionals.push(a);
}
if (!chips.length) chips.push('SI_calcite');
if (!depths.length) depths.push('wall');

const { SCENARIOS, VugSimulator, setSeed, StripRecorder, stripDataIndex, stripDequantize } =
  await loadSimBundle({
    toolName: 'strip-probe',
    extraExports: ['StripRecorder', 'stripDataIndex', 'stripDequantize'],
  });

if (opts.listScenarios) {
  for (const n of Object.keys(SCENARIOS).sort()) console.log(n);
  process.exit(0);
}

const scenario = positionals[0];
if (!scenario || !SCENARIOS[scenario]) {
  console.error(`strip-probe: unknown scenario '${scenario || ''}'. Use --list-scenarios.`);
  process.exit(1);
}

// ---- record the scenario headlessly ---------------------------------------

setSeed(opts.seed);
const { conditions, events, defaultSteps } = SCENARIOS[scenario]();
const steps = opts.steps ?? defaultSteps ?? 100;
const sim = new VugSimulator(conditions, events);
const rec = new StripRecorder(sim, { duration_steps: steps, notes: `strip-probe ${scenario}` });
sim._stripRecorder = rec;
for (let i = 0; i < steps; i++) sim.run_step();
const ds = rec.finalize();

const axes = ds.manifest.axes;
const D = (axes.depth_positions && axes.depth_positions > 0) ? axes.depth_positions : 1;
const C = ds.manifest.chips.length;

if (opts.listChips) {
  console.log(`chips recorded for ${scenario} (${C}):`);
  for (const c of ds.manifest.chips) {
    console.log(`  ${c.id.padEnd(14)} ${(c.label || '').padEnd(14)} [${c.range[0]}, ${c.range[1]}] ${c.units || ''} (${c.system})`);
  }
  process.exit(0);
}

// ---- helpers ---------------------------------------------------------------

const DEPTH_LABELS = ['wall', 'near-wall', 'interior', 'center'];
function resolveDepth(sel) {
  if (sel === 'wall') return 0;
  if (sel === 'center') return D - 1;
  const d = parseInt(sel, 10);
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.min(D - 1, d));
}
function depthLabel(d) {
  if (D === 4) return DEPTH_LABELS[d] || `d${d}`;
  if (d === 0) return 'wall';
  if (d === D - 1) return 'center';
  return `d${d}`;
}
function resolveHeight() {
  if (opts.height === 'mid') return axes.height_positions >> 1;
  const h = parseInt(opts.height, 10);
  return Math.max(0, Math.min(axes.height_positions - 1, Number.isFinite(h) ? h : 0));
}

function chipMeta(chipId) {
  const idx = ds.manifest.chips.findIndex(c => c.id === chipId);
  return idx < 0 ? null : { idx, meta: ds.manifest.chips[idx] };
}

// trajectory over steps at (height, depth), averaged over angles (skipping
// nulls) unless a specific angle is requested.
function chipSeries(chipId, depth, height) {
  const cm = chipMeta(chipId);
  if (!cm) return null;
  const { idx, meta } = cm;
  const out = [];
  for (let step = 0; step < axes.steps; step++) {
    if (opts.angle === 'avg') {
      let sum = 0, n = 0;
      for (let a = 0; a < axes.angular_indices; a++) {
        const li = stripDataIndex(step, a, height, idx, axes, C, depth);
        if (li < 0) continue;
        const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
        if (v != null) { sum += v; n++; }
      }
      out.push(n ? sum / n : null);
    } else {
      const a = Math.max(0, Math.min(axes.angular_indices - 1, parseInt(opts.angle, 10) || 0));
      const li = stripDataIndex(step, a, height, idx, axes, C, depth);
      out.push(li < 0 ? null : stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]));
    }
  }
  return out;
}

const SPARK = '▁▂▃▄▅▆▇█';
function sparkline(series) {
  const vals = series.filter(v => v != null);
  if (!vals.length) return '(all null)';
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  return series.map(v => {
    if (v == null) return ' ';
    const t = (v - lo) / span;
    return SPARK[Math.max(0, Math.min(SPARK.length - 1, Math.round(t * (SPARK.length - 1))))];
  }).join('');
}

function stats(series) {
  const vals = series.filter(v => v != null);
  if (!vals.length) return { n: 0 };
  const min = Math.min(...vals), max = Math.max(...vals);
  const first = series.find(v => v != null);
  let last = null; for (let i = series.length - 1; i >= 0; i--) if (series[i] != null) { last = series[i]; break; }
  return { n: vals.length, min, max, first, last };
}

// ---- report ----------------------------------------------------------------

const height = resolveHeight();
console.log(`\n=== strip-probe: ${scenario} (seed ${opts.seed}, ${ds.manifest.duration_steps} steps, sim v${ds.manifest.sim_version}) ===`);
console.log(`axes: ${axes.angular_indices} angles × ${axes.height_positions} rings × ${D} depth × ${C} chips`);
console.log(`reading: per-cell/voxel store (mesh.cells; depth>0 = CavityVoxelGrid interior) — NOT ring_fluids bulk`);
console.log(`sampling: height ring ${height} (${opts.height}), angle ${opts.angle}\n`);

const fmt = (v) => (v == null ? '  null' : v.toFixed(3).padStart(8));

for (const chipId of chips) {
  const cm = chipMeta(chipId);
  if (!cm) { console.log(`  chip '${chipId}' not recorded — skipping (try --list-chips)\n`); continue; }
  const units = cm.meta.units ? ` ${cm.meta.units}` : '';
  console.log(`${chipId} (${cm.meta.label}${units}, quantization range [${cm.meta.range[0]}, ${cm.meta.range[1]}])`);
  for (const dsel of depths) {
    const d = resolveDepth(dsel);
    const series = chipSeries(chipId, d, height);
    const s = stats(series);
    if (!s.n) { console.log(`  ${depthLabel(d).padEnd(10)} (all null)`); continue; }
    console.log(`  ${depthLabel(d).padEnd(10)} ${sparkline(series)}`);
    console.log(`  ${''.padEnd(10)} first=${fmt(s.first)} last=${fmt(s.last)} min=${fmt(s.min)} max=${fmt(s.max)}`);
  }
  console.log('');
}
