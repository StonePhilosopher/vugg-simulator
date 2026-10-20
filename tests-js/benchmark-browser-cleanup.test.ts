import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { captureOwnedBrowserProcessReceipts, ownedProcessExited, waitForDevToolsReceipt } from '../tools/browser-workflow.mjs';
import { cleanupOwnedBrowserResources } from '../tools/benchmark-browser-cleanup.mjs';
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

describe('benchmark browser cleanup', () => {
  it.each(['DevTools timeout', 'initial receipt capture failure'])(
    'stops the owned launcher but retains its profile without browser ownership after %s',
    async failure => {
      const browser = new FakeOwnedProcess(5000);
      const actions: string[] = [];
      const startup = failure === 'DevTools timeout'
        ? waitForDevToolsReceipt('unused-profile', browser as never, 0)
        : captureOwnedBrowserProcessReceipts(5000, {
          platform: 'win32', processTreeProvider: async () => [],
        });
      await expect(startup).rejects.toThrow();

      await expect(cleanupOwnedBrowserResources({
        browser,
        closeServer: () => { actions.push('server'); },
        removeProfile: () => {
          expect(ownedProcessExited(browser as never)).toBe(true);
          actions.push('profile');
        },
      }, {
        platform: 'win32',
        processTreeProvider: async () => { throw new Error('No process table available'); },
        terminateReceipt: () => { throw new Error('An unauthenticated process must not be targeted'); },
      })).rejects.toThrow(/resources failed cleanup/);
      expect(browser.killSignals).toEqual(['SIGTERM']);
      expect(actions).toEqual(['server']);
    },
  );

  it('does not equate a clean detached launcher exit with a stopped browser', async () => {
    const launcher = new FakeOwnedProcess(4000, 0);
    let profileRemoved = false;
    let serverClosed = false;
    await expect(cleanupOwnedBrowserResources({
      browser: launcher,
      closeServer: () => { serverClosed = true; },
      removeProfile: () => { profileRemoved = true; },
    }, {
      platform: 'win32',
      terminateReceipt: () => { throw new Error('No process identity was established'); },
    })).rejects.toThrow(/resources failed cleanup/);
    expect(profileRemoved).toBe(false);
    expect(serverClosed).toBe(true);
  });

  it.each(['valid', 'mismatched', 'unresponsive'])(
    'recovers a detached browser only through its owned-profile endpoint: %s', async endpoint => {
      const profile = await mkdtemp(path.join(os.tmpdir(), 'vugg-cleanup-recovery-'));
      const root = { pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe' };
      let current = [root];
      const actions: string[] = [];
      try {
        await writeFile(path.join(profile, 'DevToolsActivePort'), '43123\n/devtools/browser/owned-profile-uuid\n');
        const cleanup = cleanupOwnedBrowserResources({
          browser: new FakeOwnedProcess(4000, 0), profile,
          closeServer: () => { actions.push('server'); },
          removeProfile: () => { actions.push('profile'); },
        }, {
          platform: 'win32', recoveryWaitMs: 10,
          processTreeProvider: async () => current,
          ownedSnapshotProvider: async () => ({rootPid: 5000, rows: current}),
          fetcher: async () => endpoint === 'unresponsive' ? new Promise(() => {}) : {
            ok: true, status: 200,
            json: async () => ({webSocketDebuggerUrl: `ws://127.0.0.1:43123/devtools/browser/${endpoint === 'valid' ? 'owned-profile-uuid' : 'other-profile'}`}),
          },
          createCdpClient: (url: string) => {
            expect(url).toBe('ws://127.0.0.1:43123/devtools/browser/owned-profile-uuid');
            return {
              open: async () => { actions.push('open'); },
              send: async (method: string) => {
                expect(method).toBe('Browser.close'); actions.push('close-browser'); current = [];
              },
              close: () => { actions.push('close-client'); },
            };
          },
          terminateReceipt: () => { throw new Error('Recovery must not target another process'); },
        });
        if (endpoint === 'valid') {
          await expect(cleanup).resolves.toBeUndefined();
          expect(actions).toEqual(['open', 'close-browser', 'close-client', 'server', 'profile']);
          expect(current).toEqual([]);
        } else {
          await expect(cleanup).rejects.toThrow(/resources failed cleanup/);
          expect(actions).toEqual(['server']);
          expect(current).toEqual([root]);
        }
      } finally {
        await rm(profile, {recursive: true, force: true});
      }
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
      terminateReceipt: async (receipt: { pid: number }) => {
        spawned.push(String(receipt.pid));
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
      terminateReceipt: async ({pid}: {pid: number}) => {
        killed.push(pid);
        current = current.filter(row => row.pid !== pid);
      },
    });
    expect(killed).toEqual([5000, 5100, 5101]);
  });

  it('revalidates a child lifetime after stopping its parent', async () => {
    const root = {pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const child = {pid: 5100, parentPid: 5000, start_ticks: '510000', executable_path: 'chrome.exe'};
    const replacement = {...child, parentPid: 9999, start_ticks: 'reused', executable_path: 'other.exe'};
    let current = [root, child];
    const killed: number[] = [];
    await cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root, child]}, {
      platform: 'win32', processTreeProvider: async () => current,
      terminateReceipt: async ({pid}: {pid: number}) => {
        killed.push(pid);
        if (pid === 5000) current = [replacement];
      },
    });
    expect(killed).toEqual([5000]);
    expect(current).toEqual([replacement]);
  });

  it('does not adopt an old process whose parent PID was reused by the browser', async () => {
    const root = {pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const unrelated = {pid: 5100, parentPid: 5000, start_ticks: '400000', executable_path: 'other.exe'};
    let current = [root, unrelated];
    const killed: number[] = [];
    await cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root, unrelated]}, {
      platform: 'win32', processTreeProvider: async () => current,
      terminateReceipt: async ({pid}: {pid: number}) => {
        killed.push(pid); current = current.filter(row => row.pid !== pid);
      },
    });
    expect(killed).toEqual([5000]);
    expect(current).toEqual([unrelated]);
  });

  it('preserves a termination error even if that process subsequently exits', async () => {
    const root = {pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe'};
    let current = [root];
    const actions: string[] = [];
    await expect(cleanupOwnedBrowserResources({
      browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root],
      closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
    }, {
      platform: 'win32', processTreeProvider: async () => current,
      terminateReceipt: async () => {current = []; throw new Error('Failed exact termination');},
    })).rejects.toThrow(/resources failed cleanup/);
    expect(actions).toEqual(['server']);
  });

  it('retains the profile and closes the server when an authenticated process survives', async () => {
    const root = {pid: 5000, parentPid: 4000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const actions: string[] = [];
    await expect(cleanupOwnedBrowserResources({
      browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root],
      closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
    }, {
      platform: 'win32', processTreeProvider: async () => [root],
      terminateReceipt: async () => {actions.push('failed-stop');},
    })).rejects.toThrow(/resources failed cleanup/);
    expect(actions).toEqual(['failed-stop', 'server']);
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
