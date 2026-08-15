#!/usr/bin/env node
/**
 * Verify the checked-in thermodynamic pressure artifact without invoking a
 * second runtime. The browser TypeScript engine and Node test/audit toolchain
 * are the only supported executable implementations in this repository.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifactPath = path.join(ROOT, 'data', 'generated', 'thermo-pressure-grid.json');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(
    key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
  ).join(',')}}`;
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const digest = crypto.createHash('sha256').update(canonicalJson(artifact.payload)).digest('hex');
const { THERMO_PRESSURE_GRID_DATA_SHA256, THERMO_PRESSURE_GRID } = await loadSimBundle({
  toolName: 'check-pressure-grid',
  extraExports: ['THERMO_PRESSURE_GRID_DATA_SHA256', 'THERMO_PRESSURE_GRID'],
});

const failures = [];
if (digest !== artifact.data_sha256) failures.push('JSON payload digest mismatch');
if (THERMO_PRESSURE_GRID_DATA_SHA256 !== artifact.data_sha256) failures.push('runtime/data digest mismatch');
if (canonicalJson(THERMO_PRESSURE_GRID) !== canonicalJson(artifact.payload)) {
  failures.push('runtime payload differs from checked-in JSON artifact');
}
if (artifact.payload?.source_model?.software !== 'Reaktoro'
    || artifact.payload?.source_model?.version !== '2.13.0'
    || artifact.payload?.source_model?.database !== 'supcrtbl') {
  failures.push('source-model receipt is incomplete');
}
if (Object.keys(artifact.payload?.reactions || {}).length !== 8) {
  failures.push('expected eight promoted reactions');
}

if (failures.length) {
  for (const failure of failures) console.error(`[pressure-grid] ${failure}`);
  process.exit(1);
}
console.log(`[pressure-grid] PASS ${artifact.payload.model_id} ${artifact.data_sha256}`);
