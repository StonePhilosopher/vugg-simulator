import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadSimBundle } from './_harness.mjs';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_DIAGNOSTIC_SCHEMA = 'vugg-local-diagnostic-receipt-v1';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function gitOutput(args, { preserveLeading = false } = {}) {
  try {
    const output = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    return preserveLeading ? output.trimEnd() : output.trim();
  }
  catch (_error) { return null; }
}

function inspectEvidence(identity) {
  const relative = `archive/evidence/v${identity.sim_version}.json`;
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) return { path: relative, present: false, exact_execution_match: false, mismatches: ['missing'] };
  try {
    const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
    const mismatches = [];
    if (receipt.sim_version !== identity.sim_version) mismatches.push('sim_version');
    if (sha256(String(receipt.model_digest || '')) !== identity.model_digest_sha256) mismatches.push('model_digest');
    if (receipt.browser_bundle_sha256 !== identity.browser_bundle_sha256) mismatches.push('browser_bundle');
    if (receipt.execution_set_sha256 !== identity.runtime_execution_sha256) mismatches.push('runtime_execution');
    if (receipt.node_runtime_sha256 !== identity.node_runtime_sha256) mismatches.push('node_runtime');
    return {
      path: relative,
      present: true,
      receipt_sha256: sha256(fs.readFileSync(file)),
      exact_execution_match: mismatches.length === 0,
      mismatches,
    };
  } catch (error) {
    return { path: relative, present: true, exact_execution_match: false, mismatches: ['unreadable'], error: error.message };
  }
}

export async function buildLocalDiagnosticReceipt() {
  const bundle = await loadSimBundle({ toolName: 'local-diagnostics' });
  const identity = {
    sim_version: bundle.SIM_VERSION,
    model_digest_sha256: sha256(bundle.MODEL_DIGEST),
    browser_bundle_sha256: browserBundleDigest(ROOT),
    runtime_execution_sha256: runtimeExecutionDigest(ROOT),
    node_runtime: nodeRuntimeIdentity(),
    node_runtime_sha256: nodeRuntimeDigest(),
  };
  const dirty = gitOutput(['status', '--porcelain=v1'], { preserveLeading: true });
  const payload = {
    schema: LOCAL_DIAGNOSTIC_SCHEMA,
    privacy: {
      telemetry: false,
      network_requests: 0,
      collection_scope: 'local repository bytes, local Git metadata, and local Node runtime only',
      absolute_paths_included: false,
    },
    source: {
      git_commit: gitOutput(['rev-parse', 'HEAD']),
      dirty_paths: dirty ? dirty.split(/\r?\n/).map(line => line.slice(3).replaceAll('\\', '/')) : [],
    },
    identity,
    science_evidence: inspectEvidence(identity),
    producer_contract_sha256: producerContractDigest(ROOT, 'local-diagnostics'),
  };
  payload.receipt_sha256 = sha256(JSON.stringify(payload));
  return payload;
}

function parseArgs(argv) {
  const out = { file: null };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--out') out.file = argv[++index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const receipt = await buildLocalDiagnosticReceipt();
  const raw = `${JSON.stringify(receipt, null, 2)}\n`;
  if (args.file) {
    const output = path.resolve(ROOT, args.file);
    const relative = path.relative(ROOT, output);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('--out must stay inside the local repository');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const temp = `${output}.${process.pid}.tmp`;
    fs.writeFileSync(temp, raw);
    fs.renameSync(temp, output);
    console.error(`[local-diagnostics] wrote ${relative}; no network request or telemetry was used`);
  } else {
    process.stdout.write(raw);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[local-diagnostics] FAIL: ${error.message}`); process.exitCode = 1; });
}
