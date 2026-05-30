// tests-js/strip-helpers.ts — record a scenario through the strip-view
// recorder (helicoid-as-recorder) and read chip chemistry trajectories out
// of the resulting dataset. Lets a scenario "chemistry contract" test assert
// on the spatiotemporal chemistry the strip dataset captures —
// [step][angle][height][depth][chip] — instead of hand-rolling a bespoke
// per-step probe.
//
// WHAT THIS READS. The recorder samples chips through the helicoid chip-read
// path: mesh.cells, and at depth>0 the CavityVoxelGrid interior slices. This
// is the PER-CELL / per-voxel chemistry store — NOT the ring-bulk
// `ring_fluids[equator]` that several older probes (e.g.
// carbonate-week7-reactive-wall) sample. The two stores legitimately differ
// (the bulk view isn't debited by mass balance; the mesh cells are), so a
// strip series corroborates — it does not duplicate — a bulk-probe series.

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const StripRecorder: any;
declare const stripDataIndex: any;
declare const stripDequantize: any;

export interface StripChipSeriesLoc {
  /** sub-strip angular index; omit to average over all angles (skipping nulls). */
  angle?: number;
  /** ring index; omit for the mid ring. */
  height?: number;
  /** 'wall' (depth 0) | 'center' (deepest) | explicit depth index. Default 'wall'. */
  depth?: 'wall' | 'center' | number;
}

/**
 * Run a scenario at a fixed seed with a StripRecorder attached, and return
 * the finalized dataset. Mirrors tests-js/helpers.ts runScenario(), plus the
 * recorder wiring the live sim uses (`sim._stripRecorder` + captureStep hook).
 */
export function recordScenario(
  name: string,
  opts: { seed?: number; steps?: number; angular_indices?: number } = {},
): any {
  if (!SCENARIOS || !SCENARIOS[name]) return null;
  setSeed(opts.seed ?? 42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = opts.steps ?? defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  const recOpts: any = { duration_steps: steps, notes: `strip-helper ${name}` };
  if (opts.angular_indices) recOpts.angular_indices = opts.angular_indices;
  const rec = new StripRecorder(sim, recOpts);
  sim._stripRecorder = rec;
  for (let i = 0; i < steps; i++) sim.run_step();
  return rec.finalize();
}

function chipIndex(ds: any, chipId: string): { idx: number; meta: any } {
  const idx = ds.manifest.chips.findIndex((c: any) => c.id === chipId);
  if (idx < 0) throw new Error(`strip: chip '${chipId}' not in dataset manifest`);
  return { idx, meta: ds.manifest.chips[idx] };
}

function resolveDepth(ds: any, depth: StripChipSeriesLoc['depth']): number {
  const D = (ds.manifest.axes.depth_positions && ds.manifest.axes.depth_positions > 0)
    ? ds.manifest.axes.depth_positions : 1;
  if (depth == null || depth === 'wall') return 0;
  if (depth === 'center') return D - 1;
  return Math.max(0, Math.min(D - 1, depth | 0));
}

/**
 * Extract a chip's value trajectory over steps at a location, dequantized to
 * the chip's native units. Returns (number | null)[] — null where the byte
 * was the reserved missing-data value. With no `angle`, averages over angles
 * (skipping nulls); with no `height`, uses the mid ring; with no `depth`,
 * uses the wall (depth 0).
 */
export function chipSeries(ds: any, chipId: string, loc: StripChipSeriesLoc = {}): Array<number | null> {
  const { idx, meta } = chipIndex(ds, chipId);
  const axes = ds.manifest.axes;
  const C = ds.manifest.chips.length;
  const depth = resolveDepth(ds, loc.depth);
  const height = (loc.height == null) ? (axes.height_positions >> 1) : (loc.height | 0);
  const out: Array<number | null> = [];
  for (let step = 0; step < axes.steps; step++) {
    if (loc.angle == null) {
      let sum = 0, n = 0;
      for (let a = 0; a < axes.angular_indices; a++) {
        const li = stripDataIndex(step, a, height, idx, axes, C, depth);
        if (li < 0) continue;
        const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
        if (v != null) { sum += v; n++; }
      }
      out.push(n ? sum / n : null);
    } else {
      const a = loc.angle | 0;
      const li = stripDataIndex(step, a, height, idx, axes, C, depth);
      out.push(li < 0 ? null : stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]));
    }
  }
  return out;
}

// --- reducers over a (number|null)[] series ---------------------------------

const defined = (s: Array<number | null>): number[] => s.filter((v): v is number => v != null);

export const series = {
  peak: (s: Array<number | null>): number => Math.max(...defined(s)),
  min: (s: Array<number | null>): number => Math.min(...defined(s)),
  last: (s: Array<number | null>): number | null => {
    for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return s[i];
    return null;
  },
  first: (s: Array<number | null>): number | null => {
    for (let i = 0; i < s.length; i++) if (s[i] != null) return s[i];
    return null;
  },
  /** count up-crossings: value transitions from < thr to >= thr. */
  crossings: (s: Array<number | null>, thr: number): number => {
    let n = 0; let prev: number | null = null;
    for (const v of s) {
      if (v == null) continue;
      if (prev != null && prev < thr && v >= thr) n++;
      prev = v;
    }
    return n;
  },
  /** first step index where the predicate holds (ignoring nulls), or -1. */
  firstStepWhere: (s: Array<number | null>, pred: (v: number) => boolean): number => {
    for (let i = 0; i < s.length; i++) { const v = s[i]; if (v != null && pred(v)) return i; }
    return -1;
  },
};
