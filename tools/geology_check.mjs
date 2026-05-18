#!/usr/bin/env node
/**
 * tools/geology_check.mjs — scenario-vs-real-paragenesis sanity audit.
 *
 * For a chosen scenario, run a 10-seed sweep and report per-mineral:
 *   * seeds-firing (of 10)
 *   * total crystals across the sweep
 *   * average crystal size (µm)
 *
 * Compare those to what literature says SHOULD be present. The boss's
 * "follow nature" framing — if a deposit class has 5 elements defining
 * it (e.g. Schneeberg's BiCoNiAgAs five-element formation) and one of
 * the canonical paragenesis members never fires, the broth is missing
 * a variable. Use this tool BEFORE chasing engine retunes.
 *
 * Born from the 2026-05-18 Path C cascade-gate audit, when Arc 2's
 * native_arsenic + native_bismuth softening surfaced that the broader
 * Bi-Co-Ni-Ag five-element-vein assemblage was still mostly dormant
 * because Schneeberg's broth was missing Co, Ni, AND Ag entirely.
 *
 * Companion to tools/mineral_coverage_check.mjs (system-wide live/dead)
 * and tools/stale_mineral_probe.mjs (per-mineral σ trace). Same harness.
 *
 * Configure the tracked mineral set + scenario at the top of the script.
 * Usage: `node tools/geology_check.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
const ROOT = process.cwd();
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.fetch = async (url) => {
  let rel = String(url);
  if (rel.startsWith('./')) rel = rel.slice(2);
  if (rel.startsWith('/')) rel = rel.slice(1);
  try { return new Response(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { status: 200, headers: { 'content-type': 'text/plain' }}); }
  catch { return new Response('', { status: 404 }); }
};
const realGetById = document.getElementById.bind(document);
const stub = () => new Proxy(function () { return stub(); }, { get(t,p){ if(p in t) return t[p]; if(typeof p === 'string' && /^[a-z]/i.test(p)) return stub(); return undefined; }, set(t,p,v){ t[p]=v; return true; }});
document.getElementById = (id) => realGetById(id) || stub();
document.querySelector = () => stub();
document.querySelectorAll = () => [];
function walk(dir){ const out=[]; const s=[dir]; while(s.length){ const d=s.pop(); let es; try{es=fs.readdirSync(d).sort();}catch{continue;} for(const n of es){if(n.startsWith('.'))continue; const p=path.join(d,n); const st=fs.statSync(p); if(st.isDirectory())s.push(p); else if(n.endsWith('.js'))out.push(p);}} return out;}
const files = walk(path.join(ROOT, 'dist'));
const concat = files.map(f=>fs.readFileSync(f,'utf8')).join('\n\n');
const epilogue = 'function setSeed(seed){ rng = new SeededRandom(seed|0); }';
const exportNames = ['SCENARIOS','VugSimulator','setSeed','SIM_VERSION'];
const fn = new Function(`${concat}\n${epilogue}\n;return { ${exportNames.map(n=>`${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',')} };`);
const exp = fn();
for(const k of exportNames) globalThis[k]=exp[k];
await new Promise(r=>setTimeout(r,200));

const seeds = [42, 1, 7, 13, 23, 99, 314, 1729, 8675309, 137];
const scenario = 'schneeberg';
const tracked = ['native_arsenic', 'native_bismuth', 'native_silver', 'bismuthinite', 'autunite', 'zeunerite', 'torbernite', 'uraninite', 'arsenopyrite', 'erythrite', 'annabergite', 'cobaltite', 'nickeline', 'acanthite', 'naumannite'];

const byMineral = Object.fromEntries(tracked.map(m => [m, { seeds: [], totalCrystals: 0, totalSize_um: 0 }]));
for (const seed of seeds) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[scenario]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 160); i++) sim.run_step();
  for (const m of tracked) {
    const crystals = sim.crystals.filter(c => c.mineral === m);
    if (crystals.length) {
      byMineral[m].seeds.push(seed);
      byMineral[m].totalCrystals += crystals.length;
      byMineral[m].totalSize_um += crystals.reduce((s,c)=>s + (c.total_growth_um||0), 0);
    }
  }
}

console.log(`SIM_VERSION ${SIM_VERSION} | scenario: ${scenario} | ${seeds.length} seeds × default steps\n`);
console.log('mineral             seeds-firing   total-crystals   avg-size-um');
console.log('-'.repeat(74));
for (const m of tracked) {
  const o = byMineral[m];
  const avg = o.totalCrystals ? (o.totalSize_um / o.totalCrystals).toFixed(1) : '—';
  console.log(`${m.padEnd(20)} ${String(o.seeds.length).padStart(2)}/${seeds.length}            ${String(o.totalCrystals).padStart(4)}             ${avg}`);
}
