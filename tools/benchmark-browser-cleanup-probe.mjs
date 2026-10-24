// Engineering-only Windows integration probe. It never advances a simulation or
// writes scientific receipts. Each case owns an empty Chrome profile and server.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertOwnedDevToolsVersion, captureOwnedBrowserProcessReceipts,
  captureOwnedBrowserProcessReceiptsForPort, CdpClient, spawnOwned,
  formatErrorTree, waitForDevToolsReceipt, waitForOwnedExit, windowsProcessTree,
} from './browser-workflow.mjs';
import { cleanupOwnedBrowserResources, settledLifetimeRows, terminateExactBrowserProcess } from './benchmark-browser-cleanup.mjs';
import { findOwnedBrowserExecutable, ownedBrowserExecutableIdentity } from './owned-browser-runtime.mjs';

if (process.platform !== 'win32') throw new Error('This real-browser ownership probe requires Windows');
// A fresh hosted Windows runner can keep an otherwise healthy Chrome launch in
// startup for longer than the generic 10 s helper bound. Waiting longer here
// changes no ownership decision: the probe still accepts only the exact
// profile receipt, authenticated endpoint, native port owner, process birth,
// executable identity, and listener birth recorded below.
const REAL_BROWSER_STARTUP_TIMEOUT_MS = 30_000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID();
const outputRoot = path.join(root, '.local-evidence', 'benchmark-browser-cleanup-probe');
const output = path.join(outputRoot, runId);
await mkdir(output, { recursive: true });
const sourceFiles = [
  '.github/workflows/ci.yml',
  'tools/benchmark-browser-cleanup-probe.mjs', 'tools/benchmark-browser-detached-launcher.mjs',
  'tools/browser-workflow.mjs', 'tools/benchmark-browser-cleanup.mjs', 'tools/owned-browser-runtime.mjs',
];
const record = {
  schema: 'vugg-benchmark-browser-cleanup-probe-v1', runId,
  trust: 'engineering-integration-test-not-scientific-evidence',
  owner: process.env.GITHUB_RUN_ID ? `github-actions:${process.env.GITHUB_RUN_ID}` : process.env.CODEX_THREAD_ID || `probe:${runId}`,
  purpose: 'Bounded detached-browser ownership and cleanup regression',
  started_utc: new Date().toISOString(), runtime: {node: process.version, platform: process.platform, arch: process.arch},
  head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  inputs: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])),
  browser_executable: ownedBrowserExecutableIdentity(findOwnedBrowserExecutable()), cases: [],
};
assert.equal(record.browser_executable.executable_name, 'chrome.exe', 'The durable CI probe requires real Chrome');
for (const file of sourceFiles) {
  const destination = path.join(output, 'source', file);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, readFileSync(path.join(root, file)));
}
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(record, null, 2) + '\n');
await writeFile(path.join(outputRoot, 'latest.json'), JSON.stringify({runId, output}) + '\n');
// The first capture pays the cold PowerShell host and the helper compile.
// Record its cost, and any failure with its process fields, before giving up.
const driverCaptureStarted = performance.now();
try {
  record.driver = (await windowsProcessTree()).find(row => row.pid === process.pid);
  assert.match(record.driver?.start_ticks || '', /^[1-9]\d*$/, 'Probe driver identity must be recorded before launching helpers');
} catch (error) {
  record.status = 'failed'; record.error = error.stack; record.finished_utc = new Date().toISOString();
  record.error_process = {killed: error.killed ?? null, signal: error.signal ?? null, code: error.code ?? null};
  throw error;
} finally {
  record.driver_capture_ms = Math.round(performance.now() - driverCaptureStarted);
  if (record.status === 'failed') await save();
}
const same = (a, b) => a.pid === b.pid && a.start_ticks === b.start_ticks && a.executable_path === b.executable_path;

async function listening(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host: '127.0.0.1', port});
    socket.once('connect', () => {socket.destroy(); resolve(true);});
    socket.once('error', error => {socket.destroy(); error.code === 'ECONNREFUSED' ? resolve(false) : reject(error);});
    socket.setTimeout(2_000, () => {socket.destroy(); reject(new Error(`Port ${port} observation timed out`));});
  });
}
function assertEnded(rows, receipts) {
  for (const receipt of receipts) {
    const current = rows.find(row => row.pid === receipt.pid);
    if (!current) continue;
    assert.match(current.start_ticks, /^[1-9]\d*$/, 'A current PID with unreadable birth is inconclusive');
    assert.ok(current.executable_path, 'A current PID with unreadable executable is inconclusive');
    assert.ok(!same(current, receipt), `Owned lifetime ${receipt.pid} still exists`);
  }
}
let failed = false;
for (const mode of ['recovery', 'forced', 'unknown-owner', 'reused-owner-pid', 'reused-before-handle', 'endpoint-still-alive']) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vugg-cleanup-probe-'));
  await writeFile(path.join(profile, 'probe-owner.json'), JSON.stringify({runId}));
  const result = {
    mode, profile, receipts: [], started_utc: new Date().toISOString(), expiry_seconds: 90,
    startup_timeout_ms: REAL_BROWSER_STARTUP_TIMEOUT_MS,
  };
  record.cases.push(result);
  let browser, client, timer, server, devtools, rootReceipt, canary;
  const collectRows = async () => {
    const rows = await windowsProcessTree();
    if (rootReceipt && rows.some(row => same(row, rootReceipt))) {
      const fleet = await captureOwnedBrowserProcessReceipts(rootReceipt.pid, {processTreeProvider: async () => rows, expectedRoot: rootReceipt});
      const union = new Map([...result.receipts, ...fleet].map(receipt => [`${receipt.pid}|${receipt.start_ticks}|${receipt.executable_path}`, receipt]));
      result.receipts = [...union.values()];
    }
    return rows;
  };
  const closeServer = async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  };
  try {
    server = http.createServer((_request, response) => response.writeHead(200, {'x-vugg-probe-run': runId}).end('owned probe'));
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    result.server_port = server.address().port;
    const health = await fetch(`http://127.0.0.1:${result.server_port}/`, {signal: AbortSignal.timeout(2_000)});
    assert.equal(health.headers.get('x-vugg-probe-run'), runId);
    await health.text();
    const launchStarted = performance.now();
    browser = spawnOwned(process.execPath, [path.join(root, 'tools', 'benchmark-browser-detached-launcher.mjs'), profile, runId],
      {stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    let launchOutput = '';
    browser.stdout.on('data', chunk => {launchOutput += chunk;});
    browser.stderr.on('data', () => {});
    assert.equal(await waitForOwnedExit(browser, 10_000), true);
    assert.equal(browser.exitCode, 0);
    result.launcher = {pid: browser.pid, exit_code: browser.exitCode, output: launchOutput.trim()};
    devtools = await waitForDevToolsReceipt(profile, browser, REAL_BROWSER_STARTUP_TIMEOUT_MS);
    result.browser_start_ms = Math.round(performance.now() - launchStarted);
    result.devtools = devtools;
    // The first DevTools answer is still part of a cold browser start.
    const version = await (await fetch(`http://127.0.0.1:${devtools.port}/json/version`, {signal: AbortSignal.timeout(REAL_BROWSER_STARTUP_TIMEOUT_MS)})).json();
    assertOwnedDevToolsVersion(version, devtools);
    result.browser_product = version.Browser;
    result.detached_browser_survived_launcher = await listening(devtools.port);
    assert.equal(result.detached_browser_survived_launcher, true);
    client = new CdpClient(devtools.webSocketDebuggerUrl); await client.open();
    const owned = await captureOwnedBrowserProcessReceiptsForPort(devtools.port, {devtoolsReceipt: devtools});
    rootReceipt = owned.rootReceipt; result.receipts = owned.receipts;
    result.native_bound_port_owner = rootReceipt;
    result.native_listener_bind_ticks = owned.listenerStartTicks;
    await save();

    if (mode === 'recovery') {
      // This separate browser belongs to the harness, never to the target's
      // cleanup authority. A blanket Chrome/tree kill must fail this probe.
      const canaryProfile = await mkdtemp(path.join(os.tmpdir(), 'vugg-cleanup-probe-'));
      canary = {profile: canaryProfile};
      result.canary = {profile: canaryProfile, purpose: 'Separate harness-owned browser outside target cleanup authority'};
      await writeFile(path.join(canaryProfile, 'probe-owner.json'), JSON.stringify({runId}));
      canary.browser = spawnOwned(process.execPath,
        [path.join(root, 'tools', 'benchmark-browser-detached-launcher.mjs'), canaryProfile, runId],
        {stdio: 'ignore', windowsHide: true});
      assert.equal(await waitForOwnedExit(canary.browser, 10_000), true);
      assert.equal(canary.browser.exitCode, 0);
      canary.devtools = await waitForDevToolsReceipt(
        canaryProfile, canary.browser, REAL_BROWSER_STARTUP_TIMEOUT_MS,
      );
      canary.owned = await captureOwnedBrowserProcessReceiptsForPort(canary.devtools.port, {devtoolsReceipt: canary.devtools});
      Object.assign(result.canary, {devtools: canary.devtools, receipts: canary.owned.receipts});
      await save();
      canary.client = new CdpClient(canary.devtools.webSocketDebuggerUrl); await canary.client.open();
      assert.notEqual(canary.owned.rootPid, owned.rootPid);
      assert.ok(owned.receipts.every(receipt => !canary.owned.receipts.some(other => same(receipt, other))));
    }
    // The target's safety close starts once every browser is up, so a slow but
    // allowed canary start cannot close the target in the middle of recovery.
    timer = setTimeout(() => {
      result.expiry_fired_utc = new Date().toISOString();
      void client?.send('Browser.close').catch(() => {});
    }, 90_000);

    const resources = {browser, profile, devtoolsReceipt: devtools, receipts: [], closeServer,
      removeProfile: async () => {
        assert.equal(server.listening, false);
        assertEnded(await settledLifetimeRows(collectRows, result.receipts), result.receipts);
        assert.equal(await listening(devtools.port), false);
        assert.equal(await listening(result.server_port), false);
        result.deletion_proof = {owned_lifetimes_ended: true, devtools_port_released: true, server_closed: true,
          observed_before_deletion_utc: new Date().toISOString()};
        await rm(profile, {recursive: true, force: true, maxRetries: 4, retryDelay: 150});
      },
    };
    const options = {processTreeProvider: collectRows, recoveryWaitMs: 10_000, closeWaitMs: 10, exitWaitMs: 1};
    const expectedFailure = !['recovery', 'forced'].includes(mode);
    let terminations = 0;
    if (mode === 'forced') {
      resources.receipts = owned.receipts; resources.browserPid = owned.rootPid;
      resources.client = {send: () => new Promise(() => {}), close: () => {}};
      result.mismatched_native_handle_result = await terminateExactBrowserProcess({...rootReceipt, start_ticks: String(BigInt(rootReceipt.start_ticks) + 1n)});
      assert.equal(result.mismatched_native_handle_result, 'identity-changed');
      assert.equal(await listening(devtools.port), true);
    } else if (expectedFailure) {
      options.terminateReceipt = async () => {terminations++; throw new Error('Unproven identity must remain untouched');};
      if (mode === 'unknown-owner') options.ownedSnapshotProvider = async () => {throw new Error('Injected unavailable ownership observation');};
      if (mode === 'reused-owner-pid') {
        result.injected_seam = 'Old port-owner creation time followed by current replacement lifetime rows';
        result.simulated_owner_lookup = {...rootReceipt, start_ticks: String(BigInt(rootReceipt.start_ticks) - 1n)};
        result.simulated_replacement_row = rootReceipt;
        options.ownedSnapshotProvider = async () => ({rootPid: owned.rootPid,
          rootReceipt: result.simulated_owner_lookup, listenerStartTicks: owned.listenerStartTicks, rows: await collectRows()});
      }
      if (mode === 'reused-before-handle') {
        result.injected_seam = 'Replacement lifetime captured consistently after an older listener bind';
        result.simulated_listener_bind_ticks = String(BigInt(rootReceipt.start_ticks) - 1n);
        options.ownedSnapshotProvider = async () => ({rootPid: owned.rootPid, rootReceipt,
          listenerStartTicks: result.simulated_listener_bind_ticks, rows: await collectRows()});
      }
      if (mode === 'endpoint-still-alive') {
        resources.receipts = owned.receipts; resources.browserPid = owned.rootPid;
        resources.client = {send: () => new Promise(() => {}), close: () => {}};
        options.processTreeProvider = async () => []; // Deliberately incomplete process observation; endpoint must veto success.
      }
    }
    let cleanupError;
    try {await cleanupOwnedBrowserResources(resources, options);} catch (error) {cleanupError = error;}
    // Record the helper's own error before judging it: an unexpected failure
    // must leave its cause in the artifact, not only "true !== false".
    result.helper_failed_visibly = Boolean(cleanupError);
    if (cleanupError) result.helper_error = formatErrorTree(cleanupError);
    assert.equal(Boolean(cleanupError), expectedFailure);
    assert.equal(server.listening, false);
    assert.equal(await listening(result.server_port), false);
    result.server_closed_by_helper = true;
    if (canary) {
      const version = await (await fetch(`http://127.0.0.1:${canary.devtools.port}/json/version`, {signal: AbortSignal.timeout(2_000)})).json();
      assertOwnedDevToolsVersion(version, canary.devtools);
      assert.ok((await windowsProcessTree()).some(row => same(row, canary.owned.rootReceipt)));
      assert.equal(existsSync(canary.profile), true);
      result.separate_browser_untouched = true;
    }
    if (expectedFailure) {
      assert.equal(terminations, 0);
      result.termination_calls = terminations;
      assert.match(result.helper_error, mode.startsWith('reused-') ? /port owner lifetime changed/
        : mode === 'unknown-owner' ? /Injected unavailable ownership observation/
        : /Exact owned DevTools endpoint still answers/);
      assert.equal(existsSync(profile), true);
      const alive = await (await fetch(`http://127.0.0.1:${devtools.port}/json/version`, {signal: AbortSignal.timeout(2_000)})).json();
      assertOwnedDevToolsVersion(alive, devtools);
      assert.ok((await collectRows()).some(row => same(row, rootReceipt)));
      result.process_untouched = true; result.profile_retained_by_helper = true;
    } else {
      assert.equal(existsSync(profile), false);
      assertEnded(await settledLifetimeRows(collectRows, result.receipts), result.receipts);
      assert.equal(await listening(devtools.port), false);
      result.profile_deleted_after_proof = true; result.all_owned_lifetimes_ended_by_helper = true;
    }
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack; failed = true;
  } finally {
    clearTimeout(timer);
    // Independent harness cleanup also closes deliberately untouched negative
    // cases. It never gives their fake observations termination authority.
    if (client) {
      await Promise.race([client.send('Browser.close').catch(() => {}), new Promise(resolve => setTimeout(resolve, 2_000))]);
      client.close();
    }
    await closeServer();
    if (canary) {
      try {
        if (canary.client) {
          await Promise.race([canary.client.send('Browser.close').catch(() => {}), new Promise(resolve => setTimeout(resolve, 2_000))]);
          canary.client.close();
        }
        if (!canary.owned) throw new Error('Canary lifetime ownership is unavailable; retaining its profile');
        let rows = await windowsProcessTree();
        for (const receipt of canary.owned.receipts) {
          if (rows.some(row => same(row, receipt))) await terminateExactBrowserProcess(receipt);
          rows = await windowsProcessTree();
        }
        assertEnded(await settledLifetimeRows(windowsProcessTree, canary.owned.receipts, {rows}), canary.owned.receipts);
        assert.equal(await listening(canary.devtools.port), false);
        if (path.dirname(canary.profile) !== path.resolve(os.tmpdir()) || !path.basename(canary.profile).startsWith('vugg-cleanup-probe-')) throw new Error('Invalid canary profile path');
        await rm(canary.profile, {recursive: true, force: true, maxRetries: 4, retryDelay: 150});
        result.canary.final_cleanup = {owned_lifetimes_ended: true, devtools_port_released: true, profile_removed: true};
      } catch (error) {
        result.canary_cleanup_error = error.stack; failed = true;
      }
    }
    try {
      if (browser?.pid && !rootReceipt) {
        throw new Error('Probe never established browser lifetime ownership; retaining its profile');
      }
      let rows = await collectRows();
      for (const receipt of result.receipts) {
        if (rows.some(row => same(row, receipt))) await terminateExactBrowserProcess(receipt);
        rows = await windowsProcessTree();
      }
      assertEnded(await settledLifetimeRows(windowsProcessTree, result.receipts, {rows}), result.receipts);
      if (devtools) assert.equal(await listening(devtools.port), false);
      if (result.server_port) assert.equal(await listening(result.server_port), false);
      if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('vugg-cleanup-probe-')) throw new Error('Invalid disposable profile path');
      await rm(profile, {recursive: true, force: true, maxRetries: 4, retryDelay: 150});
      result.final_cleanup = {owned_lifetimes_ended: true, devtools_port_released: true, server_closed: true, profile_removed: true};
    } catch (error) {
      result.final_cleanup_error = error.stack; failed = true;
    }
    result.finished_utc = new Date().toISOString(); await save();
  }
  if (failed) break;
}
record.status = failed ? 'failed' : 'passed'; record.finished_utc = new Date().toISOString();
await save();
console.log(JSON.stringify({status: record.status, output, cases: record.cases.map(item => ({mode: item.mode, status: item.status}))}, null, 2));
if (failed) process.exitCode = 1;
