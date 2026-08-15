// tests-js/authenticated-evidence.ts — fail-closed access to published science
// evidence. Tests must not make claims from a JSON file merely because its
// filename contains the current SIM number: the checked-in aggregate receipt
// binds the file bytes to the exact browser/runtime inputs and producer code.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from '../tools/evidence-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT_SCHEMA = 'vugg-science-evidence-receipt-v1';

type ProducerKind =
  | 'seed42-baseline'
  | 'strip-archive'
  | 'locality-frequency'
  | 'strip-digest'
  | 'claim-cards'
  | 'science-provenance'
  | 'science-receipt';

function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** Read identity from the authenticated executable, not the editable TS source. */
function builtModelIdentity(): { simVersion: number; modelDigest: string } {
  const source = fs.readFileSync(path.join(ROOT, 'dist', '15-version.js'), 'utf8');
  const simMatch = /^const SIM_VERSION = (\d+);/m.exec(source);
  const assignment = 'const MODEL_DIGEST = ';
  const start = source.indexOf(assignment);
  const finishToken = "].join('|')";
  const finish = source.indexOf(finishToken, start);
  if (!simMatch || start < 0 || finish < 0) {
    throw new Error('cannot read SIM_VERSION/MODEL_DIGEST from built simulator');
  }
  const expression = source.slice(start + assignment.length, finish + finishToken.length);
  // This evaluates only the literal string array expression isolated above.
  const modelDigest = Function(`"use strict"; return (${expression});`)();
  if (typeof modelDigest !== 'string' || !modelDigest) {
    throw new Error('built simulator MODEL_DIGEST is missing or malformed');
  }
  return { simVersion: Number(simMatch[1]), modelDigest };
}

const CURRENT = builtModelIdentity();
let authenticatedReceipt: any | null = null;
const authenticatedProducers = new Set<ProducerKind>();
const artifactCache = new Map<string, any>();

function sameJson(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function loadReceipt(): any {
  if (authenticatedReceipt) return authenticatedReceipt;
  const receiptPath = path.join(ROOT, 'archive', 'evidence', `v${CURRENT.simVersion}.json`);
  if (!fs.existsSync(receiptPath)) {
    throw new Error(`science evidence receipt is missing for SIM ${CURRENT.simVersion}`);
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (receipt.schema !== RECEIPT_SCHEMA
      || receipt.sim_version !== CURRENT.simVersion
      || receipt.model_digest !== CURRENT.modelDigest
      || receipt.canonical_seed !== 42) {
    throw new Error('science evidence receipt identity does not match the current built model');
  }
  if (receipt.browser_bundle_sha256 !== browserBundleDigest(ROOT)
      || receipt.execution_set_sha256 !== runtimeExecutionDigest(ROOT)) {
    throw new Error('science evidence receipt does not match the current executable/data bytes');
  }
  if (receipt.node_runtime_sha256 !== nodeRuntimeDigest()
      || !sameJson(receipt.node_runtime, nodeRuntimeIdentity())) {
    throw new Error('science evidence receipt does not match the current Node runtime envelope');
  }
  authenticatedReceipt = receipt;
  return receipt;
}

function authenticateProducer(receipt: any, kind: ProducerKind): void {
  if (authenticatedProducers.has(kind)) return;
  const expected = receipt.producer_contracts?.[kind];
  const current = producerContractDigest(ROOT, kind);
  if (!expected || expected !== current) {
    throw new Error(`science evidence producer contract mismatch: ${kind}`);
  }
  authenticatedProducers.add(kind);
}

function artifactRelativePath(relativePath: string): string {
  const normalized = String(relativePath).replaceAll('\\', '/').replace(/^\.\//, '');
  const absolute = path.resolve(ROOT, normalized);
  const rootPrefix = `${ROOT}${path.sep}`.toLowerCase();
  if (!absolute.toLowerCase().startsWith(rootPrefix)) {
    throw new Error(`science evidence path escapes repository: ${relativePath}`);
  }
  return path.relative(ROOT, absolute).replaceAll('\\', '/');
}

/** Return JSON only after authenticating its current-model receipt and bytes. */
export function loadAuthenticatedEvidenceJson(relativePath: string, kind: ProducerKind): any {
  const relative = artifactRelativePath(relativePath);
  const cacheKey = `${kind}:${relative}`;
  if (artifactCache.has(cacheKey)) return artifactCache.get(cacheKey);
  const receipt = loadReceipt();
  authenticateProducer(receipt, kind);
  const expectedHash = receipt.artifacts?.[relative];
  if (!/^[0-9a-f]{64}$/.test(String(expectedHash || ''))) {
    throw new Error(`science evidence artifact is not receipted: ${relative}`);
  }
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) throw new Error(`science evidence artifact is missing: ${relative}`);
  const bytes = fs.readFileSync(absolute);
  if (sha256(bytes) !== expectedHash) {
    throw new Error(`science evidence artifact hash mismatch: ${relative}`);
  }
  const value = JSON.parse(bytes.toString('utf8'));
  if (value?.sim_version != null && value.sim_version !== CURRENT.simVersion) {
    throw new Error(`science evidence SIM identity mismatch: ${relative}`);
  }
  if (value?.model_digest != null && value.model_digest !== CURRENT.modelDigest) {
    throw new Error(`science evidence model identity mismatch: ${relative}`);
  }
  artifactCache.set(cacheKey, value);
  return value;
}

/** Require an authored scenario row; optional chaining must never prove absence. */
export function requireEvidenceScenario(evidence: any, name: string): any {
  const rows = evidence?.scenarios && typeof evidence.scenarios === 'object'
    ? evidence.scenarios : evidence;
  const row = rows?.[name];
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`authenticated evidence has no scenario row: ${name}`);
  }
  return row;
}

export const currentEvidenceIdentity = Object.freeze({
  simVersion: CURRENT.simVersion,
  modelDigest: CURRENT.modelDigest,
});
