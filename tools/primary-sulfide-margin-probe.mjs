#!/usr/bin/env node
// tools/primary-sulfide-margin-probe.mjs — the companion to the sulfide-Eh
// census (rung-4b). For the DEFENDED + offender scenarios, list every PRIMARY
// base-metal sulfide nucleation (the six gated by js/20c PRIMARY_SULFIDE_CEILING_O2:
// sphalerite/wurtzite/pyrite/marcasite/chalcopyrite/galena) with its birth-step
// Eh. Confirms mvt/tn457/elmwood's barite-boundary sulfides sit with margin
// BELOW the +100 mV ceiling (mvt +50, tn457 +76, elmwood +24 — all kept), and
// that the only primary sulfides above +100 are the supergene_oxidation leaks
// (sphalerite +290, galena +131). The margin check behind the ceiling number.
//
// Usage: node tools/primary-sulfide-margin-probe.mjs [ceilingMv]   (default 100)
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed } = await h.loadSimBundle({ toolName: 'prim-marg' });
const PRIMARY = new Set(['sphalerite','wurtzite','pyrite','marcasite','chalcopyrite','galena']);
const SCEN = ['mvt','tn457_barite_pulses','elmwood','supergene_oxidation','bisbee','roughten_gill'];
const CEIL = Number(process.argv[2]) || 100; // primary ceiling mV
for (const name of SCEN) {
  if (!SCENARIOS[name]) { console.log(`\n## ${name}  (NOT FOUND)`); continue; }
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  const eh = [];
  for (let i = 0; i < steps; i++) { sim.run_step(); eh.push(sim.conditions.fluid.Eh); }
  const rows = [];
  for (const c of sim.crystals) {
    if (!PRIMARY.has(c.mineral)) continue;
    const st = Math.min(c.nucleation_step ?? 0, eh.length - 1);
    rows.push({ m: c.mineral, step: c.nucleation_step, E: eh[st] });
  }
  rows.sort((a,b)=>b.E-a.E);
  const above = rows.filter(r=>r.E>CEIL).length;
  console.log(`\n## ${name}  — ${rows.length} primary-sulfide nucleations, ${above} above +${CEIL}mV`);
  for (const r of rows) {
    const flag = r.E > CEIL ? '  <-- KILLED (above ceiling)' : (r.E > CEIL-30 ? '  <- within 30mV of ceiling' : '');
    console.log(`   ${r.m.padEnd(13)} step ${String(r.step).padStart(3)}  Eh ${String(r.E.toFixed(0)).padStart(5)}${flag}`);
  }
}
