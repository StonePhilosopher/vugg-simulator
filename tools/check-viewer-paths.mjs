// Bounded product compatibility probe using the existing owned-browser driver
// and exact-identity cleanup. No science producer or new scheduler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CdpClient,BrowserDriver,spawnOwned,waitForDevToolsReceipt,assertOwnedDevToolsVersion,
  captureOwnedBrowserProcessReceiptsForPort,windowsProcessTree} from './browser-workflow.mjs';
import {cleanupOwnedBrowserResources} from './benchmark-browser-cleanup.mjs';
import {findOwnedBrowserExecutable} from './owned-browser-runtime.mjs';
import {assertIndexMatchesDist,runtimeExecutionDigest,nodeRuntimeIdentity} from './evidence-runtime.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.local-evidence/viewer-paths',randomUUID());
fs.mkdirSync(out,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assertIndexMatchesDist(root);
const result={schema:'vugg-viewer-paths-v1',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),
  runtime:nodeRuntimeIdentity(),runtimeExecutionDigest:runtimeExecutionDigest(root),
  sourceSha256:hash(fs.readFileSync(import.meta.filename)),indexSha256:hash(fs.readFileSync(path.join(root,'index.html'))),
  driver:(await windowsProcessTree()).find(row=>row.pid===process.pid),cases:[]};
assert.ok(result.driver?.start_ticks,'Native driver lifetime unavailable');
fs.writeFileSync(path.join(root,'.local-evidence/viewer-paths/latest.json'),JSON.stringify({out})+'\n');
for(const disableWebGL of [false,true]){
  const nonce=randomUUID(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'vugg-viewer-paths-'));
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,bytes)=>{
      if(error){res.writeHead(404).end();return;}
      const type={'.js':'text/javascript','.json':'application/json','.json5':'application/json','.html':'text/html','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-vugg-server-nonce':nonce}).end(bytes);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  let browser,client,page,browserPid,receipts=[],devtoolsReceipt;
  const test={disableWebGL,port,profile,checks:[],errors:[],cleanup:false};result.cases.push(test);
  const deadline=setTimeout(()=>{void client?.send('Browser.close').catch(()=>{});},10*60_000);
  try{
    browser=spawnOwned(findOwnedBrowserExecutable(),['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking',
      '--disable-component-update','--disable-sync','--no-sandbox','--mute-audio',...(disableWebGL?['--disable-webgl','--disable-webgl2']:[]),'about:blank'],
      {stdio:['ignore','ignore','pipe'],windowsHide:true});
    browser.stderr.on('data',()=>{});
    devtoolsReceipt=await waitForDevToolsReceipt(profile,browser);
    const owned=await captureOwnedBrowserProcessReceiptsForPort(devtoolsReceipt.port,{devtoolsReceipt});
    receipts=owned.receipts;browserPid=owned.rootPid;
    save(`helpers-${disableWebGL}.json`,{owner:process.env.CODEX_THREAD_ID||'vugg-integration',purpose:'Two viewer paths and actual disabled-WebGL compatibility',
      receipts,server:result.driver,port,devtoolsPort:devtoolsReceipt.port,profile,expiryMinutes:10,
      source:'tools/check-viewer-paths.mjs',stop:'Browser.close, native exact-lifetime cleanup, server.close in finally'});
    const version=await(await fetch(`http://127.0.0.1:${devtoolsReceipt.port}/json/version`)).json();
    assertOwnedDevToolsVersion(version,devtoolsReceipt);test.browser=version.Browser;
    client=new CdpClient(version.webSocketDebuggerUrl);await client.open();
    const targets=await(await fetch(`http://127.0.0.1:${devtoolsReceipt.port}/json/list`)).json();
    page=new CdpClient(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await page.open();
    await page.send('Page.enable');await page.send('Runtime.enable');
    page.on('Runtime.exceptionThrown',error=>test.errors.push(error));
    await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const driver=new BrowserDriver(page);await driver.navigate(`http://127.0.0.1:${port}/index.html`);
    await driver.waitFor(`typeof SCENARIOS!=='undefined'&&typeof THREE!=='undefined'`,'scenario and Three load');
    const available=await driver.evaluate(`!!document.createElement('canvas').getContext('webgl2')`);
    assert.equal(available,!disableWebGL,'Browser flags must actually change WebGL availability');test.checks.push('native WebGL availability');
    await driver.click('button[onclick="titleNewGame()"]');
    await driver.clickExpression(`Array.from(document.querySelectorAll('#new-game-panel button')).find(b=>b.textContent.includes('Scenarios'))`,'Scenarios');
    await driver.click(`button[onclick*="startScenarioInCreative('mvt')"]`);
    await driver.waitFor(`!!window.vugg.fortressSim?.wall_state`,'Creative scenario');
    const before=await driver.evaluate(`simulationStateFingerprint(window.vugg.fortressSim)`);
    if(disableWebGL){
      await driver.evaluate(`topoSetThreeRendererEnabled(true)`);
      await driver.waitFor(`!topoThreeRendererEnabled()&&!!_topoThreeInitializationFailure`,'failed Three construction selects CPU slice');
      test.checks.push('WebGL construction failure is visible and falls back');
    }else{
      if(!(await driver.evaluate(`topoThreeRendererEnabled()`)))await driver.click('#topo-three-btn');
      await driver.waitFor(`topoThreeRendererEnabled()&&!!_topoThreeState?.cavity`,'Three cavity');
      for(const mode of [1,2,0]){await driver.click('#topo-wall-btn');await driver.waitFor(`_topoThreeState.wallDisplay===${mode}`,'wall mode');}
      test.checks.push('Three viewer and all existing wall modes');
      await driver.click('#topo-three-btn');
    }
    await driver.waitFor(`!topoThreeRendererEnabled()&&getComputedStyle(document.querySelector('#topo-canvas-three')).display==='none'
      &&getComputedStyle(document.querySelector('#topo-canvas')).display!=='none'
      &&document.querySelector('#topo-canvas').getBoundingClientRect().width>0`,'visible flat cavity');
    const flat=await driver.evaluate(`({exact:_topoExactFlatPresentationActive,
      width:document.querySelector('#topo-canvas').width,height:document.querySelector('#topo-canvas').height,
      text:document.querySelector('#topo-panel').textContent})`);
    assert.equal(flat.exact,true);assert.ok(flat.width>0&&flat.height>0);test.flat=flat;
    test.checks.push('visible exact flat cavity with bounded canvas');
    if(!disableWebGL){await driver.click('#topo-three-btn');await driver.waitFor(`topoThreeRendererEnabled()`,'Three restored');test.checks.push('return to Three');}
    assert.equal(await driver.evaluate(`simulationStateFingerprint(window.vugg.fortressSim)`),before);
    assert.deepEqual(test.errors,[]);test.checks.push('scientific fingerprint unchanged');
    test.passed=true;
  }finally{
    clearTimeout(deadline);
    await cleanupOwnedBrowserResources({browser,client,page,browserPid,receipts,profile,devtoolsReceipt,
      closeServer:()=>new Promise(resolve=>server.close(resolve)),removeProfile:async()=>{
        if(path.dirname(profile)!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('vugg-viewer-paths-'))throw new Error('Unexpected profile');
        await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200});
      }});
    test.cleanup=true;save('result.json',result);
  }
}
assert.ok(result.cases.every(c=>c.passed&&c.cleanup));console.log(JSON.stringify({out,cases:result.cases.map(c=>({disableWebGL:c.disableWebGL,checks:c.checks,passed:c.passed,cleanup:c.cleanup}))},null,2));
