import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertOwnedDevToolsVersion,
  CdpClient,
  ownedProcessExited,
  runCleanupActions,
  spawnOwned,
  terminateOwned,
  terminateOwnedProfileProcesses,
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

  it('terminates a detached browser by the exact owned profile tree root', async () => {
    let findCalls = 0;
    const processFinder = async () => {
      findCalls += 1;
      return findCalls === 1
        ? [{ pid: 5100, parentPid: 4000 }, { pid: 5101, parentPid: 5100 }]
        : [];
    };
    const spawned: Array<{ command: string; args: string[] }> = [];
    const processSpawner = (command: string, args: string[]) => {
      spawned.push({ command, args });
      return new FakeOwnedProcess(5200, 0) as never;
    };

    await terminateOwnedProfileProcesses('C:\\Temp\\vugg-browser-qa-owned', {
      platform: 'win32',
      processFinder,
      processSpawner,
      waitMs: 10,
    });
    expect(spawned).toEqual([{
      command: 'taskkill.exe',
      args: ['/PID', '5100', '/T', '/F'],
    }]);
    expect(findCalls).toBe(2);
  });
});
