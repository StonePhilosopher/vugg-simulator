// tools/strip-chip-selector-probe.mjs — does the Strip View chip selector
// offer a toggle for EVERY chip system present in a dataset manifest?
//
// Born from the v176-era review catch: the v165 sulfate SI chips
// (SI_selenite / SI_anhydrite / SI_barite / SI_celestine) declare
// system:'sulfate', but _stripRenderDataset's selector loop iterated a
// hardcoded ['wall','special','carbonate','ion'] list — so the four chips
// rendered in every strip (default-visible) yet had no selector element:
// no individual toggle, no hover-isolate, unreachable after bulk "none".
//
// Method: build a tiny synthetic StripDataset with one chip per system
// (all five), render it through the real _stripRenderDataset into jsdom,
// and assert every chip id got a selector element. Render exceptions
// after the selector is appended (e.g. jsdom's null canvas context in the
// filmstrip) are tolerated — the selector is what we're probing.
//
// Run: node tools/strip-chip-selector-probe.mjs   (exit 1 on missing chips)

import { loadSimBundle } from './_harness.mjs';

const { _stripRenderDataset, stripAllocateData } = await loadSimBundle({
  toolName: 'strip-chip-selector-probe',
  extraExports: ['_stripRenderDataset', 'stripAllocateData'],
});

const axes = { steps: 4, angular_indices: 2, height_positions: 2, depth_positions: 1 };
const chips = [
  { id: 'fill',        label: 'fill',  system: 'wall',      range: [0, 1],    units: '',      color: 0x8888aa },
  { id: 'T',           label: 'T',     system: 'special',   range: [0, 400],  units: '°C',    color: 0xff8844 },
  { id: 'SI_calcite',  label: 'SIcal', system: 'carbonate', range: [-4, 4],   units: 'log Ω', color: 0x44ddaa },
  { id: 'SI_barite',   label: 'SIbar', system: 'sulfate',   range: [-4, 4],   units: 'log Ω', color: 0xddcc44 },
  { id: 'Ca',          label: 'Ca',    system: 'ion',       range: [0, 1000], units: 'ppm',   color: 0x66aaff },
];
const ds = {
  manifest: {
    format_version: 3,
    sim_version: 0,
    scenario_id: 'selector-probe-synthetic',
    seed: 42,
    recorded_at: 0,
    duration_steps: axes.steps,
    axes,
    chips,
  },
  chip_data: stripAllocateData(axes, chips.length).fill(127),
  nucleation_events: [],
};

const host = document.createElement('div');
document.body.appendChild(host);
try {
  _stripRenderDataset(host, ds);
} catch (err) {
  console.log(`(render threw after selector build — tolerated in jsdom: ${err.message})`);
}

// Selector chip elements carry the chip label as their text; find each
// chip by walking all elements and matching exact textContent.
const allEls = [...host.querySelectorAll('*')];
const missing = [];
for (const chip of chips) {
  const hit = allEls.some((el) => el.children.length === 0 && el.textContent === chip.label);
  console.log(`  ${chip.system.padEnd(10)} ${chip.id.padEnd(12)} selector element: ${hit ? 'PRESENT' : 'MISSING'}`);
  if (!hit) missing.push(chip.id);
}

if (missing.length) {
  console.error(`\nFAIL — ${missing.length} chip(s) unreachable in the selector: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('\nPASS — every chip system in the manifest is toggleable in the selector.');
