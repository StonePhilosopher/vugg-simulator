#!/usr/bin/env node
/**
 * tools/quartz-hiatus-census.mjs — HIATUS / SCEPTRE census (quartz arc §2 Q2,
 * RESEARCH-quartz-morphology-2026-06-12.md).
 *
 * The σ survey (tools/morph-sigma-observe.mjs) answers the FENSTER question
 * (does σ spike high enough for an honest top band — yes). This probe answers
 * the SCEPTRE question: do quartz crystals naturally experience GROWTH
 * INTERRUPTIONS followed by renewed, wider growth? A sceptre is gen-N
 * overgrowing the TIP of gen-(N-1), wider than the stem — its σ-history
 * signature is a HIATUS (a run of no-growth steps) followed by a fresh pulse
 * whose growth_rate exceeds the pre-hiatus rim by a ratio (the §3 sketch:
 * morphSceptreScan). Sceptres are only cheap to ship if the interruptions
 * occur naturally; this census finds out whether and where.
 *
 * A growth ZONE is appended only on a step where grow_quartz returns a zone
 * (thickness > 0). So a gap in the per-crystal zone STEP sequence is a literal
 * growth hiatus; a negative-thickness zone (dissolutionMode) is a dissolution
 * episode — a different kind of interruption (resorption, the classic sceptre
 * trigger in nature). We report both.
 *
 * Usage:
 *   node tools/quartz-hiatus-census.mjs [--seed 42] [--hiatus 3] [--ratio 1.3] [--rim 3]
 *     --hiatus  minimum no-growth step gap to count as a hiatus (default 3)
 *     --ratio   renewal_rate / rim_rate above which the gap is a sceptre candidate (default 1.3)
 *     --rim     #zones averaged on each side of a gap for the rate comparison (default 3)
 *
 * Output: per (scenario) quartz crystals, every qualifying hiatus with its
 * renewal ratio + whether dissolution preceded the renewal, then a fleet
 * summary (scenarios with hiatuses / with sceptre candidates).
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'quartz-hiatus-census' });

const args = process.argv.slice(2);
const numArg = (flag, def) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : def);
const SEED = numArg('--seed', 42);
const HIATUS = numArg('--hiatus', 3);
const RATIO = numArg('--ratio', 1.3);
const RIM = numArg('--rim', 3);

const fmt = (x) => (isFinite(x) ? (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) : '—');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

let scenWithHiatus = 0, scenWithSceptre = 0, totalSceptreCands = 0, totalDissolEpisodes = 0;
const summary = [];

for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (_e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  for (let s = 0; s < steps; s++) sim.run_step();

  const crystals = sim.crystals.filter((c) => c && c.mineral === 'quartz' && (c.zones || []).length > 1);
  if (!crystals.length) continue;

  const lines = [];
  let scenHiatus = 0, scenSceptre = 0, scenDissol = 0;

  for (const c of crystals) {
    // growth zones in step order (positive-thickness = actual growth)
    const grown = (c.zones || []).filter((z) => (z.thickness_um || 0) > 0).sort((a, b) => a.step - b.step);
    const dissol = (c.zones || []).filter((z) => (z.thickness_um || 0) < 0);
    scenDissol += dissol.length;
    if (grown.length < 2) continue;

    for (let i = 0; i < grown.length - 1; i++) {
      const gap = grown[i + 1].step - grown[i].step;
      if (gap <= HIATUS) continue;
      scenHiatus++;
      // rim (before gap) vs renewal (after gap) mean growth_rate
      const before = grown.slice(Math.max(0, i + 1 - RIM), i + 1).map((z) => z.growth_rate || z.thickness_um || 0);
      const after = grown.slice(i + 1, i + 1 + RIM).map((z) => z.growth_rate || z.thickness_um || 0);
      const rimRate = mean(before), renewRate = mean(after);
      const ratio = rimRate > 0 ? renewRate / rimRate : NaN;
      // did dissolution happen inside the gap window? (resorption-driven sceptre)
      const resorbed = dissol.some((z) => z.step > grown[i].step && z.step < grown[i + 1].step);
      const isSceptre = isFinite(ratio) && ratio >= RATIO;
      if (isSceptre) scenSceptre++;
      lines.push(`    crystal#${c.crystal_id ?? '?'}  gap steps ${grown[i].step}→${grown[i + 1].step} (${gap})  rimRate ${fmt(rimRate)} → renewRate ${fmt(renewRate)}  ratio ${fmt(ratio)}${isSceptre ? '  ★SCEPTRE' : ''}${resorbed ? '  [resorbed]' : ''}`);
    }
  }

  if (scenHiatus || scenDissol) {
    if (scenHiatus) scenWithHiatus++;
    if (scenSceptre) scenWithSceptre++;
    totalSceptreCands += scenSceptre;
    totalDissolEpisodes += scenDissol;
    summary.push({ scen, crystals: crystals.length, scenHiatus, scenSceptre, scenDissol });
    console.log(`\n${scen}  (${crystals.length} qz crystals)  hiatuses ${scenHiatus}, sceptre-candidates ${scenSceptre}, dissolution-zones ${scenDissol}`);
    for (const l of lines) console.log(l);
  }
}

console.log(`\n### QUARTZ HIATUS CENSUS (seed ${SEED}, hiatus≥${HIATUS} steps, sceptre ratio≥${RATIO}, rim ${RIM} zones)`);
console.log(`  scenarios with ≥1 hiatus:           ${scenWithHiatus}`);
console.log(`  scenarios with ≥1 sceptre candidate: ${scenWithSceptre}`);
console.log(`  total sceptre candidates (fleet):    ${totalSceptreCands}`);
console.log(`  total dissolution zones (fleet):     ${totalDissolEpisodes}`);
if (!summary.length) console.log('  (no quartz crystal anywhere shows a growth hiatus — sceptres would need an engineered seal/breach scenario)');
console.log();
