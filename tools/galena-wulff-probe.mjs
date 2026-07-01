#!/usr/bin/env node
// tools/galena-wulff-probe.mjs — verify rung 4a.5 (galena, the SECOND cubic Wulff tenant) has a live
// render target. Runs mvt at seed 42 with wall.wulff_galena forced ON, then reports every galena at the
// final frame: size, twinned/dissolved status, habit, and the _wulffForm tag (cube band) classifyWulffForm
// produced. grow_galena hardcodes habit='cubic' → token 'cube' → the Wulff cube-with-{111}-truncations
// plate. The tenant-survival check (the marble-e-twin lesson: display-size untwinned cubes at the LAST
// frame). mvt is also a TWO-tenant Wulff druse (galena cubes + calcite dogtooth). SIM-neutral, read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'galena-wulff-probe' });
const SEED = 42;
const SCEN = process.argv[2] || 'mvt';

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
conditions.wall.wulff_galena = true;                    // force the opt-in for the probe
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 150;
for (let i = 0; i < steps; i++) sim.run_step();

const gal = sim.crystals.filter(c => c.mineral === 'galena');
const live = gal.filter(c => !c.dissolved);
const tagged = live.filter(c => c._wulffForm);
const isCube = (h) => { h = String(h || '').toLowerCase(); return h === 'cubic' || h === 'cube' || h.includes('cubocta'); };

console.log(`=== galena Wulff probe — ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`galena total ${gal.length}  | live ${live.length}  | dissolved ${gal.length - live.length}  | _wulffForm-tagged ${tagged.length}\n`);
const hist = {}; for (const c of live) { const h = String(c.habit || '(none)'); hist[h] = (hist[h] || 0) + 1; }
console.log('live habit histogram:', JSON.stringify(hist), '\n');
for (const c of gal.slice(0, 30)) {
  const wf = c._wulffForm;
  console.log(
    `  #${String(c.crystal_id).padStart(3)}  ${(c.total_growth_um || 0).toFixed(0).padStart(5)}µm` +
    `  habit=${String(c.habit).padEnd(9)}  ${isCube(c.habit) ? 'CUBE' : '    '}  ${c.dissolved ? 'DISSOLVED' : 'live   '}  ${c.twinned ? 'TWINNED' : '       '}` +
    `  ${wf ? `_wulffForm{biasC=${wf.biasC.toFixed(3)}, growthFrac=${wf.growthFrac.toFixed(2)}, octahedral=${wf.octahedral}}` : '(untagged)'}`
  );
}

const DISPLAY = 30;
const display = tagged.filter(c => isCube(c.habit) && !c.twinned && (c.total_growth_um || 0) >= DISPLAY);
const biasCs = tagged.map(c => c._wulffForm.biasC);
console.log(`\nSURVIVAL: ${display.length} display-size (≥${DISPLAY}µm) untwinned cube galena Wulff-tagged at the final frame.`);
if (biasCs.length) console.log(`  biasC band ${Math.min(...biasCs).toFixed(3)}–${Math.max(...biasCs).toFixed(3)}  (expect ⊂ [1.00,1.15] — cube w/ visible {111} truncations)`);
console.log(display.length ? '\n✓ render target EXISTS — mvt is a viable galena Wulff tenant (+ calcite = two-tenant druse).'
  : '\n✗ NO display-size untwinned cube galena survives — pick another tenant scenario.');
