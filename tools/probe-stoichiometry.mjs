// tools/probe-stoichiometry.mjs — automated stoichiometry cascade probe.
//
// Adds ONE mineral's stoichiometry, rebuilds, regenerates baseline,
// diffs against the saved pristine baseline, prints a concise drift
// summary, then restores the source file.
//
// Usage: node tools/probe-stoichiometry.mjs <mineral_name> "{ stoichiometry json }" [pristine_path]
//
// Example: node tools/probe-stoichiometry.mjs willemite '{"Zn":2,"SiO2":1}'
//
// Designed for the v125+ cascade-probe arc. SIM_VERSION is left at
// whatever it currently is — gen-baseline writes seed42_v<N>.json
// which is what we diff against the pristine snapshot.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STOICH_FILE = path.join(ROOT, 'js', '19-mineral-stoichiometry.ts');
const VERSION_FILE = path.join(ROOT, 'js', '15-version.ts');

function readSimVersion() {
  const src = fs.readFileSync(VERSION_FILE, 'utf8');
  const m = src.match(/^const SIM_VERSION = (\d+);/m);
  return Number(m[1]);
}

function loadBaseline(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function diff(a, b) {
  let driftCount = 0;
  let breakCount = 0;
  const perScenario = {};
  for (const scen of Object.keys(a)) {
    const da = a[scen], db = b[scen];
    if (!db) continue;
    const minerals = new Set([...Object.keys(da), ...Object.keys(db)]);
    const diffs = [];
    for (const m of minerals) {
      const ea = da[m], eb = db[m];
      if (!ea && eb) { diffs.push('+' + m); breakCount++; }
      else if (ea && !eb) { diffs.push('-' + m); breakCount++; }
      else {
        const ctChange = ea.total !== eb.total;
        if (ctChange) { diffs.push(`${m}{tot:${ea.total}→${eb.total}}`); breakCount++; }
        else if (ea.max_um !== eb.max_um) {
          diffs.push(`${m}{Δmax:${ea.max_um}→${eb.max_um}}`);
        }
      }
    }
    if (diffs.length) {
      driftCount++;
      perScenario[scen] = diffs;
    }
  }
  return { driftCount, breakCount, perScenario };
}

function main() {
  const mineral = process.argv[2];
  const stoichJson = process.argv[3];
  const pristinePath = process.argv[4] || path.join(process.env.TEMP || '/tmp', 'v125_pristine.json');
  if (!mineral || !stoichJson) {
    console.error('Usage: node tools/probe-stoichiometry.mjs <mineral> "{stoich}" [pristine_path]');
    process.exit(1);
  }
  const stoich = JSON.parse(stoichJson);
  const stoichStr = Object.entries(stoich).map(([k, v]) => `${k}: ${v}`).join(', ');
  const insertLine = `  ${mineral}: { ${stoichStr} },  // probe ${new Date().toISOString().slice(0, 10)}`;

  // Read original file
  const originalSrc = fs.readFileSync(STOICH_FILE, 'utf8');

  // Insert the line just before the closing `};` of MINERAL_STOICHIOMETRY.
  // Pattern: the closing brace of MINERAL_STOICHIOMETRY is the `};` that
  // appears immediately before the comment block "// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1e".
  // CRLF on Windows — detect newline style from file
  const nl = originalSrc.includes('\r\n') ? '\r\n' : '\n';
  const marker = `wolframite:     { Fe: 0.5, Mn: 0.5, W: 1 },        // (Fe,Mn)WO4 — solid-solution mid-range${nl}};`;
  if (!originalSrc.includes(marker)) {
    console.error('ERROR: could not find MINERAL_STOICHIOMETRY closing marker');
    process.exit(2);
  }
  // Insert the new line as the last entry before the closing `};`.
  // Splice insertLine just before the `};` portion of marker.
  const newSrc = originalSrc.replace(marker, marker.replace(`${nl}};`, `${nl}${insertLine}${nl}};`));
  fs.writeFileSync(STOICH_FILE, newSrc);

  try {
    console.log(`[probe-${mineral}] building...`);
    execSync('npm run build', { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`[probe-${mineral}] generating baseline...`);
    execSync('node tools/gen-js-baseline.mjs', { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });

    const version = readSimVersion();
    const baselinePath = path.join(ROOT, 'tests-js', 'baselines', `seed42_v${version}.json`);
    const pristine = loadBaseline(pristinePath);
    const probed = loadBaseline(baselinePath);

    const result = diff(pristine, probed);
    console.log(`\n=== ${mineral.toUpperCase()} PROBE { ${stoichStr} } ===`);
    console.log(`Verdict: ${result.breakCount > 0 ? 'CASCADE' : (result.driftCount > 0 ? 'CLEAN (max_um drift only)' : 'NO_DRIFT')}`);
    console.log(`Drift: ${result.driftCount} of ${Object.keys(pristine).length} scenarios; break count: ${result.breakCount}`);
    for (const [scen, diffs] of Object.entries(result.perScenario)) {
      console.log(`  ${scen}: ${diffs.join('; ')}`);
    }
  } catch (e) {
    console.error(`[probe-${mineral}] ERROR:`, e.message);
  } finally {
    // Always restore the source file
    fs.writeFileSync(STOICH_FILE, originalSrc);
    console.log(`[probe-${mineral}] restored ${path.basename(STOICH_FILE)}`);
  }
}

main();
