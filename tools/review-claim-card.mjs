#!/usr/bin/env node
/**
 * tools/review-claim-card.mjs — distill a scenario into an adversarial-review CARD.
 *
 * The hostile review (2026-07-14) asks of every canonical seed-42 vugg: "would a
 * geologist believe this crystal's biography?" To ask that cheaply, this tool
 * fuses two sources into one compact card per scenario:
 *
 *   1. the scenario DEFINITION (data/scenarios.json5 via the harness) — the CLAIM:
 *      anchor locality, deposit-type description, expects_species, cited sources,
 *      initial T/P/fluid.
 *   2. the canonical STRIP (archive/strips/v<N>/<scenario>.json) — the TESTIMONY:
 *      the actual nucleation sequence (paragenetic order) + environment trajectory.
 *
 * The card surfaces the adversarial hooks: the paragenetic order as the sim
 * actually grew it, species present that expects_species never named (surprises),
 * expected species that never nucleated (no-shows), and the T/pH/Eh/salinity arc.
 * A mineralogist reads the card and challenges; they never need the 175 KB strip.
 *
 * This is a passive READ instrument — it never touches sim output. Not part of the
 * rebake ritual; run on demand during a review.
 *
 * Usage:
 *   node tools/review-claim-card.mjs <scenario> [--version N] [--json]
 *   node tools/review-claim-card.mjs --all [--version N] [--out DIR]
 *   node tools/review-claim-card.mjs --help
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function latestStripVersion() {
  const dir = path.join(ROOT, 'archive', 'strips');
  const vs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
    .map((d) => parseInt(d.name.slice(1), 10))
    .sort((a, b) => a - b);
  return vs[vs.length - 1];
}

function seriesStats(chip) {
  if (!chip || !Array.isArray(chip.wall) || !chip.wall.length) return null;
  const w = chip.wall.filter((x) => typeof x === 'number');
  if (!w.length) return null;
  const first = w[0], last = w[w.length - 1];
  let min = Infinity, max = -Infinity;
  for (const x of w) { if (x < min) min = x; if (x > max) max = x; }
  return { first, last, min, max, units: chip.units || '' };
}

/** Group nucleation events into first-appearance order — the paragenetic sequence. */
function paragenesis(strip) {
  const firstStep = new Map();     // mineral -> first step it nucleated
  const count = new Map();          // mineral -> # of nucleation events
  for (const ev of strip.nucleation_events || []) {
    if (!firstStep.has(ev.mineral) || ev.step < firstStep.get(ev.mineral)) firstStep.set(ev.mineral, ev.step);
    count.set(ev.mineral, (count.get(ev.mineral) || 0) + 1);
  }
  const order = [...firstStep.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([mineral, step]) => ({ mineral, first_step: step, events: count.get(mineral) }));
  return order;
}

function buildCard(name, spec, strip, version) {
  const para = paragenesis(strip);
  const present = new Set(para.map((p) => p.mineral));
  const expects = spec.expects_species || [];
  const surprises = para.filter((p) => !expects.includes(p.mineral)).map((p) => p.mineral);
  const noShows = expects.filter((m) => !present.has(m));

  const env = {};
  for (const k of ['T', 'pH', 'Eh', 'salinity', 'O2', 'concentration']) {
    const st = seriesStats(strip.chips[k]);
    if (st) env[k] = st;
  }
  // saturation drivers present in this scenario's chip set
  const si = {};
  for (const k of Object.keys(strip.chips)) {
    if (k.startsWith('SI_')) { const st = seriesStats(strip.chips[k]); if (st) si[k] = st; }
  }

  return {
    scenario: name,
    sim_version: version,
    strip_steps: strip.steps,
    claim: {
      anchor: spec.anchor || null,
      description: spec.description || null,
      expects_species: expects,
      sources: spec.sources || [],
      initial_temperature_C: spec.initial?.temperature_C ?? null,
      initial_pressure_kbar: spec.initial?.pressure_kbar ?? null,
      wall_architecture: spec.initial?.wall?.architecture ?? null,
      notes: spec.notes || [],
    },
    testimony: {
      species_count: present.size,
      paragenetic_order: para,
      surprises_not_in_expects: surprises,
      expected_no_shows: noShows,
      environment: env,
      saturation_indices: si,
    },
  };
}

function renderMarkdown(card) {
  const c = card.claim, t = card.testimony;
  const L = [];
  L.push(`# CLAIM CARD — ${card.scenario}  (v${card.sim_version}, seed 42, ${card.strip_steps} steps)`);
  L.push('');
  L.push(`**Anchor:** ${c.anchor || '(none)'}`);
  L.push(`**Deposit:** ${c.description || '(none)'}`);
  L.push(`**Initial:** ${c.initial_temperature_C ?? '?'} °C, ${c.initial_pressure_kbar ?? '?'} kbar, wall=${c.wall_architecture || '?'}`);
  L.push('');
  L.push(`**expects_species (${c.expects_species.length}):** ${c.expects_species.join(', ') || '(none declared)'}`);
  L.push('');
  L.push(`**Cited sources:**`);
  for (const s of c.sources) L.push(`  - ${s}`);
  if (!c.sources.length) L.push('  - (none)');
  L.push('');
  L.push(`## Paragenetic order as grown (${t.species_count} species)`);
  L.push('| # | mineral | first step | # events |');
  L.push('|--|--|--|--|');
  t.paragenetic_order.forEach((p, i) => L.push(`| ${i + 1} | ${p.mineral} | ${p.first_step} | ${p.events} |`));
  L.push('');
  L.push(`**Surprises (grown but NOT in expects_species):** ${t.surprises_not_in_expects.join(', ') || '(none)'}`);
  L.push(`**No-shows (expected but never nucleated):** ${t.expected_no_shows.join(', ') || '(none)'}`);
  L.push('');
  L.push(`## Environment trajectory (first → last, [min,max])`);
  for (const [k, v] of Object.entries(t.environment)) {
    L.push(`  - ${k}: ${v.first} → ${v.last} ${v.units}  [${v.min}, ${v.max}]`);
  }
  L.push('');
  L.push(`## Saturation drivers`);
  for (const [k, v] of Object.entries(t.saturation_indices)) {
    L.push(`  - ${k}: ${v.first} → ${v.last}  [${v.min}, ${v.max}]`);
  }
  L.push('');
  L.push(`## Scenario notes (author's own rationale)`);
  for (const n of c.notes) L.push(`> ${n}\n`);
  return L.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.length === 0) {
    console.log('node tools/review-claim-card.mjs <scenario> [--version N] [--json]');
    console.log('node tools/review-claim-card.mjs --all [--version N] [--out DIR]');
    return;
  }
  const all = argv.includes('--all');
  const asJson = argv.includes('--json');
  const vIdx = argv.indexOf('--version');
  const version = vIdx >= 0 ? parseInt(argv[vIdx + 1], 10) : latestStripVersion();
  const oIdx = argv.indexOf('--out');
  const outDir = oIdx >= 0 ? argv[oIdx + 1] : null;
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] === '--version') && !(argv[i - 1] === '--out'));

  const h = await import(pathToFileURL(path.join(ROOT, 'tools', '_harness.mjs')).href);
  const { SCENARIOS } = await h.loadSimBundle({ toolName: 'review-claim-card' });
  const stripDir = path.join(ROOT, 'archive', 'strips', `v${version}`);

  const names = all
    ? fs.readdirSync(stripDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort()
    : positional;

  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  for (const name of names) {
    const spec = SCENARIOS[name]?._json5_spec;
    const stripPath = path.join(stripDir, `${name}.json`);
    if (!spec) { console.error(`[card] no scenario def for ${name}`); continue; }
    if (!fs.existsSync(stripPath)) { console.error(`[card] no strip v${version} for ${name}`); continue; }
    const strip = JSON.parse(fs.readFileSync(stripPath, 'utf8'));
    const card = buildCard(name, spec, strip, version);
    if (outDir) {
      fs.writeFileSync(path.join(outDir, `${name}.md`), renderMarkdown(card) + '\n');
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(card, null, 2) + '\n');
    } else if (asJson) {
      console.log(JSON.stringify(card, null, 2));
    } else {
      console.log(renderMarkdown(card));
      if (names.length > 1) console.log('\n' + '='.repeat(80) + '\n');
    }
  }
  if (outDir) console.log(`[card] wrote ${names.length} cards → ${path.relative(ROOT, outDir)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
