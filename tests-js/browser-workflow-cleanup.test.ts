import { EventEmitter } from 'node:events';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertOwnedDevToolsVersion,
  BROWSER_NAVIGATION_TIMEOUT_MS,
  BrowserDriver,
  captureOwnedBrowserProcessReceipts,
  captureOwnedBrowserProcessReceiptsForPort,
  CdpClient,
  findOwnedBrowserRootPid,
  NATIVE_HELPER_CALL_TIMEOUT_MS,
  NATIVE_HELPER_COMPILE_TIMEOUT_MS,
  NATIVE_HELPER_LOAD,
  ownedProcessExited,
  runCleanupActions,
  spawnOwned,
  terminateOwned,
  terminateOwnedProcessReceipts,
  waitForHttp,
  waitForDevToolsReceipt,
  waitForOwnedExit,
  windowsOwnedProcessSnapshot,
  windowsProcessTree,
} from '../tools/browser-workflow.mjs';

const HELPER_IMAGE = 'TVqQAAMAAAAEAAAA//8AALgAAAA=';
type HelperCall = { command: string; timeout: number; env: Record<string, string> };
// Answers the one-time helper compile with the loaded type name and its image,
// and every capture with `stdout`, recording each PowerShell command and budget.
function fakePowerShell(stdout: string, {
  compile = async () => ({ stdout: `VuggProcessTree\r\n${HELPER_IMAGE}\r\n` }),
}: { compile?: () => Promise<{ stdout: string }> } = {}) {
  const calls: HelperCall[] = [];
  const runner = async (_file: string, args: string[], options: { timeout: number; env: Record<string, string> }) => {
    const command = args[args.length - 1];
    calls.push({ command, timeout: options.timeout, env: options.env });
    return command.includes('-OutputAssembly') ? compile() : { stdout };
  };
  return { runner: runner as never, calls };
}

class FakeOwnedProcess extends EventEmitter {
  pid: number;
  exitCode: number | null;
  signalCode: string | null;
  killSignals: string[];

  constructor(pid: number, exitCode: number | null = null) {
    super();
    this.pid = pid;
    this.exitCode = exitCode;
    this.signalCode = null;
    this.killSignals = [];
  }

  kill(signal = 'SIGTERM') {
    this.killSignals.push(signal);
    this.signalCode = signal;
    this.emit('exit', null, signal);
    return true;
  }
}

describe('browser workflow owned-resource cleanup', () => {
  it('preserves the native port-owner lifetime separately from enumerated rows', async () => {
    const {runner} = fakePowerShell('OWNER|5000|500000|500100|C:\\Chrome\\chrome.exe\n5000|4000|500000|C:\\Chrome\\chrome.exe\n');
    const snapshot = await windowsProcessTree({ownerPort: 43123, execFileRunner: runner});
    expect(snapshot).toEqual({rootPid: 5000, listenerStartTicks: '500100',
      rootReceipt: {pid: 5000, start_ticks: '500000', executable_path: 'C:\\Chrome\\chrome.exe'},
      rows: [{pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'C:\\Chrome\\chrome.exe'}]});
  });

  it('compiles the process-tree helper once under the setup budget and loads its bytes for each capture', async () => {
    const {runner, calls} = fakePowerShell('5000|4000|500000|C:\\Chrome\\chrome.exe\n');
    await windowsProcessTree({execFileRunner: runner});
    await windowsProcessTree({execFileRunner: runner, ownerPort: 43123});
    expect(calls.map(call => call.timeout)).toEqual([
      NATIVE_HELPER_COMPILE_TIMEOUT_MS, NATIVE_HELPER_CALL_TIMEOUT_MS, NATIVE_HELPER_CALL_TIMEOUT_MS,
    ]);
    // The cold-runner overrun was the compile, not an observation: setup gets
    // a hang budget an order of magnitude above the slowest first capture seen.
    expect(NATIVE_HELPER_COMPILE_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
    expect(NATIVE_HELPER_CALL_TIMEOUT_MS).toBe(10_000);
    const [compile, ...captures] = calls;
    expect(compile.command).toMatch(/^Add-Type -TypeDefinition \$env:VUGG_NATIVE_HELPER_SOURCE -OutputAssembly /);
    expect(compile.env.VUGG_NATIVE_HELPER_SOURCE).toContain('public static class VuggProcessTree');
    expect(compile.env.VUGG_NATIVE_HELPER_TYPE).toBe('VuggProcessTree');
    expect(NATIVE_HELPER_LOAD).toBe('[void][Reflection.Assembly]::Load([Convert]::FromBase64String($env:VUGG_NATIVE_HELPER_IMAGE))');
    for (const capture of captures) {
      expect(capture.command.startsWith(`${NATIVE_HELPER_LOAD}; [VuggProcessTree]::`)).toBe(true);
      expect(capture.command).not.toMatch(/-TypeDefinition|-Path|-OutputAssembly/);
      expect(capture.env.VUGG_NATIVE_HELPER_IMAGE).toBe(HELPER_IMAGE);
    }
    expect(captures.map(call => call.command.split('::').at(-1))).toEqual([
      'Rows()', 'RowsAndOwner([int]$env:VUGG_DEVTOOLS_PORT)',
    ]);
  });

  it('shares one helper compile between concurrent first captures', async () => {
    let compiles = 0;
    let release: (value: { stdout: string }) => void = () => {};
    const compiled = new Promise<{ stdout: string }>(resolve => { release = resolve; });
    const {runner, calls} = fakePowerShell('5000|4000|500000|chrome.exe\n', {
      compile: () => { compiles += 1; return compiled; },
    });
    const captures = Promise.all([windowsProcessTree({execFileRunner: runner}), windowsProcessTree({execFileRunner: runner})]);
    release({stdout: `VuggProcessTree\r\n${HELPER_IMAGE}\r\n`});
    await captures;
    expect(compiles).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it('compiles again after a failed compile instead of caching the failure', async () => {
    let compiles = 0;
    const {runner, calls} = fakePowerShell('5000|4000|500000|chrome.exe\n', {
      compile: async () => {
        if (++compiles === 1) throw Object.assign(new Error('Command failed'), {killed: true, signal: 'SIGTERM'});
        return {stdout: `VuggProcessTree\r\n${HELPER_IMAGE}\r\n`};
      },
    });
    await expect(windowsProcessTree({execFileRunner: runner})).rejects.toThrow(/Command failed/);
    expect(calls).toHaveLength(1);
    await expect(windowsProcessTree({execFileRunner: runner})).resolves.toHaveLength(1);
    expect(calls.map(call => call.command.includes('-OutputAssembly'))).toEqual([true, true, false]);
  });

  it.each(['', 'VuggProcessTree', `OtherHelper\r\n${HELPER_IMAGE}`, 'VuggProcessTree\r\nnot an image!'])(
    'refuses a helper compile that did not load the expected type and image: %j', async stdout => {
      const {runner, calls} = fakePowerShell('5000|4000|500000|chrome.exe\n', {compile: async () => ({stdout})});
      await expect(windowsProcessTree({execFileRunner: runner})).rejects.toThrow(/did not load from its compiled assembly/);
      expect(calls).toHaveLength(1);
    },
  );

  it('prepares the owner observer with the same compiled helper its observation loads', async () => {
    const {runner, calls} = fakePowerShell('OWNER|5000|500000|500100|chrome.exe\n5000|4000|500000|chrome.exe\n');
    const observer = windowsOwnedProcessSnapshot({execFileRunner: runner});
    await observer.prepare();
    expect(calls.map(call => call.timeout)).toEqual([NATIVE_HELPER_COMPILE_TIMEOUT_MS]);
    await expect(observer(43123)).resolves.toMatchObject({rootPid: 5000, listenerStartTicks: '500100'});
    expect(calls.map(call => call.timeout)).toEqual([NATIVE_HELPER_COMPILE_TIMEOUT_MS, NATIVE_HELPER_CALL_TIMEOUT_MS]);
  });

  it('finishes a slow helper compile before the owner-observation deadline starts', async () => {
    const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const snapshot = {rootPid: 5000, rootReceipt: root, listenerStartTicks: '500100', rows: [{...root, parentPid: 4000}]};
    const order: string[] = [];
    const owned = await captureOwnedBrowserProcessReceiptsForPort(43123, {
      platform: 'win32', timeoutMs: 20,
      ownedSnapshotProvider: Object.assign(async () => { order.push('observe'); return snapshot; }, {
        prepare: async () => { await new Promise(resolve => setTimeout(resolve, 100)); order.push('prepared'); },
      }),
    });
    expect(order).toEqual(['prepared', 'observe']);
    expect(owned.receipts.map(row => row.pid)).toEqual([5000]);
    // Negative control: the same 20 ms deadline still bounds the observation.
    await expect(captureOwnedBrowserProcessReceiptsForPort(43123, {
      platform: 'win32', timeoutMs: 20,
      ownedSnapshotProvider: Object.assign(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return snapshot;
      }, {prepare: async () => {}}),
    })).rejects.toThrow(/DevTools owner observation timed out/);
  });

  it.skipIf(process.platform !== 'win32')('captures this process through the compiled helper', async () => {
    const self = (await windowsProcessTree()).find(row => row.pid === process.pid);
    expect(self?.start_ticks).toMatch(/^[1-9]\d*$/);
    expect(realpathSync.native(self?.executable_path || '.').toLowerCase())
      .toBe(realpathSync.native(process.execPath).toLowerCase());
  });

  it('binds the listening owner to the same captured lifetime', async () => {
    const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const owned = await captureOwnedBrowserProcessReceiptsForPort(43123, {
      platform: 'win32',
      ownedSnapshotProvider: async () => ({rootPid: 5000, rootReceipt: root, listenerStartTicks: '500100',
        rows: [{...root, parentPid: 4000}, {pid: 5100, parentPid: 5000, start_ticks: '510000', executable_path: 'chrome.exe'}]}),
    });
    expect(owned.rootReceipt).toEqual(root);
    expect(owned.listenerStartTicks).toBe('500100');
    expect(owned.receipts.map(row => row.pid)).toEqual([5000, 5100]);
  });

  it.each([{start_ticks: 'reused'}, {executable_path: 'replacement.exe'}, {pid: 6000}])(
    'rejects owner disappearance or PID reuse between socket lookup and rows: %j', async change => {
      const owner = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
      let calls = 0;
      await expect(captureOwnedBrowserProcessReceiptsForPort(43123, {
        platform: 'win32',
        ownedSnapshotProvider: async () => {
          calls++;
          // A retry would offer a superficially valid replacement. A failed
          // acquisition must never promote it into cleanup authority.
          const replacement = {...owner, ...change};
          return {rootPid: 5000, rootReceipt: calls === 1 ? owner : replacement, listenerStartTicks: '500100',
            rows: [{...replacement, parentPid: 9000}]};
        },
      })).rejects.toThrow(/owner lifetime changed/);
      expect(calls).toBe(1);
    },
  );

  it.each(['499999', '', 'unknown'])(
    'rejects a replacement already captured through the native handle when the listener predates it or has no timestamp: %s', async listenerStartTicks => {
      const replacement = {pid: 5000, start_ticks: '500000', executable_path: 'replacement.exe'};
      await expect(captureOwnedBrowserProcessReceiptsForPort(43123, {
        platform: 'win32', ownedSnapshotProvider: async () => ({rootPid: 5000,
          rootReceipt: replacement, listenerStartTicks, rows: [{...replacement, parentPid: 9000}]}),
      })).rejects.toThrow(/owner lifetime changed/);
    },
  );

  it('refuses a PID-only owner observation without native lifetime evidence', async () => {
    await expect(captureOwnedBrowserProcessReceiptsForPort(43123, {
      platform: 'win32', ownedSnapshotProvider: async () => ({rootPid: 5000,
        rows: [{pid: 5000, parentPid: 4000, start_ticks: 'new-owner', executable_path: 'other.exe'}]}),
    })).rejects.toThrow(/owner lifetime changed/);
  });

  it('requires the exact nonce endpoint to agree again after lifetime capture', async () => {
    const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    let reads = 0;
    await expect(captureOwnedBrowserProcessReceiptsForPort(43123, {
      platform: 'win32',
      devtoolsReceipt: {port: 43123, webSocketDebuggerUrl: 'ws://127.0.0.1:43123/devtools/browser/owned'},
      ownedSnapshotProvider: async () => ({rootPid: 5000, rootReceipt: root, listenerStartTicks: '500100', rows: [{...root, parentPid: 4000}]}),
      fetcher: async () => ({ok: true, json: async () => ({webSocketDebuggerUrl:
        `ws://127.0.0.1:43123/devtools/browser/${++reads === 1 ? 'owned' : 'replacement'}`})}) as never,
    })).rejects.toThrow(/exact owned-profile receipt/);
    expect(reads).toBe(2);
  });

  it('gives full app navigation a bounded 60-second commissioning window', async () => {
    const sent: Array<[string, unknown]> = [];
    const driver = new BrowserDriver({
      send: async (method: string, params: unknown) => {
        sent.push([method, params]);
        return {};
      },
    } as never);
    const waits: unknown[][] = [];
    driver.waitFor = async (...args: unknown[]) => {
      waits.push(args);
      return true;
    };

    await driver.navigate('http://127.0.0.1:8765/?v=test');
    expect(BROWSER_NAVIGATION_TIMEOUT_MS).toBe(60_000);
    expect(sent).toEqual([['Page.navigate', { url: 'http://127.0.0.1:8765/?v=test' }]]);
    expect(waits[0]?.[2]).toBe(BROWSER_NAVIGATION_TIMEOUT_MS);
  });

  it('attempts every cleanup action before reporting aggregate failures', async () => {
    const attempted: string[] = [];
    await expect(runCleanupActions([
      ['browser', async () => { attempted.push('browser'); throw new Error('tree failure'); }],
      ['server', async () => { attempted.push('server'); throw new Error('server failure'); }],
      ['profile', async () => { attempted.push('profile'); }],
    ])).rejects.toThrow(/resources failed cleanup/);
    expect(attempted).toEqual(['browser', 'server', 'profile']);
  });

  it.skipIf(process.platform !== 'win32')(
    'falls back to direct root termination after taskkill failure',
    async () => {
      const browser = new FakeOwnedProcess(424242);
      const failedTaskkill = new FakeOwnedProcess(434343, 1);
      const processSpawner = () => failedTaskkill as never;

      await expect(terminateOwned(browser as never, {
        tree: true,
        processSpawner,
        treeWaitMs: 1,
        killWaitMs: 10,
      })).rejects.toThrow(/terminate owned browser tree/);

      expect(browser.killSignals).toEqual(['SIGKILL']);
      expect(ownedProcessExited(browser as never)).toBe(true);
    },
  );

  it('captures an asynchronous spawn error as exited process state', async () => {
    const missing = path.join(process.cwd(), '__definitely_missing_vugg_browser__.exe');
    const child = spawnOwned(missing, [], { stdio: 'ignore', windowsHide: true });
    expect(await waitForOwnedExit(child, 2_000)).toBe(true);
    expect(ownedProcessExited(child)).toBe(true);
  });

  it('accepts the exact owned-profile DevTools receipt after a clean detached-launcher exit', async () => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'vugg-devtools-receipt-'));
    try {
      await writeFile(
        path.join(profile, 'DevToolsActivePort'),
        '43123\n/devtools/browser/owned-profile-uuid\n',
        'utf8',
      );
      const detachedLauncher = new FakeOwnedProcess(5000, 0);
      await expect(waitForDevToolsReceipt(profile, detachedLauncher as never, 100))
        .resolves.toEqual({
          port: 43123,
          webSocketDebuggerUrl: 'ws://127.0.0.1:43123/devtools/browser/owned-profile-uuid',
        });
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  });

  it('rejects a responder whose DevTools websocket is not the owned-profile receipt', () => {
    const receipt = {
      port: 43123,
      webSocketDebuggerUrl: 'ws://127.0.0.1:43123/devtools/browser/owned-profile-uuid',
    };
    expect(() => assertOwnedDevToolsVersion({
      webSocketDebuggerUrl: 'ws://127.0.0.1:43123/devtools/browser/unrelated-uuid',
    }, receipt)).toThrow(/exact owned-profile receipt/);
  });

  it('binds the authenticated loopback DevTools port to one exact browser PID', async () => {
    const netstatRunner = async () => ({
      stdout: [
        '  TCP    127.0.0.1:43123      0.0.0.0:0      LISTENING       5100',
        '  TCP    127.0.0.1:43124      0.0.0.0:0      LISTENING       9999',
      ].join('\r\n'),
    });
    await expect(findOwnedBrowserRootPid(43123, { netstatRunner: netstatRunner as never }))
      .resolves.toBe(5100);
    await expect(findOwnedBrowserRootPid(43125, { netstatRunner: netstatRunner as never }))
      .rejects.toThrow(/0 listening process owners/);
  });

  it('requires the per-run nonce before accepting the local content server', async () => {
    const server = new FakeOwnedProcess(5300);
    const response = (nonce: string | null) => ({
      ok: true,
      status: 200,
      headers: { get: () => nonce },
    });
    await expect(waitForHttp('http://127.0.0.1:43124/', server as never, {
      expectedNonce: 'owned-run',
      timeoutMs: 5,
      fetcher: async () => response('stale-run') as never,
    })).rejects.toThrow(/nonce mismatch/);
    await expect(waitForHttp('http://127.0.0.1:43124/', server as never, {
      expectedNonce: 'owned-run',
      timeoutMs: 100,
      fetcher: async () => response('owned-run') as never,
    })).resolves.toMatchObject({ ok: true });
  });

  it('bounds a content-server fetcher that never settles', async () => {
    const server = new FakeOwnedProcess(5301);
    const started = Date.now();
    await expect(waitForHttp('http://127.0.0.1:43125/', server as never, {
      expectedNonce: 'owned-run',
      timeoutMs: 10,
      fetcher: async () => new Promise(() => {}),
    })).rejects.toThrow(/Timed out fetching/);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('closes and rejects a CDP websocket that never opens or errors', async () => {
    class NeverOpeningSocket {
      binaryType = '';
      readyState = 0;
      closeCalls = 0;
      listeners = new Map<string, Set<(event?: unknown) => void>>();
      addEventListener(type: string, listener: (event?: unknown) => void) {
        const listeners = this.listeners.get(type) || new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }
      removeEventListener(type: string, listener: (event?: unknown) => void) {
        this.listeners.get(type)?.delete(listener);
      }
      close() { this.closeCalls += 1; }
      send() { throw new Error('socket never opened'); }
    }
    const client = new CdpClient('ws://127.0.0.1:43126/devtools/browser/never', {
      WebSocketCtor: NeverOpeningSocket as never,
      openTimeoutMs: 10,
    });
    await expect(client.open()).rejects.toThrow(/Timed out opening CDP WebSocket/);
    expect((client.ws as NeverOpeningSocket).closeCalls).toBe(1);
  });

  it('captures the exact launched process tree fingerprints and terminates only exact survivors', async () => {
    const captured = await captureOwnedBrowserProcessReceipts(5000, {
      platform: 'win32',
      processTreeProvider: async () => [
        { pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe' },
        { pid: 5100, parentPid: 5000, start_ticks: '510000', executable_path: 'chrome.exe' },
        { pid: 5101, parentPid: 5100, start_ticks: '510100', executable_path: 'chrome.exe' },
        { pid: 5199, parentPid: 9999, start_ticks: '519900', executable_path: 'chrome.exe' },
      ],
    });
    expect(captured.map(row => row.pid)).toEqual([5000, 5100, 5101]);

    let inspectCalls = 0;
    const processTreeProvider = async () => {
      inspectCalls += 1;
      return inspectCalls === 1
        ? [
          { ...captured[1], parentPid: 5000 },
          { ...captured[2], parentPid: 5100, start_ticks: 'different-process' },
        ]
        : [];
    };
    const spawned: Array<{ command: string; args: string[] }> = [];
    const processSpawner = (command: string, args: string[]) => {
      spawned.push({ command, args });
      return new FakeOwnedProcess(5200, 0) as never;
    };

    await terminateOwnedProcessReceipts(captured, {
      platform: 'win32',
      processTreeProvider,
      processSpawner,
      waitMs: 10,
    });
    expect(spawned).toEqual([{
      command: 'taskkill.exe',
      args: ['/PID', '5100', '/T', '/F'],
    }]);
    expect(inspectCalls).toBe(2);
  });
});
