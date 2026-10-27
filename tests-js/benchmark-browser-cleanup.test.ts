import { execFile, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  captureOwnedBrowserProcessReceipts, NATIVE_HELPER_COMPILE_TIMEOUT_MS, NATIVE_HELPER_LOAD, ownedProcessExited,
  waitForDevToolsReceipt, waitForOwnedExit, windowsProcessTree,
} from '../tools/browser-workflow.mjs';
import {
  cleanupOwnedBrowserResources as cleanupImplementation, terminateExactBrowserProcess, VUGG_BENCHMARK_STOP_SOURCE,
} from '../tools/benchmark-browser-cleanup.mjs';
const devtoolsReceipt = {port: 43123, webSocketDebuggerUrl: 'ws://127.0.0.1:43123/devtools/browser/owned-profile-uuid'};
const refused = () => {throw Object.assign(new Error('No listener'), {code: 'ECONNREFUSED'});};
function cleanupOwnedBrowserResources(resources: any, options: any = {}) {
  return cleanupImplementation({devtoolsReceipt, ...resources}, {fetcher: refused, ...options});
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
          ownedSnapshotProvider: async () => ({rootPid: 5000, rootReceipt: root, listenerStartTicks: '500100', rows: current}),
          fetcher: async () => !current.length ? refused() : endpoint === 'unresponsive' ? new Promise(() => {}) : {
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
    { start_ticks: '600000' },
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

  it('does not terminate a replacement acquired between the port lookup and process rows', async () => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'vugg-owner-reuse-'));
    const owner = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const replacement = {...owner, start_ticks: '600000', executable_path: 'other.exe', parentPid: 9000};
    const actions: string[] = [];
    try {
      await writeFile(path.join(profile, 'DevToolsActivePort'), '43123\n/devtools/browser/owned-profile-uuid\n');
      await expect(cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), profile,
        closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
      }, {
        platform: 'win32', processTreeProvider: async () => [replacement],
        ownedSnapshotProvider: async () => ({rootPid: 5000, rootReceipt: owner, listenerStartTicks: '500100', rows: [replacement]}),
        fetcher: async () => ({ok: true, json: async () => ({webSocketDebuggerUrl: devtoolsReceipt.webSocketDebuggerUrl})}),
        createCdpClient: () => {throw new Error('Invalid owner must not acquire a client');},
        terminateReceipt: async () => {actions.push('terminate-replacement');},
      })).rejects.toThrow(/resources failed cleanup/);
      expect(actions).toEqual(['server']);
    } finally {await rm(profile, {recursive: true, force: true});}
  });

  it.each([{start_ticks: '0'}, {executable_path: ''}])('retains the profile for unreadable lifetime metadata: %j', async change => {
    const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const actions: string[] = [];
    await expect(cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root],
      closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
    }, {
      platform: 'win32', processTreeProvider: async () => [{...root, ...change, parentPid: 4000}],
      terminateReceipt: async () => {actions.push('terminate');},
    })).rejects.toThrow(/resources failed cleanup/);
    expect(actions).toEqual(['server']);
  });

  it.each(['transient', 'persistent'])('looks again, a bounded number of times, at an unreadable lifetime: %s', async kind => {
    const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
    const unreadable = {...root, parentPid: 4000, start_ticks: '0'};
    let observations = 0;
    const actions: string[] = [];
    const cleanup = cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root],
      closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
    }, {
      platform: 'win32',
      // A tearing-down process refuses its image path for tens of ms before it
      // signals; by the next capture it is gone, unless it is not dying at all.
      processTreeProvider: async () => (++observations <= 2 || kind === 'persistent' ? [unreadable] : []),
      terminateReceipt: async () => {actions.push('terminate');},
    });
    if (kind === 'transient') {
      await expect(cleanup).resolves.toBeUndefined();
      expect(actions).toEqual(['server', 'profile']);
    } else {
      await expect(cleanup).rejects.toThrow(/resources failed cleanup/);
      expect(actions).toEqual(['server']);
    }
    // The root refresh, then three looks at the one receipt (transient: two
    // looks, then the final settled check).
    expect(observations).toBe(4);
  });

  it.each(['owned-profile-uuid', 'replacement-nonce', 'timeout', 'mixed-refusal'])(
    'retains the profile if the final endpoint check is unresolved: %s', async endpoint => {
      const root = {pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe'};
      let current = [{...root, parentPid: 4000}];
      const actions: string[] = [];
      await expect(cleanupOwnedBrowserResources({browser: new FakeOwnedProcess(4000, 0), browserPid: 5000, receipts: [root],
        closeServer: () => {actions.push('server');}, removeProfile: () => {actions.push('profile');},
      }, {
        platform: 'win32', endpointWaitMs: 5, processTreeProvider: async () => current,
        terminateReceipt: async () => {current = []; actions.push('terminate');},
        fetcher: async () => {
          if (endpoint === 'mixed-refusal') throw new AggregateError([
            Object.assign(new Error('refused'), {code: 'ECONNREFUSED'}),
            Object.assign(new Error('unknown'), {code: 'ETIMEDOUT'}),
          ]);
          return endpoint === 'timeout' ? new Promise(() => {}) : {
            ok: true, json: async () => ({webSocketDebuggerUrl: `ws://127.0.0.1:43123/devtools/browser/${endpoint}`}),
          };
        },
      })).rejects.toThrow(/resources failed cleanup/);
      expect(actions).toEqual(['terminate', 'server']);
    },
  );

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
    const replacement = {...child, parentPid: 9999, start_ticks: '610000', executable_path: 'other.exe'};
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

  it('compiles the exact-stop helper once and loads its bytes for each stop', async () => {
    const calls: string[] = [];
    const runner = async (_file: string, args: string[], options: { timeout: number; env: Record<string, string> }) => {
      const command = args[args.length - 1];
      const compile = command.includes('-OutputAssembly');
      calls.push(`${options.timeout} ${compile ? 'compile' : `${command.split(';')[0]} ${options.env.VUGG_NATIVE_HELPER_IMAGE}`}`);
      return { stdout: compile ? 'VuggBenchmarkStop\r\nTVqQ\r\n' : 'exited\r\n' };
    };
    const receipt = { pid: 5000, start_ticks: '500000', executable_path: 'chrome.exe' };
    await expect(terminateExactBrowserProcess(receipt, { execFileRunner: runner as never })).resolves.toBe('exited');
    await expect(terminateExactBrowserProcess(receipt, { execFileRunner: runner as never })).resolves.toBe('exited');
    expect(calls).toEqual([
      `${NATIVE_HELPER_COMPILE_TIMEOUT_MS} compile`,
      `15000 ${NATIVE_HELPER_LOAD} TVqQ`,
      `15000 ${NATIVE_HELPER_LOAD} TVqQ`,
    ]);
  });

  it.skipIf(process.platform !== 'win32')('reports a process another handle is already terminating as exited', async () => {
    // Chrome terminates its own children on Browser.close. Until such a child
    // is signaled, a few ms later, its identity still reads as live and a
    // second TerminateProcess is refused with ACCESS_DENIED. The race needs
    // both handles in one host, so the harness calls Stop beside the first
    // TerminateProcess on a child that has spawned nothing of its own.
    const race = String.raw`
public static class VuggStopRace {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr p, uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr p);
  public static string Run(uint pid, ulong ticks, string path) {
    IntPtr h = OpenProcess(0x101001, false, pid);
    try { return TerminateProcess(h, 7) ? VuggBenchmarkStop.Stop(pid, ticks, path) : "first-terminate-failed"; }
    finally { CloseHandle(h); }
  }
}`;
    const script = [
      'Add-Type -TypeDefinition ($env:VUGG_STOP_SOURCE + [Environment]::NewLine + $env:VUGG_STOP_RACE)',
      '$self = (Get-Process -Id $PID).Path',
      'foreach ($n in 1..3) {',
      '  $i = New-Object Diagnostics.ProcessStartInfo',
      "  $i.FileName = $self; $i.Arguments = '-NoProfile -NonInteractive -Command Start-Sleep 60'",
      '  $i.UseShellExecute = $false; $i.CreateNoWindow = $true',
      '  $p = [Diagnostics.Process]::Start($i)',
      '  try { [Console]::Out.WriteLine([VuggStopRace]::Run([uint32]$p.Id, [uint64]$p.StartTime.ToFileTimeUtc(), $self)) }',
      '  finally { if (-not $p.HasExited) { $p.Kill() }; $p.WaitForExit(); $p.Dispose() }',
      '}',
    ].join('\n');
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, VUGG_STOP_SOURCE: VUGG_BENCHMARK_STOP_SOURCE, VUGG_STOP_RACE: race }, windowsHide: true,
    });
    expect(stdout.trim().split(/\r?\n/)).toEqual(['exited', 'exited', 'exited']);
  });

  it.skipIf(process.platform !== 'win32')('reports an exited process that another handle keeps open as exited', async () => {
    // The holder starts a child, waits for it to exit and keeps its handle, as
    // Chrome keeps its exited children's while it shuts down. Such a process is
    // gone from snapshots and still reports creation times, but no image path.
    const holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', [
      '$i = New-Object Diagnostics.ProcessStartInfo',
      '$i.FileName = $env:ComSpec', "$i.Arguments = '/c exit 0'", '$i.UseShellExecute = $false', '$i.CreateNoWindow = $true',
      '$p = [Diagnostics.Process]::Start($i)', '$p.WaitForExit()',
      '[Console]::Out.WriteLine([string]$p.Id + "|" + $p.StartTime.ToFileTimeUtc() + "|" + $env:ComSpec)',
      '[Console]::Out.Flush()', '[void][Console]::In.ReadLine()',
    ].join('; ')], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    try {
      const line = await new Promise<string>((resolve, reject) => {
        let output = '';
        holder.once('exit', code => reject(new Error(`zombie holder exited early with ${code}`)));
        holder.stdout!.on('data', chunk => {
          output += chunk;
          if (output.includes('\n')) resolve(output.split(/\r?\n/)[0]);
        });
      });
      const [pid, start_ticks, executable_path] = line.split('|');
      const receipt = { pid: Number(pid), start_ticks, executable_path };
      expect(start_ticks).toMatch(/^[1-9]\d*$/);
      expect((await windowsProcessTree()).some(row => row.pid === receipt.pid)).toBe(false);
      await expect(terminateExactBrowserProcess(receipt)).resolves.toBe('exited');
    } finally {
      holder.stdin!.end();
      if (!(await waitForOwnedExit(holder as never, 10_000))) holder.kill();
    }
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
