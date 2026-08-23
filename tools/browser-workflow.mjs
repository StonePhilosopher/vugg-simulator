import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  FILE_BUNDLE_ASSET_SCHEMA,
  fileBundleAssetDigest,
  fileBundleAssetFiles,
} from './file-bundle-assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionMatch = /const SIM_VERSION = (\d+);/.exec(
  readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8'),
);
if (!versionMatch) throw new Error('browser workflow could not read current SIM_VERSION');
const SIM_VERSION = Number(versionMatch[1]);
const FILE_BUNDLE_ASSET_COUNT = fileBundleAssetFiles(ROOT).length;
const FILE_BUNDLE_ASSET_SHA256 = fileBundleAssetDigest(ROOT);
const TEST_SEED = 42;
const MANUAL_SAVE_NAME = 'Browser QA — seed 42';
const DEFAULT_TIMEOUT_MS = 20_000;
// Full app navigation includes the canonical 7.99 MB bundle, 98 embedded
// authored assets, WebGL commissioning, and scenario/narrative registration.
// Keep individual CDP operations on the tighter default, but give this one
// measured product boundary enough time on a contended review workstation.
const BROWSER_NAVIGATION_TIMEOUT_MS = 60_000;
const DEBUG_CDP = process.env.VUGG_BROWSER_DEBUG === '1';
const OWNED_PROCESS_ERRORS = new WeakMap();
const execFileAsync = promisify(execFile);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithDeadline(url, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetcher = globalThis.fetch,
  options = {},
  consume = null,
} = {}) {
  const controller = new AbortController();
  let timer = null;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out fetching ${url}`));
    }, timeoutMs);
  });
  try {
    const request = Promise.resolve().then(async () => {
      const response = await fetcher(url, { ...options, signal: controller.signal });
      return consume ? consume(response) : response;
    });
    return await Promise.race([request, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ownedProcessExited(child) {
  return !child || OWNED_PROCESS_ERRORS.has(child) || child.exitCode != null || child.signalCode != null;
}

function spawnOwned(command, args, options) {
  const child = spawn(command, args, options);
  // spawn() reports a missing/non-executable binary asynchronously. Retain it
  // as process state so polling and cleanup fail closed without an unhandled
  // EventEmitter 'error'.
  child.once('error', error => OWNED_PROCESS_ERRORS.set(child, error));
  return child;
}

function ownedProcessFailure(child) {
  const spawnError = child && OWNED_PROCESS_ERRORS.get(child);
  if (spawnError) return spawnError;
  if (child?.exitCode != null && child.exitCode !== 0) {
    return new Error(`Owned process ${child.pid || '(unknown pid)'} exited with code ${child.exitCode}`);
  }
  return null;
}

function browserCandidates() {
  const env = process.env.VUGG_BROWSER_BIN ? [process.env.VUGG_BROWSER_BIN] : [];
  if (process.platform === 'win32') {
    return [
      ...env,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }
  if (process.platform === 'darwin') {
    return [
      ...env,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    ...env,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

function findBrowser() {
  const browser = browserCandidates().find(candidate => candidate && existsSync(candidate));
  if (!browser) {
    throw new Error(
      'No Chrome/Edge/Chromium executable found. Set VUGG_BROWSER_BIN to an installed browser.',
    );
  }
  return browser;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise(resolve => server.close(resolve));
  if (!port) throw new Error('Could not reserve a local port');
  return port;
}

async function waitForHttp(url, child, {
  expectedNonce = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetcher = globalThis.fetch,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (ownedProcessExited(child)) {
      throw new Error(`Owned process exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetchWithDeadline(url, {
        timeoutMs: Math.max(1, deadline - Date.now()),
        fetcher,
        options: { cache: 'no-store' },
      });
      if (response.ok) {
        const actualNonce = response.headers?.get?.('x-vugg-server-nonce') || null;
        if (expectedNonce && actualNonce !== expectedNonce) {
          lastError = new Error('owned-server nonce mismatch');
        } else {
          // A bind failure can race the first response. Do not accept even a
          // nonce-matching reply after the owned process has failed.
          const failure = ownedProcessFailure(child);
          if (failure) throw failure;
          if (!ownedProcessExited(child)) return response;
          lastError = new Error('owned server exited during readiness authentication');
        }
      } else {
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'no response'}`);
}

function assertOwnedDevToolsVersion(version, receipt) {
  assert.equal(
    version?.webSocketDebuggerUrl,
    receipt.webSocketDebuggerUrl,
    'DevTools endpoint did not match the exact owned-profile receipt',
  );
}

async function findOwnedBrowserRootPid(port, { netstatRunner = execFileAsync } = {}) {
  if (!Number.isSafeInteger(Number(port)) || Number(port) <= 0) {
    throw new Error('authenticated DevTools port is invalid');
  }
  const { stdout } = await netstatRunner('netstat.exe', ['-ano', '-p', 'tcp'], {
    windowsHide: true,
    timeout: 10_000,
  });
  const pids = new Set();
  for (const line of String(stdout).split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5 || fields[0].toUpperCase() !== 'TCP') continue;
    const local = fields[1];
    const state = fields[3]?.toUpperCase();
    const pid = Number(fields[4]);
    if (state === 'LISTENING'
        && (local === `127.0.0.1:${port}` || local === `[::1]:${port}`)
        && Number.isSafeInteger(pid) && pid > 0) pids.add(pid);
  }
  if (pids.size !== 1) {
    throw new Error(`authenticated DevTools port ${port} had ${pids.size} listening process owners`);
  }
  return [...pids][0];
}

async function waitForDevToolsReceipt(profileDir, child, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const receiptPath = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    const spawnError = child && OWNED_PROCESS_ERRORS.get(child);
    if (spawnError) throw spawnError;
    if (child?.exitCode != null && child.exitCode !== 0) {
      throw new Error(`Browser launcher exited early with code ${child.exitCode}`);
    }
    try {
      const lines = (await readFile(receiptPath, 'utf8')).trim().split(/\r?\n/);
      const port = Number(lines[0]);
      const browserPath = String(lines[1] || '');
      if (Number.isSafeInteger(port) && port > 0
          && /^\/devtools\/browser\/[A-Za-z0-9._-]+$/.test(browserPath)) {
        return {
          port,
          webSocketDebuggerUrl: `ws://127.0.0.1:${port}${browserPath}`,
        };
      }
      lastError = new Error('invalid DevToolsActivePort receipt');
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  const launcherState = ownedProcessExited(child)
    ? `launcher exited with code ${child?.exitCode}`
    : 'launcher remained active';
  throw new Error(`Timed out waiting for ${receiptPath} (${launcherState}): ${lastError?.message || 'missing'}`);
}

async function windowsProcessTree({ execFileRunner = execFileAsync, ownerPort = null } = {}) {
  const source = String.raw`
using System;
using System.Collections.Generic;
using System.Net;
using System.Runtime.InteropServices;
public static class VuggProcessTree {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  private struct PROCESSENTRY32 {
    public uint dwSize; public uint cntUsage; public uint th32ProcessID;
    public IntPtr th32DefaultHeapID; public uint th32ModuleID; public uint cntThreads;
    public uint th32ParentProcessID; public int pcPriClassBase; public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }
  [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool Process32First(IntPtr snapshot, ref PROCESSENTRY32 entry);
  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool Process32Next(IntPtr snapshot, ref PROCESSENTRY32 entry);
  [StructLayout(LayoutKind.Sequential)] private struct FILETIME { public uint low; public uint high; }
  [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
  [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetProcessTimes(IntPtr process, out FILETIME creation, out FILETIME exit, out FILETIME kernel, out FILETIME user);
  [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
  private enum TCP_TABLE_CLASS { TCP_TABLE_OWNER_PID_LISTENER = 3 }
  [StructLayout(LayoutKind.Sequential)] private struct MIB_TCPROW_OWNER_PID {
    public uint state, localAddr, localPort, remoteAddr, remotePort, owningPid;
  }
  [DllImport("iphlpapi.dll", SetLastError = true)] private static extern uint GetExtendedTcpTable(
    IntPtr table, ref int size, bool order, int addressFamily, TCP_TABLE_CLASS tableClass, uint reserved);
  private static uint OwnerForPort(int port) {
    int size = 0;
    GetExtendedTcpTable(IntPtr.Zero, ref size, false, 2, TCP_TABLE_CLASS.TCP_TABLE_OWNER_PID_LISTENER, 0);
    IntPtr table = Marshal.AllocHGlobal(size);
    try {
      if (GetExtendedTcpTable(table, ref size, false, 2, TCP_TABLE_CLASS.TCP_TABLE_OWNER_PID_LISTENER, 0) != 0) return 0;
      int count = Marshal.ReadInt32(table);
      IntPtr row = IntPtr.Add(table, 4);
      int rowSize = Marshal.SizeOf(typeof(MIB_TCPROW_OWNER_PID));
      for (int i = 0; i < count; i++, row = IntPtr.Add(row, rowSize)) {
        var entry = (MIB_TCPROW_OWNER_PID)Marshal.PtrToStructure(row, typeof(MIB_TCPROW_OWNER_PID));
        int localPort = (int)(((entry.localPort & 0xFF) << 8) | ((entry.localPort & 0xFF00) >> 8));
        if (entry.state == 2 && localPort == port) return entry.owningPid;
      }
      return 0;
    } finally { Marshal.FreeHGlobal(table); }
  }
  public static string[] Rows() {
    var rows = new List<string>();
    IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) return rows.ToArray();
    var entry = new PROCESSENTRY32(); entry.dwSize = (uint)Marshal.SizeOf(entry);
    if (Process32First(snapshot, ref entry)) do {
      ulong creationTicks = 0;
      IntPtr process = OpenProcess(0x1000, false, entry.th32ProcessID);
      if (process != IntPtr.Zero) {
        FILETIME creation, exit, kernel, user;
        if (GetProcessTimes(process, out creation, out exit, out kernel, out user)) {
          creationTicks = ((ulong)creation.high << 32) | creation.low;
        }
        CloseHandle(process);
      }
      rows.Add(entry.th32ProcessID + "|" + entry.th32ParentProcessID + "|" + creationTicks + "|" + entry.szExeFile);
      entry.dwSize = (uint)Marshal.SizeOf(entry);
    } while (Process32Next(snapshot, ref entry));
    CloseHandle(snapshot); return rows.ToArray();
  }
  public static string[] RowsAndOwner(int port) {
    var rows = new List<string>(); rows.Add("OWNER|" + OwnerForPort(port));
    rows.AddRange(Rows()); return rows.ToArray();
  }
}`;
  const { stdout } = await execFileRunner('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    ownerPort == null
      ? 'Add-Type -TypeDefinition $env:VUGG_TOOLHELP_SOURCE; [VuggProcessTree]::Rows()'
      : 'Add-Type -TypeDefinition $env:VUGG_TOOLHELP_SOURCE; [VuggProcessTree]::RowsAndOwner([int]$env:VUGG_DEVTOOLS_PORT)',
  ], {
    env: {
      ...process.env,
      VUGG_TOOLHELP_SOURCE: source,
      ...(ownerPort == null ? {} : { VUGG_DEVTOOLS_PORT: String(ownerPort) }),
    },
    windowsHide: true,
    timeout: 10_000,
  });
  const lines = String(stdout).split(/\r?\n/);
  const ownerLine = lines.find(line => line.startsWith('OWNER|'));
  const rows = lines.map(line => {
    const [pidRaw, parentRaw, startTicks = '', ...pathParts] = line.trim().split('|');
    const pid = Number(pidRaw);
    const parentPid = Number(parentRaw);
    const executablePath = pathParts.join('|');
    return Number.isSafeInteger(pid) && pid > 0 && Number.isSafeInteger(parentPid)
      && /^\d+$/.test(startTicks)
      ? { pid, parentPid, start_ticks: startTicks, executable_path: executablePath }
      : null;
  }).filter(Boolean);
  if (ownerPort == null) return rows;
  return { rootPid: Number(ownerLine?.split('|')[1] || 0), rows };
}

async function captureOwnedBrowserProcessReceipts(rootPid, {
  platform = process.platform,
  processTreeProvider = windowsProcessTree,
} = {}) {
  if (platform !== 'win32') return [];
  if (!Number.isSafeInteger(Number(rootPid)) || Number(rootPid) <= 0) {
    throw new Error('owned browser root PID is unavailable');
  }
  const tree = await processTreeProvider();
  const byParent = new Map();
  for (const row of tree) {
    const children = byParent.get(row.parentPid) || [];
    children.push(row.pid);
    byParent.set(row.parentPid, children);
  }
  const pids = [];
  const pending = [Number(rootPid)];
  while (pending.length) {
    const pid = pending.pop();
    if (pids.includes(pid)) continue;
    pids.push(pid);
    pending.push(...(byParent.get(pid) || []));
  }
  const selected = new Set(pids);
  const receipts = tree.filter(row => selected.has(row.pid) && row.start_ticks !== '0')
    .map(({ pid, start_ticks, executable_path }) => ({ pid, start_ticks, executable_path }));
  if (!receipts.length) {
    throw new Error(`authenticated browser process receipt was empty (root ${rootPid}; root row ${JSON.stringify(tree.find(row => row.pid === Number(rootPid)) || null)}; candidates ${pids.join(',')}; snapshot rows ${tree.length})`);
  }
  if (!receipts.some(receipt => receipt.pid === Number(rootPid))) {
    throw new Error('owned browser root exited before its process-tree receipt was captured');
  }
  return receipts;
}

async function captureOwnedBrowserProcessReceiptsForPort(port, {
  timeoutMs = 5_000,
  ownedSnapshotProvider = requestedPort => windowsProcessTree({ ownerPort: requestedPort }),
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const snapshot = await ownedSnapshotProvider(port);
      const rootPid = Number(snapshot?.rootPid);
      const tree = snapshot?.rows || [];
      if (!Number.isSafeInteger(rootPid) || rootPid <= 0) {
        throw new Error(`authenticated DevTools port ${port} had no listening process owner`);
      }
      if (!tree.some(row => row.pid === rootPid)) {
        lastError = new Error(`DevTools owner ${rootPid} exited before process snapshot`);
      } else {
        const receipts = await captureOwnedBrowserProcessReceipts(rootPid, {
          processTreeProvider: async () => tree,
        });
        return { rootPid, receipts };
      }
    } catch (error) {
      lastError = error;
    }
    await delay(25);
  }
  throw new Error(`could not capture stable authenticated DevTools process owner: ${lastError?.message || 'unknown failure'}`);
}

async function terminateOwnedProcessReceipts(receipts, {
  platform = process.platform,
  processTreeProvider = windowsProcessTree,
  processSpawner = spawnOwned,
  waitMs = 5_000,
} = {}) {
  if (platform !== 'win32') return;
  const expected = new Map((receipts || []).map(receipt => [Number(receipt.pid), receipt]));
  const current = await processTreeProvider();
  const exactMatches = current.filter(receipt => {
    const prior = expected.get(receipt.pid);
    return prior
      && receipt.start_ticks === prior.start_ticks
      && receipt.executable_path === prior.executable_path;
  });
  for (const receipt of exactMatches) {
    const killer = processSpawner('taskkill.exe', ['/PID', String(receipt.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    if (!(await waitForOwnedExit(killer, waitMs))) {
      killer.kill('SIGKILL');
      await waitForOwnedExit(killer, Math.min(waitMs, 2_000));
    }
  }
  await delay(100);
  const remaining = (await processTreeProvider())
    .filter(receipt => {
      const prior = expected.get(receipt.pid);
      return prior
        && receipt.start_ticks === prior.start_ticks
        && receipt.executable_path === prior.executable_path;
    });
  if (remaining.length) {
    throw new Error(`authenticated browser processes survived cleanup: ${remaining.map(entry => entry.pid).join(', ')}`);
  }
}

async function waitForOwnedExit(child, timeoutMs) {
  if (ownedProcessExited(child)) return true;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      child.off('error', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      child.off('exit', onExit);
      child.off('error', onExit);
      resolve(true);
    };
    child.once('exit', onExit);
    child.once('error', onExit);
  });
}

async function terminateOwned(child, {
  tree = false,
  processSpawner = spawnOwned,
  treeWaitMs = 5_000,
  termWaitMs = 3_000,
  killWaitMs = 5_000,
} = {}) {
  if (ownedProcessExited(child)) return;
  if (tree && process.platform === 'win32' && child.pid) {
    const failures = [];
    const killer = processSpawner('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    if (!(await waitForOwnedExit(killer, treeWaitMs))) {
      failures.push(new Error(`taskkill did not finish for owned process tree ${child.pid}`));
      killer.kill('SIGKILL');
      await waitForOwnedExit(killer, Math.min(2_000, killWaitMs));
    } else {
      const killerFailure = ownedProcessFailure(killer);
      if (killerFailure && !ownedProcessExited(child)) failures.push(killerFailure);
    }
    if (!(await waitForOwnedExit(child, treeWaitMs))) {
      failures.push(new Error(`Owned browser tree root ${child.pid} survived taskkill /T /F`));
      child.kill('SIGKILL');
      if (!(await waitForOwnedExit(child, killWaitMs))) {
        failures.push(new Error(`Owned browser root ${child.pid} survived direct SIGKILL fallback`));
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, `Could not cleanly terminate owned browser tree ${child.pid}`);
    }
    return;
  }

  child.kill('SIGTERM');
  if (await waitForOwnedExit(child, termWaitMs)) return;
  child.kill('SIGKILL');
  if (!(await waitForOwnedExit(child, killWaitMs))) {
    throw new Error(`Owned process ${child.pid || '(unknown pid)'} did not exit after termination`);
  }
}

async function runCleanupActions(actions) {
  const failures = [];
  for (const [label, action] of actions) {
    try {
      await action();
    } catch (error) {
      failures.push(new Error(`${label}: ${error?.message || error}`, { cause: error }));
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, 'One or more owned browser-workflow resources failed cleanup');
  }
}

function formatErrorTree(error, indent = '') {
  const message = error?.stack || error?.message || String(error);
  const lines = [`${indent}${message}`];
  if (error instanceof AggregateError) {
    for (const child of error.errors || []) lines.push(formatErrorTree(child, `${indent}  `));
  } else if (error?.cause) {
    lines.push(formatErrorTree(error.cause, `${indent}  caused by: `));
  }
  return lines.join('\n');
}

function drainOwnedPipe(pipe, diagnostics, key) {
  if (!pipe) return;
  pipe.on('data', chunk => {
    const next = `${diagnostics[key] || ''}${String(chunk)}`;
    diagnostics[key] = next.slice(-65_536);
    if (DEBUG_CDP) process.stderr.write(`[${key}] ${String(chunk)}`);
  });
}

class CdpClient {
  constructor(webSocketUrl, {
    WebSocketCtor = globalThis.WebSocket,
    openTimeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.ws = new WebSocketCtor(webSocketUrl);
    this.ws.binaryType = 'arraybuffer';
    this.openTimeoutMs = openTimeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.sessionListeners = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.ws.removeEventListener('open', onOpen);
        this.ws.removeEventListener('error', onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = event => {
        cleanup();
        reject(event instanceof Error ? event : new Error('CDP WebSocket failed to open'));
      };
      this.ws.addEventListener('open', onOpen, { once: true });
      this.ws.addEventListener('error', onError, { once: true });
      timer = setTimeout(() => {
        cleanup();
        try { this.ws.close(); } catch { /* best-effort timeout close */ }
        reject(new Error('Timed out opening CDP WebSocket'));
      }, this.openTimeoutMs);
    });
    this.ws.addEventListener('message', event => {
      if (DEBUG_CDP) {
        process.stderr.write(`[cdp] received ${typeof event.data}/${event.data?.constructor?.name || 'unknown'}\n`);
      }
      void this.#receive(event.data).catch(error => {
        process.stderr.write(`[cdp] frame decode failed: ${error.message}\n`);
      });
    });
  }

  async #receive(raw) {
    let text;
    if (typeof raw === 'string') text = raw;
    else if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(raw);
    else if (raw && typeof raw.text === 'function') text = await raw.text();
    else text = String(raw);
    const message = JSON.parse(text);
    if (DEBUG_CDP) {
      process.stderr.write(`[cdp] message ${message.method || `response:${message.id}`}${message.error ? ` error=${message.error.message}` : ''}\n`);
    }
    if (message.id != null) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
      return;
    }
    if (!message.method) return;
    for (const listener of this.listeners.get(message.method) || []) {
      try { listener(message.params || {}); } catch { /* diagnostic listener */ }
    }
    if (message.sessionId) {
      const key = `${message.sessionId}:${message.method}`;
      for (const listener of this.sessionListeners.get(key) || []) {
        try { listener(message.params || {}); } catch { /* diagnostic listener */ }
      }
    }
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  onSession(sessionId, method, listener) {
    const key = `${sessionId}:${method}`;
    const listeners = this.sessionListeners.get(key) || [];
    listeners.push(listener);
    this.sessionListeners.set(key, listeners);
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP request timed out: ${method}`));
      }, DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
    });
    const payload = JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params });
    if (DEBUG_CDP) process.stderr.write(`[cdp] send ${method} (${this.ws.readyState})${sessionId ? ` session=${sessionId}` : ''}\n`);
    this.ws.send(payload);
    return response;
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('CDP connection closed'));
    }
    this.pending.clear();
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

class CdpSession {
  constructor(client, sessionId) {
    this.client = client;
    this.sessionId = sessionId;
  }

  on(method, listener) {
    this.client.onSession(this.sessionId, method, listener);
  }

  send(method, params = {}) {
    return this.client.send(method, params, this.sessionId);
  }
}

class BrowserDriver {
  constructor(client) {
    this.client = client;
  }

  async evaluate(expression) {
    const result = await this.client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || 'browser evaluation failed';
      throw new Error(description);
    }
    return result.result?.value;
  }

  async waitFor(expression, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const result = await this.evaluate(expression);
        if (result) return result;
      } catch (error) {
        lastError = error;
      }
      await delay(50);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
  }

  async navigate(url) {
    await this.client.send('Page.navigate', { url });
    await this.waitFor(
      `document.readyState === 'complete' && !!window.vugg && !!window.vugg.SCENARIOS`,
      `Vugg boot at ${url}`,
      BROWSER_NAVIGATION_TIMEOUT_MS,
    );
  }

  async reload() {
    await this.client.send('Page.reload', { ignoreCache: true });
    await this.waitFor(
      `document.readyState === 'complete' && !!window.vugg && !!window.vugg.SCENARIOS`,
      'Vugg reload',
      BROWSER_NAVIGATION_TIMEOUT_MS,
    );
  }

  async setViewport(width, height, mobile = false) {
    await this.client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
  }

  async setReducedMotion(enabled) {
    await this.client.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-reduced-motion', value: enabled ? 'reduce' : 'no-preference' }],
    });
  }

  async setSafeAreaInsets(insets = { top: 0, right: 0, bottom: 0, left: 0 }) {
    const authenticatedInsets = {
      top: insets.top,
      topMax: insets.top,
      right: insets.right,
      rightMax: insets.right,
      bottom: insets.bottom,
      bottomMax: insets.bottom,
      left: insets.left,
      leftMax: insets.left,
    };
    await this.client.send('Emulation.setSafeAreaInsetsOverride', { insets: authenticatedInsets });
  }

  async setValue(selector, value) {
    const encodedSelector = JSON.stringify(selector);
    const encodedValue = JSON.stringify(String(value));
    return this.evaluate(`(() => {
      const el = document.querySelector(${encodedSelector});
      if (!el) throw new Error('missing control: ' + ${encodedSelector});
      const own = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
      if (own && own.set) own.set.call(el, ${encodedValue});
      else el.value = ${encodedValue};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()`);
  }

  async elementRect(selector) {
    const encoded = JSON.stringify(selector);
    return this.evaluate(`(() => {
      const el = document.querySelector(${encoded});
      if (!el) throw new Error('missing element: ' + ${encoded});
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) throw new Error('element is not visible: ' + ${encoded});
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
  }

  async elementRectByExpression(expression, label) {
    return this.evaluate(`(() => {
      const el = (${expression});
      if (!el) throw new Error(${JSON.stringify(`missing element: ${label}`)});
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) throw new Error(${JSON.stringify(`element is not visible: ${label}`)});
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
  }

  async clickRect(rect) {
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    await this.client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1,
    });
    await this.client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
    });
  }

  async click(selector) {
    await this.clickRect(await this.elementRect(selector));
  }

  async clickExpression(expression, label) {
    await this.clickRect(await this.elementRectByExpression(expression, label));
  }

  async hover(selector) {
    const rect = await this.elementRect(selector);
    await this.client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
  }

  async key(key, code, windowsVirtualKeyCode) {
    const common = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode };
    await this.client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...common });
    await this.client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
  }
}

function assertBounds(rect, width, height, label) {
  assert.ok(rect.left >= -1, `${label} crosses viewport left edge (${rect.left}px)`);
  assert.ok(rect.top >= -1, `${label} crosses viewport top edge (${rect.top}px)`);
  assert.ok(rect.right <= width + 1, `${label} crosses viewport right edge (${rect.right}px > ${width}px)`);
  assert.ok(rect.bottom <= height + 1, `${label} crosses viewport bottom edge (${rect.bottom}px > ${height}px)`);
}

function assertSafeBounds(rect, width, height, insets, label) {
  assert.ok(rect.left >= insets.left - 1, `${label} crosses safe-area left edge`);
  assert.ok(rect.top >= insets.top - 1, `${label} crosses safe-area top edge`);
  assert.ok(rect.right <= width - insets.right + 1, `${label} crosses safe-area right edge`);
  assert.ok(rect.bottom <= height - insets.bottom + 1, `${label} crosses safe-area bottom edge`);
}

async function runWorkflow(driver, diagnostics) {
  const checks = [];
  async function check(name, task) {
    const started = performance.now();
    await task();
    checks.push({ name, duration_ms: Math.round(performance.now() - started) });
    process.stdout.write(`✓ ${name}\n`);
  }

  const baseUrl = diagnostics.base_url;
  await driver.setViewport(1280, 720, false);
  await driver.setReducedMotion(false);
  await driver.navigate(`${baseUrl}/?v=${SIM_VERSION}&browser_qa=1`);

  await check('boots the exact SIM and lists authored scenarios', async () => {
    const identity = await driver.evaluate(`({
      sim: window.vugg.SIM_VERSION,
      scenarios: window.vugg.listScenarios().filter(x => !x.startsWith('tutorial_')).length,
      scenario_options: document.querySelectorAll('#scenario option').length,
      scenario_panel_buttons: document.querySelectorAll('#scenarios-panel-groups button').length,
      file_bundle: window.__VUGG_FILE_BUNDLE_RECEIPT || null,
      title: document.title,
    })`);
    assert.equal(identity.sim, SIM_VERSION);
    assert.equal(identity.scenarios, 38);
    assert.equal(identity.scenario_options, 38);
    assert.equal(identity.scenario_panel_buttons, 45);
    assert.deepEqual(identity.file_bundle, {
      // file-bundle-assets.mjs is the producer; keep this browser consumer on
      // its exported contract instead of duplicating a version literal.
      schema: FILE_BUNDLE_ASSET_SCHEMA,
      asset_count: FILE_BUNDLE_ASSET_COUNT,
      sha256: FILE_BUNDLE_ASSET_SHA256,
    });
    assert.match(identity.title, /Vugg/i);
  });

  await check('cancels a progressive Simulation run through the N shortcut', async () => {
    await driver.setValue('#scenario', 'cooling');
    await driver.setValue('#seed', TEST_SEED);
    await driver.setValue('#shape-seed', '');
    await driver.setValue('#steps', 120);
    await driver.click('#btn-grow');
    await driver.waitFor(`!!document.querySelector('.simulation-precompute')`, 'Simulation precompute');
    await driver.key('n', 'KeyN', 78);
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#new-game-panel')).display !== 'none'`,
      'New Game menu after cancellation',
    );
    const cancelled = await driver.evaluate(`({
      step: window.vugg.legendsSim?.step ?? -1,
      growDisabled: document.querySelector('#btn-grow').disabled,
    })`);
    assert.ok(cancelled.step >= 0 && cancelled.step < 120, `cancelled at unexpected step ${cancelled.step}`);
    assert.equal(cancelled.growDisabled, false);
    await delay(250);
    assert.equal(await driver.evaluate(`window.vugg.legendsSim?.step ?? -1`), cancelled.step);
  });

  await driver.navigate(`${baseUrl}/?v=${SIM_VERSION}&browser_qa=complete`);
  await check('completes a deterministic short Simulation run', async () => {
    await driver.setValue('#scenario', 'cooling');
    await driver.setValue('#seed', TEST_SEED);
    await driver.setValue('#shape-seed', '');
    await driver.setValue('#steps', 2);
    await driver.click('#btn-grow');
    await driver.waitFor(
      `window.vugg.legendsSim?.step === 2 && !document.querySelector('.simulation-precompute')`,
      'short Simulation completion',
      30_000,
    );
    const run = await driver.evaluate(`({
      step: window.vugg.legendsSim.step,
      seed: window.vugg._lastRunMeta?.seed,
      shapeSeed: window.vugg._lastRunMeta?.shape_seed,
      narrative: document.body.classList.contains('legends-playing'),
    })`);
    assert.equal(run.step, 2);
    assert.equal(run.seed, TEST_SEED);
    assert.equal(run.shapeSeed, 1, 'blank shape input must preserve cooling\'s authored shape_seed');
    assert.equal(run.narrative, true);
    await driver.key('n', 'KeyN', 78);
  });

  await driver.navigate(`${baseUrl}/?v=${SIM_VERSION}&browser_qa=creative`);
  await check('selects an authored scenario through the Creative menu at seed 42', async () => {
    await driver.click('button[onclick="titleNewGame()"]');
    await driver.clickExpression(
      `Array.from(document.querySelectorAll('#new-game-panel button')).find(b => b.textContent.includes('Scenarios'))`,
      'Scenarios menu button',
    );
    await driver.click(`button[onclick*="startScenarioInCreative('mvt')"]`);
    await driver.waitFor(`window.vugg.fortressSim?.conditions?.wall?.shape_seed === 3`, 'MVT Creative start');
    const state = await driver.evaluate(`(() => {
      const saves = window.loadSaves();
      const active = saves.find(s => s.kind === 'auto' && s.origin?.scenario === 'mvt');
      return {
        scenario: active?.origin?.scenario,
        seed: active?.origin?.seed,
        shapeSeed: window.vugg.fortressSim.conditions.wall.shape_seed,
        step: window.vugg.fortressSim.step,
      };
    })()`);
    assert.deepEqual(state, { scenario: 'mvt', seed: TEST_SEED, shapeSeed: 3, step: 0 });
  });

  await check('edits live Creative chemistry and advances by button and keyboard', async () => {
    await driver.setValue('#broth-mn', 42);
    assert.equal(await driver.evaluate(`window.vugg.fortressSim.conditions.fluid.Mn`), 42);
    await driver.click('#f-advance');
    await driver.waitFor(`window.vugg.fortressSim.step === 1`, 'Creative Advance button');
    await driver.key('s', 'KeyS', 83);
    await driver.waitFor(`window.vugg.fortressSim.step === 2`, 'Creative S shortcut');
    await driver.key('s', 'KeyS', 83);
    await driver.waitFor(`window.vugg.fortressSim.step === 3`, 'third Creative state');
  });

  await check('shows causal mineral formation evidence by pointer and keyboard', async () => {
    await driver.waitFor(`!!document.querySelector('#f-sat-bar .sat-indicator')`, 'mineral saturation pill');
    await driver.hover('#f-sat-bar .sat-indicator');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#sat-hover-pop')).display !== 'none'`,
      'formation diagnosis hover',
    );
    const diagnosis = await driver.evaluate(`(() => {
      const el = document.querySelector('#sat-hover-pop');
      return {
        heading: el.querySelector('.nuc-pop-head')?.textContent || '',
        labels: Array.from(el.querySelectorAll('.nuc-pop-label')).map(x => x.textContent),
      };
    })()`);
    assert.match(diagnosis.heading, /Why did.*form\?/i);
    for (const required of ['Saturation', 'Calibrated growth budget', 'Temperature gate', 'pH gate', 'Redox gate', 'Substrate', 'Competition']) {
      assert.ok(diagnosis.labels.includes(required), `formation diagnosis lacks ${required}`);
    }
    await driver.evaluate(`document.querySelector('#f-sat-bar .sat-indicator').focus()`);
    await driver.key('Enter', 'Enter', 13);
    await driver.waitFor(
      `document.querySelector('#sat-hover-pop')?.classList.contains('is-pinned')
        && document.activeElement?.matches('[data-nuc-pop-close]')`,
      'keyboard-pinned formation diagnosis with focused Close control',
    );
    const keyboardState = await driver.evaluate(`(() => {
      const pill = document.querySelector('#f-sat-bar .sat-indicator');
      const dialog = document.querySelector('#sat-hover-pop');
      return {
        role: dialog?.getAttribute('role'),
        expanded: pill?.getAttribute('aria-expanded'),
        controls: pill?.getAttribute('aria-controls'),
      };
    })()`);
    assert.deepEqual(keyboardState, {
      role: 'dialog',
      expanded: 'true',
      controls: 'sat-hover-pop',
    });
    await driver.key('Escape', 'Escape', 27);
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#sat-hover-pop')).display === 'none'
        && document.activeElement?.matches('#f-sat-bar .sat-indicator')`,
      'Escape closes diagnosis and restores mineral focus',
    );
  });

  await check('shows storage denial globally during active Creative play and retries durably', async () => {
    await driver.waitFor(
      `document.querySelector('.action-btn.act-warm')?.disabled === false`,
      'Creative action controls after narrative pacing',
    );
    await driver.evaluate(`(() => {
      window.__vuggNativeStorageSetItem = Storage.prototype.setItem;
      window.__vuggDeniedSaveWrites = 0;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'vugg-saves-v1.pending') {
          window.__vuggDeniedSaveWrites += 1;
          throw new DOMException('browser storage denial', 'QuotaExceededError');
        }
        return window.__vuggNativeStorageSetItem.call(this, key, value);
      };
    })()`);
    await driver.click('.action-btn.act-warm');
    await driver.waitFor(
      `window.__vuggDeniedSaveWrites > 0 && /newest changes remain in memory/i.test(window._liveSaveStorageNotice() || '')`,
      'intercepted autosave denial',
    );
    const visibleFailure = await driver.evaluate(`(() => {
      const banner = document.querySelector('#saves-storage-notice');
      const rect = banner.getBoundingClientRect();
      return {
        display: getComputedStyle(banner).display,
        width: rect.width,
        height: rect.height,
        fortressVisible: getComputedStyle(document.querySelector('#fortress-panel')).display !== 'none',
        text: banner.textContent || '',
      };
    })()`);
    assert.equal(visibleFailure.fortressVisible, true);
    assert.notEqual(visibleFailure.display, 'none');
    assert.ok(visibleFailure.width > 0 && visibleFailure.height > 0, 'global storage banner has no rendered rect');
    assert.match(visibleFailure.text, /newest changes remain in memory/i);
    assert.equal(await driver.evaluate(`(() => {
      Storage.prototype.setItem = window.__vuggNativeStorageSetItem;
      delete window.__vuggNativeStorageSetItem;
      delete window.__vuggDeniedSaveWrites;
      return window._savePersistActive();
    })()`), true);
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#saves-storage-notice')).display === 'none'`,
      'storage failure banner clears after durable retry',
    );
  });

  await check('manual-saves, recovers corruption, reloads, and restores Creative state', async () => {
    diagnostics.dialog_prompt = MANUAL_SAVE_NAME;
    await driver.click('#mode-saves');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#saves-panel')).display !== 'none'`,
      'Saves panel',
    );
    await driver.click('#saves-manual-btn');
    await driver.waitFor(
      `window.loadSaves().some(s => s.kind === 'manual' && s.name === ${JSON.stringify(MANUAL_SAVE_NAME)})`,
      'manual save receipt',
    );
    // Advance the active autosave through the real UI after the named manual
    // generation. Normal journal publication must rotate that manual-bearing
    // primary into backup; the recovery probe below may not seed backup itself.
    await driver.click('#mode-current');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#fortress-panel')).display !== 'none'`,
      'Creative panel before backup rotation',
    );
    await driver.click('.action-btn.act-warm');
    await driver.click('#mode-saves');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#saves-panel')).display !== 'none'`,
      'Saves panel after genuine backup rotation',
    );
    const recovered = await driver.evaluate(`(() => {
      const primary = JSON.parse(localStorage.getItem('vugg-saves-v1') || 'null');
      const backup = JSON.parse(localStorage.getItem('vugg-saves-v1.backup') || 'null');
      const rotation = {
        primaryGeneration: primary?.generation ?? null,
        backupGeneration: backup?.generation ?? null,
        backupDigestValid: !!backup && backup.storage_digest === window._saveEnvelopeDigest(backup),
        manualInBackup: !!backup && backup.records.some(s => s.kind === 'manual' && s.name === ${JSON.stringify(MANUAL_SAVE_NAME)}),
      };
      localStorage.setItem('vugg-saves-v1', '{browser-qa-corruption');
      localStorage.removeItem('vugg-saves-v1.pending');
      window.savesRender();
      const notice = document.querySelector('#saves-storage-notice');
      const corrupt = JSON.parse(localStorage.getItem('vugg-saves-v1.corrupt') || 'null');
      const primaryCorrupt = corrupt?.entries?.find(entry => entry.source === 'primary') || null;
      return {
        notice: notice?.textContent || '',
        visible: notice ? getComputedStyle(notice).display !== 'none' : false,
        quarantined: primaryCorrupt?.raw || null,
        manualPresent: window.loadSaves().some(s => s.kind === 'manual' && s.name === ${JSON.stringify(MANUAL_SAVE_NAME)}),
        rotation,
      };
    })()`);
    assert.equal(recovered.rotation.backupGeneration, recovered.rotation.primaryGeneration - 1);
    assert.equal(recovered.rotation.backupDigestValid, true);
    assert.equal(recovered.rotation.manualInBackup, true);
    assert.equal(recovered.visible, true);
    assert.match(recovered.notice, /Recovered .* from backup/);
    assert.equal(recovered.quarantined, '{browser-qa-corruption');
    assert.equal(recovered.manualPresent, true);
    await driver.reload();
    await driver.click('#title-btn-load');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#saves-panel')).display !== 'none'`,
      'Saves panel after reload',
    );
    await driver.clickExpression(
      `(() => {
        const row = Array.from(document.querySelectorAll('.save-row')).find(r => r.querySelector('.save-name')?.textContent === ${JSON.stringify(MANUAL_SAVE_NAME)});
        return row && Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Load');
      })()`,
      'named save Load button',
    );
    await driver.waitFor(`window.vugg.fortressSim?.step === 3`, 'save replay to step 3', 30_000);
    const restored = await driver.evaluate(`({
      step: window.vugg.fortressSim.step,
      mn: window.vugg.fortressSim.conditions.fluid.Mn,
      shapeSeed: window.vugg.fortressSim.conditions.wall.shape_seed,
    })`);
    assert.deepEqual(restored, { step: 3, mn: 42, shapeSeed: 3 });
  });

  await check('pauses and resumes authenticated wall replay', async () => {
    const historyLength = await driver.evaluate(`window.vugg.fortressSim.wall_state_history.length`);
    assert.ok(historyLength >= 3, `wall replay has only ${historyLength} frames`);
    const authentication = await driver.evaluate(`(() => {
      const sim = window.vugg.fortressSim;
      return sim.wall_state_history.map((snapshot, index) => {
        const decision = _topoReplayRenderDecision(sim.wall_state, snapshot);
        return { index, mode: decision.mode, message: decision.message || null };
      });
    })()`);
    assert.equal(authentication.length, historyLength);
    assert.ok(
      authentication.every(row => row.mode === 'cavity-field' && row.message === null),
      `restored replay authentication failed: ${JSON.stringify(authentication)}`,
    );
    await driver.click('#topo-replay-btn');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#topo-replay-bar')).display !== 'none'`,
      'replay controls',
    );
    await driver.click('#topo-replay-playpause');
    const renderedAuthority = await driver.evaluate(`(() => {
      const sim = window.vugg.fortressSim;
      const decision = _topoReplayRenderDecision(sim.wall_state, _topoReplayActiveSnap);
      return {
        mode: decision.mode,
        message: decision.message || null,
        rendererPresent: !!(_topoThreeState && _topoThreeState.cavity),
        authorityUnrenderable: _topoThreeState
          ? _topoThreeState.cavityAuthorityUnrenderable === true
          : null,
        cavityVisible: _topoThreeState?.cavity?.visible === true,
      };
    })()`);
    assert.equal(renderedAuthority.mode, 'cavity-field');
    assert.equal(renderedAuthority.message, null);
    assert.equal(renderedAuthority.rendererPresent, true);
    assert.equal(renderedAuthority.authorityUnrenderable, false);
    assert.equal(renderedAuthority.cavityVisible, true);
    const paused = await driver.evaluate(`document.querySelector('#topo-replay-scrub').value`);
    await delay(150);
    assert.equal(await driver.evaluate(`document.querySelector('#topo-replay-scrub').value`), paused);
    await driver.key(' ', 'Space', 32);
    await driver.waitFor(
      `document.querySelector('#topo-replay-scrub').value !== ${JSON.stringify(paused)}`,
      'Space resumes replay',
    );
    await driver.key('Escape', 'Escape', 27);
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#topo-replay-bar')).display === 'none'`,
      'Escape stops replay',
    );
  });

  await check('keeps the active Creative workspace inside a phone viewport', async () => {
    const safeInsets = { top: 24, right: 12, bottom: 20, left: 12 };
    await driver.setViewport(390, 844, true);
    await driver.setSafeAreaInsets(safeInsets);
    const layout = await driver.evaluate(`({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      advance: (() => { const r = document.querySelector('#f-advance').getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
    })`);
    assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `horizontal overflow ${layout.scrollWidth}px > ${layout.innerWidth}px`);
    assert.ok(layout.advance.width >= 44 && layout.advance.height >= 44, 'Advance touch target is smaller than 44px');
    await driver.click('#f-sat-bar .sat-indicator');
    await driver.waitFor(`document.querySelector('#sat-hover-pop')?.classList.contains('is-pinned')`, 'tap-pinned diagnosis');
    const pop = await driver.evaluate(`(() => {
      const r = document.querySelector('#sat-hover-pop').getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    })()`);
    assertBounds(pop, 390, 844, 'formation diagnosis');
    assertSafeBounds(pop, 390, 844, safeInsets, 'formation diagnosis');
    await driver.click('[data-nuc-pop-close]');
    await driver.setSafeAreaInsets();
  });

  await check('honors reduced motion without altering the simulation state', async () => {
    const before = await driver.evaluate(`window.vugg.fortressSim.step`);
    await driver.setReducedMotion(true);
    const motion = await driver.evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('#f-sat-bar .sat-indicator'));
      return {
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        transitionDuration: style.transitionDuration,
        animationDuration: style.animationDuration,
      };
    })()`);
    assert.equal(motion.matches, true);
    const durations = `${motion.transitionDuration},${motion.animationDuration}`
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000);
    assert.ok(durations.every(value => value <= 0.011), `motion durations were not collapsed: ${durations.join(', ')}`);
    assert.equal(await driver.evaluate(`window.vugg.fortressSim.step`), before);
  });

  await check('persists accessible text scale and explicit motion controls without changing geology', async () => {
    await driver.setReducedMotion(false);
    const before = await driver.evaluate(`window.vugg.fortressSim.step`);
    await driver.click('#settings-btn');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#settings-panel')).display !== 'none'
        && document.activeElement?.id === 'settings-close'`,
      'Settings dialog and initial focus',
    );
    await driver.setValue('#settings-text-scale', 1.5);
    await driver.setValue('#settings-motion', 'reduced');
    const state = await driver.evaluate(`(() => {
      const root = JSON.parse(localStorage.getItem('vugg-settings-v1') || '{}');
      const style = getComputedStyle(document.querySelector('#f-sat-bar .sat-indicator'));
      const panelRect = document.querySelector('#settings-panel').getBoundingClientRect();
      const closeRect = document.querySelector('#settings-close').getBoundingClientRect();
      return {
        stored: root.display,
        rootSize: document.documentElement.style.fontSize,
        rootMotion: document.documentElement.dataset.vuggMotion,
        transitionDuration: style.transitionDuration,
        animationDuration: style.animationDuration,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        visualWidth: visualViewport ? visualViewport.width : innerWidth,
        panel: { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom },
        close: { width: closeRect.width, height: closeRect.height },
      };
    })()`);
    assert.deepEqual(state.stored, { fontScale: 1.5, motion: 'reduced' });
    assert.equal(state.rootSize, '150%');
    assert.equal(state.rootMotion, 'reduced');
    assert.ok(
      state.scrollWidth <= state.visualWidth + 1,
      `150% text introduced horizontal page overflow (${state.scrollWidth}px > ${state.visualWidth}px)`,
    );
    assertBounds(state.panel, state.visualWidth, 844, 'scaled Settings dialog');
    assert.ok(state.close.width >= 44 && state.close.height >= 44, 'Settings Close target is below 44px');
    const durations = `${state.transitionDuration},${state.animationDuration}`
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000);
    assert.ok(durations.every(value => value <= 0.011), `explicit reduced motion did not collapse CSS motion: ${durations.join(', ')}`);
    assert.equal(await driver.evaluate(`window.vugg.fortressSim.step`), before);
    await driver.key('Escape', 'Escape', 27);
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#settings-panel')).display === 'none'
        && document.activeElement?.id === 'settings-btn'`,
      'Settings Escape close and focus restoration',
    );
    await driver.evaluate(`displaySetFontScale(1); displaySetMotion('system')`);
  });

  await check('fits title and Creative setup across the responsive viewport matrix', async () => {
    await driver.setReducedMotion(false);
    const viewports = [
      { name: 'narrow portrait', width: 320, height: 568, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
      { name: 'phone portrait', width: 390, height: 844, safe: { top: 24, right: 12, bottom: 20, left: 12 } },
      { name: 'phone landscape', width: 844, height: 390, safe: { top: 0, right: 28, bottom: 12, left: 28 } },
      { name: 'tablet portrait', width: 768, height: 1024, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
    ];
    for (const viewport of viewports) {
      await driver.setViewport(viewport.width, viewport.height, true);
      await driver.setSafeAreaInsets(viewport.safe);
      await driver.navigate(`${baseUrl}/?v=${SIM_VERSION}&browser_qa=responsive-${encodeURIComponent(viewport.name)}`);
      // A navigation may replace the renderer process. Reapply the emulated
      // display cutout to the new document before measuring CSS env() values.
      await driver.setSafeAreaInsets(viewport.safe);
      const layout = await driver.evaluate(`(() => {
        const safe = ${JSON.stringify(viewport.safe)};
        const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const offenders = Array.from(document.querySelectorAll('button, input, select, .title-logo, .controls'))
          .filter(visible)
          .map(el => {
            const r = el.getBoundingClientRect();
            return { tag: el.id || el.className || el.tagName, left: r.left, right: r.right, width: r.width };
          })
          .filter(r => r.left < safe.left - 1 || r.right > innerWidth - safe.right + 1);
        const bodyStyle = getComputedStyle(document.body);
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenders,
          padding: {
            top: parseFloat(bodyStyle.paddingTop), right: parseFloat(bodyStyle.paddingRight),
            bottom: parseFloat(bodyStyle.paddingBottom), left: parseFloat(bodyStyle.paddingLeft),
          },
        };
      })()`);
      assert.ok(layout.scrollWidth <= layout.width + 1,
        `${viewport.name} title overflow ${layout.scrollWidth}px > ${layout.width}px`);
      assert.deepEqual(layout.offenders, [], `${viewport.name} title has controls outside its safe viewport`);
      assert.ok(layout.padding.left >= viewport.safe.left && layout.padding.right >= viewport.safe.right,
        `${viewport.name} body ignores horizontal safe-area insets`);
      assert.ok(layout.padding.top >= viewport.safe.top && layout.padding.bottom >= viewport.safe.bottom,
        `${viewport.name} body ignores vertical safe-area insets`);
    }

    await driver.setViewport(320, 568, true);
    await driver.setSafeAreaInsets();
    await driver.navigate(`${baseUrl}/?v=${SIM_VERSION}&browser_qa=responsive-creative-setup`);
    await driver.click('button[onclick="titleNewGame()"]');
    await driver.click('button[onclick="menuGo(\'fortress\')"]');
    await driver.waitFor(
      `getComputedStyle(document.querySelector('#fortress-setup')).display !== 'none'`,
      'Creative setup on narrow phone',
    );
    const setup = await driver.evaluate(`(() => {
      const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const controls = Array.from(document.querySelectorAll('#fortress-setup input, #fortress-setup select, #fortress-setup button'))
        .filter(visible)
        .map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.id || el.textContent.trim(), type: el.type || el.tagName, left: r.left, right: r.right, height: r.height };
        });
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOffenders: controls.filter(r => r.left < -1 || r.right > innerWidth + 1),
        undersized: controls.filter(r => ['range', 'checkbox', 'number', 'button', 'select-one'].includes(r.type) && r.height < 43.5),
      };
    })()`);
    assert.ok(setup.scrollWidth <= setup.width + 1,
      `Creative setup overflow ${setup.scrollWidth}px > ${setup.width}px`);
    assert.deepEqual(setup.horizontalOffenders, [], 'Creative setup has clipped controls');
    assert.deepEqual(setup.undersized, [], 'Creative setup has touch targets below 44px');
  });

  return checks;
}

async function main() {
  const browserPath = findBrowser();
  const serverPort = await freePort();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'vugg-browser-qa-'));
  const serverNonce = randomUUID();
  let server = null;
  let browser = null;
  let client = null;
  let pageClient = null;
  let browserRootPid = null;
  let browserProcessReceipts = [];
  const diagnostics = {
    schema: 1,
    sim_version: SIM_VERSION,
    seed: TEST_SEED,
    browser_path: browserPath,
    base_url: `http://127.0.0.1:${serverPort}`,
    dialog_prompt: null,
    dialogs: [],
    runtime_exceptions: [],
    severe_log_entries: [],
    http_errors: [],
    server_stderr: '',
    browser_stderr: '',
  };

  try {
    server = spawnOwned(process.execPath, ['tools/serve-local.mjs', String(serverPort)], {
      cwd: ROOT,
      env: { ...process.env, VUGG_SERVER_NONCE: serverNonce },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    drainOwnedPipe(server.stderr, diagnostics, 'server_stderr');
    await waitForHttp(`${diagnostics.base_url}/?v=${SIM_VERSION}`, server, {
      expectedNonce: serverNonce,
    });

    browser = spawnOwned(browserPath, [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      // The Windows desktop runner denies sandboxed child-process access
      // before CDP can initialize. This profile loads only the authenticated
      // loopback server, with background networking disabled.
      '--no-sandbox',
      '--mute-audio',
      'about:blank',
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    drainOwnedPipe(browser.stderr, diagnostics, 'browser_stderr');
    const devTools = await waitForDevToolsReceipt(profileDir, browser);
    const versionUrl = `http://127.0.0.1:${devTools.port}/json/version`;
    const version = await fetchWithDeadline(versionUrl, {
      options: { cache: 'no-store' },
      consume: async response => {
        if (!response.ok) throw new Error(`DevTools version endpoint returned HTTP ${response.status}`);
        return response.json();
      },
    });
    assertOwnedDevToolsVersion(version, devTools);
    let ownedBrowser;
    try {
      ownedBrowser = await captureOwnedBrowserProcessReceiptsForPort(devTools.port);
    } catch (error) {
      throw new Error(`${error.message}; launcher exit=${browser.exitCode}, signal=${browser.signalCode}; browser stderr=${diagnostics.browser_stderr || '(empty)'}`, { cause: error });
    }
    browserRootPid = ownedBrowser.rootPid;
    browserProcessReceipts = ownedBrowser.receipts;
    diagnostics.browser_product = version.Browser;
    diagnostics.protocol_version = version['Protocol-Version'];
    client = new CdpClient(version.webSocketDebuggerUrl);
    await client.open();
    const targets = await fetchWithDeadline(`http://127.0.0.1:${devTools.port}/json/list`, {
      options: { cache: 'no-store' },
      consume: async response => {
        if (!response.ok) throw new Error(`DevTools target list returned HTTP ${response.status}`);
        return response.json();
      },
    });
    const pageTarget = targets.find(target => target?.type === 'page' && target?.url === 'about:blank');
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('owned browser did not publish its initial page target endpoint');
    }
    let pageInitializationError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      pageClient = new CdpClient(pageTarget.webSocketDebuggerUrl);
      await pageClient.open();
      try {
        await pageClient.send('Page.enable');
        pageInitializationError = null;
        break;
      } catch (error) {
        pageInitializationError = error;
        pageClient.close();
        if (attempt < 2) await delay(100);
      }
    }
    if (pageInitializationError) {
      throw new Error(`owned page target did not initialize after two bounded attempts: ${pageInitializationError.message}`, {
        cause: pageInitializationError,
      });
    }
    const session = pageClient;
    await Promise.all([
      session.send('Runtime.enable'),
      session.send('Log.enable'),
      session.send('Network.enable'),
    ]);
    session.on('Runtime.exceptionThrown', event => {
      diagnostics.runtime_exceptions.push(
        event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'unknown exception',
      );
    });
    session.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level !== 'error') return;
      diagnostics.severe_log_entries.push({
        text: entry.text || 'unknown log error',
        url: entry.url || null,
        source: entry.source || null,
      });
    });
    session.on('Network.responseReceived', ({ response }) => {
      if (response?.status >= 400) {
        diagnostics.http_errors.push({ status: response.status, url: response.url });
      }
    });
    session.on('Page.javascriptDialogOpening', event => {
      const expected = event.type === 'prompt'
        && event.message === 'Name this save:'
        && diagnostics.dialog_prompt === MANUAL_SAVE_NAME;
      diagnostics.dialogs.push({
        type: event.type,
        message: event.message,
        default_prompt: event.defaultPrompt || '',
        expected,
      });
      void session.send('Page.handleJavaScriptDialog', {
        accept: expected,
        promptText: expected ? MANUAL_SAVE_NAME : '',
      });
      diagnostics.dialog_prompt = null;
    });
    await session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        Object.defineProperty(Date, 'now', { value: () => ${TEST_SEED}, configurable: true });
        Object.defineProperty(HTMLMediaElement.prototype, 'play', {
          value: function () { return Promise.resolve(); }, configurable: true,
        });
      `,
    });

    const driver = new BrowserDriver(session);
    const checks = await runWorkflow(driver, diagnostics);
    assert.deepEqual(diagnostics.runtime_exceptions, [], 'uncaught browser exceptions were recorded');
    assert.deepEqual(diagnostics.severe_log_entries, [], 'severe browser log entries were recorded');
    assert.deepEqual(diagnostics.http_errors, [], 'HTTP resource errors were recorded');
    assert.deepEqual(
      diagnostics.dialogs.map(dialog => ({
        type: dialog.type,
        message: dialog.message,
        expected: dialog.expected,
      })),
      [{ type: 'prompt', message: 'Name this save:', expected: true }],
      'unexpected or missing browser dialog',
    );
    process.stdout.write(`${JSON.stringify({
      ok: true,
      schema: diagnostics.schema,
      sim_version: diagnostics.sim_version,
      seed: diagnostics.seed,
      browser: diagnostics.browser_product,
      checks,
    }, null, 2)}\n`);
  } finally {
    let receiptCaptureFailure = null;
    if (client) {
      try {
        const latestReceipts = await captureOwnedBrowserProcessReceipts(browserRootPid);
        const byIdentity = new Map(browserProcessReceipts.map(receipt => [
          `${receipt.pid}|${receipt.start_ticks}|${receipt.executable_path}`,
          receipt,
        ]));
        for (const receipt of latestReceipts) {
          byIdentity.set(`${receipt.pid}|${receipt.start_ticks}|${receipt.executable_path}`, receipt);
        }
        browserProcessReceipts = [...byIdentity.values()];
      } catch (error) {
        // The browser connection may already be unhealthy because the primary
        // workflow failed. A previously captured, CDP-authenticated process
        // fleet remains valid cleanup authority; fail only when no such
        // ownership receipt was ever established.
        if (!browserProcessReceipts.length) receiptCaptureFailure = error;
      }
      const gracefulClose = client.send('Browser.close').catch(() => null);
      await Promise.race([gracefulClose, delay(2_000)]);
      await waitForOwnedExit(browser, 5_000);
    }
    await runCleanupActions([
      ['authenticated browser process receipt', async () => {
        if (receiptCaptureFailure) throw receiptCaptureFailure;
      }],
      ['page CDP client', async () => pageClient?.close()],
      ['CDP client', async () => client?.close()],
      ['browser process', async () => terminateOwned(browser, { tree: true })],
      ['authenticated browser descendants', async () => terminateOwnedProcessReceipts(browserProcessReceipts)],
      ['local server process', async () => terminateOwned(server)],
      ['temporary browser profile', async () => {
        await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
      }],
    ]);
  }
}

export {
  assertOwnedDevToolsVersion,
  BROWSER_NAVIGATION_TIMEOUT_MS,
  BrowserDriver,
  captureOwnedBrowserProcessReceipts,
  captureOwnedBrowserProcessReceiptsForPort,
  CdpClient,
  fetchWithDeadline,
  formatErrorTree,
  findOwnedBrowserRootPid,
  ownedProcessExited,
  runCleanupActions,
  spawnOwned,
  terminateOwned,
  terminateOwnedProcessReceipts,
  waitForHttp,
  waitForDevToolsReceipt,
  waitForOwnedExit,
  windowsProcessTree,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(formatErrorTree(error));
    process.exitCode = 1;
  });
}
