#!/usr/bin/env node
// tools/morph-fidelity-audit.mjs — crystal-shape fidelity audit (specimen-debt arc, 2026-06-23).
//
// THE BUG CLASS this finds: the 3D renderer's default habit token is 'prism', and
// _buildHabitGeom('prism') → _makeHexPrismWithPyramid() (a HEXAGONAL prism); 'spike' →
// _makeHexPyramid() (hexagonal). So EVERY mineral whose habit resolves to prism/spike and
// isn't otherwise special-cased renders with a HEXAGONAL cross-section — correct only for
// hexagonal/trigonal minerals. Tetragonal / orthorhombic / monoclinic / triclinic prismatic
// minerals are silently mis-shaped (tourmaline + hemimorphite were the first two caught + fixed).
//
// This tool ports the renderer's habit->token resolver (js/99i _habitGeomToken, read 2026-06-23)
// and joins it against each mineral's crystal SYSTEM (data/structural.json `system`, else parsed
// from the minerals.json description). It flags every mineral that renders hexagonal (prism/spike)
// but whose system forbids a hexagonal cross-section. Deterministic — no network, no model, no
// fabrication. Run: `node tools/morph-fidelity-audit.mjs`  (add --all to dump every mineral).
//
// NOT a gate (passive instrument — see feedback_passive_instrument_not_gate): it reports, never
// exit-1s on findings.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const minerals = JSON.parse(readFileSync(join(ROOT, 'data/minerals.json'), 'utf8')).minerals;
const structural = JSON.parse(readFileSync(join(ROOT, 'data/structural.json'), 'utf8'));

// --- port of js/99i _habitGeomToken (habit string -> geometry token) ---------------------------
function habitToken(habitRaw) {
  const h = String(habitRaw || '').toLowerCase();
  if (h.startsWith('dendritic_')) return 'spike';
  if (h.includes('rhombic dodec') || h.includes('rhombic-dodec') || h === 'garnet' || h === 'trapezohedral') return 'rhombic_dodec';
  if (h === 'dodecahedral' || h === 'dodecahedron') return 'dodecahedron';
  if (h === 'cubic' || h === 'cuboid' || h === 'cube') return 'cube';
  if (h === 'stepped_cube' || h === 'hopper_cube' || h === 'hopper_growth') return 'cube';
  if (h === 'striated_cubic') return 'cube';
  if (h.includes('pyritohedral')) return 'dodecahedron';
  if (h.includes('octahedral_ree')) return 'octahedron';
  if (h === 'octahedral' || h === 'octahedron') return 'octahedron';
  if (h.includes('rhombohedral')) return 'rhomb';
  if (h.includes('scalenohedral')) return 'scalene';
  if (h.includes('chalcedony')) return 'botryoidal';
  if (h.includes('botryoidal') || h.includes('reniform') || h.includes('mammillary') || h.includes('globular')) return 'botryoidal';
  if (h.includes('banded') || h === 'massive' || h.includes('massive')) return 'botryoidal';
  if (h.includes('tabular') || h === 'platy' || h === 'foliated' || h.includes('blade')) return 'tablet';
  if (h.includes('acicular') || h.includes('capillary') || h.includes('fibrous') || h.includes('satin')) return 'spike';
  if (h.includes('dendritic') || h.includes('arborescent')) return 'spike';
  if (h.includes('plumose')) return 'spike';
  if (h.includes('radiating')) return h.includes('columnar') ? 'prism' : 'spike';
  if (h === 'prismatic' || h === 'columnar' || h === 'bladed') return 'prism';
  return 'prism'; // default
}

// minerals with a mineral-NAME render dispatch that escapes the generic hex prism/pyramid
// (so a prism/spike token does NOT mean a hex render for them). Keep in sync with js/99i.
const SPECIAL_RENDER = new Set([
  'tourmaline',    // _makeSectorZonedPrism — now ditrigonal (2026-06-23)
  'hemimorphite',  // _makeHemimorphiteFan — fan/sheaf (2026-06-23)
  'aragonite',     // air-mode frostwork / pseudohex twin paths
  'quartz',        // sceptre/gwindel/Tessin special builders
]);
// the genuinely hexagonal/trigonal polar tenants render via _makeHemimorphicPrism (hex) — CORRECT.
const HEX_OK_POLAR = new Set(['greenockite', 'wurtzite']);

const HEX_SYSTEMS = new Set(['hexagonal', 'trigonal', 'rhombohedral']);
const NONHEX = new Set(['tetragonal', 'orthorhombic', 'monoclinic', 'triclinic']);

function systemOf(name, spec) {
  const s = structural[name];
  if (s && s.system) return { system: s.system.toLowerCase(), src: 'structural.json' };
  // parse from description
  const d = String(spec.description || '').toLowerCase();
  for (const sys of ['triclinic', 'monoclinic', 'orthorhombic', 'tetragonal', 'trigonal', 'hexagonal', 'cubic', 'isometric', 'rhombohedral']) {
    // avoid "pseudo-hexagonal" / "pseudo-orthorhombic" giving a false primary
    const re = new RegExp('(?<!pseudo[- ])' + sys, 'i');
    if (re.test(d)) return { system: sys === 'isometric' ? 'cubic' : sys, src: 'description' };
  }
  return { system: 'UNKNOWN', src: 'none' };
}

const rows = [];
for (const [name, spec] of Object.entries(minerals)) {
  if (spec._transformation_only) continue;
  const habit = spec.habit || (spec.habit_variants && spec.habit_variants[0] && spec.habit_variants[0].name) || '';
  const token = habitToken(habit);
  const { system, src } = systemOf(name, spec);
  const hexRender = (token === 'prism' || token === 'spike') && !SPECIAL_RENDER.has(name);
  rows.push({ name, habit, token, system, src, hexRender });
}

const all = process.argv.includes('--all');
const flagged = rows.filter(r => r.hexRender && NONHEX.has(r.system));
const unknown = rows.filter(r => r.hexRender && r.system === 'UNKNOWN');
const cubicPrism = rows.filter(r => r.hexRender && r.system === 'cubic');
const okHex = rows.filter(r => r.hexRender && HEX_SYSTEMS.has(r.system));

if (process.argv.includes('--systemmap')) {
  // emit { mineral: system } for every structural.json mineral whose system is non-hexagonal
  // (tetragonal/orthorhombic/monoclinic/triclinic) — the citation-backed data that drives the
  // renderer's system-aware prism cross-section. Hex/trigonal/cubic are omitted (hex prism is
  // correct for hex/trig; cubic isn't prismatic). Reproducible feed for the CRYSTAL_SYSTEM const.
  const map = {};
  for (const [name, s] of Object.entries(structural)) {
    if (!s || !s.system) continue;
    const sys = String(s.system).toLowerCase();
    if (NONHEX.has(sys)) map[name] = sys;
  }
  process.stdout.write(JSON.stringify(map, Object.keys(map).sort(), 2));
  process.exit(0);
}

if (process.argv.includes('--json')) {
  // machine-readable feed for the fidelity-fix workflow: every hex-rendered mineral whose system
  // is non-hex / cubic / unknown (the candidate mis-shaped set). prism = chunky (cross-section
  // reads); spike = needle (cross-section ~invisible → lower visual priority).
  const out = [...flagged, ...cubicPrism, ...unknown].map(r => ({
    mineral: r.name, declaredSystem: r.system, systemSrc: r.src, token: r.token, habit: r.habit,
  }));
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
function table(list) {
  for (const r of list.sort((a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name))) {
    console.log('  ' + pad(r.name, 22) + pad(r.system, 14) + pad(r.token, 8) + pad(r.src, 14) + r.habit);
  }
}

console.log(`\n=== MORPH FIDELITY AUDIT — ${rows.length} minerals ===`);
console.log(`hex-rendered (prism/spike, not special-cased): ${rows.filter(r => r.hexRender).length}`);
console.log(`  of which hexagonal/trigonal system (CORRECT): ${okHex.length}`);
console.log(`  of which special-name-dispatched (excluded):  ${[...SPECIAL_RENDER].length}`);

console.log(`\n### MIS-SHAPED — non-hex system rendered HEXAGONAL (${flagged.length}) ###`);
console.log('  ' + pad('mineral', 22) + pad('system', 14) + pad('token', 8) + pad('sys-src', 14) + 'habit');
table(flagged);

console.log(`\n### CUBIC rendered as prism/spike (odd — usually cube/octahedron habit) (${cubicPrism.length}) ###`);
table(cubicPrism);

console.log(`\n### crystal system UNKNOWN + hex-rendered — need sourcing (${unknown.length}) ###`);
table(unknown);

if (all) {
  console.log(`\n### ALL minerals ###`);
  table(rows);
}
console.log('');
