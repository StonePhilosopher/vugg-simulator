// tools/d1b-units-probe.mjs — D1b (chemistry-gated body colour) UNITS-RECONCILIATION
// sub-probe. The pre-registered gate on D1b (roadmap D1 row / the D1a addendum).
// Commits nothing. Run: node tools/d1b-units-probe.mjs
//
// THE QUESTION
// -----------
// D1a resolved color_rules DEFAULTS. D1b wants the CHEMISTRY-GATED variants
// (sphalerite pale_yellow/honey_brown/black_marmatite by Fe; quartz smoky/morion
// by radiation; smithsonite blue_green by Cu). But the triggers are authored in
// GEOCHEMICAL prose — "Fe 2-10", "Fe>15" read like mol% substitution, while the
// sim's trace_Fe is PPM (js/27 describe_latest_zone: "traces: … ppm"; fleet q90
// Fe≈3.6). If a trigger's threshold is never reached, wiring it ships a dead axis.
// And many triggers name fields the sim DOESN'T carry (Y/Sm/Li/Cr/V/Cd/Zn/Mg).
//
// So, per parseable trigger, measure against the actual fleet:
//   (a) FIELD EXISTS? zone traces {Fe,Mn,Al,Ti,Pb,Au,Cu} + crystal {radiation_damage}
//       — everything else has no data to read.
//   (b) THRESHOLD REACHED? growth-weighted per-crystal value (as the render reads),
//       what fraction of that species' crystals satisfy the trigger.
// Verdict per variant: LIVE (fires enough to matter) / RARE / DEAD-unreached /
// DEAD-no-field. That is D1b's honest scope.

import { readFileSync } from 'fs';
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'd1b-units-probe' });
const SPEC = JSON.parse(readFileSync(new URL('../data/minerals.json', import.meta.url), 'utf8')).minerals;
const SEED = 42;

// the fields the sim actually carries
const ZONE_FIELDS = { Fe: 'trace_Fe', Mn: 'trace_Mn', Al: 'trace_Al', Ti: 'trace_Ti', Pb: 'trace_Pb', Au: 'trace_Au', Cu: 'trace_Cu' };
const CRYSTAL_FIELDS = { radiation_damage: 'radiation_damage', radiation: 'radiation_damage' };

// growth-weighted zone trace (how the renderer would read the crystal's chemistry), or crystal field
function fieldVal(c, field) {
  if (CRYSTAL_FIELDS[field]) return c[CRYSTAL_FIELDS[field]] || 0;
  const zf = ZONE_FIELDS[field];
  if (!zf) return null; // field does not exist in the sim
  let acc = 0, G = 0;
  for (const z of (c.zones || [])) { const w = z.thickness_um; if (!(w > 0)) continue; acc += (z[zf] || 0) * w; G += w; }
  return G > 0 ? acc / G : 0;
}

// parse a trigger string -> { clauses:[{field, kind:'cmp'|'range', op?, a, b?}], fields:[] } or null (prose)
function parseTrigger(raw) {
  const t = String(raw || '').replace(/–/g, '-'); // normalize en-dash
  const clauses = [];
  for (let part of t.split(/\band\b/i)) {
    part = part.trim();
    let m = part.match(/\b([A-Za-z_]+)\s*(>=|<=|>|<|=)\s*([\d.]+)/); // field op num
    if (m) { clauses.push({ field: m[1], kind: 'cmp', op: m[2], a: parseFloat(m[3]) }); continue; }
    m = part.match(/\b([A-Za-z_]+)\s+([\d.]+)\s*-\s*([\d.]+)/); // "Fe 2-10" range
    if (m) { clauses.push({ field: m[1], kind: 'range', a: parseFloat(m[2]), b: parseFloat(m[3]) }); continue; }
    // clause with no numeric comparison -> prose, not machine-evaluable
  }
  if (!clauses.length) return null;
  return { clauses, fields: [...new Set(clauses.map(c => c.field))] };
}
function evalClause(c, cl) {
  const v = fieldVal(c, cl.field);
  if (v === null) return null; // missing field
  if (cl.kind === 'range') return v >= cl.a && v <= cl.b;
  switch (cl.op) { case '>': return v > cl.a; case '<': return v < cl.a; case '>=': return v >= cl.a; case '<=': return v <= cl.a; case '=': return v === cl.a; }
  return false;
}
function evalTrigger(c, parsed) {
  let all = true;
  for (const cl of parsed.clauses) { const r = evalClause(c, cl); if (r === null) return null; all = all && r; }
  return all;
}

// --- run the fleet, collect crystals per species ---
const bySpecies = new Map(); // mineral -> [crystals]
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 120); i++) sim.run_step();
  for (const c of sim.crystals) {
    if (!c || c.dissolved) continue;
    if (!bySpecies.has(c.mineral)) bySpecies.set(c.mineral, []);
    bySpecies.get(c.mineral).push(c);
  }
}

// --- for each species' non-default triggers, classify ---
const rows = [];
const missingFields = new Map(); // field -> count of variants needing it
for (const m of Object.keys(SPEC)) {
  const cr = SPEC[m].color_rules || {};
  const crystals = bySpecies.get(m) || [];
  for (const variant of Object.keys(cr)) {
    const rule = cr[variant] || {};
    if (rule.default === true) continue;
    const parsed = parseTrigger(rule.trigger);
    if (!parsed) continue; // prose trigger
    const badFields = parsed.fields.filter(f => !ZONE_FIELDS[f] && !CRYSTAL_FIELDS[f]);
    if (badFields.length) { rows.push({ m, variant, verdict: 'DEAD-no-field', detail: `needs ${badFields.join('/')}`, n: crystals.length }); badFields.forEach(f => missingFields.set(f, (missingFields.get(f) || 0) + 1)); continue; }
    // field exists — measure reachability across this species' fleet crystals
    let hit = 0, tot = 0, maxV = 0;
    for (const c of crystals) {
      const r = evalTrigger(c, parsed); if (r === null) continue;
      tot++; if (r) hit++;
      for (const f of parsed.fields) { const v = fieldVal(c, f); if (v != null && v > maxV) maxV = v; }
    }
    const frac = tot ? hit / tot : 0;
    let verdict;
    if (tot === 0) verdict = 'NO-FLEET (species absent/blank at seed42)';
    else if (hit === 0) verdict = 'DEAD-unreached';
    else if (frac < 0.05) verdict = 'RARE';
    else verdict = 'LIVE';
    rows.push({ m, variant, verdict, detail: `${hit}/${tot} cross (${(100 * frac).toFixed(0)}%), fleet-max ${maxV.toFixed(2)}`, trigger: rule.trigger, n: crystals.length });
  }
}

// --- report ---
const order = { LIVE: 0, RARE: 1, 'DEAD-unreached': 2, 'DEAD-no-field': 3 };
rows.sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9) || a.m.localeCompare(b.m));
console.log('\n=== D1b UNITS-RECONCILIATION PROBE (seed 42) ===');
console.log('fields the sim carries: zone', Object.keys(ZONE_FIELDS).join('/'), '| crystal radiation_damage');
const tally = {};
for (const r of rows) tally[r.verdict.split(' ')[0]] = (tally[r.verdict.split(' ')[0]] || 0) + 1;
console.log('verdict tally:', JSON.stringify(tally), '\n');
console.log('verdict         species          variant                     detail');
console.log('--------------- ---------------- --------------------------- --------------------------------');
for (const r of rows) {
  console.log(`${r.verdict.padEnd(15)} ${r.m.slice(0, 16).padEnd(16)} ${r.variant.slice(0, 27).padEnd(27)} ${r.detail}${r.trigger ? `  [${r.trigger}]` : ''}`);
}
console.log('\nMISSING FIELDS (variants needing a chem field the sim does not carry):');
for (const [f, n] of [...missingFields.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${f}: ${n} variants`);
console.log('\n=> D1b scope = the LIVE (and worth-it RARE) rows. DEAD-unreached may want a THRESHOLD RESCALE to the sim\'s ppm range; DEAD-no-field is deferred (needs a new sim trace field) or dropped.\n');
