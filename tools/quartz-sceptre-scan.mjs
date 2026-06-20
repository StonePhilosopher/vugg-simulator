#!/usr/bin/env node
/**
 * tools/quartz-sceptre-scan.mjs — RESORPTION-AWARE sceptre scan (quartz arc #108).
 *
 * WHY THIS EXISTS (the load-bearing finding of the alpine-cleft arc). The
 * sibling tool, quartz-hiatus-census.mjs, looks for a STEP-GAP: a run of
 * no-growth steps between two positive-growth zones. That is the WRONG
 * instrument for how THIS engine expresses a sceptre. `grow_quartz` does not
 * PAUSE at σ<1 — it DISSOLVES (negative-thickness "dissolutionMode" zones,
 * up to 5 µm/step once a crystal is >10 µm). So a crack-seal SEAL corrodes the
 * gen-1 tip; it does not freeze it. There is no step-gap — every step writes a
 * zone, just negative ones. The census therefore reports 0 hiatuses on a cleft
 * that is, in fact, growing textbook sceptres.
 *
 * The real signature, and the one this scan detects, is RESORPTION → FAST
 * RENEWAL ON THE SAME CRYSTAL: a maximal run of negative-thickness zones
 * (the seal corroding the tip), bracketed by positive growth, where the mean
 * renewal rate AFTER the resorption exceeds the rim rate BEFORE it by ≥ a
 * ratio. That is exactly the alpine sceptre — the gen-1 tip is resorbed, then
 * a wider cap regenerates on it faster than the stem grew (caps grow cooler +
 * faster than stems; mindat / quartzpage.de). Corrosion-then-regeneration IS
 * the natural sceptre trigger (the census's [resorbed] note hinted at it).
 *
 * This scan is the reference implementation of the #109 `morphSceptreScan`
 * classifier, brought forward to verify grimsel_alpine_cleft (#108) before the
 * bake. The render/zone-tag side (#109) reads the same per-crystal episode.
 *
 * Usage:
 *   node tools/quartz-sceptre-scan.mjs [--seed 42] [--ratio 1.3] [--rim 3]
 *                                      [--scenario grimsel_alpine_cleft] [--detail]
 *     --ratio     renewRate / rimRate above which a resorption episode is a sceptre (default 1.3)
 *     --rim       #positive zones averaged on each side of the resorption run (default 3)
 *     --scenario  limit to one scenario (default: whole fleet)
 *     --detail    dump every quartz crystal's full zone trajectory (sign + rate)
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'quartz-sceptre-scan' });

const args = process.argv.slice(2);
const numArg = (flag, def) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : def);
const strArg = (flag, def) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : def);
const SEED = numArg('--seed', 42);
const RATIO = numArg('--ratio', 1.3);
const RIM = numArg('--rim', 3);
const ONLY = strArg('--scenario', null);
const DETAIL = args.includes('--detail');

const fmt = (x) => (isFinite(x) ? (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) : '—');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

// Structural-sceptre thresholds (displayed µm, i.e. timeScale-applied zone
// thickness). A sceptre = a phantom boundary (resorption surface) with a REAL
// gen-1 stem before it AND a REAL gen-N cap after it, on ONE crystal. The cap
// being WIDER is a render/geometry decision (#109), not a linear-rate fact —
// the engine's Arrhenius kinetics make the cooler cap grow at a LOWER linear
// rate even at higher σ, so a rate-ratio test fights the physics. We judge on
// cumulative growth EXTENT (both generations substantial) and report the rate
// ratio (cap PEAK vs stem rim) only as an observation.
const STEM_MIN = numArg('--stem', 200);
const CAP_MIN = numArg('--cap', 200);

/**
 * Find resorption→renewal sceptre episodes on a single crystal. Each maximal
 * run of negative zones is a phantom boundary; the positive growth between the
 * previous boundary (or birth) and this one is the STEM, between this one and
 * the next (or death) is the CAP.
 */
function scanCrystal(c) {
  const zones = (c.zones || []).slice().sort((a, b) => a.step - b.step);
  // index the maximal resorption runs
  const runs = [];
  let i = 0;
  while (i < zones.length) {
    if ((zones[i].thickness_um || 0) < 0) {
      const start = i; let depth = 0;
      while (i < zones.length && (zones[i].thickness_um || 0) < 0) { depth += Math.abs(zones[i].thickness_um || 0); i++; }
      runs.push({ startIdx: start, endIdx: i - 1, depth });
    } else i++;
  }
  const episodes = [];
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    const prevEnd = r > 0 ? runs[r - 1].endIdx + 1 : 0;
    const nextStart = r < runs.length - 1 ? runs[r + 1].startIdx : zones.length;
    const stemZones = zones.slice(prevEnd, run.startIdx).filter((z) => (z.thickness_um || 0) > 0);
    const capZones = zones.slice(run.endIdx + 1, nextStart).filter((z) => (z.thickness_um || 0) > 0);
    const stemGrowth = stemZones.reduce((s, z) => s + z.thickness_um, 0);
    const capGrowth = capZones.reduce((s, z) => s + z.thickness_um, 0);
    const rimRate = mean(stemZones.slice(-RIM).map((z) => z.growth_rate || z.thickness_um || 0));
    const capPeak = capZones.length ? Math.max(...capZones.map((z) => z.growth_rate || z.thickness_um || 0)) : 0;
    const rateRatio = rimRate > 0 ? capPeak / rimRate : NaN;
    const extentRatio = stemGrowth > 0 ? capGrowth / stemGrowth : NaN;
    const isSceptre = stemGrowth >= STEM_MIN && capGrowth >= CAP_MIN;
    episodes.push({
      startStep: zones[run.startIdx].step, endStep: zones[run.endIdx].step,
      depth: run.depth, stemGrowth, capGrowth, rimRate, capPeak, rateRatio, extentRatio, isSceptre,
    });
  }
  return { episodes, survived: !!(c.active || (c.total_growth_um || 0) > 0) };
}

let scenWithResorb = 0, scenWithSceptre = 0, totalSceptres = 0, totalEpisodes = 0;
const summary = [];

for (const scen of Object.keys(SCENARIOS)) {
  if (ONLY && scen !== ONLY) continue;
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (_e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  for (let s = 0; s < steps; s++) sim.run_step();

  const crystals = sim.crystals.filter((c) => c && c.mineral === 'quartz' && (c.zones || []).length > 1);
  if (!crystals.length) continue;

  let scenEpisodes = 0, scenSceptre = 0;
  const lines = [];
  for (const c of crystals) {
    const { episodes } = scanCrystal(c);
    scenEpisodes += episodes.length;
    for (const e of episodes) if (e.isSceptre) scenSceptre++;
    if (DETAIL) {
      const traj = (c.zones || []).slice().sort((a, b) => a.step - b.step)
        .map((z) => `${z.step}:${(z.thickness_um || 0) >= 0 ? '+' : '−'}${fmt(Math.abs(z.thickness_um || 0))}`).join(' ');
      lines.push(`    crystal#${c.crystal_id ?? '?'} (${(c.total_growth_um || 0).toFixed(1)}µm, ${c.dissolved ? 'resorbed' : 'intact'})  ${traj}`);
    }
    for (const e of episodes) {
      lines.push(`      ↳ resorption ${e.startStep}→${e.endStep} (−${fmt(e.depth)}µm)  stem ${fmt(e.stemGrowth)}µm → cap ${fmt(e.capGrowth)}µm  extent ${fmt(e.extentRatio)}  (rim ${fmt(e.rimRate)} → capPeak ${fmt(e.capPeak)}, rateRatio ${fmt(e.rateRatio)})${e.isSceptre ? '  ★SCEPTRE' : '  (sub-threshold)'}`);
    }
  }

  if (scenEpisodes) {
    scenWithResorb++;
    if (scenSceptre) scenWithSceptre++;
    totalEpisodes += scenEpisodes;
    totalSceptres += scenSceptre;
    summary.push({ scen, crystals: crystals.length, scenEpisodes, scenSceptre });
    console.log(`\n${scen}  (${crystals.length} qz crystals)  resorption-episodes ${scenEpisodes}, sceptres ${scenSceptre}`);
    for (const l of lines) console.log(l);
  }
}

console.log(`\n### QUARTZ SCEPTRE SCAN (resorption-aware; seed ${SEED}, ratio≥${RATIO}, rim ${RIM} zones)`);
console.log(`  scenarios with ≥1 resorption episode: ${scenWithResorb}`);
console.log(`  scenarios with ≥1 sceptre:            ${scenWithSceptre}`);
console.log(`  total sceptres (fleet):               ${totalSceptres}`);
console.log(`  total resorption episodes (fleet):    ${totalEpisodes}`);
console.log();
