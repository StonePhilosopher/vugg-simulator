/** One-shot process observations for the future foreman; no ownership or kill authority. */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);
export const CENSUS_SCHEMA = 'vugg-process-preflight-v1';
export const QUERY_TIMEOUT_MS = 15000;
const RUNTIME_NAMES = new Set(['node', 'nodejs', 'bun', 'deno', 'esbuild']);
const WORK_COMMAND = /(?:^|[\\/\s"'=])(vitest(?:\.(?:mjs|cjs|js))?|vite(?:\.(?:mjs|cjs|js))?|test-workflow\.mjs|cold-ci\.mjs|build-all\.mjs)(?=$|[\\/\s"'])/i;

// Keep shell intermediates: filtering to node.exe breaks cmd/PowerShell/npm
// parent chains. Raw command lines are used only for bounded classification;
// they never enter the returned snapshot, diagnostics, or persisted report.
export const WINDOWS_PROCESS_QUERY = `
$ErrorActionPreference = 'Stop'
$rows = @(Get-CimInstance Win32_Process | ForEach-Object {
  [pscustomobject]@{
    pid = $_.ProcessId
    ppid = $_.ParentProcessId
    name = $_.Name
    started_at = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { $null }
    command = $_.CommandLine
  }
})
ConvertTo-Json -InputObject $rows -Depth 3 -Compress
`;

function timestamp(value, observedMs) {
  // Preserve all seven CIM fractional digits for identity comparisons. Date's
  // millisecond precision is used only to reject invalid/future clock values.
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(value)) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms > observedMs
      || new Date(ms).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return value;
}

function checkoutHint(command, root) {
  const target = root.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  const text = command.replaceAll('\\', '/').toLowerCase();
  if (!target) return 'unresolved';
  let offset = text.indexOf(target);
  while (offset !== -1) {
    const before = offset ? text[offset - 1] : '';
    const after = text[offset + target.length] || '';
    if ((!before || /[\s"'=]/.test(before)) && (!after || /[\/\s"']/.test(after))) return 'current-checkout-path';
    offset = text.indexOf(target, offset + 1);
  }
  return 'unresolved';
}

const unavailable = (reason, observedAt) => ({ status: 'unavailable', reason, observed_at: observedAt, processes: [] });

export function parseWindowsProcessSnapshot(text, { observedAt = new Date().toISOString(), root = ROOT } = {}) {
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) return unavailable('invalid-observation-time', null);
  let raw;
  try { raw = JSON.parse(text); }
  catch { return unavailable('malformed-query-output', observedAt); }
  if (!Array.isArray(raw)) return unavailable('malformed-query-output', observedAt);
  const seen = new Set();
  const processes = [];
  for (const row of raw) {
    if (!row || !Number.isSafeInteger(row.pid) || row.pid < 0
        || !Number.isSafeInteger(row.ppid) || row.ppid < 0
        || typeof row.name !== 'string' || !row.name || /[\x00-\x1f]/.test(row.name)
        || seen.has(row.pid)) return unavailable('invalid-or-duplicate-process-row', observedAt);
    seen.add(row.pid);
    const runtime = RUNTIME_NAMES.has(row.name.toLowerCase().replace(/\.exe$/, ''));
    const commandKnown = typeof row.command === 'string' && row.command.trim().length > 0;
    const work = runtime && commandKnown ? WORK_COMMAND.exec(row.command) : null;
    processes.push({
      pid: row.pid, ppid: row.ppid, name: row.name,
      started_at: timestamp(row.started_at, observedMs), javascript_runtime: runtime,
      command_known: commandKnown,
      work_kind: work ? work[1].toLowerCase().replace(/\.(?:mjs|cjs|js)$/, '') : null,
      checkout_hint: runtime && commandKnown ? checkoutHint(row.command, root) : 'unresolved',
    });
  }
  return { status: 'available', observed_at: observedAt, processes: processes.sort((a, b) => a.pid - b.pid) };
}

export async function captureProcessSnapshot({
  root = ROOT, platform = process.platform, exec = execFileAsync, now = Date.now,
} = {}) {
  if (platform !== 'win32') return unavailable('unsupported-platform', new Date(now()).toISOString());
  try {
    const { stdout } = await exec('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_QUERY], {
      encoding: 'utf8', windowsHide: true, timeout: QUERY_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
    });
    return parseWindowsProcessSnapshot(stdout, { root, observedAt: new Date(now()).toISOString() });
  } catch {
    // exec errors can contain raw stdout/stderr. Do not persist those command lines.
    return unavailable('process-query-failed', new Date(now()).toISOString());
  }
}

function callerRelation(row, byPid, caller) {
  if (!caller?.started_at) return { relation: 'unresolved', ancestry_issue: 'caller-identity-unavailable' };
  if (row.pid === caller.pid) return { relation: 'caller', ancestry_issue: null };
  const seen = new Set([row.pid]);
  let child = row;
  while (child.ppid !== 0) {
    const parent = byPid.get(child.ppid);
    if (!parent) return { relation: 'unresolved', ancestry_issue: 'parent-not-observed' };
    if (seen.has(parent.pid)) return { relation: 'unresolved', ancestry_issue: 'ancestry-cycle' };
    seen.add(parent.pid);
    if (!child.started_at || !parent.started_at) return { relation: 'unresolved', ancestry_issue: 'ancestor-start-unavailable' };
    if (parent.started_at > child.started_at) return { relation: 'unresolved', ancestry_issue: 'parent-created-after-child' };
    if (parent.pid === caller.pid) return { relation: 'descendant', ancestry_issue: null };
    child = parent;
  }
  return { relation: 'outside-observed-caller-tree', ancestry_issue: null };
}

export function assessProcessSnapshot(snapshot, { selfPid = process.pid } = {}) {
  const report = { schema: CENSUS_SCHEMA, scope: 'recognized-javascript-test-build-commands',
    trust: 'local-process-observation-not-ownership-authority',
    observed_at: snapshot?.observed_at ?? null, host_cleanliness: 'not-certified', full_suite_pass: false,
    caller: null, runtimes: [], blockers: [], issues: [] };
  if (snapshot?.status !== 'available' || !Array.isArray(snapshot?.processes)) {
    const knownReasons = ['invalid-observation-time', 'malformed-query-output',
      'invalid-or-duplicate-process-row', 'unsupported-platform', 'process-query-failed'];
    return { ...report, status: 'unknown', exit_code: 2,
      issues: [knownReasons.includes(snapshot?.reason) ? snapshot.reason : 'invalid-snapshot'] };
  }
  const byPid = new Map(snapshot.processes.map(row => [row.pid, row]));
  const caller = byPid.get(selfPid);
  if (!caller?.started_at) report.issues.push('caller-identity-unavailable');
  else report.caller = { pid: caller.pid, started_at: caller.started_at };
  for (const row of snapshot.processes.filter(p => p.javascript_runtime)) {
    const classified = { ...row, ...callerRelation(row, byPid, caller) };
    report.runtimes.push(classified);
    if (classified.relation === 'caller' || classified.relation === 'descendant') continue;
    // Positive observed work takes precedence over missing metadata. Unresolved
    // ancestry cannot exempt it as "ours", including after parent PID reuse.
    if (row.work_kind) report.blockers.push(classified);
    if (!row.command_known) report.issues.push(`pid ${row.pid}: command-unavailable`);
    if (!row.started_at) report.issues.push(`pid ${row.pid}: start-unavailable`);
  }
  const status = report.blockers.length ? 'busy' : report.issues.length ? 'unknown' : 'no-observed-work';
  return { ...report, status, exit_code: status === 'busy' ? 1 : status === 'unknown' ? 2 : 0 };
}

function writeReport(root, report) {
  const directory = path.join(root, '.local-evidence');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'process-preflight-v1.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function runProcessCensus({
  argv = process.argv.slice(2), root = ROOT, selfPid = process.pid,
  capture = () => captureProcessSnapshot({ root }), persist = report => writeReport(root, report),
  log = console.log, error = console.error,
} = {}) {
  const usage = 'node tools/process-census.mjs [--preflight] [--json]';
  if (argv.length === 1 && argv[0] === '--help') { log(usage); return 0; }
  if (argv.some(arg => arg !== '--preflight' && arg !== '--json') || new Set(argv).size !== argv.length) {
    error(usage); return 2;
  }
  let snapshot;
  try { snapshot = await capture(); }
  catch { snapshot = unavailable('process-query-failed', null); }
  let report = assessProcessSnapshot(snapshot, { selfPid });
  try { persist(report); }
  catch {
    report = { ...report, issues: [...report.issues, 'report-write-failed'],
      status: report.status === 'busy' ? 'busy' : 'unknown', exit_code: report.status === 'busy' ? 1 : 2 };
  }
  if (argv.includes('--json')) log(JSON.stringify(report, null, 2));
  else {
    log(`[process-census] ${report.status.toUpperCase()}: ${report.blockers.length} observed work process(es) outside the verified caller tree`);
    for (const row of report.blockers) log(`  pid ${row.pid} ${row.name} started ${row.started_at || '?'}: ${row.work_kind}; ${row.relation}; ${row.checkout_hint}`);
    for (const issue of report.issues) log(`  ${issue}`);
    log('[process-census] One observation of recognized JS test/build commands; no machine reservation or host-cleanliness certification.');
  }
  return report.exit_code;
}
