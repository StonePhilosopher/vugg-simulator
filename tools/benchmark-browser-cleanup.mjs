// Benchmark-only lifecycle code. The commissioned browser-workflow producer
// remains unchanged; these tools do not generate scientific evidence.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  assertOwnedDevToolsVersion, captureOwnedBrowserProcessReceipts, CdpClient,
  fetchWithDeadline, runCleanupActions, terminateOwned, waitForDevToolsReceipt,
  waitForOwnedExit, windowsProcessTree,
} from './browser-workflow.mjs';

const execFileAsync = promisify(execFile);
const sameLifetime = (current, expected) => current.pid === expected.pid
  && current.start_ticks === expected.start_ticks
  && current.executable_path === expected.executable_path;

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
export async function terminateExactBrowserProcess(receipt) {
  const source = String.raw`
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
      FT created, exited, kernel, user;
      if(!GetProcessTimes(p,out created,out exited,out kernel,out user)) throw new Win32Exception(Marshal.GetLastWin32Error());
      var path=new StringBuilder(32768); int size=path.Capacity;
      if(!QueryFullProcessImageName(p,0,path,ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
      if((((ulong)created.high<<32)|created.low)!=ticks || !String.Equals(path.ToString(),expectedPath,StringComparison.OrdinalIgnoreCase)) return "identity-changed";
      if(WaitForSingleObject(p,0)==0) return "exited";
      if(!TerminateProcess(p,1)) throw new Win32Exception(Marshal.GetLastWin32Error());
      if(WaitForSingleObject(p,5000)!=0) throw new Exception("Exact owned process did not exit before cleanup deadline");
      return "terminated";
    } finally { CloseHandle(p); }
  }
}`;
  const {stdout} = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Add-Type -TypeDefinition $env:VUGG_BENCHMARK_STOP_SOURCE; $r=ConvertFrom-Json $env:VUGG_BENCHMARK_STOP_RECEIPT; [VuggBenchmarkStop]::Stop([uint32]$r.pid,[uint64]$r.start_ticks,[string]$r.executable_path)'], {
    env: {...process.env, VUGG_BENCHMARK_STOP_SOURCE:source,
      VUGG_BENCHMARK_STOP_RECEIPT:JSON.stringify(receipt)},
    windowsHide:true, timeout:15_000,
  });
  const status=String(stdout).trim();
  if(!['terminated','exited','identity-changed'].includes(status)) throw new Error('Exact browser termination returned an invalid status');
  return status;
}

export async function cleanupOwnedBrowserResources({
  browser, client, page, browserPid, receipts = [], profile, closeServer, removeProfile,
}, {
  platform = process.platform,
  processTreeProvider = windowsProcessTree,
  ownedSnapshotProvider = port => windowsProcessTree({ownerPort:port}),
  fetcher = globalThis.fetch,
  createCdpClient = (url, options) => new CdpClient(url, options),
  terminateReceipt = terminateExactBrowserProcess,
  recoveryWaitMs = 2_000,
  closeWaitMs = 2_000,
  exitWaitMs = 5_000,
  termWaitMs = 3_000,
  killWaitMs = 5_000,
} = {}) {
  const initialRoot=receipts.find(receipt=>receipt.pid===browserPid);
  let cleanupReceipts = initialRoot && /^\d+$/.test(initialRoot.start_ticks) && BigInt(initialRoot.start_ticks)>0n
    ? receipts.filter(receipt=>/^\d+$/.test(receipt.start_ticks)
      && BigInt(receipt.start_ticks)>=BigInt(initialRoot.start_ticks)) : [];
  let recoveryFailure = null;
  // Chrome may detach and leave a successful launcher behind. Only the fresh
  // profile's exact DevTools nonce can recover browser ownership in that case.
  if(browser?.pid && !cleanupReceipts.length && profile) {
    let recoveredClient;
    try {
      if(platform !== 'win32') throw new Error('Browser process ownership is unavailable on this platform');
      const devtools = await waitForDevToolsReceipt(profile,browser,recoveryWaitMs);
      const version = await fetchWithDeadline(`http://127.0.0.1:${devtools.port}/json/version`, {
        timeoutMs:recoveryWaitMs, fetcher,
        consume:async response => {
          if(!response.ok) throw new Error(`Browser recovery HTTP ${response.status}`);
          return response.json();
        },
      });
      assertOwnedDevToolsVersion(version,devtools);
      recoveredClient=createCdpClient(devtools.webSocketDebuggerUrl,{openTimeoutMs:recoveryWaitMs});
      await recoveredClient.open();
      const snapshot=await ownedSnapshotProvider(devtools.port);
      const recovered=await captureOwnedBrowserProcessReceipts(snapshot.rootPid, {
        platform,processTreeProvider:async()=>ownedLifetimeRows(snapshot.rootPid,snapshot.rows),
      });
      cleanupReceipts=recovered;browserPid=snapshot.rootPid;
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
            const current=await processTreeProvider();
            if(current.some(row=>sameLifetime(row,receipt))) await terminateReceipt(receipt);
          }
          const remaining=(await processTreeProvider()).filter(row=>cleanupReceipts.some(prior=>sameLifetime(row,prior)));
          if(remaining.length) throw new Error(`Authenticated browser processes survived cleanup: ${remaining.map(row=>row.pid).join(', ')}`);
        }],
        ['browser launcher',async()=>terminateOwned(browser,{termWaitMs,killWaitMs})],
        ['browser ownership proof',async()=>{
          if(browser?.pid && !cleanupReceipts.length) throw new Error(
            'Browser shutdown is unproven; an exited launcher is insufficient. Retaining its profile.',
            {cause:recoveryFailure},
          );
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
