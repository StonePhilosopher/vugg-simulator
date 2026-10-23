// Measurement only: production WebGL rebuilds of completed, authored specimens.
// Run from the repo: node tools/contact-geometry-lifecycle-benchmark.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { CdpClient, BrowserDriver, spawnOwned, waitForDevToolsReceipt, assertOwnedDevToolsVersion,
  captureOwnedBrowserProcessReceiptsForPort } from './browser-workflow.mjs';
import { cleanupOwnedBrowserResources } from './benchmark-browser-cleanup.mjs';
import { findOwnedBrowserExecutable } from './owned-browser-runtime.mjs';
import { assertIndexMatchesDist, assertCommissionedEvidenceRuntime } from './evidence-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '59d9c409a79d9631792e789c63248262e5519150';
const scenarios = ['mvt', 'gem_pegmatite', 'bisbee'];
if (process.argv.length !== 2) throw new Error('This bounded probe accepts no workload overrides');
assertCommissionedEvidenceRuntime();
assertIndexMatchesDist(root);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runId = randomUUID();
const out = path.join(root, '.local-evidence', 'contact-geometry-lifecycle', runId);
fs.mkdirSync(out, { recursive: true });
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
fs.writeFileSync(path.join(path.dirname(out), 'latest.json'), JSON.stringify({ runId, out }));
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, 'benchmark-source.mjs'));
const source = execFileSync('git', ['show', `${baseline}:js/99i-renderer-three.ts`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const start = source.indexOf('function _topoSyncCrystalMeshes(');
const end = source.indexOf('// Cached raycaster + NDC vector', start);
if (start < 0 || end < start) throw new Error('Pinned baseline sync function is unavailable');
const baselineFunction = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
save('identity.json', { baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  inputs: Object.fromEntries(['index.html', 'js/99i-renderer-three.ts', 'tools/three.module.js', 'data/scenarios.json5',
    'data/minerals.json', 'tools/contact-geometry-lifecycle-benchmark.mjs', 'tools/browser-workflow.mjs', 'tools/benchmark-browser-cleanup.mjs',
    'tools/owned-browser-runtime.mjs', 'tools/evidence-runtime.mjs'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))])),
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model },
  workload: { scenarios, seed: 42, authored_shape_seeds: true, full_authored_runs: true, constructions_per_variant: 4, width: 1000, height: 760, dpr: 1 },
  trust: 'Resource-lifecycle measurement and preservation of existing output; not geological validation, VRAM bytes, or a speed benchmark' });

const nonce = randomUUID();
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    const type = { '.js': 'text/javascript', '.json': 'application/json', '.json5': 'application/json', '.html': 'text/html', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-vugg-server-nonce': nonce }).end(bytes);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-contact-lifecycle-'));
let browser, browserPid, client, page, receipts = [], devtoolsReceipt;
const deadline = setTimeout(() => { void client?.send('Browser.close').catch(() => {}); }, 20 * 60_000);
class ProbeClient extends CdpClient {
  send(method, params = {}, sessionId = null) {
    const id = this.nextId, result = super.send(method, params, sessionId), pending = this.pending.get(id);
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => { this.pending.delete(id); pending.reject(new Error(`Probe timeout: ${method}`)); }, 60_000);
    return result;
  }
}
console.log('output', out);
try {
  browser = spawnOwned(findOwnedBrowserExecutable(), ['--headless=new', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--no-sandbox', '--mute-audio', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  browser.stderr.on('data', () => {});
  const devtools = await waitForDevToolsReceipt(profile, browser);
  devtoolsReceipt = devtools;
  const owned = await captureOwnedBrowserProcessReceiptsForPort(devtools.port, { devtoolsReceipt });
  receipts = owned.receipts; browserPid = owned.rootPid;
  save('helper.json', { owner: process.env.CODEX_THREAD_ID || `contact-lifecycle:${runId}`, purpose: 'bounded WebGL resource-lifecycle comparison',
    receipts, port, devtoolsPort: devtools.port, profile, start: new Date().toISOString(), expiryMinutes: 20,
    server: { pid: process.pid, executable: process.execPath, start: new Date(Date.now() - process.uptime() * 1000).toISOString() },
    source: 'tools/contact-geometry-lifecycle-benchmark.mjs', stop: 'CDP Browser.close and exact owned cleanup in finally; server.close' });
  const version = await (await fetch(`http://127.0.0.1:${devtools.port}/json/version`)).json();
  assertOwnedDevToolsVersion(version, devtoolsReceipt);
  save('browser.json', version);
  client = new CdpClient(version.webSocketDebuggerUrl); await client.open();
  save('system.json', await client.send('SystemInfo.getInfo'));
  const targets = await (await fetch(`http://127.0.0.1:${devtools.port}/json/list`)).json();
  page = new ProbeClient(targets.find(target => target.type === 'page').webSocketDebuggerUrl); await page.open();
  const driver = new BrowserDriver(page), errors = [], results = [];
  page.on('Runtime.exceptionThrown', error => errors.push(error));
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const scenarioName of scenarios) {
    const search = `?lifecycle=${runId}-${scenarioName}`;
    await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${search}` });
    await driver.waitFor(`location.search === ${JSON.stringify(search)} && typeof SCENARIOS !== 'undefined' && typeof SCENARIOS[${JSON.stringify(scenarioName)}] === 'function' && typeof THREE !== 'undefined'`, 'scenario and Three loaded', 60_000);
    const workload = await driver.evaluate(`(() => {
      rng = new SeededRandom(42); const scenario = SCENARIOS[${JSON.stringify(scenarioName)}]();
      window.__specimen = new VugSimulator(scenario.conditions, scenario.events);
      const canvas = document.getElementById('topo-canvas-three'); document.body.appendChild(canvas);
      canvas.style.cssText='position:fixed;left:0;top:0;width:1000px;height:760px;display:block;z-index:9999';
      return {steps:scenario.defaultSteps,shape_seed:scenario.conditions.wall.shape_seed,three:THREE.REVISION};
    })()`);
    if (!Number.isSafeInteger(workload.steps) || workload.steps < 1 || workload.steps > 1000) throw new Error('Unbounded workload');
    const growth = [];
    for (let step = 0; step < workload.steps; step += 5) {
      const count = Math.min(5, workload.steps - step);
      growth.push(await driver.evaluate(`(() => {const t=performance.now();for(let i=0;i<${count};i++)__specimen.run_step();return {step:__specimen.step,elapsed_ms:performance.now()-t};})()`));
      if ((step + count) % 40 === 0) console.log(scenarioName, 'grown', step + count);
    }
    save(`${scenarioName}-growth.json`, growth);
    await driver.evaluate(`window.__candidateSync=_topoSyncCrystalMeshes; window.__baselineSync=(0,eval)(${JSON.stringify('(' + baselineFunction.trim() + ')')});
      window.__scienceBefore=simulationStateFingerprint(__specimen);
      window.__allGeometries=new Set(); window.__contactEvents=new Map();
      window.__baselineFrames=[];
      window.__frameWitness=async(dataUrl,variant)=>{
        const image=new Image();image.src=dataUrl;await image.decode();
        if(image.width!==1000||image.height!==760)throw new Error('Unexpected screenshot size');
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d',{colorSpace:'srgb'});context.drawImage(image,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        const comparisons=__baselineFrames.map(baseline=>{
          let max_rgb_delta=0,changed_pixels=0,alpha_equal=true;
          for(let i=0;i<pixels.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(pixels[i+c]-baseline[i+c]);max_rgb_delta=Math.max(max_rgb_delta,d);changed ||= d!==0;}if(pixels[i+3]!==baseline[i+3])alpha_equal=false;if(changed)changed_pixels++;}
          return {max_rgb_delta,changed_pixels,alpha_equal};
        });
        if(variant==='baseline')__baselineFrames.push(pixels);
        return comparisons;
      };
      window.__observe=()=>{
        const s=_topoThreeState;
        s.crystals.traverse(mesh=>{
          if(mesh.geometry)__allGeometries.add(mesh.geometry);
          if(mesh.userData?.isSatellite || !Array.isArray(mesh.material) || !mesh.geometry?.groups.some(g=>g.materialIndex===1))return;
          if(!__contactEvents.has(mesh.geometry)) {const entry={events:0};__contactEvents.set(mesh.geometry,entry);mesh.geometry.addEventListener('dispose',()=>entry.events++);}
        });
        for(const geometry of s.geomCache.values())__allGeometries.add(geometry);
      };
      window.__cleanVariant=()=>{
        // ONLY between independent variants, never between measured rebuilds.
        for(const geometry of __allGeometries)geometry.dispose();
        __allGeometries.clear();__contactEvents.clear();_topoThreeState.geomCache.clear();
      };
      window.__witness=async()=>{
        const hashes=new Map();
        const hash=array=>{if(hashes.has(array))return hashes.get(array);const p=crypto.subtle.digest('SHA-256',new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''));hashes.set(array,p);return p;};
        const meshes=[];_topoThreeState.crystals.traverse(mesh=>{if(mesh.geometry)meshes.push(mesh);});
        const result=[];
        for(const mesh of meshes) {
          const attributes={};for(const [name,a]of Object.entries(mesh.geometry.attributes))attributes[name]={count:a.count,itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name,hash:await hash(a.array)};
          const {ownsGeometry,...data}=mesh.userData; // Sole permitted metadata difference: disposal ownership.
          if(data.source_points)data.source_points=await hash(Float64Array.from(data.source_points.flat()));
          result.push({attributes,index:mesh.geometry.index?await hash(mesh.geometry.index.array):null,groups:mesh.geometry.groups,
            position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),
            instances:mesh.instanceMatrix?await hash(mesh.instanceMatrix.array):null,data,
            materials:[].concat(mesh.material).map(m=>({type:m.type,color:m.color?.getHex(),side:m.side,roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,
              transmission:m.transmission,thickness:m.thickness,ior:m.ior,attenuationDistance:m.attenuationDistance,attenuationColor:m.attenuationColor?.getHex(),envMapIntensity:m.envMapIntensity,
              specularIntensity:m.specularIntensity,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,emissive:m.emissive?.getHex(),emissiveIntensity:m.emissiveIntensity,
              alphaTest:m.alphaTest,depthTest:m.depthTest,blending:m.blending,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits}))});
        }return result;
      };`);
    // Warm the complete renderer once. Both variants then start with cleared display geometry caches.
    if (!await driver.evaluate(`_topoRenderThree(__specimen,__specimen.wall_state)`)) throw new Error('Renderer unavailable');
    await driver.evaluate('__observe()');
    const samples = [], screenshots = {};
    let reference, referenceQuality;
    for (const variant of ['baseline', 'candidate']) {
      await driver.evaluate(`__cleanVariant();_topoSyncCrystalMeshes=__${variant}Sync;`);
      for (let iteration = 0; iteration < 4; iteration++) {
        const sample = await driver.evaluate(`(() => {
          const oldContacts=[...__contactEvents].filter(([g])=>_topoThreeState.crystals.children.some(m=>m.geometry===g));
          const prior=oldContacts.map(([g,e])=>e.events);
          _topoThreeState.crystalsSig=null;
          const t=performance.now(),ok=_topoRenderThree(__specimen,__specimen.wall_state);__observe();
          const r=_topoThreeState.renderer;
          return {ok,elapsed_ms:performance.now()-t,memory:{...r.info.memory},programs:r.info.programs.length,render:{...r.info.render},
            quality:{width:r.domElement.width,height:r.domElement.height,dpr:r.getPixelRatio(),toneMapping:r.toneMapping,exposure:r.toneMappingExposure,
              shadows:r.shadowMap.enabled,shadow_type:r.shadowMap.type,shadow_map:_topoThreeState.lightingGate?.shadow_map,optics_tier:_topoThreeState.opticsRig?.tier,
              camera_projection:_topoThreeState.camera.projectionMatrix.toArray(),camera_world:_topoThreeState.camera.matrixWorld.toArray()},
            retired_contact_dispose_events:oldContacts.map(([g,e],i)=>e.events-prior[i]),
            current_contacts:_topoThreeState.crystals.children.filter(m=>Array.isArray(m.material)&&m.geometry.groups.some(g=>g.materialIndex===1)).length,
            science_unchanged:simulationStateFingerprint(__specimen)===__scienceBefore};
        })()`);
        const witness = await driver.evaluate('__witness()');
        if (!reference) { reference = JSON.stringify(witness); save(`${scenarioName}-mesh-witness.json`, witness); }
        if (!referenceQuality) referenceQuality=JSON.stringify(sample.quality);
        sample.geometry_material_metadata_equal = JSON.stringify(witness) === reference;
        sample.camera_and_quality_equal = JSON.stringify(sample.quality) === referenceQuality;
        sample.geometry_sha256 = hash(JSON.stringify(witness));
        sample.variant = variant; sample.iteration = iteration;
        samples.push(sample); save(`${scenarioName}-samples.json`, samples);
        console.log(scenarioName, variant, iteration, JSON.stringify(sample));
        if (!sample.ok || !sample.science_unchanged || !sample.geometry_material_metadata_equal || !sample.camera_and_quality_equal) throw new Error('Preservation gate failed');
        {
          const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 760, scale: 1 } });
          const bytes = Buffer.from(shot.data, 'base64');
          fs.writeFileSync(path.join(out, `${scenarioName}-${variant}-${iteration}.png`), bytes);
          sample.pixel_comparisons_to_prior_baselines=await driver.evaluate(`__frameWitness(${JSON.stringify('data:image/png;base64,' + shot.data)},${JSON.stringify(variant)})`);
          save(`${scenarioName}-samples.json`, samples);
          if (iteration === 0) screenshots[variant] = hash(bytes);
          if (variant === 'baseline' && iteration === 0) {
            const repeat = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 760, scale: 1 } });
            fs.writeFileSync(path.join(out, `${scenarioName}-same-frame-repeat.png`), Buffer.from(repeat.data, 'base64'));
          }
        }
      }
    }
    const before = samples.filter(sample => sample.variant === 'baseline'), after = samples.filter(sample => sample.variant === 'candidate');
    const baselinePixels=before.flatMap(sample=>sample.pixel_comparisons_to_prior_baselines);
    const candidatePixels=after.flatMap(sample=>sample.pixel_comparisons_to_prior_baselines);
    const baselineMax=Math.max(...baselinePixels.map(row=>row.max_rgb_delta));
    const candidateMax=Math.max(...candidatePixels.map(row=>row.max_rgb_delta));
    const result = { scenario: scenarioName, workload,
      science_fingerprint: await driver.evaluate('__scienceBefore'),
      baseline_geometries: before.map(sample => sample.memory.geometries),
      candidate_geometries: after.map(sample => sample.memory.geometries),
      baseline_geometry_count_increases: before.at(-1).memory.geometries > before[0].memory.geometries,
      screenshots, frames_byte_identical: screenshots.baseline === screenshots.candidate,
      pixel_repeatability:{baseline_max_rgb_delta:baselineMax,candidate_max_rgb_delta:candidateMax,
        alpha_equal:[...baselinePixels,...candidatePixels].every(row=>row.alpha_equal),
        baseline_max_changed_pixels:Math.max(...baselinePixels.map(row=>row.changed_pixels)),
        candidate_max_changed_pixels:Math.max(...candidatePixels.map(row=>row.changed_pixels)),total_pixels:1000*760},
      // Each specimen's untouched baseline is measured before its candidate.
      // Optical stacks have different rounding envelopes; preserve and report
      // the absolute observed bound, never widen it to accommodate a candidate.
      frames_within_baseline_repeatability:candidateMax<=baselineMax && [...baselinePixels,...candidatePixels].every(row=>row.alpha_equal),
      baseline_reproduces_missing_disposal: before.slice(1).every(sample => sample.retired_contact_dispose_events.length > 0 && sample.retired_contact_dispose_events.every(count => count === 0)),
      candidate_disposes_each_retired_contact_once: after.slice(1).every(sample => sample.retired_contact_dispose_events.length > 0 && sample.retired_contact_dispose_events.every(count => count === 1)),
      candidate_resource_counts_stable: after.every(sample => sample.memory.geometries === after[0].memory.geometries && sample.memory.textures === after[0].memory.textures && sample.programs === after[0].programs),
      matched_initial_resources: JSON.stringify(before[0].memory) === JSON.stringify(after[0].memory) && before[0].programs === after[0].programs,
      geometry_and_science_preserved: samples.every(sample => sample.geometry_material_metadata_equal && sample.science_unchanged),
      camera_and_quality_preserved:samples.every(sample=>sample.camera_and_quality_equal),
      draw_counts_preserved: samples.every(sample => ['calls', 'triangles', 'points', 'lines'].every(key => sample.render[key] === before[0].render[key])),
    };
    result.passed = result.frames_within_baseline_repeatability && result.baseline_reproduces_missing_disposal && result.baseline_geometry_count_increases
      && result.candidate_disposes_each_retired_contact_once && result.candidate_resource_counts_stable
      && result.matched_initial_resources && result.geometry_and_science_preserved && result.camera_and_quality_preserved && result.draw_counts_preserved;
    results.push(result); save('summary.json', { results, errors, passed: results.length === scenarios.length && results.every(row => row.passed) && errors.length === 0 });
    if (!result.passed) throw new Error(`${scenarioName} resource-lifecycle acceptance gate failed`);
    await driver.evaluate('__cleanVariant()');
  }
  if (errors.length) throw new Error('Browser runtime exceptions observed');
} finally {
  clearTimeout(deadline);
  await cleanupOwnedBrowserResources({
    browser, client, page, browserPid, receipts, profile, devtoolsReceipt,
    closeServer: () => new Promise(resolve => server.close(resolve)),
    removeProfile: async () => {
      if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('vugg-contact-lifecycle-')) throw new Error('Unexpected disposable profile path');
      await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
    },
  });
  save('cleanup.json', { closed: true, at: new Date().toISOString(), port, browserPid });
}
