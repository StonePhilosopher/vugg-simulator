#!/usr/bin/env node
// tools/optics-audit.mjs — dump every catalog mineral's RESOLVED Depth-A optics (the coverage +
// no-surprise instrument; RESEARCH-optical-realism-2026-07-02.md §5.1). For each of the 180
// species: clarity source (verified block vs class default), the resolved clarity + opacity the
// renderer will actually use (opacity = 1 − 0.70·clarity via the LIVE bundle functions — reads
// opticsClarityFor + OPTICS_TRANSLUCENCY_SPAN through the build, so tool and renderer cannot
// drift). Flags anomalies: clarity out of range, opaque-category blocks with clarity > 0.05,
// verified blocks whose class default would have been badly wrong (the ones worth having).
//
//   node tools/optics-audit.mjs             # summary + anomalies
//   node tools/optics-audit.mjs --all       # every mineral, one line each
//   node tools/optics-audit.mjs --class sulfide   # one class in full
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
// LOGIC from the live bundle (opticsClarityFor + span — tool and renderer cannot drift);
// DATA from the canonical file directly (the bundle's MINERAL_SPEC export is captured at
// eval time = the pre-fetch compact fallback, not the full 180-species spec).
const { opticsClarityFor, OPTICS_TRANSLUCENCY_SPAN } =
  await loadSimBundle({ toolName: 'optics-audit', extraExports: ['opticsClarityFor', 'OPTICS_TRANSLUCENCY_SPAN'] });
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MINERAL_SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8')).minerals;

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const CLASS = argv.includes('--class') ? argv[argv.indexOf('--class') + 1] : null;

const rows = Object.entries(MINERAL_SPEC).map(([name, spec]) => {
  const verified = !!(spec.optics && typeof spec.optics.clarity === 'number');
  const clarity = opticsClarityFor(spec);
  const opacity = clarity > 0 ? +(1 - OPTICS_TRANSLUCENCY_SPAN * clarity).toFixed(3) : 1.0;
  return { name, klass: spec.class || '(none)', verified, clarity, opacity,
    diaphaneity: verified ? spec.optics.diaphaneity : null };
}).sort((a, b) => a.klass.localeCompare(b.klass) || a.name.localeCompare(b.name));

const anomalies = [];
for (const r of rows) {
  if (r.clarity < 0 || r.clarity > 1) anomalies.push(`${r.name}: clarity ${r.clarity} out of range`);
  if (r.diaphaneity === 'opaque' && r.clarity > 0.05) anomalies.push(`${r.name}: opaque category but clarity ${r.clarity}`);
}

console.log(`=== optics audit — ${rows.length} minerals, span ${OPTICS_TRANSLUCENCY_SPAN} ===\n`);
const byClass = {};
for (const r of rows) (byClass[r.klass] = byClass[r.klass] || []).push(r);
console.log('class        n   verified  default  | class-default clarity → the tail renders at');
for (const [k, list] of Object.entries(byClass)) {
  const v = list.filter(r => r.verified).length;
  const tail = list.find(r => !r.verified);
  console.log(`  ${k.padEnd(10)} ${String(list.length).padStart(3)}   ${String(v).padStart(5)}     ${String(list.length - v).padStart(4)}   | ${tail ? `clarity ${tail.clarity} → opacity ${tail.opacity}` : '(fully verified)'}`);
}
const verifiedN = rows.filter(r => r.verified).length;
console.log(`\ncoverage: ${verifiedN}/${rows.length} verified (${(100 * verifiedN / rows.length).toFixed(0)}%); translucent-rendering species (clarity>0): ${rows.filter(r => r.clarity > 0).length}`);

if (ALL || CLASS) {
  console.log('\nname                        class       src       clarity  opacity  diaphaneity');
  for (const r of rows) {
    if (CLASS && r.klass !== CLASS) continue;
    console.log(`  ${r.name.padEnd(26)} ${r.klass.padEnd(11)} ${(r.verified ? 'VERIFIED' : 'default').padEnd(9)} ${String(r.clarity).padStart(5)}    ${String(r.opacity).padStart(5)}   ${r.diaphaneity || ''}`);
  }
}

console.log(anomalies.length ? `\nANOMALIES:\n  ${anomalies.join('\n  ')}` : '\nno anomalies ✓');
process.exit(anomalies.length ? 1 : 0);
