#!/usr/bin/env node
// tools/titanite-wulff-probe.mjs — verify rung 4a.6 (titanite, the FIFTH crystal system: monoclinic 2/m)
// has a live render target. Runs grimsel_alpine_cleft at seed 42 with wall.wulff_titanite forced ON, then
// reports every titanite at the final frame: size, twinned/dissolved status, habit, and the _wulffForm tag
// (the wedge band [1.3,2.3]) classifyWulffForm produced. grow_titanite emits sphenoid_wedge (the default,
// token 'prism') / prismatic ('prism') / flattened_tabular ('tablet') — all opt into the one monoclinic
// WEDGE body (the kernel encodes the sphenoid; the β-lean {100}∧{001}=66.19° is in the faces). The
// tenant-survival check (the marble-e-twin lesson: display-size untwinned wedges at the LAST frame, the
// late-carbonate stage that grows them). SIM-neutral, read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'titanite-wulff-probe' });
const SEED = 42;
const SCEN = process.argv[2] || 'grimsel_alpine_cleft';

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
conditions.wall.wulff_titanite = true;                  // force the opt-in for the probe
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 200;
for (let i = 0; i < steps; i++) sim.run_step();

const tit = sim.crystals.filter(c => c.mineral === 'titanite');
const live = tit.filter(c => !c.dissolved);
const tagged = live.filter(c => c._wulffForm);
// the render token: sphenoid_wedge/prismatic → 'prism', flattened_tabular → 'tablet' (both Wulff-dispatched)
const isWedgeFamily = (h) => { h = String(h || '').toLowerCase(); return h.includes('wedge') || h.includes('sphenoid') || h.includes('prismatic') || h.includes('tabular'); };

console.log(`=== titanite Wulff probe — ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`titanite total ${tit.length}  | live ${live.length}  | dissolved ${tit.length - live.length}  | _wulffForm-tagged ${tagged.length}\n`);
const hist = {}; for (const c of live) { const h = String(c.habit || '(none)'); hist[h] = (hist[h] || 0) + 1; }
console.log('live habit histogram:', JSON.stringify(hist), '\n');
for (const c of tit.slice(0, 30)) {
  const wf = c._wulffForm;
  console.log(
    `  #${String(c.crystal_id).padStart(3)}  ${(c.total_growth_um || 0).toFixed(0).padStart(5)}µm` +
    `  habit=${String(c.habit).padEnd(18)}  ${isWedgeFamily(c.habit) ? 'WEDGE' : '     '}  ${c.dissolved ? 'DISSOLVED' : 'live   '}  ${c.twinned ? 'TWINNED' : '       '}` +
    `  ${wf ? `_wulffForm{biasC=${wf.biasC.toFixed(3)}, growthFrac=${wf.growthFrac.toFixed(2)}, wedge=${wf.wedge}}` : '(untagged)'}`
  );
}

const DISPLAY = 30;
const display = tagged.filter(c => isWedgeFamily(c.habit) && !c.twinned && (c.total_growth_um || 0) >= DISPLAY);
const biasCs = tagged.map(c => c._wulffForm.biasC);
console.log(`\nSURVIVAL: ${display.length} display-size (≥${DISPLAY}µm) untwinned wedge titanite Wulff-tagged at the final frame.`);
if (biasCs.length) console.log(`  biasC band ${Math.min(...biasCs).toFixed(3)}–${Math.max(...biasCs).toFixed(3)}  (expect ⊂ [1.30,2.30] — the flattened-wedge band)`);
console.log(display.length ? '\n✓ render target EXISTS — grimsel is a viable titanite (monoclinic) Wulff tenant — the alpine-cleft wedge.'
  : '\n✗ NO display-size untwinned wedge titanite survives — pick another tenant scenario.');
