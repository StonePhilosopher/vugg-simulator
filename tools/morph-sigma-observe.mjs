#!/usr/bin/env node
/**
 * tools/morph-sigma-observe.mjs — POST-STEP σ survey for ANY mineral
 * (morphology-generalization arc, 2026-06-12 — the generic successor to
 * tools/calcite-sigma-observe.mjs, which calibrated MORPH_TH.calcite).
 *
 * The first step of giving a mineral a morphology-registry entry
 * (MORPH_TH.<mineral> in js/45-morphology.ts) is measuring where its
 * post-step σ actually LIVES across the fleet — band edges are placed in
 * SIM units against this survey + locality ground truth, never
 * transcribed from another mineral or from papers (σ scales are not
 * comparable across supersaturation_* methods; calcite research doc §5).
 *
 * 18th-catch basis rule: σ is sampled AFTER run_step (post-growth,
 * post-mass-balance) — the basis the classifier runs on. Pre-hoist
 * engines (halite/sylvite/bismuth…) made in-step habit flips from the
 * IN-STEP σ; those legacy thresholds are NOT valid on this basis. To
 * make the gap visible, the survey also samples the in-step σ (before
 * the step's growth) and reports both distributions side by side.
 *
 * Usage:
 *   node tools/morph-sigma-observe.mjs --minerals halite,sylvite [--seed 42]
 *   node tools/morph-sigma-observe.mjs --minerals native_bismuth --seed 7
 *
 * Output per (scenario, mineral) with surviving crystals:
 *   - zone-attributed POST-step σ percentiles, thickness-weighted (the
 *     numbers band edges are placed against)
 *   - the same for IN-step σ (legacy-threshold comparison only)
 *   - size-at-zone percentiles (for SIZE_HALF_UM / damping decisions)
 *   - fleet-wide pooled histogram per mineral at the end
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'morph-sigma-observe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const MINERALS = args.includes('--minerals')
  ? args[args.indexOf('--minerals') + 1].split(',').map((s) => s.trim()).filter(Boolean)
  : null;
if (!MINERALS || !MINERALS.length) {
  console.error('usage: node tools/morph-sigma-observe.mjs --minerals a,b,c [--seed 42]');
  process.exit(2);
}

function sigmaOf(conditions, mineral) {
  const fn = conditions['supersaturation_' + mineral];
  if (typeof fn !== 'function') return NaN;
  try { return fn.call(conditions); } catch (_e) { return NaN; }
}

// thickness-weighted percentile over [{v, w}]
function wPct(samples, p) {
  if (!samples.length) return NaN;
  const sorted = [...samples].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of sorted) {
    acc += x.w;
    if (acc >= p * total) return x.v;
  }
  return sorted[sorted.length - 1].v;
}

const fmt = (x) => (isFinite(x) ? (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) : '—');

const pooled = Object.fromEntries(MINERALS.map((m) => [m, []]));
const rows = [];

for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (_e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;

  // per-step σ on BOTH bases: in-step (sampled before run_step grows
  // this step's zones) and post-step (sampled after — the classifier's).
  const preByStep = Object.fromEntries(MINERALS.map((m) => [m, {}]));
  const postByStep = Object.fromEntries(MINERALS.map((m) => [m, {}]));
  for (let s = 0; s < steps; s++) {
    for (const m of MINERALS) preByStep[m][sim.step + 1] = sigmaOf(sim.conditions, m);
    sim.run_step();
    for (const m of MINERALS) postByStep[m][sim.step] = sigmaOf(sim.conditions, m);
  }

  for (const m of MINERALS) {
    const crystals = sim.crystals.filter((c) => c && c.mineral === m && !c.dissolved && c.total_growth_um > 0);
    if (!crystals.length) continue;
    const post = [], pre = [], sizes = [];
    let zones = 0;
    for (const c of crystals) {
      let sizeAcc = 0;
      for (const z of (c.zones || [])) {
        const t = z.thickness_um || 0;
        if (t <= 0) continue;
        zones++;
        const sgPost = postByStep[m][z.step];
        const sgPre = preByStep[m][z.step];
        if (isFinite(sgPost) && sgPost >= 1.0) post.push({ v: sgPost, w: t });
        if (isFinite(sgPre) && sgPre >= 1.0) pre.push({ v: sgPre, w: t });
        sizes.push({ v: sizeAcc, w: t });
        sizeAcc += t;
      }
    }
    pooled[m].push(...post);
    rows.push({
      scen, m, crystals: crystals.length, zones,
      post: { p50: wPct(post, 0.5), p75: wPct(post, 0.75), p90: wPct(post, 0.9), max: post.length ? Math.max(...post.map((x) => x.v)) : NaN },
      pre: { p50: wPct(pre, 0.5), p90: wPct(pre, 0.9), max: pre.length ? Math.max(...pre.map((x) => x.v)) : NaN },
      size: { p50: wPct(sizes, 0.5), max: sizes.length ? Math.max(...sizes.map((x) => x.v)) : NaN },
    });
  }
}

console.log(`\n### POST-STEP σ SURVEY — ${MINERALS.join(', ')} (seed ${SEED})`);
console.log('### post-step = the classifier basis (place band edges HERE); in-step shown only to expose the legacy-threshold gap\n');
console.log('  scenario                    mineral          cryst zones  POSTσ p50/p75/p90/max          INσ p50/p90/max         size-µm p50/max');
console.log('  ' + '-'.repeat(140));
for (const r of rows) {
  console.log(`  ${r.scen.padEnd(27)} ${r.m.padEnd(16)} ${String(r.crystals).padStart(4)} ${String(r.zones).padStart(5)}  ${`${fmt(r.post.p50)} / ${fmt(r.post.p75)} / ${fmt(r.post.p90)} / ${fmt(r.post.max)}`.padEnd(29)} ${`${fmt(r.pre.p50)} / ${fmt(r.pre.p90)} / ${fmt(r.pre.max)}`.padEnd(23)} ${fmt(r.size.p50)} / ${fmt(r.size.max)}`);
}
if (!rows.length) console.log('  (no surviving crystals of the requested minerals anywhere in the fleet)');

for (const m of MINERALS) {
  const all = pooled[m];
  if (!all.length) continue;
  console.log(`\n### ${m} — fleet-pooled post-step σ (thickness-weighted): p10 ${fmt(wPct(all, 0.1))}  p25 ${fmt(wPct(all, 0.25))}  p50 ${fmt(wPct(all, 0.5))}  p75 ${fmt(wPct(all, 0.75))}  p90 ${fmt(wPct(all, 0.9))}  p99 ${fmt(wPct(all, 0.99))}  max ${fmt(Math.max(...all.map((x) => x.v)))}`);
}
console.log();
