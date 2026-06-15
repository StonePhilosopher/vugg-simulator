#!/usr/bin/env node
/**
 * tools/strip-archive-diff.mjs — compare two archived strip STORIES of the
 * canonical seed-42 vugg and show WHERE they vary: which chip trajectories
 * diverged, by how much and at which step, plus which nucleation bells were
 * added or dropped.
 *
 * Companion to gen-strip-archive.mjs. Reads archive/strips/v<N>/<scenario>.json
 * (the strip-story-v1 format: per-chip full step series + nucleation_events).
 *
 * USAGE
 *   node tools/strip-archive-diff.mjs <vA> <vB> <scenario>
 *       text report: per-chip max |Δ| and the step it peaks, ranked;
 *       nucleation bells gained/lost; a per-chip ASCII overlay sparkline.
 *   node tools/strip-archive-diff.mjs <vA> <vB> <scenario> --chip pH
 *       drill into ONE chip: full aligned A/B/Δ table + the overlay.
 *   node tools/strip-archive-diff.mjs <vA> <vB> <scenario> --html [out.html]
 *       write an interactive overlay (A solid, B dashed, Δ shaded) — every
 *       chip stacked, nucleation bells as ticks on a shared step axis.
 *   node tools/strip-archive-diff.mjs <vA> <vB> --all
 *       fleet sweep: one line per scenario, the loudest chip + bell delta.
 *
 * Versions may be bare numbers (194) or "v194". Scenario "mvt" etc.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ARCHIVE = path.join(ROOT, 'archive', 'strips');

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--all') flags.all = true;
  else if (a === '--html') { flags.html = true; if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags.htmlOut = argv[++i]; }
  else if (a === '--chip') flags.chip = argv[++i];
  else if (a.startsWith('--')) flags[a.slice(2)] = true;
  else pos.push(a);
}

const vtag = (v) => (String(v).startsWith('v') ? String(v) : `v${v}`);

function loadStory(v, scenario) {
  const p = path.join(ARCHIVE, vtag(v), `${scenario}.json`);
  if (!fs.existsSync(p)) {
    console.error(`[strip-diff] missing: ${path.relative(ROOT, p)}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listScenarios(v) {
  const dir = path.join(ARCHIVE, vtag(v));
  if (!fs.existsSync(dir)) {
    console.error(`[strip-diff] no archive folder: ${path.relative(ROOT, dir)}`);
    process.exit(1);
  }
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

// Resolve a chip's wall series, expanding the "same_as_wall" center alias.
function wallSeries(story, chipId) {
  const c = story.chips[chipId];
  if (!c) return null;
  return Array.isArray(c.wall) ? c.wall : null;
}

// Align two series to the shorter length (scenarios with changed duration_steps
// would mismatch; we compare the overlap and flag the length delta).
function alignedDelta(a, b) {
  const n = Math.min(a.length, b.length);
  let maxAbs = 0, maxStep = -1, sumAbs = 0, defined = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    if (x == null && y == null) continue;
    if (x == null || y == null) {
      // appearance/disappearance of a defined value is itself a divergence
      if (maxAbs < Infinity) { maxAbs = Infinity; maxStep = i; }
      continue;
    }
    const d = Math.abs(y - x);
    sumAbs += d; defined++;
    if (d > maxAbs) { maxAbs = d; maxStep = i; }
  }
  return { maxAbs, maxStep, meanAbs: defined ? sumAbs / defined : 0, n, lenA: a.length, lenB: b.length };
}

// Eight-cell unicode sparkline of a series scaled to its own [min,max].
const SPARK = '▁▂▃▄▅▆▇█';
function sparkline(series) {
  const def = series.filter((v) => v != null);
  if (!def.length) return ' '.repeat(Math.min(series.length, 60));
  const lo = Math.min(...def), hi = Math.max(...def);
  const span = hi - lo || 1;
  // downsample to <=60 cols
  const cols = Math.min(series.length, 60);
  const out = [];
  for (let c = 0; c < cols; c++) {
    const i = Math.round((c * (series.length - 1)) / (cols - 1 || 1));
    const v = series[i];
    if (v == null) { out.push(' '); continue; }
    const t = Math.round(((v - lo) / span) * (SPARK.length - 1));
    out.push(SPARK[t]);
  }
  return out.join('');
}

// Nucleation-bell multiset diff. Key on (mineral) tallies + the step-keyed
// set, so we report both "the suite changed" and "a bell moved in time".
function bellDiff(storyA, storyB) {
  const tally = (evs) => {
    const m = new Map();
    for (const e of evs) m.set(e.mineral, (m.get(e.mineral) || 0) + 1);
    return m;
  };
  const ta = tally(storyA.nucleation_events), tb = tally(storyB.nucleation_events);
  const minerals = [...new Set([...ta.keys(), ...tb.keys()])].sort();
  const rows = [];
  for (const m of minerals) {
    const a = ta.get(m) || 0, b = tb.get(m) || 0;
    if (a !== b) rows.push({ mineral: m, a, b, delta: b - a });
  }
  return { rows, totalA: storyA.nucleation_events.length, totalB: storyB.nucleation_events.length };
}

function chipKeys(storyA, storyB) {
  return [...new Set([...Object.keys(storyA.chips), ...Object.keys(storyB.chips)])].sort();
}

// ---- text report for one scenario ------------------------------------------
function reportScenario(vA, vB, scenario) {
  const A = loadStory(vA, scenario), B = loadStory(vB, scenario);
  console.log(`\nstrip-story diff  ${vtag(vA)} → ${vtag(vB)}  [${scenario}]`);
  if (A.steps !== B.steps) console.log(`  ⚠ duration changed: ${A.steps} → ${B.steps} steps (comparing overlap)`);

  // chip divergences, ranked by max|Δ| relative to the chip's range span
  const rows = [];
  for (const id of chipKeys(A, B)) {
    const a = wallSeries(A, id), b = wallSeries(B, id);
    if (!a || !b) { rows.push({ id, note: a ? 'only in A' : 'only in B', score: Infinity }); continue; }
    const d = alignedDelta(a, b);
    const meta = (A.chips[id] || B.chips[id]);
    const span = (meta.range && meta.range[1] - meta.range[0]) || 1;
    const rel = d.maxAbs === Infinity ? Infinity : d.maxAbs / span;
    rows.push({ id, d, rel, units: meta.units || '', score: rel });
  }
  rows.sort((x, y) => (y.score - x.score) || 0);

  const movers = rows.filter((r) => r.score > 1e-9);
  const flat = rows.length - movers.length;
  console.log(`\n  ${movers.length} chip(s) diverged, ${flat} identical:`);
  for (const r of movers) {
    if (r.note) { console.log(`    ${r.id.padEnd(16)} ${r.note}`); continue; }
    const at = r.d.maxStep >= 0 ? `@step ${r.d.maxStep}` : '';
    const mag = r.d.maxAbs === Infinity ? 'null↔value' : `max|Δ| ${r.d.maxAbs.toFixed(3)}${r.units}`;
    console.log(`    ${r.id.padEnd(16)} ${mag.padEnd(22)} ${at.padEnd(11)} (mean|Δ| ${r.d.meanAbs.toFixed(3)})`);
  }

  // overlay sparklines for the loudest few
  const topN = movers.filter((r) => r.d).slice(0, 8);
  if (topN.length) {
    console.log(`\n  overlay (A=${vtag(vA)} top line, B=${vtag(vB)} bottom, own-scale):`);
    for (const r of topN) {
      const a = wallSeries(A, r.id), b = wallSeries(B, r.id);
      console.log(`    ${r.id.padEnd(16)} A ${sparkline(a)}`);
      console.log(`    ${''.padEnd(16)} B ${sparkline(b)}`);
    }
  }

  // nucleation bells
  const bd = bellDiff(A, B);
  console.log(`\n  nucleation bells: ${bd.totalA} → ${bd.totalB}`);
  if (bd.rows.length) {
    for (const r of bd.rows) {
      const sign = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
      console.log(`    ${r.mineral.padEnd(18)} ${r.a} → ${r.b}  (${sign})`);
    }
  } else {
    console.log('    (suite unchanged)');
  }
}

// ---- one-chip drilldown -----------------------------------------------------
function reportChip(vA, vB, scenario, chipId) {
  const A = loadStory(vA, scenario), B = loadStory(vB, scenario);
  const a = wallSeries(A, chipId), b = wallSeries(B, chipId);
  if (!a || !b) { console.error(`[strip-diff] chip ${chipId} missing in one story`); process.exit(1); }
  const meta = A.chips[chipId] || B.chips[chipId];
  console.log(`\nchip "${chipId}" (${meta.label || ''}, ${meta.units || ''})  ${vtag(vA)} vs ${vtag(vB)}  [${scenario}]`);
  console.log(`  ${vtag(vA)} ${sparkline(a)}`);
  console.log(`  ${vtag(vB)} ${sparkline(b)}`);
  const n = Math.min(a.length, b.length);
  console.log(`\n  step   ${vtag(vA).padStart(9)} ${vtag(vB).padStart(9)} ${'Δ'.padStart(9)}`);
  for (let i = 0; i < n; i++) {
    if (a[i] == null && b[i] == null) continue;
    const d = (a[i] != null && b[i] != null) ? (b[i] - a[i]) : null;
    if (d != null && Math.abs(d) < 1e-9) continue;  // only print rows that differ
    const fmt = (v) => (v == null ? '—' : v.toFixed(3));
    console.log(`  ${String(i).padStart(4)}   ${fmt(a[i]).padStart(9)} ${fmt(b[i]).padStart(9)} ${fmt(d).padStart(9)}`);
  }
}

// ---- fleet sweep ------------------------------------------------------------
function reportAll(vA, vB) {
  const a = new Set(listScenarios(vA)), b = new Set(listScenarios(vB));
  const both = [...a].filter((s) => b.has(s)).sort();
  const onlyA = [...a].filter((s) => !b.has(s)), onlyB = [...b].filter((s) => !a.has(s));
  console.log(`\nstrip-story fleet diff  ${vtag(vA)} → ${vtag(vB)}  (${both.length} shared scenarios)`);
  if (onlyA.length) console.log(`  only in ${vtag(vA)}: ${onlyA.join(', ')}`);
  if (onlyB.length) console.log(`  only in ${vtag(vB)}: ${onlyB.join(', ')}`);
  console.log('');
  let moved = 0;
  for (const s of both) {
    const A = loadStory(vA, s), B = loadStory(vB, s);
    let loud = null;
    for (const id of chipKeys(A, B)) {
      const x = wallSeries(A, id), y = wallSeries(B, id);
      if (!x || !y) { loud = { id, score: Infinity, note: 'chip add/drop' }; break; }
      const d = alignedDelta(x, y);
      const meta = A.chips[id] || B.chips[id];
      const span = (meta.range && meta.range[1] - meta.range[0]) || 1;
      const rel = d.maxAbs === Infinity ? Infinity : d.maxAbs / span;
      if (!loud || rel > loud.score) loud = { id, score: rel, maxAbs: d.maxAbs, units: meta.units || '' };
    }
    const bd = bellDiff(A, B);
    const bellNote = bd.rows.length
      ? bd.rows.map((r) => `${r.delta > 0 ? '+' : ''}${r.delta} ${r.mineral}`).join(', ')
      : 'bells=';
    const chipNote = !loud || loud.score < 1e-9
      ? 'chips identical'
      : (loud.note || `${loud.id} max|Δ| ${loud.maxAbs.toFixed(3)}${loud.units}`);
    if ((loud && loud.score > 1e-9) || bd.rows.length) {
      moved++;
      console.log(`  ${s.padEnd(28)} ${chipNote.padEnd(34)} ${bd.rows.length ? bellNote : ''}`);
    }
  }
  console.log(`\n  ${moved}/${both.length} scenarios moved.`);
}

// ---- HTML overlay -----------------------------------------------------------
function emitHtml(vA, vB, scenario, outPath) {
  const A = loadStory(vA, scenario), B = loadStory(vB, scenario);
  const ids = chipKeys(A, B).filter((id) => {
    const x = wallSeries(A, id), y = wallSeries(B, id);
    return x && y;  // only chips present in both get an overlay panel
  });
  // keep only chips that actually move OR are the headline chemistry chips
  const HEADLINE = new Set(['T', 'pH', 'Eh', 'SI_calcite', 'DIC', 'concentration']);
  const panels = ids.filter((id) => {
    const d = alignedDelta(wallSeries(A, id), wallSeries(B, id));
    return d.maxAbs > 1e-9 || HEADLINE.has(id);
  });
  const bd = bellDiff(A, B);
  const payload = {
    vA: vtag(vA), vB: vtag(vB), scenario,
    stepsA: A.steps, stepsB: B.steps,
    panels: panels.map((id) => ({
      id,
      label: (A.chips[id] || B.chips[id]).label || id,
      units: (A.chips[id] || B.chips[id]).units || '',
      range: (A.chips[id] || B.chips[id]).range || null,
      a: wallSeries(A, id), b: wallSeries(B, id),
    })),
    bellsA: A.nucleation_events.map((e) => ({ step: e.step, mineral: e.mineral })),
    bellsB: B.nucleation_events.map((e) => ({ step: e.step, mineral: e.mineral })),
    bellRows: bd.rows,
  };
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>strip diff ${payload.vA}→${payload.vB} ${scenario}</title>
<style>
  body { background:#0d0d10; color:#d8d8dc; font:13px/1.5 ui-monospace,Menlo,Consolas,monospace; margin:0; padding:18px; }
  h1 { font-size:15px; font-weight:600; margin:0 0 4px; }
  .sub { color:#888; margin:0 0 16px; }
  .legend span { margin-right:16px; }
  .swA { color:#6cc6ff; } .swB { color:#ff9d6c; }
  .panel { margin:0 0 10px; border:1px solid #222; border-radius:6px; padding:8px 10px; background:#131318; }
  .panel h2 { font-size:12px; margin:0 0 2px; font-weight:600; color:#cfcfd6; }
  .panel .meta { color:#777; font-size:11px; margin:0 0 4px; }
  svg { display:block; width:100%; height:90px; }
  .gridline { stroke:#222; stroke-width:1; }
  .lineA { fill:none; stroke:#6cc6ff; stroke-width:1.5; }
  .lineB { fill:none; stroke:#ff9d6c; stroke-width:1.5; stroke-dasharray:4 3; }
  .delta { fill:#ff9d6c22; }
  .bellA { stroke:#6cc6ff; stroke-width:1; opacity:.5; }
  .bellB { stroke:#ff9d6c; stroke-width:1; opacity:.5; }
  .bells { margin:14px 0 0; }
  .bells td { padding:1px 12px 1px 0; }
  .gain { color:#7fd77f; } .loss { color:#e07070; }
</style></head><body>
<h1>strip-story overlay — ${scenario}</h1>
<p class="sub">${payload.vA} (${A.steps} steps) → ${payload.vB} (${B.steps} steps) ·
  <span class="legend"><span class="swA">━ ${payload.vA}</span><span class="swB">╌ ${payload.vB}</span>
  shaded = |Δ| · ticks below each panel = nucleation bells</span></p>
<div id="panels"></div>
<div class="bells"><h2>nucleation bells: ${payload.bellsA.length} → ${payload.bellsB.length}</h2>
<table id="bellrows"></table></div>
<script>
const D = ${JSON.stringify(payload)};
const W = 1100, H = 90, PADL = 44, PADR = 8, PADT = 8, PADB = 14;
function scaleY(v, lo, hi){ const s=(hi-lo)||1; return PADT + (H-PADT-PADB) * (1 - (v-lo)/s); }
function panelSvg(p){
  const n = Math.max(p.a.length, p.b.length);
  const def = [...p.a, ...p.b].filter(v=>v!=null);
  let lo = p.range ? p.range[0] : Math.min(...def);
  let hi = p.range ? p.range[1] : Math.max(...def);
  if (!isFinite(lo)||!isFinite(hi)||lo===hi){ lo=Math.min(...def,0); hi=Math.max(...def,1); }
  const X = i => PADL + (W-PADL-PADR) * (i/((n-1)||1));
  const pathOf = arr => { let d='',pen=false; arr.forEach((v,i)=>{ if(v==null){pen=false;return;} d+=(pen?'L':'M')+X(i).toFixed(1)+' '+scaleY(v,lo,hi).toFixed(1)+' '; pen=true; }); return d; };
  // delta shading: vertical bars where both defined and differ
  let deltaRects='';
  const m=Math.min(p.a.length,p.b.length);
  for(let i=0;i<m;i++){ const x=p.a[i],y=p.b[i]; if(x==null||y==null) continue; const d=Math.abs(y-x); if(d<1e-9) continue; const y1=scaleY(x,lo,hi),y2=scaleY(y,lo,hi); deltaRects+='<rect class="delta" x="'+(X(i)-1).toFixed(1)+'" y="'+Math.min(y1,y2).toFixed(1)+'" width="2" height="'+Math.abs(y2-y1).toFixed(1)+'"/>'; }
  const bellsAt = (bells,cls) => bells.filter(b=>b.step<n).map(b=>'<line class="'+cls+'" x1="'+X(b.step).toFixed(1)+'" y1="'+(H-PADB)+'" x2="'+X(b.step).toFixed(1)+'" y2="'+(H-PADB+5)+'"><title>'+b.mineral+' @'+b.step+'</title></line>').join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
    '<line class="gridline" x1="'+PADL+'" y1="'+(H-PADB)+'" x2="'+(W-PADR)+'" y2="'+(H-PADB)+'"/>'+
    '<text x="2" y="'+(PADT+8)+'" fill="#777" font-size="10">'+hi.toFixed(1)+'</text>'+
    '<text x="2" y="'+(H-PADB)+'" fill="#777" font-size="10">'+lo.toFixed(1)+'</text>'+
    deltaRects+
    '<path class="lineA" d="'+pathOf(p.a)+'"/>'+
    '<path class="lineB" d="'+pathOf(p.b)+'"/>'+
    bellsAt(D.bellsA,'bellA')+bellsAt(D.bellsB,'bellB')+
    '</svg>';
}
const root=document.getElementById('panels');
for(const p of D.panels){ const el=document.createElement('div'); el.className='panel';
  el.innerHTML='<h2>'+p.id+'</h2><div class="meta">'+p.label+(p.units?' · '+p.units:'')+'</div>'+panelSvg(p);
  root.appendChild(el); }
const bt=document.getElementById('bellrows');
if(!D.bellRows.length){ bt.innerHTML='<tr><td>suite unchanged</td></tr>'; }
for(const r of D.bellRows){ const cls=r.delta>0?'gain':'loss'; const tr=document.createElement('tr');
  tr.innerHTML='<td>'+r.mineral+'</td><td>'+r.a+' → '+r.b+'</td><td class="'+cls+'">'+(r.delta>0?'+':'')+r.delta+'</td>';
  bt.appendChild(tr); }
</script></body></html>`;
  // Default into a gitignored scratch dir so an ad-hoc overlay can never
  // accidentally land in a commit (the COMMITTED record is archive/strips/).
  let out = outPath;
  if (!out) {
    const scratch = path.join(ROOT, '.strip-diffs');
    if (!fs.existsSync(scratch)) fs.mkdirSync(scratch, { recursive: true });
    out = path.join(scratch, `${scenario}-${vtag(vA)}-${vtag(vB)}.html`);
  }
  fs.writeFileSync(out, html);
  console.log(`[strip-diff] wrote ${path.relative(ROOT, out)} (${payload.panels.length} chip panels, ${bd.rows.length} bell rows)`);
}

// ---- dispatch ---------------------------------------------------------------
if (flags.all) {
  const [vA, vB] = pos;
  if (!vA || !vB) { console.error('usage: strip-archive-diff <vA> <vB> --all'); process.exit(1); }
  reportAll(vA, vB);
} else {
  const [vA, vB, scenario] = pos;
  if (!vA || !vB || !scenario) {
    console.error('usage: strip-archive-diff <vA> <vB> <scenario> [--chip ID] [--html [out]]');
    process.exit(1);
  }
  if (flags.html) emitHtml(vA, vB, scenario, flags.htmlOut);
  else if (flags.chip) reportChip(vA, vB, scenario, flags.chip);
  else reportScenario(vA, vB, scenario);
}
