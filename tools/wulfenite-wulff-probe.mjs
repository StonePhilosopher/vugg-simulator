#!/usr/bin/env node
// tools/wulfenite-wulff-probe.mjs — verify rung 4a.3 (wulfenite, tetragonal 4/m Wulff) has a live
// render target. Runs supergene_oxidation at seed 42 with wall.wulff_wulfenite forced ON, then
// reports every wulfenite at the final frame: size, twinned/dissolved status, habit, and the
// _wulffForm tag (biasC band, tabular flag) classifyWulffForm produced. This is the tenant-survival
// check (the marble-e-twin lesson: confirm display-size untwinned crystals survive to the LAST
// frame). SIM-neutral, read-only — sets the flag in-memory on the conditions, never on disk.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulfenite-wulff-probe' });
const SEED = 42;
const SCEN = process.argv[2] || 'supergene_oxidation';

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
conditions.wall.wulff_wulfenite = true;                 // force the opt-in for the probe
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 200;
for (let i = 0; i < steps; i++) sim.run_step();

const wulf = sim.crystals.filter(c => c.mineral === 'wulfenite');
const live = wulf.filter(c => !c.dissolved);
const tagged = live.filter(c => c._wulffForm);

console.log(`=== wulfenite Wulff probe — ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`wulfenite total ${wulf.length}  | live ${live.length}  | dissolved ${wulf.length - live.length}  | _wulffForm-tagged ${tagged.length}\n`);
for (const c of wulf) {
  const wf = c._wulffForm;
  console.log(
    `  #${String(c.crystal_id).padStart(3)}  ${(c.total_growth_um || 0).toFixed(0).padStart(4)}µm` +
    `  habit=${String(c.habit).padEnd(10)}  ${c.dissolved ? 'DISSOLVED' : 'live   '}  ${c.twinned ? 'TWINNED' : '       '}` +
    `  ${wf ? `_wulffForm{biasC=${wf.biasC.toFixed(2)}, growthFrac=${wf.growthFrac.toFixed(2)}, tabular=${wf.tabular}}` : '(untagged)'}`
  );
}

const DISPLAY = 30;   // WULFF_MIN_UM — the classifier's speck floor
const display = tagged.filter(c => (c.total_growth_um || 0) >= DISPLAY);
const sizes = live.map(c => c.total_growth_um || 0);
const biasCs = tagged.map(c => c._wulffForm.biasC);
console.log(`\nSURVIVAL: ${display.length} display-size (≥${DISPLAY}µm) untwinned Wulff-tagged wulfenite at the final frame.`);
if (sizes.length) console.log(`  live sizes ${Math.min(...sizes).toFixed(0)}–${Math.max(...sizes).toFixed(0)}µm`);
if (biasCs.length) console.log(`  biasC band ${Math.min(...biasCs).toFixed(2)}–${Math.max(...biasCs).toFixed(2)}  (expect ⊂ [1.40,2.80])`);
console.log(display.length ? '\n✓ render target EXISTS — supergene_oxidation is a viable wulfenite Wulff tenant.'
  : '\n✗ NO display-size untwinned wulfenite survives — pick a different tenant scenario.');
