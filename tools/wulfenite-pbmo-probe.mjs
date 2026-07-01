#!/usr/bin/env node
// tools/wulfenite-pbmo-probe.mjs — the rung-4a.7 empirical gate for the Pb:Mo habit lever
// (HANDOFF-GROWTH-GEOMETRY-2026-07-01.md "What I'd do next" #1). Kept on the bench: point it
// at any future wulfenite-growing scenario to read its water story before calibrating a habit.
//
// The lever (Sci. Rep. 2024 s41598-024-60043-4, verified + read last session): solution
// C_Pb/C_MoO4 < 1 (Mo-rich) → tabular {001}; > 1 (Pb-rich) → bipyramidal {101}.
// Before ANY code: does supergene_oxidation's Pb:Mo actually SWING at seed 42 —
// across the run, across the wulfenite growth window, across seeds? If the integrated
// ratio is near-constant everywhere, wiring biasC to it is no-op #6.
//
// Ground truth for per-zone fluid: grow_wulfenite's zone NOTE records
// "..., Pb: <n> Mo: <n> ppm" — the fluid the engine SAW at growth time. We parse that
// AND sample sim.conditions.fluid per step, cross-checking the two.
//
// Molar orientation: r = (Pb_ppm/207.2)/(Mo_ppm/95.95)  [Pb 207.2, Mo 95.95 g/mol]
// — sim ppm are sim-scale, so r's absolute placement vs the paper's r=1 threshold is
// CALIBRATION, but the swing/direction is real signal. Read-only, SIM-neutral.

import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulfenite-pbmo-probe' });

const MOLAR = (pb, mo) => (mo > 0 ? (pb / 207.2) / (mo / 95.95) : Infinity);
const NOTE_RE = /Pb:\s*(\d+)\s*Mo:\s*(\d+)\s*ppm/;

function runOne(seed, verbose) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.supergene_oxidation();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps || 200;
  const fluidTrail = [];                       // sampled AFTER each run_step, indexed by step
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = sim.conditions.fluid;
    fluidTrail.push({ step: i, Pb: f.Pb, Mo: f.Mo, r: MOLAR(f.Pb, f.Mo) });
  }

  const wulf = sim.crystals.filter(c => c.mineral === 'wulfenite');
  const live = wulf.filter(c => !c.dissolved);
  const tagged = live.filter(c => c._wulffForm);

  const rows = [];
  for (const c of live) {
    const zones = (c.zones || []).filter(z => z && z.thickness_um > 0);
    if (!zones.length) continue;
    let wSum = 0, rwSum = 0, rMin = Infinity, rMax = -Infinity, parsed = 0, sampledOnly = 0;
    const zoneTrail = [];
    for (const z of zones) {
      const m = NOTE_RE.exec(String(z.note || ''));
      let pb, mo, src;
      if (m) { pb = +m[1]; mo = +m[2]; src = 'note'; parsed++; }
      else {
        const s = fluidTrail[Math.min(z.step, fluidTrail.length - 1)];
        pb = s.Pb; mo = s.Mo; src = 'sampled'; sampledOnly++;
      }
      const r = MOLAR(pb, mo);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      wSum += z.thickness_um; rwSum += r * z.thickness_um;
      zoneTrail.push({ step: z.step, um: z.thickness_um, pb, mo, r, src });
    }
    const rInt = rwSum / wSum;                 // growth-weighted (zone-integrated) molar ratio
    rows.push({
      id: c.crystal_id, seed,
      nucStep: zones[0].step, lastStep: zones[zones.length - 1].step,
      nZones: zones.length, total: c.total_growth_um,
      rInt, rMin, rMax, swing: rMax - rMin, swingPct: 100 * (rMax - rMin) / rInt,
      biasC: c._wulffForm ? c._wulffForm.biasC : null, tagged: !!c._wulffForm,
      parsed, sampledOnly, zoneTrail,
    });
  }

  if (verbose) {
    console.log(`\n--- seed ${seed}: fluid Pb/Mo trajectory (every 10 steps + event steps) ---`);
    const marks = new Set([0, 5, 8, 12, 16, 20, 40, 55, 70, 95, 115, 130, 160]);
    for (const s of fluidTrail) {
      if (s.step % 10 === 0 || marks.has(s.step)) {
        console.log(`  step ${String(s.step).padStart(3)}  Pb=${s.Pb.toFixed(1).padStart(6)}  Mo=${s.Mo.toFixed(1).padStart(6)}  r_molar=${s.r.toFixed(3)}`);
      }
    }
    for (const row of rows) {
      console.log(`\n--- seed ${seed}: wulfenite #${row.id} (${row.total.toFixed(0)}µm, ${row.nZones} zones, steps ${row.nucStep}→${row.lastStep}, tagged=${row.tagged}, hashed biasC=${row.biasC == null ? 'n/a' : row.biasC.toFixed(2)}) ---`);
      console.log(`  note-parsed zones: ${row.parsed}/${row.nZones} (${row.sampledOnly} fell back to sampled trail)`);
      console.log(`  zone-integrated r = ${row.rInt.toFixed(3)}   window swing: [${row.rMin.toFixed(3)}, ${row.rMax.toFixed(3)}]  (${row.swingPct.toFixed(1)}% of integrated)`);
      const t = row.zoneTrail;
      const show = t.length <= 24 ? t : [...t.slice(0, 12), null, ...t.slice(-12)];
      for (const z of show) {
        if (!z) { console.log('    ...'); continue; }
        console.log(`    step ${String(z.step).padStart(3)}  +${z.um.toFixed(2).padStart(6)}µm  Pb=${String(z.pb).padStart(4)} Mo=${String(z.mo).padStart(4)}  r=${z.r.toFixed(3)}  [${z.src}]`);
      }
    }
    console.log(`\n  wulfenite population: ${wulf.length} nucleated, ${live.length} live, ${tagged.length} Wulff-tagged (the render population)`);
  }
  return rows;
}

// ---- seed 42, verbose (the canonical fleet) ----
console.log('=== wulfenite Pb:Mo probe — supergene_oxidation ===');
const rows42 = runOne(42, true);

// ---- cross-seed: integrated-ratio spread (the variety the lever could earn) ----
console.log('\n=== cross-seed sweep: zone-integrated r per live wulfenite ===');
const allRows = [...rows42];
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  try { allRows.push(...runOne(seed, false)); }
  catch (e) { console.log(`  seed ${seed}: RUN FAILED — ${e.message}`); }
}
console.log('  seed  id   nucStep  total_um   r_int   window[min,max]      swing%   hashedBiasC');
for (const r of allRows) {
  console.log(`  ${String(r.seed).padStart(4)}  ${String(r.id).padStart(3)}  ${String(r.nucStep).padStart(6)}  ${r.total.toFixed(0).padStart(8)}  ${r.rInt.toFixed(3).padStart(6)}  [${r.rMin.toFixed(3)}, ${r.rMax.toFixed(3)}]  ${r.swingPct.toFixed(1).padStart(6)}%  ${r.biasC == null ? '   n/a' : r.biasC.toFixed(2).padStart(6)}`);
}
const ints = allRows.map(r => r.rInt);
if (ints.length) {
  const mean = ints.reduce((a, b) => a + b, 0) / ints.length;
  const sd = Math.sqrt(ints.reduce((a, b) => a + (b - mean) ** 2, 0) / ints.length);
  const lo = Math.min(...ints), hi = Math.max(...ints);
  console.log(`\n  integrated-r across ${ints.length} crystals/${new Set(allRows.map(r => r.seed)).size} seeds:  min=${lo.toFixed(3)} max=${hi.toFixed(3)} mean=${mean.toFixed(3)} CV=${(100 * sd / mean).toFixed(1)}%`);
  const inWin = allRows.map(r => r.swingPct);
  console.log(`  within-window swing: min=${Math.min(...inWin).toFixed(1)}% max=${Math.max(...inWin).toFixed(1)}% — the core→rim signal a zone-resolved lever could show`);
  console.log('\n=== VERDICT GUIDE ===');
  console.log('  cross-seed CV < ~5% AND within-window swing < ~10%  → near-constant: biasC-from-ratio is no-op #6 as-is');
  console.log('  cross-seed spread real OR window swing real         → signal exists; design the mapping (task #155)');
  console.log('  (absolute r vs the paper r=1 threshold is CALIBRATION — sim ppm are sim-scale)');
}
