#!/usr/bin/env node
// tools/barite-wulff-probe.mjs — verify rung 4a.4 (barite, orthorhombic mmm Wulff) has a live
// render target. Runs tn457_barite_pulses at seed 42 with wall.wulff_barite forced ON, then reports
// every barite at the final frame: size, twinned/dissolved status, habit, and the _wulffForm tag
// (biasC band) classifyWulffForm produced. Barite's habit is σ-driven (tabular/bladed/prismatic/
// cockscomb/snowball), and ONLY tabular+bladed map to the renderer's 'tablet' token (js/99i ~595) →
// only those become the Wulff rectangular plate. This probe reports the habit histogram so we know
// the tabular/bladed family actually fires + survives (the marble-e-twin lesson: confirm display-
// size untwinned crystals survive to the LAST frame). SIM-neutral, read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'barite-wulff-probe' });
const SEED = 42;
const SCEN = process.argv[2] || 'tn457_barite_pulses';

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
conditions.wall.wulff_barite = true;                    // force the opt-in for the probe
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 110;
for (let i = 0; i < steps; i++) sim.run_step();

const bar = sim.crystals.filter(c => c.mineral === 'barite');
const live = bar.filter(c => !c.dissolved);
const tagged = live.filter(c => c._wulffForm);
// tabular + bladed both → token 'tablet' (js/99i geomTokenForHabit: h.includes('blade')||includes('tabular'))
const isTablet = (h) => { h = String(h || '').toLowerCase(); return h.includes('tabular') || h.includes('blade'); };

console.log(`=== barite Wulff probe — ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`barite total ${bar.length}  | live ${live.length}  | dissolved ${bar.length - live.length}  | _wulffForm-tagged ${tagged.length}\n`);

// habit histogram
const hist = {};
for (const c of live) { const h = String(c.habit || '(none)'); hist[h] = (hist[h] || 0) + 1; }
console.log('live habit histogram:', JSON.stringify(hist));
const tabletEligible = live.filter(c => isTablet(c.habit) && !c.twinned);
console.log(`tablet-token-eligible (tabular/bladed, untwinned): ${tabletEligible.length}\n`);

for (const c of bar.slice(0, 40)) {
  const wf = c._wulffForm;
  console.log(
    `  #${String(c.crystal_id).padStart(3)}  ${(c.total_growth_um || 0).toFixed(0).padStart(4)}µm` +
    `  habit=${String(c.habit).padEnd(11)}  ${isTablet(c.habit) ? 'TABLET' : '      '}  ${c.dissolved ? 'DISSOLVED' : 'live   '}  ${c.twinned ? 'TWINNED' : '       '}` +
    `  ${wf ? `_wulffForm{biasC=${wf.biasC.toFixed(2)}, growthFrac=${wf.growthFrac.toFixed(2)}, tabular=${wf.tabular}}` : '(untagged)'}`
  );
}
if (bar.length > 40) console.log(`  … (${bar.length - 40} more)`);

const DISPLAY = 30;   // WULFF_MIN_UM — the classifier's speck floor
const display = tabletEligible.filter(c => (c.total_growth_um || 0) >= DISPLAY);
const sizes = live.map(c => c.total_growth_um || 0);
const biasCs = tagged.map(c => c._wulffForm.biasC);
console.log(`\nSURVIVAL: ${display.length} display-size (≥${DISPLAY}µm) untwinned tabular/bladed barite at the final frame.`);
if (sizes.length) console.log(`  live sizes ${Math.min(...sizes).toFixed(0)}–${Math.max(...sizes).toFixed(0)}µm`);
if (biasCs.length) console.log(`  biasC band ${Math.min(...biasCs).toFixed(2)}–${Math.max(...biasCs).toFixed(2)}`);
console.log(display.length ? '\n✓ render target EXISTS — tn457_barite_pulses is a viable barite Wulff tenant.'
  : '\n✗ NO display-size untwinned tabular/bladed barite survives — broaden habit gate or pick another tenant.');
