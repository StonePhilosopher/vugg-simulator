import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { CdpClient, BrowserDriver, spawnOwned, waitForDevToolsReceipt,
  captureOwnedBrowserProcessReceiptsForPort } from './browser-workflow.mjs';
import { cleanupOwnedBrowserResources } from './benchmark-browser-cleanup.mjs';
import { findOwnedBrowserExecutable } from './owned-browser-runtime.mjs';
import { summarizeBisbeeRenderComparison } from './bisbee-render-contract.mjs';
import { assertIndexMatchesDist } from './evidence-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = 'ce93e2fd20d2d50d7f4ffcfa82c67ae1b95737f5';
const args = process.argv.slice(2);
const coldVariant = args.length === 2 && args[0] === '--cold' && ['baseline','candidate'].includes(args[1]) ? args[1] : null;
if(args.length && !coldVariant)throw new Error('Usage: node tools/bisbee-render-benchmark.mjs [--cold baseline|candidate]');
assertIndexMatchesDist(root);
const runId = randomUUID();
const outputRoot = path.join(root, '.local-evidence', 'bisbee-render-benchmark');
const out = path.join(outputRoot, runId);
const originalSource = execFileSync('git', ['show', `${baseline}:js/99i-renderer-three.ts`], {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const start = originalSource.indexOf('function _emitSurfaceGrowthLining(');
const end = originalSource.indexOf('function _emitSurfaceGrowthSwath(',start);
if(start<0||end<start) throw new Error('Pinned baseline lining function is unavailable');
const baselineFunction = ts.transpileModule(originalSource.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(outputRoot,'latest.json'),JSON.stringify({runId,out}));
fs.copyFileSync(fileURLToPath(import.meta.url),path.join(out,'benchmark-source.mjs'));
console.log('output',out);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-bisbee-'));
const nonce = randomUUID();
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    const type = { '.js':'text/javascript', '.json':'application/json', '.json5':'application/json', '.html':'text/html', '.css':'text/css' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type':type, 'cache-control':'no-store', 'x-vugg-server-nonce':nonce }); res.end(bytes);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
let browser, client, page, receipts = [], browserPid;
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const hostCpuSnapshot = () => os.cpus().map(cpu => ({ ...cpu.times }));
const hostCpuInterval = before => {
  const after = hostCpuSnapshot();
  const total = times => Object.values(times).reduce((sum, value) => sum + value, 0);
  const elapsed = after.reduce((sum, times, i) => sum + total(times) - total(before[i]), 0);
  const idle = after.reduce((sum, times, i) => sum + times.idle - before[i].idle, 0);
  return { busy_fraction: elapsed > 0 ? 1 - idle / elapsed : null,
    logical_cpus: after.length, free_physical_bytes: os.freemem(),
    interval: 'construction, witness collection, orbit and retained-heap sampling' };
};
save('identity.json',{baseline,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  inputs:Object.fromEntries(['index.html','js/99i-renderer-three.ts','tools/three.module.js','data/scenarios.json5','data/minerals.json',
    'tools/bisbee-render-benchmark.mjs','tools/bisbee-render-contract.mjs','tools/browser-workflow.mjs','tools/benchmark-browser-cleanup.mjs',
    'tools/owned-browser-runtime.mjs','tools/evidence-runtime.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
  trust:'measurement-only; identical meshes do not prove geological validity',coldVariant,seed:42,shape_seed:13,steps:340});
const deadline = setTimeout(() => { void client?.send('Browser.close').catch(() => {}); }, 15 * 60_000);
class ProfileClient extends CdpClient {
  send(method, params = {}, sessionId = null) {
    const id = this.nextId;
    const result = super.send(method, params, sessionId);
    const pending = this.pending.get(id);
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {this.pending.delete(id);pending.reject(new Error(`Profile timeout: ${method} ${params.expression?.slice(0,100)||''}`));},60000);
    return result;
  }
}
try {
  browser = spawnOwned(findOwnedBrowserExecutable(), [ '--headless=new', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--no-sandbox', '--mute-audio', 'about:blank'],
    { stdio:['ignore','ignore','pipe'], windowsHide:true });
  browser.stderr.on('data', () => {});
  const devtools = await waitForDevToolsReceipt(profile, browser);
  const owned = await captureOwnedBrowserProcessReceiptsForPort(devtools.port);
  receipts = owned.receipts; browserPid = owned.rootPid;
  save('helper.json', {owner:process.env.CODEX_THREAD_ID || `bisbee-render-benchmark:${runId}`, purpose:'bounded Bisbee render profile', receipts, port, devtoolsPort:devtools.port,
    server:{pid:process.pid,executable:process.execPath,start:new Date(Date.now()-process.uptime()*1000).toISOString()},
    start:new Date().toISOString(), expiryMinutes:15, stop:'CDP Browser.close; exact owned identity cleanup in finally; in-process server.close', profile});
  const version = await (await fetch(`http://127.0.0.1:${devtools.port}/json/version`)).json();
  save('browser.json', version);
  client = new CdpClient(version.webSocketDebuggerUrl); await client.open();
  save('system.json', await client.send('SystemInfo.getInfo'));
  const targets = await (await fetch(`http://127.0.0.1:${devtools.port}/json/list`)).json();
  page = new ProfileClient(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await page.open();
  const driver = new BrowserDriver(page);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  const errors = []; page.on('Runtime.exceptionThrown', x => errors.push(x));
  await page.send('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await page.send('Page.navigate', { url:`http://127.0.0.1:${port}/index.html` });
  await driver.waitFor(`typeof SCENARIOS !== 'undefined' && typeof SCENARIOS.bisbee === 'function' && typeof THREE !== 'undefined'`, 'Bisbee and Three loaded', 60000);
  console.log('browser ready');
  const scenarioIdentity=await driver.evaluate(`(() => {
    rng = new SeededRandom(42); const scenario = SCENARIOS.bisbee(); window.__bisbee = new VugSimulator(scenario.conditions, scenario.events);
    const canvas = document.getElementById('topo-canvas-three'); document.body.appendChild(canvas);
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:760px;display:block;z-index:9999';
    return {shape_seed:scenario.conditions.wall.shape_seed,steps:scenario.defaultSteps,three:THREE.REVISION};
  })()`);
  if(scenarioIdentity.shape_seed!==13 || scenarioIdentity.steps!==340)throw new Error('The authored Bisbee workload changed; review the measurement contract');
  console.log(scenarioIdentity);
  const growth = [];
  for (let step = 0; step < 340; step += 5) {
    const result = await driver.evaluate(`(() => { const t=performance.now(); for(let i=0;i<5;i++) __bisbee.run_step(); return {step:__bisbee.step,ms:performance.now()-t,crystals:__bisbee.crystals.length}; })()`);
    growth.push(result);
    if (result.step % 20 === 0) console.log(JSON.stringify(result));
  }
  save('growth.json', growth);
  save('specimen.json', await driver.evaluate(`({step:__bisbee.step,rng:rng.state,crystals:__bisbee.crystals.map(c=>({id:c.crystal_id,mineral:c.mineral,habit:c.habit,length:c.c_length_mm,width:c.a_width_mm,zones:c.zones.length})),fluid:_simulationFluidProjection(__bisbee.conditions.fluid),evolution:__bisbee.wall_state.cavityEvolutionLedger().signature})`));
  console.log('specimen recorded');
  save('record-shape.json',await driver.evaluate(`__bisbee.crystals.slice(0,2).map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,Array.isArray(v)?{array:v.length}:typeof v])))`));
  console.log('record keys captured');
  await driver.evaluate(`window.__scienceJSON = () => {
    const seen=new WeakMap();
    const displayCaches=new Set(['_gwindelGeom','_gwindelGeomTd','_sceptreGeom','_sceptreGeomCf','_saddleGeom','_saddleGeomAmp','_bentGeom','_bentGeomAmt']);
    return JSON.stringify({crystals:__bisbee.crystals,fluid:_simulationFluidProjection(__bisbee.conditions.fluid),
      rng:rng.state,step:__bisbee.step,evolution:__bisbee.wall_state.cavityEvolutionLedger().signature},function(key,value){
      if(displayCaches.has(key))return undefined;
      if(value && typeof value==='object') {
        if(seen.has(value))return {$ref:seen.get(value)};
        seen.set(value,key===''?'$':seen.get(this)+'/'+key.replaceAll('~','~0').replaceAll('/','~1'));
      } return value;
    });
  }`);
  console.log('science serializer installed');
  const scienceLength = await driver.evaluate(`(()=>{window.__scienceBefore=__scienceJSON();return __scienceBefore.length;})()`);
  console.log('science serialized',scienceLength);
  if(!Number.isSafeInteger(scienceLength)||scienceLength>256*1024*1024)throw new Error('Scientific record export exceeded its bound');
  const chunks=[];
  for(let offset=0;offset<scienceLength;offset+=128*1024) {
    chunks.push(await driver.evaluate(`__scienceBefore.slice(${offset},${offset+128*1024})`));
  }
  fs.writeFileSync(path.join(out,'scientific-record.json'),chunks.join(''));
  chunks.length=0;
  await driver.evaluate(`window.__scienceUnchanged = () => __scienceJSON() === __scienceBefore;`);
  await driver.evaluate(`window.__renderInfo = () => ({memory:{..._topoThreeState.renderer.info.memory},render:{..._topoThreeState.renderer.info.render},programs:_topoThreeState.renderer.info.programs.length})`);
  await driver.evaluate(`(() => {
    window.__firstPhases={}; window.__firstOriginals={};
    for (const name of ['_topoInitThree','_topoInstallLightingRig','_topoBuildCavityGeometry','_topoConfigureCavityWallMaterial','_matrixSkinTexture','_wallGrainNormalMap','_wallReliefNormalMap','_wallReliefAOMap','_topoSyncCrystalMeshes','_topoCompileCavityShaderPrograms','_topoRenderFrame']) {
      __firstOriginals[name]=window[name]; window[name]=function(...args){const t=performance.now();try{return __firstOriginals[name].apply(this,args)}finally{__firstPhases[name]=(__firstPhases[name]||0)+performance.now()-t}};
    }
  })()`);
  await driver.evaluate(`window.__candidateLining = _emitSurfaceGrowthLining; window.__baselineLining = (0,eval)(${JSON.stringify('(' + baselineFunction.trim() + ')')}); _emitSurfaceGrowthLining=__${coldVariant || 'baseline'}Lining;`);
  await page.send('Profiler.enable'); await page.send('Profiler.start');
  const first = await driver.evaluate(`(() => { const t=performance.now(); const ok=_topoRenderThree(__bisbee,__bisbee.wall_state); return {ok,ms:performance.now()-t,info:__renderInfo(),canvas:[_topoThreeState.renderer.domElement.width,_topoThreeState.renderer.domElement.height]}; })()`);
  save('first.cpuprofile', (await page.send('Profiler.stop')).profile);
  save('first-phases.json', await driver.evaluate(`__firstPhases`));
  await driver.evaluate(`(()=>{for(const name of Object.keys(__firstOriginals))window[name]=__firstOriginals[name]})()`);
  save('first.json', first); console.log('first', JSON.stringify(first));
  await driver.evaluate(`window.__meshWitness = async () => {
    const hashes=new Map();
    const hash = array => { if(hashes.has(array))return hashes.get(array); const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);const result=crypto.subtle.digest('SHA-256',bytes).then(buffer=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join(''));hashes.set(array,result);return result; };
    const result=[];
    for(const mesh of _topoThreeState.crystals.children) {
      const attributes={}; for(const [name,a] of Object.entries(mesh.geometry.attributes)) attributes[name]={count:a.count,itemSize:a.itemSize,hash:await hash(a.array)};
      result.push({attributes,index:mesh.geometry.index?await hash(mesh.geometry.index.array):null,groups:mesh.geometry.groups,
        position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),
        instances:mesh.instanceMatrix?await hash(mesh.instanceMatrix.array):null,
        data:{...mesh.userData,source_points:mesh.userData.source_points ? await hash(Float64Array.from(mesh.userData.source_points.flat())) : null},materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({type:m.type,color:m.color?.getHex(),side:m.side,roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite}))});
    } return result;
  }`);
  console.log('witness started');
  save('cold-meshes.json', await driver.evaluate(`__meshWitness()`));
  if(coldVariant) {
    const scienceUnchanged=await driver.evaluate(`__scienceUnchanged()`);
    save('cold-verification.json',{variant:coldVariant,science_unchanged:scienceUnchanged,errors});
    if(!scienceUnchanged||errors.length)throw new Error('Cold rendering changed the record or raised an exception');
    const shot=await page.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,coldVariant+'.png'),Buffer.from(shot.data,'base64'));
  } else {
  let reference;
  await driver.evaluate(`window.__orbit = async () => {
    const gl=_topoThreeState.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const frames=[];
    for(let i=0;i<36;i++) {
      await new Promise(requestAnimationFrame);
      _topoTiltY=i*0.025;
      const q=ext?gl.createQuery():null;
      if(q) gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
      const t=performance.now();_topoRenderThree(__bisbee,__bisbee.wall_state);const cpu=performance.now()-t;
      if(q) gl.endQuery(ext.TIME_ELAPSED_EXT);
      let gpu=null,reason=ext?'query-unavailable':'extension-unavailable';
      if(q) {
        for(let wait=0;wait<120;wait++) {
          await new Promise(requestAnimationFrame);
          if(gl.getParameter(ext.GPU_DISJOINT_EXT)) {reason='disjoint';break;}
          if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)) {gpu=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;reason=null;break;}
        }
        gl.deleteQuery(q);
      }
      frames.push({cpu_ms:cpu,gpu_ms:gpu,gpu_unavailable:reason});
    } return frames;
  }`);
  const pairs=[];
  for(let pair=0;pair<6;pair++) for(const variant of pair%2===0?['baseline','candidate']:['candidate','baseline']) {
    const hostBefore=hostCpuSnapshot();
    // Dispose this probe's crystal resources before each independent rebuild.
    // The existing full-group rebuild retains some shared geometries; measuring
    // one variant later in that growth would confound the resource comparison.
    await driver.evaluate(`(()=>{const s=_topoThreeState,geometries=new Set(s.geomCache.values());
      for(const mesh of s.crystals.children)if(mesh.geometry)geometries.add(mesh.geometry);
      for(const geometry of geometries)geometry.dispose();s.geomCache.clear();})()`);
    await page.send('HeapProfiler.collectGarbage');
    const sample=await driver.evaluate(`(()=>{_emitSurfaceGrowthLining=__${variant}Lining;_topoThreeState.crystalsSig=''; const t=performance.now(); _topoSyncCrystalMeshes(_topoThreeState,__bisbee,__bisbee.wall_state);return {variant:${JSON.stringify(variant)},pair:${pair},ms:performance.now()-t,heap:performance.memory.usedJSHeapSize}})()`);
    const witness=await driver.evaluate(`__meshWitness()`);
    if(!reference) {reference=witness;save('reference-meshes.json',reference);}
    sample.meshes_equal=JSON.stringify(reference)===JSON.stringify(witness);
    if(!sample.meshes_equal) {save('mismatched-meshes.json',witness); throw new Error('geometry/material witness mismatch');}
    await driver.evaluate(`_topoRenderThree(__bisbee,__bisbee.wall_state)`);
    sample.orbit=await driver.evaluate(`__orbit()`);
    sample.science_unchanged=await driver.evaluate(`__scienceUnchanged()`);
    if(!sample.science_unchanged)throw new Error('Scientific record changed during rendering');
    if(pair===0) {
      const shot=await page.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(out,variant+'.png'),Buffer.from(shot.data,'base64'));
    }
    await page.send('HeapProfiler.collectGarbage');
    sample.retained={heap:(await page.send('Runtime.getHeapUsage')).usedSize,
      heap_source:'CDP Runtime.getHeapUsage after HeapProfiler.collectGarbage',
      info:await driver.evaluate(`__renderInfo()`)};
    sample.host_cpu=hostCpuInterval(hostBefore);
    pairs.push(sample);save('pairs.json',pairs);console.log('pair',JSON.stringify({...sample,orbit:undefined}));
  }
  const summary=summarizeBisbeeRenderComparison(pairs);
  save('summary.json',summary);
  if(summary.status!=='passed')throw new Error('Rendering comparison '+summary.status+'; see separate acceptance gates');
  await page.send('Profiler.enable'); await page.send('Profiler.start');
  const timings = await driver.evaluate(`(async () => {
    const samples=[]; const names=['_topoBuildCavityGeometry','_topoCavitySurfaceSource','_topoInstallCavityFieldClip','_topoSyncCrystalMeshes','_topoCrystalsSignature','_topoApplyCameraFromTilt','_topoHelixOverlayDraw','_topoRenderPreparedCavityScene','_topoPublishCavityClipReceipt'];
    const originals={}; let phases={};
    for (const name of names) { originals[name]=window[name]; window[name]=function(...args) {const t=performance.now();try{return originals[name].apply(this,args)}finally{phases[name]=(phases[name]||0)+performance.now()-t}}; }
    try { for(let i=0;i<24;i++){ await new Promise(requestAnimationFrame); phases={}; _topoTiltY=i*0.025;
      const t=performance.now(); const ok=_topoRenderThree(__bisbee,__bisbee.wall_state); samples.push({i,ok,ms:performance.now()-t,phases,info:__renderInfo()});
    }} finally {for(const name of names) window[name]=originals[name];}
    return samples;
  })()`);
  save('orbit.json', timings); save('orbit.cpuprofile', (await page.send('Profiler.stop')).profile);
  save('metrics.json', await page.send('Performance.getMetrics'));
  const shot = await page.send('Page.captureScreenshot', {format:'png'}); fs.writeFileSync(path.join(out, 'bisbee.png'), Buffer.from(shot.data, 'base64'));
  save('after.json', await driver.evaluate(`({gpu:_topoThreeState.renderer.getContext().getSupportedExtensions(),heap:{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}})`));
  save('errors.json', errors); console.log('orbit', JSON.stringify(timings.map(x=>({ms:x.ms,phases:x.phases}))));
  if(errors.length)throw new Error('Browser recorded runtime exceptions');
  }
} finally {
  clearTimeout(deadline);
  await cleanupOwnedBrowserResources({
    browser, client, page, browserPid, receipts, profile,
    closeServer: () => new Promise(resolve => server.close(resolve)),
    removeProfile: async () => {
      if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('vugg-bisbee-')) throw new Error('Unexpected disposable profile path');
      await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
    },
  });
  save('cleanup.json',{closed:true,at:new Date().toISOString(),port,browserPid});
}
