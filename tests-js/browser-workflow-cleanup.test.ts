import { EventEmitter } from 'node:events';
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
  ownedProcessExited,
  runCleanupActions,
  spawnOwned,
  terminateOwned,
  terminateOwnedProcessReceipts,
  waitForHttp,
  waitForDevToolsReceipt,
  waitForOwnedExit,
  windowsProcessTree,
} from '../tools/browser-workflow.mjs';

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
    const snapshot = await windowsProcessTree({ownerPort: 43123, execFileRunner: async () => ({
      stdout: 'OWNER|5000|500000|500100|C:\\Chrome\\chrome.exe\n5000|4000|500000|C:\\Chrome\\chrome.exe\n',
    }) as never});
    expect(snapshot).toEqual({rootPid: 5000, listenerStartTicks: '500100',
      rootReceipt: {pid: 5000, start_ticks: '500000', executable_path: 'C:\\Chrome\\chrome.exe'},
      rows: [{pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'C:\\Chrome\\chrome.exe'}]});
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
