// Benchmark lifecycle code. Shared ownership observation lives in the
// commissioned browser workflow; these tools do not generate science evidence.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  captureOwnedBrowserProcessReceipts, captureOwnedBrowserProcessReceiptsForPort, CdpClient,
  fetchWithDeadline, NATIVE_HELPER_LOAD, nativeHelperImage, runCleanupActions, terminateOwned, waitForDevToolsReceipt,
  waitForOwnedExit, windowsOwnedProcessSnapshot, windowsProcessTree,
} from './browser-workflow.mjs';

const execFileAsync = promisify(execFile);
const sameLifetime = (current, expected) => current.pid === expected.pid
  && current.start_ticks === expected.start_ticks
  && current.executable_path === expected.executable_path;
function lifetimeState(rows, receipt) {
  const current = rows.find(row => row.pid === receipt.pid);
  if (!current) return 'ended';
  if (!/^\d+$/.test(current.start_ticks) || BigInt(current.start_ticks) <= 0n
      || !current.executable_path) return 'unknown';
  return sameLifetime(current, receipt) ? 'present' : 'ended';
}

// A dying process can read as live but unreadable for tens of ms: its image
// query fails before its handle signals. Look again before an unreadable
// lifetime becomes a verdict; one capture takes far longer than that window.
// A lifetime still unreadable at the last look stays unknown, so cleanup still
// fails closed on a live process whose identity cannot be read.
export async function settledLifetimeRows(processTreeProvider, receipts, { observations = 3, rows: first = null } = {}) {
  let rows = first || await processTreeProvider();
  for (let observed = 1; observed < observations
    && receipts.some(receipt => lifetimeState(rows, receipt) === 'unknown'); observed++) {
    rows = await processTreeProvider();
  }
  return rows;
}

function connectionRefused(error, seen = new Set()) {
  if (!error || seen.has(error)) return false;
  seen.add(error);
  if (error.code) return error.code === 'ECONNREFUSED';
  if (Array.isArray(error.errors) && error.errors.length) {
    return error.errors.every(child => connectionRefused(child, new Set(seen)));
  }
  return connectionRefused(error.cause, seen);
}

export async function assertBenchmarkEndpointClosed(receipt, { fetcher = globalThis.fetch, timeoutMs = 2_000 } = {}) {
  if (!receipt || !Number.isInteger(receipt.port) || receipt.port <= 0 || receipt.port > 65535
      || !new RegExp(`^ws://127\\.0\\.0\\.1:${receipt.port}/devtools/browser/[A-Za-z0-9._-]+$`).test(receipt.webSocketDebuggerUrl)) {
    throw new Error('Exact owned DevTools endpoint is unavailable; shutdown is unproven');
  }
  let response;
  try {
    response = await fetchWithDeadline(`http://127.0.0.1:${receipt.port}/json/version`, {
      timeoutMs, fetcher,
      consume: async value => ({ ok: value.ok, version: value.ok ? await value.json() : null }),
    });
  } catch (error) {
    if (connectionRefused(error)) return;
    throw new Error('DevTools endpoint shutdown could not be proven', { cause: error });
  }
  if (response.version?.webSocketDebuggerUrl === receipt.webSocketDebuggerUrl) {
    throw new Error('Exact owned DevTools endpoint still answers after browser cleanup');
  }
  throw new Error('DevTools port still answers without the expected identity; retaining the profile');
}

function ownedLifetimeRows(rootPid, rows) {
  const root=rows.find(row=>row.pid===rootPid);
  const hasBirth=row=>/^\d+$/.test(row?.start_ticks)&&BigInt(row.start_ticks)>0n;
  if(!hasBirth(root)) throw new Error('Authenticated browser root birth is unavailable');
  const owned=new Map([[rootPid,root]]);
  let added;
  do {
    added=false;
    for(const row of rows) {
      const parent=owned.get(row.parentPid);
      if(!owned.has(row.pid)&&parent&&hasBirth(row)&&BigInt(row.start_ticks)>=BigInt(parent.start_ticks)) {
        owned.set(row.pid,row);added=true;
      }
    }
  } while(added);
  return [...owned.values()];
}

// The identity comparison and termination use one native handle. Checking a PID
// and subsequently launching taskkill leaves a PID-reuse window, and /T would
// grant termination authority over descendants we have never authenticated.
// That handle also pins the PID, so once it is signaled the lifetime has ended
// whatever the receipt says. An ending process can fail identity queries and
// termination first: while tearing down it refuses its image path and a second
// TerminateProcess with ACCESS_DENIED for tens of ms before it signals, and once
// exited, if another handle keeps it open (Chrome holds its children's), it
// still reports creation times but no image path (ERROR_GEN_FAILURE). A failing
// query or termination therefore waits, bounded, for that signal before it
// reports the failure.
export const VUGG_BENCHMARK_STOP_SOURCE = String.raw`
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class VuggBenchmarkStop {
  [StructLayout(LayoutKind.Sequential)] struct FT { public uint low, high; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr p, out FT creation, out FT exit, out FT kernel, out FT user);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr p, uint flags, StringBuilder path, ref int size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr p, uint code);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr p, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr p);
  public static string Stop(uint pid, ulong ticks, string expectedPath) {
    IntPtr p=OpenProcess(0x101001, false, pid); // synchronize, query-limited, terminate
    if(p==IntPtr.Zero) { int e=Marshal.GetLastWin32Error(); if(e==87) return "exited"; throw new Win32Exception(e); }
    try {
      if(WaitForSingleObject(p,0)==0) return "exited";
      FT created, exited, kernel, user;
      if(!GetProcessTimes(p,out created,out exited,out kernel,out user)) { int e=Marshal.GetLastWin32Error(); if(WaitForSingleObject(p,5000)==0) return "exited"; throw new Win32Exception(e); }
      var path=new StringBuilder(32768); int size=path.Capacity;
      if(!QueryFullProcessImageName(p,0,path,ref size)) { int e=Marshal.GetLastWin32Error(); if(WaitForSingleObject(p,5000)==0) return "exited"; throw new Win32Exception(e); }
      if((((ulong)created.high<<32)|created.low)!=ticks || !String.Equals(path.ToString(),expectedPath,StringComparison.OrdinalIgnoreCase)) return "identity-changed";
      if(WaitForSingleObject(p,0)==0) return "exited";
      if(!TerminateProcess(p,1)) { int e=Marshal.GetLastWin32Error(); if(WaitForSingleObject(p,5000)==0) return "exited"; throw new Win32Exception(e); }
      if(WaitForSingleObject(p,5000)!=0) throw new Exception("Exact owned process did not exit before cleanup deadline");
      return "terminated";
    } finally { CloseHandle(p); }
  }
}`;

export async function terminateExactBrowserProcess(receipt, { execFileRunner = execFileAsync } = {}) {
  const image = await nativeHelperImage('VuggBenchmarkStop', VUGG_BENCHMARK_STOP_SOURCE, {execFileRunner});
  const {stdout} = await execFileRunner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `${NATIVE_HELPER_LOAD}; $r=ConvertFrom-Json $env:VUGG_BENCHMARK_STOP_RECEIPT; [VuggBenchmarkStop]::Stop([uint32]$r.pid,[uint64]$r.start_ticks,[string]$r.executable_path)`], {
    env: {...process.env, VUGG_NATIVE_HELPER_IMAGE:image,
      VUGG_BENCHMARK_STOP_RECEIPT:JSON.stringify(receipt)},
    windowsHide:true, timeout:15_000,
  });
  const status=String(stdout).trim();
  if(!['terminated','exited','identity-changed'].includes(status)) throw new Error('Exact browser termination returned an invalid status');
  return status;
}

export async function cleanupOwnedBrowserResources({
  browser, client, page, browserPid, receipts = [], profile, devtoolsReceipt = null, closeServer, removeProfile,
}, {
  platform = process.platform,
  processTreeProvider = windowsProcessTree,
  ownedSnapshotProvider = windowsOwnedProcessSnapshot(),
  fetcher = globalThis.fetch,
  createCdpClient = (url, options) => new CdpClient(url, options),
  terminateReceipt = terminateExactBrowserProcess,
  recoveryWaitMs = 2_000,
  closeWaitMs = 2_000,
  exitWaitMs = 5_000,
  termWaitMs = 3_000,
  killWaitMs = 5_000,
  endpointWaitMs = 2_000,
} = {}) {
  const initialRoot=receipts.find(receipt=>receipt.pid===browserPid);
  let cleanupReceipts = initialRoot && /^\d+$/.test(initialRoot.start_ticks) && BigInt(initialRoot.start_ticks)>0n
    ? receipts.filter(receipt=>/^\d+$/.test(receipt.start_ticks)
      && BigInt(receipt.start_ticks)>=BigInt(initialRoot.start_ticks)) : [];
  let recoveryFailure = null;
  let shutdownEndpoint = devtoolsReceipt;
  // Chrome may detach and leave a successful launcher behind. Only the fresh
  // profile's exact DevTools nonce can recover browser ownership in that case.
  if(browser?.pid && !cleanupReceipts.length && profile) {
    let recoveredClient;
    try {
      if(platform !== 'win32') throw new Error('Browser process ownership is unavailable on this platform');
      const devtools = await waitForDevToolsReceipt(profile,browser,recoveryWaitMs);
      if (shutdownEndpoint && shutdownEndpoint.webSocketDebuggerUrl !== devtools.webSocketDebuggerUrl) {
        throw new Error('Owned profile DevTools identity changed since startup');
      }
      const owned = await captureOwnedBrowserProcessReceiptsForPort(devtools.port, {
        platform, timeoutMs: recoveryWaitMs, ownedSnapshotProvider, devtoolsReceipt: devtools, fetcher,
      });
      recoveredClient=createCdpClient(devtools.webSocketDebuggerUrl,{openTimeoutMs:recoveryWaitMs});
      await recoveredClient.open();
      cleanupReceipts=owned.receipts;browserPid=owned.rootPid;shutdownEndpoint=devtools;
      if(!client) {client=recoveredClient;recoveredClient=null;}
    } catch(error) {
      recoveryFailure=error;
    } finally {
      recoveredClient?.close();
    }
  }
  const expectedRoot=cleanupReceipts.find(receipt=>receipt.pid===browserPid);
  if(expectedRoot) {
    try {
      const current=await processTreeProvider();
      if(!current.some(row=>sameLifetime(row,expectedRoot))) throw new Error('Original root exited or changed');
      const latest=await captureOwnedBrowserProcessReceipts(browserPid,{
        platform,processTreeProvider:async()=>ownedLifetimeRows(browserPid,current),
      });
      const byIdentity=new Map([...cleanupReceipts,...latest].map(receipt=>[
        `${receipt.pid}|${receipt.start_ticks}|${receipt.executable_path}`,receipt,
      ]));
      cleanupReceipts=[...byIdentity.values()];
    } catch {
      // Retain original identities, including orphans. A failed refresh cannot
      // grant authority over a replacement PID or its descendants.
    }
  }
  let browserStopped=false;
  await runCleanupActions([
    ['browser shutdown',async()=>{
      await runCleanupActions([
        ['graceful browser close',async()=>{
          if(!client) return;
          let timer;
          try {
            await Promise.race([
              Promise.resolve().then(()=>client.send('Browser.close')).catch(()=>{}),
              new Promise(resolve=>{timer=setTimeout(resolve,closeWaitMs);}),
            ]);
          } finally { clearTimeout(timer); }
          await waitForOwnedExit(browser,exitWaitMs);
        }],
        ['page CDP client',async()=>page?.close()],
        ['CDP client',async()=>client?.close()],
        ['authenticated browser processes',async()=>{
          if(!cleanupReceipts.length) return;
          if(platform !== 'win32') throw new Error('Browser process observation is unavailable');
          for(const receipt of cleanupReceipts) {
            const current=await settledLifetimeRows(processTreeProvider,[receipt]);
            const state=lifetimeState(current,receipt);
            if(state==='unknown') throw new Error(`Browser process ${receipt.pid} identity is unavailable; shutdown is unproven`);
            if(state==='present') await terminateReceipt(receipt);
          }
          const current=await settledLifetimeRows(processTreeProvider,cleanupReceipts);
          const unresolved=cleanupReceipts.filter(receipt=>lifetimeState(current,receipt)!=='ended');
          if(unresolved.length) throw new Error(`Authenticated browser process shutdown is unproven: ${unresolved.map(row=>row.pid).join(', ')}`);
        }],
        ['browser launcher',async()=>terminateOwned(browser,{termWaitMs,killWaitMs})],
        ['browser ownership proof',async()=>{
          if(browser?.pid && !cleanupReceipts.length) throw new Error(
            'Browser shutdown is unproven; an exited launcher is insufficient. Retaining its profile.',
            {cause:recoveryFailure},
          );
        }],
        ['exact owned DevTools endpoint',async()=>{
          if (browser?.pid) await assertBenchmarkEndpointClosed(shutdownEndpoint, { fetcher, timeoutMs: endpointWaitMs });
        }],
      ]);
      browserStopped=true;
    }],
    ['local server',async()=>closeServer?.()],
    ['temporary browser profile',async()=>{
      if(!browserStopped) throw new Error('Browser cleanup failed; retaining its temporary profile');
      await removeProfile?.();
    }],
  ]);
}
