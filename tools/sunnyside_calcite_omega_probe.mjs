// tools/sunnyside_calcite_omega_probe.mjs — Phase 1c: probe whether
// calcite ever reaches omega > sigma_crit (=1.5) in sunnyside_american_tunnel.
//
// Per HANDOFF-CARBONATE-PHASE-1-COMPLETE.md Phase 1c follow-up: "bump
// CO3 to restore the manganocalcite Stage VI cap firing. v144 lost the
// 36 µm calcite."
//
// But the test file itself (tests-js/sunnyside-american-tunnel.test.ts
// lines 96-127) documents:
//   - v143 calcite was empirical engine NOISE at omega ~1.05
//   - boss has 1 manganocalcite out of ~20 Silverton cabinet pieces
//     (it's RARE in real Sunnyside material)
//   - rhodochrosite carries the Stage VI signature (15/20 specimens)
//
// So before any CO3 bump, probe what omega calcite actually reaches.
// If a SMALL geologically-defensible bump pushes it over 1.5 reliably,
// that's a defensible fix. If it would require a structural broth
// re-shape, the v144 behavior (calcite rarely-fires, rhodochrosite
// carries the Stage) is closer to ground truth and the handoff item
// should be marked obsolete.
//
// Stages from data/scenarios.json5 + js/70p-sunnyside.ts:
//   step  30: cooling — T 280→240, pH 4.5→5.8, CO3 50→80
//   step  70: Stage V Mn-carbonate — T 240→215, CO3 80→115, pH→6.1
//   step 110: Stage VI fluoride — T 215→195, F + Y pulse
//   step 150: Stage VI manganocalcite cap — T 195→175, Mn↓, CO3 +40, Ca +30
//
// Usage: node tools/sunnyside_calcite_omega_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'sunnyside_calcite_omega_probe',
  extraExports: ['carbonateOmega', 'carbonateSaturationIndex'],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateOmega, carbonateSaturationIndex,
} = sim_exports;

const SIGMA_CRIT_CALCITE = 1.5;  // v144 PWP threshold per MINERAL_GATES_calcite

function probe() {
  setSeed(42);
  const scn = SCENARIOS['sunnyside_american_tunnel'];
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 200;

  console.log('step | T (°C) | pH | Ca | CO3 | Mn | Fe | omega_cal | SI_cal | gate');
  console.log('-----+--------+----+-----+-----+----+----+----------+--------+------');

  // Capture at event-aligned steps + a handful of mid-stage anchors.
  const SAMPLE_STEPS = new Set([
    1, 5, 15, 25, 29, 30, 31, 50, 69, 70, 71, 90, 109, 110, 111, 130,
    149, 150, 151, 160, 170, 175, 180, 185, 190, 195, 199,
  ]);

  let peakOmega = 0;
  let peakStep = -1;
  let peakT = 0;
  let peakCO3 = 0;
  let firstGateClear = -1;

  for (let i = 0; i < total; i++) {
    sim.run_step();
    const ringIdx = 0;
    const f = sim.ring_fluids[ringIdx];
    const T = sim.ring_temperatures[ringIdx];
    const omega = carbonateOmega('calcite', f, T);
    const SI = carbonateSaturationIndex('calcite', f, T);
    if (omega > peakOmega) {
      peakOmega = omega;
      peakStep = i;
      peakT = T;
      peakCO3 = f.CO3;
    }
    if (omega > SIGMA_CRIT_CALCITE && firstGateClear < 0) firstGateClear = i;
    if (SAMPLE_STEPS.has(i)) {
      const gate = omega > SIGMA_CRIT_CALCITE ? '✓' : '–';
      console.log(
        `${String(i).padStart(4)} | ${T.toFixed(0).padStart(6)} | ${f.pH.toFixed(1).padStart(3)} | ${f.Ca.toFixed(0).padStart(3)} | ${f.CO3.toFixed(0).padStart(3)} | ${f.Mn.toFixed(0).padStart(2)} | ${f.Fe.toFixed(1).padStart(3)} | ${omega.toFixed(3).padStart(8)} | ${SI.toFixed(2).padStart(6)} | ${gate}`,
      );
    }
  }

  console.log(`\nsigma_crit (calcite) = ${SIGMA_CRIT_CALCITE.toFixed(2)}`);
  console.log(`peak omega           = ${peakOmega.toFixed(3)} at step ${peakStep} (T=${peakT.toFixed(0)}°C, CO3=${peakCO3.toFixed(0)})`);
  console.log(`first gate-clear     = ${firstGateClear >= 0 ? `step ${firstGateClear}` : 'never'}`);

  // Calcite firing summary
  const calcites = sim.crystals.filter(c => c.mineral === 'calcite');
  console.log(`\ncalcite crystals     = ${calcites.length}`);
  if (calcites.length > 0) {
    for (const c of calcites) {
      const sz = (c.zones ?? []).reduce((s, z) => s + (z.thickness_um || 0), 0);
      console.log(`  #${c.crystal_id}: nucleation_step=${c.nucleation_step}, size=${sz.toFixed(0)} µm, active=${c.active}, enclosed_by=${c.enclosed_by ?? '-'}, dissolved=${c.dissolved}`);
    }
  }

  // What-if: scan a few CO3 bump levels — what omega would we get
  // at step 175 (peak Stage VI cap window) if CO3 were higher?
  console.log(`\nwhat-if: omega at step 175 (peak Stage VI cap window) under CO3 multipliers:`);
  setSeed(42);
  const { conditions: c2, events: e2 } = scn();
  const sim2 = new VugSimulator(c2, e2);
  for (let i = 0; i < 175; i++) sim2.run_step();
  const f175 = sim2.ring_fluids[0];
  const T175 = sim2.ring_temperatures[0];
  console.log(`  baseline step-175: T=${T175.toFixed(0)} CO3=${f175.CO3.toFixed(0)} omega=${carbonateOmega('calcite', f175, T175).toFixed(3)}`);
  for (const mult of [1.25, 1.5, 2.0, 3.0, 5.0]) {
    const ftest = { ...f175, CO3: f175.CO3 * mult };
    const om = carbonateOmega('calcite', ftest, T175);
    const gate = om > SIGMA_CRIT_CALCITE ? '✓ fires' : '– below sigma_crit';
    console.log(`  CO3 × ${mult.toFixed(2).padStart(4)}: CO3=${ftest.CO3.toFixed(0).padStart(3)}  omega=${om.toFixed(3).padStart(6)}  ${gate}`);
  }
}

probe();

// =====================================================================
// Diagnostic 2: are events firing at all? Check conditions.fluid vs
// ring_fluids[0] at event-aligned steps.
// =====================================================================
console.log(`\n=== diagnostic 2: conditions.fluid vs ring_fluids[0] sync ===`);
setSeed(42);
{
  const scn = SCENARIOS['sunnyside_american_tunnel'];
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const CHECK_STEPS = [29, 30, 31, 69, 70, 71, 109, 110, 111, 149, 150, 151, 199];

  console.log(`step | source         | T   | pH  | Ca  | CO3 | Mn  | Fe`);
  console.log(`-----+----------------+-----+-----+-----+-----+-----+----`);
  for (let i = 0; i < (defaultSteps ?? 200); i++) {
    sim.run_step();
    if (CHECK_STEPS.includes(i)) {
      const cf = sim.conditions.fluid;
      const ct = sim.conditions.temperature;
      const r0 = sim.ring_fluids[0];
      const rT = sim.ring_temperatures[0];
      console.log(`${String(i).padStart(4)} | conditions.fluid | ${ct.toFixed(0).padStart(3)} | ${cf.pH.toFixed(1).padStart(3)} | ${cf.Ca.toFixed(0).padStart(3)} | ${cf.CO3.toFixed(0).padStart(3)} | ${cf.Mn.toFixed(0).padStart(3)} | ${cf.Fe.toFixed(1).padStart(3)}`);
      console.log(`     | ring_fluids[0]   | ${rT.toFixed(0).padStart(3)} | ${r0.pH.toFixed(1).padStart(3)} | ${r0.Ca.toFixed(0).padStart(3)} | ${r0.CO3.toFixed(0).padStart(3)} | ${r0.Mn.toFixed(0).padStart(3)} | ${r0.Fe.toFixed(1).padStart(3)}`);
    }
  }

  // Last-ring + middle-ring check at step 199 (end of run)
  const n = sim.ring_fluids.length;
  console.log(`\n  per-ring sweep at step ${(defaultSteps ?? 200) - 1} (ring count = ${n}):`);
  for (let k = 0; k < n; k++) {
    const r = sim.ring_fluids[k];
    const t = sim.ring_temperatures[k];
    console.log(`    ring ${String(k).padStart(2)}: T=${t.toFixed(0).padStart(3)} pH=${r.pH.toFixed(1)} Ca=${r.Ca.toFixed(0).padStart(3)} CO3=${r.CO3.toFixed(0).padStart(3)} Mn=${r.Mn.toFixed(0).padStart(2)} Fe=${r.Fe.toFixed(1).padStart(3)}`);
  }

  // Mineral roster end-of-run
  const tally = {};
  for (const c of sim.crystals) {
    const k = c.mineral;
    if (!tally[k]) tally[k] = { total: 0, active: 0, enclosed: 0, dissolved: 0 };
    tally[k].total++;
    if (c.dissolved) tally[k].dissolved++;
    else if (c.enclosed_by != null) tally[k].enclosed++;
    else tally[k].active++;
  }
  console.log(`\n  mineral roster end-of-run:`);
  for (const [m, t] of Object.entries(tally).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`    ${m.padEnd(20)} total=${String(t.total).padStart(3)}  act=${String(t.active).padStart(3)}  enc=${String(t.enclosed).padStart(3)}  dis=${String(t.dissolved).padStart(3)}`);
  }
}
