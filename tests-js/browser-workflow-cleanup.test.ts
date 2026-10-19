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
  cleanupOwnedBrowserResources,
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

  it(
    'falls back to direct root termination after taskkill failure',
    async () => {
      const browser = new FakeOwnedProcess(424242);
      const failedTaskkill = new FakeOwnedProcess(434343, 1);
      const processSpawner = () => failedTaskkill as never;

      await expect(terminateOwned(browser as never, {
        tree: true,
        platform: 'win32',
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

  it.each(['DevTools timeout', 'initial receipt capture failure'])(
    'terminates the live spawned tree before removing its profile after %s',
    async failure => {
      const browser = new FakeOwnedProcess(5000);
      const actions: string[] = [];
      const startup = failure === 'DevTools timeout'
        ? waitForDevToolsReceipt('unused-profile', browser as never, 0)
        : captureOwnedBrowserProcessReceipts(5000, {
          platform: 'win32', processTreeProvider: async () => [],
        });
      await expect(startup).rejects.toThrow();

      await cleanupOwnedBrowserResources({
        browser,
        closeServer: () => { actions.push('server'); },
        removeProfile: () => {
          expect(ownedProcessExited(browser as never)).toBe(true);
          actions.push('profile');
        },
      }, {
        platform: 'win32',
        processTreeProvider: async () => { throw new Error('No process table available'); },
        processSpawner: (command: string, args: string[]) => {
          expect(command).toBe('taskkill.exe');
          expect(args).toEqual(['/PID', '5000', '/T', '/F']);
          actions.push('terminate');
          browser.kill('SIGKILL');
          return new FakeOwnedProcess(5200, 0);
        },
        treeWaitMs: 10,
      });
      expect(actions).toEqual(['terminate', 'server', 'profile']);
    },
  );

  it.each([
    { start_ticks: 'reused-pid' },
    { executable_path: 'unrelated.exe' },
  ])('does not authorize a refreshed root with changed identity %j', async change => {
    const root = { pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe' };
    const original = Object.freeze([Object.freeze(root)]);
    const current = [
      { ...root, ...change, parentPid: 4000 },
      { pid: 5100, parentPid: 5000, start_ticks: '510000', executable_path: 'chrome.exe' },
    ];
    const spawned: string[] = [];
    let profileRemoved = false;
    await cleanupOwnedBrowserResources({
      browser: new FakeOwnedProcess(5000, 0), browserPid: 5000, receipts: original,
      removeProfile: () => { profileRemoved = true; },
    }, {
      platform: 'win32', processTreeProvider: async () => current,
      processSpawner: (command: string) => {
        spawned.push(command);
        return new FakeOwnedProcess(5200, 0);
      },
    });
    expect(spawned).toEqual([]);
    expect(profileRemoved).toBe(true);
    expect(original).toEqual([root]);
  });

  it('refreshes descendants only under the original root and retains prior orphan receipts', async () => {
    const root = { pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe' };
    const orphan = { pid: 5100, start_ticks: '510000', executable_path: 'chrome.exe' };
    const newChild = { pid: 5101, start_ticks: '510100', executable_path: 'chrome.exe' };
    let current = [
      { ...root, parentPid: 4000 }, { ...orphan, parentPid: 4999 },
      { ...newChild, parentPid: 5000 },
    ];
    const killed: number[] = [];
    await cleanupOwnedBrowserResources({
      browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root, orphan],
    }, {
      platform: 'win32', processTreeProvider: async () => current,
      processSpawner: (_command: string, args: string[]) => {
        const pid = Number(args[1]);
        killed.push(pid);
        current = current.filter(row => row.pid !== pid);
        return new FakeOwnedProcess(5200, 0);
      },
    });
    expect(killed).toEqual([5000, 5100, 5101]);
  });

  it('bounds stalled CDP and termination, closes the server, and retains a live browser profile', async () => {
    const browser = new FakeOwnedProcess(5000);
    browser.kill = (signal = 'SIGTERM') => { browser.killSignals.push(signal); return true; };
    const actions: string[] = [];
    const started = Date.now();
    await expect(cleanupOwnedBrowserResources({
      browser,
      client: { send: () => new Promise(() => {}), close: () => { actions.push('client'); } },
      closeServer: () => { actions.push('server'); },
      removeProfile: () => { actions.push('profile'); },
    }, {
      platform: 'linux', closeWaitMs: 1, exitWaitMs: 1, termWaitMs: 1, killWaitMs: 1,
    })).rejects.toThrow(/resources failed cleanup/);
    expect(browser.killSignals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(actions).toEqual(['client', 'server']);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
