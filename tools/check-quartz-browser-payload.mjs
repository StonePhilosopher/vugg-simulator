// Audit the actual owned Chrome download in its producing JS engine. Never
// substitute a Node reconstruction for browser testimony or loosen a hash pin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {nodeRuntimeIdentity,runtimeExecutionDigest} from './evidence-runtime.mjs';
const base='91e5cc1102b453acac1638adb40b51587b75115e';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyQuartzBrowserPayload(driver,downloadedFile,diagnostics){
  const previous=JSON.parse(execFileSync('git',['show',`${base}:archive/evidence/guided-tutorial-browser-v285.json`],
    {encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024})).payload.journeys;
  const actual=fs.readFileSync(downloadedFile),encoded=actual.toString('base64');
  const proof=await driver.evaluate(`(async()=>{
    const bytes=Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0));
    const ds=await stripDeserialize(bytes);
    stripValidateQuartzFormTestimony(ds.quartz_form_testimony,ds.manifest.axes.steps);
    const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const legacy={...ds};delete legacy.quartz_form_testimony;
    const raw=await stripSerialize(ds,false),legacyRaw=await stripSerialize(legacy,false),legacyDownload=await stripSerialize(legacy,true);
    const roundtrip=await stripDeserialize(await stripSerialize(ds,true));
    const toBase64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
    const m=ds.manifest;
    return {manifest:{format_version:m.format_version,sim_version:m.sim_version,scenario_id:m.scenario_id,
      scenario_spec_hash:m.scenario_spec_hash,seed:m.seed,recorded_at:m.recorded_at,duration_steps:m.duration_steps,
      axes:m.axes,notes:m.notes,modelDigestSha256:await digest(new TextEncoder().encode(m.model_digest)),
      chipsSha256:await digest(new TextEncoder().encode(JSON.stringify(m.chips)))},
      fingerprint:simulationStateFingerprint(window.vugg.legendsSim),
      rawSha256:await digest(raw),downloadSha256:await digest(bytes),withoutQuartzRawSha256:await digest(legacyRaw),
      withoutQuartzDownloadSha256:await digest(legacyDownload),roundtripRawSha256:await digest(await stripSerialize(roundtrip,false)),
      quartzCrystals:ds.quartz_form_testimony.length,
      quartzSnapshots:ds.quartz_form_testimony.reduce((n,r)=>n+(r.history.initial?1:0)+r.history.changes.length,0),
      channelSha256:await digest(new TextEncoder().encode(JSON.stringify(ds.quartz_form_testimony))),
      legacyDownloadBase64:toBase64(legacyDownload)};
  })()`);
  assert.equal(proof.manifest.scenario_id,'shigar_pegmatite');assert.equal(proof.manifest.seed,42);
  assert.equal(proof.manifest.axes.steps,70);assert.equal(proof.manifest.recorded_at,42);
  assert.equal(proof.fingerprint,previous.simulation.geology_preservation.before.fingerprint);
  assert.equal(proof.downloadSha256,hash(actual),'Proof must consume the actual browser download');
  assert.equal(proof.withoutQuartzRawSha256,previous.player_surfaces.strip_view.dataset_digest_sha256);
  assert.equal(proof.withoutQuartzDownloadSha256,previous.player_surfaces.strip_view.download_sha256);
  assert.equal(proof.roundtripRawSha256,proof.rawSha256);
  const folder=path.resolve('.local-evidence/quartz-browser-payload');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'actual.stripview'),actual);
  const legacy=Buffer.from(proof.legacyDownloadBase64,'base64');assert.equal(hash(legacy),proof.withoutQuartzDownloadSha256);
  fs.writeFileSync(path.join(folder,'without-quartz.stripview'),legacy);delete proof.legacyDownloadBase64;
  const result={schema:'quartz-browser-payload-validation-v1',base,runtime:nodeRuntimeIdentity(),
    runtimeExecutionDigest:runtimeExecutionDigest(process.cwd()),browser:diagnostics.browser_runtime,
    sourceSha256:hash(fs.readFileSync(import.meta.filename,'utf8').replaceAll('\r\n','\n')),proof,
    comparison:'Removing only quartz_form_testimony from the actual Chrome download recovers exact baseline raw and compressed bytes.',
    scientificFingerprintUnchanged:true,roundtripRawBytesUnchanged:true};
  fs.mkdirSync('proposals/evidence',{recursive:true});
  fs.writeFileSync('proposals/evidence/quartz-browser-payload-validation.json',JSON.stringify(result,null,2)+'\n');
  console.log('[quartz-browser-payload] '+JSON.stringify({passed:true,...proof}));
  return result;
}
